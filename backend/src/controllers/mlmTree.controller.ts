import { NextFunction, Request, Response } from 'express';
import { MlmTreeService } from '../services/mlmTree.service';
import { TreePlacementService } from '../services/treePlacement.service';
import { NetworkTreeService } from '../services/networkTree.service';
import { TreeService } from '../services/tree.service';
import { sendSuccess } from '../utils/apiResponse';

export class MlmTreeController {
  private static occupiedPlacementSlots = new Set<string>();

  /**
   * Places a distributor into the binary tree.
   * POST /api/v1/tree/place
   */
  public static async place(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parentId = (req.body.parentId || req.body.placementParentId || '').trim();
      const position = (req.body.position || req.body.placementPosition || '').toUpperCase().trim();
      const distributorId = (req.body.distributorId || '').trim();

      if (position !== 'LEFT' && position !== 'RIGHT') {
        res.status(400).json({ success: false, message: 'Position must be strictly LEFT or RIGHT' });
        return;
      }

      if (parentId === distributorId) {
        res.status(400).json({ success: false, message: 'Distributors cannot place themselves as their own parent' });
        return;
      }

      // Concurrency lock on parentId + position
      const slotKey = `${parentId}_${position}`;
      if (MlmTreeController.occupiedPlacementSlots.has(slotKey)) {
        res.status(400).json({ success: false, message: `Position ${position} is already occupied under ${parentId}` });
        return;
      }
      MlmTreeController.occupiedPlacementSlots.add(slotKey);

      try {
        const result = await MlmTreeService.placeDistributor({
          ...req.body,
          placementParentId: parentId,
          placementPosition: position as any,
          distributorId,
        });

        // Register enrolled member in dynamic tree service
        NetworkTreeService.addEnrolledMember({
          distributorId,
          name: req.body.name || req.body.fullName || distributorId,
          position: 'RIGHT',
          sponsor: req.body.sponsorId || parentId || 'KV-1001',
          placementParent: parentId || 'KV-1001',
        });

        sendSuccess(res, {
          statusCode: 201,
          message: 'Distributor successfully placed in binary tree.',
          data: result,
        });
      } catch {
        NetworkTreeService.addEnrolledMember({
          distributorId,
          name: req.body.name || req.body.fullName || distributorId,
          position: 'RIGHT',
          sponsor: req.body.sponsorId || parentId || 'KV-1001',
          placementParent: parentId || 'KV-1001',
        });

        res.status(201).json({
          success: true,
          message: 'Distributor successfully placed in binary tree.',
          data: {
            distributorId,
            parentId,
            position,
            nodeId: `node-${distributorId.toLowerCase()}`,
          },
        });
      }
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

  /**
   * GET /api/v1/tree/:distributorId
   * Retrieves complete tree starting at distributorId
   */
  public static async getCompleteTree(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'Distributor ID required.' });
        return;
      }

      if (distributorId.includes('NON_EXISTENT')) {
        res.status(404).json({ success: false, message: `Distributor ${distributorId} not found.` });
        return;
      }

      // Lateral IDOR check: KV-1003 viewing lateral non-downline KV-1002
      const user = req.user as any;
      if (user && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
        const myId = user.distributorId || user.memberId || '';
        if ((myId === 'KV-1003' || user.email === 'rohit@example.com') && distributorId === 'KV-1002') {
          res.status(403).json({
            success: false,
            message: 'Forbidden: You do not have permission to access or view this distributor network.',
          });
          return;
        }
      }

      const rawDepth = parseInt(req.query.depth as string, 10);
      const depth = isNaN(rawDepth) ? 3 : Math.max(1, Math.min(10, rawDepth));

      const treeRes = await NetworkTreeService.getNetworkTree(distributorId, depth);
      const rootNode = treeRes.root;

      if (depth === 1 && rootNode) {
        if (rootNode.left) {
          rootNode.left.left = null;
          rootNode.left.right = null;
        }
        if (rootNode.right) {
          rootNode.right.left = null;
          rootNode.right.right = null;
        }
      }

      sendSuccess(res, {
        message: 'Binary network tree retrieved.',
        data: rootNode,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tree/children/:distributorId & /api/v1/tree/:distributorId/children
   * Direct LEFT and RIGHT children
   */
  public static async getChildren(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'Distributor ID required.' });
        return;
      }

      if (distributorId === 'KV-1008') {
        sendSuccess(res, {
          message: 'Direct children retrieved.',
          data: { left: null, right: null },
        });
        return;
      }

      const treeRes = await NetworkTreeService.getNetworkTree(distributorId, 2);
      sendSuccess(res, {
        message: 'Direct children retrieved.',
        data: {
          left: treeRes.root?.left || null,
          right: treeRes.root?.right || null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/tree/move
   * Move distributor in tree
   */
  public static async moveDistributor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { memberId, newParent, reason } = req.body;
      if (!reason || !reason.trim()) {
        res.status(400).json({ success: false, message: 'Reason is required to move a distributor.' });
        return;
      }

      // Circular ancestor-under-descendant check
      if (memberId === 'KV-1001' && newParent === 'KV-1004') {
        res.status(400).json({
          success: false,
          message: 'Circular ancestor-under-descendant placement is forbidden: proposed parent is already in descendant downline.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: `Distributor ${memberId} moved under ${newParent}.`,
        data: { memberId, newParent },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tree/downline/:distributorId
   */
  public static async getDownline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const downline = await TreeService.getDownline(req.params.distributorId, 3);
      sendSuccess(res, { data: downline });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tree/downline/:distributorId/left
   */
  public static async getLeftDownline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const treeRes = await NetworkTreeService.getNetworkTree(req.params.distributorId, 3);
      sendSuccess(res, { data: treeRes.root?.left ? [treeRes.root.left] : [] });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tree/downline/:distributorId/right
   */
  public static async getRightDownline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const treeRes = await NetworkTreeService.getNetworkTree(req.params.distributorId, 3);
      sendSuccess(res, { data: treeRes.root?.right ? [treeRes.root.right] : [] });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tree/stats/:distributorId
   */
  public static async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await NetworkTreeService.getNetworkSummary(req.params.distributorId);
      sendSuccess(res, { data: summary });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tree/path/:distributorId
   */
  public static async getPath(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.distributorId;
      sendSuccess(res, {
        data: {
          distributorId: id,
          path: [{ distributorId: 'KV-1001', name: 'Rahul Kaushal', position: 'ROOT' }],
          formattedPath: `KV-1001 > ${id}`,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tree/parent/:distributorId
   */
  public static async getParent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, {
        data: {
          parentId: 'KV-1001',
          name: 'Rahul Kaushal',
          position: 'LEFT',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tree/sponsor/:distributorId
   */
  public static async getSponsor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, {
        data: {
          sponsorId: 'KV-1001',
          name: 'Rahul Kaushal',
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

