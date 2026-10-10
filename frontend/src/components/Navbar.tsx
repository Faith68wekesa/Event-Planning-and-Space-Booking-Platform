import React, { useState } from 'react';
import type { UserRole } from '../types';
import { ShieldCheck, Briefcase, Building2, Search, User, ChevronDown, LogOut, ArrowRightLeft, Check, X, ChevronRight } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  currentUser?: any;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onRequestRole?: (role: 'CUSTOMER' | 'VENDOR' | 'VENUE_OWNER') => void;
  onLogoutClick?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeRole,
  setActiveRole,
  currentUser,
  onLoginClick,
  onRegisterClick,
  onRequestRole,
  onLogoutClick,
  searchQuery = '',
  onSearchChange,
}) => {
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileTab, setProfileTab] = useState<'personal'|'roles'>('roles');
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
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.9rem', color: '#1e293b' }}
            />
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

          {currentUser ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowAccountMenu(!showAccountMenu)}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.88rem',
                  background: showAccountMenu ? '#0F8F7A' : 'transparent',
                  color: showAccountMenu ? '#ffffff' : '#0F8F7A',
                  border: '1px solid #0F8F7A',
                  borderRadius: '8px',
                  fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '8px',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {currentUser?.avatar_url || currentUser?.profile_picture ? (
                    <img src={currentUser.avatar_url || currentUser.profile_picture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={16} color="#94a3b8" />
                  )}
                </div>
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
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  width: '220px',
                  zIndex: 100,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <button 
                    onClick={() => { setShowAccountMenu(false); setShowProfileModal(true); setProfileTab('roles'); }}
                    style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '0.9rem', color: '#1e293b' }}
                  >
                    <User size={18} color="#0F8F7A" /> My Profile
                  </button>

                  <button 
                    onClick={() => { setShowAccountMenu(false); setShowSwitchModal(true); }}
                    style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '0.9rem', color: '#1e293b' }}
                  >
                    <ArrowRightLeft size={18} color="#0F8F7A" /> Switch Dashboard
                  </button>



                  <div style={{ borderTop: '1px solid #e2e8f0', margin: '4px 0' }}></div>
                  
                  <button 
                    onClick={() => { setShowAccountMenu(false); onLogoutClick?.(); }}
                    style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '0.9rem', color: '#ef4444' }}
                  >
                    <LogOut size={18} /> Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button 
                onClick={() => onLoginClick?.()}
                style={{ padding: '8px 16px', fontWeight: 600, color: '#1e293b', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                Log In
              </button>
              <button 
                onClick={() => onRegisterClick?.()}
                style={{ padding: '8px 20px', fontWeight: 600, color: '#ffffff', background: '#0F8F7A', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 2px 4px rgba(15, 143, 122, 0.2)' }}
              >
                Register
              </button>
            </>
          )}

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

      {/* Switch Dashboard Modal */}
      {showSwitchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative' }}>
            <button onClick={() => setShowSwitchModal(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>Switch Dashboard</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '24px' }}>Select the dashboard you want to access.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={() => { setActiveTab('my-bookings'); setActiveRole('CUSTOMER'); setShowSwitchModal(false); }}
                style={{ width: '100%', textAlign: 'left', padding: '16px', background: '#fff', border: activeRole === 'CUSTOMER' ? '2px solid #0F8F7A' : '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', position: 'relative' }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={20} color="#0F8F7A" /></div>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>Customer Dashboard</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Book services and venues</div>
                </div>
                {activeRole === 'CUSTOMER' && <div style={{ position: 'absolute', right: '16px' }}><div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#0F8F7A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="#fff" /></div></div>}
              </button>

              <button 
                onClick={() => { 
                  if (currentUser?.is_vendor) { 
                    setActiveTab('vendor-dashboard'); setActiveRole('VENDOR'); setShowSwitchModal(false); 
                  } else {
                    onRequestRole?.('VENDOR'); setShowSwitchModal(false);
                  }
                }}
                style={{ width: '100%', textAlign: 'left', padding: '16px', background: '#fff', border: activeRole === 'VENDOR' ? '2px solid #0F8F7A' : '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', position: 'relative' }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Briefcase size={20} color="#9333ea" /></div>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>Vendor Dashboard</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Manage your services and bookings</div>
                </div>
                {currentUser?.is_vendor ? (
                  activeRole === 'VENDOR' && <div style={{ position: 'absolute', right: '16px' }}><div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#0F8F7A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="#fff" /></div></div>
                ) : (
                  <div style={{ position: 'absolute', right: '16px', display: 'flex', alignItems: 'center', gap: '4px', color: '#0F8F7A', fontSize: '0.8rem', fontWeight: 600 }}>
                    Request <ChevronRight size={16} />
                  </div>
                )}
              </button>

              <button 
                onClick={() => { 
                  if (currentUser?.is_venue_owner) { 
                    setActiveTab('venue-owner-dashboard'); setActiveRole('VENUE_OWNER'); setShowSwitchModal(false); 
                  } else {
                    onRequestRole?.('VENUE_OWNER'); setShowSwitchModal(false);
                  }
                }}
                style={{ width: '100%', textAlign: 'left', padding: '16px', background: '#fff', border: activeRole === 'VENUE_OWNER' ? '2px solid #0F8F7A' : '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', position: 'relative' }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Building2 size={20} color="#3b82f6" /></div>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>Venue Dashboard</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Manage your spaces and bookings</div>
                </div>
                {currentUser?.is_venue_owner ? (
                  activeRole === 'VENUE_OWNER' && <div style={{ position: 'absolute', right: '16px' }}><div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#0F8F7A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="#fff" /></div></div>
                ) : (
                  <div style={{ position: 'absolute', right: '16px', display: 'flex', alignItems: 'center', gap: '4px', color: '#0F8F7A', fontSize: '0.8rem', fontWeight: 600 }}>
                    Request <ChevronRight size={16} />
                  </div>
                )}
              </button>
            </div>

            <button onClick={() => setShowSwitchModal(false)} style={{ width: '100%', padding: '12px', marginTop: '16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '500px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative' }}>
            <div style={{ padding: '24px 24px 0' }}>
              <button onClick={() => setShowProfileModal(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>My Profile</h2>
              
              <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #e2e8f0', marginBottom: '24px' }}>
                <button onClick={() => setProfileTab('personal')} style={{ padding: '8px 16px', border: 'none', background: 'none', fontWeight: 600, color: profileTab === 'personal' ? '#0F8F7A' : '#64748b', borderBottom: profileTab === 'personal' ? '2px solid #0F8F7A' : '2px solid transparent', cursor: 'pointer' }}>Personal Info</button>
                <button onClick={() => setProfileTab('roles')} style={{ padding: '8px 16px', border: 'none', background: 'none', fontWeight: 600, color: profileTab === 'roles' ? '#0F8F7A' : '#64748b', borderBottom: profileTab === 'roles' ? '2px solid #0F8F7A' : '2px solid transparent', cursor: 'pointer' }}>Roles & Access</button>
              </div>
            </div>

            <div style={{ padding: '0 24px 24px', maxHeight: '400px', overflowY: 'auto' }}>
              {profileTab === 'roles' && (
                <div>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', margin: '0 0 12px' }}>Current Roles</h3>
                  
                  {currentUser?.is_customer && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#0F8F7A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={20} color="#fff" /></div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>Customer</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>You can book services and venues.</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F8F7A', background: '#f0fdfa', padding: '4px 8px', borderRadius: '4px' }}>Active</div>
                    </div>
                  )}

                  {currentUser?.is_vendor && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Briefcase size={20} color="#fff" /></div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>Vendor</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>You offer event services.</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9333ea', background: '#faf5ff', padding: '4px 8px', borderRadius: '4px' }}>Active</div>
                    </div>
                  )}

                  {currentUser?.is_venue_owner && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Building2 size={20} color="#fff" /></div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>Venue Owner</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>You list event spaces.</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', background: '#eff6ff', padding: '4px 8px', borderRadius: '4px' }}>Active</div>
                    </div>
                  )}

                  {(!currentUser?.is_customer || !currentUser?.is_vendor || !currentUser?.is_venue_owner) && (
                    <>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Request Another Role</h3>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 12px' }}>Want to offer services, list a venue, or book one?</p>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {!currentUser?.is_customer && (
                          <button 
                            onClick={() => { onRequestRole?.('CUSTOMER'); setShowProfileModal(false); }}
                            style={{ width: '100%', textAlign: 'left', padding: '16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={20} color="#0F8F7A" /></div>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>Become a Customer</div>
                            </div>
                            <ChevronRight size={20} color="#94a3b8" />
                          </button>
                        )}
                        {!currentUser?.is_vendor && (
                          <button 
                            onClick={() => { onRequestRole?.('VENDOR'); setShowProfileModal(false); }}
                            style={{ width: '100%', textAlign: 'left', padding: '16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Briefcase size={20} color="#9333ea" /></div>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>Become a Vendor</div>
                            </div>
                            <ChevronRight size={20} color="#94a3b8" />
                          </button>
                        )}
                        
                        {!currentUser?.is_venue_owner && (
                          <button 
                            onClick={() => { onRequestRole?.('VENUE_OWNER'); setShowProfileModal(false); }}
                            style={{ width: '100%', textAlign: 'left', padding: '16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Building2 size={20} color="#3b82f6" /></div>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>Become a Venue Owner</div>
                            </div>
                            <ChevronRight size={20} color="#94a3b8" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {profileTab === 'personal' && (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '16px' }}>
                      {currentUser?.avatar_url || currentUser?.profile_picture ? (
                        <img src={currentUser.avatar_url || currentUser.profile_picture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <User size={40} color="#94a3b8" />
                      )}
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                      {currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}` : (currentUser?.username || 'User')}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
                      Joined recently
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Email Address</div>
                      <div style={{ color: '#0f172a', fontWeight: 600 }}>{currentUser?.email}</div>
                    </div>
                    
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Phone Number</div>
                      <div style={{ color: '#0f172a', fontWeight: 600 }}>{currentUser?.phone_number || 'Not provided'}</div>
                    </div>
                    
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Active Roles</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ padding: '4px 12px', borderRadius: '999px', background: '#dcfce7', color: '#16a34a', fontSize: '0.8rem', fontWeight: 700 }}>Customer</span>
                        {currentUser?.is_vendor && <span style={{ padding: '4px 12px', borderRadius: '999px', background: '#f3e8ff', color: '#9333ea', fontSize: '0.8rem', fontWeight: 700 }}>Vendor</span>}
                        {currentUser?.is_venue_owner && <span style={{ padding: '4px 12px', borderRadius: '999px', background: '#dbeafe', color: '#2563eb', fontSize: '0.8rem', fontWeight: 700 }}>Venue Owner</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </header>
  );
};
