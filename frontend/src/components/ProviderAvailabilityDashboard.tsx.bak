import React, { useState } from 'react';
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

interface ProviderAvailabilityDashboardProps {
  bookings: Booking[];
  venues: Venue[];
}

export const ProviderAvailabilityDashboard: React.FC<ProviderAvailabilityDashboardProps> = ({
  bookings
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Load saved provider capacity configuration
  const savedCapacity = (() => {
    try {
      const saved = localStorage.getItem('locyfy_provider_capacity');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })();

  // Unified Capacity & Schedule configuration state (Vendor customizable)
  const [maxGuests, setMaxGuests] = useState<number>(savedCapacity?.maxGuests ?? 100);
  const [staffOnDuty, setStaffOnDuty] = useState<number>(savedCapacity?.staffOnDuty ?? 2);
  const [bufferTime, setBufferTime] = useState<number>(savedCapacity?.bufferTime ?? 30); // minutes

  // Working hours configurable by vendor
  const [workingHoursStart, setWorkingHoursStart] = useState<string>(savedCapacity?.workingHoursStart ?? '08:00');
  const [workingHoursEnd, setWorkingHoursEnd] = useState<string>(savedCapacity?.workingHoursEnd ?? '18:00');

  // Vendor's manually controlled calendar statuses per date key "YYYY-MM-DD"
  // Status: 'AVAILABLE' | 'UNAVAILABLE' | 'BOOKED' | 'PENDING'
  const [vendorDayStatuses, setVendorDayStatuses] = useState<Record<string, 'AVAILABLE' | 'UNAVAILABLE' | 'BOOKED' | 'PENDING'>>(() => {
    try {
      const saved = localStorage.getItem('locyfy_vendor_day_statuses');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Selected day for status popover/dialog
  const [selectedDayForEdit, setSelectedDayForEdit] = useState<number | null>(null);

  // Calendar calculations (Monday = 0 ... Sunday = 6)
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rawFirstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
  const firstDayIndex = rawFirstDay === 0 ? 6 : rawFirstDay - 1; // 0 is Monday

  // Month navigation
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Helper to format date key YYYY-MM-DD
  const getDateKey = (day: number) => {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    return `${year}-${mStr}-${dStr}`;
  };

  // Get status for a day (vendor has 100% control)
  const getDayStatus = (day: number): 'AVAILABLE' | 'UNAVAILABLE' | 'BOOKED' | 'PENDING' => {
    const key = getDateKey(day);
    if (vendorDayStatuses[key]) {
      return vendorDayStatuses[key];
    }
    // Check if there is an actual live booking for this day
    const matchingBooking = bookings.find(b => {
      const d = new Date(b.event_date);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
    if (matchingBooking) {
      if (matchingBooking.status === 'APPROVED' || matchingBooking.status === 'COMPLETED') return 'BOOKED';
      if (matchingBooking.status === 'PENDING') return 'PENDING';
    }
    // Default is completely free / available
    return 'AVAILABLE';
  };

  // Set day status
  const setDayStatus = (day: number, status: 'AVAILABLE' | 'UNAVAILABLE' | 'BOOKED' | 'PENDING') => {
    const key = getDateKey(day);
    setVendorDayStatuses(prev => {
      const updated = { ...prev, [key]: status };
      try {
        localStorage.setItem('locyfy_vendor_day_statuses', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
    setSelectedDayForEdit(null);
    toast.success(`Day ${day} set to ${status.toLowerCase()}`);
  };

  const handleSaveChanges = () => {
    try {
      localStorage.setItem('locyfy_vendor_day_statuses', JSON.stringify(vendorDayStatuses));
      localStorage.setItem('locyfy_provider_capacity', JSON.stringify({
        maxGuests,
        staffOnDuty,
        bufferTime,
        workingHoursStart,
        workingHoursEnd
      }));
    } catch (err) {
      console.error(err);
    }
    toast.success('Your schedule and capacity preferences have been saved!');
  };

  // Calculate live counts based on actual calendar days in this month
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

  // Calculate capacity percentage based on booked days
  const capacityUsagePercent = Math.round((bookedDaysCount / daysInMonth) * 100);

  return (
    <div className="provider-availability-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Page Title & Subtitle */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
          Capacity & Availability
        </h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.92rem' }}>
          Manage when you work and how much you can accommodate.
        </p>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="inspo-stat-grid" style={{ marginBottom: '8px' }}>
        
        {/* Card 1: Available Days */}
        <div className="inspo-stat-card">
          <div className="inspo-stat-icon-wrap mint">
            <CalendarDays size={24} />
          </div>
          <div className="inspo-stat-info">
            <span className="inspo-stat-label">Available Days</span>
            <span className="inspo-stat-value">{availableDaysCount}</span>
            <div className="inspo-stat-delta">
              <span className="delta-up">Open for bookings</span>
            </div>
          </div>
        </div>

        {/* Card 2: Working Hours */}
        <div className="inspo-stat-card">
          <div className="inspo-stat-icon-wrap amber">
            <Clock size={24} />
          </div>
          <div className="inspo-stat-info">
            <span className="inspo-stat-label">Working Hours</span>
            <span className="inspo-stat-value" style={{ fontSize: '1.25rem' }}>{workingHoursStart} – {workingHoursEnd}</span>
            <div className="inspo-stat-delta">
              <span className="delta-label">Daily service window</span>
            </div>
          </div>
        </div>

        {/* Card 3: Capacity Usage */}
        <div className="inspo-stat-card">
          <div className="inspo-stat-icon-wrap blue">
            <Layers size={24} />
          </div>
          <div className="inspo-stat-info">
            <span className="inspo-stat-label">Booked Rate</span>
            <span className="inspo-stat-value">{capacityUsagePercent}%</span>
            <div className="inspo-stat-delta">
              <span className="delta-up">{bookedDaysCount} of {daysInMonth} days booked</span>
            </div>
          </div>
        </div>

        {/* Card 4: Confirmed Bookings */}
        <div className="inspo-stat-card">
          <div className="inspo-stat-icon-wrap purple">
            <CalendarCheck size={24} />
          </div>
          <div className="inspo-stat-info">
            <span className="inspo-stat-label">Booked Days</span>
            <span className="inspo-stat-value">{bookedDaysCount}</span>
            <div className="inspo-stat-delta">
              <span className="delta-label">{pendingDaysCount} pending approval</span>
            </div>
          </div>
        </div>

      </div>

      {/* Main Grid: Calendar on Left, Unified Capacity on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Calendar Card */}
        <div className="dashboard-card" style={{ padding: '28px', position: 'relative' }}>
          
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                Availability Calendar
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                You have full control. Click any day to set whether you are Available, Booked, or Unavailable.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={prevMonth}
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <ChevronLeft size={16} color="#475569" />
              </button>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', minWidth: '130px', textAlign: 'center' }}>
                {monthNames[month]} {year}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <ChevronRight size={16} color="#475569" />
              </button>
            </div>
          </div>

          {/* Calendar Day Header matching M T W T F S S */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', marginBottom: '10px' }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, idx) => (
              <div key={idx} style={{ fontSize: '0.85rem', fontWeight: 800, color: '#475569', padding: '6px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
            {/* Empty offset days */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} style={{ height: '70px', background: '#fafafa', borderRadius: '10px', opacity: 0.3 }} />
            ))}

            {/* Month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const status = getDayStatus(day);

              let badgeText = 'Available';
              let badgeBg = '#dcfce7';
              let badgeColor = '#15803d';
              let cellBg = '#ffffff';
              let cellBorder = '#e2e8f0';

              if (status === 'UNAVAILABLE') {
                badgeText = 'Unavailable';
                badgeBg = '#fee2e2';
                badgeColor = '#b91c1c';
                cellBg = '#fef2f2';
                cellBorder = '#fecaca';
              } else if (status === 'BOOKED') {
                badgeText = 'Booked';
                badgeBg = '#e0f2fe';
                badgeColor = '#0369a1';
                cellBg = '#f0f9ff';
                cellBorder = '#bae6fd';
              } else if (status === 'PENDING') {
                badgeText = 'Pending';
                badgeBg = '#fef3c7';
                badgeColor = '#b45309';
                cellBg = '#fffbeb';
                cellBorder = '#fde68a';
              }

              return (
                <div
                  key={`day-${day}`}
                  onClick={() => setSelectedDayForEdit(day)}
                  style={{
                    height: '70px',
                    borderRadius: '10px',
                    border: `1px solid ${cellBorder}`,
                    background: cellBg,
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: selectedDayForEdit === day ? '0 0 0 2px #0d8a73' : 'none'
                  }}
                  title={`Click to set status for Day ${day}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: status === 'UNAVAILABLE' ? '#991b1b' : '#0f172a' }}>
                      {day}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      background: badgeBg,
                      color: badgeColor,
                      padding: '2px 6px',
                      borderRadius: '6px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {badgeText}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Quick Date Status Picker Popover when clicking any day */}
          {selectedDayForEdit !== null && (
            <div
              style={{
                marginTop: '16px',
                padding: '16px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                  Set status for {monthNames[month]} {selectedDayForEdit}, {year}:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedDayForEdit(null)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setDayStatus(selectedDayForEdit, 'AVAILABLE')}
                  style={{
                    flex: '1',
                    minWidth: '110px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #22c55e',
                    background: getDayStatus(selectedDayForEdit) === 'AVAILABLE' ? '#22c55e' : '#f0fdf4',
                    color: getDayStatus(selectedDayForEdit) === 'AVAILABLE' ? '#fff' : '#15803d',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <CheckCircle2 size={15} /> Free / Available
                </button>

                <button
                  type="button"
                  onClick={() => setDayStatus(selectedDayForEdit, 'BOOKED')}
                  style={{
                    flex: '1',
                    minWidth: '110px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #0284c7',
                    background: getDayStatus(selectedDayForEdit) === 'BOOKED' ? '#0284c7' : '#f0f9ff',
                    color: getDayStatus(selectedDayForEdit) === 'BOOKED' ? '#fff' : '#0369a1',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  Mark as Booked
                </button>

                <button
                  type="button"
                  onClick={() => setDayStatus(selectedDayForEdit, 'UNAVAILABLE')}
                  style={{
                    flex: '1',
                    minWidth: '110px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #ef4444',
                    background: getDayStatus(selectedDayForEdit) === 'UNAVAILABLE' ? '#ef4444' : '#fef2f2',
                    color: getDayStatus(selectedDayForEdit) === 'UNAVAILABLE' ? '#fff' : '#b91c1c',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  Mark Unavailable (Off)
                </button>
              </div>
            </div>
          )}

          {/* Calendar Status Legend */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#475569' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#22c55e' }} />
                Available
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#475569' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ef4444' }} />
                Unavailable
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#475569' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#f59e0b' }} />
                Pending request
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (selectedDayForEdit === null) {
                  setSelectedDayForEdit(1);
                  toast('Select any date on the calendar above to change its status.');
                }
              }}
              className="btn-primary-light"
              style={{
                background: '#0d8a73',
                color: '#ffffff',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(13, 138, 115, 0.2)'
              }}
            >
              <CalendarDays size={16} /> Manage Availability
            </button>
          </div>

        </div>

        {/* Capacity & Resources Card */}
        <div className="dashboard-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
              Capacity & Resources
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Configure your universal limits and buffers.
            </p>
          </div>

          {/* Stepper: Total Guest Capacity Limit */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>Total Guest Capacity Limit</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Max total guests/attendees you can accommodate in a single day
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setMaxGuests(prev => Math.max(10, prev - 25))}
                style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Decrease guest capacity limit"
              >
                <Minus size={14} />
              </button>
              <span style={{ fontWeight: 800, fontSize: '1rem', minWidth: '60px', textAlign: 'center', color: '#0d8a73' }}>
                {maxGuests} Guests
              </span>
              <button
                type="button"
                onClick={() => setMaxGuests(prev => prev + 25)}
                style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Increase guest capacity limit"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Staff & Travel Buffer Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>Staff On Duty</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={() => setStaffOnDuty(prev => Math.max(1, prev - 1))}
                  style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Minus size={12} />
                </button>
                <span style={{ fontWeight: 800 }}>{staffOnDuty}</span>
                <button
                  type="button"
                  onClick={() => setStaffOnDuty(prev => prev + 1)}
                  style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>

            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>Setup / Travel Buffer</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={() => setBufferTime(prev => Math.max(0, prev - 15))}
                  style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Minus size={12} />
                </button>
                <span style={{ fontWeight: 800 }}>{bufferTime}m</span>
                <button
                  type="button"
                  onClick={() => setBufferTime(prev => prev + 15)}
                  style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Working Hours Input Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>Opening Time</span>
              <input
                type="time"
                value={workingHoursStart}
                onChange={e => setWorkingHoursStart(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>Closing Time</span>
              <input
                type="time"
                value={workingHoursEnd}
                onChange={e => setWorkingHoursEnd(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Daily Event Capacity Summary */}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
              Daily Guest Capacity Allocation
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span>Daily Guest Capacity:</span>
                <strong style={{ color: '#0d8a73', fontSize: '0.95rem' }}>{maxGuests} Attendees</strong>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4, background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                💡 <strong>How this works:</strong> If you can serve <strong>{maxGuests} guests</strong> in total, and one customer books an event for <strong>70 guests</strong>, the platform automatically knows you still have capacity for <strong>{Math.max(0, maxGuests - 70)} more guests</strong> on that same day.
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSaveChanges}
            className="btn-primary-light"
            style={{
              background: '#0d8a73',
              color: '#ffffff',
              padding: '12px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              marginTop: 'auto',
            }}
          >
            <Save size={18} /> Save Changes
          </button>

        </div>

      </div>

    </div>
  );
};
