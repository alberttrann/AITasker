import apiClient from "@/lib/api-client";
import {
  MilestoneDodItemDto,
  CreateDodItemDto,
  CreateDodItemVariable,
  UpdateMilestoneDoDItemDto,
  UpdateMilestoneDoDItemVariable,
} from "@/types/api.types";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";

/**
 * Creates a single Definition of Done (DoD) checklist item for a milestone.
 */
export function useCreateDodItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ milestoneId, body }: CreateDodItemVariable) => {
      const { data } = await apiClient.post<MilestoneDodItemDto>(
        `/milestones/${milestoneId}/dod/items`,
        body,
      );
      return data;
    },

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["milestones", variables.milestoneId],
      });
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
    },
  });
}

/**
 * Updates the status (PENDING, COMPLETED, NOT_APPLICABLE) and completion/N/A notes for a DoD item.
 */
export function useUpdateDodStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      milestoneId,
      itemId,
      body,
    }: UpdateMilestoneDoDItemVariable) => {
      const { data } = await apiClient.put<MilestoneDodItemDto>(
        `/milestones/${milestoneId}/dod/${itemId}`,
        body,
      );
      return data;
    },

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["milestones", variables.milestoneId],
      });
      queryClient.invalidateQueries({
        queryKey: ["milestones", variables.milestoneId, "dod"],
      });
    },
  });
}

/**
 * Fetches the Definition of Done (DoD) checklist items for a specific milestone.
 */
export function useGetDodItems(milestoneId: string) {
  return useQuery({
    queryKey: ["milestones", milestoneId, "dod"],
    queryFn: async () => {
      const { data } = await apiClient.get(`/milestones/${milestoneId}/dod`);
      return Array.isArray(data) ? data : (data as any)?.data ?? [];
    },
    enabled: !!milestoneId,
  });
}

/**
 * Removes a Definition of Done (DoD) item from a milestone checklist.
 */
export function useDeleteDodItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ milestoneId, itemId }: { milestoneId: string; itemId: string }) => {
      const { data } = await apiClient.delete(`/milestones/${milestoneId}/dod/${itemId}`);
      return data;
    },
    onSuccess: (_data, variables) => {
      // Invalidate both the specific milestone and the global milestone list for instant UI updates
      queryClient.invalidateQueries({
        queryKey: ["milestones", variables.milestoneId],
      });
      queryClient.invalidateQueries({
        queryKey: ["milestones"],
      });
    },
  });
}

/**
 * Bulk-adds multiple Definition of Done (DoD) items to a milestone at once.
 */
export function useCreateBulkDodItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ milestoneId, body }: any) => {
      const { data } = await apiClient.post(
        `/milestones/${milestoneId}/dod/items/bulk`,
        body,
      );
      return data;
    },

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["milestones", variables.milestoneId],
      });
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
    },
  });
}
