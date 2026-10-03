import { Router } from 'express';
import { WalletController } from './wallet.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = Router();

router.get('/balance/:memberId?', authenticateToken, WalletController.getBalance);
router.get('/transactions/:memberId?', authenticateToken, WalletController.getTransactions);
router.post('/withdraw', authenticateToken, WalletController.withdraw);

export default router;
