import type { DomainDefinition, SeamDefinition, ArchetypeDefinition, ProbeQuestion, SubPackage } from '@/types/api.types';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

// ── Analytics ──────────────────────────────────────────────────────────
// GET /admin/analytics
export function useAdminAnalytics() {
  return useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: () => apiClient.get("/admin/analytics").then((r) => r.data),
  });
}

// ── Disputes ───────────────────────────────────────────────────────────
// GET /admin/disputes
export function useAdminDisputes(state?: string) {
  return useQuery({
    queryKey: ["admin", "disputes", state],
    queryFn: () => {
      const params = state ? { state } : undefined;
      return apiClient.get("/admin/disputes", { params }).then((r) => r.data);
    },
  });
}

// GET /disputes/:id
export function useDisputeDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "dispute", id],
    queryFn: () => apiClient.get(`/disputes/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

// PUT /admin/disputes/:id/resolve
export function useResolveDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: string;
      decision: "release" | "refund" | "split";
    }) =>
      apiClient
        .put(`/admin/disputes/${id}/resolve`, { decision })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "disputes"] });
      qc.invalidateQueries({ queryKey: ["admin", "dispute"] });
      qc.invalidateQueries({ queryKey: ["admin", "transactions"] });
    },
  });
}

<<<<<<< HEAD
// ── Users ──────────────────────────────────────────────────────────────
// GET /admin/users
export function useAdminUsers(page = 1, limit = 20) {
  return useQuery({
    queryKey: ["admin", "users", page, limit],
    queryFn: () =>
      apiClient
        .get("/admin/users", { params: { page, limit } })
        .then((r) => r.data),
  });
}

// PUT /admin/users/:id/suspend
export function useSuspendUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.put(`/admin/users/${id}/suspend`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
=======

// ── Admin Config Hooks ──────────────────────────────────────────

export function useAdminConfigItems(activeTab: 'domains' | 'seams') {
  return useQuery<(DomainDefinition | SeamDefinition)[]>({
    queryKey: ['admin-config', activeTab],
    queryFn: async () => {
      const res = await apiClient.get(`/admin/config/${activeTab}`);
      return res.data;
    }
  });
}

export function useSaveAdminConfigItem(activeTab: 'domains' | 'seams', options?: { onSuccess?: () => void }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      if (data.id) {
        // Update
        const payload = {
          name: data.name,
          description: data.description,
          sortOrder: data.sortOrder,
          isActive: data.isActive
        };
        return apiClient.put(`/admin/config/${activeTab}/${data.id}`, payload);
      } else {
        // Create
        const payload = {
          code: data.code,
          name: data.name,
          description: data.description,
          sortOrder: data.sortOrder
        };
        return apiClient.post(`/admin/config/${activeTab}`, payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-config', activeTab] });
      options?.onSuccess?.();
    }
  });
}

export function useAdminArchetypes() {
  return useQuery<ArchetypeDefinition[]>({
    queryKey: ['admin-config', 'archetypes'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/config/archetypes');
      return res.data;
    }
  });
}

export function useSaveAdminArchetype(options?: { onSuccess?: () => void }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      if (data.id) {
        // Update
        const payload = {
          name: data.name,
          description: data.description,
          sortOrder: data.sortOrder,
          isActive: data.isActive
        };
        return apiClient.put(`/admin/config/archetypes/${data.id}`, payload);
      } else {
        // Create
        const payload = {
          code: data.code,
          name: data.name,
          description: data.description,
          sortOrder: data.sortOrder
        };
        return apiClient.post('/admin/config/archetypes', payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-config', 'archetypes'] });
      options?.onSuccess?.();
    }
  });
}

export function useAdminProbeQuestions(archetypeCode: string | null) {
  return useQuery<ProbeQuestion[]>({
    queryKey: ['admin-config', 'probe-questions', archetypeCode],
    queryFn: async () => {
      if (!archetypeCode) return [];
      const res = await apiClient.get(`/admin/config/probe-questions?archetypeCode=${archetypeCode}`);
      return res.data;
    },
    enabled: !!archetypeCode
  });
}

export function useSaveAdminProbeQuestion(options?: { onSuccess?: () => void }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      if (data.id) {
        const payload = {
          questionText: data.questionText,
          displayOrder: data.displayOrder,
          isActive: data.isActive
        };
        return apiClient.put(`/admin/config/probe-questions/${data.id}`, payload);
      } else {
        const payload = {
          archetypeCode: data.archetypeCode,
          questionText: data.questionText,
          displayOrder: data.displayOrder
        };
        return apiClient.post('/admin/config/probe-questions', payload);
      }
    },
    onSuccess: (res, variables) => {
      qc.invalidateQueries({ queryKey: ['admin-config', 'probe-questions', variables.archetypeCode] });
      options?.onSuccess?.();
    }
  });
}

// ── Admin Packages Hooks ────────────────────────────────────────

export function useSubscriptionPackages() {
  return useQuery<SubPackage[]>({
    queryKey: ['admin-subscription-packages'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/subscriptions/packages');
      return res.data;
    }
  });
}

export function useCreateSubscriptionPackage(options?: { onSuccess?: () => void }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<SubPackage>) => apiClient.post('/admin/subscriptions/packages', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-subscription-packages'] });
      options?.onSuccess?.();
    }
  });
}

export function useUpdateSubscriptionPackage(options?: { onSuccess?: () => void }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SubPackage> }) => 
      apiClient.put(`/admin/subscriptions/packages/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-subscription-packages'] });
      options?.onSuccess?.();
    }
  });
}

export function useDeleteSubscriptionPackage(options?: { onSuccess?: () => void; onError?: (error: any) => void }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/admin/subscriptions/packages/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-subscription-packages'] });
      options?.onSuccess?.();
    },
    onError: (error) => {
      options?.onError?.(error);
    }
  });
}

export function useAdminWithdrawals(status?: string) {
  return useQuery({
    queryKey: ["admin", "withdrawals", status],
    queryFn: () => {
      const params = status ? { status } : undefined;
      return apiClient.get("/admin/withdrawals", { params }).then((r) => r.data);
    },
  });
}

export function useCompleteWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.put(`/admin/withdrawals/${id}/complete`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
>>>>>>> cec84dc4d1bce2eb778eb996b1b429d05ad4f741
    },
  });
}

<<<<<<< HEAD
// PUT /admin/users/:id/reactivate
export function useReactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.put(`/admin/users/${id}/reactivate`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

// ── Platform Settings ──────────────────────────────────────────────────
// GET /admin/platform-settings
export function usePlatformSettings() {
  return useQuery({
    queryKey: ["admin", "platform-settings"],
    queryFn: () =>
      apiClient.get("/admin/platform-settings").then((r) => r.data),
  });
}

// PUT /admin/platform-settings
export function useUpdatePlatformSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { platform_fee_pct: number }) =>
      apiClient.put("/admin/platform-settings", body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "platform-settings"] });
    },
  });
}
=======
export function useFailWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.put(`/admin/withdrawals/${id}/fail`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
    },
  });
}
>>>>>>> cec84dc4d1bce2eb778eb996b1b429d05ad4f741
