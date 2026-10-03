import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import './Login.css';

export function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register, isAuthenticated } = useAuth();

  // Read ?ref= or ?referral= or ?sponsor= from query string
  const refFromUrl = (
    searchParams.get('ref') ||
    searchParams.get('referral') ||
    searchParams.get('sponsor') ||
    ''
  ).trim();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    referralCode: refFromUrl || 'KV-1001',
  });

  const [hasUrlRef, setHasUrlRef] = useState(Boolean(refFromUrl));
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState(null);
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(false);
  const [successData, setSuccessData] = useState(null);

  // Sync referral code if URL query parameter changes or arrives
  useEffect(() => {
    if (refFromUrl) {
      setFormData((prev) => ({ ...prev, referralCode: refFromUrl }));
      setHasUrlRef(true);
    }
  }, [refFromUrl]);

  // If already authenticated and not in middle of showing success, navigate straight to dashboard
  useEffect(() => {
    if (isAuthenticated && !successData) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, successData, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear field-level error as user types
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
    if (generalError) {
      setGeneralError(null);
      setIsDuplicateEmail(false);
    }
  };

  const validateForm = () => {
    const errors = {};

    // Full Name
    if (!formData.fullName.trim()) {
      errors.fullName = 'Full Name is required.';
    } else if (formData.fullName.trim().length < 2) {
      errors.fullName = 'Full Name must be at least 2 characters.';
    }

    // Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!emailRegex.test(formData.email.trim())) {
      errors.email = 'Please provide a valid email address.';
    }

    // Phone (optional or valid length)
    if (formData.phone.trim() && formData.phone.trim().length < 7) {
      errors.phone = 'Please enter a valid phone number (at least 7 digits).';
    }

    // Password
    if (!formData.password) {
      errors.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    } else if (
      !/[A-Z]/.test(formData.password) ||
      !/[a-z]/.test(formData.password) ||
      !/[0-9]/.test(formData.password) ||
      !/[^A-Za-z0-9]/.test(formData.password)
    ) {
      errors.password =
        'Password must include uppercase, lowercase, number, and special character (e.g. Password@123).';
    }

    // Confirm Password
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Confirm Password is required.';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent duplicate submissions while in-flight
    if (loading) return;

    setGeneralError(null);
    setIsDuplicateEmail(false);

    // Client-side validation
    const clientErrors = validateForm();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setGeneralError('Please correct the highlighted fields before submitting.');
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const payload = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || undefined,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        referralCode: formData.referralCode.trim() || 'KV-1001',
        sponsorId: formData.referralCode.trim() || 'KV-1001',
      };

      const res = await register(payload);

      const registeredUser = res?.user || res?.data?.user;
      setSuccessData({
        name: registeredUser?.fullName || formData.fullName.trim(),
        referralCode:
          registeredUser?.referralCode ||
          registeredUser?.distributorCode ||
          registeredUser?.memberId ||
          'DST-SUCCESS',
        userId: registeredUser?.userId || registeredUser?.id,
      });

      // Brief transition period to let the user see their generated referral code
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1500);
    } catch (err) {
      console.error('[Register] Submission error:', err);

      const status = err?.status || err?.response?.status;
      const message = err?.message || err?.response?.data?.message || '';
      const code = err?.code || err?.response?.data?.code || '';

      if (
        status === 409 ||
        code === 'AUTH_EMAIL_ALREADY_EXISTS' ||
        /email.*already exists/i.test(message)
      ) {
        setIsDuplicateEmail(true);
        setGeneralError('An account with this email address already exists.');
        setFieldErrors((prev) => ({ ...prev, email: 'Email already registered' }));
      } else if (code === 'AUTH_PHONE_ALREADY_EXISTS' || /phone.*already exists/i.test(message)) {
        setGeneralError('This phone number is already registered with another account.');
        setFieldErrors((prev) => ({ ...prev, phone: 'Phone already in use' }));
      } else if (
        status === 404 ||
        code === 'AUTH_INVALID_REFERRAL_CODE' ||
        /referral code.*not found/i.test(message)
      ) {
        setGeneralError(
          'The referral code is invalid or the sponsor account was not found. Please verify the code or use default KV-1001.'
        );
        setFieldErrors((prev) => ({ ...prev, referralCode: 'Sponsor not found' }));
      } else if (code === 'AUTH_PASSWORD_MISMATCH' || /passwords do not match/i.test(message)) {
        setGeneralError('Passwords do not match. Please verify both password fields.');
        setFieldErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      } else if (code === 'AUTH_WEAK_PASSWORD' || /password must contain/i.test(message)) {
        setGeneralError(message || 'Password must include uppercase, lowercase, number, and special character.');
        setFieldErrors((prev) => ({ ...prev, password: message || 'Weak password' }));
      } else if (err?.isNetworkError || /network|failed to fetch|cannot reach/i.test(message)) {
        setGeneralError(
          'Network error: Unable to reach the server. Please verify that your backend server is running and accessible.'
        );
      } else {
        setGeneralError(message || 'Registration failed. Please check your details and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card" style={{ maxWidth: '520px' }}>
        <div className="auth-header">
          <div className="auth-logo-badge">
            <span className="logo-initials">KV</span>
          </div>
          <h1 className="auth-title">Create Distributor Account</h1>
          <p className="auth-subtitle">
            Join the Kashvi MLM network and start growing your business
          </p>
        </div>

        {/* Success Alert */}
        {successData && (
          <div className="auth-alert success-alert" role="status">
            <CheckCircle2 size={20} className="alert-icon" />
            <div>
              <div style={{ fontWeight: 600 }}>Registration Successful!</div>
              <div>
                Welcome, {successData.name}! Your Referral Code is{' '}
                <strong>{successData.referralCode}</strong>.
              </div>
              <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.9 }}>
                Redirecting to your dashboard...
              </div>
            </div>
          </div>
        )}

        {/* General / API Error Alert */}
        {generalError && !successData && (
          <div className="auth-alert error-alert" role="alert">
            <AlertCircle size={20} className="alert-icon" />
            <div style={{ flex: 1 }}>
              <div>{generalError}</div>
              {isDuplicateEmail && (
                <div style={{ marginTop: '6px' }}>
                  <Link
                    to="/login"
                    style={{
                      color: '#b91c1c',
                      fontWeight: 600,
                      textDecoration: 'underline',
                    }}
                  >
                    Click here to sign in to your existing account &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {/* Full Name */}
          <div className="form-group">
            <label htmlFor="fullName">Full Name *</label>
            <div className="input-wrapper">
              <User size={18} className="input-icon" />
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                placeholder="e.g. Vikramaditya Rathore"
                value={formData.fullName}
                onChange={handleChange}
                disabled={loading || Boolean(successData)}
                style={fieldErrors.fullName ? { borderColor: '#ef4444' } : {}}
              />
            </div>
            {fieldErrors.fullName && (
              <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '2px' }}>
                {fieldErrors.fullName}
              </span>
            )}
          </div>

          {/* Email Address */}
          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
                disabled={loading || Boolean(successData)}
                style={fieldErrors.email ? { borderColor: '#ef4444' } : {}}
              />
            </div>
            {fieldErrors.email && (
              <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '2px' }}>
                {fieldErrors.email}
              </span>
            )}
          </div>

          {/* Phone Number */}
          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <div className="input-wrapper">
              <Phone size={18} className="input-icon" />
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+91 9876543210"
                value={formData.phone}
                onChange={handleChange}
                disabled={loading || Boolean(successData)}
                style={fieldErrors.phone ? { borderColor: '#ef4444' } : {}}
              />
            </div>
            {fieldErrors.phone && (
              <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '2px' }}>
                {fieldErrors.phone}
              </span>
            )}
          </div>

          {/* Referral Code (Auto-populated from ?ref=) */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="referralCode">Referral Code *</label>
              {hasUrlRef && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    color: '#2563eb',
                    background: '#eff6ff',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: 600,
                  }}
                >
                  <Sparkles size={12} /> Applied from referral link
                </span>
              )}
            </div>
            <div className="input-wrapper">
              <UserCheck size={18} className="input-icon" />
              <input
                id="referralCode"
                name="referralCode"
                type="text"
                required
                placeholder="KV-1001 (Root Sponsor) or Sponsor Code"
                value={formData.referralCode}
                onChange={handleChange}
                disabled={loading || Boolean(successData)}
                style={fieldErrors.referralCode ? { borderColor: '#ef4444' } : {}}
              />
            </div>
            {fieldErrors.referralCode && (
              <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '2px' }}>
                {fieldErrors.referralCode}
              </span>
            )}
          </div>

          {/* Password & Confirm Password Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* Password */}
            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Min 8 chars"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={loading || Boolean(successData)}
                  style={fieldErrors.password ? { borderColor: '#ef4444' } : {}}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password && (
                <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '2px' }}>
                  {fieldErrors.password}
                </span>
              )}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={loading || Boolean(successData)}
                  style={fieldErrors.confirmPassword ? { borderColor: '#ef4444' } : {}}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '2px' }}>
                  {fieldErrors.confirmPassword}
                </span>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="submit-auth-btn"
            disabled={loading || Boolean(successData)}
            style={{ marginTop: '8px' }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Register as Distributor</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Footer Login Link */}
        <div className="auth-footer" style={{ marginTop: '24px' }}>
          <p>
            Already an enrolled distributor?{' '}
            <Link to="/login" className="auth-link">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
