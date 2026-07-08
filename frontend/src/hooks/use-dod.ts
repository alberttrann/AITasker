import apiClient from "@/lib/api-client";
import {
  MilestoneDodItemDto,
  CreateDodItemDto,
  CreateDodItemVariable,
  UpdateMilestoneDoDItemDto,
  UpdateMilestoneDoDItemVariable,
} from "@/types/api.types";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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
    },
  });
}
