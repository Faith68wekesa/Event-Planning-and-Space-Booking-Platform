from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, VendorProfileViewSet, VenueOwnerProfileViewSet, VenueViewSet, 
    BookingViewSet, ReviewViewSet, platform_stats,
    VendorDashboardView, VendorBookingsView,
    VenueOwnerDashboardView, VenueOwnerBookingsView,
    send_otp, verify_otp, reset_password,
    upload_profile_picture,
    register_user, login_user, request_role
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'vendors', VendorProfileViewSet, basename='vendor')
router.register(r'venue-owners', VenueOwnerProfileViewSet, basename='venue-owner')
router.register(r'venues', VenueViewSet, basename='venue')
router.register(r'bookings', BookingViewSet, basename='booking')
router.register(r'reviews', ReviewViewSet, basename='review')

urlpatterns = [
    path('auth/register/', register_user, name='register-user'),
    path('auth/login/', login_user, name='login-user'),
    path('auth/request-role/', request_role, name='request-role'),
    path('vendors/<int:vendor_id>/dashboard/', VendorDashboardView.as_view(), name='vendor-dashboard'),
    path('vendors/<int:vendor_id>/bookings/', VendorBookingsView.as_view(), name='vendor-bookings'),
    path('venue-owners/<int:owner_id>/dashboard/', VenueOwnerDashboardView.as_view(), name='venue-owner-dashboard'),
    path('venue-owners/<int:owner_id>/bookings/', VenueOwnerBookingsView.as_view(), name='venue-owner-bookings'),
    path('', include(router.urls)),
    path('stats/', platform_stats, name='platform-stats'),
    path('otp/send/', send_otp, name='send-otp'),
    path('otp/verify/', verify_otp, name='verify-otp'),
    path('otp/reset-password/', reset_password, name='reset-password'),
    path('users/<int:user_id>/upload-avatar/', upload_profile_picture, name='upload-avatar'),
]

