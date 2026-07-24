import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import { useAuthStore } from "@store/auth.store";
import { EngagementDto } from "@/types/api.types";
import type { DisputeState, EscrowStatus } from "@/types/enums";

export function useEngagements() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["engagements"],
    queryFn: async () => {
      const { data } = await apiClient.get<EngagementDto[]>("/engagements");
      return data;
    },
    enabled: isAuthenticated,
  });
}

export function useTechTeamEngagements() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const techTeamId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: ["engagements", "tech-team"],
    queryFn: async () => {
      const { data } = await apiClient.get<EngagementDto[]>("/engagements");
      return data;
    },
    enabled: isAuthenticated && !!techTeamId,
    staleTime: 10_000,
    refetchInterval: 5_000, // Polling fallback
  });
}

export function useCeoEngagements(projectId: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  
  return useQuery({
    queryKey: ["engagements", "ceo", projectId],
    queryFn: async () => {
      const { data } = await apiClient.get<EngagementDto[]>("/engagements");
      return data;
    },
    enabled: isAuthenticated && !!projectId,
    staleTime: 10_000,
    refetchInterval: 5_000, // Polling fallback
  });
}

export function useEngagement(engagementId: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["engagements", engagementId],
    queryFn: async () => {
      const { data } = await apiClient.get<EngagementDto>(
        `/engagements/${engagementId}`,
      );
      return data;
    },
    enabled: isAuthenticated && !!engagementId,
  });
}

export function useAcceptNda() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Inside the <> is the data shape of BE returns to FE
      const { data } = await apiClient.put<EngagementDto>(
        `/engagements/${id}/accept-nda`,
      );
      return data;
    },

    // Using onSuccess and invalidatQueries to make the UI rerender automatically
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["engagements", id] });
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
    },
  });
}

export function useAcceptConnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<EngagementDto>(
        `/engagements/${id}/connect`,
      );
      return data;
    },

    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["engagements", id] });
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
    },
  });
}

export function useDecline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put<EngagementDto>(
        `/engagements/${id}/decline`,
      );
      return data;
    },

    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["engagements", id] });
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
    },
  });
}

export function useEngagementMilestones(engagementId: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["engagements", engagementId, "milestones"],
    queryFn: async () => {
      const { data } = await apiClient.get<any[]>(
        `/engagements/${engagementId}/milestones`,
      );
      return data;
    },
    enabled: isAuthenticated && !!engagementId,
  });
}

export function useCancelEngagement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put<EngagementDto>(`/engagements/${id}/cancel`);
      return data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["engagements", id] });
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
    },
  });
}

export interface EngagementScopedSubmissionDto {
  id: string;
  milestoneId: string;
  expertId: string;
  description: string | null;
  filesJson: string[];
  submittedAt: string;
  milestone: {
    milestoneNumber: number;
    deliverableStatement: string | null;
  };
}

export interface EngagementScopedDisputeDto {
  id: string;
  engagementId: string;
  milestoneId: string | null;
  criterionId: string;
  escrowAccountId: string;
  filedBy: string;
  state: DisputeState;
  llmConfidence: number | null;
  resolution: "EXPERT_WINS" | "CLIENT_WINS" | "SPLIT" | null;
  llmReasoning: string | null;
  filedAt: string;
  resolvedAt: string | null;
  resolvedBy?: string | null;
  criterion: {
    criterionText: string;
  };
  milestone: {
    milestoneNumber: number;
    deliverableStatement: string | null;
    paymentAmountVnd: number;
  } | null;
  escrowAccount: {
    status: EscrowStatus;
    amount: number;
  };
}

export function useEngagementSubmissions(engagementId: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["engagements", engagementId, "submissions"],
    queryFn: async () => {
      const { data } = await apiClient.get<EngagementScopedSubmissionDto[]>(
        `/engagements/${engagementId}/submissions`,
      );
      return data;
    },
    enabled: isAuthenticated && !!engagementId,
  });
}

export function useEngagementDisputes(engagementId: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["engagements", engagementId, "disputes"],
    queryFn: async () => {
      const { data } = await apiClient.get<EngagementScopedDisputeDto[]>(
        `/engagements/${engagementId}/disputes`,
      );
      return data;
    },
    enabled: isAuthenticated && !!engagementId,
  });
}