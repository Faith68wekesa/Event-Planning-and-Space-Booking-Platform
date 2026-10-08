import React, { useState } from 'react';
import type { Booking, BookingStatus } from '../types';
import { Search, MessageSquare, Check, X } from 'lucide-react';

interface BookingsProps {
  bookings: Booking[];
  onUpdateStatus: (id: number, status: BookingStatus) => void;
}

export const VendorDashboardBookings: React.FC<BookingsProps> = ({ bookings, onUpdateStatus }) => {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED'>('ALL');

  const filteredBookings = bookings.filter(b => {
    if (filter === 'ALL') return true;
    return b.status === filter;
  });

  const counts = {
    ALL: bookings.length,
    PENDING: bookings.filter(b => b.status === 'PENDING').length,
    APPROVED: bookings.filter(b => b.status === 'APPROVED').length,
    COMPLETED: bookings.filter(b => b.status === 'COMPLETED').length,
    REJECTED: bookings.filter(b => b.status === 'REJECTED').length,
  };

  const getStatusDisplay = (status: BookingStatus) => {
    switch (status) {
      case 'PENDING': return <span style={{ color: '#d97706', fontWeight: 600 }}>🟡 Pending</span>;
      case 'APPROVED': return <span style={{ color: '#16a34a', fontWeight: 600 }}>🟢 Confirmed</span>;
      case 'COMPLETED': return <span style={{ color: '#2563eb', fontWeight: 600 }}>🔵 Completed</span>;
      case 'REJECTED': return <span style={{ color: '#dc2626', fontWeight: 600 }}>🔴 Declined</span>;
      default: return <span style={{ color: '#64748b', fontWeight: 600 }}>⚪ {status}</span>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid #e2e8f0', marginBottom: '24px', overflowX: 'auto' }}>
        {[
          { id: 'ALL', label: 'All' },
          { id: 'PENDING', label: 'Pending' },
          { id: 'APPROVED', label: 'Confirmed' },
          { id: 'COMPLETED', label: 'Completed' },
          { id: 'REJECTED', label: 'Declined' },
        ].map(f => (
          <button 
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            style={{ 
              padding: '12px 0', 
              border: 'none', 
              background: 'none', 
              color: filter === f.id ? '#0d8a73' : '#64748b', 
              fontWeight: filter === f.id ? 700 : 600, 
              borderBottom: filter === f.id ? '2px solid #0d8a73' : '2px solid transparent', 
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {f.label} ({counts[f.id as keyof typeof counts]})
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '32px' }}>
        
        {/* Main Bookings Area */}
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Booking Requests</h3>
          <div className="dashboard-card" style={{ padding: '0', overflow: 'hidden' }}>
            
            <table className="vendor-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '16px', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: '0.85rem', borderBottom: '1px solid #e2e8f0' }}>Customer</th>
                  <th style={{ textAlign: 'left', padding: '16px', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: '0.85rem', borderBottom: '1px solid #e2e8f0' }}>Service / Event</th>
                  <th style={{ textAlign: 'left', padding: '16px', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: '0.85rem', borderBottom: '1px solid #e2e8f0' }}>Date & Time</th>
                  <th style={{ textAlign: 'left', padding: '16px', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: '0.85rem', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '16px', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: '0.85rem', borderBottom: '1px solid #e2e8f0' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '60px 20px' }}>
                      <div style={{ color: '#0f172a', fontWeight: 700, fontSize: '1.1rem', marginBottom: '8px' }}>
                        No booking requests yet
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '24px' }}>
                        When customers request your services, their requests will appear here.
                      </div>
                      <button style={{ background: '#0d8a73', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, display: 'inline-flex', cursor: 'pointer' }}>
                        Manage My Services
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.customer_name || 'Guest User'}</div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: 500, color: '#334155' }}>{b.event_title}</div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: 500, color: '#334155' }}>{b.event_date}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>10:00 AM · Nairobi</div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        {getStatusDisplay(b.status)}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <button style={{ background: '#f1f5f9', color: '#334155', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Sidebar Widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upcoming Bookings</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 16px 0' }}>Your confirmed bookings and scheduled services.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {bookings.filter(b => b.status === 'APPROVED').length > 0 ? (
                bookings.filter(b => b.status === 'APPROVED').slice(0, 3).map((b, idx) => (
                  <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ textAlign: 'center', minWidth: '40px' }}>
                        <div style={{ color: '#0d8a73', fontWeight: 800, fontSize: '1.2rem', lineHeight: 1, marginBottom: '2px' }}>
                          {b.event_date ? b.event_date.split(' ')[0] : '18'}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                          {b.event_date && b.event_date.split(' ').length > 1 ? b.event_date.split(' ')[1] : 'OCT'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>{b.event_title}</div>
                        <div style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '8px' }}>{b.customer_name || 'Guest User'}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>10:00 AM · Nairobi</div>
                        <button style={{ background: '#f1f5f9', color: '#334155', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                          View Booking
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '24px 16px', textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                  <div style={{ color: '#0f172a', fontWeight: 600, marginBottom: '8px' }}>No upcoming bookings</div>
                  <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                    Confirmed bookings will appear here with their event date and time.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
