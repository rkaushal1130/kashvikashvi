import { Router } from 'express';
import { FundingController } from '../controllers/funding.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';
import { AppError } from '../utils/appError';

/**
 * ============================================================================
 * ADMIN FUNDING PORTAL ROUTES (PROMPT 34)
 * ============================================================================
 *
 * Base Routes:
 * - /api/admin/funding & /api/v1/admin/funding
 * - /api/admin/treasury & /api/v1/admin/treasury
 *
 * Strict RBAC: All endpoints require valid JWT authentication and SUPER_ADMIN
 * or ADMIN role. Regular users/distributors are strictly blocked.
 *
 * PROMPT 34 ENDPOINTS:
 * 1.  GET  /accounts                   -> Get funding accounts
 * 2.  POST /accounts/connect           -> Connect funding account
 * 3.  POST /accounts/:id/disconnect    -> Disconnect funding account
 * 4.  GET  /accounts/:id/status        -> Get account status
 * 5.  POST /                           -> Create funding request (Never credits treasury immediately)
 * 6.  GET  /:id                        -> Get funding transaction
 * 7.  GET  /                           -> List funding history (Supports status, date, amount, provider, txId, admin)
 * 8.  GET  /api/admin/treasury         -> Get treasury balance
 * 9.  GET  /api/admin/treasury/transactions -> Get treasury transactions
 * 10. POST /:id/reconcile              -> Reconcile funding transaction against external provider
 */
export const adminFundingRouter = Router();

// 1. Strict Authentication & Role-Based Access Control
adminFundingRouter.use(authenticate);
adminFundingRouter.use(authorizeRoles('SUPER_ADMIN', 'ADMIN'));

// 2. Dashboard
adminFundingRouter.get('/dashboard', FundingController.getDashboard);

// 3. Corporate Funding Accounts
adminFundingRouter.get('/accounts', FundingController.getAccounts);
adminFundingRouter.post('/accounts/connect', FundingController.connectAccount);
adminFundingRouter.post('/accounts', FundingController.connectAccount); // alias
adminFundingRouter.post('/accounts/:id/disconnect', FundingController.disconnectAccount);
adminFundingRouter.get('/accounts/:id/status', FundingController.getAccountStatus);

// 4. Create Funding Request (Never credits treasury merely because endpoint succeeds)
adminFundingRouter.post('/', FundingController.createFundingRequest);
adminFundingRouter.post('/initiate', FundingController.createFundingRequest); // alias

// 5. List Funding History (Supports status, date range, amount, provider, txId, admin)
adminFundingRouter.get('/', FundingController.listTransactions);
adminFundingRouter.get('/transactions', FundingController.listTransactions); // alias

// 6. Reconcile Funding Transaction & Period (Prompt 40)
adminFundingRouter.post('/reconcile/period', FundingController.reconcileFundingPeriod);
adminFundingRouter.get('/reconcile/period', FundingController.reconcileFundingPeriod);
adminFundingRouter.get('/discrepancies', FundingController.getDiscrepancies);
adminFundingRouter.post('/:id/reconcile/resolve', FundingController.resolveDiscrepancy);
adminFundingRouter.post('/discrepancies/:id/resolve', FundingController.resolveDiscrepancy);
adminFundingRouter.post('/:id/reconcile', FundingController.reconcileFunding);
adminFundingRouter.post('/transactions/:id/reconcile', FundingController.reconcileFunding); // alias

// 7. Verify & Reverse Funding Operations
adminFundingRouter.post('/:id/verify', FundingController.verifyFunding);
adminFundingRouter.post('/transactions/:id/verify', FundingController.verifyFunding); // alias
adminFundingRouter.post('/:id/reverse', FundingController.reverseFunding);
adminFundingRouter.post('/transactions/:id/reverse', FundingController.reverseFunding); // alias

// 8. Get Funding Transaction by ID
adminFundingRouter.get('/:id', FundingController.getTransactionById);
adminFundingRouter.get('/transactions/:id', FundingController.getTransactionById); // alias

// 9. Treasury Ledger Reconciliation under Funding Router
adminFundingRouter.get('/treasury/reconcile', FundingController.reconcileTreasury);

// 10. Treasury & MLM Commission Integration (Prompt 37)
adminFundingRouter.get('/accounting-summary', FundingController.getAccountingSummary);
adminFundingRouter.post('/commissions/reserve-batch', FundingController.batchReserveCommissions);
adminFundingRouter.post('/commissions/:id/reserve', FundingController.reserveSingleCommission);
adminFundingRouter.get('/payouts/:id/eligibility', FundingController.checkPayoutEligibility);
adminFundingRouter.post('/payouts/:id/disburse', FundingController.disbursePayout);

// 11. Administrative Treasury Adjustment (Prompt 39)
adminFundingRouter.post('/adjust', FundingController.initiateAdjustment);

// 12. ABSOLUTE FINANCIAL GUARD: Block any direct mutation of balances
const blockDirectBalanceMutation = (_req: any, _res: any, next: any) => {
  next(
    AppError.forbidden(
      'Direct balance mutations are strictly prohibited. Treasury balance only increases via verified external funding transactions.'
    )
  );
};
adminFundingRouter.post('/balance', blockDirectBalanceMutation);
adminFundingRouter.put('/balance', blockDirectBalanceMutation);
adminFundingRouter.patch('/balance', blockDirectBalanceMutation);
adminFundingRouter.delete('/balance', blockDirectBalanceMutation);

/**
 * ============================================================================
 * ADMIN PLATFORM TREASURY ROUTES (PROMPT 34 & PROMPT 37)
 * ============================================================================
 *
 * Base Route: /api/admin/treasury & /api/v1/admin/treasury
 *
 * 8. GET /api/admin/treasury               -> Get treasury balance
 * 9. GET /api/admin/treasury/transactions  -> Get treasury ledger transactions
 *    GET /api/admin/treasury/reconcile     -> Reconcile ledger balance
 *    GET /api/admin/treasury/accounting-summary -> Solvency & commission liabilities
 *    POST /api/admin/treasury/adjust       -> Authorized administrative adjustment
 */
export const adminTreasuryRouter = Router();

adminTreasuryRouter.use(authenticate);
adminTreasuryRouter.use(authorizeRoles('SUPER_ADMIN', 'ADMIN'));

adminTreasuryRouter.get('/', FundingController.getTreasuryBalance);
adminTreasuryRouter.get('/transactions', FundingController.getTreasuryTransactions);
adminTreasuryRouter.get('/reconcile', FundingController.reconcileTreasury);
adminTreasuryRouter.get('/accounting-summary', FundingController.getAccountingSummary);

// Authorized treasury adjustment
adminTreasuryRouter.post('/adjust', FundingController.initiateAdjustment);

// Absolute financial guard against direct arbitrary balance mutations
adminTreasuryRouter.post('/', blockDirectBalanceMutation);
adminTreasuryRouter.put('/', blockDirectBalanceMutation);
adminTreasuryRouter.patch('/', blockDirectBalanceMutation);
adminTreasuryRouter.delete('/', blockDirectBalanceMutation);

/**
 * ============================================================================
 * FUNDING WEBHOOK ROUTES
 * ============================================================================
 *
 * Base Route: /api/v1/webhooks/funding & /api/webhooks/funding
 *
 * Publicly reachable endpoint for asynchronous payment notifications from
 * external regulated providers (e.g., RazorpayX, Cashfree).
 * Authenticated via provider HMAC-SHA256 signature verification.
 */
export const fundingWebhookRouter = Router();

fundingWebhookRouter.post('/:provider?', FundingController.handleWebhook);
fundingWebhookRouter.post('/', FundingController.handleWebhook);
