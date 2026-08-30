import React from 'react';
import type { Venue, Vendor } from '../types';
import { ShieldCheck, AlertTriangle, Building, UserCheck } from 'lucide-react';

interface AdminDashboardProps {
  venues: Venue[];
  vendors: Vendor[];
  onToggleVerifyVenue: (id: number) => void;
  onToggleVerifyVendor: (id: number) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  venues,
  vendors,
  onToggleVerifyVenue,
  onToggleVerifyVendor,
}) => {
  return (
    <div style={{ maxWidth: '1100px', margin: '32px auto', padding: '0 20px' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '4px 12px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px' }}>
          <ShieldCheck size={14} /> Platform Administrator Control Panel
        </div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Vendor & Venue Verification Management</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Review registered event spaces and service providers in Kenya before granting verified badge status.
        </p>
      </div>

      <div className="glass-card" style={{ padding: '24px', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building size={20} color="#818cf8" /> Registered Event Venues ({venues.length})
        </h3>

        <div style={{ display: 'grid', gap: '12px' }}>
          {venues.map((v) => (
            <div key={v.id} style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ fontWeight: 700, fontSize: '1.05rem' }}>{v.title}</h4>
                  {v.is_verified ? (
                    <span className="badge-verified"><ShieldCheck size={12} /> Verified</span>
                  ) : (
                    <span className="badge-unverified"><AlertTriangle size={12} /> Pending Verification</span>
                  )}
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Location: <strong>{v.location}</strong> • Capacity: <strong>{v.capacity} guests</strong> • Rate: <strong>KES {v.price_per_day.toLocaleString()}/day</strong>
                </p>
              </div>

              <button
                className={v.is_verified ? 'btn-secondary' : 'btn-primary'}
                onClick={() => onToggleVerifyVenue(v.id)}
                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
              >
                {v.is_verified ? 'Revoke Verification' : 'Approve & Verify Venue'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserCheck size={20} color="#34d399" /> Registered Planners & Service Providers ({vendors.length})
        </h3>

        <div style={{ display: 'grid', gap: '12px' }}>
          {vendors.map((vd) => (
            <div key={vd.id} style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ fontWeight: 700, fontSize: '1.05rem' }}>{vd.business_name}</h4>
                  {vd.is_verified ? (
                    <span className="badge-verified"><ShieldCheck size={12} /> Verified Provider</span>
                  ) : (
                    <span className="badge-unverified"><AlertTriangle size={12} /> Pending Verification</span>
                  )}
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Service: <strong>{vd.vendor_type_display || vd.vendor_type}</strong> • Location: <strong>{vd.location}</strong> • Rating: <strong>{vd.rating}</strong>
                </p>
              </div>

              <button
                className={vd.is_verified ? 'btn-secondary' : 'btn-primary'}
                onClick={() => onToggleVerifyVendor(vd.id)}
                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
              >
                {vd.is_verified ? 'Revoke Verification' : 'Approve & Verify Vendor'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
