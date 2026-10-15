from datetime import date, timedelta
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import Event, EventService, Notification, ChecklistReminderLog, CustomerReminderPreference
from .services.reminder_service import evaluate_and_generate_reminders

User = get_user_model()

class ChecklistRemindersTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='reminder_customer',
            email='customer@example.com',
            password='password123',
            role='CUSTOMER'
        )
        self.today = date(2026, 10, 15)
        self.event = Event.objects.create(
            owner=self.user,
            name='Summer Gala',
            event_type='Corporate',
            date=self.today + timedelta(days=20),
            location='Nairobi'
        )

    def test_reminder_schedule_generation(self):
        # 1. 7-days before
        task_7d = EventService.objects.create(
            event=self.event,
            name='Book Catering',
            due_date=self.today + timedelta(days=7),
            is_completed=False
        )
        # 2. 1-day before
        task_1d = EventService.objects.create(
            event=self.event,
            name='Confirm Guest List',
            due_date=self.today + timedelta(days=1),
            is_completed=False
        )
        # 3. Due today
        task_today = EventService.objects.create(
            event=self.event,
            name='Send Invitations',
            due_date=self.today,
            is_completed=False
        )
        # 4. Overdue
        task_overdue = EventService.objects.create(
            event=self.event,
            name='Deposit Venue Fee',
            due_date=self.today - timedelta(days=2),
            is_completed=False
        )
        # 5. Completed task (should be skipped)
        task_completed = EventService.objects.create(
            event=self.event,
            name='Draft Agenda',
            due_date=self.today + timedelta(days=1),
            is_completed=True
        )

        notifs = evaluate_and_generate_reminders(user=self.user, target_date=self.today)
        self.assertEqual(len(notifs), 4)

        messages = [n.message for n in notifs]
        self.assertTrue(any('due in 7 days' in m for m in messages))
        self.assertTrue(any('due tomorrow' in m for m in messages))
        self.assertTrue(any('due today' in m for m in messages))
        self.assertTrue(any('is overdue' in m for m in messages))
        self.assertFalse(any('Draft Agenda' in m for m in messages))

    def test_duplicate_prevention_idempotency(self):
        task = EventService.objects.create(
            event=self.event,
            name='Book DJ',
            due_date=self.today + timedelta(days=7),
            is_completed=False
        )

        # First run: generates reminder
        first_run = evaluate_and_generate_reminders(user=self.user, target_date=self.today)
        self.assertEqual(len(first_run), 1)

        # Second run on the same day: should NOT generate duplicate
        second_run = evaluate_and_generate_reminders(user=self.user, target_date=self.today)
        self.assertEqual(len(second_run), 0)

        # Total in DB should still be 1
        self.assertEqual(Notification.objects.filter(task=task).count(), 1)
        self.assertEqual(ChecklistReminderLog.objects.filter(task=task).count(), 1)

    def test_customer_preference_filtering(self):
        pref, _ = CustomerReminderPreference.objects.get_or_create(user=self.user)
        pref.remind_7_days = False
        pref.save()

        EventService.objects.create(
            event=self.event,
            name='Photographer Brief',
            due_date=self.today + timedelta(days=7),
            is_completed=False
        )

        notifs = evaluate_and_generate_reminders(user=self.user, target_date=self.today)
        self.assertEqual(len(notifs), 0)
