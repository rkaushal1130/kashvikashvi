import crypto from 'crypto';
import {
  IPnbBankingAdapter,
  PnbRailType,
  PnbBeneficiaryItem,
  BankBatchFileResult,
  DisbursalResult,
  TransferStatusResult,
  ReconciliationMisResult,
  MisParsedRow,
} from './pnbBankingAdapter.interface';

export class PnbPortalBulkFileAdapter implements IPnbBankingAdapter {
  public readonly railType: PnbRailType = 'PNB_PORTAL_BULK';
  public readonly corporateAccountNumber: string;
  public readonly corporateIfsc: string;

  constructor(
    accountNumber: string = '1923102100000382',
    ifsc: string = 'PUNB0192310'
  ) {
    this.corporateAccountNumber = accountNumber;
    this.corporateIfsc = ifsc;
  }

  /**
   * Generates a standard PNB Corporate Internet Banking (CIB) compliant CSV file.
   * Format:
   * RecordType,DebitAccount,BeneficiaryAccount,BeneficiaryName,IFSC,Amount,Currency,PaymentMode,CustomerRef,TxDate,Narration
   */
  public async generateBulkBatchFile(
    batchNumber: string,
    beneficiaries: PnbBeneficiaryItem[]
  ): Promise<BankBatchFileResult> {
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

    const headers = [
      'Debit Account Number',
      'Beneficiary Account Number',
      'Beneficiary Name',
      'Beneficiary IFSC',
      'Amount (INR)',
      'Currency',
      'Payment Mode',
      'Customer Reference Number',
      'Value Date',
      'Remarks / Narration',
    ];

    const rows: string[] = [];
    let totalAmount = 0;

    for (const b of beneficiaries) {
      // Determine optimal payment mode:
      // RTGS: >= 2,00,000 INR; NEFT: < 2,00,000 INR; IMPS: < 5,00,000 INR (optional)
      let mode = b.paymentMode || 'NEFT';
      if (!b.paymentMode) {
        mode = b.amount >= 200000 ? 'RTGS' : 'NEFT';
      }

      totalAmount += b.amount;

      // Cleanse beneficiary name for banking format (remove commas, special characters)
      const cleanName = (b.accountHolderName || b.distributorName || 'Beneficiary')
        .replace(/[,;"']/g, '')
        .trim();

      const cleanIfsc = (b.ifscCode || '').toUpperCase().trim();
      const cleanAcc = (b.accountNumber || '').trim();
      const refNumber = b.customerReference || `${batchNumber}-${b.distributorCode}`;
      const narration = (b.narration || 'Kashvi MLM Commission Payout').replace(/[,;"']/g, '');

      const row = [
        this.corporateAccountNumber,
        cleanAcc,
        `"${cleanName}"`,
        cleanIfsc,
        b.amount.toFixed(2),
        'INR',
        mode,
        refNumber,
        formattedDate,
        `"${narration}"`,
      ].join(',');

      rows.push(row);
    }

    const fileContent = [headers.join(','), ...rows].join('\r\n');

    // Cryptographic SHA-256 hash
    const checksumSha256 = crypto
      .createHash('sha256')
      .update(fileContent, 'utf8')
      .digest('hex');

    const fileName = `PNB_CIB_${batchNumber}_${today.toISOString().slice(0, 10).replace(/-/g, '')}.csv`;

    return {
      fileName,
      fileContent,
      checksumSha256,
      totalRecords: beneficiaries.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      fileType: 'PNB_BULK_UPLOAD_CSV',
      generatedAt: today,
    };
  }

  /**
   * Initiates disbursal for offline CIB portal rail:
   * Generates the verified file, registers it, and prepares it for checker download & upload.
   */
  public async initiateDisbursal(
    batchNumber: string,
    beneficiaries: PnbBeneficiaryItem[]
  ): Promise<DisbursalResult> {
    const fileResult = await this.generateBulkBatchFile(batchNumber, beneficiaries);

    return {
      batchId: batchNumber,
      batchNumber,
      channel: 'PNB_PORTAL_BULK',
      status: 'PROCESSING',
      submittedCount: beneficiaries.length,
      quarantinedCount: 0,
      fileResult,
      notes: `PNB Bulk Upload file '${fileResult.fileName}' generated with SHA-256 checksum ${fileResult.checksumSha256}. Upload to PNB Corporate Internet Banking portal to execute transfers.`,
    };
  }

  public async queryTransferStatus(_referenceId: string): Promise<TransferStatusResult> {
    // For bulk portal file, status is updated asynchronously via Reverse MIS ingestion
    return {
      referenceId: _referenceId,
      status: 'SUBMITTED',
    };
  }

  /**
   * Ingests and parses a PNB reverse MIS statement (CSV / TXT).
   * Expects standard columns:
   * Customer Reference, Beneficiary Account, Amount, Status (SUCCESS / REJECTED / FAILED), UTR / Bank Reference, Failure Reason
   */
  public async parseReconciliationMisFile(
    fileBuffer: Buffer | string,
    batchItems: { id: string; payoutReference: string; amount: number }[]
  ): Promise<ReconciliationMisResult> {
    const text = typeof fileBuffer === 'string' ? fileBuffer : fileBuffer.toString('utf8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

    const parsedRows: MisParsedRow[] = [];

    // Parse header and content
    let startIdx = 0;
    if (lines.length > 0 && lines[0].toLowerCase().includes('reference')) {
      startIdx = 1; // Skip header row
    }

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
      if (cols.length < 4) continue;

      // Identify column positions dynamically or default to standard PNB reverse layout:
      // Col 0: CustomerRef, Col 1: Account, Col 2: Amount, Col 3: Status, Col 4: UTR, Col 5: Reason
      const ref = cols[0] || '';
      const acc = cols[1] || '';
      const amt = parseFloat(cols[2]) || 0;
      const statusRaw = (cols[3] || '').toUpperCase();
      const utr = cols[4] || '';
      const reason = cols[5] || '';

      const isSuccess =
        statusRaw.includes('SUCCESS') ||
        statusRaw.includes('SETTLED') ||
        statusRaw === 'PAID' ||
        statusRaw === 'PROCESSED';

      const isRejected =
        statusRaw.includes('REJECT') ||
        statusRaw.includes('FAIL') ||
        statusRaw.includes('RETURN') ||
        statusRaw.includes('BOUNCE');

      parsedRows.push({
        customerReference: ref,
        beneficiaryAccount: acc,
        amount: amt,
        status: isSuccess ? 'SUCCESS' : isRejected ? 'REJECTED' : 'RETURNED',
        utrNumber: utr || undefined,
        reasonCode: reason || (isRejected ? 'BANK_REJECTED' : undefined),
        reasonMessage: reason,
      });
    }

    // Match parsed rows against known batch items
    const refMap = new Map<string, { id: string; payoutReference: string; amount: number }>();
    for (const item of batchItems) {
      if (item.payoutReference) {
        refMap.set(item.payoutReference.toLowerCase(), item);
      }
    }

    const settledItems: any[] = [];
    const quarantinedItems: any[] = [];
    const unmatchedRecords: MisParsedRow[] = [];

    let settledCount = 0;
    let settledAmount = 0;
    let rejectedCount = 0;
    let rejectedAmount = 0;

    for (const row of parsedRows) {
      const matched = refMap.get(row.customerReference.toLowerCase());
      if (matched) {
        if (row.status === 'SUCCESS') {
          settledCount++;
          settledAmount += matched.amount;
          settledItems.push({
            itemId: matched.id,
            customerReference: row.customerReference,
            utrNumber: row.utrNumber || `PUNB-UTR-${Date.now()}`,
            amount: matched.amount,
          });
        } else {
          rejectedCount++;
          rejectedAmount += matched.amount;
          quarantinedItems.push({
            itemId: matched.id,
            customerReference: row.customerReference,
            amount: matched.amount,
            reason: row.reasonMessage || row.reasonCode || 'Bank transfer rejected by PNB',
          });
        }
      } else {
        unmatchedRecords.push(row);
      }
    }

    return {
      totalRecordsProcessed: parsedRows.length,
      matchedCount: settledItems.length + quarantinedItems.length,
      settledCount,
      settledAmount: Math.round(settledAmount * 100) / 100,
      rejectedCount,
      rejectedAmount: Math.round(rejectedAmount * 100) / 100,
      settledItems,
      quarantinedItems,
      unmatchedRecords,
    };
  }

  public verifyWebhookSignature(_payload: string | Buffer, _signature: string): boolean {
    return true; // Bulk file mode does not use inbound webhook signatures
  }
}
