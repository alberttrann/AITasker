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

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => apiClient.get("/conversations"),
  });
}

export function useSendWorkspaceMessage() {
  const socket = useSocket();

  return (payload: {
    engagement_id?: string;
    project_id?: string;
    content: string;
  }) => {
    socket?.emit("sendMessageWorkspace", payload);
  };
}

export interface PartnerConversationSummary {
  partnerId: string;
  partnerName: string;
  primaryEngagementId: string;
  projectName: string;
  lastMessage: any;
  unreadCount: number;
  allEngagements: any[];
}

export function groupConversationsByPartner(conversations: any[] = []): PartnerConversationSummary[] {
  const map = new Map<string, PartnerConversationSummary>();

  conversations.forEach((conv) => {
    const partnerId = conv.otherParty?.id || conv.otherParty?.fullName || 'Partner';
    const partnerName = conv.otherParty?.fullName || 'Partner';
    const existing = map.get(partnerId);

    if (!existing) {
      map.set(partnerId, {
        partnerId,
        partnerName,
        primaryEngagementId: conv.id,
        projectName: conv.projectName || 'Direct Chat',
        lastMessage: conv.lastMessage,
        unreadCount: conv.unreadCount || 0,
        allEngagements: [conv],
      });
    } else {
      existing.allEngagements.push(conv);
      existing.unreadCount += (conv.unreadCount || 0);

      const existingTime = existing.lastMessage?.timestamp ? new Date(existing.lastMessage.timestamp).getTime() : 0;
      const convTime = conv.lastMessage?.timestamp ? new Date(conv.lastMessage.timestamp).getTime() : 0;
      if (convTime > existingTime) {
        existing.primaryEngagementId = conv.id;
        existing.projectName = conv.projectName || 'Direct Chat';
        existing.lastMessage = conv.lastMessage;
      }
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    const timeA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
    const timeB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
    return timeB - timeA;
  });
}


