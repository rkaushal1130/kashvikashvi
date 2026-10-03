import { NextFunction, Request, Response } from 'express';
import { DistributorService } from '../services/distributor.service';
import { sendSuccess } from '../utils/apiResponse';

export class DistributorController {
  /**
   * Retrieves authenticated distributor's referral link.
   * GET /api/v1/distributors/me/referral-link
   */
  public static async getMeReferralLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const baseUrl = (req.query.baseUrl as string) || (req.headers['x-base-url'] as string);
      let targetId = req.user?.id;

      if (!targetId && (req.query.distributorId as string)) {
        targetId = req.query.distributorId as string;
      }
      if (!targetId) {
        targetId = 'KV-1001';
      }

      const result = await DistributorService.getReferralLink(targetId, baseUrl);
      sendSuccess(res, {
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves referral link by distributor ID or code.
   * GET /api/v1/distributors/:id/referral-link
   */
  public static async getReferralLinkById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const baseUrl = (req.query.baseUrl as string) || (req.headers['x-base-url'] as string);
      const result = await DistributorService.getReferralLink(req.params.id, baseUrl);
      sendSuccess(res, {
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves authenticated distributor's profile.
   * GET /api/v1/distributors/me
   */
  public static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await DistributorService.getProfileByUserId(req.user!.id);
      sendSuccess(res, {
        message: 'Distributor profile retrieved.',
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates authenticated distributor's profile.
   * PATCH /api/v1/distributors/me
   */
  public static async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await DistributorService.updateProfile(req.user!.id, req.body);
      sendSuccess(res, {
        message: 'Distributor profile updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves distributor profile by ID or distributor code.
   * GET /api/v1/distributors/:id
   */
  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await DistributorService.getProfileByIdOrCode(req.params.id);
      sendSuccess(res, {
        message: 'Distributor profile retrieved.',
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves distributor's upline lineage (Sponsor & Binary parent).
   * GET /api/v1/distributors/:id/upline
   */
  public static async getUpline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const upline = await DistributorService.getUpline(req.params.id);
      sendSuccess(res, {
        message: 'Upline lineage retrieved.',
        data: upline,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves distributor's downline genealogy.
   * GET /api/v1/distributors/:id/downline
   */
  public static async getDownline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const depth = req.query.depth ? parseInt(req.query.depth as string, 10) : 3;
      const downline = await DistributorService.getDownline(req.params.id, depth);
      sendSuccess(res, {
        message: 'Downline genealogy retrieved.',
        data: downline,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves distributor's binary tree.
   * GET /api/v1/distributors/:id/tree
   */
  public static async getTree(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const depth = req.query.depth ? parseInt(req.query.depth as string, 10) : 3;
      const tree = await DistributorService.getTree(req.params.id, depth);
      sendSuccess(res, {
        message: 'Binary tree retrieved.',
        data: tree,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves distributor's personal direct team.
   * GET /api/v1/distributors/:id/team
   */
  public static async getTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const team = await DistributorService.getTeam(req.params.id);
      sendSuccess(res, {
        message: 'Direct team retrieved.',
        data: team,
      });
    } catch (error) {
      next(error);
    }
  }
}
