import { describe, it, expect } from 'vitest';
import { computeTierSliceDistribution, PoolMember } from '../src/services/commissionPoolDistribution';
import { CANONICAL_RANK_CONFIGS } from '../src/types/cumulativeRankCommission.types';

const ORDER: Record<string, number> = { SILVER: 1, GOLD: 2, PLATINUM: 3, DIAMOND: 4, RUBY: 5 };
const members = (spec: Record<string, number>): PoolMember[] =>
  Object.entries(spec).flatMap(([rank, count]) =>
    Array.from({ length: count }, (_, i) => ({
      distributorId: `${rank}-${i}`,
      distributorCode: `${rank}-${i}`,
      name: `${rank} ${i}`,
      rankCode: rank,
      rankOrder: ORDER[rank],
    }))
  );
const amountFor = (r: ReturnType<typeof computeTierSliceDistribution>, id: string) =>
  r.allocations.find((a) => a.distributorId === id)?.amount;

describe('Commission pool tier-slice distribution', () => {
  it('$1000 pool, 3 Diamond + 2 Platinum + 2 Silver: pays 499.94, keeps 500.06 in pool', () => {
    const r = computeTierSliceDistribution(1000, members({ DIAMOND: 3, PLATINUM: 2, SILVER: 2 }), CANONICAL_RANK_CONFIGS);

    expect(amountFor(r, 'SILVER-0')).toBe(34.28);
    expect(amountFor(r, 'PLATINUM-0')).toBe(76.28);
    expect(amountFor(r, 'DIAMOND-0')).toBe(92.94);
    expect(r.totalDistributed).toBe(499.94);
    expect(r.remainingInPool).toBe(500.06);
    expect(r.slices.find((s) => s.rankCode === 'RUBY')).toMatchObject({ recipientCount: 0, distributedAmount: 0 });
  });

  it('$100 pool, same members: rounding down to the cent pays 49.92, keeps 50.08', () => {
    const r = computeTierSliceDistribution(100, members({ DIAMOND: 3, PLATINUM: 2, SILVER: 2 }), CANONICAL_RANK_CONFIGS);
    expect(amountFor(r, 'SILVER-0')).toBe(3.42);
    expect(amountFor(r, 'DIAMOND-0')).toBe(9.28);
    expect(r.totalDistributed).toBe(49.92);
    expect(r.remainingInPool).toBe(50.08);
  });

  it('only 1 Silver member: gets the 24% Silver slice, the rest stays in the pool', () => {
    const r = computeTierSliceDistribution(1000, members({ SILVER: 1 }), CANONICAL_RANK_CONFIGS);
    expect(r.allocations).toHaveLength(1);
    expect(r.totalDistributed).toBe(240);
    expect(r.remainingInPool).toBe(760);
  });

  it('never pays more than the pool and never more than 54%', () => {
    const r = computeTierSliceDistribution(999.99, members({ RUBY: 4, DIAMOND: 1, GOLD: 3, SILVER: 9 }), CANONICAL_RANK_CONFIGS);
    expect(r.totalDistributed).toBeLessThanOrEqual(999.99 * 0.54);
    expect(Math.round((r.totalDistributed + r.remainingInPool) * 100)).toBe(99999);
  });

  it('no eligible members or empty pool distributes nothing', () => {
    expect(computeTierSliceDistribution(1000, [], CANONICAL_RANK_CONFIGS).totalDistributed).toBe(0);
    expect(computeTierSliceDistribution(0, members({ RUBY: 2 }), CANONICAL_RANK_CONFIGS).totalDistributed).toBe(0);
  });
});
