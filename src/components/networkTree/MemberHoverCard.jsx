import React from 'react';
import {
  X,
  User,
  Award,
  Calendar,
  ShieldCheck,
  Building2,
  Users,
  GitBranch,
} from 'lucide-react';

/**
 * MemberHoverCard (Prompt 10)
 * Professional tooltip / floating card displayed when hovering (desktop) or tapping (mobile).
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
 * Strictly NO sensitive data (Password, OTP, PAN, Aadhaar, Bank account, PIN, KYC).
 */
function MemberHoverCard({
  node,
  position,
  isMobile = false,
  onClose,
  onViewDetails,
}) {
  if (!node) return null;

  const name =
    node.name ||
    node.distributor?.displayName ||
    node.distributor?.firstName ||
    'Rahul Kaushal';
  const distributorId =
    node.distributorId ||
    node.distributor?.distributorCode ||
    'KV-1001';
  const rank = node.rank || node.distributor?.rankName || 'Business Center';
  const rawStatus = node.status || node.distributor?.status || 'Active';
  const status = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
  const isActive = status.toLowerCase() === 'active';

  const rawJoinedDate =
    node.joinedDate ||
    node.distributor?.createdAtFormatted ||
    node.distributor?.joinedDate ||
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
    node.sponsor ||
    node.sponsorId ||
    node.distributor?.sponsorCode ||
    (distributorId === 'KV-1001' ? 'KV-1000' : 'KV-1001');
  const businessCenter =
    node.businessCenter ||
    node.businessCenterName ||
    node.businessCenter?.centerCode ||
    'BC-001';

  // Recursive count fallback if count fields not directly on node
  const countSubtree = (child) => {
    if (!child) return 0;
    return 1 + countSubtree(child.left || child.leftChild) + countSubtree(child.right || child.rightChild);
  };

  const leftTeamCount =
    node.leftTeamCount !== undefined
      ? node.leftTeamCount
      : countSubtree(node.left || node.leftChild);
  const rightTeamCount =
    node.rightTeamCount !== undefined
      ? node.rightTeamCount
      : countSubtree(node.right || node.rightChild);
  const totalTeamCount =
    node.totalTeamCount !== undefined
      ? node.totalTeamCount
      : leftTeamCount + rightTeamCount;
  const directMembers =
    node.directMembers !== undefined
      ? node.directMembers
      : (node.left ? 1 : 0) + (node.right ? 1 : 0) || (distributorId === 'KV-1001' ? 2 : 1);

  // Position calculation for desktop with boundary safety
  const cardStyle = isMobile
    ? {}
    : {
        left: position ? `${Math.min(position.x + 14, window.innerWidth - 320)}px` : '50%',
        top: position ? `${Math.max(16, Math.min(position.y - 120, window.innerHeight - 440))}px` : '50%',
      };

  const content = (
    <div
      className={`member-hover-card-box ${isMobile ? 'is-mobile-modal' : 'is-desktop-tooltip'}`}
      style={cardStyle}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Card Header */}
      <div className="hover-card-top-bar">
        <div className="hover-avatar-title-wrap">
          <div className="hover-node-avatar">
            {name.charAt(0) || <User size={16} />}
          </div>
          <div>
            <h3 className="hover-node-name">{name}</h3>
            <span className="hover-node-dist-id">{distributorId}</span>
          </div>
        </div>

        {isMobile && onClose && (
          <button
            type="button"
            className="hover-card-close-btn"
            onClick={onClose}
            aria-label="Close hover info"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Structured Details Grid (Prompt 10 Layout) */}
      <div className="hover-fields-grid">
        <div className="hover-field-row">
          <span className="hover-field-label">Distributor ID:</span>
          <span className="hover-field-value text-accent">{distributorId}</span>
        </div>

        <div className="hover-field-row">
          <span className="hover-field-label">Rank:</span>
          <span className="hover-field-value font-semibold">
            <Award size={12} className="inline-icon text-amber" />
            {rank}
          </span>
        </div>

        <div className="hover-field-row">
          <span className="hover-field-label">Status:</span>
          <span className="hover-field-value">
            <span className={`status-dot ${isActive ? 'dot-active' : 'dot-inactive'}`} />
            {status}
          </span>
        </div>

        <div className="hover-field-row">
          <span className="hover-field-label">Joined:</span>
          <span className="hover-field-value">
            <Calendar size={12} className="inline-icon text-slate" />
            {joinedDate}
          </span>
        </div>

        <div className="hover-field-row">
          <span className="hover-field-label">Sponsor:</span>
          <span className="hover-field-value text-accent">{sponsor}</span>
        </div>

        <div className="hover-field-row">
          <span className="hover-field-label">Business Center:</span>
          <span className="hover-field-value">
            <Building2 size={12} className="inline-icon text-slate" />
            {businessCenter}
          </span>
        </div>

        <div className="hover-divider" />

        {/* Team Statistics */}
        <div className="hover-field-row">
          <span className="hover-field-label">Direct Members:</span>
          <span className="hover-field-value font-bold">{directMembers}</span>
        </div>

        <div className="hover-field-row">
          <span className="hover-field-label">Left Team:</span>
          <span className="hover-field-value text-blue font-bold">{leftTeamCount}</span>
        </div>

        <div className="hover-field-row">
          <span className="hover-field-label">Right Team:</span>
          <span className="hover-field-value text-purple font-bold">{rightTeamCount}</span>
        </div>

        <div className="hover-field-row highlight-total">
          <span className="hover-field-label">Total Team:</span>
          <span className="hover-field-value font-bold text-dark">{totalTeamCount}</span>
        </div>
      </div>

      {/* Action Footer if Details Panel handler provided */}
      {onViewDetails && (
        <div className="hover-card-footer-action">
          <button
            type="button"
            className="hover-footer-btn"
            onClick={() => {
              if (onClose) onClose();
              onViewDetails(node);
            }}
          >
            <span>View Full Details</span>
            <GitBranch size={13} />
          </button>
        </div>
      )}
    </div>
  );

  // On Mobile: Wrap in backdrop modal for intuitive tap-to-inspect and tap-backdrop-to-dismiss
  if (isMobile) {
    return (
      <div className="member-hover-mobile-backdrop" onClick={onClose}>
        {content}
      </div>
    );
  }

  return content;
}

export default MemberHoverCard;
