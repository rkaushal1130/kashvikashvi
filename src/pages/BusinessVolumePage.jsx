import React, { useState, useEffect, useCallback } from 'react';
import { distributorApi } from '../api/distributorApi.js';
import {
  TrendingUp,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Calendar,
  Layers,
  ShoppingBag,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import './BusinessVolumePage.css';

export function BusinessVolumePage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [bvData, setBvData] = useState(null);

  const fetchBvData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await distributorApi.getMeBusinessVolume();
      if (res && res.success && res.data) {
        setBvData(res.data);
      } else {
        throw new Error(res?.message || 'Could not retrieve business volume.');
      }
    } catch (err) {
      console.error('[BusinessVolumePage] Error:', err);
      setError(err.message || 'Failed to load business volume data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBvData();
  }, [fetchBvData]);

  const personalBv = Number(bvData?.personalBv || 0);
  const leftTeamBv = Number(bvData?.leftTeamBv || 0);
  const rightTeamBv = Number(bvData?.rightTeamBv || 0);
  const totalTeamBv = Number(bvData?.totalTeamBv || leftTeamBv + rightTeamBv);
  const totalDownlineBv = Number(bvData?.totalDownlineBv || totalTeamBv);
  const weakerLegBv = Number(bvData?.weakerLegBv || Math.min(leftTeamBv, rightTeamBv));
  const carryLeft = Number(bvData?.carryForwardLeft || 0);
  const carryRight = Number(bvData?.carryForwardRight || 0);

  return (
    <div className="bv-page">
      {/* 1. Header */}
      <div className="bv-header-card">
        <div>
          <h1 className="bv-title">Business Volume & Performance</h1>
          <p className="bv-subtitle">
            Track personal purchases, binary team volume, and carry-forward balances
          </p>
        </div>
        <button
          className="refresh-btn"
          onClick={() => fetchBvData(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Volume'}</span>
        </button>
      </div>

      {error && (
        <div className="bv-alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Top Metric Cards Grid */}
      <div className="bv-cards-grid">
        {/* Personal BV */}
        <div className="bv-card">
          <div className="bv-card-top">
            <span className="card-label">PERSONAL BV</span>
            <div className="bv-icon-box personal-color">
              <ShoppingBag size={18} />
            </div>
          </div>
          <div className="card-val">{loading ? '...' : personalBv.toLocaleString()}</div>
          <div className="card-hint">From personal orders & activations</div>
        </div>

        {/* LEFT Team BV */}
        <div className="bv-card">
          <div className="bv-card-top">
            <span className="card-label">LEFT TEAM BV</span>
            <div className="bv-icon-box left-color">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="card-val">{loading ? '...' : leftTeamBv.toLocaleString()}</div>
          <div className="card-hint">
            Carry-Forward: <strong>{carryLeft.toLocaleString()} BV</strong>
          </div>
        </div>

        {/* RIGHT Team BV */}
        <div className="bv-card">
          <div className="bv-card-top">
            <span className="card-label">RIGHT TEAM BV</span>
            <div className="bv-icon-box right-color">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="card-val">{loading ? '...' : rightTeamBv.toLocaleString()}</div>
          <div className="card-hint">
            Carry-Forward: <strong>{carryRight.toLocaleString()} BV</strong>
          </div>
        </div>

        {/* Total Team BV */}
        <div className="bv-card">
          <div className="bv-card-top">
            <span className="card-label">TOTAL TEAM BV</span>
            <div className="bv-icon-box total-color">
              <Layers size={18} />
            </div>
          </div>
          <div className="card-val">{loading ? '...' : totalTeamBv.toLocaleString()}</div>
          <div className="card-hint">Combined binary downline volume</div>
        </div>
      </div>

      {/* 3. Matching & Carry Forward Deep Dive */}
      <div className="bv-details-panel">
        <h2 className="panel-title">Binary Matching & Carry-Forward Status</h2>
        <p className="panel-desc">
          Binary matching calculates payout on the weaker leg volume. The remaining
          unmatched volume from the stronger leg is automatically carried forward to the
          next calculation cycle without expiry.
        </p>

        <div className="carry-grid">
          <div className="carry-card">
            <div className="carry-header">
              <span className="carry-tag">Matched Volume</span>
              <ShieldCheck size={18} className="text-green-600" />
            </div>
            <div className="carry-number">{loading ? '...' : weakerLegBv.toLocaleString()} BV</div>
            <p className="carry-explanation">
              Eligible for 10% binary matching bonus commission in this cycle.
            </p>
          </div>

          <div className="carry-card">
            <div className="carry-header">
              <span className="carry-tag">LEFT Carry-Forward</span>
              <ArrowDownLeft size={18} className="text-blue-600" />
            </div>
            <div className="carry-number">{loading ? '...' : carryLeft.toLocaleString()} BV</div>
            <p className="carry-explanation">
              Preserved volume on the Left leg banked for future right leg matching.
            </p>
          </div>

          <div className="carry-card">
            <div className="carry-header">
              <span className="carry-tag">RIGHT Carry-Forward</span>
              <ArrowUpRight size={18} className="text-purple-600" />
            </div>
            <div className="carry-number">{loading ? '...' : carryRight.toLocaleString()} BV</div>
            <p className="carry-explanation">
              Preserved volume on the Right leg banked for future left leg matching.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BusinessVolumePage;
