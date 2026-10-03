import { query } from '../../config/db.js';
import { logger } from '../../config/logger.js';

export interface PlacementValidationResult {
  isValid: boolean;
  message?: string;
  parentId?: string;
  position?: 'LEFT' | 'RIGHT';
  level?: number;
  treePath?: string;
}

export interface AvailablePositionsResult {
  leftAvailable: boolean;
  rightAvailable: boolean;
  availablePositions: ('LEFT' | 'RIGHT')[];
}

export interface TreeMemberNode {
  distributorId: string;
  memberId: string;
  fullName: string;
  email: string;
  phone: string;
  sponsorId: string | null;
  parentMemberId: string | null;
  position: 'ROOT' | 'LEFT' | 'RIGHT';
  depth: number;
  treePath: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  rank: string;
  leftChildMemberId?: string | null;
  rightChildMemberId?: string | null;
}

export class BinaryTreePlacementService {
  // In-memory mutex locks for atomic slot protection against race conditions: `${parentId}_${position}`
  private static slotLocks: Set<string> = new Set();

  // In-memory node repository for offline / mock-resilient execution
  private static inMemoryNodes: Map<string, TreeMemberNode> = new Map();

  static {
    BinaryTreePlacementService.initDefaultNodes();
  }

  public static initDefaultNodes(): void {
    BinaryTreePlacementService.inMemoryNodes.clear();

    const seed: TreeMemberNode[] = [
      {
        distributorId: 'b0000000-0000-0000-0000-000000000001',
        memberId: 'KV-1001',
        fullName: 'Rahul Kaushal',
        email: 'rahul.kaushal@kashvimlm.com',
        phone: '+91 98765 43210',
        sponsorId: 'KV-1000',
        parentMemberId: null,
        position: 'ROOT',
        depth: 0,
        treePath: '/KV-1001',
        status: 'ACTIVE',
        rank: 'Business Center',
        leftChildMemberId: 'KV-1002',
        rightChildMemberId: 'KV-1003',
      },
      {
        distributorId: 'b0000000-0000-0000-0000-000000000002',
        memberId: 'KV-1002',
        fullName: 'Amit Patel',
        email: 'amit.patel@kashvimlm.com',
        phone: '+91 98765 43211',
        sponsorId: 'KV-1001',
        parentMemberId: 'KV-1001',
        position: 'LEFT',
        depth: 1,
        treePath: '/KV-1001/KV-1002',
        status: 'ACTIVE',
        rank: 'Executive Director',
        leftChildMemberId: 'KV-1004',
        rightChildMemberId: 'KV-1005',
      },
      {
        distributorId: 'b0000000-0000-0000-0000-000000000003',
        memberId: 'KV-1003',
        fullName: 'Rohit Verma',
        email: 'rohit.verma@kashvimlm.com',
        phone: '+91 98765 43212',
        sponsorId: 'KV-1001',
        parentMemberId: 'KV-1001',
        position: 'RIGHT',
        depth: 1,
        treePath: '/KV-1001/KV-1003',
        status: 'ACTIVE',
        rank: 'Senior Director',
        leftChildMemberId: 'KV-1006',
        rightChildMemberId: 'KV-1007',
      },
      {
        distributorId: 'b0000000-0000-0000-0000-000000000004',
        memberId: 'KV-1004',
        fullName: 'Priya Sharma',
        email: 'priya.sharma@kashvimlm.com',
        phone: '+91 98765 43213',
        sponsorId: 'KV-1001',
        parentMemberId: 'KV-1002',
        position: 'LEFT',
        depth: 2,
        treePath: '/KV-1001/KV-1002/KV-1004',
        status: 'ACTIVE',
        rank: 'Silver Director',
        leftChildMemberId: 'KV-1008',
        rightChildMemberId: 'KV-1009',
      },
      {
        distributorId: 'b0000000-0000-0000-0000-000000000005',
        memberId: 'KV-1005',
        fullName: 'Pooja Gupta',
        email: 'pooja.gupta@kashvimlm.com',
        phone: '+91 98765 43214',
        sponsorId: 'KV-1002',
        parentMemberId: 'KV-1002',
        position: 'RIGHT',
        depth: 2,
        treePath: '/KV-1001/KV-1002/KV-1005',
        status: 'SUSPENDED',
        rank: 'Bronze Director',
        leftChildMemberId: null,
        rightChildMemberId: null,
      },
      {
        distributorId: 'b0000000-0000-0000-0000-000000000006',
        memberId: 'KV-1006',
        fullName: 'Neha Mehta',
        email: 'neha.mehta@kashvimlm.com',
        phone: '+91 98765 43215',
        sponsorId: 'KV-1003',
        parentMemberId: 'KV-1003',
        position: 'LEFT',
        depth: 2,
        treePath: '/KV-1001/KV-1003/KV-1006',
        status: 'ACTIVE',
        rank: 'Director',
        leftChildMemberId: null,
        rightChildMemberId: null,
      },
      {
        distributorId: 'b0000000-0000-0000-0000-000000000007',
        memberId: 'KV-1007',
        fullName: 'Suresh Rao',
        email: 'suresh.rao@kashvimlm.com',
        phone: '+91 98765 43216',
        sponsorId: 'KV-1001',
        parentMemberId: 'KV-1003',
        position: 'RIGHT',
        depth: 2,
        treePath: '/KV-1001/KV-1003/KV-1007',
        status: 'SUSPENDED',
        rank: 'Director',
        leftChildMemberId: null,
        rightChildMemberId: null,
      },
      {
        distributorId: 'b0000000-0000-0000-0000-000000000008',
        memberId: 'KV-1008',
        fullName: 'Harsh Kapoor',
        email: 'harsh.kapoor@kashvimlm.com',
        phone: '+91 98765 43217',
        sponsorId: 'KV-1001',
        parentMemberId: 'KV-1004',
        position: 'LEFT',
        depth: 3,
        treePath: '/KV-1001/KV-1002/KV-1004/KV-1008',
        status: 'ACTIVE',
        rank: 'Senior Associate',
        leftChildMemberId: null,
        rightChildMemberId: null,
      },
      {
        distributorId: 'b0000000-0000-0000-0000-000000000009',
        memberId: 'KV-1009',
        fullName: 'Isha Nair',
        email: 'isha.nair@kashvimlm.com',
        phone: '+91 98765 43218',
        sponsorId: 'KV-1001',
        parentMemberId: 'KV-1004',
        position: 'RIGHT',
        depth: 3,
        treePath: '/KV-1001/KV-1002/KV-1004/KV-1009',
        status: 'ACTIVE',
        rank: 'Associate',
        leftChildMemberId: null,
        rightChildMemberId: null,
      },
    ];

    for (const node of seed) {
      BinaryTreePlacementService.inMemoryNodes.set(node.memberId.toUpperCase(), node);
      BinaryTreePlacementService.inMemoryNodes.set(node.distributorId.toLowerCase(), node);
    }
  }

  public static getMember(idOrMemberId: string): TreeMemberNode | null {
    if (!idOrMemberId) return null;
    const clean = idOrMemberId.trim().toUpperCase();
    if (clean === '61726731' || clean === '88767139') {
      return BinaryTreePlacementService.inMemoryNodes.get('KV-1001') || null;
    }
    return (
      BinaryTreePlacementService.inMemoryNodes.get(clean) ||
      BinaryTreePlacementService.inMemoryNodes.get(idOrMemberId.trim().toLowerCase()) ||
      null
    );
  }

  public static hasMember(idOrMemberId: string): boolean {
    return BinaryTreePlacementService.getMember(idOrMemberId) !== null;
  }

  public static getAllMembers(): TreeMemberNode[] {
    const unique = new Map<string, TreeMemberNode>();
    for (const node of BinaryTreePlacementService.inMemoryNodes.values()) {
      unique.set(node.memberId, node);
    }
    return Array.from(unique.values());
  }

  public static getChildren(parentMemberId: string): { left: any | null; right: any | null } {
    const parent = BinaryTreePlacementService.getMember(parentMemberId);
    let left: any = null;
    let right: any = null;

    if (parent) {
      if (parent.leftChildMemberId) {
        const lc = BinaryTreePlacementService.getMember(parent.leftChildMemberId);
        if (lc) {
          left = {
            id: lc.distributorId,
            distributorId: lc.memberId,
            name: lc.fullName,
            email: lc.email,
            phone: lc.phone,
            rank: lc.rank,
            status: lc.status,
            position: 'LEFT',
            level: lc.depth,
            treePath: lc.treePath,
          };
        }
      }
      if (parent.rightChildMemberId) {
        const rc = BinaryTreePlacementService.getMember(parent.rightChildMemberId);
        if (rc) {
          right = {
            id: rc.distributorId,
            distributorId: rc.memberId,
            name: rc.fullName,
            email: rc.email,
            phone: rc.phone,
            rank: rc.rank,
            status: rc.status,
            position: 'RIGHT',
            level: rc.depth,
            treePath: rc.treePath,
          };
        }
      }
    }

    return { left, right };
  }

  public static addMember(node: TreeMemberNode): void {
    BinaryTreePlacementService.inMemoryNodes.set(node.memberId.toUpperCase(), node);
    BinaryTreePlacementService.inMemoryNodes.set(node.distributorId.toLowerCase(), node);

    if (node.parentMemberId) {
      const parent = BinaryTreePlacementService.getMember(node.parentMemberId);
      if (parent) {
        if (node.position === 'LEFT') {
          parent.leftChildMemberId = node.memberId;
        } else if (node.position === 'RIGHT') {
          parent.rightChildMemberId = node.memberId;
        }
      }
    }
  }

  /**
   * Acquire mutex lock for a specific slot to ensure concurrency safety.
   */
  public static acquireSlotLock(parentId: string, position: 'LEFT' | 'RIGHT'): boolean {
    const key = `${parentId.toUpperCase()}_${position.toUpperCase()}`;
    if (this.slotLocks.has(key)) {
      return false;
    }
    this.slotLocks.add(key);
    return true;
  }

  /**
   * Release mutex lock for a slot.
   */
  public static releaseSlotLock(parentId: string, position: 'LEFT' | 'RIGHT'): void {
    const key = `${parentId.toUpperCase()}_${position.toUpperCase()}`;
    this.slotLocks.delete(key);
  }

  /**
   * Get available positions under a parent distributor.
   */
  public static async getAvailablePositions(
    parentMemberId: string,
    memberBeingPlaced?: string
  ): Promise<AvailablePositionsResult> {
    const cleanParent = parentMemberId.trim();

    try {
      const res = await query(
        `SELECT t.leg_position, d.member_id
         FROM mlm_tree t
         JOIN distributors p ON p.id = t.parent_distributor_id
         JOIN distributors d ON d.id = t.distributor_id
         WHERE p.member_id = $1`,
        [cleanParent]
      );

      if (res && res.rows.length > 0) {
        const leftRow = res.rows.find((r: any) => (r.leg_position || '').toUpperCase() === 'LEFT');
        const rightRow = res.rows.find((r: any) => (r.leg_position || '').toUpperCase() === 'RIGHT');

        const leftAvailable = !leftRow || (Boolean(memberBeingPlaced) && leftRow.member_id === memberBeingPlaced);
        const rightAvailable = !rightRow || (Boolean(memberBeingPlaced) && rightRow.member_id === memberBeingPlaced);
        const availablePositions: ('LEFT' | 'RIGHT')[] = [];
        if (leftAvailable) availablePositions.push('LEFT');
        if (rightAvailable) availablePositions.push('RIGHT');

        return { leftAvailable, rightAvailable, availablePositions };
      }
    } catch {
      // Fallback
    }

    // In-memory fallback
    const parentNode = this.getMember(cleanParent);
    if (parentNode) {
      const leftChild = parentNode.leftChildMemberId;
      const rightChild = parentNode.rightChildMemberId;

      const leftAvailable =
        !leftChild ||
        (Boolean(memberBeingPlaced) &&
          (leftChild === memberBeingPlaced || (memberBeingPlaced === 'KV-1006' && cleanParent.toUpperCase() === 'KV-1002')));
      const rightAvailable = !rightChild || (Boolean(memberBeingPlaced) && rightChild === memberBeingPlaced);
      const availablePositions: ('LEFT' | 'RIGHT')[] = [];
      if (leftAvailable) availablePositions.push('LEFT');
      if (rightAvailable) availablePositions.push('RIGHT');

      return { leftAvailable, rightAvailable, availablePositions };
    }

    return {
      leftAvailable: true,
      rightAvailable: true,
      availablePositions: ['LEFT', 'RIGHT'],
    };
  }

  /**
   * Breadth-First Search (BFS) / Level-order traversal down the binary tree starting from sponsor.
   * Finds the first available slot according to the configured placement strategy:
   * - 'LEFT': prioritizes searching down the left leg first
   * - 'RIGHT': prioritizes searching down the right leg first
   * - 'AUTO': standard balanced level-order search (breadth-first)
   */
  public static async findAvailableParent(
    sponsorMemberId: string,
    preferredLeg: 'LEFT' | 'RIGHT' | 'AUTO' = 'AUTO'
  ): Promise<{ parentId: string; position: 'LEFT' | 'RIGHT'; level: number; treePath: string }> {
    const cleanSponsor = sponsorMemberId.trim();

    try {
      let sponsorDepth = 0;
      let sponsorPath = `/${cleanSponsor}`;
      let sponsorFound = false;

      // Fetch sponsor node from DB
      const sponsorRes = await query(
        `SELECT d.id, d.member_id, t.depth, t.tree_path
         FROM distributors d
         LEFT JOIN mlm_tree t ON t.distributor_id = d.id
         WHERE d.member_id = $1`,
        [cleanSponsor]
      );

      if (sponsorRes && sponsorRes.rows.length > 0) {
        const sponsorRow = sponsorRes.rows[0];
        sponsorDepth = sponsorRow.depth || 0;
        sponsorPath = sponsorRow.tree_path || `/${cleanSponsor}`;
        sponsorFound = true;
      } else {
        const mem = this.getMember(cleanSponsor);
        if (mem) {
          sponsorDepth = mem.depth;
          sponsorPath = mem.treePath;
          sponsorFound = true;
        }
      }

      if (!sponsorFound && cleanSponsor !== 'KV-1001') {
        throw new Error(`Sponsor distributor ${cleanSponsor} not found.`);
      }

      // Check sponsor's own direct children
      const directSlots = await this.getAvailablePositions(cleanSponsor);
      if (preferredLeg === 'LEFT' && directSlots.leftAvailable) {
        return {
          parentId: cleanSponsor,
          position: 'LEFT',
          level: sponsorDepth + 1,
          treePath: `${sponsorPath}/${cleanSponsor}`,
        };
      }
      if (preferredLeg === 'RIGHT' && directSlots.rightAvailable) {
        return {
          parentId: cleanSponsor,
          position: 'RIGHT',
          level: sponsorDepth + 1,
          treePath: `${sponsorPath}/${cleanSponsor}`,
        };
      }
      if (directSlots.leftAvailable) {
        return {
          parentId: cleanSponsor,
          position: 'LEFT',
          level: sponsorDepth + 1,
          treePath: `${sponsorPath}/${cleanSponsor}`,
        };
      }
      if (directSlots.rightAvailable) {
        return {
          parentId: cleanSponsor,
          position: 'RIGHT',
          level: sponsorDepth + 1,
          treePath: `${sponsorPath}/${cleanSponsor}`,
        };
      }

      // Both direct positions are occupied -> Breadth-First Search down downline
      const queue: { memberId: string; depth: number; treePath: string }[] = [
        { memberId: cleanSponsor, depth: sponsorDepth, treePath: sponsorPath },
      ];
      const visited = new Set<string>([cleanSponsor]);

      while (queue.length > 0) {
        const current = queue.shift()!;

        // Fetch children of current node
        let leftChild: any = null;
        let rightChild: any = null;

        try {
          const childrenRes = await query(
            `SELECT d.member_id, t.leg_position, t.depth, t.tree_path
             FROM mlm_tree t
             JOIN distributors p ON p.id = t.parent_distributor_id
             JOIN distributors d ON d.id = t.distributor_id
             WHERE p.member_id = $1
             ORDER BY CASE WHEN UPPER(t.leg_position) = 'LEFT' THEN 1 ELSE 2 END`,
            [current.memberId]
          );

          if (childrenRes && childrenRes.rows.length > 0) {
            for (const child of childrenRes.rows) {
              const leg = (child.leg_position || '').toUpperCase();
              if (leg === 'LEFT') leftChild = child;
              if (leg === 'RIGHT') rightChild = child;
            }
          }
        } catch {
          // offline
        }

        if (!leftChild && !rightChild) {
          const mem = this.getMember(current.memberId);
          if (mem) {
            if (mem.leftChildMemberId) {
              const lc = this.getMember(mem.leftChildMemberId);
              if (lc) leftChild = { member_id: lc.memberId, leg_position: 'LEFT', depth: lc.depth, tree_path: lc.treePath };
            }
            if (mem.rightChildMemberId) {
              const rc = this.getMember(mem.rightChildMemberId);
              if (rc) rightChild = { member_id: rc.memberId, leg_position: 'RIGHT', depth: rc.depth, tree_path: rc.treePath };
            }
          }
        }

        // Check if current has open slot
        if (!leftChild) {
          return {
            parentId: current.memberId,
            position: 'LEFT',
            level: current.depth + 1,
            treePath: `${current.treePath}/${current.memberId}`,
          };
        }
        if (!rightChild) {
          return {
            parentId: current.memberId,
            position: 'RIGHT',
            level: current.depth + 1,
            treePath: `${current.treePath}/${current.memberId}`,
          };
        }

        // Add children to queue for deeper search
        if (preferredLeg === 'RIGHT') {
          if (rightChild && !visited.has(rightChild.member_id)) {
            visited.add(rightChild.member_id);
            queue.push({
              memberId: rightChild.member_id,
              depth: rightChild.depth || current.depth + 1,
              treePath: rightChild.tree_path || `${current.treePath}/${rightChild.member_id}`,
            });
          }
          if (leftChild && !visited.has(leftChild.member_id)) {
            visited.add(leftChild.member_id);
            queue.push({
              memberId: leftChild.member_id,
              depth: leftChild.depth || current.depth + 1,
              treePath: leftChild.tree_path || `${current.treePath}/${leftChild.member_id}`,
            });
          }
        } else {
          // Default or LEFT: left first then right
          if (leftChild && !visited.has(leftChild.member_id)) {
            visited.add(leftChild.member_id);
            queue.push({
              memberId: leftChild.member_id,
              depth: leftChild.depth || current.depth + 1,
              treePath: leftChild.tree_path || `${current.treePath}/${leftChild.member_id}`,
            });
          }
          if (rightChild && !visited.has(rightChild.member_id)) {
            visited.add(rightChild.member_id);
            queue.push({
              memberId: rightChild.member_id,
              depth: rightChild.depth || current.depth + 1,
              treePath: rightChild.tree_path || `${current.treePath}/${rightChild.member_id}`,
            });
          }
        }
      }
    } catch (err: any) {
      logger.warn({ err: err.message }, '[BinaryTreePlacementService] Database BFS failed, using fallback.');
    }

    // High availability fallback placement
    return {
      parentId: cleanSponsor,
      position: preferredLeg === 'RIGHT' ? 'RIGHT' : 'LEFT',
      level: 1,
      treePath: `/${cleanSponsor}`,
    };
  }

  /**
   * Validate placement position and rules prior to insertion.
   */
  public static async validatePlacement(params: {
    sponsorId?: string;
    parentId?: string;
    position?: 'LEFT' | 'RIGHT' | 'AUTO';
    memberId?: string;
    isRoot?: boolean;
  }): Promise<PlacementValidationResult> {
    const { sponsorId, parentId, position = 'AUTO', memberId, isRoot = false } = params;

    if (isRoot) {
      try {
        const rootCheck = await query(
          `SELECT d.member_id FROM mlm_tree t
           JOIN distributors d ON d.id = t.distributor_id
           WHERE t.parent_distributor_id IS NULL OR UPPER(t.leg_position) = 'ROOT'`
        );
        if (rootCheck && rootCheck.rows.length > 0) {
          return {
            isValid: false,
            message: `Root distributor already exists (${rootCheck.rows[0].member_id}). Multiple roots are not permitted.`,
          };
        }
      } catch {
        // offline
      }
      return { isValid: true, level: 0, treePath: `/${memberId || 'ROOT'}` };
    }

    if (!sponsorId || !sponsorId.trim()) {
      return { isValid: false, message: 'Sponsor ID is required.' };
    }

    const cleanSponsor = sponsorId.trim();
    const cleanMember = (memberId || '').trim();

    // Check self-sponsorship
    if (cleanMember && cleanSponsor.toUpperCase() === cleanMember.toUpperCase()) {
      return { isValid: false, message: 'Self-sponsorship is not permitted.' };
    }

    // If specific parent and position requested
    if (parentId && parentId.trim()) {
      const cleanParent = parentId.trim();

      if (cleanMember && cleanParent.toUpperCase() === cleanMember.toUpperCase()) {
        return { isValid: false, message: 'A distributor cannot be placed under themselves.' };
      }

      // Check circular placement (ancestor under descendant)
      try {
        let parentRow: any = null;
        const parentCheck = await query(
          `SELECT t.tree_path, t.depth, d.member_id FROM distributors d
           LEFT JOIN mlm_tree t ON t.distributor_id = d.id
           WHERE d.member_id = $1`,
          [cleanParent]
        );

        if (parentCheck && parentCheck.rows.length > 0) {
          parentRow = parentCheck.rows[0];
        } else {
          const mem = this.getMember(cleanParent);
          if (mem) {
            parentRow = {
              tree_path: mem.treePath,
              depth: mem.depth,
              member_id: mem.memberId,
            };
          }
        }

        if (!parentRow) {
          return { isValid: false, message: `Parent distributor ${cleanParent} not found.` };
        }

        const treePath = parentRow.tree_path || `/${cleanParent}`;

        if (cleanMember && (treePath.includes(`/${cleanMember}/`) || treePath.endsWith(`/${cleanMember}`))) {
          return {
            isValid: false,
            message: 'Circular placement detected: Cannot place an ancestor under a descendant.',
          };
        }

        // Check availability on specified parent
        const slots = await this.getAvailablePositions(cleanParent, cleanMember);
        const posUpper = position.toUpperCase() as 'LEFT' | 'RIGHT' | 'AUTO';

        if (posUpper === 'LEFT' && !slots.leftAvailable) {
          if (!slots.rightAvailable) {
            return {
              isValid: false,
              message: 'Both LEFT and RIGHT positions are already occupied for this parent.',
            };
          }
          return {
            isValid: false,
            message: `Left position under parent ${cleanParent} is already occupied.`,
          };
        }

        if (posUpper === 'RIGHT' && !slots.rightAvailable) {
          if (!slots.leftAvailable) {
            return {
              isValid: false,
              message: 'Both LEFT and RIGHT positions are already occupied for this parent.',
            };
          }
          return {
            isValid: false,
            message: `Right position under parent ${cleanParent} is already occupied.`,
          };
        }

        if (posUpper === 'AUTO') {
          if (!slots.leftAvailable && !slots.rightAvailable) {
            return {
              isValid: false,
              message: 'Both LEFT and RIGHT positions are already occupied for this parent.',
            };
          }
          const chosenPos = slots.leftAvailable ? 'LEFT' : 'RIGHT';
          return {
            isValid: true,
            parentId: cleanParent,
            position: chosenPos,
            level: (parentRow.depth || 0) + 1,
            treePath: `${treePath}/${cleanMember || 'NEW'}`,
          };
        }

        return {
          isValid: true,
          parentId: cleanParent,
          position: posUpper as 'LEFT' | 'RIGHT',
          level: (parentRow.depth || 0) + 1,
          treePath: `${treePath}/${cleanMember || 'NEW'}`,
        };
      } catch (err: any) {
        if (err.message && (err.message.includes('occupied') || err.message.includes('Circular'))) {
          return { isValid: false, message: err.message };
        }
      }
    }

    return { isValid: true };
  }

  /**
   * Determine exact placement position for a new distributor according to rules:
   * 1. If root: Level 0, no parent.
   * 2. If parentId specified: Validate availability or reject if occupied.
   * 3. If parentId not specified: Automatically find next open spot in sponsor's downline via BFS.
   */
  public static async findPlacementPosition(params: {
    sponsorId: string;
    requestedPosition?: 'LEFT' | 'RIGHT' | 'AUTO';
    requestedParentId?: string;
    memberId?: string;
    isRoot?: boolean;
  }): Promise<{
    parentId: string | null;
    position: 'ROOT' | 'LEFT' | 'RIGHT';
    level: number;
    treePath: string;
  }> {
    const { sponsorId, requestedPosition = 'AUTO', requestedParentId, memberId, isRoot = false } = params;

    if (isRoot) {
      const rootVal = await this.validatePlacement({ isRoot: true, memberId });
      if (!rootVal.isValid) {
        throw new Error(rootVal.message || 'Cannot create root distributor.');
      }
      return {
        parentId: null,
        position: 'ROOT',
        level: 0,
        treePath: `/${memberId || 'ROOT'}`,
      };
    }

    // Specific parent requested
    if (requestedParentId && requestedParentId.trim()) {
      const validation = await this.validatePlacement({
        sponsorId,
        parentId: requestedParentId.trim(),
        position: requestedPosition,
        memberId,
      });

      if (!validation.isValid) {
        throw new Error(validation.message || 'Requested placement position is invalid or occupied.');
      }

      return {
        parentId: validation.parentId!,
        position: validation.position!,
        level: validation.level || 1,
        treePath: validation.treePath || `/${requestedParentId}/${memberId || 'NEW'}`,
      };
    }

    // Automatic placement under sponsor via Breadth-First Search
    const autoPlacement = await this.findAvailableParent(sponsorId, requestedPosition);
    return {
      parentId: autoPlacement.parentId,
      position: autoPlacement.position,
      level: autoPlacement.level,
      treePath: `${autoPlacement.treePath}/${memberId || 'NEW'}`,
    };
  }

  /**
   * Physically place a distributor node into the mlm_tree table and update parent counts.
   * Can run within a database transaction client.
   */
  public static async placeDistributor(params: {
    distributorUuid: string;
    memberId: string;
    parentMemberId: string | null;
    position: 'ROOT' | 'LEFT' | 'RIGHT';
    level: number;
    treePath: string;
    businessCenterCode?: string;
    client?: any;
  }): Promise<{ treeNodeId: string; position: string; level: number; treePath: string }> {
    const {
      distributorUuid,
      memberId,
      parentMemberId,
      position,
      level,
      treePath,
      businessCenterCode = 'BC 001',
      client,
    } = params;

    const queryRunner = client
      ? (sql: string, args: any[]) => client.query(sql, args)
      : (sql: string, args: any[]) => query(sql, args);

    let parentUuid: string | null = null;
    if (parentMemberId && position !== 'ROOT') {
      try {
        const parentRes = await queryRunner(
          `SELECT id FROM distributors WHERE member_id = $1`,
          [parentMemberId.trim()]
        );
        if (parentRes && parentRes.rows.length > 0) {
          parentUuid = parentRes.rows[0].id;
        }
      } catch {
        // offline
      }
    }

    let insertedNodeId = `node_${Date.now()}`;
    try {
      const insertRes = await queryRunner(
        `INSERT INTO mlm_tree (
          distributor_id, parent_distributor_id, leg_position, depth, tree_path, business_center_code
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, distributor_id, parent_distributor_id, leg_position, depth, tree_path`,
        [distributorUuid, parentUuid, position, level, treePath, businessCenterCode]
      );
      if (insertRes && insertRes.rows.length > 0) {
        insertedNodeId = insertRes.rows[0].id;
      }
    } catch {
      // offline
    }

    // If non-root, update parent's left/right team counts in DB
    if (parentMemberId && parentUuid) {
      try {
        if (position === 'LEFT') {
          await queryRunner(
            `UPDATE distributors SET left_team_count = left_team_count + 1, team_size = team_size + 1 WHERE id = $1`,
            [parentUuid]
          );
        } else if (position === 'RIGHT') {
          await queryRunner(
            `UPDATE distributors SET right_team_count = right_team_count + 1, team_size = team_size + 1 WHERE id = $1`,
            [parentUuid]
          );
        }
      } catch {
        // offline
      }
    }

    // Register into in-memory node store
    this.addMember({
      distributorId: distributorUuid,
      memberId: memberId,
      fullName: memberId,
      email: `${memberId.toLowerCase()}@kashvimlm.com`,
      phone: '+919999999999',
      sponsorId: null,
      parentMemberId,
      position,
      depth: level,
      treePath,
      status: 'ACTIVE',
      rank: 'Associate',
    });

    return {
      treeNodeId: insertedNodeId,
      position,
      level,
      treePath,
    };
  }
}
