import { Router } from 'express';
import { CommissionController } from './commission.controller.js';
import { optionalAuth } from '../../middleware/auth.js';

const router = Router();

// Static and alias routes before parameterized routes
router.get('/config', CommissionController.getConfig);
router.put('/config', optionalAuth, CommissionController.updateConfig);
router.post('/calculate', optionalAuth, CommissionController.calculateCommission);
router.post('/post', optionalAuth, CommissionController.postCommission);
router.post('/reverse', optionalAuth, CommissionController.reverseCommission);
router.get('/summary/:distributorId', optionalAuth, CommissionController.getCommissionSummary);
router.get('/ledger/:distributorId', optionalAuth, CommissionController.getCommissionHistory);

// Parameterized routes
router.get('/:distributorId/eligibility', optionalAuth, CommissionController.checkEligibility);
router.get('/:distributorId/history', optionalAuth, CommissionController.getCommissionHistory);
router.get('/:distributorId', optionalAuth, CommissionController.getCommissionSummary);

export default router;
