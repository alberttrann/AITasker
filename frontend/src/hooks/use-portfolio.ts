import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export function usePortfolio() {
  const queryClient = useQueryClient();

  const submitPortfolio = useMutation({
    mutationFn: async (payload: { seamClaimId: string; projectDescription: string; decisionPoints: string }) => {
      const { data } = await apiClient.post('/portfolio-submissions', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expert-profile', 'me'] });
    },
  });

  return {
    submitPortfolio,
  };
}
