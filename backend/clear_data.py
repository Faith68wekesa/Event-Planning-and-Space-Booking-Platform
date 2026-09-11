import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import User, VendorProfile, VenueOwnerProfile, Venue, Booking

# Clear existing data
Booking.objects.all().delete()
Venue.objects.all().delete()
VendorProfile.objects.all().delete()
VenueOwnerProfile.objects.all().delete()
User.objects.all().delete()

print("All mock data has been cleared from the database.")
