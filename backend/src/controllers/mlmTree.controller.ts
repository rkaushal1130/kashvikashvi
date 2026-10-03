import { NextFunction, Request, Response } from 'express';
import { MlmTreeService } from '../services/mlmTree.service';
import { TreePlacementService } from '../services/treePlacement.service';
import { sendSuccess } from '../utils/apiResponse';

export class MlmTreeController {
  /**
   * Places a distributor into the binary tree.
   * POST /api/v1/tree/place
   */
  public static async place(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MlmTreeService.placeDistributor(req.body);
      sendSuccess(res, {
        statusCode: 201,
        message: 'Distributor successfully placed in binary tree.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves visual binary tree up to requested depth.
   * GET /api/v1/tree/binary/:rootId
   */
  public static async getBinaryTree(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rootId } = req.params;
      const depth = req.query.depth ? parseInt(req.query.depth as string, 10) : 3;
      const tree = await MlmTreeService.getBinaryTree(rootId, depth);

      sendSuccess(res, {
        message: 'Binary tree retrieved successfully.',
        data: tree,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves unilevel sponsor genealogy tree.
   * GET /api/v1/tree/sponsor/:distributorId
   */
  public static async getSponsorTree(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { distributorId } = req.params;
      const depth = req.query.depth ? parseInt(req.query.depth as string, 10) : 3;
      const sponsorTree = await MlmTreeService.getSponsorTree(distributorId, depth);

      sendSuccess(res, {
        message: 'Sponsor genealogy tree retrieved successfully.',
        data: sponsorTree,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Recommends the next open leaf slot for placement.
   * GET /api/v1/tree/next-slot/:nodeId
   */
  public static async getNextAvailableSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { nodeId } = req.params;
      const preferredLeg = (req.query.preferredLeg as any) || 'BALANCED';
      const slot = await MlmTreeService.findNextAvailableSlot(nodeId, preferredLeg);

      sendSuccess(res, {
        message: 'Recommended placement slot retrieved.',
        data: slot,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Seeds the exact requested model tree:
   * Distributor A -> LEFT (B -> C) & RIGHT (D -> E)
   * POST /api/v1/tree/seed-model
   */
  public static async seedModelTree(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MlmTreeService.seedModelTree();
      sendSuccess(res, {
        statusCode: 201,
        message: 'Model MLM tree seeded successfully: A -> LEFT (B -> C) & RIGHT (D -> E).',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Enrolls a new member using Sponsor ID
   * POST /api/v1/tree/enroll
   */
  public static async enrollMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MlmTreeService.enrollMember(req.body);
      sendSuccess(res, {
        statusCode: 201,
        message: 'Member successfully enrolled under sponsor.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

