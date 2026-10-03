import React, { useState } from 'react';
import {
  X,
  Award,
  Calendar,
  Building2,
  Users,
  Network,
  Share2,
  Copy,
  Check,
  TrendingUp,
  User,
  ShieldCheck,
  ArrowLeftRight,
} from 'lucide-react';

/**
 * MemberDetailsPanel (Prompt 11)
 * Slide-over drawer / modal displaying comprehensive information for a clicked network member.
 *
 * Displays:
 * - Name
 * - Distributor ID
 * - Rank
 * - Status
 * - Joined Date
 * - Sponsor
 * - Business Center
 * - Direct Members
 * - Left Team Count
 * - Right Team Count
 * - Total Team Count
 *
 * Buttons:
 * - View Network (makes this distributor the root of the tree and updates URL to ?member=...)
 * - Close
 */
function MemberDetailsPanel({
  member,
  onClose,
  onViewNetwork,
  onEnrollDownline,
  onMoveDistributor,
  onViewAuditLogs,
  adminMode = false,
}) {
  const [copied, setCopied] = useState(false);

  if (!member) return null;

  const name =
    member.name ||
    member.distributor?.displayName ||
    member.distributor?.firstName ||
    'Distributor';
  const distributorId =
    member.distributorId ||
    member.distributor?.distributorCode ||
    'KV-0000';
  const rank = member.rank || member.distributor?.rankName || 'Business Center';
  const rawStatus = (member.status || member.distributor?.status || 'Active').toUpperCase();
  const isActive = rawStatus === 'ACTIVE';
  const status = rawStatus;

  const rawJoinedDate =
    member.joinedDate ||
    member.distributor?.createdAtFormatted ||
    member.distributor?.joinedDate ||
    '15 September 2026';

  let joinedDate = rawJoinedDate;
  if (rawJoinedDate && typeof rawJoinedDate === 'string') {
    const parsedDate = new Date(rawJoinedDate);
    if (!isNaN(parsedDate.getTime())) {
      joinedDate = parsedDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
  }
  const sponsor =
    member.sponsorName
      ? `${member.sponsor} (${member.sponsorName})`
      : member.sponsor ||
        member.sponsorId ||
        member.distributor?.sponsorCode ||
        (distributorId === 'KV-1001' ? 'KV-1000 (Corporate System)' : 'KV-1001 (Rahul Kaushal)');

  const placementParent =
    member.placementParentName
      ? `${member.placementParent} (${member.placementParentName})`
      : member.placementParent ||
        member.placementParentId ||
        (distributorId === 'KV-1001' ? 'ROOT (None)' : (member.parentId || member.sponsor || 'KV-1001'));

  const position = (member.position || (distributorId === 'KV-1001' ? 'ROOT' : 'LEFT')).toUpperCase();

  const businessCenter =
    member.businessCenterName
      ? `${member.businessCenter || 'BC-001'} - ${member.businessCenterName}`
      : member.businessCenter ||
        member.businessCenter?.centerCode ||
        'BC-001 (Corporate Headquarters)';

  // Recursive fallback for team counts
  const countSubtree = (child) => {
    if (!child) return 0;
    return 1 + countSubtree(child.left || child.leftChild) + countSubtree(child.right || child.rightChild);
  };

  const leftTeamCount =
    member.leftTeamCount !== undefined
      ? member.leftTeamCount
      : countSubtree(member.left || member.leftChild);
  const rightTeamCount =
    member.rightTeamCount !== undefined
      ? member.rightTeamCount
      : countSubtree(member.right || member.rightChild);
  const totalTeamCount =
    member.totalTeamCount !== undefined
      ? member.totalTeamCount
      : leftTeamCount + rightTeamCount;
  const directMembers =
    member.directMembers !== undefined
      ? member.directMembers
      : (member.left ? 1 : 0) + (member.right ? 1 : 0) || (distributorId === 'KV-1001' ? 2 : 1);

  const leftBV = member.leftBV ?? member.businessCenter?.leftVolume ?? leftTeamCount * 1000;
  const rightBV = member.rightBV ?? member.businessCenter?.rightVolume ?? rightTeamCount * 800;
  const personalBV = member.personalBV ?? member.pbv ?? 250;
  const totalBV = member.totalBV ?? (leftBV + rightBV + personalBV);
  const totalLegBV = leftBV + rightBV;
  const leftPct = totalLegBV > 0 ? Math.round((leftBV / totalLegBV) * 100) : 50;

  const referralUrl = `${window.location.origin}/join?ref=${distributorId}`;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="member-details-backdrop" onClick={onClose}>
      <aside className="member-details-panel" onClick={(e) => e.stopPropagation()}>
        {/* Panel Header */}
        <div className="panel-header">
          <div className="panel-avatar-block">
            <div className="panel-avatar">
              {name.charAt(0) || <User size={20} />}
            </div>
            <div>
              <h3 className="panel-member-name">{name}</h3>
              <span className="panel-member-id">Distributor ID: {distributorId}</span>
            </div>
          </div>
          <button
            type="button"
            className="panel-close-btn"
            onClick={onClose}
            aria-label="Close details"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status & Rank Badges */}
        <div className="panel-badges-row">
          <span className={`panel-status-badge ${isActive ? 'active' : 'inactive'}`}>
            <span className={`status-dot ${isActive ? 'dot-active' : 'dot-inactive'}`} />
            <span>{status}</span>
          </span>
          <span className="panel-rank-badge">
            <Award size={14} />
            <span>{rank}</span>
          </span>
          <span className="panel-leg-badge">
            <Building2 size={13} />
            <span>{member.businessCenter || 'BC-001'}</span>
          </span>
          <span className={`panel-position-badge pos-${position.toLowerCase()}`}>
            <span>Position: {position}</span>
          </span>
        </div>

        {/* 10 Required Fields Grid (Prompt 17 Specification) */}
        <div className="panel-card member-info-card">
          <h4 className="panel-card-title">
            <Users size={16} />
            <span>Distributor Organizational Details</span>
          </h4>
          <div className="panel-info-list">
            <div className="panel-info-row">
              <span className="panel-info-label">Name:</span>
              <span className="panel-info-value font-bold">{name}</span>
            </div>
            <div className="panel-info-row">
              <span className="panel-info-label">Distributor ID:</span>
              <span className="panel-info-value text-accent font-bold">{distributorId}</span>
            </div>
            <div className="panel-info-row">
              <span className="panel-info-label">Rank:</span>
              <span className="panel-info-value font-semibold">
                <Award size={13} className="inline-icon text-amber" />
                {rank}
              </span>
            </div>
            <div className="panel-info-row">
              <span className="panel-info-label">Status:</span>
              <span className="panel-info-value font-semibold">
                <span className={`status-dot ${isActive ? 'dot-active' : 'dot-inactive'}`} />
                {status}
              </span>
            </div>
            <div className="panel-info-row">
              <span className="panel-info-label">Sponsor:</span>
              <span className="panel-info-value text-accent font-semibold">{sponsor}</span>
            </div>
            <div className="panel-info-row">
              <span className="panel-info-label">Placement Parent:</span>
              <span className="panel-info-value text-purple font-semibold">{placementParent}</span>
            </div>
            <div className="panel-info-row">
              <span className="panel-info-label">Position:</span>
              <span className="panel-info-value font-bold">
                <span className={`position-tag-pill ${position.toLowerCase()}-pill`}>{position}</span>
              </span>
            </div>
            <div className="panel-info-row">
              <span className="panel-info-label">Business Center:</span>
              <span className="panel-info-value">
                <Building2 size={13} className="inline-icon text-slate" />
                {businessCenter}
              </span>
            </div>
            <div className="panel-info-row">
              <span className="panel-info-label">Joined Date:</span>
              <span className="panel-info-value">
                <Calendar size={13} className="inline-icon text-slate" />
                {joinedDate}
              </span>
            </div>

            <div className="panel-info-divider" />

            <div className="panel-info-row">
              <span className="panel-info-label">Direct Members:</span>
              <span className="panel-info-value font-bold">{directMembers}</span>
            </div>
            <div className="panel-info-row">
              <span className="panel-info-label">Left Team Count:</span>
              <span className="panel-info-value text-blue font-bold">{leftTeamCount}</span>
            </div>
            <div className="panel-info-row">
              <span className="panel-info-label">Right Team Count:</span>
              <span className="panel-info-value text-purple font-bold">{rightTeamCount}</span>
            </div>
            <div className="panel-info-row highlight-total-row">
              <span className="panel-info-label">Total Team Count:</span>
              <span className="panel-info-value text-dark font-bold">{totalTeamCount}</span>
            </div>
          </div>
        </div>

        {/* BV Summary & Volume Breakdown Card (Prompt 17 Requirement 9) */}
        <div className="panel-card volume-card">
          <h4 className="panel-card-title">
            <TrendingUp size={16} />
            <span>Business Volume (BV) Summary</span>
          </h4>
          <div className="panel-metric-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            <div className="panel-metric-item">
              <span className="metric-label">Personal BV (PBV)</span>
              <span className="metric-val text-emerald-600 font-bold">{personalBV.toLocaleString()} BV</span>
            </div>
            <div className="panel-metric-item">
              <span className="metric-label">Total Group BV (GBV)</span>
              <span className="metric-val text-dark font-bold">{totalBV.toLocaleString()} BV</span>
            </div>
            <div className="panel-metric-item">
              <span className="metric-label">Left Leg BV</span>
              <span className="metric-val text-blue font-bold">{leftBV.toLocaleString()} BV</span>
            </div>
            <div className="panel-metric-item">
              <span className="metric-label">Right Leg BV</span>
              <span className="metric-val text-purple font-bold">{rightBV.toLocaleString()} BV</span>
            </div>
          </div>
          {/* Dual Leg Balance Ratio Track */}
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
              <span>Left Leg: {leftPct}%</span>
              <span>Right Leg: {100 - leftPct}%</span>
            </div>
            <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${leftPct}%`, background: '#3b82f6', height: '100%' }} />
              <div style={{ width: `${100 - leftPct}%`, background: '#8b5cf6', height: '100%' }} />
            </div>
          </div>
        </div>

        {/* Distributor Referral Link Card (Hidden in Admin Mode) */}
        {!adminMode && (
          <div className="panel-card referral-card">
            <h4 className="panel-card-title">
              <Share2 size={16} />
              <span>Referral Link</span>
            </h4>
            <div className="referral-input-row">
              <input
                type="text"
                readOnly
                value={referralUrl}
                className="referral-readonly-input"
              />
              <button
                type="button"
                className="referral-copy-btn"
                onClick={handleCopyLink}
                title="Copy Referral Link"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Admin Viewing Notice */}
        {adminMode && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '12px',
              color: '#475569',
              lineHeight: '1.5',
            }}
          >
            <strong>🔒 Viewing &amp; Searching Only:</strong> Member movements and placement modifications are locked from this interface in accordance with Prompt 17 governance rules.
          </div>
        )}

        {/* Panel Action Buttons */}
        <div className="panel-actions-col">
          <button
            type="button"
            className="panel-action-btn primary-btn view-network-action-btn"
            onClick={() => {
              if (onViewNetwork) onViewNetwork(member);
              onClose();
            }}
            title="Make this distributor the root of the tree"
          >
            <Network size={16} />
            <span>{adminMode ? 'Inspect Subtree' : 'View Network'}</span>
          </button>

          {!adminMode && onMoveDistributor && (
            <button
              type="button"
              className="panel-action-btn admin-move-btn"
              onClick={() => onMoveDistributor(member)}
              title="Admin Move Distributor (Prompt 16)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <ArrowLeftRight size={15} />
              <span>Move Distributor (Admin)</span>
            </button>
          )}

          {!adminMode && onViewAuditLogs && (
            <button
              type="button"
              className="panel-action-btn audit-trail-btn"
              onClick={() => onViewAuditLogs(member)}
              title="View immutable tree audit trail for this distributor"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                background: '#f1f5f9',
                color: '#1e293b',
                border: '1px solid #cbd5e1',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <ShieldCheck size={15} className="text-emerald-600" />
              <span>View Audit Trail</span>
            </button>
          )}

          <button
            type="button"
            className="panel-action-btn secondary-btn close-panel-action-btn"
            onClick={onClose}
          >
            <X size={16} />
            <span>Close</span>
          </button>
        </div>
      </aside>
    </div>
  );
}

export default MemberDetailsPanel;
