import React from 'react';
import type { Booking, BookingStatus } from '../types';
import { Calendar, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface CustomerDashboardProps {
  bookings: Booking[];
  onCancelBooking: (id: number) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  bookings,
  onCancelBooking,
}) => {
  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'APPROVED':
        return <span className="status-pill status-approved"><CheckCircle2 size={12} /> Approved</span>;
      case 'PENDING':
        return <span className="status-pill status-pending"><Clock size={12} /> Pending Review</span>;
      case 'REJECTED':
        return <span className="status-pill status-rejected"><XCircle size={12} /> Rejected</span>;
      case 'CANCELLED':
        return <span className="status-pill status-rejected">Cancelled</span>;
      default:
        return <span className="status-pill status-pending">{status}</span>;
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '32px auto', padding: '0 20px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>My Booking Requests</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Track real-time approval status and details for your venue & vendor reservations.
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <Calendar size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>No Active Bookings</h3>
          <p style={{ color: 'var(--text-muted)' }}>Explore verified venues or planners to submit your first booking request.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {bookings.map((b) => {
            const targetName = b.venue_details?.title || b.vendor_details?.business_name || b.event_title;
            const targetLoc = b.venue_details?.location || b.vendor_details?.location || 'Kenya';

            return (
              <div key={b.id} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{b.event_title}</h3>
                      {getStatusBadge(b.status)}
                    </div>
                    <p style={{ fontSize: '0.9rem', color: '#0d8a73', fontWeight: 600 }}>
                      Reserved Target: {targetName} ({targetLoc})
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Cost</span>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#059669' }}>
                      KES {b.total_price.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  fontSize: '0.85rem'
                }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Event Date</span>
                    <strong>{b.event_date}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Event Category</span>
                    <strong>{b.event_type}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Guest Count</span>
                    <strong>{b.guest_count} Attendees</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Request Reference</span>
                    <strong>#EVT-{b.id}</strong>
                  </div>
                </div>

                {b.notes && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <strong>Special Notes:</strong> {b.notes}
                  </div>
                )}

                {b.status === 'PENDING' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <button
                      className="btn-secondary"
                      onClick={() => onCancelBooking(b.id)}
                      style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)', padding: '6px 14px', fontSize: '0.82rem' }}
                    >
                      Cancel Request
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
