from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, VendorProfileViewSet, VenueOwnerProfileViewSet, VenueViewSet, 
    BookingViewSet, ReviewViewSet, platform_stats, register_vendor, login_vendor,
    VendorDashboardView, VendorBookingsView,
    register_venue_owner, login_venue_owner,
    VenueOwnerDashboardView, VenueOwnerBookingsView,
    register_customer, login_customer,
    send_otp, verify_otp
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'vendors', VendorProfileViewSet, basename='vendor')
router.register(r'venue-owners', VenueOwnerProfileViewSet, basename='venue-owner')
router.register(r'venues', VenueViewSet, basename='venue')
router.register(r'bookings', BookingViewSet, basename='booking')
router.register(r'reviews', ReviewViewSet, basename='review')

urlpatterns = [
    path('customers/register/', register_customer, name='register-customer'),
    path('customers/login/', login_customer, name='login-customer'),
    path('vendors/register/', register_vendor, name='register-vendor'),
    path('vendors/login/', login_vendor, name='login-vendor'),
    path('vendors/<int:vendor_id>/dashboard/', VendorDashboardView.as_view(), name='vendor-dashboard'),
    path('vendors/<int:vendor_id>/bookings/', VendorBookingsView.as_view(), name='vendor-bookings'),
    path('venue-owners/register/', register_venue_owner, name='register-venue-owner'),
    path('venue-owners/login/', login_venue_owner, name='login-venue-owner'),
    path('venue-owners/<int:owner_id>/dashboard/', VenueOwnerDashboardView.as_view(), name='venue-owner-dashboard'),
    path('venue-owners/<int:owner_id>/bookings/', VenueOwnerBookingsView.as_view(), name='venue-owner-bookings'),
    path('', include(router.urls)),
    path('stats/', platform_stats, name='platform-stats'),
    path('otp/send/', send_otp, name='send-otp'),
    path('otp/verify/', verify_otp, name='verify-otp'),
]

