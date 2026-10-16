import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';
import {
  Sliders,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Percent,
  Coins,
  DollarSign,
  ToggleLeft,
  ToggleRight,
  HelpCircle,
  Award,
} from 'lucide-react';
import './AdminPages.css';

export default function CommissionSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [settings, setSettings] = useState({
    binaryMatchPercentage: 10,
    directSponsorPercentage: 5,
    minPbvForQualification: 100,
    monthlyMaintenanceBv: 50,
    cappingLimit: 100000,
    tdsRate: 5,
    adminFeeRate: 5,
    carryForwardEnabled: true,
  });

  const [ranks, setRanks] = useState([
    { code: 'SILVER', name: 'Silver', commissionPercent: 24, minBV: 250, minLeftMatching: 2000, minRightMatching: 2000 },
    { code: 'GOLD', name: 'Gold', commissionPercent: 8, minBV: 250, minLeftMatching: 5000, minRightMatching: 5000 },
    { code: 'PLATINUM', name: 'Platinum', commissionPercent: 13, minBV: 500, minLeftMatching: 50000, minRightMatching: 50000 },
    { code: 'DIAMOND', name: 'Diamond', commissionPercent: 5, minBV: 1000, minLeftMatching: 60000, minRightMatching: 60000 },
    { code: 'RUBY', name: 'Ruby', commissionPercent: 4, minBV: 1000, minLeftMatching: 100000, minRightMatching: 100000 },
  ]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const [settingsRes, ranksRes] = await Promise.allSettled([
        adminApi.getSettings(),
        adminApi.getCumulativeRanks(),
      ]);
      if (settingsRes.status === 'fulfilled' && settingsRes.value?.data) {
        setSettings((prev) => ({
          ...prev,
          ...settingsRes.value.data,
        }));
      }
      if (ranksRes.status === 'fulfilled' && ranksRes.value?.data) {
        const list = Array.isArray(ranksRes.value.data) ? ranksRes.value.data : [];
        const nonBase = list.filter((r) => r.code !== 'BASE');
        if (nonBase.length > 0) {
          setRanks(nonBase);
        }
      }
    } catch (err) {
      console.warn('Error loading settings, using current defaults:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRankChange = (code, field, val) => {
    setRanks((prev) =>
      prev.map((r) => (r.code === code ? { ...r, [field]: Number(val) } : r))
    );
  };

  const handleSaveRank = async (code) => {
    const rankObj = ranks.find((r) => r.code === code);
    if (!rankObj) return;
    try {
      setSaving(true);
      setErrorMsg('');
      await adminApi.updateCumulativeRank(code, rankObj);
      setSuccessMsg(`Rank ${rankObj.name} updated successfully!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || `Failed to update rank ${code}`);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg('');
      setSuccessMsg('');

      await adminApi.updateSettings({
        binaryMatchPercentage: Number(settings.binaryMatchPercentage),
        directSponsorPercentage: Number(settings.directSponsorPercentage),
        minPbvForQualification: Number(settings.minPbvForQualification),
        monthlyMaintenanceBv: Number(settings.monthlyMaintenanceBv),
        cappingLimit: Number(settings.cappingLimit),
        tdsRate: Number(settings.tdsRate),
        adminFeeRate: Number(settings.adminFeeRate),
        carryForwardEnabled: Boolean(settings.carryForwardEnabled),
      });

      setSuccessMsg('Commission rules and system parameters updated successfully! Changes logged to compliance audit trail.');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save system settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page-container">
      {/* 1. Header */}
      <div className="admin-page-header">
        <div className="admin-header-titles">
          <div className="admin-page-badge">
            <Sliders size={12} />
            <span>Algorithm Governance &bull; Rule Configuration</span>
          </div>
          <h1 className="admin-page-title">System Settings &amp; Commission Rules</h1>
          <p className="admin-page-subtitle">
            Configure binary pairing percentages, eligibility thresholds, capping limits, and statutory tax deductions
          </p>
        </div>

        <div className="admin-header-actions">
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={loadSettings}
            disabled={loading || saving}
            title="Reload from server"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Reset Form</span>
          </button>

          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={15} />
                <span>Save Commission Rules</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="admin-alert admin-alert-success">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="admin-alert admin-alert-error">
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. Form Grid */}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          {/* Card 1: Binary Engine Parameters */}
          <div className="admin-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div className="admin-kpi-icon blue" style={{ width: '36px', height: '36px' }}>
                <Percent size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Binary Matching Plan
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Core calculation percentages for volume matching
                </span>
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">
                Binary Pair Match Percentage (%) <span className="admin-mandatory-tag">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="50"
                className="admin-form-input"
                value={settings.binaryMatchPercentage}
                onChange={(e) =>
                  setSettings({ ...settings, binaryMatchPercentage: e.target.value })
                }
                required
              />
              <span className="admin-form-hint">
                Calculated on the weaker leg balanced volume (Default: 10%).
              </span>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">
                Direct Sponsor Bonus Rate (%) <span className="admin-mandatory-tag">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="50"
                className="admin-form-input"
                value={settings.directSponsorPercentage}
                onChange={(e) =>
                  setSettings({ ...settings, directSponsorPercentage: e.target.value })
                }
                required
              />
              <span className="admin-form-hint">
                Immediate commission credited to enrolling sponsor upon product purchases.
              </span>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">
                Weekly Capping Limit (₹) <span className="admin-mandatory-tag">*</span>
              </label>
              <input
                type="number"
                step="1000"
                min="10000"
                className="admin-form-input"
                value={settings.cappingLimit}
                onChange={(e) =>
                  setSettings({ ...settings, cappingLimit: e.target.value })
                }
                required
              />
              <span className="admin-form-hint">
                Maximum binary matching payout allowed per distributor in one weekly cycle.
              </span>
            </div>
          </div>

          {/* Card 2: Qualification & Maintenance Thresholds */}
          <div className="admin-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div className="admin-kpi-icon indigo" style={{ width: '36px', height: '36px' }}>
                <Coins size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Qualification &amp; Carry-Forward
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Volume prerequisites for commission eligibility
                </span>
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">
                Minimum PBV for Binary Qualification (BV) <span className="admin-mandatory-tag">*</span>
              </label>
              <input
                type="number"
                min="0"
                className="admin-form-input"
                value={settings.minPbvForQualification}
                onChange={(e) =>
                  setSettings({ ...settings, minPbvForQualification: e.target.value })
                }
                required
              />
              <span className="admin-form-hint">
                Personal volume required to activate 1:1 binary matching eligibility (Default: 100 BV).
              </span>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">
                Monthly Maintenance PBV (BV) <span className="admin-mandatory-tag">*</span>
              </label>
              <input
                type="number"
                min="0"
                className="admin-form-input"
                value={settings.monthlyMaintenanceBv}
                onChange={(e) =>
                  setSettings({ ...settings, monthlyMaintenanceBv: e.target.value })
                }
                required
              />
              <span className="admin-form-hint">
                Recurring monthly personal volume needed to maintain active commission status.
              </span>
            </div>

            <div className="admin-form-group" style={{ marginTop: '6px' }}>
              <label className="admin-form-label">
                Unmatched Volume Carry-Forward Architecture
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                }}
                onClick={() =>
                  setSettings({ ...settings, carryForwardEnabled: !settings.carryForwardEnabled })
                }
              >
                {settings.carryForwardEnabled ? (
                  <ToggleRight size={28} className="text-blue-600" />
                ) : (
                  <ToggleLeft size={28} className="text-gray-400" />
                )}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a' }}>
                    {settings.carryForwardEnabled ? 'Enabled (Carry forward un-matched leg BV)' : 'Disabled (Volume flushes every cycle)'}
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Surplus power leg volume carries forward indefinitely for qualified distributors.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Statutory Deductions & Processing Fees */}
          <div className="admin-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div className="admin-kpi-icon green" style={{ width: '36px', height: '36px' }}>
                <DollarSign size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Statutory Deductions &amp; Fees
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Tax deduction at source (TDS) and system operations levy
                </span>
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">
                TDS Rate (%) <span className="admin-mandatory-tag">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="30"
                className="admin-form-input"
                value={settings.tdsRate}
                onChange={(e) => setSettings({ ...settings, tdsRate: e.target.value })}
                required
              />
              <span className="admin-form-hint">
                Standard Section 194H tax deduction deducted prior to payout (Default: 5%).
              </span>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">
                Admin Processing Fee (%) <span className="admin-mandatory-tag">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="20"
                className="admin-form-input"
                value={settings.adminFeeRate}
                onChange={(e) => setSettings({ ...settings, adminFeeRate: e.target.value })}
                required
              />
              <span className="admin-form-hint">
                Software platform and banking maintenance deduction (Default: 5%).
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Five MLM Ranks & Cumulative Commission Configuration (Phase 1) */}
        <div className="admin-card" style={{ marginTop: '24px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="admin-kpi-icon indigo" style={{ width: '36px', height: '36px' }}>
                <Award size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Five MLM Ranks &amp; Cumulative Commission Hierarchy (Phase 1)
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Centralized, database-backed minimum thresholds (Silver, Gold, Platinum, Diamond, Ruby)
                </span>
              </div>
            </div>
            <span style={{ fontSize: '12px', color: '#0284c7', background: '#e0f2fe', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
              Independent Left &amp; Right Matching Enforced
            </span>
          </div>

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Tier Commission Rate (%)</th>
                  <th>Min Qualifying BV</th>
                  <th>Min Left Matching (BV)</th>
                  <th>Min Right Matching (BV)</th>
                  <th>Cumulative Payout Rate</th>
                  <th>Quick Action</th>
                </tr>
              </thead>
              <tbody>
                {ranks.map((r, idx) => {
                  let cumTotal = 0;
                  for (let i = 0; i <= idx; i++) {
                    cumTotal += Number(ranks[i].commissionPercent || 0);
                  }

                  return (
                    <tr key={r.code}>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              backgroundColor:
                                r.code === 'SILVER'
                                  ? '#94a3b8'
                                  : r.code === 'GOLD'
                                  ? '#eab308'
                                  : r.code === 'PLATINUM'
                                  ? '#06b6d4'
                                  : r.code === 'DIAMOND'
                                  ? '#3b82f6'
                                  : '#e11d48',
                            }}
                          />
                          <span>{r.name}</span>
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          className="admin-form-input"
                          style={{ width: '85px', padding: '4px 8px', fontSize: '13px' }}
                          value={r.commissionPercent}
                          onChange={(e) => handleRankChange(r.code, 'commissionPercent', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="50"
                          min="0"
                          className="admin-form-input"
                          style={{ width: '100px', padding: '4px 8px', fontSize: '13px' }}
                          value={r.minBV}
                          onChange={(e) => handleRankChange(r.code, 'minBV', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="500"
                          min="0"
                          className="admin-form-input"
                          style={{ width: '120px', padding: '4px 8px', fontSize: '13px' }}
                          value={r.minLeftMatching}
                          onChange={(e) => handleRankChange(r.code, 'minLeftMatching', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="500"
                          min="0"
                          className="admin-form-input"
                          style={{ width: '120px', padding: '4px 8px', fontSize: '13px' }}
                          value={r.minRightMatching}
                          onChange={(e) => handleRankChange(r.code, 'minRightMatching', e.target.value)}
                        />
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: '#16a34a' }}>
                          {cumTotal}% Total
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                          onClick={() => handleSaveRank(r.code)}
                          disabled={saving}
                          title="Save this rank configuration"
                        >
                          <Save size={13} />
                          <span>Update</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Save Action */}
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="submit"
            className="admin-btn admin-btn-primary"
            disabled={saving}
            style={{ padding: '12px 24px', fontSize: '14px' }}
          >
            {saving ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Saving Rules to System...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Save System Commission Rules</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
