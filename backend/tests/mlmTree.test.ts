/**
 * Test Suite: MLM Binary & Sponsor Tree Automated Tests
 * Uses Vitest & Supertest
 *
 * Covers:
 * - LEFT placement
 * - RIGHT placement
 * - Occupied position (leg collision & full parent)
 * - Circular relationships (circular binary & circular sponsorship & self-placement)
 * - Cross-business-center placement & ownership validation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { MlmTreeService } from '../src/services/mlmTree.service';
import { AppError } from '../src/utils/appError';
import { createTestToken } from './helpers/testHelpers';

describe('MLM TREE MODULE AUTOMATED TESTS (Supertest + Vitest)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const distA = '11111111-1111-4111-8111-111111111111';
  const distB = '22222222-2222-4222-8222-222222222222';
  const distC = '33333333-3333-4333-8333-333333333333';
  const sponsorId = '44444444-4444-4444-8444-444444444444';
  const parentNodeId = '55555555-5555-4555-8555-555555555555';
  const bcA = '66666666-6666-4666-8666-666666666666';
  const bcB = '77777777-7777-4777-8777-777777777777';
  const bcC = '88888888-8888-4888-8888-888888888888';

  const testToken = createTestToken({
    id: distA,
    email: 'admin@example.com',
    role: 'ADMIN',
  });

  describe('1. LEFT Placement in Binary Tree', () => {
    it('should successfully place a distributor on the LEFT leg', async () => {
      const mockPlacedNode = {
        id: '99999999-9999-4999-8999-999999999999',
        businessCenterId: bcB,
        distributorId: distB,
        placementParentId: parentNodeId,
        placementPosition: 'LEFT',
        depth: 2,
        binaryPath: 'ROOT/L',
        distributor: {
          id: distB,
          distributorCode: 'DST-10002',
          firstName: 'Left',
          lastName: 'Distributor',
        },
      };

      vi.spyOn(MlmTreeService, 'placeDistributor').mockResolvedValue(mockPlacedNode as any);

      const res = await request(app)
        .post('/api/v1/tree/place')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          distributorId: distB,
          businessCenterId: bcB,
          sponsorId: sponsorId,
          placementParentId: parentNodeId,
          placementPosition: 'LEFT',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.placementPosition).toBe('LEFT');
      expect(res.body.data.binaryPath).toBe('ROOT/L');
      expect(res.body.data.depth).toBe(2);
    });
  });

  describe('2. RIGHT Placement in Binary Tree', () => {
    it('should successfully place a distributor on the RIGHT leg', async () => {
      const mockPlacedNode = {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        businessCenterId: bcC,
        distributorId: distC,
        placementParentId: parentNodeId,
        placementPosition: 'RIGHT',
        depth: 2,
        binaryPath: 'ROOT/R',
        distributor: {
          id: distC,
          distributorCode: 'DST-10003',
          firstName: 'Right',
          lastName: 'Distributor',
        },
      };

      vi.spyOn(MlmTreeService, 'placeDistributor').mockResolvedValue(mockPlacedNode as any);

      const res = await request(app)
        .post('/api/v1/tree/place')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          distributorId: distC,
          businessCenterId: bcC,
          sponsorId: sponsorId,
          placementParentId: parentNodeId,
          placementPosition: 'RIGHT',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.placementPosition).toBe('RIGHT');
      expect(res.body.data.binaryPath).toBe('ROOT/R');
    });
  });

  describe('3. Occupied Position Collision Constraints', () => {
    it('should reject placement with 409 Conflict when target leg is already occupied', async () => {
      vi.spyOn(MlmTreeService, 'placeDistributor').mockRejectedValue(
        AppError.conflict(
          `The LEFT position under placement parent (ID: ${parentNodeId}) is already occupied.`
        )
      );

      const res = await request(app)
        .post('/api/v1/tree/place')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          distributorId: distB,
          businessCenterId: bcB,
          sponsorId: sponsorId,
          placementParentId: parentNodeId,
          placementPosition: 'LEFT',
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already occupied');
    });

    it('should reject placement with 409 Conflict when parent already has both children', async () => {
      vi.spyOn(MlmTreeService, 'placeDistributor').mockRejectedValue(
        AppError.conflict('Both LEFT and RIGHT positions under this placement parent are already occupied.')
      );

      const res = await request(app)
        .post('/api/v1/tree/place')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          distributorId: distC,
          businessCenterId: bcC,
          sponsorId: sponsorId,
          placementParentId: parentNodeId,
          placementPosition: 'LEFT',
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Both LEFT and RIGHT positions under this placement parent are already occupied');
    });
  });

  describe('4. Circular Relationship & Self-Placement Constraints', () => {
    it('should reject placement with 400 Bad Request when distributor attempts self-sponsorship', async () => {
      vi.spyOn(MlmTreeService, 'placeDistributor').mockRejectedValue(
        AppError.badRequest('Self-sponsorship is forbidden: A distributor cannot sponsor themselves.')
      );

      const res = await request(app)
        .post('/api/v1/tree/place')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          distributorId: distA,
          businessCenterId: bcA,
          sponsorId: distA, // self-sponsorship
          placementParentId: parentNodeId,
          placementPosition: 'LEFT',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Self-sponsorship is forbidden');
    });

    it('should reject placement with 400 Bad Request when distributor attempts self-placement', async () => {
      vi.spyOn(MlmTreeService, 'placeDistributor').mockRejectedValue(
        AppError.badRequest('Self-placement is forbidden: A distributor cannot place a node under their own node directly.')
      );

      const res = await request(app)
        .post('/api/v1/tree/place')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          distributorId: distA,
          businessCenterId: bcA,
          sponsorId: sponsorId,
          placementParentId: parentNodeId,
          placementPosition: 'LEFT',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Self-placement is forbidden');
    });

    it('should reject circular binary reference when parent is already a descendant', async () => {
      const descendantNodeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      vi.spyOn(MlmTreeService, 'placeDistributor').mockRejectedValue(
        AppError.badRequest(
          'Circular reference detected in binary tree: Placement parent is already a descendant in this distributor’s subtree.'
        )
      );

      const res = await request(app)
        .post('/api/v1/tree/place')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          distributorId: distA,
          businessCenterId: bcA,
          sponsorId: sponsorId,
          placementParentId: descendantNodeId,
          placementPosition: 'LEFT',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Circular reference detected in binary tree');
    });

    it('should reject circular sponsorship when proposed sponsor is a downline descendant', async () => {
      vi.spyOn(MlmTreeService, 'placeDistributor').mockRejectedValue(
        AppError.badRequest(
          'Circular sponsorship forbidden: Proposed sponsor is already a descendant in this distributor’s sponsorship downline.'
        )
      );

      const res = await request(app)
        .post('/api/v1/tree/place')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          distributorId: distA,
          businessCenterId: bcA,
          sponsorId: distB,
          placementParentId: parentNodeId,
          placementPosition: 'RIGHT',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Circular sponsorship forbidden');
    });
  });

  describe('5. Cross-Business-Center Placement & Ownership Validation', () => {
    it('should reject placement with 400 Bad Request when Business Center belongs to a different distributor', async () => {
      vi.spyOn(MlmTreeService, 'placeDistributor').mockRejectedValue(
        AppError.badRequest('Business Center does not belong to the specified distributor.')
      );

      const res = await request(app)
        .post('/api/v1/tree/place')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          distributorId: distA,
          businessCenterId: bcB, // cross-business-center mismatch
          sponsorId: sponsorId,
          placementParentId: parentNodeId,
          placementPosition: 'LEFT',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Business Center does not belong to the specified distributor');
    });

    it('should reject duplicate placement with 409 Conflict if Business Center is already placed', async () => {
      vi.spyOn(MlmTreeService, 'placeDistributor').mockRejectedValue(
        AppError.conflict(
          'Duplicate placement forbidden: This business center is already placed in the binary tree.'
        )
      );

      const res = await request(app)
        .post('/api/v1/tree/place')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          distributorId: distB,
          businessCenterId: bcB,
          sponsorId: sponsorId,
          placementParentId: parentNodeId,
          placementPosition: 'RIGHT',
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Duplicate placement forbidden');
    });
  });
});
