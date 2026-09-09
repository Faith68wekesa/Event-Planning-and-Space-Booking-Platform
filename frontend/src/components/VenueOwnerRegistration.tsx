import React, { useState } from 'react';
import { X, Building2, Mail, Phone, Lock, MapPin, User, CheckCircle2 } from 'lucide-react';
import { ApiService } from '../services/api.ts';
import type { VenueOwner } from '../types';

interface VenueOwnerRegistrationProps {
  onClose: () => void;
  onSuccess: (owner: VenueOwner) => void;
  onSwitchToLogin?: () => void;
}

export const VenueOwnerRegistration: React.FC<VenueOwnerRegistrationProps> = ({
  onClose,
  onSuccess,
  onSwitchToLogin,
}) => {
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
    location: '',
    phone_number: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const owner = await ApiService.registerVenueOwner(formData);
      if (owner) {
        onSuccess(owner);
      } else {
        setError('Registration failed. Username or email may already be taken.');
      }
    } catch (err) {
      setError('An unexpected error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #065f54 0%, #0d8a73 100%)',
            color: '#fff',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              {step === 1 ? 'Venue Owner Registration' : 'Event Space & Business Details'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#e2e8f0' }}>
              Step {step} of 2: {step === 1 ? 'Personal & Login Credentials' : 'Property / Brand Information'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={step === 2 ? handleSubmit : (e) => { e.preventDefault(); setStep(2); }}
          style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          {error && (
            <div
              style={{
                background: '#fef2f2',
                color: '#ef4444',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 500,
                border: '1px solid #fecaca',
              }}
            >
              {error}
            </div>
          )}

          {step === 1 ? (
            <>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    First Name
                  </label>
                  <input
                    required
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                    placeholder="e.g. Karen"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Last Name
                  </label>
                  <input
                    required
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                    placeholder="e.g. Wanjiku"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Username
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    required
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                    placeholder="Unique username"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    required
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    required
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: '10px', display: 'flex', justifyContent: 'center', fontWeight: 700 }}
              >
                Next: Business Details &rarr;
              </button>
            </>
          ) : (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Venue Business / Brand Name
                </label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    required
                    name="business_name"
                    value={formData.business_name}
                    onChange={handleChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                    placeholder="e.g. Karen Oasis Spaces Ltd"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Contact Phone Number
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    required
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                    placeholder="+254 712 345 678"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Primary Location / City
                </label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    required
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                    placeholder="e.g. Karen, Nairobi"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#475569',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  &larr; Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{
                    flex: 2,
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontWeight: 700,
                  }}
                >
                  {loading ? 'Creating Account...' : (
                    <>
                      <CheckCircle2 size={18} /> Complete Registration
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {onSwitchToLogin && (
            <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.875rem', color: '#64748b' }}>
              Already registered?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                style={{ background: 'none', border: 'none', color: '#0d8a73', fontWeight: 700, cursor: 'pointer', padding: 0 }}
              >
                Log in here
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
