import React, { useState } from 'react';
import { X, Lock, User, Building2 } from 'lucide-react';
import { ApiService } from '../services/api.ts';
import type { VenueOwner } from '../types';

interface VenueOwnerLoginProps {
  onClose: () => void;
  onSuccess: (owner: VenueOwner) => void;
  onSwitchToRegister: () => void;
}

export const VenueOwnerLogin: React.FC<VenueOwnerLoginProps> = ({
  onClose,
  onSuccess,
  onSwitchToRegister,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
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
      const owner = await ApiService.loginVenueOwner(formData);
      if (owner) {
        onSuccess(owner);
      } else {
        setError('Invalid username or password, or account is not registered as a venue owner.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please check your connection.');
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
          maxWidth: '420px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #065f54 0%, #0d8a73 100%)',
            color: '#fff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '8px',
                borderRadius: '10px',
                display: 'flex',
              }}
            >
              <Building2 size={22} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#fff' }}>
                Venue Owner Login
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#e2e8f0' }}>
                Manage your event spaces & bookings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
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

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <User
                size={16}
                color="#94a3b8"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <input
                required
                name="username"
                value={formData.username}
                onChange={handleChange}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 10px 10px 36px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  fontSize: '0.95rem',
                }}
                placeholder="e.g. oasis_owner"
              />
            </div>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                color="#94a3b8"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <input
                required
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 10px 10px 36px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  fontSize: '0.95rem',
                }}
                placeholder="••••••••"
              />
            </div>
          </div>

          <div
            style={{
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '0.8rem',
              color: '#64748b',
            }}
          >
            💡 <strong>Demo Account:</strong> username: <code style={{ color: '#0d8a73' }}>oasis_owner</code> | password: <code style={{ color: '#0d8a73' }}>password123</code>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              marginTop: '4px',
              display: 'flex',
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            {loading ? 'Logging in...' : 'Log In to Venue Dashboard'}
          </button>

          <div
            style={{
              textAlign: 'center',
              marginTop: '8px',
              fontSize: '0.875rem',
              color: '#64748b',
            }}
          >
            Don't have a venue owner account?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              style={{
                background: 'none',
                border: 'none',
                color: '#0d8a73',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Register here
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
