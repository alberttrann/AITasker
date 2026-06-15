import { useNotificationsStore, type AppNotification } from '@store/notifications.store';

/**
 * useNotifications — reads and manages the notification store.
 * Used by NotificationSystem component (bell icon + dropdown).
 */
export function useNotifications() {
  const notifications = useNotificationsStore((s) => s.notifications);
  const unreadCount   = useNotificationsStore((s) => s.unreadCount);
  const markRead      = useNotificationsStore((s) => s.markRead);
  const markAllRead   = useNotificationsStore((s) => s.markAllRead);
  const remove        = useNotificationsStore((s) => s.remove);
  const clear         = useNotificationsStore((s) => s.clear);

  const unread = notifications.filter((n) => !n.read);
  const read   = notifications.filter((n) => n.read);

  return {
    notifications,
    unread,
    read,
    unreadCount,
    markRead,
    markAllRead,
    remove,
    clear,
  };
}

export type { AppNotification };