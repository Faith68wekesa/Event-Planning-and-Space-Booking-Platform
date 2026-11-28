import React from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  UserCheck,
  CalendarCheck,
  Star,
  BarChart3,
  LogOut,
  ShieldCheck,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  User as UserIcon
} from 'lucide-react';
import './admin-sidebar.css';

export type AdminMenuItemId =
  | 'overview'
  | 'users'
  | 'bookings'
  | 'venues'
  | 'verifications'
  | 'reviews'
  | 'analytics'
  | 'settings'
  | 'profile';

export interface AdminSidebarProps {
  activeItem: AdminMenuItemId;
  onSelectItem: (item: AdminMenuItemId) => void;
  onLogout?: () => void;
  isMobileOpen?: boolean;
  onToggleMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
  badgeCounts?: {
    users?: number;
    venues?: number;
    verifications?: number;
  };
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeItem,
  onSelectItem,
  onLogout,
  isMobileOpen = false,
  onToggleMobile,
  isCollapsed = false,
  onToggleCollapsed,
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
      { id: 'bookings', label: 'Bookings', icon: CalendarCheck },
      { id: 'venues', label: 'Provider Listings', icon: Building2, badge: badgeCounts.venues },
      {
        id: 'verifications',
        label: 'Verification Queue',
        icon: UserCheck,
        badge: badgeCounts.verifications,
      },
      { id: 'reviews', label: 'Reviews', icon: Star },
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      { id: 'profile', label: 'My Profile', icon: UserIcon },
    ];

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

      <aside className={`admin-sidebar ${isMobileOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Header / Brand */}
        <div className="admin-sidebar-header">
          <div className="admin-brand-logo" onClick={() => onSelectItem('overview')} title="Admin dashboard home">
            <div className="admin-logo-icon">
              <ShieldCheck size={22} color="#5eead4" />
            </div>
            <div>
              <div className="admin-brand-title">LOCYFY</div>
              <div className="admin-brand-badge">ADMIN PORTAL</div>
            </div>
          </div>

          {onToggleCollapsed && (
            <button
              className="admin-sidebar-collapse-btn"
              onClick={onToggleCollapsed}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          )}

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
                aria-label={item.label}
                title={item.label}
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
      </aside>
    </>
  );
};
