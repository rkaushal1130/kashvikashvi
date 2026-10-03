import { Prisma, WalletTransactionType } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import {
  AdminWalletAdjustmentInput,
  WalletTransactionQueryInput,
} from '../validators/wallet.validators';

export interface FormattedWallet {
  id: string;
  distributorId: string | null;
  availableBalance: number;
  pendingBalance: number;
  lifetimeEarned: number;
  lifetimePaid: number;
  currency: string;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormattedWalletTransaction {
  id: string;
  walletId: string;
  transactionNumber: string;
  type: WalletTransactionType;
  status: string;
  amount: number;
  feeAmount: number;
  netAmount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId: string | null;
  memberId?: string | null;
  commissionTransactionId?: string | null;
  orderId?: string | null;
  description: string;
  createdAt: Date;
}

export class WalletService {
  /**
   * Formats a raw Wallet model instance into consistent response DTO.
   */
  public static formatWallet(wallet: any): FormattedWallet {
    return {
      id: wallet.id,
      distributorId: wallet.distributorId ?? null,
      availableBalance: Number(Number(wallet.availableBalance ?? wallet.balance ?? 0).toFixed(2)),
      pendingBalance: Number(Number(wallet.pendingBalance ?? 0).toFixed(2)),
      lifetimeEarned: Number(Number(wallet.lifetimeEarned ?? wallet.totalEarned ?? 0).toFixed(2)),
      lifetimePaid: Number(Number(wallet.lifetimePaid ?? wallet.totalWithdrawn ?? 0).toFixed(2)),
      currency: wallet.currency ?? 'USD',
      isLocked: Boolean(wallet.isLocked),
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  /**
   * Formats a raw WalletTransaction instance into consistent response DTO.
   */
  public static formatTransaction(tx: any): FormattedWalletTransaction {
    return {
      id: tx.id,
      walletId: tx.walletId,
      transactionNumber: tx.transactionNumber,
      type: tx.type,
      status: tx.status,
      amount: Number(Number(tx.amount).toFixed(2)),
      feeAmount: Number(Number(tx.feeAmount ?? 0).toFixed(2)),
      netAmount: Number(Number(tx.netAmount ?? tx.amount).toFixed(2)),
      balanceBefore: Number(Number(tx.balanceBefore).toFixed(2)),
      balanceAfter: Number(Number(tx.balanceAfter).toFixed(2)),
      referenceId: tx.referenceId ?? null,
      memberId: tx.memberId ?? null,
      commissionTransactionId: tx.commissionTransactionId ?? null,
      orderId: tx.orderId ?? null,
      description: tx.description,
      createdAt: tx.createdAt,
    };
  }

  /**
   * Retrieves or creates a wallet for a distributor / user.
   */
  public static async getOrCreateWallet(
    identifier: { distributorId?: string; userId?: string },
    client?: Prisma.TransactionClient
  ): Promise<FormattedWallet> {
    const db = client || prisma;
    const { distributorId, userId } = identifier;

    if (!distributorId && !userId) {
      throw AppError.badRequest(
        'Either distributorId or userId must be provided to resolve wallet.',
        'WALLET_IDENTIFIER_REQUIRED'
      );
    }

    // 1. Try finding by distributorId if provided
    if (distributorId) {
      let wallet = await db.wallet.findUnique({
        where: { distributorId },
      });

      if (wallet) {
        return this.formatWallet(wallet);
      }

      // If not found by distributorId, look up distributor profile to find userId
      const distributor = await db.distributorProfile.findUnique({
        where: { id: distributorId },
      });

      if (distributor) {
        // Check if wallet exists for the user
        let userWallet = await db.wallet.findUnique({
          where: { userId: distributor.userId },
        });

        if (userWallet) {
          // Link distributorId to the existing user wallet
          userWallet = await db.wallet.update({
            where: { id: userWallet.id },
            data: { distributorId: distributor.id },
          });
          return this.formatWallet(userWallet);
        }

        // Create new wallet with both distributorId and userId
        const created = await db.wallet.create({
          data: {
            distributorId: distributor.id,
            userId: distributor.userId,
            availableBalance: new Prisma.Decimal(0),
            balance: new Prisma.Decimal(0),
            pendingBalance: new Prisma.Decimal(0),
            lifetimeEarned: new Prisma.Decimal(0),
            totalEarned: new Prisma.Decimal(0),
            lifetimePaid: new Prisma.Decimal(0),
            totalWithdrawn: new Prisma.Decimal(0),
            currency: 'USD',
            isLocked: false,
          },
        });
        return this.formatWallet(created);
      }
    }

    // 2. If only userId is provided
    if (userId) {
      // Check if user has a distributor profile
      const distributor = await db.distributorProfile.findUnique({
        where: { userId },
      });

      let wallet = await db.wallet.findUnique({
        where: { userId },
      });

      if (wallet) {
        if (distributor && !wallet.distributorId) {
          wallet = await db.wallet.update({
            where: { id: wallet.id },
            data: { distributorId: distributor.id },
          });
        }
        return this.formatWallet(wallet);
      }

      const created = await db.wallet.create({
        data: {
          userId,
          distributorId: distributor ? distributor.id : null,
          availableBalance: new Prisma.Decimal(0),
          balance: new Prisma.Decimal(0),
          pendingBalance: new Prisma.Decimal(0),
          lifetimeEarned: new Prisma.Decimal(0),
          totalEarned: new Prisma.Decimal(0),
          lifetimePaid: new Prisma.Decimal(0),
          totalWithdrawn: new Prisma.Decimal(0),
          currency: 'USD',
          isLocked: false,
        },
      });
      return this.formatWallet(created);
    }

    throw AppError.notFound('Unable to locate or create wallet.', 'WALLET_NOT_FOUND');
  }

  /**
   * Retrieves authenticated user's distributor wallet.
   */
  public static async getWalletByUserId(userId: string): Promise<FormattedWallet> {
    const distributor = await prisma.distributorProfile.findUnique({
      where: { userId },
    });

    if (distributor) {
      return this.getOrCreateWallet({ distributorId: distributor.id, userId });
    }

    return this.getOrCreateWallet({ userId });
  }

  /**
   * Retrieves paginated wallet transactions for a distributor or user.
   */
  public static async getTransactions(
    identifier: { distributorId?: string; userId?: string },
    query: WalletTransactionQueryInput
  ): Promise<{
    transactions: FormattedWalletTransaction[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const wallet = await this.getOrCreateWallet(identifier);

    const whereClause: Prisma.WalletTransactionWhereInput = {
      walletId: wallet.id,
      ...(query.type ? { type: query.type as WalletTransactionType } : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate ? { gte: query.startDate } : {}),
              ...(query.endDate ? { lte: query.endDate } : {}),
            },
          }
        : {}),
    };

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [total, rawTransactions] = await Promise.all([
      prisma.walletTransaction.count({ where: whereClause }),
      prisma.walletTransaction.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const transactions = rawTransactions.map((tx) => this.formatTransaction(tx));

    return {
      transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Administrative adjustment of a distributor's wallet.
   * MUST create an immutable WalletTransaction and an AuditLog entry.
   * Frontend users are strictly barred from invoking this.
   */
  public static async adjustWalletBalance(
    adminUserId: string,
    input: AdminWalletAdjustmentInput,
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<{
    wallet: FormattedWallet;
    transaction: FormattedWalletTransaction;
    auditLogId: string;
  }> {
    return prisma.$transaction(async (tx) => {
      // 1. Verify distributor exists
      const distributor = await tx.distributorProfile.findUnique({
        where: { id: input.distributorId },
      });

      if (!distributor) {
        throw AppError.notFound(
          `Distributor not found with ID ${input.distributorId}`,
          'DISTRIBUTOR_NOT_FOUND'
        );
      }

      // 2. Fetch or initialize wallet
      let wallet = await tx.wallet.findUnique({
        where: { distributorId: distributor.id },
      });

      if (!wallet) {
        wallet = await tx.wallet.findUnique({
          where: { userId: distributor.userId },
        });

        if (wallet) {
          wallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: { distributorId: distributor.id },
          });
        } else {
          wallet = await tx.wallet.create({
            data: {
              distributorId: distributor.id,
              userId: distributor.userId,
              availableBalance: new Prisma.Decimal(0),
              balance: new Prisma.Decimal(0),
              pendingBalance: new Prisma.Decimal(0),
              lifetimeEarned: new Prisma.Decimal(0),
              totalEarned: new Prisma.Decimal(0),
              lifetimePaid: new Prisma.Decimal(0),
              totalWithdrawn: new Prisma.Decimal(0),
              currency: 'USD',
              isLocked: false,
            },
          });
        }
      }

      if (wallet.isLocked) {
        throw AppError.badRequest(
          'Wallet is locked and cannot be adjusted.',
          'WALLET_LOCKED'
        );
      }

      const balanceBefore = new Prisma.Decimal(wallet.availableBalance ?? wallet.balance ?? 0);
      const amount = new Prisma.Decimal(input.amount);
      let balanceAfter: Prisma.Decimal;
      let earnedDelta = new Prisma.Decimal(0);
      let paidDelta = new Prisma.Decimal(0);

      if (input.type === 'CREDIT' || input.type === 'ADJUSTMENT') {
        balanceAfter = balanceBefore.add(amount);
        earnedDelta = amount;
      } else if (input.type === 'DEBIT') {
        if (balanceBefore.lessThan(amount)) {
          throw AppError.badRequest(
            `Insufficient available wallet balance. Current: ${balanceBefore.toFixed(2)}, Debit requested: ${amount.toFixed(2)}`,
            'INSUFFICIENT_FUNDS'
          );
        }
        balanceAfter = balanceBefore.sub(amount);
        paidDelta = amount;
      } else {
        throw AppError.badRequest(`Unsupported adjustment type: ${input.type}`, 'INVALID_ADJUSTMENT_TYPE');
      }

      // 3. Create immutable WalletTransaction
      const transactionNumber = `WTX-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const walletTx = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          transactionNumber,
          type: input.type as WalletTransactionType,
          status: 'COMPLETED',
          amount,
          feeAmount: new Prisma.Decimal(0),
          netAmount: amount,
          balanceBefore,
          balanceAfter,
          referenceId: input.referenceId || null,
          description: `Admin adjustment: ${input.reason}`,
        },
      });

      // 4. Update wallet balances
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: balanceAfter,
          balance: balanceAfter,
          lifetimeEarned: { increment: earnedDelta },
          totalEarned: { increment: earnedDelta },
          lifetimePaid: { increment: paidDelta },
          totalWithdrawn: { increment: paidDelta },
        },
      });

      // 5. Create AuditLog entry
      const auditLog = await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'WALLET_ADMIN_ADJUSTMENT',
          entityType: 'Wallet',
          entityId: wallet.id,
          previousData: {
            availableBalance: balanceBefore.toNumber(),
            pendingBalance: Number(wallet.pendingBalance ?? 0),
            lifetimeEarned: Number(wallet.lifetimeEarned ?? wallet.totalEarned ?? 0),
            lifetimePaid: Number(wallet.lifetimePaid ?? wallet.totalWithdrawn ?? 0),
          },
          newData: {
            availableBalance: balanceAfter.toNumber(),
            amount: input.amount,
            type: input.type,
            reason: input.reason,
            referenceId: input.referenceId || null,
            transactionNumber: walletTx.transactionNumber,
            walletTransactionId: walletTx.id,
          },
          ipAddress: meta?.ipAddress || null,
          userAgent: meta?.userAgent || null,
        },
      });

      logger.info(
        {
          adminUserId,
          distributorId: distributor.id,
          walletId: wallet.id,
          type: input.type,
          amount: input.amount,
          balanceBefore: balanceBefore.toFixed(2),
          balanceAfter: balanceAfter.toFixed(2),
          auditLogId: auditLog.id,
        },
        'Admin wallet adjustment processed and audited successfully'
      );

      return {
        wallet: this.formatWallet(updatedWallet),
        transaction: this.formatTransaction(walletTx),
        auditLogId: auditLog.id,
      };
    });
  }

  /**
   * Payout Processing: transitions eligible commissions to PAID
   * and credits distributor wallets via an immutable COMMISSION WalletTransaction.
   * Adheres strictly to the architectural boundary:
   * "Create commission ledger first. Then wallet service processes eligible payable commissions."
   */
  public static async processPayableCommissions(
    options: {
      periodId?: string;
      commissionIds?: string[];
      distributorId?: string;
    },
    client?: Prisma.TransactionClient
  ): Promise<{
    paidCount: number;
    totalPaidAmount: number;
    commissionIds: string[];
  }> {
    const runner = async (tx: Prisma.TransactionClient) => {
      const { periodId, commissionIds, distributorId } = options;

      const whereClause: Prisma.CommissionWhereInput = {
        status: { in: ['CALCULATED', 'QUALIFIED', 'APPROVED'] },
        ...(periodId ? { periodId } : {}),
        ...(commissionIds ? { id: { in: commissionIds } } : {}),
        ...(distributorId ? { distributorId } : {}),
      };

      const eligibleCommissions = await tx.commission.findMany({
        where: whereClause,
        include: {
          distributor: {
            include: { user: true },
          },
        },
      });

      if (eligibleCommissions.length === 0) {
        return { paidCount: 0, totalPaidAmount: 0, commissionIds: [] };
      }

      let totalPaid = 0;
      const processedIds: string[] = [];

      for (const comm of eligibleCommissions) {
        const amountNum = Number(comm.amount);
        if (amountNum <= 0) continue;

        const userId = comm.distributor.userId;
        const distId = comm.distributor.id;

        // Find or create wallet
        let wallet = await tx.wallet.findFirst({
          where: {
            OR: [{ distributorId: distId }, { userId }],
          },
        });

        if (!wallet) {
          wallet = await tx.wallet.create({
            data: {
              userId,
              distributorId: distId,
              availableBalance: new Prisma.Decimal(0),
              balance: new Prisma.Decimal(0),
              pendingBalance: new Prisma.Decimal(0),
              lifetimeEarned: new Prisma.Decimal(0),
              totalEarned: new Prisma.Decimal(0),
              lifetimePaid: new Prisma.Decimal(0),
              totalWithdrawn: new Prisma.Decimal(0),
              currency: 'USD',
              isLocked: false,
            },
          });
        } else if (!wallet.distributorId) {
          wallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: { distributorId: distId },
          });
        }

        const balanceBefore = new Prisma.Decimal(wallet.availableBalance ?? wallet.balance ?? 0);
        const balanceAfter = balanceBefore.add(comm.amount);

        // Update wallet balances
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: balanceAfter,
            balance: balanceAfter,
            lifetimeEarned: { increment: comm.amount },
            totalEarned: { increment: comm.amount },
          },
        });

        // Create immutable COMMISSION WalletTransaction
        const txNumber = `WTX-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            transactionNumber: txNumber,
            type: 'COMMISSION',
            status: 'COMPLETED',
            amount: comm.amount,
            feeAmount: new Prisma.Decimal(0),
            netAmount: comm.amount,
            balanceBefore,
            balanceAfter,
            description: `${comm.type} Commission payout (${comm.commissionNumber})`,
            referenceId: comm.id,
          },
        });

        // Mark commission as PAID
        await tx.commission.update({
          where: { id: comm.id },
          data: {
            status: 'PAID',
            payoutDate: new Date(),
          },
        });

        totalPaid += amountNum;
        processedIds.push(comm.id);
      }

      logger.info(
        { count: processedIds.length, totalPaid },
        'Eligible commissions processed and credited to distributor wallets successfully by WalletService'
      );

      return {
        paidCount: processedIds.length,
        totalPaidAmount: Number(totalPaid.toFixed(2)),
        commissionIds: processedIds,
      };
    };

    if (client) {
      return runner(client);
    }
    return prisma.$transaction(runner);
  }
}
