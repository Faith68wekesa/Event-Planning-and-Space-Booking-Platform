import React from 'react';
import type { FilterState, PlatformStats } from '../types';
import { Search, MapPin, Tag, ShieldCheck, Users, Award } from 'lucide-react';

interface HeroSearchProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  stats: PlatformStats;
  onSearch: () => void;
}

export const HeroSearch: React.FC<HeroSearchProps> = ({
  filters,
  setFilters,
  stats,
  onSearch,
}) => {
  return (
    <div style={{
      background: 'linear-gradient(180deg, #f0fdfa 0%, #ffffff 100%)',
      borderBottom: '1px solid #e2e8f0',
      padding: '48px 24px',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(5, 150, 105, 0.1)',
          color: '#059669',
          border: '1px solid rgba(5, 150, 105, 0.2)',
          padding: '6px 16px',
          borderRadius: '999px',
          fontSize: '0.85rem',
          fontWeight: 700,
          marginBottom: '20px'
        }}>
          <ShieldCheck size={16} /> 100% Verified Event Spaces & Service Providers in Kenya
        </div>

        <h2 style={{
          fontSize: '2.75rem',
          fontWeight: 800,
          color: '#1e293b',
          lineHeight: 1.2,
          marginBottom: '16px',
          letterSpacing: '-0.5px'
        }}>
          Discover & Book <span style={{
            background: 'linear-gradient(135deg, #0d8a73 0%, #065f54 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>Verified Event Venues</span> & Experts
        </h2>

        <p style={{
          fontSize: '1.1rem',
          color: '#64748b',
          maxWidth: '680px',
          margin: '0 auto 36px auto'
        }}>
          Search trusted gardens, conference centers, caterers, photographers, and planners across Nairobi, Mombasa, Nakuru, and Nyeri with transparent pricing and instant booking requests.
        </p>

        {/* Central Search Bar Box */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0',
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          alignItems: 'center',
          maxWidth: '960px',
          margin: '0 auto'
        }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search venue or planner..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              style={{ paddingLeft: '38px' }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <MapPin size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            <select
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              style={{ paddingLeft: '38px' }}
            >
              <option value="ALL">All Locations</option>
              <option value="Nairobi">Nairobi</option>
              <option value="Naivasha">Naivasha</option>
              <option value="Mombasa">Mombasa</option>
              <option value="Nakuru">Nakuru</option>
              <option value="Nyeri">Nyeri</option>
            </select>
          </div>

          <div style={{ position: 'relative' }}>
            <Tag size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              style={{ paddingLeft: '38px' }}
            >
              <option value="ALL">All Venue Types</option>
              <option value="WEDDING">Wedding Gardens</option>
              <option value="CONFERENCE">Conference Centers</option>
              <option value="OUTDOOR">Outdoor Grounds</option>
              <option value="BIRTHDAY">Birthday & Loft</option>
              <option value="PARTY">Celebration Spaces</option>
            </select>
          </div>

          <button
            className="btn-primary"
            onClick={onSearch}
            style={{ height: '42px', justifyContent: 'center', fontSize: '1rem' }}
          >
            <Search size={18} /> Search Platform
          </button>
        </div>

        {/* Metrics Badges */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '32px',
          marginTop: '36px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(13, 138, 115, 0.1)', padding: '10px', borderRadius: '12px', color: '#0d8a73' }}>
              <ShieldCheck size={20} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{stats.verified_venues} / {stats.total_venues}</h4>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Verified Venues</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(5, 150, 105, 0.1)', padding: '10px', borderRadius: '12px', color: '#059669' }}>
              <Users size={20} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{stats.verified_vendors}</h4>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Verified Providers</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(251, 191, 36, 0.1)', padding: '10px', borderRadius: '12px', color: '#d97706' }}>
              <Award size={20} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{stats.satisfied_clients}+</h4>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Satisfied Clients</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSearch;
