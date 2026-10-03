import { z } from 'zod';

export const treeAuditActionEnum = z.enum([
  'DISTRIBUTOR_CREATED',
  'SPONSOR_ASSIGNED',
  'TREE_MEMBER_PLACED',
  'TREE_MEMBER_MOVED',
  'TREE_MEMBER_REMOVED',
  'TREE_POSITION_CHANGED',
]);

/**
 * Schema for Admin Changing Placement (Prompt 16)
 * Strictly requires:
 * - Reason
 * - Old Parent
 * - Old Position ('LEFT' | 'RIGHT')
 * - New Parent
 * - New Position ('LEFT' | 'RIGHT')
 * - Admin ID (provided in body or derived from authenticated user)
 */
export const adminChangePlacementSchema = z.object({
  memberId: z
    .string({ required_error: 'Member ID is required.' })
    .min(1, 'Member ID cannot be empty.'),
  reason: z
    .string({ required_error: 'Reason is required when changing placement.' })
    .min(3, 'Reason must be at least 3 characters explaining the change.'),
  oldParent: z
    .string({ required_error: 'Old Parent identifier is required.' })
    .min(1, 'Old Parent cannot be empty.'),
  oldPosition: z.enum(['LEFT', 'RIGHT'], {
    required_error: 'Old Position must be LEFT or RIGHT.',
  }),
  newParent: z
    .string({ required_error: 'New Parent identifier is required.' })
    .min(1, 'New Parent cannot be empty.'),
  newPosition: z.enum(['LEFT', 'RIGHT'], {
    required_error: 'New Position must be LEFT or RIGHT.',
  }),
  adminId: z.string().optional(),
});

export const adminRemoveMemberSchema = z.object({
  memberId: z
    .string({ required_error: 'Member ID is required.' })
    .min(1, 'Member ID cannot be empty.'),
  reason: z
    .string({ required_error: 'Reason is required to remove a member.' })
    .min(3, 'Reason must be at least 3 characters.'),
  adminId: z.string().optional(),
});

export const getTreeAuditLogsQuerySchema = z.object({
  memberId: z.string().optional(),
  action: treeAuditActionEnum.optional(),
  actorId: z.string().optional(),
  adminId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50).optional(),
  offset: z.coerce.number().min(0).default(0).optional(),
});

export type AdminChangePlacementDto = z.infer<typeof adminChangePlacementSchema>;
export type AdminRemoveMemberDto = z.infer<typeof adminRemoveMemberSchema>;
export type GetTreeAuditLogsQueryDto = z.infer<typeof getTreeAuditLogsQuerySchema>;
