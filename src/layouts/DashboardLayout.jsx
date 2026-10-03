import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  LayoutDashboard,
  Network,
  TrendingUp,
  Award,
  User,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Sparkles,
  Users,
  ScrollText,
  Sliders,
} from 'lucide-react';
import './DashboardLayout.css';

export function DashboardLayout({ children }) {
  const { currentUser, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Binary Network', path: '/network', icon: Network },
    { label: 'Business Volume', path: '/business-volume', icon: TrendingUp },
    { label: 'Commissions', path: '/commissions', icon: Award },
    { label: 'My Profile', path: '/profile', icon: User },
  ];

  if (isAdmin) {
    navItems.push(
      {
        label: 'Admin Console',
        path: '/admin/dashboard',
        icon: ShieldCheck,
        adminOnly: true,
      },
      {
        label: 'Distributor Directory',
        path: '/admin/distributors',
        icon: Users,
        adminOnly: true,
      },
      {
        label: 'Global Network Tree',
        path: '/admin/network',
        icon: Network,
        adminOnly: true,
      },
      {
        label: 'BV Management',
        path: '/admin/business-volume',
        icon: TrendingUp,
        adminOnly: true,
      },
      {
        label: 'Commission Ledger',
        path: '/admin/commissions',
        icon: Award,
        adminOnly: true,
      },
      {
        label: 'Audit Trail',
        path: '/admin/audit-logs',
        icon: ScrollText,
        adminOnly: true,
      },
      {
        label: 'System Settings',
        path: '/admin/settings',
        icon: Sliders,
        adminOnly: true,
      }
    );
  }

  const closeMobile = () => setMobileMenuOpen(false);

  const displayName = currentUser?.name || currentUser?.displayName || 'Distributor';
  const displayId = currentUser?.memberId || currentUser?.distributorId || 'KV-1001';
  const displayRank = isAdmin ? 'System Owner & Admin' : (currentUser?.rank || currentUser?.role || 'Executive');

  return (
    <div className="portal-container">
      {/* 1. Top Header Bar */}
      <header className="portal-topbar">
        <div className="topbar-left">
          <button
            className="mobile-hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="portal-brand" onClick={() => navigate('/dashboard')}>
            <div className="brand-badge">KV</div>
            <span className="brand-text">
              KASHVI<span className="brand-accent">MLM</span>
            </span>
          </div>
        </div>

        <div className="topbar-right">
          {isAdmin && (
            <button
              className="admin-switch-top-btn"
              onClick={() => navigate('/admin/dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                color: '#60a5fa',
                border: '1px solid #3b82f6',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
              }}
              title="Open Executive Admin Console"
            >
              <ShieldCheck size={16} />
              <span>Admin Console</span>
            </button>
          )}

          <div className="user-status-pill">
            <span className="live-dot" />
            <span className="status-label">{isAdmin ? 'OWNER / ACTIVE' : (currentUser?.status || 'ACTIVE')}</span>
          </div>

          <div className="user-profile-widget" onClick={() => navigate('/profile')}>
            <div className="user-avatar-circle">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="user-meta-column">
              <span className="user-name-text">{displayName}</span>
              <span className="user-id-text">{displayId}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="portal-body">
        {/* 2. Navigation Sidebar */}
        <aside className={`portal-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-inner">
            <div className="sidebar-group-label">Genealogy & Operations</div>

            <nav className="sidebar-nav">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                const isActive =
                  location.pathname === item.path ||
                  (item.path === '/network' && location.pathname === '/network-tree');

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`sidebar-nav-link ${isActive ? 'active' : ''} ${
                      item.adminOnly ? 'admin-nav-item' : ''
                    }`}
                    onClick={closeMobile}
                  >
                    <IconComponent size={19} className="nav-icon" />
                    <span className="nav-label">{item.label}</span>
                    {item.adminOnly && <span className="admin-chip">ADMIN</span>}
                    <ChevronRight size={14} className="nav-arrow" />
                  </NavLink>
                );
              })}
            </nav>

            <div className="sidebar-footer">
              <div className="quick-distributor-card">
                <div className="card-top-row">
                  <span className="rank-tag">{displayRank}</span>
                  <Sparkles size={14} className="rank-star" />
                </div>
                <div className="card-id-row">ID: {displayId}</div>
              </div>

              <button className="sidebar-logout-btn" onClick={handleLogout}>
                <LogOut size={17} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile backdrop */}
        {mobileMenuOpen && <div className="sidebar-backdrop" onClick={closeMobile} />}

        {/* 3. Main Content Canvas */}
        <main className="portal-content">{children}</main>
      </div>
    </div>
  );
}

export default DashboardLayout;
