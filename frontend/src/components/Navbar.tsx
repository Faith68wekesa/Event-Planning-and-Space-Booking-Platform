import React, { useState } from 'react';
import type { UserRole } from '../types';
import { ShieldCheck, Sparkles, Briefcase, Building2, Search, User, ChevronDown, Lock, ClipboardList } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeRole: UserRole;
  bookingCount: number;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeRole,
  bookingCount,
  onLoginClick,
  onRegisterClick,
}) => {
  const [showAccountMenu, setShowAccountMenu] = useState(false);
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
              Event Planning and SpaceBooking
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
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowAccountMenu(!showAccountMenu)}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.88rem',
                  background: activeTab === 'my-bookings' || showAccountMenu ? '#0F8F7A' : 'transparent',
                  color: activeTab === 'my-bookings' || showAccountMenu ? '#ffffff' : '#0F8F7A',
                  border: '1px solid #0F8F7A',
                  borderRadius: '8px',
                  fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '8px',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <div style={{
                  background: '#ffb800',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#000'
                }}>
                  <Lock size={12} />
                </div>
                Account
                <ChevronDown size={16} />
              </button>
              
              {showAccountMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  width: '180px',
                  zIndex: 100,
                  overflow: 'hidden'
                }}>
                  <button 
                    onClick={() => { setShowAccountMenu(false); onLoginClick?.(); }}
                    style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: '#1e293b' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <Lock size={16} /> Login
                  </button>
                  <button 
                    onClick={() => { setShowAccountMenu(false); onRegisterClick?.(); }}
                    style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: '#1e293b' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <ClipboardList size={16} /> Register
                  </button>
                </div>
              )}
            </div>
          )}

          {activeRole === 'VENUE_OWNER' ? (
            <button
              className={activeTab === 'venue-owner-dashboard' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveTab('venue-owner-dashboard')}
              style={{ padding: '8px 16px', fontSize: '0.88rem', background: '#0F8F7A', color: '#fff', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              <Building2 size={16} /> Venue Owner Dashboard
            </button>
          ) : activeRole === 'VENDOR' ? (
            <button
              className={activeTab === 'vendor-dashboard' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveTab('vendor-dashboard')}
              style={{ padding: '8px 16px', fontSize: '0.88rem', background: '#0F8F7A', color: '#fff', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              <Briefcase size={16} /> Vendor Dashboard
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
