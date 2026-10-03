import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { treeApi } from '../api/treeApi.js';
import { businessVolumeApi } from '../api/businessVolumeApi.js';
import { BinaryTreeNode } from '../components/networkTree/BinaryTreeNode.jsx';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Focus,
  RefreshCw,
  Search,
  Users,
  TrendingUp,
  ChevronRight,
  AlertCircle,
  Home,
  X,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import './NetworkPage.css';
import { normalizeTree } from '../utils/treeNormalize.js';

export function NetworkPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const userRootId = currentUser?.memberId || currentUser?.distributorId || 'KV-1001';
  const urlMemberParam = searchParams.get('root') || searchParams.get('member');
  const [currentRootId, setCurrentRootId] = useState(urlMemberParam || userRootId);
  const [depth, setDepth] = useState(3);

  // Tree & volume data
  const [treeData, setTreeData] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [bvData, setBvData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Viewport Canvas State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);

  // Interaction State
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoverNode, setHoverNode] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchId, setSearchMatchId] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([
    { id: userRootId, name: `${currentUser?.name || 'Root'} (You)` },
  ]);

  // Load Tree Data from Backend
  const loadNetworkData = useCallback(
    async (rootId = currentRootId, currentDepth = depth, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [treeRes, statsRes, bvRes] = await Promise.allSettled([
          treeApi.getTree(rootId, currentDepth),
          treeApi.getNetworkStats(rootId),
          businessVolumeApi.getSummary(rootId),
        ]);

        if (treeRes.status === 'fulfilled' && treeRes.value?.data) {
          setTreeData(normalizeTree(treeRes.value.data));
        } else if (treeRes.status === 'rejected') {
          throw treeRes.reason;
        }

        if (statsRes.status === 'fulfilled' && statsRes.value?.data) {
          setStatsData(statsRes.value.data);
        }
        if (bvRes.status === 'fulfilled' && bvRes.value?.data) {
          setBvData(bvRes.value.data);
        }
      } catch (err) {
        console.error('[NetworkPage] Load tree error:', err);
        if (err.status === 403) {
          setError('Permission Denied: You cannot inspect a distributor network outside your permitted downline.');
        } else if (err.status === 404) {
          setError(`Distributor ID "${rootId}" not found in network directory.`);
        } else {
          setError(err.message || 'Failed to load binary tree from backend.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentRootId, depth]
  );

  useEffect(() => {
    loadNetworkData(currentRootId, depth);
  }, [currentRootId, depth, loadNetworkData]);

  // Sync breadcrumbs when root changes
  const handleReRoot = (newRootNode) => {
    const newId = newRootNode.distributorId || newRootNode.id;
    const newName = newRootNode.name || newId;

    setCurrentRootId(newId);
    setSearchParams({ root: newId });
    setSelectedNode(null);

    setBreadcrumbs((prev) => {
      const idx = prev.findIndex((b) => b.id === newId);
      if (idx !== -1) {
        return prev.slice(0, idx + 1);
      }
      return [...prev, { id: newId, name: newName }];
    });
  };

  const handleReturnToRoot = () => {
    setCurrentRootId(userRootId);
    setSearchParams({});
    setBreadcrumbs([{ id: userRootId, name: `${currentUser?.name || 'Root'} (You)` }]);
    setSelectedNode(null);
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  // Zoom controls
  const handleZoomIn = () => setZoomLevel((z) => Math.min(1.8, Number((z + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))));
  const handleResetZoom = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  // Pan / Drag handlers
  const handleMouseDown = (e) => {
    if (e.target.closest('.binary-node-card') || e.target.closest('button')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Search within permitted downline
  const handleSearch = (e) => {
    e.preventDefault();
    const query = searchQuery.trim().toUpperCase();
    if (!query) return;

    // Check if query exists in tree
    const findNodeInTree = (node) => {
      if (!node) return null;
      const id = (node.distributorId || node.id || '').toUpperCase();
      const name = (node.name || '').toUpperCase();
      if (id.includes(query) || name.includes(query)) return node;
      return findNodeInTree(node.left) || findNodeInTree(node.right);
    };

    const match = findNodeInTree(treeData);
    if (match) {
      setSearchMatchId(match.distributorId || match.id);
      setSelectedNode(match);
      setTimeout(() => setSearchMatchId(null), 3000);
    } else {
      // Re-root to search target directly through backend
      setCurrentRootId(query);
      setSearchParams({ root: query });
    }
  };

  // Node Hover Tooltip
  const handleNodeHover = (node, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverNode(node);
    setHoverPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
  };

  const handleNodeLeave = () => setHoverNode(null);

  // Render Tree recursively with SVG Connectors
  const renderBinaryBranch = (node, currentDepth, maxDepth, position = 'ROOT') => {
    if (currentDepth > maxDepth) return null;

    const isLeafLevel = currentDepth === maxDepth;
    const isRoot = currentDepth === 1;

    // If node is null, show Empty position card
    if (!node) {
      return (
        <div className="tree-branch-wrapper">
          <BinaryTreeNode
            node={null}
            position={position}
            level={currentDepth}
            onAvailableClick={(pos) =>
              alert(`To enroll a new member in the ${pos} position, navigate to the Enrollment form.`)
            }
          />
        </div>
      );
    }

    const hasChildren = Boolean(node.left || node.right || !isLeafLevel);
    const isSelected = selectedNode?.distributorId === node.distributorId || selectedNode?.id === node.id;
    const isHighlighted = searchMatchId === (node.distributorId || node.id);

    return (
      <div className="tree-branch-wrapper">
        <BinaryTreeNode
          node={node}
          position={position}
          level={currentDepth}
          isRoot={isRoot}
          isSelected={isSelected}
          isHighlighted={isHighlighted}
          onClick={(clicked) => setSelectedNode(clicked)}
          onHover={handleNodeHover}
          onLeave={handleNodeLeave}
        />

        {/* Binary Children row if not beyond depth */}
        {currentDepth < maxDepth && (
          <div className="tree-children-container">
            {/* SVG Connecting Lines */}
            <svg className="tree-connector-svg" aria-hidden="true">
              {/* Vertical stem from parent */}
              <line x1="50%" y1="0" x2="50%" y2="24" stroke="#94a3b8" strokeWidth="2" />
              {/* Horizontal line between Left and Right */}
              <line x1="25%" y1="24" x2="75%" y2="24" stroke="#94a3b8" strokeWidth="2" />
              {/* Vertical stems to children */}
              <line x1="25%" y1="24" x2="25%" y2="44" stroke="#94a3b8" strokeWidth="2" />
              <line x1="75%" y1="24" x2="75%" y2="44" stroke="#94a3b8" strokeWidth="2" />
            </svg>

            <div className="tree-children-row">
              {/* LEFT SUBTREE */}
              <div className="leg-branch left-leg-branch">
                {renderBinaryBranch(node.left, currentDepth + 1, maxDepth, 'LEFT')}
              </div>

              {/* RIGHT SUBTREE */}
              <div className="leg-branch right-leg-branch">
                {renderBinaryBranch(node.right, currentDepth + 1, maxDepth, 'RIGHT')}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Summary Metrics for Left and Right legs
  const leftMembers = statsData?.leftCount ?? treeData?.leftTeamCount ?? 0;
  const rightMembers = statsData?.rightCount ?? treeData?.rightTeamCount ?? 0;
  const leftVolume = bvData?.leftTeamBv ?? treeData?.leftBV ?? 0;
  const rightVolume = bvData?.rightTeamBv ?? treeData?.rightBV ?? 0;

  return (
    <div className="network-page">
      {/* 1. Left/Right Team Summary Banner */}
      <div className="team-summary-banner">
        <div className="team-banner-card left-team-banner">
          <div className="banner-pill left-pill">LEFT TEAM</div>
          <div className="banner-metrics">
            <div className="banner-metric-item">
              <span className="b-val">{leftMembers}</span>
              <span className="b-lbl">Members</span>
            </div>
            <div className="banner-metric-divider" />
            <div className="banner-metric-item">
              <span className="b-val">{Number(leftVolume).toLocaleString()}</span>
              <span className="b-lbl">Business Volume (BV)</span>
            </div>
          </div>
        </div>

        <div className="team-banner-center">
          <div className="binary-vs-badge">VS</div>
        </div>

        <div className="team-banner-card right-team-banner">
          <div className="banner-pill right-pill">RIGHT TEAM</div>
          <div className="banner-metrics">
            <div className="banner-metric-item">
              <span className="b-val">{rightMembers}</span>
              <span className="b-lbl">Members</span>
            </div>
            <div className="banner-metric-divider" />
            <div className="banner-metric-item">
              <span className="b-val">{Number(rightVolume).toLocaleString()}</span>
              <span className="b-lbl">Business Volume (BV)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Controls Toolbar & Breadcrumb Bar */}
      <div className="tree-toolbar-card">
        {/* Left: Breadcrumbs & Path */}
        <div className="breadcrumbs-strip">
          <button className="breadcrumb-home-btn" onClick={handleReturnToRoot} title="Return to your Root">
            <Home size={15} />
          </button>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              <ChevronRight size={13} className="crumb-arrow" />
              <button
                className={`crumb-btn ${idx === breadcrumbs.length - 1 ? 'current' : ''}`}
                onClick={() => handleReRoot({ distributorId: crumb.id, name: crumb.name })}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Right: Depth, Search & Viewport Tools */}
        <div className="toolbar-controls-cluster">
          {/* Search Box */}
          <form onSubmit={handleSearch} className="search-form-wrap">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search distributor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          {/* Depth Selector */}
          <div className="depth-selector-group">
            <span className="depth-label">Depth:</span>
            {[1, 2, 3, 4].map((d) => (
              <button
                key={d}
                className={`depth-toggle-btn ${depth === d ? 'active' : ''}`}
                onClick={() => setDepth(d)}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="toolbar-divider" />

          {/* Canvas Zoom Controls */}
          <div className="canvas-zoom-buttons">
            <button className="tool-btn" onClick={handleZoomOut} title="Zoom Out">
              <ZoomOut size={16} />
            </button>
            <span className="zoom-percentage-text">{Math.round(zoomLevel * 100)}%</span>
            <button className="tool-btn" onClick={handleZoomIn} title="Zoom In">
              <ZoomIn size={16} />
            </button>
            <button className="tool-btn" onClick={handleResetZoom} title="Reset Canvas">
              <RotateCcw size={15} />
            </button>
            <button
              className="tool-btn"
              onClick={() => loadNetworkData(currentRootId, depth, true)}
              title="Refresh Live Tree"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Error Banner */}
      {error && (
        <div className="network-error-banner">
          <ShieldAlert size={20} />
          <span>{error}</span>
          <button onClick={handleReturnToRoot} className="reset-root-btn">
            Return to My Root
          </button>
        </div>
      )}

      {/* 4. Interactive Tree Canvas */}
      <div
        className={`tree-canvas-viewport ${isDragging ? 'is-dragging' : ''}`}
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {loading ? (
          <div className="tree-loading-state">
            <RefreshCw size={32} className="animate-spin text-blue-600" />
            <p>Retrieving binary network tree from database...</p>
          </div>
        ) : treeData ? (
          <div
            className="tree-canvas-inner"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
              transformOrigin: 'top center',
            }}
          >
            {renderBinaryBranch(treeData, 1, depth, 'ROOT')}
          </div>
        ) : (
          <div className="tree-empty-state">
            <p>No network structure found for this distributor.</p>
          </div>
        )}
      </div>

      {/* 5. Hover Tooltip */}
      {hoverNode && (
        <div
          className="node-hover-tooltip"
          style={{
            left: `${hoverPos.x}px`,
            top: `${hoverPos.y}px`,
          }}
        >
          <div className="tooltip-name">{hoverNode.name || 'Distributor'}</div>
          <div className="tooltip-id">{hoverNode.distributorId || hoverNode.id}</div>
          <div className="tooltip-meta">
            <span>{hoverNode.position || 'ROOT'}</span> • <span>Level {hoverNode.level || 1}</span>
          </div>
        </div>
      )}

      {/* 6. Selected Node Details Slide-Out Modal / Panel */}
      {selectedNode && (
        <div className="node-details-drawer">
          <div className="drawer-header">
            <div className="drawer-title-column">
              <h3>{selectedNode.name || 'Distributor Details'}</h3>
              <span className="drawer-sub-id">{selectedNode.distributorId || selectedNode.id}</span>
            </div>
            <button className="drawer-close-btn" onClick={() => setSelectedNode(null)}>
              <X size={18} />
            </button>
          </div>

          <div className="drawer-body">
            <div className="drawer-attribute-grid">
              <div className="drawer-attr-row">
                <span className="attr-lbl">Status</span>
                <span className="attr-val badge-active">{selectedNode.status || 'ACTIVE'}</span>
              </div>
              <div className="drawer-attr-row">
                <span className="attr-lbl">Rank</span>
                <span className="attr-val">{selectedNode.rank || 'Executive Director'}</span>
              </div>
              <div className="drawer-attr-row">
                <span className="attr-lbl">Binary Position</span>
                <span className="attr-val">{selectedNode.position || 'ROOT'}</span>
              </div>
              <div className="drawer-attr-row">
                <span className="attr-lbl">Tree Level</span>
                <span className="attr-val">{selectedNode.level || 1}</span>
              </div>
              <div className="drawer-attr-row">
                <span className="attr-lbl">Direct Sponsor</span>
                <span className="attr-val">{selectedNode.sponsor || 'KV-1000'}</span>
              </div>
              <div className="drawer-attr-row">
                <span className="attr-lbl">Placement Parent</span>
                <span className="attr-val">{selectedNode.placementParent || 'ROOT'}</span>
              </div>
            </div>

            <div className="drawer-divider" />

            <h4 className="drawer-section-title">Network Volume & Team Size</h4>
            <div className="drawer-metrics-grid">
              <div className="drawer-metric-box">
                <span className="d-num">{selectedNode.leftBV ?? 0}</span>
                <span className="d-lbl">LEFT BV</span>
              </div>
              <div className="drawer-metric-box">
                <span className="d-num">{selectedNode.rightBV ?? 0}</span>
                <span className="d-lbl">RIGHT BV</span>
              </div>
              <div className="drawer-metric-box">
                <span className="d-num">{selectedNode.personalBV ?? 0}</span>
                <span className="d-lbl">Personal BV</span>
              </div>
              <div className="drawer-metric-box">
                <span className="d-num">
                  {(selectedNode.leftBV ?? 0) + (selectedNode.rightBV ?? 0)}
                </span>
                <span className="d-lbl">Total Team BV</span>
              </div>
            </div>

            <div className="drawer-actions">
              <button
                className="drawer-primary-btn"
                onClick={() => handleReRoot(selectedNode)}
              >
                <ExternalLink size={16} />
                <span>Re-Root & View Subtree</span>
              </button>
              <button
                className="drawer-secondary-btn"
                onClick={() => setSelectedNode(null)}
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NetworkPage;
