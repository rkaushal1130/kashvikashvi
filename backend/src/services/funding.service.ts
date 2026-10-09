import { FundingAccountStatus, FundingTransactionStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { SafeDecimal } from '../utils/safeDecimal';
import {
  CreateFundingAccountInput,
  CreateFundingTransactionInput,
  FundingAccountDTO,
  FundingTransactionDTO,
  sanitizeFundingMetadata,
} from '../types/funding.types';
import { FundingProviderFactory } from '../providers/funding';

/**
 * ============================================================================
 * ADMIN FUNDING SERVICE (PROMPT 31)
 * ============================================================================
 *
 * Implements business operations for FundingAccount and FundingTransaction models.
 *
 * SECURITY INVARIANTS:
 * 1. Raw credentials (PIN, password, OTP, CVV) are never stored or logged.
 * 2. Provider token/account identifiers are used exclusively.
 * 3. Compound uniqueness on (provider, providerTransactionId) prevents duplicate external credits.
 * 4. IdempotencyKey uniqueness prevents concurrent race condition submissions.
 * 5. Metadata is sanitized prior to persistence and output.
 */
export class FundingService {
  /**
   * Formats raw FundingAccount into secure DTO.
   */
  public static formatAccount(account: any): FundingAccountDTO {
    return {
      id: account.id,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      accountType: account.accountType,
      accountName: account.accountName,
      maskedAccountNumber: account.maskedAccountNumber,
      currency: account.currency ?? 'INR',
      status: account.status,
      isPrimary: Boolean(account.isPrimary),
      metadata: sanitizeFundingMetadata(account.metadata as Record<string, any>),
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  /**
   * Formats raw FundingTransaction into secure DTO.
   */
  public static formatTransaction(tx: any): FundingTransactionDTO {
    return {
      id: tx.id,
      fundingAccountId: tx.fundingAccountId,
      initiatedByAdminId: tx.initiatedByAdminId,
      amount: SafeDecimal.round(tx.amount, 2),
      currency: tx.currency ?? 'INR',
      status: tx.status,
      provider: tx.provider,
      providerTransactionId: tx.providerTransactionId ?? null,
      idempotencyKey: tx.idempotencyKey,
      platformWalletTransactionId: tx.platformWalletTransactionId ?? null,
      failureReason: tx.failureReason ?? null,
      metadata: sanitizeFundingMetadata(tx.metadata as Record<string, any>),
      initiatedAt: tx.initiatedAt,
      completedAt: tx.completedAt ?? null,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
      fundingAccount: tx.fundingAccount ? this.formatAccount(tx.fundingAccount) : undefined,
      initiatedByAdmin: tx.initiatedByAdmin
        ? {
            id: tx.initiatedByAdmin.id,
            email: tx.initiatedByAdmin.email,
            fullName: tx.initiatedByAdmin.fullName ?? null,
          }
        : undefined,
    };
  }

  /**
   * Registers a verified funding account for the corporate entity.
   */
  public static async registerFundingAccount(
    input: CreateFundingAccountInput,
    adminIdOrTx?: string | Prisma.TransactionClient,
    options?: { ipAddress?: string; userAgent?: string },
    tx?: Prisma.TransactionClient
  ): Promise<FundingAccountDTO> {
    const isTx = typeof adminIdOrTx === 'object' && adminIdOrTx !== null;
    const db = (isTx ? (adminIdOrTx as Prisma.TransactionClient) : tx) || prisma;
    const adminId = typeof adminIdOrTx === 'string' ? adminIdOrTx : undefined;

    if (!input.provider?.trim()) {
      throw AppError.badRequest('provider is required', 'PROVIDER_REQUIRED');
    }
    if (!input.providerAccountId?.trim()) {
      throw AppError.badRequest('providerAccountId is required', 'PROVIDER_ACCOUNT_ID_REQUIRED');
    }
    if (!input.accountName?.trim()) {
      throw AppError.badRequest('accountName is required', 'ACCOUNT_NAME_REQUIRED');
    }
    if (!input.maskedAccountNumber?.trim()) {
      throw AppError.badRequest('maskedAccountNumber is required', 'MASKED_ACCOUNT_REQUIRED');
    }

    const provider = input.provider.trim().toUpperCase();
    const providerAccountId = input.providerAccountId.trim();

    // Check for existing account with same (provider, providerAccountId)
    const existing = await db.fundingAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
    });

    if (existing) {
      throw AppError.conflict(
        `Funding account with provider '${provider}' and account ID '${providerAccountId}' already exists.`,
        'DUPLICATE_FUNDING_ACCOUNT'
      );
    }

    const sanitizedMeta = sanitizeFundingMetadata(input.metadata);

    // If marked as primary, reset other accounts for this provider
    if (input.isPrimary) {
      await db.fundingAccount.updateMany({
        where: { provider, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const created = await db.fundingAccount.create({
      data: {
        provider,
        providerAccountId,
        accountType: input.accountType.trim().toUpperCase(),
        accountName: input.accountName.trim(),
        maskedAccountNumber: input.maskedAccountNumber.trim(),
        currency: (input.currency || 'INR').trim().toUpperCase(),
        status: 'ACTIVE',
        isPrimary: Boolean(input.isPrimary),
        metadata: sanitizedMeta ? (sanitizedMeta as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    if (adminId) {
      await db.auditLog.create({
        data: {
          userId: adminId,
          action: 'FUNDING_ACCOUNT_CONNECTED',
          entityType: 'FundingAccount',
          entityId: created.id,
          previousData: null,
          newData: {
            provider: created.provider,
            providerAccountId: created.providerAccountId,
            accountType: created.accountType,
            accountName: created.accountName,
            maskedAccountNumber: created.maskedAccountNumber,
            currency: created.currency,
            isPrimary: created.isPrimary,
          },
          ipAddress: options?.ipAddress || null,
          userAgent: options?.userAgent || null,
        },
      });
    }

    logger.info({ accountId: created.id, provider, providerAccountId, adminId }, 'Registered corporate funding account');

    return this.formatAccount(created);
  }

  /**
   * Retrieves a funding account by ID.
   */
  public static async getFundingAccountById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<FundingAccountDTO> {
    const db = tx || prisma;
    const account = await db.fundingAccount.findUnique({
      where: { id: id.trim() },
    });

    if (!account) {
      throw AppError.notFound(`Funding account '${id}' not found`, 'ACCOUNT_NOT_FOUND');
    }

    return this.formatAccount(account);
  }

  /**
   * Lists all corporate funding accounts with optional provider filter.
   */
  public static async listFundingAccounts(
    options?: { provider?: string; status?: FundingAccountStatus },
    tx?: Prisma.TransactionClient
  ): Promise<FundingAccountDTO[]> {
    const db = tx || prisma;
    const accounts = await db.fundingAccount.findMany({
      where: {
        ...(options?.provider ? { provider: options.provider.trim().toUpperCase() } : {}),
        ...(options?.status ? { status: options.status } : {}),
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });

    return accounts.map((a) => this.formatAccount(a));
  }

  /**
   * Retrieves the active primary corporate funding account.
   */
  public static async getPrimaryFundingAccount(
    tx?: Prisma.TransactionClient
  ): Promise<FundingAccountDTO | null> {
    const db = tx || prisma;
    const account =
      (await db.fundingAccount.findFirst({
        where: { status: 'ACTIVE', isPrimary: true },
      })) ||
      (await db.fundingAccount.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      }));

    return account ? this.formatAccount(account) : null;
  }

  /**
   * Disconnects / deactivates a corporate funding account link.
   */
  public static async disconnectFundingAccount(
    id: string,
    adminId: string,
    optionsOrTx?: { reason?: string; ipAddress?: string; userAgent?: string } | Prisma.TransactionClient,
    tx?: Prisma.TransactionClient
  ): Promise<FundingAccountDTO> {
    const isTx = optionsOrTx && ('$executeRaw' in (optionsOrTx as any) || '$queryRaw' in (optionsOrTx as any));
    const db = (isTx ? (optionsOrTx as Prisma.TransactionClient) : tx) || prisma;
    const options = isTx ? undefined : (optionsOrTx as { reason?: string; ipAddress?: string; userAgent?: string } | undefined);

    const account = await db.fundingAccount.findUnique({
      where: { id: id.trim() },
    });

    if (!account) {
      throw AppError.notFound(`Funding account '${id}' not found`, 'ACCOUNT_NOT_FOUND');
    }

    if (account.status === 'DISCONNECTED') {
      return this.formatAccount(account);
    }

    try {
      const provider = FundingProviderFactory.getProvider(account.provider);
      await provider.disconnectAccount(account.providerAccountId);
    } catch (providerError: any) {
      logger.warn(
        { accountId: account.id, error: providerError.message },
        'Provider disconnect notification failed or not implemented; proceeding with internal deactivation'
      );
    }

    const updated = await db.fundingAccount.update({
      where: { id: account.id },
      data: {
        status: 'DISCONNECTED',
        isPrimary: false,
      },
    });

    await db.auditLog.create({
      data: {
        userId: adminId,
        action: 'FUNDING_ACCOUNT_DISCONNECTED',
        entityType: 'FundingAccount',
        entityId: account.id,
        previousData: {
          status: account.status,
          isPrimary: account.isPrimary,
        },
        newData: {
          status: 'DISCONNECTED',
          isPrimary: false,
          reason: options?.reason || 'Administrative disconnect',
        },
        ipAddress: options?.ipAddress || null,
        userAgent: options?.userAgent || null,
      },
    });

    logger.info({ accountId: account.id, adminId }, 'Corporate funding account disconnected');
    return this.formatAccount(updated);
  }

  /**
   * Queries real-time status of connected corporate account from provider.
   */
  public static async getFundingAccountStatus(id: string): Promise<{
    account: FundingAccountDTO;
    providerStatus: any;
  }> {
    const account = await prisma.fundingAccount.findUnique({
      where: { id: id.trim() },
    });

    if (!account) {
      throw AppError.notFound(`Funding account '${id}' not found`, 'ACCOUNT_NOT_FOUND');
    }

    const provider = FundingProviderFactory.getProvider(account.provider);
    const providerStatus = await provider.getAccountStatus(account.providerAccountId);

    return {
      account: this.formatAccount(account),
      providerStatus,
    };
  }

  /**
   * Initiates an audit-tracked funding transaction.
   * Enforces idempotencyKey uniqueness and provider + providerTransactionId uniqueness.
   */
  public static async initiateFundingTransaction(
    input: CreateFundingTransactionInput,
    tx?: Prisma.TransactionClient
  ): Promise<FundingTransactionDTO> {
    const db = tx || prisma;

    const amountDecimal = SafeDecimal.roundDecimal(input.amount, 2);
    if (amountDecimal.lessThanOrEqualTo(0)) {
      throw AppError.badRequest('Funding amount must be greater than zero', 'INVALID_AMOUNT');
    }

    if (!input.idempotencyKey?.trim()) {
      throw AppError.badRequest('idempotencyKey is required for funding transaction', 'IDEMPOTENCY_KEY_REQUIRED');
    }

    const idempotencyKey = input.idempotencyKey.trim();
    const provider = input.provider.trim().toUpperCase();
    const providerTxId = input.providerTransactionId?.trim() || null;

    // Verify funding account exists and is ACTIVE
    const account = await db.fundingAccount.findUnique({
      where: { id: input.fundingAccountId.trim() },
    });

    if (!account) {
      throw AppError.notFound(`Funding account '${input.fundingAccountId}' not found`, 'ACCOUNT_NOT_FOUND');
    }

    if (account.status !== 'ACTIVE') {
      throw AppError.badRequest(
        `Funding account is not ACTIVE (current status: ${account.status})`,
        'ACCOUNT_NOT_ACTIVE'
      );
    }

    // 1. Enforce idempotencyKey uniqueness check
    const existingByIdempotency = await db.fundingTransaction.findUnique({
      where: { idempotencyKey },
    });

    if (existingByIdempotency) {
      throw AppError.conflict(
        `Funding transaction with idempotencyKey '${idempotencyKey}' already exists`,
        'DUPLICATE_IDEMPOTENCY_KEY'
      );
    }

    // 2. Enforce provider + providerTransactionId uniqueness check
    if (providerTxId) {
      const existingByProvider = await db.fundingTransaction.findUnique({
        where: {
          provider_providerTransactionId: {
            provider,
            providerTransactionId: providerTxId,
          },
        },
      });

      if (existingByProvider) {
        throw AppError.conflict(
          `External transaction '${providerTxId}' from provider '${provider}' has already been processed (ID: ${existingByProvider.id})`,
          'DUPLICATE_PROVIDER_TRANSACTION'
        );
      }
    }

    const sanitizedMeta = sanitizeFundingMetadata(input.metadata);

    const created = await db.fundingTransaction.create({
      data: {
        fundingAccountId: account.id,
        initiatedByAdminId: input.initiatedByAdminId.trim(),
        amount: amountDecimal,
        currency: (input.currency || account.currency || 'INR').trim().toUpperCase(),
        status: 'CREATED',
        provider,
        providerTransactionId: providerTxId,
        idempotencyKey,
        metadata: sanitizedMeta ? (sanitizedMeta as Prisma.InputJsonValue) : Prisma.JsonNull,
        initiatedAt: new Date(),
      },
      include: {
        fundingAccount: true,
        initiatedByAdmin: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    logger.info(
      { transactionId: created.id, amount: amountDecimal.toFixed(2), provider, idempotencyKey },
      'Initiated corporate funding transaction'
    );

    return this.formatTransaction(created);
  }

  /**
   * Retrieves a funding transaction by ID.
   */
  public static async getFundingTransactionById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<FundingTransactionDTO> {
    const db = tx || prisma;
    const transaction = await db.fundingTransaction.findUnique({
      where: { id: id.trim() },
      include: {
        fundingAccount: true,
        initiatedByAdmin: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    if (!transaction) {
      throw AppError.notFound(`Funding transaction '${id}' not found`, 'TRANSACTION_NOT_FOUND');
    }

    return this.formatTransaction(transaction);
  }
}
