import { Router } from 'express';
import { LevelController } from '../controllers/level.controller';
import { authenticate, optionalAuth } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';
import { AppError } from '../utils/appError';

const router = Router();

// ==========================================
// MEMBER LEVEL ENDPOINTS
// ==========================================

// GET /api/v1/levels/me - Current distributor's level, BB, matching volume, and progression metrics
router.get('/me', authenticate, LevelController.getMyLevel);

// IMMUTABILITY GUARD (PROMPT 9): Promotion history must NEVER be modified or deleted
router.all('/history/:historyId?', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    throw AppError.forbidden('Promotion history is immutable. Modifying or deleting history records is strictly prohibited.');
  }
  next();
});

// GET /api/v1/levels/history - Promotion history for current distributor
router.get('/history', authenticate, LevelController.getMyHistory);

// GET /api/v1/levels/config - Public configuration of all 6 ordered levels (Starter to Ruby)
router.get('/config', optionalAuth, LevelController.getLevelsConfig);

// GET /api/v1/levels/member/:idOrCode - Lookup level & qualification status for any team member
router.get('/member/:idOrCode', authenticate, LevelController.getMemberLevel);

// ==========================================
// ADMIN LEVEL ENDPOINTS
// ==========================================

// POST /api/v1/levels/admin/recalculate - Admin trigger for network or single-member level recalculation
router.post(
  '/admin/recalculate',
  authenticate,
  authorizeRoles('SUPER_ADMIN', 'ADMIN'),
  LevelController.recalculateNetworkLevels
);

// GET /api/v1/levels/admin/distribution - Member demographic counts across all 6 levels
router.get(
  '/admin/distribution',
  authenticate,
  authorizeRoles('SUPER_ADMIN', 'ADMIN'),
  LevelController.getLevelDistribution
);

// PUT /api/v1/levels/admin/config/:idOrCode - Admin updates level configuration in database
router.put(
  '/admin/config/:idOrCode',
  authenticate,
  authorizeRoles('SUPER_ADMIN', 'ADMIN'),
  LevelController.updateLevelConfig
);

export const levelRouter = router;
