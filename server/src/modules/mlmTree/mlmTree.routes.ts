import { Router } from 'express';
import { MlmTreeController } from './mlmTree.controller.js';
import { authenticateToken, optionalAuth } from '../../middleware/auth.js';

const router = Router();

// Binary Tree Hierarchy & Topology
router.get('/', optionalAuth, MlmTreeController.getMyNetworkTree);
router.get('/search', MlmTreeController.searchNetworkTree);
router.get('/validate/integrity', MlmTreeController.validateIntegrity);
router.get('/member/:distributorId/summary', optionalAuth, MlmTreeController.getMemberNetworkSummary);
router.get('/member/:distributorId', optionalAuth, MlmTreeController.getMemberNetworkTree);

router.get('/structure/:memberId?', optionalAuth, MlmTreeController.getTree);
router.get('/node/:memberId?', optionalAuth, MlmTreeController.getTree);
router.get('/placement-suggest', optionalAuth, MlmTreeController.getPlacementSuggestion);

// Tree route aliases
router.get('/children/:distributorId', MlmTreeController.getChildren);
router.get('/downline/:distributorId/left', MlmTreeController.getLeftTeam);
router.get('/downline/:distributorId/right', MlmTreeController.getRightTeam);
router.get('/downline/:distributorId', MlmTreeController.getDownline);
router.get('/path/:distributorId', MlmTreeController.getPath);
router.get('/stats/:distributorId', MlmTreeController.getStatistics);
router.get('/statistics/:distributorId', MlmTreeController.getStatistics);

// Prompt 4: Binary MLM Tree Retrieval & Calculations
router.get('/:distributorId/children', MlmTreeController.getChildren);
router.get('/:distributorId/downline', MlmTreeController.getDownline);
router.get('/:distributorId/left', MlmTreeController.getLeftTeam);
router.get('/:distributorId/right', MlmTreeController.getRightTeam);
router.get('/:distributorId/path', MlmTreeController.getPath);
router.get('/:distributorId/ancestors', MlmTreeController.getAncestors);
router.get('/:distributorId/statistics', MlmTreeController.getStatistics);
router.get('/:distributorId/search', MlmTreeController.searchDownline);
router.get('/:distributorId/parent', MlmTreeController.getParent);
router.get('/:distributorId/sponsor', MlmTreeController.getSponsor);
router.get('/:distributorId/level', MlmTreeController.getLevel);
router.get('/:distributorId/validate', MlmTreeController.validateTree);
router.get('/:distributorId', optionalAuth, MlmTreeController.getCompleteTree);


// MLM Binary Tree Operations & Audit Logging (Prompt 16)
router.post('/move', optionalAuth, MlmTreeController.moveDistributor);
router.post('/place', optionalAuth, MlmTreeController.placeMember);
router.post('/change-position', optionalAuth, MlmTreeController.changePosition);
router.post('/remove', optionalAuth, MlmTreeController.removeMember);
router.post('/sponsor', optionalAuth, MlmTreeController.assignSponsor);
router.get('/audit-logs', optionalAuth, MlmTreeController.getTreeAuditLogs);
router.get('/audit-logs/:memberId', optionalAuth, MlmTreeController.getTreeAuditLogs);

export default router;
