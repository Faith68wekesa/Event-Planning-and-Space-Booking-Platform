from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Q, Sum
from .models import User, VendorProfile, VenueOwnerProfile, Venue, Booking, Review, EmailOTP
from .serializers import (
    UserSerializer, VendorProfileSerializer, VenueOwnerProfileSerializer, VenueSerializer, 
    BookingSerializer, ReviewSerializer
)
from django.core.mail import send_mail
import random
import datetime
from django.utils import timezone

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer


class VendorProfileViewSet(viewsets.ModelViewSet):
    queryset = VendorProfile.objects.all().order_by('-rating')
    serializer_class = VendorProfileSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        vendor_type = self.request.query_params.get('vendor_type')
        location = self.request.query_params.get('location')
        verified = self.request.query_params.get('verified')

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
        if verified == 'true':
            queryset = queryset.filter(is_verified=True)

        return queryset

    @action(detail=True, methods=['post'])
    def toggle_verify(self, request, pk=None):
        vendor = self.get_object()
        vendor.is_verified = not vendor.is_verified
        vendor.verification_status = 'APPROVED' if vendor.is_verified else 'PENDING'
        vendor.save()
        return Response(VendorProfileSerializer(vendor).data)

    @action(detail=True, methods=['post', 'patch'])
    def set_verification(self, request, pk=None):
        vendor = self.get_object()
        new_status = request.data.get('verification_status')
        if new_status in ['APPROVED', 'REJECTED', 'PENDING']:
            vendor.verification_status = new_status
            vendor.is_verified = (new_status == 'APPROVED')
            vendor.save()
            return Response(VendorProfileSerializer(vendor).data)
        return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)


class VenueOwnerProfileViewSet(viewsets.ModelViewSet):
    queryset = VenueOwnerProfile.objects.all().order_by('-created_at')
    serializer_class = VenueOwnerProfileSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        location = self.request.query_params.get('location')
        verified = self.request.query_params.get('verified')

        if search:
            queryset = queryset.filter(
                Q(business_name__icontains=search) | 
                Q(location__icontains=search) |
                Q(business_type__icontains=search)
            )
        if location and location != 'ALL':
            queryset = queryset.filter(location__icontains=location)
        if verified == 'true':
            queryset = queryset.filter(is_verified=True)

        return queryset

    @action(detail=True, methods=['post'])
    def toggle_verify(self, request, pk=None):
        owner = self.get_object()
        owner.is_verified = not owner.is_verified
        owner.verification_status = 'APPROVED' if owner.is_verified else 'PENDING'
        owner.save()
        return Response(VenueOwnerProfileSerializer(owner).data)

    @action(detail=True, methods=['post', 'patch'])
    def set_verification(self, request, pk=None):
        owner = self.get_object()
        new_status = request.data.get('verification_status')
        if new_status in ['APPROVED', 'REJECTED', 'PENDING']:
            owner.verification_status = new_status
            owner.is_verified = (new_status == 'APPROVED')
            owner.save()
            return Response(VenueOwnerProfileSerializer(owner).data)
        return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)


class VenueViewSet(viewsets.ModelViewSet):
    queryset = Venue.objects.all().order_by('-rating')
    serializer_class = VenueSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        category = self.request.query_params.get('category')
        location = self.request.query_params.get('location')
        max_price = self.request.query_params.get('max_price')
        min_capacity = self.request.query_params.get('min_capacity')
        verified = self.request.query_params.get('verified')
        owner_id = self.request.query_params.get('owner')

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
        if owner_id:
            queryset = queryset.filter(owner_id=owner_id)
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
            queryset = queryset.filter(is_verified=True)

        return queryset

    @action(detail=True, methods=['post'])
    def toggle_verify(self, request, pk=None):
        venue = self.get_object()
        venue.is_verified = not venue.is_verified
        venue.save()
        return Response({'status': 'updated', 'is_verified': venue.is_verified})


class BookingViewSet(viewsets.ModelViewSet):
    queryset = Booking.objects.all().order_by('-created_at')
    serializer_class = BookingSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        customer_id = self.request.query_params.get('customer')
        vendor_id = self.request.query_params.get('vendor')
        owner_id = self.request.query_params.get('owner')
        status_param = self.request.query_params.get('status')

        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        if vendor_id:
            queryset = queryset.filter(Q(vendor_id=vendor_id) | Q(venue__vendor_id=vendor_id))
        if owner_id:
            queryset = queryset.filter(venue__owner_id=owner_id)
        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        booking = self.get_object()
        new_status = request.data.get('status')
        if new_status in dict(Booking.STATUS_CHOICES):
            booking.status = new_status
            booking.save()
            return Response(BookingSerializer(booking).data)
        return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all().order_by('-created_at')
    serializer_class = ReviewSerializer


@api_view(['GET'])
def platform_stats(request):
    total_venues = Venue.objects.count()
    verified_venues = Venue.objects.filter(is_verified=True).count()
    total_vendors = VendorProfile.objects.count()
    verified_vendors = VendorProfile.objects.filter(is_verified=True).count()
    total_bookings = Booking.objects.count()
    satisfied_clients = 250 + total_bookings

    return Response({
        'total_venues': total_venues,
        'verified_venues': verified_venues,
        'total_vendors': total_vendors,
        'verified_vendors': verified_vendors,
        'total_bookings': total_bookings,
        'satisfied_clients': satisfied_clients,
    })


@api_view(['POST'])
@transaction.atomic
def register_vendor(request):
    data = request.data
    email = data.get('email', '').strip().lower()
    username = data.get('username', '').strip() or email

    if not email:
        return Response({'error': 'Email address is required'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email__iexact=email).exists():
        return Response({'error': 'An account with this email address already exists'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username__iexact=username).exists():
        return Response({'error': 'This username is already taken'}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        full_name = data.get('full_name', '').strip()
        first_name = data.get('first_name', '').strip()
        last_name = data.get('last_name', '').strip()
        if full_name and not (first_name or last_name):
            parts = full_name.split(' ', 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ''

        # Create User
        user = User.objects.create_user(
            username=username,
            email=email,
            password=data.get('password'),
            first_name=first_name,
            last_name=last_name,
            role='VENDOR',
            phone_number=data.get('phone_number', '')
        )
        
        # Create VendorProfile
        vendor = VendorProfile.objects.create(
            user=user,
            business_name=data.get('business_name'),
            vendor_type=data.get('vendor_type', 'Other'),
            description=data.get('description', ''),
            location=data.get('location', ''),
            address=data.get('address', ''),
            starting_price=data.get('starting_price', 0) or 0,
            contact_email=email,
            contact_phone=data.get('phone_number', ''),
            years_in_business=data.get('years_in_business') if data.get('years_in_business') else None,
            website_url=data.get('website_url', '') or data.get('portfolio_url', ''),
            logo_url=data.get('logo_url', ''),
            verification_status='PENDING',
            is_verified=False
        )
        
        serializer = VendorProfileSerializer(vendor)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
def login_vendor(request):
    login_identifier = (request.data.get('username') or request.data.get('email') or '').strip()
    password = request.data.get('password')
    
    # Try finding user by username or email
    user_obj = User.objects.filter(Q(username__iexact=login_identifier) | Q(email__iexact=login_identifier)).first()
    if not user_obj:
        return Response({'error': 'No account found with this email or username'}, status=status.HTTP_401_UNAUTHORIZED)

    user = authenticate(username=user_obj.username, password=password)
    
    if user is not None:
        if user.role != 'VENDOR':
            return Response({'error': 'Account is not registered as a vendor'}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            vendor = VendorProfile.objects.get(user=user)
            serializer = VendorProfileSerializer(vendor)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except VendorProfile.DoesNotExist:
            return Response({'error': 'Vendor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    else:
        return Response({'error': 'Invalid credentials. Please verify your password.'}, status=status.HTTP_401_UNAUTHORIZED)


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


@api_view(['POST'])
@transaction.atomic
def register_venue_owner(request):
    data = request.data
    email = data.get('email', '').strip().lower()
    username = data.get('username', '').strip() or email

    if not email:
        return Response({'error': 'Email address is required'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email__iexact=email).exists():
        return Response({'error': 'An account with this email address already exists'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username__iexact=username).exists():
        return Response({'error': 'This username is already taken'}, status=status.HTTP_400_BAD_REQUEST)
        
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
            role='VENUE_OWNER',
            phone_number=data.get('phone_number', '')
        )
        
        venue_owner = VenueOwnerProfile.objects.create(
            user=user,
            business_name=data.get('business_name'),
            business_type=data.get('business_type', 'Event Venue'),
            contact_email=email,
            contact_phone=data.get('phone_number', ''),
            location=data.get('location', ''),
            address=data.get('address', ''),
            description=data.get('description', ''),
            years_in_business=data.get('years_in_business') if data.get('years_in_business') else None,
            website_url=data.get('website_url', ''),
            logo_url=data.get('logo_url', ''),
            verification_status='PENDING',
            is_verified=False
        )
        
        serializer = VenueOwnerProfileSerializer(venue_owner)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def login_venue_owner(request):
    login_identifier = (request.data.get('username') or request.data.get('email') or '').strip()
    password = request.data.get('password')
    
    user_obj = User.objects.filter(Q(username__iexact=login_identifier) | Q(email__iexact=login_identifier)).first()
    if not user_obj:
        return Response({'error': 'No account found with this email or username'}, status=status.HTTP_401_UNAUTHORIZED)

    user = authenticate(username=user_obj.username, password=password)
    
    if user is not None:
        if user.role != 'VENUE_OWNER':
            return Response({'error': 'Account is not registered as a venue owner'}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            venue_owner = VenueOwnerProfile.objects.get(user=user)
            serializer = VenueOwnerProfileSerializer(venue_owner)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except VenueOwnerProfile.DoesNotExist:
            return Response({'error': 'Venue owner profile not found'}, status=status.HTTP_404_NOT_FOUND)
    else:
        return Response({'error': 'Invalid credentials. Please verify your password.'}, status=status.HTTP_401_UNAUTHORIZED)


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
@transaction.atomic
def register_customer(request):
    data = request.data
    email = data.get('email', '').strip().lower()
    username = data.get('username', '').strip() or email

    if not email:
        return Response({'error': 'Email address is required'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email__iexact=email).exists():
        return Response({'error': 'An account with this email address already exists'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username__iexact=username).exists():
        return Response({'error': 'This username is already taken'}, status=status.HTTP_400_BAD_REQUEST)
        
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
            role='CUSTOMER',
            phone_number=data.get('phone_number', '')
        )
        
        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def login_customer(request):
    login_identifier = (request.data.get('username') or request.data.get('email') or '').strip()
    password = request.data.get('password')
    
    user_obj = User.objects.filter(Q(username__iexact=login_identifier) | Q(email__iexact=login_identifier)).first()
    if not user_obj:
        return Response({'error': 'No account found with this email or username'}, status=status.HTTP_401_UNAUTHORIZED)

    user = authenticate(username=user_obj.username, password=password)
    
    if user is not None:
        if user.role != 'CUSTOMER':
            return Response({'error': 'Account is not registered as a customer'}, status=status.HTTP_403_FORBIDDEN)
            
        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)
    else:
        return Response({'error': 'Invalid credentials. Please verify your password.'}, status=status.HTTP_401_UNAUTHORIZED)


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
