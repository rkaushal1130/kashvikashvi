import {
  IPnbBankingAdapter,
  PnbRailType,
  PnbBeneficiaryItem,
  BankBatchFileResult,
  DisbursalResult,
  TransferStatusResult,
  ReconciliationMisResult,
} from './pnbBankingAdapter.interface';
import { PnbPortalBulkFileAdapter } from './pnbPortalBulkFileAdapter';

export class PnbMockSandboxAdapter implements IPnbBankingAdapter {
  public readonly railType: PnbRailType = 'MOCK_SANDBOX';
  public readonly corporateAccountNumber: string = '1923102100000382';
  public readonly corporateIfsc: string = 'PUNB0192310';

  private fileAdapter = new PnbPortalBulkFileAdapter(
    this.corporateAccountNumber,
    this.corporateIfsc
  );

  public async generateBulkBatchFile(
    batchNumber: string,
    beneficiaries: PnbBeneficiaryItem[]
  ): Promise<BankBatchFileResult> {
    return this.fileAdapter.generateBulkBatchFile(batchNumber, beneficiaries);
  }

  public async initiateDisbursal(
    batchNumber: string,
    beneficiaries: PnbBeneficiaryItem[]
  ): Promise<DisbursalResult> {
    const fileResult = await this.generateBulkBatchFile(batchNumber, beneficiaries);

    return {
      batchId: batchNumber,
      batchNumber,
      channel: 'MOCK_SANDBOX',
      status: 'PROCESSING',
      submittedCount: beneficiaries.length,
      quarantinedCount: 0,
      fileResult,
      notes: `[MOCK SANDBOX] PNB payout simulation executed for batch ${batchNumber}. Total records: ${beneficiaries.length}.`,
    };
  }

  public async queryTransferStatus(referenceId: string): Promise<TransferStatusResult> {
    return {
      referenceId,
      status: 'SETTLED',
      utrNumber: `MOCK-PNB-UTR-${Date.now()}`,
      settledAt: new Date(),
    };
  }

  public async parseReconciliationMisFile(
    fileBuffer: Buffer | string,
    batchItems: { id: string; payoutReference: string; amount: number }[]
  ): Promise<ReconciliationMisResult> {
    return this.fileAdapter.parseReconciliationMisFile(fileBuffer, batchItems);
  }

  public verifyWebhookSignature(_payload: string | Buffer, _signature: string): boolean {
    return true;
  }
}
