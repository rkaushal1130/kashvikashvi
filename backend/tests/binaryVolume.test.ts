import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/config/database';
import {
  BinaryVolumeService,
  BinaryVolumeSummary,
} from '../src/services/binaryVolume.service';

describe('BINARY LEFT/RIGHT VOLUME ENGINE TESTS (PROMPT 4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    BinaryVolumeService.resetMockStore();

    // Mock interactive transactions so tests run cleanly in both offline & online DB environments
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });
  });

  // =========================================================================
  // 1. DIRECT LEFT MEMBER TESTS
  // =========================================================================
  describe('1. Direct Left Member', () => {
    it('should correctly identify a direct left child and calculate left volume', async () => {
      // Setup: Member A -> LEFT: Member B (500 BV)
      BinaryVolumeService.setMockDistributor({
        id: 'member-A',
        distributorCode: 'DST-A',
        leftVolume: 0,
        rightVolume: 0,
      });
      BinaryVolumeService.setMockDistributor({
        id: 'member-B',
        distributorCode: 'DST-B',
        currentBB: 500,
      });

      BinaryVolumeService.setMockNode({
        id: 'node-A',
        distributorId: 'member-A',
        placementParentId: null,
        placementPosition: null,
        binaryPath: 'ROOT',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-B',
        distributorId: 'member-B',
        placementParentId: 'node-A',
        placementPosition: 'LEFT',
        binaryPath: 'ROOT/L',
      });

      BinaryVolumeService.setMockQualifyingVolume('member-B', 500);

      // Verify downline membership
      const leg = await BinaryVolumeService.getMemberLegUnderAncestor('member-A', 'member-B');
      expect(leg).toBe('LEFT');

      const leftDownline = await BinaryVolumeService.getDownlineMemberIds('member-A', 'LEFT');
      expect(leftDownline).toEqual(['member-B']);

      const rightDownline = await BinaryVolumeService.getDownlineMemberIds('member-A', 'RIGHT');
      expect(rightDownline).toEqual([]);

      // Recalculate Left Volume
      const leftVol = await BinaryVolumeService.recalculateLeftVolume('member-A');
      expect(leftVol).toBe(500);

      const fetchedLeftVol = await BinaryVolumeService.getLeftVolume('member-A');
      expect(fetchedLeftVol).toBe(500);

      const fetchedRightVol = await BinaryVolumeService.getRightVolume('member-A');
      expect(fetchedRightVol).toBe(0);
    });
  });

  // =========================================================================
  // 2. DIRECT RIGHT MEMBER TESTS
  // =========================================================================
  describe('2. Direct Right Member', () => {
    it('should correctly identify a direct right child and calculate right volume', async () => {
      // Setup: Member A -> RIGHT: Member D (750 BV)
      BinaryVolumeService.setMockDistributor({
        id: 'member-A',
        distributorCode: 'DST-A',
        leftVolume: 0,
        rightVolume: 0,
      });
      BinaryVolumeService.setMockDistributor({
        id: 'member-D',
        distributorCode: 'DST-D',
        currentBB: 750,
      });

      BinaryVolumeService.setMockNode({
        id: 'node-A',
        distributorId: 'member-A',
        placementParentId: null,
        placementPosition: null,
        binaryPath: 'ROOT',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-D',
        distributorId: 'member-D',
        placementParentId: 'node-A',
        placementPosition: 'RIGHT',
        binaryPath: 'ROOT/R',
      });

      BinaryVolumeService.setMockQualifyingVolume('member-D', 750);

      // Verify downline membership
      const leg = await BinaryVolumeService.getMemberLegUnderAncestor('member-A', 'member-D');
      expect(leg).toBe('RIGHT');

      const rightDownline = await BinaryVolumeService.getDownlineMemberIds('member-A', 'RIGHT');
      expect(rightDownline).toEqual(['member-D']);

      const leftDownline = await BinaryVolumeService.getDownlineMemberIds('member-A', 'LEFT');
      expect(leftDownline).toEqual([]);

      // Recalculate Right Volume
      const rightVol = await BinaryVolumeService.recalculateRightVolume('member-A');
      expect(rightVol).toBe(750);

      const fetchedRightVol = await BinaryVolumeService.getRightVolume('member-A');
      expect(fetchedRightVol).toBe(750);

      const fetchedLeftVol = await BinaryVolumeService.getLeftVolume('member-A');
      expect(fetchedLeftVol).toBe(0);
    });
  });

  // =========================================================================
  // 3. MULTI-LEVEL LEFT DOWNLINE TESTS
  // =========================================================================
  describe('3. Multi-Level Left Downline', () => {
    it('should support multi-level downline calculation for the entire left subtree (B -> C -> F)', async () => {
      // Setup:
      // Member A
      // └── LEFT: Member B (500)
      //     └── LEFT: Member C (300)
      //         └── RIGHT: Member F (200)
      // Total Left Volume = 500 + 300 + 200 = 1,000
      BinaryVolumeService.setMockDistributor({ id: 'member-A', distributorCode: 'DST-A' });
      BinaryVolumeService.setMockDistributor({ id: 'member-B', distributorCode: 'DST-B' });
      BinaryVolumeService.setMockDistributor({ id: 'member-C', distributorCode: 'DST-C' });
      BinaryVolumeService.setMockDistributor({ id: 'member-F', distributorCode: 'DST-F' });

      BinaryVolumeService.setMockNode({
        id: 'node-A',
        distributorId: 'member-A',
        placementParentId: null,
        placementPosition: null,
        binaryPath: 'ROOT',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-B',
        distributorId: 'member-B',
        placementParentId: 'node-A',
        placementPosition: 'LEFT',
        binaryPath: 'ROOT/L',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-C',
        distributorId: 'member-C',
        placementParentId: 'node-B',
        placementPosition: 'LEFT',
        binaryPath: 'ROOT/L/L',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-F',
        distributorId: 'member-F',
        placementParentId: 'node-C',
        placementPosition: 'RIGHT',
        binaryPath: 'ROOT/L/L/R',
      });

      BinaryVolumeService.setMockQualifyingVolume('member-B', 500);
      BinaryVolumeService.setMockQualifyingVolume('member-C', 300);
      BinaryVolumeService.setMockQualifyingVolume('member-F', 200);

      // Verify all members belong to A's LEFT leg
      expect(await BinaryVolumeService.getMemberLegUnderAncestor('member-A', 'member-B')).toBe('LEFT');
      expect(await BinaryVolumeService.getMemberLegUnderAncestor('member-A', 'member-C')).toBe('LEFT');
      expect(await BinaryVolumeService.getMemberLegUnderAncestor('member-A', 'member-F')).toBe('LEFT');

      const leftDownline = await BinaryVolumeService.getDownlineMemberIds('member-A', 'LEFT');
      expect(leftDownline).toContain('member-B');
      expect(leftDownline).toContain('member-C');
      expect(leftDownline).toContain('member-F');
      expect(leftDownline.length).toBe(3);

      // Recalculate Left Volume across the entire subtree
      const leftVol = await BinaryVolumeService.recalculateLeftVolume('member-A');
      expect(leftVol).toBe(1000);

      // Verify detailed result format
      const detailed = await BinaryVolumeService.recalculateLeftVolume('member-A', { detailed: true });
      expect(detailed.volume).toBe(1000);
      expect(detailed.leg).toBe('LEFT');
      expect(detailed.downlineCount).toBe(3);
    });
  });

  // =========================================================================
  // 4. MULTI-LEVEL RIGHT DOWNLINE TESTS
  // =========================================================================
  describe('4. Multi-Level Right Downline', () => {
    it('should support multi-level downline calculation for the entire right subtree (D -> E -> G)', async () => {
      // Setup:
      // Member A
      // └── RIGHT: Member D (600)
      //     └── RIGHT: Member E (400)
      //         └── LEFT: Member G (250)
      // Total Right Volume = 600 + 400 + 250 = 1,250
      BinaryVolumeService.setMockDistributor({ id: 'member-A', distributorCode: 'DST-A' });
      BinaryVolumeService.setMockDistributor({ id: 'member-D', distributorCode: 'DST-D' });
      BinaryVolumeService.setMockDistributor({ id: 'member-E', distributorCode: 'DST-E' });
      BinaryVolumeService.setMockDistributor({ id: 'member-G', distributorCode: 'DST-G' });

      BinaryVolumeService.setMockNode({
        id: 'node-A',
        distributorId: 'member-A',
        placementParentId: null,
        placementPosition: null,
        binaryPath: 'ROOT',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-D',
        distributorId: 'member-D',
        placementParentId: 'node-A',
        placementPosition: 'RIGHT',
        binaryPath: 'ROOT/R',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-E',
        distributorId: 'member-E',
        placementParentId: 'node-D',
        placementPosition: 'RIGHT',
        binaryPath: 'ROOT/R/R',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-G',
        distributorId: 'member-G',
        placementParentId: 'node-E',
        placementPosition: 'LEFT',
        binaryPath: 'ROOT/R/R/L',
      });

      BinaryVolumeService.setMockQualifyingVolume('member-D', 600);
      BinaryVolumeService.setMockQualifyingVolume('member-E', 400);
      BinaryVolumeService.setMockQualifyingVolume('member-G', 250);

      // Verify all members belong to A's RIGHT leg
      expect(await BinaryVolumeService.getMemberLegUnderAncestor('member-A', 'member-D')).toBe('RIGHT');
      expect(await BinaryVolumeService.getMemberLegUnderAncestor('member-A', 'member-E')).toBe('RIGHT');
      expect(await BinaryVolumeService.getMemberLegUnderAncestor('member-A', 'member-G')).toBe('RIGHT');

      const rightDownline = await BinaryVolumeService.getDownlineMemberIds('member-A', 'RIGHT');
      expect(rightDownline).toContain('member-D');
      expect(rightDownline).toContain('member-E');
      expect(rightDownline).toContain('member-G');
      expect(rightDownline.length).toBe(3);

      // Recalculate Right Volume across the entire subtree
      const rightVol = await BinaryVolumeService.recalculateRightVolume('member-A');
      expect(rightVol).toBe(1250);
    });
  });

  // =========================================================================
  // 5. INDEPENDENT LEFT / RIGHT CALCULATIONS
  // =========================================================================
  describe('5. Independent Left/Right Calculations', () => {
    it('should calculate left and right legs completely independently without side effects', async () => {
      // Setup Member A with 1,000 on LEFT and 1,500 on RIGHT
      BinaryVolumeService.setMockDistributor({
        id: 'member-A',
        distributorCode: 'DST-A',
        leftVolume: 1000,
        rightVolume: 1500,
      });

      BinaryVolumeService.setMockNode({
        id: 'node-A',
        distributorId: 'member-A',
        placementParentId: null,
        placementPosition: null,
        binaryPath: 'ROOT',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-B',
        distributorId: 'member-B',
        placementParentId: 'node-A',
        placementPosition: 'LEFT',
        binaryPath: 'ROOT/L',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-D',
        distributorId: 'member-D',
        placementParentId: 'node-A',
        placementPosition: 'RIGHT',
        binaryPath: 'ROOT/R',
      });

      BinaryVolumeService.setMockQualifyingVolume('member-B', 1000);
      BinaryVolumeService.setMockQualifyingVolume('member-D', 1500);

      // Verify independent volume getters
      expect(await BinaryVolumeService.getLeftVolume('member-A')).toBe(1000);
      expect(await BinaryVolumeService.getRightVolume('member-A')).toBe(1500);

      // Verify independent matching getters
      expect(await BinaryVolumeService.getLeftMatching('member-A')).toBe(1000);
      expect(await BinaryVolumeService.getRightMatching('member-A')).toBe(1000);

      // Update LEFT volume only (add 500 to Member B)
      BinaryVolumeService.setMockQualifyingVolume('member-B', 1500);
      const newLeft = await BinaryVolumeService.recalculateLeftVolume('member-A');
      expect(newLeft).toBe(1500);

      // RIGHT volume must remain completely unchanged at 1500
      expect(await BinaryVolumeService.getRightVolume('member-A')).toBe(1500);

      // Update RIGHT volume only (add 1,000 to Member D)
      BinaryVolumeService.setMockQualifyingVolume('member-D', 2500);
      const newRight = await BinaryVolumeService.recalculateRightVolume('member-A');
      expect(newRight).toBe(2500);

      // LEFT volume must remain completely unchanged at 1500
      expect(await BinaryVolumeService.getLeftVolume('member-A')).toBe(1500);

      // Verify independent recalculation of matching
      const leftMatching = await BinaryVolumeService.recalculateLeftMatching('member-A');
      expect(leftMatching).toBe(1500);

      const rightMatching = await BinaryVolumeService.recalculateRightMatching('member-A');
      expect(rightMatching).toBe(1500);
    });
  });

  // =========================================================================
  // 6. MEMBER WITH ONLY LEFT VOLUME
  // =========================================================================
  describe('6. Member with Only Left Volume', () => {
    it('should correctly handle a member having only left downline volume and 0 right volume', async () => {
      // Member A has B (2,500 BV) on LEFT, nothing on RIGHT
      BinaryVolumeService.setMockDistributor({ id: 'member-A', distributorCode: 'DST-A' });
      BinaryVolumeService.setMockDistributor({ id: 'member-B', distributorCode: 'DST-B' });

      BinaryVolumeService.setMockNode({
        id: 'node-A',
        distributorId: 'member-A',
        placementParentId: null,
        placementPosition: null,
        binaryPath: 'ROOT',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-B',
        distributorId: 'member-B',
        placementParentId: 'node-A',
        placementPosition: 'LEFT',
        binaryPath: 'ROOT/L',
      });

      BinaryVolumeService.setMockQualifyingVolume('member-B', 2500);

      const summary: BinaryVolumeSummary = await BinaryVolumeService.recalculateBinaryVolumes('member-A');

      expect(summary.leftVolume).toBe(2500);
      expect(summary.rightVolume).toBe(0);
      expect(summary.leftMatching).toBe(0);
      expect(summary.rightMatching).toBe(0);
      expect(summary.carryForwardLeft).toBe(2500);
      expect(summary.carryForwardRight).toBe(0);
      expect(summary.strongLeg).toBe('LEFT');
      expect(summary.weakLeg).toBe('RIGHT');
      expect(summary.isBalanced).toBe(false);

      // Independent matching getters must return 0
      expect(await BinaryVolumeService.getLeftMatching('member-A')).toBe(0);
      expect(await BinaryVolumeService.getRightMatching('member-A')).toBe(0);
    });
  });

  // =========================================================================
  // 7. MEMBER WITH ONLY RIGHT VOLUME
  // =========================================================================
  describe('7. Member with Only Right Volume', () => {
    it('should correctly handle a member having only right downline volume and 0 left volume', async () => {
      // Member A has D (3,500 BV) on RIGHT, nothing on LEFT
      BinaryVolumeService.setMockDistributor({ id: 'member-A', distributorCode: 'DST-A' });
      BinaryVolumeService.setMockDistributor({ id: 'member-D', distributorCode: 'DST-D' });

      BinaryVolumeService.setMockNode({
        id: 'node-A',
        distributorId: 'member-A',
        placementParentId: null,
        placementPosition: null,
        binaryPath: 'ROOT',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-D',
        distributorId: 'member-D',
        placementParentId: 'node-A',
        placementPosition: 'RIGHT',
        binaryPath: 'ROOT/R',
      });

      BinaryVolumeService.setMockQualifyingVolume('member-D', 3500);

      const summary: BinaryVolumeSummary = await BinaryVolumeService.recalculateBinaryVolumes('member-A');

      expect(summary.leftVolume).toBe(0);
      expect(summary.rightVolume).toBe(3500);
      expect(summary.leftMatching).toBe(0);
      expect(summary.rightMatching).toBe(0);
      expect(summary.carryForwardLeft).toBe(0);
      expect(summary.carryForwardRight).toBe(3500);
      expect(summary.strongLeg).toBe('RIGHT');
      expect(summary.weakLeg).toBe('LEFT');
      expect(summary.isBalanced).toBe(false);

      // Independent matching getters must return 0
      expect(await BinaryVolumeService.getLeftMatching('member-A')).toBe(0);
      expect(await BinaryVolumeService.getRightMatching('member-A')).toBe(0);
    });
  });

  // =========================================================================
  // 8. BALANCED TREE TESTS
  // =========================================================================
  describe('8. Balanced Tree', () => {
    it('should calculate matching and volumes accurately for a balanced binary tree', async () => {
      // Member A:
      // LEFT: B (1,000) + C (1,000) = 2,000
      // RIGHT: D (1,000) + E (1,000) = 2,000
      BinaryVolumeService.setMockDistributor({ id: 'member-A', distributorCode: 'DST-A' });
      BinaryVolumeService.setMockDistributor({ id: 'member-B', distributorCode: 'DST-B' });
      BinaryVolumeService.setMockDistributor({ id: 'member-C', distributorCode: 'DST-C' });
      BinaryVolumeService.setMockDistributor({ id: 'member-D', distributorCode: 'DST-D' });
      BinaryVolumeService.setMockDistributor({ id: 'member-E', distributorCode: 'DST-E' });

      BinaryVolumeService.setMockNode({
        id: 'node-A',
        distributorId: 'member-A',
        placementParentId: null,
        placementPosition: null,
        binaryPath: 'ROOT',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-B',
        distributorId: 'member-B',
        placementParentId: 'node-A',
        placementPosition: 'LEFT',
        binaryPath: 'ROOT/L',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-C',
        distributorId: 'member-C',
        placementParentId: 'node-B',
        placementPosition: 'LEFT',
        binaryPath: 'ROOT/L/L',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-D',
        distributorId: 'member-D',
        placementParentId: 'node-A',
        placementPosition: 'RIGHT',
        binaryPath: 'ROOT/R',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-E',
        distributorId: 'member-E',
        placementParentId: 'node-D',
        placementPosition: 'RIGHT',
        binaryPath: 'ROOT/R/R',
      });

      BinaryVolumeService.setMockQualifyingVolume('member-B', 1000);
      BinaryVolumeService.setMockQualifyingVolume('member-C', 1000);
      BinaryVolumeService.setMockQualifyingVolume('member-D', 1000);
      BinaryVolumeService.setMockQualifyingVolume('member-E', 1000);

      const summary = await BinaryVolumeService.recalculateBinaryVolumes('member-A');

      expect(summary.leftVolume).toBe(2000);
      expect(summary.rightVolume).toBe(2000);
      expect(summary.leftMatching).toBe(2000);
      expect(summary.rightMatching).toBe(2000);
      expect(summary.carryForwardLeft).toBe(0);
      expect(summary.carryForwardRight).toBe(0);
      expect(summary.strongLeg).toBe('BALANCED');
      expect(summary.weakLeg).toBe('BALANCED');
      expect(summary.isBalanced).toBe(true);
      expect(summary.leftDownlineMemberIds).toHaveLength(2);
      expect(summary.rightDownlineMemberIds).toHaveLength(2);
    });
  });

  // =========================================================================
  // 9. UNBALANCED TREE TESTS
  // =========================================================================
  describe('9. Unbalanced Tree', () => {
    it('should calculate independent legs, matching and carry-forward accurately for an unbalanced tree', async () => {
      // Member A:
      // LEFT: 15,000 volume
      // RIGHT: 4,000 volume
      BinaryVolumeService.setMockDistributor({ id: 'member-A', distributorCode: 'DST-A' });
      BinaryVolumeService.setMockDistributor({ id: 'member-B', distributorCode: 'DST-B' });
      BinaryVolumeService.setMockDistributor({ id: 'member-D', distributorCode: 'DST-D' });

      BinaryVolumeService.setMockNode({
        id: 'node-A',
        distributorId: 'member-A',
        placementParentId: null,
        placementPosition: null,
        binaryPath: 'ROOT',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-B',
        distributorId: 'member-B',
        placementParentId: 'node-A',
        placementPosition: 'LEFT',
        binaryPath: 'ROOT/L',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-D',
        distributorId: 'member-D',
        placementParentId: 'node-A',
        placementPosition: 'RIGHT',
        binaryPath: 'ROOT/R',
      });

      BinaryVolumeService.setMockQualifyingVolume('member-B', 15000);
      BinaryVolumeService.setMockQualifyingVolume('member-D', 4000);

      const summary = await BinaryVolumeService.recalculateBinaryVolumes('member-A');

      expect(summary.leftVolume).toBe(15000);
      expect(summary.rightVolume).toBe(4000);
      expect(summary.leftMatching).toBe(4000);
      expect(summary.rightMatching).toBe(4000);
      expect(summary.carryForwardLeft).toBe(11000);
      expect(summary.carryForwardRight).toBe(0);
      expect(summary.strongLeg).toBe('LEFT');
      expect(summary.weakLeg).toBe('RIGHT');
      expect(summary.isBalanced).toBe(false);

      // Verify that left and right matching remain strictly independent
      expect(await BinaryVolumeService.getLeftMatching('member-A')).toBe(4000);
      expect(await BinaryVolumeService.getRightMatching('member-A')).toBe(4000);
    });
  });

  // =========================================================================
  // 10. ALL 9 REQUIRED SERVICE METHODS VERIFICATION
  // =========================================================================
  describe('10. All 9 Required Binary Volume Service Methods', () => {
    it('should support all 9 required methods with correct signatures and behavior', async () => {
      BinaryVolumeService.setMockDistributor({
        id: 'member-test-01',
        distributorCode: 'DST-T01',
        leftVolume: 8000,
        rightVolume: 6000,
      });

      BinaryVolumeService.setMockNode({
        id: 'node-T01',
        distributorId: 'member-test-01',
        placementParentId: null,
        placementPosition: null,
        binaryPath: 'ROOT',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-T01-L',
        distributorId: 'member-test-L',
        placementParentId: 'node-T01',
        placementPosition: 'LEFT',
        binaryPath: 'ROOT/L',
      });
      BinaryVolumeService.setMockNode({
        id: 'node-T01-R',
        distributorId: 'member-test-R',
        placementParentId: 'node-T01',
        placementPosition: 'RIGHT',
        binaryPath: 'ROOT/R',
      });

      BinaryVolumeService.setMockQualifyingVolume('member-test-L', 8000);
      BinaryVolumeService.setMockQualifyingVolume('member-test-R', 6000);

      // 1. getLeftVolume(memberId)
      const leftVol = await BinaryVolumeService.getLeftVolume('member-test-01');
      expect(leftVol).toBe(8000);

      // 2. getRightVolume(memberId)
      const rightVol = await BinaryVolumeService.getRightVolume('member-test-01');
      expect(rightVol).toBe(6000);

      // 3. getLeftMatching(memberId)
      const leftMatching = await BinaryVolumeService.getLeftMatching('member-test-01');
      expect(leftMatching).toBe(6000);

      // 4. getRightMatching(memberId)
      const rightMatching = await BinaryVolumeService.getRightMatching('member-test-01');
      expect(rightMatching).toBe(6000);

      // 5. recalculateLeftVolume(memberId)
      const recalcLeft = await BinaryVolumeService.recalculateLeftVolume('member-test-01');
      expect(recalcLeft).toBe(8000);

      // 6. recalculateRightVolume(memberId)
      const recalcRight = await BinaryVolumeService.recalculateRightVolume('member-test-01');
      expect(recalcRight).toBe(6000);

      // 7. recalculateLeftMatching(memberId)
      const recalcLeftMatching = await BinaryVolumeService.recalculateLeftMatching('member-test-01');
      expect(recalcLeftMatching).toBe(6000);

      // 8. recalculateRightMatching(memberId)
      const recalcRightMatching = await BinaryVolumeService.recalculateRightMatching('member-test-01');
      expect(recalcRightMatching).toBe(6000);

      // 9. recalculateBinaryVolumes(memberId)
      const summary = await BinaryVolumeService.recalculateBinaryVolumes('member-test-01');
      expect(summary).toBeDefined();
      expect(summary.leftVolume).toBe(8000);
      expect(summary.rightVolume).toBe(6000);
      expect(summary.leftMatching).toBe(6000);
      expect(summary.rightMatching).toBe(6000);
      expect(summary.carryForwardLeft).toBe(2000);
      expect(summary.carryForwardRight).toBe(0);
      expect(summary.strongLeg).toBe('LEFT');
      expect(summary.weakLeg).toBe('RIGHT');
      expect(summary.isBalanced).toBe(false);
    });

    it('should throw AppError.notFound when distributor does not exist', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(null);

      await expect(BinaryVolumeService.getLeftVolume('NON_EXISTENT')).rejects.toThrow(/not found/i);
      await expect(BinaryVolumeService.getRightVolume('NON_EXISTENT')).rejects.toThrow(/not found/i);
      await expect(BinaryVolumeService.getLeftMatching('NON_EXISTENT')).rejects.toThrow(/not found/i);
      await expect(BinaryVolumeService.getRightMatching('NON_EXISTENT')).rejects.toThrow(/not found/i);
      await expect(BinaryVolumeService.recalculateLeftVolume('NON_EXISTENT')).rejects.toThrow(/not found/i);
      await expect(BinaryVolumeService.recalculateRightVolume('NON_EXISTENT')).rejects.toThrow(/not found/i);
      await expect(BinaryVolumeService.recalculateBinaryVolumes('NON_EXISTENT')).rejects.toThrow(/not found/i);
    });
  });
});
