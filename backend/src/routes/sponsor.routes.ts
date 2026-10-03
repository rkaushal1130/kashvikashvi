import { Router } from 'express';
import { SponsorController } from '../controllers/sponsor.controller';
import { validate } from '../middleware/validate';
import { sponsorIdParamSchema } from '../validators/sponsor.validators';

const router = Router();

/**
 * GET /api/v1/sponsors/:sponsorId
 * Validates sponsor existence, active status, returns public summary,
 * and checks available binary tree positions (LEFT / RIGHT).
 */
router.get(
  '/:sponsorId',
  validate({ params: sponsorIdParamSchema }),
  SponsorController.validateSponsor
);

export const sponsorRouter = router;
