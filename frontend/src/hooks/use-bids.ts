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
} from "@/types/api.types";
import {
  ConditionalPricingItem,
  FootprintAlignment,
} from "@/types/jsonb.types";
function normalizeSeamCodes(alignment: FootprintAlignment) {
  return {
    ...alignment,
    seams: alignment.seams.map((s) => ({
      ...s,
      code: s.code.replace(/↔/g, "<->"),
    })),
  };
}

export function useCreateBid() {
  const queryClient = useQueryClient();

  return useMutation({
    // Payload for sending the DTO needed for the BE to receive, if there's already a defined DTO in the FE -> use it, if not, create a custom payload to fit with the BE requires
    mutationFn: async (payload: CreateBidPayLoad) => {
      const body = {
        ...payload,
        footprint_alignment_json: normalizeSeamCodes(
          payload.footprint_alignment_json,
        ),
      };

      const { data } = await apiClient.post("/bids", body);
      return data;
    },

    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ["bids"] });
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
    },
  });
}

export function useBid(bidId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["bids", bidId],
    queryFn: async () => {
      const { data } = await apiClient.get<CapabilityBidDto>(`/bids/${bidId}`);
      return data;
    },
    enabled: isAuthenticated && !!bidId,
  });
}

export function useUpdateBid() {
  const queryClient = useQueryClient();

  return useMutation({
    // Payload for sending the DTO needed for the BE to receive, if there's already a defined DTO in the FE -> use it, if not, create a custom payload to fit with the BE requires
    mutationFn: async ({ bidId, body }: UpdateBidVariables) => {
      const modifiedBody = {
        ...body,
        footprint_alignment_json: normalizeSeamCodes(
          body.footprint_alignment_json,
        ),
      };

      const { data } = await apiClient.put<CapabilityBidDto>(
        `/bids/${bidId}`,
        modifiedBody,
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
