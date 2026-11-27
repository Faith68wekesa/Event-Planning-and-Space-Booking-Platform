from django.test import TestCase
from rest_framework.test import APIClient

from core.models import User, VendorProfile, VenueOwnerProfile, Venue, VerificationDocument
from core.serializers import VenueSerializer


class BackendAccessControlTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner_user = User.objects.create_user(
            username='access_owner',
            email='access-owner@example.com',
            password='Password123!',
            role='VENUE_OWNER',
            is_venue_owner=True,
        )
        self.other_owner_user = User.objects.create_user(
            username='access_other_owner',
            email='access-other@example.com',
            password='Password123!',
            role='VENUE_OWNER',
            is_venue_owner=True,
        )
        self.vendor_user = User.objects.create_user(
            username='access_vendor',
            email='access-vendor@example.com',
            password='Password123!',
            role='VENDOR',
            is_vendor=True,
        )
        self.customer = User.objects.create_user(
            username='access_customer',
            email='access-customer@example.com',
            password='Password123!',
            role='CUSTOMER',
            is_customer=True,
        )
        self.admin = User.objects.create_user(
            username='access_admin',
            email='access-admin@example.com',
            password='Password123!',
            role='ADMIN',
            is_staff=True,
        )
        self.owner_profile = VenueOwnerProfile.objects.create(
            user=self.owner_user,
            business_name='Unverified Owner',
            contact_email='private@example.com',
        )
        self.other_owner_profile = VenueOwnerProfile.objects.create(
            user=self.other_owner_user,
            business_name='Other Unverified Owner',
        )
        self.vendor_profile = VendorProfile.objects.create(
            user=self.vendor_user,
            business_name='Unverified Vendor',
            vendor_type='Catering',
            contact_email='vendor-private@example.com',
        )
        self.document = VerificationDocument.objects.create(
            user=self.owner_user,
            venue_owner=self.owner_profile,
            document_type='BUSINESS_REGISTRATION',
            title='Private registration',
            file='private-registration.pdf',
            file_name='private-registration.pdf',
        )

    def create_venue(
        self,
        title,
        approval_status,
        owner=None,
        is_available=True,
        location='Nyeri County, Kenya',
    ):
        return Venue.objects.create(
            owner=owner or self.owner_profile,
            title=title,
            category='WEDDING',
            location=location,
            capacity=100,
            price_per_day=10000,
            approval_status=approval_status,
            is_available=is_available,
        )

    def response_items(self, response):
        data = response.data
        return data.get('results', data) if isinstance(data, dict) else data

    def test_venue_serializer_accepts_matching_listing_categories(self):
        base_data = {
            'title': 'Category test',
            'location': 'Nyeri County, Kenya',
            'capacity': 100,
            'price_per_day': '10000',
        }

        service = VenueSerializer(data={
            **base_data,
            'listing_type': 'SERVICE',
            'category': 'PHOTOGRAPHY',
        })
        venue = VenueSerializer(data={
            **base_data,
            'listing_type': 'VENUE',
            'category': 'WEDDING',
        })

        self.assertTrue(service.is_valid(), service.errors)
        self.assertTrue(venue.is_valid(), venue.errors)

    def test_venue_serializer_persists_custom_service_category(self):
        service = VenueSerializer(data={
            'listing_type': 'SERVICE',
            'title': 'Live Streaming Service',
            'category': 'Live Streaming',
            'location': 'Nyeri County, Kenya',
            'capacity': 0,
            'price_per_day': '12000',
        })

        self.assertTrue(service.is_valid(), service.errors)
        saved_service = service.save(vendor=self.vendor_profile)
        self.assertEqual(saved_service.category, 'Live Streaming')
        self.assertEqual(VenueSerializer(saved_service).data['category_display'], 'Live Streaming')

    def test_vendor_can_create_and_view_custom_service_category(self):
        self.client.force_authenticate(user=self.vendor_user)
        response = self.client.post('/api/venues/', {
            'listing_type': 'SERVICE',
            'title': 'Custom Live Streaming',
            'category': 'Live Streaming',
            'location': 'Nyeri County, Kenya',
            'capacity': 0,
            'price_per_day': '12000',
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['category'], 'Live Streaming')
        listing_id = response.data['id']

        listing_response = self.client.get('/api/venues/my-listings/')
        self.assertEqual(listing_response.status_code, 200)
        listing = next(item for item in listing_response.data if item['id'] == listing_id)
        self.assertEqual(listing['category'], 'Live Streaming')
        self.assertEqual(listing['category_display'], 'Live Streaming')
        self.assertTrue(Venue.objects.filter(pk=listing_id, category='Live Streaming').exists())

    def test_venue_serializer_persists_custom_venue_category(self):
        venue = VenueSerializer(data={
            'listing_type': 'VENUE',
            'title': 'Botanical Event Garden',
            'category': 'Botanical Garden',
            'location': 'Nyeri County, Kenya',
            'capacity': 120,
            'price_per_day': '25000',
        })

        self.assertTrue(venue.is_valid(), venue.errors)
        saved_venue = venue.save(owner=self.owner_profile)
        self.assertEqual(saved_venue.category, 'Botanical Garden')
        self.assertEqual(VenueSerializer(saved_venue).data['category_display'], 'Botanical Garden')

    def test_venue_serializer_validates_capacity_by_listing_type(self):
        base_data = {
            'title': 'Capacity test',
            'location': 'Nyeri County, Kenya',
            'price_per_day': '10000',
        }

        # Services may have no specified guest limit.
        service_zero = VenueSerializer(data={
            **base_data,
            'listing_type': 'SERVICE',
            'category': 'PHOTOGRAPHY',
            'capacity': 0,
        })

        # Venues must have a positive guest capacity.
        venue_zero = VenueSerializer(data={
            **base_data,
            'listing_type': 'VENUE',
            'category': 'WEDDING',
            'capacity': 0,
        })

        # Neither listing type may have negative capacity.
        service_negative = VenueSerializer(data={
            **base_data,
            'listing_type': 'SERVICE',
            'category': 'CATERING',
            'capacity': -1,
        })

        venue_negative = VenueSerializer(data={
            **base_data,
            'listing_type': 'VENUE',
            'category': 'WEDDING',
            'capacity': -1,
        })

        self.assertTrue(service_zero.is_valid(), service_zero.errors)

        self.assertFalse(venue_zero.is_valid())
        self.assertIn('capacity', venue_zero.errors)

        self.assertFalse(service_negative.is_valid())
        self.assertIn('capacity', service_negative.errors)

        self.assertFalse(venue_negative.is_valid())
        self.assertIn('capacity', venue_negative.errors)

    def test_venue_serializer_rejects_mismatched_listing_categories(self):
        base_data = {
            'title': 'Category test',
            'location': 'Nyeri County, Kenya',
            'capacity': 100,
            'price_per_day': '10000',
        }

        service = VenueSerializer(data={
            **base_data,
            'listing_type': 'SERVICE',
            'category': 'WEDDING',
        })
        venue = VenueSerializer(data={
            **base_data,
            'listing_type': 'VENUE',
            'category': 'PHOTOGRAPHY',
        })

        self.assertFalse(service.is_valid())
        self.assertFalse(venue.is_valid())
        self.assertIn('category', service.errors)
        self.assertIn('category', venue.errors)

    def test_listing_serializer_requires_nyeri_county_location(self):
        outside_location = VenueSerializer(data={
            'listing_type': 'VENUE',
            'title': 'Nairobi Hall',
            'category': 'WEDDING',
            'location': 'Nairobi, Kenya',
            'capacity': 100,
            'price_per_day': '10000',
        })
        self.assertFalse(outside_location.is_valid())
        self.assertIn('location', outside_location.errors)

        existing_listing = self.create_venue(
            'Existing Nairobi Hall',
            'PENDING',
            location='Nairobi, Kenya',
        )
        unchanged_location = VenueSerializer(
            existing_listing,
            data={'description': 'Updated description'},
            partial=True,
        )
        self.assertFalse(unchanged_location.is_valid())
        self.assertIn('location', unchanged_location.errors)

        relocated_listing = VenueSerializer(
            existing_listing,
            data={'location': 'Nyeri County, Kenya'},
            partial=True,
        )
        self.assertTrue(relocated_listing.is_valid(), relocated_listing.errors)

    def test_venue_serializer_uses_instance_values_for_partial_updates(self):
        venue = self.create_venue('Partial category test', 'PENDING')

        missing_category = VenueSerializer(
            venue,
            data={'listing_type': 'SERVICE'},
            partial=True,
        )
        mismatched_category = VenueSerializer(
            venue,
            data={'category': 'CATERING'},
            partial=True,
        )

        self.assertFalse(missing_category.is_valid())
        self.assertFalse(mismatched_category.is_valid())
        self.assertIn('category', missing_category.errors)
        self.assertIn('category', mismatched_category.errors)

    def test_vendor_profile_writes_are_owner_or_admin_only_and_protected_fields_are_read_only(self):
        url = f'/api/vendors/{self.vendor_profile.pk}/'
        anonymous = self.client.patch(url, {'business_name': 'Changed'})
        self.assertEqual(anonymous.status_code, 401)

        self.client.force_authenticate(user=self.other_owner_user)
        unrelated = self.client.patch(url, {'business_name': 'Changed'})
        unrelated_delete = self.client.delete(url)
        self.assertEqual(unrelated.status_code, 403)
        self.assertEqual(unrelated_delete.status_code, 403)
        self.assertTrue(VendorProfile.objects.filter(pk=self.vendor_profile.pk).exists())

        self.client.force_authenticate(user=self.vendor_user)
        update = self.client.patch(
            url,
            {
                'business_name': 'Updated Vendor',
                'user': self.customer.pk,
                'is_verified': True,
                'verification_status': 'APPROVED',
            },
            format='json',
        )
        self.assertEqual(update.status_code, 200)
        self.vendor_profile.refresh_from_db()
        self.assertEqual(self.vendor_profile.business_name, 'Updated Vendor')
        self.assertEqual(self.vendor_profile.user_id, self.vendor_user.pk)
        self.assertFalse(self.vendor_profile.is_verified)
        self.assertEqual(self.vendor_profile.verification_status, 'PENDING')

        self.client.force_authenticate(user=self.admin)
        admin_update = self.client.patch(
            url,
            {'is_verified': True, 'verification_status': 'APPROVED'},
            format='json',
        )
        self.assertEqual(admin_update.status_code, 200)
        self.vendor_profile.refresh_from_db()
        self.assertTrue(self.vendor_profile.is_verified)
        self.assertEqual(self.vendor_profile.verification_status, 'APPROVED')

    def test_venue_owner_cannot_self_approve_profile(self):
        self.client.force_authenticate(user=self.owner_user)
        response = self.client.patch(
            f'/api/venue-owners/{self.owner_profile.pk}/',
            {'is_verified': True, 'verification_status': 'APPROVED'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.owner_profile.refresh_from_db()
        self.assertFalse(self.owner_profile.is_verified)
        self.assertEqual(self.owner_profile.verification_status, 'PENDING')

    def test_unverified_profiles_cannot_be_requested_through_public_private_filters(self):
        for endpoint in ('/api/vendors/', '/api/venue-owners/'):
            for query in (
                f'?user_id={self.vendor_user.pk}',
                '?all_status=true',
            ):
                response = self.client.get(endpoint + query)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(self.response_items(response), [])

        self.client.force_authenticate(user=self.customer)
        vendor_response = self.client.get(f'/api/vendors/?user_id={self.vendor_user.pk}')
        owner_response = self.client.get(f'/api/venue-owners/?user_id={self.owner_user.pk}')
        self.assertEqual(self.response_items(vendor_response), [])
        self.assertEqual(self.response_items(owner_response), [])

        self.client.force_authenticate(user=self.owner_user)
        own_response = self.client.get('/api/venue-owners/?all_status=true')
        self.assertEqual(
            [profile['id'] for profile in self.response_items(own_response)],
            [self.owner_profile.pk],
        )

    def test_verification_documents_use_only_authenticated_request_user(self):
        unauthenticated = self.client.get(
            f'/api/documents/?user_id={self.owner_user.pk}',
            HTTP_X_USER_ID=str(self.owner_user.pk),
        )
        self.assertEqual(unauthenticated.status_code, 401)

        self.client.force_authenticate(user=self.customer)
        spoofed_list = self.client.get(f'/api/documents/?user_id={self.owner_user.pk}')
        spoofed_download = self.client.get(
            f'/api/documents/{self.document.pk}/download/?user_id={self.owner_user.pk}'
        )
        self.assertEqual(self.response_items(spoofed_list), [])
        self.assertEqual(spoofed_download.status_code, 403)

        self.client.force_authenticate(user=self.owner_user)
        owner_detail = self.client.get(f'/api/documents/{self.document.pk}/')
        self.assertEqual(owner_detail.status_code, 200)

    def test_customers_get_public_venue_catalog_and_providers_get_all_their_listings(self):
        self.owner_profile.is_verified = True
        self.owner_profile.verification_status = 'APPROVED'
        self.owner_profile.save(update_fields=['is_verified', 'verification_status'])
        public_venue = self.create_venue('Public approved venue', 'APPROVED')
        pending_venue = self.create_venue('Owner pending venue', 'PENDING')
        rejected_venue = self.create_venue('Owner rejected venue', 'REJECTED')
        unavailable_venue = self.create_venue(
            'Unavailable venue', 'APPROVED', is_available=False
        )

        self.client.force_authenticate(user=self.customer)
        customer_response = self.client.get('/api/venues/')
        customer_ids = [item['id'] for item in self.response_items(customer_response)]
        self.assertIn(public_venue.pk, customer_ids)
        self.assertNotIn(pending_venue.pk, customer_ids)
        self.assertNotIn(rejected_venue.pk, customer_ids)
        self.assertNotIn(unavailable_venue.pk, customer_ids)

        self.client.force_authenticate(user=self.owner_user)
        provider_response = self.client.get('/api/venues/')
        provider_ids = [item['id'] for item in self.response_items(provider_response)]
        self.assertTrue({public_venue.pk, pending_venue.pk, rejected_venue.pk}.issubset(provider_ids))

    def test_public_catalog_only_shows_venues_and_services_in_nyeri_county(self):
        self.owner_profile.is_verified = True
        self.owner_profile.verification_status = 'APPROVED'
        self.owner_profile.save(update_fields=['is_verified', 'verification_status'])

        nyeri_venue = self.create_venue(
            'Karatina Hall',
            'APPROVED',
            location='Karatina, Nyeri County',
        )
        outside_venue = self.create_venue(
            'Nairobi Hall',
            'APPROVED',
            location='Nairobi, Kenya',
        )
        nyeri_service = Venue.objects.create(
            owner=self.owner_profile,
            listing_type='SERVICE',
            title='Othaya Photography',
            category='PHOTOGRAPHY',
            location='Othaya, Nyeri County',
            capacity=0,
            price_per_day=10000,
            approval_status='APPROVED',
            is_available=True,
        )
        outside_service = Venue.objects.create(
            owner=self.owner_profile,
            listing_type='SERVICE',
            title='Nairobi Photography',
            category='PHOTOGRAPHY',
            location='Nairobi, Kenya',
            capacity=0,
            price_per_day=10000,
            approval_status='APPROVED',
            is_available=True,
        )

        response = self.client.get('/api/venues/')
        listing_ids = {item['id'] for item in self.response_items(response)}

        self.assertIn(nyeri_venue.pk, listing_ids)
        self.assertIn(nyeri_service.pk, listing_ids)
        self.assertNotIn(outside_venue.pk, listing_ids)
        self.assertNotIn(outside_service.pk, listing_ids)

    def test_admin_venue_actions_preserve_listing_status_and_provider_verification(self):
        pending = self.create_venue('Pending venue', 'PENDING')
        rejected = self.create_venue('Rejected venue', 'REJECTED')

        self.client.force_authenticate(user=self.customer)
        self.assertEqual(
            self.client.post(f'/api/venues/{pending.pk}/toggle_verify/').status_code,
            403,
        )

        self.client.force_authenticate(user=self.admin)
        toggle_pending = self.client.post(f'/api/venues/{pending.pk}/toggle_verify/')
        self.assertEqual(toggle_pending.status_code, 200)
        pending.refresh_from_db()
        self.assertEqual(pending.approval_status, 'PENDING')

        toggle_rejected = self.client.post(f'/api/venues/{rejected.pk}/toggle_verify/')
        self.assertEqual(toggle_rejected.status_code, 200)
        rejected.refresh_from_db()
        self.assertEqual(rejected.approval_status, 'REJECTED')

        approve = self.client.post(f'/api/venues/{pending.pk}/approve/')
        self.assertEqual(approve.status_code, 200)
        pending.refresh_from_db()
        self.owner_profile.refresh_from_db()
        self.assertEqual(pending.approval_status, 'APPROVED')
        self.assertFalse(self.owner_profile.is_verified)
        self.assertEqual(self.owner_profile.verification_status, 'PENDING')

    def test_provider_verification_actions_do_not_change_listing_approval_status(self):
        owner_pending = self.create_venue('Owner pending venue', 'PENDING')
        owner_rejected = self.create_venue('Owner rejected venue', 'REJECTED')
        vendor_pending = Venue.objects.create(
            vendor=self.vendor_profile,
            title='Vendor pending venue',
            category='CATERING',
            listing_type='SERVICE',
            location='Nyeri County, Kenya',
            capacity=0,
            price_per_day=10000,
            approval_status='PENDING',
        )
        vendor_rejected = Venue.objects.create(
            vendor=self.vendor_profile,
            title='Vendor rejected venue',
            category='CATERING',
            listing_type='SERVICE',
            location='Nyeri County, Kenya',
            capacity=0,
            price_per_day=10000,
            approval_status='REJECTED',
        )

        self.client.force_authenticate(user=self.admin)
        vendor_toggle = self.client.post(
            f'/api/vendors/{self.vendor_profile.pk}/toggle_verify/'
        )
        owner_toggle = self.client.post(
            f'/api/venue-owners/{self.owner_profile.pk}/toggle_verify/'
        )
        self.assertEqual(vendor_toggle.status_code, 200)
        self.assertEqual(owner_toggle.status_code, 200)

        vendor_set = self.client.post(
            f'/api/vendors/{self.vendor_profile.pk}/set_verification/',
            {'verification_status': 'REJECTED'},
            format='json',
        )
        owner_set = self.client.post(
            f'/api/venue-owners/{self.owner_profile.pk}/set_verification/',
            {'verification_status': 'REJECTED'},
            format='json',
        )
        self.assertEqual(vendor_set.status_code, 200)
        self.assertEqual(owner_set.status_code, 200)

        for venue in (owner_pending, owner_rejected, vendor_pending, vendor_rejected):
            venue.refresh_from_db()
        self.assertEqual(owner_pending.approval_status, 'PENDING')
        self.assertEqual(owner_rejected.approval_status, 'REJECTED')
        self.assertEqual(vendor_pending.approval_status, 'PENDING')
        self.assertEqual(vendor_rejected.approval_status, 'REJECTED')
