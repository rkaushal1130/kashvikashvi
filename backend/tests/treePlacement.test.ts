/**
 * Test Suite: TreePlacementService Automated Tests (Prompt 4)
 *
 * Covers:
 * 1. LEFT placement
 * 2. RIGHT placement
 * 3. Occupied LEFT position (POSITION_ALREADY_OCCUPIED)
 * 4. Occupied RIGHT position (POSITION_ALREADY_OCCUPIED)
 * 5. Tree full (TREE_FULL) when both LEFT and RIGHT are occupied
 * 6. Invalid placement position (INVALID_PLACEMENT_POSITION)
 * 7. Self-placement prevention (SELF_PLACEMENT_NOT_ALLOWED)
 * 8. Circular placement prevention (CIRCULAR_RELATIONSHIP)
 * 9. Invalid parent (PLACEMENT_PARENT_NOT_FOUND)
 * 10. Inactive parent (PLACEMENT_PARENT_INACTIVE)
 * 11. Concurrent placement & row locking protection
 * 12. Helper methods: getAvailablePositions, getChildren, getParent, validateNoCircularRelationship
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TreePlacementService } from '../src/services/treePlacement.service';
import { prisma } from '../src/config/database';
import { PlacementPosition, Prisma } from '@prisma/client';

describe('TREE PLACEMENT SERVICE TESTS (Prompt 4 — TreePlacementService)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prisma.mLMNode, 'findUnique').mockResolvedValue(null);
  });

  const parentDistId = 'dist-parent-001';
  const childDistId1 = 'dist-child-001';
  const childDistId2 = 'dist-child-002';
  const parentNodeId = 'node-parent-001';
  const parentBcId = 'bc-parent-001';

  // --------------------------------------------------------------------------
  // TEST 1: LEFT Placement
  // --------------------------------------------------------------------------
  describe('1. LEFT Placement', () => {
    it('should successfully place a distributor on the LEFT leg', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst')
        .mockResolvedValueOnce({
          id: childDistId1,
          distributorId: 'KV-CHILD-1',
          distributorCode: 'KV-CHILD-1',
          sponsorId: parentDistId,
          businessCenters: [{ id: 'bc-child-1', centerNumber: 1 }],
        } as any)
        .mockResolvedValueOnce({
          id: parentDistId,
          distributorId: 'KV-PARENT',
          distributorCode: 'KV-PARENT',
          status: 'ACTIVE',
        } as any);

      vi.spyOn(prisma.mLMNode, 'findFirst')
        .mockResolvedValueOnce({
          id: parentNodeId,
          distributorId: parentDistId,
          depth: 1,
          binaryPath: 'ROOT',
          distributor: { status: 'ACTIVE', distributorCode: 'KV-PARENT' },
          children: [],
        } as any);

      vi.spyOn(prisma.mLMNode, 'findUnique').mockResolvedValue(null);

      const mockCreatedNode = {
        id: 'node-child-1',
        distributorId: childDistId1,
        placementParentId: parentNodeId,
        placementPosition: PlacementPosition.LEFT,
        depth: 2,
        binaryPath: 'ROOT/L',
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const txMock = {
          $queryRaw: vi.fn().mockResolvedValue([]),
          mLMNode: {
            findMany: vi.fn().mockResolvedValue([]),
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockCreatedNode),
          },
          distributorProfile: {
            update: vi.fn().mockResolvedValue({}),
          },
          sponsorRelationship: {
            upsert: vi.fn().mockResolvedValue({}),
          },
        };
        return await callback(txMock);
      });

      const result = await TreePlacementService.placeDistributor(childDistId1, parentNodeId, 'LEFT');

      expect(result.success).toBe(true);
      expect(result.data.placementPosition).toBe('LEFT');
      expect(result.data.depth).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // TEST 2: RIGHT Placement
  // --------------------------------------------------------------------------
  describe('2. RIGHT Placement', () => {
    it('should successfully place a distributor on the RIGHT leg', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst')
        .mockResolvedValueOnce({
          id: childDistId2,
          distributorId: 'KV-CHILD-2',
          distributorCode: 'KV-CHILD-2',
          sponsorId: parentDistId,
          businessCenters: [{ id: 'bc-child-2', centerNumber: 1 }],
        } as any)
        .mockResolvedValueOnce({
          id: parentDistId,
          distributorId: 'KV-PARENT',
          distributorCode: 'KV-PARENT',
          status: 'ACTIVE',
        } as any);

      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce({
        id: parentNodeId,
        distributorId: parentDistId,
        depth: 1,
        binaryPath: 'ROOT',
        distributor: { status: 'ACTIVE', distributorCode: 'KV-PARENT' },
        children: [{ id: 'child-1', placementPosition: 'LEFT' as const }],
      } as any);

      vi.spyOn(prisma.mLMNode, 'findUnique').mockResolvedValue(null);

      const mockCreatedNode = {
        id: 'node-child-2',
        distributorId: childDistId2,
        placementParentId: parentNodeId,
        placementPosition: PlacementPosition.RIGHT,
        depth: 2,
        binaryPath: 'ROOT/R',
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const txMock = {
          $queryRaw: vi.fn().mockResolvedValue([]),
          mLMNode: {
            findMany: vi.fn().mockResolvedValue([{ placementPosition: 'LEFT' }]),
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockCreatedNode),
          },
          distributorProfile: {
            update: vi.fn().mockResolvedValue({}),
          },
          sponsorRelationship: {
            upsert: vi.fn().mockResolvedValue({}),
          },
        };
        return await callback(txMock);
      });

      const result = await TreePlacementService.placeDistributor({
        distributorId: childDistId2,
        placementParentId: parentNodeId,
        placementPosition: 'RIGHT',
      });

      expect(result.success).toBe(true);
      expect(result.data.placementPosition).toBe('RIGHT');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 3: Occupied LEFT Position
  // --------------------------------------------------------------------------
  describe('3. Occupied LEFT Position', () => {
    it('should return POSITION_ALREADY_OCCUPIED when LEFT leg is already taken', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst')
        .mockResolvedValueOnce({
          id: childDistId2,
          distributorCode: 'KV-CHILD-2',
          sponsorId: parentDistId,
          businessCenters: [{ id: 'bc-2' }],
        } as any)
        .mockResolvedValueOnce({
          id: parentDistId,
          distributorCode: 'KV-PARENT',
          status: 'ACTIVE',
        } as any);

      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce({
        id: parentNodeId,
        distributorId: parentDistId,
        distributor: { status: 'ACTIVE', distributorCode: 'KV-PARENT' },
        children: [{ id: 'existing-left', placementPosition: 'LEFT' as const }],
      } as any);

      const result = await TreePlacementService.placeDistributor(childDistId2, parentNodeId, 'LEFT');

      expect(result.success).toBe(false);
      expect(result.code).toBe('POSITION_ALREADY_OCCUPIED');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 4: Occupied RIGHT Position
  // --------------------------------------------------------------------------
  describe('4. Occupied RIGHT Position', () => {
    it('should return POSITION_ALREADY_OCCUPIED when RIGHT leg is already taken', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst')
        .mockResolvedValueOnce({
          id: childDistId1,
          distributorCode: 'KV-CHILD-1',
          sponsorId: parentDistId,
          businessCenters: [{ id: 'bc-1' }],
        } as any)
        .mockResolvedValueOnce({
          id: parentDistId,
          distributorCode: 'KV-PARENT',
          status: 'ACTIVE',
        } as any);

      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce({
        id: parentNodeId,
        distributorId: parentDistId,
        distributor: { status: 'ACTIVE', distributorCode: 'KV-PARENT' },
        children: [{ id: 'existing-right', placementPosition: 'RIGHT' as const }],
      } as any);

      const result = await TreePlacementService.placeDistributor(childDistId1, parentNodeId, 'RIGHT');

      expect(result.success).toBe(false);
      expect(result.code).toBe('POSITION_ALREADY_OCCUPIED');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 5: Tree Full (Both LEFT and RIGHT Occupied)
  // --------------------------------------------------------------------------
  describe('5. Tree Full Rejection', () => {
    it('should return TREE_FULL when both LEFT and RIGHT positions are occupied', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst')
        .mockResolvedValueOnce({
          id: childDistId1,
          distributorCode: 'KV-CHILD-1',
          sponsorId: parentDistId,
          businessCenters: [{ id: 'bc-1' }],
        } as any)
        .mockResolvedValueOnce({
          id: parentDistId,
          distributorCode: 'KV-PARENT',
          status: 'ACTIVE',
        } as any);

      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce({
        id: parentNodeId,
        distributorId: parentDistId,
        distributor: { status: 'ACTIVE', distributorCode: 'KV-PARENT' },
        children: [
          { id: 'existing-left', placementPosition: 'LEFT' as const },
          { id: 'existing-right', placementPosition: 'RIGHT' as const },
        ],
      } as any);

      const result = await TreePlacementService.placeDistributor(childDistId1, parentNodeId, 'LEFT');

      expect(result.success).toBe(false);
      expect(result.code).toBe('TREE_FULL');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 6: Invalid Placement Position
  // --------------------------------------------------------------------------
  describe('6. Invalid Placement Position', () => {
    it('should return INVALID_PLACEMENT_POSITION when position is not LEFT or RIGHT', async () => {
      const result = await TreePlacementService.placeDistributor(
        childDistId1,
        parentNodeId,
        'CENTER' as any
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_PLACEMENT_POSITION');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 7: Self-Placement Prevention
  // --------------------------------------------------------------------------
  describe('7. Self-Placement Prevention', () => {
    it('should return SELF_PLACEMENT_NOT_ALLOWED when distributor places under themselves', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst')
        .mockResolvedValueOnce({
          id: parentDistId,
          distributorCode: 'KV-PARENT',
          sponsorId: 'sponsor-001',
          businessCenters: [{ id: parentBcId }],
        } as any)
        .mockResolvedValueOnce({
          id: 'sponsor-001',
          distributorCode: 'KV-SPONSOR',
          status: 'ACTIVE',
        } as any);

      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce({
        id: parentNodeId,
        distributorId: parentDistId, // SAME DISTRIBUTOR!
        distributor: { status: 'ACTIVE', distributorCode: 'KV-PARENT' },
        children: [],
      } as any);

      const result = await TreePlacementService.placeDistributor(parentDistId, parentNodeId, 'LEFT');

      expect(result.success).toBe(false);
      expect(result.code).toBe('SELF_PLACEMENT_NOT_ALLOWED');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 8: Circular Placement Prevention
  // --------------------------------------------------------------------------
  describe('8. Circular Placement Prevention', () => {
    it('should return CIRCULAR_RELATIONSHIP when parent is already a descendant', async () => {
      const ancestorId = 'dist-ancestor-1';
      const descendantNodeId = 'node-descendant-3';

      vi.spyOn(prisma.distributorProfile, 'findFirst')
        .mockResolvedValueOnce({
          id: ancestorId,
          distributorCode: 'KV-ANCESTOR',
          sponsorId: 'sponsor-001',
          businessCenters: [{ id: 'bc-ancestor' }],
        } as any)
        .mockResolvedValueOnce({
          id: 'sponsor-001',
          distributorCode: 'KV-SPONSOR',
          status: 'ACTIVE',
        } as any);

      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce({
        id: descendantNodeId,
        distributorId: 'dist-downline-member',
        distributor: { status: 'ACTIVE', distributorCode: 'KV-DOWNLINE' },
        children: [],
      } as any);

      // Walk up tree: descendantNodeId -> node-ancestor (matches ancestorId!)
      vi.spyOn(prisma.mLMNode, 'findUnique')
        .mockResolvedValueOnce({
          id: descendantNodeId,
          distributorId: 'dist-downline-member',
          placementParentId: 'node-ancestor',
        } as any)
        .mockResolvedValueOnce({
          id: 'node-ancestor',
          distributorId: ancestorId, // CIRCLE FOUND!
          placementParentId: null,
        } as any);

      const result = await TreePlacementService.placeDistributor(ancestorId, descendantNodeId, 'LEFT');

      expect(result.success).toBe(false);
      expect(result.code).toBe('CIRCULAR_RELATIONSHIP');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 9: Invalid Parent
  // --------------------------------------------------------------------------
  describe('9. Invalid Parent', () => {
    it('should return PLACEMENT_PARENT_NOT_FOUND when placement parent does not exist', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst')
        .mockResolvedValueOnce({
          id: childDistId1,
          distributorCode: 'KV-CHILD-1',
          sponsorId: parentDistId,
          businessCenters: [{ id: 'bc-1' }],
        } as any)
        .mockResolvedValueOnce({
          id: parentDistId,
          distributorCode: 'KV-PARENT',
          status: 'ACTIVE',
        } as any);

      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce(null); // Parent node does not exist

      const result = await TreePlacementService.placeDistributor(childDistId1, 'NONEXISTENT_PARENT', 'LEFT');

      expect(result.success).toBe(false);
      expect(result.code).toBe('PLACEMENT_PARENT_NOT_FOUND');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 10: Inactive Parent
  // --------------------------------------------------------------------------
  describe('10. Inactive Parent', () => {
    it('should return PLACEMENT_PARENT_INACTIVE when placement parent status is not ACTIVE', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst')
        .mockResolvedValueOnce({
          id: childDistId1,
          distributorCode: 'KV-CHILD-1',
          sponsorId: parentDistId,
          businessCenters: [{ id: 'bc-1' }],
        } as any)
        .mockResolvedValueOnce({
          id: parentDistId,
          distributorCode: 'KV-PARENT',
          status: 'ACTIVE',
        } as any);

      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce({
        id: parentNodeId,
        distributorId: parentDistId,
        distributor: { status: 'INACTIVE', distributorCode: 'KV-PARENT' }, // INACTIVE PARENT!
        children: [],
      } as any);

      const result = await TreePlacementService.placeDistributor(childDistId1, parentNodeId, 'LEFT');

      expect(result.success).toBe(false);
      expect(result.code).toBe('PLACEMENT_PARENT_INACTIVE');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 11: Concurrent Placement Protection (Row Locking & Unique Constraint)
  // --------------------------------------------------------------------------
  describe('11. Concurrent Placement & Re-verification', () => {
    it('should return POSITION_ALREADY_OCCUPIED if concurrent transaction filled the slot', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst')
        .mockResolvedValueOnce({
          id: childDistId1,
          distributorCode: 'KV-CHILD-1',
          sponsorId: parentDistId,
          businessCenters: [{ id: 'bc-1' }],
        } as any)
        .mockResolvedValueOnce({
          id: parentDistId,
          distributorCode: 'KV-PARENT',
          status: 'ACTIVE',
        } as any);

      // Pre-flight sees 0 children
      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce({
        id: parentNodeId,
        distributorId: parentDistId,
        distributor: { status: 'ACTIVE', distributorCode: 'KV-PARENT' },
        children: [],
      } as any);

      // Inside transaction, row lock discovers someone took LEFT immediately before us!
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const txMock = {
          $queryRaw: vi.fn().mockResolvedValue([]),
          mLMNode: {
            findMany: vi.fn().mockResolvedValue([{ placementPosition: 'LEFT' }]),
          },
        };
        return await callback(txMock);
      });

      const result = await TreePlacementService.placeDistributor(childDistId1, parentNodeId, 'LEFT');

      expect(result.success).toBe(false);
      expect(result.code).toBe('POSITION_ALREADY_OCCUPIED');
    });

    it('should catch Prisma P2002 unique constraint and return POSITION_ALREADY_OCCUPIED', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst')
        .mockResolvedValueOnce({
          id: childDistId1,
          distributorCode: 'KV-CHILD-1',
          sponsorId: parentDistId,
          businessCenters: [{ id: 'bc-1' }],
        } as any)
        .mockResolvedValueOnce({
          id: parentDistId,
          distributorCode: 'KV-PARENT',
          status: 'ACTIVE',
        } as any);

      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce({
        id: parentNodeId,
        distributorId: parentDistId,
        distributor: { status: 'ACTIVE', distributorCode: 'KV-PARENT' },
        children: [],
      } as any);

      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`placementParentId`,`placementPosition`)',
        { code: 'P2002', clientVersion: '6.4.1' }
      );

      vi.spyOn(prisma, '$transaction').mockRejectedValue(p2002Error);

      const result = await TreePlacementService.placeDistributor(childDistId1, parentNodeId, 'LEFT');

      expect(result.success).toBe(false);
      expect(result.code).toBe('POSITION_ALREADY_OCCUPIED');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 12: Helper Methods: getAvailablePositions, getChildren, getParent, validateNoCircularRelationship
  // --------------------------------------------------------------------------
  describe('12. Helper & Query Methods', () => {
    it('getAvailablePositions should return ["LEFT", "RIGHT"] when node has 0 children', async () => {
      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce({
        id: parentNodeId,
      } as any);
      vi.spyOn(prisma.mLMNode, 'findMany').mockResolvedValueOnce([]);

      const positions = await TreePlacementService.getAvailablePositions(parentNodeId);
      expect(positions).toEqual(['LEFT', 'RIGHT']);
    });

    it('getAvailablePositions should return ["RIGHT"] when LEFT is occupied', async () => {
      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce({
        id: parentNodeId,
      } as any);
      vi.spyOn(prisma.mLMNode, 'findMany').mockResolvedValueOnce([
        { placementPosition: 'LEFT' as const },
      ] as any);

      const positions = await TreePlacementService.getAvailablePositions(parentNodeId);
      expect(positions).toEqual(['RIGHT']);
    });

    it('getAvailablePositions should return ["LEFT"] when RIGHT is occupied', async () => {
      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce({
        id: parentNodeId,
      } as any);
      vi.spyOn(prisma.mLMNode, 'findMany').mockResolvedValueOnce([
        { placementPosition: 'RIGHT' as const },
      ] as any);

      const positions = await TreePlacementService.getAvailablePositions(parentNodeId);
      expect(positions).toEqual(['LEFT']);
    });

    it('getAvailablePositions should return [] when both are occupied', async () => {
      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce({
        id: parentNodeId,
      } as any);
      vi.spyOn(prisma.mLMNode, 'findMany').mockResolvedValueOnce([
        { placementPosition: 'LEFT' as const },
        { placementPosition: 'RIGHT' as const },
      ] as any);

      const positions = await TreePlacementService.getAvailablePositions(parentNodeId);
      expect(positions).toEqual([]);
    });

    it('getChildren should return list of child nodes', async () => {
      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce({
        id: parentNodeId,
      } as any);
      vi.spyOn(prisma.mLMNode, 'findMany').mockResolvedValueOnce([
        {
          id: 'child-1',
          placementPosition: 'LEFT',
          distributor: { id: 'dist-1', firstName: 'Child', lastName: 'One' },
          businessCenter: { centerCode: 'BC-1' },
        },
      ] as any);

      const children = await TreePlacementService.getChildren(parentNodeId);
      expect(children).toHaveLength(1);
      expect(children[0].placementPosition).toBe('LEFT');
    });

    it('getParent should return parent node details', async () => {
      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce({
        id: 'child-node-1',
        placementParentId: parentNodeId,
      } as any);

      vi.spyOn(prisma.mLMNode, 'findUnique').mockResolvedValueOnce({
        id: parentNodeId,
        distributorId: parentDistId,
        distributor: {
          id: parentDistId,
          distributorId: 'KV-PARENT',
          distributorCode: 'KV-PARENT',
          firstName: 'Parent',
          lastName: 'Distributor',
          displayName: 'Parent Distributor',
          status: 'ACTIVE',
        },
        businessCenter: {
          id: parentBcId,
          centerCode: 'KV-PARENT-BC1',
          centerNumber: 1,
          status: 'ACTIVE',
        },
      } as any);

      const parent = await TreePlacementService.getParent('child-node-1');
      expect(parent).toBeDefined();
      expect(parent?.id).toBe(parentNodeId);
      expect(parent?.distributor.distributorCode).toBe('KV-PARENT');
    });

    it('getParent should return null for root node with no placementParentId', async () => {
      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce({
        id: 'root-node-1',
        placementParentId: null,
      } as any);

      const parent = await TreePlacementService.getParent('root-node-1');
      expect(parent).toBeNull();
    });

    it('validateNoCircularRelationship should return true when no cycle exists', async () => {
      vi.spyOn(prisma.mLMNode, 'findUnique').mockResolvedValue(null);

      const isValid = await TreePlacementService.validateNoCircularRelationship('dist-new', 'node-parent');
      expect(isValid).toBe(true);
    });

    it('validateNoCircularRelationship should throw error when throwOnError is true and cycle detected', async () => {
      vi.spyOn(prisma.mLMNode, 'findUnique').mockResolvedValueOnce({
        id: 'node-ancestor',
        distributorId: 'dist-new', // Match -> cycle!
        placementParentId: null,
      } as any);

      await expect(
        TreePlacementService.validateNoCircularRelationship('dist-new', 'node-ancestor', true)
      ).rejects.toThrowError();
    });
  });
});
