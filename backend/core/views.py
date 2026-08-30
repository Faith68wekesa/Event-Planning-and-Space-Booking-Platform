from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, action
from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Q, Sum
from .models import User, VendorProfile, Venue, Booking, Review
from .serializers import (
    UserSerializer, VendorProfileSerializer, VenueSerializer, 
    BookingSerializer, ReviewSerializer
)

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
        vendor.save()
        return Response({'status': 'updated', 'is_verified': vendor.is_verified})


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
        status_param = self.request.query_params.get('status')

        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        if vendor_id:
            queryset = queryset.filter(Q(vendor_id=vendor_id) | Q(venue__vendor_id=vendor_id))
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
    
    # Check if username or email exists
    if User.objects.filter(username=data.get('username')).exists():
        return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email=data.get('email')).exists():
        return Response({'error': 'Email already exists'}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        # Create User
        user = User.objects.create_user(
            username=data.get('username'),
            email=data.get('email'),
            password=data.get('password'),
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            role='VENDOR'
        )
        
        # Create VendorProfile
        vendor = VendorProfile.objects.create(
            user=user,
            business_name=data.get('business_name'),
            vendor_type=data.get('vendor_type'),
            description=data.get('description'),
            location=data.get('location'),
            starting_price=data.get('starting_price', 0),
            contact_email=data.get('email'),
            contact_phone=data.get('phone_number', ''),
            is_verified=False
        )
        
        serializer = VendorProfileSerializer(vendor)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
def login_vendor(request):
    username = request.data.get('username')
    password = request.data.get('password')
    
    user = authenticate(username=username, password=password)
    
    if user is not None:
        if user.role != 'VENDOR':
            return Response({'error': 'Account is not a vendor'}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            vendor = VendorProfile.objects.get(user=user)
            serializer = VendorProfileSerializer(vendor)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except VendorProfile.DoesNotExist:
            return Response({'error': 'Vendor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    else:
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


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
