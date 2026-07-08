import apiClient from "@/lib/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  VerifyCriterionDto,
  VerifyCriterionVariable,
  RevisionNoteDto,
  RevisionNoteVariable,
} from "@/types/api.types";


export function useVerifyCriterion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ criterionId, body }: VerifyCriterionVariable) => {
      const { data } = await apiClient.put<{
        success: boolean;
        message: string;
      }>(`/criteria/${criterionId}/verify`, body);
      return data;
    },

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

export function useRequestRevision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ criterionId, body }: RevisionNoteVariable) => {
      const { data } = await apiClient.put<{
        success: boolean;
        message: string;
      }>(`/criteria/${criterionId}/revision`, body);

      return data;
    },

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
    },
  });
}
