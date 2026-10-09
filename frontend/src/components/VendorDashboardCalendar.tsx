import React, { useState } from 'react';
import type { Booking } from '../types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, MapPin, Users, Clock, CalendarX, MessageSquare, ClipboardList, Info } from 'lucide-react';
import toast from 'react-hot-toast';

interface VendorDashboardCalendarProps {
  bookings: Booking[];
}

interface BlockedDate {
  date: string;
  reason: string;
}

export const VendorDashboardCalendar: React.FC<VendorDashboardCalendarProps> = ({ bookings }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  
  // Adjust so Monday is 0, Sunday is 6
  const startingDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const getBookingsForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return bookings.filter(b => b.status === 'APPROVED' && b.event_date.startsWith(dateStr));
  };

  const getBlockedForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return blockedDates.find(b => b.date === dateStr);
  };

  const handleUnblockDate = (date: string) => {
    setBlockedDates(prev => prev.filter(b => b.date !== date));
    toast.success('Date unblocked successfully');
  };

  const handleBlockDate = (date: string) => {
    const reason = window.prompt("Reason for blocking this date?", "Unavailable");
    if (reason !== null) {
      setBlockedDates(prev => [...prev, { date, reason: reason || 'Unavailable' }]);
      toast.success('Date blocked successfully');
    }
  };

  // Render the selected date details panel
  const renderSidePanel = () => {
    if (!selectedDate) {
      return (
        <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ background: '#e2e8f0', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <CalendarIcon size={24} color="#64748b" />
          </div>
          <h3 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>Select a Date</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Click on any date in the calendar to view its events or manage availability.</p>
        </div>
      );
    }

    const dayBookings = getBookingsForDate(selectedDate);
    const blocked = getBlockedForDate(selectedDate);
    const dateFormatted = `${selectedDate} ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

    return (
      <div style={{ padding: '24px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', height: '100%' }}>
        <h3 style={{ margin: '0 0 24px 0', fontSize: '1.2rem', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
          {dateFormatted}
        </h3>

        {blocked && (
          <div style={{ padding: '16px', background: '#fee2e2', borderRadius: '8px', marginBottom: '24px', border: '1px solid #fca5a5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontWeight: 600, marginBottom: '4px' }}>
              <CalendarX size={18} /> Unavailable
            </div>
            <div style={{ color: '#991b1b', fontSize: '0.9rem' }}>Reason: {blocked.reason}</div>
            <button 
              onClick={() => handleUnblockDate(blocked.date)}
              style={{ background: 'none', border: 'none', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 600, marginTop: '12px', cursor: 'pointer', padding: 0 }}
            >
              Unblock Date
            </button>
          </div>
        )}

        {!blocked && dayBookings.length === 0 && (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <div style={{ color: '#64748b', marginBottom: '16px' }}>No events scheduled for this date.</div>
            <button 
              onClick={() => {
                const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`;
                handleBlockDate(dateStr);
              }}
              style={{ background: '#f1f5f9', color: '#334155', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto' }}
            >
              <CalendarX size={16} /> Block Date
            </button>
          </div>
        )}

        {dayBookings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {dayBookings.map(b => (
              <div key={b.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>Confirmed Event</div>
                  <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: '0.75rem', fontWeight: 700, padding: '4px 8px', borderRadius: '999px' }}>Confirmed</span>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ClipboardList size={16} color="#64748b" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Service</div>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.event_title}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Info size={16} color="#64748b" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Customer</div>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.customer_name || 'Guest Customer'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '0.9rem' }}>
                      <Clock size={16} color="#0d8a73" /> {b.event_date.split('T')[1]?.substring(0, 5) || '14:00'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '0.9rem' }}>
                      <Users size={16} color="#0d8a73" /> {b.guest_count} guests
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '0.9rem', gridColumn: 'span 2' }}>
                      <MapPin size={16} color="#0d8a73" /> {b.venue_details?.location || 'Client Location'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #e2e8f0' }}>
                    <button style={{ flex: 1, background: '#0d8a73', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                      View Booking
                    </button>
                    <button style={{ flex: 1, background: '#f1f5f9', color: '#334155', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <MessageSquare size={16} /> Message
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>Vendor Calendar</h2>
          <p style={{ color: '#64748b', margin: 0 }}>Manage your availability and view upcoming confirmed events.</p>
        </div>
        <button style={{ background: '#f1f5f9', color: '#334155', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CalendarX size={18} /> Block Date
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Main Calendar View */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={prevMonth} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft size={20} color="#475569" />
              </button>
              <button onClick={nextMonth} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronRight size={20} color="#475569" />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
            {/* Days of week header */}
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.8rem', color: '#64748b', paddingBottom: '12px' }}>
                {day}
              </div>
            ))}

            {/* Empty slots for start of month */}
            {Array.from({ length: startingDay }).map((_, i) => (
              <div key={`empty-${i}`} style={{ minHeight: '100px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0' }} />
            ))}

            {/* Calendar Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayBookings = getBookingsForDate(day);
              const blocked = getBlockedForDate(day);
              const isSelected = selectedDate === day;

              return (
                <div 
                  key={day} 
                  onClick={() => setSelectedDate(day)}
                  style={{ 
                    minHeight: '100px', 
                    background: isSelected ? '#f0fdf4' : '#fff', 
                    borderRadius: '8px', 
                    border: isSelected ? '2px solid #22c55e' : '1px solid #e2e8f0',
                    padding: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div style={{ fontWeight: 600, color: isSelected ? '#16a34a' : '#334155', marginBottom: '8px' }}>
                    {day}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
                    {blocked && (
                      <div style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '0.7rem', padding: '4px 6px', borderRadius: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CalendarX size={12} /> Unavailable
                      </div>
                    )}

                    {dayBookings.map(b => (
                      <div key={b.id} style={{ background: '#dcfce7', color: '#16a34a', fontSize: '0.7rem', padding: '4px 6px', borderRadius: '4px', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '2px solid #22c55e' }}>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.event_title}</span>
                        <span style={{ fontSize: '0.65rem', color: '#15803d' }}>{b.event_date.split('T')[1]?.substring(0, 5) || '14:00'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Side Panel Details */}
        <div>
          {renderSidePanel()}
        </div>

      </div>
    </div>
  );
};
