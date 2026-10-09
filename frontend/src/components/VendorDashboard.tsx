import React, { useState, useEffect, useCallback } from 'react';
import type { Booking, Venue, BookingStatus, PlatformStats, Vendor } from '../types';
import { ApiService } from '../services/api';
import { VendorDashboardOverview } from './VendorDashboardOverview';
import { VendorDashboardBookings } from './VendorDashboardBookings';
import { VendorDashboardPortfolio } from './VendorDashboardPortfolio';
import { VendorDashboardReviews } from './VendorDashboardReviews';
import { VendorDashboardCalendar } from './VendorDashboardCalendar';
import { VendorDashboardMessages } from './VendorDashboardMessages';
import { VendorDashboardSettings } from './VendorDashboardSettings';
import './vendor-dashboard.css';
import { Home, Building, Package, MessageCircle, Settings, LogOut, User, CalendarCheck, Calendar, Star, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface VendorDashboardProps {
  currentVendor: Vendor;
}

export const VendorDashboard: React.FC<VendorDashboardProps> = ({
  currentVendor,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'portfolio' | 'bookings' | 'reviews' | 'profile' | 'messages' | 'calendar' | 'settings' | 'my_profile'>('overview');
  const [isUploading, setIsUploading] = useState(false);

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && currentVendor.user_details) {
      const file = e.target.files[0];
      setIsUploading(true);
      const newUrl = await ApiService.uploadProfilePicture(currentVendor.user_details.id, file);
      if (newUrl) {
        currentVendor.profile_picture = newUrl;
        toast.success('Profile picture updated successfully!');
      } else {
        toast.error('Failed to upload profile picture.');
      }
      setIsUploading(false);
    }
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<any>('WEDDING');
  const [location, setLocation] = useState('Nairobi');
  const [priceDay, setPriceDay] = useState(75000);
  const [desc, setDesc] = useState('');
  const [unreadMessages, setUnreadMessages] = useState(0);
  
  const profileFields = [
    currentVendor.business_name && currentVendor.business_name !== 'Pending Setup',
    currentVendor.location,
    currentVendor.description,
    currentVendor.contact_phone,
    currentVendor.contact_email || currentVendor.user_details?.email,
  ];
  const filledFields = profileFields.filter(Boolean).length;
  const profileCompletion = Math.round((filledFields / profileFields.length) * 100);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [stats, setStats] = useState<PlatformStats>({ total_venues: 0, verified_venues: 0, total_vendors: 0, verified_vendors: 0, total_bookings: 0, satisfied_clients: 0 });

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    business_name: currentVendor.business_name || '',
    vendor_type: currentVendor.vendor_type || '',
    location: currentVendor.location || '',
    description: currentVendor.description || '',
    years_in_business: currentVendor.years_in_business || '',
    website_url: currentVendor.website_url || '',
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
      await ApiService.updateVendor(currentVendor.id, payload);
      toast.success('Profile updated successfully!');
      setIsEditingProfile(false);
      window.location.reload();
    } catch (e) {
      toast.error('Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      const [dashData, bookingsData] = await Promise.all([
        ApiService.getVendorDashboard(currentVendor.id),
        ApiService.getVendorBookings(currentVendor.id)
      ]);
      setStats({
        total_venues: dashData.total_venues,
        verified_venues: dashData.total_venues, // Simplified
        total_vendors: 0, verified_vendors: 0, satisfied_clients: 0,
        total_bookings: dashData.pending_bookings + dashData.upcoming_bookings,
        revenue: dashData.total_revenue // Passing this in extended stats object or modifying PlatformStats
      } as any);
      setVenues(dashData.venues);
      setBookings(bookingsData);
    } catch (e) {
      console.error(e);
    }
  }, [currentVendor.id]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleUpdateStatus = async (id: number, status: BookingStatus) => {
    await ApiService.updateBookingStatus(id, status);
    fetchDashboardData();
  };

  const handleAddVenueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await ApiService.addVenue({
      vendor: currentVendor.id,
      title,
      category,
      location,
      capacity: 0,
      price_per_day: Number(priceDay),
      description: desc,
    });
    setShowAddModal(false);
    fetchDashboardData();
    toast.success('New venue submitted! It will appear on the platform for admin verification.');
  };

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'profile', label: 'Business Profile', icon: Building },
    { id: 'portfolio', label: 'My Services', icon: Package },
    { id: 'bookings', label: 'Booking Requests', icon: CalendarCheck },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'my_profile', label: 'My Profile', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const getPageTitle = () => {
    switch (activeTab) {
      case 'overview': return 'Vendor Dashboard';
      case 'portfolio': return 'My Services';
      case 'bookings': return 'Manage Booking Requests';
      case 'reviews': return 'Client Reviews';
      case 'profile': return 'Business Profile';
      case 'messages': return 'Messages';
      case 'calendar': return 'Calendar';
      case 'settings': return 'Settings';
      case 'my_profile': return 'My Profile';
      default: return 'Vendor Dashboard';
    }
  };

  const getPageSubtitle = () => {
    switch (activeTab) {
      case 'overview': return 'Manage your account, bookings, and listings.';
      case 'portfolio': return 'Manage the services you offer, showcase examples of your work, and track their verification status.';
      case 'bookings': return 'Track and manage your upcoming client events.';
      case 'reviews': return 'See what clients are saying about your services.';
      case 'profile': return 'Update your public business information.';
      case 'messages': return 'Communicate with your clients.';
      case 'calendar': return 'Manage your availability and schedule.';
      case 'settings': return 'Update your account preferences.';
      case 'my_profile': return 'Manage your personal account details.';
      default: return 'Manage your account, bookings, and listings.';
    }
  };

  return (
    <div className="vendor-dashboard-layout">

      {/* Sidebar */}
      <aside className="vendor-sidebar">
        <div className="vendor-sidebar-header" style={{ padding: '24px 16px', borderBottom: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', cursor: 'pointer' }}>
            <div style={{ width: '42px', height: '42px', minWidth: '42px', flexShrink: 0, borderRadius: '50%', background: '#e2e8f0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {currentVendor.logo_url || currentVendor.portfolio_images?.[0] ? (
                <img src={currentVendor.logo_url || currentVendor.portfolio_images?.[0]} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={24} color="#94a3b8" style={{ marginTop: '4px' }} />
              )}
            </div>
            <div style={{ overflow: 'hidden', flexGrow: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {currentVendor.business_name && currentVendor.business_name !== 'Pending Setup' ? currentVendor.business_name : 'Business Profile'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Vendor</div>
            </div>
            <ChevronDown size={16} color="#94a3b8" />
          </div>
        </div>

        <nav className="vendor-sidebar-nav" style={{ paddingTop: '8px' }}>
          {menuItems.map(item => (
            <button
              key={item.id}
              className={`vendor-sidebar-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id as any)}
            >
              <item.icon size={18} /> {item.label}
              {item.id === 'messages' && unreadMessages > 0 && (
                <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>{unreadMessages}</span>
              )}
            </button>
          ))}

          <div style={{ flexGrow: 1 }} />

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '16px 0', marginTop: '16px' }}>
            <button 
              className="vendor-sidebar-item" 
              style={{ color: '#f8fafc', opacity: 0.9 }}
              onClick={() => {
                // Sign out logic could go here
                window.location.reload();
              }}
            >
              <LogOut size={18} /> Sign Out
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="vendor-main-content">

        <div className="vendor-topbar">
          <div>
            <h1>{getPageTitle()}</h1>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '4px 0 0 0' }}>{getPageSubtitle()}</p>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              {currentVendor.logo_url || currentVendor.profile_picture ? (
                <img src={currentVendor.logo_url || currentVendor.profile_picture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={20} color="#94a3b8" />
              )}
            </div>
            <button style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              🔔
            </button>
          </div>
        </div>

        {activeTab === 'overview' && (
          <VendorDashboardOverview bookings={bookings} stats={stats} venues={venues} onNavigate={(tab) => setActiveTab(tab as any)} />
        )}

        {activeTab === 'bookings' && (
          <VendorDashboardBookings bookings={bookings} onUpdateStatus={handleUpdateStatus} />
        )}

        {activeTab === 'portfolio' && (
          <VendorDashboardPortfolio venues={venues} onAddClick={() => setShowAddModal(true)} />
        )}

        {activeTab === 'reviews' && (
          <VendorDashboardReviews reviews={[]} />
        )}

        {activeTab === 'calendar' && (
          <VendorDashboardCalendar 
            bookings={bookings}
          />
        )}

        {activeTab === 'messages' && (
          <VendorDashboardMessages />
        )}

        {activeTab === 'my_profile' && (
          <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0', color: '#1e293b' }}>My Profile</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                Manage your personal account details and preferences.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {currentVendor.logo_url || currentVendor.profile_picture ? (
                  <img src={currentVendor.logo_url || currentVendor.profile_picture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={40} color="#94a3b8" />
                )}
              </div>
              <label 
                style={{ background: '#f1f5f9', color: '#0f172a', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: isUploading ? 'not-allowed' : 'pointer', fontSize: '0.9rem', display: 'inline-block', opacity: isUploading ? 0.7 : 1 }}
              >
                {isUploading ? 'Uploading...' : 'Upload Profile Picture'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePictureUpload} disabled={isUploading} />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>First Name</span>
                <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{currentVendor.user_details?.first_name || 'Not provided'}</strong>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>Last Name</span>
                <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{currentVendor.user_details?.last_name || 'Not provided'}</strong>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>Personal Email</span>
                <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{currentVendor.user_details?.email || 'Not provided'}</strong>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>Account Role</span>
                <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>Vendor</strong>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0', color: '#1e293b' }}>Business Profile</h3>
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                  {profileCompletion === 0 
                    ? 'Your business profile is not set up yet. Add your business information so customers can learn more about the services you offer.' 
                    : 'Manage your business information and public profile.'}
                </p>
              </div>
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

            {isEditingProfile ? (
              <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Business Name</label>
                    <input required type="text" value={profileFormData.business_name} onChange={(e) => setProfileFormData({...profileFormData, business_name: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Location</label>
                    <input required type="text" value={profileFormData.location} onChange={(e) => setProfileFormData({...profileFormData, location: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Years Experience</label>
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
                <div>
                  <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>Business Name</span>
                  <strong style={{ fontSize: '1.05rem', color: (!currentVendor.business_name || currentVendor.business_name === 'Pending Setup') ? '#94a3b8' : '#0f172a' }}>
                    {(!currentVendor.business_name || currentVendor.business_name === 'Pending Setup') ? 'Not added yet' : currentVendor.business_name}
                  </strong>
                </div>

                <div>
                  <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>Email Address</span>
                  <strong style={{ fontSize: '1.05rem', color: !currentVendor.contact_email ? '#94a3b8' : '#0f172a' }}>
                    {currentVendor.contact_email || (currentVendor.user_details?.email || 'Not added yet')}
                  </strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>Phone Number</span>
                  <strong style={{ fontSize: '1.05rem', color: !currentVendor.contact_phone ? '#94a3b8' : '#0f172a' }}>
                    {currentVendor.contact_phone || 'Not added yet'}
                  </strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>Base Location</span>
                  <strong style={{ fontSize: '1.05rem', color: !currentVendor.location ? '#94a3b8' : '#0f172a' }}>
                    {currentVendor.location || 'Not added yet'}
                  </strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>Services Offered</span>
                  <strong style={{ fontSize: '1.05rem', color: venues.length === 0 ? '#94a3b8' : '#0f172a' }}>
                    {venues.length === 0 ? 'Not added yet' : `${venues.length} Service${venues.length !== 1 ? 's' : ''}`}
                  </strong>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>Business Description</span>
                  <p style={{ margin: '4px 0 0', color: !currentVendor.description ? '#94a3b8' : '#334155', lineHeight: 1.6 }}>
                    {currentVendor.description || 'Not added yet'}
                  </p>
                </div>
              </div>
            )}
            
            {!isEditingProfile && (
              <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 16px 0' }}>Profile Completion</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ flexGrow: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${profileCompletion}%`, height: '100%', background: profileCompletion === 100 ? '#16a34a' : '#0d8a73', borderRadius: '4px' }}></div>
                  </div>
                  <span style={{ fontWeight: 700, color: profileCompletion === 100 ? '#16a34a' : '#0d8a73' }}>{profileCompletion}%</span>
                </div>
                <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                  {profileCompletion === 100 
                    ? 'Your business profile is fully complete!' 
                    : 'Complete your business profile to provide customers with useful information about your business.'}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <VendorDashboardSettings 
            email={currentVendor.user_details?.email || currentVendor.contact_email || ''} 
            phone={currentVendor.contact_phone || ''} 
          />
        )}

      </main>

      {/* Add Service Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '16px' }}>Create New Service</h3>
            <form onSubmit={handleAddVenueSubmit} style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Service Name</label>
                <input required type="text" placeholder="e.g. Wedding Photography" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="PHOTOGRAPHY">Photography</option>
                    <option value="CATERING">Catering</option>
                    <option value="DECORATION">Event Decoration</option>
                    <option value="VIDEOGRAPHY">Videography</option>
                    <option value="PLANNING">Event Planning</option>
                    <option value="ENTERTAINMENT">Entertainment</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Pricing</label>
                  <select value={location} onChange={(e) => setLocation(e.target.value)}>
                    <option value="Per Event">Per Event</option>
                    <option value="Per Hour">Per Hour</option>
                    <option value="Per Guest">Per Guest</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Advertised Price (KES)</label>
                <input required type="number" placeholder="e.g. 20000" value={priceDay} onChange={(e) => setPriceDay(Number(e.target.value))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Description</label>
                <textarea required rows={3} placeholder="Professional wedding photography services..." value={desc} onChange={(e) => setDesc(e.target.value)}></textarea>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Service Photos</label>
                <div style={{ padding: '16px', border: '1px dashed #cbd5e1', borderRadius: '8px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem', cursor: 'pointer' }}>
                  Click to upload photos
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Availability</label>
                <div style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Standard Working Hours</span>
                  <button type="button" style={{ background: 'none', border: 'none', color: '#0d8a73', fontWeight: 600, cursor: 'pointer' }}>Manage</button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-outline">Cancel</button>
                <button type="button" onClick={() => {
                  toast.success('Service saved as draft');
                  setShowAddModal(false);
                }} style={{ background: '#f1f5f9', color: '#334155', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                  Save Draft
                </button>
                <button type="submit" className="btn-primary" style={{ background: '#0d8a73' }}>Submit for Review</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
