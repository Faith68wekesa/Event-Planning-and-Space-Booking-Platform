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
import os
from django.utils import timezone
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from rest_framework.parsers import MultiPartParser, FormParser

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
            is_customer=False, # Wait for explicit role selection
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

    user = authenticate(username=user_obj.username, password=password)
    
    if user is not None:
        response_data = {
            'user': UserSerializer(user).data,
            'roles': {
                'is_customer': user.is_customer,
                'is_vendor': user.is_vendor,
                'is_venue_owner': user.is_venue_owner
            }
        }
        
        if user.is_vendor and hasattr(user, 'vendor_profile'):
            response_data['vendor_profile'] = VendorProfileSerializer(user.vendor_profile).data
            
        if user.is_venue_owner and hasattr(user, 'venue_owner_profile'):
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
            user.is_customer = True
            user.save()
        elif role == 'VENDOR':
            if not user.is_vendor:
                user.is_vendor = True
                user.save()
                # Create empty profile
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
            if not user.is_venue_owner:
                user.is_venue_owner = True
                user.save()
                # Create empty profile
                VenueOwnerProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        'business_name': f"{user.first_name}'s Venues" if user.first_name else "My Venues",
                        'contact_email': user.email,
                        'contact_phone': user.phone_number,
                        'business_type': 'Event Venue'
                    }
                )
        else:
            return Response({'error': 'Invalid role'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Refetch to get updated profiles
        response_data = {
            'user': UserSerializer(user).data,
            'roles': {
                'is_customer': user.is_customer,
                'is_vendor': user.is_vendor,
                'is_venue_owner': user.is_venue_owner
            }
        }
        
        if user.is_vendor and hasattr(user, 'vendor_profile'):
            response_data['vendor_profile'] = VendorProfileSerializer(user.vendor_profile).data
            
        if user.is_venue_owner and hasattr(user, 'venue_owner_profile'):
            response_data['venue_owner_profile'] = VenueOwnerProfileSerializer(user.venue_owner_profile).data
            
        return Response(response_data, status=status.HTTP_200_OK)
        
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
