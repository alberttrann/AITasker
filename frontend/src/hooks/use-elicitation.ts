import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { type GenerateHandoffLinkResponse } from "@t/api.types";

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

export interface GatePassed {
  gate_passed: true;
  completeness_score: number;
  project_id: string;
}

export interface GateFailed {
  gate_passed: false;
  completeness_score: number;
  flagged_void: string | null;
  return_to_stage: number;
  advisory_note: string;
}

export type GateResult = GatePassed | GateFailed;

export interface StageCompleteData {
  voidListJson?: import("@t/jsonb.types").VoidItem[];
  archetype?: string;
  probeResponses?: Record<string, string>;
  gateResult?: GateResult;
}

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

/** Stage 4 — Submit technical context (Scenario A). Returns GateResult. */
export async function submitStage4(
  sessionId: string,
  scaleAndInfrastructure: string,
  integrationMethod: string,
  legacyVolume: string,
  schemas: string[],
  contracts: string[],
) {
  const current_stack = `Scale & Infra: ${scaleAndInfrastructure}\nSchemas: ${schemas.join(", ") || "None"}`;
  const data_available = `Legacy Volume: ${legacyVolume}`;
  const latency_requirement = `Integration Method: ${integrationMethod}\nContracts: ${contracts.join(", ") || "None"}`;

  const { data } = await apiClient.put(
    `/elicitation/sessions/${sessionId}/stage4`,
    { current_stack, data_available, latency_requirement },
    { timeout: 120_000 },
  );
  return data;
}

/** Stage 4 — Tech Team handoff submit */
export async function submitStage4Handoff(sessionId: string, payload: any) {
  const { data } = await apiClient.put(
    `/elicitation/${sessionId}/stage4-handoff`,
    payload
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

// ─── Shared Constants ─────────────────────────────────────────────────

export const STAGE_LABELS = [
  "Symptoms",
  "Archetype",
  "Probes",
  "Tech Context",
  "Synthesis",
];

export const ARCHETYPES = [
  {
    code: "1",
    label: "AI Search & Q&A",
    desc: "Can AI answer questions from your documents?",
    icon: "🔍",
  },
  {
    code: "2",
    label: "Personalisation & Recs",
    desc: "Can AI personalize content for each user?",
    icon: "🎯",
  },
  {
    code: "3",
    label: "Classification & Docs",
    desc: "Can AI sort, tag, or extract info from documents?",
    icon: "📄",
  },
  {
    code: "4",
    label: "Conversational Agent",
    desc: "Can AI handle customer/service conversations?",
    icon: "💬",
  },
  {
    code: "5",
    label: "Predictive Analytics",
    desc: "Can AI predict outcomes from historical data?",
    icon: "📈",
  },
  {
    code: "6",
    label: "AI Process Automation",
    desc: "Can AI automate a manual workflow?",
    icon: "⚙️",
  },
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

export const PROBES: Record<
  string,
  { q1: string; q2: string; q3: string; q4: string }
> = {
  "1": {
    q1: "Roughly how many people will search or ask questions per day?",
    q2: "When someone gets a wrong or unhelpful answer, what do you expect to happen next?",
    q3: "Does this need to pull from documents/systems you already have, and which ones?",
    q4: "How quickly does an answer need to appear after someone asks?",
  },
  "2": {
    q1: "Roughly how many users will see recommendations, and how often?",
    q2: "What should happen if someone ignores or dislikes a recommendation?",
    q3: "Where do you already track what users like/buy/view \u2014 any existing system?",
    q4: "How fresh do recommendations need to be (instant, hourly, daily)?",
  },
  "3": {
    q1: "Roughly how many items need classifying per day?",
    q2: "What should happen when the system isn\u2019t confident about a classification?",
    q3: "Where does the data to classify come from today \u2014 any existing system?",
    q4: "How quickly does a classification decision need to be made?",
  },
  "4": {
    q1: "Roughly how much content needs generating per day/week?",
    q2: "What happens if generated content is wrong or inappropriate \u2014 who reviews it?",
    q3: "Does generated content need to match an existing brand voice/system/template?",
    q4: "How long can someone wait for content to be generated?",
  },
  "5": {
    q1: "How far ahead are you trying to predict, and how often do you need a new prediction?",
    q2: "What happens today when a prediction turns out wrong?",
    q3: "What historical data do you already have to learn from?",
    q4: "How quickly after new data arrives do you need an updated prediction?",
  },
  "6": {
    q1: "Roughly how many items (images/audio/video) need processing per day?",
    q2: "What should happen when the system can\u2019t confidently interpret an input?",
    q3: "Where does this input data come from today \u2014 any existing system?",
    q4: "How quickly does processing need to complete after input arrives?",
  },
};

export const ARCHETYPE_LABELS: Record<string, string> = {
  "1": "AI Search & Q&A (RAG)",
  "2": "Personalisation & Recommendations",
  "3": "Classification & Document Processing",
  "4": "Conversational Agent / Chatbot",
  "5": "Predictive Analytics",
  "6": "AI Process Automation",
};
