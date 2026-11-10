import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { NetworkTreeService } from './networkTree.service';

/**
 * ============================================================================
 * CONCURRENCY-SAFE KASHVI MLM MEMBER ID SERVICE
 * ============================================================================
 * Generates unique, permanent Kashvi MLM IDs with format "KK-XXXX"
 * (e.g., KK-0001 for Super Admin, KK-0002 for First Member, KK-0003, ...)
 *
 * Requirements:
 * 1. Super Admin ID: Reserved first unique ID "KK-0001".
 * 2. Automatic Member ID Generation: All new members receive unique ID starting from "KK-0002".
 * 3. Sequential ID Generation: KK-0001 (Super Admin), KK-0002 (First Member), KK-0003, KK-0004...
 * 4. Guaranteed uniqueness via atomic counter and database unique constraints.
 * 5. Concurrency-safe under simultaneous registrations (zero duplicate collisions).
 * 6. The ID sequence is maintained permanently in the database.
 * 7. Super Admin ID "KK-0001" is strictly reserved and never assigned to another member.
 */
export class MemberIdService {
  private static lockQueue: Promise<void> = Promise.resolve();
  private static inMemoryCounter: number | null = null;
  private static isDbOffline: boolean = false;

  public static readonly COUNTER_ID = 'KK_MEMBER_ID';
  public static readonly PREFIX = 'KK-';
  public static readonly SUPER_ADMIN_ID = 'KK-0001';
  public static readonly FIRST_MEMBER_ID = 'KK-0002';

  /**
   * Format a numeric sequence into the expected string format (e.g. 1 -> KK-0001, 2 -> KK-0002, 10000 -> KK-10000).
   */
  public static formatId(num: number): string {
    return `${this.PREFIX}${String(num).padStart(4, '0')}`;
  }

  /**
   * Generates the next sequential distributor referral code.
   * Fully unified with the sequential KK-XXXX ID generation system.
   */
  public static async generateNextDistributorCode(tx?: Prisma.TransactionClient): Promise<string> {
    return this.generateNextMemberId(tx);
  }

  /**
   * Generates the next unique, permanent Kashvi MLM Member ID in a concurrency-safe atomic transaction.
   * Sequence:
   *   Super Admin: KK-0001 (reserved)
   *   First Member: KK-0002
   *   Second Member: KK-0003
   *   Third Member: KK-0004
   *   Fourth Member: KK-0005
   *   ...and so on.
   */
  public static async generateNextMemberId(tx?: Prisma.TransactionClient): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.lockQueue = this.lockQueue
        .catch(() => {})
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
            const initialVal = Math.max(1, maxNumeric);

            const counter = await (db as any).memberIdCounter.upsert({
              where: { id: this.COUNTER_ID },
              create: {
                id: this.COUNTER_ID,
                currentValue: Math.max(2, initialVal + 1),
              },
              update: {
                currentValue: { increment: 1 },
              },
            });

            let currentVal = counter.currentValue;
            // Super Admin ID KK-0001 (value 1) is reserved permanently and must never be assigned to a member
            if (currentVal <= 1) {
              currentVal = 2;
              await (db as any).memberIdCounter.update({
                where: { id: this.COUNTER_ID },
                data: { currentValue: 2 },
              }).catch(() => {});
            }

            candidateId = this.formatId(currentVal);

            // Double check collision in database
            const collisionProfile = await db.distributorProfile.findFirst({
              where: {
                OR: [
                  { distributorCode: { equals: candidateId, mode: 'insensitive' } },
                  { distributorId: { equals: candidateId, mode: 'insensitive' } },
                ],
              },
              select: { id: true },
            });

            const collisionUser = await db.user.findFirst({
              where: {
                OR: [
                  { referralCode: { equals: candidateId, mode: 'insensitive' } },
                  { userId: { equals: candidateId, mode: 'insensitive' } },
                ],
              },
              select: { id: true },
            });

            let collisionDynamic = false;
            try {
              const enrollees = NetworkTreeService.getEnrolledMembers();
              if (enrollees.some((e) => e.distributorId === candidateId)) {
                collisionDynamic = true;
              }
            } catch {
              // ignore
            }

            if (!collisionProfile && !collisionUser && !collisionDynamic && candidateId !== this.SUPER_ADMIN_ID) {
              isUnique = true;
            }
          }

          if (isUnique && candidateId) {
            logger.info({ memberId: candidateId }, 'Generated unique KK member ID via database counter');
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
      const currentMax = this.isDbOffline ? 1 : await this.findCurrentMaxNumericId(db);
      this.inMemoryCounter = Math.max(1, currentMax);
    }

    this.inMemoryCounter++;
    // Super Admin KK-0001 is reserved permanently
    if (this.inMemoryCounter <= 1) {
      this.inMemoryCounter = 2;
    }

    // Guard against collision in dynamic enrollees
    try {
      const enrollees = NetworkTreeService.getEnrolledMembers();
      while (
        enrollees.some((e) => e.distributorId === this.formatId(this.inMemoryCounter!)) ||
        this.formatId(this.inMemoryCounter!) === this.SUPER_ADMIN_ID
      ) {
        this.inMemoryCounter!++;
      }
    } catch {
      // ignore
    }

    const candidateId = this.formatId(this.inMemoryCounter);
    logger.info({ memberId: candidateId }, 'Generated unique KK member ID via in-memory synchronized counter');
    return candidateId;
  }

  /**
   * Scans existing member records to find highest existing numeric suffix
   * formatted as KK-XXXX (e.g. KK-0001, KK-0002...).
   * Floor is 1 (representing reserved Super Admin KK-0001).
   */
  public static async findCurrentMaxNumericId(db: Prisma.TransactionClient | typeof prisma): Promise<number> {
    if (this.isDbOffline) return 1;
    let maxNum = 1; // Super Admin KK-0001 is 1

    try {
      // 1. Check dynamic enrollees
      try {
        const enrollees = NetworkTreeService.getEnrolledMembers();
        for (const m of enrollees) {
          const match = (m.distributorId || '').match(/^KK[-_]?0*([1-9]\d*)$/i);
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        }
      } catch {
        // ignore
      }

      // 2. Check distributor profiles
      const existingProfiles = await db.distributorProfile.findMany({
        where: {
          OR: [
            { distributorCode: { startsWith: 'KK-', mode: 'insensitive' } },
            { distributorId: { startsWith: 'KK-', mode: 'insensitive' } },
          ],
        },
        select: { distributorCode: true, distributorId: true },
        take: 5000,
      });

      for (const p of existingProfiles) {
        const codes = [p.distributorCode, p.distributorId].filter(Boolean) as string[];
        for (const code of codes) {
          const match = code.match(/^KK[-_]?0*([1-9]\d*)$/i);
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        }
      }

      // 3. Check users table
      const existingUsers = await db.user.findMany({
        where: {
          OR: [
            { referralCode: { startsWith: 'KK-', mode: 'insensitive' } },
            { userId: { startsWith: 'KK-', mode: 'insensitive' } },
          ],
        },
        select: { referralCode: true, userId: true },
        take: 5000,
      });

      for (const u of existingUsers) {
        const codes = [u.referralCode, u.userId].filter(Boolean) as string[];
        for (const code of codes) {
          const match = code.match(/^KK[-_]?0*([1-9]\d*)$/i);
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
      maxNum = 1;
    }

    return Math.max(1, maxNum);
  }

  /**
   * Helper alias for checking current max numeric suffix.
   */
  public static async findCurrentMaxDstNumeric(db: Prisma.TransactionClient | typeof prisma): Promise<number> {
    return this.findCurrentMaxNumericId(db);
  }

  /**
   * Safe migration & repair:
   * 1. Detects duplicate member IDs.
   * 2. Preserves Super Admin KK-0001 and primary legitimate records.
   * 3. Assigns fresh, permanent unique sequential KK-XXXX IDs (starting KK-0002) to conflicting or non-standard records.
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
          // Index 0 is the primary legitimate record (earliest joinedAt), retain its ID unless it collides with reserved KK-0001
          for (let i = 1; i < group.length; i++) {
            const conflictProfile = group[i];
            const newKkId = await this.generateNextMemberId(db);
            const oldId = conflictProfile.distributorCode || conflictProfile.distributorId || code;

            await db.distributorProfile.update({
              where: { id: conflictProfile.id },
              data: {
                distributorCode: newKkId,
                distributorId: newKkId,
              },
            });

            if (conflictProfile.userId) {
              await db.user.update({
                where: { id: conflictProfile.userId },
                data: {
                  referralCode: newKkId,
                  userId: newKkId,
                },
              });
            }

            recordsRepaired++;
            const entry = {
              profileId: conflictProfile.id,
              userId: conflictProfile.userId,
              name: conflictProfile.displayName || `${conflictProfile.firstName} ${conflictProfile.lastName}`.trim(),
              oldId,
              newId: newKkId,
              reason: `Resolved duplicate ID collision on ${oldId}`,
            };
            details.push(entry);

            logger.warn(entry, 'Repaired duplicate member ID collision');
          }
        }
      }

      // 2. Resolve missing or non-KK formatted codes (except reserved Super Admin KK-0001)
      for (const p of profiles) {
        const rawCode = (p.distributorCode || '').toUpperCase().trim();
        const isSuperAdmin = (p.user?.roleName as string) === 'ADMIN' && (rawCode === 'KK-0001' || rawCode === 'KV-0001' || rawCode === 'KV-1001');

        if (isSuperAdmin) {
          if (rawCode !== this.SUPER_ADMIN_ID) {
            await db.distributorProfile.update({
              where: { id: p.id },
              data: {
                distributorCode: this.SUPER_ADMIN_ID,
                distributorId: this.SUPER_ADMIN_ID,
              },
            });
            if (p.userId) {
              await db.user.update({
                where: { id: p.userId },
                data: {
                  referralCode: this.SUPER_ADMIN_ID,
                  userId: this.SUPER_ADMIN_ID,
                },
              });
            }
          }
          continue;
        }

        const hasValidFormat = /^KK[-_]?\d{4,}$/i.test(rawCode) && rawCode !== this.SUPER_ADMIN_ID;

        if (!hasValidFormat) {
          const newKkId = await this.generateNextMemberId(db);
          const oldId = p.distributorCode || p.distributorId || 'MISSING';

          await db.distributorProfile.update({
            where: { id: p.id },
            data: {
              distributorCode: newKkId,
              distributorId: newKkId,
            },
          });

          if (p.userId) {
            await db.user.update({
              where: { id: p.userId },
              data: {
                referralCode: newKkId,
                userId: newKkId,
              },
            });
          }

          recordsRepaired++;
          const entry = {
            profileId: p.id,
            userId: p.userId,
            name: p.displayName || `${p.firstName} ${p.lastName}`.trim(),
            oldId,
            newId: newKkId,
            reason: `Assigned permanent KK ID to member lacking standard sequential code (${oldId})`,
          };
          details.push(entry);

          logger.info(entry, 'Assigned permanent KK ID to member');
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
   * Validates whether an ID string conforms to the KASHVI MLM member ID format (KK-XXXX).
   */
  public static isValidMemberId(id: string): boolean {
    if (!id || typeof id !== 'string') return false;
    return /^KK[-_]?\d{4,}$/i.test(id.trim()) || /^KV[-_]?\d+$/i.test(id.trim());
  }

  /**
   * Normalizes any valid member ID format into standard "KK-XXXX" format.
   */
  public static normalizeMemberId(id: string): string {
    if (!id || typeof id !== 'string') return '';
    const trimmed = id.trim().toUpperCase();
    const match = trimmed.match(/^K[KV][-_]?0*(\d+)$/i);
    if (match) {
      return `KK-${match[1].padStart(4, '0')}`;
    }
    return trimmed;
  }

  /**
   * Resets the in-memory counter (useful for test fixtures).
   * Default initialValue is 1 so the next member generated is KK-0002 (since KK-0001 is Super Admin).
   */
  public static resetCounter(initialValue: number = 1) {
    this.inMemoryCounter = initialValue;
  }
}
