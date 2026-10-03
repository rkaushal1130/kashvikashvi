import { Router } from 'express';
import { NewsController } from './news.controller.js';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import { createNewsSchema } from '../../schemas/news.schemas.js';

export const newsRoutes = Router();

// 1. GET /api/v1/news - List corporate news, announcements, and marquee ticker items
newsRoutes.get('/', NewsController.listNews);

// 2. GET /api/v1/news/:id - Get specific news article by ID
newsRoutes.get('/:id', NewsController.getNewsById);

// 3. POST /api/v1/news - Create corporate news announcement (Admin only)
newsRoutes.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest({ body: createNewsSchema }),
  NewsController.createNews
);

// 4. DELETE /api/v1/news/:id - Delete news announcement (Admin only)
newsRoutes.delete('/:id', authenticateToken, requireAdmin, NewsController.deleteNews);

export default newsRoutes;
