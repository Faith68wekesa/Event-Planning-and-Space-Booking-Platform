
from pathlib import Path

component = Path("frontend/src/components/ProviderAvailabilityDashboard.tsx")
backup = component.with_suffix(component.suffix + ".bak")

if not component.exists():
    raise SystemExit("ERROR: Component file was not found.")

if not backup.exists():
    raise SystemExit("ERROR: Original backup was not found.")

source = component.read_text(encoding="utf-8")
marker = "  return ("

if marker not in source:
    raise SystemExit("ERROR: Could not find the component return statement.")

if "ApiService.getProviderAvailability()" in source:
    raise SystemExit("API loading is already present. No changes made.")

new_logic = """import React, { useEffect, useState } from 'react';
import type { Booking, Venue } from '../types';
import {
  CalendarDays,
  Clock,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Layers,
  Save,
  CheckCircle2,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ApiService } from '../services/api';

interface ProviderAvailabilityDashboardProps {
  bookings: Booking[];
  venues: Venue[];
}

export const ProviderAvailabilityDashboard: React.FC<ProviderAvailabilityDashboardProps> = ({
  bookings
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [maxGuests, setMaxGuests] = useState<number>(100);
  const [bufferTime, setBufferTime] = useState<number>(30);
  const [workingHoursStart, setWorkingHoursStart] = useState<string>('08:00');
  const [workingHoursEnd, setWorkingHoursEnd] = useState<string>('18:00');
  const [vendorDayStatuses, setVendorDayStatuses] = useState<Record<string, 'UNAVAILABLE'>>({});
  const [selectedDayForEdit, setSelectedDayForEdit] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadAvailability = async () => {
      try {
        const saved = await ApiService.getProviderAvailability();

        if (cancelled) return;

        setMaxGuests(saved.max_guests ?? 100);
        setBufferTime(saved.buffer_time_minutes ?? 30);
        setWorkingHoursStart(saved.working_hours_start ?? '08:00');
        setWorkingHoursEnd(saved.working_hours_end ?? '18:00');

        const unavailable: Record<string, 'UNAVAILABLE'> = {};

        (saved.unavailable_dates ?? []).forEach(date => {
          unavailable[date] = 'UNAVAILABLE';
        });

        Object.entries(saved.day_statuses ?? {}).forEach(([date, status]) => {
          if (status === 'UNAVAILABLE') {
            unavailable[date] = 'UNAVAILABLE';
          }
        });

        setVendorDayStatuses(unavailable);
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load availability settings.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadAvailability();

    return () => {
      cancelled = true;
    };
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rawFirstDay = new Date(year, month, 1).getDay();
  const firstDayIndex = rawFirstDay === 0 ? 6 : rawFirstDay - 1;

  const prevMonth = () => {
    setSelectedDayForEdit(null);
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setSelectedDayForEdit(null);
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDateKey = (day: number) => {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    return `${year}-${mStr}-${dStr}`;
  };

  const getDayStatus = (day: number): 'AVAILABLE' | 'UNAVAILABLE' | 'BOOKED' | 'PENDING' => {
    const key = getDateKey(day);

    const matchingBookings = bookings.filter(
      booking => String(booking.event_date).slice(0, 10) === key
    );

    if (matchingBookings.some(booking =>
      booking.status === 'APPROVED' || booking.status === 'COMPLETED'
    )) {
      return 'BOOKED';
    }

    if (matchingBookings.some(booking => booking.status === 'PENDING')) {
      return 'PENDING';
    }

    return vendorDayStatuses[key] ? 'UNAVAILABLE' : 'AVAILABLE';
  };

  const setDayStatus = (day: number, status: 'AVAILABLE' | 'UNAVAILABLE') => {
    const currentStatus = getDayStatus(day);

    if (currentStatus === 'BOOKED' || currentStatus === 'PENDING') {
      toast.error('This date has a booking and its status cannot be changed here.');
      setSelectedDayForEdit(null);
      return;
    }

    const key = getDateKey(day);

    setVendorDayStatuses(prev => {
      const updated = { ...prev };

      if (status === 'UNAVAILABLE') {
        updated[key] = 'UNAVAILABLE';
      } else {
        delete updated[key];
      }

      return updated;
    });

    setSelectedDayForEdit(null);
    toast.success(`Date ${day} updated. Select Save Changes to apply it.`);
  };

  const handleSaveChanges = async () => {
    if (maxGuests < 1) {
      toast.error('Guest capacity must be at least 1.');
      return;
    }

    if (bufferTime < 0) {
      toast.error('Buffer time cannot be negative.');
      return;
    }

    if (!workingHoursStart || !workingHoursEnd || workingHoursStart >= workingHoursEnd) {
      toast.error('Closing time must be later than opening time.');
      return;
    }

    setIsSaving(true);

    try {
      await ApiService.updateProviderAvailability({
        max_guests: maxGuests,
        buffer_time_minutes: bufferTime,
        working_hours_start: workingHoursStart,
        working_hours_end: workingHoursEnd,
        unavailable_dates: Object.keys(vendorDayStatuses),
        day_statuses: vendorDayStatuses
      });

      toast.success('Availability settings saved successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save availability settings.');
    } finally {
      setIsSaving(false);
    }
  };

  let availableDaysCount = 0;
  let bookedDaysCount = 0;
  let unavailableDaysCount = 0;
  let pendingDaysCount = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const st = getDayStatus(d);
    if (st === 'AVAILABLE') availableDaysCount++;
    else if (st === 'BOOKED') bookedDaysCount++;
    else if (st === 'UNAVAILABLE') unavailableDaysCount++;
    else if (st === 'PENDING') pendingDaysCount++;
  }

  const capacityUsagePercent = Math.round((bookedDaysCount / daysInMonth) * 100);

"""

component.write_text(new_logic + source[source.index(marker):], encoding="utf-8")

print("Availability component logic updated successfully.")
