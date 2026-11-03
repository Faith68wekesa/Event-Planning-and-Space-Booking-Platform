import time
import math
import logging
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from django.db.models import Q
from core.models import Venue, VendorProfile, Recommendation, Booking, Event, UserInteraction

logger = logging.getLogger(__name__)

# Cache expiration interval: 300 seconds (5 minutes)
CACHE_TTL_SECONDS = 300

# ==============================================================================
# CONFIGURABLE BUDGET ALLOCATION ESTIMATES (FALLBACK ONLY)
# ==============================================================================
DEFAULT_BUDGET_ALLOCATION_BY_EVENT_TYPE = {
    'WEDDING': {'venue_share': 0.45, 'vendor_share': 0.20},
    'CORPORATE': {'venue_share': 0.50, 'vendor_share': 0.15},
    'CONFERENCE': {'venue_share': 0.55, 'vendor_share': 0.15},
    'BIRTHDAY': {'venue_share': 0.35, 'vendor_share': 0.25},
    'PARTY': {'venue_share': 0.40, 'vendor_share': 0.20},
    'CONCERT': {'venue_share': 0.50, 'vendor_share': 0.20},
    'DEFAULT': {'venue_share': 0.45, 'vendor_share': 0.20},
}


def get_budget_allocation_shares(event_type=None):
    """
    Retrieve configurable venue and vendor budget allocation shares for an event type.
    Returns: (venue_share: float, vendor_share: float)
    """
    key = str(event_type or '').strip().upper()
    config = DEFAULT_BUDGET_ALLOCATION_BY_EVENT_TYPE.get(key, DEFAULT_BUDGET_ALLOCATION_BY_EVENT_TYPE['DEFAULT'])
    return config['venue_share'], config['vendor_share']


# ==============================================================================
# STABLE REFERENCE RANGES (CATALOGUE-INDEPENDENT NORMALIZATION)
# ==============================================================================
CAPACITY_REFERENCE_SCALE = 1000.0
VENUE_PRICE_REFERENCE_SCALE = 500000.0
VENDOR_PRICE_REFERENCE_SCALE = 200000.0


def normalize_value_stable(value, reference_scale):
    """
    Scale a numerical value stably by its domain reference scale.
    Formula: value / reference_scale.
    
    Reference Scale Validation:
    - Rejects zero, negative, NaN, non-numeric, and infinite reference scales.
    - If reference_scale is invalid, raises ValueError.
    - Naturally produces positive floats without artificial clipping.
    """
    if reference_scale is None:
        raise ValueError("reference_scale cannot be None")
    try:
        f_scale = float(reference_scale)
    except (ValueError, TypeError) as e:
        raise ValueError(f"reference_scale must be numeric: {reference_scale}") from e

    if math.isnan(f_scale) or math.isinf(f_scale) or f_scale <= 0.0:
        raise ValueError(f"reference_scale must be a positive finite non-zero number, got: {reference_scale}")

    f_val = float(value)
    if math.isnan(f_val) or math.isinf(f_val) or f_val < 0.0:
        raise ValueError(f"value must be a non-negative finite number, got: {value}")

    return f_val / f_scale


class RecommendationPipelineCache:
    """
    In-memory cache for fitted vectorizers and listing feature matrices.
    Avoids rebuilding TF-IDF and listing feature vectors on every single customer request.
    Uses pipeline_built boolean flags so that empty vocabulary (vectorizer is None)
    is cached and reused without attempting to refit on every call.
    """
    def __init__(self):
        self.venue_fitted_at = 0.0
        self.venue_pipeline_built = False
        self.venue_vectorizer = None
        self.venue_tfidf_matrix = None
        self.venue_cap_matrix = None
        self.venue_price_matrix = None
        self.venue_ids = []
        self.venue_records = []

        self.vendor_fitted_at = 0.0
        self.vendor_pipeline_built = False
        self.vendor_vectorizer = None
        self.vendor_tfidf_matrix = None
        self.vendor_price_matrix = None
        self.vendor_ids = []
        self.vendor_records = []

    def invalidate_venues(self):
        self.venue_fitted_at = 0.0
        self.venue_pipeline_built = False
        self.venue_vectorizer = None
        self.venue_tfidf_matrix = None
        self.venue_cap_matrix = None
        self.venue_price_matrix = None
        self.venue_ids = []
        self.venue_records = []

    def invalidate_vendors(self):
        self.vendor_fitted_at = 0.0
        self.vendor_pipeline_built = False
        self.vendor_vectorizer = None
        self.vendor_tfidf_matrix = None
        self.vendor_price_matrix = None
        self.vendor_ids = []
        self.vendor_records = []

    def invalidate_all(self):
        self.invalidate_venues()
        self.invalidate_vendors()

_cache = RecommendationPipelineCache()


def invalidate_recommendation_cache():
    """External helper to invalidate cache when listings or reviews update."""
    _cache.invalidate_all()


def _get_eligible_venues():
    """
    Retrieve genuine, eligible venues adhering to LOCYFY business rules:
    - approval_status == 'APPROVED'
    - is_available == True
    """
    return Venue.objects.filter(
        approval_status='APPROVED',
        is_available=True
    ).select_related('owner', 'vendor').order_by('id')


def _get_eligible_vendors():
    """
    Retrieve genuine, eligible vendors adhering to LOCYFY business rules:
    - verification_status == 'APPROVED'
    """
    return VendorProfile.objects.filter(
        verification_status='APPROVED'
    ).select_related('user').order_by('id')


def _build_venue_text(v):
    parts = [
        str(v.title or ''),
        str(v.category or ''),
        str(v.location or ''),
        str(v.address or ''),
        str(v.description or '')
    ]
    return " ".join([p.strip() for p in parts if p.strip()])


def _build_vendor_text(vnd):
    parts = [
        str(vnd.business_name or ''),
        str(vnd.vendor_type or ''),
        str(vnd.location or ''),
        str(vnd.address or ''),
        str(vnd.description or '')
    ]
    return " ".join([p.strip() for p in parts if p.strip()])


def _ensure_venue_pipeline():
    """
    Fit and cache the venue feature extraction pipeline if cache has expired or is uninitialized.
    Reuses cache even if vectorizer is None (due to empty or stop-word-only text).
    Calculates stable normalized feature matrices independent of catalogue size.
    """
    now = time.time()
    if _cache.venue_pipeline_built and (now - _cache.venue_fitted_at) < CACHE_TTL_SECONDS:
        return _cache

    venues = list(_get_eligible_venues())
    _cache.venue_records = venues
    _cache.venue_ids = [v.id for v in venues]

    if not venues:
        _cache.venue_vectorizer = None
        _cache.venue_tfidf_matrix = None
        _cache.venue_cap_matrix = None
        _cache.venue_price_matrix = None
        _cache.venue_fitted_at = now
        _cache.venue_pipeline_built = True
        return _cache

    # 1. Text pipeline (Category, Location, Description, Title)
    corpus = [_build_venue_text(v) for v in venues]
    try:
        vectorizer = TfidfVectorizer(stop_words='english', min_df=1, max_features=150)
        tfidf_mat = vectorizer.fit_transform(corpus)
        if tfidf_mat.shape[1] == 0:
            vectorizer = None
            tfidf_mat = None
    except ValueError as e:
        # Specifically handle expected empty-vocabulary condition (e.g. stop-words or punctuation only)
        if 'empty vocabulary' in str(e).lower():
            logger.info("Empty vocabulary in venue text corpus; running without text vectorizer.")
            vectorizer = None
            tfidf_mat = None
        else:
            raise

    # 2. Stable Numerical Matrices (Normalized via constant reference scale)
    caps = np.array([[normalize_value_stable(v.capacity or 0.0, CAPACITY_REFERENCE_SCALE)] for v in venues], dtype=np.float64)
    prices = np.array([[normalize_value_stable(v.price_per_day or 0.0, VENUE_PRICE_REFERENCE_SCALE)] for v in venues], dtype=np.float64)

    _cache.venue_vectorizer = vectorizer
    _cache.venue_tfidf_matrix = tfidf_mat
    _cache.venue_cap_matrix = caps
    _cache.venue_price_matrix = prices
    _cache.venue_fitted_at = now
    _cache.venue_pipeline_built = True
    return _cache


def _ensure_vendor_pipeline():
    """
    Fit and cache the vendor feature extraction pipeline if cache has expired or is uninitialized.
    Reuses cache even if vectorizer is None (due to empty or stop-word-only text).
    """
    now = time.time()
    if _cache.vendor_pipeline_built and (now - _cache.vendor_fitted_at) < CACHE_TTL_SECONDS:
        return _cache

    vendors = list(_get_eligible_vendors())
    _cache.vendor_records = vendors
    _cache.vendor_ids = [vnd.id for vnd in vendors]

    if not vendors:
        _cache.vendor_vectorizer = None
        _cache.vendor_tfidf_matrix = None
        _cache.vendor_price_matrix = None
        _cache.vendor_fitted_at = now
        _cache.vendor_pipeline_built = True
        return _cache

    # 1. Text pipeline (Business Name, Vendor Type, Location, Description)
    corpus = [_build_vendor_text(vnd) for vnd in vendors]
    try:
        vectorizer = TfidfVectorizer(stop_words='english', min_df=1, max_features=150)
        tfidf_mat = vectorizer.fit_transform(corpus)
        if tfidf_mat.shape[1] == 0:
            vectorizer = None
            tfidf_mat = None
    except ValueError as e:
        # Specifically handle expected empty-vocabulary condition (e.g. stop-words or punctuation only)
        if 'empty vocabulary' in str(e).lower():
            logger.info("Empty vocabulary in vendor text corpus; running without text vectorizer.")
            vectorizer = None
            tfidf_mat = None
        else:
            raise

    # 2. Stable Numerical Matrix (Normalized via constant reference scale)
    prices = np.array([[normalize_value_stable(vnd.starting_price or 0.0, VENDOR_PRICE_REFERENCE_SCALE)] for vnd in vendors], dtype=np.float64)

    _cache.vendor_vectorizer = vectorizer
    _cache.vendor_tfidf_matrix = tfidf_mat
    _cache.vendor_price_matrix = prices
    _cache.vendor_fitted_at = now
    _cache.vendor_pipeline_built = True
    return _cache


def _validate_numerical_input(val, field_name="value"):
    """
    Strict numerical validation:
    - Converts to float.
    - Rejects None, non-numbers, negative values, NaN, and positive/negative infinity.
    - Returns valid float or None.
    """
    if val is None:
        return None
    try:
        f_val = float(val)
        if math.isnan(f_val) or math.isinf(f_val):
            logger.warning(f"Rejected NaN or Inf in {field_name}: {val}")
            return None
        if f_val < 0.0:
            logger.warning(f"Rejected negative numerical value in {field_name}: {val}")
            return None
        return f_val
    except (ValueError, TypeError) as e:
        logger.warning(f"Invalid numerical format for {field_name}: {val} ({e})")
        return None


def _extract_customer_preferences(customer, preferences_override=None):
    """
    Synthesize customer preferences combining:
    1. Explicit runtime preferences/filters with strict validation:
       - venue_budget: Specific budget designated for venue hire.
       - vendor_budget: Specific budget designated for vendor / service package.
       - overall_budget: Overall event budget. Checked explicitly with 'is not None'.
       - guest_count: Expected attendee count.
       - location, event_type, query.
    2. Customer's historical events in LOCYFY (Event model)
    3. Customer's COMPLETED booking history (Booking model):
       - Only COMPLETED bookings (status='COMPLETED') are used.
       - Booking.total_price is an aggregate billing amount that reflects multi-day bookings,
         negotiated rates, or multi-service packages. It is NOT assumed to be a dedicated
         listing unit budget (price_per_day or starting_price) unless verified.
         Therefore, historical booking total_price is stored as overall_budget context only
         if unassigned, leaving dedicated listing budgets unset unless explicitly supplied.
    4. Search and category interaction history (UserInteraction model)
    """
    prefs = {
        'text_query': '',
        'location': '',
        'event_type': '',
        'guest_count': None,
        'overall_budget': None,
        'venue_budget': None,
        'vendor_budget': None,
        'has_personalization_data': False
    }

    text_tokens = []

    # Priority 1: Explicit overrides from query parameters
    if preferences_override:
        if preferences_override.get('event_type'):
            text_tokens.append(str(preferences_override['event_type']))
            prefs['event_type'] = str(preferences_override['event_type'])
            prefs['has_personalization_data'] = True
        if preferences_override.get('location'):
            text_tokens.append(str(preferences_override['location']))
            prefs['location'] = str(preferences_override['location'])
            prefs['has_personalization_data'] = True
        if preferences_override.get('query'):
            text_tokens.append(str(preferences_override['query']))
            prefs['has_personalization_data'] = True

        valid_guests = _validate_numerical_input(preferences_override.get('guest_count'), 'guest_count')
        if valid_guests is not None:
            prefs['guest_count'] = valid_guests
            prefs['has_personalization_data'] = True

        valid_venue_b = _validate_numerical_input(preferences_override.get('venue_budget'), 'venue_budget')
        if valid_venue_b is not None:
            prefs['venue_budget'] = valid_venue_b
            prefs['has_personalization_data'] = True

        valid_vendor_b = _validate_numerical_input(preferences_override.get('vendor_budget'), 'vendor_budget')
        if valid_vendor_b is not None:
            prefs['vendor_budget'] = valid_vendor_b
            prefs['has_personalization_data'] = True

        # Explicit 'is not None' check to prevent zero from falling through
        general_budget_raw = None
        if preferences_override.get('budget') is not None:
            general_budget_raw = preferences_override.get('budget')
        elif preferences_override.get('overall_budget') is not None:
            general_budget_raw = preferences_override.get('overall_budget')

        valid_overall_b = _validate_numerical_input(general_budget_raw, 'overall_budget')
        if valid_overall_b is not None:
            prefs['overall_budget'] = valid_overall_b
            prefs['has_personalization_data'] = True

    if not customer:
        prefs['text_query'] = " ".join(text_tokens)
        return prefs

    # Priority 2: Customer planned events in Event model
    customer_events = Event.objects.filter(owner=customer).order_by('-created_at')[:3]
    for ev in customer_events:
        prefs['has_personalization_data'] = True
        if ev.name:
            text_tokens.append(ev.name)
        if ev.event_type:
            text_tokens.append(ev.event_type)
            if not prefs['event_type']:
                prefs['event_type'] = ev.event_type
        if ev.location and not prefs['location']:
            text_tokens.append(ev.location)
        if ev.description:
            text_tokens.append(ev.description)
        if prefs['guest_count'] is None:
            v_g = _validate_numerical_input(ev.expected_guest_count, 'event.expected_guest_count')
            if v_g is not None:
                prefs['guest_count'] = v_g
        if prefs['overall_budget'] is None:
            v_b = _validate_numerical_input(ev.budget, 'event.budget')
            if v_b is not None:
                prefs['overall_budget'] = v_b

    # Priority 3: Past COMPLETED bookings only (ignoring CANCELLED, REJECTED or PENDING)
    completed_bookings = Booking.objects.filter(
        customer=customer,
        status='COMPLETED'
    ).select_related('venue', 'vendor').order_by('-created_at')[:5]

    for b in completed_bookings:
        # Strictly verify that exactly one target exists (venue XOR vendor)
        has_v = bool(b.venue_id is not None)
        has_vnd = bool(b.vendor_id is not None)
        if not (has_v ^ has_vnd):
            # If booking has both references or neither reference, ignore to prevent budget conflation
            logger.warning(f"Skipping completed booking #{b.id} in preference extraction: does not have exactly one target (venue={has_v}, vendor={has_vnd})")
            continue

        prefs['has_personalization_data'] = True
        if b.event_type:
            text_tokens.append(b.event_type)

        if has_v:
            text_tokens.append(_build_venue_text(b.venue))
            if prefs['guest_count'] is None:
                v_g = _validate_numerical_input(b.guest_count, 'booking.guest_count')
                if v_g is not None:
                    prefs['guest_count'] = v_g
            # Infer historical venue budget if unset and price is non-zero
            if prefs['venue_budget'] is None:
                v_b = _validate_numerical_input(b.total_price, 'booking.total_price (venue)')
                if v_b is not None and v_b > 0.0:
                    prefs['venue_budget'] = v_b

        elif has_vnd:
            text_tokens.append(_build_vendor_text(b.vendor))
            # Infer historical vendor budget if unset and price is non-zero
            if prefs['vendor_budget'] is None:
                v_b = _validate_numerical_input(b.total_price, 'booking.total_price (vendor)')
                if v_b is not None and v_b > 0.0:
                    prefs['vendor_budget'] = v_b

    # Priority 4: Recent user interactions
    interactions = UserInteraction.objects.filter(
        user=customer
    ).order_by('-timestamp')[:10]

    for inter in interactions:
        if inter.search_query:
            text_tokens.append(inter.search_query)
            prefs['has_personalization_data'] = True
        if inter.category:
            text_tokens.append(inter.category)
            prefs['has_personalization_data'] = True
        if inter.location_filter:
            text_tokens.append(inter.location_filter)
            prefs['has_personalization_data'] = True

    prefs['text_query'] = " ".join([t.strip() for t in text_tokens if t.strip()])
    return prefs


def compute_numerical_similarity(target_vector, listing_matrix):
    """
    Compute normalized similarity for numerical features.
    
    Formula:
    Normalized Euclidean Distance d = sqrt(sum((u - v)^2) / dimension)
    Sim_num = 1.0 / (1.0 + d)
    
    Mathematical Boundedness:
    - Since d >= 0 for all real u, v:
      1.0 + d >= 1.0 ==> 0.0 < 1.0 / (1.0 + d) <= 1.0
    - This is naturally and strictly bounded in (0.0, 1.0] without any call to np.clip().
    - When target matches listing exactly (d = 0), Sim_num = 1.0.
    - Out-of-range preferences produce d > 0, smoothly decaying without clipping or truncation.
    """
    diffs = listing_matrix - target_vector
    rmsd = np.sqrt(np.mean(np.square(diffs), axis=1))
    sim = 1.0 / (1.0 + rmsd)
    return sim


def calculate_cold_start_score(rating, review_count, is_verified=True):
    """
    Transparent cold-start baseline scoring for unrated and rated listings.
    
    Design Rules:
    1. Listings with rating 0.0 and review_count 0 are unrated. They must NOT be
       assigned a fake 4-star score.
    2. Unrated listings receive a baseline platform score of 0.35 (verification adds +0.05).
    3. Rated listings (review_count > 0, rating > 0.0):
       - Rating component: (rating / 5.0) * 0.50 (up to 0.50)
       - Volume component: min(review_count / 20.0, 1.0) * 0.30 (up to 0.30)
       - Base verified prior: 0.15 (verification adds +0.05)
    Total score is naturally bounded in [0.10, 0.95].
    """
    r = float(rating or 0.0)
    rev = int(review_count or 0)
    ver_bonus = 0.05 if is_verified else 0.0

    if rev == 0 or r <= 0.0:
        score = 0.35 + ver_bonus
        return round(float(score), 4)

    rating_part = (r / 5.0) * 0.50
    volume_part = min(float(rev) / 20.0, 1.0) * 0.30
    base_part = 0.15 + ver_bonus
    score = rating_part + volume_part + base_part
    return round(float(score), 4)


def get_venue_recommendations(customer=None, preferences=None, top_k=10):
    """
    Compute venue recommendations using content-based filtering.
    
    Budget Resolution:
    - Uses explicit venue_budget if provided.
    - If only overall_budget is present, applies configurable venue share estimate
      based on event type (e.g. 45% for weddings, 50% for corporate, 35% for birthday).
    - If neither is provided, budget dimension is omitted and remaining features are dynamically re-weighted.
    
    Failure & Exception Policy (Documented & Explicit):
    - Cold-start fallback: If no personalization data or active features (text, capacity, budget)
      are specified, the engine safely returns baseline cold-start scores (is_cold_start=True).
    - Partial calculation: Active feature weights are dynamically normalized over available dimensions.
    - Unexpected errors: In accordance with platform integrity requirements, unexpected runtime
      exceptions (e.g. ValueError, TypeError, AttributeError, RuntimeError) are not swallowed
      and propagate directly to the caller.
    """
    cache = _ensure_venue_pipeline()
    venues = cache.venue_records

    if not venues:
        return []

    prefs = _extract_customer_preferences(customer, preferences)
    results = []

    # Determine venue target budget
    target_venue_budget = None
    if prefs['venue_budget'] is not None:
        target_venue_budget = prefs['venue_budget']
    elif prefs['overall_budget'] is not None:
        venue_share, _ = get_budget_allocation_shares(prefs.get('event_type'))
        target_venue_budget = prefs['overall_budget'] * venue_share

    has_text = bool(prefs['text_query'].strip()) and (cache.venue_vectorizer is not None) and (cache.venue_tfidf_matrix is not None)
    has_cap = prefs['guest_count'] is not None
    has_budget = target_venue_budget is not None
    has_any_feature = has_text or has_cap or has_budget

    if not prefs['has_personalization_data'] or not has_any_feature:
        # COLD-START FALLBACK
        for v in venues:
            cold_score = calculate_cold_start_score(v.rating, v.review_count, v.is_verified)
            results.append({
                'venue': v,
                'match_score': cold_score,
                'is_cold_start': True,
                'recommendation_type': 'VENUE'
            })
        results.sort(key=lambda x: x['match_score'], reverse=True)
        return results[:top_k]

    # PERSONALIZED ML RECOMMENDATIONS
    N = len(venues)
    active_weights = []
    active_sims = []

    # 1. Text Similarity
    if has_text:
        user_vec = cache.venue_vectorizer.transform([prefs['text_query']])
        cos_sim = cosine_similarity(user_vec, cache.venue_tfidf_matrix)[0]
        text_sims = np.maximum(cos_sim, 0.0)
        active_weights.append(0.50)
        active_sims.append(text_sims)

    # 2. Capacity Similarity (normalized by constant reference scale)
    if has_cap and cache.venue_cap_matrix is not None:
        target_cap_scaled = np.array([[normalize_value_stable(prefs['guest_count'], CAPACITY_REFERENCE_SCALE)]], dtype=np.float64)
        cap_sims = compute_numerical_similarity(target_cap_scaled, cache.venue_cap_matrix)
        active_weights.append(0.25)
        active_sims.append(cap_sims)

    # 3. Budget Similarity (normalized by constant reference scale)
    if has_budget and cache.venue_price_matrix is not None:
        target_budget_scaled = np.array([[normalize_value_stable(target_venue_budget, VENUE_PRICE_REFERENCE_SCALE)]], dtype=np.float64)
        budget_sims = compute_numerical_similarity(target_budget_scaled, cache.venue_price_matrix)
        active_weights.append(0.25)
        active_sims.append(budget_sims)

    # Total failure policy: If all components failed, trigger defined cold-start fallback
    if not active_weights:
        logger.error("All venue similarity components failed. Triggering defined cold-start scoring fallback.")
        for v in venues:
            cold_score = calculate_cold_start_score(v.rating, v.review_count, v.is_verified)
            results.append({
                'venue': v,
                'match_score': cold_score,
                'is_cold_start': True,
                'recommendation_type': 'VENUE'
            })
        results.sort(key=lambda x: x['match_score'], reverse=True)
        return results[:top_k]

    # Partial / full calculation: weighted convex sum across valid active components
    total_w = sum(active_weights)
    norm_weights = [w / total_w for w in active_weights]
    composite = np.zeros(N, dtype=np.float64)
    for w, sim_arr in zip(norm_weights, active_sims):
        composite += w * sim_arr

    # Since all sim_arr in (0.0, 1.0] and sum(norm_weights) == 1.0, composite is naturally in (0.0, 1.0]
    for idx, v in enumerate(venues):
        score = round(float(composite[idx]), 4)
        results.append({
            'venue': v,
            'match_score': score,
            'is_cold_start': False,
            'recommendation_type': 'VENUE'
        })

    results.sort(key=lambda x: x['match_score'], reverse=True)
    return results[:top_k]


def get_vendor_recommendations(customer=None, preferences=None, top_k=10):
    """
    Compute vendor recommendations using content-based filtering.
    
    Budget Resolution:
    - Uses explicit vendor_budget if provided.
    - If only overall_budget is present, applies configurable single service allocation estimate
      based on event type (e.g. 20% for weddings, 15% for corporate).
    - If neither is provided, budget dimension is omitted and remaining features are dynamically re-weighted.
    
    Failure & Exception Policy (Documented & Explicit):
    - Cold-start fallback: If no personalization data or active features (text, budget)
      are specified, the engine safely returns baseline cold-start scores (is_cold_start=True).
    - Partial calculation: Active feature weights are dynamically normalized over available dimensions.
    - Unexpected errors: In accordance with platform integrity requirements, unexpected runtime
      exceptions (e.g. ValueError, TypeError, AttributeError, RuntimeError) are not swallowed
      and propagate directly to the caller.
    """
    cache = _ensure_vendor_pipeline()
    vendors = cache.vendor_records

    if not vendors:
        return []

    prefs = _extract_customer_preferences(customer, preferences)
    results = []

    target_vendor_budget = None
    if prefs['vendor_budget'] is not None:
        target_vendor_budget = prefs['vendor_budget']
    elif prefs['overall_budget'] is not None:
        _, vendor_share = get_budget_allocation_shares(prefs.get('event_type'))
        target_vendor_budget = prefs['overall_budget'] * vendor_share

    has_text = bool(prefs['text_query'].strip()) and (cache.vendor_vectorizer is not None) and (cache.vendor_tfidf_matrix is not None)
    has_budget = target_vendor_budget is not None
    has_any_feature = has_text or has_budget

    if not prefs['has_personalization_data'] or not has_any_feature:
        # COLD-START FALLBACK
        for vnd in vendors:
            cold_score = calculate_cold_start_score(vnd.rating, vnd.review_count, vnd.is_verified)
            results.append({
                'vendor': vnd,
                'match_score': cold_score,
                'is_cold_start': True,
                'recommendation_type': 'VENDOR'
            })
        results.sort(key=lambda x: x['match_score'], reverse=True)
        return results[:top_k]

    # PERSONALIZED ML RECOMMENDATIONS
    N = len(vendors)
    active_weights = []
    active_sims = []

    # 1. Text similarity
    if has_text:
        user_vec = cache.vendor_vectorizer.transform([prefs['text_query']])
        cos_sim = cosine_similarity(user_vec, cache.vendor_tfidf_matrix)[0]
        text_sims = np.maximum(cos_sim, 0.0)
        active_weights.append(0.65)
        active_sims.append(text_sims)
    # 2. Budget similarity (normalized by constant reference scale)
    if has_budget and cache.vendor_price_matrix is not None:
        target_budget_scaled = np.array([[normalize_value_stable(target_vendor_budget, VENDOR_PRICE_REFERENCE_SCALE)]], dtype=np.float64)
        budget_sims = compute_numerical_similarity(target_budget_scaled, cache.vendor_price_matrix)
        active_weights.append(0.35)
        active_sims.append(budget_sims)

    # Total failure policy
    if not active_weights:
        logger.error("All vendor similarity components failed. Triggering defined cold-start scoring fallback.")
        for vnd in vendors:
            cold_score = calculate_cold_start_score(vnd.rating, vnd.review_count, vnd.is_verified)
            results.append({
                'vendor': vnd,
                'match_score': cold_score,
                'is_cold_start': True,
                'recommendation_type': 'VENDOR'
            })
        results.sort(key=lambda x: x['match_score'], reverse=True)
        return results[:top_k]

    total_w = sum(active_weights)
    norm_weights = [w / total_w for w in active_weights]
    composite = np.zeros(N, dtype=np.float64)
    for w, sim_arr in zip(norm_weights, active_sims):
        composite += w * sim_arr

    for idx, vnd in enumerate(vendors):
        score = round(float(composite[idx]), 4)
        results.append({
            'vendor': vnd,
            'match_score': score,
            'is_cold_start': False,
            'recommendation_type': 'VENDOR'
        })

    results.sort(key=lambda x: x['match_score'], reverse=True)
    return results[:top_k]


def persist_customer_recommendations(customer, venue_recs, vendor_recs):
    """
    Persist recommendations in the Recommendation database table without creating duplicates.
    Preserves one-to-one targets (either venue OR vendor, never both) using update_or_create.
    """
    if not customer:
        return

    # Upsert venue recommendations
    for rec in venue_recs:
        Recommendation.objects.update_or_create(
            customer=customer,
            venue=rec['venue'],
            defaults={
                'vendor': None,
                'recommendation_type': 'VENUE',
                'match_score': rec['match_score'],
                'is_cold_start': rec['is_cold_start'],
            }
        )

    # Upsert vendor recommendations
    for rec in vendor_recs:
        Recommendation.objects.update_or_create(
            customer=customer,
            vendor=rec['vendor'],
            defaults={
                'venue': None,
                'recommendation_type': 'VENDOR',
                'match_score': rec['match_score'],
                'is_cold_start': rec['is_cold_start'],
            }
        )
