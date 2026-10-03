import React from 'react';
import {
  ZoomIn,
  ZoomOut,
  Plus,
  Minus,
  RotateCcw,
  RefreshCw,
  ChevronRight,
  GitBranch,
  Focus,
  ChevronsDown,
  ChevronsUp,
} from 'lucide-react';

/**
 * TreeControls (Prompt 12)
 * Comprehensive professional tree control bar featuring:
 * - Zoom In (+)
 * - Zoom Out (-)
 * - Center (canvas / selected member)
 * - Reset (to logged-in user's tree)
 * - Expand (show more levels)
 * - Collapse (compact view)
 * - Depth selector & live breadcrumbs path
 */
function TreeControls({
  depth,
  onDepthChange,
  zoomLevel,
  onZoomChange,
  onResetZoom,
  onResetToRoot,
  onCenterTree,
  onExpand,
  onCollapse,
  onRefresh,
  loading = false,
  breadcrumbs = [],
  onBreadcrumbClick,
  selectedMemberName = null,
}) {
  const handleZoomIn = () => {
    onZoomChange(Math.min(2.0, Number((zoomLevel + 0.1).toFixed(2))));
  };

  const handleZoomOut = () => {
    onZoomChange(Math.max(0.4, Number((zoomLevel - 0.1).toFixed(2))));
  };

  return (
    <div className="tree-controls-wrapper">
      {/* Top Controls Bar */}
      <div className="tree-controls-bar">
        {/* Zoom In (+) Button */}
        <button
          type="button"
          className="control-action-btn zoom-btn zoom-in-action-btn"
          onClick={handleZoomIn}
          title="Zoom In (+)"
          aria-label="Zoom In"
        >
          <Plus size={15} />
          <span>Zoom In</span>
        </button>

        {/* Zoom Out (-) Button */}
        <button
          type="button"
          className="control-action-btn zoom-btn zoom-out-action-btn"
          onClick={handleZoomOut}
          title="Zoom Out (-)"
          aria-label="Zoom Out"
        >
          <Minus size={15} />
          <span>Zoom Out</span>
        </button>

        {/* Zoom Indicator */}
        <button
          type="button"
          className="control-action-btn zoom-indicator-btn"
          onClick={onResetZoom}
          title="Click to reset zoom to 100%"
          aria-label="Reset zoom to 100%"
        >
          <span>{Math.round(zoomLevel * 100)}%</span>
        </button>

        {/* Center Button */}
        <button
          type="button"
          className="control-action-btn center-btn"
          onClick={onCenterTree}
          title={
            selectedMemberName
              ? `Center on selected member (${selectedMemberName})`
              : 'Center tree in viewport'
          }
        >
          <Focus size={15} />
          <span>Center</span>
        </button>

        {/* Reset Button (Reset to logged-in user's tree) */}
        <button
          type="button"
          className="control-action-btn reset-btn"
          onClick={onResetToRoot}
          title="Reset to logged-in user's tree (My Network)"
        >
          <RotateCcw size={15} />
          <span>Reset</span>
        </button>

        {/* Expand Button */}
        <button
          type="button"
          className="control-action-btn expand-btn"
          onClick={onExpand}
          disabled={depth >= 5}
          title="Expand tree levels to show more downline members"
        >
          <ChevronsDown size={15} />
          <span>Expand</span>
        </button>

        {/* Collapse Button */}
        <button
          type="button"
          className="control-action-btn collapse-btn"
          onClick={onCollapse}
          disabled={depth <= 2}
          title="Collapse tree to compact view"
        >
          <ChevronsUp size={15} />
          <span>Collapse</span>
        </button>

        {/* Refresh Tree Button */}
        <button
          type="button"
          className={`control-action-btn refresh-btn ${loading ? 'loading' : ''}`}
          onClick={onRefresh}
          disabled={loading}
          title="Refresh tree from database"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Breadcrumbs Trail */}
      {breadcrumbs.length > 0 && (
        <div className="tree-breadcrumbs-strip">
          <div className="breadcrumbs-trail">
            <span className="trail-title">Path:</span>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.id + idx}>
                {idx > 0 && <ChevronRight size={14} className="trail-sep" />}
                <button
                  type="button"
                  className={`trail-crumb-btn ${idx === breadcrumbs.length - 1 ? 'active' : ''}`}
                  onClick={() => onBreadcrumbClick(crumb.id, idx)}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>

          <div className="tree-rule-badge">
            <GitBranch size={13} />
            <span>Dual-Leg Binary Genealogy</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default TreeControls;
