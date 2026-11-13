import { Prisma } from '@prisma/client';
import { RankTierConfig } from '../types/cumulativeRankCommission.types';

/**
 * Pool-based rank distribution (tier slices).
 *
 * Each rank tier owns a fixed slice of the pool (Silver 24%, Gold 8%, Platinum 13%,
 * Diamond 5%, Ruby 4%). A slice is shared equally by every eligible member whose rank
 * is at or above that tier. Shares are rounded DOWN to the cent; anything not paid out
 * (empty tiers, the unassigned remainder, rounding cents) stays in the pool.
 *
 * Example: pool 1000, 3 Diamond + 2 Platinum + 2 Silver
 *   Silver 240/7 = 34.28, Gold 80/5 = 16.00, Platinum 130/5 = 26.00, Diamond 50/3 = 16.66
 *   Silver 34.28, Platinum 76.28, Diamond 92.94 each => 499.94 paid, 500.06 stays in pool.
 */

export interface PoolMember {
  distributorId: string;
  distributorCode: string;
  name: string;
  rankCode: string;
  rankOrder: number;
}

export interface PoolSliceResult {
  tierOrder: number;
  rankCode: string;
  rankName: string;
  percentage: number;
  sliceAmount: number;
  recipientCount: number;
  perMemberAmount: number;
  distributedAmount: number;
}

export interface PoolAllocation extends PoolMember {
  amount: number;
  tierBreakdown: Array<{ rankCode: string; amount: number }>;
}

export interface PoolDistributionResult {
  poolAmount: number;
  totalDistributed: number;
  remainingInPool: number;
  slices: PoolSliceResult[];
  allocations: PoolAllocation[];
}

const toCents = (amount: number): number =>
  new Prisma.Decimal(amount).mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN).toNumber();

const fromCents = (cents: number): number => new Prisma.Decimal(cents).div(100).toNumber();

export function computeTierSliceDistribution(
  poolAmount: number,
  members: PoolMember[],
  tiers: readonly RankTierConfig[]
): PoolDistributionResult {
  const poolCents = Math.max(0, toCents(poolAmount));
  const activeTiers = tiers.filter((t) => t.order >= 1 && t.commissionPercent > 0).sort((a, b) => a.order - b.order);

  const allocationCents = new Map<string, number>();
  const breakdown = new Map<string, Array<{ rankCode: string; amount: number }>>();
  const slices: PoolSliceResult[] = [];
  let distributedCents = 0;

  for (const tier of activeTiers) {
    const sliceCents = new Prisma.Decimal(poolCents)
      .mul(tier.commissionPercent)
      .div(100)
      .toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN)
      .toNumber();
    const recipients = members.filter((m) => m.rankOrder >= tier.order);
    const perMemberCents = recipients.length > 0 ? Math.floor(sliceCents / recipients.length) : 0;

    for (const m of recipients) {
      if (perMemberCents <= 0) break;
      allocationCents.set(m.distributorId, (allocationCents.get(m.distributorId) || 0) + perMemberCents);
      const list = breakdown.get(m.distributorId) || [];
      list.push({ rankCode: tier.code, amount: fromCents(perMemberCents) });
      breakdown.set(m.distributorId, list);
    }

    const sliceDistributed = perMemberCents * recipients.length;
    distributedCents += sliceDistributed;
    slices.push({
      tierOrder: tier.order,
      rankCode: tier.code,
      rankName: tier.name,
      percentage: tier.commissionPercent,
      sliceAmount: fromCents(sliceCents),
      recipientCount: recipients.length,
      perMemberAmount: fromCents(perMemberCents),
      distributedAmount: fromCents(sliceDistributed),
    });
  }

  const allocations: PoolAllocation[] = members
    .filter((m) => (allocationCents.get(m.distributorId) || 0) > 0)
    .map((m) => ({
      ...m,
      amount: fromCents(allocationCents.get(m.distributorId)!),
      tierBreakdown: breakdown.get(m.distributorId) || [],
    }));

  return {
    poolAmount: fromCents(poolCents),
    totalDistributed: fromCents(distributedCents),
    remainingInPool: fromCents(poolCents - distributedCents),
    slices,
    allocations,
  };
}
