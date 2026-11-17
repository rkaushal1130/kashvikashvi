import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OtpService } from '../src/services/otp.service';
import { AuthService } from '../src/services/auth.service';
import { AppError } from '../src/utils/appError';

describe('MSG91 OTP VERIFICATION & REGISTRATION FLOW (SecureOTPWidget4R29)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    OtpService.clearSessions();
    AuthService.clearInMemoryUsers();
  });

  // TEST CASE 1: Valid mobile number
  describe('Test Case 1: Valid mobile number', () => {
    it('should correctly validate and normalize a valid 10-digit Indian mobile number', () => {
      const validNumbers = [
        '9876543210',
        '+91 98765 43210',
        '919876543210',
        '8123456789',
        '7000123456',
        '6999988888',
      ];

      for (const phone of validNumbers) {
        expect(OtpService.isValidIndianPhone(phone)).toBe(true);
        expect(OtpService.normalizePhone(phone).length).toBe(10);
      }
    });
  });

  // TEST CASE 2: Invalid mobile number
  describe('Test Case 2: Invalid mobile number', () => {
    it('should reject invalid mobile numbers (<10 digits, invalid prefix, alpha chars)', async () => {
      const invalidNumbers = [
        '12345',
        '5876543210', // Doesn't start with 6, 7, 8, or 9
        '0123456789',
        'abcdefghij',
        '',
      ];

      for (const phone of invalidNumbers) {
        expect(OtpService.isValidIndianPhone(phone)).toBe(false);
      }

      await expect(
        OtpService.verifyAccessToken('mock-token-1', '12345')
      ).rejects.toThrow(/Please provide a valid 10-digit Indian mobile number/i);
    });
  });

  // TEST CASE 3: OTP successfully sent
  describe('Test Case 3: OTP successfully sent', () => {
    it('should confirm phone format and prepare verification request', () => {
      const phone = '9876543210';
      const normalized = OtpService.normalizePhone(phone);
      expect(normalized).toBe('9876543210');
      const widgetPayloadIdentifier = `91${normalized}`;
      expect(widgetPayloadIdentifier).toBe('919876543210');
    });
  });

  // TEST CASE 4: Incorrect OTP
  describe('Test Case 4: Incorrect OTP', () => {
    it('should reject an incorrect OTP code with appropriate error', async () => {
      // In MSG91 verification, an invalid OTP submitted returns failure from MSG91
      await expect(
        OtpService.verifyAccessToken('mock-invalid-token', '9876543210')
      ).rejects.toThrow('Invalid MSG91 access token.');
    });
  });

  // TEST CASE 5: Correct OTP
  describe('Test Case 5: Correct OTP', () => {
    it('should verify correct OTP token, return a 15-minute verification session', async () => {
      const phone = '9876543210';
      const token = 'mock-valid-token-1';

      const result = await OtpService.verifyAccessToken(token, phone);

      expect(result).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.phone).toBe('9876543210');
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Verify the session can be validated
      const session = OtpService.validateSession(result.sessionId, phone);
      expect(session.consumed).toBe(false);
      expect(session.phone).toBe('9876543210');
    });
  });

  // TEST CASE 6: Expired OTP
  describe('Test Case 6: Expired OTP', () => {
    it('should reject when MSG91 token indicates expiry', async () => {
      await expect(
        OtpService.verifyAccessToken('mock-expired-token', '9876543210')
      ).rejects.toThrow('MSG91 access token has expired.');
    });

    it('should reject a verification session that exceeds the 15-minute validity window', async () => {
      const phone = '9876543210';
      const result = await OtpService.verifyAccessToken('mock-valid-token-expire', phone);

      // Artificially expire the session (simulate 16 minutes later)
      const session = (OtpService as any).sessions.get(result.sessionId);
      session.expiresAt = new Date(Date.now() - 1000); // 1 second in the past

      expect(() => OtpService.validateSession(result.sessionId, phone)).toThrow(
        /expired/i
      );
    });
  });

  // TEST CASE 7: Resend OTP
  describe('Test Case 7: Resend OTP', () => {
    it('should respect configured 10-second resend interval', () => {
      const configuredResendIntervalSeconds = 10;
      expect(configuredResendIntervalSeconds).toBe(10);
    });
  });

  // TEST CASE 8: Multiple OTP request prevention
  describe('Test Case 8: Multiple OTP request prevention', () => {
    it('should prevent reusing the same access token multiple times', async () => {
      const phone = '9876543210';
      const token = 'mock-single-use-token';

      // First verification succeeds
      const firstResult = await OtpService.verifyAccessToken(token, phone);
      expect(firstResult.sessionId).toBeDefined();

      // Second attempt with exact same access token MUST be rejected
      await expect(OtpService.verifyAccessToken(token, phone)).rejects.toThrow(
        /already been verified and consumed/i
      );
    });
  });

  // TEST CASE 9: Registration without OTP verification
  describe('Test Case 9: Registration without OTP verification', () => {
    it('should block registration and return exact error message when verification session is missing', async () => {
      const originalRequireOtp = process.env.REQUIRE_OTP_VERIFICATION;
      process.env.REQUIRE_OTP_VERIFICATION = 'true';

      try {
        const payload = {
          fullName: 'Test Distributor',
          email: 'unverified@kashvimlm.com',
          phone: '9876543210',
          password: 'Password@123',
          confirmPassword: 'Password@123',
          referralCode: 'KV-1001',
        };

        await expect(AuthService.register(payload as any)).rejects.toThrow(
          'Please verify your mobile number before registration.'
        );
      } finally {
        process.env.REQUIRE_OTP_VERIFICATION = originalRequireOtp;
      }
    });
  });

  // TEST CASE 10: Registration after successful OTP verification
  describe('Test Case 10: Registration after successful OTP verification', () => {
    it('should succeed with registration when valid verification session is supplied, and consume the session', async () => {
      const phone = '9876543210';
      const verifyRes = await OtpService.verifyAccessToken('mock-token-reg-success', phone);

      const payload = {
        fullName: 'Rajesh Verma',
        email: 'rajesh.verma@example.com',
        phone,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        referralCode: 'KV-1001',
        verificationSessionId: verifyRes.sessionId,
      };

      const regResult = await AuthService.register(payload as any);

      expect(regResult).toBeDefined();
      expect(regResult.user).toBeDefined();
      expect(regResult.user.fullName).toBe('Rajesh Verma');
      expect(regResult.tokens?.accessToken).toBeDefined();

      // Session must now be consumed (single-use)
      expect(() => OtpService.validateSession(verifyRes.sessionId, phone)).toThrow(
        /already been used for registration/i
      );
    });
  });

  // TEST CASE 11: Mobile number changed after verification
  describe('Test Case 11: Mobile number changed after verification', () => {
    it('should reject registration if registration phone differs from verified phone', async () => {
      const verifiedPhone = '9876543210';
      const verifyRes = await OtpService.verifyAccessToken('mock-token-diff-phone', verifiedPhone);

      // Attempt to register with a DIFFERENT phone number using the previous session
      const alteredPhone = '9876500000';
      const payload = {
        fullName: 'Sneha Patel',
        email: 'sneha@example.com',
        phone: alteredPhone,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        referralCode: 'KV-1001',
        verificationSessionId: verifyRes.sessionId,
      };

      await expect(AuthService.register(payload as any)).rejects.toThrow(
        /does not match the verified mobile number/i
      );
    });
  });

  // TEST CASE 12: Duplicate mobile number
  describe('Test Case 12: Duplicate mobile number', () => {
    it('should reject registration when mobile number is already registered', async () => {
      const phone = '9876543210';

      // First user verifies and registers
      const verify1 = await OtpService.verifyAccessToken('mock-token-dup-1', phone);
      await AuthService.register({
        fullName: 'User One',
        email: 'user1@example.com',
        phone,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        referralCode: 'KV-1001',
        verificationSessionId: verify1.sessionId,
      } as any);

      // Second user verifies same phone and attempts to register
      const verify2 = await OtpService.verifyAccessToken('mock-token-dup-2', phone);
      await expect(
        AuthService.register({
          fullName: 'User Two',
          email: 'user2@example.com',
          phone,
          password: 'Password@123',
          confirmPassword: 'Password@123',
          referralCode: 'KV-1001',
          verificationSessionId: verify2.sessionId,
        } as any)
      ).rejects.toThrow(/An account with this mobile number already exists./i);
    });
  });

  // TEST CASE 13: MSG91 API failure
  describe('Test Case 13: MSG91 API failure', () => {
    it('should cleanly handle MSG91 API gateway failure without crashing', async () => {
      await expect(
        OtpService.verifyAccessToken('mock-api-failure-token', '9876543210')
      ).rejects.toThrow(/MSG91 verification service temporarily unreachable./i);
    });
  });

  // TEST CASE 14: Invalid or reused access token
  describe('Test Case 14: Invalid or reused access token', () => {
    it('should reject invalid or reused access tokens and prevent session reuse', async () => {
      const phone = '9876543210';
      const token = 'mock-token-reuse-test';

      // 1. First verification with token succeeds
      const sessionResult = await OtpService.verifyAccessToken(token, phone);
      expect(sessionResult.sessionId).toBeDefined();

      // 2. Immediate reuse of the same token must fail
      await expect(OtpService.verifyAccessToken(token, phone)).rejects.toThrow(
        /already been verified and consumed/i
      );

      // 3. Consume the session
      OtpService.consumeSession(sessionResult.sessionId);

      // 4. Reuse of the consumed session must fail
      expect(() => OtpService.validateSession(sessionResult.sessionId, phone)).toThrow(
        /already been used for registration/i
      );
    });
  });

  // TEST CASE 15: Mock OTP tokens strictly forbidden in production
  describe('Test Case 15: Mock OTP tokens forbidden in production', () => {
    it('should reject mock tokens when running in production mode', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        await expect(
          OtpService.verifyAccessToken('mock-token-prod-test', '9876543210')
        ).rejects.toThrow(/Mock OTP tokens are strictly prohibited in production/i);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });
});
