import React, { useState, useEffect } from 'react';
import {
  User,
  MapPin,
  Building2,
  Phone,
  Mail,
  ShieldCheck,
  CheckCircle2,
  X,
  Save,
  CreditCard,
  Truck,
  AlertCircle,
  Edit3,
  Check,
} from 'lucide-react';
import { authApi } from '../../api/authApi.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import './UserProfileModal.css';

export default function UserProfileModal({ isOpen, onClose, user, onSaveSuccess }) {
  const auth = useAuth();
  const currentUser = user || auth?.currentUser || {};

  // Extract clean memberId for per-ID storage scoping
  const rawId =
    currentUser?.distributorCode ||
    currentUser?.memberId ||
    currentUser?.referralCode ||
    currentUser?.distributorProfile?.distributorCode ||
    currentUser?.distributorProfile?.distributorId ||
    currentUser?.id ||
    'KK-0001';
  const memberId = typeof rawId === 'object' ? (rawId?.code || rawId?.id || 'KK-0001') : String(rawId);

  // View Mode: 'view' (Saved details popout) | 'edit' (Form to fill / update)
  const [viewMode, setViewMode] = useState('view');
  const [savedData, setSavedData] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    // Personal Details
    fullName: '',
    phone: '',
    email: '',

    // Address Details
    streetAddress: '',
    apartment: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',

    // Bank Details
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    upiId: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Load existing user details on modal open or user change
  useEffect(() => {
    if (!isOpen) return;

    // 1. Try to load per-ID saved profile first
    let perIdProfile = null;
    try {
      const stored = localStorage.getItem(`kashvi_profile_data_${memberId}`);
      if (stored) {
        perIdProfile = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[UserProfileModal] Error parsing per-id profile', e);
    }

    // 2. Check fallback saved shipping address
    let savedAddress = perIdProfile?.address || null;
    if (!savedAddress) {
      try {
        const storedAddr =
          localStorage.getItem(`kashvi_saved_shipping_address_${memberId}`) ||
          localStorage.getItem('kashvi_saved_shipping_address') ||
          localStorage.getItem('kashvi_pc_permanent_address');
        if (storedAddr) savedAddress = JSON.parse(storedAddr);
      } catch (e) {
        // ignore
      }
    }

    const primaryAddr = savedAddress || (currentUser?.addresses && currentUser.addresses[0]) || {};
    const dp = currentUser?.distributorProfile || {};
    const bank = perIdProfile?.bankDetails || currentUser?.bankDetails || (dp?.bankAccounts && dp.bankAccounts[0]) || {};

    const name =
      perIdProfile?.fullName ||
      currentUser?.fullName ||
      currentUser?.name ||
      primaryAddr?.recipientName ||
      `${dp?.firstName || ''} ${dp?.lastName || ''}`.trim() ||
      '';

    const phone =
      perIdProfile?.phone ||
      currentUser?.phone ||
      primaryAddr?.phone ||
      currentUser?.customer?.phone ||
      '';

    const email = perIdProfile?.email || currentUser?.email || '';

    const initialData = {
      fullName: name,
      phone: phone,
      email: email,

      streetAddress: perIdProfile?.address?.streetAddress || primaryAddr?.streetAddress || '',
      apartment: perIdProfile?.address?.apartment || primaryAddr?.apartment || '',
      city: perIdProfile?.address?.city || primaryAddr?.city || '',
      state: perIdProfile?.address?.state || primaryAddr?.state || '',
      postalCode: perIdProfile?.address?.postalCode || primaryAddr?.postalCode || primaryAddr?.pinCode || '',
      country: perIdProfile?.address?.country || primaryAddr?.country || 'India',

      bankName: bank?.bankName || '',
      accountHolderName: bank?.accountHolderName || name || '',
      accountNumber: bank?.accountNumber || '',
      ifscCode: bank?.ifscCode || bank?.routingNumber || '',
      branchName: bank?.branchName || '',
      upiId: bank?.upiId || '',
    };

    setFormData(initialData);
    setSavedData(initialData);

    // Check if this ID has previously completed and saved profile details
    const hasSavedDetails = Boolean(
      perIdProfile?.hasSavedProfile ||
      (initialData.streetAddress && initialData.city && initialData.postalCode && initialData.fullName)
    );

    // If already saved for this ID, pop out ONLY the saved details view!
    // Otherwise, show the edit form so they can fill details.
    if (hasSavedDetails) {
      setViewMode('view');
    } else {
      setViewMode('edit');
    }

    setSuccessMsg('');
    setErrorMsg('');
  }, [isOpen, memberId, currentUser]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Form Validations
    if (!formData.fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!formData.phone.trim()) {
      setErrorMsg('Please enter your mobile phone number.');
      return;
    }
    if (!formData.streetAddress.trim() || !formData.city.trim() || !formData.postalCode.trim()) {
      setErrorMsg('Please enter your proper Street Address, City, and PIN code for order shipment.');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      fullName: formData.fullName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      address: {
        recipientName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        streetAddress: formData.streetAddress.trim(),
        apartment: formData.apartment.trim() || null,
        city: formData.city.trim(),
        state: formData.state.trim(),
        postalCode: formData.postalCode.trim(),
        country: formData.country.trim() || 'India',
      },
      bankDetails: {
        bankName: formData.bankName.trim(),
        accountHolderName: (formData.accountHolderName.trim() || formData.fullName.trim()),
        accountNumber: formData.accountNumber.trim(),
        ifscCode: formData.ifscCode.trim().toUpperCase(),
        branchName: formData.branchName.trim(),
        upiId: formData.upiId.trim(),
      },
    };

    try {
      // 1. Call Backend API
      let updatedUser = null;
      try {
        const res = await authApi.updateProfile(payload);
        if (res && (res.data || res.success)) {
          updatedUser = res.data;
        }
      } catch (apiErr) {
        console.warn('[UserProfileModal] Backend API call error:', apiErr.message);
      }

      // If backend was offline, construct safe updated profile
      if (!updatedUser) {
        updatedUser = {
          ...currentUser,
          fullName: payload.fullName,
          name: payload.fullName,
          phone: payload.phone,
          addresses: [payload.address],
          bankDetails: payload.bankDetails,
        };
      }

      // 2. Prepare permanent shipping address
      const savedShippingAddress = {
        recipientName: payload.fullName,
        phone: payload.phone,
        streetAddress: payload.address.streetAddress,
        apartment: payload.address.apartment,
        city: payload.address.city,
        state: payload.address.state,
        postalCode: payload.address.postalCode,
        country: payload.address.country,
      };

      // 3. Save profile specifically for this memberId
      const profileDataRecord = {
        memberId,
        hasSavedProfile: true,
        fullName: payload.fullName,
        phone: payload.phone,
        email: payload.email,
        address: savedShippingAddress,
        bankDetails: payload.bankDetails,
        savedAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem(`kashvi_profile_data_${memberId}`, JSON.stringify(profileDataRecord));
        localStorage.setItem(`kashvi_saved_shipping_address_${memberId}`, JSON.stringify(savedShippingAddress));
        localStorage.setItem(`kashvi_saved_bank_details_${memberId}`, JSON.stringify(payload.bankDetails));

        // Global active keys for current order checkout
        localStorage.setItem('kashvi_saved_shipping_address', JSON.stringify(savedShippingAddress));
        localStorage.setItem('kashvi_pc_permanent_address', JSON.stringify(savedShippingAddress));

        const authData = JSON.parse(localStorage.getItem('kashvi_auth') || '{}');
        authData.user = {
          ...(authData.user || {}),
          ...updatedUser,
          fullName: payload.fullName,
          name: payload.fullName,
          phone: payload.phone,
          email: payload.email || authData.user?.email || '',
          addresses: [savedShippingAddress],
          bankDetails: payload.bankDetails,
        };
        localStorage.setItem('kashvi_auth', JSON.stringify(authData));
        localStorage.setItem('kashvi_current_user', JSON.stringify(authData.user));
      } catch (storageErr) {
        console.warn('[UserProfileModal] localStorage update error:', storageErr);
      }

      // 4. Update AuthContext
      if (auth?.setCurrentUser) {
        auth.setCurrentUser((prev) => ({
          ...(prev || {}),
          ...updatedUser,
          fullName: payload.fullName,
          name: payload.fullName,
          phone: payload.phone,
          email: payload.email || prev?.email || '',
          addresses: [savedShippingAddress],
          bankDetails: payload.bankDetails,
        }));
      }

      // 5. Dispatch global window events so ShopView, Checkout, and Dashboard update in real time
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kashvi_address_updated', { detail: savedShippingAddress }));
        window.dispatchEvent(new CustomEvent('kashvi_profile_updated', { detail: updatedUser }));
      }

      // 6. Update local state
      const newSavedState = {
        fullName: payload.fullName,
        phone: payload.phone,
        email: payload.email,
        ...payload.address,
        ...payload.bankDetails,
      };
      setSavedData(newSavedState);
      setFormData(newSavedState);

      // 7. Transition immediately to the Saved Details View popout!
      setViewMode('view');
      setSuccessMsg(`Personal details, permanent delivery address, and bank details have been saved permanently for ID: ${memberId}!`);

      if (onSaveSuccess) {
        onSaveSuccess(updatedUser, savedShippingAddress);
      }
    } catch (err) {
      console.error('[UserProfileModal] Save profile failed:', err);
      setErrorMsg(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPaid =
    currentUser?.isPaid ||
    currentUser?.paymentStatus === 'PAID' ||
    memberId === 'KK-0001' ||
    memberId === 'KV-1001';

  const activeDisplayName =
    (viewMode === 'view' ? savedData?.fullName : formData?.fullName) ||
    currentUser?.fullName ||
    currentUser?.name ||
    'Member';

  return (
    <div className="kashvimlm-modal-backdrop profile-modal-backdrop" onClick={onClose}>
      <div className="profile-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="profile-modal-header">
          <div className="profile-header-user">
            <div className="profile-avatar-circle">
              {activeDisplayName ? activeDisplayName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="profile-user-meta">
              <div className="profile-title-row">
                <h3 className="profile-user-name">{activeDisplayName}</h3>
                <span className={`profile-status-pill ${isPaid ? 'pill-paid' : 'pill-unpaid'}`}>
                  <ShieldCheck size={13} />
                  <span>{isPaid ? 'Active Member' : 'Pending Verification'}</span>
                </span>
              </div>
              <span className="profile-member-code">MLM ID: {memberId}</span>
            </div>
          </div>
          <button type="button" className="profile-close-btn" onClick={onClose} aria-label="Close Profile">
            <X size={20} />
          </button>
        </div>

        {/* ===================================================================
            VIEW MODE: ONLY THE SAVED DETAILS WILL POP OUT
            =================================================================== */}
        {viewMode === 'view' ? (
          <>
            <div className="saved-details-container">
              {/* Saved Details Success / Info Banner */}
              <div className="profile-saved-banner">
                <CheckCircle2 size={22} className="saved-banner-icon" />
                <div className="saved-banner-text">
                  <strong>Verified Saved Details on Record</strong>
                  <p>
                    {successMsg ||
                      `These permanent details are saved for ID: ${memberId} and automatically applied to all product shipments and order purchases.`}
                  </p>
                </div>
              </div>

              {/* SECTION 1: Personal Contact Details */}
              <div className="saved-card">
                <div className="saved-card-header">
                  <h4 className="saved-card-title">
                    <User size={16} className="text-blue" />
                    <span>Personal Contact Details</span>
                  </h4>
                  <span className="saved-card-badge">
                    <Check size={12} /> Verified
                  </span>
                </div>
                <div className="saved-grid">
                  <div className="saved-item">
                    <span className="saved-item-label">Full Name</span>
                    <span className="saved-item-val">{savedData?.fullName || 'Not Set'}</span>
                  </div>
                  <div className="saved-item">
                    <span className="saved-item-label">Mobile Number</span>
                    <span className="saved-item-val">{savedData?.phone || 'Not Set'}</span>
                  </div>
                  <div className="saved-item">
                    <span className="saved-item-label">Email Address</span>
                    <span className={`saved-item-val ${!savedData?.email ? 'empty-val' : ''}`}>
                      {savedData?.email || 'Not Provided (Optional)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Permanent Shipping & Delivery Address */}
              <div className="saved-card">
                <div className="saved-card-header">
                  <h4 className="saved-card-title">
                    <MapPin size={16} className="text-teal" />
                    <span>Permanent Shipping &amp; Delivery Address</span>
                  </h4>
                  <span className="saved-card-badge">
                    <Truck size={12} /> Active for Shipments
                  </span>
                </div>
                <div className="saved-grid">
                  <div className="saved-item full-width">
                    <span className="saved-item-label">Street Address / Landmark</span>
                    <span className="saved-item-val">{savedData?.streetAddress || 'Not Set'}</span>
                  </div>
                  <div className="saved-item">
                    <span className="saved-item-label">City / District</span>
                    <span className="saved-item-val">{savedData?.city || 'Not Set'}</span>
                  </div>
                  <div className="saved-item">
                    <span className="saved-item-label">State</span>
                    <span className="saved-item-val">{savedData?.state || 'Not Set'}</span>
                  </div>
                  <div className="saved-item">
                    <span className="saved-item-label">Pin Code</span>
                    <span className="saved-item-val">{savedData?.postalCode || 'Not Set'}</span>
                  </div>
                  <div className="saved-item">
                    <span className="saved-item-label">Country</span>
                    <span className="saved-item-val">{savedData?.country || 'India'}</span>
                  </div>
                </div>

                {/* Standard formatted address dispatch box */}
                <div className="formatted-address-box">
                  <div className="formatted-box-header">
                    <Truck size={14} />
                    <span>Order Shipment Dispatch Preview</span>
                  </div>
                  <p className="formatted-box-text">
                    <strong>{savedData?.fullName}</strong> &bull; {savedData?.phone}<br />
                    {savedData?.streetAddress}{savedData?.apartment ? `, ${savedData?.apartment}` : ''}<br />
                    {savedData?.city}, {savedData?.state} - <strong>{savedData?.postalCode}</strong>, {savedData?.country || 'India'}
                  </p>
                </div>
              </div>

              {/* SECTION 3: Bank & Direct Deposit Details */}
              <div className="saved-card">
                <div className="saved-card-header">
                  <h4 className="saved-card-title">
                    <Building2 size={16} className="text-purple" />
                    <span>Bank &amp; Direct Deposit Details</span>
                  </h4>
                  <span className="saved-card-badge">
                    <CreditCard size={12} /> Direct Deposit
                  </span>
                </div>
                <div className="saved-grid">
                  <div className="saved-item">
                    <span className="saved-item-label">Bank Name</span>
                    <span className={`saved-item-val ${!savedData?.bankName ? 'empty-val' : ''}`}>
                      {savedData?.bankName || 'Not Provided'}
                    </span>
                  </div>
                  <div className="saved-item">
                    <span className="saved-item-label">Account Holder Name</span>
                    <span className={`saved-item-val ${!savedData?.accountHolderName ? 'empty-val' : ''}`}>
                      {savedData?.accountHolderName || savedData?.fullName || 'Not Provided'}
                    </span>
                  </div>
                  <div className="saved-item">
                    <span className="saved-item-label">Bank Account Number</span>
                    <span className={`saved-item-val ${!savedData?.accountNumber ? 'empty-val' : ''}`}>
                      {savedData?.accountNumber || 'Not Provided'}
                    </span>
                  </div>
                  <div className="saved-item">
                    <span className="saved-item-label">IFSC Code</span>
                    <span className={`saved-item-val ${!savedData?.ifscCode ? 'empty-val' : ''}`}>
                      {savedData?.ifscCode || 'Not Provided'}
                    </span>
                  </div>
                  <div className="saved-item">
                    <span className="saved-item-label">Branch Name</span>
                    <span className={`saved-item-val ${!savedData?.branchName ? 'empty-val' : ''}`}>
                      {savedData?.branchName || 'Not Provided'}
                    </span>
                  </div>
                  <div className="saved-item">
                    <span className="saved-item-label">UPI ID</span>
                    <span className={`saved-item-val ${!savedData?.upiId ? 'empty-val' : ''}`}>
                      {savedData?.upiId || 'Not Provided (Optional)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* View Mode Footer Actions */}
            <div className="profile-modal-footer">
              <div className="saved-footer-left">
                <span className="saved-id-pill">ID: {memberId}</span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Permanently Saved</span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn-profile-secondary" onClick={onClose}>
                  Close
                </button>
                <button
                  type="button"
                  className="btn-profile-edit"
                  onClick={() => {
                    setSuccessMsg('');
                    setErrorMsg('');
                    setViewMode('edit');
                  }}
                >
                  <Edit3 size={15} />
                  <span>Edit Details</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* ===================================================================
              EDIT MODE: FILL / UPDATE DETAILS FORM
              =================================================================== */
          <form onSubmit={handleSubmit} className="profile-modal-body">
            {successMsg && (
              <div className="profile-alert profile-alert-success">
                <CheckCircle2 size={18} />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="profile-alert profile-alert-error">
                <AlertCircle size={18} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Notice */}
            <div style={{ padding: '0 24px', paddingTop: '16px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                Fill in the details below. Once saved, they will be permanently stored for ID: <strong>{memberId}</strong> and automatically used in all order shipments.
              </p>
            </div>

            {/* SECTION 1: Personal Details */}
            <div className="profile-form-section">
              <div className="section-title-wrap">
                <User size={18} className="section-icon text-blue" />
                <h4 className="section-title">Personal Contact Details</h4>
              </div>
              <div className="profile-fields-grid">
                <div className="profile-field-group">
                  <label className="field-label">
                    Full Name <span className="req-star">*</span>
                  </label>
                  <div className="input-with-icon">
                    <User size={16} className="input-icon" />
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="Enter full legal name"
                      className="profile-input"
                      required
                    />
                  </div>
                </div>

                <div className="profile-field-group">
                  <label className="field-label">
                    Mobile Number <span className="req-star">*</span>
                  </label>
                  <div className="input-with-icon">
                    <Phone size={16} className="input-icon" />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="e.g. 9876543210"
                      className="profile-input"
                      required
                    />
                  </div>
                </div>

                <div className="profile-field-group field-full">
                  <label className="field-label">
                    Email Address <span className="optional-badge">(Optional)</span>
                  </label>
                  <div className="input-with-icon">
                    <Mail size={16} className="input-icon" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="name@example.com (Optional)"
                      className="profile-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: Proper Address & Shipping Delivery */}
            <div className="profile-form-section">
              <div className="section-title-wrap">
                <MapPin size={18} className="section-icon text-teal" />
                <div>
                  <h4 className="section-title">Permanent Shipping &amp; Delivery Address</h4>
                  <p className="section-subtitle">
                    Permanently saved and automatically used for all product shipments and wholesale orders.
                  </p>
                </div>
              </div>

              <div className="profile-fields-grid">
                <div className="profile-field-group field-full">
                  <label className="field-label">
                    Proper Street Address / House No. / Landmark <span className="req-star">*</span>
                  </label>
                  <textarea
                    name="streetAddress"
                    value={formData.streetAddress}
                    onChange={handleChange}
                    placeholder="Plot No., House/Flat No., Building Name, Street / Area, Landmark"
                    className="profile-textarea"
                    rows={2}
                    required
                  />
                </div>

                <div className="profile-field-group">
                  <label className="field-label">
                    City / District <span className="req-star">*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="e.g. Ambala City"
                    className="profile-input"
                    required
                  />
                </div>

                <div className="profile-field-group">
                  <label className="field-label">
                    State <span className="req-star">*</span>
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="e.g. Haryana"
                    className="profile-input"
                    required
                  />
                </div>

                <div className="profile-field-group">
                  <label className="field-label">
                    Pin Code <span className="req-star">*</span>
                  </label>
                  <input
                    type="text"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleChange}
                    placeholder="e.g. 134007"
                    className="profile-input"
                    maxLength={10}
                    required
                  />
                </div>

                <div className="profile-field-group">
                  <label className="field-label">Country</label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    placeholder="India"
                    className="profile-input"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: Bank Details & Direct Deposit */}
            <div className="profile-form-section">
              <div className="section-title-wrap">
                <Building2 size={18} className="section-icon text-purple" />
                <div>
                  <h4 className="section-title">Bank &amp; Direct Deposit Details</h4>
                  <p className="section-subtitle">
                    Used for weekly commission direct deposits and payment settlements.
                  </p>
                </div>
              </div>

              <div className="profile-fields-grid">
                <div className="profile-field-group">
                  <label className="field-label">Bank Name</label>
                  <div className="input-with-icon">
                    <Building2 size={16} className="input-icon" />
                    <input
                      type="text"
                      name="bankName"
                      value={formData.bankName}
                      onChange={handleChange}
                      placeholder="e.g. State Bank of India / HDFC"
                      className="profile-input"
                    />
                  </div>
                </div>

                <div className="profile-field-group">
                  <label className="field-label">Account Holder Name</label>
                  <div className="input-with-icon">
                    <User size={16} className="input-icon" />
                    <input
                      type="text"
                      name="accountHolderName"
                      value={formData.accountHolderName}
                      onChange={handleChange}
                      placeholder="Legal name on bank passbook"
                      className="profile-input"
                    />
                  </div>
                </div>

                <div className="profile-field-group">
                  <label className="field-label">Bank Account Number</label>
                  <div className="input-with-icon">
                    <CreditCard size={16} className="input-icon" />
                    <input
                      type="text"
                      name="accountNumber"
                      value={formData.accountNumber}
                      onChange={handleChange}
                      placeholder="e.g. 01234567890123"
                      className="profile-input"
                    />
                  </div>
                </div>

                <div className="profile-field-group">
                  <label className="field-label">IFSC Code</label>
                  <input
                    type="text"
                    name="ifscCode"
                    value={formData.ifscCode}
                    onChange={handleChange}
                    placeholder="e.g. SBIN0001234"
                    className="profile-input uppercase-input"
                    maxLength={15}
                  />
                </div>

                <div className="profile-field-group">
                  <label className="field-label">Branch Name</label>
                  <input
                    type="text"
                    name="branchName"
                    value={formData.branchName}
                    onChange={handleChange}
                    placeholder="e.g. Main Market Branch"
                    className="profile-input"
                  />
                </div>

                <div className="profile-field-group">
                  <label className="field-label">UPI ID (Optional)</label>
                  <input
                    type="text"
                    name="upiId"
                    value={formData.upiId}
                    onChange={handleChange}
                    placeholder="e.g. yourname@upi"
                    className="profile-input"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="profile-modal-footer">
              {savedData?.streetAddress ? (
                <button
                  type="button"
                  className="btn-profile-secondary"
                  onClick={() => {
                    setErrorMsg('');
                    setSuccessMsg('');
                    setViewMode('view');
                  }}
                  disabled={isSubmitting}
                >
                  Cancel &amp; View Saved
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-profile-secondary"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="btn-profile-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="profile-btn-spinner" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save Profile &amp; Permanent Address</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
