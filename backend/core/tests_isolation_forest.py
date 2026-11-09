from pathlib import Path
from tempfile import TemporaryDirectory
import time
from unittest.mock import patch

import joblib
import numpy as np

from django.test import TestCase

from sklearn.ensemble import IsolationForest

from core.ml.isolation_forest import (
    FEATURE_NAMES,
    MIN_TRAINING_SAMPLES,
    _load_cached_isolation_forest,
    build_feature_matrix,
    load_isolation_forest,
    predict_booking_anomaly,
    train_isolation_forest,
)


class IsolationForestTests(TestCase):

    def test_build_feature_matrix_returns_correct_shape(self):
        rows = [
            {name: float(index) for index, name in enumerate(FEATURE_NAMES)},
            {name: float(index + 1) for index, name in enumerate(FEATURE_NAMES)},
        ]

        with patch(
            'core.ml.isolation_forest.extract_ml_features',
            side_effect=rows,
        ):
            matrix = build_feature_matrix([object(), object()])

        self.assertEqual(matrix.shape, (2, len(FEATURE_NAMES)))
        self.assertEqual(matrix.dtype, float)
        self.assertTrue(np.isfinite(matrix).all())

    def test_build_feature_matrix_rejects_empty_bookings(self):
        with self.assertRaises(ValueError):
            build_feature_matrix([])

    def test_build_feature_matrix_rejects_non_finite_values(self):
        row = {name: 1.0 for name in FEATURE_NAMES}
        row[FEATURE_NAMES[0]] = np.nan

        with patch(
            'core.ml.isolation_forest.extract_ml_features',
            return_value=row,
        ):
            with self.assertRaises(ValueError):
                build_feature_matrix([object()])

    def test_training_rejects_insufficient_bookings(self):
        bookings = [object()] * (MIN_TRAINING_SAMPLES - 1)

        with TemporaryDirectory() as directory:
            model_path = Path(directory) / 'test_model.joblib'

            with self.assertRaises(ValueError):
                train_isolation_forest(
                    bookings=bookings,
                    model_path=model_path,
                )

            self.assertFalse(model_path.exists())

    def test_loading_returns_none_when_model_does_not_exist(self):
        with TemporaryDirectory() as directory:
            model_path = Path(directory) / 'missing_model.joblib'

            self.assertIsNone(load_isolation_forest(model_path))

    def test_training_saves_model_and_prediction_returns_result(self):
        rng = np.random.default_rng(42)
        test_matrix = rng.normal(
            size=(MIN_TRAINING_SAMPLES, len(FEATURE_NAMES))
        )

        bookings = [object()] * MIN_TRAINING_SAMPLES

        with TemporaryDirectory() as directory:
            model_path = Path(directory) / 'test_model.joblib'

            with patch(
                'core.ml.isolation_forest.build_feature_matrix',
                return_value=test_matrix,
            ):
                training_result = train_isolation_forest(
                    bookings=bookings,
                    model_path=model_path,
                )

            self.assertTrue(model_path.exists())
            self.assertEqual(
                training_result['training_samples'],
                MIN_TRAINING_SAMPLES,
            )

            artifact = load_isolation_forest(model_path)

            self.assertIsNotNone(artifact)
            self.assertEqual(
                artifact['model_version'],
                1,
            )

            test_features = {name: 0.0 for name in FEATURE_NAMES}

            with patch(
                'core.ml.isolation_forest.extract_ml_features',
                return_value=test_features,
            ):
                result = predict_booking_anomaly(
                    object(),
                    artifact=artifact,
                )

            self.assertIn('risk_score', result)
            self.assertGreaterEqual(result['risk_score'], 0)
            self.assertLessEqual(result['risk_score'], 100)
            self.assertIsInstance(result['is_anomaly'], bool)
            self.assertEqual(
                result['detection_method'],
                'ISOLATION_FOREST',
            )

            # Verify that the prediction matches the model's decision.
            test_matrix = np.asarray(
                [[test_features[name] for name in FEATURE_NAMES]],
                dtype=float,
            )

            expected_prediction = int(
                artifact['model'].predict(test_matrix)[0]
            )

            expected_decision_score = float(
                artifact['model'].decision_function(test_matrix)[0]
            )

            self.assertEqual(
                result['is_anomaly'],
                expected_prediction == -1,
            )

            self.assertAlmostEqual(
                result['decision_score'],
                expected_decision_score,
            )

    def test_training_clears_model_cache(self):
        _load_cached_isolation_forest.cache_clear()
        self.addCleanup(_load_cached_isolation_forest.cache_clear)

        rng = np.random.default_rng(42)
        test_matrix = rng.normal(
            size=(MIN_TRAINING_SAMPLES, len(FEATURE_NAMES))
        )
        bookings = [object()] * MIN_TRAINING_SAMPLES

        with TemporaryDirectory() as directory:
            model_path = Path(directory) / 'cache_clear_test.joblib'

            with patch(
                'core.ml.isolation_forest.build_feature_matrix',
                return_value=test_matrix,
            ):
                train_isolation_forest(
                    bookings=bookings,
                    model_path=model_path,
                )

                load_isolation_forest(model_path)

                self.assertEqual(
                    _load_cached_isolation_forest.cache_info().currsize,
                    1,
                )

                train_isolation_forest(
                    bookings=bookings,
                    model_path=model_path,
                )

            self.assertEqual(
                _load_cached_isolation_forest.cache_info().currsize,
                0,
            )

    def test_repeated_model_loading_uses_cache(self):
        rng = np.random.default_rng(42)
        test_matrix = rng.normal(
            size=(MIN_TRAINING_SAMPLES, len(FEATURE_NAMES))
        )
        bookings = [object()] * MIN_TRAINING_SAMPLES

        with TemporaryDirectory() as directory:
            model_path = Path(directory) / 'cached_model.joblib'

            with patch(
                'core.ml.isolation_forest.build_feature_matrix',
                return_value=test_matrix,
            ):
                train_isolation_forest(
                    bookings=bookings,
                    model_path=model_path,
                )

            original_load = joblib.load
            with patch(
                'core.ml.isolation_forest.joblib.load',
                wraps=original_load,
            ) as mock_load:
                first = load_isolation_forest(model_path)
                second = load_isolation_forest(model_path)

            self.assertIs(first, second)
            mock_load.assert_called_once()

    def test_replacing_model_file_invalidates_cache(self):
        rng = np.random.default_rng(42)
        test_matrix = rng.normal(
            size=(MIN_TRAINING_SAMPLES, len(FEATURE_NAMES))
        )
        bookings = [object()] * MIN_TRAINING_SAMPLES

        with TemporaryDirectory() as directory:
            model_path = Path(directory) / 'cached_model.joblib'

            with patch(
                'core.ml.isolation_forest.build_feature_matrix',
                return_value=test_matrix,
            ):
                train_isolation_forest(
                    bookings=bookings,
                    model_path=model_path,
                )

            first = load_isolation_forest(model_path)

            updated_artifact = dict(first)
            updated_artifact['cache_test_marker'] = 'updated artifact'

            time.sleep(0.02)

            replacement_path = model_path.with_suffix('.replacement')
            joblib.dump(updated_artifact, replacement_path)
            replacement_path.replace(model_path)

            second = load_isolation_forest(model_path)

            self.assertIsNot(first, second)
            self.assertEqual(
                second['cache_test_marker'],
                'updated artifact',
            )
