import React from 'react';
import type { UserRole } from '../types';
import { Calendar, ShieldCheck, MapPin, Sparkles, UserCheck, Briefcase } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  bookingCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeRole,
  setActiveRole,
  bookingCount,
}) => {
  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
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
          background: 'linear-gradient(135deg, #6366f1 0%, #10b981 100%)',
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
        }}>
          <Sparkles color="#ffffff" size={24} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            EventP <span style={{ fontSize: '0.8rem', background: '#6366f1', color: '#fff', padding: '2px 8px', borderRadius: '6px', WebkitTextFillColor: 'initial', verticalAlign: 'middle', fontWeight: 700 }}>KENYA</span>
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
              background: '#10b981',
              color: '#fff',
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

        {activeRole === 'VENDOR' && (
          <button
            className={activeTab === 'vendor-dashboard' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActiveTab('vendor-dashboard')}
            style={{ padding: '8px 16px', fontSize: '0.88rem' }}
          >
            <Briefcase size={16} /> Vendor Portal
          </button>
        )}

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

      {/* Role Switcher Pills */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '12px',
        padding: '4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
          <UserCheck size={14} /> Role:
        </div>
        {(['CUSTOMER', 'VENDOR', 'ADMIN'] as UserRole[]).map((r) => (
          <button
            key={r}
            onClick={() => {
              setActiveRole(r);
              if (r === 'VENDOR') setActiveTab('vendor-dashboard');
              if (r === 'ADMIN') setActiveTab('admin-dashboard');
            }}
            style={{
              background: activeRole === r ? 'var(--primary)' : 'transparent',
              color: activeRole === r ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '8px',
              padding: '5px 10px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {r === 'CUSTOMER' ? 'Customer' : r === 'VENDOR' ? 'Vendor' : 'Admin'}
          </button>
        ))}
      </div>
    </nav>
  );
};
