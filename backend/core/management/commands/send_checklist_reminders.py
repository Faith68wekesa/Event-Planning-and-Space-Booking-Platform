from django.core.management.base import BaseCommand
from core.services.reminder_service import evaluate_and_generate_reminders

class Command(BaseCommand):
    help = 'Check all incomplete checklist tasks and generate automated reminders according to 7-day, 1-day, today, and overdue schedules'

    def handle(self, *args, **options):
        self.stdout.write("Running automated checklist reminders scan...")
        notifs = evaluate_and_generate_reminders()
        self.stdout.write(self.style.SUCCESS(f"Successfully generated {len(notifs)} reminder notifications."))
