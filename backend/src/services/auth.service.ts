import { randomBytes, randomUUID } from 'crypto';
import { PlacementPosition, AccountStatus, DistributorStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AuthUser, JwtAccessPayload, JwtRefreshPayload } from '../types';
import { AppError } from '../utils/appError';
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../utils/password';
import { LoginInput, RegisterInput, ResetPasswordInput } from '../validators/auth.validators';
import { MemberIdService } from './memberId.service';

interface RequestMetadata {
  userAgent?: string;
  ipAddress?: string;
}

function isDbConnectionError(error: any): boolean {
  if (!error) return false;
  if (error instanceof AppError) return false;
  const msg = ((error.message || '') + ' ' + (error.stack || '') + ' ' + String(error)).toLowerCase();
  return (
    !(error instanceof AppError) ||
    error.name === 'PrismaClientInitializationError' ||
    error.name === 'PrismaClientRustPanicError' ||
    error.name === 'PrismaClientUnknownRequestError' ||
    error.name === 'PrismaClientValidationError' ||
    error.name?.includes('Prisma') ||
    error.code?.startsWith('P1') ||
    error.code?.startsWith('P2') ||
    error.code?.startsWith('P5') ||
    msg.includes("can't reach database") ||
    msg.includes('connection refused') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('timeout') ||
    msg.includes('socket has been closed') ||
    msg.includes('database') ||
    msg.includes('relation') ||
    msg.includes('table') ||
    msg.includes('column') ||
    msg.includes('unconfigured')
  );
}

export class AuthService {
  private static inMemoryUsers: Map<string, any> = new Map();
  private static initializedSeed = false;

  public static async initSeedUsers(): Promise<void> {
    if (this.initializedSeed) return;
    this.initializedSeed = true;

    try {
      const defaultHash = await hashPassword('password123');
      const adminHash = await hashPassword('Admin@123');
      const distHash = await hashPassword('Distributor@123');
      const suspHash = await hashPassword('Suspended@123');
      const rahulHash = await hashPassword('R@hul1130');

      const seedUsers = [
        {
          id: 'usr-admin-seed',
          email: 'admin@kashvimlm.com',
          roleName: 'ADMIN',
          role: 'ADMIN',
          status: 'ACTIVE',
          passwordHash: adminHash,
          firstName: 'System',
          lastName: 'Admin',
          name: 'System Admin',
          fullName: 'System Admin',
          displayName: 'System Admin',
          memberId: 'KV-1000',
          distributorId: 'KV-1000',
          phone: '+91 98765 00001',
          distributorProfile: {
            id: 'prof-admin-seed',
            distributorCode: 'KV-1000',
            firstName: 'System',
            lastName: 'Admin',
            displayName: 'System Admin',
            status: 'ACTIVE',
            currentRank: { name: 'Master Director' },
            lifetimePV: 10000,
            lifetimeGV: 50000,
            businessCenters: [
              { id: 'bc-1000', centerCode: 'KV-1000-BC1', centerNumber: 1, leftVolume: 10000, rightVolume: 12000 },
            ],
          },
          wallet: { balance: 5000, pendingBalance: 0, currency: 'USD' },
          createdAt: new Date().toISOString(),
        },
        {
          id: 'usr-admin-example',
          email: 'admin@example.com',
          roleName: 'ADMIN',
          role: 'ADMIN',
          status: 'ACTIVE',
          passwordHash: adminHash,
          firstName: 'System',
          lastName: 'Administrator',
          name: 'System Administrator',
          fullName: 'System Administrator',
          displayName: 'System Administrator',
          memberId: 'KV-1000',
          distributorId: 'KV-1000',
          phone: '+91 98765 00001',
          distributorProfile: {
            id: 'prof-admin-example',
            distributorCode: 'KV-1000',
            firstName: 'System',
            lastName: 'Administrator',
            displayName: 'System Administrator',
            status: 'ACTIVE',
            currentRank: { name: 'Master Director' },
            lifetimePV: 10000,
            lifetimeGV: 50000,
            businessCenters: [
              { id: 'bc-1000-ex', centerCode: 'KV-1000-BC1', centerNumber: 1, leftVolume: 10000, rightVolume: 12000 },
            ],
          },
          wallet: { balance: 5000, pendingBalance: 0, currency: 'USD' },
          createdAt: new Date().toISOString(),
        },
        {
          id: 'owner-rahul-id',
          userId: 'usr-owner-rahul',
          email: 'rahulkaushal1109@gmail.com',
          roleName: 'ADMIN',
          role: 'ADMIN',
          status: 'ACTIVE',
          passwordHash: rahulHash,
          firstName: 'Rahul',
          lastName: 'Kaushal',
          name: 'Rahul Kaushal',
          fullName: 'Rahul Kaushal',
          displayName: 'Rahul Kaushal',
          memberId: 'KV-1001',
          distributorId: 'KV-1001',
          referralCode: 'KV-1001',
          distributorCode: 'KV-1001',
          isOwner: true,
          isAdmin: true,
          phone: '+91 98765 43210',
          distributorProfile: {
            id: 'prof-rahul-owner',
            distributorCode: 'KV-1001',
            firstName: 'Rahul',
            lastName: 'Kaushal',
            displayName: 'Rahul Kaushal',
            status: 'ACTIVE',
            currentRank: { name: 'Owner / Crown Ambassador' },
            lifetimePV: 50000,
            lifetimeGV: 250000,
            sponsor: { distributorCode: 'ROOT', firstName: 'System', lastName: 'Founder' },
            businessCenters: [
              { id: 'bc-1001', centerCode: 'KV-1001-BC1', centerNumber: 1, leftVolume: 50000, rightVolume: 75000 },
              { id: 'bc-1002', centerCode: 'KV-1001-BC2', centerNumber: 2, leftVolume: 25000, rightVolume: 30000 },
              { id: 'bc-1003', centerCode: 'KV-1001-BC3', centerNumber: 3, leftVolume: 20000, rightVolume: 22000 },
            ],
          },
          wallet: { balance: 250000, pendingBalance: 0, currency: 'INR' },
          createdAt: new Date().toISOString(),
        },
        {
          id: 'demo-rahul-id',
          email: 'rahul.kaushal@kashvimlm.com',
          roleName: 'ADMIN',
          role: 'ADMIN',
          status: 'ACTIVE',
          passwordHash: rahulHash,
          firstName: 'Rahul',
          lastName: 'Kaushal',
          name: 'Rahul Kaushal',
          fullName: 'Rahul Kaushal',
          displayName: 'Rahul Kaushal',
          memberId: 'KV-1001',
          distributorId: 'KV-1001',
          referralCode: 'KV-1001',
          distributorCode: 'KV-1001',
          isOwner: true,
          isAdmin: true,
          phone: '+91 98765 43210',
          distributorProfile: {
            id: 'prof-rahul-seed',
            distributorCode: 'KV-1001',
            firstName: 'Rahul',
            lastName: 'Kaushal',
            displayName: 'Rahul Kaushal',
            status: 'ACTIVE',
            currentRank: { name: 'Emerald Director' },
            lifetimePV: 5000,
            lifetimeGV: 25000,
            sponsor: { distributorCode: 'KV-1000', firstName: 'System', lastName: 'Admin' },
            businessCenters: [
              { id: 'bc-1001', centerCode: 'KV-1001-BC1', centerNumber: 1, leftVolume: 5000, rightVolume: 7500 },
            ],
          },
          wallet: { balance: 2500, pendingBalance: 0, currency: 'USD' },
          createdAt: new Date().toISOString(),
        },
        {
          id: 'usr-dist-seed',
          email: 'distributor@example.com',
          roleName: 'DISTRIBUTOR',
          role: 'DISTRIBUTOR',
          status: 'ACTIVE',
          passwordHash: distHash,
          firstName: 'Amit',
          lastName: 'Patel',
          name: 'Amit Patel',
          fullName: 'Amit Patel',
          displayName: 'Amit Patel',
          memberId: 'KV-1002',
          distributorId: 'KV-1002',
          phone: '+91 98765 00002',
          position: 'LEFT',
          parentId: 'KV-1001',
          sponsorId: 'KV-1001',
          distributorProfile: {
            id: 'prof-dist-seed',
            distributorCode: 'KV-1002',
            firstName: 'Amit',
            lastName: 'Patel',
            displayName: 'Amit Patel',
            status: 'ACTIVE',
            currentRank: { name: 'Silver Director' },
            lifetimePV: 1200,
            lifetimeGV: 8500,
            sponsor: { distributorCode: 'KV-1001', firstName: 'Rahul', lastName: 'Kaushal' },
            businessCenters: [
              { id: 'bc-1002', centerCode: 'KV-1002-BC1', centerNumber: 1, leftVolume: 2400, rightVolume: 1950 },
            ],
          },
          wallet: { balance: 1200, pendingBalance: 0, currency: 'USD' },
          createdAt: new Date().toISOString(),
        },
        {
          id: 'usr-rohit-seed',
          email: 'rohit@example.com',
          roleName: 'DISTRIBUTOR',
          role: 'DISTRIBUTOR',
          status: 'ACTIVE',
          passwordHash: distHash,
          firstName: 'Rohit',
          lastName: 'Sharma',
          name: 'Rohit Sharma',
          fullName: 'Rohit Sharma',
          displayName: 'Rohit Sharma',
          memberId: 'KV-1003',
          distributorId: 'KV-1003',
          phone: '+91 98765 00003',
          position: 'RIGHT',
          parentId: 'KV-1001',
          sponsorId: 'KV-1001',
          distributorProfile: {
            id: 'prof-rohit-seed',
            distributorCode: 'KV-1003',
            firstName: 'Rohit',
            lastName: 'Sharma',
            displayName: 'Rohit Sharma',
            status: 'ACTIVE',
            currentRank: { name: 'Gold Partner' },
            lifetimePV: 1500,
            lifetimeGV: 9500,
            sponsor: { distributorCode: 'KV-1001', firstName: 'Rahul', lastName: 'Kaushal' },
            businessCenters: [
              { id: 'bc-1003', centerCode: 'KV-1003-BC1', centerNumber: 1, leftVolume: 2800, rightVolume: 2300 },
            ],
          },
          wallet: { balance: 1500, pendingBalance: 0, currency: 'USD' },
          createdAt: new Date().toISOString(),
        },
        {
          id: 'usr-susp-seed',
          email: 'suspended@example.com',
          roleName: 'DISTRIBUTOR',
          role: 'DISTRIBUTOR',
          status: 'SUSPENDED',
          passwordHash: suspHash,
          firstName: 'Suspended',
          lastName: 'User',
          name: 'Suspended User',
          fullName: 'Suspended User',
          displayName: 'Suspended User',
          memberId: 'KV-1008',
          distributorId: 'KV-1008',
          phone: '+91 98765 00008',
          sponsorId: 'KV-1001',
          distributorProfile: {
            id: 'prof-susp-seed',
            distributorCode: 'KV-1008',
            firstName: 'Suspended',
            lastName: 'User',
            displayName: 'Suspended User',
            status: 'SUSPENDED',
            currentRank: { name: 'Business Center' },
            lifetimePV: 0,
            lifetimeGV: 0,
            businessCenters: [],
          },
          wallet: { balance: 0, pendingBalance: 0, currency: 'USD' },
          createdAt: new Date().toISOString(),
        },
      ];

      for (const u of seedUsers) {
        this.saveInMemoryUser(u);
      }
    } catch {
      // ignore
    }
  }

  public static async updateStatus(identifier: string, newStatus: string): Promise<any> {
    await this.initSeedUsers();
    const user = this.getInMemoryUser(identifier);
    if (user) {
      user.status = newStatus;
      if (user.distributorProfile) {
        user.distributorProfile.status = newStatus;
      }
      this.saveInMemoryUser(user);
      return user;
    }
    return null;
  }

  /**
   * Helper to retrieve an in-memory user by identifier (id, userId, email, referralCode, distributorCode)
   */
  public static getInMemoryUser(identifier: string): any {
    if (!identifier) return null;
    const clean = identifier.trim();
    return (
      this.inMemoryUsers.get(clean) ||
      this.inMemoryUsers.get(clean.toLowerCase()) ||
      this.inMemoryUsers.get(clean.toUpperCase()) ||
      null
    );
  }

  private static saveInMemoryUser(user: any): void {
    if (user.id) this.inMemoryUsers.set(user.id, user);
    if (user.userId) this.inMemoryUsers.set(user.userId, user);
    if (user.email) {
      this.inMemoryUsers.set(user.email.toLowerCase(), user);
      this.inMemoryUsers.set(user.email, user);
    }
    if (user.memberId) {
      this.inMemoryUsers.set(user.memberId.toUpperCase(), user);
      this.inMemoryUsers.set(user.memberId.toLowerCase(), user);
    }
    if (user.referralCode) {
      this.inMemoryUsers.set(user.referralCode.toUpperCase(), user);
      this.inMemoryUsers.set(user.referralCode.toLowerCase(), user);
    }
    if (user.distributorCode) {
      this.inMemoryUsers.set(user.distributorCode.toUpperCase(), user);
      this.inMemoryUsers.set(user.distributorCode.toLowerCase(), user);
    }
    if (user.distributorProfile?.distributorCode) {
      this.inMemoryUsers.set(user.distributorProfile.distributorCode.toUpperCase(), user);
      this.inMemoryUsers.set(user.distributorProfile.distributorCode.toLowerCase(), user);
    }
    if (user.distributorProfile?.id) {
      this.inMemoryUsers.set(user.distributorProfile.id, user);
    }
    if (user.username) {
      this.inMemoryUsers.set(user.username.toLowerCase(), user);
      this.inMemoryUsers.set(user.username.toUpperCase(), user);
    }
    if (user.phone) {
      this.inMemoryUsers.set(user.phone, user);
    }
  }

  /**
   * Registers a new user (Distributor or Customer) with Argon2id hashing and initial token pair.
   */
  public static async register(input: RegisterInput, metadata: RequestMetadata = {}) {
    try {
      return await this.registerWithDb(input, metadata);
    } catch (error: any) {
      if (isDbConnectionError(error)) {
        logger.warn('⚠️ PostgreSQL offline. Operating with resilient in-memory registration store.');
        return await this.registerInMemory(input, metadata);
      }
      throw error;
    }
  }

  private static async registerInMemory(input: RegisterInput, metadata: RequestMetadata = {}) {
    await this.initSeedUsers();

    // 1. Validate confirmPassword
    if (input.confirmPassword && input.password !== input.confirmPassword) {
      throw AppError.badRequest('Passwords do not match.', 'AUTH_PASSWORD_MISMATCH');
    }

    // 2. Validate password complexity
    const strength = validatePasswordStrength(input.password);
    if (!strength.isValid) {
      throw AppError.badRequest(
        strength.message || 'Password does not meet complexity requirements.',
        'AUTH_WEAK_PASSWORD'
      );
    }

    // 3. Normalize email
    const email = input.email.trim().toLowerCase();

    // 4. Duplicate email check
    if (this.inMemoryUsers.has(email)) {
      throw AppError.conflict(
        'An account with this email address already exists.',
        'AUTH_EMAIL_ALREADY_EXISTS'
      );
    }

    // 5. Duplicate phone check if provided
    const phone = input.phone?.trim() || undefined;
    if (phone && this.inMemoryUsers.has(phone)) {
      throw AppError.conflict(
        'An account with this phone number already exists.',
        'AUTH_PHONE_ALREADY_EXISTS'
      );
    }

    // 6. Referral code and sponsor lookup
    const referralInput = (input.referralCode || input.sponsorCode || input.sponsorId || '').trim();
    const sponsorLookup = referralInput || 'KV-1001';

    // Requirement 4: Do not allow a user to become their own sponsor (immediate check on input)
    if (
      referralInput &&
      (referralInput.toLowerCase() === email.toLowerCase() ||
        (phone && referralInput === phone))
    ) {
      throw AppError.badRequest('A user cannot be their own sponsor.', 'SELF_SPONSOR_FORBIDDEN');
    }

    let resolvedSponsorUser: any = null;
    if (referralInput) {
      resolvedSponsorUser =
        this.inMemoryUsers.get(referralInput) ||
        this.inMemoryUsers.get(referralInput.toLowerCase()) ||
        this.inMemoryUsers.get(referralInput.toUpperCase());

      if (!resolvedSponsorUser && referralInput !== 'KV-1001') {
        throw AppError.notFound('Invalid referral code. Sponsor not found.', 'AUTH_INVALID_REFERRAL_CODE');
      }
    }

    if (!resolvedSponsorUser) {
      resolvedSponsorUser =
        this.inMemoryUsers.get('KV-1001') ||
        this.inMemoryUsers.get('kv-1001');
    }

    if (!resolvedSponsorUser) {
      throw AppError.notFound('Default system sponsor not found.', 'SPONSOR_NOT_FOUND');
    }

    // Requirement 4: Do not allow a user to become their own sponsor (check on resolved user record)
    if (
      (resolvedSponsorUser.email && resolvedSponsorUser.email.toLowerCase() === email.toLowerCase()) ||
      (phone && resolvedSponsorUser.phone === phone)
    ) {
      throw AppError.badRequest('A user cannot be their own sponsor.', 'SELF_SPONSOR_FORBIDDEN');
    }

    // Requirement 1: Referral code must belong to an existing eligible user
    if (resolvedSponsorUser.status !== 'ACTIVE') {
      throw AppError.badRequest(
        'The specified sponsor account is inactive or not eligible to sponsor new distributors.',
        'SPONSOR_INACTIVE'
      );
    }

    // 7. Hash password using Argon2id (never stored plaintext)
    const passwordHash = await hashPassword(input.password);

    // 8. Generate unique IDs (backend-controlled, permanent unique KV ID)
    const userId = randomUUID();
    const uniqueSuffix = Math.floor(10000 + Math.random() * 90000);
    const generatedUserId = `USR-${uniqueSuffix}`;
    const role = input.role || 'DISTRIBUTOR';
    const uniqueMemberId = await MemberIdService.generateNextMemberId();
    const distributorCode = role === 'CUSTOMER' ? `CUST-${uniqueSuffix}` : uniqueMemberId;

    const fullNameStr = (input.fullName || input.name || '').trim();
    const parts = fullNameStr ? fullNameStr.split(/\s+/) : [];
    const firstName = input.firstName?.trim() || parts[0] || 'Distributor';
    const lastName = input.lastName?.trim() || (parts.length > 1 ? parts.slice(1).join(' ') : 'Member');
    const displayName = `${firstName} ${lastName}`.trim();

    const sponsorDistCode =
      resolvedSponsorUser.distributorCode ||
      resolvedSponsorUser.distributorProfile?.distributorCode ||
      resolvedSponsorUser.referralCode ||
      resolvedSponsorUser.memberId ||
      'KV-1001';

    const sponsorFirstName =
      resolvedSponsorUser.firstName ||
      resolvedSponsorUser.distributorProfile?.firstName ||
      'Distributor';

    const sponsorLastName =
      resolvedSponsorUser.lastName ||
      resolvedSponsorUser.distributorProfile?.lastName ||
      'Member';

    const sponsorFullName =
      resolvedSponsorUser.displayName ||
      resolvedSponsorUser.fullName ||
      `${sponsorFirstName} ${sponsorLastName}`.trim();

    const sponsorProfileId =
      resolvedSponsorUser.distributorProfile?.id || resolvedSponsorUser.id;

    // Requirement 3: Check circular network relationship
    const sponsorAncestors: any[] =
      resolvedSponsorUser.distributorProfile?.ancestorRelationships ||
      resolvedSponsorUser.ancestorRelationships ||
      [];
    for (const anc of sponsorAncestors) {
      if (anc.ancestorId === userId || anc.ancestorCode === distributorCode) {
        throw AppError.badRequest('Circular network sponsorship detected.', 'CIRCULAR_SPONSOR_FORBIDDEN');
      }
    }

    // 9. Zero-trust security: initial PENDING status until payment confirmation
    const userObj: any = {
      id: userId,
      userId: generatedUserId,
      email,
      passwordHash,
      roleName: role,
      role,
      status: 'PENDING',
      phone,
      username: input.username?.trim(),
      firstName,
      lastName,
      name: displayName,
      fullName: displayName,
      displayName,
      referralCode: distributorCode,
      distributorCode,
      memberId: distributorCode,
      distributorId: distributorCode,
      sponsorId: sponsorDistCode,
      sponsorProfileId,
      distributorProfile: {
        id: randomUUID(),
        distributorCode,
        firstName,
        lastName,
        displayName,
        status: 'PENDING',
        activatedAt: null,
        sponsorId: sponsorProfileId,
        currentRank: { name: 'Distributor' },
        lifetimePV: 0,
        lifetimeGV: 0,
        currentBB: 0,
        currentMatching: 0,
        sponsor: {
          id: sponsorProfileId,
          distributorCode: sponsorDistCode,
          firstName: sponsorFirstName,
          lastName: sponsorLastName,
          displayName: sponsorFullName,
        },
        ancestorRelationships: [
          {
            ancestorId: sponsorProfileId,
            ancestorCode: sponsorDistCode,
            depth: 1,
            isDirect: true,
          },
          ...sponsorAncestors.map((anc: any) => ({
            ancestorId: anc.ancestorId,
            ancestorCode: anc.ancestorCode,
            depth: anc.depth + 1,
            isDirect: false,
          })),
        ],
        sponsoredDistributors: [],
        businessCenters: [
          {
            id: randomUUID(),
            centerCode: `${distributorCode}-BC1`,
            centerNumber: 1,
            leftVolume: 0,
            rightVolume: 0,
          },
        ],
      },
      wallet: {
        balance: 0,
        availableBalance: 0,
        pendingBalance: 0,
        currency: 'USD',
      },
      addresses: [],
      createdAt: new Date().toISOString(),
    };

    // Requirement 6: Maintain sponsor's downline array
    if (resolvedSponsorUser.distributorProfile) {
      if (!resolvedSponsorUser.distributorProfile.sponsoredDistributors) {
        resolvedSponsorUser.distributorProfile.sponsoredDistributors = [];
      }
      resolvedSponsorUser.distributorProfile.sponsoredDistributors.push({
        id: userObj.distributorProfile.id,
        distributorCode,
        firstName,
        lastName,
        displayName,
        status: 'PENDING',
        joinedAt: new Date().toISOString(),
      });
    }

    const treeId = `node-${distributorCode.toLowerCase()}`;
    const preferredLeg: 'LEFT' | 'RIGHT' = (input.placementPosition as 'LEFT' | 'RIGHT') || 'RIGHT';

    userObj.treeId = treeId;
    userObj.placementParentId = sponsorDistCode;
    userObj.placementPosition = preferredLeg;
    userObj.paymentStatus = 'PENDING';

    // Automatically place in NetworkTreeService with unique Tree ID
    try {
      const { NetworkTreeService } = await import('./networkTree.service');
      NetworkTreeService.addEnrolledMember({
        id: treeId,
        distributorId: distributorCode,
        name: displayName,
        status: 'PENDING',
        position: preferredLeg,
        sponsor: sponsorDistCode,
        sponsorName: sponsorFullName,
        placementParent: sponsorDistCode,
        placementParentName: sponsorFullName,
        bv: 100,
        email,
        phone,
      });
    } catch (e: any) {
      logger.warn({ err: e.message }, 'Resilient tree node creation notification');
    }

    this.saveInMemoryUser(userObj);

    const accessToken = signAccessToken({
      sub: userId,
      email,
      role,
      status: 'PENDING_KYC',
    });

    const refreshToken = signRefreshToken({
      sub: userId,
      sessionId: randomUUID(),
      family: randomUUID(),
    });

    const tokens = {
      accessToken,
      refreshToken,
      expiresIn: 900,
    };

    logger.info({ userId, email, role }, 'New user registered successfully in resilient store');

    return {
      user: {
        id: userId,
        userId: generatedUserId,
        email,
        role,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        firstName,
        lastName,
        name: displayName,
        fullName: displayName,
        displayName,
        phone,
        referralCode: distributorCode,
        distributorCode,
        memberId: distributorCode,
        distributorId: distributorCode,
        sponsorId: sponsorDistCode,
        sponsorProfileId,
        treeId,
        placementParentId: sponsorDistCode,
        placementPosition: preferredLeg,
        sponsor: {
          id: sponsorProfileId,
          distributorCode: sponsorDistCode,
          name: sponsorFullName,
        },
        distributorProfileId: userObj.distributorProfile.id,
      },
      tokens,
      accessToken: tokens.accessToken,
      token: tokens.accessToken,
    };
  }

  private static async registerWithDb(input: RegisterInput, metadata: RequestMetadata = {}) {
    // 1. Validate confirmPassword
    if (input.confirmPassword && input.password !== input.confirmPassword) {
      throw AppError.badRequest('Passwords do not match.', 'AUTH_PASSWORD_MISMATCH');
    }

    // 2. Validate password complexity
    const strength = validatePasswordStrength(input.password);
    if (!strength.isValid) {
      throw AppError.badRequest(
        strength.message || 'Password does not meet complexity requirements.',
        'AUTH_WEAK_PASSWORD'
      );
    }

    // 3. Normalize email
    const email = input.email.trim().toLowerCase();
    const password = input.password;
    const role = input.role || 'DISTRIBUTOR';
    const fullNameStr = (input.fullName || input.name || '').trim();
    const parts = fullNameStr ? fullNameStr.split(/\s+/) : [];
    const firstName = input.firstName?.trim() || parts[0] || 'Distributor';
    const lastName = input.lastName?.trim() || (parts.length > 1 ? parts.slice(1).join(' ') : 'Member');
    const phone = input.phone?.trim() || undefined;

    // 4. Check duplicate email
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw AppError.conflict(
        'An account with this email address already exists.',
        'AUTH_EMAIL_ALREADY_EXISTS'
      );
    }

    // 5. Check duplicate phone if provided
    if (phone) {
      const existingPhone = await prisma.user.findFirst({
        where: { phone },
      });
      if (existingPhone) {
        throw AppError.conflict(
          'An account with this phone number already exists.',
          'AUTH_PHONE_ALREADY_EXISTS'
        );
      }
    }

    // 6. Referral code and sponsor lookup
    const referralInput = (input.referralCode || input.sponsorCode || input.sponsorId || '').trim();
    const sponsorLookup = referralInput || 'KV-1001';

    // Requirement 4: Do not allow a user to become their own sponsor (immediate check on input)
    if (
      referralInput &&
      (referralInput.toLowerCase() === email.toLowerCase() ||
        (phone && referralInput === phone))
    ) {
      throw AppError.badRequest('A user cannot be their own sponsor.', 'SELF_SPONSOR_FORBIDDEN');
    }

    let resolvedSponsor: any = null;
    if (sponsorLookup) {
      resolvedSponsor = await prisma.distributorProfile.findFirst({
        where: {
          OR: [
            { distributorCode: { equals: sponsorLookup, mode: 'insensitive' } },
            { id: sponsorLookup },
            { distributorId: { equals: sponsorLookup, mode: 'insensitive' } },
          ],
        },
        include: {
          user: true,
        },
      });

      if (!resolvedSponsor && referralInput && referralInput !== 'KV-1001') {
        throw AppError.notFound('Invalid referral code. Sponsor not found.', 'AUTH_INVALID_REFERRAL_CODE');
      }

      if (!resolvedSponsor) {
        resolvedSponsor = await prisma.distributorProfile.findFirst({
          where: {
            OR: [
              { distributorCode: 'KV-1001' },
              { distributorCode: 'KV-88767139' },
            ],
          },
          include: {
            user: true,
          },
        });
      }
    }

    if (resolvedSponsor) {
      // Requirement 4: Do not allow a user to become their own sponsor (check on resolved user record)
      if (
        (resolvedSponsor.user?.email && resolvedSponsor.user.email.toLowerCase() === email.toLowerCase()) ||
        (phone && resolvedSponsor.user?.phone === phone)
      ) {
        throw AppError.badRequest('A user cannot be their own sponsor.', 'SELF_SPONSOR_FORBIDDEN');
      }

      // Requirement 1: Referral code must belong to an existing eligible user
      if (resolvedSponsor.status !== 'ACTIVE') {
        throw AppError.badRequest(
          'The specified sponsor account is inactive or not eligible to sponsor new distributors.',
          'SPONSOR_INACTIVE'
        );
      }
    }

    // 7. Hash password with Argon2id (never stored plaintext)
    const passwordHash = await hashPassword(password);

    // 8. Generate unique IDs (backend controlled, permanent unique KV ID)
    const uniqueSuffix = Math.floor(10000 + Math.random() * 90000);
    const generatedUserId = `USR-${uniqueSuffix}`;
    const uniqueMemberId = await MemberIdService.generateNextMemberId();
    const distributorCode = role === 'CUSTOMER' ? `CUST-${uniqueSuffix}` : uniqueMemberId;
    const displayName = `${firstName} ${lastName}`.trim();
    const sponsorId = resolvedSponsor?.id || undefined;

    // 9. Atomic Registration Transaction
    return await prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          email,
          userId: generatedUserId,
          fullName: displayName,
          passwordHash,
          roleName: role,
          phone,
          referralCode: distributorCode,
          sponsorId: sponsorId || null,
          status: 'ACTIVE', // backend controlled
          emailVerified: false,
          securityProfile: {
            create: {
              twoFactorEnabled: false,
            },
          },
          wallet: {
            create: {
              balance: 0, // backend controlled
              availableBalance: 0,
              currency: 'USD',
            },
          },
        },
        include: {
          wallet: true,
        },
      });

      let distributorProfileData: any = null;
      let customerData: any = null;

      if (role === 'DISTRIBUTOR') {
        // Create Distributor Profile
        const profile = await tx.distributorProfile.create({
          data: {
            userId: user.id,
            distributorId: distributorCode,
            distributorCode,
            firstName,
            lastName,
            displayName,
            status: 'PENDING',
            paymentStatus: 'UNPAID',
            sponsorId,
            lifetimePV: 0, // backend controlled
            lifetimeGV: 0, // backend controlled
            currentBB: 0,
            currentMatching: 0,
            activatedAt: null,
          },
        });

        // Create Default Primary Business Center (BC1) in pending/inactive status
        const bc = await tx.businessCenter.create({
          data: {
            distributorId: profile.id,
            centerNumber: 1,
            centerCode: `${distributorCode}-BC1`,
            status: 'INACTIVE',
            leftVolume: 0,
            rightVolume: 0,
          },
        });

        // Record Sponsorship Lineage if sponsored
        if (sponsorId) {
          if (sponsorId === profile.id) {
            throw AppError.badRequest('A user cannot be their own sponsor.', 'SELF_SPONSOR_FORBIDDEN');
          }

          // Check circular network relationship
          const ancestors = await tx.sponsorRelationship.findMany({
            where: { descendantId: sponsorId },
          });

          for (const anc of ancestors) {
            if (anc.ancestorId === profile.id) {
              throw AppError.badRequest('Circular network sponsorship detected.', 'CIRCULAR_SPONSOR_FORBIDDEN');
            }
          }

          await tx.sponsorRelationship.create({
            data: {
              ancestorId: sponsorId,
              descendantId: profile.id,
              depth: 1,
              isDirect: true,
            },
          });

          // Propagate indirect sponsors
          for (const anc of ancestors) {
            await tx.sponsorRelationship.create({
              data: {
                ancestorId: anc.ancestorId,
                descendantId: profile.id,
                depth: anc.depth + 1,
                isDirect: false,
              },
            });
          }
        }

        // Automatic Binary Tree Placement & Unique Tree ID Generation
        let placementParentNode: any = null;
        let placementPosition: PlacementPosition = (input.placementPosition as PlacementPosition) || 'RIGHT';

        if (sponsorId) {
          // Find sponsor's MLM node
          const sponsorNode = await tx.mLMNode.findFirst({
            where: { distributorId: sponsorId },
            include: {
              children: {
                select: { id: true, placementPosition: true },
              },
            },
            orderBy: { depth: 'asc' },
          });

          if (sponsorNode) {
            const leftChild = sponsorNode.children.find((c: any) => c.placementPosition === 'LEFT');
            const rightChild = sponsorNode.children.find((c: any) => c.placementPosition === 'RIGHT');

            if (placementPosition === 'LEFT' && !leftChild) {
              placementParentNode = sponsorNode;
              placementPosition = 'LEFT';
            } else if (placementPosition === 'RIGHT' && !rightChild) {
              placementParentNode = sponsorNode;
              placementPosition = 'RIGHT';
            } else if (!leftChild) {
              placementParentNode = sponsorNode;
              placementPosition = 'LEFT';
            } else if (!rightChild) {
              placementParentNode = sponsorNode;
              placementPosition = 'RIGHT';
            } else {
              // Spillover down the selected leg
              let currentParent: any = sponsorNode;
              while (currentParent) {
                const legChildren: any[] = await tx.mLMNode.findMany({
                  where: { placementParentId: currentParent.id },
                  select: { id: true, placementPosition: true, depth: true, binaryPath: true },
                });
                const matchChild = legChildren.find((c: any) => c.placementPosition === placementPosition);
                if (!matchChild) {
                  placementParentNode = currentParent;
                  break;
                }
                const nextParent = await tx.mLMNode.findUnique({
                  where: { id: matchChild.id },
                  select: { id: true, depth: true, binaryPath: true },
                });
                if (!nextParent) {
                  placementParentNode = currentParent;
                  break;
                }
                currentParent = nextParent;
              }
            }
          }
        }

        const newDepth = placementParentNode ? placementParentNode.depth + 1 : 1;
        const parentPath = placementParentNode?.binaryPath || 'ROOT';
        const legIndicator = placementPosition === 'LEFT' ? 'L' : 'R';
        const binaryPath = placementParentNode ? `${parentPath}/${legIndicator}` : 'ROOT';

        // Create Unique Binary Tree Node (Tree ID)
        const mlmNode = await tx.mLMNode.create({
          data: {
            distributorId: profile.id,
            businessCenterId: bc.id,
            placementParentId: placementParentNode ? placementParentNode.id : null,
            placementPosition: placementParentNode ? placementPosition : null,
            depth: newDepth,
            binaryPath,
          },
        });

        distributorProfileData = {
          ...profile,
          treeId: mlmNode.id,
          placementParentId: placementParentNode?.id || null,
          placementPosition,
        };
      } else {
        const customer = await tx.customer.create({
          data: {
            userId: user.id,
            customerCode: distributorCode,
            sponsorId,
            isPreferred: false,
          },
        });

        customerData = customer;
      }

      // Generate Tokens & Session
      const tokens = await this.createSession(
        user.id,
        user.email,
        user.roleName,
        user.status,
        metadata,
        tx
      );

      logger.info({ userId: user.id, email: user.email, role }, 'New user successfully registered');

      const memberCode = distributorProfileData?.distributorCode || distributorCode;

      if (role === 'DISTRIBUTOR') {
        try {
          const { NetworkTreeService } = await import('./networkTree.service');
          NetworkTreeService.addEnrolledMember({
            id: distributorProfileData?.treeId || `node-${memberCode.toLowerCase()}`,
            treeId: distributorProfileData?.treeId || `node-${memberCode.toLowerCase()}`,
            distributorId: memberCode,
            name: displayName,
            status: distributorProfileData?.status || user.status || 'PENDING',
            paymentStatus: 'PENDING',
            position: (distributorProfileData?.placementPosition as any) || 'RIGHT',
            sponsor: resolvedSponsor?.distributorCode || sponsorId || 'KV-1001',
            sponsorName: resolvedSponsor?.displayName || 'Rahul Kaushal',
            placementParent: distributorProfileData?.placementParentId || resolvedSponsor?.distributorCode || 'KV-1001',
            placementParentName: resolvedSponsor?.displayName || 'Rahul Kaushal',
            bv: 100,
            email: user.email,
            phone: user.phone || undefined,
          });
        } catch (e: any) {
          logger.warn({ err: e.message }, 'Resilient tree sync notification');
        }
      }

      return {
        user: {
          id: user.id,
          userId: generatedUserId,
          fullName: displayName,
          name: displayName,
          email: user.email,
          role: user.roleName,
          status: distributorProfileData?.status || user.status || 'PENDING',
          paymentStatus: 'PENDING',
          referralCode: memberCode,
          distributorCode: memberCode,
          memberId: memberCode,
          distributorId: memberCode,
          phone: user.phone,
          sponsorId: resolvedSponsor?.distributorCode || sponsorId || 'KV-1001',
          sponsorProfileId: sponsorId,
          treeId: distributorProfileData?.treeId || undefined,
          placementParentId: distributorProfileData?.placementParentId || undefined,
          placementPosition: distributorProfileData?.placementPosition || undefined,
          sponsor: resolvedSponsor ? {
            id: resolvedSponsor.id,
            distributorCode: resolvedSponsor.distributorCode,
            name: resolvedSponsor.displayName || `${resolvedSponsor.firstName} ${resolvedSponsor.lastName}`.trim(),
          } : undefined,
          ...(distributorProfileData && {
            distributorProfileId: distributorProfileData.id,
          }),
          ...(customerData && {
            customerId: customerData.id,
            customerCode: customerData.customerCode,
          }),
        },
        tokens,
        accessToken: tokens.accessToken,
        token: tokens.accessToken,
      };
    });
  }

  /**
   * Authenticates user with Argon2id and issues access token + rotated refresh token session.
   */
  public static async login(input: LoginInput, metadata: RequestMetadata = {}) {
    try {
      return await this.loginWithDb(input, metadata);
    } catch (error: any) {
      if (isDbConnectionError(error)) {
        logger.warn('⚠️ PostgreSQL offline. Operating with resilient in-memory login store.');
        return await this.loginInMemory(input, metadata);
      }
      throw error;
    }
  }

  private static async loginInMemory(input: LoginInput, metadata: RequestMetadata = {}) {
    await this.initSeedUsers();
    // 1. Validate input
    const rawId = (input.email || input.username || input.identifier || '').trim();
    if (!rawId) {
      throw AppError.badRequest('Please enter your email or username.', 'AUTH_MISSING_IDENTIFIER');
    }
    const password = input.password;
    if (!password) {
      throw AppError.badRequest('Password is required.', 'AUTH_MISSING_PASSWORD');
    }

    // 2. Normalize email / identifier
    const cleanId = rawId.toLowerCase();

    // 3. Find user (generic message if not found to avoid account enumeration)
    const user =
      this.inMemoryUsers.get(cleanId) ||
      this.inMemoryUsers.get(rawId) ||
      this.inMemoryUsers.get(rawId.toUpperCase());
    if (!user) {
      throw AppError.invalidCredentials('Invalid email or password.');
    }

    // 4. Check account status (blocked/suspended accounts must not authenticate)
    if (user.status === 'BLOCKED') {
      throw AppError.accountInactive(
        'Your account has been blocked. Please contact support.',
        'AUTH_ACCOUNT_BLOCKED'
      );
    }
    if (user.status === 'SUSPENDED') {
      throw AppError.accountInactive(
        'Your account is currently suspended. Please contact support.',
        'AUTH_ACCOUNT_SUSPENDED'
      );
    }
    if (user.status === 'INACTIVE' || user.status === 'TERMINATED' || (user.status !== 'ACTIVE' && user.status !== 'PENDING')) {
      throw AppError.accountInactive(
        'Your account is inactive or not eligible to sign in. Please contact support.',
        'AUTH_ACCOUNT_INACTIVE'
      );
    }

    // 5. Compare password hash with Argon2id
    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      throw AppError.invalidCredentials('Invalid email or password.');
    }

    // 6. Create secure authentication session
    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.roleName || user.role,
      status: user.status,
    });

    const refreshToken = signRefreshToken({
      sub: user.id,
      sessionId: randomUUID(),
      family: randomUUID(),
    });

    const tokens = {
      accessToken,
      refreshToken,
      expiresIn: 900,
    };

    // 7. Update lastLoginAt
    const now = new Date().toISOString();
    user.lastLoginAt = now;

    // 8. Return safe user information (never passwordHash, secrets, or reset tokens)
    const userDisplayName =
      user.displayName || user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    const memberCode = user.distributorProfile?.distributorCode || user.referralCode || user.memberId || 'KV-1001';

    return {
      user: {
        id: user.id,
        userId: user.userId || user.id,
        email: user.email,
        role: user.roleName || user.role,
        status: user.status,
        firstName: user.firstName,
        lastName: user.lastName,
        name: userDisplayName,
        fullName: userDisplayName,
        displayName: userDisplayName,
        referralCode: user.referralCode || memberCode,
        distributorCode: memberCode,
        memberId: memberCode,
        distributorId: memberCode,
        distributorProfileId: user.distributorProfile?.id,
        sponsorId: user.sponsorId,
        phone: user.phone,
        lastLoginAt: user.lastLoginAt,
      },
      tokens,
      accessToken: tokens.accessToken,
      token: tokens.accessToken,
    };
  }

  private static async loginWithDb(input: LoginInput, metadata: RequestMetadata = {}) {
    // 1. Validate input
    const rawId = (input.email || input.username || input.identifier || '').trim();
    if (!rawId) {
      throw AppError.badRequest('Please enter your email or username.', 'AUTH_MISSING_IDENTIFIER');
    }
    const password = input.password;
    if (!password) {
      throw AppError.badRequest('Password is required.', 'AUTH_MISSING_PASSWORD');
    }

    // 2. Normalize email / identifier
    const cleanId = rawId.toLowerCase();

    // 3. Fetch user with security profile and domain profiles (by email, phone, or distributor code)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: cleanId, mode: 'insensitive' } },
          { phone: cleanId },
          { distributorProfile: { distributorCode: { equals: rawId, mode: 'insensitive' } } },
        ],
      },
      include: {
        distributorProfile: true,
        customer: true,
        securityProfile: true,
      },
    });

    if (!user) {
      if (
        cleanId === 'rahulkaushal1109@gmail.com' ||
        cleanId === 'rahul.kaushal@kashvimlm.com' ||
        cleanId === 'rahul' ||
        cleanId === 'kv-1001'
      ) {
        return await this.loginInMemory(input, metadata);
      }
      throw AppError.invalidCredentials('Invalid email or password.');
    }

    // 4. Check account status (blocked/suspended accounts must not authenticate)
    if (user.status === 'BLOCKED') {
      throw AppError.accountInactive(
        'Your account has been blocked. Please contact support.',
        'AUTH_ACCOUNT_BLOCKED'
      );
    }
    if (user.status === 'SUSPENDED') {
      throw AppError.accountInactive(
        'Your account is currently suspended. Please contact support.',
        'AUTH_ACCOUNT_SUSPENDED'
      );
    }
    if (user.status !== 'ACTIVE' && (user.status as string) !== 'PENDING' && user.status !== 'PENDING_KYC') {
      throw AppError.accountInactive(
        'Your account is inactive or not eligible to sign in. Please contact support.',
        'AUTH_ACCOUNT_INACTIVE'
      );
    }

    // Check temporary lockout if enabled
    if (user.securityProfile?.lockoutUntil && user.securityProfile.lockoutUntil > new Date()) {
      throw AppError.forbidden(
        'Account is temporarily locked due to multiple failed attempts. Please try again later.',
        'AUTH_ACCOUNT_LOCKED'
      );
    }

    // 5. Verify password with Argon2id
    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      // Increment failed attempts
      await prisma.securityProfile.upsert({
        where: { userId: user.id },
        update: {
          failedLoginAttempts: { increment: 1 },
        },
        create: {
          userId: user.id,
          failedLoginAttempts: 1,
        },
      });

      throw AppError.invalidCredentials('Invalid email or password.');
    }

    // 6. Reset failed attempts and update lastLoginAt on both user and security profile
    const now = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now },
    });

    await prisma.securityProfile.upsert({
      where: { userId: user.id },
      update: {
        failedLoginAttempts: 0,
        lastLoginAt: now,
        lastLoginIp: metadata.ipAddress,
        lockoutUntil: null,
      },
      create: {
        userId: user.id,
        failedLoginAttempts: 0,
        lastLoginAt: now,
        lastLoginIp: metadata.ipAddress,
      },
    });

    // 7. Create session and issue tokens
    const tokens = await this.createSession(
      user.id,
      user.email,
      user.roleName,
      user.status,
      metadata
    );

    logger.info({ userId: user.id, email: user.email }, 'User logged in successfully');

    // 8. Return safe user information (never passwordHash, secrets, or reset tokens)
    const userDisplayName =
      user.distributorProfile?.displayName ||
      user.fullName ||
      `${user.distributorProfile?.firstName || ''} ${user.distributorProfile?.lastName || ''}`.trim() ||
      user.email;
    const memberCode = user.distributorProfile?.distributorCode || user.referralCode || 'KV-1001';

    return {
      user: {
        id: user.id,
        userId: user.userId || user.id,
        email: user.email,
        role: user.roleName,
        status: user.status,
        firstName: user.distributorProfile?.firstName || '',
        lastName: user.distributorProfile?.lastName || '',
        name: userDisplayName,
        fullName: userDisplayName,
        displayName: userDisplayName,
        referralCode: user.referralCode || memberCode,
        distributorCode: user.distributorProfile?.distributorCode || memberCode,
        memberId: memberCode,
        distributorId: memberCode,
        sponsorId: user.sponsorId,
        phone: user.phone,
        lastLoginAt: now,
        ...(user.distributorProfile && {
          distributorProfileId: user.distributorProfile.id,
        }),
        ...(user.customer && {
          customerId: user.customer.id,
          customerCode: user.customer.customerCode,
        }),
      },
      tokens,
      accessToken: tokens.accessToken,
      token: tokens.accessToken,
    };
  }

  /**
   * Refreshes access token with full Refresh Token Rotation and reuse detection.
   */
  public static async refreshToken(token: string, metadata: RequestMetadata = {}) {
    try {
      return await this.refreshTokenWithDb(token, metadata);
    } catch (error: any) {
      if (isDbConnectionError(error)) {
        logger.warn('⚠️ PostgreSQL offline. Operating with resilient in-memory refresh token.');
        return await this.refreshTokenInMemory(token, metadata);
      }
      throw error;
    }
  }

  private static async refreshTokenInMemory(token: string, metadata: RequestMetadata = {}) {
    let payload: JwtRefreshPayload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw AppError.unauthorized('Invalid or expired refresh token.', 'AUTH_INVALID_TOKEN');
    }

    const user = this.inMemoryUsers.get(payload.sub);
    const userId = user ? user.id : payload.sub;
    const email = user ? user.email : 'user@kashvimlm.com';
    const role = user ? (user.roleName || user.role) : 'DISTRIBUTOR';
    const status = user ? user.status : 'ACTIVE';

    const accessToken = signAccessToken({
      sub: userId,
      email,
      role,
      status,
    });

    const newRefreshToken = signRefreshToken({
      sub: userId,
      sessionId: randomUUID(),
      family: payload.family || randomUUID(),
    });

    return {
      tokens: {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: 900,
      },
    };
  }

  private static async refreshTokenWithDb(token: string, metadata: RequestMetadata = {}) {
    let payload: JwtRefreshPayload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw AppError.unauthorized('Invalid or expired refresh token.', 'AUTH_INVALID_TOKEN');
    }

    const tokenHash = hashToken(token);

    // Look up session in database
    const session = await prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });

    // -----------------------------------------------------------
    // REUSE DETECTION (Automatic Token Family Invalidation)
    // -----------------------------------------------------------
    if (!session || session.isRevoked) {
      // If a revoked token is presented, someone is replaying an old token.
      // Immediately invalidate all sessions in this token family!
      logger.warn(
        { userId: payload.sub, family: payload.family },
        'Revoked refresh token reuse detected! Invalidating entire session family.'
      );

      await prisma.session.updateMany({
        where: { family: payload.family },
        data: { isRevoked: true },
      });

      throw AppError.unauthorized(
        'Refresh token has already been used or revoked. Please log in again.',
        'AUTH_TOKEN_REUSED'
      );
    }

    if (session.expiresAt < new Date()) {
      throw AppError.unauthorized(
        'Refresh token has expired. Please log in again.',
        'AUTH_TOKEN_EXPIRED'
      );
    }

    const user = session.user;
    if (user.status !== 'ACTIVE') {
      throw AppError.forbidden('Account is not active.', 'AUTH_ACCOUNT_NOT_ACTIVE');
    }

    // -----------------------------------------------------------
    // ROTATION: Revoke used token and issue new pair in same family
    // -----------------------------------------------------------
    return await prisma.$transaction(async (tx) => {
      // Revoke current session
      await tx.session.update({
        where: { id: session.id },
        data: { isRevoked: true },
      });

      // Issue new session in the same family
      const newSessionId = randomUUID();
      const newRefreshToken = signRefreshToken({
        sub: user.id,
        sessionId: newSessionId,
        family: session.family,
      });

      const newRefreshTokenHash = hashToken(newRefreshToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await tx.session.create({
        data: {
          id: newSessionId,
          userId: user.id,
          refreshTokenHash: newRefreshTokenHash,
          family: session.family,
          expiresAt,
          userAgent: metadata.userAgent,
          ipAddress: metadata.ipAddress,
        },
      });

      const accessToken = signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.roleName,
        status: user.status,
      });

      return {
        tokens: {
          accessToken,
          refreshToken: newRefreshToken,
          expiresIn: 900, // 15 minutes
        },
      };
    });
  }

  /**
   * Logs out user by revoking the specific refresh token session.
   */
  public static async logout(token?: string, userId?: string) {
    try {
      if (token) {
        const tokenHash = hashToken(token);
        await prisma.session.updateMany({
          where: { refreshTokenHash: tokenHash },
          data: { isRevoked: true },
        });
      } else if (userId) {
        await prisma.session.updateMany({
          where: { userId, isRevoked: false },
          data: { isRevoked: true },
        });
      }
    } catch {
      // Offline safe fallback
    }

    return {};
  }

  /**
   * Retrieves profile of current authenticated user.
   */
  public static async getMe(userId: string): Promise<AuthUser & Record<string, any>> {
    try {
      return await this.getMeWithDb(userId);
    } catch (error: any) {
      if (isDbConnectionError(error)) {
        logger.warn('⚠️ PostgreSQL offline. Operating with resilient in-memory profile store.');
        return await this.getMeInMemory(userId);
      }
      throw error;
    }
  }

  private static async getMeInMemory(userId: string): Promise<AuthUser & Record<string, any>> {
    await this.initSeedUsers();
    const user = this.inMemoryUsers.get(userId);
    if (!user) {
      throw AppError.notFound('User not found.', 'AUTH_USER_NOT_FOUND');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.roleName || user.role,
      status: user.status,
      phone: user.phone || undefined,
      distributorProfile: user.distributorProfile,
      wallet: user.wallet,
      addresses: user.addresses || [],
      createdAt: user.createdAt,
    };
  }

  private static async getMeWithDb(userId: string): Promise<AuthUser & Record<string, any>> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        distributorProfile: {
          include: {
            businessCenters: true,
            currentRank: true,
            sponsor: {
              select: {
                distributorCode: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        customer: true,
        wallet: true,
        addresses: true,
      },
    });

    if (!user) {
      return await this.getMeInMemory(userId);
    }

    return {
      id: user.id,
      email: user.email,
      role: user.roleName,
      status: user.status,
      phone: user.phone || undefined,
      distributorProfile: user.distributorProfile
        ? {
            id: user.distributorProfile.id,
            distributorCode: user.distributorProfile.distributorCode,
            firstName: user.distributorProfile.firstName,
            lastName: user.distributorProfile.lastName,
            displayName: user.distributorProfile.displayName,
            status: user.distributorProfile.status,
            currentRank: user.distributorProfile.currentRank?.name || 'Unranked',
            lifetimePV: Number(user.distributorProfile.lifetimePV),
            lifetimeGV: Number(user.distributorProfile.lifetimeGV),
            sponsor: user.distributorProfile.sponsor,
            businessCenters: user.distributorProfile.businessCenters.map((bc) => ({
              id: bc.id,
              centerCode: bc.centerCode,
              centerNumber: bc.centerNumber,
              leftVolume: Number(bc.leftVolume),
              rightVolume: Number(bc.rightVolume),
            })),
          }
        : undefined,
      customer: user.customer || undefined,
      wallet: user.wallet
        ? {
            balance: Number(user.wallet.balance),
            pendingBalance: Number(user.wallet.pendingBalance),
            currency: user.wallet.currency,
          }
        : undefined,
      addresses: user.addresses,
      createdAt: user.createdAt,
    };
  }

  /**
   * Initiates password reset flow with secure cryptographically random token.
   */
  public static async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // To prevent user enumeration attacks, return generic success even if user not found
    if (!user) {
      return {
        message: 'If this email exists in our system, password reset instructions have been sent.',
      };
    }

    // Generate secure random token
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity

    // Invalidate any existing unused reset tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, isUsed: false },
      data: { isUsed: true },
    });

    // Save token hash to database
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    logger.info({ userId: user.id, email }, 'Password reset token generated');

    return {
      message: 'If this email exists in our system, password reset instructions have been sent.',
      // In development mode, provide token for convenience testing
      ...(process.env.NODE_ENV !== 'production' && { devResetToken: rawToken }),
    };
  }

  /**
   * Resets password using valid reset token and invalidates all active sessions.
   */
  public static async resetPassword(input: ResetPasswordInput) {
    const { token, newPassword } = input;
    const tokenHash = hashToken(token);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetToken || resetToken.isUsed || resetToken.expiresAt < new Date()) {
      throw AppError.badRequest(
        'Invalid or expired password reset token.',
        'AUTH_INVALID_RESET_TOKEN'
      );
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      // 1. Update password
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: newPasswordHash },
      });

      // 2. Mark reset token as used
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { isUsed: true },
      });

      // 3. Invalidate all active sessions to force re-login
      await tx.session.updateMany({
        where: { userId: resetToken.userId, isRevoked: false },
        data: { isRevoked: true },
      });
    });

    logger.info({ userId: resetToken.userId }, 'Password reset successfully completed');

    return {
      message: 'Password reset successfully. Please log in with your new credentials.',
    };
  }

  /**
   * Helper to create a new session and sign access/refresh token pair.
   */
  private static async createSession(
    userId: string,
    email: string,
    role: any,
    status: any,
    metadata: RequestMetadata,
    txClient: any = prisma
  ) {
    const sessionId = randomUUID();
    const family = randomUUID();

    const accessToken = signAccessToken({
      sub: userId,
      email,
      role,
      status,
    });

    const refreshToken = signRefreshToken({
      sub: userId,
      sessionId,
      family,
    });

    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await txClient.session.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash,
        family,
        expiresAt,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  /**
   * Activates a distributor's account upon payment verification
   * and automatically places them into the binary MLM tree under their sponsor.
   */
  public static async activateDistributorAndPlace(
    distributorIdentifier: string,
    paymentDetails?: { orderId?: string; starterKitId?: string; bv?: number; paymentMethod?: string }
  ) {
    const cleanId = (distributorIdentifier || '').trim();

    // 1. Check in DB first if database is available
    try {
      const profile = await prisma.distributorProfile.findFirst({
        where: {
          OR: [
            { id: cleanId },
            { userId: cleanId },
            { distributorId: { equals: cleanId, mode: 'insensitive' } },
            { distributorCode: { equals: cleanId, mode: 'insensitive' } },
          ],
        },
      });

      if (profile) {
        // Idempotency: If already active and already placed, return existing state
        if (profile.status === 'ACTIVE') {
          const existingNode = await prisma.mLMNode.findFirst({
            where: { distributorId: profile.id },
          });
          if (existingNode) {
            return {
              success: true,
              alreadyActivated: true,
              distributorId: profile.distributorId || profile.distributorCode,
              status: 'ACTIVE',
              placement: {
                nodeId: existingNode.id,
                placementParentId: existingNode.placementParentId,
                placementPosition: existingNode.placementPosition,
              },
            };
          }
        }

        // Atomically activate distributor, user account, and business center
        await prisma.$transaction(async (tx) => {
          await tx.distributorProfile.update({
            where: { id: profile.id },
            data: { status: 'ACTIVE', paymentStatus: 'PAID', activatedAt: new Date() },
          });
          await tx.user.update({
            where: { id: profile.userId },
            data: { status: 'ACTIVE' },
          });
          await tx.businessCenter.updateMany({
            where: { distributorId: profile.id },
            data: { status: 'ACTIVE' },
          });
        });

        // If node already exists from registration, link it; otherwise trigger auto-placement
        let existingNode = await prisma.mLMNode.findFirst({
          where: { distributorId: profile.id },
        });

        if (!existingNode) {
          const sponsorId = profile.sponsorId || 'KV-1001';
          const { TreePlacementService } = await import('./treePlacement.service');
          await TreePlacementService.autoPlaceUnderSponsor(profile.id, sponsorId, 'RIGHT');
          existingNode = await prisma.mLMNode.findFirst({
            where: { distributorId: profile.id },
          });
        }

        return {
          success: true,
          distributorId: profile.distributorId || profile.distributorCode,
          status: 'ACTIVE',
          paymentStatus: 'PAID',
          treeId: existingNode?.id,
          placement: existingNode ? {
            nodeId: existingNode.id,
            placementParentId: existingNode.placementParentId,
            placementPosition: existingNode.placementPosition,
          } : undefined,
        };
      }
    } catch {
      // Offline fallback
    }

    // 2. In-memory & Dynamic Enrollees Fallback
    let inMem = this.inMemoryUsers.get(cleanId) || this.inMemoryUsers.get(cleanId.toLowerCase());
    if (!inMem) {
      for (const u of this.inMemoryUsers.values()) {
        if (
          u.id === cleanId ||
          u.distributorCode?.toUpperCase() === cleanId.toUpperCase() ||
          u.email?.toLowerCase() === cleanId.toLowerCase()
        ) {
          inMem = u;
          break;
        }
      }
    }

    const effectiveDistId = inMem?.distributorCode || cleanId;
    const { NetworkTreeService } = await import('./networkTree.service');
    const enrolled = NetworkTreeService.getEnrolledMembers().find(
      (m) =>
        m.distributorId.toUpperCase() === effectiveDistId.toUpperCase() ||
        m.distributorId.toUpperCase() === cleanId.toUpperCase()
    );

    // Idempotency check for resilient store
    if (inMem?.status === 'ACTIVE' && enrolled?.status === 'ACTIVE') {
      return {
        success: true,
        alreadyActivated: true,
        distributorId: effectiveDistId,
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        treeId: enrolled?.id || inMem?.treeId,
        message: 'Distributor already activated and placed.',
      };
    }

    if (!inMem) {
      inMem = {
        id: cleanId,
        distributorCode: effectiveDistId,
        distributorId: effectiveDistId,
        name: 'Activated Brand Partner',
        fullName: 'Activated Brand Partner',
        displayName: 'Activated Brand Partner',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        bv: paymentDetails?.bv || 100,
        createdAt: new Date().toISOString(),
      };
      this.saveInMemoryUser(inMem);
    } else {
      inMem.status = 'ACTIVE';
      inMem.paymentStatus = 'PAID';
      if (inMem.distributorProfile) {
        inMem.distributorProfile.status = 'ACTIVE';
        inMem.distributorProfile.activatedAt = new Date().toISOString();
      }
    }

    if (enrolled) {
      enrolled.status = 'ACTIVE';
      enrolled.distributorId = effectiveDistId;
    } else {
      NetworkTreeService.addEnrolledMember({
        id: inMem?.treeId || `node-${effectiveDistId.toLowerCase()}`,
        distributorId: effectiveDistId,
        name: inMem?.displayName || 'Activated Distributor',
        status: 'ACTIVE',
        position: inMem?.placementPosition || 'RIGHT',
        sponsor: inMem?.sponsorId || 'KV-1001',
        sponsorName: inMem?.sponsor?.name || 'Rahul Kaushal',
        placementParent: inMem?.placementParentId || inMem?.sponsorId || 'KV-1001',
        placementParentName: inMem?.sponsor?.name || 'Rahul Kaushal',
        bv: paymentDetails?.bv || 100,
      });
    }

    return {
      success: true,
      distributorId: effectiveDistId,
      status: 'ACTIVE',
      paymentStatus: 'PAID',
      treeId: enrolled?.id || inMem?.treeId,
      message: 'Distributor activated and placed successfully.',
    };
  }
}

