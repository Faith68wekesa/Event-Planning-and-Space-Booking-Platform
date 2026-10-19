import datetime
import re
from typing import Optional, Tuple
from django.db import transaction
from django.db.models import Sum, Q
from rest_framework.exceptions import ValidationError
from core.models import Booking, Venue, VendorProfile, ProviderAvailabilitySetting


class BookingCapacityValidator:
    """
    Module 4: Reusable Capacity and Availability Validation Service for LOCYFY.
    Validates booking requests upon customer submission and upon provider acceptance.
    """

    @staticmethod
    def parse_time_from_notes(notes: Optional[str]) -> Tuple[Optional[datetime.time], Optional[datetime.time]]:
        """Extract start_time and end_time if provided in booking notes."""
        if not notes:
            return None, None
        
        start_time = None
        end_time = None

        start_match = re.search(r'Start Time:\s*(\d{1,2}:\d{2})', notes, re.IGNORECASE)
        if start_match:
            try:
                t_str = start_match.group(1)
                parts = t_str.split(':')
                start_time = datetime.time(int(parts[0]), int(parts[1]))
            except Exception:
                pass

        end_match = re.search(r'End Time:\s*(\d{1,2}:\d{2})', notes, re.IGNORECASE)
        if end_match:
            try:
                t_str = end_match.group(1)
                parts = t_str.split(':')
                end_time = datetime.time(int(parts[0]), int(parts[1]))
            except Exception:
                pass

        return start_time, end_time

    @classmethod
    def validate_booking(
        cls,
        customer,
        event_date: datetime.date,
        guest_count: int,
        venue: Optional[Venue] = None,
        vendor: Optional[VendorProfile] = None,
        event_type: Optional[str] = None,
        notes: Optional[str] = None,
        exclude_booking_id: Optional[int] = None,
        lock_provider: bool = False
    ):
        """
        Main validation method checking:
        1. Target presence (venue or vendor)
        2. Date validity (future date)
        3. Venue capacity limit
        4. Service capability
        5. Provider date availability (custom blocked dates / day statuses)
        6. Working hours compatibility
        7. Remaining capacity after existing confirmed/approved bookings
        """
        if not venue and not vendor:
            raise ValidationError("A booking request must specify either a venue or a service provider.")

        today = datetime.date.today()
        if event_date < today:
            raise ValidationError("Event date cannot be in the past. Please select a future date.")

        if guest_count < 1:
            raise ValidationError("Guest count must be at least 1.")

        # Check listing approval and active status
        if venue:
            if venue.approval_status != 'APPROVED' or not venue.is_verified:
                raise ValidationError("This venue is currently pending administrator verification and cannot accept bookings.")
            if not venue.is_available:
                raise ValidationError("This venue is currently marked as unavailable or inactive.")
            if venue.owner and venue.owner.verification_status != 'APPROVED':
                raise ValidationError("The venue owner account is not verified.")
        if vendor:
            if vendor.verification_status != 'APPROVED' or not vendor.is_verified:
                raise ValidationError("This service provider is currently pending administrator verification and cannot accept bookings.")

        # Determine the provider user and settings
        provider_user = None
        if venue:
            if venue.owner and venue.owner.user:
                provider_user = venue.owner.user
            elif venue.vendor and venue.vendor.user:
                provider_user = venue.vendor.user
        elif vendor and vendor.user:
            provider_user = vendor.user

        # 1. Venue Maximum Capacity Check
        if venue and venue.capacity is not None and venue.capacity > 0:
            if guest_count > venue.capacity:
                raise ValidationError(
                    f"The venue '{venue.title}' has a maximum capacity of {venue.capacity} guests. "
                    f"You requested {guest_count} guests."
                )

        # 2. Service Capability Check
        if vendor:
            if event_type:
                # e.g., Photography vendor receiving catering request
                vendor_type_lower = (vendor.vendor_type or '').lower()
                event_type_lower = event_type.lower()
                # Basic sanity check if requested service clearly conflicts with vendor type
                if 'catering' in vendor_type_lower and any(w in event_type_lower for w in ['dj', 'photography only']):
                    raise ValidationError(
                        f"The service provider '{vendor.business_name}' specializes in {vendor.vendor_type} "
                        f"and does not offer this service capability."
                    )

        # 3. Provider Availability Setting & Working Hours
        avail_setting = None
        if provider_user:
            # If locking requested, lock the availability settings
            if lock_provider:
                avail_setting = ProviderAvailabilitySetting.objects.select_for_update().filter(user=provider_user).first()
            else:
                avail_setting = ProviderAvailabilitySetting.objects.filter(user=provider_user).first()

        date_str = event_date.strftime('%Y-%m-%d')
        if avail_setting:
            # Check custom blocked dates or day statuses
            day_statuses = avail_setting.day_statuses or {}
            unavailable_dates = avail_setting.unavailable_dates or []

            is_blocked = (
                day_statuses.get(date_str) == 'UNAVAILABLE' or 
                date_str in unavailable_dates
            )
            if is_blocked:
                target_name = venue.title if venue else vendor.business_name
                raise ValidationError(
                    f"'{target_name}' has marked {date_str} as unavailable for bookings."
                )

            # Check working hours
            start_time, end_time = cls.parse_time_from_notes(notes)
            if start_time and avail_setting.working_hours_start:
                if start_time < avail_setting.working_hours_start:
                    raise ValidationError(
                        f"Requested start time ({start_time.strftime('%H:%M')}) is earlier than "
                        f"the provider's opening hours ({avail_setting.working_hours_start.strftime('%H:%M')})."
                    )
            if end_time and avail_setting.working_hours_end:
                if end_time > avail_setting.working_hours_end:
                    raise ValidationError(
                        f"Requested end time ({end_time.strftime('%H:%M')}) is later than "
                        f"the provider's closing hours ({avail_setting.working_hours_end.strftime('%H:%M')})."
                    )

        # 4. Overlapping Confirmed Bookings & Remaining Guest Capacity Check
        # Query confirmed/approved bookings on the same date
        existing_bookings_query = Booking.objects.filter(
            event_date=event_date,
            status__in=['APPROVED', 'COMPLETED']
        )

        if exclude_booking_id:
            existing_bookings_query = existing_bookings_query.exclude(id=exclude_booking_id)

        if venue:
            existing_bookings_query = existing_bookings_query.filter(venue=venue)
            max_limit = venue.capacity
        else:
            existing_bookings_query = existing_bookings_query.filter(vendor=vendor)
            max_limit = avail_setting.max_guests if avail_setting else 100

        # When locking is active, lock confirmed bookings
        if lock_provider:
            existing_bookings = list(existing_bookings_query.select_for_update())
        else:
            existing_bookings = list(existing_bookings_query)

        booked_guests = sum(b.guest_count for b in existing_bookings)
        remaining_capacity = max_limit - booked_guests

        if (booked_guests + guest_count) > max_limit:
            target_name = venue.title if venue else vendor.business_name
            if remaining_capacity <= 0:
                raise ValidationError(
                    f"'{target_name}' is already fully booked on {date_str}. "
                    f"Capacity limit of {max_limit} guests has been reached."
                )
            else:
                raise ValidationError(
                    f"'{target_name}' cannot accommodate {guest_count} guests on {date_str}. "
                    f"Only {remaining_capacity} capacity remains out of {max_limit} total."
                )

        return True
