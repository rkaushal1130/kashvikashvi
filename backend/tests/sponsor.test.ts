/**
 * Test Suite: Sponsor Validation System
 * Architecture: Controller -> Service -> Repository/Prisma -> Database
 * Endpoint: GET /api/v1/sponsors/:sponsorId
 *
 * Covers:
 * 1. Valid sponsor
 * 2. Invalid sponsor (SPONSOR_NOT_FOUND)
 * 3. Inactive sponsor (SPONSOR_INACTIVE)
 * 4. Sponsor with no children (both LEFT & RIGHT available)
 * 5. Sponsor with LEFT occupied (only RIGHT available)
 * 6. Sponsor with RIGHT occupied (only LEFT available)
 * 7. Sponsor with both occupied (empty array [])
 * 8. Never exposes sensitive information (Privacy guard)
 * 9. Reusable SponsorService unit methods (validateSponsor, isPositionAvailable, getAvailablePositions)
 * 10. SponsorRepository database encapsulation tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { SponsorService } from '../src/services/sponsor.service';
import { SponsorRepository } from '../src/repositories/sponsor.repository';

describe('SPONSOR VALIDATION API TESTS (GET /api/v1/sponsors/:sponsorId)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockUuid = '11111111-2222-3333-4444-555555555555';

  // --------------------------------------------------------------------------
  // TEST 1: Valid Sponsor & Data Structure
  // --------------------------------------------------------------------------
  describe('1. Valid Sponsor', () => {
    it('should successfully return sponsor profile and available positions', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: mockUuid,
        distributorId: 'KV-1001',
        distributorCode: 'KV-1001',
        firstName: 'Rahul',
        lastName: 'Kaushal',
        displayName: 'Rahul Kaushal',
        status: 'ACTIVE',
        mlmNodes: [
          {
            id: 'node-rahul-1',
            children: [
              { placementPosition: 'LEFT' as const },
            ],
          },
        ],
      } as any);

      const res = await request(app)
        .get('/api/v1/sponsors/KV-1001')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.sponsor).toEqual({
        id: mockUuid,
        distributorId: 'KV-1001',
        name: 'Rahul Kaushal',
        status: 'ACTIVE',
      });
      expect(res.body.data.availablePositions).toEqual(['RIGHT']);
    });
  });

  // --------------------------------------------------------------------------
  // TEST 2: Invalid Sponsor
  // --------------------------------------------------------------------------
  describe('2. Invalid Sponsor', () => {
    it('should return 404 with SPONSOR_NOT_FOUND when sponsor does not exist', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/sponsors/NONEXISTENT-9999')
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('SPONSOR_NOT_FOUND');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 3: Inactive Sponsor
  // --------------------------------------------------------------------------
  describe('3. Inactive Sponsor', () => {
    it('should return 400 with SPONSOR_INACTIVE when sponsor status is not ACTIVE', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: mockUuid,
        distributorId: 'KV-9999',
        distributorCode: 'KV-9999',
        firstName: 'Inactive',
        lastName: 'Member',
        displayName: 'Inactive Member',
        status: 'INACTIVE',
        mlmNodes: [],
      } as any);

      const res = await request(app)
        .get('/api/v1/sponsors/KV-9999')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('SPONSOR_INACTIVE');
    });

    it('should also reject SUSPENDED or TERMINATED sponsor with SPONSOR_INACTIVE', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: mockUuid,
        distributorId: 'KV-SUSPENDED',
        distributorCode: 'KV-SUSPENDED',
        firstName: 'Suspended',
        lastName: 'Member',
        displayName: 'Suspended Member',
        status: 'SUSPENDED',
        mlmNodes: [],
      } as any);

      const res = await request(app)
        .get('/api/v1/sponsors/KV-SUSPENDED')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('SPONSOR_INACTIVE');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 4: Sponsor with No Children (Both LEFT & RIGHT Available)
  // --------------------------------------------------------------------------
  describe('4. Sponsor with No Children', () => {
    it('should return both LEFT and RIGHT available when sponsor has 0 children', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: mockUuid,
        distributorId: 'KV-1005',
        distributorCode: 'KV-1005',
        firstName: 'Diana',
        lastName: 'Prince',
        displayName: 'Diana Prince',
        status: 'ACTIVE',
        mlmNodes: [
          {
            id: 'node-diana-1',
            children: [],
          },
        ],
      } as any);

      const res = await request(app)
        .get('/api/v1/sponsors/KV-1005')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.availablePositions).toEqual(['LEFT', 'RIGHT']);
    });
  });

  // --------------------------------------------------------------------------
  // TEST 5: Sponsor with LEFT Occupied (Only RIGHT Available)
  // --------------------------------------------------------------------------
  describe('5. Sponsor with LEFT Occupied', () => {
    it('should return ["RIGHT"] when LEFT leg is occupied', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: mockUuid,
        distributorId: 'KV-1004',
        distributorCode: 'KV-1004',
        firstName: 'Charlie',
        lastName: 'Davis',
        displayName: 'Charlie Davis',
        status: 'ACTIVE',
        mlmNodes: [
          {
            id: 'node-charlie-1',
            children: [
              { placementPosition: 'LEFT' as const },
            ],
          },
        ],
      } as any);

      const res = await request(app)
        .get('/api/v1/sponsors/KV-1004')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.availablePositions).toEqual(['RIGHT']);
    });
  });

  // --------------------------------------------------------------------------
  // TEST 6: Sponsor with RIGHT Occupied (Only LEFT Available)
  // --------------------------------------------------------------------------
  describe('6. Sponsor with RIGHT Occupied', () => {
    it('should return ["LEFT"] when RIGHT leg is occupied', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: mockUuid,
        distributorId: 'KV-1007',
        distributorCode: 'KV-1007',
        firstName: 'George',
        lastName: 'Miller',
        displayName: 'George Miller',
        status: 'ACTIVE',
        mlmNodes: [
          {
            id: 'node-george-1',
            children: [
              { placementPosition: 'RIGHT' as const },
            ],
          },
        ],
      } as any);

      const res = await request(app)
        .get('/api/v1/sponsors/KV-1007')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.availablePositions).toEqual(['LEFT']);
    });
  });

  // --------------------------------------------------------------------------
  // TEST 7: Sponsor with Both Positions Occupied (Empty Array)
  // --------------------------------------------------------------------------
  describe('7. Sponsor with Both Occupied', () => {
    it('should return [] when both LEFT and RIGHT positions are occupied', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: mockUuid,
        distributorId: 'KV-1001',
        distributorCode: 'KV-1001',
        firstName: 'Rahul',
        lastName: 'Kaushal',
        displayName: 'Rahul Kaushal',
        status: 'ACTIVE',
        mlmNodes: [
          {
            id: 'node-rahul-1',
            children: [
              { placementPosition: 'LEFT' as const },
              { placementPosition: 'RIGHT' as const },
            ],
          },
        ],
      } as any);

      const res = await request(app)
        .get('/api/v1/sponsors/KV-1001')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.availablePositions).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // TEST 8: Privacy Verification (Never Expose Sensitive Information)
  // --------------------------------------------------------------------------
  describe('8. Privacy Guard', () => {
    it('should NEVER expose private fields like email, phone, passwords, bank, wallet, etc.', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: mockUuid,
        distributorId: 'KV-1001',
        distributorCode: 'KV-1001',
        firstName: 'Rahul',
        lastName: 'Kaushal',
        displayName: 'Rahul Kaushal',
        status: 'ACTIVE',
        mlmNodes: [],
      } as any);

      const res = await request(app)
        .get('/api/v1/sponsors/KV-1001')
        .expect(200);

      const sponsor = res.body.data.sponsor;
      expect(sponsor.email).toBeUndefined();
      expect(sponsor.phone).toBeUndefined();
      expect(sponsor.password).toBeUndefined();
      expect(sponsor.passwordHash).toBeUndefined();
      expect(sponsor.bankAccounts).toBeUndefined();
      expect(sponsor.wallet).toBeUndefined();
      expect(sponsor.dateOfBirth).toBeUndefined();
      expect(sponsor.lifetimePV).toBeUndefined();
      expect(sponsor.lifetimeGV).toBeUndefined();

      // Ensure ONLY the permitted safe fields exist
      const keys = Object.keys(sponsor);
      expect(keys.sort()).toEqual(['distributorId', 'id', 'name', 'status'].sort());
    });
  });

  // --------------------------------------------------------------------------
  // TEST 9: Reusable SponsorService Unit Methods
  // --------------------------------------------------------------------------
  describe('9. Reusable SponsorService', () => {
    it('should validate positions via isPositionAvailable helper', async () => {
      vi.spyOn(SponsorRepository, 'findByIdentifier').mockResolvedValue({
        id: mockUuid,
        distributorId: 'KV-1001',
        distributorCode: 'KV-1001',
        firstName: 'Rahul',
        lastName: 'Kaushal',
        displayName: 'Rahul Kaushal',
        status: 'ACTIVE',
        mlmNodes: [
          {
            id: 'node-rahul-1',
            children: [{ placementPosition: 'LEFT' as const }],
          },
        ],
      });

      const isLeftAvailable = await SponsorService.isPositionAvailable('KV-1001', 'LEFT');
      const isRightAvailable = await SponsorService.isPositionAvailable('KV-1001', 'RIGHT');

      expect(isLeftAvailable).toBe(false);
      expect(isRightAvailable).toBe(true);
    });

    it('should retrieve available positions via getAvailablePositions helper', async () => {
      vi.spyOn(SponsorRepository, 'findByIdentifier').mockResolvedValue({
        id: mockUuid,
        distributorId: 'KV-1005',
        distributorCode: 'KV-1005',
        firstName: 'Diana',
        lastName: 'Prince',
        displayName: 'Diana Prince',
        status: 'ACTIVE',
        mlmNodes: [{ id: 'node-diana-1', children: [] }],
      });

      const positions = await SponsorService.getAvailablePositions('KV-1005');
      expect(positions).toEqual(['LEFT', 'RIGHT']);
    });
  });

  // --------------------------------------------------------------------------
  // TEST 10: SponsorRepository Layer
  // --------------------------------------------------------------------------
  describe('10. SponsorRepository Data Layer', () => {
    it('should call prisma.distributorProfile.findFirst with case-insensitive search', async () => {
      const spy = vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(null);

      await SponsorRepository.findByIdentifier('kv-1001');

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { distributorId: { equals: 'kv-1001', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });
  });
});
