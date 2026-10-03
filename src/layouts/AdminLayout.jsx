import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  LayoutDashboard,
  Users,
  Network,
  TrendingUp,
  Award,
  ScrollText,
  Sliders,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import './AdminLayout.css';

export function AdminLayout({ children }) {
  const { currentUser, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const navItems = [
    { label: 'Admin Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Distributor Directory', path: '/admin/distributors', icon: Users },
    { label: 'Network Tree', path: '/admin/network', icon: Network },
    { label: 'Business Volume', path: '/admin/business-volume', icon: TrendingUp },
    { label: 'Commissions & Ledger', path: '/admin/commissions', icon: Award },
    { label: 'Audit Trail', path: '/admin/audit-logs', icon: ScrollText },
    { label: 'System Settings', path: '/admin/settings', icon: Sliders },
  ];

  const closeMobile = () => setMobileMenuOpen(false);

  const displayName = currentUser?.name || currentUser?.displayName || 'Administrator';
  const displayId = currentUser?.memberId || currentUser?.distributorId || 'KV-1001';

  return (
    <div className="admin-portal-container">
      {/* 1. Top Header Bar */}
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <button
            className="admin-mobile-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Admin Menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="admin-brand" onClick={() => navigate('/admin/dashboard')}>
            <div className="admin-brand-badge">
              <ShieldCheck size={18} />
            </div>
            <div className="admin-brand-text">
              <span className="brand-title">
                KASHVI<span className="brand-accent">MLM</span>
              </span>
              <span className="admin-badge-pill">ADMIN CONSOLE</span>
            </div>
          </div>
        </div>

        <div className="admin-topbar-right">
          <button
            className="portal-switch-btn"
            onClick={() => navigate('/dashboard')}
            title="Switch to Distributor Dashboard View"
          >
            <ArrowLeft size={15} />
            <span>Distributor View</span>
          </button>

          <div className="admin-status-pill">
            <span className="admin-live-dot" />
            <span>SYSTEM ACTIVE</span>
          </div>

          <div className="admin-user-widget">
            <div className="admin-avatar-circle">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="admin-user-meta">
              <span className="admin-user-name">{displayName}</span>
              <span className="admin-user-role">SUPER ADMIN</span>
            </div>
          </div>
        </div>
      </header>

      <div className="admin-body">
        {/* 2. Admin Sidebar */}
        <aside className={`admin-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <div className="admin-sidebar-inner">
            <div className="admin-sidebar-label">Executive Management</div>

            <nav className="admin-sidebar-nav">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                const isActive =
                  location.pathname === item.path ||
                  (item.path === '/admin/dashboard' && location.pathname === '/admin') ||
                  (item.path === '/admin/network' &&
                    (location.pathname === '/admin/network-tree' ||
                      location.pathname.startsWith('/admin/network')));

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`admin-nav-link ${isActive ? 'active' : ''}`}
                    onClick={closeMobile}
                  >
                    <IconComponent size={18} className="admin-nav-icon" />
                    <span className="admin-nav-label">{item.label}</span>
                    <ChevronRight size={14} className="admin-nav-arrow" />
                  </NavLink>
                );
              })}
            </nav>

            <div className="admin-sidebar-footer">
              <div className="admin-security-note">
                <ShieldAlert size={14} className="security-icon" />
                <span>Audited Administrative Session</span>
              </div>

              <button className="admin-logout-btn" onClick={handleLogout}>
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div className="admin-sidebar-backdrop" onClick={closeMobile} />
        )}

        {/* 3. Main Content Canvas */}
        <main className="admin-main-canvas">{children}</main>
      </div>
    </div>
  );
}

export default AdminLayout;
