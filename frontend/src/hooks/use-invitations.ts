import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";
import type { InvitationDto } from "@/types/api.types";

/**
 * Fetches direct project invitations received by the current Expert user from Client CEOs.
 */
export function useInvitations() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const activeRole = useAuthStore((s) => s.activeRole);

  return useQuery({
    queryKey: ["invitations", "expert"],
    queryFn: async () => {
      const { data } = await apiClient.get<InvitationDto[]>("/invitations");
      return data;
    },
    enabled: isAuthenticated && activeRole === 'EXPERT',
  });
}

/**
 * Declines an incoming direct project invitation as an Expert.
 */
export function useDeclineInvitation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<InvitationDto>(`/invitations/${id}/decline`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitations", "expert"] });
    },
  });
}

/**
 * Fetches outgoing direct project invitations sent by the Client CEO to Experts.
 */
export function useSentInvitations() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const activeRole = useAuthStore((s) => s.activeRole);

  return useQuery({
    queryKey: ["invitations", "sent"],
    queryFn: async () => {
      const { data } = await apiClient.get<InvitationDto[]>("/invitations/sent");
      return data;
    },
    enabled: isAuthenticated && activeRole === 'CLIENT',
  });
}

/**
 * Retracts/cancels an outgoing direct project invitation sent by the CEO before the Expert responds.
 */
export function useRetractInvitation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<InvitationDto>(`/invitations/${id}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitations", "sent"] });
    },
  });
}
