import React, { Component } from 'react';
import { AlertTriangle, RefreshCw, Home, LayoutDashboard } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: '70vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '520px',
              width: '100%',
              background: '#ffffff',
              borderRadius: '16px',
              padding: '36px 32px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #fee2e2',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                background: '#fef2f2',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                color: '#dc2626',
              }}
            >
              <AlertTriangle size={32} />
            </div>

            <h2
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: '#1e293b',
                marginBottom: '10px',
              }}
            >
              Something went wrong
            </h2>

            <p
              style={{
                fontSize: '14px',
                color: '#64748b',
                lineHeight: 1.6,
                marginBottom: '24px',
              }}
            >
              An unexpected error occurred while rendering this view. Your session and account data
              remain completely safe.
            </p>

            {this.state.error && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '12px',
                  color: '#dc2626',
                  fontFamily: 'monospace',
                  textAlign: 'left',
                  marginBottom: '24px',
                  overflowX: 'auto',
                  maxHeight: '120px',
                }}
              >
                {this.state.error.toString()}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={16} />
                <span>Reload Page</span>
              </button>

              <a
                href="/dashboard"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                <LayoutDashboard size={16} />
                <span>Go to Dashboard</span>
              </a>

              <a
                href="/"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  background: '#ffffff',
                  color: '#64748b',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                <Home size={16} />
                <span>Home</span>
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
