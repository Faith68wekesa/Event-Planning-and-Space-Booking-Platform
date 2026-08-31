import os
import django
from decimal import Decimal
from datetime import datetime, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import User, VendorProfile, Venue, Booking

def seed():
    # Clear existing data
    Booking.objects.all().delete()
    Venue.objects.all().delete()
    VendorProfile.objects.all().delete()
    User.objects.all().delete()

    print("Cleared existing data.")

    # Create mock vendors (Users + VendorProfiles)
    u1 = User.objects.create_user(username='alex_river', email='alex@example.com', password='password123', role='VENDOR', first_name='Alex', last_name='River')
    v1 = VendorProfile.objects.create(
        user=u1,
        business_name='Alex River Events',
        vendor_type='PLANNER',
        description='Expert event planning for all occasions.',
        location='Nairobi CBD',
        starting_price=Decimal('15000.00'),
        contact_email='contact@alexriver.com',
        is_verified=True,
        rating=4.9,
        review_count=120
    )

    u2 = User.objects.create_user(username='sarah_j', email='sarah@example.com', password='password123', role='VENDOR', first_name='Sarah', last_name='J')
    v2 = VendorProfile.objects.create(
        user=u2,
        business_name='Sarah J Decor',
        vendor_type='DECORATOR',
        description='Premium decoration and styling services.',
        location='Karen',
        starting_price=Decimal('20000.00'),
        contact_email='hello@sarahjdecor.com',
        is_verified=True,
        rating=4.8,
        review_count=85
    )

    u3 = User.objects.create_user(username='mikes_catering', email='mike@example.com', password='password123', role='VENDOR', first_name='Mike', last_name='Smith')
    v3 = VendorProfile.objects.create(
        user=u3,
        business_name="Mike's Catering",
        vendor_type='CATERER',
        description='Delicious food for your special events.',
        location='Westlands',
        starting_price=Decimal('10000.00'),
        contact_email='info@mikescatering.com',
        is_verified=True,
        rating=4.7,
        review_count=90
    )

    print("Created vendors.")

    # Create mock venues
    venue1 = Venue.objects.create(
        vendor=v1,
        title='Karen Oasis Gardens',
        description='Beautiful outdoor gardens for weddings and events.',
        category='OUTDOOR',
        location='Karen, Nairobi',
        address='123 Karen Rd',
        capacity=500,
        price_per_day=Decimal('85000.00'),
        amenities=['Parking', 'Security', 'Restrooms', 'Power Backup'],
        image_url='https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80',
        is_verified=True,
        is_available=True,
        rating=4.8,
        review_count=124
    )

    venue2 = Venue.objects.create(
        vendor=v1,
        title='Rift Valley Heights',
        description='Luxurious conference center with a view.',
        category='CONFERENCE',
        location='Westlands, Nairobi',
        address='456 Westlands Ave',
        capacity=300,
        price_per_day=Decimal('120000.00'),
        price_per_hour=Decimal('15000.00'),
        amenities=['WiFi', 'Projector', 'Air Conditioning', 'Catering Area'],
        image_url='https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80',
        is_verified=True,
        is_available=True,
        rating=4.9,
        review_count=89
    )

    venue3 = Venue.objects.create(
        vendor=v2,
        title='City Center Hall',
        description='Spacious hall in the heart of the city.',
        category='EXHIBITION',
        location='Nairobi CBD',
        address='789 City Center Way',
        capacity=1000,
        price_per_day=Decimal('200000.00'),
        amenities=['Parking', 'Security', 'Air Conditioning', 'Elevators'],
        image_url='https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80',
        is_verified=False,
        is_available=True,
        rating=4.5,
        review_count=45
    )

    print("Created venues.")

    # Create a mock customer
    c1 = User.objects.create_user(username='john_doe', email='john@example.com', password='password123', role='CUSTOMER', first_name='John', last_name='Doe')

    # Create mock bookings
    Booking.objects.create(
        customer=c1,
        venue=venue1,
        event_title='Wedding Reception',
        event_type='Wedding',
        event_date=(datetime.now() + timedelta(days=14)).date(),
        guest_count=400,
        total_price=Decimal('85000.00'),
        status='APPROVED'
    )

    Booking.objects.create(
        customer=c1,
        venue=venue2,
        event_title='Tech Conference 2026',
        event_type='Conference',
        event_date=(datetime.now() + timedelta(days=30)).date(),
        guest_count=200,
        total_price=Decimal('120000.00'),
        status='PENDING'
    )

    Booking.objects.create(
        customer=c1,
        vendor=v3,
        event_title='Company End of Year Party',
        event_type='Corporate',
        event_date=(datetime.now() + timedelta(days=45)).date(),
        guest_count=150,
        total_price=Decimal('45000.00'),
        status='APPROVED'
    )

    print("Created bookings.")
    print("Database seeding completed successfully!")

if __name__ == '__main__':
    seed()
