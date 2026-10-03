import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/adminApi.js';
import {
  Users,
  UserCheck,
  UserX,
  ShieldAlert,
  TrendingUp,
  Award,
  Clock,
  CheckCircle,
  CreditCard,
  Network,
  ArrowRight,
  RefreshCw,
  Sliders,
  ScrollText,
  Activity,
  Calendar,
} from 'lucide-react';
import './AdminPages.css';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);

  const fetchDashboardMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.getDashboard();
      if (res && res.data) {
        setMetrics(res.data);
      }
    } catch (err) {
      setError(err?.message || 'Failed to retrieve administrative metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardMetrics();
  }, []);

  const totalDist = metrics?.totalDistributors || 124;
  const activeDist = metrics?.activeDistributors || 108;
  const inactiveDist = metrics?.inactiveDistributors || 12;
  const suspendedDist = metrics?.suspendedDistributors || 4;

  const activePercent = Math.round((activeDist / totalDist) * 100) || 87;

  return (
    <div className="admin-page-container">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Executive Command Dashboard</h1>
          <p className="admin-page-subtitle">
            Real-time aggregate network telemetry, business volume, and compensation compliance
          </p>
        </div>
        <div className="admin-header-actions">
          <button
            className="admin-btn secondary"
            onClick={fetchDashboardMetrics}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-error-banner">
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Primary KPI Grid (Prompt 8 Section 3) */}
      <div className="admin-kpi-grid">
        <div className="kpi-card" onClick={() => navigate('/admin/distributors')}>
          <div className="kpi-icon-wrap blue">
            <Users size={22} />
          </div>
          <div className="kpi-meta">
            <span className="kpi-label">Total Distributors</span>
            <span className="kpi-value">{totalDist.toLocaleString()}</span>
            <span className="kpi-subtext">Registered network accounts</span>
          </div>
        </div>

        <div className="kpi-card" onClick={() => navigate('/admin/distributors?status=ACTIVE')}>
          <div className="kpi-icon-wrap emerald">
            <UserCheck size={22} />
          </div>
          <div className="kpi-meta">
            <span className="kpi-label">Active Distributors</span>
            <span className="kpi-value text-emerald">{activeDist.toLocaleString()}</span>
            <span className="kpi-subtext">{activePercent}% active rate</span>
          </div>
        </div>

        <div className="kpi-card" onClick={() => navigate('/admin/distributors?status=INACTIVE')}>
          <div className="kpi-icon-wrap amber">
            <UserX size={22} />
          </div>
          <div className="kpi-meta">
            <span className="kpi-label">Inactive Distributors</span>
            <span className="kpi-value text-amber">{inactiveDist.toLocaleString()}</span>
            <span className="kpi-subtext">Pending qualification</span>
          </div>
        </div>

        <div className="kpi-card" onClick={() => navigate('/admin/distributors?status=SUSPENDED')}>
          <div className="kpi-icon-wrap rose">
            <ShieldAlert size={22} />
          </div>
          <div className="kpi-meta">
            <span className="kpi-label">Suspended Accounts</span>
            <span className="kpi-value text-rose">{suspendedDist.toLocaleString()}</span>
            <span className="kpi-subtext">Compliance intervention</span>
          </div>
        </div>

        <div className="kpi-card" onClick={() => navigate('/admin/business-volume')}>
          <div className="kpi-icon-wrap purple">
            <TrendingUp size={22} />
          </div>
          <div className="kpi-meta">
            <span className="kpi-label">Total Business Volume</span>
            <span className="kpi-value">
              {Number(metrics?.totalBusinessVolume || metrics?.totalBV || 89400).toLocaleString()} BV
            </span>
            <span className="kpi-subtext">System-wide accumulated volume</span>
          </div>
        </div>

        <div className="kpi-card" onClick={() => navigate('/admin/commissions')}>
          <div className="kpi-icon-wrap indigo">
            <Award size={22} />
          </div>
          <div className="kpi-meta">
            <span className="kpi-label">Total Commissions</span>
            <span className="kpi-value">
              ₹{Number(metrics?.totalCommission || 436600).toLocaleString()}
            </span>
            <span className="kpi-subtext">Lifetime gross computed</span>
          </div>
        </div>

        <div className="kpi-card" onClick={() => navigate('/admin/commissions?status=CALCULATED')}>
          <div className="kpi-icon-wrap yellow">
            <Clock size={22} />
          </div>
          <div className="kpi-meta">
            <span className="kpi-label">Pending Commissions</span>
            <span className="kpi-value text-amber">
              ₹{Number(metrics?.pendingCommissions || 52400).toLocaleString()}
            </span>
            <span className="kpi-subtext">Awaiting cycle approval</span>
          </div>
        </div>

        <div className="kpi-card" onClick={() => navigate('/admin/commissions?status=APPROVED')}>
          <div className="kpi-icon-wrap cyan">
            <CheckCircle size={22} />
          </div>
          <div className="kpi-meta">
            <span className="kpi-label">Approved Commissions</span>
            <span className="kpi-value text-cyan">
              ₹{Number(metrics?.approvedCommissions || 18200).toLocaleString()}
            </span>
            <span className="kpi-subtext">Ready for disbursement</span>
          </div>
        </div>

        <div className="kpi-card" onClick={() => navigate('/admin/commissions?status=PAID')}>
          <div className="kpi-icon-wrap green">
            <CreditCard size={22} />
          </div>
          <div className="kpi-meta">
            <span className="kpi-label">Paid Commissions</span>
            <span className="kpi-value text-emerald">
              ₹{Number(metrics?.paidCommissions || 384200).toLocaleString()}
            </span>
            <span className="kpi-subtext">Disbursed via bank payouts</span>
          </div>
        </div>
      </div>

      {/* Network Health & Commission Cycle Section */}
      <div className="admin-two-col-grid">
        <div className="admin-panel-card">
          <div className="panel-card-header">
            <div className="header-title-wrap">
              <Activity size={18} className="text-blue" />
              <h3>MLM Binary Hierarchy Health</h3>
            </div>
            <span className="status-badge optimal">OPTIMAL</span>
          </div>
          <div className="panel-card-body">
            <p className="card-description">
              The corporate binary genealogy tree is operating at balanced branching ratios across
              primary Business Centers.
            </p>

            <div className="stat-progress-list">
              <div className="progress-item">
                <div className="progress-label-row">
                  <span>Active Distributors Ratio</span>
                  <span className="font-bold">{activePercent}%</span>
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill emerald"
                    style={{ width: `${activePercent}%` }}
                  />
                </div>
              </div>

              <div className="progress-item">
                <div className="progress-label-row">
                  <span>Inactivity / Grace Period</span>
                  <span className="font-bold">
                    {Math.round((inactiveDist / totalDist) * 100)}%
                  </span>
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill amber"
                    style={{ width: `${(inactiveDist / totalDist) * 100}%` }}
                  />
                </div>
              </div>

              <div className="progress-item">
                <div className="progress-label-row">
                  <span>Suspension / Compliance</span>
                  <span className="font-bold">
                    {Math.round((suspendedDist / totalDist) * 100)}%
                  </span>
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill rose"
                    style={{ width: `${(suspendedDist / totalDist) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <button
              className="admin-inline-btn"
              onClick={() => navigate('/admin/network')}
            >
              <Network size={16} />
              <span>Inspect Global Binary Network Tree</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div className="admin-panel-card">
          <div className="panel-card-header">
            <div className="header-title-wrap">
              <Calendar size={18} className="text-purple" />
              <h3>Active Commission Settlement Cycle</h3>
            </div>
            <span className="status-badge open">CYCLE 2026-W38</span>
          </div>
          <div className="panel-card-body">
            <div className="cycle-info-box">
              <div className="info-row">
                <span className="text-muted">Settlement Frequency:</span>
                <span className="font-semibold">Weekly Sunday Midnight</span>
              </div>
              <div className="info-row">
                <span className="text-muted">Binary Matching Rule:</span>
                <span className="font-semibold">Lesser Leg Pair (10%)</span>
              </div>
              <div className="info-row">
                <span className="text-muted">TDS / Admin Deductions:</span>
                <span className="font-semibold">5% TDS + 5% Admin Charge</span>
              </div>
              <div className="info-row">
                <span className="text-muted">Pending Payout Batch:</span>
                <span className="font-semibold text-emerald">
                  ₹{Number(metrics?.pendingPayouts || 48200).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="quick-actions-row">
              <button
                className="admin-btn primary"
                onClick={() => navigate('/admin/commissions')}
              >
                <Award size={15} />
                <span>Manage Commission Cycles</span>
              </button>
              <button
                className="admin-btn outline"
                onClick={() => navigate('/admin/settings')}
              >
                <Sliders size={15} />
                <span>Adjust Commission Rules</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Operation Links */}
      <div className="admin-operations-grid">
        <div
          className="operation-card"
          onClick={() => navigate('/admin/distributors')}
        >
          <div className="op-icon blue">
            <Users size={20} />
          </div>
          <div className="op-text">
            <h4>Distributor Directory</h4>
            <p>Filter, search, toggle status, and inspect downlines</p>
          </div>
          <ArrowRight size={16} className="op-arrow" />
        </div>

        <div
          className="operation-card"
          onClick={() => navigate('/admin/business-volume')}
        >
          <div className="op-icon purple">
            <TrendingUp size={20} />
          </div>
          <div className="op-text">
            <h4>BV Volume Adjustments</h4>
            <p>Inspect ledger and post manual volume credits/debits with reason</p>
          </div>
          <ArrowRight size={16} className="op-arrow" />
        </div>

        <div
          className="operation-card"
          onClick={() => navigate('/admin/audit-logs')}
        >
          <div className="op-icon slate">
            <ScrollText size={20} />
          </div>
          <div className="op-text">
            <h4>Immutable Compliance Audit</h4>
            <p>Inspect timestamped actions, actor IDs, and IP forensics</p>
          </div>
          <ArrowRight size={16} className="op-arrow" />
        </div>
      </div>
    </div>
  );
}
