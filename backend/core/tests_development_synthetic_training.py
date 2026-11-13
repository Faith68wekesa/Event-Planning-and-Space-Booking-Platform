from pathlib import Path
from tempfile import TemporaryDirectory

import joblib
import numpy as np

from django.test import SimpleTestCase

from core.ml.isolation_forest import FEATURE_NAMES, MODEL_PATH
from core.ml.dev_synthetic_training import (
    generate_synthetic_training_data,
    generate_synthetic_anomalies,
    train_development_isolation_forest,
    test_development_isolation_forest as evaluate_development_model,
)


class DevelopmentSyntheticTrainingTests(SimpleTestCase):

    def test_normal_data_has_correct_features_and_relationships(self):
        matrix = generate_synthetic_training_data(
            n_samples=120,
            random_state=42,
        )

        self.assertEqual(matrix.shape, (120, len(FEATURE_NAMES)))
        self.assertEqual(len(FEATURE_NAMES), 11)
        self.assertTrue(np.isfinite(matrix).all())

        index = {
            name: FEATURE_NAMES.index(name)
            for name in FEATURE_NAMES
        }

        self.assertTrue(np.all(matrix[:, index['guest_count']] >= 1))
        self.assertTrue(np.all(
            matrix[:, index['same_date_booking_count']]
            <= matrix[:, index['customer_booking_count']]
        ))

        expected_price = (
            matrix[:, index['total_price']]
            / matrix[:, index['guest_count']]
        )

        np.testing.assert_allclose(
            matrix[:, index['price_per_guest']],
            expected_price,
        )

        venue_mask = matrix[:, index['is_venue_booking']] == 1
        vendor_mask = ~venue_mask

        self.assertTrue(np.all(
            matrix[venue_mask, index['has_capacity_reference']] == 1
        ))
        self.assertTrue(np.all(
            matrix[vendor_mask, index['has_capacity_reference']] == 0
        ))
        self.assertTrue(np.all(
            matrix[vendor_mask, index['capacity_utilization']] == 0
        ))

    def test_suspicious_scenarios_have_valid_feature_relationships(self):
        matrix, scenarios = generate_synthetic_anomalies(
            n_samples=100,
            random_state=342,
            return_scenarios=True,
        )

        self.assertEqual(matrix.shape, (100, len(FEATURE_NAMES)))
        self.assertTrue(np.isfinite(matrix).all())

        index = {
            name: FEATURE_NAMES.index(name)
            for name in FEATURE_NAMES
        }

        self.assertEqual(set(scenarios), {0, 1, 2, 3, 4})

        self.assertTrue(np.all(
            matrix[:, index['same_date_booking_count']]
            <= matrix[:, index['customer_booking_count']]
        ))

        # Scenario 0: new account, immediate booking.
        mask = scenarios == 0
        self.assertTrue(np.all(matrix[mask, index['account_age_days']] <= 1))
        self.assertTrue(np.all(matrix[mask, index['booking_lead_time_days']] <= 1))

        # Scenario 1: valid but nearly full venue.
        mask = scenarios == 1
        utilization = matrix[mask, index['capacity_utilization']]
        self.assertTrue(np.all(utilization > 0.90))
        self.assertTrue(np.all(utilization <= 1.0))

        # Scenario 2: many previous bookings on the same date.
        mask = scenarios == 2
        self.assertTrue(np.all(
            matrix[mask, index['same_date_booking_count']] >= 5
        ))

        # Scenario 3: unusually long booking lead time.
        mask = scenarios == 3
        self.assertTrue(np.all(
            matrix[mask, index['booking_lead_time_days']] >= 730
        ))

        # Scenario 4: high activity from a relatively new account.
        mask = scenarios == 4
        self.assertTrue(np.all(
            matrix[mask, index['account_age_days']] <= 7
        ))
        self.assertTrue(np.all(
            matrix[mask, index['customer_booking_count']] >= 15
        ))

    def test_generators_reject_zero_samples(self):
        with self.assertRaises(ValueError):
            generate_synthetic_training_data(n_samples=0)

        with self.assertRaises(ValueError):
            generate_synthetic_anomalies(n_samples=0)

    def test_training_saves_development_only_model(self):
        with TemporaryDirectory() as directory:
            model_path = Path(directory) / 'dev_model.joblib'

            self.assertNotEqual(
                model_path.resolve(),
                Path(MODEL_PATH).resolve(),
            )

            result = train_development_isolation_forest(
                n_samples=200,
                model_path=model_path,
            )

            self.assertTrue(model_path.exists())
            self.assertEqual(result['training_samples'], 200)
            self.assertEqual(
                result['training_data_source'],
                'SYNTHETIC_DEVELOPMENT_ONLY',
            )

            artifact = joblib.load(model_path)

            self.assertEqual(
                artifact['training_data_source'],
                'SYNTHETIC_DEVELOPMENT_ONLY',
            )
            self.assertEqual(artifact['environment'], 'development')
            self.assertEqual(artifact['feature_names'], FEATURE_NAMES)
            self.assertEqual(artifact['training_samples'], 200)
            self.assertEqual(
                len(artifact['reference_scores']),
                200,
            )

    def test_evaluation_returns_normal_and_scenario_results(self):
        with TemporaryDirectory() as directory:
            model_path = Path(directory) / 'dev_model.joblib'

            train_development_isolation_forest(
                n_samples=200,
                model_path=model_path,
            )

            result = evaluate_development_model(
                model_path=model_path,
            )

            self.assertEqual(
                result['training_data_source'],
                'SYNTHETIC_DEVELOPMENT_ONLY',
            )

            normal = result['normal_test']
            suspicious = result['suspicious_test']

            self.assertEqual(normal['test_samples'], 100)
            self.assertEqual(suspicious['test_samples'], 100)

            self.assertEqual(
                normal['classified_as_normal']
                + normal['incorrectly_flagged'],
                100,
            )

            self.assertEqual(
                suspicious['anomalies_detected']
                + suspicious['anomalies_missed'],
                100,
            )

            expected_scenarios = {
                'new_account_immediate_booking',
                'high_venue_capacity_utilization',
                'many_same_date_bookings',
                'unusually_long_booking_lead_time',
                'new_account_high_booking_activity',
            }

            self.assertEqual(
                set(suspicious['scenario_results']),
                expected_scenarios,
            )

            for scenario in suspicious['scenario_results'].values():
                self.assertEqual(scenario['test_samples'], 20)

    def test_evaluation_rejects_non_development_model(self):
        with TemporaryDirectory() as directory:
            model_path = Path(directory) / 'wrong_model.joblib'

            joblib.dump(
                {
                    'training_data_source': 'REAL_BOOKINGS',
                    'environment': 'production',
                    'feature_names': FEATURE_NAMES,
                },
                model_path,
            )

            with self.assertRaises(ValueError):
                evaluate_development_model(model_path=model_path)
