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
      background: 'linear-gradient(180deg, rgba(30, 27, 75, 0.6) 0%, rgba(15, 23, 42, 0.4) 100%)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
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
          background: 'rgba(16, 185, 129, 0.15)',
          color: '#34d399',
          border: '1px solid rgba(16, 185, 129, 0.3)',
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
          lineHeight: 1.2,
          marginBottom: '16px',
          letterSpacing: '-0.5px'
        }}>
          Discover & Book <span style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #34d399 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>Verified Event Venues</span> & Experts
        </h2>

        <p style={{
          fontSize: '1.1rem',
          color: 'var(--text-muted)',
          maxWidth: '680px',
          margin: '0 auto 36px auto'
        }}>
          Search trusted gardens, conference centers, caterers, photographers, and planners across Nairobi, Mombasa, Nakuru, and Nyeri with transparent pricing and instant booking requests.
        </p>

        {/* Central Search Bar Box */}
        <div className="glass-card" style={{
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
            <div style={{ background: 'rgba(99, 102, 241, 0.2)', padding: '10px', borderRadius: '12px', color: '#818cf8' }}>
              <ShieldCheck size={20} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{stats.verified_venues} / {stats.total_venues}</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Verified Venues</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '10px', borderRadius: '12px', color: '#34d399' }}>
              <Users size={20} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{stats.verified_vendors}</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Verified Providers</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '10px', borderRadius: '12px', color: '#fbbf24' }}>
              <Award size={20} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{stats.satisfied_clients}+</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Satisfied Clients</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSearch;
