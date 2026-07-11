import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  type GenerateHandoffLinkResponse,
  GatePassed,
  GateFailed,
  GateResult,
  StageCompleteData,
} from "@t/api.types";
import { useAuthStore } from '@/store/auth.store';

export function useElicitation(sessionId?: string) {
  const sessionQuery = useQuery({
    queryKey: ["elicitation", "session", sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const { data } = await apiClient.get(
        `/elicitation/sessions/${sessionId}`,
      );
      return data;
    },
    enabled: !!sessionId,
  });

  const inviteTechTeam = useMutation({
    mutationFn: async (payload: { sessionId: string; emails: string[] }) => {
      const { data } = await apiClient.post(
        `/elicitation/sessions/${payload.sessionId}/invite`,
        {
          emails: payload.emails,
        },
      );
      return data;
    },
  });

  return {
    session: sessionQuery.data,
    isLoadingSession: sessionQuery.isLoading,
    inviteTechTeam,
  };
}

// ─── Shared Types ─────────────────────────────────────────────────────



// ─── API Methods ──────────────────────────────────────────────────────

/** Create a new elicitation session or resume the existing IN_PROGRESS one. */
export async function createSession() {
  const { data } = await apiClient.post("/elicitation/sessions");
  return data;
}

/** Get the full session state (used for polling and resuming). */
export async function getSession(sessionId: string) {
  const { data } = await apiClient.get(`/elicitation/sessions/${sessionId}`);
  return data;
}

/** Stage 1 — Submit symptom text (SLOW: 10-30s LLM call). */
export async function submitStage1(sessionId: string, symptomText: string) {
  const { data } = await apiClient.put(
    `/elicitation/sessions/${sessionId}/stage1`,
    { symptomText },
    { timeout: 120_000 },
  );
  return data;
}

/** Stage 2 — Select archetype and acknowledge voids. */
export async function submitStage2(
  sessionId: string,
  archetype: string,
  acknowledgedVoidCodes?: string[],
) {
  const { data } = await apiClient.put(
    `/elicitation/sessions/${sessionId}/stage2`,
    { archetype, acknowledgedVoidCodes },
  );
  return data;
}

/** Stage 3 — Answer probe questions (keys must match backend's ARCHETYPE_PROBE_QUESTIONS). */
export async function submitStage3(
  sessionId: string,
  probeResponses: Record<string, string>,
) {
  const { data } = await apiClient.put(
    `/elicitation/sessions/${sessionId}/stage3`,
    { probeResponses },
  );
  return data;
}

/** Stage 4 — Submit technical context (Scenario A). Returns { session, missingArtifacts }. */
export async function submitStage4(
  sessionId: string,
  current_stack: string,
  integration_method: string,
  data_available: string,
  additional_requirement_1: string,
  technical_artifacts: Record<string, string>
) {
  const latency_requirement = `Integration Method: ${integration_method}`;

  const { data } = await apiClient.put(
    `/elicitation/sessions/${sessionId}/stage4`,
    { current_stack, data_available, latency_requirement, additional_requirement_1, technical_artifacts },
    { timeout: 120_000 },
  );
  return data;
}

/** Stage 4 — Auto-Save Draft */
export async function saveStage4Draft(
  sessionId: string,
  draftJson: any
): Promise<{ saved: boolean }> {
  const { data } = await apiClient.patch(
    `/elicitation/sessions/${sessionId}/stage4-draft`,
    { draftJson }
  );
  return data;
}

/** Stage 5 — Trigger the actual synthesis process. Returns GateResult. */
export async function submitStage5(sessionId: string) {
  const { data } = await apiClient.post(
    `/elicitation/sessions/${sessionId}/stage5`,
    {},
    { timeout: 120_000 },
  );
  return data;
}

/** Stage 4 — Tech Team handoff submit */
export async function submitStage4Handoff(sessionId: string, payload: any) {
  const { data } = await apiClient.put(
    `/elicitation/sessions/${sessionId}/stage4-handoff`,
    payload,
    { timeout: 120_000 }
  );
  return data;
}

/** Stage 4 — Let AI recommend tech context (non-technical CEO fallback) */
export async function recommendStage4(sessionId: string) {
  const { data } = await apiClient.post(
    `/elicitation/sessions/${sessionId}/stage4-recommend`
  );
  return data;
}

/** Generate a handoff link to invite the tech team. */
export async function inviteTechTeam(sessionId: string, email: string) {
  const { data } = await apiClient.post<GenerateHandoffLinkResponse>(
    `/elicitation/sessions/${sessionId}/generate-handoff-link`,
    { email },
  );
  return data;
}

// ─── Error Helper ─────────────────────────────────────────────────────

/**
 * Standard error handler for elicitation API calls.
 * Returns a user-friendly message. If the error is a subscription guard,
 * signals via return value so the caller can redirect.
 */
export function handleElicitationError(err: any): {
  message: string;
  isSubscriptionError: boolean;
} {
  const status = err.response?.status;
  const message = err.response?.data?.message;
  if (status === 403 && message?.includes("subscription")) {
    return {
      message: "Subscription required. Please activate Client Pro first.",
      isSubscriptionError: true,
    };
  }
  return {
    message: message || "Something went wrong. Please try again.",
    isSubscriptionError: false,
  };
}

export async function getActiveSession() {
  const { data } = await apiClient.get('/elicitation/sessions/active');
  return data;
}

export async function abandonSession(sessionId: string) {
  const { data } = await apiClient.put(`/elicitation/sessions/${sessionId}/abandon`);
  return data;
}

export async function revertSession(sessionId: string, targetStage: number) {
  const { data } = await apiClient.put(`/elicitation/sessions/${sessionId}/revert`, { targetStage });
  return data;
}

// ─── Shared Constants ─────────────────────────────────────────────────

export const STAGE_LABELS = [
  "Symptoms",
  "Archetype",
  "Probes",
  "Tech Context",
  "Synthesis",
];

export const VOID_DESCRIPTIONS: Record<string, string> = {
  NO_GROUND_TRUTH: "No baseline established to measure AI performance.",
  NO_BASELINE: "No current system or baseline to compare against.",
  UNCLEAR_SUCCESS_METRIC:
    "Success criteria are vague. How will you measure success?",
  TIMELINE_UNREALISTIC:
    "The timeline described may not be realistic for AI delivery.",
  INTEGRATION_UNCLEAR:
    "Integration points with existing systems are not clearly defined.",
  DATA_AVAILABILITY_UNKNOWN: "Data availability and quality are not specified.",
  UNCLEAR_USER_PERSONA:
    "The target users and their needs are not clearly defined.",
  DATA_PRIVACY_CONSTRAINT: "Sensitive data involved, compliance unclear.",
  SCOPE_CREEP_RISK: "Too many objectives for a single engagement.",
};


export async function saveDraft(
  sessionId: string,
  symptomTextDraft: string,
): Promise<{ saved: boolean; reason?: string }> {
  const { data } = await apiClient.patch(
    `/elicitation/sessions/${sessionId}/draft`,
    { symptomTextDraft },
  );
  return data;
}

export async function retrySynthesis(sessionId: string): Promise<unknown> {
  const { data } = await apiClient.post(
    `/elicitation/sessions/${sessionId}/retry-synthesis`,
  );
  return data;
}

export async function setSelfTechnical(
  sessionId: string,
  selfTechnical: boolean,
): Promise<void> {
  const { data } = await apiClient.put(
    `/elicitation/sessions/${sessionId}/self-technical`,
    { selfTechnical },
  );
  // Backend re-issues a JWT with updated selfTechnical claim
  if (data?.access_token) {
    useAuthStore.getState().setTokens(data.access_token, '');
  }
}
