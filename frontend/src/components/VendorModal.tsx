import React, { useState, useEffect } from 'react';
import type { Vendor, Review } from '../types';
import { X, ShieldCheck, MapPin, Star, ArrowRight, MessageCircle, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { ApiService } from '../services/api';

interface VendorModalProps {
  vendor: Vendor;
  currentUser?: any;
  onClose: () => void;
  onBook: (vendor: Vendor) => void;
  onMessage?: (target: { recipientId?: number; name: string; vendorId?: number }) => void;
}

export const VendorModal: React.FC<VendorModalProps> = ({ vendor, currentUser, onClose, onBook, onMessage }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(true);
  const [showMessageModal, setShowMessageModal] = useState<boolean>(false);
  const [directMessageText, setDirectMessageText] = useState<string>('');
  const [sendingDirectMsg, setSendingDirectMsg] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const fetchReviews = async () => {
      try {
        setLoadingReviews(true);
        const data = await ApiService.getReviews({ vendor: vendor.id });
        if (isMounted) {
          setReviews(data);
        }
      } catch (err) {
        console.error('Error fetching vendor reviews:', err);
      } finally {
        if (isMounted) setLoadingReviews(false);
      }
    };
    fetchReviews();
    return () => {
      isMounted = false;
    };
  }, [vendor.id]);

  const cover = vendor.portfolio_images && vendor.portfolio_images.length > 0
    ? vendor.portfolio_images[0]
    : 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80';

  const displayRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : (vendor.rating > 0 ? vendor.rating.toFixed(1) : null);
  const displayCount = reviews.length > 0 ? reviews.length : vendor.review_count;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
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

        <div style={{ height: '260px', borderRadius: '16px', overflow: 'hidden', position: 'relative', marginBottom: '20px' }}>
          <img src={cover} alt={vendor.business_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', top: '16px', left: '16px' }}>
            {vendor.is_verified ? (
              <span className="badge-verified"><ShieldCheck size={16} /> Verified Platform Vendor</span>
            ) : (
              <span className="badge-unverified">Unverified Provider</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#0d8a73', fontWeight: 800, textTransform: 'uppercase' }}>
              {vendor.vendor_type_display || vendor.vendor_type}
            </span>
            <h2 style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
              {vendor.business_name}
            </h2>
            <p style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', marginTop: '4px', fontSize: '0.9rem' }}>
              <MapPin size={16} color="#0d8a73" /> Based in {vendor.location}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Starting Package</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669' }}>
              KES {Number(vendor.starting_price || 0).toLocaleString()}
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
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: '130px' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Customer Rating</span>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: displayRating ? '#d97706' : '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
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
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Communication</span>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', color: '#0d8a73' }}>
              <ShieldCheck size={14} color="#0d8a73" /> In-Platform Chat
            </span>
          </div>

          <div style={{ flex: 1, minWidth: '130px' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Protection</span>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', color: '#10b981' }}>
              <ShieldCheck size={14} color="#10b981" /> 100% Locyfy Secured
            </span>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Provider Experience & Profile</h3>
          <p style={{ color: '#475569', lineHeight: 1.6 }}>{vendor.description || 'Verified local service provider offering specialized event management, creative services, and quality assurance.'}</p>
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
          <button className="btn-secondary" onClick={onClose}>Back</button>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn-secondary"
              onClick={() => {
                if (!currentUser) {
                  toast.error('Please sign in to message this service provider.');
                  return;
                }
                setShowMessageModal(true);
              }}
              style={{ padding: '10px 20px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <MessageCircle size={18} /> Message Vendor
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                onClose();
                onBook(vendor);
              }}
              style={{ padding: '10px 22px', fontSize: '0.95rem' }}
            >
              Send Booking Request <ArrowRight size={18} />
            </button>
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
                  Message {vendor.business_name}
                </h3>
                <button
                  onClick={() => setShowMessageModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={20} />
                </button>
              </div>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.88rem', color: '#64748b' }}>
                Inquiring about <strong>{vendor.business_name}</strong> services. Your message will be saved and delivered directly to the provider.
              </p>
              <textarea
                rows={4}
                placeholder="Ask about availability, custom service requirements, quotes..."
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
                        recipient: (vendor as any).user || undefined,
                        vendor: vendor.id,
                        content: directMessageText.trim(),
                      });
                      if (res) {
                        toast.success(`Message sent to ${vendor.business_name}!`);
                        setDirectMessageText('');
                        setShowMessageModal(false);
                        if (onMessage) {
                          onMessage({ recipientId: (vendor as any).user, name: vendor.business_name, vendorId: vendor.id });
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
