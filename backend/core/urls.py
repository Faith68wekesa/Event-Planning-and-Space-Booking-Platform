from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, VendorProfileViewSet, VenueViewSet, 
    BookingViewSet, ReviewViewSet, platform_stats
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'vendors', VendorProfileViewSet, basename='vendor')
router.register(r'venues', VenueViewSet, basename='venue')
router.register(r'bookings', BookingViewSet, basename='booking')
router.register(r'reviews', ReviewViewSet, basename='review')

urlpatterns = [
    path('', include(router.urls)),
    path('stats/', platform_stats, name='platform-stats'),
]
