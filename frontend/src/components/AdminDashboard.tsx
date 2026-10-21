import React, { useState, useEffect } from 'react';
import type { Venue, Vendor, VenueOwner, VerificationStatus, User, Booking, Review, PlatformStats, BookingStatus, VerificationDocument } from '../types';
import { 
  ShieldCheck, Building2, UserCheck, 
  X, Eye, Clock, MapPin, ExternalLink,
  Users, Calendar, Star, Trash2, Edit3, RefreshCw,
  Search, CheckCircle2, ArrowUpRight, DollarSign,
  UserX, Shield, AlertCircle, ShieldAlert, Lock, ArrowLeft, FileText, AlertTriangle, Menu
} from 'lucide-react';
import { ApiService } from '../services/api';
import { toast } from 'react-hot-toast';
import { AdminSidebar } from './AdminSidebar';
import type { AdminMenuItemId } from './AdminSidebar';
import './admin-sidebar.css';

interface AdminDashboardProps {
  venues: Venue[];
  vendors: Vendor[];
  onToggleVerifyVenue?: (id: number) => void;
  onToggleVerifyVendor: (id: number) => void;
  onRefreshVendors?: () => void;
  currentUser?: User | null;
  onNavigateHome?: () => void;
  onLoginClick?: () => void;
  onLogout?: () => void;
  onDataChange?: () => void;
}

interface UnifiedAccount {
  id: number;
  business_name: string;
  account_type: 'Vendor' | 'Venue Owner';
  category_or_type: string;
  location: string;
  address?: string;
  description?: string;
  email?: string;
  phone?: string;
  years_in_business?: number;
  website_url?: string;
  logo_url?: string;
  verification_status: VerificationStatus;
  is_verified: boolean;
  created_at?: string;
  rawItem: Vendor | VenueOwner;
}

type AdminTab = 'overview' | 'users' | 'bookings' | 'venues' | 'verifications' | 'reviews' | 'analytics' | 'settings';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  venues: propVenues,
  vendors: propVendors,
  onToggleVerifyVenue: _onToggleVerifyVenue,
  onToggleVerifyVendor,
  currentUser,
  onNavigateHome,
  onLoginClick,
  onLogout,
  onDataChange,
}) => {
  const isAdmin = Boolean(currentUser && (
    currentUser.role === 'ADMIN' || 
    currentUser.is_staff || 
    currentUser.is_superuser
  ));

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshingRatings, setRefreshingRatings] = useState(false);

  // Data states
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [venues, setVenues] = useState<Venue[]>(propVenues);
  const [vendors, setVendors] = useState<Vendor[]>(propVendors);
  const [venueOwners, setVenueOwners] = useState<VenueOwner[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  // Filter & Search states
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');

  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('ALL');

  const [venueSearch, setVenueSearch] = useState('');
  const [venueCategoryFilter, setVenueCategoryFilter] = useState<string>('ALL');
  const [venueApprovalFilter, setVenueApprovalFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [inspectVenueModal, setInspectVenueModal] = useState<Venue | null>(null);
  const [rejectVenueModal, setRejectVenueModal] = useState<Venue | null>(null);
  const [venueRejectReason, setVenueRejectReason] = useState<string>('');

  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewRatingFilter, setReviewRatingFilter] = useState<string>('ALL');

  const [verificationStatusFilter, setVerificationStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [verificationTypeFilter, setVerificationTypeFilter] = useState<'ALL' | 'VENDOR' | 'VENUE_OWNER'>('ALL');

  // Verification Documents State
  const [verificationDocuments, setVerificationDocuments] = useState<VerificationDocument[]>([]);
  const [docSearch, setDocSearch] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState<string>('ALL');
  const [docStatusFilter, setDocStatusFilter] = useState<string>('ALL');
  const [rejectingDocModal, setRejectingDocModal] = useState<VerificationDocument | null>(null);
  const [docRejectionReason, setDocRejectionReason] = useState<string>('');
  const [docAdminNotes, setDocAdminNotes] = useState<string>('');
  const [submittingDocReview, setSubmittingDocReview] = useState(false);

  // Modals
  const [selectedAccount, setSelectedAccount] = useState<UnifiedAccount | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newRoleSelection, setNewRoleSelection] = useState<string>('CUSTOMER');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'user' | 'booking' | 'venue' | 'review';
    id: number;
    title: string;
  } | null>(null);

  // Initial load
  const loadAdminData = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [fetchedStats, fetchedUsers, fetchedBookings, fetchedReviews, fetchedOwners, fetchedVendors, fetchedVenues, fetchedDocs] = await Promise.all([
        ApiService.getStats(),
        ApiService.getUsers(undefined, currentUser?.id),
        ApiService.getBookings(),
        ApiService.getReviews(),
        ApiService.getVenueOwners(),
        ApiService.getVendors({ all_status: true }),
        ApiService.getVenues({ all_status: true }),
        ApiService.getVerificationDocuments()
      ]);

      if (fetchedStats) setStats(fetchedStats);
      if (fetchedUsers) setUsers(fetchedUsers);
      if (fetchedBookings) setBookings(fetchedBookings);
      if (fetchedReviews) setReviews(fetchedReviews);
      if (fetchedOwners) setVenueOwners(fetchedOwners);
      if (fetchedVendors) setVendors(fetchedVendors);
      if (fetchedVenues) setVenues(fetchedVenues);
      if (fetchedDocs) setVerificationDocuments(fetchedDocs);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      toast.error('Failed to load some dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (propVenues && propVenues.length > 0) setVenues(propVenues);
  }, [propVenues]);

  useEffect(() => {
    if (propVendors && propVendors.length > 0) setVendors(propVendors);
  }, [propVendors]);

  // Handle Refresh Ratings
  const handleRefreshRatings = async () => {
    setRefreshingRatings(true);
    const toastId = toast.loading('Recalculating review averages across platform...');
    try {
      const ok = await ApiService.refreshAllRatings();
      if (ok) {
        toast.success('Ratings & review statistics refreshed successfully!', { id: toastId });
        const [v, ven, s, r] = await Promise.all([
          ApiService.getVenues(),
          ApiService.getVendors(),
          ApiService.getStats(),
          ApiService.getReviews()
        ]);
        setVenues(v);
        setVendors(ven);
        setStats(s);
        setReviews(r);
      } else {
        toast.error('Failed to recalculate ratings.', { id: toastId });
      }
    } catch (e) {
      toast.error('Error occurred while recalculating ratings.', { id: toastId });
    } finally {
      setRefreshingRatings(false);
    }
  };

  // User Management Handlers
  const handleToggleUserActive = async (user: User) => {
    const toastId = toast.loading(`${user.is_active !== false ? 'Deactivating' : 'Activating'} ${user.username}...`);
    try {
      const updated = await ApiService.toggleUserActive(user.id);
      if (updated) {
        setUsers(prev => prev.map(u => u.id === user.id ? updated : u));
        toast.success(`User ${updated.username} is now ${updated.is_active ? 'active' : 'deactivated'}.`, { id: toastId });
      } else {
        toast.error('Failed to update user status.', { id: toastId });
      }
    } catch (e) {
      toast.error('Error updating user status.', { id: toastId });
    }
  };

  const handleSaveUserRole = async () => {
    if (!editingUser) return;
    const toastId = toast.loading(`Updating role for ${editingUser.username}...`);
    try {
      const updated = await ApiService.updateUserRole(editingUser.id, newRoleSelection);
      if (updated) {
        setUsers(prev => prev.map(u => u.id === editingUser.id ? updated : u));
        toast.success(`Role updated to ${updated.role} successfully!`, { id: toastId });
        setEditingUser(null);
      } else {
        toast.error('Failed to update role.', { id: toastId });
      }
    } catch (e) {
      toast.error('Error updating role.', { id: toastId });
    }
  };

  const handleDeleteUser = async (id: number) => {
    const toastId = toast.loading('Deleting user account...');
    try {
      const ok = await ApiService.deleteUser(id);
      if (ok) {
        setUsers(prev => prev.filter(u => u.id !== id));
        toast.success('User deleted successfully.', { id: toastId });
      } else {
        toast.error('Failed to delete user.', { id: toastId });
      }
    } catch (e) {
      toast.error('Error deleting user.', { id: toastId });
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Booking Handlers
  const handleUpdateBookingStatus = async (bookingId: number, status: BookingStatus) => {
    const toastId = toast.loading(`Marking booking #${bookingId} as ${status}...`);
    try {
      const res = await ApiService.updateBookingStatus(bookingId, status);
      if (res.success) {
        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b));
        if (selectedBooking && selectedBooking.id === bookingId) {
          setSelectedBooking(prev => prev ? { ...prev, status } : null);
        }
        toast.success(`Booking #${bookingId} is now ${status}.`, { id: toastId });
        // Refresh stats
        const updatedStats = await ApiService.getStats();
        if (updatedStats) setStats(updatedStats);
      } else {
        toast.error(res.error || 'Failed to update booking status.', { id: toastId });
      }
    } catch (e) {
      toast.error('Error updating booking.', { id: toastId });
    }
  };

  const handleDeleteBooking = async (id: number) => {
    const toastId = toast.loading(`Deleting booking #${id}...`);
    try {
      const ok = await ApiService.deleteBooking(id);
      if (ok) {
        setBookings(prev => prev.filter(b => b.id !== id));
        if (selectedBooking?.id === id) setSelectedBooking(null);
        toast.success('Booking deleted successfully.', { id: toastId });
        const updatedStats = await ApiService.getStats();
        if (updatedStats) setStats(updatedStats);
      } else {
        toast.error('Failed to delete booking.', { id: toastId });
      }
    } catch (e) {
      toast.error('Error deleting booking.', { id: toastId });
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Venue Moderation Handlers
  const handleToggleVenueAvailability = async (venueId: number) => {
    try {
      const ok = await ApiService.toggleVenueAvailability(venueId);
      if (ok) {
        setVenues(prev => prev.map(v => v.id === venueId ? { ...v, is_available: !v.is_available } : v));
        toast.success('Venue availability updated.');
        onDataChange?.();
      } else {
        toast.error('Failed to update availability.');
      }
    } catch (e) {
      toast.error('Error updating availability.');
    }
  };

  const handleDeleteVenue = async (id: number) => {
    const toastId = toast.loading('Deleting venue listing...');
    try {
      const ok = await ApiService.deleteVenue(id);
      if (ok) {
        setVenues(prev => prev.filter(v => v.id !== id));
        toast.success('Venue listing deleted.', { id: toastId });
        const updatedStats = await ApiService.getStats();
        if (updatedStats) setStats(updatedStats);
        onDataChange?.();
      } else {
        toast.error('Failed to delete venue.', { id: toastId });
      }
    } catch (e) {
      toast.error('Error deleting venue.', { id: toastId });
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Review Handlers
  const handleDeleteReview = async (id: number) => {
    const toastId = toast.loading('Deleting review...');
    try {
      const ok = await ApiService.deleteReview(id);
      if (ok) {
        setReviews(prev => prev.filter(r => r.id !== id));
        toast.success('Review removed and ratings updated.', { id: toastId });
        // Re-fetch venue and vendor lists to get updated ratings
        const [v, ven, s] = await Promise.all([
          ApiService.getVenues(),
          ApiService.getVendors(),
          ApiService.getStats()
        ]);
        setVenues(v);
        setVendors(ven);
        if (s) setStats(s);
      } else {
        toast.error('Failed to delete review.', { id: toastId });
      }
    } catch (e) {
      toast.error('Error deleting review.', { id: toastId });
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Verification Queue Handlers
  const handleApproveAccount = async (account: UnifiedAccount) => {
    const toastId = toast.loading(`Approving ${account.business_name}...`);
    try {
      if (account.account_type === 'Vendor') {
        const res = await ApiService.setVendorVerificationStatus(account.id, 'APPROVED');
        if (res) {
          setVendors(prev => prev.map(v => v.id === account.id ? { ...v, verification_status: 'APPROVED', is_verified: true } : v));
        } else {
          await onToggleVerifyVendor(account.id);
          setVendors(prev => prev.map(v => v.id === account.id ? { ...v, verification_status: 'APPROVED', is_verified: true } : v));
        }
      } else {
        const res = await ApiService.setVenueOwnerVerificationStatus(account.id, 'APPROVED');
        if (res) {
          setVenueOwners(prev => prev.map(o => o.id === account.id ? { ...o, verification_status: 'APPROVED', is_verified: true } : o));
        } else {
          await ApiService.toggleVerifyVenueOwner(account.id);
          setVenueOwners(prev => prev.map(o => o.id === account.id ? { ...o, verification_status: 'APPROVED', is_verified: true } : o));
        }
      }

      // Interconnect: sync all venues and services linked to this approved provider
      setVenues(prev => prev.map(v => {
        const vOwnerId = typeof v.owner === 'object' ? (v.owner as any)?.id : v.owner;
        const vVendorId = typeof v.vendor === 'object' ? (v.vendor as any)?.id : v.vendor;
        if ((account.account_type === 'Vendor' && vVendorId === account.id) ||
            (account.account_type === 'Venue Owner' && vOwnerId === account.id)) {
          return { ...v, is_verified: true };
        }
        return v;
      }));

      if (selectedAccount && selectedAccount.id === account.id) {
        setSelectedAccount(prev => prev ? { ...prev, verification_status: 'APPROVED', is_verified: true } : null);
      }
      toast.success(`${account.business_name} approved with verified badge!`, { id: toastId });
      const updatedStats = await ApiService.getStats();
      if (updatedStats) setStats(updatedStats);
      onDataChange?.();
    } catch (e) {
      toast.error('Failed to approve account.', { id: toastId });
    }
  };

  const handleRejectAccount = async (account: UnifiedAccount) => {
    const toastId = toast.loading(`Rejecting ${account.business_name}...`);
    try {
      if (account.account_type === 'Vendor') {
        const res = await ApiService.setVendorVerificationStatus(account.id, 'REJECTED');
        if (res) {
          setVendors(prev => prev.map(v => v.id === account.id ? { ...v, verification_status: 'REJECTED', is_verified: false } : v));
        } else {
          setVendors(prev => prev.map(v => v.id === account.id ? { ...v, verification_status: 'REJECTED', is_verified: false } : v));
        }
      } else {
        const res = await ApiService.setVenueOwnerVerificationStatus(account.id, 'REJECTED');
        if (res) {
          setVenueOwners(prev => prev.map(o => o.id === account.id ? { ...o, verification_status: 'REJECTED', is_verified: false } : o));
        } else {
          setVenueOwners(prev => prev.map(o => o.id === account.id ? { ...o, verification_status: 'REJECTED', is_verified: false } : o));
        }
      }

      // Interconnect: sync all venues and services linked to this rejected provider
      setVenues(prev => prev.map(v => {
        const vOwnerId = typeof v.owner === 'object' ? (v.owner as any)?.id : v.owner;
        const vVendorId = typeof v.vendor === 'object' ? (v.vendor as any)?.id : v.vendor;
        if ((account.account_type === 'Vendor' && vVendorId === account.id) ||
            (account.account_type === 'Venue Owner' && vOwnerId === account.id)) {
          return { ...v, is_verified: false };
        }
        return v;
      }));

      if (selectedAccount && selectedAccount.id === account.id) {
        setSelectedAccount(prev => prev ? { ...prev, verification_status: 'REJECTED', is_verified: false } : null);
      }
      toast.success(`${account.business_name} application marked as rejected.`, { id: toastId });
      const updatedStats = await ApiService.getStats();
      if (updatedStats) setStats(updatedStats);
      onDataChange?.();
    } catch (e) {
      toast.error('Failed to reject account.', { id: toastId });
    }
  };

  // Normalize Unified Accounts for Verification
  const unifiedAccounts: UnifiedAccount[] = [
    ...vendors.map(v => ({
      id: v.id,
      business_name: v.business_name,
      account_type: 'Vendor' as const,
      category_or_type: v.vendor_type_display || v.vendor_type,
      location: v.location,
      address: v.address,
      description: v.description,
      email: v.contact_email,
      phone: v.contact_phone,
      years_in_business: v.years_in_business,
      website_url: v.website_url,
      logo_url: v.logo_url,
      verification_status: (v.verification_status || (v.is_verified ? 'APPROVED' : 'PENDING')) as VerificationStatus,
      is_verified: v.is_verified,
      created_at: v.created_at,
      rawItem: v,
    })),
    ...venueOwners.map(o => ({
      id: o.id,
      business_name: o.business_name,
      account_type: 'Venue Owner' as const,
      category_or_type: o.business_type || 'Event Venue',
      location: o.location || '',
      address: o.address,
      description: o.description,
      email: o.contact_email,
      phone: o.contact_phone,
      years_in_business: o.years_in_business,
      website_url: o.website_url,
      logo_url: o.logo_url,
      verification_status: (o.verification_status || (o.is_verified ? 'APPROVED' : 'PENDING')) as VerificationStatus,
      is_verified: o.is_verified,
      created_at: o.created_at,
      rawItem: o,
    })),
  ];

  const filteredAccounts = unifiedAccounts.filter(acc => {
    if (verificationStatusFilter !== 'ALL' && acc.verification_status !== verificationStatusFilter) return false;
    if (verificationTypeFilter === 'VENDOR' && acc.account_type !== 'Vendor') return false;
    if (verificationTypeFilter === 'VENUE_OWNER' && acc.account_type !== 'Venue Owner') return false;
    return true;
  });

  const pendingVerificationCount = unifiedAccounts.filter(a => a.verification_status === 'PENDING').length;

  // Filtered lists
  const filteredUsers = users.filter(u => {
    if (userRoleFilter !== 'ALL' && u.role !== userRoleFilter) return false;
    if (userSearch) {
      const q = userSearch.toLowerCase();
      const matchName = (u.first_name || '').toLowerCase().includes(q) || (u.last_name || '').toLowerCase().includes(q);
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      const matchUsername = (u.username || '').toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchUsername) return false;
    }
    return true;
  });

  const filteredBookings = bookings.filter(b => {
    if (bookingStatusFilter !== 'ALL' && b.status !== bookingStatusFilter) return false;
    if (bookingSearch) {
      const q = bookingSearch.toLowerCase();
      const matchTitle = (b.event_title || '').toLowerCase().includes(q);
      const matchCustomer = (b.customer_name || '').toLowerCase().includes(q) || (b.customer_email || '').toLowerCase().includes(q);
      const matchVenue = (b.venue_details?.title || '').toLowerCase().includes(q);
      const matchVendor = (b.vendor_details?.business_name || '').toLowerCase().includes(q);
      if (!matchTitle && !matchCustomer && !matchVenue && !matchVendor) return false;
    }
    return true;
  });

  const filteredVenues = venues.filter(v => {
    if (venueCategoryFilter !== 'ALL' && v.category !== venueCategoryFilter) return false;
    const status = v.approval_status || (v.is_verified ? 'APPROVED' : 'PENDING');
    if (venueApprovalFilter !== 'ALL' && status !== venueApprovalFilter) return false;
    if (venueSearch) {
      const q = venueSearch.toLowerCase();
      const matchTitle = (v.title || '').toLowerCase().includes(q);
      const matchLocation = (v.location || '').toLowerCase().includes(q);
      if (!matchTitle && !matchLocation) return false;
    }
    return true;
  });

  const filteredReviews = reviews.filter(r => {
    if (reviewRatingFilter !== 'ALL' && r.rating !== parseInt(reviewRatingFilter)) return false;
    if (reviewSearch) {
      const q = reviewSearch.toLowerCase();
      const matchUser = (r.user_name || '').toLowerCase().includes(q);
      const matchComment = (r.comment || '').toLowerCase().includes(q);
      const matchTarget = (r.target_name || '').toLowerCase().includes(q);
      if (!matchUser && !matchComment && !matchTarget) return false;
    }
    return true;
  });

  if (!isAdmin) {
    return (
      <div style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        background: '#f8fafc',
      }}>
        <div style={{
          maxWidth: '540px',
          width: '100%',
          background: '#ffffff',
          borderRadius: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02)',
          padding: '48px 36px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <div style={{
            width: '76px',
            height: '76px',
            borderRadius: '22px',
            background: '#fee2e2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '22px',
            boxShadow: '0 8px 16px rgba(220, 38, 38, 0.12)',
          }}>
            <ShieldAlert size={40} />
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 14px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '999px',
            color: '#b91c1c',
            fontSize: '0.78rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '14px',
          }}>
            <Lock size={13} /> Administrator Authorization Required
          </div>

          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: '0 0 12px', letterSpacing: '-0.5px' }}>
            Restricted Admin Portal
          </h2>

          <p style={{ color: '#64748b', fontSize: '0.94rem', lineHeight: 1.6, margin: '0 0 28px' }}>
            {currentUser ? (
              <>
                You are currently signed in as <strong style={{ color: '#0f172a' }}>{currentUser.email}</strong> (Role: <span style={{ color: '#0d8a73', fontWeight: 700 }}>{currentUser.role}</span>). Only platform administrators have permission to access the Administrator Dashboard.
              </>
            ) : (
              <>
                Only platform administrators can access this section. Please sign in with your verified administrator credentials to view management and operations tools.
              </>
            )}
          </p>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
            {onNavigateHome && (
              <button
                onClick={onNavigateHome}
                style={{
                  padding: '12px 22px',
                  borderRadius: '12px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                }}
              >
                <ArrowLeft size={16} /> Return to Home
              </button>
            )}

            <button
              onClick={() => {
                if (onLoginClick) onLoginClick();
              }}
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                background: '#0d8a73',
                border: 'none',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 10px rgba(13, 138, 115, 0.25)',
                transition: 'all 0.15s ease',
              }}
            >
              <ShieldCheck size={18} /> {currentUser ? 'Switch to Admin Account' : 'Log In as Administrator'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-wrapper">
      {/* 1. Left Fixed Sidebar */}
      <AdminSidebar
        activeItem={activeTab as AdminMenuItemId}
        onSelectItem={(item) => setActiveTab(item as AdminTab)}
        currentUser={currentUser}
        onNavigateHome={onNavigateHome}
        onLogout={onLogout}
        isMobileOpen={isMobileSidebarOpen}
        onToggleMobile={() => setIsMobileSidebarOpen(prev => !prev)}
        badgeCounts={{
          users: users.length,
          bookings: bookings.length,
          venues: venues.length,
          verifications: pendingVerificationCount,
          reviews: reviews.length,
        }}
      />

      {/* 2. Main Viewport (Scrolls independently) */}
      <div className="admin-main-viewport">
        {/* Mobile Header Bar with Hamburger */}
        <header className="admin-mobile-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="admin-mobile-toggle-btn"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open sidebar menu"
            >
              <Menu size={20} />
            </button>
            <span className="admin-mobile-title">Admin Console</span>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#5eead4', fontWeight: 700, textTransform: 'uppercase' }}>
            {activeTab}
          </span>
        </header>

        <div className="admin-dashboard-container">
      {/* Top Banner & Title */}
      <div style={{
        background: 'linear-gradient(135deg, #0d8a73 0%, #065f46 100%)',
        borderRadius: '20px',
        padding: '32px 36px',
        color: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        boxShadow: '0 10px 25px -5px rgba(13, 138, 115, 0.3)',
        marginBottom: '28px',
      }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.2)', padding: '4px 12px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '12px' }}>
            <ShieldCheck size={16} /> Admin Command Center {currentUser?.username ? `• Logged in as ${currentUser.username}` : ''}
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.5px' }}>
            Platform Administration
          </h1>
          <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.95rem', maxWidth: '600px' }}>
            Manage platform users, moderate venue spaces, oversee bookings, verify vendor credentials, and monitor live reviews.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={handleRefreshRatings}
            disabled={refreshingRatings}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#ffffff',
              color: '#0d8a73',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: refreshingRatings ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s',
            }}
          >
            <RefreshCw size={16} className={refreshingRatings ? 'spin' : ''} />
            {refreshingRatings ? 'Recalculating...' : 'Refresh Ratings'}
          </button>
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                padding: '10px 18px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
              }}
            >
              Back to Site
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '12px 20px', background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '10px', color: '#0d8a73', fontWeight: 600, fontSize: '0.88rem', marginBottom: '20px' }}>
          Refreshing platform data and user accounts...
        </div>
      )}

      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {activeTab === 'overview' && (
        <div>
          {/* Metrics Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '18px',
            marginBottom: '32px',
          }}>
            {/* Total Revenue */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Gross Revenue</span>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign size={20} />
                </div>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1e293b', marginTop: '12px' }}>
                KES {(stats?.total_revenue || 0).toLocaleString()}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>
                From confirmed & completed bookings
              </p>
            </div>

            {/* Total Bookings */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Bookings</span>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={20} />
                </div>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1e293b', marginTop: '12px' }}>
                {stats?.total_bookings ?? bookings.length}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                <span><strong>{stats?.approved_bookings ?? bookings.filter(b => b.status === 'APPROVED').length}</strong> Approved</span> •
                <span><strong>{stats?.pending_bookings ?? bookings.filter(b => b.status === 'PENDING').length}</strong> Pending</span>
              </div>
            </div>

            {/* Total Users */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Users</span>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={20} />
                </div>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1e293b', marginTop: '12px' }}>
                {stats?.total_users ?? users.length}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                <span><strong>{stats?.total_customers ?? users.filter(u => u.is_customer).length}</strong> Clients</span> •
                <span><strong>{stats?.total_providers ?? users.filter(u => u.is_vendor || u.is_venue_owner || u.role === 'PROVIDER').length}</strong> Providers</span>
              </div>
            </div>

            {/* Pending Verifications */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Pending Review</span>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={20} />
                </div>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#d97706', marginTop: '12px' }}>
                {pendingVerificationCount}
              </div>
              <button
                onClick={() => setActiveTab('verifications')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  marginTop: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#0d8a73',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                Review Applications <ArrowUpRight size={14} />
              </button>
            </div>

            {/* Platform Average Rating */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Platform Rating</span>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fffbeb', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Star size={20} fill="#f59e0b" />
                </div>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1e293b', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {stats?.avg_rating || 4.9} <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 600 }}>/ 5.0</span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Across <strong>{stats?.total_reviews ?? reviews.length}</strong> verified reviews
              </p>
            </div>
          </div>

          {/* Recent Bookings & Pending Verifications Split */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
            {/* Recent Bookings Box */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Recent Event Bookings</h3>
                <button
                  onClick={() => setActiveTab('bookings')}
                  style={{ background: 'none', border: 'none', color: '#0d8a73', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  View All ({bookings.length}) →
                </button>
              </div>

              {bookings.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', padding: '24px 0' }}>No bookings registered yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {bookings.slice(0, 5).map(b => (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBooking(b)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: '1px solid #f1f5f9',
                        background: '#f8fafc',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>
                          {b.event_title}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                          By {b.customer_name} • {b.event_date} • KES {Number(b.total_price).toLocaleString()}
                        </div>
                      </div>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: b.status === 'APPROVED' ? '#ecfdf5' : b.status === 'PENDING' ? '#fef3c7' : b.status === 'COMPLETED' ? '#eff6ff' : '#fee2e2',
                        color: b.status === 'APPROVED' ? '#059669' : b.status === 'PENDING' ? '#b45309' : b.status === 'COMPLETED' ? '#2563eb' : '#dc2626',
                      }}>
                        {b.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Provider Verifications Box */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Businesses Awaiting Review</h3>
                <button
                  onClick={() => setActiveTab('verifications')}
                  style={{ background: 'none', border: 'none', color: '#0d8a73', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Go to Queue ({pendingVerificationCount}) →
                </button>
              </div>

              {pendingVerificationCount === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: '#059669' }}>
                  <CheckCircle2 size={36} style={{ margin: '0 auto 8px' }} />
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>All Caught Up!</p>
                  <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.82rem' }}>No pending businesses awaiting approval.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {unifiedAccounts.filter(a => a.verification_status === 'PENDING').slice(0, 5).map(acc => (
                    <div
                      key={`${acc.account_type}-${acc.id}`}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: '1px solid #fef3c7',
                        background: '#fffbeb',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>
                          {acc.business_name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#78350f', marginTop: '2px' }}>
                          {acc.account_type} • {acc.category_or_type} • {acc.location}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => setSelectedAccount(acc)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: '#0d8a73',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Inspect
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USERS MANAGEMENT */}
      {activeTab === 'users' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          {/* Header & Filters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e293b', margin: '0 0 4px' }}>Registered User Accounts</h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>View, activate, deactivate, or modify access levels for platform accounts.</p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search user, email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={{
                    padding: '8px 14px 8px 36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    outline: 'none',
                    width: '220px',
                  }}
                />
              </div>

              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  outline: 'none',
                  background: '#fff',
                  fontWeight: 600,
                  color: '#334155',
                }}
              >
                <option value="ALL">All Roles</option>
                <option value="CUSTOMER">Customers</option>
                <option value="PROVIDER">Business Providers</option>
                <option value="ADMIN">Administrators</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>User / Email</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Assigned Role</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Joined Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                      No users match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#ccfbf1', color: '#0d8a73', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
                            {u.username[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#1e293b' }}>
                              {u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.username}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{u.email || u.username}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: u.role === 'ADMIN' ? '#f5f3ff' : u.role === 'PROVIDER' ? '#ecfdf5' : '#eff6ff',
                          color: u.role === 'ADMIN' ? '#7c3aed' : u.role === 'PROVIDER' ? '#059669' : '#2563eb',
                        }}>
                          {u.role === 'ADMIN' && <Shield size={12} />}
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '0.82rem' }}>
                        {u.date_joined ? new Date(u.date_joined).toLocaleDateString() : 'N/A'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: u.is_active !== false ? '#ecfdf5' : '#fee2e2',
                          color: u.is_active !== false ? '#059669' : '#dc2626',
                        }}>
                          {u.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              setEditingUser(u);
                              setNewRoleSelection(u.role || 'CUSTOMER');
                            }}
                            title="Edit Role"
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              color: '#334155',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            <Edit3 size={13} /> Edit Role
                          </button>

                          <button
                            onClick={() => handleToggleUserActive(u)}
                            title={u.is_active !== false ? 'Deactivate Account' : 'Activate Account'}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: u.is_active !== false ? '#fff1f2' : '#ecfdf5',
                              color: u.is_active !== false ? '#e11d48' : '#059669',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            {u.is_active !== false ? <UserX size={13} /> : <UserCheck size={13} />}
                            {u.is_active !== false ? 'Deactivate' : 'Activate'}
                          </button>

                          <button
                            onClick={() => setDeleteConfirm({ type: 'user', id: u.id, title: u.username })}
                            title="Delete User"
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid #fecdd3',
                              background: '#fff',
                              color: '#ef4444',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BOOKINGS MANAGEMENT */}
      {activeTab === 'bookings' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e293b', margin: '0 0 4px' }}>Platform Bookings Moderation</h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>View client reservations, inspect financial totals, and override approval or cancellation states.</p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search title, venue, client..."
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                  style={{
                    padding: '8px 14px 8px 36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    outline: 'none',
                    width: '230px',
                  }}
                />
              </div>

              <select
                value={bookingStatusFilter}
                onChange={(e) => setBookingStatusFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  outline: 'none',
                  background: '#fff',
                  fontWeight: 600,
                  color: '#334155',
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>ID & Event</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Reserved Listing</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Customer</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Date & Guests</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Total Price</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                      No bookings found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map(b => (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>#{b.id} {b.event_title}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Type: {b.event_type}</div>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#334155' }}>
                        {b.venue_details?.title || b.vendor_details?.business_name || (b.venue ? `Venue #${b.venue}` : `Vendor #${b.vendor}`)}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{b.customer_name}</div>
                        {b.customer_email && <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{b.customer_email}</div>}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#64748b' }}>
                        <div>{b.event_date}</div>
                        <div style={{ fontSize: '0.78rem' }}>{b.guest_count} attendees</div>
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0d8a73' }}>
                        KES {Number(b.total_price).toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: b.status === 'APPROVED' ? '#ecfdf5' : b.status === 'PENDING' ? '#fef3c7' : b.status === 'COMPLETED' ? '#eff6ff' : '#fee2e2',
                          color: b.status === 'APPROVED' ? '#059669' : b.status === 'PENDING' ? '#b45309' : b.status === 'COMPLETED' ? '#2563eb' : '#dc2626',
                        }}>
                          {b.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => setSelectedBooking(b)}
                            title="View Details"
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              color: '#334155',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            <Eye size={13} /> View
                          </button>

                          {b.status === 'PENDING' && (
                            <button
                              onClick={() => handleUpdateBookingStatus(b.id, 'APPROVED')}
                              title="Approve Booking"
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                background: '#059669',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                              }}
                            >
                              Approve
                            </button>
                          )}

                          {b.status === 'APPROVED' && (
                            <button
                              onClick={() => handleUpdateBookingStatus(b.id, 'COMPLETED')}
                              title="Mark Completed"
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                background: '#2563eb',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                              }}
                            >
                              Complete
                            </button>
                          )}

                          {b.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleUpdateBookingStatus(b.id, 'CANCELLED')}
                              title="Cancel Booking"
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                color: '#dc2626',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            >
                              Cancel
                            </button>
                          )}

                          <button
                            onClick={() => setDeleteConfirm({ type: 'booking', id: b.id, title: `Booking #${b.id} (${b.event_title})` })}
                            title="Delete Booking"
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid #fecdd3',
                              background: '#fff',
                              color: '#ef4444',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: VENUES & SPACES MODERATION */}
      {activeTab === 'venues' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e293b', margin: '0 0 4px' }}>Venues & Space Listings</h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Moderate published spaces, toggle live availability, verify listings, and delete deprecated entries.</p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search venue name, location..."
                  value={venueSearch}
                  onChange={(e) => setVenueSearch(e.target.value)}
                  style={{
                    padding: '8px 14px 8px 36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    outline: 'none',
                    width: '240px',
                  }}
                />
              </div>

              <select
                value={venueCategoryFilter}
                onChange={(e) => setVenueCategoryFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  outline: 'none',
                  background: '#fff',
                  fontWeight: 600,
                  color: '#334155',
                }}
              >
                <option value="ALL">All Categories</option>
                <option value="WEDDING">Wedding Gardens & Halls</option>
                <option value="CONFERENCE">Corporate & Conference</option>
                <option value="BIRTHDAY">Private Parties & Birthdays</option>
                <option value="OUTDOOR">Outdoor & Picnic</option>
              </select>

              <select
                value={venueApprovalFilter}
                onChange={(e) => setVenueApprovalFilter(e.target.value as any)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  outline: 'none',
                  background: '#fff',
                  fontWeight: 600,
                  color: '#334155',
                }}
              >
                <option value="ALL">All Approval Statuses</option>
                <option value="PENDING">Pending Approval</option>
                <option value="APPROVED">Approved & Live</option>
                <option value="REJECTED">Rejected Listings</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Venue Listing</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Category & Location</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Capacity & Rate</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Approval Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Live Visibility</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Admin Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVenues.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                      No venue listings match your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredVenues.map(v => {
                    const status = v.approval_status || (v.is_verified ? 'APPROVED' : 'PENDING');
                    return (
                      <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <img
                              src={v.image_url || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=300'}
                              alt={v.title}
                              style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover' }}
                            />
                            <div>
                              <div style={{ fontWeight: 700, color: '#1e293b' }}>{v.title}</div>
                              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                ID #{v.id} • {v.owner_name || v.vendor_name || 'Provider'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ color: '#1e293b', fontWeight: 600 }}>{v.category_display || v.category}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{v.location}</div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0d8a73' }}>KES {Number(v.price_per_day).toLocaleString()}/day</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Up to {v.capacity} guests</div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: status === 'APPROVED' ? '#ecfdf5' : status === 'REJECTED' ? '#fee2e2' : '#fef3c7',
                            color: status === 'APPROVED' ? '#059669' : status === 'REJECTED' ? '#dc2626' : '#b45309',
                          }}>
                            {status === 'APPROVED' ? <CheckCircle2 size={12} /> : status === 'REJECTED' ? <X size={12} /> : <Clock size={12} />}
                            {status}
                          </span>
                          {status === 'REJECTED' && v.rejection_reason && (
                            <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '2px', maxWidth: '200px' }}>
                              Reason: {v.rejection_reason}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <button
                            onClick={() => handleToggleVenueAvailability(v.id)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '999px',
                              border: 'none',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              background: v.is_available !== false ? '#ecfdf5' : '#fee2e2',
                              color: v.is_available !== false ? '#059669' : '#dc2626',
                            }}
                          >
                            {v.is_available !== false ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              onClick={() => setInspectVenueModal(v)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                color: '#475569',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Inspect
                            </button>

                            {status !== 'APPROVED' && (
                              <button
                                onClick={async () => {
                                  const res = await ApiService.approveVenue(v.id);
                                  if (res.success) {
                                    setVenues(prev => prev.map(item => item.id === v.id ? { ...item, approval_status: 'APPROVED', is_verified: true, rejection_reason: undefined } : item));
                                    toast.success(`Venue '${v.title}' has been approved and is now live.`);
                                    onDataChange?.();
                                  } else {
                                    toast.error(res.error || 'Failed to approve listing.');
                                  }
                                }}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: '#059669',
                                  color: '#fff',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Approve
                              </button>
                            )}

                            {status !== 'REJECTED' && (
                              <button
                                onClick={() => {
                                  setRejectVenueModal(v);
                                  setVenueRejectReason('');
                                }}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: '#ef4444',
                                  color: '#fff',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Reject
                              </button>
                            )}

                            <button
                              onClick={() => setDeleteConfirm({ type: 'venue', id: v.id, title: v.title })}
                              title="Delete Venue"
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: '1px solid #fecdd3',
                                background: '#fff',
                                color: '#ef4444',
                                cursor: 'pointer',
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PROVIDER VERIFICATION QUEUE */}
      {activeTab === 'verifications' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e293b', margin: '0 0 4px' }}>Vendor & Venue Owner Verification Queue</h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Review provider credentials, licenses, portfolios, and grant verified status badges.</p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={verificationTypeFilter}
                onChange={(e) => setVerificationTypeFilter(e.target.value as any)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  outline: 'none',
                  background: '#fff',
                  fontWeight: 600,
                  color: '#334155',
                }}
              >
                <option value="ALL">All Provider Types</option>
                <option value="VENDOR">Vendors & Planners</option>
                <option value="VENUE_OWNER">Venue Owners</option>
              </select>

              <select
                value={verificationStatusFilter}
                onChange={(e) => setVerificationStatusFilter(e.target.value as any)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  outline: 'none',
                  background: '#fff',
                  fontWeight: 600,
                  color: '#334155',
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {filteredAccounts.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '48px 0', textAlign: 'center', color: '#94a3b8' }}>
                No provider accounts found matching your selected filter.
              </div>
            ) : (
              filteredAccounts.map(account => (
                <div
                  key={`${account.account_type}-${account.id}`}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '20px',
                    background: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {account.logo_url ? (
                          <img src={account.logo_url} alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                            <Building2 size={20} />
                          </div>
                        )}
                        <div>
                          <h4 style={{ margin: 0, fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>
                            {account.business_name}
                          </h4>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {account.account_type} • {account.category_or_type}
                          </span>
                        </div>
                      </div>

                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '999px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: account.verification_status === 'APPROVED' ? '#ecfdf5' : account.verification_status === 'REJECTED' ? '#fee2e2' : '#fef3c7',
                        color: account.verification_status === 'APPROVED' ? '#059669' : account.verification_status === 'REJECTED' ? '#dc2626' : '#b45309',
                      }}>
                        {account.verification_status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '4px', margin: '12px 0' }}>
                      {account.location && <div><MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />{account.location}</div>}
                      {account.email && <div>Email: {account.email}</div>}
                      {account.years_in_business !== undefined && <div>Experience: {account.years_in_business} years</div>}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => setSelectedAccount(account)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        color: '#475569',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      Inspect Profile
                    </button>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {account.verification_status !== 'APPROVED' && (
                        <button
                          onClick={() => handleApproveAccount(account)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#059669',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          Approve
                        </button>
                      )}

                      {account.verification_status !== 'REJECTED' && (
                        <button
                          onClick={() => handleRejectAccount(account)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#ef4444',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* VERIFICATION DOCUMENTS REVIEW SUB-SECTION */}
          <div style={{ marginTop: '40px', paddingTop: '28px', borderTop: '2px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={22} color="#0d8a73" />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                    Submitted Verification Documents & Permits ({verificationDocuments.length})
                  </h3>
                </div>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                  Inspect official compliance documents, county permits, and business licenses. Approving verified documents qualifies listings for public visibility.
                </p>
              </div>

              {/* Document Filters */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Search provider, document..."
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    style={{
                      padding: '7px 12px 7px 32px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.83rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <select
                  value={docTypeFilter}
                  onChange={(e) => setDocTypeFilter(e.target.value)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.83rem',
                    outline: 'none',
                    background: '#fff',
                    fontWeight: 600,
                    color: '#334155',
                  }}
                >
                  <option value="ALL">All Document Types</option>
                  <option value="BUSINESS_REGISTRATION">Business Registration</option>
                  <option value="OPERATING_LICENSE">Operating License / Permit</option>
                  <option value="IDENTITY_DOCUMENT">National ID / Passport</option>
                  <option value="TAX_COMPLIANCE">Tax Compliance</option>
                  <option value="HEALTH_SAFETY">Health & Safety</option>
                  <option value="INSURANCE">Insurance</option>
                  <option value="OTHER">Other Documents</option>
                </select>

                <select
                  value={docStatusFilter}
                  onChange={(e) => setDocStatusFilter(e.target.value)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.83rem',
                    outline: 'none',
                    background: '#fff',
                    fontWeight: 600,
                    color: '#334155',
                  }}
                >
                  <option value="ALL">All Review Statuses</option>
                  <option value="PENDING">Pending Review</option>
                  <option value="APPROVED">Approved & Valid</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>
            </div>

            {/* Documents Table */}
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: 700 }}>Provider / Business</th>
                    <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: 700 }}>Document Type & Title</th>
                    <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: 700 }}>File Details</th>
                    <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: 700 }}>Submitted Date</th>
                    <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: 700 }}>Expiry Date</th>
                    <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: 700 }}>Status</th>
                    <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {verificationDocuments
                    .filter(doc => {
                      if (docStatusFilter !== 'ALL' && doc.status !== docStatusFilter) return false;
                      if (docTypeFilter !== 'ALL' && doc.document_type !== docTypeFilter) return false;
                      if (docSearch) {
                        const q = docSearch.toLowerCase();
                        const mUser = (doc.user_name || '').toLowerCase().includes(q);
                        const mBiz = (doc.business_name || '').toLowerCase().includes(q);
                        const mTitle = (doc.title || '').toLowerCase().includes(q);
                        const mType = (doc.document_type_display || '').toLowerCase().includes(q);
                        if (!mUser && !mBiz && !mTitle && !mType) return false;
                      }
                      return true;
                    })
                    .map(doc => {
                      const isPending = doc.status === 'PENDING';
                      const isApproved = doc.status === 'APPROVED' && doc.is_currently_valid;
                      const isExpired = doc.status === 'EXPIRED' || (doc.status === 'APPROVED' && !doc.is_currently_valid);
                      const isRejected = doc.status === 'REJECTED';

                      return (
                        <tr key={doc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 700, color: '#1e293b' }}>
                              {doc.business_name || doc.user_name || `User #${doc.user}`}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {doc.venue_owner ? 'Venue Owner' : doc.vendor ? 'Vendor' : 'Provider'}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{doc.title || doc.document_type_display}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{doc.document_type_display}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ textTransform: 'uppercase', fontSize: '0.72rem', background: '#e2e8f0', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                {doc.file_extension || 'FILE'}
                              </span>
                              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                {doc.file_size ? `${(doc.file_size / (1024 * 1024)).toFixed(1)} MB` : ''}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.82rem' }}>
                            {new Date(doc.created_at).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '0.82rem' }}>
                            {doc.expiry_date ? (
                              <span style={{ color: isExpired ? '#dc2626' : '#64748b', fontWeight: isExpired ? 700 : 500 }}>
                                {new Date(doc.expiry_date).toLocaleDateString()} {isExpired && '(Expired)'}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>None</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '999px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: isApproved ? '#ecfdf5' : isPending ? '#fef3c7' : '#fee2e2',
                              color: isApproved ? '#059669' : isPending ? '#b45309' : '#dc2626',
                            }}>
                              {isExpired ? 'Expired' : doc.status_display}
                            </span>
                            {isRejected && doc.rejection_reason && (
                              <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '3px', maxWidth: '200px' }}>
                                Reason: {doc.rejection_reason}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                              <a
                                href={ApiService.getDocumentDownloadUrl(doc.id, currentUser?.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  background: '#fff',
                                  color: '#334155',
                                  fontWeight: 600,
                                  fontSize: '0.76rem',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <ExternalLink size={12} /> Preview
                              </a>

                              {doc.status !== 'APPROVED' && (
                                <button
                                  onClick={async () => {
                                    const res = await ApiService.approveVerificationDocument(doc.id, 'Approved by Administrator', currentUser?.id);
                                    if (res.success) {
                                      setVerificationDocuments(prev => prev.map(d => d.id === doc.id ? res.data || { ...d, status: 'APPROVED', is_currently_valid: true } : d));
                                      toast.success(`Document '${doc.title || doc.document_type_display}' approved.`);
                                      loadAdminData();
                                      onDataChange?.();
                                    } else {
                                      toast.error(res.error || 'Failed to approve document.');
                                    }
                                  }}
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: '#059669',
                                    color: '#fff',
                                    fontWeight: 700,
                                    fontSize: '0.76rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Approve
                                </button>
                              )}

                              {doc.status !== 'REJECTED' && (
                                <button
                                  onClick={() => {
                                    setRejectingDocModal(doc);
                                    setDocRejectionReason('');
                                    setDocAdminNotes('');
                                  }}
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: '#ef4444',
                                    color: '#fff',
                                    fontWeight: 700,
                                    fontSize: '0.76rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: REVIEWS & RATINGS MODERATION */}
      {activeTab === 'reviews' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e293b', margin: '0 0 4px' }}>Customer Reviews Moderation</h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Review submitted customer ratings and remove inappropriate, fraudulent, or abusive comments.</p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search reviewer, comment..."
                  value={reviewSearch}
                  onChange={(e) => setReviewSearch(e.target.value)}
                  style={{
                    padding: '8px 14px 8px 36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    outline: 'none',
                    width: '240px',
                  }}
                />
              </div>

              <select
                value={reviewRatingFilter}
                onChange={(e) => setReviewRatingFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  outline: 'none',
                  background: '#fff',
                  fontWeight: 600,
                  color: '#334155',
                }}
              >
                <option value="ALL">All Stars</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Reviewer</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Target Service / Space</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Rating</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Comment</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReviews.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                      No reviews found matching the search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredReviews.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1e293b' }}>
                        {r.user_name}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#0d8a73', fontWeight: 600 }}>
                        {r.target_name || (r.venue ? `Venue #${r.venue}` : `Vendor #${r.vendor}`)}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#f59e0b' }}>
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={14}
                              fill={i < r.rating ? '#f59e0b' : 'none'}
                              color={i < r.rating ? '#f59e0b' : '#cbd5e1'}
                            />
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#334155', maxWidth: '350px' }}>
                        <p style={{ margin: 0, lineHeight: 1.4, fontSize: '0.84rem' }}>
                          {r.comment || <em style={{ color: '#94a3b8' }}>No comment provided</em>}
                        </p>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => setDeleteConfirm({ type: 'review', id: r.id, title: `Review by ${r.user_name}` })}
                          title="Delete Inappropriate Review"
                          style={{
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid #fecdd3',
                            background: '#fff',
                            color: '#ef4444',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: PLATFORM ANALYTICS & REPORTS */}
      {activeTab === 'analytics' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e293b', margin: '0 0 4px' }}>Platform Analytics & Reports</h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Real-time business performance, conversion rates, and revenue breakdown across Kenya.</p>
            </div>
            <button
              onClick={handleRefreshRatings}
              disabled={refreshingRatings}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#0d8a73',
                color: '#ffffff',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: refreshingRatings ? 'not-allowed' : 'pointer'
              }}
            >
              <RefreshCw size={15} className={refreshingRatings ? 'spin' : ''} />
              Re-compute Platform Metrics
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '28px' }}>
            <div style={{ padding: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Booking Conversion Rate</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0d8a73', marginTop: '8px' }}>
                {bookings.length > 0
                  ? `${Math.round((bookings.filter(b => b.status === 'APPROVED' || b.status === 'COMPLETED').length / bookings.length) * 100)}%`
                  : '100%'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                {bookings.filter(b => b.status === 'APPROVED' || b.status === 'COMPLETED').length} confirmed / {bookings.length} requests
              </div>
            </div>

            <div style={{ padding: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Provider Verification Rate</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563eb', marginTop: '8px' }}>
                {unifiedAccounts.length > 0
                  ? `${Math.round((unifiedAccounts.filter(a => a.is_verified || a.verification_status === 'APPROVED').length / unifiedAccounts.length) * 100)}%`
                  : '0%'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                {unifiedAccounts.filter(a => a.is_verified || a.verification_status === 'APPROVED').length} verified of {unifiedAccounts.length} providers
              </div>
            </div>

            <div style={{ padding: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Average Booking Value</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', marginTop: '8px' }}>
                KES {bookings.length > 0 ? Math.round((stats?.total_revenue || 0) / (bookings.length || 1)).toLocaleString() : '0'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                Based on active and completed platform reservations
              </div>
            </div>
          </div>

          <div style={{ padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', margin: '0 0 16px' }}>Catalog & Supply Breakdown</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div style={{ padding: '14px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Active Venues</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>{venues.length} Spaces</div>
              </div>
              <div style={{ padding: '14px', borderRadius: '10px', background: '#f0fdfa', border: '1px solid #99f6e4' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#115e59', textTransform: 'uppercase' }}>Active Vendors</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f766e', marginTop: '4px' }}>{vendors.length} Services</div>
              </div>
              <div style={{ padding: '14px', borderRadius: '10px', background: '#fef3c7', border: '1px solid #fde68a' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>Pending Approvals</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b45309', marginTop: '4px' }}>{pendingVerificationCount} Queue Items</div>
              </div>
              <div style={{ padding: '14px', borderRadius: '10px', background: '#f3e8ff', border: '1px solid #e9d5ff' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase' }}>Total Feedback</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7e22ce', marginTop: '4px' }}>{reviews.length} Client Reviews</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: PLATFORM SETTINGS */}
      {activeTab === 'settings' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e293b', margin: '0 0 4px' }}>Platform Settings & Configuration</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Manage security settings, operational defaults, and administrative controls.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>Administrator Account Session</h4>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.84rem' }}>
                    Signed in as <strong>{currentUser?.email || 'admin@locyfy.com'}</strong> with platform {currentUser?.role || 'ADMIN'} privileges.
                  </p>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: '#fee2e2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    End Session
                  </button>
                )}
              </div>
            </div>

            <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>System Operations & Data Caching</h4>
              <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '0.84rem' }}>
                Trigger background sync, recalculate composite provider ratings, or refresh booking inventory counts.
              </p>
              <button
                onClick={async () => {
                  await handleRefreshRatings();
                  loadAdminData();
                  onDataChange?.();
                }}
                disabled={loading || refreshingRatings}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: '#0d8a73',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <RefreshCw size={16} className={refreshingRatings ? 'spin' : ''} />
                Force System Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Account Verification Review Modal */}
      {selectedAccount && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#0d8a73' }}>
                  {selectedAccount.account_type} Verification Details
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>
                  {selectedAccount.business_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAccount(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem' }}>
              {selectedAccount.logo_url && (
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <img
                    src={selectedAccount.logo_url}
                    alt="Logo"
                    style={{ maxHeight: '80px', maxWidth: '200px', borderRadius: '8px', objectFit: 'contain' }}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Type / Category</span>
                  <strong style={{ color: '#1e293b' }}>{selectedAccount.category_or_type}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Location</span>
                  <strong style={{ color: '#1e293b' }}>{selectedAccount.location}</strong>
                </div>
              </div>

              {selectedAccount.address && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Physical Address</span>
                  <span style={{ color: '#334155' }}>{selectedAccount.address}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {selectedAccount.email && (
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Email Address</span>
                    <a href={`mailto:${selectedAccount.email}`} style={{ color: '#0d8a73', textDecoration: 'none', fontWeight: 600 }}>
                      {selectedAccount.email}
                    </a>
                  </div>
                )}
                {selectedAccount.phone && (
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Phone Number</span>
                    <a href={`tel:${selectedAccount.phone}`} style={{ color: '#0d8a73', textDecoration: 'none', fontWeight: 600 }}>
                      {selectedAccount.phone}
                    </a>
                  </div>
                )}
              </div>

              {selectedAccount.years_in_business !== undefined && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Experience</span>
                  <span style={{ color: '#334155', fontWeight: 600 }}>{selectedAccount.years_in_business} years in business</span>
                </div>
              )}

              {selectedAccount.website_url && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Website / Portfolio</span>
                  <a
                    href={selectedAccount.website_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                  >
                    {selectedAccount.website_url} <ExternalLink size={13} />
                  </a>
                </div>
              )}

              {selectedAccount.description && (
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Business Description</span>
                  <p style={{ margin: 0, color: '#334155', lineHeight: 1.5, fontSize: '0.85rem' }}>
                    {selectedAccount.description}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '8px', background: selectedAccount.verification_status === 'APPROVED' ? '#ecfdf5' : selectedAccount.verification_status === 'REJECTED' ? '#fef2f2' : '#fef3c7' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Current Status:</span>
                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: selectedAccount.verification_status === 'APPROVED' ? '#059669' : selectedAccount.verification_status === 'REJECTED' ? '#dc2626' : '#b45309' }}>
                  {selectedAccount.verification_status}
                </span>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8fafc', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
              <button
                onClick={() => setSelectedAccount(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                onClick={() => handleRejectAccount(selectedAccount)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Reject Application
              </button>
              <button
                onClick={() => handleApproveAccount(selectedAccount)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#059669', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Approve & Verify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Booking Details Modal */}
      {selectedBooking && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#0d8a73' }}>
                  Booking #{selectedBooking.id} Information
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>
                  {selectedBooking.event_title}
                </h3>
              </div>
              <button onClick={() => setSelectedBooking(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Customer</span>
                  <strong style={{ color: '#1e293b' }}>{selectedBooking.customer_name}</strong>
                  {selectedBooking.customer_email && <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{selectedBooking.customer_email}</div>}
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Reserved Item</span>
                  <strong style={{ color: '#1e293b' }}>
                    {selectedBooking.venue_details?.title || selectedBooking.vendor_details?.business_name || 'Service Item'}
                  </strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Event Date</span>
                  <strong style={{ color: '#1e293b' }}>{selectedBooking.event_date}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Guest Count</span>
                  <strong style={{ color: '#1e293b' }}>{selectedBooking.guest_count} Attendees</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Total Price</span>
                  <strong style={{ color: '#0d8a73', fontSize: '1.1rem' }}>KES {Number(selectedBooking.total_price).toLocaleString()}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Current Status</span>
                  <span style={{
                    display: 'inline-block',
                    padding: '3px 8px',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: selectedBooking.status === 'APPROVED' ? '#ecfdf5' : selectedBooking.status === 'PENDING' ? '#fef3c7' : selectedBooking.status === 'COMPLETED' ? '#eff6ff' : '#fee2e2',
                    color: selectedBooking.status === 'APPROVED' ? '#059669' : selectedBooking.status === 'PENDING' ? '#b45309' : selectedBooking.status === 'COMPLETED' ? '#2563eb' : '#dc2626',
                  }}>
                    {selectedBooking.status}
                  </span>
                </div>
              </div>

              {selectedBooking.notes && (
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Client Notes</span>
                  <p style={{ margin: 0, color: '#334155', lineHeight: 1.5, fontSize: '0.85rem' }}>
                    {selectedBooking.notes}
                  </p>
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#f8fafc', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
              <button
                onClick={() => setSelectedBooking(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
              {selectedBooking.status === 'PENDING' && (
                <button
                  onClick={() => handleUpdateBookingStatus(selectedBooking.id, 'APPROVED')}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#059669', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Approve Booking
                </button>
              )}
              {selectedBooking.status === 'APPROVED' && (
                <button
                  onClick={() => handleUpdateBookingStatus(selectedBooking.id, 'COMPLETED')}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Mark Completed
                </button>
              )}
              {selectedBooking.status !== 'CANCELLED' && (
                <button
                  onClick={() => handleUpdateBookingStatus(selectedBooking.id, 'CANCELLED')}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel Booking
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit User Role Modal */}
      {editingUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px',
        }}>
          <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '440px', width: '100%', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 800, color: '#1e293b' }}>
              Modify User Role
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#64748b' }}>
              Change the permission tier for <strong>{editingUser.username}</strong>.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                Select Role
              </label>
              <select
                value={newRoleSelection}
                onChange={(e) => setNewRoleSelection(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  outline: 'none',
                }}
              >
                <option value="CUSTOMER">Customer (Book spaces & services)</option>
                <option value="PROVIDER">Business Provider (List venues & services)</option>
                <option value="ADMIN">Administrator (Full platform moderation)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setEditingUser(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUserRole}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#0d8a73', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Save Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '20px',
        }}>
          <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '420px', width: '100%', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <AlertCircle size={24} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 800, color: '#1e293b' }}>
              Confirm Deletion
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete <strong>{deleteConfirm.title}</strong>? This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteConfirm.type === 'user') handleDeleteUser(deleteConfirm.id);
                  else if (deleteConfirm.type === 'booking') handleDeleteBooking(deleteConfirm.id);
                  else if (deleteConfirm.type === 'venue') handleDeleteVenue(deleteConfirm.id);
                  else if (deleteConfirm.type === 'review') handleDeleteReview(deleteConfirm.id);
                }}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL 5: Inspect Venue Listing Modal */}
      {inspectVenueModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            maxWidth: '580px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#0d8a73' }}>
                  Listing Inspection #{inspectVenueModal.id}
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>
                  {inspectVenueModal.title}
                </h3>
              </div>
              <button onClick={() => setInspectVenueModal(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem' }}>
              {inspectVenueModal.image_url && (
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <img
                    src={inspectVenueModal.image_url}
                    alt={inspectVenueModal.title}
                    style={{ maxHeight: '200px', width: '100%', borderRadius: '10px', objectFit: 'cover' }}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Category</span>
                  <strong style={{ color: '#1e293b' }}>{inspectVenueModal.category_display || inspectVenueModal.category}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Location</span>
                  <strong style={{ color: '#1e293b' }}>{inspectVenueModal.location}</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Daily Rental Rate</span>
                  <strong style={{ color: '#0d8a73', fontSize: '1.05rem' }}>KES {Number(inspectVenueModal.price_per_day).toLocaleString()}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Guest Capacity</span>
                  <strong style={{ color: '#1e293b' }}>{inspectVenueModal.capacity} Attendees</strong>
                </div>
              </div>

              {inspectVenueModal.cancellation_policy && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Cancellation Policy</span>
                  <strong style={{ color: '#334155' }}>{inspectVenueModal.cancellation_policy}</strong>
                </div>
              )}

              {inspectVenueModal.description && (
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Listing Description</span>
                  <p style={{ margin: 0, color: '#334155', lineHeight: 1.5, fontSize: '0.85rem' }}>
                    {inspectVenueModal.description}
                  </p>
                </div>
              )}

              {inspectVenueModal.rejection_reason && (
                <div style={{ background: '#fee2e2', padding: '12px 14px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <span style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Previous Rejection Reason</span>
                  <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.85rem' }}>
                    {inspectVenueModal.rejection_reason}
                  </p>
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8fafc', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
              <button
                onClick={() => setInspectVenueModal(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
              {inspectVenueModal.approval_status !== 'APPROVED' && (
                <button
                  onClick={async () => {
                    const res = await ApiService.approveVenue(inspectVenueModal.id);
                    if (res.success) {
                      setVenues(prev => prev.map(item => item.id === inspectVenueModal.id ? { ...item, approval_status: 'APPROVED', is_verified: true, rejection_reason: undefined } : item));
                      toast.success(`Venue '${inspectVenueModal.title}' approved!`);
                      setInspectVenueModal(null);
                      onDataChange?.();
                    } else {
                      toast.error(res.error || 'Failed to approve listing.');
                    }
                  }}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#059669', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Approve Listing
                </button>
              )}
              {inspectVenueModal.approval_status !== 'REJECTED' && (
                <button
                  onClick={() => {
                    const target = inspectVenueModal;
                    setInspectVenueModal(null);
                    setRejectVenueModal(target);
                    setVenueRejectReason('');
                  }}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Reject Listing
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Reject Venue with Reason Modal */}
      {rejectVenueModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '20px',
        }}>
          <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '480px', width: '100%', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <AlertCircle size={24} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 800, color: '#1e293b' }}>
              Reject Listing: {rejectVenueModal.title}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#64748b' }}>
              Please provide a specific reason explaining what requirements were not met so the host can address them.
            </p>

            <textarea
              rows={4}
              placeholder="e.g. Inadequate pricing clarity, incorrect location details, or poor image quality..."
              value={venueRejectReason}
              onChange={(e) => setVenueRejectReason(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.88rem',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                marginBottom: '20px',
                resize: 'vertical',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setRejectVenueModal(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const res = await ApiService.rejectVenue(rejectVenueModal.id, venueRejectReason.trim() || 'Listing does not satisfy verification standards.');
                  if (res.success) {
                    setVenues(prev => prev.map(item => item.id === rejectVenueModal.id ? { ...item, approval_status: 'REJECTED', is_verified: false, rejection_reason: venueRejectReason.trim() } : item));
                    toast.success(`Listing '${rejectVenueModal.title}' has been rejected.`);
                    setRejectVenueModal(null);
                    onDataChange?.();
                  } else {
                    toast.error(res.error || 'Failed to reject listing.');
                  }
                }}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REJECT VERIFICATION DOCUMENT */}
      {rejectingDocModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '20px',
        }}>
          <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '500px', width: '100%', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <AlertTriangle size={24} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 800, color: '#1e293b' }}>
              Reject Document: {rejectingDocModal.title || rejectingDocModal.document_type_display}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#64748b' }}>
              Provide a clear reason for the document rejection. The provider will see this explanation and will be allowed to resubmit a valid replacement.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Rejection Reason (Visible to Provider) *
              </label>
              <textarea
                rows={3}
                placeholder="e.g., The permit has expired, official seal is unreadable, or company registration name doesn't match..."
                value={docRejectionReason}
                onChange={(e) => setDocRejectionReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Internal Admin Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="Internal audit notes..."
                value={docAdminNotes}
                onChange={(e) => setDocAdminNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setRejectingDocModal(null)}
                disabled={submittingDocReview}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                disabled={submittingDocReview}
                onClick={async () => {
                  const reason = docRejectionReason.trim() || 'Document does not satisfy LOCYFY verification requirements.';
                  setSubmittingDocReview(true);
                  try {
                    const res = await ApiService.rejectVerificationDocument(rejectingDocModal.id, reason, docAdminNotes, currentUser?.id);
                    if (res.success) {
                      setVerificationDocuments(prev => prev.map(d => d.id === rejectingDocModal.id ? res.data || { ...d, status: 'REJECTED', rejection_reason: reason } : d));
                      toast.success(`Document marked as rejected.`);
                      setRejectingDocModal(null);
                      loadAdminData();
                      onDataChange?.();
                    } else {
                      toast.error(res.error || 'Failed to reject document.');
                    }
                  } catch (e: any) {
                    toast.error(e?.message || 'Error rejecting document.');
                  } finally {
                    setSubmittingDocReview(false);
                  }
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: submittingDocReview ? 'not-allowed' : 'pointer',
                  opacity: submittingDocReview ? 0.7 : 1,
                }}
              >
                {submittingDocReview ? 'Submitting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};
