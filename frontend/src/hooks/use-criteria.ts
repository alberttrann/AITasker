import apiClient from "@/lib/api-client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import type {
  VerifyCriterionDto,
  VerifyCriterionVariable,
  RevisionNoteDto,
  RevisionNoteVariable,
} from "@/types/api.types";


/**
 * Marks an individual acceptance criterion as verified by the authorized party (CEO or Tech Team).
 * Triggers automatic milestone funding release if all required criteria pass.
 */
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

/**
 * Rejects a submitted criterion and requests revisions from the Expert, returning the milestone to IN_REVISION state.
 */
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

/**
 * Fetches the list of acceptance criteria defined for a specific milestone.
 */
export function useGetCriteria(milestoneId: string) {
  return useQuery({
    queryKey: ["milestones", milestoneId, "criteria"],
    queryFn: async () => {
      const { data } = await apiClient.get(`/criteria/${milestoneId}`);
      return Array.isArray(data) ? data : (data as any)?.data ?? [];
    },
    enabled: !!milestoneId,
  });
}

/**
 * Adds a new acceptance criterion requirement to an active milestone.
 */
export function useCreateCriterion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ milestoneId, body }: { milestoneId: string; body: { criterion_text: string; is_required?: boolean } }) => {
      const { data } = await apiClient.post(`/criteria/${milestoneId}`, body);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["milestones", variables.milestoneId] });
      queryClient.invalidateQueries({ queryKey: ["milestones", variables.milestoneId, "criteria"] });
    },
  });
}

/**
 * Deletes an existing acceptance criterion from a milestone.
 */
export function useDeleteCriterion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ criterionId, milestoneId }: { criterionId: string; milestoneId: string }) => {
      const { data } = await apiClient.delete(`/criteria/${criterionId}`);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["milestones", variables.milestoneId] });
      queryClient.invalidateQueries({ queryKey: ["milestones", variables.milestoneId, "criteria"] });
    },
  });
}
