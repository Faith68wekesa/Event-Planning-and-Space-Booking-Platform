import React, { useState, useEffect, useCallback } from 'react';
import type { Booking, Venue, BookingStatus, VenueOwner, VenueCategory } from '../types';
import { ApiService } from '../services/api';
import {
  Building2,
  CalendarDays,
  DollarSign,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Trash2,
  ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

interface VenueOwnerDashboardProps {
  currentOwner: VenueOwner;
  onLogout?: () => void;
}

export const VenueOwnerDashboard: React.FC<VenueOwnerDashboardProps> = ({
  currentOwner,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'venues' | 'bookings'>('venues');
  const [venues, setVenues] = useState<Venue[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_revenue: 0,
    pending_bookings: 0,
    upcoming_bookings: 0,
    total_venues: 0,
    verified_venues: 0,
  });

  // Modal State for adding a venue
  const [showAddModal, setShowAddModal] = useState(false);
  const [submittingVenue, setSubmittingVenue] = useState(false);
  const [newVenue, setNewVenue] = useState({
    title: '',
    category: 'WEDDING' as VenueCategory,
    location: currentOwner.location || 'Nairobi',
    address: '',
    capacity: 350,
    price_per_day: 80000,
    price_per_hour: 10000,
    description: '',
    amenities: 'Ample Parking, Generator Backup, Security, Restrooms',
    image_url: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80',
  });

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashData, bookingsData] = await Promise.all([
        ApiService.getVenueOwnerDashboard(currentOwner.id),
        ApiService.getVenueOwnerBookings(currentOwner.id),
      ]);
      setStats({
        total_revenue: dashData.total_revenue || 0,
        pending_bookings: dashData.pending_bookings || 0,
        upcoming_bookings: dashData.upcoming_bookings || 0,
        total_venues: dashData.total_venues || 0,
        verified_venues: dashData.verified_venues || 0,
      });
      setVenues(dashData.venues || []);
      setBookings(bookingsData || []);
    } catch (e) {
      console.error('Failed to load venue owner dashboard data:', e);
    } finally {
      setLoading(false);
    }
  }, [currentOwner.id]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleUpdateBookingStatus = async (id: number, status: BookingStatus) => {
    const success = await ApiService.updateBookingStatus(id, status);
    if (success) {
      fetchDashboardData();
    }
  };

  const handleDeleteVenue = async (venueId: number) => {
    if (window.confirm('Are you sure you want to remove this venue listing?')) {
      const ok = await ApiService.deleteVenue(venueId);
      if (ok) {
        fetchDashboardData();
      }
    }
  };

  const handleAddVenueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingVenue(true);
    try {
      const amenitiesList = newVenue.amenities
        .split(',')
        .map((a) => a.trim())
        .filter((a) => a.length > 0);

      await ApiService.addVenue({
        owner: currentOwner.id,
        title: newVenue.title,
        category: newVenue.category,
        location: newVenue.location,
        address: newVenue.address,
        capacity: Number(newVenue.capacity),
        price_per_day: Number(newVenue.price_per_day),
        price_per_hour: Number(newVenue.price_per_hour),
        description: newVenue.description,
        amenities: amenitiesList,
        image_url: newVenue.image_url,
      });

      setShowAddModal(false);
      setNewVenue({
        title: '',
        category: 'WEDDING',
        location: currentOwner.location || 'Nairobi',
        address: '',
        capacity: 350,
        price_per_day: 80000,
        price_per_hour: 10000,
        description: '',
        amenities: 'Ample Parking, Generator Backup, Security, Restrooms',
        image_url: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80',
      });
      fetchDashboardData();
      toast.success('Venue listed successfully! It has been submitted for platform verification.');
    } catch (err) {
      toast.error('Failed to add venue. Please try again.');
    } finally {
      setSubmittingVenue(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: '60px' }}>
      {/* Top Banner / Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #0d8a73 100%)',
          color: '#ffffff',
          padding: '36px 32px 48px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '20px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                <Building2 size={13} /> Venue Owner Portal
              </span>
              {currentOwner.is_verified && (
                <span
                  style={{
                    background: '#ffb800',
                    color: '#0f172a',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <ShieldCheck size={12} /> Verified Partner
                </span>
              )}
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
              {currentOwner.business_name}
            </h1>
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.95rem' }}>
              {currentOwner.location ? `📍 ${currentOwner.location}` : 'Event Space Management'} • Manage venues, approve bookings, and monitor space performance.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                background: '#ffb800',
                color: '#0f172a',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(255, 184, 0, 0.3)',
                transition: 'all 0.2s ease',
              }}
            >
              <Plus size={18} /> Add New Venue
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div style={{ maxWidth: '1280px', margin: '-24px auto 0', padding: '0 24px' }}>
        {/* KPI Stat Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
            marginBottom: '32px',
          }}
        >
          {/* Card 1 */}
          <div
            style={{
              background: '#fff',
              padding: '24px',
              borderRadius: '14px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                background: '#e0f2fe',
                color: '#0284c7',
                padding: '14px',
                borderRadius: '12px',
              }}
            >
              <Building2 size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Total Venues</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
                {stats.total_venues}{' '}
                <span style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 600 }}>
                  ({stats.verified_venues} verified)
                </span>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div
            style={{
              background: '#fff',
              padding: '24px',
              borderRadius: '14px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                background: '#fef3c7',
                color: '#d97706',
                padding: '14px',
                borderRadius: '12px',
              }}
            >
              <Clock size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Pending Inquiries</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#d97706' }}>
                {stats.pending_bookings}
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div
            style={{
              background: '#fff',
              padding: '24px',
              borderRadius: '14px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                background: '#dcfce7',
                color: '#16a34a',
                padding: '14px',
                borderRadius: '12px',
              }}
            >
              <CalendarDays size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Confirmed Bookings</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16a34a' }}>
                {stats.upcoming_bookings}
              </div>
            </div>
          </div>

          {/* Card 4 */}
          <div
            style={{
              background: '#fff',
              padding: '24px',
              borderRadius: '14px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                background: '#f3e8ff',
                color: '#9333ea',
                padding: '14px',
                borderRadius: '12px',
              }}
            >
              <DollarSign size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Revenue Earned</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
                KES {Number(stats.total_revenue).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            borderBottom: '2px solid #e2e8f0',
            marginBottom: '28px',
          }}
        >
          <button
            onClick={() => setActiveTab('venues')}
            style={{
              padding: '12px 24px',
              fontWeight: 700,
              fontSize: '1rem',
              color: activeTab === 'venues' ? '#0d8a73' : '#64748b',
              borderBottom: activeTab === 'venues' ? '3px solid #0d8a73' : '3px solid transparent',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '-2px',
            }}
          >
            <Building2 size={18} /> My Listed Spaces ({venues.length})
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            style={{
              padding: '12px 24px',
              fontWeight: 700,
              fontSize: '1rem',
              color: activeTab === 'bookings' ? '#0d8a73' : '#64748b',
              borderBottom: activeTab === 'bookings' ? '3px solid #0d8a73' : '3px solid transparent',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '-2px',
            }}
          >
            <CalendarDays size={18} /> Booking Requests ({bookings.length})
          </button>
        </div>

        {/* Tab 1: Listed Venues */}
        {activeTab === 'venues' && (
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                Loading your listed spaces...
              </div>
            ) : venues.length === 0 ? (
              <div
                style={{
                  background: '#fff',
                  borderRadius: '16px',
                  padding: '48px',
                  textAlign: 'center',
                  border: '1px dashed #cbd5e1',
                }}
              >
                <Building2 size={48} color="#94a3b8" style={{ marginBottom: '16px' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                  No event venues listed yet
                </h3>
                <p style={{ color: '#64748b', maxWidth: '480px', margin: '0 auto 24px' }}>
                  Add your first event venue to start receiving booking requests from clients across Kenya.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="btn-primary"
                  style={{ padding: '12px 24px', fontWeight: 700 }}
                >
                  <Plus size={18} /> Add Your First Venue
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                  gap: '24px',
                }}
              >
                {venues.map((venue) => (
                  <div
                    key={venue.id}
                    style={{
                      background: '#fff',
                      borderRadius: '14px',
                      overflow: 'hidden',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ height: '180px', position: 'relative', overflow: 'hidden' }}>
                      <img
                        src={venue.image_url || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80'}
                        alt={venue.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: '12px',
                          left: '12px',
                          background: 'rgba(15, 23, 42, 0.8)',
                          backdropFilter: 'blur(6px)',
                          color: '#fff',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {venue.category_display || venue.category}
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          background: venue.is_verified ? '#16a34a' : '#f59e0b',
                          color: '#fff',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {venue.is_verified ? (
                          <>
                            <CheckCircle2 size={12} /> Verified
                          </>
                        ) : (
                          <>
                            <Clock size={12} /> Pending Verification
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', margin: '0 0 6px 0' }}>
                        {venue.title}
                      </h3>
                      <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={14} color="#0d8a73" /> {venue.location}
                      </p>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 0',
                          borderTop: '1px solid #f1f5f9',
                          borderBottom: '1px solid #f1f5f9',
                          marginBottom: '16px',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Capacity</span>
                          <span style={{ fontWeight: 700, color: '#1e293b' }}>{venue.capacity} guests</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Daily Rate</span>
                          <span style={{ fontWeight: 800, color: '#0d8a73', fontSize: '1.05rem' }}>
                            KES {Number(venue.price_per_day).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: venue.is_available ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                          ● {venue.is_available ? 'Active & Available' : 'Temporarily Unavailable'}
                        </span>
                        <button
                          onClick={() => handleDeleteVenue(venue.id)}
                          style={{
                            background: '#fee2e2',
                            color: '#ef4444',
                            border: 'none',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                          }}
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Booking Requests */}
        {activeTab === 'bookings' && (
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                Loading booking inquiries...
              </div>
            ) : bookings.length === 0 ? (
              <div
                style={{
                  background: '#fff',
                  borderRadius: '16px',
                  padding: '48px',
                  textAlign: 'center',
                  border: '1px dashed #cbd5e1',
                }}
              >
                <CalendarDays size={48} color="#94a3b8" style={{ marginBottom: '16px' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                  No booking inquiries yet
                </h3>
                <p style={{ color: '#64748b', maxWidth: '460px', margin: '0 auto' }}>
                  When customers book any of your listed venues, their reservation requests will appear here for your confirmation.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    style={{
                      background: '#fff',
                      borderRadius: '14px',
                      padding: '24px',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '20px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span
                          style={{
                            background:
                              booking.status === 'APPROVED'
                                ? '#dcfce7'
                                : booking.status === 'PENDING'
                                  ? '#fef3c7'
                                  : '#fee2e2',
                            color:
                              booking.status === 'APPROVED'
                                ? '#16a34a'
                                : booking.status === 'PENDING'
                                  ? '#d97706'
                                  : '#ef4444',
                            padding: '3px 10px',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                          }}
                        >
                          {booking.status}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                          Booking #{booking.id} • {booking.created_at ? new Date(booking.created_at).toLocaleDateString() : ''}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', margin: '0 0 6px 0' }}>
                        {booking.event_title}
                      </h4>

                      <div style={{ display: 'flex', gap: '20px', color: '#475569', fontSize: '0.88rem', flexWrap: 'wrap' }}>
                        <span>
                          <strong>Venue:</strong> {booking.venue_details?.title || 'Selected Venue'}
                        </span>
                        <span>
                          <strong>Date:</strong> {booking.event_date}
                        </span>
                        <span>
                          <strong>Guests:</strong> {booking.guest_count}
                        </span>
                        <span>
                          <strong>Total:</strong>{' '}
                          <span style={{ color: '#0d8a73', fontWeight: 800 }}>
                            KES {Number(booking.total_price).toLocaleString()}
                          </span>
                        </span>
                      </div>

                      {booking.notes && (
                        <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic' }}>
                          "{booking.notes}"
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {booking.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleUpdateBookingStatus(booking.id, 'APPROVED')}
                            style={{
                              background: '#16a34a',
                              color: '#fff',
                              border: 'none',
                              padding: '10px 18px',
                              borderRadius: '8px',
                              fontWeight: 700,
                              fontSize: '0.88rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <CheckCircle2 size={16} /> Accept Booking
                          </button>
                          <button
                            onClick={() => handleUpdateBookingStatus(booking.id, 'REJECTED')}
                            style={{
                              background: '#fee2e2',
                              color: '#ef4444',
                              border: '1px solid #fecaca',
                              padding: '10px 18px',
                              borderRadius: '8px',
                              fontWeight: 700,
                              fontSize: '0.88rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <XCircle size={16} /> Decline
                          </button>
                        </>
                      )}
                      {booking.status === 'APPROVED' && (
                        <button
                          onClick={() => handleUpdateBookingStatus(booking.id, 'COMPLETED')}
                          style={{
                            background: '#0d8a73',
                            color: '#fff',
                            border: 'none',
                            padding: '10px 18px',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                          }}
                        >
                          Mark as Completed
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add New Venue Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '24px',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '580px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'linear-gradient(135deg, #065f54 0%, #0d8a73 100%)',
                color: '#fff',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#fff' }}>
                  List an Event Venue
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#e2e8f0' }}>
                  Showcase your space to event planners and customers
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddVenueSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Venue Name / Title
                </label>
                <input
                  required
                  value={newVenue.title}
                  onChange={(e) => setNewVenue({ ...newVenue, title: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                  placeholder="e.g. Karen Emerald Ballroom & Gardens"
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Category
                  </label>
                  <select
                    value={newVenue.category}
                    onChange={(e) => setNewVenue({ ...newVenue, category: e.target.value as VenueCategory })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                  >
                    <option value="WEDDING">Wedding Gardens & Halls</option>
                    <option value="CONFERENCE">Conference & Corporate</option>
                    <option value="BIRTHDAY">Birthday & Private Parties</option>
                    <option value="OUTDOOR">Outdoor Grounds & Picnics</option>
                    <option value="PARTY">Nightlife & Celebrations</option>
                    <option value="EXHIBITION">Exhibition & Trade Center</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Capacity (Guests)
                  </label>
                  <input
                    required
                    type="number"
                    value={newVenue.capacity}
                    onChange={(e) => setNewVenue({ ...newVenue, capacity: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                    min={1}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Daily Rate (KES)
                  </label>
                  <input
                    required
                    type="number"
                    value={newVenue.price_per_day}
                    onChange={(e) => setNewVenue({ ...newVenue, price_per_day: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                    min={0}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Hourly Rate (KES, optional)
                  </label>
                  <input
                    type="number"
                    value={newVenue.price_per_hour}
                    onChange={(e) => setNewVenue({ ...newVenue, price_per_hour: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                    min={0}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Location / Area
                  </label>
                  <input
                    required
                    value={newVenue.location}
                    onChange={(e) => setNewVenue({ ...newVenue, location: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                    placeholder="e.g. Karen, Nairobi"
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Physical Address
                  </label>
                  <input
                    value={newVenue.address}
                    onChange={(e) => setNewVenue({ ...newVenue, address: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                    placeholder="e.g. 14 Langata South Rd"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Photo URL
                </label>
                <input
                  required
                  value={newVenue.image_url}
                  onChange={(e) => setNewVenue({ ...newVenue, image_url: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                  placeholder="https://..."
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Amenities (comma-separated)
                </label>
                <input
                  value={newVenue.amenities}
                  onChange={(e) => setNewVenue({ ...newVenue, amenities: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                  placeholder="e.g. Backup Generator, Ample Parking, Clean Restrooms, Security"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Description
                </label>
                <textarea
                  required
                  rows={3}
                  value={newVenue.description}
                  onChange={(e) => setNewVenue({ ...newVenue, description: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', resize: 'vertical' }}
                  placeholder="Describe your venue space, ambiance, suitability for weddings or corporate galas..."
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#475569',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingVenue}
                  className="btn-primary"
                  style={{ flex: 2, padding: '12px', fontWeight: 700 }}
                >
                  {submittingVenue ? 'Submitting Venue...' : 'Publish Venue Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
