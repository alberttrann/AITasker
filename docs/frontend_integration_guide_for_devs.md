# AITasker — Frontend Integration Guide for Remaining Devs
## Trạng thái: Backend DONE. Frontend còn lại.

---

## READING THIS DOCUMENT

**Cột "BE Status":** ✅ = endpoint đã có sẵn và đã test. Không cần chạm backend.  
**Cột "FE Status":** ✅ = done | 🔧 = hook/type đã patch, component còn thiếu | ❌ = chưa có gì.  
**Mỗi section** liệt kê: endpoint cụ thể → request shape → response shape → component cần viết/sửa.

---

## PART 0 — WHAT BACKEND ALREADY DELIVERED (context for frontend devs)

Những gì backend vừa thêm mới — frontend cần wire vào:

| Patch | Endpoint | Ghi chú |
|---|---|---|
| BE-04/05 | `PATCH /elicitation/sessions/:id/draft` | Lưu draft Stage 1 không qua AI |
| BE-06/07 | `GET /matching/:projectId/shortlist?refresh=true` | Force re-score shortlist |
| BE-08/09 | `GET /projects?slim=true` | Trả về scalar fields only, no JSON blobs |
| BE-10/11 | `GET /portfolio-submissions` | List tất cả submissions của expert đang login |
| DB-CACHE | `project_shortlist_cache` table | Shortlist giờ persist qua deploy/restart |

Các endpoints còn lại (Elicitation, Projects, Matching, Expert Domains, Seam Claims) **đã tồn tại từ trước** — chưa được wire vào UI.

---

## PART 1 — TYPES & HOOKS ĐÃ ĐƯỢC PATCH (Frontend dev chỉ cần import)

### 1.1 `frontend/src/types/api.types.ts`

Đã được patch (FE-C-01). Thêm vào:

```typescript
// Trong ElicitationSessionDto — field mới:
symptom_text_draft: string | null;   // server-side draft cho Stage 1

// Types mới ở cuối file:
export interface PortfolioSubmissionDetailDto { ... }
export interface PortfolioListItemDto { ... }
```

### 1.2 `frontend/src/hooks/use-matching.ts` — FULL REPLACEMENT

Export mới:
- `getShortlist(projectId)` — async fetcher (backward compat)
- `useShortlist(projectId)` — **hook chính để dùng trong component**

```typescript
import { useShortlist } from '@/hooks/use-matching';

const { experts, isLoading, isRefreshing, refresh, lastUpdatedAt } = useShortlist(projectId);
// experts: MatchResult[] sorted STRONG → WEAK
// refresh(): gọi ?refresh=true → backend re-score → update cache
```

### 1.3 `frontend/src/hooks/use-portfolio.ts` — additions

```typescript
import { usePortfolioSubmission, useMyPortfolioSubmissions } from '@/hooks/use-portfolio';

// Fetch single submission by ID
const { data } = usePortfolioSubmission(submissionId);

// List tất cả submissions của expert đang login
const { data: submissions } = useMyPortfolioSubmissions();
```

### 1.4 `frontend/src/hooks/use-projects.ts` — additions

```typescript
import {
  useSlimProjects,    // GET /projects?slim=true
  useProject,         // GET /projects/:id (full)
  useArtifactA,       // GET /projects/:id/artifact-a
  useArtifactB,       // GET /projects/:id/artifact-b
  useSessionHistory,  // GET /elicitation/sessions/history
} from '@/hooks/use-projects';
```

### 1.5 `frontend/src/hooks/use-expert-profile-extras.ts` — NEW FILE

```typescript
import { useUpdateDomainDepth } from '@/hooks/use-expert-profile-extras';
// PUT /expert-profile/domains/:id
```

### 1.6 `frontend/src/hooks/use-elicitation-extras.ts` — NEW FILE

```typescript
import { saveDraft, retrySynthesis, setSelfTechnical } from '@/hooks/use-elicitation-extras';
// PATCH /elicitation/sessions/:id/draft
// POST  /elicitation/sessions/:id/retry-synthesis
// PUT   /elicitation/sessions/:id/self-technical
```

---

## PART 2 — ELICITATION GROUP

---

### 2.1 Stage 1 — Server-side draft save

**File:** `frontend/src/features/ceo/elicitation/Stage1Symptoms.tsx`  
**BE Status:** ✅ `PATCH /elicitation/sessions/:id/draft`  
**FE Status:** 🔧 Hook ready. Component chưa implement.

**Request:**
```
PATCH /elicitation/sessions/:id/draft
Authorization: Bearer <token>
Content-Type: application/json

{ "symptomTextDraft": "We are an e-commerce platform struggling with..." }
```

**Response:**
```json
{ "saved": true }
// hoặc nếu stage đã vượt qua:
{ "saved": false, "reason": "stage_already_submitted" }
```

**Việc cần làm trong component:**

```typescript
// 1. Import
import { useRef, useState, useEffect } from "react";
import { saveDraft } from "@/hooks/use-elicitation-extras";

// 2. Thêm props
interface Stage1Props {
  sessionId: string;
  symptomTextDraft?: string | null;  // ← THÊM: từ wizard truyền xuống
  onComplete: (...) => void;
  onError: (msg: string) => void;
}

// 3. Thêm state vào component body
const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// 4. Sửa useEffect để restore từ server draft nếu localStorage trống
useEffect(() => {
  const local = localStorage.getItem(`stage1_${sessionId}`);
  if (local) {
    setSymptomText(local);
  } else if (symptomTextDraft) {
    setSymptomText(symptomTextDraft);  // cross-device restore
  }
}, [sessionId, symptomTextDraft]);

// 5. Sửa handleChange để debounce server save
const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  const value = e.target.value;
  setSymptomText(value);
  localStorage.setItem(`stage1_${sessionId}`, value);

  if (debounceRef.current) clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(async () => {
    try {
      const result = await saveDraft(sessionId, value);
      if (result.saved) setLastSavedAt(new Date());
    } catch { /* silent — localStorage backup đủ */ }
  }, 2000);
};

// 6. Clear draft khi submit thành công (trong handleSubmit, sau submitStage1)
localStorage.removeItem(`stage1_${sessionId}`);
if (debounceRef.current) clearTimeout(debounceRef.current);

// 7. Thêm indicator vào JSX (cạnh character count)
{lastSavedAt && (
  <span className="text-caption text-success">· ✓ Draft saved</span>
)}
```

---

### 2.2 ElicitationWizard — truyền symptomTextDraft xuống Stage 1

**File:** `frontend/src/features/ceo/elicitation/ElicitationWizard.tsx`  
**BE Status:** ✅  
**FE Status:** ❌ Cần sửa

Wizard đã có đầy đủ logic. Chỉ cần 3 bước:

**Bước 1 — Thêm field vào `WizardState`:**
```typescript
type WizardState = {
  // ... fields hiện tại ...
  symptomTextDraft: string | null;  // ← THÊM
};

// Khởi tạo:
const [state, dispatch] = useReducer(wizardReducer, {
  // ... giá trị hiện tại ...
  symptomTextDraft: null,  // ← THÊM
});
```

**Bước 2 — Sửa `wizardReducer` case `INIT_SUCCESS`:**
```typescript
case "INIT_SUCCESS":
  return { ...state, ...action.payload, isLoading: false };
// Không cần thay đổi — action.payload spread tự động include symptomTextDraft
// nếu dispatch truyền vào đúng.
```

**Bước 3 — Sửa `dispatch` trong `init()` effect:**

Tìm đoạn này trong `useEffect` init:
```typescript
dispatch({
  type: "INIT_SUCCESS",
  payload: {
    sessionId: data.id,
    currentStage: data.currentStage ?? 1,
    sessionState: finalSessionState,
    gateResult: initGateResult as GateResult | null,
    archetype: data.archetype || null,
  }
});
```

Sửa thành:
```typescript
dispatch({
  type: "INIT_SUCCESS",
  payload: {
    sessionId: data.id,
    currentStage: data.currentStage ?? 1,
    sessionState: finalSessionState,
    gateResult: initGateResult as GateResult | null,
    archetype: data.archetype || null,
    symptomTextDraft: data.symptom_text_draft ?? null,  // ← THÊM
  }
});
```

**Bước 4 — Pass prop xuống Stage1Symptoms trong JSX:**
```typescript
// Tìm:
<Stage1Symptoms
  sessionId={state.sessionId}
  onComplete={handleStageComplete}
  onError={(msg) => dispatch({ type: "SET_ERROR", payload: msg })}
/>

// Sửa thành:
<Stage1Symptoms
  sessionId={state.sessionId}
  symptomTextDraft={state.symptomTextDraft}  // ← THÊM
  onComplete={handleStageComplete}
  onError={(msg) => dispatch({ type: "SET_ERROR", payload: msg })}
/>
```

---

### 2.3 Stage 5 — Retry synthesis sau AI timeout

**File:** `frontend/src/features/ceo/elicitation/Stage5Loading.tsx`  
**BE Status:** ✅ `POST /elicitation/sessions/:id/retry-synthesis`  
**FE Status:** ❌ Endpoint tồn tại nhưng không có UI trigger

**Request:**
```
POST /elicitation/sessions/:id/retry-synthesis
Authorization: Bearer <token>
Body: (empty)
```

**Response:** Cùng shape với Stage 4 PUT:
```json
// Gate passed:
{
  "gate_passed": true,
  "completeness_score": 0.82,
  "project_id": "uuid"
}

// Gate failed:
{
  "gate_passed": false,
  "completeness_score": 0.54,
  "flagged_void": "UNCLEAR_SUCCESS_METRIC",
  "return_to_stage": 3,
  "advisory_note": "Cần làm rõ success metric..."
}
```

**Khi nào show retry button:** Khi Stage5Loading nhận lỗi 500/503/timeout từ AI service. Session vẫn ở `currentStage: 5`, `state: IN_PROGRESS`.  
**Khi nào KHÔNG show:** `state === 'RETURNED'` (gate đã evaluate rồi fail — không phải timeout).

```typescript
import { retrySynthesis } from "@/hooks/use-elicitation-extras";

// Trong Stage5Loading.tsx, thêm error state và retry handler:
const [synthError, setSynthError] = useState<string | null>(null);
const [isRetrying, setIsRetrying] = useState(false);

const handleRetry = async () => {
  setIsRetrying(true);
  setSynthError(null);
  try {
    const result = await retrySynthesis(sessionId);
    onComplete(result);  // prop hiện tại của Stage5Loading
  } catch (err: any) {
    setSynthError(
      err?.response?.data?.message ?? "AI service unavailable. Try again in a moment."
    );
  } finally {
    setIsRetrying(false);
  }
};

// JSX — show khi có synthError:
{synthError && (
  <div className="text-center space-y-4">
    <p className="text-body-sm text-error">{synthError}</p>
    <Button onClick={handleRetry} disabled={isRetrying}>
      {isRetrying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
      Try Again
    </Button>
  </div>
)}
```

---

### 2.4 Self-technical toggle trong wizard

**File:** `frontend/src/features/ceo/elicitation/ElicitationWizard.tsx`  
**BE Status:** ✅ `PUT /elicitation/sessions/:id/self-technical`  
**FE Status:** ❌ Endpoint không có UI trigger

**Request:**
```
PUT /elicitation/sessions/:id/self-technical
Authorization: Bearer <token>
{ "selfTechnical": true }
```

**Response:**
```json
{ "access_token": "new-jwt..." }
// Backend re-issue token với selfTechnical claim updated
// PHẢI swap token ngay sau khi nhận
```

Trong wizard, `Stage 4` đang check `user?.selfTechnical || state.forceScenarioA` để quyết định render ScenarioA hay ScenarioB. Endpoint này cho phép CEO override per-session thay vì chỉ từ account setting.

```typescript
import { setSelfTechnical } from "@/hooks/use-elicitation-extras";

// Thêm button vào UI transition Stage 3 → Stage 4
// (trong card footer của Stage3Probes, hoặc đầu Stage4ScenarioB):
const handleSetSelfTechnical = async (value: boolean) => {
  if (!state.sessionId) return;
  try {
    await setSelfTechnical(state.sessionId, value);
    // Token đã được swap bên trong setSelfTechnical()
    // Nếu value=true → ScenarioA sẽ render tự động vì user.selfTechnical reload
    // Hoặc dispatch SET_FORCE_SCENARIO_A nếu muốn immediate:
    if (value) dispatch({ type: "SET_FORCE_SCENARIO_A", payload: true });
  } catch (err: any) {
    dispatch({ type: "SET_ERROR", payload: "Failed to update technical preference." });
  }
};
```

---

### 2.5 SessionsListPage — hiện RETURNED sessions

**File:** `frontend/src/features/ceo/pages/SessionsListPage.tsx`  
**BE Status:** ✅ `GET /elicitation/sessions/history` (trả cả ABANDONED lẫn RETURNED)  
**FE Status:** 🔧 Hook `useSessionHistory()` đã có. Component chưa dùng.

**Response shape của `/elicitation/sessions/history`:**
```typescript
ElicitationSessionDto[]  // mảng các session có state = 'ABANDONED' | 'RETURNED'
// Mỗi item:
{
  id: string,
  current_stage: number,
  state: 'ABANDONED' | 'RETURNED',
  archetype: string | null,
  symptom_text_draft: string | null,
  created_at: string,
  updated_at: string
}
```

**Thay đổi cần làm:**

```typescript
// 1. Thay import
// XÓA: import { useElicitationSessions, ... }
// THÊM: import { useSessionHistory, ... }
import {
  useSessionHistory,           // ← THÊM
  useRestoreElicitationSession,
  useHardDeleteElicitationSession,
  useActiveElicitationSession,
  useDeleteElicitationSession
} from "@/hooks/use-projects";

// 2. Thay hook call
// XÓA: const { sessions, isLoadingSessions } = useElicitationSessions();
const { data: sessions = [], isLoading: isLoadingSessions } = useSessionHistory();

// 3. Thêm filter RETURNED
const returnedSessions = sessions
  .filter((s: any) => s.state === 'RETURNED')
  .sort((a: any, b: any) => getSafeDate(b, 'updatedAt') - getSafeDate(a, 'updatedAt'));
```

**JSX để thêm — section RETURNED bên trên ABANDONED:**
```tsx
{returnedSessions.length > 0 && (
  <section className="space-y-4">
    <h3 className="text-base font-bold text-amber-800 flex items-center gap-2">
      ⚠ Cần chỉnh sửa — Quality Gate Failed
    </h3>
    {returnedSessions.map((session: any) => {
      const safeCreated = session.createdAt || session.created_at;
      const safeUpdated = session.updatedAt || session.updated_at;
      const safeStage   = session.currentStage || session.current_stage || 1;
      return (
        <div key={session.id}
          className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex-1">
            <h4 className="text-base font-bold text-slate-900">{formatDraftName(safeCreated || safeUpdated)}</h4>
            <div className="flex gap-3 text-sm text-slate-500 mt-1">
              <span className="text-amber-700 font-medium">Quality Gate Failed</span>
              <span>·</span>
              <span>Returned at Stage {safeStage}</span>
              <span>·</span>
              <span>Updated: {new Date(safeUpdated).toLocaleDateString()}</span>
            </div>
          </div>
          <button
            onClick={() => handleContinueSession(session.id)}
            disabled={restoringId === session.id}
            className="px-6 py-2.5 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-70"
          >
            {restoringId === session.id ? 'Restoring...' : 'Revise & Resubmit'}
          </button>
        </div>
      );
    })}
  </section>
)}
```

`handleContinueSession` đã implement sẵn (`PUT /continue` rồi navigate) — dùng lại không cần sửa.

---

## PART 3 — PROJECTS GROUP

---

### 3.1 ProjectDetailPage — trang mới

**File:** `frontend/src/features/ceo/pages/ProjectDetailPage.tsx` (CREATE NEW)  
**Route:** `/ceo/projects/:projectId`  
**BE Status:** ✅ `GET /projects/:id`  
**FE Status:** ✅ DONE

**Response của `GET /projects/:id`:**
```typescript
{
  id: string,
  state: 'PUBLISHED' | 'DRAFT',
  archetype: '1'|'2'|'3'|'4'|'5'|'6' | null,
  tier: 'TIER_1'|'TIER_2'|'TIER_3' | null,
  selfTechnical: boolean,
  artifact_a_json: {
    project_name: string,
    business_intent: string,
    archetype: string,
    stack_tags: string[],
    volume_tier: string,
    sdlc_notices: string[]
  } | null,
  projectName: string | null,
  // + required_seams_json, required_domains_json, milestone_framework_json
}
```

Hook để dùng: `useProject(projectId)` đã có trong `use-projects.ts`.

**Layout gợi ý:**
```
[← Back to Projects]

[Archetype Badge] [Tier Badge] [State Badge]
# Project Name
Business intent paragraph

Stack tags (pills)
SDLC notices (amber warning banners)

[View Matched Experts →]   [View Full Spec →]
```

**Button "View Matched Experts"** navigate đến `/ceo/projects/:projectId/shortlist`.  
**Button "View Full Spec"** navigate đến `/ceo/projects/:projectId/spec` hoặc mở modal `ArtifactA`.

---

### 3.2 ArtifactA Spec Modal/Page

**File:** `frontend/src/features/ceo/projects/ProjectSpecModal.tsx` (CREATE NEW)  
**BE Status:** ✅ `GET /projects/:id/artifact-a`  
**FE Status:** ❌

**Request:**
```
GET /projects/:id/artifact-a
Authorization: Bearer <token>
```

**Response:**
```json
{
  "artifact_a_json": {
    "project_name": "AI Customer Support System",
    "business_intent": "Reduce support ticket volume by 40%...",
    "archetype": "1",
    "stack_tags": ["Python", "FastAPI", "pgvector"],
    "volume_tier": "TIER_2",
    "sdlc_notices": ["Requires GDPR compliance review", "Estimated 4-month timeline"]
  }
}
```

Hook: `useArtifactA(projectId)` từ `use-projects.ts` — trả về `data?.artifact_a_json ?? data`.

```typescript
const { data: artifactA, isLoading } = useArtifactA(projectId);
// artifactA: ArtifactA | null
// ArtifactA.project_name, .business_intent, .stack_tags, .sdlc_notices, .archetype, .volume_tier
```

---

### 3.3 ArtifactB — Expert view sau NDA

**File:** `frontend/src/features/expert/connection/ArtifactBView.tsx`  
**BE Status:** ✅ `GET /projects/:id/artifact-b` (403 nếu CEO gọi)  
**FE Status:** ❌ File tồn tại nhưng empty

**Chỉ enable khi cả 2 NDA đã accept:**
```typescript
const { data: engagement } = useEngagement(engagementId);
const ndaAccepted = !!(engagement?.client_nda_accepted_at && engagement?.expert_nda_accepted_at);

const { data: artifactB } = useArtifactB(projectId, ndaAccepted);
// Nếu ndaAccepted = false → query disabled, không gọi API
```

**Response:**
```json
{
  "artifact_b_json": {
    "stack_tags": ["PostgreSQL 15", "Redis", "Kafka"],
    "integration_method": "REST API với existing CRM",
    "legacy_volume": "2.3M records in MySQL",
    "schemas": ["https://..."],
    "contracts": ["https://..."]
  }
}
```

---

### 3.4 ProjectsPage — project cards đã có "View Details" link

**File:** `frontend/src/features/ceo/pages/ProjectsPage.tsx`  
**FE Status:** ✅ Link đã có sẵn: `<Link to={/ceo/projects/${project.id}}>View Details</Link>`

Không cần sửa. Chỉ cần route `/ceo/projects/:projectId` được register (xem Part 7).

---

## PART 4 — MATCHING GROUP

---

### 4.1 ShortlistView — upgrade từ bare useQuery lên useShortlist

**File:** `frontend/src/features/ceo/shortlist/ShortlistView.tsx`  
**BE Status:** ✅ `GET /matching/:projectId/shortlist?refresh=true`  
**FE Status:** ✅ DONE

**Những field có trong mỗi `MatchResult` (sau khi qua `mapShortlistForFrontend`):**
```typescript
{
  expert_id: string,
  strength_label: 'STRONG_MATCH' | 'GOOD_MATCH' | 'POSSIBLE_MATCH' | 'WEAK_MATCH',
  gap_map: Array<{ seam_code: string, color: 'green' | 'amber' | 'red' }>,
  contact_info: {
    id: string,
    fullName: string,
    email: string,
    phone: string | null
  } | null
  // composite_score bị strip ở backend — KHÔNG có trong response
}
```

> ⚠️ **Lưu ý:** `composite_score` bị xóa trước khi gửi về FE. Không sort theo score. Sort theo `strength_label` đã được làm trong `useShortlist()` rồi.

**Thay đổi cần làm trong `ShortlistView.tsx`:**

```typescript
// 1. Xóa import cũ:
// import { getShortlist } from '@/hooks/use-matching';
// import { useQuery } from '@tanstack/react-query';  // (nếu không dùng ở chỗ khác)

// 2. Import mới:
import { useShortlist } from '@/hooks/use-matching';

// 3. Thay useQuery block:
// XÓA cả block useQuery + experts + formattedDate cũ
// THÊM:
const {
  experts,
  isLoading,
  isRefreshing,
  refresh,
  lastUpdatedAt,
} = useShortlist(projectId);
const formattedDate = lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : null;

// 4. Thay Refresh button:
// XÓA: onClick={() => refetch()} disabled={isFetching}
// THÊM:
<Button variant="outline" onClick={() => refresh()} disabled={isRefreshing} className="flex items-center gap-2">
  <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
  {isRefreshing ? "Re-scoring…" : "Refresh Matches"}
</Button>
```

**`MatchCard` hiện tại đã dùng `getPublicProfile(expert.expert_id)` để fetch tên/stack** — cách này đúng vì `contact_info` từ backend chỉ có `fullName/email/phone`, không có `domainDepths/seamClaims`. Không cần thay đổi `MatchCard`.

---

## PART 5 — EXPERT DOMAINS GROUP

---

### 5.1 DomainDepthGrid — phân biệt create vs update

**File:** `frontend/src/features/expert/profile/DomainDepthGrid.tsx`  
**BE Status:** ✅ `PUT /expert-profile/domains/:id`  
**FE Status:** ❌ Endpoint unused — `POST` đang được dùng cho cả create lẫn update

**Logic cần thêm:**

```typescript
import { useUpdateDomainDepth } from '@/hooks/use-expert-profile-extras';
import { useExpertProfile } from '@/hooks/use-expert-profile';

const { profile } = useExpertProfile();
const updateDomainDepth = useUpdateDomainDepth();
const { saveDomains } = useExpertProfile(); // existing POST hook

const handleDomainDepthChange = async (domainCode: string, depthLevel: string) => {
  // Tìm xem domain này đã có ID chưa (đã được claim trước)
  const existing = profile?.domainDepths?.find(
    (d: any) => (d.domainCode || d.domain_code) === domainCode
  );

  if (existing?.id) {
    // Đã tồn tại → dùng PUT (semantic update)
    await updateDomainDepth.mutateAsync({ id: existing.id, depthLevel });
  } else {
    // Chưa có → dùng POST (create)
    await saveDomains.mutateAsync([{ domainCode, depthLevel }]);
  }
};
```

**Request PUT `/expert-profile/domains/:id`:**
```
PUT /expert-profile/domains/:id
Authorization: Bearer <token>
{ "depthLevel": "DEEP" }
```

**Response:**
```json
{ "id": "uuid", "domainCode": "A", "depthLevel": "DEEP", "verificationTier": "CLAIMED" }
```

---

### 5.2 Verification tier display

Tất cả domains hiện tại đều có tier `CLAIMED`. Hiển thị label này để user biết:

```tsx
// Trong domain card:
<span className="text-xs text-slate-400">Self-declared</span>
// Nếu sau này có tier cao hơn thì update label tương ứng
```

---

## PART 6 — SEAM CLAIMS GROUP

---

### 6.1 SeamStatusBadge — hiển thị đầy đủ trạng thái

**File:** `frontend/src/features/expert/profile/ExpertProfilePage.tsx` hoặc `SeamClaimsGrid.tsx`  
**BE Status:** ✅ Data đã có trong `GET /expert-profile/me`  
**FE Status:** ❌ Chưa có component hiển thị `submission_count`, `locked_until`

**Shape của mỗi seam claim từ `/expert-profile/me`:**
```typescript
{
  id: string,
  seam_code: string,              // e.g. 'A↔B'
  verification_tier: 'CLAIMED' | 'EVIDENCE_BACKED',
  submission_count: number,       // 0..5
  locked_until: string | null     // ISO date string
}
```

```tsx
function SeamStatusBadge({ seam }: { seam: any }) {
  const isLocked = seam.locked_until && new Date(seam.locked_until) > new Date();
  const attemptsLeft = 5 - (seam.submission_count ?? 0);

  if (isLocked) {
    const unlockDate = new Date(seam.locked_until).toLocaleDateString('vi-VN');
    return (
      <span className="text-xs text-red-600 font-medium">
        🔒 Locked until {unlockDate}
      </span>
    );
  }
  if (seam.verification_tier === 'EVIDENCE_BACKED') {
    return <span className="text-xs text-green-700 font-semibold">✓ AI Verified</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400">Self-declared</span>
      {seam.submission_count > 0 && (
        <span className="text-xs text-amber-600">{attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} left</span>
      )}
    </div>
  );
}
```

---

### 6.2 POST /expert-profile/seams — khi nào dùng

`POST /expert-profile/seams` (add single) vs `PUT /expert-profile/seams/sync` (replace all):

| Action | Endpoint |
|---|---|
| ProfileBuilder save tất cả seams | `PUT .../sync` — **đang dùng đúng rồi** |
| Add seam trực tiếp từ Portfolio form (nếu chưa claim) | `POST .../seams` → dùng returned `id` để submit portfolio |
| Quick-add seam từ shortlist view | `POST .../seams` |

Hiện tại `PortfolioSubmitForm` đọc seam claim IDs từ `GET /expert-profile/me` sau khi sync — đúng. Không cần thay đổi.

---

## PART 7 — PORTFOLIO SUBMISSIONS GROUP

---

### 7.1 VerificationHistoryPage — trang mới

**File:** `frontend/src/features/expert/verification/VerificationHistoryPage.tsx` (CREATE NEW)  
**Route:** `/expert/verification-history`  
**BE Status:** ✅ `GET /portfolio-submissions` (endpoint mới — BE-10)  
**FE Status:** ❌

**Response của `GET /portfolio-submissions`:**
```typescript
Array<{
  id: string,
  status: 'PENDING' | 'APPROVED' | 'REJECTED',
  llmConfidence: number | null,   // 0.0 – 1.0
  evaluatedAt: string | null,     // ISO date
  advisoryNote: string | null,    // AI feedback text
  submittedAt: string,            // ← tên thực trong DB (mapped thành createdAt trong DTO)
  seamClaim: {
    id: string,
    seamCode: string,             // 'A↔B', 'C↔E', etc.
    verificationTier: string,
    submissionCount: number
  }
}>
```

Hook: `useMyPortfolioSubmissions()` từ `use-portfolio.ts`.

**File đã được chuẩn bị đầy đủ trong `patches_frontend_components_FIXED.md` — PATCH FE-C-07. Copy-paste trực tiếp.**

---

### 7.2 ExpertProfilePage — thêm "View History" button

**File:** `frontend/src/features/expert/profile/ExpertProfilePage.tsx`  
**FE Status:** 🔧 Cần thêm 1 button + useNavigate

Chi tiết trong `patches_frontend_components_FIXED.md` — PATCH FE-C-09. Tóm tắt:

```typescript
// Thêm import:
import { useNavigate } from 'react-router-dom';

// Thêm hook:
const navigate = useNavigate();

// Thêm button cạnh "Verify a Seam":
<Button variant="outline" size="sm" onClick={() => navigate('/expert/verification-history')}>
  View History
</Button>
```

---

### 7.3 PortfolioSubmitForm — error states đầy đủ

**File:** `frontend/src/features/expert/verification/PortfolioSubmitForm.tsx`  
**BE Status:** ✅  
**FE Status:** ❌ Thiếu handling 403 và 429

```typescript
} catch (err: any) {
  const status = err?.response?.status;
  const message = err?.response?.data?.message;

  if (status === 403) {
    // Expert không có Pro subscription
    setError("Expert Pro subscription required to submit portfolio evidence.");
    // Optionally navigate: navigate('/expert/subscription');
    return;
  }
  if (status === 429) {
    // Locked out (5 lần fail)
    const lockedUntil = err?.response?.data?.lockedUntil;
    setError(`Too many attempts. Try again after ${lockedUntil ? new Date(lockedUntil).toLocaleDateString() : '30 days'}.`);
    return;
  }
  if (status === 422) {
    // Seam đã ở EVIDENCE_BACKED rồi
    setError("This seam is already verified at the highest tier.");
    return;
  }
  setError(message ?? "Submission failed. Please try again.");
}
```

---

## PART 8 — ROUTING (App.tsx)

**File:** `frontend/src/App.tsx`  
**FE Status:** 🔧 Cần thêm routes — patch đã viết sẵn trong `patches_frontend_components_FIXED.md` PATCH FE-C-06

**Imports cần thêm:**
```typescript
import ProjectDetailPage from "@features/ceo/pages/ProjectDetailPage";
import VerificationHistoryPage from "@features/expert/verification/VerificationHistoryPage";
```

**Routes cần thêm vào CEO block:**
```tsx
<Route path="projects/:projectId" element={<ProjectDetailPage />} />
<Route path="projects/:projectId/shortlist" element={<ShortlistView />} />
```
> Route `shortlist/:projectId` đang có sẵn — giữ nguyên cho backward compat. Thêm route mới song song.

**Route cần thêm vào Expert block:**
```tsx
<Route path="verification-history" element={<VerificationHistoryPage />} />
```

---

## PART 9 — CHECKLIST ĐẦY ĐỦ

### Backend (✅ DONE — không cần chạm)

- [x] `PATCH /elicitation/sessions/:id/draft` — BE-04/05
- [x] `GET /matching/:projectId/shortlist?refresh=true` — BE-06/07
- [x] `GET /projects?slim=true` — BE-08/09
- [x] `GET /portfolio-submissions` (list) — BE-10/11
- [x] DB-backed shortlist cache (`project_shortlist_cache` table)
- [x] `symptomTextDraft` column on `elicitation_sessions`
- [x] `getMySubmissions()` in PortfolioService (query by `expertId` direct, order by `submittedAt`)

### Types (✅ DONE — `api.types.ts` đã patch)

- [x] `ElicitationSessionDto.symptom_text_draft`
- [x] `PortfolioSubmissionDetailDto`
- [x] `PortfolioListItemDto`

### Hooks (✅ DONE — chỉ cần import)

- [x] `useShortlist()` + `getShortlist()` — `use-matching.ts`
- [x] `usePortfolioSubmission()` — `use-portfolio.ts`
- [x] `useMyPortfolioSubmissions()` — `use-portfolio.ts`
- [x] `useSlimProjects()` — `use-projects.ts`
- [x] `useProject()` — `use-projects.ts`
- [x] `useArtifactA()` — `use-projects.ts`
- [x] `useArtifactB()` — `use-projects.ts`
- [x] `useSessionHistory()` — `use-projects.ts`
- [x] `useUpdateDomainDepth()` — `use-expert-profile-extras.ts` (NEW FILE)
- [x] `saveDraft()` — `use-elicitation-extras.ts` (NEW FILE)
- [x] `retrySynthesis()` — `use-elicitation-extras.ts`
- [x] `setSelfTechnical()` — `use-elicitation-extras.ts`

### Frontend còn lại (❌ TODO)

**Priority CAO:**
- [x] `Stage1Symptoms.tsx` — thêm debounced `saveDraft()` + `symptomTextDraft` prop + draft indicator
- [x] `ElicitationWizard.tsx` — thêm `symptomTextDraft` vào state + pass xuống Stage1
- [x] `SessionsListPage.tsx` — dùng `useSessionHistory()` + hiện RETURNED sessions
- [x] `ShortlistView.tsx` — dùng `useShortlist()` hook thay bare `useQuery`
- [x] `App.tsx` — thêm routes mới

**Priority TRUNG:**
- [x] `ProjectDetailPage.tsx` — CREATE NEW (`/ceo/projects/:projectId`)
- [x] `VerificationHistoryPage.tsx` — CREATE NEW (`/expert/verification-history`)
- [ ] `ExpertProfilePage.tsx` — thêm "View History" button + `useNavigate`
- [ ] `Stage5Loading.tsx` — thêm retry button khi AI timeout
- [ ] `DomainDepthGrid.tsx` — phân biệt create vs update domain depth

**Priority THẤP:**
- [ ] `ArtifactBView.tsx` — implement ArtifactB display (expert post-NDA)
- [ ] `PortfolioSubmitForm.tsx` — thêm handling 403/429/422 error states
- [ ] `SeamStatusBadge` — component mới hiện `submission_count` + `locked_until`
- [ ] `DomainDepthGrid.tsx` — hiện `CLAIMED` label (verification tier)
- [ ] Self-technical toggle trong wizard Stage 3→4 transition

---

## PART 10 — CONSTANTS (tạo nếu muốn tái sử dụng)

Hiện tại các file mới (VerificationHistoryPage, ProjectDetailPage) đều inline các maps này. Nếu muốn extract ra:

**`frontend/src/constants/seam-labels.ts`:**
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

**`frontend/src/constants/archetypes.ts`:**
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

**`frontend/src/constants/tiers.ts`:**
```typescript
export const TIER_LABELS: Record<string, string> = {
  TIER_1: 'Small Scale',
  TIER_2: 'Medium Scale',
  TIER_3: 'Large Scale',
};
```
