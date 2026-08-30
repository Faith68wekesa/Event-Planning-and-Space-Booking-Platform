from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, VendorProfileViewSet, VenueViewSet, 
    BookingViewSet, ReviewViewSet, platform_stats, register_vendor, login_vendor,
    VendorDashboardView, VendorBookingsView
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'vendors', VendorProfileViewSet, basename='vendor')
router.register(r'venues', VenueViewSet, basename='venue')
router.register(r'bookings', BookingViewSet, basename='booking')
router.register(r'reviews', ReviewViewSet, basename='review')

urlpatterns = [
    path('vendors/register/', register_vendor, name='register-vendor'),
    path('vendors/login/', login_vendor, name='login-vendor'),
    path('vendors/<int:vendor_id>/dashboard/', VendorDashboardView.as_view(), name='vendor-dashboard'),
    path('vendors/<int:vendor_id>/bookings/', VendorBookingsView.as_view(), name='vendor-bookings'),
    path('', include(router.urls)),
    path('stats/', platform_stats, name='platform-stats'),
]
