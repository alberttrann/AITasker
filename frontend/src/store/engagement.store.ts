import { create } from 'zustand';

/**
 * Engagement store — tracks the currently viewed engagement and per-engagement unread message counts.
 *
 * WHY ZUSTAND (not TanStack Query):
 * - The active engagement context is UI state, not server state.
 * - Unread counts are updated by Socket.io in real-time, not by polling.
 * - When the user opens a conversation, unread count for that engagement drops to 0 immediately in the UI (optimistic) — no API call needed.
 *
 * HOW IT CONNECTS TO SOCKET.IO:
 * socket-provider.tsx listens for 'message:new' events and calls incrementUnread(engagement_id) unless that engagement is currently active.
 * The MessageThread component calls setActiveEngagement(id) on mount and setActiveEngagement(null) on unmount.
 */

interface EngagementState {
  // The engagement whose message thread is currently open on screen.
  // null = no conversation is open.
  activeEngagementId: string | null;

  // Per-engagement unread message counts (from Socket.io push).
  // Record<engagementId, unreadCount>
  unreadCounts: Record<string, number>;

  // Total unread across all engagements (for the messages nav badge)
  totalUnread: number;

  // Actions
  setActiveEngagement: (id: string | null) => void;
  incrementUnread:     (engagementId: string) => void;
  clearUnread:         (engagementId: string) => void;
  clearAllUnread:      () => void;
}

export const useEngagementStore = create<EngagementState>((set) => ({
  activeEngagementId: null,
  unreadCounts:       {},
  totalUnread:        0,

  setActiveEngagement: (id) =>
    set((s) => {
      // When opening a conversation, zero out its unread count immediately
      if (id && s.unreadCounts[id]) {
        const diff = s.unreadCounts[id];
        return {
          activeEngagementId: id,
          unreadCounts: { ...s.unreadCounts, [id]: 0 },
          totalUnread:  Math.max(0, s.totalUnread - diff),
        };
      }
      return { activeEngagementId: id };
    }),

  incrementUnread: (engagementId) =>
    set((s) => {
      // Don't increment if this conversation is currently open
      if (s.activeEngagementId === engagementId) return s;
      const current = s.unreadCounts[engagementId] ?? 0;
      return {
        unreadCounts: { ...s.unreadCounts, [engagementId]: current + 1 },
        totalUnread:  s.totalUnread + 1,
      };
    }),

  clearUnread: (engagementId) =>
    set((s) => {
      const count = s.unreadCounts[engagementId] ?? 0;
      return {
        unreadCounts: { ...s.unreadCounts, [engagementId]: 0 },
        totalUnread:  Math.max(0, s.totalUnread - count),
      };
    }),

  clearAllUnread: () => set({ unreadCounts: {}, totalUnread: 0 }),
}));