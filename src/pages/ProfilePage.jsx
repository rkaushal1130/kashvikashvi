import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { distributorApi } from '../api/distributorApi.js';
import { authApi } from '../api/authApi.js';
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Layers,
  KeyRound,
  LogOut,
} from 'lucide-react';
import './ProfilePage.css';

export function ProfilePage() {
  const { currentUser, logout, refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState(null);

  // Edit Profile Form State
  const [editForm, setEditForm] = useState({
    name: currentUser?.name || '',
    phone: currentUser?.phone || '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editSuccess, setEditSuccess] = useState('');
  const [editError, setEditError] = useState(null);

  // Change Password Form State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await distributorApi.getMe();
      if (res && res.success && res.data) {
        setProfileData(res.data);
        setEditForm({
          name: res.data.name || currentUser?.name || '',
          phone: res.data.phone || currentUser?.phone || '',
        });
      }
    } catch (err) {
      console.error('[ProfilePage] Fetch profile error:', err);
      setError('Could not load profile details from server.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (currentUser) {
      setEditForm((prev) => ({
        name: prev.name || currentUser.name || '',
        phone: prev.phone || currentUser.phone || '',
      }));
    }
  }, [currentUser]);

  // Handle Edit Profile Submission
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setEditSuccess('');
    setEditError(null);

    if (!editForm.name.trim()) {
      setEditError('Name cannot be empty.');
      return;
    }

    setEditLoading(true);
    try {
      const res = await distributorApi.updateMe({
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || undefined,
      });

      if (res && res.success) {
        setEditSuccess('Profile details successfully updated.');
        await refreshUser();
      } else {
        throw new Error(res?.message || 'Update failed.');
      }
    } catch (err) {
      console.error('[ProfilePage] Update error:', err);
      setEditError(err.message || 'Failed to update profile.');
    } finally {
      setEditLoading(false);
    }
  };

  // Handle Change Password Submission
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError(null);

    if (!passwordForm.currentPassword) {
      setPasswordError('Please provide your current password.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await authApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });

      if (res && res.success) {
        setPasswordSuccess('Password successfully updated. All other active sessions have been secured.');
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } else {
        throw new Error(res?.message || 'Password change failed.');
      }
    } catch (err) {
      console.error('[ProfilePage] Password change error:', err);
      if (err.status === 401) {
        setPasswordError('Incorrect current password.');
      } else {
        setPasswordError(err.message || 'Failed to change password.');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const displayName = profileData?.name || currentUser?.name || 'Distributor';
  const distributorId =
    profileData?.memberId ||
    profileData?.distributorCode ||
    currentUser?.memberId ||
    currentUser?.distributorId ||
    'KV-1001';
  const email = profileData?.email || currentUser?.email || 'distributor@kashvimlm.com';
  const sponsor =
    typeof profileData?.sponsor === 'object' && profileData?.sponsor !== null
      ? profileData.sponsor.displayName || profileData.sponsor.distributorCode || 'KV-1001'
      : (profileData?.sponsor || currentUser?.sponsorName || currentUser?.sponsorId || 'KV-1001');
  const parent = profileData?.parent || profileData?.parentId || currentUser?.parent || 'KV-1000';
  const position = profileData?.position || currentUser?.position || 'LEFT';
  const level = profileData?.level || currentUser?.level || 1;
  const status = profileData?.status || currentUser?.status || 'ACTIVE';
  const role = currentUser?.role || profileData?.role || 'DISTRIBUTOR';

  return (
    <div className="profile-page">
      {/* 1. Profile Top Card */}
      <div className="profile-identity-card">
        <div className="identity-avatar-large">
          {(displayName || 'D').charAt(0).toUpperCase()}
        </div>
        <div className="identity-meta-column">
          <div className="identity-title-row">
            <h1 className="profile-name">{displayName}</h1>
            <span className="role-chip">{role}</span>
            <span className="status-chip active-chip">{status}</span>
          </div>
          <p className="profile-id-row">
            Distributor ID: <strong>{distributorId}</strong> &nbsp;•&nbsp; Email: {email}
          </p>
        </div>
      </div>

      {error && (
        <div className="profile-alert error-alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Grid of Sections */}
      <div className="profile-sections-grid">
        {/* Left Column: Immutable Network Identity */}
        <div className="section-card">
          <h2 className="section-title">
            <ShieldCheck size={18} className="text-blue-600" />
            <span>Genealogy & Network Placement</span>
          </h2>
          <p className="section-subtitle">
            System-enforced immutable MLM network properties verified by blockchain/database
          </p>

          <div className="immutable-attr-list">
            <div className="attr-item">
              <span className="attr-label">Distributor ID</span>
              <span className="attr-value font-mono">{distributorId}</span>
            </div>
            <div className="attr-item">
              <span className="attr-label">Direct Sponsor</span>
              <span className="attr-value">{sponsor}</span>
            </div>
            <div className="attr-item">
              <span className="attr-label">Placement Parent</span>
              <span className="attr-value">{parent}</span>
            </div>
            <div className="attr-item">
              <span className="attr-label">Binary Position</span>
              <span className="attr-value">{position} Leg</span>
            </div>
            <div className="attr-item">
              <span className="attr-label">Network Level</span>
              <span className="attr-value">Level {level}</span>
            </div>
            <div className="attr-item">
              <span className="attr-label">Account Status</span>
              <span className="attr-value text-green-600 font-semibold">{status}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Editable Contact Information */}
        <div className="section-card">
          <h2 className="section-title">
            <User size={18} className="text-blue-600" />
            <span>Edit Profile Details</span>
          </h2>
          <p className="section-subtitle">Update your personal contact details</p>

          {editSuccess && (
            <div className="profile-alert success-alert">
              <CheckCircle2 size={16} />
              <span>{editSuccess}</span>
            </div>
          )}

          {editError && (
            <div className="profile-alert error-alert">
              <AlertCircle size={16} />
              <span>{editError}</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="profile-form">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                disabled={editLoading}
              />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="+91 9876543210"
                disabled={editLoading}
              />
            </div>

            <div className="form-group">
              <label>Email Address (Locked)</label>
              <input type="email" value={email} disabled className="input-disabled" />
              <span className="field-hint">Email is bound to your account and cannot be modified.</span>
            </div>

            <button type="submit" className="save-btn" disabled={editLoading}>
              {editLoading ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>
      </div>

      {/* 3. Security & Password Change */}
      <div className="section-card change-password-card">
        <h2 className="section-title">
          <KeyRound size={18} className="text-amber-600" />
          <span>Security & Change Password</span>
        </h2>
        <p className="section-subtitle">
          Secure your account credentials using Argon2/bcrypt verified authentication
        </p>

        {passwordSuccess && (
          <div className="profile-alert success-alert">
            <CheckCircle2 size={16} />
            <span>{passwordSuccess}</span>
          </div>
        )}

        {passwordError && (
          <div className="profile-alert error-alert">
            <AlertCircle size={16} />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="profile-form password-form">
          <div className="form-group">
            <label>Current Password</label>
            <div className="pw-input-wrapper">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                }
                required
                disabled={passwordLoading}
                placeholder="Enter current password"
              />
              <button
                type="button"
                className="pw-toggle-btn"
                onClick={() => setShowCurrent(!showCurrent)}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="pw-grid">
            <div className="form-group">
              <label>New Password</label>
              <div className="pw-input-wrapper">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                  }
                  required
                  disabled={passwordLoading}
                  placeholder="Min 6 characters"
                />
                <button
                  type="button"
                  className="pw-toggle-btn"
                  onClick={() => setShowNew(!showNew)}
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <div className="pw-input-wrapper">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                  }
                  required
                  disabled={passwordLoading}
                  placeholder="Re-enter new password"
                />
                <button
                  type="button"
                  className="pw-toggle-btn"
                  onClick={() => setShowConfirm(!showConfirm)}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <button type="submit" className="save-btn pw-save-btn" disabled={passwordLoading}>
            {passwordLoading ? 'Updating Password...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ProfilePage;
