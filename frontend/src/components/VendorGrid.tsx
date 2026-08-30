import React from 'react';
import type { Vendor } from '../types';
import { VendorCard } from './VendorCard';
import { UserX } from 'lucide-react';

interface VendorGridProps {
  vendors: Vendor[];
  onSelectVendor: (vendor: Vendor) => void;
  onBookVendor: (vendor: Vendor) => void;
}

export const VendorGrid: React.FC<VendorGridProps> = ({ vendors, onSelectVendor, onBookVendor }) => {
  if (vendors.length === 0) {
    return (
      <div className="card" style={{ padding: '48px', textAlign: 'center', margin: '20px 0' }}>
        <UserX size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>No Service Providers Found</h3>
        <p style={{ color: 'var(--text-muted)' }}>Try adjusting your search filters or selecting a different service category.</p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: '24px',
      margin: '24px 0'
    }}>
      {vendors.map((vendor) => (
        <VendorCard
          key={vendor.id}
          vendor={vendor}
          onSelect={onSelectVendor}
          onBook={onBookVendor}
        />
      ))}
    </div>
  );
};
