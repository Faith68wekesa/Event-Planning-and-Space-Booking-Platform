from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.models import PortfolioImage, Venue, VenueOwnerProfile


User = get_user_model()


class PortfolioImageApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner_user = User.objects.create_user(
            username='portfolio_owner',
            email='portfolio-owner@example.com',
            password='Password123!',
            role='VENUE_OWNER',
            is_venue_owner=True,
        )
        self.owner = VenueOwnerProfile.objects.create(
            user=self.owner_user,
            business_name='Portfolio Venue Owner',
            verification_status='APPROVED',
            is_verified=True,
        )
        self.other_user = User.objects.create_user(
            username='other_portfolio_owner',
            email='other-owner@example.com',
            password='Password123!',
            role='VENUE_OWNER',
            is_venue_owner=True,
        )
        self.other_owner = VenueOwnerProfile.objects.create(
            user=self.other_user,
            business_name='Other Venue Owner',
        )
        self.approved_listing = Venue.objects.create(
            owner=self.owner,
            listing_type='VENUE',
            title='Approved Venue',
            category='WEDDING',
            location='Nyeri County, Kenya',
            capacity=100,
            price_per_day=10000,
            approval_status='APPROVED',
            is_verified=True,
            is_available=True,
        )
        self.pending_listing = Venue.objects.create(
            owner=self.owner,
            listing_type='SERVICE',
            title='Pending Service',
            category='CATERING',
            location='Nyeri County, Kenya',
            capacity=0,
            price_per_day=5000,
            approval_status='PENDING',
        )

    def test_owner_can_add_portfolio_image_to_own_listing(self):
        self.client.force_authenticate(user=self.owner_user)

        response = self.client.post(
            '/api/portfolio-images/',
            {
                'venue': self.approved_listing.id,
                'image_url': 'https://example.com/catering-setup.jpg',
                'caption': 'Reception setup',
                'display_order': 1,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            PortfolioImage.objects.get(venue=self.approved_listing).caption,
            'Reception setup',
        )

        listing_response = self.client.get('/api/venues/my-listings/')
        self.assertEqual(listing_response.status_code, status.HTTP_200_OK)
        listing = next(
            item for item in listing_response.data
            if item['id'] == self.approved_listing.id
        )
        self.assertEqual(len(listing['portfolio']), 1)
        self.assertEqual(listing['portfolio'][0]['caption'], 'Reception setup')

        self.client.force_authenticate(user=None)
        public_portfolio_response = self.client.get('/api/portfolio-images/')
        self.assertEqual(public_portfolio_response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(
            image['venue'] == self.approved_listing.id
            for image in public_portfolio_response.data.get('results', public_portfolio_response.data)
        ))

    def test_provider_cannot_add_portfolio_image_to_another_owners_listing(self):
        self.client.force_authenticate(user=self.other_user)

        response = self.client.post(
            '/api/portfolio-images/',
            {
                'venue': self.approved_listing.id,
                'image_url': 'https://example.com/unauthorized.jpg',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(PortfolioImage.objects.exists())

    def test_provider_cannot_update_or_delete_another_owners_image(self):
        image = PortfolioImage.objects.create(
            venue=self.approved_listing,
            image_url='https://example.com/owner-image.jpg',
            caption='Original caption',
        )
        self.client.force_authenticate(user=self.other_user)

        update_response = self.client.patch(
            f'/api/portfolio-images/{image.id}/',
            {'caption': 'Changed by another owner'},
            format='json',
        )
        delete_response = self.client.delete(f'/api/portfolio-images/{image.id}/')

        self.assertEqual(update_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(delete_response.status_code, status.HTTP_404_NOT_FOUND)
        image.refresh_from_db()
        self.assertEqual(image.caption, 'Original caption')

    def test_public_api_does_not_expose_pending_listing_portfolio(self):
        PortfolioImage.objects.create(
            venue=self.pending_listing,
            image_url='https://example.com/private-pending.jpg',
            caption='Not approved',
        )

        response = self.client.get('/api/venues/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        listing_results = response.data.get('results', response.data)
        self.assertNotIn(
            self.pending_listing.id,
            [listing['id'] for listing in listing_results],
        )

        portfolio_response = self.client.get('/api/portfolio-images/')
        self.assertEqual(portfolio_response.status_code, status.HTTP_200_OK)
        self.assertNotIn(
            self.pending_listing.id,
            [image['venue'] for image in portfolio_response.data.get('results', portfolio_response.data)],
        )
