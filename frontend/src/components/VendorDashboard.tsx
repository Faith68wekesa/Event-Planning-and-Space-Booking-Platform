import React, { useState, useEffect, useCallback } from 'react';
import type { Booking, Venue, BookingStatus, PlatformStats, Vendor } from '../types';
import { ApiService } from '../services/api';
import { VendorDashboardOverview } from './VendorDashboardOverview';
import { VendorDashboardBookings } from './VendorDashboardBookings';
import { VendorDashboardPortfolio } from './VendorDashboardPortfolio';
import { VendorDashboardReviews } from './VendorDashboardReviews';
import './vendor-dashboard.css';
import { LayoutDashboard, CalendarDays, Briefcase, MessageSquare, Settings, HelpCircle } from 'lucide-react';

interface VendorDashboardProps {
  currentVendor: Vendor;
}

export const VendorDashboard: React.FC<VendorDashboardProps> = ({
  currentVendor,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'portfolio' | 'bookings' | 'reviews'>('overview');
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<any>('WEDDING');
  const [location, setLocation] = useState('Nairobi');
  const [capacity, setCapacity] = useState(300);
  const [priceDay, setPriceDay] = useState(75000);
  const [desc, setDesc] = useState('');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [stats, setStats] = useState<PlatformStats>({ total_venues: 0, verified_venues: 0, total_vendors: 0, verified_vendors: 0, total_bookings: 0, satisfied_clients: 0 });

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
      capacity: Number(capacity),
      price_per_day: Number(priceDay),
      description: desc,
      amenities: ['Manicured Grounds', 'Generator Backup', 'Security Guards', 'Ample Parking'],
      image_url: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80',
    });
    setShowAddModal(false);
    fetchDashboardData();
    alert('New venue submitted! It will appear on the platform for admin verification.');
  };

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'bookings', label: 'Bookings', icon: CalendarDays },
    { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
    { id: 'reviews', label: 'Reviews', icon: MessageSquare },
  ];

  const getPageTitle = () => {
    switch (activeTab) {
      case 'overview': return 'Vendor Dashboard';
      case 'portfolio': return 'Portfolio & Listings';
      case 'bookings': return 'Manage Bookings';
      case 'reviews': return 'Client Reviews';
      default: return 'Vendor Dashboard';
    }
  };

  return (
    <div className="vendor-dashboard-layout">
      
      {/* Sidebar */}
      <aside className="vendor-sidebar">
        <div className="vendor-sidebar-header">
          {currentVendor.business_name}
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, marginTop: '4px' }}>{currentVendor.vendor_type_display} Partner</div>
        </div>
        
        <nav className="vendor-sidebar-nav">
          {menuItems.map(item => (
            <button 
              key={item.id}
              className={`vendor-sidebar-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id as any)}
            >
              <item.icon size={18} /> {item.label}
            </button>
          ))}
          
          <div style={{ flexGrow: 1 }} />
          
          <button 
            className="btn-primary" 
            style={{ width: '100%', marginBottom: '24px', background: '#0d8a73', padding: '12px' }}
            onClick={() => setShowAddModal(true)}
          >
            Create New Listing
          </button>
          
          <button className="vendor-sidebar-item">
            <Settings size={18} /> Settings
          </button>
          <button className="vendor-sidebar-item">
            <HelpCircle size={18} /> Support
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="vendor-main-content">
        
        <div className="vendor-topbar">
          <div>
            <h1>{getPageTitle()}</h1>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '4px 0 0 0' }}>Manage your account, bookings, and listings.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer' }}>
              🔔
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{currentVendor.business_name}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{currentVendor.vendor_type_display}</div>
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0', overflow: 'hidden' }}>
                <img src={currentVendor.portfolio_images?.[0] || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80"} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            </div>
          </div>
        </div>

        {activeTab === 'overview' && (
          <VendorDashboardOverview bookings={bookings} stats={stats} venues={venues} />
        )}
        
        {activeTab === 'bookings' && (
          <VendorDashboardBookings bookings={bookings} onUpdateStatus={handleUpdateStatus} />
        )}
        
        {activeTab === 'portfolio' && (
          <VendorDashboardPortfolio venues={venues} onAddClick={() => setShowAddModal(true)} />
        )}
        
        {activeTab === 'reviews' && (
          <VendorDashboardReviews />
        )}

      </main>

      {/* Add Venue Modal - Shared across views */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '16px' }}>List New Event Venue</h3>
            <form onSubmit={handleAddVenueSubmit} style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Venue Title</label>
                <input required type="text" placeholder="e.g. Windsor Garden Pavilion" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="WEDDING">Wedding Garden</option>
                    <option value="CONFERENCE">Conference Center</option>
                    <option value="OUTDOOR">Outdoor Grounds</option>
                    <option value="BIRTHDAY">Birthday Venue</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Location</label>
                  <input required type="text" placeholder="e.g. Nairobi / Nakuru" value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Max Capacity</label>
                  <input required type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Price per Day (KES)</label>
                  <input required type="number" value={priceDay} onChange={(e) => setPriceDay(Number(e.target.value))} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Description</label>
                <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describe venue features..." />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Submit Listing</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
