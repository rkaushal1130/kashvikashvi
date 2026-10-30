import { NextFunction, Request, Response } from 'express';
import { AdminFundingCommissionService } from '../services/adminFundingCommission.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';

export class AdminFundingCommissionController {
  /**
   * GET /api/v1/admin/funding/commissions/summary
   * Daily Financial Summary Dashboard Cards
   */
  public static async getSummary(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const summary = await AdminFundingCommissionService.getDailyFinancialSummary({
        startDate,
        endDate,
      });

      sendSuccess(res, {
        statusCode: 200,
        message: 'Daily financial summary retrieved successfully',
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/funding/commissions/daily-report
   * Employee-Wise Daily Commission Report (23 columns, filters, pagination)
   */
  public static async getDailyReport(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        startDate,
        endDate,
        search,
        sponsorId,
        rank,
        tier,
        paymentStatus,
        commissionStatus,
        payoutBatchId,
        payoutStatus,
        page,
        pageSize,
        sortBy,
        sortOrder,
      } = req.query as any;

      const report = await AdminFundingCommissionService.getEmployeeDailyCommissionReport({
        startDate,
        endDate,
        search,
        sponsorId,
        rank,
        tier,
        paymentStatus,
        commissionStatus,
        payoutBatchId,
        payoutStatus,
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 10,
        sortBy,
        sortOrder,
      });

      sendSuccess(res, {
        statusCode: 200,
        message: 'Employee-wise daily commission report retrieved successfully',
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/funding/commissions/daily-report/export
   * CSV Export of the 23-column daily commission report
   */
  public static async exportCsv(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        startDate,
        endDate,
        search,
        sponsorId,
        rank,
        tier,
        paymentStatus,
        commissionStatus,
        payoutBatchId,
        payoutStatus,
      } = req.query as any;

      const csvData = await AdminFundingCommissionService.exportDailyCommissionReportCsv({
        startDate,
        endDate,
        search,
        sponsorId,
        rank,
        tier,
        paymentStatus,
        commissionStatus,
        payoutBatchId,
        payoutStatus,
      });

      const filename = `daily-commission-report-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/funding/commissions/distribute-preview
   * One-Click Distribution Preview & Eligibility Check
   */
  public static async getDistributePreview(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { periodId } = req.body || {};
      const preview = await AdminFundingCommissionService.getDistributionPreview(periodId);

      sendSuccess(res, {
        statusCode: 200,
        message: 'Commission distribution preview calculated successfully',
        data: preview,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/funding/commissions/distribute
   * One-Click Commission Distribution Execution
   */
  public static async executeDistribution(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUserId = (req as any).user?.id || 'admin-system';
      const { confirmDistribution, periodId, notes } = req.body || {};

      if (!confirmDistribution) {
        throw AppError.badRequest(
          'Explicit administrator confirmation (confirmDistribution: true) is required to execute commission distribution.'
        );
      }

      const result = await AdminFundingCommissionService.executeOneClickDistribution(
        adminUserId,
        { periodId, notes }
      );

      sendSuccess(res, {
        statusCode: 200,
        message: `Commission distribution executed successfully with status: ${result.status}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/funding/commissions/batches/:batchId/retry
   * Retry failed payouts for a batch
   */
  public static async retryFailed(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUserId = (req as any).user?.id || 'admin-system';
      const { batchId } = req.params;

      const result = await AdminFundingCommissionService.retryFailedBatchPayouts(
        batchId,
        adminUserId
      );

      sendSuccess(res, {
        statusCode: 200,
        message: `Retry completed. Newly succeeded: ${result.newlySucceededCount}, Still failed: ${result.stillFailedCount}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/funding/commissions/batches
   * List all payout batches
   */
  public static async listBatches(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const batches = await AdminFundingCommissionService.listPayoutBatches();
      sendSuccess(res, {
        statusCode: 200,
        message: 'Payout batches retrieved successfully',
        data: batches,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/funding/commissions/batches/:batchId
   * Payout batch details with item breakdown
   */
  public static async getBatchDetails(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { batchId } = req.params;
      const details = await AdminFundingCommissionService.getPayoutBatchDetails(batchId);

      sendSuccess(res, {
        statusCode: 200,
        message: 'Payout batch details retrieved successfully',
        data: details,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/funding/commissions/queue/stats
   * Returns live message queue metrics (queued, processing, completed, failedDLQ, retried)
   */
  public static async getQueueStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { CommissionQueueService } = await import('../services/commissionQueue.service');
      const stats = CommissionQueueService.getStats();
      sendSuccess(res, {
        statusCode: 200,
        message: 'Commission queue statistics retrieved successfully',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/funding/commissions/queue/failed
   * Retrieves all failed / dead-letter queue (DLQ) jobs with diagnostics
   */
  public static async getQueueFailedJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { batchId } = req.query as { batchId?: string };
      const { CommissionQueueService } = await import('../services/commissionQueue.service');
      const failed = CommissionQueueService.getFailedJobs(batchId);
      sendSuccess(res, {
        statusCode: 200,
        message: 'Failed commission queue jobs retrieved successfully',
        data: {
          totalFailed: failed.length,
          failedJobs: failed,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/funding/commissions/queue/retry-failed
   * Bulk or single retry of dead-letter jobs
   */
  public static async retryQueueFailed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUserId = (req as any).user?.id || 'admin-system';
      const { batchId, jobId } = req.body || {};
      const { CommissionQueueService } = await import('../services/commissionQueue.service');

      if (jobId) {
        const retried = await CommissionQueueService.retrySingleJob(jobId, adminUserId);
        sendSuccess(res, {
          statusCode: 200,
          message: `Job ${jobId} re-enqueued for execution`,
          data: retried,
        });
      } else {
        const bulk = await CommissionQueueService.retryAllFailed(batchId, adminUserId);
        sendSuccess(res, {
          statusCode: 200,
          message: `${bulk.retriedCount} dead-letter jobs re-enqueued for execution`,
          data: bulk,
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/funding/commissions/queue/enqueue-test
   * Enqueues test commission jobs for verification of queue workers, retries, and DLQ
   */
  public static async enqueueTestJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { distributorId = 'usr-test', distributorCode = 'DST-001', amount = 100, simulateFailure = false } = req.body || {};
      const { CommissionQueueService } = await import('../services/commissionQueue.service');
      const batchNumber = `PB-TEST-${Date.now().toString().slice(-4)}`;
      const result = await CommissionQueueService.enqueueBatch(
        `batch-${Date.now()}`,
        batchNumber,
        [
          {
            distributorId,
            distributorCode,
            distributorName: 'Test Distributor',
            amount: Number(amount),
            payoutMethod: simulateFailure ? 'INVALID_RAIL_FAIL' : 'WALLET_CREDIT',
          },
        ]
      );
      sendSuccess(res, {
        statusCode: 201,
        message: 'Test commission job enqueued',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
