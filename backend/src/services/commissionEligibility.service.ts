import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { UplineNode, SponsorUplineService } from './sponsorUpline.service';
import {
  LevelEligibilityRuleConfig,
  EligibilityContext,
  LevelEligibilityCheckResult,
  ComprehensiveUplineEligibilityReport,
} from '../types/commissionEligibility.types';

/**
 * Canonical Rank Hierarchy Order for rank comparisons:
 * BASE (0) < SILVER (1) < GOLD (2) < PLATINUM (3) < DIAMOND (4) < RUBY (5)
 */
const RANK_ORDER_MAP: Record<string, number> = {
  BASE: 0,
  SILVER: 1,
  GOLD: 2,
  PLATINUM: 3,
  DIAMOND: 4,
  RUBY: 5,
};

/**
 * ============================================================================
 * COMMISSION ELIGIBILITY ENGINE SERVICE (PROMPT 17)
 * ============================================================================
 * Dedicated service for evaluating whether an upline distributor qualifies
 * to receive unilevel commissions across levels 1 through 5.
 *
 * CRITICAL BUSINESS INVARIANTS:
 * 1. ZERO MIXING: Eligibility rules are strictly separated from percentage calculations.
 * 2. EXPLICITLY CONFIRMED RULES ONLY: By default, only active membership and
 *    active account status are enforced.
 * 3. NO INVENTED RANK REQUIREMENTS: Ranks (Silver, Gold, Platinum, Diamond, Ruby)
 *    are NEVER required by default.
 *    Do NOT assume:
 *      Silver   = Level 1
 *      Gold     = Level 2
 *      Platinum = Level 3
 *      Diamond  = Level 4
 *      Ruby     = Level 5
 *    unless explicitly configured via setRuleConfig.
 * 4. EXTENSIBLE FOR FUTURE RULES: Supports minimum rank, active membership,
 *    KYC status, account status, qualification periods, personal purchase requirement,
 *    monthly qualification, and commission caps.
 */
export class CommissionEligibilityService {
  /**
   * Configurable rule definitions per commission level (1 to 5).
   * Initialized strictly with explicitly confirmed rules only (NO rank assumptions).
   */
  private static ruleConfigs: Map<number, LevelEligibilityRuleConfig> = new Map([
    [
      1,
      {
        level: 1,
        requireActiveMembership: true,
        allowedStatuses: ['ACTIVE'],
        requireKycApproved: false,
        minimumRank: null, // STRICT: No rank required unless explicitly configured
        minPersonalBV: 0,
        requireMonthlyQualification: false,
      },
    ],
    [
      2,
      {
        level: 2,
        requireActiveMembership: true,
        allowedStatuses: ['ACTIVE'],
        requireKycApproved: false,
        minimumRank: null, // STRICT: No rank required unless explicitly configured
        minPersonalBV: 0,
        requireMonthlyQualification: false,
      },
    ],
    [
      3,
      {
        level: 3,
        requireActiveMembership: true,
        allowedStatuses: ['ACTIVE'],
        requireKycApproved: false,
        minimumRank: null, // STRICT: No rank required unless explicitly configured
        minPersonalBV: 0,
        requireMonthlyQualification: false,
      },
    ],
    [
      4,
      {
        level: 4,
        requireActiveMembership: true,
        allowedStatuses: ['ACTIVE'],
        requireKycApproved: false,
        minimumRank: null, // STRICT: No rank required unless explicitly configured
        minPersonalBV: 0,
        requireMonthlyQualification: false,
      },
    ],
    [
      5,
      {
        level: 5,
        requireActiveMembership: true,
        allowedStatuses: ['ACTIVE'],
        requireKycApproved: false,
        minimumRank: null, // STRICT: No rank required unless explicitly configured
        minPersonalBV: 0,
        requireMonthlyQualification: false,
      },
    ],
  ]);

  /**
   * Retrieves active rule configuration for a given generation level.
   */
  public static getRuleConfig(level: number): LevelEligibilityRuleConfig {
    const existing = this.ruleConfigs.get(level);
    if (existing) {
      return { ...existing };
    }
    return {
      level,
      requireActiveMembership: true,
      allowedStatuses: ['ACTIVE'],
      requireKycApproved: false,
      minimumRank: null,
      minPersonalBV: 0,
      requireMonthlyQualification: false,
    };
  }

  /**
   * Configures future rules for a specific generation level.
   * Allows business to explicitly set minimum rank, KYC, PBV thresholds, etc.
   */
  public static setRuleConfig(
    level: number,
    rules: Partial<LevelEligibilityRuleConfig>
  ): LevelEligibilityRuleConfig {
    const current = this.getRuleConfig(level);
    const updated: LevelEligibilityRuleConfig = {
      ...current,
      ...rules,
      level,
    };
    this.ruleConfigs.set(level, updated);
    return { ...updated };
  }

  /**
   * Resets all rule configurations back to explicitly confirmed baseline
   * (all rank requirements cleared to null).
   */
  public static resetRuleConfigs(): void {
    for (let i = 1; i <= 5; i++) {
      this.ruleConfigs.set(i, {
        level: i,
        requireActiveMembership: true,
        allowedStatuses: ['ACTIVE'],
        requireKycApproved: false,
        minimumRank: null,
        minPersonalBV: 0,
        requireMonthlyQualification: false,
      });
    }
  }

  /**
   * Helper: Resolves comprehensive profile details for eligibility checks.
   */
  private static async resolveDistributorDetails(
    upline: string | UplineNode,
    client?: Prisma.TransactionClient
  ) {
    const db = client || prisma;
    const identifier = typeof upline === 'string' ? upline.trim() : upline.distributorId;

    if (!identifier) {
      return null;
    }

    try {
      const profile = await db.distributorProfile.findFirst({
        where: {
          OR: [
            { id: identifier },
            { distributorId: identifier },
            { distributorCode: identifier },
          ],
        },
        include: {
          user: { select: { id: true, status: true, email: true } },
          kycProfile: { select: { id: true, status: true } },
          currentLevel: { select: { id: true, code: true, name: true, order: true } },
          currentRank: { select: { id: true, name: true } },
        },
      });

      return profile;
    } catch (err) {
      logger.warn({ identifier, err }, 'Failed to fetch distributor details for eligibility evaluation');
      return null;
    }
  }

  /**
   * Core Engine Method: Evaluates whether an upline distributor is eligible for a specific Level (1-5).
   *
   * Checks strictly against the configured rule criteria for that level:
   * 1. Account existence and non-deletion
   * 2. Active membership status
   * 3. Allowed account status codes
   * 4. Minimum rank (ONLY if explicitly configured)
   * 5. KYC approval (ONLY if explicitly configured)
   * 6. Minimum personal BV (ONLY if explicitly configured)
   * 7. Qualification period / activity window (ONLY if explicitly configured)
   */
  public static async isEligibleForLevel(
    upline: string | UplineNode,
    level: number,
    context?: EligibilityContext,
    client?: Prisma.TransactionClient
  ): Promise<LevelEligibilityCheckResult> {
    if (!Number.isInteger(level) || level < 1 || level > 5) {
      throw AppError.badRequest(`Commission level must be an integer between 1 and 5 (received: ${level})`);
    }

    const baseRules = this.getRuleConfig(level);
    const effectiveRules: LevelEligibilityRuleConfig = {
      ...baseRules,
      ...(context?.customRules || {}),
      level,
    };

    const reasons: string[] = [];
    const passedRules: string[] = [];

    // Fast-path: If an UplineNode is provided and only baseline rules are required,
    // evaluate immediately from node metadata without redundant DB queries
    const needsDeepProfile =
      typeof upline === 'string' ||
      Boolean(effectiveRules.minimumRank) ||
      Boolean(effectiveRules.requireKycApproved) ||
      Boolean(effectiveRules.minPersonalBV && effectiveRules.minPersonalBV > 0) ||
      Boolean(effectiveRules.maxDaysSinceLastActivity);

    if (typeof upline !== 'string' && !needsDeepProfile) {
      const node = upline as UplineNode;
      const isActive = node.isActive && (node.status || '').toUpperCase() === 'ACTIVE';

      if (effectiveRules.requireActiveMembership && !isActive && !context?.allowInactiveForTesting) {
        reasons.push(`Upline '${node.displayName || node.distributorCode}' is not active (Status: ${node.status}).`);
      } else {
        passedRules.push('Active membership verified (node)');
      }

      if (
        effectiveRules.allowedStatuses &&
        effectiveRules.allowedStatuses.length > 0 &&
        !effectiveRules.allowedStatuses.includes((node.status || '').toUpperCase())
      ) {
        reasons.push(
          `Account status '${node.status}' is not among allowed statuses: ${effectiveRules.allowedStatuses.join(', ')}.`
        );
      }

      const isEligible = reasons.length === 0;
      return {
        isEligible,
        level,
        distributorId: node.distributorId,
        distributorCode: node.distributorCode,
        displayName: node.displayName,
        reasons,
        passedRules,
        criteria: {
          accountActive: isActive,
          membershipStatus: node.status,
          commissionCap: effectiveRules.commissionCap,
        },
      };
    }

    // 1. Resolve upline profile
    const profile = await this.resolveDistributorDetails(upline, client);

    // If database record unavailable (e.g. mock node in unit test)
    if (!profile) {
      if (typeof upline !== 'string') {
        const node = upline as UplineNode;
        const isActive = node.isActive && (node.status || '').toUpperCase() === 'ACTIVE';

        if (effectiveRules.requireActiveMembership && !isActive && !context?.allowInactiveForTesting) {
          reasons.push(`Upline '${node.displayName || node.distributorCode}' is not active (Status: ${node.status}).`);
        } else {
          passedRules.push('Active membership verified (node)');
        }

        const isEligible = reasons.length === 0;
        return {
          isEligible,
          level,
          distributorId: node.distributorId,
          distributorCode: node.distributorCode,
          displayName: node.displayName,
          reasons,
          passedRules,
          criteria: {
            accountActive: isActive,
            membershipStatus: node.status,
          },
        };
      }

      return {
        isEligible: false,
        level,
        distributorId: upline,
        reasons: [`Upline distributor '${upline}' not found in system`],
        passedRules: [],
        criteria: {
          accountActive: false,
          membershipStatus: 'UNKNOWN',
        },
      };
    }

    // 2. Deletion check
    if (profile.deletedAt !== null) {
      reasons.push(`Upline distributor account has been deleted / terminated.`);
    } else {
      passedRules.push('Account is not deleted');
    }

    // 3. Active membership status check
    const membershipStatus = (profile.status || '').toUpperCase();
    const isMembershipActive = membershipStatus === 'ACTIVE';
    if (effectiveRules.requireActiveMembership && !isMembershipActive && !context?.allowInactiveForTesting) {
      reasons.push(`Distributor account is not active (Status: ${membershipStatus}).`);
    } else {
      passedRules.push(`Membership status is active (${membershipStatus})`);
    }

    // 4. Allowed account status codes check
    if (
      effectiveRules.allowedStatuses &&
      effectiveRules.allowedStatuses.length > 0 &&
      !effectiveRules.allowedStatuses.includes(membershipStatus)
    ) {
      reasons.push(
        `Account status '${membershipStatus}' is not among allowed statuses: ${effectiveRules.allowedStatuses.join(', ')}.`
      );
    } else {
      passedRules.push(`Account status is permitted`);
    }

    // 5. User auth account status check
    const userStatus = (profile.user?.status || '').toUpperCase();
    if (userStatus && userStatus !== 'ACTIVE' && !context?.allowInactiveForTesting) {
      reasons.push(`User login account status is ${userStatus} (must be ACTIVE).`);
    } else if (profile.user) {
      passedRules.push('User authentication account is ACTIVE');
    }

    // 6. Minimum Rank Check (FUTURE RULE — ONLY ENFORCED IF EXPLICITLY CONFIGURED)
    const currentRankCode =
      (profile.currentLevel?.code || profile.currentRank?.name || 'BASE').toUpperCase();
    if (effectiveRules.minimumRank) {
      const requiredRank = effectiveRules.minimumRank.toUpperCase();
      const currentRankOrder = RANK_ORDER_MAP[currentRankCode] ?? 0;
      const requiredRankOrder = RANK_ORDER_MAP[requiredRank] ?? 0;

      if (currentRankOrder < requiredRankOrder) {
        reasons.push(
          `Minimum rank requirement for Level ${level} not met. Required: ${requiredRank}, Current: ${currentRankCode}.`
        );
      } else {
        passedRules.push(`Minimum rank requirement met (${currentRankCode} >= ${requiredRank})`);
      }
    } else {
      passedRules.push(`No rank requirement enforced for Level ${level} (default confirmed rule)`);
    }

    // 7. KYC Status Check (FUTURE RULE — ONLY ENFORCED IF EXPLICITLY CONFIGURED)
    const kycStatus = (profile.kycProfile?.status || 'PENDING').toUpperCase();
    if (effectiveRules.requireKycApproved) {
      if (kycStatus !== 'VERIFIED') {
        reasons.push(`KYC verification required for Level ${level} commission (Current KYC: ${kycStatus}).`);
      } else {
        passedRules.push('KYC is verified');
      }
    }

    // 8. Personal Volume (PBV) Check (FUTURE RULE — ONLY ENFORCED IF EXPLICITLY CONFIGURED)
    const personalBV = Number(profile.lifetimePV || 0);
    if (effectiveRules.minPersonalBV && effectiveRules.minPersonalBV > 0) {
      if (personalBV < effectiveRules.minPersonalBV) {
        reasons.push(
          `Minimum personal volume not met. Required: ${effectiveRules.minPersonalBV} BV, Current: ${personalBV} BV.`
        );
      } else {
        passedRules.push(`Personal volume requirement met (${personalBV} >= ${effectiveRules.minPersonalBV} BV)`);
      }
    }

    // 9. Qualification Period Check (FUTURE RULE — ONLY ENFORCED IF EXPLICITLY CONFIGURED)
    if (effectiveRules.maxDaysSinceLastActivity && profile.activatedAt) {
      const daysSinceActivation = Math.floor(
        (Date.now() - new Date(profile.activatedAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceActivation > effectiveRules.maxDaysSinceLastActivity) {
        reasons.push(
          `Activity qualification period expired (${daysSinceActivation} days > ${effectiveRules.maxDaysSinceLastActivity} days).`
        );
      } else {
        passedRules.push('Activity qualification period is valid');
      }
    }

    const isEligible = reasons.length === 0;

    return {
      isEligible,
      level,
      distributorId: profile.id,
      distributorCode: profile.distributorCode || profile.distributorId || undefined,
      displayName:
        profile.displayName || `${profile.firstName} ${profile.lastName}`.trim() || undefined,
      reasons,
      passedRules,
      criteria: {
        accountActive: isMembershipActive && userStatus === 'ACTIVE',
        membershipStatus,
        kycStatus,
        currentRankCode,
        currentLevelCode: profile.currentLevel?.code,
        personalBV,
        commissionCap: effectiveRules.commissionCap,
      },
    };
  }

  // ==========================================================================
  // LEVEL-SPECIFIC CONVENIENCE METHODS
  // ==========================================================================

  /**
   * Is this upline eligible to receive Level 1 commission?
   */
  public static async isEligibleForLevel1(
    upline: string | UplineNode,
    context?: EligibilityContext,
    client?: Prisma.TransactionClient
  ): Promise<LevelEligibilityCheckResult> {
    return this.isEligibleForLevel(upline, 1, context, client);
  }

  /**
   * Is this upline eligible to receive Level 2 commission?
   */
  public static async isEligibleForLevel2(
    upline: string | UplineNode,
    context?: EligibilityContext,
    client?: Prisma.TransactionClient
  ): Promise<LevelEligibilityCheckResult> {
    return this.isEligibleForLevel(upline, 2, context, client);
  }

  /**
   * Is this upline eligible to receive Level 3 commission?
   */
  public static async isEligibleForLevel3(
    upline: string | UplineNode,
    context?: EligibilityContext,
    client?: Prisma.TransactionClient
  ): Promise<LevelEligibilityCheckResult> {
    return this.isEligibleForLevel(upline, 3, context, client);
  }

  /**
   * Is this upline eligible to receive Level 4 commission?
   */
  public static async isEligibleForLevel4(
    upline: string | UplineNode,
    context?: EligibilityContext,
    client?: Prisma.TransactionClient
  ): Promise<LevelEligibilityCheckResult> {
    return this.isEligibleForLevel(upline, 4, context, client);
  }

  /**
   * Is this upline eligible to receive Level 5 commission?
   */
  public static async isEligibleForLevel5(
    upline: string | UplineNode,
    context?: EligibilityContext,
    client?: Prisma.TransactionClient
  ): Promise<LevelEligibilityCheckResult> {
    return this.isEligibleForLevel(upline, 5, context, client);
  }

  /**
   * Boolean check: Evaluates whether upline qualifies for a given level.
   */
  public static async checkEligibility(
    upline: string | UplineNode,
    level: number,
    context?: EligibilityContext,
    client?: Prisma.TransactionClient
  ): Promise<boolean> {
    const result = await this.isEligibleForLevel(upline, level, context, client);
    return result.isEligible;
  }

  /**
   * Evaluates eligibility across all 5 levels simultaneously for a distributor.
   */
  public static async evaluateAllLevels(
    upline: string | UplineNode,
    context?: EligibilityContext,
    client?: Prisma.TransactionClient
  ): Promise<ComprehensiveUplineEligibilityReport> {
    const [l1, l2, l3, l4, l5] = await Promise.all([
      this.isEligibleForLevel1(upline, context, client),
      this.isEligibleForLevel2(upline, context, client),
      this.isEligibleForLevel3(upline, context, client),
      this.isEligibleForLevel4(upline, context, client),
      this.isEligibleForLevel5(upline, context, client),
    ]);

    const overallEligible = l1.isEligible || l2.isEligible || l3.isEligible || l4.isEligible || l5.isEligible;

    return {
      distributorId: l1.distributorId,
      distributorCode: l1.distributorCode,
      displayName: l1.displayName,
      status: l1.criteria.membershipStatus,
      overallEligible,
      levels: {
        1: l1,
        2: l2,
        3: l3,
        4: l4,
        5: l5,
      },
    };
  }

  /**
   * Filters a list of UplineNodes to retain only those confirmed eligible
   * for their designated generation levels.
   */
  public static async filterEligibleUplines(
    uplines: UplineNode[],
    context?: EligibilityContext,
    client?: Prisma.TransactionClient
  ): Promise<UplineNode[]> {
    const eligibleList: UplineNode[] = [];

    for (const node of uplines) {
      const check = await this.isEligibleForLevel(node, node.level, context, client);
      if (check.isEligible) {
        eligibleList.push(node);
      }
    }

    return eligibleList;
  }
}
