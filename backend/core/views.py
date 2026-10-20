from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Q, Sum
from .models import (
    User, VendorProfile, VenueOwnerProfile, Venue, Booking, Review, EmailOTP, Message, Event, EventService,
    Notification, CustomerReminderPreference, VerificationDocument
)
from .serializers import (
    UserSerializer, VendorProfileSerializer, VenueOwnerProfileSerializer, VenueSerializer, 
    BookingSerializer, ReviewSerializer, MessageSerializer, EventSerializer, EventServiceSerializer,
    NotificationSerializer, CustomerReminderPreferenceSerializer, VerificationDocumentSerializer
)
from .services.reminder_service import evaluate_and_generate_reminders
from django.core.mail import send_mail
import random
import datetime
import os
from django.utils import timezone
from django.conf import settings
from rest_framework.exceptions import PermissionDenied
from django.core.files.storage import FileSystemStorage
from rest_framework.parsers import MultiPartParser, FormParser

def is_admin_user(request):
    """
    Verifies if the request is performed by a platform administrator.
    Checks:
    1. Django request.user session/token authentication (role=='ADMIN', is_staff, or is_superuser).
    2. Headers: 'X-User-Id' or 'X-Admin-Id'.
    3. Query params: 'admin_user_id' or 'user_id'.
    4. Request body: 'admin_user_id' or 'user_id'.
    """
    user = getattr(request, 'user', None)
    if user and user.is_authenticated:
        if getattr(user, 'role', '') == 'ADMIN' or getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False):
            return True

    user_id = (
        request.headers.get('X-User-Id') or 
        request.headers.get('X-Admin-Id') or
        getattr(request, 'query_params', {}).get('admin_user_id') or 
        getattr(request, 'query_params', {}).get('user_id')
    )
    if not user_id and hasattr(request, 'data') and isinstance(request.data, dict):
        user_id = request.data.get('admin_user_id') or request.data.get('user_id')

    if user_id:
        try:
            u = User.objects.get(pk=int(user_id))
            return u.role == 'ADMIN' or u.is_staff or u.is_superuser
        except (User.DoesNotExist, ValueError, TypeError):
            return False
    return False

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer

    def check_permissions(self, request):
        super().check_permissions(request)
        if not is_admin_user(request):
            raise PermissionDenied("Access Denied: Only platform administrators can view or manage users.")

    def get_queryset(self):
        if not is_admin_user(self.request):
            raise PermissionDenied("Access Denied: Only platform administrators can view user records.")
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        role = self.request.query_params.get('role')
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )
        if role and role != 'ALL':
            queryset = queryset.filter(role=role)
        return queryset

    @action(detail=True, methods=['post', 'patch'])
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        user.is_active = not user.is_active
        user.save(update_fields=['is_active'])
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=['post', 'patch'])
    def update_role(self, request, pk=None):
        user = self.get_object()
        new_role = request.data.get('role')
        if new_role in dict(User.ROLE_CHOICES):
            user.role = new_role
            if new_role == 'ADMIN':
                user.is_staff = True
            elif new_role == 'CUSTOMER':
                user.is_customer = True
            elif new_role == 'PROVIDER':
                user.is_vendor = True
                user.is_venue_owner = True
            user.save()
            return Response(UserSerializer(user).data)
        return Response({'error': 'Invalid role'}, status=status.HTTP_400_BAD_REQUEST)


class VendorProfileViewSet(viewsets.ModelViewSet):
    queryset = VendorProfile.objects.all().order_by('-rating')
    serializer_class = VendorProfileSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        search = params.get('search')
        vendor_type = params.get('vendor_type')
        location = params.get('location')
        verified = params.get('verified')
        user = params.get('user') or params.get('user_id')
        all_status = params.get('all_status') == 'true'

        is_admin = is_admin_user(self.request)

        # Public queries only return approved & verified vendors who have valid verification documents
        if is_admin and all_status:
            pass
        elif user:
            pass  # Provider viewing their own account
        else:
            today = datetime.date.today()
            verified_vendor_ids = VerificationDocument.objects.filter(
                vendor__isnull=False,
                status='APPROVED'
            ).filter(
                Q(expiry_date__isnull=True) | Q(expiry_date__gte=today)
            ).values_list('vendor_id', flat=True)
            queryset = queryset.filter(is_verified=True, verification_status='APPROVED', id__in=verified_vendor_ids)

        if search:
            queryset = queryset.filter(
                Q(business_name__icontains=search) | 
                Q(description__icontains=search) | 
                Q(location__icontains=search)
            )
        if vendor_type and vendor_type != 'ALL':
            queryset = queryset.filter(vendor_type=vendor_type)
        if location and location != 'ALL':
            queryset = queryset.filter(location__icontains=location)
        if user:
            queryset = queryset.filter(user_id=user)
        if verified == 'true':
            queryset = queryset.filter(is_verified=True)

        return queryset

    @action(detail=True, methods=['post'])
    def toggle_verify(self, request, pk=None):
        if not is_admin_user(request):
            raise PermissionDenied("Access Denied: Only platform administrators can verify vendor credentials.")
        vendor = self.get_object()
        vendor.is_verified = not vendor.is_verified
        vendor.verification_status = 'APPROVED' if vendor.is_verified else 'PENDING'
        vendor.save()
        # Interconnect: sync all vendor listings and services
        Venue.objects.filter(vendor=vendor).update(is_verified=vendor.is_verified)
        return Response(VendorProfileSerializer(vendor).data)

    @action(detail=True, methods=['post', 'patch'])
    def set_verification(self, request, pk=None):
        if not is_admin_user(request):
            raise PermissionDenied("Access Denied: Only platform administrators can verify vendor credentials.")
        vendor = self.get_object()
        new_status = request.data.get('verification_status')
        if new_status in ['APPROVED', 'REJECTED', 'PENDING']:
            vendor.verification_status = new_status
            vendor.is_verified = (new_status == 'APPROVED')
            vendor.save()
            # Interconnect: sync all vendor listings and services
            Venue.objects.filter(vendor=vendor).update(is_verified=vendor.is_verified)
            return Response(VendorProfileSerializer(vendor).data)
        return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)


class VenueOwnerProfileViewSet(viewsets.ModelViewSet):
    queryset = VenueOwnerProfile.objects.all().order_by('-created_at')
    serializer_class = VenueOwnerProfileSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        search = params.get('search')
        location = params.get('location')
        verified = params.get('verified')
        user = params.get('user') or params.get('user_id')
        all_status = params.get('all_status') == 'true'

        is_admin = is_admin_user(self.request)

        if is_admin and all_status:
            pass
        elif user:
            pass  # Owner inspecting their own profile
        else:
            today = datetime.date.today()
            verified_owner_ids = VerificationDocument.objects.filter(
                venue_owner__isnull=False,
                status='APPROVED'
            ).filter(
                Q(expiry_date__isnull=True) | Q(expiry_date__gte=today)
            ).values_list('venue_owner_id', flat=True)
            queryset = queryset.filter(is_verified=True, verification_status='APPROVED', id__in=verified_owner_ids)

        if search:
            queryset = queryset.filter(
                Q(business_name__icontains=search) | 
                Q(location__icontains=search) |
                Q(business_type__icontains=search)
            )
        if location and location != 'ALL':
            queryset = queryset.filter(location__icontains=location)
        if user:
            queryset = queryset.filter(user_id=user)
        if verified == 'true':
            queryset = queryset.filter(is_verified=True)

        return queryset

    @action(detail=True, methods=['post'])
    def toggle_verify(self, request, pk=None):
        if not is_admin_user(request):
            raise PermissionDenied("Access Denied: Only platform administrators can verify venue owners.")
        owner = self.get_object()
        owner.is_verified = not owner.is_verified
        owner.verification_status = 'APPROVED' if owner.is_verified else 'PENDING'
        owner.save()
        # Interconnect: sync all venue owner physical spaces
        Venue.objects.filter(owner=owner).update(is_verified=owner.is_verified)
        return Response(VenueOwnerProfileSerializer(owner).data)

    @action(detail=True, methods=['post', 'patch'])
    def set_verification(self, request, pk=None):
        if not is_admin_user(request):
            raise PermissionDenied("Access Denied: Only platform administrators can verify venue owners.")
        owner = self.get_object()
        new_status = request.data.get('verification_status')
        if new_status in ['APPROVED', 'REJECTED', 'PENDING']:
            owner.verification_status = new_status
            owner.is_verified = (new_status == 'APPROVED')
            owner.save()
            # Interconnect: sync all venue owner physical spaces
            Venue.objects.filter(owner=owner).update(is_verified=owner.is_verified)
            return Response(VenueOwnerProfileSerializer(owner).data)
        return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)


class VenueViewSet(viewsets.ModelViewSet):
    queryset = Venue.objects.all().order_by('-created_at')
    serializer_class = VenueSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        search = params.get('search')
        category = params.get('category')
        location = params.get('location')
        max_price = params.get('max_price')
        min_capacity = params.get('min_capacity')
        verified = params.get('verified')
        owner_id = params.get('owner')
        vendor_id = params.get('vendor')
        user_id = params.get('user')
        all_status = params.get('all_status') == 'true'

        is_admin = is_admin_user(self.request)

        # Filtering logic for public visibility vs provider/admin dashboard:
        # If admin, or detail action (like approve/reject), or provider scoping is requested, allow finding listing
        if is_admin:
            pass  # Admin can inspect all statuses and execute actions
        elif self.action in ['approve', 'reject', 'toggle_verify']:
            pass
        elif user_id or owner_id or vendor_id:
            # Scoped to provider's dashboard
            pass
        else:
            # PUBLIC CONSUMER ENDPOINT: Only approved, active/available listings
            # STRICT VERIFICATION GATING:
            # Must satisfy all conditions:
            # 1. Listing approval_status == 'APPROVED'
            # 2. Listing is_available == True
            # 3. Listing is_verified == True
            # 4. Owner / Vendor profile must have at least one approved, unexpired verification document
            today = datetime.date.today()
            verified_owner_ids = VerificationDocument.objects.filter(
                venue_owner__isnull=False,
                status='APPROVED'
            ).filter(
                Q(expiry_date__isnull=True) | Q(expiry_date__gte=today)
            ).values_list('venue_owner_id', flat=True)

            verified_vendor_ids = VerificationDocument.objects.filter(
                vendor__isnull=False,
                status='APPROVED'
            ).filter(
                Q(expiry_date__isnull=True) | Q(expiry_date__gte=today)
            ).values_list('vendor_id', flat=True)

            queryset = queryset.filter(
                approval_status='APPROVED',
                is_available=True,
                is_verified=True
            ).filter(
                (Q(owner_id__in=verified_owner_ids) & Q(owner__verification_status='APPROVED')) |
                (Q(vendor_id__in=verified_vendor_ids) & Q(vendor__verification_status='APPROVED'))
            )

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | 
                Q(description__icontains=search) | 
                Q(location__icontains=search)
            )
        if category and category != 'ALL':
            queryset = queryset.filter(category=category)
        if location and location != 'ALL':
            queryset = queryset.filter(location__icontains=location)
        if user_id:
            queryset = queryset.filter(Q(owner__user_id=user_id) | Q(vendor__user_id=user_id))
        if owner_id:
            queryset = queryset.filter(owner_id=owner_id)
        if vendor_id:
            queryset = queryset.filter(vendor_id=vendor_id)
        if max_price:
            try:
                queryset = queryset.filter(price_per_day__lte=float(max_price))
            except ValueError:
                pass
        if min_capacity:
            try:
                queryset = queryset.filter(capacity__gte=int(min_capacity))
            except ValueError:
                pass
        if verified == 'true':
            queryset = queryset.filter(is_verified=True, approval_status='APPROVED')

        return queryset

    def perform_create(self, serializer):
        # By default, ALL new venue/service listings must be pending approval
        # Ordinary users/vendors cannot bypass approval.
        serializer.save(approval_status='PENDING', is_verified=False)

    def perform_update(self, serializer):
        instance = serializer.instance
        # Non-admins cannot alter approval_status or is_verified directly
        if not is_admin_user(self.request):
            # Check if critical listing details changed (title, category, price, capacity)
            validated = serializer.validated_data
            critical_fields = ['title', 'category', 'price_per_day', 'capacity', 'image_url']
            has_critical_changes = any(f in validated and validated[f] != getattr(instance, f) for f in critical_fields)
            if has_critical_changes and instance.approval_status == 'APPROVED':
                # Reset to PENDING for re-approval
                serializer.save(approval_status='PENDING', is_verified=False)
                return
            else:
                serializer.save(approval_status=instance.approval_status, is_verified=instance.is_verified)
                return
        serializer.save()

    @action(detail=True, methods=['post'])
    def toggle_verify(self, request, pk=None):
        if not is_admin_user(request):
            raise PermissionDenied("Access Denied: Only platform administrators can verify venues.")
        venue = self.get_object()
        if venue.approval_status == 'APPROVED':
            venue.approval_status = 'PENDING'
            venue.is_verified = False
        else:
            venue.approval_status = 'APPROVED'
            venue.is_verified = True
            venue.rejection_reason = None
        venue.save(update_fields=['approval_status', 'is_verified', 'rejection_reason'])
        return Response({'status': 'updated', 'approval_status': venue.approval_status, 'is_verified': venue.is_verified})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        if not is_admin_user(request):
            raise PermissionDenied("Access Denied: Only platform administrators can approve listings.")
        venue = self.get_object()
        venue.approval_status = 'APPROVED'
        venue.is_verified = True
        venue.rejection_reason = None
        venue.save(update_fields=['approval_status', 'is_verified', 'rejection_reason'])
        return Response(VenueSerializer(venue).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        if not is_admin_user(request):
            raise PermissionDenied("Access Denied: Only platform administrators can reject listings.")
        venue = self.get_object()
        reason = request.data.get('reason', '').strip() or 'Listing does not satisfy LOCYFY verification requirements.'
        venue.approval_status = 'REJECTED'
        venue.is_verified = False
        venue.rejection_reason = reason
        venue.save(update_fields=['approval_status', 'is_verified', 'rejection_reason'])
        return Response(VenueSerializer(venue).data)

    @action(detail=True, methods=['post', 'patch'])
    def toggle_availability(self, request, pk=None):
        venue = self.get_object()
        # Verify provider or admin
        if request.user and request.user.is_authenticated and not request.user.is_staff:
            provider_uid = None
            if venue.owner and venue.owner.user_id:
                provider_uid = venue.owner.user_id
            elif venue.vendor and venue.vendor.user_id:
                provider_uid = venue.vendor.user_id
            if provider_uid and provider_uid != request.user.id:
                raise PermissionDenied("You do not have permission to change this venue's availability.")

        venue.is_available = not venue.is_available
        venue.save(update_fields=['is_available'])
        return Response({'status': 'updated', 'is_available': venue.is_available})


class BookingViewSet(viewsets.ModelViewSet):
    queryset = Booking.objects.all().order_by('-created_at')
    serializer_class = BookingSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = getattr(self.request, 'query_params', getattr(self.request, 'GET', {}))
        customer_id = params.get('customer') or params.get('customer_id')
        vendor_id = params.get('vendor') or params.get('vendor_id')
        owner_id = params.get('owner') or params.get('owner_id')
        user_id = params.get('user') or params.get('user_id')
        status_param = params.get('status')

        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        if vendor_id:
            queryset = queryset.filter(Q(vendor_id=vendor_id) | Q(venue__vendor_id=vendor_id))
        if owner_id:
            queryset = queryset.filter(venue__owner_id=owner_id)
        if user_id:
            queryset = queryset.filter(
                Q(venue__owner__user_id=user_id) | 
                Q(venue__vendor__user_id=user_id) | 
                Q(vendor__user_id=user_id)
            )
        today = datetime.date.today()
        # Automated status lifecycle: Confirmed bookings past event date automatically become COMPLETED
        Booking.objects.filter(
            status='APPROVED',
            event_date__lt=today
        ).update(status='COMPLETED')

        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset

    def create(self, request, *args, **kwargs):
        from django.db import transaction
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        from django.db import transaction
        from core.services.booking_validator import BookingCapacityValidator
        from rest_framework.exceptions import ValidationError

        new_status = request.data.get('status')
        if new_status not in dict(Booking.STATUS_CHOICES):
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                # Lock the booking record
                booking = Booking.objects.select_for_update().get(pk=pk)

                # 1. ENFORCE ALLOWED TRANSITION RULES
                # PENDING -> APPROVED, REJECTED, CANCELLED
                # APPROVED -> COMPLETED, CANCELLED
                # REJECTED -> Final (cannot transition)
                # CANCELLED -> Final (cannot transition)
                # COMPLETED -> Final (cannot transition)
                if booking.status == new_status:
                    return Response(BookingSerializer(booking).data)

                if booking.status in ['REJECTED', 'CANCELLED', 'COMPLETED']:
                    return Response(
                        {'error': f"Cannot update status. Booking #{booking.id} is in final state '{booking.status}'."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                ALLOWED_TRANSITIONS = {
                    'PENDING': ['APPROVED', 'REJECTED', 'CANCELLED'],
                    'APPROVED': ['COMPLETED', 'CANCELLED'],
                }

                if new_status not in ALLOWED_TRANSITIONS.get(booking.status, []):
                    return Response(
                        {'error': f"Illegal status transition from '{booking.status}' to '{new_status}'."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Determine provider user ID
                provider_uid = None
                if booking.venue:
                    if booking.venue.owner and booking.venue.owner.user_id:
                        provider_uid = booking.venue.owner.user_id
                    elif booking.venue.vendor and booking.venue.vendor.user_id:
                        provider_uid = booking.venue.vendor.user_id
                elif booking.vendor and booking.vendor.user_id:
                    provider_uid = booking.vendor.user_id

                # Resolve acting user (token or header)
                acting_user_id = None
                if request.user and request.user.is_authenticated:
                    acting_user_id = request.user.id
                else:
                    header_uid = request.headers.get('X-User-Id') or request.headers.get('X-Admin-Id')
                    if header_uid:
                        try:
                            acting_user_id = int(header_uid)
                        except (ValueError, TypeError):
                            pass

                is_admin = is_admin_user(request)

                # 2. ROLE PERMISSION ENFORCEMENT
                if not is_admin:
                    if new_status in ['APPROVED', 'REJECTED']:
                        if not acting_user_id or (provider_uid and acting_user_id != provider_uid):
                            return Response(
                                {'error': 'Permission denied. Only the provider or an administrator can accept or decline this booking request.'},
                                status=status.HTTP_403_FORBIDDEN
                            )
                    elif new_status == 'CANCELLED':
                        is_customer = (acting_user_id and acting_user_id == booking.customer_id)
                        is_provider = (acting_user_id and acting_user_id == provider_uid)
                        if not is_customer and not is_provider:
                            return Response(
                                {'error': 'Permission denied. Only the customer or the provider can cancel this booking.'},
                                status=status.HTTP_403_FORBIDDEN
                            )
                    elif new_status == 'COMPLETED':
                        if not acting_user_id or (provider_uid and acting_user_id != provider_uid):
                            return Response(
                                {'error': 'Permission denied. Only the provider or an administrator can mark a booking as completed.'},
                                status=status.HTTP_403_FORBIDDEN
                            )

                # 3. CANCELLATION POLICY ENFORCEMENT (When Customer cancels)
                if new_status == 'CANCELLED':
                    cancellation_reason = request.data.get('reason', '').strip() or request.data.get('cancellation_reason', '').strip()
                    cancelling_party = 'ADMIN' if is_admin else ('CUSTOMER' if acting_user_id == booking.customer_id else 'PROVIDER')

                    # If customer is cancelling a CONFIRMED booking, enforce cancellation deadline policy
                    if booking.status == 'APPROVED' and cancelling_party == 'CUSTOMER':
                        policy = 'FLEXIBLE'
                        if booking.venue and booking.venue.cancellation_policy:
                            policy = booking.venue.cancellation_policy

                        today = datetime.date.today()
                        days_until_event = (booking.event_date - today).days

                        min_days_required = 1
                        policy_name = "Flexible (24 hours)"
                        if policy == 'MODERATE':
                            min_days_required = 3
                            policy_name = "Moderate (3 days)"
                        elif policy == 'STRICT':
                            min_days_required = 7
                            policy_name = "Strict (7 days)"

                        if days_until_event < min_days_required:
                            return Response(
                                {
                                    'error': (
                                        f"Cancellation deadline has passed under the {policy_name} cancellation policy. "
                                        f"The event is in {max(0, days_until_event)} day(s), but at least {min_days_required} day(s) advance notice is required."
                                    )
                                },
                                status=status.HTTP_400_BAD_REQUEST
                            )

                    booking.cancelled_at = timezone.now()
                    booking.cancelled_by = cancelling_party
                    booking.cancellation_reason = cancellation_reason

                # 4. REJECTION REASON TRACKING
                if new_status == 'REJECTED':
                    rejection_reason = request.data.get('reason', '').strip() or request.data.get('rejection_reason', '').strip() or 'Provider is unavailable or unable to host this request.'
                    booking.rejection_reason = rejection_reason

                # 5. COMPLETION RULES: Cannot mark completed before event date
                if new_status == 'COMPLETED':
                    today = datetime.date.today()
                    if booking.event_date > today and not is_admin:
                        return Response(
                            {'error': f"Cannot mark booking completed before the event date ({booking.event_date})."},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                # 6. Revalidation upon Provider Acceptance (Pending -> Approved)
                if new_status == 'APPROVED' and booking.status != 'APPROVED':
                    BookingCapacityValidator.validate_booking(
                        customer=booking.customer,
                        event_date=booking.event_date,
                        guest_count=booking.guest_count,
                        venue=booking.venue,
                        vendor=booking.vendor,
                        event_type=booking.event_type,
                        notes=booking.notes,
                        exclude_booking_id=booking.id,
                        lock_provider=True
                    )

                booking.status = new_status
                booking.save()
                return Response(BookingSerializer(booking).data)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)
        except ValidationError as e:
            msg = e.detail[0] if isinstance(e.detail, list) and e.detail else str(e.detail)
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all().order_by('-created_at')
    serializer_class = ReviewSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        venue_id = params.get('venue')
        vendor_id = params.get('vendor')
        user_id = params.get('user')
        booking_id = params.get('booking')

        # Filter strictly by the venue, vendor, or user specified
        if venue_id:
            queryset = queryset.filter(venue_id=venue_id)
        if vendor_id:
            queryset = queryset.filter(vendor_id=vendor_id)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if booking_id:
            queryset = queryset.filter(booking_id=booking_id)

        return queryset

    def create(self, request, *args, **kwargs):
        booking_id = request.data.get('booking')
        rating = request.data.get('rating')
        comment = request.data.get('comment', '').strip()

        if not booking_id:
            return Response({'error': 'A booking ID is required to leave a review.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            booking = Booking.objects.select_related('venue', 'vendor', 'customer').get(id=booking_id)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user if request.user and request.user.is_authenticated else None
        if not user:
            client_user_id = request.data.get('user')
            if client_user_id:
                try:
                    user = User.objects.get(id=client_user_id)
                except User.DoesNotExist:
                    pass
        if not user:
            user = booking.customer

        if user.id != booking.customer_id and not user.is_staff:
            return Response({'error': 'You can only review your own bookings.'}, status=status.HTTP_403_FORBIDDEN)

        if Review.objects.filter(booking=booking).exists():
            return Response({'error': 'You have already reviewed this booking.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rating_val = int(rating)
            if rating_val < 1 or rating_val > 5:
                return Response({'error': 'Rating must be between 1 and 5 stars.'}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({'error': 'Invalid rating format.'}, status=status.HTTP_400_BAD_REQUEST)

        venue = booking.venue
        vendor = booking.vendor

        review = Review.objects.create(
            user=user,
            booking=booking,
            venue=venue,
            vendor=vendor,
            rating=rating_val,
            comment=comment
        )

        serializer = self.get_serializer(review)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        params = self.request.query_params
        venue_id = params.get('venue')
        vendor_id = params.get('vendor')

        qs = Review.objects.all()
        if venue_id:
            qs = qs.filter(venue_id=venue_id)
        elif vendor_id:
            qs = qs.filter(vendor_id=vendor_id)

        from django.db.models import Avg, Count
        stats = qs.aggregate(avg=Avg('rating'), count=Count('id'))
        breakdown = {str(i): qs.filter(rating=i).count() for i in range(1, 6)}

        return Response({
            'average_rating': round(stats['avg'], 1) if stats['avg'] is not None else 0.0,
            'review_count': stats['count'] or 0,
            'rating_breakdown': breakdown,
        })


class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all().order_by('created_at')
    serializer_class = MessageSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        user_id = params.get('user')
        partner_id = params.get('partner')
        booking_id = params.get('booking')
        venue_id = params.get('venue')
        vendor_id = params.get('vendor')

        current_user_id = self.request.user.id if self.request.user and self.request.user.is_authenticated else user_id

        if current_user_id and partner_id:
            queryset = queryset.filter(
                (Q(sender_id=current_user_id) & Q(recipient_id=partner_id)) |
                (Q(sender_id=partner_id) & Q(recipient_id=current_user_id))
            )
        elif current_user_id:
            queryset = queryset.filter(
                Q(sender_id=current_user_id) | Q(recipient_id=current_user_id)
            )

        if booking_id:
            queryset = queryset.filter(booking_id=booking_id)
        if venue_id:
            queryset = queryset.filter(venue_id=venue_id)
        if vendor_id:
            queryset = queryset.filter(vendor_id=vendor_id)

        return queryset

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        
        if request.user and request.user.is_authenticated:
            sender_id = request.user.id
        else:
            sender_id = data.get('sender')

        recipient_id = data.get('recipient')
        booking_id = data.get('booking')
        venue_id = data.get('venue')
        vendor_id = data.get('vendor')
        content = data.get('content', '').strip()

        if not sender_id:
            return Response({'error': 'Sender is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not content:
            return Response({'error': 'Message content cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        booking = Booking.objects.filter(id=booking_id).first() if booking_id else None
        venue = Venue.objects.filter(id=venue_id).first() if venue_id else (booking.venue if booking else None)
        vendor = VendorProfile.objects.filter(id=vendor_id).first() if vendor_id else (booking.vendor if booking else None)

        if not recipient_id:
            if venue:
                if venue.owner and venue.owner.user_id:
                    recipient_id = venue.owner.user_id
                elif venue.vendor and venue.vendor.user_id:
                    recipient_id = venue.vendor.user_id
            elif vendor and vendor.user_id:
                recipient_id = vendor.user_id
            elif booking:
                if int(sender_id) == booking.customer_id:
                    if booking.venue and booking.venue.owner and booking.venue.owner.user_id:
                        recipient_id = booking.venue.owner.user_id
                    elif booking.venue and booking.venue.vendor and booking.venue.vendor.user_id:
                        recipient_id = booking.venue.vendor.user_id
                    elif booking.vendor and booking.vendor.user_id:
                        recipient_id = booking.vendor.user_id
                else:
                    recipient_id = booking.customer_id

        if not recipient_id:
            return Response({'error': 'Recipient could not be identified.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sender = User.objects.get(id=sender_id)
            recipient = User.objects.get(id=recipient_id)
        except User.DoesNotExist:
            return Response({'error': 'Sender or Recipient user not found.'}, status=status.HTTP_404_NOT_FOUND)

        msg = Message.objects.create(
            sender=sender,
            recipient=recipient,
            booking=booking,
            venue=venue,
            vendor=vendor,
            content=content
        )

        serializer = self.get_serializer(msg)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def conversations(self, request):
        user_id = request.query_params.get('user')
        current_user_id = request.user.id if request.user and request.user.is_authenticated else user_id

        if not current_user_id:
            return Response({'error': 'User ID required.'}, status=status.HTTP_400_BAD_REQUEST)

        messages = Message.objects.filter(
            Q(sender_id=current_user_id) | Q(recipient_id=current_user_id)
        ).select_related('sender', 'recipient', 'booking', 'venue', 'vendor').order_by('-created_at')

        threads = {}
        for msg in messages:
            partner = msg.recipient if msg.sender_id == int(current_user_id) else msg.sender
            partner_id = partner.id
            if partner_id not in threads:
                if partner.first_name:
                    p_name = f"{partner.first_name} {partner.last_name or ''}".strip()
                elif hasattr(partner, 'vendor_profile') and partner.vendor_profile.business_name:
                    p_name = partner.vendor_profile.business_name
                elif hasattr(partner, 'venue_owner_profile') and partner.venue_owner_profile.business_name:
                    p_name = partner.venue_owner_profile.business_name
                else:
                    p_name = partner.username

                threads[partner_id] = {
                    'partner_id': partner_id,
                    'partner_name': p_name,
                    'partner_username': partner.username,
                    'partner_avatar': getattr(partner, 'avatar_url', None),
                    'partner_role': partner.role,
                    'last_message': msg.content,
                    'last_message_at': msg.created_at,
                    'unread_count': 0,
                    'booking_id': msg.booking_id,
                    'event_title': msg.booking.event_title if msg.booking else None,
                    'venue_id': msg.venue_id,
                    'venue_title': msg.venue.title if msg.venue else None,
                    'vendor_id': msg.vendor_id,
                    'vendor_name': msg.vendor.business_name if msg.vendor else None,
                }

            if msg.recipient_id == int(current_user_id) and not msg.is_read:
                threads[partner_id]['unread_count'] += 1

        return Response(list(threads.values()))

    @action(detail=False, methods=['post'])
    def mark_read(self, request):
        user_id = request.data.get('user')
        partner_id = request.data.get('partner')
        current_user_id = request.user.id if request.user and request.user.is_authenticated else user_id

        if not current_user_id or not partner_id:
            return Response({'error': 'user and partner are required.'}, status=status.HTTP_400_BAD_REQUEST)

        updated = Message.objects.filter(
            sender_id=partner_id,
            recipient_id=current_user_id,
            is_read=False
        ).update(is_read=True)

        return Response({'marked_read': updated}, status=status.HTTP_200_OK)


class EventViewSet(viewsets.ModelViewSet):
    serializer_class = EventSerializer

    def get_queryset(self):
        user = self.request.user
        params = getattr(self.request, 'query_params', getattr(self.request, 'GET', {}))
        user_id = params.get('user') or params.get('user_id') or params.get('owner')

        if user and user.is_authenticated:
            return Event.objects.filter(owner=user).order_by('-created_at')
        elif user_id:
            return Event.objects.filter(owner_id=user_id).order_by('-created_at')
        return Event.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user and user.is_authenticated:
            serializer.save(owner=user)
        else:
            owner_id = self.request.data.get('owner') or self.request.data.get('user_id')
            if not owner_id:
                raise serializers.ValidationError({"owner": "Owner user is required."})
            owner = User.objects.get(id=owner_id)
            serializer.save(owner=owner)

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        user = request.user
        if user and user.is_authenticated:
            if obj.owner != user and not user.is_staff:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You do not have permission to access or modify this event.")
        else:
            owner_id = request.data.get('owner') or request.query_params.get('user')
            if owner_id and int(owner_id) != obj.owner_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You do not have permission to access or modify this event.")


class EventServiceViewSet(viewsets.ModelViewSet):
    serializer_class = EventServiceSerializer

    def get_queryset(self):
        user = self.request.user
        params = getattr(self.request, 'query_params', getattr(self.request, 'GET', {}))
        event_id = params.get('event') or params.get('event_id')
        user_id = params.get('user') or params.get('user_id')

        qs = EventService.objects.all().select_related('event')
        if event_id:
            qs = qs.filter(event_id=event_id)

        if user and user.is_authenticated:
            return qs.filter(event__owner=user)
        elif user_id:
            return qs.filter(event__owner_id=user_id)
        return qs

    def perform_create(self, serializer):
        event_id = self.request.data.get('event') or self.request.data.get('event_id')
        if not event_id:
            raise serializers.ValidationError({"event": "Event ID is required."})
        try:
            event = Event.objects.get(id=event_id)
        except Event.DoesNotExist:
            raise serializers.ValidationError({"event": "Referenced event does not exist."})

        user = self.request.user
        if user and user.is_authenticated and event.owner != user and not user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You cannot add services to an event you do not own.")

        serializer.save(event=event)

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        user = request.user
        if user and user.is_authenticated:
            if obj.event.owner != user and not user.is_staff:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You do not have permission to modify this service.")
        else:
            owner_id = request.data.get('owner') or request.query_params.get('user')
            if owner_id and int(owner_id) != obj.event.owner_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You do not have permission to modify this service.")



@api_view(['GET'])
def platform_stats(request):
    total_venues = Venue.objects.count()
    verified_venues = Venue.objects.filter(is_verified=True).count()
    total_vendors = VendorProfile.objects.count()
    verified_vendors = VendorProfile.objects.filter(is_verified=True).count()
    total_bookings = Booking.objects.count()
    satisfied_clients = 250 + total_bookings

    total_users = User.objects.count()
    total_customers = User.objects.filter(is_customer=True).count()
    total_providers = User.objects.filter(Q(role='PROVIDER') | Q(is_vendor=True) | Q(is_venue_owner=True)).count()
    pending_verifications = VendorProfile.objects.filter(verification_status='PENDING').count() + VenueOwnerProfile.objects.filter(verification_status='PENDING').count()
    pending_bookings = Booking.objects.filter(status='PENDING').count()
    approved_bookings = Booking.objects.filter(status='APPROVED').count()
    completed_bookings = Booking.objects.filter(status='COMPLETED').count()
    cancelled_bookings = Booking.objects.filter(status='CANCELLED').count()

    rev = Booking.objects.filter(status__in=['APPROVED', 'COMPLETED']).aggregate(s=Sum('total_price'))['s']
    total_revenue = float(rev) if rev is not None else 0.0

    total_reviews = Review.objects.count()
    from django.db.models import Avg
    avg_rating_res = Review.objects.aggregate(a=Avg('rating'))['a']
    avg_rating = round(float(avg_rating_res), 1) if avg_rating_res is not None else 4.9

    return Response({
        'total_venues': total_venues,
        'verified_venues': verified_venues,
        'total_vendors': total_vendors,
        'verified_vendors': verified_vendors,
        'total_bookings': total_bookings,
        'satisfied_clients': satisfied_clients,
        'total_users': total_users,
        'total_customers': total_customers,
        'total_providers': total_providers,
        'pending_verifications': pending_verifications,
        'pending_bookings': pending_bookings,
        'approved_bookings': approved_bookings,
        'completed_bookings': completed_bookings,
        'cancelled_bookings': cancelled_bookings,
        'total_revenue': total_revenue,
        'total_reviews': total_reviews,
        'avg_rating': avg_rating,
    })


@api_view(['POST'])
def refresh_all_ratings(request):
    if not is_admin_user(request):
        raise PermissionDenied("Access Denied: Administrator privileges required to recalculate platform ratings.")
    for v in Venue.objects.all():
        v.update_rating_stats()
    for ven in VendorProfile.objects.all():
        ven.update_rating_stats()
    return Response({'status': 'ratings_refreshed'})







class VendorDashboardView(APIView):
    def get(self, request, vendor_id):
        try:
            vendor = VendorProfile.objects.get(id=vendor_id)
        except VendorProfile.DoesNotExist:
            return Response({'error': 'Vendor not found'}, status=status.HTTP_404_NOT_FOUND)
            
        vendor_venues = Venue.objects.filter(vendor=vendor)
        bookings = Booking.objects.filter(Q(venue__in=vendor_venues) | Q(vendor=vendor))
        
        total_revenue = bookings.filter(status='COMPLETED').aggregate(total=Sum('total_price'))['total'] or 0
        pending_bookings = bookings.filter(status='PENDING').count()
        upcoming_bookings = bookings.filter(status='APPROVED').count()
        
        return Response({
            'total_revenue': total_revenue,
            'pending_bookings': pending_bookings,
            'upcoming_bookings': upcoming_bookings,
            'total_venues': vendor_venues.count(),
            'venues': VenueSerializer(vendor_venues, many=True).data
        })

class VendorBookingsView(APIView):
    def get(self, request, vendor_id):
        try:
            vendor = VendorProfile.objects.get(id=vendor_id)
        except VendorProfile.DoesNotExist:
            return Response({'error': 'Vendor not found'}, status=status.HTTP_404_NOT_FOUND)
            
        vendor_venues = Venue.objects.filter(vendor=vendor)
        bookings = Booking.objects.filter(Q(venue__in=vendor_venues) | Q(vendor=vendor)).order_by('-created_at')
        return Response(BookingSerializer(bookings, many=True).data)








class VenueOwnerDashboardView(APIView):
    def get(self, request, owner_id):
        try:
            venue_owner = VenueOwnerProfile.objects.get(id=owner_id)
        except VenueOwnerProfile.DoesNotExist:
            return Response({'error': 'Venue owner not found'}, status=status.HTTP_404_NOT_FOUND)
            
        owner_venues = Venue.objects.filter(owner=venue_owner)
        bookings = Booking.objects.filter(venue__in=owner_venues)
        
        total_revenue = bookings.filter(status='COMPLETED').aggregate(total=Sum('total_price'))['total'] or 0
        pending_bookings = bookings.filter(status='PENDING').count()
        upcoming_bookings = bookings.filter(status='APPROVED').count()
        verified_venues = owner_venues.filter(is_verified=True).count()
        
        return Response({
            'total_revenue': total_revenue,
            'pending_bookings': pending_bookings,
            'upcoming_bookings': upcoming_bookings,
            'total_venues': owner_venues.count(),
            'verified_venues': verified_venues,
            'venues': VenueSerializer(owner_venues, many=True).data
        })


class VenueOwnerBookingsView(APIView):
    def get(self, request, owner_id):
        try:
            venue_owner = VenueOwnerProfile.objects.get(id=owner_id)
        except VenueOwnerProfile.DoesNotExist:
            return Response({'error': 'Venue owner not found'}, status=status.HTTP_404_NOT_FOUND)
            
        owner_venues = Venue.objects.filter(owner=venue_owner)
        bookings = Booking.objects.filter(venue__in=owner_venues).order_by('-created_at')
        return Response(BookingSerializer(bookings, many=True).data)








@api_view(['POST'])
@permission_classes([AllowAny])
def send_otp(request):
    email = request.data.get('email', '').strip().lower()
    if not email:
        return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Generate 6-digit OTP
    otp_code = str(random.randint(100000, 999999))
    
    # Save/update OTP in database
    otp_obj, created = EmailOTP.objects.get_or_create(email=email)
    otp_obj.otp_code = otp_code
    otp_obj.save()
    
    # Send email
    try:
        send_mail(
            subject='Your Verification Code',
            message=f'Your verification code is: {otp_code}\n\nThis code will expire in 10 minutes.',
            from_email='noreply@eventplanning.co.ke',
            recipient_list=[email],
            fail_silently=False,
        )
    except Exception as e:
        print(f"Error sending email: {e}")
        # Proceed anyway so the frontend advances to the OTP step
        
    # Temporary: Print clearly to the console for testing!
    print(f"\n\n{'='*60}\n\n  🚨 OTP CODE FOR {email}: {otp_code} 🚨\n\n{'='*60}\n\n")
    
    return Response({'message': 'OTP sent successfully'})

@api_view(['POST'])
@permission_classes([AllowAny])
def verify_otp(request):
    email = request.data.get('email', '').strip().lower()
    otp_code = request.data.get('otp', '').strip()
    
    if not email or not otp_code:
        return Response({'error': 'Email and OTP are required'}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        otp_obj = EmailOTP.objects.get(email=email)
        
        # Check if expired (10 minutes)
        time_diff = timezone.now() - otp_obj.created_at
        if time_diff.total_seconds() > 600:
            return Response({'error': 'OTP has expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if otp_obj.otp_code == otp_code:
            # OTP is valid, delete it to prevent reuse
            otp_obj.delete()
            return Response({'message': 'Email verified successfully'})
        else:
            return Response({'error': 'Invalid OTP'}, status=status.HTTP_400_BAD_REQUEST)
            
    except EmailOTP.DoesNotExist:
        return Response({'error': 'No OTP found for this email'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request):
    email = request.data.get('email', '').strip().lower()
    otp_code = request.data.get('otp', '').strip()
    new_password = request.data.get('new_password', '')
    
    if not email or not otp_code or not new_password:
        return Response({'error': 'Email, OTP, and new password are required'}, status=status.HTTP_400_BAD_REQUEST)
        
    if len(new_password) < 8:
        return Response({'error': 'Password must be at least 8 characters long'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        otp_obj = EmailOTP.objects.get(email=email)
        
        # Check if expired (10 minutes)
        time_diff = timezone.now() - otp_obj.created_at
        if time_diff.total_seconds() > 600:
            return Response({'error': 'OTP has expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if otp_obj.otp_code != otp_code:
            return Response({'error': 'Invalid OTP'}, status=status.HTTP_400_BAD_REQUEST)

        # Find the user
        user = User.objects.filter(email=email).first()
        if not user:
            return Response({'error': 'No account found with this email'}, status=status.HTTP_404_NOT_FOUND)

        # Reset password
        user.set_password(new_password)
        user.save()
        
        # Delete OTP after successful use
        otp_obj.delete()

        return Response({'message': 'Password reset successfully'}, status=status.HTTP_200_OK)
        
    except EmailOTP.DoesNotExist:
        return Response({'error': 'No OTP found for this email'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def upload_profile_picture(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    if 'file' not in request.FILES:
        return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

    upload = request.FILES['file']
    fs = FileSystemStorage(location=settings.MEDIA_ROOT)
    
    # Save the file with a unique name
    ext = upload.name.split('.')[-1]
    filename = f"user_{user_id}_{timezone.now().strftime('%Y%m%d%H%M%S')}.{ext}"
    saved_name = fs.save(filename, upload)
    
    # Construct URL
    file_url = request.build_absolute_uri(settings.MEDIA_URL + saved_name)
    
    # Save to user model
    user.avatar_url = file_url
    user.save()

    # Also update profile logo if applicable
    if user.role == 'VENDOR' and hasattr(user, 'vendor_profile'):
        user.vendor_profile.logo_url = file_url
        user.vendor_profile.save()
    elif user.role == 'VENUE_OWNER' and hasattr(user, 'venue_owner_profile'):
        user.venue_owner_profile.logo_url = file_url
        user.venue_owner_profile.save()

    return Response({
        'message': 'Profile picture uploaded successfully',
        'profile_picture': file_url
    })



@api_view(['POST'])
@transaction.atomic
def register_user(request):
    data = request.data
    email = data.get('email', '').strip().lower()
    username = data.get('username', '').strip() or email

    if not email:
        return Response({'error': 'Email address is required'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email__iexact=email).exists():
        return Response({'error': 'An account with this email address already exists. Please log in.'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username__iexact=username).exists():
        return Response({'error': 'This username is already taken'}, status=status.HTTP_400_BAD_REQUEST)
        
    requested_role = (data.get('role') or '').strip().upper()
    if requested_role == 'ADMIN':
        return Response({
            'error': 'Administrator registration is disabled. Administrators can only log in with pre-configured credentials.'
        }, status=status.HTTP_403_FORBIDDEN)

    try:
        full_name = data.get('full_name', '').strip()
        first_name = data.get('first_name', '').strip()
        last_name = data.get('last_name', '').strip()
        if full_name and not (first_name or last_name):
            parts = full_name.split(' ', 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ''

        user = User.objects.create_user(
            username=username,
            email=email,
            password=data.get('password'),
            first_name=first_name,
            last_name=last_name,
            is_customer=False, # Wait for explicit role selection
            is_vendor=False,
            is_venue_owner=False,
            is_staff=False,
            is_superuser=False,
            role='CUSTOMER',
            phone_number=data.get('phone_number', '')
        )
        
        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def login_user(request):
    login_identifier = (request.data.get('username') or request.data.get('email') or '').strip()
    password = request.data.get('password')
    
    user_obj = User.objects.filter(Q(username__iexact=login_identifier) | Q(email__iexact=login_identifier)).first()
    if not user_obj:
        return Response({'error': 'No account found with this email or username'}, status=status.HTTP_401_UNAUTHORIZED)

    if not user_obj.is_active:
        return Response({'error': 'This account has been deactivated by an administrator. Please contact support.'}, status=status.HTTP_403_FORBIDDEN)

    user = authenticate(username=user_obj.username, password=password)
    
    if user is not None:
        is_provider = user.role == 'PROVIDER' or (user.is_vendor and user.is_venue_owner)
        response_data = {
            'user': UserSerializer(user).data,
            'roles': {
                'is_customer': user.is_customer,
                'is_vendor': user.is_vendor,
                'is_venue_owner': user.is_venue_owner,
                'is_provider': is_provider,
                'is_admin': user.role == 'ADMIN' or user.is_staff or user.is_superuser
            }
        }
        
        if hasattr(user, 'vendor_profile'):
            response_data['vendor_profile'] = VendorProfileSerializer(user.vendor_profile).data
            
        if hasattr(user, 'venue_owner_profile'):
            response_data['venue_owner_profile'] = VenueOwnerProfileSerializer(user.venue_owner_profile).data
            
        return Response(response_data, status=status.HTTP_200_OK)
    else:
        return Response({'error': 'Invalid credentials. Please verify your password.'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
@transaction.atomic
def request_role(request):
    user_id = request.data.get('user_id')
    role = request.data.get('role')
    
    if not user_id or not role:
        return Response({'error': 'User ID and role are required'}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        user = User.objects.get(id=user_id)
        
        if role == 'CUSTOMER':
            user.role = 'CUSTOMER'
            user.is_customer = True
            user.save()
        elif role in ['PROVIDER', 'BUSINESS']:
            user.role = 'PROVIDER'
            user.is_customer = True
            user.is_vendor = True
            user.is_venue_owner = True
            user.save()
            business_title = f"{user.first_name}'s Business" if user.first_name else f"{user.username}'s Business"
            VendorProfile.objects.get_or_create(
                user=user,
                defaults={
                    'business_name': business_title,
                    'vendor_type': 'Event Services',
                    'location': 'Nairobi',
                    'contact_email': user.email,
                    'contact_phone': user.phone_number or ''
                }
            )
            VenueOwnerProfile.objects.get_or_create(
                user=user,
                defaults={
                    'business_name': business_title,
                    'contact_email': user.email,
                    'contact_phone': user.phone_number or '',
                    'business_type': 'Event Spaces'
                }
            )
        elif role == 'VENDOR':
            user.role = 'VENDOR'
            if not user.is_vendor:
                user.is_vendor = True
                user.save()
                VendorProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        'business_name': f"{user.first_name}'s Business" if user.first_name else "My Business",
                        'vendor_type': 'Other',
                        'location': '',
                        'contact_email': user.email,
                        'contact_phone': user.phone_number
                    }
                )
        elif role == 'VENUE_OWNER':
            user.role = 'VENUE_OWNER'
            if not user.is_venue_owner:
                user.is_venue_owner = True
                user.save()
                VenueOwnerProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        'business_name': f"{user.first_name}'s Venues" if user.first_name else "My Venues",
                        'contact_email': user.email,
                        'contact_phone': user.phone_number,
                        'business_type': 'Event Venue'
                    }
                )
        elif role == 'ADMIN':
            user.role = 'ADMIN'
            user.is_staff = True
            user.is_superuser = True
            user.save()
        else:
            return Response({'error': 'Invalid role'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Refetch to get updated profiles
        is_provider = user.role == 'PROVIDER' or (user.is_vendor and user.is_venue_owner)
        response_data = {
            'user': UserSerializer(user).data,
            'roles': {
                'is_customer': user.is_customer,
                'is_vendor': user.is_vendor,
                'is_venue_owner': user.is_venue_owner,
                'is_provider': is_provider,
                'is_admin': user.role == 'ADMIN' or user.is_staff or user.is_superuser
            }
        }
        
        if hasattr(user, 'vendor_profile'):
            response_data['vendor_profile'] = VendorProfileSerializer(user.vendor_profile).data
            
        if hasattr(user, 'venue_owner_profile'):
            response_data['venue_owner_profile'] = VenueOwnerProfileSerializer(user.venue_owner_profile).data
            
        return Response(response_data, status=status.HTTP_200_OK)
        
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            user_id = self.request.query_params.get('user_id')
            if user_id:
                try:
                    user = User.objects.get(pk=user_id)
                except User.DoesNotExist:
                    return Notification.objects.none()
            else:
                return Notification.objects.none()

        # Opportunistically evaluate pending reminders for this user
        evaluate_and_generate_reminders(user=user)
        return Notification.objects.filter(user=user).order_by('-created_at')

    @action(detail=True, methods=['post', 'patch'])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save()
        return Response(NotificationSerializer(notif).data)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            user_id = request.data.get('user_id') or request.query_params.get('user_id')
            if user_id:
                try:
                    user = User.objects.get(pk=user_id)
                except User.DoesNotExist:
                    return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
            else:
                return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        Notification.objects.filter(user=user, is_read=False).update(is_read=True)
        return Response({'status': 'All notifications marked as read'})

    @action(detail=False, methods=['post'])
    def scan_reminders(self, request):
        """Force a scan of reminders for the user"""
        user = request.user
        if not user or not user.is_authenticated:
            user_id = request.data.get('user_id') or request.query_params.get('user_id')
            if user_id:
                try:
                    user = User.objects.get(pk=user_id)
                except User.DoesNotExist:
                    return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
            else:
                return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        new_notifs = evaluate_and_generate_reminders(user=user)
        return Response({
            'status': 'Scan complete',
            'generated_count': len(new_notifs),
            'notifications': NotificationSerializer(new_notifs, many=True).data
        })


class CustomerReminderPreferenceView(APIView):
    def get_user(self, request):
        if request.user and request.user.is_authenticated:
            return request.user
        user_id = request.query_params.get('user_id') or request.data.get('user_id')
        if user_id:
            try:
                return User.objects.get(pk=user_id)
            except User.DoesNotExist:
                return None
        return None

    def get(self, request):
        user = self.get_user(request)
        if not user:
            return Response({'error': 'User not found or unauthenticated'}, status=status.HTTP_401_UNAUTHORIZED)
        pref, _ = CustomerReminderPreference.objects.get_or_create(user=user)
        return Response(CustomerReminderPreferenceSerializer(pref).data)

    def post(self, request):
        user = self.get_user(request)
        if not user:
            return Response({'error': 'User not found or unauthenticated'}, status=status.HTTP_401_UNAUTHORIZED)
        pref, _ = CustomerReminderPreference.objects.get_or_create(user=user)
        
        serializer = CustomerReminderPreferenceSerializer(pref, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerificationDocumentViewSet(viewsets.ModelViewSet):
    queryset = VerificationDocument.objects.all().order_by('-created_at')
    serializer_class = VerificationDocumentSerializer
    parser_classes = (MultiPartParser, FormParser)

    def get_user_from_request(self):
        user = getattr(self.request, 'user', None)
        if user and user.is_authenticated:
            return user
        user_id = (
            self.request.headers.get('X-User-Id') or 
            self.request.query_params.get('user_id') or 
            self.request.query_params.get('user')
        )
        if user_id:
            try:
                return User.objects.get(pk=int(user_id))
            except (User.DoesNotExist, ValueError, TypeError):
                return None
        return None

    def get_queryset(self):
        queryset = super().get_queryset()
        req_user = self.get_user_from_request()
        is_admin = is_admin_user(self.request)

        # Non-admins can only see their own verification documents
        if not is_admin:
            if not req_user:
                return VerificationDocument.objects.none()
            queryset = queryset.filter(user=req_user)

        # Filters for query
        params = self.request.query_params
        status_param = params.get('status')
        doc_type_param = params.get('document_type')
        user_param = params.get('user') or params.get('user_id')
        vendor_param = params.get('vendor') or params.get('vendor_id')
        venue_owner_param = params.get('venue_owner') or params.get('venue_owner_id')

        if status_param and status_param != 'ALL':
            queryset = queryset.filter(status=status_param)
        if doc_type_param and doc_type_param != 'ALL':
            queryset = queryset.filter(document_type=doc_type_param)
        if is_admin:
            if user_param:
                queryset = queryset.filter(user_id=user_param)
            if vendor_param:
                queryset = queryset.filter(vendor_id=vendor_param)
            if venue_owner_param:
                queryset = queryset.filter(venue_owner_id=venue_owner_param)

        return queryset

    def perform_create(self, serializer):
        req_user = self.get_user_from_request()
        if not req_user:
            raise PermissionDenied("Authentication is required to upload verification documents.")

        file_obj = self.request.FILES.get('file')
        file_name = file_obj.name if file_obj else ''
        file_size = file_obj.size if file_obj else 0
        file_ext = file_name.split('.')[-1].lower() if '.' in file_name else ''

        # Auto-associate vendor or venue_owner profile
        vendor = getattr(req_user, 'vendor_profile', None)
        venue_owner = getattr(req_user, 'venue_owner_profile', None)

        serializer.save(
            user=req_user,
            vendor=vendor,
            venue_owner=venue_owner,
            file_name=file_name,
            file_size=file_size,
            file_extension=file_ext,
            status='PENDING',
            rejection_reason=None,
            admin_notes=None,
            reviewed_by=None,
            reviewed_at=None
        )

    def destroy(self, request, *args, **kwargs):
        doc = self.get_object()
        req_user = self.get_user_from_request()
        is_admin = is_admin_user(request)
        if not is_admin and (not req_user or doc.user_id != req_user.id):
            raise PermissionDenied("You do not have permission to delete this document.")
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """
        Secure document streaming. Only accessible by the document owner or an authorized administrator.
        Prevents public exposure or unauthenticated access.
        """
        try:
            doc = VerificationDocument.objects.get(pk=pk)
        except VerificationDocument.DoesNotExist:
            return Response({'error': 'Document not found.'}, status=status.HTTP_404_NOT_FOUND)

        req_user = self.get_user_from_request()
        is_admin = is_admin_user(request)

        if not is_admin and (not req_user or doc.user_id != req_user.id):
            raise PermissionDenied("Access Denied: You are not authorized to view or download this document.")

        if not doc.file:
            return Response({'error': 'Document file not found on server.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            import mimetypes
            from django.http import FileResponse
            file_path = doc.file.path
            content_type, _ = mimetypes.guess_type(file_path)
            content_type = content_type or 'application/octet-stream'
            
            # Serve file with disposition inline for previewing PDFs and images
            response = FileResponse(open(file_path, 'rb'), content_type=content_type)
            safe_display_name = doc.file_name or f"document_{doc.id}.{doc.file_extension or 'pdf'}"
            response['Content-Disposition'] = f'inline; filename="{safe_display_name}"'
            return response
        except FileNotFoundError:
            return Response({'error': 'Physical document file missing from storage.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        if not is_admin_user(request):
            raise PermissionDenied("Access Denied: Only platform administrators can approve verification documents.")
        doc = self.get_object()
        doc.status = 'APPROVED'
        doc.rejection_reason = None
        doc.admin_notes = request.data.get('admin_notes', '')
        reviewer = self.get_user_from_request() or request.user if getattr(request, 'user', None) and request.user.is_authenticated else None
        doc.reviewed_by = reviewer
        doc.reviewed_at = timezone.now()
        doc.save()

        # Check if provider can now have their profile marked verified
        # A provider is verified if they have at least one approved document and no unaddressed issues
        user = doc.user
        if doc.venue_owner:
            owner = doc.venue_owner
            owner.is_verified = True
            owner.verification_status = 'APPROVED'
            owner.save(update_fields=['is_verified', 'verification_status'])
            Venue.objects.filter(owner=owner).update(is_verified=True)
        elif hasattr(user, 'venue_owner_profile'):
            owner = user.venue_owner_profile
            owner.is_verified = True
            owner.verification_status = 'APPROVED'
            owner.save(update_fields=['is_verified', 'verification_status'])
            Venue.objects.filter(owner=owner).update(is_verified=True)

        if doc.vendor:
            vendor = doc.vendor
            vendor.is_verified = True
            vendor.verification_status = 'APPROVED'
            vendor.save(update_fields=['is_verified', 'verification_status'])
            Venue.objects.filter(vendor=vendor).update(is_verified=True)
        elif hasattr(user, 'vendor_profile'):
            vendor = user.vendor_profile
            vendor.is_verified = True
            vendor.verification_status = 'APPROVED'
            vendor.save(update_fields=['is_verified', 'verification_status'])
            Venue.objects.filter(vendor=vendor).update(is_verified=True)

        return Response(VerificationDocumentSerializer(doc).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        if not is_admin_user(request):
            raise PermissionDenied("Access Denied: Only platform administrators can reject verification documents.")
        doc = self.get_object()
        reason = request.data.get('reason', '').strip() or 'Document does not satisfy LOCYFY verification requirements.'
        doc.status = 'REJECTED'
        doc.rejection_reason = reason
        doc.admin_notes = request.data.get('admin_notes', '')
        reviewer = self.get_user_from_request() or request.user if getattr(request, 'user', None) and request.user.is_authenticated else None
        doc.reviewed_by = reviewer
        doc.reviewed_at = timezone.now()
        doc.save()

        # Re-evaluate provider verification:
        # If provider no longer has ANY approved, valid verification documents, revoke verified status
        user = doc.user
        today = datetime.date.today()
        has_other_valid_doc = VerificationDocument.objects.filter(
            user=user,
            status='APPROVED'
        ).filter(Q(expiry_date__isnull=True) | Q(expiry_date__gte=today)).exclude(id=doc.id).exists()

        if not has_other_valid_doc:
            if doc.venue_owner:
                owner = doc.venue_owner
                owner.is_verified = False
                owner.verification_status = 'PENDING'
                owner.save(update_fields=['is_verified', 'verification_status'])
                Venue.objects.filter(owner=owner).update(is_verified=False)
            elif hasattr(user, 'venue_owner_profile'):
                owner = user.venue_owner_profile
                owner.is_verified = False
                owner.verification_status = 'PENDING'
                owner.save(update_fields=['is_verified', 'verification_status'])
                Venue.objects.filter(owner=owner).update(is_verified=False)

            if doc.vendor:
                vendor = doc.vendor
                vendor.is_verified = False
                vendor.verification_status = 'PENDING'
                vendor.save(update_fields=['is_verified', 'verification_status'])
                Venue.objects.filter(vendor=vendor).update(is_verified=False)
            elif hasattr(user, 'vendor_profile'):
                vendor = user.vendor_profile
                vendor.is_verified = False
                vendor.verification_status = 'PENDING'
                vendor.save(update_fields=['is_verified', 'verification_status'])
                Venue.objects.filter(vendor=vendor).update(is_verified=False)

        return Response(VerificationDocumentSerializer(doc).data)

