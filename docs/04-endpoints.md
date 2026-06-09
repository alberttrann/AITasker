## 0.11 All Service Endpoints

> **Purpose:** Canonical definition for every HTTP endpoint in AITasker. Three tiers of endpoints exist: (1) **NestJS** (main backend — all actor-initiated actions), (2) **SePay Webhook** (externally initiated by SePay payment gateway), and (3) **FastAPI / LLM Engine** (internal microservice, called exclusively by NestJS — never by frontend directly). Every entry states the allowed actor, subscription gate, route-level guard, primary DB tables written, and any critical constraint or error code.
>
> **Notation:**
> - **W**: tables primarily written by this endpoint
> - **R**: tables read for guard resolution (beyond standard JWT claims)
> - `[Pro-C]` = Client Pro subscription required · `[Pro-E]` = Expert Pro required · `[Admin]` = ADMIN role required · `[None]` = no subscription gate
> - Guard column lists the **first failing condition → HTTP error code** before any DB write occurs

---

### A. Authentication & Session Management

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/auth/register` | Unauthenticated | `[None]` | email unique → 409 | `users`, `client_profiles` OR `expert_profiles`, `wallets`, `virtual_accounts` | Atomic 4-table TX. Fires SePay VA create for WALLET_TOPUP. `client_subtype` defaults to `CEO` for CLIENT role. |
| `POST` | `/auth/register/handoff` | Unauthenticated (TECH_TEAM link) | `[None]` | JWT expired → 401 `LINK_EXPIRED` · JWT sig invalid → 401 · `linked_project_id` already has TECH_TEAM → 409 | `users`, `tech_team_profiles`, `wallets`, `virtual_accounts` | Decodes `project_id` + `client_subtype: TECH_TEAM` from handoff JWT. Sets `tech_team_profiles.linked_project_id` immutably. |
| `POST` | `/auth/login` | All | `[None]` | `users.is_active = false` → 403 `ACCOUNT_SUSPENDED` · bad credentials → 401 | — | Returns JWT with `active_role`, `client_subtype`, `roles`, `subscription_*_tier`, `self_technical_projects`. |
| `POST` | `/auth/refresh` | All (valid refresh token) | `[None]` | refresh token expired → 401 | — | Re-reads `users` row; refreshes subscription claims. |
| `PUT` | `/auth/switch-role` | Dual-role users | `[None]` | `roles` array has only one element → 422 `SINGLE_ROLE_ACCOUNT` | — | Reissues JWT with new `active_role` (and `client_subtype` if switching to CLIENT). No re-login. |
| `POST` | `/auth/verify-email` | Unauthenticated (email link) | `[None]` | token expired → 401 | `users` | Sets `users.email_verified_at`. |

---

### B. User Profile & Role Management

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/users/me` | All | `[None]` | — | — | Returns own `users` row + linked profile (`client_profiles` / `expert_profiles` / `tech_team_profiles`). |
| `PUT` | `/users/me` | All | `[None]` | — | `users`, `client_profiles` OR `expert_profiles` | Basic profile update (name, phone, company). Does NOT update subscription fields or roles (separate endpoints). |
| `POST` | `/users/me/add-role` | CEO (adding EXPERT) or EXPERT (adding CEO) | `[None]` | already has both roles → 409 · identity verification fail → 422 | `users` | Appends new role string to `users.roles` JSONB array. Triggers role switcher in UI. Self-exclusion rule activates. |
| `GET` | `/users/:userId/public-profile` | All authenticated | `[None]` | — | — | Public expert card: `expert_profiles`, `expert_seam_claims`, `expert_domain_depths`, reputation aggregates from `reviews`. |

---

### C. Subscription & Feature Gates

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/subscriptions/status` | CEO or EXPERT | `[None]` | — | — (R: `users`) | Returns `subscription_{role}_tier` + `sub_{role}_expires_at` for own account. |
| `POST` | `/subscriptions/activate` | CEO (`role_type: client`) or EXPERT (`role_type: expert`) | `[None]` | already pro + not expired → 409 `ALREADY_SUBSCRIBED` · `available_balance < price` → 422 `INSUFFICIENT_BALANCE` with `top_up_url` | `wallets`, `wallet_transactions`, `users` | Atomic 3-table TX. No SePay involved. Price: 500K VND (client) / 300K VND (expert). JWT reissued after write. |

---

### D. Wallet, Virtual Accounts & Withdrawals

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/wallets/me` | CEO, EXPERT | `[None]` | — | — (R: `wallets`) | Returns `available_balance`, `locked_balance`. |
| `GET` | `/wallets/me/transactions` | CEO, EXPERT, ADMIN | `[None]` | — | — (R: `wallet_transactions`) | Filterable by `transaction_type`, date range. ADMIN can pass `userId` to see any user's ledger. |
| `GET` | `/virtual-accounts/topup` | CEO, EXPERT | `[None]` | — | — (R: `virtual_accounts`) | Returns permanent `WALLET_TOPUP` VA `va_number` + `VietQR` string for this user. No new row created (permanent VA exists from registration). |
| `POST` | `/withdrawals` | EXPERT | `[None]` | `bank_account_xid IS NULL` → 422 `BANK_NOT_LINKED` · `available_balance < amount` → 422 `INSUFFICIENT_BALANCE` · `amount <= 0` → 422 | `wallets`, `wallet_transactions`, `withdrawal_requests` | Atomic debit TX commits → chi hộ API fires async post-commit. Returns `withdrawal_request.id`. |
| `GET` | `/withdrawals` | EXPERT | `[None]` | — | — (R: `withdrawal_requests`) | Returns own withdrawal history with `status` progression. |

---

### E. SePay Webhook Endpoints (Externally Initiated by SePay)

> These endpoints are NOT called by actors or the frontend. They are called exclusively by SePay's server. All require HMAC signature verification (`SEPAY_SECRET_KEY`) as the first action — failure returns 401 immediately.

| Method | Path | Caller | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/webhooks/sepay/ipn` | SePay | HMAC-verified | HMAC fail → 401 · duplicate `reference_id` → 200 no-op (idempotency index) · `amount != va.fixed_amount` (for MILESTONE/SERVICE) → 422 | Branches by `entity_type`: **TOPUP**: `wallets`, `wallet_transactions` · **MILESTONE**: `wallets`, `wallet_transactions`, `escrow_accounts`, `milestones`, `paygated_documents`, `engagements` · **SERVICE**: `wallets`, `wallet_transactions`, `escrow_accounts`, `engagements`, `milestones` | Idempotency: `UNIQUE INDEX wallet_tx_idempotency(wallet_id, reference_id)`. Always returns 200 to SePay — even on no-op. Full 4-branch decision tree: WALLET_TOPUP / MILESTONE / SERVICE / (future). |
| `POST` | `/webhooks/sepay/chi-ho-credit` | SePay | HMAC-verified | HMAC fail → 401 · `disbursement_id` not found → 404 | `withdrawal_requests`, `milestones` | On `status: COMPLETED`: `withdrawal_requests.status → COMPLETED` + `milestones.state → RELEASED`. On `status: FAILED`: atomic balance restore + `withdrawal_requests.status → FAILED`. |
| `POST` | `/webhooks/sepay/bank-linked` | SePay (Bank Hub) | HMAC-verified | HMAC fail → 401 · `bank_account_xid` already set for this user → 409 (idempotent) | `users` | Sets `users.sepay_bank_account_xid`, `bank_account_holder_name`, `bank_linked_at`. Unlocks `/withdrawals`. |

---

### F. Bank Hub Integration

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/bank-hub/initiate-link` | EXPERT | `[None]` | `bank_account_xid` already set → 409 (idempotent) | — (W: none; SePay API called) | Calls SePay Bank Hub API → returns `hosted_link_url` to frontend. Expert opens WebView. No DB write until SePay fires `/webhooks/sepay/bank-linked`. |

---

### G. AI Elicitation Engine

> All `/elicitation/*` routes require Client Pro (`[Pro-C]`) after the initial session creation check. The session may be created first (free), but Stage 1 submission is gated.

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/elicitation/sessions` | CEO | `[Pro-C]` | subscription not active → 403 `SUBSCRIPTION_REQUIRED` · existing `IN_PROGRESS` session → 200 (returns existing, no new row) | `elicitation_sessions` | Creates `state: IN_PROGRESS`, `current_stage: 1`. If an IN_PROGRESS session exists, returns it (resume semantics). |
| `GET` | `/elicitation/sessions/:id` | CEO (owner) | `[Pro-C]` | not owner → 403 | — (R: `elicitation_sessions`) | Returns full session state including `void_list_json`, `current_stage`, `archetype`. |
| `PUT` | `/elicitation/sessions/:id/stage1` | CEO (owner) | `[Pro-C]` | `current_stage != 1` → 422 `WRONG_STAGE` | `elicitation_sessions` | Submits raw symptom text. Calls FastAPI `/llm/elicitation/stage1-extract`. Updates `void_list_json`, advances `current_stage → 2`. |
| `PUT` | `/elicitation/sessions/:id/stage2` | CEO (owner) | `[Pro-C]` | `current_stage != 2` → 422 · `archetype` not in `ARCHETYPE_CODE` domain → 422 | `elicitation_sessions` | Submits archetype selection + void injection acknowledgments. Locks `elicitation_sessions.archetype` (immutable after this write). Advances `current_stage → 3`. |
| `PUT` | `/elicitation/sessions/:id/stage3` | CEO (owner) | `[Pro-C]` | `current_stage != 3` → 422 · not all 4 probes answered → 422 | `elicitation_sessions` | Submits 4 behavioral probe answers. System evaluates infrastructure tier. Returns `{ stage4_required: bool, scenario_type }`. Advances `current_stage → 4`. |
| `POST` | `/elicitation/sessions/:id/handoff-link` | CEO (owner) | `[Pro-C]` | `stage4_required = false` → 422 · session `scenario_type = SCENARIO_B` (self-technical) → 422 | — | Generates signed JWT handoff link (72h expiry) encoding `project_id + client_subtype: TECH_TEAM`. Returns `{ handoff_url, expires_at }`. Does NOT write DB — link is stateless JWT. |
| `PUT` | `/elicitation/sessions/:id/stage4` | TECH_TEAM (`linked_project_id` match) OR CEO with `self_technical_projects` claim | `[None]` | `client_subtype != TECH_TEAM` AND no `self_technical` claim for this project → 403 | `elicitation_sessions` (updates `artifact_b_json` staging), `projects` (partial draft), `tech_team_profiles` | Submits stack tags, integration method, legacy volume, schema uploads. Triggers synthesis internally. |
| `POST` | `/elicitation/sessions/:id/synthesize` | System-internal (auto-triggered after stage4) | Internal | — | `projects` (C), `elicitation_sessions` (U), `platform_decisions` (C) | Calls FastAPI `/llm/elicitation/stage5-synthesize`. Runs quality gate. On pass: creates `projects {state: PUBLISHED}` atomically. On fail: `elicitation_sessions.state → RETURNED`, `platform_decisions {SPEC_AUTO_RETURN}`. **Not directly callable by frontend.** |
| `PUT` | `/elicitation/sessions/:id/abandon` | CEO (owner) | `[Pro-C]` | session already COMPLETED → 422 | `elicitation_sessions` | Sets `state → ABANDONED`. Preserves `current_stage` for resumption. |

---

### H. Projects & Matching

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/projects/:id` | CEO (owner), TECH_TEAM (linked), EXPERT (shortlisted), ADMIN | `[None]` | not in project member list → 403 | — (R: `projects`) | Returns `artifact_a_json`, `state`, `archetype`, `tier`. Does NOT return `artifact_b_json` here — that has its own guarded route. |
| `GET` | `/projects/:id/artifact-a` | Any matched EXPERT, CEO (owner), TECH_TEAM (linked) | `[None]` | `projects.state != PUBLISHED` → 403 | — (R: `projects`) | Returns `projects.artifact_a_json`. Public within platform for shortlisted experts. |
| `GET` | `/projects/:id/artifact-b` | EXPERT (in connected engagement), TECH_TEAM (linked, engagement ≥ CONNECTED) | `[Pro-C]` (implicit — only exists post-Pro-elicitation) | `engagement.state < CONNECTED` → 403 · `client_nda_accepted_at IS NULL` → 403 · `expert_nda_accepted_at IS NULL` → 403 · `requester.active_role = CLIENT/CEO` → 403 **permanent** | — (R: `projects`, `engagements`) | **FastAPI route** — all 4 guard conditions must pass simultaneously. CEO requests always return 403 regardless of any other condition. |
| `POST` | `/matching/:projectId` | System-internal (auto-triggered on project PUBLISHED) | Internal | — | — (R: `expert_seam_claims`, `expert_domain_depths`, `expert_profiles`; W: match cache) | Calls FastAPI `/llm/matching`. Scores all eligible experts. Writes ranked shortlist. **Not directly callable by frontend.** |
| `GET` | `/matching/:projectId/shortlist` | CEO (owner) | `[Pro-C]` | `projects.state != PUBLISHED` → 422 · subscription expired → 403 | — (R: match shortlist cache) | Returns 3–5 ranked expert cards: strength label, seam gap map colors (Amber/Yellow/Red), domains, `expert_profiles`. Numeric composite scores NOT returned — labels only. |

---

### I. Expert Capability Profile

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/expert-profiles/me` | EXPERT | `[None]` | — | — (R: `expert_profiles`, `expert_domain_depths`, `expert_seam_claims`) | Full own profile view including tier states, submission counts, lockout timestamps. |
| `PUT` | `/expert-profiles/me` | EXPERT | `[None]` | — | `expert_profiles` | Updates `engagement_model`, `archetype_history_json`, `stack_tags_json`. |
| `POST` | `/expert-domain-depths` | EXPERT | `[None]` | `domain_code` not in `DOMAIN_CODE` domain → 422 · duplicate `(expert_id, domain_code)` → 409 (use PUT to update) | `expert_domain_depths` | Declares a new domain depth claim at Tier 1 (CLAIMED). |
| `PUT` | `/expert-domain-depths/:id` | EXPERT (owner) | `[None]` | not owner → 403 | `expert_domain_depths` | Updates `depth_level` on an existing domain depth claim. |
| `POST` | `/expert-seam-claims` | EXPERT | `[None]` | `seam_code` not in `SEAM_CODE` domain → 422 · duplicate `(expert_id, seam_code)` → 409 (use PUT to update) | `expert_seam_claims` | Declares a new seam claim at `CLAIMED` (Tier 1, weight 0.20). `submission_count = 0`, `locked_until = NULL`. |

---

### J. Portfolio Submissions (Tier 2 Seam Verification)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/portfolio-submissions` | EXPERT | `[Pro-E]` | subscription not active → 403 · target seam not at `CLAIMED` → 422 `ALREADY_VERIFIED_OR_HIGHER` · `locked_until > now()` → 429 `TOO_MANY_ATTEMPTS` with `locked_until` timestamp | `portfolio_submissions`, `expert_seam_claims` | Calls FastAPI `/llm/portfolio-eval`. On pass (≥ 0.85): `expert_seam_claims.verification_tier → EVIDENCE_BACKED` + `platform_decisions {SEAM_TIER_UPGRADE}`. On fail: `submission_count += 1` + `platform_decisions {PORTFOLIO_EVAL REJECTED}`. On 5th fail: `locked_until = now() + 30d`. |
| `GET` | `/portfolio-submissions/:id` | EXPERT (owner), ADMIN | `[None]` | not owner and not ADMIN → 403 | — (R: `portfolio_submissions`, `platform_decisions`) | Returns submission status, `llm_confidence`, and `advisory_note` from `platform_decisions`. |

---

### K. Services & Marketplace (Path B / Path C)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/services` | All authenticated | `[None]` | — | — (R: `services`) | Returns `state = PUBLISHED` listings. Filterable by `service_type`, `domains_json`, `seams_json`, price range. |
| `GET` | `/services/:id` | All authenticated | `[None]` | `state != PUBLISHED` (and not owner/admin) → 404 | — (R: `services`, `reviews` aggregates) | Full service detail including expert reputation aggregates. |
| `POST` | `/services` | EXPERT | `[None]` | — | `services` | Creates listing at `state: DRAFT`. For AI generator route: calls FastAPI `/llm/service-generate` before INSERT. |
| `PUT` | `/services/:id` | EXPERT (owner) | `[None]` | not owner → 403 · `state = SUSPENDED` → 422 (admin-suspended cannot be self-edited) | `services` | Updates listing details OR transitions `state: DRAFT → PUBLISHED`. `service_type` is immutable after PUBLISHED. |
| `POST` | `/services/:id/purchase` | CEO | `[None]` | `active_role != CLIENT` OR `client_subtype != CEO` → 403 · `service.state != PUBLISHED` → 422 · `available_balance < service.price_vnd` → 422 `INSUFFICIENT_BALANCE` | `engagements`, `virtual_accounts` | Creates engagement (`type` determined by `service.service_type`: `SERVICE_PURCHASE` or `TECH_DISCOVERY`) + per-order VA. Returns VietQR. IPN fires later to advance to ACTIVE. |

---

### L. Engagements & Connection Flow

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/engagements` | CEO, TECH_TEAM, EXPERT, ADMIN | `[None]` | — | — (R: `engagements`) | Returns own engagements (or all for ADMIN). ADMIN can filter by state, type, date. |
| `GET` | `/engagements/:id` | Parties to the engagement, ADMIN | `[None]` | not in engagement + not ADMIN → 403 | — (R: `engagements`, `capability_bids`, `milestones`) | Full engagement view. |
| `PUT` | `/engagements/:id/nda` | CEO (of this engagement) | `[None]` | `engagement.state != PENDING` → 422 · `client_nda_accepted_at` already set → 409 (idempotent) | `engagements` | Sets `engagements.client_nda_accepted_at = now()`. If both NDA timestamps now set: `state → CONNECTED`. |
| `PUT` | `/engagements/:id/connect` | EXPERT (of this engagement) | `[None]` | `engagement.state != PENDING` → 422 · `expert_nda_accepted_at` already set → 409 | `engagements` | Expert accepts connection + NDA. Sets `engagements.expert_nda_accepted_at = now()`. If both NDA timestamps now set: `state → CONNECTED`. Also: if `sepay_bank_account_xid IS NULL`, returns `{ prompt_bank_link: true }` (non-blocking). |
| `PUT` | `/engagements/:id/decline` | EXPERT (of this engagement) | `[None]` | `engagement.state != PENDING` → 422 | `engagements` | Expert declines connection request. `state` updated. CEO notified. |

---

### M. Capability Bids

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/bids` | EXPERT | `[Pro-E]` for Tier 2–3 projects | subscription not active (Tier 2–3 project) → 403 · `footprint_alignment_json` OR `approach_summary` OR `conditional_pricing_json` NULL → 422 `MISSING_BID_COMPONENT` · self-exclusion (`expert.user_id = project.client_id`) → 403 · expert not in shortlist → 403 | `engagements`, `capability_bids` | Creates `engagement {PROJECT_BASED, PENDING}` + `capability_bids {SUBMITTED, tech_status: PENDING, ceo_status: PENDING}`. `UNIQUE(engagement_id)` on `capability_bids` enforced. |
| `GET` | `/bids/:id` | TECH_TEAM (linked), CEO (of project), EXPERT (owner), ADMIN | `[None]` | not a party → 403 | — (R: `capability_bids`) | Full bid detail including `tech_feedback`, `version_number`, `negotiated_price_vnd`. |
| `PUT` | `/bids/:id` | EXPERT (owner) | `[Pro-E]` | `tech_status != REVISION_REQUESTED` → 422 `REVISION_NOT_REQUESTED` · any of 3 components NULL after update → 422 | `capability_bids` | In-place mutable revision. Updates components, sets `tech_status → PENDING`, increments `version_number`. No `bid_versions` table — mutable row only. |
| `PUT` | `/bids/:id/tech-review` | TECH_TEAM (linked to this project) | `[None]` | `active_role != CLIENT` OR `client_subtype != TECH_TEAM` → 403 · not linked to this project → 403 · `bid.state` not in reviewable states → 422 | `capability_bids` | TECH_TEAM sets `tech_status = APPROVED` or `REVISION_REQUESTED`. If `REVISION_REQUESTED`: `tech_feedback` text required. If `APPROVED`: CEO_REVIEW unlocks. |
| `PUT` | `/bids/:id/ceo-decision` | CEO (of this project) | `[None]` | `capability_bids.tech_status != APPROVED` → 422 `TECH_REVIEW_INCOMPLETE` · `ceo_status` already set → 409 | `capability_bids`, `engagements` | CEO sets `ceo_status = APPROVED` or `DECLINED`. If `APPROVED`: `capability_bids.state → SELECTED`, all other bids for project → `DECLINED`, connection flow auto-initiated. |
| `PUT` | `/bids/:id/counter-offer` | CEO (of this project) | `[None]` | `tech_status != APPROVED` → 422 · `negotiated_price_vnd` already set (not NULL) → 409 `COUNTER_OFFER_ALREADY_SET` | `capability_bids` | One-round only. Sets `negotiated_price_vnd` (BIGINT). Immutable after first write. |

---

### N. Milestones

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/milestones` | CEO (of this engagement) | `[None]` | `engagement.state < CONNECTED` → 422 · `sign_off_authority` not in `SIGN_OFF_AUTH` domain → 422 · `payment_amount_vnd <= 0` → 422 | `milestones` | Creates milestone at `state: DEFINED`. `milestone_number` auto-assigned; `UNIQUE(engagement_id, milestone_number)` enforced. |
| `GET` | `/milestones` | All parties to engagement | `[None]` | not a party → 403 | — (R: `milestones`) | List all milestones for an engagement. |
| `GET` | `/milestones/:id` | All parties to engagement | `[None]` | not a party → 403 | — (R: `milestones`, `escrow_accounts`, `milestone_submissions`) | Full milestone detail including `state`, `va_number` (if AWAITING_PAYMENT), escrow status. |
| `PUT` | `/milestones/:id/fund` | CEO (of this engagement) | `[None]` | `milestones.state != DEFINED` → 422 · `engagement.state < CONNECTED` → 422 | `milestones`, `virtual_accounts` | Creates per-milestone VA (`entity_type: MILESTONE`, `fixed_amount`, `expires_at: +24h`). Sets `milestones.state → AWAITING_PAYMENT`. Returns `{ va_number, vietqr_string, expires_at }`. Actual funding happens on IPN (E: `/webhooks/sepay/ipn` MILESTONE branch). |

---

### O. Acceptance Criteria

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/milestones/:id/criteria` | CEO (of this engagement) | `[None]` | `engagement.state < CONNECTED` → 422 | `acceptance_criteria`, `platform_decisions` | Creates criterion. Calls FastAPI `/llm/criterion-check` for quality gate (advisory, non-blocking). Writes `platform_decisions {CRITERION_QUALITY_GATE}` if subjective language detected. |
| `GET` | `/milestones/:id/criteria` | CEO, TECH_TEAM (linked), EXPERT (in engagement) | `[None]` | not a party → 403 · CEO cannot see if criteria are DoD-linked (DoD hidden from CEO) | — (R: `acceptance_criteria`) | List all criteria for milestone. |
| `PUT` | `/acceptance-criteria/:id/verify` | TECH_TEAM or CEO depending on `verified_by_role` | `[None]` | `active_role / client_subtype` doesn't match `acceptance_criteria.verified_by_role` → 403 `WRONG_VERIFIER_ROLE` · `milestones.state != SUBMITTED` → 422 | `acceptance_criteria`, then triggers APPROVED guard | Sets `verified_at = now()`. After write: runs APPROVED guard (`SELECT COUNT ... WHERE verified_at IS NULL AND is_required = true`). If count = 0: fires APPROVED atomic TX (R: `platform_settings`; W: `wallets` ×3, `wallet_transactions` ×3, `escrow_accounts`, `milestones`, `withdrawal_requests`). |
| `PUT` | `/acceptance-criteria/:id/revision` | TECH_TEAM or CEO (matching `verified_by_role`) | `[None]` | `milestones.state NOT IN (SUBMITTED, IN_PROGRESS)` → 422 | `acceptance_criteria`, `milestones` | Writes `revision_note`. Sets `milestones.state → IN_REVISION`. Expert notified. |

---

### P. DoD Checklist

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/milestones/:id/dod` | EXPERT (in engagement) | `[None]` | `milestones.state != IN_PROGRESS` → 422 · `active_role != EXPERT` → 403 | `milestone_dod_items` | Creates DoD item (`status: PENDING`). `is_required` boolean set at creation. |
| `GET` | `/milestones/:id/dod` | EXPERT (in engagement), TECH_TEAM (linked) | `[None]` | CEO request → 403 `DOD_NOT_VISIBLE_TO_CEO` · not a party → 403 | — (R: `milestone_dod_items`) | TECH_TEAM gets read-only view. CEO gets 403 (DoD visibility rule). |
| `PUT` | `/milestones/:id/dod/:itemId` | EXPERT (in engagement, owner of item) | `[None]` | `active_role != EXPERT` → 403 · `status = NOT_APPLICABLE AND is_required = true` → 422 (app-level; DB CHECK also enforces this) · `status = COMPLETED AND completion_note NULL AND is_required = true` → 422 `NOTE_REQUIRED` · `status = NOT_APPLICABLE AND not_applicable_note NULL` → 422 `NOTE_REQUIRED` | `milestone_dod_items` | Updates status. Application-level validation runs before DB write. DB-level `CHECK (NOT (is_required = TRUE AND status = 'NOT_APPLICABLE'))` as final safety net. |

---

### Q. Milestone Submissions & Pay-Gated Documents

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/milestones/:id/submit` | EXPERT (in engagement) | `[None]` | DoD gate: `SELECT COUNT(*) FROM milestone_dod_items WHERE is_required=true AND status != 'COMPLETED'` > 0 → 422 `DOD_INCOMPLETE` with blocking item list · `milestones.state != IN_PROGRESS` → 422 | `milestone_submissions`, `milestones` | Creates `milestone_submissions` row. Sets `milestones.state → SUBMITTED`. Sign-off authority notified. |
| `GET` | `/milestones/:id/submissions` | All parties, ADMIN | `[None]` | not a party → 403 | — (R: `milestone_submissions`) | Returns submission history (description, files_json, submitted_at). |
| `POST` | `/milestones/:id/paygated-docs` | EXPERT (in engagement) | `[None]` | `engagement.state < CONNECTED` → 422 · `active_role != EXPERT` → 403 | `paygated_documents` | Uploads document, tags to `milestone_id`. Sets `release_state: STAGED`. Document stays STAGED until IPN MILESTONE FUNDED fires and atomically flips to RELEASED. |
| `GET` | `/milestones/:id/paygated-docs` | TECH_TEAM (linked, engagement ≥ CONNECTED) | `[None]` | `active_role = CLIENT AND client_subtype = CEO` → 403 **permanent** · `release_state != RELEASED` → filtered out (not returned) · `engagement.state < CONNECTED` → 403 | — (R: `paygated_documents`) | CEO permanently excluded at route level. Returns only `release_state = RELEASED` documents. |

---

### R. Disputes

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/disputes` | CEO, TECH_TEAM, or EXPERT (parties to engagement) | `[None]` | `milestones.state NOT IN (SUBMITTED, IN_REVISION)` → 422 · `criterion_id` NULL → 422 `CRITERION_REQUIRED` · `active_role = ADMIN` → 403 (Admin cannot file) | `disputes`, `escrow_accounts`, `milestones` | Atomic: `disputes {PENDING}` + `escrow_accounts.status → FROZEN` + `milestones.state → DISPUTED`. Then calls FastAPI `/llm/dispute-eval`. On confidence ≥ 0.80: AUTO_RESOLVED + ledger. On < 0.80: MANUAL_REVIEW queued for admin. |
| `GET` | `/disputes/:id` | Parties to engagement, ADMIN | `[None]` | not a party and not ADMIN → 403 | — (R: `disputes`, `platform_decisions`) | Returns dispute state, `llm_confidence`, resolution. |

---

### S. Messaging

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/engagements/:id/messages` | CEO, TECH_TEAM, EXPERT (parties), ADMIN | `[None]` | not a party and not ADMIN → 403 | — (R: `messages`, `message_reads`) | Returns thread ordered by `timestamp ASC`. Includes `unread_count` per user. ADMIN read-only (no unread tracking for admin). |
| `POST` | `/engagements/:id/messages` | CEO, TECH_TEAM, EXPERT (parties only) | `[None]` | `active_role = ADMIN` → 403 `ADMIN_CANNOT_SEND` · not a party → 403 · engagement not active enough for messaging → 422 | `messages` | Creates message row. Broadcasts via Socket.io room (keyed by `engagement_id`). One `attachment_url` per message (MVP). |
| `POST` | `/messages/:id/read` | Any party to the message's engagement | `[None]` | not a party → 403 · already read by this user → 200 no-op (`UNIQUE(message_id, user_id)` idempotent) | `message_reads` | Sets `read_at = now()`. Idempotent. |

---

### T. Reviews

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/reviews` | CEO (`reviewer_role: CEO`), TECH_TEAM (`reviewer_role: TECH_TEAM`), EXPERT (`reviewer_role: EXPERT`) | `[None]` | `engagement.state != CLOSED` → 422 `ENGAGEMENT_NOT_CLOSED` · duplicate review (`UNIQUE(engagement_id, reviewer_id)`) → 409 `REVIEW_ALREADY_SUBMITTED` · `reviewer_role` doesn't match actor's `active_role / client_subtype` → 422 | `reviews` | Inserts review row. Role-specific form validation enforced: TECH_TEAM requires `structured_signals_json`; CEO requires `rating`; Expert requires `rating`. |
| `GET` | `/reviews/:engagementId` | All parties, ADMIN | `[None]` | not a party and not ADMIN → 403 | — (R: `reviews`) | Returns all reviews for engagement (up to 3: CEO, TECH_TEAM, Expert). |

---

### U. Admin Endpoints

> All `/admin/*` endpoints require `active_role = ADMIN`. Non-admin requests return 403.

| Method | Path | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|
| `GET` | `/admin/platform-decisions` | `[Admin]` | — | — (R: `platform_decisions`) | Full audit log. Filterable by `decision_type`, `entity_type`, date range. Never write to this table via any endpoint. |
| `GET` | `/admin/wallet-transactions` | `[Admin]` | — | — (R: `wallet_transactions`) | All users. Filterable by `transaction_type`, `user_id`, date range. |
| `GET` | `/admin/escrow-accounts` | `[Admin]` | — | — (R: `escrow_accounts`) | All escrows. Status filter: HELD / FROZEN (active disputes) / RELEASED / REFUNDED / SPLIT. |
| `GET` | `/admin/withdrawal-requests` | `[Admin]` | — | — (R: `withdrawal_requests`) | All withdrawal requests. |
| `GET` | `/admin/disputes` | `[Admin]` | — | — (R: `disputes`, `platform_decisions`) | Full dispute list. Filter by `state`: `MANUAL_REVIEW` for actionable items. |
| `PUT` | `/admin/disputes/:id/resolve` | `[Admin]` | `disputes.state != MANUAL_REVIEW` → 422 `NOT_IN_MANUAL_REVIEW` · `resolution` not in `{release, refund, split}` → 422 | `disputes`, `escrow_accounts`, `wallets` ×2, `wallet_transactions` ×2, `milestones` | Admin selects resolution. Atomic ledger TX per decision: **release** → `ESCROW_RELEASE + PLATFORM_FEE + expert credit`; **refund** → `ESCROW_REFUND`; **split** → `ESCROW_SPLIT ×2`. Always: `milestones.state → APPROVED`. |
| `GET` | `/admin/users` | `[Admin]` | — | — (R: `users`, `client_profiles`, `expert_profiles`) | All users. Filterable by role, subscription_tier, `is_active`. |
| `PUT` | `/admin/users/:id/suspend` | `[Admin]` | `users.is_active = false` already → 409 (idempotent) | `users` | Sets `users.is_active = false`. JWT invalidated on next verification. |
| `PUT` | `/admin/users/:id/reactivate` | `[Admin]` | `users.is_active = true` already → 409 | `users` | Sets `users.is_active = true`. |
| `PUT` | `/admin/projects/:id/suspend` | `[Admin]` | `projects.state != PUBLISHED` → 422 `INVALID_STATE_FOR_PULLBACK` with current state | `projects`, `platform_decisions` | Sets `projects.state → SUSPENDED`. Writes `platform_decisions {SPEC_AUTO_RETURN, advisory_note: admin_reason}`. CEO notified. Spec hidden from matching engine and expert views. |
| `GET` | `/admin/analytics` | `[Admin]` | — | — (R: multiple tables, computed aggregates) | Aggregated metrics: elicitation completion rate, auto-publish pass rate, portfolio upgrade/rejection rate, dispute rate, LLM auto-resolve rate, milestone completion rate, avg review cycle, avg rating. |
| `GET` | `/admin/analytics/export` | `[Admin]` | — | — | Returns CSV download of research dataset. |
| `GET` | `/admin/platform-settings` | `[Admin]` | — | — (R: `platform_settings`) | Returns singleton row: `platform_fee_pct`, `platform_wallet_id`. |
| `PUT` | `/admin/platform-settings` | `[Admin]` | `platform_fee_pct` not between 0.00–0.99 → 422 | `platform_settings` | Updates `platform_fee_pct`. Effective on next APPROVED milestone (read at transaction time — no retroactive effect). |

---

### V. FastAPI / LLM Engine Endpoints (Internal — Called by NestJS Only)

> These endpoints run on the internal FastAPI microservice (e.g., `http://llm-service:8000`). They are **never** exposed to the frontend or any actor directly. NestJS calls them, receives the response, and then writes to the primary DB. FastAPI itself only reads the DB (for the Artifact B route guard); it does not initiate writes.

| Method | Path | Called By | Purpose | Request Payload (key fields) | Response (key fields) | DB Side-Effects (via NestJS) |
|---|---|---|---|---|---|---|
| `POST` | `/llm/elicitation/stage1-extract` | NestJS on Stage 1 submit | Extract symptoms, scale signals, voids from raw text | `{ symptom_text: string }` | `{ symptoms: [...], scale_signals: {...}, voids: [{ void_code, severity }] }` | NestJS writes `elicitation_sessions.void_list_json` |
| `POST` | `/llm/elicitation/stage5-synthesize` | NestJS after Stage 4 submit | Full footprint synthesis: all 5 JSONB columns | `{ elicitation_session_id, stage1_symptoms, stage2_archetype, stage3_probes, stage4_tech_inputs, void_list_json }` | `{ required_seams_json, required_domains_json, milestone_framework_json, artifact_a_json, artifact_b_json, completeness_score }` | NestJS runs quality gate; on pass: creates `projects` + `platform_decisions` |
| `POST` | `/llm/portfolio-eval` | NestJS on portfolio submission | Tier 2 seam verification auto-assessment | `{ project_description: string, decision_points: [...], seam_code: SEAM_CODE }` | `{ confidence_score: float, passed_boolean: bool, gap_advisory: string \| null }` | NestJS writes `portfolio_submissions`, `expert_seam_claims` (if passed), `platform_decisions` |
| `POST` | `/llm/matching` | NestJS after project PUBLISHED | Composite match scoring for all eligible experts | `{ required_seams_json, required_domains_json, required_tier: PROJECT_TIER, [expert_profiles] }` | `[{ expert_id, composite_score, strength_label, gap_map: [{ seam_code, color }] }]` | NestJS writes ranked shortlist cache; CEO shortlist view reads this |
| `POST` | `/llm/dispute-eval` | NestJS after dispute filed | Layer 1 LLM assessment: does deliverable meet the criterion? | `{ criterion_text: string, deliverable_description: string, files: [url] }` | `{ confidence_score: float, finding: "expert_wins" \| "client_wins" }` | NestJS writes `disputes.llm_confidence`; on ≥ 0.80: fires ledger TX + `platform_decisions {DISPUTE_L1_EVAL}` |
| `POST` | `/llm/criterion-check` | NestJS on criterion save | Quality gate: is this criterion measurable vs subjective? | `{ criterion_text: string }` | `{ is_subjective: boolean, suggestions: [string] }` | NestJS writes `platform_decisions {CRITERION_QUALITY_GATE}` if `is_subjective = true` |
| `POST` | `/llm/service-generate` | NestJS on AI Service Generator request | Generate structured service listing draft | `{ expert_capabilities: [...], target_use_cases: [...] }` | `{ title, description, scope, timeline, suggested_price_vnd }` | NestJS writes `services {state: DRAFT}` with generated content |

---

### W. Socket.io Real-Time Events (Non-HTTP — Reference Only)

> These are not HTTP endpoints. They use the Socket.io protocol over the same NestJS server. Listed here for completeness.

| Event Name | Direction | Payload | Trigger |
|---|---|---|---|
| `message:new` | Server → Client | `{ message_id, engagement_id, sender_id, content, attachment_url, timestamp }` | New `messages` row inserted |
| `milestone:state-changed` | Server → Client | `{ milestone_id, engagement_id, new_state, updated_at }` | Any `milestones.state` transition |
| `engagement:state-changed` | Server → Client | `{ engagement_id, new_state }` | `engagements.state` transition |
| `bid:tech-status-changed` | Server → Client (CEO) | `{ bid_id, tech_status }` | TECH_TEAM sets `tech_status = APPROVED` |
| `wallet:balance-updated` | Server → Client (owner) | `{ available_balance, locked_balance, transaction_type, amount }` | Any IPN-driven or internal wallet update |
| `notification:generic` | Server → Client | `{ type, title, body, entity_id }` | Any notification-triggering state change |