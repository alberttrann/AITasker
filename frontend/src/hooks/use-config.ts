import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

import type { 
  DomainDefinition, 
  SeamDefinition, 
  ArchetypeDefinition, 
  ProbeQuestion as ProbeQuestionDefinition,
  SubPackage
} from '@/types/api.types';

export interface VoidCodeDefinition {
  code: string;
  title: string;
  description: string;
}

export interface ConfigAllResponse {
  domains: DomainDefinition[];
  seams: SeamDefinition[];
  archetypes: ArchetypeDefinition[];
  voidCodes: VoidCodeDefinition[];
  subscriptionPackages: SubPackage[];
}

export function useConfigAll() {
  return useQuery({
    queryKey: ['config-all'],
    queryFn: async () => {
      const { data } = await apiClient.get<ConfigAllResponse>('/config/all');
      return data;
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}

export function useDomains() {
  const { data, ...rest } = useConfigAll();
  return { data: data?.domains, ...rest };
}

export function useSeams() {
  const { data, ...rest } = useConfigAll();
  return { data: data?.seams, ...rest };
}

export function useArchetypes() {
  const { data, ...rest } = useConfigAll();
  return { data: data?.archetypes, ...rest };
}

export function useVoidCodes() {
  const { data, ...rest } = useConfigAll();
  return { data: data?.voidCodes, ...rest };
}

export function useSubscriptionPackages() {
  const { data, ...rest } = useConfigAll();
  return { data: data?.subscriptionPackages, ...rest };
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
