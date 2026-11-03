import django
import os
import math
import unittest
import numpy as np
from unittest.mock import patch
from django.test import TestCase

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import Venue, VendorProfile, Recommendation, User, Booking
from core.ml.recommender import (
    get_venue_recommendations,
    get_vendor_recommendations,
    _cache,
    _ensure_venue_pipeline,
    _ensure_vendor_pipeline,
    _validate_numerical_input,
    _extract_customer_preferences,
    normalize_value_stable,
    compute_numerical_similarity,
    calculate_cold_start_score,
    invalidate_recommendation_cache,
    CAPACITY_REFERENCE_SCALE,
    VENUE_PRICE_REFERENCE_SCALE,
    VENDOR_PRICE_REFERENCE_SCALE
)

def run_edge_case_tests():
    print("==================================================")
    print("STAGE 2 REVISED EDGE CASES & STABILITY VERIFICATION")
    print("==================================================")
    invalidate_recommendation_cache()

    # --------------------------------------------------------------------------
    # 1. Reference Scale Validation (rejects 0, negative, NaN, Inf, non-numeric)
    # --------------------------------------------------------------------------
    print("\n[TEST 1] Reference Scale Validation (normalize_value_stable):")
    invalid_scales = [0, 0.0, -100.0, float('nan'), float('inf'), float('-inf'), "not_num", None]
    for scale in invalid_scales:
        try:
            normalize_value_stable(250.0, scale)
            assert False, f"normalize_value_stable should have raised ValueError for scale={scale}"
        except ValueError:
            pass  # Expected
    # Test invalid values for normalize_value_stable
    invalid_values = [-50.0, float('nan'), float('inf'), float('-inf'), "abc", None]
    for val in invalid_values:
        try:
            normalize_value_stable(val, 1000.0)
            assert False, f"normalize_value_stable should have raised ValueError for value={val}"
        except (ValueError, TypeError):
            pass  # Expected
    # Valid scale and value check
    scaled_val = normalize_value_stable(250.0, 1000.0)
    assert math.isclose(scaled_val, 0.25), f"Expected 0.25, got {scaled_val}"
    print("  -> PASSED: reference_scale strictly rejects 0, negative, NaN, Inf, non-numeric, and None.")

    # --------------------------------------------------------------------------
    # 2. Punctuation-Only, Stop-Word-Only, and Empty Text Handling
    # --------------------------------------------------------------------------
    print("\n[TEST 2] Punctuation-Only, Stop-Word-Only, and Empty Text:")
    with patch('core.ml.recommender._build_venue_text', return_value="... ,,, !!! ???"):
        invalidate_recommendation_cache()
        recs_punct = get_venue_recommendations(customer=None, preferences={'venue_budget': 200000})
        print(f"  Punctuation-only listing text handled safely, returned: {len(recs_punct)} results")
        assert len(recs_punct) > 0
        assert _cache.venue_vectorizer is None, "Vectorizer should be safely None for empty vocab"
        assert _cache.venue_pipeline_built is True, "Pipeline flag must be True"

        first_fitted_at = _cache.venue_fitted_at
        get_venue_recommendations(customer=None, preferences={'venue_budget': 200000})
        assert _cache.venue_fitted_at == first_fitted_at, "Must reuse cached pipeline even when vectorizer is None"
        print("  -> PASSED: Reused cached pipeline when vectorizer is None without errors.")

    with patch('core.ml.recommender._build_venue_text', return_value="the and is of at"):
        invalidate_recommendation_cache()
        recs_stop = get_venue_recommendations(customer=None, preferences={'venue_budget': 200000})
        print(f"  Stop-words-only listing text handled safely, returned: {len(recs_stop)} results")
        assert len(recs_stop) > 0
        assert _cache.venue_pipeline_built is True
        print("  -> PASSED: Handled stop-words-only text without crashing.")

    # Verify that a non-empty-vocabulary ValueError in pipeline builder propagates
    with patch('sklearn.feature_extraction.text.TfidfVectorizer.fit_transform', side_effect=ValueError("Unexpected internal scikit-learn memory failure")):
        invalidate_recommendation_cache()
        try:
            _ensure_venue_pipeline()
            assert False, "Unexpected ValueError during fitting must propagate, not be swallowed"
        except ValueError as e:
            assert "Unexpected internal scikit-learn memory failure" in str(e)
            print("  -> PASSED: Unexpected non-empty-vocabulary ValueError during fitting propagates cleanly.")

    invalidate_recommendation_cache()

    # --------------------------------------------------------------------------
    # 3. Transparent Cold-Start Scoring Tests
    # --------------------------------------------------------------------------
    print("\n[TEST 3] Transparent Cold-Start Scoring Formula:")
    s1 = calculate_cold_start_score(rating=0.0, review_count=0, is_verified=False)
    assert s1 == 0.35, f"Expected 0.35, got {s1}"
    print(f"  Unrated & Unverified Listing -> Score: {s1}")

    s2 = calculate_cold_start_score(rating=0.0, review_count=0, is_verified=True)
    assert s2 == 0.40, f"Expected 0.40, got {s2}"
    print(f"  Unrated & Verified Listing -> Score: {s2}")

    s3 = calculate_cold_start_score(rating=5.0, review_count=10, is_verified=True)
    assert s3 == 0.85, f"Expected 0.85, got {s3}"
    print(f"  5.0 Star Listing with 10 reviews -> Score: {s3}")
    print("  -> PASSED: Transparent cold-start logic verified.")

    # --------------------------------------------------------------------------
    # 4. Comprehensive Identical Numerical Tests
    # --------------------------------------------------------------------------
    print("\n[TEST 4] Comprehensive Identical Capacities, Identical Prices:")

    # Case A: Two Venues with Identical Capacities (both 250 guests)
    caps_identical = np.array([[normalize_value_stable(250.0, CAPACITY_REFERENCE_SCALE)],
                               [normalize_value_stable(250.0, CAPACITY_REFERENCE_SCALE)]], dtype=np.float64)
    target_below_cap = np.array([[normalize_value_stable(150.0, CAPACITY_REFERENCE_SCALE)]], dtype=np.float64)
    target_exact_cap = np.array([[normalize_value_stable(250.0, CAPACITY_REFERENCE_SCALE)]], dtype=np.float64)
    target_above_cap = np.array([[normalize_value_stable(400.0, CAPACITY_REFERENCE_SCALE)]], dtype=np.float64)

    sim_exact_cap = compute_numerical_similarity(target_exact_cap, caps_identical)
    sim_below_cap = compute_numerical_similarity(target_below_cap, caps_identical)
    sim_above_cap = compute_numerical_similarity(target_above_cap, caps_identical)

    assert np.allclose(sim_exact_cap, [1.0, 1.0])
    assert np.all(sim_exact_cap > sim_below_cap)
    assert np.all(sim_below_cap > 0.0)
    assert np.all(sim_above_cap > 0.0)
    print(f"  Two venues identical capacity (250) -> Exact: {sim_exact_cap[0]:.4f}, Below (150): {sim_below_cap[0]:.4f}, Above (400): {sim_above_cap[0]:.4f}")
    print("  -> PASSED: Identical venue capacities handle preferences above and below accurately.")

    # Case B: Two Venues with Identical Prices (both KES 150,000)
    prices_identical = np.array([[normalize_value_stable(150000.0, VENUE_PRICE_REFERENCE_SCALE)],
                                 [normalize_value_stable(150000.0, VENUE_PRICE_REFERENCE_SCALE)]], dtype=np.float64)
    target_exact_p = np.array([[normalize_value_stable(150000.0, VENUE_PRICE_REFERENCE_SCALE)]], dtype=np.float64)
    target_below_p = np.array([[normalize_value_stable(80000.0, VENUE_PRICE_REFERENCE_SCALE)]], dtype=np.float64)
    target_above_p = np.array([[normalize_value_stable(300000.0, VENUE_PRICE_REFERENCE_SCALE)]], dtype=np.float64)

    sim_exact_p = compute_numerical_similarity(target_exact_p, prices_identical)
    sim_below_p = compute_numerical_similarity(target_below_p, prices_identical)
    sim_above_p = compute_numerical_similarity(target_above_p, prices_identical)

    assert np.allclose(sim_exact_p, [1.0, 1.0])
    assert np.all(sim_exact_p > sim_below_p)
    assert np.all(sim_exact_p > sim_above_p)
    print(f"  Two venues identical rental prices (150k) -> Exact: {sim_exact_p[0]:.4f}, Below (80k): {sim_below_p[0]:.4f}, Above (300k): {sim_above_p[0]:.4f}")
    print("  -> PASSED: Identical venue rental prices handle preferences above and below accurately.")

    # Case C: Two Vendors with Identical Starting Prices (both KES 60,000)
    vnd_identical = np.array([[normalize_value_stable(60000.0, VENDOR_PRICE_REFERENCE_SCALE)],
                              [normalize_value_stable(60000.0, VENDOR_PRICE_REFERENCE_SCALE)]], dtype=np.float64)
    target_vnd_exact = np.array([[normalize_value_stable(60000.0, VENDOR_PRICE_REFERENCE_SCALE)]], dtype=np.float64)
    target_vnd_above = np.array([[normalize_value_stable(120000.0, VENDOR_PRICE_REFERENCE_SCALE)]], dtype=np.float64)

    sim_vnd_exact = compute_numerical_similarity(target_vnd_exact, vnd_identical)
    sim_vnd_above = compute_numerical_similarity(target_vnd_above, vnd_identical)

    assert np.allclose(sim_vnd_exact, [1.0, 1.0])
    assert np.all(sim_vnd_exact > sim_vnd_above)
    print(f"  Two vendors identical starting price (60k) -> Exact: {sim_vnd_exact[0]:.4f}, Above (120k): {sim_vnd_above[0]:.4f}")
    print("  -> PASSED: Identical vendor starting prices handle preferences accurately.")

    # --------------------------------------------------------------------------
    # 5. Complete Single-Listing Venue and Vendor Pipeline Tests
    # --------------------------------------------------------------------------
    print("\n[TEST 5] Complete Single-Listing Venue and Vendor Pipeline Tests:")
    dummy_venue = Venue(
        id=9991,
        title="Solo Venue",
        category="WEDDING",
        location="Nairobi",
        address="101 Solo Way",
        description="A beautiful solitary venue for testing pipelines",
        capacity=300,
        price_per_day=150000,
        approval_status='APPROVED',
        is_available=True,
        rating=4.5,
        review_count=12,
        is_verified=True
    )
    with patch('core.ml.recommender._get_eligible_venues', return_value=[dummy_venue]):
        invalidate_recommendation_cache()
        v_cache = _ensure_venue_pipeline()
        assert len(v_cache.venue_records) == 1
        assert v_cache.venue_cap_matrix.shape == (1, 1)
        assert v_cache.venue_price_matrix.shape == (1, 1)
        assert v_cache.venue_tfidf_matrix.shape[0] == 1
        # Run recommendations through single-venue pipeline
        single_recs = get_venue_recommendations(customer=None, preferences={'guest_count': 300, 'venue_budget': 150000, 'text_query': 'Solo'})
        assert len(single_recs) == 1
        assert single_recs[0]['venue'].id == 9991
        assert math.isclose(single_recs[0]['match_score'], 1.0, abs_tol=1e-4)
        print("  -> PASSED: Single-venue pipeline fitted and produced perfect score for exact preference.")

    dummy_vendor = VendorProfile(
        id=9992,
        business_name="Solo Photography",
        vendor_type="Photography",
        location="Nairobi",
        description="Solo vendor photography services",
        starting_price=50000,
        verification_status='APPROVED',
        rating=4.8,
        review_count=15,
        is_verified=True
    )
    with patch('core.ml.recommender._get_eligible_vendors', return_value=[dummy_vendor]):
        invalidate_recommendation_cache()
        vnd_cache = _ensure_vendor_pipeline()
        assert len(vnd_cache.vendor_records) == 1
        assert vnd_cache.vendor_price_matrix.shape == (1, 1)
        assert vnd_cache.vendor_tfidf_matrix.shape[0] == 1
        # Run recommendations through single-vendor pipeline
        single_vnd_recs = get_vendor_recommendations(customer=None, preferences={'vendor_budget': 50000, 'text_query': 'Photography'})
        assert len(single_vnd_recs) == 1
        assert single_vnd_recs[0]['vendor'].id == 9992
        assert math.isclose(single_vnd_recs[0]['match_score'], 1.0, abs_tol=1e-4)
        print("  -> PASSED: Single-vendor pipeline fitted and produced perfect score for exact preference.")

    invalidate_recommendation_cache()

    # --------------------------------------------------------------------------
    # 6. Catalogue Stability for Venues AND Vendors (Extreme Listings Invariance)
    # --------------------------------------------------------------------------
    print("\n[TEST 6] Catalogue Stability Test (Extreme Listings Invariance):")
    # Part A: Venue Catalogue Stability
    base_venue_a = Venue(id=101, title="Alpha Hall", category="CONFERENCE", location="Nairobi", description="Modern hall", capacity=300, price_per_day=200000, approval_status='APPROVED', is_available=True)
    base_venue_b = Venue(id=102, title="Beta Gardens", category="WEDDING", location="Nairobi", description="Lush garden", capacity=500, price_per_day=400000, approval_status='APPROVED', is_available=True)

    with patch('core.ml.recommender._get_eligible_venues', return_value=[base_venue_a, base_venue_b]):
        invalidate_recommendation_cache()
        recs_base = get_venue_recommendations(customer=None, preferences={'guest_count': 300, 'venue_budget': 200000})
        scores_base = {r['venue'].id: r['match_score'] for r in recs_base}

    extreme_venue_max = Venue(id=999, title="Mega Stadium", category="CONCERT", location="Nairobi", description="Massive stadium", capacity=100000, price_per_day=50000000, approval_status='APPROVED', is_available=True)
    extreme_venue_min = Venue(id=998, title="Tiny Pod", category="MEETING", location="Nairobi", description="Cozy booth", capacity=5, price_per_day=1000, approval_status='APPROVED', is_available=True)

    with patch('core.ml.recommender._get_eligible_venues', return_value=[base_venue_a, base_venue_b, extreme_venue_max, extreme_venue_min]):
        invalidate_recommendation_cache()
        recs_extended = get_venue_recommendations(customer=None, preferences={'guest_count': 300, 'venue_budget': 200000})
        scores_extended = {r['venue'].id: r['match_score'] for r in recs_extended}

    print(f"  Alpha Hall Base Score: {scores_base[101]:.6f} | Extended Score: {scores_extended[101]:.6f}")
    print(f"  Beta Gardens Base Score: {scores_base[102]:.6f} | Extended Score: {scores_extended[102]:.6f}")
    assert math.isclose(scores_base[101], scores_extended[101], abs_tol=1e-5), "Alpha Hall score must remain invariant when extreme listings are added"
    assert math.isclose(scores_base[102], scores_extended[102], abs_tol=1e-5), "Beta Gardens score must remain invariant when extreme listings are added"
    print("  -> PASSED: Venue catalogue stability confirmed.")

    # Part B: Vendor Catalogue Stability
    base_vnd_a = VendorProfile(id=201, business_name="Alpha Catering", vendor_type="Catering", location="Nairobi", description="Fine dining caterer", starting_price=100000, verification_status='APPROVED', is_verified=True)
    base_vnd_b = VendorProfile(id=202, business_name="Beta Sound", vendor_type="DJ", location="Nairobi", description="DJ sound system", starting_price=40000, verification_status='APPROVED', is_verified=True)

    with patch('core.ml.recommender._get_eligible_vendors', return_value=[base_vnd_a, base_vnd_b]):
        invalidate_recommendation_cache()
        recs_vnd_base = get_vendor_recommendations(customer=None, preferences={'vendor_budget': 100000})
        scores_vnd_base = {r['vendor'].id: r['match_score'] for r in recs_vnd_base}

    extreme_vnd_max = VendorProfile(id=997, business_name="Global Celebrity Talent", vendor_type="Entertainment", location="Nairobi", description="International orchestra", starting_price=25000000, verification_status='APPROVED', is_verified=True)
    extreme_vnd_min = VendorProfile(id=996, business_name="Micro Prop", vendor_type="Decor", location="Nairobi", description="Single prop rental", starting_price=500, verification_status='APPROVED', is_verified=True)

    with patch('core.ml.recommender._get_eligible_vendors', return_value=[base_vnd_a, base_vnd_b, extreme_vnd_max, extreme_vnd_min]):
        invalidate_recommendation_cache()
        recs_vnd_ext = get_vendor_recommendations(customer=None, preferences={'vendor_budget': 100000})
        scores_vnd_ext = {r['vendor'].id: r['match_score'] for r in recs_vnd_ext}

    print(f"  Alpha Catering Base Score: {scores_vnd_base[201]:.6f} | Extended Score: {scores_vnd_ext[201]:.6f}")
    print(f"  Beta Sound Base Score: {scores_vnd_base[202]:.6f} | Extended Score: {scores_vnd_ext[202]:.6f}")
    assert math.isclose(scores_vnd_base[201], scores_vnd_ext[201], abs_tol=1e-5), "Alpha Catering score must remain invariant when extreme vendor listings are added"
    assert math.isclose(scores_vnd_base[202], scores_vnd_ext[202], abs_tol=1e-5), "Beta Sound score must remain invariant when extreme vendor listings are added"

    # Part C: Vendor Catalogue Stability Upon Removing Extreme Listings
    with patch('core.ml.recommender._get_eligible_vendors', return_value=[base_vnd_a, base_vnd_b]):
        invalidate_recommendation_cache()
        recs_vnd_restored = get_vendor_recommendations(customer=None, preferences={'vendor_budget': 100000})
        scores_vnd_restored = {r['vendor'].id: r['match_score'] for r in recs_vnd_restored}

    print(f"  Alpha Catering Restored Score: {scores_vnd_restored[201]:.6f} (matches base: {scores_vnd_base[201]:.6f})")
    print(f"  Beta Sound Restored Score: {scores_vnd_restored[202]:.6f} (matches base: {scores_vnd_base[202]:.6f})")
    assert math.isclose(scores_vnd_base[201], scores_vnd_restored[201], abs_tol=1e-5), "Alpha Catering score must remain invariant when extreme vendor listings are removed"
    assert math.isclose(scores_vnd_base[202], scores_vnd_restored[202], abs_tol=1e-5), "Beta Sound score must remain invariant when extreme vendor listings are removed"
    print("  -> PASSED: Vendor catalogue stability lifecycle (base -> added -> removed) confirmed.")

    invalidate_recommendation_cache()

    # --------------------------------------------------------------------------
    # 7. Unexpected Exception Propagation Tests (Venue and Vendor Calculations)
    # --------------------------------------------------------------------------
    print("\n[TEST 7] Unexpected Exception Propagation in Calculations:")
    
    # 7A: Unexpected ValueError propagation in venue calculation
    with patch('core.ml.recommender.compute_numerical_similarity', side_effect=ValueError("Unexpected numerical ValueError in venue calculation")):
        try:
            get_venue_recommendations(customer=None, preferences={'guest_count': 250})
            assert False, "Unexpected ValueError must propagate out of get_venue_recommendations"
        except ValueError as e:
            assert "Unexpected numerical ValueError in venue calculation" in str(e)
            print("  -> PASSED: Unexpected ValueError in venue calculation propagates.")

    # 7B: Unexpected TypeError propagation in venue calculation
    with patch('core.ml.recommender.compute_numerical_similarity', side_effect=TypeError("Unexpected TypeError in venue calculation")):
        try:
            get_venue_recommendations(customer=None, preferences={'guest_count': 250})
            assert False, "Unexpected TypeError must propagate out of get_venue_recommendations"
        except TypeError as e:
            assert "Unexpected TypeError in venue calculation" in str(e)
            print("  -> PASSED: Unexpected TypeError in venue calculation propagates.")

    # 7C: Unexpected AttributeError propagation in venue calculation
    with patch('core.ml.recommender.compute_numerical_similarity', side_effect=AttributeError("Unexpected AttributeError in venue calculation")):
        try:
            get_venue_recommendations(customer=None, preferences={'guest_count': 250})
            assert False, "Unexpected AttributeError must propagate out of get_venue_recommendations"
        except AttributeError as e:
            assert "Unexpected AttributeError in venue calculation" in str(e)
            print("  -> PASSED: Unexpected AttributeError in venue calculation propagates.")

    # 7D: Unexpected RuntimeError propagation in venue calculation
    with patch('core.ml.recommender.compute_numerical_similarity', side_effect=RuntimeError("Unexpected RuntimeError in venue calculation")):
        try:
            get_venue_recommendations(customer=None, preferences={'guest_count': 250})
            assert False, "Unexpected RuntimeError must propagate out of get_venue_recommendations"
        except RuntimeError as e:
            assert "Unexpected RuntimeError in venue calculation" in str(e)
            print("  -> PASSED: Unexpected RuntimeError in venue calculation propagates.")

    # 7E: Unexpected ValueError, TypeError, AttributeError, RuntimeError propagation in vendor calculation
    for exc_cls, exc_name in [(ValueError, "ValueError"), (TypeError, "TypeError"), (AttributeError, "AttributeError"), (RuntimeError, "RuntimeError")]:
        with patch('core.ml.recommender.compute_numerical_similarity', side_effect=exc_cls(f"Unexpected {exc_name} in vendor calculation")):
            try:
                get_vendor_recommendations(customer=None, preferences={'vendor_budget': 50000})
                assert False, f"Unexpected {exc_name} must propagate out of get_vendor_recommendations"
            except exc_cls as e:
                assert f"Unexpected {exc_name} in vendor calculation" in str(e)
                print(f"  -> PASSED: Unexpected {exc_name} in vendor calculation propagates.")

    invalidate_recommendation_cache()

    # --------------------------------------------------------------------------    # 8. Out-Of-Range Numerical Preferences (Controlled Fixture & Venue Identity Assertion)
    # --------------------------------------------------------------------------
    print("\n[TEST 8] Out-Of-Range Numerical Preferences (Controlled Fixture):")
    venue_target_300 = Venue(
        id=701,
        title="Exact 300 Hall",
        category="WEDDING",
        location="Nairobi",
        capacity=300,
        price_per_day=200000,
        approval_status='APPROVED',
        is_available=True
    )
    venue_other = Venue(
        id=702,
        title="Small Hall",
        category="WEDDING",
        location="Nairobi",
        capacity=50,
        price_per_day=50000,
        approval_status='APPROVED',
        is_available=True
    )

    with patch('core.ml.recommender._get_eligible_venues', return_value=[venue_target_300, venue_other]):
        invalidate_recommendation_cache()
        recs_350 = get_venue_recommendations(customer=None, preferences={'guest_count': 350})
        recs_450 = get_venue_recommendations(customer=None, preferences={'guest_count': 450})
        recs_800 = get_venue_recommendations(customer=None, preferences={'guest_count': 800})

        # Explicitly assert that the top recommended venue is the target venue with capacity 300
        assert recs_350[0]['venue'].id == 701, f"Expected venue ID 701, got {recs_350[0]['venue'].id}"
        assert recs_350[0]['venue'].capacity == 300, f"Expected capacity 300, got {recs_350[0]['venue'].capacity}"
        assert recs_450[0]['venue'].id == 701, f"Expected venue ID 701, got {recs_450[0]['venue'].id}"
        assert recs_450[0]['venue'].capacity == 300, f"Expected capacity 300, got {recs_450[0]['venue'].capacity}"
        assert recs_800[0]['venue'].id == 701, f"Expected venue ID 701, got {recs_800[0]['venue'].id}"
        assert recs_800[0]['venue'].capacity == 300, f"Expected capacity 300, got {recs_800[0]['venue'].capacity}"

        score_350 = recs_350[0]['match_score']
        score_450 = recs_450[0]['match_score']
        score_800 = recs_800[0]['match_score']

        print(f"  Verified Venue {recs_350[0]['venue'].title} (cap {recs_350[0]['venue'].capacity}) requested 350 -> Score: {score_350}")
        print(f"  Verified Venue {recs_450[0]['venue'].title} (cap {recs_450[0]['venue'].capacity}) requested 450 -> Score: {score_450}")
        print(f"  Verified Venue {recs_800[0]['venue'].title} (cap {recs_800[0]['venue'].capacity}) requested 800 -> Score: {score_800}")

        assert score_350 > score_450 > score_800, "Out-of-range preferences must produce strictly differentiated decreasing scores"
        assert 0.0 < score_800 <= 1.0, "Scores must remain strictly bounded"
        print("  -> PASSED: Controlled fixture confirms venue identity and smooth distance decay.")

    invalidate_recommendation_cache()

    # --------------------------------------------------------------------------
    # 9. Booking Target Exclusivity & Historical Budget Inference
    # --------------------------------------------------------------------------
    print("\n[TEST 9] Booking Target Exclusivity in Historical Preference Extraction:")
    mock_customer = User(id=801, username="test_history_customer", email="history@locyfy.com")

    # Case A: Booking with both venue and vendor references (MUST be skipped)
    b_both = Booking(id=901, customer=mock_customer, status='COMPLETED', venue_id=19, vendor_id=120, total_price=500000, guest_count=150)
    # Case B: Booking with neither venue nor vendor (MUST be skipped)
    b_neither = Booking(id=902, customer=mock_customer, status='COMPLETED', venue_id=None, vendor_id=None, total_price=500000, guest_count=150)
    # Case C: Valid Venue-only booking
    b_venue_only = Booking(id=903, customer=mock_customer, status='COMPLETED', venue_id=19, vendor_id=None, total_price=220000, guest_count=280)
    b_venue_only.venue = Venue(id=19, title="Catering Hall", category="CATERING", location="Nyeri", capacity=300)

    with patch('core.models.Booking.objects.filter') as mock_b_filter:
        # Test Case A + B (Both or neither -> ignored)
        mock_b_filter.return_value.select_related.return_value.order_by.return_value = [b_both, b_neither]
        prefs_invalid = _extract_customer_preferences(mock_customer)
        assert prefs_invalid['venue_budget'] is None
        assert prefs_invalid['vendor_budget'] is None
        print("  -> PASSED: Bookings with both references or neither reference are safely excluded.")

        # Test Case C (Venue only -> sets venue_budget, leaves vendor_budget unset)
        mock_b_filter.return_value.select_related.return_value.order_by.return_value = [b_venue_only]
        prefs_valid = _extract_customer_preferences(mock_customer)
        assert prefs_valid['venue_budget'] == 220000.0
        assert prefs_valid['vendor_budget'] is None
        assert prefs_valid['guest_count'] == 280.0
        print(f"  -> PASSED: Single venue target sets venue_budget={prefs_valid['venue_budget']} without touching vendor_budget.")

    # --------------------------------------------------------------------------
    # 10. Strict Numerical Input Validation (NaN, Inf, negative, zero)
    # --------------------------------------------------------------------------
    print("\n[TEST 10] Strict Numerical Input Validation:")
    assert _validate_numerical_input(float('nan'), 'nan_test') is None
    assert _validate_numerical_input(float('inf'), 'inf_test') is None
    assert _validate_numerical_input(float('-inf'), '-inf_test') is None
    assert _validate_numerical_input(-500, 'neg_test') is None
    assert _validate_numerical_input("not_a_number", 'str_test') is None
    assert _validate_numerical_input(0.0, 'zero_test') == 0.0
    assert _validate_numerical_input(250.5, 'pos_test') == 250.5
    print("  -> PASSED: NaN, Inf, negative, string, and valid float values validated strictly.")

    # --------------------------------------------------------------------------
    # 11. Empty Listing Datasets
    # --------------------------------------------------------------------------
    print("\n[TEST 11] Empty Listing Datasets:")
    with patch('core.ml.recommender._get_eligible_venues', return_value=Venue.objects.none()):
        invalidate_recommendation_cache()
        recs_empty = get_venue_recommendations(customer=None, preferences={'guest_count': 100})
        assert recs_empty == []
        print("  -> PASSED: Empty dataset returns empty list.")

    invalidate_recommendation_cache()
    print("\n==================================================")
    print("ALL REVISED EDGE CASE & STABILITY TESTS PASSED!")
    print("==================================================")


class RecommenderEdgeCasesTestCase(TestCase):
    def setUp(self):
        # Create fixtures in isolated test database
        provider = User.objects.create_user(
            username='edge_provider_iso',
            email='edge_provider@locyfy.com',
            password='testpassword123',
            role='PROVIDER'
        )
        Venue.objects.create(
            title='Isolated Test Venue Alpha',
            category='BANQUET',
            location='Nairobi CBD',
            capacity=300,
            price_per_day=150000.0,
            approval_status='APPROVED',
            is_available=True,
            rating=4.5,
            review_count=10
        )
        Venue.objects.create(
            title='Isolated Test Venue Beta',
            category='GARDEN',
            location='Karen',
            capacity=150,
            price_per_day=80000.0,
            approval_status='APPROVED',
            is_available=True,
            rating=4.0,
            review_count=5
        )
        VendorProfile.objects.create(
            user=provider,
            business_name='Isolated Test Vendor Alpha',
            vendor_type='CATERING',
            starting_price=50000.0,
            is_verified=True,
            verification_status='APPROVED',
            rating=4.8,
            review_count=15
        )

    def test_recommender_edge_cases_and_stability(self):
        """Run complete recommender edge cases, stability, and exception propagation suite."""
        run_edge_case_tests()


if __name__ == '__main__':
    run_edge_case_tests()
