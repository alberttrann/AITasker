import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export function useExpertProfile() {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['expert-profile', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get('/expert-profile/me');
      return data;
    },
  });

  const saveDomains = useMutation({
    mutationFn: async (domains: { domainCode: string; depthLevel: string }[]) => {
      await Promise.all(
        domains.map(d =>
          apiClient.post('/expert-profile/domains', {
            domainCode: d.domainCode,
            depthLevel: d.depthLevel,
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expert-profile', 'me'] });
    },
  });

  const saveSeams = useMutation({
    mutationFn: async (seams: { code: string }[]) => {
      await Promise.all(
        seams.map(s =>
          apiClient.post('/expert-profile/seams', { seamCode: s.code })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expert-profile', 'me'] });
    },
  });

  const saveStackAndModel = useMutation({
    mutationFn: async (payload: { engagementModel: string; stackTagsJson: string[]; archetypeHistoryJson: any[] }) => {
      await apiClient.put('/expert-profile/me', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expert-profile', 'me'] });
    },
  });

  return {
    profile: profileQuery.data,
    isLoadingProfile: profileQuery.isLoading,
    saveDomains,
    saveSeams,
    saveStackAndModel,
  };
}
