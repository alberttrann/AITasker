import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";
import {
  MilestoneSubmissionDto,
  PaygatedDocumentDto,
  CreateSubmissionDto,
  CreateSubmissionVariable,
  StagePaygatedDocDto,
  StagePaygatedDocVariable,
  BulkStagePaygatedDocsDto,
  BulkStagePaygatedDocsVariable,
} from "@/types/api.types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Submits deliverable evidence (description and attachment URLs) for a milestone from Expert to Client review.
 */
export function useSubmitMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ milestoneId, body }: CreateSubmissionVariable) => {
      const { data } = await apiClient.post<MilestoneSubmissionDto>(
        `/milestones/${milestoneId}/submit`,
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
 * Stages a single technical paygated document link for milestone delivery.
 */
export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ milestoneId, body }: StagePaygatedDocVariable) => {
      const { data } = await apiClient.post<PaygatedDocumentDto>(
        `/milestones/${milestoneId}/paygated-docs`,
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
 * Fetches staged paygated technical documents for a milestone.
 */
export function useDownloadDocument(milestoneId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["milestones", milestoneId, "document"],
    queryFn: async () => {
      const { data } = await apiClient.get<PaygatedDocumentDto[]>(
        `/milestones/${milestoneId}/paygated-docs`,
      );
      return data;
    },
    enabled: isAuthenticated && !!milestoneId,
  });
}

/**
 * Stages multiple technical paygated document URLs for a milestone deliverable package at once.
 */
export function useUploadBulkDocuments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ milestoneId, body }: BulkStagePaygatedDocsVariable) => {
      const { data } = await apiClient.post<{ success: boolean; count: number }>(
        `/milestones/${milestoneId}/paygated-docs/bulk`,
        body,
      );
      return data;
    },

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["milestones", variables.milestoneId],
      });
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
      queryClient.invalidateQueries({ queryKey: ["submissions", variables.milestoneId] });
    },
  });
}

/**
 * Retracts the Expert's latest submission for a milestone before it is reviewed.
 */
export function useRetractLatestSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ milestoneId }: { milestoneId: string }) => {
      const { data } = await apiClient.delete<{ success: boolean; message: string }>(
        `/milestones/${milestoneId}/submissions/latest`,
      );
      return data;
    },

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["milestones", variables.milestoneId],
      });
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
      queryClient.invalidateQueries({ queryKey: ["submissions", variables.milestoneId] });
    },
  });
}

/**
 * Fetches historical deliverable submissions for a specific milestone.
 */
export function useGetSubmissions(milestoneId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["submissions", milestoneId],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/milestones/${milestoneId}/submissions`,
      );
      return data;
    },
    enabled: isAuthenticated && !!milestoneId,
  });
}

/**
 * Fetches the most recent deliverable submission for a specific milestone.
 */
export function useGetLatestSubmission(milestoneId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["submissions", milestoneId, "latest"],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/milestones/${milestoneId}/submissions/latest`,
      );
      return data;
    },
    enabled: isAuthenticated && !!milestoneId,
  });
}