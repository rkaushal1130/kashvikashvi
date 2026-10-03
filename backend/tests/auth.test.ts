/**
 * Test Suite: Authentication & Security Automated Tests
 * Uses Vitest & Supertest
 *
 * Covers:
 * - Registration
 * - Login
 * - Invalid Login
 * - Refresh Token Rotation
 * - Logout
 * - Argon2id Password Hashing & JWT Integrity
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { hashPassword, verifyPassword } from '../src/utils/password';
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../src/utils/jwt';
import { AuthService } from '../src/services/auth.service';
import { AppError } from '../src/utils/appError';
import { createTestToken } from './helpers/testHelpers';

describe('AUTH MODULE AUTOMATED TESTS (Supertest + Vitest)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Registration Flow (/api/v1/auth/register)', () => {
    it('should successfully register a new distributor with valid payload', async () => {
      const mockRegisterResult = {
        user: {
          id: 'usr-new-001',
          email: 'prospect.john@kashvimlm.com',
          role: 'DISTRIBUTOR',
          status: 'ACTIVE',
        },
        tokens: {
          accessToken: 'mock-access-token-xyz',
          refreshToken: 'mock-refresh-token-abc',
        },
        profile: {
          id: 'dst-profile-001',
          distributorCode: 'DST-99901',
          firstName: 'John',
          lastName: 'Doe',
        },
      };

      vi.spyOn(AuthService, 'register').mockResolvedValue(mockRegisterResult as any);

      const payload = {
        email: 'prospect.john@kashvimlm.com',
        password: 'StrongPassword123!',
        role: 'DISTRIBUTOR',
        sponsorId: 'DST-10001',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+15551234567',
      };

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Registration successful');
      expect(res.body.data.user.email).toBe(payload.email);
      expect(res.body.data.tokens.accessToken).toBeDefined();
    });

    it('should reject registration when email is malformed', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          password: 'StrongPassword123!',
          role: 'DISTRIBUTOR',
        })
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should reject registration when password is shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'short.pwd@example.com',
          password: '123',
          role: 'DISTRIBUTOR',
        })
        .expect(422);

      expect(res.body.success).toBe(false);
    });

    it('should return 409 Conflict if email is already registered', async () => {
      vi.spyOn(AuthService, 'register').mockRejectedValue(
        AppError.conflict('An account with this email address already exists.')
      );

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'existing.member@kashvimlm.com',
          password: 'Password@2026',
          firstName: 'Jane',
          lastName: 'Doe',
          role: 'DISTRIBUTOR',
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('2. Login Flow (/api/v1/auth/login)', () => {
    it('should successfully authenticate user with valid credentials', async () => {
      const mockLoginResponse = {
        user: {
          id: 'usr-101',
          email: 'member@kashvimlm.com',
          role: 'DISTRIBUTOR',
          status: 'ACTIVE',
        },
        tokens: {
          accessToken: 'mock-access-token-jwt',
          refreshToken: 'mock-refresh-token-jwt',
          expiresIn: 900,
        },
        profile: {
          id: 'dst-101',
          distributorCode: 'DST-10001',
        },
      };

      vi.spyOn(AuthService, 'login').mockResolvedValue(mockLoginResponse as any);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'member@kashvimlm.com',
          password: 'SuperSecurePassword@2026',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Login successful');
      expect(res.body.data.tokens.accessToken).toBe('mock-access-token-jwt');
      expect(res.body.data.user.role).toBe('DISTRIBUTOR');
    });

    it('should reject login with 401 when password is invalid', async () => {
      vi.spyOn(AuthService, 'login').mockRejectedValue(
        AppError.unauthorized('Invalid email or password', 'AUTH_INVALID_CREDENTIALS')
      );

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'member@kashvimlm.com',
          password: 'IncorrectPassword999!',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('should reject login with 401 when user does not exist', async () => {
      vi.spyOn(AuthService, 'login').mockRejectedValue(
        AppError.unauthorized('Invalid email or password', 'AUTH_INVALID_CREDENTIALS')
      );

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@kashvimlm.com',
          password: 'Password123!',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('should reject login with 422 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'incomplete@kashvimlm.com',
          // missing password
        })
        .expect(422);

      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Refresh Token Flow (/api/v1/auth/refresh)', () => {
    it('should rotate and issue new access & refresh tokens with valid refresh token', async () => {
      const mockRefreshResult = {
        accessToken: 'new-rotated-access-token',
        refreshToken: 'new-rotated-refresh-token',
        expiresIn: 900,
      };

      vi.spyOn(AuthService, 'refreshToken').mockResolvedValue(mockRefreshResult as any);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'valid-stored-refresh-token-uuid',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBe('new-rotated-access-token');
      expect(res.body.data.refreshToken).toBe('new-rotated-refresh-token');
    });

    it('should reject refresh request with 401 when token is expired or invalid', async () => {
      vi.spyOn(AuthService, 'refreshToken').mockRejectedValue(
        AppError.unauthorized('Refresh token is invalid or has expired.', 'AUTH_TOKEN_EXPIRED')
      );

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'expired-or-tampered-token',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('invalid or has expired');
    });

    it('should reject refresh request with 422 when refreshToken is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({})
        .expect(422);

      expect(res.body.success).toBe(false);
    });
  });

  describe('4. Logout Flow (/api/v1/auth/logout)', () => {
    it('should successfully logout and revoke session token', async () => {
      vi.spyOn(AuthService, 'logout').mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .send({
          refreshToken: 'session-refresh-token-to-revoke',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Logged out successfully');
    });
  });

  describe('5. Authenticated Profile & Token Security (/api/v1/auth/me)', () => {
    it('should retrieve authenticated user profile with valid Bearer token', async () => {
      const token = createTestToken({
        id: 'usr-101',
        email: 'member@kashvimlm.com',
        role: 'DISTRIBUTOR',
      });

      vi.spyOn(AuthService, 'getMe').mockResolvedValue({
        id: 'usr-101',
        email: 'member@kashvimlm.com',
        role: 'DISTRIBUTOR',
        status: 'ACTIVE',
      } as any);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('usr-101');
    });

    it('should reject /me request with 401 when Authorization header is missing', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('missing or malformed');
    });
  });

  describe('6. Cryptographic Security Utilities (Argon2id & JWT)', () => {
    it('should hash passwords with Argon2id and verify correctly', async () => {
      const plainPassword = 'SuperSecurePassword@2026';
      const hash = await hashPassword(plainPassword);

      expect(hash).not.toBe(plainPassword);
      expect(hash).toContain('$argon2id$');

      const isMatch = await verifyPassword(plainPassword, hash);
      expect(isMatch).toBe(true);

      const isWrongMatch = await verifyPassword('WrongPassword123!', hash);
      expect(isWrongMatch).toBe(false);
    });

    it('should sign and verify access token with user role and account status', () => {
      const payload = {
        sub: 'test-user-id-1234',
        email: 'member@kashvimlm.internal',
        role: 'DISTRIBUTOR' as const,
        status: 'ACTIVE' as const,
      };

      const token = signAccessToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);

      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('should securely hash tokens using SHA-256 for database storage', () => {
      const rawToken = 'sample_refresh_token_string_123';
      const hash1 = hashToken(rawToken);
      const hash2 = hashToken(rawToken);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
      expect(hash1).not.toBe(rawToken);
    });
  });

  describe('7. End-to-End Registration & Future Login Flow (Email + Password Invariant)', () => {
    const testEmail = `distributor.${Date.now()}@kashvimlm.test`;
    const testPassword = 'MySecretPassword@2026';
    let registeredReferralCode: string;
    let registeredUserId: string;

    it('should register a new distributor with Email + Password, generating User ID, Referral Code, and Sponsor Link', async () => {
      const registerPayload = {
        fullName: 'Aarav Sharma',
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
        phone: '+919876543210',
        sponsorId: 'KV-1001',
      };

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(registerPayload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(testEmail.toLowerCase());
      expect(res.body.data.user.role).toBe('DISTRIBUTOR');
      expect(res.body.data.user.status).toBe('ACTIVE');

      // Verify unique User ID
      expect(res.body.data.user.id).toBeDefined();
      expect(typeof res.body.data.user.id).toBe('string');
      registeredUserId = res.body.data.user.id;

      // Verify generated Referral Code
      const code = res.body.data.user.distributorCode || res.body.data.user.memberId;
      expect(code).toBeDefined();
      expect(code).toMatch(/^DST-\d+/);
      registeredReferralCode = code;

      // Verify tokens issued
      expect(res.body.data.tokens?.accessToken || res.body.data.accessToken).toBeDefined();
    });

    it('should successfully log in with the registered Email and Password in future sessions', async () => {
      const loginPayload = {
        email: testEmail,
        password: testPassword,
      };

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(loginPayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(registeredUserId);
      expect(res.body.data.user.email).toBe(testEmail.toLowerCase());
      expect(res.body.data.tokens?.accessToken || res.body.data.accessToken).toBeDefined();
    });

    it('should also successfully log in using the assigned Referral Code and Password', async () => {
      const loginPayload = {
        identifier: registeredReferralCode,
        password: testPassword,
      };

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(loginPayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(registeredUserId);
      expect(res.body.data.user.email).toBe(testEmail.toLowerCase());
    });

    it('should support case-insensitive email matching during future login', async () => {
      const loginPayload = {
        email: testEmail.toUpperCase(),
        password: testPassword,
      };

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(loginPayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(registeredUserId);
    });

    it('should reject future login if an incorrect password is provided', async () => {
      const loginPayload = {
        email: testEmail,
        password: 'WrongPassword@999',
      };

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(loginPayload)
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('should prevent duplicate registration with the same email', async () => {
      const duplicatePayload = {
        fullName: 'Imposter User',
        email: testEmail,
        password: 'DifferentPassword123!',
        confirmPassword: 'DifferentPassword123!',
      };

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(duplicatePayload)
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });
  });
});
