import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { DepthLevel } from '@/types/enums';
 
/**
 * useUpdateDomainDepth — update the depth level of an already-claimed domain.
 * Hits PUT /expert-profile/domains/:id
 *
 * Use when the expert changes depth for an EXISTING domain entry.
 * For a brand-new domain (not yet in the profile), use the existing
 * saveDomains mutation (POST /expert-profile/domains) from useExpertProfile().
 *
 * Usage in DomainDepthGrid:
 *   const existing = profile.domainDepths.find(d => d.domainCode === code);
 *   if (existing?.id) {
 *     updateDomainDepth.mutate({ id: existing.id, depthLevel });
 *   } else {
 *     saveDomains.mutate([{ domainCode: code, depthLevel }]);
 *   }
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