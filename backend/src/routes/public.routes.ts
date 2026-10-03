import { Router } from 'express';
import { WebsiteController } from '../controllers/website.controller';
import { validate } from '../middleware/validate';
import { distributorSlugParamSchema } from '../validators/website.validators';

export const publicRouter = Router();

/**
 * Public distributor storefront and replicated website route:
 * GET /api/v1/public/distributor/:slug
 * No authentication required.
 */
publicRouter.get(
  '/distributor/:slug',
  validate({ params: distributorSlugParamSchema }),
  WebsiteController.getPublicDistributorWebsite
);
