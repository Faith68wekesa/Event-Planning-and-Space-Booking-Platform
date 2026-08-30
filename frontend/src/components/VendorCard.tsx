import React from 'react';
import type { Vendor } from '../types';
import { ShieldCheck, MapPin, Star, Phone, Mail, Award, ArrowRight } from 'lucide-react';

interface VendorCardProps {
  vendor: Vendor;
  onSelect: (vendor: Vendor) => void;
  onBook: (vendor: Vendor) => void;
}

export const VendorCard: React.FC<VendorCardProps> = ({ vendor, onSelect, onBook }) => {
  const imageCover = vendor.portfolio_images && vendor.portfolio_images.length > 0 
    ? vendor.portfolio_images[0] 
    : 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="glass-card" style={{
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      height: '100%'
    }}>
      <div style={{ position: 'relative', height: '180px', overflow: 'hidden' }}>
        <img
          src={imageCover}
          alt={vendor.business_name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
          {vendor.is_verified ? (
            <span className="badge-verified">
              <ShieldCheck size={14} /> Verified Provider
            </span>
          ) : (
            <span className="badge-unverified">
              Unverified Provider
            </span>
          )}
        </div>

        <div style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          padding: '4px 10px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '0.85rem',
          fontWeight: 700,
          color: '#fbbf24'
        }}>
          <Star size={14} fill="#fbbf24" /> {vendor.rating} ({vendor.review_count})
        </div>
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <div style={{ marginBottom: '8px' }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 800,
            color: '#818cf8',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            display: 'inline-block',
            marginBottom: '4px'
          }}>
            {vendor.vendor_type_display || vendor.vendor_type}
          </span>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
            {vendor.business_name}
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={14} color="#818cf8" /> {vendor.location}
          </span>
          <span>•</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Award size={14} color="#34d399" /> Certified Specialist
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
          {vendor.description}
        </p>

        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          {vendor.contact_phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Phone size={12} color="#34d399" /> {vendor.contact_phone}
            </div>
          )}
          {vendor.contact_email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={12} color="#818cf8" /> {vendor.contact_email}
            </div>
          )}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Starting Fee</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#34d399' }}>
              KES {vendor.starting_price.toLocaleString()}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn-secondary"
              onClick={() => onSelect(vendor)}
              style={{ padding: '8px 12px', fontSize: '0.82rem' }}
            >
              Portfolio
            </button>
            <button
              className="btn-primary"
              onClick={() => onBook(vendor)}
              style={{ padding: '8px 14px', fontSize: '0.82rem' }}
            >
              Hire Service <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
