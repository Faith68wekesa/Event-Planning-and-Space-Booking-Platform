import React, { useState, useEffect } from 'react';
import type { Venue, Review } from '../types';
import { X, ShieldCheck, MapPin, Users, Star, CheckCircle2, ArrowRight, MessageCircle, Sparkles, UserCheck, Calendar, AlertCircle, ImageOff, ChevronLeft, ChevronRight, Images } from 'lucide-react';
import toast from 'react-hot-toast';
import { cleanImageUrl } from '../utils/imageUtils';
import { ApiService } from '../services/api';

interface VenueModalProps {
  venue: Venue;
  currentUser?: any;
  onClose: () => void;
  onBook: (venue: Venue) => void;
  onMessage?: (target: { recipientId?: number; name: string; venueId?: number }) => void;
}

const LEGACY_SERVICE_CATEGORIES = new Set(['PHOTOGRAPHY', 'CATERING', 'DECORATION', 'ENTERTAINMENT', 'PLANNING', 'SOUND']);

const isServiceListing = (venue: Venue): boolean => {
  if (venue.listing_type) return venue.listing_type === 'SERVICE';
  return Boolean(venue.vendor || venue.vendor_name || Number(venue.capacity) === 0 || LEGACY_SERVICE_CATEGORIES.has(venue.category));
};

export const VenueModal: React.FC<VenueModalProps> = ({ venue, currentUser, onClose, onBook, onMessage }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(true);
  const [showMessageModal, setShowMessageModal] = useState<boolean>(false);
  const [directMessageText, setDirectMessageText] = useState<string>('');
  const [sendingDirectMsg, setSendingDirectMsg] = useState<boolean>(false);
  const [portfolioGalleryIndex, setPortfolioGalleryIndex] = useState<number | null>(null);
  const portfolioImages = (venue.portfolio || [])
    .map(image => ({ ...image, safeUrl: cleanImageUrl(image.image_url) }))
    .filter(image => Boolean(image.safeUrl));
  const visiblePortfolioImages = portfolioImages.slice(0, 5);
  const hasGuestCapacity = Number(venue.capacity) > 0;

  useEffect(() => {
    if (portfolioGalleryIndex === null) return;
    const handleGalleryKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPortfolioGalleryIndex(null);
      if (event.key === 'ArrowRight') {
        setPortfolioGalleryIndex(index => index === null ? null : (index + 1) % portfolioImages.length);
      }
      if (event.key === 'ArrowLeft') {
        setPortfolioGalleryIndex(index => index === null ? null : (index + portfolioImages.length - 1) % portfolioImages.length);
      }
    };
    window.addEventListener('keydown', handleGalleryKeys);
    return () => window.removeEventListener('keydown', handleGalleryKeys);
  }, [portfolioGalleryIndex, portfolioImages.length]);

  useEffect(() => {
    if (venue?.id) {
      ApiService.trackInteraction({
        event_type: 'LISTING_VIEW',
        listing_type: 'VENUE',
        venue: venue.id,
        category: venue.category,
        location_filter: venue.location,
        source: 'venue_modal',
        user: currentUser?.id,
      });
    }
  }, [venue?.id, currentUser?.id]);

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
    if (!hasGuestCapacity) {
      setAvailabilityResult({
        checked: true,
        available: false,
        statusType: 'UNAVAILABLE',
        message: 'The provider has not set a maximum guest capacity for this listing yet.'
      });
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
      const totalCapacityLimit = Number(venue.capacity);

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
    : Number(venue.rating || 0).toFixed(1);
  const displayCount = reviews.length > 0 ? reviews.length : Number(venue.review_count || 0);
  const isService = isServiceListing(venue);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content listing-detail-modal" onClick={(e) => e.stopPropagation()}>
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

        <div className="listing-detail-body">
          <div style={{
            height: '180px',
            borderRadius: '16px',
            overflow: 'hidden',
            position: 'relative',
            marginBottom: '12px',
            background: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {cleanImageUrl(venue.image_url) ? (
              <img
                src={cleanImageUrl(venue.image_url)}
                alt={venue.title}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                color: '#94a3b8'
              }}>
                <ImageOff size={36} />
                <span style={{ fontSize: '0.85rem' }}>No image available</span>
              </div>
            )}
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

          <div className="listing-detail-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
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

            <div className="listing-detail-price" style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{isService ? 'Service Rate' : 'Rental Rate'}</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#059669' }}>
                KES {venue.price_per_day.toLocaleString()} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 400 }}>{isService ? '/ event' : '/ day'}</span>
              </div>
            </div>
          </div>

          <div className="listing-detail-facts" style={{
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
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Maximum Guests</span>
              <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <Users size={16} color={hasGuestCapacity ? '#059669' : '#b45309'} />
                {hasGuestCapacity ? `${venue.capacity} guests` : 'Not provided'}
              </span>
            </div>

            <div style={{ flex: 1, minWidth: '130px' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Customer Rating</span>
              <span style={{ fontWeight: 700, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', color: displayCount > 0 ? '#d97706' : '#64748b' }}>
                <Star size={16} fill="#fbbf24" stroke={displayCount > 0 ? '#d97706' : '#94a3b8'} /> {displayRating} / 5.0 ({displayCount} {displayCount === 1 ? 'review' : 'reviews'})
              </span>
            </div>

            <div style={{ flex: 1, minWidth: '130px' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>{isService ? 'Provider' : 'Hourly Option'}</span>
              <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', marginTop: '2px' }}>
                {isService
                  ? (venue.vendor_name || venue.owner_name || 'Verified Provider')
                  : (venue.price_per_hour ? `KES ${venue.price_per_hour.toLocaleString()} / hr` : 'Full Day Only')}
              </span>
            </div>
          </div>

          <section aria-label="Listing portfolio" style={{ margin: '0 0 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontSize: '1.1rem', fontWeight: 800 }}>
                <Images size={19} color="#0d8a73" /> Portfolio
              </h3>
              {portfolioImages.length > visiblePortfolioImages.length && (
                <button
                  type="button"
                  onClick={() => setPortfolioGalleryIndex(0)}
                  style={{ border: 0, background: 'transparent', color: '#0d8a73', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  View All Images <ArrowRight size={14} style={{ verticalAlign: 'middle' }} />
                </button>
              )}
            </div>
            {portfolioImages.length === 0 ? (
              <div style={{ padding: '22px 14px', textAlign: 'center', color: '#64748b', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', fontSize: '0.88rem' }}>
                No portfolio images are available yet.
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '2px 2px 10px' }}>
                {visiblePortfolioImages.map((image, index) => (
                  <button
                    type="button"
                    key={image.id}
                    onClick={() => setPortfolioGalleryIndex(index)}
                    aria-label={`View portfolio image ${index + 1}${image.caption ? `: ${image.caption}` : ''}`}
                    style={{ position: 'relative', padding: 0, border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', background: '#f1f5f9', cursor: 'zoom-in', flex: '0 0 160px', height: '112px' }}
                  >
                    <img
                      src={image.safeUrl}
                      alt={image.caption || `${venue.title} portfolio image ${index + 1}`}
                      onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {image.caption && (
                      <span style={{ position: 'absolute', inset: 'auto 0 0', padding: '18px 8px 7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', color: '#fff', fontSize: '0.75rem', fontWeight: 600, background: 'linear-gradient(transparent, rgba(15,23,42,.78))' }}>
                        {image.caption}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>

          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>{isService ? 'About this Service' : 'About this Venue'}</h3>
            <p style={{ color: '#475569', lineHeight: 1.6 }}>{venue.description || 'Verified event space equipped with full infrastructure, convenient accessibility, and professional management.'}</p>
          </div>

          {/* Real-time Customer Date Availability Checker (No login required) */}
          <div className="listing-detail-availability" style={{
            marginBottom: '12px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '20px',
          }}>
            <div className="listing-detail-availability-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Calendar size={18} color="#0d8a73" />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                Check Date Availability
              </h3>
            </div>
            <p className="listing-detail-availability-description" style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#64748b' }}>
              Select your planned event date to see if this {isService ? 'service' : 'venue'} is open and accepting bookings.
            </p>

            <div className="listing-detail-availability-controls" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
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
                border: `1px solid ${availabilityResult.available ? '#a7f3d0' : '#fecaca'
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

          <details className="listing-detail-section">
            <summary><Sparkles size={18} /> Included Features & Amenities</summary>
            <div className="listing-detail-section-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
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
          </details>

          {/* Customer Reviews Section */}
          <div className="listing-detail-reviews" style={{ marginBottom: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Customer Reviews <span style={{ fontSize: '0.9rem', color: displayCount > 0 ? '#d97706' : '#64748b', fontWeight: 700 }}>★ {displayRating} ({displayCount})</span>
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

        </div>

        <div className="listing-detail-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
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
            {venue.approval_status === 'APPROVED' && venue.is_available && hasGuestCapacity ? (
              <button
                className="btn-primary"
                onClick={() => {
                  onClose();
                  onBook(venue);
                }}
                style={{ padding: '10px 22px', fontSize: '0.95rem' }}
              >
                <Calendar size={18} /> Send Booking Request <ArrowRight size={18} />
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
                {venue.approval_status !== 'APPROVED'
                  ? 'Listing Pending Verification'
                  : !venue.is_available
                    ? 'Currently Unavailable'
                    : 'Capacity Needed'}
              </button>
            )}
          </div>
        </div>

        {portfolioGalleryIndex !== null && portfolioImages.length > 0 && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Portfolio image gallery"
            onClick={() => setPortfolioGalleryIndex(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(2, 6, 23, 0.94)' }}
          >
            <button
              type="button"
              onClick={() => setPortfolioGalleryIndex(null)}
              aria-label="Close portfolio gallery"
              style={{ position: 'absolute', top: '18px', right: '22px', width: '42px', height: '42px', display: 'grid', placeItems: 'center', border: '1px solid #ffffff55', borderRadius: '50%', color: '#fff', background: '#ffffff18', cursor: 'pointer' }}
            >
              <X size={22} />
            </button>
            <div onClick={(event) => event.stopPropagation()} style={{ width: 'min(100%, 1100px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div style={{ position: 'relative', width: '100%', height: 'min(72vh, 720px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {portfolioImages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPortfolioGalleryIndex(index => index === null ? null : (index + portfolioImages.length - 1) % portfolioImages.length)}
                    aria-label="Previous portfolio image"
                    style={{ position: 'absolute', left: '12px', zIndex: 1, width: '44px', height: '44px', display: 'grid', placeItems: 'center', border: '1px solid #ffffff55', borderRadius: '50%', color: '#fff', background: '#0f172a99', cursor: 'pointer' }}
                  >
                    <ChevronLeft size={26} />
                  </button>
                )}
                <img
                  src={portfolioImages[portfolioGalleryIndex].safeUrl}
                  alt={portfolioImages[portfolioGalleryIndex].caption || `${venue.title} portfolio image ${portfolioGalleryIndex + 1}`}
                  onError={(event) => { event.currentTarget.style.display = 'none'; }}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '10px' }}
                />
                {portfolioImages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPortfolioGalleryIndex(index => index === null ? null : (index + 1) % portfolioImages.length)}
                    aria-label="Next portfolio image"
                    style={{ position: 'absolute', right: '12px', zIndex: 1, width: '44px', height: '44px', display: 'grid', placeItems: 'center', border: '1px solid #ffffff55', borderRadius: '50%', color: '#fff', background: '#0f172a99', cursor: 'pointer' }}
                  >
                    <ChevronRight size={26} />
                  </button>
                )}
              </div>
              <div style={{ minHeight: '42px', textAlign: 'center', color: '#fff' }}>
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  {portfolioGalleryIndex + 1} of {portfolioImages.length}
                </div>
                {portfolioImages[portfolioGalleryIndex].caption && (
                  <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                    {portfolioImages[portfolioGalleryIndex].caption}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
                        recipient: venue.owner_user_id || (typeof venue.owner === 'object' ? (venue.owner as any)?.user : venue.owner) || (typeof venue.vendor === 'object' ? (venue.vendor as any)?.user : venue.vendor) || undefined,
                        venue: venue.id,
                        content: directMessageText.trim(),
                      });
                      if (res) {
                        toast.success(`Message sent to ${venue.owner_name || 'Host'}!`);
                        setDirectMessageText('');
                        setShowMessageModal(false);
                        if (onMessage) {
                          const resolvedVenueOwner = venue.owner_user_id || (typeof venue.owner === 'object' ? (venue.owner as any)?.user : venue.owner) || (typeof venue.vendor === 'object' ? (venue.vendor as any)?.user : venue.vendor);
                          onMessage({ recipientId: resolvedVenueOwner, name: venue.owner_name || venue.vendor_name || 'Host', venueId: venue.id });
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
