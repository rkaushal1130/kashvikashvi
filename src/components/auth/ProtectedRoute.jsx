import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ShieldAlert, Loader2 } from 'lucide-react';

export function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '16px',
        color: '#64748b'
      }}>
        <Loader2 size={36} className="animate-spin" style={{ color: '#2563eb' }} />
        <p style={{ fontSize: '15px', fontWeight: 500 }}>Verifying session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && !isAdmin) {
    return (
      <div style={{
        maxWidth: '500px',
        margin: '80px auto',
        padding: '32px',
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #fee2e2',
        textAlign: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#fef2f2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          color: '#ef4444'
        }}>
          <ShieldAlert size={28} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
          403 — Access Denied
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.5', marginBottom: '24px' }}>
          This section is restricted to administrative personnel only. Your account does not have sufficient permissions to view this resource.
        </p>
        <button
          onClick={() => window.history.back()}
          style={{
            padding: '10px 20px',
            background: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return children;
}

export default ProtectedRoute;
