import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@store/auth.store';
import { formatSeamCode } from '@/lib/utils';
import { formatResolutionNotification } from '@/lib/dispute-resolution';
import { useEngagementStore } from '@store/engagement.store';
import { useQueryClient } from '@tanstack/react-query';
import { updateProjectNameInCache } from '@/hooks/use-projects';
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
  const [activeSocket, setActiveSocket] = useState<Socket | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user        = useAuthStore((s) => s.user);
  const activeRole  = useAuthStore((s) => s.activeRole);
  const queryClient = useQueryClient();
  const incrementUnread  = useEngagementStore((s) => s.incrementUnread);
  const activeEngagement = useEngagementStore((s) => s.activeEngagementId);

  useEffect(() => {
    if (!accessToken) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setActiveSocket(null);
      useEngagementStore.getState().clearAllUnread();
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
    socket.on('error', (err: any) => {
      console.error('[Socket] Server returned an error:', err);
    });
    
    socket.on('exception', (err: any) => {
      console.error('[Socket] Server threw an exception:', err);
    });

    socket.on('newMessage', (data: any) => {
    const engagementId = data.engagementId || data.projectId;
    if (!engagementId) return;

    if (data.senderId === user?.id || data.sender?.id === user?.id) return;

    // Dùng getState() thay vì closure để luôn đọc activeEngagementId mới nhất
    const currentActive = useEngagementStore.getState().activeEngagementId;
    if (currentActive !== engagementId) {
    incrementUnread(engagementId);
    }

    queryClient.invalidateQueries({ queryKey: ['conversations'] });
      
      // Only show notification if user is not currently in that conversation
      // Note: We no longer call addNotification here to prevent direct chat messages from
      // cluttering the Bell icon notification list. Unread state is tracked separately
      // via incrementUnread and shown under the Messages/Chat icon.
      if (activeEngagement !== engagementId) {
        // addNotification({
        //   type:  'message',
        //   title: `New message from ${data.sender?.fullName || 'someone'}`,
        //   body:  data.content ? (data.content.length > 50 ? data.content.substring(0, 50) + '...' : data.content) : 'Attachment',
        //   link:  data.engagementId ? `/engagements/${engagementId}/messages` : `/projects/${engagementId}`,
        //   meta:  { engagement_id: engagementId },
        // });
      }
    });

    socket.on('notification:generic', (data: {
      type: string;
      title: string;
      body: string;
      link?: string;
    }) => {
      // Always invalidate the server-side notifications cache (source of truth is the DB now)
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

      // 1. Tech Team submitted Stage 4 -> Auto-advance CEO's Wizard
      if (data.title === 'Technical Context Submitted') {
        queryClient.invalidateQueries({ queryKey: ['elicitation'] });
      }
      
      // 2. NDAs Signed -> Auto-unlock Artifact B & update project state
      if (data.title.includes('Project Connected') || data.title.includes('Expert Connected')) {
        queryClient.invalidateQueries({ queryKey: ['project'] });
        queryClient.invalidateQueries({ queryKey: ['engagements'] });
      }

      // 3. New Bids or Tech Reviews -> Refresh CEO/Expert/TechTeam dashboards
      if (data.title.includes('New Expert Bid') || data.title.includes('New Bid Awaiting Review') || data.title.includes('Tech Review Passed')) {
        queryClient.invalidateQueries({ queryKey: ['engagements'] });
        queryClient.invalidateQueries({ queryKey: ['bids'] });
      }

      // 4. Service purchase paid/confirmed -> Refresh purchases list & engagements
      if (data.title === 'Payment Confirmed!' || data.title === 'Service Purchased!') {
        queryClient.invalidateQueries({ queryKey: ['purchases'] });
        queryClient.invalidateQueries({ queryKey: ['engagements'] });
      }
    });

    socket.on('bid:updated', (data: {
      engagement_id: string;
      state:         string;
    }) => {
      // Invalidate notifications cache (backend persists them) + refresh bids data
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['engagements'] });
      queryClient.invalidateQueries({ queryKey: ['bids'] });
    });

    socket.on('project:updated', (data: { project_id: string; project_name: string }) => {
      updateProjectNameInCache(queryClient, data.project_id, data.project_name);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['engagements'] });
      queryClient.invalidateQueries({ queryKey: ['project'] }); // Forces detail page refresh
    });

    // Real-time invalidations on mount
    queryClient.invalidateQueries({ queryKey: ['engagements'] });
    queryClient.invalidateQueries({ queryKey: ['bids'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });

    socket.on('milestone:updated', (data: {
      engagement_id:   string;
      milestone_number: number;
      state:            string;
    }) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
      queryClient.invalidateQueries({ queryKey: ['milestone'] });
      queryClient.invalidateQueries({ queryKey: ['engagements'] });
      queryClient.invalidateQueries({ queryKey: ['engagement'] });
    });
    
    queryClient.invalidateQueries({ queryKey: ['milestones'] });
    queryClient.invalidateQueries({ queryKey: ['engagements'] });

    socket.on('payment:confirmed', (data: {
      engagement_id:   string;
      milestone_number: number;
      amount_vnd:       number;
    }) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
      queryClient.invalidateQueries({ queryKey: ['milestone'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['engagements'] });
      queryClient.invalidateQueries({ queryKey: ['engagement'] });
    });

    socket.on('dispute:filed', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    socket.on('dispute:resolved', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    socket.on('portfolio:result', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['expert-profile'] });
    });

    socketRef.current = socket;
    setActiveSocket(socket);

    return () => {
      socket.disconnect();
    };
  }, [accessToken, activeRole]);

  return (
    <SocketContext.Provider value={activeSocket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketInstance() {
  return useContext(SocketContext);
}
