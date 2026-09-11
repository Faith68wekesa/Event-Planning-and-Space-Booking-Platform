import React, { useState } from 'react';
import { ArrowRight, MapPin, Briefcase, Calendar, Users, Search, CheckCircle, TrendingUp, DollarSign, Camera, Utensils, Music, HeartHandshake, Sparkles } from 'lucide-react';
import type { FilterState } from '../types';

interface LandingPageProps {
  onSearch: (filters: FilterState) => void;
  filters: FilterState;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSearch, filters }) => {
  const [searchState, setSearchState] = useState<FilterState>(filters);

  const handleSearchClick = () => {
    onSearch(searchState);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', minHeight: '100vh' }}>
      {/* 3. Hero Section */}
      <section style={{ 
        background: 'linear-gradient(to bottom, #e6f7f3, #ffffff)', 
        padding: '64px 24px', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        position: 'relative'
      }}>
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
              Everything You Need <br/>
              <span style={{ color: '#0F8F7A' }}>for Your Next Event</span>
            </h1>
            
            <p style={{ fontSize: '1.1rem', color: '#475569', lineHeight: 1.6, marginBottom: '0', maxWidth: '500px' }}>
              Discover verified venues, event planners and trusted service providers across Kenya — all in one place.
            </p>
          </div>

          <div style={{ flex: '1 1 400px', display: 'flex', justifyContent: 'center' }}>
            <img 
              src="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80" 
              alt="Event Celebration" 
              style={{ width: '100%', maxWidth: '500px', borderRadius: '24px', boxShadow: '0 24px 48px rgba(15, 143, 122, 0.15)' }} 
            />
          </div>
        </div>
      </section>

      {/* 4. Search Section */}
      <section style={{ padding: '0 24px', marginTop: '-64px', position: 'relative', zIndex: 10 }}>
        <div style={{ 
          maxWidth: '1000px', margin: '0 auto', background: '#ffffff', 
          borderRadius: '24px', padding: '32px', boxShadow: '0 12px 32px rgba(0,0,0,0.08)',
          border: '1px solid rgba(0,0,0,0.05)'
        }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#14213D', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search color="#0F8F7A" size={24} /> What are you looking for?
          </h2>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Location</label>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <MapPin size={18} color="#94a3b8" style={{ marginRight: '8px' }} />
                <input 
                  type="text" 
                  placeholder="e.g. Nairobi" 
                  value={searchState.location === 'ALL' ? '' : searchState.location}
                  onChange={(e) => setSearchState({...searchState, location: e.target.value})}
                  style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.95rem' }}
                />
              </div>
            </div>
            
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Event Date</label>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <Calendar size={18} color="#94a3b8" style={{ marginRight: '8px' }} />
                <input 
                  type="date" 
                  style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.95rem', color: '#1e293b' }}
                />
              </div>
            </div>

            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Guests</label>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <Users size={18} color="#94a3b8" style={{ marginRight: '8px' }} />
                <input 
                  type="number" 
                  placeholder="0"
                  value={searchState.min_capacity || ''}
                  onChange={(e) => setSearchState({...searchState, min_capacity: parseInt(e.target.value) || 0})}
                  style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.95rem' }}
                />
              </div>
            </div>

            <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end' }}>
              <button 
                onClick={handleSearchClick}
                style={{ 
                  background: '#0F8F7A', color: '#ffffff', padding: '12px 32px', 
                  borderRadius: '12px', border: 'none', fontSize: '1rem', fontWeight: 700, 
                  cursor: 'pointer', height: '44px', display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 4px 12px rgba(15, 143, 122, 0.3)', transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                Search Events <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Event Categories */}
      <section style={{ padding: '80px 24px', background: '#ffffff', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#14213D', marginBottom: '8px' }}>What Are You Planning?</h2>
        <p style={{ color: '#64748b', marginBottom: '40px', fontSize: '1.1rem' }}>Find the right spaces and services for every occasion.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px', maxWidth: '1000px', margin: '0 auto' }}>
          {[
            { icon: '💍', label: 'Weddings' },
            { icon: '🎂', label: 'Birthdays' },
            { icon: '💼', label: 'Corporate' },
            { icon: '🎓', label: 'Graduation' },
            { icon: '🎉', label: 'Parties' },
            { icon: '🌿', label: 'Outdoor' },
            { icon: '📸', label: 'Photography' },
            { icon: '🍽', label: 'Catering' },
          ].map((cat, i) => (
            <div key={i} style={{ 
              background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', 
              padding: '24px 16px', cursor: 'pointer', transition: 'all 0.3s',
              boxShadow: '0 4px 6px rgba(0,0,0,0.02)'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0F8F7A'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 20px rgba(15, 143, 122, 0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.02)'; }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>{cat.icon}</div>
              <div style={{ fontWeight: 600, color: '#14213D' }}>{cat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Popular Locations */}
      <section style={{ padding: '80px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#14213D', marginBottom: '8px' }}>Explore Event Spaces Across Kenya</h2>
          <p style={{ color: '#64748b', marginBottom: '40px', fontSize: '1.1rem' }}>Discover event spaces and professionals in popular destinations.</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
            {['Nairobi', 'Mombasa', 'Nakuru', 'Nyeri'].map((city, i) => (
              <div key={i} style={{ 
                background: '#ffffff', borderRadius: '20px', padding: '24px', 
                border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', flexDirection: 'column', gap: '16px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#0F8F7A'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#e6f7f3', color: '#0F8F7A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={24} />
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#14213D', margin: 0 }}>{city}</h3>
                <div style={{ color: '#0F8F7A', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: 'auto' }}>
                  Explore <ArrowRight size={16} />
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

      {/* 9. Event Services & Professionals */}
      <section style={{ padding: '80px 24px', background: '#ffffff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#14213D', marginBottom: '8px' }}>Find Event Professionals</h2>
          <p style={{ color: '#64748b', fontSize: '1.1rem', marginBottom: '40px' }}>Complete your event with trusted service providers.</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
            {[
              { name: 'Photography', icon: <Camera size={32} /> },
              { name: 'Catering', icon: <Utensils size={32} /> },
              { name: 'Decoration', icon: <Sparkles size={32} /> },
              { name: 'Event Planning', icon: <Briefcase size={32} /> },
              { name: 'Entertainment', icon: <Music size={32} /> },
            ].map((service, i) => (
              <div key={i} style={{ 
                background: '#f8fafc', borderRadius: '16px', padding: '32px 24px', 
                textAlign: 'center', border: '1px solid #e2e8f0', cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#0F8F7A'; e.currentTarget.style.color = '#ffffff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = 'inherit'; }}
              >
                <div style={{ color: '#0F8F7A', marginBottom: '16px', transition: 'color 0.2s' }} className="service-icon">
                  {service.icon}
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#14213D', marginBottom: '16px', transition: 'color 0.2s' }} className="service-title">{service.name}</h3>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  Explore <ArrowRight size={14} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. How It Works */}
      <section style={{ padding: '80px 24px', background: '#14213D', color: '#ffffff' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '48px' }}>Plan Your Event in Three Simple Steps</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '40px', position: 'relative' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: 'rgba(255,255,255,0.1)', marginBottom: '-24px' }}>01</div>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#0F8F7A', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', position: 'relative', zIndex: 2 }}>
                <Search size={32} color="#ffffff" />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '12px' }}>DISCOVER</h3>
              <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>Find venues and event providers that match your vision.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: 'rgba(255,255,255,0.1)', marginBottom: '-24px' }}>02</div>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#0F8F7A', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', position: 'relative', zIndex: 2 }}>
                <TrendingUp size={32} color="#ffffff" />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '12px' }}>COMPARE</h3>
              <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>Review options, compare prices, and check availability.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: 'rgba(255,255,255,0.1)', marginBottom: '-24px' }}>03</div>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#0F8F7A', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', position: 'relative', zIndex: 2 }}>
                <Calendar size={32} color="#ffffff" />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '12px' }}>BOOK</h3>
              <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>Send a booking request directly through our platform.</p>
            </div>

          </div>
        </div>
      </section>

      {/* 11. Vendor Call-to-Action */}
      <section style={{ padding: '80px 24px', background: '#e6f7f3' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#0F8F7A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <HeartHandshake size={32} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#14213D', marginBottom: '16px' }}>Have an Event Service to Offer?</h2>
          <p style={{ color: '#475569', fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '32px' }}>
            Join Event Planning and SpaceBooking Platform and connect your venue or event service with customers looking for trusted professionals across Kenya.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0F8F7A', fontWeight: 600 }}><CheckCircle size={16} /> List your venue</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0F8F7A', fontWeight: 600 }}><CheckCircle size={16} /> Showcase your services</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0F8F7A', fontWeight: 600 }}><CheckCircle size={16} /> Manage booking requests</span>
          </div>
          <button style={{ 
            background: '#0F8F7A', color: '#ffffff', padding: '14px 36px', 
            borderRadius: '12px', border: 'none', fontSize: '1.1rem', fontWeight: 700, 
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 8px 24px rgba(15, 143, 122, 0.25)', transition: 'all 0.2s'
          }}>
            Become a Vendor <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* 12. Final Call-to-Action */}
      <section style={{ padding: '100px 24px', background: '#ffffff', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#14213D', marginBottom: '16px' }}>Ready to Plan Your Next Event?</h2>
        <p style={{ color: '#64748b', fontSize: '1.2rem', marginBottom: '40px' }}>Discover event spaces and trusted professionals across Kenya.</p>
        <button 
          onClick={handleSearchClick}
          style={{ 
            background: '#14213D', color: '#ffffff', padding: '14px 40px', 
            borderRadius: '12px', border: 'none', fontSize: '1.1rem', fontWeight: 700, 
            cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          Explore Venues
        </button>
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
