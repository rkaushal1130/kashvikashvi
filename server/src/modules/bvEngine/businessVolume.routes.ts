import { Router } from 'express';
import { BusinessVolumeController } from './businessVolume.controller.js';
import { optionalAuth } from '../../middleware/auth.js';

const router = Router();

// Prompt 5 Business Volume APIs
router.post('/', optionalAuth, BusinessVolumeController.createBusinessVolume);
router.get('/summary/:distributorId', BusinessVolumeController.getVolumeSummary);
router.get('/transactions/:distributorId', BusinessVolumeController.getDistributorVolume);
router.get('/:distributorId/left', BusinessVolumeController.getLeftTeamVolume);
router.get('/:distributorId/right', BusinessVolumeController.getRightTeamVolume);
router.get('/:distributorId/summary', BusinessVolumeController.getVolumeSummary);
router.get('/:distributorId', BusinessVolumeController.getDistributorVolume);

export default router;
