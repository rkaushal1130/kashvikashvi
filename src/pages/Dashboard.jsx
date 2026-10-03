import React from 'react';
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

  return (
    <DistributorDashboard
      user={currentUser}
      onSignOut={logout}
      defaultNav={defaultNav}
    />
  );
}

export default Dashboard;
