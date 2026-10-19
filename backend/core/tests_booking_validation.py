from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from core.models import Venue, VenueOwnerProfile, VendorProfile, Booking, ProviderAvailabilitySetting

User = get_user_model()

class BookingCapacityValidationTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create customer
        self.customer = User.objects.create_user(
            username='customer_user',
            email='customer@example.com',
            password='Password123!',
            role='CUSTOMER'
        )

        # Create provider
        self.provider_user = User.objects.create_user(
            username='provider_user',
            email='provider@example.com',
            password='Password123!',
            role='VENUE_OWNER'
        )

        self.owner_profile = VenueOwnerProfile.objects.create(
            user=self.provider_user,
            business_name='Sunset Venues Ltd',
            is_verified=True,
            verification_status='APPROVED'
        )

        # Create venue with capacity of 100
        self.venue = Venue.objects.create(
            owner=self.owner_profile,
            title='Sunset Garden Hall',
            category='WEDDING',
            location='Nairobi',
            capacity=100,
            price_per_day=50000,
            is_verified=True,
            approval_status='APPROVED',
            is_available=True
        )

        # Provider availability settings
        self.avail_setting = ProviderAvailabilitySetting.objects.create(
            user=self.provider_user,
            max_guests=100,
            working_hours_start='08:00',
            working_hours_end='18:00',
            buffer_time_minutes=30,
            unavailable_dates=['2026-12-25'],
            day_statuses={'2026-12-31': 'UNAVAILABLE'}
        )

        self.client.force_authenticate(user=self.customer)

    def test_rejection_when_guest_count_exceeds_max_capacity(self):
        """1. Guest count exceeding venue capacity should be rejected."""
        payload = {
            'customer': self.customer.id,
            'venue': self.venue.id,
            'event_title': 'Massive Gala',
            'event_type': 'Wedding Reception',
            'event_date': '2026-11-15',
            'guest_count': 150,
            'total_price': 50000
        }
        res = self.client.post('/api/bookings/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        error_msg = str(res.data)
        self.assertTrue('maximum capacity of 100 guests' in error_msg)

    def test_rejection_when_date_is_marked_unavailable(self):
        """2. Booking on provider unavailable dates should be rejected."""
        payload = {
            'customer': self.customer.id,
            'venue': self.venue.id,
            'event_title': 'Christmas Party',
            'event_type': 'Party',
            'event_date': '2026-12-25',
            'guest_count': 40,
            'total_price': 50000
        }
        res = self.client.post('/api/bookings/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('marked 2026-12-25 as unavailable' in str(res.data))

    def test_rejection_when_confirmed_bookings_exhaust_capacity(self):
        """3. Multiple confirmed bookings on same date aggregate guest count."""
        # Pre-existing confirmed booking with 70 guests
        Booking.objects.create(
            customer=self.customer,
            venue=self.venue,
            event_title='Morning Session',
            event_date='2026-11-20',
            guest_count=70,
            status='APPROVED',
            total_price=35000
        )

        # Booking request with 40 guests (70 + 40 = 110 > 100) -> should fail
        payload = {
            'customer': self.customer.id,
            'venue': self.venue.id,
            'event_title': 'Evening Session',
            'event_type': 'Wedding Reception',
            'event_date': '2026-11-20',
            'guest_count': 40,
            'total_price': 20000
        }
        res = self.client.post('/api/bookings/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('Only 30 capacity remains' in str(res.data))

        # Booking request with 30 guests (70 + 30 = 100 <= 100) -> should succeed
        payload['guest_count'] = 30
        res_ok = self.client.post('/api/bookings/', payload, format='json')
        self.assertEqual(res_ok.status_code, status.HTTP_201_CREATED)

    def test_provider_approval_revalidation_with_concurrent_capacity(self):
        """4. When provider accepts a pending booking, revalidate capacity under lock."""
        # Customer makes two pending requests for 60 guests each on the same day
        booking_a = Booking.objects.create(
            customer=self.customer,
            venue=self.venue,
            event_title='Request A',
            event_date='2026-11-22',
            guest_count=60,
            status='PENDING',
            total_price=30000
        )
        booking_b = Booking.objects.create(
            customer=self.customer,
            venue=self.venue,
            event_title='Request B',
            event_date='2026-11-22',
            guest_count=60,
            status='PENDING',
            total_price=30000
        )

        # Provider approves booking A (60 / 100 used, 40 remaining)
        self.client.force_authenticate(user=self.provider_user)
        res_a = self.client.patch(f'/api/bookings/{booking_a.id}/update_status/', {'status': 'APPROVED'}, format='json')
        self.assertEqual(res_a.status_code, status.HTTP_200_OK)
        booking_a.refresh_from_db()
        self.assertEqual(booking_a.status, 'APPROVED')

        # Provider attempts to approve booking B (60 requested + 60 already confirmed = 120 > 100) -> rejected!
        res_b = self.client.patch(f'/api/bookings/{booking_b.id}/update_status/', {'status': 'APPROVED'}, format='json')
        self.assertEqual(res_b.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('Only 40 capacity remains' in str(res_b.data))
        booking_b.refresh_from_db()
        self.assertEqual(booking_b.status, 'PENDING')

    def test_permission_check_on_status_update(self):
        """5. Unrelated users cannot update booking status."""
        other_user = User.objects.create_user(
            username='stranger_user',
            email='stranger@example.com',
            password='Password123!',
            role='CUSTOMER'
        )
        booking = Booking.objects.create(
            customer=self.customer,
            venue=self.venue,
            event_title='Private Event',
            event_date='2026-11-25',
            guest_count=20,
            status='PENDING',
            total_price=10000
        )

        self.client.force_authenticate(user=other_user)
        res = self.client.patch(f'/api/bookings/{booking.id}/update_status/', {'status': 'APPROVED'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
