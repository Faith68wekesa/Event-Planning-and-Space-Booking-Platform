import React from 'react';
import type { Booking, PlatformStats } from '../types';
import { ArrowUpRight, TrendingUp, Star, MoreHorizontal, Eye } from 'lucide-react';

interface OverviewProps {
  bookings: Booking[];
  stats: PlatformStats;
}

export const VendorDashboardOverview: React.FC<OverviewProps> = ({ bookings }) => {
  // Take top 4 recent bookings
  const recentBookings = bookings.slice(0, 4);
  
  // Calculate revenue from approved bookings
  const revenue = bookings
    .filter(b => b.status === 'APPROVED')
    .reduce((sum, b) => sum + b.total_price, 0);

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      
      {/* Top Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        <div className="dashboard-card stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-card-title">Total Revenue</span>
            <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingUp size={12} /> +12.5%
            </div>
          </div>
          <div className="stat-card-value">KES {revenue.toLocaleString()}</div>
        </div>

        <div className="dashboard-card stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-card-title">Upcoming Bookings</span>
            <div style={{ background: '#f3f4f6', color: '#4b5563', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
              This Month
            </div>
          </div>
          <div className="stat-card-value">{bookings.filter(b => b.status === 'APPROVED').length}</div>
        </div>

        <div className="dashboard-card stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-card-title">Profile Views</span>
            <div style={{ background: '#eff6ff', color: '#2563eb', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingUp size={12} /> +8.2%
            </div>
          </div>
          <div className="stat-card-value">1,402</div>
        </div>

        <div className="dashboard-card stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-card-title">Client Rating</span>
          </div>
          <div className="stat-card-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            4.9 <Star size={24} fill="#fbbf24" color="#fbbf24" />
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Bookings & Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Recent Bookings */}
        <div className="dashboard-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Recent Bookings</h3>
            <button style={{ background: 'none', border: 'none', color: '#0d8a73', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
              View all bookings
            </button>
          </div>
          
          <table className="vendor-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Event Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8' }}>No recent bookings</td>
                </tr>
              )}
              {recentBookings.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.customer_name || 'Guest'}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{b.event_title}</div>
                  </td>
                  <td>{b.event_date}</td>
                  <td>
                    <span className={`status-badge ${b.status.toLowerCase()}`}>
                      {b.status}
                    </span>
                  </td>
                  <td>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Quick Actions & Top Listings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="dashboard-card" style={{ background: '#0f1123', color: '#fff', border: 'none' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', color: '#fff' }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: 'none', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left', fontWeight: 500 }}>
                <span style={{ background: '#8b5cf6', padding: '6px', borderRadius: '6px', display: 'flex' }}>
                  <Eye size={16} />
                </span>
                Review pending requests
              </button>
              <button style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: 'none', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left', fontWeight: 500 }}>
                <span style={{ background: '#3b82f6', padding: '6px', borderRadius: '6px', display: 'flex' }}>
                  <ArrowUpRight size={16} />
                </span>
                Update calendar availability
              </button>
            </div>
          </div>

          <div className="dashboard-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', color: '#0f172a' }}>Top Listings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: '#e2e8f0', overflow: 'hidden' }}>
                  <img src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=200&q=80" alt="listing" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>Karen Oasis Gardens</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>12 Bookings this month</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: '#e2e8f0', overflow: 'hidden' }}>
                  <img src="https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=200&q=80" alt="listing" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>Rift Valley Heights</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>8 Bookings this month</div>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
