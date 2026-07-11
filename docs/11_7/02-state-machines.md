# AITasker — State Machine Reference Document
### Full-Fat Architecture · 40 Tables · Cross-Table CRUD Grounding

> **Purpose:** Definitive state machine reference for teacher assessment. Every state transition is grounded to exact table columns, CHECK constraints, ledger operations, and NestJS endpoints.  
> **Last updated:** Latest BE Codebase  
> **Conventions:** `[LEDGER]` = `wallet_transactions` row written. Tables in **bold** on first reference. §0.x = Master Reference Sheet section.

---

## Table of Contents

1. [Elicitation Session States](#1-elicitation-session-states)
2. [Spec / Project States](#2-spec--project-states)
3. [Bid States (Simplified Mutable-Row)](#3-bid-states-simplified-mutable-row)
4. [Engagement States](#4-engagement-states)
5. [Engagement Type (Immutable Discriminator)](#5-engagement-type-immutable-discriminator)
6. [Milestone States](#6-milestone-states)
7. [Acceptance Criterion Verification](#7-acceptance-criterion-verification)
8. [DoD Checklist Item States](#8-dod-checklist-item-states)
9. [Pay-Gated Document States](#9-pay-gated-document-states)
10. [Dispute Resolution (2-Layer)](#10-dispute-resolution-2-layer)
11. [Wallet Transaction Types (Internal Ledger Flow)](#11-wallet-transaction-types-internal-ledger-flow)
12. [Withdrawal States](#12-withdrawal-states)
13. [Subscription States](#13-subscription-states)
14. [Cross-Table CRUD Dependency Map (40 Tables)](#14-cross-table-crud-dependency-map-40-tables)

---

## 1. Elicitation Session States

### Master Reference

- **§0.1 Domains:** CMS-driven `domain_definitions` — drives the 5-stage conversational diagnostic.
- **§0.3 Archetypes:** CMS-driven `archetype_definitions`; locked into `elicitation_sessions.archetype` in Stage 2.
- **§0.3 Tiers:** Determined in Stage 5 from scale signals; locked into `projects.tier`.
- **§0.6 Spec states:** Elicitation output determines whether project reaches `PUBLISHED` or `RETURNED_TO_CLIENT`.

### State-by-State Narration

#### `[*]` → `IN_PROGRESS`

- **Trigger:** CEO clicks "Start New AI Project"
- **Guard:** `SELECT subscription_client_tier FROM users WHERE id = ?` → must be `'pro'` (§0.9 Feature Gate)
- **DB Operation:**
  ```sql
  INSERT INTO elicitation_sessions
    (user_id, current_stage, state, created_at, updated_at)
  VALUES (?, 1, 'IN_PROGRESS', now(), now());
  ```
- **Tables:** `elicitation_sessions` (C), `users` (R — guard)
- **Endpoint:** `POST /elicitation/sessions/start`

#### `IN_PROGRESS` (internal stage advances)

- **Stage 1→2:** FastAPI LLM extraction (`POST /llm/elicitation/stage1-extract`) updates `void_list_json` and `critical_artifacts_json`.
  ```sql
  UPDATE elicitation_sessions SET 
    current_stage = 2, 
    stage1_original_input = ?,
    stage1_symptoms_json = ?::jsonb,
    void_list_json = ?::jsonb,
    critical_artifacts_json = ?::jsonb,
    recommended_archetypes_json = ?::jsonb,
    estimated_budget_vnd = ?,
    updated_at = now() WHERE id = ?;
  ```
- **Stage 2→3:** Archetype locked. CMS archetypes fetched from `archetype_definitions`. Void codes acknowledged.
  ```sql
  UPDATE elicitation_sessions SET archetype = ?, current_stage = 3, updated_at = now() WHERE id = ?;
  ```
- **Stage 3→4:** Probes from `probe_questions` table. LLM evaluates vagueness/irrelevancy.
  ```sql
  UPDATE elicitation_sessions SET current_stage = 4, stage3_probes_json = ?::jsonb, updated_at = now() WHERE id = ?;
  ```
- **Stage 4 branching:**
  - CEO Self-Technical: `selfTechnical = true` → skips tech team handoff.
  - Standard (TECH_TEAM handoff): Handoff token generated, Tech Team invited.
- **Stage 4→5:** Draft auto-saved to `stage4_draft_json`. On submit, tech inputs captured.
  ```sql
  UPDATE elicitation_sessions SET current_stage = 5, stage4_tech_inputs_json = ?::jsonb, updated_at = now() WHERE id = ?;
  ```

#### `IN_PROGRESS` → `COMPLETED`

- **Trigger:** Stage 5 synthesis succeeds AND `completeness_score >= 0.70`
- **DB Operation (atomic transaction):**
  ```sql
  -- Create project with all JSONB footprint columns
  INSERT INTO projects
    (client_id, elicitation_session_id, state, archetype, tier, self_technical,
     required_seams_json, required_domains_json, milestone_framework_json,
     artifact_a_json, artifact_b_json, estimated_total_cost_vnd, estimated_total_duration_days, created_at)
  VALUES (?, ?, 'PUBLISHED', ?, ?, ?,
          ?::jsonb, ?::jsonb, ?::jsonb,
          ?::jsonb, ?::jsonb, ?, ?, now());

  -- Close elicitation session
  UPDATE elicitation_sessions SET state = 'COMPLETED', updated_at = now() WHERE id = ?;

  -- Log platform decision
  INSERT INTO platform_decisions
    (decision_type, entity_type, entity_id, llm_confidence, decision, created_at)
  VALUES ('ELICITATION_SYNTHESIS', 'elicitation_sessions', ?, ?, 'PASSED_ALL_GATES', now());
  ```
- **Tables:** `projects` (C), `elicitation_sessions` (U), `platform_decisions` (C)
- **Endpoint:** `POST /elicitation/sessions/:id/stage5`
- **Side Effect:** Matching engine fires (reads `projects.required_seams_json` and `required_domains_json`). TechTeam linked immediately.

#### `IN_PROGRESS` → `RETURNED`

- **Trigger:** Auto-publish quality gate fails (`completeness_score < 0.70`)
- **DB Operation:**
  ```sql
  UPDATE elicitation_sessions SET state = 'RETURNED', updated_at = now() WHERE id = ?;

  INSERT INTO platform_decisions
    (decision_type, entity_type, entity_id, llm_confidence, decision, advisory_note, created_at)
  VALUES ('SPEC_AUTO_RETURN', 'elicitation_sessions', ?, ?, 'FAILED_QUALITY_GATE', ?, now());
  ```
- **Tables:** `elicitation_sessions` (U), `platform_decisions` (C)
- **State Change:** `elicitation_sessions.state = 'RETURNED'`
- **Note:** No `projects` row is created on failure. CEO re-enters at the specific void — not from Stage 1.

#### `RETURNED` → `IN_PROGRESS`

- **Trigger:** CEO re-enters elicitation to fix the void
- **DB Operation:** `UPDATE elicitation_sessions SET state = 'IN_PROGRESS', updated_at = now() WHERE id = ?`
- **Tables:** `elicitation_sessions` (U)
- **Key Design:** `current_stage` is preserved — CEO resumes at the exact stage/void that caused failure.

#### `IN_PROGRESS` → `ABANDONED`

- **Trigger:** CEO navigates away from elicitation without completing
- **DB Operation:** `UPDATE elicitation_sessions SET state = 'ABANDONED', updated_at = now() WHERE id = ?`

### Cross-Table CRUD Map

```
users (R — subscription guard)
  │
  ▼
elicitation_sessions (C on start, U on stage advance, U on complete/return/abandon)
  │
  ├──► projects (C on COMPLETED — contains all JSONB footprint columns)
  │
  ├──► tech_team_profiles (C in Stage 4 handoff)
  │
  └──► platform_decisions (C on quality gate result)
```

---

## 2. Spec / Project States

### State-by-State Narration

#### `[*]` → `DRAFT`

- **Trigger:** CEO enters Elicitation Engine
- **Logic:** The `DRAFT` state encompasses the entire 5-stage conversational assembly. No `projects` row exists yet — the spec is being built within `elicitation_sessions`. The project row is only created at Stage 5 synthesis.

#### `DRAFT` → `PUBLISHED`

- **Trigger:** Auto-publish quality gate passes (`completeness_score >= 0.70`)
- **DB Operation:** Atomic transaction creating `projects` row with `state = 'PUBLISHED'` (See Section 1).
- **Side Effect:** Matching engine triggered automatically. Shortlist cached in `project_shortlist_cache`.

#### `DRAFT` → `RETURNED_TO_CLIENT`

- **Trigger:** Quality gate fails
- **DB Operation:** No `projects` row created. Session state set to `RETURNED`.

#### `RETURNED_TO_CLIENT` → `DRAFT`

- **Trigger:** CEO re-enters elicitation to fix the identified void
- **Logic:** `elicitation_sessions.current_stage` is preserved. CEO resumes at the exact point of failure.

#### `PUBLISHED` → `SUSPENDED`

- **Trigger:** Admin emergency pull-back
- **DB Operation:** `UPDATE projects SET state = 'SUSPENDED' WHERE id = ?;`
- **Endpoint:** `PUT /admin/projects/:id/suspend` (Admin only)

#### `SUSPENDED` → `PUBLISHED`

- **Trigger:** Admin reopens project
- **DB Operation:** `UPDATE projects SET state = 'PUBLISHED' WHERE id = ?;`
- **Endpoint:** `PUT /admin/projects/:id/reopen`

### Cross-Table CRUD Map

```
elicitation_sessions ──(1:1)──► projects (C on PUBLISHED)
                              .state CHECK IN ('DRAFT','PUBLISHED','RETURNED_TO_CLIENT','SUSPENDED')
                              .artifact_a_json  — visible to matched experts pre-bid
                              .artifact_b_json  — route-gated (§0.7 RBAC)
                              .required_seams_json   — feeds matching engine (§0.5)
                              .required_domains_json — feeds matching engine (§0.5)

projects ──(1:N)──► engagements (C when bid SELECTED)
projects ──(1:N)──► tech_team_profiles (C in Stage 4 handoff)
projects ──(1:1)──► project_shortlist_cache (C on PUBLISHED)
```

---

## 3. Bid States (Simplified Mutable-Row)

### State-by-State Narration

#### `[*]` → `DRAFT`

- **Trigger:** Expert clicks "Bid on this project" from shortlist
- **Guards:**
  - `users.subscription_expert_tier = 'pro'` (for Tier 2-3 projects per §0.9)
  - Self-exclusion applies
- **DB Operation (atomic):**
  ```sql
  INSERT INTO engagements
    (project_id, expert_id, service_id, type, state, client_nda_accepted_at, expert_nda_accepted_at)
  VALUES (?, ?, NULL, 'PROJECT_BASED', 'PENDING', NULL, NULL);

  INSERT INTO capability_bids
    (engagement_id, footprint_alignment_json, approach_summary,
     conditional_pricing_json, state, tech_status, ceo_status,
     tech_feedback, negotiated_price_vnd, version_number)
  VALUES (?, NULL, NULL, NULL, 'DRAFT', 'PENDING', 'PENDING', NULL, NULL, 1);
  ```
- **Tables:** `engagements` (C), `capability_bids` (C)
- **Endpoint:** `POST /bids`

#### `DRAFT` → `SUBMITTED`

- **Trigger:** Expert submits all 3 bid components
- **DB Operation:** `UPDATE capability_bids SET ... state = 'SUBMITTED' WHERE id = ?;`
- **Endpoint:** `PUT /bids/:id`

#### `SUBMITTED` → `TECH_REVIEW`

- **Trigger:** TECH_TEAM opens the bid in their dashboard
- **DB Operation:** `UPDATE capability_bids SET state = 'TECH_REVIEW' WHERE id = ?`
- **Endpoint:** `POST /bids/:id/tech-review`

#### `TECH_REVIEW` → `REVISION_REQUESTED` (Tech Review Loop)

- **Trigger:** TECH_TEAM identifies a flaw
- **DB Operation:**
  ```sql
  UPDATE capability_bids SET
    tech_status = 'REVISION_REQUESTED',
    tech_feedback = 'Approach does not address A↔C seam mitigation strategy'
  WHERE id = ?;
  ```

#### `REVISION_REQUESTED` → `TECH_REVIEW` (Loop Back)

- **Trigger:** Expert reads `tech_feedback`, edits bid row, resets `tech_status`
- **DB Operation:**
  ```sql
  UPDATE capability_bids SET
    approach_summary = '...updated approach addressing A↔C seam',
    tech_status = 'PENDING',
    version_number = version_number + 1,
    state = 'TECH_REVIEW'
  WHERE id = ?;
  ```

#### `TECH_REVIEW` → `TECH_APPROVED`

- **Trigger:** TECH_TEAM sets `tech_status = 'APPROVED'`
- **Side Effect:** CEO_REVIEW unlocks in CEO dashboard (UI guard reads `tech_status`)

#### `TECH_APPROVED` → `CEO_REVIEW`

- **Trigger:** CEO dashboard detects `tech_status = 'APPROVED'` and renders bid review

#### `CEO_REVIEW` → `PRICE_COUNTER` (Optional)

- **Trigger:** CEO writes `negotiated_price_vnd` as a counter-offer
- **DB Operation:** `UPDATE capability_bids SET negotiated_price_vnd = ? WHERE id = ?;`

#### `CEO_REVIEW` / `PRICE_COUNTER` → `SELECTED` / `DECLINED`

- **Trigger:** CEO sets `ceo_status`
- **DB Operation:**
  ```sql
  UPDATE capability_bids SET
    ceo_status = 'APPROVED', state = 'SELECTED'
  WHERE id = ?;
  ```
- **State Change:** `state = 'SELECTED'` → engagement proceeds to connection flow

#### `SUBMITTED` → `WITHDRAWN`

- **Trigger:** Expert withdraws bid
- **DB Operation:** `UPDATE capability_bids SET state = 'WITHDRAWN' WHERE id = ?;`
- **Endpoint:** `DELETE /bids/:id`
- **Side Effect:** Engagement reverts to `PENDING` awaiting other bids.

---

## 4. Engagement States

### State-by-State Narration

#### `[*]` → `PENDING` (Path A — PROJECT_BASED)

- **Trigger:** Expert clicks "Bid" (engagement row created at bid initiation)
- **DB Operation:** Engagement already exists with `state='PENDING'`.

#### `[*]` → `ACTIVE` (Path B/C — SERVICE_PURCHASE / TECH_DISCOVERY)

- **Trigger:** SePay IPN confirms payment on SERVICE VA
- **DB Operation (within IPN handler transaction):**
  ```sql
  INSERT INTO engagements
    (project_id, expert_id, service_id, type, state,
     client_nda_accepted_at, expert_nda_accepted_at, connected_at)
  VALUES (NULL, ?, ?, 'SERVICE_PURCHASE', 'ACTIVE', now(), now(), now());
  ```

#### `PENDING` → `CONNECTED`

- **Trigger:** Expert accepts connection request + both parties complete NDA click-through
- **DB Operation:**
  ```sql
  UPDATE engagements SET
    client_nda_accepted_at = ?, expert_nda_accepted_at = ?, state = 'CONNECTED', connected_at = now()
  WHERE id = ?;
  ```
- **Endpoint:** `POST /engagements/:id/nda-acceptance`

#### `CONNECTED` → `ACTIVE`

- **Trigger:** First milestone funded (SePay IPN confirms ESCROW_LOCK)
- **DB Operation:** `UPDATE engagements SET state = 'ACTIVE' WHERE id = ?;`

#### `ACTIVE` ↔ `DISPUTED`

- **Trigger (to DISPUTED):** Any party files a dispute on an active milestone
- **Trigger (back to ACTIVE):** Dispute resolved (unless all milestones are done → CLOSED)

#### `ACTIVE` → `CLOSED`

- **Trigger:** All milestones in the engagement reach `RELEASED` or dispute is fully resolved
- **DB Operation:** `UPDATE engagements SET state = 'CLOSED' WHERE id = ?;`

#### `ACTIVE` / `PENDING` → `CANCELLED`

- **Trigger:** Either party cancels engagement (only if no active funded milestones)
- **DB Operation:** `UPDATE engagements SET state = 'CANCELLED' WHERE id = ?;`
- **Endpoint:** `PUT /engagements/:id/cancel`

---

## 5. Engagement Type (Immutable Discriminator)

### DB-Level Enforcement

```sql
-- Table-level CHECK on engagements
CONSTRAINT engagement_type_fk CHECK (
  (type = 'PROJECT_BASED' AND project_id IS NOT NULL AND service_id IS NULL) OR
  (type IN ('SERVICE_PURCHASE','TECH_DISCOVERY') AND project_id IS NULL AND service_id IS NOT NULL)
)

-- Escrow dual-parent structure
CONSTRAINT escrow_has_one_parent CHECK (
  (milestone_id IS NOT NULL AND engagement_id IS NULL) OR
  (milestone_id IS NULL AND engagement_id IS NOT NULL)
)
```

---

## 6. Milestone States

### State-by-State Narration

#### `[*]` → `DEFINED`

- **Trigger:** CEO creates milestone (or AI auto-generates framework in Stage 5)
- **DB Operation:**
  ```sql
  INSERT INTO milestones
    (engagement_id, milestone_number, deliverable_statement, sign_off_authority, 
     payment_amount_vnd, state, is_ai_generated, ...)
  VALUES (?, ?, ?, ?, 0, 'DEFINED', true, ...);
  -- payment_amount_vnd is 0 from AI; CEO sets real amount via PATCH
  ```

#### `DEFINED` → `AWAITING_PAYMENT`

- **Trigger:** CEO clicks "Fund Milestone N"
- **DB Operation:**
  ```sql
  INSERT INTO virtual_accounts (entity_type, entity_id, va_number, fixed_amount, expires_at, status)
  VALUES ('MILESTONE', ?, ?, ?, now() + interval '24 hours', 'ACTIVE');

  UPDATE milestones SET state = 'AWAITING_PAYMENT', va_number = ?, va_expires_at = now() + interval '24 hours' WHERE id = ?;
  ```
- **[API]:** SePay VA creation API call
- **Endpoint:** `POST /milestones/:id/fund`

#### `AWAITING_PAYMENT` → `FUNDED`

- **Trigger:** SePay IPN webhook confirms credit on milestone VA
- **DB Operation (atomic within IPN handler):**
  ```sql
  -- ESCROW LOCK
  UPDATE wallets SET available_balance = available_balance - ?, locked_balance = locked_balance + ? WHERE user_id = ?;

  INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, reference_id, created_at)
  VALUES (?, ?, 'ESCROW_LOCK', 'ESC_LOCK:' || ?, now());

  INSERT INTO escrow_accounts (milestone_id, engagement_id, amount, client_wallet_id, expert_wallet_id, status, held_at)
  VALUES (?, NULL, ?, ?, ?, 'HELD', now());

  UPDATE milestones SET state = 'FUNDED', funded_at = now() WHERE id = ?;

  -- Release pay-gated documents
  UPDATE paygated_documents SET release_state = 'RELEASED', released_at = now() WHERE milestone_id = ?;
  ```
- **[LEDGER]:** `ESCROW_LOCK` — `available_balance -= amount`, `locked_balance += amount`

#### `FUNDED` → `IN_PROGRESS`

- **Trigger:** System auto-advance
- **DB Operation:**
  ```sql
  UPDATE milestones SET state = 'IN_PROGRESS' WHERE id = ?;
  UPDATE engagements SET state = 'ACTIVE' WHERE id = ?; -- if first milestone
  ```

#### `IN_PROGRESS` → `SUBMITTED`

- **Trigger:** Expert clicks "Submit Deliverable"
- **Guard (DoD submission gate):**
  ```sql
  SELECT COUNT(*) FROM milestone_dod_items
  WHERE milestone_id = ? AND is_required = true AND status != 'COMPLETED';
  -- IF > 0 → 422 REQUIRED_DOD_INCOMPLETE
  ```
- **DB Operation:**
  ```sql
  INSERT INTO milestone_submissions (milestone_id, expert_id, description, files_json, submitted_at)
  VALUES (?, ?, ?, ?::jsonb, now());

  UPDATE milestones SET state = 'SUBMITTED', submitted_at = now() WHERE id = ?;
  ```

#### `SUBMITTED` ↔ `IN_REVISION`

- **Trigger (to IN_REVISION):** Sign-off authority requests revision
- **DB Operation:**
  ```sql
  UPDATE acceptance_criteria SET revision_note = ? WHERE id = ?;
  UPDATE milestones SET state = 'IN_REVISION' WHERE id = ?;
  ```

#### `SUBMITTED` / `IN_REVISION` → `DISPUTED`

- **Trigger:** Any party files a dispute
- **DB Operation:**
  ```sql
  INSERT INTO disputes (engagement_id, milestone_id, criterion_id, escrow_account_id, filed_by, state, filed_at)
  VALUES (?, ?, ?, ?, ?, 'PENDING', now());

  UPDATE escrow_accounts SET status = 'FROZEN' WHERE id = ?;
  UPDATE milestones SET state = 'DISPUTED' WHERE id = ?;
  ```

#### `SUBMITTED` / `IN_REVISION` → `APPROVED` (Happy Path)

- **Trigger:** All required acceptance criteria have `verified_at` set
- **DB Operation (atomic ledger release):**
  ```sql
  -- Read platform fee from DB (NOT hardcoded)
  SELECT platform_fee_pct INTO fee_pct FROM platform_settings LIMIT 1;
  net_amount := payment_amount * (1 - fee_pct);
  fee_amount := payment_amount * fee_pct;

  -- ESCROW_RELEASE: unlock client funds
  UPDATE wallets SET locked_balance = locked_balance - payment_amount WHERE id = client_wallet_id;

  -- PLATFORM_FEE: credit platform wallet
  UPDATE wallets SET available_balance = available_balance + fee_amount WHERE id = platform_wallet_id;

  -- CREDIT_EXPERT: credit expert wallet internally
  UPDATE wallets SET available_balance = available_balance + net_amount WHERE id = expert_wallet_id;

  -- 3 wallet_transactions rows
  INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, reference_id, created_at) VALUES
    (client_wallet_id, payment_amount, 'ESCROW_RELEASE', 'ESC_REL:' || milestone_id, now()),
    (platform_wallet_id, fee_amount, 'PLATFORM_FEE', 'FEE:' || milestone_id, now()),
    (expert_wallet_id, net_amount, 'ESCROW_RELEASE', 'CREDIT:' || milestone_id, now());

  UPDATE escrow_accounts SET status = 'RELEASED', released_at = now() WHERE milestone_id = ?;
  UPDATE milestones SET state = 'APPROVED', approved_at = now() WHERE id = ?;
  ```
- **[LEDGER]:** `ESCROW_RELEASE` + `PLATFORM_FEE` + expert credit (3 entries)
- **Key Architecture Update:** The platform **no longer** auto-fires the SePay `chi hộ` API on `APPROVED`. The expert's internal wallet balance is credited directly. Outbound disbursements are handled strictly via manual withdrawal requests (Section 12).

#### `APPROVED` → `RELEASED`

- **Trigger:** Manually marked or system check verifies all funds settled.
- **DB Operation:** `UPDATE milestones SET state = 'RELEASED', released_at = now() WHERE id = ?;`
- **Side Effect:** If this was the last milestone → `UPDATE engagements SET state = 'CLOSED'`

---

## 7. Acceptance Criterion Verification

### State-by-State Narration

#### `[*]` → `UNVERIFIED`

- **Trigger:** CEO or Expert defines acceptance criteria for a milestone
- **DB Operation:**
  ```sql
  INSERT INTO acceptance_criteria
    (milestone_id, criterion_text, is_required, verified_by_role, verified_at, revision_note)
  VALUES (?, ?, true, 'TECH_TEAM', NULL, NULL);
  ```
- **Side Effect — LLM Quality Gate:**
  - NestJS calls FastAPI `/llm/criterion-check`. If subjective, writes `advisory_note` to `platform_decisions`. Advisory only — non-blocking.
- **Endpoint:** `POST /criteria/:milestoneId`

#### `UNVERIFIED` → `VERIFIED`

- **Trigger:** Sign-off authority clicks "Verify"
- **RBAC Guard:** Match `verified_by_role` to user's `activeRole`/`clientSubtype`.
- **DB Operation:** `UPDATE acceptance_criteria SET verified_at = now() WHERE id = ?;`
- **Endpoint:** `POST /criteria/:id/verify`

#### `UNVERIFIED` → `REVISION_REQUESTED`

- **Trigger:** Sign-off authority writes `revision_note`
- **DB Operation:** `UPDATE acceptance_criteria SET revision_note = ? WHERE id = ?;`
- **Side Effect:** Milestone transitions to `IN_REVISION`

---

## 8. DoD Checklist Item States

### State-by-State Narration

#### `[*]` → `PENDING`

- **Trigger:** Milestone created with DoD items
- **DB Operation:**
  ```sql
  INSERT INTO milestone_dod_items
    (milestone_id, item_description, is_required, status, maps_to_criterion_id)
  VALUES (?, ?, true, 'PENDING', NULL);
  ```

#### `PENDING` → `COMPLETED`

- **Trigger:** Expert marks item done
- **DB Operation:**
  ```sql
  UPDATE milestone_dod_items SET
    status = 'COMPLETED', completed_at = now(), completion_note = ?
  WHERE id = ?;
  ```

#### `PENDING` → `NOT_APPLICABLE`

- **Trigger:** Expert determines item is irrelevant
- **DB Operation:** `UPDATE milestone_dod_items SET status = 'NOT_APPLICABLE', not_applicable_note = ? WHERE id = ?;`
- **DB-Level Constraint:**
  ```sql
  CONSTRAINT dod_required_cannot_be_na
    CHECK (NOT (is_required = TRUE AND status = 'NOT_APPLICABLE'))
  ```

---

## 9. Pay-Gated Document States

### State-by-State Narration

#### `[*]` → `STAGED`

- **Trigger:** Expert uploads reasoning document tagged to a milestone
- **DB Operation:**
  ```sql
  INSERT INTO paygated_documents
    (milestone_id, document_url, release_state, staged_at, released_at)
  VALUES (?, ?, 'STAGED', now(), NULL);
  ```

#### `STAGED` → `RELEASED`

- **Trigger:** SePay IPN confirms milestone FUNDED (happens within the IPN MILESTONE handler transaction)
- **DB Operation:** `UPDATE paygated_documents SET release_state = 'RELEASED', released_at = now() WHERE milestone_id = ?;`
- **Route Guard on read:** TECH_TEAM only; CEO permanently excluded.

---

## 10. Dispute Resolution (2-Layer)

### State-by-State Narration

#### `[*]` → `PENDING`

- **Trigger:** Any party files a formal dispute
- **DB Operation:**
  ```sql
  INSERT INTO disputes
    (engagement_id, milestone_id, criterion_id, escrow_account_id, filed_by, state, filed_at)
  VALUES (?, ?, ?, ?, ?, 'PENDING', now());

  UPDATE escrow_accounts SET status = 'FROZEN' WHERE id = ?;
  ```
- **Endpoint:** `POST /disputes`

#### `PENDING` → `LAYER_1_EVAL`

- **Trigger:** System auto-initiates LLM evaluation
- **DB Operation:** `UPDATE disputes SET state = 'LAYER_1_EVAL' WHERE id = ?`
- **FastAPI Call:** `POST /llm/dispute-eval` — evaluates criterion text vs. deliverable, returns `confidence_score` and `finding`.

#### `LAYER_1_EVAL` → `AUTO_RESOLVED`

- **Trigger:** LLM `confidence_score >= 0.80`
- **DB Operation (atomic):**
  ```sql
  UPDATE disputes SET state = 'AUTO_RESOLVED', llm_confidence = ?, resolved_at = now() WHERE id = ?;

  -- Ledger distribution per LLM finding (expert_wins vs client_wins)
  -- IF expert wins: ESCROW_RELEASE + PLATFORM_FEE + CREDIT_EXPERT
  -- IF client wins: ESCROW_REFUND

  UPDATE escrow_accounts SET status = 'RELEASED'|'REFUNDED', released_at = now() WHERE id = ?;
  UPDATE milestones SET state = 'APPROVED', approved_at = now() WHERE id = ?;
  ```

#### `LAYER_1_EVAL` → `MANUAL_REVIEW`

- **Trigger:** LLM `confidence_score < 0.80`
- **DB Operation:** `UPDATE disputes SET state = 'MANUAL_REVIEW', llm_confidence = ? WHERE id = ?;`
- **Evidence Submission:** Parties can submit evidence via `POST /disputes/:id/evidence` which logs to `platform_decisions`.

#### `MANUAL_REVIEW` → `RESOLVED`

- **Trigger:** Admin clicks one of three buttons in Dispute Monitor
- **DB Operation (atomic):**
  ```sql
  UPDATE disputes SET state = 'RESOLVED', resolved_by = ?, resolved_at = now() WHERE id = ?;

  -- Per admin choice: "Release to Expert", "Refund to Client", or "Split 50/50"
  -- Updates escrow_accounts.status to 'RELEASED', 'REFUNDED', or 'SPLIT'
  ```
- **Endpoint:** `POST /admin/disputes/:id/resolve`

---

## 11. Wallet Transaction Types (Internal Ledger Flow)

### Transaction Type Narration

#### `TOP_UP` — External → Available

- **Trigger:** SePay IPN on WALLET_TOPUP VA
- **[LEDGER]:** `available_balance += amount`
- **Idempotency:** `UNIQUE INDEX wallet_tx_idempotency ON wallet_transactions(wallet_id, reference_id)`

#### `SUBSCRIPTION` — Available → Internal

- **Trigger:** User activates Pro tier
- **DB Operation:**
  ```sql
  UPDATE wallets SET available_balance = available_balance - ? WHERE user_id = ?;
  -- Reads price from subscription_packages table (no hardcoding)
  UPDATE users SET subscription_client_tier = 'pro', sub_client_expires_at = now() + interval '6 months' WHERE id = ?;
  INSERT INTO subscription_purchase_logs (user_id, package_id, role, amount_paid_vnd, expires_at, payment_method) VALUES (...);
  ```

#### `ESCROW_LOCK` — Available → Locked

- **Trigger:** SePay IPN on MILESTONE or SERVICE VA
- **[LEDGER]:** `available_balance -= amount`, `locked_balance += amount`

#### `ESCROW_RELEASE` + `PLATFORM_FEE` + Expert Credit — Locked → Expert Available + Platform

- **Trigger:** Milestone `APPROVED`
- **Key Architecture Update:** Platform fee is `SELECT platform_fee_pct FROM platform_settings LIMIT 1` — never hardcoded.
- **Key Architecture Update:** Expert wallet is credited internally. **No outbound SePay `chi hộ` API is fired automatically.** The expert must manually request a withdrawal.

#### `ESCROW_REFUND` — Locked → Client Available

- **Trigger:** Dispute resolved in client's favor
- **[LEDGER]:** `locked_balance -= amount`, `available_balance += amount`

#### `ESCROW_SPLIT` — Locked → Both Available (50/50)

- **Trigger:** Admin chooses "Split 50/50" in Dispute Monitor
- **[LEDGER]:** `locked_balance -= amount`, both parties `available_balance += amount/2`

#### `WITHDRAWAL` — Expert Available → External

- **Trigger:** Expert manually requests cash-out
- **[LEDGER]:** `available_balance -= amount`
- **Key Architecture Update:** Withdrawal request is created with `status = 'PENDING'`. Admin processes externally.

---

## 12. Withdrawal States

### Master Reference

- **§0.8 Payment Architecture:** Manual outbound disbursement. No SePay `chi hộ` API calls.
- **§0.7 RBAC:** Expert-initiated; requires `sepay_bank_account_xid` set via Bank Hub.

### State-by-State Narration

#### `[*]` → `PENDING`

- **Trigger:** Expert clicks "Withdraw"
- **Guard:** `users.sepay_bank_account_xid IS NOT NULL` AND `wallets.available_balance >= amount`
- **DB Operation (atomic):**
  ```sql
  UPDATE wallets SET available_balance = available_balance - ? WHERE user_id = ?;
  INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, reference_id, created_at)
  VALUES (?, ?, 'WITHDRAWAL', 'WD:' || ?, now());
  
  INSERT INTO withdrawal_requests
    (expert_id, type, amount, bank_account_xid, status, requested_at)
  VALUES (?, 'EXPERT_MANUAL', ?, ?, 'PENDING', now());
  ```
- **Endpoint:** `POST /withdrawals`

#### `PENDING` → `COMPLETED`

- **Trigger:** Admin manually processes external bank transfer and marks as completed.
- **DB Operation:**
  ```sql
  UPDATE withdrawal_requests SET status = 'COMPLETED', confirmed_at = now() WHERE id = ?;
  ```

#### `PENDING` → `FAILED`

- **Trigger:** Admin marks as failed (e.g., rejected by external bank)
- **DB Operation (atomic reversal):**
  ```sql
  UPDATE wallets SET available_balance = available_balance + ? WHERE user_id = ?;
  INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, reference_id, created_at)
  VALUES (?, ?, 'WITHDRAWAL', 'WD:' || ? || ':REVERSAL', now());

  UPDATE withdrawal_requests SET status = 'FAILED' WHERE id = ?;
  ```
- **[LEDGER]:** Reversal entry — `available_balance += amount`

#### `PENDING` → `CANCELLED`

- **Trigger:** Expert cancels withdrawal before admin processes it
- **DB Operation:** Same atomic reversal as `FAILED`, but `status = 'CANCELLED'`.
- **Endpoint:** `DELETE /withdrawals/:id`

---

## 13. Subscription States

### State-by-State Narration

#### `free` → `pro`

- **Trigger:** User activates Pro subscription
- **Guards:**
  - `users.subscription_{role}_tier` not already `'pro'` (409 if already subscribed)
  - `wallets.available_balance >= subscription_packages.price_vnd` (422 if insufficient)
- **DB Operation (atomic):**
  ```sql
  -- Read package from DB
  SELECT price_vnd, duration_months INTO price, duration FROM subscription_packages WHERE id = ? AND role = ? AND is_active = true;

  UPDATE wallets SET available_balance = available_balance - price WHERE user_id = ?;
  INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, reference_id, created_at)
  VALUES (?, price, 'SUBSCRIPTION', 'SUB:' || user_id || ':' || role_type, now());
  
  UPDATE users SET
    subscription_client_tier = 'pro',  -- or subscription_expert_tier
    sub_client_expires_at = now() + (duration || ' months')::interval
  WHERE id = ?;

  INSERT INTO subscription_purchase_logs (user_id, package_id, role, amount_paid_vnd, expires_at, payment_method)
  VALUES (?, ?, ?, price, now() + (duration || ' months')::interval, 'WALLET');
  ```
- **[LEDGER]:** `SUBSCRIPTION` — `available_balance -= price`
- **Endpoint:** `POST /subscriptions/activate` (requires `packageId` in body)

#### `pro` → `EXPIRING_SOON`

- **Trigger:** 7 days before `users.sub_{role}_expires_at`
- **DB Operation:** No state column change — detected at query time. Notification sent via WebSocket + persisted to `notifications` table.

#### `pro` → `free` (Expired)

- **Trigger:** `sub_{role}_expires_at < now()`
- **DB Operation:** Handled at query time by SubscriptionGuard. If expired, treats user as `free`.

---

## 14. Cross-Table CRUD Dependency Map (40 Tables)

> **Every state machine in this document operates exclusively on these 40 tables.** Every transition has a defined CRUD operation, endpoint, and constraint. Hardcoded values have been completely eliminated in favor of CMS-driven config tables.

### Full Dependency Graph

```
1.  users
      ├──(1:1)──► client_profiles           
      ├──(1:1)──► expert_profiles           
      ├──(1:1)──► tech_team_profiles        
      ├──(1:1)──► wallets                   
      ├──(1:N)──► notifications             [C: system/bid/milestone events]
      │
2.  wallets
      ├──(1:N)──► wallet_transactions       [C: every financial event; IMMUTABLE]
      │
3.  virtual_accounts                        
      .entity_type CHECK IN ('WALLET_TOPUP','MILESTONE','SERVICE')
      │
4.  withdrawal_requests                     [C: PENDING; U: COMPLETED/FAILED/CANCELLED]
      .status CHECK IN ('PENDING','COMPLETED','FAILED','CANCELLED')
      │
5.  platform_settings                       [SINGLETON]
      .platform_fee_pct DEFAULT 0.05 (READ at transaction time; NOT hardcoded)
      │
6.  elicitation_sessions                    [C: start; U: stage advances, state transitions]
      .state CHECK IN ('IN_PROGRESS','COMPLETED','ABANDONED','RETURNED')
      .critical_artifacts_json              ← tracks required artifacts (e.g. compliance_ruleset)
      .stage4_draft_json                    ← autosave state
      │
7.  projects                                [C: Stage 5 synthesis; U: state transitions]
      .state CHECK IN ('DRAFT','PUBLISHED','RETURNED_TO_CLIENT','SUSPENDED')
      .estimated_total_cost_vnd             ← computed from milestone_framework_json
      │
8.  project_shortlist_cache                 [C: on PUBLISHED; U: FORCE_REFRESH by CEO]
      │
9.  services                                [C: MF-9; U: state (DRAFT→PUBLISHED→SUSPENDED)]
      .service_type CHECK IN ('AI_SERVICE','TECH_DISCOVERY')
      │
10. expert_domain_depths                    [C/U: MF-2]
      .depth_level CHECK IN ('SURFACE','OPERATIONAL','DEEP')
      UNIQUE (expert_id, domain_code)
      │
11. expert_seam_claims                      [C/U: MF-2]
      .verification_tier CHECK IN ('CLAIMED','EVIDENCE_BACKED')
      UNIQUE (expert_id, seam_code)
      │
12. portfolio_submissions                   [C: expert submit; U: LLM eval updates status]
      .status CHECK IN ('PENDING','APPROVED','REJECTED')
      │
13. engagements                             [C: bid/purchase; U: state, nda timestamps]
      .state CHECK IN ('PENDING','CONNECTED','ACTIVE','CLOSED','DISPUTED','CANCELLED')
      │
14. capability_bids                         [C: bid init; U: every bid transition]
      .state CHECK IN ('DRAFT','SUBMITTED','TECH_REVIEW','REVISION_REQUESTED',
                       'TECH_APPROVED','CEO_REVIEW','SELECTED','DECLINED','WITHDRAWN')
      │
15. milestones                              [C: MF-7/AI gen; U: every milestone transition]
      .state CHECK IN ('DEFINED','AWAITING_PAYMENT','FUNDED','IN_PROGRESS',
                       'SUBMITTED','IN_REVISION','APPROVED','RELEASED','DISPUTED')
      │
16. acceptance_criteria                     [C: MF-7; U: verified_at, revision_note]
      │
17. milestone_dod_items                     [C: MF-7; U: status, completed_at, notes]
      CONSTRAINT: NOT (is_required = TRUE AND status = 'NOT_APPLICABLE')
      │
18. milestone_submissions                   [C: submit/resubmit]
      │
19. paygated_documents                      [C: staging; U: release_state in IPN TX]
      │
20. escrow_accounts                         [C: MF-7/MF-10; U: status]
      .status CHECK IN ('HELD','RELEASED','FROZEN','REFUNDED','SPLIT')
      │
21. disputes                                [C: MF-8; U: state transitions]
      .state CHECK IN ('PENDING','LAYER_1_EVAL','AUTO_RESOLVED','MANUAL_REVIEW','RESOLVED','WITHDRAWN')
      │
22. messages                                [C: messaging; R: history]
      │
23. message_reads                           [C: on read; R: unread count]
      │
24. reviews                                 [C: post-engagement]
      │
25. platform_decisions                      [C: every LLM/AI decision]
      │
26. domain_definitions                      [CMS: CRUD by Admin]
27. seam_definitions                        [CMS: CRUD by Admin]
28. archetype_definitions                   [CMS: CRUD by Admin]
29. probe_questions                         [CMS: CRUD by Admin]
30. void_code_definitions                   [CMS: CRUD by Admin]
31. prompt_templates                        [CMS: CRUD by Admin; hot-reloaded by FastAPI]
32. subscription_packages                   [CMS: CRUD by Admin; R: activation logic]
33. subscription_purchase_logs              [C: on successful activation]
34. milestone_chat_sessions                 [C: E-3 Milestone Chat Assistant]
35. invitations                             [C: CEO invite; U: ACCEPT/DECLINE]

36. notifications                           [C: WebSocket broadcast + DB persist]
      .type CHECK IN ('bid_update','system','milestone_update')

37. expert_profiles                         [1:1 with users]
38. client_profiles                         [1:1 with users]
39. tech_team_profiles                      [1:1 with users]
40. platform_settings                       [Singleton]
```

### Architecture Confirmation: 40 Tables Full Fat

The system is fully grounded in a 40-table architecture. All hardcoded values (taxonomies, payment percentages, subscription durations, prompt templates) have been fully migrated to CMS-driven DB tables with Admin CRUD endpoints. The outbound payment flow (`chi hộ`) has been strictly decoupled from automated SePay calls and is handled as a manual admin process.