from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from core.models import Booking, Payment, User


@override_settings(DEBUG=True, MPESA_SIMULATION_ENABLED=True)
class MpesaSimulationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username='simulation_customer',
            email='simulation@example.test',
            password='TestPassword123!',
        )
        self.booking = Booking.objects.create(
            customer=self.customer,
            event_title='Simulation Event',
            event_type='WEDDING',
            event_date=date.today(),
            guest_count=20,
            total_price=Decimal('12000.00'),
            status='APPROVED',
        )
        self.client.force_authenticate(user=self.customer)
        self.url = '/api/mpesa/simulate/'

    @patch('core.views.mpesa_service.initiate_stk_push')
    def test_simulation_records_success_without_sending_stk(self, stk_push):
        response = self.client.post(
            self.url,
            {'bookingId': self.booking.id},
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        payment = Payment.objects.get(booking=self.booking)
        self.assertEqual(payment.status, 'SUCCESS')
        self.assertTrue(payment.is_simulated)
        self.assertEqual(payment.amount, self.booking.total_price)
        self.assertIsNone(payment.commission_amount)
        self.assertEqual(payment.payout_status, 'NOT_STARTED')
        self.assertTrue(payment.mpesa_receipt_number.startswith('TEST-'))
        self.assertTrue(response.data['payment']['isSimulated'])
        stk_push.assert_not_called()

        status_response = self.client.get(
            f'/api/mpesa/status/{payment.checkout_request_id}/'
        )
        self.assertTrue(status_response.data['payment']['isSimulated'])

    def test_simulation_requires_authenticated_booking_owner(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            self.url,
            {'bookingId': self.booking.id},
            format='json',
        )
        self.assertIn(response.status_code, [401, 403])

        other_customer = User.objects.create_user(
            username='other_simulation_customer',
            email='other-simulation@example.test',
            password='TestPassword123!',
        )
        self.client.force_authenticate(user=other_customer)
        response = self.client.post(
            self.url,
            {'bookingId': self.booking.id},
            format='json',
        )
        self.assertEqual(response.status_code, 404)
        self.assertFalse(Payment.objects.filter(booking=self.booking).exists())

    def test_simulation_requires_confirmed_booking(self):
        self.booking.status = 'PENDING'
        self.booking.save(update_fields=['status'])

        response = self.client.post(
            self.url,
            {'bookingId': self.booking.id},
            format='json',
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(Payment.objects.filter(booking=self.booking).exists())

    @override_settings(MPESA_SIMULATION_ENABLED=False)
    def test_simulation_is_disabled_without_explicit_setting(self):
        response = self.client.post(
            self.url,
            {'bookingId': self.booking.id},
            format='json',
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(Payment.objects.filter(booking=self.booking).exists())

    @override_settings(DEBUG=False)
    def test_simulation_is_disabled_when_debug_is_off(self):
        response = self.client.post(
            self.url,
            {'bookingId': self.booking.id},
            format='json',
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(Payment.objects.filter(booking=self.booking).exists())

    def test_simulation_does_not_duplicate_a_successful_payment(self):
        Payment.objects.create(
            booking=self.booking,
            checkout_request_id='REAL-CHECKOUT-1',
            customer_phone='254700000000',
            amount=self.booking.total_price,
            status='SUCCESS',
        )

        response = self.client.post(
            self.url,
            {'bookingId': self.booking.id},
            format='json',
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(Payment.objects.filter(booking=self.booking).count(), 1)
