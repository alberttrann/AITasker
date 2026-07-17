import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { UserDto } from '@/types/api.types';

export function useUser() {
  const queryClient = useQueryClient();
  const store = useAuthStore();

  const userQuery = useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get<UserDto>('/users/me');
      store.setUser(data);
      return data;
    },
    enabled: store.isAuthenticated,
  });

  const updateProfile = useMutation({
    mutationFn: async (payload: any) => {
      await apiClient.put('/users/me', payload);
    },
    onSuccess: async () => {
      const { data } = await apiClient.get<UserDto>('/users/me');
      store.setUser(data);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  const verifyTaxCode = useMutation({
    mutationFn: async (taxCode: string) => {
      const res = await apiClient.post('/auth/verify-tax-code', { taxCode });
      return res.data;
    },
  });

  const updateExpertProfile = useMutation({
    mutationFn: async (payload: any) => {
      await apiClient.put('/expert-profile/me', payload);
    },
    onSuccess: async () => {
      const { data } = await apiClient.get<UserDto>('/users/me');
      store.setUser(data);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  return {
    user: userQuery.data,
    isLoading: userQuery.isLoading,
    updateProfile,
    updateExpertProfile,
    verifyTaxCode,
  };
}

export function usePublicProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['expertProfile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await apiClient.get(`/users/${userId}/public-profile`);
      return data;
    },
    enabled: !!userId,
  });
}
