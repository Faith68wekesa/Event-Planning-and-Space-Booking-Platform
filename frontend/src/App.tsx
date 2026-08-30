import React, { useState, useEffect } from 'react';
import type { UserRole, Venue, Vendor, Booking, PlatformStats, FilterState } from './types';
import { ApiService } from './services/api.ts';
import { Navbar } from './components/Navbar.tsx';
import { HeroSearch } from './components/HeroSearch.tsx';
import { VenueGrid } from './components/VenueGrid.tsx';
import { VendorGrid } from './components/VendorGrid.tsx';
import { FilterSidebar } from './components/FilterSidebar.tsx';
import { VenueModal } from './components/VenueModal.tsx';
import { VendorModal } from './components/VendorModal.tsx';
import { BookingModal } from './components/BookingModal.tsx';
import { CustomerDashboard } from './components/CustomerDashboard.tsx';
import { VendorDashboard } from './components/VendorDashboard.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { VendorRegistration } from './components/VendorRegistration.tsx';
import { VendorLogin } from './components/VendorLogin.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { MapPin, Briefcase } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('landing');
  const [activeRole, setActiveRole] = useState<UserRole>('CUSTOMER');

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    category: 'ALL',
    vendor_type: 'ALL',
    location: 'ALL',
    max_price: 200000,
    min_capacity: 0,
    verified_only: false,
  });

  const [venues, setVenues] = useState<Venue[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<PlatformStats>({
    total_venues: 5,
    verified_venues: 4,
    total_vendors: 5,
    verified_vendors: 4,
    total_bookings: 2,
    satisfied_clients: 342,
  });

  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [bookingTargetVenue, setBookingTargetVenue] = useState<Venue | null>(null);
  const [bookingTargetVendor, setBookingTargetVendor] = useState<Vendor | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [currentVendor, setCurrentVendor] = useState<Vendor | null>(null);

  const loadData = async () => {
    const fetchedVenues = await ApiService.getVenues(filters);
    const fetchedVendors = await ApiService.getVendors(filters);
    const fetchedBookings = await ApiService.getBookings();
    const fetchedStats = await ApiService.getStats();

    setVenues(fetchedVenues);
    setVendors(fetchedVendors);
    setBookings(fetchedBookings);
    setStats(fetchedStats);
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const handleBookSuccess = (newBooking: Booking) => {
    setBookings((prev) => [newBooking, ...prev]);
    setActiveTab('my-bookings');
  };

  const handleCancelBooking = async (id: number) => {
    const ok = await ApiService.updateBookingStatus(id, 'CANCELLED');
    if (ok) {
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'CANCELLED' } : b)));
    }
  };

  const handleToggleVerifyVenue = async (id: number) => {
    const ok = await ApiService.toggleVerifyVenue(id);
    if (ok) {
      setVenues((prev) => prev.map((v) => (v.id === id ? { ...v, is_verified: !v.is_verified } : v)));
    }
  };

  const handleToggleVerifyVendor = async (id: number) => {
    const ok = await ApiService.toggleVerifyVendor(id);
    if (ok) {
      setVendors((prev) => prev.map((v) => (v.id === id ? { ...v, is_verified: !v.is_verified } : v)));
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {activeTab === 'landing' ? (
        <LandingPage 
          onSelectCustomer={() => {
            setActiveRole('CUSTOMER');
            setActiveTab('venues');
          }}
          onSelectVendor={() => setShowLogin(true)}
        />
      ) : (
        <>
          <Navbar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            activeRole={activeRole}
            bookingCount={bookings.length}
            onRegisterVendor={() => setShowRegistration(true)}
          />

          <main style={{ flexGrow: 1 }}>
        {(activeTab === 'venues' || activeTab === 'vendors') && (
          <>
            <HeroSearch
              filters={filters}
              setFilters={setFilters}
              stats={stats}
              onSearch={loadData}
            />

            <div style={{
              maxWidth: '1280px',
              margin: '0 auto',
              padding: '32px 24px',
              display: 'grid',
              gridTemplateColumns: '260px 1fr',
              gap: '28px',
              alignItems: 'start'
            }}>
              <FilterSidebar
                filters={filters}
                setFilters={setFilters}
                activeTab={activeTab as 'venues' | 'vendors'}
              />

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b' }}>
                    {activeTab === 'venues' ? `Available Event Venues (${venues.length})` : `Verified Planners & Services (${vendors.length})`}
                  </h2>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className={activeTab === 'venues' ? 'btn-primary' : 'btn-secondary'}
                      onClick={() => setActiveTab('venues')}
                      style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                    >
                      <MapPin size={14} /> Venues
                    </button>
                    <button
                      className={activeTab === 'vendors' ? 'btn-primary' : 'btn-secondary'}
                      onClick={() => setActiveTab('vendors')}
                      style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                    >
                      <Briefcase size={14} /> Planners & Services
                    </button>
                  </div>
                </div>

                {activeTab === 'venues' ? (
                  <VenueGrid
                    venues={venues}
                    onSelectVenue={(venue) => setSelectedVenue(venue)}
                    onBookVenue={(venue) => setBookingTargetVenue(venue)}
                  />
                ) : (
                  <VendorGrid
                    vendors={vendors}
                    onSelectVendor={(vendor) => setSelectedVendor(vendor)}
                    onBookVendor={(vendor) => setBookingTargetVendor(vendor)}
                  />
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'my-bookings' && (
          <CustomerDashboard
            bookings={bookings}
            onCancelBooking={handleCancelBooking}
          />
        )}

        {activeTab === 'vendor-dashboard' && currentVendor && (
          <VendorDashboard
            currentVendor={currentVendor}
          />
        )}

        {activeTab === 'admin-dashboard' && (
          <AdminDashboard
            venues={venues}
            vendors={vendors}
            onToggleVerifyVenue={handleToggleVerifyVenue}
            onToggleVerifyVendor={handleToggleVerifyVendor}
          />
        )}
      </main>

      {selectedVenue && (
        <VenueModal
          venue={selectedVenue}
          onClose={() => setSelectedVenue(null)}
          onBook={(v) => setBookingTargetVenue(v)}
        />
      )}

      {selectedVendor && (
        <VendorModal
          vendor={selectedVendor}
          onClose={() => setSelectedVendor(null)}
          onBook={(v) => setBookingTargetVendor(v)}
        />
      )}

      {(bookingTargetVenue || bookingTargetVendor) && (
        <BookingModal
          venue={bookingTargetVenue}
          vendor={bookingTargetVendor}
          onClose={() => {
            setBookingTargetVenue(null);
            setBookingTargetVendor(null);
          }}
          onSuccess={handleBookSuccess}
        />
      )}

      {activeTab !== 'landing' && (
        <footer style={{
          background: 'rgba(15, 23, 42, 0.95)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          marginTop: 'auto'
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <strong>EventP Kenya Platform</strong> — Centralized Web Platform for Verified Event Venues & Services
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem' }}>
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
              <span>Vendor Verification Standard</span>
            </div>
          </div>
        </footer>
      )}
      </>
    )}

      {showRegistration && (
        <VendorRegistration
          onClose={() => setShowRegistration(false)}
          onSuccess={(vendor) => {
            setShowRegistration(false);
            setVendors(prev => [vendor, ...prev]);
            setCurrentVendor(vendor);
            setActiveRole('VENDOR');
            setActiveTab('vendor-dashboard');
          }}
          onSwitchToLogin={() => {
            setShowRegistration(false);
            setShowLogin(true);
          }}
        />
      )}

      {showLogin && (
        <VendorLogin
          onClose={() => setShowLogin(false)}
          onSuccess={(vendor) => {
            setShowLogin(false);
            setCurrentVendor(vendor);
            setActiveRole('VENDOR');
            setActiveTab('vendor-dashboard');
          }}
          onSwitchToRegister={() => {
            setShowLogin(false);
            setShowRegistration(true);
          }}
        />
      )}

    </div>
  );
};

export default App;
