import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { AuthService } from '../src/services/auth.service';

describe('LOGIN API ENDPOINT TESTS (Prompt 35)', () => {
  const timestamp = Date.now();
  const validEmail = `active.distributor.${timestamp}@kashvimlm.test`;
  const validPassword = 'SecurePassword@2026';
  let registeredUserId: string;
  let registeredReferralCode: string;

  beforeAll(async () => {
    await (AuthService as any).initSeedUsers?.();

    // Register active user for login tests
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Devendra Singhania',
        email: validEmail,
        phone: `+91991${String(timestamp).slice(-7)}`,
        password: validPassword,
        confirmPassword: validPassword,
        referralCode: 'KV-1001',
      })
      .expect(201);

    registeredUserId = regRes.body.user.userId || regRes.body.user.id;
    registeredReferralCode = regRes.body.user.referralCode;
  });

  describe('1. Valid Login Authentication Flow', () => {
    it('should authenticate user with valid email & password and return safe user info + session tokens', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: validEmail,
          password: validPassword,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Login successful');

      // Top-level safe user
      const user = res.body.user;
      expect(user).toBeDefined();
      expect(user.email).toBe(validEmail.toLowerCase());
      expect(user.fullName).toBe('Devendra Singhania');
      expect(user.role).toBe('DISTRIBUTOR');
      expect(user.status).toBe('ACTIVE');
      expect(user.referralCode).toBe(registeredReferralCode);
      expect(user.lastLoginAt).toBeDefined();

      // Session tokens
      expect(res.body.tokens).toBeDefined();
      expect(res.body.tokens.accessToken).toBeDefined();
      expect(res.body.tokens.refreshToken).toBeDefined();
      expect(res.body.tokens.expiresIn).toBe(900);

      // Invariant: passwordHash, secrets, and reset tokens must NEVER be returned
      expect((res.body as any).passwordHash).toBeUndefined();
      expect((user as any).passwordHash).toBeUndefined();
      expect((user as any).secret).toBeUndefined();
      expect((user as any).resetToken).toBeUndefined();
      expect((user as any).verificationToken).toBeUndefined();
    });

    it('should support both /api/auth/login and /api/v1/auth/login endpoints', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: validEmail,
          password: validPassword,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe(validEmail.toLowerCase());
      expect(res.body.tokens.accessToken).toBeDefined();
    });

    it('should support logging in with assigned referral code / distributor ID', async () => {
      expect(registeredReferralCode).toBeDefined();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: registeredReferralCode,
          password: validPassword,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe(validEmail.toLowerCase());
    });
  });

  describe('2. Email Normalization & Case Insensitivity', () => {
    it('should normalize uppercase email and trim whitespace', async () => {
      const spacedUppercaseEmail = `   ${validEmail.toUpperCase()}   `;

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: spacedUppercaseEmail,
          password: validPassword,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe(validEmail.toLowerCase());
    });
  });

  describe('3. Generic Error Protection against User Enumeration', () => {
    it('should return identical "Invalid email or password." when password is incorrect', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: validEmail,
          password: 'WrongPassword@999',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password.');
      expect(res.body.tokens).toBeUndefined();
      expect(res.body.user).toBeUndefined();
    });

    it('should return identical "Invalid email or password." when email does not exist', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: `nonexistent.${Date.now()}@kashvimlm.test`,
          password: 'AnyPassword@2026',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password.');
      expect(res.body.tokens).toBeUndefined();
      expect(res.body.user).toBeUndefined();
    });
  });

  describe('4. Blocked and Suspended User Account Protection', () => {
    it('should reject login when account status is BLOCKED', async () => {
      const blockedEmail = `blocked.${Date.now()}@kashvimlm.test`;
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Blocked User',
          email: blockedEmail,
          password: validPassword,
          confirmPassword: validPassword,
          referralCode: 'KV-1001',
        })
        .expect(201);

      // Set user status to BLOCKED in store
      const inMem = AuthService.getInMemoryUser(regRes.body.user.referralCode);
      if (inMem) {
        inMem.status = 'BLOCKED';
      }

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: blockedEmail,
          password: validPassword,
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/blocked/i);
    });

    it('should reject login when account status is SUSPENDED', async () => {
      const suspendedEmail = `suspended.${Date.now()}@kashvimlm.test`;
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Suspended User',
          email: suspendedEmail,
          password: validPassword,
          confirmPassword: validPassword,
          referralCode: 'KV-1001',
        })
        .expect(201);

      // Set user status to SUSPENDED in store
      const inMem = AuthService.getInMemoryUser(regRes.body.user.referralCode);
      if (inMem) {
        inMem.status = 'SUSPENDED';
      }

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: suspendedEmail,
          password: validPassword,
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/suspended/i);
    });

    it('should reject login when account status is INACTIVE', async () => {
      const inactiveEmail = `inactive.${Date.now()}@kashvimlm.test`;
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Inactive User',
          email: inactiveEmail,
          password: validPassword,
          confirmPassword: validPassword,
          referralCode: 'KV-1001',
        })
        .expect(201);

      // Set user status to INACTIVE in store
      const inMem = AuthService.getInMemoryUser(regRes.body.user.referralCode);
      if (inMem) {
        inMem.status = 'INACTIVE';
      }

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: inactiveEmail,
          password: validPassword,
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/inactive/i);
    });
  });

  describe('5. Input Validation Requirements', () => {
    it('should reject login when password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: validEmail,
        })
        .expect(422);

      expect(res.body.success).toBe(false);
    });

    it('should reject login when email/identifier is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          password: validPassword,
        })
        .expect(422);

      expect(res.body.success).toBe(false);
    });
  });
});
