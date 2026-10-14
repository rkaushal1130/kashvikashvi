import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import DistributorDashboard from '../components/dashboard/DistributorDashboard';

/**
 * Dashboard Component for KASHVIMLM
 * Renders the full multi-function operations portal with the 5 core functions:
 * 1. 📊 Dashboard (Overview, Volume, Commissions, Spotlight, News, Agenda)
 * 2. 👥 Enrollment (Distributor & Customer enrollment under root sponsor)
 * 3. 🌳 Tree (Full Dual-Leg Binary Genealogy MLM Tree)
 * 4. ➕ Add Product (Product & Pricing Management Center)
 * 5. 🛍️ See Products (Distributor Wholesale Store & Cart)
 */
export function Dashboard({ defaultNav = 'dashboard' }) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('[Dashboard] Logout error:', err);
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <DistributorDashboard
      user={currentUser}
      onSignOut={handleSignOut}
      defaultNav={defaultNav}
    />
  );
}

export default Dashboard;
