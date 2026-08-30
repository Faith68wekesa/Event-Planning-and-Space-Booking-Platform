import React from 'react';
import type { Venue } from '../types';
import { VenueCard } from './VenueCard';
import { MapPin } from 'lucide-react';

interface VenueGridProps {
  venues: Venue[];
  onSelectVenue: (venue: Venue) => void;
  onBookVenue: (venue: Venue) => void;
}

export const VenueGrid: React.FC<VenueGridProps> = ({ venues, onSelectVenue, onBookVenue }) => {
  if (venues.length === 0) {
    return (
      <div className="card" style={{ padding: '48px', textAlign: 'center', margin: '20px 0' }}>
        <MapPin size={48} color="var(--text-muted)" style={{ marginBottom: '16px', display: 'inline-block' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>No Venues Found</h3>
        <p style={{ color: 'var(--text-muted)' }}>Try adjusting your search filters or selecting a different location.</p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: '24px',
      margin: '24px 0'
    }}>
      {venues.map((venue) => (
        <VenueCard
          key={venue.id}
          venue={venue}
          onSelect={onSelectVenue}
          onBook={onBookVenue}
        />
      ))}
    </div>
  );
};
