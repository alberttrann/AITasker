import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@store/auth.store';

/**
 * Creates a new pre-packaged AI service listing or Tech Discovery package offer in DRAFT state.
 */
export function useCreateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post('/services', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

/**
 * Updates an existing service package's details, pricing, or scope statements.
 */
export function useUpdateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string, payload: any }) => {
      const { data } = await apiClient.put(`/services/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

/**
 * Queries the public marketplace service listings catalog with filter parameters.
 */
export function useGetServices(queryParams?: Record<string, any>) {
  return useQuery({
    queryKey: ['services', queryParams],
    queryFn: async () => {
      const { data } = await apiClient.get('/services', { params: queryParams });
      return Array.isArray(data) ? data : (data as any)?.data ?? [];
    },
  });
}

/**
 * Fetches single service listing detail by ID for marketplace detail pages.
 */
export function useGetService(id?: string) {
  return useQuery({
    queryKey: ['services', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await apiClient.get(`/services/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

/**
 * Fetches all service listings created by the currently authenticated Expert.
 */
export function useMyServices() {
  return useQuery({
    queryKey: ['services', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get('/services/me');
      return Array.isArray(data) ? data : (data as any)?.data ?? [];
    },
  });
}

/**
 * Transitions an Expert's draft service listing to PUBLISHED state, making it visible on the public marketplace.
 */
export function usePublishService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put(`/services/${id}/publish`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

/**
 * Suspends/unpublishes a service listing, removing it from public marketplace browsing.
 */
export function useUnpublishService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put(`/services/${id}/unpublish`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

/**
 * Deletes a draft or unpublished service listing from the database.
 */
export function useDeleteService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/services/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

/**
 * Executes direct purchase of a service listing by a Client CEO, initiating an instant engagement and milestone setup.
 */
export function usePurchaseService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (serviceId: string) => {
      const { data } = await apiClient.post(`/services/${serviceId}/purchase`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['engagements'] });
    },
  });
}

/**
 * Fetches service orders purchased by the current Client CEO.
 */
export function useMyPurchase(userId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['purchases', userId],
    queryFn: async () => {
      const { data } = await apiClient.get('/services/me/purchases');
      return data;
    },
    enabled: isAuthenticated && !!userId,
  });
}
