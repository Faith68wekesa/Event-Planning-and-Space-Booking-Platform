import React, { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState<'login' | 'forgot-email' | 'forgot-reset'>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!resetEmail) {
      setError('Please enter your email.');
      return;
    }
    setLoading(true);
    try {
      const sent = await ApiService.sendOTP(resetEmail);
      if (sent) {
        setViewMode('forgot-reset');
      } else {
        setError('Failed to send verification code.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (resetOtp.length !== 6) {
      setError('Please enter the 6-digit OTP.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    setLoading(true);
    try {
      const success = await ApiService.resetPassword(resetEmail, resetOtp, newPassword);
      if (success) {
        setViewMode('login');
        setFormData(prev => ({ ...prev, email: resetEmail }));
        setError(null);
        // Optionally show success message, but resetting to login is standard
      } else {
        setError('Password reset failed. Invalid or expired OTP.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setLoading(true);
    try {
      const sent = await ApiService.sendOTP(resetEmail.trim().toLowerCase());
      if (sent) {
        setResendCooldown(30);
        const timer = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setError('Failed to resend verification code.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
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

        {viewMode === 'login' ? (
          <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div style={{ background: '#fef2f2', color: '#ef4444', padding: '12px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 500 }}>
                {error}
              </div>
            )}

            <div>
              <div style={{ position: 'relative' }}>
                <input required type="email" placeholder="Email" name="email" value={formData.email} onChange={handleChange} style={{ width: '100%', boxSizing: 'border-box', padding: '14px 20px', borderRadius: '30px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem' }} />
              </div>
            </div>

            <div>
              <div style={{ position: 'relative' }}>
                <input required type={showPassword ? "text" : "password"} placeholder="Password" name="password" value={formData.password} onChange={handleChange} style={{ width: '100%', boxSizing: 'border-box', padding: '14px 20px', borderRadius: '30px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem' }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <button type="button" onClick={() => setViewMode('forgot-email')} style={{ background: 'none', border: 'none', color: '#0F8F7A', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Forgot password?</button>
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
        ) : viewMode === 'forgot-email' ? (
          <form onSubmit={handleForgotPassword} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#1e293b' }}>Reset Password</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>Enter your email address and we'll send you a verification code.</p>
            {error && (
              <div style={{ background: '#fef2f2', color: '#ef4444', padding: '12px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 500 }}>
                {error}
              </div>
            )}
            <div>
              <input required type="email" placeholder="Email Address" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '14px 20px', borderRadius: '30px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem' }} />
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', marginTop: '8px', display: 'flex', justifyContent: 'center', background: '#0F8F7A', color: '#fff', border: 'none', borderRadius: '30px', fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <button type="button" onClick={() => { setViewMode('login'); setError(null); }} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Back to Login</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#1e293b' }}>Enter Code & New Password</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>We sent a code to <strong>{resetEmail}</strong></p>
            {error && (
              <div style={{ background: '#fef2f2', color: '#ef4444', padding: '12px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 500 }}>
                {error}
              </div>
            )}
            <div>
              <input required type="text" maxLength={6} placeholder="6-digit OTP" value={resetOtp} onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))} style={{ width: '100%', boxSizing: 'border-box', padding: '14px 20px', borderRadius: '30px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '1.1rem', letterSpacing: '0.2em', textAlign: 'center' }} />
            </div>
            <div>
              <div style={{ position: 'relative' }}>
                <input required type={showNewPassword ? "text" : "password"} minLength={8} placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '14px 20px', borderRadius: '30px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem' }} />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', marginTop: '8px', display: 'flex', justifyContent: 'center', background: '#0F8F7A', color: '#fff', border: 'none', borderRadius: '30px', fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                type="button" 
                onClick={handleResendOTP}
                disabled={resendCooldown > 0 || loading}
                style={{ 
                  background: 'none', border: 'none', 
                  color: resendCooldown > 0 ? '#94a3b8' : '#0F8F7A', 
                  fontWeight: 600, cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer', 
                  padding: 0, fontSize: '0.9rem' 
                }}
              >
                {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend Code'}
              </button>
              <button type="button" onClick={() => { setViewMode('login'); setError(null); }} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
