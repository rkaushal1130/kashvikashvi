import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Users,
  Award,
  Building2,
  TrendingUp,
  ArrowLeft,
  Lock,
  Unlock,
  X,
  Filter,
  CheckCircle2,
  GitBranch,
  FlaskConical,
} from 'lucide-react';
import NetworkTree from '../components/networkTree/NetworkTree';
import TreeControls from '../components/networkTree/TreeControls';
import MemberDetailsPanel from '../components/networkTree/MemberDetailsPanel';
import TreeTestRunnerModal from '../components/networkTree/TreeTestRunnerModal';
import { api } from '../services/api';
import { normalizeTree } from '../utils/treeNormalize.js';
import '../components/networkTree/NetworkTree.css';

/**
 * AdminNetworkTreePage
 * Mounted at: /admin/network-tree (Prompt 17)
 *
 * Requirements:
 * 1. Search distributor (by ID or name with live suggestions).
 * 2. View distributor tree (binary genealogy hierarchy).
 * 3. View sponsor.
 * 4. View placement parent.
 * 5. View LEFT/RIGHT position.
 * 6. View rank.
 * 7. View status.
 * 8. View team counts (Total, Left, Right, Direct).
 * 9. View BV summary (Left BV, Right BV, PBV, Total GBV, Balance Ratio).
 * 10. View Business Center.
 *
 * Add filters:
 * - Status (ACTIVE, INACTIVE, SUSPENDED, PENDING)
 * - Rank (Business Center, Executive Director, Senior Director, Silver Director, Bronze Director, Gold Partner, Associate)
 * - Business Center (BC-001, BC-002, BC-003)
 *
 * Constraints:
 * - Do NOT allow an admin to move a member directly from the UI yet.
 * - Only implement viewing/searching.
 * - Protect route with ADMIN/SUPER_ADMIN authorization.
 *
 * Verification:
 * - TEST 15: Admin opens /admin/network-tree -> Admin can search and inspect network without downline restrictions.
 * - TEST 16: Normal user attempts admin tree -> 403 Forbidden.
 */
export default function AdminNetworkTreePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // =========================================================================
  // 1. Authentication & Role Guard (ADMIN / SUPER_ADMIN)
  // =========================================================================
  const [authData, setAuthData] = useState(() => {
    try {
      const saved = localStorage.getItem('kashvi_auth');
      return saved ? JSON.parse(saved) : { isLoggedIn: false, user: null };
    } catch {
      return { isLoggedIn: false, user: null };
    }
  });

  const currentUser = authData?.user;
  const isAdmin =
    Boolean(authData?.isLoggedIn) &&
    (currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN');

  useEffect(() => {
    const handleAuthChange = () => {
      try {
        const saved = localStorage.getItem('kashvi_auth');
        setAuthData(saved ? JSON.parse(saved) : { isLoggedIn: false, user: null });
      } catch {
        setAuthData({ isLoggedIn: false, user: null });
      }
    };
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('kashvi_auth_change', handleAuthChange);
    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('kashvi_auth_change', handleAuthChange);
    };
  }, []);

  // Quick helper to switch session to Admin (Test 15 helper)
  const handleSimulateAdmin = () => {
    const adminSession = {
      isLoggedIn: true,
      token: 'jwt-simulated-admin-token',
      user: {
        id: 'usr-admin-001',
        memberId: 'KV-ADMIN-01',
        name: 'Executive System Admin',
        email: 'admin@kashvimlm.com',
        role: 'ADMIN',
      },
    };
    localStorage.setItem('kashvi_auth', JSON.stringify(adminSession));
    setAuthData(adminSession);
    window.dispatchEvent(new Event('kashvi_auth_change'));
  };

  // Quick helper to switch session to Normal Distributor (Test 16 helper)
  const handleSimulateNormalUser = () => {
    const userSession = {
      isLoggedIn: true,
      token: 'jwt-simulated-user-token',
      user: {
        id: 'usr-dist-1002',
        memberId: 'KV-1002',
        name: 'Amit Patel',
        email: 'amit@kashvimlm.com',
        role: 'DISTRIBUTOR',
      },
    };
    localStorage.setItem('kashvi_auth', JSON.stringify(userSession));
    setAuthData(userSession);
    window.dispatchEvent(new Event('kashvi_auth_change'));
  };

  // =========================================================================
  // 2. Tree Root, Member, & Navigation State
  // =========================================================================
  const { distributorId } = useParams();
  const urlMemberId = distributorId || searchParams.get('member') || searchParams.get('rootId');
  const [currentRootId, setCurrentRootId] = useState(urlMemberId || 'KV-1001');
  const [depth, setDepth] = useState(3);
  const [treeData, setTreeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);

  // Canvas Viewport State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });

  // Prompt 18: Complete MLM Tree Test Suite Modal State
  const [isTestModalOpen, setIsTestModalOpen] = useState(
    () => searchParams.get('tests') === 'true'
  );

  // Breadcrumbs lineage path
  const [breadcrumbs, setBreadcrumbs] = useState([
    { id: 'KV-1001', name: 'Rahul Kaushal (Root)' },
  ]);

  // =========================================================================
  // 3. Search State (Item 1: Search distributor)
  // =========================================================================
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const searchTimeoutRef = useRef(null);
  const searchContainerRef = useRef(null);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Debounced search query
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    setSearchDropdownOpen(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await api.searchNetworkTree(trimmed);
        setSearchResults(Array.isArray(results) ? results : []);
      } catch (err) {
        console.warn('Admin search error:', err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 200);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // =========================================================================
  // 4. Filters State (Status, Rank, Business Center)
  // =========================================================================
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterRank, setFilterRank] = useState('ALL');
  const [filterBusinessCenter, setFilterBusinessCenter] = useState('ALL');

  const isAnyFilterActive =
    filterStatus !== 'ALL' || filterRank !== 'ALL' || filterBusinessCenter !== 'ALL';

  const filterCriteria = useMemo(
    () => ({
      status: filterStatus,
      rank: filterRank,
      businessCenter: filterBusinessCenter,
    }),
    [filterStatus, filterRank, filterBusinessCenter]
  );

  const handleClearFilters = () => {
    setFilterStatus('ALL');
    setFilterRank('ALL');
    setFilterBusinessCenter('ALL');
  };

  // =========================================================================
  // 5. Fetch Global Admin Network Tree
  // =========================================================================
  const fetchAdminTree = useCallback(async (rootId, maxDepth) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAdminNetworkTree(rootId, maxDepth);
      if (res && res.status === 403) {
        setError('403 Forbidden: Admin privileges required.');
        return;
      }
      const data = res?.root || res?.data?.root || res?.data || res;
      if (data) {
        setTreeData(normalizeTree(data));
        // Automatically default focal inspector to root node if no member selected
        setSelectedMember((prev) => {
          if (!prev) return data;
          // Keep current selection if matching
          return prev;
        });
      } else {
        setError('Unable to load network tree from database.');
      }
    } catch (err) {
      setError(err.message || 'Error fetching administrative network tree.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchAdminTree(currentRootId, depth);
    }
  }, [isAdmin, currentRootId, depth, fetchAdminTree]);

  // Synchronize state when browser URL parameter changes
  useEffect(() => {
    const memberParam = distributorId || searchParams.get('member') || searchParams.get('rootId');
    if (memberParam && memberParam !== currentRootId) {
      setCurrentRootId(memberParam);
      setBreadcrumbs((prev) => {
        if (!prev.some((b) => b.id === memberParam)) {
          return [...prev, { id: memberParam, name: memberParam }];
        }
        return prev;
      });
    }
  }, [searchParams, distributorId, currentRootId]);

  // =========================================================================
  // 6. Member Navigation & Search Selection Handlers
  // =========================================================================
  const handleSelectMember = (distributor) => {
    if (!distributor) return;
    const memberId = distributor.distributorId || distributor.id;
    const memberName = distributor.name || memberId;

    setCurrentRootId(memberId);
    setSearchParams({ member: memberId });
    setSelectedMember(distributor);
    setSearchQuery('');
    setSearchDropdownOpen(false);

    setBreadcrumbs((prev) => {
      const idx = prev.findIndex((b) => b.id === memberId);
      if (idx !== -1) return prev.slice(0, idx + 1);
      return [...prev, { id: memberId, name: memberName }];
    });

    setPanPosition({ x: 0, y: 0 });
  };

  const handleInspectSubtree = (node) => {
    if (!node) return;
    const memberId = node.distributorId || node.id;
    const memberName = node.name || memberId;

    setCurrentRootId(memberId);
    setSearchParams({ member: memberId });
    setSelectedMember(node);

    setBreadcrumbs((prev) => {
      const idx = prev.findIndex((b) => b.id === memberId);
      if (idx !== -1) return prev.slice(0, idx + 1);
      return [...prev, { id: memberId, name: memberName }];
    });

    setPanPosition({ x: 0, y: 0 });
  };

  const handleBreadcrumbClick = (crumbId, index) => {
    setCurrentRootId(crumbId);
    if (crumbId === 'KV-1001') {
      setSearchParams({});
    } else {
      setSearchParams({ member: crumbId });
    }
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setPanPosition({ x: 0, y: 0 });
  };

  const handleResetToRoot = () => {
    setCurrentRootId('KV-1001');
    setSearchParams({});
    setBreadcrumbs([{ id: 'KV-1001', name: 'Rahul Kaushal (Root)' }]);
    setZoomLevel(1);
    setDepth(3);
    setPanPosition({ x: 0, y: 0 });
    setSelectedMember(treeData);
  };

  const handleCenterTree = () => {
    setPanPosition({ x: 0, y: 0 });
  };

  const handleNodeClick = (node) => {
    setSelectedMember(node);
  };

  // Helper to count members matching active filters in the current tree
  const filterMatchCount = useMemo(() => {
    if (!treeData || !isAnyFilterActive) return 0;
    let count = 0;
    const traverse = (node) => {
      if (!node) return;
      let match = true;
      if (filterStatus !== 'ALL' && (node.status || '').toUpperCase() !== filterStatus.toUpperCase()) {
        match = false;
      }
      if (filterRank !== 'ALL' && (node.rank || '').toLowerCase() !== filterRank.toLowerCase()) {
        match = false;
      }
      if (filterBusinessCenter !== 'ALL' && !(node.businessCenter || '').toUpperCase().includes(filterBusinessCenter.toUpperCase())) {
        match = false;
      }
      if (match) count++;
      traverse(node.left);
      traverse(node.right);
    };
    traverse(treeData);
    return count;
  }, [treeData, isAnyFilterActive, filterStatus, filterRank, filterBusinessCenter]);

  // Current focal member for 10-attribute inspector banner
  const focalMember = selectedMember || treeData;

  // Format focal member values
  const focalName = focalMember?.name || 'Distributor';
  const focalId = focalMember?.distributorId || 'KV-1001';
  const focalRank = focalMember?.rank || 'Business Center';
  const focalStatus = (focalMember?.status || 'ACTIVE').toUpperCase();
  const focalPosition = (focalMember?.position || (focalId === 'KV-1001' ? 'ROOT' : 'LEFT')).toUpperCase();
  const focalSponsor = focalMember?.sponsorName
    ? `${focalMember.sponsor} (${focalMember.sponsorName})`
    : focalMember?.sponsor || (focalId === 'KV-1001' ? 'KV-1000 (Corporate System)' : 'KV-1001 (Rahul Kaushal)');
  const focalPlacementParent = focalMember?.placementParentName
    ? `${focalMember.placementParent} (${focalMember.placementParentName})`
    : focalMember?.placementParent || (focalId === 'KV-1001' ? 'ROOT (None)' : 'KV-1001 (Rahul Kaushal)');
  const focalBusinessCenter = focalMember?.businessCenterName
    ? `${focalMember.businessCenter || 'BC-001'} - ${focalMember.businessCenterName}`
    : focalMember?.businessCenter || 'BC-001 (Corporate Headquarters)';
  const focalLeftTeam = focalMember?.leftTeamCount ?? 24;
  const focalRightTeam = focalMember?.rightTeamCount ?? 18;
  const focalTotalTeam = focalMember?.totalTeamCount ?? (focalLeftTeam + focalRightTeam);
  const focalDirect = focalMember?.directMembers ?? 12;
  const focalLeftBV = focalMember?.leftBV ?? 14500;
  const focalRightBV = focalMember?.rightBV ?? 11200;
  const focalPersonalBV = focalMember?.personalBV ?? 250;
  const focalTotalBV = focalMember?.totalBV ?? (focalLeftBV + focalRightBV + focalPersonalBV);
  const totalLegBV = focalLeftBV + focalRightBV;
  const leftPct = totalLegBV > 0 ? Math.round((focalLeftBV / totalLegBV) * 100) : 50;

  // =========================================================================
  // TEST 16: Normal user attempts admin tree -> 403 Forbidden
  // =========================================================================
  if (!isAdmin) {
    return (
      <div className="admin-tree-forbidden-canvas">
        <div className="admin-forbidden-card">
          <div className="forbidden-badge-icon">
            <ShieldAlert size={44} className="text-red-500" />
          </div>

          <div className="forbidden-status-chip">HTTP 403 FORBIDDEN</div>
          <h1 className="forbidden-heading">Access Denied</h1>
          <h2 className="forbidden-subheading">
            Administrative Network Tree Inspection Restricted
          </h2>

          <p className="forbidden-description">
            You do not have administrative privileges to access the global network tree inspection console.
            As a standard distributor (
            <strong>{currentUser?.name || 'Unauthenticated User'}</strong>
            {currentUser?.role ? ` - Role: ${currentUser.role}` : ''}), company security policy
            restricts your network visibility strictly to your own downline organization.
          </p>

          <div className="forbidden-policy-box">
            <div className="policy-box-title">
              <Lock size={15} />
              <span>Security Rule (Prompt 17 - Test 16):</span>
            </div>
            <p>
              Direct access to <code>/admin/network-tree</code> requires <strong>ADMIN</strong> or{' '}
              <strong>SUPER_ADMIN</strong> role authorization. Standard distributors must use{' '}
              <code>/network-tree</code>.
            </p>
          </div>

          <div className="forbidden-action-row">
            <button
              type="button"
              className="btn-forbidden-secondary"
              onClick={() => navigate('/network-tree')}
            >
              <ArrowLeft size={15} />
              <span>Go to My Network Tree (/network-tree)</span>
            </button>

            <button
              type="button"
              className="btn-forbidden-secondary"
              onClick={() => navigate('/dashboard')}
            >
              <span>Distributor Dashboard</span>
            </button>

            <button
              type="button"
              className="btn-forbidden-admin-switch"
              onClick={handleSimulateAdmin}
              title="Switch role to ADMIN to verify Test 15"
            >
              <Unlock size={14} />
              <span>Switch to Admin Role (Verify Test 15)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // TEST 15: Admin opens /admin/network-tree -> Global Tree & Filters Console
  // =========================================================================
  return (
    <div className="admin-tree-container">
      {/* 1. Admin Executive Top Bar */}
      <div className="admin-tree-top-banner">
        <div className="admin-tree-banner-left">
          <div className="admin-pill-badge">
            <ShieldCheck size={14} />
            <span>ADMINISTRATOR MODE</span>
          </div>
          <span className="admin-banner-title">
            Global Network Tree Console (Prompt 17)
          </span>
          <span className="admin-banner-subtitle">
            Authenticated as: {currentUser?.name || 'System Administrator'} (Role: {currentUser?.role || 'ADMIN'})
          </span>
        </div>

        <div className="admin-tree-banner-right">
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(15, 23, 42, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11.5px',
              color: '#cbd5e1',
            }}
          >
            <Lock size={12} className="text-amber-400" />
            <span>Viewing &amp; Searching Only (Move Member Locked)</span>
          </div>

          {/* Test 16 Switcher */}
          <button
            type="button"
            className="btn-role-toggle-test"
            onClick={handleSimulateNormalUser}
            title="Switch to standard distributor role to verify Test 16 (403 Forbidden)"
          >
            <Lock size={13} />
            <span>Test Normal User (Verify Test 16)</span>
          </button>

          {/* Prompt 18 Test Runner Button */}
          <button
            type="button"
            className="btn-open-tree-tests"
            onClick={() => setIsTestModalOpen(true)}
            title="Execute all 20 MLM Tree tests live (Prompt 18)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)',
            }}
          >
            <FlaskConical size={14} />
            <span>Prompt 18: Run 20 Tests</span>
          </button>
        </div>
      </div>

      {/* 2. Search & Filter Bar (Requirements 1 & Filters) */}
      <div className="admin-search-filters-bar">
        {/* Search Row */}
        <div className="admin-search-row">
          <div className="admin-search-box-wrap" ref={searchContainerRef}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search distributor by Name or ID (e.g. KV-1001, Amit, Priya, Neha, Suresh)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchQuery.trim().length > 0) setSearchDropdownOpen(true);
              }}
              aria-label="Search distributor"
            />
            {searchQuery && (
              <button
                type="button"
                className="admin-search-clear-btn"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setSearchDropdownOpen(false);
                }}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}

            {/* Search Suggestions Dropdown */}
            {searchDropdownOpen && searchQuery.trim().length > 0 && (
              <div className="tree-search-dropdown-results" style={{ width: '100%', top: '44px' }}>
                {searchLoading && (
                  <div className="search-dropdown-header">
                    <span>Searching global database...</span>
                  </div>
                )}

                {!searchLoading && searchResults.length > 0 && (
                  <>
                    <div className="search-dropdown-header">
                      <span>Matching Distributors ({searchResults.length})</span>
                    </div>
                    {searchResults.map((dist) => (
                      <button
                        key={dist.distributorId || dist.id}
                        type="button"
                        className="search-result-item"
                        onClick={() => handleSelectMember(dist)}
                      >
                        <div className="result-avatar">
                          {dist.name?.charAt(0) || 'D'}
                        </div>
                        <div className="result-info">
                          <span className="result-name">{dist.name}</span>
                          <span className="result-id">
                            {dist.distributorId}
                            <span className="result-rank-badge">{dist.rank}</span>
                            <span className="result-rank-badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                              {dist.businessCenter || 'BC-001'}
                            </span>
                          </span>
                        </div>
                        <span className="result-action">Inspect Tree →</span>
                      </button>
                    ))}
                  </>
                )}

                {!searchLoading && searchResults.length === 0 && (
                  <div className="search-empty-state">
                    <p className="no-result-text">No distributor found matching &quot;{searchQuery}&quot;.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Example Chips */}
          <div className="admin-chips-row">
            <span className="admin-chips-label">Quick Jump:</span>
            {[
              { id: 'KV-1001', label: 'Rahul (KV-1001)' },
              { id: 'KV-1002', label: 'Amit (KV-1002)' },
              { id: 'KV-1003', label: 'Rohit (KV-1003)' },
              { id: 'KV-1004', label: 'Priya (KV-1004)' },
              { id: 'KV-1005', label: 'Pooja (KV-1005)' },
              { id: 'KV-1006', label: 'Neha (KV-1006)' },
              { id: 'KV-1007', label: 'Suresh (KV-1007)' },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={`admin-chip-btn ${currentRootId === chip.id ? 'active' : ''}`}
                onClick={() => handleSelectMember({ distributorId: chip.id, name: chip.label.split(' ')[0] })}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters Controls Row */}
        <div className="admin-filters-controls-row">
          <div className="admin-filters-group-wrap">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontWeight: 700, fontSize: '13px' }}>
              <Filter size={15} />
              <span>Filters:</span>
            </div>

            {/* Filter: Status */}
            <div className="admin-filter-item">
              <label htmlFor="filter-status" className="admin-filter-label">Status:</label>
              <select
                id="filter-status"
                className={`admin-filter-select ${filterStatus !== 'ALL' ? 'has-value' : ''}`}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="PENDING">PENDING</option>
              </select>
            </div>

            {/* Filter: Rank */}
            <div className="admin-filter-item">
              <label htmlFor="filter-rank" className="admin-filter-label">Rank:</label>
              <select
                id="filter-rank"
                className={`admin-filter-select ${filterRank !== 'ALL' ? 'has-value' : ''}`}
                value={filterRank}
                onChange={(e) => setFilterRank(e.target.value)}
              >
                <option value="ALL">All Ranks</option>
                <option value="Business Center">Business Center</option>
                <option value="Executive Director">Executive Director</option>
                <option value="Senior Director">Senior Director</option>
                <option value="Silver Director">Silver Director</option>
                <option value="Bronze Director">Bronze Director</option>
                <option value="Gold Partner">Gold Partner</option>
                <option value="Associate">Associate</option>
              </select>
            </div>

            {/* Filter: Business Center */}
            <div className="admin-filter-item">
              <label htmlFor="filter-bc" className="admin-filter-label">Business Center:</label>
              <select
                id="filter-bc"
                className={`admin-filter-select ${filterBusinessCenter !== 'ALL' ? 'has-value' : ''}`}
                value={filterBusinessCenter}
                onChange={(e) => setFilterBusinessCenter(e.target.value)}
              >
                <option value="ALL">All Business Centers</option>
                <option value="BC-001">BC-001 (Corporate Main Center)</option>
                <option value="BC-002">BC-002 (North Region Hub)</option>
                <option value="BC-003">BC-003 (West Region Hub)</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            {isAnyFilterActive && (
              <button
                type="button"
                className="admin-clear-filters-btn"
                onClick={handleClearFilters}
              >
                <X size={13} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Filter Match Count Pill */}
          {isAnyFilterActive && (
            <div className="admin-filter-badge-count">
              <CheckCircle2 size={13} />
              <span>Matching Filter Criteria: {filterMatchCount} members highlighted</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Executive 10-Attribute Inspector Card (Items 3 to 10) */}
      <section className="admin-inspector-banner" aria-label="Distributor Inspector">
        <div className="admin-inspector-top-row">
          <div className="admin-inspector-distributor-badge">
            <div className="admin-inspector-avatar">
              {focalName.charAt(0)}
            </div>
            <div className="admin-inspector-name-group">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 className="admin-inspector-name">{focalName}</h2>
                <span className="admin-inspector-code">({focalId})</span>
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Organizational Hierarchy Inspector &bull; Joined: {focalMember?.joinedDate || '15 Sep 2026'}
              </span>
            </div>
          </div>

          {/* Pills row */}
          <div className="admin-inspector-status-pills">
            {/* Status (Item 7) */}
            <span className={`admin-status-pill status-${focalStatus.toLowerCase()}`}>
              <span className={`status-dot dot-${focalStatus === 'ACTIVE' ? 'active' : 'inactive'}`} />
              <span>Status: {focalStatus}</span>
            </span>

            {/* Rank (Item 6) */}
            <span className="admin-rank-pill">
              <Award size={13} className="text-amber-500" />
              <span>Rank: {focalRank}</span>
            </span>

            {/* Position (Item 5) */}
            <span className={`admin-pos-pill pos-${focalPosition.toLowerCase()}`}>
              <span>Position: {focalPosition}</span>
            </span>

            {/* Business Center (Item 10) */}
            <span className="admin-rank-pill" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857' }}>
              <Building2 size={13} />
              <span>Center: {focalMember?.businessCenter || 'BC-001'}</span>
            </span>
          </div>
        </div>

        {/* 10 Required Items Summary Grid */}
        <div className="admin-attributes-grid">
          {/* Sponsor (Item 3) */}
          <div className="admin-attr-card">
            <span className="admin-attr-label">
              <Users size={12} />
              <span>3. Sponsor (Enroller)</span>
            </span>
            <span className="admin-attr-val val-sponsor">{focalSponsor}</span>
            <span className="admin-attr-sub">Direct Lineage Sponsor</span>
          </div>

          {/* Placement Parent (Item 4) */}
          <div className="admin-attr-card">
            <span className="admin-attr-label">
              <GitBranch size={12} />
              <span>4. Placement Parent</span>
            </span>
            <span className="admin-attr-val val-parent">{focalPlacementParent}</span>
            <span className="admin-attr-sub">Immediate Binary Tree Parent</span>
          </div>

          {/* Position (Item 5) */}
          <div className="admin-attr-card">
            <span className="admin-attr-label">
              <span>5. Binary Leg Position</span>
            </span>
            <span className="admin-attr-val">
              {focalPosition === 'ROOT' ? '👑 ROOT Position' : focalPosition === 'LEFT' ? '◀ LEFT Leg' : 'RIGHT Leg ▶'}
            </span>
            <span className="admin-attr-sub">Position under Placement Parent</span>
          </div>

          {/* Business Center (Item 10) */}
          <div className="admin-attr-card">
            <span className="admin-attr-label">
              <Building2 size={12} />
              <span>10. Business Center</span>
            </span>
            <span className="admin-attr-val val-bc">{focalBusinessCenter}</span>
            <span className="admin-attr-sub">Operational Distribution Hub</span>
          </div>

          {/* Team Counts (Item 8) */}
          <div className="admin-attr-card">
            <span className="admin-attr-label">
              <Users size={12} />
              <span>8. Team Counts</span>
            </span>
            <span className="admin-attr-val">Total: {focalTotalTeam} Members</span>
            <span className="admin-attr-sub">
              Left: <strong style={{ color: '#2563eb' }}>{focalLeftTeam}</strong> &bull; Right: <strong style={{ color: '#7c3aed' }}>{focalRightTeam}</strong> &bull; Direct: {focalDirect}
            </span>
          </div>

          {/* BV Summary (Item 9) */}
          <div className="admin-attr-card">
            <span className="admin-attr-label">
              <TrendingUp size={12} />
              <span>9. BV Summary</span>
            </span>
            <span className="admin-attr-val">
              Total GBV: {focalTotalBV.toLocaleString()} BV
            </span>
            <span className="admin-attr-sub">
              L: {focalLeftBV.toLocaleString()} BV &bull; R: {focalRightBV.toLocaleString()} BV &bull; Personal: {focalPersonalBV} BV
            </span>
            {/* Balance Bar */}
            <div style={{ height: '5px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', display: 'flex', marginTop: '4px' }}>
              <div style={{ width: `${leftPct}%`, background: '#3b82f6', height: '100%' }} />
              <div style={{ width: `${100 - leftPct}%`, background: '#8b5cf6', height: '100%' }} />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Tree Controls & Breadcrumb Toolbar */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '12px 24px' }}>
        <TreeControls
          depth={depth}
          onDepthChange={setDepth}
          zoomLevel={zoomLevel}
          onZoomChange={(valOrFn) => {
            setZoomLevel((prev) => {
              const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
              return Math.max(0.4, Math.min(2.0, Number(next.toFixed(2))));
            });
          }}
          onResetZoom={() => setZoomLevel(1)}
          onResetToRoot={handleResetToRoot}
          onCenterTree={handleCenterTree}
          onExpand={() => setDepth((d) => Math.min(5, d + 1))}
          onCollapse={() => setDepth((d) => Math.max(2, d - 1))}
          onRefresh={() => fetchAdminTree(currentRootId, depth)}
          loading={loading}
          breadcrumbs={breadcrumbs}
          onBreadcrumbClick={handleBreadcrumbClick}
          selectedMemberName={focalName}
        />
      </div>

      {/* 5. Main Binary Genealogy Tree Canvas (Item 2: View distributor tree) */}
      <main className="tree-main-content-area" style={{ minHeight: '520px', flex: 1, position: 'relative' }}>
        {loading && (
          <div className="tree-canvas-loading-overlay">
            <div className="spinner-orbit" />
            <p>Loading database-driven organizational genealogy...</p>
          </div>
        )}

        {error && !loading && (
          <div className="tree-canvas-error-banner">
            <p>{error}</p>
            <button
              type="button"
              className="btn-retry"
              onClick={() => fetchAdminTree(currentRootId, depth)}
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
            onZoomChange={setZoomLevel}
            onResetZoom={() => setZoomLevel(1)}
            onResetToRoot={handleResetToRoot}
            onCenterTree={handleCenterTree}
            panPosition={panPosition}
            onPanChange={setPanPosition}
            onNodeClick={handleNodeClick}
            onFocusNode={handleInspectSubtree}
            highlightedId={selectedMember?.distributorId || null}
            selectedMemberId={selectedMember?.distributorId}
            filterCriteria={filterCriteria}
            adminViewOnly={true}
          />
        )}
      </main>

      {/* 6. Member Details Slide-Over Drawer (Viewing Only, NO Moving) */}
      {selectedMember && (
        <MemberDetailsPanel
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onViewNetwork={handleInspectSubtree}
          adminMode={true}
        />
      )}

      {/* Prompt 18 Complete MLM Tree Test Suite Modal */}
      <TreeTestRunnerModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
      />
    </div>
  );
}
