import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";
import {
  MilestoneSubmissionDto,
  PaygatedDocumentDto,
  CreateSubmissionDto,
  CreateSubmissionVariable,
  StagePaygatedDocDto,
  StagePaygatedDocVariable,
} from "@/types/api.types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
