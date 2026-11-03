import datetime
from unittest.mock import patch
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

    def test_authoritative_backend_pricing_overrides_client_submitted_price(self):
        """6. Verify backend overrides manipulated client prices with authoritative listing rates."""
        # Venue price_per_day is 50,000. Customer submits manipulated total_price: 1.00
        venue_payload = {
            'customer': self.customer.id,
            'venue': self.venue.id,
            'event_title': 'Manipulated Venue Price Booking',
            'event_type': 'Wedding Reception',
            'event_date': '2026-11-28',
            'guest_count': 50,
            'total_price': 1.00
        }
        res_venue = self.client.post('/api/bookings/', venue_payload, format='json')
        self.assertEqual(res_venue.status_code, status.HTTP_201_CREATED)
        # Assert authoritative price 50000.00 is saved, NOT 1.00
        saved_venue_b = Booking.objects.get(id=res_venue.data['id'])
        self.assertEqual(float(saved_venue_b.total_price), 50000.0)

        # Create a vendor with starting_price of 75,000
        vendor_user = User.objects.create_user(
            username='vendor_pricing_user',
            email='vendor_p@example.com',
            password='Password123!',
            role='VENDOR'
        )
        vendor_profile = VendorProfile.objects.create(
            user=vendor_user,
            business_name='Top Tier Decorators',
            vendor_type='Decor',
            starting_price=75000,
            is_verified=True,
            verification_status='APPROVED'
        )
        # Client submits manipulated total_price of 9.99 for vendor
        vendor_payload = {
            'customer': self.customer.id,
            'vendor': vendor_profile.id,
            'event_title': 'Manipulated Vendor Price Booking',
            'event_type': 'Corporate Gala',
            'event_date': '2026-11-29',
            'guest_count': 30,
            'total_price': 9.99
        }
        res_vendor = self.client.post('/api/bookings/', vendor_payload, format='json')
        self.assertEqual(res_vendor.status_code, status.HTTP_201_CREATED)
        saved_vendor_b = Booking.objects.get(id=res_vendor.data['id'])
        self.assertEqual(float(saved_vendor_b.total_price), 75000.0)

    def test_rejection_of_unavailable_and_unapproved_listings(self):
        """7. Reject bookings for unavailable or unapproved venues and vendors."""
        # Unapproved venue
        unapproved_venue = Venue.objects.create(
            owner=self.owner_profile,
            title='Pending Approval Hall',
            category='WEDDING',
            location='Nairobi',
            capacity=100,
            price_per_day=40000,
            is_verified=False,
            approval_status='PENDING',
            is_available=True
        )
        res = self.client.post('/api/bookings/', {
            'customer': self.customer.id,
            'venue': unapproved_venue.id,
            'event_type': 'Wedding Reception',
            'event_date': '2026-11-28',
            'guest_count': 50
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('pending administrator verification' in str(res.data))

        # Unavailable venue
        unavailable_venue = Venue.objects.create(
            owner=self.owner_profile,
            title='Closed Hall',
            category='WEDDING',
            location='Nairobi',
            capacity=100,
            price_per_day=40000,
            is_verified=True,
            approval_status='APPROVED',
            is_available=False
        )
        res_unavail = self.client.post('/api/bookings/', {
            'customer': self.customer.id,
            'venue': unavailable_venue.id,
            'event_type': 'Wedding Reception',
            'event_date': '2026-11-28',
            'guest_count': 50
        }, format='json')
        self.assertEqual(res_unavail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('unavailable or inactive' in str(res_unavail.data))

    def test_rejection_of_invalid_and_zero_listing_prices(self):
        """8. Reject bookings when listing price is zero, negative, or invalid."""
        # A. Venue with zero price
        zero_venue = Venue.objects.create(
            owner=self.owner_profile,
            title='Free/Zero Price Hall',
            category='WEDDING',
            location='Nairobi',
            capacity=100,
            price_per_day=0,
            is_verified=True,
            approval_status='APPROVED',
            is_available=True
        )
        res_zero = self.client.post('/api/bookings/', {
            'customer': self.customer.id,
            'venue': zero_venue.id,
            'event_type': 'Wedding Reception',
            'event_date': '2026-11-28',
            'guest_count': 50
        }, format='json')
        self.assertEqual(res_zero.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('invalid or non-positive rental price' in str(res_zero.data))

        # B. Venue with negative price
        neg_venue = Venue.objects.create(
            owner=self.owner_profile,
            title='Negative Price Hall',
            category='WEDDING',
            location='Nairobi',
            capacity=100,
            price_per_day=-1000,
            is_verified=True,
            approval_status='APPROVED',
            is_available=True
        )
        res_neg = self.client.post('/api/bookings/', {
            'customer': self.customer.id,
            'venue': neg_venue.id,
            'event_type': 'Wedding Reception',
            'event_date': '2026-11-28',
            'guest_count': 50
        }, format='json')
        self.assertEqual(res_neg.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('invalid or non-positive rental price' in str(res_neg.data))

        # C. Vendor with zero starting price
        vnd_user_z = User.objects.create_user(username='zero_vnd_user', email='zv@test.com', password='Password123!', role='VENDOR')
        zero_vendor = VendorProfile.objects.create(
            user=vnd_user_z,
            business_name='Zero Fee Vendor',
            vendor_type='Catering',
            starting_price=0,
            is_verified=True,
            verification_status='APPROVED'
        )
        res_vnd_zero = self.client.post('/api/bookings/', {
            'customer': self.customer.id,
            'vendor': zero_vendor.id,
            'event_type': 'Wedding Reception',
            'event_date': '2026-11-28',
            'guest_count': 50
        }, format='json')
        self.assertEqual(res_vnd_zero.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('invalid or non-positive starting price' in str(res_vnd_zero.data))

        # D. Vendor with negative starting price
        vnd_user_n = User.objects.create_user(username='neg_vnd_user', email='nv@test.com', password='Password123!', role='VENDOR')
        neg_vendor = VendorProfile.objects.create(
            user=vnd_user_n,
            business_name='Negative Fee Vendor',
            vendor_type='Catering',
            starting_price=-500,
            is_verified=True,
            verification_status='APPROVED'
        )
        res_vnd_neg = self.client.post('/api/bookings/', {
            'customer': self.customer.id,
            'vendor': neg_vendor.id,
            'event_type': 'Wedding Reception',
            'event_date': '2026-11-28',
            'guest_count': 50
        }, format='json')
        self.assertEqual(res_vnd_neg.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('invalid or non-positive starting price' in str(res_vnd_neg.data))

    def test_venue_vendor_exclusivity_on_post_put_and_partial_patch(self):
        """9. Test venue/vendor exclusivity on POST, PUT, and partial PATCH requests."""
        # A. POST with neither venue nor vendor
        res_neither = self.client.post('/api/bookings/', {
            'customer': self.customer.id,
            'event_title': 'Targetless Booking',
            'event_type': 'Wedding Reception',
            'event_date': '2026-11-28',
            'guest_count': 50
        }, format='json')
        self.assertEqual(res_neither.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('must specify either a venue or a service provider' in str(res_neither.data))

        # Create valid vendor for test
        vnd_user = User.objects.create_user(username='excl_user', email='excl@test.com', password='Password123!', role='VENDOR')
        vnd_profile = VendorProfile.objects.create(user=vnd_user, business_name='Excl Vendor', vendor_type='Catering', starting_price=10000, is_verified=True, verification_status='APPROVED')

        # B. POST with both venue and vendor
        res_both = self.client.post('/api/bookings/', {
            'customer': self.customer.id,
            'venue': self.venue.id,
            'vendor': vnd_profile.id,
            'event_title': 'Dual Booking',
            'event_type': 'Wedding Reception',
            'event_date': '2026-11-28',
            'guest_count': 50
        }, format='json')
        self.assertEqual(res_both.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('cannot specify both a venue and a service provider' in str(res_both.data))

        # Create initial valid venue booking
        booking = Booking.objects.create(
            customer=self.customer,
            venue=self.venue,
            event_title='Initial Venue Booking',
            event_type='Wedding Reception',
            event_date='2026-11-28',
            guest_count=50,
            total_price=50000
        )

        # C. PATCH trying to add vendor to an existing venue booking (making both present)
        res_patch_both = self.client.patch(f'/api/bookings/{booking.id}/', {'vendor': vnd_profile.id}, format='json')
        self.assertEqual(res_patch_both.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('cannot specify both a venue and a service provider' in str(res_patch_both.data))

        # D. PATCH explicitly passing venue=None to a venue booking (leaving neither target)
        res_patch_neither = self.client.patch(f'/api/bookings/{booking.id}/', {'venue': None}, format='json')
        self.assertEqual(res_patch_neither.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('must specify either a venue or a service provider' in str(res_patch_neither.data))

        # E. PUT trying to supply both targets or neither target
        res_put_neither = self.client.put(f'/api/bookings/{booking.id}/', {
            'customer': self.customer.id,
            'event_title': 'Targetless PUT',
            'event_type': 'Wedding Reception',
            'event_date': '2026-11-28',
            'guest_count': 50
        }, format='json')
        self.assertEqual(res_put_neither.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('must specify either a venue or a service provider' in str(res_put_neither.data))

        res_put_both = self.client.put(f'/api/bookings/{booking.id}/', {
            'customer': self.customer.id,
            'venue': self.venue.id,
            'vendor': vnd_profile.id,
            'event_title': 'Dual Target PUT',
            'event_type': 'Wedding Reception',
            'event_date': '2026-11-28',
            'guest_count': 50
        }, format='json')
        self.assertEqual(res_put_both.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('cannot specify both a venue and a service provider' in str(res_put_both.data))

    def test_listing_eligibility_enforced_on_partial_patch(self):
        """10. Listing eligibility and positive pricing cannot be bypassed on partial PATCH."""
        booking = Booking.objects.create(
            customer=self.customer,
            venue=self.venue,
            event_title='Legit Booking',
            event_type='Wedding Reception',
            event_date='2026-11-28',
            guest_count=50,
            total_price=50000
        )
        # Create unapproved venue
        unapproved_v = Venue.objects.create(
            owner=self.owner_profile,
            title='Unapproved Venue',
            category='WEDDING',
            location='Nairobi',
            capacity=100,
            price_per_day=45000,
            is_verified=False,
            approval_status='PENDING',
            is_available=True
        )
        # Attempt to patch booking to point to unapproved venue
        res_patch_unapproved = self.client.patch(f'/api/bookings/{booking.id}/', {'venue': unapproved_v.id}, format='json')
        self.assertEqual(res_patch_unapproved.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('pending administrator verification' in str(res_patch_unapproved.data))

        # Create unavailable venue
        unavailable_v = Venue.objects.create(
            owner=self.owner_profile,
            title='Unavailable Venue',
            category='WEDDING',
            location='Nairobi',
            capacity=100,
            price_per_day=45000,
            is_verified=True,
            approval_status='APPROVED',
            is_available=False
        )
        # Attempt to patch booking to point to unavailable venue
        res_patch_unavail = self.client.patch(f'/api/bookings/{booking.id}/', {'venue': unavailable_v.id}, format='json')
        self.assertEqual(res_patch_unavail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('currently marked as unavailable or inactive' in str(res_patch_unavail.data))

    def test_unverified_vendor_and_venue_owner(self):
        """11. Reject bookings for unverified vendor or unverified venue owner."""
        # A. Unverified Vendor
        vnd_user_unv = User.objects.create_user(username='unv_vendor_user', email='unv@test.com', password='Password123!', role='VENDOR')
        unv_vendor = VendorProfile.objects.create(
            user=vnd_user_unv,
            business_name='Unverified Vendor',
            vendor_type='Catering',
            starting_price=15000,
            is_verified=False,
            verification_status='PENDING'
        )
        res_unv = self.client.post('/api/bookings/', {
            'customer': self.customer.id,
            'vendor': unv_vendor.id,
            'event_type': 'Wedding Reception',
            'event_date': '2026-11-28',
            'guest_count': 50
        }, format='json')
        self.assertEqual(res_unv.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('pending administrator verification' in str(res_unv.data))

        # B. Venue with unverified owner
        unv_owner_user = User.objects.create_user(username='unv_owner_u', email='unvo@test.com', password='Password123!', role='VENUE_OWNER')
        unv_owner = VenueOwnerProfile.objects.create(
            user=unv_owner_user,
            business_name='Unverified Owner Biz',
            is_verified=False,
            verification_status='PENDING'
        )
        venue_unv_owner = Venue.objects.create(
            owner=unv_owner,
            title='Venue With Unverified Owner',
            category='WEDDING',
            location='Nairobi',
            capacity=100,
            price_per_day=50000,
            is_verified=True,
            approval_status='APPROVED',
            is_available=True
        )
        res_unv_owner = self.client.post('/api/bookings/', {
            'customer': self.customer.id,
            'venue': venue_unv_owner.id,
            'event_type': 'Wedding Reception',
            'event_date': '2026-11-28',
            'guest_count': 50
        }, format='json')
        self.assertEqual(res_unv_owner.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('owner account is not verified' in str(res_unv_owner.data))

    def test_missing_invalid_negative_prices_for_venue_and_vendor(self):
        """12. Individual tests for missing, invalid, zero, and negative prices."""
        from core.services.booking_validator import BookingCapacityValidator
        from rest_framework.exceptions import ValidationError

        # A. Missing venue price (simulating null/missing attribute on runtime model or memory)
        with patch.object(self.venue, 'price_per_day', None):
            with self.assertRaises(ValidationError) as ctx:
                BookingCapacityValidator.validate_listing_eligibility(venue=self.venue)
            self.assertTrue('no rental price defined' in str(ctx.exception))

        # B. Invalid non-numeric venue price (e.g. non-numeric string or NaN)
        with patch.object(self.venue, 'price_per_day', 'NaN'):
            with self.assertRaises(ValidationError) as ctx:
                BookingCapacityValidator.validate_listing_eligibility(venue=self.venue)
            self.assertTrue('invalid' in str(ctx.exception).lower())

        # C. Missing vendor starting price
        vnd_user_m = User.objects.create_user(username='vnd_m_u', email='vm@test.com', password='Password123!', role='VENDOR')
        vnd_prof_m = VendorProfile.objects.create(
            user=vnd_user_m,
            business_name='Missing Price Vendor',
            vendor_type='Catering',
            starting_price=1000,
            is_verified=True,
            verification_status='APPROVED'
        )
        with patch.object(vnd_prof_m, 'starting_price', None):
            with self.assertRaises(ValidationError) as ctx:
                BookingCapacityValidator.validate_listing_eligibility(vendor=vnd_prof_m)
            self.assertTrue('no starting price defined' in str(ctx.exception))

        # D. Invalid non-numeric vendor starting price
        with patch.object(vnd_prof_m, 'starting_price', 'invalid_price'):
            with self.assertRaises(ValidationError) as ctx:
                BookingCapacityValidator.validate_listing_eligibility(vendor=vnd_prof_m)
            self.assertTrue('invalid' in str(ctx.exception).lower())

    def test_verification_document_policies_and_expiration(self):
        """13. Verification document policy: missing docs allowed if profile approved, expired/unapproved docs rejected."""
        # A. Venue owner with NO documents uploaded -> allowed because profile is verified & approved
        res_ok_no_docs = self.client.post('/api/bookings/', {
            'customer': self.customer.id,
            'venue': self.venue.id,
            'event_type': 'Wedding Reception',
            'event_date': '2026-11-28',
            'guest_count': 50
        }, format='json')
        self.assertEqual(res_ok_no_docs.status_code, status.HTTP_201_CREATED)

        # B. Venue owner uploaded expired document -> REJECTED
        from core.models import VerificationDocument
        expired_doc = VerificationDocument.objects.create(
            user=self.provider_user,
            venue_owner=self.owner_profile,
            document_type='BUSINESS_PERMIT',
            title='Expired Permit',
            status='APPROVED',
            expiry_date=datetime.date(2020, 1, 1)
        )
        res_expired = self.client.post('/api/bookings/', {
            'customer': self.customer.id,
            'venue': self.venue.id,
            'event_type': 'Wedding Reception',
            'event_date': '2026-11-29',
            'guest_count': 50
        }, format='json')
        self.assertEqual(res_expired.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('expired or unapproved verification documents' in str(res_expired.data))

        # C. Add a valid, unexpired approved document alongside it -> ALLOWED
        VerificationDocument.objects.create(
            user=self.provider_user,
            venue_owner=self.owner_profile,
            document_type='TAX_PIN',
            title='Current Tax Cert',
            status='APPROVED',
            expiry_date=datetime.date(2030, 1, 1)
        )
        res_now_valid = self.client.post('/api/bookings/', {
            'customer': self.customer.id,
            'venue': self.venue.id,
            'event_type': 'Wedding Reception',
            'event_date': '2026-11-30',
            'guest_count': 50
        }, format='json')
        self.assertEqual(res_now_valid.status_code, status.HTTP_201_CREATED)