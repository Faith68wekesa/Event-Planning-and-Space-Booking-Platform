from rest_framework import serializers
from .models import (
    User, VendorProfile, VenueOwnerProfile, Venue, Booking, Review, Message, Event, EventService,
    Notification, CustomerReminderPreference
)

class UserSerializer(serializers.ModelSerializer):
    is_provider = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'role', 
            'phone_number', 'avatar_url', 'bio', 'is_customer', 'is_vendor', 
            'is_venue_owner', 'is_provider', 'is_active', 'is_staff', 'is_superuser', 'date_joined'
        ]


class VenueOwnerProfileSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)

    class Meta:
        model = VenueOwnerProfile
        fields = [
            'id', 'user', 'user_details', 'business_name', 'business_type',
            'contact_email', 'contact_phone', 'location', 'address',
            'description', 'years_in_business', 'website_url', 'logo_url',
            'verification_status', 'is_verified', 'created_at'
        ]


class VendorProfileSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    vendor_type_display = serializers.CharField(source='vendor_type', read_only=True)
    starting_price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        try:
            sp = float(data.get('starting_price') or 0)
        except (ValueError, TypeError):
            sp = 0.0

        if sp <= 0:
            from django.db.models import Min
            min_p = instance.venues.filter(price_per_day__gt=0).aggregate(min_p=Min('price_per_day'))['min_p']
            if min_p is not None:
                data['starting_price'] = float(min_p)
            else:
                data['starting_price'] = sp
        else:
            data['starting_price'] = sp
        return data

    class Meta:
        model = VendorProfile
        fields = [
            'id', 'user', 'user_details', 'business_name', 'vendor_type', 
            'vendor_type_display', 'description', 'location', 'address',
            'starting_price', 'contact_email', 'contact_phone',
            'years_in_business', 'website_url', 'logo_url',
            'verification_status', 'is_verified', 'portfolio_images', 
            'rating', 'review_count', 'created_at'
        ]


class VenueSerializer(serializers.ModelSerializer):
    vendor_name = serializers.ReadOnlyField(source='vendor.business_name')
    owner_name = serializers.ReadOnlyField(source='owner.business_name')
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    owner_user_id = serializers.SerializerMethodField()

    def get_owner_user_id(self, obj):
        if obj.owner and obj.owner.user_id:
            return obj.owner.user_id
        if obj.vendor and obj.vendor.user_id:
            return obj.vendor.user_id
        return None

    def to_internal_value(self, data):
        if hasattr(data, 'copy'):
            data = data.copy()
        elif isinstance(data, dict):
            data = dict(data)
        if isinstance(data, dict) and 'image_url' in data and data['image_url']:
            data['image_url'] = Venue.clean_image_url(data['image_url'])
        return super().to_internal_value(data)

    class Meta:
        model = Venue
        fields = [
            'id', 'vendor', 'vendor_name', 'owner', 'owner_name', 'owner_user_id', 'title', 'description', 'category', 
            'category_display', 'location', 'address', 'capacity', 'price_per_day', 
            'price_per_hour', 'amenities', 'image_url', 'is_verified', 'is_available', 
            'rating', 'review_count', 'created_at'
        ]


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    target_name = serializers.SerializerMethodField()

    def get_user_name(self, obj):
        if obj.user.first_name:
            return f"{obj.user.first_name} {obj.user.last_name or ''}".strip()
        return obj.user.username

    def get_target_name(self, obj):
        if obj.venue:
            return obj.venue.title
        if obj.vendor:
            return obj.vendor.business_name
        return "Service"

    class Meta:
        model = Review
        fields = [
            'id', 'user', 'user_name', 'booking', 'venue', 'vendor', 
            'target_name', 'rating', 'comment', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Rating must be between 1 and 5 stars.")
        return value


class BookingSerializer(serializers.ModelSerializer):
    customer_name = serializers.ReadOnlyField(source='customer.username')
    customer_email = serializers.ReadOnlyField(source='customer.email')
    venue_details = VenueSerializer(source='venue', read_only=True)
    vendor_details = VendorProfileSerializer(source='vendor', read_only=True)
    provider_user_id = serializers.SerializerMethodField()
    has_reviewed = serializers.SerializerMethodField()
    review = ReviewSerializer(read_only=True)

    def get_provider_user_id(self, obj):
        if obj.venue:
            if obj.venue.owner and obj.venue.owner.user_id:
                return obj.venue.owner.user_id
            if obj.venue.vendor and obj.venue.vendor.user_id:
                return obj.venue.vendor.user_id
        if obj.vendor and obj.vendor.user_id:
            return obj.vendor.user_id
        return None

    def get_has_reviewed(self, obj):
        return hasattr(obj, 'review') and obj.review is not None

    class Meta:
        model = Booking
        fields = [
            'id', 'customer', 'customer_name', 'customer_email', 'venue', 'venue_details', 
            'vendor', 'vendor_details', 'provider_user_id', 'event_title', 'event_type', 'event_date', 
            'end_date', 'guest_count', 'total_price', 'status', 'notes', 
            'has_reviewed', 'review',
            'created_at', 'updated_at'
        ]

    def validate(self, attrs):
        from core.services.booking_validator import BookingCapacityValidator
        
        customer = attrs.get('customer') or (self.instance.customer if self.instance else None)
        event_date = attrs.get('event_date') or (self.instance.event_date if self.instance else None)
        guest_count = attrs.get('guest_count') if 'guest_count' in attrs else (self.instance.guest_count if self.instance else 0)
        venue = attrs.get('venue') or (self.instance.venue if self.instance else None)
        vendor = attrs.get('vendor') or (self.instance.vendor if self.instance else None)
        event_type = attrs.get('event_type') or (self.instance.event_type if self.instance else None)
        notes = attrs.get('notes') if 'notes' in attrs else (self.instance.notes if self.instance else None)

        if event_date and guest_count is not None:
            BookingCapacityValidator.validate_booking(
                customer=customer,
                event_date=event_date,
                guest_count=guest_count,
                venue=venue,
                vendor=vendor,
                event_type=event_type,
                notes=notes,
                exclude_booking_id=self.instance.id if self.instance else None
            )

        return attrs


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_avatar = serializers.SerializerMethodField()
    recipient_name = serializers.SerializerMethodField()
    recipient_avatar = serializers.SerializerMethodField()
    venue_title = serializers.ReadOnlyField(source='venue.title')
    vendor_name = serializers.ReadOnlyField(source='vendor.business_name')
    event_title = serializers.ReadOnlyField(source='booking.event_title')

    def get_sender_name(self, obj):
        if obj.sender.first_name:
            return f"{obj.sender.first_name} {obj.sender.last_name or ''}".strip()
        return obj.sender.username

    def get_sender_avatar(self, obj):
        return getattr(obj.sender, 'avatar_url', None)

    def get_recipient_name(self, obj):
        if obj.recipient.first_name:
            return f"{obj.recipient.first_name} {obj.recipient.last_name or ''}".strip()
        return obj.recipient.username

    def get_recipient_avatar(self, obj):
        return getattr(obj.recipient, 'avatar_url', None)

    class Meta:
        model = Message
        fields = [
            'id', 'sender', 'sender_name', 'sender_avatar',
            'recipient', 'recipient_name', 'recipient_avatar',
            'booking', 'event_title', 'venue', 'venue_title', 'vendor', 'vendor_name',
            'content', 'is_read', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class EventServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventService
        fields = [
            'id', 'event', 'name', 'category', 'notes',
            'estimated_cost', 'is_completed', 'due_date', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_name(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Service name is required and cannot be blank.")
        return str(value).strip()


class EventSerializer(serializers.ModelSerializer):
    owner_name = serializers.SerializerMethodField()
    services = EventServiceSerializer(many=True, read_only=True)

    def get_owner_name(self, obj):
        if obj.owner:
            full = f"{obj.owner.first_name} {obj.owner.last_name or ''}".strip()
            return full if full else obj.owner.username
        return ''

    def validate_name(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Event name is required and cannot be blank.")
        return str(value).strip()

    def validate_event_type(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Event type is required and cannot be blank.")
        return str(value).strip()

    def validate_location(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Location is required and cannot be blank.")
        return str(value).strip()

    def validate_expected_guest_count(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Expected guest count cannot be negative.")
        return value or 0

    def validate_budget(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Budget cannot be negative.")
        return value or 0

    def validate(self, attrs):
        start_time = attrs.get('start_time')
        end_time = attrs.get('end_time')
        if start_time and end_time and end_time < start_time:
            raise serializers.ValidationError({"end_time": "End time cannot be earlier than start time."})
        return attrs

    class Meta:
        model = Event
        fields = [
            'id', 'owner', 'owner_name', 'name', 'event_type', 'date',
            'start_time', 'end_time', 'location', 'expected_guest_count',
            'budget', 'description', 'status', 'image_url', 'services', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at']


class NotificationSerializer(serializers.ModelSerializer):
    event_name = serializers.CharField(source='event.name', read_only=True)
    task_name = serializers.CharField(source='task.name', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'user', 'event', 'event_name', 'task', 'task_name',
            'title', 'message', 'notification_type', 'is_read', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at']


class CustomerReminderPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerReminderPreference
        fields = [
            'id', 'user', 'in_app_enabled', 'email_enabled',
            'remind_7_days', 'remind_1_day', 'remind_due_today', 'remind_overdue', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'updated_at']


