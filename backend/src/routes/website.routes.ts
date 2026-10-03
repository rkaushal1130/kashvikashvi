import { Router } from 'express';
import { WebsiteController } from '../controllers/website.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createWebsiteLinkSchema,
  linkIdParamSchema,
  updateDistributorWebsiteSchema,
  updateWebsiteLinkSchema,
} from '../validators/website.validators';

export const websiteRouter = Router();

websiteRouter.use(authenticate);

// GET /api/v1/my-website - Retrieve authenticated distributor's website
websiteRouter.get('/', WebsiteController.getMyWebsite);

// PATCH /api/v1/my-website - Update authenticated distributor's website settings
websiteRouter.patch(
  '/',
  validate({ body: updateDistributorWebsiteSchema }),
  WebsiteController.updateMyWebsite
);

// GET /api/v1/my-website/links - List all navigation links
websiteRouter.get('/links', WebsiteController.getMyWebsiteLinks);

// POST /api/v1/my-website/links - Add a new link
websiteRouter.post(
  '/links',
  validate({ body: createWebsiteLinkSchema }),
  WebsiteController.createMyWebsiteLink
);

// PATCH /api/v1/my-website/links/:id - Update link
websiteRouter.patch(
  '/links/:id',
  validate({ params: linkIdParamSchema, body: updateWebsiteLinkSchema }),
  WebsiteController.updateMyWebsiteLink
);

// DELETE /api/v1/my-website/links/:id - Delete link
websiteRouter.delete(
  '/links/:id',
  validate({ params: linkIdParamSchema }),
  WebsiteController.deleteMyWebsiteLink
);
