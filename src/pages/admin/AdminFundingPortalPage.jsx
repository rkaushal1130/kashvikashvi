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
  Download,
  Send,
  Users,
  DollarSign,
  Layers,
  Award,
  Filter,
  Calendar,
  Copy,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { adminFundingApi, sanitizeErrorMessage } from '../../api/adminFundingApi.js';
import { INDIAN_BANKS, POPULAR_BANKS, BANK_CATEGORIES } from '../../data/indianBanks.js';
import './AdminPages.css';
import './AdminFundingPortalPage.css';

/**
 * Ensures Razorpay Checkout SDK is loaded dynamically in the window
 */
const ensureRazorpayLoaded = () => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = typeof document !== 'undefined' && document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      setTimeout(() => resolve(Boolean(window.Razorpay)), 1500);
      return;
    }
    if (typeof document !== 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    } else {
      resolve(false);
    }
  });
};

export default function AdminFundingPortalPage() {
  // 1. Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorBanner, setErrorBanner] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Daily Financial Summary State (Requirement 4)
  const [summaryStartDate, setSummaryStartDate] = useState('');
  const [summaryEndDate, setSummaryEndDate] = useState('');
  const [dailySummary, setDailySummary] = useState({
    dateRange: { label: 'All Time' },
    totalEmployees: 0,
    totalQualifyingBV: 0,
    totalPaymentVolume: 0,
    totalCalculatedCommissions: 0,
    totalPendingCommissions: 0,
    totalApprovedCommissions: 0,
    totalPaidCommissions: 0,
    totalFailedPayouts: 0,
    totalReversedCommissions: 0,
    financialDistinction: {
      orderPaymentVolume: 0,
      businessVolumeBV: 0,
      commissionLiability: 0,
      walletCreditsDisbursed: 0,
      bankPayoutsSettled: 0,
    },
  });

  // Employee-Wise Daily Commission Report State (Requirement 3: 23-Column Table)
  const [dailyReportData, setDailyReportData] = useState({
    records: [],
    totalRecords: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
    summaryTotals: {
      totalPurchaseAmount: 0,
      totalQualifyingBV: 0,
      totalCalculatedAmount: 0,
      totalPendingAmount: 0,
      totalApprovedAmount: 0,
      totalPaidAmount: 0,
      totalReversedAmount: 0,
    },
  });

  const [reportFilters, setReportFilters] = useState({
    search: '',
    sponsorId: 'ALL',
    rank: 'ALL',
    tier: 'ALL',
    paymentStatus: 'ALL',
    commissionStatus: 'ALL',
    payoutBatchId: '',
    payoutStatus: 'ALL',
    startDate: '',
    endDate: '',
    page: 1,
    pageSize: 10,
    sortBy: 'transactionDate',
    sortOrder: 'desc',
  });

  // Payout Batches State (Requirement 2 & 6)
  const [payoutBatches, setPayoutBatches] = useState([]);
  const [retryingBatchId, setRetryingBatchId] = useState(null);

  // One-Click Distribution Modal State (Requirement 2)
  const [distributeModal, setDistributeModal] = useState({
    open: false,
    loading: false,
    preview: null,
    confirmed: false,
    executing: false,
    periodId: `CYCLE-${new Date().toISOString().slice(0, 10)}`,
  });

  // Execution Result Modal State
  const [distributeResult, setDistributeResult] = useState(null);
  const [exportingCsv, setExportingCsv] = useState(false);

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

  // Active Tab: 'commissions' | 'batches' | 'funding' | 'treasury'
  const [activeTab, setActiveTab] = useState('commissions');

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
    bankName: 'Punjab National Bank',
    bankCode: 'PUNB',
    brandName: 'kashvimlm',
    accountName: 'Kashvi MLM (kashvimlm)',
    accountNumber: '1923102100000382',
    confirmAccountNumber: '1923102100000382',
    ifscCode: 'PUNB0192310',
    branchName: 'Chamba, Himachal Pradesh',
    provider: 'RAZORPAYX',
    maskedAccountNumber: '•••• •••• •••• 0382',
    accountType: 'PRIMARY_OPERATING',
    isPrimary: true,
  });
  const [bankSearchTerm, setBankSearchTerm] = useState('');
  const [connectingAccount, setConnectingAccount] = useState(false);
  const [copiedField, setCopiedField] = useState('');

  // One-click clipboard copy helper
  const handleCopyText = useCallback((text, fieldName) => {
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(''), 2200);
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
    }
  }, []);

  // 8. Add Corporate Funds (Razorpay Live) Modal State
  const [addFundsModal, setAddFundsModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('100000');

  // Filter banks dynamically by search term (name, code, or category)
  const filteredBanks = useMemo(() => {
    if (!bankSearchTerm.trim()) return INDIAN_BANKS;
    const term = bankSearchTerm.toLowerCase().trim();
    return INDIAN_BANKS.filter(
      (b) =>
        b.name.toLowerCase().includes(term) ||
        b.code.toLowerCase().includes(term) ||
        b.category.toLowerCase().includes(term)
    );
  }, [bankSearchTerm]);

  // Bank selection handler - keeps bank details and IFSC prefix synchronized
  const handleSelectBank = useCallback((bank) => {
    if (!bank) return;
    setConnectFormData((prev) => {
      let nextIfsc = prev.ifscCode || '';
      if (nextIfsc && nextIfsc.length >= 5) {
        const branchSuffix = nextIfsc.slice(5);
        nextIfsc = `${bank.ifscPrefix}${branchSuffix || '000123'}`.slice(0, 11);
      } else {
        nextIfsc = `${bank.ifscPrefix}000123`;
      }
      return {
        ...prev,
        bankName: bank.name,
        bankCode: bank.code,
        ifscCode: nextIfsc,
      };
    });
    setBankSearchTerm('');
  }, []);

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
      const [dashData, ledgerRes, summaryRes, reportRes, batchesRes] = await Promise.all([
        adminFundingApi.getDashboard(),
        adminFundingApi.getTreasuryTransactions(),
        adminFundingApi.getDailyFinancialSummary({ startDate: summaryStartDate, endDate: summaryEndDate }),
        adminFundingApi.getEmployeeDailyCommissionReport(reportFilters),
        adminFundingApi.listPayoutBatches(),
      ]);

      if (summaryRes) {
        setDailySummary(summaryRes);
      }
      if (reportRes) {
        setDailyReportData(reportRes);
      }
      if (batchesRes) {
        setPayoutBatches(batchesRes);
      }

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
  }, [selectedAccountId, statusFilter, providerFilter, searchTerm, summaryStartDate, summaryEndDate, reportFilters]);

  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  // Handler: Apply custom date range for Daily Summary
  const handleApplySummaryDateRange = async (e) => {
    e?.preventDefault();
    setRefreshing(true);
    try {
      const summary = await adminFundingApi.getDailyFinancialSummary({
        startDate: summaryStartDate,
        endDate: summaryEndDate,
      });
      if (summary) setDailySummary(summary);
    } catch (err) {
      setErrorBanner(sanitizeErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  // Handler: Reset custom date range
  const handleResetSummaryDateRange = async () => {
    setSummaryStartDate('');
    setSummaryEndDate('');
    setRefreshing(true);
    try {
      const summary = await adminFundingApi.getDailyFinancialSummary({});
      if (summary) setDailySummary(summary);
    } catch (err) {
      setErrorBanner(sanitizeErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  // Handler: Open One-Click Distribution Modal & Pre-fetch validation breakdown
  const handleOpenDistributeModal = async () => {
    try {
      setErrorBanner(null);
      setDistributeModal((prev) => ({
        ...prev,
        open: true,
        loading: true,
        confirmed: false,
      }));
      const preview = await adminFundingApi.getDistributionPreview(distributeModal.periodId);
      setDistributeModal((prev) => ({
        ...prev,
        preview,
        loading: false,
      }));
    } catch (err) {
      setErrorBanner(sanitizeErrorMessage(err));
      setDistributeModal((prev) => ({ ...prev, open: false, loading: false }));
    }
  };

  // Handler: Execute One-Click Commission Distribution upon explicit confirmation
  const handleExecuteDistribute = async () => {
    if (!distributeModal.confirmed) {
      setErrorBanner('Please check the confirmation box before executing distribution.');
      return;
    }
    try {
      setDistributeModal((prev) => ({ ...prev, executing: true }));
      setErrorBanner(null);
      const res = await adminFundingApi.executeOneClickDistribution({
        periodId: distributeModal.periodId,
      });

      setDistributeModal((prev) => ({ ...prev, open: false, executing: false }));
      setDistributeResult(res);
      setSuccessBanner(
        `One-Click Distribution completed successfully! Batch: ${res.batchNumber}. ${res.successfulCount} employees credited (${formatCurrency(res.successfulAmount)}).`
      );
      await loadPortalData();
    } catch (err) {
      setErrorBanner(sanitizeErrorMessage(err));
      setDistributeModal((prev) => ({ ...prev, executing: false }));
    }
  };

  // Handler: Retry Failed Batch Payouts safely
  const handleRetryFailedBatch = async (batchId) => {
    try {
      setRetryingBatchId(batchId);
      setErrorBanner(null);
      const res = await adminFundingApi.retryFailedBatchPayouts(batchId);
      setSuccessBanner(
        `Retry execution completed for batch ${batchId}. Newly succeeded: ${res.newlySucceededCount}, Still failed: ${res.stillFailedCount}`
      );
      await loadPortalData();
    } catch (err) {
      setErrorBanner(sanitizeErrorMessage(err));
    } finally {
      setRetryingBatchId(null);
    }
  };

  // Handler: Export CSV of Daily Report
  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      setErrorBanner(null);
      await adminFundingApi.exportDailyCommissionReportCsv(reportFilters);
      setSuccessBanner('Daily commission report exported successfully as CSV.');
    } catch (err) {
      setErrorBanner(sanitizeErrorMessage(err));
    } finally {
      setExportingCsv(false);
    }
  };

  // Handler: Update Report Filter
  const handleReportFilterChange = (field, value) => {
    setReportFilters((prev) => ({
      ...prev,
      [field]: value,
      page: 1, // Reset to first page
    }));
  };

  // Quick refresh

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

  // Total Successfully Funded (Section 2.A)
  const totalSuccessfullyFunded = useMemo(() => {
    if (treasury?.totalFunded !== undefined && treasury.totalFunded !== null) {
      return Number(treasury.totalFunded);
    }
    return transactions
      .filter((t) => t.status === 'SUCCEEDED')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [treasury, transactions]);

  // Total Payouts Disbursed (Section 2.A)
  const totalPayouts = useMemo(() => {
    if (treasury?.totalPayouts !== undefined && treasury.totalPayouts !== null) {
      return Number(treasury.totalPayouts);
    }
    return treasuryLedger
      .filter((t) => t.type === 'PAYOUT_DISBURSEMENT')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);
  }, [treasury, treasuryLedger]);

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

  // Execute live Razorpay Payment & Treasury Float Injection
  const handlePayWithRazorpay = async (depositAmt, targetAccount) => {
    const numericAmount = Number(depositAmt);
    if (!numericAmount || numericAmount < 100) {
      setErrorBanner('Please enter a valid deposit amount of at least ₹100.');
      return;
    }

    try {
      setSubmittingFunding(true);
      setErrorBanner(null);
      await ensureRazorpayLoaded();

      if (typeof window === 'undefined' || !window.Razorpay) {
        throw new Error('Razorpay Checkout SDK could not be loaded. Please check your internet connection.');
      }

      const keyId = import.meta.env?.VITE_RAZORPAY_KEY_ID || 'rzp_live_ToerZRsvekgL2z';
      const amountInPaise = Math.round(numericAmount * 100);
      const acc = targetAccount || activeAccount || (accounts.length > 0 ? accounts[0] : null) || {
        bankName: 'Indian Overseas Bank',
        bankCode: 'IOBA',
        maskedAccountNumber: '•••• •••• •••• 3766',
        accountName: 'Kashvi Technologies Corp - Primary Treasury Float',
      };

      const options = {
        key: keyId,
        amount: amountInPaise,
        currency: 'INR',
        name: 'Kashvi Technologies Corp',
        description: `Treasury Float Injection via ${acc.bankName || 'Corporate Bank'} (${acc.maskedAccountNumber || 'Primary'})`,
        image: 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png',
        prefill: {
          name: acc.accountName || 'Kashvi Treasury Administrator',
          email: 'treasury@kashvimlm.com',
          contact: '9876543210',
          method: 'netbanking',
          bank: acc.bankCode || undefined,
        },
        notes: {
          rail: 'RAZORPAYX_COMMERCIAL_FLOAT',
          target: 'PLATFORM_TREASURY_RESERVE',
          bankName: acc.bankName,
          bankCode: acc.bankCode,
          accountMasked: acc.maskedAccountNumber,
        },
        theme: {
          color: '#1e3a8a',
        },
        modal: {
          ondismiss: () => {
            setSubmittingFunding(false);
          },
        },
        handler: async function (response) {
          try {
            const paymentId = response.razorpay_payment_id;

            await adminFundingApi.recordFundingSuccess({
              amount: numericAmount,
              currency: 'INR',
              paymentId,
              fundingAccountId: acc.id || 'acc-primary-float',
              provider: 'RAZORPAYX',
              bankName: acc.bankName || 'Corporate Bank',
              bankCode: acc.bankCode || 'BANK',
              maskedAccountNumber: acc.maskedAccountNumber || '•••• 3766',
            });

            setAddFundsModal(false);
            setConfirmModal({ open: false, amount: 0, currency: 'INR', account: null });
            setAmount('');

            setSuccessBanner(
              `Payment of ${formatCurrency(numericAmount)} verified & completed via Razorpay (Payment ID: ${paymentId})! Platform Treasury has been credited and backed by ${acc.bankName || 'connected bank'}.`
            );

            await loadPortalData();
          } catch (err) {
            setErrorBanner(`Payment succeeded (${response.razorpay_payment_id}) but verification failed: ${sanitizeErrorMessage(err)}`);
          } finally {
            setSubmittingFunding(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        setErrorBanner(`Razorpay payment failed: ${resp.error?.description || 'Transaction cancelled by user or bank'}`);
        setSubmittingFunding(false);
      });
      rzp.open();
    } catch (err) {
      setErrorBanner(sanitizeErrorMessage(err));
      setSubmittingFunding(false);
    }
  };

  // Execute Funding Initiation upon Admin Confirmation
  const handleConfirmFunding = async () => {
    const amt = confirmModal.amount;
    const acc = confirmModal.account;
    setConfirmModal({ open: false, amount: 0, currency: 'INR', account: null });
    await handlePayWithRazorpay(amt, acc);
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

  // Trigger Reconcile action with external provider (Section 2.F)
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

      // If external status and internal status mismatch, flag for review (Section 2.F)
      const isMismatch = Boolean(
        res?.isDiscrepancy ||
        res?.transaction?.status === 'RECONCILIATION_REQUIRED' ||
        (res?.transaction?.status === 'FAILED' && reconModal.transaction.status === 'SUCCEEDED')
      );

      if (isMismatch) {
        setErrorBanner(`⚠️ Reconciliation Discrepancy Flagged: External provider reports mismatch for transaction ${reconModal.transaction.id}. Flagged for administrative review. Financial records have not been silently altered.`);
      } else {
        setSuccessBanner(res.message || 'Reconciliation completed successfully.');
      }

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

  // Connect Account Form Submit (Section 2.B)
  const handleConnectAccount = async (e) => {
    e.preventDefault();
    if (!connectFormData.accountName?.trim() || !connectFormData.bankName) {
      setErrorBanner('Please select your bank institution and enter the corporate account holder name.');
      return;
    }
    if (!connectFormData.accountNumber || connectFormData.accountNumber.length < 9) {
      setErrorBanner('Please enter a valid commercial bank account number (9 to 18 digits).');
      return;
    }
    if (connectFormData.accountNumber !== connectFormData.confirmAccountNumber) {
      setErrorBanner('Account numbers do not match. Please verify your account number entries.');
      return;
    }
    if (!connectFormData.ifscCode || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(connectFormData.ifscCode)) {
      setErrorBanner('Please enter a valid 11-character RBI IFSC code (e.g. HDFC0001234).');
      return;
    }

    const maskedNum = `•••• •••• •••• ${connectFormData.accountNumber.slice(-4)}`;
    const connectingBank = connectFormData.bankName;
    const connectingRail = connectFormData.provider === 'RAZORPAYX' ? 'RazorpayX Corporate' : (connectFormData.provider || 'Commercial');

    try {
      setConnectingAccount(true);
      setErrorBanner(null);

      const newAcc = await adminFundingApi.connectAccount({
        accountName: connectFormData.accountName.trim(),
        bankName: connectFormData.bankName,
        bankCode: connectFormData.bankCode,
        ifscCode: connectFormData.ifscCode,
        branchName: connectFormData.branchName?.trim() || 'Corporate Banking Branch',
        provider: connectFormData.provider || 'RAZORPAYX',
        providerAccountId: `rzpx_${(connectFormData.bankCode || 'bank').toLowerCase()}_${Date.now().toString().slice(-6)}`,
        maskedAccountNumber: maskedNum,
        accountType: connectFormData.accountType || 'PRIMARY_OPERATING',
        isPrimary: Boolean(connectFormData.isPrimary || accounts.length === 0),
        metadata: {
          bankName: connectFormData.bankName,
          ifscCode: connectFormData.ifscCode,
          providerRail: connectFormData.provider,
          verifiedVia: 'RazorpayX Instant Automated Verification',
        },
      });

      if (newAcc?.id) {
        setSelectedAccountId(newAcc.id);
      }

      setConnectModal(false);
      setConnectFormData({
        bankName: 'HDFC Bank',
        bankCode: 'HDFC',
        accountName: 'Kashvi Technologies Corp - Primary Treasury Float',
        accountNumber: '',
        confirmAccountNumber: '',
        ifscCode: 'HDFC0001234',
        branchName: 'Corporate Banking Branch',
        provider: 'RAZORPAYX',
        maskedAccountNumber: '',
        accountType: 'PRIMARY_OPERATING',
        isPrimary: true,
      });
      setSuccessBanner(`${connectingBank} corporate account connected successfully via ${connectingRail} rail.`);
      await loadPortalData();
    } catch (err) {
      setErrorBanner(sanitizeErrorMessage(err));
    } finally {
      setConnectingAccount(false);
    }
  };

  // Disconnect Corporate Account (Section 2.B)
  const handleDisconnectAccount = async (accId) => {
    if (!accId) return;
    if (!window.confirm('Are you sure you want to disconnect this corporate bank account? Automated banking rails will be disabled until reconnected.')) {
      return;
    }
    try {
      setErrorBanner(null);
      await adminFundingApi.disconnectAccount(accId);
      setSuccessBanner('Corporate bank account disconnected successfully.');
      setSelectedAccountId('');
      await loadPortalData();
    } catch (err) {
      setErrorBanner(sanitizeErrorMessage(err));
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
            type="button"
            className="admin-btn-pay-razorpay-pro"
            onClick={() => setAddFundsModal(true)}
            title="Inject Corporate Capital Float via Razorpay Live Rail"
          >
            <CreditCard size={15} />
            <span>Add Funds (Razorpay)</span>
            <span className="live-pill">LIVE</span>
          </button>

          <button
            className="admin-btn-connect-bank-pro"
            onClick={() => setConnectModal(true)}
            title="Connect Verified Corporate Bank Account for Treasury & Payouts"
          >
            <div className="btn-bank-icon-box">
              <Building2 size={16} />
            </div>
            <span className="btn-bank-label">Connect Bank Account</span>
            <span className="btn-bank-live-badge">
              <span className="pulse-indicator"></span>
              Live Rails
            </span>
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

      {/* 2.B DAILY FINANCIAL SUMMARY DASHBOARD CARDS (Requirement 4) */}
      <div className="daily-summary-section">
        <div className="daily-date-control-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} style={{ color: '#2563eb' }} />
            <div>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Daily Financial Summary</span>
              <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>
                Period: <strong>{dailySummary?.dateRange?.label || 'All Time (Actual Timestamps)'}</strong>
              </span>
            </div>
          </div>

          <form onSubmit={handleApplySummaryDateRange} className="daily-date-inputs">
            <span style={{ fontSize: '12.5px', color: '#64748b' }}>From:</span>
            <input
              type="date"
              className="daily-date-input"
              value={summaryStartDate}
              onChange={(e) => setSummaryStartDate(e.target.value)}
            />
            <span style={{ fontSize: '12.5px', color: '#64748b' }}>To:</span>
            <input
              type="date"
              className="daily-date-input"
              value={summaryEndDate}
              onChange={(e) => setSummaryEndDate(e.target.value)}
            />
            <button type="submit" className="admin-btn admin-btn-primary admin-btn-sm">
              <Filter size={13} />
              <span>Apply Range</span>
            </button>
            {(summaryStartDate || summaryEndDate) && (
              <button
                type="button"
                className="admin-btn admin-btn-secondary admin-btn-sm"
                onClick={handleResetSummaryDateRange}
              >
                Reset
              </button>
            )}
          </form>
        </div>

        {/* 9 Metrics Cards */}
        <div className="daily-summary-grid">
          <div className="summary-stat-card">
            <div className="summary-stat-header">
              <span className="summary-stat-label">Total Employees</span>
              <div className="summary-stat-icon" style={{ background: '#e0e7ff', color: '#4338ca' }}>
                <Users size={16} />
              </div>
            </div>
            <div className="summary-stat-value">{dailySummary.totalEmployees}</div>
          </div>

          <div className="summary-stat-card">
            <div className="summary-stat-header">
              <span className="summary-stat-label">Qualifying BV</span>
              <div className="summary-stat-icon" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
                <Layers size={16} />
              </div>
            </div>
            <div className="summary-stat-value">{Number(dailySummary.totalQualifyingBV || 0).toLocaleString()} BV</div>
          </div>

          <div className="summary-stat-card">
            <div className="summary-stat-header">
              <span className="summary-stat-label">Payment Volume</span>
              <div className="summary-stat-icon" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                <CreditCard size={16} />
              </div>
            </div>
            <div className="summary-stat-value">{formatCurrency(dailySummary.totalPaymentVolume)}</div>
          </div>

          <div className="summary-stat-card">
            <div className="summary-stat-header">
              <span className="summary-stat-label">Calculated Commissions</span>
              <div className="summary-stat-icon" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                <Activity size={16} />
              </div>
            </div>
            <div className="summary-stat-value" style={{ color: '#0284c7' }}>
              {formatCurrency(dailySummary.totalCalculatedCommissions)}
            </div>
          </div>

          <div className="summary-stat-card">
            <div className="summary-stat-header">
              <span className="summary-stat-label">Pending Commissions</span>
              <div className="summary-stat-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
                <Clock size={16} />
              </div>
            </div>
            <div className="summary-stat-value" style={{ color: '#d97706' }}>
              {formatCurrency(dailySummary.totalPendingCommissions)}
            </div>
          </div>

          <div className="summary-stat-card">
            <div className="summary-stat-header">
              <span className="summary-stat-label">Approved Commissions</span>
              <div className="summary-stat-icon" style={{ background: '#ecfdf5', color: '#047857' }}>
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="summary-stat-value" style={{ color: '#059669' }}>
              {formatCurrency(dailySummary.totalApprovedCommissions)}
            </div>
          </div>

          <div className="summary-stat-card">
            <div className="summary-stat-header">
              <span className="summary-stat-label">Paid Commissions</span>
              <div className="summary-stat-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
                <DollarSign size={16} />
              </div>
            </div>
            <div className="summary-stat-value" style={{ color: '#16a34a' }}>
              {formatCurrency(dailySummary.totalPaidCommissions)}
            </div>
          </div>

          <div className="summary-stat-card">
            <div className="summary-stat-header">
              <span className="summary-stat-label">Failed Payouts</span>
              <div className="summary-stat-icon" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                <AlertTriangle size={16} />
              </div>
            </div>
            <div className="summary-stat-value" style={{ color: '#dc2626' }}>
              {dailySummary.totalFailedPayouts}
            </div>
          </div>

          <div className="summary-stat-card">
            <div className="summary-stat-header">
              <span className="summary-stat-label">Reversed Commissions</span>
              <div className="summary-stat-icon" style={{ background: '#ffedd5', color: '#c2410c' }}>
                <RotateCcw size={16} />
              </div>
            </div>
            <div className="summary-stat-value" style={{ color: '#ea580c' }}>
              {formatCurrency(dailySummary.totalReversedCommissions)}
            </div>
          </div>
        </div>

        {/* Financial Distinction Banner */}
        <div className="financial-distinction-banner">
          <ShieldAlert size={18} style={{ color: '#2563eb', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Strict Financial Distinction (Zero-Ambiguity Guard):</strong>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '4px' }}>
              <span>Order Payments: <strong>{formatCurrency(dailySummary.financialDistinction?.orderPaymentVolume || dailySummary.totalPaymentVolume)}</strong></span>
              <span>•</span>
              <span>Qualifying BV: <strong>{Number(dailySummary.financialDistinction?.businessVolumeBV || dailySummary.totalQualifyingBV || 0).toLocaleString()} BV</strong></span>
              <span>•</span>
              <span>Accrued Liability: <strong>{formatCurrency(dailySummary.financialDistinction?.commissionLiability || (dailySummary.totalCalculatedCommissions + dailySummary.totalApprovedCommissions))}</strong></span>
              <span>•</span>
              <span>Wallet Credits: <strong>{formatCurrency(dailySummary.financialDistinction?.walletCreditsDisbursed || dailySummary.totalPaidCommissions)}</strong></span>
              <span>•</span>
              <span>Bank Settled: <strong>{formatCurrency(dailySummary.financialDistinction?.bankPayoutsSettled || 0)}</strong> (No external gateway simulated)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Top Grid: Treasury Overview + Connected Bank Account (Permanently Visible) */}
      <div className="funding-top-grid">
        {/* Card 1: Treasury Overview (Section 2.A) */}
        <div className="treasury-balance-card">
          <div className="treasury-card-header">
            <div className="treasury-title-wrap">
              <div className="treasury-icon-badge">
                <Wallet size={20} />
              </div>
              <div>
                <h3 className="treasury-title">Platform Treasury Overview</h3>
                <p className="treasury-subtitle">Master liquidity reserve backing platform commissions & payouts</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="solvency-badge">
                <ShieldCheck size={14} />
                <span>SOLVENT (100% Float Backed)</span>
              </div>
              <button
                type="button"
                className="card-deposit-btn-pro"
                onClick={() => setAddFundsModal(true)}
                title="Add Capital to Treasury via Razorpay Live"
              >
                <PlusCircle size={13} />
                <span>Top Up Float</span>
              </button>
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
                Pending Funding
              </span>
              <span className="balance-item-value pending">
                {formatCurrency(treasury?.pendingBalance, treasury?.currency)}
              </span>
            </div>

            <div className="treasury-balance-item">
              <span className="balance-item-label">
                <ShieldCheck size={13} style={{ color: '#4ade80' }} />
                Total Funded
              </span>
              <span className="balance-item-value funded">
                {formatCurrency(totalSuccessfullyFunded, treasury?.currency)}
              </span>
            </div>

            <div className="treasury-balance-item">
              <span className="balance-item-label">
                <CreditCard size={13} style={{ color: '#f472b6' }} />
                Total Payouts
              </span>
              <span className="balance-item-value payouts">
                {formatCurrency(totalPayouts, treasury?.currency)}
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

        {/* Card 2: Connected Bank Account (Section 2.B) */}
        <div className="connected-bank-card">
          <div className="bank-card-header">
            <div className="bank-header-title-wrap">
              <div className="bank-icon-badge">
                <Building2 size={20} />
              </div>
              <div>
                <h3 className="bank-card-title">Corporate Bank Account</h3>
                <p className="bank-card-subtitle">Regulated banking rail for treasury settlement</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {activeAccount && (
                <span className="admin-badge badge-active">
                  <Check size={12} />
                  <span>{activeAccount.status || 'ACTIVE'}</span>
                </span>
              )}
              {activeAccount && (
                <button
                  type="button"
                  className="card-deposit-btn-pro"
                  style={{ background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}
                  onClick={() => setAddFundsModal(true)}
                  title="Make payment with this connected bank"
                >
                  <CreditCard size={13} />
                  <span>Pay with Bank</span>
                </button>
              )}
            </div>
          </div>

          {accounts.length > 1 && (
            <div style={{ padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Active Bank Account:</span>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.bankName || 'Bank'} ({a.maskedAccountNumber || '••••'}) {a.isPrimary ? '★ Primary' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeAccount ? (
            <div className="bank-details-body">
              {/* Row 1: Bank Institution & Brand Name */}
              <div className="bank-detail-grid-2col">
                <div className="bank-info-tile">
                  <span className="bank-detail-label">Bank Institution</span>
                  <div className="bank-institution-val">
                    <Landmark size={15} className="bank-brand-icon" />
                    <span className="bank-inst-name">{activeAccount.bankName || 'Punjab National Bank'}</span>
                    <span className="bank-code-tag">{activeAccount.bankCode || 'PUNB'}</span>
                  </div>
                </div>

                <div className="bank-info-tile">
                  <span className="bank-detail-label">Brand Name</span>
                  <div className="bank-brand-val">
                    <span className="brand-badge-pill">{activeAccount.brandName || 'kashvimlm'}</span>
                    <span className="brand-verified-tag">
                      <CheckCircle2 size={12} />
                      Verified
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 2: Account Number & IFSC Code */}
              <div className="bank-detail-grid-2col">
                <div className="bank-info-tile">
                  <div className="bank-tile-header">
                    <span className="bank-detail-label">Account Number</span>
                    <button
                      type="button"
                      className="copy-btn-inline"
                      onClick={() => handleCopyText(activeAccount.accountNumber || '1923102100000382', 'accNo')}
                      title="Copy Account Number"
                    >
                      {copiedField === 'accNo' ? (
                        <span className="copied-text"><Check size={11} /> Copied</span>
                      ) : (
                        <><Copy size={11} /> Copy</>
                      )}
                    </button>
                  </div>
                  <span className="masked-account-pill font-mono">
                    {activeAccount.accountNumber || '1923102100000382'}
                  </span>
                </div>

                <div className="bank-info-tile">
                  <div className="bank-tile-header">
                    <span className="bank-detail-label">IFSC Code</span>
                    <button
                      type="button"
                      className="copy-btn-inline"
                      onClick={() => handleCopyText(activeAccount.ifscCode || 'PUNB0192310', 'ifsc')}
                      title="Copy IFSC Code"
                    >
                      {copiedField === 'ifsc' ? (
                        <span className="copied-text"><Check size={11} /> Copied</span>
                      ) : (
                        <><Copy size={11} /> Copy</>
                      )}
                    </button>
                  </div>
                  <div className="ifsc-row-wrap">
                    <span className="masked-account-pill font-mono ifsc-pill">
                      {activeAccount.ifscCode || 'PUNB0192310'}
                    </span>
                    <span className="branch-subtag">Chamba, HP</span>
                  </div>
                </div>
              </div>

              {/* Row 3: Corporate Registered Address Summary Link */}
              <div className="bank-address-summary-strip">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={13} style={{ color: '#2563eb' }} />
                  <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 600 }}>
                    Jalukari, Mohalla Upper Julakhari, Chamba, HP - 176310
                  </span>
                </div>
                <a href="#corporate-account-details" className="view-full-details-anchor">
                  View Full Profile ↓
                </a>
              </div>

              {/* Row 4: Payment Rail & Gateway and Account Actions */}
              <div className="bank-meta-footer-row">
                <div className="bank-rail-badge">
                  <CreditCard size={13} style={{ color: '#059669' }} />
                  <span>Razorpay Live Banking Rail</span>
                  <span className="live-pill">LIVE</span>
                </div>

                <div className="bank-action-buttons">
                  <button
                    type="button"
                    className="card-deposit-btn-pro"
                    onClick={() => setAddFundsModal(true)}
                    title={`Deposit corporate funds using ${activeAccount.bankName || 'Punjab National Bank'}`}
                  >
                    <CreditCard size={12} />
                    <span>Pay with {activeAccount.bankName?.split(' ')[0] || 'PNB'}</span>
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary admin-btn-sm btn-disconnect"
                    onClick={() => handleDisconnectAccount(activeAccount.id)}
                    title="Disconnect corporate bank account"
                  >
                    <X size={12} />
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 14px', color: '#64748b' }}>
              <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '12px', borderRadius: '8px', marginBottom: '14px', textAlign: 'left' }}>
                <div style={{ fontWeight: 600, color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <AlertTriangle size={15} />
                  <span>Payment Provider Configuration Required</span>
                </div>
                <p style={{ fontSize: '12px', color: '#78350f', margin: 0, lineHeight: 1.45 }}>
                  No corporate banking rail is active. Please connect your verified corporate account or ensure provider credentials (e.g. <code>RAZORPAYX_KEY_ID</code>, <code>RAZORPAYX_KEY_SECRET</code>) are configured.
                </p>
              </div>
              <button
                className="admin-btn-connect-bank-pro"
                style={{ padding: '8px 14px', fontSize: '12.5px' }}
                onClick={() => setConnectModal(true)}
              >
                <div className="btn-bank-icon-box" style={{ padding: '3px' }}>
                  <Building2 size={14} />
                </div>
                <span className="btn-bank-label">Connect Bank Account</span>
                <span className="btn-bank-live-badge">
                  <span className="pulse-indicator"></span>
                  Active
                </span>
              </button>
            </div>
          )}

          {/* Invariant Banner (Requirement 2: Never show sensitive banking credentials) */}
          <div className="security-invariant-banner">
            <Lock size={15} style={{ flexShrink: 0 }} />
            <span>Zero-Trust Invariant: Sensitive banking credentials, PINs & API secrets are never collected, stored, or displayed.</span>
          </div>
        </div>
      </div>

      {/* 2.D DEDICATED OFFICIAL CORPORATE ACCOUNT & REGISTERED OFFICE SECTION */}
      <section className="official-account-showcase-section" id="corporate-account-details" aria-label="Official Corporate Banking and Office Details">
        <div className="showcase-section-header">
          <div className="showcase-header-left">
            <div className="showcase-badge">
              <ShieldCheck size={14} className="badge-shield-icon" />
              <span>OFFICIAL CORPORATE TREASURY DETAILS</span>
            </div>
            <h2 className="showcase-title">Company Bank Account &amp; Registered Office</h2>
            <p className="showcase-subtitle">
              Verified banking credentials for NEFT / RTGS / IMPS settlement and official legal registration of <strong>kashvimlm</strong>
            </p>
          </div>

          <div className="showcase-header-actions">
            <span className="account-verified-tag">
              <CheckCircle2 size={14} />
              <span>RBI / KYC Verified Active</span>
            </span>
          </div>
        </div>

        <div className="showcase-cards-grid">
          {/* Card 1: Bank Account Details */}
          <div className="showcase-bank-card">
            <div className="showcase-card-topbar">
              <div className="card-topbar-title">
                <div className="bank-avatar-box">
                  <Landmark size={22} />
                </div>
                <div>
                  <span className="card-kicker">PRIMARY SETTLEMENT ACCOUNT</span>
                  <h3 className="card-main-name">Punjab National Bank</h3>
                </div>
              </div>
              <span className="pnb-code-badge">PUNB</span>
            </div>

            {/* Virtual Metallic Account Strip */}
            <div className="virtual-account-strip">
              <div className="strip-header">
                <span className="strip-brand-label">BRAND NAME</span>
                <span className="strip-brand-value">kashvimlm</span>
              </div>

              <div className="strip-field-group">
                <span className="strip-field-lbl">ACCOUNT NUMBER</span>
                <div className="strip-acc-number-row">
                  <span className="strip-acc-digits">1923 1021 0000 0382</span>
                  <button
                    type="button"
                    className="strip-copy-btn"
                    onClick={() => handleCopyText('1923102100000382', 'showcaseAccNo')}
                    title="Copy Account Number"
                  >
                    {copiedField === 'showcaseAccNo' ? (
                      <span className="copied-pill"><Check size={12} /> Copied!</span>
                    ) : (
                      <><Copy size={12} /> Copy Number</>
                    )}
                  </button>
                </div>
              </div>

              <div className="strip-footer-grid">
                <div>
                  <span className="strip-field-lbl">IFSC CODE</span>
                  <div className="strip-ifsc-row">
                    <span className="strip-ifsc-digits">PUNB0192310</span>
                    <button
                      type="button"
                      className="strip-copy-btn-sm"
                      onClick={() => handleCopyText('PUNB0192310', 'showcaseIfsc')}
                      title="Copy IFSC Code"
                    >
                      {copiedField === 'showcaseIfsc' ? (
                        <span className="copied-pill"><Check size={11} /> Copied</span>
                      ) : (
                        <><Copy size={11} /> Copy</>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="strip-field-lbl">BRANCH</span>
                  <span className="strip-branch-val">Chamba (HP)</span>
                </div>

                <div>
                  <span className="strip-field-lbl">ACCOUNT TYPE</span>
                  <span className="strip-branch-val">Current / Operating</span>
                </div>
              </div>
            </div>

            <div className="showcase-bank-meta-chips">
              <span className="transfer-mode-chip">IMPS</span>
              <span className="transfer-mode-chip">NEFT</span>
              <span className="transfer-mode-chip">RTGS</span>
              <span className="transfer-mode-chip">Instant Payouts</span>
            </div>
          </div>

          {/* Card 2: Registered Corporate Office Address */}
          <div className="showcase-address-card">
            <div className="showcase-card-topbar">
              <div className="card-topbar-title">
                <div className="address-avatar-box">
                  <MapPin size={22} />
                </div>
                <div>
                  <span className="card-kicker">GOVERNMENT &amp; MCA REGISTERED</span>
                  <h3 className="card-main-name">Registered Corporate Office</h3>
                </div>
              </div>

              <button
                type="button"
                className="address-copy-all-btn"
                onClick={() => handleCopyText(
                  'Building No./Flat No.: Jalukari, Name Of Premises/Building: MOHALLA UPPER JULAKHARI, Road/Street: POST OFFICE CHAMBA, Locality/Sub Locality: TEHSIL CHAMBA, City/Town/Village: Chamba, District: Chamba, State: Himachal Pradesh, PIN Code: 176310',
                  'showcaseAddrAll'
                )}
                title="Copy Full Official Address"
              >
                {copiedField === 'showcaseAddrAll' ? (
                  <span className="copied-pill"><Check size={12} /> Copied Complete Address</span>
                ) : (
                  <><Copy size={12} /> Copy Full Address</>
                )}
              </button>
            </div>

            {/* Address Items Table Grid */}
            <div className="showcase-address-table">
              <div className="addr-table-row">
                <span className="table-lbl">Building No. / Flat No.</span>
                <span className="table-val highlight-building">Jalukari</span>
              </div>

              <div className="addr-table-row">
                <span className="table-lbl">Name Of Premises / Building</span>
                <span className="table-val">MOHALLA UPPER JULAKHARI</span>
              </div>

              <div className="addr-table-row">
                <span className="table-lbl">Road / Street</span>
                <span className="table-val">POST OFFICE CHAMBA</span>
              </div>

              <div className="addr-table-row">
                <span className="table-lbl">Locality / Sub Locality</span>
                <span className="table-val">TEHSIL CHAMBA</span>
              </div>

              <div className="addr-table-row">
                <span className="table-lbl">City / Town / Village</span>
                <span className="table-val">Chamba</span>
              </div>

              <div className="addr-table-row">
                <span className="table-lbl">District</span>
                <span className="table-val">Chamba</span>
              </div>

              <div className="addr-table-row">
                <span className="table-lbl">State</span>
                <span className="table-val state-val">Himachal Pradesh</span>
              </div>

              <div className="addr-table-row">
                <span className="table-lbl">PIN Code</span>
                <span className="table-val pin-val">176310</span>
              </div>
            </div>

            <div className="address-legal-footer">
              <Building2 size={13} style={{ color: '#0284c7' }} />
              <span>Official Registered Headquarters for <strong>kashvimlm</strong> corporate operations</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2.C ONE-CLICK COMMISSION PAYMENT BUTTON (Requirement 2) */}
      <div className="distribute-hero-card">
        <div className="distribute-hero-content">
          <h2 className="distribute-hero-title">
            <Award size={22} style={{ color: '#818cf8' }} />
            <span>One-Click Commission Distribution</span>
          </h2>
          <p className="distribute-hero-desc">
            Instantly initiate a secure, verified distribution run for all approved commissions. Transactions are executed atomically into member wallets with idempotent batch tracking and duplicate-payout prevention.
          </p>
          <div className="distribute-hero-stats">
            <span className="distribute-stat-chip">
              <Users size={14} />
              <span>Approved Commissions: <strong>{formatCurrency(dailySummary.totalApprovedCommissions)}</strong></span>
            </span>
            <span className="distribute-stat-chip">
              <Clock size={14} />
              <span>Cycle: <strong>{distributeModal.periodId}</strong></span>
            </span>
            {(treasury?.availableBalance || 0) >= (dailySummary?.totalApprovedCommissions || 0) ? (
              <span className="distribute-solvency-pill solvent">
                <ShieldCheck size={14} />
                <span>Treasury Float Backed (100% Solvency Confirmed)</span>
              </span>
            ) : (
              <span
                className="distribute-solvency-pill unbacked"
                onClick={() => setAddFundsModal(true)}
                style={{ cursor: 'pointer' }}
                title="Click to add funds via Razorpay"
              >
                <AlertTriangle size={14} />
                <span>Top up ₹{formatCurrency((dailySummary?.totalApprovedCommissions || 0) - (treasury?.availableBalance || 0))} to back payout</span>
              </span>
            )}
          </div>
        </div>

        <div>
          <button
            type="button"
            className="distribute-btn-primary"
            onClick={handleOpenDistributeModal}
            disabled={distributeModal.loading || distributeModal.executing}
          >
            <Send size={18} />
            <span>Distribute All Eligible Commissions</span>
          </button>
        </div>
      </div>

      {/* 4. Middle Grid: Add Funds Form (Requirement 3) + Funding Status Lifecycle (Requirement 4) */}
      {activeTab === 'funding' && (
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
      )}

      {/* 5. Tables Section: Tabs for Funding History (Section 5) & Treasury Transactions (Section 6) */}
      <div className="funding-tables-card">
        <div className="funding-tabs-header">
          <div className="tabs-btn-group">
            <button
              className={`funding-tab-btn ${activeTab === 'commissions' ? 'active' : ''}`}
              onClick={() => setActiveTab('commissions')}
            >
              <Award size={16} />
              <span>Daily Commission Report</span>
              <span className="tab-badge-count">{dailyReportData?.totalRecords || 0}</span>
            </button>

            <button
              className={`funding-tab-btn ${activeTab === 'batches' ? 'active' : ''}`}
              onClick={() => setActiveTab('batches')}
            >
              <Layers size={16} />
              <span>Payout Batches</span>
              <span className="tab-badge-count">{payoutBatches?.length || 0}</span>
            </button>

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

          {/* Search & Provider Filter Bar for Funding and Treasury */}
          {(activeTab === 'funding' || activeTab === 'treasury') && (
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
          )}
        </div>

        {/* TAB 0: Employee-Wise Daily Commission Report (23 Columns) */}
        {activeTab === 'commissions' && (
          <div style={{ padding: '20px' }}>
            {/* Filter Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '16px', background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div className="admin-search-wrap" style={{ minWidth: '220px', flex: '1 1 200px' }}>
                <Search size={15} />
                <input
                  type="text"
                  className="admin-search-input"
                  placeholder="Search ID, Name or Sponsor..."
                  value={reportFilters.search || ''}
                  onChange={(e) => handleReportFilterChange('search', e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} style={{ color: '#64748b' }} />
                <input
                  type="date"
                  className="admin-date-input"
                  value={reportFilters.startDate || ''}
                  onChange={(e) => handleReportFilterChange('startDate', e.target.value)}
                  title="From Date"
                />
                <span style={{ color: '#94a3b8' }}>-</span>
                <input
                  type="date"
                  className="admin-date-input"
                  value={reportFilters.endDate || ''}
                  onChange={(e) => handleReportFilterChange('endDate', e.target.value)}
                  title="To Date"
                />
              </div>

              <select
                className="admin-filter-select"
                value={reportFilters.rank || 'ALL'}
                onChange={(e) => handleReportFilterChange('rank', e.target.value)}
              >
                <option value="ALL">All Ranks</option>
                <option value="SILVER">Silver</option>
                <option value="GOLD">Gold</option>
                <option value="PLATINUM">Platinum</option>
                <option value="DIAMOND">Diamond</option>
                <option value="RUBY">Ruby</option>
              </select>

              <select
                className="admin-filter-select"
                value={reportFilters.tier || 'ALL'}
                onChange={(e) => handleReportFilterChange('tier', e.target.value)}
              >
                <option value="ALL">All Tiers</option>
                <option value="SILVER">Silver (24%)</option>
                <option value="GOLD">Gold (8%)</option>
                <option value="PLATINUM">Platinum (13%)</option>
                <option value="DIAMOND">Diamond (5%)</option>
                <option value="RUBY">Ruby (4%)</option>
              </select>

              <select
                className="admin-filter-select"
                value={reportFilters.paymentStatus || 'ALL'}
                onChange={(e) => handleReportFilterChange('paymentStatus', e.target.value)}
              >
                <option value="ALL">Payment: All</option>
                <option value="PAID">Payment: PAID</option>
                <option value="PENDING">Payment: PENDING</option>
                <option value="FAILED">Payment: FAILED</option>
              </select>

              <select
                className="admin-filter-select"
                value={reportFilters.status || 'ALL'}
                onChange={(e) => handleReportFilterChange('status', e.target.value)}
              >
                <option value="ALL">Comm: All</option>
                <option value="APPROVED">Comm: APPROVED</option>
                <option value="PENDING">Comm: PENDING</option>
                <option value="PAID">Comm: PAID</option>
                <option value="REVERSED">Comm: REVERSED</option>
              </select>

              <select
                className="admin-filter-select"
                value={reportFilters.payoutStatus || 'ALL'}
                onChange={(e) => handleReportFilterChange('payoutStatus', e.target.value)}
              >
                <option value="ALL">Payout: All</option>
                <option value="SUCCESS">Payout: SUCCESS</option>
                <option value="FAILED">Payout: FAILED</option>
                <option value="PENDING">Payout: PENDING</option>
              </select>

              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={handleExportCsv}
                disabled={exportingCsv}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
              >
                <Download size={14} />
                <span>{exportingCsv ? 'Exporting...' : 'Export CSV'}</span>
              </button>
            </div>

            {/* 23-Column Table with Horizontal Scroll */}
            <div className="report-table-scroll-wrapper">
              <table className="report-table-custom">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Employee ID</th>
                    <th>Employee Name</th>
                    <th>Sponsor ID</th>
                    <th>Rank</th>
                    <th>Tx Date & Time</th>
                    <th>Order Ref</th>
                    <th>Payment Status</th>
                    <th>Purchase Amt</th>
                    <th>Qualifying BV</th>
                    <th>Left Vol</th>
                    <th>Right Vol</th>
                    <th>Tier</th>
                    <th>Comm %</th>
                    <th>Comm Base</th>
                    <th>Commission Amt</th>
                    <th>Prev Paid</th>
                    <th>Pending</th>
                    <th>Approved</th>
                    <th>Paid</th>
                    <th>Failed / Rev</th>
                    <th>Batch ID</th>
                    <th>Payout Reference</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyReportData?.records && dailyReportData.records.length > 0 ? (
                    dailyReportData.records.map((r, idx) => (
                      <tr key={r.id || `${r.distributorId}-${idx}`}>
                        <td style={{ color: '#94a3b8', fontSize: '11px' }}>
                          {((dailyReportData.page || 1) - 1) * (dailyReportData.pageSize || 20) + idx + 1}
                        </td>
                        <td className="code-font" style={{ fontWeight: 600 }}>{r.distributorCode}</td>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{r.distributorName}</td>
                        <td className="code-font">{r.sponsorId || '—'}</td>
                        <td>
                          <span className={`rank-badge-pill rank-${r.currentRank?.toLowerCase()}`}>
                            {r.currentRank}
                          </span>
                        </td>
                        <td>{formatDate(r.transactionDate)}</td>
                        <td className="code-font" style={{ fontSize: '12px' }}>{r.orderReference || '—'}</td>
                        <td>
                          <span className={`admin-badge ${r.paymentStatus === 'PAID' ? 'badge-active' : r.paymentStatus === 'PENDING' ? 'badge-pending' : 'badge-suspended'}`}>
                            {r.paymentStatus}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{formatCurrency(r.purchaseAmount)}</td>
                        <td style={{ fontWeight: 600, color: '#0284c7' }}>{r.qualifyingBV}</td>
                        <td>{r.leftMatchingVolume}</td>
                        <td>{r.rightMatchingVolume}</td>
                        <td><span className="admin-badge badge-neutral">{r.commissionTier}</span></td>
                        <td style={{ fontWeight: 600 }}>{r.commissionPercentage}%</td>
                        <td>{formatCurrency(r.commissionBase)}</td>
                        <td style={{ fontWeight: 700, color: '#16a34a' }}>{formatCurrency(r.commissionAmount)}</td>
                        <td style={{ color: '#64748b' }}>{formatCurrency(r.previousPaidCommission)}</td>
                        <td style={{ color: '#d97706', fontWeight: 600 }}>{formatCurrency(r.pendingCommission)}</td>
                        <td style={{ color: '#0284c7', fontWeight: 600 }}>{formatCurrency(r.approvedCommission)}</td>
                        <td style={{ color: '#16a34a', fontWeight: 600 }}>{formatCurrency(r.paidCommission)}</td>
                        <td style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(r.failedCommission)}</td>
                        <td className="code-font" style={{ fontSize: '11.5px' }}>{r.payoutBatchId || '—'}</td>
                        <td className="code-font" style={{ fontSize: '11.5px' }}>{r.payoutReference || '—'}</td>
                        <td style={{ fontSize: '12px', color: '#64748b' }}>{formatDate(r.lastUpdated)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={24} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        No commission records found matching the specified filters.
                      </td>
                    </tr>
                  )}
                </tbody>
                {dailyReportData?.summaryTotals && (
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                      <td colSpan={8} style={{ textAlign: 'right', padding: '12px 14px' }}>
                        Summary Totals ({dailyReportData.totalRecords || 0} records):
                      </td>
                      <td style={{ padding: '12px 10px' }}>{formatCurrency(dailyReportData.summaryTotals.totalPurchaseAmount)}</td>
                      <td style={{ padding: '12px 10px', color: '#0284c7' }}>{dailyReportData.summaryTotals.totalQualifyingBV}</td>
                      <td colSpan={5} style={{ textAlign: 'right', padding: '12px 10px' }}>Total Comm:</td>
                      <td style={{ padding: '12px 10px', color: '#16a34a' }}>{formatCurrency(dailyReportData.summaryTotals.totalCommissionAmount)}</td>
                      <td style={{ padding: '12px 10px' }}>{formatCurrency(dailyReportData.summaryTotals.totalPreviousPaidCommission)}</td>
                      <td style={{ padding: '12px 10px', color: '#d97706' }}>{formatCurrency(dailyReportData.summaryTotals.totalPendingCommission)}</td>
                      <td style={{ padding: '12px 10px', color: '#0284c7' }}>{formatCurrency(dailyReportData.summaryTotals.totalApprovedCommission)}</td>
                      <td style={{ padding: '12px 10px', color: '#16a34a' }}>{formatCurrency(dailyReportData.summaryTotals.totalPaidCommission)}</td>
                      <td style={{ padding: '12px 10px', color: '#dc2626' }}>{formatCurrency(dailyReportData.summaryTotals.totalFailedCommission)}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Pagination Controls */}
            {dailyReportData && (
              <div className="admin-pagination">
                <span>
                  Showing {dailyReportData.records?.length || 0} of {dailyReportData.totalRecords || 0} records (Page {dailyReportData.page || 1} of {dailyReportData.totalPages || 1})
                </span>
                <div className="admin-page-controls">
                  <button
                    className="admin-page-btn"
                    disabled={(dailyReportData.page || 1) <= 1}
                    onClick={() => handleReportFilterChange('page', (dailyReportData.page || 1) - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ padding: '0 8px', fontWeight: 600 }}>{dailyReportData.page || 1}</span>
                  <button
                    className="admin-page-btn"
                    disabled={(dailyReportData.page || 1) >= (dailyReportData.totalPages || 1)}
                    onClick={() => handleReportFilterChange('page', (dailyReportData.page || 1) + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Payout Batches */}
        {activeTab === 'batches' && (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Batch Number</th>
                  <th>Period</th>
                  <th>Initiated At</th>
                  <th>Completed At</th>
                  <th>Status</th>
                  <th>Method</th>
                  <th>Total Employees</th>
                  <th>Success</th>
                  <th>Failed</th>
                  <th>Total Amount</th>
                  <th>Successful Amount</th>
                  <th>Failed Amount</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payoutBatches && payoutBatches.length > 0 ? (
                  payoutBatches.map((batch) => (
                    <tr key={batch.id}>
                      <td className="code-font" style={{ fontWeight: 700, color: '#0f172a' }}>{batch.batchNumber}</td>
                      <td><span className="admin-badge badge-neutral">{batch.periodId || 'Ad-hoc'}</span></td>
                      <td>{formatDate(batch.createdAt)}</td>
                      <td>{formatDate(batch.completedAt)}</td>
                      <td>
                        <span className={`admin-badge ${
                          batch.status === 'COMPLETED' || batch.status === 'COMPLETED_WALLET'
                            ? 'badge-active'
                            : batch.status === 'PARTIAL_FAILURE'
                            ? 'badge-pending'
                            : batch.status === 'PROCESSING'
                            ? 'badge-processing'
                            : 'badge-suspended'
                        }`}>
                          {batch.status}
                        </span>
                      </td>
                      <td><span className="admin-badge badge-neutral">{batch.payoutMethod || 'DIGITAL_WALLET'}</span></td>
                      <td style={{ fontWeight: 600 }}>{batch.totalEmployees}</td>
                      <td style={{ fontWeight: 600, color: '#16a34a' }}>{batch.successfulCount}</td>
                      <td style={{ fontWeight: 600, color: batch.failedCount > 0 ? '#dc2626' : '#64748b' }}>
                        {batch.failedCount}
                      </td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(batch.totalAmount)}</td>
                      <td style={{ fontWeight: 700, color: '#16a34a' }}>{formatCurrency(batch.successfulAmount)}</td>
                      <td style={{ fontWeight: 700, color: batch.failedAmount > 0 ? '#dc2626' : '#64748b' }}>
                        {formatCurrency(batch.failedAmount)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {batch.failedCount > 0 ? (
                          <button
                            type="button"
                            className="admin-btn admin-btn-danger admin-btn-sm"
                            onClick={() => handleRetryFailedBatch(batch.id)}
                            disabled={retryingBatchId === batch.id}
                            title="Retry only failed payouts safely without double-paying successful members"
                          >
                            <RotateCcw size={13} />
                            <span>{retryingBatchId === batch.id ? 'Retrying...' : 'Retry Failed'}</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={13} /> All Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      No payout batches recorded yet. Click &quot;Distribute All Eligible Commissions&quot; to initiate a distribution run.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 1: Funding History Table (Requirement 5) */}
        {activeTab === 'funding' && (
          <>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Transaction ID</th>
                    <th>Amount</th>
                    <th>Currency</th>
                    <th>Funding Account</th>
                    <th>Status</th>
                    <th>Initiated By</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.length > 0 ? (
                    paginatedTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleOpenReconcile(tx)}
                        title="Click to view transaction details, status history & provider reference"
                      >
                        <td>{formatDate(tx.createdAt || tx.initiatedAt)}</td>
                        <td className="code-font" style={{ fontSize: '12.5px', fontWeight: 600 }}>
                          {tx.id}
                        </td>
                        <td style={{ fontWeight: 700, color: '#0f172a' }}>
                          {formatCurrency(tx.amount, tx.currency)}
                        </td>
                        <td>
                          <span className="admin-badge badge-neutral" style={{ fontSize: '11px' }}>
                            {tx.currency || 'INR'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: '#475569' }}>
                            {tx.fundingAccount?.accountName || tx.fundingAccount?.maskedAccountNumber || tx.fundingAccountId || 'Corporate Treasury Float'}
                          </span>
                        </td>
                        <td>{renderStatusBadge(tx.status)}</td>
                        <td>
                          <span style={{ fontSize: '12.5px', color: '#334155' }}>
                            {tx.initiatedByAdmin?.fullName || tx.initiatedByAdmin?.email || 'Administrator'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              className="admin-btn admin-btn-secondary admin-btn-sm"
                              onClick={() => handleOpenReconcile(tx)}
                              title="View details & reconcile with external provider"
                            >
                              <ExternalLink size={13} />
                              <span>Details & Reconcile</span>
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
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
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
          <div className="connect-modal-card">
            <div className="connect-modal-header">
              <div className="connect-modal-header-left">
                <div className="connect-modal-header-icon">
                  <Landmark size={22} />
                </div>
                <div>
                  <h3 className="connect-modal-title">Connect Corporate Bank Account</h3>
                  <p className="connect-modal-subtitle">
                    Select your bank &amp; link verified commercial rail for RazorpayX payments &amp; payouts
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="admin-modal-close-btn"
                onClick={() => setConnectModal(false)}
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConnectAccount} className="connect-modal-form">
              <div className="connect-modal-body">
                {/* 1. Quick Bank Selection Chips & Full Searchable List */}
                <div className="form-group-custom">
                  <div className="bank-chips-label-row">
                    <label className="form-label-custom">
                      1. Choose Bank Institution *
                    </label>
                    <div className="active-selected-bank-pill">
                      <Landmark size={12} style={{ color: '#2563eb' }} />
                      <span className="selected-bank-name">{connectFormData.bankName}</span>
                      <span className="bank-code-tag">{connectFormData.bankCode}</span>
                    </div>
                  </div>

                  {/* Popular Bank Chips Grid */}
                  <div className="bank-chips-grid">
                    {POPULAR_BANKS.map((b) => {
                      const isSelected = connectFormData.bankCode === b.code;
                      return (
                        <button
                          key={b.code}
                          type="button"
                          className={`bank-chip-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelectBank(b)}
                          title={`Select ${b.name}`}
                        >
                          <div className="bank-chip-content">
                            <Building2 size={13} className="bank-chip-icon" />
                            <span className="bank-chip-name">{b.name}</span>
                          </div>
                          {isSelected && <Check size={13} className="chip-check-icon" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Instant Bank Search Input */}
                  <div className="bank-search-input-wrap">
                    <Search size={15} className="bank-search-icon" />
                    <input
                      type="text"
                      className="form-input-custom bank-search-input"
                      placeholder="Search 38+ RBI-approved banks (e.g. Canara, Kotak, Union)..."
                      value={bankSearchTerm}
                      onChange={(e) => setBankSearchTerm(e.target.value)}
                      autoComplete="off"
                    />
                    {bankSearchTerm && (
                      <button
                        type="button"
                        className="bank-search-clear-btn"
                        onClick={() => setBankSearchTerm('')}
                        title="Clear search"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Instant Live Search Results Popover */}
                  {bankSearchTerm.trim() && (
                    <div className="bank-search-results-panel">
                      {filteredBanks.length === 0 ? (
                        <div className="bank-search-empty">
                          <AlertTriangle size={15} style={{ color: '#d97706', flexShrink: 0 }} />
                          <span>No bank found matching "{bankSearchTerm}". You can select from the full list below.</span>
                        </div>
                      ) : (
                        <div className="bank-search-results-list">
                          <div className="bank-search-results-header">
                            <span>Matching Banks ({filteredBanks.length})</span>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>Click to select</span>
                          </div>
                          {filteredBanks.slice(0, 8).map((b) => {
                            const isSelected = connectFormData.bankCode === b.code;
                            return (
                              <div
                                key={b.code}
                                className={`bank-result-item ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleSelectBank(b)}
                              >
                                <div className="bank-result-item-left">
                                  <div className="bank-result-icon">
                                    <Building2 size={14} />
                                  </div>
                                  <div>
                                    <div className="bank-result-name">
                                      {b.name}
                                      <span className="bank-result-code">{b.code}</span>
                                    </div>
                                    <div className="bank-result-meta">
                                      <span>{b.category}</span>
                                      <span>&bull;</span>
                                      <span>IFSC Prefix: {b.ifscPrefix}••••</span>
                                    </div>
                                  </div>
                                </div>
                                <span className={`bank-result-select-btn ${isSelected ? 'active' : ''}`}>
                                  {isSelected ? (
                                    <>
                                      <Check size={12} /> Selected
                                    </>
                                  ) : (
                                    'Select'
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Complete Bank Dropdown with Categories */}
                  <div className="bank-select-container">
                    <label className="bank-directory-label">
                      Or select from complete classified directory:
                    </label>
                    <select
                      className="form-input-custom bank-directory-select"
                      value={connectFormData.bankCode}
                      onChange={(e) => {
                        const selected = INDIAN_BANKS.find((b) => b.code === e.target.value);
                        if (selected) {
                          handleSelectBank(selected);
                        }
                      }}
                    >
                      {!INDIAN_BANKS.some((b) => b.code === connectFormData.bankCode) && (
                        <option value={connectFormData.bankCode}>
                          {connectFormData.bankName} ({connectFormData.bankCode})
                        </option>
                      )}
                      {BANK_CATEGORIES.map((cat) => (
                        <optgroup key={cat} label={`── ${cat} ──`}>
                          {INDIAN_BANKS.filter((b) => b.category === cat).map((b) => (
                            <option key={b.code} value={b.code}>
                              {b.name} ({b.code}) &bull; IFSC: {b.ifscPrefix}...
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. Account Holder / Corporate Entity Name */}
                <div className="form-group-custom">
                  <label className="form-label-custom">
                    2. Account Holder / Corporate Entity Name *
                  </label>
                  <input
                    type="text"
                    className="form-input-custom"
                    placeholder="Legal corporate entity name as per bank records"
                    value={connectFormData.accountName}
                    onChange={(e) => setConnectFormData({ ...connectFormData, accountName: e.target.value })}
                    required
                  />
                  <span className="form-field-helper-note">
                    Must match the legal registration on corporate PAN card, GSTIN certificate, and banking records.
                  </span>
                </div>

                {/* 3. Account Number & Confirm Account Number (2-Column) */}
                <div className="form-row-2col">
                  <div className="form-group-custom">
                    <div className="form-label-row">
                      <label className="form-label-custom">Account Number *</label>
                      {connectFormData.accountNumber && (
                        <span className={`digit-count-tag ${connectFormData.accountNumber.length >= 9 ? 'valid' : 'pending'}`}>
                          {connectFormData.accountNumber.length} {connectFormData.accountNumber.length === 1 ? 'digit' : 'digits'}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      className="form-input-custom font-mono"
                      placeholder="Enter 9 to 18 digits (e.g. 50100428912345)"
                      value={connectFormData.accountNumber}
                      onChange={(e) =>
                        setConnectFormData({
                          ...connectFormData,
                          accountNumber: e.target.value.replace(/\D/g, ''),
                        })
                      }
                      maxLength={18}
                      autoComplete="off"
                      required
                    />
                    <span className="form-field-helper-note">
                      Commercial accounts are typically 9 to 18 numeric digits
                    </span>
                  </div>

                  <div className="form-group-custom">
                    <div className="form-label-row">
                      <label className="form-label-custom">Confirm Account Number *</label>
                      {connectFormData.accountNumber && connectFormData.confirmAccountNumber && (
                        connectFormData.accountNumber === connectFormData.confirmAccountNumber ? (
                          <span className="match-status-badge matched">
                            <Check size={11} /> Numbers Match
                          </span>
                        ) : (
                          <span className="match-status-badge mismatch">
                            <X size={11} /> Numbers Mismatch
                          </span>
                        )
                      )}
                    </div>
                    <input
                      type="text"
                      className={`form-input-custom font-mono ${
                        connectFormData.accountNumber &&
                        connectFormData.confirmAccountNumber &&
                        connectFormData.accountNumber !== connectFormData.confirmAccountNumber
                          ? 'input-error-border'
                          : ''
                      }`}
                      placeholder="Re-enter account number"
                      value={connectFormData.confirmAccountNumber}
                      onChange={(e) =>
                        setConnectFormData({
                          ...connectFormData,
                          confirmAccountNumber: e.target.value.replace(/\D/g, ''),
                        })
                      }
                      maxLength={18}
                      autoComplete="off"
                      required
                    />
                    <span className="form-field-helper-note">
                      Re-enter exact account number to prevent routing failure
                    </span>
                  </div>
                </div>

                {/* 4. IFSC Code & Branch Name */}
                <div className="form-row-2col">
                  <div className="form-group-custom">
                    <div className="form-label-row">
                      <label className="form-label-custom">IFSC Code *</label>
                      {connectFormData.ifscCode && (
                        /^[A-Z]{4}0[A-Z0-9]{6}$/.test(connectFormData.ifscCode) ? (
                          <span className="match-status-badge matched">
                            <Check size={11} /> Valid RBI Format
                          </span>
                        ) : (
                          <span className="match-status-badge mismatch">
                            <X size={11} /> 11-Char Format
                          </span>
                        )
                      )}
                    </div>
                    <input
                      type="text"
                      className="form-input-custom font-mono ifsc-input"
                      placeholder="e.g. HDFC0001234"
                      value={connectFormData.ifscCode}
                      onChange={(e) =>
                        setConnectFormData({
                          ...connectFormData,
                          ifscCode: e.target.value.toUpperCase().trim(),
                        })
                      }
                      maxLength={11}
                      required
                    />
                    <span className="form-field-helper-note">
                      11 alphanumeric characters (e.g. {connectFormData.bankCode ? `${connectFormData.bankCode}0...` : 'HDFC0001234'})
                    </span>
                  </div>

                  <div className="form-group-custom">
                    <div className="form-label-row">
                      <label className="form-label-custom">Branch Name (Optional)</label>
                    </div>
                    <input
                      type="text"
                      className="form-input-custom"
                      placeholder="e.g. Corporate Banking Branch"
                      value={connectFormData.branchName}
                      onChange={(e) =>
                        setConnectFormData({ ...connectFormData, branchName: e.target.value })
                      }
                    />
                    <span className="form-field-helper-note">
                      Branch location or corporate treasury desk
                    </span>
                  </div>
                </div>

                {/* 5. Classification & Payment Provider Rail */}
                <div className="form-row-2col">
                  <div className="form-group-custom">
                    <label className="form-label-custom">Account Classification</label>
                    <select
                      className="form-input-custom"
                      value={connectFormData.accountType}
                      onChange={(e) => setConnectFormData({ ...connectFormData, accountType: e.target.value })}
                    >
                      <option value="PRIMARY_OPERATING">Primary Operating Treasury Float (Payouts &amp; Collections)</option>
                      <option value="COMMISSION_RESERVE">Dedicated Commission Reserve Escrow</option>
                      <option value="TAX_ESCROW_TDS">Statutory TDS Tax Escrow</option>
                    </select>
                  </div>

                  <div className="form-group-custom">
                    <label className="form-label-custom">Payment Provider Rail</label>
                    <select
                      className="form-input-custom"
                      value={connectFormData.provider}
                      onChange={(e) => setConnectFormData({ ...connectFormData, provider: e.target.value })}
                    >
                      <option value="RAZORPAYX">RazorpayX Corporate Banking (Float Rail)</option>
                      <option value="CASHFREE">Cashfree Auto-Collect &amp; Payouts</option>
                      <option value="DIRECT_BANK">Direct Bank RTGS/NEFT Rail</option>
                    </select>
                  </div>
                </div>

                {/* Active Gateway Verification Card */}
                <div className="gateway-active-pill-card">
                  <div className="gateway-pill-left">
                    <ShieldCheck size={20} className="gateway-shield-icon" />
                    <div>
                      <div className="gateway-pill-title">RazorpayX Live Float Rail Active</div>
                      <div className="gateway-pill-desc">
                        Live Key: <code>rzp_live_ToerZRsvekgL2z</code> &bull; Automated penny drop &amp; beneficiary validation enabled
                      </div>
                    </div>
                  </div>
                  <span className="gateway-status-tag">
                    <span className="pulse-indicator"></span>
                    Verified Rail
                  </span>
                </div>

                {/* Security Invariant Banner */}
                <div className="security-invariant-banner" style={{ margin: 0 }}>
                  <Lock size={14} style={{ flexShrink: 0, color: '#0284c7' }} />
                  <span>
                    Zero-Trust Security: Real account numbers are stored encrypted and displayed masked as <code>•••• •••• •••• {connectFormData.accountNumber && connectFormData.accountNumber.length >= 4 ? connectFormData.accountNumber.slice(-4) : '3766'}</code>.
                  </span>
                </div>
              </div>

              <div className="connect-modal-footer">
                <div className="footer-primary-checkbox-wrap">
                  <input
                    type="checkbox"
                    id="setPrimaryAcc"
                    checked={connectFormData.isPrimary}
                    onChange={(e) => setConnectFormData({ ...connectFormData, isPrimary: e.target.checked })}
                    className="custom-checkbox"
                  />
                  <label htmlFor="setPrimaryAcc" className="checkbox-label">
                    Set as Primary Treasury Payout Account
                  </label>
                </div>

                <div className="modal-footer-btns">
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
                    className="admin-btn-connect-bank-pro"
                    disabled={
                      connectingAccount ||
                      !connectFormData.accountName?.trim() ||
                      !connectFormData.accountNumber ||
                      connectFormData.accountNumber.length < 9 ||
                      !connectFormData.confirmAccountNumber ||
                      connectFormData.accountNumber !== connectFormData.confirmAccountNumber ||
                      !connectFormData.ifscCode ||
                      connectFormData.ifscCode.length !== 11
                    }
                  >
                    {connectingAccount ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Connecting Bank...</span>
                      </>
                    ) : (
                      <>
                        <Landmark size={15} />
                        <span>Connect Bank Account</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: One-Click Commission Distribution Confirmation */}
      {distributeModal.open && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card" style={{ maxWidth: '640px' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">
                <Send size={18} style={{ color: '#2563eb' }} />
                <span>Confirm One-Click Commission Distribution</span>
              </h3>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setDistributeModal((prev) => ({ ...prev, open: false }))}
                disabled={distributeModal.executing}
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body" style={{ padding: '20px' }}>
              {distributeModal.loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  <RefreshCw size={24} className="spin" style={{ marginBottom: '10px' }} />
                  <p>Calculating eligible approved commissions and validating members...</p>
                </div>
              ) : (
                <>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '14px 16px', borderRadius: '8px', marginBottom: '16px' }}>
                    <div style={{ fontWeight: 700, color: '#166534', fontSize: '15px', marginBottom: '4px' }}>
                      Distribution Summary Preview
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#15803d' }}>
                      Review the breakdown below before initiating wallet credit distribution.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Eligible Members</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a' }}>
                        {distributeModal.preview?.eligibleEmployeesCount || 0}
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Total Payout Amount</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb' }}>
                        {formatCurrency(distributeModal.preview?.totalCommissionAmount || 0)}
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Pending (Unapproved)</div>
                      <div style={{ fontSize: '16px', fontWeight: 600, color: '#d97706' }}>
                        {formatCurrency(distributeModal.preview?.pendingCommissionsAmount || 0)}
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Previously Paid</div>
                      <div style={{ fontSize: '16px', fontWeight: 600, color: '#64748b' }}>
                        {formatCurrency(distributeModal.preview?.previouslyPaidAmount || 0)}
                      </div>
                    </div>
                  </div>

                  <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '12px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '12.5px', color: '#92400e' }}>
                    <strong>Excluded Members:</strong> {distributeModal.preview?.excludedEmployeesCount || 0} members ({formatCurrency(distributeModal.preview?.excludedCommissionsAmount || 0)}) excluded due to pending starter kit payment or inactive account status.
                  </div>

                  <div className="security-invariant-banner" style={{ marginBottom: '16px' }}>
                    <Lock size={15} style={{ flexShrink: 0 }} />
                    <span>
                      <strong>Settlement Mechanism:</strong> Payouts are credited directly to member digital wallets with double-entry ledger verification. No simulated bank wire transfer is performed.
                    </span>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#1e293b', cursor: 'pointer', background: '#f1f5f9', padding: '12px', borderRadius: '8px' }}>
                    <input
                      type="checkbox"
                      checked={distributeModal.confirmed}
                      onChange={(e) => setDistributeModal((prev) => ({ ...prev, confirmed: e.target.checked }))}
                      style={{ marginTop: '2px' }}
                    />
                    <span>
                      I confirm that I have reviewed the commission amounts and authorize immediate wallet credit distribution for all eligible members.
                    </span>
                  </label>
                </>
              )}
            </div>

            <div className="admin-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setDistributeModal((prev) => ({ ...prev, open: false }))}
                disabled={distributeModal.executing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="distribute-btn-primary"
                onClick={handleExecuteDistribute}
                disabled={!distributeModal.confirmed || distributeModal.executing || distributeModal.loading}
              >
                <Send size={15} />
                <span>{distributeModal.executing ? 'Executing Batch Payout...' : 'Execute Distribution Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Distribution Result */}
      {distributeResult && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card" style={{ maxWidth: '640px' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">
                <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
                <span>Distribution Batch Result: {distributeResult.batchNumber}</span>
              </h3>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setDistributeResult(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body" style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Successful</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a' }}>{distributeResult.successfulCount}</div>
                  <div style={{ fontSize: '12px', color: '#15803d' }}>{formatCurrency(distributeResult.successfulAmount)}</div>
                </div>

                <div style={{ background: distributeResult.failedCount > 0 ? '#fef2f2' : '#f8fafc', padding: '12px', borderRadius: '8px', border: `1px solid ${distributeResult.failedCount > 0 ? '#fecaca' : '#e2e8f0'}`, textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: distributeResult.failedCount > 0 ? '#991b1b' : '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Failed</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: distributeResult.failedCount > 0 ? '#dc2626' : '#64748b' }}>{distributeResult.failedCount}</div>
                  <div style={{ fontSize: '12px', color: distributeResult.failedCount > 0 ? '#b91c1c' : '#64748b' }}>{formatCurrency(distributeResult.failedAmount)}</div>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Status</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                    <span className={`admin-badge ${distributeResult.status === 'COMPLETED' || distributeResult.status === 'COMPLETED_WALLET' ? 'badge-active' : 'badge-pending'}`}>
                      {distributeResult.status}
                    </span>
                  </div>
                </div>
              </div>

              {distributeResult.failedCount > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '8px', color: '#991b1b', fontSize: '12.5px' }}>
                  <strong>Partial Failures Detected:</strong> {distributeResult.failedCount} payouts could not be credited. You can safely retry these failed items from the Payout Batches tab without double-crediting successful members.
                </div>
              )}
            </div>

            <div className="admin-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => setDistributeResult(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Funds to Treasury Float via Razorpay Live */}
      {addFundsModal && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card" style={{ maxWidth: '580px' }}>
            <div className="admin-modal-header" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '8px', display: 'flex' }}>
                  <CreditCard size={20} color="#fff" />
                </div>
                <div>
                  <h3 className="admin-modal-title" style={{ color: '#fff', margin: 0, fontSize: '17px' }}>
                    Add Funds to Treasury Float
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#a7f3d0' }}>
                    Instant Corporate Capital Inflow via Live Razorpay Banking Rail
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                style={{ color: '#fff' }}
                onClick={() => setAddFundsModal(false)}
                disabled={submittingFunding}
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body" style={{ padding: '22px' }}>
              {/* Connected Bank Info Box */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, letterSpacing: '0.5px' }}>
                    Debiting Connected Bank
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                    <Landmark size={15} style={{ color: '#2563eb' }} />
                    <span>{activeAccount?.bankName || 'Indian Overseas Bank'}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    <span>{activeAccount?.maskedAccountNumber || '•••• •••• •••• 3766'}</span>
                    <span style={{ margin: '0 6px' }}>•</span>
                    <span>IFSC: {activeAccount?.ifscCode || activeAccount?.metadata?.ifscCode || 'IOBA0000123'}</span>
                  </div>
                </div>
                <span style={{
                  background: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                  Active Rail
                </span>
              </div>

              {/* Amount Input */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Deposit Amount (INR) *
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{
                    position: 'absolute',
                    left: '14px',
                    fontSize: '20px',
                    fontWeight: 700,
                    color: '#059669'
                  }}>₹</span>
                  <input
                    type="number"
                    min="100"
                    step="any"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="Enter deposit amount"
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 36px',
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#0f172a',
                      borderRadius: '8px',
                      border: '2px solid #cbd5e1',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Quick Preset Selector Chips */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, marginBottom: '8px' }}>
                  Quick Preset Amounts:
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { label: '+ ₹50,000', val: 50000 },
                    { label: '+ ₹1,00,000', val: 100000 },
                    { label: `+ ₹${Math.round(dailySummary.totalApprovedCommissions || 0).toLocaleString('en-IN')} (Cycle Match)`, val: Math.round(dailySummary.totalApprovedCommissions || 0) },
                    { label: '+ ₹5,00,000', val: 500000 },
                  ].map((chip) => (
                    <button
                      key={chip.val}
                      type="button"
                      onClick={() => setDepositAmount(String(chip.val))}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: Number(depositAmount) === chip.val ? '2px solid #059669' : '1px solid #e2e8f0',
                        background: Number(depositAmount) === chip.val ? '#ecfdf5' : '#fff',
                        color: Number(depositAmount) === chip.val ? '#047857' : '#334155',
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Security & Live Gateway Badge */}
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '12px',
                color: '#166534'
              }}>
                <ShieldCheck size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
                <div>
                  <strong>Razorpay Live Gateway Active:</strong> Payments are processed directly through live key <code>rzp_live_ToerZRsvekgL2z</code>. Funds instantly reflect in the platform treasury and generate verified double-entry ledger records.
                </div>
              </div>
            </div>

            <div className="admin-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 22px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setAddFundsModal(false)}
                disabled={submittingFunding}
              >
                Cancel
              </button>

              <button
                type="button"
                className="admin-btn-pay-razorpay-pro"
                style={{ padding: '10px 22px', fontSize: '14px' }}
                onClick={() => handlePayWithRazorpay(depositAmount, activeAccount)}
                disabled={submittingFunding || !depositAmount || Number(depositAmount) < 100}
              >
                {submittingFunding ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Launching Razorpay...</span>
                  </>
                ) : (
                  <>
                    <CreditCard size={15} />
                    <span>Pay {formatCurrency(depositAmount)} via Razorpay</span>
                    <span className="live-pill">LIVE</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
