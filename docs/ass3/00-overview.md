# 00 — Overview: Rest of Flow Implementation Plan

> **Last updated:** 2026-07-07
> **Source of truth:** `E:\AITaskerVer3\` (live codebase)
> **Docs companion:** `E:\FPT University\Summer 2026\SWP-Ver3Docs\`

---

## 1. Executive Summary

This document maps the **remaining unimplemented flows** for the AITasker platform — everything from Milestone Creation through Escrow Release. It defines what's already built (MF1 + MF2), what BE endpoints exist vs what FE screens are needed, and the team division for the remaining work.

### What's Complete ✅

| Completed Area | BE Author | FE Author | Status |
|---|---|---|---|
| **MF1 — CEO Elicitation + Spec Publishing** (5 stages + quality gate + handoff) | Cao Minh + Minh Hùng (FastAPI) | Tuấn Khang | ✅ Done (with remaining polish bugs in `need-to-fix-mf1-2.txt`) |
| **MF2 — Expert Profile Builder** (domain depths, seam claims, portfolio verification) | Cao Minh | Tuấn Khang | ✅ Done |
| **MF2 — Matching + Shortlist** (`GET /matching/:projectId/shortlist`) | Cao Minh + Minh Hùng | Tuấn Khang | ✅ Done |
| **MF2 — Bid Submission** (`POST /bids`, `PUT /bids/:id`) | Cao Minh | Tuấn Khang | ✅ Done |
| **MF2 — Tech Review** (`PUT /bids/:id/tech-review`) | Cao Minh | Minh Thức (tech-team screens) | ✅ Done |
| **MF2 — CEO Decision** (`PUT /bids/:id/ceo-decision`, `/counter-offer`) | Cao Minh | Tuấn Khang (Nhân for hooks) | ✅ Done (Flow 3 in progress) |
| **MF2 — NDA + Connection** (`PUT /engagements/:id/accept-nda`, `/connect`) | Cao Minh | Tuấn Khang | ✅ Done (Flow 3 in progress) |
| **Auth + Guard System** | Chí Nhân | Tuấn Khang | ✅ Done |
| **Wallet + IPN + Topup** | Chí Nhân | Tuấn Khang | ✅ Done |
| **LedgerService** (`releaseMilestone`, `releaseMilestoneWithTx`) | Chí Nhân | N/A | ✅ Done |
| **Admin read endpoints** (9 SELECT queries) | Minh Thức | Minh Thức | ✅ Done |
| **Messages infrastructure** (controller + gateway) | Minh Thức | — | ✅ BE done |
| **Reviews module** (POST/GET) | Minh Thức | — | ✅ BE done |
| **Disputes module** (POST/GET) | Cao Minh | — | ✅ BE done |

### What's NOT Complete ❌ (Remaining Flow)

| Remaining Area | BE Status | FE Status |
|---|---|---|
| **Milestone Creation** (`POST /milestones`) | ✅ BE done (Minh Thức) | ❌ No FE screen |
| **Milestone Funding** (`PUT /milestones/:id/fund`) | ✅ BE done (Minh Thức) | ❌ No FE screen |
| **DoD Checklist** (add/update items) | ✅ BE done (Minh Thức) | ❌ No FE screen |
| **Milestone Submission** (`POST /milestones/:id/submit` with DoD gate) | ✅ BE done (Minh Thức) | ❌ No FE screen |
| **Criteria Verification** (`PUT /criteria/:id/verify` → triggers escrow release) | ✅ BE done (Minh Thức) | ❌ No FE screen |
| **Criteria Revision Request** (`PUT /criteria/:id/revision`) | ✅ BE done (Minh Thức) | ❌ No FE screen |
| **Paygated Documents** (stage/release/download) | ✅ BE done (Minh Thức) | ❌ No FE screen |
| **Disputes** (file + view) | ✅ BE done (Cao Minh) | ❌ No FE screen |
| **Escrow Release** (triggered by criteria verify → LedgerService) | ✅ BE done (Minh Thức + Chí Nhân) | ❌ No FE confirmation UI |
| **Withdrawals Flow** (request/view) | ✅ BE done (Chí Nhân) | ❌ No FE screen |
| **Admin Write Endpoints** (suspend, resolve dispute) | ✅ BE done (Minh Thức) | ❌ No FE screen |
| **Reviews UI** (post/get) | ✅ BE done (Minh Thức) | ❌ No FE screen |
| **Messages UI** (chat history, Socket.io) | ✅ BE done (Minh Thức) | ❌ No FE screen |
| **Admin Dashboard** (analytics, decisions log) | ✅ BE done (Minh Thức) | ⚠️ Partial (read panels only) |

---

## 2. Full Flow State Transition Map

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                         AITASKER COMPLETE FLOW (Milestone → Escrow)                  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ELICITATION (MF1 — ✅ COMPLETE)                                                     │
│  ─────────────────────────────────                                                   │
│  Session Created → Stage1(Symptoms) → Stage2(Archetype) → Stage3(Probes)            │
│       → Stage4(Tech Context) → Stage5(Synthesis) → Quality Gate → PUBLISHED        │
│                                                                                      │
│  MATCHING + BIDDING (MF2 — ✅ COMPLETE)                                              │
│  ────────────────────────────────────                                                │
│  PUBLISHED → Shortlist → Expert Submits Bid → Tech Review → CEO Decision            │
│       → SELECTED → Engagement=PENDING                                               │
│                                                                                      │
│  NDA + CONNECTION (MF2 — ✅ COMPLETE)                                                │
│  ───────────────────────────────────                                                 │
│  PENDING → CEO Accepts NDA → Expert Accepts Connect → CONNECTED                     │
│                                                                                      │
│  ╔══════════════════════════════════════════════════════════════════════════════╗   │
│  ║                    REMAINING FLOW (MF3 — ❌ TO IMPLEMENT)                    ║   │
│  ╠══════════════════════════════════════════════════════════════════════════════╣   │
│  ║                                                                              ║   │
│  ║  MILESTONE CREATION                                                          ║   │
│  ║  ─────────────────                                                            ║   │
│  ║  CONNECTED → CEO Creates Milestones (POST /milestones)                       ║   │
│  ║      → state: DEFINED                                                        ║   │
│  ║      Fields: engagement_id, milestone_number, deliverable_statement,         ║   │
│  ║              sign_off_authority (TECH_TEAM|CEO|JOINT), payment_amount_vnd,   ║   │
│  ║              criteria: [{criterion_text, is_required}]                       ║   │
│  ║                                                                              ║   │
│  ║  MILESTONE FUNDING                                                           ║   │
│  ║  ────────────────                                                            ║   │
│  ║  DEFINED → CEO Initiates Funding (PUT /milestones/:id/fund)                  ║   │
│  ║      → state: AWAITING_PAYMENT                                              ║   │
│  ║      → VA created (vaNumber, expiresAt +24h, fixedAmount)                    ║   │
│  ║      → CEO pays via VietQR → SePay IPN fires                                 ║   │
│  ║      → IPN Handler: locks funds in escrow → state: FUNDED                    ║   │
│  ║                                                                              ║   │
│  ║  DoD CHECKLIST (pre-submission gate)                                         ║   │
│  ║  ───────────────────────────────────                                          ║   │
│  ║  FUNDED → Expert Adds DoD Items (POST /milestones/:id/dod/items)             ║   │
│  ║      → Expert Completes DoD Items (PUT /milestones/:id/dod/:itemId)          ║   │
│  ║      state stays: FUNDED (or transitions to IN_PROGRESS if first item hits)  ║   │
│  ║                                                                              ║   │
│  ║  MILESTONE SUBMISSION                                                        ║   │
│  ║  ────────────────────                                                        ║   │
│  ║  FUNDED/IN_PROGRESS → Expert Submits Deliverables                            ║   │
│  ║      POST /milestones/:id/submit                                            ║   │
│  ║      → DoD Gate: if any required DoD item != COMPLETED → 422 (block)        ║   │
│  ║      → state: SUBMITTED                                                     ║   │
│  ║                                                                              ║   │
│  ║  CRITERIA VERIFICATION                                                       ║   │
│  ║  ─────────────────────                                                       ║   │
│  ║  SUBMITTED → Sign-off Authority Verifies Each Criterion                      ║   │
│  ║      PUT /criteria/:id/verify                                               ║   │
│  ║      → When ALL required criteria verified + no open dispute:               ║   │
│  ║          → state: APPROVED                                                   ║   │
│  ║          → LedgerService.releaseMilestoneWithTx() fires atomically:          ║   │
│  ║              - Platform fee to platform wallet                               ║   │
│  ║              - Remaining to expert wallet                                    ║   │
│  ║              - Client lockedBalance decremented                              ║   │
│  ║              - Escrow account → RELEASED                                     ║   │
│  ║          → state: RELEASED                                                   ║   │
│  ║                                                                              ║   │
│  ║  REVISION LOOP                                                               ║   │
│  ║  ────────────                                                                ║   │
│  ║  SUBMITTED → Authority Requests Revision (PUT /criteria/:id/revision)        ║   │
│  ║      → state: IN_REVISION                                                   ║   │
│  ║      → Expert fixes → re-submits → back to SUBMITTED                         ║   │
│  ║                                                                              ║   │
│  ║  DISPUTE RESOLUTION                                                          ║   │
│  ║  ──────────────────                                                          ║   │
│  ║  SUBMITTED/IN_REVISION → Either party files dispute                          ║   │
│  ║      POST /disputes → escrow FROZEN → LLM eval → auto/fail → admin resolves  ║   │
│  ║      state: DISPUTED → DISPUTE_RESOLVED                                      ║   │
│  ║                                                                              ║   │
│  ║  ESCROW RELEASE                                                              ║   │
│  ║  ──────────────                                                              ║   │
│  ║  APPROVED → All required criteria signed off → LedgerService fires           ║   │
│  ║      → Expert wallet credited → Withdrawal available                         ║   │
│  ║      → Engagement may transition to CLOSED when all milestones released      ║   │
│  ║                                                                              ║   │
│  ╚══════════════════════════════════════════════════════════════════════════════╝   │
│                                                                                      │
│  WITHDRAWAL                                                                          │
│  ──────────                                                                          │
│  Expert requests withdrawal → Admin confirms/denies → PENDING→PROCESSING→COMPLETED  │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### State Machine: Milestone

```
        POST /milestones
             │
             ▼
        ┌─────────┐    PUT /milestones/:id/fund    ┌──────────────────┐
        │ DEFINED │ ──────────────────────────────▶ │ AWAITING_PAYMENT │
        └─────────┘                                 └────────┬─────────┘
                                                             │
                                          SePay IPN confirms  │
                                          (escrow locked)     │
                                                             ▼
        ┌─────────────┐    Expert adds/completes    ┌────────┐
        │ IN_PROGRESS │ ◀────────────────────────── │ FUNDED │
        └──────┬──────┘    DoD items                └────────┘
               │
               │ Expert submits (DoD gate enforced)
               ▼
        ┌───────────┐
        │ SUBMITTED │
        └─────┬─────┘
              │
    ┌─────────┼──────────┐
    │         │          │
    ▼         ▼          ▼
┌────────┐ ┌──────────┐ ┌──────────┐
│VERIFY  │ │ REVISION │ │ DISPUTE  │
│(approve│ │(reject)  │ │ (file)   │
│ each)  │ │          │ │          │
└───┬────┘ └────┬─────┘ └────┬─────┘
    │           │            │
    │    ┌──────┘            │
    │    │  Expert re-submits│
    │    │  → back to        │
    │    │  SUBMITTED        │
    │    ▼                   │
    │ ┌─────────────┐        │
    │ │ IN_REVISION │        │
    │ └─────────────┘        │
    │                        │
    ▼                        ▼
┌──────────┐         ┌─────────────────┐
│ APPROVED │         │ DISPUTE_RESOLVED│
└────┬─────┘         └────────┬────────┘
     │                        │
     │ LedgerService fires    │ LedgerService fires
     │ (escrow released)      │ (per admin resolution)
     ▼                        ▼
┌──────────┐         ┌──────────┐
│ RELEASED │         │ RELEASED │
└──────────┘         └──────────┘
```

### State Machine: Engagement

```
    Bid SELECTED
         │
         ▼
    ┌─────────┐    Both NDA accepted    ┌───────────┐    First milestone   ┌────────┐
    │ PENDING │ ───────────────────────▶ │ CONNECTED │ ──────────────────▶ │ ACTIVE │
    └─────────┘                          └───────────┘    funded/started    └───┬────┘
         │                                                                      │
         │ Expert declines                                                      │
         ▼                                                                      │
    ┌──────────┐                                          All milestones        │
    │ DECLINED │                                          released              │
    └──────────┘                                                                 │
                                                                                ▼
                                                                          ┌────────┐
                                                                          │ CLOSED │
                                                                          └────────┘
```

---

## 3. BE Endpoints vs FE Screens — Complete Matrix

### Legend
- ✅ = Done (BE + FE wired)
- 🟡 = BE Done, FE Missing
- ❌ = Neither Done

### 3.1 Milestones

| Method | Path | BE Author | BE Status | Required FE Screen | FE Status | Owner |
|---|---|---|---|---|---|---|
| `POST` | `/milestones` | Minh Thức | ✅ | MilestoneList + CreateMilestone form | 🟡 | Nhân (CEO) |
| `GET` | `/milestones/:id` | Minh Thức | ✅ | MilestoneDetail view | 🟡 | Nhân (CEO) |
| `PUT` | `/milestones/:id/fund` | Minh Thức | ✅ | FundMilestone + VietQR panel | 🟡 | Nhân (CEO) |

### 3.2 DoD Checklist

| Method | Path | BE Author | BE Status | Required FE Screen | FE Status | Owner |
|---|---|---|---|---|---|---|
| `POST` | `/milestones/:id/dod/items` | Minh Thức | ✅ | DodChecklist (add items) | 🟡 | Nhân (Expert) |
| `PUT` | `/milestones/:id/dod/:itemId` | Minh Thức | ✅ | DodItemRow (mark complete/NA) | 🟡 | Nhân (Expert) |

### 3.3 Submissions & Paygated Docs

| Method | Path | BE Author | BE Status | Required FE Screen | FE Status | Owner |
|---|---|---|---|---|---|---|
| `POST` | `/milestones/:id/submit` | Minh Thức | ✅ | DeliverableSubmit (with DoD gate errors) | 🟡 | Nhân (Expert) |
| `POST` | `/milestones/:id/paygated-docs` | Minh Thức | ✅ | PaygatedDocStage | 🟡 | Thức (Expert) |
| `GET` | `/milestones/:id/paygated-docs` | Minh Thức | ✅ | DocReleaseStatus + PaygatedDocInbox | 🟡 | Thức (TechTeam) |

### 3.4 Criteria Verification

| Method | Path | BE Author | BE Status | Required FE Screen | FE Status | Owner |
|---|---|---|---|---|---|---|
| `PUT` | `/criteria/:id/verify` | Minh Thức | ✅ | CriteriaVerify (list + verify buttons) | 🟡 | Nhân (CEO) + Thức (TechTeam) |
| `PUT` | `/criteria/:id/revision` | Minh Thức | ✅ | RevisionRequest form | 🟡 | Nhân (CEO) + Thức (TechTeam) |

### 3.5 Disputes

| Method | Path | BE Author | BE Status | Required FE Screen | FE Status | Owner |
|---|---|---|---|---|---|---|
| `POST` | `/disputes` | Cao Minh | ✅ | DisputeFile form | 🟡 | Nhân (CEO/Expert) |
| `GET` | `/disputes?state=` | Cao Minh | ✅ | DisputeMonitor list | 🟡 | Nhân |
| `GET` | `/disputes/:id` | Cao Minh | ✅ | DisputeDetail view | 🟡 | Nhân |
| `PUT` | `/admin/disputes/:id/resolve` | Minh Thức | ✅ | ResolutionConfirm + 3 button flows | 🟡 | Tuấn Khang |

### 3.6 Reviews

| Method | Path | BE Author | BE Status | Required FE Screen | FE Status | Owner |
|---|---|---|---|---|---|---|
| `POST` | `/reviews` | Minh Thức | ✅ | ReviewForm (CEO + Expert) | 🟡 | Thức (both roles) |
| `GET` | `/reviews/:engagementId` | Minh Thức | ✅ | ReviewList display | 🟡 | Thức |

### 3.7 Messages

| Method | Path | BE Author | BE Status | Required FE Screen | FE Status | Owner |
|---|---|---|---|---|---|---|
| `GET` | `/engagements/:id/messages` | Minh Thức | ✅ | MessageThread (Socket.io) | 🟡 | Nhân |
| `GET` | `/projects/:id/messages` | Minh Thức | ✅ | Pre-bid Q&A thread | 🟡 | Nhân |
| `POST` | `/messages/:id/read` | Minh Thức | ✅ | Read receipts | 🟡 | Nhân |
| `GET` | `/engagements/:id/messages/unread-count` | Minh Thức | ✅ | Badge count | 🟡 | Nhân |

### 3.8 Withdrawals

| Method | Path | BE Author | BE Status | Required FE Screen | FE Status | Owner |
|---|---|---|---|---|---|---|
| `POST` | `/withdrawals` | Chí Nhân | ✅ | WithdrawForm | 🟡 | Tuấn Khang |
| `GET` | `/withdrawals` | Chí Nhân | ✅ | Withdrawal history | 🟡 | Tuấn Khang |
| `GET` | `/admin/withdrawals` | Minh Thức | ✅ | WithdrawalRequests admin queue | 🟡 | Thức |
| `PUT` | `/admin/withdrawals/:id/complete` | Minh Thức | ✅ | Confirm button | 🟡 | Thức |
| `PUT` | `/admin/withdrawals/:id/fail` | Minh Thức | ✅ | Fail button with refund | 🟡 | Thức |

### 3.9 Admin

| Method | Path | BE Author | BE Status | Required FE Screen | FE Status | Owner |
|---|---|---|---|---|---|---|
| `PUT` | `/admin/projects/:id/suspend-spec` | Minh Thức | ✅ | PullbackConfirm | 🟡 | Thức |
| `PUT` | `/admin/users/:id/suspend` | Minh Thức | ✅ | SuspendConfirm | 🟡 | Thức |
| `GET` | `/admin/decisions` | Minh Thức | ✅ | IntegrityMonitor | ⚠️ Partial | Thức |
| `GET` | `/admin/transactions` | Minh Thức | ✅ | TransactionLedger | ⚠️ Partial | Thức |
| `GET` | `/admin/analytics` | Minh Thức | ✅ | AnalyticsDashboard | ⚠️ Partial | Thức |
| `GET` | `/admin/disputes` | Minh Thức | ✅ | DisputeMonitor | ⚠️ Partial | Thức |

### 3.10 Bank Hub (Expert Wallet Link)

| Method | Path | BE Author | BE Status | Required FE Screen | FE Status | Owner |
|---|---|---|---|---|---|---|
| `POST` | `/bank-hub/initiate-link` | Chí Nhân | ✅ | BankHubLink form | ✅ | Tuấn Khang |

---

## 4. Key DTOs — Field Reference

### CreateMilestoneDto (`backend/src/milestones/dto/create-milestone.dto.ts`)

```typescript
{
  engagement_id:          string;   // UUID — engagement must be CONNECTED or ACTIVE
  milestone_number:       number;   // sequential number, unique per engagement
  deliverable_statement:  string;   // "Expert will deploy RAG pipeline with..."
  sign_off_authority:     'TECH_TEAM' | 'CEO' | 'JOINT';
  payment_amount_vnd:     number;   // in VND, >0
  criteria:               CreateCriterionDto[];  // at least 1 required
}

// CreateCriterionDto
{
  criterion_text: string;
  is_required:    boolean;  // default: true
}
```

### CreateSubmissionDto (`backend/src/submissions/dto/create-submission.dto.ts`)

```typescript
{
  description: string;       // "Deployed RAG pipeline to staging..."
  files_json:  string[];     // array of file URLs or references
}
```

### VerifyCriterionDto (`backend/src/milestones/dto/verify-criterion.dto.ts`)

```typescript
{
  // No extra body — just PUT /criteria/:id/verify
  // BE sets verifiedAt = new Date(), clears revisionNote
}
```

### RevisionNoteDto (`backend/src/milestones/dto/revision-note.dto.ts`)

```typescript
{
  revision_note: string;  // "Criterion not met: accuracy below 95% threshold"
}
```

### CreateDoDItemDto (`backend/src/milestones/dto/create-dod-item.dto.ts`)

```typescript
{
  item_description:     string;   // "Run integration test suite"
  is_required:          boolean;  // default: true
  maps_to_criterion_id?: string;  // optional link to acceptance criterion
}
```

### UpdateDoDItemDto (`backend/src/milestones/dto/update-dod-item.dto.ts`)

```typescript
{
  status:               'PENDING' | 'COMPLETED' | 'NOT_APPLICABLE';
  completion_note?:     string;  // required if status=COMPLETED
  not_applicable_note?: string;  // required if status=NOT_APPLICABLE
}
```

### CreateDisputeDto (`backend/src/disputes/dto/create-dispute.dto.ts`)

```typescript
{
  criterion_id: string;    // which acceptance criterion is in dispute
  reason:       string;    // "Expert claims the accuracy criterion was met but..."
}
```

### CreateReviewDto (`backend/src/reviews/dto/create-review.dto.ts`)

```typescript
{
  engagement_id:  string;
  reviewee_id:    string;    // user ID of the party being reviewed
  rating:         number;    // 1–5
  comment:        string;
}
```

### CreateWithdrawalDto (`backend/src/wallet/dto/create-withdrawal.dto.ts`)

```typescript
{
  amount:            number;
  bank_account_xid:  string;
}
```

---

## 5. Critical BE Logic Paths (Escrow Release)

### Criteria Verification → Escrow Release Chain

```
PUT /criteria/:id/verify
    │
    ├── Set verifiedAt = new Date(), clear revisionNote
    │
    ├── Count unverified REQUIRED criteria for this milestone
    │
    ├── If unverifiedCount > 0 → return early (still awaiting more verifications)
    │
    ├── Check for open dispute (LAYER_1_EVAL or MANUAL_REVIEW)
    │       → If open dispute: return "Criterion verified, milestone has open dispute"
    │
    └── ALL criteria verified + no dispute:
         ├── tx.milestone.update({ state: 'APPROVED', approvedAt: now })
         └── ledgerService.releaseMilestoneWithTx(tx, milestoneId)
              │
              ├── Validate: milestone.state IN [SUBMITTED, APPROVED]
              ├── Validate: escrow_account.status == HELD
              │
              ├── Calculate: platformFee = escrowAmount * platformFeePct
              ├── Calculate: expertAmount = escrowAmount - platformFee
              │
              ├── Platform wallet: availableBalance += platformAmount
              ├── Client wallet: lockedBalance -= escrowAmount
              ├── Expert wallet: availableBalance += expertAmount
              │
              ├── 3 wallet_transaction rows:
              │     - PLATFORM_FEE (platform wallet)
              │     - ESCROW_RELEASE (client wallet)
              │     - ESCROW_RELEASE (expert wallet)
              │
              └── Escrow account: status = RELEASED
```

### IPN Handler — Milestone Payment Branch

```
POST /webhooks/sepay/ipn (HMAC verified)
    │
    ├── Parse: gateway, transactionDate, transferAmount, content, referenceNumber
    │
    ├── Idempotency check: referenceNumber already processed? → 200 OK (no-op)
    │
    ├── Match VA number from transferContent
    │       └── entityType == 'MILESTONE':
    │            ├── Verify VA is ACTIVE, not expired
    │            ├── Verify transferAmount >= fixedAmount
    │            └── Atomic TX:
    │                 ├── VA status = USED
    │                 ├── EscrowAccount: amount = transferAmount, status = HELD
    │                 ├── Client wallet: lockedBalance += transferAmount
    │                 ├── WalletTransaction: type = ESCROW_LOCK
    │                 ├── Milestone: state = FUNDED
    │                 └── Paygated docs: releaseState = RELEASED (if any staged)
```

---

## 6. Team Division at a Glance

### Flow 3 Work Division Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FLOW 3 DIVISION                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  NHÂN (Hooks + CEO/Expert Screens)                                  │
│  ─────────────────────────────────                                  │
│  Hooks (8 files):                                                   │
│    hooks/use-bids.ts           ✅ (exists, may need updates)        │
│    hooks/use-engagements.ts    ✅ (exists, may need updates)        │
│    hooks/use-milestones.ts     ❌ new                              │
│    hooks/use-dod.ts            ❌ new                              │
│    hooks/use-submissions.ts    ❌ new                              │
│    hooks/use-criteria.ts       ❌ new                              │
│    hooks/use-disputes.ts       ❌ new                              │
│    hooks/use-messages.ts       ❌ new                              │
│                                                                     │
│  CEO Screens (13 files):                                            │
│    ceo/milestones/MilestoneList.tsx                                  │
│    ceo/milestones/FundMilestone.tsx                                  │
│    ceo/milestones/CriteriaVerify.tsx                                 │
│    ceo/milestones/RevisionRequest.tsx                                │
│    ceo/milestones/DisputeFile.tsx                                    │
│    ceo/milestones/DisputeResult.tsx                                  │
│    ceo/milestones/JointMilestoneWait.tsx                             │
│    ceo/bids/*  (already mostly done)                                │
│    ceo/connection/* (already mostly done)                           │
│                                                                     │
│  Expert Screens (8 files):                                          │
│    expert/milestones/DodChecklist.tsx                                │
│    expert/milestones/DodItemRow.tsx                                  │
│    expert/milestones/DeliverableSubmit.tsx                           │
│    expert/milestones/MilestoneApproved.tsx                           │
│    expert/milestones/MilestoneInRevision.tsx                         │
│    expert/bidding/* (already mostly done)                           │
│    expert/connection/* (already mostly done)                        │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  THỨC (Tech-Team + Expert Doc Screens)                              │
│  ─────────────────────────────────────                              │
│    tech-team/bids/BidReviewList.tsx       ✅ (done)                 │
│    tech-team/bids/BidReviewDetail.tsx     ✅ (done)                 │
│    tech-team/bids/BidApprove.tsx          ✅ (done)                 │
│    tech-team/bids/BidRevisionRequest.tsx  ✅ (done)                 │
│    tech-team/vault/PaygatedDocInbox.tsx   ❌ new                    │
│    tech-team/vault/ArtifactBView.tsx      ❌ new                    │
│    tech-team/milestones/CriteriaSignOff.tsx ❌ new                  │
│    tech-team/milestones/JointMilestoneWait.tsx ❌ new               │
│    expert/documents/PaygatedDocStage.tsx  ❌ new                    │
│    expert/documents/DocReleaseStatus.tsx  ❌ new                    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  TUẤN KHANG (Admin Write + Withdrawals + Complex Screens)           │
│  ─────────────────────────────────────────────────────────           │
│    admin/disputes/DisputeDetail.tsx         ✅ (done)               │
│    admin/disputes/DisputeMonitor.tsx        ✅ (done)               │
│    admin/disputes/ResolutionConfirm.tsx     ❌ new                  │
│    features/expert/wallet/WithdrawForm.tsx  ❌ new                  │
│    features/expert/review/ExpertReviewForm.tsx ❌ new               │
│    features/ceo/review/CeoReviewForm.tsx    ❌ new                  │
│    (And polish on all existing screens)                             │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CAO MINH + CHÍ NHÂN (BE Support Only)                             │
│  ─────────────────────────────────────                               │
│    All remaining BE endpoints are DONE.                             │
│    Only needed for: code review + bug fixes.                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Dependency Chain

```
Nhân's Hooks (BLOCKING)
  ├── hooks/use-milestones.ts ─────► Nhân: ceo/milestones/*
  │                                  ► Thức: tech-team/milestones/CriteriaSignOff
  ├── hooks/use-dod.ts ────────────► Nhân: expert/milestones/DodChecklist
  ├── hooks/use-submissions.ts ────► Nhân: expert/milestones/DeliverableSubmit
  │                                  ► Thức: expert/documents/* + tech-team/vault/*
  ├── hooks/use-criteria.ts ───────► Nhân: ceo/milestones/CriteriaVerify
  │                                  ► Thức: tech-team/milestones/CriteriaSignOff
  ├── hooks/use-disputes.ts ───────► Nhân: ceo/milestones/DisputeFile
  └── hooks/use-messages.ts ───────► Nhân: messaging UI (P2)
```

---

## 7. Escrow Status Flow

```
   FUNDED milestone
        │
        ▼
   ┌──────┐   Submission → Criteria Verify   ┌──────────┐
   │ HELD │ ─────────────────────────────────▶│ RELEASED │
   └──┬───┘                                   └──────────┘
      │
      │ Dispute filed
      ▼
   ┌────────┐   Admin resolves ──────────► ┌──────────┐
   │ FROZEN │ ──┬── release ──────────────► │ RELEASED │
   └────────┘   ├── refund ───────────────► │ REFUNDED │
                └── split  ───────────────► │ SPLIT    │
```

**EscrowStatus enum** (`backend/src/common/enums/escrow-status.enum.ts`):
```typescript
HELD | RELEASED | FROZEN | REFUNDED | SPLIT
```

---

## 8. Priority Order for Remaining FE Screens

| Priority | Screens | Reason |
|---|---|---|
| **P0** | MilestoneList, FundMilestone, DodChecklist, DodItemRow, DeliverableSubmit, CriteriaVerify | Critical path: milestone → fund → DoD → submit → verify → release |
| **P0** | 6 NEW hooks (milestones, dod, submissions, criteria, disputes, messages) | Foundation — all screens depend on these |
| **P1** | RevisionRequest, CriteriaSignOff (tech-team), PaygatedDocStage, PaygatedDocInbox | Supporting flows — locked behind P0 hooks |
| **P1** | ResolutionConfirm (admin), WithdrawForm, DisputeFile, DisputeResult | Dispute resolution + withdrawal |
| **P2** | MessageThread, ReviewForm (both roles), JointMilestoneWait, DocReleaseStatus, MilestoneApproved, MilestoneInRevision | Polish + communication |
| **P2** | Admin analytics polish, export data | Read-only admin panels (partial built) |

---

## 9. Route Registration Gaps (App.tsx)

[V] Current `App.tsx` routes that are **missing** for Flow 3:

```tsx
// MISSING — CEO routes (Nhân to add)
<Route path="ceo/milestones/:engagementId" element={<MilestoneList />} />
<Route path="ceo/milestones/:engagementId/fund/:milestoneId" element={<FundMilestone />} />
<Route path="ceo/milestones/:engagementId/verify/:milestoneId" element={<CriteriaVerify />} />
<Route path="ceo/milestones/:engagementId/revision/:criterionId" element={<RevisionRequest />} />
<Route path="ceo/milestones/:engagementId/dispute/:criterionId" element={<DisputeFile />} />
<Route path="ceo/milestones/:engagementId/dispute-result/:disputeId" element={<DisputeResult />} />

// MISSING — Expert routes (Nhân to add)
<Route path="expert/milestones/:engagementId" element={<DodChecklist />} />
<Route path="expert/milestones/:engagementId/submit/:milestoneId" element={<DeliverableSubmit />} />
<Route path="expert/milestones/:engagementId/approved/:milestoneId" element={<MilestoneApproved />} />
<Route path="expert/milestones/:engagementId/revision/:milestoneId" element={<MilestoneInRevision />} />

// MISSING — Tech-team routes (Thức to add)
<Route path="tech-team/milestones/:engagementId/verify/:milestoneId" element={<CriteriaSignOff />} />
<Route path="tech-team/vault/:engagementId" element={<PaygatedDocInbox />} />
<Route path="tech-team/vault/:engagementId/artifact-b" element={<ArtifactBView />} />
```

---

## 10. Risks & Dependencies

| Risk | Impact | Mitigation |
|---|---|---|
| Nhân creates all hooks — Thức blocked until hooks exist | 🟡 Medium | Thức builds UI shells first, wires hooks after |
| SeamCode encoding mismatch (Unicode ↔ vs ASCII <->) | 🔴 High | Already mitigated in `use-bids.ts` with `normalizeSeamCodes()` — verify bid/CounterOffer DTOs too |
| React Query cache invalidation across 8 hooks | 🟡 Medium | Follow exact `onSuccess` invalidation patterns from existing hooks |
| Nhân is React beginner | 🟡 Medium | All hooks are copy-paste from FLOW3_FE_BE_INTEGRATION.md |
| Wallet balance check before funding | 🔴 High | Client must have sufficient availableBalance — LedgerService rejects at DB level but FE should pre-check |
| DoD gate 422 error display | 🟡 Medium | Submission BE returns `missing_items: [{id, itemDescription}]` — FE must parse and display each |
| Escrow auto-release only fires when ALL criteria verified | 🔴 High | If JOINT sign-off, both TECH_TEAM and CEO must verify all their criteria — UI must show who's pending |

---

## 11. Integration Test Coverage Map

| Test | What it proves | Status |
|---|---|---|
| T03 — DoD gate | Submit blocked when required DoD != COMPLETED, returns 422 + missing_items | ❌ Pending |
| T07 — DoD DB check | Raw SQL set NOT_APPLICABLE on required item → DB rejects | ❌ Pending |
| T10 — Criteria role mismatch | TECH_TEAM verifying CEO criterion → 403 | ❌ Pending |
| T12 — APPROVED guard | Verify 1/2 criteria → no ledger fire; verify 2nd → ledger fires atomically | ❌ Pending |
| T02 — Ledger atomic TX | All 6 tables written in one TX; rollback on mid-TX failure | ✅ Chí Nhân |
| T09 — Escrow dual-parent | INSERT with both milestone_id + engagement_id → DB CHECK rejects | ✅ Chí Nhân |

---

## 12. Architecture Soundness Verdict

**Verdict:** ✅ The architecture is sound for incremental build-out.

### Strengths
- All BE endpoints for the remaining flow are already implemented and tested via Swagger
- LedgerService (the most critical shared code) is complete and atomic
- The state machine transitions are well-defined and enforced at the DB constraint level
- Hooks follow a consistent TanStack Query pattern — copy-paste-able
- Role guards are already in place for all endpoints

### Watch Points
1. **JOINT sign-off coordination**: Both TECH_TEAM and CEO must verify their respective criteria. The UI needs to clearly show who's pending — the BE doesn't track this at a per-role level, it just counts unverified REQUIRED criteria.
2. **Dispute freeze**: When a dispute is filed, escrow goes to FROZEN — the milestone stays in DISPUTED. No automatic recovery — admin must manually resolve (`PUT /admin/disputes/:id/resolve`).
3. **Paygated docs release timing**: Documents transition from STAGED → RELEASED when IPN confirms the milestone payment (FUNDED state). Not before. The FE should show a "locked until funding" state.
4. **Withdrawal without bank link**: Expert can accumulate balance but can't withdraw without a linked bank account (`sepayBankAccountXid`). The `POST /engagements/:id/connect` already returns `prompt_bank_link: true` when missing.

---

*End of 00-overview.md — references real DTOs and paths from `E:\AITaskerVer3\`*