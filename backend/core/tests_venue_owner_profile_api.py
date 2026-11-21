from django.test import TestCase
from rest_framework.test import APIClient

from core.models import User, VenueOwnerProfile


class VenueOwnerProfileWriteAuthorizationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner_user = User.objects.create_user(
            username='profile_owner',
            email='owner@example.com',
            password='Password123!',
            role='VENUE_OWNER',
            is_venue_owner=True,
        )
        self.other_user = User.objects.create_user(
            username='other_owner',
            email='other@example.com',
            password='Password123!',
            role='VENUE_OWNER',
            is_venue_owner=True,
        )
        self.admin = User.objects.create_user(
            username='profile_admin',
            email='admin@example.com',
            password='Password123!',
            role='ADMIN',
            is_staff=True,
        )
        self.profile = VenueOwnerProfile.objects.create(
            user=self.owner_user,
            business_name='Original Venue',
        )
        self.profile_url = f'/api/venue-owners/{self.profile.pk}/'

    def test_anonymous_profile_writes_are_denied(self):
        create_response = self.client.post(
            '/api/venue-owners/',
            {'business_name': 'Anonymous Venue'},
            format='json',
        )
        update_response = self.client.patch(
            self.profile_url,
            {'business_name': 'Anonymous Change'},
            format='json',
        )
        delete_response = self.client.delete(self.profile_url)

        self.assertEqual(create_response.status_code, 401)
        self.assertEqual(update_response.status_code, 401)
        self.assertEqual(delete_response.status_code, 401)
        self.assertTrue(VenueOwnerProfile.objects.filter(pk=self.profile.pk).exists())
        self.assertEqual(VenueOwnerProfile.objects.count(), 1)

    def test_unrelated_user_cannot_update_or_reassign_profile(self):
        self.client.force_authenticate(user=self.other_user)

        response = self.client.patch(
            self.profile_url,
            {
                'business_name': 'Unauthorized Change',
                'user': self.other_user.pk,
            },
            format='json',
        )
        delete_response = self.client.delete(self.profile_url)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(delete_response.status_code, 403)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.business_name, 'Original Venue')
        self.assertEqual(self.profile.user_id, self.owner_user.pk)

    def test_owner_can_update_profile_without_reassigning_user(self):
        self.client.force_authenticate(user=self.owner_user)

        response = self.client.patch(
            self.profile_url,
            {
                'business_name': 'Updated Venue',
                'user': self.other_user.pk,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.business_name, 'Updated Venue')
        self.assertEqual(self.profile.user_id, self.owner_user.pk)

    def test_authenticated_profile_creation_assigns_request_user(self):
        self.client.force_authenticate(user=self.other_user)

        response = self.client.post(
            '/api/venue-owners/',
            {
                'business_name': 'New Venue',
                'user': self.owner_user.pk,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        profile = VenueOwnerProfile.objects.get(pk=response.data['id'])
        self.assertEqual(profile.user_id, self.other_user.pk)

    def test_admin_can_update_and_delete_profile(self):
        self.client.force_authenticate(user=self.admin)

        update_response = self.client.patch(
            self.profile_url,
            {'business_name': 'Admin Updated Venue'},
            format='json',
        )

        self.assertEqual(update_response.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.business_name, 'Admin Updated Venue')

        delete_response = self.client.delete(self.profile_url)

        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(VenueOwnerProfile.objects.filter(pk=self.profile.pk).exists())
