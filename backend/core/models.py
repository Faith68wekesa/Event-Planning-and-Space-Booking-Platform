from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator

class User(AbstractUser):
    ROLE_CHOICES = [
        ('CUSTOMER', 'Customer'),
        ('PROVIDER', 'Business Provider'),
        ('VENDOR', 'Vendor / Service Provider'),
        ('VENUE_OWNER', 'Venue Owner'),
        ('ADMIN', 'Administrator'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='CUSTOMER')
    is_customer = models.BooleanField(default=True)
    is_vendor = models.BooleanField(default=False)
    is_venue_owner = models.BooleanField(default=False)

    @property
    def is_provider(self):
        return self.role == 'PROVIDER' or (self.is_vendor and self.is_venue_owner)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    avatar_url = models.URLField(max_length=500, blank=True, null=True)
    bio = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


class VenueOwnerProfile(models.Model):
    VERIFICATION_STATUS_CHOICES = [
        ('PENDING', 'Pending Verification'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='venue_owner_profile')
    business_name = models.CharField(max_length=150)
    business_type = models.CharField(max_length=100, default='Event Venue', blank=True)
    contact_email = models.EmailField(blank=True, null=True)
    contact_phone = models.CharField(max_length=20, blank=True, null=True)
    location = models.CharField(max_length=100, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    years_in_business = models.IntegerField(null=True, blank=True)
    website_url = models.URLField(max_length=500, blank=True, null=True)
    logo_url = models.URLField(max_length=500, blank=True, null=True)
    verification_status = models.CharField(max_length=20, choices=VERIFICATION_STATUS_CHOICES, default='PENDING')
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.business_name} ({self.user.username})"


class VendorProfile(models.Model):
    VERIFICATION_STATUS_CHOICES = [
        ('PENDING', 'Pending Verification'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='vendor_profile')
    business_name = models.CharField(max_length=150)
    vendor_type = models.CharField(max_length=100)
    description = models.TextField()
    location = models.CharField(max_length=100)
    address = models.CharField(max_length=255, blank=True, null=True)
    starting_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    contact_email = models.EmailField(blank=True, null=True)
    contact_phone = models.CharField(max_length=20, blank=True, null=True)
    years_in_business = models.IntegerField(null=True, blank=True)
    website_url = models.URLField(max_length=500, blank=True, null=True)
    logo_url = models.URLField(max_length=500, blank=True, null=True)
    verification_status = models.CharField(max_length=20, choices=VERIFICATION_STATUS_CHOICES, default='PENDING')
    is_verified = models.BooleanField(default=False)
    portfolio_images = models.JSONField(default=list, blank=True)
    rating = models.FloatField(default=4.8)
    review_count = models.IntegerField(default=12)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.logo_url:
            self.logo_url = Venue.clean_image_url(self.logo_url)
        if self.portfolio_images and isinstance(self.portfolio_images, list):
            self.portfolio_images = [Venue.clean_image_url(img) for img in self.portfolio_images if img]
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.business_name} - {self.vendor_type}"


class ProviderAvailabilitySetting(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='availability_settings')
    max_guests = models.IntegerField(default=100, help_text="Total guest / attendee capacity across events on a day")
    working_hours_start = models.TimeField(default='08:00', help_text="Earliest booking start time")
    working_hours_end = models.TimeField(default='18:00', help_text="Latest booking end time")
    buffer_time_minutes = models.IntegerField(default=30, help_text="Buffer time between events in minutes")
    unavailable_dates = models.JSONField(default=list, blank=True, help_text="List of blocked dates in YYYY-MM-DD format")
    day_statuses = models.JSONField(default=dict, blank=True, help_text="Dictionary of YYYY-MM-DD to status (AVAILABLE, UNAVAILABLE, etc)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Availability Setting for {self.user.username} (Max {self.max_guests} guests)"


class Venue(models.Model):
    CATEGORY_CHOICES = [
        ('WEDDING', 'Wedding Gardens & Halls'),
        ('CONFERENCE', 'Conference & Corporate Centers'),
        ('BIRTHDAY', 'Birthday & Private Party Venues'),
        ('OUTDOOR', 'Outdoor & Picnic Grounds'),
        ('PARTY', 'Nightlife & Celebration Spaces'),
        ('EXHIBITION', 'Exhibition & Trade Halls'),
        ('PHOTOGRAPHY', 'Photography & Videography'),
        ('CATERING', 'Catering & Bar Service'),
        ('DECORATION', 'Event Decoration & Styling'),
        ('ENTERTAINMENT', 'DJ & Entertainment'),
        ('PLANNING', 'Event Planning & Coordination'),
        ('SOUND', 'Sound & Lighting Equipment'),
    ]
    vendor = models.ForeignKey(VendorProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='venues')
    owner = models.ForeignKey(VenueOwnerProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='venues')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    location = models.CharField(max_length=100)
    address = models.CharField(max_length=255, blank=True, null=True)
    capacity = models.IntegerField()
    price_per_day = models.DecimalField(max_digits=10, decimal_places=2)
    price_per_hour = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    amenities = models.JSONField(default=list, help_text="List of amenity strings")
    image_url = models.URLField(max_length=500, blank=True, null=True)
    is_verified = models.BooleanField(default=False)
    is_available = models.BooleanField(default=True)
    rating = models.FloatField(default=4.9)
    review_count = models.IntegerField(default=24)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.image_url:
            self.image_url = self.clean_image_url(self.image_url)
        super().save(*args, **kwargs)
        if self.vendor:
            from django.db.models import Min
            min_p = Venue.objects.filter(vendor=self.vendor, price_per_day__gt=0).aggregate(min_p=Min('price_per_day'))['min_p']
            if min_p is not None and (self.vendor.starting_price <= 0 or self.vendor.starting_price != min_p):
                self.vendor.starting_price = min_p
                self.vendor.save(update_fields=['starting_price'])

    def delete(self, *args, **kwargs):
        vendor = self.vendor
        res = super().delete(*args, **kwargs)
        if vendor:
            from django.db.models import Min
            min_p = Venue.objects.filter(vendor=vendor, price_per_day__gt=0).aggregate(min_p=Min('price_per_day'))['min_p']
            vendor.starting_price = min_p if min_p is not None else 0.00
            vendor.save(update_fields=['starting_price'])
        return res

    @staticmethod
    def clean_image_url(url):
        if not url or not isinstance(url, str):
            return url
        url = url.strip().strip('"\'')
        if 'google.com/imgres' in url or '/imgres?' in url:
            from urllib.parse import urlparse, parse_qs, unquote
            try:
                parsed = urlparse(url)
                qs = parse_qs(parsed.query)
                if 'imgurl' in qs and qs['imgurl']:
                    return unquote(qs['imgurl'][0])
            except Exception:
                pass
            import re
            m = re.search(r'[?&]imgurl=([^&]+)', url)
            if m:
                from urllib.parse import unquote
                return unquote(m.group(1))
        if 'bing.com/images' in url and 'mediaurl=' in url:
            import re
            m = re.search(r'[?&]mediaurl=([^&]+)', url)
            if m:
                from urllib.parse import unquote
                return unquote(m.group(1))
        return url

    def __str__(self):
        return f"{self.title} ({self.location})"


class Booking(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
        ('COMPLETED', 'Completed'),
    ]
    customer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookings')
    venue = models.ForeignKey(Venue, on_delete=models.SET_NULL, null=True, blank=True, related_name='bookings')
    vendor = models.ForeignKey(VendorProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='bookings')
    event_title = models.CharField(max_length=200, default='Special Event')
    event_type = models.CharField(max_length=50)
    event_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    guest_count = models.IntegerField(default=50)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        target = self.venue.title if self.venue else (self.vendor.business_name if self.vendor else 'Booking')
        return f"Booking #{self.id} for {target} by {self.customer.username} ({self.status})"


class Review(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews')
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, null=True, blank=True, related_name='review')
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, null=True, blank=True, related_name='reviews')
    vendor = models.ForeignKey(VendorProfile, on_delete=models.CASCADE, null=True, blank=True, related_name='reviews')
    rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['user', 'booking'], name='unique_user_booking_review')
        ]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.venue:
            self.venue.update_rating_stats()
        if self.vendor:
            self.vendor.update_rating_stats()

    def delete(self, *args, **kwargs):
        venue = self.venue
        vendor = self.vendor
        super().delete(*args, **kwargs)
        if venue:
            venue.update_rating_stats()
        if vendor:
            vendor.update_rating_stats()

    def __str__(self):
        return f"Review ({self.rating}/5) by {self.user.username}"


class EmailOTP(models.Model):
    email = models.EmailField(unique=True)
    otp_code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.email} - {self.otp_code}"


class Message(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages')
    booking = models.ForeignKey(Booking, on_delete=models.SET_NULL, null=True, blank=True, related_name='messages')
    venue = models.ForeignKey(Venue, on_delete=models.SET_NULL, null=True, blank=True, related_name='messages')
    vendor = models.ForeignKey(VendorProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='messages')
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Msg from {self.sender.username} to {self.recipient.username} ({self.created_at})"


class Event(models.Model):
    STATUS_CHOICES = [
        ('Upcoming', 'Upcoming'),
        ('Planning', 'Planning'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
    ]

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='events')
    name = models.CharField(max_length=200)
    event_type = models.CharField(max_length=100)
    date = models.DateField()
    start_time = models.TimeField(blank=True, null=True)
    end_time = models.TimeField(blank=True, null=True)
    location = models.CharField(max_length=255)
    expected_guest_count = models.PositiveIntegerField(
        default=0,
        validators=[MinValueValidator(0)]
    )
    budget = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        validators=[MinValueValidator(0)]
    )
    description = models.TextField(blank=True, default='')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Upcoming')
    image_url = models.URLField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.event_type}) - {self.owner.username}"


class EventService(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='services')
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True, default='Photography')
    notes = models.TextField(blank=True, default='')
    estimated_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)]
    )
    is_completed = models.BooleanField(default=False)
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.name} - {self.event.name}"


class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('CHECKLIST_REMINDER', 'Checklist Reminder'),
        ('BOOKING_UPDATE', 'Booking Update'),
        ('SYSTEM', 'System Alert'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    event = models.ForeignKey(Event, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    task = models.ForeignKey(EventService, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES, default='CHECKLIST_REMINDER')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.title} ({'Read' if self.is_read else 'Unread'})"


class ChecklistReminderLog(models.Model):
    REMINDER_TYPES = [
        ('7_DAYS', '7 Days Before Deadline'),
        ('1_DAY', '1 Day Before Deadline'),
        ('DUE_TODAY', 'Due Today'),
        ('OVERDUE', 'Task Overdue'),
    ]
    CHANNELS = [
        ('IN_APP', 'In-App Notification'),
        ('EMAIL', 'Email'),
    ]

    task = models.ForeignKey(EventService, on_delete=models.CASCADE, related_name='reminder_logs')
    reminder_type = models.CharField(max_length=20, choices=REMINDER_TYPES)
    channel = models.CharField(max_length=20, choices=CHANNELS, default='IN_APP')
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['task', 'reminder_type', 'channel'],
                name='unique_task_reminder_per_channel'
            )
        ]
        ordering = ['-sent_at']

    def __str__(self):
        return f"{self.task.name} - {self.reminder_type} via {self.channel}"


class CustomerReminderPreference(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='reminder_preferences')
    in_app_enabled = models.BooleanField(default=True)
    email_enabled = models.BooleanField(default=False)
    remind_7_days = models.BooleanField(default=True)
    remind_1_day = models.BooleanField(default=True)
    remind_due_today = models.BooleanField(default=True)
    remind_overdue = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Preferences for {self.user.username}"

