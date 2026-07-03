import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export function useSubscription() {
  const queryClient = useQueryClient();

  const activateSubscription = useMutation({
    mutationFn: async (payload: { paymentMethodId?: string; packageId?: string; tier?: string; activeRole?: string }) => {
      const { data } = await apiClient.post<{ access_token: string }>('/subscriptions/activate', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  return {
    activateSubscription,
  };
}
