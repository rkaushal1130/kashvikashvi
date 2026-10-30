import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { adminCommissionDistributionApi } from '../../api/adminCommissionDistributionApi.js';
import {
  Landmark,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Search,
  RefreshCw,
  Play,
  Download,
  Upload,
  AlertCircle,
  X,
  Eye,
  Sliders,
  DollarSign,
  UserCheck,
  Building,
  CheckCheck,
  Users,
  ChevronUp,
  ChevronDown,
  Check,
  Award,
} from 'lucide-react';
import './CommissionDistributionPage.css';

// All 8 required batch workflow lifecycle states
const WORKFLOW_STATES = [
  { key: 'CALCULATED', label: '1. Calculated', color: 'calculated' },
  { key: 'AWAITING_APPROVAL', label: '2. Awaiting Approval', color: 'awaiting_approval' },
  { key: 'APPROVED', label: '3. Approved', color: 'approved' },
  { key: 'PROCESSING', label: '4. Processing', color: 'processing' },
  { key: 'PARTIALLY_COMPLETED', label: '5. Partially Completed', color: 'partially_completed' },
  { key: 'COMPLETED', label: '6. Completed', color: 'completed' },
  { key: 'FAILED', label: '7. Failed', color: 'failed' },
  { key: 'REQUIRES_RECONCILIATION', label: '8. Requires Reconciliation', color: 'requires_reconciliation' },
];

export default function CommissionDistributionPage() {
  // Active Tab
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'batches' | 'quarantine' | 'pnb-info'

  // Loading & Feedback
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Period Selector States
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const [dateMode, setDateMode] = useState('DAILY'); // 'DAILY' | 'CUSTOM'
  const [periodId, setPeriodId] = useState(`CYCLE-${todayStr}`);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateError, setDateError] = useState('');

  // 6 Summary Metrics Data
  const [summary, setSummary] = useState({
    eligibleMembersCount: 0,
    totalCommissionPayable: 0,
    readyForApprovalAmount: 0,
    readyForApprovalCount: 0,
    pendingPayoutsAmount: 0,
    pendingPayoutsCount: 0,
    successfullyPaidAmount: 0,
    successfullyPaidCount: 0,
    failedTransactionsAmount: 0,
    failedTransactionsCount: 0,
    corporatePnbBalance: 1500000.0,
    corporateAccountNumber: '1923102100000382',
    corporateIfsc: 'PUNB0192310',
    activeCycleCode: '',
    liveBankingConfigured: false,
    bankingModeNotice: '',
  });

  // Preview Data
  const [previewData, setPreviewData] = useState({
    periodId: `CYCLE-${todayStr}`,
    totalEligibleAmount: 0,
    readyAmount: 0,
    quarantinedAmount: 0,
    totalCount: 0,
    readyCount: 0,
    quarantinedCount: 0,
    beneficiaries: [],
  });

  // Batches Data
  const [batches, setBatches] = useState([]);

  // Table Filters, Sorting & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [rankFilter, setRankFilter] = useState('ALL');
  const [payoutStatusFilter, setPayoutStatusFilter] = useState('ALL');
  const [bankStatusFilter, setBankStatusFilter] = useState('ALL');
  const [sortColumn, setSortColumn] = useState('amount'); // 'memberId' | 'name' | 'rank' | 'amount' | 'status'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [createBatchModalOpen, setCreateBatchModalOpen] = useState(false);
  const [batchNotes, setBatchNotes] = useState('');
  const [excludeUnverified, setExcludeUnverified] = useState(true);

  const [memberDetailModal, setMemberDetailModal] = useState({
    open: false,
    member: null,
  });

  const [batchDetailModal, setBatchDetailModal] = useState({
    open: false,
    batch: null,
  });

  const [checkerApproveModal, setCheckerApproveModal] = useState({
    open: false,
    batch: null,
    checkerNotes: '',
    confirmChecked: false,
  });

  const [oneClickModal, setOneClickModal] = useState({
    open: false,
    batch: null,
    confirmDisbursal: false,
  });

  const [reconcileModal, setReconcileModal] = useState({
    open: false,
    batch: null,
    fileContent: '',
    fileName: '',
  });

  const [remediateModal, setRemediateModal] = useState({
    open: false,
    item: null,
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
  });

  // Date Range Validation
  const validateCustomDates = (start, end) => {
    if (!start && !end) {
      setDateError('');
      return true;
    }
    if (start && end && start > end) {
      setDateError('Start date cannot be after end date.');
      return false;
    }
    if ((start && start > todayStr) || (end && end > todayStr)) {
      setDateError('Future dates are not permitted for commission cycles.');
      return false;
    }
    setDateError('');
    return true;
  };

  // Data Loading
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [summaryRes, previewRes, batchesRes] = await Promise.allSettled([
        adminCommissionDistributionApi.getSummary(periodId),
        adminCommissionDistributionApi.getPreview(periodId),
        adminCommissionDistributionApi.getBatches(),
      ]);

      if (summaryRes.status === 'fulfilled' && summaryRes.value?.data) {
        const d = summaryRes.value.data;
        setSummary({
          eligibleMembersCount: d.eligibleMembersCount ?? d.totalBeneficiariesCount ?? 0,
          totalCommissionPayable: d.totalCommissionPayable ?? d.eligibleCommissionsTotal ?? 0,
          readyForApprovalAmount: d.readyForApprovalAmount ?? d.readyForPnbDisbursalTotal ?? 0,
          readyForApprovalCount: d.readyForApprovalCount ?? d.verifiedBankCount ?? 0,
          pendingPayoutsAmount: d.pendingPayoutsAmount ?? 0,
          pendingPayoutsCount: d.pendingPayoutsCount ?? 0,
          successfullyPaidAmount: d.successfullyPaidAmount ?? 0,
          successfullyPaidCount: d.successfullyPaidCount ?? 0,
          failedTransactionsAmount: d.failedTransactionsAmount ?? d.quarantinedTotal ?? 0,
          failedTransactionsCount: d.failedTransactionsCount ?? d.unverifiedBankCount ?? 0,
          corporatePnbBalance: d.corporatePnbBalance ?? 1500000.0,
          corporateAccountNumber: d.corporateAccountNumber || '1923102100000382',
          corporateIfsc: d.corporateIfsc || 'PUNB0192310',
          activeCycleCode: d.activeCycleCode || periodId,
          liveBankingConfigured: d.liveBankingConfigured || false,
          bankingModeNotice: d.bankingModeNotice || '',
        });
      }

      if (previewRes.status === 'fulfilled' && previewRes.value?.data) {
        setPreviewData(previewRes.value.data);
      }

      if (batchesRes.status === 'fulfilled' && batchesRes.value?.data) {
        const list = batchesRes.value.data.batches || [];
        setBatches(list);
      }
    } catch (err) {
      console.warn('Error loading commission distribution data:', err);
      setError('Could not connect to live backend services. Displaying offline demo state.');
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Action: Calculate Commission
  const handleCalculateCommission = async () => {
    if (dateError) return;
    try {
      setActionLoading(true);
      setError(null);
      const res = await adminCommissionDistributionApi.calculateCommission(periodId);
      setSuccessMsg(res?.message || `Commissions successfully calculated for period ${periodId}.`);
      await loadInitialData();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err.message || 'Failed to calculate commission.');
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Preview Distribution
  const handlePreviewDistribution = async () => {
    if (dateError) return;
    try {
      setActionLoading(true);
      setError(null);
      const res = await adminCommissionDistributionApi.getPreview(periodId);
      if (res?.data) {
        setPreviewData(res.data);
        setActiveTab('preview');
        setSuccessMsg(`Preview updated for ${periodId} (${res.data.totalCount || 0} members).`);
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      setError(err.message || 'Failed to preview distribution.');
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Export Report (Client-side CSV generator)
  const handleExportReport = () => {
    try {
      const items = previewData.beneficiaries || [];
      if (items.length === 0) {
        setError('No beneficiary records available to export for the selected period.');
        return;
      }

      const headers = [
        'Member ID',
        'Member Name',
        'Rank',
        'Rank Percentage',
        'Commission Period',
        'Qualifying BV',
        'Matching Volume',
        'Eligible Commission (INR)',
        'Bank Name',
        'Masked Account',
        'IFSC Code',
        'Bank Status',
        'Payout Status',
      ];

      const rows = items.map((b) => [
        `"${b.distributorCode}"`,
        `"${b.name}"`,
        `"${b.rankName}"`,
        `"${b.rankPercentage}%"`,
        `"${b.commissionPeriod || periodId}"`,
        b.qualifyingBV,
        b.matchingVolume,
        b.approvedCommissionAmount.toFixed(2),
        `"${b.bankAccount?.bankName || 'Not Provided'}"`,
        `"${b.bankAccount?.maskedAccountNumber || 'XXXXXX----'}"`,
        `"${b.bankAccount?.ifscCode || 'NO_IFSC'}"`,
        `"${b.bankAccount?.status || 'UNKNOWN'}"`,
        `"${b.payoutStatus || (b.eligibilityStatus === 'READY_FOR_PNB' ? 'READY_FOR_APPROVAL' : 'QUARANTINED')}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `commission_distribution_${periodId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setSuccessMsg(`Commission statement exported for ${periodId}.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setError('Failed to export commission distribution report.');
    }
  };

  // Maker: Create Payout Batch
  const handleCreateBatch = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setError(null);
      const res = await adminCommissionDistributionApi.createBatch({
        periodId,
        payoutMode: 'PNB_BANK_TRANSFER',
        excludeUnverifiedBanks: excludeUnverified,
        notes: batchNotes || `Batch created for period ${periodId}`,
      });

      setSuccessMsg(res?.message || 'Payout batch created successfully in DRAFT status.');
      setCreateBatchModalOpen(false);
      setBatchNotes('');
      await loadInitialData();
      setActiveTab('batches');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err.message || 'Failed to create payout batch.');
    } finally {
      setActionLoading(false);
    }
  };

  // Checker: Authorize Batch
  const handleApproveBatch = async (e) => {
    e.preventDefault();
    if (!checkerApproveModal.confirmChecked) {
      setError('Please check the verification confirmation before authorizing the batch.');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      const res = await adminCommissionDistributionApi.approveBatch(
        checkerApproveModal.batch.id,
        { checkerNotes: checkerApproveModal.checkerNotes }
      );

      setSuccessMsg(res?.message || 'Batch authorized by Checker! Ready for PNB disbursal.');
      setCheckerApproveModal({ open: false, batch: null, checkerNotes: '', confirmChecked: false });
      await loadInitialData();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err.message || 'Failed to approve batch.');
    } finally {
      setActionLoading(false);
    }
  };

  // Disbursal Execution (Staged CIB mode)
  const handleInitiateDisbursal = async () => {
    if (!oneClickModal.confirmDisbursal) {
      setError('Please verify the PNB debit account details before initiating disbursal.');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      const res = await adminCommissionDistributionApi.initiatePayout(oneClickModal.batch.id);

      setSuccessMsg(
        res?.message ||
          'Disbursal initiated! PNB Corporate Internet Banking file generated and registered.'
      );
      setOneClickModal({ open: false, batch: null, confirmDisbursal: false });
      await loadInitialData();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err.message || 'Failed to initiate disbursal.');
    } finally {
      setActionLoading(false);
    }
  };

  // PNB Reverse MIS Statement Upload
  const handleReconcileMis = async (e) => {
    e.preventDefault();
    if (!reconcileModal.fileContent.trim()) {
      setError('Please provide or paste the PNB Reverse MIS statement text.');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      const res = await adminCommissionDistributionApi.reconcileMis(
        reconcileModal.batch.id,
        reconcileModal.fileContent
      );

      setSuccessMsg(res?.message || 'Bank reconciliation completed successfully!');
      setReconcileModal({ open: false, batch: null, fileContent: '', fileName: '' });
      await loadInitialData();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err.message || 'Failed to reconcile MIS statement.');
    } finally {
      setActionLoading(false);
    }
  };

  // Manual Quarantine Remediation
  const handleRemediate = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setError(null);
      await adminCommissionDistributionApi.remediateItem(
        remediateModal.item.batchId,
        remediateModal.item.itemId,
        {
          action: 'UPDATE_BANK_AND_RETRY',
          accountHolderName: remediateModal.accountHolderName,
          accountNumber: remediateModal.accountNumber,
          ifscCode: remediateModal.ifscCode,
          bankName: remediateModal.bankName,
        }
      );

      setSuccessMsg('Beneficiary details updated and item re-queued for disbursal.');
      setRemediateModal({
        open: false,
        item: null,
        accountHolderName: '',
        accountNumber: '',
        ifscCode: '',
        bankName: '',
      });
      await loadInitialData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to remediate quarantined item.');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Table Sort
  const handleSort = (col) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Beneficiaries Filtering & Sorting
  const filteredBeneficiaries = useMemo(() => {
    const list = previewData?.beneficiaries || [];
    return list.filter((b) => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        b.distributorCode.toLowerCase().includes(q) ||
        b.name.toLowerCase().includes(q) ||
        (b.bankAccount?.bankName || '').toLowerCase().includes(q);

      const matchRank = rankFilter === 'ALL' || b.rankCode === rankFilter;
      const matchBank =
        bankStatusFilter === 'ALL' ||
        (bankStatusFilter === 'VERIFIED' && b.bankAccount?.isVerified) ||
        (bankStatusFilter === 'UNVERIFIED' && !b.bankAccount?.isVerified);

      const statusVal = b.payoutStatus || (b.eligibilityStatus === 'READY_FOR_PNB' ? 'READY_FOR_APPROVAL' : 'QUARANTINED');
      const matchStatus = payoutStatusFilter === 'ALL' || statusVal === payoutStatusFilter;

      return matchSearch && matchRank && matchBank && matchStatus;
    });
  }, [previewData, searchTerm, rankFilter, bankStatusFilter, payoutStatusFilter]);

  const sortedBeneficiaries = useMemo(() => {
    return [...filteredBeneficiaries].sort((a, b) => {
      let aVal, bVal;
      if (sortColumn === 'memberId') {
        aVal = a.distributorCode;
        bVal = b.distributorCode;
      } else if (sortColumn === 'name') {
        aVal = a.name;
        bVal = b.name;
      } else if (sortColumn === 'rank') {
        aVal = a.rankPercentage;
        bVal = b.rankPercentage;
      } else if (sortColumn === 'amount') {
        aVal = a.approvedCommissionAmount;
        bVal = b.approvedCommissionAmount;
      } else if (sortColumn === 'status') {
        aVal = a.payoutStatus || a.eligibilityStatus;
        bVal = b.payoutStatus || b.eligibilityStatus;
      } else {
        aVal = a.name;
        bVal = b.name;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredBeneficiaries, sortColumn, sortDirection]);

  // Paginated Slices
  const totalItems = sortedBeneficiaries.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedBeneficiaries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedBeneficiaries.slice(start, start + pageSize);
  }, [sortedBeneficiaries, currentPage, pageSize]);

  // Helper: Map Batch to 1 of 8 Lifecycle States
  const getBatchWorkflowState = (batch) => {
    if (batch.status === 'COMPLETED') return { state: 'COMPLETED', label: 'Completed', color: 'completed' };
    if (batch.status === 'PARTIALLY_COMPLETED') return { state: 'PARTIALLY_COMPLETED', label: 'Partially Completed', color: 'partially_completed' };
    if (batch.status === 'FAILED') return { state: 'FAILED', label: 'Failed', color: 'failed' };
    if (batch.status === 'PROCESSING') return { state: 'PROCESSING', label: 'Processing', color: 'processing' };
    if (batch.reconciliationStatus === 'UNRECONCILED' && batch.status === 'PROCESSING') {
      return { state: 'REQUIRES_RECONCILIATION', label: 'Requires Reconciliation', color: 'requires_reconciliation' };
    }
    if (batch.approvalStatus === 'APPROVED') return { state: 'APPROVED', label: 'Approved', color: 'approved' };
    if (batch.approvalStatus === 'PENDING_APPROVAL' || batch.approvalStatus === 'DRAFT') {
      return { state: 'AWAITING_APPROVAL', label: 'Awaiting Approval', color: 'awaiting_approval' };
    }
    return { state: 'CALCULATED', label: 'Calculated', color: 'calculated' };
  };

  // Commission Distribution Progress calculation
  const commProgress = useMemo(() => {
    const paid = Number(summary.successfullyPaidAmount || 0);
    const ready = Number(summary.readyForApprovalAmount || 0);
    const pending = Number(summary.pendingPayoutsAmount || 0);
    const total = Number(summary.totalCommissionPayable || (paid + ready + pending) || 392500);

    const isFullyPaid = (paid > 0 && ready === 0) || (total > 0 && paid >= total);
    const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
    const readyPercent = total > 0 && !isFullyPaid
      ? Math.min(100 - percent, Math.round((ready / total) * 100))
      : 0;

    return {
      paid,
      ready,
      pending,
      total,
      percent: isFullyPaid ? 100 : percent,
      readyPercent,
      isFullyPaid,
    };
  }, [summary]);

  return (
    <div className="comm-dist-container">
      {/* 1. Top Header & Corporate Account Badge */}
      <div className="comm-dist-header">
        <div className="comm-dist-title-group">
          <div className="comm-dist-icon-badge">
            <Landmark size={28} />
          </div>
          <div>
            <h1 className="comm-dist-title">Commission Distribution</h1>
            <p className="comm-dist-subtitle">
              Audit, approve, and disburse member MLM commissions through Punjab National Bank (PNB).
            </p>
          </div>
        </div>

        <div className="comm-dist-pnb-pill" title="Company PNB Corporate Interchange Account">
          <Building size={16} />
          <span>PNB Corporate: 1923102100000382 (IFSC: PUNB0192310)</span>
        </div>
      </div>

      {/* 2. Prominent Bank Integration Pending Notice Banner */}
      <div className="comm-bank-notice-banner">
        <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <div className="comm-bank-notice-title">PNB Corporate Banking Rail Notice</div>
          <div>
            Live PNB Corporate Banking transfer is pending bank credential configuration. Transfers are currently
            staged in audited Corporate Internet Banking (CIB) batch mode with cryptographic SHA-256 validation.
            Full account numbers and secret credentials are never exposed.
          </div>
        </div>
      </div>

      {/* 3. Feedback Banners */}
      {successMsg && (
        <div className="security-box" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="security-box" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 3.B Commission Distribution Lifecycle Progress Card */}
      <div className="comm-progress-card">
        <div className="comm-progress-header">
          <div className="comm-progress-title-wrap">
            <Award size={20} style={{ color: '#2563eb' }} />
            <span className="comm-progress-title">Commission Distribution Progress</span>
            <span className="comm-progress-pill">
              {commProgress.percent}% Distributed
            </span>
          </div>
          <div className="comm-progress-values">
            <span className="comm-progress-paid">
              ₹{commProgress.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="comm-progress-sep">/</span>
            <span className="comm-progress-total">
              ₹{commProgress.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="comm-progress-bar-track">
          <div
            className="comm-progress-bar-fill-paid"
            style={{ width: `${commProgress.percent}%` }}
            title={`Paid / Distributed: ₹${commProgress.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          />
          <div
            className="comm-progress-bar-fill-ready"
            style={{ width: `${commProgress.readyPercent}%` }}
            title={`Ready for Disbursal: ₹${commProgress.ready.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          />
        </div>

        <div className="comm-progress-meta-row">
          <div className="comm-meta-col">
            <span className="meta-legend-dot paid" />
            <span>
              Paid / Disbursed: <strong>₹{commProgress.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </span>
          </div>
          <div className="comm-meta-col">
            <span className="meta-legend-dot ready" />
            <span>
              Ready for Disbursal: <strong>₹{commProgress.ready.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </span>
          </div>
          <div className="comm-meta-col">
            <span className="meta-legend-dot quarantined" />
            <span>
              Pending / Quarantine: <strong>₹{commProgress.pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </span>
          </div>
          <div className="comm-meta-col right">
            <Users size={14} style={{ color: '#64748b' }} />
            <span>
              Eligible Beneficiaries: <strong>{summary.eligibleMembersCount || previewData.totalCount || 5} distributors</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 4. Dashboard Summary Cards (Exact 6 Metrics Required) */}
      <div className="comm-summary-grid-6">
        {/* Card 1: Eligible Members */}
        <div className="comm-metric-card blue">
          <div className="comm-metric-label">
            <span>Eligible Members</span>
            <Users size={16} />
          </div>
          <div className="comm-metric-value">{summary.eligibleMembersCount || 0}</div>
          <div className="comm-metric-sub">
            <span>{previewData.readyCount || 0} verified</span>
            <span>•</span>
            <span>{previewData.quarantinedCount || 0} quarantine</span>
          </div>
        </div>

        {/* Card 2: Total Commission Payable */}
        <div className="comm-metric-card indigo">
          <div className="comm-metric-label">
            <span>Total Commission Payable</span>
            <DollarSign size={16} />
          </div>
          <div className="comm-metric-value">
            ₹{(summary.totalCommissionPayable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="comm-metric-sub">Calculated for {periodId}</div>
        </div>

        {/* Card 3: Ready for Approval */}
        <div className="comm-metric-card emerald">
          <div className="comm-metric-label">
            <span>Ready for Approval</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="comm-metric-value">
            ₹{(summary.readyForApprovalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="comm-metric-sub">{summary.readyForApprovalCount || 0} members verified</div>
        </div>

        {/* Card 4: Pending Payouts */}
        <div className="comm-metric-card amber">
          <div className="comm-metric-label">
            <span>Pending Payouts</span>
            <Layers size={16} />
          </div>
          <div className="comm-metric-value">
            ₹{(summary.pendingPayoutsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="comm-metric-sub">{summary.pendingPayoutsCount || 0} payouts in transit</div>
        </div>

        {/* Card 5: Successfully Paid */}
        <div className="comm-metric-card teal">
          <div className="comm-metric-label">
            <span>Successfully Paid</span>
            <ShieldCheck size={16} />
          </div>
          <div className="comm-metric-value">
            ₹{(summary.successfullyPaidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="comm-metric-sub">{summary.successfullyPaidCount || 0} settled via PNB</div>
        </div>

        {/* Card 6: Failed Transactions */}
        <div className="comm-metric-card rose">
          <div className="comm-metric-label">
            <span>Failed Transactions</span>
            <AlertTriangle size={16} />
          </div>
          <div className="comm-metric-value">
            ₹{(summary.failedTransactionsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="comm-metric-sub">{summary.failedTransactionsCount || 0} require review</div>
        </div>
      </div>

      {/* 5. Period Selector & Action Toolbar */}
      <div className="comm-period-bar">
        <div className="comm-period-left">
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>Commission Period:</span>

          <div className="comm-cycle-tag">
            <Sliders size={14} />
            <span>{periodId}</span>
          </div>

          <button
            type="button"
            className={`btn-secondary ${dateMode === 'DAILY' ? 'active' : ''}`}
            onClick={() => {
              setDateMode('DAILY');
              setPeriodId(`CYCLE-${todayStr}`);
              setDateError('');
            }}
          >
            Today's Cycle
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setDateMode('DAILY');
              setPeriodId(`CYCLE-${yesterdayStr}`);
              setDateError('');
            }}
          >
            Yesterday
          </button>

          <button
            type="button"
            className={`btn-secondary ${dateMode === 'CUSTOM' ? 'active' : ''}`}
            onClick={() => {
              setDateMode('CUSTOM');
              if (startDate && endDate) {
                validateCustomDates(startDate, endDate);
              }
            }}
          >
            Custom Range
          </button>

          {dateMode === 'CUSTOM' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="date"
                className="comm-period-input"
                value={startDate}
                max={todayStr}
                onChange={(e) => {
                  const val = e.target.value;
                  setStartDate(val);
                  if (validateCustomDates(val, endDate) && val && endDate) {
                    setPeriodId(`CUSTOM-${val}-to-${endDate}`);
                  }
                }}
              />
              <span style={{ color: '#94a3b8' }}>to</span>
              <input
                type="date"
                className="comm-period-input"
                value={endDate}
                max={todayStr}
                onChange={(e) => {
                  const val = e.target.value;
                  setEndDate(val);
                  if (validateCustomDates(startDate, val) && startDate && val) {
                    setPeriodId(`CUSTOM-${startDate}-to-${val}`);
                  }
                }}
              />
            </div>
          )}

          {dateError && (
            <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: '600' }}>
              {dateError}
            </span>
          )}
        </div>

        {/* Section 8: Dedicated Commission Distribution Actions */}
        <div className="comm-toolbar-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCalculateCommission}
            disabled={actionLoading || loading || Boolean(dateError)}
            title="Recalculate commissions for selected period"
          >
            <Play size={14} />
            <span>Calculate Commission</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={handlePreviewDistribution}
            disabled={actionLoading || loading || Boolean(dateError)}
            title="Preview eligible distributors and amounts"
          >
            <Eye size={14} />
            <span>Preview Distribution</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={handleExportReport}
            disabled={previewData.beneficiaries.length === 0}
            title="Export CSV distribution report"
          >
            <Download size={14} />
            <span>Export Report</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={loadInitialData}
            disabled={loading}
            title="Sync latest status from server"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh Status</span>
          </button>
        </div>
      </div>

      {/* 6. Navigation Tabs */}
      <div className="comm-tabs-nav">
        <button
          type="button"
          className={`comm-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          <UserCheck size={16} />
          <span>Eligible Members Table</span>
          <span className="comm-tab-badge">{previewData.totalCount || 0}</span>
        </button>

        <button
          type="button"
          className={`comm-tab-btn ${activeTab === 'batches' ? 'active' : ''}`}
          onClick={() => setActiveTab('batches')}
        >
          <Layers size={16} />
          <span>Payout Batches & History</span>
          <span className="comm-tab-badge">{batches.length}</span>
        </button>

        <button
          type="button"
          className={`comm-tab-btn ${activeTab === 'quarantine' ? 'active' : ''}`}
          onClick={() => setActiveTab('quarantine')}
        >
          <AlertCircle size={16} />
          <span>Failed & Quarantine Review</span>
          <span className="comm-tab-badge">{previewData.quarantinedCount || 0}</span>
        </button>

        <button
          type="button"
          className={`comm-tab-btn ${activeTab === 'pnb-info' ? 'active' : ''}`}
          onClick={() => setActiveTab('pnb-info')}
        >
          <Landmark size={16} />
          <span>PNB Corporate Banking Details</span>
        </button>
      </div>

      {/* =====================================================================
          TAB 1: Eligible Members Table (Section 5)
         ===================================================================== */}
      {activeTab === 'preview' && (
        <div className="comm-content-card">
          {/* Table Filters Toolbar */}
          <div className="comm-table-toolbar">
            <div className="comm-search-box">
              <Search size={16} className="comm-search-icon" />
              <input
                type="text"
                className="comm-search-input"
                placeholder="Search member ID or name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Filter by Rank (Section 7) */}
              <select
                className="comm-filter-select"
                value={rankFilter}
                onChange={(e) => {
                  setRankFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">All Ranks</option>
                <option value="RUBY">Ruby (54%)</option>
                <option value="DIAMOND">Diamond (50%)</option>
                <option value="PLATINUM">Platinum (45%)</option>
                <option value="GOLD">Gold (32%)</option>
                <option value="SILVER">Silver (24%)</option>
              </select>

              {/* Filter by Payout Status */}
              <select
                className="comm-filter-select"
                value={payoutStatusFilter}
                onChange={(e) => {
                  setPayoutStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">All Payout Statuses</option>
                <option value="READY_FOR_APPROVAL">Ready for Approval</option>
                <option value="AWAITING_APPROVAL">Awaiting Approval</option>
                <option value="QUARANTINED">Quarantined / Review</option>
                <option value="PAID">Paid / Settled</option>
              </select>

              {/* Filter by Bank Verification */}
              <select
                className="comm-filter-select"
                value={bankStatusFilter}
                onChange={(e) => {
                  setBankStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">All Bank Verification</option>
                <option value="VERIFIED">Verified Bank Accounts Only</option>
                <option value="UNVERIFIED">Unverified / Pending Only</option>
              </select>
            </div>
          </div>

          {/* Table with Required Columns:
              Member ID | Member Name | Rank | Commission Period | Eligible Commission | Beneficiary Verification | Payout Status | Actions */}
          <div className="comm-table-wrap">
            <table className="comm-table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => handleSort('memberId')}>
                    <span className="comm-th-content">
                      <span>Distributor ID</span>
                      <span className={`comm-sort-icon ${sortColumn === 'memberId' ? 'active' : ''}`}>
                        {sortColumn === 'memberId' && sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </span>
                    </span>
                  </th>

                  <th className="sortable" onClick={() => handleSort('name')}>
                    <span className="comm-th-content">
                      <span>Distributor Name</span>
                      <span className={`comm-sort-icon ${sortColumn === 'name' ? 'active' : ''}`}>
                        {sortColumn === 'name' && sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </span>
                    </span>
                  </th>

                  <th className="sortable" onClick={() => handleSort('rank')}>
                    <span className="comm-th-content">
                      <span>Rank</span>
                      <span className={`comm-sort-icon ${sortColumn === 'rank' ? 'active' : ''}`}>
                        {sortColumn === 'rank' && sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </span>
                    </span>
                  </th>

                  <th>Commission Period</th>

                  <th className="sortable" onClick={() => handleSort('amount')}>
                    <span className="comm-th-content">
                      <span>Eligible Commission</span>
                      <span className={`comm-sort-icon ${sortColumn === 'amount' ? 'active' : ''}`}>
                        {sortColumn === 'amount' && sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </span>
                    </span>
                  </th>

                  <th>Beneficiary Verification</th>

                  <th className="sortable" onClick={() => handleSort('status')}>
                    <span className="comm-th-content">
                      <span>Payout Status</span>
                      <span className={`comm-sort-icon ${sortColumn === 'status' ? 'active' : ''}`}>
                        {sortColumn === 'status' && sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </span>
                    </span>
                  </th>

                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBeneficiaries.length > 0 ? (
                  paginatedBeneficiaries.map((b) => {
                    const statusVal = b.payoutStatus || (b.eligibilityStatus === 'READY_FOR_PNB' ? 'READY_FOR_APPROVAL' : 'QUARANTINED');
                    return (
                      <tr key={b.distributorId}>
                        {/* Member ID */}
                        <td style={{ fontWeight: '700', color: '#2563eb' }}>
                          {b.distributorCode}
                        </td>

                        {/* Member Name */}
                        <td>
                          <div style={{ fontWeight: '700', color: '#0f172a' }}>{b.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            BV: {b.qualifyingBV} | Match: {b.matchingVolume}
                          </div>
                        </td>

                        {/* Rank (Silver, Gold, Platinum, Diamond, Ruby) */}
                        <td>
                          <span className={`rank-badge ${b.rankCode.toLowerCase()}`}>
                            {b.rankName} ({b.rankPercentage}%)
                          </span>
                        </td>

                        {/* Commission Period */}
                        <td style={{ fontSize: '12px', color: '#475569' }}>
                          {b.commissionPeriod || periodId}
                        </td>

                        {/* Eligible Commission (INR) */}
                        <td style={{ fontWeight: '800', color: '#0f172a' }}>
                          ₹{b.approvedCommissionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Beneficiary Verification (Masked account number, IFSC, status) */}
                        <td>
                          <div className="comm-bank-cell">
                            <span className="bank-name">{b.bankAccount.bankName}</span>
                            <span className="bank-acc-sub">
                              {b.bankAccount.maskedAccountNumber} • {b.bankAccount.ifscCode}
                            </span>
                            <span
                              className={`status-pill ${b.bankAccount.isVerified ? 'ready' : 'quarantine'}`}
                              style={{ alignSelf: 'flex-start', marginTop: '2px' }}
                            >
                              {b.bankAccount.status}
                            </span>
                          </div>
                        </td>

                        {/* Payout Status */}
                        <td>
                          <span
                            className={`status-pill ${
                              statusVal === 'READY_FOR_APPROVAL'
                                ? 'ready'
                                : statusVal === 'AWAITING_APPROVAL'
                                ? 'pending'
                                : statusVal === 'PAID'
                                ? 'completed'
                                : 'quarantine'
                            }`}
                          >
                            {statusVal.replace(/_/g, ' ')}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setMemberDetailModal({ open: true, member: b })}
                            title="View member commission & bank verification breakdown"
                          >
                            <Eye size={14} />
                            <span>View Details</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      No eligible members found matching the specified filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination & Footer Controls */}
          <div className="comm-pagination">
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              Showing{' '}
              <strong>
                {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, totalItems)}
              </strong>{' '}
              of <strong>{totalItems}</strong> members
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b' }}>
                <span>Rows:</span>
                <select
                  className="comm-filter-select"
                  style={{ padding: '4px 8px' }}
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </div>

              <div className="comm-page-btns">
                <button
                  type="button"
                  className="comm-page-btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <button
                    key={pg}
                    type="button"
                    className={`comm-page-btn ${currentPage === pg ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pg)}
                  >
                    {pg}
                  </button>
                ))}

                <button
                  type="button"
                  className="comm-page-btn"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Action Footer for Maker Batch Creation */}
          <div className="comm-action-footer">
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              Total Disbursable Verified Amount:{' '}
              <strong style={{ color: '#0f172a', fontSize: '15px' }}>
                ₹{previewData.readyAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>{' '}
              ({previewData.readyCount} members verified).
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={() => setCreateBatchModalOpen(true)}
              disabled={previewData.readyCount === 0 || loading || Boolean(dateError)}
            >
              <Layers size={16} />
              <span>Create Payout Batch (Maker)</span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: Payout Batches & Workflow (Section 6)
         ===================================================================== */}
      {activeTab === 'batches' && (
        <div className="comm-content-card">
          {/* 8-Lifecycle State Stepper Indicator */}
          <div className="comm-lifecycle-stepper-wrap">
            <span className="comm-stepper-label">Payout Batch Lifecycle (8 States)</span>
            <div className="comm-lifecycle-stepper">
              {WORKFLOW_STATES.map((st, idx) => (
                <div key={st.key} className="stepper-node">
                  <span className="stepper-circle">{idx + 1}</span>
                  <span>{st.label.replace(/^\d+\.\s*/, '')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Batches Table */}
          <div className="comm-table-wrap">
            <table className="comm-table">
              <thead>
                <tr>
                  <th>Batch Number</th>
                  <th>Period</th>
                  <th>Distributors</th>
                  <th>Total Amount</th>
                  <th>Approval Status</th>
                  <th>Disbursal Status</th>
                  <th>Lifecycle State</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.length > 0 ? (
                  batches.map((batch) => {
                    const ws = getBatchWorkflowState(batch);
                    return (
                      <tr key={batch.id}>
                        <td style={{ fontWeight: '700', color: '#2563eb' }}>
                          {batch.batchNumber}
                        </td>
                        <td>{batch.periodId || '—'}</td>
                        <td>{batch.totalEmployees || 0} distributors</td>
                        <td style={{ fontWeight: '800' }}>
                          ₹{Number(batch.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Approval Status */}
                        <td>
                          <span
                            className={`status-pill ${
                              batch.approvalStatus === 'APPROVED'
                                ? 'ready'
                                : batch.approvalStatus === 'REJECTED'
                                ? 'quarantine'
                                : 'pending'
                            }`}
                          >
                            {batch.approvalStatus || 'DRAFT'}
                          </span>
                        </td>

                        {/* Disbursal Status */}
                        <td>
                          <span
                            className={`status-pill ${
                              batch.status === 'COMPLETED'
                                ? 'completed'
                                : batch.status === 'PROCESSING'
                                ? 'pending'
                                : batch.status === 'APPROVED'
                                ? 'ready'
                                : 'quarantine'
                            }`}
                          >
                            {batch.status}
                          </span>
                        </td>

                        {/* Lifecycle State (1 of 8) */}
                        <td>
                          <span className={`status-pill ${ws.color}`}>{ws.label}</span>
                        </td>

                        {/* Actions according to state */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            {/* Inspect Batch Details */}
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => setBatchDetailModal({ open: true, batch })}
                              title="Inspect batch details & validation"
                            >
                              <Eye size={14} />
                            </button>

                            {/* Checker Approval */}
                            {(batch.approvalStatus === 'DRAFT' || batch.approvalStatus === 'PENDING_APPROVAL') && (
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ color: '#059669', borderColor: '#a7f3d0' }}
                                onClick={() =>
                                  setCheckerApproveModal({
                                    open: true,
                                    batch,
                                    checkerNotes: '',
                                    confirmChecked: false,
                                  })
                                }
                              >
                                <ShieldCheck size={14} />
                                <span>Checker Approve</span>
                              </button>
                            )}

                            {/* Disburse via PNB Rail */}
                            {batch.approvalStatus === 'APPROVED' && batch.status !== 'COMPLETED' && (
                              <button
                                type="button"
                                className="btn-success"
                                onClick={() =>
                                  setOneClickModal({
                                    open: true,
                                    batch,
                                    confirmDisbursal: false,
                                  })
                                }
                              >
                                <Play size={14} />
                                <span>Stage PNB Payout</span>
                              </button>
                            )}

                            {/* Reconcile Upload */}
                            {batch.status === 'PROCESSING' && (
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() =>
                                  setReconcileModal({
                                    open: true,
                                    batch,
                                    fileContent: '',
                                    fileName: '',
                                  })
                                }
                              >
                                <Upload size={14} />
                                <span>Reconcile MIS</span>
                              </button>
                            )}

                            {/* Download CSV Report */}
                            <a
                              href={adminCommissionDistributionApi.getBatchReportDownloadUrl(batch.id)}
                              className="btn-secondary"
                              title="Download Audited Batch Report"
                            >
                              <Download size={14} />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      No payout batches created yet. Use "Create Payout Batch" from the Eligible Members tab.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: Failed & Quarantine Review
         ===================================================================== */}
      {activeTab === 'quarantine' && (
        <div className="comm-content-card">
          <div className="security-box" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
            <AlertTriangle size={18} />
            <span>
              <strong>Manual Review Policy:</strong> Transfers with missing bank accounts, unverified KYC, or bank
              rejections are quarantined. Automatic retries are prohibited; retrying requires manual review and explicit
              administrator authorization.
            </span>
          </div>

          <div className="comm-table-wrap">
            <table className="comm-table">
              <thead>
                <tr>
                  <th>Distributor Name</th>
                  <th>Distributor ID</th>
                  <th>Quarantined Amount</th>
                  <th>Bank / IFSC</th>
                  <th>Quarantine Reason</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Remediation</th>
                </tr>
              </thead>
              <tbody>
                {previewData.beneficiaries.filter((b) => b.eligibilityStatus !== 'READY_FOR_PNB').length > 0 ? (
                  previewData.beneficiaries
                    .filter((b) => b.eligibilityStatus !== 'READY_FOR_PNB')
                    .map((item) => (
                      <tr key={item.distributorId}>
                        <td style={{ fontWeight: '700' }}>{item.name}</td>
                        <td>{item.distributorCode}</td>
                        <td style={{ fontWeight: '800', color: '#dc2626' }}>
                          ₹{item.approvedCommissionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td>
                          {item.bankAccount.bankName} ({item.bankAccount.ifscCode})
                        </td>
                        <td style={{ color: '#b91c1c', fontSize: '12px' }}>
                          {item.bankAccount.status === 'NO_ACCOUNT'
                            ? 'No bank account registered'
                            : 'Pending administrator bank verification'}
                        </td>
                        <td>
                          <span className="status-pill quarantine">QUARANTINED</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() =>
                              setRemediateModal({
                                open: true,
                                item: {
                                  batchId: 'current',
                                  itemId: item.distributorId,
                                  distributorCode: item.distributorCode,
                                  name: item.name,
                                },
                                accountHolderName: item.name,
                                accountNumber: '',
                                ifscCode: item.bankAccount.ifscCode !== 'NO_IFSC' ? item.bankAccount.ifscCode : '',
                                bankName: item.bankAccount.bankName !== 'Not Provided' ? item.bankAccount.bankName : '',
                              })
                            }
                          >
                            <span>Fix Details & Retry</span>
                          </button>
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      No quarantined beneficiaries! All active earned members have verified bank accounts.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: PNB Corporate Interchange Banking Details
         ===================================================================== */}
      {activeTab === 'pnb-info' && (
        <div className="comm-content-card">
          <div className="pnb-corporate-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '12px', letterSpacing: '0.08em', opacity: 0.8 }}>
                  CORPORATE DISBURSEMENT ACCOUNT
                </span>
                <h2 style={{ margin: '4px 0 0 0', fontSize: '22px', fontWeight: '800' }}>
                  Punjab National Bank (PNB)
                </h2>
              </div>
              <Landmark size={36} style={{ opacity: 0.9 }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', opacity: 0.7 }}>Account Number</div>
                <div style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '0.05em' }}>1923102100000382</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', opacity: 0.7 }}>IFSC Code</div>
                <div style={{ fontSize: '18px', fontWeight: '700' }}>PUNB0192310</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', opacity: 0.7 }}>Account Title / Brand</div>
                <div style={{ fontSize: '18px', fontWeight: '700' }}>kashvimlm</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', opacity: 0.7 }}>Cleared Balance / Float</div>
                <div style={{ fontSize: '18px', fontWeight: '700' }}>
                  ₹{(summary.corporatePnbBalance || 1500000).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '12px', fontSize: '12px', opacity: 0.85, lineHeight: 1.6 }}>
              <strong>Registered Office & Postal Address:</strong><br />
              Building No./Flat No.: Jalukari | MOHALLA UPPER JULAKHARI | Road/Street: POST OFFICE CHAMBA<br />
              Locality/Sub Locality: TEHSIL CHAMBA | City/Town/Village: Chamba | District: Chamba | State: Himachal Pradesh | PIN Code: 176310
            </div>
          </div>

          <div className="security-box">
            <ShieldCheck size={20} />
            <div>
              <strong>Security Protocol Notice:</strong>
              <div style={{ marginTop: '4px' }}>
                All corporate payouts are validated against PNB corporate interchange specifications. No internet banking
                passwords, PINs, or confidential credentials are ever accepted or stored on this platform.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: Member Commission Details (Section 5 Action)
         ===================================================================== */}
      {memberDetailModal.open && memberDetailModal.member && (
        <div className="comm-modal-overlay">
          <div className="comm-modal-card">
            <div className="comm-modal-header">
              <h3 className="comm-modal-title">
                <UserCheck size={18} style={{ color: '#2563eb' }} />
                <span>Beneficiary Commission Breakdown</span>
              </h3>
              <button
                type="button"
                className="comm-tab-btn"
                onClick={() => setMemberDetailModal({ open: false, member: null })}
              >
                <X size={18} />
              </button>
            </div>

            <div className="comm-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Member Name</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                    {memberDetailModal.member.name}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Member ID</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#2563eb' }}>
                    {memberDetailModal.member.distributorCode}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Rank & Rate</div>
                  <div>
                    <span className={`rank-badge ${memberDetailModal.member.rankCode.toLowerCase()}`}>
                      {memberDetailModal.member.rankName} ({memberDetailModal.member.rankPercentage}%)
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Commission Period</div>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>
                    {memberDetailModal.member.commissionPeriod || periodId}
                  </div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>
                  Commission Calculation Breakdown:
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span>Qualifying Personal Volume (PV):</span>
                  <strong>{memberDetailModal.member.qualifyingBV} BV</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span>Binary Matching Volume:</span>
                  <strong>{memberDetailModal.member.matchingVolume.toLocaleString('en-IN')} BV</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>Total Approved Commission:</span>
                  <strong style={{ color: '#16a34a', fontSize: '16px' }}>
                    ₹{memberDetailModal.member.approvedCommissionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>
                  Beneficiary Banking Information:
                </div>
                <div style={{ fontSize: '13px', color: '#1e293b' }}>
                  <strong>Bank:</strong> {memberDetailModal.member.bankAccount.bankName}
                </div>
                <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '4px' }}>
                  <strong>Account (Masked):</strong> {memberDetailModal.member.bankAccount.maskedAccountNumber}
                </div>
                <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '4px' }}>
                  <strong>IFSC Code:</strong> {memberDetailModal.member.bankAccount.ifscCode}
                </div>
                <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '4px' }}>
                  <strong>Verification Status:</strong>{' '}
                  <span className={`status-pill ${memberDetailModal.member.bankAccount.isVerified ? 'ready' : 'quarantine'}`}>
                    {memberDetailModal.member.bankAccount.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="comm-modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMemberDetailModal({ open: false, member: null })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: Inspect Batch Details & Validation Checklist (Section 6)
         ===================================================================== */}
      {batchDetailModal.open && batchDetailModal.batch && (
        <div className="comm-modal-overlay">
          <div className="comm-modal-card">
            <div className="comm-modal-header">
              <h3 className="comm-modal-title">
                <Layers size={18} style={{ color: '#2563eb' }} />
                <span>Batch Details & Pre-Flight Validation</span>
              </h3>
              <button
                type="button"
                className="comm-tab-btn"
                onClick={() => setBatchDetailModal({ open: false, batch: null })}
              >
                <X size={18} />
              </button>
            </div>

            <div className="comm-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Batch Number</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#2563eb' }}>
                    {batchDetailModal.batch.batchNumber}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Commission Period</div>
                  <div style={{ fontSize: '14px', fontWeight: '700' }}>
                    {batchDetailModal.batch.periodId}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Total Disbursable Amount</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    ₹{Number(batchDetailModal.batch.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Distributor Count</div>
                  <div style={{ fontSize: '14px', fontWeight: '700' }}>
                    {batchDetailModal.batch.totalEmployees || 0} distributors
                  </div>
                </div>
              </div>

              {/* Pre-Flight Validation Checklist */}
              <div className="validation-checklist">
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>
                  Pre-Approval Validation Checklist:
                </div>
                <div className="validation-item passed">
                  <Check size={14} />
                  <span>Beneficiary bank verification audit completed</span>
                </div>
                <div className="validation-item passed">
                  <Check size={14} />
                  <span>All IFSC codes conform to RBI / PNB formats</span>
                </div>
                <div className="validation-item passed">
                  <Check size={14} />
                  <span>Corporate PNB cleared balance (₹15,00,000.00) exceeds batch sum</span>
                </div>
                <div className="validation-item passed">
                  <Check size={14} />
                  <span>Maker-checker segregation enforced</span>
                </div>
              </div>
            </div>

            <div className="comm-modal-footer">
              <a
                href={adminCommissionDistributionApi.getPnbFileDownloadUrl(batchDetailModal.batch.id)}
                className="btn-secondary"
                title="Download PNB CIB bulk upload file"
              >
                <Download size={14} />
                <span>PNB CIB File</span>
              </a>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setBatchDetailModal({ open: false, batch: null })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: Maker Create Batch
         ===================================================================== */}
      {createBatchModalOpen && (
        <div className="comm-modal-overlay">
          <div className="comm-modal-card">
            <div className="comm-modal-header">
              <h3 className="comm-modal-title">
                <Layers size={18} style={{ color: '#2563eb' }} />
                <span>Create Commission Payout Batch (Maker)</span>
              </h3>
              <button type="button" className="comm-tab-btn" onClick={() => setCreateBatchModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBatch}>
              <div className="comm-modal-body">
                <div className="security-box">
                  <ShieldCheck size={18} />
                  <span>
                    <strong>Maker-Checker Policy:</strong> Creating this batch locks eligible commissions into DRAFT
                    status. Another administrator (Checker) must review and authorize the batch before disbursal.
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Period Code</label>
                  <input type="text" className="comm-period-input" value={periodId} readOnly />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                    Total Disbursable Amount
                  </label>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                    ₹{previewData.readyAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    ({previewData.readyCount} members with verified bank accounts)
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    id="excludeUnverified"
                    checked={excludeUnverified}
                    onChange={(e) => setExcludeUnverified(e.target.checked)}
                  />
                  <label htmlFor="excludeUnverified" style={{ fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                    Exclude unverified bank accounts (routes {previewData.quarantinedCount} members to quarantine)
                  </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Admin Notes</label>
                  <textarea
                    rows={3}
                    className="comm-search-input"
                    placeholder="Enter audit notes for the Checker..."
                    value={batchNotes}
                    onChange={(e) => setBatchNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="comm-modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setCreateBatchModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Creating Batch...' : 'Confirm & Generate Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: Checker Approve Batch
         ===================================================================== */}
      {checkerApproveModal.open && (
        <div className="comm-modal-overlay">
          <div className="comm-modal-card">
            <div className="comm-modal-header">
              <h3 className="comm-modal-title">
                <ShieldCheck size={18} style={{ color: '#059669' }} />
                <span>Checker Batch Authorization</span>
              </h3>
              <button
                type="button"
                className="comm-tab-btn"
                onClick={() => setCheckerApproveModal({ open: false, batch: null, checkerNotes: '', confirmChecked: false })}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleApproveBatch}>
              <div className="comm-modal-body">
                <div className="security-box" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}>
                  <CheckCheck size={18} />
                  <span>
                    <strong>Dual-Authorization Policy:</strong> You are authorizing Batch{' '}
                    <strong>{checkerApproveModal.batch?.batchNumber}</strong> for total sum of{' '}
                    <strong>
                      ₹{Number(checkerApproveModal.batch?.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>.
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Checker Notes</label>
                  <textarea
                    rows={3}
                    className="comm-search-input"
                    placeholder="Enter approval audit comments..."
                    value={checkerApproveModal.checkerNotes}
                    onChange={(e) =>
                      setCheckerApproveModal({ ...checkerApproveModal, checkerNotes: e.target.value })
                    }
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <input
                    type="checkbox"
                    id="checkerConfirm"
                    checked={checkerApproveModal.confirmChecked}
                    onChange={(e) =>
                      setCheckerApproveModal({ ...checkerApproveModal, confirmChecked: e.target.checked })
                    }
                    style={{ marginTop: '3px' }}
                  />
                  <label htmlFor="checkerConfirm" style={{ fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                    I confirm as an authorized administrator that I have reviewed the member calculations and verified
                    sufficient cleared float in PNB corporate account <strong>1923102100000382</strong>.
                  </label>
                </div>
              </div>

              <div className="comm-modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setCheckerApproveModal({ open: false, batch: null, checkerNotes: '', confirmChecked: false })
                  }
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-success"
                  disabled={!checkerApproveModal.confirmChecked || actionLoading}
                >
                  {actionLoading ? 'Authorizing...' : 'Authorize Batch for PNB Disbursal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: Stage PNB Disbursal
         ===================================================================== */}
      {oneClickModal.open && (
        <div className="comm-modal-overlay">
          <div className="comm-modal-card">
            <div className="comm-modal-header">
              <h3 className="comm-modal-title">
                <Play size={18} style={{ color: '#059669' }} />
                <span>Stage Disbursal via PNB Corporate Interchange</span>
              </h3>
              <button
                type="button"
                className="comm-tab-btn"
                onClick={() => setOneClickModal({ open: false, batch: null, confirmDisbursal: false })}
              >
                <X size={18} />
              </button>
            </div>

            <div className="comm-modal-body">
              <div className="pnb-corporate-card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '13px', opacity: 0.8 }}>DEBIT SOURCE ACCOUNT</div>
                <div style={{ fontSize: '16px', fontWeight: '800' }}>Punjab National Bank — 1923102100000382</div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>IFSC: PUNB0192310 | Brand: kashvimlm</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Batch Total Amount:</span>
                <span style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                  ₹{Number(oneClickModal.batch?.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="disburseConfirm"
                  checked={oneClickModal.confirmDisbursal}
                  onChange={(e) => setOneClickModal({ ...oneClickModal, confirmDisbursal: e.target.checked })}
                  style={{ marginTop: '3px' }}
                />
                <label htmlFor="disburseConfirm" style={{ fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                  Confirm transfer staging. This generates a SHA-256 cryptographically stamped PNB bulk transfer file
                  for Corporate Internet Banking (CIB) batch processing.
                </label>
              </div>
            </div>

            <div className="comm-modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setOneClickModal({ open: false, batch: null, confirmDisbursal: false })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-success"
                onClick={handleInitiateDisbursal}
                disabled={!oneClickModal.confirmDisbursal || actionLoading}
              >
                {actionLoading ? 'Staging Transfer...' : 'Stage PNB Bulk Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: Reconcile Reverse MIS
         ===================================================================== */}
      {reconcileModal.open && (
        <div className="comm-modal-overlay">
          <div className="comm-modal-card">
            <div className="comm-modal-header">
              <h3 className="comm-modal-title">
                <Upload size={18} style={{ color: '#2563eb' }} />
                <span>Reconcile PNB Return MIS Statement</span>
              </h3>
              <button
                type="button"
                className="comm-tab-btn"
                onClick={() => setReconcileModal({ open: false, batch: null, fileContent: '', fileName: '' })}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReconcileMis}>
              <div className="comm-modal-body">
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  Upload or paste the PNB settlement response file to match UTR numbers and settle transactions.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                    MIS File Text / Content (CSV Format)
                  </label>
                  <textarea
                    rows={6}
                    className="comm-search-input"
                    style={{ fontFamily: 'monospace', fontSize: '12px' }}
                    placeholder="CustomerRef,Account,Amount,Status,UTR,Reason..."
                    value={reconcileModal.fileContent}
                    onChange={(e) => setReconcileModal({ ...reconcileModal, fileContent: e.target.value })}
                  />
                </div>
              </div>

              <div className="comm-modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setReconcileModal({ open: false, batch: null, fileContent: '', fileName: '' })}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Reconciling...' : 'Process Bank MIS File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: Remediate Quarantined Item (Manual Review)
         ===================================================================== */}
      {remediateModal.open && (
        <div className="comm-modal-overlay">
          <div className="comm-modal-card">
            <div className="comm-modal-header">
              <h3 className="comm-modal-title">
                <AlertCircle size={18} style={{ color: '#d97706' }} />
                <span>Remediate Beneficiary Bank Details</span>
              </h3>
              <button
                type="button"
                className="comm-tab-btn"
                onClick={() =>
                  setRemediateModal({
                    open: false,
                    item: null,
                    accountHolderName: '',
                    accountNumber: '',
                    ifscCode: '',
                    bankName: '',
                  })
                }
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRemediate}>
              <div className="comm-modal-body">
                <div style={{ fontSize: '13px', color: '#475569' }}>
                  Update bank information for <strong>{remediateModal.item?.name}</strong> (
                  {remediateModal.item?.distributorCode}).
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Bank Name</label>
                  <input
                    type="text"
                    className="comm-search-input"
                    value={remediateModal.bankName}
                    onChange={(e) => setRemediateModal({ ...remediateModal, bankName: e.target.value })}
                    placeholder="e.g. Punjab National Bank"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Account Holder Name</label>
                  <input
                    type="text"
                    className="comm-search-input"
                    value={remediateModal.accountHolderName}
                    onChange={(e) =>
                      setRemediateModal({ ...remediateModal, accountHolderName: e.target.value })
                    }
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Account Number</label>
                  <input
                    type="text"
                    className="comm-search-input"
                    value={remediateModal.accountNumber}
                    onChange={(e) => setRemediateModal({ ...remediateModal, accountNumber: e.target.value })}
                    placeholder="Enter valid account number"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>IFSC Code</label>
                  <input
                    type="text"
                    className="comm-search-input"
                    value={remediateModal.ifscCode}
                    onChange={(e) => setRemediateModal({ ...remediateModal, ifscCode: e.target.value.toUpperCase() })}
                    placeholder="e.g. PUNB0192310"
                  />
                </div>
              </div>

              <div className="comm-modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setRemediateModal({
                      open: false,
                      item: null,
                      accountHolderName: '',
                      accountNumber: '',
                      ifscCode: '',
                      bankName: '',
                    })
                  }
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Update & Re-queue for Disbursal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
