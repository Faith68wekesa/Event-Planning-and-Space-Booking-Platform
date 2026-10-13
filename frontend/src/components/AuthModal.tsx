import React, { useState, useEffect } from 'react';
import { X, User as UserIcon, Building2, ChevronRight, Eye, EyeOff, RotateCw, AlertCircle, ArrowLeft } from 'lucide-react';
import { ApiService } from '../services/api.ts';
import type { AuthResponse } from '../types';
import toast from 'react-hot-toast';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (data: AuthResponse) => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess, initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'select_role' | 'verify_email' | 'forgot_password'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Forgot password state
  const [forgotStep, setForgotStep] = useState<'request_otp' | 'verify_reset'>('request_otp');
  const [newPassword, setNewPassword] = useState('');

  // Form Data
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone_number: '',
  });

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResendOTP = async () => {
    if (resendCooldown > 0 || !formData.email) return;
    setLoading(true);
    try {
      const ok = await ApiService.sendOTP(formData.email);
      if (ok) {
        toast.success("Verification code resent to your email.");
        setResendCooldown(30);
      } else {
        toast.error("Failed to resend code. Please try again.");
      }
    } catch {
      toast.error("Network error while resending code.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorNotice(null);

    try {
      if (mode === 'login') {
        const data = await ApiService.loginUser({
          email: formData.email,
          password: formData.password,
        });
        if (data && data.user) {
          toast.success("Welcome back! Login successful.");
          onSuccess(data);
        } else {
          const msg = data?.error || "Invalid credentials. Please verify your email and password.";
          setErrorNotice(msg);
          toast.error(msg);
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
          setResendCooldown(30);
          toast.success("Account created! Verification code sent to your email.");
          setMode('verify_email');
        } else {
          const msg = data?.error || "Failed to create account. Please check your details.";
          setErrorNotice(msg);
          toast.error(msg);
        }
      } else if (mode === 'verify_email') {
        const success = await ApiService.verifyOTP(formData.email, otpCode);
        if (success) {
          toast.success("Email verified successfully! Choose your role.");
          setMode('select_role');
        } else {
          setErrorNotice("Invalid or expired verification code.");
          toast.error("Invalid or expired verification code.");
        }
      } else if (mode === 'forgot_password') {
        if (forgotStep === 'request_otp') {
          if (!formData.email) {
            setErrorNotice("Please enter your registered email address.");
            return;
          }
          const ok = await ApiService.sendOTP(formData.email);
          if (ok) {
            toast.success("Reset code sent to your email!");
            setForgotStep('verify_reset');
            setResendCooldown(30);
          } else {
            setErrorNotice("Failed to send reset code. Please check your email.");
            toast.error("Failed to send reset code.");
          }
        } else {
          if (!otpCode || !newPassword) {
            setErrorNotice("Please enter both the OTP code and new password.");
            return;
          }
          if (newPassword.length < 8) {
            setErrorNotice("New password must be at least 8 characters long.");
            return;
          }
          const ok = await ApiService.resetPassword(formData.email, otpCode, newPassword);
          if (ok) {
            toast.success("Password reset successfully! You can now log in.");
            setMode('login');
            setFormData(prev => ({ ...prev, password: newPassword }));
            setForgotStep('request_otp');
            setOtpCode('');
            setNewPassword('');
          } else {
            setErrorNotice("Failed to reset password. Please check your OTP code.");
            toast.error("Failed to reset password.");
          }
        }
      }
    } catch {
      setErrorNotice("An unexpected error occurred. Please try again.");
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelection = async (role: 'CUSTOMER' | 'PROVIDER') => {
    if (!userId) return;
    setLoading(true);
    setErrorNotice(null);
    try {
      const data = await ApiService.requestRole(userId, role);
      if (data && data.user) {
        toast.success(`Role selected! Logging you in...`);
        // Log in automatically with stored credentials
        const loginData = await ApiService.loginUser({
          email: formData.email,
          password: formData.password,
        });
        if (loginData && loginData.user) {
          onSuccess(loginData);
        } else {
          setMode('login');
        }
      } else {
        const msg = data?.error || "Failed to select role.";
        setErrorNotice(msg);
        toast.error(msg);
      }
    } catch {
      setErrorNotice("An error occurred configuring your account.");
      toast.error("An error occurred configuring your account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '480px', overflowY: 'auto', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative' }}>
        
        {/* Header */}
        <div style={{ padding: '32px 32px 16px', textAlign: 'center', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={24} />
          </button>

          {mode === 'forgot_password' && (
            <button 
              onClick={() => { setMode('login'); setErrorNotice(null); }} 
              style={{ position: 'absolute', top: '24px', left: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: 600 }}
            >
              <ArrowLeft size={18} /> Back
            </button>
          )}

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#0F8F7A', fontWeight: 800, fontSize: '1.25rem', marginBottom: '8px' }}>
            <span>Locyfy</span>
          </div>

          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
            {mode === 'login' 
              ? 'Welcome Back!' 
              : mode === 'register' 
              ? 'Create your Locyfy account' 
              : mode === 'verify_email' 
              ? 'Check your email' 
              : mode === 'forgot_password'
              ? 'Reset your password'
              : 'How would you like to use Locyfy?'}
          </h2>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.92rem', lineHeight: 1.5 }}>
            {mode === 'login' 
              ? 'Sign in to access your dashboard' 
              : mode === 'register' 
              ? 'Register once to start using Locyfy.' 
              : mode === 'verify_email' 
              ? `We've sent a 6-digit verification code to ${formData.email}` 
              : mode === 'forgot_password'
              ? (forgotStep === 'request_otp' ? 'Enter your email to receive a password reset code' : `Enter the verification code sent to ${formData.email}`)
              : 'Select the role that matches your goals.'}
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '0 32px 32px' }}>
          {/* Error Notice Alert Banner */}
          {errorNotice && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 16px', marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={20} color="#dc2626" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.88rem', color: '#991b1b', fontWeight: 600, lineHeight: 1.4 }}>
                  {errorNotice}
                </span>
              </div>
              {errorNotice.toLowerCase().includes('already exists') && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorNotice(null);
                    }}
                    style={{ background: '#0F8F7A', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Sign In with this email →
                  </button>
                </div>
              )}
              {errorNotice.toLowerCase().includes('no account found') && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setErrorNotice(null);
                    }}
                    style={{ background: '#0F8F7A', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Register with this email →
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === 'select_role' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <RoleOption 
                icon={<UserIcon size={26} color="#0F8F7A" />}
                title="Customer"
                description="Find and book services or venues"
                badge="Book & Enjoy"
                onClick={() => handleRoleSelection('CUSTOMER')}
                loading={loading}
              />
              <RoleOption 
                icon={<Building2 size={26} color="#0F8F7A" />}
                title="Business Provider"
                description="Sell services or list spaces (Vendors & Venue Owners)"
                badge="Spaces & Services"
                onClick={() => handleRoleSelection('PROVIDER')}
                loading={loading}
              />
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {mode === 'verify_email' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px', textAlign: 'center' }}>
                    Enter 6-Digit Verification Code
                  </label>
                  <div>
                    <input 
                      type="text" 
                      required 
                      maxLength={6}
                      placeholder="• • • • • •"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1.4rem', outline: 'none', textAlign: 'center', letterSpacing: '6px', fontWeight: 700 }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || loading}
                      onClick={handleResendOTP}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: resendCooldown > 0 ? '#94a3b8' : '#0F8F7A',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <RotateCw size={14} />
                      {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive code? Resend"}
                    </button>
                  </div>
                </div>
              ) : mode === 'forgot_password' ? (
                <>
                  {forgotStep === 'request_otp' ? (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Registered Email Address</label>
                      <input 
                        type="email" 
                        required 
                        placeholder="name@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none' }}
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>6-Digit OTP Code</label>
                        <input 
                          type="text" 
                          required 
                          maxLength={6}
                          placeholder="123456"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1.1rem', letterSpacing: '4px', textAlign: 'center', fontWeight: 700, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>New Password (min 8 characters)</label>
                        <div style={{ position: 'relative' }}>
                          <input 
                            type={showPassword ? 'text' : 'password'} 
                            required 
                            minLength={8}
                            placeholder="••••••••"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 44px 12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none' }}
                          />
                          <button 
                            type="button" 
                            onClick={() => setShowPassword(!showPassword)}
                            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', padding: 0 }}
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  {mode === 'register' && (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Full Name</label>
                        <input 
                          type="text" 
                          required 
                          placeholder="e.g. Faith Mwangi"
                          value={formData.full_name}
                          onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Phone Number (Optional)</label>
                        <input 
                          type="tel" 
                          placeholder="+254 700 000 000"
                          value={formData.phone_number}
                          onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none' }}
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Email Address</label>
                    <input 
                      type="email" 
                      required 
                      placeholder="name@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>Password</label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => { setMode('forgot_password'); setErrorNotice(null); }}
                          style={{ background: 'none', border: 'none', color: '#0F8F7A', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        required 
                        minLength={6}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 44px 12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none' }}
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', padding: 0 }}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <button 
                type="submit" 
                disabled={loading}
                style={{ background: '#0F8F7A', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: '6px', opacity: loading ? 0.7 : 1, transition: 'all 0.2s' }}
              >
                {loading 
                  ? 'Please wait...' 
                  : mode === 'login' 
                  ? 'Log In' 
                  : mode === 'verify_email' 
                  ? 'Continue' 
                  : mode === 'forgot_password'
                  ? (forgotStep === 'request_otp' ? 'Send Reset Code' : 'Reset Password')
                  : 'Next'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login');
                    setErrorNotice(null);
                  }}
                  style={{ background: 'none', border: 'none', color: '#0F8F7A', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}
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

const RoleOption: React.FC<{ icon: React.ReactNode, title: string, description: string, badge?: string, onClick: () => void, loading: boolean }> = ({ icon, title, description, badge, onClick, loading }) => {
  return (
    <button 
      onClick={onClick}
      disabled={loading}
      style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%', padding: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', cursor: loading ? 'not-allowed' : 'pointer', textAlign: 'left', transition: 'all 0.2s ease', position: 'relative' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0F8F7A'; e.currentTarget.style.background = '#f0fdfa'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; }}
    >
      <div style={{ width: '52px', height: '52px', background: '#ccfbf1', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flexGrow: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>{title}</h4>
          {badge && (
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0F8F7A', background: '#e6f7f3', padding: '2px 8px', borderRadius: '999px' }}>
              {badge}
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b', lineHeight: 1.4 }}>{description}</p>
      </div>
      <ChevronRight size={22} color="#0F8F7A" />
    </button>
  );
};
