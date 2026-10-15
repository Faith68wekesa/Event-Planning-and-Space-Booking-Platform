from datetime import date
from django.db import transaction
from django.utils import timezone
from ..models import (
    EventService,
    Notification,
    ChecklistReminderLog,
    CustomerReminderPreference
)

def evaluate_and_generate_reminders(user=None, target_date=None):
    """
    Evaluates incomplete checklist tasks and creates in-app notifications according
    to the 4 milestone schedules:
    - 7 days before deadline ('7_DAYS')
    - 1 day before deadline ('1_DAY')
    - On deadline ('DUE_TODAY')
    - Past deadline ('OVERDUE' - sent only once)
    
    Adheres strictly to:
    - User reminder preferences
    - Skipping completed tasks
    - Database unique constraint deduplication
    """
    if target_date is None:
        target_date = timezone.localdate() if timezone.is_aware(timezone.now()) else date.today()

    tasks_qs = EventService.objects.filter(
        due_date__isnull=False,
        is_completed=False,
        event__isnull=False
    ).select_related('event', 'event__owner')

    if user:
        tasks_qs = tasks_qs.filter(event__owner=user)

    generated_notifications = []

    for task in tasks_qs:
        event = task.event
        task_owner = event.owner

        # Fetch or get defaults for customer preferences
        pref, _ = CustomerReminderPreference.objects.get_or_create(user=task_owner)
        if not pref.in_app_enabled:
            continue

        days_diff = (task.due_date - target_date).days
        reminder_type = None
        message = ""

        if days_diff == 7 and pref.remind_7_days:
            reminder_type = '7_DAYS'
            message = f'"{task.name}" for {event.name} is due in 7 days.'
        elif days_diff == 1 and pref.remind_1_day:
            reminder_type = '1_DAY'
            message = f'"{task.name}" for {event.name} is due tomorrow.'
        elif days_diff == 0 and pref.remind_due_today:
            reminder_type = 'DUE_TODAY'
            message = f'"{task.name}" for {event.name} is due today.'
        elif days_diff < 0 and pref.remind_overdue:
            reminder_type = 'OVERDUE'
            message = f'"{task.name}" for {event.name} is overdue.'

        if not reminder_type:
            continue

        # Atomic deduplication via ChecklistReminderLog
        with transaction.atomic():
            already_sent = ChecklistReminderLog.objects.filter(
                task=task,
                reminder_type=reminder_type,
                channel='IN_APP'
            ).exists()

            if already_sent:
                continue

            ChecklistReminderLog.objects.create(
                task=task,
                reminder_type=reminder_type,
                channel='IN_APP'
            )

            notif = Notification.objects.create(
                user=task_owner,
                event=event,
                task=task,
                title='Checklist Reminder',
                message=message,
                notification_type='CHECKLIST_REMINDER',
                is_read=False
            )
            generated_notifications.append(notif)

    return generated_notifications
