import React from 'react';
import type { FilterState } from '../types';
import { SlidersHorizontal, ShieldCheck, RotateCcw } from 'lucide-react';

interface FilterSidebarProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  activeTab: 'venues' | 'vendors';
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  filters,
  setFilters,
  activeTab,
}) => {
  const resetFilters = () => {
    setFilters({
      search: '',
      category: 'ALL',
      vendor_type: 'ALL',
      location: 'ALL',
      max_price: 200000,
      min_capacity: 0,
      verified_only: false,
    });
  };

  return (
    <div style={{ 
      padding: '24px', 
      height: 'fit-content',
      background: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SlidersHorizontal size={18} color="#0d8a73" /> Filter Results
        </h3>

        <button
          onClick={resetFilters}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        <div style={{
          background: 'rgba(5, 150, 105, 0.12)',
          border: '1px solid rgba(5, 150, 105, 0.25)',
          borderRadius: '10px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <label htmlFor="verifiedOnly" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} /> Verified Only
          </label>
          <input
            id="verifiedOnly"
            type="checkbox"
            checked={filters.verified_only}
            onChange={(e) => setFilters({ ...filters, verified_only: e.target.checked })}
            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#0d8a73' }}
          />
        </div>

        {activeTab === 'venues' ? (
          <>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Venue Category
              </label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              >
                <option value="ALL">All Categories</option>
                <option value="WEDDING">Wedding Gardens & Halls</option>
                <option value="CONFERENCE">Conference & Corporate</option>
                <option value="OUTDOOR">Outdoor Grounds</option>
                <option value="BIRTHDAY">Birthday & Loft</option>
                <option value="PARTY">Nightlife & Celebration</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Minimum Guest Capacity
              </label>
              <select
                value={filters.min_capacity}
                onChange={(e) => setFilters({ ...filters, min_capacity: Number(e.target.value) })}
              >
                <option value={0}>Any Capacity</option>
                <option value={100}>100+ Guests</option>
                <option value={300}>300+ Guests</option>
                <option value={500}>500+ Guests</option>
                <option value={800}>800+ Guests</option>
              </select>
            </div>
          </>
        ) : (
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              Service Provider Type
            </label>
            <select
              value={filters.vendor_type}
              onChange={(e) => setFilters({ ...filters, vendor_type: e.target.value })}
            >
              <option value="ALL">All Services</option>
              <option value="PLANNER">Event Planners</option>
              <option value="CATERER">Catering Services</option>
              <option value="PHOTOGRAPHER">Photography & Video</option>
              <option value="DECORATOR">Decoration & Styling</option>
              <option value="SOUND_LIGHTING">Sound & Lighting</option>
            </select>
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
            Location / Region
          </label>
          <select
            value={filters.location}
            onChange={(e) => setFilters({ ...filters, location: e.target.value })}
          >
            <option value="ALL">All Regions in Kenya</option>
            <option value="Nairobi">Nairobi</option>
            <option value="Naivasha">Naivasha</option>
            <option value="Mombasa">Mombasa</option>
            <option value="Nakuru">Nakuru</option>
            <option value="Nyeri">Nyeri</option>
          </select>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
            <span style={{ color: '#475569' }}>Max Budget Rate</span>
            <span style={{ color: '#059669' }}>KES {filters.max_price.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min={10000}
            max={200000}
            step={5000}
            value={filters.max_price}
            onChange={(e) => setFilters({ ...filters, max_price: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#0d8a73', cursor: 'pointer' }}
          />
        </div>
      </div>
    </div>
  );
};
