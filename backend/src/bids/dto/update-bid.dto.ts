import { z } from 'zod';

// JSONB sub-schemas — mirror docs/06-enum-domains.md §F
// (same as create-bid.dto.ts; keep duplicated rather than imported so the DTOs
// can diverge independently if revision validation ever changes).

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

// PUT /bids/:id body — the 3 bid components, no projectId (it's implicit in the URL).
export const UpdateBidSchema = z.object({
  footprint_alignment_json: footprintAlignment,
  approach_summary: z.string().min(1),
  conditional_pricing_json: conditionalPricing.min(1),
});

export type UpdateBidDto = z.infer<typeof UpdateBidSchema>;
