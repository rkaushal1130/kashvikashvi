import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { MLMSecurityService } from '../src/services/mlmSecurity.service';
import { BBService } from '../src/services/bb.service';
import { MatchingService } from '../src/services/matching.service';
import { LevelService } from '../src/services/level.service';
import { AuditService } from '../src/services/audit.service';
import { createAdminToken, createCustomerToken, createTestToken } from './helpers/testHelpers';

describe('PROMPT 8: MLM BUSINESS RULE VALIDATION AND ZERO-TRUST SECURITY AUDIT', () => {
  const memberToken = createTestToken({
    id: 'usr-secure-001',
    email: 'secure.member@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  const customerToken = createCustomerToken();
  const adminToken = createAdminToken();

  const mockMemberId = 'dist-secure-001';

  beforeEach(() => {
    vi.restoreAllMocks();

    // Default mock for interactive transactions
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    // Mock distributor profile
    vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue({
      id: mockMemberId,
      userId: 'usr-secure-001',
      distributorCode: 'DST-SEC-001',
      firstName: 'Vikram',
      lastName: 'Mehta',
      currentBB: 100,
      currentMatching: 1000,
      currentLevelId: null,
      currentRankId: null,
    } as any);

    vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
      id: mockMemberId,
      userId: 'usr-secure-001',
      distributorCode: 'DST-SEC-001',
      firstName: 'Vikram',
      lastName: 'Mehta',
      currentBB: 100,
      currentMatching: 1000,
      currentLevelId: null,
      currentRankId: null,
    } as any);
  });

  // =========================================================================
  // 1. ZERO-TRUST PAYLOAD AUDIT: REJECT ARBITRARY VOLUME / LEVEL / RANK
  // =========================================================================
  describe('1. Zero-Trust Payload Auditing & Injection Rejection', () => {
    it('CRITICAL: should REJECT a member trying to send { bb, matching, level } on profile update', async () => {
      // Normal member attempts to elevate themselves to RUBY with 100k BB and 1M Matching
      const maliciousPayload = {
        bb: 100000,
        matching: 1000000,
        level: 'RUBY',
      };

      const res = await request(app)
        .patch('/api/v1/distributors/me')
        .set('Authorization', `Bearer ${memberToken}`)
        .send(maliciousPayload)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Direct client modification of MLM qualification or financial fields');
    });

    it('should REJECT injection of rank or wallet balance fields from client', async () => {
      const res = await request(app)
        .patch('/api/v1/distributors/me')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          rank: 'DIAMOND',
          walletBalance: 500000,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Direct client modification of MLM qualification');
    });

    it('should log a high-severity security audit entry when field injection is attempted', async () => {
      const auditSpy = vi.spyOn(AuditService, 'recordLog');

      await request(app)
        .patch('/api/v1/distributors/me')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          bb: 50000,
        })
        .expect(400);

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SECURITY_VIOLATION_FIELD_INJECTION',
          entityType: 'SecurityAlert',
        })
      );
    });
  });

  // =========================================================================
  // 2. FAKE REFERENCE & ORDER VERIFICATION
  // =========================================================================
  describe('2. Real Order & Transaction Reference Verification', () => {
    it('should REJECT fake order references (e.g. FAKE-ORD-999) when crediting BB', async () => {
      await expect(
        BBService.addBB({
          memberId: mockMemberId,
          amount: 500,
          source: 'ORDER',
          referenceId: 'FAKE-ORD-99999', // Nonexistent fake order
        })
      ).rejects.toThrow('Invalid or fake order reference');
    });

    it('should REJECT volume crediting from CANCELLED or REFUNDED orders', async () => {
      // Mock order exists but is in CANCELLED status
      vi.spyOn(prisma.order, 'findFirst').mockResolvedValue({
        id: 'ord-cancelled-123',
        orderNumber: 'ORD-CANCELLED',
        status: 'CANCELLED',
        distributorId: mockMemberId,
        totalBV: 500,
      } as any);

      await expect(
        BBService.addBB({
          memberId: mockMemberId,
          amount: 500,
          source: 'ORDER',
          referenceId: 'ord-cancelled-123',
        })
      ).rejects.toThrow("Order is currently in 'CANCELLED' status");
    });

    it('should REJECT volume crediting if the order belongs to a different distributor', async () => {
      // Mock order exists and is PAID, but belongs to another distributor
      vi.spyOn(prisma.order, 'findFirst').mockResolvedValue({
        id: 'ord-other-user',
        orderNumber: 'ORD-OTHER',
        status: 'PAID',
        distributorId: 'dist-different-user-999', // Mismatched distributor
        totalBV: 500,
      } as any);

      await expect(
        BBService.addBB({
          memberId: mockMemberId,
          amount: 500,
          source: 'ORDER',
          referenceId: 'ord-other-user',
        })
      ).rejects.toThrow('belongs to another distributor');
    });

    it('should REJECT fake commission period references', async () => {
      await expect(
        MatchingService.recordMatchingTransaction({
          memberId: mockMemberId,
          amount: 1000,
          source: 'COMMISSION_CYCLE',
          referenceId: 'FAKE-PERIOD-2026-X',
        })
      ).rejects.toThrow('Invalid commission period reference');
    });
  });

  // =========================================================================
  // 3. NEGATIVE VOLUME & BALANCE MANIPULATION GUARDS
  // =========================================================================
  describe('3. Negative Volume & Manipulation Prevention', () => {
    it('should REJECT negative or zero BB credit amounts', async () => {
      await expect(
        BBService.addBB({
          memberId: mockMemberId,
          amount: -100, // Negative credit attempt
          source: 'ORDER',
          referenceId: 'ORD-123',
        })
      ).rejects.toThrow('amount must be a positive number greater than 0');

      await expect(
        BBService.addBB({
          memberId: mockMemberId,
          amount: 0, // Zero credit attempt
          source: 'ORDER',
          referenceId: 'ORD-123',
        })
      ).rejects.toThrow('amount must be a positive number greater than 0');
    });

    it('should REJECT negative or zero matching credit amounts', async () => {
      await expect(
        MatchingService.recordMatchingTransaction({
          memberId: mockMemberId,
          amount: -500,
          source: 'BINARY_MATCH',
          referenceId: 'BM-123',
        })
      ).rejects.toThrow('amount must be a positive number');
    });

    it('should REJECT debits that would drive balance below zero', async () => {
      // Mock previous balance = 50
      vi.spyOn((prisma as any).bBTransaction, 'findFirst').mockResolvedValue({
        balanceAfter: 50,
      } as any);

      // Attempt to debit 100 when balance is only 50
      await expect(
        BBService.removeBB({
          memberId: mockMemberId,
          amount: 100,
          source: 'REFUND',
          referenceId: 'REF-001',
          allowNegativeBalance: false,
        })
      ).rejects.toThrow('Insufficient BB balance for removal');
    });
  });

  // =========================================================================
  // 4. IDEMPOTENCY & REPLAY ATTACK PROTECTION
  // =========================================================================
  describe('4. Idempotency & Replay Attack Protection', () => {
    it('should return existing record without double-crediting when identical BB event is replayed', async () => {
      const existingTx = {
        id: 'bb-tx-existing-1',
        memberId: mockMemberId,
        amount: 250,
        balanceAfter: 350,
        type: 'CREDIT',
        source: 'ORDER',
        referenceId: 'ORD-IDEMPOTENT-001',
        createdAt: new Date(),
      };

      vi.spyOn((prisma as any).bBTransaction, 'findUnique').mockResolvedValue(existingTx as any);
      const updateSpy = vi.spyOn(prisma.distributorProfile, 'update');

      const result = await BBService.addBB({
        memberId: mockMemberId,
        amount: 250,
        source: 'ORDER',
        referenceId: 'ORD-IDEMPOTENT-001',
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.transaction.id).toBe(existingTx.id);
      // Profile must NOT be updated again on replayed event
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('should return existing record without double-crediting when identical matching event is replayed', async () => {
      const existingTx = {
        id: 'match-tx-existing-1',
        memberId: mockMemberId,
        amount: 5000,
        balanceAfter: 5000,
        type: 'CREDIT',
        source: 'BINARY_MATCH',
        referenceId: 'BM-IDEMPOTENT-001',
        createdAt: new Date(),
      };

      vi.spyOn((prisma as any).matchingTransaction, 'findUnique').mockResolvedValue(existingTx as any);

      const result = await MatchingService.recordMatchingTransaction({
        memberId: mockMemberId,
        amount: 5000,
        source: 'BINARY_MATCH',
        referenceId: 'BM-IDEMPOTENT-001',
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.transaction.id).toBe(existingTx.id);
    });
  });

  // =========================================================================
  // 5. CONCURRENT RACE-CONDITION PROTECTION (MUTEX LOCK)
  // =========================================================================
  describe('5. Concurrency & Race Condition Mutex', () => {
    it('should execute concurrent operations on the same member serially via withMemberLock', async () => {
      const executionOrder: string[] = [];

      const op1 = MLMSecurityService.withMemberLock(mockMemberId, async () => {
        executionOrder.push('start-1');
        await new Promise((r) => setTimeout(r, 20));
        executionOrder.push('end-1');
        return 1;
      });

      const op2 = MLMSecurityService.withMemberLock(mockMemberId, async () => {
        executionOrder.push('start-2');
        await new Promise((r) => setTimeout(r, 10));
        executionOrder.push('end-2');
        return 2;
      });

      const [res1, res2] = await Promise.all([op1, op2]);

      expect(res1).toBe(1);
      expect(res2).toBe(2);
      // Operation 2 must NOT start before Operation 1 completes!
      expect(executionOrder).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
    });

    it('should allow concurrent operations on DIFFERENT members without blocking', async () => {
      const executionOrder: string[] = [];

      const op1 = MLMSecurityService.withMemberLock('member-AAA', async () => {
        executionOrder.push('start-AAA');
        await new Promise((r) => setTimeout(r, 20));
        executionOrder.push('end-AAA');
        return 'AAA';
      });

      const op2 = MLMSecurityService.withMemberLock('member-BBB', async () => {
        executionOrder.push('start-BBB');
        await new Promise((r) => setTimeout(r, 10));
        executionOrder.push('end-BBB');
        return 'BBB';
      });

      await Promise.all([op1, op2]);

      // Because they are different members, member-BBB can finish before member-AAA
      expect(executionOrder.indexOf('start-BBB')).toBeLessThan(executionOrder.indexOf('end-AAA'));
    });
  });

  // =========================================================================
  // 6. SERVER-SIDE RANK CALCULATION & IMMUTABILITY AUDIT
  // =========================================================================
  describe('6. Server-Side Rank Calculation & Immutable Audit Compliance', () => {
    it('should calculate ranks strictly from highest to lowest on server side', async () => {
      // 1200 BB and 120000 Matching -> Should directly evaluate to RUBY
      const evaluation = await LevelService.calculateEligibleLevel(
        mockMemberId,
        { bb: 1200, matching: 120000 }
      );

      expect(evaluation.eligibleLevel.code).toBe('RUBY');
      expect(evaluation.evaluatedFromHighest).toBe(true);
    });

    it('should strictly prohibit mutation or deletion of ledger and level histories', () => {
      expect(() => MLMSecurityService.blockLedgerMutation()).toThrow(
        'Modifying, updating, or deleting immutable MLM transaction and level audit history is strictly prohibited.'
      );
    });
  });
});
