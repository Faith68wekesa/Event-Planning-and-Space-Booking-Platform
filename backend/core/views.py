from rest_framework.authtoken.models import Token
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, action, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from .permissions import IsAuthenticatedCustomer
from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Count, Prefetch, Q, Sum
from .models import (
    User, VendorProfile, VenueOwnerProfile, Venue, PortfolioImage, Booking, Review, EmailOTP, Message, Event, EventService,
    ProviderAvailabilitySetting,
    Notification, CustomerReminderPreference, VerificationDocument, UserInteraction,
    Payment,
)
from .serializers import (
    UserSerializer, VendorProfileSerializer, VenueOwnerProfileSerializer, VenueSerializer, 
    PortfolioImageSerializer, BookingSerializer, ReviewSerializer, MessageSerializer, EventSerializer, EventServiceSerializer,
    NotificationSerializer, CustomerReminderPreferenceSerializer, VerificationDocumentSerializer,
    UserInteractionSerializer, PaymentSerializer,
)
from .services.reminder_service import evaluate_and_generate_reminders
from .services import mpesa as mpesa_service
from .location_utils import nyeri_county_location_filter
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
import logging
import random
import datetime
import os
import uuid
from decimal import Decimal, ROUND_HALF_UP
from django.utils import timezone
from django.conf import settings
from django.http import Http404
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.core.files.storage import FileSystemStorage
from rest_framework.parsers import MultiPartParser, FormParser
from .services import payouts as payout_service
from .ml.recommender import (
    get_venue_recommendations as compute_venue_recommendations,
    get_vendor_recommendations as compute_vendor_recommendations,
    get_service_recommendations as compute_service_recommendations,
)
# from .ml.fraud_detector import create_fraud_alert

def get_venue_recommendations(user=None, limit=6, preferences=None):
    return compute_venue_recommendations(
        customer=user,
        preferences=preferences,
        top_k=limit,
    )

def get_vendor_recommendations(user=None, limit=6, preferences=None):
    return compute_vendor_recommendations(
        customer=user,
        preferences=preferences,
        top_k=limit,
    )

def create_fraud_alert(booking):
    return None


def is_admin_user(request):
    user = getattr(request, 'user', None)

    return bool(
        user
        and user.is_authenticated
        and (
            getattr(user, 'role', '') == 'ADMIN'
            or getattr(user, 'is_staff', False)
            or getattr(user, 'is_superuser', False)
        )
    )


def _is_approved_business_profile(profile):
    return bool(
        profile
        and profile.is_verified
        and profile.verification_status == 'APPROVED'
    )


def _reset_preapproved_listings(profile, profile_field):
    other_field = 'owner' if profile_field == 'vendor' else 'vendor'
    listings = Venue.objects.filter(
        **{profile_field: profile, 'approval_status': 'APPROVED'}
    ).select_related('owner', 'vendor')
    for listing in listings:
        if _is_approved_business_profile(getattr(listing, other_field)):
            continue
        listing.approval_status = 'PENDING'
        listing.is_verified = False
        listing.save(update_fields=['approval_status', 'is_verified'])


def _get_public_catalog_queryset(queryset=None, include_unavailable=False):
    queryset = queryset if queryset is not None else Venue.objects.all()

    public_queryset = queryset.filter(
        approval_status='APPROVED',
        is_verified=True
    ).filter(
        Q(
            owner__is_verified=True,
            owner__verification_status='APPROVED',
            owner__user__is_active=True,
        ) |
        Q(
            vendor__is_verified=True,
            vendor__verification_status='APPROVED',
            vendor__user__is_active=True,
        )
    ).filter(
        nyeri_county_location_filter()
    )
    if not include_unavailable:
        public_queryset = public_queryset.filter(is_available=True)
    return public_queryset


def _get_date_availability_data(
    *,
    event_date,
    provider_user,
    bookings,
    target_name,
    capacity=None,
    listing_is_available=True,
):
    setting = (
        ProviderAvailabilitySetting.objects.filter(user=provider_user).first()
        if provider_user else None
    )
    if capacity is None:
        capacity = setting.max_guests if setting else 0

    date_key = event_date.isoformat()
    unavailable_dates = []
    day_statuses = {}
    if setting:
        unavailable_dates = setting.unavailable_dates or []
        day_statuses = setting.day_statuses or {}
    is_date_blocked = (
        day_statuses.get(date_key) == 'UNAVAILABLE'
        or date_key in unavailable_dates
    )
    booked_guests = bookings.filter(
        event_date=event_date,
        status__in=['APPROVED', 'COMPLETED'],
    ).aggregate(total=Sum('guest_count'))['total'] or 0
    total_capacity = max(0, int(capacity or 0))
    remaining_capacity = max(0, total_capacity - booked_guests)

    if not listing_is_available:
        availability_status = 'UNAVAILABLE'
        message = f"'{target_name}' is currently unavailable for bookings."
    elif is_date_blocked:
        availability_status = 'UNAVAILABLE'
        message = f"'{target_name}' is unavailable on {date_key}; the provider marked this date unavailable."
    elif total_capacity == 0:
        availability_status = 'CAPACITY_NEEDED'
        message = f'The provider has not set a guest capacity for {target_name}.'
    elif remaining_capacity == 0:
        availability_status = 'FULL'
        message = f"'{target_name}' is fully booked on {date_key} ({total_capacity} guests)."
    else:
        availability_status = 'AVAILABLE'
        message = (
            f"'{target_name}' is available: {remaining_capacity} of "
            f'{total_capacity} guest spaces remaining.'
        )

    return {
        'date': date_key,
        'available': availability_status == 'AVAILABLE',
        'status': availability_status,
        'total_capacity': total_capacity,
        'booked_guests': booked_guests,
        'remaining_capacity': remaining_capacity,
        'message': message,
    }


def _parse_availability_date(request):
    date_value = request.query_params.get('date')
    try:
        parsed_date = datetime.datetime.strptime(date_value, '%Y-%m-%d').date()
    except (TypeError, ValueError):
        raise ValidationError({'date': 'A date in YYYY-MM-DD format is required.'})
    return parsed_date


def _notify_admins(*, title, message, target_tab, booking=None, exclude_user_id=None):
    admins = User.objects.filter(
        Q(role='ADMIN') | Q(is_staff=True) | Q(is_superuser=True),
        is_active=True,
    ).distinct()
    if exclude_user_id:
        admins = admins.exclude(pk=exclude_user_id)
    for admin in admins:
        Notification.objects.create(
            user=admin,
            booking=booking,
            title=title,
            message=message,
            target_tab=target_tab,
            notification_type='SYSTEM',
        )


def _get_booking_provider_users(booking):
    provider_users = {}
    if booking.venue:
        if booking.venue.owner and booking.venue.owner.user:
            provider_users[booking.venue.owner.user_id] = booking.venue.owner.user
        if booking.venue.vendor and booking.venue.vendor.user:
            provider_users[booking.venue.vendor.user_id] = booking.venue.vendor.user
    if booking.vendor and booking.vendor.user:
        provider_users[booking.vendor.user_id] = booking.vendor.user
    return list(provider_users.values())


def _get_booking_listing_name(booking):
    if booking.venue:
        return booking.venue.title
    if booking.vendor:
        return booking.vendor.business_name
    return booking.event_title


def _get_listing_provider_users(listing):
    provider_users = {}
    if listing.owner and listing.owner.user:
        provider_users[listing.owner.user_id] = listing.owner.user
    if listing.vendor and listing.vendor.user:
        provider_users[listing.vendor.user_id] = listing.vendor.user
    return list(provider_users.values())


def _notify_listing_providers(listing, *, title, message):
    for provider in _get_listing_provider_users(listing):
        Notification.objects.create(
            user=provider,
            title=title,
            message=message,
            target_tab='listings',
            notification_type='SYSTEM',
        )


class ProviderAvailabilitySettingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import ProviderAvailabilitySetting
        from .serializers import ProviderAvailabilitySettingSerializer

        setting, _ = ProviderAvailabilitySetting.objects.get_or_create(user=request.user)
        serializer = ProviderAvailabilitySettingSerializer(setting, context={'request': request})
        return Response(serializer.data)

    def put(self, request):
        from .models import ProviderAvailabilitySetting
        from .serializers import ProviderAvailabilitySettingSerializer

        setting, _ = ProviderAvailabilitySetting.objects.get_or_create(user=request.user)
        serializer = ProviderAvailabilitySettingSerializer(
            setting,
            data=request.data,
            partial=True,
            context={'request': request}
        )

        if serializer.is_valid():
            previously_blocked_dates = {
                date_value
                for date_value in (setting.unavailable_dates or [])
                if isinstance(date_value, str)
            }
            previously_blocked_dates.update(
                date_value
                for date_value, day_status in (setting.day_statuses or {}).items()
                if day_status == 'UNAVAILABLE'
            )

            with transaction.atomic():
                serializer.save(user=request.user)
                setting.refresh_from_db()
                newly_blocked_dates = {
                    date_value
                    for date_value in (setting.unavailable_dates or [])
                    if isinstance(date_value, str)
                }
                newly_blocked_dates.update(
                    date_value
                    for date_value, day_status in (setting.day_statuses or {}).items()
                    if day_status == 'UNAVAILABLE'
                )
                newly_blocked_dates.difference_update(previously_blocked_dates)
                blocked_dates = []
                for date_value in newly_blocked_dates:
                    try:
                        blocked_dates.append(datetime.date.fromisoformat(date_value))
                    except ValueError:
                        continue

                if blocked_dates:
                    _notify_admins(
                        title='Provider availability updated',
                        message=(
                            f'{request.user.get_full_name() or request.user.username} '
                            f'marked {len(blocked_dates)} date(s) unavailable.'
                        ),
                        target_tab='venues',
                        exclude_user_id=request.user.id if is_admin_user(request) else None,
                    )

                if blocked_dates:
                    affected_bookings = Booking.objects.filter(
                        event_date__in=blocked_dates,
                        status__in=['PENDING', 'APPROVED'],
                    ).filter(
                        Q(venue__owner__user=request.user)
                        | Q(venue__vendor__user=request.user)
                        | Q(vendor__user=request.user)
                    ).select_related('customer', 'venue', 'vendor')
                    for booking in affected_bookings:
                        listing_name = booking.event_title
                        if booking.venue:
                            listing_name = booking.venue.title
                        elif booking.vendor:
                            listing_name = booking.vendor.business_name
                        Notification.objects.create(
                            user=booking.customer,
                            booking=booking,
                            title='Listing date unavailable',
                            message=(
                                f'{listing_name} is now marked unavailable on '
                                f'{booking.event_date.isoformat()}. Please contact '
                                'the provider to discuss your booking.'
                            ),
                            target_tab='bookings',
                            notification_type='LISTING_AVAILABILITY',
                        )
            return Response(serializer.data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_object(self):
        vendor = super().get_object()
        if (
            self.action in ['update', 'partial_update', 'destroy']
            and not is_admin_user(self.request)
            and vendor.user_id != self.request.user.id
        ):
            raise PermissionDenied("You do not have permission to modify this profile.")
        return vendor

    def perform_create(self, serializer):
        vendor = serializer.save(user=self.request.user)
        _notify_admins(
            title='Business account submitted',
            message=f'{vendor.business_name} submitted a vendor account for review.',
            target_tab='verifications',
        )

    def perform_update(self, serializer):
        vendor = serializer.instance
        will_be_approved = (
            serializer.validated_data.get('verification_status', vendor.verification_status) == 'APPROVED'
            and serializer.validated_data.get('is_verified', vendor.is_verified)
        )
        if will_be_approved and not _is_approved_business_profile(vendor):
            _reset_preapproved_listings(vendor, 'vendor')
        serializer.save()

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

        if not is_admin:
            if self.action in ['update', 'partial_update', 'destroy']:
                pass
            elif user or all_status:
                if not self.request.user.is_authenticated:
                    return queryset.none()
                if user and str(self.request.user.pk) != str(user):
                    return queryset.none()
                queryset = queryset.filter(user_id=self.request.user.pk)
            else:
                today = datetime.date.today()
                verified_vendor_ids = VerificationDocument.objects.filter(
                    vendor__isnull=False,
                    status='APPROVED'
                ).filter(
                    Q(expiry_date__isnull=True) | Q(expiry_date__gte=today)
                ).values_list('vendor_id', flat=True)
                public_profiles = (
                    Q(is_verified=True, verification_status='APPROVED')
                    | Q(id__in=verified_vendor_ids)
                )
                if self.request.user.is_authenticated:
                    public_profiles |= Q(user_id=self.request.user.pk)
                queryset = queryset.filter(public_profiles)

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
        if user and is_admin:
            queryset = queryset.filter(user_id=user)
        if verified == 'true':
            queryset = queryset.filter(is_verified=True)

        return queryset

    @action(detail=True, methods=['get'], url_path='availability', permission_classes=[AllowAny])
    def availability(self, request, pk=None):
        event_date = _parse_availability_date(request)
        vendor = self.get_object()
        is_provider_active = (
            vendor.is_verified
            and vendor.verification_status == 'APPROVED'
            and vendor.user.is_active
        )
        return Response(_get_date_availability_data(
            event_date=event_date,
            provider_user=vendor.user,
            bookings=Booking.objects.filter(vendor=vendor),
            target_name=vendor.business_name,
            listing_is_available=is_provider_active,
        ))

    @action(detail=True, methods=['post'])
    def toggle_verify(self, request, pk=None):
        if not is_admin_user(request):
            raise PermissionDenied("Access Denied: Only platform administrators can verify vendor credentials.")
        vendor = self.get_object()
        if not vendor.is_verified:
            _reset_preapproved_listings(vendor, 'vendor')
        vendor.is_verified = not vendor.is_verified
        vendor.verification_status = 'APPROVED' if vendor.is_verified else 'PENDING'
        vendor.save()
        Notification.objects.create(
            user=vendor.user,
            title='Business account status updated',
            message=f'Your business account was {vendor.verification_status.lower()}.',
            target_tab='profile',
            notification_type='SYSTEM',
        )
        return Response(VendorProfileSerializer(vendor).data)

    @action(detail=True, methods=['post', 'patch'])
    def set_verification(self, request, pk=None):
        if not is_admin_user(request):
            raise PermissionDenied("Access Denied: Only platform administrators can verify vendor credentials.")
        vendor = self.get_object()
        new_status = request.data.get('verification_status')
        if new_status in ['APPROVED', 'REJECTED', 'PENDING']:
            if new_status == 'APPROVED' and not _is_approved_business_profile(vendor):
                _reset_preapproved_listings(vendor, 'vendor')
            old_status = vendor.verification_status
            vendor.verification_status = new_status
            vendor.is_verified = (new_status == 'APPROVED')
            vendor.save()
            if old_status != new_status:
                Notification.objects.create(
                    user=vendor.user,
                    title='Business account status updated',
                    message=f'Your business account was {new_status.lower()}.',
                    target_tab='profile',
                    notification_type='SYSTEM',
                )
            return Response(VendorProfileSerializer(vendor).data)
        return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)


class VenueOwnerProfileViewSet(viewsets.ModelViewSet):
    queryset = VenueOwnerProfile.objects.all().order_by('-created_at')
    serializer_class = VenueOwnerProfileSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_object(self):
        owner = super().get_object()
        if (
            self.action in ['update', 'partial_update', 'destroy']
            and not is_admin_user(self.request)
            and owner.user_id != self.request.user.id
        ):
            raise PermissionDenied("You do not have permission to modify this profile.")
        return owner

    def perform_create(self, serializer):
        owner = serializer.save(user=self.request.user)
        _notify_admins(
            title='Business account submitted',
            message=f'{owner.business_name} submitted a venue-owner account for review.',
            target_tab='verifications',
        )

    def perform_update(self, serializer):
        owner = serializer.instance
        will_be_approved = (
            serializer.validated_data.get('verification_status', owner.verification_status) == 'APPROVED'
            and serializer.validated_data.get('is_verified', owner.is_verified)
        )
        if will_be_approved and not _is_approved_business_profile(owner):
            _reset_preapproved_listings(owner, 'owner')
        serializer.save()

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        search = params.get('search')
        location = params.get('location')
        verified = params.get('verified')
        user = params.get('user') or params.get('user_id')
        all_status = params.get('all_status') == 'true'

        is_admin = is_admin_user(self.request)

        if is_admin:
            pass
        elif self.action in ['update', 'partial_update', 'destroy', 'toggle_verify', 'set_verification']:
            pass
        else:
            if user or all_status:
                if not self.request.user.is_authenticated:
                    return queryset.none()
                if user and str(self.request.user.pk) != str(user):
                    return queryset.none()
                queryset = queryset.filter(user_id=self.request.user.pk)
            else:
                today = datetime.date.today()
                verified_owner_ids = VerificationDocument.objects.filter(
                    venue_owner__isnull=False,
                    status='APPROVED'
                ).filter(
                    Q(expiry_date__isnull=True) | Q(expiry_date__gte=today)
                ).values_list('venue_owner_id', flat=True)
                public_profiles = (
                    Q(is_verified=True, verification_status='APPROVED')
                    | Q(id__in=verified_owner_ids)
                )
                if self.request.user.is_authenticated:
                    public_profiles |= Q(user_id=self.request.user.pk)
                queryset = queryset.filter(public_profiles)

        if search:
            queryset = queryset.filter(
                Q(business_name__icontains=search) | 
                Q(location__icontains=search) |
                Q(business_type__icontains=search)
            )
        if location and location != 'ALL':
            queryset = queryset.filter(location__icontains=location)
        if user and is_admin:
            queryset = queryset.filter(user_id=user)
        if verified == 'true':
            queryset = queryset.filter(is_verified=True)

        return queryset

    @action(detail=True, methods=['post'])
    def toggle_verify(self, request, pk=None):
        if not is_admin_user(request):
            raise PermissionDenied("Access Denied: Only platform administrators can verify venue owners.")
        owner = self.get_object()
        if not owner.is_verified:
            _reset_preapproved_listings(owner, 'owner')
        owner.is_verified = not owner.is_verified
        owner.verification_status = 'APPROVED' if owner.is_verified else 'PENDING'
        owner.save()
        Notification.objects.create(
            user=owner.user,
            title='Business account status updated',
            message=f'Your business account was {owner.verification_status.lower()}.',
            target_tab='profile',
            notification_type='SYSTEM',
        )
        return Response(VenueOwnerProfileSerializer(owner).data)

    @action(detail=True, methods=['post', 'patch'])
    def set_verification(self, request, pk=None):
        if not is_admin_user(request):
            raise PermissionDenied("Access Denied: Only platform administrators can verify venue owners.")
        owner = self.get_object()
        new_status = request.data.get('verification_status')
        if new_status in ['APPROVED', 'REJECTED', 'PENDING']:
            if new_status == 'APPROVED' and not _is_approved_business_profile(owner):
                _reset_preapproved_listings(owner, 'owner')
            old_status = owner.verification_status
            owner.verification_status = new_status
            owner.is_verified = (new_status == 'APPROVED')
            owner.save()
            if old_status != new_status:
                Notification.objects.create(
                    user=owner.user,
                    title='Business account status updated',
                    message=f'Your business account was {new_status.lower()}.',
                    target_tab='profile',
                    notification_type='SYSTEM',
                )
            return Response(VenueOwnerProfileSerializer(owner).data)
        return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)


class VenueViewSet(viewsets.ModelViewSet):
    queryset = Venue.objects.all().prefetch_related('portfolio').order_by('-created_at')
    serializer_class = VenueSerializer

    def get_permissions(self):
        if self.action in [
            'create',
            'update',
            'partial_update',
            'destroy',
            'toggle_availability',
            'my_listings',
        ]:
            return [IsAuthenticated()]

        return [AllowAny()]

    @action(detail=False, methods=['get'], url_path='my-listings')
    def my_listings(self, request):
        user = request.user
        if not (
            getattr(user, 'is_vendor', False)
            or getattr(user, 'is_venue_owner', False)
            or getattr(user, 'role', '') in ['PROVIDER', 'VENDOR', 'VENUE_OWNER']
        ):
            raise PermissionDenied(
                "Only providers can access their own listings."
            )

        listings = Venue.objects.filter(
            Q(owner__user_id=user.pk) |
            Q(vendor__user_id=user.pk)
        ).distinct().prefetch_related('portfolio').order_by('-created_at')
        serializer = self.get_serializer(listings, many=True)
        return Response(serializer.data)

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        if is_admin_user(self.request):
            pass
        else:
            public_catalog = _get_public_catalog_queryset(queryset)

            if self.request.user.is_authenticated and (
                getattr(self.request.user, 'is_vendor', False)
                or getattr(self.request.user, 'is_venue_owner', False)
                or getattr(self.request.user, 'role', '') in ['PROVIDER', 'VENDOR', 'VENUE_OWNER']
            ):
                owned_venues = queryset.filter(
                    Q(owner__user_id=self.request.user.pk) |
                    Q(vendor__user_id=self.request.user.pk)
                )
                queryset = (public_catalog | owned_venues).distinct()
            else:
                queryset = public_catalog

        search = params.get('search')
        category = params.get('category')
        location = params.get('location')
        max_price = params.get('max_price')
        min_capacity = params.get('min_capacity')
        verified = params.get('verified')

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
            queryset = queryset.filter(
                is_verified=True,
                approval_status='APPROVED'
            )

        return queryset

    @action(detail=True, methods=['get'], url_path='availability', permission_classes=[AllowAny])
    def availability(self, request, pk=None):
        event_date = _parse_availability_date(request)
        venue = _get_public_catalog_queryset(
            queryset=Venue.objects.select_related('owner__user', 'vendor__user'),
            include_unavailable=True,
        ).filter(pk=pk).first()
        if venue is None:
            raise Http404

        provider_user = None
        if venue.owner and venue.owner.user:
            provider_user = venue.owner.user
        elif venue.vendor and venue.vendor.user:
            provider_user = venue.vendor.user

        return Response(_get_date_availability_data(
            event_date=event_date,
            provider_user=provider_user,
            bookings=Booking.objects.filter(venue=venue),
            target_name=venue.title,
            capacity=venue.capacity,
            listing_is_available=venue.is_available,
        ))

    def perform_create(self, serializer):
        user = self.request.user
        vendor_profile = getattr(user, 'vendor_profile', None)
        owner_profile = getattr(user, 'venue_owner_profile', None)

        if not vendor_profile and not owner_profile:
            raise PermissionDenied(
                "You need a provider or venue owner profile to create a listing."
            )
        if not any(
            profile
            and profile.is_verified
            and profile.verification_status == 'APPROVED'
            for profile in (vendor_profile, owner_profile)
        ):
            raise PermissionDenied(
                "Your business account must be approved before you can create listings."
            )

        with transaction.atomic():
            listing = serializer.save(
                vendor=vendor_profile,
                owner=owner_profile,
                approval_status='PENDING',
                is_verified=False
            )
            _notify_admins(
                title='Listing submitted for approval',
                message=f'{listing.title} was submitted for administrator review.',
                target_tab='venues',
            )

    def perform_update(self, serializer):
        instance = serializer.instance
        if not is_admin_user(self.request):
            validated = serializer.validated_data
            critical_fields = ['title', 'category', 'price_per_day', 'capacity', 'image_url']
            has_critical_changes = any(f in validated and validated[f] != getattr(instance, f) for f in critical_fields)
            if has_critical_changes and instance.approval_status == 'APPROVED':
                listing = serializer.save(approval_status='PENDING', is_verified=False)
                _notify_admins(
                    title='Listing resubmitted for approval',
                    message=f'{listing.title} was edited and needs administrator review again.',
                    target_tab='venues',
                )
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
        Venue.objects.filter(pk=venue.pk).update(is_verified=not venue.is_verified)
        venue.refresh_from_db()
        _notify_listing_providers(
            venue,
            title='Listing verification updated',
            message=f'Verification for {venue.title} was {"approved" if venue.is_verified else "removed"}.',
        )
        return Response({'status': 'updated', 'approval_status': venue.approval_status, 'is_verified': venue.is_verified})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        if not is_admin_user(request):
            raise PermissionDenied("Access Denied: Only platform administrators can approve listings.")
        venue = self.get_object()
        if not venue.has_approved_business_account:
            return Response(
                {'error': 'Approve the linked business account before approving this listing.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        venue.approval_status = 'APPROVED'
        venue.is_verified = True
        venue.rejection_reason = None
        venue.save(update_fields=['approval_status', 'is_verified', 'rejection_reason'])
        _notify_listing_providers(
            venue,
            title='Listing approved',
            message=f'Your listing "{venue.title}" has been approved and is now available.',
        )
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
        _notify_listing_providers(
            venue,
            title='Listing requires changes',
            message=f'Your listing "{venue.title}" was not approved: {reason}',
        )
        return Response(VenueSerializer(venue).data)

    @action(detail=True, methods=['post', 'patch'])
    def toggle_availability(self, request, pk=None):
        venue = self.get_object()

        if not is_admin_user(request):
            user_id = request.user.id

            is_owner = (
                venue.owner is not None and
                venue.owner.user_id == user_id
            )
            is_vendor = (
                venue.vendor is not None and
                venue.vendor.user_id == user_id
            )

            if not (is_owner or is_vendor):
                raise PermissionDenied(
                    "You do not have permission to change this listing's availability."
                )

        venue.is_available = not venue.is_available
        venue.save(update_fields=['is_available'])
        if not venue.is_available:
            affected_bookings = Booking.objects.filter(
                venue=venue,
                event_date__gte=datetime.date.today(),
                status__in=['PENDING', 'APPROVED'],
            ).select_related('customer')
            for booking in affected_bookings:
                Notification.objects.create(
                    user=booking.customer,
                    booking=booking,
                    title='Listing unavailable',
                    message=(
                        f'{venue.title} is currently unavailable. Please contact '
                        'the provider about your booking.'
                    ),
                    target_tab='bookings',
                    notification_type='LISTING_AVAILABILITY',
                )
        _notify_admins(
            title='Listing availability updated',
            message=(
                f'{venue.title} was marked '
                f'{"available" if venue.is_available else "unavailable"} by '
                f'{"an administrator" if is_admin_user(request) else "a provider"}.'
            ),
            target_tab='venues',
            exclude_user_id=request.user.id if is_admin_user(request) else None,
        )

        return Response({
            'status': 'updated',
            'is_available': venue.is_available
        })

    def destroy(self, request, *args, **kwargs):
        venue = self.get_object()

        if not is_admin_user(request):
            user_id = request.user.id

            is_owner = (
                venue.owner is not None and
                venue.owner.user_id == user_id
            )
            is_vendor = (
                venue.vendor is not None and
                venue.vendor.user_id == user_id
            )

            if not (is_owner or is_vendor):
                raise PermissionDenied(
                    "Only the listing owner or an administrator can delete this listing."
                )

        venue.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class PortfolioImageViewSet(viewsets.ModelViewSet):
    queryset = PortfolioImage.objects.select_related('venue', 'venue__owner', 'venue__vendor').all()
    serializer_class = PortfolioImageSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated()]
        return [AllowAny()]

    def _owns_listing(self, venue, user):
        return bool(
            user
            and user.is_authenticated
            and (
                (venue.owner and venue.owner.user_id == user.id)
                or (venue.vendor and venue.vendor.user_id == user.id)
            )
        )

    def get_queryset(self):
        queryset = super().get_queryset()
        if is_admin_user(self.request):
            return queryset

        user = self.request.user
        owned = Q(venue__owner__user_id=user.pk) | Q(venue__vendor__user_id=user.pk)
        if self.action in ['update', 'partial_update', 'destroy']:
            return queryset.filter(owned) if user.is_authenticated else queryset.none()

        public_venues = _get_public_catalog_queryset()
        public_or_owned = Q(venue__in=public_venues)
        if user.is_authenticated and (
            getattr(user, 'is_vendor', False)
            or getattr(user, 'is_venue_owner', False)
            or getattr(user, 'role', '') in ['PROVIDER', 'VENDOR', 'VENUE_OWNER']
        ):
            public_or_owned |= owned
        return queryset.filter(public_or_owned).distinct()

    def _ensure_listing_owner(self, venue):
        user = self.request.user
        if not is_admin_user(self.request) and not self._owns_listing(venue, user):
            raise PermissionDenied("You can only manage portfolio images for your own listings.")

    def perform_create(self, serializer):
        self._ensure_listing_owner(serializer.validated_data['venue'])
        serializer.save()

    def perform_update(self, serializer):
        venue = serializer.validated_data.get('venue', serializer.instance.venue)
        self._ensure_listing_owner(venue)
        serializer.save()

    def perform_destroy(self, instance):
        self._ensure_listing_owner(instance.venue)
        instance.delete()


class BookingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedCustomer]
    queryset = Booking.objects.all().order_by('-created_at')
    serializer_class = BookingSerializer

    def get_queryset(self):
        queryset = super().get_queryset().prefetch_related(
            Prefetch(
                'payments',
                queryset=Payment.objects.filter(
                    status='SUCCESS',
                    is_simulated=False,
                    commission_amount__isnull=False,
                ).order_by('-paid_at', '-created_at'),
                to_attr='commissioned_payments',
            ),
            Prefetch(
                'payments',
                queryset=Payment.objects.filter(
                    status='SUCCESS',
                    is_simulated=True,
                ).order_by('-created_at'),
                to_attr='simulated_payments',
            ),
        )
        params = getattr(self.request, 'query_params', getattr(self.request, 'GET', {}))
        customer_id = params.get('customer') or params.get('customer_id')
        vendor_id = params.get('vendor') or params.get('vendor_id')
        owner_id = params.get('owner') or params.get('owner_id')
        user_id = params.get('user') or params.get('user_id')
        status_param = params.get('status')

        if not is_admin_user(self.request):
            authenticated_user_id = self.request.user.id
            queryset = queryset.filter(
                Q(customer_id=authenticated_user_id) |
                Q(venue__owner__user_id=authenticated_user_id) |
                Q(venue__vendor__user_id=authenticated_user_id) |
                Q(vendor__user_id=authenticated_user_id)
            )

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
        with transaction.atomic():
            overdue_booking_ids = list(
                Booking.objects.select_for_update()
                .filter(status='APPROVED', event_date__lt=today)
                .values_list('id', flat=True)
            )
            overdue_bookings = list(
                Booking.objects.filter(id__in=overdue_booking_ids).select_related(
                    'customer',
                    'venue__owner__user',
                    'venue__vendor__user',
                    'vendor__user',
                )
            )
            if overdue_bookings:
                overdue_ids = [booking.id for booking in overdue_bookings]
                Booking.objects.filter(
                    id__in=overdue_ids,
                    status='APPROVED',
                ).update(status='COMPLETED')
                for booking in overdue_bookings:
                    listing_name = _get_booking_listing_name(booking)
                    Notification.objects.create(
                        user=booking.customer,
                        booking=booking,
                        title='Booking marked completed',
                        message=f'Your event at {listing_name} has been marked completed.',
                        target_tab='bookings',
                        notification_type='BOOKING_UPDATE',
                    )
                    for provider in _get_booking_provider_users(booking):
                        Notification.objects.create(
                            user=provider,
                            booking=booking,
                            title='Booking marked completed',
                            message=f'The booking for {listing_name} has been marked completed.',
                            target_tab='bookings',
                            notification_type='BOOKING_UPDATE',
                        )
                    _notify_admins(
                        title='Booking marked completed',
                        message=f'The booking for {listing_name} was automatically completed.',
                        target_tab='bookings',
                        booking=booking,
                    )

        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset

    def perform_create(self, serializer):
        serializer.save(customer=self.request.user)

    def create(self, request, *args, **kwargs):
        from django.db import transaction
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            self.perform_create(serializer)
            booking_obj = serializer.instance
            listing_name = _get_booking_listing_name(booking_obj)
            for provider in _get_booking_provider_users(booking_obj):
                Notification.objects.create(
                    user=provider,
                    booking=booking_obj,
                    title='New booking request',
                    message=f'{booking_obj.customer.get_full_name() or booking_obj.customer.username} requested {listing_name}.',
                    target_tab='bookings',
                    notification_type='BOOKING_UPDATE',
                )
            _notify_admins(
                title='New booking received',
                message=f'A booking request for {listing_name} was submitted by {booking_obj.customer.username}.',
                target_tab='bookings',
                booking=booking_obj,
                exclude_user_id=request.user.id if is_admin_user(request) else None,
            )
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
        transaction.on_commit(
            lambda: self._run_fraud_detection(booking_obj)
        )
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def _run_fraud_detection(self, booking):
        import logging
        logger = logging.getLogger(__name__)
        try:
            create_fraud_alert(booking)
        except Exception:
            logger.exception(
                'Fraud detection failed for booking ID %s',
                booking.id
            )

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
                booking = Booking.objects.select_for_update().get(pk=pk)

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

                provider_uid = None
                if booking.venue:
                    if booking.venue.owner and booking.venue.owner.user_id:
                        provider_uid = booking.venue.owner.user_id
                    elif booking.venue.vendor and booking.venue.vendor.user_id:
                        provider_uid = booking.venue.vendor.user_id
                elif booking.vendor and booking.vendor.user_id:
                    provider_uid = booking.vendor.user_id

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

                if new_status == 'CANCELLED':
                    cancellation_reason = request.data.get('reason', '').strip() or request.data.get('cancellation_reason', '').strip()
                    cancelling_party = 'ADMIN' if is_admin else ('CUSTOMER' if acting_user_id == booking.customer_id else 'PROVIDER')

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

                if new_status == 'REJECTED':
                    rejection_reason = request.data.get('reason', '').strip() or request.data.get('rejection_reason', '').strip() or 'Provider is unavailable or unable to host this request.'
                    booking.rejection_reason = rejection_reason

                if new_status == 'COMPLETED':
                    today = datetime.date.today()
                    if booking.event_date > today and not is_admin:
                        return Response(
                            {'error': f"Cannot mark booking completed before the event date ({booking.event_date})."},
                            status=status.HTTP_400_BAD_REQUEST
                        )

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
                if new_status == 'CANCELLED':
                    payout_service.flag_booking_payments_for_reconciliation(booking)
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
                if acting_user_id != booking.customer_id:
                    listing_name = _get_booking_listing_name(booking)
                    Notification.objects.create(
                        user=booking.customer,
                        booking=booking,
                        title='Booking status updated',
                        message=(
                            f'Your booking for {listing_name} is now '
                            f'{booking.get_status_display().lower()}.'
                        ),
                        target_tab='bookings',
                        notification_type='BOOKING_UPDATE',
                    )
                if acting_user_id == booking.customer_id or is_admin:
                    listing_name = _get_booking_listing_name(booking)
                    for provider in _get_booking_provider_users(booking):
                        if provider.pk != acting_user_id:
                            Notification.objects.create(
                                user=provider,
                                booking=booking,
                                title='Booking activity updated',
                                message=(
                                    f'The booking for {listing_name} was '
                                    f'{booking.get_status_display().lower()}.'
                                ),
                                target_tab='bookings',
                                notification_type='BOOKING_UPDATE',
                            )
                _notify_admins(
                    title='Booking status changed',
                    message=(
                        f'The booking for {_get_booking_listing_name(booking)} was '
                        f'{booking.get_status_display().lower()}.'
                    ),
                    target_tab='bookings',
                    booking=booking,
                    exclude_user_id=acting_user_id if is_admin else None,
                )
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
        if self.action in ['retrieve', 'destroy', 'update', 'partial_update'] or getattr(self, 'detail', False):
            return queryset

        params = self.request.query_params
        venue_id = params.get('venue')
        vendor_id = params.get('vendor')
        user_id = params.get('user')
        booking_id = params.get('booking')

        if venue_id:
            queryset = queryset.filter(venue_id=venue_id)
        if vendor_id:
            queryset = queryset.filter(vendor_id=vendor_id)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if booking_id:
            queryset = queryset.filter(booking_id=booking_id)

        return queryset

    def _authorize_review_change(self, request, review):
        is_admin = is_admin_user(request)
        req_user_id = request.user.id if request.user and request.user.is_authenticated else None

        if not req_user_id:
            raw_user_id = (
                request.headers.get('X-User-Id') or
                request.headers.get('X-Admin-Id') or
                request.query_params.get('admin_user_id') or
                request.query_params.get('user_id')
            )
            try:
                req_user_id = int(raw_user_id) if raw_user_id else None
            except (ValueError, TypeError):
                req_user_id = None

        if req_user_id and not is_admin:
            user = User.objects.filter(pk=req_user_id).only('role', 'is_staff', 'is_superuser').first()
            is_admin = bool(user and (user.role == 'ADMIN' or user.is_staff or user.is_superuser))

        if not is_admin and (not req_user_id or review.user_id != req_user_id):
            raise PermissionDenied("Only administrators or the review author can change this review.")

    def _update_review(self, request, *args, **kwargs):
        review = self.get_object()
        self._authorize_review_change(request, review)

        editable_fields = {'rating', 'comment'}
        submitted_fields = set(request.data.keys())
        invalid_fields = submitted_fields - editable_fields
        if invalid_fields:
            raise ValidationError({'error': 'Only rating and comment can be edited.'})
        if not submitted_fields:
            raise ValidationError({'error': 'Provide a rating or comment to update.'})

        serializer = self.get_serializer(review, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        return self._update_review(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return self._update_review(request, *args, **kwargs)

    def perform_create(self, serializer):
        if self.request.user and self.request.user.is_authenticated:
            serializer.save(customer=self.request.user)
        else:
            serializer.save()

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
        listing_name = _get_booking_listing_name(booking)
        for provider in _get_booking_provider_users(booking):
            Notification.objects.create(
                user=provider,
                booking=booking,
                title='New customer review',
                message=f'{user.get_full_name() or user.username} left a {rating_val}-star review for {listing_name}.',
                target_tab='reviews',
                notification_type='SYSTEM',
            )
        _notify_admins(
            title='New customer review',
            message=f'A {rating_val}-star review was submitted for {listing_name}.',
            target_tab='reviews',
            booking=booking,
            exclude_user_id=user.id if is_admin_user(request) else None,
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

    def destroy(self, request, *args, **kwargs):
        try:
            review = self.get_object()
        except Http404:
            return Response({'message': 'Review already removed.'}, status=status.HTTP_204_NO_CONTENT)

        self._authorize_review_change(request, review)

        venue = review.venue
        vendor = review.vendor
        review.delete()
        if venue:
            venue.update_rating_stats()
        if vendor:
            vendor.update_rating_stats()

        return Response({'message': 'Review removed successfully.'}, status=status.HTTP_204_NO_CONTENT)


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

    def perform_create(self, serializer):
        if self.request.user and self.request.user.is_authenticated:
            serializer.save(customer=self.request.user)
        else:
            serializer.save()

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

        with transaction.atomic():
            msg = Message.objects.create(
                sender=sender,
                recipient=recipient,
                booking=booking,
                venue=venue,
                vendor=vendor,
                content=content
            )
            if (
                recipient.role in {'CUSTOMER', 'PROVIDER', 'VENDOR', 'VENUE_OWNER'}
                and recipient.id != sender.id
            ):
                Notification.objects.create(
                    user=recipient,
                    booking=booking,
                    source_message=msg,
                    title='New message',
                    message=f'New message from {sender.get_full_name() or sender.username}.',
                    target_tab='messages',
                    notification_type='MESSAGE',
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


def _platform_commission_total(payments):
    real_payments = payments.filter(is_simulated=False)
    real_commission = real_payments.filter(
        commission_amount__isnull=False,
    ).aggregate(total=Sum('commission_amount'))['total'] or Decimal('0')

    legacy_real_commission = sum(
        (
            payout_service.calculate_payment_split(amount)[0]
            for amount in real_payments.filter(
                commission_amount__isnull=True,
            ).values_list('amount', flat=True)
        ),
        Decimal('0'),
    )
    simulated_commission = sum(
        (
            payout_service.calculate_payment_split(amount)[0]
            for amount in payments.filter(is_simulated=True).values_list('amount', flat=True)
        ),
        Decimal('0'),
    )
    return real_commission + legacy_real_commission + simulated_commission


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

    commission_total = _platform_commission_total(
        Payment.objects.filter(status='SUCCESS')
    )
    total_revenue = float(commission_total)

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
        'total_commission': total_revenue,
        'commission_revenue': total_revenue,
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


def _provider_payment_summary(bookings):
    payments = Payment.objects.filter(
        booking__in=bookings,
        status='SUCCESS',
        is_simulated=False,
        commission_amount__isnull=False,
    )
    totals = payments.aggregate(
        customer_paid=Sum('amount'),
        commission_deducted=Sum('commission_amount'),
        provider_net=Sum('provider_payout_amount'),
        provider_received=Sum(
            'provider_payout_amount',
            filter=Q(payout_status='PAID'),
        ),
        pending_payouts=Count('id', filter=Q(payout_status='PENDING')),
        failed_payouts=Count('id', filter=Q(payout_status='FAILED')),
    )
    return {
        'total_customer_paid': float(totals['customer_paid'] or 0),
        'total_commission_deducted': float(totals['commission_deducted'] or 0),
        'total_provider_net': float(totals['provider_net'] or 0),
        'total_provider_received': float(totals['provider_received'] or 0),
        'pending_payouts': totals['pending_payouts'] or 0,
        'failed_payouts': totals['failed_payouts'] or 0,
    }


class VendorDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, vendor_id):
        try:
            vendor = VendorProfile.objects.get(id=vendor_id)
        except VendorProfile.DoesNotExist:
            return Response({'error': 'Vendor not found'}, status=status.HTTP_404_NOT_FOUND)
        if not is_admin_user(request) and request.user.id != vendor.user_id:
            raise PermissionDenied('You are not authorized to view this vendor dashboard.')
            
        vendor_venues = Venue.objects.filter(vendor=vendor)
        bookings = Booking.objects.filter(Q(venue__in=vendor_venues) | Q(vendor=vendor))
        
        payment_summary = _provider_payment_summary(bookings)
        pending_bookings = bookings.filter(status='PENDING').count()
        upcoming_bookings = bookings.filter(status='APPROVED').count()
        
        return Response({
            **payment_summary,
            'total_revenue': payment_summary['total_provider_received'],
            'pending_bookings': pending_bookings,
            'upcoming_bookings': upcoming_bookings,
            'total_venues': vendor_venues.count(),
            'venues': VenueSerializer(vendor_venues, many=True).data
        })


class VendorBookingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, vendor_id):
        try:
            vendor = VendorProfile.objects.get(id=vendor_id)
        except VendorProfile.DoesNotExist:
            return Response({'error': 'Vendor not found'}, status=status.HTTP_404_NOT_FOUND)
        if not is_admin_user(request) and request.user.id != vendor.user_id:
            raise PermissionDenied('You are not authorized to view these vendor bookings.')
            
        vendor_venues = Venue.objects.filter(vendor=vendor)
        bookings = Booking.objects.filter(
            Q(venue__in=vendor_venues) | Q(vendor=vendor)
        ).order_by('-created_at').prefetch_related(
            Prefetch(
                'payments',
                queryset=Payment.objects.filter(
                    status='SUCCESS',
                    is_simulated=False,
                    commission_amount__isnull=False,
                ).order_by('-paid_at', '-created_at'),
                to_attr='commissioned_payments',
            ),
            Prefetch(
                'payments',
                queryset=Payment.objects.filter(
                    status='SUCCESS',
                    is_simulated=True,
                ).order_by('-created_at'),
                to_attr='simulated_payments',
            ),
        )
        return Response(BookingSerializer(bookings, many=True).data)


class VenueOwnerDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, owner_id):
        try:
            venue_owner = VenueOwnerProfile.objects.get(id=owner_id)
        except VenueOwnerProfile.DoesNotExist:
            return Response({'error': 'Venue owner not found'}, status=status.HTTP_404_NOT_FOUND)
        if not is_admin_user(request) and request.user.id != venue_owner.user_id:
            raise PermissionDenied('You are not authorized to view this venue owner dashboard.')
            
        owner_venues = Venue.objects.filter(owner=venue_owner)
        bookings = Booking.objects.filter(venue__in=owner_venues)
        
        payment_summary = _provider_payment_summary(bookings)
        pending_bookings = bookings.filter(status='PENDING').count()
        upcoming_bookings = bookings.filter(status='APPROVED').count()
        verified_venues = owner_venues.filter(is_verified=True).count()
        
        return Response({
            **payment_summary,
            'total_revenue': payment_summary['total_provider_received'],
            'pending_bookings': pending_bookings,
            'upcoming_bookings': upcoming_bookings,
            'total_venues': owner_venues.count(),
            'verified_venues': verified_venues,
            'venues': VenueSerializer(owner_venues, many=True).data
        })


class VenueOwnerBookingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, owner_id):
        try:
            venue_owner = VenueOwnerProfile.objects.get(id=owner_id)
        except VenueOwnerProfile.DoesNotExist:
            return Response({'error': 'Venue owner not found'}, status=status.HTTP_404_NOT_FOUND)
        if not is_admin_user(request) and request.user.id != venue_owner.user_id:
            raise PermissionDenied('You are not authorized to view these venue owner bookings.')
            
        owner_venues = Venue.objects.filter(owner=venue_owner)
        bookings = Booking.objects.filter(venue__in=owner_venues).order_by('-created_at').prefetch_related(
            Prefetch(
                'payments',
                queryset=Payment.objects.filter(
                    status='SUCCESS',
                    is_simulated=False,
                    commission_amount__isnull=False,
                ).order_by('-paid_at', '-created_at'),
                to_attr='commissioned_payments',
            ),
            Prefetch(
                'payments',
                queryset=Payment.objects.filter(
                    status='SUCCESS',
                    is_simulated=True,
                ).order_by('-created_at'),
                to_attr='simulated_payments',
            ),
        )
        return Response(BookingSerializer(bookings, many=True).data)


@api_view(['POST'])
@permission_classes([AllowAny])
def send_otp(request):
    email = str(request.data.get('email') or '').strip().lower()
    if not email:
        return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_email(email)
    except DjangoValidationError:
        return Response({'error': 'Enter a valid email address.'}, status=status.HTTP_400_BAD_REQUEST)

    if not settings.EMAIL_HOST or not settings.DEFAULT_FROM_EMAIL:
        logging.getLogger(__name__).error('OTP email delivery is not configured.')
        return Response(
            {'error': 'Email delivery is not configured. Please contact the administrator.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    otp_code = str(random.randint(100000, 999999))

    otp_obj, _ = EmailOTP.objects.get_or_create(email=email)
    otp_obj.otp_code = otp_code
    otp_obj.save()

    try:
        sent_count = send_mail(
            subject='Your Verification Code',
            message=f'Your verification code is: {otp_code}\n\nThis code will expire in 10 minutes.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
        if sent_count != 1:
            otp_obj.delete()
            logging.getLogger(__name__).error('OTP email backend did not confirm delivery.')
            return Response(
                {'error': 'The verification email could not be sent. Please try again later.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
    except Exception:
        otp_obj.delete()
        logging.getLogger(__name__).exception('Failed to send verification email.')
        return Response(
            {'error': 'The verification email could not be sent. Please try again later.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

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
        
        time_diff = timezone.now() - otp_obj.created_at
        if time_diff.total_seconds() > 600:
            return Response({'error': 'OTP has expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if otp_obj.otp_code == otp_code:
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
        
        time_diff = timezone.now() - otp_obj.created_at
        if time_diff.total_seconds() > 600:
            return Response({'error': 'OTP has expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if otp_obj.otp_code != otp_code:
            return Response({'error': 'Invalid OTP'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email=email).first()
        if not user:
            return Response({'error': 'No account found with this email'}, status=status.HTTP_404_NOT_FOUND)

        user.set_password(new_password)
        user.save()
        
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
    
    ext = upload.name.split('.')[-1]
    filename = f"user_{user_id}_{timezone.now().strftime('%Y%m%d%H%M%S')}.{ext}"
    saved_name = fs.save(filename, upload)
    
    file_url = request.build_absolute_uri(settings.MEDIA_URL + saved_name)
    
    user.avatar_url = file_url
    user.save()

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
    email = str(data.get('email') or '').strip().lower()
    username = data.get('username', '').strip() or email
    otp_code = str(data.get('otp') or '').strip()

    if not email:
        return Response({'error': 'Email address is required'}, status=status.HTTP_400_BAD_REQUEST)
    if not otp_code:
        return Response({'error': 'A valid email verification code is required before registration.'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email__iexact=email).exists():
        return Response({'error': 'An account with this email address already exists. Please log in.'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username__iexact=username).exists():
        return Response({'error': 'This username is already taken'}, status=status.HTTP_400_BAD_REQUEST)
        
    requested_role = str(data.get('role') or 'CUSTOMER').strip().upper()
    if requested_role == 'ADMIN':
        return Response({
            'error': 'Administrator registration is disabled. Administrators can only log in with pre-configured credentials.'
        }, status=status.HTTP_403_FORBIDDEN)
    if requested_role not in {'CUSTOMER', 'PROVIDER'}:
        return Response(
            {'error': 'Choose either a customer or business provider account.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        otp_obj = EmailOTP.objects.select_for_update().get(email=email)
    except EmailOTP.DoesNotExist:
        return Response({'error': 'No verification code found. Request a new code.'}, status=status.HTTP_400_BAD_REQUEST)

    if (timezone.now() - otp_obj.created_at).total_seconds() > 600:
        otp_obj.delete()
        return Response({'error': 'Verification code expired. Request a new code.'}, status=status.HTTP_400_BAD_REQUEST)
    if otp_obj.otp_code != otp_code:
        return Response({'error': 'Invalid verification code.'}, status=status.HTTP_400_BAD_REQUEST)

    password = data.get('password')
    if not password:
        return Response({'error': 'Password is required.'}, status=status.HTTP_400_BAD_REQUEST)

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
            password=password,
            first_name=first_name,
            last_name=last_name,
            is_customer=requested_role == 'CUSTOMER',
            is_vendor=requested_role == 'PROVIDER',
            is_venue_owner=requested_role == 'PROVIDER',
            is_staff=False,
            is_superuser=False,
            role=requested_role,
            phone_number=data.get('phone_number', '')
        )

        if requested_role == 'PROVIDER':
            _ensure_provider_profiles(user)

        _notify_admins(
            title='New account registered',
            message=(
                f'{user.get_full_name() or user.username} registered a '
                f'{requested_role.lower()} account.'
            ),
            target_tab='verifications' if requested_role == 'PROVIDER' else 'users',
        )

        otp_obj.delete()
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
        is_provider = user.is_provider
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
        token, _ = Token.objects.get_or_create(user=user)
        response_data['token'] = token.key
        
        if hasattr(user, 'vendor_profile'):
            response_data['vendor_profile'] = VendorProfileSerializer(user.vendor_profile).data
            
        if hasattr(user, 'venue_owner_profile'):
            response_data['venue_owner_profile'] = VenueOwnerProfileSerializer(user.venue_owner_profile).data
            
        return Response(response_data, status=status.HTTP_200_OK)
    else:
        return Response({'error': 'Invalid credentials. Please verify your password.'}, status=status.HTTP_401_UNAUTHORIZED)


def _ensure_provider_profiles(user, include_vendor=True, include_venue_owner=True):
    business_title = (
        f"{user.first_name}'s Business"
        if user.first_name else f"{user.username}'s Business"
    )

    if include_vendor:
        VendorProfile.objects.get_or_create(
            user=user,
            defaults={
                'business_name': business_title,
                'vendor_type': 'Event Services',
                'description': '',
                'location': 'Nairobi',
                'contact_email': user.email,
                'contact_phone': user.phone_number or ''
            }
        )

    if include_venue_owner:
        VenueOwnerProfile.objects.get_or_create(
            user=user,
            defaults={
                'business_name': business_title,
                'contact_email': user.email,
                'contact_phone': user.phone_number or '',
                'business_type': 'Event Spaces'
            }
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def request_role(request):
    user = request.user
    user_id = request.data.get('user_id')
    role = (request.data.get('role') or '').strip().upper()

    if user_id and str(user_id) != str(user.id):
        return Response(
            {'error': 'You can only change your own account role.'},
            status=status.HTTP_403_FORBIDDEN
        )

    if role == 'ADMIN':
        return Response(
            {'error': 'Administrator roles cannot be requested.'},
            status=status.HTTP_403_FORBIDDEN
        )

    if not role:
        return Response(
            {'error': 'Role is required.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    provider_roles = {'PROVIDER', 'BUSINESS', 'VENDOR', 'VENUE_OWNER'}
    current_is_provider = user.role in {'PROVIDER', 'VENDOR', 'VENUE_OWNER'}
    requested_is_provider = role in provider_roles

    if role != 'CUSTOMER' and not requested_is_provider:
        return Response(
            {'error': 'Invalid role.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if (
        user.role not in {'CUSTOMER', 'PROVIDER', 'VENDOR', 'VENUE_OWNER'}
        or (role == 'CUSTOMER') != (user.role == 'CUSTOMER')
        or (requested_is_provider and not current_is_provider)
    ):
        return Response(
            {'error': 'Account type cannot be changed after registration.'},
            status=status.HTTP_403_FORBIDDEN
        )

    if requested_is_provider and current_is_provider:
        if role in {'PROVIDER', 'BUSINESS'}:
            _ensure_provider_profiles(user)
        elif role == 'VENDOR':
            _ensure_provider_profiles(user, include_venue_owner=False)
        elif role == 'VENUE_OWNER':
            _ensure_provider_profiles(user, include_vendor=False)

    is_provider = user.is_provider

    response_data = {
        'user': UserSerializer(user).data,
        'roles': {
            'is_customer': user.is_customer,
            'is_vendor': user.is_vendor,
            'is_venue_owner': user.is_venue_owner,
            'is_provider': is_provider,
            'is_admin': (
                user.role == 'ADMIN'
                or user.is_staff
                or user.is_superuser
            )
        }
    }

    if hasattr(user, 'vendor_profile'):
        response_data['vendor_profile'] = VendorProfileSerializer(
            user.vendor_profile
        ).data

    if hasattr(user, 'venue_owner_profile'):
        response_data['venue_owner_profile'] = VenueOwnerProfileSerializer(
            user.venue_owner_profile
        ).data

    return Response(response_data, status=status.HTTP_200_OK)


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

        evaluate_and_generate_reminders(user=user)
        return Notification.objects.filter(user=user).select_related(
            'event', 'task', 'booking', 'source_message__sender'
        ).order_by('-created_at')

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

    def get_permissions(self):
        return [IsAuthenticated()]

    def get_user_from_request(self):
        user = getattr(self.request, 'user', None)
        if user and user.is_authenticated:
            return user
        return None

    def get_queryset(self):
        queryset = super().get_queryset()
        req_user = self.get_user_from_request()
        is_admin = is_admin_user(self.request)

        if not is_admin:
            if not req_user:
                return VerificationDocument.objects.none()
            queryset = queryset.filter(user=req_user)

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

        vendor = getattr(req_user, 'vendor_profile', None)
        venue_owner = getattr(req_user, 'venue_owner_profile', None)

        document = serializer.save(
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
        _notify_admins(
            title='Verification document submitted',
            message=(
                f'{req_user.get_full_name() or req_user.username} uploaded a '
                f'{document.get_document_type_display().lower()} document for review.'
            ),
            target_tab='verifications',
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
        reviewer = request.user
        doc.reviewed_by = reviewer
        doc.reviewed_at = timezone.now()
        doc.save()

        user = doc.user
        if doc.venue_owner:
            owner = doc.venue_owner
            if not _is_approved_business_profile(owner):
                _reset_preapproved_listings(owner, 'owner')
            owner.is_verified = True
            owner.verification_status = 'APPROVED'
            owner.save(update_fields=['is_verified', 'verification_status'])
        elif hasattr(user, 'venue_owner_profile'):
            owner = user.venue_owner_profile
            if not _is_approved_business_profile(owner):
                _reset_preapproved_listings(owner, 'owner')
            owner.is_verified = True
            owner.verification_status = 'APPROVED'
            owner.save(update_fields=['is_verified', 'verification_status'])

        if doc.vendor:
            vendor = doc.vendor
            if not _is_approved_business_profile(vendor):
                _reset_preapproved_listings(vendor, 'vendor')
            vendor.is_verified = True
            vendor.verification_status = 'APPROVED'
            vendor.save(update_fields=['is_verified', 'verification_status'])
        elif hasattr(user, 'vendor_profile'):
            vendor = user.vendor_profile
            if not _is_approved_business_profile(vendor):
                _reset_preapproved_listings(vendor, 'vendor')
            vendor.is_verified = True
            vendor.verification_status = 'APPROVED'
            vendor.save(update_fields=['is_verified', 'verification_status'])

        Notification.objects.create(
            user=user,
            title='Verification document approved',
            message='Your verification document was approved by an administrator.',
            target_tab='profile',
            notification_type='SYSTEM',
        )
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
        reviewer = request.user
        doc.reviewed_by = reviewer
        doc.reviewed_at = timezone.now()
        doc.save()

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

        Notification.objects.create(
            user=user,
            title='Verification document requires changes',
            message=f'Your verification document was rejected: {reason}',
            target_tab='profile',
            notification_type='SYSTEM',
        )
        return Response(VerificationDocumentSerializer(doc).data)


# ==============================================================================
# USER INTERACTION TRACKING & ROLE-BASED ANALYTICS ENDPOINTS
# ==============================================================================

import csv
from django.http import HttpResponse
from django.db.models import Count
from datetime import timedelta


def parse_date_range(request):
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
    else:
        start_dt = now - timedelta(days=30)
        label = 'Last 30 Days'

    return start_dt, end_dt, label


def get_actor_user(request):
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
def upload_listing_image(request):
    user = getattr(request, 'user', None)
    if not user or not user.is_authenticated:
        return Response(
            {'error': 'Authentication required.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if user.role not in ['PROVIDER', 'VENDOR', 'VENUE_OWNER']:
        return Response(
            {'error': 'Only providers can upload listing images.'},
            status=status.HTTP_403_FORBIDDEN
        )

    upload = request.FILES.get('file')

    if not upload:
        return Response(
            {'error': 'No image file provided.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    allowed_extensions = ['.jpg', '.jpeg', '.png', '.webp']
    extension = os.path.splitext(upload.name)[1].lower()

    if (
        extension not in allowed_extensions
        or not (upload.content_type or '').startswith('image/')
    ):
        return Response(
            {'error': 'Only JPG, JPEG, PNG, and WEBP images are allowed.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if upload.size > 5 * 1024 * 1024:
        return Response(
            {'error': 'Image size must not exceed 5 MB.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    fs = FileSystemStorage(location=settings.MEDIA_ROOT)
    filename = (
        f"listing_{user.id}_"
        f"{timezone.now().strftime('%Y%m%d%H%M%S%f')}"
        f"{extension}"
    )
    saved_name = fs.save(filename, upload)
    file_url = request.build_absolute_uri(
        settings.MEDIA_URL + saved_name
    )

    return Response(
        {'url': file_url},
        status=status.HTTP_201_CREATED
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def track_user_interaction(request):
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

    raw_query = data.get('search_query', '')
    normalized_query = (raw_query.strip()[:200]) if raw_query else ''

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
    days_count = max(1, (end_dt.date() - start_dt.date()).days + 1)
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
    if not is_admin_user(request):
        raise PermissionDenied("Access Denied: Platform Administrator privileges required.")

    start_dt, end_dt, range_label = parse_date_range(request)

    interactions = UserInteraction.objects.filter(timestamp__gte=start_dt, timestamp__lte=end_dt)
    bookings = Booking.objects.filter(created_at__gte=start_dt, created_at__lte=end_dt)
    commission_payments = Payment.objects.filter(status='SUCCESS').filter(
        (
            Q(is_simulated=False)
            & (
                Q(paid_at__gte=start_dt, paid_at__lte=end_dt)
                | Q(
                    paid_at__isnull=True,
                    created_at__gte=start_dt,
                    created_at__lte=end_dt,
                )
            )
        )
        | Q(
            is_simulated=True,
            created_at__gte=start_dt,
            created_at__lte=end_dt,
        )
    )
    commission_revenue = _platform_commission_total(commission_payments)

    total_searches = interactions.filter(event_type='SEARCH').count()
    total_listing_views = interactions.filter(event_type='LISTING_VIEW').count()

    auth_viewers = interactions.filter(event_type='LISTING_VIEW', user__isnull=False).values('user_id').distinct().count()
    anon_viewers = interactions.filter(event_type='LISTING_VIEW', user__isnull=True, session_id__isnull=False).values('session_id').distinct().count()
    unique_viewers = auth_viewers + anon_viewers

    booking_requests = bookings.count()
    confirmed_bookings = bookings.filter(status__in=['APPROVED', 'COMPLETED']).count()
    completed_bookings = bookings.filter(status='COMPLETED').count()
    cancelled_bookings = bookings.filter(status='CANCELLED').count()
    pending_bookings = bookings.filter(status='PENDING').count()
    rejected_bookings = bookings.filter(status='REJECTED').count()

    cancellation_rate = round((cancelled_bookings / booking_requests * 100), 1) if booking_requests > 0 else 0.0

    searching_user_ids = set(interactions.filter(event_type='SEARCH', user__isnull=False).values_list('user_id', flat=True))
    searching_sessions = set(interactions.filter(event_type='SEARCH', session_id__isnull=False).values_list('session_id', flat=True))
    total_searching_cohort = len(searching_user_ids) + len(searching_sessions)

    booking_user_ids = set(bookings.values_list('customer_id', flat=True))
    converted_searchers = len(searching_user_ids.intersection(booking_user_ids))
    search_to_booking_rate = round((converted_searchers / max(1, len(searching_user_ids)) * 100), 1) if searching_user_ids else (
        round((booking_requests / max(1, total_searches) * 100), 1) if total_searches > 0 else 0.0
    )

    viewing_user_ids = set(interactions.filter(event_type='LISTING_VIEW', user__isnull=False).values_list('user_id', flat=True))
    converted_viewers = len(viewing_user_ids.intersection(booking_user_ids))
    view_to_booking_rate = round((converted_viewers / max(1, len(viewing_user_ids)) * 100), 1) if viewing_user_ids else (
        round((booking_requests / max(1, total_listing_views) * 100), 1) if total_listing_views > 0 else 0.0
    )

    funnel = [
        {'stage': 'Searches Performed', 'count': total_searches, 'percentage': 100},
        {'stage': 'Listings Viewed', 'count': total_listing_views, 'percentage': round((total_listing_views / max(1, total_searches) * 100), 1) if total_searches > 0 else 0},
        {'stage': 'Booking Forms Opened', 'count': interactions.filter(event_type='BOOKING_FORM_OPEN').count(), 'percentage': round((interactions.filter(event_type='BOOKING_FORM_OPEN').count() / max(1, total_listing_views) * 100), 1) if total_listing_views > 0 else 0},
        {'stage': 'Booking Requests Submitted', 'count': booking_requests, 'percentage': round((booking_requests / max(1, total_listing_views) * 100), 1) if total_listing_views > 0 else 0},
        {'stage': 'Confirmed Bookings', 'count': confirmed_bookings, 'percentage': round((confirmed_bookings / max(1, booking_requests) * 100), 1) if booking_requests > 0 else 0},
    ]

    status_distribution = [
        {'status': 'Pending Approval', 'count': pending_bookings, 'color': '#d97706'},
        {'status': 'Confirmed', 'count': confirmed_bookings - completed_bookings, 'color': '#0d8a73'},
        {'status': 'Completed', 'count': completed_bookings, 'color': '#059669'},
        {'status': 'Cancelled', 'count': cancelled_bookings, 'color': '#dc2626'},
        {'status': 'Rejected', 'count': rejected_bookings, 'color': '#64748b'},
    ]

    category_counts = (
        interactions.filter(category__isnull=False)
        .values('category')
        .annotate(views=Count('id'))
        .order_by('-views')[:8]
    )
    popular_categories = [{'category': c['category'], 'views': c['views']} for c in category_counts]

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

    from collections import Counter
    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    day_counts = Counter(b.created_at.weekday() for b in bookings)
    peak_days = [{'day': day_names[i], 'requests': day_counts.get(i, 0)} for i in range(7)]

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
            'commission_revenue': float(commission_revenue),
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
    commission_payments = Payment.objects.filter(status='SUCCESS').filter(
        (
            Q(is_simulated=False)
            & (
                Q(paid_at__gte=start_dt, paid_at__lte=end_dt)
                | Q(
                    paid_at__isnull=True,
                    created_at__gte=start_dt,
                    created_at__lte=end_dt,
                )
            )
        )
        | Q(
            is_simulated=True,
            created_at__gte=start_dt,
            created_at__lte=end_dt,
        )
    )
    commission_revenue = _platform_commission_total(commission_payments)
    writer.writerow(['Platform Commission Revenue (KES)', commission_revenue])
    writer.writerow(['Cancelled Bookings', bookings.filter(status='CANCELLED').count()])
    writer.writerow([])

    writer.writerow(['DAILY TRENDS'])
    writer.writerow(['Date', 'Searches', 'Views', 'Clicks', 'Booking Requests', 'Confirmed'])
    trends = compute_daily_breakdown(interactions, bookings, start_dt, end_dt)
    for t in trends:
        writer.writerow([t['date'], t['searches'], t['views'], t['clicks'], t['booking_requests'], t['confirmed_bookings']])

    return response


def verify_vendor_access(request, vendor_id):
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
    vendor = verify_vendor_access(request, vendor_id)
    if not vendor:
        raise PermissionDenied("Access Denied: You are not authorized to view this vendor's analytics.")

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
    payment_summary = _provider_payment_summary(bookings)

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
            **payment_summary,
            'cancellation_rate': cancellation_rate,
            'conversion_rate': conversion_rate,
        },
        'service_performance': service_performance,
        'peak_days': peak_days,
        'trends': trends,
    })


@api_view(['GET'])
def export_vendor_analytics_csv(request, vendor_id):
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
    payment_summary = _provider_payment_summary(bookings)
    writer.writerow(['Customer Payments Received (KES)', payment_summary['total_customer_paid']])
    writer.writerow(['Commission Deducted (KES)', payment_summary['total_commission_deducted']])
    writer.writerow(['Provider Net Payout (KES)', payment_summary['total_provider_net']])
    writer.writerow(['Provider Payouts Received (KES)', payment_summary['total_provider_received']])
    writer.writerow(['Cancelled Bookings', bookings.filter(status='CANCELLED').count()])
    writer.writerow([])

    writer.writerow(['DAILY ACTIVITY TRENDS'])
    writer.writerow(['Date', 'Views', 'Clicks', 'Booking Requests', 'Confirmed'])
    trends = compute_daily_breakdown(interactions, bookings, start_dt, end_dt)
    for t in trends:
        writer.writerow([t['date'], t['views'], t['clicks'], t['booking_requests'], t['confirmed_bookings']])

    return response


def verify_venue_owner_access(request, owner_id):
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
    payment_summary = _provider_payment_summary(bookings)

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

    venue_performance = []
    total_days_in_period = max(1, (end_dt.date() - start_dt.date()).days + 1)

    for v in owner_venues:
        v_views = interactions.filter(venue=v, event_type='LISTING_VIEW').count()
        v_bookings = bookings.filter(venue=v)
        v_requests = v_bookings.count()
        v_confirmed = v_bookings.filter(status__in=['APPROVED', 'COMPLETED']).count()

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
            **payment_summary,
            'cancellation_rate': cancellation_rate,
            'conversion_rate': conversion_rate,
        },
        'venue_performance': venue_performance,
        'peak_days': peak_days,
        'trends': trends,
    })


@api_view(['GET'])
def export_venue_owner_analytics_csv(request, owner_id):
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
    payment_summary = _provider_payment_summary(bookings)
    writer.writerow(['Customer Payments Received (KES)', payment_summary['total_customer_paid']])
    writer.writerow(['Commission Deducted (KES)', payment_summary['total_commission_deducted']])
    writer.writerow(['Provider Net Payout (KES)', payment_summary['total_provider_net']])
    writer.writerow(['Provider Payouts Received (KES)', payment_summary['total_provider_received']])
    writer.writerow(['Cancelled Bookings', bookings.filter(status='CANCELLED').count()])
    writer.writerow([])

    writer.writerow(['DAILY ACTIVITY TRENDS'])
    writer.writerow(['Date', 'Views', 'Clicks', 'Booking Requests', 'Confirmed'])
    trends = compute_daily_breakdown(interactions, bookings, start_dt, end_dt)
    for t in trends:
        writer.writerow([t['date'], t['views'], t['clicks'], t['booking_requests'], t['confirmed_bookings']])

    return response


# ==============================================================================
# ML RECOMMENDATIONS ENDPOINTS
# ==============================================================================

@api_view(['GET'])
def venue_recommendations(request):
    """
    GET /api/recommendations/venues/
    Returns personalized venue recommendations for the current user (or cold-start fallback).
    """
    user = request.user if request.user and request.user.is_authenticated else None
    try:
        limit = int(request.query_params.get('limit', 6))
    except (ValueError, TypeError):
        limit = 6

    query = request.query_params.get('query', '').strip()[:200]
    try:
        recs = get_venue_recommendations(
            user=user,
            limit=limit,
            preferences={'query': query} if query else None,
        )
    except Exception as exc:
        return Response(
            {'error': f'Failed to compute venue recommendations: {str(exc)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    results = []
    for recommendation in recs:
        venue_data = dict(VenueSerializer(
            recommendation['venue'],
            context={'request': request},
        ).data)
        venue_data.update({
            'match_score': recommendation['match_score'],
            'is_cold_start': recommendation['is_cold_start'],
            'recommendation_type': recommendation['recommendation_type'],
        })
        results.append(venue_data)
    return Response({'results': results})


@api_view(['GET'])
def service_recommendations(request):
    query = request.query_params.get('query', '').strip()[:200]
    if not query:
        return Response({'results': []})

    try:
        limit = int(request.query_params.get('limit', 6))
    except (ValueError, TypeError):
        limit = 6

    services = _get_public_catalog_queryset().filter(
        listing_type='SERVICE'
    ).select_related('owner', 'vendor').order_by('id')

    try:
        recs = compute_service_recommendations(
            services=services,
            query=query,
            top_k=limit,
        )
    except Exception as exc:
        return Response(
            {'error': f'Failed to compute service recommendations: {str(exc)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    results = []
    for recommendation in recs:
        service_data = dict(VenueSerializer(
            recommendation['service'],
            context={'request': request},
        ).data)
        service_data.update({
            'match_score': recommendation['match_score'],
            'is_cold_start': False,
            'recommendation_type': 'SERVICE',
        })
        results.append(service_data)
    return Response({'results': results})


@api_view(['GET'])
def vendor_recommendations(request):
    """
    GET /api/recommendations/vendors/
    Returns personalized vendor recommendations for the current user (or cold-start fallback).
    """
    user = request.user if request.user and request.user.is_authenticated else None
    try:
        limit = int(request.query_params.get('limit', 6))
    except (ValueError, TypeError):
        limit = 6

    query = request.query_params.get('query', '').strip()[:200]
    try:
        recs = get_vendor_recommendations(
            user=user,
            limit=limit,
            preferences={'query': query} if query else None,
        )
    except Exception as exc:
        return Response(
            {'error': f'Failed to compute vendor recommendations: {str(exc)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    results = []
    for recommendation in recs:
        vendor_data = dict(VendorProfileSerializer(
            recommendation['vendor'],
            context={'request': request},
        ).data)
        vendor_data.update({
            'match_score': recommendation['match_score'],
            'is_cold_start': recommendation['is_cold_start'],
            'recommendation_type': recommendation['recommendation_type'],
        })
        results.append(vendor_data)
    return Response({'results': results})


# ==============================================================================
# M-PESA DARAJA STK PUSH VIEWS
# ==============================================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def mpesa_simulate_payment(request):
    if not settings.DEBUG or not settings.MPESA_SIMULATION_ENABLED:
        return Response(
            {'success': False, 'message': 'Payment simulation is disabled.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    booking_id = request.data.get('bookingId')
    try:
        booking = Booking.objects.select_for_update().get(
            pk=booking_id,
            customer=request.user,
            status='APPROVED',
        )
    except (Booking.DoesNotExist, TypeError, ValueError):
        return Response(
            {'success': False, 'message': 'Confirmed booking not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if Payment.objects.filter(booking=booking, status='SUCCESS').exists():
        return Response(
            {'success': False, 'message': 'This booking already has a successful payment.'},
            status=status.HTTP_409_CONFLICT,
        )

    simulation_id = uuid.uuid4().hex[:12].upper()
    payment = Payment.objects.create(
        booking=booking,
        checkout_request_id=f'SIMULATED-{booking.id}-{simulation_id}',
        merchant_request_id='SIMULATED',
        customer_phone=booking.customer.phone_number or 'SIMULATED',
        amount=booking.total_price,
        account_reference=f'TEST-EVT-{booking.id}',
        status='SUCCESS',
        is_simulated=True,
        result_code=0,
        result_desc='Simulated test payment; no M-Pesa transaction occurred.',
        mpesa_receipt_number=f'TEST-{simulation_id}',
        transaction_date=timezone.now().strftime('%Y%m%d%H%M%S'),
    )

    return Response(
        {
            'success': True,
            'simulated': True,
            'message': 'Test payment recorded; no M-Pesa transaction occurred.',
            'payment': PaymentSerializer(payment).data,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def mpesa_stk_push(request):
    """
    POST /api/mpesa/stkpush/
    Body: { bookingId, phone, amount, accountReference? }
    """
    booking_id = request.data.get('bookingId')
    phone = request.data.get('phone')
    amount = request.data.get('amount')

    if not booking_id or not phone or amount is None:
        return Response(
            {'success': False, 'message': 'bookingId, phone, and amount are required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        booking = Booking.objects.get(pk=booking_id)
    except Booking.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Booking not found'},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        expected_amount = Decimal(str(booking.total_price)).quantize(
            Decimal('1'),
            rounding=ROUND_HALF_UP,
        )
        requested_amount = Decimal(str(amount)).quantize(
            Decimal('1'),
            rounding=ROUND_HALF_UP,
        )
    except Exception:
        return Response(
            {'success': False, 'message': 'A valid payment amount is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if expected_amount < 1 or requested_amount != expected_amount:
        return Response(
            {'success': False, 'message': 'Payment amount must match the booking total.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if Payment.objects.filter(
        booking=booking,
        status='SUCCESS',
        is_simulated=False,
        paid_at__isnull=False,
    ).exists():
        return Response(
            {'success': False, 'message': 'This booking already has a successful payment.'},
            status=status.HTTP_409_CONFLICT,
        )

    account_reference = request.data.get('accountReference') or f'EVT-{booking.id}'

    try:
        stk_response = mpesa_service.initiate_stk_push(
            phone=phone,
            amount=int(expected_amount),
            account_reference=account_reference,
            description='Booking Payment',
        )
    except Exception as exc:
        return Response(
            {'success': False, 'message': str(exc)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if stk_response.get('ResponseCode') != '0':
        return Response(
            {
                'success': False,
                'message': stk_response.get('errorMessage')
                or stk_response.get('ResponseDescription')
                or 'STK push failed',
                'raw': stk_response,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    payment = Payment.objects.create(
        booking=booking,
        checkout_request_id=stk_response['CheckoutRequestID'],
        merchant_request_id=stk_response.get('MerchantRequestID', ''),
        customer_phone=phone,
        amount=expected_amount,
        account_reference=account_reference,
        status='PENDING',
    )

    return Response({
        'success': True,
        'message': 'STK push sent. Enter M-Pesa PIN on your phone.',
        'checkoutRequestId': payment.checkout_request_id,
        'merchantRequestId': payment.merchant_request_id,
        'customerMessage': stk_response.get('CustomerMessage', ''),
    })


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def mpesa_callback(request):
    """
    POST /api/mpesa/callback/
    Safaricom posts the result here. MUST always return 200.
    """
    try:
        stk = request.data.get('Body', {}).get('stkCallback', {})
        checkout_id = stk.get('CheckoutRequestID')
        if not checkout_id:
            logging.getLogger(__name__).warning('Received an STK callback without a checkout ID.')
            return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})

        payment_info = Payment.objects.filter(
            checkout_request_id=checkout_id
        ).values('id', 'booking_id').first()
        if not payment_info:
            logging.getLogger(__name__).warning(
                'Received an STK callback for an unknown checkout ID.'
            )
            return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})

        try:
            result_code = int(stk.get('ResultCode'))
        except (TypeError, ValueError):
            logging.getLogger(__name__).warning(
                'Received an STK callback with an invalid result code.'
            )
            return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})

        metadata = {
            item.get('Name'): item.get('Value')
            for item in stk.get('CallbackMetadata', {}).get('Item', []) or []
            if isinstance(item, dict) and item.get('Name')
        }

        with transaction.atomic():
            booking = Booking.objects.select_for_update().get(pk=payment_info['booking_id'])
            payment = Payment.objects.select_for_update().get(pk=payment_info['id'])
            if payment.is_simulated or payment.status != 'PENDING':
                return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})

            payment.result_code = result_code
            payment.result_desc = str(stk.get('ResultDesc') or '')
            schedule_payout = False

            if result_code == 0:
                try:
                    if metadata.get('Amount') is not None:
                        payment.amount = Decimal(str(metadata['Amount'])).quantize(
                            Decimal('1'),
                            rounding=ROUND_HALF_UP,
                        )
                except Exception:
                    logging.getLogger(__name__).exception(
                        'STK callback contained an invalid amount for payment ID %s.',
                        payment.id,
                    )

                payment.status = 'SUCCESS'
                payment.paid_at = timezone.now()
                payment.mpesa_receipt_number = str(metadata.get('MpesaReceiptNumber') or '')
                payment.transaction_date = str(metadata.get('TransactionDate') or '')

                prior_real_collection = Payment.objects.filter(
                    booking=booking,
                    status='SUCCESS',
                    is_simulated=False,
                    paid_at__isnull=False,
                ).exclude(pk=payment.pk).exists()
                if prior_real_collection:
                    payment.payout_status = 'FAILED'
                    payment.payout_error = (
                        'A second successful collection was received for this booking; '
                        'manual reconciliation is required.'
                    )
                    payment.manual_reconciliation_required = True
                else:
                    try:
                        commission, provider_payout = payout_service.calculate_payment_split(
                            payment.amount
                        )
                        payment.commission_amount = commission
                        payment.provider_payout_amount = provider_payout
                        if booking.status == 'CANCELLED':
                            payment.payout_status = 'FAILED'
                            payment.payout_error = (
                                'Booking cancellation requires manual payment reconciliation; '
                                'no automatic payout or refund was issued.'
                            )
                            payment.manual_reconciliation_required = True
                        else:
                            try:
                                payment.payout_phone = payout_service.resolve_provider_phone(booking)
                            except ValueError:
                                payment.payout_phone = ''
                            payment.payout_status = 'PENDING'
                            schedule_payout = True
                    except ValueError as exc:
                        payment.payout_status = 'FAILED'
                        payment.payout_error = str(exc)
                        payment.manual_reconciliation_required = True
                        logging.getLogger(__name__).exception(
                            'Commission split could not be calculated for payment ID %s.',
                            payment.id,
                        )
            elif result_code == 1032:
                payment.status = 'CANCELLED'
            else:
                payment.status = 'FAILED'

            payment.save()
            if schedule_payout:
                transaction.on_commit(
                    lambda payment_id=payment.id: payout_service.initiate_provider_payout(payment_id)
                )

    except Exception:
        logging.getLogger(__name__).exception('Failed to process STK callback.')

    return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def mpesa_b2c_result(request):
    result = request.data.get('Result') or {}
    if not isinstance(result, dict):
        logging.getLogger(__name__).warning('Received a malformed B2C result callback.')
        return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})
    try:
        payout_service.handle_b2c_callback(result)
    except Exception:
        logging.getLogger(__name__).exception('Failed to process B2C result callback.')
    return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def mpesa_b2c_timeout(request):
    result = request.data.get('Result') or {}
    if not isinstance(result, dict):
        logging.getLogger(__name__).warning('Received a malformed B2C timeout callback.')
        return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})
    try:
        payout_service.handle_b2c_callback(result, timeout=True)
    except Exception:
        logging.getLogger(__name__).exception('Failed to process B2C timeout callback.')
    return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mpesa_retry_payout(request, payment_id):
    if not is_admin_user(request):
        raise PermissionDenied('Administrator privileges are required to retry a payout.')

    try:
        payment = payout_service.initiate_provider_payout(payment_id, retry=True)
    except Payment.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Payment not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )
    except payout_service.PayoutRetryNotAllowed as exc:
        return Response(
            {'success': False, 'message': str(exc)},
            status=status.HTTP_409_CONFLICT,
        )

    payment.refresh_from_db()
    response_data = {
        'success': True,
        'payment': PaymentSerializer(payment).data,
        'booking': BookingSerializer(payment.booking).data,
    }
    if payment.payout_status == 'FAILED':
        response_data['success'] = False
        response_data['message'] = payment.payout_error or 'Provider payout failed.'
        return Response(response_data, status=status.HTTP_502_BAD_GATEWAY)
    return Response(response_data)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def mpesa_status(request, checkout_request_id):
    """GET /api/mpesa/status/<checkout_request_id>/"""
    payment = Payment.objects.filter(checkout_request_id=checkout_request_id).first()
    if not payment:
        return Response(
            {'success': False, 'message': 'Payment not found'},
            status=status.HTTP_404_NOT_FOUND,
        )
    return Response({'success': True, 'payment': PaymentSerializer(payment).data})


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def mpesa_status_by_booking(request, booking_id):
    """GET /api/mpesa/status-by-booking/<booking_id>/"""
    payment = Payment.objects.filter(booking_id=booking_id).order_by('-created_at').first()
    if not payment:
        return Response(
            {'success': False, 'message': 'No payment for this booking'},
            status=status.HTTP_404_NOT_FOUND,
        )
    return Response({'success': True, 'payment': PaymentSerializer(payment).data})