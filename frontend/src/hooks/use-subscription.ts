import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface SubscriptionStatus {
  tier: 'free' | 'pro' | string;
  isActive: boolean;
  packageId?: string;
  expiresAt?: string;
  [key: string]: any;
}

export function useSubscription() {
  const queryClient = useQueryClient();

  const activateSubscription = useMutation({
    mutationFn: async (payload: { paymentMethodId?: string; tier?: string; activeRole?: string; packageId?: string }) => {
      const { data } = await apiClient.post<{ access_token: string }>('/subscriptions/activate', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptionStatus'] });
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
      const isActive = tier === 'pro' && !!expiresAt && new Date(expiresAt) > new Date();

      return {
        tier,
        isActive,
        expiresAt,
      } as SubscriptionStatus;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export interface SubscriptionHistoryLog {
  id: string;
  packageName: string;
  role: string;
  amountPaidVnd: string;
  purchasedAt: string;
  expiresAt: string;
  paymentMethod: string;
  isExpired: boolean;
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

export interface SubscriptionPackage {
  id: string;
  role: string;
  name: string;
  priceVnd: string | number;
  durationMonths: number;
  isActive: boolean;
}

export function useSubscriptionPackages() {
  return useQuery({
    queryKey: ['subscriptionPackages'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<SubscriptionPackage[]>('/config/subscription-packages');
        return data;
      } catch (err: any) {
        // Fallback or ignore if endpoint doesn't exist yet (404)
        if (err.response?.status === 404) {
          return null;
        }
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
