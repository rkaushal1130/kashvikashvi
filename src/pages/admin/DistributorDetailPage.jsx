import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/adminApi.js';
import {
  Users,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  TrendingUp,
  Award,
  Network,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Mail,
  Phone,
  MapPin,
  Calendar,
  X,
  CreditCard,
  Building,
} from 'lucide-react';
import './AdminPages.css';

export default function DistributorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [distributor, setDistributor] = useState(null);
  const [error, setError] = useState(null);

  // Status modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('ACTIVE');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(null);

  // Edit details modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [updatingDetails, setUpdatingDetails] = useState(false);
  const [editFeedback, setEditFeedback] = useState(null);

  const fetchDistributor = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.getDistributor(id);
      if (res && res.data) {
        setDistributor(res.data);
        setSelectedStatus(res.data.qualification_status || res.data.status || 'ACTIVE');
        setEditForm({
          name: res.data.name || res.data.full_name || '',
          phone: res.data.phone || '',
          email: res.data.email || '',
          address: res.data.address || '',
          city: res.data.city || '',
          state: res.data.state || '',
          pincode: res.data.pincode || '',
        });
      }
    } catch (err) {
      setError(err?.message || `Failed to retrieve distributor ${id}.`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDistributor();
  }, [fetchDistributor]);

  const handleSaveStatus = async () => {
    try {
      setUpdatingStatus(true);
      setStatusFeedback(null);
      await adminApi.updateStatus(id, selectedStatus);

      setStatusFeedback({
        type: 'success',
        message: `Account status successfully updated to ${selectedStatus}.`,
      });

      setDistributor((prev) =>
        prev ? { ...prev, status: selectedStatus, qualification_status: selectedStatus } : prev
      );

      setTimeout(() => {
        setStatusModalOpen(false);
      }, 1000);
    } catch (err) {
      setStatusFeedback({
        type: 'error',
        message: err?.message || 'Failed to update account status.',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      setUpdatingDetails(true);
      setEditFeedback(null);
      await adminApi.updateDistributor(id, editForm);

      setEditFeedback({
        type: 'success',
        message: 'Distributor details successfully updated.',
      });

      setDistributor((prev) =>
        prev
          ? {
              ...prev,
              name: editForm.name,
              full_name: editForm.name,
              phone: editForm.phone,
              email: editForm.email,
              address: editForm.address,
              city: editForm.city,
              state: editForm.state,
              pincode: editForm.pincode,
            }
          : prev
      );

      setTimeout(() => {
        setEditModalOpen(false);
      }, 1000);
    } catch (err) {
      setEditFeedback({
        type: 'error',
        message: err?.message || 'Failed to update distributor information.',
      });
    } finally {
      setUpdatingDetails(false);
    }
  };

  if (loading && !distributor) {
    return (
      <div className="admin-page-container">
        <div className="table-loading-cell">
          <RefreshCw size={28} className="animate-spin text-blue" />
          <span>Loading distributor dossier...</span>
        </div>
      </div>
    );
  }

  if (error || !distributor) {
    return (
      <div className="admin-page-container">
        <button
          className="admin-btn secondary mb-4"
          onClick={() => navigate('/admin/distributors')}
        >
          <ArrowLeft size={16} />
          <span>Back to Directory</span>
        </button>
        <div className="admin-error-banner">
          <ShieldAlert size={18} />
          <span>{error || 'Distributor not found.'}</span>
        </div>
      </div>
    );
  }

  const distStatus = (distributor.status || distributor.qualification_status || 'ACTIVE').toUpperCase();
  const isActive = distStatus === 'ACTIVE';
  const isSuspended = distStatus === 'SUSPENDED';

  const children = distributor.children || {};
  const leftChild = children.left;
  const rightChild = children.right;

  const bv = distributor.businessVolume || {};
  const commissions = distributor.commissions || [];

  return (
    <div className="admin-page-container">
      {/* Back button */}
      <button
        className="admin-back-link"
        onClick={() => navigate('/admin/distributors')}
      >
        <ArrowLeft size={16} />
        <span>Return to Distributor Directory</span>
      </button>

      {/* Profile Header */}
      <div className="dist-profile-header-card">
        <div className="profile-left">
          <div className="profile-avatar-large">
            {(distributor.name || distributor.full_name || 'D').charAt(0).toUpperCase()}
          </div>
          <div className="profile-titles">
            <div className="profile-name-row">
              <h2>{distributor.name || distributor.full_name}</h2>
              <span
                className={`status-pill ${
                  isActive
                    ? 'active'
                    : isSuspended
                    ? 'suspended'
                    : 'inactive'
                }`}
              >
                <span className="status-dot" />
                {distStatus}
              </span>
            </div>
            <div className="profile-sub-row">
              <span className="member-id-pill">ID: {distributor.distributorId || id}</span>
              <span className="rank-pill">{distributor.rank || 'Associate'}</span>
              <span className="text-muted text-sm">
                Joined: {new Date(distributor.joinedAt || distributor.joined_at || Date.now()).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="profile-right-actions">
          <button
            className="admin-btn secondary"
            onClick={() => {
              setSelectedStatus(distStatus);
              setStatusFeedback(null);
              setStatusModalOpen(true);
            }}
          >
            <ShieldCheck size={15} />
            <span>Change Status</span>
          </button>

          <button
            className="admin-btn secondary"
            onClick={() => {
              setEditFeedback(null);
              setEditModalOpen(true);
            }}
          >
            <Edit2 size={15} />
            <span>Edit Profile</span>
          </button>

          <button
            className="admin-btn primary"
            onClick={() => navigate(`/admin/network-tree?rootId=${distributor.distributorId || id}`)}
          >
            <Network size={15} />
            <span>View In Network Tree</span>
          </button>
        </div>
      </div>

      {/* Grid: Genealogy & Business Volume */}
      <div className="admin-two-col-grid">
        {/* Placement & Tree Details */}
        <div className="admin-panel-card">
          <div className="panel-card-header">
            <div className="header-title-wrap">
              <Network size={18} className="text-blue" />
              <h3>Binary Placement & Sponsorship</h3>
            </div>
          </div>
          <div className="panel-card-body">
            <div className="details-key-value-list">
              <div className="kv-row">
                <span className="kv-key">Sponsor Distributor:</span>
                <span className="kv-val font-semibold">
                  {distributor.sponsorName || 'Rahul Kaushal'} ({distributor.sponsorId || 'KV-1001'})
                </span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Binary Parent:</span>
                <span className="kv-val font-semibold">
                  {distributor.parentName || 'Direct'} ({distributor.parentId || 'ROOT'})
                </span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Binary Leg Position:</span>
                <span className="kv-val">
                  <span className={`position-badge ${distributor.position?.toLowerCase() || 'root'}`}>
                    {distributor.position || distributor.leg_position || 'ROOT'}
                  </span>
                </span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Genealogy Depth Level:</span>
                <span className="kv-val font-semibold">Level {distributor.level ?? distributor.depth ?? 0}</span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Tree Path:</span>
                <span className="kv-val text-xs text-muted font-mono">
                  {distributor.treePath || distributor.tree_path || `/KV-1001/${distributor.distributorId || id}`}
                </span>
              </div>
            </div>

            {/* Direct Children Slots */}
            <h4 className="mt-4 mb-2 text-xs font-bold uppercase text-muted">Immediate Children</h4>
            <div className="children-slots-grid">
              <div className={`child-slot-card ${leftChild ? 'occupied' : 'empty'}`}>
                <div className="child-slot-header">
                  <span className="slot-leg-tag left">LEFT LEG</span>
                  {leftChild ? (
                    <span className="slot-status-active">OCCUPIED</span>
                  ) : (
                    <span className="slot-status-empty">AVAILABLE</span>
                  )}
                </div>
                {leftChild ? (
                  <div className="child-meta">
                    <div className="font-bold">{leftChild.name}</div>
                    <div className="text-xs text-muted">ID: {leftChild.distributorId}</div>
                    <div className="text-xs text-emerald mt-1">{leftChild.rank}</div>
                  </div>
                ) : (
                  <div className="empty-slot-msg">Open Slot for placement</div>
                )}
              </div>

              <div className={`child-slot-card ${rightChild ? 'occupied' : 'empty'}`}>
                <div className="child-slot-header">
                  <span className="slot-leg-tag right">RIGHT LEG</span>
                  {rightChild ? (
                    <span className="slot-status-active">OCCUPIED</span>
                  ) : (
                    <span className="slot-status-empty">AVAILABLE</span>
                  )}
                </div>
                {rightChild ? (
                  <div className="child-meta">
                    <div className="font-bold">{rightChild.name}</div>
                    <div className="text-xs text-muted">ID: {rightChild.distributorId}</div>
                    <div className="text-xs text-emerald mt-1">{rightChild.rank}</div>
                  </div>
                ) : (
                  <div className="empty-slot-msg">Open Slot for placement</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Business Volume Telemetry */}
        <div className="admin-panel-card">
          <div className="panel-card-header">
            <div className="header-title-wrap">
              <TrendingUp size={18} className="text-purple" />
              <h3>Business Volume Telemetry</h3>
            </div>
          </div>
          <div className="panel-card-body">
            <div className="bv-summary-boxes">
              <div className="bv-box personal">
                <span className="bv-box-label">Personal BV (PBV)</span>
                <span className="bv-box-value">
                  {Number(bv.personalBV || distributor.current_psv || distributor.personalBv || 0).toLocaleString()} BV
                </span>
                <span className="bv-box-sub">Self-generated purchases</span>
              </div>

              <div className="bv-box left">
                <span className="bv-box-label">Left Team BV</span>
                <span className="bv-box-value">
                  {Number(bv.leftTeamBV || 0).toLocaleString()} BV
                </span>
                <span className="bv-box-sub">Left branch volume</span>
              </div>

              <div className="bv-box right">
                <span className="bv-box-label">Right Team BV</span>
                <span className="bv-box-value">
                  {Number(bv.rightTeamBV || 0).toLocaleString()} BV
                </span>
                <span className="bv-box-sub">Right branch volume</span>
              </div>

              <div className="bv-box total">
                <span className="bv-box-label">Total Team Volume</span>
                <span className="bv-box-value">
                  {Number(bv.totalTeamBV || 0).toLocaleString()} BV
                </span>
                <span className="bv-box-sub">Combined downline</span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-50 rounded border border-slate-200 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-muted">Direct Team Size:</span>
                <span className="font-bold">{distributor.teamSize || 0} Members</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted">Lifetime BV Accumulated:</span>
                <span className="font-bold">{Number(distributor.lifetime_bv || 0).toLocaleString()} BV</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Commission History Table */}
      <div className="admin-panel-card mt-6">
        <div className="panel-card-header">
          <div className="header-title-wrap">
            <Award size={18} className="text-amber" />
            <h3>Distributor Commission Ledger</h3>
          </div>
        </div>
        <div className="panel-card-body p-0">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Cycle ID</th>
                <th>Commission Type</th>
                <th>Matched Volume</th>
                <th>Gross Amount</th>
                <th>Net Payout</th>
                <th>Status</th>
                <th>Recorded At</th>
              </tr>
            </thead>
            <tbody>
              {commissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty-cell">
                    <Award size={24} className="text-muted" />
                    <p>No commission ledger records for this distributor yet.</p>
                  </td>
                </tr>
              ) : (
                commissions.map((comm) => (
                  <tr key={comm.id}>
                    <td className="font-mono text-xs">{comm.cycleId || 'CYCLE-2026-W38'}</td>
                    <td>{comm.commissionType || 'BINARY_MATCH'}</td>
                    <td>{Number(comm.matchedVolume || 0).toLocaleString()} BV</td>
                    <td>₹{Number(comm.grossCommission || 0).toLocaleString()}</td>
                    <td className="font-bold text-emerald">
                      ₹{Number(comm.netPayout || 0).toLocaleString()}
                    </td>
                    <td>
                      <span className={`status-pill ${comm.status?.toLowerCase() || 'active'}`}>
                        {comm.status}
                      </span>
                    </td>
                    <td className="text-xs text-muted">
                      {new Date(comm.createdAt || Date.now()).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Change Status Modal */}
      {statusModalOpen && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <h3>Change Distributor Status</h3>
              <button
                className="modal-close-btn"
                onClick={() => setStatusModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="admin-modal-body">
              <p className="modal-description">
                Update account status for <span className="font-bold">{distributor.name}</span> ({id}).
                This will trigger an immutable compliance audit record.
              </p>

              {statusFeedback && (
                <div
                  className={`modal-feedback ${
                    statusFeedback.type === 'success' ? 'success' : 'error'
                  }`}
                >
                  {statusFeedback.type === 'success' ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <AlertTriangle size={16} />
                  )}
                  <span>{statusFeedback.message}</span>
                </div>
              )}

              <div className="status-selection-group">
                <label
                  className={`status-option ${selectedStatus === 'ACTIVE' ? 'selected active' : ''}`}
                >
                  <input
                    type="radio"
                    name="modal_status"
                    value="ACTIVE"
                    checked={selectedStatus === 'ACTIVE'}
                    onChange={() => setSelectedStatus('ACTIVE')}
                  />
                  <div>
                    <div className="status-opt-title">ACTIVE</div>
                    <div className="status-opt-desc">Full business privileges and weekly commission earnings</div>
                  </div>
                </label>

                <label
                  className={`status-option ${selectedStatus === 'INACTIVE' ? 'selected inactive' : ''}`}
                >
                  <input
                    type="radio"
                    name="modal_status"
                    value="INACTIVE"
                    checked={selectedStatus === 'INACTIVE'}
                    onChange={() => setSelectedStatus('INACTIVE')}
                  />
                  <div>
                    <div className="status-opt-title">INACTIVE</div>
                    <div className="status-opt-desc">Account grace period; volume accumulation paused</div>
                  </div>
                </label>

                <label
                  className={`status-option ${selectedStatus === 'SUSPENDED' ? 'selected suspended' : ''}`}
                >
                  <input
                    type="radio"
                    name="modal_status"
                    value="SUSPENDED"
                    checked={selectedStatus === 'SUSPENDED'}
                    onChange={() => setSelectedStatus('SUSPENDED')}
                  />
                  <div>
                    <div className="status-opt-title">SUSPENDED</div>
                    <div className="status-opt-desc">Complete administrative lock; blocked from portal and payouts</div>
                  </div>
                </label>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button
                className="admin-btn secondary"
                onClick={() => setStatusModalOpen(false)}
                disabled={updatingStatus}
              >
                Cancel
              </button>
              <button
                className="admin-btn primary"
                onClick={handleSaveStatus}
                disabled={updatingStatus}
              >
                {updatingStatus ? 'Updating...' : 'Confirm Status Change'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <h3>Edit Distributor Profile</h3>
              <button
                className="modal-close-btn"
                onClick={() => setEditModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="admin-modal-body">
                {editFeedback && (
                  <div
                    className={`modal-feedback ${
                      editFeedback.type === 'success' ? 'success' : 'error'
                    }`}
                  >
                    {editFeedback.type === 'success' ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <AlertTriangle size={16} />
                    )}
                    <span>{editFeedback.message}</span>
                  </div>
                )}

                <div className="admin-form-group">
                  <label className="admin-form-label">Full Name</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Email Address</label>
                  <input
                    type="email"
                    className="admin-form-input"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Phone Number</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="admin-form-group">
                    <label className="admin-form-label">City</label>
                    <input
                      type="text"
                      className="admin-form-input"
                      value={editForm.city}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">State</label>
                    <input
                      type="text"
                      className="admin-form-input"
                      value={editForm.state}
                      onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn secondary"
                  onClick={() => setEditModalOpen(false)}
                  disabled={updatingDetails}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn primary"
                  disabled={updatingDetails}
                >
                  {updatingDetails ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
