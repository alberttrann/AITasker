import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

export function useReadConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (engagementId: string) => apiClient.post(`/conversations/${engagementId}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

export function useReadAllConversations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post('/conversations/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
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
  // Use Partner ID as the unique key to group all projects with the same partner
  const map = new Map<string, PartnerConversationSummary>();

  conversations.forEach((conv) => {
    const threadKey = conv.otherParty?.id || 'unknown'; 
    const partnerName = conv.otherParty?.fullName || 'Partner';

    if (!map.has(threadKey)) {
      map.set(threadKey, {
        partnerId: threadKey,
        partnerName,
        primaryEngagementId: conv.id,
        projectName: conv.projectName || 'Direct Chat',
        lastMessage: conv.lastMessage,
        unreadCount: conv.unreadCount || 0,
        allEngagements: [conv],
      });
    } else {
      const existing = map.get(threadKey)!;
      existing.allEngagements.push(conv);
      existing.unreadCount += (conv.unreadCount || 0);
      
      // Update lastMessage if the new conversation has a more recent one
      const existingTime = existing.lastMessage?.timestamp ? new Date(existing.lastMessage.timestamp).getTime() : 0;
      const newTime = conv.lastMessage?.timestamp ? new Date(conv.lastMessage.timestamp).getTime() : 0;
      if (newTime > existingTime) {
        existing.lastMessage = conv.lastMessage;
        existing.primaryEngagementId = conv.id; // Make the most recent active
        existing.projectName = conv.projectName || existing.projectName;
      }
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    const timeA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
    const timeB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
    return timeB - timeA;
  });
}


