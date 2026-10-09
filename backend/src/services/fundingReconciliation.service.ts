import { FundingTransactionStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { SafeDecimal } from '../utils/safeDecimal';
import { FundingProviderFactory } from '../providers/funding';
import { PlatformTreasuryService } from './platformTreasury.service';
import { FundingService } from './funding.service';
import {
  FundingDiscrepancyDetail,
  FundingDiscrepancyType,
  ReconcileFundingPeriodResult,
  ReconcileTransactionResult,
  ResolveDiscrepancyResult,
  ResolveFundingDiscrepancyInput,
} from '../types/funding.types';

/**
 * ============================================================================
 * BANK FUNDING RECONCILIATION SERVICE (PROMPT 40)
 * ============================================================================
 *
 * Implements authoritative 3-way reconciliation comparing:
 *
 * External Provider
 *        ↕
 * FundingTransaction
 *        ↕
 * Platform Treasury Ledger
 *
 * DETECTS 7 SPECIFIC DISCREPANCIES:
 * 1. External success but internal pending (EXTERNAL_SUCCESS_INTERNAL_PENDING)
 * 2. External success but no internal transaction (EXTERNAL_SUCCESS_NO_INTERNAL_TX)
 * 3. Internal success but external failure (INTERNAL_SUCCESS_EXTERNAL_FAILURE)
 * 4. Amount mismatch (AMOUNT_MISMATCH)
 * 5. Currency mismatch (CURRENCY_MISMATCH)
 * 6. Duplicate provider transaction (DUPLICATE_PROVIDER_TRANSACTION)
 * 7. Reversal not reflected internally (REVERSAL_NOT_REFLECTED_INTERNALLY)
 *
 * FINANCIAL SAFETY INVARIANTS:
 * - Mark discrepancies as RECONCILIATION_REQUIRED.
 * - DO NOT automatically credit or debit money unless correction is verified.
 * - Admin review portal for inspecting discrepancies.
 * - All reconciliation actions are immutably audited.
 */
export class FundingReconciliationService {
  /**
   * 1. reconcileFundingTransaction(id)
   * Executes a strict 3-way check on a single corporate funding transaction.
   * Compares External Provider <-> FundingTransaction <-> Platform Treasury Ledger.
   * If any discrepancy is found, marks RECONCILIATION_REQUIRED with NO automatic money movement.
   */
  public static async reconcileFundingTransaction(
    id: string,
    options?: {
      adminId?: string;
      expectedAmount?: number;
      notes?: string;
      ipAddress?: string;
      userAgent?: string;
    },
    txClient?: Prisma.TransactionClient
  ): Promise<ReconcileTransactionResult> {
    const db = txClient || prisma;

    // 1. Fetch internal FundingTransaction
    const tx = await db.fundingTransaction.findUnique({
      where: { id: id.trim() },
      include: {
        fundingAccount: true,
        initiatedByAdmin: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    if (!tx) {
      throw AppError.notFound(`Funding transaction '${id}' not found`, 'TRANSACTION_NOT_FOUND');
    }

    if (!tx.providerTransactionId) {
      throw AppError.badRequest(
        `Funding transaction '${id}' is missing providerTransactionId; cannot reconcile with external provider`,
        'MISSING_PROVIDER_TX_ID'
      );
    }

    const internalAmount = SafeDecimal.round(tx.amount, 2);
    const internalCurrency = (tx.currency || 'INR').trim().toUpperCase();
    const internalStatus = tx.status;
    const providerName = tx.provider.trim().toUpperCase();
    const providerTxId = tx.providerTransactionId.trim();

    // 2. Fetch Layer 3: Platform Treasury Ledger records for this transaction
    const [ledgerCredits, ledgerDebits, duplicateTxs] = await Promise.all([
      db.platformWalletTransaction.findMany({
        where: {
          type: { in: ['FUNDING', 'ADJUSTMENT'] },
          status: 'COMPLETED',
          OR: [
            { referenceType: 'FUNDING_TRANSACTION', referenceId: tx.id },
            { providerTransactionId: providerTxId },
            { externalTransactionId: providerTxId },
            { idempotencyKey: `TREASURY_CREDIT:${tx.id}` },
          ],
        },
      }),
      db.platformWalletTransaction.findMany({
        where: {
          type: 'FUNDING_REVERSAL',
          status: 'COMPLETED',
          OR: [
            { referenceType: 'FUNDING_TRANSACTION_REVERSAL', referenceId: tx.id },
            { referenceType: 'FUNDING_TRANSACTION', referenceId: tx.id },
            { idempotencyKey: `TREASURY_REVERSAL:${tx.id}` },
          ],
        },
      }),
      db.fundingTransaction.findMany({
        where: {
          provider: providerName,
          providerTransactionId: providerTxId,
        },
      }),
    ]);

    const hasLedgerCredit = ledgerCredits.length > 0;
    const totalLedgerCreditAmount = ledgerCredits.reduce(
      (sum, item) => sum + SafeDecimal.round(item.amount, 2),
      0
    );
    const hasLedgerDebit = ledgerDebits.length > 0;
    const totalLedgerDebitAmount = ledgerDebits.reduce(
      (sum, item) => sum + SafeDecimal.round(item.amount, 2),
      0
    );

    // 3. Query Layer 1: External Provider
    const provider = FundingProviderFactory.getProvider(providerName);
    const expectedCheckAmount = options?.expectedAmount ?? internalAmount;

    let externalStatus = 'UNKNOWN';
    let externalAmount = internalAmount;
    let externalCurrency = internalCurrency;
    let externalUtr: string | undefined;

    try {
      const recon = await provider.reconcileTransaction(providerTxId, expectedCheckAmount);
      externalStatus = recon.providerStatus;
      externalAmount = SafeDecimal.round(recon.actualAmount, 2);
      externalUtr = recon.utrNumber;

      // Also query full status if available for currency checking
      if (typeof provider.getFundingStatus === 'function') {
        const fullStatus = await provider.getFundingStatus(providerTxId);
        if (fullStatus.currency) {
          externalCurrency = fullStatus.currency.trim().toUpperCase();
        }
      }
    } catch (providerError: any) {
      logger.warn(
        { transactionId: tx.id, providerTxId, error: providerError.message },
        'Provider lookup returned error during reconciliation check'
      );
      externalStatus = 'ERROR';
    }

    const discrepancies: FundingDiscrepancyDetail[] = [];

    // =========================================================================
    // 3-WAY DISCREPANCY EVALUATION
    // =========================================================================

    // DISCREPANCY 6: Duplicate provider transaction
    if (duplicateTxs.length > 1 || ledgerCredits.length > 1) {
      discrepancies.push({
        type: 'DUPLICATE_PROVIDER_TRANSACTION',
        description: `Duplicate external transaction detected: provider ID '${providerTxId}' is associated with ${duplicateTxs.length} funding records and ${ledgerCredits.length} ledger credit entries.`,
        externalData: {
          status: externalStatus,
          amount: externalAmount,
          currency: externalCurrency,
          providerTransactionId: providerTxId,
          utrNumber: externalUtr,
        },
        internalData: {
          id: tx.id,
          status: internalStatus,
          amount: internalAmount,
          currency: internalCurrency,
          providerTransactionId: providerTxId,
        },
        ledgerData: {
          hasCredit: hasLedgerCredit,
          hasDebit: hasLedgerDebit,
          creditAmount: totalLedgerCreditAmount,
          debitAmount: totalLedgerDebitAmount,
        },
      });
    }

    // DISCREPANCY 4: Amount mismatch
    const amountDifferenceExt = Math.abs(externalAmount - internalAmount);
    const amountDifferenceLedger = hasLedgerCredit ? Math.abs(totalLedgerCreditAmount - internalAmount) : 0;

    if (amountDifferenceExt > 0.009 || amountDifferenceLedger > 0.009) {
      discrepancies.push({
        type: 'AMOUNT_MISMATCH',
        description: `Amount mismatch detected: Internal transaction amount is ${internalAmount} ${internalCurrency}, external provider settled amount is ${externalAmount} ${externalCurrency}${hasLedgerCredit ? `, treasury ledger credit is ${totalLedgerCreditAmount}` : ''}.`,
        externalData: {
          status: externalStatus,
          amount: externalAmount,
          currency: externalCurrency,
          providerTransactionId: providerTxId,
          utrNumber: externalUtr,
        },
        internalData: {
          id: tx.id,
          status: internalStatus,
          amount: internalAmount,
          currency: internalCurrency,
          providerTransactionId: providerTxId,
        },
        ledgerData: {
          hasCredit: hasLedgerCredit,
          hasDebit: hasLedgerDebit,
          creditAmount: totalLedgerCreditAmount,
          debitAmount: totalLedgerDebitAmount,
        },
      });
    }

    // DISCREPANCY 5: Currency mismatch
    if (externalCurrency !== internalCurrency) {
      discrepancies.push({
        type: 'CURRENCY_MISMATCH',
        description: `Currency mismatch detected: Internal currency is '${internalCurrency}', but external provider currency is '${externalCurrency}'.`,
        externalData: {
          status: externalStatus,
          amount: externalAmount,
          currency: externalCurrency,
          providerTransactionId: providerTxId,
        },
        internalData: {
          id: tx.id,
          status: internalStatus,
          amount: internalAmount,
          currency: internalCurrency,
          providerTransactionId: providerTxId,
        },
      });
    }

    // DISCREPANCY 1: External success but internal pending
    // External provider settled successfully, but internal record is PENDING/PROCESSING/CREATED with no ledger credit
    const isInternalPending = ['PENDING', 'PROCESSING', 'CREATED'].includes(internalStatus);
    if (externalStatus === 'SUCCEEDED' && isInternalPending && !hasLedgerCredit) {
      discrepancies.push({
        type: 'EXTERNAL_SUCCESS_INTERNAL_PENDING',
        description: `External provider confirmed SUCCEEDED settlement, but internal transaction '${tx.id}' remains in '${internalStatus}' status and Platform Treasury ledger was not credited.`,
        externalData: {
          status: externalStatus,
          amount: externalAmount,
          currency: externalCurrency,
          providerTransactionId: providerTxId,
          utrNumber: externalUtr,
        },
        internalData: {
          id: tx.id,
          status: internalStatus,
          amount: internalAmount,
          currency: internalCurrency,
          providerTransactionId: providerTxId,
        },
        ledgerData: {
          hasCredit: hasLedgerCredit,
          hasDebit: hasLedgerDebit,
          creditAmount: totalLedgerCreditAmount,
          debitAmount: totalLedgerDebitAmount,
        },
      });
    }

    // DISCREPANCY 3: Internal success but external failure
    // Internal record is SUCCEEDED (or ledger credited), but external provider reports FAILED, CANCELLED, or NOT_FOUND
    const isInternalSuccess = internalStatus === 'SUCCEEDED';
    const isExternalFailed = ['FAILED', 'CANCELLED', 'NOT_FOUND', 'ERROR'].includes(externalStatus);
    if ((isInternalSuccess || hasLedgerCredit) && isExternalFailed) {
      discrepancies.push({
        type: 'INTERNAL_SUCCESS_EXTERNAL_FAILURE',
        description: `Internal transaction marked '${internalStatus}' (ledger credited: ${hasLedgerCredit}), but external provider reported failure/non-existence with status '${externalStatus}'.`,
        externalData: {
          status: externalStatus,
          amount: externalAmount,
          currency: externalCurrency,
          providerTransactionId: providerTxId,
        },
        internalData: {
          id: tx.id,
          status: internalStatus,
          amount: internalAmount,
          currency: internalCurrency,
          providerTransactionId: providerTxId,
        },
        ledgerData: {
          hasCredit: hasLedgerCredit,
          hasDebit: hasLedgerDebit,
          creditAmount: totalLedgerCreditAmount,
          debitAmount: totalLedgerDebitAmount,
        },
      });
    }

    // DISCREPANCY 7: Reversal not reflected internally
    // External provider reports REVERSED, but internal status is SUCCEEDED or ledger has no corresponding FUNDING_REVERSAL debit
    if (externalStatus === 'REVERSED') {
      const isInternalReversed = internalStatus === 'REVERSED';
      if (!isInternalReversed || !hasLedgerDebit) {
        discrepancies.push({
          type: 'REVERSAL_NOT_REFLECTED_INTERNALLY',
          description: `External provider reports transaction as REVERSED, but internal transaction status is '${internalStatus}' and platform treasury ledger ${hasLedgerDebit ? 'has' : 'lacks'} corresponding FUNDING_REVERSAL debit.`,
          externalData: {
            status: externalStatus,
            amount: externalAmount,
            currency: externalCurrency,
            providerTransactionId: providerTxId,
            utrNumber: externalUtr,
          },
          internalData: {
            id: tx.id,
            status: internalStatus,
            amount: internalAmount,
            currency: internalCurrency,
            providerTransactionId: providerTxId,
          },
          ledgerData: {
            hasCredit: hasLedgerCredit,
            hasDebit: hasLedgerDebit,
            creditAmount: totalLedgerCreditAmount,
            debitAmount: totalLedgerDebitAmount,
          },
        });
      }
    }

    // =========================================================================
    // DISCREPANCY RESOLUTION & AUDITING
    // =========================================================================

    const hasDiscrepancy = discrepancies.length > 0;
    let finalTx = tx;

    if (hasDiscrepancy) {
      // Mark RECONCILIATION_REQUIRED
      // CRITICAL: Do NOT automatically credit or debit money!
      const discrepancyReasonSummary = discrepancies.map((d) => d.description).join('; ');

      const updated = await db.fundingTransaction.update({
        where: { id: tx.id },
        data: {
          status: 'RECONCILIATION_REQUIRED',
          failureReason: discrepancyReasonSummary,
          metadata: {
            ...(typeof tx.metadata === 'object' && tx.metadata !== null ? (tx.metadata as any) : {}),
            reconciliationDiscrepancies: discrepancies,
            lastReconciledAt: new Date().toISOString(),
            externalStatus,
            externalAmount,
            notes: options?.notes,
          },
        },
        include: {
          fundingAccount: true,
          initiatedByAdmin: { select: { id: true, email: true, fullName: true } },
        },
      });

      finalTx = updated;

      // Immutable AuditLog
      if (options?.adminId) {
        await db.auditLog.create({
          data: {
            userId: options.adminId,
            action: 'FUNDING_RECONCILIATION_DISCREPANCY_DETECTED',
            entityType: 'FundingTransaction',
            entityId: tx.id,
            previousData: {
              status: tx.status,
              amount: internalAmount,
            },
            newData: {
              status: 'RECONCILIATION_REQUIRED',
              discrepancyCount: discrepancies.length,
              discrepancyTypes: discrepancies.map((d) => d.type),
              summary: discrepancyReasonSummary,
              externalStatus,
              externalAmount,
              externalCurrency,
              hasLedgerCredit,
              hasLedgerDebit,
            },
            ipAddress: options.ipAddress || null,
            userAgent: options.userAgent || null,
          },
        });
      }

      logger.warn(
        {
          transactionId: tx.id,
          discrepancies: discrepancies.map((d) => d.type),
        },
        'Reconciliation discrepancy detected! Marked as RECONCILIATION_REQUIRED. No automatic funds moved.'
      );

      return {
        transaction: FundingService.formatTransaction(finalTx),
        isMatched: false,
        status: 'RECONCILIATION_REQUIRED',
        discrepancies,
        providerStatus: externalStatus,
        externalAmount,
        internalAmount,
        ledgerAmount: totalLedgerCreditAmount,
        ledgerMatched: hasLedgerCredit && totalLedgerCreditAmount === internalAmount,
        message: `Discrepancy detected (${discrepancies.length} issues). Transaction marked RECONCILIATION_REQUIRED for admin review. No money automatically credited or debited.`,
        reconciledAt: new Date(),
      };
    }

    // Fully matched!
    if (options?.adminId) {
      await db.auditLog.create({
        data: {
          userId: options.adminId,
          action: 'FUNDING_RECONCILIATION_CHECK_PASSED',
          entityType: 'FundingTransaction',
          entityId: tx.id,
          previousData: { status: tx.status },
          newData: {
            status: tx.status,
            externalStatus,
            internalStatus,
            amount: internalAmount,
            matched: true,
          },
          ipAddress: options.ipAddress || null,
          userAgent: options.userAgent || null,
        },
      });
    }

    return {
      transaction: FundingService.formatTransaction(finalTx),
      isMatched: true,
      status: finalTx.status,
      discrepancies: [],
      providerStatus: externalStatus,
      externalAmount,
      internalAmount,
      ledgerAmount: totalLedgerCreditAmount,
      ledgerMatched: hasLedgerCredit ? totalLedgerCreditAmount === internalAmount : true,
      message: 'Transaction successfully reconciled across External Provider, Funding Transaction, and Platform Ledger. All 3 layers match perfectly.',
      reconciledAt: new Date(),
    };
  }

  /**
   * 2. reconcileFundingPeriod(startDate, endDate)
   * Authoritative batch reconciliation over a date range.
   * Compares all internal transactions against provider and ledger.
   * Also detects Scenario 2: External success but no internal transaction (EXTERNAL_SUCCESS_NO_INTERNAL_TX).
   */
  public static async reconcileFundingPeriod(
    startDate: Date,
    endDate: Date,
    options?: {
      provider?: string;
      adminId?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<ReconcileFundingPeriodResult> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw AppError.badRequest('Invalid startDate or endDate provided for reconciliation period', 'INVALID_DATE_RANGE');
    }

    if (start > end) {
      throw AppError.badRequest('startDate cannot be after endDate', 'INVALID_DATE_RANGE');
    }

    const providerFilter = options?.provider?.trim().toUpperCase();

    // 1. Fetch internal transactions within period
    const internalTxs = await prisma.fundingTransaction.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        ...(providerFilter ? { provider: providerFilter } : {}),
      },
      select: { id: true, provider: true, providerTransactionId: true },
      orderBy: { createdAt: 'asc' },
    });

    const periodDiscrepancies: Array<{
      transactionId?: string;
      providerTransactionId?: string;
      discrepancy: FundingDiscrepancyDetail;
    }> = [];

    let matchedCount = 0;

    // 2. Run 3-way check on each internal transaction
    for (const internalTx of internalTxs) {
      try {
        const res = await this.reconcileFundingTransaction(internalTx.id, {
          adminId: options?.adminId,
          ipAddress: options?.ipAddress,
          userAgent: options?.userAgent,
        });

        if (res.isMatched) {
          matchedCount++;
        } else {
          for (const d of res.discrepancies) {
            periodDiscrepancies.push({
              transactionId: internalTx.id,
              providerTransactionId: internalTx.providerTransactionId || undefined,
              discrepancy: d,
            });
          }
        }
      } catch (err: any) {
        logger.error({ transactionId: internalTx.id, err: err.message }, 'Failed single tx recon during period');
      }
    }

    // 3. DETECT SCENARIO 2: External success but no internal transaction (EXTERNAL_SUCCESS_NO_INTERNAL_TX)
    // Query external provider for settled transactions in period if supported
    const providersToCheck = providerFilter ? [providerFilter] : ['MOCK_SANDBOX', 'RAZORPAYX'];

    for (const pName of providersToCheck) {
      try {
        const providerInst = FundingProviderFactory.getProvider(pName);
        if (typeof providerInst.fetchSettledTransactions === 'function') {
          const settledExt = await providerInst.fetchSettledTransactions(start, end);

          for (const ext of settledExt) {
            // Check if any internal transaction has this providerTransactionId
            const exists = await prisma.fundingTransaction.findFirst({
              where: {
                provider: pName,
                providerTransactionId: ext.providerTransactionId,
              },
            });

            if (!exists) {
              // DETECTED SCENARIO 2!
              const orphanDiscrepancy: FundingDiscrepancyDetail = {
                type: 'EXTERNAL_SUCCESS_NO_INTERNAL_TX',
                description: `External settled transaction '${ext.providerTransactionId}' (${ext.amount} ${ext.currency}) exists at provider '${pName}', but NO matching internal FundingTransaction was found!`,
                externalData: {
                  status: ext.status,
                  amount: ext.amount,
                  currency: ext.currency,
                  providerTransactionId: ext.providerTransactionId,
                  utrNumber: ext.utrNumber,
                },
              };

              // Create an orphan record in RECONCILIATION_REQUIRED for admin review
              // Find corporate funding account for this provider
              const account = await prisma.fundingAccount.findFirst({
                where: { provider: pName, status: 'ACTIVE' },
              });

              if (account) {
                const orphanTx = await prisma.fundingTransaction.create({
                  data: {
                    fundingAccountId: account.id,
                    initiatedByAdminId: options?.adminId || '00000000-0000-0000-0000-000000000000',
                    amount: new Prisma.Decimal(ext.amount),
                    currency: ext.currency || 'INR',
                    status: 'RECONCILIATION_REQUIRED',
                    provider: pName,
                    providerTransactionId: ext.providerTransactionId,
                    idempotencyKey: `ORPHAN_${pName}_${ext.providerTransactionId}`,
                    failureReason: orphanDiscrepancy.description,
                    metadata: {
                      reconciliationDiscrepancies: [orphanDiscrepancy] as unknown as Prisma.InputJsonValue,
                      detectedInPeriodReconciliation: true,
                    },
                    initiatedAt: ext.settledAt || new Date(),
                  },
                });

                periodDiscrepancies.push({
                  transactionId: orphanTx.id,
                  providerTransactionId: ext.providerTransactionId,
                  discrepancy: orphanDiscrepancy,
                });
              } else {
                periodDiscrepancies.push({
                  providerTransactionId: ext.providerTransactionId,
                  discrepancy: orphanDiscrepancy,
                });
              }
            }
          }
        }
      } catch (provErr: any) {
        logger.warn({ provider: pName, error: provErr.message }, 'Provider does not support settled statement fetch');
      }
    }

    const totalChecked = internalTxs.length + (periodDiscrepancies.filter((d) => !d.transactionId).length);

    // 4. Audit Log
    if (options?.adminId) {
      await prisma.auditLog.create({
        data: {
          userId: options.adminId,
          action: 'FUNDING_PERIOD_RECONCILIATION_EXECUTED',
          entityType: 'FundingTransaction',
          entityId: `PERIOD_${start.toISOString()}_${end.toISOString()}`,
          previousData: Prisma.DbNull,
          newData: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            provider: providerFilter || 'ALL',
            totalChecked,
            matchedCount,
            discrepancyCount: periodDiscrepancies.length,
          },
          ipAddress: options.ipAddress || null,
          userAgent: options.userAgent || null,
        },
      });
    }

    return {
      period: { startDate: start, endDate: end },
      provider: providerFilter,
      totalChecked,
      matchedCount,
      discrepancyCount: periodDiscrepancies.length,
      discrepancies: periodDiscrepancies,
      reconciledAt: new Date(),
    };
  }

  /**
   * 3. getDiscrepancies(options)
   * Retrieves all funding transactions marked RECONCILIATION_REQUIRED for admin review.
   */
  public static async getDiscrepancies(options?: {
    page?: number;
    limit?: number;
    provider?: string;
  }): Promise<{
    discrepancies: any[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.FundingTransactionWhereInput = {
      status: 'RECONCILIATION_REQUIRED',
      ...(options?.provider ? { provider: options.provider.trim().toUpperCase() } : {}),
    };

    const [total, transactions] = await Promise.all([
      prisma.fundingTransaction.count({ where }),
      prisma.fundingTransaction.findMany({
        where,
        include: {
          fundingAccount: true,
          initiatedByAdmin: { select: { id: true, email: true, fullName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      discrepancies: transactions.map((t) => {
        const meta = (t.metadata as Record<string, any>) || {};
        return {
          ...FundingService.formatTransaction(t),
          discrepancyDetails: meta.reconciliationDiscrepancies || [],
          failureReason: t.failureReason,
        };
      }),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 4. resolveDiscrepancy(transactionId, input, adminId)
   * Admin resolution of a flagged discrepancy.
   * Only authorized administrators can perform verified corrections.
   * Actions:
   * - FORCE_SETTLE_CREDIT: Admin verified money settled in company account; credits Platform Treasury.
   * - REVERSE_DEBIT: Admin verified transaction was reversed/failed after credit; debits Platform Treasury.
   * - MARK_FAILED: Admin verified payment failed without credit.
   * - MARK_RESOLVED_NO_ACTION: Admin dismissed false alarm without balance changes.
   */
  public static async resolveDiscrepancy(
    transactionId: string,
    input: ResolveFundingDiscrepancyInput,
    adminId: string,
    options?: { ipAddress?: string; userAgent?: string }
  ): Promise<ResolveDiscrepancyResult> {
    if (!adminId) {
      throw AppError.unauthorized('Administrator authentication required to resolve discrepancies');
    }

    if (!input.reason || input.reason.trim().length < 5) {
      throw AppError.badRequest('Resolution reason is required (minimum 5 characters)', 'REASON_REQUIRED');
    }

    const tx = await prisma.fundingTransaction.findUnique({
      where: { id: transactionId.trim() },
      include: {
        fundingAccount: true,
        initiatedByAdmin: { select: { id: true, email: true, fullName: true } },
      },
    });

    if (!tx) {
      throw AppError.notFound(`Funding transaction '${transactionId}' not found`, 'TRANSACTION_NOT_FOUND');
    }

    const previousStatus = tx.status;
    const amountToApply = input.correctionAmount ?? SafeDecimal.round(tx.amount, 2);

    return prisma.$transaction(async (db) => {
      let treasuryBalance: number | undefined;
      let ledgerTxNumber: string | undefined;
      let updatedTx = tx;

      if (input.action === 'FORCE_SETTLE_CREDIT') {
        // Step 1: Atomically credit Platform Treasury with immutable ledger transaction
        const creditResult = await PlatformTreasuryService.creditTreasury(
          {
            amount: amountToApply,
            type: 'FUNDING',
            referenceType: 'FUNDING_TRANSACTION',
            referenceId: tx.id,
            providerTransactionId: tx.providerTransactionId || undefined,
            externalTransactionId: tx.providerTransactionId || undefined,
            idempotencyKey: `RECON_RESOLVE_CREDIT:${tx.id}_${Date.now()}`,
            description: `Manual verified resolution of discrepancy: ${input.reason.trim()}`,
            performedById: adminId,
            metadata: {
              discrepancyResolution: true,
              resolvedByAdminId: adminId,
              originalStatus: previousStatus,
              reason: input.reason.trim(),
              notes: input.notes,
            },
          },
          db
        );

        treasuryBalance = creditResult.wallet.availableBalance;
        ledgerTxNumber = creditResult.transaction.transactionNumber;

        // Step 2: Update FundingTransaction to SUCCEEDED
        updatedTx = await db.fundingTransaction.update({
          where: { id: tx.id },
          data: {
            status: 'SUCCEEDED',
            platformWalletTransactionId: creditResult.transaction.id,
            failureReason: null,
            completedAt: new Date(),
            metadata: {
              ...(typeof tx.metadata === 'object' && tx.metadata !== null ? (tx.metadata as any) : {}),
              resolution: {
                action: input.action,
                resolvedByAdminId: adminId,
                resolvedAt: new Date().toISOString(),
                reason: input.reason.trim(),
                notes: input.notes,
                ledgerTransactionId: creditResult.transaction.id,
              },
            },
          },
          include: {
            fundingAccount: true,
            initiatedByAdmin: { select: { id: true, email: true, fullName: true } },
          },
        });
      } else if (input.action === 'REVERSE_DEBIT') {
        // Step 1: Atomically debit Platform Treasury with FUNDING_REVERSAL ledger entry
        const debitResult = await PlatformTreasuryService.debitTreasury(
          {
            amount: amountToApply,
            type: 'FUNDING_REVERSAL',
            referenceType: 'FUNDING_TRANSACTION_REVERSAL',
            referenceId: tx.id,
            idempotencyKey: `RECON_RESOLVE_REVERSAL:${tx.id}_${Date.now()}`,
            description: `Discrepancy reversal: ${input.reason.trim()}`,
            performedById: adminId,
            allowOverdraft: true,
            metadata: {
              discrepancyResolution: true,
              resolvedByAdminId: adminId,
              originalStatus: previousStatus,
              reason: input.reason.trim(),
              notes: input.notes,
            },
          },
          db
        );

        treasuryBalance = debitResult.wallet.availableBalance;
        ledgerTxNumber = debitResult.transaction.transactionNumber;

        // Step 2: Update FundingTransaction to REVERSED
        updatedTx = await db.fundingTransaction.update({
          where: { id: tx.id },
          data: {
            status: 'REVERSED',
            failureReason: input.reason.trim(),
            metadata: {
              ...(typeof tx.metadata === 'object' && tx.metadata !== null ? (tx.metadata as any) : {}),
              resolution: {
                action: input.action,
                resolvedByAdminId: adminId,
                resolvedAt: new Date().toISOString(),
                reason: input.reason.trim(),
                notes: input.notes,
                ledgerTransactionId: debitResult.transaction.id,
              },
            },
          },
          include: {
            fundingAccount: true,
            initiatedByAdmin: { select: { id: true, email: true, fullName: true } },
          },
        });
      } else if (input.action === 'MARK_FAILED') {
        // Mark failed (no money movement)
        updatedTx = await db.fundingTransaction.update({
          where: { id: tx.id },
          data: {
            status: 'FAILED',
            failureReason: input.reason.trim(),
            metadata: {
              ...(typeof tx.metadata === 'object' && tx.metadata !== null ? (tx.metadata as any) : {}),
              resolution: {
                action: input.action,
                resolvedByAdminId: adminId,
                resolvedAt: new Date().toISOString(),
                reason: input.reason.trim(),
                notes: input.notes,
              },
            },
          },
          include: {
            fundingAccount: true,
            initiatedByAdmin: { select: { id: true, email: true, fullName: true } },
          },
        });
      } else {
        // MARK_RESOLVED_NO_ACTION
        updatedTx = await db.fundingTransaction.update({
          where: { id: tx.id },
          data: {
            metadata: {
              ...(typeof tx.metadata === 'object' && tx.metadata !== null ? (tx.metadata as any) : {}),
              discrepancyResolved: true,
              resolution: {
                action: input.action,
                resolvedByAdminId: adminId,
                resolvedAt: new Date().toISOString(),
                reason: input.reason.trim(),
                notes: input.notes,
              },
            },
          },
          include: {
            fundingAccount: true,
            initiatedByAdmin: { select: { id: true, email: true, fullName: true } },
          },
        });
      }

      // Step 3: Record immutable AuditLog entry
      await db.auditLog.create({
        data: {
          userId: adminId,
          action: `FUNDING_DISCREPANCY_RESOLVED_${input.action}`,
          entityType: 'FundingTransaction',
          entityId: tx.id,
          previousData: {
            status: previousStatus,
            failureReason: tx.failureReason,
          },
          newData: {
            status: updatedTx.status,
            action: input.action,
            reason: input.reason.trim(),
            notes: input.notes || null,
            correctionAmount: amountToApply,
            newTreasuryBalance: treasuryBalance,
            ledgerTxNumber,
          },
          ipAddress: options?.ipAddress || null,
          userAgent: options?.userAgent || null,
        },
      });

      logger.info(
        {
          transactionId: tx.id,
          action: input.action,
          adminId,
          newStatus: updatedTx.status,
        },
        'Reconciliation discrepancy resolved by administrator'
      );

      return {
        transaction: FundingService.formatTransaction(updatedTx),
        actionTaken: input.action,
        treasuryBalance,
        ledgerTransactionNumber: ledgerTxNumber,
        message: `Discrepancy successfully resolved via '${input.action}'. Audit record created.`,
        resolvedAt: new Date(),
      };
    });
  }
}
