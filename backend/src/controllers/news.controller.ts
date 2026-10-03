import { NextFunction, Request, Response } from 'express';
import { NewsService } from '../services/news.service';
import { sendSuccess } from '../utils/apiResponse';
import {
  createNewsSchema,
  newsIdParamSchema,
  newsQuerySchema,
  newsSlugParamSchema,
  updateNewsSchema,
} from '../validators/news.validators';

export class NewsController {
  /**
   * Public: List all published news articles.
   * GET /api/v1/news
   */
  public static async getPublicNews(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = newsQuerySchema.parse(req.query);
      const result = await NewsService.getPublicNews(query);

      sendSuccess(res, {
        message: 'News articles retrieved successfully.',
        data: result.items,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Public: Retrieve single published news article by slug.
   * GET /api/v1/news/:slug
   */
  public static async getPublicNewsBySlug(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { slug } = newsSlugParamSchema.parse(req.params);
      const article = await NewsService.getPublicNewsBySlug(slug);

      sendSuccess(res, {
        message: 'News article retrieved successfully.',
        data: article,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: List all news articles including drafts and archived.
   * GET /api/v1/admin/news
   */
  public static async getAdminNews(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = newsQuerySchema.parse(req.query);
      const result = await NewsService.getAdminNews(query);

      sendSuccess(res, {
        message: 'Admin news articles retrieved successfully.',
        data: result.items,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Create a new news article.
   * POST /api/v1/admin/news
   */
  public static async createNews(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const input = createNewsSchema.parse(req.body);
      const article = await NewsService.createNews(input, req.user?.id);

      sendSuccess(res, {
        statusCode: 201,
        message: 'News article created successfully.',
        data: article,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Update an existing news article.
   * PATCH /api/v1/admin/news/:id
   */
  public static async updateNews(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = newsIdParamSchema.parse(req.params);
      const input = updateNewsSchema.parse(req.body);
      const article = await NewsService.updateNews(id, input);

      sendSuccess(res, {
        message: 'News article updated successfully.',
        data: article,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Delete a news article.
   * DELETE /api/v1/admin/news/:id
   */
  public static async deleteNews(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = newsIdParamSchema.parse(req.params);
      await NewsService.deleteNews(id);

      sendSuccess(res, {
        message: 'News article deleted successfully.',
        data: { id },
      });
    } catch (error) {
      next(error);
    }
  }
}
