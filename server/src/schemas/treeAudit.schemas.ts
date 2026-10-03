import { z } from 'zod';

/**
 * Strict validation schemas for MLM Binary Tree Operations & Audit Logging (Prompt 16)
 * Tree relationships must never be silently modified.
 */

export const moveDistributorSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required to move a distributor.'),
  reason: z.string().min(3, 'A valid reason is required to move a distributor (minimum 3 characters).'),
  oldParent: z.string().min(1, 'Old Parent is required to move a distributor.'),
  oldPosition: z.string().min(1, 'Old Position is required to move a distributor.'),
  newParent: z.string().min(1, 'New Parent is required to move a distributor.'),
  newPosition: z.string().min(1, 'New Position is required to move a distributor.'),
  adminId: z.string().optional(),
  timestamp: z.string().optional(),
});

export const placeMemberSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required.'),
  sponsorId: z.string().min(1, 'Sponsor ID is required.'),
  placementParentId: z.string().min(1, 'Placement Parent ID is required.'),
  position: z.enum(['LEFT', 'RIGHT', 'left', 'right', 'auto', 'AUTO']),
  reason: z.string().optional(),
});

export const changePositionSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required.'),
  oldPosition: z.string().min(1, 'Old Position is required.'),
  newPosition: z.string().min(1, 'New Position is required.'),
  reason: z.string().min(3, 'Reason is required to change tree position.'),
});

export const removeMemberSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required.'),
  reason: z.string().min(3, 'Reason is required to remove a member from the tree.'),
});

export const assignSponsorSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required.'),
  oldSponsorId: z.string().optional(),
  newSponsorId: z.string().min(1, 'New Sponsor ID is required.'),
  reason: z.string().optional(),
});
