import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';

// Public pages
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Contact from './pages/Contact';
import Join from './pages/Join';
import Login from './pages/Login';
import Register from './pages/Register';

// Protected Distributor Portal Pages
import Dashboard from './pages/Dashboard';
import NetworkPage from './pages/NetworkPage';
import NetworkTreePage from './pages/NetworkTreePage';
import BusinessVolumePage from './pages/BusinessVolumePage';
import CommissionPage from './pages/CommissionPage';
import ProfilePage from './pages/ProfilePage';

// Admin Pages (Prompt 8)
import AdminDashboard from './pages/admin/AdminDashboard';
import DistributorManagementPage from './pages/admin/DistributorManagementPage';
import DistributorDetailPage from './pages/admin/DistributorDetailPage';
import AdminNetworkPage from './pages/admin/AdminNetworkPage';
import BusinessVolumeManagementPage from './pages/admin/BusinessVolumeManagementPage';
import CommissionManagementPage from './pages/admin/CommissionManagementPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import CommissionSettingsPage from './pages/admin/CommissionSettingsPage';

function AppContent() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const isPortalRoute = [
    '/dashboard',
    '/network',
    '/network-tree',
    '/business-volume',
    '/commissions',
    '/profile',
    '/admin',
  ].some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));

  const isDashboardView = isPortalRoute && isAuthenticated;

  return (
    <div className={`app-wrapper ${isDashboardView ? 'dashboard-mode' : ''}`}>
      {!isDashboardView && <Navbar />}
      <main className={`main-content ${isDashboardView ? 'main-dashboard-canvas' : ''}`}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/join" element={<Join />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Distributor Operations Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/network"
            element={
              <ProtectedRoute>
                <Dashboard defaultNav="network_tree" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/network-tree"
            element={
              <ProtectedRoute>
                <Dashboard defaultNav="network_tree" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/business-volume"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <BusinessVolumePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/commissions"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <CommissionPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ProfilePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Protected Admin Console Routes (Prompt 8) */}
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/distributors"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout>
                  <DistributorManagementPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/distributors/:id"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout>
                  <DistributorDetailPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/network"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout>
                  <AdminNetworkPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/network-tree"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout>
                  <AdminNetworkPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/business-volume"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout>
                  <BusinessVolumeManagementPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/commissions"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout>
                  <CommissionManagementPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit-logs"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout>
                  <AuditLogsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout>
                  <CommissionSettingsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings/commission"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout>
                  <CommissionSettingsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/network/:distributorId"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout>
                  <AdminNetworkPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* Catch-All Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isDashboardView && <Footer />}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
