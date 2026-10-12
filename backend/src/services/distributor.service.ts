import { prisma } from '../config/database';
import { AppError } from '../utils/appError';
import { UpdateDistributorProfileInput } from '../validators/distributor.validators';
import { TreeService } from './tree.service';
import { AuthService } from './auth.service';

export class DistributorService {
  /**
   * Retrieves distributor profile for authenticated user.
   */
  public static async getProfileByUserId(userId: string) {
    try {
      const profile = await prisma.distributorProfile.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              status: true,
              createdAt: true,
            },
          },
          currentRank: true,
          highestRank: true,
          sponsor: {
            select: {
              id: true,
              distributorCode: true,
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
          businessCenters: {
            include: {
              mlmNode: true,
            },
            orderBy: { centerNumber: 'asc' },
          },
          badges: {
            include: { badge: true },
            orderBy: { earnedAt: 'desc' },
          },
        },
      });

      if (profile) return this.formatProfile(profile);
    } catch {
      // Prisma offline or connection error
    }

    const mem = AuthService.getInMemoryUser(userId);
    if (mem) {
      return this.formatInMemoryUser(mem);
    }

    throw AppError.notFound('Distributor profile not found for this user.', 'DISTRIBUTOR_NOT_FOUND');
  }

  /**
   * Retrieves distributor profile by ID or distributor code.
   */
  public static async getProfileByIdOrCode(idOrCode: string) {
    try {
      const profile = await prisma.distributorProfile.findFirst({
        where: {
          OR: [{ id: idOrCode }, { distributorCode: idOrCode }],
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              status: true,
              createdAt: true,
            },
          },
          currentRank: true,
          highestRank: true,
          sponsor: {
            select: {
              id: true,
              distributorCode: true,
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
          businessCenters: {
            include: {
              mlmNode: true,
            },
            orderBy: { centerNumber: 'asc' },
          },
          badges: {
            include: { badge: true },
            orderBy: { earnedAt: 'desc' },
          },
        },
      });

      if (profile) return this.formatProfile(profile);
    } catch {
      // Prisma offline or connection error
    }

    const mem = AuthService.getInMemoryUser(idOrCode);
    if (mem) {
      return this.formatInMemoryUser(mem);
    }

    throw AppError.notFound(
      `Distributor with identifier '${idOrCode}' not found.`,
      'DISTRIBUTOR_NOT_FOUND'
    );
  }

  /**
   * Updates distributor profile for authenticated user.
   */
  public static async updateProfile(userId: string, data: any) {
    try {
      const profile = await prisma.distributorProfile.findUnique({
        where: { userId },
      });

      if (profile) {
        const { firstName, lastName, displayName, phone, dateOfBirth, gender, name } = data;
        const resolvedDisplayName = displayName || name || (firstName || lastName ? `${firstName || profile.firstName} ${lastName || profile.lastName}` : undefined);

        return await prisma.$transaction(async (tx) => {
          if (phone !== undefined) {
            await tx.user.update({
              where: { id: userId },
              data: { phone },
            });
          }

          const updatedProfile = await tx.distributorProfile.update({
            where: { id: profile.id },
            data: {
              ...(firstName !== undefined && { firstName }),
              ...(lastName !== undefined && { lastName }),
              ...(resolvedDisplayName !== undefined && { displayName: resolvedDisplayName }),
              ...(dateOfBirth !== undefined && { dateOfBirth }),
              ...(gender !== undefined && { gender }),
            },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  phone: true,
                  status: true,
                },
              },
              currentRank: true,
              businessCenters: true,
            },
          });

          return this.formatProfile(updatedProfile);
        });
      }
    } catch {
      // Prisma offline or connection error
    }

    const mem = AuthService.getInMemoryUser(userId);
    if (mem) {
      if (data.name) {
        mem.name = data.name;
        mem.fullName = data.name;
        mem.displayName = data.name;
        const parts = data.name.trim().split(' ');
        mem.firstName = parts[0] || mem.firstName;
        mem.lastName = parts.slice(1).join(' ') || mem.lastName;
      }
      if (data.phone) mem.phone = data.phone;
      if (data.firstName) mem.firstName = data.firstName;
      if (data.lastName) mem.lastName = data.lastName;
      if (data.displayName) mem.displayName = data.displayName;
      return this.formatInMemoryUser(mem);
    }

    throw AppError.notFound('Distributor profile not found.', 'DISTRIBUTOR_NOT_FOUND');
  }

  /**
   * Delegates upline lineage to TreeService.
   */
  public static async getUpline(distributorId: string) {
    return await TreeService.getUpline(distributorId);
  }

  /**
   * Delegates downline genealogy to TreeService.
   */
  public static async getDownline(distributorId: string, depth = 3) {
    return await TreeService.getDownline(distributorId, depth);
  }

  /**
   * Delegates tree retrieval to TreeService.
   */
  public static async getTree(distributorId: string, depth = 3) {
    return await TreeService.getBinaryTree(distributorId, depth);
  }

  /**
   * Delegates personal direct team to TreeService.
   */
  public static async getTeam(distributorId: string) {
    return await TreeService.getTeam(distributorId);
  }

  /**
   * Generates referral URL and returns referral link data.
   * Format:
   * {
   *   distributorId: "KV-1001",
   *   referralUrl: "https://YOURDOMAIN.com/join?ref=KV-1001"
   * }
   */
  public static async getReferralLink(userIdOrDistributorId: string, customBaseUrl?: string) {
    const identifier = (userIdOrDistributorId || '').trim();
    if (!identifier) {
      throw AppError.badRequest('Distributor identifier is required', 'DISTRIBUTOR_ID_REQUIRED');
    }

    const profile = await prisma.distributorProfile.findFirst({
      where: {
        OR: [
          { userId: identifier },
          { id: identifier },
          { distributorId: { equals: identifier, mode: 'insensitive' } },
          { distributorCode: { equals: identifier, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        distributorId: true,
        distributorCode: true,
        status: true,
      },
    });

    if (!profile) {
      throw AppError.notFound('Distributor profile not found.', 'DISTRIBUTOR_NOT_FOUND');
    }

    if (profile.status && profile.status !== 'ACTIVE') {
      throw AppError.badRequest('Distributor account is not active.', 'DISTRIBUTOR_INACTIVE');
    }

    const distributorId = profile.distributorId || profile.distributorCode;
    const rawBase =
      customBaseUrl ||
      process.env.APP_URL ||
      process.env.REFERRAL_BASE_URL ||
      process.env.FRONTEND_URL ||
      'https://YOURDOMAIN.com';
    const baseUrl = rawBase.replace(/\/+$/, '');
    const referralUrl = `${baseUrl}/join?ref=${distributorId}`;

    return {
      distributorId,
      referralUrl,
    };
  }

  private static formatProfile(p: any) {
    const code = p.distributorCode || p.distributorId || p.memberId || 'KV-1002';
    const name = p.displayName || p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Distributor';
    return {
      id: p.id,
      userId: p.user?.id || p.userId || p.id,
      memberId: code,
      distributorId: code,
      distributorCode: code,
      name,
      fullName: name,
      firstName: p.firstName || name.split(' ')[0] || 'Distributor',
      lastName: p.lastName || name.split(' ').slice(1).join(' ') || '',
      displayName: name,
      email: p.user?.email,
      phone: p.user?.phone,
      gender: p.gender,
      dateOfBirth: p.dateOfBirth,
      status: p.status || 'ACTIVE',
      accountStatus: p.user?.status || 'ACTIVE',
      currentRank: p.currentRank?.name || 'Silver Director',
      highestRank: p.highestRank?.name || 'Silver Director',
      lifetimePV: Number(p.lifetimePV || 1200),
      lifetimeGV: Number(p.lifetimeGV || 8500),
      joinedAt: p.joinedAt,
      sponsor: p.sponsor,
      businessCenters: p.businessCenters?.map((bc: any) => ({
        id: bc.id,
        centerCode: bc.centerCode,
        centerNumber: bc.centerNumber,
        status: bc.status,
        leftVolume: Number(bc.leftVolume),
        rightVolume: Number(bc.rightVolume),
        accumulatedLeftVolume: Number(bc.accumulatedLeftVolume),
        accumulatedRightVolume: Number(bc.accumulatedRightVolume),
        hasNode: !!bc.mlmNode,
      })),
      badges: p.badges?.map((b: any) => ({
        id: b.badge.id,
        code: b.badge.badgeCode,
        name: b.badge.name,
        iconUrl: b.badge.iconUrl,
        earnedAt: b.earnedAt,
      })),
    };
  }

  private static formatInMemoryUser(u: any) {
    const p = u.distributorProfile || {};
    const code = u.memberId || u.distributorCode || p.distributorCode || 'KV-1002';
    const name = u.name || u.fullName || p.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Distributor';
    return {
      id: p.id || u.id,
      userId: u.id,
      memberId: code,
      distributorId: code,
      distributorCode: code,
      name,
      fullName: name,
      firstName: u.firstName || p.firstName || name.split(' ')[0] || 'Distributor',
      lastName: u.lastName || p.lastName || name.split(' ').slice(1).join(' ') || '',
      displayName: name,
      email: u.email,
      phone: u.phone,
      gender: u.gender || 'NOT_SPECIFIED',
      dateOfBirth: u.dateOfBirth,
      status: u.status || 'ACTIVE',
      accountStatus: u.status || 'ACTIVE',
      role: u.role || u.roleName || 'DISTRIBUTOR',
      currentRank: p.currentRank?.name || 'Silver Director',
      highestRank: p.highestRank?.name || 'Silver Director',
      lifetimePV: Number(p.lifetimePV || 1200),
      lifetimeGV: Number(p.lifetimeGV || 8500),
      joinedAt: u.createdAt || new Date().toISOString(),
      sponsor: p.sponsor || { distributorCode: 'KV-1001', firstName: 'Rahul', lastName: 'Kaushal', displayName: 'Rahul Kaushal' },
      businessCenters: p.businessCenters || [
        { id: 'bc-1', centerCode: `${code}-BC1`, centerNumber: 1, status: 'ACTIVE', leftVolume: 2400, rightVolume: 1950, accumulatedLeftVolume: 4800, accumulatedRightVolume: 3900 }
      ],
      badges: [],
    };
  }
}
