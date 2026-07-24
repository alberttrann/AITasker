import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import { useAuthStore } from "@store/auth.store";

export type ReviewerRole = "CEO" | "TECH_TEAM" | "EXPERT";

export interface ReviewDto {
  id: string;
  engagementId: string;
  reviewerId: string;
  targetId: string;
  rating: number;
  comment: string | null;
  structuredSignalsJson: TechTeamReviewSignals | null;
  reviewerRole: ReviewerRole;
}

export interface ReviewWithReviewerDto extends ReviewDto {
  reviewer: { id: string; fullName: string };
}

export interface ReviewWithTargetDto extends ReviewDto {
  target: { id: string; fullName: string };
}

/**
 * Structured signals required from a TECH_TEAM reviewer. This shape is not
 * enforced by the backend beyond "must be valid JSON" (JSON.parse with no
 * schema validation) — defined here as the app's own convention.
 */
export interface TechTeamReviewSignals {
  codeQualityRating: number; // 1-5
  communicationRating: number; // 1-5
  seamRatings: { seamCode: string; rating: number }[];
  wouldRecommend: boolean;
}

export interface CreateReviewPayload {
  engagementId: string;
  targetId: string;
  rating: number;
  comment?: string;
  /** Required only when the calling user is a Tech-Team reviewer. */
  structuredSignalsJson?: string; // JSON.stringify(TechTeamReviewSignals)
}

export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateReviewPayload) => {
      const { data } = await apiClient.post<ReviewDto>("/reviews", payload);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["reviews", "engagement", data.engagementId] });
      queryClient.invalidateQueries({ queryKey: ["reviews", "me"] });
      queryClient.invalidateQueries({ queryKey: ["reviews", "user", data.targetId] });
    },
  });
}

/** Reviews for a single engagement — party-gated server-side (CLOSED engagements only). */
export function useEngagementReviews(engagementId: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["reviews", "engagement", engagementId],
    queryFn: async () => {
      const { data } = await apiClient.get<ReviewDto[]>(`/reviews/${engagementId}`);
      return data;
    },
    enabled: isAuthenticated && !!engagementId,
  });
}

/** Public reviews for a user's profile — no engagement-CLOSED gate on this one. */
export function useUserReviews(userId: string | undefined) {
  return useQuery({
    queryKey: ["reviews", "user", userId],
    queryFn: async () => {
      const { data } = await apiClient.get<ReviewWithReviewerDto[]>(`/reviews/users/${userId}`);
      return data;
    },
    enabled: !!userId,
  });
}

/** Reviews I've written, as the reviewer. */
export function useMyReviews() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["reviews", "me"],
    queryFn: async () => {
      const { data } = await apiClient.get<ReviewWithTargetDto[]>("/reviews/me");
      return data;
    },
    enabled: isAuthenticated,
  });
}

/** Reviews I've received, as the target. */
export function useMyReceivedReviews() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["reviews", "me", "received"],
    queryFn: async () => {
      const { data } = await apiClient.get<ReviewWithReviewerDto[]>("/reviews/me/received");
      return data;
    },
    enabled: isAuthenticated,
  });
}

/**
 * Checks whether a caught error from useCreateReview is the backend's
 * "already reviewed" conflict (@@unique([engagementId, reviewerId])),
 * so the UI can show a clear message instead of a generic failure.
 */
export function isAlreadyReviewedError(error: unknown): boolean {
  const message = (error as any)?.response?.data?.message;
  return typeof message === "string" && message.includes("have made this review before");
}

/**
 * Checks whether a caught error is the "engagement not closed yet" gate
 * (ConflictException('This engagement is not closed yet!')).
 */
export function isEngagementNotClosedError(error: unknown): boolean {
  const message = (error as any)?.response?.data?.message;
  return typeof message === "string" && message.includes("is not closed yet");
}