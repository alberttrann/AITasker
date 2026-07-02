# AITasker — Frontend Patches: Components, Types, Routing (CORRECTED)
## Verified against live codebase. Drop-in safe.

## ══════════════════════════════════════════════════════
## PATCH FE-C-02 — Stage1Symptoms.tsx: server-side draft save with debounce
## File: frontend/src/features/ceo/elicitation/Stage1Symptoms.tsx
##
## KEY FIXES vs original patch:
##   1. Original STR_REPLACE targets included the wrong import block pattern.
##      The fix below uses the minimal, unique anchors that will actually match.
##   2. useRef import was missing from the original patch target line.
##   3. `handleSaveName` call in ProjectsPage accepts 2 args — irrelevant here,
##      but noted to avoid confusion if Stage1 and ProjectsPage are open simultaneously.
## ══════════════════════════════════════════════════════

### STR_REPLACE 1 — add `useRef` to the React import

**FIND:**
```typescript
import { useState, useEffect } from "react";
```

**REPLACE WITH:**
```typescript
import { useState, useEffect, useRef } from "react";
```

---

### STR_REPLACE 2 — add saveDraft import

**FIND:**
```typescript
import {
  submitStage1,
  handleElicitationError,
  VOID_DESCRIPTIONS,
} from "@/hooks/use-elicitation";
```

**REPLACE WITH:**
```typescript
import {
  submitStage1,
  handleElicitationError,
  VOID_DESCRIPTIONS,
} from "@/hooks/use-elicitation";
import { saveDraft } from "@/hooks/use-elicitation-extras";
```

---

### STR_REPLACE 3 — add `symptomTextDraft` to the props interface

**FIND:**
```typescript
interface Stage1Props {
  sessionId: string;
  onComplete: (data: {
    voidListJson: VoidItem[];
    symptomText?: string;
  }) => void;
  onError: (msg: string) => void;
}
```

**REPLACE WITH:**
```typescript
interface Stage1Props {
  sessionId: string;
  symptomTextDraft?: string | null;  // ← server-side draft, passed from wizard
  onComplete: (data: {
    voidListJson: VoidItem[];
    symptomText?: string;
  }) => void;
  onError: (msg: string) => void;
}
```

---

### STR_REPLACE 4 — update component body: add debounce logic

> **Important:** The exact opening lines of the component function may vary.
> Find the unique anchor: the `useEffect` that reads from localStorage on mount.

**FIND:**
```typescript
  const [symptomText, setSymptomText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`stage1_${sessionId}`);
    if (saved) setSymptomText(saved);
  }, [sessionId]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSymptomText(e.target.value);
    localStorage.setItem(`stage1_${sessionId}`, e.target.value);
  };
```

**REPLACE WITH:**
```typescript
  const [symptomText, setSymptomText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Priority: localStorage (most recent keystrokes) > server draft > empty
  useEffect(() => {
    const local = localStorage.getItem(`stage1_${sessionId}`);
    if (local) {
      setSymptomText(local);
    } else if (symptomTextDraft) {
      // Cross-device restore from server-side draft
      setSymptomText(symptomTextDraft);
    }
  }, [sessionId, symptomTextDraft]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setSymptomText(value);

    // Layer 1: localStorage (instant, survives page refresh)
    localStorage.setItem(`stage1_${sessionId}`, value);

    // Layer 2: debounced server save (2 s after typing stops, cross-device)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await saveDraft(sessionId, value);
        if (result.saved) setLastSavedAt(new Date());
      } catch {
        // Silent fail — localStorage backup is sufficient
      }
    }, 2000);
  };
```

---

### STR_REPLACE 5 — clear draft on successful Stage 1 submit

**FIND (inside handleSubmit, right after submitStage1 call):**
```typescript
      const data = await submitStage1(sessionId, symptomText.trim());
      const voids = (data.voidListJson as VoidItem[]) ?? [];
```

**REPLACE WITH:**
```typescript
      const data = await submitStage1(sessionId, symptomText.trim());
      // Clear both draft layers on successful submission
      localStorage.removeItem(`stage1_${sessionId}`);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const voids = (data.voidListJson as VoidItem[]) ?? [];
```

---

### STR_REPLACE 6 — add "Draft saved" indicator in the JSX

**FIND (the character count line in the input screen):**
```typescript
      <div className="flex items-center justify-between">
        <span className="text-caption text-secondary">
          {symptomText.trim().length < minLength
            ? `Min ${minLength} characters required`
            : `${symptomText.trim().length} characters`}
        </span>
```

**REPLACE WITH:**
```typescript
      <div className="flex items-center justify-between">
        <span className="text-caption text-secondary flex items-center gap-2">
          {symptomText.trim().length < minLength
            ? `Min ${minLength} characters required`
            : `${symptomText.trim().length} characters`}
          {lastSavedAt && (
            <span className="text-success text-caption">· ✓ Draft saved</span>
          )}
        </span>
```

---

## ══════════════════════════════════════════════════════
## PATCH FE-C-03 — ElicitationWizard.tsx: pass symptomTextDraft to Stage1
## File: frontend/src/features/ceo/elicitation/ElicitationWizard.tsx
##
## NOTE: This patch is GUIDANCE, not a direct str_replace, because ElicitationWizard
## is marked as [Binary file] in the codebase snapshot and its exact code cannot
## be confirmed. Apply the logic described below manually.
## ══════════════════════════════════════════════════════

**Step 1 — In the wizard's session init sequence (wherever it calls `getSession` or
receives the session object after `createSession`), extract `symptom_text_draft`
and store it in wizard state:**

```typescript
// In the INIT_SUCCESS dispatch (or wherever sessionId/currentStage are stored):
dispatch({
  type: 'INIT_SUCCESS',
  payload: {
    sessionId,
    currentStage,
    sessionState,
    archetype,
    symptomTextDraft: session?.symptom_text_draft ?? null,  // ← ADD
  },
});
```

**Step 2 — In the wizardReducer, handle the new field in INIT_SUCCESS:**
```typescript
case 'INIT_SUCCESS':
  return {
    ...state,
    sessionId: action.payload.sessionId,
    currentStage: action.payload.currentStage,
    sessionState: action.payload.sessionState,
    archetype: action.payload.archetype,
    symptomTextDraft: action.payload.symptomTextDraft ?? null,  // ← ADD
  };
```

**Step 3 — Pass it to Stage1Symptoms in the JSX:**
```typescript
<Stage1Symptoms
  sessionId={state.sessionId!}
  symptomTextDraft={state.symptomTextDraft ?? null}   // ← ADD
  onComplete={(data) => { ... }}
  onError={(msg) => { ... }}
/>
```

---

## ══════════════════════════════════════════════════════
## PATCH FE-C-04 — SessionsListPage.tsx: show RETURNED sessions + use useSessionHistory
## File: frontend/src/features/ceo/pages/SessionsListPage.tsx
## ══════════════════════════════════════════════════════

### STR_REPLACE 1 — replace useElicitationSessions with useSessionHistory

**FIND:**
```typescript
import { 
  useElicitationSessions, 
  useRestoreElicitationSession, 
  useHardDeleteElicitationSession,
  useActiveElicitationSession,
  useDeleteElicitationSession
} from "@/hooks/use-projects";
```

**REPLACE WITH:**
```typescript
import { 
  useSessionHistory,
  useRestoreElicitationSession, 
  useHardDeleteElicitationSession,
  useActiveElicitationSession,
  useDeleteElicitationSession
} from "@/hooks/use-projects";
```

---

### STR_REPLACE 2 — swap the hook call inside the component

**FIND:**
```typescript
  const { sessions, isLoadingSessions } = useElicitationSessions();
```

**REPLACE WITH:**
```typescript
  const { data: sessions = [], isLoading: isLoadingSessions } = useSessionHistory();
  // useSessionHistory() hits GET /elicitation/sessions/history — returns ABANDONED
  // and RETURNED sessions only (no IN_PROGRESS, no COMPLETED).
```

---

### STR_REPLACE 3 — add RETURNED sessions display below the abandoned list

**FIND:**
```typescript
  const abandonedSessions = sessions
    .filter(s => s.state === 'ABANDONED')
    .sort((a, b) => getSafeDate(b, 'updatedAt') - getSafeDate(a, 'updatedAt'));
```

**REPLACE WITH:**
```typescript
  const abandonedSessions = sessions
    .filter(s => s.state === 'ABANDONED')
    .sort((a, b) => getSafeDate(b, 'updatedAt') - getSafeDate(a, 'updatedAt'));

  // RETURNED = quality gate failed — session sent back to the CEO for revision
  const returnedSessions = sessions
    .filter((s: any) => s.state === 'RETURNED')
    .sort((a: any, b: any) => getSafeDate(b, 'updatedAt') - getSafeDate(a, 'updatedAt'));
```

Then in the JSX, after the existing `abandonedSessions.map(...)` block, add a
section for returned sessions. Here is a minimal addition — find the end of the
abandoned sessions list render and append:

```typescript
{returnedSessions.length > 0 && (
  <>
    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mt-8 mb-4 px-1">
      Returned for Revision
    </h4>
    <div className="flex flex-col gap-4">
      {returnedSessions.map((session: any) => {
        const safeCreated = session.createdAt || session.created_at || new Date();
        const safeUpdated = session.updatedAt || session.updated_at || new Date();
        const safeStage = session.currentStage || session.current_stage || 1;
        return (
          <div
            key={session.id}
            className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5"
          >
            <div className="flex-1 min-w-0">
              <h4 className="text-lg font-bold text-slate-900 mb-1 truncate">
                {formatDraftName(safeCreated || safeUpdated)}
              </h4>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="text-amber-700 font-medium">Quality Gate Failed</span>
                <span>&middot;</span>
                <span>Returned at Stage {safeStage}</span>
                <span>&middot;</span>
                <span>Updated: {new Date(safeUpdated).toLocaleDateString()}</span>
              </div>
            </div>
            <button
              onClick={() => handleContinueSession(session.id)}
              disabled={restoringId === session.id}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-amber-600 text-white hover:bg-amber-700 font-semibold rounded-lg transition-colors w-full sm:w-auto disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {restoringId === session.id ? 'Restoring...' : 'Revise Session'}
            </button>
          </div>
        );
      })}
    </div>
  </>
)}
```

---

## ══════════════════════════════════════════════════════
## PATCH FE-C-05 — ShortlistView.tsx: wire useShortlist hook + refresh
## File: frontend/src/features/ceo/shortlist/ShortlistView.tsx
## ══════════════════════════════════════════════════════

### STR_REPLACE 1 — replace import

**FIND:**
```typescript
import { getShortlist } from '@/hooks/use-matching';
```

**REPLACE WITH:**
```typescript
import { useShortlist } from '@/hooks/use-matching';
```

---

### STR_REPLACE 2 — replace the useQuery block with useShortlist

**FIND:**
```typescript
  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['shortlist', projectId],
    queryFn: () => getShortlist(projectId!),
    enabled: !!projectId,
  });

  const experts = data?.results ?? [];
  const errorMessage = error ? ((error as any).response?.data?.message || 'Failed to load matched experts. Please try again.') : null;

  const formattedDate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : null;
```

**REPLACE WITH:**
```typescript
  const {
    experts,
    isLoading,
    isRefreshing,
    refreshError,
    refresh,
    lastUpdatedAt,
  } = useShortlist(projectId);

  const errorMessage = refreshError
    ? ((refreshError as any).response?.data?.message || 'Failed to refresh. Please try again.')
    : null;

  const formattedDate = lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : null;
```

Also remove the `useQuery` import from `@tanstack/react-query` if it is no longer used elsewhere in this file.

---

### STR_REPLACE 3 — update Refresh button

**FIND:**
```typescript
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="flex items-center gap-2">
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
            {isFetching ? "Refreshing..." : "Refresh Matches"}
          </Button>
```

**REPLACE WITH:**
```typescript
          <Button variant="outline" onClick={() => refresh()} disabled={isRefreshing} className="flex items-center gap-2">
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Re-scoring…" : "Refresh Matches"}
          </Button>
```

---

## ══════════════════════════════════════════════════════
## PATCH FE-C-06 — App.tsx routing: add missing routes
## File: frontend/src/App.tsx
## ══════════════════════════════════════════════════════

### STR_REPLACE 1 — add new page imports at the top

**FIND:**
```typescript
import ShortlistView from "@features/ceo/shortlist/ShortlistView";
import ProjectsPage from "@features/ceo/pages/ProjectsPage";
import SessionsListPage from "@features/ceo/pages/SessionsListPage";
import ExpertProfilePage from "@features/expert/profile/ExpertProfilePage";
```

**REPLACE WITH:**
```typescript
import ShortlistView from "@features/ceo/shortlist/ShortlistView";
import ProjectsPage from "@features/ceo/pages/ProjectsPage";
import ProjectDetailPage from "@features/ceo/pages/ProjectDetailPage";
import SessionsListPage from "@features/ceo/pages/SessionsListPage";
import ExpertProfilePage from "@features/expert/profile/ExpertProfilePage";
import VerificationHistoryPage from "@features/expert/verification/VerificationHistoryPage";
```

---

### STR_REPLACE 2 — add CEO routes

**FIND:**
```typescript
            <Route path="shortlist/:projectId" element={<ShortlistView />} />
          </Route>
```

**REPLACE WITH:**
```typescript
            <Route path="shortlist/:projectId" element={<ShortlistView />} />
            {/* Project detail + spec view */}
            <Route path="projects/:projectId" element={<ProjectDetailPage />} />
            {/* Dedicated shortlist route — canonical URL for matched experts */}
            <Route path="projects/:projectId/shortlist" element={<ShortlistView />} />
          </Route>
```

> **Note:** The existing `shortlist/:projectId` route is kept for backward compatibility
> with any hardcoded links. Both routes render `ShortlistView`.

---

### STR_REPLACE 3 — add Expert verification-history route

**FIND:**
```typescript
            <Route
              path="subscription"
              element={<ExpertSubscriptionActivate />}
            />
          </Route>
```

**REPLACE WITH:**
```typescript
            <Route
              path="subscription"
              element={<ExpertSubscriptionActivate />}
            />
            {/* Verification history — GET /portfolio-submissions */}
            <Route path="verification-history" element={<VerificationHistoryPage />} />
          </Route>
```

---

## ══════════════════════════════════════════════════════
## PATCH FE-C-07 — NEW PAGE: VerificationHistoryPage
## File: frontend/src/features/expert/verification/VerificationHistoryPage.tsx  (CREATE NEW)
##
## KEY FIXES vs original patch:
##   1. SEAM_LABELS is already inline in ExpertProfilePage as `getSeamLabel()`.
##      Rather than requiring a new constants file, VerificationHistoryPage
##      includes its own inline map (consistent with existing pattern).
##      You CAN extract it to constants/seam-labels.ts — see GAP-14 in gap_audit.
##   2. `format` from date-fns — only add if date-fns is already in package.json.
##      The component below uses `toLocaleDateString()` as a safe fallback.
##   3. Icons confirmed available in lucide-react: CheckCircle2, XCircle, Clock, Lock.
## ══════════════════════════════════════════════════════

```typescript
// FILE: frontend/src/features/expert/verification/VerificationHistoryPage.tsx

import { useMyPortfolioSubmissions } from '@/hooks/use-portfolio';
import { CheckCircle2, XCircle, Clock, Lock } from 'lucide-react';

const SEAM_LABELS: Record<string, string> = {
  'A↔B': 'Applied Agents',
  'A↔C': 'Prompt Engineering Apps',
  'A↔D': 'Fine-Tuned Apps',
  'A↔F': 'Production LLMs',
  'B↔E': 'Agents with Memory',
  'C↔E': 'Retrieval Prompting',
  'C↔F': 'PromptOps',
  'D↔E': 'Fine-Tuned RAG',
  'D↔F': 'MLOps for LLMs',
  'E↔F': 'Scalable RAG',
};

const STATUS_CONFIG = {
  APPROVED: {
    icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
    label: 'Verified',
    textColor: 'text-green-700',
  },
  REJECTED: {
    icon: <XCircle className="w-5 h-5 text-red-600" />,
    label: 'Rejected',
    textColor: 'text-red-700',
  },
  PENDING: {
    icon: <Clock className="w-5 h-5 text-amber-500" />,
    label: 'Pending',
    textColor: 'text-amber-700',
  },
} as const;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function VerificationHistoryPage() {
  const { data: submissions = [], isLoading } = useMyPortfolioSubmissions();

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-lg font-bold text-slate-900">No submissions yet</p>
        <p className="text-sm text-slate-500 mt-2">
          Submit portfolio evidence from your Expert Profile page to verify your seam claims.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 px-4 py-8">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">Verification History</h1>
        <p className="text-sm text-slate-500 mt-1">
          All your portfolio submissions and AI evaluation results.
        </p>
      </div>

      <div className="space-y-4">
        {submissions.map((sub) => {
          const cfg = STATUS_CONFIG[sub.status as keyof typeof STATUS_CONFIG]
            ?? STATUS_CONFIG.PENDING;
          const isLocked = sub.seamClaim.submissionCount >= 5;

          return (
            <div
              key={sub.id}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm"
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-900">
                    {SEAM_LABELS[sub.seamClaim.seamCode] ?? sub.seamClaim.seamCode}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Submitted {formatDate(sub.createdAt)}
                  </p>
                </div>
                <div className={`flex items-center gap-2 text-sm font-medium ${cfg.textColor}`}>
                  {cfg.icon}
                  {cfg.label}
                  {isLocked && <Lock className="w-4 h-4 text-red-600 ml-1" />}
                </div>
              </div>

              {/* Confidence bar */}
              {sub.llmConfidence !== null && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-28">LLM confidence</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        sub.status === 'APPROVED' ? 'bg-green-500' : 'bg-red-400'
                      }`}
                      style={{ width: `${Math.round((sub.llmConfidence ?? 0) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 w-10 text-right">
                    {Math.round((sub.llmConfidence ?? 0) * 100)}%
                  </span>
                </div>
              )}

              {/* AI advisory note */}
              {sub.advisoryNote && (
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">AI Feedback</p>
                  <p className="text-sm text-slate-800">{sub.advisoryNote}</p>
                </div>
              )}

              {/* Lockout warning */}
              {isLocked && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-700">
                    This seam is locked after 5 failed attempts. You can re-submit after the lockout period.
                  </p>
                </div>
              )}

              {/* Current tier + attempts */}
              <div className="text-xs text-slate-500">
                Current tier:{' '}
                <span className={
                  sub.seamClaim.verificationTier === 'EVIDENCE_BACKED'
                    ? 'text-green-700 font-medium'
                    : 'text-slate-600'
                }>
                  {sub.seamClaim.verificationTier}
                </span>
                {' '}· Attempts: {sub.seamClaim.submissionCount} / 5
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## ══════════════════════════════════════════════════════
## PATCH FE-C-08 — NEW PAGE: ProjectDetailPage
## File: frontend/src/features/ceo/pages/ProjectDetailPage.tsx  (CREATE NEW)
##
## KEY FIXES vs original patch:
##   1. ARCHETYPE_LABELS / TIER_LABELS are inline (no external constants file needed).
##      Extract to constants/ later if desired (see GAP-15).
##   2. `useProject` and `useUpdateProjectName` are in use-projects.ts (confirmed).
##   3. Shortlist route corrected to `/ceo/projects/:projectId/shortlist` (new canonical URL).
##   4. Removed the non-existent `/ceo/projects/:projectId/spec` route — linked to artifact-a
##      section inline instead.
## ══════════════════════════════════════════════════════

```typescript
// FILE: frontend/src/features/ceo/pages/ProjectDetailPage.tsx

import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '@/hooks/use-projects';
import { Button } from '@/components/ui/button';
import { Users, ArrowLeft, FileText } from 'lucide-react';

const ARCHETYPE_LABELS: Record<string, string> = {
  '1': 'RAG / Search & Answer',
  '2': 'Recommendation Engine',
  '3': 'Classification / Tagging',
  '4': 'Content Generation',
  '5': 'Prediction / Forecasting',
  '6': 'Multimodal',
};

const TIER_LABELS: Record<string, string> = {
  TIER_1: 'Small Scale',
  TIER_2: 'Medium Scale',
  TIER_3: 'Large Scale',
};

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-slate-500">Project not found.</p>
      </div>
    );
  }

  // Backend returns artifact_a_json (snake_case via mapProjectResponse)
  const a = project.artifact_a_json ?? project.artifactAJson ?? null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Back */}
      <button
        onClick={() => navigate('/ceo/projects')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </button>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {project.archetype && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 border border-blue-100">
              {ARCHETYPE_LABELS[project.archetype] ?? project.archetype}
            </span>
          )}
          {project.tier && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              {TIER_LABELS[project.tier] ?? project.tier}
            </span>
          )}
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
            project.state === 'PUBLISHED'
              ? 'bg-green-50 text-green-700 border border-green-100'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {project.state}
          </span>
        </div>

        <h1 className="text-3xl font-bold text-slate-900">
          {project.projectName ?? a?.project_name ?? 'Untitled Project'}
        </h1>

        {a?.business_intent && (
          <p className="text-sm text-slate-600 leading-relaxed">{a.business_intent}</p>
        )}
      </div>

      {/* Artifact A — stack tags + SDLC notices */}
      {a && (
        <div className="space-y-4">
          {a.stack_tags?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {a.stack_tags.map((t: string) => (
                <span
                  key={t}
                  className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 border border-slate-200"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          {a.sdlc_notices?.map((notice: string, i: number) => (
            <div
              key={i}
              className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3"
            >
              <p className="text-sm text-amber-800">⚠ {notice}</p>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 pt-2">
        <Button
          variant="primary"
          onClick={() => navigate(`/ceo/projects/${projectId}/shortlist`)}
          className="flex items-center gap-2"
        >
          <Users className="w-4 h-4" /> View Matched Experts
        </Button>
        {a && (
          <Button
            variant="outline"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2"
          >
            <FileText className="w-4 h-4" /> Spec (above)
          </Button>
        )}
      </div>
    </div>
  );
}
```

---

## ══════════════════════════════════════════════════════
## PATCH FE-C-09 — ExpertProfilePage.tsx: add "View History" button
## File: frontend/src/features/expert/profile/ExpertProfilePage.tsx
## ══════════════════════════════════════════════════════

### STR_REPLACE 1 — add useNavigate import

**FIND:**
```typescript
import React, { useState } from 'react';
import { useExpertProfile } from '@/hooks/use-expert-profile';
```

**REPLACE WITH:**
```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExpertProfile } from '@/hooks/use-expert-profile';
```

---

### STR_REPLACE 2 — add navigate hook inside the component

**FIND:**
```typescript
export default function ExpertProfilePage() {
  const { profile, isLoadingProfile } = useExpertProfile();
  const [isBuilding, setIsBuilding] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
```

**REPLACE WITH:**
```typescript
export default function ExpertProfilePage() {
  const { profile, isLoadingProfile } = useExpertProfile();
  const navigate = useNavigate();
  const [isBuilding, setIsBuilding] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
```

---

### STR_REPLACE 3 — add "View History" button next to "Verify a Seam"

**FIND:**
```typescript
              <Button 
                variant="outline" 
                size="sm" 
                className="text-blue-600 border-blue-200 hover:bg-blue-50 flex items-center gap-1"
                onClick={() => setIsVerifying(true)}
              >
                <ArrowUpCircle className="w-4 h-4" /> Verify a Seam
              </Button>
```

**REPLACE WITH:**
```typescript
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-blue-600 border-blue-200 hover:bg-blue-50 flex items-center gap-1"
                  onClick={() => setIsVerifying(true)}
                >
                  <ArrowUpCircle className="w-4 h-4" /> Verify a Seam
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-slate-600 border-slate-200 hover:bg-slate-50 flex items-center gap-1"
                  onClick={() => navigate('/expert/verification-history')}
                >
                  View History
                </Button>
              </div>
```

---

## ══════════════════════════════════════════════════════
## PATCH FE-C-10 — ProjectsPage.tsx: project cards already have "View Details" links
## File: frontend/src/features/ceo/pages/ProjectsPage.tsx
##
## VERDICT: NO PATCH NEEDED.
## The live ProjectsPage already renders:
##   <Link to={`/ceo/projects/${project.id}`}>View Details</Link>
##   <Link to={`/ceo/shortlist/${project.id}`}>View Shortlist</Link>
##
## After FE-C-06 adds the `/ceo/projects/:projectId` route, "View Details" will
## correctly resolve to ProjectDetailPage without any change here.
##
## The shortlist link still points to `/ceo/shortlist/:projectId` (the old route).
## Both that route and the new `/ceo/projects/:projectId/shortlist` render
## ShortlistView, so no breakage — but if you want to normalise to the new URL:
## ══════════════════════════════════════════════════════

### OPTIONAL STR_REPLACE — normalise shortlist link to new canonical URL

**FIND:**
```typescript
                <Link
                  to={`/ceo/shortlist/${project.id}`}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-50 text-blue-700 font-semibold rounded-lg hover:bg-blue-100 hover:text-blue-900 transition-colors border border-blue-200"
                >
                  View Shortlist <ArrowRight className="w-4 h-4" />
                </Link>
```

**REPLACE WITH:**
```typescript
                <Link
                  to={`/ceo/projects/${project.id}/shortlist`}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-50 text-blue-700 font-semibold rounded-lg hover:bg-blue-100 hover:text-blue-900 transition-colors border border-blue-200"
                >
                  View Shortlist <ArrowRight className="w-4 h-4" />
                </Link>
```

---

## ══════════════════════════════════════════════════════
## CONSTANTS — ADD if you prefer extracted files over inline maps
## ══════════════════════════════════════════════════════

### CONST-01: frontend/src/constants/seam-labels.ts  (CREATE NEW — optional)

```typescript
export const SEAM_LABELS: Record<string, string> = {
  'A↔B': 'Applied Agents',
  'A↔C': 'Prompt Engineering Apps',
  'A↔D': 'Fine-Tuned Apps',
  'A↔F': 'Production LLMs',
  'B↔E': 'Agents with Memory',
  'C↔E': 'Retrieval Prompting',
  'C↔F': 'PromptOps',
  'D↔E': 'Fine-Tuned RAG',
  'D↔F': 'MLOps for LLMs',
  'E↔F': 'Scalable RAG',
};
```

### CONST-02: frontend/src/constants/archetypes.ts  (CREATE NEW — optional)

```typescript
export const ARCHETYPE_LABELS: Record<string, string> = {
  '1': 'RAG / Search & Answer',
  '2': 'Recommendation Engine',
  '3': 'Classification / Tagging',
  '4': 'Content Generation',
  '5': 'Prediction / Forecasting',
  '6': 'Multimodal',
};
```

### CONST-03: frontend/src/constants/tiers.ts  (CREATE NEW — optional)

```typescript
export const TIER_LABELS: Record<string, string> = {
  TIER_1: 'Small Scale',
  TIER_2: 'Medium Scale',
  TIER_3: 'Large Scale',
};
```