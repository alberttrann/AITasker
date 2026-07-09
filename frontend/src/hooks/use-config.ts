import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface DomainDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface SeamDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface ArchetypeDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface ProbeQuestionDefinition {
  id: string;
  archetypeCode: string;
  questionText: string;
  displayOrder: number;
}

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
