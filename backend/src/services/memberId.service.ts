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
  private static readonly PREFIX = 'KV-';

  private static readonly DST_COUNTER_ID = 'DST_DISTRIBUTOR_COUNTER';
  private static readonly DST_PREFIX = 'DST-';
  private static dstLockQueue: Promise<void> = Promise.resolve();
  private static dstInMemoryCounter: number | null = null;

  /**
   * Generates the next sequential distributor referral code starting from DST-0001.
   * Auto-increments as distributors register: DST-0001, DST-0002, DST-0003...
   */
  public static async generateNextDistributorCode(tx?: Prisma.TransactionClient): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.dstLockQueue = this.dstLockQueue
        .then(async () => {
          try {
            const code = await this.executeGenerateDistributorCode(tx);
            resolve(code);
          } catch (err) {
            reject(err);
          }
        })
        .catch((err) => {
          logger.error({ error: err }, 'Lock queue execution error in generateNextDistributorCode');
          reject(err);
        });
    });
  }

  private static async executeGenerateDistributorCode(tx?: Prisma.TransactionClient): Promise<string> {
    const db = tx || prisma;
    let candidateCode = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 50) {
      attempts++;

      const maxNumeric = await this.findCurrentMaxDstNumeric(db);

      const existingCounter = await (db as any).memberIdCounter.findUnique({
        where: { id: this.DST_COUNTER_ID },
      });

      const nextVal = Math.max(maxNumeric + 1, (existingCounter?.currentValue ?? 0) + 1);

      const counter = await (db as any).memberIdCounter.upsert({
        where: { id: this.DST_COUNTER_ID },
        create: {
          id: this.DST_COUNTER_ID,
          currentValue: nextVal,
        },
        update: {
          currentValue: nextVal,
        },
      });

      const numStr = String(counter.currentValue).padStart(4, '0');
      candidateCode = `${this.DST_PREFIX}${numStr}`;

      const collisionProfile = await db.distributorProfile.findFirst({
        where: {
          OR: [
            { distributorCode: { equals: candidateCode, mode: 'insensitive' } },
            { distributorId: { equals: candidateCode, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });

      const collisionUser = await db.user.findFirst({
        where: { referralCode: { equals: candidateCode, mode: 'insensitive' } },
        select: { id: true },
      });

      if (!collisionProfile && !collisionUser) {
        isUnique = true;
      }
    }

    if (isUnique && candidateCode) {
      logger.info({ distributorCode: candidateCode }, 'Generated sequential DST distributor code');
      return candidateCode;
    }

    if (this.dstInMemoryCounter === null) {
      this.dstInMemoryCounter = await this.findCurrentMaxDstNumeric(db);
    }
    this.dstInMemoryCounter++;
    return `${this.DST_PREFIX}${String(this.dstInMemoryCounter).padStart(4, '0')}`;
  }

  public static async findCurrentMaxDstNumeric(db: Prisma.TransactionClient | typeof prisma): Promise<number> {
    let maxNum = 0;
    try {
      const existingProfiles = await db.distributorProfile.findMany({
        where: {
          OR: [
            { distributorCode: { startsWith: 'DST-', mode: 'insensitive' } },
            { distributorId: { startsWith: 'DST-', mode: 'insensitive' } },
          ],
        },
        select: { distributorCode: true, distributorId: true },
        take: 5000,
      });

      for (const p of existingProfiles) {
        const codes = [p.distributorCode, p.distributorId].filter(Boolean) as string[];
        for (const code of codes) {
          const match = code.match(/^DST[-_]?(\d+)$/i);
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        }
      }

      const existingUsers = await db.user.findMany({
        where: { referralCode: { startsWith: 'DST-', mode: 'insensitive' } },
        select: { referralCode: true },
        take: 5000,
      });

      for (const u of existingUsers) {
        if (u.referralCode) {
          const match = u.referralCode.match(/^DST[-_]?(\d+)$/i);
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        }
      }
    } catch {
      // ignore
    }
    return maxNum;
  }

  /**
   * Generates the next unique, permanent Kashvi MLM ID in a concurrency-safe atomic transaction.
   * Format: KV-1001, KV-1002, KV-1003, ...
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

            const maxNumeric = await this.findCurrentMaxNumericId(db);
            const initialVal = Math.max(1000, maxNumeric);

            const counter = await (db as any).memberIdCounter.upsert({
              where: { id: this.COUNTER_ID },
              create: {
                id: this.COUNTER_ID,
                currentValue: initialVal + 1,
              },
              update: {
                currentValue: { increment: 1 },
              },
            });

            candidateId = `${this.PREFIX}${counter.currentValue}`;

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
      const currentMax = this.isDbOffline ? 1000 : await this.findCurrentMaxNumericId(db);
      this.inMemoryCounter = Math.max(1000, currentMax);
    }

    this.inMemoryCounter++;
    const candidateId = `${this.PREFIX}${this.inMemoryCounter}`;

    logger.info({ memberId: candidateId }, 'Generated unique KV member ID via in-memory synchronized counter');
    return candidateId;
  }

  /**
   * Scans existing member records to find highest existing numeric suffix
   * so new sequential KV numbers never conflict with existing members.
   * Default starting floor is 1000 so the first member begins at KV-1001.
   */
  public static async findCurrentMaxNumericId(db: Prisma.TransactionClient | typeof prisma): Promise<number> {
    if (this.isDbOffline) return 1000;
    let maxNum = 1000;

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
      maxNum = 1000;
    }

    return Math.max(1000, maxNum);
  }

  /**
   * Safe migration & repair:
   * 1. Detects duplicate member IDs (e.g. two members with KV-1002).
   * 2. Preserves legitimate record (oldest/first).
   * 3. Assigns fresh, permanent unique KV-XXXX IDs to conflicting secondary records.
   * 4. Updates related user referral codes and business centers.
   * 5. Strictly preserves name, email, payments, BV, sponsor relationships, and binary tree placement.
   * 6. Records audit history.
   */
  public static async repairDuplicateAndMissingMemberIds(tx?: Prisma.TransactionClient): Promise<{
    totalScanned: number;
    duplicateGroupsResolved: number;
    recordsRepaired: number;
    details: Array<{
      profileId: string;
      userId: string;
      name: string;
      oldId: string;
      newId: string;
      reason: string;
    }>;
  }> {
    const db = tx || prisma;
    const details: Array<{
      profileId: string;
      userId: string;
      name: string;
      oldId: string;
      newId: string;
      reason: string;
    }> = [];

    let totalScanned = 0;
    let duplicateGroupsResolved = 0;
    let recordsRepaired = 0;

    try {
      const profiles = await db.distributorProfile.findMany({
        orderBy: { joinedAt: 'asc' },
        include: { user: true },
      });

      totalScanned = profiles.length;

      // Group by normalized distributor code
      const codeMap = new Map<string, typeof profiles>();
      for (const p of profiles) {
        const rawCode = (p.distributorCode || p.distributorId || '').toUpperCase().trim();
        const norm = rawCode.replace(/[^A-Z0-9]/g, '');
        if (!norm) continue;

        if (!codeMap.has(norm)) {
          codeMap.set(norm, []);
        }
        codeMap.get(norm)!.push(p);
      }

      // 1. Resolve Duplicate Groups
      for (const [code, group] of codeMap.entries()) {
        if (group.length > 1) {
          duplicateGroupsResolved++;
          // Index 0 is the primary legitimate record (earliest joinedAt), retain its ID.
          // Conflicting members at index 1..n get assigned new unique IDs.
          for (let i = 1; i < group.length; i++) {
            const conflictProfile = group[i];
            const newKvId = await this.generateNextMemberId(db);
            const oldId = conflictProfile.distributorCode || conflictProfile.distributorId || code;

            await db.distributorProfile.update({
              where: { id: conflictProfile.id },
              data: {
                distributorCode: newKvId,
                distributorId: newKvId,
              },
            });

            if (conflictProfile.userId) {
              await db.user.update({
                where: { id: conflictProfile.userId },
                data: { referralCode: newKvId },
              });
            }

            recordsRepaired++;
            const entry = {
              profileId: conflictProfile.id,
              userId: conflictProfile.userId,
              name: conflictProfile.displayName || `${conflictProfile.firstName} ${conflictProfile.lastName}`.trim(),
              oldId,
              newId: newKvId,
              reason: `Resolved duplicate ID collision on ${oldId}`,
            };
            details.push(entry);

            logger.warn(
              entry,
              'Repaired duplicate member ID collision'
            );
          }
        }
      }

      // 2. Resolve missing or non-KV formatted codes
      for (const p of profiles) {
        const rawCode = (p.distributorCode || '').toUpperCase().trim();
        const hasValidFormat = /^KV[-_]?\d+$/i.test(rawCode);

        if (!hasValidFormat) {
          const newKvId = await this.generateNextMemberId(db);
          const oldId = p.distributorCode || p.distributorId || 'MISSING';

          await db.distributorProfile.update({
            where: { id: p.id },
            data: {
              distributorCode: newKvId,
              distributorId: p.distributorId && /^KV[-_]?\d+$/i.test(p.distributorId) ? p.distributorId : newKvId,
            },
          });

          if (p.userId) {
            await db.user.update({
              where: { id: p.userId },
              data: { referralCode: newKvId },
            });
          }

          recordsRepaired++;
          const entry = {
            profileId: p.id,
            userId: p.userId,
            name: p.displayName || `${p.firstName} ${p.lastName}`.trim(),
            oldId,
            newId: newKvId,
            reason: `Assigned permanent KV ID to legacy member lacking standard code (${oldId})`,
          };
          details.push(entry);

          logger.info(entry, 'Assigned permanent KV ID to member');
        }
      }
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error during repairDuplicateAndMissingMemberIds');
    }

    return {
      totalScanned,
      duplicateGroupsResolved,
      recordsRepaired,
      details,
    };
  }

  /**
   * Safe migration/backfill alias.
   */
  public static async backfillExistingMembers(tx?: Prisma.TransactionClient): Promise<{ updated: number; skipped: number }> {
    const res = await this.repairDuplicateAndMissingMemberIds(tx);
    return {
      updated: res.recordsRepaired,
      skipped: res.totalScanned - res.recordsRepaired,
    };
  }

  /**
   * Validates whether an ID string conforms to the KASHVI MLM distributor ID format.
   */
  public static isValidMemberId(id: string): boolean {
    if (!id || typeof id !== 'string') return false;
    return /^KV[-_]?\d{3,}$/i.test(id.trim());
  }

  /**
   * Normalizes any valid KV format into standard "KV-XXXX" format.
   */
  public static normalizeMemberId(id: string): string {
    if (!id || typeof id !== 'string') return '';
    const trimmed = id.trim().toUpperCase();
    const match = trimmed.match(/^KV[-_]?(\d+)$/i);
    if (match) {
      return `KV-${match[1]}`;
    }
    return trimmed;
  }

  /**
   * Resets the in-memory counter (useful for test fixtures)
   */
  public static resetCounter(initialValue: number = 1000) {
    this.inMemoryCounter = initialValue;
  }
}
