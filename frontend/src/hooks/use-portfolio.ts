import { apiClient } from '@/lib/api-client';
import type { PortfolioSubmissionDetailDto, PortfolioListItemDto } from '@/types/api.types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * useMyPortfolioSubmissions — fetch all submissions for the authenticated expert.
 * Corresponds to GET /expert-profile/me/portfolio
 */
export function useMyPortfolioSubmissions() {
  return useQuery({
    queryKey: ['portfolio-submissions'],
    queryFn: async () => {
      const { data } = await apiClient.get('/expert-profile/me/portfolio');
      return (Array.isArray(data) ? data : (data as any)?.data ?? []) as PortfolioListItemDto[];
    },
    staleTime: 60_000,
  });
}

/**
 * usePortfolioSubmission — fetch a single submission by ID.
 * Used in VerificationHistoryPage detail expansion.
 * Corresponds to GET /expert-profile/me/portfolio/:id
 */
export function usePortfolioSubmission(submissionId: string | undefined) {
  return useQuery({
    queryKey: ['portfolio-submission', submissionId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/expert-profile/me/portfolio/${submissionId}`);
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
    mutationFn: async (payload: { seam_code: string; project_description: string; decision_points: string }) => {
      const { data } = await apiClient.post('/expert-profile/me/portfolio', payload);
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

export function useDeletePortfolioEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/expert-profile/me/portfolio/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['expert-profile'] });
    },
  });
}
