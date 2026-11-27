from django.test import TestCase
from rest_framework.test import APIClient

from core.models import User


class LoginTokenTests(TestCase):
    def test_successful_login_returns_authentication_token(self):
        user = User.objects.create_user(
            username='login_test',
            email='login-test@example.com',
            password='TestPassword123!',
        )

        response = APIClient().post(
            '/api/auth/login/',
            {'email': user.email, 'password': 'TestPassword123!'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['token'])

        authenticated_response = APIClient().post(
            '/api/auth/request-role/',
            {'user_id': user.id, 'role': 'CUSTOMER'},
            format='json',
            HTTP_AUTHORIZATION=f"Token {response.data['token']}",
        )

        self.assertEqual(authenticated_response.status_code, 200)
