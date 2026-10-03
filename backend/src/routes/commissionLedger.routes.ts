import { Router } from 'express';
import { CommissionLedgerController } from '../controllers/commissionLedger.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';

const router = Router();

// All ledger routes require authentication
router.use(authenticate);

// Distributor routes
// GET /api/v1/commissions/ledger/me - View authenticated distributor's ledger
router.get('/me', CommissionLedgerController.getMyLedger);

// GET /api/v1/commissions/ledger/order/:orderId - View ledger transactions for an order
router.get('/order/:orderId', CommissionLedgerController.getByOrder);

// GET /api/v1/commissions/ledger/reconciliation - Full ledger reconciliation (Prompt 20)
router.get(
  '/reconciliation',
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  CommissionLedgerController.reconcileLedgers
);

// GET /api/v1/commissions/ledger/withdrawal-eligibility/:memberId - Withdrawal guard check (Prompt 20)
router.get(
  '/withdrawal-eligibility/:memberId',
  CommissionLedgerController.checkWithdrawalEligibility
);

// GET /api/v1/commissions/ledger/:id/audit - View full 8-dimensional audit trail
router.get('/:id/audit', CommissionLedgerController.getAuditTrail);

// Admin-only financial posting & lifecycle management
// POST /api/v1/commissions/ledger/approve-order/:orderId - Batch approve transactions
router.post(
  '/approve-order/:orderId',
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  CommissionLedgerController.approveOrderCommissions
);

// POST /api/v1/commissions/ledger/:id/credit-wallet - Post commission to wallet
router.post(
  '/:id/credit-wallet',
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  CommissionLedgerController.creditToWallet
);

// POST /api/v1/commissions/ledger/:id/reverse - Reversal workflow
router.post(
  '/:id/reverse',
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  CommissionLedgerController.reverseCommission
);

// POST /api/v1/commissions/ledger/post-order/:orderId - Atomic commission posting (Prompt 19)
router.post(
  '/post-order/:orderId',
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  CommissionLedgerController.postOrderCommissions
);

// ==========================================
// COMMISSION REVERSAL SYSTEM (PROMPT 22)
// ==========================================

// POST /api/v1/commissions/ledger/reversal/order/:orderId - Reverse commissions for an order
router.post(
  '/reversal/order/:orderId',
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  CommissionLedgerController.reverseOrderCommissions
);

// GET /api/v1/commissions/ledger/reversals/order/:orderId - List reversals for an order
router.get(
  '/reversals/order/:orderId',
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  CommissionLedgerController.getOrderReversals
);

// GET /api/v1/commissions/ledger/reversals/pending-reconciliations - List pending admin reconciliations
router.get(
  '/reversals/pending-reconciliations',
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  CommissionLedgerController.getPendingReconciliations
);

// POST /api/v1/commissions/ledger/reversals/:reversalId/resolve - Resolve administrative reconciliation
router.post(
  '/reversals/:reversalId/resolve',
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  CommissionLedgerController.resolveReconciliation
);

export default router;
