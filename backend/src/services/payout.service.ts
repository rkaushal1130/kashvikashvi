import { PayoutStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { maskAccountNumber, maskIfsc } from '../utils/masking';
import {
  CreatePayoutRequestInput,
  MarkPaidPayoutInput,
  PayoutQueryInput,
  RejectPayoutInput,
} from '../validators/payout.validators';

export interface FormattedPayout {
  id: string;
  payoutNumber: string;
  distributorId: string;
  amount: number;
  fee: number;
  netAmount: number;
  bankAccountId: string;
  status: PayoutStatus;
  requestedAt: Date;
  processedAt: Date | null;
  failureReason: string | null;
  adminNotes: string | null;
  referenceNumber: string | null;
  bankAccount: {
    id: string;
    bankName: string;
    accountHolderName: string;
    accountNumber: string;
    routingNumber: string;
    branchName: string | null;
    status: string;
  } | null;
  distributor?: {
    id: string;
    distributorCode: string;
    displayName: string;
    email?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class PayoutService {
  /**
   * Formats a raw PayoutRequest ensuring bank details are always masked for standard responses.
   */
  public static formatPayout(payout: any): FormattedPayout {
    return {
      id: payout.id,
      payoutNumber: payout.payoutNumber,
      distributorId: payout.distributorId,
      amount: Number(Number(payout.amount).toFixed(2)),
      fee: Number(Number(payout.fee ?? 0).toFixed(2)),
      netAmount: Number(Number(payout.netAmount ?? payout.amount).toFixed(2)),
      bankAccountId: payout.bankAccountId,
      status: payout.status,
      requestedAt: payout.requestedAt ?? payout.createdAt,
      processedAt: payout.processedAt ?? null,
      failureReason: payout.failureReason ?? null,
      adminNotes: payout.adminNotes ?? null,
      referenceNumber: payout.referenceNumber ?? null,
      bankAccount: payout.bankAccount
        ? {
            id: payout.bankAccount.id,
            bankName: payout.bankAccount.bankName,
            accountHolderName: payout.bankAccount.accountHolderName,
            accountNumber: maskAccountNumber(payout.bankAccount.accountNumber),
            routingNumber: maskIfsc(payout.bankAccount.routingNumber),
            branchName: payout.bankAccount.branchName ?? null,
            status: payout.bankAccount.status,
          }
        : null,
      distributor: payout.distributor
        ? {
            id: payout.distributor.id,
            distributorCode: payout.distributor.distributorCode,
            displayName: payout.distributor.displayName,
            email: payout.distributor.user?.email,
          }
        : undefined,
      createdAt: payout.createdAt,
      updatedAt: payout.updatedAt,
    };
  }

  /**
   * Submits a new payout request for the authenticated distributor.
   * Holds the requested funds in pending balance to prevent double-spending.
   */
  public static async requestPayout(
    userId: string,
    input: CreatePayoutRequestInput
  ): Promise<FormattedPayout> {
    return prisma.$transaction(async (tx) => {
      // 1. Verify distributor profile exists
      const distributor = await tx.distributorProfile.findUnique({
        where: { userId },
      });

      if (!distributor) {
        throw AppError.notFound('Distributor profile not found for user.', 'DISTRIBUTOR_NOT_FOUND');
      }

      // 2. Verify bank account exists and belongs to distributor
      const bankAccount = await tx.bankAccount.findFirst({
        where: {
          id: input.bankAccountId,
          distributorId: distributor.id,
          deletedAt: null,
        },
      });

      if (!bankAccount) {
        throw AppError.notFound(
          'Bank account not found or does not belong to your profile.',
          'BANK_ACCOUNT_NOT_FOUND'
        );
      }

      // 3. Resolve wallet and check available balance
      let wallet = await tx.wallet.findUnique({
        where: { distributorId: distributor.id },
      });

      if (!wallet) {
        wallet = await tx.wallet.findUnique({
          where: { userId },
        });

        if (wallet) {
          wallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: { distributorId: distributor.id },
          });
        }
      }

      if (!wallet) {
        throw AppError.badRequest('Distributor wallet not found.', 'WALLET_NOT_FOUND');
      }

      if (wallet.isLocked) {
        throw AppError.badRequest(
          'Your wallet is locked. Payout requests are temporarily suspended.',
          'WALLET_LOCKED'
        );
      }

      const availableBalance = new Prisma.Decimal(wallet.availableBalance ?? wallet.balance ?? 0);
      const amount = new Prisma.Decimal(input.amount);

      if (availableBalance.lessThan(amount)) {
        throw AppError.badRequest(
          `Insufficient available balance for payout. Available: ${availableBalance.toFixed(2)}, Requested: ${amount.toFixed(2)}`,
          'INSUFFICIENT_FUNDS'
        );
      }

      // 4. Reserve requested funds: move from availableBalance to pendingBalance
      const balanceAfter = availableBalance.sub(amount);
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: balanceAfter,
          balance: balanceAfter,
          pendingBalance: { increment: amount },
        },
      });

      // 5. Create PayoutRequest
      const payoutNumber = `POR-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const payout = await tx.payoutRequest.create({
        data: {
          payoutNumber,
          distributorId: distributor.id,
          bankAccountId: bankAccount.id,
          amount,
          fee: new Prisma.Decimal(0),
          netAmount: amount,
          status: 'REQUESTED',
          requestedAt: new Date(),
          adminNotes: input.notes || null,
        },
        include: {
          bankAccount: true,
          distributor: {
            include: { user: true },
          },
        },
      });

      logger.info(
        {
          distributorId: distributor.id,
          payoutNumber,
          amount: amount.toFixed(2),
          bankAccountId: bankAccount.id,
        },
        'Payout request created successfully with funds placed on pending hold'
      );

      return this.formatPayout(payout);
    });
  }

  /**
   * Retrieves paginated payout requests for the authenticated distributor.
   */
  public static async getDistributorPayouts(
    userId: string,
    query: PayoutQueryInput
  ): Promise<{
    payouts: FormattedPayout[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const distributor = await prisma.distributorProfile.findUnique({
      where: { userId },
    });

    if (!distributor) {
      return {
        payouts: [],
        pagination: { total: 0, page: 1, limit: query.limit || 20, totalPages: 1 },
      };
    }

    const whereClause: Prisma.PayoutRequestWhereInput = {
      distributorId: distributor.id,
      ...(query.status ? { status: query.status as PayoutStatus } : {}),
      ...(query.startDate || query.endDate
        ? {
            requestedAt: {
              ...(query.startDate ? { gte: query.startDate } : {}),
              ...(query.endDate ? { lte: query.endDate } : {}),
            },
          }
        : {}),
    };

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [total, rawPayouts] = await Promise.all([
      prisma.payoutRequest.count({ where: whereClause }),
      prisma.payoutRequest.findMany({
        where: whereClause,
        include: {
          bankAccount: true,
          distributor: {
            include: { user: true },
          },
        },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      payouts: rawPayouts.map((p) => this.formatPayout(p)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves single payout request details for authenticated distributor.
   */
  public static async getDistributorPayoutById(
    userId: string,
    payoutId: string
  ): Promise<FormattedPayout> {
    const distributor = await prisma.distributorProfile.findUnique({
      where: { userId },
    });

    if (!distributor) {
      throw AppError.notFound('Distributor profile not found.', 'DISTRIBUTOR_NOT_FOUND');
    }

    const payout = await prisma.payoutRequest.findFirst({
      where: {
        id: payoutId,
        distributorId: distributor.id,
      },
      include: {
        bankAccount: true,
        distributor: {
          include: { user: true },
        },
      },
    });

    if (!payout) {
      throw AppError.notFound('Payout request not found.', 'PAYOUT_NOT_FOUND');
    }

    return this.formatPayout(payout);
  }

  /**
   * Admin: List all payout requests across all distributors with filtering and pagination.
   */
  public static async getAdminPayouts(query: PayoutQueryInput): Promise<{
    payouts: FormattedPayout[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const whereClause: Prisma.PayoutRequestWhereInput = {
      ...(query.status ? { status: query.status as PayoutStatus } : {}),
      ...(query.distributorId ? { distributorId: query.distributorId } : {}),
      ...(query.startDate || query.endDate
        ? {
            requestedAt: {
              ...(query.startDate ? { gte: query.startDate } : {}),
              ...(query.endDate ? { lte: query.endDate } : {}),
            },
          }
        : {}),
    };

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [total, rawPayouts] = await Promise.all([
      prisma.payoutRequest.count({ where: whereClause }),
      prisma.payoutRequest.findMany({
        where: whereClause,
        include: {
          bankAccount: true,
          distributor: {
            include: { user: true },
          },
        },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      payouts: rawPayouts.map((p) => this.formatPayout(p)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Admin: Approve a payout request (transitions REQUESTED/UNDER_REVIEW to APPROVED).
   */
  public static async approvePayout(
    adminUserId: string,
    payoutId: string,
    input?: { adminNotes?: string },
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<FormattedPayout> {
    return prisma.$transaction(async (tx) => {
      const payout = await tx.payoutRequest.findUnique({
        where: { id: payoutId },
        include: {
          bankAccount: true,
          distributor: {
            include: { user: true },
          },
        },
      });

      if (!payout) {
        throw AppError.notFound('Payout request not found.', 'PAYOUT_NOT_FOUND');
      }

      if (payout.status === 'PAID') {
        throw AppError.badRequest('Payout has already been paid.', 'ALREADY_PAID');
      }

      if (payout.status === 'REJECTED' || payout.status === 'FAILED') {
        throw AppError.badRequest(
          `Cannot approve payout with status '${payout.status}'.`,
          'INVALID_STATUS_TRANSITION'
        );
      }

      const updated = await tx.payoutRequest.update({
        where: { id: payout.id },
        data: {
          status: 'APPROVED',
          adminNotes: input?.adminNotes
            ? `${payout.adminNotes ? payout.adminNotes + '\n' : ''}Approved: ${input.adminNotes}`
            : payout.adminNotes,
        },
        include: {
          bankAccount: true,
          distributor: {
            include: { user: true },
          },
        },
      });

      // Audit log entry
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'PAYOUT_APPROVED',
          entityType: 'PayoutRequest',
          entityId: payout.id,
          previousData: { status: payout.status },
          newData: { status: 'APPROVED', adminNotes: input?.adminNotes || null },
          ipAddress: meta?.ipAddress || null,
          userAgent: meta?.userAgent || null,
        },
      });

      logger.info({ adminUserId, payoutId: payout.id }, 'Payout approved by admin');

      return this.formatPayout(updated);
    });
  }

  /**
   * Admin: Reject a payout request (transitions to REJECTED, restores held funds to wallet).
   */
  public static async rejectPayout(
    adminUserId: string,
    payoutId: string,
    input: RejectPayoutInput,
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<FormattedPayout> {
    return prisma.$transaction(async (tx) => {
      const payout = await tx.payoutRequest.findUnique({
        where: { id: payoutId },
        include: {
          bankAccount: true,
          distributor: {
            include: { user: true },
          },
        },
      });

      if (!payout) {
        throw AppError.notFound('Payout request not found.', 'PAYOUT_NOT_FOUND');
      }

      if (payout.status === 'PAID') {
        throw AppError.badRequest(
          'Cannot reject a payout that has already been marked as PAID.',
          'ALREADY_PAID'
        );
      }

      if (payout.status === 'REJECTED') {
        throw AppError.badRequest('Payout is already rejected.', 'ALREADY_REJECTED');
      }

      // 1. Release held funds back to availableBalance
      const wallet = await tx.wallet.findUnique({
        where: { distributorId: payout.distributorId },
      });

      if (wallet) {
        const balanceBefore = new Prisma.Decimal(wallet.availableBalance ?? wallet.balance ?? 0);
        const amount = new Prisma.Decimal(payout.amount);
        const balanceAfter = balanceBefore.add(amount);

        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: balanceAfter,
            balance: balanceAfter,
            pendingBalance: { decrement: amount },
          },
        });

        // 2. Log an immutable REVERSAL transaction
        const txNumber = `WTX-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            transactionNumber: txNumber,
            type: 'REVERSAL',
            status: 'COMPLETED',
            amount,
            feeAmount: new Prisma.Decimal(0),
            netAmount: amount,
            balanceBefore,
            balanceAfter,
            referenceId: payout.id,
            description: `Payout #${payout.payoutNumber} rejected. Held funds restored. Reason: ${input.reason}`,
          },
        });
      }

      // 3. Update PayoutRequest
      const updated = await tx.payoutRequest.update({
        where: { id: payout.id },
        data: {
          status: 'REJECTED',
          failureReason: input.reason,
          processedAt: new Date(),
          adminNotes: input.adminNotes
            ? `${payout.adminNotes ? payout.adminNotes + '\n' : ''}Rejected: ${input.adminNotes}`
            : payout.adminNotes,
        },
        include: {
          bankAccount: true,
          distributor: {
            include: { user: true },
          },
        },
      });

      // 4. Audit log entry
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'PAYOUT_REJECTED',
          entityType: 'PayoutRequest',
          entityId: payout.id,
          previousData: { status: payout.status },
          newData: {
            status: 'REJECTED',
            failureReason: input.reason,
            adminNotes: input.adminNotes || null,
          },
          ipAddress: meta?.ipAddress || null,
          userAgent: meta?.userAgent || null,
        },
      });

      logger.info(
        { adminUserId, payoutId: payout.id, reason: input.reason },
        'Payout rejected and held funds restored to distributor wallet'
      );

      return this.formatPayout(updated);
    });
  }

  /**
   * Admin: Mark payout as paid (transitions to PAID, deducts held pending balance,
   * creates immutable PAYOUT WalletTransaction).
   */
  public static async markPaid(
    adminUserId: string,
    payoutId: string,
    input?: MarkPaidPayoutInput,
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<FormattedPayout> {
    return prisma.$transaction(async (tx) => {
      const payout = await tx.payoutRequest.findUnique({
        where: { id: payoutId },
        include: {
          bankAccount: true,
          distributor: {
            include: { user: true },
          },
        },
      });

      if (!payout) {
        throw AppError.notFound('Payout request not found.', 'PAYOUT_NOT_FOUND');
      }

      if (payout.status === 'PAID') {
        throw AppError.badRequest('Payout is already marked as PAID.', 'ALREADY_PAID');
      }

      if (payout.status === 'REJECTED' || payout.status === 'FAILED') {
        throw AppError.badRequest(
          `Cannot mark a ${payout.status} payout as PAID.`,
          'INVALID_STATUS_TRANSITION'
        );
      }

      // 1. Release pendingBalance and increment lifetimePaid
      const wallet = await tx.wallet.findUnique({
        where: { distributorId: payout.distributorId },
      });

      if (!wallet) {
        throw AppError.badRequest('Distributor wallet not found.', 'WALLET_NOT_FOUND');
      }

      const amount = new Prisma.Decimal(payout.amount);
      const available = new Prisma.Decimal(wallet.availableBalance ?? wallet.balance ?? 0);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          pendingBalance: { decrement: amount },
          lifetimePaid: { increment: amount },
          totalWithdrawn: { increment: amount },
        },
      });

      // 2. Create immutable PAYOUT WalletTransaction
      const txNumber = `WTX-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const walletTx = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          transactionNumber: txNumber,
          type: 'PAYOUT',
          status: 'COMPLETED',
          amount,
          feeAmount: payout.fee,
          netAmount: payout.netAmount,
          balanceBefore: available,
          balanceAfter: available, // available balance was already decremented on request
          referenceId: payout.id,
          description: `Payout #${payout.payoutNumber} disbursed to bank account ${maskAccountNumber(payout.bankAccount?.accountNumber)}${input?.referenceNumber ? ` (Ref: ${input.referenceNumber})` : ''}`,
        },
      });

      // 3. Update PayoutRequest to PAID
      const updated = await tx.payoutRequest.update({
        where: { id: payout.id },
        data: {
          status: 'PAID',
          processedAt: new Date(),
          referenceNumber: input?.referenceNumber || payout.referenceNumber,
          adminNotes: input?.adminNotes
            ? `${payout.adminNotes ? payout.adminNotes + '\n' : ''}Marked Paid: ${input.adminNotes}`
            : payout.adminNotes,
          walletTransactionId: walletTx.id,
        },
        include: {
          bankAccount: true,
          distributor: {
            include: { user: true },
          },
        },
      });

      // 4. Audit log entry
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'PAYOUT_MARKED_PAID',
          entityType: 'PayoutRequest',
          entityId: payout.id,
          previousData: { status: payout.status },
          newData: {
            status: 'PAID',
            referenceNumber: input?.referenceNumber || null,
            adminNotes: input?.adminNotes || null,
            walletTransactionId: walletTx.id,
          },
          ipAddress: meta?.ipAddress || null,
          userAgent: meta?.userAgent || null,
        },
      });

      logger.info(
        { adminUserId, payoutId: payout.id, referenceNumber: input?.referenceNumber },
        'Payout marked as PAID successfully'
      );

      return this.formatPayout(updated);
    });
  }
}
