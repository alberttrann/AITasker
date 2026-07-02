import { apiClient } from '@/lib/api-client';
import type { PortfolioSubmissionDetailDto, PortfolioListItemDto } from '@/types/api.types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * useMyPortfolioSubmissions — fetch all submissions for the authenticated expert.
 * Corresponds to GET /portfolio-submissions
 */
export function useMyPortfolioSubmissions() {
  return useQuery({
    queryKey: ['portfolio-submissions'],
    queryFn: async () => {
      const { data } = await apiClient.get('/portfolio-submissions');
      return (Array.isArray(data) ? data : (data as any)?.data ?? []) as PortfolioListItemDto[];
    },
    staleTime: 60_000,
  });
}

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
    staleTime: 60_000,
  });
}

/**
 * usePortfolio — handles submitting new portfolio evidence.
 */
export function usePortfolio() {
  const queryClient = useQueryClient();

  const submitPortfolio = useMutation({
    mutationFn: async (payload: { seamClaimId: string; projectDescription: string; decisionPoints: string }) => {
      const { data } = await apiClient.post('/portfolio-submissions', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-submissions'] });
      // Might want to invalidate profile too since submission counts change
      queryClient.invalidateQueries({ queryKey: ['expert-profile'] });
    },
  });

  return { submitPortfolio };
}
 
