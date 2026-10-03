import { Router } from 'express';
import { BvEngineController } from './bvEngine.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = Router();

router.get('/summary/:memberId?', authenticateToken, BvEngineController.getSummary);
router.get('/ledger/:memberId?', authenticateToken, BvEngineController.getLedger);

export default router;
