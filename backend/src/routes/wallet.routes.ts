import { Router } from 'express';
import { WalletController } from '../controllers/wallet.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';
import { validate } from '../middleware/validate';
import {
  adminWalletAdjustmentSchema,
  walletTransactionQuerySchema,
} from '../validators/wallet.validators';

// Distributor Wallet Router: /api/v1/wallet
export const walletRouter = Router();

walletRouter.use(authenticate);

// GET /api/v1/wallet - Retrieve authenticated distributor's wallet
walletRouter.get('/', WalletController.getMyWallet);

// GET /api/v1/wallet/transactions - Retrieve paginated wallet transactions
walletRouter.get(
  '/transactions',
  validate({ query: walletTransactionQuerySchema }),
  WalletController.getMyTransactions
);

// POST /api/v1/wallet/adjust - Admin-only adjustment route
walletRouter.post(
  '/adjust',
  authorizeRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ body: adminWalletAdjustmentSchema }),
  WalletController.adminAdjust
);

// STRICT SECURITY GUARD: Prohibit any direct client modifications to wallet balances
walletRouter.post('/', WalletController.blockDirectMutation);
walletRouter.put('/', WalletController.blockDirectMutation);
walletRouter.patch('/', WalletController.blockDirectMutation);
walletRouter.delete('/', WalletController.blockDirectMutation);

// Dedicated Admin Wallet Router: /api/v1/admin/wallet
export const adminWalletRouter = Router();

adminWalletRouter.use(authenticate);
adminWalletRouter.use(authorizeRoles('SUPER_ADMIN', 'ADMIN'));

// POST /api/v1/admin/wallet/adjust - Perform administrative adjustment with audit logging
adminWalletRouter.post(
  '/adjust',
  validate({ body: adminWalletAdjustmentSchema }),
  WalletController.adminAdjust
);
