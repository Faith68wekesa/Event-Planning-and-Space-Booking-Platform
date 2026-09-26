import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ApiService } from '../services/api.ts';
import type { User as UserType } from '../types';

interface CustomerLoginProps {
  onClose: () => void;
  onSuccess: (user: UserType) => void;
  onSwitchToRegister: () => void;
}

export const CustomerLogin: React.FC<CustomerLoginProps> = ({ onClose, onSuccess, onSwitchToRegister }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await ApiService.loginCustomer(formData);
      if (user) {
        onSuccess(user);
      } else {
        setError("Invalid email or password.");
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
        maxWidth: '400px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0d8a73', padding: '0', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
              Event Planning and SpaceBooking
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
              Login
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', alignSelf: 'flex-start' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ background: '#fef2f2', color: '#ef4444', padding: '12px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 500 }}>
              {error}
            </div>
          )}

          <div>
            <div style={{ position: 'relative' }}>
              <input required type="email" name="email" value={formData.email} onChange={handleChange} style={{ width: '100%', boxSizing: 'border-box', padding: '14px 20px', borderRadius: '30px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem' }} />
            </div>
          </div>

          <div>
            <div style={{ position: 'relative' }}>
              <input required type="password" name="password" value={formData.password} onChange={handleChange} style={{ width: '100%', boxSizing: 'border-box', padding: '14px 20px', borderRadius: '30px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem' }} />
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <a href="#" style={{ color: '#0F8F7A', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>Forgot password?</a>
          </div>

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', marginTop: '8px', display: 'flex', justifyContent: 'center', background: '#0F8F7A', color: '#fff', border: 'none', borderRadius: '30px', fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Logging in...' : 'Sign in'}
          </button>

          <div style={{ marginTop: '16px', fontSize: '0.9rem', color: '#334155' }}>
            Don't have an account ?{' '}
            <button type="button" onClick={onSwitchToRegister} style={{ background: 'none', border: 'none', color: '#0F8F7A', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
              Register Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
