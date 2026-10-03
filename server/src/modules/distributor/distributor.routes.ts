import { Router } from 'express';
import { DistributorController } from './distributor.controller.js';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';

const router = Router();

// Public / Registration
router.post('/register', DistributorController.register);

// Protected Distributor Self Endpoints (Prompt 6 Section 16 & 27)
router.get('/me/network', authenticateToken, DistributorController.getMeNetwork);
router.get('/me/downline', authenticateToken, DistributorController.getMeDownline);
router.get('/me/business-volume', authenticateToken, DistributorController.getMeBusinessVolume);
router.get('/me/commissions', authenticateToken, DistributorController.getMeCommissions);
router.get('/me/referral-link', authenticateToken, DistributorController.getMeReferralLink);
router.get('/me', authenticateToken, DistributorController.getMe);
router.patch('/me', authenticateToken, DistributorController.updateMe);
router.put('/me', authenticateToken, DistributorController.updateMe);

// Referral link discovery
router.get('/referral-link/:memberId?', DistributorController.getReferralLink);

// Profile and Business Centers
router.get('/profile/:memberId?', authenticateToken, DistributorController.getProfile);
router.get('/business-centers/:memberId?', authenticateToken, DistributorController.getBusinessCenters);
router.put('/kyc-bank', authenticateToken, DistributorController.updateKycAndBank);
router.get('/list', authenticateToken, requireAdmin, DistributorController.listDistributors);

// Parameterized endpoint must come last
router.get('/:id', DistributorController.getById);

export default router;
