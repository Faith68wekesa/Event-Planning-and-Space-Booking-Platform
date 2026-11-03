from django.test import TestCase
from core.models import User, Venue, VendorProfile, Recommendation
from core.ml.recommender import (
    get_venue_recommendations,
    get_vendor_recommendations,
    persist_customer_recommendations,
    invalidate_recommendation_cache
)

class IsolatedRecommenderPersistenceTests(TestCase):
    """
    Runs in Django's isolated test database environment.
    Guarantees that no real production or development database records are touched.
    Explicitly invalidates cache in setUp and tearDown for absolute test isolation.
    """
    def setUp(self):
        # Invalidate cache before test so development catalog does not leak in
        invalidate_recommendation_cache()

        # Create genuine customer user in isolated test database
        self.customer = User.objects.create_user(
            username='testcustomer_iso',
            email='testcustomer_iso@locyfy.com',
            password='testpassword123',
            role='CUSTOMER'
        )

        # Create provider user
        self.provider = User.objects.create_user(
            username='testprovider_iso',
            email='testprovider_iso@locyfy.com',
            password='testpassword123',
            role='PROVIDER'
        )

        # Create test venue in isolated database
        self.venue1 = Venue.objects.create(
            owner=None,
            title='Grand Sapphire Ballroom',
            category='BANQUET',
            location='Nairobi CBD',
            capacity=350,
            price_per_day=150000.0,
            approval_status='APPROVED',
            is_available=True,
            rating=4.5,
            review_count=12
        )

        # Create test vendor in isolated database
        self.vendor1 = VendorProfile.objects.create(
            user=self.provider,
            business_name='Savory Catering Services',
            vendor_type='Catering',
            location='Nairobi',
            starting_price=50000.0,
            verification_status='APPROVED',
            rating=4.8,
            review_count=18
        )

    def tearDown(self):
        # Invalidate cache after test so isolated test records do not leak out
        invalidate_recommendation_cache()

    def test_persistence_and_unique_constraints_in_isolated_db(self):
        # Verify test database isolation
        self.assertEqual(User.objects.filter(username='testcustomer_iso').count(), 1)
        self.assertEqual(Recommendation.objects.count(), 0)

        # Run recommendations in isolated environment
        venue_recs = get_venue_recommendations(customer=self.customer, preferences={'guest_count': 300, 'venue_budget': 150000})
        vendor_recs = get_vendor_recommendations(customer=self.customer, preferences={'vendor_budget': 50000})

        # Persist recommendations
        persist_customer_recommendations(self.customer, venue_recs, vendor_recs)
        count_first = Recommendation.objects.filter(customer=self.customer).count()
        self.assertEqual(count_first, 2)

        # Verify fields and constraints
        for r in Recommendation.objects.filter(customer=self.customer):
            self.assertEqual(r.customer, self.customer)
            self.assertTrue(0.0 <= r.match_score <= 1.0)
            self.assertTrue((r.venue is not None) ^ (r.vendor is not None))

        # Re-run and refresh recommendations to confirm duplicate prevention
        persist_customer_recommendations(self.customer, venue_recs, vendor_recs)
        count_second = Recommendation.objects.filter(customer=self.customer).count()
        self.assertEqual(count_second, count_first)
