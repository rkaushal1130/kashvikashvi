import { UplineNode } from '../services/sponsorUpline.service';

/**
 * ============================================================================
 * COMMISSION ELIGIBILITY ENGINE TYPES (PROMPT 17)
 * ============================================================================
 * Defines configurable rules, evaluation contexts, and audit breakdown results
 * for determining whether an upline distributor is eligible to earn commissions
 * at each individual sponsor generation level (1 through 5).
 *
 * STRICT BUSINESS INVARIANTS:
 * 1. Eligibility rules are completely decoupled from percentage calculations.
 * 2. By default, ONLY explicitly confirmed rules are enforced (active account, valid member).
 * 3. Never silently assume Silver = Level 1, Gold = Level 2, Platinum = Level 3,
 *    Diamond = Level 4, Ruby = Level 5 unless explicitly configured.
 * 4. Rank and commission-level concepts remain strictly separate.
 */

export interface LevelEligibilityRuleConfig {
  level: number;

  /**
   * Future rule: Minimum rank required to earn commission at this generation level.
   * Default: null (no rank requirement enforced by default).
   */
  minimumRank?: string | null;

  /**
   * Active membership status requirement (default: true).
   */
  requireActiveMembership: boolean;

  /**
   * Future rule: Whether verified KYC is mandatory to earn commission at this level.
   * Default: false (not required by default).
   */
  requireKycApproved: boolean;

  /**
   * Permitted distributor status codes (default: ['ACTIVE']).
   */
  allowedStatuses: string[];

  /**
   * Future rule: Minimum Personal Business Volume (PBV) required.
   * Default: 0 (no personal volume threshold enforced by default).
   */
  minPersonalBV?: number;

  /**
   * Future rule: Monthly qualification flag.
   * Default: false.
   */
  requireMonthlyQualification?: boolean;

  /**
   * Future rule: Maximum elapsed days since last qualifying activity / purchase.
   */
  maxDaysSinceLastActivity?: number;

  /**
   * Future rule: Commission cap per cycle or per order (in currency units).
   */
  commissionCap?: number;
}

export interface EligibilityContext {
  orderId?: string;
  orderDate?: Date;
  businessVolume?: number;
  customRules?: Partial<LevelEligibilityRuleConfig>;
  allowInactiveForTesting?: boolean;
}

export interface LevelEligibilityCheckResult {
  isEligible: boolean;
  level: number;
  distributorId: string;
  distributorCode?: string;
  displayName?: string;
  reasons: string[];
  passedRules: string[];
  criteria: {
    accountActive: boolean;
    membershipStatus: string;
    kycStatus?: string;
    currentRankCode?: string;
    currentLevelCode?: string;
    personalBV?: number;
    commissionCap?: number;
  };
}

export interface ComprehensiveUplineEligibilityReport {
  distributorId: string;
  distributorCode?: string;
  displayName?: string;
  status: string;
  overallEligible: boolean;
  levels: {
    1: LevelEligibilityCheckResult;
    2: LevelEligibilityCheckResult;
    3: LevelEligibilityCheckResult;
    4: LevelEligibilityCheckResult;
    5: LevelEligibilityCheckResult;
    [key: number]: LevelEligibilityCheckResult;
  };
}
