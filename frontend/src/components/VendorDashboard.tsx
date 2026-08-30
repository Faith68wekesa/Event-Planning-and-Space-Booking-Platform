import React, { useState } from 'react';
import type { Booking, Venue, BookingStatus } from '../types';
import { ApiService } from '../services/api';
import { CheckCircle2, XCircle, Plus } from 'lucide-react';

interface VendorDashboardProps {
  bookings: Booking[];
  onUpdateStatus: (id: number, status: BookingStatus) => void;
  onAddVenue: (newVenue: Venue) => void;
}

export const VendorDashboard: React.FC<VendorDashboardProps> = ({
  bookings,
  onUpdateStatus,
  onAddVenue,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<any>('WEDDING');
  const [location, setLocation] = useState('Nairobi');
  const [capacity, setCapacity] = useState(300);
  const [priceDay, setPriceDay] = useState(75000);
  const [desc, setDesc] = useState('');

  const handleAddVenueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await ApiService.addVenue({
      title,
      category,
      location,
      capacity: Number(capacity),
      price_per_day: Number(priceDay),
      description: desc,
      amenities: ['Manicured Grounds', 'Generator Backup', 'Security Guards', 'Ample Parking'],
      image_url: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80',
    });
    onAddVenue(created);
    setShowAddModal(false);
    alert('New venue submitted! It will appear on the platform for admin verification.');
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '32px auto', padding: '0 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Vendor & Venue Management Portal</h2>
          <p style={{ color: 'var(--text-muted)' }}>Manage incoming client booking requests and publish new event spaces.</p>
        </div>

        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={18} /> Register New Venue Listing
        </button>
      </div>

      <div className="glass-card" style={{ padding: '24px', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px' }}>Incoming Booking Requests</h3>
        
        {bookings.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No incoming booking requests currently pending review.</p>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {bookings.map((b) => (
              <div key={b.id} style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
              }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{b.event_title}</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Client: <strong>{b.customer_name || 'John Maina'}</strong> • Date: <strong>{b.event_date}</strong> • Guests: <strong>{b.guest_count}</strong>
                  </p>
                  {b.notes && (
                    <p style={{ fontSize: '0.8rem', color: '#818cf8', marginTop: '4px' }}>
                      Notes: {b.notes}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ textAlign: 'right', marginRight: '8px' }}>
                    <div style={{ fontWeight: 800, color: '#34d399' }}>KES {b.total_price.toLocaleString()}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status: {b.status}</span>
                  </div>

                  {b.status === 'PENDING' && (
                    <>
                      <button
                        className="btn-primary"
                        onClick={() => onUpdateStatus(b.id, 'APPROVED')}
                        style={{ padding: '6px 12px', fontSize: '0.8rem', background: '#10b981' }}
                      >
                        <CheckCircle2 size={14} /> Accept
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => onUpdateStatus(b.id, 'REJECTED')}
                        style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#f87171' }}
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '16px' }}>List New Event Venue</h3>
            <form onSubmit={handleAddVenueSubmit} style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Venue Title</label>
                <input required type="text" placeholder="e.g. Windsor Garden Pavilion" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="WEDDING">Wedding Garden</option>
                    <option value="CONFERENCE">Conference Center</option>
                    <option value="OUTDOOR">Outdoor Grounds</option>
                    <option value="BIRTHDAY">Birthday Venue</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Location</label>
                  <input required type="text" placeholder="e.g. Nairobi / Nakuru" value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Max Capacity</label>
                  <input required type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Price per Day (KES)</label>
                  <input required type="number" value={priceDay} onChange={(e) => setPriceDay(Number(e.target.value))} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Description</label>
                <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describe venue features..." />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Submit Listing</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
