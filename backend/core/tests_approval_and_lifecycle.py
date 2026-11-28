from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta, date
from core.models import Venue, VenueOwnerProfile, VendorProfile, Booking, VerificationDocument

User = get_user_model()

class AdminApprovalAndLifecycleTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Admin user
        self.admin_user = User.objects.create_user(
            username='admin_boss',
            email='admin@locyfy.com',
            password='AdminPassword123!',
            role='ADMIN',
            is_staff=True
        )

        # Venue owner provider
        self.venue_owner_user = User.objects.create_user(
            username='owner_mike',
            email='mike@venues.com',
            password='Password123!',
            role='VENUE_OWNER'
        )
        self.owner_profile = VenueOwnerProfile.objects.create(
            user=self.venue_owner_user,
            business_name='Mike Luxury Halls',
            is_verified=True,
            verification_status='APPROVED'
        )
        VerificationDocument.objects.create(
            user=self.venue_owner_user,
            venue_owner=self.owner_profile,
            document_type='BUSINESS_REGISTRATION',
            status='APPROVED',
            file='test.pdf'
        )

        # Vendor provider
        self.vendor_user = User.objects.create_user(
            username='vendor_cater',
            email='cater@food.com',
            password='Password123!',
            role='VENDOR'
        )
        self.vendor_profile = VendorProfile.objects.create(
            user=self.vendor_user,
            business_name='Top Notch Catering',
            is_verified=True,
            verification_status='APPROVED'
        )

        # Customer user
        self.customer = User.objects.create_user(
            username='jane_customer',
            email='jane@customer.com',
            password='Password123!',
            role='CUSTOMER'
        )

    def test_new_listing_defaults_to_pending_approval(self):
        """Newly created venue/service listing should default to PENDING approval and not verified."""
        self.client.force_authenticate(user=self.venue_owner_user)
        payload = {
            'owner': self.owner_profile.id,
            'title': 'Grand Ballroom',
            'category': 'WEDDING',
            'location': 'Nyeri County, Kenya',
            'capacity': 500,
            'price_per_day': 100000,
            'cancellation_policy': 'MODERATE',
            'description': 'A beautiful grand ballroom.'
        }
        res = self.client.post('/api/venues/', payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        venue_id = res.data['id']
        venue = Venue.objects.get(id=venue_id)
        self.assertEqual(venue.approval_status, 'PENDING')
        self.assertFalse(venue.is_verified)
        self.assertFalse(venue.is_publicly_visible)

    def test_unapproved_business_account_cannot_create_service_or_venue_listing(self):
        pending_user = User.objects.create_user(
            username='pending_business',
            email='pending-business@example.com',
            password='Password123!',
            role='PROVIDER',
        )
        VendorProfile.objects.create(
            user=pending_user,
            business_name='Pending Services',
            vendor_type='Event Services',
            description='',
            location='Nyeri County, Kenya',
        )
        VenueOwnerProfile.objects.create(
            user=pending_user,
            business_name='Pending Venues',
        )
        self.client.force_authenticate(user=pending_user)

        for listing_type, category in (
            ('SERVICE', 'PHOTOGRAPHY'),
            ('VENUE', 'WEDDING'),
        ):
            response = self.client.post('/api/venues/', {
                'listing_type': listing_type,
                'title': f'Pending {listing_type}',
                'category': category,
                'location': 'Nyeri County, Kenya',
                'capacity': 100,
                'price_per_day': 10000,
            }, format='json')
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
            self.assertIn('business account must be approved', str(response.data))

        self.assertFalse(Venue.objects.filter(vendor__user=pending_user).exists())
        self.assertFalse(Venue.objects.filter(owner__user=pending_user).exists())

    def test_public_endpoints_exclude_pending_and_rejected_listings(self):
        """Public listing endpoints must only expose APPROVED and active listings."""
        approved_venue = Venue.objects.create(
            owner=self.owner_profile,
            title='Public Approved Venue',
            category='WEDDING',
            location='Nyeri County, Kenya',
            capacity=200,
            price_per_day=40000,
            approval_status='APPROVED',
            is_verified=True,
            is_available=True
        )
        pending_venue = Venue.objects.create(
            owner=self.owner_profile,
            title='Pending Venue Secret',
            category='WEDDING',
            location='Nyeri County, Kenya',
            capacity=200,
            price_per_day=40000,
            approval_status='PENDING',
            is_verified=False,
            is_available=True
        )
        rejected_venue = Venue.objects.create(
            owner=self.owner_profile,
            title='Rejected Venue',
            category='WEDDING',
            location='Nyeri County, Kenya',
            capacity=200,
            price_per_day=40000,
            approval_status='REJECTED',
            is_verified=False,
            is_available=True
        )
        orphaned_venue = Venue.objects.create(
            title='Orphaned Approved Venue',
            category='WEDDING',
            location='Nyeri County, Kenya',
            capacity=100,
            price_per_day=30000,
            approval_status='APPROVED',
            is_verified=True,
            is_available=True,
        )

        # Unauthenticated public request
        self.client.force_authenticate(user=None)
        res = self.client.get('/api/venues/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        venue_list = res.data.get('results', res.data) if isinstance(res.data, dict) else res.data
        returned_ids = [item['id'] for item in venue_list]
        self.assertIn(approved_venue.id, returned_ids)
        self.assertNotIn(pending_venue.id, returned_ids)
        self.assertNotIn(rejected_venue.id, returned_ids)
        self.assertNotIn(orphaned_venue.id, returned_ids)

        # Detail endpoint public access for pending venue should return 404
        detail_res = self.client.get(f'/api/venues/{pending_venue.id}/')
        self.assertEqual(detail_res.status_code, status.HTTP_404_NOT_FOUND)
        orphan_detail = self.client.get(f'/api/venues/{orphaned_venue.id}/')
        self.assertEqual(orphan_detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_providers_can_view_own_pending_listings(self):
        """Venue owners can view their own listings even if pending."""
        pending_venue = Venue.objects.create(
            owner=self.owner_profile,
            title='My Draft Pending Hall',
            category='CONFERENCE',
            location='Nyeri County, Kenya',
            capacity=100,
            price_per_day=20000,
            approval_status='PENDING',
            is_available=True
        )
        self.client.force_authenticate(user=self.venue_owner_user)
        res = self.client.get(f'/api/venues/?owner={self.owner_profile.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        venue_list = res.data.get('results', res.data) if isinstance(res.data, dict) else res.data
        returned_ids = [item['id'] for item in venue_list]
        self.assertIn(pending_venue.id, returned_ids)

    def test_non_admin_cannot_approve_listing(self):
        """Non-admin user cannot trigger approve or reject actions."""
        pending_venue = Venue.objects.create(
            owner=self.owner_profile,
            title='Pending Venue',
            category='WEDDING',
            location='Nyeri County, Kenya',
            capacity=200,
            price_per_day=40000,
            approval_status='PENDING'
        )
        self.client.force_authenticate(user=self.venue_owner_user)
        res = self.client.post(f'/api/venues/{pending_venue.id}/approve/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        pending_venue.refresh_from_db()
        self.assertEqual(pending_venue.approval_status, 'PENDING')

    def test_admin_can_approve_and_reject_with_reason(self):
        """Admin can approve and reject listings with a feedback reason."""
        pending_venue = Venue.objects.create(
            owner=self.owner_profile,
            title='Pending Venue Under Review',
            category='WEDDING',
            location='Nyeri County, Kenya',
            capacity=200,
            price_per_day=40000,
            approval_status='PENDING'
        )
        self.client.force_authenticate(user=self.admin_user)

        # Admin approves
        res_approve = self.client.post(f'/api/venues/{pending_venue.id}/approve/')
        self.assertEqual(res_approve.status_code, status.HTTP_200_OK)
        pending_venue.refresh_from_db()
        self.assertEqual(pending_venue.approval_status, 'APPROVED')
        self.assertTrue(pending_venue.is_verified)

        # Admin rejects with reason
        res_reject = self.client.post(f'/api/venues/{pending_venue.id}/reject/', {'reason': 'Images are too low resolution.'}, format='json')
        self.assertEqual(res_reject.status_code, status.HTTP_200_OK)
        pending_venue.refresh_from_db()
        self.assertEqual(pending_venue.approval_status, 'REJECTED')
        self.assertFalse(pending_venue.is_verified)
        self.assertEqual(pending_venue.rejection_reason, 'Images are too low resolution.')

    def test_pending_service_is_admin_reviewable_and_public_after_approval(self):
        service = Venue.objects.create(
            owner=self.owner_profile,
            listing_type='SERVICE',
            title='Custom Event Service',
            category='CUSTOM SERVICE',
            location='Nyeri County, Kenya',
            capacity=25,
            price_per_day=15000,
            approval_status='PENDING',
            is_available=True,
        )

        self.client.force_authenticate(user=self.admin_user)
        admin_response = self.client.get('/api/venues/?all_status=true')
        self.assertEqual(admin_response.status_code, status.HTTP_200_OK)
        admin_listings = (
            admin_response.data.get('results', admin_response.data)
            if isinstance(admin_response.data, dict)
            else admin_response.data
        )
        self.assertIn(service.id, [listing['id'] for listing in admin_listings])

        self.client.force_authenticate(user=None)
        public_pending_response = self.client.get('/api/venues/')
        public_pending_listings = (
            public_pending_response.data.get(
                'results',
                public_pending_response.data,
            )
            if isinstance(public_pending_response.data, dict)
            else public_pending_response.data
        )
        self.assertNotIn(service.id, [listing['id'] for listing in public_pending_listings])

        self.client.force_authenticate(user=self.admin_user)
        approve_response = self.client.post(f'/api/venues/{service.id}/approve/')
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=None)
        public_approved_response = self.client.get('/api/venues/')
        public_approved_listings = (
            public_approved_response.data.get(
                'results',
                public_approved_response.data,
            )
            if isinstance(public_approved_response.data, dict)
            else public_approved_response.data
        )
        self.assertIn(service.id, [listing['id'] for listing in public_approved_listings])

    def test_customer_cannot_book_unapproved_or_inactive_listing(self):
        """Booking requests for unapproved or inactive venues must be rejected on the backend."""
        pending_venue = Venue.objects.create(
            owner=self.owner_profile,
            title='Unapproved Space',
            category='WEDDING',
            location='Nyeri County, Kenya',
            capacity=200,
            price_per_day=40000,
            approval_status='PENDING',
            is_available=True
        )
        self.client.force_authenticate(user=self.customer)
        booking_data = {
            'venue': pending_venue.id,
            'customer': self.customer.id,
            'event_title': 'Sarah Wedding',
            'event_type': 'Wedding',
            'event_date': '2026-11-20',
            'guest_count': 50,
            'total_price': 40000
        }
        res = self.client.post('/api/bookings/', booking_data, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        err_str = str(res.data).lower()
        self.assertTrue(
            'pending administrator verification' in err_str or
            'not verified' in err_str or
            'not approved' in err_str or
            'verification' in err_str
        )

    def test_cancellation_policy_rules_enforcement(self):
        """Cancellation deadlines must be validated on backend according to policy."""
        # Create approved venue with Strict policy (7 days notice required)
        strict_venue = Venue.objects.create(
            owner=self.owner_profile,
            title='Strict Venue Palace',
            category='WEDDING',
            location='Nyeri County, Kenya',
            capacity=300,
            price_per_day=80000,
            approval_status='APPROVED',
            is_verified=True,
            is_available=True,
            cancellation_policy='STRICT'
        )

        # Confirmed booking scheduled in 3 days (too late for strict 7 days)
        event_date_soon = (timezone.now() + timedelta(days=3)).date()
        late_booking = Booking.objects.create(
            customer=self.customer,
            venue=strict_venue,
            event_title='Quick Party',
            event_type='Birthday',
            event_date=event_date_soon,
            guest_count=50,
            total_price=80000,
            status='APPROVED'
        )

        self.client.force_authenticate(user=self.customer)
        # Attempt cancellation
        res = self.client.patch(f'/api/bookings/{late_booking.id}/update_status/', {
            'status': 'CANCELLED',
            'reason': 'Change of plans'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cancellation deadline has passed', res.data.get('error', '').lower())

        # Now test booking with ample notice (e.g. 10 days away for strict 7 days)
        event_date_far = (timezone.now() + timedelta(days=10)).date()
        valid_booking = Booking.objects.create(
            customer=self.customer,
            venue=strict_venue,
            event_title='Future Gala',
            event_type='Gala',
            event_date=event_date_far,
            guest_count=50,
            total_price=80000,
            status='APPROVED'
        )
        res_ok = self.client.patch(f'/api/bookings/{valid_booking.id}/update_status/', {
            'status': 'CANCELLED',
            'reason': 'Client rescheduled entire event'
        }, format='json')
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        valid_booking.refresh_from_db()
        self.assertEqual(valid_booking.status, 'CANCELLED')
        self.assertEqual(valid_booking.cancellation_reason, 'Client rescheduled entire event')
        self.assertEqual(valid_booking.cancelled_by, 'CUSTOMER')
        self.assertIsNotNone(valid_booking.cancelled_at)

    def test_illegal_status_transitions_blocked(self):
        """Cancelled or rejected bookings cannot be transitioned to approved or completed."""
        approved_venue = Venue.objects.create(
            owner=self.owner_profile,
            title='Nice Venue',
            category='WEDDING',
            location='Nyeri County, Kenya',
            capacity=100,
            price_per_day=30000,
            approval_status='APPROVED',
            is_verified=True,
            is_available=True
        )
        cancelled_booking = Booking.objects.create(
            customer=self.customer,
            venue=approved_venue,
            event_title='Cancelled One',
            event_type='Party',
            event_date='2026-12-10',
            guest_count=40,
            total_price=30000,
            status='CANCELLED'
        )

        self.client.force_authenticate(user=self.venue_owner_user)
        # Attempt to revive cancelled booking to APPROVED
        res = self.client.patch(f'/api/bookings/{cancelled_booking.id}/update_status/', {
            'status': 'APPROVED'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        err_msg = res.data.get('error', '').lower()
        self.assertTrue('final state' in err_msg or 'cannot transition' in err_msg)
