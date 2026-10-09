import React, { useState } from 'react';
import type { Booking, BookingStatus } from '../types';
import { Calendar, Clock, CheckCircle2, XCircle, User as UserIcon } from 'lucide-react';
import { ApiService } from '../services/api';
import toast from 'react-hot-toast';

interface CustomerDashboardProps {
  bookings: Booking[];
  currentCustomer: any;
  onCancelBooking: (id: number) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  bookings,
  currentCustomer,
  onCancelBooking,
}) => {
  const [activeTab, setActiveTab] = useState<'bookings' | 'profile'>('bookings');
  const [isUploading, setIsUploading] = useState(false);

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && currentCustomer) {
      const file = e.target.files[0];
      setIsUploading(true);
      const newUrl = await ApiService.uploadProfilePicture(currentCustomer.id, file);
      if (newUrl) {
        currentCustomer.profile_picture = newUrl;
        toast.success('Profile picture updated successfully!');
      } else {
        toast.error('Failed to upload profile picture.');
      }
      setIsUploading(false);
    }
  };

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
        <h1 style={{ fontSize: '1.2rem', color: '#0F8F7A', fontWeight: 800, marginBottom: '8px' }}>Event Planning and SpaceBooking</h1>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 8px 0' }}>Customer Dashboard</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Manage your bookings and view your profile details.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px', borderBottom: '2px solid rgba(0,0,0,0.1)', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('bookings')}
          style={{
            padding: '12px 24px', fontWeight: 700, fontSize: '1rem',
            color: activeTab === 'bookings' ? '#0d8a73' : 'var(--text-muted)',
            borderBottom: activeTab === 'bookings' ? '3px solid #0d8a73' : '3px solid transparent',
            background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <Calendar size={18} /> My Bookings
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '12px 24px', fontWeight: 700, fontSize: '1rem',
            color: activeTab === 'profile' ? '#0d8a73' : 'var(--text-muted)',
            borderBottom: activeTab === 'profile' ? '3px solid #0d8a73' : '3px solid transparent',
            background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <UserIcon size={18} /> My Profile
        </button>
      </div>

      {activeTab === 'profile' && currentCustomer && (
        <div className="card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {currentCustomer.profile_picture ? (
                <img src={currentCustomer.profile_picture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <UserIcon size={40} color="#94a3b8" />
              )}
            </div>
            <div>
              <label 
                style={{ padding: '8px 16px', background: '#0F8F7A', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: isUploading ? 'not-allowed' : 'pointer', display: 'inline-block', opacity: isUploading ? 0.7 : 1 }} 
              >
                {isUploading ? 'Uploading...' : 'Upload Profile Picture'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePictureUpload} disabled={isUploading} />
              </label>
            </div>
          </div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '24px' }}>Personal Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div><span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.85rem' }}>Username</span><strong>{currentCustomer.username}</strong></div>
            <div><span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.85rem' }}>Email Address</span><strong>{currentCustomer.email}</strong></div>
            <div><span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.85rem' }}>Phone Number</span><strong>{currentCustomer.phone_number || 'Not provided'}</strong></div>
            <div><span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.85rem' }}>Account Role</span><strong>{currentCustomer.role}</strong></div>
          </div>
        </div>
      )}

      {activeTab === 'bookings' && (
        <>
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
                const targetLoc = b.venue_details?.location || b.vendor_details?.location || '';

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
        </>
      )}
    </div>
  );
};
