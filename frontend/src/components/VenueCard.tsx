import React from 'react';
import type { Venue } from '../types';
import { ShieldCheck, MapPin, Users, Star, ArrowRight, CheckCircle2 } from 'lucide-react';

interface VenueCardProps {
  venue: Venue;
  onSelect: (venue: Venue) => void;
  onBook: (venue: Venue) => void;
}

export const VenueCard: React.FC<VenueCardProps> = ({ venue, onSelect, onBook }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      height: '100%',
      background: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
    }}>
      <div style={{ position: 'relative', height: '220px', overflow: 'hidden' }}>
        <img
          src={venue.image_url}
          alt={venue.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          display: 'flex',
          gap: '8px'
        }}>
          {venue.is_verified ? (
            <span className="badge-verified">
              <ShieldCheck size={14} /> Verified Venue
            </span>
          ) : (
            <span className="badge-unverified">
              Unverified Listing
            </span>
          )}
        </div>

        <div style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          background: '#ffffff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          padding: '4px 10px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '0.85rem',
          fontWeight: 700,
          color: '#fbbf24'
        }}>
          <Star size={14} fill="#fbbf24" /> {venue.rating} ({venue.review_count})
        </div>
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.3 }}>
            {venue.title}
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '14px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={14} color="#0d8a73" /> {venue.location}
          </span>
          <span>•</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Users size={14} color="#059669" /> Up to {venue.capacity} guests
          </span>
        </div>

        <p style={{
          fontSize: '0.88rem',
          color: 'var(--text-muted)',
          lineHeight: 1.5,
          marginBottom: '16px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {venue.description}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
          {venue.amenities.slice(0, 3).map((amt, idx) => (
            <span key={idx} style={{
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              color: '#475569',
              fontSize: '0.75rem',
              padding: '3px 8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <CheckCircle2 size={12} color="#0d8a73" /> {amt}
            </span>
          ))}
          {venue.amenities.length > 3 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
              +{venue.amenities.length - 3} more
            </span>
          )}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Rate / Day</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>
              KES {venue.price_per_day.toLocaleString()}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn-secondary"
              onClick={() => onSelect(venue)}
              style={{ padding: '8px 12px', fontSize: '0.82rem' }}
            >
              Details
            </button>

            <button
              className="btn-primary"
              onClick={() => onBook(venue)}
              style={{ padding: '8px 14px', fontSize: '0.82rem' }}
            >
              Book <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VenueCard;

