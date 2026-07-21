import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";
import { CreateMilestonePayload, MilestoneDetailDto, MilestoneDto } from "@/types/api.types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useCreateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateMilestonePayload) => {
      const { data } = await apiClient.post<MilestoneDto>(
        `/milestones`,
        payload,
      );

      return data;
    },

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      queryClient.invalidateQueries({
        queryKey: ["engagements", variables.engagement_id],
      });
    },
  });
}

export interface BulkInitializeMilestonesPayload {
  engagementId: string;
  milestones: {
    milestoneNumber: number;
    deliverableStatement: string;
    paymentAmountVnd: number;
    criteria: {
      criterion_text: string;
      is_required?: boolean;
    }[];
  }[];
}

export function useBulkInitializeMilestones() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BulkInitializeMilestonesPayload) => {
      const { data } = await apiClient.post<any>(
        `/milestones/bulk`,
        payload
      );
      return data;
    },

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      queryClient.invalidateQueries({
        queryKey: ["engagements", variables.engagementId],
      });
    },
  });
}

// Adjust later for the MilestoneDTO
export function useMilestone(milestoneId: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["milestones", milestoneId],
    queryFn: async () => {
      const { data } = await apiClient.get<MilestoneDetailDto>(
        `/milestones/${milestoneId}`,
      );
      return data;
    },
    enabled: isAuthenticated && !!milestoneId,
  });
}

export function useFundMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (milestoneId: string) => {
      const { data } = await apiClient.put<MilestoneDto>(
        `/milestones/${milestoneId}/fund`,
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["milestones", variables] });
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}
