import React from 'react';
import { Star, MessageCircle, ThumbsUp, ChevronDown } from 'lucide-react';
import type { Review } from '../types';

interface VendorDashboardReviewsProps {
  reviews: Review[];
}

export const VendorDashboardReviews: React.FC<VendorDashboardReviewsProps> = ({ reviews }) => {

  const hasReviews = reviews && reviews.length > 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
      
      {/* Reviews List */}
      <div className="dashboard-card" style={{ padding: '0' }}>
        
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px 0', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reviews & Feedback</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Manage and respond to client reviews.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-secondary-light" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              All Services <ChevronDown size={14} />
            </button>
            <button className="btn-secondary-light" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Newest <ChevronDown size={14} />
            </button>
          </div>
        </div>

        {/* Reviews Summary Block - Only show if there are reviews */}
        {hasReviews && (
          <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', gap: '32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Star size={32} fill="#fbbf24" stroke="#fbbf24" /> 4.8 <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 600 }}>/ 5</span>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '4px' }}>Based on 24 reviews</div>
            </div>
            
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { stars: 5, count: 18 },
                { stars: 4, count: 4 },
                { stars: 3, count: 1 },
                { stars: 2, count: 1 },
                { stars: 1, count: 0 },
              ].map(row => (
                <div key={row.stars} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '2px', minWidth: '80px' }}>
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={12} fill={i < row.stars ? '#fbbf24' : 'transparent'} stroke={i < row.stars ? '#fbbf24' : '#cbd5e1'} />
                    ))}
                  </div>
                  <div style={{ flexGrow: 1, height: '6px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#fbbf24', width: `${(row.count / 24) * 100}%` }}></div>
                  </div>
                  <div style={{ minWidth: '20px', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>{row.count}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        <div>
          {!hasReviews ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ color: '#0f172a', fontWeight: 700, fontSize: '1.1rem', marginBottom: '8px' }}>
                No reviews yet
              </div>
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                When customers leave a review for your services, they will appear here.
              </div>
            </div>
          ) : (
            reviews.map((review, idx) => (
              <div key={review.id} style={{ padding: '24px', borderBottom: idx !== reviews.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.05rem' }}>{review.user_name}</div>
                  <div style={{ display: 'flex', gap: '2px', color: '#fbbf24' }}>
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={14} fill={i < review.rating ? '#fbbf24' : 'transparent'} stroke={i < review.rating ? '#fbbf24' : '#cbd5e1'} />
                    ))}
                  </div>
                </div>
                
                <div style={{ fontSize: '0.85rem', color: '#0d8a73', fontWeight: 600, marginBottom: '12px' }}>
                  Wedding Photography
                </div>
                
                <p style={{ color: '#334155', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '16px' }}>
                  "{review.comment}"
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Posted {new Date(review.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  <button style={{ background: '#f1f5f9', border: 'none', color: '#334155', fontWeight: 600, fontSize: '0.85rem', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                     Reply
                  </button>
                </div>
                
              </div>
            ))
          )}
        </div>
      </div>

      {/* Analytics Widgets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div className="dashboard-card" style={{ background: hasReviews ? 'linear-gradient(135deg, #0d8a73, #065f54)' : '#f8fafc', color: hasReviews ? '#fff' : '#0f172a', border: hasReviews ? 'none' : '1px solid #e2e8f0', textAlign: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 16px 0', color: hasReviews ? '#fff' : '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sentiment Analysis</h3>
          
          {hasReviews ? (
            <>
              <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 24px', borderRadius: '50%', background: 'conic-gradient(#34d399 0% 92%, rgba(255,255,255,0.15) 92% 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#064e3b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>92%</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', fontSize: '0.85rem', color: '#94a3b8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ccfbf1' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }}></span> 92% Positive
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '0.85rem', color: '#94a3b8', marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.8)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }}></span> 6% Neutral
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.8)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></span> 2% Negative
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: '16px 0' }}>
              <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '8px' }}>Not enough reviews yet.</div>
              <div style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>
                Sentiment insights will appear after your services receive enough customer feedback.
              </div>
            </div>
          )}
        </div>

        <div className="dashboard-card" style={{ background: hasReviews ? '#fff' : '#f8fafc', border: hasReviews ? 'none' : '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 16px 0', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Popular Keywords</h3>
          
          {hasReviews ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ background: 'rgba(13, 138, 115, 0.1)', color: '#0d8a73', padding: '6px 12px', borderRadius: '99px', fontSize: '0.9rem', fontWeight: 600 }}>Beautiful (42)</span>
              <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '99px', fontSize: '0.85rem' }}>Staff (38)</span>
              <span style={{ background: 'rgba(5, 150, 105, 0.1)', color: '#059669', padding: '4px 10px', borderRadius: '99px', fontSize: '0.85rem' }}>Professional (25)</span>
              <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '99px', fontSize: '0.8rem' }}>Catering (18)</span>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '8px' }}>No keyword insights available yet.</div>
              <div style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>
                More reviews are needed to generate insights.
              </div>
            </div>
          )}
        </div>

        {hasReviews && (
          <div className="dashboard-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#e0f2fe', color: '#0d8a73', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ThumbsUp size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Review Response Rate</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>88%</div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
