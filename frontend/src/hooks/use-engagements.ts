import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import { useAuthStore } from "@store/auth.store";
import { EngagementDto } from "@/types/api.types";

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
