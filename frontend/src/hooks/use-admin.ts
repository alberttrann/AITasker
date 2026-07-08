import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

// GET /admin/analytics
export function useAdminAnalytics() {
  return useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: () => apiClient.get("/admin/analytics").then((r) => r.data),
  });
}

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
      // Invalidate ledger/transactions if needed
      qc.invalidateQueries({ queryKey: ["admin", "transactions"] });
    },
  });
}
