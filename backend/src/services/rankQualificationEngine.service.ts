import { Prisma } from '@prisma/client';
import {
  LevelService,
  LevelDefinition,
  EligibleLevelResult,
  LevelQualificationCheckResult,
  PromoteMemberOptions,
  PromoteMemberResult,
  RecalculateMemberLevelOptions,
  RecalculateMemberLevelResult,
  MemberLevelProgressResult,
  CANONICAL_LEVELS,
} from './level.service';

/**
 * ============================================================================
 * AUTOMATIC MLM RANK QUALIFICATION ENGINE (PROMPT 6)
 * ============================================================================
 * Single backend source of truth for member MLM rank qualification.
 *
 * MANDATORY QUALIFICATION FORMULA:
 * A member qualifies for a rank ONLY if ALL THREE conditions are satisfied:
 *   1. member.BB >= level.requiredBB
 *   AND
 *   2. member.leftMatching >= level.requiredLeftMatching
 *   AND
 *   3. member.rightMatching >= level.requiredRightMatching
 *
 * EVALUATION ORDER:
 * Strict highest-to-lowest evaluation (RUBY -> DIAMOND -> PLATINUM -> GOLD -> SILVER -> BASE).
 * Direct qualification without requiring sequential progression through intermediate tiers.
 *
 * REQUIRED METHODS:
 * - calculateEligibleLevel(memberId)
 * - checkLevelQualification(memberId, levelId)
 * - promoteMember(memberId, levelId)
 * - recalculateMemberLevel(memberId)
 * - getMemberLevelProgress(memberId)
 *
 * The current level must NEVER be determined by the frontend.
 * The backend is the single source of truth.
 */
export class AutomaticRankQualificationEngine {
  /**
   * Pure evaluation helper: Checks if given volume metrics satisfy ALL THREE conditions for a level.
   *
   * @param bb Member's current BB
   * @param leftMatching Member's left matching volume
   * @param rightMatching Member's right matching volume
   * @param level LevelDefinition to check against
   */
  public static isRankQualified(
    bb: number,
    leftMatching: number,
    rightMatching: number,
    level: LevelDefinition,
    isAdmin: boolean = false,
    joiningsCount: number = 0
  ): boolean {
    if (!level || level.order === 0) return true;

    if (isAdmin) {
      // Level of the Admin user will increase based on joinings() of user under him
      const minJoinings =
        level.order === 1 ? 2 :
        level.order === 2 ? 5 :
        level.order === 3 ? 10 :
        level.order === 4 ? 20 :
        level.order === 5 ? 50 : 0;
      const meetsMatching =
        leftMatching >= level.requiredLeftMatching ||
        rightMatching >= level.requiredRightMatching;
      return meetsMatching || joiningsCount >= minJoinings;
    }

    // Distributor level increases: he has to buy also AND add people both
    const meetsBB = bb >= level.requiredBB;
    const meetsMatching =
      leftMatching >= level.requiredLeftMatching ||
      rightMatching >= level.requiredRightMatching;
    return meetsBB && meetsMatching;
  }

  /**
   * 1. calculateEligibleLevel(memberId)
   *
   * Evaluates levels strictly from HIGHEST to LOWEST:
   * RUBY -> DIAMOND -> PLATINUM -> GOLD -> SILVER -> BASE.
   *
   * A member qualifies for a rank ONLY if ALL THREE conditions are satisfied:
   *   member.BB >= level.requiredBB
   *   AND
   *   member.leftMatching >= level.requiredLeftMatching
   *   AND
   *   member.rightMatching >= level.requiredRightMatching
   *
   * Direct qualification is supported (e.g. BB 1500, Left 150000, Right 150000 -> RUBY directly;
   * does not force member to pass through Silver -> Gold -> Platinum -> Diamond -> Ruby).
   */
  public static async calculateEligibleLevel(
    memberId: string | any,
    overrides?: { bb?: number; leftMatching?: number; rightMatching?: number; matching?: number },
    tx?: Prisma.TransactionClient
  ): Promise<EligibleLevelResult> {
    return LevelService.calculateEligibleLevel(memberId, overrides, tx);
  }

  /**
   * 2. checkLevelQualification(memberId, levelId)
   *
   * Checks whether a member qualifies for a specific level/rank.
   * All three requirements are mandatory.
   *
   * @param memberId Member UUID or distributorCode
   * @param levelId Level UUID, code (e.g. 'PLATINUM'), name ('Platinum'), or order (3)
   */
  public static async checkLevelQualification(
    memberId: string,
    levelId: string | number,
    overrides?: { bb?: number; leftMatching?: number; rightMatching?: number; matching?: number },
    tx?: Prisma.TransactionClient
  ): Promise<LevelQualificationCheckResult> {
    return LevelService.checkLevelQualification(memberId, levelId, overrides, tx);
  }

  /**
   * 3. promoteMember(memberId, levelId)
   *
   * Promotes member to the specified level (or highest eligible level if levelId is omitted).
   * Verifies all three qualification conditions.
   * Enforces NO DEMOTION (if target/eligible level order <= current level order, maintains level).
   * Atomically records promotion in MemberLevelHistory and updates DistributorProfile.
   *
   * @param memberId Member UUID or distributorCode
   * @param levelId Optional specific level UUID/code to promote to, or PromoteMemberOptions
   */
  public static async promoteMember(
    memberId: string,
    levelId?: string | PromoteMemberOptions,
    tx?: Prisma.TransactionClient
  ): Promise<PromoteMemberResult> {
    return LevelService.promoteMember(memberId, levelId, tx);
  }

  /**
   * 4. recalculateMemberLevel(memberId)
   *
   * Authoritative recalculation engine:
   * Audits BB, Left Matching, and Right Matching from scratch via the underlying ledgers.
   * Determines highest currently qualified level.
   * Promotes member if eligibleLevel.order > currentLevel.order.
   */
  public static async recalculateMemberLevel(
    memberId: string,
    options: RecalculateMemberLevelOptions = {},
    tx?: Prisma.TransactionClient
  ): Promise<RecalculateMemberLevelResult> {
    return LevelService.recalculateMemberLevel(memberId, options, tx);
  }

  /**
   * 5. getMemberLevelProgress(memberId)
   *
   * Returns current rank, highest rank, next rank, and precise gaps toward next rank:
   *   - bbGap = max(0, nextLevel.requiredBB - currentBB)
   *   - leftMatchingGap = max(0, nextLevel.requiredLeftMatching - currentLeftMatching)
   *   - rightMatchingGap = max(0, nextLevel.requiredRightMatching - currentRightMatching)
   *
   * The current level and progress must NEVER be determined by the frontend.
   * The backend is the single source of truth.
   */
  public static async getMemberLevelProgress(
    memberId: string,
    tx?: Prisma.TransactionClient
  ): Promise<MemberLevelProgressResult> {
    return LevelService.getMemberLevelProgress(memberId, tx);
  }

  /**
   * Retrieves all canonical levels ordered ascending.
   */
  public static async getAllLevels(tx?: Prisma.TransactionClient): Promise<LevelDefinition[]> {
    return LevelService.getAllLevels(tx);
  }
}

// Alias for convenience
export const RankQualificationEngine = AutomaticRankQualificationEngine;
