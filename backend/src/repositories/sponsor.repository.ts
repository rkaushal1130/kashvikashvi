import { prisma } from '../config/database';
import { PlacementPosition } from '@prisma/client';

export interface SponsorRecord {
  id: string;
  distributorId: string | null;
  distributorCode: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  status: string;
  mlmNodes?: {
    id: string;
    children?: {
      placementPosition: PlacementPosition | null;
    }[];
  }[];
}

/**
 * SponsorRepository
 * Encapsulates Prisma database queries for sponsor validation and binary tree positions.
 * Follows the pattern: Controller -> Service -> Repository/Prisma -> Database.
 */
export class SponsorRepository {
  /**
   * Finds a user/distributor by identifier (referralCode, distributorId, distributorCode, userId, or UUID id).
   * Extracts the user's name directly from the users table.
   */
  public static async findByIdentifier(identifier: string): Promise<SponsorRecord | null> {
    const clean = (identifier || '').trim();
    if (!clean) return null;

    // 1. Search in users table first by referralCode, userId, id, phone, or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { referralCode: { equals: clean, mode: 'insensitive' } },
          { userId: { equals: clean, mode: 'insensitive' } },
          { id: clean },
          { phone: clean },
          { email: { equals: clean, mode: 'insensitive' } },
          { distributorProfile: { distributorCode: { equals: clean, mode: 'insensitive' } } },
          { distributorProfile: { distributorId: { equals: clean, mode: 'insensitive' } } },
        ],
      },
      include: {
        distributorProfile: {
          include: {
            mlmNodes: {
              select: {
                id: true,
                children: {
                  select: {
                    placementPosition: true,
                  },
                },
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        },
      },
    });

    if (user) {
      const name = user.fullName || user.distributorProfile?.displayName || user.distributorProfile?.firstName || 'User';
      const [firstName, ...rest] = name.split(' ');
      const lastName = rest.join(' ');
      const code = user.referralCode || user.distributorProfile?.distributorCode || user.distributorProfile?.distributorId || user.userId || clean;

      return {
        id: user.distributorProfile?.id || user.id,
        distributorId: code,
        distributorCode: code,
        firstName: firstName || name,
        lastName: lastName || '',
        displayName: name,
        status: (user.status as string) || (user.isActive ? 'ACTIVE' : 'INACTIVE'),
        mlmNodes: user.distributorProfile?.mlmNodes || [],
      };
    }

    // 2. Also search directly in distributor_profiles if profile exists independently
    const profile = await prisma.distributorProfile.findFirst({
      where: {
        OR: [
          { distributorId: { equals: clean, mode: 'insensitive' } },
          { distributorCode: { equals: clean, mode: 'insensitive' } },
          { id: clean },
        ],
      },
      include: {
        user: true,
        mlmNodes: {
          select: {
            id: true,
            children: {
              select: {
                placementPosition: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (profile) {
      const name = profile.user?.fullName || profile.displayName || profile.firstName;
      const [firstName, ...rest] = name.split(' ');
      const lastName = rest.join(' ');
      const code = profile.user?.referralCode || profile.distributorCode || profile.distributorId || clean;

      return {
        id: profile.id,
        distributorId: code,
        distributorCode: code,
        firstName: firstName || profile.firstName,
        lastName: lastName || profile.lastName,
        displayName: name,
        status: profile.status,
        mlmNodes: profile.mlmNodes,
      };
    }

    return null;
  }

  /**
   * Finds a distributor strictly by distributorId or referralCode.
   */
  public static async findByDistributorId(distributorId: string): Promise<SponsorRecord | null> {
    return this.findByIdentifier(distributorId);
  }

  /**
   * Retrieves immediate child nodes and their placement positions for a parent MLM node.
   */
  public static async getNodeChildren(nodeId: string): Promise<{ placementPosition: PlacementPosition | null }[]> {
    return prisma.mLMNode.findMany({
      where: { placementParentId: nodeId },
      select: { placementPosition: true },
    });
  }
}
