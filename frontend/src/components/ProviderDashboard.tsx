import React, { useState, useEffect, useCallback } from 'react';
import type { Booking, Venue, BookingStatus, Vendor, VenueOwner, VenueCategory, User } from '../types';
import { ApiService } from '../services/api';
import './vendor-dashboard.css';
import {
  Building2,
  Plus,
  X,
  MapPin,
  Trash2,
  ShieldCheck,
  User as UserIcon,
  LayoutDashboard,
  Package,
  CalendarCheck,
  Calendar,
  Star,
  Settings,
  LogOut,
  ChevronRight,
  Eye,
  AlertCircle,
  Users,
  ChevronDown,
  MessageSquare,
  Check,
  Layers,
  Send
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cleanImageUrl, handleImageError, DEFAULT_SPACE_IMAGE, DEFAULT_SERVICE_IMAGE } from '../utils/imageUtils';

interface ProviderDashboardProps {
  currentUser?: User | null;
  currentVendor?: Vendor | null;
  currentVenueOwner?: VenueOwner | null;
  onLogout: () => void;
  onExplore?: () => void;
}

export const ProviderDashboard: React.FC<ProviderDashboardProps> = ({
  currentUser,
  currentVendor,
  currentVenueOwner,
  onLogout,
  onExplore,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'spaces' | 'services' | 'bookings' | 'calendar' | 'reviews' | 'messages' | 'profile' | 'settings'>('overview');
  
  // Inspiration UI Navigation and Filter States
  const [myListingsExpanded, setMyListingsExpanded] = useState(true);
  const [showAddListingDropdown, setShowAddListingDropdown] = useState(false);
  const [listingsCategoryFilter, setListingsCategoryFilter] = useState<string>('ALL');
  
  // Data states
  const [spaces, setSpaces] = useState<Venue[]>([]);
  const [services, setServices] = useState<Venue[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [, setLoading] = useState(true);

  // Business profile form
  const businessName = currentVenueOwner?.business_name || currentVendor?.business_name || 'My Business';
  const location = currentVenueOwner?.location || currentVendor?.location || 'Nairobi';
  const email = currentVenueOwner?.contact_email || currentVendor?.contact_email || '';
  const phone = currentVenueOwner?.contact_phone || currentVendor?.contact_phone || '';

  const [profileFormData, setProfileFormData] = useState({
    business_name: businessName,
    location: location,
    contact_email: email,
    contact_phone: phone,
    description: currentVenueOwner?.description || currentVendor?.description || '',
    website_url: currentVenueOwner?.website_url || currentVendor?.website_url || '',
  });

  const [isUploading, setIsUploading] = useState(false);

  // Modal states
  const [showAddSpaceModal, setShowAddSpaceModal] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [spaceErrorNotice, setSpaceErrorNotice] = useState<string | null>(null);
  const [serviceErrorNotice, setServiceErrorNotice] = useState<string | null>(null);

  // New Space Form
  const [newSpace, setNewSpace] = useState({
    title: '',
    category: 'WEDDING' as VenueCategory,
    location: location || 'Nairobi',
    address: '',
    capacity: 250,
    price_per_day: 65000,
    price_per_hour: 8000,
    description: '',
    amenities: 'Parking, Sound System, Restrooms, Security',
    image_url: '',
  });

  // New Service Form
  const [newService, setNewService] = useState({
    title: '',
    category: 'PHOTOGRAPHY',
    pricing_type: 'Per Event',
    price_per_day: 25000,
    description: '',
    image_url: '',
  });

  // Filter states
  const [spaceFilter, setSpaceFilter] = useState<'ALL' | 'APPROVED' | 'PENDING'>('ALL');
  const [serviceFilter, setServiceFilter] = useState<'ALL' | 'APPROVED' | 'PENDING'>('ALL');
  const [bookingFilter, setBookingFilter] = useState<'ALL' | 'SPACES' | 'SERVICES'>('ALL');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'CANCELLED'>('ALL');
  const [selectedBookingChatId, setSelectedBookingChatId] = useState<string | number | null>(null);
  const [messageInput, setMessageInput] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ownerId = currentVenueOwner?.id;
      const vendorId = currentVendor?.id;
      const userId = currentUser?.id;

      if (!ownerId && !vendorId && !userId) {
        setSpaces([]);
        setServices([]);
        setBookings([]);
        setLoading(false);
        return;
      }

      let fetchedBookings: Booking[] = [];

      if (ownerId) {
        try {
          const ownerBookings = await ApiService.getVenueOwnerBookings(ownerId);
          fetchedBookings = [...fetchedBookings, ...ownerBookings];
        } catch (e) {
          console.error("Failed to load owner bookings", e);
        }
      }
      if (vendorId) {
        try {
          const vendorBookings = await ApiService.getVendorBookings(vendorId);
          const existingIds = new Set(fetchedBookings.map(b => b.id));
          vendorBookings.forEach(b => {
            if (!existingIds.has(b.id)) fetchedBookings.push(b);
          });
        } catch (e) {
          console.error("Failed to load vendor bookings", e);
        }
      }
      if (userId) {
        try {
          const userBookings = await ApiService.getBookings({ user: userId });
          const existingIds = new Set(fetchedBookings.map(b => b.id));
          userBookings.forEach(b => {
            if (!existingIds.has(b.id)) fetchedBookings.push(b);
          });
        } catch (e) {
          console.error("Failed to load user bookings", e);
        }
      }

      const providerVenues = await ApiService.getVenues({
        user: userId,
        owner: ownerId,
        vendor: vendorId,
      });

      const isMyListing = (v: Venue) => {
        const vOwnerId = typeof v.owner === 'object' ? (v.owner as any)?.id : v.owner;
        const vVendorId = typeof v.vendor === 'object' ? (v.vendor as any)?.id : v.vendor;
        const matchesOwner = Boolean(ownerId && vOwnerId === ownerId);
        const matchesVendor = Boolean(vendorId && vVendorId === vendorId);
        return matchesOwner || matchesVendor;
      };

      const myOwnListings = providerVenues.filter(isMyListing);

      // If user has listings, ensure any bookings for those listing IDs are also captured
      if (myOwnListings.length > 0) {
        try {
          const myVenueIds = new Set(myOwnListings.map(v => v.id));
          const allSystemBookings = await ApiService.getBookings();
          const existingIds = new Set(fetchedBookings.map(b => b.id));
          allSystemBookings.forEach(b => {
            const venueId = typeof b.venue === 'object' ? (b.venue as any)?.id : b.venue;
            if (venueId && myVenueIds.has(venueId) && !existingIds.has(b.id)) {
              fetchedBookings.push(b);
              existingIds.add(b.id);
            }
          });
        } catch (e) {
          console.error("Failed to load venue bookings", e);
        }
      }

      const mySpaces = myOwnListings.filter(v => (v.capacity ?? 0) > 0);
      const myServices = myOwnListings.filter(v => (v.capacity ?? 0) === 0);

      setSpaces(mySpaces);
      setServices(myServices);
      setBookings(fetchedBookings);
    } catch (err) {
      console.error("Failed to load provider data", err);
    } finally {
      setLoading(false);
    }
  }, [currentVendor?.id, currentVenueOwner?.id, currentUser?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && currentUser?.id) {
      const file = e.target.files[0];
      setIsUploading(true);
      const newUrl = await ApiService.uploadProfilePicture(currentUser.id, file);
      if (newUrl) {
        if (currentVendor) currentVendor.logo_url = newUrl;
        toast.success('Business logo/photo updated successfully!');
      } else {
        toast.error('Failed to upload picture.');
      }
      setIsUploading(false);
    }
  };

  // Add Space Submit
  const handleAddSpaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let ownerId = currentVenueOwner?.id;
    let vendorId = currentVendor?.id;
    if (!ownerId && !vendorId && currentUser?.id) {
      try {
        const resp = await ApiService.requestRole(currentUser.id, 'PROVIDER');
        if (resp) {
          ownerId = resp.venue_owner_profile?.id;
          vendorId = resp.vendor_profile?.id;
        }
      } catch (err) {
        console.error("Auto-provisioning failed", err);
      }
    }
    if (!ownerId && !vendorId) {
      toast.error("Profile not found.");
      return;
    }
    setSubmitting(true);
    setSpaceErrorNotice(null);
    try {
      const amenitiesList = newSpace.amenities
        .split(',')
        .map(a => a.trim())
        .filter(Boolean);

      await ApiService.addVenue({
        owner: ownerId,
        vendor: vendorId,
        title: newSpace.title,
        category: newSpace.category,
        location: newSpace.location,
        address: newSpace.address,
        capacity: Number(newSpace.capacity),
        price_per_day: Number(newSpace.price_per_day),
        price_per_hour: Number(newSpace.price_per_hour),
        description: newSpace.description,
        amenities: amenitiesList,
        image_url: cleanImageUrl(newSpace.image_url) || DEFAULT_SPACE_IMAGE,
      });

      toast.success("Event space submitted! Awaiting verification.");
      setShowAddSpaceModal(false);
      setSpaceErrorNotice(null);
      setNewSpace({
        title: '',
        category: 'WEDDING',
        location: location || 'Nairobi',
        address: '',
        capacity: 250,
        price_per_day: 65000,
        price_per_hour: 8000,
        description: '',
        amenities: 'Parking, Sound System, Restrooms, Security',
        image_url: '',
      });
      fetchData();
    } catch (err: any) {
      const msg = err?.message || "Failed to add space. Please verify all required fields.";
      setSpaceErrorNotice(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Add Service Submit
  const handleAddServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let vendorId = currentVendor?.id;
    let ownerId = currentVenueOwner?.id;
    if (!vendorId && !ownerId && currentUser?.id) {
      try {
        const resp = await ApiService.requestRole(currentUser.id, 'PROVIDER');
        if (resp) {
          vendorId = resp.vendor_profile?.id;
          ownerId = resp.venue_owner_profile?.id;
        }
      } catch (err) {
        console.error("Auto-provisioning failed", err);
      }
    }
    if (!vendorId && !ownerId) {
      toast.error("Profile not found.");
      return;
    }
    setSubmitting(true);
    setServiceErrorNotice(null);
    try {
      await ApiService.addVenue({
        vendor: vendorId,
        owner: ownerId,
        title: newService.title,
        category: newService.category as any,
        location: location || 'Nairobi',
        capacity: 0,
        price_per_day: Number(newService.price_per_day),
        description: `${newService.description} (${newService.pricing_type})`,
        image_url: cleanImageUrl(newService.image_url) || DEFAULT_SERVICE_IMAGE,
      });

      if (currentVendor && (Number(currentVendor.starting_price || 0) <= 0 || Number(newService.price_per_day) < Number(currentVendor.starting_price))) {
        currentVendor.starting_price = Number(newService.price_per_day);
      }

      toast.success("Service created successfully!");
      setShowAddServiceModal(false);
      setServiceErrorNotice(null);
      setNewService({
        title: '',
        category: 'PHOTOGRAPHY',
        pricing_type: 'Per Event',
        price_per_day: 25000,
        description: '',
        image_url: '',
      });
      fetchData();
    } catch (err: any) {
      const msg = err?.message || "Failed to add service. Please verify all required fields.";
      setServiceErrorNotice(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteListing = async (id: number, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    const ok = await ApiService.deleteVenue(id);
    if (ok) {
      toast.success(`"${title}" deleted successfully`);
      fetchData();
    } else {
      toast.error("Failed to delete listing.");
    }
  };

  const handleUpdateBookingStatus = async (id: number, status: BookingStatus) => {
    const ok = await ApiService.updateBookingStatus(id, status);
    if (ok) {
      toast.success(`Booking ${status.toLowerCase()}!`);
      fetchData();
    } else {
      toast.error("Failed to update status.");
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentVenueOwner?.id) {
        await ApiService.updateVenueOwner(currentVenueOwner.id, profileFormData);
      }
      if (currentVendor?.id) {
        await ApiService.updateVendor(currentVendor.id, profileFormData);
      }
      toast.success("Business profile updated!");
    } catch {
      toast.error("Failed to update profile.");
    }
  };

  // Metrics
  const activeSpacesCount = spaces.filter(s => s.is_verified).length;
  const activeServicesCount = services.filter(s => s.is_verified).length;
  const pendingRequestsCount = bookings.filter(b => b.status === 'PENDING').length;
  const totalRevenue = bookings
    .filter(b => b.status === 'COMPLETED' || b.status === 'APPROVED')
    .reduce((sum, b) => sum + Number(b.total_price || 0), 0);

  // Filtered views
  const filteredSpaces = spaces.filter(s => {
    if (spaceFilter === 'APPROVED') return s.is_verified;
    if (spaceFilter === 'PENDING') return !s.is_verified;
    return true;
  });

  const filteredServices = services.filter(s => {
    if (serviceFilter === 'APPROVED') return s.is_verified;
    if (serviceFilter === 'PENDING') return !s.is_verified;
    return true;
  });

  const filteredBookings = bookings.filter(b => {
    const venueCapacity = b.venue_details?.capacity;
    if (bookingFilter === 'SPACES' && venueCapacity === 0) return false;
    if (bookingFilter === 'SERVICES' && venueCapacity !== undefined && venueCapacity > 0) return false;
    if (bookingStatusFilter !== 'ALL' && b.status !== bookingStatusFilter) return false;
    return true;
  });

  const getPageTitle = () => {
    switch (activeTab) {
      case 'overview': return 'Vendor Overview';
      case 'spaces': return 'My Event Venues';
      case 'services': return 'My Services & Packages';
      case 'bookings': return 'Booking Requests';
      case 'calendar': return 'Event Calendar';
      case 'messages': return 'Client Messages';
      case 'reviews': return 'Client Reviews';
      case 'profile': return 'Vendor Profile';
      case 'settings': return 'Account Settings';
      default: return 'Vendor Dashboard';
    }
  };

  const getPageSubtitle = () => {
    switch (activeTab) {
      case 'overview': return 'Manage your venues and services, track bookings, and grow your business.';
      case 'spaces': return 'List, showcase, and manage your physical event venues and banquet halls.';
      case 'services': return 'Configure your professional service packages, rates, and coverage.';
      case 'bookings': return 'Review incoming customer booking inquiries and confirm schedules.';
      case 'calendar': return 'Track upcoming approved events and venue reservations.';
      case 'messages': return 'Communicate with clients regarding event bookings and custom packages.';
      case 'reviews': return 'See feedback and star ratings from clients who booked your spaces or services.';
      case 'profile': return 'Update your public vendor branding, logo, contact details, and location.';
      case 'settings': return 'Platform preferences and notification settings.';
      default: return 'Manage your vendor operations.';
    }
  };

  const greetingHour = new Date().getHours();
  const greetingTime = greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening';
  const vendorFirstName = currentUser?.first_name || (currentUser?.username ? currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1) : 'Susan');

  return (
    <div className="vendor-dashboard-layout">
      
      {/* 1. Signature Vendor Green Sidebar */}
      <aside className="vendor-sidebar">
        
        {/* Header Branding */}
        <div className="vendor-sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', background: 'rgba(255, 255, 255, 0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: 800, fontSize: '1.15rem' }}>
              L
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#ffffff' }}>Locyfy</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a7f3d0' }}>Vendor Portal</div>
            </div>
          </div>
        </div>

        {/* Business Badge */}
        <div style={{ padding: '12px 16px', background: 'rgba(0, 0, 0, 0.16)', margin: '14px 14px 6px', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {businessName}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
            <ShieldCheck size={13} /> Verified Vendor
          </div>
        </div>

        {/* Nav List */}
        <nav className="vendor-sidebar-nav" style={{ paddingTop: '8px' }}>
          {/* Overview */}
          <button
            className={`vendor-sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <LayoutDashboard size={18} /> Overview
          </button>

          {/* My Listings Parent */}
          <div>
            <button
              className={`vendor-sidebar-item ${(activeTab === 'spaces' || activeTab === 'services') ? 'active' : ''}`}
              onClick={() => setMyListingsExpanded(prev => !prev)}
              style={{ justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Layers size={18} /> My Listings
              </div>
              {myListingsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {myListingsExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px', marginBottom: '4px' }}>
                <button
                  className={`vendor-sidebar-subitem ${activeTab === 'spaces' ? 'active' : ''}`}
                  onClick={() => setActiveTab('spaces')}
                >
                  <Building2 size={16} /> Venues
                  <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.15)', color: '#ffffff', fontSize: '0.72rem', padding: '1px 7px', borderRadius: '999px', fontWeight: 700 }}>
                    {spaces.length}
                  </span>
                </button>
                <button
                  className={`vendor-sidebar-subitem ${activeTab === 'services' ? 'active' : ''}`}
                  onClick={() => setActiveTab('services')}
                >
                  <Package size={16} /> Services
                  <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.15)', color: '#ffffff', fontSize: '0.72rem', padding: '1px 7px', borderRadius: '999px', fontWeight: 700 }}>
                    {services.length}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Booking Requests */}
          <button
            className={`vendor-sidebar-item ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            <CalendarCheck size={18} /> Booking Requests
            {pendingRequestsCount > 0 && (
              <span className="vendor-nav-badge-red">
                {pendingRequestsCount}
              </span>
            )}
          </button>

          {/* Calendar */}
          <button
            className={`vendor-sidebar-item ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            <Calendar size={18} /> Calendar
          </button>

          {/* Messages */}
          <button
            className={`vendor-sidebar-item ${activeTab === 'messages' ? 'active' : ''}`}
            onClick={() => setActiveTab('messages')}
          >
            <MessageSquare size={18} /> Messages
            {bookings.length > 0 && (
              <span className="vendor-nav-badge-red">{bookings.filter(b => b.status === 'PENDING').length || bookings.length}</span>
            )}
          </button>

          {/* Reviews */}
          <button
            className={`vendor-sidebar-item ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            <Star size={18} /> Reviews
          </button>

          {/* Profile */}
          <button
            className={`vendor-sidebar-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <UserIcon size={18} /> Vendor Profile
          </button>

          {/* Settings */}
          <button
            className={`vendor-sidebar-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={18} /> Settings
          </button>

          <div style={{ flexGrow: 1 }} />

          {/* Footer Actions inside Sidebar */}
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', padding: '16px 12px 0', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {onExplore && (
              <button 
                onClick={onExplore}
                className="vendor-sidebar-item"
                style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#ffffff', justifyContent: 'center', fontSize: '0.85rem' }}
              >
                <Eye size={16} /> Customer View
              </button>
            )}
            <button 
              onClick={onLogout}
              className="vendor-sidebar-item" 
              style={{ color: '#fca5a5', justifyContent: 'center', fontSize: '0.85rem' }}
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </nav>
      </aside>

      {/* 2. Main Content Area */}
      <main className="vendor-main-content">
        
        {/* Top Header Row for non-overview tabs */}
        {activeTab !== 'overview' && (
          <div className="vendor-topbar">
            <div>
              <h1>{getPageTitle()}</h1>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '4px 0 0 0' }}>{getPageSubtitle()}</p>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {activeTab === 'spaces' && (
                <button
                  onClick={() => setShowAddSpaceModal(true)}
                  className="btn-primary-light"
                >
                  <Plus size={16} /> Add Venue
                </button>
              )}
              {activeTab === 'services' && (
                <button
                  onClick={() => setShowAddServiceModal(true)}
                  className="btn-primary-light"
                >
                  <Plus size={16} /> Add Service
                </button>
              )}
            </div>
          </div>
        )}

        {/* 4. Tab: OVERVIEW (Inspiration Layout) */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Hero Greeting Banner matching inspiration */}
            <div className="vendor-hero-banner">
              <div className="vendor-hero-left">
                <h1 className="vendor-hero-title">
                  {greetingTime}, {vendorFirstName} 👋
                </h1>
                <p className="vendor-hero-subtitle">
                  Manage your venues and services, track bookings, and grow your business.
                </p>
              </div>

              <div className="vendor-hero-right">
                <div className="vendor-hero-image-bg" />
                <button 
                  className="btn-add-listing-hero"
                  onClick={() => setShowAddListingDropdown(prev => !prev)}
                >
                  <Plus size={18} /> Add New Listing
                </button>

                {/* Dropdown to add Venue or Service */}
                {showAddListingDropdown && (
                  <div className="listing-dropdown-menu">
                    <button
                      className="listing-dropdown-item"
                      onClick={() => {
                        setShowAddListingDropdown(false);
                        setShowAddSpaceModal(true);
                      }}
                    >
                      <Building2 size={18} color="#0d8a73" />
                      <span>Add Venue / Space</span>
                    </button>
                    <button
                      className="listing-dropdown-item"
                      onClick={() => {
                        setShowAddListingDropdown(false);
                        setShowAddServiceModal(true);
                      }}
                    >
                      <Package size={18} color="#0d8a73" />
                      <span>Add Service Package</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 4 KPI Stat Cards with Real Data */}
            <div className="inspo-stat-grid">
              
              {/* Card 1: Total Listings */}
              <div className="inspo-stat-card" onClick={() => setActiveTab('spaces')}>
                <div className="inspo-stat-icon-wrap mint">
                  <Building2 size={24} />
                </div>
                <div className="inspo-stat-info">
                  <span className="inspo-stat-label">Total Listings</span>
                  <span className="inspo-stat-value">{spaces.length + services.length}</span>
                  <div className="inspo-stat-delta">
                    <span className="delta-label">{spaces.length} venues · {services.length} services</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Pending Requests */}
              <div className="inspo-stat-card" onClick={() => setActiveTab('bookings')}>
                <div className="inspo-stat-icon-wrap amber">
                  <Calendar size={24} />
                </div>
                <div className="inspo-stat-info">
                  <span className="inspo-stat-label">Pending Requests</span>
                  <span className="inspo-stat-value">{pendingRequestsCount}</span>
                  <div className="inspo-stat-delta">
                    <span className={pendingRequestsCount > 0 ? "delta-up" : "delta-label"} style={pendingRequestsCount > 0 ? { color: '#d97706' } : {}}>
                      {pendingRequestsCount === 0 ? 'No pending requests' : `${pendingRequestsCount} awaiting review`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Confirmed Bookings */}
              <div className="inspo-stat-card" onClick={() => setActiveTab('bookings')}>
                <div className="inspo-stat-icon-wrap blue">
                  <CalendarCheck size={24} />
                </div>
                <div className="inspo-stat-info">
                  <span className="inspo-stat-label">Confirmed Bookings</span>
                  <span className="inspo-stat-value">
                    {bookings.filter(b => b.status === 'APPROVED' || b.status === 'COMPLETED').length}
                  </span>
                  <div className="inspo-stat-delta">
                    <span className="delta-label">
                      {bookings.filter(b => b.status === 'APPROVED' || b.status === 'COMPLETED').length === 0 ? 'No confirmed bookings' : 'Active and scheduled'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 4: Total Earnings */}
              <div className="inspo-stat-card">
                <div className="inspo-stat-icon-wrap purple">
                  <MessageSquare size={24} />
                </div>
                <div className="inspo-stat-info">
                  <span className="inspo-stat-label">Total Earnings</span>
                  <span className="inspo-stat-value">
                    KES {totalRevenue.toLocaleString()}
                  </span>
                  <div className="inspo-stat-delta">
                    <span className="delta-label">
                      {totalRevenue === 0 ? 'From completed events' : `From ${bookings.filter(b => b.status === 'APPROVED' || b.status === 'COMPLETED').length} events`}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Split Lower Layout: Your Listings (Left) + Booking Requests (Right) */}
            <div className="inspo-overview-grid">
              
              {/* Left Column: Your Listings */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Your Listings
                  </h2>
                  
                  {/* Category Pills */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {['ALL', 'VENUES', 'DECORATION', 'PHOTOGRAPHY', 'CATERING', 'MUSIC & DJ'].map(cat => (
                      <button
                        key={cat}
                        className={`filter-pill ${listingsCategoryFilter === cat ? 'active' : ''}`}
                        onClick={() => setListingsCategoryFilter(cat)}
                        style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                      >
                        {cat === 'ALL' ? 'All' : cat === 'VENUES' ? 'Venues' : cat === 'MUSIC & DJ' ? 'Music & DJ' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Listings Display Grid */}
                {(() => {
                  const allItems = [
                    ...spaces.map(s => ({ ...s, itemKind: 'VENUE' as const })),
                    ...services.map(s => ({ ...s, itemKind: 'SERVICE' as const }))
                  ];
                  
                  const filtered = allItems.filter(item => {
                    if (listingsCategoryFilter === 'ALL') return true;
                    if (listingsCategoryFilter === 'VENUES') return item.itemKind === 'VENUE';
                    if (listingsCategoryFilter === 'DECORATION') return item.category?.toUpperCase().includes('DECOR');
                    if (listingsCategoryFilter === 'PHOTOGRAPHY') return item.category?.toUpperCase().includes('PHOTO');
                    if (listingsCategoryFilter === 'CATERING') return item.category?.toUpperCase().includes('CATER');
                    if (listingsCategoryFilter === 'MUSIC & DJ') return item.category?.toUpperCase().includes('DJ') || item.category?.toUpperCase().includes('MUSIC');
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="dashboard-card" style={{ padding: '36px 24px', textAlign: 'center', background: '#ffffff' }}>
                        <div style={{ width: '48px', height: '48px', background: '#ccfbf1', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#0d8a73', marginBottom: '12px' }}>
                          <Building2 size={24} />
                        </div>
                        <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>No listings found in this category</h4>
                        <p style={{ margin: '0 0 18px', fontSize: '0.86rem', color: '#64748b' }}>
                          Click the button below to add your first listing in this category.
                        </p>
                        <button
                          className="btn-primary-light"
                          onClick={() => {
                            if (listingsCategoryFilter === 'VENUES') setShowAddSpaceModal(true);
                            else setShowAddServiceModal(true);
                          }}
                        >
                          <Plus size={16} /> Add Listing Now
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                      {filtered.slice(0, 6).map(item => (
                        <div key={`${item.itemKind}-${item.id}`} className="listing-card" style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                          <div style={{ position: 'relative', height: '150px', background: '#f1f5f9' }}>
                            <img
                              src={cleanImageUrl(item.image_url) || (item.itemKind === 'VENUE' ? DEFAULT_SPACE_IMAGE : DEFAULT_SERVICE_IMAGE)}
                              alt={item.title}
                              onError={(e) => handleImageError(e, item.itemKind === 'VENUE' ? DEFAULT_SPACE_IMAGE : DEFAULT_SERVICE_IMAGE)}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <span 
                              style={{ 
                                position: 'absolute', 
                                top: '10px', 
                                left: '10px', 
                                background: item.itemKind === 'VENUE' ? '#064e3b' : '#0284c7', 
                                color: '#ffffff', 
                                fontSize: '0.72rem', 
                                fontWeight: 700, 
                                padding: '3px 8px', 
                                borderRadius: '6px',
                                textTransform: 'uppercase'
                              }}
                            >
                              {item.itemKind === 'VENUE' ? 'Venue' : item.category || 'Service'}
                            </span>
                            <span 
                              className={`status-badge ${item.is_verified ? 'approved' : 'pending'}`}
                              style={{ position: 'absolute', top: '10px', right: '10px' }}
                            >
                              {item.is_verified ? 'Verified' : 'Pending'}
                            </span>
                          </div>

                          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.title}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                              <span style={{ fontWeight: 800, color: '#0d8a73' }}>
                                KES {Number(item.price_per_day).toLocaleString()}
                                {item.itemKind === 'VENUE' ? '/day' : ''}
                              </span>
                              {item.itemKind === 'VENUE' && item.capacity && (
                                <span style={{ color: '#64748b', fontSize: '0.78rem' }}>
                                  Cap: {item.capacity}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Right Column: Booking Requests */}
              <div className="dashboard-card" style={{ padding: '20px 22px', height: 'fit-content' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                      Booking Requests
                    </h3>
                    {pendingRequestsCount > 0 && (
                      <span className="vendor-nav-badge-red" style={{ margin: 0 }}>
                        {pendingRequestsCount}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveTab('bookings')}
                    style={{ background: 'none', border: 'none', color: '#0d8a73', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    View All <ChevronRight size={15} />
                  </button>
                </div>

                {/* Booking List */}
                {bookings.length === 0 ? (
                  <div style={{ padding: '36px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <div style={{ width: '44px', height: '44px', background: '#ccfbf1', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#0d8a73', marginBottom: '10px' }}>
                      <CalendarCheck size={20} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '4px' }}>No booking requests yet</div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, maxWidth: '240px', margin: '0 auto' }}>
                      When clients book your venues or services, real requests will appear here instantly.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {bookings.slice(0, 4).map((req: any) => (
                      <div 
                        key={req.id} 
                        style={{ 
                          padding: '12px', 
                          background: '#f8fafc', 
                          borderRadius: '12px', 
                          border: '1px solid #f1f5f9',
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '8px' 
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#ccfbf1', color: '#0d8a73', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {(req.customer_name || 'C').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>{req.customer_name || 'Client'}</div>
                              <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{req.event_title || req.event_type || 'Event Request'}</div>
                            </div>
                          </div>
                          <span className={`status-badge ${(req.status || 'pending').toLowerCase()}`}>
                            {req.status}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px dashed #e2e8f0', fontSize: '0.78rem' }}>
                          <span style={{ color: '#64748b' }}>📅 {req.event_date || 'Date TBD'}</span>
                          <span style={{ fontWeight: 800, color: '#0d8a73' }}>KES {Number(req.total_price || 0).toLocaleString()}</span>
                        </div>

                        {req.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                            <button
                              onClick={() => handleUpdateBookingStatus(req.id, 'APPROVED')}
                              style={{ flex: 1, padding: '6px', background: '#0d8a73', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            >
                              <Check size={13} /> Approve
                            </button>
                            <button
                              onClick={() => handleUpdateBookingStatus(req.id, 'REJECTED')}
                              style={{ flex: 1, padding: '6px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            >
                              <X size={13} /> Decline
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* 5. Tab: MY SPACES */}
        {activeTab === 'spaces' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`filter-pill ${spaceFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setSpaceFilter('ALL')}
                >
                  All Spaces ({spaces.length})
                </button>
                <button 
                  className={`filter-pill ${spaceFilter === 'APPROVED' ? 'active' : ''}`}
                  onClick={() => setSpaceFilter('APPROVED')}
                >
                  Verified ({activeSpacesCount})
                </button>
                <button 
                  className={`filter-pill ${spaceFilter === 'PENDING' ? 'active' : ''}`}
                  onClick={() => setSpaceFilter('PENDING')}
                >
                  Pending ({spaces.length - activeSpacesCount})
                </button>
              </div>
            </div>

            {filteredSpaces.length === 0 ? (
              <div className="dashboard-card" style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                <Building2 size={40} color="#cbd5e1" style={{ marginBottom: '12px' }} />
                <h3 style={{ margin: '0 0 8px', color: '#0f172a' }}>No spaces found in this category</h3>
                <p style={{ margin: '0 0 20px', fontSize: '0.9rem' }}>Add wedding gardens, conference halls, or event spaces to start taking bookings.</p>
                <button onClick={() => setShowAddSpaceModal(true)} className="btn-primary-light" style={{ background: '#0d8a73', color: '#fff' }}>
                  <Plus size={16} /> Add an Event Space
                </button>
              </div>
            ) : (
              <div className="listing-grid">
                {filteredSpaces.map(s => (
                  <div key={s.id} className="listing-card">
                    <div style={{ position: 'relative', height: '180px', background: '#f1f5f9' }}>
                      <img 
                        src={cleanImageUrl(s.image_url) || DEFAULT_SPACE_IMAGE} 
                        alt={s.title} 
                        onError={(e) => handleImageError(e, DEFAULT_SPACE_IMAGE)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                      <span className={`status-badge ${s.is_verified ? 'approved' : 'pending'}`} style={{ position: 'absolute', top: '12px', right: '12px' }}>
                        {s.is_verified ? 'Verified Space' : 'Pending Review'}
                      </span>
                    </div>

                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0d8a73', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                        {s.category_display || s.category}
                      </div>
                      <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                        {s.title}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.85rem', marginBottom: '12px' }}>
                        <MapPin size={14} color="#0d8a73" /> {s.location}
                      </div>

                      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', fontSize: '0.85rem', color: '#475569' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={14} /> {s.capacity} Guests</span>
                      </div>

                      <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Daily Rate</span>
                          <span style={{ fontWeight: 800, color: '#0d8a73', fontSize: '1.1rem' }}>
                            KES {Number(s.price_per_day).toLocaleString()}
                          </span>
                        </div>

                        <button
                          onClick={() => handleDeleteListing(s.id, s.title)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', padding: '6px', cursor: 'pointer', borderRadius: '6px' }}
                          title="Delete space"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 6. Tab: MY SERVICES */}
        {activeTab === 'services' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`filter-pill ${serviceFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setServiceFilter('ALL')}
                >
                  All Services ({services.length})
                </button>
                <button 
                  className={`filter-pill ${serviceFilter === 'APPROVED' ? 'active' : ''}`}
                  onClick={() => setServiceFilter('APPROVED')}
                >
                  Verified ({activeServicesCount})
                </button>
                <button 
                  className={`filter-pill ${serviceFilter === 'PENDING' ? 'active' : ''}`}
                  onClick={() => setServiceFilter('PENDING')}
                >
                  Pending ({services.length - activeServicesCount})
                </button>
              </div>
            </div>

            {filteredServices.length === 0 ? (
              <div className="dashboard-card" style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                <Package size={40} color="#cbd5e1" style={{ marginBottom: '12px' }} />
                <h3 style={{ margin: '0 0 8px', color: '#0f172a' }}>No services found in this category</h3>
                <p style={{ margin: '0 0 20px', fontSize: '0.9rem' }}>Add catering packages, DJ setups, or photography services.</p>
                <button onClick={() => setShowAddServiceModal(true)} className="btn-primary-light" style={{ background: '#0d8a73', color: '#fff' }}>
                  <Plus size={16} /> Add a Service
                </button>
              </div>
            ) : (
              <div className="listing-grid">
                {filteredServices.map(s => (
                  <div key={s.id} className="listing-card">
                    <div style={{ position: 'relative', height: '180px', background: '#f1f5f9' }}>
                      <img 
                        src={cleanImageUrl(s.image_url) || DEFAULT_SERVICE_IMAGE} 
                        alt={s.title} 
                        onError={(e) => handleImageError(e, DEFAULT_SERVICE_IMAGE)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                      <span className={`status-badge ${s.is_verified ? 'approved' : 'pending'}`} style={{ position: 'absolute', top: '12px', right: '12px' }}>
                        {s.is_verified ? 'Verified Service' : 'Pending Review'}
                      </span>
                    </div>

                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0d8a73', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                        {s.category_display || s.category}
                      </div>
                      <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                        {s.title}
                      </h3>
                      <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#64748b', lineClamp: 2, WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {s.description}
                      </p>

                      <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Starting Package Fee</span>
                          <span style={{ fontWeight: 800, color: '#0d8a73', fontSize: '1.1rem' }}>
                            KES {Number(s.price_per_day).toLocaleString()}
                          </span>
                        </div>

                        <button
                          onClick={() => handleDeleteListing(s.id, s.title)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', padding: '6px', cursor: 'pointer', borderRadius: '6px' }}
                          title="Delete service"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 7. Tab: BOOKINGS */}
        {activeTab === 'bookings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Filters Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={`filter-pill ${bookingFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setBookingFilter('ALL')}
                >
                  All Inquiries ({bookings.length})
                </button>
                <button
                  className={`filter-pill ${bookingFilter === 'SPACES' ? 'active' : ''}`}
                  onClick={() => setBookingFilter('SPACES')}
                >
                  Spaces Only
                </button>
                <button
                  className={`filter-pill ${bookingFilter === 'SERVICES' ? 'active' : ''}`}
                  onClick={() => setBookingFilter('SERVICES')}
                >
                  Services Only
                </button>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                {(['ALL', 'PENDING', 'APPROVED', 'CANCELLED'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setBookingStatusFilter(st)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: bookingStatusFilter === st ? '#1e293b' : '#fff',
                      color: bookingStatusFilter === st ? '#fff' : '#64748b',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {filteredBookings.length === 0 ? (
              <div className="dashboard-card" style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                No bookings match your current filter selection.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {filteredBookings.map(b => (
                  <div key={b.id} className="dashboard-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', padding: '20px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>{b.event_title}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: '#e0f2fe', color: '#0369a1' }}>
                          {b.event_type}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <span>👤 Client: <strong>{b.customer_name}</strong></span>
                        <span>📅 Date: <strong>{b.event_date}</strong></span>
                        <span>👥 Guests: <strong>{b.guest_count}</strong></span>
                      </div>
                      {b.notes && (
                        <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#475569', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px' }}>
                          💬 Notes: {b.notes}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Quote</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0d8a73' }}>
                          KES {Number(b.total_price).toLocaleString()}
                        </div>
                      </div>

                      <span className={`status-badge ${b.status.toLowerCase()}`}>
                        {b.status}
                      </span>

                      {b.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleUpdateBookingStatus(b.id, 'APPROVED')}
                            style={{ background: '#0d8a73', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleUpdateBookingStatus(b.id, 'REJECTED')}
                            style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 8. Tab: CALENDAR */}
        {activeTab === 'calendar' && (
          <div className="dashboard-card" style={{ padding: '32px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Scheduled Bookings & Event Calendar</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '24px' }}>All confirmed and approved bookings for your spaces and services appear here chronologically.</p>
            {bookings.filter(b => b.status === 'APPROVED').length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px' }}>
                No events currently scheduled. When you approve booking requests, they will populate here.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {bookings.filter(b => b.status === 'APPROVED').map(b => (
                  <div key={b.id} style={{ padding: '16px 20px', borderLeft: '4px solid #0d8a73', background: '#f8fafc', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.02rem', color: '#0f172a' }}>{b.event_title}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>Date: {b.event_date} · Client: {b.customer_name} · Guests: {b.guest_count}</div>
                    </div>
                    <span style={{ fontWeight: 800, color: '#0d8a73', fontSize: '1.1rem' }}>
                      KES {Number(b.total_price).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 9. Tab: REVIEWS */}
        {activeTab === 'reviews' && (
          <div className="dashboard-card" style={{ padding: '32px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Customer Reviews & Ratings</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '24px', background: '#f8fafc', borderRadius: '12px', marginBottom: '24px' }}>
              <div style={{ fontSize: '2.8rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>4.9</div>
              <div>
                <div style={{ display: 'flex', gap: '4px', color: '#fbbf24' }}>
                  <Star fill="#fbbf24" size={20} />
                  <Star fill="#fbbf24" size={20} />
                  <Star fill="#fbbf24" size={20} />
                  <Star fill="#fbbf24" size={20} />
                  <Star fill="#fbbf24" size={20} />
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '6px' }}>Based on verified customer bookings across all your listings</div>
              </div>
            </div>
            <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
              Client reviews from completed events automatically display here with detailed feedback and ratings.
            </div>
          </div>
        )}

        {/* 9. Tab: MESSAGES */}
        {activeTab === 'messages' && (
          bookings.length === 0 ? (
            <div className="dashboard-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', background: '#ccfbf1', borderRadius: '14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#0d8a73', marginBottom: '14px' }}>
                <MessageSquare size={26} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>No Messages Yet</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '380px', margin: '0 auto 20px' }}>
                When clients submit booking requests or inquiries for your listings, you can communicate and coordinate event details with them directly here.
              </p>
              <button onClick={() => setActiveTab('spaces')} className="btn-primary-light" style={{ padding: '10px 20px', borderRadius: '10px' }}>
                Manage Listings
              </button>
            </div>
          ) : (() => {
            const currentChatBooking = bookings.find(b => b.id === selectedBookingChatId) || bookings[0];
            const clientName = currentChatBooking?.customer_name || 'Client';
            const clientInitial = clientName.charAt(0).toUpperCase();

            return (
              <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden', minHeight: '520px', display: 'flex' }}>
                {/* Conversation List */}
                <div style={{ width: '320px', borderRight: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '20px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>Messages</h3>
                    {pendingRequestsCount > 0 && (
                      <span className="vendor-nav-badge-red" style={{ margin: 0 }}>{pendingRequestsCount} new</span>
                    )}
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {bookings.map(b => {
                      const isSelected = (currentChatBooking?.id === b.id);
                      return (
                        <div
                          key={b.id}
                          onClick={() => setSelectedBookingChatId(b.id)}
                          style={{
                            padding: '14px 18px',
                            borderBottom: '1px solid #f1f5f9',
                            background: isSelected ? '#ffffff' : 'transparent',
                            cursor: 'pointer',
                            borderLeft: isSelected ? '4px solid #0d8a73' : '4px solid transparent',
                            transition: 'background 0.2s'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                              {b.customer_name || 'Client'}
                            </span>
                            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{b.event_date || ''}</span>
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#0d8a73', fontWeight: 600, marginBottom: '2px' }}>
                            {b.event_title || b.event_type}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {b.notes ? `"${b.notes}"` : `Booking request · KES ${Number(b.total_price || 0).toLocaleString()}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Chat Conversation View */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
                  <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ccfbf1', color: '#0d8a73', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {clientInitial}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#0f172a' }}>{clientName}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          Inquiring about {currentChatBooking?.event_title || 'Booking'} · Date: {currentChatBooking?.event_date || 'TBD'}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setActiveTab('bookings')}
                      className="btn-primary-light" 
                      style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                    >
                      View Booking
                    </button>
                  </div>

                  {/* Message Bubbles */}
                  <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ alignSelf: 'flex-start', maxWidth: '75%', background: '#f1f5f9', padding: '12px 16px', borderRadius: '14px 14px 14px 2px', fontSize: '0.9rem', color: '#1e293b', lineHeight: 1.5 }}>
                      {currentChatBooking?.notes 
                        ? currentChatBooking.notes 
                        : `Hello! I have placed a booking request for "${currentChatBooking?.event_title}" on ${currentChatBooking?.event_date} for ${currentChatBooking?.guest_count || 1} guest(s). Looking forward to your response.`}
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px', textAlign: 'right' }}>
                        {currentChatBooking?.event_date || 'Recent'}
                      </div>
                    </div>

                    <div style={{ alignSelf: 'flex-end', maxWidth: '75%', background: '#0d8a73', color: '#ffffff', padding: '12px 16px', borderRadius: '14px 14px 2px 14px', fontSize: '0.9rem', lineHeight: 1.5 }}>
                      Status: {currentChatBooking?.status}. You can coordinate event details, quotes, or schedule with {clientName} here.
                      <div style={{ fontSize: '0.72rem', color: '#a7f3d0', marginTop: '4px', textAlign: 'right' }}>Active Booking</div>
                    </div>
                  </div>

                  {/* Reply Box */}
                  <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder={`Type your reply to ${clientName}...`}
                      value={messageInput}
                      onChange={e => setMessageInput(e.target.value)}
                      style={{ flex: 1, padding: '12px 16px', borderRadius: '9999px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && messageInput.trim()) {
                          toast.success(`Message sent to ${clientName}!`);
                          setMessageInput('');
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (messageInput.trim()) {
                          toast.success(`Message sent to ${clientName}!`);
                          setMessageInput('');
                        } else {
                          toast.error("Please enter a message.");
                        }
                      }}
                      className="btn-primary-light"
                      style={{ borderRadius: '9999px', padding: '12px 20px' }}
                    >
                      <Send size={16} /> Send
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
        )}

        {/* 10. Tab: VENDOR PROFILE */}
        {activeTab === 'profile' && (
          <div className="dashboard-card" style={{ maxWidth: '720px', padding: '32px' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>Vendor Profile & Branding</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '24px' }}>Update public vendor credentials, branding logo, and contact info.</p>

            {/* Profile Avatar Upload */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px', paddingBottom: '24px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {currentVendor?.logo_url ? (
                  <img src={currentVendor.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <UserIcon size={36} color="#94a3b8" />
                )}
              </div>
              <div>
                <label style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: isUploading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', display: 'inline-block' }}>
                  {isUploading ? 'Uploading...' : 'Change Vendor Logo'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePictureUpload} disabled={isUploading} />
                </label>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '6px' }}>JPG, PNG or GIF up to 5MB</div>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Vendor / Business Name</label>
                <input 
                  type="text" 
                  value={profileFormData.business_name} 
                  onChange={e => setProfileFormData({...profileFormData, business_name: e.target.value})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Primary City / Location</label>
                  <input 
                    type="text" 
                    value={profileFormData.location} 
                    onChange={e => setProfileFormData({...profileFormData, location: e.target.value})}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Contact Phone</label>
                  <input 
                    type="text" 
                    value={profileFormData.contact_phone} 
                    onChange={e => setProfileFormData({...profileFormData, contact_phone: e.target.value})}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Public Contact Email</label>
                <input 
                  type="email" 
                  value={profileFormData.contact_email} 
                  onChange={e => setProfileFormData({...profileFormData, contact_email: e.target.value})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Vendor Description & Overview</label>
                <textarea 
                  rows={4} 
                  value={profileFormData.description} 
                  onChange={e => setProfileFormData({...profileFormData, description: e.target.value})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <button 
                type="submit" 
                className="btn-primary-light"
                style={{ background: '#0d8a73', color: '#fff', padding: '12px 20px', borderRadius: '8px', fontWeight: 700, width: 'fit-content' }}
              >
                Save Vendor Profile
              </button>
            </form>
          </div>
        )}

        {/* 11. Tab: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="dashboard-card" style={{ maxWidth: '640px', padding: '32px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Account & Platform Settings</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '24px' }}>Manage notification preferences and security for your business account.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Email Notifications for New Bookings</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Receive instant alerts when clients request your services</div>
                </div>
                <input type="checkbox" defaultChecked style={{ transform: 'scale(1.2)' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>SMS Alert Notifications</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Get urgent booking reminder messages on your phone</div>
                </div>
                <input type="checkbox" defaultChecked style={{ transform: 'scale(1.2)' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Public Discovery Listing</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Allow customers to find your spaces and services on the main explore feed</div>
                </div>
                <input type="checkbox" defaultChecked style={{ transform: 'scale(1.2)' }} />
              </div>
            </div>
          </div>
        )}

      </main>

      {/* MODAL: ADD SPACE */}
      {showAddSpaceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Add New Event Space</h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>List an event hall, garden, or conference space.</p>
              </div>
              <button onClick={() => setShowAddSpaceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            {spaceErrorNotice && (
              <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '12px 16px', color: '#991b1b', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <AlertCircle size={18} />
                <span>{spaceErrorNotice}</span>
              </div>
            )}

            <form onSubmit={handleAddSpaceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Space Title / Venue Name *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Serena Grand Ballroom"
                  value={newSpace.title} 
                  onChange={e => setNewSpace({...newSpace, title: e.target.value})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Category *</label>
                  <select 
                    value={newSpace.category} 
                    onChange={e => setNewSpace({...newSpace, category: e.target.value as any})}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="WEDDING">Wedding Hall</option>
                    <option value="CONFERENCE">Conference Room</option>
                    <option value="PARTY">Party Venue</option>
                    <option value="BANQUET">Banquet Hall</option>
                    <option value="OUTDOOR">Outdoor / Garden</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Guest Capacity *</label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    placeholder="e.g. 300"
                    value={newSpace.capacity} 
                    onChange={e => setNewSpace({...newSpace, capacity: Number(e.target.value)})}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Location (City) *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Nairobi"
                    value={newSpace.location} 
                    onChange={e => setNewSpace({...newSpace, location: e.target.value})}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Daily Rate (KES) *</label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    placeholder="e.g. 75000"
                    value={newSpace.price_per_day} 
                    onChange={e => setNewSpace({...newSpace, price_per_day: Number(e.target.value)})}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Amenities (comma-separated)</label>
                <input 
                  type="text" 
                  placeholder="Parking, Sound System, Restrooms, Security, Wi-Fi"
                  value={newSpace.amenities} 
                  onChange={e => setNewSpace({...newSpace, amenities: e.target.value})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Image URL</label>
                <input 
                  type="url" 
                  placeholder="https://images.unsplash.com/..."
                  value={newSpace.image_url} 
                  onChange={e => setNewSpace({...newSpace, image_url: e.target.value})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Description *</label>
                <textarea 
                  rows={3} 
                  required
                  placeholder="Describe your space, layout, lighting, and suitable event types..."
                  value={newSpace.description} 
                  onChange={e => setNewSpace({...newSpace, description: e.target.value})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowAddSpaceModal(false)}
                  style={{ padding: '10px 18px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  style={{ padding: '10px 22px', background: '#0d8a73', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
                >
                  {submitting ? 'Saving Space...' : 'Create Event Space'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD SERVICE */}
      {showAddServiceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Add Professional Service</h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Offer catering, photography, DJ sound, or event decor.</p>
              </div>
              <button onClick={() => setShowAddServiceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            {serviceErrorNotice && (
              <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '12px 16px', color: '#991b1b', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <AlertCircle size={18} />
                <span>{serviceErrorNotice}</span>
              </div>
            )}

            <form onSubmit={handleAddServiceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Service Name *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Executive Wedding Photography Package"
                  value={newService.title} 
                  onChange={e => setNewService({...newService, title: e.target.value})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Category *</label>
                  <select 
                    value={newService.category} 
                    onChange={e => setNewService({...newService, category: e.target.value})}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="PHOTOGRAPHY">Photography & Video</option>
                    <option value="CATERING">Catering & Bar</option>
                    <option value="DECORATION">Decoration & Floral</option>
                    <option value="ENTERTAINMENT">DJ & Live Music</option>
                    <option value="PLANNING">Full Event Planning</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Pricing Model *</label>
                  <select 
                    value={newService.pricing_type} 
                    onChange={e => setNewService({...newService, pricing_type: e.target.value})}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="Per Event">Per Event / Flat Package</option>
                    <option value="Per Hour">Per Hour</option>
                    <option value="Per Person">Per Person / Guest</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Starting Price (KES) *</label>
                <input 
                  type="number" 
                  required
                  min="1"
                  placeholder="e.g. 25000"
                  value={newService.price_per_day} 
                  onChange={e => setNewService({...newService, price_per_day: Number(e.target.value)})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Service Cover Image URL</label>
                <input 
                  type="url" 
                  placeholder="https://images.unsplash.com/..."
                  value={newService.image_url} 
                  onChange={e => setNewService({...newService, image_url: e.target.value})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Package Details & Inclusions *</label>
                <textarea 
                  rows={3} 
                  required
                  placeholder="What is included in this package? (e.g. 8 hours coverage, 2 photographers, edited digital album...)"
                  value={newService.description} 
                  onChange={e => setNewService({...newService, description: e.target.value})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowAddServiceModal(false)}
                  style={{ padding: '10px 18px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  style={{ padding: '10px 22px', background: '#0d8a73', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
                >
                  {submitting ? 'Saving Service...' : 'Create Service Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
