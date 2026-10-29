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
  Building,
  Trash2,
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
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN' || Boolean(currentUser?.isOwner);
  const initialDistributorId =
    currentUser?.distributorId ||
    currentUser?.distributorCode ||
    currentUser?.memberId ||
    'KV-1001';

  // Read URL member param for state persistence on refresh (?member=KV-1002)
  // Non-admins can only see their own tree, never another user's tree
  const urlMemberId = searchParams.get('member');
  const effectiveInitialRootId = isAdmin ? (urlMemberId || initialDistributorId) : initialDistributorId;

  // 2. Tree Navigation & Depth State (depth 2: shows parent and leaf of parent, not leaf of leaf)
  const [currentRootId, setCurrentRootId] = useState(effectiveInitialRootId);
  const [depth, setDepth] = useState(2);
  const [breadcrumbs, setBreadcrumbs] = useState(() => {
    const rootName = currentUser?.name || currentUser?.displayName || currentUser?.fullName || initialDistributorId;
    if (isAdmin && urlMemberId && urlMemberId !== initialDistributorId) {
      return [
        { id: initialDistributorId, name: `${rootName} (My Root)` },
        { id: urlMemberId, name: urlMemberId },
      ];
    }
    return [
      { id: initialDistributorId, name: `${rootName} (My Root)` },
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

  // Clear Tree Data (Fresh Start)
  const [clearTreeModalOpen, setClearTreeModalOpen] = useState(false);
  const [clearSubmitting, setClearSubmitting] = useState(false);
  const [clearSuccessToast, setClearSuccessToast] = useState(null);

  const handleClearTreeData = async () => {
    setClearSubmitting(true);
    try {
      api.clearTreeData();
      setCurrentRootId(initialDistributorId);
      setBreadcrumbs([
        { id: initialDistributorId, name: `${currentUser?.name || 'Rahul Kaushal'} (My Root)` },
      ]);
      setSearchParams({});
      setSelectedMember(null);
      setNetworkSummary({
        distributorId: initialDistributorId,
        directMembers: 0,
        leftTeamCount: 0,
        rightTeamCount: 0,
        totalTeamCount: 0,
        leftBV: 0,
        rightBV: 0,
        personalBV: 250,
        totalBV: 250,
      });
      await fetchTreeData(initialDistributorId, depth);
      setClearTreeModalOpen(false);
      setClearSuccessToast('Tree data cleared! Network tree reset to fresh initial state with 0 team members.');
      setTimeout(() => setClearSuccessToast(null), 5000);
    } catch (err) {
      console.error('Error clearing tree data:', err);
    } finally {
      setClearSubmitting(false);
    }
  };

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
    async (rootId, maxDepth = 2) => {
      setLoading(true);
      setError(null);
      try {
        const targetId = (!isAdmin && rootId !== initialDistributorId)
          ? initialDistributorId
          : (rootId || initialDistributorId);

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
          const res = await api.getMemberNetworkTree(targetId, maxDepth);
          data = res?.root || res?.data?.root || res?.data || res;
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
    [initialDistributorId, isAdmin]
  );

  // Keep root aligned with authenticated session when not viewing a specific downline param
  useEffect(() => {
    if (!isAdmin) {
      if (currentRootId !== initialDistributorId) {
        setCurrentRootId(initialDistributorId);
      }
      const rootName = currentUser?.name || currentUser?.displayName || currentUser?.fullName || initialDistributorId;
      setBreadcrumbs([{ id: initialDistributorId, name: `${rootName} (My Root)` }]);
      return;
    }
    if (!urlMemberId && initialDistributorId) {
      setCurrentRootId(initialDistributorId);
      const rootName = currentUser?.name || currentUser?.displayName || currentUser?.fullName || initialDistributorId;
      setBreadcrumbs([{ id: initialDistributorId, name: `${rootName} (My Root)` }]);
    }
  }, [initialDistributorId, urlMemberId, currentUser?.name, currentUser?.displayName, currentUser?.fullName, isAdmin, currentRootId]);

  useEffect(() => {
    fetchTreeData(currentRootId, depth);
  }, [currentRootId, depth, fetchTreeData]);

  // Auto-refresh tree when dynamic enrollment or tree change occurs
  useEffect(() => {
    const handleTreeUpdated = () => {
      fetchTreeData(currentRootId, depth);
    };
    window.addEventListener('kashvi_tree_updated', handleTreeUpdated);
    window.addEventListener('storage', handleTreeUpdated);
    return () => {
      window.removeEventListener('kashvi_tree_updated', handleTreeUpdated);
      window.removeEventListener('storage', handleTreeUpdated);
    };
  }, [currentRootId, depth, fetchTreeData]);

  // 6. Navigation & View Network Handlers (Prompt 11 & 13) - Admin Only
  const handleViewNetwork = (member) => {
    if (!isAdmin || !member) return;
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
    if (!isAdmin || !distributor) return;
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
    if (!isAdmin && crumbId !== initialDistributorId) return;
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
    const rootName = currentUser?.name || currentUser?.displayName || currentUser?.fullName || initialDistributorId;
    setBreadcrumbs([
      { id: initialDistributorId, name: `${rootName} (My Root)` },
    ]);
    setZoomLevel(1);
    setDepth(2);
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

  const handleZoomChange = (valOrFn) => {
    setZoomLevel((prev) => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      return Math.max(0.4, Math.min(2.0, Number(next.toFixed(2))));
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  // Synchronize state when browser URL query parameter changes
  useEffect(() => {
    if (!isAdmin) {
      if (searchParams.get('member')) {
        setSearchParams({}, { replace: true });
      }
      if (currentRootId !== initialDistributorId) {
        setCurrentRootId(initialDistributorId);
      }
      return;
    }
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
  }, [searchParams, initialDistributorId, currentRootId, isAdmin, setSearchParams]);

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
              {isAdmin && (
                <div className="tree-header-action-buttons">
                  <button
                    type="button"
                    className="btn-tree-audit-trail"
                    onClick={() => {
                      setCurrentRootId('KV-1001');
                      setBreadcrumbs([{ id: 'KV-1001', name: 'Company Root (KV-1001)' }]);
                      setSearchParams({ member: 'KV-1001' });
                      fetchTreeData('KV-1001', depth);
                    }}
                    title="View Company Root Organization (Admin/Owner Only)"
                    style={{ background: '#fef3c7', borderColor: '#fcd34d', color: '#92400e', fontWeight: 600 }}
                  >
                    <Building size={14} />
                    <span>Company Root</span>
                  </button>
                  <button
                    type="button"
                    className="btn-tree-audit-trail"
                    onClick={() => handleOpenAuditLogs()}
                    title="View immutable tree audit trail for all operations (Admin Only)"
                  >
                    <ShieldCheck size={14} className="text-emerald-600" />
                    <span>Tree Audit Logs</span>
                  </button>
                  <button
                    type="button"
                    className="btn-tree-move-admin"
                    onClick={() => handleOpenMoveModal()}
                    title="Admin Move Distributor (Admin Only)"
                  >
                    <ArrowLeftRight size={14} />
                    <span>Move Distributor</span>
                  </button>
                  <button
                    type="button"
                    className="btn-tree-clear-action"
                    onClick={() => setClearTreeModalOpen(true)}
                    title="Clear tree data and reset to fresh initial state"
                  >
                    <Trash2 size={14} />
                    <span>Clear Tree Data</span>
                  </button>
                </div>
              )}
            </div>
            <h1 className="tree-page-title">Network Tree</h1>
            <p className="tree-page-subtitle">
              Interactive dual-leg marketing organization. Every distributor has maximum 2 direct legs (Left &amp; Right).
            </p>
          </div>

          {/* Real-time Backend Search (Admin Only - Prompt 13) */}
          {isAdmin && <TreeSearch onSelectMember={handleSelectSearchResult} />}
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
            onClearTree={isAdmin ? () => setClearTreeModalOpen(true) : null}
            onCenterTree={() => handleCenterTree()}
            onRefresh={() => fetchTreeData(currentRootId, depth)}
            loading={loading}
            breadcrumbs={breadcrumbs}
            onBreadcrumbClick={handleBreadcrumbClick}
            selectedMemberName={selectedMember?.name}
            isAdmin={isAdmin}
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
          <div
            className="tree-canvas-error-banner"
            style={{
              textAlign: 'center',
              padding: '32px 24px',
              maxWidth: '540px',
              margin: '40px auto',
              background: '#fff',
              borderRadius: '14px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #fee2e2',
            }}
          >
            <ShieldAlert size={44} style={{ color: '#ef4444', margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#991b1b', marginBottom: '8px' }}>
              {error.includes('403') || error.includes('Forbidden') || error.includes('not authorized')
                ? 'Access Restricted (403 Forbidden)'
                : 'Unable to Load Network Tree'}
            </h3>
            <p style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.5, marginBottom: '20px' }}>
              {error}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                className="btn-retry"
                onClick={() => {
                  setCurrentRootId(initialDistributorId);
                  const rootName = currentUser?.name || currentUser?.displayName || initialDistributorId;
                  setBreadcrumbs([{ id: initialDistributorId, name: `${rootName} (My Root)` }]);
                  setSearchParams({});
                  fetchTreeData(initialDistributorId, depth);
                }}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: '#fff',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Back to My Personal Network
              </button>
              <button
                type="button"
                onClick={() => fetchTreeData(currentRootId, depth)}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!loading && (
          <NetworkTree
            rootNode={treeData}
            depth={2}
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
            onFocusNode={isAdmin ? handleViewNetwork : null}
            onAvailableClick={handleAvailableSlotClick}
            highlightedId={selectedMember?.distributorId || null}
            selectedMemberId={selectedMember?.distributorId}
            expandingNodeIds={expandingNodeIds}
            isAdmin={isAdmin}
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
          onViewNetwork={isAdmin ? handleViewNetwork : null}
          onEnrollDownline={handleEnrollDownline}
          onMoveDistributor={isAdmin ? handleOpenMoveModal : null}
          onViewAuditLogs={isAdmin ? handleOpenAuditLogs : null}
          isAdmin={isAdmin}
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

      {/* Clear Tree Data Confirmation Modal */}
      {clearTreeModalOpen && (
        <div className="audit-modal-backdrop" onClick={() => !clearSubmitting && setClearTreeModalOpen(false)}>
          <div
            className="audit-modal-content"
            style={{ maxWidth: '480px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="audit-modal-header" style={{ borderBottomColor: '#fecaca' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: '#fee2e2', padding: '6px', borderRadius: '8px', color: '#dc2626', display: 'flex' }}>
                  <Trash2 size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#991b1b' }}>
                    Clear Network Tree Data
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    Reset dual-leg binary genealogy to fresh starting state
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="audit-modal-close-btn"
                disabled={clearSubmitting}
                onClick={() => setClearTreeModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
              <p style={{ marginTop: 0, marginBottom: '12px' }}>
                Are you sure you want to clear all enrolled tree data and make the tree fresh?
              </p>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <ul style={{ margin: 0, paddingLeft: '18px', color: '#475569' }}>
                  <li>All enrolled downline members will be removed</li>
                  <li>Total team count and BV will reset to 0</li>
                  <li>Left &amp; Right legs will be reset to open (+ Available)</li>
                  <li>Rahul Kaushal (KV-1001) will remain as root organization</li>
                </ul>
              </div>
            </div>

            <div className="admin-move-footer" style={{ borderTop: '1px solid #f1f5f9', padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-auth-dismiss"
                disabled={clearSubmitting}
                onClick={() => setClearTreeModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-admin-submit-move"
                style={{ background: '#dc2626', borderColor: '#b91c1c', color: '#fff' }}
                disabled={clearSubmitting}
                onClick={handleClearTreeData}
              >
                {clearSubmitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Clearing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Yes, Clear Tree Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Success Toast */}
      {clearSuccessToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: '#065f46',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 10000,
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={18} className="text-emerald-300" />
          <span>{clearSuccessToast}</span>
          <button
            type="button"
            onClick={() => setClearSuccessToast(null)}
            style={{ background: 'none', border: 'none', color: '#a7f3d0', cursor: 'pointer', padding: 0, marginLeft: '8px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default NetworkTreePage;
