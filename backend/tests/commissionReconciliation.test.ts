/**
 * ============================================================================
 * TEST SUITE: COMMISSION RECONCILIATION SYSTEM (PROMPT 27)
 * ============================================================================
 * Dedicated verification suite for Commission Reconciliation comparing:
 * - Orders
 * - Business Volume (BV)
 * - Commission Ledger
 * - Wallet Ledger
 *
 * SPECIFICATION COVERAGE:
 * 1. 7 Canonical Discrepancies:
 *    - MISSING_COMMISSION
 *    - DUPLICATE_COMMISSION
 *    - INCORRECT_COMMISSION_AMOUNT
 *    - INCORRECT_RECIPIENT
 *    - INCORRECT_COMMISSION_LEVEL
 *    - WALLET_MISMATCH (missing link, amount mismatch, wallet ledger drift)
 *    - REVERSAL_MISMATCH (unreversed commissions on refunded order, over-reversal)
 * 2. Three Core Reconciliation Operations:
 *    - reconcileOrderCommission(orderId)
 *    - reconcileMemberCommissions(memberId)
 *    - reconcileCommissionPeriod(startDate, endDate)
 * 3. Non-Destructive Invariant vs Safe Auto-Correction:
 *    - Does NOT modify financial records by default
 *    - Discrepancies generated for administrative review
 *    - Safe auto-correction applied only when explicitly requested and conditions met
 * 4. Mandatory Audit Logging:
 *    - Every reconciliation execution logged via AuditService.recordLog
 * 5. Admin-Only Access & Security RBAC:
 *    - 401 Unauthorized for missing token
 *    - 403 Forbidden for non-admin roles (DISTRIBUTOR, CUSTOMER)
 *    - 200 OK for ADMIN / SUPER_ADMIN
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { Prisma } from '@prisma/client';
import { CommissionReconciliationService } from '../src/services/commissionReconciliation.service';
import { SponsorUplineService } from '../src/services/sponsorUpline.service';
import { CommissionConfigService } from '../src/services/commissionConfig.service';
import { OrderCommissionLifecycleService } from '../src/services/orderCommissionLifecycle.service';
import { AuditService } from '../src/services/audit.service';
import { createAdminToken, createCustomerToken, createTestToken } from './helpers/testHelpers';

describe('PROMPT 27: COMMISSION RECONCILIATION SYSTEM', () => {
  const adminToken = createAdminToken();
  const distributorToken = createTestToken({
    id: 'usr-dist-001',
    email: 'dist@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });
  const customerToken = createCustomerToken();

  const mockOrderId = 'ord-recon-001';
  const mockBuyerId = 'dist-buyer-001';

  const defaultUplines = [
    { level: 1, distributorId: 'upline-1', distributorCode: 'DST-UP1', displayName: 'Up 1', status: 'ACTIVE', isDirect: true, isActive: true },
    { level: 2, distributorId: 'upline-2', distributorCode: 'DST-UP2', displayName: 'Up 2', status: 'ACTIVE', isDirect: false, isActive: true },
    { level: 3, distributorId: 'upline-3', distributorCode: 'DST-UP3', displayName: 'Up 3', status: 'ACTIVE', isDirect: false, isActive: true },
    { level: 4, distributorId: 'upline-4', distributorCode: 'DST-UP4', displayName: 'Up 4', status: 'ACTIVE', isDirect: false, isActive: true },
    { level: 5, distributorId: 'upline-5', distributorCode: 'DST-UP5', displayName: 'Up 5', status: 'ACTIVE', isDirect: false, isActive: true },
  ];

  const defaultRates = [
    { levelNumber: 1, percentageNumber: 24 },
    { levelNumber: 2, percentageNumber: 8 },
    { levelNumber: 3, percentageNumber: 13 },
    { levelNumber: 4, percentageNumber: 5 },
    { levelNumber: 5, percentageNumber: 4 },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    CommissionConfigService.clearCache();

    // Default uplines & config rates
    vi.spyOn(SponsorUplineService, 'getUplineChain').mockResolvedValue(defaultUplines as any);
    vi.spyOn(CommissionConfigService, 'getCommissionRates').mockResolvedValue(defaultRates as any);
    vi.spyOn(AuditService, 'recordLog').mockResolvedValue({} as any);

    // Default Prisma transaction spy
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });
  });

  // =========================================================================
  // 1. RECONCILE ORDER COMMISSION — NO DISCREPANCIES (CLEAN STATE)
  // =========================================================================
  describe('1. Clean Order Reconciliation', () => {
    it('should report zero discrepancies when order, BV, commission ledger, and wallet match perfectly', async () => {
      // BV = 10,000 -> Expected: L1=2400, L2=800, L3=1300, L4=500, L5=400 (Total = 5400)
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'ORD-1001',
        status: 'PAID',
        totalBV: new Prisma.Decimal(10000),
        commissionableBusinessVolume: new Prisma.Decimal(10000),
        distributorId: mockBuyerId,
        distributor: { id: mockBuyerId, distributorCode: 'DST-BUYER', sponsorId: 'upline-1' },
        payments: [{ id: 'pmt-1', status: 'SUCCESS' }],
      } as any);

      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue([
        {
          id: 'comm-1',
          orderId: mockOrderId,
          commissionLevel: 1,
          recipientMemberId: 'upline-1',
          grossCommissionAmount: new Prisma.Decimal(2400),
          netCommissionAmount: new Prisma.Decimal(2400),
          status: 'PAID',
          walletTransactionId: 'wtx-1',
          walletTransaction: { id: 'wtx-1', amount: new Prisma.Decimal(2400) },
          recipient: { id: 'upline-1', distributorCode: 'DST-UP1', sponsorId: 'upline-2' },
        },
        {
          id: 'comm-2',
          orderId: mockOrderId,
          commissionLevel: 2,
          recipientMemberId: 'upline-2',
          grossCommissionAmount: new Prisma.Decimal(800),
          netCommissionAmount: new Prisma.Decimal(800),
          status: 'PAID',
          walletTransactionId: 'wtx-2',
          walletTransaction: { id: 'wtx-2', amount: new Prisma.Decimal(800) },
          recipient: { id: 'upline-2', distributorCode: 'DST-UP2', sponsorId: 'upline-3' },
        },
        {
          id: 'comm-3',
          orderId: mockOrderId,
          commissionLevel: 3,
          recipientMemberId: 'upline-3',
          grossCommissionAmount: new Prisma.Decimal(1300),
          netCommissionAmount: new Prisma.Decimal(1300),
          status: 'PAID',
          walletTransactionId: 'wtx-3',
          walletTransaction: { id: 'wtx-3', amount: new Prisma.Decimal(1300) },
          recipient: { id: 'upline-3', distributorCode: 'DST-UP3', sponsorId: 'upline-4' },
        },
        {
          id: 'comm-4',
          orderId: mockOrderId,
          commissionLevel: 4,
          recipientMemberId: 'upline-4',
          grossCommissionAmount: new Prisma.Decimal(500),
          netCommissionAmount: new Prisma.Decimal(500),
          status: 'PAID',
          walletTransactionId: 'wtx-4',
          walletTransaction: { id: 'wtx-4', amount: new Prisma.Decimal(500) },
          recipient: { id: 'upline-4', distributorCode: 'DST-UP4', sponsorId: 'upline-5' },
        },
        {
          id: 'comm-5',
          orderId: mockOrderId,
          commissionLevel: 5,
          recipientMemberId: 'upline-5',
          grossCommissionAmount: new Prisma.Decimal(400),
          netCommissionAmount: new Prisma.Decimal(400),
          status: 'PAID',
          walletTransactionId: 'wtx-5',
          walletTransaction: { id: 'wtx-5', amount: new Prisma.Decimal(400) },
          recipient: { id: 'upline-5', distributorCode: 'DST-UP5', sponsorId: null },
        },
      ] as any);

      vi.spyOn(prisma.commissionReversal, 'findMany').mockResolvedValue([]);

      const result = await CommissionReconciliationService.reconcileOrderCommission(mockOrderId);

      expect(result.hasDiscrepancies).toBe(false);
      expect(result.discrepancyCount).toBe(0);
      expect(result.discrepancies).toHaveLength(0);
      expect(result.expectedTotalCommission).toBe(5400);
      expect(result.actualTotalCommission).toBe(5400);
      expect(result.expectedCommissionsCount).toBe(5);
      expect(result.actualCommissionsCount).toBe(5);
      expect(result.autoCorrected).toBe(false);

      // Verify mandatory audit log was generated
      expect(AuditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COMMISSION_RECONCILIATION_ORDER',
          entityType: 'Order',
          entityId: mockOrderId,
        })
      );
    });
  });

  // =========================================================================
  // 2. DISCREPANCY DETECTION: ALL 7 TYPES
  // =========================================================================
  describe('2. Detection of All 7 Specified Discrepancies', () => {
    // 2.1 MISSING_COMMISSION
    it('should detect MISSING_COMMISSION when paid order has unposted upline levels', async () => {
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'ORD-1002',
        status: 'PAID',
        totalBV: new Prisma.Decimal(10000),
        distributorId: mockBuyerId,
        distributor: { id: mockBuyerId, distributorCode: 'DST-BUYER', sponsorId: 'upline-1' },
      } as any);

      // Only Level 1 & 2 commissions were recorded; Levels 3, 4, 5 are missing
      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue([
        {
          id: 'comm-1',
          orderId: mockOrderId,
          commissionLevel: 1,
          recipientMemberId: 'upline-1',
          grossCommissionAmount: new Prisma.Decimal(2400),
          status: 'PAID',
          walletTransactionId: 'wtx-1',
          walletTransaction: { id: 'wtx-1', amount: new Prisma.Decimal(2400) },
        },
        {
          id: 'comm-2',
          orderId: mockOrderId,
          commissionLevel: 2,
          recipientMemberId: 'upline-2',
          grossCommissionAmount: new Prisma.Decimal(800),
          status: 'PAID',
          walletTransactionId: 'wtx-2',
          walletTransaction: { id: 'wtx-2', amount: new Prisma.Decimal(800) },
        },
      ] as any);
      vi.spyOn(prisma.commissionReversal, 'findMany').mockResolvedValue([]);

      const result = await CommissionReconciliationService.reconcileOrderCommission(mockOrderId);

      expect(result.hasDiscrepancies).toBe(true);
      const missingDiscs = result.discrepancies.filter((d) => d.type === 'MISSING_COMMISSION');
      expect(missingDiscs).toHaveLength(3); // Levels 3, 4, 5

      const l3 = missingDiscs.find((d) => d.level === 3);
      expect(l3).toBeDefined();
      expect(l3?.expectedValue).toBe(1300);
      expect(l3?.discrepancyAmount).toBe(1300);
      expect(l3?.severity).toBe('HIGH');
      expect(l3?.autoCorrectable).toBe(true);

      const l4 = missingDiscs.find((d) => d.level === 4);
      expect(l4?.expectedValue).toBe(500);

      const l5 = missingDiscs.find((d) => d.level === 5);
      expect(l5?.expectedValue).toBe(400);
    });

    // 2.2 DUPLICATE_COMMISSION
    it('should detect DUPLICATE_COMMISSION when duplicate records exist for the same level', async () => {
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'ORD-1003',
        status: 'PAID',
        totalBV: new Prisma.Decimal(10000),
        distributorId: mockBuyerId,
      } as any);

      // Duplicate entries for Level 1
      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue([
        {
          id: 'comm-1a',
          orderId: mockOrderId,
          commissionLevel: 1,
          recipientMemberId: 'upline-1',
          grossCommissionAmount: new Prisma.Decimal(2400),
          status: 'PAID',
          walletTransactionId: 'wtx-1a',
          walletTransaction: { id: 'wtx-1a', amount: new Prisma.Decimal(2400) },
        },
        {
          id: 'comm-1b',
          orderId: mockOrderId,
          commissionLevel: 1,
          recipientMemberId: 'upline-1',
          grossCommissionAmount: new Prisma.Decimal(2400),
          status: 'PAID',
          walletTransactionId: 'wtx-1b',
          walletTransaction: { id: 'wtx-1b', amount: new Prisma.Decimal(2400) },
        },
      ] as any);
      vi.spyOn(prisma.commissionReversal, 'findMany').mockResolvedValue([]);

      const result = await CommissionReconciliationService.reconcileOrderCommission(mockOrderId);

      expect(result.hasDiscrepancies).toBe(true);
      const dup = result.discrepancies.find((d) => d.type === 'DUPLICATE_COMMISSION');
      expect(dup).toBeDefined();
      expect(dup?.severity).toBe('CRITICAL');
      expect(dup?.level).toBe(1);
      expect(dup?.details?.commissionIds).toEqual(['comm-1a', 'comm-1b']);
    });

    // 2.3 INCORRECT_COMMISSION_AMOUNT
    it('should detect INCORRECT_COMMISSION_AMOUNT when recorded commission amount diverges from authoritative BV formula', async () => {
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'ORD-1004',
        status: 'PAID',
        totalBV: new Prisma.Decimal(10000),
        distributorId: mockBuyerId,
      } as any);

      // Level 1 commission recorded as ₹4,000 instead of ₹2,400
      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue([
        {
          id: 'comm-1',
          orderId: mockOrderId,
          commissionLevel: 1,
          recipientMemberId: 'upline-1',
          grossCommissionAmount: new Prisma.Decimal(4000),
          status: 'PAID',
          walletTransactionId: 'wtx-1',
          walletTransaction: { id: 'wtx-1', amount: new Prisma.Decimal(4000) },
        },
      ] as any);
      vi.spyOn(prisma.commissionReversal, 'findMany').mockResolvedValue([]);

      const result = await CommissionReconciliationService.reconcileOrderCommission(mockOrderId);

      expect(result.hasDiscrepancies).toBe(true);
      const amountDisc = result.discrepancies.find((d) => d.type === 'INCORRECT_COMMISSION_AMOUNT');
      expect(amountDisc).toBeDefined();
      expect(amountDisc?.expectedValue).toBe(2400);
      expect(amountDisc?.actualValue).toBe(4000);
      expect(amountDisc?.discrepancyAmount).toBe(1600);
    });

    // 2.4 INCORRECT_RECIPIENT
    it('should detect INCORRECT_RECIPIENT when recorded recipient does not match true sponsor upline at that level', async () => {
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'ORD-1005',
        status: 'PAID',
        totalBV: new Prisma.Decimal(10000),
        distributorId: mockBuyerId,
      } as any);

      // Level 1 paid to imposter instead of true sponsor upline-1
      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue([
        {
          id: 'comm-1',
          orderId: mockOrderId,
          commissionLevel: 1,
          recipientMemberId: 'dist-imposter-999',
          grossCommissionAmount: new Prisma.Decimal(2400),
          status: 'PAID',
          walletTransactionId: 'wtx-1',
          walletTransaction: { id: 'wtx-1', amount: new Prisma.Decimal(2400) },
          recipient: { id: 'dist-imposter-999', distributorCode: 'IMPOSTER' },
        },
      ] as any);
      vi.spyOn(prisma.commissionReversal, 'findMany').mockResolvedValue([]);

      const result = await CommissionReconciliationService.reconcileOrderCommission(mockOrderId);

      expect(result.hasDiscrepancies).toBe(true);
      const recipDisc = result.discrepancies.find((d) => d.type === 'INCORRECT_RECIPIENT');
      expect(recipDisc).toBeDefined();
      expect(recipDisc?.expectedValue).toBe('upline-1');
      expect(recipDisc?.actualValue).toBe('dist-imposter-999');
    });

    // 2.5 INCORRECT_COMMISSION_LEVEL
    it('should detect INCORRECT_COMMISSION_LEVEL when level is outside 1-5 range', async () => {
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'ORD-1006',
        status: 'PAID',
        totalBV: new Prisma.Decimal(10000),
        distributorId: mockBuyerId,
      } as any);

      // Commission recorded at Level 7
      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue([
        {
          id: 'comm-7',
          orderId: mockOrderId,
          commissionLevel: 7,
          recipientMemberId: 'upline-1',
          grossCommissionAmount: new Prisma.Decimal(100),
          status: 'PAID',
          walletTransactionId: 'wtx-7',
          walletTransaction: { id: 'wtx-7', amount: new Prisma.Decimal(100) },
        },
      ] as any);
      vi.spyOn(prisma.commissionReversal, 'findMany').mockResolvedValue([]);

      const result = await CommissionReconciliationService.reconcileOrderCommission(mockOrderId);

      expect(result.hasDiscrepancies).toBe(true);
      const levelDisc = result.discrepancies.find((d) => d.type === 'INCORRECT_COMMISSION_LEVEL');
      expect(levelDisc).toBeDefined();
      expect(levelDisc?.level).toBe(7);
    });

    // 2.6 WALLET_MISMATCH (Missing link & Amount drift)
    it('should detect WALLET_MISMATCH when PAID commission has no wallet transaction link', async () => {
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'ORD-1007',
        status: 'PAID',
        totalBV: new Prisma.Decimal(10000),
        distributorId: mockBuyerId,
      } as any);

      // PAID commission with null walletTransactionId
      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue([
        {
          id: 'comm-1',
          orderId: mockOrderId,
          commissionLevel: 1,
          recipientMemberId: 'upline-1',
          grossCommissionAmount: new Prisma.Decimal(2400),
          status: 'PAID',
          walletTransactionId: null,
          walletTransaction: null,
        },
      ] as any);
      vi.spyOn(prisma.commissionReversal, 'findMany').mockResolvedValue([]);

      const result = await CommissionReconciliationService.reconcileOrderCommission(mockOrderId);

      expect(result.hasDiscrepancies).toBe(true);
      const walletDisc = result.discrepancies.find((d) => d.type === 'WALLET_MISMATCH');
      expect(walletDisc).toBeDefined();
      expect(walletDisc?.severity).toBe('CRITICAL');
      expect(walletDisc?.description).toContain('has no linked WalletTransaction record');
    });

    it('should detect WALLET_MISMATCH when wallet transaction amount drifts from commission amount', async () => {
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'ORD-1008',
        status: 'PAID',
        totalBV: new Prisma.Decimal(10000),
        distributorId: mockBuyerId,
      } as any);

      // Commission is ₹2,400, but linked wallet transaction credited ₹3,000
      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue([
        {
          id: 'comm-1',
          orderId: mockOrderId,
          commissionLevel: 1,
          recipientMemberId: 'upline-1',
          grossCommissionAmount: new Prisma.Decimal(2400),
          status: 'PAID',
          walletTransactionId: 'wtx-drift',
          walletTransaction: { id: 'wtx-drift', amount: new Prisma.Decimal(3000) },
        },
      ] as any);
      vi.spyOn(prisma.commissionReversal, 'findMany').mockResolvedValue([]);

      const result = await CommissionReconciliationService.reconcileOrderCommission(mockOrderId);

      expect(result.hasDiscrepancies).toBe(true);
      const walletAmountDisc = result.discrepancies.find(
        (d) => d.type === 'WALLET_MISMATCH' && d.expectedValue === 2400
      );
      expect(walletAmountDisc).toBeDefined();
      expect(walletAmountDisc?.actualValue).toBe(3000);
      expect(walletAmountDisc?.discrepancyAmount).toBe(600);
    });

    // 2.7 REVERSAL_MISMATCH (Unreversed & Over-reversal)
    it('should detect REVERSAL_MISMATCH when order is CANCELLED/REFUNDED but commissions remain unreversed', async () => {
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'ORD-1009',
        status: 'REFUNDED',
        totalBV: new Prisma.Decimal(10000),
        distributorId: mockBuyerId,
      } as any);

      // Order is refunded, but commission is still marked PAID
      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue([
        {
          id: 'comm-1',
          orderId: mockOrderId,
          commissionLevel: 1,
          recipientMemberId: 'upline-1',
          grossCommissionAmount: new Prisma.Decimal(2400),
          status: 'PAID',
          walletTransactionId: 'wtx-1',
          walletTransaction: { id: 'wtx-1', amount: new Prisma.Decimal(2400) },
        },
      ] as any);
      vi.spyOn(prisma.commissionReversal, 'findMany').mockResolvedValue([]);

      const result = await CommissionReconciliationService.reconcileOrderCommission(mockOrderId);

      expect(result.hasDiscrepancies).toBe(true);
      const revDisc = result.discrepancies.find((d) => d.type === 'REVERSAL_MISMATCH');
      expect(revDisc).toBeDefined();
      expect(revDisc?.severity).toBe('CRITICAL');
      expect(revDisc?.description).toContain('remain unreversed');
    });

    it('should detect REVERSAL_MISMATCH when reversal amount exceeds original commission amount', async () => {
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'ORD-1010',
        status: 'REFUNDED',
        totalBV: new Prisma.Decimal(10000),
        distributorId: mockBuyerId,
      } as any);

      // Original commission was ₹2,400 (marked REVERSED)
      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue([
        {
          id: 'comm-1',
          orderId: mockOrderId,
          commissionLevel: 1,
          recipientMemberId: 'upline-1',
          grossCommissionAmount: new Prisma.Decimal(2400),
          status: 'REVERSED',
          walletTransactionId: 'wtx-1',
          walletTransaction: { id: 'wtx-1', amount: new Prisma.Decimal(2400) },
        },
      ] as any);

      // Reversals logged sum to ₹3,500 (excessive reversal over-credit/debit)
      vi.spyOn(prisma.commissionReversal, 'findMany').mockResolvedValue([
        { id: 'rev-1', originalCommissionId: 'comm-1', amount: new Prisma.Decimal(2400) },
        { id: 'rev-2', originalCommissionId: 'comm-1', amount: new Prisma.Decimal(1100) },
      ] as any);

      const result = await CommissionReconciliationService.reconcileOrderCommission(mockOrderId);

      expect(result.hasDiscrepancies).toBe(true);
      const overRev = result.discrepancies.find((d) => d.type === 'REVERSAL_MISMATCH');
      expect(overRev).toBeDefined();
      expect(overRev?.expectedValue).toBe(2400);
      expect(overRev?.actualValue).toBe(3500);
      expect(overRev?.discrepancyAmount).toBe(1100);
    });
  });

  // =========================================================================
  // 3. NON-DESTRUCTIVE AUDIT INVARIANT VS SAFE AUTO-CORRECTION
  // =========================================================================
  describe('3. Non-Destructive Invariant vs Safe Auto-Correction', () => {
    it('should NEVER modify financial records during reconciliation by default', async () => {
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'ORD-1011',
        status: 'PAID',
        totalBV: new Prisma.Decimal(10000),
        distributorId: mockBuyerId,
      } as any);

      // Missing commissions
      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.commissionReversal, 'findMany').mockResolvedValue([]);

      const lifecycleSpy = vi.spyOn(OrderCommissionLifecycleService, 'processOrderCommission');

      // Call without autoCorrect (or autoCorrect: false)
      const result = await CommissionReconciliationService.reconcileOrderCommission(mockOrderId, {
        autoCorrect: false,
      });

      expect(result.hasDiscrepancies).toBe(true);
      expect(result.autoCorrected).toBe(false);
      expect(lifecycleSpy).not.toHaveBeenCalled();
    });

    it('should trigger safe automated correction only when explicitly requested and conditions are met', async () => {
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'ORD-1012',
        status: 'PAID',
        totalBV: new Prisma.Decimal(10000),
        distributorId: mockBuyerId,
      } as any);

      // Missing all commissions on paid order with BV
      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.commissionReversal, 'findMany').mockResolvedValue([]);

      const lifecycleSpy = vi.spyOn(OrderCommissionLifecycleService, 'processOrderCommission').mockResolvedValue({
        orderId: mockOrderId,
        status: 'SUCCESS',
        commissionsCreated: 5,
        totalCommission: 5400,
        isIdempotentSkip: false,
      } as any);

      // Explicitly pass autoCorrect: true
      const result = await CommissionReconciliationService.reconcileOrderCommission(mockOrderId, {
        autoCorrect: true,
      });

      expect(result.autoCorrected).toBe(true);
      expect(lifecycleSpy).toHaveBeenCalledWith(mockOrderId);
      expect(result.discrepancies.every((d) => d.correctionApplied === true)).toBe(true);
    });

    it('should NOT apply auto-correction if discrepancies contain non-missing anomalies (e.g. duplicate or imposter)', async () => {
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'ORD-1013',
        status: 'PAID',
        totalBV: new Prisma.Decimal(10000),
        distributorId: mockBuyerId,
      } as any);

      // Duplicate commissions exist
      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue([
        { id: 'c1', commissionLevel: 1, recipientMemberId: 'upline-1', grossCommissionAmount: new Prisma.Decimal(2400) },
        { id: 'c2', commissionLevel: 1, recipientMemberId: 'upline-1', grossCommissionAmount: new Prisma.Decimal(2400) },
      ] as any);
      vi.spyOn(prisma.commissionReversal, 'findMany').mockResolvedValue([]);

      const lifecycleSpy = vi.spyOn(OrderCommissionLifecycleService, 'processOrderCommission');

      const result = await CommissionReconciliationService.reconcileOrderCommission(mockOrderId, {
        autoCorrect: true,
      });

      expect(result.autoCorrected).toBe(false);
      expect(lifecycleSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. RECONCILE MEMBER COMMISSIONS & WALLET INTEGRITY
  // =========================================================================
  describe('4. Member Commissions & Wallet Ledger Reconciliation', () => {
    const mockMemberId = 'dist-member-001';

    it('should report zero discrepancies for a member with matching wallet and clean commissions', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: mockMemberId,
        distributorCode: 'DST-CLEAN',
        userId: 'usr-clean-1',
      } as any);

      vi.spyOn(prisma.wallet, 'findFirst').mockResolvedValue({
        id: 'wal-1',
        distributorId: mockMemberId,
        balance: new Prisma.Decimal(3200),
        availableBalance: new Prisma.Decimal(3200),
        transactions: [
          { id: 'wtx-1', type: 'COMMISSION', amount: new Prisma.Decimal(2400) },
          { id: 'wtx-2', type: 'CREDIT', amount: new Prisma.Decimal(800) },
        ],
      } as any);

      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue([
        {
          id: 'comm-m1',
          commissionLevel: 1,
          status: 'PAID',
          walletTransactionId: 'wtx-1',
          walletTransaction: { id: 'wtx-1' },
          reversals: [],
        },
      ] as any);

      const result = await CommissionReconciliationService.reconcileMemberCommissions(mockMemberId);

      expect(result.hasDiscrepancies).toBe(false);
      expect(result.discrepancyCount).toBe(0);
      expect(result.walletBalance).toBe(3200);
      expect(result.walletLedgerSum).toBe(3200);

      // Verify audit logging
      expect(AuditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COMMISSION_RECONCILIATION_MEMBER',
          entityType: 'DistributorProfile',
          entityId: mockMemberId,
        })
      );
    });

    it('should detect WALLET_MISMATCH when member wallet balance does not match transaction ledger sum', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: mockMemberId,
        distributorCode: 'DST-DRIFT',
        userId: 'usr-drift-1',
      } as any);

      // Balance is ₹15,000 but transactions sum to only ₹10,000 (₹5,000 unbacked drift)
      vi.spyOn(prisma.wallet, 'findFirst').mockResolvedValue({
        id: 'wal-drift',
        distributorId: mockMemberId,
        balance: new Prisma.Decimal(15000),
        availableBalance: new Prisma.Decimal(15000),
        transactions: [
          { id: 'wtx-1', type: 'COMMISSION', amount: new Prisma.Decimal(10000) },
        ],
      } as any);

      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue([]);

      const result = await CommissionReconciliationService.reconcileMemberCommissions(mockMemberId);

      expect(result.hasDiscrepancies).toBe(true);
      const driftDisc = result.discrepancies.find((d) => d.type === 'WALLET_MISMATCH');
      expect(driftDisc).toBeDefined();
      expect(driftDisc?.severity).toBe('CRITICAL');
      expect(driftDisc?.expectedValue).toBe(10000);
      expect(driftDisc?.actualValue).toBe(15000);
      expect(driftDisc?.discrepancyAmount).toBe(5000);
    });

    it('should detect negative wallet balance as a discrepancy', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: mockMemberId,
        distributorCode: 'DST-NEG',
        userId: 'usr-neg-1',
      } as any);

      vi.spyOn(prisma.wallet, 'findFirst').mockResolvedValue({
        id: 'wal-neg',
        distributorId: mockMemberId,
        balance: new Prisma.Decimal(-500),
        availableBalance: new Prisma.Decimal(-500),
        transactions: [],
      } as any);

      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue([]);

      const result = await CommissionReconciliationService.reconcileMemberCommissions(mockMemberId);

      expect(result.hasDiscrepancies).toBe(true);
      const negDisc = result.discrepancies.find((d) => d.id.includes('neg-wallet'));
      expect(negDisc).toBeDefined();
      expect(negDisc?.description).toContain('negative wallet balance');
    });
  });

  // =========================================================================
  // 5. RECONCILE COMMISSION PERIOD
  // =========================================================================
  describe('5. Period Commission Reconciliation', () => {
    it('should reconcile all orders in a date range and aggregate discrepancy statistics', async () => {
      const startDate = new Date('2026-03-01T00:00:00Z');
      const endDate = new Date('2026-03-31T23:59:59Z');

      vi.spyOn(prisma.order, 'findMany').mockResolvedValue([
        { id: 'ord-p1' },
        { id: 'ord-p2' },
      ] as any);

      vi.spyOn(prisma.commissionTransaction, 'count').mockResolvedValue(10);
      vi.spyOn(prisma.commissionReversal, 'count').mockResolvedValue(1);

      // Spy on reconcileOrderCommission to return mock results for each order
      const reconcileOrderSpy = vi.spyOn(CommissionReconciliationService, 'reconcileOrderCommission')
        .mockResolvedValueOnce({
          orderId: 'ord-p1',
          orderStatus: 'PAID',
          orderBV: 10000,
          expectedCommissionsCount: 5,
          actualCommissionsCount: 5,
          expectedTotalCommission: 5400,
          actualTotalCommission: 5400,
          hasDiscrepancies: false,
          discrepancyCount: 0,
          discrepancies: [],
          autoCorrected: false,
          reconciledAt: new Date(),
          durationMs: 10,
        })
        .mockResolvedValueOnce({
          orderId: 'ord-p2',
          orderStatus: 'PAID',
          orderBV: 1000,
          expectedCommissionsCount: 5,
          actualCommissionsCount: 4,
          expectedTotalCommission: 540,
          actualTotalCommission: 500,
          hasDiscrepancies: true,
          discrepancyCount: 1,
          discrepancies: [
            {
              id: 'disc-p2-missing',
              type: 'MISSING_COMMISSION',
              severity: 'HIGH',
              orderId: 'ord-p2',
              level: 5,
              expectedValue: 40,
              actualValue: 0,
              discrepancyAmount: 40,
              description: 'Missing commission for Level 5',
            },
          ],
          autoCorrected: false,
          reconciledAt: new Date(),
          durationMs: 15,
        });

      const result = await CommissionReconciliationService.reconcileCommissionPeriod(
        startDate,
        endDate
      );

      expect(result.ordersAnalyzed).toBe(2);
      expect(result.commissionsAnalyzed).toBe(10);
      expect(result.reversalsAnalyzed).toBe(1);
      expect(result.totalDiscrepancies).toBe(1);
      expect(result.discrepanciesByType.MISSING_COMMISSION).toBe(1);
      expect(result.ordersWithDiscrepancies).toEqual(['ord-p2']);

      // Verify audit logging
      expect(AuditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COMMISSION_RECONCILIATION_PERIOD',
          entityType: 'CommissionPeriod',
        })
      );
    });
  });

  // =========================================================================
  // 6. ADMIN-ONLY RBAC & API ENDPOINT SECURITY
  // =========================================================================
  describe('6. Admin-Only RBAC & HTTP Endpoints', () => {
    // 6.1 Order Reconcile Endpoint
    describe('POST /api/v1/admin/commissions/reconcile/order/:orderId', () => {
      it('should return 401 Unauthorized when unauthenticated', async () => {
        const res = await request(app)
          .post('/api/v1/admin/commissions/reconcile/order/ord-123')
          .send({});

        expect(res.status).toBe(401);
      });

      it('should return 403 Forbidden when called by a DISTRIBUTOR', async () => {
        const res = await request(app)
          .post('/api/v1/admin/commissions/reconcile/order/ord-123')
          .set('Authorization', `Bearer ${distributorToken}`)
          .send({});

        expect(res.status).toBe(403);
      });

      it('should return 403 Forbidden when called by a CUSTOMER', async () => {
        const res = await request(app)
          .post('/api/v1/admin/commissions/reconcile/order/ord-123')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({});

        expect(res.status).toBe(403);
      });

      it('should return 200 OK when called by an ADMIN', async () => {
        vi.spyOn(CommissionReconciliationService, 'reconcileOrderCommission').mockResolvedValue({
          orderId: 'ord-123',
          orderStatus: 'PAID',
          orderBV: 5000,
          expectedCommissionsCount: 5,
          actualCommissionsCount: 5,
          expectedTotalCommission: 2700,
          actualTotalCommission: 2700,
          hasDiscrepancies: false,
          discrepancyCount: 0,
          discrepancies: [],
          autoCorrected: false,
          reconciledAt: new Date(),
          durationMs: 8,
        });

        const res = await request(app)
          .post('/api/v1/admin/commissions/reconcile/order/ord-123')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ autoCorrect: false });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.orderId).toBe('ord-123');
      });
    });

    // 6.2 Member Reconcile Endpoint
    describe('POST /api/v1/admin/commissions/reconcile/member/:memberId', () => {
      it('should return 403 Forbidden for non-admin', async () => {
        const res = await request(app)
          .post('/api/v1/admin/commissions/reconcile/member/mem-123')
          .set('Authorization', `Bearer ${distributorToken}`)
          .send({});

        expect(res.status).toBe(403);
      });

      it('should return 200 OK for ADMIN', async () => {
        vi.spyOn(CommissionReconciliationService, 'reconcileMemberCommissions').mockResolvedValue({
          memberId: 'mem-123',
          distributorCode: 'DST-MEM',
          totalOrdersAnalyzed: 0,
          totalCommissionsAnalyzed: 5,
          walletBalance: 2000,
          walletLedgerSum: 2000,
          hasDiscrepancies: false,
          discrepancyCount: 0,
          discrepancies: [],
          reconciledAt: new Date(),
          durationMs: 12,
        });

        const res = await request(app)
          .post('/api/v1/admin/commissions/reconcile/member/mem-123')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({});

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.memberId).toBe('mem-123');
      });
    });

    // 6.3 Period Reconcile Endpoint
    describe('POST /api/v1/admin/commissions/reconcile/period', () => {
      it('should return 403 Forbidden for non-admin', async () => {
        const res = await request(app)
          .post('/api/v1/admin/commissions/reconcile/period')
          .set('Authorization', `Bearer ${distributorToken}`)
          .send({ startDate: '2026-03-01', endDate: '2026-03-31' });

        expect(res.status).toBe(403);
      });

      it('should return 400 Bad Request when dates are missing', async () => {
        const res = await request(app)
          .post('/api/v1/admin/commissions/reconcile/period')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({});

        expect(res.status).toBe(400);
      });

      it('should return 200 OK for valid period query by ADMIN', async () => {
        vi.spyOn(CommissionReconciliationService, 'reconcileCommissionPeriod').mockResolvedValue({
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-03-31'),
          ordersAnalyzed: 15,
          commissionsAnalyzed: 75,
          reversalsAnalyzed: 2,
          totalDiscrepancies: 0,
          discrepanciesByType: {
            MISSING_COMMISSION: 0,
            DUPLICATE_COMMISSION: 0,
            INCORRECT_COMMISSION_AMOUNT: 0,
            INCORRECT_RECIPIENT: 0,
            INCORRECT_COMMISSION_LEVEL: 0,
            WALLET_MISMATCH: 0,
            REVERSAL_MISMATCH: 0,
          },
          ordersWithDiscrepancies: [],
          discrepancies: [],
          reconciledAt: new Date(),
          durationMs: 45,
        });

        const res = await request(app)
          .post('/api/v1/admin/commissions/reconcile/period')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ startDate: '2026-03-01', endDate: '2026-03-31' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.ordersAnalyzed).toBe(15);
      });
    });
  });

  // =========================================================================
  // 7. INPUT VALIDATION & ERROR HANDLING
  // =========================================================================
  describe('7. Validation & Error Handling', () => {
    it('should reject invalid or empty orderId with 400 Bad Request', async () => {
      await expect(
        CommissionReconciliationService.reconcileOrderCommission('')
      ).rejects.toThrow('Valid orderId is required');

      await expect(
        CommissionReconciliationService.reconcileOrderCommission('   ')
      ).rejects.toThrow('Valid orderId is required');
    });

    it('should throw 404 AppError when order does not exist', async () => {
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue(null);

      await expect(
        CommissionReconciliationService.reconcileOrderCommission('non-existent-ord')
      ).rejects.toThrow("Order 'non-existent-ord' not found");
    });

    it('should reject invalid memberId with 400 Bad Request', async () => {
      await expect(
        CommissionReconciliationService.reconcileMemberCommissions('')
      ).rejects.toThrow('Valid memberId is required');
    });

    it('should throw 404 AppError when member does not exist', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(null);

      await expect(
        CommissionReconciliationService.reconcileMemberCommissions('non-existent-member')
      ).rejects.toThrow("Member 'non-existent-member' not found");
    });

    it('should reject invalid date range strings in reconcileCommissionPeriod with 400 Bad Request', async () => {
      await expect(
        CommissionReconciliationService.reconcileCommissionPeriod('invalid-date', '2026-03-31')
      ).rejects.toThrow('Invalid startDate or endDate provided');
    });
  });
});
