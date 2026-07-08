# 01 — Nhân (Chí Nhân): CEO Milestones + Shared Hooks

> **Screens:** 4 | **Hooks:** 5 | **Refactor:** 1 | **Routes:** App.tsx
> **Source:** Live codebase E:\AITaskerVer3

---

## Your Files

| # | File | Type |
|---|------|------|
| 1 | `hooks/use-milestones.ts` | New Hook |
| 2 | `hooks/use-dod.ts` | New Hook |
| 3 | `hooks/use-submissions.ts` | New Hook |
| 4 | `hooks/use-criteria.ts` | New Hook |
| 5 | `hooks/use-engagements.ts` | Refactor |
| 6 | `features/ceo/milestones/CreateMilestone.tsx` | New Screen |
| 7 | `features/ceo/milestones/MilestoneList.tsx` | Rewrite Stub |
| 8 | `features/ceo/milestones/FundMilestone.tsx` | Rewrite Stub |
| 9 | `features/ceo/milestones/MilestoneDetail.tsx` | New Screen |
| 10 | `App.tsx` | Add Routes |

---

## 📋 Per-Screen Data Flow

### Screen 1: CreateMilestone.tsx

CEO creates a milestone with deliverable statement, payment amount, sign-off authority, and acceptance criteria.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape (snake_case) |
|------|:---:|:------:|----------|---------------------|-------------------|
| Submit | **FE→BE** | `POST` | `/milestones` | Create milestone | `{ engagement_id: string, milestone_number: number, deliverable_statement: string, sign_off_authority: 'TECH_TEAM'|'CEO'|'JOINT', payment_amount_vnd: number, criteria: [{ criterion_text: string, is_required: boolean }] }` |
| Response | **BE→FE** | `201` | — | Milestone created | `{ id: string, state: 'DEFINED', acceptanceCriteria: [{ id, criterion_text, is_required, verified_by_role, verified_at: null }], ... }` |
| Then | **FE** | — | — | Invalidate query + navigate | `queryClient.invalidateQueries(['engagements', engagementId])` → navigate to MilestoneList |

**Errors:**
| BE Code | Message | FE Action |
|:-------:|---------|-----------|
| 400 | "At least one acceptance criterion is required" | Toast error, highlight criteria section |
| 409 | "Milestone number X already exists for this engagement" | Toast error, auto-suggest next number |

---

### Screen 2: MilestoneList.tsx

Lists all milestones for an engagement. Milestones come from `GET /engagements/:id` response (included via Prisma `include: { milestones: true }`).

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Load | **FE→BE** | `GET` | `/engagements/:id` | Fetch engagement | — |
| Response | **BE→FE** | `200` | — | Engagement + milestones[] | `{ id, state, clientId, expertId, milestones: [{ id, milestone_number, deliverable_statement, payment_amount_vnd, state, sign_off_authority, va_number, funded_at }], capabilityBid: { id, state } }` |
| Render | **FE** | — | — | List with state badges + action buttons | See state→action table below |

**State → Action Mapping:**
| Milestone `state` | Button Label | Navigates To |
|:-------------------|:-------------|:-------------|
| `DEFINED` | "Fund Milestone" | FundMilestone |
| `AWAITING_PAYMENT` | "View Payment" | FundMilestone (polling) |
| `FUNDED` / `IN_PROGRESS` | "View Details" | MilestoneDetail |
| `SUBMITTED` | "Review" | MilestoneDetail |
| `IN_REVISION` | "Under Revision" | MilestoneDetail |
| `APPROVED` | "Approved ✓" | MilestoneDetail |
| `DISPUTED` | "View Dispute" | DisputeStatus |

---

### Screen 3: FundMilestone.tsx

CEO funds a milestone. Generates VietQR VA, displays QR + instructions, polls until SePay IPN confirms.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Fund | **FE→BE** | `PUT` | `/milestones/:id/fund` | Trigger VA generation | *(no body)* |
| Response | **BE→FE** | `200` | — | VA details | `{ va_number: "VA-123456", va_expires_at: "2026-07-08T12:00:00Z", state: 'AWAITING_PAYMENT' }` |
| Display | **FE** | — | — | Generate VietQR URL from va_number | `https://img.vietqr.io/image/mb-0394654576-print.png?accountName=AITASKER&amount={amount}&addInfo={va_number}` |
| Poll | **FE→BE** | `GET` | `/milestones/:id` | Poll every 5 seconds | — |
| Funded | **BE→FE** | `200` | — | State changed to FUNDED/IN_PROGRESS | `{ state: 'IN_PROGRESS', funded_at: "..." }` |
| Done | **FE** | — | — | Stop polling, show success, redirect | Invalidate `['wallet']` + `['engagements']` queries |

**VietQR Display (reuse existing VietQRPanel):**
- Bank: MB Bank (MBBank)
- Account: 0394654576
- Amount: from milestone `payment_amount_vnd`
- Reference: `va_number` from response
- Expires: 24 hours from `va_expires_at`

**Polling Stop Conditions:**
- `state === 'FUNDED'` or `state === 'IN_PROGRESS'` → success
- `va_expires_at` passed → show "VA expired, generate new" button
- 30 minutes elapsed → show timeout message

---

### Screen 4: MilestoneDetail.tsx

Full milestone view: deliverable, criteria list with verify/revision buttons, DOD status, submission info.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Load | **FE→BE** | `GET` | `/milestones/:id` | Fetch full milestone | — |
| Response | **BE→FE** | `200` | — | Milestone + criteria + DOD | `{ id, milestone_number, deliverable_statement, payment_amount_vnd, state, sign_off_authority, va_number, funded_at, submitted_at, approved_at, acceptanceCriteria: [{ id, criterion_text, is_required, verified_by_role, verified_at, revision_note }], dodItems: [{ id, item_description, is_required, status, completed_at, completion_note }] }` |
| Render | **FE** | — | — | Criteria list with verify/revision buttons | Show only criteria matching CEO role (`verified_by_role === 'CEO' || 'JOINT'`) |

**Sub-action: Verify Criterion**
| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Verify | **FE→BE** | `PUT` | `/criteria/:id/verify` | Sign off | `{ verification_comment?: string }` |
| Response | **BE→FE** | `200` | — | Verified | `{ success: true, message: "Criterion verified successfully." }` |
| Auto | **BE** | — | — | If ALL required criteria verified → milestone APPROVED + escrow released | `LedgerService.releaseMilestoneWithTx()` fires automatically |

**Sub-action: Request Revision**
| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Revise | **FE→BE** | `PUT` | `/criteria/:id/revision` | Request changes | `{ revision_note: string }` |
| Response | **BE→FE** | `200` | — | Milestone → IN_REVISION | `{ success: true }` — BE sets `milestone.state = 'IN_REVISION'` |
| Then | **FE** | — | — | Refetch milestone, show revision badge | Expert notified via socket: `milestone:updated` |

---

## 🔧 Hooks to Create

### use-milestones.ts

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

// GET /milestones/:id
export function useMilestone(id: string | undefined) {
  return useQuery({
    queryKey: ["milestones", id],
    queryFn: () => apiClient.get(`/milestones/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

// POST /milestones
export function useCreateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      engagement_id: string; milestone_number: number;
      deliverable_statement: string; sign_off_authority: string;
      payment_amount_vnd: number; criteria: { criterion_text: string; is_required: boolean }[];
    }) => apiClient.post("/milestones", body).then(r => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["engagements", vars.engagement_id] });
      qc.invalidateQueries({ queryKey: ["engagements"] });
    },
  });
}

// PUT /milestones/:id/fund
export function useFundMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.put(`/milestones/${id}/fund`).then(r => r.data),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["milestones", id] });
      qc.invalidateQueries({ queryKey: ["engagements"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}
```

### use-criteria.ts

```ts
// PUT /criteria/:id/verify
export function useVerifyCriterion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: { verification_comment?: string } }) =>
      apiClient.put(`/criteria/${id}/verify`, body || {}).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milestones"] });
      qc.invalidateQueries({ queryKey: ["engagements"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

// PUT /criteria/:id/revision
export function useRequestRevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, revision_note }: { id: string; revision_note: string }) =>
      apiClient.put(`/criteria/${id}/revision`, { revision_note }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones"] }),
  });
}
```

### use-dod.ts

```ts
// POST /milestones/:id/dod/items
export function useCreateDodItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ milestoneId, body }: {
      milestoneId: string;
      body: { item_description: string; is_required?: boolean; maps_to_criterion_id?: string }
    }) => apiClient.post(`/milestones/${milestoneId}/dod/items`, body).then(r => r.data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["milestones", vars.milestoneId] }),
  });
}

// PUT /milestones/:id/dod/:itemId
export function useUpdateDodItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ milestoneId, itemId, body }: {
      milestoneId: string; itemId: string;
      body: { status: 'PENDING'|'COMPLETED'|'NOT_APPLICABLE'; completion_note?: string; not_applicable_note?: string }
    }) => apiClient.put(`/milestones/${milestoneId}/dod/${itemId}`, body).then(r => r.data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["milestones", vars.milestoneId] }),
  });
}
```

### use-submissions.ts

```ts
// POST /milestones/:id/submit
export function useSubmitMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ milestoneId, body }: {
      milestoneId: string;
      body: { description: string; files_json?: { name: string; url: string }[] }
    }) => apiClient.post(`/milestones/${milestoneId}/submit`, body).then(r => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["milestones", vars.milestoneId] });
      qc.invalidateQueries({ queryKey: ["engagements"] });
    },
  });
}
```

---

## 🔀 Routes to Add (App.tsx)

```tsx
// Inside CEO routes (<Route element={<RoleRoute requiredSubtype="CEO" />}>)
<Route path="engagements/:engagementId/milestones" element={<MilestoneList />} />
<Route path="engagements/:engagementId/milestones/create" element={<CreateMilestone />} />
<Route path="engagements/:engagementId/milestones/:milestoneId" element={<MilestoneDetail />} />
<Route path="engagements/:engagementId/milestones/:milestoneId/fund" element={<FundMilestone />} />
```

---

## 🎨 UI Mockup: MilestoneList

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Project                                      │
│                                                         │
│  Milestones — [Project Name]                            │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Milestone 1  │  Build RAG Pipeline    │ DEFINED │   │
│  │  5,000,000 VND│  CEO sign-off         │ [Fund]  │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Milestone 2  │  Deploy & Monitor       │FUNDED  │   │
│  │  3,000,000 VND│  TECH_TEAM sign-off    │ [View]  │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Milestone 3  │  Final Delivery          │SUBMIT  │   │
│  │  2,000,000 VND│  JOINT sign-off          │[Review]│   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [+ Create New Milestone]                               │
└─────────────────────────────────────────────────────────┘
```

## 🎨 UI Mockup: FundMilestone

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Milestones                                   │
│                                                         │
│  Fund Milestone #1 — Build RAG Pipeline                 │
│  Amount: 5,000,000 VND                                  │
│                                                         │
│  ┌───────────────────┐                                  │
│  │                   │                                  │
│  │   [VietQR Image]  │                                  │
│  │                   │                                  │
│  └───────────────────┘                                  │
│                                                         │
│  Bank:     MB Bank (MBBank)         [📋 Copy]           │
│  Account:  0394654576               [📋 Copy]           │
│  Amount:   5,000,000 VND            [📋 Copy]           │
│  Ref:      VA-123456                [📋 Copy]           │
│  Expires:  July 8, 2026 12:00                            │
│                                                         │
│  ⏳ Waiting for payment... (spinner)                    │
│  ─────── After confirmed ───────                       │
│  ✅ Funded! Milestone is now IN_PROGRESS               │
│  [Back to Milestones]                                   │
└─────────────────────────────────────────────────────────┘
```

## 🎨 UI Mockup: MilestoneDetail

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Milestones                                   │
│                                                         │
│  Milestone #1 — Build RAG Pipeline       [IN_PROGRESS]  │
│  Amount: 5,000,000 VND | Sign-off: CEO                   │
│                                                         │
│  ── Acceptance Criteria ────────────────────────────    │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ✅ "API response time < 500ms"                 │   │
│  │    Verified: July 7, 2026 10:30 AM              │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ⏳ "Retrieval accuracy > 90%"                  │   │
│  │    [✓ Verify]  [↩ Request Revision]             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ── DoD Checklist ──────────────────────────────────   │
│  ✅ Unit tests passing      ✅ Integration tests       │
│  ⏳ Load test completed      ⬜ Documentation updated   │
│                                                         │
│  ── Submission ────────────────────────────────────    │
│  Submitted: July 7, 2026 2:00 PM                        │
│  Files: deliverable-v1.zip                               │
└─────────────────────────────────────────────────────────┘
```
