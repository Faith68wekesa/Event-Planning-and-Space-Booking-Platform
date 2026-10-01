import React from 'react';
import type { Booking, PlatformStats, Venue } from '../types';
import { Star, MoreHorizontal, Plus, ClipboardList, MessageSquare, Calendar, Building2, CalendarDays, ArrowRight } from 'lucide-react';

interface OverviewProps {
  bookings: Booking[];
  stats: PlatformStats;
  venues: Venue[];
  onNavigate?: (tab: string) => void;
}

export const VendorDashboardOverview: React.FC<OverviewProps> = ({ bookings, venues, onNavigate }) => {
  // Take top 4 recent bookings
  const recentBookings = bookings.slice(0, 4);
  
  // Take top 2 venues for listings
  const topVenues = venues.slice(0, 2);
  
  // Calculate revenue from approved bookings
  bookings
    .filter(b => b.status === 'APPROVED')
    .reduce((sum, b) => sum + b.total_price, 0);

  const publishedVenues = venues.filter(v => v.verification_status === 'APPROVED');
  const pendingVenues = venues.filter(v => v.verification_status === 'PENDING');
  const draftVenues = venues.filter(v => !v.verification_status || v.verification_status === 'DRAFT');

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      
      {/* Top Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '20px' }}>
        
        {/* Card 1: Active Services */}
        <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column', padding: '24px' }}>
          <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '12px', borderRadius: '12px', width: 'fit-content', marginBottom: '16px' }}>
            <Building2 size={24} />
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '24px' }}>
            Active Services
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
            {publishedVenues.length}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px', flexGrow: 1 }}>
            {publishedVenues.length === 0 ? 'No services added yet' : 'Published services'}
            {pendingVenues.length > 0 && (
              <div style={{ color: '#d97706', marginTop: '4px', fontWeight: 600 }}>
                {pendingVenues.length} service{pendingVenues.length > 1 ? 's' : ''} awaiting review
              </div>
            )}
            {draftVenues.length > 0 && (
              <div style={{ color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
                {draftVenues.length} draft{draftVenues.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Booking Requests */}
        <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column', padding: '24px' }}>
          <div style={{ background: '#fef3c7', color: '#d97706', padding: '12px', borderRadius: '12px', width: 'fit-content', marginBottom: '16px' }}>
            <ClipboardList size={24} />
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '24px' }}>
            Booking Requests
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
            {bookings.filter(b => b.status === 'PENDING').length}
          </div>
          <div style={{ fontSize: '0.85rem', color: bookings.filter(b => b.status === 'PENDING').length > 0 ? '#d97706' : '#64748b', marginTop: '8px', fontWeight: bookings.filter(b => b.status === 'PENDING').length > 0 ? 600 : 400 }}>
            {bookings.filter(b => b.status === 'PENDING').length === 0 ? 'No requests yet' : `${bookings.filter(b => b.status === 'PENDING').length} need your response`}
          </div>
        </div>

        {/* Card 3: Upcoming Events */}
        <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column', padding: '24px' }}>
          <div style={{ background: '#dcfce7', color: '#16a34a', padding: '12px', borderRadius: '12px', width: 'fit-content', marginBottom: '16px' }}>
            <CalendarDays size={24} />
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '24px' }}>
            Upcoming Events
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
            {bookings.filter(b => b.status === 'APPROVED').length}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px' }}>
            {bookings.filter(b => b.status === 'APPROVED').length === 0 
              ? 'No events scheduled' 
              : `Next: ${bookings.filter(b => b.status === 'APPROVED').sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())[0]?.event_date || 'N/A'}`
            }
          </div>
        </div>

        {/* Card 4: Messages */}
        <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column', padding: '24px' }}>
          <div style={{ background: '#f3e8ff', color: '#9333ea', padding: '12px', borderRadius: '12px', width: 'fit-content', marginBottom: '16px' }}>
            <MessageSquare size={24} />
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '24px' }}>
            Messages
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
            0
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px' }}>
            No new messages
          </div>
        </div>

      </div>

      {/* Main Content Layout: Stacked Vertically */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Recent Bookings */}
        <div className="dashboard-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Recent Booking Requests</h3>
            <button 
              onClick={() => onNavigate && onNavigate('bookings')}
              style={{ background: 'none', border: 'none', color: '#0d8a73', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              View all <ArrowRight size={14} />
            </button>
          </div>
          
          {recentBookings.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <div style={{ width: '48px', height: '48px', background: '#e2e8f0', color: '#64748b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <ClipboardList size={24} />
              </div>
              <h4 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '1.05rem' }}>No booking requests yet.</h4>
              <p style={{ margin: '0 0 0 0', color: '#64748b', fontSize: '0.9rem', maxWidth: '280px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
                When customers request your services, their requests will appear here.
              </p>
            </div>
          ) : (
            <table className="vendor-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Event Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.customer_name || 'Guest'}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{b.event_title}</div>
                    </td>
                    <td>{b.event_date}</td>
                    <td>
                      <span className={`status-badge ${b.status.toLowerCase()}`}>
                        {b.status === 'PENDING' ? 'Pending' : b.status === 'APPROVED' ? 'Accepted' : b.status === 'REJECTED' ? 'Declined' : b.status}
                      </span>
                    </td>
                    <td>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick Actions */}
        <div className="dashboard-card" style={{ background: 'linear-gradient(135deg, #0d8a73, #065f54)', color: '#fff', border: 'none' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', color: '#fff' }}>Quick Actions</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button 
                onClick={() => onNavigate && onNavigate('portfolio')}
                style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: 'none', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.2s' }}
              >
                <span style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '8px', borderRadius: '6px', display: 'flex' }}>
                  <Plus size={18} />
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Add New Service</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.8)', marginTop: '2px' }}>Create and publish a service you offer</div>
                </div>
              </button>

              <button 
                onClick={() => onNavigate && onNavigate('bookings')}
                style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: 'none', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.2s' }}
              >
                <span style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '8px', borderRadius: '6px', display: 'flex' }}>
                  <ClipboardList size={18} />
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Review Booking Requests</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.8)', marginTop: '2px' }}>View and respond to customer requests</div>
                </div>
              </button>

              <button style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: 'none', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.2s' }}>
                <span style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '8px', borderRadius: '6px', display: 'flex' }}>
                  <MessageSquare size={18} />
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>View Messages</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.8)', marginTop: '2px' }}>Communicate with customers</div>
                </div>
              </button>

              <button 
                onClick={() => onNavigate && onNavigate('calendar')}
                style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: 'none', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.2s' }}
              >
                <span style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '8px', borderRadius: '6px', display: 'flex' }}>
                  <Calendar size={18} />
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Manage Calendar</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.8)', marginTop: '2px' }}>Update your availability</div>
                </div>
              </button>
            </div>
          </div>

          <div className="dashboard-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>My Services</h3>
              <button 
                onClick={() => onNavigate && onNavigate('portfolio')}
                style={{ background: 'none', border: 'none', color: '#0d8a73', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                View all <ArrowRight size={14} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {topVenues.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                  <div style={{ width: '48px', height: '48px', background: '#e2e8f0', color: '#64748b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <Building2 size={24} />
                  </div>
                  <h4 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '1.05rem' }}>No services added yet.</h4>
                  <p style={{ margin: '0', color: '#64748b', fontSize: '0.9rem', maxWidth: '280px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
                    Your published services will appear here.
                  </p>
                </div>
              ) : (
                topVenues.map(venue => (
                  <div key={venue.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🍽 {venue.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: venue.verification_status === 'APPROVED' ? '#16a34a' : '#64748b', display: 'flex', alignItems: 'center', gap: '4px', background: venue.verification_status === 'APPROVED' ? '#dcfce7' : '#f1f5f9', padding: '4px 8px', borderRadius: '4px' }}>
                        {venue.verification_status === 'APPROVED' ? '✓ Published' : venue.verification_status === 'PENDING' ? '🟡 Pending' : 'Draft'}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                      {venue.description.length > 60 ? venue.description.substring(0, 60) + '...' : venue.description}
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                      From KES {venue.price_per_day.toLocaleString()} / person
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Star size={14} fill={venue.rating > 0 ? "#fbbf24" : "#cbd5e1"} color={venue.rating > 0 ? "#fbbf24" : "#cbd5e1"} /> {venue.rating > 0 ? venue.rating.toFixed(1) : 'New'}
                        </span>
                        <span>
                          {bookings.filter(b => b.venue === venue.id && b.status === 'APPROVED').length} bookings
                        </span>
                      </div>
                      <button 
                        onClick={() => onNavigate && onNavigate('portfolio')}
                        style={{ background: 'none', border: 'none', color: '#0d8a73', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {venue.is_verified ? 'View →' : 'Continue →'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
      </div>
    </div>
  );
};
