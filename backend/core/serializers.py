from rest_framework import serializers
from .models import User, VendorProfile, Venue, Booking, Review

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone_number', 'avatar_url', 'bio']


class VendorProfileSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    vendor_type_display = serializers.CharField(source='get_vendor_type_display', read_only=True)

    class Meta:
        model = VendorProfile
        fields = [
            'id', 'user', 'user_details', 'business_name', 'vendor_type', 
            'vendor_type_display', 'description', 'location', 'starting_price', 
            'contact_email', 'contact_phone', 'is_verified', 'portfolio_images', 
            'rating', 'review_count', 'created_at'
        ]


class VenueSerializer(serializers.ModelSerializer):
    vendor_name = serializers.ReadOnlyField(source='vendor.business_name')
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = Venue
        fields = [
            'id', 'vendor', 'vendor_name', 'title', 'description', 'category', 
            'category_display', 'location', 'address', 'capacity', 'price_per_day', 
            'price_per_hour', 'amenities', 'image_url', 'is_verified', 'is_available', 
            'rating', 'review_count', 'created_at'
        ]


class BookingSerializer(serializers.ModelSerializer):
    customer_name = serializers.ReadOnlyField(source='customer.username')
    venue_details = VenueSerializer(source='venue', read_only=True)
    vendor_details = VendorProfileSerializer(source='vendor', read_only=True)

    class Meta:
        model = Booking
        fields = [
            'id', 'customer', 'customer_name', 'venue', 'venue_details', 
            'vendor', 'vendor_details', 'event_title', 'event_type', 'event_date', 
            'end_date', 'guest_count', 'total_price', 'status', 'notes', 
            'created_at', 'updated_at'
        ]


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = Review
        fields = ['id', 'user', 'user_name', 'venue', 'vendor', 'rating', 'comment', 'created_at']
