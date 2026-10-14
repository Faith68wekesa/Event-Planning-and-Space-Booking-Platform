import React, { useState, useEffect, useCallback } from 'react';
import type { Booking, Venue, Review, Message, ConversationThread, EventItem } from '../types';
import './customer-dashboard.css';
import {
  Calendar,
  Clock,
  CheckCircle2,
  X,
  User as UserIcon,
  Search,
  Bell,
  Heart,
  MessageSquare,
  Settings,
  HelpCircle,
  ChevronRight,
  ChevronDown,
  MapPin,
  Star,
  Building2,
  Camera,
  CalendarX,
  Inbox,
  LogOut,
  RotateCw,
  Send,
  CalendarDays
} from 'lucide-react';
import { ApiService } from '../services/api';
import toast from 'react-hot-toast';
import { MyEventsView } from './MyEventsView';

interface CustomerDashboardProps {
  bookings: Booking[];
  currentUser: any;
  onCancelBooking: (id: number) => void;
  onNavigate?: (tab: string) => void;
  onLogout?: () => void;
  onRequestRole?: (role: 'CUSTOMER' | 'VENDOR' | 'VENUE_OWNER' | 'PROVIDER') => void;
  venues?: Venue[];
  initialTab?: 'dashboard' | 'events' | 'services' | 'venues' | 'bookings' | 'reviews' | 'messages' | 'favorites' | 'profile' | 'settings';
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  bookings = [],
  currentUser,
  onCancelBooking,
  onNavigate,
  onLogout,
  onRequestRole,
  venues = [],
  initialTab = 'dashboard',
}) => {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'events' | 'services' | 'venues' | 'bookings' | 'reviews' | 'messages' | 'favorites' | 'profile' | 'settings'
  >(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!currentUser?.id) return;
    setIsLoadingEvents(true);
    setEventsError(null);
    try {
      const data = await ApiService.getEvents(currentUser.id);
      setEvents(data);
    } catch (e: any) {
      console.error('Error fetching events:', e);
      setEventsError(e.message || 'Failed to load events. Please try again.');
    } finally {
      setIsLoadingEvents(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleCreateEvent = async (formData: Partial<EventItem>): Promise<boolean> => {
    if (!currentUser?.id) {
      toast.error('You must be logged in to create an event.');
      return false;
    }
    const res = await ApiService.createEvent({ ...formData, owner: currentUser.id });
    if (res.success && res.data) {
      toast.success('Event created successfully!');
      setEvents((prev) => [res.data!, ...prev]);
      return true;
    } else {
      toast.error(res.error || 'Failed to create event.');
      return false;
    }
  };

  const handleUpdateEvent = async (id: number, formData: Partial<EventItem>): Promise<boolean> => {
    const res = await ApiService.updateEvent(id, formData);
    if (res.success && res.data) {
      toast.success('Event updated successfully!');
      setEvents((prev) => prev.map((ev) => (ev.id === id ? res.data! : ev)));
      return true;
    } else {
      toast.error(res.error || 'Failed to update event.');
      return false;
    }
  };

  const handleDeleteEvent = async (id: number): Promise<boolean> => {
    const ok = await ApiService.deleteEvent(id);
    if (ok) {
      toast.success('Event deleted successfully.');
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
      return true;
    } else {
      toast.error('Failed to delete event.');
      return false;
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [selectedBookingDetails, setSelectedBookingDetails] = useState<any | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [bookingFilterStatus, setBookingFilterStatus] = useState<string>('ALL');

  // Live Customer Bookings State (Auto-sync with backend changes)
  const [localBookings, setLocalBookings] = useState<Booking[]>(bookings);
  const [isRefreshingBookings, setIsRefreshingBookings] = useState(false);

  useEffect(() => {
    setLocalBookings(bookings);
  }, [bookings]);

  const syncBookings = useCallback(async (showIndicator = false) => {
    if (!currentUser?.id) return;
    if (showIndicator) setIsRefreshingBookings(true);
    try {
      const fresh = await ApiService.getBookings(currentUser.id);
      if (Array.isArray(fresh)) {
        setLocalBookings(fresh);
      }
    } catch (e) {
      console.error('Error fetching fresh bookings:', e);
    } finally {
      if (showIndicator) setIsRefreshingBookings(false);
    }
  }, [currentUser?.id]);

  // Refetch when switching tabs or when window regains focus
  useEffect(() => {
    syncBookings();
  }, [syncBookings, activeTab]);

  useEffect(() => {
    const handleFocus = () => syncBookings();
    window.addEventListener('focus', handleFocus);
    // Light background poll every 5 seconds to catch live approvals
    const interval = setInterval(() => syncBookings(), 5000);
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [syncBookings]);

  // Customer Reviews State (Phase 5 & 7)
  const [reviewModalBooking, setReviewModalBooking] = useState<Booking | null>(null);
  const [ratingScore, setRatingScore] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [loadingMyReviews, setLoadingMyReviews] = useState<boolean>(false);

  const fetchMyReviews = async () => {
    try {
      setLoadingMyReviews(true);
      const data = await ApiService.getReviews();
      setMyReviews(data);
    } catch (e) {
      console.error('Error fetching my reviews:', e);
    } finally {
      setLoadingMyReviews(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reviews') {
      fetchMyReviews();
    }
  }, [activeTab]);

  const handleSubmitReview = async () => {
    if (ratingScore < 1 || ratingScore > 5) {
      toast.error('Please select a star rating between 1 and 5.');
      return;
    }
    if (!reviewModalBooking) return;

    try {
      setSubmittingReview(true);
      await ApiService.submitReview({
        booking: reviewModalBooking.id,
        venue: reviewModalBooking.venue,
        vendor: reviewModalBooking.vendor,
        rating: ratingScore,
        comment: reviewComment.trim(),
      });

      toast.success('Thank you! Your verified review has been submitted.');
      reviewModalBooking.has_reviewed = true;
      setReviewModalBooking(null);
      setRatingScore(0);
      setHoverRating(0);
      setReviewComment('');
      fetchMyReviews();
      syncBookings();
    } catch (err: any) {
      const errDetail = err.response?.data?.error || err.response?.data?.detail || 'Failed to submit review.';
      toast.error(errDetail);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Customer Direct Messaging State
  const [conversations, setConversations] = useState<ConversationThread[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [activeThreadBooking, setActiveThreadBooking] = useState<Booking | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [sendingDraft, setSendingDraft] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      setLoadingConversations(true);
      const convs = await ApiService.getConversations(currentUser.id);
      setConversations(convs);
      if (convs.length > 0 && !selectedPartnerId) {
        setSelectedPartnerId(convs[0].partner_id);
      }
    } catch (e) {
      console.error("Failed to load conversations", e);
    } finally {
      setLoadingConversations(false);
    }
  }, [currentUser?.id, selectedPartnerId]);

  const fetchThreadMessages = useCallback(async (partnerId: number) => {
    if (!currentUser?.id) return;
    try {
      setLoadingMessages(true);
      const msgs = await ApiService.getMessages({ user: currentUser.id, partner: partnerId });
      setThreadMessages(msgs);
      await ApiService.markThreadRead(currentUser.id, partnerId);
    } catch (e) {
      console.error("Failed to load thread messages", e);
    } finally {
      setLoadingMessages(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (activeTab === 'messages') {
      fetchConversations();
    }
  }, [activeTab, fetchConversations]);

  useEffect(() => {
    if (activeTab === 'messages' && selectedPartnerId) {
      fetchThreadMessages(selectedPartnerId);
      const interval = setInterval(() => {
        fetchThreadMessages(selectedPartnerId);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [activeTab, selectedPartnerId, fetchThreadMessages]);

  const handleSendMessage = async () => {
    if (!messageDraft.trim() || !currentUser?.id || !selectedPartnerId) return;
    const content = messageDraft.trim();
    setMessageDraft('');
    setSendingDraft(true);
    try {
      const sent = await ApiService.sendMessage({
        sender: currentUser.id,
        recipient: selectedPartnerId,
        content,
        booking: activeThreadBooking?.id,
        venue: activeThreadBooking?.venue,
        vendor: activeThreadBooking?.vendor,
      });
      if (sent) {
        setThreadMessages(prev => [...prev, sent]);
        fetchConversations();
      } else {
        toast.error("Failed to send message.");
      }
    } catch (e) {
      toast.error("Error sending message.");
    } finally {
      setSendingDraft(false);
    }
  };

  const handleStartChatWithBooking = (booking: Booking) => {
    const providerId = booking.provider_user_id || 
      (booking.venue_details?.owner_user_id) || 
      (booking.vendor_details?.user);
    if (!providerId) {
      toast.error("Provider contact details unavailable.");
      return;
    }
    setActiveThreadBooking(booking);
    setSelectedPartnerId(providerId);
    setActiveTab('messages');
    fetchThreadMessages(providerId);
  };

  // Greeting dynamic calculation
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const displayName = currentUser?.first_name 
    ? currentUser.first_name 
    : (currentUser?.username ? currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1) : 'Guest');

  // Pure real counts from database / fresh state
  const totalBookingsCount = localBookings.length;
  const pendingCount = localBookings.filter((b) => b.status === 'PENDING').length;
  const confirmedCount = localBookings.filter((b) => b.status === 'APPROVED' || (b.status as any) === 'CONFIRMED').length;
  const completedCount = localBookings.filter((b) => b.status === 'COMPLETED').length;

  // Real upcoming bookings
  const upcomingDisplayList = localBookings.map((b) => {
    const title = b.venue_details?.title
      ? `${b.venue_details.title} (Venue)`
      : b.vendor_details?.business_name
      ? `${b.vendor_details.business_name} (Vendor)`
      : `${b.event_title} (${b.event_type})`;
    const location = b.venue_details?.location || b.vendor_details?.location || 'Not specified';
    const img = b.venue_details?.image_url || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=600&q=80';
    
    const displayStatus = (b.status === 'APPROVED' || (b.status as any) === 'CONFIRMED')
      ? 'Confirmed'
      : b.status === 'PENDING'
      ? 'Pending'
      : b.status === 'COMPLETED'
      ? 'Completed'
      : b.status === 'REJECTED'
      ? 'Declined'
      : 'Cancelled';

    return {
      id: b.id,
      title,
      category: b.venue ? 'Venue' : 'Vendor',
      date: `${b.event_date}`,
      location,
      status: displayStatus,
      price: `KES ${Number(b.total_price || 0).toLocaleString()}`,
      image: img,
      contact: b.venue_details?.address || 'Locyfy Host',
      notes: b.notes || `${b.guest_count} Attendees expected`,
      rawBooking: b,
    };
  });

  // Dynamically generated recent activity from real bookings
  const dynamicRecentActivity = localBookings.slice(0, 5).map((b) => {
    const targetName = b.venue_details?.title || b.vendor_details?.business_name || b.event_title;
    const isApproved = b.status === 'APPROVED' || (b.status as any) === 'CONFIRMED';
    const isPending = b.status === 'PENDING';
    const isCompleted = b.status === 'COMPLETED';

    const text = isApproved
      ? `Your booking at ${targetName} has been confirmed.`
      : isPending
      ? `Your booking request for ${targetName} is pending review.`
      : isCompleted
      ? `Your event at ${targetName} is marked completed.`
      : `Your booking for ${targetName} status is ${b.status.toLowerCase()}.`;

    const time = b.created_at ? new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : b.event_date;

    return {
      id: b.id,
      type: isApproved ? 'confirmed' : isPending ? 'pending' : 'completed',
      text,
      time,
    };
  });

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && currentUser) {
      const file = e.target.files[0];
      setIsUploading(true);
      const newUrl = await ApiService.uploadProfilePicture(currentUser.id, file);
      if (newUrl) {
        currentUser.profile_picture = newUrl;
        currentUser.avatar_url = newUrl;
        toast.success('Profile picture updated successfully!');
      } else {
        toast.error('Failed to upload profile picture.');
      }
      setIsUploading(false);
    }
  };

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  // Real featured venues from database
  const featuredVenuesList = venues.slice(0, 3).map((v) => ({
    id: v.id,
    name: v.title,
    location: v.location || 'Nairobi, Kenya',
    rating: v.rating || 5.0,
    reviews: v.review_count || 0,
    image: v.image_url || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=600&q=80',
  }));

  return (
    <div className="customer-dashboard-layout">
      {/* 1. LEFT SIDEBAR (Dark Teal #08332d) */}
      <aside className="customer-sidebar">
        {/* Brand Header */}
        <div 
          className="customer-sidebar-logo" 
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate ? onNavigate('landing') : setActiveTab('dashboard')}
          title="Return to Locyfy Home"
        >
          <div className="customer-logo-icon">
            <Calendar size={22} color="#5eead4" />
          </div>
          <div>
            <div className="customer-brand-title">Locyfy</div>
            <div className="customer-brand-tagline">Events. Spaces. Services.</div>
          </div>
        </div>


        {/* Sidebar Nav Items */}
        <nav className="customer-sidebar-nav">
          <button
            className={`customer-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="customer-nav-item-left">
              <Calendar size={18} />
              <span>Dashboard</span>
            </div>
          </button>

          <button
            className={`customer-nav-item ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            <div className="customer-nav-item-left">
              <CalendarDays size={18} />
              <span>My Events</span>
            </div>
            {events.length > 0 && (
              <span className={`customer-nav-badge ${activeTab === 'events' ? 'active-badge' : ''}`}>
                {events.length}
              </span>
            )}
          </button>

          <button
            className="customer-nav-item"
            onClick={() => (onNavigate ? onNavigate('vendors') : setActiveTab('services'))}
          >
            <div className="customer-nav-item-left">
              <Search size={18} />
              <span>Browse Services</span>
            </div>
          </button>

          <button
            className="customer-nav-item"
            onClick={() => (onNavigate ? onNavigate('venues') : setActiveTab('venues'))}
          >
            <div className="customer-nav-item-left">
              <Building2 size={18} />
              <span>Browse Venues</span>
            </div>
          </button>

          <button
            className={`customer-nav-item ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            <div className="customer-nav-item-left">
              <Calendar size={18} />
              <span>My Bookings</span>
            </div>
            {totalBookingsCount > 0 && (
              <span className={`customer-nav-badge ${activeTab === 'bookings' ? 'active-badge' : ''}`}>
                {totalBookingsCount}
              </span>
            )}
          </button>

          <button
            className={`customer-nav-item ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            <div className="customer-nav-item-left">
              <Star size={18} />
              <span>My Reviews</span>
            </div>
          </button>

          <button
            className={`customer-nav-item ${activeTab === 'messages' ? 'active' : ''}`}
            onClick={() => setActiveTab('messages')}
          >
            <div className="customer-nav-item-left">
              <MessageSquare size={18} />
              <span>Messages</span>
            </div>
          </button>

          <button
            className={`customer-nav-item ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            <div className="customer-nav-item-left">
              <Heart size={18} />
              <span>Favorites</span>
            </div>
          </button>

          <button
            className={`customer-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <div className="customer-nav-item-left">
              <UserIcon size={18} />
              <span>My Profile</span>
            </div>
          </button>

          <button
            className={`customer-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <div className="customer-nav-item-left">
              <Settings size={18} />
              <span>Settings</span>
            </div>
          </button>
        </nav>

        {/* Need Help? Footer */}
        <div
          className="customer-sidebar-help"
          onClick={() => toast('Support contact: support@locyfy.com or call +254 700 123 456', { icon: 'ℹ️' })}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <HelpCircle size={22} color="#a7f3d0" />
            <div>
              <div className="customer-help-title">Need Help?</div>
              <div className="customer-help-sub">Get support or contact us.</div>
            </div>
          </div>
          <ChevronRight size={16} color="#94a3b8" />
        </div>
      </aside>

      {/* 2. MAIN DASHBOARD AREA */}
      <main className="customer-main-area">
        {/* Top Header */}
        <header className="customer-topbar">
          <div className="customer-search-box">
            <Search size={18} color="#64748b" />
            <input
              type="text"
              placeholder="Search for venues, services, or events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim() && onNavigate) {
                  onNavigate('venues');
                }
              }}
            />
          </div>

          <div className="customer-topbar-actions">
            <div style={{ position: 'relative' }}>
              <button
                className="customer-notif-btn"
                onClick={() => setShowNotifications(!showNotifications)}
                title="Notifications"
              >
                <Bell size={20} />
                {pendingCount > 0 && <span className="customer-notif-badge">{pendingCount}</span>}
              </button>

              {/* Notification Popover */}
              {showNotifications && (
                <div
                  style={{
                    position: 'absolute',
                    top: '52px',
                    right: 0,
                    width: '320px',
                    background: '#ffffff',
                    borderRadius: '14px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                    border: '1px solid #e2e8f0',
                    zIndex: 50,
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Notifications</h4>
                    <span 
                      style={{ fontSize: '0.75rem', color: '#0d8a73', fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => setShowNotifications(false)}
                    >
                      Close
                    </span>
                  </div>
                  {dynamicRecentActivity.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {dynamicRecentActivity.slice(0, 3).map((act) => (
                        <div key={act.id} style={{ fontSize: '0.82rem', padding: '8px', background: '#f8fafc', borderRadius: '8px' }}>
                          <span style={{ color: '#1e293b', display: 'block', fontWeight: 600 }}>{act.text}</span>
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{act.time}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '16px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                      No new notifications
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile Dropdown (Shifted to top right as requested) */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowAccountMenu(!showAccountMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#0d8a73',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '7px 14px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  boxShadow: '0 2px 6px rgba(13, 138, 115, 0.25)',
                  transition: 'all 0.2s',
                }}
              >
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {currentUser?.avatar_url || currentUser?.profile_picture ? (
                    <img
                      src={currentUser.avatar_url || currentUser.profile_picture}
                      alt="Profile"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <UserIcon size={16} color="#ffffff" />
                  )}
                </div>
                <ChevronDown size={15} />
              </button>

              {showAccountMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '46px',
                    right: 0,
                    width: '220px',
                    background: '#ffffff',
                    borderRadius: '14px',
                    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.15)',
                    border: '1px solid #e2e8f0',
                    zIndex: 60,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '6px 0',
                  }}
                >
                  <button
                    onClick={() => {
                      setShowAccountMenu(false);
                      setActiveTab('profile');
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 18px',
                      background: 'none',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      color: '#1e293b',
                      fontWeight: 600,
                    }}
                  >
                    <UserIcon size={18} color="#0d8a73" /> My Profile
                  </button>

                  <button
                    onClick={() => {
                      setShowAccountMenu(false);
                      setActiveTab('dashboard');
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 18px',
                      background: activeTab === 'dashboard' ? '#f0fdf9' : 'none',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      color: activeTab === 'dashboard' ? '#0d8a73' : '#1e293b',
                      fontWeight: 600,
                    }}
                  >
                    <Calendar size={18} color="#0d8a73" /> Customer Dashboard
                  </button>

                  <button
                    onClick={() => {
                      setShowAccountMenu(false);
                      if (onRequestRole) {
                        onRequestRole('PROVIDER');
                      } else if (onNavigate) {
                        onNavigate('provider-dashboard');
                      }
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 18px',
                      background: 'none',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      color: '#0d8a73',
                      fontWeight: 600,
                    }}
                  >
                    <Building2 size={18} color="#0d8a73" /> Vendor Dashboard
                  </button>

                  <div style={{ borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />

                  <button
                    onClick={() => {
                      setShowAccountMenu(false);
                      if (onLogout) onLogout();
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 18px',
                      background: 'none',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      color: '#ef4444',
                      fontWeight: 600,
                    }}
                  >
                    <LogOut size={18} color="#ef4444" /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Main View */}
        {activeTab === 'dashboard' && (
          <div className="customer-content-container">
            {/* Greeting Header */}
            <div className="customer-greeting-row">
              <div>
                <h1 className="customer-greeting-title">{greeting}, {displayName}!</h1>
                <p className="customer-greeting-subtitle">Plan your next event or manage your bookings.</p>
              </div>
              <div className="customer-date-badge">{formattedDate}</div>
            </div>

            {/* 4 Metric Cards */}
            <div className="customer-stats-grid">
              {/* Total Bookings */}
              <div
                className="customer-stat-card"
                onClick={() => {
                  setBookingFilterStatus('ALL');
                  setActiveTab('bookings');
                }}
              >
                <div className="customer-stat-header">
                  <div className="customer-stat-icon-wrap" style={{ background: '#d1fae5' }}>
                    <Calendar size={22} color="#059669" />
                  </div>
                  <div className="customer-stat-label">Total Bookings</div>
                </div>
                <div className="customer-stat-value">{totalBookingsCount}</div>
                <div className="customer-stat-footer">
                  <span>All time</span>
                  <ChevronRight size={16} />
                </div>
              </div>

              {/* Pending */}
              <div
                className="customer-stat-card"
                onClick={() => {
                  setBookingFilterStatus('PENDING');
                  setActiveTab('bookings');
                }}
              >
                <div className="customer-stat-header">
                  <div className="customer-stat-icon-wrap" style={{ background: '#dbeafe' }}>
                    <Clock size={22} color="#2563eb" />
                  </div>
                  <div className="customer-stat-label">Pending</div>
                </div>
                <div className="customer-stat-value">{pendingCount}</div>
                <div className="customer-stat-footer">
                  <span>Requires your attention</span>
                  <ChevronRight size={16} />
                </div>
              </div>

              {/* Confirmed */}
              <div
                className="customer-stat-card"
                onClick={() => {
                  setBookingFilterStatus('CONFIRMED');
                  setActiveTab('bookings');
                }}
              >
                <div className="customer-stat-header">
                  <div className="customer-stat-icon-wrap" style={{ background: '#dcfce7' }}>
                    <CheckCircle2 size={22} color="#16a34a" />
                  </div>
                  <div className="customer-stat-label">Confirmed</div>
                </div>
                <div className="customer-stat-value">{confirmedCount}</div>
                <div className="customer-stat-footer">
                  <span>Confirmed bookings</span>
                  <ChevronRight size={16} />
                </div>
              </div>

              {/* Completed */}
              <div
                className="customer-stat-card"
                onClick={() => {
                  setBookingFilterStatus('COMPLETED');
                  setActiveTab('bookings');
                }}
              >
                <div className="customer-stat-header">
                  <div className="customer-stat-icon-wrap" style={{ background: '#f3e8ff' }}>
                    <CheckCircle2 size={22} color="#9333ea" />
                  </div>
                  <div className="customer-stat-label">Completed</div>
                </div>
                <div className="customer-stat-value">{completedCount}</div>
                <div className="customer-stat-footer">
                  <span>Past bookings</span>
                  <ChevronRight size={16} />
                </div>
              </div>
            </div>

            {/* 2-Column Content Layout */}
            <div className="customer-columns-grid">
              {/* Left Column (Upcoming Bookings + Recent Activity) */}
              <div>
                {/* Upcoming Bookings Box */}
                <div className="customer-card-box">
                  <div className="customer-card-box-header">
                    <h2 className="customer-card-title">Upcoming Bookings</h2>
                    {upcomingDisplayList.length > 0 && (
                      <button className="customer-card-link" onClick={() => setActiveTab('bookings')}>
                        View all
                      </button>
                    )}
                  </div>

                  <div>
                    {upcomingDisplayList.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                        <CalendarX size={44} color="#94a3b8" style={{ marginBottom: '12px' }} />
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', margin: '0 0 6px 0' }}>
                          No upcoming bookings
                        </h4>
                        <p style={{ fontSize: '0.86rem', margin: '0 0 16px 0', maxWidth: '360px', marginLeft: 'auto', marginRight: 'auto' }}>
                          Discover top event spaces and professional vendors to schedule your next event.
                        </p>
                        <button
                          className="customer-promo-btn"
                          style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                          onClick={() => (onNavigate ? onNavigate('venues') : setActiveTab('venues'))}
                        >
                          Explore Venues
                        </button>
                      </div>
                    ) : (
                      upcomingDisplayList.slice(0, 3).map((item) => (
                        <div key={item.id} className="customer-booking-row">
                          <div className="customer-booking-main">
                            <img
                              src={item.image}
                              alt={item.title}
                              className="customer-booking-thumb"
                            />
                            <div className="customer-booking-info">
                              <h3 className="customer-booking-name">{item.title}</h3>
                              <div className="customer-booking-subtext">
                                <Calendar size={13} />
                                <span>{item.date}</span>
                              </div>
                              <div className="customer-booking-location">
                                <MapPin size={13} />
                                <span>{item.location}</span>
                              </div>
                            </div>
                          </div>

                          <div className="customer-booking-actions">
                            <span
                              className={
                                item.status === 'Confirmed'
                                  ? 'badge-confirmed'
                                  : item.status === 'Pending'
                                  ? 'badge-pending'
                                  : item.status === 'Completed'
                                  ? 'badge-completed'
                                  : 'badge-inprogress'
                              }
                            >
                              {item.status}
                            </span>
                            <button
                              className="customer-btn-details"
                              onClick={() => setSelectedBookingDetails(item)}
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Activity Box */}
                <div className="customer-card-box">
                  <div className="customer-card-box-header">
                    <h2 className="customer-card-title">Recent Activity</h2>
                    {dynamicRecentActivity.length > 0 && (
                      <button
                        className="customer-card-link"
                        onClick={() => setActiveTab('bookings')}
                      >
                        View all
                      </button>
                    )}
                  </div>

                  <div>
                    {dynamicRecentActivity.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '28px 16px', color: '#94a3b8', fontSize: '0.88rem' }}>
                        <Inbox size={36} color="#cbd5e1" style={{ marginBottom: '8px' }} />
                        <p style={{ margin: 0 }}>No recent activity recorded yet.</p>
                      </div>
                    ) : (
                      dynamicRecentActivity.map((act) => (
                        <div
                          key={act.id}
                          className="customer-activity-item"
                          onClick={() => setActiveTab('bookings')}
                        >
                          <div className="customer-activity-left">
                            <div
                              className="customer-activity-icon"
                              style={{
                                background:
                                  act.type === 'confirmed'
                                    ? '#dcfce7'
                                    : act.type === 'pending'
                                    ? '#fef3c7'
                                    : '#f3e8ff',
                                color:
                                  act.type === 'confirmed'
                                    ? '#15803d'
                                    : act.type === 'pending'
                                    ? '#b45309'
                                    : '#7e22ce',
                              }}
                            >
                              {act.type === 'confirmed' && <CheckCircle2 size={18} />}
                              {act.type === 'pending' && <Clock size={18} />}
                              {act.type === 'completed' && <CheckCircle2 size={18} />}
                            </div>
                            <div>
                              <p className="customer-activity-text">{act.text}</p>
                              <p className="customer-activity-time">{act.time}</p>
                            </div>
                          </div>
                          <ChevronRight size={16} color="#94a3b8" />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column (Banner + Quick Actions + Featured Venues) */}
              <div>
                {/* Banner Promo Box */}
                <div className="customer-promo-card">
                  <div style={{ flex: 1 }}>
                    <h2 className="customer-promo-title">Ready for your next event?</h2>
                    <p className="customer-promo-text">
                      Discover amazing venues, trusted vendors and make your event unforgettable.
                    </p>
                    <button
                      className="customer-promo-btn"
                      onClick={() => (onNavigate ? onNavigate('venues') : setActiveTab('venues'))}
                    >
                      <span>Browse Venues & Services</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <img
                    src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=400&q=80"
                    alt="Ready for next event"
                    className="customer-promo-img"
                  />
                </div>

                {/* Quick Actions Box */}
                <div className="customer-card-box">
                  <h2 className="customer-card-title" style={{ marginBottom: '16px' }}>
                    Quick Actions
                  </h2>

                  <div>
                    {/* Browse Services */}
                    <button
                      className="customer-quick-action"
                      onClick={() => (onNavigate ? onNavigate('vendors') : setActiveTab('services'))}
                    >
                      <div className="customer-action-left">
                        <div className="customer-action-icon" style={{ background: '#d1fae5', color: '#059669' }}>
                          <Search size={20} />
                        </div>
                        <div>
                          <div className="customer-action-title">Browse Services</div>
                          <div className="customer-action-sub">Find event services (catering, photography, etc.)</div>
                        </div>
                      </div>
                      <ChevronRight size={16} color="#94a3b8" />
                    </button>

                    {/* Browse Venues */}
                    <button
                      className="customer-quick-action"
                      onClick={() => (onNavigate ? onNavigate('venues') : setActiveTab('venues'))}
                    >
                      <div className="customer-action-left">
                        <div className="customer-action-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>
                          <MapPin size={20} />
                        </div>
                        <div>
                          <div className="customer-action-title">Browse Venues</div>
                          <div className="customer-action-sub">Explore beautiful event spaces</div>
                        </div>
                      </div>
                      <ChevronRight size={16} color="#94a3b8" />
                    </button>

                    {/* View My Bookings */}
                    <button
                      className="customer-quick-action"
                      onClick={() => setActiveTab('bookings')}
                    >
                      <div className="customer-action-left">
                        <div className="customer-action-icon" style={{ background: '#cffafe', color: '#0891b2' }}>
                          <Calendar size={20} />
                        </div>
                        <div>
                          <div className="customer-action-title">View My Bookings</div>
                          <div className="customer-action-sub">Check your booking requests and history</div>
                        </div>
                      </div>
                      <ChevronRight size={16} color="#94a3b8" />
                    </button>

                    {/* Send a Message */}
                    <button
                      className="customer-quick-action"
                      onClick={() => setActiveTab('messages')}
                    >
                      <div className="customer-action-left">
                        <div className="customer-action-icon" style={{ background: '#f3e8ff', color: '#9333ea' }}>
                          <MessageSquare size={20} />
                        </div>
                        <div>
                          <div className="customer-action-title">Send a Message</div>
                          <div className="customer-action-sub">Chat with vendors and venue owners</div>
                        </div>
                      </div>
                      <ChevronRight size={16} color="#94a3b8" />
                    </button>
                  </div>
                </div>

                {/* Featured Venues Box */}
                <div className="customer-card-box">
                  <div className="customer-card-box-header">
                    <h2 className="customer-card-title">Featured Venues</h2>
                    <button
                      className="customer-card-link"
                      onClick={() => (onNavigate ? onNavigate('venues') : setActiveTab('venues'))}
                    >
                      View all
                    </button>
                  </div>

                  {featuredVenuesList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                      No verified venues currently listed.
                    </div>
                  ) : (
                    <div className="customer-featured-row">
                      {featuredVenuesList.map((ven) => (
                        <div
                          key={ven.id}
                          className="customer-featured-card"
                          onClick={() => (onNavigate ? onNavigate('venues') : null)}
                        >
                          <img src={ven.image} alt={ven.name} className="customer-featured-img" />
                          <div className="customer-featured-body">
                            <div className="customer-featured-name">{ven.name}</div>
                            <div className="customer-featured-loc">
                              <MapPin size={10} />
                              <span>{ven.location}</span>
                            </div>
                            <div className="customer-featured-rating">
                              <Star size={11} fill="#f59e0b" color="#f59e0b" />
                              <span>
                                {ven.rating} ({ven.reviews})
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* My Events View */}
        {activeTab === 'events' && (
          <MyEventsView
            events={events}
            isLoading={isLoadingEvents}
            error={eventsError}
            onRetry={fetchEvents}
            currentUser={currentUser}
            onCreateEvent={handleCreateEvent}
            onUpdateEvent={handleUpdateEvent}
            onDeleteEvent={handleDeleteEvent}
            onNavigateTab={(tab) => {
              if (tab === 'vendors' && onNavigate) onNavigate('vendors');
              else if (tab === 'venues' && onNavigate) onNavigate('venues');
              else if (tab === 'bookings') setActiveTab('bookings');
              else if (tab === 'dashboard') setActiveTab('dashboard');
            }}
          />
        )}

        {/* Full Bookings Management View */}
        {activeTab === 'bookings' && (
          <div className="customer-content-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                  My Bookings
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.92rem' }}>
                  Manage, track, or cancel your venue reservations and vendor bookings.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => syncBookings(true)}
                  disabled={isRefreshingBookings}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: isRefreshingBookings ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  title="Check for live provider approvals and updates"
                >
                  <RotateCw size={15} className={isRefreshingBookings ? 'spin-animation' : ''} style={{ animation: isRefreshingBookings ? 'spin 1s linear infinite' : 'none' }} />
                  {isRefreshingBookings ? 'Checking...' : 'Refresh Status'}
                </button>
                <button
                  className="customer-promo-btn"
                  onClick={() => (onNavigate ? onNavigate('venues') : setActiveTab('dashboard'))}
                >
                  + Book New Venue / Vendor
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {['ALL', 'CONFIRMED', 'PENDING', 'COMPLETED', 'CANCELLED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setBookingFilterStatus(st)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    border: '1px solid',
                    cursor: 'pointer',
                    background: bookingFilterStatus === st ? '#0d8a73' : '#ffffff',
                    color: bookingFilterStatus === st ? '#ffffff' : '#475569',
                    borderColor: bookingFilterStatus === st ? '#0d8a73' : '#cbd5e1',
                    transition: 'all 0.2s',
                  }}
                >
                  {st === 'ALL' ? 'All Bookings' : st.charAt(0) + st.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Bookings List */}
            <div className="customer-card-box" style={{ padding: '8px 16px' }}>
              {upcomingDisplayList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b' }}>
                  <CalendarX size={44} color="#94a3b8" style={{ marginBottom: '12px' }} />
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', margin: '0 0 6px 0' }}>
                    No bookings found
                  </h4>
                  <p style={{ fontSize: '0.86rem', margin: '0 0 16px 0' }}>
                    You currently have no bookings under this status.
                  </p>
                  <button
                    className="customer-promo-btn"
                    onClick={() => (onNavigate ? onNavigate('venues') : null)}
                  >
                    Find Spaces & Services
                  </button>
                </div>
              ) : (
                upcomingDisplayList
                  .filter((item) => {
                    if (bookingFilterStatus === 'ALL') return true;
                    if (bookingFilterStatus === 'CONFIRMED') return item.status === 'Confirmed';
                    if (bookingFilterStatus === 'PENDING') return item.status === 'Pending';
                    if (bookingFilterStatus === 'COMPLETED') return item.status === 'Completed';
                    if (bookingFilterStatus === 'CANCELLED') return item.status === 'Cancelled';
                    return true;
                  })
                  .map((b) => (
                    <div
                      key={b.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px 0',
                        borderBottom: '1px solid #f1f5f9',
                        flexWrap: 'wrap',
                        gap: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <img
                          src={b.image}
                          alt={b.title}
                          style={{ width: '80px', height: '60px', borderRadius: '10px', objectFit: 'cover' }}
                        />
                        <div>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                            {b.title}
                          </h4>
                          <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <span>📅 {b.date}</span>
                            <span>📍 {b.location}</span>
                            <span style={{ fontWeight: 700, color: '#059669' }}>{b.price}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                          className={
                            b.status === 'Confirmed'
                              ? 'badge-confirmed'
                              : b.status === 'Pending'
                              ? 'badge-pending'
                              : b.status === 'Completed'
                              ? 'badge-completed'
                              : 'badge-cancelled'
                          }
                        >
                          {b.status}
                        </span>
                        <button
                          className="customer-btn-details"
                          onClick={() => setSelectedBookingDetails(b)}
                        >
                          Details
                        </button>
                        {b.status === 'Completed' && (
                          b.rawBooking?.has_reviewed ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 12px',
                                background: 'rgba(245, 158, 11, 0.12)',
                                color: '#b45309',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                              }}
                            >
                              <Star size={13} fill="#f59e0b" stroke="#f59e0b" /> Reviewed
                            </span>
                          ) : (
                            <button
                              style={{
                                background: '#0d8a73',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '6px 14px',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 5px rgba(13, 138, 115, 0.25)',
                                transition: 'all 0.2s ease',
                              }}
                              onClick={() => {
                                setReviewModalBooking(b.rawBooking);
                                setRatingScore(0);
                                setHoverRating(0);
                                setReviewComment('');
                              }}
                            >
                              <Star size={14} fill="#ffffff" stroke="#ffffff" /> Leave a Review
                            </button>
                          )
                        )}
                        <button
                          style={{
                            background: '#f0fdf4',
                            color: '#0d8a73',
                            border: '1px solid rgba(13, 138, 115, 0.25)',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                          onClick={() => handleStartChatWithBooking(b.rawBooking)}
                        >
                          <MessageSquare size={13} /> Chat Host
                        </button>
                        {b.status === 'Pending' && (
                          <button
                            style={{
                              background: '#fee2e2',
                              color: '#b91c1c',
                              border: '1px solid rgba(185, 28, 28, 0.2)',
                              borderRadius: '8px',
                              padding: '6px 12px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              if (window.confirm('Are you sure you want to cancel this booking request?')) {
                                onCancelBooking(b.id);
                                toast.success('Booking cancelled.');
                              }
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* My Reviews View (Phase 7) */}
        {activeTab === 'reviews' && (
          <div className="customer-content-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                  My Reviews & Ratings
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.92rem' }}>
                  Track your reviews and feedback shared with venues and event services.
                </p>
              </div>
            </div>

            <div className="customer-card-box" style={{ padding: '20px' }}>
              {loadingMyReviews ? (
                <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  Loading your submitted reviews...
                </div>
              ) : myReviews.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b' }}>
                  <Star size={44} color="#94a3b8" style={{ marginBottom: '12px' }} />
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', margin: '0 0 6px 0' }}>
                    No reviews submitted yet
                  </h4>
                  <p style={{ fontSize: '0.86rem', margin: '0 0 16px 0', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                    Once you complete a booking, you can share your feedback and help the community evaluate spaces and vendors!
                  </p>
                  <button
                    className="customer-promo-btn"
                    onClick={() => setActiveTab('bookings')}
                  >
                    View My Bookings
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {myReviews.map((rev) => (
                    <div
                      key={rev.id}
                      style={{
                        padding: '16px',
                        borderRadius: '12px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                            {rev.target_name || (rev.venue ? 'Venue' : 'Vendor Service')}
                          </h4>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            Reviewed on {new Date(rev.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '2px', color: '#f59e0b' }}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={16}
                              fill={s <= rev.rating ? '#f59e0b' : 'transparent'}
                              stroke={s <= rev.rating ? '#f59e0b' : '#cbd5e1'}
                            />
                          ))}
                        </div>
                      </div>
                      {rev.comment ? (
                        <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: '#334155', fontStyle: 'italic', lineHeight: 1.5 }}>
                          "{rev.comment}"
                        </p>
                      ) : (
                        <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No written comment provided.</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Messages View */}
        {activeTab === 'messages' && (() => {
          // Combine API conversations with any booking hosts
          const bookingContacts = localBookings
            .filter(b => b.provider_user_id || b.venue_details?.owner_user_id || b.vendor_details?.user)
            .map(b => {
              const pid = b.provider_user_id || b.venue_details?.owner_user_id || b.vendor_details?.user!;
              const name = b.venue_details?.title 
                ? `${b.venue_details.title} (${b.venue_details.owner_name || 'Host'})`
                : b.vendor_details?.business_name || 'Provider';
              return {
                partner_id: pid,
                partner_name: name,
                partner_username: b.venue_details?.owner_name || b.vendor_details?.business_name || 'Host',
                partner_role: b.venue ? 'VENUE_OWNER' : 'VENDOR',
                last_message: b.notes ? `Booking: ${b.notes}` : `Booking #${b.id} for ${b.event_title}`,
                last_message_at: b.created_at || '',
                unread_count: 0,
                booking_id: b.id,
                event_title: b.event_title,
                venue_title: b.venue_details?.title,
                vendor_name: b.vendor_details?.business_name,
              };
            });

          const contactMap = new Map<number, any>();
          conversations.forEach(c => contactMap.set(c.partner_id, c));
          bookingContacts.forEach(bc => {
            if (!contactMap.has(bc.partner_id)) {
              contactMap.set(bc.partner_id, bc);
            }
          });
          const allThreads = Array.from(contactMap.values());
          const activeThread = allThreads.find(t => t.partner_id === selectedPartnerId) || allThreads[0];
          const activePartnerId = activeThread?.partner_id;

          return (
            <div className="customer-content-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                    Messages
                  </h2>
                  <p style={{ color: '#64748b', fontSize: '0.92rem', margin: 0 }}>
                    Direct communication with your venue managers and event service providers.
                  </p>
                </div>
              </div>

              {allThreads.length === 0 ? (
                <div className="customer-card-box" style={{ textAlign: 'center', padding: '56px 24px' }}>
                  <Inbox size={48} color="#94a3b8" style={{ marginBottom: '14px' }} />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                    No conversations yet
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '0.88rem', maxWidth: '440px', margin: '0 auto 20px' }}>
                    You can start a chat directly from any booking card under "My Bookings" or reach out to hosts while exploring spaces.
                  </p>
                  <button
                    className="customer-promo-btn"
                    onClick={() => (onNavigate ? onNavigate('venues') : setActiveTab('dashboard'))}
                  >
                    Browse Venues & Services
                  </button>
                </div>
              ) : (
                <div
                  className="customer-card-box"
                  style={{
                    padding: 0,
                    display: 'grid',
                    gridTemplateColumns: '320px 1fr',
                    minHeight: '560px',
                    height: 'calc(100vh - 280px)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Left Column: Conversations List */}
                  <div
                    style={{
                      borderRight: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #e2e8f0',
                        fontWeight: 700,
                        color: '#0f172a',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>Conversations ({allThreads.length})</span>
                      {loadingConversations && (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Refreshing...</span>
                      )}
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {allThreads.map((thread) => {
                        const isSelected = activePartnerId === thread.partner_id;
                        const initial = (thread.partner_name || 'H').charAt(0).toUpperCase();

                        return (
                          <div
                            key={thread.partner_id}
                            onClick={() => {
                              setSelectedPartnerId(thread.partner_id);
                              fetchThreadMessages(thread.partner_id);
                            }}
                            style={{
                              padding: '14px 18px',
                              borderBottom: '1px solid #f1f5f9',
                              background: isSelected ? '#ffffff' : 'transparent',
                              cursor: 'pointer',
                              borderLeft: isSelected ? '4px solid #0d8a73' : '4px solid transparent',
                              transition: 'all 0.15s ease',
                              display: 'flex',
                              gap: '12px',
                              alignItems: 'flex-start',
                            }}
                          >
                            <div
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '50%',
                                background: '#ccfbf1',
                                color: '#0d8a73',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {initial}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {thread.partner_name}
                                </span>
                                {thread.last_message_at && (
                                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', flexShrink: 0, marginLeft: '6px' }}>
                                    {new Date(thread.last_message_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {thread.last_message || 'Click to start conversation'}
                              </div>
                              {thread.unread_count > 0 && (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    marginTop: '4px',
                                    background: '#ef4444',
                                    color: '#fff',
                                    borderRadius: '9999px',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '1px 7px',
                                  }}
                                >
                                  {thread.unread_count} new
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Chat Messages & Input */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      background: '#ffffff',
                      height: '100%',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Header */}
                    <div
                      style={{
                        padding: '16px 24px',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: '#0d8a73',
                            color: '#ffffff',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {(activeThread?.partner_name || 'H').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#0f172a' }}>
                            {activeThread?.partner_name || 'Host / Provider'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            {activeThread?.event_title ? `Event: ${activeThread.event_title}` : 'Verified Event Host'}
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
                        Active Chat
                      </span>
                    </div>

                    {/* Official In-Platform Policy Banner */}
                    <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: '#166534', fontWeight: 600 }}>
                      <CheckCircle2 size={14} color="#16a34a" /> In-Platform Official Communication: All inquiries & chats must stay strictly inside Locyfy. Off-platform communications are prohibited.
                    </div>

                    {/* Messages Scroll Area */}
                    <div
                      style={{
                        flex: 1,
                        padding: '24px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        background: '#fafafa',
                      }}
                    >
                      {loadingMessages && threadMessages.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                          Loading messages...
                        </div>
                      ) : threadMessages.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#94a3b8', margin: 'auto', padding: '24px' }}>
                          <MessageSquare size={36} color="#cbd5e1" style={{ marginBottom: '10px' }} />
                          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
                            No messages in this thread yet. Send a greeting to start coordinating!
                          </p>
                        </div>
                      ) : (
                        threadMessages.map((msg) => {
                          const isMe = currentUser?.id && msg.sender === currentUser.id;
                          return (
                            <div
                              key={msg.id}
                              style={{
                                alignSelf: isMe ? 'flex-end' : 'flex-start',
                                maxWidth: '72%',
                                background: isMe ? '#0d8a73' : '#ffffff',
                                color: isMe ? '#ffffff' : '#1e293b',
                                padding: '12px 16px',
                                borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                                fontSize: '0.9rem',
                                lineHeight: 1.5,
                                border: isMe ? 'none' : '1px solid #e2e8f0',
                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                              }}
                            >
                              {!isMe && (
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0d8a73', marginBottom: '3px' }}>
                                  {msg.sender_name || 'Host'}
                                </div>
                              )}
                              <div style={{ wordBreak: 'break-word' }}>{msg.content}</div>
                              <div
                                style={{
                                  fontSize: '0.7rem',
                                  color: isMe ? '#a7f3d0' : '#94a3b8',
                                  marginTop: '4px',
                                  textAlign: 'right',
                                }}
                              >
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Input Field */}
                    <div
                      style={{
                        padding: '16px 24px',
                        borderTop: '1px solid #e2e8f0',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'center',
                        background: '#ffffff',
                      }}
                    >
                      <input
                        type="text"
                        placeholder={`Message ${activeThread?.partner_name || 'host'}...`}
                        value={messageDraft}
                        onChange={(e) => setMessageDraft(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '12px 18px',
                          borderRadius: '9999px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '0.9rem',
                          outline: 'none',
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && messageDraft.trim() && !sendingDraft) {
                            handleSendMessage();
                          }
                        }}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={sendingDraft || !messageDraft.trim()}
                        style={{
                          background: '#0d8a73',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '9999px',
                          padding: '12px 20px',
                          fontWeight: 700,
                          fontSize: '0.9rem',
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
              )}
            </div>
          );
        })()}

        {/* Favorites View */}
        {activeTab === 'favorites' && (
          <div className="customer-content-container">
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
              My Saved Favorites
            </h2>
            <p style={{ color: '#64748b', marginBottom: '24px' }}>
              Venues and vendors you saved for your upcoming celebrations.
            </p>

            <div className="customer-card-box" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <Heart size={48} color="#94a3b8" style={{ marginBottom: '14px' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                No favorites saved yet
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto 20px' }}>
                Click the heart icon on any venue or vendor listing to save them here for quick access.
              </p>
              <button
                className="customer-promo-btn"
                onClick={() => (onNavigate ? onNavigate('venues') : null)}
              >
                Discover Spaces
              </button>
            </div>
          </div>
        )}

        {/* Profile View */}
        {activeTab === 'profile' && (
          <div className="customer-content-container">
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
              My Profile
            </h2>
            <p style={{ color: '#64748b', marginBottom: '24px' }}>
              Manage your personal information, contact credentials, and avatar.
            </p>

            <div className="customer-card-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
                <div style={{ width: '84px', height: '84px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '3px solid #0d8a73' }}>
                  {currentUser?.avatar_url || currentUser?.profile_picture ? (
                    <img
                      src={currentUser.avatar_url || currentUser.profile_picture}
                      alt="Profile"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <UserIcon size={38} color="#94a3b8" />
                  )}
                </div>
                <div>
                  <label
                    style={{
                      padding: '10px 18px',
                      background: '#0d8a73',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: isUploading ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.88rem',
                      opacity: isUploading ? 0.7 : 1,
                    }}
                  >
                    <Camera size={16} />
                    {isUploading ? 'Uploading...' : 'Upload Profile Picture'}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleProfilePictureUpload}
                      disabled={isUploading}
                    />
                  </label>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '6px 0 0 0' }}>
                    PNG, JPG or WEBP up to 5MB.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>Full Name</span>
                  <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>
                    {currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}` : displayName}
                  </strong>
                </div>

                <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>Username</span>
                  <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{currentUser?.username || 'Not logged in'}</strong>
                </div>

                <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>Email Address</span>
                  <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{currentUser?.email || 'Not provided'}</strong>
                </div>

                <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>Phone Number</span>
                  <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{currentUser?.phone_number || 'Not provided'}</strong>
                </div>

                <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>Account Role</span>
                  <strong style={{ color: '#0d8a73', fontSize: '0.95rem' }}>{currentUser?.role || 'CUSTOMER'}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings View */}
        {activeTab === 'settings' && (
          <div className="customer-content-container">
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
              Settings & Preferences
            </h2>
            <p style={{ color: '#64748b', marginBottom: '24px' }}>
              Configure your notifications, security, and account preferences.
            </p>

            <div className="customer-card-box">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                      Email Notifications
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                      Receive email updates whenever a booking status changes or you get a vendor message.
                    </p>
                  </div>
                  <input type="checkbox" defaultChecked style={{ width: '20px', height: '20px', accentColor: '#0d8a73' }} />
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                      SMS Alerts
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                      Receive instant SMS confirmations for approved venue dates.
                    </p>
                  </div>
                  <input type="checkbox" defaultChecked style={{ width: '20px', height: '20px', accentColor: '#0d8a73' }} />
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                      Locyfy Provider Mode
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                      Have a venue to host or event services to offer? Switch to provider mode.
                    </p>
                  </div>
                  <button
                    className="customer-btn-details"
                    onClick={() => {
                      if (onRequestRole) onRequestRole('PROVIDER');
                      else if (onNavigate) onNavigate('provider-dashboard');
                    }}
                  >
                    Open Provider Portal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Booking Details Modal */}
      {selectedBookingDetails && (
        <div className="customer-modal-backdrop" onClick={() => setSelectedBookingDetails(null)}>
          <div className="customer-modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ position: 'relative' }}>
              <img
                src={selectedBookingDetails.image}
                alt={selectedBookingDetails.title}
                style={{ width: '100%', height: '200px', objectFit: 'cover' }}
              />
              <button
                onClick={() => setSelectedBookingDetails(null)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'rgba(0,0,0,0.6)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 4px 0', color: '#0f172a' }}>
                    {selectedBookingDetails.title}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.85rem' }}>
                    <MapPin size={14} />
                    <span>{selectedBookingDetails.location}</span>
                  </div>
                </div>
                <span
                  className={
                    selectedBookingDetails.status === 'Confirmed'
                      ? 'badge-confirmed'
                      : selectedBookingDetails.status === 'Pending'
                      ? 'badge-pending'
                      : 'badge-inprogress'
                  }
                >
                  {selectedBookingDetails.status}
                </span>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Event Schedule</span>
                    <strong style={{ color: '#0f172a' }}>{selectedBookingDetails.date}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Total Amount</span>
                    <strong style={{ color: '#059669', fontSize: '1rem' }}>{selectedBookingDetails.price}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Target Category</span>
                    <strong style={{ color: '#0f172a' }}>{selectedBookingDetails.category}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Direct Contact</span>
                    <strong style={{ color: '#0f172a' }}>{selectedBookingDetails.contact}</strong>
                  </div>
                </div>

                {selectedBookingDetails.notes && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', fontSize: '0.84rem' }}>
                    <span style={{ color: '#64748b', display: 'block' }}>Notes & Instructions</span>
                    <span style={{ color: '#334155' }}>{selectedBookingDetails.notes}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                {selectedBookingDetails.status === 'Pending' && (
                  <button
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      background: '#fee2e2',
                      color: '#b91c1c',
                      border: '1px solid rgba(185, 28, 28, 0.2)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                    onClick={() => {
                      if (window.confirm('Cancel this booking request?')) {
                        onCancelBooking(selectedBookingDetails.id);
                        setSelectedBookingDetails(null);
                        toast.success('Booking cancelled.');
                      }
                    }}
                  >
                    Cancel Booking
                  </button>
                )}
                <button
                  className="customer-promo-btn"
                  onClick={() => {
                    setSelectedBookingDetails(null);
                    setActiveTab('messages');
                  }}
                >
                  <MessageSquare size={16} /> Contact Host
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Leave a Review Modal (Phase 5) */}
      {reviewModalBooking && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!submittingReview) setReviewModalBooking(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '520px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
              color: '#0f172a',
            }}
          >
            <button
              onClick={() => {
                if (!submittingReview) setReviewModalBooking(null);
              }}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b',
              }}
            >
              <X size={18} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(13, 138, 115, 0.1)',
                  color: '#0d8a73',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <Star size={28} fill="#0d8a73" stroke="#0d8a73" />
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 6px 0', color: '#0f172a' }}>
                Rate Your Experience
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>
                {reviewModalBooking.venue_details?.title || reviewModalBooking.vendor_details?.business_name || reviewModalBooking.event_title}
              </p>
            </div>

            {/* Star Rating Selector */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '10px' }}>
                Select Your Rating (1 to 5 Stars) *
              </span>
              <div style={{ display: 'inline-flex', gap: '8px', cursor: 'pointer' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      transition: 'transform 0.15s ease',
                      transform: (hoverRating || ratingScore) >= star ? 'scale(1.15)' : 'scale(1)',
                    }}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRatingScore(star)}
                  >
                    <Star
                      size={34}
                      fill={(hoverRating || ratingScore) >= star ? '#f59e0b' : 'transparent'}
                      stroke={(hoverRating || ratingScore) >= star ? '#f59e0b' : '#cbd5e1'}
                    />
                  </button>
                ))}
              </div>
              <div style={{ height: '22px', marginTop: '6px', fontSize: '0.85rem', fontWeight: 700, color: '#0d8a73' }}>
                {(hoverRating || ratingScore) === 1 && '1 Star — Poor'}
                {(hoverRating || ratingScore) === 2 && '2 Stars — Fair'}
                {(hoverRating || ratingScore) === 3 && '3 Stars — Good'}
                {(hoverRating || ratingScore) === 4 && '4 Stars — Very Good'}
                {(hoverRating || ratingScore) === 5 && '5 Stars — Excellent!'}
                {!(hoverRating || ratingScore) && <span style={{ color: '#94a3b8', fontWeight: 400 }}>Click a star to rate</span>}
              </div>
            </div>

            {/* Comment Area */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Written Review (Optional)
              </label>
              <textarea
                rows={4}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your detailed feedback about the service quality, amenities, professionalism, and atmosphere..."
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setReviewModalBooking(null)}
                disabled={submittingReview}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  background: '#f1f5f9',
                  border: 'none',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReview}
                disabled={submittingReview}
                style={{
                  padding: '10px 22px',
                  borderRadius: '10px',
                  background: '#0d8a73',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: submittingReview ? 'not-allowed' : 'pointer',
                  opacity: submittingReview ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 6px -1px rgba(13, 138, 115, 0.3)',
                }}
              >
                {submittingReview ? 'Submitting...' : 'Submit Verified Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
