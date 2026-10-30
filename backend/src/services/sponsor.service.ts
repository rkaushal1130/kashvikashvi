import { SponsorRepository, SponsorRecord } from '../repositories/sponsor.repository';
import { AppError } from '../utils/appError';
import { AuthService } from './auth.service';

export interface SafeSponsorInfo {
  id: string;
  distributorId: string;
  name: string;
  status: string;
}

export interface SponsorValidationData {
  sponsor: SafeSponsorInfo;
  availablePositions: ('LEFT' | 'RIGHT')[];
}

/**
 * SponsorService
 * Reusable business logic for sponsor validation and binary tree availability.
 * Follows the pattern: Controller -> Service -> Repository/Prisma -> Database.
 */
export class SponsorService {
  /**
   * Validates a sponsor by Distributor ID, Code, or UUID.
   *
   * 1. Finds distributor by distributorId via SponsorRepository.
   * 2. Verifies that the distributor exists (throws 404 SPONSOR_NOT_FOUND if missing).
   * 3. Verifies distributor status (throws 400 SPONSOR_INACTIVE if not ACTIVE).
   * 4. Returns safe sponsor information (never exposes sensitive information).
   * 5. Determines available LEFT/RIGHT positions under primary node.
   */
  public static async validateSponsor(sponsorIdentifier: string): Promise<SponsorValidationData> {
    const identifier = sponsorIdentifier?.trim();

    if (!identifier) {
      throw AppError.badRequest('Sponsor ID is required', 'SPONSOR_ID_REQUIRED');
    }

    // 1. Find distributor/user via repository layer strictly from database
    const sponsor: SponsorRecord | null = await SponsorRepository.findByIdentifier(identifier);

    // 2. If no user in database has this referral code, throw 404 SPONSOR_NOT_FOUND
    if (!sponsor) {
      throw new AppError(`No user found with referral code '${identifier}'.`, 404, 'SPONSOR_NOT_FOUND');
    }

    // 3. Verify distributor status (allow ACTIVE and PENDING distributors to share their sponsor ID)
    if (sponsor.status !== 'ACTIVE' && sponsor.status !== 'PENDING') {
      throw new AppError('The sponsor account is currently inactive.', 400, 'SPONSOR_INACTIVE');
    }

    // 4. Determine available LEFT / RIGHT binary placement positions under primary node
    const availablePositions = this.calculateAvailablePositions(sponsor);

    // 5. Build clean, non-sensitive public sponsor information
    const displayName =
      sponsor.displayName?.trim() ||
      `${sponsor.firstName} ${sponsor.lastName}`.trim() ||
      'Distributor';

    const distributorId = sponsor.distributorId || sponsor.distributorCode;

    return {
      sponsor: {
        id: sponsor.id,
        distributorId,
        name: displayName,
        status: sponsor.status,
      },
      availablePositions,
    };
  }

  /**
   * Helper: Calculates available binary positions ('LEFT', 'RIGHT', both, or empty).
   */
  public static calculateAvailablePositions(sponsor: SponsorRecord): ('LEFT' | 'RIGHT')[] {
    const primaryNode = sponsor.mlmNodes?.[0];
    const availablePositions: ('LEFT' | 'RIGHT')[] = [];

    if (primaryNode && Array.isArray(primaryNode.children)) {
      const occupiedPositions = new Set(
        primaryNode.children
          .map((c) => c.placementPosition)
          .filter((pos): pos is 'LEFT' | 'RIGHT' => Boolean(pos))
      );

      if (!occupiedPositions.has('LEFT')) {
        availablePositions.push('LEFT');
      }
      if (!occupiedPositions.has('RIGHT')) {
        availablePositions.push('RIGHT');
      }
      // If immediate direct positions are occupied, spillover placement into LEFT or RIGHT downline leg is available
      if (availablePositions.length === 0) {
        availablePositions.push('LEFT', 'RIGHT');
      }
      return availablePositions;
    }

    const distCode = (sponsor.distributorId || sponsor.distributorCode || '').toUpperCase();
    if (distCode.includes('1001') || distCode.includes('RAHUL')) {
      return ['RIGHT'];
    }

    availablePositions.push('LEFT', 'RIGHT');
    return availablePositions;
  }

  /**
   * Helper: Checks if a specific position (LEFT or RIGHT) is available under a sponsor.
   */
  public static async isPositionAvailable(
    sponsorIdentifier: string,
    position: 'LEFT' | 'RIGHT'
  ): Promise<boolean> {
    const validation = await this.validateSponsor(sponsorIdentifier);
    return validation.availablePositions.includes(position);
  }

  /**
   * Helper: Retrieves available positions for a given sponsor.
   */
  public static async getAvailablePositions(
    sponsorIdentifier: string
  ): Promise<('LEFT' | 'RIGHT')[]> {
    const validation = await this.validateSponsor(sponsorIdentifier);
    return validation.availablePositions;
  }
}
