/**
 * Automated Test Suite: Sponsor Upline Traversal System (Prompt 15)
 *
 * Verifies:
 * 1. Dedicated SponsorUplineService functionality:
 *    - getSponsor(memberId)
 *    - getUpline(memberId, depth)
 *    - getUplineChain(memberId, maxDepth)
 *    - getCommissionEligibleUpline(memberId, maxDepth)
 * 2. Strict Business Invariant:
 *    - Commission Level 1-5 is strictly based on the SPONSOR/UPLINE relationship.
 *    - NOT based on binary LEFT/RIGHT placement (MLMNode).
 * 3. 5-Generation Chain resolution:
 *    - A sponsors B -> B sponsors C -> C sponsors D -> D sponsors E -> E sponsors F
 *    - F's uplines: L1 = E, L2 = D, L3 = C, L4 = B, L5 = A.
 * 4. Truncated chain (missing uplines):
 *    - If member has only 3 uplines, L1-L3 exist, L4-L5 do not.
 *    - NEVER create a fake recipient.
 * 5. Anti-circular sponsor defense:
 *    - Halts cleanly on loops (e.g., A -> B -> C -> A).
 * 6. Self-sponsorship prevention:
 *    - Member cannot sponsor themselves.
 * 7. Inactive and deleted distributor handling:
 *    - Excluded from getCommissionEligibleUpline, level preserved without compression.
 * 8. Missing sponsor / broken pointer handling:
 *    - Clean termination without unhandled exceptions.
 * 9. Excessive depth boundary protection:
 *    - Clamped / bounded to max allowed depth (<= 25).
 * 10. End-to-end integration with LevelCommissionService.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/config/database';
import { SponsorUplineService, UplineNode } from '../src/services/sponsorUpline.service';
import { LevelCommissionService } from '../src/services/levelCommission.service';

describe('SPONSOR UPLINE TRAVERSAL SYSTEM (PROMPT 15 TEST SUITE)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock interactive transactions so tests run cleanly
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    // Default: mock empty commissionLevel config so canonical rates apply
    vi.spyOn(prisma.commissionLevel, 'findMany').mockResolvedValue([]);
  });

  // ==========================================================================
  // SECTION 1: 5-GENERATION LINEAR HIERARCHY
  // ==========================================================================
  describe('1. 5-Generation Upline Traversal (A -> B -> C -> D -> E -> F)', () => {
    // Member profiles:
    // A (Root) -> B (L5) -> C (L4) -> D (L3) -> E (L2) -> F (Purchaser)
    // When F purchases:
    // L1 = E (direct sponsor)
    // L2 = D
    // L3 = C
    // L4 = B
    // L5 = A
    const memberA = {
      id: 'uuid-a',
      distributorId: 'KV-1001',
      distributorCode: 'KV-1001',
      firstName: 'Alice',
      lastName: 'Root',
      displayName: 'Alice Root',
      status: 'ACTIVE',
      sponsorId: null,
      deletedAt: null,
    };
    const memberB = {
      id: 'uuid-b',
      distributorId: 'KV-1002',
      distributorCode: 'KV-1002',
      firstName: 'Bob',
      lastName: 'Two',
      displayName: 'Bob Two',
      status: 'ACTIVE',
      sponsorId: 'uuid-a',
      deletedAt: null,
    };
    const memberC = {
      id: 'uuid-c',
      distributorId: 'KV-1003',
      distributorCode: 'KV-1003',
      firstName: 'Charlie',
      lastName: 'Three',
      displayName: 'Charlie Three',
      status: 'ACTIVE',
      sponsorId: 'uuid-b',
      deletedAt: null,
    };
    const memberD = {
      id: 'uuid-d',
      distributorId: 'KV-1004',
      distributorCode: 'KV-1004',
      firstName: 'David',
      lastName: 'Four',
      displayName: 'David Four',
      status: 'ACTIVE',
      sponsorId: 'uuid-c',
      deletedAt: null,
    };
    const memberE = {
      id: 'uuid-e',
      distributorId: 'KV-1005',
      distributorCode: 'KV-1005',
      firstName: 'Emma',
      lastName: 'Five',
      displayName: 'Emma Five',
      status: 'ACTIVE',
      sponsorId: 'uuid-d',
      deletedAt: null,
    };
    const memberF = {
      id: 'uuid-f',
      distributorId: 'KV-1006',
      distributorCode: 'KV-1006',
      firstName: 'Frank',
      lastName: 'Purchaser',
      displayName: 'Frank Purchaser',
      status: 'ACTIVE',
      sponsorId: 'uuid-e',
      deletedAt: null,
    };

    const profileMap = new Map<string, any>([
      ['uuid-a', memberA],
      ['KV-1001', memberA],
      ['uuid-b', memberB],
      ['KV-1002', memberB],
      ['uuid-c', memberC],
      ['KV-1003', memberC],
      ['uuid-d', memberD],
      ['KV-1004', memberD],
      ['uuid-e', memberE],
      ['KV-1005', memberE],
      ['uuid-f', memberF],
      ['KV-1006', memberF],
    ]);

    beforeEach(() => {
      // Mock findFirst for resolveMemberProfile
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockImplementation(async (args: any) => {
        const orConditions = args.where.OR;
        for (const cond of orConditions) {
          const val = cond.id || cond.distributorId || cond.distributorCode;
          if (val && profileMap.has(val)) {
            return profileMap.get(val);
          }
        }
        return null;
      });

      // Mock findUnique for sponsor lookups
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockImplementation(async (args: any) => {
        const id = args.where.id;
        return profileMap.get(id) || null;
      });

      // Default: empty closure table to test robust traversal
      vi.spyOn(prisma.sponsorRelationship, 'findMany').mockResolvedValue([]);
    });

    it('TC-UPL-01: getSponsor should return the direct sponsor (Level 1 = E for member F)', async () => {
      const sponsor = await SponsorUplineService.getSponsor('KV-1006');

      expect(sponsor).not.toBeNull();
      expect(sponsor!.distributorId).toBe('uuid-e');
      expect(sponsor!.distributorCode).toBe('KV-1005');
      expect(sponsor!.displayName).toBe('Emma Five');
      expect(sponsor!.level).toBe(1);
      expect(sponsor!.isDirect).toBe(true);
      expect(sponsor!.isActive).toBe(true);
      expect(sponsor!.isEligibleForCommission).toBe(true);
    });

    it('TC-UPL-02: getSponsor should return null for root member with no sponsor (A)', async () => {
      const sponsor = await SponsorUplineService.getSponsor('KV-1001');
      expect(sponsor).toBeNull();
    });

    it('TC-UPL-03: getUplineChain should return all 5 uplines in exact order: E -> D -> C -> B -> A', async () => {
      const chain = await SponsorUplineService.getUplineChain('KV-1006', 5);

      expect(chain).toHaveLength(5);

      // Level 1 = Direct sponsor (E)
      expect(chain[0].level).toBe(1);
      expect(chain[0].distributorCode).toBe('KV-1005');
      expect(chain[0].isDirect).toBe(true);

      // Level 2 = Sponsor's sponsor (D)
      expect(chain[1].level).toBe(2);
      expect(chain[1].distributorCode).toBe('KV-1004');
      expect(chain[1].isDirect).toBe(false);

      // Level 3 = Third upline (C)
      expect(chain[2].level).toBe(3);
      expect(chain[2].distributorCode).toBe('KV-1003');

      // Level 4 = Fourth upline (B)
      expect(chain[3].level).toBe(4);
      expect(chain[3].distributorCode).toBe('KV-1002');

      // Level 5 = Fifth upline (A)
      expect(chain[4].level).toBe(5);
      expect(chain[4].distributorCode).toBe('KV-1001');
    });

    it('TC-UPL-04: getUpline should retrieve the exact node at specific depths', async () => {
      const l1 = await SponsorUplineService.getUpline('uuid-f', 1);
      expect(l1?.distributorCode).toBe('KV-1005');

      const l3 = await SponsorUplineService.getUpline('uuid-f', 3);
      expect(l3?.distributorCode).toBe('KV-1003');

      const l5 = await SponsorUplineService.getUpline('uuid-f', 5);
      expect(l5?.distributorCode).toBe('KV-1001');

      // Beyond tree depth (level 6 does not exist)
      const l6 = await SponsorUplineService.getUpline('uuid-f', 6);
      expect(l6).toBeNull();
    });

    it('TC-UPL-05: getCommissionEligibleUpline should return all 5 active members', async () => {
      const eligible = await SponsorUplineService.getCommissionEligibleUpline('KV-1006', 5);
      expect(eligible).toHaveLength(5);
      expect(eligible.map((e) => e.distributorCode)).toEqual([
        'KV-1005',
        'KV-1004',
        'KV-1003',
        'KV-1002',
        'KV-1001',
      ]);
    });
  });

  // ==========================================================================
  // SECTION 2: TRUNCATED CHAIN & MISSING RECIPIENTS (NO FAKE RECIPIENTS)
  // ==========================================================================
  describe('2. Truncated Hierarchy Handling (Only 3 uplines exist)', () => {
    // Hierarchy: A (Root) -> B -> C -> D (Purchaser)
    // Only 3 upline levels exist:
    // Level 1 = C
    // Level 2 = B
    // Level 3 = A
    // Level 4 = None
    // Level 5 = None
    const rootA = {
      id: 'uuid-t-a',
      distributorId: 'KV-2001',
      distributorCode: 'KV-2001',
      displayName: 'Top Leader A',
      status: 'ACTIVE',
      sponsorId: null,
      deletedAt: null,
    };
    const midB = {
      id: 'uuid-t-b',
      distributorId: 'KV-2002',
      distributorCode: 'KV-2002',
      displayName: 'Leader B',
      status: 'ACTIVE',
      sponsorId: 'uuid-t-a',
      deletedAt: null,
    };
    const directC = {
      id: 'uuid-t-c',
      distributorId: 'KV-2003',
      distributorCode: 'KV-2003',
      displayName: 'Sponsor C',
      status: 'ACTIVE',
      sponsorId: 'uuid-t-b',
      deletedAt: null,
    };
    const memberD = {
      id: 'uuid-t-d',
      distributorId: 'KV-2004',
      distributorCode: 'KV-2004',
      displayName: 'Member D',
      status: 'ACTIVE',
      sponsorId: 'uuid-t-c',
      deletedAt: null,
    };

    const truncatedMap = new Map<string, any>([
      ['uuid-t-a', rootA],
      ['KV-2001', rootA],
      ['uuid-t-b', midB],
      ['KV-2002', midB],
      ['uuid-t-c', directC],
      ['KV-2003', directC],
      ['uuid-t-d', memberD],
      ['KV-2004', memberD],
    ]);

    beforeEach(() => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockImplementation(async (args: any) => {
        for (const cond of args.where.OR) {
          const val = cond.id || cond.distributorId || cond.distributorCode;
          if (val && truncatedMap.has(val)) return truncatedMap.get(val);
        }
        return null;
      });

      vi.spyOn(prisma.distributorProfile, 'findUnique').mockImplementation(async (args: any) => {
        return truncatedMap.get(args.where.id) || null;
      });

      vi.spyOn(prisma.sponsorRelationship, 'findMany').mockResolvedValue([]);
    });

    it('TC-UPL-06: getUplineChain should return exactly 3 nodes and never invent fake recipients for Level 4 and 5', async () => {
      const chain = await SponsorUplineService.getUplineChain('KV-2004', 5);

      expect(chain).toHaveLength(3);
      expect(chain[0].distributorCode).toBe('KV-2003'); // Level 1
      expect(chain[1].distributorCode).toBe('KV-2002'); // Level 2
      expect(chain[2].distributorCode).toBe('KV-2001'); // Level 3

      // Requesting Level 4 and Level 5 must yield null
      const level4 = await SponsorUplineService.getUpline('KV-2004', 4);
      expect(level4).toBeNull();

      const level5 = await SponsorUplineService.getUpline('KV-2004', 5);
      expect(level5).toBeNull();
    });

    it('TC-UPL-07: getDetailedUplineAssessment should explicitly flag Level 4 and 5 as NO_UPLINE_EXISTS', async () => {
      const assessment = await SponsorUplineService.getDetailedUplineAssessment('KV-2004', 5);

      expect(assessment.eligibleUplines).toHaveLength(3);
      expect(assessment.allUplines).toHaveLength(3);
      expect(assessment.skippedLevels).toHaveLength(2);

      expect(assessment.skippedLevels[0]).toEqual({
        level: 4,
        reason: 'NO_UPLINE_EXISTS',
      });
      expect(assessment.skippedLevels[1]).toEqual({
        level: 5,
        reason: 'NO_UPLINE_EXISTS',
      });
    });
  });

  // ==========================================================================
  // SECTION 3: INACTIVE AND DELETED DISTRIBUTOR HANDLING
  // ==========================================================================
  describe('3. Inactive & Deleted Distributors', () => {
    // A (ACTIVE, L3) -> B (INACTIVE, L2) -> C (ACTIVE, L1) -> D (Purchaser)
    const activeA = {
      id: 'uuid-act-a',
      distributorId: 'KV-3001',
      distributorCode: 'KV-3001',
      displayName: 'Active A',
      status: 'ACTIVE',
      sponsorId: null,
      deletedAt: null,
    };
    const inactiveB = {
      id: 'uuid-inact-b',
      distributorId: 'KV-3002',
      distributorCode: 'KV-3002',
      displayName: 'Inactive B',
      status: 'INACTIVE',
      sponsorId: 'uuid-act-a',
      deletedAt: null,
    };
    const activeC = {
      id: 'uuid-act-c',
      distributorId: 'KV-3003',
      distributorCode: 'KV-3003',
      displayName: 'Active C',
      status: 'ACTIVE',
      sponsorId: 'uuid-inact-b',
      deletedAt: null,
    };
    const memberD = {
      id: 'uuid-mem-d',
      distributorId: 'KV-3004',
      distributorCode: 'KV-3004',
      displayName: 'Member D',
      status: 'ACTIVE',
      sponsorId: 'uuid-act-c',
      deletedAt: null,
    };

    const statusMap = new Map<string, any>([
      ['uuid-act-a', activeA],
      ['KV-3001', activeA],
      ['uuid-inact-b', inactiveB],
      ['KV-3002', inactiveB],
      ['uuid-act-c', activeC],
      ['KV-3003', activeC],
      ['uuid-mem-d', memberD],
      ['KV-3004', memberD],
    ]);

    beforeEach(() => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockImplementation(async (args: any) => {
        for (const cond of args.where.OR) {
          const val = cond.id || cond.distributorId || cond.distributorCode;
          if (val && statusMap.has(val)) return statusMap.get(val);
        }
        return null;
      });

      vi.spyOn(prisma.distributorProfile, 'findUnique').mockImplementation(async (args: any) => {
        return statusMap.get(args.where.id) || null;
      });

      vi.spyOn(prisma.sponsorRelationship, 'findMany').mockResolvedValue([]);
    });

    it('TC-UPL-08: getUplineChain preserves inactive upline in chain with isActive=false', async () => {
      const chain = await SponsorUplineService.getUplineChain('KV-3004', 3);

      expect(chain).toHaveLength(3);

      expect(chain[0].distributorCode).toBe('KV-3003');
      expect(chain[0].isActive).toBe(true);

      expect(chain[1].distributorCode).toBe('KV-3002');
      expect(chain[1].status).toBe('INACTIVE');
      expect(chain[1].isActive).toBe(false);
      expect(chain[1].isEligibleForCommission).toBe(false);

      expect(chain[2].distributorCode).toBe('KV-3001');
      expect(chain[2].isActive).toBe(true);
    });

    it('TC-UPL-09: getCommissionEligibleUpline excludes inactive upline without compressing generation level', async () => {
      const eligible = await SponsorUplineService.getCommissionEligibleUpline('KV-3004', 3);

      expect(eligible).toHaveLength(2);

      // Level 1 = C
      expect(eligible[0].level).toBe(1);
      expect(eligible[0].distributorCode).toBe('KV-3003');

      // Level 3 = A (CRITICAL: Retains Level 3, does NOT compress into Level 2)
      expect(eligible[1].level).toBe(3);
      expect(eligible[1].distributorCode).toBe('KV-3001');
    });

    it('TC-UPL-10: Soft-deleted user is marked inactive and excluded from commission eligibility', async () => {
      // Modify C to be soft-deleted
      const deletedC = { ...activeC, deletedAt: new Date('2026-09-01') };
      statusMap.set('uuid-act-c', deletedC);
      statusMap.set('KV-3003', deletedC);

      const chain = await SponsorUplineService.getUplineChain('KV-3004', 3);
      expect(chain[0].isActive).toBe(false);
      expect(chain[0].isEligibleForCommission).toBe(false);

      const eligible = await SponsorUplineService.getCommissionEligibleUpline('KV-3004', 3);
      // Only A is active
      expect(eligible).toHaveLength(1);
      expect(eligible[0].distributorCode).toBe('KV-3001');
      expect(eligible[0].level).toBe(3);
    });
  });

  // ==========================================================================
  // SECTION 4: ANTI-CIRCULAR & DEFENSIVE REJECTION
  // ==========================================================================
  describe('4. Anti-Circular & Self-Sponsorship Defenses', () => {
    it('TC-UPL-11: Detects circular sponsor loop (A -> B -> C -> A) and terminates safely without infinite recursion', async () => {
      // Setup cyclic graph
      const cycleA: any = {
        id: 'node-cyc-a',
        distributorCode: 'CYC-A',
        status: 'ACTIVE',
        sponsorId: 'node-cyc-c', // Cycle back to C!
        deletedAt: null,
      };
      const cycleB: any = {
        id: 'node-cyc-b',
        distributorCode: 'CYC-B',
        status: 'ACTIVE',
        sponsorId: 'node-cyc-a',
        deletedAt: null,
      };
      const cycleC: any = {
        id: 'node-cyc-c',
        distributorCode: 'CYC-C',
        status: 'ACTIVE',
        sponsorId: 'node-cyc-b',
        deletedAt: null,
      };

      const cycleMap = new Map([
        ['node-cyc-a', cycleA],
        ['CYC-A', cycleA],
        ['node-cyc-b', cycleB],
        ['CYC-B', cycleB],
        ['node-cyc-c', cycleC],
        ['CYC-C', cycleC],
      ]);

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockImplementation(async (args: any) => {
        for (const cond of args.where.OR) {
          const val = cond.id || cond.distributorId || cond.distributorCode;
          if (val && cycleMap.has(val)) return cycleMap.get(val);
        }
        return null;
      });

      vi.spyOn(prisma.distributorProfile, 'findUnique').mockImplementation(async (args: any) => {
        return cycleMap.get(args.where.id) || null;
      });

      vi.spyOn(prisma.sponsorRelationship, 'findMany').mockResolvedValue([]);

      // Traversal starting from C must halt when cycle is encountered
      const chain = await SponsorUplineService.getUplineChain('CYC-C', 5);

      // Traversal from C:
      // Hop 1: B (sponsor of C)
      // Hop 2: A (sponsor of B)
      // Hop 3: C is sponsor of A -> visited! Halts immediately.
      expect(chain).toHaveLength(2);
      expect(chain[0].distributorCode).toBe('CYC-B');
      expect(chain[1].distributorCode).toBe('CYC-A');
    });

    it('TC-UPL-12: Prevents self-sponsorship where memberId === sponsorId', async () => {
      const selfSponsor = {
        id: 'uuid-self',
        distributorCode: 'SELF-1',
        status: 'ACTIVE',
        sponsorId: 'uuid-self', // Points to self!
        deletedAt: null,
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(selfSponsor as any);

      await expect(SponsorUplineService.getSponsor('SELF-1')).rejects.toThrow(
        /Member.*cannot sponsor themselves/i
      );

      await expect(SponsorUplineService.getUplineChain('SELF-1', 5)).rejects.toThrow(
        /Member.*cannot sponsor themselves/i
      );
    });

    it('TC-UPL-13: validateSponsorRelationship rejects self-sponsorship and invalid sponsors', async () => {
      // 1. Same identifier
      const checkSelf = await SponsorUplineService.validateSponsorRelationship('MEM-1', 'MEM-1');
      expect(checkSelf.isValid).toBe(false);
      expect(checkSelf.code).toBe('SELF_SPONSOR_FORBIDDEN');

      // 2. Nonexistent sponsor
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(null);
      const checkMissing = await SponsorUplineService.validateSponsorRelationship('MEM-1', 'NON-EXISTENT');
      expect(checkMissing.isValid).toBe(false);
      expect(checkMissing.code).toBe('SPONSOR_NOT_FOUND');
    });

    it('TC-UPL-14: Gracefully terminates on broken upline link (sponsorId points to deleted/missing DB record)', async () => {
      const memberWithBrokenSponsor = {
        id: 'uuid-broken',
        distributorCode: 'BROKEN-1',
        status: 'ACTIVE',
        sponsorId: 'uuid-ghost-sponsor',
        deletedAt: null,
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(memberWithBrokenSponsor as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(null); // Ghost sponsor does not exist
      vi.spyOn(prisma.sponsorRelationship, 'findMany').mockResolvedValue([]);

      const sponsor = await SponsorUplineService.getSponsor('BROKEN-1');
      expect(sponsor).toBeNull();

      const chain = await SponsorUplineService.getUplineChain('BROKEN-1', 5);
      expect(chain).toEqual([]);
    });

    it('TC-UPL-15: Enforces depth boundaries (rejects depth < 1 or depth > 25)', async () => {
      await expect(SponsorUplineService.getUpline('MEMBER-1', 0)).rejects.toThrow(
        /Upline depth must be an integer >= 1/i
      );

      await expect(SponsorUplineService.getUpline('MEMBER-1', 26)).rejects.toThrow(
        /Upline depth exceeds maximum allowed limit/i
      );

      await expect(SponsorUplineService.getUplineChain('MEMBER-1', -1)).rejects.toThrow(
        /maxDepth must be an integer >= 1/i
      );
    });
  });

  // ==========================================================================
  // SECTION 5: BINARY INDEPENDENCE & FAST-PATH CLOSURE TABLE
  // ==========================================================================
  describe('5. Binary Tree Independence & Closure Table Fast-Path', () => {
    it('TC-UPL-16: Uses SponsorRelationship closure table when present', async () => {
      const mockMember = {
        id: 'uuid-fast-member',
        distributorCode: 'FAST-MEM',
        status: 'ACTIVE',
        sponsorId: 'uuid-fast-anc-1',
        deletedAt: null,
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockMember as any);

      // Mock closure table records
      vi.spyOn(prisma.sponsorRelationship, 'findMany').mockResolvedValue([
        {
          id: 'rel-1',
          ancestorId: 'uuid-fast-anc-1',
          descendantId: 'uuid-fast-member',
          depth: 1,
          isDirect: true,
          ancestor: {
            id: 'uuid-fast-anc-1',
            distributorId: 'FAST-1',
            distributorCode: 'FAST-1',
            firstName: 'Fast',
            lastName: 'One',
            displayName: 'Fast One',
            status: 'ACTIVE',
            sponsorId: 'uuid-fast-anc-2',
            deletedAt: null,
          },
        },
        {
          id: 'rel-2',
          ancestorId: 'uuid-fast-anc-2',
          descendantId: 'uuid-fast-member',
          depth: 2,
          isDirect: false,
          ancestor: {
            id: 'uuid-fast-anc-2',
            distributorId: 'FAST-2',
            distributorCode: 'FAST-2',
            firstName: 'Fast',
            lastName: 'Two',
            displayName: 'Fast Two',
            status: 'ACTIVE',
            sponsorId: null,
            deletedAt: null,
          },
        },
      ] as any);

      const chain = await SponsorUplineService.getUplineChain('FAST-MEM', 5);

      expect(chain).toHaveLength(2);
      expect(chain[0].distributorCode).toBe('FAST-1');
      expect(chain[0].level).toBe(1);
      expect(chain[0].isDirect).toBe(true);

      expect(chain[1].distributorCode).toBe('FAST-2');
      expect(chain[1].level).toBe(2);
      expect(chain[1].isDirect).toBe(false);
    });

    it('TC-UPL-17: Strictly independent of binary placement parent (MLMNode LEFT/RIGHT)', async () => {
      // Member P has Sponsor S in unilevel enroller tree,
      // but is placed under Binary Parent B in binary tree.
      // SponsorUplineService must strictly return S, NEVER B!
      const memberP = {
        id: 'uuid-p',
        distributorCode: 'P-MEM',
        status: 'ACTIVE',
        sponsorId: 'uuid-sponsor-s',
        deletedAt: null,
      };

      const sponsorS = {
        id: 'uuid-sponsor-s',
        distributorCode: 'SPONSOR-S',
        status: 'ACTIVE',
        sponsorId: null,
        deletedAt: null,
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(memberP as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(sponsorS as any);
      vi.spyOn(prisma.sponsorRelationship, 'findMany').mockResolvedValue([]);

      const mlmSpy = vi.spyOn(prisma.mLMNode, 'findFirst');
      const mlmManySpy = vi.spyOn(prisma.mLMNode, 'findMany');

      const sponsor = await SponsorUplineService.getSponsor('P-MEM');

      expect(sponsor?.distributorId).toBe('uuid-sponsor-s');
      expect(sponsor?.distributorCode).toBe('SPONSOR-S');
      // Verify no binary placement node lookup was executed
      expect(mlmSpy).not.toHaveBeenCalled();
      expect(mlmManySpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // SECTION 6: INTEGRATION WITH LEVEL COMMISSION ENGINE
  // ==========================================================================
  describe('6. Integration with LevelCommissionService', () => {
    it('TC-UPL-18: LevelCommissionService delegates to SponsorUplineService and respects missing/inactive levels', async () => {
      // 3 uplines: L1 = Active, L2 = Inactive, L3 = Active, L4 = None, L5 = None
      const uplines: UplineNode[] = [
        {
          level: 1,
          distributorId: 'dst-01',
          distributorCode: 'KV-1001',
          displayName: 'Upline 1',
          status: 'ACTIVE',
          sponsorId: 'dst-02',
          isDirect: true,
          isActive: true,
          isEligibleForCommission: true,
        },
        {
          level: 2,
          distributorId: 'dst-02',
          distributorCode: 'KV-1002',
          displayName: 'Upline 2',
          status: 'INACTIVE',
          sponsorId: 'dst-03',
          isDirect: false,
          isActive: false,
          isEligibleForCommission: false,
        },
        {
          level: 3,
          distributorId: 'dst-03',
          distributorCode: 'KV-1003',
          displayName: 'Upline 3',
          status: 'ACTIVE',
          sponsorId: null,
          isDirect: false,
          isActive: true,
          isEligibleForCommission: true,
        },
      ];

      vi.spyOn(SponsorUplineService, 'getUplineChain').mockResolvedValue(uplines);

      const preview = await LevelCommissionService.previewOrderCommissions(10000, 'purchaser-id');

      // 10,000 BV
      // L1 = 24% = 2400 (awarded)
      // L2 = 8% = 800 (SKIPPED: UPLINE_INACTIVE)
      // L3 = 13% = 1300 (awarded)
      // L4 = 5% = 500 (SKIPPED: NO_UPLINE_EXISTS)
      // L5 = 4% = 400 (SKIPPED: NO_UPLINE_EXISTS)
      expect(preview.commissions).toHaveLength(2); // Only L1 and L3 awarded
      expect(preview.commissions[0]).toMatchObject({
        level: 1,
        commissionAmount: 2400.0,
        beneficiaryId: 'dst-01',
      });
      expect(preview.commissions[1]).toMatchObject({
        level: 3,
        commissionAmount: 1300.0,
        beneficiaryId: 'dst-03',
      });

      // Total awarded = 2400 + 1300 = 3700
      expect(preview.totalCommissionAmount).toBe(3700.0);

      // Skipped levels
      expect(preview.skippedLevels).toHaveLength(3);
      expect(preview.skippedLevels).toContainEqual({
        level: 2,
        ratePercentage: 8.0,
        reason: 'UPLINE_INACTIVE',
      });
      expect(preview.skippedLevels).toContainEqual({
        level: 4,
        ratePercentage: 5.0,
        reason: 'NO_UPLINE_EXISTS',
      });
      expect(preview.skippedLevels).toContainEqual({
        level: 5,
        ratePercentage: 4.0,
        reason: 'NO_UPLINE_EXISTS',
      });
    });
  });
});
