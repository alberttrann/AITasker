import { z } from 'zod';

// JSONB sub-schemas — mirror docs/06-enum-domains.md §F
// DOMAIN_CODE: A | B | C | D | E | F
// SEAM_CODE:   A<->C | A<->F | A<->D | D<->E | D<->F | C<->F | E<->F | A<->B | B<->E | C<->E
// DOMAIN_DEPTH: SURFACE | OPERATIONAL | DEEP
// VERIFY_TIER: CLAIMED | EVIDENCE_BACKED

const footprintAlignment = z.object({
  domains: z.array(
    z.object({
      code: z.enum(['A', 'B', 'C', 'D', 'E', 'F']),
      depth: z.enum(['SURFACE', 'OPERATIONAL', 'DEEP']),
    }),
  ),
  seams: z.array(
    z.object({
      code: z.enum([
        'A<->C',
        'A<->F',
        'A<->D',
        'D<->E',
        'D<->F',
        'C<->F',
        'E<->F',
        'A<->B',
        'B<->E',
        'C<->E',
      ]),
      tier: z.enum(['CLAIMED', 'EVIDENCE_BACKED']),
    }),
  ),
});

const conditionalPricing = z.array(
  z.object({
    milestone_number: z.number().int().positive(),
    price_vnd: z.number().int().positive(),
    condition: z.string().nullable(),
  }),
);

export const CreateBidSchema = z.object({
  projectId: z.string().uuid(),
  footprint_alignment_json: footprintAlignment,
  approach_summary: z.string().min(1),
  conditional_pricing_json: conditionalPricing.min(1),
});

export type CreateBidDto = z.infer<typeof CreateBidSchema>;
