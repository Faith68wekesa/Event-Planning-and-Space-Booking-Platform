from django.core.management.base import BaseCommand
import datetime
from django.utils import timezone
from core.models import Booking

class Command(BaseCommand):
    help = 'Automatically evaluate booking lifecycle and complete past events'

    def handle(self, *args, **options):
        today = datetime.date.today()
        updated_count = Booking.objects.filter(
            status='APPROVED',
            event_date__lt=today
        ).update(status='COMPLETED')

        self.stdout.write(
            self.style.SUCCESS(f"Successfully processed booking lifecycle. Marked {updated_count} past bookings as COMPLETED.")
        )
