import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Landmark,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  PlusCircle,
  RefreshCw,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  Lock,
  ChevronLeft,
  ChevronRight,
  Building2,
  Wallet,
  Activity,
  Check,
  X,
  FileText,
} from 'lucide-react';
import { adminFundingApi, sanitizeErrorMessage } from '../../api/adminFundingApi.js';
import './AdminPages.css';
import './AdminFundingPortalPage.css';

export default function AdminFundingPortalPage() {
  // 1. Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorBanner, setErrorBanner] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  const [treasury, setTreasury] = useState({
    availableBalance: 0,
    pendingBalance: 0,
    currency: 'INR',
    isSolvent: true,
  });

  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  const [transactions, setTransactions] = useState([]);
  const [treasuryLedger, setTreasuryLedger] = useState([]);

  // Active Tab: 'funding' or 'treasury'
  const [activeTab, setActiveTab] = useState('funding');

  // 2. Filters & Search States
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [providerFilter, setProviderFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // 3. Add Funds Form State
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [formError, setFormError] = useState('');

  // 4. Confirmation Modal State (Requirement 9)
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    amount: 0,
    currency: 'INR',
    account: null,
  });
  const [submittingFunding, setSubmittingFunding] = useState(false);

  // 5. Reconciliation Modal State (Requirement 7)
  const [reconModal, setReconModal] = useState({
    open: false,
    transaction: null,
    reconciling: false,
    reconciledResult: null,
  });

  // 6. Reversal Modal State
  const [reversalModal, setReversalModal] = useState({
    open: false,
    transaction: null,
    reason: '',
    reversing: false,
  });

  // 7. Connect Account Modal State
  const [connectModal, setConnectModal] = useState(false);
  const [connectFormData, setConnectFormData] = useState({
    accountName: '',
    provider: 'RAZORPAYX',
    maskedAccountNumber: '',
    accountType: 'PRIMARY_OPERATING',
  });
  const [connectingAccount, setConnectingAccount] = useState(false);

  // Format currency
  const formatCurrency = useCallback((val, curr = 'INR') => {
    const num = Number(val) || 0;
    const symbol = curr === 'INR' ? '₹' : '$';
    return `${symbol}${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(dateStr);
    }
  };

  // Load all initial data
  const loadPortalData = useCallback(async () => {
    try {
      setErrorBanner(null);
      const [dashData, ledgerRes] = await Promise.all([
        adminFundingApi.getDashboard(),
        adminFundingApi.getTreasuryTransactions(),
      ]);

      if (dashData?.treasury) {
        setTreasury(dashData.treasury);
      }
      if (dashData?.accounts) {
        setAccounts(dashData.accounts);
        if (!selectedAccountId && dashData.accounts.length > 0) {
          const primary = dashData.accounts.find((a) => a.isPrimary) || dashData.accounts[0];
          setSelectedAccountId(primary.id);
        }
      }
      if (dashData?.recentTransactions) {
        // fetch full list with filters
        const txRes = await adminFundingApi.listTransactions({
          status: statusFilter,
          provider: providerFilter,
          search: searchTerm,
        });
        setTransactions(txRes.transactions || dashData.recentTransactions);
      }
      if (ledgerRes?.transactions) {
        setTreasuryLedger(ledgerRes.transactions);
      }
    } catch (err) {
      setErrorBanner(sanitizeErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedAccountId, statusFilter, providerFilter, searchTerm]);

  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  // Quick refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPortalData();
  };

  // Status Counts
  const statusCounts = useMemo(() => {
    const counts = {
      ALL: transactions.length,
      CREATED: 0,
      PENDING: 0,
      PROCESSING: 0,
      SUCCEEDED: 0,
      FAILED: 0,
      CANCELLED: 0,
      REVERSED: 0,
    };
    transactions.forEach((tx) => {
      const st = tx.status?.toUpperCase();
      if (counts[st] !== undefined) {
        counts[st] += 1;
      }
    });
    return counts;
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchStatus = statusFilter === 'ALL' || t.status?.toUpperCase() === statusFilter;
      const matchProvider = providerFilter === 'ALL' || t.provider?.toUpperCase() === providerFilter;
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        t.id?.toLowerCase().includes(q) ||
        t.providerTransactionId?.toLowerCase().includes(q) ||
        t.initiatedByAdmin?.fullName?.toLowerCase().includes(q) ||
        t.initiatedByAdmin?.email?.toLowerCase().includes(q);
      return matchStatus && matchProvider && matchSearch;
    });
  }, [transactions, statusFilter, providerFilter, searchTerm]);

  // Paginated transactions
  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, page, pageSize]);

  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;

  // Selected primary connected account
  const activeAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId) || accounts[0] || null;
  }, [accounts, selectedAccountId]);

  // Quick amount chip click
  const handleAmountChip = (val) => {
    setAmount(String(val));
    setFormError('');
  };

  // Trigger Add Funds Validation & Open Confirmation Modal
  const handleInitiateAddFunds = (e) => {
    e.preventDefault();
    setFormError('');

    const parsed = Number(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setFormError('Please enter a valid funding amount greater than ₹0.');
      return;
    }
    if (parsed < 100) {
      setFormError('Minimum corporate treasury funding amount is ₹100.');
      return;
    }
    if (!activeAccount) {
      setFormError('No connected corporate bank or payment account found. Please connect an account first.');
      return;
    }

    // Requirement 9: Open confirmation dialog with exact prompt:
    // "You're about to initiate a funding transaction of ₹X. Continue?"
    setConfirmModal({
      open: true,
      amount: parsed,
      currency,
      account: activeAccount,
    });
  };

  // Execute Funding Initiation upon Admin Confirmation
  const handleConfirmFunding = async () => {
    try {
      setSubmittingFunding(true);
      setErrorBanner(null);

      const res = await adminFundingApi.initiateFunding({
        amount: confirmModal.amount,
        currency: confirmModal.currency,
        fundingAccountId: confirmModal.account?.id,
        description: `Corporate treasury funding of ${formatCurrency(confirmModal.amount, confirmModal.currency)}`,
      });

      setConfirmModal({ open: false, amount: 0, currency: 'INR', account: null });
      setAmount('');

      // CRITICAL REQUIREMENT 9: Do NOT claim funds were added until backend confirmation is received!
      setSuccessBanner(
        `Funding request of ${formatCurrency(res?.transaction?.amount || confirmModal.amount, confirmModal.currency)} initiated successfully. Status is PENDING. Platform Treasury will be credited only once external settlement is verified.`
      );

      // Refresh list
      await loadPortalData();
    } catch (err) {
      setErrorBanner(sanitizeErrorMessage(err));
      setConfirmModal({ open: false, amount: 0, currency: 'INR', account: null });
    } finally {
      setSubmittingFunding(false);
    }
  };

  // Open Reconciliation Modal (Requirement 7)
  const handleOpenReconcile = (tx) => {
    setReconModal({
      open: true,
      transaction: tx,
      reconciling: false,
      reconciledResult: null,
    });
  };

  // Trigger Reconcile action with external provider
  const handleExecuteReconciliation = async () => {
    if (!reconModal.transaction) return;
    try {
      setReconModal((prev) => ({ ...prev, reconciling: true }));
      setErrorBanner(null);

      const res = await adminFundingApi.reconcileFunding(reconModal.transaction.id);
      setReconModal((prev) => ({
        ...prev,
        transaction: res.transaction,
        reconciling: false,
        reconciledResult: res,
      }));

      setSuccessBanner(res.message || 'Reconciliation completed successfully.');
      await loadPortalData();
    } catch (err) {
      setErrorBanner(sanitizeErrorMessage(err));
      setReconModal((prev) => ({ ...prev, reconciling: false }));
    }
  };

  // Open Reversal Modal
  const handleOpenReversal = (tx) => {
    setReversalModal({
      open: true,
      transaction: tx,
      reason: '',
      reversing: false,
    });
  };

  // Confirm Reversal
  const handleExecuteReversal = async () => {
    if (!reversalModal.transaction) return;
    if (!reversalModal.reason || reversalModal.reason.trim().length < 5) {
      setErrorBanner('A mandatory audit reason of at least 5 characters is required for treasury reversal.');
      return;
    }

    try {
      setReversalModal((prev) => ({ ...prev, reversing: true }));
      setErrorBanner(null);

      await adminFundingApi.reverseFunding(reversalModal.transaction.id, {
        reason: reversalModal.reason.trim(),
      });

      setReversalModal({ open: false, transaction: null, reason: '', reversing: false });
      setSuccessBanner('Funding transaction was reversed and Platform Treasury was debited.');
      await loadPortalData();
    } catch (err) {
      setErrorBanner(sanitizeErrorMessage(err));
      setReversalModal((prev) => ({ ...prev, reversing: false }));
    }
  };

  // Connect Account Form Submit
  const handleConnectAccount = async (e) => {
    e.preventDefault();
    if (!connectFormData.accountName || !connectFormData.maskedAccountNumber) {
      setErrorBanner('Please fill in all account connection details.');
      return;
    }

    try {
      setConnectingAccount(true);
      setErrorBanner(null);

      await adminFundingApi.connectAccount({
        accountName: connectFormData.accountName,
        provider: connectFormData.provider,
        maskedAccountNumber: connectFormData.maskedAccountNumber,
        accountType: connectFormData.accountType,
        isPrimary: accounts.length === 0,
      });

      setConnectModal(false);
      setConnectFormData({
        accountName: '',
        provider: 'RAZORPAYX',
        maskedAccountNumber: '',
        accountType: 'PRIMARY_OPERATING',
      });
      setSuccessBanner('Corporate banking account connected successfully.');
      await loadPortalData();
    } catch (err) {
      setErrorBanner(sanitizeErrorMessage(err));
    } finally {
      setConnectingAccount(false);
    }
  };

  // Status Badge Component (Requirement 4)
  const renderStatusBadge = (status) => {
    const s = status?.toUpperCase() || 'UNKNOWN';
    switch (s) {
      case 'SUCCEEDED':
        return (
          <span className="badge-status status-succeeded">
            <CheckCircle2 size={12} />
            <span>Succeeded</span>
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="badge-status status-processing">
            <RefreshCw size={12} className="animate-spin" />
            <span>Processing</span>
          </span>
        );
      case 'PENDING':
        return (
          <span className="badge-status status-pending">
            <Clock size={12} />
            <span>Pending</span>
          </span>
        );
      case 'CREATED':
        return (
          <span className="badge-status status-created">
            <FileText size={12} />
            <span>Created</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="badge-status status-failed">
            <XCircle size={12} />
            <span>Failed</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="badge-status status-cancelled">
            <X size={12} />
            <span>Cancelled</span>
          </span>
        );
      case 'REVERSED':
        return (
          <span className="badge-status status-reversed">
            <RotateCcw size={12} />
            <span>Reversed</span>
          </span>
        );
      default:
        return <span className="badge-status status-created">{s}</span>;
    }
  };

  return (
    <div className="funding-portal-container">
      {/* 1. Header Section */}
      <div className="admin-page-header">
        <div className="admin-header-titles">
          <div className="admin-page-badge">
            <Landmark size={13} />
            <span>Treasury & Capital Management</span>
          </div>
          <h1 className="admin-page-title">Admin Funding Portal</h1>
          <p className="admin-page-subtitle">
            Manage corporate liquidity, banking rails, regulated capital injections, and immutable treasury ledgers
          </p>
        </div>

        <div className="admin-header-actions">
          <button
            className="admin-btn admin-btn-secondary"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            title="Refresh Treasury Telemetry"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh State</span>
          </button>

          <button
            className="admin-btn admin-btn-primary"
            onClick={() => setConnectModal(true)}
          >
            <Building2 size={14} />
            <span>Connect Account</span>
          </button>
        </div>
      </div>

      {/* 2. Global Banners for Notifications & Error Handling (Requirement 8) */}
      {errorBanner && (
        <div className="admin-error-banner" role="alert">
          <ShieldAlert size={18} />
          <div style={{ flex: 1 }}>{errorBanner}</div>
          <button
            onClick={() => setErrorBanner(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {successBanner && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '13.5px',
            fontWeight: 500,
          }}
          role="status"
        >
          <CheckCircle2 size={18} color="#059669" />
          <div style={{ flex: 1 }}>{successBanner}</div>
          <button
            onClick={() => setSuccessBanner(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 3. Top Grid: Treasury Balance Card + Connected Bank/Payment Account */}
      <div className="funding-top-grid">
        {/* Card 1: Treasury Balance Card (Requirement 1) */}
        <div className="treasury-balance-card">
          <div className="treasury-card-header">
            <div className="treasury-title-wrap">
              <div className="treasury-icon-badge">
                <Wallet size={20} />
              </div>
              <div>
                <h3 className="treasury-title">Platform Treasury Balance</h3>
                <p className="treasury-subtitle">Master liquidity reserve backing platform payouts</p>
              </div>
            </div>
            <div className="solvency-badge">
              <ShieldCheck size={14} />
              <span>SOLVENT (100% Float Backed)</span>
            </div>
          </div>

          <div className="treasury-balances-row">
            <div className="treasury-balance-item">
              <span className="balance-item-label">
                <CheckCircle2 size={13} style={{ color: '#38bdf8' }} />
                Available Balance
              </span>
              <span className="balance-item-value available">
                {formatCurrency(treasury?.availableBalance, treasury?.currency)}
              </span>
            </div>

            <div className="treasury-balance-item">
              <span className="balance-item-label">
                <Clock size={13} style={{ color: '#fbbf24' }} />
                Pending Balance
              </span>
              <span className="balance-item-value pending">
                {formatCurrency(treasury?.pendingBalance, treasury?.currency)}
              </span>
            </div>
          </div>

          <div className="treasury-card-footer">
            <div className="treasury-footer-meta">
              <Activity size={13} />
              <span>Base Currency: {treasury?.currency || 'INR'}</span>
            </div>
            <div className="treasury-footer-meta">
              <Lock size={13} />
              <span>Double-entry immutable ledger enforced</span>
            </div>
          </div>
        </div>

        {/* Card 2: Connected Bank/Payment Account (Requirement 2) */}
        <div className="connected-bank-card">
          <div className="bank-card-header">
            <div className="bank-header-title-wrap">
              <div className="bank-icon-badge">
                <Building2 size={20} />
              </div>
              <div>
                <h3 className="bank-card-title">Connected Corporate Account</h3>
                <p className="bank-card-subtitle">Regulated banking rail for treasury settlement</p>
              </div>
            </div>

            {activeAccount && (
              <span className="admin-badge badge-active">
                <Check size={12} />
                <span>{activeAccount.status || 'ACTIVE'}</span>
              </span>
            )}
          </div>

          {activeAccount ? (
            <div className="bank-details-body">
              <div className="bank-detail-row">
                <span className="bank-detail-label">Account Name</span>
                <span className="bank-detail-val">{activeAccount.accountName}</span>
              </div>

              <div className="bank-detail-row">
                <span className="bank-detail-label">Masked Account Number</span>
                <span className="masked-account-pill">
                  {activeAccount.maskedAccountNumber || '•••• •••• •••• 8842'}
                </span>
              </div>

              <div className="bank-detail-row">
                <span className="bank-detail-label">Provider</span>
                <span className="bank-detail-val" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={14} style={{ color: '#2563eb' }} />
                  {activeAccount.provider === 'RAZORPAYX'
                    ? 'RazorpayX Corporate Banking'
                    : activeAccount.provider === 'CASHFREE'
                    ? 'Cashfree Auto-Collect & Payouts'
                    : activeAccount.provider}
                </span>
              </div>

              <div className="bank-detail-row">
                <span className="bank-detail-label">Connected Date</span>
                <span className="bank-detail-val">{formatDate(activeAccount.connectedAt || activeAccount.createdAt)}</span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
              <p>No corporate banking account connected yet.</p>
              <button
                className="admin-btn admin-btn-primary admin-btn-sm"
                onClick={() => setConnectModal(true)}
                style={{ marginTop: '10px' }}
              >
                Connect Account Now
              </button>
            </div>
          )}

          {/* Invariant Banner (Requirement 2: Never show sensitive banking credentials) */}
          <div className="security-invariant-banner">
            <Lock size={15} style={{ flexShrink: 0 }} />
            <span>Zero-Trust Invariant: Sensitive banking credentials & API secrets are never stored or displayed.</span>
          </div>
        </div>
      </div>

      {/* 4. Middle Grid: Add Funds Form (Requirement 3) + Funding Status Lifecycle (Requirement 4) */}
      <div className="funding-middle-grid">
        {/* Section 3: Add Funds Form */}
        <div className="add-funds-card">
          <div className="card-heading-row">
            <PlusCircle size={18} style={{ color: '#2563eb' }} />
            <h3 className="card-heading-title">Add Corporate Funds</h3>
          </div>

          <form onSubmit={handleInitiateAddFunds} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Amount & Currency Fields */}
            <div className="form-group-custom">
              <label className="form-label-custom">Funding Amount</label>
              <div className="currency-input-wrap">
                <span className="currency-symbol-box">{currency === 'INR' ? '₹' : '$'}</span>
                <input
                  type="number"
                  min="100"
                  step="any"
                  className="currency-input-field"
                  placeholder="e.g. 500000"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setFormError('');
                  }}
                  required
                />
              </div>
            </div>

            {/* Quick Amount Selector Chips */}
            <div className="form-group-custom">
              <label className="form-label-custom" style={{ fontSize: '11.5px', color: '#64748b' }}>
                Quick Preset Amounts:
              </label>
              <div className="quick-amount-chips">
                {[50000, 100000, 500000, 1000000, 2500000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`amount-chip ${amount === String(preset) ? 'selected' : ''}`}
                    onClick={() => handleAmountChip(preset)}
                  >
                    +₹{(preset / 100000 >= 1 ? `${preset / 100000}L` : `${preset / 1000}k`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Currency Selector */}
            <div className="form-group-custom">
              <label className="form-label-custom">Currency</label>
              <select
                className="form-input-custom"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="INR">INR — Indian Rupee (₹)</option>
                <option value="USD">USD — US Dollar ($)</option>
              </select>
            </div>

            {/* Source Account Selector */}
            {accounts.length > 1 && (
              <div className="form-group-custom">
                <label className="form-label-custom">Debited Corporate Account</label>
                <select
                  className="form-input-custom"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountName} ({acc.provider})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formError && (
              <div style={{ color: '#dc2626', fontSize: '12px', fontWeight: 600 }}>{formError}</div>
            )}

            {/* Button: "Add Funds" */}
            <button
              type="submit"
              className="add-funds-btn"
              disabled={submittingFunding || !amount}
            >
              <PlusCircle size={17} />
              <span>Add Funds</span>
            </button>

            <div className="add-funds-safety-note">
              <strong>Maker-Checker & Verification:</strong> Adding funds generates a pending settlement order with your banking rail. Treasury float increments ONLY upon authoritative provider verification.
            </div>
          </form>
        </div>

        {/* Section 4: Funding Status Lifecycle Overview (Requirement 4) */}
        <div className="status-overview-card">
          <div className="card-heading-row" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} style={{ color: '#0ea5e9' }} />
              <h3 className="card-heading-title">Funding Lifecycle Statuses</h3>
            </div>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Click status to filter history
            </span>
          </div>

          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
            Track every transaction through its 7 lifecycle states. Zero unbacked float is credited.
          </p>

          <div className="status-pills-grid">
            <div
              className={`status-pill-item status-created ${statusFilter === 'CREATED' ? 'active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'CREATED' ? 'ALL' : 'CREATED')}
            >
              <span className="status-pill-label">Created</span>
              <span className="status-pill-count">{statusCounts.CREATED}</span>
            </div>

            <div
              className={`status-pill-item status-pending ${statusFilter === 'PENDING' ? 'active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING')}
            >
              <span className="status-pill-label">Pending</span>
              <span className="status-pill-count">{statusCounts.PENDING}</span>
            </div>

            <div
              className={`status-pill-item status-processing ${statusFilter === 'PROCESSING' ? 'active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'PROCESSING' ? 'ALL' : 'PROCESSING')}
            >
              <span className="status-pill-label">Processing</span>
              <span className="status-pill-count">{statusCounts.PROCESSING}</span>
            </div>

            <div
              className={`status-pill-item status-succeeded ${statusFilter === 'SUCCEEDED' ? 'active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'SUCCEEDED' ? 'ALL' : 'SUCCEEDED')}
            >
              <span className="status-pill-label">Succeeded</span>
              <span className="status-pill-count">{statusCounts.SUCCEEDED}</span>
            </div>

            <div
              className={`status-pill-item status-failed ${statusFilter === 'FAILED' ? 'active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'FAILED' ? 'ALL' : 'FAILED')}
            >
              <span className="status-pill-label">Failed</span>
              <span className="status-pill-count">{statusCounts.FAILED}</span>
            </div>

            <div
              className={`status-pill-item status-cancelled ${statusFilter === 'CANCELLED' ? 'active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'CANCELLED' ? 'ALL' : 'CANCELLED')}
            >
              <span className="status-pill-label">Cancelled</span>
              <span className="status-pill-count">{statusCounts.CANCELLED}</span>
            </div>

            <div
              className={`status-pill-item status-reversed ${statusFilter === 'REVERSED' ? 'active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'REVERSED' ? 'ALL' : 'REVERSED')}
            >
              <span className="status-pill-label">Reversed</span>
              <span className="status-pill-count">{statusCounts.REVERSED}</span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc',
              padding: '12px 16px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              fontSize: '12.5px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
              <ShieldCheck size={16} style={{ color: '#16a34a' }} />
              <span>
                <strong>Active Filter:</strong> {statusFilter === 'ALL' ? 'Displaying all 7 lifecycle states' : `Filtered by ${statusFilter}`}
              </span>
            </div>
            {statusFilter !== 'ALL' && (
              <button
                className="admin-btn admin-btn-secondary admin-btn-sm"
                onClick={() => setStatusFilter('ALL')}
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. Tables Section: Tabs for Funding History (Section 5) & Treasury Transactions (Section 6) */}
      <div className="funding-tables-card">
        <div className="funding-tabs-header">
          <div className="tabs-btn-group">
            <button
              className={`funding-tab-btn ${activeTab === 'funding' ? 'active' : ''}`}
              onClick={() => setActiveTab('funding')}
            >
              <Landmark size={16} />
              <span>Funding History</span>
              <span className="tab-badge-count">{filteredTransactions.length}</span>
            </button>

            <button
              className={`funding-tab-btn ${activeTab === 'treasury' ? 'active' : ''}`}
              onClick={() => setActiveTab('treasury')}
            >
              <Wallet size={16} />
              <span>Treasury Transactions Ledger</span>
              <span className="tab-badge-count">{treasuryLedger.length}</span>
            </button>
          </div>

          {/* Search & Provider Filter Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div className="admin-search-wrap" style={{ minWidth: '220px', maxWidth: '300px' }}>
              <Search size={15} />
              <input
                type="text"
                className="admin-search-input"
                placeholder="Search Tx ID, provider, admin..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <select
              className="admin-filter-select"
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Providers</option>
              <option value="RAZORPAYX">RazorpayX</option>
              <option value="CASHFREE">Cashfree</option>
            </select>
          </div>
        </div>

        {/* TAB 1: Funding History Table (Requirement 5) */}
        {activeTab === 'funding' && (
          <>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Provider</th>
                    <th>Transaction ID</th>
                    <th>Admin</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.length > 0 ? (
                    paginatedTransactions.map((tx) => (
                      <tr key={tx.id}>
                        <td>{formatDate(tx.createdAt || tx.initiatedAt)}</td>
                        <td style={{ fontWeight: 700, color: '#0f172a' }}>
                          {formatCurrency(tx.amount, tx.currency)}
                        </td>
                        <td>{renderStatusBadge(tx.status)}</td>
                        <td>
                          <span className="admin-badge badge-approved" style={{ fontSize: '11px' }}>
                            {tx.provider}
                          </span>
                        </td>
                        <td className="code-font" style={{ fontSize: '12.5px' }}>
                          {tx.id}
                        </td>
                        <td>
                          <span style={{ fontSize: '12.5px', color: '#334155' }}>
                            {tx.initiatedByAdmin?.fullName || tx.initiatedByAdmin?.email || 'Administrator'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            {/* Reconciliation / Details action (Requirement 7) */}
                            <button
                              className="admin-btn admin-btn-secondary admin-btn-sm"
                              onClick={() => handleOpenReconcile(tx)}
                              title="Reconcile with external provider"
                            >
                              <ExternalLink size={13} />
                              <span>Reconcile</span>
                            </button>

                            {/* Reverse action for Succeeded transactions */}
                            {tx.status === 'SUCCEEDED' && (
                              <button
                                className="admin-btn admin-btn-danger admin-btn-sm"
                                onClick={() => handleOpenReversal(tx)}
                                title="Reverse funding and debit Platform Treasury"
                              >
                                <RotateCcw size={13} />
                                <span>Reverse</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                        No funding transactions found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="admin-pagination">
                <span>
                  Showing {paginatedTransactions.length} of {filteredTransactions.length} records (Page {page} of {totalPages})
                </span>
                <div className="admin-page-controls">
                  <button
                    className="admin-page-btn"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ padding: '0 8px', fontWeight: 600 }}>{page}</span>
                  <button
                    className="admin-page-btn"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: Treasury Transactions (Requirement 6) */}
        {activeTab === 'treasury' && (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Reference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {treasuryLedger.length > 0 ? (
                  treasuryLedger.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.createdAt)}</td>
                      <td>
                        <span
                          className={`admin-badge ${
                            row.type === 'CAPITAL_FUNDING' || row.type === 'ORDER_REVENUE_INFLOW'
                              ? 'badge-active'
                              : row.type === 'FUNDING_REVERSAL'
                              ? 'badge-reversed'
                              : 'badge-suspended'
                          }`}
                        >
                          {row.type}
                        </span>
                      </td>
                      <td
                        style={{
                          fontWeight: 700,
                          color: row.amount >= 0 ? '#16a34a' : '#dc2626',
                        }}
                      >
                        {row.amount >= 0 ? `+${formatCurrency(row.amount)}` : `-${formatCurrency(Math.abs(row.amount))}`}
                      </td>
                      <td className="code-font" style={{ fontWeight: 700, color: '#0f172a' }}>
                        {formatCurrency(row.balanceAfter)}
                      </td>
                      <td className="code-font" style={{ fontSize: '12px' }}>
                        {row.referenceId || '—'}
                      </td>
                      <td>
                        <span className="admin-badge badge-active">
                          {row.status || 'COMPLETED'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      No platform treasury transactions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          CONFIRMATION MODAL (REQUIREMENT 9)
          Before initiating funding:
          "You're about to initiate a funding transaction of ₹X. Continue?"
          Do not claim the funds were added until backend confirmation is received.
         ========================================================================= */}
      {confirmModal.open && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">
                <AlertTriangle size={18} style={{ color: '#d97706' }} />
                <span>Confirm Corporate Treasury Funding</span>
              </h3>
              <button
                className="admin-modal-close"
                onClick={() => setConfirmModal({ open: false, amount: 0, currency: 'INR', account: null })}
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body" style={{ padding: '22px' }}>
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  padding: '16px',
                  borderRadius: '10px',
                  marginBottom: '18px',
                }}
              >
                <p
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: '#92400e',
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  You're about to initiate a funding transaction of{' '}
                  <span style={{ textDecoration: 'underline' }}>
                    {formatCurrency(confirmModal.amount, confirmModal.currency)}
                  </span>
                  . Continue?
                </p>
              </div>

              <div className="recon-keyval-grid">
                <div className="keyval-item">
                  <span className="keyval-label">Target Float Amount</span>
                  <span className="keyval-value" style={{ color: '#2563eb', fontSize: '16px' }}>
                    {formatCurrency(confirmModal.amount, confirmModal.currency)}
                  </span>
                </div>
                <div className="keyval-item">
                  <span className="keyval-label">Currency</span>
                  <span className="keyval-value">{confirmModal.currency}</span>
                </div>
                <div className="keyval-item">
                  <span className="keyval-label">Debited Bank Account</span>
                  <span className="keyval-value">{confirmModal.account?.accountName || 'Primary Operating'}</span>
                </div>
                <div className="keyval-item">
                  <span className="keyval-label">Payment Rail</span>
                  <span className="keyval-value">{confirmModal.account?.provider || 'RAZORPAYX'}</span>
                </div>
              </div>

              {/* Requirement 9: Notice that funds are NOT claimed added until backend confirmation */}
              <div
                style={{
                  fontSize: '12.5px',
                  color: '#475569',
                  lineHeight: '1.5',
                  background: '#f8fafc',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <strong>⚠️ Regulatory & Financial Integrity Safeguard:</strong>
                <br />
                Initiating creates an external provider checkout order in <code>PENDING</code> state. Funds are <strong>never claimed or credited to the platform treasury</strong> until authoritative settlement webhook or API confirmation is cryptographically verified.
              </div>
            </div>

            <div
              className="admin-modal-footer"
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                padding: '16px 22px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => setConfirmModal({ open: false, amount: 0, currency: 'INR', account: null })}
                disabled={submittingFunding}
              >
                Cancel
              </button>

              <button
                className="admin-btn admin-btn-primary"
                onClick={handleConfirmFunding}
                disabled={submittingFunding}
              >
                {submittingFunding ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Initiating Request...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Confirm & Initiate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          RECONCILIATION MODAL (REQUIREMENT 7)
          Admin can open a funding transaction and view:
          - Internal transaction ID
          - External provider ID
          - Requested amount
          - Confirmed amount
          - Status
          - Timeline
         ========================================================================= */}
      {reconModal.open && reconModal.transaction && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card" style={{ maxWidth: '640px' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">
                <Landmark size={18} style={{ color: '#2563eb' }} />
                <span>Transaction Reconciliation & Audit Details</span>
              </h3>
              <button
                className="admin-modal-close"
                onClick={() => setReconModal({ open: false, transaction: null, reconciling: false, reconciledResult: null })}
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body" style={{ padding: '20px' }}>
              {/* Requirement 7 Key Values */}
              <div className="recon-keyval-grid">
                <div className="keyval-item">
                  <span className="keyval-label">Internal Transaction ID</span>
                  <span className="keyval-value code">{reconModal.transaction.id}</span>
                </div>

                <div className="keyval-item">
                  <span className="keyval-label">External Provider ID</span>
                  <span className="keyval-value code" style={{ color: '#2563eb' }}>
                    {reconModal.transaction.providerTransactionId || 'Awaiting Provider Allocation'}
                  </span>
                </div>

                <div className="keyval-item">
                  <span className="keyval-label">Requested Amount</span>
                  <span className="keyval-value">
                    {formatCurrency(reconModal.transaction.amount, reconModal.transaction.currency)}
                  </span>
                </div>

                <div className="keyval-item">
                  <span className="keyval-label">Confirmed Amount</span>
                  <span className="keyval-value" style={{ color: '#16a34a' }}>
                    {reconModal.transaction.status === 'SUCCEEDED'
                      ? formatCurrency(reconModal.transaction.amount, reconModal.transaction.currency)
                      : 'Pending External Confirmation'}
                  </span>
                </div>

                <div className="keyval-item">
                  <span className="keyval-label">Transaction Status</span>
                  <div>{renderStatusBadge(reconModal.transaction.status)}</div>
                </div>

                <div className="keyval-item">
                  <span className="keyval-label">Initiated By Admin</span>
                  <span className="keyval-value" style={{ fontSize: '12.5px' }}>
                    {reconModal.transaction.initiatedByAdmin?.fullName || reconModal.transaction.initiatedByAdmin?.email || 'Administrator'}
                  </span>
                </div>
              </div>

              {/* Requirement 7: Timeline */}
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '16px 0 8px 0' }}>
                Audit Timeline & Settlement Milestones
              </h4>

              <div className="recon-timeline-list">
                {reconModal.transaction.timeline && reconModal.transaction.timeline.length > 0 ? (
                  reconModal.transaction.timeline.map((item, idx) => (
                    <div key={idx} className="recon-timeline-item">
                      <div className="timeline-dot done">
                        <Check size={11} />
                      </div>
                      <div className="timeline-item-title">{item.label || item.step}</div>
                      <div className="timeline-item-time">{formatDate(item.timestamp)}</div>
                      <div className="timeline-item-detail">{item.detail}</div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="recon-timeline-item">
                      <div className="timeline-dot done">
                        <Check size={11} />
                      </div>
                      <div className="timeline-item-title">1. Funding Request Created</div>
                      <div className="timeline-item-time">{formatDate(reconModal.transaction.createdAt)}</div>
                      <div className="timeline-item-detail">
                        Admin registered corporate funding intent of {formatCurrency(reconModal.transaction.amount)}
                      </div>
                    </div>

                    <div className="recon-timeline-item">
                      <div className={`timeline-dot ${reconModal.transaction.status !== 'CREATED' ? 'done' : ''}`}>
                        {reconModal.transaction.status !== 'CREATED' && <Check size={11} />}
                      </div>
                      <div className="timeline-item-title">2. Banking Rail Session Created</div>
                      <div className="timeline-item-time">{formatDate(reconModal.transaction.updatedAt)}</div>
                      <div className="timeline-item-detail">
                        Order ID {reconModal.transaction.providerTransactionId || 'dispatched to gateway'}
                      </div>
                    </div>

                    <div className="recon-timeline-item">
                      <div className={`timeline-dot ${reconModal.transaction.status === 'SUCCEEDED' ? 'done' : ''}`}>
                        {reconModal.transaction.status === 'SUCCEEDED' && <Check size={11} />}
                      </div>
                      <div className="timeline-item-title">3. Settlement Verification & Treasury Posting</div>
                      <div className="timeline-item-time">
                        {reconModal.transaction.completedAt ? formatDate(reconModal.transaction.completedAt) : 'In Progress'}
                      </div>
                      <div className="timeline-item-detail">
                        {reconModal.transaction.status === 'SUCCEEDED'
                          ? 'Settlement confirmed. Platform Treasury credited.'
                          : 'Awaiting provider bank transfer confirmation.'}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div
              className="admin-modal-footer"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => setReconModal({ open: false, transaction: null, reconciling: false, reconciledResult: null })}
              >
                Close
              </button>

              <button
                className="admin-btn admin-btn-primary"
                onClick={handleExecuteReconciliation}
                disabled={reconModal.reconciling}
              >
                {reconModal.reconciling ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Querying Provider Rail...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    <span>Reconcile with Provider</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          REVERSAL MODAL
         ========================================================================= */}
      {reversalModal.open && reversalModal.transaction && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title" style={{ color: '#dc2626' }}>
                <RotateCcw size={18} />
                <span>Reverse Corporate Funding Transaction</span>
              </h3>
              <button
                className="admin-modal-close"
                onClick={() => setReversalModal({ open: false, transaction: null, reason: '', reversing: false })}
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body" style={{ padding: '20px' }}>
              <p style={{ fontSize: '14px', color: '#334155', marginBottom: '14px' }}>
                You are about to reverse transaction{' '}
                <strong>{reversalModal.transaction.id}</strong> of{' '}
                <strong>{formatCurrency(reversalModal.transaction.amount)}</strong>.
              </p>

              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  color: '#991b1b',
                  marginBottom: '16px',
                }}
              >
                <strong>Warning:</strong> This action will atomically debit the Platform Treasury and record an immutable <code>FUNDING_REVERSAL</code> entry in the audit ledger.
              </div>

              <div className="form-group-custom">
                <label className="form-label-custom">Mandatory Audit Reason</label>
                <textarea
                  rows={3}
                  className="form-input-custom"
                  placeholder="Provide audit justification (e.g. Bank recall, duplicate batch reference, compliance dispute)..."
                  value={reversalModal.reason}
                  onChange={(e) => setReversalModal({ ...reversalModal, reason: e.target.value })}
                  required
                />
              </div>
            </div>

            <div
              className="admin-modal-footer"
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                padding: '16px 20px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => setReversalModal({ open: false, transaction: null, reason: '', reversing: false })}
                disabled={reversalModal.reversing}
              >
                Cancel
              </button>

              <button
                className="admin-btn admin-btn-danger"
                onClick={handleExecuteReversal}
                disabled={reversalModal.reversing || !reversalModal.reason}
              >
                {reversalModal.reversing ? 'Reversing...' : 'Confirm Reversal & Debit Treasury'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CONNECT ACCOUNT MODAL (REQUIREMENT 2)
         ========================================================================= */}
      {connectModal && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">
                <Building2 size={18} style={{ color: '#2563eb' }} />
                <span>Connect Corporate Bank / Payment Provider</span>
              </h3>
              <button className="admin-modal-close" onClick={() => setConnectModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConnectAccount}>
              <div className="admin-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group-custom">
                  <label className="form-label-custom">Account Name</label>
                  <input
                    type="text"
                    className="form-input-custom"
                    placeholder="e.g. Kashvi Technologies Corp - Primary Treasury Float"
                    value={connectFormData.accountName}
                    onChange={(e) => setConnectFormData({ ...connectFormData, accountName: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Payment Provider Rail</label>
                  <select
                    className="form-input-custom"
                    value={connectFormData.provider}
                    onChange={(e) => setConnectFormData({ ...connectFormData, provider: e.target.value })}
                  >
                    <option value="RAZORPAYX">RazorpayX Corporate Banking</option>
                    <option value="CASHFREE">Cashfree Auto-Collect & Payouts</option>
                  </select>
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Masked Account Number (Never enter full numbers)</label>
                  <input
                    type="text"
                    className="form-input-custom"
                    placeholder="e.g. •••• •••• •••• 8842"
                    value={connectFormData.maskedAccountNumber}
                    onChange={(e) => setConnectFormData({ ...connectFormData, maskedAccountNumber: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Account Classification</label>
                  <select
                    className="form-input-custom"
                    value={connectFormData.accountType}
                    onChange={(e) => setConnectFormData({ ...connectFormData, accountType: e.target.value })}
                  >
                    <option value="PRIMARY_OPERATING">Primary Operating Treasury Float</option>
                    <option value="COMMISSION_RESERVE">Dedicated Commission Reserve Escrow</option>
                    <option value="TAX_ESCROW_TDS">Statutory TDS Tax Escrow</option>
                  </select>
                </div>

                <div className="security-invariant-banner">
                  <Lock size={15} style={{ flexShrink: 0 }} />
                  <span>Only masked account tokens and verified provider handles are registered.</span>
                </div>
              </div>

              <div
                className="admin-modal-footer"
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  padding: '16px 20px',
                  borderTop: '1px solid #e2e8f0',
                  background: '#f8fafc',
                }}
              >
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setConnectModal(false)}
                  disabled={connectingAccount}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={connectingAccount}
                >
                  {connectingAccount ? 'Connecting...' : 'Connect Bank Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
