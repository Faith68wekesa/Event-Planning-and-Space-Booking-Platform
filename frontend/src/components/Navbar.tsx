import React from 'react';
import type { UserRole } from '../types';
import { Calendar, ShieldCheck, MapPin, Sparkles, UserCheck, Briefcase } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeRole: UserRole;
  bookingCount: number;
  onRegisterVendor: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeRole,
  bookingCount,
  onRegisterVendor,
}) => {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50 }}>
      {/* Top Green Bar */}
      <div style={{
        background: '#0d8a73',
        color: '#ffffff',
        padding: '8px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.85rem',
        fontWeight: 500
      }}>
        <div style={{ display: 'flex', gap: '20px' }}>
          <span>+254 795 746 978</span>
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <span style={{ cursor: 'pointer' }}>My Account</span>
          <span style={{ cursor: 'pointer' }}>Support</span>
        </div>
      </div>

      {/* Main Navbar */}
      <nav style={{
        background: '#ffffff',
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
      {/* Brand Logo */}
      <div 
        onClick={() => setActiveTab('venues')}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
      >
        <div style={{
          background: '#0d8a73',
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(13, 138, 115, 0.4)'
        }}>
          <Sparkles color="#ffffff" size={24} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            EventP <span style={{ fontSize: '0.8rem', background: '#ffb800', color: '#0f172a', padding: '2px 8px', borderRadius: '6px', WebkitTextFillColor: 'initial', verticalAlign: 'middle', fontWeight: 700 }}>KENYA</span>
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Verified Event Spaces & Planners</p>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          className={activeTab === 'venues' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('venues')}
          style={{ padding: '8px 16px', fontSize: '0.88rem' }}
        >
          <MapPin size={16} /> Explore Venues
        </button>

        <button
          className={activeTab === 'vendors' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('vendors')}
          style={{ padding: '8px 16px', fontSize: '0.88rem' }}
        >
          <Briefcase size={16} /> Planners & Services
        </button>

        <button
          className={activeTab === 'my-bookings' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('my-bookings')}
          style={{ padding: '8px 16px', fontSize: '0.88rem', position: 'relative' }}
        >
          <Calendar size={16} /> My Bookings
          {bookingCount > 0 && (
            <span style={{
              background: '#ffb800',
              color: '#0f172a',
              fontSize: '0.7rem',
              fontWeight: 800,
              borderRadius: '999px',
              padding: '2px 6px',
              marginLeft: '4px'
            }}>
              {bookingCount}
            </span>
          )}
        </button>

        {activeRole === 'VENDOR' ? (
          <button
            className={activeTab === 'vendor-dashboard' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActiveTab('vendor-dashboard')}
            style={{ padding: '8px 16px', fontSize: '0.88rem' }}
          >
            <Briefcase size={16} /> Vendor Portal
          </button>
        ) : activeRole === 'CUSTOMER' ? (
          <button
            className="btn-primary"
            onClick={onRegisterVendor}
            style={{ padding: '8px 16px', fontSize: '0.88rem', background: '#065f54', color: '#fff', borderColor: '#065f54' }}
          >
            <UserCheck size={16} /> Become a Vendor
          </button>
        ) : null}

        {activeRole === 'ADMIN' && (
          <button
            className={activeTab === 'admin-dashboard' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActiveTab('admin-dashboard')}
            style={{ padding: '8px 16px', fontSize: '0.88rem' }}
          >
            <ShieldCheck size={16} /> Admin Verification
          </button>
        )}
      </div>

    </nav>
    </header>
  );
};
