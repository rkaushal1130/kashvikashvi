import { Prisma } from '@prisma/client';

export type RankCode = 'BASE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'RUBY';

export type CommissionBaseType = 'BINARY_MATCHED_BV' | 'PERIOD_GROUP_BV' | 'ORDER_BV';

export type CumulativeCommissionStatus =
  | 'PENDING'
  | 'QUALIFIED'
  | 'CALCULATED'
  | 'APPROVED'
  | 'PAID'
  | 'REVERSED';

export interface RankTierConfig {
  id?: string;
  order: number;
  code: RankCode;
  name: string;
  commissionPercent: number;
  minBV: number;
  minLeftMatching: number;
  minRightMatching: number;
  binaryWeeklyCap?: number;
  description: string;
  isActive: boolean;
}

export const CANONICAL_RANK_CONFIGS: readonly RankTierConfig[] = Object.freeze([
  {
    order: 0,
    code: 'BASE',
    name: 'Base',
    commissionPercent: 0,
    minBV: 0,
    minLeftMatching: 0,
    minRightMatching: 0,
    binaryWeeklyCap: 500,
    description: 'Initial entry tier for newly registered members before reaching Silver threshold.',
    isActive: true,
  },
  {
    order: 1,
    code: 'SILVER',
    name: 'Silver',
    commissionPercent: 24,
    minBV: 250,
    minLeftMatching: 2000,
    minRightMatching: 2000,
    binaryWeeklyCap: 3000,
    description: 'Silver rank: 24% commission, min 250 BV, left matching >= 2,000, right matching >= 2,000.',
    isActive: true,
  },
  {
    order: 2,
    code: 'GOLD',
    name: 'Gold',
    commissionPercent: 8,
    minBV: 250,
    minLeftMatching: 5000,
    minRightMatching: 5000,
    binaryWeeklyCap: 10000,
    description: 'Gold rank: 8% commission (cumulative +24% Silver = 32%), min 250 BV, left matching >= 5,000, right matching >= 5,000.',
    isActive: true,
  },
  {
    order: 3,
    code: 'PLATINUM',
    name: 'Platinum',
    commissionPercent: 13,
    minBV: 500,
    minLeftMatching: 50000,
    minRightMatching: 50000,
    binaryWeeklyCap: 25000,
    description: 'Platinum rank: 13% commission (cumulative 24%+8%+13% = 45%), min 500 BV, left matching >= 50,000, right matching >= 50,000.',
    isActive: true,
  },
  {
    order: 4,
    code: 'DIAMOND',
    name: 'Diamond',
    commissionPercent: 5,
    minBV: 1000,
    minLeftMatching: 60000,
    minRightMatching: 60000,
    binaryWeeklyCap: 50000,
    description: 'Diamond rank: 5% commission (cumulative 24%+8%+13%+5% = 50%), min 1,000 BV, left matching >= 60,000, right matching >= 60,000.',
    isActive: true,
  },
  {
    order: 5,
    code: 'RUBY',
    name: 'Ruby',
    commissionPercent: 4,
    minBV: 1000,
    minLeftMatching: 100000,
    minRightMatching: 100000,
    binaryWeeklyCap: 100000,
    description: 'Ruby rank: 4% commission (cumulative 24%+8%+13%+5%+4% = 54%), min 1,000 BV, left matching >= 100,000, right matching >= 100,000.',
    isActive: true,
  },
]);

export interface CumulativeCommissionTier {
  tierOrder: number;
  rankCode: RankCode;
  rankName: string;
  percentage: number;
  cumulativePercentage: number;
}

export interface RankQualificationDetails {
  memberId: string;
  distributorCode: string;
  name: string;
  sponsorId: string | null;
  sponsorName: string | null;
  parentPlacementId: string | null;
  placementLeg: 'LEFT' | 'RIGHT' | null;
  currentRank: RankCode;
  currentRankName: string;
  currentRankOrder: number;
  qualifyingBV: number;
  leftMatching: number;
  rightMatching: number;
  matchedVolume: number;
  nextRank: RankCode | null;
  nextRankName: string | null;
  missingRequirements: {
    bvGap: number;
    leftMatchingGap: number;
    rightMatchingGap: number;
  };
  rankProgressPercent: number;
  isQualified: boolean;
  eligibleCommissionTiers: CumulativeCommissionTier[];
  cumulativePercentage: number;
  paymentStatus: string;
  isCommissionEligible: boolean;
}

export interface TierCommissionCalculation {
  id?: string;
  distributorId: string;
  distributorCode: string;
  distributorName: string;
  tierOrder: number;
  rankCode: RankCode;
  rankName: string;
  percentage: number;
  eligibleBaseAmount: number;
  calculatedAmount: number;
  periodId: string;
  periodCode: string;
  sourceReference: string;
  status: CumulativeCommissionStatus;
  businessReference: string;
  calculatedAt: Date;
  approvedAt?: Date | null;
  paidAt?: Date | null;
  reversedAt?: Date | null;
  walletTransactionId?: string | null;
  reversalReason?: string | null;
}

export interface PeriodCommissionCalculationResult {
  periodId: string;
  periodCode: string;
  baseType: CommissionBaseType;
  membersEvaluated: number;
  membersQualified: number;
  totalCalculatedAmount: number;
  tierSummary: Record<string, { count: number; totalAmount: number }>;
  commissions: TierCommissionCalculation[];
}

export interface AdminCommissionReportItem {
  distributorId: string;
  distributorCode: string;
  distributorName: string;
  sponsorId: string | null;
  placementDetails: {
    parentId: string | null;
    position: string | null;
    treeId?: string | null;
  };
  achievedRank: RankCode;
  rankName: string;
  qualifyingBV: number;
  leftMatching: number;
  rightMatching: number;
  missingRequirements: {
    bvGap: number;
    leftMatchingGap: number;
    rightMatchingGap: number;
  };
  rankStatus: 'QUALIFIED' | 'SHORTFALL' | 'INACTIVE';
  paymentStatus: string;
  eligibleTiers: CumulativeCommissionTier[];
  cumulativePercentage: number;
  eligibleBase: number;
  calculatedAmount: number;
  pendingAmount: number;
  approvedAmount: number;
  paidAmount: number;
  reversedAmount: number;
}
