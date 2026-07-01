import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ProjectDto, ElicitationSessionDto, PaginatedResponse } from '@/types/api.types';
import type { ArtifactA, ArtifactB } from '@/types/jsonb.types';
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

/**
 * useSlimProjects — lightweight project list for CEO dashboard cards.
 * Hits GET /projects?slim=true — no JSON blobs, just scalar metadata.
 * Use useProject(id) for the full record when opening a project detail.
 */
export function useSlimProjects() {
  return useQuery({
    queryKey: ['projects', 'slim'],
    queryFn: async () => {
      const { data } = await apiClient.get('/projects', { params: { slim: true } });
      return (Array.isArray(data) ? data : (data as any)?.data ?? []);
    },
    staleTime: 60_000,
  });
}
 
/**
 * useProject — full project record for the detail / spec view.
 * Hits GET /projects/:id — includes artifactAJson, milestoneFrameworkJson, etc.
 */
export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/${projectId}`);
      return data;
    },
    enabled: !!projectId,
    staleTime: Infinity, // Published project spec doesn't change
  });
}
 
/**
 * useArtifactA — fetch only the public-facing spec for a project.
 * Hits GET /projects/:id/artifact-a
 * Backend returns { artifact_a_json: ArtifactA }.
 */
export function useArtifactA(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project', projectId, 'artifact-a'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/${projectId}/artifact-a`);
      return (data?.artifact_a_json ?? data) as ArtifactA;
    },
    enabled: !!projectId,
    staleTime: Infinity,
  });
}
 
/**
 * useArtifactB — fetch gated technical spec (post-NDA, expert/tech-team only).
 * Hits GET /projects/:id/artifact-b
 * CEO always gets 403 — do NOT enable for CEO.
 * Pass `enabled=false` until NDA is confirmed accepted by both parties.
 */
export function useArtifactB(
  projectId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['project', projectId, 'artifact-b'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/${projectId}/artifact-b`);
      return (data?.artifact_b_json ?? data) as ArtifactB;
    },
    enabled: !!projectId && enabled,
    staleTime: Infinity,
    retry: false, // Don't retry 403s (CEO accessing, or NDA not yet signed)
  });
}
 
/**
 * useSessionHistory — fetch ABANDONED and RETURNED sessions.
 * Hits GET /elicitation/sessions/history (existing endpoint).
 * Use on SessionsListPage instead of filtering useElicitationSessions() client-side.
 * RETURNED = quality gate failed, session sent back for revision.
 */
export function useSessionHistory() {
  return useQuery({
    queryKey: ['elicitation-sessions', 'history'],
    queryFn: async () => {
      const { data } = await apiClient.get('/elicitation/sessions/history');
      return (Array.isArray(data) ? data : (data as any)?.data ?? []) as ElicitationSessionDto[];
    },
    staleTime: 30_000,
  });
}
