import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import { useAuthStore } from "@store/auth.store";
import {
  CapabilityBidDto,
  CreateBidPayLoad,
  UpdateBidVariables,
  TechReviewVariables,
  CeoDecisionVariables,
  CounterOfferVariables,
  CreateOfferVariables,
  OfferDecisionVariables,
  BidFinalizationResponse,
} from "@/types/api.types";
import {
  ConditionalPricingItem,
  FootprintAlignment,
} from "@/types/jsonb.types";

export const bidQueryKeys = {
  all: ["bids"] as const,
  list: (projectId?: string) => ["bids", "list", projectId ?? "all"] as const,
  detail: (bidId: string) => ["bids", bidId] as const,
};

function invalidateBidFlow(queryClient: ReturnType<typeof useQueryClient>, bidId?: string) {
  queryClient.invalidateQueries({ queryKey: bidQueryKeys.all });
  if (bidId) queryClient.invalidateQueries({ queryKey: bidQueryKeys.detail(bidId) });
  queryClient.invalidateQueries({ queryKey: ["engagements"] });
  queryClient.invalidateQueries({ queryKey: ["projects"] });
}

export function useBids(projectId?: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: bidQueryKeys.list(projectId),
    queryFn: async () => {
      const { data } = await apiClient.get<CapabilityBidDto[]>("/bids", {
        params: projectId ? { projectId } : undefined,
      });
      return data;
    },
    enabled: isAuthenticated,
    staleTime: 10_000,
  });
}
export function useCreateBid() {
  const queryClient = useQueryClient();

  return useMutation({
    // Payload for sending the DTO needed for the BE to receive, if there's already a defined DTO in the FE -> use it, if not, create a custom payload to fit with the BE requires
    mutationFn: async (payload: CreateBidPayLoad) => {
      const { data } = await apiClient.post("/bids", payload);
      return data;
    },

    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ["bids"] });
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
    },
  });
}

export function useBid(bidId: string, options?: { refetchInterval?: number }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: bidQueryKeys.detail(bidId),
    queryFn: async () => {
      const { data } = await apiClient.get<CapabilityBidDto>(`/bids/${bidId}`);
      return data;
    },
    enabled: isAuthenticated && !!bidId,
    refetchInterval: options?.refetchInterval,
  });
}

export function useCreateOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bidId, body }: CreateOfferVariables) => {
      const { data } = await apiClient.post<CapabilityBidDto>(`/bids/${bidId}/offers`, body);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(bidQueryKeys.detail(data.id), data);
      invalidateBidFlow(queryClient, data.id);
    },
  });
}

export function useAcceptOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bidId, offerId }: OfferDecisionVariables) => {
      const { data } = await apiClient.post<BidFinalizationResponse>(
        `/bids/${bidId}/offers/${offerId}/accept`,
      );
      return data;
    },
    onSuccess: (data) => {
      invalidateBidFlow(queryClient, data.bidId);
      queryClient.invalidateQueries({
        queryKey: ["engagements", data.engagementId, "milestones"],
      });
    },
  });
}

export function useDeclineOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bidId, offerId }: OfferDecisionVariables) => {
      const { data } = await apiClient.post<{ declined: boolean; bidId: string; offerId: string }>(
        `/bids/${bidId}/offers/${offerId}/decline`,
      );
      return data;
    },
    onSuccess: (data) => invalidateBidFlow(queryClient, data.bidId),
  });
}

export function useUpdateBid() {
  const queryClient = useQueryClient();

  return useMutation({
    // Payload for sending the DTO needed for the BE to receive, if there's already a defined DTO in the FE -> use it, if not, create a custom payload to fit with the BE requires
    mutationFn: async ({ bidId, body }: UpdateBidVariables) => {
      const { data } = await apiClient.put<CapabilityBidDto>(
        `/bids/${bidId}`,
        body,
      );
      return data;
    },

    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ["bids"] });
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
    },
  });
}

export function useTechReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bidId, body }: TechReviewVariables) => {
      const { data } = await apiClient.put<CapabilityBidDto>(
        `/bids/${bidId}/tech-review`,
        body,
      );
      return data;
    },

    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ["bids"] });
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
    },
  });
}

export function useCeoDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bidId, body }: CeoDecisionVariables) => {
      const { data } = await apiClient.put<CapabilityBidDto>(
        `/bids/${bidId}/ceo-decision`,
        body,
      );
      return data;
    },

    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ["bids"] });
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
    },
  });
}

export function useCounterOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bidId, body }: CounterOfferVariables) => {
      const { data } = await apiClient.put<CapabilityBidDto>(
        `/bids/${bidId}/counter-offer`,
        body,
      );
      return data;
    },

    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ["bids"] });
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
    },
  });
}

export function useWithdrawBid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bidId: string) => {
      // Backend returns { withdrawn: true, bidId } — not the full bid DTO.
      const { data } = await apiClient.delete<{ withdrawn: boolean; bidId: string }>(`/bids/${bidId}`);
      return data;
    },
    onSuccess: (data) => {
      invalidateBidFlow(queryClient, data?.bidId);
    },
  });
}

export function useReconcileBid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bidId: string) => {
      // Backend returns { reconciled: boolean, bid: CapabilityBidDto } —
      // the bid is nested, not returned directly.
      const { data } = await apiClient.post<{ reconciled: boolean; bid: CapabilityBidDto }>(
        `/bids/${bidId}/reconcile`,
      );
      return data;
    },
    onSuccess: (data) => {
      if (data?.bid) {
        queryClient.setQueryData(bidQueryKeys.detail(data.bid.id), data.bid);
      }
      invalidateBidFlow(queryClient, data?.bid?.id);
    },
  });
}


export function isReconciliationRequiredError(error: unknown): boolean {
  const code = (error as any)?.response?.data?.error;
  return code === "BID_NEGOTIATION_RECONCILIATION_REQUIRED";
}