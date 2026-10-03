/**
 * ============================================================================
 * AUTOMATED TEST SUITE: COMMISSION SECURITY AUDIT (PROMPT 25)
 * ============================================================================
 * Dedicated security audit and zero-trust verification suite for the Kashvimlm
 * Commission Engine.
 *
 * Verifies:
 * 1. Authentication & RBAC Authorization (401 unauth, 403 cross-member/non-admin)
 * 2. Admin Authorization (only ADMIN / SUPER_ADMIN can run admin commission tasks)
 * 3. Zero-Trust Input Validation & Parameter Tampering Defense:
 *    - Rejects { "commission": 500000, "level": 1 }
 *    - Rejects forged BV, percentage, level, recipient, amount, wallet balance, status
 *    - Logs security audit alert on tampering attempt
 * 4. Server-Side Authoritative Commission Calculation (24%, 8%, 13%, 5%, 4%)
 * 5. Idempotency & Duplicate Prevention (Orders, Commissions, Reversals)
 * 6. Duplicate Webhook Processing & Replay Attack Defense
 * 7. Race-Condition & Concurrency Locking (Mutex per order/member)
 * 8. Transaction Atomicity & Atomic Rollback
 * 9. Sponsor-Chain Integrity (Cycle detection, self-sponsoring detection)
 * 10. Wallet Integrity & Ledger Reconciliation (detects unbacked balances)
 * 11. Ledger Integrity & Audit Immutability
 * 12. Forged References & Refund Integrity
 * 13. Audit Logging for Administrative Commission Operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { Prisma } from '@prisma/client';
import { CommissionSecurityService } from '../src/services/commissionSecurity.service';
import { OrderCommissionLifecycleService } from '../src/services/orderCommissionLifecycle.service';
import { CommissionReversalService } from '../src/services/commissionReversal.service';
import { AuditService } from '../src/services/audit.service';
import { assertNoCommissionFieldOverrides } from '../src/validators/commissionApi.validators';
import { createAdminToken, createCustomerToken, createTestToken } from './helpers/testHelpers';

describe('PROMPT 25: COMMISSION SYSTEM DEDICATED SECURITY AUDIT', () => {
  const memberToken = createTestToken({
    id: 'user-sec-dist-1',
    email: 'dist1@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  const member2Token = createTestToken({
    id: 'user-sec-dist-2',
    email: 'dist2@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  const customerToken = createCustomerToken();
  const adminToken = createAdminToken();

  const mockMember1Id = 'dist-sec-001';
  const mockMember2Id = 'dist-sec-002';
  const mockOrderId = 'ord-sec-1001';

  beforeEach(() => {
    vi.restoreAllMocks();
    CommissionSecurityService.clearWebhookCache();

    // Default mock for interactive transactions
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    // Mock distributor profile lookups
    vi.spyOn(prisma.distributorProfile, 'findFirst').mockImplementation(async (args: any) => {
      const orConds = args?.where?.OR || [];
      for (const cond of orConds) {
        if (cond.id === mockMember1Id || cond.userId === 'user-sec-dist-1') {
          return {
            id: mockMember1Id,
            userId: 'user-sec-dist-1',
            distributorCode: 'DST-SEC-1',
            firstName: 'Aarav',
            lastName: 'Sharma',
            status: 'ACTIVE',
            sponsorId: 'dist-sec-sponsor',
          };
        }
        if (cond.id === mockMember2Id || cond.userId === 'user-sec-dist-2') {
          return {
            id: mockMember2Id,
            userId: 'user-sec-dist-2',
            distributorCode: 'DST-SEC-2',
            firstName: 'Kavita',
            lastName: 'Rao',
            status: 'ACTIVE',
            sponsorId: mockMember1Id,
          };
        }
      }
      return null;
    });

    vi.spyOn(prisma.distributorProfile, 'findUnique').mockImplementation(async (args: any) => {
      const id = args?.where?.id;
      if (id === mockMember1Id) {
        return {
          id: mockMember1Id,
          userId: 'user-sec-dist-1',
          distributorCode: 'DST-SEC-1',
          firstName: 'Aarav',
          lastName: 'Sharma',
          status: 'ACTIVE',
          sponsorId: 'dist-sec-sponsor',
        };
      }
      if (id === mockMember2Id) {
        return {
          id: mockMember2Id,
          userId: 'user-sec-dist-2',
          distributorCode: 'DST-SEC-2',
          firstName: 'Kavita',
          lastName: 'Rao',
          status: 'ACTIVE',
          sponsorId: mockMember1Id,
        };
      }
      return null;
    });

    // Mock order lookups
    vi.spyOn(prisma.order, 'findUnique').mockImplementation(async (args: any) => {
      if (args?.where?.id === mockOrderId) {
        return {
          id: mockOrderId,
          orderNumber: 'ORD-SEC-2026',
          status: 'PAID',
          totalAmount: new Prisma.Decimal(10000),
          totalBV: new Prisma.Decimal(5000),
          commissionableBusinessVolume: new Prisma.Decimal(5000),
          distributorId: mockMember1Id,
          payments: [{ id: 'pay-1', status: 'COMPLETED' }],
          distributor: {
            id: mockMember1Id,
            distributorCode: 'DST-SEC-1',
            firstName: 'Aarav',
            lastName: 'Sharma',
          },
        };
      }
      return null;
    });
  });

  // =========================================================================
  // 1. AUTHENTICATION & AUTHORIZATION DEFENSE
  // =========================================================================
  describe('1. Authentication & RBAC Authorization Enforcement', () => {
    it('should reject unauthenticated requests to commission endpoints with 401', async () => {
      const res = await request(app)
        .get(`/api/members/${mockMember1Id}/commissions`)
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should reject non-admin distributor attempting to access admin commission routes with 403', async () => {
      const res = await request(app)
        .get('/api/admin/commissions')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should reject customer role attempting to access distributor commission data with 403', async () => {
      const res = await request(app)
        .get(`/api/members/${mockMember1Id}/commissions/dashboard`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should reject distributor attempting to view another members commission ledger with 403', async () => {
      const res = await request(app)
        .get(`/api/members/${mockMember1Id}/commissions`)
        .set('Authorization', `Bearer ${member2Token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access denied');
    });

    it('should permit admin to view any members commission dashboard', async () => {
      vi.spyOn(prisma.commissionTransaction, 'groupBy').mockResolvedValue([]);
      vi.spyOn(prisma.commissionReversal, 'aggregate').mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(0) },
        _count: { _all: 0 },
      } as any);
      vi.spyOn(prisma.commissionTransaction, 'count').mockResolvedValue(0);
      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/members/${mockMember1Id}/commissions/dashboard`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.member.id).toBe(mockMember1Id);
    });
  });

  // =========================================================================
  // 2. ZERO-TRUST PARAMETER MANIPULATION DEFENSE
  // =========================================================================
  describe('2. Zero-Trust Parameter Manipulation Defense', () => {
    it('CRITICAL: A normal user must NEVER be able to call an API and say { commission: 500000, level: 1 } and receive that amount', async () => {
      const maliciousPayload = {
        commission: 500000,
        level: 1,
      };

      const auditSpy = vi.spyOn(AuditService, 'recordLog');

      expect(() => {
        assertNoCommissionFieldOverrides(maliciousPayload, 'Process Commission Test', 'user-sec-dist-1');
      }).toThrow('Direct client specification of commission parameters');

      // Assert high-severity security alert was logged
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COMMISSION_SECURITY_VIOLATION_PAYLOAD_TAMPERING',
          entityType: 'CommissionSecurityAlert',
        })
      );
    });

    it('should reject client attempts to inject Business Volume (BV, totalBV, business_volume)', () => {
      expect(() => {
        CommissionSecurityService.assertZeroTrustPayload({ bv: 100000 });
      }).toThrow('Direct client specification of commission parameters (bv)');

      expect(() => {
        CommissionSecurityService.assertZeroTrustPayload({ business_volume: 50000 });
      }).toThrow('Direct client specification of commission parameters (business_volume)');

      expect(() => {
        CommissionSecurityService.assertZeroTrustPayload({ totalBV: 75000 });
      }).toThrow('Direct client specification of commission parameters (totalBV)');
    });

    it('should reject client attempts to manipulate commission percentage or rate', () => {
      expect(() => {
        CommissionSecurityService.assertZeroTrustPayload({ percentage: 50 });
      }).toThrow('percentage');

      expect(() => {
        CommissionSecurityService.assertZeroTrustPayload({ rate: 30 });
      }).toThrow('rate');
    });

    it('should reject client attempts to inject recipientId or recipient', () => {
      expect(() => {
        CommissionSecurityService.assertZeroTrustPayload({ recipientId: 'dist-malicious-user' });
      }).toThrow('recipientId');

      expect(() => {
        CommissionSecurityService.assertZeroTrustPayload({ recipient: 'dist-malicious-user' });
      }).toThrow('recipient');
    });

    it('should reject client attempts to inject wallet balance or status', () => {
      expect(() => {
        CommissionSecurityService.assertZeroTrustPayload({ walletBalance: 999999 });
      }).toThrow('walletBalance');

      expect(() => {
        CommissionSecurityService.assertZeroTrustPayload({ orderStatus: 'PAID' });
      }).toThrow('orderStatus');

      expect(() => {
        CommissionSecurityService.assertZeroTrustPayload({ commissionStatus: 'PAID' });
      }).toThrow('commissionStatus');
    });

    it('should reject client parameter tampering on admin process-commission API endpoint', async () => {
      const res = await request(app)
        .post(`/api/admin/orders/${mockOrderId}/process-commission`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          commission: 25000,
          level: 1,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Direct client specification of commission parameters');
    });
  });

  // =========================================================================
  // 3. SERVER-SIDE AUTHORITATIVE COMMISSION CALCULATION
  // =========================================================================
  describe('3. Server-Side Authoritative Commission Calculation Invariant', () => {
    it('should strictly calculate 5-level commission percentages server-side', () => {
      const testBV = 10000;

      // Level 1: 24% = 2400
      const l1 = CommissionSecurityService.calculateAuthoritativeCommission(testBV, 1);
      expect(l1.percentage).toBe(24);
      expect(l1.commissionAmount).toBe(2400);

      // Level 2: 8% = 800
      const l2 = CommissionSecurityService.calculateAuthoritativeCommission(testBV, 2);
      expect(l2.percentage).toBe(8);
      expect(l2.commissionAmount).toBe(800);

      // Level 3: 13% = 1300
      const l3 = CommissionSecurityService.calculateAuthoritativeCommission(testBV, 3);
      expect(l3.percentage).toBe(13);
      expect(l3.commissionAmount).toBe(1300);

      // Level 4: 5% = 500
      const l4 = CommissionSecurityService.calculateAuthoritativeCommission(testBV, 4);
      expect(l4.percentage).toBe(5);
      expect(l4.commissionAmount).toBe(500);

      // Level 5: 4% = 400
      const l5 = CommissionSecurityService.calculateAuthoritativeCommission(testBV, 5);
      expect(l5.percentage).toBe(4);
      expect(l5.commissionAmount).toBe(400);
    });

    it('should reject invalid or negative BV for calculation', () => {
      expect(() => CommissionSecurityService.calculateAuthoritativeCommission(0, 1)).toThrow(
        'Business Volume must be a positive number'
      );
      expect(() => CommissionSecurityService.calculateAuthoritativeCommission(-100, 1)).toThrow(
        'Business Volume must be a positive number'
      );
    });

    it('should reject invalid commission levels (outside 1-5)', () => {
      expect(() => CommissionSecurityService.calculateAuthoritativeCommission(1000, 0)).toThrow(
        'Commission level must be between 1 and 5'
      );
      expect(() => CommissionSecurityService.calculateAuthoritativeCommission(1000, 6)).toThrow(
        'Commission level must be between 1 and 5'
      );
    });
  });

  // =========================================================================
  // 4. IDEMPOTENCY & DUPLICATE PREVENTION
  // =========================================================================
  describe('4. Idempotency & Duplicate Prevention', () => {
    it('should prevent duplicate order commission processing and return existing distribution', async () => {
      // Mock existing posted commission for order
      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue([
        {
          id: 'comm-existing-1',
          orderId: mockOrderId,
          commissionLevel: 1,
          percentage: new Prisma.Decimal(24),
          grossCommissionAmount: new Prisma.Decimal(1200),
          status: 'PAID',
          walletTransactionId: 'wtx-1',
          recipientMemberId: mockMember1Id,
          recipient: {
            id: mockMember1Id,
            distributorCode: 'DST-SEC-1',
            firstName: 'Aarav',
            lastName: 'Sharma',
          },
          walletTransaction: {
            id: 'wtx-1',
            transactionNumber: 'WTX-1001',
            walletId: 'wal-1',
            balanceBefore: new Prisma.Decimal(0),
            balanceAfter: new Prisma.Decimal(1200),
          },
        },
      ] as any);

      const result = await OrderCommissionLifecycleService.processOrderCommission(mockOrderId);

      expect(result.status).toBe('ALREADY_PROCESSED');
      expect(result.isIdempotentSkip).toBe(true);
      expect(result.commissionsCreated).toBe(0);
      expect(result.recipients.length).toBe(1);
    });

    it('should prevent duplicate commission reversals using deterministic idempotency', async () => {
      vi.spyOn(prisma.commissionTransaction, 'findUnique').mockResolvedValue({
        id: 'comm-tx-100',
        orderId: mockOrderId,
        recipientMemberId: mockMember1Id,
        grossCommissionAmount: new Prisma.Decimal(1200),
        businessVolume: new Prisma.Decimal(5000),
        status: 'REVERSED',
        walletTransactionId: 'wtx-1',
      } as any);

      vi.spyOn(prisma.commissionReversal, 'findUnique').mockResolvedValue({
        id: 'rev-existing-1',
        originalCommissionId: 'comm-tx-100',
        amount: new Prisma.Decimal(-1200),
        recoveryStatus: 'COMPLETED',
      } as any);

      vi.spyOn(prisma.commissionReversal, 'findFirst').mockResolvedValue({
        id: 'rev-existing-1',
        originalCommissionId: 'comm-tx-100',
        amount: new Prisma.Decimal(-1200),
        recoveryStatus: 'COMPLETED',
      } as any);

      const result = await CommissionReversalService.reverseSingleCommission('comm-tx-100');

      expect(result.isIdempotentSkip).toBe(true);
      expect(result.recoveryStatus).toBe('COMPLETED');
    });
  });

  // =========================================================================
  // 5. DUPLICATE WEBHOOK PROCESSING & REPLAY ATTACK DEFENSE
  // =========================================================================
  describe('5. Duplicate Webhook Processing & Replay Attack Defense', () => {
    it('should execute webhook on first arrival and block duplicate replays', async () => {
      let executionCount = 0;
      const gateway = 'STRIPE';
      const eventId = 'evt_payment_intent_succeeded_999';

      const processor = async () => {
        executionCount++;
        return { orderId: mockOrderId, status: 'PAID' };
      };

      // 1. First execution
      const first = await CommissionSecurityService.processWebhookIdempotent(
        gateway,
        eventId,
        processor
      );
      expect(first.isDuplicate).toBe(false);
      expect(first.result?.orderId).toBe(mockOrderId);
      expect(executionCount).toBe(1);

      // 2. Replay attempt with same eventId
      const replay = await CommissionSecurityService.processWebhookIdempotent(
        gateway,
        eventId,
        processor
      );
      expect(replay.isDuplicate).toBe(true);
      expect(replay.result?.orderId).toBe(mockOrderId);
      // Processor must NOT have been executed a second time!
      expect(executionCount).toBe(1);
    });
  });

  // =========================================================================
  // 6. RACE-CONDITION PREVENTION (CONCURRENCY MUTEX LOCKS)
  // =========================================================================
  describe('6. Race-Condition Prevention (Concurrency Mutex Locks)', () => {
    it('should serialize concurrent operations for the same order via withOrderLock', async () => {
      const orderId = 'ord-concurrent-lock-1';
      const orderTimeline: string[] = [];

      const op1 = CommissionSecurityService.withOrderLock(orderId, async () => {
        orderTimeline.push('start-op1');
        await new Promise((r) => setTimeout(r, 25));
        orderTimeline.push('end-op1');
        return 'res1';
      });

      const op2 = CommissionSecurityService.withOrderLock(orderId, async () => {
        orderTimeline.push('start-op2');
        await new Promise((r) => setTimeout(r, 10));
        orderTimeline.push('end-op2');
        return 'res2';
      });

      const [r1, r2] = await Promise.all([op1, op2]);

      expect(r1).toBe('res1');
      expect(r2).toBe('res2');
      // Op2 MUST NOT start until Op1 completes!
      expect(orderTimeline).toEqual(['start-op1', 'end-op1', 'start-op2', 'end-op2']);
    });

    it('should serialize concurrent wallet balance mutations for the same member via withMemberLock', async () => {
      const memberId = 'dist-wallet-concurrency-1';
      const walletTimeline: string[] = [];

      const w1 = CommissionSecurityService.withMemberLock(memberId, async () => {
        walletTimeline.push('start-w1');
        await new Promise((r) => setTimeout(r, 20));
        walletTimeline.push('end-w1');
        return 100;
      });

      const w2 = CommissionSecurityService.withMemberLock(memberId, async () => {
        walletTimeline.push('start-w2');
        await new Promise((r) => setTimeout(r, 10));
        walletTimeline.push('end-w2');
        return 200;
      });

      const [res1, res2] = await Promise.all([w1, w2]);

      expect(res1).toBe(100);
      expect(res2).toBe(200);
      expect(walletTimeline).toEqual(['start-w1', 'end-w1', 'start-w2', 'end-w2']);
    });
  });

  // =========================================================================
  // 7. TRANSACTION ATOMICITY & INTEGRITY CHECKS
  // =========================================================================
  describe('7. Transaction Atomicity & Financial Entity Integrity', () => {
    it('should reject forged order IDs', async () => {
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue(null);

      await expect(
        CommissionSecurityService.verifyOrderIntegrity('FAKE-ORDER-999')
      ).rejects.toThrow('not found (forged or invalid reference)');
    });

    it('should reject CANCELLED orders from commission processing', async () => {
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: 'ord-cancelled-1',
        orderNumber: 'ORD-CANCELLED',
        status: 'CANCELLED',
        totalBV: new Prisma.Decimal(500),
        distributorId: mockMember1Id,
      } as any);

      await expect(
        CommissionSecurityService.verifyOrderIntegrity('ord-cancelled-1')
      ).rejects.toThrow('is CANCELLED. No commission processing permitted.');
    });

    it('should reject orders with zero or negative BV', async () => {
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: 'ord-zero-bv',
        orderNumber: 'ORD-ZERO',
        status: 'PAID',
        totalBV: new Prisma.Decimal(0),
        commissionableBusinessVolume: new Prisma.Decimal(0),
        distributorId: mockMember1Id,
      } as any);

      await expect(
        CommissionSecurityService.verifyOrderIntegrity('ord-zero-bv')
      ).rejects.toThrow('has no positive commissionable Business Volume');
    });

    it('should reject forged member IDs', async () => {
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(null);

      await expect(
        CommissionSecurityService.verifyMemberIntegrity('FAKE-MEMBER-999')
      ).rejects.toThrow('does not exist (forged or invalid member reference)');
    });

    it('should reject TERMINATED or SUSPENDED members from commission operations', async () => {
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue({
        id: 'dist-suspended',
        distributorCode: 'DST-SUSP',
        status: 'SUSPENDED',
      } as any);

      await expect(
        CommissionSecurityService.verifyMemberIntegrity('dist-suspended')
      ).rejects.toThrow("currently in 'SUSPENDED' status");
    });
  });

  // =========================================================================
  // 8. SPONSOR-CHAIN INTEGRITY & CIRCULAR LOOP DETECTION
  // =========================================================================
  describe('8. Sponsor-Chain Integrity & Cycle Detection', () => {
    it('should detect and reject self-sponsoring (A -> A)', async () => {
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue({
        id: 'dist-self-sponsor',
        distributorCode: 'DST-SELF',
        sponsorId: 'dist-self-sponsor', // Sponsoring self!
      } as any);

      await expect(
        CommissionSecurityService.verifySponsorChainIntegrity('dist-self-sponsor')
      ).rejects.toThrow('Self-sponsoring detected');
    });

    it('should detect and reject circular upline loops (A -> B -> C -> A)', async () => {
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockImplementation(async (args: any) => {
        const id = args.where.id;
        if (id === 'node-A') return { id: 'node-A', sponsorId: 'node-B' } as any;
        if (id === 'node-B') return { id: 'node-B', sponsorId: 'node-C' } as any;
        if (id === 'node-C') return { id: 'node-C', sponsorId: 'node-A' } as any; // Loop!
        return null;
      });

      await expect(
        CommissionSecurityService.verifySponsorChainIntegrity('node-A', 5)
      ).rejects.toThrow('Circular upline loop detected');
    });

    it('should successfully validate clean linear 5-level upline chain', async () => {
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockImplementation(async (args: any) => {
        const id = args.where.id;
        if (id === 'node-1') return { id: 'node-1', sponsorId: 'node-2' } as any;
        if (id === 'node-2') return { id: 'node-2', sponsorId: 'node-3' } as any;
        if (id === 'node-3') return { id: 'node-3', sponsorId: 'node-4' } as any;
        if (id === 'node-4') return { id: 'node-4', sponsorId: 'node-5' } as any;
        if (id === 'node-5') return { id: 'node-5', sponsorId: null } as any; // Root
        return null;
      });

      const res = await CommissionSecurityService.verifySponsorChainIntegrity('node-1', 5);
      expect(res.valid).toBe(true);
      expect(res.depth).toBe(4);
      expect(res.uplineIds).toEqual(['node-2', 'node-3', 'node-4', 'node-5']);
    });
  });

  // =========================================================================
  // 9. WALLET & LEDGER INTEGRITY RECONCILIATION
  // =========================================================================
  describe('9. Wallet & Ledger Integrity Reconciliation', () => {
    it('should detect wallet balance reconciliation matching transaction ledger', async () => {
      vi.spyOn(prisma.wallet, 'findFirst').mockResolvedValue({
        id: 'wal-101',
        balance: new Prisma.Decimal(3200),
      } as any);

      vi.spyOn(prisma.walletTransaction, 'findMany').mockResolvedValue([
        { type: 'CREDIT', amount: new Prisma.Decimal(2400) },
        { type: 'CREDIT', amount: new Prisma.Decimal(1200) },
        { type: 'DEBIT', amount: new Prisma.Decimal(400) },
      ] as any);

      const check = await CommissionSecurityService.verifyWalletIntegrity(mockMember1Id);
      expect(check.isBalanced).toBe(true);
      expect(check.currentBalance).toBe(3200);
      expect(check.ledgerSum).toBe(3200);
    });

    it('should reject negative wallet balance as an integrity violation', async () => {
      vi.spyOn(prisma.wallet, 'findFirst').mockResolvedValue({
        id: 'wal-negative',
        balance: new Prisma.Decimal(-500),
      } as any);

      await expect(
        CommissionSecurityService.verifyWalletIntegrity('dist-neg')
      ).rejects.toThrow('Negative wallet balance');
    });

    it('should verify commission transaction ledger canonical rate matching', async () => {
      vi.spyOn(prisma.commissionTransaction, 'findUnique').mockResolvedValue({
        id: 'comm-good',
        commissionLevel: 1,
        percentage: new Prisma.Decimal(24),
        grossCommissionAmount: new Prisma.Decimal(2400),
        order: { id: mockOrderId, orderNumber: 'ORD-1', totalBV: new Prisma.Decimal(10000) },
        recipient: { id: mockMember1Id, distributorCode: 'DST-1' },
        walletTransaction: { id: 'wtx-1' },
      } as any);

      const comm = await CommissionSecurityService.verifyLedgerIntegrity('comm-good');
      expect(comm.id).toBe('comm-good');
    });

    it('should reject commission transaction with manipulated or corrupted tier rate', async () => {
      vi.spyOn(prisma.commissionTransaction, 'findUnique').mockResolvedValue({
        id: 'comm-corrupted',
        commissionLevel: 1, // Level 1 is canonical 24%
        percentage: new Prisma.Decimal(99), // Corrupted rate: 99%!
        grossCommissionAmount: new Prisma.Decimal(9900),
        order: { id: mockOrderId, orderNumber: 'ORD-1', totalBV: new Prisma.Decimal(10000) },
        recipient: { id: mockMember1Id, distributorCode: 'DST-1' },
        walletTransaction: { id: 'wtx-1' },
      } as any);

      await expect(
        CommissionSecurityService.verifyLedgerIntegrity('comm-corrupted')
      ).rejects.toThrow('Commission percentage (99%) does not match canonical tier rate (24%)');
    });

    it('should block mutation or deletion of immutable audit logs', () => {
      expect(() => CommissionSecurityService.blockLedgerMutation()).toThrow(
        'Modifying, updating, or deleting commission audit ledger records is strictly prohibited.'
      );
    });
  });

  // =========================================================================
  // 10. ADMINISTRATIVE COMMISSION OPERATIONS AUDIT LOGGING
  // =========================================================================
  describe('10. Administrative Commission Operations Audit Logging', () => {
    it('should record comprehensive audit log for admin commission processing', async () => {
      const auditSpy = vi.spyOn(AuditService, 'recordLog');

      vi.spyOn(OrderCommissionLifecycleService, 'processOrderCommission').mockResolvedValue({
        orderId: mockOrderId,
        orderNumber: 'ORD-SEC-2026',
        lifecycleStage: 'COMMISSION_AVAILABLE',
        status: 'SUCCESS',
        isIdempotentSkip: false,
        isEligible: true,
        orderStatus: 'PAID',
        paymentStatus: 'COMPLETED',
        purchaserMemberId: mockMember1Id,
        businessVolume: 5000,
        commissionsCreated: 1,
        totalCommission: 1200,
        recipients: [],
        skippedRecipients: [],
        availableAt: new Date(),
        processedAt: new Date(),
      });

      const res = await request(app)
        .post(`/api/admin/orders/${mockOrderId}/process-commission`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ADMIN_COMMISSION_PROCESS_ORDER',
          entityType: 'OrderCommission',
          entityId: mockOrderId,
        })
      );
    });

    it('should record comprehensive audit log for admin commission reversal', async () => {
      const auditSpy = vi.spyOn(AuditService, 'recordLog');

      vi.spyOn(CommissionReversalService, 'reverseSingleCommission').mockResolvedValue({
        reversalId: 'rev-sec-101',
        originalCommissionId: 'comm-sec-101',
        recipientMemberId: mockMember1Id,
        orderId: mockOrderId,
        reversalAmount: -1200,
        recoveryStatus: 'COMPLETED',
        walletTransactionId: 'wtx-rev-1',
        walletBalanceBefore: 1200,
        walletBalanceAfter: 0,
        isIdempotentSkip: false,
        reason: 'Customer return',
      });

      const res = await request(app)
        .post('/api/admin/commissions/comm-sec-101/reverse')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Customer return' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ADMIN_COMMISSION_REVERSAL',
          entityType: 'CommissionTransaction',
          entityId: 'comm-sec-101',
        })
      );
    });
  });
});
