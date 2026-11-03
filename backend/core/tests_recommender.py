import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import User, Venue, VendorProfile, Recommendation
from core.ml.recommender import (
    get_venue_recommendations,
    get_vendor_recommendations,
    invalidate_recommendation_cache
)

def run_recommender_tests():
    print("==================================================")
    print("STAGE 2: TESTING RECOMMENDER ENGINE ON DATABASE")
    print("==================================================")
    invalidate_recommendation_cache()

    # 1. Inspect Eligible Listings (Real PostgreSQL data)
    eligible_venues = Venue.objects.filter(approval_status='APPROVED', is_available=True)
    eligible_vendors = VendorProfile.objects.filter(verification_status='APPROVED')
    print(f"\n1. Eligible Records Found in Database:")
    print(f"   - Eligible Venues: {eligible_venues.count()}")
    for v in eligible_venues:
        print(f"     * Venue ID #{v.id}: '{v.title}' | Category: {v.category} | Loc: {v.location} | Cap: {v.capacity} | Price: KES {v.price_per_day} | Rating: {v.rating} | Reviews: {v.review_count}")

    print(f"   - Eligible Vendors: {eligible_vendors.count()}")
    for vnd in eligible_vendors:
        print(f"     * Vendor ID #{vnd.id}: '{vnd.business_name}' | Type: {vnd.vendor_type} | Loc: {vnd.location} | Price: KES {vnd.starting_price} | Rating: {vnd.rating} | Reviews: {vnd.review_count}")

    # 2. Test Transparent Cold-Start for Customer with No History or Filters (customer=None guarantees deterministic test)
    print(f"\n2. Testing Deterministic Cold-Start Scoring (customer=None):")
    cold_venues = get_venue_recommendations(customer=None, preferences=None)
    cold_vendors = get_vendor_recommendations(customer=None, preferences=None)
    
    print(f"   Cold-Start Venues count: {len(cold_venues)}")
    for r in cold_venues:
        print(f"     * {r['venue'].title} -> Score: {r['match_score']} | is_cold_start: {r['is_cold_start']}")
        assert 0.0 <= r['match_score'] <= 1.0, "Score must be bounded in [0, 1]"
        assert r['is_cold_start'] is True, "Must be flagged as cold start"
        # Since unrated venues have rating 0.0, review_count 0 and is_verified True: 0.35 + 0.05 = 0.40
        assert r['match_score'] == 0.40, f"Expected 0.40 for unrated verified listing, got {r['match_score']}"

    print(f"   Cold-Start Vendors count: {len(cold_vendors)}")
    for r in cold_vendors:
        print(f"     * {r['vendor'].business_name} -> Score: {r['match_score']} | is_cold_start: {r['is_cold_start']}")
        assert 0.0 <= r['match_score'] <= 1.0, "Score must be bounded in [0, 1]"
        assert r['is_cold_start'] is True, "Must be flagged as cold start"
        assert r['match_score'] == 0.40

    # 3. Test Venue Recommendation with Single Numerical Dimension (Capacity Only: guest_count=290, no budget, no text)
    print(f"\n3. Testing Single Numerical Dimension (Capacity Only: guest_count=290, no budget, no text):")
    cap_only_prefs = {'guest_count': 290}
    cap_recs = get_venue_recommendations(customer=None, preferences=cap_only_prefs)
    for r in cap_recs:
        print(f"     * {r['venue'].title} (Cap: {r['venue'].capacity}) -> Score: {r['match_score']}")
        assert 0.0 <= r['match_score'] <= 1.0
        assert r['is_cold_start'] is False
    # Catering capacity is 300 (diff=10), Decoration capacity is 218 (diff=72). Catering must rank first.
    assert cap_recs[0]['venue'].title == 'Catering', "Venue with capacity closest to 290 should rank #1"

    # 4. Test Separate Venue Budget vs Overall Budget
    print(f"\n4. Testing Venue Budget Disambiguation (venue_budget vs overall_budget):")
    # Venue budget specified directly as 250,000 -> Catering is 210,000, Decoration is 3,000,000
    venue_budget_prefs = {'venue_budget': 250000}
    vb_recs = get_venue_recommendations(customer=None, preferences=venue_budget_prefs)
    print(f"   With venue_budget=250,000 -> #1 Venue: {vb_recs[0]['venue'].title} (Price: KES {vb_recs[0]['venue'].price_per_day}) Score: {vb_recs[0]['match_score']}")
    assert vb_recs[0]['venue'].title == 'Catering', "Catering (210,000) is closest to venue_budget 250,000"

    # Overall event budget of 5,000,000 -> 45% venue allocation is 2,250,000 -> Decoration (3,000,000) is closer than Catering (210,000)
    overall_budget_prefs = {'overall_budget': 5000000}
    ob_recs = get_venue_recommendations(customer=None, preferences=overall_budget_prefs)
    print(f"   With overall_budget=5,000,000 (est. venue share 2.25M) -> #1 Venue: {ob_recs[0]['venue'].title} (Price: KES {ob_recs[0]['venue'].price_per_day}) Score: {ob_recs[0]['match_score']}")
    assert ob_recs[0]['venue'].title == 'Decoration'

    # 5. Test Full Content-Based Recommendations with Preferences
    print(f"\n5. Testing Content-Based Venue Recommendation (Preference: 'Catering in Nyeri'):")
    nyeri_prefs = {'event_type': 'CATERING', 'location': 'Nyeri', 'guest_count': 280, 'venue_budget': 250000}
    nyeri_recs = get_venue_recommendations(customer=None, preferences=nyeri_prefs)
    for r in nyeri_recs:
        print(f"     * {r['venue'].title} (Loc: {r['venue'].location}) -> Score: {r['match_score']} | is_cold_start: {r['is_cold_start']}")
        assert 0.0 <= r['match_score'] <= 1.0
        assert r['is_cold_start'] is False

    assert nyeri_recs[0]['venue'].title == 'Catering', "Expected Catering venue to be ranked #1"

    print(f"\n6. Testing Vendor Content-Based Filtering (Query: 'jane services', vendor_budget: 210000):")
    vendor_prefs = {'query': "jane's Business Event Services", 'vendor_budget': 210000}
    vendor_recs = get_vendor_recommendations(customer=None, preferences=vendor_prefs)
    for r in vendor_recs:
        print(f"     * {r['vendor'].business_name} -> Score: {r['match_score']} | is_cold_start: {r['is_cold_start']}")
        assert 0.0 <= r['match_score'] <= 1.0
        assert r['is_cold_start'] is False

    assert vendor_recs[0]['vendor'].business_name == "jane's Business"

    print("\nSTAGE 2 DETERMINISTIC READ-ONLY RECOMMENDER TESTS PASSED WITHOUT TOUCHING DB!")
    print("==================================================")

if __name__ == '__main__':
    run_recommender_tests()
