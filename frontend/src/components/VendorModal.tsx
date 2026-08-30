import React from 'react';
import type { Vendor } from '../types';
import { X, ShieldCheck, MapPin, Star, Phone, Mail, ArrowRight } from 'lucide-react';

interface VendorModalProps {
  vendor: Vendor;
  onClose: () => void;
  onBook: (vendor: Vendor) => void;
}

export const VendorModal: React.FC<VendorModalProps> = ({ vendor, onClose, onBook }) => {
  const cover = vendor.portfolio_images && vendor.portfolio_images.length > 0
    ? vendor.portfolio_images[0]
    : 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
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
            <h2 style={{ fontSize: '1.7rem', fontWeight: 800, color: '#f8fafc', marginTop: '2px' }}>
              {vendor.business_name}
            </h2>
            <p style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', marginTop: '4px', fontSize: '0.9rem' }}>
              <MapPin size={16} color="#0d8a73" /> Based in {vendor.location}, Kenya
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Starting Package</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669' }}>
              KES {vendor.starting_price.toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '16px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: '130px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Rating</span>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <Star size={16} fill="#fbbf24" /> {vendor.rating} / 5.0 ({vendor.review_count} reviews)
            </span>
          </div>

          <div style={{ flex: 1, minWidth: '130px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Contact Phone</span>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <Phone size={14} color="#059669" /> {vendor.contact_phone || '+254700112233'}
            </span>
          </div>

          <div style={{ flex: 1, minWidth: '130px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Email Address</span>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <Mail size={14} color="#0d8a73" /> {vendor.contact_email || 'info@vendor.co.ke'}
            </span>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>Provider Experience & Profile</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{vendor.description}</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '20px' }}>
          <button className="btn-secondary" onClick={onClose}>Back</button>
          <button
            className="btn-primary"
            onClick={() => {
              onClose();
              onBook(vendor);
            }}
            style={{ padding: '12px 24px', fontSize: '1rem' }}
          >
            Hire Service <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
