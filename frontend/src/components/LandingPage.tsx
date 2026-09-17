import React from 'react';
import { ArrowRight, MapPin, Briefcase, Calendar, Search, CheckCircle, DollarSign, UserCheck, Building2 } from 'lucide-react';
import type { FilterState } from '../types';

interface LandingPageProps {
  onSearch: (filters: FilterState) => void;
  filters: FilterState;
  onExploreVenues?: () => void;
  onExploreVendors?: () => void;
  onBecomeVendor?: () => void;
  onListVenue?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSearch,
  filters,
  onExploreVenues,
  onExploreVendors,
  onBecomeVendor,
  onListVenue
}) => {
  const handleSearchClick = () => {
    onSearch(filters);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', minHeight: '100vh' }}>
      {/* 3. Hero Section */}
      <section style={{
        background: 'linear-gradient(to bottom, #e6f7f3, #ffffff)',
        padding: '32px 24px 64px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative'
      }}>
        {/* Quick Links Row */}
        <div style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: '48px',
          width: '100%',
          maxWidth: '1200px'
        }}>
          {onExploreVenues && (
            <button onClick={onExploreVenues} style={{ padding: '10px 20px', borderRadius: '999px', background: '#ffffff', color: '#0F8F7A', border: '1px solid #0F8F7A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(15,143,122,0.1)' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#0F8F7A'; e.currentTarget.style.color = '#ffffff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#0F8F7A'; }}>
              <MapPin size={18} /> Explore Venues
            </button>
          )}
          {onExploreVendors && (
            <button onClick={onExploreVendors} style={{ padding: '10px 20px', borderRadius: '999px', background: '#ffffff', color: '#0F8F7A', border: '1px solid #0F8F7A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(15,143,122,0.1)' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#0F8F7A'; e.currentTarget.style.color = '#ffffff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#0F8F7A'; }}>
              <Briefcase size={18} /> Planners & Services
            </button>
          )}
          {onBecomeVendor && (
            <button onClick={onBecomeVendor} style={{ padding: '10px 20px', borderRadius: '999px', background: '#ffffff', color: '#096b5a', border: '1px solid #096b5a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(9,107,90,0.1)' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#096b5a'; e.currentTarget.style.color = '#ffffff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#096b5a'; }}>
              <UserCheck size={18} /> Become a Vendor
            </button>
          )}
          {onListVenue && (
            <button onClick={onListVenue} style={{ padding: '10px 20px', borderRadius: '999px', background: '#ffffff', color: '#096b5a', border: '1px solid #096b5a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(9,107,90,0.1)' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#096b5a'; e.currentTarget.style.color = '#ffffff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#096b5a'; }}>
              <Building2 size={18} /> List Venue
            </button>
          )}
        </div>

        <div style={{ maxWidth: '1200px', width: '100%', display: 'flex', flexWrap: 'wrap', gap: '48px', alignItems: 'center' }}>

          <div style={{ flex: '1 1 400px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: '#ffffff', padding: '6px 12px', borderRadius: '999px',
              fontSize: '0.85rem', fontWeight: 600, color: '#0F8F7A', marginBottom: '24px',
              border: '1px solid #c9ede4'
            }}>
              <CheckCircle size={14} /> Verified Event Spaces & Service Providers in Kenya
            </div>

            <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, color: '#14213D', lineHeight: 1.1, marginBottom: '24px' }}>
              Everything You Need <br />
              <span style={{ color: '#0F8F7A' }}>for Your Next Event</span>
            </h1>

            <p style={{ fontSize: '1.1rem', color: '#475569', lineHeight: 1.6, marginBottom: '0', maxWidth: '500px' }}>
              Discover verified venues, event planners and trusted service providers across Kenya — all in one place.
            </p>
          </div>

          <div style={{ flex: '1 1 400px', display: 'flex', justifyContent: 'center' }}>
            <img
              src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80"
              alt="Event Celebration"
              style={{ width: '100%', maxWidth: '500px', borderRadius: '24px', boxShadow: '0 24px 48px rgba(15, 143, 122, 0.15)' }}
            />
          </div>
        </div>
      </section>




      {/* 8. Featured Event Spaces */}
      <section style={{ padding: '80px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
            <div>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#14213D', marginBottom: '8px' }}>Featured Event Spaces</h2>
              <p style={{ color: '#64748b', fontSize: '1.1rem', margin: 0 }}>Discover highly-rated venues for your next occasion.</p>
            </div>
            <button onClick={handleSearchClick} style={{ background: 'transparent', border: 'none', color: '#0F8F7A', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View All <ArrowRight size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
            {[
              { name: 'Karen Oasis Gardens', location: 'Nairobi', price: 'KES 85,000/day', rating: '4.8', img: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=600&q=80' },
              { name: 'Rift Valley Heights', location: 'Nakuru', price: 'KES 120,000/day', rating: '4.9', img: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=600&q=80' },
              { name: 'Ocean Breeze Villa', location: 'Mombasa', price: 'KES 150,000/day', rating: '4.7', img: 'https://images.unsplash.com/photo-1543162255-9a85e839e4e3?auto=format&fit=crop&w=600&q=80' },
            ].map((venue, i) => (
              <div key={i} style={{ background: '#ffffff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <div style={{ height: '200px', background: `url(${venue.img}) center/cover` }}></div>
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0F8F7A', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px' }}>
                    <CheckCircle size={14} /> Verified
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#14213D', margin: '0 0 8px 0' }}>{venue.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '0.9rem', marginBottom: '16px' }}>
                    <MapPin size={16} /> {venue.location}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                    <div>
                      <span style={{ color: '#14213D', fontWeight: 800 }}>{venue.price}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontWeight: 600 }}>
                      ★ {venue.rating}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Why Choose Event Planning and SpaceBooking Platform? */}
      <section style={{ padding: '80px 24px', background: '#ffffff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#14213D', marginBottom: '48px' }}>Why Choose Event Planning and SpaceBooking Platform?</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '32px' }}>
            <div>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#e6f7f3', color: '#0F8F7A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle size={32} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#14213D', marginBottom: '12px' }}>Verified Providers</h3>
              <p style={{ color: '#64748b', lineHeight: 1.6 }}>Discover trusted event venues and professionals.</p>
            </div>

            <div>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#e6f7f3', color: '#0F8F7A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Search size={32} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#14213D', marginBottom: '12px' }}>Easy Discovery</h3>
              <p style={{ color: '#64748b', lineHeight: 1.6 }}>Find spaces and services using simple search and filters.</p>
            </div>

            <div>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#e6f7f3', color: '#0F8F7A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <DollarSign size={32} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#14213D', marginBottom: '12px' }}>Transparent Pricing</h3>
              <p style={{ color: '#64748b', lineHeight: 1.6 }}>Explore options based on your event requirements and budget.</p>
            </div>

            <div>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#e6f7f3', color: '#0F8F7A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Calendar size={32} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#14213D', marginBottom: '12px' }}>Simple Booking</h3>
              <p style={{ color: '#64748b', lineHeight: 1.6 }}>Send booking requests and manage your bookings in one place.</p>
            </div>
          </div>
        </div>
      </section>





      {/* CSS for hover states since inline styles don't support pseudo-classes fully */}
      <style>{`
        .service-icon, .service-title { transition: all 0.2s ease; }
        div:hover > .service-icon { color: #ffffff !important; }
        div:hover > .service-title { color: #ffffff !important; }
      `}</style>
    </div>
  );
};
