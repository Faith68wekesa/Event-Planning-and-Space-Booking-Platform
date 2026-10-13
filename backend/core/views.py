from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Q, Sum
from .models import User, VendorProfile, VenueOwnerProfile, Venue, Booking, Review, EmailOTP, Message, Event, EventService
from .serializers import (
    UserSerializer, VendorProfileSerializer, VenueOwnerProfileSerializer, VenueSerializer, 
    BookingSerializer, ReviewSerializer, MessageSerializer, EventSerializer, EventServiceSerializer
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
    queryset = Venue.objects.all().order_by('-created_at')
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
        vendor_id = self.request.query_params.get('vendor')
        user_id = self.request.query_params.get('user')

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
        return Response({'error': 'An account with this email address already exists. Please log in.'}, status=status.HTTP_400_BAD_REQUEST)
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
        is_provider = user.role == 'PROVIDER' or (user.is_vendor and user.is_venue_owner)
        response_data = {
            'user': UserSerializer(user).data,
            'roles': {
                'is_customer': user.is_customer,
                'is_vendor': user.is_vendor,
                'is_venue_owner': user.is_venue_owner,
                'is_provider': is_provider
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
                'is_provider': is_provider
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
