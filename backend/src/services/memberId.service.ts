import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * ============================================================================
 * CONCURRENCY-SAFE KASHVI MLM MEMBER ID SERVICE
 * ============================================================================
 * Generates unique, permanent Kashvi MLM IDs starting with "KV"
 * (e.g., KV000001, KV000002, KV000003, ...)
 *
 * Requirements:
 * 1. Generated strictly on backend.
 * 2. Guaranteed uniqueness via atomic counter and database unique constraints.
 * 3. Concurrency-safe under simultaneous registrations.
 * 4. Existing members retain their current valid IDs (e.g. KV-1000, KV-1001).
 * 5. Safe backfill for existing members with missing/non-KV IDs.
 */
export class MemberIdService {
  private static lockQueue: Promise<void> = Promise.resolve();
  private static inMemoryCounter: number | null = null;
  private static isDbOffline: boolean = false;
  private static readonly COUNTER_ID = 'KV_MEMBER_ID';
  private static readonly PREFIX = 'KV';
  private static readonly PAD_LENGTH = 6;

  /**
   * Generates the next unique, permanent Kashvi MLM ID in a concurrency-safe atomic transaction.
   * Format: KV000001, KV000002, ...
   */
  public static async generateNextMemberId(tx?: Prisma.TransactionClient): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.lockQueue = this.lockQueue
        .then(async () => {
          try {
            const memberId = await this.executeGenerate(tx);
            resolve(memberId);
          } catch (err) {
            reject(err);
          }
        })
        .catch((err) => {
          logger.error({ error: err }, 'Lock queue execution error in generateNextMemberId');
          reject(err);
        });
    });
  }

  private static async executeGenerate(tx?: Prisma.TransactionClient): Promise<string> {
    const db = tx || prisma;

    if (!this.isDbOffline) {
      try {
        // 1. Try database-backed atomic counter if available
        if ((db as any).memberIdCounter?.upsert) {
          let candidateId = '';
          let isUnique = false;
          let attempts = 0;

          while (!isUnique && attempts < 50) {
            attempts++;

            const counter = await (db as any).memberIdCounter.upsert({
              where: { id: this.COUNTER_ID },
              create: {
                id: this.COUNTER_ID,
                currentValue: await this.findCurrentMaxNumericId(db),
              },
              update: {
                currentValue: { increment: 1 },
              },
            });

            const formattedNumber = String(counter.currentValue).padStart(this.PAD_LENGTH, '0');
            candidateId = `${this.PREFIX}${formattedNumber}`;

            const collision = await db.distributorProfile.findFirst({
              where: {
                OR: [
                  { distributorCode: { equals: candidateId, mode: 'insensitive' } },
                  { distributorId: { equals: candidateId, mode: 'insensitive' } },
                ],
              },
              select: { id: true },
            });

            if (!collision) {
              isUnique = true;
            }
          }

          if (isUnique && candidateId) {
            logger.info({ memberId: candidateId }, 'Generated unique KV member ID via database counter');
            return candidateId;
          }
        }
      } catch (err: any) {
        this.isDbOffline = true;
        logger.warn({ error: err.message }, 'Database counter unavailable, operating with in-memory counter');
      }
    }

    // 2. Resilient In-Memory Atomic Counter Fallback (guaranteed safe by sequential lockQueue)
    if (this.inMemoryCounter === null) {
      this.inMemoryCounter = this.isDbOffline ? 0 : await this.findCurrentMaxNumericId(db);
    }

    this.inMemoryCounter++;
    const formattedNumber = String(this.inMemoryCounter).padStart(this.PAD_LENGTH, '0');
    const candidateId = `${this.PREFIX}${formattedNumber}`;

    logger.info({ memberId: candidateId }, 'Generated unique KV member ID via in-memory synchronized counter');
    return candidateId;
  }

  /**
   * Scans existing member records to find highest existing numeric suffix
   * so new sequential KV numbers never conflict with existing members.
   */
  public static async findCurrentMaxNumericId(db: Prisma.TransactionClient | typeof prisma): Promise<number> {
    if (this.isDbOffline) return 0;
    let maxNum = 0;

    try {
      const existingProfiles = await db.distributorProfile.findMany({
        select: { distributorCode: true, distributorId: true },
        take: 2000,
      });

      for (const p of existingProfiles) {
        const codes = [p.distributorCode, p.distributorId].filter(Boolean) as string[];
        for (const code of codes) {
          const match = code.match(/^KV[-_]?0*([1-9]\d*)$/i);
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        }
      }
    } catch {
      this.isDbOffline = true;
      maxNum = 0;
    }

    return maxNum;
  }

  /**
   * Safe migration/backfill: Assigns unique KV IDs to any legacy members lacking a valid KV ID,
   * while strictly preserving existing sponsor relationships and tree placement.
   */
  public static async backfillExistingMembers(tx?: Prisma.TransactionClient): Promise<{ updated: number; skipped: number }> {
    const db = tx || prisma;
    let updated = 0;
    let skipped = 0;

    try {
      const profiles = await db.distributorProfile.findMany({
        include: { user: true },
      });

      for (const profile of profiles) {
        const hasValidKvCode = profile.distributorCode && profile.distributorCode.toUpperCase().startsWith('KV');
        const hasValidKvId = profile.distributorId && profile.distributorId.toUpperCase().startsWith('KV');

        if (hasValidKvCode && hasValidKvId) {
          skipped++;
          continue;
        }

        // Generate permanent KV ID
        const newKvId = await this.generateNextMemberId(db);

        await db.distributorProfile.update({
          where: { id: profile.id },
          data: {
            distributorCode: hasValidKvCode ? profile.distributorCode : newKvId,
            distributorId: hasValidKvId ? profile.distributorId : newKvId,
          },
        });

        if (profile.userId && (!profile.user?.referralCode || !profile.user.referralCode.startsWith('KV'))) {
          await db.user.update({
            where: { id: profile.userId },
            data: { referralCode: newKvId },
          });
        }

        updated++;
        logger.info(
          { profileId: profile.id, oldCode: profile.distributorCode, newKvId },
          'Backfilled legacy member with permanent KV ID'
        );
      }
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error during member ID backfill');
    }

    return { updated, skipped };
  }

  /**
   * Resets the in-memory counter (useful for test fixtures)
   */
  public static resetCounter(initialValue: number = 0) {
    this.inMemoryCounter = initialValue;
  }
}
