/**
 * MLM Binary Tree Engine (Prompt 18 - Complete MLM Tree Specification)
 * 
 * Implements strict binary invariants, concurrency controls, lineage safety,
 * sponsor verification, and visualization algorithms.
 */

export interface MlmMemberInput {
  distributorId: string;
  name: string;
  sponsorId: string;
  sponsorName?: string;
  rank?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
  businessCenter?: string;
  businessCenterName?: string;
  personalBV?: number;
}

export interface MlmTreeNode {
  distributorId: string;
  name: string;
  rank: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
  sponsor: string;
  sponsorName: string;
  placementParent: string;
  placementParentName: string;
  position: 'ROOT' | 'LEFT' | 'RIGHT';
  businessCenter: string;
  businessCenterName: string;
  leftTeamCount: number;
  rightTeamCount: number;
  totalTeamCount: number;
  directMembers: number;
  leftBV: number;
  rightBV: number;
  personalBV: number;
  totalBV: number;
  left: MlmTreeNode | null;
  right: MlmTreeNode | null;
}

export interface PlacementResult {
  success: boolean;
  message: string;
  tree?: MlmTreeNode;
  rejected?: boolean;
  reason?: string;
}

export class MlmTreeEngine {
  private root: MlmTreeNode | null = null;
  private membersDirectory: Map<string, MlmTreeNode> = new Map();
  // Concurrency mutex lock per parent slot: `${parentId}_${position}`
  private slotLocks: Set<string> = new Set();

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.root = null;
    this.membersDirectory.clear();
    this.slotLocks.clear();
  }

  /**
   * TEST 1: Initialize Root Member (e.g. Rahul KV-1001)
   */
  public createRoot(distributorId: string, name: string): MlmTreeNode {
    const rootNode: MlmTreeNode = {
      distributorId,
      name,
      rank: 'Business Center',
      status: 'ACTIVE',
      sponsor: 'KV-1000',
      sponsorName: 'Corporate System',
      placementParent: 'ROOT (None)',
      placementParentName: 'ROOT',
      position: 'ROOT',
      businessCenter: 'BC-001',
      businessCenterName: 'Corporate Headquarters',
      leftTeamCount: 0,
      rightTeamCount: 0,
      totalTeamCount: 0,
      directMembers: 0,
      leftBV: 0,
      rightBV: 0,
      personalBV: 250,
      totalBV: 250,
      left: null,
      right: null,
    };

    this.root = rootNode;
    this.membersDirectory.set(distributorId.toUpperCase(), rootNode);
    return rootNode;
  }

  public getRoot(): MlmTreeNode | null {
    return this.root;
  }

  public findMember(distributorId: string): MlmTreeNode | null {
    return this.membersDirectory.get(distributorId.toUpperCase()) || null;
  }

  /**
   * Traverse upwards to find all ancestor distributor IDs
   */
  public getAncestors(distributorId: string): string[] {
    const ancestors: string[] = [];
    let current = this.findMember(distributorId);

    while (current && current.placementParent && current.placementParent !== 'ROOT (None)') {
      ancestors.push(current.placementParent.toUpperCase());
      current = this.findMember(current.placementParent);
    }

    return ancestors;
  }

  /**
   * Check if candidateDescendantId is in candidateAncestorId's downline
   */
  public isDescendant(candidateAncestorId: string, candidateDescendantId: string): boolean {
    const ancestorClean = candidateAncestorId.toUpperCase();
    const descendantClean = candidateDescendantId.toUpperCase();
    if (ancestorClean === descendantClean) return false;

    const ancestorsOfDescendant = this.getAncestors(descendantClean);
    return ancestorsOfDescendant.includes(ancestorClean);
  }

  /**
   * Validate Sponsor (Tests 12, 13, 14, 15)
   */
  public validateSponsor(sponsorId: string, applicantId?: string): {
    isValid: boolean;
    reason?: string;
    sponsor?: MlmTreeNode;
  } {
    const cleanSponsorId = (sponsorId || '').trim().toUpperCase();
    const cleanApplicantId = (applicantId || '').trim().toUpperCase();

    // TEST 15: Self-sponsorship check
    if (cleanApplicantId && cleanSponsorId === cleanApplicantId) {
      return {
        isValid: false,
        reason: 'REJECTED: Self-sponsorship is not permitted.',
      };
    }

    // TEST 13: Invalid sponsor check
    const sponsorNode = this.membersDirectory.get(cleanSponsorId);
    if (!sponsorNode) {
      return {
        isValid: false,
        reason: `REJECTED: Invalid sponsor ID: Sponsor ${sponsorId} not found in directory.`,
      };
    }

    // TEST 14: Inactive sponsor check
    if (sponsorNode.status !== 'ACTIVE') {
      return {
        isValid: false,
        reason: `REJECTED: Inactive sponsor: Sponsor ${sponsorId} has status ${sponsorNode.status}.`,
        sponsor: sponsorNode,
      };
    }

    return {
      isValid: true,
      sponsor: sponsorNode,
    };
  }

  /**
   * Place a new member in the binary tree under parentDistributorId at targetPosition.
   * Enforces:
   * - Test 4: Both direct positions occupied -> REJECTED
   * - Test 7: Target position already occupied -> REJECTED
   * - Test 16: Circular placement -> REJECTED
   * - Test 17: Concurrency lock
   */
  public joinMember(
    parentDistributorId: string,
    position: 'LEFT' | 'RIGHT',
    member: MlmMemberInput
  ): PlacementResult {
    const parentNode = this.findMember(parentDistributorId);
    if (!parentNode) {
      return {
        success: false,
        rejected: true,
        message: `Parent distributor ${parentDistributorId} not found.`,
        reason: `Parent distributor ${parentDistributorId} not found.`,
      };
    }

    const pos = position.toUpperCase() as 'LEFT' | 'RIGHT';
    if (pos !== 'LEFT' && pos !== 'RIGHT') {
      return {
        success: false,
        rejected: true,
        message: 'Invalid position. Position must be LEFT or RIGHT.',
        reason: 'Invalid position. Position must be LEFT or RIGHT.',
      };
    }

    // TEST 4: Both direct positions are occupied
    if (parentNode.left !== null && parentNode.right !== null) {
      return {
        success: false,
        rejected: true,
        message: `REJECTED: Both direct positions under ${parentNode.name} are occupied.`,
        reason: 'Both direct positions are occupied.',
      };
    }

    // TEST 7: Target position already occupied
    if (pos === 'LEFT' && parentNode.left !== null) {
      return {
        success: false,
        rejected: true,
        message: `REJECTED: Left position under ${parentNode.name} is already occupied by ${parentNode.left.name}.`,
        reason: `Left position under ${parentNode.name} is already occupied.`,
      };
    }

    if (pos === 'RIGHT' && parentNode.right !== null) {
      return {
        success: false,
        rejected: true,
        message: `REJECTED: Right position under ${parentNode.name} is already occupied by ${parentNode.right.name}.`,
        reason: `Right position under ${parentNode.name} is already occupied.`,
      };
    }

    // TEST 16: Circular placement check
    // Check if new member is an existing member that is already an ancestor of parentNode
    const existingNode = this.findMember(member.distributorId);
    if (existingNode) {
      if (this.isDescendant(member.distributorId, parentDistributorId)) {
        return {
          success: false,
          rejected: true,
          message: 'REJECTED: Circular placement detected. Cannot place an ancestor under a descendant.',
          reason: 'Circular placement detected. Cannot place an ancestor under a descendant.',
        };
      }
      if (member.distributorId.toUpperCase() === parentDistributorId.toUpperCase()) {
        return {
          success: false,
          rejected: true,
          message: 'REJECTED: Circular hierarchy violation. A distributor cannot be placed under themselves.',
          reason: 'A distributor cannot be placed under themselves.',
        };
      }
    }

    // TEST 17: Atomic Slot Lock (Concurrency Guard)
    const slotKey = `${parentDistributorId.toUpperCase()}_${pos}`;
    if (this.slotLocks.has(slotKey)) {
      return {
        success: false,
        rejected: true,
        message: `REJECTED: Concurrency conflict: Slot ${slotKey} is currently locked by a simultaneous transaction.`,
        reason: 'Slot is currently locked by a simultaneous transaction.',
      };
    }

    // Acquire lock
    this.slotLocks.add(slotKey);

    try {
      // Create new node
      const newNode: MlmTreeNode = {
        distributorId: member.distributorId,
        name: member.name,
        rank: member.rank || 'Associate',
        status: member.status || 'ACTIVE',
        sponsor: member.sponsorId,
        sponsorName: member.sponsorName || parentNode.name,
        placementParent: parentNode.distributorId,
        placementParentName: parentNode.name,
        position: pos,
        businessCenter: member.businessCenter || parentNode.businessCenter || 'BC-001',
        businessCenterName: member.businessCenterName || parentNode.businessCenterName || 'Corporate Headquarters',
        leftTeamCount: 0,
        rightTeamCount: 0,
        totalTeamCount: 0,
        directMembers: 0,
        leftBV: 0,
        rightBV: 0,
        personalBV: member.personalBV ?? 100,
        totalBV: member.personalBV ?? 100,
        left: null,
        right: null,
      };

      if (pos === 'LEFT') {
        parentNode.left = newNode;
        parentNode.leftTeamCount += 1;
      } else {
        parentNode.right = newNode;
        parentNode.rightTeamCount += 1;
      }
      parentNode.totalTeamCount += 1;

      // Update sponsor direct referrals if parent is sponsor
      if (member.sponsorId.toUpperCase() === parentNode.distributorId.toUpperCase()) {
        parentNode.directMembers += 1;
      }

      this.membersDirectory.set(newNode.distributorId.toUpperCase(), newNode);

      return {
        success: true,
        message: `${member.name} (${member.distributorId}) successfully joined under ${parentNode.name} on ${pos} leg.`,
        tree: this.root!,
      };
    } finally {
      // Release lock
      this.slotLocks.delete(slotKey);
    }
  }

  /**
   * TEST 17: Simulate Two Simultaneous Users Attempting the Same LEFT Slot
   */
  public async simulateSimultaneousLeftPlacement(
    parentDistributorId: string,
    userA: MlmMemberInput,
    userB: MlmMemberInput
  ): Promise<{
    userAResult: PlacementResult;
    userBResult: PlacementResult;
    onlyOneSucceeded: boolean;
  }> {
    const slotKey = `${parentDistributorId.toUpperCase()}_LEFT`;

    // Race execution simulation with atomic slot lock
    const executeUserA = async (): Promise<PlacementResult> => {
      if (this.slotLocks.has(slotKey)) {
        return {
          success: false,
          rejected: true,
          reason: 'Slot is currently locked by a simultaneous transaction.',
          message: 'REJECTED: Simultaneous placement collision.',
        };
      }
      return this.joinMember(parentDistributorId, 'LEFT', userA);
    };

    const executeUserB = async (): Promise<PlacementResult> => {
      // Small simulated tick delay to simulate parallel race
      await new Promise((r) => setTimeout(r, 5));
      if (this.slotLocks.has(slotKey)) {
        return {
          success: false,
          rejected: true,
          reason: 'Slot is currently locked by a simultaneous transaction.',
          message: 'REJECTED: Simultaneous placement collision.',
        };
      }
      return this.joinMember(parentDistributorId, 'LEFT', userB);
    };

    const [userAResult, userBResult] = await Promise.all([executeUserA(), executeUserB()]);

    const onlyOneSucceeded =
      (userAResult.success && !userBResult.success) ||
      (!userAResult.success && userBResult.success);

    return {
      userAResult,
      userBResult,
      onlyOneSucceeded,
    };
  }

  /**
   * Produce exact ASCII genealogy diagram matching prompt specifications
   *
   * Example:
   * Rahul
   * ├── Amit
   * │   ├── Neha
   * │   └── Pooja
   * └── Rohit
   */
  public toAscii(node: MlmTreeNode | null = this.root, prefix = '', isLeft = false, isRoot = true): string {
    if (!node) {
      return '';
    }

    if (isRoot) {
      let output = `${node.name}\n`;
      const leftChild = node.left ? node.left.name : 'EMPTY';
      const rightChild = node.right ? node.right.name : 'EMPTY';

      // Left branch
      if (node.left && (node.left.left || node.left.right)) {
        output += `├── ${node.left.name}\n`;
        output += this.renderSubtree(node.left, '│   ');
      } else {
        output += `├── ${leftChild}\n`;
      }

      // Right branch
      if (node.right && (node.right.left || node.right.right)) {
        output += `└── ${node.right.name}\n`;
        output += this.renderSubtree(node.right, '    ');
      } else {
        output += `└── ${rightChild}`;
      }

      return output.trimEnd();
    }

    return '';
  }

  private renderSubtree(node: MlmTreeNode, prefix: string): string {
    let result = '';
    const leftText = node.left ? node.left.name : 'EMPTY';
    const rightText = node.right ? node.right.name : 'EMPTY';

    if (node.left && (node.left.left || node.left.right)) {
      result += `${prefix}├── ${node.left.name}\n`;
      result += this.renderSubtree(node.left, `${prefix}│   `);
    } else {
      result += `${prefix}├── ${leftText}\n`;
    }

    if (node.right && (node.right.left || node.right.right)) {
      result += `${prefix}└── ${node.right.name}\n`;
      result += this.renderSubtree(node.right, `${prefix}    `);
    } else {
      result += `${prefix}└── ${rightText}\n`;
    }

    return result;
  }

  /**
   * TEST 8: Hover Member -> Returns Member Summary Card
   */
  public getHoverDetails(distributorId: string) {
    const member = this.findMember(distributorId);
    if (!member) return null;

    return {
      name: member.name,
      distributorId: member.distributorId,
      rank: member.rank,
      status: member.status,
      sponsor: member.sponsorName ? `${member.sponsor} (${member.sponsorName})` : member.sponsor,
      teamCounts: {
        total: member.totalTeamCount,
        left: member.leftTeamCount,
        right: member.rightTeamCount,
      },
      bvSummary: {
        left: member.leftBV,
        right: member.rightBV,
        personal: member.personalBV,
        total: member.totalBV,
      },
    };
  }

  /**
   * TEST 9: Click Member -> Returns Full 10-Attribute Details Panel
   */
  public getClickDetails(distributorId: string) {
    const member = this.findMember(distributorId);
    if (!member) return null;

    return {
      isOpen: true,
      member: {
        ...member,
        placementParent: member.placementParent,
        placementParentName: member.placementParentName,
        position: member.position,
        rank: member.rank,
        status: member.status,
        teamCounts: {
          total: member.totalTeamCount,
          left: member.leftTeamCount,
          right: member.rightTeamCount,
          direct: member.directMembers,
        },
        bvSummary: {
          leftBV: member.leftBV,
          rightBV: member.rightBV,
          personalBV: member.personalBV,
          totalBV: member.totalBV,
          leftRatio: member.leftBV + member.rightBV > 0
            ? Math.round((member.leftBV / (member.leftBV + member.rightBV)) * 100)
            : 50,
        },
        businessCenter: member.businessCenter,
        businessCenterName: member.businessCenterName,
      },
    };
  }

  /**
   * TEST 10: View Network -> Focal member becomes root of active tree
   */
  public viewNetwork(distributorId: string): MlmTreeNode | null {
    const target = this.findMember(distributorId);
    return target || null;
  }

  /**
   * TEST 18 & 19: Authorization Guard Evaluation
   */
  public checkAdminAccess(user: { role?: string; isLoggedIn?: boolean } | null): {
    allowed: boolean;
    statusCode: number;
    message: string;
  } {
    if (!user || !user.isLoggedIn) {
      return {
        allowed: false,
        statusCode: 403,
        message: '403 Forbidden: Unauthenticated user cannot access admin network tree.',
      };
    }

    const role = (user.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      return {
        allowed: true,
        statusCode: 200,
        message: '200 OK: Admin access granted.',
      };
    }

    return {
      allowed: false,
      statusCode: 403,
      message: '403 Forbidden: Standard distributor restricted from global admin tree.',
    };
  }

  /**
   * TEST 20: Mobile Tree Viewport Calculation
   */
  public calculateMobileViewport(
    viewportWidth: number,
    currentZoom: number,
    currentPan: { x: number; y: number },
    deltaPan: { x: number; y: number },
    zoomFactor: number
  ) {
    const isMobile = viewportWidth <= 768;
    const newZoom = Math.max(0.4, Math.min(2.0, Number((currentZoom * zoomFactor).toFixed(2))));
    const newPan = {
      x: currentPan.x + deltaPan.x,
      y: currentPan.y + deltaPan.y,
    };

    return {
      isMobile,
      zoomLevel: newZoom,
      panPosition: newPan,
      transformStyle: `scale(${newZoom}) translate(${newPan.x}px, ${newPan.y}px)`,
    };
  }
}
