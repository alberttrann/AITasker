import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

import { useAuthStore } from '@/store/auth.store';
import { SubscriptionHistoryLog, SubscriptionStatus, UserDto } from '@/types/api.types';

export function useSubscription() {
  const queryClient = useQueryClient();

  const activateSubscription = useMutation({
    mutationFn: async (payload: { paymentMethodId?: string; tier?: string; activeRole?: string; packageId?: string }) => {
      const { data } = await apiClient.post<{ access_token: string }>('/subscriptions/activate', payload);
      return data;
    },
    onSuccess: async (data) => {
      if (data.access_token) {
        useAuthStore.getState().setTokens(data.access_token, '');
        const { data: userRes } = await apiClient.get<UserDto>('/users/me');
        useAuthStore.getState().setUser(userRes);
      }
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptionStatus'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });

  return {
    activateSubscription,
  };
}

export function useSubscriptionStatus() {
  return useQuery({
    queryKey: ['subscriptionStatus'],
    queryFn: async () => {
      const { data } = await apiClient.get<any>('/subscriptions/status');
      const tier = data?.subscriptionTier?.toLowerCase() || 'free';
      const expiresAt = data?.subscriptionExpires;
      const isActive = tier === 'pro';

      return {
        tier,
        isActive,
        expiresAt,
      } as SubscriptionStatus;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}



export function useSubscriptionHistory() {
  return useQuery({
    queryKey: ['subscriptionHistory'],
    queryFn: async () => {
      const { data } = await apiClient.get<SubscriptionHistoryLog[]>('/subscriptions/history');
      return data;
    },
  });
}

