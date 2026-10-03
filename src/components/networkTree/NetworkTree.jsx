import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Plus, Minus, Focus, RotateCcw } from 'lucide-react';
import TreeNode from './TreeNode';

/**
 * NetworkTree (Prompt 12)
 * High-performance controlled visual binary tree component featuring:
 * - Mouse wheel zoom with boundary clamping [0.4, 2.0]
 * - Mouse & touch drag-to-pan with 60fps tracking
 * - Mobile pinch-to-zoom & horizontal/vertical swipe navigation
 * - Controlled viewport that never overflows dashboard layout
 * - Floating quick-action canvas toolbar (+, -, Center, Reset)
 * - Smooth CSS transitions for button triggers without lag
 */
function NetworkTree({
  rootNode,
  depth = 3,
  zoomLevel = 1,
  onZoomChange,
  onResetZoom,
  onResetToRoot,
  onCenterTree,
  onNodeClick,
  onNodeHover,
  onNodeLeave,
  onFocusNode,
  onAvailableClick,
  highlightedId,
  panPosition,
  onPanChange,
  selectedMemberId,
  expandingNodeIds = {},
  onExpandNode,
  onCollapseNode,
  filterCriteria = null,
  adminViewOnly = false,
}) {
  const containerRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const [internalPan, setInternalPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [touchData, setTouchData] = useState({
    dist: 0,
    baseZoom: zoomLevel,
  });

  const currentPan = panPosition !== undefined ? panPosition : internalPan;
  const updatePan = onPanChange || setInternalPan;

  // 1. Mouse Drag / Pan Handlers
  const handleMouseDown = (e) => {
    // Only drag with primary mouse button when not clicking a card button or input
    if (e.button !== 0 || e.target.closest('button') || e.target.closest('.tree-node-card')) {
      return;
    }
    setIsPanning(true);
    setDragStart({ x: e.clientX - currentPan.x, y: e.clientY - currentPan.y });
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    updatePan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // 2. Mobile Touch Handlers (Touch Pan & Pinch-to-Zoom)
  const handleTouchStart = (e) => {
    if (e.target.closest('button') || e.target.closest('.tree-node-card')) {
      return;
    }

    if (e.touches.length === 1) {
      // Single-finger touch pan
      setIsPanning(true);
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - currentPan.x, y: touch.clientY - currentPan.y });
    } else if (e.touches.length === 2) {
      // Two-finger pinch to zoom
      setIsPanning(false);
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      setTouchData({ dist, baseZoom: zoomLevel });
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && isPanning) {
      const touch = e.touches[0];
      updatePan({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y,
      });
    } else if (e.touches.length === 2 && touchData.dist > 0 && onZoomChange) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const factor = dist / touchData.dist;
      const nextZoom = Math.max(0.4, Math.min(2.0, Number((touchData.baseZoom * factor).toFixed(2))));
      onZoomChange(nextZoom);
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
    setTouchData({ dist: 0, baseZoom: zoomLevel });
  };

  // 3. Mouse Wheel Zoom (Non-passive listener on container to prevent window scrolling)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onZoomChange) return;

    const handleWheel = (e) => {
      // Prevent browser from scrolling the dashboard page
      e.preventDefault();
      const zoomStep = e.deltaY < 0 ? 0.08 : -0.08;
      onZoomChange((prevZoom) => {
        const cur = typeof prevZoom === 'number' ? prevZoom : zoomLevel;
        return Math.max(0.4, Math.min(2.0, Number((cur + zoomStep).toFixed(2))));
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [zoomLevel, onZoomChange]);

  // 4. Center Selected Member or Root Node
  const centerMemberNode = useCallback((targetId) => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const idToFind = targetId || selectedMemberId || highlightedId;
    let targetEl = null;

    if (idToFind) {
      targetEl = container.querySelector(`[data-distributor-id="${idToFind}"]`);
    }

    if (!targetEl) {
      targetEl = container.querySelector('.tree-node-wrapper.is-root-node') ||
                 container.querySelector('.tree-node-card');
    }

    if (targetEl) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();

      const currentCenterX = targetRect.left + targetRect.width / 2;
      const currentCenterY = targetRect.top + targetRect.height / 2;
      const viewportCenterX = containerRect.left + containerRect.width / 2;
      const viewportCenterY = containerRect.top + containerRect.height / 3;

      const diffX = viewportCenterX - currentCenterX;
      const diffY = viewportCenterY - currentCenterY;

      updatePan({
        x: Math.round(currentPan.x + diffX),
        y: Math.round(currentPan.y + diffY),
      });
    } else {
      updatePan({ x: 0, y: 0 });
    }
  }, [selectedMemberId, highlightedId, currentPan, updatePan]);

  // 5. Recursive Binary Branch Renderer
  const isFilterActive = Boolean(
    filterCriteria &&
      ((filterCriteria.status && filterCriteria.status !== 'ALL') ||
        (filterCriteria.rank && filterCriteria.rank !== 'ALL') ||
        (filterCriteria.businessCenter && filterCriteria.businessCenter !== 'ALL'))
  );

  const checkFilterMatch = (n) => {
    if (!n || !isFilterActive) return false;
    if (filterCriteria.status && filterCriteria.status !== 'ALL') {
      const s = (n.status || '').toUpperCase();
      if (s !== filterCriteria.status.toUpperCase()) return false;
    }
    if (filterCriteria.rank && filterCriteria.rank !== 'ALL') {
      const r = (n.rank || '').toLowerCase();
      if (r !== filterCriteria.rank.toLowerCase()) return false;
    }
    if (filterCriteria.businessCenter && filterCriteria.businessCenter !== 'ALL') {
      const bc = (n.businessCenter || '').toUpperCase();
      if (!bc.includes(filterCriteria.businessCenter.toUpperCase())) return false;
    }
    return true;
  };

  const renderBinaryBranch = (
    node,
    isRoot = false,
    position = 'ROOT',
    currentLevel = 1,
    parentNode = null
  ) => {
    if (!node) return null;

    const leftChild = node.left || node.leftChild || null;
    const rightChild = node.right || node.rightChild || null;
    const hasChildren = Boolean(leftChild || rightChild);

    // Node is expanded if explicitly marked expanded, or if within initial depth and not collapsed
    const isBranchExpanded =
      hasChildren &&
      !node.isCollapsed &&
      (node.isExpanded !== undefined ? node.isExpanded : currentLevel < depth);

    const nodeId = node.distributorId || node.id || node.distributor?.distributorCode;
    const isMatch =
      highlightedId &&
      (node.id === highlightedId ||
        node.distributorId === highlightedId ||
        node.distributor?.distributorCode === highlightedId);

    const isExpanding = Boolean(expandingNodeIds && expandingNodeIds[nodeId]);
    const isMatchedByFilter = checkFilterMatch(node);

    return (
      <div className={`binary-branch-unit ${isRoot ? 'root-branch' : ''}`}>
        {/* Parent Node Card */}
        <div className="branch-parent-wrap">
          <TreeNode
            node={node}
            isRoot={isRoot}
            position={position}
            parentNode={parentNode}
            onNodeClick={onNodeClick}
            onNodeHover={onNodeHover}
            onNodeLeave={onNodeLeave}
            onFocusNode={onFocusNode}
            onAvailableClick={onAvailableClick}
            isHighlighted={isMatch}
            isExpanding={isExpanding}
            isExpanded={isBranchExpanded}
            onExpandNode={onExpandNode}
            onCollapseNode={onCollapseNode}
            adminViewOnly={adminViewOnly}
            isFilterActive={isFilterActive}
            isFilterMatched={isMatchedByFilter}
          />
        </div>

        {/* Binary Connecting Lines & Dual Children (LEFT & RIGHT) */}
        {isBranchExpanded && (
          <div className="binary-children-block">
            {/* Vertical stem dropping from parent to the horizontal crossbar */}
            <div className="branch-vertical-stem-down" />

            {/* Exactly Two Columns: LEFT and RIGHT */}
            <div className="binary-legs-row">
              {/* LEFT LEG */}
              <div className="binary-leg-col left-leg-col">
                <div className="leg-label-pill left-leg-pill">◀ LEFT LEG</div>
                {leftChild ? (
                  renderBinaryBranch(leftChild, false, 'LEFT', currentLevel + 1, node)
                ) : (
                  <TreeNode
                    node={null}
                    position="LEFT"
                    parentNode={node}
                    onAvailableClick={onAvailableClick}
                    adminViewOnly={adminViewOnly}
                  />
                )}
              </div>

              {/* RIGHT LEG */}
              <div className="binary-leg-col right-leg-col">
                <div className="leg-label-pill right-leg-pill">RIGHT LEG ▶</div>
                {rightChild ? (
                  renderBinaryBranch(rightChild, false, 'RIGHT', currentLevel + 1, node)
                ) : (
                  <TreeNode
                    node={null}
                    position="RIGHT"
                    parentNode={node}
                    onAvailableClick={onAvailableClick}
                    adminViewOnly={adminViewOnly}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`network-tree-canvas-viewport ${isPanning ? 'is-panning' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        className="tree-zoom-pan-plane"
        style={{
          transform: `translate(${currentPan.x}px, ${currentPan.y}px) scale(${zoomLevel})`,
          transformOrigin: 'top center',
          transition: isPanning ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {rootNode ? (
          renderBinaryBranch(rootNode, true, 'ROOT', 1)
        ) : (
          <div className="tree-empty-notice">
            <p>No binary genealogy network loaded.</p>
          </div>
        )}
      </div>

      {/* Floating Canvas Quick Controls (Prompt 12) */}
      <div className="canvas-floating-controls" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="canvas-floating-btn"
          onClick={() => onZoomChange && onZoomChange(Math.min(2.0, Number((zoomLevel + 0.1).toFixed(2))))}
          title="Zoom In (+)"
          aria-label="Zoom In"
        >
          <Plus size={15} />
          <span>Zoom In</span>
        </button>
        <button
          type="button"
          className="canvas-floating-btn zoom-level-badge"
          onClick={onResetZoom}
          title="Reset Zoom (100%)"
          aria-label="Reset Zoom"
        >
          {Math.round(zoomLevel * 100)}%
        </button>
        <button
          type="button"
          className="canvas-floating-btn"
          onClick={() => onZoomChange && onZoomChange(Math.max(0.4, Number((zoomLevel - 0.1).toFixed(2))))}
          title="Zoom Out (-)"
          aria-label="Zoom Out"
        >
          <Minus size={15} />
          <span>Zoom Out</span>
        </button>
        {onCenterTree && (
          <button
            type="button"
            className="canvas-floating-btn"
            onClick={onCenterTree}
            title="Center selected node in viewport"
            aria-label="Center Node"
          >
            <Focus size={15} />
            <span>Center</span>
          </button>
        )}
        {onResetToRoot && (
          <button
            type="button"
            className="canvas-floating-btn"
            onClick={onResetToRoot}
            title="Reset to logged-in user's tree"
            aria-label="Reset Tree"
          >
            <RotateCcw size={15} />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default NetworkTree;
