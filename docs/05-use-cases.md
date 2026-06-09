# AITasker MVP — Use Case Specifications (Scope-Reduced)
**Purpose:** Authoritative use case reference for the 9-week MVP build. Every `<<include>>` and `<<extend>>` relationship is grounded in the feature specs and the 28-table physical schema.

**Scope-reduction conventions used throughout:**
> **[DEFERRED — Phase 2]** marks any use case that exists in the full 51-table specification but is intentionally out of scope for the 9-week MVP. Phase 2 path exists; see §6 of the scope document.  
> Tables named match the physical schema exactly. State names resolve to §0.6 of the master reference sheet.

---

## Notation Key

```
UC_BASE  ---<<include>>--->  UC_SUB        Arrow points FROM base TO included UC (mandatory)
UC_EXT   ---<<extend>>---->  UC_BASE       Arrow points FROM extending UC TO base (conditional)
```

When multiple UCs share the same included behaviour (e.g., `<<include>> Verify Subscription Gate`), draw that sub-UC once and fan `<<include>>` arrows from all callers.

---

## Part A — CLIENT / CEO Flows

---

### UC01 — Submit Project via AI Elicitation Engine

**Primary Actor:** CLIENT / CEO  
**Secondary Actor:** System (FastAPI / LLM Engine)  
**Feature reference:** F2  
**Subscription gate:** Client Pro required. HTTP 403 returned before Stage 1 if `users.subscription_client_tier = 'free'`.

**Preconditions:**
1. `active_role = CLIENT`, `client_subtype = CEO`.
2. `users.subscription_client_tier = 'pro'` AND `sub_client_expires_at > now()`.
3. No active `elicitation_sessions` row with `state = 'IN_PROGRESS'` for this user (system resumes if interrupted; user can abandon and restart).

**Main Success Scenario:**
1. Actor opens "Post a Project". System creates `elicitation_sessions` row (`state = 'IN_PROGRESS'`, `current_stage = 1`); displays behavioral intake prompt.
2. Actor types free-form pain description (what hurts; business goal).
3. System calls `POST /llm/elicitation/stage1-extract`. FastAPI runs: intent separation, scale signal extraction, void detection. `elicitation_sessions.void_list_json` updated with detected voids.
4. System presents 2–3 archetype options in plain business language (derived from §0.3).
5. Actor selects matching archetype; `elicitation_sessions.archetype` locked.
6. SDLC injection loop (`current_stage = 2`): for each detected void (e.g., ground truth absent), system presents mandatory milestone injection with plain-language rationale. Actor accepts each injection; accepted voids written to `void_list_json` with `injected: true`. Actor cannot remove injected milestones.
7. System presents 4 behavioral architecture probe questions (`current_stage = 3`): sync vs. async, thundering herd, stateful memory, HITL requirement. No technical knowledge required from actor.
8. Actor answers all 4 probes.
9. System evaluates probe answers against infrastructure thresholds (Stage 4 trigger).
10. [IF threshold crossed AND TECH_TEAM exists] System generates signed JWT handoff link (`client_subtype: TECH_TEAM`, `project_id`, 72-hour expiry); actor is hard-blocked from Stage 4 form. Actor sends link externally. TECH_TEAM completes Stage 4 via `UC01t`.
11. [IF Stage 4 not required OR after TECH_TEAM completes Stage 4] Synthesis engine runs: `POST /llm/elicitation/stage5-synthesize`. FastAPI resolves CEO/TECH_TEAM signal conflicts privately; produces `required_seams_json`, `required_domains_json`, `milestone_framework_json`, `artifact_a_json`, `artifact_b_json`.
12. Auto-publish quality gate (§0.6 Spec states): (a) footprint completeness score ≥ 0.70, (b) matching pre-check finds ≥ 1 expert above minimum threshold, (c) no unresolved hard-flagged voids.
13. [IF all pass] `projects` row created (`state = 'PUBLISHED'`); all five JSONB footprint fields written; `elicitation_sessions.state = 'COMPLETED'`. `platform_decisions` row written (`decision_type = 'ELICITATION_SYNTHESIS'`). Matching engine fires; CEO notified; shortlist accessible via `UC04`.
14. [IF any check fails] `projects.state = 'RETURNED_TO_CLIENT'`; `elicitation_sessions.state = 'RETURNED'`; `platform_decisions` row written (`decision_type = 'SPEC_AUTO_RETURN'`, `advisory_note` = LLM-targeted void note). Actor re-enters elicitation at the specific failing void — not from Step 1.

**Extensions:**
- `UC01a` [EXTEND at Step 9 — threshold crossed AND actor confirms no TECH_TEAM available] Scenario A: Technical Discovery Pathway.
- `UC01b` [EXTEND at Step 9 — actor set `project.self_technical = true`] Scenario B: Self-Technical CEO completes Stage 4 directly.
- [AT Step 12 — quality gate fail] System sets `RETURNED_TO_CLIENT` as detailed in Step 14 above; no admin action required.

**Includes:**
- `<<include>> Verify Subscription Gate` — checked at route entry before displaying intake form.
- `<<include>> Run SDLC Void Detection` — Stage 1 LLM sub-process (always runs).
- `<<include>> Run Automated Quality Gate` — Stage 5 sub-process (always runs after synthesis).

**Postconditions (success):**
- `projects` row created; `state = 'PUBLISHED'`; all JSONB fields (`required_seams_json`, `required_domains_json`, `milestone_framework_json`, `artifact_a_json`, `artifact_b_json`) populated.
- `elicitation_sessions.state = 'COMPLETED'`.
- Composite match shortlist (3–5 candidates) generated; CEO notified.
- `UC04` now accessible.

> **Scope note:** In the MVP, `required_seams_json`, `required_domains_json`, `milestone_framework_json`, `artifact_a_json`, and `artifact_b_json` are all JSONB columns on the single `projects` table. The `capability_footprints`, `artifact_a`, and `artifact_b` tables from the full specification are not built.

---

### UC01a — Proceed via Technical Discovery Pathway (Scenario A)

**Primary Actor:** CLIENT / CEO  
**Feature reference:** F2 Scenario A  
**Extends:** UC01 at Stage 4 (threshold crossed; no TECH_TEAM)

**Preconditions:**
1. UC01 Stage 3 probe answers indicate integration with an existing production system (Stage 4 required).
2. Actor confirms they have no technical team member to send the handoff link to.

**Main Success Scenario:**
1. System presents two options:
   - **(a) Inject TECH_DISCOVERY milestone as Milestone 0** into the current project. System writes the injected milestone to `elicitation_sessions.void_list_json`; `elicitation_sessions.scenario_type = 'SCENARIO_A'`. Elicitation resumes with Artifact A marked as technically incomplete; expert bids must include architecture discovery in Milestone 0 scope. Engagement type will be `TECH_DISCOVERY`.
   - **(b) Purchase a TECH_DISCOVERY service engagement first** (routes to `UC10`). After that engagement closes, CEO receives the architecture document and may complete Stage 4 manually, then re-enter elicitation.
2. Actor selects one option.

**Postconditions:**
- Option (a): `elicitation_sessions.scenario_type = 'SCENARIO_A'`; Milestone 0 framework injected in `milestone_framework_json`; project proceeds to synthesis and publish.
- Option (b): Actor redirected to `UC10`; current `elicitation_sessions.state = 'IN_PROGRESS'` preserved (resumable).

---

### UC01b — Complete Stage 4 as Self-Technical CEO (Scenario B)

**Primary Actor:** CLIENT / CEO  
**Feature reference:** F2 Scenario B  
**Extends:** UC01 at Stage 4 (actor has set `self_technical = true`)

**Preconditions:**
1. Actor set `project.self_technical = true` during Stage 1 intake.
2. `active_role = CLIENT`, `client_subtype = CEO`.

**Main Success Scenario:**
1. System presents Stage 4 form directly to actor (same form TECH_TEAM normally sees). `elicitation_sessions.scenario_type = 'SCENARIO_B'` written.
2. Actor inputs: stack tags, integration method, legacy data volume, deployment expectation; optionally uploads sensitive schemas (written to `artifact_b_json`).
3. System records inputs. `projects.self_technical = true` persisted. Actor's JWT `self_technical_projects` claim updated.
4. Synthesis engine runs (UC01 Step 11 onwards). No TECH_TEAM signal conflict resolution required; bid review does not require a TECH_TEAM account for this project.

**Postconditions:**
- `projects.self_technical = true`; `elicitation_sessions.scenario_type = 'SCENARIO_B'`.
- `artifact_b_json` populated with Stage 4 inputs.
- JWT updated with `self_technical_projects: [project_id]`.

---

### UC01t — Complete Tech Team Architecture Handoff (TECH_TEAM Route)

**Primary Actor:** CLIENT / TECH_TEAM  
**Feature reference:** F2 Stage 4  
**Extends:** UC01 (TECH_TEAM drives Stage 4 on a separate account created via the handoff link)

**Preconditions:**
1. Actor opened a signed handoff link (`client_subtype: TECH_TEAM`, `project_id` encoded in JWT token; 72-hour window).
2. Actor has registered via `POST /auth/register/handoff`; `tech_team_profiles` row exists with `linked_project_id` set.
3. `active_role = CLIENT`, `client_subtype = TECH_TEAM`.

**Main Success Scenario:**
1. Actor lands on Stage 4 form with security framing text. System validates handoff JWT signature and expiry; `projects.id` extracted.
2. Actor inputs: stack tags (multi-select), integration method, legacy data volume range, deployment expectation.
3. Actor optionally uploads sensitive schemas, payload samples, integration contracts — all written into `projects.artifact_b_json` staging area. Stack tag outputs also written to `artifact_a_json` draft.
4. Actor submits. `tech_team_profiles.linked_project_id` confirmed. System triggers Stage 5 synthesis (UC01 Step 11).

**Route guard:** `POST /projects/{id}/stage4` is guarded by `client_subtype = 'TECH_TEAM'` OR `(client_subtype = 'CEO' AND self_technical = true for this project)`. CEO without `self_technical` flag receives HTTP 403.

**Postconditions:**
- `artifact_b_json` populated with TECH_TEAM's sensitive inputs.
- Synthesis triggered; `projects.required_seams_json`, `required_domains_json`, `milestone_framework_json`, `artifact_a_json`, `artifact_b_json` all generated.
- `tech_team_profiles.linked_project_id → projects.id` confirmed.

---

### UC02 — Top Up Platform Wallet via WALLET_TOPUP VA VietQR

**Primary Actor:** CLIENT / CEO or EXPERT (any wallet-holding user)  
**Feature reference:** F1.5, F10  
**Subscription gate:** None — Free tier can top up.

**Preconditions:**
1. `active_role = CLIENT/CEO` or `active_role = EXPERT`.
2. `wallets` row exists for actor (created on registration).
3. Actor has a permanent `virtual_accounts` row (`entity_type = 'WALLET_TOPUP'`, `status = 'ACTIVE'`, `fixed_amount = NULL`).

**Main Success Scenario:**
1. Actor opens "Top Up Wallet". System reads `virtual_accounts WHERE entity_id = user_id AND entity_type = 'WALLET_TOPUP'`; generates VietQR for the permanent VA number (any transfer amount accepted — no `fixed_amount` constraint).
2. Actor scans QR with banking app; enters any amount; confirms transfer.
3. SePay IPN fires: `POST /webhooks/sepay/ipn` (HMAC-verified with `SEPAY_SECRET_KEY`).
4. NestJS IPN handler: resolves `va_number → entity_type = 'WALLET_TOPUP'`; runs idempotency check against `wallet_transactions(wallet_id, reference_id)` unique index.
5. DB transaction (atomic): `wallets.available_balance += amount`; `wallet_transactions` row inserted `{ transaction_type: 'TOP_UP', reference_id: transfer_reference }`.
6. NestJS returns HTTP 200 to SePay synchronously. Actor notified: "Wallet topped up: +{amount} VND."

**Extensions:**
- [IF IPN carries a `reference_id` already in `wallet_transactions`] Idempotency index fires; duplicate IPN ignored; 200 returned; no double-credit.

**Postconditions:**
- `wallets.available_balance` increased by transferred amount.
- `wallet_transactions` row written (immutable ledger).

---

### UC03 — Purchase Client Pro Subscription from Wallet Balance

**Primary Actor:** CLIENT / CEO  
**Feature reference:** F1.5  
**Subscription gate:** None for the purchase itself; this UC activates the gate.

**Preconditions:**
1. `active_role = CLIENT`, `client_subtype = CEO`.
2. `users.subscription_client_tier = 'free'` OR `sub_client_expires_at <= now()` (expired).
3. `wallets.available_balance >= 500,000 VND` (Client Pro price).

**Main Success Scenario:**
1. Actor opens Subscription panel; sees Client Pro plan (500,000 VND / 6 months); current tier displayed.
2. Actor clicks "Activate Client Pro". Request: `POST /subscriptions/activate { role_type: "client" }`.
3. NestJS Guard 1: `users.subscription_client_tier = 'pro'` AND not expired → 409 `ALREADY_SUBSCRIBED`.
4. NestJS Guard 2: `wallets.available_balance >= 500000` → else 422 `INSUFFICIENT_BALANCE` with redirect to `UC02`.
5. DB transaction (atomic): `wallets.available_balance -= 500000`; `wallet_transactions` row inserted `{ transaction_type: 'SUBSCRIPTION', amount: 500000, reference_id: 'SUB-{user_id}:client' }`; `users.subscription_client_tier = 'pro'`; `users.sub_client_expires_at = now() + 6 months`.
6. NestJS reissues JWT with updated subscription claims. Actor notified: "Your Pro subscription is active until {date}."
7. All LLM-gated routes (F2 elicitation, F4 matching, Artifact B access) now return HTTP 200 for this actor.

**Extensions:**
- [IF `available_balance < 500,000 VND`] 422 returned with `top_up_url`; actor redirected to `UC02`.
- [IF subscription was previously expired with an active engagement] Existing engagement grandfathered; new gated features re-enabled on activation.

**Includes:**
- `<<include>> UC02` — called as prerequisite redirect if wallet balance insufficient.

**Postconditions:**
- `users.subscription_client_tier = 'pro'`; `sub_client_expires_at` set to now + 6 months.
- `UC01`, `UC04`, `UC08`, `UC10` now accessible.

> **Scope note:** No `user_subscriptions` audit table in MVP. Subscription state is stored directly as columns on `users`. The `wallet_transactions.reference_id = 'SUB-{user_id}:client'` entry provides the audit trail.

---

### UC04 — View Artifact A and Expert Shortlist

**Primary Actor:** CLIENT / CEO (primary); CLIENT / TECH_TEAM (read access)  
**Feature reference:** F4, F5  
**Subscription gate:** Client Pro required to view seam gap maps; project must be PUBLISHED.

**Preconditions:**
1. `active_role = CLIENT` (CEO or TECH_TEAM).
2. `projects.state = 'PUBLISHED'`.
3. Composite match shortlist exists for this project (matching engine ran after publish).

**Main Success Scenario:**
1. Actor opens Project Dashboard. System returns `projects.artifact_a_json` (business intent, architecture category, stack tags, volume tier, SDLC milestone framework, Artifact B escrow notice).
2. Actor views expert shortlist: 3–5 match cards. Each card shows: match strength label (Strong / Qualified / Conditional per §0.5 thresholds), domains covered at required depth, seam coverage grid color-coded per tier (Amber = Tier 2 Evidence-backed, Yellow = Tier 1 Claimed, Red = Absent — no Green/Verified in MVP since Tier 3/4 are deferred), known gaps named explicitly.
3. Numeric composite scores are internal; actor sees only the three-tier strength label.
4. Actor can navigate to any expert's full profile from the match card.

**Extensions:**
- [IF a seam gap map entry is Red (absent)] Artifact A includes a note that this load-bearing seam is unclaimed; expert shortlist display will show a Conditional or lower match strength.

**Postconditions:**
- No state change — read-only.
- Actor informed of shortlisted experts; ready to send pre-bid questions (`UC05`) or initiate connection (`UC07`).

---

### UC05 — Respond to Pre-Bid Technical Questions via Messages Channel

**Primary Actor:** CLIENT / CEO  
**Feature reference:** F9 (messages channel as Surface A replacement)  
**Subscription gate:** None.

**Preconditions:**
1. `active_role = CLIENT`, `client_subtype = CEO`.
2. An expert in the project shortlist has posted a pre-bid question in the project-level messages channel.
3. `projects.state = 'PUBLISHED'`.

**Main Success Scenario:**
1. Actor receives notification that an expert has a pre-bid technical question.
2. Actor opens the project messages channel; reads the expert's question.
3. Actor types a response and submits. `messages` row inserted `{ sender_id: ceo_id, content: response_text }`.
4. Expert receives the reply in the same channel in real time via Socket.io.

**Extensions:**
- [IF the question is technical in nature (architecture, stack)] CEO may defer to TECH_TEAM's response via `UC05t`; both responses visible in the shared channel.

**Postconditions:**
- `messages` row written. Expert can use the answer to inform their bid submission (`UC18`).

> **Scope note:** There is no `spec_clarifications` table in the MVP. All pre-bid technical questions between expert and client are handled through the shared `messages` channel. The Surface A spec clarification surface from the full spec is deferred to Phase 2.

---

### UC06 — Review TECH_TEAM Bid Analysis; Set ceo_status (APPROVED / DECLINED)

**Primary Actor:** CLIENT / CEO  
**Feature reference:** F6 bid state machine — CEO_REVIEW phase  

**Preconditions:**
1. `capability_bids.tech_status = 'APPROVED'` (CEO_REVIEW only unlocks after TECH_TEAM approval — route-level guard enforces this).
2. `capability_bids.ceo_status = 'PENDING'`.
3. `active_role = CLIENT`, `client_subtype = CEO`.

**Main Success Scenario:**
1. Actor is notified "TECH_TEAM has approved this bid — your review is now unlocked."
2. Actor opens CEO Review panel: sees match card, `capability_bids.footprint_alignment_json` (Component 1), `approach_summary` (Component 2), `conditional_pricing_json` (Component 3), and any `tech_feedback` written by TECH_TEAM.
3. Actor optionally writes `negotiated_price_vnd` (see `UC06n`).
4. Actor sets `ceo_status = 'APPROVED'` or `'DECLINED'`.
   - APPROVED: `capability_bids.state → 'SELECTED'`; all other bids for this project → `'DECLINED'`; connection flow initiated (`UC07`).
   - DECLINED: `capability_bids.state → 'DECLINED'`; expert notified.

**Route guard:** `PUT /bids/{id}/ceo-decision` returns 422 `"Tech review not complete"` if `capability_bids.tech_status != 'APPROVED'`.

**Extensions:**
- `UC06n` [EXTEND — optional before setting ceo_status] CEO writes a counter-offer price.

**Postconditions:**
- `capability_bids.ceo_status` set to `'APPROVED'` or `'DECLINED'`.
- If APPROVED: `capability_bids.state = 'SELECTED'`; all competing bids declined; `UC07` triggered.

> **Scope note:** Surface D (TECH_TEAM Not Recommended override), Surface C (multi-round price negotiation table), and `bid_conflict_overrides` / `price_negotiations` tables from the full spec are **[DEFERRED — Phase 2]**. In the MVP, CEO simply cannot set `ceo_status` until `tech_status = 'APPROVED'`. If TECH_TEAM flags REVISION_REQUESTED, the expert revises until TECH_TEAM is satisfied; there is no override path for the CEO to bypass a REVISION_REQUESTED state.

---

### UC06n — Write Counter-Offer in negotiated_price_vnd (Optional, One Round)

**Primary Actor:** CLIENT / CEO  
**Feature reference:** F6 — `capability_bids.negotiated_price_vnd` column  
**Extends:** UC06 at the CEO Review step (optional before setting `ceo_status`).

**Preconditions:**
1. `capability_bids.tech_status = 'APPROVED'` and `ceo_status = 'PENDING'`.
2. `capability_bids.negotiated_price_vnd IS NULL` (one round only; cannot overwrite).
3. `active_role = CLIENT`, `client_subtype = CEO`.

**Main Success Scenario:**
1. Actor reviews conditional milestone pricing in the bid. Actor decides to propose a different total price.
2. Actor enters a numeric value in the `negotiated_price_vnd` field on the CEO Review panel; submits.
3. NestJS: `UPDATE capability_bids SET negotiated_price_vnd = {value}`. Expert notified.
4. Expert reads the counter-offer value. Expert may accept and proceed, or the actor simply approves/declines the bid as-is — there is no formal counter-counter-offer round.

**Postconditions:**
- `capability_bids.negotiated_price_vnd` set (immutable after first write).
- Expert informed; final decision on `ceo_status` follows.

> **Scope note:** This is a single-column mechanism replacing the full `price_negotiations` table (multi-round, structured proposals). The MVP supports exactly one counter-offer value, no structured per-milestone breakdown, and no EXPERT counter-counter round. Any further negotiation must happen in the messages channel.

---

### UC07 — Send Connection Request; Complete NDA Click-Through

**Primary Actor:** CLIENT / CEO  
**Feature reference:** F5 connection flow  

**Preconditions:**
1. `capability_bids.state = 'SELECTED'` (bid approved via UC06).
2. `engagements.state = 'PENDING'` (created when bid was submitted).
3. Expert has not yet accepted or declined.

**Main Success Scenario:**
1. System auto-sends connection request to expert on bid selection (no additional CEO action).
2. Expert receives notification; reviews `artifact_a_json` (Artifact B is still inaccessible); accepts connection via `UC19`.
3. Expert NDA click-through: `engagements.expert_nda_accepted_at = now()` set.
4. CEO NDA click-through: actor acknowledges NDA checkbox. `engagements.client_nda_accepted_at = now()` set.
5. NestJS guard: both NDA timestamps set → `engagements.state = 'CONNECTED'`; `engagements.connected_at = now()`.
6. [IF expert's `sepay_bank_account_xid IS NULL`] System displays a prompt for expert to complete Bank Hub linking before work begins (non-blocking for connection itself).
7. Artifact B route guard unlocks: FastAPI now returns `projects.artifact_b_json` to EXPERT and TECH_TEAM requests where `engagement.state >= 'CONNECTED'` AND both NDA timestamps are set AND `requester.active_role IN ('EXPERT', 'TECH_TEAM')`.

**Extensions:**
- [IF expert declines connection] `engagements.state` remains `'PENDING'` (or set to `'DECLINED'`); CEO notified; can select another expert from shortlist if available.

**Postconditions:**
- `engagements.state = 'CONNECTED'`; `client_nda_accepted_at` and `expert_nda_accepted_at` both set.
- `artifact_b_json` accessible by EXPERT and TECH_TEAM (CEO permanently excluded at route level).
- Messaging channel active for this engagement (`UC-G2`).

---

### UC08 — Fund Milestone via Per-Milestone VA QR

**Primary Actor:** CLIENT / CEO  
**Feature reference:** F10 — IPN MILESTONE branch  

**Preconditions:**
1. `engagements.state = 'CONNECTED'` or `'ACTIVE'`.
2. `milestones.state = 'DEFINED'` (acceptance criteria and DoD items set).
3. `active_role = CLIENT`, `client_subtype = CEO`.

**Main Success Scenario:**
1. Actor clicks "Fund Milestone {n}." NestJS calls SePay VA creation API: `INSERT virtual_accounts { entity_type: 'MILESTONE', entity_id: milestone_id, fixed_amount: payment_amount_vnd, expires_at: now() + 24h, status: 'ACTIVE' }`. `milestones.state → 'AWAITING_PAYMENT'`; `milestones.va_number` and `va_expires_at` set.
2. System returns VietQR for the exact `fixed_amount` (bank enforces amount; wrong amounts rejected at source).
3. Actor scans QR with banking app; transfers exact amount.
4. SePay IPN fires: `POST /webhooks/sepay/ipn` (HMAC-verified).
5. NestJS IPN MILESTONE branch: validates `amount == va.fixed_amount`; runs idempotency check via `wallet_tx_idempotency` unique index.
6. DB transaction (atomic): `wallets.available_balance -= amount`; `wallets.locked_balance += amount` (client wallet); `wallet_transactions { transaction_type: 'ESCROW_LOCK', reference_id: 'ESC_LOCK:{milestone_id}' }`; `escrow_accounts { milestone_id, amount, client_wallet_id, expert_wallet_id, status: 'HELD', held_at: now() }`; `milestones.state → 'FUNDED'`; auto-advance `milestones.state → 'IN_PROGRESS'`; `milestones.funded_at = now()`.
7. IPN handler also: `UPDATE paygated_documents SET release_state = 'RELEASED' WHERE milestone_id = ? AND release_state = 'STAGED'`. TECH_TEAM document inbox updated.
8. [IF this is the first milestone funded for this engagement] `engagements.state → 'ACTIVE'`.
9. NestJS returns HTTP 200 to SePay synchronously. Both parties notified.

**Extensions:**
- [IF `virtual_accounts.expires_at` has passed] `virtual_accounts.status = 'EXPIRED'`; actor must re-click "Fund" to generate a new VA.

**Postconditions:**
- `milestones.state = 'IN_PROGRESS'`; `escrow_accounts.status = 'HELD'`.
- `wallets.locked_balance` increased; `available_balance` decreased (client wallet, atomic).
- Staged pay-gated documents for this milestone released to TECH_TEAM.
- Expert can begin work; DoD checklist creation unlocked (`UC21`).

---

### UC09 — Approve Business Milestones; Triggers Escrow Release + Chi Hộ

**Primary Actor:** CLIENT / CEO (for `sign_off_authority = 'CEO'` or `'JOINT'` milestones)  
**Feature reference:** F7 Layer 1, F10 escrow release  

**Preconditions:**
1. `milestones.state = 'SUBMITTED'`.
2. `milestones.sign_off_authority = 'CEO'` OR `'JOINT'`.
3. For JOINT: TECH_TEAM has already set `verified_at` on all its required criteria (`UC08t` completed for TECH_TEAM criteria).
4. `active_role = CLIENT`, `client_subtype = CEO`.

**Main Success Scenario:**
1. Actor notified: "Expert has submitted Milestone {n} for your review."
2. Actor opens milestone review panel; reads deliverable statement and submitted files from `milestone_submissions`.
3. Actor verifies each `is_required = true` criterion in `acceptance_criteria`: sets `verified_at = now()`.
4. [IF criterion not satisfactory] Actor writes `acceptance_criteria.revision_note`; `milestones.state → 'IN_REVISION'`; expert notified.
5. [When final required criterion verified] NestJS APPROVED guard: `SELECT COUNT(*) FROM acceptance_criteria WHERE milestone_id = ? AND is_required = true AND verified_at IS NULL` → if > 0, returns 422 `UNVERIFIED_CRITERIA` with structured list.
6. All required criteria verified → DB transaction (atomic — reads `platform_settings.platform_fee_pct`): `wallets.locked_balance -= amount` (client); `wallets.available_balance += amount * (1 - fee_pct)` (expert); `wallets.available_balance += amount * fee_pct` (platform wallet referenced by `platform_settings.platform_wallet_id`); three `wallet_transactions` rows: `ESCROW_RELEASE`, `PLATFORM_FEE`, expert credit via `ESCROW_RELEASE`; `escrow_accounts.status → 'RELEASED'`; `milestones.state → 'APPROVED'`; `milestones.approved_at = now()`.
7. COMMIT → chi hộ API called asynchronously: `POST SePay chi hộ { amount: net, bank_account_xid, reference: 'WD-{withdrawal_id}' }`. `withdrawal_requests { type: 'MILESTONE_RELEASE', status: 'PENDING' }` created.
8. SePay credit IPN fires: `withdrawal_requests.status → 'COMPLETED'`; `milestones.state → 'RELEASED'`; `milestones.released_at = now()`.
9. [IF all milestones for engagement are `RELEASED`] `engagements.state → 'CLOSED'`.

**Extensions:**
- [IF actor files a dispute instead of approving] `UC-G4` — `escrow_accounts.status → 'FROZEN'`; `milestones.state → 'DISPUTED'`.

**Postconditions:**
- `milestones.state = 'RELEASED'` (after chi hộ IPN confirms).
- Expert's `wallets.available_balance` credited net of 5% platform fee.
- `withdrawal_requests.status = 'COMPLETED'`; chi hộ transfer completed. Zero admin involvement.

---

### UC10 — Buy Expert Service Directly (SERVICE_PURCHASE or TECH_DISCOVERY)

**Primary Actor:** CLIENT / CEO  
**Feature reference:** F3 Path B, F10 IPN SERVICE branch  
**Subscription gate:** Free tier — no subscription required for Path B.

**Preconditions:**
1. `active_role = CLIENT`, `client_subtype = CEO`.
2. `services.state = 'PUBLISHED'`.
3. Actor has reviewed the service listing (via `UC-G1`).

**Main Success Scenario:**
1. Actor clicks "Buy Service" on a service card. `POST /services/{id}/purchase`.
2. NestJS guard: `active_role = 'CLIENT'` AND `client_subtype = 'CEO'` (TECH_TEAM cannot purchase).
3. DB transaction: `INSERT engagements { service_id, expert_id, type: service.service_type, state: 'PENDING', project_id: NULL }`; `INSERT virtual_accounts { entity_type: 'SERVICE', entity_id: engagement_id, fixed_amount: service.price_vnd, expires_at: now() + 24h }`. System returns VietQR.
4. Actor scans QR; transfers exact amount.
5. SePay IPN fires: NestJS IPN SERVICE branch. Validates `amount == va.fixed_amount`. DB transaction (atomic): `wallet_transactions { transaction_type: 'ESCROW_LOCK' }`; `wallets.locked_balance += amount` (client); `INSERT escrow_accounts { engagement_id (not milestone_id), status: 'HELD' }`; `INSERT milestones { engagement_id, milestone_number: 1, sign_off_authority: 'CEO', payment_amount_vnd, state: 'FUNDED' }`; `engagements.state → 'ACTIVE'`. Expert notified: "New service order received."

**Extensions:**
- [IF `service.service_type = 'TECH_DISCOVERY'`] After engagement closes, CEO receives architecture document; may optionally resume an existing elicitation session at Stage 4.
- [IF wallet balance is insufficient] `UC02` triggered.

**Includes:**
- `<<include>> UC-G1` — actor browses marketplace before purchasing.
- `<<include>> UC02` — conditional redirect if wallet balance insufficient.

**Postconditions:**
- `engagements.state = 'ACTIVE'`; `type = 'SERVICE_PURCHASE'` or `'TECH_DISCOVERY'`.
- `escrow_accounts.status = 'HELD'` (linked to `engagement_id`, not `milestone_id` — Path B escrow).
- Single milestone created in `FUNDED` state; CEO sole sign-off authority; no bid, no TECH_TEAM involvement.

---

### UC11 — Complete Post-Engagement Review (CEO Form)

**Primary Actor:** CLIENT / CEO  
**Feature reference:** F11  

**Preconditions:**
1. `engagements.state = 'CLOSED'`.
2. No `reviews` row exists for this engagement with `reviewer_id = ceo_user_id` (unique constraint enforced).
3. `active_role = CLIENT`, `client_subtype = CEO`.

**Main Success Scenario:**
1. Actor receives notification to leave a review.
2. Actor opens CEO review form: Overall rating (1–5 stars), Communication clarity rating, Milestone structure effectiveness rating, open text comment.
3. Actor submits. `INSERT reviews { engagement_id, reviewer_id: ceo_id, target_id: expert_id, rating, comment, reviewer_role: 'CEO', structured_signals_json: NULL }`.
4. Expert's public reputation display updated (average rating, engagement completion count).

**Postconditions:**
- `reviews` row written; `UNIQUE(engagement_id, reviewer_id)` enforced.
- Expert reputation aggregates updated. CEO review data feeds F12 analytics.

---

## Part B — CLIENT / TECH_TEAM Flows

---

### UC04t — View Artifact B Post-Connection

**Primary Actor:** CLIENT / TECH_TEAM  
**Feature reference:** F5  

**Preconditions:**
1. `engagements.state ≥ 'CONNECTED'`.
2. `engagements.client_nda_accepted_at IS NOT NULL` AND `engagements.expert_nda_accepted_at IS NOT NULL`.
3. `active_role = CLIENT`, `client_subtype = TECH_TEAM`.

**Main Success Scenario:**
1. TECH_TEAM opens Tech Dashboard. "Project Blueprint" panel now active (was locked before connection).
2. System (FastAPI Artifact B route guard) verifies: engagement state ≥ CONNECTED, both NDA timestamps set, requester role is `TECH_TEAM`. Returns `projects.artifact_b_json`.
3. Actor reads technical blueprint: TECH_TEAM's schemas, payload samples, integration contracts, sensitive uploads from Stage 4.
4. Released pay-gated documents (if milestone has been funded) are also visible in the document inbox.

**Route guard:** `GET /projects/{id}/artifact-b` — FastAPI checks engagement state, NDA timestamps, and requester role before returning the JSONB field. CEO `active_role = CLIENT/CEO` receives HTTP 403 regardless of engagement state.

**Postconditions:** No state change — read-only access.

---

### UC05t — Answer Pre-Bid Technical Questions via Messages Channel

**Primary Actor:** CLIENT / TECH_TEAM  
**Feature reference:** F9  

**Preconditions:**
1. `active_role = CLIENT`, `client_subtype = TECH_TEAM`.
2. An expert has posted a pre-bid technical question in the project messages channel.

**Main Success Scenario:**
1. Actor receives notification of a pending technical question from an expert.
2. Actor opens the project messages channel; reads the expert's architecture or integration question.
3. Actor types technical answer; submits. `INSERT messages { sender_id: tech_team_id, content: response_text }`.
4. Expert and CEO both receive the response in real time via Socket.io.

**Postconditions:**
- `messages` row written. Expert can use the technical clarification when preparing their bid (`UC18`).

---

### UC06a — Review Capability Bids — Seam Analysis; Set tech_status + tech_feedback

**Primary Actor:** CLIENT / TECH_TEAM  
**Feature reference:** F6 bid state machine — TECH_TEAM review phase  

**Preconditions:**
1. `capability_bids.state = 'SUBMITTED'`; `tech_status = 'PENDING'`.
2. `active_role = CLIENT`, `client_subtype = TECH_TEAM`.

**Main Success Scenario:**
1. TECH_TEAM notified: "A new bid has been submitted for your technical review."
2. Actor opens bid review panel: sees `footprint_alignment_json` (Component 1), `approach_summary` (Component 2), `conditional_pricing_json` (Component 3), and the expert's seam gap map.
3. Actor reviews bid against their knowledge of the actual system architecture.
4. [IF satisfied] Actor sets `tech_status = 'APPROVED'`. `PUT /bids/{id}/tech-review`. CEO_REVIEW unlocked for this bid; CEO notified.
5. [IF concerns] Actor writes `tech_feedback` text and sets `tech_status = 'REVISION_REQUESTED'`. Expert notified (routes to `UC18r`). Loop repeats on resubmission.

**Postconditions:**
- `capability_bids.tech_status = 'APPROVED'` → CEO_REVIEW unlocked; CEO notified.
- `capability_bids.tech_status = 'REVISION_REQUESTED'` → `tech_feedback` written; expert reads and edits bid row in-place (`UC18r`).

> **Scope note:** `bid_revision_requests` table and Surface B revision tracking from the full spec are **[DEFERRED — Phase 2]**. In the MVP, TECH_TEAM writes revision feedback in the single `tech_feedback` TEXT column; the expert edits the bid row in-place. No immutable version history.

---

### UC07t — Access Pay-Gated Reasoning Documents (TECH_TEAM-Only Inbox)

**Primary Actor:** CLIENT / TECH_TEAM  
**Feature reference:** F5 pay-gated knowledge staging  

**Preconditions:**
1. `engagements.state ≥ 'CONNECTED'`.
2. `paygated_documents.release_state = 'RELEASED'` for the relevant milestone (triggered when CEO funded the milestone via `UC08`).
3. `active_role = CLIENT`, `client_subtype = TECH_TEAM`.

**Main Success Scenario:**
1. TECH_TEAM opens Tech Dashboard document inbox. System filters `paygated_documents WHERE milestone_id IN (milestones for this engagement) AND release_state = 'RELEASED'`.
2. Actor downloads and reads expert's staged reasoning documents (architecture design rationale, technical decision analysis).
3. Documents are read-only; no annotations in MVP (DoD item comments deferred).

**Route guard:** CEO `active_role = CLIENT/CEO` excluded at route level regardless of engagement state. Documents visible to TECH_TEAM only.

**Postconditions:** No state change — read-only. Core IP deadlock resolution: expert's full design rationale delivered to TECH_TEAM after real money moved into escrow.

---

### UC08t — Sign Off Technical Milestones Criterion by Criterion

**Primary Actor:** CLIENT / TECH_TEAM  
**Feature reference:** F7 Layer 1  

**Preconditions:**
1. `milestones.state = 'SUBMITTED'`.
2. `milestones.sign_off_authority = 'TECH_TEAM'` OR `'JOINT'`.
3. `active_role = CLIENT`, `client_subtype = TECH_TEAM`.

**Main Success Scenario:**
1. TECH_TEAM notified: "Expert has submitted Milestone {n} for technical review."
2. Actor opens milestone review panel; reads `milestone_submissions.description` and `files_json`.
3. Actor verifies criteria one by one: sets `acceptance_criteria.verified_at = now()` for each met criterion.
4. [IF a criterion is not met] Actor writes `acceptance_criteria.revision_note` (replaces cut `revision_requests` table); `milestones.state → 'IN_REVISION'`; expert notified.
5. [For JOINT milestones] Both TECH_TEAM and CEO must verify their respective criteria before the APPROVED transition. NestJS checks both sets.
6. [When all `is_required = true` criteria verified] NestJS APPROVED guard runs. If all pass: escrow release atomic transaction fires (see UC09 Steps 6–7).

**Extensions:**
- [IF dispute required] `UC-G4` — filed from `SUBMITTED` or `IN_REVISION` state.

**Postconditions:**
- Technical criteria have `verified_at` set.
- For TECH_TEAM-only milestones: APPROVED guard fires; escrow release and chi hộ triggered.
- For JOINT milestones: awaits CEO sign-off to complete the APPROVED transition.

---

### UC09t — Complete Post-Engagement Review (Structured Seam-Signal Form)

**Primary Actor:** CLIENT / TECH_TEAM  
**Feature reference:** F11  

**Preconditions:**
1. `engagements.state = 'CLOSED'`.
2. No `reviews` row exists for this engagement with `reviewer_id = tech_team_user_id`.
3. `active_role = CLIENT`, `client_subtype = TECH_TEAM`.

**Main Success Scenario:**
1. TECH_TEAM opens structured review form: Overall rating (1–5), seam-specific performance questions (e.g., "Did the expert proactively address the ground truth baseline?"), open text comment.
2. Actor submits. `INSERT reviews { engagement_id, reviewer_id: tech_team_id, target_id: expert_id, rating, comment, reviewer_role: 'TECH_TEAM', structured_signals_json: [{seam_code, signal_type, seam_role}, ...] }`.
3. `structured_signals_json` is stored and visible in the Admin Analytics dashboard (F12 Module 5). It does **not** trigger automatic seam tier upgrades in the MVP.

**Postconditions:**
- `reviews` row written; `UNIQUE(engagement_id, reviewer_id)` enforced.
- `structured_signals_json` data feeds admin research analytics only (Tier 4 accumulation deferred to Phase 2).

> **Scope note:** `expert_seam_outcome_signals` table and Tier 4 automatic signal accumulation from the full spec are **[DEFERRED — Phase 2]**. In MVP, `structured_signals_json` on `reviews` is informational only.

---

## Part C — EXPERT Flows

---

### UC12 — Create Taxonomy-Based Profile (Domains, Seams, Stack Tags)

**Primary Actor:** EXPERT  
**Feature reference:** F3  
**Subscription gate:** Free tier — profile creation available without Expert Pro.

**Preconditions:**
1. `active_role = EXPERT`; account registered.

**Main Success Scenario:**
1. Actor opens Profile Builder. Sets six capability domain declarations (DEEP / OPERATIONAL / SURFACE per domain code A–F per §0.1). `UPSERT expert_domain_depths { expert_id, domain_code, depth_level, verification_tier: 'CLAIMED' }`.
2. Actor declares seam claims (self-declared Tier 1 for each claimed seam from §0.2). `INSERT expert_seam_claims { expert_id, seam_code, verification_tier: 'CLAIMED', submission_count: 0, locked_until: NULL }`.
3. Actor sets engagement model (Advisory / Spec+review / Full implementation). Updates `expert_profiles.engagement_model`.
4. Actor adds stack tags (multi-select); updates `expert_profiles.stack_tags_json` (JSONB array, e.g., `["Python","Kafka","Go"]`).
5. Actor declares archetype history (self-declared for cold start); updates `expert_profiles.archetype_history_json` (format: `[{archetype_code, tier, self_declared: true}]`).
6. Saves; profile complete.

**Extensions:**
- `<<extend>> UC14` — actor can immediately proceed to portfolio evidence submission for Tier 2 upgrade (Expert Pro required).

**Postconditions:**
- `expert_profiles` row fully populated.
- `expert_domain_depths` rows created (`verification_tier = 'CLAIMED'`).
- `expert_seam_claims` rows created (`verification_tier = 'CLAIMED'`; Tier 1 confidence weight = 0.20 per §0.4).
- Expert discoverable in matching engine at Tier 1 weight.

---

### UC13 — Purchase Expert Pro Subscription from Wallet Balance

**Primary Actor:** EXPERT  
**Feature reference:** F1.5  
**Subscription gate:** This UC activates the gate.

**Preconditions:**
1. `active_role = EXPERT`.
2. `users.subscription_expert_tier = 'free'` OR `sub_expert_expires_at <= now()`.
3. `wallets.available_balance >= 300,000 VND` (Expert Pro price).

**Main Success Scenario:**
1. Actor opens Subscription panel; sees Expert Pro plan (300,000 VND / 6 months).
2. Actor clicks "Activate Expert Pro". Request: `POST /subscriptions/activate { role_type: "expert" }`.
3. NestJS Guard 1: already `'pro'` and not expired → 409 `ALREADY_SUBSCRIBED`.
4. NestJS Guard 2: `available_balance >= 300000` → else 422 `INSUFFICIENT_BALANCE`.
5. DB transaction (atomic): `wallets.available_balance -= 300000`; `wallet_transactions { transaction_type: 'SUBSCRIPTION', reference_id: 'SUB-{user_id}:expert' }`; `users.subscription_expert_tier = 'pro'`; `users.sub_expert_expires_at = now() + 6 months`.
6. JWT reissued. Actor notified. Features unlocked: LLM portfolio evidence verification (`UC14`), Tier 2+ project bidding (`UC18`), AI Service Generator (`UC16`), earnings analytics dashboard.

**Includes:**
- `<<include>> UC02` — conditional redirect if wallet balance insufficient.

**Postconditions:**
- `users.subscription_expert_tier = 'pro'`; `sub_expert_expires_at` set.
- `UC14`, `UC16`, `UC18` on Tier 2+ projects now accessible.

---

### UC14 — Submit Portfolio Evidence for LLM Auto-Verification (Tier 2)

**Primary Actor:** EXPERT  
**Feature reference:** F3 — Expert Verification Tier 2  
**Subscription gate:** Expert Pro required (HTTP 403 if `subscription_expert_tier = 'free'`).

**Preconditions:**
1. `active_role = EXPERT`; `users.subscription_expert_tier = 'pro'`.
2. Target seam exists in `expert_seam_claims` at `verification_tier = 'CLAIMED'` (Tier 1).
3. `expert_seam_claims.locked_until IS NULL` OR `locked_until <= now()` (not in 30-day lockout).

**Main Success Scenario:**
1. Actor selects a seam for Tier 2 upgrade; opens Portfolio Evidence form.
2. Actor fills structured decision-point questions: (a) system architecture at engagement entry, (b) 2–3 most consequential technical decisions made, (c) counterfactual consequence for each decision. Sanitization note shown.
3. Actor submits. Throttle check: `SELECT submission_count, locked_until FROM expert_seam_claims WHERE expert_id = ? AND seam_code = ?`; if `submission_count >= 5` AND `locked_until > now()` → 429 `TOO_MANY_ATTEMPTS`.
4. `INSERT portfolio_submissions { expert_id, seam_claim_id, project_description, decision_points, status: 'PENDING', submitted_at: now() }`; `UPDATE expert_seam_claims SET submission_count += 1`.
5. NestJS calls `POST /llm/portfolio-eval { project_description, decision_points, seam_code }`. FastAPI runs LLM rubric: verifies all required signal types present; computes confidence score.
6. DB transaction: `UPDATE portfolio_submissions SET llm_confidence = {score}, evaluated_at = now(), status = 'APPROVED'/'REJECTED'`.
7. [IF confidence ≥ 0.85 AND all required signal types found] `UPDATE expert_seam_claims SET verification_tier = 'EVIDENCE_BACKED'`. `INSERT platform_decisions { decision_type: 'SEAM_TIER_UPGRADE', entity_type: 'expert_seam_claims', entity_id: claim_id, llm_confidence: {score}, decision: 'APPROVED' }`. Actor notified: seam upgraded to Tier 2.
8. [IF confidence < 0.85 OR missing signal types] `INSERT platform_decisions { decision_type: 'PORTFOLIO_EVAL', decision: 'REJECTED', advisory_note: {gap advisory naming missing signal types} }`. Actor notified; `platform_decisions.advisory_note` displayed for guidance.
9. [IF `submission_count` now equals 5 AND status = 'REJECTED'] `UPDATE expert_seam_claims SET locked_until = now() + 30 days`. Actor notified of lockout.

**Postconditions (success):**
- `expert_seam_claims.verification_tier = 'EVIDENCE_BACKED'`; Tier 2 confidence factor = 0.55 per §0.4.
- `platform_decisions` row written (visible in Admin Platform Integrity Monitor).
- Expert's composite match scores recalculated on next matching engine run.

> **Scope note:** Tier 3 (Scenario Assessment, 0.80 confidence factor) and Tier 4 (Platform-demonstrated, 0.95) are **[DEFERRED — Phase 2]**. Expert verification in the MVP tops out at Tier 2 (Evidence-backed).

---

### UC15 — Link Bank Account via Bank Hub Hosted Link

**Primary Actor:** EXPERT  
**Feature reference:** F10 Bank Hub integration  

**Preconditions:**
1. `active_role = EXPERT`.
2. `users.sepay_bank_account_xid IS NULL` (bank not yet linked).

**Main Success Scenario:**
1. Actor opens "Link Bank Account" in Expert Dashboard (prompted on first withdrawal attempt, or proactively post-registration).
2. NestJS calls `POST /bank-hub/initiate-link` with expert user context. SePay returns `hosted_link_url`.
3. System presents Hosted Link URL to frontend. Actor opens the link; selects bank, enters account number, completes OTP verification (no password sharing; handled entirely by SePay WebView).
4. SePay fires `BANK_ACCOUNT_LINKED` webhook: `POST /webhooks/sepay/bank-linked { bank_account_xid, bank_account_holder_name }`.
5. NestJS: `UPDATE users SET sepay_bank_account_xid = bank_account_xid, bank_account_holder_name = name, bank_linked_at = now()`.
6. Actor notified: "Bank account linked: {bank_name} | {last 4 digits}."

**Postconditions:**
- `users.sepay_bank_account_xid` set (bank-verified, not self-reported).
- `UC23` (withdrawal) now accessible.

---

### UC16 — Publish AI Service Listing via AI Generator (Path B)

**Primary Actor:** EXPERT  
**Feature reference:** F3 Path B, AI Service Generator  
**Subscription gate:** Expert Pro required for the AI generator route; manual listing creation available for all Expert tiers.

**Preconditions:**
1. `active_role = EXPERT`.
2. `expert_profiles` row exists (`UC12` completed).
3. For AI generator: `subscription_expert_tier = 'pro'`.

**Main Success Scenario:**
1. Actor opens "Create Service Listing."
2. [AI generator route — Expert Pro] Actor inputs key capabilities and target use cases. NestJS calls `POST /llm/service-generate { capabilities, use_cases }`. FastAPI LLM generates structured description: `{ title, description, scope, timeline, suggested_price }`. `INSERT services { state: 'DRAFT', service_type: 'AI_SERVICE' }`.
3. Actor reviews and edits generated draft. Sets final price (VND), `service_type` (`AI_SERVICE` or `TECH_DISCOVERY`), relevant `domains_json` and `seams_json`.
4. Actor publishes: `PUT /services/{id}` → `UPDATE services SET state = 'PUBLISHED'`.
5. Service listing visible in `UC-G1` Path B marketplace.

**Postconditions:**
- `services.state = 'PUBLISHED'`.
- Listing discoverable by CEO browsing the marketplace.

---

### UC17 — Browse Project Shortlist; Ask Pre-Bid Questions via Messages Channel

**Primary Actor:** EXPERT  
**Feature reference:** F4, F9  
**Subscription gate:** Expert Pro for Tier 2+ project bids.

**Preconditions:**
1. `active_role = EXPERT`.
2. Expert appears in composite match shortlist for a project (matching engine placed them there).
3. `projects.state = 'PUBLISHED'`.

**Main Success Scenario:**
1. Actor receives bid invitation notification; opens project shortlist view.
2. Actor views `projects.artifact_a_json` and their personal seam gap map.
3. [Optional — before bidding] Actor has a technical question about the project. Actor opens the project messages channel and posts the question. `INSERT messages { sender_id: expert_id, content: question_text }`.
4. CEO (`UC05`) or TECH_TEAM (`UC05t`) responds in the same channel.
5. Actor reads responses; decides whether to proceed with bid submission.

**Extensions:**
- `<<extend>> UC18` — after gathering needed information, actor proceeds to submit bid.

**Postconditions:**
- `messages` rows written (if questions were asked). Expert informed; no formal state change on the project or engagement.

> **Scope note:** There is no `spec_clarifications` table. All pre-bid questions go through the shared messages channel. No `status = OPEN/ANSWERED/RESOLVED` tracking per question in the MVP.

---

### UC18 — Submit Structured Capability Bid (3 Required Components)

**Primary Actor:** EXPERT  
**Feature reference:** F6 bid submission  
**Subscription gate:** Expert Pro required for Tier 2+ project bids.

**Preconditions:**
1. `active_role = EXPERT`; `subscription_expert_tier = 'pro'` for Tier 2+ projects.
2. Expert in project's match shortlist.
3. `projects.state = 'PUBLISHED'`.

**Main Success Scenario:**
1. Actor opens bid form. Footprint alignment section pre-populated from `expert_seam_claims` and `expert_domain_depths`.
2. **Component 1 — Footprint Alignment Statement** (`footprint_alignment_json`): Actor confirms domain depth alignment and seam claims. Any Tier 1 claim on a load-bearing seam is flagged: *"This seam is load-bearing for this project. Your Tier 1 claim will be visible. Consider Tier 2 verification first."*
3. **Component 2 — Architectural Approach Summary** (`approach_summary TEXT`): Actor writes approach addressing the SDLC milestone framework from Artifact A. Must not include proprietary design (Artifact B is not yet accessible).
4. **Component 3 — Conditional Milestone Pricing** (`conditional_pricing_json`): Actor enters structured per-milestone pricing. Free-text "TBD" values rejected with 422.
5. Actor submits. `POST /bids`. NestJS validates: all 3 components present — 422 if any missing.
6. `INSERT engagements { project_id, expert_id, type: 'PROJECT_BASED', state: 'PENDING' }`. `INSERT capability_bids { engagement_id, footprint_alignment_json, approach_summary, conditional_pricing_json, state: 'SUBMITTED', tech_status: 'PENDING', ceo_status: 'PENDING', version_number: 1 }`. UNIQUE constraint on `engagement_id` enforces one bid per engagement.
7. TECH_TEAM notified (`UC06a` triggered).

**Extensions:**
- `UC18r` [EXTEND — after `tech_status = 'REVISION_REQUESTED'`] Expert edits bid row in-place.

**Postconditions:**
- `capability_bids.state = 'SUBMITTED'`; `tech_status = 'PENDING'`; `ceo_status = 'PENDING'`.
- TECH_TEAM notified; `UC06a` triggered.

---

### UC18r — Edit Bid Row After tech_feedback Received; Reset tech_status → PENDING

**Primary Actor:** EXPERT  
**Feature reference:** F6 — mutable bid row revision  
**Extends:** UC18 at `tech_status = 'REVISION_REQUESTED'` state.

**Preconditions:**
1. `capability_bids.tech_status = 'REVISION_REQUESTED'`.
2. `capability_bids.tech_feedback IS NOT NULL` (written by TECH_TEAM).
3. `active_role = EXPERT`.

**Main Success Scenario:**
1. Actor receives notification: "TECH_TEAM has requested bid revision — {tech_feedback text}."
2. Actor opens bid form. All three bid components are editable (mutable row — no component locking in MVP).
3. Actor reads `tech_feedback`; updates the relevant bid components (`footprint_alignment_json`, `approach_summary`, and/or `conditional_pricing_json`).
4. Actor submits revision. `PUT /bids/{id}`. NestJS: `UPDATE capability_bids SET {updated_components}, tech_status = 'PENDING', version_number += 1`.
5. TECH_TEAM notified; loop returns to `UC06a` TECH_REVIEW.

**Postconditions:**
- `capability_bids.tech_status = 'PENDING'`; `version_number` incremented.
- TECH_TEAM review loop continues.

> **Scope note:** `bid_versions` (immutable version snapshots) and `bid_revision_requests` (per-component flagging) tables are **[DEFERRED — Phase 2]**. In the MVP, revisions are mutable in-place updates on the single `capability_bids` row. `version_number` increments as a lightweight counter. No immutable audit trail of previous component values.

---

### UC19 — Accept Connection; View Artifact B

**Primary Actor:** EXPERT  
**Feature reference:** F5 connection flow  

**Preconditions:**
1. `engagements.state = 'PENDING'` (connection request sent by CEO via `UC07`).
2. `active_role = EXPERT`.

**Main Success Scenario:**
1. Actor receives connection request notification; views `projects.artifact_a_json` (Artifact B still inaccessible).
2. Actor reviews Artifact A fully and decides to accept.
3. Actor accepts: `PUT /engagements/{id}/connect`. NDA click-through presented; actor checks acknowledgment box. `engagements.expert_nda_accepted_at = now()`.
4. [When CEO also completes NDA via `UC07`] `engagements.state → 'CONNECTED'`; `connected_at = now()`.
5. FastAPI Artifact B route guard now satisfied: returns `projects.artifact_b_json` to this actor.
6. Actor reviews Artifact B: TECH_TEAM's schemas, payload samples, integration contracts, sensitive uploads from Stage 4.

**Extensions:**
- [IF actor declines] `engagements.state` updated to declined; CEO notified; CEO can select another expert from shortlist.

**Postconditions:**
- `engagements.state = 'CONNECTED'`; `expert_nda_accepted_at` set.
- Actor can access `artifact_b_json`.
- Messaging channel active for this engagement (`UC-G2`).

---

### UC20 — Stage Pay-Gated Reasoning Documents with Milestone Release Trigger

**Primary Actor:** EXPERT  
**Feature reference:** F5 pay-gated knowledge staging  

**Preconditions:**
1. `engagements.state ≥ 'CONNECTED'`.
2. `active_role = EXPERT`.
3. Target `milestones` row exists for this engagement.

**Main Success Scenario:**
1. Actor opens staging panel; uploads architecture design rationale document(s) (file stored; `document_url` generated).
2. Actor tags each document with a milestone release trigger (milestone number selection).
3. `INSERT paygated_documents { milestone_id, document_url, release_state: 'STAGED', staged_at: now() }`.
4. Documents remain in STAGED state until SePay IPN confirms milestone funding.
5. When CEO funds the tagged milestone (`UC08` Step 7): NestJS IPN handler runs `UPDATE paygated_documents SET release_state = 'RELEASED', released_at = now() WHERE milestone_id = ? AND release_state = 'STAGED'`. Document becomes visible in TECH_TEAM document inbox (`UC07t`). CEO permanently excluded.

**Postconditions:**
- `paygated_documents.release_state = 'STAGED'` initially; auto-advances to `'RELEASED'` when IPN confirms milestone FUNDED.
- Core IP deadlock resolution: expert discloses full design rationale; TECH_TEAM receives it only after real money entered escrow.

---

### UC21 — Create DoD Checklist for Funded Milestone

**Primary Actor:** EXPERT  
**Feature reference:** F7 Layer 2  

**Preconditions:**
1. `milestones.state = 'IN_PROGRESS'` (funded; IPN confirmed via `UC08`).
2. `active_role = EXPERT`.

**Main Success Scenario:**
1. Actor opens Milestone Management panel; sees "Create DoD Checklist" prompt.
2. Actor creates checklist items: `item_description`, `is_required` (boolean). For `is_required = true` items: `completion_note` will be mandatory on completion.
3. `INSERT milestone_dod_items { milestone_id, item_description, is_required, status: 'PENDING' }` for each item.
4. [Optional] Actor maps DoD items to acceptance criteria: `milestone_dod_items.maps_to_criterion_id = acceptance_criteria.id`.
5. Actor iterates on DoD items during work: `PUT /milestones/{id}/dod/{itemId}` → `UPDATE milestone_dod_items SET status = 'COMPLETED', completed_at = now(), completion_note = {text}` (note mandatory for required items). DB CHECK constraint enforced: `NOT (is_required = TRUE AND status = 'NOT_APPLICABLE')`.
6. TECH_TEAM can view checklist in read-only mode. CEO cannot see DoD items.

**Postconditions:**
- `milestone_dod_items` rows created with `status = 'PENDING'`.
- TECH_TEAM can view checklist (read-only).

> **Scope note:** Sprint tracking (Layer 3: `milestone_sprints`, `sprint_status_updates` tables, weekly sprint status updates, SCOPE_EVOLUTION flag, Add-On Phase Protocol) is **[DEFERRED — Phase 2]**. The MVP implements Layer 2 (DoD checklist) only. DoD item comments (`dod_item_comments`) are also deferred; TECH_TEAM uses the messages channel for DoD-related discussion.

---

### UC22 — Submit Milestone Deliverable (DoD Gate Enforced at Route Level)

**Primary Actor:** EXPERT  
**Feature reference:** F7 Layers 1 & 2  

**Preconditions:**
1. `milestones.state = 'IN_PROGRESS'`.
2. All `is_required = true` DoD items have `status = 'COMPLETED'` AND `completed_at IS NOT NULL` (route-level guard enforced).
3. `active_role = EXPERT`.

**Main Success Scenario:**
1. Actor marks all required DoD items COMPLETED with completion notes; non-required items marked COMPLETED or NOT_APPLICABLE with notes (DB CHECK enforces no required item is NOT_APPLICABLE).
2. Actor clicks "Submit Milestone Deliverable": description and file attachments (`files_json`).
3. NestJS DoD guard: `SELECT COUNT(*) FROM milestone_dod_items WHERE milestone_id = ? AND is_required = true AND status != 'COMPLETED'`. If count > 0 → 422 `DOD_INCOMPLETE` with structured list of unchecked required items. Submission blocked.
4. [IF all required items COMPLETED] `INSERT milestone_submissions { milestone_id, expert_id, description, files_json, submitted_at: now() }`. `UPDATE milestones SET state = 'SUBMITTED', submitted_at = now()`. Sign-off authority notified.

**Extensions:**
- [IF dispute required after submission] `UC-G4` — filed from `SUBMITTED` or `IN_REVISION` state.

**Postconditions:**
- `milestones.state = 'SUBMITTED'`.
- Sign-off authority (TECH_TEAM, CEO, or both per `sign_off_authority` field) notified.

---

### UC23 — Request Withdrawal (Chi Hộ Fires Automatically)

**Primary Actor:** EXPERT  
**Feature reference:** F10 — Expert withdrawal flow  

**Preconditions:**
1. `active_role = EXPERT`.
2. `users.sepay_bank_account_xid IS NOT NULL` (`UC15` completed).
3. `wallets.available_balance >= requested_amount` AND requested amount > 0.

**Main Success Scenario:**
1. Actor opens Wallet panel; clicks "Withdraw"; enters `amount_vnd`.
2. NestJS Guard 1: `sepay_bank_account_xid IS NULL` → 422 with redirect to `UC15`.
3. NestJS Guard 2: `available_balance < amount` → 422 `INSUFFICIENT_BALANCE`.
4. DB transaction (atomic): `UPDATE wallets SET available_balance -= amount`; `INSERT wallet_transactions { transaction_type: 'WITHDRAWAL', amount, reference_id: 'WD-{withdrawal_id}' }`; `INSERT withdrawal_requests { expert_id, type: 'EXPERT_MANUAL', amount, bank_account_xid, status: 'PENDING', requested_at: now() }`. COMMIT.
5. After commit (async): NestJS calls `POST SePay chi hộ { amount, bank_account_xid, reference: 'WD-{id}' }`. `UPDATE withdrawal_requests SET disbursement_id = {id}, status = 'PROCESSING'`.
6. SePay processes; credit IPN fires on expert's linked bank account.
7. NestJS IPN handler: `UPDATE withdrawal_requests SET status = 'COMPLETED', confirmed_at = now()`. Actor notified: "Withdrawal of {amount} VND completed."

**Extensions:**
- [IF chi hộ API returns error] DB transaction: `UPDATE wallets SET available_balance += amount` (atomic rollback); `UPDATE withdrawal_requests SET status = 'FAILED'`. Actor notified: "Withdrawal failed. Balance restored."

**Includes:**
- `<<include>> UC15` — called as prerequisite redirect if `bank_account_xid IS NULL`.

**Postconditions (success):**
- `withdrawal_requests.status = 'COMPLETED'`.
- Funds transferred to expert's verified linked bank account. Zero admin involvement.

---

### UC24 — Complete Post-Engagement Review (Expert Form)

**Primary Actor:** EXPERT  
**Feature reference:** F11  

**Preconditions:**
1. `engagements.state = 'CLOSED'`.
2. No `reviews` row exists for this engagement with `reviewer_id = expert_user_id`.
3. `active_role = EXPERT`.

**Main Success Scenario:**
1. Actor opens review form: Overall rating (1–5), Milestone approval responsiveness (sign-off timeliness), Technical information availability ("Was Artifact B complete and accurate when you first accessed it?"), CEO communication clarity, open text.
2. Actor submits. `INSERT reviews { engagement_id, reviewer_id: expert_id, target_id: ceo_id, rating, comment, reviewer_role: 'EXPERT', structured_signals_json: NULL }`.
3. Client-side reputation signals updated (approval cycle time averages).

**Postconditions:**
- `reviews` row written; `UNIQUE(engagement_id, reviewer_id)` enforced.

---

## Part D — Dual-Role Flows

---

### UC-DR1 — Add Second Role to Account

**Primary Actor:** CLIENT / CEO (adding EXPERT role) or EXPERT (adding CLIENT_CEO role)  
**Feature reference:** F1 dual-role  

**Preconditions:**
1. Actor is authenticated; `users.roles` array currently has one role.
2. Actor wants to hold both `CLIENT_CEO` and `EXPERT` roles on the same account.

**Main Success Scenario:**
1. Actor opens "Account Settings → Add Role."
2. System presents identity verification step.
3. On verification: `UPDATE users SET roles = '["CLIENT_CEO","EXPERT"]'`. Role switcher appears in persistent top nav.
4. Two separate subscription tiers may exist (`subscription_client_tier` + `subscription_expert_tier` on the same `users` row); both deduct from the same `wallets` row.

**Postconditions:**
- `users.roles = ["CLIENT_CEO","EXPERT"]`.
- Role switcher enabled.
- Self-exclusion guard active: matching engine `WHERE expert.user_id NOT IN (SELECT client_id FROM projects WHERE id = ?)` regardless of `active_role`.

---

### UC-DR2 — Switch Active Role via Role Switcher

**Primary Actor:** Dual-role user (CLIENT_CEO + EXPERT)  
**Feature reference:** F1 role switcher  

**Preconditions:**
1. `LENGTH(users.roles) > 1`.
2. Role switcher visible in top nav.

**Main Success Scenario:**
1. Actor clicks role switcher toggle.
2. NestJS reissues JWT with `active_role` updated to selected role (no re-login required).
3. React re-renders dashboard for new role context (CEO dashboard ↔ Expert dashboard).
4. All route guards re-evaluate against new `active_role` claim.

**Postconditions:**
- New JWT issued with updated `active_role`.
- Dashboard context switched.

---

### UC-DR3 — Fund Project Milestone from Expert Earnings (Same Wallet)

**Primary Actor:** Dual-role user acting as CLIENT_CEO  
**Feature reference:** F1, F10  

**Preconditions:**
1. `users.roles` includes both `CLIENT_CEO` and `EXPERT`.
2. `active_role = CLIENT` (CEO mode, switched via `UC-DR2`).
3. Expert earnings credited to `wallets.available_balance` from past engagements.
4. `milestones.state = 'AWAITING_PAYMENT'` (VA created; waiting for transfer).

**Main Success Scenario:**
1. Actor switches to CEO role via `UC-DR2`.
2. Wallet balance shows combined available balance (expert earnings + any external top-ups). Both derive from the same single `wallets` row.
3. Actor funds milestone via `UC08` — escrow lock deducted from the same wallet.
4. No external top-up required if expert earnings are sufficient.

**Postconditions:**
- Milestone funded from internal wallet. This is the designed "frictionless re-investment" scenario for dual-role users.

---

## Part E — Admin Flows

---

### UC-A1 — Emergency Spec Pull-Back (state → SUSPENDED)

**Primary Actor:** ADMIN  
**Feature reference:** F12 Module 3  

**Preconditions:**
1. `active_role = ADMIN`.
2. `projects.state = 'PUBLISHED'` (only published specs can be pulled back; DRAFT or RETURNED_TO_CLIENT cannot).
3. Emergency condition identified (e.g., expert-reported factual error in Artifact A, or elicitation failure pattern detected via Platform Integrity Monitor).

**Main Success Scenario:**
1. Admin opens Platform Integrity Monitor or Account Management; identifies the spec.
2. Admin enters a reason note (shown to client; not to shortlisted experts).
3. Admin confirms pull-back: `PUT /admin/projects/{id}/suspend`. `UPDATE projects SET state = 'SUSPENDED'`. `INSERT platform_decisions { decision_type: 'SPEC_AUTO_RETURN', entity_type: 'projects', entity_id: project_id, advisory_note: reason }`.
4. `projects.artifact_a_json` removed from expert shortlist views (matching engine filters `state != 'SUSPENDED'`).
5. CEO notified; can correct spec and re-enter elicitation engine.

**Guard note:** This is one of only three write actions available to Admin (alongside account suspension and dispute resolution). Admin cannot pull back specs in `DRAFT` or `RETURNED_TO_CLIENT` states.

**Postconditions:**
- `projects.state = 'SUSPENDED'`.
- Spec removed from matching engine and expert views.
- `platform_decisions` row written with admin reason.

---

### UC-A2 — Monitor Platform Integrity Monitor

**Primary Actor:** ADMIN  
**Feature reference:** F12 Module 1  

**Preconditions:**
1. `active_role = ADMIN`.

**Main Success Scenario:**
1. Admin opens Platform Integrity Monitor. System reads `platform_decisions` (all rows; never updated after insert). Three sub-logs displayed:
   - **Spec auto-return log:** failed specs, void type (`decision_type = 'SPEC_AUTO_RETURN'`), LLM `advisory_note` sent, re-entry void.
   - **Seam verification log:** all portfolio auto-upgrades (`decision_type = 'SEAM_TIER_UPGRADE'`) and auto-returns (`decision_type = 'PORTFOLIO_EVAL'`) with `llm_confidence`; lockout events (read from `expert_seam_claims.locked_until`).
   - **Dispute resolution log:** all `disputes` rows, resolution layer used (`AUTO_RESOLVED` vs. `MANUAL_REVIEW` vs. `RESOLVED`), LLM `llm_confidence` for Layer 1 eval.

**Extensions:**
- [IF emergency spec pull-back required from this view] `<<extend>> UC-A1`.

**Postconditions:** No state change — read-only monitoring.

---

### UC-A3 — Monitor Transaction Ledger

**Primary Actor:** ADMIN  
**Feature reference:** F12 Module 4  

**Preconditions:**
1. `active_role = ADMIN`.

**Main Success Scenario:**
1. Admin opens Transaction Ledger module. System returns full `wallet_transactions` ledger (all users, all types). Admin sees: `transaction_type`, `amount`, `reference_id`, `created_at`, `wallet_id`.
2. Admin views `escrow_accounts` status (all rows): `amount`, `status`, `held_at`, `released_at`, parent (`milestone_id` or `engagement_id`).
3. Admin views `withdrawal_requests` audit trail: `status`, `disbursement_id`, `requested_at`, `confirmed_at`.
4. Filters by date range, user, engagement, `transaction_type`. Read-only; no write actions.

**Postconditions:** No state change — read-only ledger view.

---

### UC-A4 — Monitor and Manually Resolve Disputes

**Primary Actor:** ADMIN  
**Feature reference:** F12 Module 2 — Dispute Monitor  

**Preconditions:**
1. `active_role = ADMIN`.
2. For manual resolution: `disputes.state = 'MANUAL_REVIEW'` (LLM Layer 1 confidence < 0.80).

**Main Success Scenario:**
1. Admin opens Dispute Monitor. System returns all `disputes` rows with: `state`, `llm_confidence`, `filed_at`, `filed_by`, `criterion_id`, `escrow_account_id`, `resolved_at`.
2. [For MANUAL_REVIEW disputes] Admin reads both parties' positions (from `messages` channel read-only view) and the `acceptance_criteria.criterion_text` vs. `milestone_submissions` evidence. Admin sees `escrow_accounts.amount`.
3. Admin clicks one of three resolution buttons:
   - **"Release to Expert"** → Ledger: `ESCROW_RELEASE + PLATFORM_FEE + CREDIT_EXPERT` (same as normal milestone APPROVED path). `escrow_accounts.status → 'RELEASED'`.
   - **"Refund to Client"** → Ledger: `ESCROW_REFUND` — `wallets.available_balance += amount` (client). `escrow_accounts.status → 'REFUNDED'`.
   - **"Split 50/50"** → Ledger: `ESCROW_SPLIT` — `wallets.available_balance += amount/2` (client); `wallets.available_balance += amount/2` (expert, net of fee). `escrow_accounts.status → 'SPLIT'`.
4. `UPDATE disputes SET state = 'RESOLVED', resolved_at = now()`. `UPDATE milestones SET state = 'APPROVED'`. Admin choice logged in `platform_decisions`.

**Postconditions:**
- `disputes.state = 'RESOLVED'`.
- Escrow distributed per admin decision; `wallet_transactions` rows written.
- `milestones.state = 'APPROVED'` (lifecycle closed regardless of outcome).

> **Scope note:** Layer 2 (48-hour cooling window + mutual agreement form) and Layer 3 (automated 50/50 split) from the full specification are **[DEFERRED — Phase 2]**. MVP Layer 2 is admin-resolved via a single dashboard button. Admin sees only `MANUAL_REVIEW` disputes (those where LLM Layer 1 confidence < 0.80).

---

### UC-A5 — Monitor Analytics and Export Research Data

**Primary Actor:** ADMIN  
**Feature reference:** F12 Module 5  

**Preconditions:**
1. `active_role = ADMIN`.

**Main Success Scenario:**
1. Admin opens Analytics Dashboard. System computes and displays aggregates:
   - Active projects by archetype and tier (from `projects` table).
   - Elicitation completion rate and auto-publish pass rate (from `elicitation_sessions` + `platform_decisions`).
   - Portfolio auto-upgrade rate and auto-return rate (from `platform_decisions WHERE decision_type = 'SEAM_TIER_UPGRADE'/'PORTFOLIO_EVAL'`).
   - Dispute rate and LLM auto-resolution rate (from `disputes`).
   - Milestone completion rate and average review cycle (from `milestones`).
   - Review completion rate, average ratings (from `reviews`).
2. Admin filters by date range and exports dataset for research evidence (RQ1: matching accuracy, RQ2: AI-assisted scope definition, RQ3: trust factors).

**Postconditions:** No state change — read/export only.

---

## Part F — General Flows

---

### UC-G1 — Browse Path B Expert Marketplace

**Primary Actor:** CLIENT / CEO or CLIENT / TECH_TEAM  
**Feature reference:** F3 Path B  
**Subscription gate:** Free tier — browsing requires no subscription.

**Preconditions:**
1. `active_role = CLIENT` (CEO or TECH_TEAM).

**Main Success Scenario:**
1. Actor opens Path B Marketplace. System returns `services WHERE state = 'PUBLISHED'`.
2. Actor views service cards: title, `domains_json`, `seams_json`, `service_type`, `price_vnd`, engagement model, expert reputation aggregates (average rating + engagement count from `reviews`).
3. Filters by domain, seam, service type, price range.
4. Actor clicks into a service card for full detail view.

**Extensions:**
- `<<extend>> UC10` — CEO can purchase a service directly from this view (TECH_TEAM browse-only; cannot purchase — `active_role = CLIENT/CEO` guard on purchase route).

**Postconditions:** No state change — read-only.

---

### UC-G2 — Real-Time Messaging Within Engagement

**Primary Actor:** CLIENT / CEO, CLIENT / TECH_TEAM, EXPERT (all three share one thread per engagement); ADMIN (read-only)  
**Feature reference:** F9  

**Preconditions:**
1. `engagements.state ≥ 'CONNECTED'` (messaging thread identified by `engagement_id` from this point).
2. Actor is one of the three transactional roles linked to this engagement OR `active_role = ADMIN`.

**Main Success Scenario:**
1. Actor opens Engagement Messaging panel. System returns `messages WHERE engagement_id = ? ORDER BY timestamp ASC`.
2. Actor types message; sends. `INSERT messages { engagement_id, sender_id, content, attachment_url: NULL/URL, timestamp: now() }`.
3. Socket.io room (per `engagement_id`) delivers message in real time to all active participants in the room.
4. Unread badge updated for other participants: computed as `NOT EXISTS (SELECT 1 FROM message_reads WHERE message_id = ? AND user_id = ?)`.
5. Actor reads messages: `INSERT message_reads { message_id, user_id, read_at: now() }` (UNIQUE `(message_id, user_id)` enforced).

**Extensions:**
- File attachments: `attachment_url TEXT NULL` — one file per message in MVP.
- Pre-bid technical questions use the same channel at the project-context level (before an engagement exists, prior to bid submission).
- DoD and technical discussions also use this channel (no separate DoD item comment thread in MVP).
- ADMIN joins all rooms read-only (cannot send); for dispute audit.

**Postconditions:**
- `messages` row written and persisted in PostgreSQL.
- `message_reads` rows written as participants read.

---

### UC-G3 — View Wallet, Transaction History, Subscription Status

**Primary Actor:** All authenticated roles (role-specific panel content)  
**Feature reference:** F10, F1.5  

**Preconditions:**
1. Actor is authenticated.

**CEO panel:**
- `wallets.available_balance`, `wallets.locked_balance`.
- `wallet_transactions` (filtered by this user's wallet; types: TOP_UP, ESCROW_LOCK, SUBSCRIPTION).
- Funded milestones with VA numbers and amounts.
- `users.subscription_client_tier` + `sub_client_expires_at`.
- Buttons: "Top Up" → `UC02`; "Upgrade Subscription" → `UC03`.

**TECH_TEAM panel:**
- Milestone status and release dates (read from `milestones` for `linked_project_id`).
- Released pay-gated documents (from `paygated_documents WHERE release_state = 'RELEASED'`).
- No financial amounts shown.

**EXPERT panel:**
- `wallets.available_balance`; per-milestone earned amounts.
- `wallet_transactions` (ESCROW_RELEASE, WITHDRAWAL entries).
- `withdrawal_requests` history with confirmation timestamps.
- `users.subscription_expert_tier` + `sub_expert_expires_at`.
- Buttons: "Withdraw" → `UC23`; "Upgrade Subscription" → `UC13`.

**ADMIN panel:**
- Full ledger read: all `wallet_transactions`, `escrow_accounts`, `withdrawal_requests` (all users). No write actions from this panel.

**Postconditions:** No state change — read-only financial dashboard.

---

### UC-G4 — File a Dispute

**Primary Actor:** CLIENT / CEO, CLIENT / TECH_TEAM, or EXPERT (any transactional role in the engagement)  
**Secondary Actor:** System (FastAPI LLM Layer 1 evaluation); ADMIN (Layer 2 manual resolution)  
**Feature reference:** F12 Dispute resolution — 2-layer  
**Extends:** UC09 or UC22 (from `SUBMITTED` or `IN_REVISION` milestone states).

**Preconditions:**
1. `milestones.state = 'SUBMITTED'` or `'IN_REVISION'`.
2. Actor is a party to the active engagement.

**Main Success Scenario:**
1. Actor clicks "File Dispute"; inputs reason and desired outcome. `POST /disputes`.
2. NestJS atomic transaction: `INSERT disputes { engagement_id, milestone_id, criterion_id, escrow_account_id, filed_by, state: 'LAYER_1_EVAL', filed_at: now() }`; `UPDATE escrow_accounts SET status = 'FROZEN'`; `UPDATE milestones SET state = 'DISPUTED'`.
3. **Layer 1 — LLM Evaluation:** NestJS calls `POST /llm/dispute-eval { criterion_text, deliverable_files }`. FastAPI LLM evaluates deliverable against the specific `acceptance_criteria.criterion_text`. Returns `{ confidence_score, finding: 'expert_wins'/'client_wins' }`.
4. `UPDATE disputes SET llm_confidence = {score}`.
5. [IF `llm_confidence >= 0.80`] AUTO_RESOLVED: `UPDATE disputes SET state = 'AUTO_RESOLVED', resolved_at = now()`. `INSERT platform_decisions { decision_type: 'DISPUTE_L1_EVAL', decision: 'AUTO_RESOLVED', llm_confidence: {score} }`. Atomic ledger per finding:
   - Expert wins: `ESCROW_RELEASE + PLATFORM_FEE + CREDIT_EXPERT` (same as UC09 Step 6). `escrow_accounts.status → 'RELEASED'`.
   - Client wins: `ESCROW_REFUND` — `wallets.available_balance += amount` (client). `escrow_accounts.status → 'REFUNDED'`.
   - `milestones.state → 'APPROVED'`.
6. [IF `llm_confidence < 0.80`] MANUAL_REVIEW: `UPDATE disputes SET state = 'MANUAL_REVIEW'`. Admin notified; `UC-A4` triggered.

**Postconditions:**
- Escrow resolved: `'RELEASED'` (expert wins), `'REFUNDED'` (client wins), or `'SPLIT'` (admin 50/50).
- `milestones.state = 'APPROVED'` regardless of dispute outcome (lifecycle closed).
- `platform_decisions` row written.

> **Scope note:** Layer 2 (48-hour cooling window + mutual agreement form) and Layer 3 (automated 50/50 split) from the full spec are **[DEFERRED — Phase 2]**. The MVP 2-layer system: Layer 1 = LLM auto-resolve (confidence ≥ 0.80); Layer 2 = admin manual resolution via dashboard button (confidence < 0.80). No `dispute_resolution_reports` table.

---

### UC-G5 — Post-Engagement Review (All Three Role-Specific Forms)

**Primary Actor:** CLIENT / CEO (`UC11`), CLIENT / TECH_TEAM (`UC09t`), EXPERT (`UC24`)  
**Feature reference:** F11  

**Preconditions:**
1. `engagements.state = 'CLOSED'`.
2. No prior `reviews` row for this engagement by this reviewer (`UNIQUE (engagement_id, reviewer_id)` enforced).

**Main Success Scenario:**
- CEO form: see `UC11`.
- TECH_TEAM form: see `UC09t`.
- Expert form: see `UC24`.

All three forms write to the same `reviews` table. `reviewer_role CHECK IN ('CEO','TECH_TEAM','EXPERT')` enforces role-specific form context.

**Postconditions:**
- `reviews` row written per role. Expert and client reputation aggregates updated. Admin analytics fed.

---

---

## Summary: `<<include>>` and `<<extend>>` Relationship Index

This table is the authoritative reference for drawing relationship arrows. All relationships are grounded in the 28-table scope-reduced schema.

### `<<include>>` Relationships (Mandatory Sub-Behaviours)

| Base UC | `<<include>>` → | Rationale |
|---|---|---|
| UC01 | Verify Subscription Gate | Checked on every entry to elicitation engine (Client Pro guard) |
| UC01 | Run SDLC Void Detection | Always runs in Stage 1 LLM extraction |
| UC01 | Run Automated Quality Gate | Always runs after Stage 5 synthesis (completeness + pre-check + void resolution) |
| UC03 | UC02 (conditional redirect) | Called when `available_balance < 500,000 VND` before subscription can activate |
| UC10 | UC-G1 (browse marketplace) | Actor must browse marketplace before purchasing a service |
| UC10 | UC02 (conditional redirect) | Called when wallet balance insufficient for service purchase |
| UC13 | UC02 (conditional redirect) | Called when `available_balance < 300,000 VND` before Expert Pro activation |
| UC23 | UC15 (conditional redirect) | Bank account must be linked before withdrawal; called if `bank_account_xid IS NULL` |

### `<<extend>>` Relationships (Conditional / Optional Branches)

| Extending UC | `<<extend>>` → Base UC | Extension Point / Condition |
|---|---|---|
| UC01a | UC01 | Stage 4 threshold crossed AND CEO confirms no TECH_TEAM available |
| UC01b | UC01 | `project.self_technical = true` flag set during Stage 1 |
| UC01t | UC01 | TECH_TEAM drives Stage 4 on a separate account (separate actor, conditional) |
| UC06n | UC06 | CEO optionally writes `negotiated_price_vnd` before setting `ceo_status` (one round only) |
| UC14 | UC12 | Expert proceeds immediately to Tier 2 portfolio verification after profile creation (Expert Pro required) |
| UC18r | UC18 | `capability_bids.tech_status = 'REVISION_REQUESTED'`; expert edits mutable bid row in-place |
| UC18 | UC17 | Expert proceeds from browsing shortlist to bid submission |
| UC10 | UC01a | TECH_DISCOVERY service purchase as alternative to Milestone 0 injection in Scenario A |
| UC-A1 | UC-A2 | Emergency spec pull-back triggered from Platform Integrity Monitor view |
| UC-G4 | UC09 | Dispute filed from milestone SUBMITTED state (CEO/TECH_TEAM side) |
| UC-G4 | UC22 | Dispute filed from milestone SUBMITTED or IN_REVISION state (Expert side) |
| [Quality gate fail path] | UC01 | Auto-publish fails → `RETURNED_TO_CLIENT`; re-entry at specific void (no admin action) |

---

## Deferred Use Cases (Phase 2 Reference)

The following use cases from the full specification are intentionally out of scope for the 9-week MVP. Each maps to a cut table noted in the scope document.

| Deferred UC | Reason for Deferral | Phase 2 Path |
|---|---|---|
| UC16 (Full spec) — Tier 3 Scenario Assessment | `scenario_assessments` + `scenario_responses` tables cut | Add tables; extend `expert_seam_claims.verification_tier` check |
| UC05 / UC05t (Full spec) — Spec Clarifications Surface A | `spec_clarifications` table cut | Add table; replace messages-channel pre-bid flow |
| UC06c (Full spec) — Surface D CEO Override | `bid_conflict_overrides` table cut; `tech_status`/`ceo_status` columns replace | Add `bid_conflict_overrides`; add Surface D gate |
| UC06d / UC20c (Full spec) — Price Negotiation Rounds | `price_negotiations` table cut; `negotiated_price_vnd` one-column replaces | Add `price_negotiations` table; support 2-round negotiation |
| UC06r / UC20r (Full spec) — Bid Version History | `bid_versions` + `bid_revision_requests` tables cut; mutable row replaces | Add `bid_versions`; snapshot on each revision |
| UC10 / UC10t (Full spec) — Add-On Phase Protocol | `addon_phase_requests` table cut; F8 deferred | Add table; trigger from sprint SCOPE_EVOLUTION flag |
| UC13t (Full spec) — Sprint Plan Read + Comment | `milestone_sprints` + `sprint_status_updates` tables cut; Layer 3 deferred | Add tables; add sprint SCOPE_EVOLUTION detection |
| UC24 (Full spec) — Weekly Sprint Status Update | Same as above | Same as above |
| UC26 (Full spec) — Add-On Phase Brief | Same as above | Same as above |
| UC-A4 (Full spec) — Bid Conflict Override Log | `bid_conflict_overrides` table cut | Add table; add dedicated Integrity Monitor view |
| Dispute Layer 2 + 3 (Full spec) | 48h cooling + auto 50/50 split cut | Add mutual agreement form + automated split logic |
| Tier 4 Signal Accumulation | `expert_seam_outcome_signals` table cut | Add table; connect `reviews.structured_signals_json` to tier upgrade rule |
| Organizations / multi-member accounts | `organizations` + `organization_members` tables cut | Add tables + org billing |