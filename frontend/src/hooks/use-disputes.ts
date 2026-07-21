import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { MilestoneSettlementOutcome } from "@/lib/dispute-resolution";
import { useAuthStore } from "@/store/auth.store";
import type { CreateDisputePayload, DisputeDto } from "@/types/api.types";

export function useCreateDispute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateDisputePayload) => {
      const { data } = await apiClient.post<DisputeDto>("/disputes", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
      queryClient.invalidateQueries({ queryKey: ["disputes"] });
    },
  });
}

export function useDispute(disputeId: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["disputes", disputeId],
    queryFn: async () => {
      const { data } = await apiClient.get<DisputeDto>(`/disputes/${disputeId}`);
      return data;
    },
    enabled: isAuthenticated && !!disputeId,
  });
}

export function useDisputes(state?: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["disputes", { state }],
    queryFn: async () => {
      const params = state ? { state } : undefined;
      const { data } = await apiClient.get<DisputeDto[]>("/disputes", { params });
      return data;
    },
    enabled: isAuthenticated,
  });
}

/**
 * Derives a resolved milestone's real money movement from its escrow status.
 * Milestone state alone is insufficient because every dispute outcome moves
 * the milestone to APPROVED, including refunds and split settlements.
 */
export function useMilestoneSettlement(milestoneId: string | undefined) {
  const query = useDisputes();
  const dispute = query.data?.find(
    (item) => (item.milestoneId ?? item.milestone_id) === milestoneId,
  );
  const escrowStatus = dispute?.escrowAccount?.status;

  let outcome: MilestoneSettlementOutcome | null = null;
  if (dispute) {
    if (escrowStatus === "RELEASED") outcome = "EXPERT_RELEASED";
    else if (escrowStatus === "REFUNDED") outcome = "CLIENT_REFUNDED";
    else if (escrowStatus === "SPLIT") outcome = "SPLIT";
    else if (escrowStatus === "HELD") outcome = "FUNDS_HELD";
    else if (escrowStatus === "FROZEN") outcome = "FUNDS_FROZEN";
    else if (dispute.state === "AUTO_RESOLVED" || dispute.state === "RESOLVED") {
      outcome = "UNKNOWN";
    }
  }

  return {
    ...query,
    dispute,
    settlementOutcome: outcome,
  };
}
