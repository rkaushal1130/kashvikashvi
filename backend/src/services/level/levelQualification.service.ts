import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/appError';
import { BBService } from './bb.service';
import { MatchingService } from './matching.service';
import { MemberLevelStatus, MlmLevelConfig } from './level.types';

export const DEFAULT_MLM_LEVELS: MlmLevelConfig[] = [
  {
    level: 0,
    code: 'RANK_STARTER',
    name: 'Starter',
    commissionPercent: 0,
    requiredBB: 0,
    requiredLeftMatching: 0,
    requiredRightMatching: 0,
    requiredMatching: 0,
    binaryWeeklyCap: 500,
    oneTimeBonus: 0,
    description: 'Initial entry tier upon distributor registration.',
  },
  {
    level: 1,
    code: 'RANK_SILVER',
    name: 'Silver',
    commissionPercent: 24,
    requiredBB: 250,
    requiredLeftMatching: 2000,
    requiredRightMatching: 2000,
    requiredMatching: 2000,
    binaryWeeklyCap: 3000,
    oneTimeBonus: 150,
    description: 'Silver - 24%: 250 BV with min 2000 matching at left or 2000 matching at right.',
  },
  {
    level: 2,
    code: 'RANK_GOLD',
    name: 'Gold',
    commissionPercent: 8,
    requiredBB: 250,
    requiredLeftMatching: 5000,
    requiredRightMatching: 5000,
    requiredMatching: 5000,
    binaryWeeklyCap: 10000,
    oneTimeBonus: 500,
    description: 'Gold - 8%: 250 BV with min 5000 matching at left or 5000 matching at right.',
  },
  {
    level: 3,
    code: 'RANK_PLATINUM',
    name: 'Platinum',
    commissionPercent: 13,
    requiredBB: 500,
    requiredLeftMatching: 50000,
    requiredRightMatching: 50000,
    requiredMatching: 50000,
    binaryWeeklyCap: 25000,
    oneTimeBonus: 1500,
    description: 'Platinum - 13%: 500 BV with min 50000 matching at left or 50000 matching at right.',
  },
  {
    level: 4,
    code: 'RANK_DIAMOND',
    name: 'Diamond',
    commissionPercent: 5,
    requiredBB: 1000,
    requiredLeftMatching: 60000,
    requiredRightMatching: 60000,
    requiredMatching: 60000,
    binaryWeeklyCap: 50000,
    oneTimeBonus: 3000,
    description: 'Diamond - 5%: 1000 BV with min 60000 matching at left or 60000 matching at right.',
  },
  {
    level: 5,
    code: 'RANK_RUBY',
    name: 'Ruby',
    commissionPercent: 4,
    requiredBB: 1000,
    requiredLeftMatching: 100000,
    requiredRightMatching: 100000,
    requiredMatching: 100000,
    binaryWeeklyCap: 100000,
    oneTimeBonus: 5000,
    description: 'Ruby - 4%: 1000 BV with min 100000 matching at left or 100000 matching at right.',
  },
];

export class LevelQualificationService {
  /**
   * Ensures the 6 canonical MLM levels exist in the database Rank table.
   */
  public static async ensureRanks(tx?: Prisma.TransactionClient): Promise<void> {
    const db = tx || prisma;

    for (const lvl of DEFAULT_MLM_LEVELS) {
      const existing = await db.rank.findFirst({
        where: {
          OR: [{ rankCode: lvl.code }, { level: lvl.level }],
        },
      });

      if (!existing) {
        await db.rank.create({
          data: {
            rankCode: lvl.code,
            name: lvl.name,
            level: lvl.level,
            minPersonalBV: new Prisma.Decimal(lvl.requiredBB),
            minGroupBV: new Prisma.Decimal(lvl.requiredMatching ?? lvl.requiredLeftMatching),
            binaryWeeklyCap: new Prisma.Decimal(lvl.binaryWeeklyCap || 0),
            oneTimeBonus: new Prisma.Decimal(lvl.oneTimeBonus || 0),
          },
        });
        logger.info({ levelCode: lvl.code, name: lvl.name }, 'Initialized canonical MLM level in database');
      } else {
        // Update requirements if outdated
        await db.rank.update({
          where: { id: existing.id },
          data: {
            name: lvl.name,
            rankCode: lvl.code,
            minPersonalBV: new Prisma.Decimal(lvl.requiredBB),
            minGroupBV: new Prisma.Decimal(lvl.requiredMatching ?? lvl.requiredLeftMatching),
            binaryWeeklyCap: new Prisma.Decimal(lvl.binaryWeeklyCap || 0),
            oneTimeBonus: new Prisma.Decimal(lvl.oneTimeBonus || 0),
          },
        });
      }
    }
  }

  /**
   * Retrieves all configured levels ordered by level ascending.
   * Loads from database Level table (or Rank table fallback) to ensure dynamic configurability.
   */
  public static async getAllLevels(tx?: Prisma.TransactionClient): Promise<MlmLevelConfig[]> {
    const db = tx || prisma;
    try {
      // 1. First check configurable Level table
      const dbLevels = await (db as any).level?.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
      });

      if (dbLevels && dbLevels.length > 0) {
        const merged: MlmLevelConfig[] = DEFAULT_MLM_LEVELS.map((defLvl) => {
          const dbMatch = dbLevels.find((l: any) => l.order === defLvl.level || l.code?.toUpperCase() === defLvl.code?.toUpperCase());
          if (!dbMatch) return defLvl;
          return {
            id: dbMatch.id,
            level: dbMatch.order,
            code: dbMatch.code,
            name: dbMatch.name,
            commissionPercent: defLvl.commissionPercent ?? (dbMatch.commissionPercent !== undefined ? Number(dbMatch.commissionPercent) : 0),
            requiredBB: Number(dbMatch.requiredBB ?? defLvl.requiredBB),
            requiredLeftMatching: Number(dbMatch.requiredLeftMatching ?? dbMatch.requiredMatching ?? defLvl.requiredLeftMatching),
            requiredRightMatching: Number(dbMatch.requiredRightMatching ?? dbMatch.requiredMatching ?? defLvl.requiredRightMatching),
            requiredMatching: Number(dbMatch.requiredMatching ?? dbMatch.requiredLeftMatching ?? defLvl.requiredMatching),
            binaryWeeklyCap: defLvl.binaryWeeklyCap,
            oneTimeBonus: defLvl.oneTimeBonus,
            isActive: dbMatch.isActive,
            description: defLvl.description || `${dbMatch.name} level`,
          };
        });
        return merged;
      }

      // 2. Secondary: Check Rank table
      const ranks = await db.rank.findMany({
        orderBy: { level: 'asc' },
      });

      if (ranks && ranks.length > 0) {
        return ranks.map((r) => {
          const matched = DEFAULT_MLM_LEVELS.find((d) => d.level === r.level || d.code === r.rankCode);
          return {
            id: r.id,
            level: r.level,
            code: r.rankCode,
            name: r.name,
            commissionPercent: matched?.commissionPercent ?? 0,
            requiredBB: Number(r.minPersonalBV),
            requiredLeftMatching: matched?.requiredLeftMatching ?? Number(r.minGroupBV),
            requiredRightMatching: matched?.requiredRightMatching ?? Number(r.minGroupBV),
            requiredMatching: Number(r.minGroupBV),
            binaryWeeklyCap: Number(r.binaryWeeklyCap || 0),
            oneTimeBonus: Number(r.oneTimeBonus || 0),
            iconUrl: r.iconUrl,
          };
        });
      }
    } catch (err: any) {
      logger.warn({ error: err.message }, 'Failed to fetch levels from database; falling back to default level definitions');
    }

    return DEFAULT_MLM_LEVELS;
  }

  /**
   * Retrieves a specific level config by level number or code.
   */
  public static async getLevelByNumberOrCode(
    levelNumberOrCode: number | string,
    tx?: Prisma.TransactionClient
  ): Promise<MlmLevelConfig | null> {
    const all = await this.getAllLevels(tx);
    if (typeof levelNumberOrCode === 'number') {
      return all.find((l) => l.level === levelNumberOrCode) || null;
    }
    const clean = levelNumberOrCode.trim().toUpperCase();
    return (
      all.find(
        (l) =>
          l.code.toUpperCase() === clean ||
          l.name.toUpperCase() === clean ||
          l.code.toUpperCase() === `RANK_${clean}`
      ) || null
    );
  }

  /**
   * Updates a level configuration in the database dynamically.
   */
  public static async updateLevel(
    idOrCode: string,
    updates: Partial<MlmLevelConfig>,
    tx?: Prisma.TransactionClient
  ): Promise<MlmLevelConfig> {
    const db = tx || prisma;
    const clean = idOrCode.trim();
    const existing = await (db as any).level?.findFirst({
      where: {
        OR: [
          { id: clean },
          { code: clean.toUpperCase() },
          { code: `RANK_${clean.toUpperCase()}` },
        ],
      },
    });

    if (!existing) {
      throw AppError.notFound(`Level '${idOrCode}' not found`);
    }

    const updated = await (db as any).level?.update({
      where: { id: existing.id },
      data: {
        ...(updates.name ? { name: updates.name } : {}),
        ...(updates.requiredBB !== undefined ? { requiredBB: new Prisma.Decimal(updates.requiredBB) } : {}),
        ...(updates.requiredLeftMatching !== undefined ? { requiredLeftMatching: new Prisma.Decimal(updates.requiredLeftMatching) } : {}),
        ...(updates.requiredRightMatching !== undefined ? { requiredRightMatching: new Prisma.Decimal(updates.requiredRightMatching) } : {}),
        ...(updates.requiredMatching !== undefined ? { requiredMatching: new Prisma.Decimal(updates.requiredMatching) } : {}),
        ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
      },
    });

    return {
      id: updated.id,
      level: updated.order,
      code: updated.code,
      name: updated.name,
      requiredBB: Number(updated.requiredBB),
      requiredLeftMatching: Number(updated.requiredLeftMatching),
      requiredRightMatching: Number(updated.requiredRightMatching),
      requiredMatching: Number(updated.requiredMatching),
      isActive: updated.isActive,
    };
  }

  /**
   * Checks whether a member qualifies for a given level according to the THREE strict rules:
   * 1. member.currentBB >= level.requiredBB
   * 2. member.leftMatching >= level.requiredLeftMatching
   * 3. member.rightMatching >= level.requiredRightMatching
   * (Do NOT combine left and right matching into one totalMatching field)
   */
  public static isQualifiedForLevel(
    currentBB: number,
    leftMatchingOrTotal: number,
    rightMatchingOrLevel?: number | MlmLevelConfig,
    levelParam?: MlmLevelConfig,
    isAdmin: boolean = false,
    joiningsCount: number = 0
  ): boolean {
    const level = levelParam || (typeof rightMatchingOrLevel === 'object' && rightMatchingOrLevel !== null ? rightMatchingOrLevel : undefined);
    if (!level) return false;

    const reqLeft = level.requiredLeftMatching ?? level.requiredMatching ?? 0;
    const reqRight = level.requiredRightMatching ?? level.requiredMatching ?? 0;

    let leftMatching = leftMatchingOrTotal ?? 0;
    let rightMatching = typeof rightMatchingOrLevel === 'number' ? rightMatchingOrLevel : leftMatchingOrTotal;

    if (isAdmin) {
      const minJoinings =
        level.level === 1 ? 2 :
        level.level === 2 ? 5 :
        level.level === 3 ? 10 :
        level.level === 4 ? 20 :
        level.level === 5 ? 50 : 0;
      return leftMatching >= reqLeft || rightMatching >= reqRight || joiningsCount >= minJoinings;
    }

    const meetsBB = currentBB >= level.requiredBB;
    const meetsMatching = leftMatching >= reqLeft || rightMatching >= reqRight;
    return meetsBB && meetsMatching;
  }

  /**
   * Evaluates qualification status and progress toward next level for a distributor.
   */
  public static async evaluateQualification(
    distributorId: string,
    tx?: Prisma.TransactionClient
  ): Promise<MemberLevelStatus> {
    const db = tx || prisma;

    const distributor = await db.distributorProfile.findUnique({
      where: { id: distributorId },
      include: {
        currentRank: true,
        highestRank: true,
      },
    });

    if (!distributor) {
      throw AppError.notFound(`Distributor ${distributorId} not found`);
    }

    const { BinaryVolumeService } = await import('../binaryVolume.service');

    // 1. Calculate BB, Left Matching, and Right Matching independently!
    let [currentBB, leftMatching, rightMatching, leftVol, rightVol, levels] = await Promise.all([
      BBService.calculateCurrentBB(distributorId, db),
      BinaryVolumeService.getLeftMatching(distributorId, undefined, db),
      BinaryVolumeService.getRightMatching(distributorId, undefined, db),
      BinaryVolumeService.getLeftVolume(distributorId, undefined, db),
      BinaryVolumeService.getRightVolume(distributorId, undefined, db),
      this.getAllLevels(db),
    ]);

    if (currentBB === 0 && Number((distributor as any).currentBB ?? 0) > 0) {
      currentBB = Number((distributor as any).currentBB);
    }

    if (leftMatching === 0 && rightMatching === 0 && Number((distributor as any).currentMatching ?? 0) > 0) {
      leftMatching = Number((distributor as any).currentMatching);
      rightMatching = Number((distributor as any).currentMatching);
    }

    const totalMatching = Math.min(leftMatching, rightMatching);

    // 2. Determine highest level qualified for based on strict qualification formula:
    // currentBB >= level.requiredBB && leftMatching >= level.requiredLeftMatching && rightMatching >= level.requiredRightMatching
    let highestEligibleLevel = levels[0]; // defaults to STARTER / BASE

    for (const lvl of levels) {
      if (this.isQualifiedForLevel(currentBB, leftMatching, rightMatching, lvl)) {
        if (lvl.level >= highestEligibleLevel.level) {
          highestEligibleLevel = lvl;
        }
      }
    }

    // Resolve current member rank from DB if already set, or fallback to highest eligible
    let currentLevel = levels.find((l) => l.id === distributor.currentRankId || l.level === distributor.currentRank?.level) || highestEligibleLevel;

    // If distributor currently has a higher rank recorded, maintain continuity
    if (distributor.currentRank && distributor.currentRank.level > currentLevel.level) {
      const dbLvl = levels.find((l) => l.level === distributor.currentRank!.level);
      if (dbLvl) currentLevel = dbLvl;
    }

    // Resolve highest rank
    const highestLevel = levels.find((l) => l.id === distributor.highestRankId || l.level === distributor.highestRank?.level) || currentLevel;

    // 3. Determine Next Level
    const nextLevel = levels.find((l) => l.level === currentLevel.level + 1) || null;
    const isMaxLevel = nextLevel === null;

    // 4. Calculate progress metrics towards next level
    let bbGap = 0;
    let leftMatchingGap = 0;
    let rightMatchingGap = 0;
    let bbProgressPercentage = 100;
    let leftMatchingProgressPercentage = 100;
    let rightMatchingProgressPercentage = 100;
    let isQualifiedForNext = false;

    if (nextLevel) {
      const reqLeft = nextLevel.requiredLeftMatching ?? nextLevel.requiredMatching ?? 0;
      const reqRight = nextLevel.requiredRightMatching ?? nextLevel.requiredMatching ?? 0;

      bbGap = Math.max(0, Number((nextLevel.requiredBB - currentBB).toFixed(2)));
      leftMatchingGap = Math.max(0, Number((reqLeft - leftMatching).toFixed(2)));
      rightMatchingGap = Math.max(0, Number((reqRight - rightMatching).toFixed(2)));

      bbProgressPercentage =
        nextLevel.requiredBB > 0
          ? Math.min(100, Math.round((currentBB / nextLevel.requiredBB) * 100))
          : 100;

      leftMatchingProgressPercentage =
        reqLeft > 0
          ? Math.min(100, Math.round((leftMatching / reqLeft) * 100))
          : 100;

      rightMatchingProgressPercentage =
        reqRight > 0
          ? Math.min(100, Math.round((rightMatching / reqRight) * 100))
          : 100;

      isQualifiedForNext = this.isQualifiedForLevel(currentBB, leftMatching, rightMatching, nextLevel);
    }

    return {
      distributorId: distributor.id,
      distributorCode: distributor.distributorCode,
      displayName: distributor.displayName || `${distributor.firstName} ${distributor.lastName}`.trim(),
      currentBB,
      leftMatching,
      rightMatching,
      totalMatching,
      accumulatedLeftVolume: leftVol,
      accumulatedRightVolume: rightVol,
      currentLevel,
      highestLevel,
      nextLevel,
      isMaxLevel,
      progress: {
        bbGap,
        leftMatchingGap,
        rightMatchingGap,
        matchingGap: Math.max(leftMatchingGap, rightMatchingGap),
        bbProgressPercentage,
        leftMatchingProgressPercentage,
        rightMatchingProgressPercentage,
        matchingProgressPercentage: Math.min(leftMatchingProgressPercentage, rightMatchingProgressPercentage),
        isQualifiedForNext,
      },
      achievedAt: distributor.updatedAt,
    };
  }
}
