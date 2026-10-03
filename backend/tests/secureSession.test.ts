import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { AuthService } from '../src/services/auth.service';

describe('SECURE AUTHENTICATION SESSION & COOKIES TEST SUITE', () => {
  const timestamp = Date.now();
  const validEmail = `session.distributor.${timestamp}@kashvimlm.test`;
  const validPassword = 'SecureSessionPass@2026';
  let registeredUserId: string;

  beforeAll(async () => {
    await (AuthService as any).initSeedUsers?.();

    // Register test user
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Session Distributor',
        email: validEmail,
        phone: `+91992${String(timestamp).slice(-7)}`,
        password: validPassword,
        confirmPassword: validPassword,
        referralCode: 'KV-1001',
      })
      .expect(201);

    registeredUserId = regRes.body.user.id || regRes.body.user.userId;
  });

  describe('1. Cookie Security Configuration (HttpOnly, Secure, SameSite)', () => {
    it('should set HttpOnly, SameSite, Path, and Max-Age on login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: validEmail,
          password: validPassword,
        })
        .expect(200);

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(Array.isArray(cookies)).toBe(true);

      const refreshCookie = cookies?.find((c: string) => c.startsWith('kashvi_refresh='));
      expect(refreshCookie).toBeDefined();

      // Verify HttpOnly (inaccessible to malicious scripts/XSS)
      expect(refreshCookie).toMatch(/HttpOnly/i);

      // Verify SameSite (CSRF mitigation)
      expect(refreshCookie).toMatch(/SameSite=(Lax|Strict)/i);

      // Verify Path
      expect(refreshCookie).toMatch(/Path=\//i);

      // Verify MaxAge (7 days = 604800s)
      expect(refreshCookie).toMatch(/Max-Age=604800/i);
    });

    it('should issue short-lived access token (15m = 900s) and never return sensitive secrets', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: validEmail,
          password: validPassword,
        })
        .expect(200);

      expect(res.body.tokens).toBeDefined();
      expect(res.body.tokens.accessToken).toBeDefined();
      expect(res.body.tokens.expiresIn).toBe(900); // 15 minutes

      // Ensure no password hash or secrets exposed in response body
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.passwordHash).toBeUndefined();
    });
  });

  describe('2. Authentication Survives Page Refresh via Cookie / Refresh Token', () => {
    it('Flow: Login -> Refresh page (call /auth/refresh with cookie) -> User remains authenticated', async () => {
      const agent = request.agent(app);

      // Step 1: Login
      const loginRes = await agent
        .post('/api/auth/login')
        .send({
          email: validEmail,
          password: validPassword,
        })
        .expect(200);

      expect(loginRes.body.success).toBe(true);
      const accessToken = loginRes.body.tokens.accessToken;
      expect(accessToken).toBeDefined();

      // Step 2: Access protected /api/auth/me with access token
      const meResBefore = await agent
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(meResBefore.body.data.email.toLowerCase()).toBe(validEmail.toLowerCase());

      // Step 3: Simulate Page Refresh
      // React state is wiped; client calls /api/auth/refresh using stored HttpOnly cookie
      const refreshRes = await agent
        .post('/api/auth/refresh')
        .send({}) // Refresh token transmitted via cookie
        .expect(200);

      expect(refreshRes.body.success).toBe(true);
      const newAccessToken =
        refreshRes.body.data?.accessToken ||
        refreshRes.body.data?.tokens?.accessToken ||
        refreshRes.body.tokens?.accessToken;
      expect(newAccessToken).toBeDefined();
      expect(newAccessToken).not.toBe(accessToken); // Rotated!

      // Step 4: Access /api/auth/me with new rotated access token
      const meResAfter = await agent
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      expect(meResAfter.body.data.email.toLowerCase()).toBe(validEmail.toLowerCase());
      expect(meResAfter.body.data.id).toBe(registeredUserId);
    }, 45000);
  });

  describe('3. Logout Revocation and Unauthenticated State on Refresh', () => {
    it('Flow: Logout -> Refresh page -> User is unauthenticated (401 Unauthorized)', async () => {
      const agent = request.agent(app);

      // Step 1: Login
      const loginRes = await agent
        .post('/api/auth/login')
        .send({
          email: validEmail,
          password: validPassword,
        })
        .expect(200);

      const accessToken = loginRes.body.tokens.accessToken;
      expect(accessToken).toBeDefined();

      // Step 2: Logout
      const logoutRes = await agent
        .post('/api/auth/logout')
        .send({})
        .expect(200);

      expect(logoutRes.body.success).toBe(true);

      // Verify clear-cookie headers
      const cookies = logoutRes.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const clearedCookie = cookies?.find((c: string) => c.startsWith('kashvi_refresh='));
      expect(clearedCookie).toMatch(/Max-Age=0|expires=/i);

      // Step 3: Simulate Page Refresh after logout
      // Calling /api/auth/refresh without valid session cookie must fail with 401
      const refreshFailRes = await agent
        .post('/api/auth/refresh')
        .send({})
        .expect(401);

      expect(refreshFailRes.body.success).toBe(false);

      // Calling /api/auth/me without token must fail with 401
      const meFailRes = await agent
        .get('/api/auth/me')
        .expect(401);

      expect(meFailRes.body.success).toBe(false);
      expect(meFailRes.body.message).toMatch(/missing|unauthorized/i);
    }, 45000);
  });

  describe('4. Token Reuse Detection and Security', () => {
    it('should reject refresh when refresh token is invalid or expired', async () => {
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid.bogus.jwt.token' })
        .expect(401);
    });

    it('should reject refresh when neither cookie nor body refresh token is provided', async () => {
      await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(401);
    });
  });
});
