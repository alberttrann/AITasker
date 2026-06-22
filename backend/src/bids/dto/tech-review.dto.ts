import { z } from 'zod';

export const TechReviewSchema = z
  .object({
    action: z.enum(['APPROVED', 'REVISION_REQUESTED']),
    tech_feedback: z.string().min(1).optional(),
  })
  .refine(
    (d) =>
      d.action !== 'REVISION_REQUESTED' || (d.tech_feedback != null && d.tech_feedback.length > 0),
    {
      message: 'tech_feedback is required when action is REVISION_REQUESTED',
      path: ['tech_feedback'],
    },
  );

export type TechReviewDto = z.infer<typeof TechReviewSchema>;
