import { Router } from 'express';
import { NewsController } from '../controllers/news.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';
import { validate } from '../middleware/validate';
import {
  createNewsSchema,
  newsIdParamSchema,
  newsQuerySchema,
  newsSlugParamSchema,
  updateNewsSchema,
} from '../validators/news.validators';

// ==========================================
// Public News Routes: /api/v1/news
// ==========================================
export const newsRouter = Router();

// GET /api/v1/news - List published news
newsRouter.get('/', validate({ query: newsQuerySchema }), NewsController.getPublicNews);

// GET /api/v1/news/:slug - Retrieve single published article
newsRouter.get('/:slug', validate({ params: newsSlugParamSchema }), NewsController.getPublicNewsBySlug);

// ==========================================
// Admin News Routes: /api/v1/admin/news
// ==========================================
export const adminNewsRouter = Router();

adminNewsRouter.use(authenticate);
adminNewsRouter.use(authorizeRoles('SUPER_ADMIN', 'ADMIN'));

// GET /api/v1/admin/news - List all articles (including drafts & archived)
adminNewsRouter.get('/', validate({ query: newsQuerySchema }), NewsController.getAdminNews);

// POST /api/v1/admin/news - Create a new article
adminNewsRouter.post(
  '/',
  validate({ body: createNewsSchema }),
  NewsController.createNews
);

// PATCH /api/v1/admin/news/:id - Update an article
adminNewsRouter.patch(
  '/:id',
  validate({ params: newsIdParamSchema, body: updateNewsSchema }),
  NewsController.updateNews
);

// DELETE /api/v1/admin/news/:id - Delete an article
adminNewsRouter.delete(
  '/:id',
  validate({ params: newsIdParamSchema }),
  NewsController.deleteNews
);
