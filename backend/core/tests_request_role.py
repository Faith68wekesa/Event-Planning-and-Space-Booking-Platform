from django.test import TestCase
from rest_framework.test import APIClient

from core.models import User, VendorProfile, VenueOwnerProfile


class RequestRoleSecurityTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.customer = User.objects.create_user(
            username='role_customer',
            email='customer@example.com',
            password='TestPassword123!',
            role='CUSTOMER',
            is_customer=True,
            is_vendor=False,
            is_venue_owner=False,
            is_staff=False,
            is_superuser=False,
        )

        self.other_user = User.objects.create_user(
            username='other_customer',
            email='other@example.com',
            password='TestPassword123!',
            role='CUSTOMER',
            is_customer=True,
            is_vendor=False,
            is_venue_owner=False,
            is_staff=False,
            is_superuser=False,
        )

        self.url = '/api/auth/request-role/'

    def test_unauthenticated_user_cannot_request_admin_role(self):
        response = self.client.post(
            self.url,
            {
                'user_id': self.customer.id,
                'role': 'ADMIN',
            },
            format='json'
        )

        self.assertIn(response.status_code, [401, 403])

        self.customer.refresh_from_db()
        self.assertEqual(self.customer.role, 'CUSTOMER')
        self.assertFalse(self.customer.is_staff)
        self.assertFalse(self.customer.is_superuser)

    def test_user_cannot_change_another_users_role(self):
        self.client.force_authenticate(user=self.customer)

        response = self.client.post(
            self.url,
            {
                'user_id': self.other_user.id,
                'role': 'PROVIDER',
            },
            format='json'
        )

        self.assertEqual(response.status_code, 403)

        self.other_user.refresh_from_db()
        self.assertEqual(self.other_user.role, 'CUSTOMER')
        self.assertFalse(self.other_user.is_vendor)
        self.assertFalse(self.other_user.is_venue_owner)

    def test_authenticated_user_cannot_request_admin_role(self):
        self.client.force_authenticate(user=self.customer)

        response = self.client.post(
            self.url,
            {
                'user_id': self.customer.id,
                'role': 'ADMIN',
            },
            format='json'
        )

        self.assertEqual(response.status_code, 403)

        self.customer.refresh_from_db()
        self.assertEqual(self.customer.role, 'CUSTOMER')
        self.assertFalse(self.customer.is_staff)
        self.assertFalse(self.customer.is_superuser)

    def test_authenticated_user_can_request_provider_role(self):
        self.client.force_authenticate(user=self.customer)

        response = self.client.post(
            self.url,
            {
                'user_id': self.customer.id,
                'role': 'PROVIDER',
            },
            format='json'
        )

        self.assertEqual(response.status_code, 200)

        self.customer.refresh_from_db()
        self.assertEqual(self.customer.role, 'PROVIDER')
        self.assertTrue(self.customer.is_customer)
        self.assertTrue(self.customer.is_vendor)
        self.assertTrue(self.customer.is_venue_owner)

        self.assertTrue(
            VendorProfile.objects.filter(user=self.customer).exists()
        )
        self.assertTrue(
            VenueOwnerProfile.objects.filter(user=self.customer).exists()
        )