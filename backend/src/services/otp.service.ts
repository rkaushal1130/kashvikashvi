import { randomUUID, createHash } from 'crypto';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';

export interface OtpVerificationSession {
  sessionId: string;
  phone: string; // Normalized 10-digit Indian phone number
  accessTokenHash: string;
  verifiedAt: Date;
  expiresAt: Date; // 15 minutes TTL matching MSG91 config
  consumed: boolean;
  consumedAt?: Date;
}

export class OtpService {
  // In-memory verification sessions store
  private static sessions: Map<string, OtpVerificationSession> = new Map();

  // Set of hashed access tokens to prevent token reuse
  private static usedTokenHashes: Set<string> = new Set();

  /**
   * Reset store (useful for test isolation)
   */
  public static clearSessions(): void {
    this.sessions.clear();
    this.usedTokenHashes.clear();
  }

  /**
   * Normalizes an Indian phone number to exactly 10 digits without silently stripping leading zeros
   */
  public static normalizePhone(phone: string): string {
    if (!phone) return '';
    const clean = String(phone).trim().replace(/[\s\-\(\)\.]/g, '');
    let digits = clean;
    if (digits.startsWith('+91')) {
      digits = digits.slice(3);
    } else if (digits.startsWith('91') && digits.length === 12) {
      digits = digits.slice(2);
    }
    return digits;
  }

  /**
   * Validates a 10-digit Indian phone number format (starts with 6-9, rejects leading zeros)
   */
  public static isValidIndianPhone(phone: string): boolean {
    if (!phone) return false;
    const clean = String(phone).trim().replace(/[\s\-\(\)\.]/g, '');
    if (clean.startsWith('0')) return false;
    const digits = this.normalizePhone(phone);
    if (digits.startsWith('0') || digits.length !== 10) return false;
    return /^[6-9]\d{9}$/.test(digits);
  }

  /**
   * Validates MSG91 Access Token via official Verify Access Token API
   * and creates a 15-minute verification session.
   *
   * Official API: POST https://api.msg91.com/api/v5/widget/verifyAccessToken
   * Headers: authkey, content-type: application/json, Accept: application/json
   * Body: { "access-token": accessToken }
   */
  public static async verifyAccessToken(
    accessToken: string,
    requestedPhone: string
  ): Promise<{ sessionId: string; phone: string; expiresAt: Date }> {
    const cleanToken = (accessToken || '').trim();
    if (!cleanToken) {
      throw AppError.badRequest('MSG91 access token is required.', 'OTP_TOKEN_REQUIRED');
    }

    const rawPhone = String(requestedPhone || '').trim();
    if (rawPhone.startsWith('0')) {
      throw AppError.badRequest(
        'Mobile number cannot begin with 0. Please provide a valid 10-digit Indian mobile number.',
        'INVALID_MOBILE_NUMBER'
      );
    }

    if (!this.isValidIndianPhone(requestedPhone)) {
      throw AppError.badRequest(
        'Please provide a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
        'INVALID_MOBILE_NUMBER'
      );
    }

    const cleanPhone = this.normalizePhone(requestedPhone);

    // 1. Prevent Token Reuse: Hash the access token and check if already used
    const tokenHash = createHash('sha256').update(cleanToken).digest('hex');
    if (this.usedTokenHashes.has(tokenHash)) {
      throw AppError.badRequest(
        'This OTP access token has already been verified and consumed. Please request a new OTP.',
        'OTP_TOKEN_ALREADY_USED'
      );
    }

    let verifiedPhoneFromMsg91: string | null = null;

    // Production environment check: strictly forbid mock tokens and verify auth key
    const isProduction = env.NODE_ENV === 'production' || process.env.NODE_ENV === 'production';
    const isMockToken = cleanToken.startsWith('mock-') || cleanToken.startsWith('test-');
    const authKey = env.MSG91_AUTH_KEY || process.env.MSG91_AUTH_KEY;

    if (isProduction) {
      if (isMockToken) {
        throw AppError.badRequest(
          'Mock OTP tokens are strictly prohibited in production mode.',
          'MOCK_TOKEN_PROHIBITED_IN_PRODUCTION'
        );
      }
      if (!authKey) {
        throw AppError.internal(
          'MSG91_AUTH_KEY is not configured on the production server.',
          'MSG91_AUTH_KEY_MISSING'
        );
      }
    }

    if (isMockToken || process.env.NODE_ENV === 'test' || !authKey) {
      // Test / Mock Token Handling
      if (cleanToken === 'invalid-token' || cleanToken === 'mock-invalid-token') {
        throw AppError.badRequest('Invalid MSG91 access token.', 'MSG91_INVALID_TOKEN');
      }
      if (cleanToken === 'expired-token' || cleanToken === 'mock-expired-token') {
        throw AppError.badRequest('MSG91 access token has expired.', 'MSG91_TOKEN_EXPIRED');
      }
      if (cleanToken === 'api-failure-token' || cleanToken === 'mock-api-failure-token') {
        throw AppError.internal(
          'MSG91 verification service temporarily unreachable.',
          'MSG91_API_FAILURE'
        );
      }
      if (cleanToken === 'mismatch-token' || cleanToken === 'mock-mismatch-token') {
        verifiedPhoneFromMsg91 = '9999900000'; // Deliberate mismatch
      } else if (cleanToken.startsWith('mock-phone-')) {
        // Mock token containing specific phone e.g. mock-phone-9876543210
        verifiedPhoneFromMsg91 = cleanToken.replace('mock-phone-', '');
      } else {
        // Standard mock success
        verifiedPhoneFromMsg91 = cleanPhone;
      }
    } else {
      // Official MSG91 Verify Access Token API Call
      try {
        const response = await fetch('https://api.msg91.com/api/v5/widget/verifyAccessToken', {
          method: 'POST',
          headers: {
            authkey: authKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            'access-token': cleanToken,
          }),
        });

        const data: any = await response.json();

        // 5. Validate MSG91 backend response type and actual verification result (not just HTTP status)
        // Official MSG91 success format: { type: 'success', message: '919876543210' }
        if (!response.ok || data?.type !== 'success' || !data?.message) {
          const errMsg = data?.message || 'MSG91 access token verification failed.';
          logger.warn(
            { errMsg, status: response.status, responseType: data?.type },
            'MSG91 verifyAccessToken rejected'
          );
          throw AppError.badRequest(errMsg, 'MSG91_VERIFICATION_FAILED');
        }

        verifiedPhoneFromMsg91 = this.normalizePhone(String(data.message));
        if (!this.isValidIndianPhone(verifiedPhoneFromMsg91)) {
          throw AppError.badRequest(
            'Invalid mobile number returned by MSG91 verification gateway.',
            'MSG91_INVALID_VERIFIED_PHONE'
          );
        }
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        logger.error({ err: err?.message }, 'Failed to call MSG91 verifyAccessToken API');
        throw AppError.badRequest(
          'Unable to reach OTP verification gateway. Please check your connection and try again.',
          'MSG91_GATEWAY_ERROR'
        );
      }
    }

    // 2. Validate that the verified phone matches the requested registration phone
    const normalizedVerified = this.normalizePhone(verifiedPhoneFromMsg91 || '');
    if (!normalizedVerified || normalizedVerified !== cleanPhone) {
      throw AppError.badRequest(
        `The verified mobile number (${normalizedVerified || 'unknown'}) does not match the mobile number entered (${cleanPhone}).`,
        'OTP_PHONE_MISMATCH'
      );
    }

    // Mark the access token as used so it can never be submitted again
    this.usedTokenHashes.add(tokenHash);

    // 3. Create Short-Lived Verification Session (15 minutes as configured in MSG91 widget)
    const sessionId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 mins TTL

    const session: OtpVerificationSession = {
      sessionId,
      phone: cleanPhone,
      accessTokenHash: tokenHash,
      verifiedAt: now,
      expiresAt,
      consumed: false,
    };

    this.sessions.set(sessionId, session);

    logger.info(
      { sessionId, phone: cleanPhone, expiresAt: expiresAt.toISOString() },
      'OTP Verification Session created successfully'
    );

    return {
      sessionId,
      phone: cleanPhone,
      expiresAt,
    };
  }

  /**
   * Sends OTP via MSG91 v5 Widget REST API
   * POST https://api.msg91.com/api/v5/widget/sendOtp
   * Headers: authkey, Content-Type: application/json
   * Body: { widgetId, identifier }
   */
  public static async sendOtpViaRest(
    phone: string
  ): Promise<{ type: string; message: string; reqId: string }> {
    const rawPhone = String(phone || '').trim();
    if (!this.isValidIndianPhone(rawPhone)) {
      throw AppError.badRequest(
        'Please provide a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
        'INVALID_MOBILE_NUMBER'
      );
    }

    const cleanPhone = this.normalizePhone(rawPhone);
    const identifier = `91${cleanPhone}`;
    const authKey = env.MSG91_AUTH_KEY || process.env.MSG91_AUTH_KEY;
    const widgetId =
      env.MSG91_WIDGET_ID || process.env.MSG91_WIDGET_ID || '366b706c3542343638343034';
    const isProduction = env.NODE_ENV === 'production' || process.env.NODE_ENV === 'production';

    if (isProduction && !authKey) {
      throw AppError.internal(
        'MSG91_AUTH_KEY is not configured on the production server.',
        'MSG91_AUTH_KEY_MISSING'
      );
    }

    // In test environment or when authKey is not set in dev
    if (process.env.NODE_ENV === 'test' || (!isProduction && !authKey)) {
      const mockReqId = `test-req-${identifier}-${Date.now()}`;
      return {
        type: 'success',
        message: 'OTP sent successfully (test mode).',
        reqId: mockReqId,
      };
    }

    try {
      // 1. Primary MSG91 OTP Delivery API (https://control.msg91.com/api/v5/otp)
      let response = await fetch(
        'https://control.msg91.com/api/v5/otp?otp_length=4&otp_expiry=15',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            tokenAuth: authKey!,
            authkey: authKey!,
          },
          body: JSON.stringify({
            widgetId,
            tokenAuth: authKey,
            identifier,
            mobile: identifier,
          }),
        }
      );

      let data: any = await response.json().catch(() => ({}));

      // 2. High-availability fallback to api.msg91.com
      if (!response.ok || (data?.type === 'error' && !data?.request_id)) {
        try {
          const altResponse = await fetch(
            'https://api.msg91.com/api/v5/otp?otp_length=4&otp_expiry=15',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                tokenAuth: authKey!,
                authkey: authKey!,
              },
              body: JSON.stringify({
                widgetId,
                tokenAuth: authKey,
                identifier,
                mobile: identifier,
              }),
            }
          );
          if (altResponse.ok) {
            const altData: any = await altResponse.json().catch(() => ({}));
            if (altData?.type === 'success' || altData?.request_id) {
              response = altResponse;
              data = altData;
            }
          }
        } catch {
          // preserve primary data
        }
      }

      // 3. Fallback to widget/sendOtp if standard otp endpoint was rejected
      if (!response.ok || (data?.type === 'error' && !data?.request_id)) {
        try {
          const widgetResponse = await fetch('https://control.msg91.com/api/v5/widget/sendOtp', {
            method: 'POST',
            headers: {
              tokenAuth: authKey!,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              widgetId,
              tokenAuth: authKey,
              identifier,
            }),
          });
          const widgetData: any = await widgetResponse.json().catch(() => ({}));
          if (widgetResponse.ok && (widgetData?.type === 'success' || widgetData?.request_id || widgetData?.reqId)) {
            response = widgetResponse;
            data = widgetData;
          }
        } catch {
          // ignore widget fallback error
        }
      }

      if (data?.type === 'success' || data?.request_id) {
        const reqId = data?.request_id || data?.reqId || data?.message || data?.data?.reqId;
        logger.info({ phone: cleanPhone, reqId }, 'MSG91 sendOtp succeeded');
        return {
          type: 'success',
          message: 'OTP sent successfully to your mobile number.',
          reqId: String(reqId || ''),
        };
      }

      if (!response.ok || data?.type === 'error' || data?.hasError || data?.status === 'fail') {
        let errMsg = data?.message || 'Failed to send OTP via MSG91 gateway.';
        if (errMsg === 'Invalid request' || errMsg === 'IPBlocked' || errMsg.includes('Web requests are not allowed')) {
          errMsg =
            "MSG91 OTP gateway could not complete the request. If you are configuring MSG91 widget 'SecureOTPWidget4R29', please ensure Web integration is enabled and IP restrictions are set properly in your MSG91 dashboard.";
        } else if (errMsg.includes('AuthenticationFailure')) {
          errMsg =
            'MSG91 Authentication Failed (Code 201). Please check that MSG91_AUTH_KEY in backend/.env is your active Authkey from your MSG91 dashboard.';
        }
        logger.warn({ errMsg, status: response.status, data }, 'MSG91 sendOtp rejected');
        throw AppError.badRequest(errMsg, 'MSG91_SEND_OTP_FAILED');
      }

      const reqId = data?.reqId || data?.message || data?.data?.reqId;
      logger.info({ phone: cleanPhone, reqId }, 'MSG91 sendOtp succeeded');
      return {
        type: 'success',
        message: 'OTP sent successfully to your mobile number.',
        reqId: String(reqId || ''),
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      logger.error({ err: err?.message }, 'Failed to call MSG91 sendOtp API');
      throw AppError.badRequest(
        err?.message ||
          'Unable to reach OTP delivery gateway. Please check your connection and try again.',
        'MSG91_GATEWAY_ERROR'
      );
    }
  }

  /**
   * Retries / Resends OTP via MSG91 v5 Widget REST API
   * POST https://api.msg91.com/api/v5/widget/retryOtp
   * Headers: authkey, Content-Type: application/json
   * Body: { widgetId, reqId, retryChannel }
   */
  public static async retryOtpViaRest(
    reqId: string,
    channel: number | string = 11
  ): Promise<{ type: string; message: string; reqId: string }> {
    const cleanReqId = String(reqId || '').trim();
    if (!cleanReqId) {
      throw AppError.badRequest('Request ID (reqId) is required to resend OTP.', 'REQ_ID_REQUIRED');
    }

    const authKey = env.MSG91_AUTH_KEY || process.env.MSG91_AUTH_KEY;
    const widgetId =
      env.MSG91_WIDGET_ID || process.env.MSG91_WIDGET_ID || '366b706c3542343638343034';
    const isProduction = env.NODE_ENV === 'production' || process.env.NODE_ENV === 'production';

    if (isProduction && !authKey) {
      throw AppError.internal(
        'MSG91_AUTH_KEY is not configured on the production server.',
        'MSG91_AUTH_KEY_MISSING'
      );
    }

    if (process.env.NODE_ENV === 'test' || (!isProduction && !authKey)) {
      return {
        type: 'success',
        message: 'OTP resent successfully (test mode).',
        reqId: cleanReqId,
      };
    }

    try {
      let response = await fetch('https://control.msg91.com/api/v5/widget/retryOtp', {
        method: 'POST',
        headers: {
          tokenAuth: authKey!,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          widgetId,
          tokenAuth: authKey,
          reqId: cleanReqId,
          retryChannel: Number(channel) || 11,
        }),
      });

      let data: any = await response.json().catch(() => ({}));

      if (!response.ok || data?.type === 'error' || data?.hasError || data?.status === 'fail') {
        const altResponse = await fetch('https://api.msg91.com/api/v5/widget/retryOtp', {
          method: 'POST',
          headers: {
            tokenAuth: authKey!,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            widgetId,
            tokenAuth: authKey,
            reqId: cleanReqId,
            retryChannel: Number(channel) || 11,
          }),
        });
        if (altResponse.ok) {
          const altData: any = await altResponse.json().catch(() => ({}));
          if (altData?.type === 'success') {
            response = altResponse;
            data = altData;
          }
        }
      }

      if (data?.type === 'success') {
        logger.info({ reqId: cleanReqId }, 'MSG91 retryOtp succeeded');
        return {
          type: 'success',
          message: 'OTP resent successfully.',
          reqId: cleanReqId,
        };
      }

      if (!response.ok || data?.type === 'error' || data?.hasError || data?.status === 'fail') {
        let errMsg = data?.message || 'Failed to resend OTP via MSG91 gateway.';
        if (errMsg.includes('Web requests are not allowed')) {
          errMsg =
            "Web requests are not allowed for this widget. In your MSG91 dashboard for widget 'SecureOTPWidget4R29', please turn OFF 'Mobile Integration' to enable Web OTP.";
        }
        logger.warn({ errMsg, status: response.status, data }, 'MSG91 retryOtp rejected');
        throw AppError.badRequest(errMsg, 'MSG91_RETRY_OTP_FAILED');
      }

      logger.info({ reqId: cleanReqId }, 'MSG91 retryOtp succeeded');
      return {
        type: 'success',
        message: 'OTP resent successfully.',
        reqId: cleanReqId,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      logger.error({ err: err?.message }, 'Failed to call MSG91 retryOtp API');
      throw AppError.badRequest(
        err?.message ||
          'Unable to reach OTP delivery gateway. Please check your connection and try again.',
        'MSG91_GATEWAY_ERROR'
      );
    }
  }

  /**
   * Verifies OTP code via MSG91 v5 Widget REST API, extracts access token,
   * validates it on backend, and creates verification session.
   * POST https://api.msg91.com/api/v5/widget/verifyOtp
   * Headers: authkey, Content-Type: application/json
   * Body: { widgetId, reqId, otp, identifier }
   */
  public static async verifyOtpViaRest(
    reqId: string | undefined,
    otp: string,
    phone: string
  ): Promise<{ sessionId: string; phone: string; expiresAt: Date; accessToken?: string }> {
    const cleanOtp = String(otp || '').trim();
    if (!cleanOtp || cleanOtp.length !== 4) {
      throw AppError.badRequest('Please enter a valid 4-digit OTP.', 'INVALID_OTP');
    }

    if (!this.isValidIndianPhone(phone)) {
      throw AppError.badRequest(
        'Please provide a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
        'INVALID_MOBILE_NUMBER'
      );
    }

    const cleanPhone = this.normalizePhone(phone);
    const identifier = `91${cleanPhone}`;
    const cleanReqId = String(reqId || '').trim();
    const authKey = env.MSG91_AUTH_KEY || process.env.MSG91_AUTH_KEY;
    const widgetId =
      env.MSG91_WIDGET_ID || process.env.MSG91_WIDGET_ID || '366b706c3542343638343034';
    const isProduction = env.NODE_ENV === 'production' || process.env.NODE_ENV === 'production';

    if (isProduction && !authKey) {
      throw AppError.internal(
        'MSG91_AUTH_KEY is not configured on the production server.',
        'MSG91_AUTH_KEY_MISSING'
      );
    }

    if (process.env.NODE_ENV === 'test' || (!isProduction && !authKey)) {
      if (cleanOtp === '1234') {
        const mockToken = `mock-token-${cleanPhone}`;
        const session = await this.verifyAccessToken(mockToken, cleanPhone);
        return { ...session, accessToken: mockToken };
      }
      throw AppError.badRequest('Incorrect OTP. Please check and try again.', 'MSG91_INVALID_OTP');
    }

    try {
      let response = await fetch('https://control.msg91.com/api/v5/widget/verifyOtp', {
        method: 'POST',
        headers: {
          tokenAuth: authKey!,
          authkey: authKey!,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          widgetId,
          tokenAuth: authKey,
          otp: cleanOtp,
          ...(cleanReqId ? { reqId: cleanReqId } : {}),
          identifier,
        }),
      });

      let data: any = await response.json().catch(() => ({}));

      if (!response.ok || data?.type === 'error' || data?.hasError || data?.status === 'fail') {
        try {
          const altResponse = await fetch('https://api.msg91.com/api/v5/widget/verifyOtp', {
            method: 'POST',
            headers: {
              tokenAuth: authKey!,
              authkey: authKey!,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              widgetId,
              tokenAuth: authKey,
              otp: cleanOtp,
              ...(cleanReqId ? { reqId: cleanReqId } : {}),
              identifier,
            }),
          });
          if (altResponse.ok) {
            const altData: any = await altResponse.json().catch(() => ({}));
            if (altData?.type === 'success' || altData?.['access-token'] || altData?.accessToken) {
              response = altResponse;
              data = altData;
            }
          }
        } catch {
          // ignore
        }
      }

      if (!response.ok || data?.type === 'error' || data?.hasError || data?.status === 'fail') {
        let errMsg = data?.message || 'Incorrect OTP. Please check and try again.';
        if (errMsg.includes('Web requests are not allowed')) {
          errMsg =
            "Web requests are not allowed for this widget. In your MSG91 dashboard for widget 'SecureOTPWidget4R29', please turn OFF 'Mobile Integration' to enable Web OTP.";
        }
        logger.warn({ errMsg, status: response.status, data }, 'MSG91 verifyOtp rejected');
        throw AppError.badRequest(errMsg, 'MSG91_VERIFICATION_FAILED');
      }

      // MSG91 verifyOtp returns access-token in data['access-token'] or data.accessToken or data.message
      const accessToken =
        data['access-token'] ||
        data.accessToken ||
        data.token ||
        (typeof data.message === 'string' && data.message.length > 20 ? data.message : null);

      if (!accessToken) {
        throw AppError.badRequest(
          'Verification gateway did not return a valid access token.',
          'MSG91_NO_ACCESS_TOKEN'
        );
      }

      // Validate access token and create verification session
      const session = await this.verifyAccessToken(accessToken, cleanPhone);
      return {
        ...session,
        accessToken,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      logger.error({ err: err?.message }, 'Failed to call MSG91 verifyOtp API');
      throw AppError.badRequest(
        err?.message ||
          'Unable to complete OTP verification. Please check your connection and try again.',
        'MSG91_GATEWAY_ERROR'
      );
    }
  }

  /**
   * Validates an existing verification session for a given mobile number
   */
  public static validateSession(sessionId: string, phone: string): OtpVerificationSession {
    if (!sessionId) {
      throw AppError.badRequest(
        'Please verify your mobile number with OTP before registration.',
        'OTP_VERIFICATION_REQUIRED'
      );
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw AppError.badRequest(
        'Invalid or expired verification session. Please verify your mobile number again.',
        'OTP_SESSION_NOT_FOUND'
      );
    }

    // Check if session has already been consumed (prevents session reuse)
    if (session.consumed) {
      throw AppError.badRequest(
        'This verification session has already been used for registration. Please request a new OTP.',
        'OTP_SESSION_ALREADY_USED'
      );
    }

    // Check if session has expired (15 minutes TTL)
    if (new Date() > session.expiresAt) {
      throw AppError.badRequest(
        'OTP verification has expired (15-minute limit exceeded). Please verify your mobile number again.',
        'OTP_SESSION_EXPIRED'
      );
    }

    // Match phone numbers
    const cleanPhone = this.normalizePhone(phone);
    if (cleanPhone !== session.phone) {
      throw AppError.badRequest(
        'The mobile number does not match the verified mobile number for this session.',
        'OTP_PHONE_MISMATCH'
      );
    }

    return session;
  }

  /**
   * Consumes a verification session upon successful distributor registration
   */
  public static consumeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.consumed = true;
      session.consumedAt = new Date();
      logger.info({ sessionId, phone: session.phone }, 'OTP Verification Session consumed');
    }
  }

  /**
   * Invalidate a session explicitly
   */
  public static invalidateSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
