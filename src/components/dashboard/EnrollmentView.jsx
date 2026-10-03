import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  User,
  MapPin,
  GitBranch,
  Package,
  Building,
  Lock,
  Sparkles,
  Printer,
  RefreshCw,
  Eye,
  EyeOff,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../services/api';
import './EnrollmentView.css';

/**
 * Professional Distributor & Customer Enrollment Portal
 * Binary MLM Enrollment with Step 3 Sponsor ID lookup & Leg availability.
 */
function EnrollmentView({ user, onNavigate }) {
  const urlParams = new URLSearchParams(window.location.search);
  const urlRef = urlParams.get('ref') || urlParams.get('sponsor');
  const initialSponsorId = urlRef || (user?.memberId && user.memberId.startsWith('KV-') ? user.memberId : (user?.memberId || 'KV-1001'));
  const sponsorId = user?.memberId || initialSponsorId || 'KV-1001';
  const sponsorName = user?.name || 'Rahul Kaushal';

  // Mode: 'distributor' (Brand Partner) | 'customer' (Preferred Customer)
  const [enrollType, setEnrollType] = useState('distributor');

  // Step wizard: 1 (Personal), 2 (Address), 3 (Placement), 4 (Starter Kit), 5 (Bank & Password)
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);

  // Prompt 5 & 6: Sponsor validation and available binary positions
  const [sponsorInput, setSponsorInput] = useState(initialSponsorId);
  const [sponsorData, setSponsorData] = useState(null);
  const [isValidatingSponsor, setIsValidatingSponsor] = useState(false);
  const [sponsorError, setSponsorError] = useState(null);
  const [selectedPlacementPosition, setSelectedPlacementPosition] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Form Data
  const [formData, setFormData] = useState({
    fullName: '',
    dob: '',
    gender: 'Male',
    email: '',
    phone: '',
    panNumber: '',
    address: '',
    city: '',
    state: 'Maharashtra',
    pincode: '',
    parentBusinessCenter: 'BC 001',
    starterKitId: 'kit_pro',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    password: '',
    agreeTerms: true,
  });

  const [copiedKey, setCopiedKey] = useState(null);
  const [enrollmentResult, setEnrollmentResult] = useState(null);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Sponsor validation call: GET /api/v1/sponsors/:sponsorId
  const handleValidateSponsor = async (idToValidate) => {
    const id = (idToValidate || sponsorInput).trim();
    if (!id) {
      setSponsorError('Please enter a Sponsor ID (e.g. KV-1001).');
      setSponsorData(null);
      return;
    }

    setIsValidatingSponsor(true);
    setSponsorError(null);

    try {
      const res = await api.validateSponsor(id);
      if (res && res.success && res.data) {
        setSponsorData(res.data);
        const avail = res.data.availablePositions || [];
        if (avail.length === 1) {
          setSelectedPlacementPosition(avail[0]);
        } else if (avail.includes(selectedPlacementPosition)) {
          // Keep current selection
        } else {
          setSelectedPlacementPosition('');
        }
      } else {
        setSponsorData(null);
        setSelectedPlacementPosition('');
        if (res?.code === 'SPONSOR_NOT_FOUND' || res?.code === 'SPONSOR_INACTIVE') {
          setSponsorError('Invalid or inactive sponsor.');
        } else {
          setSponsorError(res?.message || 'Invalid or inactive sponsor.');
        }
      }
    } catch (err) {
      setSponsorData(null);
      setSelectedPlacementPosition('');
      setSponsorError('Invalid or inactive sponsor.');
    } finally {
      setIsValidatingSponsor(false);
    }
  };

  // Immediate validation if ref was supplied via URL query
  useEffect(() => {
    if (urlRef) {
      handleValidateSponsor(urlRef);
    }
  }, [urlRef]);

  // Validate on initial Step 3 display
  useEffect(() => {
    if (currentStep === 3 && !sponsorData && !isValidatingSponsor && !sponsorError) {
      handleValidateSponsor(sponsorInput);
    }
  }, [currentStep]);

  // Pre-fill demo data for quick review
  const handlePrefillDemo = () => {
    const demoSponsor = 'KV-DEMO-1005';
    setSponsorInput(demoSponsor);
    handleValidateSponsor(demoSponsor);
    setSelectedPlacementPosition('LEFT');
    setFormData({
      fullName: 'Vikas Sharma',
      dob: '1992-06-15',
      gender: 'Male',
      email: `vikas.sharma.${Math.floor(1000 + Math.random() * 9000)}@example.com`,
      phone: '+91 98201 54321',
      panNumber: 'ABCPS1234F',
      address: 'Flat 402, Greenfield Heights, Andheri West',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400053',
      parentBusinessCenter: 'BC 001',
      starterKitId: 'kit_pro',
      bankName: 'HDFC Bank',
      accountNumber: '50100234981122',
      ifscCode: 'HDFC0000123',
      password: 'SecurePass2026!',
      agreeTerms: true,
    });
  };

  const handleSubmitEnrollment = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.phone.trim()) {
      alert('Please fill in applicant full name, email, and phone number.');
      return;
    }

    if (!selectedPlacementPosition) {
      alert('Please select an available binary placement position (LEFT or RIGHT) in Step 3.');
      setCurrentStep(3);
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

    const enrollPayload = {
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
      sponsorId: sponsorInput.trim(),
      placementParentId: sponsorInput.trim(),
      placementPosition: selectedPlacementPosition,
      enrollmentType: enrollType === 'distributor' ? 'DISTRIBUTOR' : 'CUSTOMER',
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
      password: formData.password || 'SecurePass2026!',
    };

    try {
      const res = await api.submitCompleteEnrollment(enrollPayload);
      if (res && res.success && res.data) {
        const d = res.data;
        const result = {
          memberId: d.distributor?.distributorId || d.distributor?.distributorCode || 'KV-NEW',
          name: d.distributor?.displayName || formData.fullName,
          email: d.user?.email || formData.email,
          phone: formData.phone,
          type: enrollType === 'distributor' ? 'Brand Partner / Associate' : 'Preferred Customer',
          sponsorId: d.sponsor?.distributorId || sponsorInput,
          sponsorName: d.sponsor?.displayName || sponsorData?.sponsor?.name || sponsorName,
          placement: `${d.placement?.position} Leg (Depth ${d.placement?.depth})`,
          placementParent: d.placement?.placementParentDistributorId || sponsorInput,
          assignedBV: kitBV,
          enrolledAt: new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          status: 'Active & Commission Qualified',
        };

        // Save into downline history in localStorage
        try {
          const existing = JSON.parse(localStorage.getItem('kashvi_downline_team') || '[]');
          existing.unshift(result);
          localStorage.setItem('kashvi_downline_team', JSON.stringify(existing));
        } catch {
          // ignore
        }

        setEnrollmentResult(result);
      } else {
        const errorMsg = res?.message || 'Enrollment transaction failed. Please check placement availability.';
        setSubmitError(errorMsg);
        alert(`Enrollment Failed: ${errorMsg}`);
      }
    } catch (err) {
      setSubmitError(err.message || 'Network error occurred during enrollment submission.');
      alert(`Enrollment Submission Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setEnrollmentResult(null);
    setCurrentStep(1);
    setFormData({
      fullName: '',
      dob: '',
      gender: 'Male',
      email: '',
      phone: '',
      panNumber: '',
      address: '',
      city: '',
      state: 'Maharashtra',
      pincode: '',
      placementLeg: 'auto',
      parentBusinessCenter: 'BC 001',
      starterKitId: 'kit_pro',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      password: '',
      agreeTerms: true,
    });
  };

  // SUCCESS CONFIRMATION SCREEN
  if (enrollmentResult) {
    return (
      <div className="enroll-page-container">
        <div className="enroll-success-card">
          <div className="enroll-success-header">
            <div className="success-icon-badge">
              <CheckCircle2 size={36} />
            </div>
            <h2 className="success-title">Enrollment Successful!</h2>
            <p className="success-subtitle">
              New {enrollmentResult.type} has been officially registered and placed into your
              KASHVIMLM binary tree.
            </p>
          </div>

          <div className="enroll-credentials-box">
            <div className="credential-row">
              <span className="cred-label">New Member ID:</span>
              <div className="cred-val-wrap">
                <strong className="cred-val highlight">{enrollmentResult.memberId}</strong>
                <button
                  type="button"
                  className="cred-copy-btn"
                  onClick={() => handleCopy(enrollmentResult.memberId, 'id')}
                >
                  {copiedKey === 'id' ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedKey === 'id' ? 'Copied' : 'Copy ID'}</span>
                </button>
              </div>
            </div>

            <div className="credential-row">
              <span className="cred-label">Member Full Name:</span>
              <span className="cred-val">{enrollmentResult.name}</span>
            </div>

            <div className="credential-row">
              <span className="cred-label">Sponsoring Partner:</span>
              <span className="cred-val">
                {enrollmentResult.sponsorName} (ID: {enrollmentResult.sponsorId})
              </span>
            </div>

            <div className="credential-row">
              <span className="cred-label">Tree Placement Leg:</span>
              <span className="cred-val">{enrollmentResult.placement}</span>
            </div>

            <div className="credential-row">
              <span className="cred-label">Credited Volume:</span>
              <span className="cred-val font-semibold text-teal">
                +{enrollmentResult.assignedBV} CVP / BV Points
              </span>
            </div>

            <div className="credential-row">
              <span className="cred-label">Official Status:</span>
              <span className="status-badge-active">{enrollmentResult.status}</span>
            </div>

            <div className="credential-row">
              <span className="cred-label">Personal Referral Link:</span>
              <div className="cred-val-wrap">
                <span className="cred-val highlight">{`${window.location.origin}/join?ref=${enrollmentResult.memberId}`}</span>
                <button
                  type="button"
                  className="cred-copy-btn"
                  onClick={() =>
                    handleCopy(`${window.location.origin}/join?ref=${enrollmentResult.memberId}`, 'refUrl')
                  }
                >
                  {copiedKey === 'refUrl' ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedKey === 'refUrl' ? 'Copied' : 'Copy Referral Link'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="enroll-success-actions">
            <button
              type="button"
              className="btn-enroll-action primary"
              onClick={() => {
                window.print();
              }}
            >
              <Printer size={16} />
              <span>Print Welcome Certificate</span>
            </button>

            <button
              type="button"
              className="btn-enroll-action secondary"
              onClick={handleResetForm}
            >
              <RefreshCw size={16} />
              <span>Enroll Another Partner</span>
            </button>

            <button
              type="button"
              className="btn-enroll-action outline"
              onClick={() => onNavigate('dashboard')}
            >
              <ArrowRight size={16} />
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="enroll-page-container">
      {/* Top Header Banner */}
      <div className="enroll-top-banner">
        <div className="enroll-banner-left">
          <div className="enroll-badge">
            <UserPlus size={16} />
            <span>KASHVIMLM ENROLLMENT PORTAL</span>
          </div>
          <h1 className="enroll-main-title">Enroll New Distributor or Customer</h1>
          <p className="enroll-main-desc">
            Sponsor a new Brand Partner or Preferred Customer directly under your Business Center
            network. Commission volume points (BV) are instantly added to your weekly payout leg.
          </p>
        </div>

        {/* Sponsor Identity Verification Badge */}
        <div className="sponsor-verification-card">
          <div className="sponsor-verified-header">
            <ShieldCheck size={18} className="shield-icon" />
            <span className="sponsor-label">Verified Sponsor</span>
          </div>
          <div className="sponsor-name">{sponsorName}</div>
          <div className="sponsor-meta">
            <span>Sponsor ID: <strong>{sponsorId}</strong></span>
            <span className="meta-dot">•</span>
            <span>Market: 🇮🇳 India</span>
          </div>
          <button
            type="button"
            className="btn-prefill-demo"
            onClick={handlePrefillDemo}
            title="Autofill sample registration data for quick testing"
          >
            <Sparkles size={13} />
            <span>Autofill Sample Applicant</span>
          </button>
        </div>
      </div>

      {/* Role / Account Type Selector Tabs */}
      <div className="enroll-type-switcher">
        <button
          type="button"
          className={`type-tab-btn ${enrollType === 'distributor' ? 'active' : ''}`}
          onClick={() => setEnrollType('distributor')}
        >
          <Building size={18} />
          <div className="type-tab-text">
            <strong>Brand Partner / Associate</strong>
            <span>Eligible for weekly binary commission, bonuses & 3 Business Centers</span>
          </div>
        </button>

        <button
          type="button"
          className={`type-tab-btn ${enrollType === 'customer' ? 'active' : ''}`}
          onClick={() => setEnrollType('customer')}
        >
          <User size={18} />
          <div className="type-tab-text">
            <strong>Preferred Customer (PC)</strong>
            <span>Enjoys 10% wholesale discount on all products without selling obligations</span>
          </div>
        </button>
      </div>

      {/* Multi-Step Wizard Card */}
      <div className="enroll-form-card">
        {/* Step Indicator Header */}
        <div className="wizard-step-indicators">
          <button
            type="button"
            className={`step-bubble ${currentStep === 1 ? 'current' : currentStep > 1 ? 'completed' : ''}`}
            onClick={() => setCurrentStep(1)}
          >
            <span className="step-num">1</span>
            <span className="step-title">Personal Info</span>
          </button>

          <button
            type="button"
            className={`step-bubble ${currentStep === 2 ? 'current' : currentStep > 2 ? 'completed' : ''}`}
            onClick={() => setCurrentStep(2)}
          >
            <span className="step-num">2</span>
            <span className="step-title">Address & PIN</span>
          </button>

          <button
            type="button"
            className={`step-bubble ${currentStep === 3 ? 'current' : currentStep > 3 ? 'completed' : ''}`}
            onClick={() => setCurrentStep(3)}
          >
            <span className="step-num">3</span>
            <span className="step-title">Tree Placement</span>
          </button>

          {enrollType === 'distributor' && (
            <button
              type="button"
              className={`step-bubble ${currentStep === 4 ? 'current' : currentStep > 4 ? 'completed' : ''}`}
              onClick={() => setCurrentStep(4)}
            >
              <span className="step-num">4</span>
              <span className="step-title">Starter Kit</span>
            </button>
          )}

          <button
            type="button"
            className={`step-bubble ${currentStep === 5 ? 'current' : ''}`}
            onClick={() => setCurrentStep(5)}
          >
            <span className="step-num">{enrollType === 'distributor' ? '5' : '4'}</span>
            <span className="step-title">Bank & Security</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmitEnrollment} className="wizard-form-body">
          {/* STEP 1: PERSONAL INFORMATION */}
          {currentStep === 1 && (
            <div className="step-content-section">
              <div className="step-header">
                <User size={20} className="step-icon" />
                <div>
                  <h3 className="step-main-title">Applicant Identity & Contact Information</h3>
                  <p className="step-sub-desc">
                    Enter the legal name as per PAN or Aadhaar card for KYC compliance and direct payout.
                  </p>
                </div>
              </div>

              <div className="form-fields-grid two-cols">
                {/* 1. Name */}
                <div className="form-group">
                  <label className="field-label">
                    Name <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Name"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    className="field-input"
                  />
                </div>

                {/* 2. Email */}
                <div className="form-group">
                  <label className="field-label">Email <span className="req">*</span></label>
                  <input
                    type="email"
                    required
                    placeholder="Email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="field-input"
                  />
                </div>

                {/* 3. Mobile Number */}
                <div className="form-group">
                  <label className="field-label">Mobile Number <span className="req">*</span></label>
                  <input
                    type="tel"
                    required
                    placeholder="Mobile Number"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="field-input"
                  />
                </div>

                {/* Date of Birth */}
                <div className="form-group">
                  <label className="field-label">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => handleInputChange('dob', e.target.value)}
                    className="field-input"
                  />
                </div>
              </div>

              <div className="step-nav-footer">
                <span />
                <button
                  type="button"
                  className="btn-wizard-next"
                  onClick={() => setCurrentStep(2)}
                >
                  <span>Continue to Address</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: SHIPPING & ADDRESS */}
          {currentStep === 2 && (
            <div className="step-content-section">
              <div className="step-header">
                <MapPin size={20} className="step-icon" />
                <div>
                  <h3 className="step-main-title">Shipping & Communication Address</h3>
                  <p className="step-sub-desc">
                    Physical address where the welcome package and distributor product orders will be delivered.
                  </p>
                </div>
              </div>

              <div className="form-fields-grid">
                <div className="form-group full-width">
                  <label className="field-label">Address <span className="req">*</span></label>
                  <input
                    type="text"
                    placeholder="Address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className="field-input"
                  />
                </div>

                <div className="form-group">
                  <label className="field-label">City / Town <span className="req">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai, New Delhi, Bengaluru"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className="field-input"
                  />
                </div>

                <div className="form-group">
                  <label className="field-label">State <span className="req">*</span></label>
                  <select
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    className="field-select"
                  >
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Delhi">Delhi NCR</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Haryana">Haryana</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Telangana">Telangana</option>
                    <option value="West Bengal">West Bengal</option>
                    <option value="Punjab">Punjab</option>
                    <option value="Rajasthan">Rajasthan</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="field-label">Postal PIN Code <span className="req">*</span></label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="400053"
                    value={formData.pincode}
                    onChange={(e) => handleInputChange('pincode', e.target.value)}
                    className="field-input"
                  />
                </div>
              </div>

              <div className="step-nav-footer">
                <button
                  type="button"
                  className="btn-wizard-back"
                  onClick={() => setCurrentStep(1)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn-wizard-next"
                  onClick={() => setCurrentStep(3)}
                >
                  <span>Continue to Tree Placement</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: BINARY TREE PLACEMENT */}
          {currentStep === 3 && (
            <div className="step-content-section">
              <div className="step-header">
                <GitBranch size={20} className="step-icon" />
                <div>
                  <h3 className="step-main-title">Binary Organization Placement</h3>
                  <p className="step-sub-desc">
                    Enter the Sponsor ID to check available direct placement legs in the binary tree.
                  </p>
                </div>
              </div>

              {/* Sponsor ID input & search */}
              <div className="sponsor-search-container">
                <label className="field-label">
                  Sponsor ID <span className="req">*</span>
                </label>
                <div className="sponsor-input-wrapper">
                  <input
                    type="text"
                    className="field-input uppercase"
                    placeholder="e.g. KV-1001"
                    value={sponsorInput}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setSponsorInput(val);
                      setSelectedPlacementPosition('');
                      setSponsorData(null);
                      setSponsorError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleValidateSponsor(sponsorInput);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-verify-sponsor"
                    onClick={() => handleValidateSponsor(sponsorInput)}
                    disabled={isValidatingSponsor || !sponsorInput.trim()}
                  >
                    {isValidatingSponsor ? <RefreshCw size={16} className="spin" /> : <Search size={16} />}
                    <span>{isValidatingSponsor ? 'Verifying...' : 'Verify Sponsor'}</span>
                  </button>
                </div>
                <span className="field-hint">
                  Enter Sponsor ID (e.g. <strong>KV-1001</strong> or <strong>KV-DEMO-1005</strong>).
                </span>
              </div>

              {/* Sponsor validation error alert */}
              {sponsorError && (
                <div className="sponsor-error-alert">
                  <AlertTriangle size={18} />
                  <span>{sponsorError}</span>
                </div>
              )}

              {/* Sponsor Details Card (Prompt 5 requirement) */}
              {sponsorData && (
                <div className="sponsor-details-card">
                  <div className="sponsor-card-header">
                    <div className="sponsor-avatar">
                      <User size={24} />
                    </div>
                    <div className="sponsor-info-col">
                      <div className="sponsor-meta-row">
                        <span className="sponsor-label">Sponsor:</span>
                        <strong className="sponsor-name">{sponsorData.sponsor.name}</strong>
                      </div>
                      <div className="sponsor-meta-row">
                        <span className="sponsor-label">Distributor ID:</span>
                        <span className="sponsor-dist-id">{sponsorData.sponsor.distributorId}</span>
                      </div>
                      <div className="sponsor-meta-row">
                        <span className="sponsor-label">Status:</span>
                        <span className={`status-badge ${sponsorData.sponsor.status.toLowerCase()}`}>
                          {sponsorData.sponsor.status === 'ACTIVE' ? 'Active' : sponsorData.sponsor.status}
                        </span>
                      </div>
                    </div>

                    <div className="sponsor-card-copy-col">
                      <button
                        type="button"
                        className="btn-copy-sponsor-link"
                        onClick={() =>
                          handleCopy(
                            `${window.location.origin}/join?ref=${sponsorData.sponsor.distributorId}`,
                            'sponsorRefLink'
                          )
                        }
                      >
                        {copiedKey === 'sponsorRefLink' ? <Check size={14} /> : <Copy size={14} />}
                        <span>
                          {copiedKey === 'sponsorRefLink' ? 'Copied Link!' : 'Copy Referral Link'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Available Positions section */}
                  <div className="available-positions-section">
                    <div className="positions-header">
                      <span className="positions-title">Available Binary Leg Placement:</span>
                      {sponsorData.availablePositions && sponsorData.availablePositions.length > 0 && (
                        <span className="positions-count-tag">
                          {sponsorData.availablePositions.join(' & ')}
                        </span>
                      )}
                    </div>

                    {sponsorData.availablePositions && sponsorData.availablePositions.length > 0 ? (
                      <div className="placement-options-grid">
                        {sponsorData.availablePositions.includes('LEFT') && (
                          <label
                            className={`placement-radio-card ${
                              selectedPlacementPosition === 'LEFT' ? 'selected' : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name="placementLeg"
                              value="LEFT"
                              checked={selectedPlacementPosition === 'LEFT'}
                              onChange={() => setSelectedPlacementPosition('LEFT')}
                            />
                            <div className="placement-card-body">
                              <div className="placement-pill recommended">Available</div>
                              <strong className="placement-title">LEFT Leg</strong>
                              <p className="placement-desc">
                                Directly enrolls into the LEFT leg under {sponsorData.sponsor.name}.
                                Increases Left Leg Group Volume (LGV).
                              </p>
                            </div>
                          </label>
                        )}

                        {sponsorData.availablePositions.includes('RIGHT') && (
                          <label
                            className={`placement-radio-card ${
                              selectedPlacementPosition === 'RIGHT' ? 'selected' : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name="placementLeg"
                              value="RIGHT"
                              checked={selectedPlacementPosition === 'RIGHT'}
                              onChange={() => setSelectedPlacementPosition('RIGHT')}
                            />
                            <div className="placement-card-body">
                              <div className="placement-pill recommended">Available</div>
                              <strong className="placement-title">RIGHT Leg</strong>
                              <p className="placement-desc">
                                Directly enrolls into the RIGHT leg under {sponsorData.sponsor.name}.
                                Increases Right Leg Group Volume (RGV).
                              </p>
                            </div>
                          </label>
                        )}
                      </div>
                    ) : (
                      <div className="no-positions-alert">
                        <AlertTriangle size={20} className="alert-icon" />
                        <div>
                          <h4 className="alert-heading">No direct position available under this sponsor.</h4>
                          <p>
                            Both LEFT and RIGHT positions under {sponsorData.sponsor.name} (
                            {sponsorData.sponsor.distributorId}) are already occupied in the binary tree.
                            Please enter a different placement parent or sponsor.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="step-nav-footer">
                <button
                  type="button"
                  className="btn-wizard-back"
                  onClick={() => setCurrentStep(2)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn-wizard-next"
                  disabled={
                    !sponsorData ||
                    !sponsorData.availablePositions ||
                    sponsorData.availablePositions.length === 0 ||
                    !selectedPlacementPosition
                  }
                  onClick={() => setCurrentStep(enrollType === 'distributor' ? 4 : 5)}
                >
                  <span>Continue</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: STARTER KIT SELECTION (DISTRIBUTORS ONLY) */}
          {enrollType === 'distributor' && currentStep === 4 && (
            <div className="step-content-section">
              <div className="step-header">
                <Package size={20} className="step-icon" />
                <div>
                  <h3 className="step-main-title">Select Initial Business Activation Kit</h3>
                  <p className="step-sub-desc">
                    Starter packs immediately credit Commission Volume Points (BV) to both you and the new enrollee.
                  </p>
                </div>
              </div>

              <div className="kits-selection-grid">
                <label className={`kit-select-card ${formData.starterKitId === 'kit_basic' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="starterKitId"
                    value="kit_basic"
                    checked={formData.starterKitId === 'kit_basic'}
                    onChange={() => handleInputChange('starterKitId', 'kit_basic')}
                  />
                  <div className="kit-card-inner">
                    <div className="kit-badge-tag">Basic Launch</div>
                    <h4 className="kit-title">Associate Welcome Pack</h4>
                    <div className="kit-price">₹1,200</div>
                    <div className="kit-bv-pill">+50 BV Points</div>
                    <p className="kit-desc">
                      Official product guides, distributor agreement, and digital KASHVIMLM Connect license.
                    </p>
                  </div>
                </label>

                <label className={`kit-select-card popular ${formData.starterKitId === 'kit_pro' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="starterKitId"
                    value="kit_pro"
                    checked={formData.starterKitId === 'kit_pro'}
                    onChange={() => handleInputChange('starterKitId', 'kit_pro')}
                  />
                  <div className="kit-card-inner">
                    <div className="kit-badge-tag popular-tag">Most Popular</div>
                    <h4 className="kit-title">Fast-Track Pro Pack</h4>
                    <div className="kit-price">₹4,999</div>
                    <div className="kit-bv-pill text-teal">+100 BV Points</div>
                    <p className="kit-desc">
                      Includes 3 best-selling nutritional products, 3 Business Centers, and marketing collateral.
                    </p>
                  </div>
                </label>

                <label className={`kit-select-card ${formData.starterKitId === 'kit_elite' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="starterKitId"
                    value="kit_elite"
                    checked={formData.starterKitId === 'kit_elite'}
                    onChange={() => handleInputChange('starterKitId', 'kit_elite')}
                  />
                  <div className="kit-card-inner">
                    <div className="kit-badge-tag">Executive</div>
                    <h4 className="kit-title">Elite Leadership Pack</h4>
                    <div className="kit-price">₹12,999</div>
                    <div className="kit-bv-pill">+200 BV Points</div>
                    <p className="kit-desc">
                      Full cellular nutrition line, skincare samples, active shaker bottles, and personal mentoring pass.
                    </p>
                  </div>
                </label>
              </div>

              <div className="step-nav-footer">
                <button
                  type="button"
                  className="btn-wizard-back"
                  onClick={() => setCurrentStep(3)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn-wizard-next"
                  onClick={() => setCurrentStep(5)}
                >
                  <span>Continue to Bank & Password</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: BANK DEPOSIT & SECURITY */}
          {currentStep === 5 && (
            <div className="step-content-section">
              <div className="step-header">
                <Lock size={20} className="step-icon" />
                <div>
                  <h3 className="step-main-title">Direct Payout Bank Account & Login Security</h3>
                  <p className="step-sub-desc">
                    Weekly commissions are transferred directly into this account every Monday.
                  </p>
                </div>
              </div>

              <div className="form-fields-grid two-cols">
                <div className="form-group">
                  <label className="field-label">Bank Name</label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC Bank, ICICI, SBI"
                    value={formData.bankName}
                    onChange={(e) => handleInputChange('bankName', e.target.value)}
                    className="field-input"
                  />
                </div>

                <div className="form-group">
                  <label className="field-label">Bank Account Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 50100234981122"
                    value={formData.accountNumber}
                    onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                    className="field-input"
                  />
                </div>

                <div className="form-group">
                  <label className="field-label">Bank IFSC Code</label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC0000123"
                    value={formData.ifscCode}
                    onChange={(e) => handleInputChange('ifscCode', e.target.value.toUpperCase())}
                    className="field-input uppercase"
                  />
                </div>

                <div className="form-group">
                  <label className="field-label">Create Initial Account Password <span className="req">*</span></label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className="field-input"
                      style={{ paddingRight: '2.5rem', width: '100%' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.35rem'
                      }}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span className="field-hint">Enrollee can change this password after first login</span>
                </div>

                <div className="form-group full-width terms-row">
                  <label className="terms-checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.agreeTerms}
                      onChange={(e) => handleInputChange('agreeTerms', e.target.checked)}
                      required
                    />
                    <span>
                      I certify that the applicant has agreed to the{' '}
                      <strong>KASHVIMLM Distributor Agreement</strong>, Code of Ethics, and policies
                      governing direct selling under the Consumer Protection (Direct Selling) Rules.
                    </span>
                  </label>
                </div>
              </div>

              {submitError && (
                <div className="submit-error-alert">
                  <AlertTriangle size={18} />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="step-nav-footer">
                <button
                  type="button"
                  className="btn-wizard-back"
                  onClick={() => setCurrentStep(enrollType === 'distributor' ? 4 : 3)}
                  disabled={isSubmitting}
                >
                  Back
                </button>

                <button
                  type="submit"
                  className="btn-wizard-submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <RefreshCw size={18} className="spin" /> : <UserPlus size={18} />}
                  <span>{isSubmitting ? 'Processing Registration...' : 'Submit & Complete Enrollment'}</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default EnrollmentView;
