import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import {
  LevelService,
  MemberLevelDetails,
  LevelHistoryQueryOptions,
  LevelHistoryResult,
} from './level.service';
import { AppError } from '../utils/appError';

export interface ProgressMetricItem {
  current: number;
  required: number;
  remaining: number;
  percentage: number;
}

export interface MemberRankProgressData {
  currentLevel: {
    name: string;
    code: string;
  };
  currentBB: number;
  leftMatching: number;
  rightMatching: number;
  nextLevel: {
    name: string;
    requiredBB: number;
    requiredLeftMatching: number;
    requiredRightMatching: number;
  } | null;
  progress: {
    bb: ProgressMetricItem;
    leftMatching: ProgressMetricItem;
    rightMatching: ProgressMetricItem;
  };
  qualifiedForNextLevel: boolean;
}

/**
 * ============================================================================
 * MEMBER RANK PROGRESS SERVICE (PROMPT 7)
 * ============================================================================
 * Calculates and returns a member's current rank and progression toward the next rank.
 *
 * Rules:
 * 1. Evaluates BB, Left Matching, and Right Matching independently.
 * 2. Safely calculates remaining requirements: remaining = max(0, required - current).
 *    Never returns negative remaining values.
 * 3. Accurately computes percentage progress: min(100, round((current / required) * 100)).
 * 4. qualifiedForNextLevel is true IF AND ONLY IF all 3 remaining values are 0 and nextLevel is not null.
 * 5. Backend is the single source of truth.
 */
export class MemberRankProgressService {
  /**
   * Retrieves full rank progress for a distributor.
   *
   * @param memberId Member UUID or distributorCode
   * @param tx Optional Prisma transaction client
   */
  /**
   * Pure calculation engine that computes rank progression safely without DB calls.
   * Ensures remaining requirements never drop below 0.
   */
  public static computeProgress(
    currentBB: number,
    currentLeftMatching: number,
    currentRightMatching: number,
    currentLevel: {
      name: string;
      code: string;
      requiredBB?: number;
      requiredLeftMatching?: number;
      requiredRightMatching?: number;
    },
    nextLevel: {
      name: string;
      requiredBB: number;
      requiredLeftMatching: number;
      requiredRightMatching: number;
    } | null
  ): MemberRankProgressData {
    const hasNext = nextLevel !== null;

    let requiredBB = 0;
    let requiredLeftMatching = 0;
    let requiredRightMatching = 0;

    let bbRemaining = 0;
    let leftRemaining = 0;
    let rightRemaining = 0;

    let bbPercentage = 100;
    let leftPercentage = 100;
    let rightPercentage = 100;

    if (hasNext && nextLevel) {
      requiredBB = nextLevel.requiredBB;
      requiredLeftMatching = nextLevel.requiredLeftMatching;
      requiredRightMatching = nextLevel.requiredRightMatching;

      // Safe remaining calculation: Never return negative remaining values
      bbRemaining = Math.max(0, Number((requiredBB - currentBB).toFixed(2)));
      leftRemaining = Math.max(0, Number((requiredLeftMatching - currentLeftMatching).toFixed(2)));
      rightRemaining = Math.max(0, Number((requiredRightMatching - currentRightMatching).toFixed(2)));

      bbPercentage = requiredBB > 0
        ? Math.min(100, Math.round((currentBB / requiredBB) * 100))
        : 100;
      leftPercentage = requiredLeftMatching > 0
        ? Math.min(100, Math.round((currentLeftMatching / requiredLeftMatching) * 100))
        : 100;
      rightPercentage = requiredRightMatching > 0
        ? Math.min(100, Math.round((currentRightMatching / requiredRightMatching) * 100))
        : 100;
    } else {
      // Max rank reached (e.g. Ruby) - no higher level
      requiredBB = currentLevel.requiredBB ?? 0;
      requiredLeftMatching = currentLevel.requiredLeftMatching ?? 0;
      requiredRightMatching = currentLevel.requiredRightMatching ?? 0;
      bbRemaining = 0;
      leftRemaining = 0;
      rightRemaining = 0;
      bbPercentage = 100;
      leftPercentage = 100;
      rightPercentage = 100;
    }

    const qualifiedForNextLevel = hasNext && bbRemaining === 0 && leftRemaining === 0 && rightRemaining === 0;

    return {
      currentLevel: {
        name: currentLevel.name,
        code: currentLevel.code,
      },
      currentBB,
      leftMatching: currentLeftMatching,
      rightMatching: currentRightMatching,
      nextLevel: nextLevel
        ? {
            name: nextLevel.name,
            requiredBB: nextLevel.requiredBB,
            requiredLeftMatching: nextLevel.requiredLeftMatching,
            requiredRightMatching: nextLevel.requiredRightMatching,
          }
        : null,
      progress: {
        bb: {
          current: currentBB,
          required: requiredBB,
          remaining: bbRemaining,
          percentage: bbPercentage,
        },
        leftMatching: {
          current: currentLeftMatching,
          required: requiredLeftMatching,
          remaining: leftRemaining,
          percentage: leftPercentage,
        },
        rightMatching: {
          current: currentRightMatching,
          required: requiredRightMatching,
          remaining: rightRemaining,
          percentage: rightPercentage,
        },
      },
      qualifiedForNextLevel,
    };
  }

  /**
   * Retrieves full rank progress for a distributor.
   *
   * @param memberId Member UUID or distributorCode
   * @param tx Optional Prisma transaction client
   */
  public static async getMemberRankProgress(
    memberId: string,
    tx?: Prisma.TransactionClient
  ): Promise<MemberRankProgressData> {
    const details = await LevelService.getMemberLevel(memberId, tx);

    const leftMatching = details.currentLeftMatching ?? (details as any).currentMatching ?? 0;
    const rightMatching = details.currentRightMatching ?? (details as any).currentMatching ?? 0;

    const nextLevelData = details.nextLevel
      ? {
          name: details.nextLevel.name,
          requiredBB: details.nextLevel.requiredBB,
          requiredLeftMatching: details.nextLevel.requiredLeftMatching ?? (details.nextLevel as any).requiredMatching ?? 0,
          requiredRightMatching: details.nextLevel.requiredRightMatching ?? (details.nextLevel as any).requiredMatching ?? 0,
        }
      : null;

    return this.computeProgress(
      details.currentBB,
      leftMatching,
      rightMatching,
      {
        name: details.currentLevel.name,
        code: details.currentLevel.code,
        requiredBB: details.currentLevel.requiredBB,
        requiredLeftMatching: details.currentLevel.requiredLeftMatching ?? (details.currentLevel as any).requiredMatching,
        requiredRightMatching: details.currentLevel.requiredRightMatching ?? (details.currentLevel as any).requiredMatching,
      },
      nextLevelData
    );
  }

  /**
   * Retrieves level details for a member.
   */
  public static async getMemberLevel(
    memberId: string,
    tx?: Prisma.TransactionClient
  ): Promise<MemberLevelDetails> {
    return LevelService.getMemberLevel(memberId, tx);
  }

  /**
   * Retrieves paginated level advancement history for a member.
   */
  public static async getMemberLevelHistory(
    memberId: string,
    options: LevelHistoryQueryOptions = {},
    tx?: Prisma.TransactionClient
  ): Promise<LevelHistoryResult> {
    return LevelService.getLevelHistory(memberId, options, tx);
  }
}
