import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { AuthService } from '../src/services/auth.service';

describe('MLM SPONSOR & REFERRAL REGISTRATION INTEGRATION (Prompt 34)', () => {
  const password = 'StrongPassword@2026';
  let userAReferralCode: string;
  let userAEmail: string;
  let userAPhone: string;
  let userBReferralCode: string;
  let userBEmail: string;

  beforeAll(async () => {
    // Ensure in-memory seed or database connection is initialized
    await (AuthService as any).initSeedUsers?.();
  });

  describe('1. Core Referral Flow: User A registers -> User B registers with A\'s code', () => {
    it('Step 1: User A registers and receives a unique referral code', async () => {
      const ts = Date.now();
      userAEmail = `user.a.${ts}@kashvimlm.test`;
      userAPhone = `+91981${String(ts).slice(-7)}`;

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Alice Johnson',
          email: userAEmail,
          phone: userAPhone,
          password,
          confirmPassword: password,
          referralCode: 'KV-1001',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.referralCode).toBeDefined();
      expect(res.body.user.referralCode).toMatch(/^DST-\d+/);
      expect(res.body.user.fullName).toBe('Alice Johnson');

      userAReferralCode = res.body.user.referralCode;

      // Invariant: User A's sponsor is the default system sponsor
      expect(res.body.user.sponsorId).toBe('KV-1001');
    });

    it('Step 2: User B registers using User A\'s referral code and User A becomes User B\'s sponsor', async () => {
      expect(userAReferralCode).toBeDefined();
      const ts = Date.now() + 100;
      userBEmail = `user.b.${ts}@kashvimlm.test`;
      const userBPhone = `+91982${String(ts).slice(-7)}`;

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Bob Smith',
          email: userBEmail,
          phone: userBPhone,
          password,
          confirmPassword: password,
          referralCode: userAReferralCode,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.fullName).toBe('Bob Smith');
      expect(res.body.user.referralCode).toBeDefined();
      expect(res.body.user.referralCode).not.toBe(userAReferralCode);

      userBReferralCode = res.body.user.referralCode;

      // Key Invariant: User A is officially registered as User B's sponsor
      expect(res.body.user.sponsorId).toBe(userAReferralCode);
      if (res.body.user.sponsor) {
        expect(res.body.user.sponsor.distributorCode).toBe(userAReferralCode);
        expect(res.body.user.sponsor.name).toContain('Alice Johnson');
      }

      // Verify downline link in in-memory or database record
      const sponsorInMem = AuthService.getInMemoryUser(userAReferralCode);
      if (sponsorInMem?.distributorProfile?.sponsoredDistributors) {
        const found = sponsorInMem.distributorProfile.sponsoredDistributors.some(
          (d: any) => d.distributorCode === userBReferralCode || d.displayName === 'Bob Smith'
        );
        expect(found).toBe(true);
      }
    });

    it('Step 3: User C registers using User B\'s code, establishing a 3-tier lineage (A -> B -> C)', async () => {
      expect(userBReferralCode).toBeDefined();
      const ts = Date.now() + 200;
      const userCEmail = `user.c.${ts}@kashvimlm.test`;
      const userCPhone = `+91983${String(ts).slice(-7)}`;

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Charlie Davis',
          email: userCEmail,
          phone: userCPhone,
          password,
          confirmPassword: password,
          referralCode: userBReferralCode,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.user.sponsorId).toBe(userBReferralCode);
      if (res.body.user.sponsor) {
        expect(res.body.user.sponsor.distributorCode).toBe(userBReferralCode);
        expect(res.body.user.sponsor.name).toContain('Bob Smith');
      }

      // Verify ancestor relationships contain both B (depth 1) and A (depth 2)
      const userCInMem = AuthService.getInMemoryUser(res.body.user.referralCode);
      if (userCInMem?.distributorProfile?.ancestorRelationships) {
        const ancestors = userCInMem.distributorProfile.ancestorRelationships;
        const directSponsor = ancestors.find((a: any) => a.ancestorCode === userBReferralCode);
        expect(directSponsor).toBeDefined();
        expect(directSponsor.depth).toBe(1);
        expect(directSponsor.isDirect).toBe(true);

        const grandSponsor = ancestors.find((a: any) => a.ancestorCode === userAReferralCode);
        expect(grandSponsor).toBeDefined();
        expect(grandSponsor.depth).toBe(2);
        expect(grandSponsor.isDirect).toBe(false);
      }
    });
  });

  describe('2. Validation & Security Checks: Invalid, Self, and Inactive Sponsors', () => {
    it('should reject registration when referral code does not exist (404 Not Found)', async () => {
      const ts = Date.now() + 300;
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Orphan Registrant',
          email: `orphan.${ts}@kashvimlm.test`,
          password,
          confirmPassword: password,
          referralCode: 'INVALID-DST-CODE-88888',
        })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid referral code');
    });

    it('should reject self-sponsorship attempt when referral code matches user\'s own email (400 Bad Request)', async () => {
      const selfEmail = `self.sponsor.${Date.now()}@kashvimlm.test`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Self Sponsor',
          email: selfEmail,
          password,
          confirmPassword: password,
          referralCode: selfEmail, // Attempt to be own sponsor
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot be their own sponsor/i);
    });

    it('should reject self-sponsorship attempt when referral code matches user\'s own phone (400 Bad Request)', async () => {
      const selfPhone = `+91989${String(Date.now()).slice(-7)}`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Self Phone Sponsor',
          email: `selfphone.${Date.now()}@kashvimlm.test`,
          phone: selfPhone,
          password,
          confirmPassword: password,
          referralCode: selfPhone, // Attempt to be own sponsor via phone
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot be their own sponsor/i);
    });

    it('should reject registration when the sponsor is INACTIVE or SUSPENDED (400 Bad Request)', async () => {
      // 1. Register a new user who will be set to INACTIVE
      const ts = Date.now() + 400;
      const inactiveEmail = `inactive.distributor.${ts}@kashvimlm.test`;
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Suspended Leader',
          email: inactiveEmail,
          password,
          confirmPassword: password,
          referralCode: 'KV-1001',
        })
        .expect(201);

      const inactiveCode = regRes.body.user.referralCode;

      // 2. Set this user to INACTIVE status in store
      const inactiveUser = AuthService.getInMemoryUser(inactiveCode);
      if (inactiveUser) {
        inactiveUser.status = 'INACTIVE';
        if (inactiveUser.distributorProfile) {
          inactiveUser.distributorProfile.status = 'INACTIVE';
        }
      }

      // 3. Attempt to register a downline using this inactive sponsor's referral code
      const downlineRes = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Downline Hopeful',
          email: `downline.inactive.${Date.now()}@kashvimlm.test`,
          password,
          confirmPassword: password,
          referralCode: inactiveCode,
        })
        .expect(400);

      expect(downlineRes.body.success).toBe(false);
      expect(downlineRes.body.message).toMatch(/inactive or not eligible/i);
    });
  });

  describe('3. Public Sponsor Verification Endpoint Integration', () => {
    it('GET /api/v1/sponsors/:sponsorId should validate existing active sponsor and return safe data', async () => {
      expect(userAReferralCode).toBeDefined();

      const res = await request(app)
        .get(`/api/v1/sponsors/${userAReferralCode}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.sponsor).toBeDefined();
      expect(res.body.data.sponsor.distributorId).toBe(userAReferralCode);
      expect(res.body.data.sponsor.name).toContain('Alice Johnson');
      expect(res.body.data.sponsor.status).toBe('ACTIVE');

      // Invariant: passwordHash and sensitive financial fields are NEVER exposed
      expect((res.body.data.sponsor as any).passwordHash).toBeUndefined();
      expect((res.body.data.sponsor as any).balance).toBeUndefined();
    });

    it('GET /api/v1/sponsors/:sponsorId should return 404 when sponsor does not exist', async () => {
      const res = await request(app)
        .get('/api/v1/sponsors/NON-EXISTENT-CODE-999')
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/sponsor not found/i);
    });
  });

  describe('4. Zero-Trust Frontend Protection & Immutability', () => {
    it('should ignore any client-manipulated sponsorId and strictly bind to validated referral code', async () => {
      const ts = Date.now() + 500;
      const forgedEmail = `forged.${ts}@kashvimlm.test`;

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Integrity Tester',
          email: forgedEmail,
          password,
          confirmPassword: password,
          referralCode: userAReferralCode,
          // Attacker attempts to bypass referral code and inject arbitrary sponsor ID
          sponsorId: 'FORGED-TARGET-SPONSOR-ID',
          sponsor: { id: 'FORGED-TARGET-SPONSOR-ID' },
        })
        .expect(201);

      // Backend must strictly bind sponsor to userAReferralCode, never the forged field
      expect(res.body.user.sponsorId).toBe(userAReferralCode);
      expect(res.body.user.sponsorId).not.toBe('FORGED-TARGET-SPONSOR-ID');
    });
  });
});
