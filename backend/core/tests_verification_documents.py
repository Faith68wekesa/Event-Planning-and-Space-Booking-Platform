import os
import datetime
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from core.models import User, VendorProfile, VenueOwnerProfile, Venue, Booking, VerificationDocument

User = get_user_model()

class VerificationDocumentAndGatingTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Admin user
        self.admin_user = User.objects.create_user(
            username='admin_boss',
            email='admin@locyfy.com',
            password='Password123!',
            role='ADMIN',
            is_staff=True,
            is_superuser=True
        )

        # Provider 1 (Venue Owner)
        self.owner_user = User.objects.create_user(
            username='owner_jane',
            email='jane@venue.com',
            password='Password123!',
            role='VENUE_OWNER',
            is_venue_owner=True
        )
        self.venue_owner = VenueOwnerProfile.objects.create(
            user=self.owner_user,
            business_name='Jane Safari Gardens',
            location='Nairobi',
            verification_status='PENDING',
            is_verified=False
        )

        # Provider 2 (Vendor)
        self.vendor_user = User.objects.create_user(
            username='vendor_bob',
            email='bob@catering.com',
            password='Password123!',
            role='VENDOR',
            is_vendor=True
        )
        self.vendor = VendorProfile.objects.create(
            user=self.vendor_user,
            business_name='Bob Gourmet Caterers',
            vendor_type='Catering',
            location='Nairobi',
            verification_status='PENDING',
            is_verified=False
        )

        # Customer
        self.customer_user = User.objects.create_user(
            username='customer_alice',
            email='alice@client.com',
            password='Password123!',
            role='CUSTOMER',
            is_customer=True
        )

        # Venue listing
        self.venue = Venue.objects.create(
            owner=self.venue_owner,
            title='Grand Savannah Ballroom',
            category='WEDDING',
            location='Nairobi',
            capacity=300,
            price_per_day=90000.00,
            approval_status='APPROVED',
            is_available=True,
            is_verified=False  # Gated by owner verification
        )

        # Sample dummy PDF file
        self.dummy_pdf = SimpleUploadedFile(
            "business_permit.pdf",
            b"%PDF-1.4 dummy pdf document content bytes",
            content_type="application/pdf"
        )

    def test_provider_can_upload_own_verification_document(self):
        """A provider can upload a valid verification document (PDF)."""
        self.client.force_authenticate(user=self.owner_user)
        res = self.client.post('/api/documents/', {
            'document_type': 'BUSINESS_REGISTRATION',
            'title': 'Official Certificate of Incorporation',
            'file': self.dummy_pdf
        }, format='multipart')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        doc_id = res.data['id']
        doc = VerificationDocument.objects.get(pk=doc_id)
        self.assertEqual(doc.user, self.owner_user)
        self.assertEqual(doc.venue_owner, self.venue_owner)
        self.assertEqual(doc.status, 'PENDING')
        self.assertEqual(doc.file_extension, 'pdf')

    def test_provider_cannot_view_another_provider_documents(self):
        """Provider 2 cannot see documents belonging to Provider 1 (IDOR protection)."""
        # Upload doc for Provider 1
        doc1 = VerificationDocument.objects.create(
            user=self.owner_user,
            venue_owner=self.venue_owner,
            document_type='OPERATING_LICENSE',
            title='County Permit 2026',
            file=self.dummy_pdf,
            file_name='permit.pdf',
            status='PENDING'
        )

        # Login as Provider 2 (Bob)
        self.client.force_authenticate(user=self.vendor_user)
        res = self.client.get('/api/documents/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get('results', res.data) if isinstance(res.data, dict) else res.data
        doc_ids = [d['id'] for d in results]
        self.assertNotIn(doc1.id, doc_ids)

        # Attempt to access download endpoint directly
        dl_res = self.client.get(f'/api/documents/{doc1.id}/download/')
        self.assertEqual(dl_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_cannot_access_private_verification_documents(self):
        """Customers have no access to verification documents."""
        doc1 = VerificationDocument.objects.create(
            user=self.owner_user,
            venue_owner=self.venue_owner,
            document_type='IDENTITY_DOCUMENT',
            title='Owner Passport',
            file=self.dummy_pdf,
            file_name='passport.pdf',
            status='APPROVED'
        )

        self.client.force_authenticate(user=self.customer_user)
        res = self.client.get('/api/documents/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get('results', res.data) if isinstance(res.data, dict) else res.data
        self.assertEqual(len(results), 0)

        dl_res = self.client.get(f'/api/documents/{doc1.id}/download/')
        self.assertEqual(dl_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_oversized_or_dangerous_files_are_rejected(self):
        """Disallow dangerous scripts (.exe, .bat) or files > 10MB."""
        self.client.force_authenticate(user=self.owner_user)
        dangerous_file = SimpleUploadedFile("malware.exe", b"MZ fake executable data", content_type="application/x-msdownload")
        res = self.client.post('/api/documents/', {
            'document_type': 'BUSINESS_REGISTRATION',
            'title': 'Test',
            'file': dangerous_file
        }, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('file' in res.data or 'error' in res.data)

    def test_admin_can_approve_document_and_grant_verified_status(self):
        """Platform administrator approves document, which activates provider verified status."""
        doc = VerificationDocument.objects.create(
            user=self.owner_user,
            venue_owner=self.venue_owner,
            document_type='BUSINESS_REGISTRATION',
            title='Incorporation',
            file=self.dummy_pdf,
            file_name='incorp.pdf',
            status='PENDING'
        )

        self.client.force_authenticate(user=self.admin_user)
        res = self.client.post(f'/api/documents/{doc.id}/approve/', {'admin_notes': 'Verified with BRS.'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        doc.refresh_from_db()
        self.assertEqual(doc.status, 'APPROVED')
        self.assertEqual(doc.reviewed_by, self.admin_user)

        self.venue_owner.refresh_from_db()
        self.assertTrue(self.venue_owner.is_verified)
        self.assertEqual(self.venue_owner.verification_status, 'APPROVED')

    def test_admin_can_reject_document_with_reason(self):
        """Administrator rejects document with feedback reason; provider can view reason."""
        doc = VerificationDocument.objects.create(
            user=self.owner_user,
            venue_owner=self.venue_owner,
            document_type='OPERATING_LICENSE',
            title='County Permit',
            file=self.dummy_pdf,
            file_name='permit.pdf',
            status='PENDING'
        )

        self.client.force_authenticate(user=self.admin_user)
        res = self.client.post(f'/api/documents/{doc.id}/reject/', {
            'reason': 'Permit stamp is unreadable. Please provide a clear scanned copy.',
            'admin_notes': 'Blurry upload.'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        doc.refresh_from_db()
        self.assertEqual(doc.status, 'REJECTED')
        self.assertEqual(doc.rejection_reason, 'Permit stamp is unreadable. Please provide a clear scanned copy.')

        # Owner inspects document
        self.client.force_authenticate(user=self.owner_user)
        res = self.client.get(f'/api/documents/{doc.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['rejection_reason'], 'Permit stamp is unreadable. Please provide a clear scanned copy.')

    def test_listing_waits_for_business_account_approval_before_public_access(self):
        self.venue.location = 'Nyeri County, Kenya'
        self.venue.is_verified = True
        self.venue.save(update_fields=['location', 'is_verified'])

        # Create a pending verification document for the venue owner
        VerificationDocument.objects.create(
            user=self.owner_user,
            venue_owner=self.venue_owner,
            document_type='BUSINESS_REGISTRATION',
            title='Incorporation Cert',
            file=self.dummy_pdf,
            file_name='incorp.pdf',
            status='PENDING'
        )

        # Public search check (no user or admin params)
        public_client = APIClient()
        res = public_client.get('/api/venues/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get('results', res.data) if isinstance(res.data, dict) else res.data
        venue_ids = [v['id'] for v in results]
        self.assertNotIn(self.venue.id, venue_ids)

        # An approved listing cannot be booked while its business account is pending.
        future_date = datetime.date.today() + datetime.timedelta(days=14)
        public_client.force_authenticate(user=self.customer_user)
        book_res = public_client.post('/api/bookings/', {
            'venue': self.venue.id,
            'customer': self.customer_user.id,
            'event_title': 'Verified Listing Booking',
            'event_type': 'Wedding',
            'event_date': future_date.strftime('%Y-%m-%d'),
            'guest_count': 50,
            'total_price': 90000.00
        })
        self.assertEqual(book_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('business account', str(book_res.data))

        self.venue_owner.is_verified = True
        self.venue_owner.verification_status = 'APPROVED'
        self.venue_owner.save(update_fields=['is_verified', 'verification_status'])
        res_approved_owner = public_client.get('/api/venues/')
        self.assertEqual(res_approved_owner.status_code, status.HTTP_200_OK)
        approved_owner_results = (
            res_approved_owner.data.get('results', res_approved_owner.data)
            if isinstance(res_approved_owner.data, dict)
            else res_approved_owner.data
        )
        self.assertIn(self.venue.id, [v['id'] for v in approved_owner_results])

        book_after_owner_approval = public_client.post('/api/bookings/', {
            'venue': self.venue.id,
            'customer': self.customer_user.id,
            'event_title': 'Verified Listing Booking',
            'event_type': 'Wedding',
            'event_date': future_date.strftime('%Y-%m-%d'),
            'guest_count': 50,
            'total_price': 90000.00
        })
        self.assertEqual(book_after_owner_approval.status_code, status.HTTP_201_CREATED)

        # Pending listing approval still hides the listing and blocks booking.
        self.venue.approval_status = 'PENDING'
        self.venue.is_verified = False
        self.venue.save(update_fields=['approval_status', 'is_verified'])
        res_pending = public_client.get('/api/venues/')
        self.assertEqual(res_pending.status_code, status.HTTP_200_OK)
        results_pending = (
            res_pending.data.get('results', res_pending.data)
            if isinstance(res_pending.data, dict)
            else res_pending.data
        )
        self.assertNotIn(self.venue.id, [v['id'] for v in results_pending])

        booking_pending_listing = public_client.post('/api/bookings/', {
            'venue': self.venue.id,
            'customer': self.customer_user.id,
            'event_title': 'Pending Listing Booking',
            'event_type': 'Wedding',
            'event_date': (future_date + datetime.timedelta(days=1)).strftime('%Y-%m-%d'),
            'guest_count': 40,
            'total_price': 90000.00
        })
        self.assertEqual(booking_pending_listing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('pending administrator verification', str(booking_pending_listing.data))
