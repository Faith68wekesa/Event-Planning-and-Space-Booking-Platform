import React from 'react';
import { Star, MessageCircle, ThumbsUp } from 'lucide-react';

export const VendorDashboardReviews: React.FC = () => {
  // Mock data for reviews since it's not currently in the backend
  const reviews = [
    {
      id: 1,
      author: 'Alexandria Kariuki',
      date: 'Oct 12, 2026',
      rating: 5,
      content: 'We had an amazing time at Karen Oasis Gardens. The staff went above and beyond to make our wedding day truly special. The lush greenery and well-kept lawns provided the perfect backdrop for our photos. Highly recommended for anyone looking for a serene outdoor venue.',
      response: 'Thank you Alexandria! We are so glad we could be part of your special day.'
    },
    {
      id: 2,
      author: 'Marcus Otieno',
      date: 'Sep 28, 2026',
      rating: 5,
      content: 'Excellent facilities for our corporate retreat. The catering was on point, and the AV equipment worked flawlessly. Only minor issue was the WiFi being a bit slow in the breakout rooms, but overall a fantastic experience.',
      response: null
    },
    {
      id: 3,
      author: 'Sarah Wanjiru',
      date: 'Sep 15, 2026',
      rating: 4,
      content: 'Everything was beautiful. The views of the lake at sunset are just breathtaking. The staff was attentive and helpful. I would definitely book this venue again for future events.',
      response: null
    }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
      
      {/* Reviews List */}
      <div className="dashboard-card" style={{ padding: '0' }}>
        
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>Reviews & Feedback</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Manage and respond to client reviews.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-secondary-light">Filter</button>
            <button className="btn-secondary-light">Sort by: Newest</button>
          </div>
        </div>

        {/* Reviews */}
        <div>
          {reviews.map((review, idx) => (
            <div key={review.id} style={{ padding: '24px', borderBottom: idx !== reviews.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#475569' }}>
                    {review.author.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{review.author}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{review.date}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '2px', color: '#fbbf24' }}>
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} fill={i < review.rating ? '#fbbf24' : 'transparent'} stroke={i < review.rating ? '#fbbf24' : '#cbd5e1'} />
                  ))}
                </div>
              </div>
              
              <p style={{ color: '#334155', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '16px' }}>
                "{review.content}"
              </p>

              {review.response ? (
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #8b5cf6', marginLeft: '24px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0d8a73', marginBottom: '4px' }}>Your Response</div>
                  <p style={{ fontSize: '0.9rem', color: '#475569', margin: 0 }}>{review.response}</p>
                </div>
              ) : (
                <button style={{ background: 'none', border: 'none', color: '#0d8a73', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '24px' }}>
                  <MessageCircle size={14} /> Reply to Review
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Analytics Widgets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div className="dashboard-card" style={{ background: '#0f1123', color: '#fff', border: 'none', textAlign: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 24px 0', color: '#fff' }}>Sentiment Analysis</h3>
          
          <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 24px', borderRadius: '50%', background: 'conic-gradient(#059669 0% 92%, rgba(255,255,255,0.1) 92% 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#0f1123', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>92%</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', fontSize: '0.85rem', color: '#94a3b8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669' }}></span> Positive
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }}></span> Neutral/Neg
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', color: '#0f172a' }}>Keyword Cloud</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ background: 'rgba(13, 138, 115, 0.1)', color: '#0d8a73', padding: '6px 12px', borderRadius: '99px', fontSize: '0.9rem', fontWeight: 600 }}>Beautiful (42)</span>
            <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '99px', fontSize: '0.85rem' }}>Staff (38)</span>
            <span style={{ background: 'rgba(5, 150, 105, 0.1)', color: '#059669', padding: '4px 10px', borderRadius: '99px', fontSize: '0.85rem' }}>Professional (25)</span>
            <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '99px', fontSize: '0.8rem' }}>Catering (18)</span>
            <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '99px', fontSize: '0.8rem' }}>Views (15)</span>
            <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '99px', fontSize: '0.8rem' }}>Wifi (4)</span>
          </div>
        </div>

        <div className="dashboard-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#e0f2fe', color: '#0d8a73', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ThumbsUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>88%</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Response Rate</div>
          </div>
        </div>

      </div>

    </div>
  );
};
