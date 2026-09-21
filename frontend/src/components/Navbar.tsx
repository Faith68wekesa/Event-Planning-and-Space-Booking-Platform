import React from 'react';
import type { UserRole } from '../types';
import { ShieldCheck, Sparkles, Briefcase, Building2, Search, User } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeRole: UserRole;
  bookingCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeRole,
  bookingCount,
}) => {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50 }}>

      {/* Main Navbar */}
      <nav style={{
        background: '#ffffff',
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
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
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#14213D', margin: 0, whiteSpace: 'nowrap' }}>
              Event Planning and SpaceBooking Platform <span style={{ fontSize: '0.75rem', background: '#ffb800', color: '#0f172a', padding: '2px 8px', borderRadius: '6px', verticalAlign: 'middle', fontWeight: 700 }}>KENYA</span>
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, whiteSpace: 'nowrap' }}>Verified Event Spaces & Planners</p>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0 20px', minWidth: '250px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '999px',
            padding: '10px 20px',
            width: '100%',
            maxWidth: '500px',
            color: '#64748b',
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)'
          }}>
            <Search size={18} color="#0F8F7A" />
            <input
              type="text"
              placeholder="Search venues, planners & services..."
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.9rem', color: '#1e293b' }}
            />
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

          {activeRole === 'CUSTOMER' && (
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
              <User size={16} /> My Account
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
          )}

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
