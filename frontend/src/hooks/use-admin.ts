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
    },
  });
}

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
