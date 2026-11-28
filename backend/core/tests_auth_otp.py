from datetime import timedelta
from unittest.mock import patch

from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import EmailOTP, User, VendorProfile, VenueOwnerProfile


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    EMAIL_HOST='smtp.example.test',
    DEFAULT_FROM_EMAIL='noreply@example.test',
)
class EmailOTPRegistrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.email = 'new-customer@example.test'
        self.registration_data = {
            'email': self.email,
            'password': 'StrongPassword123!',
            'full_name': 'New Customer',
            'phone_number': '',
        }

    def test_sending_otp_sends_email_without_returning_code(self):
        response = self.client.post(
            '/api/otp/send/',
            {'email': self.email},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.email])
        otp = EmailOTP.objects.get(email=self.email)
        self.assertIn(otp.otp_code, mail.outbox[0].body)
        self.assertNotIn(otp.otp_code, str(response.data))

    @patch('core.views.random.randint', side_effect=[111111, 222222])
    def test_resending_otp_sends_a_fresh_code_and_restarts_expiry(self, _randint):
        first_response = self.client.post(
            '/api/otp/send/',
            {'email': self.email},
            format='json',
        )
        self.assertEqual(first_response.status_code, 200, first_response.data)

        otp = EmailOTP.objects.get(email=self.email)
        expired_at = timezone.now() - timedelta(minutes=11)
        EmailOTP.objects.filter(pk=otp.pk).update(created_at=expired_at)

        resend_response = self.client.post(
            '/api/otp/send/',
            {'email': self.email},
            format='json',
        )

        self.assertEqual(resend_response.status_code, 200, resend_response.data)
        otp.refresh_from_db()
        self.assertEqual(otp.otp_code, '222222')
        self.assertGreater(otp.created_at, expired_at)
        self.assertEqual(len(mail.outbox), 2)
        self.assertEqual(mail.outbox[1].to, [self.email])
        self.assertIn(otp.otp_code, mail.outbox[1].body)

        verify_response = self.client.post(
            '/api/otp/verify/',
            {'email': self.email, 'otp': otp.otp_code},
            format='json',
        )
        self.assertEqual(verify_response.status_code, 200, verify_response.data)

    def test_email_delivery_failure_does_not_report_success_or_keep_otp(self):
        with patch('core.views.send_mail', side_effect=OSError('SMTP unavailable')):
            response = self.client.post(
                '/api/otp/send/',
                {'email': self.email},
                format='json',
            )

        self.assertEqual(response.status_code, 503)
        self.assertFalse(EmailOTP.objects.filter(email=self.email).exists())

    @override_settings(EMAIL_HOST='', DEFAULT_FROM_EMAIL='')
    def test_missing_email_configuration_is_reported(self):
        response = self.client.post(
            '/api/otp/send/',
            {'email': self.email},
            format='json',
        )

        self.assertEqual(response.status_code, 503)
        self.assertFalse(EmailOTP.objects.filter(email=self.email).exists())

    def test_registration_without_otp_does_not_create_account(self):
        response = self.client.post(
            '/api/auth/register/',
            self.registration_data,
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('verification code', str(response.data).lower())
        self.assertFalse(User.objects.filter(email=self.email).exists())

    def test_registration_rejects_incorrect_otp(self):
        EmailOTP.objects.create(email=self.email, otp_code='123456')
        response = self.client.post(
            '/api/auth/register/',
            {**self.registration_data, 'otp': '654321'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email=self.email).exists())
        self.assertTrue(EmailOTP.objects.filter(email=self.email).exists())

    def test_registration_rejects_expired_otp(self):
        otp = EmailOTP.objects.create(email=self.email, otp_code='123456')
        EmailOTP.objects.filter(pk=otp.pk).update(
            created_at=timezone.now() - timedelta(minutes=11)
        )

        response = self.client.post(
            '/api/auth/register/',
            {**self.registration_data, 'otp': '123456'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('expired', str(response.data).lower())
        self.assertFalse(User.objects.filter(email=self.email).exists())

    def test_registration_creates_account_and_consumes_valid_otp(self):
        EmailOTP.objects.create(email=self.email, otp_code='123456')

        response = self.client.post(
            '/api/auth/register/',
            {**self.registration_data, 'otp': '123456'},
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        user = User.objects.get(email=self.email)
        self.assertEqual(user.role, 'CUSTOMER')
        self.assertTrue(user.is_customer)
        self.assertFalse(user.is_vendor)
        self.assertFalse(user.is_venue_owner)
        self.assertFalse(EmailOTP.objects.filter(email=self.email).exists())

    def test_registration_creates_the_selected_provider_account(self):
        EmailOTP.objects.create(email=self.email, otp_code='123456')

        response = self.client.post(
            '/api/auth/register/',
            {**self.registration_data, 'otp': '123456', 'role': 'PROVIDER'},
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        user = User.objects.get(email=self.email)
        self.assertEqual(user.role, 'PROVIDER')
        self.assertFalse(user.is_customer)
        self.assertTrue(user.is_vendor)
        self.assertTrue(user.is_venue_owner)
        self.assertTrue(VendorProfile.objects.filter(user=user).exists())
        self.assertTrue(VenueOwnerProfile.objects.filter(user=user).exists())
        self.assertFalse(EmailOTP.objects.filter(email=self.email).exists())

    def test_registration_rejects_admin_role(self):
        EmailOTP.objects.create(email=self.email, otp_code='123456')

        response = self.client.post(
            '/api/auth/register/',
            {**self.registration_data, 'otp': '123456', 'role': 'ADMIN'},
            format='json',
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.filter(email=self.email).exists())
        self.assertTrue(EmailOTP.objects.filter(email=self.email).exists())
