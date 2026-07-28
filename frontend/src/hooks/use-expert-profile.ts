import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { DepthLevel } from '@/types/enums';

/**
 * Main hook for an Expert user to fetch their own profile and sync domain depths, seam claims, stack tags, bio, and engagement model preferences.
 */
export function useExpertProfile(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['expert-profile', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get('/expert-profile/me');
      return data;
    },
    ...options,
  });

  const getPublicProfile = async (expertId: string) => {
    // Left for backwards compatibility if needed, but we prefer the hook below
    const { data } = await apiClient.get(`/users/${expertId}/public-profile`);
    return data;
  };

  const saveDomains = useMutation({
    mutationFn: async (domains: { domainCode: string; depthLevel: string }[]) => {
      await apiClient.put('/expert-profile/domains/sync', {
        domains: domains.map(d => ({ domainCode: d.domainCode, depthLevel: d.depthLevel })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expert-profile', 'me'] });
    },
  });

  const saveSeams = useMutation({
    mutationFn: async (seams: { code: string }[]) => {
      await apiClient.put('/expert-profile/seams/sync', {
        seams: seams.map(s => s.code),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expert-profile', 'me'] });
    },
  });

  const saveStackAndModel = useMutation({
    mutationFn: async (payload: { engagementModel?: string; stackTagsJson?: string[]; archetypeHistoryJson?: any[]; bio?: string }) => {
      await apiClient.put('/expert-profile/me', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expert-profile', 'me'] });
    },
  });

  return {
    profile: profileQuery.data,
    isLoadingProfile: profileQuery.isLoading,
    getPublicProfile,
    saveDomains,
    saveSeams,
    saveStackAndModel,
  };
}

/**
 * Updates an individual domain depth level declaration (SURFACE, OPERATIONAL, DEEP) for an expert.
 */
export function useUpdateDomainDepth() {
  const queryClient = useQueryClient();
 
  return useMutation({
    mutationFn: async ({ id, depthLevel }: { id: string; depthLevel: DepthLevel }) => {
      const { data } = await apiClient.put(`/expert-profile/domains/${id}`, { depthLevel });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expert-profile', 'me'] });
    },
  });
}

// ── Phase 6 Hooks: CEO Browsing Experts ────────────────────────────────────────

/**
 * Allows Client CEOs to search and filter expert profiles by domain, seam, or stack tag.
 */
export function useExpertSearch(queryParams?: Record<string, any>, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['expert-profile', 'search', queryParams],
    queryFn: async () => {
      const { data } = await apiClient.get('/expert-profile/search', { params: queryParams });
      return Array.isArray(data) ? data : (data as any)?.data ?? [];
    },
    ...options,
  });
}

/**
 * Fetches the public portfolio and verified capability profile of a specific Expert for CEO view.
 */
export function usePublicExpertProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['expert-profile', 'public', userId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/expert-profile/${userId}`);
      return data;
    },
    enabled: !!userId,
  });
}
