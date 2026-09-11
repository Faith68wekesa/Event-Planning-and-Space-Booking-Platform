import React from 'react';
import type { UserRole } from '../types';
import { Calendar, ShieldCheck, MapPin, Sparkles, UserCheck, Briefcase, Building2 } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeRole: UserRole;
  bookingCount: number;
  onRegisterVendor: () => void;
  onRegisterVenueOwner?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeRole,
  bookingCount,
  onRegisterVendor,
  onRegisterVenueOwner,
}) => {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50 }}>
      {/* Top Green Bar */}
      <div style={{
        background: '#0F8F7A',
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
          <span style={{ cursor: 'pointer' }}>Support</span>
          <span style={{ cursor: 'pointer' }}>My Account</span>
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
          onClick={() => setActiveTab('landing')}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        >
          <div style={{
            background: '#0F8F7A',
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(15, 143, 122, 0.4)'
          }}>
            <Sparkles color="#ffffff" size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#14213D', margin: 0 }}>
              Event Planning and SpaceBooking Platform <span style={{ fontSize: '0.75rem', background: '#ffb800', color: '#0f172a', padding: '2px 8px', borderRadius: '6px', verticalAlign: 'middle', fontWeight: 700 }}>KENYA</span>
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Verified Event Spaces & Planners</p>
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('venues')}
            style={{
              padding: '8px 16px',
              fontSize: '0.88rem',
              background: activeTab === 'venues' ? '#0F8F7A' : 'transparent',
              color: activeTab === 'venues' ? '#ffffff' : '#0F8F7A',
              border: activeTab === 'venues' ? '1px solid #0F8F7A' : '1px solid transparent',
              borderRadius: '8px',
              fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '6px',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            <MapPin size={16} /> Explore Venues
          </button>

          <button
            onClick={() => setActiveTab('vendors')}
            style={{
              padding: '8px 16px',
              fontSize: '0.88rem',
              background: activeTab === 'vendors' ? '#0F8F7A' : 'transparent',
              color: activeTab === 'vendors' ? '#ffffff' : '#0F8F7A',
              border: '1px solid #0F8F7A',
              borderRadius: '8px',
              fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '6px',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            <Briefcase size={16} /> Planners & Services
          </button>

          <button
            onClick={() => setActiveTab('my-bookings')}
            style={{
              padding: '8px 16px',
              fontSize: '0.88rem',
              position: 'relative',
              background: activeTab === 'my-bookings' ? '#0F8F7A' : 'transparent',
              color: activeTab === 'my-bookings' ? '#ffffff' : '#0F8F7A',
              border: '1px solid #0F8F7A',
              borderRadius: '8px',
              fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '6px',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
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

          {activeRole === 'VENUE_OWNER' ? (
            <button
              className={activeTab === 'venue-owner-dashboard' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveTab('venue-owner-dashboard')}
              style={{ padding: '8px 16px', fontSize: '0.88rem', background: '#0F8F7A', color: '#fff', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              <Building2 size={16} /> Venue Owner Portal
            </button>
          ) : activeRole === 'VENDOR' ? (
            <button
              className={activeTab === 'vendor-dashboard' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveTab('vendor-dashboard')}
              style={{ padding: '8px 16px', fontSize: '0.88rem', background: '#0F8F7A', color: '#fff', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              <Briefcase size={16} /> Vendor Portal
            </button>
          ) : activeRole === 'CUSTOMER' ? (
            <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
              <button
                onClick={onRegisterVendor}
                style={{ padding: '8px 14px', fontSize: '0.85rem', background: '#096b5a', color: '#fff', border: '1px solid #096b5a', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                <UserCheck size={16} /> Become a Vendor
              </button>
              {onRegisterVenueOwner && (
                <button
                  onClick={onRegisterVenueOwner}
                  style={{ padding: '8px 14px', fontSize: '0.85rem', background: 'transparent', color: '#0F8F7A', border: '1px solid #0F8F7A', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  <Building2 size={16} /> List Venue
                </button>
              )}
            </div>
          ) : null}

          {activeRole === 'ADMIN' && (
            <button
              className={activeTab === 'admin-dashboard' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveTab('admin-dashboard')}
              style={{ padding: '8px 16px', fontSize: '0.88rem', background: '#14213D', color: '#fff', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              <ShieldCheck size={16} /> Admin Verification
            </button>
          )}
        </div>

      </nav>
    </header>
  );
};
