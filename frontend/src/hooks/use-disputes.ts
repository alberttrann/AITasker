import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
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
