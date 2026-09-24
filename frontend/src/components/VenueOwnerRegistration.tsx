import React, { useState } from 'react';
import {
  X, Mail, Phone, Lock, MapPin, User, Globe,
  Clock, ArrowRight, ArrowLeft, Upload, Building2, Info
} from 'lucide-react';
import { ApiService } from '../services/api';

interface VenueOwnerRegistrationProps {
  onClose: () => void;
  onSwitchToLogin?: () => void;
}

const VENUE_BUSINESS_TYPES = [
  'Hotel',
  'Conference Centre',
  'Event Hall',
  'Wedding Venue',
  'Garden',
  'Restaurant',
  'Outdoor Space',
  'Community Centre',
  'Beach Venue',
  'Resort',
  'Private Estate',
  'Other'
];

export const VenueOwnerRegistration: React.FC<VenueOwnerRegistrationProps> = ({
  onClose,
  onSwitchToLogin,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    // Section A - Personal Account Information
    full_name: '',
    email: '',
    phone_number: '',
    password: '',
    confirm_password: '',

    // Section B - Business Information
    business_name: '',
    business_type: 'Hotel',
    other_business_type: '',
    location: 'Nyeri',
    address: '',
    description: '',
    years_in_business: '',
    website_url: '',
    logo_url: '',
    agreed_to_terms: false,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logo_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Step 1 Validation
  const validateStep1 = () => {
    setError(null);
    if (!formData.full_name.trim()) {
      setError('Please enter your full name.');
      return false;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (!formData.phone_number.trim()) {
      setError('Please enter your contact phone number.');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return false;
    }
    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match. Please verify.');
      return false;
    }
    return true;
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep1()) {
      setStep(2);
    }
  };

  // Step 2 Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.business_name.trim()) {
      setError('Please enter your business or company name.');
      return;
    }
    if (formData.business_type === 'Other' && !formData.other_business_type.trim()) {
      setError('Please specify your custom venue type.');
      return;
    }
    if (!formData.location.trim()) {
      setError('Please specify your town or city.');
      return;
    }
    if (!formData.address.trim()) {
      setError('Please enter your physical property/business address.');
      return;
    }
    if (!formData.description.trim()) {
      setError('Please provide a short description of your business.');
      return;
    }
    if (!formData.agreed_to_terms) {
      setError('You must agree to the Terms and Conditions to register.');
      return;
    }

    setLoading(true);

    try {
      const sent = await ApiService.sendOTP(formData.email.trim().toLowerCase());
      if (sent) {
        setStep(3); // Go to OTP step
      } else {
        setError('Failed to send verification code. Please check your email and try again.');
      }
    } catch (err) {
      setError('An unexpected network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (otpCode.length !== 6) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    setLoading(true);

    try {
      const verified = await ApiService.verifyOTP(formData.email.trim().toLowerCase(), otpCode);
      if (!verified) {
        setError('Invalid or expired verification code.');
        setLoading(false);
        return;
      }

      const finalBusinessType =
        formData.business_type === 'Other'
          ? formData.other_business_type.trim()
          : formData.business_type;

      const payload = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone_number: formData.phone_number.trim(),
        password: formData.password,
        business_name: formData.business_name.trim(),
        business_type: finalBusinessType,
        location: formData.location.trim(),
        address: formData.address.trim(),
        description: formData.description.trim(),
        years_in_business: formData.years_in_business ? parseInt(formData.years_in_business) : undefined,
        website_url: formData.website_url.trim() || undefined,
        logo_url: formData.logo_url || undefined,
      };

      const owner = await ApiService.registerVenueOwner(payload);
      if (owner) {
        setIsSuccess(true);
        // Do not call onSuccess(owner) here to avoid auto-login
      } else {
        setError('Registration failed. This email or username may already be registered.');
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
        className="hide-scrollbar"
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '580px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          border: '2px solid #0d8a73',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 28px',
            borderBottom: '1px solid #f1f5f9',
            background: '#ffffff',
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
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <X size={18} />
          </button>

          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0d8a73', margin: 0 }}>Event Planning and SpaceBooking</h3>
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Create Venue Owner Account
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            List and manage premier conference halls, gardens, and event spaces across Kenya.
          </p>

          {!isSuccess && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
              <div
                style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: step >= 1 ? '#ffffff' : 'rgba(255, 255, 255, 0.3)',
                  transition: 'background 0.3s',
                }}
              />
              <div
                style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: step >= 2 ? '#ffffff' : 'rgba(255, 255, 255, 0.3)',
                  transition: 'background 0.3s',
                }}
              />
              <div
                style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: step >= 3 ? '#ffffff' : 'rgba(255, 255, 255, 0.3)',
                  transition: 'background 0.3s',
                }}
              />
            </div>
          )}
        </div>

        {/* Content Body */}
        {isSuccess ? (
          /* Post-Registration Pending Verification Screen */
          <div
            style={{
              padding: '40px 32px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                background: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.25)',
              }}
            >
              🎉
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fef3c7', color: '#b45309', padding: '4px 12px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
              <Clock size={13} /> Status: Pending Admin Verification
            </div>

            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: '4px 0 0' }}>
              Registration Successful! 🎉
            </h3>

            <p
              style={{
                color: '#475569',
                fontSize: '0.95rem',
                lineHeight: 1.6,
                maxWidth: '440px',
                margin: 0,
              }}
            >
              Your venue owner account has been created and is currently <strong>pending verification</strong>. An administrator will review your information before your business is listed as verified.
            </p>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                width: '100%',
                maxWidth: '440px',
                textAlign: 'left',
                fontSize: '0.85rem',
                color: '#334155',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Business / Venue:</span>
                <span style={{ fontWeight: 600 }}>{formData.business_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Venue Type:</span>
                <span style={{ fontWeight: 600 }}>
                  {formData.business_type === 'Other' ? formData.other_business_type : formData.business_type}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Location:</span>
                <span style={{ fontWeight: 600 }}>{formData.location}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Login Email:</span>
                <span style={{ fontWeight: 600 }}>{formData.email}</span>
              </div>
            </div>

            <div style={{ width: '100%', maxWidth: '440px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (onSwitchToLogin) {
                    onSwitchToLogin();
                  } else {
                    onClose();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '10px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(13, 138, 115, 0.3)',
                }}
              >
                Go to Venue Owner Login <ArrowRight size={18} />
              </button>
            </div>
          </div>
        ) : (
          /* Form Body */
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

            {step === 1 ? (
              /* Section A — Personal Account Information */
              <form onSubmit={handleNextStep} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '4px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                    Section A — Personal Account Information
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0' }}>
                    Owner/representative credentials for your venue management account.
                  </p>
                </div>

                {/* Full Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Full Name <span style={{ color: '#ef4444' }}>*</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400, marginLeft: '6px' }}>(Owner/representative name)</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      required
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleChange}
                      placeholder="e.g. Grace Nyawira"
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
                      placeholder="e.g. grace@aberdaresgardens.com"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px 11px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
                    />
                  </div>
                </div>

                {/* Phone Number */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Phone Number <span style={{ color: '#ef4444' }}>*</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400, marginLeft: '6px' }}>(Contact number)</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      required
                      type="tel"
                      name="phone_number"
                      value={formData.phone_number}
                      onChange={handleChange}
                      placeholder="+254 722 000 111"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px 11px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
                    />
                  </div>
                </div>

                {/* Password & Confirm Password */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Password <span style={{ color: '#ef4444' }}>*</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400, display: 'block' }}>Min. 8 characters</span>
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

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Confirm Password <span style={{ color: '#ef4444' }}>*</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400, display: 'block' }}>Must match</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        required
                        type="password"
                        name="confirm_password"
                        minLength={8}
                        value={formData.confirm_password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px 11px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '8px' }}>
                  <button
                    type="submit"
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
                    }}
                  >
                    Next: Business Information <ArrowRight size={16} />
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
            ) : step === 2 ? (
              /* Section B — Business Information */
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                    Section B — Business Information
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0' }}>
                    Company and property brand information for verification.
                  </p>
                </div>

                {/* Helpful separation notice */}
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    fontSize: '0.8rem',
                    color: '#166534',
                  }}
                >
                  <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Streamlined Account Setup:</strong> Individual venue details (capacity, pricing per day, amenities, and photo galleries) are managed directly from your Venue Owner Dashboard after registration.
                  </div>
                </div>

                {/* Business Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Business Name <span style={{ color: '#ef4444' }}>*</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400, marginLeft: '6px' }}>(Company / Venue business name)</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Building2 size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      required
                      type="text"
                      name="business_name"
                      value={formData.business_name}
                      onChange={handleChange}
                      placeholder="e.g. Aberdare Luxury Gardens Ltd"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
                    />
                  </div>
                </div>

                {/* Business Type dropdown & Location */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Business Type <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      name="business_type"
                      value={formData.business_type}
                      onChange={handleChange}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff', fontSize: '0.9rem' }}
                    >
                      {VENUE_BUSINESS_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Location <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <MapPin size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        required
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        placeholder="e.g. Nyeri, Karen, Naivasha"
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
                      />
                    </div>
                  </div>
                </div>

                {/* If Other is selected: Specify Venue Type */}
                {formData.business_type === 'Other' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0d8a73', marginBottom: '6px' }}>
                      Specify Venue Type <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      required
                      type="text"
                      name="other_business_type"
                      value={formData.other_business_type}
                      onChange={handleChange}
                      placeholder="e.g. Rooftop Terrace, Historic Manor"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #0d8a73', outline: 'none', fontSize: '0.9rem' }}
                    />
                  </div>
                )}

                {/* Business Address */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Business Address <span style={{ color: '#ef4444' }}>*</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400, marginLeft: '6px' }}>(Specific physical address)</span>
                  </label>
                  <input
                    required
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="e.g. Off Nyeri-Nanyuki Road, King'ong'o Area"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
                  />
                </div>

                {/* Business Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Business Description <span style={{ color: '#ef4444' }}>*</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400, marginLeft: '6px' }}>(Description of business)</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Describe your property, facilities, atmosphere, and hosting capabilities..."
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', resize: 'vertical' }}
                  />
                </div>

                {/* Years in Business & Website URL */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Years in Business <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      name="years_in_business"
                      value={formData.years_in_business}
                      onChange={handleChange}
                      placeholder="e.g. 5"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Business Website <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Globe size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="url"
                        name="website_url"
                        value={formData.website_url}
                        onChange={handleChange}
                        placeholder="https://..."
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Business Logo */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Business Logo <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        color: '#334155',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <Upload size={15} /> Upload File
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <input
                      type="url"
                      name="logo_url"
                      value={formData.logo_url}
                      onChange={handleChange}
                      placeholder="or paste logo image URL"
                      style={{ flex: 1, boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.85rem' }}
                    />
                    {formData.logo_url && (
                      <img
                        src={formData.logo_url}
                        alt="Logo Preview"
                        style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #cbd5e1' }}
                      />
                    )}
                  </div>
                </div>

                {/* Terms and Conditions */}
                <div style={{ marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      name="agreed_to_terms"
                      checked={formData.agreed_to_terms}
                      onChange={handleChange}
                      style={{ width: '16px', height: '16px', accentColor: '#0d8a73', cursor: 'pointer' }}
                    />
                    <span>
                      I agree to the <strong style={{ color: '#0d8a73' }}>Terms and Conditions</strong> and venue hosting guidelines
                    </span>
                  </label>
                </div>

                {/* Actions */}
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
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <ArrowLeft size={16} /> Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                    style={{
                      flex: 2,
                      padding: '12px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loading ? 'Creating Venue Owner Account...' : 'Create Venue Owner Account'}
                  </button>
                </div>

                {onSwitchToLogin && (
                  <div style={{ textAlign: 'center', marginTop: '4px', fontSize: '0.875rem', color: '#64748b' }}>
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
            ) : step === 3 ? (
              /* Section C — OTP Verification */
              <div style={{ padding: '8px 0' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ display: 'inline-flex', padding: '16px', background: '#f8fafc', borderRadius: '50%', marginBottom: '16px' }}>
                    <Mail size={32} color="#0d8a73" />
                  </div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: '#0f172a' }}>Verify Your Email</h3>
                  <p style={{ margin: 0, color: '#475569', fontSize: '0.9rem' }}>
                    We've sent a 6-digit verification code to <strong>{formData.email}</strong>. Please enter it below.
                  </p>
                </div>
                <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <input
                      required
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '8px', border: '2px solid #cbd5e1', outline: 'none', fontSize: '1.5rem', textAlign: 'center', letterSpacing: '0.5em', fontWeight: 700, color: '#1e293b' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      style={{
                        flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                      }}
                    >
                      <ArrowLeft size={16} /> Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary"
                      style={{ flex: 2, padding: '12px', borderRadius: '8px', fontSize: '1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
                    >
                      {loading ? 'Verifying...' : 'Verify & Complete'}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
