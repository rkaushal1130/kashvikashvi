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
   * Finds a distributor profile by identifier (distributorId, distributorCode, or UUID id),
   * including their primary binary MLM node and its direct placed children.
   */
  public static async findByIdentifier(identifier: string): Promise<SponsorRecord | null> {
    return prisma.distributorProfile.findFirst({
      where: {
        OR: [
          { distributorId: { equals: identifier, mode: 'insensitive' } },
          { distributorCode: { equals: identifier, mode: 'insensitive' } },
          { id: identifier },
        ],
      },
      select: {
        id: true,
        distributorId: true,
        distributorCode: true,
        firstName: true,
        lastName: true,
        displayName: true,
        status: true,
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
  }

  /**
   * Finds a distributor strictly by distributorId.
   */
  public static async findByDistributorId(distributorId: string): Promise<SponsorRecord | null> {
    return prisma.distributorProfile.findFirst({
      where: {
        distributorId: { equals: distributorId, mode: 'insensitive' },
      },
      select: {
        id: true,
        distributorId: true,
        distributorCode: true,
        firstName: true,
        lastName: true,
        displayName: true,
        status: true,
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
