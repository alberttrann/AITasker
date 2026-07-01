import { apiClient } from '@/lib/api-client';
import type { PortfolioSubmissionDetailDto, PortfolioListItemDto } from '@/types/api.types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * usePortfolioSubmission — fetch a single submission by ID.
 * Used in VerificationHistoryPage detail expansion.
 * Corresponds to GET /portfolio-submissions/:id
 */
export function usePortfolioSubmission(submissionId: string | undefined) {
  return useQuery({
    queryKey: ['portfolio-submission', submissionId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/portfolio-submissions/${submissionId}`);
      return data as PortfolioSubmissionDetailDto;
    },
    enabled: !!submissionId,
    staleTime: 30_000,
  });
}
 
/**
 * useMyPortfolioSubmissions — list all submissions for the logged-in expert.
 * Corresponds to GET /portfolio-submissions  (added in PATCH BE-10)
 * Used in /expert/verification-history page.
 */
export function useMyPortfolioSubmissions() {
  return useQuery({
    queryKey: ['portfolio-submissions', 'mine'],
    queryFn: async () => {
      const { data } = await apiClient.get('/portfolio-submissions');
      // Backend returns a plain array; guard for future paginated shape
      return (Array.isArray(data) ? data : (data as any)?.data ?? []) as PortfolioListItemDto[];
    },
    staleTime: 60_000,
  });
}