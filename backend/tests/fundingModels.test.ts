import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/config/database';
import { FundingService } from '../src/services/funding.service';
import { sanitizeFundingMetadata } from '../src/types/funding.types';
import { AppError } from '../src/utils/appError';

describe('ADMIN FUNDING MODELS & SERVICES (PROMPT 31 TEST SUITE)', () => {
  let inMemoryAccounts: Map<string, any>;
  let inMemoryFundingTx: Map<string, any>;

  beforeEach(() => {
    vi.restoreAllMocks();
    inMemoryAccounts = new Map();
    inMemoryFundingTx = new Map();

    // Mock fundingAccount
    vi.spyOn(prisma.fundingAccount, 'findUnique').mockImplementation(async (args: any) => {
      if (args.where.id) {
        return inMemoryAccounts.get(args.where.id) || null;
      }
      if (args.where.provider_providerAccountId) {
        const { provider, providerAccountId } = args.where.provider_providerAccountId;
        for (const acc of inMemoryAccounts.values()) {
          if (acc.provider === provider && acc.providerAccountId === providerAccountId) {
            return { ...acc };
          }
        }
      }
      return null;
    });

    vi.spyOn(prisma.fundingAccount, 'findMany').mockImplementation(async (args: any) => {
      let list = Array.from(inMemoryAccounts.values());
      if (args?.where?.provider) {
        list = list.filter((a) => a.provider === args.where.provider);
      }
      return list;
    });

    vi.spyOn(prisma.fundingAccount, 'updateMany').mockResolvedValue({ count: 1 } as any);

    vi.spyOn(prisma.fundingAccount, 'create').mockImplementation(async (args: any) => {
      const newAcc = {
        id: `fa-${Date.now()}-${Math.random()}`,
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryAccounts.set(newAcc.id, newAcc);
      return { ...newAcc };
    });

    // Mock fundingTransaction
    vi.spyOn(prisma.fundingTransaction, 'findUnique').mockImplementation(async (args: any) => {
      if (args.where.id) {
        const tx = inMemoryFundingTx.get(args.where.id);
        if (!tx) return null;
        return {
          ...tx,
          fundingAccount: inMemoryAccounts.get(tx.fundingAccountId),
          initiatedByAdmin: { id: tx.initiatedByAdminId, email: 'admin@kashvimlm.com', fullName: 'Super Admin' },
        };
      }
      if (args.where.idempotencyKey) {
        for (const tx of inMemoryFundingTx.values()) {
          if (tx.idempotencyKey === args.where.idempotencyKey) return { ...tx };
        }
      }
      if (args.where.provider_providerTransactionId) {
        const { provider, providerTransactionId } = args.where.provider_providerTransactionId;
        for (const tx of inMemoryFundingTx.values()) {
          if (tx.provider === provider && tx.providerTransactionId === providerTransactionId) {
            return { ...tx };
          }
        }
      }
      return null;
    });

    vi.spyOn(prisma.fundingTransaction, 'create').mockImplementation(async (args: any) => {
      const newTx = {
        id: `ftx-${Date.now()}-${Math.random()}`,
        ...args.data,
        amount: new Prisma.Decimal(args.data.amount),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryFundingTx.set(newTx.id, newTx);
      return {
        ...newTx,
        fundingAccount: inMemoryAccounts.get(newTx.fundingAccountId),
        initiatedByAdmin: { id: newTx.initiatedByAdminId, email: 'admin@kashvimlm.com', fullName: 'Super Admin' },
      };
    });
  });

  describe('1. Security: Metadata Sanitizer Invariant', () => {
    it('should strip passwords, PINs, OTPs, CVVs, and raw secrets from metadata', () => {
      const dirtyMetadata = {
        providerGateway: 'RAZORPAYX',
        apiKeyPrefix: 'rzp_live_',
        bankPassword: 'SuperSecretPassword123',
        accountPin: '1234',
        otpCode: '891234',
        cvvNumber: '999',
        clientSecret: 'secret_jwt_xyz',
        publicNote: 'Corporate Q4 Float Inflow',
      };

      const cleaned = sanitizeFundingMetadata(dirtyMetadata);

      expect(cleaned).toBeDefined();
      expect(cleaned?.providerGateway).toBe('RAZORPAYX');
      expect(cleaned?.apiKeyPrefix).toBe('rzp_live_');
      expect(cleaned?.publicNote).toBe('Corporate Q4 Float Inflow');

      // Sensitive fields must be absent
      expect(cleaned?.bankPassword).toBeUndefined();
      expect(cleaned?.accountPin).toBeUndefined();
      expect(cleaned?.otpCode).toBeUndefined();
      expect(cleaned?.cvvNumber).toBeUndefined();
      expect(cleaned?.clientSecret).toBeUndefined();
    });
  });

  describe('2. FundingAccount Registration & Validation', () => {
    it('should register a valid corporate funding account', async () => {
      const account = await FundingService.registerFundingAccount({
        provider: 'RAZORPAYX',
        providerAccountId: 'acc_rzp_corporate_1001',
        accountType: 'CURRENT',
        accountName: 'Kashvi Marketing Pvt Ltd Primary Current',
        maskedAccountNumber: 'XXXXXXXX8921',
        currency: 'INR',
        isPrimary: true,
        metadata: { channel: 'VIRTUAL_ACCOUNT' },
      });

      expect(account).toBeDefined();
      expect(account.provider).toBe('RAZORPAYX');
      expect(account.providerAccountId).toBe('acc_rzp_corporate_1001');
      expect(account.maskedAccountNumber).toBe('XXXXXXXX8921');
      expect(account.status).toBe('ACTIVE');
      expect(account.isPrimary).toBe(true);
    });

    it('should prevent duplicate registration of the same provider + providerAccountId', async () => {
      await FundingService.registerFundingAccount({
        provider: 'CASHFREE',
        providerAccountId: 'cf_merchant_2001',
        accountType: 'CURRENT',
        accountName: 'Cashfree Float Account',
        maskedAccountNumber: 'XXXXXXXX3344',
      });

      await expect(
        FundingService.registerFundingAccount({
          provider: 'CASHFREE',
          providerAccountId: 'cf_merchant_2001',
          accountType: 'CURRENT',
          accountName: 'Duplicate Attempt',
          maskedAccountNumber: 'XXXXXXXX3344',
        })
      ).rejects.toThrow('already exists');
    });

    it('should reject missing required fields', async () => {
      await expect(
        FundingService.registerFundingAccount({
          provider: '',
          providerAccountId: 'id-1',
          accountType: 'CURRENT',
          accountName: 'Name',
          maskedAccountNumber: 'XXXXXXXX1111',
        })
      ).rejects.toThrow('provider is required');

      await expect(
        FundingService.registerFundingAccount({
          provider: 'HDFC',
          providerAccountId: '',
          accountType: 'CURRENT',
          accountName: 'Name',
          maskedAccountNumber: 'XXXXXXXX1111',
        })
      ).rejects.toThrow('providerAccountId is required');
    });
  });

  describe('3. FundingTransaction Creation & Constraints', () => {
    let accountId: string;

    beforeEach(async () => {
      const account = await FundingService.registerFundingAccount({
        provider: 'RAZORPAYX',
        providerAccountId: 'acc_main_corp',
        accountType: 'CURRENT',
        accountName: 'HDFC Main Operating Float',
        maskedAccountNumber: 'XXXXXXXX4545',
        currency: 'INR',
      });
      accountId = account.id;
    });

    it('should initiate a funding transaction with status CREATED', async () => {
      const tx = await FundingService.initiateFundingTransaction({
        fundingAccountId: accountId,
        initiatedByAdminId: 'admin-super-id',
        amount: 250000,
        currency: 'INR',
        provider: 'RAZORPAYX',
        providerTransactionId: 'pay_rzp_ext_998811',
        idempotencyKey: 'IDEMP-FTX-001',
        metadata: { transferMode: 'RTGS', note: 'Q4 Liquidity buffer' },
      });

      expect(tx).toBeDefined();
      expect(tx.status).toBe('CREATED');
      expect(tx.amount).toBe(250000);
      expect(tx.providerTransactionId).toBe('pay_rzp_ext_998811');
      expect(tx.idempotencyKey).toBe('IDEMP-FTX-001');
      expect(tx.initiatedAt).toBeDefined();
    });

    it('should enforce idempotencyKey uniqueness constraint', async () => {
      await FundingService.initiateFundingTransaction({
        fundingAccountId: accountId,
        initiatedByAdminId: 'admin-1',
        amount: 50000,
        provider: 'RAZORPAYX',
        idempotencyKey: 'IDEMP-REPEAT-KEY',
      });

      await expect(
        FundingService.initiateFundingTransaction({
          fundingAccountId: accountId,
          initiatedByAdminId: 'admin-1',
          amount: 50000,
          provider: 'RAZORPAYX',
          idempotencyKey: 'IDEMP-REPEAT-KEY',
        })
      ).rejects.toThrow('idempotencyKey');
    });

    it('should enforce provider + providerTransactionId uniqueness constraint', async () => {
      await FundingService.initiateFundingTransaction({
        fundingAccountId: accountId,
        initiatedByAdminId: 'admin-1',
        amount: 75000,
        provider: 'RAZORPAYX',
        providerTransactionId: 'rzp_pay_unique_123',
        idempotencyKey: 'IDEMP-A',
      });

      await expect(
        FundingService.initiateFundingTransaction({
          fundingAccountId: accountId,
          initiatedByAdminId: 'admin-1',
          amount: 75000,
          provider: 'RAZORPAYX',
          providerTransactionId: 'rzp_pay_unique_123',
          idempotencyKey: 'IDEMP-B',
        })
      ).rejects.toThrow('External transaction \'rzp_pay_unique_123\' from provider \'RAZORPAYX\' has already been processed');
    });

    it('should reject non-positive amounts', async () => {
      await expect(
        FundingService.initiateFundingTransaction({
          fundingAccountId: accountId,
          initiatedByAdminId: 'admin-1',
          amount: 0,
          provider: 'RAZORPAYX',
          idempotencyKey: 'IDEMP-ZERO',
        })
      ).rejects.toThrow('Funding amount must be greater than zero');
    });
  });
});
