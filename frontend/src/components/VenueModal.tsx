import React, { useState, useEffect } from 'react';
import type { Venue, Review } from '../types';
import { X, ShieldCheck, MapPin, Users, Star, CheckCircle2, ArrowRight, MessageCircle, Sparkles, UserCheck, Calendar, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { handleImageError, DEFAULT_SPACE_IMAGE } from '../utils/imageUtils';
import { ApiService } from '../services/api';

interface VenueModalProps {
  venue: Venue;
  currentUser?: any;
  onClose: () => void;
  onBook: (venue: Venue) => void;
  onMessage?: (target: { recipientId?: number; name: string; venueId?: number }) => void;
}

export const VenueModal: React.FC<VenueModalProps> = ({ venue, currentUser, onClose, onBook, onMessage }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(true);
  const [showMessageModal, setShowMessageModal] = useState<boolean>(false);
  const [directMessageText, setDirectMessageText] = useState<string>('');
  const [sendingDirectMsg, setSendingDirectMsg] = useState<boolean>(false);

  // Date availability checker state (accessible to anyone, even logged out)
  const [checkDate, setCheckDate] = useState<string>('');
  const [checkingAvailability, setCheckingAvailability] = useState<boolean>(false);
  const [availabilityResult, setAvailabilityResult] = useState<{
    checked: boolean;
    available: boolean;
    message: string;
    statusType: 'AVAILABLE' | 'UNAVAILABLE' | 'BOOKED';
  } | null>(null);

  const handleCheckDateAvailability = async () => {
    if (!checkDate) {
      toast.error('Please select a date to check availability.');
      return;
    }

    setCheckingAvailability(true);

    try {
      // 1. Check vendor-configured custom schedule
      let isExplicitlyBlocked = false;
      try {
        const savedStatuses = localStorage.getItem('locyfy_vendor_day_statuses');
        if (savedStatuses) {
          const parsed: Record<string, string> = JSON.parse(savedStatuses);
          if (parsed[checkDate] === 'UNAVAILABLE') {
            isExplicitlyBlocked = true;
          }
        }
      } catch (e) {
        console.error(e);
      }

      // 2. Check bookings for this venue and calculate remaining guest capacity
      let totalCapacityLimit = venue.capacity || 100;
      try {
        const savedCap = localStorage.getItem('locyfy_provider_capacity');
        if (savedCap) {
          const parsed = JSON.parse(savedCap);
          if (parsed.maxGuests) totalCapacityLimit = Number(parsed.maxGuests);
        }
      } catch (e) {
        console.error(e);
      }

      const bookings = await ApiService.getBookings({ owner: venue.owner });
      const confirmedBookingsOnDate = bookings.filter(b => 
        (b.venue === venue.id || (b.venue_details && b.venue_details.id === venue.id)) &&
        (b.status === 'APPROVED' || b.status === 'COMPLETED') &&
        b.event_date.startsWith(checkDate)
      );

      // Sum all guests already booked on this day
      const bookedGuestsOnDate = confirmedBookingsOnDate.reduce((sum, b) => sum + (Number(b.guest_count) || 0), 0);
      const remainingGuestCapacity = Math.max(0, totalCapacityLimit - bookedGuestsOnDate);
      const isDateFull = remainingGuestCapacity <= 0;

      if (isExplicitlyBlocked) {
        setAvailabilityResult({
          checked: true,
          available: false,
          statusType: 'UNAVAILABLE',
          message: 'This venue is marked as unavailable on this date.'
        });
      } else if (isDateFull) {
        setAvailabilityResult({
          checked: true,
          available: false,
          statusType: 'BOOKED',
          message: `This date has reached full capacity (${totalCapacityLimit} guests accommodated across booked events).`
        });
      } else {
        setAvailabilityResult({
          checked: true,
          available: true,
          statusType: 'AVAILABLE',
          message: bookedGuestsOnDate > 0
            ? `Available! (${remainingGuestCapacity} guest capacity remaining out of ${totalCapacityLimit})`
            : `Great news! Fully available (Up to ${totalCapacityLimit} guests).`
        });
      }
    } catch {
      // Fallback check
      setAvailabilityResult({
        checked: true,
        available: true,
        statusType: 'AVAILABLE',
        message: 'This date appears open for booking!'
      });
    } finally {
      setCheckingAvailability(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchReviews = async () => {
      try {
        setLoadingReviews(true);
        const data = await ApiService.getReviews({ venue: venue.id });
        if (isMounted) {
          setReviews(data);
        }
      } catch (err) {
        console.error('Error fetching venue reviews:', err);
      } finally {
        if (isMounted) setLoadingReviews(false);
      }
    };
    fetchReviews();
    return () => {
      isMounted = false;
    };
  }, [venue.id]);

  const displayRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : (venue.rating > 0 ? venue.rating.toFixed(1) : null);
  const displayCount = reviews.length > 0 ? reviews.length : venue.review_count;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto' }}>
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
            src={venue.image_url || DEFAULT_SPACE_IMAGE}
            onError={(e) => handleImageError(e, DEFAULT_SPACE_IMAGE)}
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
            <span style={{ fontSize: '0.8rem', color: '#0d8a73', fontWeight: 800, textTransform: 'uppercase' }}>
              {venue.category_display || venue.category}
            </span>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
              {venue.title}
            </h2>
            <p style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', marginTop: '4px', fontSize: '0.92rem' }}>
              <MapPin size={16} color="#0d8a73" /> {venue.address || venue.location}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{Number(venue.capacity) === 0 ? 'Service Rate' : 'Rental Rate'}</span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#059669' }}>
              KES {venue.price_per_day.toLocaleString()} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 400 }}>{Number(venue.capacity) === 0 ? '/ event' : '/ day'}</span>
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '16px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: '130px' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>{Number(venue.capacity) === 0 ? 'Offering' : 'Max Capacity'}</span>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              {Number(venue.capacity) === 0 ? (
                <>
                  <Sparkles size={16} color="#059669" /> Service Package
                </>
              ) : (
                <>
                  <Users size={16} color="#059669" /> {venue.capacity} Guests
                </>
              )}
            </span>
          </div>

          <div style={{ flex: 1, minWidth: '130px' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Customer Rating</span>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', color: displayRating ? '#d97706' : '#64748b' }}>
              {displayRating ? (
                <>
                  <Star size={16} fill="#fbbf24" stroke="#d97706" /> {displayRating} / 5.0 ({displayCount} {displayCount === 1 ? 'review' : 'reviews'})
                </>
              ) : (
                <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>No reviews yet</span>
              )}
            </span>
          </div>

          <div style={{ flex: 1, minWidth: '130px' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>{Number(venue.capacity) === 0 ? 'Provider' : 'Hourly Option'}</span>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', marginTop: '2px' }}>
              {Number(venue.capacity) === 0 
                ? (venue.vendor_name || venue.owner_name || 'Verified Provider') 
                : (venue.price_per_hour ? `KES ${venue.price_per_hour.toLocaleString()} / hr` : 'Full Day Only')}
            </span>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>{Number(venue.capacity) === 0 ? 'About this Service' : 'About this Venue'}</h3>
          <p style={{ color: '#475569', lineHeight: 1.6 }}>{venue.description || 'Verified event space equipped with full infrastructure, convenient accessibility, and professional management.'}</p>
        </div>

        {/* Real-time Customer Date Availability Checker (No login required) */}
        <div style={{
          marginBottom: '28px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Calendar size={18} color="#0d8a73" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              Check Date Availability
            </h3>
          </div>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#64748b' }}>
            Select your planned event date to see if this {Number(venue.capacity) === 0 ? 'service' : 'venue'} is open and accepting bookings.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={checkDate}
              onChange={(e) => {
                setCheckDate(e.target.value);
                setAvailabilityResult(null);
              }}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                color: '#0f172a',
                outline: 'none',
                flex: '1',
                minWidth: '200px'
              }}
            />
            <button
              type="button"
              onClick={handleCheckDateAvailability}
              disabled={checkingAvailability}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                background: '#0d8a73',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {checkingAvailability ? 'Checking...' : 'Check Availability'}
            </button>
          </div>

          {availabilityResult && (
            <div style={{
              marginTop: '16px',
              padding: '14px 16px',
              borderRadius: '10px',
              border: `1px solid ${
                availabilityResult.available ? '#a7f3d0' : '#fecaca'
              }`,
              background: availabilityResult.available ? '#ecfdf5' : '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              {availabilityResult.available ? (
                <CheckCircle2 size={20} color="#059669" />
              ) : (
                <AlertCircle size={20} color="#dc2626" />
              )}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: availabilityResult.available ? '#065f46' : '#991b1b'
                }}>
                  {availabilityResult.available ? 'Available on this date!' : 'Unavailable on this date'}
                </div>
                <div style={{
                  fontSize: '0.82rem',
                  color: availabilityResult.available ? '#047857' : '#b91c1c',
                  marginTop: '2px'
                }}>
                  {availabilityResult.message}
                </div>
              </div>
              {availabilityResult.available && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onBook(venue);
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    background: '#059669',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Book Now
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Included Features & Amenities</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {venue.amenities && venue.amenities.length > 0 ? (
              venue.amenities.map((item, idx) => (
                <div key={idx} style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.9rem',
                  color: '#1e293b'
                }}>
                  <CheckCircle2 size={16} color="#0d8a73" /> {item}
                </div>
              ))
            ) : (
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Standard event amenities included.</p>
            )}
          </div>
        </div>

        {/* Customer Reviews Section */}
        <div style={{ marginBottom: '28px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Customer Reviews {displayRating && <span style={{ fontSize: '0.9rem', color: '#d97706', fontWeight: 700 }}>★ {displayRating} ({displayCount})</span>}
            </h3>
          </div>

          {loadingReviews ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
              Loading verified reviews...
            </div>
          ) : reviews.length === 0 ? (
            <div style={{
              background: '#f8fafc',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
              color: '#64748b',
              border: '1px dashed #cbd5e1'
            }}>
              <Star size={24} color="#94a3b8" style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
              <p style={{ margin: 0, fontWeight: 600, color: '#334155' }}>No reviews yet</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                Reviews are submitted by verified customers after completing a booking.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{rev.user_name || 'Verified Customer'}</span>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.72rem',
                          background: '#ecfdf5',
                          color: '#059669',
                          border: '1px solid #a7f3d0',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontWeight: 700
                        }}>
                          <UserCheck size={12} /> Verified Booking
                        </span>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {new Date(rev.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '2px' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={15}
                          fill={star <= rev.rating ? '#fbbf24' : 'transparent'}
                          stroke={star <= rev.rating ? '#d97706' : '#cbd5e1'}
                        />
                      ))}
                    </div>
                  </div>

                  {rev.comment ? (
                    <p style={{ margin: 0, fontSize: '0.92rem', color: '#334155', lineHeight: 1.5, fontWeight: 500 }}>
                      "{rev.comment}"
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
                      No written comment provided.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
          <button className="btn-secondary" onClick={onClose}>
            Back to Search
          </button>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn-secondary"
              onClick={() => {
                if (!currentUser) {
                  toast.error('Please sign in to message this host.');
                  return;
                }
                setShowMessageModal(true);
              }}
              style={{ padding: '10px 20px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <MessageCircle size={18} /> Message Owner
            </button>
            {venue.approval_status === 'APPROVED' && venue.is_available ? (
              <button
                className="btn-primary"
                onClick={() => {
                  onClose();
                  onBook(venue);
                }}
                style={{ padding: '10px 22px', fontSize: '0.95rem' }}
              >
                Send Booking Request <ArrowRight size={18} />
              </button>
            ) : (
              <button
                disabled
                style={{
                  padding: '10px 22px',
                  fontSize: '0.95rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#e2e8f0',
                  color: '#94a3b8',
                  fontWeight: 700,
                  cursor: 'not-allowed'
                }}
              >
                {venue.approval_status !== 'APPROVED' ? 'Listing Pending Verification' : 'Currently Unavailable'}
              </button>
            )}
          </div>
        </div>

        {/* Direct Message Composer Modal */}
        {showMessageModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1100,
              padding: '20px',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                color: '#0f172a',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '480px',
                padding: '24px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                  Message {venue.owner_name || 'Host'}
                </h3>
                <button
                  onClick={() => setShowMessageModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={20} />
                </button>
              </div>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.88rem', color: '#64748b' }}>
                Inquiring about <strong>{venue.title}</strong>. Your message will be saved and delivered directly to the venue manager.
              </p>
              <textarea
                rows={4}
                placeholder="Ask about dates, catering options, layout, or customized packages..."
                value={directMessageText}
                onChange={(e) => setDirectMessageText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  marginBottom: '16px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowMessageModal(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#334155',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={sendingDirectMsg || !directMessageText.trim()}
                  onClick={async () => {
                    if (!directMessageText.trim() || !currentUser?.id) return;
                    setSendingDirectMsg(true);
                    try {
                      const res = await ApiService.sendMessage({
                        sender: currentUser.id,
                        recipient: venue.owner_user_id || undefined,
                        venue: venue.id,
                        content: directMessageText.trim(),
                      });
                      if (res) {
                        toast.success(`Message sent to ${venue.owner_name || 'Host'}!`);
                        setDirectMessageText('');
                        setShowMessageModal(false);
                        if (onMessage) {
                          onMessage({ recipientId: venue.owner_user_id, name: venue.owner_name || 'Host', venueId: venue.id });
                        }
                      } else {
                        toast.error('Failed to send message.');
                      }
                    } catch (e) {
                      toast.error('Error sending message.');
                    } finally {
                      setSendingDirectMsg(false);
                    }
                  }}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0d8a73',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    opacity: sendingDirectMsg || !directMessageText.trim() ? 0.7 : 1,
                  }}
                >
                  {sendingDirectMsg ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
