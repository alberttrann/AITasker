# AITasker — State Machine Reference Document
### Full-Fat Architecture · 40 Tables · Cross-Table CRUD Grounding

> **Purpose:** Definitive state machine reference for system architecture and technical verification. Every state transition is grounded in exact database schema tables, columns, CHECK constraints, double-entry ledger operations, and backend endpoints.  
> **Last updated:** July 2026 Codebase Alignment  
> **Conventions:** `[LEDGER]` = `wallet_transactions` row written. Tables in **bold** on first reference. §0.x = Master Reference Sheet section.

---

## Table of Contents

1. [Elicitation Session States](#1-elicitation-session-states)
2. [Spec / Project States](#2-spec--project-states)
3. [Capability Bid States & Negotiation Envelope](#3-capability-bid-states--negotiation-envelope)
4. [Engagement States & Path Discriminators](#4-engagement-states--path-discriminators)
5. [Milestone States](#5-milestone-states)
6. [Acceptance Criterion Verification](#6-acceptance-criterion-verification)
7. [DoD Checklist Item States](#7-dod-checklist-item-states)
8. [Pay-Gated Document States](#8-pay-gated-document-states)
9. [Escrow Account & Dispute Resolution (2-Layer)](#9-escrow-account--dispute-resolution-2-layer)
10. [Virtual Account States](#10-virtual-account-states)
11. [Wallet Transaction Types & Internal Ledger Flow](#11-wallet-transaction-types--internal-ledger-flow)
12. [Withdrawal Request States](#12-withdrawal-request-states)
13. [Subscription States](#13-subscription-states)
14. [Service Listing States](#14-service-listing-states)
15. [Portfolio Submission & Seam Verification States](#15-portfolio-submission--seam-verification-states)
16. [Invitation States](#16-invitation-states)
17. [Platform Decision Audit Log Types](#17-platform-decision-audit-log-types)
18. [Cross-Table CRUD Dependency Map (40 Tables)](#18-cross-table-crud-dependency-map-40-tables)

---

## 1. Elicitation Session States

### Master Reference

- **§0.1 Domains:** CMS-driven **`domain_definitions`** — drives the 5-stage conversational diagnostic.
- **§0.3 Archetypes:** CMS-driven **`archetype_definitions`**; locked into `elicitation_sessions.archetype` in Stage 2.
- **§0.3 Tiers:** Determined in Stage 5 from scale signals; locked into `projects.tier`.
- **§0.6 Spec states:** Elicitation output determines whether project reaches `PUBLISHED` or `RETURNED`.

### State-by-State Narration

```
          [*]`
           │
           ▼
     [IN_PROGRESS] ──(Stage 5 fail / score < 0.70)──► [RETURNED]
           │                                             │
           │                                 (Re-enter at void stage)
           │                                             │
           ├──(Stage 5 pass / score ≥ 0.70)──► [COMPLETED] ◄─┘
           │
           └──(Explicit / Nav away)───────► [ABANDONED]
```

#### `[*]` → `IN_PROGRESS`

- **Trigger:** CLIENT CEO initiates a new project discovery session.
- **Guard:** `users.subscription_client_tier = 'pro'` (Enforced via `SubscriptionGuard`).
- **DB Operation:**
  ```sql
  INSERT INTO elicitation_sessions
    (id, user_id, current_stage, state, created_at, updated_at)
  VALUES (gen_random_uuid(), ?, 1, 'IN_PROGRESS', now(), now());
  ```
- **Tables:** **`elicitation_sessions`** (C), **`users`** (R — guard)
- **Endpoint:** `POST /elicitation/sessions`

#### `IN_PROGRESS` (Internal Stage Progressions)

- **Stage 1 → Stage 2:** FastAPI LLM extraction (`POST /llm/elicitation/stage1-extract`) parses symptoms, scale signals, void codes, and required critical artifacts.
  ```sql
  UPDATE elicitation_sessions SET 
    current_stage = 2, 
    stage1_original_input = ?,
    stage1_symptoms_json = ?::jsonb,
    void_list_json = ?::jsonb,
    critical_artifacts_json = ?::jsonb,
    recommended_archetypes_json = ?::jsonb,
    estimated_budget_vnd = ?,
    updated_at = now() 
  WHERE id = ?;
  ```
- **Stage 2 → Stage 3:** Archetype locked. Void codes optionally acknowledged (`injected = true`).
  ```sql
  UPDATE elicitation_sessions SET 
    archetype = ?, 
    void_list_json = ?::jsonb,
    current_stage = 3, 
    updated_at = now() 
  WHERE id = ?;
  ```
- **Stage 3 → Stage 4:** Archetype-specific probe questions fetched from **`probe_questions`**. LLM evaluates answer vagueness and relevancy.
  ```sql
  UPDATE elicitation_sessions SET 
    current_stage = 4, 
    stage3_probes_json = ?::jsonb, 
    scenario_type = ?, -- 'SCENARIO_A' (self-technical) or 'SCENARIO_B' (tech handoff)
    updated_at = now() 
  WHERE id = ?;
  ```
- **Stage 4 Branching & Handoff:**
  - *Scenario A (Self-Technical)*: CEO completes tech context directly. Draft auto-saved via `PATCH /elicitation/sessions/:id/stage4-draft`.
  - *Scenario B (Tech Team Handoff)*: CEO issues a signed one-time JWT link (`POST /elicitation/sessions/:id/generate-handoff-link`). Tech Team completes technical inputs via `PUT /elicitation/sessions/:id/stage4-handoff`. Submit user ID stored internally as `_tech_team_user_id`.
- **Stage 4 → Stage 5:** Technical inputs committed, advancing session to Stage 5 synthesis.
  ```sql
  UPDATE elicitation_sessions SET 
    current_stage = 5, 
    stage4_tech_inputs_json = ?::jsonb, 
    stage4_draft_json = NULL,
    updated_at = now() 
  WHERE id = ?;
  ```

#### `IN_PROGRESS` → `COMPLETED`

- **Trigger:** Stage 5 AI synthesis (`POST /llm/elicitation/stage5-synthesize`) executes and all 3 quality gates pass:
  1. `completeness_score >= 0.70`
  2. No unresolved `HIGH` severity void codes (`severity = 'HIGH'` and `injected = false`)
  3. At least 1 qualified expert matches the required footprint on the platform
- **DB Operation (Atomic Transaction):**
  ```sql
  -- 1. Create published project specification
  INSERT INTO projects
    (id, client_id, elicitation_session_id, project_name, state, archetype, tier, self_technical,
     required_seams_json, required_domains_json, milestone_framework_json,
     artifact_a_json, artifact_b_json, estimated_total_cost_vnd, estimated_total_duration_days, created_at)
  VALUES (gen_random_uuid(), ?, ?, ?, 'PUBLISHED', ?, ?, ?,
          ?::jsonb, ?::jsonb, ?::jsonb,
          ?::jsonb, ?::jsonb, ?, ?, now());

  -- 2. Complete elicitation session
  UPDATE elicitation_sessions SET state = 'COMPLETED', updated_at = now() WHERE id = ?;

  -- 3. Link submitting Tech Team profile to project (if Scenario B)
  UPDATE tech_team_profiles SET linked_project_id = ? WHERE user_id = ?;

  -- 4. Log platform decision for audit
  INSERT INTO platform_decisions
    (id, decision_type, entity_type, entity_id, llm_confidence, decision, created_at)
  VALUES (gen_random_uuid(), 'ELICITATION_SYNTHESIS', 'projects', ?, ?, 'PUBLISHED', now());
  ```
- **Tables:** **`projects`** (C), `elicitation_sessions` (U), **`tech_team_profiles`** (U), **`platform_decisions`** (C)
- **Endpoint:** `POST /elicitation/sessions/:id/stage5`
- **Side Effect:** Fires internal `project.published` event → seeds candidate shortlist into **`project_shortlist_cache`** (`source = 'AUTO'`).

#### `IN_PROGRESS` → `RETURNED`

- **Trigger:** Stage 5 quality gate fails (`completeness_score < 0.70` OR unresolved `HIGH` severity void present OR 0 candidate matches).
- **DB Operation:**
  ```sql
  UPDATE elicitation_sessions SET 
    state = 'RETURNED', 
    current_stage = ?, -- mapped via void_code to original stage (e.g. 1, 3, or 4)
    updated_at = now() 
  WHERE id = ?;

  INSERT INTO platform_decisions
    (id, decision_type, entity_type, entity_id, llm_confidence, decision, advisory_note, created_at)
  VALUES (gen_random_uuid(), 'SPEC_AUTO_RETURN', 'elicitation_sessions', ?, ?, 'RETURNED', ?, now());
  ```
- **Tables:** `elicitation_sessions` (U), `platform_decisions` (C)
- **Note:** No `projects` row is created. `current_stage` is updated to the exact stage responsible for the missing information.

#### `RETURNED` → `IN_PROGRESS`

- **Trigger:** CEO re-enters session to revise missing information.
- **DB Operation:**
  ```sql
  UPDATE elicitation_sessions SET state = 'IN_PROGRESS', updated_at = now() WHERE id = ?;
  ```
- **Endpoint:** `PUT /elicitation/sessions/:id/continue` or `PUT /elicitation/sessions/:id/revert`

#### `IN_PROGRESS` → `ABANDONED`

- **Trigger:** CEO clicks "Start Over" or explicitly abandons an active session.
- **DB Operation:**
  ```sql
  UPDATE elicitation_sessions SET state = 'ABANDONED', updated_at = now() WHERE id = ?;
  ```
- **Endpoint:** `PUT /elicitation/sessions/:id/abandon`

---

## 2. Spec / Project States

### State-by-State Narration

```
[DRAFT] ──(Gate Pass)──► [PUBLISHED] ──(Admin Suspend)──► [SUSPENDED]
   │                         ▲                                 │
   │ (Gate Fail)             └────────(Admin Reopen)───────────┘
   ▼
[RETURNED_TO_CLIENT]
```

#### `DRAFT`

- Virtual state representing an active `elicitation_session`. No `projects` table row exists while in draft.

#### `PUBLISHED`

- **Trigger:** Stage 5 synthesis quality gate passes.
- **DB Operation:** `projects.state = 'PUBLISHED'`.
- **Visibility:** Visible in Project Marketplace (`GET /projects/marketplace`) and accessible to matched shortlisted experts.

#### `RETURNED_TO_CLIENT`

- **Trigger:** Elicitation quality gate failure. Session reverts to `RETURNED` state; project creation is aborted.

#### `PUBLISHED` → `SUSPENDED`

- **Trigger:** Platform Administrator executes emergency pull-back due to policy violation or security audit.
- **DB Operation (Atomic Transaction):**
  ```sql
  UPDATE projects SET state = 'SUSPENDED' WHERE id = ?;

  INSERT INTO platform_decisions
    (id, decision_type, entity_type, entity_id, decision, advisory_note, created_at)
  VALUES (gen_random_uuid(), 'SPEC_AUTO_RETURN', 'projects', ?, 'SUSPENDED', 'Admin suspension', now());
  ```
- **Endpoint:** `PUT /admin/projects/:id/suspend-spec`

#### `SUSPENDED` → `PUBLISHED`

- **Trigger:** Admin clears project for publication after compliance review.
- **DB Operation:**
  ```sql
  UPDATE projects SET state = 'PUBLISHED' WHERE id = ?;
  ```
- **Endpoint:** `PUT /admin/projects/:id/reopen`

---

## 3. Capability Bid States & Negotiation Envelope

### Bid State Machine

```
[DRAFT] ──► [SUBMITTED] ──► [TECH_REVIEW] ──(Approved)──────► [TECH_APPROVED]
                │                 │                               │
                │        (Revision Requested)                     ▼
                │                 │                         [CEO_REVIEW]
                │                 ▼                               │
                │       [REVISION_REQUESTED]                      ▼
                │                 │                         [SELECTED]
                └─────────────────┴───────────────────────────────┤
                                                                  ├─► [DECLINED]
                                                                  └─► [WITHDRAWN]
```

#### `[*]` → `DRAFT` / `SUBMITTED`

- **Trigger:** Shortlisted Expert submits a capability proposal (`POST /bids`).
- **Guards:**
  - Expert must appear in `project_shortlist_cache.results_json`.
  - For Tier 2/3 projects, expert must hold `subscription_expert_tier = 'pro'`.
  - Expert cannot bid on own project.
- **DB Operation (Serializable Transaction with up to 3 retries):**
  ```sql
  -- 1. Create parent engagement in PENDING state
  INSERT INTO engagements
    (id, project_id, expert_id, client_id, service_id, type, state)
  VALUES (gen_random_uuid(), ?, ?, ?, NULL, 'PROJECT_BASED', 'PENDING');

  -- 2. Create capability bid with negotiation envelope (v1)
  INSERT INTO capability_bids
    (id, engagement_id, footprint_alignment_json, approach_summary, conditional_pricing_json,
     state, tech_status, ceo_status, negotiated_price_vnd, version_number)
  VALUES (gen_random_uuid(), ?, ?::jsonb, ?, ?::jsonb,
          'SUBMITTED', ?, 'PENDING', ?, 1);
  -- tech_status = 'PENDING' (if non-self-technical) or 'APPROVED' (if self-technical)
  -- state = 'TECH_REVIEW' (if non-self-technical) or 'SUBMITTED' (if self-technical)
  ```
- **Tables:** **`engagements`** (C), **`capability_bids`** (C), **`invitations`** (U — marks matching invitation as `ACCEPTED`)
- **Endpoint:** `POST /bids`

#### `TECH_REVIEW` → `REVISION_REQUESTED`

- **Trigger:** Tech Team requests technical scope revision (`PUT /bids/:id/tech-review` with `action = 'REVISION_REQUESTED'`).
- **DB Operation:**
  ```sql
  UPDATE capability_bids SET
    tech_status = 'REVISION_REQUESTED',
    tech_feedback = ?,
    state = 'REVISION_REQUESTED',
    conditional_pricing_json = jsonb_set(conditional_pricing_json, '{technicalReview,status}', '"REVISION_REQUESTED"')
  WHERE id = ?;
  ```

#### `REVISION_REQUESTED` → `TECH_REVIEW` (Offer Round Revision)

- **Trigger:** Proposer submits revised scope (`POST /bids/:id/offers` or `PUT /bids/:id`).
- **DB Operation:**
  ```sql
  UPDATE capability_bids SET
    conditional_pricing_json = ?::jsonb, -- appended new offer object to envelope
    version_number = version_number + 1,
    negotiated_price_vnd = ?,
    tech_status = 'PENDING',
    tech_feedback = NULL,
    state = 'TECH_REVIEW'
  WHERE id = ?;
  ```

#### `TECH_REVIEW` → `TECH_APPROVED` → `CEO_REVIEW`

- **Trigger:** Tech Team approves technical scope (`action = 'APPROVED'`).
- **DB Operation:**
  ```sql
  UPDATE capability_bids SET
    tech_status = 'APPROVED',
    state = 'SUBMITTED',
    conditional_pricing_json = jsonb_set(conditional_pricing_json, '{technicalReview,status}', '"APPROVED"')
  WHERE id = ?;
  ```

#### `CEO_REVIEW` → `SELECTED`

- **Trigger:** CEO accepts offer (`POST /bids/:id/offers/:offerId/accept` or `PUT /bids/:id/ceo-decision` with `decision = 'APPROVED'`).
- **DB Operation (Serializable Atomic Transaction):**
  ```sql
  -- 1. Lock terms on bid
  UPDATE capability_bids SET
    state = 'SELECTED',
    ceo_status = 'APPROVED',
    negotiated_price_vnd = ?,
    conditional_pricing_json = ?::jsonb -- offer state = 'ACCEPTED', acceptedOfferId set
  WHERE id = ?;

  -- 2. Instantiate real milestones from accepted offer terms
  INSERT INTO milestones
    (id, engagement_id, milestone_number, deliverable_statement, sign_off_authority,
     payment_amount_vnd, estimated_cost_vnd, estimated_duration_days, tech_stack_json, state)
  VALUES (gen_random_uuid(), ?, ?, ?, ?, ?, ?, ?, ?::jsonb, 'DEFINED');

  -- 3. Instantiate acceptance criteria per milestone
  INSERT INTO acceptance_criteria
    (id, milestone_id, criterion_text, is_required, verified_by_role)
  VALUES (gen_random_uuid(), ?, ?, ?, ?);

  -- 4. Decline competing bids and engagements for same project
  UPDATE capability_bids SET state = 'DECLINED', ceo_status = 'DECLINED'
  WHERE id != ? AND engagement_id IN (SELECT id FROM engagements WHERE project_id = ?);

  UPDATE engagements SET state = 'DECLINED'
  WHERE project_id = ? AND id != ?;
  ```

#### `SUBMITTED` / `TECH_REVIEW` → `WITHDRAWN`

- **Trigger:** Expert withdraws bid (`DELETE /bids/:id`).
- **DB Operation:**
  ```sql
  UPDATE capability_bids SET state = 'WITHDRAWN' WHERE id = ?;
  UPDATE engagements SET state = 'DECLINED' WHERE id = engagement_id;
  ```

---

## 4. Engagement States & Path Discriminators

### Engagement Path Discriminators

| Type | Discriminator Value | `project_id` | `service_id` | Bid Required? | Milestone Source |
|---|---|:---:|:---:|:---:|---|
| **Path A** | `PROJECT_BASED` | **NOT NULL** | **NULL** | Yes | Instantiated from accepted bid terms |
| **Path B** | `SERVICE_PURCHASE` | **NULL** (or shadow) | **NOT NULL** | No | Auto-created milestone #1 from service |
| **Path C** | `TECH_DISCOVERY` | **NULL** (or shadow) | **NOT NULL** | No | Auto-created milestone #1 from service |

### State-by-State Narration

```
[PENDING] ──(Both NDAs Accepted)──► [CONNECTED] ──(First Milestone Funded)──► [ACTIVE]
    │                                                                           │
    ├──(Declined / Withdrawn)                                                   ├─► [DISPUTED]
    │        │                                                                  │
    ▼        ▼                                                                  ▼
 [DECLINED] [CANCELLED]                                                      [CLOSED]
```

#### `PENDING` → `CONNECTED`

- **Trigger:** Both CEO (`PUT /engagements/:id/accept-nda`) and Expert (`POST /engagements/:id/connect`) complete NDA click-through signatures.
- **DB Operation:**
  ```sql
  UPDATE engagements SET
    client_nda_accepted_at = now() -- set when CEO signs
  WHERE id = ?;

  UPDATE engagements SET
    expert_nda_accepted_at = now(),
    state = 'CONNECTED',
    connected_at = now()
  WHERE id = ? AND client_nda_accepted_at IS NOT NULL;
  ```

#### `CONNECTED` → `ACTIVE`

- **Trigger:** First milestone funded via SePay IPN callback (`handleMilestoneTopup` or `handleServiceTopup`).
- **DB Operation:**
  ```sql
  UPDATE engagements SET state = 'ACTIVE' WHERE id = ?;
  ```

#### `ACTIVE` ↔ `DISPUTED`

- **Trigger (to DISPUTED):** Any party files a dispute against an unverified milestone criterion (`POST /disputes`).
- **Trigger (back to ACTIVE):** Dispute resolved (via AI auto-resolution or Admin manual decision) and remaining milestones exist.

#### `ACTIVE` → `CLOSED`

- **Trigger:** Final milestone approved/released (`milestones.state = 'RELEASED'`) and no unreleased milestones remain.
- **DB Operation:**
  ```sql
  UPDATE engagements SET state = 'CLOSED' WHERE id = ?;
  ```
- **Side Effect:** Unlocks post-engagement review submissions (`POST /reviews`).

#### `PENDING` / `CONNECTED` / `ACTIVE` → `CANCELLED`

- **Trigger:** Party requests cancellation (`PUT /engagements/:id/cancel`).
- **Guard:** Zero milestones in `FUNDED`, `SUBMITTED`, or `IN_REVISION` state.
- **DB Operation:**
  ```sql
  UPDATE engagements SET state = 'CANCELLED' WHERE id = ?;
  ```

---

## 5. Milestone States

### State-by-State Narration

```
[DEFINED] ──► [AWAITING_PAYMENT] ──(SePay IPN)──► [FUNDED] ──(Auto)──► [IN_PROGRESS]
                                                                          │
                                                                  (Submit Deliverable)
                                                                          │
[APPROVED] ◄──(Sign-off Complete)── [SUBMITTED] ◄─────────────────────────┘
    │                                  │
[RELEASED]                    (Request Revision) ──► [IN_REVISION] ──(Resubmit)──► [SUBMITTED]
                                       │
                              (Dispute Filed) ──► [DISPUTED]
```

#### `DEFINED` → `AWAITING_PAYMENT`

- **Trigger:** CEO clicks "Fund Milestone" (`PUT /milestones/:id/fund`).
- **DB Operation:**
  ```sql
  INSERT INTO virtual_accounts
    (id, entity_type, entity_id, va_number, fixed_amount, expires_at, status)
  VALUES (gen_random_uuid(), 'MILESTONE', ?, ?, now() + interval '24 hours', 'ACTIVE');

  UPDATE milestones SET
    state = 'AWAITING_PAYMENT',
    va_number = ?,
    va_expires_at = now() + interval '24 hours'
  WHERE id = ?;
  ```

#### `AWAITING_PAYMENT` → `FUNDED` → `IN_PROGRESS`

- **Trigger:** SePay IPN webhook confirms exact bank transfer amount (`/webhooks/sepay/ipn`).
- **DB Operation (Atomic Ledger Transaction):**
  ```sql
  -- 1. Deduct spendable, increment escrow locked
  UPDATE wallets SET
    available_balance = available_balance - ?,
    locked_balance = locked_balance + ?
  WHERE id = client_wallet_id;

  -- 2. Write ESCROW_LOCK transaction log
  INSERT INTO wallet_transactions
    (id, wallet_id, amount, transaction_type, reference_id, created_at)
  VALUES (gen_random_uuid(), client_wallet_id, ?, 'ESCROW_LOCK', ?, now());

  -- 3. Create HELD escrow account
  INSERT INTO escrow_accounts
    (id, milestone_id, engagement_id, amount, client_wallet_id, expert_wallet_id, status, held_at)
  VALUES (gen_random_uuid(), ?, NULL, ?, client_wallet_id, expert_wallet_id, 'HELD', now());

  -- 4. Update milestone state
  UPDATE milestones SET state = 'IN_PROGRESS', funded_at = now() WHERE id = ?;

  -- 5. Consume Virtual Account
  UPDATE virtual_accounts SET status = 'USED' WHERE id = ?;

  -- 6. Bulk-release staged pay-gated documents
  UPDATE paygated_documents SET release_state = 'RELEASED', released_at = now() WHERE milestone_id = ?;

  -- 7. Activate engagement if first funded milestone
  UPDATE engagements SET state = 'ACTIVE' WHERE id = ? AND state = 'CONNECTED';
  ```
- **[LEDGER]:** `ESCROW_LOCK`

#### `IN_PROGRESS` / `IN_REVISION` → `SUBMITTED`

- **Trigger:** Expert submits completed deliverable (`POST /milestones/:id/submit`).
- **Guard (DoD Gate):**
  ```sql
  SELECT COUNT(*) FROM milestone_dod_items
  WHERE milestone_id = ? AND is_required = true AND status != 'COMPLETED';
  -- IF > 0 → REJECT WITH 422 REQUIRED_DOD_INCOMPLETE
  ```
- **DB Operation:**
  ```sql
  INSERT INTO milestone_submissions
    (id, milestone_id, expert_id, description, files_json, submitted_at)
  VALUES (gen_random_uuid(), ?, ?, ?, ?::jsonb, now());

  UPDATE milestones SET state = 'SUBMITTED', submitted_at = now() WHERE id = ?;
  ```

#### `SUBMITTED` → `IN_REVISION`

- **Trigger:** Reviewer requests criterion revision (`PUT /criteria/:id/revision`).
- **DB Operation:**
  ```sql
  UPDATE acceptance_criteria SET
    revision_note = ?,
    revision_requested_by_role = ?,
    verified_at = NULL,
    ceo_verified_at = NULL,
    tech_verified_at = NULL
  WHERE id = ?;

  UPDATE milestones SET state = 'IN_REVISION' WHERE id = ?;
  ```

#### `SUBMITTED` → `IN_PROGRESS` (Retraction)

- **Trigger:** Expert retracts latest submission before review (`DELETE /milestones/:id/submissions/latest`).
- **DB Operation:**
  ```sql
  DELETE FROM milestone_submissions WHERE id = latest_submission_id;
  UPDATE milestones SET state = 'IN_PROGRESS', submitted_at = NULL WHERE id = ?;
  ```

#### `SUBMITTED` → `APPROVED` → `RELEASED` (Happy Path Release)

- **Trigger:** All required acceptance criteria verified (`techVerifiedAt` and `ceoVerifiedAt` set per `signOffAuthority`) and no active disputes exist.
- **DB Operation (Atomic Ledger Release):**
  ```sql
  -- 1. Fetch dynamic platform fee percentage
  SELECT platform_fee_pct, platform_wallet_id INTO fee_pct, p_wallet_id FROM platform_settings LIMIT 1;
  fee_amount := round(payment_amount * fee_pct);
  expert_amount := payment_amount - fee_amount;

  -- 2. Release locked balance from Client Wallet
  UPDATE wallets SET locked_balance = locked_balance - payment_amount WHERE id = client_wallet_id;

  -- 3. Credit platform fee to Platform Wallet
  UPDATE wallets SET available_balance = available_balance + fee_amount WHERE id = p_wallet_id;

  -- 4. Credit net payout to Expert Wallet
  UPDATE wallets SET available_balance = available_balance + expert_amount WHERE id = expert_wallet_id;

  -- 5. Record 3 immutable transaction log entries
  INSERT INTO wallet_transactions (id, wallet_id, amount, transaction_type, reference_id, created_at) VALUES
    (gen_random_uuid(), client_wallet_id, payment_amount, 'ESCROW_RELEASE', 'REL-C:' || milestone_id, now()),
    (gen_random_uuid(), p_wallet_id, fee_amount, 'PLATFORM_FEE', 'FEE:' || milestone_id, now()),
    (gen_random_uuid(), expert_wallet_id, expert_amount, 'ESCROW_RELEASE', 'REL-E:' || milestone_id, now());

  -- 6. Update escrow and milestone states
  UPDATE escrow_accounts SET status = 'RELEASED', released_at = now() WHERE milestone_id = ?;
  UPDATE milestones SET state = 'APPROVED', approved_at = now() WHERE id = ?;

  -- 7. Auto-Withdrawal if Expert Bank Account Linked
  IF expert_bank_xid IS NOT NULL THEN
    INSERT INTO withdrawal_requests
      (id, expert_id, milestone_id, type, amount, bank_account_xid, status, requested_at)
    VALUES (gen_random_uuid(), expert_id, milestone_id, 'MILESTONE_RELEASE', expert_amount, expert_bank_xid, 'PENDING', now());

    UPDATE wallets SET available_balance = available_balance - expert_amount WHERE id = expert_wallet_id;

    INSERT INTO wallet_transactions (id, wallet_id, amount, transaction_type, reference_id, created_at)
    VALUES (gen_random_uuid(), expert_wallet_id, expert_amount, 'WITHDRAWAL', 'WD:' || withdrawal_id, now());
  END IF;
  ```
- **[LEDGER]:** `ESCROW_RELEASE` (Client), `PLATFORM_FEE` (Platform), `ESCROW_RELEASE` (Expert), `WITHDRAWAL` (Expert if bank linked).

---

## 6. Acceptance Criterion Verification

### State Transitions

```
[UNVERIFIED] ──(Verify as TECH_TEAM)──► [TECH_VERIFIED] ──(Verify as CEO)──► [VERIFIED]
     │                                                                           ▲
     ├──(Verify as CEO when self_technical)──────────────────────────────────────┘
     │
     └──(Request Revision)─────────────► [REVISION_REQUESTED]
```

#### Verification Flow Logic
- **`JOINT` Authority**:
  1. Tech Team signs off (`PUT /criteria/:id/verify` as `TECH_TEAM`) → `techVerifiedAt = now()`.
  2. CEO signs off (`PUT /criteria/:id/verify` as `CEO`) → `ceoVerifiedAt = now()`, `verifiedAt = now()`.
- **`CEO` Authority (Self-Technical)**: CEO signs off directly → `ceoVerifiedAt = now()`, `verifiedAt = now()`.
- **Quality Gate Check**: On creation (`POST /criteria/:milestoneId`), asynchronously calls FastAPI `/llm/criterion-check`. If subjective language detected, logs advisory `CRITERION_QUALITY_GATE` entry in `platform_decisions`.

---

## 7. DoD Checklist Item States

### State Transitions

```
[PENDING] ──(Expert Check + Note)──────► [COMPLETED]
    │
    └──(Mark N/A + Note)──────────────► [NOT_APPLICABLE]
```

- **Database Check Constraint:**
  ```sql
  CONSTRAINT dod_required_cannot_be_na
    CHECK (NOT (is_required = TRUE AND status = 'NOT_APPLICABLE'))
  ```
- **Submission Gate:** `POST /milestones/:id/submit` validates that all required items (`is_required = true`) have `status = 'COMPLETED'`.

---

## 8. Pay-Gated Document States

### State Transitions

```
[STAGED] ──(Milestone Escrow Funded)──► [RELEASED]
```

- **Staging**: Expert uploads document URLs (`POST /milestones/:id/paygated-docs`). Set to `STAGED` if milestone is in `DEFINED` or `AWAITING_PAYMENT`.
- **Release**: Automatically transitioned to `RELEASED` inside the SePay IPN milestone funding transaction.
- **Route Access Guard**: `GET /milestones/:id/paygated-docs` permits access only to Expert, linked Tech Team, or Admin. CEOs are blocked from staged documents.

---

## 9. Escrow Account & Dispute Resolution (2-Layer)

### State Machines

#### Escrow Account States
```
[HELD] ──(Dispute Filed)──► [FROZEN] ──(EXPERT_WINS)──► [RELEASED]
                               │ ──(CLIENT_WINS)──► [REFUNDED]
                               └────(SPLIT)───────► [SPLIT]
```

#### Dispute State Machine
```
[PENDING] ──► [LAYER_1_EVAL] ──(LLM Conf ≥ 0.80)──► [AUTO_RESOLVED]
                   │
            (LLM Conf < 0.80)
                   │
                   ▼
            [MANUAL_REVIEW] ──(Admin Decision)──► [RESOLVED]
```

#### Dispute Filing (`POST /disputes`)
- **Guard:** Milestone must be in `SUBMITTED` or `IN_REVISION`; criterion `verifiedAt IS NULL`; escrow status = `HELD`.
- **DB Operation:**
  ```sql
  INSERT INTO disputes
    (id, engagement_id, milestone_id, criterion_id, escrow_account_id, filed_by, state, filed_at)
  VALUES (gen_random_uuid(), ?, ?, ?, ?, ?, 'LAYER_1_EVAL', now());

  UPDATE escrow_accounts SET status = 'FROZEN' WHERE id = ?;
  UPDATE milestones SET state = 'DISPUTED' WHERE id = ?;
  ```

#### Layer 1 AI Evaluation (`POST /llm/dispute-eval`)
- Calls FastAPI with criterion text, deliverable description, submitted files, and revision count.
- **If Confidence Score ≥ 0.80 (`AUTO_RESOLVED`)**:
  - `EXPERT_WINS`: Disputed criterion marked verified; escrow `status = 'HELD'`. Auto-approves milestone if all criteria met.
  - `CLIENT_WINS`: Escrow `status = 'REFUNDED'`, client `lockedBalance -= amount`, `availableBalance += amount`.
  - `SPLIT`: Escrow `status = 'SPLIT'`, client receives `floor(amount / 2)`, expert receives remainder.
- **If Confidence Score < 0.80 (`MANUAL_REVIEW`)**:
  - Dispute state updated to `MANUAL_REVIEW`. Escrow remains `FROZEN`. Routed to Admin Dispute Monitor.

#### Manual Admin Resolution (`PUT /admin/disputes/:id/resolve`)
- Admin selects `EXPERT_WINS`, `CLIENT_WINS`, or `SPLIT`. Executes corresponding ledger transaction and logs `DISPUTE_L1_EVAL` in `platform_decisions`.

---

## 10. Virtual Account States

### State Transitions

```
[ACTIVE] ──(IPN Payment Confirmed)──► [USED]
    │
    └──(Expired / Replaced)──────────► [EXPIRED]
```

- **`WALLET_TOPUP`**: Permanent, unexpiring VA assigned to user upon registration.
- **`MILESTONE` / `SERVICE`**: Fixed-amount VA with 24-hour expiry window.
- **Expiry Enforcement**: If IPN arrives after `expires_at`, handler sets status = `EXPIRED` and rejects transaction.

---

## 11. Wallet Transaction Types & Internal Ledger Flow

```
1. TOP_UP (Inbound Bank Transfer)
   SePay IPN → wallets.available_balance += amount → [TOP_UP]

2. SUBSCRIPTION (Pro Tier Purchase)
   wallets.available_balance -= package_price → [SUBSCRIPTION] → users.sub_*_tier = 'pro'

3. ESCROW_LOCK (Milestone Funding)
   wallets.available_balance -= amount → wallets.locked_balance += amount → [ESCROW_LOCK]

4. ESCROW_RELEASE (Milestone Approval)
   wallets.locked_balance -= total_amount
   platform_wallet.available_balance += platform_fee
   expert_wallet.available_balance += net_payout
   → [ESCROW_RELEASE], [PLATFORM_FEE], [ESCROW_RELEASE]

5. ESCROW_REFUND (Client Wins Dispute)
   wallets.locked_balance -= amount → wallets.available_balance += amount → [ESCROW_REFUND]

6. ESCROW_SPLIT (50/50 Settlement)
   wallets.locked_balance -= total_amount
   client_wallet.available_balance += floor(total / 2)
   expert_wallet.available_balance += total - floor(total / 2)
   → [ESCROW_SPLIT], [ESCROW_SPLIT]

7. WITHDRAWAL (Expert Cash-Out Request)
   wallets.available_balance -= amount → [WITHDRAWAL] → withdrawal_requests status = 'PENDING'

8. WITHDRAWAL_REFUND (Withdrawal Failed or Cancelled)
   wallets.available_balance += amount → [WITHDRAWAL_REFUND] → withdrawal_requests status = 'FAILED'/'CANCELLED'
```

---

## 12. Withdrawal Request States

### State Transitions

```
[PENDING] ──(Admin Confirms Disbursement)─► [COMPLETED]
    │
    ├──(Admin Rejects / Failed Bank)──────► [FAILED] (Restores Wallet Balance)
    │
    └──(Expert Cancels Prior to Admin)────► [CANCELLED] (Restores Wallet Balance)
```

- **Creation (`POST /withdrawals`)**: Debits `wallets.available_balance` immediately, writes `WITHDRAWAL` transaction log, inserts `withdrawal_requests` row in `PENDING` status.
- **Completion (`PUT /admin/withdrawals/:id/complete`)**: Admin confirms external transfer. Status updated to `COMPLETED`. If linked to a milestone release, milestone state advances to `RELEASED`.
- **Failure / Cancellation (`PUT /admin/withdrawals/:id/fail` or `DELETE /withdrawals/:id`)**: Atomic reversal: credits `available_balance += amount`, writes `WITHDRAWAL_REFUND` transaction log, sets status to `FAILED` or `CANCELLED`.

---

## 13. Subscription States

### State Transitions

```
[free] ──(Activate Pro via Wallet)──► [pro] ──(Expires)──► [free]
```

- **Activation (`POST /subscriptions/activate`)**: Validates active role, checks package availability and wallet balance (`available_balance >= package.price_vnd`). Debits wallet, writes `SUBSCRIPTION` transaction log, logs `subscription_purchase_logs`, sets `users.subscription_{role}_tier = 'pro'`, calculates `expiresAt = now() + durationMonths`, and re-issues JWT with updated tier claim.
- **Query-Time Expiry**: `GET /subscriptions/status` compares `sub_*_expires_at` against `now()`. If expired, returns `tier = 'free'` and `isExpired = true` without modifying DB row.

---

## 14. Service Listing States

### State Transitions

```
[DRAFT] ──(Publish)──► [PUBLISHED] ──(Admin / Expert Unpublish)──► [SUSPENDED] / [DRAFT]
```

- **Creation (`POST /services`)**: Expert creates listing in `DRAFT` state. Optional AI generator (`POST /llm/service-generate`) requires Expert Pro subscription.
- **Publication (`PUT /services/:id/publish`)**: Sets `state = 'PUBLISHED'`. Visible on marketplace.
- **Unpublication (`PUT /services/:id/unpublish`)**: Sets `state = 'DRAFT'`. Removed from public catalogue.

---

## 15. Portfolio Submission & Seam Verification States

### State Transitions

```
[PENDING] ──(LLM Score ≥ 0.85)──► [APPROVED] ──► expert_seam_claims.verification_tier = 'EVIDENCE_BACKED'
    │
    └──(LLM Score < 0.85)──► [REJECTED] ──► Increment submissionCount (Lockout at 5)
```

- **Submission (`POST /portfolio-submissions`)**: Requires Expert Pro subscription. Accepts project description and decision points. Calls FastAPI `/llm/portfolio-eval`.
- **Approval**: Sets `status = 'APPROVED'`, upgrades parent claim `verification_tier = 'EVIDENCE_BACKED'`, logs `SEAM_TIER_UPGRADE` in `platform_decisions`.
- **Rejection**: Sets `status = 'REJECTED'`, increments `expert_seam_claims.submissionCount`. If count reaches 5, sets `lockedUntil = now() + 30 days`.

---

## 16. Invitation States

### State Transitions

```
[PENDING] ──(Expert Submits Bid)──────► [ACCEPTED]
    │
    ├──(Expert Declines)──────────────► [DECLINED]
    │
    └──(Query Time Expiry > 7 Days)───► [EXPIRED]
```

- **Creation**: CEO invites shortlisted Expert (`inviteExpert` socket event). Unique constraint on `(project_id, expert_id)` upserts existing invitations.
- **Expiration**: Enforced dynamically at query time when `expires_at < now()`.

---

## 17. Platform Decision Audit Log Types

Logged in `platform_decisions` table:

1. **`ELICITATION_SYNTHESIS`**: Stage 5 project specification generation and quality gate results.
2. **`SPEC_AUTO_RETURN`**: Quality gate failure return or administrative spec suspension.
3. **`SEAM_TIER_UPGRADE`**: Expert seam claim verification tier upgrade to `EVIDENCE_BACKED`.
4. **`PORTFOLIO_EVAL`**: Rejection or detailed scoring log for portfolio evidence.
5. **`DISPUTE_L1_EVAL`**: Layer 1 AI arbitration evaluation result, confidence score, and reasoning.
6. **`CRITERION_QUALITY_GATE`**: Subjectivity check advisory feedback on acceptance criteria.

---

## 18. Cross-Table CRUD Dependency Map (40 Tables)

```
1.  users                                   [Central Identity & Role Cursor]
      ├──(1:1)──► client_profiles           [CEO Company Information]
      ├──(1:1)──► expert_profiles           [Expert Bio & Stack Tags]
      ├──(1:1)──► tech_team_profiles        [Tech Lead Client/Project Linkage]
      ├──(1:1)──► wallets                   [Available & Locked Balance]
      └──(1:N)──► notifications             [System, Bid, & Milestone Push Alerts]

2.  wallets                                 
      └──(1:N)──► wallet_transactions       [Immutable Ledger Audit Trail]

3.  virtual_accounts                        [SePay Inbound Collection VAs]

4.  withdrawal_requests                     [Expert Payout Requests]

5.  platform_settings                       [Singleton Platform Fee & Wallet Ref]

6.  elicitation_sessions                    [5-Stage Discovery State & Payloads]

7.  projects                                [Published Project Specs & Artifacts]
      ├──(1:1)──► project_shortlist_cache   [Cached AI Match Scoring Results]
      └──(1:N)──► milestone_chat_sessions   [AI Planning Assistant Conversations]

8.  services                                [Expert Marketplace Packages]

9.  expert_domain_depths                    [Domain Proficiency Declarations]

10. expert_seam_claims                      [Cross-Domain Seam Capabilities]
      └──(1:N)──► portfolio_submissions     [AI-Evaluated Portfolio Evidence]

11. engagements                             [Client-Expert Contracts]
      ├──(1:1)──► capability_bids           [Proposal & Negotiation Envelope]
      ├──(1:N)──► milestones                [Contract Delivery Units]
      │             ├──(1:N)──► acceptance_criteria   [Layer 1 Measurable Criteria]
      │             ├──(1:N)──► milestone_dod_items   [Layer 2 DoD Checklist Items]
      │             ├──(1:N)──► milestone_submissions [Expert Deliverable Submissions]
      │             └──(1:N)──► paygated_documents    [Escrow-Gated Deliverable Assets]
      ├──(1:1)──► escrow_accounts           [Held & Frozen Funds]
      ├──(1:N)──► disputes                  [Layer 1 AI & Admin Arbitration]
      ├──(1:N)──► messages                  [In-Platform Chat & Attachments]
      │             └──(1:N)──► message_reads         [Read Receipt Timestamps]
      └──(1:N)──► reviews                   [Post-Closure Peer Reviews]

12. CMS Configuration Tables (Standalone Registry)
      ├── domain_definitions                [AI Domain Registry (A–F)]
      ├── seam_definitions                  [Cross-Domain Seam Registry]
      ├── archetype_definitions             [Project Archetype Categories]
      ├── probe_questions                   [Stage 3 Behavioral Questions]
      ├── void_code_definitions             [Gap Taxonomy & Severity Mapping]
      ├── prompt_templates                  [Hot-Reloadable Jinja2 Prompts]
      ├── subscription_packages             [Client & Expert Pro Pricing]
      └── subscription_purchase_logs        [Subscription Payment History]

13. platform_decisions                      [Polymorphic AI Evaluation Audit Log]
14. invitations                             [CEO Direct Project Bidding Invites]
```