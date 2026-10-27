import { Request, Response, NextFunction } from 'express';
import { AdminCommissionDistributionService } from '../services/adminCommissionDistribution.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import { PnbBankingAdapterFactory, PnbBeneficiaryItem } from '../providers/banking';
import {
  createBatchSchema,
  approveBatchSchema,
  rejectBatchSchema,
  remediateItemSchema,
  batchListQuerySchema,
  batchIdParamSchema,
  itemIdParamSchema,
} from '../validators/adminCommissionDistribution.validators';

export class AdminCommissionDistributionController {
  public static async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const periodId = req.query.periodId as string | undefined;
      const summary = await AdminCommissionDistributionService.getSummary(periodId);
      sendSuccess(res, {
        message: 'Commission distribution summary retrieved successfully',
        data: summary,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getPreview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const periodId = (req.query.periodId || req.body?.periodId) as string | undefined;
      const preview = await AdminCommissionDistributionService.getEligibleCommissionsPreview(periodId);
      sendSuccess(res, {
        message: 'Eligible commissions preview generated successfully',
        data: preview,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async createBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const input = createBatchSchema.parse(req.body);
      const batch = await AdminCommissionDistributionService.createPayoutBatch(req.user.id, input);

      sendSuccess(res, {
        statusCode: 201,
        message: 'Commission payout batch created successfully in DRAFT status',
        data: batch,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async listBatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = batchListQuerySchema.parse(req.query);
      const result = await AdminCommissionDistributionService.listBatches(query);

      sendSuccess(res, {
        message: 'Payout batches retrieved successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getBatchDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { batchId } = batchIdParamSchema.parse(req.params);
      const batch = await AdminCommissionDistributionService.getBatchDetails(batchId);

      sendSuccess(res, {
        message: 'Batch details retrieved successfully',
        data: batch,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async approveBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const { batchId } = batchIdParamSchema.parse(req.params);
      const input = approveBatchSchema.parse(req.body);
      const result = await AdminCommissionDistributionService.approveBatch(req.user.id, batchId, input);

      sendSuccess(res, {
        message: 'Payout batch approved successfully by checker',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async rejectBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const { batchId } = batchIdParamSchema.parse(req.params);
      const input = rejectBatchSchema.parse(req.body);
      const result = await AdminCommissionDistributionService.rejectBatch(req.user.id, batchId, input.reason);

      sendSuccess(res, {
        message: 'Payout batch rejected by checker',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async initiatePayout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const { batchId } = batchIdParamSchema.parse(req.params);
      const result = await AdminCommissionDistributionService.initiatePayout(req.user.id, batchId);

      sendSuccess(res, {
        message: 'PNB payout disbursal initiated successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async reconcileMis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const { batchId } = batchIdParamSchema.parse(req.params);
      let fileBuffer = req.body?.fileContent || '';

      if (!fileBuffer && req.body) {
        fileBuffer = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }

      if (!fileBuffer) {
        throw AppError.badRequest('PNB Reverse MIS file content is required for reconciliation.');
      }

      const result = await AdminCommissionDistributionService.reconcileBankMisFile(
        req.user.id,
        batchId,
        fileBuffer
      );

      sendSuccess(res, {
        message: 'Reverse MIS statement parsed and reconciled successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getQuarantine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { batchId } = batchIdParamSchema.parse(req.params);
      const items = await AdminCommissionDistributionService.getQuarantinedItems(batchId);

      sendSuccess(res, {
        message: 'Quarantined payout items retrieved successfully',
        data: items,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async remediateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const { batchId, itemId } = itemIdParamSchema.parse(req.params);
      const input = remediateItemSchema.parse(req.body);
      const result = await AdminCommissionDistributionService.remediateQuarantinedItem(
        req.user.id,
        batchId,
        itemId,
        input
      );

      sendSuccess(res, {
        message: 'Item remediated successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async exportBatchCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { batchId } = batchIdParamSchema.parse(req.params);
      const csv = await AdminCommissionDistributionService.exportBatchReportCsv(batchId);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="PayoutBatch_${batchId}.csv"`);
      res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  }

  public static async exportPnbFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { batchId } = batchIdParamSchema.parse(req.params);
      const batch = await AdminCommissionDistributionService.getBatchDetails(batchId);

      const items = (batch.items || []).filter(
        (it: any) => it.transferStatus === 'READY_FOR_DISBURSAL' || it.transferStatus === 'SUBMITTED'
      );

      const beneficiaries: PnbBeneficiaryItem[] = items.map((it: any) => ({
        itemId: it.id,
        distributorId: it.distributorId,
        distributorCode: it.distributorCode,
        distributorName: it.distributorName,
        accountHolderName: it.accountHolderName || it.distributorName,
        accountNumber: it.encryptedAccountNumber || it.maskedAccountNumber || '00000000',
        ifscCode: it.ifscCode || 'PUNB0192310',
        bankName: it.bankName || 'Punjab National Bank',
        amount: Number(it.amount),
        customerReference: it.payoutReference || `${batch.batchNumber}-${it.distributorCode}`,
        narration: `Kashvi MLM Commission Payout: Batch ${batch.batchNumber}`,
      }));

      const adapter = PnbBankingAdapterFactory.getAdapter();
      const fileResult = await adapter.generateBulkBatchFile(batch.batchNumber, beneficiaries);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileResult.fileName}"`);
      res.setHeader('X-Checksum-SHA256', fileResult.checksumSha256);
      res.status(200).send(fileResult.fileContent);
    } catch (err) {
      next(err);
    }
  }
}
