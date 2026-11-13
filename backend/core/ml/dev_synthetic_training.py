"""
LOCYFY Development-Only Synthetic Fraud Training.

Generates synthetic booking patterns for testing Isolation Forest.
Does not create database bookings or modify the production model.
"""

from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from django.conf import settings
from sklearn.ensemble import IsolationForest

from .isolation_forest import FEATURE_NAMES, MODEL_VERSION


# Separate artifact for development.
# Never use the production fraud model path here.
DEV_MODEL_PATH = (
    Path(settings.BASE_DIR)
    / "ml_models"
    / "dev_fraud_isolation_forest.joblib"
)

RANDOM_STATE = 42
DEFAULT_TRAINING_SAMPLES = 2000


def generate_synthetic_training_data(
    n_samples=DEFAULT_TRAINING_SAMPLES,
    random_state=RANDOM_STATE,
):
    """
    Generate realistic synthetic normal booking features.

    Feature relationships mirror production feature extraction.
    No Django Booking objects or database records are created.
    """

    if n_samples < 1:
        raise ValueError("n_samples must be at least 1.")

    rng = np.random.default_rng(random_state)

    # Booking type: 1 = venue, 0 = vendor.
    is_venue_booking = rng.integers(0, 2, size=n_samples)

    # Customer and listing ages, in days.
    account_age_days = rng.integers(1, 3651, size=n_samples)
    listing_age_days = rng.integers(1, 3651, size=n_samples)

    # Normal bookings are made before their event dates.
    booking_lead_time_days = rng.integers(1, 366, size=n_samples)

    # Customer booking history.
    customer_booking_count = rng.integers(0, 31, size=n_samples)

    # Same-date bookings cannot exceed all previous bookings.
    same_date_booking_count = np.array([
        rng.integers(0, min(int(count), 3) + 1)
        for count in customer_booking_count
    ])

    # Generate guest counts and capacity relationships.
    guest_count = np.zeros(n_samples, dtype=int)
    capacity_utilization = np.zeros(n_samples, dtype=float)

    venue_indices = np.where(is_venue_booking == 1)[0]
    vendor_indices = np.where(is_venue_booking == 0)[0]

    # Venue bookings have a real capacity reference.
    venue_capacity = rng.integers(
        50,
        1001,
        size=len(venue_indices),
    )

    venue_utilization = rng.uniform(
        0.20,
        0.90,
        size=len(venue_indices),
    )

    venue_guests = np.maximum(
        np.rint(venue_capacity * venue_utilization).astype(int),
        1,
    )

    guest_count[venue_indices] = venue_guests

    capacity_utilization[venue_indices] = (
        venue_guests / venue_capacity
    )

    # Vendor bookings do not have a venue capacity reference.
    guest_count[vendor_indices] = rng.integers(
        1,
        201,
        size=len(vendor_indices),
    )

    has_capacity_reference = is_venue_booking.copy()

    # Generate fixed listing prices for each booking type.
    # These ranges are based on the current development database:
    # KSh 210,000 to KSh 3,000,000.
    # They are development assumptions, not verified market ranges.
    total_price = np.zeros(n_samples, dtype=float)

    # Venue price is the fixed daily listing price.
    total_price[venue_indices] = rng.uniform(
        210000,
        3000000,
        size=len(venue_indices),
    )

    # Vendor price is the fixed starting price.
    total_price[vendor_indices] = rng.uniform(
        210000,
        3000000,
        size=len(vendor_indices),
    )

    # Mirror the production calculation exactly.
    price_per_guest = np.divide(
        total_price,
        guest_count,
        out=np.zeros(n_samples, dtype=float),
        where=guest_count > 0,
    )

    # Preserve the exact production feature order.
    matrix = np.column_stack([
        account_age_days,
        booking_lead_time_days,
        guest_count,
        total_price,
        price_per_guest,
        customer_booking_count,
        same_date_booking_count,
        capacity_utilization,
        has_capacity_reference,
        listing_age_days,
        is_venue_booking,
    ]).astype(float)

    if matrix.shape[1] != len(FEATURE_NAMES):
        raise ValueError(
            "Generated features do not match FEATURE_NAMES."
        )

    if not np.isfinite(matrix).all():
        raise ValueError(
            "Synthetic data contains invalid numerical values."
        )

    return matrix


def generate_synthetic_anomalies(
    n_samples=100,
    random_state=RANDOM_STATE + 1,
    return_scenarios=False,
):
    """
    Generate five suspicious or unusual booking patterns.

    Development testing only. No database records are created.
    """

    if n_samples < 1:
        raise ValueError("n_samples must be at least 1.")

    rng = np.random.default_rng(random_state)

    matrix = generate_synthetic_training_data(
        n_samples=n_samples,
        random_state=random_state + 100,
    ).copy()

    # Distribute samples across five scenarios.
    scenarios = np.arange(n_samples) % 5
    rng.shuffle(scenarios)

    for scenario in range(5):
        indices = np.where(scenarios == scenario)[0]
        count = len(indices)

        if count == 0:
            continue

        if scenario == 0:
            # New account making an immediate booking.
            matrix[indices, 0] = rng.integers(0, 2, size=count)
            matrix[indices, 1] = rng.integers(0, 2, size=count)
            matrix[indices, 5] = 0
            matrix[indices, 6] = 0

        elif scenario == 1:
            # Valid venue booking with unusually high capacity utilization.
            matrix[indices, 10] = 1
            matrix[indices, 8] = 1

            venue_capacity = rng.integers(
                50, 1001, size=count
            )

            utilization = rng.uniform(
                0.91, 0.99, size=count
            )

            matrix[indices, 2] = np.ceil(
                venue_capacity * utilization
            )

            matrix[indices, 7] = (
                matrix[indices, 2] / venue_capacity
            )

            # Keep the original listing price.
            # Recalculate price per guest as production does.
            matrix[indices, 4] = (
                matrix[indices, 3] / matrix[indices, 2]
            )

        elif scenario == 2:
            # Many previous bookings for the same event date.
            matrix[indices, 5] = rng.integers(
                10, 31, size=count
            )
            matrix[indices, 6] = rng.integers(
                5, 11, size=count
            )
            matrix[indices, 1] = rng.integers(
                0, 4, size=count
            )

        elif scenario == 3:
            # Unusually long booking lead time.
            # Account age is left unchanged to avoid mixing signals.
            matrix[indices, 1] = rng.integers(
                730, 1501, size=count
            )

        elif scenario == 4:
            # High booking activity from a relatively new account.
            matrix[indices, 0] = rng.integers(
                1, 8, size=count
            )

            matrix[indices, 1] = rng.integers(
                1, 8, size=count
            )

            matrix[indices, 5] = rng.integers(
                15, 31, size=count
            )

            matrix[indices, 6] = rng.integers(
                0, 4, size=count
            )

    if matrix.shape[1] != len(FEATURE_NAMES):
        raise ValueError(
            "Synthetic anomalies do not match FEATURE_NAMES."
        )

    if not np.isfinite(matrix).all():
        raise ValueError(
            "Synthetic anomalies contain invalid numerical values."
        )

    if np.any(matrix[:, 6] > matrix[:, 5]):
        raise ValueError(
            "Synthetic anomalies contain invalid booking histories."
        )

    if return_scenarios:
        return matrix, scenarios
    return matrix


def train_development_isolation_forest(
    n_samples=DEFAULT_TRAINING_SAMPLES,
    model_path=None,
    contamination=0.10,
):
    """
    Train a development-only Isolation Forest using synthetic data.

    This function never accesses or modifies production bookings.
    """

    training_matrix = generate_synthetic_training_data(
        n_samples=n_samples
    )

    model = IsolationForest(
        n_estimators=200,
        contamination=contamination,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )

    model.fit(training_matrix)

    reference_scores = model.decision_function(training_matrix)

    destination = Path(model_path or DEV_MODEL_PATH)
    destination.parent.mkdir(parents=True, exist_ok=True)

    artifact = {
        "model": model,
        "feature_names": FEATURE_NAMES,
        "model_version": MODEL_VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "training_samples": len(training_matrix),
        "reference_scores": reference_scores,
        "contamination": contamination,
        "training_data_source": "SYNTHETIC_DEVELOPMENT_ONLY",
        "environment": "development",
    }

    temporary_path = destination.with_suffix(
        destination.suffix + ".tmp"
    )

    try:
        joblib.dump(artifact, temporary_path)
        temporary_path.replace(destination)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()

    return {
        "model_path": str(destination),
        "training_samples": len(training_matrix),
        "trained_at": artifact["trained_at"],
        "model_version": MODEL_VERSION,
        "training_data_source": artifact["training_data_source"],
    }


def test_development_isolation_forest(model_path=None):
    """
    Test the development model against unseen normal and
    suspicious synthetic booking patterns.

    Does not create database records.
    """

    source = Path(model_path or DEV_MODEL_PATH)

    if not source.exists():
        raise FileNotFoundError(
            f"Development model not found: {source}. "
            "Train the development model first."
        )

    artifact = joblib.load(source)

    if artifact.get("training_data_source") != "SYNTHETIC_DEVELOPMENT_ONLY":
        raise ValueError("This is not a development synthetic model.")

    if artifact.get("environment") != "development":
        raise ValueError("Model is not marked as development-only.")

    if artifact.get("feature_names") != FEATURE_NAMES:
        raise ValueError("Model feature names do not match.")

    model = artifact["model"]

    # Generate unseen normal bookings using a different random seed.
    normal_matrix = generate_synthetic_training_data(
        n_samples=100,
        random_state=RANDOM_STATE + 200,
    )

    # Generate suspicious bookings and retain their scenario labels.
    anomaly_matrix, anomaly_scenarios = generate_synthetic_anomalies(
        n_samples=100,
        random_state=RANDOM_STATE + 300,
        return_scenarios=True,
    )

    # Predict normal bookings.
    normal_predictions = model.predict(normal_matrix)
    normal_scores = model.decision_function(normal_matrix)

    # Predict suspicious bookings.
    anomaly_predictions = model.predict(anomaly_matrix)
    anomaly_scores = model.decision_function(anomaly_matrix)

    normal_detected = int(np.sum(normal_predictions == 1))
    normal_flagged = int(np.sum(normal_predictions == -1))

    anomalies_detected = int(np.sum(anomaly_predictions == -1))
    anomalies_missed = int(np.sum(anomaly_predictions == 1))

    scenario_names = {
        0: "new_account_immediate_booking",
        1: "high_venue_capacity_utilization",
        2: "many_same_date_bookings",
        3: "unusually_long_booking_lead_time",
        4: "new_account_high_booking_activity",
    }

    scenario_results = {}

    for scenario_id, scenario_name in scenario_names.items():
        scenario_mask = anomaly_scenarios == scenario_id

        scenario_predictions = anomaly_predictions[scenario_mask]

        scenario_detected = int(
            np.sum(scenario_predictions == -1)
        )

        scenario_missed = int(
            np.sum(scenario_predictions == 1)
        )

        scenario_total = len(scenario_predictions)

        detection_rate = (
            scenario_detected / scenario_total * 100
            if scenario_total > 0
            else 0.0
        )

        scenario_results[scenario_name] = {
            "test_samples": scenario_total,
            "anomalies_detected": scenario_detected,
            "anomalies_missed": scenario_missed,
            "detection_rate_percent": round(
                detection_rate, 2
            ),
        }

    return {
        "model_path": str(source),
        "training_samples": artifact["training_samples"],
        "training_data_source": artifact["training_data_source"],
        "normal_test": {
            "test_samples": len(normal_matrix),
            "classified_as_normal": normal_detected,
            "incorrectly_flagged": normal_flagged,
            "predictions": normal_predictions.tolist(),
            "decision_scores": normal_scores.tolist(),
        },
        "suspicious_test": {
            "test_samples": len(anomaly_matrix),
            "anomalies_detected": anomalies_detected,
            "anomalies_missed": anomalies_missed,
            "scenario_results": scenario_results,
            "predictions": anomaly_predictions.tolist(),
            "decision_scores": anomaly_scores.tolist(),
        },
    }