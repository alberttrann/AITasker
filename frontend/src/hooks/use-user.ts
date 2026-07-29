import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { UserDto } from '@/types/api.types';

/**
 * Manages user profile fetching (/users/me), basic profile updates, tax code verification via VietQR, and Expert profile metadata updates.
 */
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

/**
 * Fetches full public expert profile (bio, stack tags, domain depths, seam claims,
 * avgRating, reviewCount, activeListings) AND their written client reviews
 * in a single combined hook — no double-call needed at the consumer.
 *
 * Returns:
 *   data.profile   — all public-profile fields
 *   data.reviews   — ReviewWithReviewerDto[] (individual written reviews)
 *   isLoading      — true while either request is in flight
 */
export function usePublicProfile(userId: string | undefined) {
  const profileQuery = useQuery({
    queryKey: ['expertProfile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await apiClient.get(`/users/${userId}/public-profile`);
      return data;
    },
    enabled: !!userId,
  });

  const reviewsQuery = useQuery({
    queryKey: ['reviews', 'user', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await apiClient.get(`/reviews/users/${userId}`);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!userId,
  });

  return {
    // Profile fields (same shape as before — backwards-compatible)
    data: profileQuery.data ?? null,
    isLoading: profileQuery.isLoading || reviewsQuery.isLoading,
    isError: profileQuery.isError,
    error: profileQuery.error,
    // Reviews
    reviews: reviewsQuery.data ?? [],
    isLoadingReviews: reviewsQuery.isLoading,
  };
}
