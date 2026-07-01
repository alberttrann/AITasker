import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export function useProject(id: string) {
  const projectQuery = useQuery({
    queryKey: ['projects', id],
    queryFn: async () => {
      const res = await apiClient.get<{ data: ProjectDto } | ProjectDto>(`/projects/${id}`);
      return (res.data as any)?.data ?? res.data;
    },
    enabled: !!id,
  });

  return {
    project: projectQuery.data,
    isLoadingProject: projectQuery.isLoading,
  };
}
export function useActiveElicitationSession() {
  const activeSessionQuery = useQuery({
    queryKey: ['elicitation-sessions', 'active'],
    queryFn: async () => {
      const res = await apiClient.get('/elicitation/sessions/active');
      return res.data;
    },
    retry: false
  });

  return {
    activeSession: (activeSessionQuery.data as any)?.data ?? activeSessionQuery.data ?? null,
    isLoadingActiveSession: activeSessionQuery.isLoading,
    isFetchingActiveSession: activeSessionQuery.isFetching,
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

export function useDeleteElicitationSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.put(`/elicitation/sessions/${id}/abandon`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elicitation-sessions'] });
    }
  });
}

export function useRestoreElicitationSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.put(`/elicitation/sessions/${id}/continue`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elicitation-sessions'] });
    }
  });
}

export function useHardDeleteElicitationSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/elicitation/sessions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elicitation-sessions'] });
    }
  });
}

export function useUpdateProjectName() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, projectName }: { id: string; projectName: string }) => {
      await apiClient.put(`/projects/${id}/name`, { projectName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });
}
