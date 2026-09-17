import React, { useState } from 'react';
import { X, Lock, Mail, Sparkles } from 'lucide-react';
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
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#e6f7f3', color: '#0d8a73', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px' }}>
              <Sparkles size={13} /> Customer Portal
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
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input required type="email" name="email" value={formData.email} onChange={handleChange} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="e.g. david@example.com" />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input required type="password" name="password" value={formData.password} onChange={handleChange} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="••••••••" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '12px', marginTop: '8px', display: 'flex', justifyContent: 'center' }}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.875rem', color: '#64748b' }}>
            Don't have a customer account?{' '}
            <button type="button" onClick={onSwitchToRegister} style={{ background: 'none', border: 'none', color: '#0d8a73', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
              Register here
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
