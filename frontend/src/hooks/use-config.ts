import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

import type { 
  DomainDefinition, 
  SeamDefinition, 
  ArchetypeDefinition, 
  ProbeQuestion as ProbeQuestionDefinition,
  SubPackage,
  VoidCodeDefinition,
  ConfigAllResponse,
} from '@/types/api.types';

/**
 * Fetches the entire platform configuration payload (domains, seams, archetypes, void codes, subscription packages) in a single cached call.
 */
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

/**
 * Returns the list of registered business domain definitions (e.g. FINTECH, ECOMMERCE, HEALTHCARE).
 */
export function useDomains() {
  const { data, ...rest } = useConfigAll();
  return { data: data?.domains, ...rest };
}

/**
 * Returns the list of registered seam interface definitions connecting pairs of domains.
 */
export function useSeams() {
  const { data, ...rest } = useConfigAll();
  return { data: data?.seams, ...rest };
}

/**
 * Returns the platform system archetype definitions (e.g. Marketplace, SaaS, Content Engine).
 */
export function useArchetypes() {
  const { data, ...rest } = useConfigAll();
  return { data: data?.archetypes, ...rest };
}

/**
 * Returns the platform void code definitions used in risk assessment and milestone quality gates.
 */
export function useVoidCodes() {
  const { data, ...rest } = useConfigAll();
  return { data: data?.voidCodes, ...rest };
}

/**
 * Returns the list of available Pro subscription pricing packages for Clients and Experts.
 */
export function useSubscriptionPackages() {
  const { data, ...rest } = useConfigAll();
  return { data: data?.subscriptionPackages, ...rest };
}

/**
 * Fetches probe questions for elicitation Stage 3 based on the selected project archetype code.
 */
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
