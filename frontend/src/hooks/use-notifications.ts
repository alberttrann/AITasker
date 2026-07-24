import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

/**
 * useNotifications — fetches server-persisted notifications from the backend DB.
 * Source of truth is now the backend Notification table, not localStorage.
 */
export function useNotifications(limit = 50) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<NotificationDto[]>({
    queryKey: ['notifications', limit],
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications/me', { params: { limit } });
      return Array.isArray(data) ? data : (data?.data ?? []);
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.put(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.put('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}