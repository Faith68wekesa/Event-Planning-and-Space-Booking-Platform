from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    Booking,
    Venue,
    VenueOwnerProfile,
    FraudAlert,
)
from core.ml.fraud_detector import (
    evaluate_booking_risk,
    create_fraud_alert,
)


User = get_user_model()


class FraudDetectionTestCase(TestCase):

    def setUp(self):
        # Create a customer account.
        self.customer = User.objects.create_user(
            username='fraud_test_customer',
            email='fraudtest@example.com',
            password='Password123!',
            role='CUSTOMER',
        )

        # Create a venue owner.
        self.provider_user = User.objects.create_user(
            username='fraud_test_owner',
            email='fraudowner@example.com',
            password='Password123!',
            role='VENUE_OWNER',
        )

        self.owner_profile = VenueOwnerProfile.objects.create(
            user=self.provider_user,
            business_name='Fraud Test Venues',
            is_verified=True,
            verification_status='APPROVED',
        )

        # Create a venue for the test bookings.
        self.venue = Venue.objects.create(
            owner=self.owner_profile,
            title='Fraud Test Hall',
            category='WEDDING',
            location='Nairobi',
            capacity=100,
            price_per_day=50000,
            is_verified=True,
            approval_status='APPROVED',
            is_available=True,
        )

        # All test bookings use an event scheduled for tomorrow.
        self.event_date = timezone.localdate() + timedelta(days=1)

    def create_booking(self):
        return Booking.objects.create(
            customer=self.customer,
            venue=self.venue,
            event_title='Fraud Detection Test Event',
            event_type='Wedding',
            event_date=self.event_date,
            guest_count=30,
            total_price=50000,
            status='PENDING',
        )

    def test_new_account_booking_close_to_event_scores_35(self):
        """A new account booking close to the event receives 35 points."""

        booking = self.create_booking()

        assessment = evaluate_booking_risk(booking)

        self.assertEqual(assessment['risk_score'], 35.0)
        self.assertFalse(assessment['is_anomaly'])
        self.assertEqual(
            assessment['detection_method'],
            'RULE_BASED',
        )

    def test_low_risk_booking_does_not_create_alert(self):
        """Bookings below the alert threshold should not create alerts."""

        booking = self.create_booking()

        alert = create_fraud_alert(booking)

        self.assertIsNone(alert)
        self.assertFalse(
            FraudAlert.objects.filter(booking=booking).exists()
        )

    def test_three_previous_same_date_bookings_raise_score_to_55(self):
        """A new account and three previous same-date bookings score 55."""

        for number in range(3):
            Booking.objects.create(
                customer=self.customer,
                venue=self.venue,
                event_title=f'Previous Test Event {number}',
                event_type='Wedding',
                event_date=self.event_date,
                guest_count=20,
                total_price=30000,
                status='PENDING',
            )

        booking = self.create_booking()

        assessment = evaluate_booking_risk(booking)

        self.assertEqual(
            assessment['features']['same_date_booking_count'],
            3.0,
        )
        self.assertEqual(assessment['risk_score'], 55.0)
        self.assertTrue(assessment['is_anomaly'])

    def test_high_risk_booking_creates_fraud_alert(self):
        """A booking reaching the threshold should create an alert."""

        for number in range(3):
            Booking.objects.create(
                customer=self.customer,
                venue=self.venue,
                event_title=f'Previous Test Event {number}',
                event_type='Wedding',
                event_date=self.event_date,
                guest_count=20,
                total_price=30000,
                status='PENDING',
            )

        booking = self.create_booking()

        alert = create_fraud_alert(booking)

        self.assertIsNotNone(alert)
        self.assertEqual(alert.booking_id, booking.id)
        self.assertEqual(alert.risk_score, 55.0)
        self.assertTrue(alert.is_anomaly)
        self.assertEqual(alert.detection_method, 'RULE_BASED')
        self.assertEqual(alert.status, 'PENDING_REVIEW')

    def test_existing_alert_is_updated_without_duplicate(self):
        """Repeated detection updates the alert and preserves admin review."""

        for number in range(3):
            Booking.objects.create(
                customer=self.customer,
                venue=self.venue,
                event_title=f'Previous Test Event {number}',
                event_type='Wedding',
                event_date=self.event_date,
                guest_count=20,
                total_price=30000,
                status='PENDING',
            )

        booking = self.create_booking()

        first_alert = create_fraud_alert(booking)

        first_alert.status = 'INVESTIGATING'
        first_alert.admin_notes = 'Administrator is reviewing this booking.'
        first_alert.save()

        second_alert = create_fraud_alert(booking)

        self.assertEqual(first_alert.id, second_alert.id)
        self.assertEqual(
            FraudAlert.objects.filter(booking=booking).count(),
            1,
        )
        self.assertEqual(second_alert.status, 'INVESTIGATING')
        self.assertEqual(
            second_alert.admin_notes,
            'Administrator is reviewing this booking.',
        )

    def test_booking_api_triggers_fraud_detection(self):
        """Submitting a suspicious booking through the API creates an alert."""

        # Create three previous bookings for the same event date.
        for number in range(3):
            Booking.objects.create(
                customer=self.customer,
                venue=self.venue,
                event_title=f'Previous API Event {number}',
                event_type='Wedding',
                event_date=self.event_date,
                guest_count=20,
                total_price=30000,
                status='PENDING',
            )

        client = APIClient()
        client.force_authenticate(user=self.customer)

        payload = {
            'customer': self.customer.id,
            'venue': self.venue.id,
            'event_title': 'Suspicious API Test Event',
            'event_type': 'Wedding',
            'event_date': self.event_date.isoformat(),
            'guest_count': 30,
            'total_price': 50000,
        }

        with self.captureOnCommitCallbacks(execute=True):
            response = client.post(
                '/api/bookings/',
                payload,
                format='json',
            )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            f'Booking API rejected the request: {response.data}',
        )

        booking = Booking.objects.get(id=response.data['id'])

        alert = FraudAlert.objects.get(booking=booking)

        self.assertEqual(alert.risk_score, 55.0)
        self.assertTrue(alert.is_anomaly)
        self.assertEqual(alert.detection_method, 'RULE_BASED')
