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

    def test_authenticated_customer_cannot_change_to_provider_role(self):
        self.client.force_authenticate(user=self.customer)

        response = self.client.post(
            self.url,
            {
                'user_id': self.customer.id,
                'role': 'PROVIDER',
            },
            format='json'
        )

        self.assertEqual(response.status_code, 403)

        self.customer.refresh_from_db()
        self.assertEqual(self.customer.role, 'CUSTOMER')
        self.assertTrue(self.customer.is_customer)
        self.assertFalse(self.customer.is_vendor)
        self.assertFalse(self.customer.is_venue_owner)
        self.assertFalse(VendorProfile.objects.filter(user=self.customer).exists())
        self.assertFalse(VenueOwnerProfile.objects.filter(user=self.customer).exists())

    def test_authenticated_customer_can_repeat_customer_role_request(self):
        self.client.force_authenticate(user=self.customer)

        response = self.client.post(
            self.url,
            {
                'user_id': self.customer.id,
                'role': 'CUSTOMER',
            },
            format='json'
        )

        self.assertEqual(response.status_code, 200)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.role, 'CUSTOMER')

    def test_customer_role_remains_authoritative_for_existing_dual_flags(self):
        self.customer.is_vendor = True
        self.customer.is_venue_owner = True
        self.customer.save(update_fields=['is_vendor', 'is_venue_owner'])
        self.client.force_authenticate(user=self.customer)

        response = self.client.post(
            self.url,
            {'user_id': self.customer.id, 'role': 'CUSTOMER'},
            format='json'
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(response.data['roles']['is_provider'])
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.role, 'CUSTOMER')

    def test_provider_cannot_change_to_customer_role(self):
        provider = User.objects.create_user(
            username='role_provider',
            email='provider@example.com',
            password='TestPassword123!',
            role='PROVIDER',
            is_customer=False,
            is_vendor=True,
            is_venue_owner=True,
        )
        self.client.force_authenticate(user=provider)

        response = self.client.post(
            self.url,
            {'user_id': provider.id, 'role': 'CUSTOMER'},
            format='json'
        )

        self.assertEqual(response.status_code, 403)
        provider.refresh_from_db()
        self.assertEqual(provider.role, 'PROVIDER')

    def test_provider_can_repeat_provider_role_request(self):
        provider = User.objects.create_user(
            username='role_provider',
            email='provider@example.com',
            password='TestPassword123!',
            role='PROVIDER',
            is_customer=False,
            is_vendor=True,
            is_venue_owner=True,
        )
        self.client.force_authenticate(user=provider)

        response = self.client.post(
            self.url,
            {'user_id': provider.id, 'role': 'PROVIDER'},
            format='json'
        )

        self.assertEqual(response.status_code, 200, response.data)
        provider.refresh_from_db()
        self.assertEqual(provider.role, 'PROVIDER')
        self.assertTrue(VendorProfile.objects.filter(user=provider).exists())
        self.assertTrue(VenueOwnerProfile.objects.filter(user=provider).exists())