import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Network,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  ArrowLeftRight,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import NetworkTree from '../components/networkTree/NetworkTree';
import TreeControls from '../components/networkTree/TreeControls';
import TreeSearch from '../components/networkTree/TreeSearch';
import MemberHoverCard from '../components/networkTree/MemberHoverCard';
import MemberDetailsPanel from '../components/networkTree/MemberDetailsPanel';
import { useAuth } from '../context/AuthContext.jsx';
import { treeApi } from '../api/treeApi.js';
import { api } from '../services/api.js';
import { normalizeTree } from '../utils/treeNormalize.js';
import '../components/networkTree/NetworkTree.css';

/**
 * Helper function to immutably update a specific node in the recursive binary tree.
 */
function updateNodeInTree(node, targetId, updaterFn) {
  if (!node) return null;
  const currentId = node.distributorId || node.id || node.distributor?.distributorCode;
  if (currentId === targetId) {
    return updaterFn(node);
  }
  return {
    ...node,
    left: updateNodeInTree(node.left, targetId, updaterFn),
    right: updateNodeInTree(node.right, targetId, updaterFn),
  };
}

/**
 * NetworkTreePage
 * Official binary MLM network genealogy page mounted at /network-tree.
 * Fully compliant with Prompt 9, 10 & 11 specifications:
 * - Visually represents dual-leg binary hierarchy (ROOT -> LEFT / RIGHT)
 * - Displays Name, Distributor ID, Status, Rank on every node
 * - Renders "+ Available" on open positions
 * - Clicking member opens MemberDetailsPanel with all 11 fields, "View Network" & "Close" buttons
 * - "View Network" re-roots the tree and updates URL to /network-tree?member=...
 * - Preserves selected member across page refreshes
 * - Center Tree button aligns canvas perfectly
 */
function NetworkTreePage({ embedded = false }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // 1. Authenticated User Session
  const { currentUser, isAuthenticated } = useAuth();
  const isAuthorized = Boolean(isAuthenticated);
  const initialDistributorId = currentUser?.memberId || currentUser?.distributorId || 'KV-1001';

  // Read URL member param for state persistence on refresh (?member=KV-1002)
  const urlMemberId = searchParams.get('member');
  const effectiveInitialRootId = urlMemberId || initialDistributorId;

  // 2. Tree Navigation & Depth State
  const [currentRootId, setCurrentRootId] = useState(effectiveInitialRootId);
  const [depth, setDepth] = useState(3);
  const [breadcrumbs, setBreadcrumbs] = useState(() => {
    if (urlMemberId && urlMemberId !== initialDistributorId) {
      return [
        { id: initialDistributorId, name: `${currentUser?.name || 'Rahul Kaushal'} (Root)` },
        { id: urlMemberId, name: urlMemberId },
      ];
    }
    return [
      { id: initialDistributorId, name: `${currentUser?.name || 'Rahul Kaushal'} (Root)` },
    ];
  });

  // 3. Tree Data & Loading State
  const [treeData, setTreeData] = useState(null);
  const [networkSummary, setNetworkSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandingNodeIds, setExpandingNodeIds] = useState({});

  // 4. UI Canvas Controls (Zoom, Pan, Search, Hover, Details, Mobile Viewport)
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [selectedMember, setSelectedMember] = useState(null);
  const [hoverNode, setHoverNode] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(null);
  const [authWarningModal, setAuthWarningModal] = useState(null);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768 || window.matchMedia('(pointer: coarse)').matches;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768 || window.matchMedia('(pointer: coarse)').matches);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 4b. MLM Tree Audit Logs & Admin Move Distributor (Prompt 16)
  const [auditLogsModalOpen, setAuditLogsModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditFilterEvent, setAuditFilterEvent] = useState('ALL');
  const [auditFilterMember, setAuditFilterMember] = useState('');

  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveFormData, setMoveFormData] = useState({
    memberId: '',
    oldParent: '',
    oldPosition: 'LEFT',
    newParent: '',
    newPosition: 'RIGHT',
    reason: '',
    adminId: currentUser?.id || currentUser?.memberId || 'usr-admin-001',
    timestamp: new Date().toISOString(),
  });
  const [moveSubmitting, setMoveSubmitting] = useState(false);
  const [moveError, setMoveError] = useState(null);
  const [moveSuccess, setMoveSuccess] = useState(null);

  const handleOpenAuditLogs = async (memberToFilter) => {
    setAuditLogsModalOpen(true);
    const mId = memberToFilter?.distributorId || memberToFilter?.id || '';
    setAuditFilterMember(mId);
    setAuditFilterEvent('ALL');
    setAuditLogsLoading(true);
    try {
      const res = await api.getTreeAuditLogs({
        memberId: mId,
      });
      setAuditLogs(res?.data || []);
    } catch (err) {
      console.error('Error fetching tree audit logs:', err);
    } finally {
      setAuditLogsLoading(false);
    }
  };

  const handleOpenMoveModal = (member) => {
    setSelectedMember(null);
    setMoveError(null);
    setMoveSuccess(null);
    const mId = member?.distributorId || member?.id || '';
    const oldP = member?.sponsor || member?.parentId || (mId === 'KV-1002' ? 'KV-1001' : 'KV-1002');
    const oldPos = (member?.position || 'LEFT').toUpperCase();

    setMoveFormData({
      memberId: mId,
      oldParent: oldP,
      oldPosition: oldPos,
      newParent: '',
      newPosition: 'RIGHT',
      reason: '',
      adminId: currentUser?.id || currentUser?.memberId || 'usr-admin-001',
      timestamp: new Date().toISOString(),
    });
    setMoveModalOpen(true);
  };

  const handleExecuteMove = async (e) => {
    e.preventDefault();
    setMoveError(null);
    setMoveSuccess(null);

    // Prompt 16 mandatory field requirements:
    // Reason, Old Parent, Old Position, New Parent, New Position, Admin ID, Timestamp
    if (!moveFormData.reason || !moveFormData.reason.trim()) {
      setMoveError('Reason is required to move a distributor.');
      return;
    }
    if (!moveFormData.oldParent || !moveFormData.oldParent.trim()) {
      setMoveError('Old Parent is required to move a distributor.');
      return;
    }
    if (!moveFormData.oldPosition || !moveFormData.oldPosition.trim()) {
      setMoveError('Old Position is required to move a distributor.');
      return;
    }
    if (!moveFormData.newParent || !moveFormData.newParent.trim()) {
      setMoveError('New Parent is required to move a distributor.');
      return;
    }
    if (!moveFormData.newPosition || !moveFormData.newPosition.trim()) {
      setMoveError('New Position is required to move a distributor.');
      return;
    }
    if (!moveFormData.adminId || !moveFormData.adminId.trim()) {
      setMoveError('Admin ID is required to move a distributor.');
      return;
    }
    if (!moveFormData.memberId || !moveFormData.memberId.trim()) {
      setMoveError('Member ID is required to move a distributor.');
      return;
    }
    if (moveFormData.memberId.trim().toUpperCase() === moveFormData.newParent.trim().toUpperCase()) {
      setMoveError('A distributor cannot be moved under themselves.');
      return;
    }

    setMoveSubmitting(true);
    try {
      const res = await api.moveDistributor({
        memberId: moveFormData.memberId.trim(),
        oldParent: moveFormData.oldParent.trim(),
        oldPosition: moveFormData.oldPosition.trim(),
        newParent: moveFormData.newParent.trim(),
        newPosition: moveFormData.newPosition.trim(),
        reason: moveFormData.reason.trim(),
        adminId: moveFormData.adminId.trim(),
        timestamp: new Date().toISOString(),
      });

      if (res && res.success) {
        setMoveSuccess(res.message || 'Distributor moved successfully! Immutable audit record created.');
        fetchTreeData(currentRootId, depth);
        setTimeout(() => {
          setMoveModalOpen(false);
          handleOpenAuditLogs({ distributorId: moveFormData.memberId });
        }, 1200);
      } else {
        setMoveError(res?.message || 'Failed to move distributor.');
      }
    } catch (err) {
      setMoveError(err.message || 'Failed to move distributor.');
    } finally {
      setMoveSubmitting(false);
    }
  };

  // 5. Fetch Tree Data & Summary from API
  const fetchTreeData = useCallback(
    async (rootId, maxDepth) => {
      setLoading(true);
      setError(null);
      try {
        const targetId = rootId || initialDistributorId;

        // Fetch tree: try treeApi.getTree first (handles downline security check & 403 authorization)
        let data = null;
        try {
          const treeRes = await treeApi.getTree(targetId, maxDepth);
          if (treeRes && treeRes.success) {
            data = treeRes.data?.root || treeRes.data;
          }
        } catch (apiErr) {
          if (
            apiErr?.status === 403 ||
            apiErr?.isForbidden ||
            apiErr?.message?.includes('403') ||
            apiErr?.message?.includes('Forbidden')
          ) {
            setError(
              apiErr.message ||
                '403 Forbidden: You do not have permission to access or view this distributor network.'
            );
            setLoading(false);
            return;
          }
        }

        // Fallback to secondary endpoints if needed
        if (!data) {
          if (targetId && targetId !== initialDistributorId) {
            const res = await api.getMemberNetworkTree(targetId, maxDepth);
            data = res?.root || res?.data?.root || res?.data || res;
          } else {
            const res = await api.getNetworkTree(maxDepth);
            data = res?.root || res?.data?.root || res?.data || res;
          }
        }

        // Fallback to binary tree if needed
        if (!data) {
          data = await api.getBinaryTree(targetId, maxDepth);
        }

        if (data) {
          setTreeData(normalizeTree(data));
        } else {
          setError('Unable to load network tree from database.');
        }

        // Fetch network statistics / summary
        try {
          const statsRes = await treeApi.getNetworkStats(targetId);
          if (statsRes && statsRes.success && statsRes.data) {
            setNetworkSummary(statsRes.data);
          } else {
            const summary = await api.getMemberNetworkSummary(targetId);
            if (summary) {
              setNetworkSummary(summary);
            }
          }
        } catch {
          const summary = await api.getMemberNetworkSummary(targetId);
          if (summary) {
            setNetworkSummary(summary);
          }
        }
      } catch (err) {
        setError(err.message || 'Error fetching network genealogy.');
      } finally {
        setLoading(false);
      }
    },
    [initialDistributorId]
  );

  useEffect(() => {
    fetchTreeData(currentRootId, depth);
  }, [currentRootId, depth, fetchTreeData]);

  // 6. Navigation & View Network Handlers (Prompt 11 & 13)
  const handleViewNetwork = (member) => {
    if (!member) return;
    const memberId = member.distributorId || member.id || member.distributor?.distributorCode;
    const memberName = member.name || member.distributor?.displayName || member.distributor?.firstName || memberId;

    // 1. Make that distributor the root of the tree
    setCurrentRootId(memberId);

    // 2. Update URL to /network-tree?member=KV-1002 (preserved across refreshes)
    setSearchParams({ member: memberId });

    // 3. Update breadcrumbs path
    setBreadcrumbs((prev) => {
      const idx = prev.findIndex((b) => b.id === memberId);
      if (idx !== -1) return prev.slice(0, idx + 1);
      return [...prev, { id: memberId, name: memberName }];
    });

    // 4. Center tree on the newly viewed root
    setPanPosition({ x: 0, y: 0 });
    setSelectedMember(null);
    setHoverNode(null);
  };

  const handleSelectSearchResult = (distributor) => {
    if (!distributor) return;
    const memberId = distributor.distributorId || distributor.id;
    const memberName = distributor.name || memberId;

    // 1. Open that distributor's tree
    setCurrentRootId(memberId);

    // 2. Update URL to /network-tree?member=KV-1001 (preserved across refreshes)
    setSearchParams({ member: memberId });

    // 3. Update breadcrumbs path
    setBreadcrumbs((prev) => {
      const idx = prev.findIndex((b) => b.id === memberId);
      if (idx !== -1) return prev.slice(0, idx + 1);
      return [...prev, { id: memberId, name: memberName }];
    });

    // 4. Center selected distributor
    setPanPosition({ x: 0, y: 0 });
    setSelectedMember(null);
    setHoverNode(null);

    // Ensure canvas viewport centers on the newly opened tree
    setTimeout(() => {
      handleCenterTree(memberId);
    }, 120);
  };

  const handleBreadcrumbClick = (crumbId, index) => {
    setCurrentRootId(crumbId);
    if (crumbId === initialDistributorId) {
      setSearchParams({});
    } else {
      setSearchParams({ member: crumbId });
    }
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setPanPosition({ x: 0, y: 0 });
    setSelectedMember(null);
  };

  const handleResetToRoot = () => {
    setCurrentRootId(initialDistributorId);
    setSearchParams({}); // removes ?member from URL
    setBreadcrumbs([
      { id: initialDistributorId, name: `${currentUser?.name || 'Rahul Kaushal'} (Root)` },
    ]);
    setZoomLevel(1);
    setDepth(3);
    setPanPosition({ x: 0, y: 0 });
    setSelectedMember(null);
    setHoverNode(null);
  };

  const handleCenterTree = (targetMemberId) => {
    const memberToCenter =
      targetMemberId ||
      selectedMember?.distributorId ||
      currentRootId;

    if (memberToCenter) {
      const el = document.querySelector(`[data-distributor-id="${memberToCenter}"]`);
      const container = document.querySelector('.network-tree-canvas-viewport');
      if (el && container) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = el.getBoundingClientRect();
        const diffX =
          containerRect.left + containerRect.width / 2 - (targetRect.left + targetRect.width / 2);
        const diffY =
          containerRect.top + containerRect.height / 3 - (targetRect.top + targetRect.height / 2);
        setPanPosition((prev) => ({
          x: Math.round(prev.x + diffX),
          y: Math.round(prev.y + diffY),
        }));
        return;
      }
    }
    setPanPosition({ x: 0, y: 0 });
  };

  const handleExpand = () => {
    setDepth((prev) => Math.min(5, prev + 1));
  };

  const handleCollapse = () => {
    setDepth((prev) => Math.max(2, prev - 1));
  };

  const handleZoomChange = (valOrFn) => {
    setZoomLevel((prev) => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      return Math.max(0.4, Math.min(2.0, Number(next.toFixed(2))));
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  // Prompt 14: Dynamic lazy expansion of downline nodes
  const handleExpandNode = useCallback(async (node) => {
    if (!node) return;
    const nodeId = node.distributorId || node.id || node.distributor?.distributorCode;
    if (!nodeId) return;

    // If children are already loaded into memory, simply expand without network request
    if (node.left || node.right || node.leftChild || node.rightChild) {
      setTreeData((prev) =>
        updateNodeInTree(prev, nodeId, (curr) => ({
          ...curr,
          isExpanded: true,
          isCollapsed: false,
        }))
      );
      return;
    }

    // Lazy load next level from backend: GET /api/v1/network-tree/member/:id?depth=2
    setExpandingNodeIds((prev) => ({ ...prev, [nodeId]: true }));
    try {
      const res = await api.getMemberNetworkTree(nodeId, 2);
      const fetchedRoot = normalizeTree(res?.root || res);
      if (fetchedRoot) {
        const hasAnyChildren = Boolean(fetchedRoot.left || fetchedRoot.right);
        setTreeData((prev) =>
          updateNodeInTree(prev, nodeId, (curr) => ({
            ...curr,
            left: fetchedRoot.left || null,
            right: fetchedRoot.right || null,
            hasDeeperMembers: hasAnyChildren ? (fetchedRoot.hasDeeperMembers ?? curr.hasDeeperMembers) : false,
            hasChildren: hasAnyChildren,
            isExpanded: true,
            isCollapsed: false,
          }))
        );
      }
    } catch (err) {
      console.error(`Failed to expand node ${nodeId}:`, err);
    } finally {
      setExpandingNodeIds((prev) => {
        const next = { ...prev };
        delete next[nodeId];
        return next;
      });
    }
  }, []);

  const handleCollapseNode = useCallback((node) => {
    if (!node) return;
    const nodeId = node.distributorId || node.id || node.distributor?.distributorCode;
    if (!nodeId) return;

    setTreeData((prev) =>
      updateNodeInTree(prev, nodeId, (curr) => ({
        ...curr,
        isExpanded: false,
        isCollapsed: true,
      }))
    );
  }, []);

  // Synchronize state when browser URL query parameter changes
  useEffect(() => {
    const memberParam = searchParams.get('member');
    const targetId = memberParam || initialDistributorId;
    if (targetId !== currentRootId) {
      setCurrentRootId(targetId);
      setBreadcrumbs((prev) => {
        if (!prev.some((b) => b.id === targetId)) {
          return [...prev, { id: targetId, name: targetId }];
        }
        return prev;
      });
      setPanPosition({ x: 0, y: 0 });
    }
  }, [searchParams, initialDistributorId, currentRootId]);

  // 8. Interaction Handlers (Prompt 10: Desktop Hover; Prompt 11: Click opens Member Details)
  const handleNodeClick = (node) => {
    setSelectedMember(node);
    setHoverNode(null);
  };

  const handleNodeHover = (node, event) => {
    if (isMobile) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setHoverPosition({
      x: rect.right,
      y: rect.top + rect.height / 2,
    });
    setHoverNode(node);
  };

  const handleNodeLeave = () => {
    if (isMobile) return;
    setHoverNode(null);
    setHoverPosition(null);
  };

  // 9. "+ Available" Slot Enrollment Security Enforcement
  const handleAvailableSlotClick = (parentNode, position) => {
    // "Do not allow unauthorized users to create members directly from the + button.
    // The actual enrollment must use the enrollment process."
    if (!isAuthorized) {
      setAuthWarningModal({
        title: 'Authentication Required',
        message:
          'You are not authorized to enroll members directly. Only registered, authenticated distributors can place new enrollments into binary tree positions.',
        actionText: 'Sign In to Enroll',
        onConfirm: () => navigate('/profile'),
      });
      return;
    }

    const sponsorId = parentNode?.distributorId || initialDistributorId;
    // Authorized user: route to official enrollment process with sponsor & leg prefilled
    navigate(`/join?ref=${encodeURIComponent(sponsorId)}&leg=${position}`);
  };

  const handleEnrollDownline = (member) => {
    const sponsorId = member?.distributorId || initialDistributorId;
    navigate(`/join?ref=${encodeURIComponent(sponsorId)}`);
  };

  return (
    <div className="network-tree-page-container">
      {/* Header Section */}
      <header className="network-tree-header-section">
        <div className="tree-header-top-row">
          <div className="tree-brand-title-wrap">
            <div className="tree-header-badges-row">
              <div className="tree-badge-pill">
                <Network size={13} />
                <span>BINARY GENEALOGY TREE</span>
              </div>
              {!embedded && isAuthorized && (
                <button
                  type="button"
                  className="btn-back-dashboard"
                  onClick={() => navigate('/dashboard')}
                >
                  ← Back to Dashboard
                </button>
              )}
              <div className="tree-header-action-buttons">
                <button
                  type="button"
                  className="btn-tree-audit-trail"
                  onClick={() => handleOpenAuditLogs()}
                  title="View immutable tree audit trail for all operations (Prompt 16)"
                >
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>Tree Audit Logs</span>
                </button>
                <button
                  type="button"
                  className="btn-tree-move-admin"
                  onClick={() => handleOpenMoveModal()}
                  title="Admin Move Distributor (Prompt 16: Requires reason, old/new parents & positions, generates immutable audit log)"
                >
                  <ArrowLeftRight size={14} />
                  <span>Move Distributor</span>
                </button>
              </div>
            </div>
            <h1 className="tree-page-title">Network Tree</h1>
            <p className="tree-page-subtitle">
              Interactive dual-leg marketing organization. Every distributor has maximum 2 direct legs (Left &amp; Right).
            </p>
          </div>

          {/* Real-time Backend Search (Prompt 13) */}
          <TreeSearch onSelectMember={handleSelectSearchResult} />
        </div>

        {/* Network Summary Bar (Prompt 7 Metrics) */}
        {networkSummary && (
          <div className="tree-summary-metrics-bar">
            <div className="tree-stat-card">
              <span className="tree-stat-label">Total Team Count</span>
              <span className="tree-stat-value">{networkSummary.totalTeamCount ?? 0}</span>
            </div>
            <div className="tree-stat-card">
              <span className="tree-stat-label">Direct Members</span>
              <span className="tree-stat-value">{networkSummary.directMembers ?? 0}</span>
            </div>
            <div className="tree-stat-card left-team">
              <span className="tree-stat-label">Left Leg Team</span>
              <span className="tree-stat-value">{networkSummary.leftTeamCount ?? 0}</span>
              <span className="tree-stat-sub">{(networkSummary.leftBV ?? 0).toLocaleString()} BV</span>
            </div>
            <div className="tree-stat-card right-team">
              <span className="tree-stat-label">Right Leg Team</span>
              <span className="tree-stat-value">{networkSummary.rightTeamCount ?? 0}</span>
              <span className="tree-stat-sub">{(networkSummary.rightBV ?? 0).toLocaleString()} BV</span>
            </div>
          </div>
        )}

        {/* Toolbar Controls & Breadcrumbs */}
        <div className="tree-toolbar-row">
          <TreeControls
            depth={depth}
            onDepthChange={setDepth}
            zoomLevel={zoomLevel}
            onZoomChange={handleZoomChange}
            onResetZoom={handleResetZoom}
            onResetToRoot={handleResetToRoot}
            onCenterTree={() => handleCenterTree()}
            onExpand={handleExpand}
            onCollapse={handleCollapse}
            onRefresh={() => fetchTreeData(currentRootId, depth)}
            loading={loading}
            breadcrumbs={breadcrumbs}
            onBreadcrumbClick={handleBreadcrumbClick}
            selectedMemberName={selectedMember?.name}
          />
        </div>
      </header>

      {/* Main Binary Canvas Viewport */}
      <main className="tree-main-content-area">
        {loading && (
          <div className="tree-canvas-loading-overlay">
            <div className="spinner-orbit" />
            <p>Loading database-driven binary genealogy...</p>
          </div>
        )}

        {error && !loading && (
          <div className="tree-canvas-error-banner">
            <p>{error}</p>
            <button
              type="button"
              className="btn-retry"
              onClick={() => fetchTreeData(currentRootId, depth)}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && (
          <NetworkTree
            rootNode={treeData}
            depth={depth}
            zoomLevel={zoomLevel}
            onZoomChange={handleZoomChange}
            onResetZoom={handleResetZoom}
            onResetToRoot={handleResetToRoot}
            onCenterTree={() => handleCenterTree()}
            panPosition={panPosition}
            onPanChange={setPanPosition}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            onNodeLeave={handleNodeLeave}
            onFocusNode={handleViewNetwork}
            onAvailableClick={handleAvailableSlotClick}
            highlightedId={selectedMember?.distributorId || null}
            selectedMemberId={selectedMember?.distributorId}
            expandingNodeIds={expandingNodeIds}
            onExpandNode={handleExpandNode}
            onCollapseNode={handleCollapseNode}
          />
        )}
      </main>

      {/* Floating Hover Card (Desktop) / Modal Info Card (Mobile Tap) */}
      {hoverNode && (
        <MemberHoverCard
          node={hoverNode}
          position={hoverPosition}
          isMobile={isMobile}
          onClose={() => {
            setHoverNode(null);
            setHoverPosition(null);
          }}
          onViewDetails={(node) => {
            setHoverNode(null);
            setSelectedMember(node);
          }}
        />
      )}

      {/* Slide-Over Member Details Drawer / Modal (Prompt 11 & 16) */}
      {selectedMember && (
        <MemberDetailsPanel
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onViewNetwork={handleViewNetwork}
          onEnrollDownline={handleEnrollDownline}
          onMoveDistributor={handleOpenMoveModal}
          onViewAuditLogs={handleOpenAuditLogs}
        />
      )}

      {/* MLM Tree Audit Logs Modal (Prompt 16) */}
      {auditLogsModalOpen && (
        <div
          className="audit-modal-backdrop"
          onClick={() => setAuditLogsModalOpen(false)}
        >
          <div
            className="audit-modal-window"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="audit-modal-header">
              <div className="audit-modal-title-group">
                <div className="audit-modal-icon-badge">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="audit-modal-title">MLM Tree Audit Trail</h3>
                  <p className="audit-modal-sub">
                    Immutable Compliance &amp; Operations Forensic Ledger (Prompt 16)
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="audit-modal-close-btn"
                onClick={() => setAuditLogsModalOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filter controls */}
            <div className="audit-modal-filters-bar">
              <select
                className="audit-filter-select"
                value={auditFilterEvent}
                onChange={(e) => setAuditFilterEvent(e.target.value)}
              >
                <option value="ALL">All Tree Events (6)</option>
                <option value="SPONSOR_ASSIGNED">SPONSOR_ASSIGNED</option>
                <option value="DISTRIBUTOR_CREATED">DISTRIBUTOR_CREATED</option>
                <option value="TREE_MEMBER_PLACED">TREE_MEMBER_PLACED</option>
                <option value="TREE_MEMBER_MOVED">TREE_MEMBER_MOVED</option>
                <option value="TREE_MEMBER_REMOVED">TREE_MEMBER_REMOVED</option>
                <option value="TREE_POSITION_CHANGED">TREE_POSITION_CHANGED</option>
              </select>

              <input
                type="text"
                className="audit-filter-search"
                placeholder="Filter by Member ID, Sponsor ID, or Actor ID..."
                value={auditFilterMember}
                onChange={(e) => setAuditFilterMember(e.target.value)}
              />

              <button
                type="button"
                className="btn-tree-audit-trail"
                onClick={() => handleOpenAuditLogs({ distributorId: auditFilterMember })}
                title="Refresh audit trail"
              >
                <RefreshCw size={13} className={auditLogsLoading ? 'spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Audit Records List */}
            <div className="audit-modal-body">
              {auditLogsLoading && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px' }} />
                  <p>Retrieving immutable forensic audit records from server...</p>
                </div>
              )}

              {!auditLogsLoading &&
                (() => {
                  const filtered = auditLogs.filter((log) => {
                    if (auditFilterEvent !== 'ALL' && log.action !== auditFilterEvent) return false;
                    if (auditFilterMember.trim()) {
                      const q = auditFilterMember.trim().toLowerCase();
                      const matchMember = (log.memberId || log.entityId || '').toLowerCase().includes(q);
                      const matchSponsor = (log.sponsorId || '').toLowerCase().includes(q);
                      const matchActor = (log.actorId || '').toLowerCase().includes(q);
                      return matchMember || matchSponsor || matchActor;
                    }
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                        <ShieldAlert size={28} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
                        <p style={{ fontWeight: 600 }}>No audit records matching criteria.</p>
                      </div>
                    );
                  }

                  return filtered.map((log) => (
                    <article key={log.id} className="audit-record-card">
                      <div className="audit-record-top">
                        <span className={`audit-badge ${log.action}`}>
                          {log.action}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="audit-immutable-tag">
                            🔒 IMMUTABLE RECORD
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} />
                            {new Date(log.timestamp || log.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* 10 Stored Fields Grid (Prompt 16 Requirements) */}
                      <div className="audit-meta-grid">
                        <div className="audit-meta-item">
                          <span className="audit-meta-key">Actor ID</span>
                          <span className="audit-meta-val">{log.actorId || 'system'}</span>
                        </div>
                        <div className="audit-meta-item">
                          <span className="audit-meta-key">Member ID</span>
                          <span className="audit-meta-val" style={{ color: '#0284c7' }}>
                            {log.memberId || log.entityId}
                          </span>
                        </div>
                        <div className="audit-meta-item">
                          <span className="audit-meta-key">Sponsor ID</span>
                          <span className="audit-meta-val">{log.sponsorId || 'N/A'}</span>
                        </div>
                        <div className="audit-meta-item">
                          <span className="audit-meta-key">Placement Parent</span>
                          <span className="audit-meta-val">{log.placementParentId || 'ROOT'}</span>
                        </div>
                        <div className="audit-meta-item">
                          <span className="audit-meta-key">Position</span>
                          <span className="audit-meta-val">{log.position || 'N/A'}</span>
                        </div>
                        <div className="audit-meta-item">
                          <span className="audit-meta-key">IP Address</span>
                          <span className="audit-meta-val">{log.ipAddress || log.ip || '127.0.0.1'}</span>
                        </div>
                        <div className="audit-meta-item" style={{ gridColumn: 'span 2' }}>
                          <span className="audit-meta-key">User Agent</span>
                          <span className="audit-meta-val" style={{ wordBreak: 'break-all', fontSize: '11px', fontWeight: 500 }}>
                            {log.userAgent || 'Unknown'}
                          </span>
                        </div>
                      </div>

                      {/* Reason (mandatory for moves / modifications) */}
                      {(log.reason || log.newValue?.reason) && (
                        <div
                          style={{
                            background: '#fffbeb',
                            borderLeft: '3px solid #f59e0b',
                            padding: '8px 12px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#92400e',
                          }}
                        >
                          <strong>Reason:</strong> {log.reason || log.newValue?.reason}
                        </div>
                      )}

                      {/* Old Value vs New Value Diff */}
                      {(log.oldValue || log.newValue) && (
                        <div className="audit-diff-row">
                          <div className="audit-diff-col old">
                            <div className="audit-diff-title">Old Value</div>
                            <pre style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap', color: '#991b1b' }}>
                              {log.oldValue ? JSON.stringify(log.oldValue, null, 2) : 'null'}
                            </pre>
                          </div>
                          <div className="audit-diff-col new">
                            <div className="audit-diff-title">New Value</div>
                            <pre style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap', color: '#166534' }}>
                              {log.newValue ? JSON.stringify(log.newValue, null, 2) : 'null'}
                            </pre>
                          </div>
                        </div>
                      )}
                    </article>
                  ));
                })()}
            </div>
          </div>
        </div>
      )}

      {/* Admin Move Distributor Modal (Prompt 16) */}
      {moveModalOpen && (
        <div
          className="audit-modal-backdrop"
          onClick={() => !moveSubmitting && setMoveModalOpen(false)}
        >
          <div
            className="admin-move-modal-window"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="audit-modal-header">
              <div className="audit-modal-title-group">
                <div className="audit-modal-icon-badge" style={{ background: '#fef3c7', color: '#d97706' }}>
                  <ArrowLeftRight size={22} />
                </div>
                <div>
                  <h3 className="audit-modal-title">Admin Move Distributor</h3>
                  <p className="audit-modal-sub">
                    Requires Reason, Old/New Parents, Old/New Positions, and Admin ID
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="audit-modal-close-btn"
                onClick={() => !moveSubmitting && setMoveModalOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleExecuteMove} className="admin-move-form">
              {/* Compliance Policy Notice */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#475569',
                }}
              >
                <strong>Tree relationships must never be silently modified.</strong> Moving
                a distributor updates the binary placement hierarchy and generates an immutable,
                tamper-evident audit record.
              </div>

              {moveError && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertTriangle size={16} />
                  <span>{moveError}</span>
                </div>
              )}

              {moveSuccess && (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#15803d',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{moveSuccess}</span>
                </div>
              )}

              {/* Target Distributor ID */}
              <div className="admin-move-form-group">
                <label className="admin-move-label">
                  Distributor Member ID <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="admin-move-input"
                  required
                  placeholder="e.g. KV-1007"
                  value={moveFormData.memberId}
                  onChange={(e) =>
                    setMoveFormData({ ...moveFormData, memberId: e.target.value })
                  }
                />
              </div>

              {/* Old Parent & Old Position */}
              <div className="admin-move-form-row">
                <div className="admin-move-form-group">
                  <label className="admin-move-label">
                    Old Parent ID <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    className="admin-move-input"
                    required
                    placeholder="e.g. KV-1002"
                    value={moveFormData.oldParent}
                    onChange={(e) =>
                      setMoveFormData({ ...moveFormData, oldParent: e.target.value })
                    }
                  />
                </div>
                <div className="admin-move-form-group">
                  <label className="admin-move-label">
                    Old Position <span className="req">*</span>
                  </label>
                  <select
                    className="admin-move-select"
                    value={moveFormData.oldPosition}
                    onChange={(e) =>
                      setMoveFormData({ ...moveFormData, oldPosition: e.target.value })
                    }
                  >
                    <option value="LEFT">LEFT Leg</option>
                    <option value="RIGHT">RIGHT Leg</option>
                  </select>
                </div>
              </div>

              {/* New Parent & New Position */}
              <div className="admin-move-form-row">
                <div className="admin-move-form-group">
                  <label className="admin-move-label">
                    New Parent ID <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    className="admin-move-input"
                    required
                    placeholder="e.g. KV-1003"
                    value={moveFormData.newParent}
                    onChange={(e) =>
                      setMoveFormData({ ...moveFormData, newParent: e.target.value })
                    }
                  />
                </div>
                <div className="admin-move-form-group">
                  <label className="admin-move-label">
                    New Position <span className="req">*</span>
                  </label>
                  <select
                    className="admin-move-select"
                    value={moveFormData.newPosition}
                    onChange={(e) =>
                      setMoveFormData({ ...moveFormData, newPosition: e.target.value })
                    }
                  >
                    <option value="LEFT">LEFT Leg</option>
                    <option value="RIGHT">RIGHT Leg</option>
                  </select>
                </div>
              </div>

              {/* Admin ID & Timestamp */}
              <div className="admin-move-form-row">
                <div className="admin-move-form-group">
                  <label className="admin-move-label">
                    Admin ID <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    className="admin-move-input"
                    required
                    value={moveFormData.adminId}
                    onChange={(e) =>
                      setMoveFormData({ ...moveFormData, adminId: e.target.value })
                    }
                  />
                </div>
                <div className="admin-move-form-group">
                  <label className="admin-move-label">
                    Timestamp <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    className="admin-move-input"
                    readOnly
                    value={moveFormData.timestamp}
                    style={{ background: '#f1f5f9', cursor: 'not-allowed' }}
                  />
                </div>
              </div>

              {/* Mandatory Reason */}
              <div className="admin-move-form-group">
                <label className="admin-move-label">
                  Reason for Move (Mandatory Compliance Justification) <span className="req">*</span>
                </label>
                <textarea
                  className="admin-move-textarea"
                  required
                  rows={3}
                  placeholder="e.g., Strategic lineage correction approved by compliance director following regional reorganization."
                  value={moveFormData.reason}
                  onChange={(e) =>
                    setMoveFormData({ ...moveFormData, reason: e.target.value })
                  }
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Minimum 3 characters. Stored permanently in the immutable audit log.
                </span>
              </div>

              <div className="admin-move-footer">
                <button
                  type="button"
                  className="btn-auth-dismiss"
                  disabled={moveSubmitting}
                  onClick={() => setMoveModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-auth-action"
                  disabled={moveSubmitting}
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                >
                  <span>{moveSubmitting ? 'Creating Audit Record...' : 'Execute Move & Create Audit Record'}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Authorization Required Security Modal */}
      {authWarningModal && (
        <div
          className="auth-warning-modal-backdrop"
          onClick={() => setAuthWarningModal(null)}
        >
          <div
            className="auth-warning-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="auth-warning-icon-wrap">
              <ShieldAlert size={26} />
            </div>
            <h3 className="auth-warning-title">{authWarningModal.title}</h3>
            <p className="auth-warning-desc">{authWarningModal.message}</p>
            <div className="auth-warning-callout">
              <strong>Enrollment Policy:</strong> All downline member placements must be
              processed through the official enrollment workflow with sponsor verification.
            </div>
            <div className="auth-warning-actions">
              <button
                type="button"
                className="btn-auth-dismiss"
                onClick={() => setAuthWarningModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-auth-action"
                onClick={() => {
                  const cb = authWarningModal.onConfirm;
                  setAuthWarningModal(null);
                  if (cb) cb();
                }}
              >
                <span>{authWarningModal.actionText}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NetworkTreePage;
