from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from core.models import User, Venue, VendorProfile, VenueOwnerProfile, Booking, UserInteraction


class InteractionTrackingAndAnalyticsTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin_tester',
            email='admin@locyfy.com',
            password='Password123!',
            role='ADMIN',
            is_staff=True
        )
        self.customer = User.objects.create_user(
            username='customer_jane',
            email='jane@example.com',
            password='Password123!',
            role='CUSTOMER',
            is_customer=True
        )
        self.vendor_user = User.objects.create_user(
            username='vendor_bob',
            email='bob@example.com',
            password='Password123!',
            role='VENDOR',
            is_vendor=True
        )
        self.vendor_profile = VendorProfile.objects.create(
            user=self.vendor_user,
            business_name='Bob Photography',
            vendor_type='Photography',
            description='Elite wedding photography',
            location='Nairobi'
        )
        self.owner_user = User.objects.create_user(
            username='owner_alice',
            email='alice@example.com',
            password='Password123!',
            role='VENUE_OWNER',
            is_venue_owner=True
        )
        self.owner_profile = VenueOwnerProfile.objects.create(
            user=self.owner_user,
            business_name='Alice Gardens',
            location='Nairobi'
        )
        self.venue = Venue.objects.create(
            owner=self.owner_profile,
            title='Alice Grand Hall',
            category='WEDDING',
            location='Nairobi',
            capacity=300,
            price_per_day=50000,
            approval_status='APPROVED',
            is_verified=True
        )

    def test_record_search_interaction(self):
        url = '/api/analytics/track/'
        payload = {
            'event_type': 'SEARCH',
            'search_query': 'Nairobi Garden Weddings',
            'category': 'WEDDING',
            'location_filter': 'Nairobi',
            'session_id': 'anon-sess-12345'
        }
        res = self.client.post(url, payload, content_type='application/json')
        self.assertEqual(res.status_code, 201)
        self.assertTrue(UserInteraction.objects.filter(event_type='SEARCH', search_query='Nairobi Garden Weddings').exists())

    def test_record_listing_view_and_deduplication(self):
        url = '/api/analytics/track/'
        payload = {
            'event_type': 'LISTING_VIEW',
            'venue': self.venue.id,
            'session_id': 'session-xyz-987'
        }
        res1 = self.client.post(url, payload, content_type='application/json')
        self.assertEqual(res1.status_code, 201)

        # Immediate repeated call should be deduplicated within 10s window
        res2 = self.client.post(url, payload, content_type='application/json')
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.json().get('status'), 'deduplicated')
        self.assertEqual(UserInteraction.objects.filter(venue=self.venue, event_type='LISTING_VIEW').count(), 1)

    def test_invalid_event_type_rejected(self):
        url = '/api/analytics/track/'
        payload = {'event_type': 'INVENTED_EVENT'}
        res = self.client.post(url, payload, content_type='application/json')
        self.assertEqual(res.status_code, 400)

    def test_invalid_venue_reference_rejected(self):
        url = '/api/analytics/track/'
        payload = {'event_type': 'LISTING_VIEW', 'venue': 999999}
        res = self.client.post(url, payload, content_type='application/json')
        self.assertEqual(res.status_code, 400)

    def test_admin_analytics_authorization(self):
        # Customer should be forbidden
        res_denied = self.client.get('/api/analytics/admin/', HTTP_X_USER_ID=str(self.customer.id))
        self.assertEqual(res_denied.status_code, 403)

        # Admin should succeed
        res_admin = self.client.get('/api/analytics/admin/', HTTP_X_USER_ID=str(self.admin.id))
        self.assertEqual(res_admin.status_code, 200)
        data = res_admin.json()
        self.assertIn('summary', data)
        self.assertIn('funnel', data)
        self.assertIn('trends', data)

    def test_vendor_analytics_isolation(self):
        # Alice should NOT be allowed to view Bob's vendor analytics
        res_forbidden = self.client.get(f'/api/analytics/vendor/{self.vendor_profile.id}/', HTTP_X_USER_ID=str(self.owner_user.id))
        self.assertEqual(res_forbidden.status_code, 403)

        # Bob can view his own analytics
        res_allowed = self.client.get(f'/api/analytics/vendor/{self.vendor_profile.id}/', HTTP_X_USER_ID=str(self.vendor_user.id))
        self.assertEqual(res_allowed.status_code, 200)
        self.assertEqual(res_allowed.json().get('vendor_id'), self.vendor_profile.id)

    def test_venue_owner_analytics_isolation(self):
        # Bob cannot view Alice's venue owner analytics
        res_forbidden = self.client.get(f'/api/analytics/venue-owner/{self.owner_profile.id}/', HTTP_X_USER_ID=str(self.vendor_user.id))
        self.assertEqual(res_forbidden.status_code, 403)

        # Alice can view her own analytics
        res_allowed = self.client.get(f'/api/analytics/venue-owner/{self.owner_profile.id}/', HTTP_X_USER_ID=str(self.owner_user.id))
        self.assertEqual(res_allowed.status_code, 200)
        self.assertEqual(res_allowed.json().get('owner_id'), self.owner_profile.id)

    def test_csv_exports(self):
        res_admin_csv = self.client.get('/api/analytics/admin/export-csv/', HTTP_X_USER_ID=str(self.admin.id))
        self.assertEqual(res_admin_csv.status_code, 200)
        self.assertEqual(res_admin_csv['Content-Type'], 'text/csv')

        res_vendor_csv = self.client.get(f'/api/analytics/vendor/{self.vendor_profile.id}/export-csv/', HTTP_X_USER_ID=str(self.vendor_user.id))
        self.assertEqual(res_vendor_csv.status_code, 200)
        self.assertEqual(res_vendor_csv['Content-Type'], 'text/csv')

        res_owner_csv = self.client.get(f'/api/analytics/venue-owner/{self.owner_profile.id}/export-csv/', HTTP_X_USER_ID=str(self.owner_user.id))
        self.assertEqual(res_owner_csv.status_code, 200)
        self.assertEqual(res_owner_csv['Content-Type'], 'text/csv')
