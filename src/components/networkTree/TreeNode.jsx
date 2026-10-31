import React from 'react';
import { refId } from '../../utils/treeNormalize.js';
import { Award, PlusCircle, Info } from 'lucide-react';

/**
 * TreeNode
 * Renders an individual node card in the binary MLM tree, or "+ Available" when the slot is empty.
 *
 * Visual layout:
 * ┌──────────────────────┐
 * │ Rahul Kaushal        │
 * │ KV-1001              │
 * │ Business Center      │
 * │ ● Active             │
 * └──────────────────────┘
 *
 * If empty:
 * ┌──────────────────────┐
 * │ + Available          │
 * └──────────────────────┘
 */
function TreeNode({
  node,
  isRoot = false,
  position = 'ROOT',
  treeLevel = 1,
  parentNode = null,
  onNodeClick,
  onNodeHover,
  onNodeLeave,
  onAvailableClick,
  isHighlighted = false,
  isExpanding = false,
  isExpanded = false,
  onExpandNode,
  onCollapseNode,
  adminViewOnly = false,
  isFilterMatched = false,
  isFilterActive = false,
  isAdmin = false,
}) {
  // 1. EMPTY SLOT Card
  if (!node) {
    if (adminViewOnly) {
      return (
        <div className="tree-node-wrapper empty-slot-wrapper admin-empty-slot">
          <div
            className="tree-node-card empty-card admin-readonly-empty"
            title={`Empty ${position} Position. Member movements & enrollment are locked in viewing mode.`}
          >
            <div className="empty-position-pill">
              {position ? `${position} POSITION` : 'AVAILABLE'}
            </div>
            <div className="empty-title-text" style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>
              Empty Slot
            </div>
            <p className="empty-instruction-note" style={{ color: '#cbd5e1' }}>🔒 Viewing Mode Only</p>
          </div>
        </div>
      );
    }

    return (
      <div className="tree-node-wrapper empty-slot-wrapper">
        <div
          className="tree-node-card empty-card"
          onClick={() => onAvailableClick && onAvailableClick(parentNode, position)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onAvailableClick && onAvailableClick(parentNode, position);
            }
          }}
          title={`Available ${position} Position. Click to enroll through official enrollment process.`}
        >
          <div className="empty-position-pill">
            {position ? `${position} POSITION` : 'AVAILABLE'}
          </div>
          <div className="empty-plus-circle">
            <PlusCircle size={22} className="plus-icon" />
          </div>
          <div className="empty-title-text">+ Available</div>
          <p className="empty-instruction-note">Official Enrollment Required</p>
        </div>
      </div>
    );
  }

  // 2. ACTIVE / REGISTERED MEMBER NODE Card
  const name = node.name || node.distributor?.displayName || node.distributor?.firstName || 'Distributor';
  const distributorId = node.distributorId || node.distributor?.distributorCode || 'KV-0000';
  const treeId = node.treeId || node.id;
  const rank = node.rank || node.distributor?.rankName || 'Business Center';
  const status = (node.status || node.distributor?.status || 'Active').toUpperCase();
  const isActive = status === 'ACTIVE';

  const rawPayment = node.paymentStatus || (isActive ? 'PAID' : 'PENDING');
  const paymentStatus = rawPayment.toUpperCase();
  const isPaid = paymentStatus === 'PAID';
  const isFailed = paymentStatus === 'FAILED' || paymentStatus === 'CANCELLED';

  // Task 2 Authoritative Color Specification:
  // Green ID: Starter Kit payment verified and member active.
  // Grey/Yellow ID: Payment pending or not verified.
  // Red ID: Payment failed.
  const idColorClass = (isActive && isPaid)
    ? 'id-active-paid'
    : isFailed
      ? 'id-failed'
      : 'id-pending';

  const leftBV = node.leftBV ?? node.businessCenter?.leftVolume ?? 0;
  const rightBV = node.rightBV ?? node.businessCenter?.rightVolume ?? 0;
  const totalBV = leftBV + rightBV;
  const leftPct = totalBV > 0 ? Math.round((leftBV / totalBV) * 100) : 50;

  // refId tolerates a string, an object ({memberId,name}) or undefined
  const sponsor = refId(node.sponsor) || 'KV-1001';
  const placementParent =
    refId(node.placementParent ?? node.parent) || (isRoot ? 'ROOT' : (parentNode?.distributorId || 'KV-1001'));
  const businessCenter = node.businessCenter || 'BC-001';

  // Check if node has deeper children
  const totalDownlines =
    (node.totalTeamCount ?? 0) +
    (node.directMembers ?? 0) +
    (node.leftTeamCount ?? 0) +
    (node.rightTeamCount ?? 0);
  const hasChildrenInMemory = Boolean(node.left || node.right || node.leftChild || node.rightChild);
  const hasDeeper = Boolean(
    node.hasDeeperMembers ||
    node.hasChildren ||
    totalDownlines > 0 ||
    hasChildrenInMemory
  );

  const filterClass = isFilterActive
    ? isFilterMatched
      ? 'filter-matched-node'
      : 'filter-dimmed-node'
    : '';

  return (
    <div className={`tree-node-wrapper ${isRoot ? 'is-root-node' : ''} ${filterClass}`}>
      <div
        className={`tree-node-card member-card ${isActive && isPaid ? 'status-active' : 'status-inactive'} ${isHighlighted ? 'search-highlighted' : ''
          } ${filterClass}`}
        data-distributor-id={distributorId}
        data-tree-level={treeLevel}
        data-has-deeper={hasDeeper ? 'true' : 'false'}
        data-legs-loaded={node.legsLoaded || node.left || node.right ? 'true' : 'false'}
        onClick={() => onNodeClick && onNodeClick(node)}
        onMouseEnter={(e) => onNodeHover && onNodeHover(node, e)}
        onMouseLeave={() => onNodeLeave && onNodeLeave()}
      >
        {/* Filter Match Badge */}
        {isFilterActive && isFilterMatched && (
          <div className="filter-match-chip">
            <span>★ Filter Match</span>
          </div>
        )}

        {/* Node Header Tag: Position & Level */}
        <div className="node-header-row">
          <span className={`position-tag ${isRoot ? 'root-tag' : position.toLowerCase() + '-tag'}`}>
            {isRoot ? 'ROOT' : position}
          </span>
          <div className="status-indicator-pill">
            <span className={`status-dot ${isActive && isPaid ? 'dot-active' : isFailed ? 'dot-failed' : 'dot-pending'}`} />
            <span className="status-text">{status}</span>
            <span className={`payment-pill payment-pill-${paymentStatus.toLowerCase()}`}>
              {paymentStatus}
            </span>
          </div>
        </div>

        {/* Member Details: Name & ID */}
        <div className="node-body">
          <h3 className="node-member-name" title={name}>
            {name}
          </h3>
          <div
            className={`node-distributor-id ${idColorClass}`}
            title={`Distributor ID: ${distributorId} | Status: ${status} | Payment: ${paymentStatus}`}
          >
            {distributorId}
          </div>
          {treeId && (
            <div className="node-tree-id-tag" title={`Tree ID: ${treeId}`}>
              Tree ID: {treeId}
            </div>
          )}
          <div className="node-rank-row">
            <Award size={13} className="rank-icon" />
            <span className="rank-name">{rank}</span>
          </div>

          {/* Micro Metadata Lineage Tags */}
          <div className="node-micro-meta-row">
            {/* <span className="meta-tag-pill" title={`Sponsor: ${sponsor}`}>
              Sp: {sponsor}
            </span> */}
            <span className="meta-tag-pill" title={`Placement Parent: ${placementParent}`}>
              Par: {placementParent}
            </span>
            <span className="meta-tag-pill bc-pill" title={`Business Center: ${businessCenter}`}>
              {businessCenter}
            </span>
          </div>
        </div>

        {/* Binary Volume Dual Leg Track */}
        <div className="node-volume-track-box">
          <div className="volume-labels">
            <span className="vol-side left-side">L: {leftBV.toLocaleString()} BV</span>
            <span className="vol-side right-side">R: {rightBV.toLocaleString()} BV</span>
          </div>
          <div className="volume-bar-bg">
            <div className="vol-bar-left" style={{ width: `${leftPct}%` }} />
            <div className="vol-bar-right" style={{ width: `${100 - leftPct}%` }} />
          </div>
        </div>

        {/* Node Actions Footer */}
        <div className="node-footer-actions">
          <button
            type="button"
            className="node-action-btn view-details-btn"
            onClick={(e) => {
              e.stopPropagation();
              onNodeClick && onNodeClick(node);
            }}
            title="View member breakdown"
          >
            <Info size={12} />
            <span>Details</span>
          </button>

        </div>
      </div>
    </div>
  );
}

export default TreeNode;
