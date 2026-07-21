# 03 — Minh: CEO Bids + Tech Team Milestones + Disputes

> **Screens:** 8 | **Dashboard(s):** CEO, Tech Team, CEO (disputes)
> **Existing Hooks:** use-bids.ts ✅, use-engagements.ts ✅
> **Blocked By:** Nhân's use-criteria.ts, use-milestones.ts (for Phase 2-3)
> **Can Start NOW:** Phase 1 (CEO Bid screens) — zero blockers!
> **Source:** Live codebase E:\AITaskerVer3

---

## Your Files

| # | File | Dashboard | Status | Blocks? |
|---|------|-----------|--------|:---:|
| 1 | `features/ceo/bids/BidDetail.tsx` | CEO | Stub (0B) | **START NOW** |
| 2 | `features/ceo/bids/BidList.tsx` | CEO | Stub (0B) | **START NOW** |
| 3 | `features/ceo/bids/BidDecisionConfirm.tsx` | CEO | Stub (0B) | **START NOW** |
| 4 | `features/tech-team/milestones/TechMilestoneList.tsx` | Tech Team | New | Needs use-milestones |
| 5 | `features/tech-team/milestones/CriteriaSignOff.tsx` | Tech Team | Stub (0B) | Needs use-criteria |
| 6 | `features/tech-team/milestones/TechMilestoneView.tsx` | Tech Team | New | Needs use-milestones |
| 7 | `features/ceo/milestones/DisputeFile.tsx` | CEO | Stub (0B) | Needs use-disputes |
| 8 | `features/ceo/milestones/DisputeResult.tsx` | CEO | Stub (0B) | Needs use-disputes |

---

## 📋 Per-Screen Data Flow

### PHASE 1 — CEO Bids (START NOW, no blockers)

### Screen 1: BidDetail.tsx

CEO views a single bid with full detail + decision buttons.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Load | **FE→BE** | `GET` | `/bids/:id` | Fetch bid detail | — |
| Data | **BE→FE** | `200` | — | Full bid | `{ id, engagement_id, footprint_alignment_json: { domains: [{ code, depth }], seams: [{ code, tier }] }, approach_summary, conditional_pricing_json: [{ milestone_number, price_vnd, condition }], state, tech_status: 'PENDING'|'APPROVED'|'REVISION_REQUESTED', ceo_status: 'PENDING'|'APPROVED'|'DECLINED', tech_feedback, negotiated_price_vnd, version_number }` |
| Render | **FE** | — | — | Show bid cards + action buttons | Tech status badge, approach text, pricing list, footprint alignment grid |

**Decision buttons (only show when `tech_status === 'APPROVED'` AND `ceo_status === 'PENDING'`):**

**Sub-action: CEO Approves Bid**
| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Decide | **FE→BE** | `PUT` | `/bids/:id/ceo-decision` | Approve | `{ decision: 'APPROVED' }` |
| Response | **BE→FE** | `200` | — | Winner selected | `{ ceo_status: 'APPROVED', state: 'SELECTED' }` — BE auto-declines all other bids |
| Then | **FE** | — | — | Navigate to engagement NDA | Invalidate `['bids']`, `['engagements']` |

**Sub-action: CEO Declines Bid**
| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Decide | **FE→BE** | `PUT` | `/bids/:id/ceo-decision` | Decline | `{ decision: 'DECLINED' }` |
| Response | **BE→FE** | `200` | — | Declined | `{ ceo_status: 'DECLINED', state: 'DECLINED' }` |

**Existing Hook:** `useBid(bidId)` + `useCeoDecision()` from `hooks/use-bids.ts`

**Errors:**
| BE Code | Message | FE Action |
|:-------:|---------|-----------|
| 422 | "TECH_REVIEW_INCOMPLETE" | Hide decision buttons, show "Waiting for Tech Team review" |
| 409 | Bid already decided | Show current decision status |

---

### Screen 2: BidDecisionConfirm.tsx (CounterOffer Panel)

CEO submits a counter-offer price. Only available when tech_status=APPROVED AND negotiated_price_vnd=null AND ceo_status=PENDING.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Submit | **FE→BE** | `PUT` | `/bids/:id/counter-offer` | Set counter-price | `{ negotiated_price_vnd: 4500000 }` |
| Response | **BE→FE** | `200` | — | Price set (immutable) | `{ negotiated_price_vnd: 4500000 }` |
| Then | **FE** | — | — | Close modal, refresh bid | Show "Counter-offer sent" toast |

**Existing Hook:** `useCounterOffer()` from `hooks/use-bids.ts`

**Errors:**
| BE Code | Message | FE Action |
|:-------:|---------|-----------|
| 409 | "COUNTER_OFFER_ALREADY_SET" | Show current counter-offer amount, disable form |
| 422 | "TECH_REVIEW_INCOMPLETE" | Hide panel |

**Rules:** ONE round only. After counter-offer is set, expert sees it in CounterOfferReceived and can revise bid with new pricing.

---

### Screen 3: BidList.tsx

CEO views all bids for a project.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Load | **FE→BE** | `GET` | `/engagements/:projectId` (or iterate engagements) | Fetch all engagements with bids | `engagements` where `projectId === projectId` |

**Note:** Bids are fetched through engagements. Use `useEngagements()` filter by project, then extract `capabilityBid` from each.

**Reference:** `CeoBidList.tsx` (191 lines, already working) — study this file for the pattern.

---

### PHASE 2 — Tech Team Milestones (Needs use-milestones + use-criteria)

### Screen 4: TechMilestoneList.tsx

Tech Team views milestones for their linked project.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Load | **FE→BE** | `GET` | `/engagements/:id` | Fetch engagement with milestones[] | — |
| Data | **BE→FE** | `200` | — | Engagement + milestones | `{ milestones: [{ id, milestone_number, deliverable_statement, state, sign_off_authority, payment_amount_vnd }] }` |
| Filter | **FE** | — | — | Show milestones where `sign_off_authority === 'TECH_TEAM' || 'JOINT'` | CEO-only milestones hidden |

**State → Action (Tech Team view):**
| `state` | Button |
|-----------|--------|
| `SUBMITTED` | "Review Criteria" → CriteriaSignOff |
| Others | "View" → TechMilestoneView |

---

### Screen 5: CriteriaSignOff.tsx

Tech Team verifies or requests revision on acceptance criteria.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Load | **FE→BE** | `GET` | `/milestones/:id` | Fetch milestone with criteria | — |
| Data | **BE→FE** | `200` | — | Criteria list | `{ acceptanceCriteria: [{ id, criterion_text, is_required, verified_by_role, verified_at, revision_note }] }` |
| Filter | **FE** | — | — | Show only criteria where `verified_by_role === 'TECH_TEAM' || 'JOINT'` | — |

**Verify Criterion:**
| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Verify | **FE→BE** | `PUT` | `/criteria/:id/verify` | Sign off | `{ verification_comment?: string }` |
| Response | **BE→FE** | `200` | — | Verified | `{ success: true }` — if all required verified → auto escrow release |

**Request Revision:**
| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Revise | **FE→BE** | `PUT` | `/criteria/:id/revision` | Request changes | `{ revision_note: string }` |
| Response | **BE→FE** | `200` | — | Milestone → IN_REVISION | `{ success: true }` |

---

### PHASE 3 — Disputes

### Screen 7: DisputeFile.tsx

CEO or Tech Team files a dispute on an unverified criterion.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| File | **FE→BE** | `POST` | `/disputes` | File dispute | `{ criterion_id: string, engagement_id: string, milestone_id: string, additional_context?: string }` |
| Success | **BE→FE** | `201` | — | Dispute created, escrow FROZEN | `{ dispute_id, state: 'LAYER_1_EVAL' | 'AUTO_RESOLVED' | 'MANUAL_REVIEW', finding?, confidence_score? }` |
| Then | **FE** | — | — | Navigate to DisputeResult | Show "Dispute filed" + result if auto-resolved |

**Pre-conditions:** Milestone must be SUBMITTED or IN_REVISION. Criterion must not be verified yet.

### Screen 8: DisputeResult.tsx

View dispute resolution status. Polls for updates.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Load | **FE→BE** | `GET` | `/disputes/:id` | Fetch dispute | — |
| Data | **BE→FE** | `200` | — | Dispute detail | `{ state, llm_confidence, filed_at, resolved_at, criterion_id, escrow_account_id }` |
| Poll | **FE→BE** | `GET` | `/disputes/:id` | Every 10s until resolved | — |

**State → Display:**
| `state` | Display |
|-----------|---------|
| `LAYER_1_EVAL` | "AI evaluating..." spinner |
| `AUTO_RESOLVED` | Result + confidence score + escrow action |
| `MANUAL_REVIEW` | "Escalated to Admin" |
| `RESOLVED` | Final resolution |
