import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Lock, Mail, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';
import './Login.css';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // If already authenticated and not transitioning from a successful login, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated && !successMsg) {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, successMsg, navigate, location]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear field-level error as user types
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }

    if (generalError) {
      setGeneralError(null);
      setIsBlocked(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = formData.email.trim();

    if (!cleanEmail) {
      errors.email = 'Please enter your email address.';
    } else if (!emailRegex.test(cleanEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!formData.password) {
      errors.password = 'Please enter your password.';
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent duplicate submissions
    if (loading) return;

    setGeneralError(null);
    setIsBlocked(false);
    setSuccessMsg('');

    // Client-side validation
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setGeneralError('Please enter a valid email address and password.');
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const cleanEmail = formData.email.trim().toLowerCase();
      const credentials = {
        email: cleanEmail,
        password: formData.password,
      };

      await login(credentials);

      setSuccessMsg('Login successful. Redirecting to your dashboard...');

      const from = location.state?.from?.pathname || '/dashboard';
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 500);
    } catch (err) {
      console.error('[Login] Error:', err);

      const status = err.status || err.response?.status;
      const message = err.message || err.response?.data?.message || '';

      if (status === 401) {
        // Generic credentials error to prevent email/account enumeration
        setGeneralError('Invalid email or password.');
      } else if (status === 403) {
        setIsBlocked(true);
        setGeneralError(
          message || 'Your account has been blocked or suspended. Please contact support.'
        );
      } else if (err.isNetworkError || status === 0 || /failed to fetch|network/i.test(message)) {
        setGeneralError(
          'Unable to connect to the server. Please check your internet connection or server status.'
        );
      } else {
        setGeneralError(message || 'An error occurred during login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-logo-badge">
            <span className="logo-initials">KV</span>
          </div>
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Sign in to access your distributor dashboard and network</p>
        </div>

        {/* General Error Alert */}
        {generalError && (
          <div className="auth-alert error-alert" role="alert">
            {isBlocked ? (
              <ShieldAlert size={18} className="alert-icon" />
            ) : (
              <AlertCircle size={18} className="alert-icon" />
            )}
            <div style={{ flex: 1 }}>
              <span>{generalError}</span>
              {isBlocked && (
                <div style={{ marginTop: '6px', fontSize: '12px' }}>
                  <Link to="/contact" style={{ color: '#b91c1c', fontWeight: 600, textDecoration: 'underline' }}>
                    Contact Support &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="auth-alert success-alert" role="status">
            <CheckCircle2 size={18} className="alert-icon" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {/* Email */}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className={`input-wrapper ${fieldErrors.email ? 'has-error' : ''}`}>
              <Mail size={18} className="input-icon" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
                disabled={loading || Boolean(successMsg)}
                style={fieldErrors.email ? { borderColor: '#ef4444' } : {}}
              />
            </div>
            {fieldErrors.email && (
              <span className="field-error-text">
                {fieldErrors.email}
              </span>
            )}
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className={`input-wrapper ${fieldErrors.password ? 'has-error' : ''}`}>
              <Lock size={18} className="input-icon" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                disabled={loading || Boolean(successMsg)}
                style={fieldErrors.password ? { borderColor: '#ef4444' } : {}}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={0}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.password && (
              <span className="field-error-text">
                {fieldErrors.password}
              </span>
            )}
          </div>

          {/* Forgot Password? */}
          <div className="form-actions-row">
            <Link to="/forgot-password" className="forgot-password-link">
              Forgot Password?
            </Link>
          </div>

          {/* Login Button */}
          <button type="submit" className="submit-auth-btn" disabled={loading || Boolean(successMsg)}>
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Logging in...</span>
              </>
            ) : (
              <span>Login</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <Link to="/register" className="auth-link">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
