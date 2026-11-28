from datetime import date
from decimal import Decimal
from unittest.mock import Mock, patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import (
    Booking,
    Payment,
    PayoutAttempt,
    User,
    Venue,
    VenueOwnerProfile,
    VendorProfile,
)
from core.services import mpesa


class MpesaCommissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username='commission_customer',
            email='commission-customer@example.test',
            password='TestPassword123!',
        )
        self.provider_user = User.objects.create_user(
            username='commission_provider',
            email='commission-provider@example.test',
            password='TestPassword123!',
            role='VENDOR',
            is_customer=False,
            is_vendor=True,
        )
        self.vendor = VendorProfile.objects.create(
            user=self.provider_user,
            business_name='Commission Provider',
            vendor_type='Catering',
            description='',
            location='Nyeri County, Kenya',
            contact_phone='0712345678',
        )
        self.booking = Booking.objects.create(
            customer=self.customer,
            vendor=self.vendor,
            event_title='Commission Event',
            event_type='WEDDING',
            event_date=date.today(),
            guest_count=20,
            total_price=Decimal('105.00'),
            status='APPROVED',
        )
        self.payment = Payment.objects.create(
            booking=self.booking,
            checkout_request_id='COMMISSION-CHECKOUT-1',
            customer_phone='254700000000',
            amount=Decimal('105.00'),
            status='PENDING',
        )
        self.stk_callback = {
            'Body': {
                'stkCallback': {
                    'CheckoutRequestID': self.payment.checkout_request_id,
                    'ResultCode': 0,
                    'ResultDesc': 'The service request is processed successfully.',
                    'CallbackMetadata': {
                        'Item': [
                            {'Name': 'Amount', 'Value': 105},
                            {'Name': 'MpesaReceiptNumber', 'Value': 'COLLECT123'},
                            {'Name': 'TransactionDate', 'Value': 20261201120000},
                        ],
                    },
                },
            },
        }

    @patch(
        'core.services.payouts.mpesa.initiate_b2c_payout',
        return_value={
            'ResponseCode': '0',
            'ConversationID': 'B2C-CONVERSATION-1',
            'OriginatorConversationID': 'B2C-ORIGINATOR-1',
        },
    )
    def test_collection_persists_rounded_split_and_starts_one_payout(self, payout):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                '/api/mpesa/callback/',
                self.stk_callback,
                format='json',
            )

        self.assertEqual(response.status_code, 200)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, 'SUCCESS')
        self.assertEqual(self.payment.commission_amount, Decimal('11.00'))
        self.assertEqual(self.payment.provider_payout_amount, Decimal('94.00'))
        self.assertEqual(self.payment.payout_status, 'PENDING')
        self.assertEqual(self.payment.payout_conversation_id, 'B2C-CONVERSATION-1')
        payout.assert_called_once_with(
            phone='254712345678',
            amount=94,
            account_reference=f'LOCYFY-{self.booking.id}-{self.payment.id}-1',
        )
        self.assertEqual(PayoutAttempt.objects.filter(payment=self.payment).count(), 1)

    @patch(
        'core.services.payouts.mpesa.initiate_b2c_payout',
        return_value={
            'ResponseCode': '0',
            'ConversationID': 'B2C-CONVERSATION-2',
            'OriginatorConversationID': 'B2C-ORIGINATOR-2',
        },
    )
    def test_duplicate_collection_callback_does_not_send_another_payout(self, payout):
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post('/api/mpesa/callback/', self.stk_callback, format='json')
        self.client.post('/api/mpesa/callback/', self.stk_callback, format='json')

        payout.assert_called_once()
        self.assertEqual(PayoutAttempt.objects.filter(payment=self.payment).count(), 1)

    @patch(
        'core.services.payouts.mpesa.initiate_b2c_payout',
        return_value={
            'ResponseCode': '0',
            'ConversationID': 'B2C-CONVERSATION-TIMEOUT',
            'OriginatorConversationID': 'B2C-ORIGINATOR-TIMEOUT',
        },
    )
    def test_timeout_remains_pending_and_cannot_be_retried(self, payout):
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post('/api/mpesa/callback/', self.stk_callback, format='json')

        timeout = {
            'Result': {
                'ConversationID': 'B2C-CONVERSATION-TIMEOUT',
                'OriginatorConversationID': 'B2C-ORIGINATOR-TIMEOUT',
                'ResultDesc': 'Queue timeout; payout outcome is unknown.',
            },
        }
        self.client.post('/api/mpesa/b2c/timeout/', timeout, format='json')
        self.payment.refresh_from_db()

        self.assertEqual(self.payment.payout_status, 'PENDING')
        self.assertTrue(self.payment.manual_reconciliation_required)
        self.assertFalse(self.payment.payout_retryable)
        payout.assert_called_once()

    @patch(
        'core.services.payouts.mpesa.initiate_b2c_payout',
        return_value={
            'ResponseCode': '0',
            'ConversationID': 'B2C-CONVERSATION-DUPLICATE',
            'OriginatorConversationID': 'B2C-ORIGINATOR-DUPLICATE',
        },
    )
    def test_second_successful_collection_for_booking_is_not_paid_out(self, payout):
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post('/api/mpesa/callback/', self.stk_callback, format='json')

        second_payment = Payment.objects.create(
            booking=self.booking,
            checkout_request_id='COMMISSION-CHECKOUT-2',
            customer_phone='254700000000',
            amount=Decimal('105.00'),
            status='PENDING',
        )
        second_callback = {
            'Body': {
                'stkCallback': {
                    **self.stk_callback['Body']['stkCallback'],
                    'CheckoutRequestID': second_payment.checkout_request_id,
                },
            },
        }
        self.client.post('/api/mpesa/callback/', second_callback, format='json')

        second_payment.refresh_from_db()
        self.assertEqual(second_payment.status, 'SUCCESS')
        self.assertIsNone(second_payment.commission_amount)
        self.assertTrue(second_payment.manual_reconciliation_required)
        payout.assert_called_once()

    @patch('core.services.payouts.mpesa.initiate_b2c_payout')
    def test_admin_can_retry_confirmed_failure_and_history_is_retained(self, payout):
        payout.side_effect = [
            {
                'ResponseCode': '0',
                'ConversationID': 'B2C-CONVERSATION-3',
                'OriginatorConversationID': 'B2C-ORIGINATOR-3',
            },
            {
                'ResponseCode': '0',
                'ConversationID': 'B2C-CONVERSATION-3-RETRY',
                'OriginatorConversationID': 'B2C-ORIGINATOR-3-RETRY',
            },
        ]
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post('/api/mpesa/callback/', self.stk_callback, format='json')

        failure = {
            'Result': {
                'ConversationID': 'B2C-CONVERSATION-3',
                'OriginatorConversationID': 'B2C-ORIGINATOR-3',
                'ResultCode': 1,
                'ResultDesc': 'Insufficient funds.',
            },
        }
        self.client.post('/api/mpesa/b2c/result/', failure, format='json')
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.payout_status, 'FAILED')
        self.assertTrue(self.payment.payout_retryable)

        admin = User.objects.create_user(
            username='commission_admin',
            email='commission-admin@example.test',
            password='TestPassword123!',
            role='ADMIN',
            is_staff=True,
        )
        self.client.force_authenticate(user=admin)
        response = self.client.post(
            f'/api/mpesa/admin/payments/{self.payment.id}/retry-payout/',
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['booking']['payment_breakdown']['payout_status'], 'PENDING')
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.payout_status, 'PENDING')
        self.assertEqual(PayoutAttempt.objects.filter(payment=self.payment).count(), 2)

    @patch(
        'core.services.payouts.mpesa.initiate_b2c_payout',
        return_value={
            'ResponseCode': '0',
            'ConversationID': 'B2C-CONVERSATION-4',
            'OriginatorConversationID': 'B2C-ORIGINATOR-4',
        },
    )
    def test_payout_result_records_transaction_reference_and_provider_totals(self, payout):
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post('/api/mpesa/callback/', self.stk_callback, format='json')

        result = {
            'Result': {
                'ConversationID': 'B2C-CONVERSATION-4',
                'OriginatorConversationID': 'B2C-ORIGINATOR-4',
                'ResultCode': 0,
                'ResultDesc': 'The service request is processed successfully.',
                'TransactionID': 'PAYOUT123',
            },
        }
        self.client.post('/api/mpesa/b2c/result/', result, format='json')

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.payout_status, 'PAID')
        self.assertEqual(self.payment.payout_reference, 'PAYOUT123')
        self.assertIsNotNone(self.payment.paid_out_at)

        self.client.force_authenticate(user=self.provider_user)
        dashboard = self.client.get(f'/api/vendors/{self.vendor.id}/dashboard/')
        self.assertEqual(dashboard.data['total_customer_paid'], 105.0)
        self.assertEqual(dashboard.data['total_commission_deducted'], 11.0)
        self.assertEqual(dashboard.data['total_provider_net'], 94.0)
        self.assertEqual(dashboard.data['total_provider_received'], 94.0)

    def test_provider_bookings_show_simulations_separately_from_real_payouts(self):
        Payment.objects.create(
            booking=self.booking,
            checkout_request_id='SIMULATED-CHECKOUT-1',
            customer_phone='SIMULATED',
            amount=Decimal('105.00'),
            status='SUCCESS',
            is_simulated=True,
            mpesa_receipt_number='TEST-RECEIPT-1',
        )
        self.client.force_authenticate(user=self.provider_user)

        response = self.client.get(f'/api/bookings/?user={self.provider_user.id}')

        self.assertEqual(response.status_code, 200)
        booking_data = next(
            item
            for item in response.data['results']
            if item['id'] == self.booking.id
        )
        self.assertIsNone(booking_data['payment_breakdown'])
        self.assertEqual(
            booking_data['simulated_payment']['customer_paid'],
            Decimal('105.00'),
        )
        self.assertEqual(
            booking_data['simulated_payment']['commission_estimate'],
            Decimal('11.00'),
        )
        self.assertEqual(
            booking_data['simulated_payment']['provider_net_estimate'],
            Decimal('94.00'),
        )
        self.assertEqual(
            booking_data['simulated_payment']['receipt_number'],
            'TEST-RECEIPT-1',
        )

    def test_venue_booking_uses_venue_owner_payout_phone(self):
        owner_user = User.objects.create_user(
            username='commission_owner',
            email='commission-owner@example.test',
            password='TestPassword123!',
            role='VENUE_OWNER',
            is_customer=False,
            is_venue_owner=True,
        )
        owner = VenueOwnerProfile.objects.create(
            user=owner_user,
            business_name='Commission Venue',
            contact_phone='0711111111',
        )
        venue = Venue.objects.create(
            owner=owner,
            title='Commission Garden',
            description='',
            category='WEDDING',
            location='Nyeri County, Kenya',
            capacity=100,
            price_per_day=Decimal('105.00'),
            amenities=[],
        )
        venue_booking = Booking.objects.create(
            customer=self.customer,
            venue=venue,
            event_title='Venue Commission Event',
            event_type='WEDDING',
            event_date=date.today(),
            guest_count=20,
            total_price=Decimal('105.00'),
        )

        from core.services.payouts import resolve_provider_phone

        self.assertEqual(resolve_provider_phone(venue_booking), '254711111111')

    def test_booking_cancellation_flags_unsubmitted_payout_for_manual_review(self):
        self.payment.status = 'SUCCESS'
        self.payment.commission_amount = Decimal('11.00')
        self.payment.provider_payout_amount = Decimal('94.00')
        self.payment.payout_status = 'PENDING'
        self.payment.save()
        self.client.force_authenticate(user=self.provider_user)

        response = self.client.patch(
            f'/api/bookings/{self.booking.id}/update_status/',
            {'status': 'CANCELLED'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.payout_status, 'FAILED')
        self.assertFalse(self.payment.payout_retryable)
        self.assertTrue(self.payment.manual_reconciliation_required)
        self.assertIsNone(self.payment.payout_attempted_at)

    @patch('core.views.mpesa_service.initiate_stk_push')
    def test_stk_amount_must_match_server_booking_total(self, initiate_stk_push):
        response = self.client.post(
            '/api/mpesa/stkpush/',
            {
                'bookingId': self.booking.id,
                'phone': '0712345678',
                'amount': 50,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        initiate_stk_push.assert_not_called()

    @override_settings(PLATFORM_COMMISSION_RATE='0.10')
    def test_platform_reports_include_simulated_commission_estimate(self):
        Payment.objects.filter(pk=self.payment.id).update(
            status='SUCCESS',
            commission_amount=Decimal('11.00'),
            provider_payout_amount=Decimal('94.00'),
            paid_at=timezone.now(),
        )
        Payment.objects.create(
            booking=self.booking,
            checkout_request_id='LEGACY-COMMISSION-CHECKOUT',
            customer_phone='254711111111',
            amount=Decimal('200.00'),
            status='SUCCESS',
        )
        Payment.objects.create(
            booking=self.booking,
            checkout_request_id='SIMULATED-COMMISSION-CHECKOUT',
            customer_phone='SIMULATED',
            amount=Decimal('105.00'),
            status='SUCCESS',
            is_simulated=True,
        )

        response = self.client.get('/api/stats/')

        self.assertEqual(response.data['total_commission'], 42.0)
        self.assertEqual(response.data['total_revenue'], 42.0)

        admin = User.objects.create_user(
            username='commission_admin',
            email='commission-admin@example.test',
            password='TestPassword123!',
            role='ADMIN',
            is_staff=True,
        )
        self.client.force_authenticate(admin)
        analytics_response = self.client.get('/api/analytics/admin/')

        self.assertEqual(analytics_response.status_code, 200)
        self.assertEqual(
            analytics_response.data['summary']['commission_revenue'],
            42.0,
        )


class DarajaB2CPayoutRequestTests(TestCase):
    @override_settings(
        MPESA_ENV='sandbox',
        MPESA_B2C_INITIATOR_NAME='test-initiator',
        MPESA_B2C_SECURITY_CREDENTIAL='test-encrypted-credential',
        MPESA_B2C_SHORTCODE='600000',
        MPESA_B2C_RESULT_URL='https://example.test/api/mpesa/b2c/result/',
        MPESA_B2C_TIMEOUT_URL='https://example.test/api/mpesa/b2c/timeout/',
        MPESA_B2C_COMMAND_ID='BusinessPayment',
        MPESA_B2C_REMARKS='Provider payout',
    )
    @patch('core.services.mpesa.requests.post')
    @patch('core.services.mpesa.get_access_token', return_value='test-token')
    def test_b2c_request_uses_configured_daraja_fields(self, get_token, post):
        response = Mock()
        response.json.return_value = {'ResponseCode': '0'}
        post.return_value = response

        result = mpesa.initiate_b2c_payout(
            phone='0712345678',
            amount=94,
            account_reference='LOCYFY-BOOKING-1',
        )

        self.assertEqual(result, {'ResponseCode': '0'})
        get_token.assert_called_once()
        self.assertEqual(post.call_args.args[0], 'https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest')
        self.assertEqual(post.call_args.kwargs['json'], {
            'InitiatorName': 'test-initiator',
            'SecurityCredential': 'test-encrypted-credential',
            'CommandID': 'BusinessPayment',
            'Amount': 94,
            'PartyA': '600000',
            'PartyB': '254712345678',
            'Remarks': 'Provider payout',
            'QueueTimeOutURL': 'https://example.test/api/mpesa/b2c/timeout/',
            'ResultURL': 'https://example.test/api/mpesa/b2c/result/',
            'Occasion': 'LOCYFY-BOOKING-1',
        })

    @override_settings(MPESA_B2C_SECURITY_CREDENTIAL='')
    @patch('core.services.mpesa.get_access_token')
    def test_b2c_request_fails_explicitly_when_credentials_are_missing(self, get_token):
        with self.assertRaises(mpesa.PayoutNotSubmittedError):
            mpesa.initiate_b2c_payout('0712345678', 94, 'LOCYFY-BOOKING-1')
        get_token.assert_not_called()

