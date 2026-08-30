import React, { useState } from 'react';
import type { Booking, BookingStatus } from '../types';
import { Search, Filter, MessageSquare, Check, X } from 'lucide-react';

interface BookingsProps {
  bookings: Booking[];
  onUpdateStatus: (id: number, status: BookingStatus) => void;
}

export const VendorDashboardBookings: React.FC<BookingsProps> = ({ bookings, onUpdateStatus }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBookings = bookings.filter(b => 
    b.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.event_title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
      
      {/* Main Bookings Area */}
      <div className="dashboard-card" style={{ padding: '0' }}>
        
        {/* Filters Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flexGrow: 1, position: 'relative' }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search bookings or customers..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 10px 10px 38px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#0f172a' }}
            />
          </div>
          <button className="btn-secondary-light">
            <Filter size={16} /> Filters
          </button>
        </div>

        {/* Table */}
        <table className="vendor-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Details</th>
              <th>Status</th>
              <th>Date / Time</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '48px' }}>No bookings match your search.</td>
              </tr>
            )}
            {filteredBookings.map((b) => (
              <tr key={b.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 600 }}>
                      {b.customer_name ? b.customer_name.charAt(0) : 'G'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.customer_name || 'Guest User'}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{b.guest_count} guests</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: 500, color: '#334155' }}>{b.event_title}</div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {b.notes || 'No extra notes provided.'}
                  </div>
                </td>
                <td>
                  <span className={`status-badge ${b.status.toLowerCase()}`}>
                    {b.status}
                  </span>
                </td>
                <td>
                  <div style={{ fontWeight: 500, color: '#334155' }}>{b.event_date}</div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Full Day</div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {b.status === 'PENDING' ? (
                      <>
                        <button onClick={() => onUpdateStatus(b.id, 'APPROVED')} title="Accept" style={{ background: '#dcfce7', color: '#166534', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>
                          <Check size={16} />
                        </button>
                        <button onClick={() => onUpdateStatus(b.id, 'REJECTED')} title="Reject" style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <button className="btn-secondary-light" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                        <MessageSquare size={14} /> Chat
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

      </div>

      {/* Right Sidebar Widgets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Simple Calendar Widget */}
        <div className="dashboard-card" style={{ background: '#0f1123', color: '#fff', border: 'none' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', color: '#fff' }}>Upcoming Dates</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px 0', borderRadius: '8px' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>12</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>OCT</div>
            </div>
            <div style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '12px 0', borderRadius: '8px', border: '1px solid #8b5cf6' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#a78bfa' }}>14</div>
              <div style={{ fontSize: '0.75rem', color: '#a78bfa' }}>OCT</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px 0', borderRadius: '8px' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>18</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>OCT</div>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '16px', textAlign: 'center' }}>You have 2 events this week.</p>
        </div>

        <div className="dashboard-card" style={{ background: 'linear-gradient(135deg, #0d8a73, #065f54)', color: '#fff', border: 'none' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 12px 0', color: '#fff' }}>Great Suggestions!</h3>
          <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
            Turn on Auto-Approve for trusted returning clients to increase your booking speed.
          </p>
          <button style={{ width: '100%', background: '#fff', color: '#0d8a73', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
            Enable Auto-Approve
          </button>
        </div>

      </div>

    </div>
  );
};
