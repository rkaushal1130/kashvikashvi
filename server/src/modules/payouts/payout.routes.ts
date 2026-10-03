import { Router } from 'express';
import { PayoutController } from './payout.controller.js';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';

const router = Router();

router.get('/my-payouts/:memberId?', authenticateToken, PayoutController.getMyPayouts);
router.post('/generate-batch', authenticateToken, requireAdmin, PayoutController.generateBatch);

export default router;
