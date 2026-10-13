import os
import django
from decimal import Decimal
from datetime import datetime, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import User, VendorProfile, VenueOwnerProfile, Venue, Booking

def seed():
    # Clear existing data
    Booking.objects.all().delete()
    Venue.objects.all().delete()
    VendorProfile.objects.all().delete()
    VenueOwnerProfile.objects.all().delete()
    User.objects.all().delete()

    print("Cleared existing data.")

    # Create mock venue owner
    vo_user = User.objects.create_user(
        username='oasis_owner',
        email='owner@karenoasis.co.ke',
        password='password123',
        role='VENUE_OWNER',
        first_name='Karen',
        last_name='Oasis'
    )
    vo1 = VenueOwnerProfile.objects.create(
        user=vo_user,
        business_name='Karen Oasis Spaces Ltd',
        contact_email='bookings@karenoasis.co.ke',
        contact_phone='+254 712 345 678',
        location='Karen, Nairobi',
        is_verified=True
    )
    print("Created venue owner.")

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
        rating=0.0,
        review_count=0
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
        rating=0.0,
        review_count=0
    )

    # Vendor for BrightLens Photography (matching screenshot)
    u_photo = User.objects.create_user(username='brightlens', email='info@brightlens.co.ke', password='password123', role='VENDOR', first_name='BrightLens', last_name='Photography')
    v_photo = VendorProfile.objects.create(
        user=u_photo,
        business_name='BrightLens Photography',
        vendor_type='PHOTOGRAPHY',
        description='Creative and professional event photography, drone videography, and album design.',
        location='Nairobi, Kenya',
        starting_price=Decimal('45000.00'),
        contact_email='info@brightlens.co.ke',
        is_verified=True,
        rating=0.0,
        review_count=0
    )

    # Vendor for Tasty Bites Catering (matching screenshot)
    u_tasty = User.objects.create_user(username='tastybites', email='orders@tastybites.co.ke', password='password123', role='VENDOR', first_name='Tasty', last_name='Bites')
    v_tasty = VendorProfile.objects.create(
        user=u_tasty,
        business_name='Tasty Bites Catering',
        vendor_type='CATERER',
        description='Gourmet African and international buffet catering for weddings, corporate, and private parties.',
        location='Nairobi, Kenya',
        starting_price=Decimal('120000.00'),
        contact_email='orders@tastybites.co.ke',
        is_verified=True,
        rating=0.0,
        review_count=0
    )

    print("Created vendors.")

    # Create mock venues (matching screenshot)
    venue1 = Venue.objects.create(
        owner=vo1,
        vendor=v1,
        title='The Grand Garden',
        description='Iconic landscaped garden venue featuring paved pathways, romantic gazebo, and lush greenery.',
        category='OUTDOOR',
        location='Nairobi, Kenya',
        address='123 Karen Rd, Nairobi',
        capacity=500,
        price_per_day=Decimal('85000.00'),
        amenities=['Parking', 'Security', 'Restrooms', 'Power Backup', 'Gazebo'],
        image_url='https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80',
        is_verified=True,
        is_available=True,
        rating=0.0,
        review_count=0
    )

    venue2 = Venue.objects.create(
        owner=vo1,
        vendor=v1,
        title='Skyline Hotel',
        description='Panoramic rooftop hotel banquet hall with cityscape skyline views, audio equipment, and air conditioning.',
        category='CONFERENCE',
        location='Nairobi, Kenya',
        address='456 Westlands Ave, Nairobi',
        capacity=300,
        price_per_day=Decimal('120000.00'),
        price_per_hour=Decimal('15000.00'),
        amenities=['WiFi', 'Projector', 'Air Conditioning', 'Catering Area', 'Sound System'],
        image_url='https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
        is_verified=True,
        is_available=True,
        rating=0.0,
        review_count=0
    )

    venue3 = Venue.objects.create(
        vendor=v2,
        title='Riverside Gardens',
        description='Serene riverfront event venue shaded by tropical palms with ample manicured lawns.',
        category='OUTDOOR',
        location='Nairobi, Kenya',
        address='789 Riverside Drive, Nairobi',
        capacity=400,
        price_per_day=Decimal('75000.00'),
        amenities=['Parking', 'Security', 'Air Conditioning', 'River View'],
        image_url='https://images.unsplash.com/photo-1545232979-fbf68fe9b1af?auto=format&fit=crop&w=800&q=80',
        is_verified=True,
        is_available=True,
        rating=0.0,
        review_count=0
    )

    print("Created venues.")

    # Create mock customers (Faith Wanjiru matching screenshot)
    faith_user = User.objects.create_user(
        username='faith',
        email='faith@example.com',
        password='password123',
        role='CUSTOMER',
        first_name='Faith',
        last_name='Wanjiru'
    )
    faith_user.avatar_url = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
    faith_user.phone_number = '+254 712 345 678'
    faith_user.save()

    c1 = User.objects.create_user(username='john_doe', email='john@example.com', password='password123', role='CUSTOMER', first_name='John', last_name='Doe')

    # Create mock bookings for Faith Wanjiru (matching screenshot)
    Booking.objects.create(
        customer=faith_user,
        venue=venue1,
        event_title='The Grand Garden (Venue)',
        event_type='Wedding Reception',
        event_date=(datetime.now() + timedelta(days=16)).date(),
        guest_count=200,
        total_price=Decimal('85000.00'),
        status='APPROVED',
        notes='Outdoor wedding garden reception for 200 guests with gazebo setup.'
    )

    Booking.objects.create(
        customer=faith_user,
        vendor=v_photo,
        event_title='BrightLens Photography (Vendor)',
        event_type='Photography & Drone',
        event_date=(datetime.now() + timedelta(days=30)).date(),
        guest_count=200,
        total_price=Decimal('45000.00'),
        status='PENDING',
        notes='Full day event coverage, Drone shots, 2 photographers.'
    )

    Booking.objects.create(
        customer=faith_user,
        vendor=v_tasty,
        event_title='Tasty Bites Catering (Vendor)',
        event_type='Catering Service',
        event_date=(datetime.now() + timedelta(days=44)).date(),
        guest_count=200,
        total_price=Decimal('120000.00'),
        status='APPROVED',
        notes='3-Course African buffet dinner, dessert bar, cutlery & 6 waitstaff.'
    )

    # Create mock bookings for John Doe
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

    print("Created bookings.")
    print("Database seeding completed successfully!")

if __name__ == '__main__':
    seed()
