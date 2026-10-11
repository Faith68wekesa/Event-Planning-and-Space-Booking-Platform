import React, { useState, useEffect, useCallback } from 'react';
import type { Booking, Venue, BookingStatus, Vendor, VenueOwner, VenueCategory, User } from '../types';
import { ApiService } from '../services/api';
import {
  Building2,
  Plus,
  XCircle,
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
  Sparkles,
  DollarSign,
  ChevronRight,
  Eye,
  AlertCircle,
  Image as ImageIcon
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
  const [activeTab, setActiveTab] = useState<'overview' | 'spaces' | 'services' | 'bookings' | 'calendar' | 'reviews' | 'profile' | 'settings'>('overview');
  
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

      // Fetch bookings specifically for this business provider
      if (ownerId) {
        const ownerBookings = await ApiService.getVenueOwnerBookings(ownerId);
        fetchedBookings = [...fetchedBookings, ...ownerBookings];
      }
      if (vendorId) {
        const vendorBookings = await ApiService.getVendorBookings(vendorId);
        const existingIds = new Set(fetchedBookings.map(b => b.id));
        vendorBookings.forEach(b => {
          if (!existingIds.has(b.id)) fetchedBookings.push(b);
        });
      }

      // Query only listings belonging to this specific business provider
      const providerVenues = await ApiService.getVenues({
        user: userId,
        owner: ownerId,
        vendor: vendorId,
      });

      // Strict ownership check: only include venues and services belonging to this provider
      const isMyListing = (v: Venue) => {
        const vOwnerId = typeof v.owner === 'object' ? (v.owner as any)?.id : v.owner;
        const vVendorId = typeof v.vendor === 'object' ? (v.vendor as any)?.id : v.vendor;

        const matchesOwner = Boolean(ownerId && vOwnerId === ownerId);
        const matchesVendor = Boolean(vendorId && vVendorId === vendorId);

        return matchesOwner || matchesVendor;
      };

      const myOwnListings = providerVenues.filter(isMyListing);

      // Separate into spaces (capacity > 0) and services (capacity === 0)
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

  // Add Space Submit
  const handleAddSpaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentVenueOwner?.id && !currentVendor?.id) {
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
        owner: currentVenueOwner?.id,
        vendor: currentVendor?.id,
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

      toast.success("Event space submitted! Awaiting platform verification.");
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
    if (!currentVendor?.id && !currentVenueOwner?.id) {
      toast.error("Profile not found.");
      return;
    }
    setSubmitting(true);
    setServiceErrorNotice(null);
    try {
      await ApiService.addVenue({
        vendor: currentVendor?.id,
        owner: currentVenueOwner?.id,
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

  const hasNoListings = spaces.length === 0 && services.length === 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', color: '#1e293b' }}>
      
      {/* 1. Unified Sidebar */}
      <aside style={{ width: '260px', background: '#ffffff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Brand / Logo */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', background: '#0F8F7A', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.2rem' }}>
              L
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0F8F7A' }}>Locyfy</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Business Provider</div>
            </div>
          </div>
        </div>

        {/* Business Badge */}
        <div style={{ padding: '16px 20px', background: '#f1f5f9', margin: '12px 16px', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {businessName}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#0F8F7A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <ShieldCheck size={13} /> Verified Business
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
          <NavItem 
            icon={<LayoutDashboard size={18} />} 
            label="Overview" 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')} 
          />
          <NavItem 
            icon={<Building2 size={18} />} 
            label="My Spaces" 
            badge={spaces.length} 
            active={activeTab === 'spaces'} 
            onClick={() => setActiveTab('spaces')} 
          />
          <NavItem 
            icon={<Package size={18} />} 
            label="My Services" 
            badge={services.length} 
            active={activeTab === 'services'} 
            onClick={() => setActiveTab('services')} 
          />
          <NavItem 
            icon={<CalendarCheck size={18} />} 
            label="Booking Requests" 
            badge={pendingRequestsCount > 0 ? pendingRequestsCount : undefined}
            badgeColor="#ef4444"
            active={activeTab === 'bookings'} 
            onClick={() => setActiveTab('bookings')} 
          />
          <NavItem 
            icon={<Calendar size={18} />} 
            label="Calendar" 
            active={activeTab === 'calendar'} 
            onClick={() => setActiveTab('calendar')} 
          />
          <NavItem 
            icon={<Star size={18} />} 
            label="Reviews" 
            active={activeTab === 'reviews'} 
            onClick={() => setActiveTab('reviews')} 
          />
          <NavItem 
            icon={<UserIcon size={18} />} 
            label="Business Profile" 
            active={activeTab === 'profile'} 
            onClick={() => setActiveTab('profile')} 
          />
          <NavItem 
            icon={<Settings size={18} />} 
            label="Settings" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
          />
        </nav>

        {/* Sidebar Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {onExplore && (
            <button
              onClick={onExplore}
              style={{ width: '100%', padding: '10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0F8F7A', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <Eye size={15} /> Switch to Customer View
            </button>
          )}
          <button
            onClick={onLogout}
            style={{ width: '100%', padding: '10px', background: 'none', border: 'none', borderRadius: '8px', color: '#ef4444', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <LogOut size={16} /> Log Out
          </button>
        </div>
      </aside>

      {/* 2. Main Dashboard Content */}
      <main style={{ flexGrow: 1, padding: '32px', overflowY: 'auto', maxHeight: '100vh' }}>
        
        {/* Top Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
              {activeTab === 'overview' && 'Business Overview'}
              {activeTab === 'spaces' && 'My Event Spaces'}
              {activeTab === 'services' && 'My Services'}
              {activeTab === 'bookings' && 'Booking Requests & Management'}
              {activeTab === 'calendar' && 'Bookings Calendar'}
              {activeTab === 'reviews' && 'Client Reviews & Ratings'}
              {activeTab === 'profile' && 'Business Profile Settings'}
              {activeTab === 'settings' && 'Account Settings'}
            </h1>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>
              {activeTab === 'overview' && 'Manage your spaces, services, bookings, and revenue in one unified place.'}
              {activeTab === 'spaces' && 'List, edit, and organize all your physical event spaces and venues.'}
              {activeTab === 'services' && 'Create and manage your event services, packages, and vendor pricing.'}
              {activeTab === 'bookings' && 'Review incoming customer booking inquiries and confirm schedules.'}
              {activeTab === 'calendar' && 'Track upcoming approved events and venue reservations.'}
              {activeTab === 'reviews' && 'Feedback from clients who booked your spaces or services.'}
              {activeTab === 'profile' && 'Update your business branding, contact details, and location.'}
              {activeTab === 'settings' && 'Platform preferences and security settings.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setShowAddSpaceModal(true)}
              style={{ background: '#0F8F7A', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(15, 143, 122, 0.2)' }}
            >
              <Plus size={16} /> Add Space
            </button>
            <button
              onClick={() => setShowAddServiceModal(true)}
              style={{ background: '#14213D', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <Plus size={16} /> Add Service
            </button>
          </div>
        </div>

        {/* 3. Empty State (Step 7: Dynamic Empty States with calls-to-action) */}
        {hasNoListings && activeTab === 'overview' && (
          <div style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '48px 32px', textAlign: 'center', marginBottom: '32px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ width: '64px', height: '64px', background: '#ccfbf1', borderRadius: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#0F8F7A', marginBottom: '20px' }}>
              <Sparkles size={32} />
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>
              Welcome to Your Business Provider Hub!
            </h2>
            <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: '580px', margin: '0 auto 32px', lineHeight: 1.6 }}>
              You don't have any active listings yet. As a unified business provider on Locyfy, you can list event spaces, offer services, or both. Choose an option below to get started:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', maxWidth: '720px', margin: '0 auto' }}>
              {/* Add Space Card */}
              <div 
                style={{ background: '#f8fafc', border: '2px dashed #0F8F7A', borderRadius: '16px', padding: '28px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s' }}
                onClick={() => setShowAddSpaceModal(true)}
              >
                <div style={{ width: '48px', height: '48px', background: '#ccfbf1', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F8F7A', marginBottom: '16px' }}>
                  <Building2 size={24} />
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>Add an Event Space</h3>
                <p style={{ margin: '0 0 20px', fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5 }}>
                  List wedding halls, conference centers, party grounds, or private gardens with pricing and capacity.
                </p>
                <button style={{ background: '#0F8F7A', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={16} /> Add Space Now
                </button>
              </div>

              {/* Add Service Card */}
              <div 
                style={{ background: '#f8fafc', border: '2px dashed #14213D', borderRadius: '16px', padding: '28px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s' }}
                onClick={() => setShowAddServiceModal(true)}
              >
                <div style={{ width: '48px', height: '48px', background: '#e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#14213D', marginBottom: '16px' }}>
                  <Package size={24} />
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>Add a Service</h3>
                <p style={{ margin: '0 0 20px', fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5 }}>
                  Offer professional catering, photography, DJ/music, decor, or event coordination.
                </p>
                <button style={{ background: '#14213D', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={16} /> Add Service Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. Tab: OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              <KpiCard 
                icon={<Building2 size={24} color="#0F8F7A" />} 
                bg="#e6f7f3" 
                title="Active Spaces" 
                value={spaces.length} 
                subtitle={`${activeSpacesCount} verified & public`} 
                onClick={() => setActiveTab('spaces')}
              />
              <KpiCard 
                icon={<Package size={24} color="#0284c7" />} 
                bg="#e0f2fe" 
                title="Active Services" 
                value={services.length} 
                subtitle={`${activeServicesCount} published`} 
                onClick={() => setActiveTab('services')}
              />
              <KpiCard 
                icon={<CalendarCheck size={24} color="#d97706" />} 
                bg="#fef3c7" 
                title="Booking Requests" 
                value={pendingRequestsCount} 
                subtitle={`${bookings.length} total bookings`} 
                onClick={() => setActiveTab('bookings')}
              />
              <KpiCard 
                icon={<DollarSign size={24} color="#16a34a" />} 
                bg="#dcfce7" 
                title="Estimated Revenue" 
                value={`KES ${totalRevenue.toLocaleString()}`} 
                subtitle="From approved bookings" 
              />
            </div>

            {/* Quick Context Summary Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Left: Spaces Preview */}
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>My Spaces ({spaces.length})</h3>
                  <button onClick={() => setActiveTab('spaces')} style={{ background: 'none', border: 'none', color: '#0F8F7A', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    View All <ChevronRight size={16} />
                  </button>
                </div>
                {spaces.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                    No spaces added yet. <span onClick={() => setShowAddSpaceModal(true)} style={{ color: '#0F8F7A', fontWeight: 600, cursor: 'pointer' }}>Add your first space</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {spaces.slice(0, 3).map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: '#f8fafc', borderRadius: '10px' }}>
                        <img 
                          src={s.image_url || DEFAULT_SPACE_IMAGE} 
                          onError={(e) => handleImageError(e, DEFAULT_SPACE_IMAGE)} 
                          alt={s.title || ""} 
                          style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} 
                        />
                        <div style={{ flexGrow: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>{s.title}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Capacity: {s.capacity} · KES {Number(s.price_per_day).toLocaleString()}/day</div>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: s.is_verified ? '#16a34a' : '#d97706', background: s.is_verified ? '#dcfce7' : '#fef3c7', padding: '4px 8px', borderRadius: '999px' }}>
                          {s.is_verified ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Services Preview */}
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>My Services ({services.length})</h3>
                  <button onClick={() => setActiveTab('services')} style={{ background: 'none', border: 'none', color: '#0F8F7A', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    View All <ChevronRight size={16} />
                  </button>
                </div>
                {services.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                    No services added yet. <span onClick={() => setShowAddServiceModal(true)} style={{ color: '#0F8F7A', fontWeight: 600, cursor: 'pointer' }}>Add your first service</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {services.slice(0, 3).map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: '#f8fafc', borderRadius: '10px' }}>
                        <img 
                          src={s.image_url || DEFAULT_SERVICE_IMAGE} 
                          onError={(e) => handleImageError(e, DEFAULT_SERVICE_IMAGE)} 
                          alt={s.title || ""} 
                          style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} 
                        />
                        <div style={{ flexGrow: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>{s.title}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>From KES {Number(s.price_per_day).toLocaleString()}</div>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F8F7A', background: '#e6f7f3', padding: '4px 8px', borderRadius: '999px' }}>
                          Active
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Bookings Section */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>Recent Booking Inquiries</h3>
                <button onClick={() => setActiveTab('bookings')} style={{ background: 'none', border: 'none', color: '#0F8F7A', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
                  Manage All ({bookings.length})
                </button>
              </div>

              {bookings.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                  No incoming bookings yet. Your listings will appear in customer searches once verified.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {bookings.slice(0, 5).map(b => (
                    <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '12px', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#0f172a' }}>
                          {b.event_title} ({b.event_type})
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                          Client: {b.customer_name} · Date: {b.event_date} · Guests: {b.guest_count}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                          KES {Number(b.total_price).toLocaleString()}
                        </div>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '999px',
                          background: b.status === 'APPROVED' ? '#dcfce7' : b.status === 'PENDING' ? '#fef3c7' : '#fee2e2',
                          color: b.status === 'APPROVED' ? '#16a34a' : b.status === 'PENDING' ? '#d97706' : '#ef4444'
                        }}>
                          {b.status}
                        </span>
                        {b.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleUpdateBookingStatus(b.id, 'APPROVED')}
                              style={{ background: '#0F8F7A', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleUpdateBookingStatus(b.id, 'REJECTED')}
                              style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
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
          </div>
        )}

        {/* 5. Tab: MY SPACES (Step 9 & 10) */}
        {activeTab === 'spaces' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['ALL', 'APPROVED', 'PENDING'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setSpaceFilter(f)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: spaceFilter === f ? '#0F8F7A' : '#ffffff',
                      color: spaceFilter === f ? '#ffffff' : '#475569',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    {f === 'ALL' ? `All Spaces (${spaces.length})` : f === 'APPROVED' ? `Verified (${spaces.filter(s => s.is_verified).length})` : `Pending Review (${spaces.filter(s => !s.is_verified).length})`}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowAddSpaceModal(true)}
                style={{ background: '#0F8F7A', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
              >
                <Plus size={16} /> Add New Space
              </button>
            </div>

            {spaces.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: '16px', padding: '64px 20px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <Building2 size={48} color="#94a3b8" style={{ marginBottom: '16px' }} />
                <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 700 }}>No event spaces listed yet</h3>
                <p style={{ color: '#64748b', maxWidth: '400px', margin: '0 auto 24px' }}>
                  List your first space to start receiving venue reservations from event planners and customers.
                </p>
                <button
                  onClick={() => setShowAddSpaceModal(true)}
                  style={{ background: '#0F8F7A', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <Plus size={18} /> Add an Event Space
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                {spaces
                  .filter(s => spaceFilter === 'ALL' ? true : spaceFilter === 'APPROVED' ? s.is_verified : !s.is_verified)
                  .map(s => (
                    <div key={s.id} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
                      <div style={{ height: '180px', position: 'relative' }}>
                        <img 
                          src={s.image_url || DEFAULT_SPACE_IMAGE} 
                          onError={(e) => handleImageError(e, DEFAULT_SPACE_IMAGE)} 
                          alt={s.title || ""} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                        <span style={{ position: 'absolute', top: '12px', right: '12px', background: s.is_verified ? '#16a34a' : '#d97706', color: '#fff', padding: '4px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
                          {s.is_verified ? 'Verified & Public' : 'Under Review'}
                        </span>
                      </div>

                      <div style={{ padding: '20px' }}>
                        <h4 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>{s.title}</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.85rem', marginBottom: '12px' }}>
                          <MapPin size={14} /> {s.location}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px', background: '#f8fafc', borderRadius: '8px', marginBottom: '16px', fontSize: '0.82rem' }}>
                          <div>
                            <span style={{ color: '#64748b' }}>Capacity:</span>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>👥 {s.capacity} guests</div>
                          </div>
                          <div>
                            <span style={{ color: '#64748b' }}>Rate per day:</span>
                            <div style={{ fontWeight: 700, color: '#0F8F7A' }}>KES {Number(s.price_per_day).toLocaleString()}</div>
                          </div>
                        </div>

                        <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '0.85rem', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {s.description}
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Rating: ⭐ {s.rating || 5.0}</span>
                          <button
                            onClick={async () => {
                              if (confirm(`Are you sure you want to delete ${s.title}?`)) {
                                await ApiService.deleteVenue(s.id);
                                toast.success("Space deleted.");
                                fetchData();
                              }
                            }}
                            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* 6. Tab: MY SERVICES (Step 8 & 10) */}
        {activeTab === 'services' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['ALL', 'APPROVED', 'PENDING'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setServiceFilter(f)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: serviceFilter === f ? '#0F8F7A' : '#ffffff',
                      color: serviceFilter === f ? '#ffffff' : '#475569',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    {f === 'ALL' ? `All Services (${services.length})` : f === 'APPROVED' ? `Published (${services.filter(s => s.is_verified).length})` : `Pending (${services.filter(s => !s.is_verified).length})`}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowAddServiceModal(true)}
                style={{ background: '#14213D', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
              >
                <Plus size={16} /> Add New Service
              </button>
            </div>

            {services.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: '16px', padding: '64px 20px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <Package size={48} color="#94a3b8" style={{ marginBottom: '16px' }} />
                <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 700 }}>No services listed yet</h3>
                <p style={{ color: '#64748b', maxWidth: '400px', margin: '0 auto 24px' }}>
                  Offer professional catering, photography, decoration, entertainment, or event planning to clients.
                </p>
                <button
                  onClick={() => setShowAddServiceModal(true)}
                  style={{ background: '#14213D', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <Plus size={18} /> Add a Service
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                {services
                  .filter(s => serviceFilter === 'ALL' ? true : serviceFilter === 'APPROVED' ? s.is_verified : !s.is_verified)
                  .map(s => (
                    <div key={s.id} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
                      <div style={{ height: '180px', position: 'relative' }}>
                        <img 
                          src={s.image_url || DEFAULT_SERVICE_IMAGE} 
                          onError={(e) => handleImageError(e, DEFAULT_SERVICE_IMAGE)} 
                          alt={s.title || ""} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                        <span style={{ position: 'absolute', top: '12px', right: '12px', background: '#0F8F7A', color: '#fff', padding: '4px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
                          Active Service
                        </span>
                      </div>

                      <div style={{ padding: '20px' }}>
                        <h4 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>{s.title}</h4>
                        <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '12px' }}>
                          Category: {s.category}
                        </div>

                        <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Advertised Price:</span>
                          <span style={{ fontWeight: 800, color: '#0F8F7A', fontSize: '1rem' }}>KES {Number(s.price_per_day).toLocaleString()}</span>
                        </div>

                        <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '0.85rem', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {s.description}
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Reviews: ⭐ 4.9 (12)</span>
                          <button
                            onClick={async () => {
                              if (confirm(`Are you sure you want to delete ${s.title}?`)) {
                                await ApiService.deleteVenue(s.id);
                                toast.success("Service removed.");
                                fetchData();
                              }
                            }}
                            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
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

        {/* 7. Tab: BOOKINGS */}
        {activeTab === 'bookings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              {(['ALL', 'SPACES', 'SERVICES'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setBookingFilter(f)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: bookingFilter === f ? '#0F8F7A' : 'none',
                    color: bookingFilter === f ? '#ffffff' : '#64748b',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  {f === 'ALL' ? `All Inquiries (${bookings.length})` : f === 'SPACES' ? 'Space Bookings' : 'Service Bookings'}
                </button>
              ))}
            </div>

            {bookings.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: '16px', padding: '48px', textAlign: 'center', border: '1px solid #e2e8f0', color: '#64748b' }}>
                No bookings found.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {bookings.map(b => (
                  <div key={b.id} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>{b.event_title}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: '#e0f2fe', color: '#0369a1' }}>{b.event_type}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <span>👤 Client: <strong>{b.customer_name}</strong></span>
                        <span>📅 Date: <strong>{b.event_date}</strong></span>
                        <span>👥 Guests: <strong>{b.guest_count}</strong></span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Quote</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F8F7A' }}>
                          KES {Number(b.total_price).toLocaleString()}
                        </div>
                      </div>

                      <span style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        padding: '6px 14px',
                        borderRadius: '999px',
                        background: b.status === 'APPROVED' ? '#dcfce7' : b.status === 'PENDING' ? '#fef3c7' : '#fee2e2',
                        color: b.status === 'APPROVED' ? '#16a34a' : b.status === 'PENDING' ? '#d97706' : '#ef4444'
                      }}>
                        {b.status}
                      </span>

                      {b.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleUpdateBookingStatus(b.id, 'APPROVED')}
                            style={{ background: '#0F8F7A', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleUpdateBookingStatus(b.id, 'REJECTED')}
                            style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
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

        {/* 8. Tab: BUSINESS PROFILE */}
        {activeTab === 'profile' && (
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '32px', maxWidth: '720px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '1.3rem', fontWeight: 800 }}>Business Profile Information</h3>
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Business Name</label>
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
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Business Description & Overview</label>
                <textarea 
                  rows={4} 
                  value={profileFormData.description} 
                  onChange={e => setProfileFormData({...profileFormData, description: e.target.value})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <button 
                type="submit" 
                style={{ background: '#0F8F7A', color: '#fff', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', marginTop: '10px' }}
              >
                Save Business Profile
              </button>
            </form>
          </div>
        )}

        {/* 9. Tab: CALENDAR */}
        {activeTab === 'calendar' && (
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '32px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem', fontWeight: 800 }}>Scheduled Events Calendar</h3>
            <p style={{ color: '#64748b', marginBottom: '24px' }}>All approved bookings for your spaces and services appear here chronologically.</p>
            {bookings.filter(b => b.status === 'APPROVED').length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px' }}>
                No events currently scheduled. Approved bookings will be displayed on this calendar.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {bookings.filter(b => b.status === 'APPROVED').map(b => (
                  <div key={b.id} style={{ padding: '16px', borderLeft: '4px solid #0F8F7A', background: '#f8fafc', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{b.event_title}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Date: {b.event_date} · Client: {b.customer_name}</div>
                    </div>
                    <span style={{ fontWeight: 700, color: '#0F8F7A' }}>KES {Number(b.total_price).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 10. Tab: REVIEWS */}
        {activeTab === 'reviews' && (
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '32px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem', fontWeight: 800 }}>Customer Reviews & Ratings</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', background: '#f8fafc', borderRadius: '12px', marginBottom: '24px' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a' }}>4.9</div>
              <div>
                <div style={{ display: 'flex', gap: '4px', color: '#eab308' }}>
                  <Star fill="#eab308" size={18} />
                  <Star fill="#eab308" size={18} />
                  <Star fill="#eab308" size={18} />
                  <Star fill="#eab308" size={18} />
                  <Star fill="#eab308" size={18} />
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>Based on 28 verified customer bookings</div>
              </div>
            </div>
            <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
              Customer reviews will automatically populate here after completed event bookings.
            </div>
          </div>
        )}

        {/* 11. Tab: SETTINGS */}
        {activeTab === 'settings' && (
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '32px', maxWidth: '600px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem', fontWeight: 800 }}>Account & Notification Settings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Email Booking Alerts</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Receive instant emails for new booking requests</div>
                </div>
                <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px', accentColor: '#0F8F7A' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Two-Factor Security</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Protect account with OTP login verification</div>
                </div>
                <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px', accentColor: '#0F8F7A' }} />
              </div>
            </div>
          </div>
        )}

      </main>

      {/* MODAL: Add Event Space (Step 9) */}
      {showAddSpaceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', position: 'relative' }}>
            <button onClick={() => setShowAddSpaceModal(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <XCircle size={24} />
            </button>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>Add New Event Space</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' }}>Define capacity, pricing, and details for your venue.</p>

            {spaceErrorNotice && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                <AlertCircle size={20} color="#dc2626" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.85rem', color: '#991b1b', fontWeight: 600, lineHeight: 1.4 }}>{spaceErrorNotice}</span>
              </div>
            )}

            <form onSubmit={handleAddSpaceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Space Name / Title *</label>
                <input 
                  required 
                  type="text" 
                  placeholder="e.g. Garden Hall & Banquet Lawn" 
                  value={newSpace.title} 
                  onChange={e => setNewSpace({...newSpace, title: e.target.value})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Category *</label>
                  <select 
                    value={newSpace.category} 
                    onChange={e => setNewSpace({...newSpace, category: e.target.value as any})}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="WEDDING">Wedding Gardens & Halls</option>
                    <option value="CONFERENCE">Conference & Corporate</option>
                    <option value="BIRTHDAY">Birthday & Private Party</option>
                    <option value="OUTDOOR">Outdoor & Picnic Grounds</option>
                    <option value="PARTY">Nightlife & Celebration</option>
                    <option value="EXHIBITION">Exhibition & Trade Halls</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Max Capacity (Guests) *</label>
                  <input 
                    required 
                    type="number" 
                    placeholder="e.g. 300" 
                    value={newSpace.capacity} 
                    onChange={e => setNewSpace({...newSpace, capacity: Number(e.target.value)})}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Price Per Day (KES) *</label>
                  <input 
                    required 
                    type="number" 
                    placeholder="e.g. 75000" 
                    value={newSpace.price_per_day} 
                    onChange={e => setNewSpace({...newSpace, price_per_day: Number(e.target.value)})}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Location / City *</label>
                  <input 
                    required 
                    type="text" 
                    placeholder="e.g. Nairobi, Westlands" 
                    value={newSpace.location} 
                    onChange={e => setNewSpace({...newSpace, location: e.target.value})}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Description *</label>
                <textarea 
                  required 
                  rows={3} 
                  placeholder="Describe the venue ambiance, lighting, sound, parking, and catering accommodations..."
                  value={newSpace.description} 
                  onChange={e => setNewSpace({...newSpace, description: e.target.value})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Amenities (Comma separated)</label>
                <input 
                  type="text" 
                  placeholder="Parking, Sound System, Restrooms, Security, Projector"
                  value={newSpace.amenities} 
                  onChange={e => setNewSpace({...newSpace, amenities: e.target.value})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Space Image URL (Optional)</label>
                <input 
                  type="url" 
                  placeholder="Paste direct image link or Google Images link..."
                  value={newSpace.image_url} 
                  onChange={e => setNewSpace({...newSpace, image_url: cleanImageUrl(e.target.value)})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                {newSpace.image_url ? (
                  <div style={{ marginTop: '10px', padding: '10px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F8F7A', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ImageIcon size={14} /> Live Image Preview:
                    </div>
                    <div style={{ height: '140px', borderRadius: '8px', overflow: 'hidden', background: '#e2e8f0' }}>
                      <img 
                        src={newSpace.image_url} 
                        alt="Preview" 
                        onError={(e) => handleImageError(e, DEFAULT_SPACE_IMAGE)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                    ✨ Direct photo links or Google Images search links are automatically cleaned and converted.
                  </p>
                )}
              </div>

              <button 
                type="submit" 
                disabled={submitting}
                style={{ background: '#0F8F7A', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: 700, fontSize: '1rem', cursor: submitting ? 'not-allowed' : 'pointer', marginTop: '10px' }}
              >
                {submitting ? 'Saving Space...' : 'Save & Publish Space'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Service (Step 8) */}
      {showAddServiceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', position: 'relative' }}>
            <button onClick={() => setShowAddServiceModal(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <XCircle size={24} />
            </button>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>Add New Service</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' }}>Offer professional event services to customers.</p>

            {serviceErrorNotice && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                <AlertCircle size={20} color="#dc2626" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.85rem', color: '#991b1b', fontWeight: 600, lineHeight: 1.4 }}>{serviceErrorNotice}</span>
              </div>
            )}

            <form onSubmit={handleAddServiceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Service Name *</label>
                <input 
                  required 
                  type="text" 
                  placeholder="e.g. Wedding Photography & Cinematic Video" 
                  value={newService.title} 
                  onChange={e => setNewService({...newService, title: e.target.value})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Category *</label>
                  <select 
                    value={newService.category} 
                    onChange={e => setNewService({...newService, category: e.target.value})}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="PHOTOGRAPHY">Photography & Video</option>
                    <option value="CATERING">Catering & Bar Service</option>
                    <option value="DECORATION">Event Decoration & Styling</option>
                    <option value="ENTERTAINMENT">DJ & Entertainment</option>
                    <option value="PLANNING">Event Planning & Coordination</option>
                    <option value="SOUND">Sound & Lighting</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Pricing Basis</label>
                  <select 
                    value={newService.pricing_type} 
                    onChange={e => setNewService({...newService, pricing_type: e.target.value})}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="Per Event">Per Event Package</option>
                    <option value="Per Hour">Per Hour</option>
                    <option value="Per Guest">Per Guest / Plate</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Starting Price (KES) *</label>
                <input 
                  required 
                  type="number" 
                  placeholder="e.g. 35000" 
                  value={newService.price_per_day} 
                  onChange={e => setNewService({...newService, price_per_day: Number(e.target.value)})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Service Details & Deliverables *</label>
                <textarea 
                  required 
                  rows={3} 
                  placeholder="List what is included in this service package (e.g. 8 hours coverage, edited photos, drone footage)..."
                  value={newService.description} 
                  onChange={e => setNewService({...newService, description: e.target.value})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Service Photo URL (Optional)</label>
                <input 
                  type="url" 
                  placeholder="Paste direct image link or Google Images link..."
                  value={newService.image_url} 
                  onChange={e => setNewService({...newService, image_url: cleanImageUrl(e.target.value)})}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                {newService.image_url ? (
                  <div style={{ marginTop: '10px', padding: '10px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#14213D', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ImageIcon size={14} /> Live Image Preview:
                    </div>
                    <div style={{ height: '140px', borderRadius: '8px', overflow: 'hidden', background: '#e2e8f0' }}>
                      <img 
                        src={newService.image_url} 
                        alt="Preview" 
                        onError={(e) => handleImageError(e, DEFAULT_SERVICE_IMAGE)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                    ✨ Direct photo links or Google Images search links are automatically cleaned and converted.
                  </p>
                )}
              </div>

              <button 
                type="submit" 
                disabled={submitting}
                style={{ background: '#14213D', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: 700, fontSize: '1rem', cursor: submitting ? 'not-allowed' : 'pointer', marginTop: '10px' }}
              >
                {submitting ? 'Saving Service...' : 'Save & Publish Service'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

// Reusable Navigation Link
const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  badge?: number;
  badgeColor?: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, label, badge, badgeColor = '#0F8F7A', active, onClick }) => {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '12px 14px',
        borderRadius: '10px',
        border: 'none',
        background: active ? '#e6f7f3' : 'none',
        color: active ? '#0F8F7A' : '#475569',
        fontWeight: active ? 700 : 600,
        fontSize: '0.92rem',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = '#f8fafc';
          e.currentTarget.style.color = '#0f172a';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = 'none';
          e.currentTarget.style.color = '#475569';
        }
      }}
    >
      <span style={{ color: active ? '#0F8F7A' : '#64748b' }}>{icon}</span>
      <span style={{ flexGrow: 1 }}>{label}</span>
      {badge !== undefined && (
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#fff',
            background: badgeColor,
            padding: '2px 8px',
            borderRadius: '999px',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
};

// Reusable KPI Card
const KpiCard: React.FC<{
  icon: React.ReactNode;
  bg: string;
  title: string;
  value: string | number;
  subtitle: string;
  onClick?: () => void;
}> = ({ icon, bg, title, value, subtitle, onClick }) => {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => {
        if (onClick) e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        if (onClick) e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>{title}</span>
        <div style={{ width: '40px', height: '40px', background: bg, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
      </div>
      <div>
        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '6px' }}>{subtitle}</div>
      </div>
    </div>
  );
};
