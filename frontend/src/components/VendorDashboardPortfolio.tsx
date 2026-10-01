import React, { useState } from 'react';
import type { Venue } from '../types';
import { Plus } from 'lucide-react';

interface PortfolioProps {
  venues: Venue[];
  onAddClick: () => void;
}

export const VendorDashboardPortfolio: React.FC<PortfolioProps> = ({ venues, onAddClick }) => {
  const [filter, setFilter] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'DRAFT' | 'CHANGES_REQUIRED'>('ALL');

  const filteredVenues = venues.filter(v => {
    if (filter === 'ALL') return true;
    if (filter === 'APPROVED') return v.verification_status === 'APPROVED';
    if (filter === 'PENDING') return v.verification_status === 'PENDING';
    if (filter === 'CHANGES_REQUIRED') return v.verification_status === 'REJECTED';
    if (filter === 'DRAFT') return v.verification_status === 'DRAFT' || !v.verification_status;
    return true;
  });

  const getStatusDisplay = (venue: Venue) => {
    if (venue.verification_status === 'APPROVED') {
      return <span style={{ color: '#16a34a', fontWeight: 600 }}>🟢 Published</span>;
    }
    if (venue.verification_status === 'PENDING') {
      return <span style={{ color: '#d97706', fontWeight: 600 }}>🟡 Pending Review</span>;
    }
    if (venue.verification_status === 'REJECTED') {
      return <span style={{ color: '#dc2626', fontWeight: 600 }}>🔴 Changes Required</span>;
    }
    return <span style={{ color: '#64748b', fontWeight: 600 }}>⚪ Draft</span>;
  };

  const getCounts = () => {
    const counts = {
      ALL: venues.length,
      APPROVED: venues.filter(v => v.verification_status === 'APPROVED').length,
      PENDING: venues.filter(v => v.verification_status === 'PENDING').length,
      DRAFT: venues.filter(v => v.verification_status === 'DRAFT' || !v.verification_status).length,
      CHANGES_REQUIRED: venues.filter(v => v.verification_status === 'REJECTED').length,
    };
    return counts;
  };
  const counts = getCounts();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>My Services</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Manage your service listings and view their verification status.</p>
        </div>
        <button onClick={onAddClick} style={{ background: '#0d8a73', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Plus size={18} /> Add Service
        </button>
      </div>

      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid #e2e8f0', marginBottom: '24px', overflowX: 'auto' }}>
        {[
          { id: 'ALL', label: 'All' },
          { id: 'APPROVED', label: 'Published' },
          { id: 'PENDING', label: 'Pending Review' },
          { id: 'DRAFT', label: 'Draft' },
          { id: 'CHANGES_REQUIRED', label: 'Changes Required' },
        ].map(f => (
          <button 
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            style={{ 
              padding: '12px 0', 
              border: 'none', 
              background: 'none', 
              color: filter === f.id ? '#0d8a73' : '#64748b', 
              fontWeight: filter === f.id ? 700 : 600, 
              borderBottom: filter === f.id ? '2px solid #0d8a73' : '2px solid transparent', 
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {f.label} ({counts[f.id as keyof typeof counts]})
          </button>
        ))}
      </div>

      <div className="dashboard-card" style={{ overflow: 'hidden' }}>
        <table className="vendor-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '16px', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: '0.85rem', borderBottom: '1px solid #e2e8f0' }}>Service</th>
              <th style={{ textAlign: 'left', padding: '16px', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: '0.85rem', borderBottom: '1px solid #e2e8f0' }}>Price</th>
              <th style={{ textAlign: 'left', padding: '16px', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: '0.85rem', borderBottom: '1px solid #e2e8f0' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '16px', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: '0.85rem', borderBottom: '1px solid #e2e8f0' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredVenues.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <div style={{ color: '#0f172a', fontWeight: 700, fontSize: '1.1rem', marginBottom: '8px' }}>
                    {filter === 'ALL' ? 'No services added yet.' : 'No services found matching this filter.'}
                  </div>
                  {filter === 'ALL' && (
                    <div style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '24px' }}>
                      Add your first service to start appearing in customer searches.
                    </div>
                  )}
                  {filter === 'ALL' && (
                    <button onClick={onAddClick} style={{ background: '#0d8a73', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <Plus size={18} /> Add Service
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filteredVenues.map(venue => (
                <tr key={venue.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px', fontWeight: 600, color: '#0f172a' }}>{venue.title}</td>
                  <td style={{ padding: '16px', color: '#475569', fontWeight: 500 }}>KES {venue.price_per_day.toLocaleString()}</td>
                  <td style={{ padding: '16px' }}>{getStatusDisplay(venue)}</td>
                  <td style={{ padding: '16px' }}>
                    <button style={{ background: '#f1f5f9', color: '#334155', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                      {venue.verification_status === 'DRAFT' || venue.verification_status === 'REJECTED' ? 'Edit' : 'View'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
