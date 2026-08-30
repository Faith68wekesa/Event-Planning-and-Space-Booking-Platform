import React from 'react';
import type { Venue } from '../types';
import { X, ShieldCheck, MapPin, Users, Star, CheckCircle2, ArrowRight } from 'lucide-react';

interface VenueModalProps {
  venue: Venue;
  onClose: () => void;
  onBook: (venue: Venue) => void;
}

export const VenueModal: React.FC<VenueModalProps> = ({ venue, onClose, onBook }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px' }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(0,0,0,0.6)',
            border: 'none',
            color: '#fff',
            borderRadius: '999px',
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }}
        >
          <X size={18} />
        </button>

        <div style={{ height: '300px', borderRadius: '16px', overflow: 'hidden', position: 'relative', marginBottom: '24px' }}>
          <img
            src={venue.image_url}
            alt={venue.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{ position: 'absolute', top: '16px', left: '16px' }}>
            {venue.is_verified ? (
              <span className="badge-verified">
                <ShieldCheck size={16} /> Verified Platform Venue
              </span>
            ) : (
              <span className="badge-unverified">Unverified Listing</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 800, textTransform: 'uppercase' }}>
              {venue.category_display || venue.category}
            </span>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', marginTop: '2px' }}>
              {venue.title}
            </h2>
            <p style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', marginTop: '4px', fontSize: '0.92rem' }}>
              <MapPin size={16} color="#818cf8" /> {venue.address || venue.location}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rental Rate</span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399' }}>
              KES {venue.price_per_day.toLocaleString()} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ day</span>
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '16px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: '130px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Max Capacity</span>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <Users size={16} color="#34d399" /> {venue.capacity} Guests
            </span>
          </div>

          <div style={{ flex: 1, minWidth: '130px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Platform Rating</span>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', color: '#fbbf24' }}>
              <Star size={16} fill="#fbbf24" /> {venue.rating} / 5.0 ({venue.review_count} reviews)
            </span>
          </div>

          <div style={{ flex: 1, minWidth: '130px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Hourly Option</span>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: '2px' }}>
              {venue.price_per_hour ? `KES ${venue.price_per_hour.toLocaleString()} / hr` : 'Full Day Only'}
            </span>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>About this Venue</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{venue.description}</p>
        </div>

        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px' }}>Included Features & Amenities</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {venue.amenities.map((item, idx) => (
              <div key={idx} style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '10px 14px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.9rem'
              }}>
                <CheckCircle2 size={16} color="#10b981" /> {item}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '20px' }}>
          <button className="btn-secondary" onClick={onClose}>
            Back to Search
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              onClose();
              onBook(venue);
            }}
            style={{ padding: '12px 24px', fontSize: '1rem' }}
          >
            Reserve Venue <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
