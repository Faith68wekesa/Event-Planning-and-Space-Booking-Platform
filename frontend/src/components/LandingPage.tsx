import React from 'react';
import { ArrowRight, Sparkles, MapPin, Briefcase } from 'lucide-react';

interface LandingPageProps {
  onSelectCustomer: () => void;
  onSelectVendor: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSelectCustomer, onSelectVendor }) => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'url("https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=2000&q=80") center/cover no-repeat',
      position: 'relative'
    }}>
      {/* Overlay to ensure text readability */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(13, 138, 115, 0.7) 100%)',
        zIndex: 1
      }}></div>

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', flex: 1 }}>
        
        {/* Simple Header */}
        <header style={{ padding: '24px 48px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: '#ffffff',
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)'
          }}>
            <Sparkles color="#0d8a73" size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              EventP <span style={{ fontSize: '0.85rem', background: '#ffb800', color: '#0f172a', padding: '2px 8px', borderRadius: '6px', verticalAlign: 'middle', fontWeight: 700 }}>KENYA</span>
            </h1>
          </div>
        </header>

        {/* Main Content */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, color: '#ffffff', marginBottom: '16px', lineHeight: 1.1, maxWidth: '800px' }}>
            Book the perfect space for your next event
          </h2>
          <p style={{ fontSize: '1.1rem', color: '#e2e8f0', marginBottom: '48px', maxWidth: '600px', lineHeight: 1.5 }}>
            Kenya's premium platform for discovering verified venues and professional event services. 
            How would you like to use EventP today?
          </p>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
            
            {/* Customer Card */}
            <div 
              onClick={onSelectCustomer}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '16px',
                padding: '32px',
                width: '320px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              }}
              className="landing-card"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ background: '#0d8a73', padding: '16px', borderRadius: '50%', color: '#fff' }}>
                <MapPin size={32} />
              </div>
              <div>
                <h3 style={{ color: '#fff', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 8px 0' }}>I'm a Customer</h3>
                <p style={{ color: '#cbd5e1', fontSize: '0.95rem', margin: 0, lineHeight: 1.4 }}>
                  I want to browse and book event venues or planners.
                </p>
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: '#ffb800', fontWeight: 600, fontSize: '0.9rem' }}>
                Start exploring <ArrowRight size={16} />
              </div>
            </div>

            {/* Vendor Card */}
            <div 
              onClick={onSelectVendor}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '16px',
                padding: '32px',
                width: '320px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              }}
              className="landing-card"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ background: '#ffb800', padding: '16px', borderRadius: '50%', color: '#0f172a' }}>
                <Briefcase size={32} />
              </div>
              <div>
                <h3 style={{ color: '#fff', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 8px 0' }}>I'm a Vendor</h3>
                <p style={{ color: '#cbd5e1', fontSize: '0.95rem', margin: 0, lineHeight: 1.4 }}>
                  I want to list my venue or event services and get bookings.
                </p>
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: '#0d8a73', fontWeight: 600, fontSize: '0.9rem' }}>
                Login / Register <ArrowRight size={16} />
              </div>
            </div>

          </div>
        </main>
        
        {/* Footer */}
        <footer style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
          &copy; {new Date().getFullYear()} EventP Kenya Platform. All rights reserved.
        </footer>
      </div>
    </div>
  );
};
