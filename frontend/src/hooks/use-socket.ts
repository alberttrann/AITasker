import { useSocketInstance } from '@lib/socket-provider';

/**
 * useSocket — exposes the Socket.io instance for components that need to emit.
 *
 * Usage:
 *   const socket = useSocket();
 *   socket?.emit('message:send', { engagement_id, content });
 *
 * Returns null when not connected (user not logged in).
 * Always guard with: if (!socket) return;
 */
export function useSocket() {
  return useSocketInstance();
}