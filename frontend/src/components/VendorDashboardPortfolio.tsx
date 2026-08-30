import React from 'react';
import type { Venue } from '../types';
import { Plus, CheckCircle2, Star, MapPin } from 'lucide-react';

interface PortfolioProps {
  venues: Venue[];
  onAddClick: () => void;
}

export const VendorDashboardPortfolio: React.FC<PortfolioProps> = ({ venues, onAddClick }) => {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>Portfolio & Listings</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Manage your venues, edit details, and view performance.</p>
        </div>
        <button className="btn-primary-light" onClick={onAddClick} style={{ background: '#0d8a73' }}>
          <Plus size={18} /> Add New Venue
        </button>
      </div>

      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <button style={{ padding: '12px 0', border: 'none', background: 'none', color: '#0d8a73', fontWeight: 700, borderBottom: '2px solid #0d8a73', cursor: 'pointer' }}>
          All Listings (5)
        </button>
        <button style={{ padding: '12px 0', border: 'none', background: 'none', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>
          Active (4)
        </button>
        <button style={{ padding: '12px 0', border: 'none', background: 'none', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>
          Drafts (1)
        </button>
        <button style={{ padding: '12px 0', border: 'none', background: 'none', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>
          Archived (0)
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
        {venues.map((venue) => (
          <div key={venue.id} className="dashboard-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'relative', height: '160px', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
              <img src={venue.image_url} alt={venue.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {venue.is_verified && (
                <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(5, 150, 105, 0.9)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} /> Verified
                </div>
              )}
            </div>
            
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 8px 0', lineHeight: 1.3 }}>{venue.title}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '0.85rem', marginBottom: '12px' }}>
              <MapPin size={14} /> {venue.location}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Rate</div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>KES {venue.price_per_day.toLocaleString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fbbf24', fontWeight: 700 }}>
                <Star size={14} fill="#fbbf24" /> {venue.rating}
              </div>
            </div>
          </div>
        ))}

        <div className="dashboard-card" onClick={onAddClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #cbd5e1', cursor: 'pointer', minHeight: '260px', background: '#f8fafc' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#e0f2fe', color: '#0d8a73', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <Plus size={24} />
          </div>
          <div style={{ fontWeight: 600, color: '#334155' }}>Add New Listing</div>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Create a new venue</div>
        </div>

      </div>
    </div>
  );
};
