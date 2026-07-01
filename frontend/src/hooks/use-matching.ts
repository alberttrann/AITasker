import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ShortlistDto } from '@/types/api.types';
import type { MatchResult } from '@/types/jsonb.types';  
 
const STRENGTH_ORDER: Record<string, number> = {
  STRONG_MATCH:   4,
  GOOD_MATCH:     3,
  POSSIBLE_MATCH: 2,
  WEAK_MATCH:     1,
};
 
export async function getShortlist(projectId: string): Promise<ShortlistDto> {
  const { data } = await apiClient.get<ShortlistDto | MatchResult[]>(
    `/matching/${projectId}/shortlist`,
  );
  if (Array.isArray(data)) {
    return { project_id: projectId, results: data, generated_at: new Date().toISOString() };
  }
  return data as ShortlistDto;
}
 
// Hook
/**
 * useShortlist — reactive shortlist for a project.
 *
 * Returns:
 *   experts       — MatchResult[] sorted STRONG → WEAK
 *   isLoading     — initial load spinner flag
 *   isRefreshing  — true while the ?refresh=true call is in-flight
 *   refreshError  — Error | null
 *   lastUpdatedAt — JS timestamp of the last successful fetch (from React Query)
 *   refresh()     — triggers backend re-score via ?refresh=true, then updates cache
 */
export function useShortlist(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['shortlist', projectId] as const;
 
  const query = useQuery({
    queryKey,
    queryFn: () => getShortlist(projectId!),
    enabled: !!projectId,
    staleTime: 5 * 60_000,
  });
 
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get<ShortlistDto | MatchResult[]>(
        `/matching/${projectId}/shortlist`,
        { params: { refresh: true } },
      );
      if (Array.isArray(data)) {
        return {
          project_id: projectId!,
          results: data,
          generated_at: new Date().toISOString(),
        } as ShortlistDto;
      }
      return data as ShortlistDto;
    },
    onSuccess: (freshData) => {
      queryClient.setQueryData(queryKey, freshData);
    },
  });
 
  const raw = query.data?.results ?? [];
  const experts = [...raw].sort(
    (a, b) =>
      (STRENGTH_ORDER[b.strength_label] ?? 0) - (STRENGTH_ORDER[a.strength_label] ?? 0),
  );
 
  return {
    experts,
    isLoading:    query.isLoading,
    isRefreshing: refreshMutation.isPending,
    refreshError: refreshMutation.error,
    lastUpdatedAt: query.dataUpdatedAt,
    refresh:      refreshMutation.mutate,
  };
}