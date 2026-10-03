import { query } from '../../config/db.js';
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/env.js';
import { SecurityUtils } from '../../utils/security.js';
import { logger } from '../../config/logger.js';
import { TokenService } from './token.service.js';
import { LoginProtectionService } from '../../middleware/loginBruteForce.js';
import { AuthenticatedUser } from '../../middleware/auth.js';
import { BinaryTreeService } from '../mlmTree/binaryTree.service.js';

export interface RegisterDTO {
  fullName: string;
  email: string;
  phone?: string;
  username?: string;
  password: string;
  confirmPassword?: string;
  sponsorId?: string;
}

export interface LoginDTO {
  email?: string;
  username?: string;
  password: string;
  sponsorId?: string;
  rememberMe?: boolean;
}

interface StoredUser {
  id: string;
  email: string;
  username: string;
  name: string;
  phone?: string;
  passwordHash: string;
  role: 'admin' | 'distributor' | string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | string;
  memberId: string;
  distributorId: string;
  sponsorId?: string;
}

export class AuthService {
  // Resilient in-memory store for registered and seeded users
  private static inMemoryUsers: Map<string, StoredUser> = new Map();
  private static initialized = false;

  /**
   * Initialize default seed users for development / test environments
   */
  public static async initSeedUsers(): Promise<void> {
    if (this.initialized) return;

    // Pre-seed known accounts with valid Argon2id hashes
    const adminHash = await SecurityUtils.hashPassword('Admin@123');
    const distHash = await SecurityUtils.hashPassword('Distributor@123');
    const suspHash = await SecurityUtils.hashPassword('Suspended@123');
    const defaultHash = await SecurityUtils.hashPassword('password123');

    const seedList: StoredUser[] = [
      {
        id: 'usr-admin-seed',
        email: 'admin@example.com',
        username: 'admin',
        name: 'System Administrator',
        phone: '+91 98765 00001',
        passwordHash: adminHash,
        role: 'admin',
        status: 'ACTIVE',
        memberId: 'KV-1001',
        distributorId: 'dist-admin-1001',
        sponsorId: 'ROOT',
      },
      {
        id: 'usr-dist-seed',
        email: 'distributor@example.com',
        username: 'distributor',
        name: 'Amit Patel',
        phone: '+91 98765 00002',
        passwordHash: distHash,
        role: 'distributor',
        status: 'ACTIVE',
        memberId: 'KV-1002',
        distributorId: 'dist-1002',
        sponsorId: 'KV-1001',
      },
      {
        id: 'usr-susp-seed',
        email: 'suspended@example.com',
        username: 'suspended',
        name: 'Suspended User',
        phone: '+91 98765 00003',
        passwordHash: suspHash,
        role: 'distributor',
        status: 'SUSPENDED',
        memberId: 'KV-1008',
        distributorId: 'dist-1008',
        sponsorId: 'KV-1001',
      },
      {
        id: 'demo-rahul-id',
        email: 'rahul.kaushal@kashvimlm.com',
        username: 'rahul_kaushal',
        name: 'Rahul Kaushal',
        phone: '+91 98765 43210',
        passwordHash: defaultHash,
        role: 'admin',
        status: 'ACTIVE',
        memberId: '88767139',
        distributorId: 'demo-dist-id',
        sponsorId: 'ROOT',
      },
    ];

    // The seed list above carries placeholder ids ('demo-dist-id', '88767139').
    // Those match no row in Postgres, so anything keyed off the token's member/
    // distributor id (e.g. "my network tree") resolved to nothing and silently
    // served a fallback fixture. Re-point the seeds at their real rows when the
    // database is reachable.
    try {
      for (const u of seedList) {
        const res = await query(
          `SELECT d.id AS distributor_uuid, d.member_id
           FROM distributors d
           JOIN users usr ON usr.id = d.user_id
           WHERE usr.email = $1`,
          [u.email.toLowerCase()]
        );
        if (res.rows[0]) {
          u.id = res.rows[0].distributor_uuid;
          u.memberId = res.rows[0].member_id;
          u.distributorId = res.rows[0].distributor_uuid;
        }
      }
    } catch {
      // Database offline: keep the placeholder seeds so the app still boots.
    }

    for (const u of seedList) {
      this.inMemoryUsers.set(u.id, u);
      this.inMemoryUsers.set(u.email.toLowerCase(), u);
      this.inMemoryUsers.set(u.username.toLowerCase(), u);
      this.inMemoryUsers.set(u.memberId.toUpperCase(), u);
    }

    this.initialized = true;
  }

  /**
   * Find stored user by ID, email, username or memberId
   */
  private static findStoredUser(identifier: string): StoredUser | null {
    const clean = (identifier || '').trim().toLowerCase();
    const cleanUpper = (identifier || '').trim().toUpperCase();
    return (
      this.inMemoryUsers.get(clean) ||
      this.inMemoryUsers.get(cleanUpper) ||
      this.inMemoryUsers.get(identifier) ||
      null
    );
  }

  /**
   * Save user in in-memory store under multiple lookup keys
   */
  private static saveStoredUser(user: StoredUser): void {
    this.inMemoryUsers.set(user.id, user);
    this.inMemoryUsers.set(user.email.toLowerCase(), user);
    this.inMemoryUsers.set(user.username.toLowerCase(), user);
    this.inMemoryUsers.set(user.memberId.toUpperCase(), user);
  }

  /**
   * Register a new distributor with Argon2id password hashing and JWT token issuance
   */
  static async register(dto: RegisterDTO) {
    await this.initSeedUsers();

    if (!dto.email || !dto.password) {
      throw new Error('Email and password are required for registration.');
    }

    const cleanEmail = dto.email.toLowerCase().trim();
    if (this.findStoredUser(cleanEmail)) {
      throw new Error(`Email ${cleanEmail} is already registered.`);
    }

    const sponsorCode = dto.sponsorId?.trim() || config.defaultSponsorId;

    // 1. Hash password with Argon2id (never store plain-text password)
    const passwordHash = await SecurityUtils.hashPassword(dto.password);

    // 2. Generate unique 8-digit Member ID
    const memberId = `${Math.floor(10000000 + Math.random() * 90000000)}`;
    const rawUsername = dto.username || dto.email.split('@')[0];
    const cleanUsername = rawUsername.replace('@', '').trim();
    const userId = `usr-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const distId = `dist-${memberId}`;

    const newUser: StoredUser = {
      id: userId,
      email: cleanEmail,
      username: cleanUsername,
      name: dto.fullName?.trim() || cleanUsername,
      phone: dto.phone?.trim() || '+91 98765 00000',
      passwordHash,
      role: 'distributor',
      status: 'ACTIVE',
      memberId,
      distributorId: distId,
      sponsorId: sponsorCode,
    };

    // Save in in-memory registry
    this.saveStoredUser(newUser);

    try {
      // Prisma ORM creation if database is connected
      const user = await prisma.user.create({
        data: {
          email: cleanEmail,
          phone: newUser.phone || '',
          username: cleanUsername,
          passwordHash,
          role: 'distributor',
          distributor: {
            create: {
              memberId,
              fullName: newUser.name,
              sponsorId: sponsorCode,
              placementLeg: 'auto',
              rank: 'Business Center',
              qualificationStatus: 'Active',
            },
          },
        },
        include: { distributor: true },
      });

      newUser.id = user.id;
      if (user.distributor) {
        newUser.distributorId = user.distributor.id;
        newUser.memberId = user.distributor.memberId;
      }
      this.saveStoredUser(newUser);
    } catch (dbErr) {
      // The in-memory registry keeps the session usable, but a user that is not in
      // Postgres can never sponsor anyone (EnrollmentService.verifySponsor reads the
      // distributors table), so log the real cause instead of hiding it.
      logger.warn(
        { err: dbErr },
        '[AuthService] Prisma user creation failed. User is only in the in-memory registry and will not persist to Postgres.'
      );
    }

    const authUser: AuthenticatedUser = {
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      role: 'distributor',
      distributorId: newUser.distributorId,
      memberId: newUser.memberId,
      status: 'ACTIVE',
      isActive: true,
    };

    const tokens = TokenService.generateTokenPair(authUser);

    logger.info({ memberId: newUser.memberId, email: newUser.email }, 'New distributor registered with Argon2id security');

    return {
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: {
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        phone: newUser.phone,
        memberId: newUser.memberId,
        sponsorId: newUser.sponsorId,
        rank: 'Business Center',
        role: 'DISTRIBUTOR',
        status: 'ACTIVE',
      },
    };
  }

  /**
   * Authenticate user with brute-force defense, Argon2id verification, and refresh token rotation
   */
  static async login(dto: LoginDTO, clientIp?: string) {
    await this.initSeedUsers();

    const identifier = (dto.email || dto.username || '').trim();
    if (!identifier || !dto.password) {
      throw new Error('Email/Username and Password are required.');
    }

    // 1. Check Brute-Force Lockout Status
    const lockStatus = LoginProtectionService.checkAttemptStatus(identifier, clientIp);
    if (lockStatus.isLocked) {
      throw new Error(
        `Account temporarily locked due to excessive failed attempts. Please retry in ${lockStatus.remainingSeconds} seconds.`
      );
    }

    // 2. Look up stored user
    let user = this.findStoredUser(identifier);

    // If not found in memory, try DB
    if (!user) {
      try {
        // Strip only a LEADING '@' (usernames are stored as '@handle').
        // Stripping every '@' mangles emails ('a@b.com' -> 'ab.com'), which made
        // email login impossible for anyone not in the in-memory registry.
        const raw = identifier.trim();
        const lower = raw.toLowerCase();
        const handle = lower.replace(/^@/, '');
        const dbUser = await prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: lower, mode: 'insensitive' } },
              { username: { equals: lower, mode: 'insensitive' } },
              { username: { equals: handle, mode: 'insensitive' } },
              { username: { equals: `@${handle}`, mode: 'insensitive' } },
              { distributor: { is: { memberId: raw } } },
            ],
          },
          include: { distributor: true },
        });

        if (dbUser) {
          user = {
            id: dbUser.id,
            email: dbUser.email,
            username: dbUser.username,
            name: dbUser.distributor?.fullName || dbUser.username,
            phone: dbUser.phone || '',
            passwordHash: dbUser.passwordHash,
            role: dbUser.role.toLowerCase(),
            status: dbUser.isActive ? 'ACTIVE' : 'INACTIVE',
            memberId: dbUser.distributor?.memberId || 'KV-1001',
            distributorId: dbUser.distributor?.id || 'demo-dist-id',
            sponsorId: dbUser.distributor?.sponsorId || 'ROOT',
          };
          this.saveStoredUser(user);
        }
      } catch {
        // Fallback
      }
    }

    if (!user) {
      LoginProtectionService.recordFailedAttempt(identifier, clientIp);
      throw new Error('Invalid credentials or member account not found.');
    }

    // 3. Verify Account Status (Section 14: Restrict login for SUSPENDED / INACTIVE)
    if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
      throw new Error(`Account is ${user.status.toLowerCase()}. Access restricted. Please contact compliance.`);
    }

    // 4. Verify password with Argon2id / bcrypt
    const isMatch = await SecurityUtils.verifyPassword(user.passwordHash, dto.password);
    if (!isMatch) {
      LoginProtectionService.recordFailedAttempt(identifier, clientIp);
      throw new Error('Invalid credentials. Check username/email and password.');
    }

    // Reset failed login attempts upon successful verification
    LoginProtectionService.resetAttempts(identifier, clientIp);

    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role.toLowerCase(),
      distributorId: user.distributorId,
      memberId: user.memberId,
      status: user.status,
      isActive: user.status === 'ACTIVE',
    };

    const tokens = TokenService.generateTokenPair(authUser);

    return {
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        memberId: user.memberId,
        sponsorId: user.sponsorId || dto.sponsorId,
        role: user.role.toUpperCase(),
        status: user.status,
      },
    };
  }

  /**
   * Change password securely (Section 12)
   */
  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    await this.initSeedUsers();

    if (!userId) {
      throw new Error('User ID is required.');
    }
    if (!currentPassword || !newPassword) {
      throw new Error('Current password and new password are required.');
    }
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    const user = this.findStoredUser(userId);
    if (!user) {
      throw new Error('User not found.');
    }

    // Verify current password
    const isMatch = await SecurityUtils.verifyPassword(user.passwordHash, currentPassword);
    if (!isMatch) {
      throw new Error('Current password is incorrect.');
    }

    // Hash new password
    const newHash = await SecurityUtils.hashPassword(newPassword);
    user.passwordHash = newHash;
    this.saveStoredUser(user);

    // Update in DB if available
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });
    } catch {
      // Fallback
    }

    // Invalidate old sessions / tokens
    TokenService.revokeAllUserTokens(user.id);

    return {
      success: true,
      message: 'Password changed successfully. All previous sessions have been invalidated.',
    };
  }

  /**
   * Rotates Refresh Token and returns fresh token pair (Reuse Detection Enabled)
   */
  static async refreshToken(rawRefreshToken: string) {
    if (!rawRefreshToken) {
      throw new Error('Refresh token is required.');
    }
    return TokenService.rotateRefreshToken(rawRefreshToken);
  }

  /**
   * Dispatches a single-use password reset token with 15-minute expiry
   */
  static async forgotPassword(email: string) {
    await this.initSeedUsers();
    const cleanEmail = email.toLowerCase().trim();
    const user = this.findStoredUser(cleanEmail);

    const userId = user?.id || `user-${cleanEmail}`;
    const rawToken = TokenService.createPasswordResetToken(userId, cleanEmail);

    logger.info({ email: cleanEmail }, 'Password reset token generated with 15-minute expiry');

    return {
      message: 'If the email exists in our system, a password reset token has been dispatched.',
      resetToken: rawToken,
    };
  }

  /**
   * Resets password with Argon2id and invalidates all active sessions
   */
  static async resetPassword(token: string, newPassword: string) {
    await this.initSeedUsers();
    const verified = TokenService.verifyAndConsumeResetToken(token);
    if (!verified) {
      throw new Error('Invalid or expired password reset token.');
    }

    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    const newPasswordHash = await SecurityUtils.hashPassword(newPassword);

    const user = this.findStoredUser(verified.userId) || this.findStoredUser(verified.email);
    if (user) {
      user.passwordHash = newPasswordHash;
      this.saveStoredUser(user);
    }

    try {
      await prisma.user.update({
        where: { id: verified.userId },
        data: { passwordHash: newPasswordHash },
      });
    } catch {
      // Fallback
    }

    // Invalidate all active refresh tokens for this user upon password reset
    TokenService.revokeAllUserTokens(verified.userId);

    return {
      success: true,
      message: 'Password reset successfully. All existing sessions have been revoked for your security. Please log in with your new password.',
    };
  }

  /**
   * Retrieve sanitized current user profile
   */
  static async getMe(userId: string) {
    await this.initSeedUsers();
    const user = this.findStoredUser(userId);
    if (user) {
      return {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        memberId: user.memberId,
        distributorId: user.distributorId,
        sponsorId: user.sponsorId,
        role: user.role.toUpperCase(),
        status: user.status,
      };
    }

    return {
      id: userId,
      name: 'System User',
      username: 'user',
      email: 'user@example.com',
      role: 'DISTRIBUTOR',
      status: 'ACTIVE',
      memberId: 'KV-1001',
    };
  }

  /**
   * Change user/distributor status (Admin operation)
   */
  static async updateStatus(userIdOrMemberId: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') {
    await this.initSeedUsers();
    const user = this.findStoredUser(userIdOrMemberId);
    if (!user) {
      throw new Error(`User or Distributor ${userIdOrMemberId} not found.`);
    }

    user.status = status;
    this.saveStoredUser(user);

    try {
      await query(
        `UPDATE distributors SET status = $1 WHERE UPPER(member_id) = $2 OR id::text = $2`,
        [status, userIdOrMemberId.toUpperCase()]
      );
    } catch {
      // Fallback
    }

    return {
      id: user.id,
      memberId: user.memberId,
      status: user.status,
    };
  }
}

// Auto-initialize seed users on module load
AuthService.initSeedUsers().catch((err) => {
  logger.warn({ err }, 'Seed users async initialization notice');
});
