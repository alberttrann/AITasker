import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@store/auth.store';
import { useNotificationsStore } from '@store/notifications.store';
import { useEngagementStore } from '@store/engagement.store';
import { useQueryClient } from '@tanstack/react-query';
const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3001';

const SocketContext = createContext<Socket | null>(null);

/**
 * SocketProvider — manages one persistent Socket.io connection per session.
 *
 * Connection lifecycle:
 *   - Connects when the user has a valid accessToken
 *   - Disconnects on logout (accessToken becomes null)
 *   - Reconnects automatically if the token refreshes (accessToken changes)
 *
 * Event routing:
 *   message:new       → engagement.store (unread count) + notifications.store
 *   bid:updated       → notifications.store
 *   milestone:updated → notifications.store
 *   payment:confirmed → notifications.store
 *   dispute:filed     → notifications.store
 *   dispute:resolved  → notifications.store
 *   portfolio:result  → notifications.store
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef   = useRef<Socket | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient(); 
  const addNotification  = useNotificationsStore((s) => s.addNotification);
  const incrementUnread  = useEngagementStore((s) => s.incrementUnread);
  const activeEngagement = useEngagementStore((s) => s.activeEngagementId);

  useEffect(() => {
    if (!accessToken) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    // Disconnect stale socket before creating a new one
    socketRef.current?.disconnect();

    const socket = io(WS_URL, {
      auth:               { token: accessToken },
      transports:         ['websocket'],
      reconnectionDelay:  2000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      console.log('[Socket] connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] disconnected:', reason);
    });

    // Event handlers

    socket.on('newMessage', (data: any) => {
      const engagementId = data.engagementId || data.projectId;
      if (!engagementId) return;

      incrementUnread(engagementId);
      // Only show notification if user is not currently in that conversation
      if (activeEngagement !== engagementId) {
        addNotification({
          type:  'message',
          title: `New message from ${data.sender?.fullName || 'someone'}`,
          body:  data.content ? (data.content.length > 50 ? data.content.substring(0, 50) + '...' : data.content) : 'Attachment',
          link:  data.engagementId ? `/engagements/${engagementId}/messages` : `/projects/${engagementId}`,
          meta:  { engagement_id: engagementId },
        });
      }
    });

    socket.on('notification:generic', (data: {
      type: string;
      title: string;
      body: string;
      link?: string;
    }) => {
      addNotification({
        type:  data.type as any || 'system',
        title: data.title,
        body:  data.body,
        link:  data.link || '',
      });

      // 1. Tech Team submitted Stage 4 -> Auto-advance CEO's Wizard
      if (data.title === 'Technical Context Submitted') {
        queryClient.invalidateQueries({ queryKey: ['elicitation'] });
      }
      
      // 2. NDAs Signed -> Auto-unlock Artifact B & update project state
      if (data.title.includes('Project Connected') || data.title.includes('Expert Connected')) {
        queryClient.invalidateQueries({ queryKey: ['project'] });
        queryClient.invalidateQueries({ queryKey: ['engagements'] });
      }

      // 3. New Bids or Tech Reviews -> Refresh CEO/Expert dashboards
      if (data.title.includes('New Expert Bid') || data.title.includes('Tech Review Passed')) {
        queryClient.invalidateQueries({ queryKey: ['engagements'] });
        queryClient.invalidateQueries({ queryKey: ['bids'] });
      }
    });

    socket.on('bid:updated', (data: {
      engagement_id: string;
      state:         string;
    }) => {
      addNotification({
        type:  'bid_update',
        title: 'Bid status changed',
        body:  `Your bid is now ${data.state.replace('_', ' ').toLowerCase()}`,
        link:  `/engagements/${data.engagement_id}`,
        meta:  { engagement_id: data.engagement_id },
      });
    });

    queryClient.invalidateQueries({ queryKey: ['engagements'] });
    queryClient.invalidateQueries({ queryKey: ['bids'] });

    socket.on('milestone:updated', (data: {
      engagement_id:   string;
      milestone_number: number;
      state:            string;
    }) => {
      addNotification({
        type:  'milestone_update',
        title: `Milestone ${data.milestone_number} updated`,
        body:  `Status: ${data.state.replace('_', ' ').toLowerCase()}`,
        link:  `/engagements/${data.engagement_id}/milestones`,
        meta:  { engagement_id: data.engagement_id },
      });
    });
    
    queryClient.invalidateQueries({ queryKey: ['milestones'] });
    queryClient.invalidateQueries({ queryKey: ['engagements'] });

    socket.on('payment:confirmed', (data: {
      engagement_id:   string;
      milestone_number: number;
      amount_vnd:       number;
    }) => {
      addNotification({
        type:  'payment',
        title: 'Payment confirmed',
        body:  `Milestone ${data.milestone_number} funded — ₫${data.amount_vnd.toLocaleString()}`,
        link:  `/engagements/${data.engagement_id}/milestones`,
        meta:  { engagement_id: data.engagement_id },
      });
    });

    socket.on('dispute:filed', (data: { engagement_id: string }) => {
      addNotification({
        type:  'dispute',
        title: 'Dispute filed',
        body:  'A dispute has been raised on one of your milestones',
        link:  `/engagements/${data.engagement_id}`,
        meta:  { engagement_id: data.engagement_id },
      });
    });

    socket.on('dispute:resolved', (data: {
      engagement_id: string;
      resolution:    string;
    }) => {
      addNotification({
        type:  'dispute',
        title: 'Dispute resolved',
        body:  `Resolution: ${data.resolution}`,
        link:  `/engagements/${data.engagement_id}`,
        meta:  { engagement_id: data.engagement_id },
      });
    });

    socket.on('portfolio:result', (data: {
      seam_code: string;
      passed:    boolean;
    }) => {
      addNotification({
        type:  'portfolio_eval',
        title: 'Portfolio evaluation complete',
        body:  data.passed
          ? `${data.seam_code} — Tier 2 verified ✓`
          : `${data.seam_code} — did not meet the threshold`,
        link:  '/profile/seams',
      });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [accessToken]);

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketInstance() {
  return useContext(SocketContext);
}