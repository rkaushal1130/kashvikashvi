import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Users,
  ShoppingCart,
  Calendar,
  Award,
  Bell,
  User,
  UserPlus,
  PackagePlus,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Check,
  CheckCircle2,
  X,
  BookOpen,
  LogOut,
  Shield,
  TrendingUp,
  Globe,
  Network,
} from 'lucide-react';
import './DistributorDashboard.css';

// Sub-pages according to roles
import EnrollmentView from './EnrollmentView';
import ShopView from './ShopView';
import ProductManagerView from './ProductManagerView';
import NetworkTreePage from '../../pages/NetworkTreePage';
import { getStoredCatalog } from '../../data/productCatalog';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

// Import generated & project assets
import reportsTabletImg from '../../assets/dashboard/reports_tablet.jpg';
import pragueContestImg from '../../assets/dashboard/prague_contest.jpg';
import newsThumb1 from '../../assets/dashboard/news_thumb_1.jpg';
import newsThumb2 from '../../assets/dashboard/news_thumb_2.jpg';
import hozriTshirtImg from '../../assets/home/hozri_tshirt.png';
import hozriHoodieImg from '../../assets/home/hozri_hoodie.png';
import elecHeadphonesImg from '../../assets/home/elec_headphones.png';
import elecPhoneImg from '../../assets/home/elec_phone.png';

/**
 * Functional, pixel-perfect reproduction of the Kashvimlm distributor portal snapshot.
 * Features:
 * - Left vertical navigation rail
 * - Top header with Kashvimlm branding, India market selector, notifications, user avatar
 * - "Welcome!" header with "Hide Commission Information" toggle
 * - 3-column member summary (Identity, Estimated Commission, Bonus breakdown)
 * - Quick Links & Action Bar with customizable share dropdowns and copy links
 * - Home vs Training tabs
 * - JumpStart Your Business interactive step cards
 * - Priority Contact with filter pills and caught up state
 * - Volume graphic with BC 001/002/003 binary tree
 * - KASHVIMLM News with featured tablet article and news feed
 * - 2026 Activity Contest banner with Prague photography & interactive opt-in
 * - My Agenda with dynamic cycle date and calendar
 * - The Spotlight product carousel with price, BV volume, and share modal
 * - Comprehensive functional modals for every action button
 */
function DistributorDashboard({ user, onSignOut, defaultNav }) {
  const navigate = useNavigate();
  const location = useLocation();

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------
  const [hideCommission, setHideCommission] = useState(false);
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'training'
  const [internalNav, setInternalNav] = useState(() => defaultNav || 'dashboard');
  const activeNavIcon = location.pathname === '/network-tree' ? 'network_tree' : internalNav;
  const setActiveNavIcon = (nav) => {
    setInternalNav(nav);
    if (nav !== 'network_tree' && location.pathname === '/network-tree') {
      navigate('/dashboard');
    }
  };
  const [toastMessage, setToastMessage] = useState('');

  // Catalog State synced with localStorage
  const [catalog, setCatalog] = useState(() => getStoredCatalog());

  useEffect(() => {
    const handleCatalogUpdate = () => {
      setCatalog(getStoredCatalog());
    };
    window.addEventListener('kashvi_catalog_update', handleCatalogUpdate);
    return () => window.removeEventListener('kashvi_catalog_update', handleCatalogUpdate);
  }, []);

  // Live Notifications State
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function fetchNotifs() {
      try {
        const res = await api.getNotifications();
        if (mounted && res && res.data) {
          setNotifications(res.data);
          setUnreadNotifCount(res.unreadCount ?? res.data.filter((n) => !n.isRead).length);
        }
      } catch {
        // Fallback gracefully
      }
    }
    fetchNotifs();
    return () => {
      mounted = false;
    };
  }, []);

  const handleMarkNotification = async (id) => {
    try {
      await api.markNotificationAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadNotifCount((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadNotifCount(0);
    } catch {}
    showToast('All notifications marked as read.');
    setActiveModal(null);
  };

  // Dropdowns & Selects
  const [selectedWebsite, setSelectedWebsite] = useState('My KASHVIMLM Website');
  const [selectedCustomerType, setSelectedCustomerType] = useState('Select Customer Type');
  const [selectedMarket, setSelectedMarket] = useState({
    code: 'IN',
    country: 'India',
    flag: '🇮🇳',
    currency: 'INR (₹)',
  });

  // Priority Contact Filter
  const [contactFilter, setContactFilter] = useState('All');

  // JumpStart Tasks Progress
  const [completedSteps, setCompletedSteps] = useState({
    orientation: false,
    website: false,
    sms: true,
    ethics: false,
    app: false,
  });

  // Contest Opt-In
  const [isContestOptedIn, setIsContestOptedIn] = useState(false);

  // Spotlight Carousel (Clothes & Electronics)
  const spotlightProducts = [
    {
      id: 'hozri-tshirt',
      name: "Men's Combed Cotton Hosiery T-Shirt",
      category: 'Clothes & Hosiery (Hozri)',
      price: 'Rs 499/-',
      volume: 8,
      desc: '100% Super-combed breathable cotton hosiery fabric with soft ribbed collar and anti-shrink finish.',
      image: hozriTshirtImg,
    },
    {
      id: 'elec-headphones',
      name: 'Smart Wireless Noise-Cancelling Headphones',
      category: 'Electronics & Smart Devices',
      price: 'Rs 2,499/-',
      volume: 25,
      desc: 'High-fidelity active noise cancellation (ANC) with 40-hour playback and dual MEMS microphones.',
      image: elecHeadphonesImg,
    },
    {
      id: 'hozri-hoodie',
      name: 'Winter Fleeced Hosiery Hoodie & Sweatshirt',
      category: 'Clothes & Hosiery (Hozri)',
      price: 'Rs 1,199/-',
      volume: 16,
      desc: 'Heavy-weight brushed cotton fleece hosiery hoodie with thermal heat retention and kangaroo pocket.',
      image: hozriHoodieImg,
    },
    {
      id: 'elec-phone',
      name: 'Pro 5G Dual-SIM Smartphone & Mobile Device',
      category: 'Electronics & Smart Devices',
      price: 'Rs 14,999/-',
      volume: 120,
      desc: 'Super AMOLED 120Hz display, 50MP AI triple camera, and 5000mAh battery with turbo fast charge.',
      image: elecPhoneImg,
    },
  ];
  const [spotlightIndex, setSpotlightIndex] = useState(0);

  // Modal Dialogs
  const [activeModal, setActiveModal] = useState(null); // 'market' | 'notify' | 'user' | 'badges' | 'qualification' | 'payout' | 'commissionLearn' | 'website' | 'links' | 'quickLink' | 'jumpStart' | 'team' | 'volumeReport' | 'news' | 'contest' | 'calendar' | 'share'
  const [modalData, setModalData] = useState(null);

  // Auto-dismiss toast
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3200);
  };

  // Copy to clipboard helper
  const handleCopyLink = (text, label) => {
    navigator.clipboard.writeText(text).then(
      () => {
        showToast(`Copied ${label} link to clipboard!`);
      },
      () => {
        showToast('Link copied to clipboard!');
      }
    );
  };

  const auth = useAuth();
  const effectiveUser = user || auth.currentUser || {
    name: 'Rahul Kaushal',
    memberId: 'KV-1001',
    role: 'ADMIN',
    isOwner: true,
  };

  // Member data (Owner: Rahul Kaushal)
  const memberName =
    effectiveUser?.name ||
    effectiveUser?.displayName ||
    effectiveUser?.fullName ||
    'Rahul Kaushal';
  const memberId =
    effectiveUser?.memberId ||
    effectiveUser?.distributorId ||
    'KV-1001';
  const memberSince = effectiveUser?.since || '2026';
  const memberRank = effectiveUser?.tier || effectiveUser?.rank || 'Company Owner / Emerald Director';

  // Format today's date dynamically
  const todayDateStr = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  const todayDayStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
  }).format(new Date());

  return (
    <div className="kashvimlm-portal-root">
      {/* Toast Notification Popup */}
      {toastMessage && (
        <div className="kashvimlm-toast">
          <CheckCircle2 size={18} className="toast-icon" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="kashvimlm-top-navbar">
        <div className="kashvimlm-top-navbar-left">
          {/* Kashvimlm Blue Corporate Logo */}
          <div
            className="kashvimlm-brand-logo"
            onClick={() => {
              setActiveNavIcon('dashboard');
              setActiveTab('home');
              navigate('/dashboard');
            }}
            style={{ cursor: 'pointer' }}
          >
            <span className="kashvimlm-logo-svg">KASHVIMLM</span>
          </div>
        </div>

        {/* 5 Prominent Quick Navigation Buttons */}
        <div className="kashvimlm-quick-nav-bar">
          <button
            type="button"
            className={`quick-nav-pill-btn ${activeNavIcon === 'dashboard' ? 'active' : ''}`}
            onClick={() => {
              setActiveNavIcon('dashboard');
              setActiveTab('home');
              navigate('/dashboard');
            }}
          >
            <BarChart3 size={16} />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            className={`quick-nav-pill-btn ${activeNavIcon === 'enroll' ? 'active' : ''}`}
            onClick={() => setActiveNavIcon('enroll')}
          >
            <UserPlus size={16} />
            <span>Enrollment</span>
          </button>
          <button
            type="button"
            className={`quick-nav-pill-btn ${activeNavIcon === 'network_tree' ? 'active' : ''}`}
            onClick={() => setActiveNavIcon('network_tree')}
          >
            <Network size={16} />
            <span>Tree</span>
          </button>
          <button
            type="button"
            className={`quick-nav-pill-btn ${activeNavIcon === 'manage_products' ? 'active' : ''}`}
            onClick={() => setActiveNavIcon('manage_products')}
          >
            <PackagePlus size={16} />
            <span>Add Product</span>
          </button>
          <button
            type="button"
            className={`quick-nav-pill-btn ${activeNavIcon === 'shop' ? 'active' : ''}`}
            onClick={() => setActiveNavIcon('shop')}
          >
            <ShoppingCart size={16} />
            <span>See Products</span>
          </button>
        </div>

        <div className="kashvimlm-top-navbar-right">
          {/* Select Market Button */}
          <button
            type="button"
            className="kashvimlm-market-selector"
            onClick={() => setActiveModal('market')}
            title="Select Regional Market"
          >
            <span className="market-flag">{selectedMarket.flag}</span>
            <span className="market-text">Select Market</span>
            <ChevronDown size={14} className="market-chevron" />
          </button>

          {/* Notifications Icon with Badge */}
          <button
            type="button"
            className="kashvimlm-nav-icon-btn"
            onClick={() => setActiveModal('notify')}
            aria-label="Notifications"
            title={`Notifications (${unreadNotifCount} unread)`}
          >
            <Bell size={19} />
            {unreadNotifCount > 0 && <span className="kashvimlm-notification-dot" />}
          </button>

          {/* User Profile Avatar with Menu */}
          <div className="kashvimlm-nav-user-wrapper">
            <button
              type="button"
              className="kashvimlm-nav-user-avatar-btn"
              onClick={() => setActiveModal(activeModal === 'user' ? null : 'user')}
              aria-label="User Account"
            >
              <div className="user-avatar-circle">
                <User size={18} />
              </div>
            </button>

            {/* User Dropdown Menu */}
            {activeModal === 'user' && (
              <div className="kashvimlm-user-dropdown-menu">
                <div className="dropdown-user-header">
                  <div className="dropdown-avatar">{memberName.charAt(0)}</div>
                  <div>
                    <h4 className="dropdown-user-name">{memberName}</h4>
                    <span className="dropdown-user-id">ID: {memberId}</span>
                  </div>
                </div>
                <div className="dropdown-divider" />
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setActiveModal('qualification');
                  }}
                >
                  <Award size={16} />
                  <span>Rank & Qualifications</span>
                </button>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setActiveModal('website');
                  }}
                >
                  <Globe size={16} />
                  <span>My Replicated Site</span>
                </button>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setActiveModal('payout');
                  }}
                >
                  <TrendingUp size={16} />
                  <span>Payouts & Direct Deposit</span>
                </button>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setActiveModal(null);
                    navigate('/');
                  }}
                >
                  <ShoppingCart size={16} />
                  <span>Switch to Retail Store</span>
                </button>
                <div className="dropdown-divider" />
                <button
                  type="button"
                  className="dropdown-item text-danger"
                  onClick={() => {
                    setActiveModal(null);
                    if (onSignOut) onSignOut();
                  }}
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout: Left Vertical Nav Rail + Scrollable Content */}
      <div className="kashvimlm-body-wrapper">
        {/* Left Vertical Icon Navigation Bar */}
        <aside className="kashvimlm-left-rail" aria-label="Sidebar Navigation">
          {/* 1. Dashboard */}
          <button
            type="button"
            className={`rail-icon-btn ${activeNavIcon === 'dashboard' ? 'active' : ''}`}
            onClick={() => {
              setActiveNavIcon('dashboard');
              setActiveTab('home');
              navigate('/dashboard');
            }}
            title="Dashboard"
            aria-label="Dashboard"
          >
            <BarChart3 size={20} />
            <span className="rail-tooltip">Dashboard</span>
          </button>

          {/* 2. Enrollment */}
          <button
            type="button"
            className={`rail-icon-btn ${activeNavIcon === 'enroll' ? 'active' : ''}`}
            onClick={() => {
              setActiveNavIcon('enroll');
              if (location.pathname !== '/dashboard' && location.pathname !== '/profile') {
                navigate('/dashboard');
              }
            }}
            title="Enrollment"
            aria-label="Enrollment"
          >
            <UserPlus size={20} />
            <span className="rail-tooltip">Enrollment</span>
          </button>

          {/* 3. Shop */}
          <button
            type="button"
            className={`rail-icon-btn ${activeNavIcon === 'shop' ? 'active' : ''}`}
            onClick={() => {
              setActiveNavIcon('shop');
              if (location.pathname !== '/dashboard' && location.pathname !== '/profile') {
                navigate('/dashboard');
              }
            }}
            title="Shop"
            aria-label="Shop"
          >
            <ShoppingCart size={20} />
            <span className="rail-tooltip">Shop</span>
          </button>

          {/* 4. Product Management */}
          <button
            type="button"
            className={`rail-icon-btn ${activeNavIcon === 'manage_products' ? 'active' : ''}`}
            onClick={() => {
              setActiveNavIcon('manage_products');
              if (location.pathname !== '/dashboard' && location.pathname !== '/profile') {
                navigate('/dashboard');
              }
            }}
            title="Product Management"
            aria-label="Product Management"
          >
            <PackagePlus size={20} />
            <span className="rail-tooltip">Product Management</span>
          </button>

          {/* 5. Network Tree */}
          <button
            type="button"
            className={`rail-icon-btn ${activeNavIcon === 'network_tree' ? 'active' : ''}`}
            onClick={() => {
              setActiveNavIcon('network_tree');
              navigate('/network-tree');
            }}
            title="Network Tree"
            aria-label="Network Tree"
          >
            <Network size={20} />
            <span className="rail-tooltip">Network Tree</span>
          </button>
        </aside>

        {/* Main Center Dashboard Area */}
        <main className={`kashvimlm-main-canvas ${activeNavIcon === 'network_tree' ? 'canvas-network-tree-mode' : ''}`}>
          {activeNavIcon === 'dashboard' && (
            <>
              {/* Welcome Header & Hide Commission Toggle */}
          <div className="kashvimlm-welcome-row">
            <h1 className="kashvimlm-welcome-heading">Welcome!</h1>

            <div className="kashvimlm-commission-toggle-wrap">
              <label className="kashvimlm-toggle-label">
                <span className="toggle-text">Hide Commission Information</span>
                <button
                  type="button"
                  className={`kashvimlm-toggle-pill ${hideCommission ? 'toggled' : ''}`}
                  onClick={() => setHideCommission((prev) => !prev)}
                  role="switch"
                  aria-checked={hideCommission}
                >
                  <span className="toggle-thumb" />
                </button>
              </label>
            </div>
          </div>

          {/* Section 1: Member Summary 3-Column Card */}
          <section className="kashvimlm-member-summary-card">
            {/* Column 1: Identity & Rank */}
            <div className="summary-col col-identity">
              <h2 className="member-name-title">{memberName}</h2>
              <p className="member-id-text">KASHVIMLM ID: {memberId}</p>
              <p className="member-meta-text">Brand Partner Since {memberSince}</p>
              <p className="member-meta-text">Rank: {memberRank}</p>

              <button
                type="button"
                className="my-badges-btn"
                onClick={() => setActiveModal('badges')}
              >
                <span className="badge-stars">⭐ ⭐ ⭐</span>
                <span className="badge-label">My Badges</span>
              </button>
            </div>

            {/* Column 2: Estimated Commission */}
            <div className="summary-col col-commission">
              <div className="commission-header-row">
                <span className="commission-subheading">Estimated Commission</span>
                <button
                  type="button"
                  className="status-pill-badge not-qualified"
                  onClick={() => setActiveModal('qualification')}
                  title="Click to view qualification criteria"
                >
                  Not Commission Qualified
                </button>
              </div>

              <div className="commission-amount-val">
                {hideCommission ? '•••• CP' : '0.00 CP'}
              </div>

              <button
                type="button"
                className="commission-checks-link"
                onClick={() => setActiveModal('payout')}
              >
                Weekly Commission/Payout checks
              </button>
            </div>

            {/* Column 3: Commission Bonus Breakdown List */}
            <div className="summary-col col-breakdown">
              <div className="breakdown-list">
                <div className="breakdown-row">
                  <span className="breakdown-name">Base Commission</span>
                  <button
                    type="button"
                    className="breakdown-learn-link"
                    onClick={() => {
                      setModalData({
                        title: 'Base Commission',
                        details:
                          'Base Commission is calculated weekly at 20% of the balanced Commission Volume Points (CVP) from your Left and Right legs across all active Business Centers.',
                      });
                      setActiveModal('commissionLearn');
                    }}
                  >
                    Learn More
                  </button>
                </div>

                <div className="breakdown-row">
                  <span className="breakdown-name">PC Order Bonus</span>
                  <button
                    type="button"
                    className="breakdown-learn-link"
                    onClick={() => {
                      setModalData({
                        title: 'PC Order Bonus (Preferred Customer)',
                        details:
                          'Earn up to 10% cash bonus on initial and repeat orders made by your enrolled Preferred Customers through your replicated site.',
                      });
                      setActiveModal('commissionLearn');
                    }}
                  >
                    Learn More
                  </button>
                </div>

                <div className="breakdown-row">
                  <span className="breakdown-name">Milestone Bonus</span>
                  <button
                    type="button"
                    className="breakdown-learn-link"
                    onClick={() => {
                      setModalData({
                        title: 'Milestone Bonus',
                        details:
                          'Special fast-growth incentive bonuses awarded when achieving key team volume milestones within your first 56 days.',
                      });
                      setActiveModal('commissionLearn');
                    }}
                  >
                    Learn More
                  </button>
                </div>

                <div className="breakdown-row">
                  <span className="breakdown-name">Frontline Bonus</span>
                  <button
                    type="button"
                    className="breakdown-learn-link"
                    onClick={() => {
                      setModalData({
                        title: 'Frontline Bonus',
                        details:
                          'Matching bonuses earned on the base commission of your personally sponsored Brand Partners who maintain active business centers.',
                      });
                      setActiveModal('commissionLearn');
                    }}
                  >
                    Learn More
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Action Bar / Share & Quick Links */}
          <section className="kashvimlm-action-bar-card">
            {/* Action Group 1: My KASHVIMLM Website */}
            <div className="action-col">
              <div className="kashvimlm-select-wrapper">
                <select
                  value={selectedWebsite}
                  onChange={(e) => setSelectedWebsite(e.target.value)}
                  className="kashvimlm-select-input"
                >
                  <option value="My KASHVIMLM Website">My KASHVIMLM Website</option>
                  <option value="Customer Enrollment Link">Customer Enrollment Link</option>
                  <option value="Product Showcase Page">Product Showcase Page</option>
                  <option value="Associate Opportunity Link">Associate Opportunity Link</option>
                </select>
                <ChevronDown size={15} className="select-arrow-icon" />
              </div>

              <div className="action-button-row">
                <button
                  type="button"
                  className="action-pill-btn"
                  onClick={() =>
                    handleCopyLink(
                      `https://kashvimlm.com/share/${memberName.toLowerCase().replace(/\s+/g, '')}?site=${encodeURIComponent(
                        selectedWebsite
                      )}`,
                      selectedWebsite
                    )
                  }
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="action-link-btn"
                  onClick={() => setActiveModal('website')}
                >
                  Manage Website
                </button>
              </div>
            </div>

            {/* Action Group 2: Select Customer Type */}
            <div className="action-col">
              <div className="kashvimlm-select-wrapper">
                <select
                  value={selectedCustomerType}
                  onChange={(e) => setSelectedCustomerType(e.target.value)}
                  className="kashvimlm-select-input"
                >
                  <option value="Select Customer Type">Select Customer Type</option>
                  <option value="Preferred Customer (10% Off)">Preferred Customer (10% Off)</option>
                  <option value="Brand Partner / Associate">Brand Partner / Associate</option>
                  <option value="Retail Customer">Retail Customer</option>
                </select>
                <ChevronDown size={15} className="select-arrow-icon" />
              </div>

              <div className="action-button-row">
                <button
                  type="button"
                  className="action-pill-btn"
                  onClick={() =>
                    handleCopyLink(
                      `${window.location.origin}/join?ref=${memberId}`,
                      'Distributor Referral'
                    )
                  }
                >
                  Copy Referral Link
                </button>
                <button
                  type="button"
                  className="action-link-btn"
                  onClick={() => setActiveModal('links')}
                >
                  Manage Links
                </button>
              </div>
            </div>

            {/* Action Group 3: Quick Links */}
            <div className="action-col col-quick-links">
              <span className="quick-links-label">Quick Links:</span>
              <div className="quick-links-grid">
                <button
                  type="button"
                  className="quick-link-box"
                  onClick={() => {
                    setModalData({
                      title: 'KASHVIMLM Connect',
                      desc: 'KASHVIMLM Connect gives you access to social sharing tools, asset libraries, prospect tracking, and messaging templates.',
                      type: 'connect',
                    });
                    setActiveModal('quickLink');
                  }}
                >
                  KASHVIMLM Connect
                </button>
                <button
                  type="button"
                  className="quick-link-box"
                  onClick={() => setActiveNavIcon('shop')}
                >
                  Shop
                </button>
                <button
                  type="button"
                  className="quick-link-box"
                  onClick={() => {
                    setActiveModal('volumeReport');
                  }}
                >
                  Team Manager
                </button>
                <button
                  type="button"
                  className="quick-link-box"
                  onClick={() => {
                    setModalData({
                      title: 'Distributor Forms & Downloads',
                      desc: 'Official compliance documents, Auto-Order authorization forms, GST declaration, and Direct Deposit enrollment sheets.',
                      type: 'forms',
                    });
                    setActiveModal('quickLink');
                  }}
                >
                  Forms
                </button>
              </div>
            </div>
          </section>

          {/* Section 3: Navigation Tabs (Home / Training) */}
          <div className="kashvimlm-tabs-row">
            <button
              type="button"
              className={`kashvimlm-nav-tab ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => setActiveTab('home')}
            >
              Home
            </button>
            <button
              type="button"
              className={`kashvimlm-nav-tab ${activeTab === 'training' ? 'active' : ''}`}
              onClick={() => setActiveTab('training')}
            >
              Training
            </button>
          </div>

          {/* TAB 1: HOME VIEW */}
          {activeTab === 'home' && (
            <>
              {/* JumpStart Your Business Banner */}
              <section className="kashvimlm-jumpstart-card">
                <div className="jumpstart-header">
                  <div className="jumpstart-title-wrap">
                    <h3 className="jumpstart-title">JumpStart Your Business</h3>
                    <span className="start-here-badge">Start Here</span>
                  </div>
                  <p className="jumpstart-desc">
                    Here are a few key activities that will help you start your business off right.
                  </p>
                </div>

                <div className="jumpstart-cards-grid">
                  {/* Step 1 */}
                  <div
                    className={`jumpstart-step-card ${completedSteps.orientation ? 'completed' : ''}`}
                    onClick={() => {
                      setModalData({
                        key: 'orientation',
                        title: 'Complete your Associate Orientation',
                        time: 'About 10 minutes',
                        desc: 'Discover how KASHVIMLM compensation works, learn how to place your first order, and tour your Team Manager portal.',
                      });
                      setActiveModal('jumpStart');
                    }}
                  >
                    <div className="step-card-content">
                      <h4 className="step-card-title">
                        {completedSteps.orientation && <Check size={14} className="step-done-check" />}
                        Complete your Associate Orientation
                      </h4>
                      <span className="step-card-time">About 10 minutes</span>
                    </div>
                    <ChevronRight size={18} className="step-card-arrow" />
                  </div>

                  {/* Step 2 */}
                  <div
                    className={`jumpstart-step-card ${completedSteps.website ? 'completed' : ''}`}
                    onClick={() => {
                      setModalData({
                        key: 'website',
                        title: 'Personalize your KASHVIMLM website',
                        time: 'About 5 minutes',
                        desc: 'Add your profile photo, custom greeting, and favorite products to your complimentary personal KASHVIMLM e-store.',
                      });
                      setActiveModal('jumpStart');
                    }}
                  >
                    <div className="step-card-content">
                      <h4 className="step-card-title">
                        {completedSteps.website && <Check size={14} className="step-done-check" />}
                        Personalize your KASHVIMLM website
                      </h4>
                      <span className="step-card-time">About 5 minutes</span>
                    </div>
                    <ChevronRight size={18} className="step-card-arrow" />
                  </div>

                  {/* Step 3 */}
                  <div
                    className={`jumpstart-step-card ${completedSteps.sms ? 'completed' : ''}`}
                    onClick={() => {
                      setModalData({
                        key: 'sms',
                        title: 'Opt in for text messages',
                        time: 'About 2 minutes',
                        desc: 'Receive instant notifications regarding order shipments, weekly commission checks, and major incentive announcements.',
                      });
                      setActiveModal('jumpStart');
                    }}
                  >
                    <div className="step-card-content">
                      <h4 className="step-card-title">
                        {completedSteps.sms && <Check size={14} className="step-done-check" />}
                        Opt in for text messages
                      </h4>
                      <span className="step-card-time">About 2 minutes</span>
                    </div>
                    <ChevronRight size={18} className="step-card-arrow" />
                  </div>

                  {/* Step 4 */}
                  <div
                    className={`jumpstart-step-card ${completedSteps.ethics ? 'completed' : ''}`}
                    onClick={() => {
                      setModalData({
                        key: 'ethics',
                        title: 'Complete your Ethics Certification',
                        time: 'About 20 minutes',
                        desc: 'Understand international direct selling compliance, truthful health claims, and proper brand representation guidelines.',
                      });
                      setActiveModal('jumpStart');
                    }}
                  >
                    <div className="step-card-content">
                      <h4 className="step-card-title">
                        {completedSteps.ethics && <Check size={14} className="step-done-check" />}
                        Complete your Ethics Certification
                      </h4>
                      <span className="step-card-time">About 20 minutes</span>
                    </div>
                    <ChevronRight size={18} className="step-card-arrow" />
                  </div>

                  {/* Step 5 */}
                  <div
                    className={`jumpstart-step-card ${completedSteps.app ? 'completed' : ''}`}
                    onClick={() => {
                      setModalData({
                        key: 'app',
                        title: 'Download the KASHVIMLM Hub App',
                        time: 'About 5 minutes',
                        desc: 'Manage your business on iOS or Android. Track team volume, send digital carts, and view real-time commission.',
                      });
                      setActiveModal('jumpStart');
                    }}
                  >
                    <div className="step-card-content">
                      <h4 className="step-card-title">
                        {completedSteps.app && <Check size={14} className="step-done-check" />}
                        Download the KASHVIMLM Hub App
                      </h4>
                      <span className="step-card-time">About 5 minutes</span>
                    </div>
                    <ChevronRight size={18} className="step-card-arrow" />
                  </div>
                </div>
              </section>

              {/* Section 4: Middle Grid (Priority Contact + Volume + KASHVIMLM News) */}
              <div className="kashvimlm-middle-layout">
                {/* Left 2/3 Column: Priority Contact & Volume */}
                <div className="kashvimlm-middle-left-col">
                  {/* Priority Contact Card */}
                  <div className="kashvimlm-panel-card priority-contact-card">
                    <div className="panel-card-header">
                      <h3 className="panel-card-title">Priority Contact</h3>
                      <p className="panel-card-subtitle">Who to reach out this week</p>
                    </div>

                    {/* Filter Pills */}
                    <div className="contact-filter-pills">
                      {['All', 'Pacesetter', 'New Sales', 'Close To Check'].map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          className={`contact-pill ${contactFilter === filter ? 'active' : ''}`}
                          onClick={() => setContactFilter(filter)}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>

                    {/* Caught Up State */}
                    <div className="caught-up-state">
                      <div className="caught-up-circle">
                        <Check size={28} className="caught-up-check-icon" />
                      </div>
                      <h4 className="caught-up-title">You're all caught up</h4>
                      <p className="caught-up-desc">
                        No priority contacts this week. A great moment to plan ahead — review your
                        team activity or set a goal for next week.
                      </p>
                      <button
                        type="button"
                        className="btn-view-team"
                        onClick={() => setActiveModal('team')}
                      >
                        View team
                      </button>
                    </div>
                  </div>

                  {/* Volume Card */}
                  <div className="kashvimlm-panel-card volume-card">
                    <div className="panel-card-header">
                      <h3 className="panel-card-title">Volume</h3>
                      <p className="panel-card-subtitle">Your weekly commission progress</p>
                    </div>

                    {/* Volume Notice Banner */}
                    <div className="volume-notice-banner">
                      <p>
                        We are only showing you a few of your top results here. If you want to see
                        more go check out the full report in Team Manager.
                      </p>
                    </div>

                    {/* Binary Tree Visualization */}
                    <div className="binary-tree-container">
                      {/* Root Node: BC 001 */}
                      <div className="tree-node node-bc001">
                        <div className="node-header">
                          <span className="node-label">BC 001</span>
                          <span className="node-cvp">
                            {hideCommission ? 'Est. CVP: •••• / ••••' : 'Est. CVP: 0.00 / 1000'}
                          </span>
                        </div>
                        <div className="node-bars-row">
                          <div className="node-leg-bar">
                            <span className="leg-name">Left</span>
                            <div className="bar-track">
                              <div className="bar-fill pink-fill" style={{ width: '8%' }} />
                            </div>
                          </div>
                          <div className="node-leg-bar">
                            <span className="leg-name">Right</span>
                            <div className="bar-track">
                              <div className="bar-fill teal-fill" style={{ width: '8%' }} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Tree Branch Lines (SVG) */}
                      <div className="tree-branch-svg-wrapper">
                        <svg
                          width="100%"
                          height="44"
                          viewBox="0 0 400 44"
                          preserveAspectRatio="none"
                          className="tree-svg-lines"
                        >
                          {/* Center Stem */}
                          <line x1="200" y1="0" x2="200" y2="18" stroke="#94a3b8" strokeWidth="2" />
                          {/* Horizontal Crossbar */}
                          <line x1="90" y1="18" x2="310" y2="18" stroke="#94a3b8" strokeWidth="2" />
                          {/* Left Stem down to BC 002 */}
                          <line x1="90" y1="18" x2="90" y2="44" stroke="#94a3b8" strokeWidth="2" />
                          {/* Right Stem down to BC 003 */}
                          <line x1="310" y1="18" x2="310" y2="44" stroke="#94a3b8" strokeWidth="2" />
                        </svg>
                      </div>

                      {/* Child Row: BC 002 & BC 003 */}
                      <div className="tree-child-row">
                        {/* Child Left: BC 002 */}
                        <div className="tree-node node-child">
                          <div className="node-header">
                            <span className="node-label">BC 002</span>
                          </div>
                          <div className="node-bars-row">
                            <div className="node-leg-bar">
                              <span className="leg-name">Left</span>
                              <div className="bar-track">
                                <div className="bar-fill grey-fill" style={{ width: '0%' }} />
                              </div>
                            </div>
                            <div className="node-leg-bar">
                              <span className="leg-name">Right</span>
                              <div className="bar-track">
                                <div className="bar-fill grey-fill" style={{ width: '0%' }} />
                              </div>
                            </div>
                          </div>
                          <div className="node-cvp-footer">
                            {hideCommission ? 'Est. CVP: •••• / ••••' : 'Est. CVP: 0.00 / 1000'}
                          </div>
                        </div>

                        {/* Child Right: BC 003 */}
                        <div className="tree-node node-child">
                          <div className="node-header">
                            <span className="node-label">BC 003</span>
                          </div>
                          <div className="node-bars-row">
                            <div className="node-leg-bar">
                              <span className="leg-name">Left</span>
                              <div className="bar-track">
                                <div className="bar-fill grey-fill" style={{ width: '0%' }} />
                              </div>
                            </div>
                            <div className="node-leg-bar">
                              <span className="leg-name">Right</span>
                              <div className="bar-track">
                                <div className="bar-fill grey-fill" style={{ width: '0%' }} />
                              </div>
                            </div>
                          </div>
                          <div className="node-cvp-footer">
                            {hideCommission ? 'Est. CVP: •••• / ••••' : 'Est. CVP: 0.00 / 1000'}
                          </div>
                        </div>
                      </div>

                      {/* View Report Link */}
                      <div className="volume-footer-link-wrap">
                        <button
                          type="button"
                          className="view-report-link"
                          onClick={() => setActiveModal('volumeReport')}
                        >
                          View Report
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right 1/3 Column: KASHVIMLM News */}
                <div className="kashvimlm-middle-right-col">
                  <div className="kashvimlm-panel-card news-card">
                    <div className="panel-card-header">
                      <h3 className="panel-card-title">KASHVIMLM News</h3>
                    </div>

                    {/* Featured Article Card */}
                    <div
                      className="featured-news-card"
                      onClick={() => {
                        setModalData({
                          title: 'All of Your Team Manager Reports Are Now Free',
                          desc: 'Great news—we’ve made all 40+ Team Manager Reports available to every Brand Partner at no cost. Track volume trends, identify emerging leaders, and analyze downline activity with real-time enterprise reports.',
                          img: reportsTabletImg,
                        });
                        setActiveModal('news');
                      }}
                    >
                      <div className="featured-news-image-wrapper">
                        <img
                          src={reportsTabletImg}
                          alt="Team Manager Reports"
                          className="featured-news-img"
                        />
                      </div>
                      <div className="featured-news-body">
                        <h4 className="featured-news-title">
                          All of Your Team Manager Reports Are Now Free
                        </h4>
                        <p className="featured-news-desc">
                          Great news—we’ve made all 40+ Team Manager Reports available to every Brand
                          Partner at no cost.
                        </p>
                        <span className="read-more-link">Read More &gt;</span>
                      </div>
                    </div>

                    {/* News List Items */}
                    <div className="news-feed-list">
                      {/* Item 1 */}
                      <div
                        className="news-feed-item"
                        onClick={() => {
                          setModalData({
                            title: 'Ethics in Action Certification Is Moving to KASHVIMLM Connect',
                            desc: 'The Ethics in Action Certification is now available directly in the KASHVIMLM Connect app. Complete interactive modules on mobile and earn verified distributor credentials.',
                            img: newsThumb1,
                          });
                          setActiveModal('news');
                        }}
                      >
                        <img src={newsThumb1} alt="News thumbnail" className="news-item-thumb" />
                        <div className="news-item-text">
                          <h5 className="news-item-title">
                            Ethics in Action Certification Is Moving to US...
                          </h5>
                          <p className="news-item-snippet">
                            The Ethics in Action Certification is now available in the KASHVIMLM Connect
                            app.
                          </p>
                        </div>
                      </div>

                      {/* Item 2 */}
                      <div
                        className="news-feed-item"
                        onClick={() => {
                          setModalData({
                            title: 'KASHVIMLM Connect Is Live',
                            desc: 'KASHVIMLM Connect is officially live, bringing smarter sharing, stronger connections, and streamlined business tools together in one convenient mobile platform.',
                            img: newsThumb1,
                          });
                          setActiveModal('news');
                        }}
                      >
                        <img src={newsThumb1} alt="News thumbnail" className="news-item-thumb" />
                        <div className="news-item-text">
                          <h5 className="news-item-title">KASHVIMLM Connect Is Live</h5>
                          <p className="news-item-snippet">
                            KASHVIMLM Connect is officially live, bringing smarter sharing, stronger
                            connections, and streamlined business tools togethe...
                          </p>
                        </div>
                      </div>

                      {/* Item 3 */}
                      <div
                        className="news-feed-item"
                        onClick={() => {
                          setModalData({
                            title: 'New Ethics in Action Course',
                            desc: 'Building your KASHVIMLM business the right way starts with integrity. Explore our refreshed 2026 Code of Conduct modules.',
                            img: newsThumb2,
                          });
                          setActiveModal('news');
                        }}
                      >
                        <img src={newsThumb2} alt="News thumbnail" className="news-item-thumb" />
                        <div className="news-item-text">
                          <h5 className="news-item-title">New Ethics in Action Course</h5>
                          <p className="news-item-snippet">
                            Building your KASHVIMLM business the right way starts with integrity.
                          </p>
                        </div>
                      </div>

                      {/* Item 4 */}
                      <div
                        className="news-feed-item"
                        onClick={() => {
                          setModalData({
                            title: 'Join World Service Week 7-14 June',
                            desc: 'Join The KASHVIMLM Foundation for our 10th annual World Service Week. Together with partners worldwide, we pack meals and support nutrition projects.',
                            img: newsThumb2,
                          });
                          setActiveModal('news');
                        }}
                      >
                        <img src={newsThumb2} alt="News thumbnail" className="news-item-thumb" />
                        <div className="news-item-text">
                          <h5 className="news-item-title">Join World Service Week 7-14 June</h5>
                          <p className="news-item-snippet">
                            Join The KASHVIMLM Foundation for our 10th annual World Service Week, 7-14
                            June.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* View All News Link */}
                    <div className="news-footer-link-wrap">
                      <button
                        type="button"
                        className="view-all-news-link"
                        onClick={() => {
                          setModalData({
                            title: 'KASHVIMLM Corporate News Archive',
                            desc: 'Explore all updates, product launches, global convention announcements, and distributor recognitions.',
                          });
                          setActiveModal('news');
                        }}
                      >
                        View All &gt;
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 5: My Contests Full Width Banner (Prague 2026 Activity Contest) */}
              <section className="kashvimlm-contest-card">
                <div
                  className="contest-banner-bg"
                  style={{ backgroundImage: `url(${pragueContestImg})` }}
                >
                  <div className="contest-overlay-gradient" />

                  {/* Left Content Box */}
                  <div className="contest-left-content">
                    <h2 className="contest-title">2026 Activity Contest</h2>
                    <p className="contest-desc">
                      There is a new contest that you may qualify for. Opt-in now to start working
                      toward exciting rewards.
                    </p>

                    <button
                      type="button"
                      className={`contest-optin-btn ${isContestOptedIn ? 'opted-in' : ''}`}
                      onClick={() => {
                        setIsContestOptedIn((prev) => {
                          const next = !prev;
                          showToast(
                            next
                              ? '🎉 Congratulations! You have opted in to the 2026 Prague Activity Contest.'
                              : 'Opt-in status updated.'
                          );
                          return next;
                        });
                      }}
                    >
                      {isContestOptedIn ? '✓ Opted In' : 'Opt-in'}
                    </button>
                  </div>

                  {/* Right Floating Tooltip Card */}
                  <div className="contest-right-floating-card">
                    <h4 className="contest-card-subheading">How to Qualify?</h4>
                    <p className="contest-card-p">
                      Every new enrollment, every Subscribe &amp; Save order, every rank advancement
                      on your team moves you closer to Prague. Stack a few small wins each week and
                      you'll hit 150 travel credits before you know it.
                    </p>
                    <button
                      type="button"
                      className="see-contest-details-link"
                      onClick={() => setActiveModal('contest')}
                    >
                      See Contest Details &gt;
                    </button>
                  </div>
                </div>
              </section>

              {/* Section 6: Bottom Row (My Agenda & The Spotlight) */}
              <div className="kashvimlm-bottom-grid">
                {/* Card 1: My Agenda */}
                <div className="kashvimlm-panel-card agenda-card">
                  <div className="panel-card-header">
                    <h3 className="panel-card-title">My Agenda</h3>
                  </div>

                  <div className="agenda-today-section">
                    <span className="agenda-today-label">Today</span>
                    <h4 className="agenda-date-big">{todayDateStr}</h4>
                    <p className="agenda-day-text">{todayDayStr}</p>
                    <p className="agenda-cycle-text">Cycle: 1/1A</p>
                  </div>

                  <div className="agenda-events-status">
                    <p className="no-events-text">There are no events today</p>
                  </div>

                  <div className="agenda-next-event-section">
                    <span className="next-event-label">Next Event</span>
                    <p className="no-upcoming-text">No upcoming events</p>
                  </div>

                  <div className="agenda-btn-wrap">
                    <button
                      type="button"
                      className="btn-view-calendar"
                      onClick={() => setActiveModal('calendar')}
                    >
                      <span>View Calendar</span>
                      <Calendar size={16} />
                    </button>
                  </div>
                </div>

                {/* Card 2: The Spotlight (Product Carousel) */}
                <div className="kashvimlm-panel-card spotlight-card">
                  <div className="panel-card-header">
                    <h3 className="panel-card-title">The Spotlight</h3>
                  </div>

                  <div className="spotlight-product-body">
                    {/* Product Image */}
                    <div className="spotlight-image-col">
                      <img
                        src={spotlightProducts[spotlightIndex].image}
                        alt={spotlightProducts[spotlightIndex].name}
                        className="spotlight-product-img"
                      />
                    </div>

                    {/* Product Details */}
                    <div className="spotlight-details-col">
                      <h4 className="spotlight-product-name">
                        {spotlightProducts[spotlightIndex].name}
                      </h4>
                      <p className="spotlight-price">{spotlightProducts[spotlightIndex].price}</p>
                      <p className="spotlight-volume">
                        Volume: <strong>{spotlightProducts[spotlightIndex].volume}</strong>
                      </p>
                      <p className="spotlight-desc-snip">
                        {spotlightProducts[spotlightIndex].desc}
                      </p>
                    </div>
                  </div>

                  {/* Carousel Controls */}
                  <div className="spotlight-carousel-controls">
                    <button
                      type="button"
                      className="carousel-arrow-btn"
                      onClick={() =>
                        setSpotlightIndex((prev) =>
                          prev === 0 ? spotlightProducts.length - 1 : prev - 1
                        )
                      }
                      aria-label="Previous Spotlight Product"
                    >
                      <ChevronLeft size={18} />
                    </button>

                    <div className="carousel-dots-wrap">
                      {spotlightProducts.map((p, idx) => (
                        <button
                          key={p.id}
                          type="button"
                          className={`carousel-dot ${spotlightIndex === idx ? 'active' : ''}`}
                          onClick={() => setSpotlightIndex(idx)}
                          aria-label={`Go to product ${idx + 1}`}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      className="carousel-arrow-btn"
                      onClick={() =>
                        setSpotlightIndex((prev) =>
                          prev === spotlightProducts.length - 1 ? 0 : prev + 1
                        )
                      }
                      aria-label="Next Spotlight Product"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="spotlight-actions-row">
                    <button
                      type="button"
                      className="btn-share-product"
                      onClick={() => {
                        setModalData(spotlightProducts[spotlightIndex]);
                        setActiveModal('share');
                      }}
                    >
                      Share Product
                    </button>

                    <button
                      type="button"
                      className="link-go-to-shop"
                      onClick={() => setActiveNavIcon('shop')}
                    >
                      Go to Shop
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: TRAINING VIEW */}
          {activeTab === 'training' && (
            <section className="kashvimlm-training-view">
              <div className="training-hero-banner">
                <div className="training-hero-text">
                  <span className="training-badge">KASHVIMLM ACADEMY</span>
                  <h2 className="training-heading">Distributor Learning &amp; Certification</h2>
                  <p className="training-subtext">
                    Master direct selling strategies, ethical marketing guidelines, and customer acquisition
                    tactics that empower successful apparel and technology entrepreneurs.
                  </p>
                </div>
              </div>

              <div className="training-modules-grid">
                <div className="training-card">
                  <div className="training-icon-box bg-blue">
                    <BookOpen size={24} />
                  </div>
                  <h4 className="training-card-title">Associate Orientation Masterclass</h4>
                  <p className="training-card-desc">
                    Comprehensive walk-through of Business Center placement, CVP calculation, and
                    autoship benefits.
                  </p>
                  <button
                    type="button"
                    className="training-cta-btn"
                    onClick={() => {
                      setCompletedSteps((prev) => ({ ...prev, orientation: true }));
                      showToast('Orientation module marked completed!');
                    }}
                  >
                    {completedSteps.orientation ? '✓ Completed' : 'Start Lesson (10 min)'}
                  </button>
                </div>

                <div className="training-card">
                  <div className="training-icon-box bg-green">
                    <Shield size={24} />
                  </div>
                  <h4 className="training-card-title">Ethics &amp; Truthful Claims</h4>
                  <p className="training-card-desc">
                    Learn compliant advertising standards, social media disclaimers, and honest
                    representation of earnings.
                  </p>
                  <button
                    type="button"
                    className="training-cta-btn"
                    onClick={() => {
                      setCompletedSteps((prev) => ({ ...prev, ethics: true }));
                      showToast('Ethics certification module completed!');
                    }}
                  >
                    {completedSteps.ethics ? '✓ Certified' : 'Complete Certification (20 min)'}
                  </button>
                </div>

                <div className="training-card">
                  <div className="training-icon-box bg-purple">
                    <TrendingUp size={24} />
                  </div>
                  <h4 className="training-card-title">Social Sharing with KASHVIMLM Connect</h4>
                  <p className="training-card-desc">
                    How to send curated product baskets, generate personalized links, and follow up
                    with interested prospects.
                  </p>
                  <button
                    type="button"
                    className="training-cta-btn"
                    onClick={() => showToast('Opened KASHVIMLM Connect training video!')}
                  >
                    Watch Tutorial (7 min)
                  </button>
                </div>
              </div>
            </section>
          )}
            </>
          )}

          {/* ===================================================================
              ROLE 2: ENROLL VIEW (Enroll New Distributor or Customer)
              =================================================================== */}
          {activeNavIcon === 'enroll' && (
            <EnrollmentView user={effectiveUser} onNavigate={setActiveNavIcon} />
          )}

          {/* ===================================================================
              ROLE 3: SHOP VIEW (Wholesale Distributor Store & Cart)
              =================================================================== */}
          {activeNavIcon === 'shop' && (
            <ShopView user={effectiveUser} catalog={catalog} onNavigate={setActiveNavIcon} />
          )}

          {/* ===================================================================
              ROLE 4: PRODUCT & PRICING MANAGER (ID Owner Only)
              =================================================================== */}
          {activeNavIcon === 'manage_products' && (
            <ProductManagerView
              user={effectiveUser}
              catalog={catalog}
              onUpdateCatalog={setCatalog}
              onNavigate={setActiveNavIcon}
            />
          )}

          {/* ===================================================================
              ROLE 5: NETWORK TREE (MLM Binary Genealogy Tree)
              =================================================================== */}
          {activeNavIcon === 'network_tree' && (
            <NetworkTreePage embedded={true} />
          )}
        </main>
      </div>

      {/* =======================================================================
          MODAL DIALOGS (Fully functional for all interactive buttons)
          ======================================================================= */}

      {/* 1. Market Selection Modal */}
      {activeModal === 'market' && (
        <div className="kashvimlm-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="kashvimlm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Select Regional Market</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-instruction">
                Select your primary regional marketplace for currency, pricing, and product
                availability:
              </p>
              <div className="market-list-grid">
                {[
                  { code: 'IN', country: 'India', flag: '🇮🇳', currency: 'INR (₹)' },
                  { code: 'US', country: 'United States', flag: '🇺🇸', currency: 'USD ($)' },
                  { code: 'CA', country: 'Canada', flag: '🇨🇦', currency: 'CAD ($)' },
                  { code: 'AU', country: 'Australia', flag: '🇦🇺', currency: 'AUD (A$)' },
                  { code: 'GB', country: 'United Kingdom', flag: '🇬🇧', currency: 'GBP (£)' },
                  { code: 'SG', country: 'Singapore', flag: '🇸🇬', currency: 'SGD (S$)' },
                  { code: 'MY', country: 'Malaysia', flag: '🇲🇾', currency: 'MYR (RM)' },
                  { code: 'PH', country: 'Philippines', flag: '🇵🇭', currency: 'PHP (₱)' },
                ].map((m) => (
                  <button
                    key={m.code}
                    type="button"
                    className={`market-choice-item ${
                      selectedMarket.code === m.code ? 'selected' : ''
                    }`}
                    onClick={() => {
                      setSelectedMarket(m);
                      setActiveModal(null);
                      showToast(`Market switched to ${m.country} (${m.currency})`);
                    }}
                  >
                    <span className="market-choice-flag">{m.flag}</span>
                    <span className="market-choice-name">{m.country}</span>
                    <span className="market-choice-curr">{m.currency}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Notifications Drawer / Modal */}
      {activeModal === 'notify' && (
        <div className="kashvimlm-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="kashvimlm-modal-card modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <Bell size={20} className="text-primary" />
                <h3 className="modal-title">Notifications</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="notifications-list">
                {notifications && notifications.length > 0 ? (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`notification-item ${!n.isRead ? 'unread' : ''}`}
                      onClick={() => handleMarkNotification(n.id)}
                      style={{ cursor: 'pointer' }}
                      title="Click to mark as read"
                    >
                      {!n.isRead && <span className="notif-dot" />}
                      <div className="notif-content">
                        <p className="notif-msg">
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              letterSpacing: '0.5px',
                              marginRight: '6px',
                              backgroundColor: 'rgba(56, 189, 248, 0.15)',
                              color: '#38bdf8',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                            }}
                          >
                            {n.type}
                          </span>
                          <strong>{n.title}</strong>: {n.message}
                        </p>
                        <span className="notif-time">
                          {new Date(n.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
                    No notifications at this time.
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-modal-secondary"
                onClick={handleMarkAllRead}
              >
                Mark all as read
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Badges Modal */}
      {activeModal === 'badges' && (
        <div className="kashvimlm-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="kashvimlm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">My Badges &amp; Recognitions</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="badges-grid-list">
                <div className="badge-item-card earned">
                  <div className="badge-icon-wrap">🌟</div>
                  <h4 className="badge-item-title">Premier Pacesetter</h4>
                  <p className="badge-item-desc">
                    Achieved by enrolling 4 active Preferred Customers or Brand Partners within
                    initial 56 days.
                  </p>
                  <span className="badge-status-pill earned">Earned</span>
                </div>

                <div className="badge-item-card earned">
                  <div className="badge-icon-wrap">🏆</div>
                  <h4 className="badge-item-title">Business Center Activator</h4>
                  <p className="badge-item-desc">
                    Successfully activated 3 Business Centers (BC 001, BC 002, BC 003).
                  </p>
                  <span className="badge-status-pill earned">Earned</span>
                </div>

                <div className="badge-item-card in-progress">
                  <div className="badge-icon-wrap">✈️</div>
                  <h4 className="badge-item-title">Prague 2026 Achiever</h4>
                  <p className="badge-item-desc">
                    Accumulate 150 contest travel credits before qualification cutoff.
                  </p>
                  <span className="badge-status-pill in-progress">In Progress (12/150)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Commission Qualification Criteria Modal */}
      {activeModal === 'qualification' && (
        <div className="kashvimlm-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="kashvimlm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Commission Qualification Rules</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="qualification-info-box">
                <h4 className="info-box-title">Why am I "Not Commission Qualified"?</h4>
                <p className="info-box-text">
                  To be eligible for weekly Base Commission and bonuses, your primary Business Center
                  must maintain a minimum of <strong>100 Personal Sales Volume (PSV)</strong> every
                  rolling 4-week cycle.
                </p>
                <div className="qualification-steps-list">
                  <div className="qual-step-item">
                    <span className="step-num">1</span>
                    <p>
                      <strong>Setup an Auto-Order:</strong> Maintain an active monthly Subscribe
                      &amp; Save of at least 100 PSV.
                    </p>
                  </div>
                  <div className="qual-step-item">
                    <span className="step-num">2</span>
                    <p>
                      <strong>Generate Retail Orders:</strong> Customer orders placed on your
                      personal KASHVIMLM website contribute directly to your personal volume.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => {
                  setActiveModal(null);
                  setActiveModal('quickLink');
                  setModalData({ title: 'Set Up Auto-Order', type: 'shop' });
                }}
              >
                Setup Auto-Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Payout Schedule Modal */}
      {activeModal === 'payout' && (
        <div className="kashvimlm-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="kashvimlm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Weekly Commission &amp; Payout Checks</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p className="payout-desc">
                Commissions are calculated every Friday at midnight MT and deposited directly into
                your verified bank account on the following Monday.
              </p>
              <div className="payout-table-wrapper">
                <table className="kashvimlm-data-table">
                  <thead>
                    <tr>
                      <th>Cycle Week</th>
                      <th>End Date</th>
                      <th>CVP Volume</th>
                      <th>Payout</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Cycle 1/1A</td>
                      <td>{todayDateStr}</td>
                      <td>0 CVP</td>
                      <td>₹0.00</td>
                      <td><span className="table-badge processing">Processing</span></td>
                    </tr>
                    <tr>
                      <td>Cycle 52/4B</td>
                      <td>Sep 14, 2026</td>
                      <td>0 CVP</td>
                      <td>₹0.00</td>
                      <td><span className="table-badge completed">Settled</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Commission Breakdown "Learn More" Modal */}
      {activeModal === 'commissionLearn' && modalData && (
        <div className="kashvimlm-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="kashvimlm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{modalData.title}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-learn-text">{modalData.details}</p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => setActiveModal(null)}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Manage Website Modal */}
      {activeModal === 'website' && (
        <div className="kashvimlm-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="kashvimlm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Personalize Your KASHVIMLM Website</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="website-setting-group">
                <label className="website-label">Subdomain URL:</label>
                <div className="website-url-input-wrap">
                  <span className="url-prefix">https://</span>
                  <input
                    type="text"
                    defaultValue={memberName.toLowerCase().replace(/\s+/g, '')}
                    className="website-input"
                  />
                  <span className="url-suffix">.kashvimlm.com</span>
                </div>
              </div>
              <div className="website-setting-group">
                <label className="website-label">Welcome Message:</label>
                <textarea
                  rows="3"
                  defaultValue={`Welcome to my official KASHVIMLM wellness storefront! Explore clinical-grade cellular nutrition designed to optimize your energy, immunity, and vitality.`}
                  className="website-textarea"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => {
                  setCompletedSteps((prev) => ({ ...prev, website: true }));
                  showToast('Website settings saved successfully!');
                  setActiveModal(null);
                }}
              >
                Save &amp; Publish Website
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Manage Links Modal */}
      {activeModal === 'links' && (
        <div className="kashvimlm-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="kashvimlm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Manage Tracked Referral Links</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-instruction">
                Create custom tracked links for WhatsApp, Facebook, Instagram bios, and promotional
                campaigns:
              </p>
              <div className="links-list-group">
                <div className="link-item-row">
                  <div>
                    <strong>Preferred Customer (10% Off Cart)</strong>
                    <p className="link-sub">Direct link with automated 10% customer discount</p>
                  </div>
                  <button
                    type="button"
                    className="btn-copy-small"
                    onClick={() =>
                      handleCopyLink(`https://kashvimlm.com/pc/${memberId}`, 'Preferred Customer')
                    }
                  >
                    Copy
                  </button>
                </div>
                <div className="link-item-row">
                  <div>
                    <strong>Associate Business Enrollment</strong>
                    <p className="link-sub">{`${window.location.origin}/join?ref=${memberId}`}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-copy-small"
                    onClick={() =>
                      handleCopyLink(`${window.location.origin}/join?ref=${memberId}`, 'Distributor Referral')
                    }
                  >
                    Copy Referral Link
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. Generic Quick Link Modal (KASHVIMLM Connect, Shop, Forms) */}
      {activeModal === 'quickLink' && modalData && (
        <div className="kashvimlm-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="kashvimlm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{modalData.title}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-learn-text">{modalData.desc}</p>
              {modalData.type === 'connect' && (
                <div className="connect-hub-actions">
                  <button
                    type="button"
                    className="btn-connect-action"
                    onClick={() => showToast('Opening KASHVIMLM Connect Asset Library...')}
                  >
                    Browse Social Graphics
                  </button>
                  <button
                    type="button"
                    className="btn-connect-action"
                    onClick={() => showToast('Opening Product Recommendation Tool...')}
                  >
                    Create Shareable Cart
                  </button>
                </div>
              )}
              {modalData.type === 'shop' && (
                <div className="quick-shop-list">
                  <div className="quick-shop-item">
                    <span>MagneCal D (120 Caps)</span>
                    <button
                      type="button"
                      className="btn-quick-add"
                      onClick={() => showToast('Added MagneCal D to order cart!')}
                    >
                      Add to Cart (Rs 699)
                    </button>
                  </div>
                  <div className="quick-shop-item">
                    <span>BiOmega™ Fish Oil</span>
                    <button
                      type="button"
                      className="btn-quick-add"
                      onClick={() => showToast('Added BiOmega™ to order cart!')}
                    >
                      Add to Cart (Rs 1,450)
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => setActiveModal(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. JumpStart Step Modal */}
      {activeModal === 'jumpStart' && modalData && (
        <div className="kashvimlm-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="kashvimlm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="step-time-badge">{modalData.time}</span>
                <h3 className="modal-title mt-1">{modalData.title}</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-learn-text">{modalData.desc}</p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => {
                  if (modalData.key) {
                    setCompletedSteps((prev) => ({ ...prev, [modalData.key]: true }));
                    showToast(`Marked "${modalData.title}" as completed!`);
                  }
                  setActiveModal(null);
                }}
              >
                Mark as Completed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. View Team Modal */}
      {activeModal === 'team' && (
        <div className="kashvimlm-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="kashvimlm-modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <Users size={22} className="text-primary" />
                <h3 className="modal-title">Downline Team &amp; Contacts</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p className="team-intro">
                Review your personally enrolled Brand Partners and Preferred Customers placed in
                your dual-channel tree:
              </p>
              <div className="team-table-wrap">
                <table className="kashvimlm-data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Placement</th>
                      <th>Current CVP</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>Aarav Sharma</strong>
                        <div className="table-sub">aarav@example.com</div>
                      </td>
                      <td>Brand Partner</td>
                      <td>BC 001 Left</td>
                      <td>120 CVP</td>
                      <td>
                        <button
                          type="button"
                          className="btn-table-action"
                          onClick={() => showToast('Opening contact card for Aarav Sharma...')}
                        >
                          Message
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Neha Verma</strong>
                        <div className="table-sub">neha.v@example.com</div>
                      </td>
                      <td>Preferred Customer</td>
                      <td>BC 001 Right</td>
                      <td>85 CVP</td>
                      <td>
                        <button
                          type="button"
                          className="btn-table-action"
                          onClick={() => showToast('Opening contact card for Neha Verma...')}
                        >
                          Message
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 12. Volume Report Modal */}
      {activeModal === 'volumeReport' && (
        <div className="kashvimlm-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="kashvimlm-modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <TrendingUp size={22} className="text-primary" />
                <h3 className="modal-title">Team Manager - Weekly Volume Report</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="volume-summary-metrics">
                <div className="metric-box">
                  <span className="metric-label">BC 001 Total Left</span>
                  <span className="metric-val">{hideCommission ? '••••' : '0.00 CVP'}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">BC 001 Total Right</span>
                  <span className="metric-val">{hideCommission ? '••••' : '0.00 CVP'}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Carryover Volume</span>
                  <span className="metric-val">0.00 CVP</span>
                </div>
              </div>
              <p className="report-note">
                Base commission is calculated at 20% of matching leg volume. Unmatched volume
                carries over indefinitely provided your personal qualification is maintained.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => setActiveModal(null)}
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 13. News Article Reader Modal */}
      {activeModal === 'news' && modalData && (
        <div className="kashvimlm-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="kashvimlm-modal-card modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{modalData.title}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {modalData.img && (
                <div className="news-modal-img-wrap">
                  <img src={modalData.img} alt={modalData.title} className="news-modal-img" />
                </div>
              )}
              <p className="news-modal-fulltext">{modalData.desc}</p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => setActiveModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 14. Contest Details Modal */}
      {activeModal === 'contest' && (
        <div className="kashvimlm-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="kashvimlm-modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <Award size={22} className="text-primary" />
                <h3 className="modal-title">2026 Prague Activity Contest Details</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="contest-modal-header-banner">
                <img
                  src={pragueContestImg}
                  alt="Prague Charles Bridge"
                  className="contest-modal-banner-img"
                />
              </div>
              <div className="contest-rules-list">
                <h4 className="rules-heading">Qualification Rules &amp; Tier Rewards:</h4>
                <ul>
                  <li>
                    <strong>Tier 1 (75 Credits):</strong> Single accommodation voucher &amp; Gala
                    ticket in Prague.
                  </li>
                  <li>
                    <strong>Tier 2 (150 Credits):</strong> Complete all-inclusive luxury 5-star trip
                    for two, round-trip flights, and private castle dinner.
                  </li>
                  <li>
                    <strong>How to Earn:</strong> +5 credits for every new Preferred Customer Auto-Order;
                    +15 credits for every new Brand Partner activation; +25 credits for rank advancement.
                  </li>
                </ul>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => {
                  setIsContestOptedIn(true);
                  showToast('You are opted in to Prague 2026!');
                  setActiveModal(null);
                }}
              >
                {isContestOptedIn ? 'Opted In ✓' : 'Opt In Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 15. Calendar Modal */}
      {activeModal === 'calendar' && (
        <div className="kashvimlm-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="kashvimlm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <Calendar size={20} className="text-primary" />
                <h3 className="modal-title">Distributor Calendar</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="calendar-status-box">
                <h4>Today: {todayDateStr} ({todayDayStr})</h4>
                <p>Cycle: 1/1A &bull; Week 38 Commission Cutoff</p>
              </div>
              <div className="upcoming-schedule-list">
                <h5 className="schedule-heading">Upcoming Corporate Webinars:</h5>
                <div className="schedule-item">
                  <div className="schedule-date">Wed, Sep 23</div>
                  <div className="schedule-info">
                    <strong>Clothes &amp; Smart Electronics Catalog Masterclass</strong>
                    <span>8:00 PM IST &bull; Zoom Live</span>
                  </div>
                </div>
                <div className="schedule-item">
                  <div className="schedule-date">Sat, Sep 26</div>
                  <div className="schedule-info">
                    <strong>Pacesetter Business Leadership Summit</strong>
                    <span>10:30 AM IST &bull; Virtual Event</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => {
                  showToast('Webinar reminder added to your device calendar!');
                  setActiveModal(null);
                }}
              >
                Add to Calendar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 16. Share Product Modal */}
      {activeModal === 'share' && modalData && (
        <div className="kashvimlm-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="kashvimlm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Share {modalData.name}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="share-product-preview">
                <img src={modalData.image} alt={modalData.name} className="share-prod-img" />
                <div>
                  <h4>{modalData.name}</h4>
                  <p className="share-prod-price">{modalData.price} &bull; {modalData.volume} BV</p>
                </div>
              </div>
              <p className="share-link-label">Your Replicated Product Link:</p>
              <div className="share-input-row">
                <input
                  type="text"
                  readOnly
                  value={`https://kashvimlm.com/p/${modalData.id}?sponsor=${memberId}`}
                  className="share-input"
                />
                <button
                  type="button"
                  className="btn-share-copy"
                  onClick={() =>
                    handleCopyLink(
                      `https://kashvimlm.com/p/${modalData.id}?sponsor=${memberId}`,
                      modalData.name
                    )
                  }
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DistributorDashboard;
