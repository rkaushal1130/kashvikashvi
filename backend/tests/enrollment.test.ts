/**
 * Test Suite: Enrollment Pipeline Automated Tests
 * Uses Vitest & Supertest
 *
 * Covers:
 * - Step validation (Steps 1 to 5)
 * - Duplicate email rejection
 * - Invalid sponsor rejection
 * - Invalid placement rejection
 * - Sensitive banking & PIN masking
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import {
  completeEnrollmentSchema,
  createEnrollmentSchema,
  step1PersonalInfoSchema,
  step2AddressSchema,
  step3TreePlacementSchema,
  step4StarterKitSchema,
  step5BankSecuritySchema,
} from '../src/validators/enrollment.validators';
import { EnrollmentService } from '../src/services/enrollment.service';
import { prisma } from '../src/config/database';
import { maskAccountNumber, maskEmail, maskIfsc, sanitizeEnrollmentResponse } from '../src/utils/masking';
import { AppError } from '../src/utils/appError';

vi.mock('../src/utils/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('$argon2id$mock_hash_for_testing'),
  verifyPassword: vi.fn().mockResolvedValue(true),
}));

describe('ENROLLMENT MODULE AUTOMATED TESTS (Supertest + Vitest)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Step Validation (Schemas & Boundaries)', () => {
    describe('Step 1: Personal Info & Age Requirements', () => {
      it('should accept valid applicant aged 18 or above', () => {
        const valid = step1PersonalInfoSchema.safeParse({
          legalName: 'Alexander Hamilton',
          email: 'alexander@example.com',
          mobile: '+1 (555) 234-5678',
          dateOfBirth: '1990-01-11',
        });
        expect(valid.success).toBe(true);
      });

      it('should reject applicant under 18 years old', () => {
        const today = new Date();
        const underageDob = `${today.getFullYear() - 16}-01-01`;

        const parsed = step1PersonalInfoSchema.safeParse({
          legalName: 'Minor Prospect',
          email: 'minor@example.com',
          mobile: '5551234567',
          dateOfBirth: underageDob,
        });

        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error.errors[0].message).toContain('at least 18 years old');
        }
      });

      it('should reject invalid email formatting', () => {
        const parsed = step1PersonalInfoSchema.safeParse({
          legalName: 'John Doe',
          email: 'not-a-valid-email',
          mobile: '5551234567',
          dateOfBirth: '1990-05-15',
        });
        expect(parsed.success).toBe(false);
      });
    });

    describe('Step 2: Address & Geography', () => {
      it('should accept valid complete physical address', () => {
        const valid = step2AddressSchema.safeParse({
          address: '742 Evergreen Terrace',
          city: 'Springfield',
          state: 'OR',
          country: 'USA',
          postalCode: '97477',
        });
        expect(valid.success).toBe(true);
      });

      it('should reject empty or missing address fields', () => {
        const parsed = step2AddressSchema.safeParse({
          address: '',
          city: 'Springfield',
          state: 'OR',
          country: 'USA',
          postalCode: '',
        });
        expect(parsed.success).toBe(false);
      });
    });

    describe('Step 3: Tree Placement & Position Boundaries', () => {
      it('should accept valid LEFT or RIGHT placement position', () => {
        const leftPlacement = step3TreePlacementSchema.safeParse({
          sponsor: 'DST-10001',
          placementParent: 'DST-10002',
          placementPosition: 'LEFT',
        });
        expect(leftPlacement.success).toBe(true);

        const rightPlacement = step3TreePlacementSchema.safeParse({
          sponsor: 'DST-10001',
          placementParent: 'DST-10002',
          placementPosition: 'RIGHT',
        });
        expect(rightPlacement.success).toBe(true);
      });

      it('should reject invalid placement positions (e.g. MIDDLE, CENTER)', () => {
        const invalidPos = step3TreePlacementSchema.safeParse({
          sponsor: 'DST-10001',
          placementParent: 'DST-10002',
          placementPosition: 'MIDDLE' as any,
        });
        expect(invalidPos.success).toBe(false);
      });
    });

    describe('Step 4: Starter Kit Pricing & Volume', () => {
      it('should accept valid starter kit package with positive price and BV', () => {
        const valid = step4StarterKitSchema.safeParse({
          productPackage: 'Executive Business Pack',
          price: 299.99,
          bv: 250,
        });
        expect(valid.success).toBe(true);
      });

      it('should reject starter kit with negative or zero price', () => {
        const negativePrice = step4StarterKitSchema.safeParse({
          productPackage: 'Invalid Free Pack',
          price: -50,
          bv: 100,
        });
        expect(negativePrice.success).toBe(false);

        const zeroPrice = step4StarterKitSchema.safeParse({
          productPackage: 'Zero Price Pack',
          price: 0,
          bv: 100,
        });
        expect(zeroPrice.success).toBe(false);
      });
    });

    describe('Step 5: Bank Details & Security PIN', () => {
      it('should accept valid bank account and 4-digit numeric PIN', () => {
        const valid = step5BankSecuritySchema.safeParse({
          accountHolder: 'Alexander Hamilton',
          bankName: 'JPMorgan Chase',
          accountNumber: '987654321098',
          ifsc: 'CHASUS33',
          securityPin: '4829',
        });
        expect(valid.success).toBe(true);
      });

      it('should reject non-numeric or malformed security PIN', () => {
        const nonNumericPin = step5BankSecuritySchema.safeParse({
          accountHolder: 'Alexander Hamilton',
          bankName: 'JPMorgan Chase',
          accountNumber: '987654321098',
          ifsc: 'CHASUS33',
          securityPin: 'abcd',
        });
        expect(nonNumericPin.success).toBe(false);

        const shortPin = step5BankSecuritySchema.safeParse({
          accountHolder: 'Alexander Hamilton',
          bankName: 'JPMorgan Chase',
          accountNumber: '987654321098',
          ifsc: 'CHASUS33',
          securityPin: '12',
        });
        expect(shortPin.success).toBe(false);
      });
    });
  });

  describe('2. Duplicate Email & User Rejection', () => {
    it('should reject enrollment when prospect email already exists in system', async () => {
      vi.spyOn(EnrollmentService, 'createEnrollment').mockRejectedValue(
        AppError.conflict(
          'An account with this email address already exists. Please login instead.',
          'ENROLLMENT_USER_ALREADY_EXISTS'
        )
      );

      const res = await request(app)
        .post('/api/v1/enrollments')
        .send({
          sponsorId: 'DST-10001',
          prospectEmail: 'existing.user@kashvimlm.com',
          enrollmentType: 'DISTRIBUTOR',
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('3. Invalid Sponsor Rejection', () => {
    it('should reject enrollment when sponsor code does not exist', async () => {
      vi.spyOn(EnrollmentService, 'createEnrollment').mockRejectedValue(
        AppError.notFound(
          "Sponsor 'INVALID-SPONSOR-999' not found. Please verify the sponsor ID or distributor code.",
          'ENROLLMENT_SPONSOR_NOT_FOUND'
        )
      );

      const res = await request(app)
        .post('/api/v1/enrollments')
        .send({
          sponsorId: 'INVALID-SPONSOR-999',
          prospectEmail: 'newprospect@example.com',
          enrollmentType: 'DISTRIBUTOR',
        })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });

    it('should reject enrollment when sponsor is inactive', async () => {
      vi.spyOn(EnrollmentService, 'createEnrollment').mockRejectedValue(
        AppError.badRequest(
          'The specified sponsor account is not currently active.',
          'ENROLLMENT_SPONSOR_INACTIVE'
        )
      );

      const res = await request(app)
        .post('/api/v1/enrollments')
        .send({
          sponsorId: 'DST-INACTIVE-01',
          prospectEmail: 'newprospect@example.com',
          enrollmentType: 'DISTRIBUTOR',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not currently active');
    });
  });

  describe('4. Invalid Placement Rejection', () => {
    it('should reject Step 3 when placement parent is not found', async () => {
      const enrollmentId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';

      vi.spyOn(EnrollmentService, 'saveStep3').mockRejectedValue(
        AppError.notFound(
          'Invalid parent: The specified placement parent node does not exist in the binary tree.',
          'ENROLLMENT_INVALID_PLACEMENT_PARENT'
        )
      );

      const res = await request(app)
        .post(`/api/v1/enrollments/${enrollmentId}/step/3`)
        .send({
          sponsor: 'DST-10001',
          placementParent: 'NONEXISTENT-PARENT',
          placementPosition: 'LEFT',
        })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('does not exist');
    });

    it('should reject Step 3 when target position is already occupied', async () => {
      const enrollmentId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';

      vi.spyOn(EnrollmentService, 'saveStep3').mockRejectedValue(
        AppError.conflict(
          'The LEFT position under placement parent (ID: DST-10002) is already occupied.'
        )
      );

      const res = await request(app)
        .post(`/api/v1/enrollments/${enrollmentId}/step/3`)
        .send({
          sponsor: 'DST-10001',
          placementParent: 'DST-10002',
          placementPosition: 'LEFT',
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already occupied');
    });
  });

  describe('5. Data Sanitization & Financial Masking', () => {
    it('should mask bank account numbers showing only the last 4 digits', () => {
      const masked = maskAccountNumber('987654321098');
      expect(masked.endsWith('1098')).toBe(true);
      expect(masked.includes('****')).toBe(true);
      expect(masked).not.toBe('987654321098');
    });

    it('should strip raw security PIN and hash from enrollment response payload', () => {
      const rawEnrollment = {
        id: 'mock-enr-123',
        enrollmentNumber: 'ENR-123456',
        securityPinHash: '$argon2id$v=19$m=65536,t=3,p=1$secret_hash',
        steps: [
          {
            stepNumber: 5,
            stepName: 'Bank & Security',
            stepData: {
              accountHolder: 'Alexander Hamilton',
              accountNumber: '987654321098',
              ifsc: 'CHASUS33',
              securityPin: '4829',
              securityPinHash: 'secret_hash',
            },
          },
        ],
      };

      const sanitized = sanitizeEnrollmentResponse(rawEnrollment);
      expect((sanitized as any).securityPinHash).toBeUndefined();
      expect(sanitized.steps[0].stepData.securityPin).toBeUndefined();
      expect(sanitized.steps[0].stepData.securityPinHash).toBeUndefined();
      expect(sanitized.steps[0].stepData.accountNumber).toBe('********1098');
      expect(sanitized.steps[0].stepData.pinConfigured).toBe(true);
    });
  });

  describe('6. Direct Complete Enrollment & Binary Tree Integration (Prompt 5)', () => {
    const validPayload = {
      fullName: 'Vikram Sharma',
      email: 'vikram.sharma@example.com',
      phone: '+91 98201 54321',
      dob: '1992-06-15',
      address: 'Flat 402, Greenfield Heights, Andheri West',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400053',
      country: 'India',
      sponsorId: 'KV-1008',
      placementParentId: 'KV-1008',
      placementPosition: 'LEFT',
      enrollmentType: 'DISTRIBUTOR',
      starterKitId: 'kit_pro',
      productPackage: 'Professional Pack',
      price: 249.99,
      bv: 100,
      bankName: 'HDFC Bank',
      accountNumber: '50100234981122',
      ifscCode: 'HDFC0000123',
      password: 'SecurePass2026!',
    };

    it('should validate completeEnrollmentSchema correctly', () => {
      const parsed = completeEnrollmentSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
    });

    it('should reject when sponsorId is missing', () => {
      const parsed = completeEnrollmentSchema.safeParse({
        ...validPayload,
        sponsorId: '',
      });
      expect(parsed.success).toBe(false);
    });

    it('should reject invalid placement position', () => {
      const parsed = completeEnrollmentSchema.safeParse({
        ...validPayload,
        placementPosition: 'CENTER' as any,
      });
      expect(parsed.success).toBe(false);
    });

    it('should successfully complete enrollment via POST /api/v1/enrollments/complete', async () => {
      const mockResult = {
        user: { id: 'usr-123', email: validPayload.email, roleName: 'DISTRIBUTOR', status: 'ACTIVE' },
        distributor: { id: 'dst-123', distributorId: 'KV-1009', distributorCode: 'KV-1009', displayName: validPayload.fullName, status: 'ACTIVE' },
        sponsor: { id: 'spon-123', distributorId: 'KV-1008', distributorCode: 'KV-1008', displayName: 'Vikram Malhotra' },
        placement: { placementParentId: 'node-123', placementParentDistributorId: 'KV-1008', position: 'LEFT', depth: 2, binaryPath: 'ROOT/L', nodeId: 'node-new-123' },
        businessCenter: { id: 'bc-123', centerCode: 'KV-1009-BC1', centerNumber: 1 },
      };

      vi.spyOn(EnrollmentService, 'completeDirectEnrollment').mockResolvedValue(mockResult as any);

      const res = await request(app)
        .post('/api/v1/enrollments/complete')
        .send(validPayload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.distributor.distributorId).toBe('KV-1009');
      expect(res.body.data.placement.position).toBe('LEFT');
    });

    it('should return 409 conflict when placement position is already occupied', async () => {
      vi.spyOn(EnrollmentService, 'completeDirectEnrollment').mockRejectedValue(
        new AppError('The LEFT position under placement parent (KV-1001) is already occupied.', 409, 'POSITION_ALREADY_OCCUPIED')
      );

      const res = await request(app)
        .post('/api/v1/enrollments/complete')
        .send(validPayload)
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('POSITION_ALREADY_OCCUPIED');
    });

    it('should return 404 when sponsor does not exist', async () => {
      vi.spyOn(EnrollmentService, 'completeDirectEnrollment').mockRejectedValue(
        new AppError('Sponsor not found', 404, 'SPONSOR_NOT_FOUND')
      );

      const res = await request(app)
        .post('/api/v1/enrollments/complete')
        .send({ ...validPayload, sponsorId: 'KV-NONEXISTENT' })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('SPONSOR_NOT_FOUND');
    });

    it('should return 400 when sponsor is inactive', async () => {
      vi.spyOn(EnrollmentService, 'completeDirectEnrollment').mockRejectedValue(
        new AppError('The specified sponsor account is not active.', 400, 'SPONSOR_INACTIVE')
      );

      const res = await request(app)
        .post('/api/v1/enrollments/complete')
        .send(validPayload)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('SPONSOR_INACTIVE');
    });
  });

  describe('7. 12-Step Database Transaction & Tree Placement Integrity (Prompt 5)', () => {
    const inputPayload = {
      fullName: 'Sunil Gavaskar',
      email: 'sunil.gavaskar@example.com',
      phone: '+91 98200 11223',
      dob: '1985-07-10',
      address: '12 Marine Drive',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400020',
      country: 'India',
      sponsorId: 'KV-1001',
      placementParentId: 'KV-1001',
      placementPosition: 'LEFT' as const,
      enrollmentType: 'DISTRIBUTOR' as const,
      price: 249.99,
      bv: 100,
      bankName: 'State Bank of India',
      accountNumber: '112233445566',
      ifscCode: 'SBIN0000123',
      password: 'SecurePassword123!',
    };

    let mockTx: any;

    beforeEach(() => {
      mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'usr-new-1', email: inputPayload.email, roleName: 'DISTRIBUTOR', status: 'ACTIVE' }),
        },
        distributorProfile: {
          findFirst: vi.fn().mockImplementation(async (query: any) => {
            const hasSponsor = query?.where?.OR?.some(
              (o: any) =>
                o.id === 'KV-1001' ||
                o.distributorId?.equals === 'KV-1001' ||
                o.distributorCode?.equals === 'KV-1001'
            );
            if (hasSponsor) {
              return {
                id: 'sponsor-profile-1',
                distributorId: 'KV-1001',
                distributorCode: 'KV-1001',
                firstName: 'Rahul',
                lastName: 'Kaushal',
                displayName: 'Rahul Kaushal',
                status: 'ACTIVE',
                user: { email: 'rahul.kaushal@kashvimlm.com' },
              };
            }
            return null;
          }),
          count: vi.fn().mockResolvedValue(5),
          create: vi.fn().mockResolvedValue({
            id: 'dist-new-1',
            distributorId: 'KV-1009',
            distributorCode: 'KV-1009',
            displayName: 'Sunil Gavaskar',
            status: 'ACTIVE',
            sponsorId: 'sponsor-profile-1',
          }),
        },
        mLMNode: {
          findFirst: vi.fn().mockResolvedValueOnce({
            id: 'node-parent-1',
            distributorId: 'sponsor-profile-1',
            depth: 0,
            binaryPath: 'ROOT',
            distributor: { id: 'sponsor-profile-1', distributorId: 'KV-1001', distributorCode: 'KV-1001', status: 'ACTIVE' },
          }).mockResolvedValueOnce(null),
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: 'node-new-1',
            distributorId: 'dist-new-1',
            placementParentId: 'node-parent-1',
            placementPosition: 'LEFT',
            depth: 1,
            binaryPath: 'ROOT/L',
            businessCenter: { id: 'bc-new-1', centerCode: 'KV-1009-BC1', centerNumber: 1, status: 'ACTIVE' },
          }),
        },
        sponsorRelationship: {
          create: vi.fn().mockResolvedValue({ id: 'rel-1' }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        businessCenter: {
          create: vi.fn().mockResolvedValue({ id: 'bc-new-1', centerCode: 'KV-1009-BC1', centerNumber: 1 }),
        },
        address: {
          create: vi.fn().mockResolvedValue({ id: 'addr-1' }),
        },
        bankAccount: {
          create: vi.fn().mockResolvedValue({ id: 'bank-1' }),
        },
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });
    });

    it('Step 1 validation: should throw and abort transaction if applicant email is already registered', async () => {
      mockTx.user.findUnique.mockResolvedValueOnce({ id: 'existing-usr', email: inputPayload.email });

      await expect(EnrollmentService.completeDirectEnrollment(inputPayload)).rejects.toThrow(
        'An account with this email address already exists. Please login instead.'
      );

      // Verify distributor and tree node were never created
      expect(mockTx.distributorProfile.create).not.toHaveBeenCalled();
      expect(mockTx.mLMNode.create).not.toHaveBeenCalled();
    });

    it('Step 2 validation: should throw and abort transaction if sponsor does not exist', async () => {
      mockTx.distributorProfile.findFirst.mockResolvedValueOnce(null);

      await expect(
        EnrollmentService.completeDirectEnrollment({ ...inputPayload, sponsorId: 'KV-NONEXISTENT' })
      ).rejects.toThrow('Sponsor');

      expect(mockTx.user.create).not.toHaveBeenCalled();
      expect(mockTx.distributorProfile.create).not.toHaveBeenCalled();
    });

    it('Step 3 validation: should throw and abort transaction if sponsor is inactive', async () => {
      mockTx.distributorProfile.findFirst.mockResolvedValueOnce({
        id: 'inactive-spon',
        distributorId: 'KV-1001',
        distributorCode: 'KV-1001',
        status: 'SUSPENDED',
        user: { email: 'sponsor@example.com' },
      });

      await expect(EnrollmentService.completeDirectEnrollment(inputPayload)).rejects.toThrow(
        'The specified sponsor account is not active.'
      );

      expect(mockTx.user.create).not.toHaveBeenCalled();
      expect(mockTx.distributorProfile.create).not.toHaveBeenCalled();
    });

    it('Step 3b self-sponsorship: should throw and abort transaction if applicant email equals sponsor email', async () => {
      mockTx.distributorProfile.findFirst.mockResolvedValueOnce({
        id: 'spon-id',
        status: 'ACTIVE',
        user: { email: inputPayload.email },
      });

      await expect(EnrollmentService.completeDirectEnrollment(inputPayload)).rejects.toThrow(
        'Self-sponsorship forbidden'
      );

      expect(mockTx.user.create).not.toHaveBeenCalled();
      expect(mockTx.distributorProfile.create).not.toHaveBeenCalled();
    });

    it('Step 4 validation: should throw and abort transaction if placement parent does not exist', async () => {
      mockTx.distributorProfile.findFirst
        .mockResolvedValueOnce({ id: 'sponsor-1', status: 'ACTIVE', user: { email: 'spon@example.com' } })
        .mockResolvedValueOnce(null);
      mockTx.mLMNode.findUnique.mockResolvedValueOnce(null);

      await expect(
        EnrollmentService.completeDirectEnrollment({ ...inputPayload, placementParentId: 'KV-UNKNOWN' })
      ).rejects.toThrow('Placement parent');

      expect(mockTx.distributorProfile.create).not.toHaveBeenCalled();
    });

    it('Step 4b validation: should throw and abort transaction if placement parent is inactive', async () => {
      mockTx.distributorProfile.findFirst
        .mockResolvedValueOnce({ id: 'sponsor-1', status: 'ACTIVE', user: { email: 'spon@example.com' } })
        .mockResolvedValueOnce({ id: 'parent-1', status: 'INACTIVE', user: { email: 'parent@example.com' } });
      mockTx.mLMNode.findFirst.mockResolvedValueOnce({
        id: 'node-parent-1',
        distributorId: 'parent-1',
        distributor: { status: 'INACTIVE' },
      });

      await expect(EnrollmentService.completeDirectEnrollment(inputPayload)).rejects.toThrow(
        'Placement parent is not active.'
      );

      expect(mockTx.distributorProfile.create).not.toHaveBeenCalled();
    });

    it('Step 5 validation: should reject invalid placement positions', async () => {
      await expect(
        EnrollmentService.completeDirectEnrollment({ ...inputPayload, placementPosition: 'CENTER' as any })
      ).rejects.toThrow('Invalid placement position');

      expect(mockTx.user.create).not.toHaveBeenCalled();
    });

    it('Step 6 re-check availability: should throw and abort transaction if position is already occupied', async () => {
      mockTx.mLMNode.findFirst
        .mockReset()
        .mockResolvedValueOnce({
          id: 'node-parent-1',
          distributorId: 'sponsor-profile-1',
          depth: 0,
          binaryPath: 'ROOT',
          distributor: { id: 'sponsor-profile-1', distributorId: 'KV-1001', status: 'ACTIVE' },
        })
        .mockResolvedValueOnce({
          id: 'existing-left-child',
          placementParentId: 'node-parent-1',
          placementPosition: 'LEFT',
        });

      await expect(EnrollmentService.completeDirectEnrollment(inputPayload)).rejects.toThrow(
        'is already occupied'
      );

      expect(mockTx.$queryRaw).toHaveBeenCalled();
      expect(mockTx.distributorProfile.create).not.toHaveBeenCalled();
    });

    it('Steps 1-12 complete flow: should atomically create user, distributor, lineage, and MLM tree relationship', async () => {
      const result = await EnrollmentService.completeDirectEnrollment(inputPayload);

      expect(result).toBeDefined();
      expect(result.user.email).toBe(inputPayload.email);
      expect(result.distributor.status).toBe('ACTIVE');
      expect(result.placement.position).toBe('LEFT');
      expect(result.placement.depth).toBe(1);
      expect(result.placement.binaryPath).toBe('ROOT/L');

      // Verify all operations occurred within the atomic transaction
      expect(mockTx.user.create).toHaveBeenCalled();
      expect(mockTx.distributorProfile.create).toHaveBeenCalled();
      expect(mockTx.sponsorRelationship.create).toHaveBeenCalled();
      expect(mockTx.mLMNode.create).toHaveBeenCalled();
    });

    it('Rollback on placement failure: if MLMNode creation fails, transaction throws and nothing is committed', async () => {
      mockTx.mLMNode.create.mockRejectedValueOnce(new Error('Database unique constraint violation'));

      await expect(EnrollmentService.completeDirectEnrollment(inputPayload)).rejects.toThrow(
        'Database unique constraint violation'
      );
    });
  });
});

