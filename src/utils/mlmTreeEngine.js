/**
 * Client-side MLM Binary Tree Engine (Prompt 18)
 * Mirrors the server engine for in-browser test execution, state simulation, and visualization.
 */

export class MlmTreeEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.root = null;
    this.membersDirectory = new Map();
    this.slotLocks = new Set();
  }

  createRoot(distributorId, name) {
    const rootNode = {
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

  getRoot() {
    return this.root;
  }

  findMember(distributorId) {
    return this.membersDirectory.get((distributorId || '').toUpperCase()) || null;
  }

  getAncestors(distributorId) {
    const ancestors = [];
    let current = this.findMember(distributorId);

    while (current && current.placementParent && current.placementParent !== 'ROOT (None)') {
      ancestors.push(current.placementParent.toUpperCase());
      current = this.findMember(current.placementParent);
    }

    return ancestors;
  }

  isDescendant(candidateAncestorId, candidateDescendantId) {
    const ancestorClean = (candidateAncestorId || '').toUpperCase();
    const descendantClean = (candidateDescendantId || '').toUpperCase();
    if (ancestorClean === descendantClean) return false;

    const ancestorsOfDescendant = this.getAncestors(descendantClean);
    return ancestorsOfDescendant.includes(ancestorClean);
  }

  validateSponsor(sponsorId, applicantId) {
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

  joinMember(parentDistributorId, position, member) {
    const parentNode = this.findMember(parentDistributorId);
    if (!parentNode) {
      return {
        success: false,
        rejected: true,
        message: `Parent distributor ${parentDistributorId} not found.`,
        reason: `Parent distributor ${parentDistributorId} not found.`,
      };
    }

    const pos = (position || '').toUpperCase();
    if (pos !== 'LEFT' && pos !== 'RIGHT') {
      return {
        success: false,
        rejected: true,
        message: 'Invalid position. Position must be LEFT or RIGHT.',
        reason: 'Invalid position. Position must be LEFT or RIGHT.',
      };
    }

    // TEST 4: Both direct positions occupied
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

    // TEST 17: Slot Mutex Lock
    const slotKey = `${parentDistributorId.toUpperCase()}_${pos}`;
    if (this.slotLocks.has(slotKey)) {
      return {
        success: false,
        rejected: true,
        message: `REJECTED: Concurrency conflict: Slot ${slotKey} is currently locked by a simultaneous transaction.`,
        reason: 'Slot is currently locked by a simultaneous transaction.',
      };
    }

    this.slotLocks.add(slotKey);

    try {
      const newNode = {
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

      if (member.sponsorId.toUpperCase() === parentNode.distributorId.toUpperCase()) {
        parentNode.directMembers += 1;
      }

      this.membersDirectory.set(newNode.distributorId.toUpperCase(), newNode);

      return {
        success: true,
        message: `${member.name} (${member.distributorId}) successfully joined under ${parentNode.name} on ${pos} leg.`,
        tree: this.root,
      };
    } finally {
      this.slotLocks.delete(slotKey);
    }
  }

  async simulateSimultaneousLeftPlacement(parentDistributorId, userA, userB) {
    const slotKey = `${parentDistributorId.toUpperCase()}_LEFT`;

    const executeUserA = async () => {
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

    const executeUserB = async () => {
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

  toAscii(node = this.root, isRoot = true) {
    if (!node) return '';

    if (isRoot) {
      let output = `${node.name}\n`;
      const leftChild = node.left ? node.left.name : 'EMPTY';
      const rightChild = node.right ? node.right.name : 'EMPTY';

      if (node.left && (node.left.left || node.left.right)) {
        output += `├── ${node.left.name}\n`;
        output += this.renderSubtree(node.left, '│   ');
      } else {
        output += `├── ${leftChild}\n`;
      }

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

  renderSubtree(node, prefix) {
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

  getHoverDetails(distributorId) {
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

  getClickDetails(distributorId) {
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

  viewNetwork(distributorId) {
    return this.findMember(distributorId);
  }

  checkAdminAccess(user) {
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

  calculateMobileViewport(viewportWidth, currentZoom, currentPan, deltaPan, zoomFactor) {
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
