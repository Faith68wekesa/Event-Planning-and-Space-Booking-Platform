import React, { useState, useEffect, useCallback } from 'react';
import type { Booking, Venue, BookingStatus, VenueOwner, VenueCategory, Message } from '../types';
import { ApiService } from '../services/api';
import {
  Building2,
  CalendarDays,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Trash2,
  ShieldCheck,
  User as UserIcon,
  Image as ImageIcon,
  MessageSquare,
  Send
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cleanImageUrl, handleImageError, DEFAULT_SPACE_IMAGE } from '../utils/imageUtils';
import { CreateListingPage } from './CreateListingPage';

interface VenueOwnerDashboardProps {
  currentOwner: VenueOwner;
  onLogout?: () => void;
}

export const VenueOwnerDashboard: React.FC<VenueOwnerDashboardProps> = ({
  currentOwner,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'venues' | 'bookings' | 'messages' | 'profile' | 'create_listing'>('venues');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedBookingChatId, setSelectedBookingChatId] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [sendingDraft, setSendingDraft] = useState(false);

  const fetchChatMessages = useCallback(async (bookingId: number) => {
    try {
      setLoadingChat(true);
      const msgs = await ApiService.getMessages({ booking: bookingId });
      setChatMessages(msgs);
    } catch (e) {
      console.error("Failed to load chat messages", e);
    } finally {
      setLoadingChat(false);
    }
  }, []);

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && currentOwner.user_details) {
      const file = e.target.files[0];
      setIsUploading(true);
      const newUrl = await ApiService.uploadProfilePicture(currentOwner.user_details.id, file);
      if (newUrl) {
        currentOwner.logo_url = newUrl;
        toast.success('Profile picture updated successfully!');
      } else {
        toast.error('Failed to upload profile picture.');
      }
      setIsUploading(false);
    }
  };

  const [venues, setVenues] = useState<Venue[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    business_name: currentOwner.business_name || '',
    business_type: currentOwner.business_type || '',
    location: currentOwner.location || '',
    address: currentOwner.address || '',
    description: currentOwner.description || '',
    years_in_business: currentOwner.years_in_business || '',
    website_url: currentOwner.website_url || '',
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const payload = {
        ...profileFormData,
        years_in_business: profileFormData.years_in_business !== '' ? Number(profileFormData.years_in_business) : undefined,
      };
      await ApiService.updateVenueOwner(currentOwner.id, payload);
      toast.success('Profile updated successfully!');
      setIsEditingProfile(false);
      window.location.reload();
    } catch (e) {
      toast.error('Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

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
    amenities: '',
    image_url: '',
  });

  // Rejection modal state
  const [rejectingBooking, setRejectingBooking] = useState<Booking | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isSubmittingReject, setIsSubmittingReject] = useState<boolean>(false);

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

  useEffect(() => {
    if (activeTab === 'messages' && bookings.length > 0) {
      const activeId = selectedBookingChatId || bookings[0]?.id;
      if (activeId) {
        fetchChatMessages(Number(activeId));
        const interval = setInterval(() => {
          fetchChatMessages(Number(activeId));
        }, 4000);
        return () => clearInterval(interval);
      }
    }
  }, [activeTab, selectedBookingChatId, bookings, fetchChatMessages]);

  const handleUpdateBookingStatus = async (id: number, status: BookingStatus, extra: { reason?: string } = {}) => {
    const res = await ApiService.updateBookingStatus(id, status, extra);
    if (res.success) {
      toast.success(`Booking ${status.toLowerCase()}!`);
      fetchDashboardData();
    } else {
      toast.error(res.error || 'Failed to update booking status.');
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingBooking) return;
    setIsSubmittingReject(true);
    try {
      const res = await ApiService.updateBookingStatus(rejectingBooking.id, 'REJECTED', {
        reason: rejectionReason.trim() || 'Declined by venue owner'
      });
      if (res.success) {
        toast.success('Booking declined.');
        setRejectingBooking(null);
        setRejectionReason('');
        fetchDashboardData();
      } else {
        toast.error(res.error || 'Failed to decline booking.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error updating status.');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  const handleDeleteVenue = async (venueId: number) => {
    if (window.confirm('Are you sure you want to remove this venue listing?')) {
      const ok = await ApiService.deleteVenue(venueId);
      if (ok) {
        toast.success('Venue listing removed successfully.');
        fetchDashboardData();
      } else {
        toast.error('Failed to remove venue listing.');
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
        image_url: cleanImageUrl(newVenue.image_url) || DEFAULT_SPACE_IMAGE,
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
        amenities: '',
        image_url: '',
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
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0d8a73', marginBottom: '8px' }}>Event Planning and SpaceBooking</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span
                style={{
                  background: currentOwner.verification_status === 'APPROVED' || currentOwner.is_verified ? '#dcfce7' : currentOwner.verification_status === 'REJECTED' ? '#fee2e2' : '#fef3c7',
                  color: currentOwner.verification_status === 'APPROVED' || currentOwner.is_verified ? '#16a34a' : currentOwner.verification_status === 'REJECTED' ? '#991b1b' : '#b45309',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {currentOwner.verification_status === 'APPROVED' || currentOwner.is_verified ? '🟢 Verified vendor' : currentOwner.verification_status === 'REJECTED' ? '🔴 Action required' : '🟡 Pending verification'}
              </span>
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
              {currentOwner.business_name !== 'Pending Setup' ? currentOwner.business_name : (`${currentOwner.user_details?.first_name || ''} ${currentOwner.user_details?.last_name || ''}`.trim() || currentOwner.user_details?.username || 'Venue Owner')}
            </h1>
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.95rem' }}>
              {currentOwner.location ? `📍 ${currentOwner.location}` : 'Event Space Management'} • Manage venues, approve bookings, and monitor space performance.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.4)', marginRight: '8px' }}>
              {currentOwner.user_details?.avatar_url ? (
                <img src={currentOwner.user_details?.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <UserIcon size={24} color="#fff" />
              )}
            </div>
            <button
              onClick={() => setActiveTab('create_listing')}
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
          <button
            onClick={() => setActiveTab('messages')}
            style={{
              padding: '12px 24px',
              fontWeight: 700,
              fontSize: '1rem',
              color: activeTab === 'messages' ? '#0d8a73' : '#64748b',
              borderBottom: activeTab === 'messages' ? '3px solid #0d8a73' : '3px solid transparent',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '-2px',
            }}
          >
            <MessageSquare size={18} /> Messages
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              padding: '12px 24px',
              fontWeight: 700,
              fontSize: '1rem',
              color: activeTab === 'profile' ? '#0d8a73' : '#64748b',
              borderBottom: activeTab === 'profile' ? '3px solid #0d8a73' : '3px solid transparent',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '-2px',
            }}
          >
            <ShieldCheck size={18} /> My Profile
          </button>
        </div>

        {/* TAB: CREATE LISTING FULL PAGE */}
        {activeTab === 'create_listing' && (
          <CreateListingPage
            onBack={() => setActiveTab('venues')}
            onSuccess={() => {
              fetchDashboardData();
              setActiveTab('venues');
            }}
            defaultMode="venue"
            currentOwnerId={currentOwner.id}
            currentUserId={currentOwner.user_details?.id}
          />
        )}

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
                  Add your first event venue to start receiving booking requests from clients .
                </p>
                <button
                  onClick={() => setActiveTab('create_listing')}
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
                        src={venue.image_url || DEFAULT_SPACE_IMAGE}
                        onError={(e) => handleImageError(e, DEFAULT_SPACE_IMAGE)}
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
                          background: (venue.approval_status === 'APPROVED' || venue.is_verified)
                            ? '#16a34a'
                            : venue.approval_status === 'REJECTED'
                            ? '#dc2626'
                            : '#f59e0b',
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
                        {(venue.approval_status === 'APPROVED' || venue.is_verified) ? (
                          <>
                            <CheckCircle2 size={12} /> Live & Approved
                          </>
                        ) : venue.approval_status === 'REJECTED' ? (
                          <>
                            <XCircle size={12} /> Needs Revision
                          </>
                        ) : (
                          <>
                            <Clock size={12} /> Pending Admin Approval
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

                      {venue.approval_status === 'REJECTED' && venue.rejection_reason && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '0.8rem', color: '#991b1b' }}>
                          <strong>Admin Feedback:</strong> {venue.rejection_reason}
                        </div>
                      )}

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

                      {booking.cancellation_reason && (
                        <div style={{ marginTop: '8px', padding: '6px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.8rem', color: '#991b1b' }}>
                          <strong>Cancelled:</strong> {booking.cancellation_reason} {booking.cancelled_by ? `(by ${booking.cancelled_by})` : ''}
                        </div>
                      )}

                      {booking.rejection_reason && (
                        <div style={{ marginTop: '8px', padding: '6px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.8rem', color: '#991b1b' }}>
                          <strong>Declined Reason:</strong> {booking.rejection_reason}
                        </div>
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
                            onClick={() => {
                              setRejectingBooking(booking);
                              setRejectionReason('');
                            }}
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
                      <button
                        onClick={() => {
                          setSelectedBookingChatId(booking.id);
                          setActiveTab('messages');
                          fetchChatMessages(booking.id);
                        }}
                        style={{
                          background: '#f0fdf4',
                          color: '#0d8a73',
                          border: '1px solid rgba(13, 138, 115, 0.3)',
                          padding: '10px 16px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <MessageSquare size={16} /> Chat Client
                      </button>
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

        {/* Tab: Messages */}
        {activeTab === 'messages' && (() => {
          const currentChatBooking = bookings.find(b => b.id === selectedBookingChatId) || bookings[0];
          const clientName = currentChatBooking?.customer_name || 'Client';
          const clientInitial = clientName.charAt(0).toUpperCase();

          const handleSendReply = async () => {
            if (!messageDraft.trim() || !currentChatBooking || !currentOwner.user) return;
            const content = messageDraft.trim();
            setMessageDraft('');
            setSendingDraft(true);
            try {
              const res = await ApiService.sendMessage({
                sender: currentOwner.user,
                recipient: currentChatBooking.customer,
                booking: currentChatBooking.id,
                venue: currentChatBooking.venue,
                content,
              });
              if (res) {
                setChatMessages(prev => [...prev, res]);
                toast.success(`Message sent to ${clientName}!`);
              } else {
                toast.error('Failed to send message.');
              }
            } catch (e) {
              toast.error('Error sending message.');
            } finally {
              setSendingDraft(false);
            }
          };

          return bookings.length === 0 ? (
            <div style={{ background: '#ffffff', padding: '60px 20px', textAlign: 'center', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <MessageSquare size={48} color="#94a3b8" style={{ marginBottom: '14px' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>No Messages Yet</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 20px' }}>
                When clients book your venues or reach out with inquiries, direct chats will appear here.
              </p>
            </div>
          ) : (
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                display: 'grid',
                gridTemplateColumns: '320px 1fr',
                minHeight: '560px',
                overflow: 'hidden',
              }}
            >
              {/* Left Pane: Booking Conversations */}
              <div style={{ borderRight: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2e8f0', fontWeight: 800, color: '#0f172a' }}>
                  Conversations ({bookings.length})
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {bookings.map((b) => {
                    const isSelected = currentChatBooking?.id === b.id;
                    return (
                      <div
                        key={b.id}
                        onClick={() => {
                          setSelectedBookingChatId(b.id);
                          fetchChatMessages(b.id);
                        }}
                        style={{
                          padding: '14px 18px',
                          borderBottom: '1px solid #f1f5f9',
                          background: isSelected ? '#ffffff' : 'transparent',
                          cursor: 'pointer',
                          borderLeft: isSelected ? '4px solid #0d8a73' : '4px solid transparent',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                            {b.customer_name || 'Client'}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{b.event_date}</span>
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#0d8a73', fontWeight: 600, marginBottom: '2px' }}>
                          {b.event_title || b.event_type}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {b.notes ? `"${b.notes}"` : `Booking request #${b.id}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Pane: Active Chat */}
              <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: '#ccfbf1',
                        color: '#0d8a73',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {clientInitial}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#0f172a' }}>{clientName}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        Inquiring about {currentChatBooking?.event_title || 'Space'} · Date: {currentChatBooking?.event_date}
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      background: '#ecfdf5',
                      color: '#065f46',
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      fontWeight: 600,
                    }}
                  >
                    Status: {currentChatBooking?.status}
                  </span>
                </div>

                {/* Official In-Platform Policy Banner */}
                <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: '#166534', fontWeight: 600 }}>
                  <ShieldCheck size={14} color="#16a34a" /> In-Platform Official Communication: All inquiries, booking terms & chats must stay strictly inside Locyfy. Off-platform communications are prohibited.
                </div>

                {/* Messages Bubbles */}
                <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', background: '#fafafa' }}>
                  {/* Initial Inquiry Note */}
                  <div style={{ alignSelf: 'flex-start', maxWidth: '75%', background: '#ffffff', padding: '12px 16px', borderRadius: '14px 14px 14px 2px', fontSize: '0.9rem', color: '#1e293b', border: '1px solid #e2e8f0', lineHeight: 1.5 }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0d8a73', marginBottom: '4px' }}>
                      {clientName} (Booking Inquiry)
                    </div>
                    {currentChatBooking?.notes 
                      ? currentChatBooking.notes 
                      : `Booking request for "${currentChatBooking?.event_title}" on ${currentChatBooking?.event_date} for ${currentChatBooking?.guest_count || 1} guest(s).`}
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px', textAlign: 'right' }}>
                      {currentChatBooking?.event_date || 'Recent'}
                    </div>
                  </div>

                  {loadingChat && chatMessages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '12px', fontSize: '0.85rem' }}>
                      Loading conversation history...
                    </div>
                  ) : null}

                  {chatMessages.map((msg) => {
                    const isMe = currentOwner.user && msg.sender === currentOwner.user;
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isMe ? 'flex-end' : 'flex-start',
                          maxWidth: '75%',
                          background: isMe ? '#0d8a73' : '#ffffff',
                          color: isMe ? '#ffffff' : '#1e293b',
                          padding: '12px 16px',
                          borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                          fontSize: '0.9rem',
                          lineHeight: 1.5,
                          border: isMe ? 'none' : '1px solid #e2e8f0',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        }}
                      >
                        {!isMe && (
                          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0d8a73', marginBottom: '4px' }}>
                            {msg.sender_name || clientName}
                          </div>
                        )}
                        <div style={{ wordBreak: 'break-word' }}>{msg.content}</div>
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: isMe ? '#a7f3d0' : '#94a3b8',
                            marginTop: '4px',
                            textAlign: 'right',
                          }}
                        >
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Input */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder={`Reply to ${clientName}...`}
                    value={messageDraft}
                    onChange={(e) => setMessageDraft(e.target.value)}
                    style={{ flex: 1, padding: '12px 16px', borderRadius: '9999px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && messageDraft.trim() && !sendingDraft) {
                        handleSendReply();
                      }
                    }}
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={sendingDraft || !messageDraft.trim()}
                    style={{
                      background: '#0d8a73',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '9999px',
                      padding: '12px 20px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: sendingDraft ? 0.7 : 1,
                    }}
                  >
                    <Send size={15} /> {sendingDraft ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
        {/* Tab 3: Profile */}
        {activeTab === 'profile' && (
          <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
               <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Venue Owner Profile</h3>
               {!isEditingProfile && (
                 <button
                   onClick={() => setIsEditingProfile(true)}
                   style={{
                     background: '#f1f5f9', color: '#0f172a', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem'
                   }}
                 >
                   Edit Profile
                 </button>
               )}
             </div>

             <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
               <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                 {currentOwner.user_details?.avatar_url ? (
                   <img src={currentOwner.user_details?.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                 ) : (
                   <UserIcon size={40} color="#94a3b8" />
                 )}
               </div>
               <label 
                 style={{ background: '#f1f5f9', color: '#0f172a', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: isUploading ? 'not-allowed' : 'pointer', fontSize: '0.9rem', display: 'inline-block', opacity: isUploading ? 0.7 : 1 }}
               >
                 {isUploading ? 'Uploading...' : 'Upload Profile Picture'}
                 <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePictureUpload} disabled={isUploading} />
               </label>
             </div>

             {isEditingProfile ? (
               <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                   <div>
                     <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Business Name</label>
                     <input required type="text" value={profileFormData.business_name} onChange={(e) => setProfileFormData({...profileFormData, business_name: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                   </div>
                   <div>
                     <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Business Type</label>
                     <input required type="text" value={profileFormData.business_type} onChange={(e) => setProfileFormData({...profileFormData, business_type: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                   </div>
                   <div>
                     <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Location</label>
                     <input required type="text" value={profileFormData.location} onChange={(e) => setProfileFormData({...profileFormData, location: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                   </div>
                   <div>
                     <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Address</label>
                     <input type="text" value={profileFormData.address} onChange={(e) => setProfileFormData({...profileFormData, address: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                   </div>
                   <div>
                     <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Years in Business</label>
                     <input type="number" value={profileFormData.years_in_business} onChange={(e) => setProfileFormData({...profileFormData, years_in_business: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                   </div>
                   <div>
                     <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Website URL</label>
                     <input type="url" value={profileFormData.website_url} onChange={(e) => setProfileFormData({...profileFormData, website_url: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                   </div>
                   <div style={{ gridColumn: '1 / -1' }}>
                     <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Description</label>
                     <textarea rows={3} value={profileFormData.description} onChange={(e) => setProfileFormData({...profileFormData, description: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                   </div>
                 </div>
                 <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                   <button type="button" onClick={() => setIsEditingProfile(false)} style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                   <button type="submit" disabled={isSavingProfile} style={{ background: '#0d8a73', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: isSavingProfile ? 'not-allowed' : 'pointer', fontWeight: 600 }}>{isSavingProfile ? 'Saving...' : 'Save Changes'}</button>
                 </div>
               </form>
             ) : (
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div><span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>Business/Owner Name</span><strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{currentOwner.business_name}</strong></div>
                  <div><span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>Business Type</span><strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{currentOwner.business_type || 'N/A'}</strong></div>
                  <div><span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>Email Address</span><strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{currentOwner.contact_email || 'Not provided'}</strong></div>
                  <div><span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>Phone Number</span><strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{currentOwner.contact_phone || 'Not provided'}</strong></div>
                  <div><span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>Location</span><strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{currentOwner.location || 'Not provided'}</strong></div>
                  <div><span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>Years in Business</span><strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{currentOwner.years_in_business || 'N/A'}</strong></div>
                  <div><span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>Account Status</span><strong style={{ fontSize: '1.05rem', color: currentOwner.is_verified ? '#16a34a' : '#d97706' }}>{currentOwner.is_verified ? 'Verified Partner' : 'Pending Verification'}</strong></div>
                  <div style={{ gridColumn: '1 / -1' }}><span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>Business Description</span><p style={{ margin: '4px 0 0', color: '#334155' }}>{currentOwner.description || 'No description provided.'}</p></div>
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
                  value={newVenue.image_url}
                  onChange={(e) => setNewVenue({ ...newVenue, image_url: cleanImageUrl(e.target.value) })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                  placeholder="Paste direct photo link or Google Images link..."
                />
                {newVenue.image_url ? (
                  <div style={{ marginTop: '10px', padding: '10px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F8F7A', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ImageIcon size={14} /> Live Image Preview:
                    </div>
                    <div style={{ height: '140px', borderRadius: '8px', overflow: 'hidden', background: '#e2e8f0' }}>
                      <img 
                        src={newVenue.image_url} 
                        alt="Preview" 
                        onError={(e) => handleImageError(e, DEFAULT_SPACE_IMAGE)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                    ✨ Direct photo links or Google Images links are automatically cleaned and previewed.
                  </p>
                )}
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

      {/* Reject Booking Modal */}
      {rejectingBooking && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!isSubmittingReject) {
              setRejectingBooking(null);
              setRejectionReason('');
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '16px',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                <XCircle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                  Decline Booking Request
                </h3>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Booking #{rejectingBooking.id} · {rejectingBooking.event_title}
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '16px', lineHeight: 1.5 }}>
              Please provide a clear reason to help the client understand why their booking request cannot be accommodated at this time.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Decline Reason (Required):
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Venue is already booked for private maintenance on this date..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={isSubmittingReject}
                onClick={() => {
                  setRejectingBooking(null);
                  setRejectionReason('');
                }}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: isSubmittingReject ? 'not-allowed' : 'pointer',
                  color: '#475569',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingReject || !rejectionReason.trim()}
                onClick={handleConfirmReject}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isSubmittingReject || !rejectionReason.trim() ? '#fca5a5' : '#dc2626',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: isSubmittingReject || !rejectionReason.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmittingReject ? 'Declining...' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
