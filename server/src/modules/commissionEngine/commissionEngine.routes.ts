import { Router } from 'express';
import { CommissionEngineController } from './commissionEngine.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = Router();

router.get('/calculate/:memberId?', authenticateToken, CommissionEngineController.calculate);
router.get('/history/:memberId?', authenticateToken, CommissionEngineController.getHistory);

export default router;
