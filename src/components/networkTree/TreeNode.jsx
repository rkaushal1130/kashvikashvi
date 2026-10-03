import React from 'react';
import { refId } from '../../utils/treeNormalize.js';
import { Award, PlusCircle, ArrowUpRight, Info, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

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
  parentNode = null,
  onNodeClick,
  onNodeHover,
  onNodeLeave,
  onFocusNode,
  onAvailableClick,
  isHighlighted = false,
  isExpanding = false,
  isExpanded = false,
  onExpandNode,
  onCollapseNode,
  adminViewOnly = false,
  isFilterMatched = false,
  isFilterActive = false,
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

  // 2. ACTIVE MEMBER NODE Card
  const name = node.name || node.distributor?.displayName || node.distributor?.firstName || 'Distributor';
  const distributorId = node.distributorId || node.distributor?.distributorCode || 'KV-0000';
  const rank = node.rank || node.distributor?.rankName || 'Business Center';
  const status = (node.status || node.distributor?.status || 'Active').toUpperCase();
  const isActive = status === 'ACTIVE';

  const leftBV = node.leftBV ?? node.businessCenter?.leftVolume ?? 0;
  const rightBV = node.rightBV ?? node.businessCenter?.rightVolume ?? 0;
  const totalBV = leftBV + rightBV;
  const leftPct = totalBV > 0 ? Math.round((leftBV / totalBV) * 100) : 50;

  // refId tolerates a string, an object ({memberId,name}) or undefined — the API has
  // returned both shapes, and calling .split() on the object form crashed the view.
  const sponsor = refId(node.sponsor) || 'KV-1001';
  const placementParent =
    refId(node.placementParent ?? node.parent) || (isRoot ? 'ROOT' : (parentNode?.distributorId || 'KV-1001'));
  const businessCenter = node.businessCenter || 'BC-001';

  // Prompt 14: Check if node has deeper children
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
        className={`tree-node-card member-card ${isActive ? 'status-active' : 'status-inactive'} ${
          isHighlighted ? 'search-highlighted' : ''
        } ${filterClass}`}
        data-distributor-id={distributorId}
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
            <span className={`status-dot ${isActive ? 'dot-active' : 'dot-inactive'}`} />
            <span className="status-text">{status}</span>
          </div>
        </div>

        {/* Member Details: Name & ID */}
        <div className="node-body">
          <h3 className="node-member-name" title={name}>
            {name}
          </h3>
          <div className="node-distributor-id">{distributorId}</div>
          <div className="node-rank-row">
            <Award size={13} className="rank-icon" />
            <span className="rank-name">{rank}</span>
          </div>

          {/* Micro Metadata Lineage Tags */}
          <div className="node-micro-meta-row">
            <span className="meta-tag-pill" title={`Sponsor: ${sponsor}`}>
              Sp: {sponsor}
            </span>
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

          {!isRoot && onFocusNode && (
            <button
              type="button"
              className="node-action-btn focus-subtree-btn"
              onClick={(e) => {
                e.stopPropagation();
                onFocusNode(node);
              }}
              title="Focus subtree from this member"
            >
              <ArrowUpRight size={12} />
              <span>Subtree</span>
            </button>
          )}

          {/* Expand / Collapse Action (Prompt 14) */}
          {hasDeeper && (
            <button
              type="button"
              className={`node-action-btn expand-node-btn ${isExpanding ? 'is-loading' : ''} ${
                isExpanded ? 'is-expanded' : 'is-collapsed'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (isExpanding) return;
                if (isExpanded) {
                  onCollapseNode && onCollapseNode(node);
                } else {
                  onExpandNode && onExpandNode(node);
                }
              }}
              disabled={isExpanding}
              title={isExpanded ? 'Collapse downline' : 'Expand downline members'}
            >
              {isExpanding ? (
                <>
                  <Loader2 size={12} className="spin-loader" />
                  <span>Loading...</span>
                </>
              ) : isExpanded ? (
                <>
                  <ChevronUp size={12} />
                  <span>Collapse</span>
                </>
              ) : (
                <>
                  <ChevronDown size={12} />
                  <span>Expand</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Prominent Bottom Expand Pill when node has deeper downlines and is collapsed (Prompt 14) */}
      {hasDeeper && !isExpanded && (
        <div className="node-bottom-expand-pill-wrap">
          <button
            type="button"
            className={`node-bottom-expand-pill ${isExpanding ? 'is-loading' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isExpanding) return;
              onExpandNode && onExpandNode(node);
            }}
            disabled={isExpanding}
            title="Expand downline members from database"
          >
            {isExpanding ? (
              <>
                <Loader2 size={11} className="spin-loader" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <ChevronDown size={11} />
                <span>Expand</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default TreeNode;
