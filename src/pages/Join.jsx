import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  UserCheck,
  AlertTriangle,
  Copy,
  Check,
  ShieldCheck,
  User,
  Mail,
  Phone,
  Lock,
  GitBranch,
  Package,
  Building,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
} from 'lucide-react';
import PageContainer from '../components/PageContainer';
import { api } from '../services/api';
import './Join.css';

/**
 * Public Enrollment Portal (Prompt 6)
 * Route: /join?ref=KV-1001
 *
 * Requirements:
 * - Automatically validates referral sponsor against backend database.
 * - Prominently displays "Sponsored By" with Sponsor Name & ID.
 * - User does not need to manually enter the sponsor ID.
 * - If /join?ref=INVALID, shows "Invalid or inactive sponsor." and blocks enrollment.
 * - Includes functional "Copy Referral Link" button with instant feedback.
 */
function Join() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Extract referral parameter from URL (?ref=KV-1001 or fallback ?sponsor=KV-1001)
  const refParam = searchParams.get('ref') || searchParams.get('sponsor') || '';

  // Validation States: 'VALIDATING' | 'VALID' | 'INVALID' | 'NO_SPONSOR'
  const [validationState, setValidationState] = useState(refParam ? 'VALIDATING' : 'NO_SPONSOR');
  const [sponsorData, setSponsorData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [manualSponsorInput, setManualSponsorInput] = useState('');

  // Referral link copy state
  const [isCopied, setIsCopied] = useState(false);
  const [newMemberCopied, setNewMemberCopied] = useState(false);

  // Form State
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState('LEFT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [enrollmentSuccess, setEnrollmentSuccess] = useState(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    dob: '',
    gender: 'Male',
    panNumber: '',
    address: '',
    city: '',
    state: 'Maharashtra',
    pincode: '',
    starterKitId: 'kit_pro',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    password: '',
    agreeTerms: true,
  });

  // 1. Validate sponsor against backend database
  const validateSponsorFromBackend = async (idToValidate) => {
    const cleanId = (idToValidate || '').trim();
    if (!cleanId) {
      setValidationState('NO_SPONSOR');
      setSponsorData(null);
      setErrorMessage('');
      return;
    }

    setValidationState('VALIDATING');
    setErrorMessage('');

    try {
      const res = await api.validateSponsor(cleanId);
      if (res && res.success && res.data && res.data.sponsor) {
        if (res.data.sponsor.status !== 'ACTIVE') {
          setValidationState('INVALID');
          setSponsorData(null);
          setErrorMessage('Invalid or inactive sponsor.');
          return;
        }

        setSponsorData(res.data);
        setValidationState('VALID');
        setErrorMessage('');

        // Pre-select first available placement position (LEFT or RIGHT)
        const avail = res.data.availablePositions || [];
        if (avail.length === 1) {
          setSelectedPosition(avail[0]);
        } else if (avail.includes(selectedPosition)) {
          // Keep current selection
        } else if (avail.length > 0) {
          setSelectedPosition(avail[0]);
        } else {
          setSelectedPosition('');
        }
      } else {
        setValidationState('INVALID');
        setSponsorData(null);
        setSelectedPosition('');
        setErrorMessage('Invalid or inactive sponsor.');
      }
    } catch {
      setValidationState('INVALID');
      setSponsorData(null);
      setSelectedPosition('');
      setErrorMessage('Invalid or inactive sponsor.');
    }
  };

  // Trigger validation when URL ref parameter changes or component mounts
  useEffect(() => {
    if (refParam) {
      validateSponsorFromBackend(refParam);
    } else {
      setValidationState('NO_SPONSOR');
      setSponsorData(null);
      setErrorMessage('');
    }
  }, [refParam]);

  // Handle manual sponsor search
  const handleManualSearch = (e) => {
    e.preventDefault();
    if (!manualSponsorInput.trim()) return;
    setSearchParams({ ref: manualSponsorInput.trim() });
  };

  // Handle Copy Referral Link
  const handleCopyReferralLink = (targetId) => {
    const id = targetId || sponsorData?.sponsor?.distributorId || refParam || 'KV-1001';
    const domain = window.location.origin;
    const url = `${domain}/join?ref=${encodeURIComponent(id)}`;

    navigator.clipboard.writeText(url).then(() => {
      if (targetId) {
        setNewMemberCopied(true);
        setTimeout(() => setNewMemberCopied(false), 2500);
      } else {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
      }
    });
  };

  // Form Change Handler
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Submit Enrollment
  const handleSubmitEnrollment = async (e) => {
    e.preventDefault();

    // Guard: Never create enrollment if sponsor is invalid
    if (validationState !== 'VALID' || !sponsorData?.sponsor) {
      alert('Cannot create enrollment without a verified, active sponsor.');
      return;
    }

    if (!formData.fullName.trim() || !formData.email.trim() || !formData.phone.trim()) {
      alert('Please fill in your full name, email, and phone number.');
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const kitBV =
      formData.starterKitId === 'kit_pro'
        ? 100
        : formData.starterKitId === 'kit_elite'
        ? 200
        : 50;

    const kitPrice =
      formData.starterKitId === 'kit_pro'
        ? 249.99
        : formData.starterKitId === 'kit_elite'
        ? 499.99
        : 99.99;

    const payload = {
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      dob: formData.dob || undefined,
      gender: formData.gender,
      panNumber: formData.panNumber,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      country: 'India',
      sponsorId: sponsorData.sponsor.distributorId,
      placementParentId: sponsorData.sponsor.distributorId,
      placementLeg: (selectedPosition || 'auto').toLowerCase(),
      enrollType: 'distributor',
      starterKitId: formData.starterKitId,
      productPackage:
        formData.starterKitId === 'kit_pro'
          ? 'Professional Activation Kit'
          : formData.starterKitId === 'kit_elite'
          ? 'Elite Executive Kit'
          : 'Basic Starter Pack',
      price: kitPrice,
      bv: kitBV,
      bankName: formData.bankName,
      accountNumber: formData.accountNumber,
      ifscCode: formData.ifscCode,
      password: formData.password,
    };

    try {
      const res = await api.submitCompleteEnrollment(payload);
      if (res && res.success && res.data) {
        const d = res.data;
        // The enrollment service returns a flat record ({ memberId, name, ... }).
        const newDistributorId = d.memberId || d.distributor?.distributorId;

        const result = {
          memberId: newDistributorId,
          name: d.name || d.distributor?.displayName || formData.fullName,
          email: d.email || d.user?.email || formData.email,
          sponsorId: d.sponsorId || sponsorData.sponsor.distributorId,
          sponsorName: d.sponsorName || sponsorData.sponsor.name,
          placement: d.placement || `${selectedPosition} Leg`,
          assignedBV: d.assignedBV ?? kitBV,
          referralUrl: `${window.location.origin}/join?ref=${newDistributorId}`,
        };

        setEnrollmentSuccess(result);
      } else {
        // Never fake a success here: a fabricated member ID looks like the
        // referral worked while nothing was written to the database.
        setSubmitError(
          res?.message || 'Enrollment failed. The sponsor may be invalid or the server is unreachable.'
        );
      }
    } catch (err) {
      setSubmitError(err.message || 'Failed to complete enrollment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Demo fill helper for quick test
  const handleQuickFill = () => {
    setFormData({
      fullName: 'Aarav Patel',
      dob: '1995-08-20',
      gender: 'Male',
      email: `aarav.patel.${Math.floor(100 + Math.random() * 900)}@example.com`,
      phone: '+91 98765 12345',
      panNumber: 'ABCDE1234F',
      address: '42 Lotus Park, Bandra Kurla Complex',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400051',
      starterKitId: 'kit_pro',
      bankName: 'State Bank of India',
      accountNumber: '302010998877',
      ifscCode: 'SBIN0001234',
      password: 'PartnerPass2026!',
      agreeTerms: true,
    });
  };

  // ---------------------------------------------------------------------------
  // Render: Enrollment Success Screen
  // ---------------------------------------------------------------------------
  if (enrollmentSuccess) {
    return (
      <PageContainer className="join-page-container">
        <div className="join-card join-success-card">
          <div className="success-badge-icon">
            <Sparkles size={38} />
          </div>

          <span className="success-eyebrow">Enrollment Successful</span>
          <h1 className="success-title">Welcome to KASHVIMLM!</h1>
          <p className="success-subtitle">
            Your distributor account has been activated and positioned in the binary network tree.
          </p>

          <div className="success-details-grid">
            <div className="success-detail-item">
              <span className="detail-label">Your Distributor ID</span>
              <span className="detail-value highlight-value">{enrollmentSuccess.memberId}</span>
            </div>
            <div className="success-detail-item">
              <span className="detail-label">Distributor Name</span>
              <span className="detail-value">{enrollmentSuccess.name}</span>
            </div>
            <div className="success-detail-item">
              <span className="detail-label">Sponsored By</span>
              <span className="detail-value">
                {enrollmentSuccess.sponsorName} ({enrollmentSuccess.sponsorId})
              </span>
            </div>
            <div className="success-detail-item">
              <span className="detail-label">Binary Placement</span>
              <span className="detail-value">{enrollmentSuccess.placement}</span>
            </div>
            <div className="success-detail-item">
              <span className="detail-label">Activation BV</span>
              <span className="detail-value bv-value">+{enrollmentSuccess.assignedBV} BV</span>
            </div>
            <div className="success-detail-item">
              <span className="detail-label">Account Status</span>
              <span className="detail-value status-active">Active & Qualified</span>
            </div>
          </div>

          {/* New Distributor's Referral Link Box */}
          <div className="new-referral-box">
            <div className="referral-box-header">
              <Sparkles size={18} className="sparkle-icon" />
              <strong>Your Personal Referral Link</strong>
            </div>
            <p className="referral-box-desc">
              Share your custom referral URL with prospects to sponsor new team members:
            </p>
            <div className="referral-copy-bar">
              <input
                type="text"
                readOnly
                value={enrollmentSuccess.referralUrl}
                className="referral-url-input"
              />
              <button
                type="button"
                className={`btn-copy-referral ${newMemberCopied ? 'copied' : ''}`}
                onClick={() => handleCopyReferralLink(enrollmentSuccess.memberId)}
              >
                {newMemberCopied ? <Check size={16} /> : <Copy size={16} />}
                <span>{newMemberCopied ? 'Copied!' : 'Copy Referral Link'}</span>
              </button>
            </div>
          </div>

          <div className="success-actions">
            <button
              type="button"
              className="btn-primary-join"
              onClick={() => navigate('/profile')}
            >
              Go to Distributor Dashboard
              <ArrowRight size={18} />
            </button>
            <Link to="/" className="btn-secondary-link">
              Back to Kashvimlm Home
            </Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Main Join Page
  // ---------------------------------------------------------------------------
  return (
    <PageContainer className="join-page-container">
      <div className="join-card">
        {/* Header */}
        <div className="join-header">
          <div className="join-badge">
            <ShieldCheck size={16} />
            <span>KASHVIMLM Official Enrollment Portal</span>
          </div>
          <h1 className="join-title">Distributor Registration</h1>
          <p className="join-subtitle">
            Join India's premier multi-tier direct selling enterprise with guaranteed BV binary placement.
          </p>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* SPONSOR IDENTIFICATION & VERIFICATION SECTION */}
        {/* ----------------------------------------------------------------- */}
        <div className="sponsor-verification-wrapper">
          {/* Loading / Validating State */}
          {validationState === 'VALIDATING' && (
            <div className="sponsor-state-box state-validating">
              <RefreshCw size={24} className="spin-icon" />
              <div>
                <strong>Validating Sponsor Referral...</strong>
                <p>Verifying sponsor ID <code>{refParam}</code> against the secure database...</p>
              </div>
            </div>
          )}

          {/* Invalid Sponsor State: Exact requirement: show "Invalid or inactive sponsor." and DO NOT create enrollment */}
          {validationState === 'INVALID' && (
            <div className="sponsor-state-box state-invalid" role="alert">
              <div className="state-icon-circle invalid-circle">
                <AlertTriangle size={24} />
              </div>
              <div className="state-content">
                <strong className="invalid-heading">Invalid or inactive sponsor.</strong>
                <p className="invalid-sub">
                  The referral parameter <code>{refParam}</code> is either invalid or refers to an inactive sponsor.
                  Under Kashvimlm enterprise compliance rules, enrollments cannot be processed without a verified sponsor.
                </p>

                {/* Search / Enter valid sponsor */}
                <form className="manual-sponsor-form" onSubmit={handleManualSearch}>
                  <label htmlFor="manual-sponsor-input" className="form-label">
                    Enter a Valid Sponsor ID:
                  </label>
                  <div className="manual-input-row">
                    <input
                      id="manual-sponsor-input"
                      type="text"
                      className="form-input"
                      placeholder="e.g. KV-1001"
                      value={manualSponsorInput}
                      onChange={(e) => setManualSponsorInput(e.target.value)}
                    />
                    <button type="submit" className="btn-validate">
                      <Search size={16} />
                      Verify Sponsor
                    </button>
                  </div>
                  <div className="demo-hint-row">
                    <span>Try active founder sponsor:</span>
                    <button
                      type="button"
                      className="btn-pill-link"
                      onClick={() => setSearchParams({ ref: 'KV-1001' })}
                    >
                      KV-1001 (Rahul Kaushal)
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* No Sponsor In Query State */}
          {validationState === 'NO_SPONSOR' && (
            <div className="sponsor-state-box state-prompt">
              <div className="state-icon-circle prompt-circle">
                <User size={24} />
              </div>
              <div className="state-content">
                <strong>Sponsor Referral Required</strong>
                <p className="prompt-sub">
                  Please enter the Distributor Referral ID of the partner who invited you to Kashvimlm:
                </p>

                <form className="manual-sponsor-form" onSubmit={handleManualSearch}>
                  <div className="manual-input-row">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. KV-1001"
                      value={manualSponsorInput}
                      onChange={(e) => setManualSponsorInput(e.target.value)}
                    />
                    <button type="submit" className="btn-validate">
                      <Search size={16} />
                      Verify Sponsor
                    </button>
                  </div>
                  <div className="demo-hint-row">
                    <span>Quick link to active sponsor:</span>
                    <button
                      type="button"
                      className="btn-pill-link"
                      onClick={() => setSearchParams({ ref: 'KV-1001' })}
                    >
                      Use KV-1001 (Rahul Kaushal)
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Valid Sponsor State: Automatically identify and display Sponsor By */}
          {validationState === 'VALID' && sponsorData && (
            <div className="sponsor-card-identified">
              <div className="sponsor-card-left">
                <span className="sponsored-by-label">Sponsored By</span>
                <h3 className="sponsor-name">{sponsorData.sponsor.name}</h3>
                <div className="sponsor-id-tag">
                  <UserCheck size={15} />
                  <span>{sponsorData.sponsor.distributorId}</span>
                  <span className="verified-pill">Active & Verified</span>
                </div>
              </div>

              <div className="sponsor-card-right">
                <button
                  type="button"
                  className={`btn-copy-referral ${isCopied ? 'copied' : ''}`}
                  onClick={() => handleCopyReferralLink()}
                  title="Copy Sponsor Referral URL"
                >
                  {isCopied ? <Check size={16} /> : <Copy size={16} />}
                  <span>{isCopied ? 'Copied!' : 'Copy Referral Link'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* ENROLLMENT FORM: ONLY RENDERED IF SPONSOR IS VALID */}
        {/* ----------------------------------------------------------------- */}
        {validationState === 'VALID' && sponsorData && (
          <form className="join-form" onSubmit={handleSubmitEnrollment}>
            {/* Quick Demo Pre-fill */}
            <div className="form-toolbar">
              <span className="form-section-caption">Applicant & Business Credentials</span>
              <button
                type="button"
                className="btn-quick-fill"
                onClick={handleQuickFill}
              >
                <Sparkles size={14} />
                Quick Fill Demo Data
              </button>
            </div>

            {/* Section 1: Personal Details */}
            <div className="form-section">
              <h4 className="section-title">
                <User size={18} />
                1. Personal Information
              </h4>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="Enter full legal name"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    className="form-input"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    className="form-input"
                    value={formData.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.dob}
                    onChange={(e) => handleInputChange('dob', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">PAN Card Number</label>
                  <input
                    type="text"
                    className="form-input pan-input"
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    value={formData.panNumber}
                    onChange={(e) => handleInputChange('panNumber', e.target.value.toUpperCase())}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Address */}
            <div className="form-section">
              <h4 className="section-title">
                <Building size={18} />
                2. Residential & Shipping Address
              </h4>
              <div className="form-grid-2">
                <div className="form-group span-2">
                  <label className="form-label">Street Address *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="House / Flat No., Building, Street"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">City *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="City"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">State *</label>
                  <select
                    className="form-input"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                  >
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Punjab">Punjab</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">PIN Code *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="400001"
                    maxLength={6}
                    value={formData.pincode}
                    onChange={(e) => handleInputChange('pincode', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Country</label>
                  <input
                    type="text"
                    readOnly
                    className="form-input readonly-input"
                    value="India"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Binary Placement & Sponsor Locking */}
            <div className="form-section">
              <h4 className="section-title">
                <GitBranch size={18} />
                3. Binary Placement & Lineage
              </h4>
              <div className="form-grid-2">
                {/* Auto-Identified Sponsor ID (Read-only, no manual entry needed) */}
                <div className="form-group">
                  <label className="form-label">Sponsor ID (Auto-Identified)</label>
                  <div className="readonly-sponsor-box">
                    <UserCheck size={18} className="sponsor-verified-icon" />
                    <input
                      type="text"
                      readOnly
                      className="form-input readonly-input locked-sponsor-input"
                      value={sponsorData.sponsor.distributorId}
                    />
                  </div>
                  <span className="field-hint">
                    Sponsor verified as <strong>{sponsorData.sponsor.name}</strong>.
                  </span>
                </div>

                {/* Placement Position Selection */}
                <div className="form-group">
                  <label className="form-label">Select Binary Placement Leg *</label>
                  {sponsorData.availablePositions && sponsorData.availablePositions.length === 0 ? (
                    <div
                      className="no-positions-alert"
                      style={{
                        padding: '14px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        color: '#b91c1c',
                      }}
                    >
                      <strong style={{ display: 'block', marginBottom: '4px' }}>
                        No direct position available under this sponsor.
                      </strong>
                      <span style={{ fontSize: '0.85rem' }}>
                        Both LEFT and RIGHT positions under {sponsorData.sponsor.name} (
                        {sponsorData.sponsor.distributorId}) are already occupied in the binary tree.
                      </span>
                    </div>
                  ) : (
                    <div className="leg-selector-row">
                      {sponsorData.availablePositions?.includes('LEFT') && (
                        <button
                          type="button"
                          className={`leg-choice-btn ${selectedPosition === 'LEFT' ? 'selected' : ''}`}
                          onClick={() => setSelectedPosition('LEFT')}
                        >
                          <span className="leg-label">LEFT LEG</span>
                          <span className="leg-status">Available</span>
                        </button>
                      )}

                      {sponsorData.availablePositions?.includes('RIGHT') && (
                        <button
                          type="button"
                          className={`leg-choice-btn ${selectedPosition === 'RIGHT' ? 'selected' : ''}`}
                          onClick={() => setSelectedPosition('RIGHT')}
                        >
                          <span className="leg-label">RIGHT LEG</span>
                          <span className="leg-status">Available</span>
                        </button>
                      )}
                    </div>
                  )}
                  {selectedPosition && (
                    <span className="field-hint">
                      Selected Leg: <strong>{selectedPosition}</strong> under Business Center 001.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: Starter Package */}
            <div className="form-section">
              <h4 className="section-title">
                <Package size={18} />
                4. Select Activation Starter Package
              </h4>
              <div className="package-grid">
                <label
                  className={`package-card ${formData.starterKitId === 'kit_pro' ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="starterKit"
                    value="kit_pro"
                    checked={formData.starterKitId === 'kit_pro'}
                    onChange={(e) => handleInputChange('starterKitId', e.target.value)}
                  />
                  <div className="package-content">
                    <span className="package-badge popular">Most Popular</span>
                    <h5>Professional Activation Kit</h5>
                    <div className="package-pricing">
                      <span className="package-price">$249.99</span>
                      <span className="package-bv">+100 BV Volume</span>
                    </div>
                    <p className="package-desc">
                      Includes 1 Business Center, 100 BV qualification, complete marketing brochure pack, and product samples.
                    </p>
                  </div>
                </label>

                <label
                  className={`package-card ${formData.starterKitId === 'kit_elite' ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="starterKit"
                    value="kit_elite"
                    checked={formData.starterKitId === 'kit_elite'}
                    onChange={(e) => handleInputChange('starterKitId', e.target.value)}
                  />
                  <div className="package-content">
                    <span className="package-badge executive">Executive Plan</span>
                    <h5>Elite Executive Kit</h5>
                    <div className="package-pricing">
                      <span className="package-price">$499.99</span>
                      <span className="package-bv">+200 BV Volume</span>
                    </div>
                    <p className="package-desc">
                      Activates 3 Business Centers (BC 001, BC 002, BC 003) for 3X binary commission potential.
                    </p>
                  </div>
                </label>

                <label
                  className={`package-card ${formData.starterKitId === 'kit_basic' ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="starterKit"
                    value="kit_basic"
                    checked={formData.starterKitId === 'kit_basic'}
                    onChange={(e) => handleInputChange('starterKitId', e.target.value)}
                  />
                  <div className="package-content">
                    <span className="package-badge">Entry</span>
                    <h5>Basic Starter Pack</h5>
                    <div className="package-pricing">
                      <span className="package-price">$99.99</span>
                      <span className="package-bv">+50 BV Volume</span>
                    </div>
                    <p className="package-desc">
                      Essential digital membership kit with personal website replication.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Section 5: Password & Security */}
            <div className="form-section">
              <h4 className="section-title">
                <Lock size={18} />
                5. Account Security
              </h4>
              <div className="form-grid-2">
                <div className="form-group span-2">
                  <label className="form-label">Portal Password *</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      className="form-input"
                      placeholder="Minimum 6 characters"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms Agreement */}
            <div className="terms-checkbox-row">
              <input
                type="checkbox"
                id="agree-terms"
                checked={formData.agreeTerms}
                onChange={(e) => handleInputChange('agreeTerms', e.target.checked)}
              />
              <label htmlFor="agree-terms">
                I hereby declare that the information provided is accurate and agree to abide by the
                Kashvimlm Direct Selling Guidelines, Business Partner Agreement, and Binary Code of Ethics.
              </label>
            </div>

            {submitError && (
              <div className="form-error-banner" role="alert">
                <AlertTriangle size={18} />
                <span>{submitError}</span>
              </div>
            )}

            {/* Action Bar */}
            <div className="form-submit-row">
              <button
                type="submit"
                className="btn-submit-enrollment"
                disabled={
                  isSubmitting ||
                  !formData.agreeTerms ||
                  !selectedPosition ||
                  (sponsorData?.availablePositions && sponsorData.availablePositions.length === 0)
                }
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={18} className="spin-icon" />
                    <span>Processing Enrollment...</span>
                  </>
                ) : (
                  <>
                    <UserCheck size={18} />
                    <span>Complete Partner Enrollment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </PageContainer>
  );
}

export default Join;
