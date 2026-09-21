import React from 'react';
import type { FilterState, PlatformStats } from '../types';

interface HeroSearchProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  stats: PlatformStats;
  onSearch: () => void;
}

export const HeroSearch: React.FC<HeroSearchProps> = () => {
  return (
    <div style={{
      background: '#ffffff',
      padding: '12px 24px',
      textAlign: 'left',
      borderBottom: '1px solid #e2e8f0'
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: '#e6f7f3',
          color: '#0F8F7A',
          padding: '8px 16px',
          borderRadius: '6px',
          border: '1px solid #c9ede4',
          fontSize: '1.1rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Premium Event Spaces Across Kenya
        </div>
      </div>


    </div>
  );
};

export default HeroSearch;
