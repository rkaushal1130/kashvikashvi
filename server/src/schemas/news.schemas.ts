import { z } from 'zod';

export const createNewsSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200, 'Title max 200 characters'),
  summary: z.string().min(10, 'Summary must be at least 10 characters').max(500, 'Summary max 500 characters'),
  content: z.string().min(20, 'Content must be at least 20 characters'),
  category: z.enum(['Announcement', 'Product Launch', 'Contest', 'Leadership', 'Payout', 'General']).default('Announcement'),
  isTicker: z.boolean().default(false),
  imageUrl: z.string().url().optional(),
});

export const updateNewsSchema = createNewsSchema.partial();
