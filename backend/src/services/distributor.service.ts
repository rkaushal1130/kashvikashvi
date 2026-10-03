import { prisma } from '../config/database';
import { AppError } from '../utils/appError';
import { UpdateDistributorProfileInput } from '../validators/distributor.validators';
import { TreeService } from './tree.service';

export class DistributorService {
  /**
   * Retrieves distributor profile for authenticated user.
   */
  public static async getProfileByUserId(userId: string) {
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

    if (!profile) {
      throw AppError.notFound('Distributor profile not found for this user.', 'DISTRIBUTOR_NOT_FOUND');
    }

    return this.formatProfile(profile);
  }

  /**
   * Retrieves distributor profile by ID or distributor code.
   */
  public static async getProfileByIdOrCode(idOrCode: string) {
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

    if (!profile) {
      throw AppError.notFound(
        `Distributor with identifier '${idOrCode}' not found.`,
        'DISTRIBUTOR_NOT_FOUND'
      );
    }

    return this.formatProfile(profile);
  }

  /**
   * Updates distributor profile for authenticated user.
   */
  public static async updateProfile(userId: string, data: UpdateDistributorProfileInput) {
    const profile = await prisma.distributorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw AppError.notFound('Distributor profile not found.', 'DISTRIBUTOR_NOT_FOUND');
    }

    const { firstName, lastName, displayName, phone, dateOfBirth, gender } = data;

    return await prisma.$transaction(async (tx) => {
      // Update User phone if provided
      if (phone !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: { phone },
        });
      }

      // Update DistributorProfile fields
      const updatedProfile = await tx.distributorProfile.update({
        where: { id: profile.id },
        data: {
          ...(firstName !== undefined && { firstName }),
          ...(lastName !== undefined && { lastName }),
          ...(displayName !== undefined
            ? { displayName }
            : firstName || lastName
            ? { displayName: `${firstName || profile.firstName} ${lastName || profile.lastName}` }
            : {}),
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
    return {
      id: p.id,
      distributorCode: p.distributorCode,
      firstName: p.firstName,
      lastName: p.lastName,
      displayName: p.displayName || `${p.firstName} ${p.lastName}`,
      email: p.user?.email,
      phone: p.user?.phone,
      gender: p.gender,
      dateOfBirth: p.dateOfBirth,
      status: p.status,
      accountStatus: p.user?.status,
      currentRank: p.currentRank?.name || 'Business Center',
      highestRank: p.highestRank?.name || 'Business Center',
      lifetimePV: Number(p.lifetimePV),
      lifetimeGV: Number(p.lifetimeGV),
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
}
