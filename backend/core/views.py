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
    Notification, CustomerReminderPreference, VerificationDocument, UserInteraction
)
from .serializers import (
    UserSerializer, VendorProfileSerializer, VenueOwnerProfileSerializer, VenueSerializer, 
    BookingSerializer, ReviewSerializer, MessageSerializer, EventSerializer, EventServiceSerializer,
    NotificationSerializer, CustomerReminderPreferenceSerializer, VerificationDocumentSerializer,
    UserInteractionSerializer
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
            booking_obj = serializer.instance
            try:
                session_id = request.headers.get('X-Session-Id') or request.COOKIES.get('locyfy_session_id') or ''
                UserInteraction.objects.create(
                    event_type='BOOKING_SUBMITTED',
                    user=booking_obj.customer,
                    session_id=session_id[:64] if session_id else None,
                    listing_type='VENUE' if booking_obj.venue else ('VENDOR' if booking_obj.vendor else None),
                    venue=booking_obj.venue,
                    vendor=booking_obj.vendor,
                    category=booking_obj.venue.category if booking_obj.venue else (booking_obj.vendor.vendor_type if booking_obj.vendor else None),
                    metadata={'booking_id': booking_obj.id, 'event_type': booking_obj.event_type}
                )
            except Exception:
                pass
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

                old_status = booking.status
                booking.status = new_status
                booking.save()
                try:
                    session_id = request.headers.get('X-Session-Id') or request.COOKIES.get('locyfy_session_id') or ''
                    UserInteraction.objects.create(
                        event_type='BOOKING_STATUS_CHANGE',
                        user=booking.customer,
                        session_id=session_id[:64] if session_id else None,
                        listing_type='VENUE' if booking.venue else ('VENDOR' if booking.vendor else None),
                        venue=booking.venue,
                        vendor=booking.vendor,
                        category=booking.venue.category if booking.venue else (booking.vendor.vendor_type if booking.vendor else None),
                        metadata={'booking_id': booking.id, 'old_status': old_status, 'new_status': new_status}
                    )
                except Exception:
                    pass
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
        return Response(
            {'error': 'Access Denied: Administrator privileges required to recalculate platform ratings.'},
            status=status.HTTP_403_FORBIDDEN
        )
    try:
        venue_count = 0
        for v in Venue.objects.all():
            v.update_rating_stats()
            venue_count += 1
        vendor_count = 0
        for ven in VendorProfile.objects.all():
            ven.update_rating_stats()
            vendor_count += 1
        return Response({
            'status': 'ratings_refreshed',
            'venues_updated': venue_count,
            'vendors_updated': vendor_count
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': f'Failed to recalculate ratings: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)








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


# ==============================================================================
# USER INTERACTION TRACKING & ROLE-BASED ANALYTICS ENDPOINTS
# ==============================================================================

import csv
from django.http import HttpResponse
from django.db.models import Count
from datetime import timedelta


def parse_date_range(request):
    """
    Parses date range query parameters (preset: '7d', '30d', '90d', 'all' or start_date & end_date).
    Returns (start_datetime, end_datetime, range_label).
    """
    preset = request.query_params.get('preset', '30d')
    start_str = request.query_params.get('start_date')
    end_str = request.query_params.get('end_date')

    now = timezone.now()
    end_dt = now

    if start_str and end_str:
        try:
            s_d = datetime.datetime.strptime(start_str, '%Y-%m-%d').date()
            e_d = datetime.datetime.strptime(end_str, '%Y-%m-%d').date()
            start_dt = timezone.make_aware(datetime.datetime.combine(s_d, datetime.time.min))
            end_dt = timezone.make_aware(datetime.datetime.combine(e_d, datetime.time.max))
            return start_dt, end_dt, f"{start_str} to {end_str}"
        except (ValueError, TypeError):
            pass

    if preset == '7d':
        start_dt = now - timedelta(days=7)
        label = 'Last 7 Days'
    elif preset == '90d':
        start_dt = now - timedelta(days=90)
        label = 'Last 90 Days'
    elif preset == 'all':
        start_dt = timezone.make_aware(datetime.datetime(2020, 1, 1))
        label = 'All Time'
    else:  # default '30d'
        start_dt = now - timedelta(days=30)
        label = 'Last 30 Days'

    return start_dt, end_dt, label


def get_actor_user(request):
    """
    Safely retrieves the acting User from request.user or X-User-Id header.
    """
    user = getattr(request, 'user', None)
    if user and user.is_authenticated:
        return user
    uid = request.headers.get('X-User-Id') or request.query_params.get('user_id')
    if uid:
        try:
            return User.objects.get(pk=int(uid))
        except (User.DoesNotExist, ValueError):
            return None
    return None


@api_view(['POST'])
@permission_classes([AllowAny])
def track_user_interaction(request):
    """
    Endpoint for recording customer interactions securely.
    Accepts valid event types: SEARCH, LISTING_VIEW, LISTING_CLICK, CATEGORY_INTEREST, BOOKING_FORM_OPEN.
    Validates referenced venue/vendor against actual database records.
    """
    data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
    event_type = data.get('event_type')

    allowed_public_events = ['SEARCH', 'LISTING_VIEW', 'LISTING_CLICK', 'CATEGORY_INTEREST', 'BOOKING_FORM_OPEN']
    if event_type not in allowed_public_events:
        return Response({'error': f"Invalid or non-public event type '{event_type}'."}, status=status.HTTP_400_BAD_REQUEST)

    actor = get_actor_user(request)
    session_id = data.get('session_id') or request.headers.get('X-Session-Id') or request.COOKIES.get('locyfy_session_id') or ''

    venue_id = data.get('venue')
    vendor_id = data.get('vendor')
    venue = None
    vendor = None
    listing_type = data.get('listing_type')

    if venue_id:
        try:
            venue = Venue.objects.get(pk=int(venue_id))
            listing_type = 'VENUE'
        except (Venue.DoesNotExist, ValueError):
            return Response({'error': 'Referenced venue does not exist.'}, status=status.HTTP_400_BAD_REQUEST)

    if vendor_id:
        try:
            vendor = VendorProfile.objects.get(pk=int(vendor_id))
            listing_type = 'VENDOR'
        except (VendorProfile.DoesNotExist, ValueError):
            return Response({'error': 'Referenced vendor does not exist.'}, status=status.HTTP_400_BAD_REQUEST)

    category = data.get('category')
    if not category:
        if venue:
            category = venue.category
        elif vendor:
            category = vendor.vendor_type

    # Sanitize and normalize search query
    raw_query = data.get('search_query', '')
    normalized_query = (raw_query.strip()[:200]) if raw_query else ''

    # Throttling duplicate events: If identical listing_view or search by same user/session happened < 10 seconds ago, ignore duplicate
    if event_type in ['LISTING_VIEW', 'SEARCH', 'BOOKING_FORM_OPEN']:
        recent_cutoff = timezone.now() - timedelta(seconds=10)
        dup_filter = Q(event_type=event_type, timestamp__gte=recent_cutoff)
        if actor:
            dup_filter &= Q(user=actor)
        elif session_id:
            dup_filter &= Q(session_id=session_id)
        if venue:
            dup_filter &= Q(venue=venue)
        if vendor:
            dup_filter &= Q(vendor=vendor)
        if normalized_query:
            dup_filter &= Q(search_query=normalized_query)

        if UserInteraction.objects.filter(dup_filter).exists():
            return Response({'status': 'deduplicated', 'message': 'Duplicate interaction ignored.'}, status=status.HTTP_200_OK)

    interaction = UserInteraction.objects.create(
        event_type=event_type,
        user=actor,
        session_id=session_id[:64] if session_id else None,
        listing_type=listing_type,
        venue=venue,
        vendor=vendor,
        category=category[:100] if category else None,
        search_query=normalized_query or None,
        location_filter=(data.get('location_filter') or '')[:100] or None,
        source=(data.get('source') or '')[:100] or None,
        metadata=data.get('metadata') if isinstance(data.get('metadata'), dict) else {}
    )

    return Response(UserInteractionSerializer(interaction).data, status=status.HTTP_201_CREATED)


def compute_daily_breakdown(interactions_qs, bookings_qs, start_dt, end_dt):
    """
    Computes a date-bucketed trend array for views, searches, and booking requests.
    """
    days_count = max(1, (end_dt.date() - start_dt.date()).days + 1)
    # Generate daily buckets
    daily_map = {}
    cur = start_dt.date()
    end_d = end_dt.date()
    while cur <= end_d:
        daily_map[cur.strftime('%Y-%m-%d')] = {
            'date': cur.strftime('%Y-%m-%d'),
            'label': cur.strftime('%b %d'),
            'searches': 0,
            'views': 0,
            'clicks': 0,
            'booking_requests': 0,
            'confirmed_bookings': 0,
        }
        cur += timedelta(days=1)

    for item in interactions_qs:
        d_str = item.timestamp.date().strftime('%Y-%m-%d')
        if d_str in daily_map:
            if item.event_type == 'SEARCH':
                daily_map[d_str]['searches'] += 1
            elif item.event_type == 'LISTING_VIEW':
                daily_map[d_str]['views'] += 1
            elif item.event_type == 'LISTING_CLICK':
                daily_map[d_str]['clicks'] += 1

    for b in bookings_qs:
        d_str = b.created_at.date().strftime('%Y-%m-%d')
        if d_str in daily_map:
            daily_map[d_str]['booking_requests'] += 1
            if b.status in ['APPROVED', 'COMPLETED']:
                daily_map[d_str]['confirmed_bookings'] += 1

    return list(daily_map.values())


@api_view(['GET'])
def admin_analytics(request):
    """
    Returns platform-wide aggregate analytics strictly for administrators.
    """
    if not is_admin_user(request):
        raise PermissionDenied("Access Denied: Platform Administrator privileges required.")

    start_dt, end_dt, range_label = parse_date_range(request)

    # Scoped QuerySets based on date filter
    interactions = UserInteraction.objects.filter(timestamp__gte=start_dt, timestamp__lte=end_dt)
    bookings = Booking.objects.filter(created_at__gte=start_dt, created_at__lte=end_dt)

    total_searches = interactions.filter(event_type='SEARCH').count()
    total_listing_views = interactions.filter(event_type='LISTING_VIEW').count()

    # Unique listing viewers calculation:
    # Distinct authenticated user IDs + distinct anonymous sessions (where user is null)
    auth_viewers = interactions.filter(event_type='LISTING_VIEW', user__isnull=False).values('user_id').distinct().count()
    anon_viewers = interactions.filter(event_type='LISTING_VIEW', user__isnull=True, session_id__isnull=False).values('session_id').distinct().count()
    unique_viewers = auth_viewers + anon_viewers

    # Bookings metrics
    booking_requests = bookings.count()
    confirmed_bookings = bookings.filter(status__in=['APPROVED', 'COMPLETED']).count()
    completed_bookings = bookings.filter(status='COMPLETED').count()
    cancelled_bookings = bookings.filter(status='CANCELLED').count()
    pending_bookings = bookings.filter(status='PENDING').count()
    rejected_bookings = bookings.filter(status='REJECTED').count()

    # Cancellation rate: (Cancelled / Total Requests) * 100
    cancellation_rate = round((cancelled_bookings / booking_requests * 100), 1) if booking_requests > 0 else 0.0

    # Search sessions/users with a booking
    searching_user_ids = set(interactions.filter(event_type='SEARCH', user__isnull=False).values_list('user_id', flat=True))
    searching_sessions = set(interactions.filter(event_type='SEARCH', session_id__isnull=False).values_list('session_id', flat=True))
    total_searching_cohort = len(searching_user_ids) + len(searching_sessions)

    booking_user_ids = set(bookings.values_list('customer_id', flat=True))
    converted_searchers = len(searching_user_ids.intersection(booking_user_ids))
    search_to_booking_rate = round((converted_searchers / max(1, len(searching_user_ids)) * 100), 1) if searching_user_ids else (
        round((booking_requests / max(1, total_searches) * 100), 1) if total_searches > 0 else 0.0
    )

    # View to booking conversion rate
    viewing_user_ids = set(interactions.filter(event_type='LISTING_VIEW', user__isnull=False).values_list('user_id', flat=True))
    converted_viewers = len(viewing_user_ids.intersection(booking_user_ids))
    view_to_booking_rate = round((converted_viewers / max(1, len(viewing_user_ids)) * 100), 1) if viewing_user_ids else (
        round((booking_requests / max(1, total_listing_views) * 100), 1) if total_listing_views > 0 else 0.0
    )

    # Booking funnel stages
    funnel = [
        {'stage': 'Searches Performed', 'count': total_searches, 'percentage': 100},
        {'stage': 'Listings Viewed', 'count': total_listing_views, 'percentage': round((total_listing_views / max(1, total_searches) * 100), 1) if total_searches > 0 else 0},
        {'stage': 'Booking Forms Opened', 'count': interactions.filter(event_type='BOOKING_FORM_OPEN').count(), 'percentage': round((interactions.filter(event_type='BOOKING_FORM_OPEN').count() / max(1, total_listing_views) * 100), 1) if total_listing_views > 0 else 0},
        {'stage': 'Booking Requests Submitted', 'count': booking_requests, 'percentage': round((booking_requests / max(1, total_listing_views) * 100), 1) if total_listing_views > 0 else 0},
        {'stage': 'Confirmed Bookings', 'count': confirmed_bookings, 'percentage': round((confirmed_bookings / max(1, booking_requests) * 100), 1) if booking_requests > 0 else 0},
    ]

    # Status distribution
    status_distribution = [
        {'status': 'Pending Approval', 'count': pending_bookings, 'color': '#d97706'},
        {'status': 'Confirmed', 'count': confirmed_bookings - completed_bookings, 'color': '#0d8a73'},
        {'status': 'Completed', 'count': completed_bookings, 'color': '#059669'},
        {'status': 'Cancelled', 'count': cancelled_bookings, 'color': '#dc2626'},
        {'status': 'Rejected', 'count': rejected_bookings, 'color': '#64748b'},
    ]

    # Popular categories by interaction counts
    category_counts = (
        interactions.filter(category__isnull=False)
        .values('category')
        .annotate(views=Count('id'))
        .order_by('-views')[:8]
    )
    popular_categories = [{'category': c['category'], 'views': c['views']} for c in category_counts]

    # Popular listings by views
    venue_views = (
        interactions.filter(venue__isnull=False, event_type='LISTING_VIEW')
        .values('venue_id', 'venue__title', 'venue__category', 'venue__location')
        .annotate(views=Count('id'))
        .order_by('-views')[:6]
    )
    popular_venues = [
        {
            'id': v['venue_id'],
            'title': v['venue__title'],
            'type': 'Venue',
            'category': v['venue__category'],
            'location': v['venue__location'],
            'views': v['views'],
            'booking_requests': bookings.filter(venue_id=v['venue_id']).count()
        }
        for v in venue_views
    ]

    vendor_views = (
        interactions.filter(vendor__isnull=False, event_type='LISTING_VIEW')
        .values('vendor_id', 'vendor__business_name', 'vendor__vendor_type', 'vendor__location')
        .annotate(views=Count('id'))
        .order_by('-views')[:6]
    )
    popular_vendors = [
        {
            'id': vd['vendor_id'],
            'title': vd['vendor__business_name'],
            'type': 'Vendor Service',
            'category': vd['vendor__vendor_type'],
            'location': vd['vendor__location'],
            'views': vd['views'],
            'booking_requests': bookings.filter(vendor_id=vd['vendor_id']).count()
        }
        for vd in vendor_views
    ]

    # Peak booking request days of week
    from collections import Counter
    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    day_counts = Counter(b.created_at.weekday() for b in bookings)
    peak_days = [{'day': day_names[i], 'requests': day_counts.get(i, 0)} for i in range(7)]

    # Over time trends
    trends = compute_daily_breakdown(interactions, bookings, start_dt, end_dt)

    return Response({
        'date_range': {
            'start': start_dt.strftime('%Y-%m-%d'),
            'end': end_dt.strftime('%Y-%m-%d'),
            'label': range_label,
        },
        'summary': {
            'total_searches': total_searches,
            'total_listing_views': total_listing_views,
            'unique_viewers': unique_viewers,
            'booking_requests': booking_requests,
            'confirmed_bookings': confirmed_bookings,
            'completed_bookings': completed_bookings,
            'cancelled_bookings': cancelled_bookings,
            'cancellation_rate': cancellation_rate,
            'search_to_booking_rate': search_to_booking_rate,
            'view_to_booking_rate': view_to_booking_rate,
        },
        'funnel': funnel,
        'status_distribution': status_distribution,
        'popular_categories': popular_categories,
        'popular_listings': popular_venues + popular_vendors,
        'peak_days': peak_days,
        'trends': trends,
    })


@api_view(['GET'])
def export_admin_analytics_csv(request):
    """
    Exports platform analytics as CSV.
    """
    if not is_admin_user(request):
        raise PermissionDenied("Access Denied: Platform Administrator privileges required.")

    start_dt, end_dt, range_label = parse_date_range(request)
    interactions = UserInteraction.objects.filter(timestamp__gte=start_dt, timestamp__lte=end_dt)
    bookings = Booking.objects.filter(created_at__gte=start_dt, created_at__lte=end_dt)

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="locyfy_admin_analytics_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv"'

    writer = csv.writer(response)
    writer.writerow(['LOCYFY PLATFORM ANALYTICS REPORT'])
    writer.writerow(['Date Range', range_label, f"{start_dt.strftime('%Y-%m-%d')} to {end_dt.strftime('%Y-%m-%d')}"])
    writer.writerow([])

    writer.writerow(['METRIC SUMMARY'])
    writer.writerow(['Metric', 'Value'])
    writer.writerow(['Total Searches', interactions.filter(event_type='SEARCH').count()])
    writer.writerow(['Total Listing Views', interactions.filter(event_type='LISTING_VIEW').count()])
    writer.writerow(['Booking Requests', bookings.count()])
    writer.writerow(['Confirmed Bookings', bookings.filter(status__in=['APPROVED', 'COMPLETED']).count()])
    writer.writerow(['Completed Bookings', bookings.filter(status='COMPLETED').count()])
    writer.writerow(['Cancelled Bookings', bookings.filter(status='CANCELLED').count()])
    writer.writerow([])

    writer.writerow(['DAILY TRENDS'])
    writer.writerow(['Date', 'Searches', 'Views', 'Clicks', 'Booking Requests', 'Confirmed'])
    trends = compute_daily_breakdown(interactions, bookings, start_dt, end_dt)
    for t in trends:
        writer.writerow([t['date'], t['searches'], t['views'], t['clicks'], t['booking_requests'], t['confirmed_bookings']])

    return response


def verify_vendor_access(request, vendor_id):
    """
    Ensures the requesting user is the owner of the vendor profile or an admin.
    """
    if is_admin_user(request):
        try:
            return VendorProfile.objects.get(pk=vendor_id)
        except VendorProfile.DoesNotExist:
            return None

    actor = get_actor_user(request)
    if not actor:
        return None
    try:
        vendor = VendorProfile.objects.get(pk=vendor_id)
        if vendor.user_id == actor.id:
            return vendor
    except VendorProfile.DoesNotExist:
        return None
    return None


@api_view(['GET'])
def vendor_analytics(request, vendor_id):
    """
    Analytics scoped strictly to a specific vendor.
    """
    vendor = verify_vendor_access(request, vendor_id)
    if not vendor:
        raise PermissionDenied("Access Denied: You are not authorized to view this vendor's analytics.")

    start_dt, end_dt, range_label = parse_date_range(request)

    # Interactions for this vendor (either direct vendor profile or their linked service listings)
    interactions = UserInteraction.objects.filter(
        Q(vendor=vendor) | Q(venue__vendor=vendor),
        timestamp__gte=start_dt,
        timestamp__lte=end_dt
    )

    # Bookings for this vendor
    bookings = Booking.objects.filter(
        Q(vendor=vendor) | Q(venue__vendor=vendor),
        created_at__gte=start_dt,
        created_at__lte=end_dt
    )

    service_views = interactions.filter(event_type='LISTING_VIEW').count()
    service_clicks = interactions.filter(event_type='LISTING_CLICK').count()

    auth_viewers = interactions.filter(event_type='LISTING_VIEW', user__isnull=False).values('user_id').distinct().count()
    anon_viewers = interactions.filter(event_type='LISTING_VIEW', user__isnull=True, session_id__isnull=False).values('session_id').distinct().count()
    unique_viewers = auth_viewers + anon_viewers

    booking_requests = bookings.count()
    confirmed_bookings = bookings.filter(status__in=['APPROVED', 'COMPLETED']).count()
    completed_bookings = bookings.filter(status='COMPLETED').count()
    cancelled_bookings = bookings.filter(status='CANCELLED').count()
    pending_bookings = bookings.filter(status='PENDING').count()

    cancellation_rate = round((cancelled_bookings / booking_requests * 100), 1) if booking_requests > 0 else 0.0
    conversion_rate = round((booking_requests / max(1, service_views) * 100), 1) if service_views > 0 else 0.0

    # Service-level performance (if vendor has multiple venue/service listings)
    services = Venue.objects.filter(vendor=vendor)
    service_performance = []
    for s in services:
        s_views = interactions.filter(venue=s, event_type='LISTING_VIEW').count()
        s_requests = bookings.filter(venue=s).count()
        service_performance.append({
            'id': s.id,
            'title': s.title,
            'category': s.category,
            'views': s_views,
            'requests': s_requests,
            'conversion_rate': round((s_requests / max(1, s_views) * 100), 1) if s_views > 0 else 0.0
        })
    service_performance.sort(key=lambda x: x['views'], reverse=True)

    # Peak days
    from collections import Counter
    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    day_counts = Counter(b.created_at.weekday() for b in bookings)
    peak_days = [{'day': day_names[i], 'requests': day_counts.get(i, 0)} for i in range(7)]

    trends = compute_daily_breakdown(interactions, bookings, start_dt, end_dt)

    return Response({
        'vendor_id': vendor.id,
        'business_name': vendor.business_name,
        'date_range': {
            'start': start_dt.strftime('%Y-%m-%d'),
            'end': end_dt.strftime('%Y-%m-%d'),
            'label': range_label,
        },
        'summary': {
            'service_views': service_views,
            'service_clicks': service_clicks,
            'unique_viewers': unique_viewers,
            'booking_requests': booking_requests,
            'confirmed_bookings': confirmed_bookings,
            'completed_bookings': completed_bookings,
            'cancelled_bookings': cancelled_bookings,
            'pending_bookings': pending_bookings,
            'cancellation_rate': cancellation_rate,
            'conversion_rate': conversion_rate,
        },
        'service_performance': service_performance,
        'peak_days': peak_days,
        'trends': trends,
    })


@api_view(['GET'])
def export_vendor_analytics_csv(request, vendor_id):
    """
    Exports scoped vendor analytics as CSV.
    """
    vendor = verify_vendor_access(request, vendor_id)
    if not vendor:
        raise PermissionDenied("Access Denied.")

    start_dt, end_dt, range_label = parse_date_range(request)
    interactions = UserInteraction.objects.filter(
        Q(vendor=vendor) | Q(venue__vendor=vendor),
        timestamp__gte=start_dt,
        timestamp__lte=end_dt
    )
    bookings = Booking.objects.filter(
        Q(vendor=vendor) | Q(venue__vendor=vendor),
        created_at__gte=start_dt,
        created_at__lte=end_dt
    )

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="vendor_{vendor_id}_analytics_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv"'

    writer = csv.writer(response)
    writer.writerow([f"LOCYFY VENDOR ANALYTICS REPORT - {vendor.business_name}"])
    writer.writerow(['Date Range', range_label, f"{start_dt.strftime('%Y-%m-%d')} to {end_dt.strftime('%Y-%m-%d')}"])
    writer.writerow([])

    writer.writerow(['Metric', 'Value'])
    writer.writerow(['Total Service Views', interactions.filter(event_type='LISTING_VIEW').count()])
    writer.writerow(['Total Service Clicks', interactions.filter(event_type='LISTING_CLICK').count()])
    writer.writerow(['Booking Requests Received', bookings.count()])
    writer.writerow(['Confirmed Bookings', bookings.filter(status__in=['APPROVED', 'COMPLETED']).count()])
    writer.writerow(['Completed Bookings', bookings.filter(status='COMPLETED').count()])
    writer.writerow(['Cancelled Bookings', bookings.filter(status='CANCELLED').count()])
    writer.writerow([])

    writer.writerow(['DAILY ACTIVITY TRENDS'])
    writer.writerow(['Date', 'Views', 'Clicks', 'Booking Requests', 'Confirmed'])
    trends = compute_daily_breakdown(interactions, bookings, start_dt, end_dt)
    for t in trends:
        writer.writerow([t['date'], t['views'], t['clicks'], t['booking_requests'], t['confirmed_bookings']])

    return response


def verify_venue_owner_access(request, owner_id):
    """
    Ensures the requesting user is the owner of the venue owner profile or an admin.
    """
    if is_admin_user(request):
        try:
            return VenueOwnerProfile.objects.get(pk=owner_id)
        except VenueOwnerProfile.DoesNotExist:
            return None

    actor = get_actor_user(request)
    if not actor:
        return None
    try:
        owner = VenueOwnerProfile.objects.get(pk=owner_id)
        if owner.user_id == actor.id:
            return owner
    except VenueOwnerProfile.DoesNotExist:
        return None
    return None


@api_view(['GET'])
def venue_owner_analytics(request, owner_id):
    """
    Analytics scoped strictly to a specific venue owner.
    """
    owner = verify_venue_owner_access(request, owner_id)
    if not owner:
        raise PermissionDenied("Access Denied: You are not authorized to view this venue owner's analytics.")

    start_dt, end_dt, range_label = parse_date_range(request)

    owner_venues = Venue.objects.filter(owner=owner)

    interactions = UserInteraction.objects.filter(
        venue__in=owner_venues,
        timestamp__gte=start_dt,
        timestamp__lte=end_dt
    )

    bookings = Booking.objects.filter(
        venue__in=owner_venues,
        created_at__gte=start_dt,
        created_at__lte=end_dt
    )

    venue_views = interactions.filter(event_type='LISTING_VIEW').count()
    venue_clicks = interactions.filter(event_type='LISTING_CLICK').count()

    auth_viewers = interactions.filter(event_type='LISTING_VIEW', user__isnull=False).values('user_id').distinct().count()
    anon_viewers = interactions.filter(event_type='LISTING_VIEW', user__isnull=True, session_id__isnull=False).values('session_id').distinct().count()
    unique_viewers = auth_viewers + anon_viewers

    booking_requests = bookings.count()
    confirmed_bookings = bookings.filter(status__in=['APPROVED', 'COMPLETED']).count()
    completed_bookings = bookings.filter(status='COMPLETED').count()
    cancelled_bookings = bookings.filter(status='CANCELLED').count()
    pending_bookings = bookings.filter(status='PENDING').count()

    cancellation_rate = round((cancelled_bookings / booking_requests * 100), 1) if booking_requests > 0 else 0.0
    conversion_rate = round((booking_requests / max(1, venue_views) * 100), 1) if venue_views > 0 else 0.0

    # Per-venue performance
    venue_performance = []
    total_days_in_period = max(1, (end_dt.date() - start_dt.date()).days + 1)

    for v in owner_venues:
        v_views = interactions.filter(venue=v, event_type='LISTING_VIEW').count()
        v_bookings = bookings.filter(venue=v)
        v_requests = v_bookings.count()
        v_confirmed = v_bookings.filter(status__in=['APPROVED', 'COMPLETED']).count()

        # Reliable venue utilization: Count distinct confirmed event dates during this period / total days in period
        confirmed_dates_count = v_bookings.filter(
            status__in=['APPROVED', 'COMPLETED'],
            event_date__gte=start_dt.date(),
            event_date__lte=end_dt.date()
        ).values('event_date').distinct().count()
        utilization_rate = round((confirmed_dates_count / total_days_in_period * 100), 1)

        venue_performance.append({
            'id': v.id,
            'title': v.title,
            'capacity': v.capacity,
            'views': v_views,
            'requests': v_requests,
            'confirmed_bookings': v_confirmed,
            'confirmed_days_occupied': confirmed_dates_count,
            'utilization_rate': utilization_rate,
            'conversion_rate': round((v_requests / max(1, v_views) * 100), 1) if v_views > 0 else 0.0
        })
    venue_performance.sort(key=lambda x: x['views'], reverse=True)

    # Peak days
    from collections import Counter
    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    day_counts = Counter(b.created_at.weekday() for b in bookings)
    peak_days = [{'day': day_names[i], 'requests': day_counts.get(i, 0)} for i in range(7)]

    trends = compute_daily_breakdown(interactions, bookings, start_dt, end_dt)

    return Response({
        'owner_id': owner.id,
        'business_name': owner.business_name,
        'date_range': {
            'start': start_dt.strftime('%Y-%m-%d'),
            'end': end_dt.strftime('%Y-%m-%d'),
            'label': range_label,
        },
        'summary': {
            'venue_views': venue_views,
            'venue_clicks': venue_clicks,
            'unique_viewers': unique_viewers,
            'booking_requests': booking_requests,
            'confirmed_bookings': confirmed_bookings,
            'completed_bookings': completed_bookings,
            'cancelled_bookings': cancelled_bookings,
            'pending_bookings': pending_bookings,
            'cancellation_rate': cancellation_rate,
            'conversion_rate': conversion_rate,
        },
        'venue_performance': venue_performance,
        'peak_days': peak_days,
        'trends': trends,
    })


@api_view(['GET'])
def export_venue_owner_analytics_csv(request, owner_id):
    """
    Exports scoped venue owner analytics as CSV.
    """
    owner = verify_venue_owner_access(request, owner_id)
    if not owner:
        raise PermissionDenied("Access Denied.")

    start_dt, end_dt, range_label = parse_date_range(request)
    owner_venues = Venue.objects.filter(owner=owner)

    interactions = UserInteraction.objects.filter(
        venue__in=owner_venues,
        timestamp__gte=start_dt,
        timestamp__lte=end_dt
    )
    bookings = Booking.objects.filter(
        venue__in=owner_venues,
        created_at__gte=start_dt,
        created_at__lte=end_dt
    )

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="venue_owner_{owner_id}_analytics_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv"'

    writer = csv.writer(response)
    writer.writerow([f"LOCYFY VENUE OWNER ANALYTICS REPORT - {owner.business_name}"])
    writer.writerow(['Date Range', range_label, f"{start_dt.strftime('%Y-%m-%d')} to {end_dt.strftime('%Y-%m-%d')}"])
    writer.writerow([])

    writer.writerow(['Metric', 'Value'])
    writer.writerow(['Total Venue Views', interactions.filter(event_type='LISTING_VIEW').count()])
    writer.writerow(['Total Venue Clicks', interactions.filter(event_type='LISTING_CLICK').count()])
    writer.writerow(['Booking Requests Received', bookings.count()])
    writer.writerow(['Confirmed Bookings', bookings.filter(status__in=['APPROVED', 'COMPLETED']).count()])
    writer.writerow(['Completed Bookings', bookings.filter(status='COMPLETED').count()])
    writer.writerow(['Cancelled Bookings', bookings.filter(status='CANCELLED').count()])
    writer.writerow([])

    writer.writerow(['DAILY VENUE ACTIVITY TRENDS'])
    writer.writerow(['Date', 'Views', 'Clicks', 'Booking Requests', 'Confirmed'])
    trends = compute_daily_breakdown(interactions, bookings, start_dt, end_dt)
    for t in trends:
        writer.writerow([t['date'], t['views'], t['clicks'], t['booking_requests'], t['confirmed_bookings']])

    return response


