import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

import type { DomainDefinition, SeamDefinition, ArchetypeDefinition, ProbeQuestion as ProbeQuestionDefinition } from '@/types/api.types';
export function useDomains() {
  return useQuery({
    queryKey: ['domains'],
    queryFn: async () => {
      const { data } = await apiClient.get<DomainDefinition[]>('/config/domains');
      return data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export function useSeams() {
  return useQuery({
    queryKey: ['seams'],
    queryFn: async () => {
      const { data } = await apiClient.get<SeamDefinition[]>('/config/seams');
      return data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export function useArchetypes() {
  return useQuery({
    queryKey: ['archetypes'],
    queryFn: async () => {
      const { data } = await apiClient.get<ArchetypeDefinition[]>('/config/archetypes');
      return data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export function useProbeQuestions(archetypeCode: string | undefined) {
  return useQuery({
    queryKey: ['probe-questions', archetypeCode],
    queryFn: async () => {
      if (!archetypeCode) return [];
      const { data } = await apiClient.get<ProbeQuestionDefinition[]>(`/config/archetypes/${archetypeCode}/probe-questions`);
      return data;
    },
    enabled: !!archetypeCode,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
