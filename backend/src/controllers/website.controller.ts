import { NextFunction, Request, Response } from 'express';
import { DistributorWebsiteService } from '../services/website.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import {
  createWebsiteLinkSchema,
  distributorSlugParamSchema,
  linkIdParamSchema,
  updateDistributorWebsiteSchema,
  updateWebsiteLinkSchema,
} from '../validators/website.validators';

export class WebsiteController {
  /**
   * Retrieves the authenticated distributor's replicated website.
   * GET /api/v1/my-website
   */
  public static async getMyWebsite(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const website = await DistributorWebsiteService.getOrCreateWebsite(req.user.id);

      sendSuccess(res, {
        message: 'Distributor website retrieved successfully.',
        data: website,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates authenticated distributor's replicated website settings.
   * PATCH /api/v1/my-website
   */
  public static async updateMyWebsite(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const input = updateDistributorWebsiteSchema.parse(req.body);
      const updated = await DistributorWebsiteService.updateWebsite(req.user.id, input);

      sendSuccess(res, {
        message: 'Distributor website updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lists all navigation links for the distributor's website.
   * GET /api/v1/my-website/links
   */
  public static async getMyWebsiteLinks(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const links = await DistributorWebsiteService.getLinks(req.user.id);

      sendSuccess(res, {
        message: 'Website links retrieved successfully.',
        data: links,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Adds a new link to the distributor's website.
   * POST /api/v1/my-website/links
   */
  public static async createMyWebsiteLink(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const input = createWebsiteLinkSchema.parse(req.body);
      const link = await DistributorWebsiteService.createLink(req.user.id, input);

      sendSuccess(res, {
        statusCode: 201,
        message: 'Website link created successfully.',
        data: link,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates an existing website link.
   * PATCH /api/v1/my-website/links/:id
   */
  public static async updateMyWebsiteLink(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const { id } = linkIdParamSchema.parse(req.params);
      const input = updateWebsiteLinkSchema.parse(req.body);
      const updated = await DistributorWebsiteService.updateLink(req.user.id, id, input);

      sendSuccess(res, {
        message: 'Website link updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deletes a website link.
   * DELETE /api/v1/my-website/links/:id
   */
  public static async deleteMyWebsiteLink(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const { id } = linkIdParamSchema.parse(req.params);
      await DistributorWebsiteService.deleteLink(req.user.id, id);

      sendSuccess(res, {
        message: 'Website link deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves public replicated website for a distributor by slug or distributor code.
   * GET /api/v1/public/distributor/:slug
   */
  public static async getPublicDistributorWebsite(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { slug } = distributorSlugParamSchema.parse(req.params);
      const website = await DistributorWebsiteService.getPublicWebsiteBySlug(slug);

      sendSuccess(res, {
        message: 'Public distributor website retrieved successfully.',
        data: website,
      });
    } catch (error) {
      next(error);
    }
  }
}
