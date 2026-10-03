import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../../config/env.js';
import { AuthenticatedUser } from '../../middleware/auth.js';

interface RefreshTokenRecord {
  tokenId: string;
  tokenFamily: string;
  userId: string;
  user: AuthenticatedUser;
  isRevoked: boolean;
  expiresAt: number;
}

interface PasswordResetRecord {
  tokenHash: string;
  userId: string;
  email: string;
  expiresAt: number;
}

export class TokenService {
  // Resilient memory store for refresh token families and rotation
  private static refreshTokens = new Map<string, RefreshTokenRecord>();
  private static passwordResets = new Map<string, PasswordResetRecord>();

  /**
   * Generates a paired short-lived Access Token (15m) and long-lived Refresh Token (7d)
   */
  static generateTokenPair(user: AuthenticatedUser, existingFamily?: string): {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  } {
    const tokenId = crypto.randomUUID();
    const tokenFamily = existingFamily || crypto.randomUUID();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    // 1. Short-lived Access Token (15 mins)
    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        distributorId: user.distributorId,
        memberId: user.memberId,
        tokenType: 'access',
      },
      config.jwtSecret,
      { expiresIn: '15m' }
    );

    // 2. Long-lived Refresh Token (7 days) with rotation tracking
    const refreshToken = jwt.sign(
      {
        id: user.id,
        tokenId,
        tokenFamily,
        tokenType: 'refresh',
      },
      config.jwtRefreshSecret,
      { expiresIn: '7d' }
    );

    // Store refresh token tracking record
    this.refreshTokens.set(tokenId, {
      tokenId,
      tokenFamily,
      userId: user.id,
      user,
      isRevoked: false,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  /**
   * Performs Refresh Token Rotation (RTR)
   * Detects and blocks replay attacks / token theft by revoking token families
   */
  static rotateRefreshToken(rawRefreshToken: string): {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: AuthenticatedUser;
  } {
    let decoded: any;
    try {
      decoded = jwt.verify(rawRefreshToken, config.jwtRefreshSecret);
    } catch {
      throw new Error('Invalid or expired refresh token. Please log in again.');
    }

    if (!decoded || decoded.tokenType !== 'refresh' || !decoded.tokenId) {
      throw new Error('Malformed refresh token payload.');
    }

    const record = this.refreshTokens.get(decoded.tokenId);

    // Token Reuse / Theft Detection: If a previously revoked token is presented
    if (record && record.isRevoked) {
      // Invalidate the ENTIRE family to prevent compromised token exploitation
      this.revokeTokenFamily(record.tokenFamily);
      throw new Error('Security breach detected: Reused refresh token. All active sessions have been terminated.');
    }

    if (!record || record.expiresAt <= Date.now()) {
      throw new Error('Refresh token has expired or session not found.');
    }

    // Invalidate the used token immediately
    record.isRevoked = true;
    this.refreshTokens.set(record.tokenId, record);

    // Issue a brand-new token pair within the same token family
    const newTokens = this.generateTokenPair(record.user, record.tokenFamily);

    return {
      ...newTokens,
      user: record.user,
    };
  }

  /**
   * Revoke an entire family of refresh tokens upon suspicious replay
   */
  static revokeTokenFamily(tokenFamily: string): void {
    for (const [tokenId, rec] of this.refreshTokens.entries()) {
      if (rec.tokenFamily === tokenFamily) {
        rec.isRevoked = true;
        this.refreshTokens.set(tokenId, rec);
      }
    }
  }

  /**
   * Revoke all active sessions for a user (e.g. upon password reset or logout-all)
   */
  static revokeAllUserTokens(userId: string): void {
    for (const [tokenId, rec] of this.refreshTokens.entries()) {
      if (rec.userId === userId) {
        rec.isRevoked = true;
        this.refreshTokens.set(tokenId, rec);
      }
    }
  }

  /**
   * Generates a single-use Password Reset Token with strict 15-minute expiry
   */
  static createPasswordResetToken(userId: string, email: string): string {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    this.passwordResets.set(tokenHash, {
      tokenHash,
      userId,
      email,
      expiresAt,
    });

    return rawToken;
  }

  /**
   * Verifies and immediately consumes a password reset token (single-use guarantee)
   */
  static verifyAndConsumeResetToken(rawToken: string): { userId: string; email: string } | null {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const record = this.passwordResets.get(tokenHash);

    if (!record) return null;
    if (record.expiresAt < Date.now()) {
      this.passwordResets.delete(tokenHash);
      return null;
    }

    // Invalidate immediately upon successful verification
    this.passwordResets.delete(tokenHash);
    return { userId: record.userId, email: record.email };
  }
}
