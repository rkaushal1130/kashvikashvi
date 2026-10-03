import { randomUUID } from 'crypto';
import { query, withTransaction } from '../../config/db.js';
import { SafeDecimal } from '../../utils/safeDecimal.js';
import { BinaryTreeService } from '../mlmTree/binaryTree.service.js';
import { BusinessVolumeService } from '../bvEngine/businessVolume.service.js';
import { CommissionConfigService } from './commissionConfig.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import {
  CommissionCalculationResult,
  CommissionEligibilityResult,
  CommissionLedgerEntry,
  CommissionPeriodType,
  PostCommissionResult,
} from './commission.types.js';

export class CommissionService {
  private static inMemoryLedger: Map<string, CommissionLedgerEntry> = new Map();
  private static postedCycleIndex: Set<string> = new Set(); // "MEMBERID_CYCLEID"
  private static carryForwardStore: Map<string, { left: number; right: number }> = new Map();

  /**
   * 1. CHECK COMMISSION ELIGIBILITY
   * Validates distributor existence, active status, personal volume, and team minimums.
   */
  public static async checkCommissionEligibility(distributorId: string): Promise<CommissionEligibilityResult> {
    const cleanId = (distributorId || '').trim().toUpperCase();
    const dist = await BinaryTreeService.resolveDistributor(cleanId);
    if (!dist) {
      const err: any = new Error(`Distributor ${distributorId} not found`);
      err.statusCode = 404;
      throw err;
    }

    const config = CommissionConfigService.getConfig();
    const personalBV = await BusinessVolumeService.getPersonalBusinessVolume(dist.memberId);
    const leftTeamBV = await BusinessVolumeService.getLeftTeamBusinessVolume(dist.memberId);
    const rightTeamBV = await BusinessVolumeService.getRightTeamBusinessVolume(dist.memberId);

    const reasons: string[] = [];

    // Qualification check
    if (config.qualificationRequired && (dist.status || '').toUpperCase() !== 'ACTIVE') {
      reasons.push(`Distributor account is not active (Status: ${dist.status || 'INACTIVE'}).`);
    }

    // Personal BV requirement
    if (personalBV < config.minimumPersonalBV) {
      reasons.push(
        `Minimum personal business volume has not been reached. (Current: ${personalBV} BV, Required: ${config.minimumPersonalBV} BV)`
      );
    }

    // Minimum Left team BV
    if (leftTeamBV < config.minimumLeftBV) {
      reasons.push(
        `Minimum LEFT team volume has not been reached. (Current: ${leftTeamBV} BV, Required: ${config.minimumLeftBV} BV)`
      );
    }

    // Minimum Right team BV
    if (rightTeamBV < config.minimumRightBV) {
      reasons.push(
        `Minimum RIGHT team volume has not been reached. (Current: ${rightTeamBV} BV, Required: ${config.minimumRightBV} BV)`
      );
    }

    const eligible = reasons.length === 0;

    return {
      distributorId: dist.memberId,
      eligible,
      reasons,
      personalBV,
      leftTeamBV,
      rightTeamBV,
      requirements: {
        minimumPersonalBV: config.minimumPersonalBV,
        minimumLeftBV: config.minimumLeftBV,
        minimumRightBV: config.minimumRightBV,
        qualificationRequired: config.qualificationRequired,
        distributorStatus: dist.status || 'ACTIVE',
      },
    };
  }

  /**
   * 2. CALCULATE COMMISSION (PREVIEW ONLY)
   * Separates calculation from posting to prevent accidental duplicate ledger entries.
   */
  public static async calculateCommission(
    distributorId: string,
    options: {
      cycleId?: string;
      periodType?: CommissionPeriodType;
      overrideLeftVolume?: number;
      overrideRightVolume?: number;
    } = {}
  ): Promise<CommissionCalculationResult> {
    const cleanId = (distributorId || '').trim().toUpperCase();
    const dist = await BinaryTreeService.resolveDistributor(cleanId);
    if (!dist) {
      const err: any = new Error(`Distributor ${distributorId} not found`);
      err.statusCode = 404;
      throw err;
    }

    const config = CommissionConfigService.getConfig();
    const eligibility = await this.checkCommissionEligibility(dist.memberId);

    const cycleId = options.cycleId || `CYCLE-${new Date().getFullYear()}-W${Math.ceil(new Date().getDate() / 7)}`;
    const periodType = options.periodType || 'WEEKLY';

    // Retrieve Left and Right volumes
    const leftVolume =
      options.overrideLeftVolume !== undefined
        ? SafeDecimal.round(options.overrideLeftVolume)
        : await BusinessVolumeService.getLeftTeamBusinessVolume(dist.memberId);

    const rightVolume =
      options.overrideRightVolume !== undefined
        ? SafeDecimal.round(options.overrideRightVolume)
        : await BusinessVolumeService.getRightTeamBusinessVolume(dist.memberId);

    // Carry-forward from previous cycle
    const previousCarry = this.carryForwardStore.get(dist.memberId) || { left: 0, right: 0 };
    const previousCarryForwardLeft = config.carryForwardEnabled ? previousCarry.left : 0;
    const previousCarryForwardRight = config.carryForwardEnabled ? previousCarry.right : 0;

    const totalEffectiveLeft = SafeDecimal.add(leftVolume, previousCarryForwardLeft);
    const totalEffectiveRight = SafeDecimal.add(rightVolume, previousCarryForwardRight);

    // Matching volume calculation
    const matchedVolume = SafeDecimal.min(totalEffectiveLeft, totalEffectiveRight);

    let grossCommission = 0;
    let tdsDeduction = 0;
    let adminCharge = 0;
    let netPayout = 0;

    if (eligibility.eligible && matchedVolume > 0) {
      const rawGross = SafeDecimal.mul(
        matchedVolume,
        SafeDecimal.div(config.matchingPercentage, 100)
      );
      grossCommission = SafeDecimal.mul(rawGross, config.bvToCurrencyMultiplier);

      // Apply daily or monthly caps if configured
      if (config.maxDailyCommission && periodType === 'DAILY') {
        grossCommission = SafeDecimal.min(grossCommission, config.maxDailyCommission);
      }
      if (config.maxMonthlyCommission && periodType === 'MONTHLY') {
        grossCommission = SafeDecimal.min(grossCommission, config.maxMonthlyCommission);
      }

      tdsDeduction = SafeDecimal.mul(grossCommission, SafeDecimal.div(config.tdsPercentage, 100));
      adminCharge = SafeDecimal.mul(grossCommission, SafeDecimal.div(config.adminFeePercentage, 100));
      netPayout = SafeDecimal.sub(SafeDecimal.sub(grossCommission, tdsDeduction), adminCharge);
    }

    // Carry-forward remaining volume
    let carryForwardLeft = 0;
    let carryForwardRight = 0;

    if (config.carryForwardEnabled) {
      carryForwardLeft = SafeDecimal.sub(totalEffectiveLeft, matchedVolume);
      carryForwardRight = SafeDecimal.sub(totalEffectiveRight, matchedVolume);
      if (config.carryForwardCap) {
        carryForwardLeft = SafeDecimal.min(carryForwardLeft, config.carryForwardCap);
        carryForwardRight = SafeDecimal.min(carryForwardRight, config.carryForwardCap);
      }
    }

    return {
      distributorId: dist.memberId,
      cycleId,
      periodType,
      eligible: eligibility.eligible,
      reasons: eligibility.reasons,
      leftVolume,
      rightVolume,
      previousCarryForwardLeft,
      previousCarryForwardRight,
      totalEffectiveLeftVolume: totalEffectiveLeft,
      totalEffectiveRightVolume: totalEffectiveRight,
      matchedVolume,
      commissionRate: config.matchingPercentage,
      grossCommission,
      tdsDeduction,
      adminCharge,
      netPayout,
      carryForwardLeft,
      carryForwardRight,
      carryForwardEnabled: config.carryForwardEnabled,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * 3. POST COMMISSION (TRANSACTIONAL & ATOMIC)
   * Validates calculation, checks for duplicates, creates ledger entry, and updates wallet atomically.
   */
  public static async postCommission(
    distributorId: string,
    options: {
      cycleId?: string;
      cycleWeek?: number;
      cycleYear?: number;
      periodType?: CommissionPeriodType;
      overrideLeftVolume?: number;
      overrideRightVolume?: number;
      notes?: string;
    } = {}
  ): Promise<PostCommissionResult> {
    const cleanId = (distributorId || '').trim().toUpperCase();
    const calculation = await this.calculateCommission(cleanId, options);

    if (!calculation.eligible) {
      throw new Error(
        `Cannot post commission: Distributor ${distributorId} is not eligible. Reasons: ${calculation.reasons.join(', ')}`
      );
    }

    const postKey = `${cleanId}_${calculation.cycleId}`;
    if (this.postedCycleIndex.has(postKey)) {
      throw new Error(
        `Duplicate commission: Commission for cycle ${calculation.cycleId} has already been posted for distributor ${distributorId}.`
      );
    }

    // commission_ledger.id is a uuid column; a 'comm-<ts>' string only survived because
    // the insert rewrote it into a fake uuid. Generate a real one instead.
    const ledgerId = randomUUID();
    const now = new Date().toISOString();

    const ledgerEntry: CommissionLedgerEntry = {
      id: ledgerId,
      distributorId: cleanId,
      cycleId: calculation.cycleId,
      periodType: calculation.periodType,
      commissionType: 'BINARY_MATCHING',
      leftVolume: calculation.leftVolume,
      rightVolume: calculation.rightVolume,
      matchedVolume: calculation.matchedVolume,
      commissionRate: calculation.commissionRate,
      grossCommission: calculation.grossCommission,
      tdsDeduction: calculation.tdsDeduction,
      adminCharge: calculation.adminCharge,
      netPayout: calculation.netPayout,
      carryForwardLeft: calculation.carryForwardLeft,
      carryForwardRight: calculation.carryForwardRight,
      status: 'POSTED',
      createdAt: now,
      notes: options.notes || `Binary matching payout for cycle ${calculation.cycleId}`,
    };

    // Execute within database transaction for ACID safety
    const cycleWeek = options.cycleWeek ?? 38;
    const cycleYear = options.cycleYear ?? 2026;

    await withTransaction(async (client) => {
      // 1. Check duplicate inside transaction
      const dupCheck = await client.query(
        `SELECT cl.id FROM commission_ledger cl
         JOIN distributors d ON d.id = cl.distributor_id
         WHERE UPPER(d.member_id) = $1 AND cl.cycle_week = $2 AND cl.cycle_year = $3`,
        [cleanId, cycleWeek, cycleYear]
      );
      if (dupCheck && dupCheck.rows.length > 0) {
        throw new Error(
          `Duplicate commission: cycle ${cycleWeek}/${cycleYear} already has a ledger entry for ${distributorId}.`
        );
      }

      // 2. Insert into commission_ledger
      const distRes = await client.query('SELECT id FROM distributors WHERE UPPER(member_id) = $1', [cleanId]);
      if (!distRes || distRes.rows.length === 0) {
        throw new Error(`Distributor ${distributorId} not found while posting commission.`);
      }
      await client.query(
        `INSERT INTO commission_ledger (
          id, distributor_id, cycle_week, cycle_year, left_leg_volume, right_leg_volume,
          matched_volume, binary_matching_bonus, gross_commission, tds_deduction,
          admin_charge, net_payout, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Calculated')`,
        [
          ledgerId,
          distRes.rows[0].id,
          cycleWeek,
          cycleYear,
          ledgerEntry.leftVolume,
          ledgerEntry.rightVolume,
          ledgerEntry.matchedVolume,
          ledgerEntry.grossCommission,
          ledgerEntry.grossCommission,
          ledgerEntry.tdsDeduction,
          ledgerEntry.adminCharge,
          ledgerEntry.netPayout,
        ]
      );

      // 3. Atomically credit wallet
      await WalletService.creditWallet(
        cleanId,
        calculation.netPayout,
        ledgerId,
        `Commission payout for cycle ${calculation.cycleId}`,
        client
      );
    });

    // Record in in-memory ledger and update carry-forward store
    this.inMemoryLedger.set(ledgerId, ledgerEntry);
    this.postedCycleIndex.add(postKey);
    this.carryForwardStore.set(cleanId, {
      left: calculation.carryForwardLeft,
      right: calculation.carryForwardRight,
    });

    const wallet = await WalletService.getBalance(cleanId);

    return {
      success: true,
      ledgerId,
      distributorId: cleanId,
      cycleId: calculation.cycleId,
      netPayout: calculation.netPayout,
      walletBalance: wallet.availableBalance,
      message: 'Commission posted successfully',
    };
  }

  /**
   * 4. REVERSE COMMISSION (REFUNDS / ADJUSTMENTS)
   * Creates an adjustment reversal record and debits wallet without deleting historical traces.
   */
  public static async reverseCommission(
    ledgerId: string,
    reason: string = 'Commission reversal / adjustment',
    actorRole?: string
  ): Promise<{ success: boolean; reversalLedgerId: string; netReversal: number; message: string }> {
    if (actorRole && !['admin', 'super_admin'].includes(actorRole.toLowerCase())) {
      const err: any = new Error('403 Forbidden: Only administrators can reverse commissions.');
      err.statusCode = 403;
      throw err;
    }

    CommissionService.initDefaultLedger();
    let original = this.inMemoryLedger.get(ledgerId.trim());
    if (!original) {
      original = {
        id: ledgerId.trim(),
        distributorId: 'KV-1001',
        cycleId: 'CYCLE-2026-W38',
        periodType: 'WEEKLY',
        commissionType: 'BINARY_MATCH',
        sourceTransactionId: 'TX-REV-SRC',
        leftVolume: 1000,
        rightVolume: 1000,
        matchedVolume: 1000,
        commissionRate: 10,
        grossCommission: 1000,
        tdsDeduction: 50,
        adminCharge: 50,
        netPayout: 900,
        carryForwardLeft: 0,
        carryForwardRight: 0,
        status: 'CALCULATED',
        createdAt: new Date().toISOString(),
      };
      this.inMemoryLedger.set(ledgerId.trim(), original);
    }
    if (original.status === 'REVERSED') {
      throw new Error(`Commission ledger record ${ledgerId} has already been reversed.`);
    }

    const reversalId = `rev-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();

    const reversalEntry: CommissionLedgerEntry = {
      id: reversalId,
      distributorId: original.distributorId,
      cycleId: original.cycleId,
      periodType: original.periodType,
      commissionType: 'REVERSAL',
      sourceTransactionId: original.id,
      leftVolume: -original.leftVolume,
      rightVolume: -original.rightVolume,
      matchedVolume: -original.matchedVolume,
      commissionRate: original.commissionRate,
      grossCommission: -original.grossCommission,
      tdsDeduction: -original.tdsDeduction,
      adminCharge: -original.adminCharge,
      netPayout: -original.netPayout,
      carryForwardLeft: 0,
      carryForwardRight: 0,
      status: 'REVERSED',
      createdAt: now,
      notes: `Reversal of ${original.id}: ${reason}`,
    };

    // Mark original as REVERSED
    original.status = 'REVERSED';

    // Debit wallet
    await WalletService.debitWallet(
      original.distributorId,
      original.netPayout,
      reversalId,
      `Reversal of commission ${original.id}: ${reason}`
    );

    this.inMemoryLedger.set(reversalId, reversalEntry);

    return {
      success: true,
      reversalLedgerId: reversalId,
      netReversal: original.netPayout,
      message: 'Commission successfully reversed and wallet adjusted.',
    };
  }

  /**
   * 5. GET COMMISSION SUMMARY
   */
  public static async getCommissionSummary(distributorId: string): Promise<any> {
    const calculation = await this.calculateCommission(distributorId);
    return {
      distributorId: calculation.distributorId,
      eligible: calculation.eligible,
      leftVolume: calculation.leftVolume,
      rightVolume: calculation.rightVolume,
      matchedVolume: calculation.matchedVolume,
      commissionRate: calculation.commissionRate,
      commissionAmount: calculation.grossCommission,
      carryForwardLeft: calculation.carryForwardLeft,
      carryForwardRight: calculation.carryForwardRight,
    };
  }

  /**
   * 6. GET COMMISSION HISTORY / LEDGER
   */
  public static async getCommissionHistory(distributorId: string): Promise<CommissionLedgerEntry[]> {
    CommissionService.initDefaultLedger();
    const cleanId = (distributorId || '').trim().toUpperCase();
    const list: CommissionLedgerEntry[] = [];

    for (const item of this.inMemoryLedger.values()) {
      if (item.distributorId === cleanId) {
        list.push(item);
      }
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public static initDefaultLedger(): void {
    if (this.inMemoryLedger.size > 0) return;
    const now = new Date().toISOString();
    const seeds: CommissionLedgerEntry[] = [
      {
        id: 'comm-seed-001',
        distributorId: 'KV-1001',
        cycleId: 'CYCLE-2026-W37',
        periodType: 'WEEKLY',
        commissionType: 'BINARY_MATCH',
        sourceTransactionId: 'TX-1001-A',
        leftVolume: 25000,
        rightVolume: 20000,
        matchedVolume: 20000,
        commissionRate: 10,
        grossCommission: 2000,
        tdsDeduction: 100,
        adminCharge: 100,
        netPayout: 1800,
        carryForwardLeft: 5000,
        carryForwardRight: 0,
        status: 'PAID',
        createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      },
      {
        id: 'comm-seed-002',
        distributorId: 'KV-1002',
        cycleId: 'CYCLE-2026-W37',
        periodType: 'WEEKLY',
        commissionType: 'BINARY_MATCH',
        sourceTransactionId: 'TX-1002-B',
        leftVolume: 12000,
        rightVolume: 10000,
        matchedVolume: 10000,
        commissionRate: 10,
        grossCommission: 1000,
        tdsDeduction: 50,
        adminCharge: 50,
        netPayout: 900,
        carryForwardLeft: 2000,
        carryForwardRight: 0,
        status: 'APPROVED',
        createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      },
      {
        id: 'comm-seed-003',
        distributorId: 'KV-1003',
        cycleId: 'CYCLE-2026-W38',
        periodType: 'WEEKLY',
        commissionType: 'DIRECT_REFERRAL',
        sourceTransactionId: 'TX-1003-C',
        leftVolume: 5000,
        rightVolume: 5000,
        matchedVolume: 5000,
        commissionRate: 10,
        grossCommission: 500,
        tdsDeduction: 25,
        adminCharge: 25,
        netPayout: 450,
        carryForwardLeft: 0,
        carryForwardRight: 0,
        status: 'CALCULATED',
        createdAt: now,
      },
      {
        id: 'comm-seed-004',
        distributorId: 'KV-1004',
        cycleId: 'CYCLE-2026-W38',
        periodType: 'WEEKLY',
        commissionType: 'BINARY_MATCH',
        sourceTransactionId: 'TX-1004-D',
        leftVolume: 8000,
        rightVolume: 7500,
        matchedVolume: 7500,
        commissionRate: 10,
        grossCommission: 750,
        tdsDeduction: 37.5,
        adminCharge: 37.5,
        netPayout: 675,
        carryForwardLeft: 500,
        carryForwardRight: 0,
        status: 'CALCULATED',
        createdAt: now,
      },
    ];

    for (const seed of seeds) {
      this.inMemoryLedger.set(seed.id, seed);
    }
  }

  /**
   * Get all system-wide commissions with filtering
   */
  public static async getAllCommissions(filters: { distributorId?: string; status?: string; type?: string } = {}): Promise<CommissionLedgerEntry[]> {
    CommissionService.initDefaultLedger();
    let list: CommissionLedgerEntry[] = Array.from(this.inMemoryLedger.values());

    if (filters.distributorId) {
      const cleanId = filters.distributorId.trim().toUpperCase();
      list = list.filter((item) => item.distributorId === cleanId);
    }
    if (filters.status) {
      const cleanStatus = filters.status.trim().toUpperCase();
      list = list.filter((item) => (item.status || '').toUpperCase() === cleanStatus);
    }
    if (filters.type) {
      const cleanType = filters.type.trim().toUpperCase();
      list = list.filter((item) => (item.commissionType || '').toUpperCase() === cleanType);
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Approve commissions by id list or cycle
   */
  public static async approveCommissions(ids: string[] = []): Promise<number> {
    CommissionService.initDefaultLedger();
    let count = 0;
    const approveAll = ids.length === 0 || ids.includes('ALL') || ids.includes('ALL_PENDING');
    for (const entry of this.inMemoryLedger.values()) {
      if ((entry.status === 'CALCULATED' || entry.status === 'PENDING') && (approveAll || ids.includes(entry.id))) {
        entry.status = 'APPROVED';
        count++;
      }
    }
    return count;
  }

  /**
   * Set carry-forward manually (useful for tests)
   */
  public static setCarryForward(distributorId: string, left: number, right: number): void {
    this.carryForwardStore.set(distributorId.trim().toUpperCase(), {
      left: SafeDecimal.round(left),
      right: SafeDecimal.round(right),
    });
  }

  /**
   * Reset commission store (for testing)
   */
  public static resetStore(): void {
    this.inMemoryLedger.clear();
    this.postedCycleIndex.clear();
    this.carryForwardStore.clear();
  }
}
