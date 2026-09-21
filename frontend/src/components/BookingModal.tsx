import React, { useState } from 'react';
import type { Venue, Vendor, Booking, User } from '../types';
import { ApiService } from '../services/api';
import { X, ShieldCheck, MapPin, Star, Users } from 'lucide-react';
import toast from 'react-hot-toast';

interface BookingModalProps {
  venue?: Venue | null;
  vendor?: Vendor | null;
  currentCustomer: User;
  onClose: () => void;
  onSuccess: (newBooking: Booking) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  venue,
  vendor,
  currentCustomer,
  onClose,
  onSuccess,
}) => {
  const defaultPrice = venue ? venue.price_per_day : (vendor ? vendor.starting_price : 0);
  const targetTitle = venue ? venue.title : (vendor ? vendor.business_name : 'Event Service');
  const targetLocation = venue ? venue.location : 'Nairobi Central';
  const targetRating = venue ? venue.rating : (vendor ? vendor.rating : 4.9);
  const targetReviews = venue ? venue.review_count : 52;
  const imageUrl = venue?.image_url || vendor?.logo_url || vendor?.portfolio_images?.[0] || 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&q=80&w=300&h=200';

  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState('Birthday Party');
  const [eventDate, setEventDate] = useState('');
  const [guestCount, setGuestCount] = useState<string>('');
  const [startTime, setStartTime] = useState('15:00');
  const [endTime, setEndTime] = useState('22:00');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pre-filled contact info (readonly or editable? We'll make it editable just in case, but initialized from currentCustomer)
  const [contactName, setContactName] = useState(currentCustomer.username || '');
  const [contactEmail, setContactEmail] = useState(currentCustomer.email || '');
  const [contactPhone, setContactPhone] = useState(currentCustomer.phone_number || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const selectedDate = new Date(eventDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      toast.error('Event date cannot be in the past. Please select a future date.');
      setSubmitting(false);
      return;
    }

    const titleLower = eventTitle.toLowerCase();
    if (titleLower.includes('birthday') && eventType !== 'Birthday Party' && eventType !== 'Other') {
      toast.error('You mentioned "birthday" in the event name, but selected a different event type. Please correct it or choose "Other".');
      setSubmitting(false);
      return;
    }

    if (titleLower.includes('wedding') && eventType !== 'Wedding Reception' && eventType !== 'Other') {
      toast.error('You mentioned "wedding" in the event name, but selected a different event type. Please correct it or choose "Other".');
      setSubmitting(false);
      return;
    }

    try {
      const combinedNotes = `Start Time: ${startTime}\nEnd Time: ${endTime}\n\n${notes}`;

      const created = await ApiService.createBooking({
        customer: currentCustomer.id,
        venue: venue?.id,
        vendor: vendor?.id,
        venue_details: venue || undefined,
        vendor_details: vendor || undefined,
        event_title: eventTitle || `Event for ${contactName}`,
        event_type: eventType,
        event_date: eventDate,
        guest_count: Number(guestCount) || 0,
        total_price: Number(defaultPrice),
        notes: combinedNotes,
      });

      toast.success('Booking request sent successfully!');
      onSuccess(created);
      onClose();
    } catch {
      toast.error('Error creating booking request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const labelStyle = { display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '6px' };
  const inputStyle = { width: '100%', boxSizing: 'border-box' as const, padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', color: '#334155' };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px',
      overflowY: 'auto'
    }} onClick={onClose}>

      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '650px',
        margin: 'auto',
        position: 'relative',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column'
      }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '24px 32px', textAlign: 'center', position: 'relative' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Request to Book This {venue ? 'Venue' : 'Service Provider'}
          </h2>
          <p style={{ color: '#475569', fontSize: '0.9rem', margin: '4px 0 0' }}>
            Provide details about your event to the {venue ? 'venue' : 'service provider'}.
          </p>
          <button
            onClick={onClose}
            style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
          >
            <X size={24} />
          </button>
        </div>

        <div style={{ padding: '0 32px 32px', overflowY: 'visible' }}>

          {/* Target Card */}
          <div style={{
            display: 'flex',
            gap: '16px',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px',
            marginBottom: '16px',
            background: '#fff'
          }}>
            <img
              src={imageUrl}
              alt={targetTitle}
              style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '8px' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>{targetTitle}</h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', color: '#475569' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={14} /> {targetLocation}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Star size={14} color="#f59e0b" fill="#f59e0b" /> {targetRating} ({targetReviews} reviews)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: '#475569' }}>
                <Users size={14} /> Minimum {venue ? Math.min(20, venue.capacity) : 20} guests
              </div>

              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem', marginTop: '2px' }}>
                Price: From KSh {defaultPrice.toLocaleString()} {venue ? 'per day' : 'per guest'}
              </div>
            </div>
          </div>

          {/* Guarantee Box */}
          <div style={{
            background: '#e6f7f3',
            border: '1px solid rgba(15, 143, 122, 0.3)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '28px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#0F8F7A', marginBottom: '8px' }}>
              <ShieldCheck size={18} /> Verified Provider Guarantee
            </div>
            <p style={{ fontSize: '0.85rem', color: '#14213D', margin: '0 0 12px 0', lineHeight: 1.5 }}>
              Your request is sent securely. No payment is required at this stage. The {venue ? 'venue' : 'service provider'} will review your request and confirm availability before any payment is discussed.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Event Details Section */}
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 16px 0' }}>Event Details</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Event Name</label>
                <input type="text" required placeholder="Mary's Birthday" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Event Date</label>
                <input
                  type="date"
                  required
                  value={eventDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setEventDate(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Event Type</label>
                <select value={eventType} onChange={(e) => setEventType(e.target.value)} style={{ ...inputStyle, padding: '9px 12px', background: '#fff' }}>
                  <option value="Birthday Party">Birthday Party</option>
                  <option value="Wedding Reception">Wedding Reception</option>
                  <option value="Corporate Event">Corporate Event</option>
                  <option value="Private Dinner">Private Dinner</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Expected Guests</label>
                <input type="number" required min={1} placeholder="150" value={guestCount} onChange={(e) => setGuestCount(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Start Time</label>
                <input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>End Time</label>
                <input type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <label style={labelStyle}>Special Setup Requirements</label>
              <textarea
                rows={4}
                required
                placeholder="Tell the service provider about dietary restrictions, cuisine preferences, special setup requirements (e.g., specific serving style, equipment needs, decoration restrictions), etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {/* Contact Info Section */}
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 16px 0' }}>Your Contact Information</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '32px' }}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input type="text" required value={contactName} onChange={(e) => setContactName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" required value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input type="tel" required value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} style={inputStyle} />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', alignItems: 'center', marginTop: '32px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '12px 32px', borderRadius: '8px', border: '1px solid #0d8a73', background: 'transparent', color: '#0d8a73', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{ padding: '12px 32px', borderRadius: '8px', border: 'none', background: '#0d8a73', color: '#ffffff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? 'Sending...' : 'Send Booking Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
