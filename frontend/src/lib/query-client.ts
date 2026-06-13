import { QueryClient } from '@tanstack/react-query';

/**
 * TanStack Query global configuration.
 * Import this instance everywhere — NOT create a second QueryClient.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for 30s before a background refetch
      staleTime:          30 * 1000,
      // Cache stays in memory for 5 min after the last observer unmounts
      gcTime:             5 * 60 * 1000,
      // Retry once on failure (not on 401/403/404 — handled by interceptor)
      retry: (failureCount, error: any) => {
        const status = error?.response?.status;
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});