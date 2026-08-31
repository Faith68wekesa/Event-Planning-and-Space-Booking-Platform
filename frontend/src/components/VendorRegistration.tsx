import React, { useState } from 'react';
import { X, Store, Mail, Phone, Lock, MapPin, Tag, User } from 'lucide-react';
import { ApiService } from '../services/api.ts';
import type { Vendor } from '../types';

interface VendorRegistrationProps {
  onClose: () => void;
  onSuccess: (vendor: Vendor) => void;
  onSwitchToLogin?: () => void;
}

export const VendorRegistration: React.FC<VendorRegistrationProps> = ({ onClose, onSuccess, onSwitchToLogin }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    business_name: '',
    vendor_type: 'PLANNER',
    description: '',
    location: '',
    starting_price: 0,
    phone_number: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'starting_price' ? Number(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const vendor = await ApiService.registerVendor(formData);
      if (vendor) {
        onSuccess(vendor);
      } else {
        setError("Registration failed. Username or email might already be taken.");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '24px'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            {step === 1 ? 'Create Account' : 'Business Profile'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={step === 2 ? handleSubmit : (e) => { e.preventDefault(); setStep(2); }} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ background: '#fef2f2', color: '#ef4444', padding: '12px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 500 }}>
              {error}
            </div>
          )}

          {step === 1 ? (
            <>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>First Name</label>
                  <input required name="first_name" value={formData.first_name} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Last Name</label>
                  <input required name="last_name" value={formData.last_name} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Username</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input required name="username" value={formData.username} onChange={handleChange} style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input required type="email" name="email" value={formData.email} onChange={handleChange} style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input required type="password" name="password" value={formData.password} onChange={handleChange} style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} minLength={6} />
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px', marginTop: '8px', display: 'flex', justifyContent: 'center' }}>
                Next: Business Details
              </button>
              
              {onSwitchToLogin && (
                <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.875rem', color: '#64748b' }}>
                  Already have an account?{' '}
                  <button type="button" onClick={onSwitchToLogin} style={{ background: 'none', border: 'none', color: '#0d8a73', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                    Log in here
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Business Name</label>
                <div style={{ position: 'relative' }}>
                  <Store size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input required name="business_name" value={formData.business_name} onChange={handleChange} style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Vendor Type</label>
                  <select name="vendor_type" value={formData.vendor_type} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}>
                    <option value="PLANNER">Event Planner</option>
                    <option value="CATERER">Catering</option>
                    <option value="PHOTOGRAPHER">Photography</option>
                    <option value="DECORATOR">Decoration</option>
                    <option value="SOUND_LIGHTING">Sound & Lighting</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Location / City</label>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input required name="location" value={formData.location} onChange={handleChange} style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Contact Phone</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input required name="phone_number" value={formData.phone_number} onChange={handleChange} style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="+254..." />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Starting Price (KES)</label>
                  <div style={{ position: 'relative' }}>
                    <Tag size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input required type="number" min="0" name="starting_price" value={formData.starting_price} onChange={handleChange} style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Description</label>
                <textarea required name="description" value={formData.description} onChange={handleChange} rows={3} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', resize: 'vertical' }} placeholder="Tell customers about your services..."></textarea>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setStep(1)} className="btn-secondary" style={{ flex: 1, padding: '12px', display: 'flex', justifyContent: 'center' }}>
                  Back
                </button>
                <button type="submit" disabled={loading} className="btn-primary" style={{ flex: 2, padding: '12px', display: 'flex', justifyContent: 'center' }}>
                  {loading ? 'Creating...' : 'Register Vendor Account'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
