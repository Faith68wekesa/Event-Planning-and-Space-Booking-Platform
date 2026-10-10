import React, { useState } from 'react';
import { X, User as UserIcon, Building, Briefcase, ChevronRight } from 'lucide-react';
import { ApiService } from '../services/api.ts';
import type { AuthResponse } from '../types';
import toast from 'react-hot-toast';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (data: AuthResponse) => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess, initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'select_role' | 'verify_email'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [otpCode, setOtpCode] = useState('');

  // Form Data
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone_number: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await ApiService.loginUser({
          email: formData.email,
          password: formData.password,
        });
        if (data && data.user) {
          toast.success("Login successful!");
          onSuccess(data);
        } else {
          toast.error("Invalid credentials.");
        }
      } else if (mode === 'register') {
        const data = await ApiService.registerUser({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          phone_number: formData.phone_number,
        });
        if (data && data.id) {
          setUserId(data.id);
          // Send OTP
          await ApiService.sendOTP(formData.email);
          toast.success("Account created! Verification code sent to your email.");
          setMode('verify_email');
        } else {
          toast.error("Failed to create account.");
        }
      } else if (mode === 'verify_email') {
        const success = await ApiService.verifyOTP(formData.email, otpCode);
        if (success) {
          toast.success("Email verified successfully!");
          setMode('select_role');
        } else {
          toast.error("Invalid or expired verification code.");
        }
      }
    } catch (err) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelection = async (role: 'CUSTOMER' | 'VENDOR' | 'VENUE_OWNER') => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await ApiService.requestRole(userId, role);
      if (data && data.user) {
        toast.success(`Role selected successfully! Please log in to continue.`);
        setMode('login');
      } else {
        toast.error("Failed to select role.");
      }
    } catch (err) {
      toast.error("An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '480px', overflowY: 'auto', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative' }}>
        
        {/* Header */}
        <div style={{ padding: '32px 32px 24px', textAlign: 'center', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={24} />
          </button>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
            {mode === 'login' ? 'Welcome Back!' : mode === 'register' ? 'Create your Event Planning and Space Booking account' : mode === 'verify_email' ? 'Verify your email' : 'How would you like to use Event Planning and Space Booking?'}
          </h2>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.95rem' }}>
            {mode === 'login' ? 'Sign in to your account' : mode === 'register' ? '' : mode === 'verify_email' ? `We've sent a code to ${formData.email}` : 'Select a primary role to get started.'}
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '0 32px 32px' }}>
          {mode === 'select_role' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <RoleOption 
                icon={<UserIcon size={24} color="#0F8F7A" />}
                title="Customer"
                description="Find and book services or venues"
                onClick={() => handleRoleSelection('CUSTOMER')}
                loading={loading}
              />
              <RoleOption 
                icon={<Briefcase size={24} color="#0F8F7A" />}
                title="Vendor"
                description="Offer event services"
                onClick={() => handleRoleSelection('VENDOR')}
                loading={loading}
              />
              <RoleOption 
                icon={<Building size={24} color="#0F8F7A" />}
                title="Venue Owner"
                description="List event spaces"
                onClick={() => handleRoleSelection('VENUE_OWNER')}
                loading={loading}
              />
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {mode === 'verify_email' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px', textAlign: 'center' }}>Verification Code</label>
                  <div>
                    <input 
                      type="text" 
                      required 
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1.25rem', outline: 'none', textAlign: 'center', letterSpacing: '4px', fontWeight: 700 }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  {mode === 'register' && (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Full Name</label>
                        <div style={{ position: 'relative' }}>
                          <input 
                            type="text" 
                            required 
                            value={formData.full_name}
                            onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none' }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Phone Number</label>
                        <div style={{ position: 'relative' }}>
                          <input 
                            type="tel" 
                            required 
                            value={formData.phone_number}
                            onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none' }}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Email Address</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="email" 
                        required 
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="password" 
                        required 
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none' }}
                      />
                    </div>
                  </div>
                </>
              )}

              <button 
                type="submit" 
                disabled={loading}
                style={{ background: '#0F8F7A', color: '#fff', border: 'none', padding: '16px', borderRadius: '12px', fontSize: '1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: '8px', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Please wait...' : mode === 'login' ? 'Login' : mode === 'verify_email' ? 'Verify Email' : 'Next'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button 
                  type="button" 
                  onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                  style={{ background: 'none', border: 'none', color: '#0F8F7A', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {mode === 'login' ? "Don't have an account? Register" : "Already have an account? Log in"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const RoleOption: React.FC<{ icon: React.ReactNode, title: string, description: string, onClick: () => void, loading: boolean }> = ({ icon, title, description, onClick, loading }) => {
  return (
    <button 
      onClick={onClick}
      disabled={loading}
      style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%', padding: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', cursor: loading ? 'not-allowed' : 'pointer', textAlign: 'left', transition: 'all 0.2s ease' }}
    >
      <div style={{ width: '48px', height: '48px', background: '#ccfbf1', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flexGrow: 1 }}>
        <h4 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{title}</h4>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>{description}</p>
      </div>
      <ChevronRight size={20} color="#94a3b8" />
    </button>
  );
};
