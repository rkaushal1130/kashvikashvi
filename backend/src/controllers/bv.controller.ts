import { NextFunction, Request, Response } from 'express';
import { BVService } from '../services/bv.service';
import { DistributorService } from '../services/distributor.service';
import { sendSuccess } from '../utils/apiResponse';
import {
  bvLedgerQuerySchema,
  creditBVSchema,
  debitBVSchema,
  periodParamSchema,
  reverseBVTransactionSchema,
} from '../validators/bv.validators';

export class BVController {
  /**
   * Retrieves the current BV balance for the authenticated distributor.
   * GET /api/v1/bv/balance
   */
  public static async getMyBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await DistributorService.getProfileByUserId(req.user!.id);
      const businessCenterId = req.query.businessCenterId as string | undefined;

      const balanceData = await BVService.getBalance(profile.id, businessCenterId);
      sendSuccess(res, {
        message: 'BV balance retrieved successfully',
        data: balanceData,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves BV accumulated for a specific commission period for the authenticated distributor.
   * GET /api/v1/bv/period/:periodId
   */
  public static async getMyPeriodBV(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { periodId } = periodParamSchema.parse(req.params);
      const profile = await DistributorService.getProfileByUserId(req.user!.id);
      const businessCenterId = req.query.businessCenterId as string | undefined;

      const periodBV = await BVService.getPeriodBV(profile.id, periodId, businessCenterId);
      sendSuccess(res, {
        message: 'Period BV retrieved successfully',
        data: periodBV,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves LEFT and RIGHT binary leg volumes for the authenticated distributor.
   * GET /api/v1/bv/legs
   */
  public static async getMyLegs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await DistributorService.getProfileByUserId(req.user!.id);
      const businessCenterId = req.query.businessCenterId as string | undefined;
      const periodId = req.query.periodId as string | undefined;

      const options = { businessCenterId, periodId };
      const [left, right] = await Promise.all([
        BVService.getLeftBV(profile.id, options),
        BVService.getRightBV(profile.id, options),
      ]);

      sendSuccess(res, {
        message: 'Binary leg volumes retrieved successfully',
        data: {
          distributorId: profile.id,
          businessCenterId: businessCenterId || null,
          left,
          right,
          totalGroupBV: left.totalBV + right.totalBV,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves paginated BV ledger history for the authenticated distributor.
   * GET /api/v1/bv/ledger
   */
  public static async getMyLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await DistributorService.getProfileByUserId(req.user!.id);
      const query = bvLedgerQuerySchema.parse(req.query);

      const result = await BVService.getLedger(profile.id, query);
      sendSuccess(res, {
        message: 'BV ledger retrieved successfully',
        data: result.entries,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves BV balance for any distributor (Admin/SuperAdmin/Support).
   * GET /api/v1/bv/distributors/:distributorId/balance
   */
  public static async getDistributorBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await DistributorService.getProfileByIdOrCode(req.params.distributorId);
      const businessCenterId = req.query.businessCenterId as string | undefined;

      const balanceData = await BVService.getBalance(profile.id, businessCenterId);
      sendSuccess(res, {
        message: 'Distributor BV balance retrieved successfully',
        data: balanceData,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves period BV for any distributor (Admin/SuperAdmin/Support).
   * GET /api/v1/bv/distributors/:distributorId/period/:periodId
   */
  public static async getDistributorPeriodBV(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { periodId } = periodParamSchema.parse(req.params);
      const profile = await DistributorService.getProfileByIdOrCode(req.params.distributorId);
      const businessCenterId = req.query.businessCenterId as string | undefined;

      const periodBV = await BVService.getPeriodBV(profile.id, periodId, businessCenterId);
      sendSuccess(res, {
        message: 'Distributor period BV retrieved successfully',
        data: periodBV,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves leg volumes for any distributor (Admin/SuperAdmin/Support).
   * GET /api/v1/bv/distributors/:distributorId/legs
   */
  public static async getDistributorLegs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await DistributorService.getProfileByIdOrCode(req.params.distributorId);
      const businessCenterId = req.query.businessCenterId as string | undefined;
      const periodId = req.query.periodId as string | undefined;

      const options = { businessCenterId, periodId };
      const [left, right] = await Promise.all([
        BVService.getLeftBV(profile.id, options),
        BVService.getRightBV(profile.id, options),
      ]);

      sendSuccess(res, {
        message: 'Distributor binary leg volumes retrieved successfully',
        data: {
          distributorId: profile.id,
          businessCenterId: businessCenterId || null,
          left,
          right,
          totalGroupBV: left.totalBV + right.totalBV,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves paginated BV ledger for any distributor (Admin/SuperAdmin/Support).
   * GET /api/v1/bv/distributors/:distributorId/ledger
   */
  public static async getDistributorLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await DistributorService.getProfileByIdOrCode(req.params.distributorId);
      const query = bvLedgerQuerySchema.parse(req.query);

      const result = await BVService.getLedger(profile.id, query);
      sendSuccess(res, {
        message: 'Distributor BV ledger retrieved successfully',
        data: result.entries,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Manual BV credit with required sourceId reference (Admin/SuperAdmin only).
   * POST /api/v1/bv/credit
   */
  public static async creditBV(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = creditBVSchema.parse(req.body);
      const entry = await BVService.creditBV(input);

      sendSuccess(res, {
        statusCode: 201,
        message: 'BV credited successfully',
        data: entry,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Manual BV debit with required sourceId reference (Admin/SuperAdmin only).
   * POST /api/v1/bv/debit
   */
  public static async debitBV(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = debitBVSchema.parse(req.body);
      const entry = await BVService.debitBV(input);

      sendSuccess(res, {
        statusCode: 201,
        message: 'BV debited successfully',
        data: entry,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reverses a previous BV transaction via compensating REVERSAL entry (Admin/SuperAdmin only).
   * POST /api/v1/bv/reverse
   */
  public static async reverseTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = reverseBVTransactionSchema.parse(req.body);
      const entry = await BVService.reverseTransaction(input);

      sendSuccess(res, {
        statusCode: 200,
        message: 'BV transaction reversed successfully',
        data: entry,
      });
    } catch (error) {
      next(error);
    }
  }
}
