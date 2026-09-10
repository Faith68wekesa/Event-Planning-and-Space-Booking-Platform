import React, { useState, useEffect } from 'react';
import type { Venue, Vendor, VenueOwner, VerificationStatus } from '../types';
import { 
  ShieldCheck, AlertTriangle, Building, UserCheck, 
  Check, X, Eye, Clock, MapPin, ExternalLink
} from 'lucide-react';
import { ApiService } from '../services/api';

interface AdminDashboardProps {
  venues: Venue[];
  vendors: Vendor[];
  onToggleVerifyVenue: (id: number) => void;
  onToggleVerifyVendor: (id: number) => void;
  onRefreshVendors?: () => void;
}

interface UnifiedAccount {
  id: number;
  business_name: string;
  account_type: 'Vendor' | 'Venue Owner';
  category_or_type: string;
  location: string;
  address?: string;
  description?: string;
  email?: string;
  phone?: string;
  years_in_business?: number;
  website_url?: string;
  logo_url?: string;
  verification_status: VerificationStatus;
  is_verified: boolean;
  created_at?: string;
  rawItem: Vendor | VenueOwner;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  venues,
  vendors,
  onToggleVerifyVenue,
  onToggleVerifyVendor,
}) => {
  const [venueOwners, setVenueOwners] = useState<VenueOwner[]>([]);
  const [localVendors, setLocalVendors] = useState<Vendor[]>(vendors);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'VENDOR' | 'VENUE_OWNER' | 'VENUES'>('ALL');
  const [selectedAccount, setSelectedAccount] = useState<UnifiedAccount | null>(null);

  const fetchOwners = async () => {
    try {
      const owners = await ApiService.getVenueOwners();
      setVenueOwners(owners);
      const v = await ApiService.getVendors();
      setLocalVendors(v);
    } catch (e) {
      console.error('Failed to load accounts for admin', e);
    }
  };

  useEffect(() => {
    fetchOwners();
  }, []);

  useEffect(() => {
    setLocalVendors(vendors);
  }, [vendors]);

  // Handle Approve action
  const handleApprove = async (account: UnifiedAccount) => {
    if (account.account_type === 'Vendor') {
      const res = await ApiService.setVendorVerificationStatus(account.id, 'APPROVED');
      if (res) {
        setLocalVendors(prev => prev.map(v => v.id === account.id ? { ...v, verification_status: 'APPROVED', is_verified: true } : v));
      } else {
        await onToggleVerifyVendor(account.id);
        setLocalVendors(prev => prev.map(v => v.id === account.id ? { ...v, verification_status: 'APPROVED', is_verified: true } : v));
      }
    } else {
      const res = await ApiService.setVenueOwnerVerificationStatus(account.id, 'APPROVED');
      if (res) {
        setVenueOwners(prev => prev.map(o => o.id === account.id ? { ...o, verification_status: 'APPROVED', is_verified: true } : o));
      } else {
        await ApiService.toggleVerifyVenueOwner(account.id);
        setVenueOwners(prev => prev.map(o => o.id === account.id ? { ...o, verification_status: 'APPROVED', is_verified: true } : o));
      }
    }
    if (selectedAccount && selectedAccount.id === account.id) {
      setSelectedAccount(prev => prev ? { ...prev, verification_status: 'APPROVED', is_verified: true } : null);
    }
  };

  // Handle Reject action
  const handleReject = async (account: UnifiedAccount) => {
    if (account.account_type === 'Vendor') {
      const res = await ApiService.setVendorVerificationStatus(account.id, 'REJECTED');
      if (res) {
        setLocalVendors(prev => prev.map(v => v.id === account.id ? { ...v, verification_status: 'REJECTED', is_verified: false } : v));
      } else {
        setLocalVendors(prev => prev.map(v => v.id === account.id ? { ...v, verification_status: 'REJECTED', is_verified: false } : v));
      }
    } else {
      const res = await ApiService.setVenueOwnerVerificationStatus(account.id, 'REJECTED');
      if (res) {
        setVenueOwners(prev => prev.map(o => o.id === account.id ? { ...o, verification_status: 'REJECTED', is_verified: false } : o));
      } else {
        setVenueOwners(prev => prev.map(o => o.id === account.id ? { ...o, verification_status: 'REJECTED', is_verified: false } : o));
      }
    }
    if (selectedAccount && selectedAccount.id === account.id) {
      setSelectedAccount(prev => prev ? { ...prev, verification_status: 'REJECTED', is_verified: false } : null);
    }
  };

  // Normalize Vendors & Venue Owners into a unified list
  const unifiedAccounts: UnifiedAccount[] = [
    ...localVendors.map(v => ({
      id: v.id,
      business_name: v.business_name,
      account_type: 'Vendor' as const,
      category_or_type: v.vendor_type_display || v.vendor_type,
      location: v.location,
      address: v.address,
      description: v.description,
      email: v.contact_email,
      phone: v.contact_phone,
      years_in_business: v.years_in_business,
      website_url: v.website_url,
      logo_url: v.logo_url,
      verification_status: v.verification_status || (v.is_verified ? 'APPROVED' : 'PENDING'),
      is_verified: v.is_verified,
      created_at: v.created_at,
      rawItem: v,
    })),
    ...venueOwners.map(o => ({
      id: o.id,
      business_name: o.business_name,
      account_type: 'Venue Owner' as const,
      category_or_type: o.business_type || 'Event Venue',
      location: o.location || 'Kenya',
      address: o.address,
      description: o.description,
      email: o.contact_email,
      phone: o.contact_phone,
      years_in_business: o.years_in_business,
      website_url: o.website_url,
      logo_url: o.logo_url,
      verification_status: o.verification_status || (o.is_verified ? 'APPROVED' : 'PENDING'),
      is_verified: o.is_verified,
      created_at: o.created_at,
      rawItem: o,
    })),
  ];

  // Filtering
  const filteredAccounts = unifiedAccounts.filter(acc => {
    if (statusFilter !== 'ALL' && acc.verification_status !== statusFilter) return false;
    if (typeFilter === 'VENDOR' && acc.account_type !== 'Vendor') return false;
    if (typeFilter === 'VENUE_OWNER' && acc.account_type !== 'Venue Owner') return false;
    return true;
  });

  const pendingCount = unifiedAccounts.filter(a => a.verification_status === 'PENDING').length;
  const approvedCount = unifiedAccounts.filter(a => a.verification_status === 'APPROVED').length;
  const rejectedCount = unifiedAccounts.filter(a => a.verification_status === 'REJECTED').length;

  return (
    <div style={{ maxWidth: '1200px', margin: '32px auto', padding: '0 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(13, 138, 115, 0.12)', color: '#0d8a73', padding: '4px 12px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px' }}>
          <ShieldCheck size={14} /> Platform Administrator Control Panel
        </div>
        <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1e293b', margin: '0 0 6px' }}>
          Vendor & Venue Owner Verification Management
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
          Review registered businesses in Kenya and approve or reject their platform verification status.
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 22px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Pending Verification
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#d97706', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={24} /> {pendingCount}
          </div>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>Requires review</p>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 22px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Verified Accounts
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#059669', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={24} /> {approvedCount}
          </div>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>Active with badge</p>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 22px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Rejected / Inactive
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#dc2626', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <X size={24} /> {rejectedCount}
          </div>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>Denied approval</p>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 22px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Physical Venues
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0d8a73', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={24} /> {venues.length}
          </div>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>Spaces listed</p>
        </div>
      </div>

      {/* Main Verification Table Card */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginBottom: '32px' }}>
        {/* Table Filter Toolbar */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: '#fafbfc' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
              Business Verification Directory
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0' }}>
              Showing {filteredAccounts.length} accounts matching filters
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Status Tabs */}
            <div style={{ display: 'inline-flex', background: '#e2e8f0', padding: '3px', borderRadius: '8px' }}>
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    border: 'none',
                    background: statusFilter === st ? '#ffffff' : 'transparent',
                    color: statusFilter === st ? '#0f172a' : '#64748b',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: statusFilter === st ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {st === 'ALL' ? 'All Status' : st === 'PENDING' ? 'Pending' : st === 'APPROVED' ? 'Approved' : 'Rejected'}
                </button>
              ))}
            </div>

            {/* Type Selector */}
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#334155',
                background: '#fff',
                outline: 'none',
              }}
            >
              <option value="ALL">All Account Types</option>
              <option value="VENDOR">Vendors Only</option>
              <option value="VENUE_OWNER">Venue Owners Only</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '14px 20px' }}>Business</th>
                <th style={{ padding: '14px 16px' }}>Account Type</th>
                <th style={{ padding: '14px 16px' }}>Service / Category</th>
                <th style={{ padding: '14px 16px' }}>Location</th>
                <th style={{ padding: '14px 16px' }}>Status</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    No accounts found matching the current filters.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => {
                  const isPending = account.verification_status === 'PENDING';
                  const isApproved = account.verification_status === 'APPROVED';
                  const isRejected = account.verification_status === 'REJECTED';

                  return (
                    <tr
                      key={`${account.account_type}-${account.id}`}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s',
                        background: isPending ? 'rgba(254, 243, 199, 0.15)' : 'transparent',
                      }}
                    >
                      {/* Business */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {account.logo_url ? (
                            <img
                              src={account.logo_url}
                              alt=""
                              style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '8px',
                                background: account.account_type === 'Vendor' ? '#ecfdf5' : '#eff6ff',
                                color: account.account_type === 'Vendor' ? '#0d8a73' : '#2563eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                              }}
                            >
                              {account.business_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span style={{ fontWeight: 700, color: '#1e293b', display: 'block' }}>
                              {account.business_name}
                            </span>
                            {account.email && (
                              <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                                {account.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Account Type */}
                      <td style={{ padding: '16px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: account.account_type === 'Vendor' ? '#f0fdf4' : '#eff6ff',
                            color: account.account_type === 'Vendor' ? '#166534' : '#1e40af',
                            border: `1px solid ${account.account_type === 'Vendor' ? '#bbf7d0' : '#bfdbfe'}`,
                          }}
                        >
                          {account.account_type === 'Vendor' ? <UserCheck size={12} /> : <Building size={12} />}
                          {account.account_type}
                        </span>
                      </td>

                      {/* Category */}
                      <td style={{ padding: '16px 16px', color: '#334155', fontWeight: 500 }}>
                        {account.category_or_type}
                      </td>

                      {/* Location */}
                      <td style={{ padding: '16px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#475569' }}>
                          <MapPin size={13} color="#94a3b8" />
                          {account.location}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '16px 16px' }}>
                        {isApproved && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                            <ShieldCheck size={12} /> Approved
                          </span>
                        )}
                        {isPending && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                            <Clock size={12} /> Pending
                          </span>
                        )}
                        {isRejected && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                            <X size={12} /> Rejected
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            onClick={() => setSelectedAccount(account)}
                            title="Review Details"
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#475569',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Eye size={13} /> Review
                          </button>

                          <button
                            onClick={() => handleApprove(account)}
                            disabled={isApproved}
                            title="Approve Verification"
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: 'none',
                              background: isApproved ? '#e2e8f0' : '#059669',
                              color: isApproved ? '#94a3b8' : '#ffffff',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: isApproved ? 'default' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: isApproved ? 'none' : '0 1px 3px rgba(5,150,105,0.25)',
                            }}
                          >
                            <Check size={13} /> Approve
                          </button>

                          <button
                            onClick={() => handleReject(account)}
                            disabled={isRejected}
                            title="Reject Account"
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: 'none',
                              background: isRejected ? '#e2e8f0' : '#ef4444',
                              color: isRejected ? '#94a3b8' : '#ffffff',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: isRejected ? 'default' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <X size={13} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Venues Section */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building size={20} color="#0d8a73" /> Physical Event Venues Verification ({venues.length})
        </h3>

        <div style={{ display: 'grid', gap: '12px' }}>
          {venues.map((v) => (
            <div
              key={v.id}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ fontWeight: 700, fontSize: '1.05rem', margin: 0, color: '#1e293b' }}>{v.title}</h4>
                  {v.is_verified ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, background: '#ecfdf5', color: '#059669' }}>
                      <ShieldCheck size={11} /> Verified
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, background: '#fef3c7', color: '#b45309' }}>
                      <AlertTriangle size={11} /> Pending Review
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0' }}>
                  Category: <strong>{v.category_display || v.category}</strong> • Location: <strong>{v.location}</strong> • Capacity: <strong>{v.capacity} guests</strong> • Rate: <strong>KES {v.price_per_day.toLocaleString()}/day</strong>
                </p>
              </div>

              <button
                onClick={() => onToggleVerifyVenue(v.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: v.is_verified ? '1px solid #cbd5e1' : 'none',
                  background: v.is_verified ? '#fff' : '#0d8a73',
                  color: v.is_verified ? '#475569' : '#fff',
                }}
              >
                {v.is_verified ? 'Revoke Verification' : 'Approve & Verify Venue'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Account Review Modal */}
      {selectedAccount && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#0d8a73' }}>
                  {selectedAccount.account_type} Profile Review
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>
                  {selectedAccount.business_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAccount(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem' }}>
              {selectedAccount.logo_url && (
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <img
                    src={selectedAccount.logo_url}
                    alt="Logo"
                    style={{ maxHeight: '80px', maxWidth: '200px', borderRadius: '8px', objectFit: 'contain' }}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Type / Category</span>
                  <strong style={{ color: '#1e293b' }}>{selectedAccount.category_or_type}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Location</span>
                  <strong style={{ color: '#1e293b' }}>{selectedAccount.location}</strong>
                </div>
              </div>

              {selectedAccount.address && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Physical Address</span>
                  <span style={{ color: '#334155' }}>{selectedAccount.address}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {selectedAccount.email && (
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Email Address</span>
                    <a href={`mailto:${selectedAccount.email}`} style={{ color: '#0d8a73', textDecoration: 'none', fontWeight: 600 }}>
                      {selectedAccount.email}
                    </a>
                  </div>
                )}
                {selectedAccount.phone && (
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Phone Number</span>
                    <a href={`tel:${selectedAccount.phone}`} style={{ color: '#0d8a73', textDecoration: 'none', fontWeight: 600 }}>
                      {selectedAccount.phone}
                    </a>
                  </div>
                )}
              </div>

              {selectedAccount.years_in_business !== undefined && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Experience</span>
                  <span style={{ color: '#334155', fontWeight: 600 }}>{selectedAccount.years_in_business} years in business</span>
                </div>
              )}

              {selectedAccount.website_url && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Website / Portfolio</span>
                  <a
                    href={selectedAccount.website_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                  >
                    {selectedAccount.website_url} <ExternalLink size={13} />
                  </a>
                </div>
              )}

              {selectedAccount.description && (
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Business Description</span>
                  <p style={{ margin: 0, color: '#334155', lineHeight: 1.5, fontSize: '0.85rem' }}>
                    {selectedAccount.description}
                  </p>
                </div>
              )}

              {/* Status banner in modal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '8px', background: selectedAccount.verification_status === 'APPROVED' ? '#ecfdf5' : selectedAccount.verification_status === 'REJECTED' ? '#fef2f2' : '#fef3c7' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Current Status:</span>
                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: selectedAccount.verification_status === 'APPROVED' ? '#059669' : selectedAccount.verification_status === 'REJECTED' ? '#dc2626' : '#b45309' }}>
                  {selectedAccount.verification_status}
                </span>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8fafc', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
              <button
                onClick={() => setSelectedAccount(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                onClick={() => handleReject(selectedAccount)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Reject
              </button>
              <button
                onClick={() => handleApprove(selectedAccount)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#059669', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Approve & Verify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
