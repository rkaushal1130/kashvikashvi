import { query } from '../../config/db.js';
import { SafeDecimal } from '../../utils/safeDecimal.js';
import { BinaryTreeService } from '../mlmTree/binaryTree.service.js';
import {
  BvTransaction,
  CreateBvTransactionInput,
  BvSummaryResult,
  TeamVolumeResult,
  BvTransactionStatus,
} from './businessVolume.types.js';

export class BusinessVolumeService {
  private static inMemoryTransactions: Map<string, BvTransaction> = new Map();
  private static orderIndex: Map<string, string> = new Map(); // orderId -> transactionId
  private static initialized: boolean = false;

  public static initDefaultTransactions(): void {
    if (this.initialized && this.inMemoryTransactions.size > 0) return;
    this.inMemoryTransactions.clear();
    this.orderIndex.clear();

    // Default development seed transactions as specified in Prompt 5
    // Network:
    // A (KV-1001) - Personal: 5000 BV
    //   Left: B (KV-1002) - Personal: 1000 BV
    //     Left: D (KV-1004) - Personal: 2000 BV
    //     Right: E (KV-1005) - Personal: 1500 BV
    //   Right: C (KV-1003) - Personal: 1500 BV
    //     Left: F (KV-1006) - Personal: 2000 BV
    //     Right: G (KV-1007) - Personal: 1000 BV
    const defaultSeed: CreateBvTransactionInput[] = [
      {
        distributorId: 'KV-1001',
        orderId: 'ORD-1001-A',
        amount: 25000.0,
        businessVolume: 5000.0,
        type: 'PERSONAL_ORDER',
        status: 'APPROVED',
        description: 'Wholesale product order for Rahul Kaushal',
      },
      {
        distributorId: 'KV-1002',
        orderId: 'ORD-1002-B',
        amount: 5000.0,
        businessVolume: 1000.0,
        type: 'PERSONAL_ORDER',
        status: 'APPROVED',
        description: 'Wholesale order for Amit Patel',
      },
      {
        distributorId: 'KV-1004',
        orderId: 'ORD-1004-D',
        amount: 10000.0,
        businessVolume: 2000.0,
        type: 'PERSONAL_ORDER',
        status: 'APPROVED',
        description: 'Wholesale order for Priya Sharma',
      },
      {
        distributorId: 'KV-1005',
        orderId: 'ORD-1005-E',
        amount: 7500.0,
        businessVolume: 1500.0,
        type: 'PERSONAL_ORDER',
        status: 'APPROVED',
        description: 'Wholesale order for Pooja Gupta',
      },
      {
        distributorId: 'KV-1003',
        orderId: 'ORD-1003-C',
        amount: 7500.0,
        businessVolume: 1500.0,
        type: 'PERSONAL_ORDER',
        status: 'APPROVED',
        description: 'Wholesale order for Rohit Verma',
      },
      {
        distributorId: 'KV-1006',
        orderId: 'ORD-1006-F',
        amount: 10000.0,
        businessVolume: 2000.0,
        type: 'PERSONAL_ORDER',
        status: 'APPROVED',
        description: 'Wholesale order for Neha Mehta',
      },
      {
        distributorId: 'KV-1007',
        orderId: 'ORD-1007-G',
        amount: 5000.0,
        businessVolume: 1000.0,
        type: 'PERSONAL_ORDER',
        status: 'APPROVED',
        description: 'Wholesale order for Suresh Rao',
      },
    ];

    for (const item of defaultSeed) {
      this.recordInMemory(item);
    }
    this.initialized = true;
  }

  private static recordInMemory(input: CreateBvTransactionInput): BvTransaction {
    const id = `bv-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const orderId = input.orderId || `ORD-${Date.now()}`;
    const now = new Date().toISOString();

    const tx: BvTransaction = {
      id,
      distributorId: input.distributorId.trim().toUpperCase(),
      orderId,
      amount: SafeDecimal.round(input.amount),
      businessVolume: SafeDecimal.round(input.businessVolume),
      type: input.type || 'PERSONAL_ORDER',
      status: input.status || 'APPROVED',
      createdAt: now,
      updatedAt: now,
      description: input.description,
    };

    this.inMemoryTransactions.set(tx.id, tx);
    this.orderIndex.set(orderId, tx.id);
    return tx;
  }

  /**
   * 1. RECORD BUSINESS VOLUME
   * Records a business volume transaction with duplicate protection by orderId.
   */
  public static async recordBusinessVolume(input: CreateBvTransactionInput): Promise<BvTransaction> {
    BusinessVolumeService.initDefaultTransactions();

    if (!input.distributorId || !input.distributorId.trim()) {
      throw new Error('Distributor ID is required to record business volume.');
    }
    if (input.businessVolume === undefined || input.businessVolume === null || isNaN(input.businessVolume)) {
      throw new Error('Business volume must be a valid number.');
    }
    if (input.businessVolume < 0) {
      throw new Error('Business volume cannot be negative.');
    }

    const cleanMemberId = input.distributorId.trim().toUpperCase();
    const cleanOrderId = (input.orderId || `ORD-${Date.now()}`).trim();

    // Duplicate check on orderId
    if (this.orderIndex.has(cleanOrderId)) {
      throw new Error(`Duplicate transaction: Order ID ${cleanOrderId} has already been processed.`);
    }

    // Try DB insertion if available
    try {
      const distRes = await query(
        `SELECT id, member_id FROM distributors WHERE UPPER(member_id) = $1 OR id::text = $1`,
        [cleanMemberId]
      );

      if (distRes && distRes.rows.length > 0) {
        const dist = distRes.rows[0];
        const res = await query(
          `INSERT INTO bv_ledger (
            distributor_id, transaction_type, leg_affected, amount_bv,
            left_leg_total, right_leg_total, carryover_left, carryover_right,
            cycle_week, cycle_year, description
          ) VALUES ($1, $2, $3, $4, 0, 0, 0, 0, 38, 2026, $5)
          RETURNING id, created_at`,
          [
            dist.id,
            input.type || 'Personal_Order',
            'personal',
            SafeDecimal.round(input.businessVolume),
            input.description || `Order ${cleanOrderId}`,
          ]
        );

        if (res && res.rows.length > 0) {
          const now = res.rows[0].created_at ? new Date(res.rows[0].created_at).toISOString() : new Date().toISOString();
          const tx: BvTransaction = {
            id: res.rows[0].id,
            distributorId: dist.member_id,
            distributorDbId: dist.id,
            orderId: cleanOrderId,
            amount: SafeDecimal.round(input.amount),
            businessVolume: SafeDecimal.round(input.businessVolume),
            type: input.type || 'PERSONAL_ORDER',
            status: input.status || 'APPROVED',
            createdAt: now,
            updatedAt: now,
            description: input.description,
          };
          this.inMemoryTransactions.set(tx.id, tx);
          this.orderIndex.set(cleanOrderId, tx.id);
          return tx;
        }
      }
    } catch {
      // In-memory fallback
    }

    return this.recordInMemory({
      ...input,
      distributorId: cleanMemberId,
      orderId: cleanOrderId,
    });
  }

  /**
   * 2. PERSONAL BUSINESS VOLUME
   * Returns total eligible personal business volume for the distributor (excludes downline).
   * Only APPROVED transactions are counted.
   */
  public static async getPersonalBusinessVolume(distributorId: string): Promise<number> {
    BusinessVolumeService.initDefaultTransactions();
    const cleanId = (distributorId || '').trim().toUpperCase();

    // Check DB
    try {
      const distRes = await query(
        `SELECT id, member_id, current_psv FROM distributors WHERE UPPER(member_id) = $1 OR id::text = $1`,
        [cleanId]
      );
      if (distRes && distRes.rows.length > 0) {
        const distId = distRes.rows[0].id;
        const sumRes = await query(
          `SELECT COALESCE(SUM(amount_bv), 0) AS total_bv
           FROM bv_ledger
           WHERE distributor_id = $1 AND transaction_type IN ('Personal_Order', 'PERSONAL_ORDER')`,
          [distId]
        );
        if (sumRes && sumRes.rows.length > 0 && parseFloat(sumRes.rows[0].total_bv) > 0) {
          return SafeDecimal.round(sumRes.rows[0].total_bv);
        }
      }
    } catch {
      // Fallback
    }

    // In-memory accumulation
    let total = 0;
    for (const tx of this.inMemoryTransactions.values()) {
      if (tx.distributorId === cleanId && tx.status === 'APPROVED') {
        if (tx.type === 'REFUND_REVERSAL') {
          total = SafeDecimal.sub(total, tx.businessVolume);
        } else {
          total = SafeDecimal.add(total, tx.businessVolume);
        }
      }
    }
    return SafeDecimal.round(Math.max(0, total));
  }

  /**
   * 3. LEFT TEAM BUSINESS VOLUME
   * Calculates eligible volume generated by the complete LEFT subtree (excludes self).
   */
  public static async getLeftTeamBusinessVolume(distributorId: string): Promise<number> {
    BusinessVolumeService.initDefaultTransactions();
    const leftDownline = await BinaryTreeService.getLeftDownline(distributorId, { limit: 1000 });

    let leftTeamBV = 0;
    for (const member of leftDownline.data) {
      const memberPersonalBV = await this.getPersonalBusinessVolume(member.distributorId);
      leftTeamBV = SafeDecimal.add(leftTeamBV, memberPersonalBV);
    }

    return SafeDecimal.round(leftTeamBV);
  }

  /**
   * 4. RIGHT TEAM BUSINESS VOLUME
   * Calculates eligible volume generated by the complete RIGHT subtree (excludes self).
   */
  public static async getRightTeamBusinessVolume(distributorId: string): Promise<number> {
    BusinessVolumeService.initDefaultTransactions();
    const rightDownline = await BinaryTreeService.getRightDownline(distributorId, { limit: 1000 });

    let rightTeamBV = 0;
    for (const member of rightDownline.data) {
      const memberPersonalBV = await this.getPersonalBusinessVolume(member.distributorId);
      rightTeamBV = SafeDecimal.add(rightTeamBV, memberPersonalBV);
    }

    return SafeDecimal.round(rightTeamBV);
  }

  /**
   * 5. TOTAL TEAM BUSINESS VOLUME
   * Formula: Total Team BV = LEFT Team BV + RIGHT Team BV (Excludes personal BV).
   */
  public static async getTotalTeamBusinessVolume(distributorId: string): Promise<number> {
    const leftBV = await this.getLeftTeamBusinessVolume(distributorId);
    const rightBV = await this.getRightTeamBusinessVolume(distributorId);
    return SafeDecimal.add(leftBV, rightBV);
  }

  /**
   * 6. BUSINESS VOLUME SUMMARY
   * Returns comprehensive volume breakdown:
   * - personalBV
   * - leftTeamBV
   * - rightTeamBV
   * - totalTeamBV
   * - totalNetworkBV (personalBV + totalTeamBV)
   */
  public static async getBusinessVolumeSummary(distributorId: string): Promise<BvSummaryResult> {
    const cleanId = (distributorId || '').trim().toUpperCase();
    const dist = await BinaryTreeService.resolveDistributor(cleanId);
    if (!dist) {
      const err: any = new Error(`Distributor ${distributorId} not found`);
      err.statusCode = 404;
      throw err;
    }

    const personalBV = await this.getPersonalBusinessVolume(dist.memberId);
    const leftTeamBV = await this.getLeftTeamBusinessVolume(dist.memberId);
    const rightTeamBV = await this.getRightTeamBusinessVolume(dist.memberId);
    const totalTeamBV = SafeDecimal.add(leftTeamBV, rightTeamBV);
    const totalNetworkBV = SafeDecimal.add(personalBV, totalTeamBV);

    return {
      distributorId: dist.memberId,
      personalBV,
      leftTeamBV,
      rightTeamBV,
      totalTeamBV,
      totalNetworkBV,
    };
  }

  /**
   * Detailed breakdown of team volume for LEFT, RIGHT, or TOTAL
   */
  public static async getTeamVolumeDetails(
    distributorId: string,
    team: 'LEFT' | 'RIGHT' | 'TOTAL'
  ): Promise<TeamVolumeResult> {
    const cleanId = (distributorId || '').trim().toUpperCase();
    const dist = await BinaryTreeService.resolveDistributor(cleanId);
    if (!dist) {
      const err: any = new Error(`Distributor ${distributorId} not found`);
      err.statusCode = 404;
      throw err;
    }

    let members: any[] = [];
    if (team === 'LEFT') {
      const res = await BinaryTreeService.getLeftDownline(dist.memberId, { limit: 1000 });
      members = res.data;
    } else if (team === 'RIGHT') {
      const res = await BinaryTreeService.getRightDownline(dist.memberId, { limit: 1000 });
      members = res.data;
    } else {
      const res = await BinaryTreeService.getDownline(dist.memberId, { limit: 1000 });
      members = res.data;
    }

    let totalVolume = 0;
    const details: any[] = [];

    for (const m of members) {
      const pBv = await this.getPersonalBusinessVolume(m.distributorId);
      totalVolume = SafeDecimal.add(totalVolume, pBv);
      details.push({
        distributorId: m.distributorId,
        name: m.name,
        position: m.position,
        personalBV: pBv,
      });
    }

    return {
      distributorId: dist.memberId,
      team,
      leg: team,
      businessVolume: totalVolume,
      memberCount: members.length,
      details,
    };
  }

  /**
   * Alias for getBusinessVolumeSummary
   */
  public static async getDistributorVolumeSummary(distributorId: string): Promise<BvSummaryResult> {
    return this.getBusinessVolumeSummary(distributorId);
  }

  /**
   * Get all transactions for a distributor
   */
  public static async getTransactions(distributorId: string): Promise<BvTransaction[]> {
    BusinessVolumeService.initDefaultTransactions();
    const cleanId = (distributorId || '').trim().toUpperCase();
    const list: BvTransaction[] = [];

    for (const tx of this.inMemoryTransactions.values()) {
      if (tx.distributorId === cleanId) {
        list.push(tx);
      }
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Get all system-wide BV transactions with optional filtering
   */
  public static async getAllTransactions(filters: { distributorId?: string; type?: string; status?: string } = {}): Promise<BvTransaction[]> {
    BusinessVolumeService.initDefaultTransactions();
    let list: BvTransaction[] = Array.from(this.inMemoryTransactions.values());

    if (filters.distributorId) {
      const cleanId = filters.distributorId.trim().toUpperCase();
      list = list.filter((tx) => tx.distributorId === cleanId);
    }
    if (filters.type) {
      const filterType = filters.type.trim().toUpperCase();
      list = list.filter((tx) => (tx.type || '').toUpperCase() === filterType);
    }
    if (filters.status) {
      const filterStatus = filters.status.trim().toUpperCase();
      list = list.filter((tx) => (tx.status || '').toUpperCase() === filterStatus);
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Update transaction status (e.g. APPROVED, CANCELLED, REFUNDED)
   */
  public static async updateTransactionStatus(
    orderOrTxId: string,
    newStatus: BvTransactionStatus
  ): Promise<BvTransaction> {
    BusinessVolumeService.initDefaultTransactions();
    const cleanId = orderOrTxId.trim();

    let tx = this.inMemoryTransactions.get(cleanId);
    if (!tx && this.orderIndex.has(cleanId)) {
      const txId = this.orderIndex.get(cleanId)!;
      tx = this.inMemoryTransactions.get(txId);
    }

    if (!tx) {
      throw new Error(`Transaction with reference ${orderOrTxId} not found.`);
    }

    tx.status = newStatus;
    tx.updatedAt = new Date().toISOString();
    return tx;
  }

  /**
   * Reverse a transaction due to cancellation or refund
   */
  public static async reverseBusinessVolume(
    orderOrTxId: string,
    reason: string = 'Customer return / refund'
  ): Promise<BvTransaction> {
    const original = await this.updateTransactionStatus(orderOrTxId, 'REFUNDED');

    // Create linked reversal transaction with negative / adjustment record
    const reversalTx = await this.recordInMemory({
      distributorId: original.distributorId,
      orderId: `REV-${original.orderId}`,
      amount: -original.amount,
      businessVolume: original.businessVolume,
      type: 'REFUND_REVERSAL',
      status: 'APPROVED',
      description: `Reversal of ${original.orderId}: ${reason}`,
    });

    return reversalTx;
  }

  /**
   * Reset store (useful for clean test states)
   */
  public static resetStore(): void {
    this.inMemoryTransactions.clear();
    this.orderIndex.clear();
    this.initialized = false;
  }
}
