import React, { useState, useEffect } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Phone,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Users,
  Briefcase
} from 'lucide-react';
import PageContainer from '../components/PageContainer';
import DistributorDashboard from '../components/dashboard/DistributorDashboard';
import './Profile.css';

/**
 * Authentication & Profile Page for KASHVIMLM.
 * When a visitor or member clicks "Profile":
 * - Displays the Login page with username, password, and Sponsor ID.
 * - Includes a Register option with full distributor enrollment fields.
 * - Displays Member Profile Dashboard upon successful login.
 */
function Profile({ defaultNav }) {
  // Check persisted auth session from localStorage
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    try {
      const saved = localStorage.getItem('kashvi_auth');
      return saved ? JSON.parse(saved).isLoggedIn : false;
    } catch {
      return false;
    }
  });

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('kashvi_auth');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.user) {
          // If stored session had old name/ID, migrate to Rahul kaushal (owner)
          if (parsed.user.name === 'Poonam mehta' || parsed.user.memberId === '18618331') {
            parsed.user.name = 'Rahul kaushal';
            parsed.user.memberId = '88767139';
            parsed.user.sponsorId = '88767139';
            parsed.user.username = '@rahul_kaushal';
            parsed.user.email = 'rahul.kaushal@kashvimlm.com';
          }
          // Ensure R@hul11 / KV-1001 / 88767139 is verified Owner
          const normName = (parsed.user.name || '').toLowerCase().replace(/[@4]/g, 'a').replace(/[^a-z0-9]/g, '');
          const normUser = (parsed.user.username || '').toLowerCase().replace(/[@4]/g, 'a').replace(/[^a-z0-9]/g, '');
          const isOwnerUser =
            parsed.user.memberId === 'KV-1001' ||
            parsed.user.memberId === '88767139' ||
            parsed.user.memberId === '18618331' ||
            normName.includes('rahul') ||
            normUser.includes('rahul') ||
            parsed.user.name === 'R@hul11' ||
            parsed.user.username === 'R@hul11' ||
            parsed.user.username === '@R@hul11' ||
            parsed.user.isOwner === true;

          if (isOwnerUser) {
            parsed.user.isOwner = true;
            parsed.user.role = 'ADMIN';
          }
          localStorage.setItem('kashvi_auth', JSON.stringify(parsed));
          return parsed.user;
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  // Auth Card Mode: 'login' | 'register'
  const [activeTab, setActiveTab] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');

  // Login Form State
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
    sponsorId: '',
    rememberMe: true,
  });

  // Register Form State
  const [registerForm, setRegisterForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    username: '',
    sponsorId: 'KV-1001', // Default to Rahul Kaushal (KV-1001)
    password: '',
    confirmPassword: '',
  });

  // Sync auth state to localStorage
  useEffect(() => {
    if (isLoggedIn && currentUser) {
      localStorage.setItem(
        'kashvi_auth',
        JSON.stringify({ isLoggedIn: true, user: currentUser })
      );
    } else {
      localStorage.removeItem('kashvi_auth');
    }
  }, [isLoggedIn, currentUser]);

  // Handle Login Submit
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      alert('Please enter both your Username and Password.');
      return;
    }

    // Sponsor ID is compulsory
    if (!loginForm.sponsorId.trim()) {
      alert('Sponsor ID is compulsory! Without a valid Sponsor ID you cannot log in.');
      return;
    }

    const cleanUsername = (loginForm.username || '').toLowerCase().replace(/[@4]/g, 'a').replace(/[^a-z0-9]/g, '');
    const isOwnerDemo =
      cleanUsername.includes('rahul') ||
      loginForm.username === '88767139' ||
      loginForm.username.toUpperCase() === 'KV-1001' ||
      cleanUsername.includes('poonam') ||
      loginForm.username === '18618331' ||
      loginForm.username.toLowerCase() === 'r@hul11' ||
      loginForm.username === 'R@hul11';

    const displayName = isOwnerDemo
      ? (loginForm.username.includes('@') || loginForm.username.toLowerCase().includes('r@hul')
          ? loginForm.username
          : 'Rahul kaushal')
      : (loginForm.username === 'kashvi' ? 'Kashvi Sharma' : loginForm.username);

    const userData = {
      name: displayName,
      username: `@${loginForm.username.replace('@', '')}`,
      email: `${loginForm.username.toLowerCase().replace(/[@]/g, 'a')}@kashvimlm.com`,
      phone: '+91 98765 43210',
      location: 'Mumbai, Maharashtra, India',
      memberId: isOwnerDemo ? 'KV-1001' : (loginForm.username === 'kashvi' ? '10001001' : 'KV-1001'),
      sponsorId: loginForm.sponsorId.trim() || 'KV-1001',
      isOwner: isOwnerDemo,
      role: isOwnerDemo ? 'ADMIN' : 'DISTRIBUTOR',
      memberSince: '2026',
      since: '2026',
      tier: 'Diamond Director',
      bvPoints: '0.00 CP',
      teamSize: 48,
    };

    setAuthSuccessMsg(`Welcome back, ${userData.name}! Loading your distributor portal...`);
    setTimeout(() => {
      localStorage.setItem('kashvi_auth', JSON.stringify({ isLoggedIn: true, user: userData }));
      setCurrentUser(userData);
      setIsLoggedIn(true);
      setAuthSuccessMsg('');
      window.dispatchEvent(new Event('kashvi_auth_change'));
    }, 400);
  };

  // Handle Register Submit
  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    if (!registerForm.fullName.trim() || !registerForm.username.trim() || !registerForm.password.trim()) {
      alert('Please fill in all required fields.');
      return;
    }

    // Sponsor ID is compulsory
    if (!registerForm.sponsorId.trim()) {
      alert('Sponsor ID is compulsory! Each new distributor must join using a Sponsor ID (e.g. KV-1001).');
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      alert('Passwords do not match.');
      return;
    }

    const cleanSponsorId = registerForm.sponsorId.trim().toUpperCase();
    const isRahul = cleanSponsorId === 'KV-1001' || cleanSponsorId === '88767139' || cleanSponsorId.includes('RAHUL');
    const isAmit = cleanSponsorId === 'KV-1002' || cleanSponsorId.includes('AMIT');
    const isRohit = cleanSponsorId === 'KV-1003' || cleanSponsorId.includes('ROHIT');

    const sponsorName = isRahul
      ? 'Rahul Kaushal'
      : isAmit
      ? 'Amit Verma'
      : isRohit
      ? 'Rohit Singh'
      : `Sponsor (${cleanSponsorId})`;

    const newMemberId = `KV-${Math.floor(1008 + Math.random() * 8990)}`;
    const userData = {
      name: registerForm.fullName,
      username: `@${registerForm.username.replace('@', '') || registerForm.fullName.toLowerCase().replace(/\s+/g, '_')}`,
      email: registerForm.email || `${registerForm.username.toLowerCase()}@kashvimlm.com`,
      phone: registerForm.phone || '+91 98000 12345',
      location: 'India',
      memberId: newMemberId,
      sponsorId: cleanSponsorId,
      sponsorName,
      memberSince: '2026',
      since: '2026',
      tier: 'Active Partner',
      bvPoints: '100.00 CP',
      teamSize: 0,
    };

    // Store in downline team so it is immediately reflected in the Network Tree under the sponsor!
    try {
      const downlineItem = {
        memberId: newMemberId,
        name: registerForm.fullName,
        email: registerForm.email,
        phone: registerForm.phone,
        sponsorId: cleanSponsorId,
        sponsorName,
        enrolledAt: new Date().toISOString(),
        status: 'Active',
      };
      const existing = JSON.parse(localStorage.getItem('kashvi_downline_team') || '[]');
      existing.unshift(downlineItem);
      localStorage.setItem('kashvi_downline_team', JSON.stringify(existing));
    } catch {}

    // Register with backend tree API if available
    if (api.enrollMember) {
      api.enrollMember({
        distributorCode: newMemberId,
        firstName: registerForm.fullName.split(' ')[0],
        lastName: registerForm.fullName.split(' ').slice(1).join(' ') || 'Member',
        sponsorCode: cleanSponsorId,
      }).catch(() => {});
    }

    setAuthSuccessMsg(`Registration successful! You have joined under ${sponsorName} (${cleanSponsorId}). Launching portal...`);
    setTimeout(() => {
      localStorage.setItem('kashvi_auth', JSON.stringify({ isLoggedIn: true, user: userData }));
      setCurrentUser(userData);
      setIsLoggedIn(true);
      setAuthSuccessMsg('');
      window.dispatchEvent(new Event('kashvi_auth_change'));
    }, 400);
  };

  // Handle Sign Out
  const handleSignOut = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    localStorage.removeItem('kashvi_auth');
    window.dispatchEvent(new Event('kashvi_auth_change'));
    setLoginForm({
      username: '',
      password: '',
      sponsorId: '',
      rememberMe: true,
    });
  };

  // Autofill Demo Account (Owner Profile: R@hul11 / KV-1001)
  const handleAutofillDemo = () => {
    setLoginForm({
      username: 'R@hul11',
      password: '••••••••',
      sponsorId: 'KV-1001',
      rememberMe: true,
    });
  };

  // =========================================================================
  // VIEW 1: AUTHENTICATION / LOGIN & REGISTER PAGE
  // =========================================================================
  if (!isLoggedIn) {
    return (
      <PageContainer className="auth-page-wrapper">
        <div className="auth-bg-glow-orb-1" />
        <div className="auth-bg-glow-orb-2" />

        <div className="auth-card-container">
          <div className="auth-card">
            {/* Brand Header */}
            <div className="auth-card-header">
              <div className="auth-brand-badge">
                <Sparkles size={13} />
                <span>KASHVI DISTRIBUTOR PORTAL</span>
              </div>
              <h1 className="auth-title">
                {activeTab === 'login' ? 'Sign In to Your Account' : 'Distributor Registration'}
              </h1>
              <p className="auth-subtitle">
                {activeTab === 'login'
                  ? 'Access your sales commission, BV earnings, and direct selling network.'
                  : 'Enroll under your sponsor to start distributing electronics & Hozri wear.'}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="auth-tabs-nav">
              <button
                type="button"
                className={`auth-tab-btn ${activeTab === 'login' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('login');
                  setAuthSuccessMsg('');
                }}
              >
                <User size={16} />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                className={`auth-tab-btn ${activeTab === 'register' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('register');
                  setAuthSuccessMsg('');
                }}
              >
                <Users size={16} />
                <span>Register</span>
              </button>
            </div>

            {authSuccessMsg && (
              <div className="auth-alert-success">
                <CheckCircle2 size={18} />
                <span>{authSuccessMsg}</span>
              </div>
            )}

            {/* TAB 1: LOGIN FORM */}
            {activeTab === 'login' && (
              <form className="auth-form" onSubmit={handleLoginSubmit}>
                {/* Username or Member ID */}
                <div className="auth-input-group">
                  <label htmlFor="login-username" className="auth-label">
                    <span>Username or Member ID *</span>
                  </label>
                  <div className="auth-input-wrapper">
                    <User size={17} className="auth-input-icon" />
                    <input
                      id="login-username"
                      type="text"
                      required
                      placeholder="Enter your Username or Member ID"
                      value={loginForm.username}
                      onChange={(e) =>
                        setLoginForm((prev) => ({ ...prev, username: e.target.value }))
                      }
                      className="auth-input"
                    />
                  </div>
                </div>

                {/* Password with Eye Toggle */}
                <div className="auth-input-group">
                  <label htmlFor="login-password" className="auth-label">
                    <span>Password *</span>
                  </label>
                  <div className="auth-input-wrapper">
                    <Lock size={17} className="auth-input-icon" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter your Password"
                      value={loginForm.password}
                      onChange={(e) =>
                        setLoginForm((prev) => ({ ...prev, password: e.target.value }))
                      }
                      className="auth-input"
                    />
                    <button
                      type="button"
                      className="auth-eye-btn"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Sponsor ID (Compulsory to login) */}
                <div className="auth-input-group auth-sponsor-block">
                  <label htmlFor="login-sponsor" className="auth-label">
                    <span>Sponsor ID *</span>
                    <span className="auth-label-tag">Compulsory</span>
                  </label>
                  <div className="auth-input-wrapper">
                    <Users size={17} className="auth-input-icon" />
                    <input
                      id="login-sponsor"
                      type="text"
                      required
                      placeholder="Enter Sponsor ID (Compulsory to log in)"
                      value={loginForm.sponsorId}
                      onChange={(e) =>
                        setLoginForm((prev) => ({ ...prev, sponsorId: e.target.value }))
                      }
                      className="auth-input"
                    />
                  </div>
                  <span className="auth-sponsor-hint">
                    Sponsor ID is compulsory. You cannot log in without a valid Sponsor ID.
                  </span>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="auth-options-row">
                  <label className="auth-checkbox-label">
                    <input
                      type="checkbox"
                      checked={loginForm.rememberMe}
                      onChange={(e) =>
                        setLoginForm((prev) => ({ ...prev, rememberMe: e.target.checked }))
                      }
                    />
                    <span>Remember this device</span>
                  </label>

                  <button
                    type="button"
                    className="auth-forgot-link"
                    onClick={() => alert('Password reset instructions sent to your registered email.')}
                  >
                    Forgot Password?
                  </button>
                </div>

                {/* Submit Button */}
                <button type="submit" className="auth-submit-btn">
                  <span>Sign In to Portal</span>
                  <ArrowRight size={18} />
                </button>

                {/* Demo Autofill Helper */}
                <div className="auth-demo-helper">
                  <p className="auth-demo-text">Quick Demo: Fill sample distributor credentials</p>
                  <button
                    type="button"
                    className="auth-demo-btn"
                    onClick={handleAutofillDemo}
                  >
                    Autofill Demo
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: REGISTER FORM */}
            {activeTab === 'register' && (
              <form className="auth-form" onSubmit={handleRegisterSubmit}>
                {/* 1. Name & 2. Email */}
                <div className="auth-form-row">
                  <div className="auth-input-group">
                    <label htmlFor="reg-name" className="auth-label">
                      <span>Name *</span>
                    </label>
                    <div className="auth-input-wrapper">
                      <User size={17} className="auth-input-icon" />
                      <input
                        id="reg-name"
                        type="text"
                        required
                        placeholder="Name"
                        value={registerForm.fullName}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({ ...prev, fullName: e.target.value }))
                        }
                        className="auth-input"
                      />
                    </div>
                  </div>

                  <div className="auth-input-group">
                    <label htmlFor="reg-email" className="auth-label">
                      <span>Email *</span>
                    </label>
                    <div className="auth-input-wrapper">
                      <Mail size={17} className="auth-input-icon" />
                      <input
                        id="reg-email"
                        type="email"
                        required
                        placeholder="Email"
                        value={registerForm.email}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({ ...prev, email: e.target.value }))
                        }
                        className="auth-input"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Mobile Number & Username */}
                <div className="auth-form-row">
                  <div className="auth-input-group">
                    <label htmlFor="reg-phone" className="auth-label">
                      <span>Mobile Number *</span>
                    </label>
                    <div className="auth-input-wrapper">
                      <Phone size={17} className="auth-input-icon" />
                      <input
                        id="reg-phone"
                        type="tel"
                        required
                        placeholder="Mobile Number"
                        value={registerForm.phone}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        className="auth-input"
                      />
                    </div>
                  </div>

                  <div className="auth-input-group">
                    <label htmlFor="reg-username" className="auth-label">
                      <span>Username</span>
                    </label>
                    <div className="auth-input-wrapper">
                      <Briefcase size={17} className="auth-input-icon" />
                      <input
                        id="reg-username"
                        type="text"
                        placeholder="Username"
                        value={registerForm.username}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({ ...prev, username: e.target.value }))
                        }
                        className="auth-input"
                      />
                    </div>
                  </div>
                </div>

                {/* Sponsor ID (Compulsory: Each new distributor joins using a Sponsor ID) */}
                <div className="auth-input-group auth-sponsor-block">
                  <label htmlFor="reg-sponsor" className="auth-label">
                    <span>Sponsor ID *</span>
                    <span className="auth-label-tag">Compulsory to Join</span>
                  </label>
                  <div className="auth-input-wrapper">
                    <Users size={17} className="auth-input-icon" />
                    <input
                      id="reg-sponsor"
                      type="text"
                      required
                      placeholder="Enter Sponsor ID (e.g. KV-1001 for Rahul)"
                      value={registerForm.sponsorId}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({ ...prev, sponsorId: e.target.value }))
                      }
                      className="auth-input"
                    />
                  </div>
                  {registerForm.sponsorId?.trim() ? (
                    <span
                      className="auth-sponsor-hint"
                      style={{ color: '#059669', fontWeight: 600, display: 'block', marginTop: '5px' }}
                    >
                      ✓ Verified Sponsor:{' '}
                      {registerForm.sponsorId.toUpperCase() === 'KV-1001' ||
                      registerForm.sponsorId === '88767139' ||
                      registerForm.sponsorId.toLowerCase().includes('rahul')
                        ? 'Rahul Kaushal (KV-1001) - You will join directly under Rahul'
                        : registerForm.sponsorId.toUpperCase() === 'KV-1002'
                        ? 'Amit Verma (KV-1002) - You will join under Amit'
                        : registerForm.sponsorId.toUpperCase() === 'KV-1003'
                        ? 'Rohit Singh (KV-1003) - You will join under Rohit'
                        : `Sponsor (${registerForm.sponsorId.toUpperCase()})`}
                    </span>
                  ) : (
                    <span className="auth-sponsor-hint">
                      Each new distributor/customer joins using a Sponsor ID (e.g. KV-1001).
                    </span>
                  )}
                </div>

                {/* Password & Confirm Password */}
                <div className="auth-form-row">
                  <div className="auth-input-group">
                    <label htmlFor="reg-password" className="auth-label">
                      <span>Create Password *</span>
                    </label>
                    <div className="auth-input-wrapper">
                      <Lock size={17} className="auth-input-icon" />
                      <input
                        id="reg-password"
                        type={showRegPassword ? 'text' : 'password'}
                        required
                        placeholder="Password"
                        value={registerForm.password}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({ ...prev, password: e.target.value }))
                        }
                        className="auth-input"
                        style={{ paddingRight: '2.5rem' }}
                      />
                      <button
                        type="button"
                        className="auth-eye-btn"
                        onClick={() => setShowRegPassword((prev) => !prev)}
                        aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                        title={showRegPassword ? 'Hide password' : 'Show password'}
                      >
                        {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="auth-input-group">
                    <label htmlFor="reg-confirm" className="auth-label">
                      <span>Confirm Password *</span>
                    </label>
                    <div className="auth-input-wrapper">
                      <Lock size={17} className="auth-input-icon" />
                      <input
                        id="reg-confirm"
                        type={showRegConfirmPassword ? 'text' : 'password'}
                        required
                        placeholder="Confirm Password"
                        value={registerForm.confirmPassword}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({
                            ...prev,
                            confirmPassword: e.target.value,
                          }))
                        }
                        className="auth-input"
                        style={{ paddingRight: '2.5rem' }}
                      />
                      <button
                        type="button"
                        className="auth-eye-btn"
                        onClick={() => setShowRegConfirmPassword((prev) => !prev)}
                        aria-label={showRegConfirmPassword ? 'Hide password' : 'Show password'}
                        title={showRegConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showRegConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Submit Register Button */}
                <button type="submit" className="auth-submit-btn">
                  <span>Create Distributor Account</span>
                  <ArrowRight size={18} />
                </button>
              </form>
            )}

            {/* Bottom Toggle Link */}
            <div className="auth-footer-switch">
              {activeTab === 'login' ? (
                <>
                  Don't have an account yet?{' '}
                  <button
                    type="button"
                    className="auth-switch-link"
                    onClick={() => setActiveTab('register')}
                  >
                    Register here
                  </button>
                </>
              ) : (
                <>
                  Already registered with Kashvi?{' '}
                  <button
                    type="button"
                    className="auth-switch-link"
                    onClick={() => setActiveTab('login')}
                  >
                    Sign in here
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  // =========================================================================
  // VIEW 2: LOGGED-IN DISTRIBUTOR DASHBOARD (KASHVIMLM REPRODUCTION)
  // =========================================================================
  return <DistributorDashboard user={currentUser} onSignOut={handleSignOut} defaultNav={defaultNav} />;
}

export default Profile;
