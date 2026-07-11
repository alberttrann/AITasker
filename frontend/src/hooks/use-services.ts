import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

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

export function useGetServices(queryParams?: Record<string, any>) {
  return useQuery({
    queryKey: ['services', queryParams],
    queryFn: async () => {
      const { data } = await apiClient.get('/services', { params: queryParams });
      return Array.isArray(data) ? data : (data as any)?.data ?? [];
    },
  });
}

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

export function useMyServices() {
  return useQuery({
    queryKey: ['services', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get('/services/me');
      return Array.isArray(data) ? data : (data as any)?.data ?? [];
    },
  });
}

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
