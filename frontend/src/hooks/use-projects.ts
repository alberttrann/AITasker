import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ProjectDto, ElicitationSessionDto, PaginatedResponse } from '@/types/api.types';
import type { ArtifactA, ArtifactB } from '@/types/jsonb.types';

function replaceProjectName<T>(value: T, projectId: string, projectName: string): T {
  if (Array.isArray(value)) {
    return value.map((item) => replaceProjectName(item, projectId, projectName)) as T;
  }
  if (!value || typeof value !== 'object') return value;

  const record = value as Record<string, any>;
  const next: Record<string, any> =
    record.id === projectId ? { ...record, projectName } : { ...record };
  if (Array.isArray(record.data)) {
    next.data = record.data.map((item: unknown) => replaceProjectName(item, projectId, projectName));
  }
  if (record.project?.id === projectId) {
    next.project = { ...record.project, projectName };
  }
  return next as T;
}

export function updateProjectNameInCache(
  queryClient: QueryClient,
  projectId: string,
  projectName: string,
) {
  queryClient.setQueriesData({ queryKey: ['projects'] }, (data) =>
    replaceProjectName(data, projectId, projectName),
  );
  queryClient.setQueriesData({ queryKey: ['engagements'] }, (data) =>
    replaceProjectName(data, projectId, projectName),
  );
}
export function useProjects(slim: boolean = false) {
  const projectsQuery = useQuery({
    queryKey: ['projects', { slim }],
    queryFn: async () => {
      const url = slim ? '/projects?slim=true' : '/projects';
      const res = await apiClient.get<PaginatedResponse<ProjectDto>>(url);
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
      const { data } = await apiClient.put<{ id: string; projectName: string }>(
        `/projects/${id}/name`,
        { projectName },
      );
      return data;
    },
    onSuccess: (updatedProject) => {
      updateProjectNameInCache(queryClient, updatedProject.id, updatedProject.projectName);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['engagements'] });
    }
  });
}

export function useUpdateProjectMilestones() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, milestones }: { id: string; milestones: any[] }) => {
      await apiClient.put(`/projects/${id}/milestones`, { milestones });
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
  const query = useQuery({
    queryKey: ['projects', projectId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: ProjectDto } | ProjectDto>(`/projects/${projectId}`);
      return ((data as any)?.data ?? data) as ProjectDto;
    },
    enabled: !!projectId,
    staleTime: Infinity, // Published project spec doesn't change
  });

  return {
    ...query,
    project: query.data,
    isLoadingProject: query.isLoading,
  };
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

// ── Phase 5: Individual Milestone CRUD ────────────────────────────────────────

export function useUpdateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const { data } = await apiClient.patch(`/milestones/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; engagementId?: string }) => {
      const { data } = await apiClient.delete(`/milestones/${id}`);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['milestones', variables.id] });
      if (variables.engagementId) {
        queryClient.invalidateQueries({
          queryKey: ['engagements', variables.engagementId, 'milestones'],
        });
      }
    }
  });
}

export function useProjectMilestones(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId, 'milestones'],
    queryFn: async () => {
      // The backend does not currently have GET /projects/:id/milestones. 
      // We return an empty array so the UI gracefully falls back to project.milestoneFrameworkJson
      // without throwing a 404 console error.
      return [];
    },
    enabled: !!projectId,
  });
}

// ── Phase 5: Milestone Chat Assistant ────────────────────────────────────────

export function useMilestoneChatSessions(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId, 'milestone-chat', 'sessions'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/${projectId}/milestone-chat/sessions`);
      return Array.isArray(data) ? data : (data as any)?.data ?? [];
    },
    enabled: !!projectId,
  });
}

export function useMilestoneChatHistory(projectId: string, sessionId: string | null) {
  return useQuery({
    queryKey: ['project', projectId, 'milestone-chat', 'session', sessionId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/${projectId}/milestone-chat/sessions/${sessionId}`);
      return data;
    },
    enabled: !!projectId && !!sessionId,
  });
}

export function useSendMilestoneMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      message, 
      chatSessionId, 
      currentMilestones 
    }: { 
      projectId: string; 
      message: string; 
      chatSessionId?: string; 
      currentMilestones?: any[] 
    }) => {
      const payload: any = { message };
      if (chatSessionId) payload.chatSessionId = chatSessionId;
      if (currentMilestones) payload.currentMilestones = currentMilestones;
      const { data } = await apiClient.post(`/projects/${projectId}/milestone-chat`, payload);
      return data;
    },
    onSuccess: (_, { projectId, chatSessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'milestone-chat', 'sessions'] });
      if (chatSessionId) {
        queryClient.invalidateQueries({ queryKey: ['project', projectId, 'milestone-chat', 'session', chatSessionId] });
      }
    }
  });
}

export interface MarketplaceProjectDto {
  id: string;
  state: string;
  archetype: string | null;
  tier: string | null;
  artifact_a_json: import('@/types/jsonb.types').ArtifactA | null;
  projectName: string | null;
  selfTechnical: boolean;
  required_domains_json: any[];
  required_seams_json: any[];
  milestone_framework_json: any[]; 
}

export function useMarketplaceProjects(filters?: { archetype?: string; tier?: string; limit?: number }) {
  return useQuery({
    queryKey: ['projects', 'marketplace', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<MarketplaceProjectDto[]>('/projects/marketplace', {
        params: filters,
      });
      return data;
    },
  });
}
