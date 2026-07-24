import apiClient from "@/lib/api-client";
import {
  MilestoneDodItemDto,
  CreateDodItemDto,
  CreateDodItemVariable,
  UpdateMilestoneDoDItemDto,
  UpdateMilestoneDoDItemVariable,
} from "@/types/api.types";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";

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
