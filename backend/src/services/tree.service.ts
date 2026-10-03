import { prisma } from '../config/database';
import { AppError } from '../utils/appError';
import { MlmTreeService } from './mlmTree.service';

export class TreeService {
  /**
   * Retrieves visual binary tree by distributor ID or node ID.
   */
  public static async getBinaryTree(distributorIdOrNodeId: string, depth = 3) {
    // If it's a distributorId, find their primary business center BC1 or primary node
    const distributor = await prisma.distributorProfile.findFirst({
      where: {
        OR: [{ id: distributorIdOrNodeId }, { distributorCode: distributorIdOrNodeId }],
      },
      include: {
        businessCenters: {
          where: { centerNumber: 1 },
          include: { mlmNode: true },
        },
      },
    });

    if (distributor && distributor.businessCenters[0]?.mlmNode) {
      return await MlmTreeService.getBinaryTree(distributor.businessCenters[0].mlmNode.id, depth);
    }

    return await MlmTreeService.getBinaryTree(distributorIdOrNodeId, depth);
  }

  /**
   * Retrieves complete upline lineage (Sponsor tree & Binary tree parents).
   */
  public static async getUpline(distributorId: string) {
    const distributor = await prisma.distributorProfile.findFirst({
      where: {
        OR: [{ id: distributorId }, { distributorCode: distributorId }],
      },
      include: {
        sponsor: {
          select: {
            id: true,
            distributorCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
            status: true,
          },
        },
        businessCenters: {
          include: {
            mlmNode: {
              include: {
                placementParent: {
                  include: {
                    distributor: {
                      select: {
                        id: true,
                        distributorCode: true,
                        firstName: true,
                        lastName: true,
                        displayName: true,
                      },
                    },
                    businessCenter: {
                      select: {
                        centerCode: true,
                        centerNumber: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!distributor) {
      throw AppError.notFound('Distributor not found.', 'DISTRIBUTOR_NOT_FOUND');
    }

    // Unilevel sponsor ancestry chain
    const sponsorAncestry = await prisma.sponsorRelationship.findMany({
      where: { descendantId: distributor.id },
      include: {
        ancestor: {
          select: {
            id: true,
            distributorCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
            currentRank: { select: { name: true } },
          },
        },
      },
      orderBy: { depth: 'asc' },
    });

    // Binary placement parent details from Business Centers
    const binaryParents = distributor.businessCenters.map((bc) => ({
      businessCenterCode: bc.centerCode,
      centerNumber: bc.centerNumber,
      placementParent: bc.mlmNode?.placementParent
        ? {
            nodeId: bc.mlmNode.placementParent.id,
            placementPosition: bc.mlmNode.placementPosition,
            parentDistributor: bc.mlmNode.placementParent.distributor,
            parentBusinessCenter: bc.mlmNode.placementParent.businessCenter,
          }
        : null,
    }));

    return {
      distributorId: distributor.id,
      distributorCode: distributor.distributorCode,
      directSponsor: distributor.sponsor,
      sponsorAncestry: sponsorAncestry.map((a) => ({
        depth: a.depth,
        isDirect: a.isDirect,
        ancestor: a.ancestor,
      })),
      binaryUpline: binaryParents,
    };
  }

  /**
   * Retrieves downline team members across levels.
   */
  public static async getDownline(distributorId: string, depth = 3) {
    const distributor = await prisma.distributorProfile.findFirst({
      where: {
        OR: [{ id: distributorId }, { distributorCode: distributorId }],
      },
    });

    if (!distributor) {
      throw AppError.notFound('Distributor not found.', 'DISTRIBUTOR_NOT_FOUND');
    }

    return await MlmTreeService.getSponsorTree(distributor.id, depth);
  }

  /**
   * Retrieves personally sponsored direct team members.
   */
  public static async getTeam(distributorId: string) {
    const distributor = await prisma.distributorProfile.findFirst({
      where: {
        OR: [{ id: distributorId }, { distributorCode: distributorId }],
      },
    });

    if (!distributor) {
      throw AppError.notFound('Distributor not found.', 'DISTRIBUTOR_NOT_FOUND');
    }

    const team = await prisma.distributorProfile.findMany({
      where: { sponsorId: distributor.id },
      include: {
        user: { select: { email: true, phone: true } },
        currentRank: { select: { name: true, level: true } },
        businessCenters: {
          select: {
            centerCode: true,
            leftVolume: true,
            rightVolume: true,
            status: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return team.map((member) => ({
      id: member.id,
      distributorCode: member.distributorCode,
      name: `${member.firstName} ${member.lastName}`,
      displayName: member.displayName,
      email: member.user.email,
      phone: member.user.phone,
      rank: member.currentRank?.name || 'Unranked',
      status: member.status,
      joinedAt: member.joinedAt,
      lifetimePV: Number(member.lifetimePV),
      lifetimeGV: Number(member.lifetimeGV),
      businessCenters: member.businessCenters.map((bc) => ({
        centerCode: bc.centerCode,
        leftVolume: Number(bc.leftVolume),
        rightVolume: Number(bc.rightVolume),
        status: bc.status,
      })),
    }));
  }
}
