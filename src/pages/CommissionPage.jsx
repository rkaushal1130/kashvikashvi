import React, { useState, useEffect, useCallback } from 'react';
import { distributorApi } from '../api/distributorApi.js';
import {
  Award,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  FileText,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import './CommissionPage.css';

export function CommissionPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [commissionList, setCommissionList] = useState([]);

  const fetchCommissions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await distributorApi.getMeCommissions();
      if (res && res.success) {
        setCommissionList(Array.isArray(res.data) ? res.data : []);
      } else {
        throw new Error(res?.message || 'Could not fetch commissions.');
      }
    } catch (err) {
      console.error('[CommissionPage] Error:', err);
      setError(err.message || 'Failed to load commission records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCommissions();
  }, [fetchCommissions]);

  // Aggregate sums
  const totalAmount = commissionList.reduce(
    (sum, c) => sum + Number(c.netPayable || c.amount || c.matchingBonus || 0),
    0
  );
  const paidAmount = commissionList
    .filter((c) => (c.status || '').toUpperCase() === 'PAID')
    .reduce((sum, c) => sum + Number(c.netPayable || c.amount || 0), 0);
  const approvedAmount = commissionList
    .filter((c) => (c.status || '').toUpperCase() === 'APPROVED')
    .reduce((sum, c) => sum + Number(c.netPayable || c.amount || 0), 0);
  const pendingAmount = commissionList
    .filter(
      (c) =>
        (c.status || '').toUpperCase() === 'PENDING' ||
        !(c.status || '').match(/PAID|APPROVED/)
    )
    .reduce((sum, c) => sum + Number(c.netPayable || c.amount || 0), 0);

  return (
    <div className="commission-page">
      {/* 1. Header */}
      <div className="comm-header-card">
        <div>
          <h1 className="comm-title">Commissions & Earnings</h1>
          <p className="comm-subtitle">
            Complete statement of binary matching bonuses, approved payouts, and TDS deductions
          </p>
        </div>
        <button
          className="refresh-btn"
          onClick={() => fetchCommissions(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Ledger'}</span>
        </button>
      </div>

      {error && (
        <div className="comm-alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Aggregate Metric Cards */}
      <div className="comm-metrics-grid">
        <div className="comm-card">
          <span className="comm-label">TOTAL EARNINGS</span>
          <div className="comm-val">
            ₹
            {loading
              ? '...'
              : totalAmount.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
          </div>
          <span className="comm-hint">All-time lifetime payouts</span>
        </div>

        <div className="comm-card">
          <span className="comm-label">PAID COMMISSIONS</span>
          <div className="comm-val text-green-600">
            ₹
            {loading
              ? '...'
              : paidAmount.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
          </div>
          <span className="comm-hint">Disbursed to bank account</span>
        </div>

        <div className="comm-card">
          <span className="comm-label">APPROVED PAYOUTS</span>
          <div className="comm-val text-blue-600">
            ₹
            {loading
              ? '...'
              : approvedAmount.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
          </div>
          <span className="comm-hint">Ready for disbursement cycle</span>
        </div>

        <div className="comm-card">
          <span className="comm-label">PENDING REVIEW</span>
          <div className="comm-val text-amber-600">
            ₹
            {loading
              ? '...'
              : pendingAmount.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
          </div>
          <span className="comm-hint">Current active calculation cycle</span>
        </div>
      </div>

      {/* 3. Commission Ledger Table */}
      <div className="ledger-card">
        <div className="ledger-header">
          <h2 className="ledger-title">Earnings Ledger & History</h2>
          <span className="ledger-count">{commissionList.length} Records</span>
        </div>

        {loading ? (
          <div className="ledger-loading">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            <p>Loading ledger from backend...</p>
          </div>
        ) : commissionList.length === 0 ? (
          <div className="ledger-empty">
            <Award size={36} className="text-slate-300" />
            <p>No commission records found for this period.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="comm-table">
              <thead>
                <tr>
                  <th>Cycle Date</th>
                  <th>Type</th>
                  <th>Matched BV</th>
                  <th>Gross Bonus</th>
                  <th>TDS (5%)</th>
                  <th>Admin (5%)</th>
                  <th>Net Payable</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {commissionList.map((item, idx) => {
                  const gross = Number(item.grossAmount || item.matchingBonus || 0);
                  const tds = Number(item.tdsDeduction || gross * 0.05);
                  const admin = Number(item.adminFee || gross * 0.05);
                  const net = Number(item.netPayable || item.amount || gross - tds - admin);
                  const status = (item.status || 'PAID').toUpperCase();

                  const dateStr = item.cycleDate || item.createdAt
                    ? new Date(item.cycleDate || item.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '15 Sep 2026';

                  return (
                    <tr key={item.id || idx}>
                      <td>{dateStr}</td>
                      <td>
                        <span className="type-chip">
                          {item.type || 'BINARY_MATCHING'}
                        </span>
                      </td>
                      <td>{Number(item.matchedBv || item.weakerLegBv || 0).toLocaleString()} BV</td>
                      <td>₹{gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="text-red-600">-₹{tds.toFixed(2)}</td>
                      <td className="text-red-600">-₹{admin.toFixed(2)}</td>
                      <td>
                        <strong className="text-emerald-700">
                          ₹{net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </strong>
                      </td>
                      <td>
                        <span className={`status-badge status-${status.toLowerCase()}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default CommissionPage;
