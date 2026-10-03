import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';

export interface UplineNode {
  level: number; // 1 to 5 (or maxDepth)
  distributorId: string; // UUID primary key
  distributorCode: string; // e.g. KV-1001 or DST-10001
  displayName: string;
  status: string; // ACTIVE, INACTIVE, SUSPENDED, TERMINATED
  sponsorId: string | null;
  isDirect: boolean;
  isActive: boolean;
  isEligibleForCommission: boolean;
}

export interface SkippedUplineLevel {
  level: number;
  reason: 'NO_UPLINE_EXISTS' | 'UPLINE_INACTIVE' | 'UPLINE_DELETED' | 'CIRCULAR_REFERENCE';
  uplineNode?: UplineNode;
}

export interface CommissionEligibilityReport {
  memberId: string;
  distributorCode: string;
  maxDepth: number;
  eligibleUplines: UplineNode[];
  allUplines: UplineNode[];
  skippedLevels: SkippedUplineLevel[];
}

export interface MemberProfileRecord {
  id: string;
  distributorId: string | null;
  distributorCode: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  status: string;
  sponsorId: string | null;
  deletedAt: Date | null;
}

export interface SponsorValidationResult {
  isValid: boolean;
  reason?: string;
  code?: string;
  sponsorNode?: UplineNode;
}

/**
 * SponsorUplineService
 *
 * Dedicated service for unilevel genealogy traversal and sponsor upline resolution.
 *
 * CRITICAL BUSINESS INVARIANTS:
 * 1. Commission Level 1-5 is strictly based on the SPONSOR/UPLINE relationship.
 * 2. It is NOT based on binary LEFT/RIGHT placement (MLMNode).
 * 3. Never use the binary placement tree to determine commission levels.
 * 4. Level 1 = Direct sponsor, Level 2 = Sponsor's sponsor, ..., Level 5 = 5th upline.
 * 5. If an upline level does not exist, no recipient is created. NEVER create fake recipients.
 * 6. Defensive against: circular relationships, self-sponsorship, missing links, inactive/deleted users, and excessive depth.
 */
export class SponsorUplineService {
  public static readonly DEFAULT_MAX_DEPTH = 5;
  public static readonly HARD_MAX_DEPTH = 25;

  /**
   * Helper: Resolves a member profile by UUID id, distributorId, or distributorCode.
   */
  public static async resolveMemberProfile(
    memberIdentifier: string,
    client?: Prisma.TransactionClient
  ): Promise<MemberProfileRecord> {
    const db = client || prisma;
    const cleanId = (memberIdentifier || '').trim();

    if (!cleanId) {
      throw AppError.badRequest('Member identifier is required', 'MEMBER_ID_REQUIRED');
    }

    const member = await db.distributorProfile.findFirst({
      where: {
        OR: [
          { id: cleanId },
          { distributorId: cleanId },
          { distributorCode: cleanId },
        ],
      },
      select: {
        id: true,
        distributorId: true,
        distributorCode: true,
        firstName: true,
        lastName: true,
        displayName: true,
        status: true,
        sponsorId: true,
        deletedAt: true,
      },
    });

    if (!member) {
      throw AppError.notFound(`Member '${cleanId}' not found`, 'MEMBER_NOT_FOUND');
    }

    return member;
  }

  /**
   * Helper: Formats a database distributor profile record into a standard UplineNode.
   */
  private static formatUplineNode(
    profile: {
      id: string;
      distributorId?: string | null;
      distributorCode?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      displayName?: string | null;
      status: string;
      sponsorId?: string | null;
      deletedAt?: Date | null;
    },
    level: number
  ): UplineNode {
    const name =
      profile.displayName?.trim() ||
      `${profile.firstName || ''} ${profile.lastName || ''}`.trim() ||
      profile.distributorCode ||
      profile.distributorId ||
      profile.id;

    const isNotDeleted = !profile.deletedAt;
    const isActive = profile.status === 'ACTIVE' && isNotDeleted;

    return {
      level,
      distributorId: profile.id,
      distributorCode: profile.distributorCode || profile.distributorId || profile.id,
      displayName: name,
      status: profile.status,
      sponsorId: profile.sponsorId || null,
      isDirect: level === 1,
      isActive,
      isEligibleForCommission: isActive,
    };
  }

  /**
   * getSponsor(memberId)
   *
   * Retrieves the direct sponsor (Generation Level 1) of a member.
   * Returns null if the member has no sponsor (e.g. root/top of tree).
   * Throws if member does not exist or has an invalid self-sponsor relationship.
   */
  public static async getSponsor(
    memberId: string,
    client?: Prisma.TransactionClient
  ): Promise<UplineNode | null> {
    const db = client || prisma;
    const member = await this.resolveMemberProfile(memberId, client);

    if (!member.sponsorId) {
      return null;
    }

    // Defensive check: Self-sponsorship guard
    if (member.sponsorId === member.id) {
      logger.error(
        { memberId: member.id, sponsorId: member.sponsorId },
        'Self-sponsorship detected on distributor profile'
      );
      throw AppError.badRequest(
        `Invalid sponsor relationship: Member '${member.distributorCode || member.id}' cannot sponsor themselves`,
        'SELF_SPONSOR_FORBIDDEN'
      );
    }

    const sponsor: MemberProfileRecord | null = await db.distributorProfile.findUnique({
      where: { id: member.sponsorId },
      select: {
        id: true,
        distributorId: true,
        distributorCode: true,
        firstName: true,
        lastName: true,
        displayName: true,
        status: true,
        sponsorId: true,
        deletedAt: true,
      },
    });

    if (!sponsor) {
      logger.warn(
        { memberId: member.id, sponsorId: member.sponsorId },
        'Direct sponsor record not found (dangling reference)'
      );
      return null;
    }

    return this.formatUplineNode(sponsor, 1);
  }

  /**
   * getUpline(memberId, depth)
   *
   * Retrieves the specific upline at generation `depth` (1 <= depth <= 25).
   * Level 1 = Direct sponsor
   * Level 2 = Sponsor's sponsor
   * Level 3 = Third upline
   * Level 4 = Fourth upline
   * Level 5 = Fifth upline
   *
   * Returns null if the upline chain terminates before reaching the requested depth.
   * NEVER creates a fake recipient.
   */
  public static async getUpline(
    memberId: string,
    depth: number,
    client?: Prisma.TransactionClient
  ): Promise<UplineNode | null> {
    if (!Number.isInteger(depth) || depth < 1) {
      throw AppError.badRequest('Upline depth must be an integer >= 1', 'INVALID_UPLINE_DEPTH');
    }

    if (depth > this.HARD_MAX_DEPTH) {
      throw AppError.badRequest(
        `Upline depth exceeds maximum allowed limit of ${this.HARD_MAX_DEPTH}`,
        'EXCESSIVE_UPLINE_DEPTH'
      );
    }

    if (depth === 1) {
      return this.getSponsor(memberId, client);
    }

    const chain = await this.getUplineChain(memberId, depth, client);
    const targetNode = chain.find((node) => node.level === depth);

    return targetNode || null;
  }

  /**
   * getUplineChain(memberId, maxDepth)
   *
   * Traverses the unilevel sponsor ancestry up to `maxDepth` generations (default 5, max 25).
   *
   * Safe against:
   * - Circular sponsor relationships (visited set cycle detection)
   * - Self-sponsorship
   * - Missing sponsors (broken chain clean termination)
   * - Deleted or inactive users (annotated on UplineNode)
   * - Excessively deep traversal (strictly bounded)
   *
   * Returned order: Level 1 (Direct sponsor), Level 2, Level 3, ..., up to maxDepth.
   */
  public static async getUplineChain(
    memberId: string,
    maxDepth: number = this.DEFAULT_MAX_DEPTH,
    client?: Prisma.TransactionClient
  ): Promise<UplineNode[]> {
    const db = client || prisma;

    if (!Number.isInteger(maxDepth) || maxDepth < 1) {
      throw AppError.badRequest('maxDepth must be an integer >= 1', 'INVALID_MAX_DEPTH');
    }

    const boundedDepth = Math.min(maxDepth, this.HARD_MAX_DEPTH);
    const member = await this.resolveMemberProfile(memberId, client);

    if (!member.sponsorId) {
      return [];
    }

    if (member.sponsorId === member.id) {
      logger.error(
        { memberId: member.id, sponsorId: member.sponsorId },
        'Self-sponsorship detected on distributor profile'
      );
      throw AppError.badRequest(
        `Invalid sponsor relationship: Member '${member.distributorCode || member.id}' cannot sponsor themselves`,
        'SELF_SPONSOR_FORBIDDEN'
      );
    }

    // ------------------------------------------------------------------------
    // Step 1: Attempt fast lookup via SponsorRelationship closure table
    // ------------------------------------------------------------------------
    try {
      const relationships = await db.sponsorRelationship.findMany({
        where: {
          descendantId: member.id,
          depth: { gte: 1, lte: boundedDepth },
        },
        include: {
          ancestor: {
            select: {
              id: true,
              distributorId: true,
              distributorCode: true,
              firstName: true,
              lastName: true,
              displayName: true,
              status: true,
              sponsorId: true,
              deletedAt: true,
            },
          },
        },
        orderBy: { depth: 'asc' },
      });

      if (relationships && relationships.length > 0) {
        // Verify closure table integrity (no cycles, no self-reference)
        const visitedAncestors = new Set<string>([member.id]);
        let isClosureValid = true;
        const closureUplines: UplineNode[] = [];

        for (const rel of relationships) {
          const ancestor = rel.ancestor;
          if (!ancestor || visitedAncestors.has(ancestor.id)) {
            logger.warn(
              { memberId: member.id, cycleAncestorId: ancestor?.id },
              'Closure table anomaly or cycle detected; falling back to pointer traversal'
            );
            isClosureValid = false;
            break;
          }
          visitedAncestors.add(ancestor.id);
          closureUplines.push(this.formatUplineNode(ancestor, rel.depth));
        }

        if (isClosureValid) {
          return closureUplines;
        }
      }
    } catch (closureErr) {
      logger.debug(
        { err: closureErr, memberId: member.id },
        'SponsorRelationship query bypassed or failed, using pointer traversal'
      );
    }

    // ------------------------------------------------------------------------
    // Step 2: Pointer traversal via sponsorId with cycle detection
    // ------------------------------------------------------------------------
    const uplines: UplineNode[] = [];
    const visited = new Set<string>([member.id]);
    let currentSponsorId: string | null = member.sponsorId;
    let depth = 1;

    while (currentSponsorId && depth <= boundedDepth) {
      // 1. Anti-circular check
      if (visited.has(currentSponsorId)) {
        logger.warn(
          {
            memberId: member.id,
            circularSponsorId: currentSponsorId,
            depth,
          },
          'Circular sponsor relationship detected during upline traversal. Halting traversal.'
        );
        break;
      }
      visited.add(currentSponsorId);

      // 2. Fetch sponsor profile
      const sponsor: MemberProfileRecord | null = await db.distributorProfile.findUnique({
        where: { id: currentSponsorId },
        select: {
          id: true,
          distributorId: true,
          distributorCode: true,
          firstName: true,
          lastName: true,
          displayName: true,
          status: true,
          sponsorId: true,
          deletedAt: true,
        },
      });

      if (!sponsor) {
        logger.warn(
          { memberId: member.id, missingSponsorId: currentSponsorId, depth },
          'Sponsor record does not exist (broken upline link). Halting traversal.'
        );
        break;
      }

      uplines.push(this.formatUplineNode(sponsor, depth));

      // Advance up the tree
      currentSponsorId = sponsor.sponsorId;
      depth++;
    }

    return uplines;
  }

  /**
   * getCommissionEligibleUpline(memberId, maxDepth)
   *
   * Returns only ACTIVE, commission-eligible uplines up to `maxDepth` generations.
   *
   * KEY INVARIANTS:
   * 1. Returns only uplines where status === 'ACTIVE' and deletedAt is null.
   * 2. Retains each upline's actual generation level (e.g. Level 1, Level 2, etc.).
   * 3. If an upline at a given level is inactive or does not exist, that level is skipped.
   * 4. NEVER creates a fake recipient.
   */
  public static async getCommissionEligibleUpline(
    memberId: string,
    maxDepth: number = this.DEFAULT_MAX_DEPTH,
    client?: Prisma.TransactionClient
  ): Promise<UplineNode[]> {
    const fullChain = await this.getUplineChain(memberId, maxDepth, client);

    // Filter strictly for active, non-deleted distributors
    return fullChain.filter((node) => node.isActive && node.status === 'ACTIVE');
  }

  /**
   * getDetailedUplineAssessment(memberId, maxDepth)
   *
   * Produces a comprehensive audit assessment of all upline levels 1 to maxDepth,
   * explicitly cataloging eligible recipients and reason codes for any skipped levels.
   */
  public static async getDetailedUplineAssessment(
    memberId: string,
    maxDepth: number = this.DEFAULT_MAX_DEPTH,
    client?: Prisma.TransactionClient
  ): Promise<CommissionEligibilityReport> {
    const boundedDepth = Math.min(
      Math.max(1, Number.isInteger(maxDepth) ? maxDepth : this.DEFAULT_MAX_DEPTH),
      this.HARD_MAX_DEPTH
    );

    const member = await this.resolveMemberProfile(memberId, client);
    const allUplines = await this.getUplineChain(memberId, boundedDepth, client);

    const uplineMap = new Map<number, UplineNode>();
    for (const node of allUplines) {
      uplineMap.set(node.level, node);
    }

    const eligibleUplines: UplineNode[] = [];
    const skippedLevels: SkippedUplineLevel[] = [];

    for (let level = 1; level <= boundedDepth; level++) {
      const node = uplineMap.get(level);

      if (!node) {
        skippedLevels.push({
          level,
          reason: 'NO_UPLINE_EXISTS',
        });
        continue;
      }

      if (!node.isActive) {
        skippedLevels.push({
          level,
          reason: node.status === 'ACTIVE' ? 'UPLINE_DELETED' : 'UPLINE_INACTIVE',
          uplineNode: node,
        });
        continue;
      }

      eligibleUplines.push(node);
    }

    return {
      memberId: member.id,
      distributorCode: member.distributorCode || member.distributorId || member.id,
      maxDepth: boundedDepth,
      eligibleUplines,
      allUplines,
      skippedLevels,
    };
  }

  /**
   * validateSponsorRelationship(memberId, proposedSponsorId)
   *
   * Validates whether a proposed sponsor relationship is legal before saving:
   * 1. Cannot be empty.
   * 2. Cannot be self (memberId !== proposedSponsorId).
   * 3. Proposed sponsor must exist and be ACTIVE.
   * 4. Proposed sponsor cannot be an existing downline/descendant of member (circularity check).
   */
  public static async validateSponsorRelationship(
    memberId: string,
    proposedSponsorId: string,
    client?: Prisma.TransactionClient
  ): Promise<SponsorValidationResult> {
    const db = client || prisma;
    const cleanMemberId = memberId?.trim();
    const cleanSponsorId = proposedSponsorId?.trim();

    if (!cleanMemberId || !cleanSponsorId) {
      return {
        isValid: false,
        reason: 'Both member and proposed sponsor identifiers are required',
        code: 'MISSING_IDENTIFIER',
      };
    }

    // 1. Self-sponsorship guard
    if (cleanMemberId === cleanSponsorId) {
      return {
        isValid: false,
        reason: 'A distributor cannot be their own sponsor',
        code: 'SELF_SPONSOR_FORBIDDEN',
      };
    }

    // 2. Fetch proposed sponsor
    let sponsor: MemberProfileRecord;
    try {
      sponsor = await this.resolveMemberProfile(cleanSponsorId, client);
    } catch {
      return {
        isValid: false,
        reason: 'Proposed sponsor does not exist',
        code: 'SPONSOR_NOT_FOUND',
      };
    }

    if (sponsor.status !== 'ACTIVE' || sponsor.deletedAt) {
      return {
        isValid: false,
        reason: 'Proposed sponsor is inactive or suspended',
        code: 'SPONSOR_INACTIVE',
      };
    }

    // 3. Circular sponsor check:
    // If the proposed sponsor already has memberId in their upline chain,
    // assigning memberId under proposedSponsorId would create a cycle!
    try {
      // Check closure table first
      const descendantCheck = await db.sponsorRelationship.findUnique({
        where: {
          ancestorId_descendantId: {
            ancestorId: memberId,
            descendantId: sponsor.id,
          },
        },
      });

      if (descendantCheck) {
        return {
          isValid: false,
          reason: 'Circular sponsorship forbidden: Proposed sponsor is already a downline in this member’s genealogy',
          code: 'CIRCULAR_SPONSOR_FORBIDDEN',
        };
      }

      // Check upline chain of proposed sponsor
      const sponsorUplines = await this.getUplineChain(sponsor.id, this.HARD_MAX_DEPTH, client);
      const isAncestor = sponsorUplines.some(
        (u) => u.distributorId === cleanMemberId || u.distributorCode === cleanMemberId
      );

      if (isAncestor) {
        return {
          isValid: false,
          reason: 'Circular sponsorship forbidden: Proposed sponsor already has member in their upline ancestry',
          code: 'CIRCULAR_SPONSOR_FORBIDDEN',
        };
      }
    } catch (err: any) {
      if (err?.code === 'SELF_SPONSOR_FORBIDDEN') {
        throw err;
      }
    }

    return {
      isValid: true,
      sponsorNode: this.formatUplineNode(sponsor, 1),
    };
  }
}
