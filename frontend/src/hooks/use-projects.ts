import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ProjectDto, ElicitationSessionDto, PaginatedResponse } from '@/types/api.types';

export function useProjects() {
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<ProjectDto>>('/projects');
      return res.data;
    },
  });

  return {
    projects: Array.isArray(projectsQuery.data) ? projectsQuery.data : (projectsQuery.data as any)?.data || [],
    isLoadingProjects: projectsQuery.isLoading,
  };
}

export function useElicitationSessions() {
  const sessionsQuery = useQuery({
    queryKey: ['elicitation-sessions'],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<ElicitationSessionDto>>('/elicitation/sessions');
      return res.data;
    },
  });

  return {
    sessions: Array.isArray(sessionsQuery.data) ? sessionsQuery.data : (sessionsQuery.data as any)?.data || [],
    isLoadingSessions: sessionsQuery.isLoading,
  };
}
