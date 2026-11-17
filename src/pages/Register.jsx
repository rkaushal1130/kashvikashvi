import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { authApi } from '../api/authApi.js';
import {
  sendOtpToMobile,
  resendOtp,
  verifyOtpCode,
  isValidIndianMobile,
  initMsg91Widget,
} from '../services/msg91Service.js';
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
  ShieldCheck,
} from 'lucide-react';
import './Login.css';

export function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register, isAuthenticated } = useAuth();

  // Read ?ref= or ?referral= or ?sponsor= from query string or storage cache
  const refFromUrl = (
    searchParams.get('ref') ||
    searchParams.get('referral') ||
    searchParams.get('sponsor') ||
    ''
  ).trim();

  const storedRef = (() => {
    try {
      return (
        sessionStorage.getItem('kashvi_referral_sponsor') ||
        localStorage.getItem('kashvi_referral_sponsor') ||
        ''
      ).trim();
    } catch {
      return '';
    }
  })();

  const initialRef = refFromUrl || '';

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    referralCode: initialRef,
  });

  const [hasUrlRef, setHasUrlRef] = useState(Boolean(refFromUrl));
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState(null);
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(false);
  const [successData, setSuccessData] = useState(null);

  // MSG91 OTP Verification State (Widget: SecureOTPWidget4R29)
  const [otpState, setOtpState] = useState({
    sent: false,
    sending: false,
    verifying: false,
    verified: false,
    verifiedPhone: '',
    verificationSessionId: null,
    otpValue: '',
    error: null,
    successMsg: null,
    resendCountdown: 0,
  });

  // Live Sponsor Verification State
  const [sponsorStatus, setSponsorStatus] = useState({
    state: initialRef ? 'VALIDATING' : 'IDLE', // 'IDLE' | 'VALIDATING' | 'VALID' | 'INVALID'
    sponsor: null,
    error: null,
  });

  // Verify sponsor against backend
  const verifySponsor = useCallback(async (code) => {
    const clean = (code || '').trim();
    if (!clean) {
      setSponsorStatus({ state: 'IDLE', sponsor: null, error: null });
      return;
    }

    setSponsorStatus((prev) => ({ ...prev, state: 'VALIDATING', error: null }));
    try {
      const res = await api.validateSponsor(clean);
      if (res && res.success && res.data?.sponsor) {
        if (res.data.sponsor.status !== 'ACTIVE' && res.data.sponsor.status !== 'PENDING') {
          setSponsorStatus({
            state: 'INVALID',
            sponsor: null,
            error: 'The sponsor account is currently inactive.',
          });
        } else {
          setSponsorStatus({
            state: 'VALID',
            sponsor: res.data.sponsor,
            error: null,
          });
          // Preserve sponsor ID in storage
          try {
            localStorage.setItem('kashvi_active_sponsor', res.data.sponsor.distributorId || res.data.sponsor.referralCode);
          } catch {
            // Safe storage fallback
          }
        }
      } else {
        setSponsorStatus({
          state: 'INVALID',
          sponsor: null,
          error: res?.message || 'No user found with this referral code.',
        });
      }
    } catch (err) {
      const errMsg = err?.message || 'No user found with this referral code.';
      setSponsorStatus({
        state: 'INVALID',
        sponsor: null,
        error: errMsg,
      });
    }
  }, []);

  // Live validation on mount or when referralCode changes (debounced)
  useEffect(() => {
    if (!formData.referralCode || !formData.referralCode.trim()) {
      setSponsorStatus({ state: 'IDLE', sponsor: null, error: null });
      return;
    }
    const timer = setTimeout(() => {
      verifySponsor(formData.referralCode);
    }, 350);
    return () => clearTimeout(timer);
  }, [formData.referralCode, verifySponsor]);

  // Sync and cache referral code if URL query parameter changes or arrives
  useEffect(() => {
    if (refFromUrl) {
      try {
        sessionStorage.setItem('kashvi_referral_sponsor', refFromUrl);
        localStorage.setItem('kashvi_referral_sponsor', refFromUrl);
      } catch { }
      setFormData((prev) => ({ ...prev, referralCode: refFromUrl }));
      setHasUrlRef(true);
      verifySponsor(refFromUrl);
    }
  }, [refFromUrl, verifySponsor]);

  // If already authenticated and not in middle of showing success, navigate straight to dashboard
  useEffect(() => {
    if (isAuthenticated && !successData) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, successData, navigate]);

  // Initialize MSG91 OTP Widget on mount
  useEffect(() => {
    initMsg91Widget().catch((err) => {
      console.warn('[Register] MSG91 initialization notice:', err?.message);
    });
  }, []);

  // Resend OTP Countdown Timer (10-second interval as configured in MSG91)
  useEffect(() => {
    let timer;
    if (otpState.resendCountdown > 0) {
      timer = setTimeout(() => {
        setOtpState((prev) => ({
          ...prev,
          resendCountdown: Math.max(0, prev.resendCountdown - 1),
        }));
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [otpState.resendCountdown]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Invalidate OTP verification if mobile number is altered after verification
    if (name === 'phone') {
      const cleanPrev = (formData.phone || '').replace(/\D/g, '');
      const cleanNew = (value || '').replace(/\D/g, '');
      if (cleanPrev !== cleanNew && (otpState.verified || otpState.sent)) {
        setOtpState({
          sent: false,
          sending: false,
          verifying: false,
          verified: false,
          verifiedPhone: '',
          verificationSessionId: null,
          otpValue: '',
          error: null,
          successMsg: null,
          resendCountdown: 0,
        });
      }
    }

    // Clear field-level error as user types
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
    if (generalError) {
      setGeneralError(null);
      setIsDuplicateEmail(false);
    }
  };

  // STEP 2 & 3: Send OTP to entered mobile number
  const handleSendOtp = async () => {
    const rawPhone = (formData.phone || '').trim();
    const cleanDigits = rawPhone.replace(/\D/g, '');

    if (!cleanDigits) {
      setFieldErrors((prev) => ({ ...prev, phone: 'Mobile number is required.' }));
      return;
    }

    if (cleanDigits.length < 10 || !isValidIndianMobile(cleanDigits)) {
      setFieldErrors((prev) => ({
        ...prev,
        phone: 'Please enter a valid 10-digit Indian mobile number.',
      }));
      return;
    }

    // Prevent duplicate sending while in flight
    if (otpState.sending) return;

    setOtpState((prev) => ({
      ...prev,
      sending: true,
      error: null,
      successMsg: null,
    }));

    try {
      await sendOtpToMobile(cleanDigits);
      setOtpState((prev) => ({
        ...prev,
        sent: true,
        sending: false,
        resendCountdown: 10, // 10-second configured interval
        successMsg: 'OTP sent successfully to your mobile number.',
        error: null,
      }));
    } catch (err) {
      setOtpState((prev) => ({
        ...prev,
        sending: false,
        error: err?.message || 'Failed to send OTP. Please check your number and try again.',
      }));
    }
  };

  // Resend OTP with cooldown
  const handleResendOtp = async () => {
    if (otpState.resendCountdown > 0 || otpState.sending) return;

    setOtpState((prev) => ({
      ...prev,
      sending: true,
      error: null,
      successMsg: null,
    }));

    try {
      await resendOtp();
      setOtpState((prev) => ({
        ...prev,
        sending: false,
        resendCountdown: 10,
        successMsg: 'OTP resent successfully.',
        error: null,
      }));
    } catch (err) {
      setOtpState((prev) => ({
        ...prev,
        sending: false,
        error: err?.message || 'Failed to resend OTP. Please try again.',
      }));
    }
  };

  // STEP 5, 6, 7, 8, 9, 10, 11: Verify OTP and validate token on backend
  const handleVerifyOtp = async () => {
    const rawOtp = (otpState.otpValue || '').trim();
    if (!rawOtp || rawOtp.length !== 4) {
      setOtpState((prev) => ({
        ...prev,
        error: 'Please enter the 4-digit OTP received.',
      }));
      return;
    }

    if (otpState.verifying) return;

    setOtpState((prev) => ({
      ...prev,
      verifying: true,
      error: null,
      successMsg: null,
    }));

    try {
      const cleanPhone = (formData.phone || '').replace(/\D/g, '').slice(-10);

      // STEP 5, 6, 7: Verify OTP via MSG91 SDK and capture access token
      const { accessToken } = await verifyOtpCode(rawOtp, cleanPhone);

      if (!accessToken) {
        throw new Error('Verification completed but no access token was returned by MSG91.');
      }

      // STEP 8, 9, 10: Validate access token on backend with MSG91 official Verify Access Token API
      const res = await authApi.verifyOtpToken({
        accessToken,
        phone: cleanPhone,
      });

      if (!res?.success || !res?.data?.verificationSessionId) {
        throw new Error(res?.message || 'Failed to validate verification session on server.');
      }

      // STEP 11: Mark mobile number as verified only after successful backend validation
      setOtpState((prev) => ({
        ...prev,
        verifying: false,
        verified: true,
        verifiedPhone: cleanPhone,
        verificationSessionId: res.data.verificationSessionId,
        successMsg: 'Mobile number verified successfully!',
        error: null,
      }));

      // Clear any mobile error
      setFieldErrors((prev) => ({ ...prev, phone: null }));
    } catch (err) {
      setOtpState((prev) => ({
        ...prev,
        verifying: false,
        error: err?.message || 'Incorrect OTP or verification failed. Please try again.',
      }));
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

    // Mobile Number (Mandatory)
    const cleanPhoneDigits = formData.phone.replace(/\D/g, '');
    if (!formData.phone.trim()) {
      errors.phone = 'Mobile number is required.';
    } else if (cleanPhoneDigits.length < 10) {
      errors.phone = 'Please enter a valid 10-digit mobile number.';
    }

    // Email (Optional fallback)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email.trim() && !emailRegex.test(formData.email.trim())) {
      errors.email = 'Please provide a valid email address.';
    }

    // Password (Min 8 chars/digits, no strict format)
    if (!formData.password) {
      errors.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters/digits long.';
    }

    // Confirm Password
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Confirm Password is required.';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    // Sponsor Validation
    if (!formData.referralCode.trim()) {
      errors.referralCode = 'Sponsor ID is required.';
    } else if (sponsorStatus.state === 'INVALID') {
      errors.referralCode = sponsorStatus.error || 'Invalid or inactive sponsor ID.';
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent duplicate submissions while in-flight
    if (loading) return;

    setGeneralError(null);
    setIsDuplicateEmail(false);

    // Pre-flight sponsor validation checks
    if (sponsorStatus.state === 'VALIDATING') {
      setGeneralError('Please wait while we verify your sponsor ID...');
      return;
    }

    if (sponsorStatus.state === 'INVALID') {
      setFieldErrors((prev) => ({
        ...prev,
        referralCode: sponsorStatus.error || 'Invalid or inactive sponsor ID.',
      }));
      setGeneralError('A valid active sponsor is required to register. Please check your referral link.');
      return;
    }

    // Client-side validation
    const clientErrors = validateForm();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setGeneralError('Please correct the highlighted fields before submitting.');
      return;
    }

    // STEP 12 & Requirement 6: Block registration if mobile number is not verified with OTP
    const cleanPhoneDigits = formData.phone.replace(/\D/g, '').slice(-10);
    if (!otpState.verified || !otpState.verificationSessionId || otpState.verifiedPhone !== cleanPhoneDigits) {
      setFieldErrors((prev) => ({
        ...prev,
        phone: 'Please verify your mobile number before registration.',
      }));
      setGeneralError('Please verify your mobile number before registration.');
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
        referralCode: formData.referralCode.trim() || 'KK-0001',
        sponsorId: formData.referralCode.trim() || 'KK-0001',
        verificationSessionId: otpState.verificationSessionId,
      };

      const res = await register(payload);

      const registeredUser = res?.user || res?.data?.user;
      setSuccessData({
        name: registeredUser?.fullName || formData.fullName.trim(),
        referralCode:
          registeredUser?.memberId ||
          registeredUser?.distributorCode ||
          registeredUser?.referralCode ||
          'KK-0002',
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
      } else if (status >= 500 || /internal server error/i.test(message)) {
        setGeneralError('Registration service temporarily busy. Please click "Create Account" again to complete your registration.');
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

          {/* Mobile Number (Mandatory) */}
          <div className="form-group">
            <label htmlFor="phone">Mobile Number *</label>
            <div className="input-wrapper" style={{ position: 'relative' }}>
              <Phone size={18} className="input-icon" />
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                placeholder="10-digit mobile number"
                value={formData.phone}
                onChange={handleChange}
                disabled={loading || Boolean(successData) || otpState.verified}
                style={{
                  paddingRight: otpState.verified ? '105px' : '95px',
                  ...(fieldErrors.phone ? { borderColor: '#ef4444' } : {}),
                  ...(otpState.verified ? { borderColor: '#16a34a', backgroundColor: '#f0fdf4' } : {}),
                }}
              />

              {/* Verified Badge or Send OTP Button */}
              {otpState.verified ? (
                <span
                  style={{
                    position: 'absolute',
                    right: '10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#16a34a',
                    backgroundColor: '#dcfce7',
                    padding: '4px 8px',
                    borderRadius: '6px',
                  }}
                >
                  <CheckCircle2 size={14} /> Verified
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={
                    loading ||
                    otpState.sending ||
                    (formData.phone.replace(/\D/g, '').length < 10)
                  }
                  style={{
                    position: 'absolute',
                    right: '8px',
                    padding: '6px 12px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor:
                      loading ||
                      otpState.sending ||
                      formData.phone.replace(/\D/g, '').length < 10
                        ? 'not-allowed'
                        : 'pointer',
                    opacity:
                      loading ||
                      otpState.sending ||
                      formData.phone.replace(/\D/g, '').length < 10
                        ? 0.6
                        : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {otpState.sending ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <span>{otpState.sent ? 'Resend' : 'Send OTP'}</span>
                  )}
                </button>
              )}
            </div>

            {/* Field Error */}
            {fieldErrors.phone && (
              <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '2px' }}>
                {fieldErrors.phone}
              </span>
            )}

            {/* MSG91 Custom UI CAPTCHA Container (rendered when CAPTCHA is enabled in MSG91 dashboard) */}
            <div
              id="msg91-captcha-container"
              style={{
                marginTop: '6px',
                minHeight: '0px',
                display: 'flex',
                justifyContent: 'center',
              }}
            />

            {/* OTP Input & Verification Row (Shown only after OTP sending is successful and before verification) */}
            {otpState.sent && !otpState.verified && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div className="input-wrapper" style={{ flex: 1 }}>
                    <ShieldCheck size={18} className="input-icon" />
                    <input
                      id="otp"
                      name="otp"
                      type="text"
                      maxLength={4}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Enter 4-digit OTP"
                      value={otpState.otpValue}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setOtpState((prev) => ({ ...prev, otpValue: val, error: null }));
                      }}
                      disabled={otpState.verifying}
                      style={{
                        paddingLeft: '38px',
                        letterSpacing: '2px',
                        fontWeight: 600,
                        ...(otpState.error ? { borderColor: '#ef4444' } : {}),
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={otpState.verifying || otpState.otpValue.length !== 4}
                    style={{
                      padding: '11px 16px',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor:
                        otpState.verifying || otpState.otpValue.length !== 4
                          ? 'not-allowed'
                          : 'pointer',
                      opacity:
                        otpState.verifying || otpState.otpValue.length !== 4 ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {otpState.verifying ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <span>Verify OTP</span>
                    )}
                  </button>
                </div>

                {/* Resend Countdown & Expiry Interval */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12px',
                  }}
                >
                  {otpState.resendCountdown > 0 ? (
                    <span style={{ color: '#64748b' }}>
                      Resend OTP in <strong>{otpState.resendCountdown}s</strong>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={otpState.sending}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '12px',
                        textDecoration: 'underline',
                      }}
                    >
                      Resend OTP
                    </button>
                  )}
                  <span style={{ color: '#94a3b8' }}>OTP valid for 15 minutes</span>
                </div>

                {/* Status Messages */}
                {otpState.successMsg && (
                  <div
                    style={{
                      color: '#16a34a',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <CheckCircle2 size={14} />
                    <span>{otpState.successMsg}</span>
                  </div>
                )}
                {otpState.error && (
                  <div
                    style={{
                      color: '#ef4444',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <AlertCircle size={14} />
                    <span>{otpState.error}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Email Address (Optional Fallback) */}
          <div className="form-group">
            <label htmlFor="email">Email Address (Optional)</label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com (optional)"
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
                  <Lock size={11} /> Locked by referral link
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
                readOnly={hasUrlRef}
                placeholder="Enter Sponsor / Referral Code (e.g. KK-0001)"
                value={formData.referralCode}
                onChange={handleChange}
                disabled={loading || Boolean(successData)}
                style={{
                  ...(fieldErrors.referralCode ? { borderColor: '#ef4444' } : {}),
                  ...(hasUrlRef ? { backgroundColor: '#f8fafc', cursor: 'not-allowed' } : {}),
                }}
              />
            </div>
            {fieldErrors.referralCode && (
              <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '2px' }}>
                {fieldErrors.referralCode}
              </span>
            )}

            {/* Live Sponsor Verification Card */}
            {sponsorStatus.state === 'VALID' && sponsorStatus.sponsor && (
              <div
                style={{
                  marginTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '10px',
                }}
              >
                <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 600 }}>
                    Sponsored by
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#166534' }}>
                    {sponsorStatus.sponsor.name}{' '}
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#15803d',
                        background: '#dcfce7',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        marginLeft: '4px',
                      }}
                    >
                      {sponsorStatus.sponsor.distributorId}
                    </span>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#15803d',
                    background: '#dcfce7',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Verified Active
                </span>
              </div>
            )}

            {sponsorStatus.state === 'VALIDATING' && (
              <div
                style={{
                  marginTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#64748b',
                }}
              >
                <Loader2 size={14} className="animate-spin" style={{ color: '#3b82f6' }} />
                <span>Checking sponsor ID...</span>
              </div>
            )}

            {sponsorStatus.state === 'INVALID' && (
              <div
                style={{
                  marginTop: '10px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px 12px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#991b1b',
                }}
              >
                <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <strong>Invalid Sponsor:</strong>{' '}
                  {sponsorStatus.error || 'The sponsor ID is not valid or active.'}
                </div>
              </div>
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
            disabled={
              loading ||
              Boolean(successData) ||
              sponsorStatus.state === 'INVALID' ||
              sponsorStatus.state === 'VALIDATING'
            }
            style={{
              marginTop: '8px',
              opacity:
                loading ||
                  sponsorStatus.state === 'INVALID' ||
                  sponsorStatus.state === 'VALIDATING'
                  ? 0.65
                  : 1,
              cursor:
                loading ||
                  sponsorStatus.state === 'INVALID' ||
                  sponsorStatus.state === 'VALIDATING'
                  ? 'not-allowed'
                  : 'pointer',
            }}
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
