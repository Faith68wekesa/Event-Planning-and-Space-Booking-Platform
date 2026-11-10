"""
LOCYFY Isolation Forest Fraud Detection Model.

Trains an unsupervised anomaly detection model using historical
booking data. An anomaly is an unusual booking pattern, not proof
that fraud has occurred.

The existing rule-based detector remains the cold-start fallback.
"""

from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np

from django.conf import settings

from sklearn.ensemble import IsolationForest

from .fraud_detector import extract_booking_features


# Only use numerical features suitable for machine-learning input.
# listing_verified is excluded because its current value may not
# represent the listing's verification status at booking time.
FEATURE_NAMES = [
    'account_age_days',
    'booking_lead_time_days',
    'guest_count',
    'total_price',
    'price_per_guest',
    'customer_booking_count',
    'same_date_booking_count',
    'capacity_utilization',
    'has_capacity_reference',
    'listing_age_days',
    'is_venue_booking',
]

MODEL_VERSION = 1

# This is an initial engineering safeguard, not a guarantee
# that 30 bookings are statistically sufficient for reliable detection.
MIN_TRAINING_SAMPLES = 30

MODEL_PATH = (
    Path(settings.BASE_DIR)
    / 'ml_models'
    / 'fraud_isolation_forest.joblib'
)


def extract_ml_features(booking):
    """Extract the approved machine-learning features for one booking."""

    all_features = extract_booking_features(booking)

    return {
        name: float(all_features[name])
        for name in FEATURE_NAMES
    }


def build_feature_matrix(bookings):
    """Convert bookings into a validated numerical feature matrix."""

    rows = [
        extract_ml_features(booking)
        for booking in bookings
    ]

    if not rows:
        raise ValueError('No booking records were supplied.')

    matrix = np.asarray(
        [
            [row[name] for name in FEATURE_NAMES]
            for row in rows
        ],
        dtype=float,
    )

    if not np.isfinite(matrix).all():
        raise ValueError(
            'Training data contains missing or non-finite feature values.'
        )

    return matrix


def train_isolation_forest(
    bookings=None,
    model_path=None,
    min_samples=MIN_TRAINING_SAMPLES,
    contamination='auto',
):
    """
    Train and persist an Isolation Forest using historical bookings.

    Synthetic data must not be used as production training data.
    """

    from ..models import Booking

    if bookings is None:
        bookings = list(
            Booking.objects.select_related(
                'customer',
                'venue',
                'vendor',
            ).filter(
                status__in=['APPROVED', 'COMPLETED'],
            ).order_by('created_at', 'pk')
        )
    else:
        bookings = list(bookings)

    sample_count = len(bookings)

    if sample_count < min_samples:
        raise ValueError(
            f'Not enough historical bookings to train the model. '
            f'Found {sample_count}; at least {min_samples} are required.'
        )

    matrix = build_feature_matrix(bookings)

    model = IsolationForest(
        n_estimators=200,
        contamination=contamination,
        random_state=42,
        n_jobs=-1,
    )

    model.fit(matrix)

    # Lower decision-function values represent more unusual records.
    reference_scores = model.decision_function(matrix)

    artifact = {
        'model': model,
        'feature_names': FEATURE_NAMES,
        'model_version': MODEL_VERSION,
        'trained_at': datetime.now(timezone.utc).isoformat(),
        'training_samples': sample_count,
        'reference_scores': reference_scores,
        'contamination': contamination,
    }

    destination = Path(model_path or MODEL_PATH)
    destination.parent.mkdir(parents=True, exist_ok=True)

    # Write to a temporary file first to avoid leaving a partial artifact.
    temporary_path = destination.with_suffix(
        destination.suffix + '.tmp'
    )

    try:
        joblib.dump(artifact, temporary_path)
        temporary_path.replace(destination)
        # Ensure future predictions use the newly trained model.
        _load_cached_isolation_forest.cache_clear()
    finally:
        if temporary_path.exists():
            temporary_path.unlink()

    return {
        'model_path': str(destination),
        'training_samples': sample_count,
        'trained_at': artifact['trained_at'],
        'model_version': MODEL_VERSION,
    }


@lru_cache(maxsize=4)
def _load_cached_isolation_forest(
    path_string,
    modified_ns,
    file_size,
):
    """Load and validate a model artifact, reusing cached versions."""

    artifact = joblib.load(path_string)

    if artifact.get('model_version') != MODEL_VERSION:
        raise ValueError('Unsupported Isolation Forest model version.')

    if artifact.get('feature_names') != FEATURE_NAMES:
        raise ValueError('Model feature definitions do not match.')

    return artifact


def load_isolation_forest(model_path=None):
    """Load a trained model, using a cache to avoid repeated disk reads."""

    destination = Path(model_path or MODEL_PATH)

    if not destination.is_file():
        return None

    file_stat = destination.stat()

    return _load_cached_isolation_forest(
        str(destination.resolve()),
        file_stat.st_mtime_ns,
        file_stat.st_size,
    )


def predict_booking_anomaly(booking, artifact=None):
    """
    Assess a booking using a trained Isolation Forest.

    risk_score is an anomaly-ranking score from 0 to 100.
    It is not a probability of fraud.
    """

    if artifact is None:
        artifact = load_isolation_forest()

    if artifact is None:
        return None

    features = extract_ml_features(booking)

    matrix = np.asarray(
        [[features[name] for name in FEATURE_NAMES]],
        dtype=float,
    )

    if not np.isfinite(matrix).all():
        raise ValueError('Booking features contain non-finite values.')

    model = artifact['model']

    prediction = int(model.predict(matrix)[0])
    decision_score = float(model.decision_function(matrix)[0])

    reference_scores = np.asarray(
        artifact['reference_scores'],
        dtype=float,
    )

    # A lower decision score means a more unusual booking.
    # Compare it with training scores to obtain a relative ranking.
    risk_score = float(
        np.mean(reference_scores >= decision_score) * 100
    )

    is_anomaly = prediction == -1

    reason = (
        'The booking contains a pattern identified as unusual '
        'by the Isolation Forest model.'
        if is_anomaly
        else 'The booking pattern was not identified as an anomaly '
             'by the Isolation Forest model.'
    )

    return {
        'risk_score': round(risk_score, 2),
        'is_anomaly': is_anomaly,
        'detection_method': 'ISOLATION_FOREST',
        'reason': reason,
        'features': features,
        'decision_score': decision_score,
    }
