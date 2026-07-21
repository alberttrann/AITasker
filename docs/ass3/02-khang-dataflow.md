# 02 — Khang (Tuấn Khang): Expert Dashboard Execution Screens

> **Screens:** 6 | **Existing Hooks to Use:** use-bids.ts (exists)
> **Blocked By:** Nhân's use-milestones.ts, use-dod.ts, use-submissions.ts
> **Source:** Live codebase E:\AITaskerVer3

---

## Your Files

| # | File | Type | Blocks? |
|---|------|------|:---:|
| 1 | `features/expert/milestones/DodChecklist.tsx` | Rewrite Stub (0B) | Needs use-dod.ts |
| 2 | `features/expert/milestones/DodItemRow.tsx` | Rewrite Stub (0B) | Pure UI (no hooks) |
| 3 | `features/expert/milestones/DeliverableSubmit.tsx` | Rewrite Stub (0B) | Needs use-submissions.ts |
| 4 | `features/expert/milestones/SubmissionStatus.tsx` | New | Needs use-milestones.ts |
| 5 | `features/expert/milestones/ExpertMilestoneDetail.tsx` | New | Needs use-milestones.ts |
| 6 | `features/expert/bidding/BidRevision.tsx` | Rewrite Stub (0B) | **CAN START NOW** (use-bids.ts exists) |
| 7 | `features/expert/bidding/CounterOfferReceived.tsx` | Rewrite Stub (0B) | **CAN START NOW** (use-bids.ts exists) |
| 8 | `App.tsx` | Add Routes | After screens done |

**What you can build immediately (no blockers):**
- `DodItemRow.tsx` — pure presentational component, no API calls
- `BidRevision.tsx` — reuses `use-bids.ts` hooks (already built)
- `CounterOfferReceived.tsx` — simple display, reads from existing bid data

---

## 📋 Per-Screen Data Flow

### Screen 1: DodChecklist.tsx

Expert manages the Definition of Done checklist for a milestone.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Load | **FE→BE** | `GET` | `/milestones/:id` | Fetch milestone with dodItems[] | — |
| Data | **BE→FE** | `200` | — | Milestone + DOD items | `{ dodItems: [{ id, item_description, is_required, status: 'PENDING'|'COMPLETED'|'NOT_APPLICABLE', completed_at, completion_note, not_applicable_note, maps_to_criterion_id }], state, ... }` |

**Sub-action: Add DOD Item**
| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Add | **FE→BE** | `POST` | `/milestones/:id/dod/items` | Create item | `{ item_description: string, is_required?: boolean, maps_to_criterion_id?: string }` |
| Response | **BE→FE** | `201` | — | Item created | `{ id, item_description, is_required, status: 'PENDING' }` |
| Then | **FE** | — | — | Refetch milestone | `queryClient.invalidateQueries(['milestones', milestoneId])` |

**Sub-action: Update DOD Status**
| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Update | **FE→BE** | `PUT` | `/milestones/:id/dod/:itemId` | Change status | `{ status: 'COMPLETED'|'NOT_APPLICABLE', completion_note?: string, not_applicable_note?: string }` |
| Response | **BE→FE** | `200` | — | Updated | `{ id, status, completed_at, completion_note }` |

**Important DOD Rules:**
- Required items CANNOT be set to NOT_APPLICABLE (DB CHECK constraint + FE guard)
- Required items must have `completion_note` when set to COMPLETED
- NOT_APPLICABLE items must have `not_applicable_note`

**Errors:**
| BE Code | Message | FE Action |
|:-------:|---------|-----------|
| 400 | "Cannot mark a required DoD item as NOT_APPLICABLE" | Disable NA option for required items |
| 400 | "Completion note is required for required DoD items" | Show note textarea |

---

### Screen 2: DeliverableSubmit.tsx

Expert submits deliverable for a milestone. DoD gate enforced — all required items must be COMPLETED first.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Submit | **FE→BE** | `POST` | `/milestones/:id/submit` | Submit deliverable | `{ description: string, files_json?: [{ name: string, url: string }] }` |
| Success | **BE→FE** | `201` | — | Submission created, milestone → SUBMITTED | `{ id, milestone_id, expert_id, description, files_json, submitted_at }` |

**Errors:**
| BE Code | Message | FE Action |
|:-------:|---------|-----------|
| 422 | `REQUIRED_DOD_INCOMPLETE` + `missing_items: [{ id, itemDescription }]` | Show list of incomplete required DOD items, link to DodChecklist |
| 422 | Milestone not IN_PROGRESS | Show "Milestone is not in progress" |

**Pre-submit validation (FE-side):**
- Check all `dodItems` where `is_required === true` have `status === 'COMPLETED'`
- If not, disable submit button + show warning

---

### Screen 3: BidRevision.tsx — **CAN START NOW**

Expert revises bid after TECH_TEAM requests revision. Reuses BidForm components.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Load bid | **FE→BE** | `GET` | `/bids/:id` | Fetch current bid | — |
| Data | **BE→FE** | `200` | — | Bid detail | `{ id, footprint_alignment_json, approach_summary, conditional_pricing_json, tech_status: 'REVISION_REQUESTED', tech_feedback, state, version_number }` |
| Pre-fill | **FE** | — | — | Populate form with existing values | Show `tech_feedback` prominently at top |
| Submit | **FE→BE** | `PUT` | `/bids/:id` | Update bid | `{ footprint_alignment_json, approach_summary, conditional_pricing_json }` (all 3 required) |
| Success | **BE→FE** | `200` | — | Bid updated, tech_status → PENDING | `{ tech_status: 'PENDING', version_number: incremented }` |
| Then | **FE** | — | — | Navigate to engagement or show success | Invalidate `['bids']` query |

**Existing Hook:** `useBid(bidId)` + `useUpdateBid()` from `use-bids.ts`

---

### Screen 4: CounterOfferReceived.tsx — **CAN START NOW**

Expert views CEO's counter-offer price on a bid.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Load | **FE→BE** | `GET` | `/bids/:id` | Fetch bid with negotiated price | — |
| Data | **BE→FE** | `200` | — | Bid with counter-offer | `{ negotiated_price_vnd: 4500000, ceo_status, state }` |
| Render | **FE** | — | — | Display counter-offer amount | Compare original pricing vs negotiated |

**Note:** Counter-offer is read-only for expert. Expert must revise bid (BidRevision) with new pricing, not accept/reject the counter-offer directly.

---

### Screen 5: SubmissionStatus.tsx

Expert views submission state after delivering.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Load | **FE→BE** | `GET` | `/milestones/:id` | Fetch milestone | — |
| Data | **BE→FE** | `200` | — | Milestone state | `{ state: 'SUBMITTED'|'IN_REVISION'|'APPROVED', acceptanceCriteria: [{ verified_at, revision_note }], submitted_at, approved_at }` |

**State → Display Mapping:**
| `state` | What to Show |
|-----------|-------------|
| `SUBMITTED` | "Awaiting review" with spinner |
| `IN_REVISION` | Show `revision_note` from criteria, link to BidRevision |
| `APPROVED` | "Approved! Payment released" — show `approved_at` |
| `DISPUTED` | "Under dispute" — link to DisputeStatus |

---

## 🎨 UI Mockup: DodChecklist

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Milestone                                    │
│                                                         │
│  DoD Checklist — Milestone #1                           │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ✅ [required] Run integration test suite        │   │
│  │    Note: All 47 tests passing                    │   │
│  │    [Mark Incomplete]                             │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ⏳ [required] Load test with 1000 concurrent    │   │
│  │    [✓ Mark Complete]  [✗ Not Applicable]        │   │
│  │    ┌─ Completion Note ──────────────────────┐   │   │
│  │    │ [                              ]       │   │   │
│  │    └────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ⬜ [optional] Update README with setup docs     │   │
│  │    [✓ Mark Complete]  [✗ Not Applicable]        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Add New Item ─────────────────────────────────┐   │
│  │ [                              ] [required? ☑] │   │
│  │ [+ Add]                                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Required: 1/2 complete — Cannot submit yet            │
└─────────────────────────────────────────────────────────┘
```

## 🎨 UI Mockup: DeliverableSubmit

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Milestone                                    │
│                                                         │
│  Submit Deliverable — Milestone #1                      │
│                                                         │
│  ⚠️ 1 required DoD item incomplete:                     │
│     • Load test with 1000 concurrent                    │
│     [Complete DoD Checklist →]                           │
│                                                         │
│  Description:                                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                  │   │
│  │  (Describe what was delivered...)                │   │
│  │                                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Attachments:                                            │
│  [📎 deliverable-v1.zip ×]  [+ Add File]                │
│                                                         │
│  [Submit Deliverable]  (disabled if DoD incomplete)     │
└─────────────────────────────────────────────────────────┘
```
