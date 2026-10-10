import React, { useState } from 'react';
import type { Venue } from '../types';
import { Plus, CheckCircle, MapPin, Star, MoreHorizontal } from 'lucide-react';

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
      return <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Published</span>;
    }
    if (venue.verification_status === 'PENDING') {
      return <span style={{ color: '#d97706', fontWeight: 600 }}>⏳ Pending</span>;
    }
    if (venue.verification_status === 'REJECTED') {
      return <span style={{ color: '#dc2626', fontWeight: 600 }}>❌ Changes Required</span>;
    }
    return <span style={{ color: '#64748b', fontWeight: 600 }}>⚪ Draft</span>;
  };

  const getCounts = () => {
    return {
      ALL: venues.length,
      APPROVED: venues.filter(v => v.verification_status === 'APPROVED').length,
      PENDING: venues.filter(v => v.verification_status === 'PENDING').length,
      DRAFT: venues.filter(v => v.verification_status === 'DRAFT' || !v.verification_status).length,
      CHANGES_REQUIRED: venues.filter(v => v.verification_status === 'REJECTED').length,
    };
  };
  const counts = getCounts();

  return (
    <div>
      {/* My Services Section */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
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

      {filteredVenues.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '60px 20px', textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ color: '#0f172a', fontWeight: 700, fontSize: '1.2rem', marginBottom: '8px' }}>
            {filter === 'ALL' ? 'No services added yet' : 'No services found matching this filter.'}
          </div>
          {filter === 'ALL' && (
            <>
              <div style={{ color: '#64748b', fontSize: '1rem', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
                Add your first service to start appearing in customer searches and receiving bookings.
              </div>
              <button onClick={onAddClick} style={{ background: '#0d8a73', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '24px' }}>
                <Plus size={18} /> Add Service
              </button>
              <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                You can offer services such as: Catering · Photography · Decoration · Entertainment · Event Planning
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px', marginBottom: '48px' }}>
          {filteredVenues.map(venue => (
            <div key={venue.id} style={{ background: '#ffffff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: '180px', background: `url(${venue.image_url || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=600&q=80'}) center/cover` }}></div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                
                {venue.verification_status === 'APPROVED' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>
                    <CheckCircle size={14} /> Verified
                  </div>
                )}
                
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>{venue.title}</h3>
                <div style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '16px' }}>{venue.category_display || venue.category}</div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '0.9rem' }}>
                    <MapPin size={16} /> {venue.location}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>KES {venue.price_per_day.toLocaleString()}</span> / event
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '0.9rem', fontWeight: 600 }}>
                    <Star size={16} fill="#f59e0b" /> {venue.rating || '4.8'}
                  </div>
                </div>

                <div style={{ marginTop: 'auto', borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '0.85rem' }}>
                    {getStatusDisplay(venue)}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{ background: '#f1f5f9', color: '#334155', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>View</button>
                    <button style={{ background: '#f1f5f9', color: '#334155', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>Edit</button>
                    <button style={{ background: '#f1f5f9', color: '#64748b', border: 'none', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
