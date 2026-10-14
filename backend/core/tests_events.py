from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from core.models import Event
import datetime

User = get_user_model()

class EventModule1Tests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username='faith_customer',
            email='faith@example.com',
            password='testpassword123',
            first_name='Faith',
            last_name='Wekesa',
            role='CUSTOMER'
        )
        self.user2 = User.objects.create_user(
            username='other_customer',
            email='other@example.com',
            password='testpassword123',
            first_name='John',
            last_name='Doe',
            role='CUSTOMER'
        )

        self.event1 = Event.objects.create(
            owner=self.user1,
            name='My Graduation Party',
            event_type='Graduation',
            date=datetime.date(2026, 11, 21),
            location='Nyeri, Kenya',
            expected_guest_count=80,
            budget=60000.00,
            description='A celebration to mark a new chapter.'
        )

    def test_customer_can_list_own_events_authenticated(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.get('/api/events/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data if isinstance(res.data, list) else res.data.get('results', [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], 'My Graduation Party')

    def test_customer_can_list_own_events_by_query_param(self):
        res = self.client.get(f'/api/events/?user={self.user1.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data if isinstance(res.data, list) else res.data.get('results', [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], 'My Graduation Party')

    def test_customer_cannot_see_other_customer_events(self):
        self.client.force_authenticate(user=self.user2)
        res = self.client.get('/api/events/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data if isinstance(res.data, list) else res.data.get('results', [])
        self.assertEqual(len(results), 0)

    def test_customer_cannot_modify_other_customer_event(self):
        self.client.force_authenticate(user=self.user2)
        res = self.client.patch(f'/api/events/{self.event1.id}/', {'name': 'Hacked Party'})
        self.assertIn(res.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_customer_cannot_delete_other_customer_event(self):
        self.client.force_authenticate(user=self.user2)
        res = self.client.delete(f'/api/events/{self.event1.id}/')
        self.assertIn(res.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_customer_can_create_event_authenticated(self):
        self.client.force_authenticate(user=self.user1)
        payload = {
            'name': 'My Birthday Celebration',
            'event_type': 'Birthday',
            'date': '2026-03-10',
            'location': 'Nairobi, Kenya',
            'expected_guest_count': 50,
            'budget': '40000.00',
            'description': 'A simple and fun birthday party with family and friends.'
        }
        res = self.client.post('/api/events/', payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['name'], 'My Birthday Celebration')
        self.assertEqual(res.data['expected_guest_count'], 50)
        self.assertEqual(float(res.data['budget']), 40000.00)

    def test_customer_can_update_own_event(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.patch(f'/api/events/{self.event1.id}/', {'expected_guest_count': 90})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.event1.refresh_from_db()
        self.assertEqual(self.event1.expected_guest_count, 90)

    def test_customer_can_delete_own_event(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.delete(f'/api/events/{self.event1.id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Event.objects.filter(id=self.event1.id).exists())

    def test_validation_rejects_negative_budget_and_guest_count(self):
        self.client.force_authenticate(user=self.user1)
        payload = {
            'name': 'Invalid Event',
            'event_type': 'Conference',
            'date': '2026-05-15',
            'location': 'Nairobi',
            'expected_guest_count': -5,
            'budget': '-100.00'
        }
        res = self.client.post('/api/events/', payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('expected_guest_count', res.data)
        self.assertIn('budget', res.data)

    def test_validation_rejects_empty_name_and_location(self):
        self.client.force_authenticate(user=self.user1)
        payload = {
            'name': '   ',
            'event_type': '',
            'date': '2026-05-15',
            'location': '   '
        }
        res = self.client.post('/api/events/', payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_customer_can_create_and_manage_manual_event_services(self):
        self.client.force_authenticate(user=self.user1)
        # 1. Create a service manually
        service_data = {
            'event': self.event1.id,
            'name': 'Drone Aerial Photography',
            'category': 'Photography',
            'notes': 'Capture outdoor entrance and garden photoshoot.',
            'estimated_cost': '15000.00',
            'is_completed': False
        }
        res = self.client.post('/api/event-services/', service_data)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        service_id = res.data['id']
        self.assertEqual(res.data['name'], 'Drone Aerial Photography')

        # 2. Verify event list includes services
        event_res = self.client.get(f'/api/events/{self.event1.id}/')
        self.assertEqual(event_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(event_res.data['services']), 1)
        self.assertEqual(event_res.data['services'][0]['name'], 'Drone Aerial Photography')

        # 3. Update service completion status
        patch_res = self.client.patch(f'/api/event-services/{service_id}/', {'is_completed': True})
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertTrue(patch_res.data['is_completed'])

        # 4. User 2 cannot access or delete User 1's event service
        self.client.force_authenticate(user=self.user2)
        unauth_del = self.client.delete(f'/api/event-services/{service_id}/')
        self.assertIn(unauth_del.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

        # 5. User 1 can delete the service
        self.client.force_authenticate(user=self.user1)
        del_res = self.client.delete(f'/api/event-services/{service_id}/')
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)

