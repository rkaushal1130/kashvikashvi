import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminApi } from '../../api/adminApi.js';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit2,
  Network,
  RefreshCw,
  X,
  UserCheck,
  UserX,
} from 'lucide-react';
import './AdminPages.css';

export default function DistributorManagementPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Query state
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [limit] = useState(10);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [positionFilter, setPositionFilter] = useState(searchParams.get('position') || 'ALL');

  // Data state
  const [loading, setLoading] = useState(true);
  const [distributors, setDistributors] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [error, setError] = useState(null);

  // Status Change Modal State
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetDistributor, setTargetDistributor] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('ACTIVE');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [modalFeedback, setModalFeedback] = useState(null);

  const fetchDistributors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit,
      };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;
      if (positionFilter && positionFilter !== 'ALL') params.position = positionFilter;

      const res = await adminApi.listDistributors(params);
      if (res && res.data) {
        setDistributors(res.data);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err) {
      setError(err?.message || 'Failed to load distributor directory.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchTerm, statusFilter, positionFilter]);

  useEffect(() => {
    fetchDistributors();
  }, [fetchDistributors]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchDistributors();
  };

  const handleOpenStatusModal = (dist) => {
    setTargetDistributor(dist);
    setSelectedStatus(dist.status || 'ACTIVE');
    setModalFeedback(null);
    setStatusModalOpen(true);
  };

  const handleSaveStatus = async () => {
    if (!targetDistributor) return;
    try {
      setUpdatingStatus(true);
      setModalFeedback(null);
      await adminApi.updateStatus(targetDistributor.distributorId, selectedStatus);

      setModalFeedback({
        type: 'success',
        message: `Distributor ${targetDistributor.distributorId} status successfully set to ${selectedStatus}.`,
      });

      // Update in local state
      setDistributors((prev) =>
        prev.map((d) =>
          d.distributorId === targetDistributor.distributorId
            ? { ...d, status: selectedStatus }
            : d
        )
      );

      setTimeout(() => {
        setStatusModalOpen(false);
      }, 1000);
    } catch (err) {
      setModalFeedback({
        type: 'error',
        message: err?.message || 'Failed to update status.',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="admin-page-container">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Distributor Management Directory</h1>
          <p className="admin-page-subtitle">
            Search, filter, inspect genealogy, and manage account statuses across the enterprise
          </p>
        </div>
        <div className="admin-header-actions">
          <button
            className="admin-btn secondary"
            onClick={fetchDistributors}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-error-banner">
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar (Prompt 8 Sections 6 & 7) */}
      <div className="admin-filter-bar">
        <form onSubmit={handleSearchSubmit} className="admin-search-form">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="admin-search-input"
            placeholder="Search by Distributor ID, Name, Email, or Phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => {
                setSearchTerm('');
                setPage(1);
              }}
            >
              <X size={14} />
            </button>
          )}
          <button type="submit" className="admin-btn primary btn-sm">
            Search
          </button>
        </form>

        <div className="filter-controls-row">
          <div className="filter-group">
            <span className="filter-label">Status:</span>
            <select
              className="admin-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </div>

          <div className="filter-group">
            <span className="filter-label">Position:</span>
            <select
              className="admin-select"
              value={positionFilter}
              onChange={(e) => {
                setPositionFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Positions</option>
              <option value="LEFT">LEFT Leg</option>
              <option value="RIGHT">RIGHT Leg</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Container (Prompt 8 Section 5) */}
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Distributor ID</th>
              <th>Name</th>
              <th>Contact Info</th>
              <th>Sponsor / Parent</th>
              <th>Position & Level</th>
              <th>Status</th>
              <th>Personal BV</th>
              <th>Joined Date</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && distributors.length === 0 ? (
              <tr>
                <td colSpan={9} className="table-loading-cell">
                  <RefreshCw size={24} className="animate-spin text-blue" />
                  <span>Loading directory records...</span>
                </td>
              </tr>
            ) : distributors.length === 0 ? (
              <tr>
                <td colSpan={9} className="table-empty-cell">
                  <Users size={32} className="text-muted" />
                  <p>No distributors found matching the criteria.</p>
                </td>
              </tr>
            ) : (
              distributors.map((dist) => {
                const isSuspended = dist.status === 'SUSPENDED';
                const isActive = dist.status === 'ACTIVE';

                return (
                  <tr key={dist.distributorId || dist.id}>
                    <td>
                      <span
                        className="distributor-id-link"
                        onClick={() => navigate(`/admin/distributors/${dist.distributorId}`)}
                      >
                        {dist.distributorId}
                      </span>
                      <div className="text-xs text-muted">{dist.rank}</div>
                    </td>
                    <td>
                      <div className="font-semibold text-slate-800">{dist.name}</div>
                      <div className="text-xs text-muted">{dist.city}, {dist.state}</div>
                    </td>
                    <td>
                      <div className="text-sm">{dist.email}</div>
                      <div className="text-xs text-muted">{dist.phone}</div>
                    </td>
                    <td>
                      <div className="text-xs">
                        <span className="font-semibold">Sponsor:</span> {dist.sponsorId}
                      </div>
                      <div className="text-xs text-muted">
                        <span className="font-semibold">Parent:</span> {dist.parentId || 'ROOT'}
                      </div>
                    </td>
                    <td>
                      <span className={`position-badge ${dist.position?.toLowerCase()}`}>
                        {dist.position}
                      </span>
                      <div className="text-xs text-muted mt-1">Level {dist.level}</div>
                    </td>
                    <td>
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
                        {dist.status}
                      </span>
                    </td>
                    <td>
                      <div className="font-semibold">
                        {Number(dist.personalBv || 0).toLocaleString()} BV
                      </div>
                      <div className="text-xs text-muted">{dist.teamSize || 0} Team</div>
                    </td>
                    <td>
                      <div className="text-xs text-muted">
                        {new Date(dist.joinedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="table-action-btns">
                        <button
                          className="action-icon-btn"
                          title="View Profile Details"
                          onClick={() => navigate(`/admin/distributors/${dist.distributorId}`)}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          className="action-icon-btn"
                          title="View Binary Genealogy Tree"
                          onClick={() => navigate(`/admin/network-tree?rootId=${dist.distributorId}`)}
                        >
                          <Network size={15} />
                        </button>
                        <button
                          className="action-icon-btn"
                          title="Change Account Status"
                          onClick={() => handleOpenStatusModal(dist)}
                        >
                          <Edit2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Bar (Prompt 8 Section 8) */}
        <div className="admin-pagination-bar">
          <div className="pagination-info">
            Showing Page <span className="font-bold">{pagination.page}</span> of{' '}
            <span className="font-bold">{pagination.totalPages}</span> ({pagination.total} Total Distributors)
          </div>

          <div className="pagination-controls">
            <button
              className="admin-page-btn"
              disabled={pagination.page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>

            <span className="page-indicator">{pagination.page}</span>

            <button
              className="admin-page-btn"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Status Modal */}
      {statusModalOpen && targetDistributor && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <h3>Change Account Status</h3>
              <button
                className="modal-close-btn"
                onClick={() => setStatusModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body">
              <p className="modal-description">
                Update account qualification and compliance status for{' '}
                <span className="font-bold">{targetDistributor.name}</span> (ID: {targetDistributor.distributorId}).
                Changes are written directly to the immutable audit trail.
              </p>

              {modalFeedback && (
                <div
                  className={`modal-feedback ${
                    modalFeedback.type === 'success' ? 'success' : 'error'
                  }`}
                >
                  {modalFeedback.type === 'success' ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <AlertTriangle size={16} />
                  )}
                  <span>{modalFeedback.message}</span>
                </div>
              )}

              <div className="status-selection-group">
                <label
                  className={`status-option ${selectedStatus === 'ACTIVE' ? 'selected active' : ''}`}
                >
                  <input
                    type="radio"
                    name="status"
                    value="ACTIVE"
                    checked={selectedStatus === 'ACTIVE'}
                    onChange={() => setSelectedStatus('ACTIVE')}
                  />
                  <div>
                    <div className="status-opt-title">ACTIVE</div>
                    <div className="status-opt-desc">Fully qualified for commissions and binary match</div>
                  </div>
                </label>

                <label
                  className={`status-option ${selectedStatus === 'INACTIVE' ? 'selected inactive' : ''}`}
                >
                  <input
                    type="radio"
                    name="status"
                    value="INACTIVE"
                    checked={selectedStatus === 'INACTIVE'}
                    onChange={() => setSelectedStatus('INACTIVE')}
                  />
                  <div>
                    <div className="status-opt-title">INACTIVE</div>
                    <div className="status-opt-desc">Volume preserved, but commissions paused</div>
                  </div>
                </label>

                <label
                  className={`status-option ${selectedStatus === 'SUSPENDED' ? 'selected suspended' : ''}`}
                >
                  <input
                    type="radio"
                    name="status"
                    value="SUSPENDED"
                    checked={selectedStatus === 'SUSPENDED'}
                    onChange={() => setSelectedStatus('SUSPENDED')}
                  />
                  <div>
                    <div className="status-opt-title">SUSPENDED</div>
                    <div className="status-opt-desc">Full compliance freeze; login and bonuses locked</div>
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
                {updatingStatus ? 'Updating...' : 'Save Status Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
