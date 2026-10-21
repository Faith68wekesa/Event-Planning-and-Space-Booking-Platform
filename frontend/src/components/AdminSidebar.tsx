import React from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Building2,
  UserCheck,
  Star,
  BarChart3,
  Settings,
  Globe,
  LogOut,
  ShieldCheck,
  X
} from 'lucide-react';
import type { User } from '../types';
import './admin-sidebar.css';

export type AdminMenuItemId =
  | 'overview'
  | 'users'
  | 'bookings'
  | 'venues'
  | 'verifications'
  | 'reviews'
  | 'analytics'
  | 'settings';

export interface AdminSidebarProps {
  activeItem: AdminMenuItemId;
  onSelectItem: (item: AdminMenuItemId) => void;
  currentUser?: User | null;
  onNavigateHome?: () => void;
  onLogout?: () => void;
  isMobileOpen?: boolean;
  onToggleMobile?: () => void;
  badgeCounts?: {
    users?: number;
    bookings?: number;
    venues?: number;
    verifications?: number;
    reviews?: number;
  };
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeItem,
  onSelectItem,
  currentUser,
  onNavigateHome,
  onLogout,
  isMobileOpen = false,
  onToggleMobile,
  badgeCounts = {},
}) => {
  const menuItems: Array<{
    id: AdminMenuItemId;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    badge?: number;
  }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users, badge: badgeCounts.users },
    { id: 'bookings', label: 'Bookings', icon: Calendar, badge: badgeCounts.bookings },
    { id: 'venues', label: 'Venues & Spaces', icon: Building2, badge: badgeCounts.venues },
    {
      id: 'verifications',
      label: 'Verification Queue',
      icon: UserCheck,
      badge: badgeCounts.verifications,
    },
    { id: 'reviews', label: 'Reviews & Ratings', icon: Star, badge: badgeCounts.reviews },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const adminName = currentUser?.first_name && currentUser?.last_name
    ? `${currentUser.first_name} ${currentUser.last_name}`
    : currentUser?.username || 'Administrator';

  const adminEmail = currentUser?.email || 'admin@locyfy.com';
  const avatarUrl = currentUser?.avatar_url;

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={onToggleMobile}
          aria-hidden="true"
        />
      )}

      <aside className={`admin-sidebar ${isMobileOpen ? 'open' : ''}`}>
        {/* Header / Brand */}
        <div className="admin-sidebar-header">
          <div className="admin-brand-logo" onClick={onNavigateHome} title="Return to Website">
            <div className="admin-logo-icon">
              <ShieldCheck size={22} color="#5eead4" />
            </div>
            <div>
              <div className="admin-brand-title">LOCYFY</div>
              <div className="admin-brand-badge">ADMIN PORTAL</div>
            </div>
          </div>

          {onToggleMobile && (
            <button
              className="admin-sidebar-close-btn"
              onClick={onToggleMobile}
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Main Navigation Menu */}
        <nav className="admin-sidebar-nav">
          <div className="admin-sidebar-section-label">MAIN NAVIGATION</div>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            const hasBadge = Boolean(item.badge && item.badge > 0);

            return (
              <button
                key={item.id}
                className={`admin-sidebar-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectItem(item.id);
                  if (isMobileOpen && onToggleMobile) {
                    onToggleMobile();
                  }
                }}
              >
                <div className="admin-item-content">
                  <Icon size={19} className="admin-item-icon" />
                  <span className="admin-item-label">{item.label}</span>
                </div>
                {hasBadge && (
                  <span className={`admin-item-badge ${item.id === 'verifications' ? 'alert' : ''}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="admin-sidebar-divider" />

          {/* Action Links */}
          <div className="admin-sidebar-section-label">QUICK ACTIONS</div>

          {onNavigateHome && (
            <button
              className="admin-sidebar-item quick-action"
              onClick={() => {
                onNavigateHome();
                if (isMobileOpen && onToggleMobile) {
                  onToggleMobile();
                }
              }}
            >
              <div className="admin-item-content">
                <Globe size={19} className="admin-item-icon" />
                <span className="admin-item-label">Back to Website</span>
              </div>
            </button>
          )}

          {onLogout && (
            <button
              className="admin-sidebar-item logout-action"
              onClick={() => {
                onLogout();
                if (isMobileOpen && onToggleMobile) {
                  onToggleMobile();
                }
              }}
            >
              <div className="admin-item-content">
                <LogOut size={19} className="admin-item-icon" />
                <span className="admin-item-label">Logout</span>
              </div>
            </button>
          )}
        </nav>

        {/* Logged-in Administrator Profile Footer */}
        <div className="admin-sidebar-footer">
          <div className="admin-user-profile">
            <div className="admin-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt={adminName} />
              ) : (
                <div className="admin-avatar-fallback">
                  {adminName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="admin-user-info">
              <span className="admin-user-name" title={adminName}>
                {adminName}
              </span>
              <span className="admin-user-email" title={adminEmail}>
                {adminEmail}
              </span>
            </div>
            <div className="admin-role-pill">ADMIN</div>
          </div>
        </div>
      </aside>
    </>
  );
};
