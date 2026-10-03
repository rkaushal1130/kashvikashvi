import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';

describe('REGISTRATION API ENDPOINT TESTS (Prompt 32)', () => {
  const timestamp = Date.now();
  const validEmail = `distributor.${timestamp}@kashvimlm.test`;
  const validPhone = `+9198${String(timestamp).slice(-8)}`;
  const validPassword = 'SecurePassword@2026';
  let registeredReferralCode: string;
  let registeredUserId: string;

  describe('1. Successful Registration Flow', () => {
    it('should register a new user and return exact required response format', async () => {
      const payload = {
        fullName: 'Vikramaditya Rathore',
        email: validEmail,
        phone: validPhone,
        password: validPassword,
        confirmPassword: validPassword,
        referralCode: 'KV-1001',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(payload)
        .expect(201);

      // Verify required response shape
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Registration successful');
      expect(res.body.user).toBeDefined();

      const user = res.body.user;
      expect(user.userId).toBeDefined();
      expect(typeof user.userId).toBe('string');
      expect(user.userId).toMatch(/^USR-\d+/);
      registeredUserId = user.userId;

      expect(user.fullName).toBe('Vikramaditya Rathore');
      expect(user.email).toBe(validEmail.toLowerCase());

      expect(user.referralCode).toBeDefined();
      expect(user.referralCode).toMatch(/^DST-\d+/);
      registeredReferralCode = user.referralCode;

      // Invariant: passwordHash must NEVER be returned to the client
      expect((res.body as any).passwordHash).toBeUndefined();
      expect((user as any).passwordHash).toBeUndefined();
      expect((res.body.data?.user as any)?.passwordHash).toBeUndefined();
    });

    it('should support both /api/auth/register and /api/v1/auth/register', async () => {
      const uniqueEmail = `v1route.${Date.now()}@kashvimlm.test`;
      const payload = {
        fullName: 'Aanya Sen',
        email: uniqueEmail,
        phone: `+9197${String(Date.now()).slice(-8)}`,
        password: validPassword,
        confirmPassword: validPassword,
        referralCode: 'KV-1001',
      };

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe(uniqueEmail.toLowerCase());
      expect(res.body.user.referralCode).toBeDefined();
    });
  });

  describe('2. Email Normalization & Duplicate Prevention', () => {
    it('should normalize email to lowercase and trim whitespace', async () => {
      const rawEmail = `  Spaced.Capital.${Date.now()}@KashviMLM.Test  `;
      const expectedNormalized = rawEmail.trim().toLowerCase();

      const payload = {
        fullName: 'Rohan Mehra',
        email: rawEmail,
        password: validPassword,
        confirmPassword: validPassword,
        referralCode: 'KV-1001',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(payload)
        .expect(201);

      expect(res.body.user.email).toBe(expectedNormalized);
    });

    it('should reject registration when email already exists (HTTP 409 Conflict)', async () => {
      const duplicatePayload = {
        fullName: 'Duplicate User',
        email: validEmail, // already registered in test 1
        password: validPassword,
        confirmPassword: validPassword,
        referralCode: 'KV-1001',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(duplicatePayload)
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('should reject registration when phone number already exists', async () => {
      const duplicatePhonePayload = {
        fullName: 'Another Person',
        email: `different.${Date.now()}@kashvimlm.test`,
        phone: validPhone, // already used in test 1
        password: validPassword,
        confirmPassword: validPassword,
        referralCode: 'KV-1001',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(duplicatePhonePayload)
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('phone number already exists');
    });
  });

  describe('3. Password and Referral Code Validation', () => {
    it('should reject registration when password and confirmPassword do not match', async () => {
      const mismatchPayload = {
        fullName: 'Mismatch Tester',
        email: `mismatch.${Date.now()}@kashvimlm.test`,
        password: 'ValidPassword@123',
        confirmPassword: 'DifferentPassword@999',
        referralCode: 'KV-1001',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(mismatchPayload);

      // Either Zod 422 or Service 400
      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should reject registration when password is weak or too short', async () => {
      const weakPayload = {
        fullName: 'Weak Password User',
        email: `weak.${Date.now()}@kashvimlm.test`,
        password: '123',
        confirmPassword: '123',
        referralCode: 'KV-1001',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(weakPayload)
        .expect(422);

      expect(res.body.success).toBe(false);
    });

    it('should reject registration when an invalid referral code is provided', async () => {
      const invalidRefPayload = {
        fullName: 'Orphan User',
        email: `orphan.${Date.now()}@kashvimlm.test`,
        password: validPassword,
        confirmPassword: validPassword,
        referralCode: 'INVALID-REFERRAL-CODE-99999',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(invalidRefPayload)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid referral code');
    });

    it('should accept registration using a newly registered member referral code as sponsor', async () => {
      expect(registeredReferralCode).toBeDefined();

      const downlinePayload = {
        fullName: 'Downline Distributor',
        email: `downline.${Date.now()}@kashvimlm.test`,
        password: validPassword,
        confirmPassword: validPassword,
        referralCode: registeredReferralCode, // Use the referral code generated in test 1
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(downlinePayload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.user.referralCode).toBeDefined();
      expect(res.body.user.referralCode).not.toBe(registeredReferralCode);
    });
  });

  describe('4. Zero-Trust Security Invariants', () => {
    it('should NEVER trust client-injected userId, wallet balances, or account status', async () => {
      const maliciousPayload = {
        fullName: 'Hacker Agent',
        email: `hacker.${Date.now()}@kashvimlm.test`,
        password: validPassword,
        confirmPassword: validPassword,
        referralCode: 'KV-1001',
        // Injected fields attempting to bypass backend controls
        userId: 'FORGED-ADMIN-USER-ID-999',
        sponsorId: 'FORGED-SPONSOR-ID',
        status: 'SUPER_ADMIN',
        role: 'SUPER_ADMIN',
        wallet: { balance: 9999999, availableBalance: 9999999 },
        balance: 9999999,
        commission: 500000,
        currentBB: 500000,
        currentMatching: 500000,
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(maliciousPayload);

      // May be blocked by zero-trust protectMlmFields middleware or sanitized by registration controller
      if (res.status === 201) {
        expect(res.body.user.userId).not.toBe('FORGED-ADMIN-USER-ID-999');
        expect(res.body.user.userId).toMatch(/^USR-\d+/);
        expect(res.body.user.role).not.toBe('SUPER_ADMIN');
        expect((res.body.user as any).balance).toBeUndefined();
        expect((res.body.user as any).currentBB).toBeUndefined();
      } else {
        // If rejected by protectMlmFields or validator, status is 400/403/422
        expect([400, 403, 422]).toContain(res.status);
      }
    });
  });
});
