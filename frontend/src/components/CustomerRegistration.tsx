import React, { useState } from 'react';
import {
  X, Mail, Phone, Lock, User,
  ArrowRight, Sparkles
} from 'lucide-react';
import { ApiService } from '../services/api.ts';
import type { User as UserType } from '../types';

interface CustomerRegistrationProps {
  onClose: () => void;
  onSuccess?: (user: UserType) => void;
  onSwitchToLogin?: () => void;
}

export const CustomerRegistration: React.FC<CustomerRegistrationProps> = ({
  onClose,
  onSuccess,
  onSwitchToLogin,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.full_name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!formData.phone_number.trim()) {
      setError('Please enter your contact phone number.');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const user = await ApiService.registerCustomer(formData);
      if (user) {
        setIsSuccess(true);
        onSuccess?.(user);
      } else {
        setError('Registration failed. This email may already be registered.');
      }
    } catch (err) {
      setError('An unexpected network error occurred. Please try again.');
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
        padding: '20px',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(226, 232, 240, 0.8)',
        }}
      >
        <div
          style={{
            padding: '24px 28px',
            borderBottom: '1px solid #f1f5f9',
            background: 'linear-gradient(135deg, #0d8a73 0%, #065f54 100%)',
            color: '#fff',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            position: 'relative',
          }}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <X size={18} />
          </button>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px' }}>
            <Sparkles size={13} /> Customer Portal
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
            Create an Account
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: '#e2e8f0' }}>
            Join to browse and book premium event spaces and services in Kenya.
          </p>
        </div>

        {isSuccess ? (
          <div style={{ padding: '40px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.25)' }}>
              🎉
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: '4px 0 0' }}>
              Account Created!
            </h3>
            <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.6, maxWidth: '440px', margin: 0 }}>
              Your account has been successfully created. You can now log in to proceed with booking venues and services.
            </p>
            <div style={{ width: '100%', maxWidth: '440px', marginTop: '12px' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (onSwitchToLogin) onSwitchToLogin();
                  else onClose();
                }}
                style={{
                  width: '100%', padding: '14px', borderRadius: '10px', fontSize: '1rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(13, 138, 115, 0.3)'
                }}
              >
                Go to Login <ArrowRight size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '24px 28px' }}>
            {error && (
              <div
                style={{
                  background: '#fef2f2',
                  color: '#dc2626',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  border: '1px solid #fecaca',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Full Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Full Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    required
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    placeholder="e.g. David Mwangi"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px 11px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Email Address <span style={{ color: '#ef4444' }}>*</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400, marginLeft: '6px' }}>(Used for login)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    required
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="e.g. david@example.com"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px 11px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Phone Number <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    required
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    placeholder="+254 712 345 678"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px 11px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Password <span style={{ color: '#ef4444' }}>*</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400, marginLeft: '6px' }}>Min. 8 characters</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    required
                    type="password"
                    name="password"
                    minLength={8}
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px 11px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '8px' }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? 'Creating Account...' : 'Create Account'} <ArrowRight size={16} />
                </button>
              </div>

              {onSwitchToLogin && (
                <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '0.875rem', color: '#64748b' }}>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={onSwitchToLogin}
                    style={{ background: 'none', border: 'none', color: '#0d8a73', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  >
                    Login
                  </button>
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
