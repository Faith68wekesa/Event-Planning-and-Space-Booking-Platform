import React, { useState, useEffect } from 'react';
import type { UserRole, Venue, Vendor, VenueOwner, Booking, PlatformStats, FilterState } from './types';
import { ApiService, setApiCurrentUserId, setApiAuthToken } from './services/api.ts';
import { LandingPage } from './components/LandingPage.tsx';
import { Navbar } from './components/Navbar.tsx';
import { HeroSearch } from './components/HeroSearch.tsx';
import { VenueGrid } from './components/VenueGrid.tsx';
import { FilterSidebar } from './components/FilterSidebar.tsx';
import { VenueModal } from './components/VenueModal.tsx';
import { BookingModal } from './components/BookingModal.tsx';
import { CustomerDashboard } from './components/CustomerDashboard.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { ProviderDashboard } from './components/ProviderDashboard.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import type { User as UserType } from './types';
import { Toaster, toast } from 'react-hot-toast';

const VENUE_CATEGORY_CODES = new Set([
  'WEDDING',
  'CONFERENCE',
  'BIRTHDAY',
  'OUTDOOR',
  'PARTY',
  'EXHIBITION',
]);

const SERVICE_CATEGORY_CODES = new Set([
  'PHOTOGRAPHY',
  'CATERING',
  'DECORATION',
  'ENTERTAINMENT',
  'PLANNING',
  'SOUND',
]);

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserType | null>(() => {
    try {
      const saved = localStorage.getItem('locyfy_session_auth');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.user) return parsed.user;
      }
    } catch (e) {}
    return null;
  });

  const [currentVendor, setCurrentVendor] = useState<Vendor | null>(() => {
    try {
      const saved = localStorage.getItem('locyfy_session_auth');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.vendor_profile) return parsed.vendor_profile;
      }
    } catch (e) {}
    return null;
  });

  const [currentVenueOwner, setCurrentVenueOwner] = useState<VenueOwner | null>(() => {
    try {
      const saved = localStorage.getItem('locyfy_session_auth');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.venue_owner_profile) return parsed.venue_owner_profile;
      }
    } catch (e) {}
    return null;
  });

  const [activeRole, setActiveRole] = useState<UserRole>(() => {
    try {
      const saved = localStorage.getItem('locyfy_session_auth');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.user?.role === 'ADMIN' || parsed?.user?.is_staff || parsed?.user?.is_superuser) {
          return 'ADMIN';
        }
        if (parsed?.user?.role === 'PROVIDER' || parsed?.vendor_profile || parsed?.venue_owner_profile) {
          return 'PROVIDER';
        }
      }
    } catch (e) {}
    return 'CUSTOMER';
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('locyfy_session_auth');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.user?.role === 'ADMIN' || parsed?.user?.is_staff || parsed?.user?.is_superuser) {
          return 'admin-dashboard';
        }
      }
    } catch (e) {}
    return 'landing';
  });

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    category: 'ALL',
    vendor_type: 'ALL',
    location: 'ALL',
    max_price: 5000000,
    min_capacity: 0,
    verified_only: false,
  });

  const [venues, setVenues] = useState<Venue[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [services, setServices] = useState<Venue[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<PlatformStats>({
    total_venues: 0,
    verified_venues: 0,
    total_vendors: 0,
    verified_vendors: 0,
    total_bookings: 0,
    satisfied_clients: 0,
  });

  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [customerChatPartnerId, setCustomerChatPartnerId] = useState<number | null>(null);
  const [bookingTargetVenue, setBookingTargetVenue] = useState<Venue | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAdminAuthModal, setIsAdminAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const handleInterceptBook = (target: Venue) => {
    setBookingTargetVenue(target);

    if (!currentUser) {
      setIsAdminAuthModal(false);
      setAuthMode('login'); 
      setShowAuthModal(true);
    }
  };

  const loadData = async () => {
    const fetchedVenues = await ApiService.getVenues(filters);
    const fetchedVendors = await ApiService.getVendors(filters);
    const fetchedStats = await ApiService.getStats();

    setVenues(fetchedVenues.filter(
      (listing) => listing.listing_type === 'VENUE'
    ));

    setServices(fetchedVenues.filter(
      (listing) => listing.listing_type === 'SERVICE'
    ));

    setVendors(fetchedVendors);
    setStats(fetchedStats);

    // Track search or category exploration
    if (filters.search && filters.search.trim().length > 0) {
      ApiService.trackInteraction({
        event_type: 'SEARCH',
        search_query: filters.search.trim(),
        category: filters.category !== 'ALL' ? filters.category : undefined,
        location_filter: filters.location !== 'ALL' ? filters.location : undefined,
        source: 'catalog_search',
        user: currentUser?.id,
      });
    } else if (filters.category && filters.category !== 'ALL') {
      ApiService.trackInteraction({
        event_type: 'CATEGORY_INTEREST',
        category: filters.category,
        location_filter: filters.location !== 'ALL' ? filters.location : undefined,
        source: 'category_filter',
        user: currentUser?.id,
      });
    }
  };

  const navigateToTab = (nextTab: string) => {
    setActiveTab(nextTab);
    setFilters((current) => {
      if (nextTab === 'services' || nextTab === 'vendors') {
        return {
          ...current,
          category: VENUE_CATEGORY_CODES.has(current.category) ? 'ALL' : current.category,
          min_capacity: 0,
        };
      }

      if (
        nextTab === 'venues' &&
        current.category !== 'ALL' &&
        !VENUE_CATEGORY_CODES.has(current.category)
      ) {
        return { ...current, category: 'ALL' };
      }

      return current;
    });
  };

  const handleNavbarTabChange: React.Dispatch<React.SetStateAction<string>> = (nextTab) => {
    navigateToTab(typeof nextTab === 'function' ? nextTab(activeTab) : nextTab);
  };

  useEffect(() => {
    if (currentUser) {
      setApiCurrentUserId(currentUser.id);

      const savedToken = localStorage.getItem('locyfy_auth_token');
      setApiAuthToken(savedToken);

      try {
        localStorage.setItem('locyfy_session_auth', JSON.stringify({
          user: currentUser,
          vendor_profile: currentVendor,
          venue_owner_profile: currentVenueOwner,
        }));
      } catch (e) {}

      ApiService.getBookings(currentUser.id).then(setBookings);
    } else {
      setApiCurrentUserId(null);
      setApiAuthToken(null);

      try {
        localStorage.removeItem('locyfy_session_auth');
        localStorage.removeItem('locyfy_auth_token');
      } catch (e) {}

      setBookings([]);
    }
  }, [currentUser, currentVendor, currentVenueOwner, activeTab]);

  const isAdmin = Boolean(currentUser && (
    currentUser.role === 'ADMIN' || 
    currentUser.is_staff || 
    currentUser.is_superuser
  ));

  const handleOpenAdmin = () => {
    if (!currentUser) {
      toast('Please log in with an administrator account to access Admin Mode.', {
        icon: '🔒',
        duration: 4000,
      });
      setIsAdminAuthModal(true);
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }
    if (!isAdmin) {
      toast.error('Access Denied: Only platform administrators can access Admin Mode.');
      return;
    }
    setActiveRole('ADMIN');
    setActiveTab('admin-dashboard');
  };

  useEffect(() => {
    loadData();
  }, [filters, activeTab]);

  const handleBookSuccess = (newBooking: Booking) => {
    setBookings((prev) => [newBooking, ...prev]);
    setActiveTab('my-bookings');
  };

  const handleCancelBooking = async (id: number, reason?: string): Promise<{ success: boolean; error?: string }> => {
    const res = await ApiService.updateBookingStatus(id, 'CANCELLED', { reason });
    if (res.success) {
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'CANCELLED', cancellation_reason: reason } : b)));
      return { success: true };
    }
    return { success: false, error: res.error || 'Failed to cancel booking.' };
  };

  const handleToggleVerifyVenue = async (id: number) => {
    const ok = await ApiService.toggleVerifyVenue(id);
    if (ok) {
      setVenues((prev) => prev.map((v) => (v.id === id ? { ...v, is_verified: !v.is_verified } : v)));
      loadData();
    }
  };

  const handleToggleVerifyVendor = async (id: number) => {
    const ok = await ApiService.toggleVerifyVendor(id);
    if (ok) {
      setVendors((prev) => prev.map((v) => (v.id === id ? { ...v, is_verified: !v.is_verified } : v)));
      loadData();
    }
  };

  const handleRequestRole = async (
    role: 'CUSTOMER' | 'VENDOR' | 'VENUE_OWNER' | 'PROVIDER' | 'ADMIN',
    nextTab: string = 'my-bookings'
  ) => {
    if (!currentUser) return;
    if (role === 'ADMIN') {
      toast.error('Access Denied: Administrator roles cannot be requested.');
      return;
    }
    const roleName = role === 'PROVIDER' ? 'Business Provider' : role === 'VENDOR' ? 'Vendor' : role === 'VENUE_OWNER' ? 'Venue Owner' : 'Customer';
    const toastId = toast.loading(`Activating ${roleName} mode...`);
    try {
      const data = await ApiService.requestRole(currentUser.id, role);
      if (data && data.user) {
        toast.success(role === 'PROVIDER' ? 'Welcome to your Vendor Dashboard!' : `${roleName} mode activated!`, { id: toastId });
        setCurrentUser(data.user);
        if (data.vendor_profile) setCurrentVendor(data.vendor_profile);
        if (data.venue_owner_profile) setCurrentVenueOwner(data.venue_owner_profile);
        
        if (role === 'CUSTOMER') {
          setActiveRole('CUSTOMER');
          setActiveTab(nextTab);
        } else {
          setActiveRole('PROVIDER');
          setActiveTab('provider-dashboard');
        }
      } else {
        toast.error("Failed to activate role.", { id: toastId });
      }
    } catch (err) {
      toast.error("An error occurred.", { id: toastId });
    }
  };

  const handleSelectVenueWithTracking = (venue: Venue, source: string = 'grid') => {
    setSelectedVenue(venue);
    ApiService.trackInteraction({
      event_type: 'LISTING_CLICK',
      listing_type: venue.listing_type || 'VENUE',
      venue: venue.id,
      category: venue.category,
      source: source,
      user: currentUser?.id,
    });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Toaster position="top-center" reverseOrder={false} />
      <>
        {activeTab !== 'my-bookings' &&
          activeTab !== 'provider-dashboard' &&
          activeTab !== 'vendor-dashboard' &&
          activeTab !== 'venue-owner-dashboard' && (
          <Navbar
            activeTab={activeTab}
            setActiveTab={handleNavbarTabChange}
            activeRole={activeRole}
            setActiveRole={setActiveRole}
            currentUser={currentUser}
            onLoginClick={() => { setIsAdminAuthModal(false); setAuthMode('login'); setShowAuthModal(true); }}
            onRegisterClick={() => { setIsAdminAuthModal(false); setAuthMode('register'); setShowAuthModal(true); }}
            onRequestRole={handleRequestRole}
            searchQuery={filters.search}
            onSearchChange={(q) => setFilters((f) => ({ ...f, search: q }))}
            onLogoutClick={() => {
              setCurrentUser(null);
              setActiveRole('CUSTOMER');
              setActiveTab('landing');
            }}
          />
        )}

          <main style={{ flexGrow: 1 }}>
            {activeTab === 'landing' ? (
              <LandingPage
                onSearch={(newFilters) => {
                  setFilters(newFilters);
                  navigateToTab(
                    SERVICE_CATEGORY_CODES.has(newFilters.category) ? 'services' : 'venues'
                  );
                }}
                filters={filters}
                onExploreVenues={() => navigateToTab('venues')}
                onExploreServices={() => navigateToTab('services')}
                onSelectVenue={(venue) => handleSelectVenueWithTracking(venue, 'landing_page')}
                onBookVenue={handleInterceptBook}
                onOpenAdmin={handleOpenAdmin}
                currentUser={currentUser}
              />
            ) : (
              <>
                {(activeTab === 'venues' || activeTab === 'services' || activeTab === 'vendors') && (
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
                        activeTab={activeTab === 'venues' ? 'venues' : 'services'}
                      />

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b' }}>
                            {activeTab === 'venues'
                              ? `Available Event Venues (${venues.length})`
                              : `Available Event Services (${services.length})`}
                          </h2>
                        </div>

                        {activeTab === 'venues' ? (
                          <VenueGrid
                            venues={venues}
                            onSelectVenue={(venue) => handleSelectVenueWithTracking(venue, 'catalog_grid')}
                            onBookVenue={handleInterceptBook}
                          />
                        ) : activeTab === 'services' ? (
                          <VenueGrid
                            venues={services}
                            onSelectVenue={(service) => handleSelectVenueWithTracking(service, 'catalog_grid')}
                            onBookVenue={handleInterceptBook}
                            emptyMessage="No Services Found"
                          />
                        ) : (
                          <VenueGrid
                            venues={services}
                            onSelectVenue={(service) => handleSelectVenueWithTracking(service, 'catalog_grid')}
                            onBookVenue={handleInterceptBook}
                            emptyMessage="No Service Listings Found"
                          />
                        )}
                      </div>
                    </div>
                  </>
                )}

                {(activeTab === 'my-bookings' || activeTab === 'my-events') && (
                  <CustomerDashboard
                    bookings={bookings}
                    currentUser={currentUser}
                    initialTab={customerChatPartnerId ? 'messages' : (activeTab === 'my-events' ? 'events' : 'dashboard')}
                    initialChatPartnerId={customerChatPartnerId}
                    onCancelBooking={handleCancelBooking}
                    onNavigate={(tab) => {
                      if (tab !== 'messages') setCustomerChatPartnerId(null);
                      navigateToTab(tab);
                    }}
                    handleSelectVenueWithTracking={handleSelectVenueWithTracking}
                    onBookVenue={handleInterceptBook}
                    venues={venues}
                    services={services}
                    onLogout={() => {
                      setCurrentUser(null);
                      setActiveRole('CUSTOMER');
                      setActiveTab('landing');
                      setCustomerChatPartnerId(null);
                    }}
                    onRequestRole={handleRequestRole}
                  />
                )}

                {(activeTab === 'provider-dashboard' || activeTab === 'vendor-dashboard' || activeTab === 'venue-owner-dashboard') && (
                  <ProviderDashboard
                    currentUser={currentUser}
                    currentVendor={currentVendor}
                    currentVenueOwner={currentVenueOwner}
                    onLogout={() => {
                      setCurrentUser(null);
                      setCurrentVendor(null);
                      setCurrentVenueOwner(null);
                      setActiveRole('CUSTOMER');
                      setActiveTab('landing');
                    }}
                    onExplore={() => handleRequestRole('CUSTOMER')}
                  />
                )}

                {activeTab === 'admin-dashboard' && (
                  <AdminDashboard
                    venues={venues}
                    vendors={vendors}
                    onToggleVerifyVenue={handleToggleVerifyVenue}
                    onToggleVerifyVendor={handleToggleVerifyVendor}
                    currentUser={currentUser}
                    onDataChange={loadData}
                    onNavigateHome={() => {
                      loadData();
                      navigateToTab('venues');
                    }}
                    onLoginClick={() => {
                      setIsAdminAuthModal(true);
                      setAuthMode('login');
                      setShowAuthModal(true);
                    }}
                    onLogout={() => {
                      setCurrentUser(null);
                      setActiveRole('CUSTOMER');
                      setActiveTab('landing');
                    }}
                  />
                )}
              </>
            )}
          </main>

          {selectedVenue && (
            <VenueModal
              venue={selectedVenue}
              currentUser={currentUser}
              onClose={() => setSelectedVenue(null)}
              onBook={(v) => setBookingTargetVenue(v)}
              onMessage={(target) => {
                setSelectedVenue(null);
                if (target?.recipientId) {
                  setCustomerChatPartnerId(target.recipientId);
                }
                setActiveRole('CUSTOMER');
                setActiveTab('my-bookings');
              }}
            />
          )}

          {currentUser && bookingTargetVenue && (
            <BookingModal
              venue={bookingTargetVenue}
              currentUser={currentUser}
              onClose={() => {
                setBookingTargetVenue(null);
              }}
              onSuccess={handleBookSuccess}
            />
          )}

          {![
            'my-bookings',
            'my-events',
            'provider-dashboard',
            'vendor-dashboard',
            'venue-owner-dashboard',
            'admin-dashboard',
          ].includes(activeTab) && (
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
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '14px', letterSpacing: '-0.5px' }}>Locyfy</h3>
                  <p style={{ color: '#e6f7f3', lineHeight: 1.6, maxWidth: '280px', fontSize: '0.9rem' }}>
                    Your unified platform for discovering, listing, and booking physical event spaces and trusted services across Nyeri County.
                  </p>
                </div>

                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: '16px', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.8rem' }}>Explore</h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <li style={{ cursor: 'pointer', color: '#e6f7f3' }} onClick={() => navigateToTab('venues')}>Venues</li>
                    <li style={{ cursor: 'pointer', color: '#e6f7f3' }} onClick={() => navigateToTab('services')}>Service Listings</li>
                    <li style={{ cursor: 'pointer', color: '#e6f7f3' }} onClick={() => setActiveTab('my-bookings')}>My Bookings</li>
                  </ul>
                </div>

                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: '16px', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.8rem' }}>For Providers</h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <li style={{ cursor: 'pointer', color: '#e6f7f3' }} onClick={() => { setIsAdminAuthModal(false); setAuthMode('register'); setShowAuthModal(true); }}>Become a Business Provider</li>
                    <li style={{ cursor: 'pointer', color: '#e6f7f3' }} onClick={() => { setIsAdminAuthModal(false); setAuthMode('register'); setShowAuthModal(true); }}>List Spaces & Services</li>
                  </ul>
                </div>

                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: '16px', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.8rem' }}>Support</h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <li style={{ cursor: 'pointer', color: '#e6f7f3' }}>Contact Us</li>
                    <li style={{ cursor: 'pointer', color: '#e6f7f3' }}>FAQs</li>
                    <li style={{ cursor: 'pointer', color: '#e6f7f3' }}>Help</li>
                    {(!currentUser || isAdmin) && (
                      <li style={{ cursor: 'pointer', color: '#e6f7f3' }} onClick={handleOpenAdmin}>Admin Portal</li>
                    )}
                  </ul>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.2)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', fontSize: '0.8rem', color: '#e6f7f3' }}>
                <div style={{ display: 'flex', gap: '24px' }}>
                  <span style={{ cursor: 'pointer' }}>Privacy Policy</span>
                  <span style={{ cursor: 'pointer' }}>Terms of Service</span>
                </div>
                <div>
                  &copy; {new Date().getFullYear()} Locyfy. All rights reserved.
                </div>
              </div>
            </div>
            </footer>
          )}
        </>

      {showAuthModal && (
        <AuthModal
          initialMode={authMode}
          isAdminLogin={isAdminAuthModal}
          onClose={() => {
            setShowAuthModal(false);
            setIsAdminAuthModal(false);
            setBookingTargetVenue(null);
          }}
          onSuccess={(data) => {
            setShowAuthModal(false);
            setIsAdminAuthModal(false);
            setCurrentUser(data.user);
            if (data.vendor_profile) setCurrentVendor(data.vendor_profile);
            if (data.venue_owner_profile) setCurrentVenueOwner(data.venue_owner_profile);
            
            // Set primary active role based on selection or roles available
            if (data.roles?.is_admin || data.user?.role === 'ADMIN') {
              setActiveRole('ADMIN');
              setActiveTab('admin-dashboard');
            } else if (data.roles?.is_provider || data.user?.role === 'PROVIDER' || (data.roles?.is_vendor && data.roles?.is_venue_owner)) {
              setActiveRole('PROVIDER');
              setActiveTab('provider-dashboard');
            } else if (data.roles?.is_vendor || data.roles?.is_venue_owner) {
              setActiveRole('PROVIDER');
              setActiveTab('provider-dashboard');
            } else {
              setActiveRole('CUSTOMER');
              setActiveTab('landing');
            }
          }}
        />
      )}
    </div>
  );
};

export default App;

