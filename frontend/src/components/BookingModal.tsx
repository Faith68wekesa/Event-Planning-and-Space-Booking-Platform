import React, { useState } from 'react';
import type { Venue, Vendor, Booking } from '../types';
import { ApiService } from '../services/api';
import { X, ShieldCheck } from 'lucide-react';

interface BookingModalProps {
  venue?: Venue | null;
  vendor?: Vendor | null;
  onClose: () => void;
  onSuccess: (newBooking: Booking) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  venue,
  vendor,
  onClose,
  onSuccess,
}) => {
  const defaultPrice = venue ? venue.price_per_day : (vendor ? vendor.starting_price : 50000);
  const targetTitle = venue ? venue.title : (vendor ? vendor.business_name : 'Event Service');

  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState('Wedding Reception');
  const [eventDate, setEventDate] = useState(new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0]);
  const [guestCount, setGuestCount] = useState<number>(venue ? Math.min(100, venue.capacity) : 100);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const created = await ApiService.createBooking({
        venue: venue?.id,
        vendor: vendor?.id,
        venue_details: venue || undefined,
        vendor_details: vendor || undefined,
        event_title: eventTitle || `Event at ${targetTitle}`,
        event_type: eventType,
        event_date: eventDate,
        guest_count: Number(guestCount),
        total_price: Number(defaultPrice),
        notes: notes,
      });

      onSuccess(created);
      onClose();
    } catch {
      alert('Error creating booking request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase' }}>
              Booking Request Form
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginTop: '2px' }}>
              Reserve: {targetTitle}
            </h2>
          </div>

          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={22} />
          </button>
        </div>

        <div style={{
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
              <ShieldCheck size={16} color="#34d399" /> Verified Provider Guarantee
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              No immediate charges. Venue/Vendor will review your date and confirm request.
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Base Price</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399' }}>
              KES {defaultPrice.toLocaleString()}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Event Title / Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Maina's 30th Birthday Bash or Annual Tech Gala"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Event Category / Type
              </label>
              <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
                <option value="Wedding Reception">Wedding Reception</option>
                <option value="Corporate Conference">Corporate Conference</option>
                <option value="Birthday Party">Birthday Party</option>
                <option value="Cocktail Gala">Cocktail Gala</option>
                <option value="Outdoor Festival">Outdoor Festival / Concert</option>
                <option value="Private Dinner">Private Dinner</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Event Date
              </label>
              <input
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Expected Guest Count
            </label>
            <input
              type="number"
              min={1}
              max={venue ? venue.capacity : 2000}
              value={guestCount}
              onChange={(e) => setGuestCount(Number(e.target.value))}
            />
            {venue && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Venue max capacity: {venue.capacity} guests
              </span>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Special Setup Requirements / Notes
            </label>
            <textarea
              rows={3}
              placeholder="Specify setup time, dietary preferences, extra equipment needed, or custom requests..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Booking Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
