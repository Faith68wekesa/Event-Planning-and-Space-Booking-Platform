from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    ROLE_CHOICES = [
        ('CUSTOMER', 'Customer'),
        ('VENDOR', 'Vendor / Service Provider'),
        ('ADMIN', 'Administrator'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='CUSTOMER')
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    avatar_url = models.URLField(max_length=500, blank=True, null=True)
    bio = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


class VendorProfile(models.Model):
    VENDOR_TYPE_CHOICES = [
        ('PLANNER', 'Event Planner'),
        ('CATERER', 'Catering Service'),
        ('PHOTOGRAPHER', 'Photography & Video'),
        ('DECORATOR', 'Decoration & Styling'),
        ('SOUND_LIGHTING', 'Sound & Stage Lighting'),
        ('ENTERTAINMENT', 'DJ & Entertainment'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='vendor_profile')
    business_name = models.CharField(max_length=150)
    vendor_type = models.CharField(max_length=30, choices=VENDOR_TYPE_CHOICES)
    description = models.TextField()
    location = models.CharField(max_length=100)
    starting_price = models.DecimalField(max_digits=10, decimal_places=2, default=10000.00)
    contact_email = models.EmailField(blank=True, null=True)
    contact_phone = models.CharField(max_length=20, blank=True, null=True)
    is_verified = models.BooleanField(default=False)
    portfolio_images = models.JSONField(default=list, blank=True)
    rating = models.FloatField(default=4.8)
    review_count = models.IntegerField(default=12)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.business_name} - {self.get_vendor_type_display()}"


class Venue(models.Model):
    CATEGORY_CHOICES = [
        ('WEDDING', 'Wedding Gardens & Halls'),
        ('CONFERENCE', 'Conference & Corporate Centers'),
        ('BIRTHDAY', 'Birthday & Private Party Venues'),
        ('OUTDOOR', 'Outdoor & Picnic Grounds'),
        ('PARTY', 'Nightlife & Celebration Spaces'),
        ('EXHIBITION', 'Exhibition & Trade Halls'),
    ]
    vendor = models.ForeignKey(VendorProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='venues')
    title = models.CharField(max_length=200)
    description = models.TextField()
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
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, null=True, blank=True, related_name='reviews')
    vendor = models.ForeignKey(VendorProfile, on_delete=models.CASCADE, null=True, blank=True, related_name='reviews')
    rating = models.IntegerField(default=5)
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Review ({self.rating}/5) by {self.user.username}"
