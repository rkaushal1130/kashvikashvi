import { z } from 'zod';

export const sponsorIdParamSchema = z.object({
  sponsorId: z.string().min(1, 'Sponsor ID is required').trim(),
});

export type SponsorIdParamInput = z.infer<typeof sponsorIdParamSchema>;
