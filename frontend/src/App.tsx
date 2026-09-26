import React, { useState, useEffect } from 'react';
import type { UserRole, Venue, Vendor, VenueOwner, Booking, PlatformStats, FilterState } from './types';
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
import { VenueOwnerDashboard } from './components/VenueOwnerDashboard.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { VendorRegistration } from './components/VendorRegistration.tsx';
import { VendorLogin } from './components/VendorLogin.tsx';
import { VenueOwnerLogin } from './components/VenueOwnerLogin.tsx';
import { VenueOwnerRegistration } from './components/VenueOwnerRegistration.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { SplashPage } from './components/SplashPage.tsx';
import { CustomerLogin } from './components/CustomerLogin.tsx';
import { CustomerRegistration } from './components/CustomerRegistration.tsx';
import type { User as UserType } from './types';
import { Toaster } from 'react-hot-toast';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('splash');
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
  const [showVenueOwnerRegistration, setShowVenueOwnerRegistration] = useState(false);
  const [showVenueOwnerLogin, setShowVenueOwnerLogin] = useState(false);
  const [currentVenueOwner, setCurrentVenueOwner] = useState<VenueOwner | null>(null);

  const [showCustomerLogin, setShowCustomerLogin] = useState(false);
  const [showCustomerRegistration, setShowCustomerRegistration] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<UserType | null>(null);

  const handleInterceptBook = (target: any, type: 'venue' | 'vendor') => {
    if (type === 'venue') setBookingTargetVenue(target);
    else setBookingTargetVendor(target);

    if (!currentCustomer) {
      setShowCustomerLogin(true);
    }
  };

  const handleCustomerLoginSuccess = (user: UserType) => {
    setShowCustomerLogin(false);
    setShowCustomerRegistration(false);
    setCurrentCustomer(user);
    setActiveRole('CUSTOMER');
    // If bookingTarget exists, the BookingModal will now open
  };

  const loadData = async () => {
    const fetchedVenues = await ApiService.getVenues(filters);
    const fetchedVendors = await ApiService.getVendors(filters);
    const fetchedStats = await ApiService.getStats();

    setVenues(fetchedVenues);
    setVendors(fetchedVendors);
    setStats(fetchedStats);
  };

  useEffect(() => {
    if (currentCustomer) {
      ApiService.getBookings(currentCustomer.id).then(setBookings);
    } else {
      setBookings([]);
    }
  }, [currentCustomer]);

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
      <Toaster position="top-center" reverseOrder={false} />
      {activeTab === 'splash' ? (
        <SplashPage
          onSelectCustomer={() => {
            setActiveRole('CUSTOMER');
            setActiveTab('landing');
          }}
          onSelectVendor={() => setShowLogin(true)}
          onSelectVenueOwner={() => setShowVenueOwnerLogin(true)}
        />
      ) : (
        <>
          <Navbar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            activeRole={activeRole}
            bookingCount={bookings.length}
            onLoginClick={() => setShowCustomerLogin(true)}
            onRegisterClick={() => setShowCustomerRegistration(true)}
          />

          <main style={{ flexGrow: 1 }}>
            {activeTab === 'landing' ? (
              <LandingPage
                onSearch={(newFilters) => {
                  setFilters(newFilters);
                  setActiveTab('venues');
                }}
                filters={filters}
                onExploreVenues={() => setActiveTab('venues')}
                onExploreVendors={() => setActiveTab('vendors')}
                onBecomeVendor={() => setShowRegistration(true)}
                onListVenue={() => setShowVenueOwnerRegistration(true)}
              />
            ) : (
              <>
                {(activeTab === 'venues' || activeTab === 'vendors') && (
                  <>
                    <HeroSearch
                      filters={filters}
                      setFilters={setFilters}
                      stats={stats}
                      onSearch={loadData}
                    />

                    <div
                      style={{
                        maxWidth: '1280px',
                        margin: '0 auto',
                        padding: '32px 24px',
                        display: 'grid',
                        gridTemplateColumns: '260px 1fr',
                        gap: '28px',
                        alignItems: 'start',
                      }}
                    >
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
                        </div>

                        {activeTab === 'venues' ? (
                          <VenueGrid
                            venues={venues}
                            onSelectVenue={(venue) => setSelectedVenue(venue)}
                            onBookVenue={(venue) => handleInterceptBook(venue, 'venue')}
                          />
                        ) : (
                          <VendorGrid
                            vendors={vendors}
                            onSelectVendor={(vendor) => setSelectedVendor(vendor)}
                            onBookVendor={(vendor) => handleInterceptBook(vendor, 'vendor')}
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
                  <VendorDashboard currentVendor={currentVendor} />
                )}

                {activeTab === 'venue-owner-dashboard' && currentVenueOwner && (
                  <VenueOwnerDashboard
                    currentOwner={currentVenueOwner}
                    onLogout={() => {
                      setCurrentVenueOwner(null);
                      setActiveRole('CUSTOMER');
                      setActiveTab('venues');
                    }}
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
              </>
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
              onBook={(v) => handleInterceptBook(v, 'vendor')}
            />
          )}

          {currentCustomer && (bookingTargetVenue || bookingTargetVendor) && (
            <BookingModal
              venue={bookingTargetVenue}
              vendor={bookingTargetVendor}
              currentCustomer={currentCustomer}
              onClose={() => {
                setBookingTargetVenue(null);
                setBookingTargetVendor(null);
              }}
              onSuccess={handleBookSuccess}
            />
          )}

          <footer
            style={{
              background: '#0F8F7A',
              borderTop: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '48px 24px',
              color: '#ffffff',
              fontSize: '0.9rem',
              marginTop: 'auto',
            }}
          >
            <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '32px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>Event Planning and SpaceBooking</h3>
                  <p style={{ color: '#e6f7f3', lineHeight: 1.5, maxWidth: '280px' }}>
                    Your platform for discovering and booking event spaces and trusted event professionals.
                  </p>
                </div>

                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: '16px', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.8rem' }}>Explore</h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <li style={{ cursor: 'pointer', color: '#e6f7f3' }} onClick={() => setActiveTab('venues')}>Venues</li>
                    <li style={{ cursor: 'pointer', color: '#e6f7f3' }} onClick={() => setActiveTab('vendors')}>Planners & Services</li>
                    <li style={{ cursor: 'pointer', color: '#e6f7f3' }} onClick={() => setActiveTab('my-bookings')}>My Bookings</li>
                  </ul>
                </div>

                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: '16px', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.8rem' }}>For Vendors</h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <li style={{ cursor: 'pointer', color: '#e6f7f3' }} onClick={() => setShowRegistration(true)}>Become a Vendor</li>
                    <li style={{ cursor: 'pointer', color: '#e6f7f3' }} onClick={() => setShowVenueOwnerRegistration(true)}>List Venue</li>
                  </ul>
                </div>

                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: '16px', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.8rem' }}>Support</h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <li style={{ cursor: 'pointer', color: '#e6f7f3' }}>Contact Us</li>
                    <li style={{ cursor: 'pointer', color: '#e6f7f3' }}>FAQs</li>
                    <li style={{ cursor: 'pointer', color: '#e6f7f3' }}>Help</li>
                  </ul>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.2)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', fontSize: '0.8rem', color: '#e6f7f3' }}>
                <div style={{ display: 'flex', gap: '24px' }}>
                  <span style={{ cursor: 'pointer' }}>Privacy Policy</span>
                  <span style={{ cursor: 'pointer' }}>Terms of Service</span>
                </div>
                <div>
                  &copy; {new Date().getFullYear()} Event Planning and SpaceBooking. All rights reserved.
                </div>
              </div>
            </div>
          </footer>
        </>
      )}

      {showRegistration && (
        <VendorRegistration
          onClose={() => setShowRegistration(false)}
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

      {showVenueOwnerLogin && (
        <VenueOwnerLogin
          onClose={() => setShowVenueOwnerLogin(false)}
          onSuccess={(owner) => {
            setShowVenueOwnerLogin(false);
            setCurrentVenueOwner(owner);
            setActiveRole('VENUE_OWNER');
            setActiveTab('venue-owner-dashboard');
          }}
          onSwitchToRegister={() => {
            setShowVenueOwnerLogin(false);
            setShowVenueOwnerRegistration(true);
          }}
        />
      )}

      {showVenueOwnerRegistration && (
        <VenueOwnerRegistration
          onClose={() => setShowVenueOwnerRegistration(false)}
          onSwitchToLogin={() => {
            setShowVenueOwnerRegistration(false);
            setShowVenueOwnerLogin(true);
          }}
        />
      )}

      {showCustomerLogin && (
        <CustomerLogin
          onClose={() => {
            setShowCustomerLogin(false);
            setBookingTargetVenue(null);
            setBookingTargetVendor(null);
          }}
          onSuccess={handleCustomerLoginSuccess}
          onSwitchToRegister={() => {
            setShowCustomerLogin(false);
            setShowCustomerRegistration(true);
          }}
        />
      )}

      {showCustomerRegistration && (
        <CustomerRegistration
          onClose={() => {
            setShowCustomerRegistration(false);
            setBookingTargetVenue(null);
            setBookingTargetVendor(null);
          }}
          onSwitchToLogin={() => {
            setShowCustomerRegistration(false);
            setShowCustomerLogin(true);
          }}
        />
      )}
    </div>
  );
};

export default App;

