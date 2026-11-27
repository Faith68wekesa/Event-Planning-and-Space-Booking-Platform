from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Review


User = get_user_model()


class ReviewManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username='review_author',
            email='author@example.com',
            password='Password123!',
            role='CUSTOMER',
        )
        self.other_customer = User.objects.create_user(
            username='other_customer',
            email='other@example.com',
            password='Password123!',
            role='CUSTOMER',
        )
        self.review = Review.objects.create(
            user=self.customer,
            rating=3,
            comment='Original review',
        )

    def test_author_can_edit_rating_and_comment(self):
        response = self.client.patch(
            f'/api/reviews/{self.review.id}/',
            {'rating': 5, 'comment': 'Updated review'},
            format='json',
            HTTP_X_USER_ID=str(self.customer.id),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.review.refresh_from_db()
        self.assertEqual(self.review.rating, 5)
        self.assertEqual(self.review.comment, 'Updated review')

    def test_other_customer_cannot_edit_review(self):
        response = self.client.patch(
            f'/api/reviews/{self.review.id}/',
            {'rating': 1},
            format='json',
            HTTP_X_USER_ID=str(self.other_customer.id),
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.review.refresh_from_db()
        self.assertEqual(self.review.rating, 3)

    def test_author_can_delete_review(self):
        response = self.client.delete(
            f'/api/reviews/{self.review.id}/',
            HTTP_X_USER_ID=str(self.customer.id),
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Review.objects.filter(id=self.review.id).exists())
