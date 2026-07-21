import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Notifications store — receives real-time events from Socket.io.
 *
 * These are NOT fetched from a REST endpoint — they arrive as WebSocket push events and need to be stored client-side until the user reads them.
 *
 * The NotificationSystem component reads this store and renders the bell icon badge + dropdown.
 * The socket-provider.tsx writes to this store on every incoming event.
 */

export type NotificationType =
  | 'message'           // new chat message in an engagement
  | 'bid_update'        // bid state changed (TECH_APPROVED, SELECTED, etc.)
  | 'milestone_update'  // milestone funded / submitted / approved / released
  | 'dispute'           // dispute filed or resolved
  | 'payment'           // IPN confirmed — escrow funded or released
  | 'portfolio_eval'    // LLM portfolio evaluation completed
  | 'system';           // admin action (suspend, spec pull-back)

export interface AppNotification {
  id:         string;
  type:       NotificationType;
  title:      string;
  body:       string;
  read:       boolean;
  createdAt:  string;  // ISO timestamp
  link?:      string;  // client-side route to navigate to on click
  meta?:      Record<string, string>; // engagement_id, milestone_id, etc.
}

interface NotificationsState {
  notifications: AppNotification[];
  unreadCount:   number;

  // Called by socket-provider.tsx on each incoming Socket.io event
  addNotification:  (n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => void;

  markRead:         (id: string) => void;
  markAllRead:      () => void;
  remove:           (id: string) => void;
  clear:            () => void;
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      notifications: [],
      unreadCount:   0,

      addNotification: (incoming) =>
        set((s) => {
          const n: AppNotification = {
            ...incoming,
            id:        crypto.randomUUID(),
            read:      false,
            createdAt: new Date().toISOString(),
          };
          return {
            notifications: [n, ...s.notifications].slice(0, 50), // cap at 50
            unreadCount:   s.unreadCount + 1,
          };
        }),

      markRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, s.unreadCount - 1),
        })),

      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
          unreadCount:   0,
        })),

      remove: (id) =>
        set((s) => {
          const target = s.notifications.find((n) => n.id === id);
          return {
            notifications: s.notifications.filter((n) => n.id !== id),
            unreadCount:   target && !target.read
              ? Math.max(0, s.unreadCount - 1)
              : s.unreadCount,
          };
        }),

      clear: () => set({ notifications: [], unreadCount: 0 }),
    }),
    {
      name: 'aitasker-notifications',
    }
  )
);