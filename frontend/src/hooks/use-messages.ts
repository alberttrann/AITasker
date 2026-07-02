import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import { useSocket } from "./use-socket";

// SOCKET - no REST, just emit the event
export function useSendMessage() {
  const socket = useSocket();

  return (payload: {
    engagement_id?: string;
    project_id?: string;
    content: string;
  }) => {
    socket?.emit("sendMessage", payload);
  };
}

export function useMessages(engagementId: string | undefined) {
  return useQuery({
    queryKey: ["messages", engagementId],
    queryFn: () => apiClient.get(`/engagements/${engagementId}/messages`),
    enabled: !!engagementId,
  });
}

export function useProjectMessages(projectId: string | undefined) {
  return useQuery({
    queryKey: ["messages", "project", projectId],
    queryFn: () => apiClient.get(`/projects/${projectId}/messages`),
    enabled: !!projectId,
  });
}

export function useMarkAsRead() {
  return useMutation({
    mutationFn: (messageId: string) =>
      apiClient.post(`/messages/${messageId}/read`),
  });
}

export function useUnreadCount(engagementId: string | undefined) {
  return useQuery({
    queryKey: ["messages", engagementId, "unread"],
    queryFn: () =>
      apiClient.get(`/engagements/${engagementId}/messages/unread-count`),
    enabled: !!engagementId,
  });
}
