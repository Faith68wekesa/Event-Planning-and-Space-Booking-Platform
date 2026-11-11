"""
LOCYFY Fraud Detection Engine.

Extracts numerical booking features for hybrid rule-based and
Isolation Forest fraud detection.
"""

import logging

from django.db.models import Q
from django.utils import timezone

logger = logging.getLogger(__name__)


def _get_local_date(value):
    """Convert a datetime value into a local date."""
    if value is None:
        return timezone.localdate()

    if timezone.is_aware(value):
        return timezone.localtime(value).date()

    return value.date()


def extract_booking_features(booking):
    """
    Extract numerical features from a saved booking.

    Historical booking counts include only bookings created before the
    booking being evaluated.
    """

    Booking = booking.__class__

    booking_date = _get_local_date(
        booking.created_at
    )

    account_created_date = _get_local_date(
        booking.customer.date_joined
    )

    account_age_days = max(
        (booking_date - account_created_date).days,
        0
    )

    booking_lead_time_days = (
        booking.event_date - booking_date
    ).days

    guest_count = max(int(booking.guest_count), 0)

    total_price = max(float(booking.total_price), 0.0)

    price_per_guest = (
        total_price / guest_count
        if guest_count > 0
        else 0.0
    )

    # Only count bookings created before the booking being evaluated.
    # The primary key provides a tie-breaker when timestamps are identical.
    previous_bookings = Booking.objects.filter(
        customer_id=booking.customer_id,
        status__in=['PENDING', 'APPROVED', 'COMPLETED'],
    ).filter(
        Q(created_at__lt=booking.created_at)
        | Q(
            created_at=booking.created_at,
            pk__lt=booking.pk
        )
    )

    customer_booking_count = previous_bookings.count()

    # Previous bookings by this customer for the same event date.
    same_date_booking_count = previous_bookings.filter(
        event_date=booking.event_date
    ).count()

    # Identify the selected listing.
    if booking.venue_id:
        listing = booking.venue
        is_venue_booking = 1
        capacity = listing.capacity or 0
        listing_verified = listing.is_verified
    elif booking.vendor_id:
        listing = booking.vendor
        is_venue_booking = 0
        capacity = 0
        listing_verified = listing.is_verified
    else:
        listing = None
        is_venue_booking = 0
        capacity = 0
        listing_verified = False

    # Capacity utilization is only available for venue bookings.
    has_capacity_reference = 1 if capacity > 0 else 0

    capacity_utilization = (
        guest_count / capacity
        if capacity > 0
        else 0.0
    )

    listing_age_days = 0

    if listing and listing.created_at:
        listing_created_date = _get_local_date(
            listing.created_at
        )

        listing_age_days = max(
            (booking_date - listing_created_date).days,
            0
        )

    return {
        'account_age_days': float(account_age_days),
        'booking_lead_time_days': float(booking_lead_time_days),
        'guest_count': float(guest_count),
        'total_price': total_price,
        'price_per_guest': price_per_guest,
        'customer_booking_count': float(customer_booking_count),
        'same_date_booking_count': float(same_date_booking_count),
        'capacity_utilization': capacity_utilization,
        'has_capacity_reference': float(has_capacity_reference),
        'listing_age_days': float(listing_age_days),
        'listing_verified': float(bool(listing_verified)),
        'is_venue_booking': float(is_venue_booking),
    }

# Rule-based risk configuration.
RULE_BASED_ALERT_THRESHOLD = 40.0


def _evaluate_rule_based_risk(features):
    """Evaluate known business risk indicators."""

    risk_score = 0.0
    risk_indicators = []

    # Rule 1: A newly created account books very close to the event.
    if (
        features['account_age_days'] <= 1
        and 0 <= features['booking_lead_time_days'] <= 1
    ):
        risk_score += 35
        risk_indicators.append(
            'A newly created customer account is booking very close '
            'to the event date.'
        )

    # Rule 2: Several previous bookings share the same event date.
    if features['same_date_booking_count'] >= 3:
        risk_score += 20
        risk_indicators.append(
            'The customer has several previous bookings for the same '
            'event date.'
        )

    risk_score = min(risk_score, 100.0)

    return {
        'risk_score': risk_score,
        'is_anomaly': risk_score >= RULE_BASED_ALERT_THRESHOLD,
        'detection_method': 'RULE_BASED',
        'reason': (
            ' '.join(risk_indicators)
            if risk_indicators
            else 'No significant rule-based risk indicators were detected.'
        ),
        'features': features,
    }


def evaluate_booking_risk(booking):
    """
    Combine Isolation Forest predictions with explainable business rules.

    If the ML model is unavailable, use rule-based detection.
    A booking is flagged when either method identifies an anomaly.
    """

    # Always evaluate business rules.
    features = extract_booking_features(booking)
    rule_assessment = _evaluate_rule_based_risk(features)

    try:
        from .isolation_forest import (
            load_isolation_forest,
            predict_booking_anomaly,
        )

        artifact = load_isolation_forest()

        if artifact is not None:
            ml_assessment = predict_booking_anomaly(
                booking,
                artifact=artifact,
            )

            if ml_assessment is not None:
                # Either method can identify a suspicious booking.
                combined_risk_score = max(
                    rule_assessment['risk_score'],
                    ml_assessment['risk_score'],
                )

                is_anomaly = (
                    rule_assessment['is_anomaly']
                    or ml_assessment['is_anomaly']
                )

                reasons = []

                if rule_assessment['risk_score'] > 0:
                    reasons.append(
                        'Rule-based checks: '
                        + rule_assessment['reason']
                    )

                if ml_assessment['is_anomaly']:
                    reasons.append(
                        'Isolation Forest: '
                        + ml_assessment['reason']
                    )

                if not reasons:
                    reasons.append(
                        'Neither the business rules nor Isolation Forest '
                        'identified a significant risk indicator.'
                    )

                return {
                    'risk_score': round(combined_risk_score, 2),
                    'is_anomaly': is_anomaly,
                    'detection_method': 'HYBRID',
                    'reason': ' '.join(reasons),
                    'features': features,
                    'rule_based_risk_score': (
                        rule_assessment['risk_score']
                    ),
                    'isolation_forest_risk_score': (
                        ml_assessment['risk_score']
                    ),
                    'decision_score': ml_assessment.get(
                        'decision_score'
                    ),
                }

    except Exception:
        logger.exception(
            'Isolation Forest prediction failed for booking %s. '
            'Using rule-based detection.',
            booking.pk,
        )

    # Cold-start fallback or model prediction failure.
    return rule_assessment


def create_fraud_alert(booking):
    """
    Evaluate a saved booking and create a FraudAlert
    only when the assessment identifies an anomaly.
    """

    from ..models import FraudAlert

    assessment = evaluate_booking_risk(booking)

    # Do not create alerts for bookings below the threshold.
    if not assessment['is_anomaly']:
        return None

    alert, created = FraudAlert.objects.update_or_create(
        booking=booking,
        defaults={
            'risk_score': assessment['risk_score'],
            'is_anomaly': assessment['is_anomaly'],
            'detection_method': assessment['detection_method'],
            'reason': assessment['reason'],
        }
    )

    return alert
