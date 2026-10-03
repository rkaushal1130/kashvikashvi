import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Menu, X, User } from 'lucide-react';
import logoImg from '../assets/logo.png';

/**
 * Responsive, premium Navbar for KASHVIMLM.
 * Features:
 * - Brand logo on the left
 * - Centered navigation links (Home, About Us, Shop, Categories, Contact)
 * - Profile logo button at the extreme right
 * - Mobile responsive drawer with active states
 */
function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const [prevPath, setPrevPath] = useState(location.pathname);
  const [authState, setAuthState] = useState({ isLoggedIn: false, name: '' });

  // Sync auth state with localStorage
  useEffect(() => {
    const checkAuth = () => {
      try {
        const saved = localStorage.getItem('kashvi_auth');
        if (saved) {
          const parsed = JSON.parse(saved);
          setAuthState({
            isLoggedIn: Boolean(parsed.isLoggedIn),
            name: parsed.user?.name || 'Member',
          });
          return;
        }
      } catch {
        // ignore
      }
      setAuthState({ isLoggedIn: false, name: '' });
    };

    checkAuth();
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, [location.pathname]);

  // Close mobile menu immediately on route change
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    setIsMobileMenuOpen(false);
  }

  // Close mobile menu on desktop breakpoint
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 860) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle ESC key to close mobile menu
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };
    if (isMobileMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'Join / Register', path: '/join' },
    { label: 'Contact', path: '/contact' },
  ];

  return (
    <header className="navbar">
      <div className="navbar-container">
        {/* Left: Brand Logo */}
        <div className="navbar-left">
          <Link to="/" className="navbar-logo" aria-label="KASHVIMLM Home">
            <img src={logoImg} alt="KASHVIMLM" className="navbar-logo-img" />
          </Link>
        </div>

        {/* Center: Main Navigation Links */}
        <nav className="navbar-center" aria-label="Main Navigation">
          <ul className="navbar-nav">
            {navLinks.map((link) => (
              <li key={link.path}>
                <NavLink
                  to={link.path}
                  end={link.path === '/'}
                  className={({ isActive }) =>
                    isActive ? 'nav-link active' : 'nav-link'
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Right: Extreme Right Profile Logo & Mobile Toggle */}
        <div className="navbar-right">
          <NavLink
            to={authState.isLoggedIn ? '/profile' : '/login'}
            className={({ isActive }) =>
              isActive ? 'navbar-profile-btn active' : 'navbar-profile-btn'
            }
            aria-label="User Profile"
            title={authState.isLoggedIn ? `${authState.name} (Logged In)` : 'Sign In / Profile'}
          >
            <div className="navbar-profile-avatar-wrap">
              <User size={18} className="navbar-profile-icon" />
              {authState.isLoggedIn && (
                <span className="navbar-profile-online-badge" title="Logged In" />
              )}
            </div>
            <span className="navbar-profile-text">
              {authState.isLoggedIn ? 'Profile' : 'Sign In'}
            </span>
          </NavLink>

          <button
            type="button"
            className="mobile-toggle-btn"
            onClick={toggleMobileMenu}
            aria-expanded={isMobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <>
          <div
            className="mobile-menu-overlay"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <nav
            className="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation"
          >
            {/* Mobile Profile Card */}
            <NavLink
              to={authState.isLoggedIn ? '/profile' : '/login'}
              className={({ isActive }) =>
                isActive ? 'mobile-profile-card active' : 'mobile-profile-card'
              }
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <div className="mobile-profile-avatar">
                <User size={20} />
                {authState.isLoggedIn && <span className="mobile-profile-online-badge" />}
              </div>
              <div className="mobile-profile-info">
                <span className="mobile-profile-name">
                  {authState.isLoggedIn ? authState.name : 'Sign In / Register'}
                </span>
                <span className="mobile-profile-status">
                  {authState.isLoggedIn ? '● Logged In' : 'Distributor Portal'}
                </span>
              </div>
            </NavLink>

            <ul className="mobile-nav-list">
              {navLinks.map((link) => (
                <li key={link.path}>
                  <NavLink
                    to={link.path}
                    end={link.path === '/'}
                    className={({ isActive }) =>
                      isActive ? 'mobile-nav-link active' : 'mobile-nav-link'
                    }
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span>{link.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </header>
  );
}

export default Navbar;
