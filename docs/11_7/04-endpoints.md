## 0.11 All Service Endpoints

> **Purpose:** Canonical definition for every HTTP endpoint in AITasker. Three tiers of endpoints exist: (1) **NestJS** (main backend — 213 endpoints, all actor-initiated actions), (2) **SePay Webhook** (externally initiated by SePay payment gateway), and (3) **FastAPI / LLM Engine** (internal microservice, called exclusively by NestJS — never by frontend directly). Every entry states the allowed actor, subscription gate, route-level guard, primary DB tables written, and any critical constraint or error code.
>
> **Notation:**
> - **W**: tables primarily written by this endpoint
> - **R**: tables read for guard resolution (beyond standard JWT claims)
> - `[Pro-C]` = Client Pro subscription required · `[Pro-E]` = Expert Pro required · `[Admin]` = ADMIN role required · `[None]` = no subscription gate
> - Guard column lists the **first failing condition → HTTP error code** before any DB write occurs

---

### A. Authentication & Session Management (12 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/auth/register` | Unauthenticated | `[None]` | email unique → 409 | `users`, `client_profiles` OR `expert_profiles`, `wallets`, `virtual_accounts` | Atomic 4-table TX. Email normalized to lowercase. Password errors return array of all failing rules. Fires SePay VA create for WALLET_TOPUP. |
| `POST` | `/auth/register/handoff` | Unauthenticated (TECH_TEAM link) | `[None]` | JWT expired → 401 `LINK_EXPIRED` · JWT sig invalid → 401 | `users`, `tech_team_profiles`, `wallets`, `virtual_accounts` | Decodes `project_id` + `client_subtype: TECH_TEAM` from handoff JWT. Sets `tech_team_profiles.linked_project_id` immutably. |
| `POST` | `/auth/login` | All | `[None]` | `users.is_active = false` → 403 `ACCOUNT_SUSPENDED` · bad credentials → 401 | — | Returns JWT with `active_role`, `client_subtype`, `roles`, `subscription_*_tier`, `self_technical_projects`. |
| `PUT` | `/auth/switch-role` | Dual-role users | `[None]` | `roles` array has only one element → 422 `SINGLE_ROLE_ACCOUNT` | — | Reissues JWT with new `active_role`. No re-login. |
| `POST` | `/auth/refresh` | All (valid refresh token) | `[None]` | refresh token expired/invalid → 401 | — | Re-reads `users` row; refreshes subscription claims. |
| `POST` | `/auth/verify-tax-code` | CEO | `[None]` | invalid tax code format → 422 | `users` | Verifies Vietnamese tax code. |
| `POST` | `/auth/claim-handoff` | Existing User | `[None]` | JWT invalid → 401 · already has role → 409 | `users`, `tech_team_profiles` | Existing user consumes handoff link to add TECH_TEAM role. |
| `POST` | `/auth/forgot-password` | Unauthenticated | `[None]` | — (always returns 201) | `users` | Sets `password_reset_token` and `password_reset_token_expires_at`. Sends email. |
| `POST` | `/auth/reset-password` | Unauthenticated (token) | `[None]` | token expired/invalid → 400 · password rules fail → 400 (array) | `users` | Clears token, invalidates all sessions (`refresh_token_hash = null`). |
| `GET` | `/auth/verify-reset-token/:token` | Unauthenticated | `[None]` | token expired/invalid → 400 | — | FE must call before rendering reset form. |
| `POST` | `/auth/logout` | All | `[None]` | — | `users` | Clears `refresh_token_hash`. FE must clear localStorage. |
| `PUT` | `/auth/me/password` | Authenticated | `[None]` | current password mismatch → 401 · password rules fail → 400 (array) | `users` | Invalidates all sessions (`refresh_token_hash = null`). |

---

### B. User Profile & Role Management (6 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/users/me` | All | `[None]` | — | — (R: `users`, profiles) | Returns own `users` row + linked profile. |
| `PUT` | `/users/me` | All | `[None]` | — | `users`, `client_profiles` OR `expert_profiles` | Basic profile update. Does NOT update subscription/roles. |
| `POST` | `/users/me/add-role` | CEO or EXPERT | `[None]` | already has both roles → 409 | `users` | Appends new role string to `users.roles`. Triggers UI role switcher. |
| `GET` | `/users/:userId/public-profile` | Authenticated | `[None]` | — | — (R: `users`, `reviews`) | Public expert card: profile, seam claims, domain depths, reputation aggregates. |
| `PUT` | `/users/me/tax-code` | CEO | `[None]` | invalid format → 422 | `users` | Updates tax code. |
| `GET` | `/users/experts` | CEO, ADMIN | `[None]` | — | — (R: `users`, `expert_profiles`) | Browse experts for CEO talent search. Filterable by stack/archetype. |

---

### C. Wallet, Virtual Accounts & Withdrawals (6 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/wallets/me` | CEO, EXPERT | `[None]` | — | — (R: `wallets`) | Returns `available_balance`, `locked_balance`. |
| `GET` | `/wallets/me/transactions` | CEO, EXPERT, ADMIN | `[None]` | — | — (R: `wallet_transactions`) | Paginated/filtered tx history. |
| `POST` | `/wallets/virtual-accounts/topup` | CEO, EXPERT | `[None]` | — | — (R: `virtual_accounts`) | Returns permanent `WALLET_TOPUP` VA `va_number` + VietQR string. |
| `POST` | `/withdrawals` | EXPERT | `[None]` | `bank_account_xid IS NULL` → 422 `BANK_NOT_LINKED` · `available_balance < amount` → 422 `INSUFFICIENT_BALANCE` | `wallets`, `wallet_transactions`, `withdrawal_requests` | Atomic debit TX. Returns `withdrawal_request.id`. No SePay API called. |
| `GET` | `/withdrawals` | EXPERT | `[None]` | — | — (R: `withdrawal_requests`) | Returns own withdrawal history. |
| `DELETE` | `/withdrawals/:id` | EXPERT | `[None]` | `status != PENDING` → 422 `CANCEL_NOT_ALLOWED` | `wallets`, `wallet_transactions`, `withdrawal_requests` | Atomic wallet restore + `status → CANCELLED`. |

---

### D. Bank Hub & SePay Webhooks (4 Endpoints — 1 FE, 3 S2S)

| Method | Path | Caller | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/bank-hub/initiate-link` | EXPERT | `[None]` | `bank_account_xid` already set → 409 | — | Stores placeholder `sepay_bank_account_xid`. No real SePay API call in MVP. |
| `POST` | `/webhooks/sepay/ipn` | SePay | HMAC | HMAC fail → 401 · duplicate `reference_id` → 200 no-op · `amount != va.fixed_amount` → 422 | TOPUP: `wallets`, `wallet_transactions` · MILESTONE: `wallets`, `wallet_transactions`, `escrow_accounts`, `milestones`, `paygated_documents`, `engagements` · SERVICE: `wallets`, `wallet_transactions`, `escrow_accounts`, `engagements` | Idempotency via `UNIQUE INDEX`. Always returns 200 to SePay. |
| `POST` | `/webhooks/sepay/chi-ho-credit` | SePay | HMAC | HMAC fail → 401 | — | Deprecated in live execution (admin completes manually). |
| `POST` | `/webhooks/sepay/bank-linked` | SePay | HMAC | HMAC fail → 401 | `users` | Sets `sepay_bank_account_xid`. |

---

### E. Subscriptions (3 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/subscriptions/activate` | CEO or EXPERT | `[None]` | already pro + not expired → 409 · `available_balance < price` → 422 `INSUFFICIENT_BALANCE` | `wallets`, `wallet_transactions`, `users`, `subscription_purchase_logs` | REQUIRES `packageId` in body. Atomic 4-table TX. JWT reissued. |
| `GET` | `/subscriptions/status` | CEO, EXPERT | `[None]` | — | — (R: `users`) | Auto-corrects expired to `free` in response. |
| `GET` | `/subscriptions/history` | CEO, EXPERT | `[None]` | — | — (R: `subscription_purchase_logs`) | Returns purchase log. |

---

### F. Public Config / Reference Data (7 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/config/all` | Unauthenticated | `[None]` | — | — (R: `domain_definitions`, `seam_definitions`, `archetype_definitions`, `void_code_definitions`, `subscription_packages`) | Bootstrap call. Returns all config in one payload. |
| `GET` | `/config/domains` | Unauthenticated | `[None]` | — | — | Active domains only. |
| `GET` | `/config/seams` | Unauthenticated | `[None]` | — | — | Active seams only. |
| `GET` | `/config/archetypes` | Unauthenticated | `[None]` | — | — | Active archetypes only. |
| `GET` | `/config/archetypes/:code/probe-questions` | Unauthenticated | `[None]` | — | — (R: `probe_questions`) | Questions for Stage 3. |
| `GET` | `/config/void-codes` | Unauthenticated | `[None]` | — | — | Active void codes for Stage 2 display. |
| `GET` | `/config/subscription-packages` | Unauthenticated | `[None]` | — | — | Active packages only. |

---

### G. AI Elicitation Engine (19 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/elicitation/sessions` | CEO | `[Pro-C]` | subscription not active → 403 | `elicitation_sessions` | Creates `state: IN_PROGRESS`. |
| `GET` | `/elicitation/sessions` | CEO | `[None]` | — | — | List my sessions. |
| `GET` | `/elicitation/sessions/active` | CEO | `[None]` | — | — | Get currently active session. |
| `GET` | `/elicitation/sessions/history` | CEO | `[None]` | — | — | Completed sessions. |
| `GET` | `/elicitation/sessions/:id` | CEO | `[None]` | not owner → 403 | — | Full session detail. |
| `DELETE` | `/elicitation/sessions/:id` | CEO | `[None]` | not owner → 403 | `elicitation_sessions` | Delete session. |
| `PUT` | `/elicitation/sessions/:id/abandon` | CEO | `[None]` | — | `elicitation_sessions` | Sets `state → ABANDONED`. |
| `PUT` | `/elicitation/sessions/:id/revert` | CEO | `[None]` | — | `elicitation_sessions` | Reverts to previous stage. |
| `PUT` | `/elicitation/sessions/:id/continue` | CEO | `[None]` | — | `elicitation_sessions` | Resumes from RETURNED state. |
| `PUT` | `/elicitation/sessions/:id/stage1` | CEO | `[Pro-C]` | `current_stage != 1` → 422 | `elicitation_sessions` | Calls FastAPI `/llm/elicitation/stage1-extract`. Detects `critical_artifacts_json`. |
| `PUT` | `/elicitation/sessions/:id/stage2` | CEO | `[Pro-C]` | `current_stage != 2` → 422 | `elicitation_sessions` | Locks archetype. Acknowledges voids. |
| `PUT` | `/elicitation/sessions/:id/stage3` | CEO | `[Pro-C]` | `current_stage != 3` → 422 | `elicitation_sessions` | Calls FastAPI `/llm/elicitation/stage3-vagueness-check`. Returns `irrelevant_answers`. |
| `PUT` | `/elicitation/sessions/:id/stage4` | TECH_TEAM or CEO (self-tech) | `[None]` | `client_subtype != TECH_TEAM` AND no `self_technical` claim → 403 | `elicitation_sessions` | Accepts `technical_artifacts`. Calls FastAPI `/llm/elicitation/stage5-synthesize`. |
| `PATCH` | `/elicitation/sessions/:id/draft` | CEO | `[None]` | — | `elicitation_sessions` | Autosaves Stage 1 draft (`symptom_text_draft`). |
| `PATCH` | `/elicitation/sessions/:id/stage4-draft` | TECH_TEAM or CEO (self-tech) | `[None]` | — | `elicitation_sessions` | Autosaves Stage 4 form (`stage4_draft_json`). No LLM call. |
| `POST` | `/elicitation/sessions/:id/stage4-recommend` | CEO | `[Pro-C]` | — | — | Calls FastAPI `/llm/elicitation/stage4-recommend`. |
| `PUT` | `/elicitation/sessions/:id/stage4-handoff` | TECH_TEAM | `[None]` | — | `elicitation_sessions` | Tech team submits Stage 4. |
| `POST` | `/elicitation/sessions/:id/stage5` | CEO | `[Pro-C]` | `current_stage != 5` → 422 | `projects`, `elicitation_sessions`, `platform_decisions` | Runs quality gate. On pass: creates `projects {state: PUBLISHED}` atomically. |
| `POST` | `/elicitation/sessions/:id/generate-handoff-link` | CEO | `[Pro-C]` | — | — | Generates signed JWT handoff link (72h expiry). |
| `PUT` | `/elicitation/sessions/:id/self-technical` | CEO | `[Pro-C]` | — | `elicitation_sessions` | Toggles `self_technical` flag. |

---

### H. Projects & Matching (12 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/projects` | All | `[None]` | — | — (R: `projects`) | List projects. `?slim=true` omits JSON blobs. |
| `GET` | `/projects/:id` | Parties, ADMIN | `[None]` | not in project member list → 403 | — (R: `projects`) | Includes `required_seams_json`, `milestone_framework_json`. Conditionally includes `artifact_b_json` based on FastAPI guard. |
| `GET` | `/projects/:id/artifact-a` | Parties | `[None]` | — | — | Returns `projects.artifact_a_json`. |
| `GET` | `/projects/:id/artifact-b` | EXPERT, TECH_TEAM | `[Pro-C]` | `engagement.state < CONNECTED` → 403 · `bid.state < TECH_APPROVED` → 403 · NDA missing → 403 · CEO requester → 403 **permanent** | — | FastAPI route. All 4 conditions must pass. |
| `PUT` | `/projects/:id/name` | CEO | `[None]` | not owner → 403 | `projects` | Renames project. |
| `GET` | `/projects/:id/milestones` | Parties | `[None]` | — | — | List milestones. |
| `PUT` | `/projects/:id/milestones` | CEO | `[None]` | not owner → 403 | `projects` | Updates `milestone_framework_json`. |
| `PUT` | `/projects/:id/cancel` | CEO | `[None]` | `state != PUBLISHED` → 422 · active engagements exist → 422 | `projects` | Sets `state → SUSPENDED`. |
| `GET` | `/projects/:id/engagements` | CEO, TECH_TEAM, ADMIN | `[None]` | — | — | List engagements on project. |
| `GET` | `/projects/:id/invitations` | CEO | `[None]` | — | — | List sent invitations. |
| `GET` | `/projects/:id/team` | CEO, ADMIN | `[None]` | — | — | List tech team assigned. |
| `GET` | `/matching/:projectId/shortlist` | CEO | `[Pro-C]` | `state != PUBLISHED` → 422 | `project_shortlist_cache` | Returns ranked experts. `?refresh=true` forces re-score via FastAPI. |

---

### I. Expert Profiles & Portfolio (17 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/expert-profile/me` | EXPERT | `[None]` | — | — | Own profile. |
| `PUT` | `/expert-profile/me` | EXPERT | `[None]` | — | `expert_profiles` | Update profile. |
| `GET` | `/expert-profile/search` | CEO, ADMIN | `[None]` | — | — | Search experts. |
| `GET` | `/expert-profile/:userId` | CEO, ADMIN | `[None]` | — | — | View public expert profile. |
| `GET` | `/expert-profile/me/domains` | EXPERT | `[None]` | — | — | List my domain claims. |
| `GET` | `/expert-profile/me/seams` | EXPERT | `[None]` | — | — | List my seam claims. |
| `POST` | `/expert-profile/domains` | EXPERT | `[None]` | duplicate `(expert_id, domain_code)` → 409 | `expert_domain_depths` | Declares domain depth at Tier 1. |
| `PUT` | `/expert-profile/domains/sync` | EXPERT | `[None]` | — | `expert_domain_depths` | Bulk sync domains. |
| `PUT` | `/expert-profile/domains/:id` | EXPERT | `[None]` | not owner → 403 | `expert_domain_depths` | Update domain depth. |
| `DELETE` | `/expert-profile/domains/:id` | EXPERT | `[None]` | not owner → 403 · has portfolio submissions → 422 | `expert_domain_depths` | Delete domain depth. |
| `POST` | `/expert-profile/seams` | EXPERT | `[None]` | duplicate `(expert_id, seam_code)` → 409 | `expert_seam_claims` | Declares seam claim at Tier 1. |
| `PUT` | `/expert-profile/seams/sync` | EXPERT | `[None]` | — | `expert_seam_claims` | Bulk sync seams. |
| `POST` | `/portfolio-submissions` | EXPERT | `[Pro-E]` | `locked_until > now()` → 429 | `portfolio_submissions`, `expert_seam_claims`, `platform_decisions` | Calls FastAPI `/llm/portfolio-eval`. On pass: upgrades to `EVIDENCE_BACKED`. |
| `GET` | `/portfolio-submissions` | EXPERT | `[None]` | — | — | My submissions. |
| `GET` | `/portfolio-submissions/:id` | EXPERT | `[None]` | not owner → 403 | — | Submission detail. |
| `GET` | `/portfolio-submissions/me/portfolio/:id` | EXPERT | `[None]` | not owner → 403 | — | Specific portfolio entry. |
| `DELETE` | `/portfolio-submissions/me/portfolio/:id` | EXPERT | `[None]` | not owner → 403 | `portfolio_submissions` | Delete portfolio entry. |

---

### J. Listings / Services Marketplace (10 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/services` | All | `[None]` | — | — | Browse published listings. |
| `POST` | `/services` | EXPERT | `[None]` | — | `services` | Create listing. If `useAiGenerator=true`, calls FastAPI `/llm/service-generate`. |
| `GET` | `/services/:id` | All | `[None]` | — | — | Listing detail. |
| `PUT` | `/services/:id` | EXPERT | `[None]` | not owner → 403 | `services` | Update listing. |
| `DELETE` | `/services/:id` | EXPERT | `[None]` | not owner → 403 · `state != DRAFT` → 422 | `services` | Delete listing. |
| `POST` | `/services/:id/purchase` | CEO | `[None]` | `available_balance < price` → 422 | `engagements`, `virtual_accounts` | Creates engagement (`SERVICE_PURCHASE` or `TECH_DISCOVERY`) + per-order VA. |
| `GET` | `/services/me` | EXPERT | `[None]` | — | — | My listings (all states). |
| `GET` | `/services/me/purchases` | CEO | `[None]` | — | — | Services I bought. |
| `PUT` | `/services/:id/publish` | EXPERT | `[None]` | `state != DRAFT` → 422 | `services` | DRAFT → PUBLISHED. |
| `PUT` | `/services/:id/unpublish` | EXPERT | `[None]` | `state != PUBLISHED` → 422 | `services` | PUBLISHED → DRAFT. |

---

### K. Engagements (10 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/engagements` | All | `[None]` | — | — | List engagements. |
| `GET` | `/engagements/:id` | Parties, ADMIN | `[None]` | not a party → 403 | — | Full engagement view. |
| `PUT` | `/engagements/:id/accept-nda` | Parties | `[None]` | `state != PENDING` → 422 | `engagements` | Sets NDA timestamp. If both set: `state → CONNECTED`. |
| `POST` | `/engagements/:id/connect` | EXPERT | `[None]` | `state != PENDING` → 422 | `engagements` | Expert accepts connection + NDA. |
| `PUT` | `/engagements/:id/decline` | EXPERT | `[None]` | `state != PENDING` → 422 | `engagements` | Expert declines. |
| `GET` | `/engagements/:id/milestones` | Parties | `[None]` | — | — | List milestones. |
| `GET` | `/engagements/:id/submissions` | Parties | `[None]` | — | — | All submissions across milestones. |
| `GET` | `/engagements/:id/bid` | Parties | `[None]` | — | — | The capability bid for this engagement. |
| `GET` | `/engagements/:id/disputes` | Parties | `[None]` | — | — | Disputes on this engagement. |
| `PUT` | `/engagements/:id/cancel` | Parties | `[None]` | active funded milestones exist → 422 | `engagements` | Cancel engagement. |

---

### L. Capability Bids (8 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/bids` | EXPERT | `[Pro-E]` (Tier 2-3) | self-exclusion → 403 · not in shortlist → 403 · missing components → 422 | `engagements`, `capability_bids` | Creates engagement + bid. Notifies CEO + TechTeam via WS. |
| `GET` | `/bids` | EXPERT, CEO, ADMIN | `[None]` | — | — | List bids (role-scoped). |
| `GET` | `/bids/:id` | Parties | `[None]` | not a party → 403 | — | Bid detail. |
| `PUT` | `/bids/:id` | EXPERT | `[None]` | `tech_status != REVISION_REQUESTED` → 422 | `capability_bids` | In-place mutable revision. Increments `version_number`. |
| `DELETE` | `/bids/:id` | EXPERT | `[None]` | `state != SUBMITTED` → 422 | `capability_bids` | Withdraw bid. |
| `PUT` | `/bids/:id/tech-review` | TECH_TEAM | `[None]` | `tech_status != PENDING` → 422 | `capability_bids` | Sets `tech_status = APPROVED` or `REVISION_REQUESTED`. |
| `PUT` | `/bids/:id/ceo-decision` | CEO | `[None]` | `tech_status != APPROVED` → 422 | `capability_bids`, `engagements` | Sets `ceo_status`. If `APPROVED`: `state → SELECTED`. |
| `PUT` | `/bids/:id/counter-offer` | CEO | `[None]` | `negotiated_price_vnd` already set → 409 | `capability_bids` | One-round only. |

---

### M. Milestones (7 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/milestones` | CEO | `[None]` | `engagement.state < CONNECTED` → 422 | `milestones` | Creates milestone at `state: DEFINED`. |
| `GET` | `/milestones` | Parties | `[None]` | — | — | List by engagement. |
| `GET` | `/milestones/:id` | Parties | `[None]` | — | — | Detail (includes criteria). |
| `PATCH` | `/milestones/:id` | CEO | `[None]` | `state != DEFINED` → 422 | `milestones` | Edit milestone. |
| `DELETE` | `/milestones/:id` | CEO | `[None]` | `state != DEFINED` → 422 | `milestones` | Delete milestone. |
| `PUT` | `/milestones/:id/fund` | CEO | `[None]` | `state != DEFINED` → 422 | `milestones`, `virtual_accounts` | Creates per-milestone VA. Sets `state → AWAITING_PAYMENT`. |
| `GET` | `/milestones/:id/disputes` | Parties | `[None]` | — | — | Disputes on this milestone. |

---

### N. Acceptance Criteria & DoD Checklist (9 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/criteria/:milestoneId` | Parties | `[None]` | — | — | List criteria. |
| `POST` | `/criteria/:milestoneId` | CEO | `[None]` | — | `acceptance_criteria`, `platform_decisions` | Calls FastAPI `/llm/criterion-check` (advisory). |
| `DELETE` | `/criteria/:id` | CEO | `[None]` | — | `acceptance_criteria` | Delete criterion. |
| `PUT` | `/criteria/:id/verify` | TECH_TEAM or CEO | `[None]` | `verified_by_role` mismatch → 403 · `state != SUBMITTED` → 422 | `acceptance_criteria` | Sets `verified_at`. Triggers APPROVED guard. |
| `PUT` | `/criteria/:id/revision` | TECH_TEAM or CEO | `[None]` | `state NOT IN (SUBMITTED, IN_REVISION)` → 422 | `acceptance_criteria`, `milestones` | Writes `revision_note`. Sets `state → IN_REVISION`. |
| `POST` | `/milestones/:id/dod/items` | EXPERT | `[None]` | `state != IN_PROGRESS` → 422 | `milestone_dod_items` | Add DoD item. |
| `PUT` | `/milestones/:id/dod/:itemId` | EXPERT | `[None]` | `is_required = true AND status = NOT_APPLICABLE` → 422 (DB CHECK) | `milestone_dod_items` | Update status. |
| `DELETE` | `/milestones/:id/dod/:itemId` | EXPERT | `[None]` | `status != PENDING` → 422 | `milestone_dod_items` | Delete DoD item. |
| `GET` | `/milestones/:id/dod` | EXPERT, TECH_TEAM | `[None]` | CEO request → 403 | — | List DoD items. |

---

### O. Submissions & Paygated Documents (5 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/milestones/:id/submit` | EXPERT | `[None]` | DoD gate: incomplete required items → 422 `DOD_INCOMPLETE` | `milestone_submissions`, `milestones` | Sets `state → SUBMITTED`. |
| `POST` | `/milestones/:id/paygated-docs` | EXPERT | `[None]` | — | `paygated_documents` | Uploads doc. Sets `release_state: STAGED`. |
| `GET` | `/milestones/:id/paygated-docs` | TECH_TEAM, EXPERT | `[None]` | CEO request → 403 | — | Returns only `RELEASED` docs. |
| `GET` | `/milestones/:id/submissions` | Parties | `[None]` | — | — | Submission history. |
| `GET` | `/milestones/:id/submissions/latest` | Parties | `[None]` | — | — | Most recent submission. |

---

### P. Disputes (5 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/disputes` | Parties | `[None]` | `state NOT IN (SUBMITTED, IN_REVISION)` → 422 · `criterion_id` NULL → 422 | `disputes`, `escrow_accounts`, `milestones` | Atomic freeze. Calls FastAPI `/llm/dispute-eval`. On ≥ 0.80: AUTO_RESOLVED + ledger. |
| `GET` | `/disputes` | Parties, ADMIN | `[None]` | — | — | List disputes. |
| `GET` | `/disputes/:id` | Parties, ADMIN | `[None]` | — | — | Dispute detail. |
| `POST` | `/disputes/:id/evidence` | Parties | `[None]` | `state NOT IN (LAYER_1_EVAL, MANUAL_REVIEW)` → 422 | `platform_decisions` | Add evidence. |
| `PUT` | `/disputes/:id/withdraw` | Filer | `[None]` | `state NOT IN (LAYER_1_EVAL, MANUAL_REVIEW)` → 422 | `disputes` | Sets `state → WITHDRAWN`. Unfreezes escrow. |

---

### Q. Messaging & Conversations (6 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/engagements/:id/messages` | Parties, ADMIN | `[None]` | — | — | Cursor pagination. |
| `GET` | `/projects/:id/messages` | Parties | `[None]` | — | — | Pre-bid Q&A thread. |
| `POST` | `/messages/:id/read` | Parties | `[None]` | — | `message_reads` | Idempotent. |
| `GET` | `/engagements/:id/messages/unread-count` | Parties | `[None]` | — | — | Unread count. |
| `GET` | `/projects/:id/messages/unread-count` | Parties | `[None]` | — | — | Unread count. |
| `GET` | `/conversations` | All | `[None]` | — | — | Inbox sidebar list. |

---

### R. Notifications (5 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/notifications/me` | All | `[None]` | — | — | List my notifications. |
| `GET` | `/notifications/me/unread-count` | All | `[None]` | — | — | Nav badge count. |
| `PUT` | `/notifications/:id/read` | Owner | `[None]` | not owner → 403 | `notifications` | Mark one read. |
| `PUT` | `/notifications/read-all` | All | `[None]` | — | `notifications` | Mark all read. |
| `DELETE` | `/notifications/:id` | Owner | `[None]` | not owner → 403 | `notifications` | Delete notification. |

---

### S. Invitations (4 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/invitations` | EXPERT | `[None]` | — | — | My invitations (includes `ceo.clientProfile.companyName`). |
| `POST` | `/invitations/:id/decline` | EXPERT | `[None]` | — | `invitations` | Decline. |
| `GET` | `/invitations/sent` | CEO | `[None]` | — | — | Sent invitations. |
| `DELETE` | `/invitations/:id` | CEO | `[None]` | `status = ACCEPTED` → 422 | `invitations` | Retract pending. |

---

### T. Reviews (5 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/reviews` | Parties | `[None]` | `engagement.state != CLOSED` → 422 · duplicate → 409 | `reviews` | Role-specific form validation. |
| `GET` | `/reviews/:engagementId` | Parties, ADMIN | `[None]` | — | — | All reviews for engagement. |
| `GET` | `/reviews/users/:userId` | All | `[None]` | — | — | Public profile reviews. |
| `GET` | `/reviews/me` | All | `[None]` | — | — | Reviews I wrote. |
| `GET` | `/reviews/me/received` | All | `[None]` | — | — | Reviews I received. |

---

### U. Admin Module — Oversight (18 Endpoints)

> All `/admin/*` endpoints require `active_role = ADMIN`. Non-admin requests return 403.

| Method | Path | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|
| `PUT` | `/admin/projects/:id/suspend-spec` | `[Admin]` | `state != PUBLISHED` → 422 | `projects` | Emergency pull-back. |
| `PUT` | `/admin/users/:id/suspend` | `[Admin]` | — | `users` | Sets `is_active = false`. |
| `GET` | `/admin/disputes` | `[Admin]` | — | — | Disputes queue. |
| `PUT` | `/admin/disputes/:id/resolve` | `[Admin]` | `state != MANUAL_REVIEW` → 422 | `disputes`, `escrow_accounts`, `wallets`, `wallet_transactions`, `milestones` | Admin selects release/refund/split. Always sets `milestones.state → APPROVED`. |
| `GET` | `/admin/decisions` | `[Admin]` | — | — | LLM/AI decisions log. |
| `GET` | `/admin/transactions` | `[Admin]` | — | — | Wallet tx ledger. |
| `GET` | `/admin/analytics` | `[Admin]` | — | — | Platform aggregates. |
| `GET` | `/admin/withdrawals` | `[Admin]` | — | — | Withdrawal queue. |
| `PUT` | `/admin/withdrawals/:id/complete` | `[Admin]` | `status != PENDING` → 422 | `withdrawal_requests` | Manually confirm sent. |
| `PUT` | `/admin/withdrawals/:id/fail` | `[Admin]` | `status != PENDING` → 422 | `withdrawal_requests`, `wallets`, `wallet_transactions` | Mark failed + restore wallet. |
| `GET` | `/admin/users` | `[Admin]` | — | — | List users. |
| `GET` | `/admin/users/:id` | `[Admin]` | — | — | Full user detail. |
| `PUT` | `/admin/users/:id/reactivate` | `[Admin]` | — | `users` | Sets `is_active = true`. |
| `GET` | `/admin/projects` | `[Admin]` | — | — | List all projects. |
| `GET` | `/admin/projects/:id` | `[Admin]` | — | — | Full project detail. |
| `PUT` | `/admin/projects/:id/reopen` | `[Admin]` | `state != SUSPENDED` → 422 | `projects` | Reopen suspended project. |
| `GET` | `/admin/engagements` | `[Admin]` | — | — | List all engagements. |
| `GET` | `/admin/experts` | `[Admin]` | — | — | List experts with verification status. |

---

### V. Admin Config CMS — Taxonomy (22 Endpoints)

| Resource | Endpoints | Notes |
|---|---|---|
| **Domains** | `GET/POST /admin/config/domains` · `PUT/DELETE /admin/config/domains/:id` | Soft-delete via `isActive: false`. |
| **Seams** | `GET/POST /admin/config/seams` · `PUT/DELETE /admin/config/seams/:id` | Must use ↔ arrow format. |
| **Archetypes** | `GET/POST /admin/config/archetypes` · `PUT/DELETE /admin/config/archetypes/:id` | — |
| **Probe Questions** | `GET/POST /admin/config/probe-questions` · `PUT/DELETE /admin/config/probe-questions/:id` | Per-archetype. |
| **Void Codes** | `GET/POST /admin/config/void-codes` · `PUT/DELETE /admin/config/void-codes/:id` | Severity: HIGH/MEDIUM/LOW. |

---

### W. Admin Subscriptions & Prompt Templates (8 Endpoints)

| Method | Path | Gate | Guard → Error | W Tables | Notes |
|---|---|---|---|---|---|
| `GET` | `/admin/subscriptions/packages` | `[Admin]` | — | — | List ALL (active + inactive). |
| `POST` | `/admin/subscriptions/packages` | `[Admin]` | — | `subscription_packages` | Create. |
| `PUT` | `/admin/subscriptions/packages/:id` | `[Admin]` | — | `subscription_packages` | Update price/duration. |
| `DELETE` | `/admin/subscriptions/packages/:id` | `[Admin]` | has purchase history → 422 | `subscription_packages` | Hard delete. |
| `GET` | `/admin/prompts` | `[Admin]` | — | — | List metadata. |
| `GET` | `/admin/prompts/:stage` | `[Admin]` | — | — | Full template text. |
| `PUT` | `/admin/prompts/:stage` | `[Admin]` | — | `prompt_templates` | Upsert. |
| `DELETE` | `/admin/prompts/:stage` | `[Admin]` | — | `prompt_templates` | Reset to default `.txt` file. |

---

### X. FastAPI / LLM Engine Endpoints (Internal — Called by NestJS Only, 12 Endpoints)

> These endpoints run on the internal FastAPI microservice (e.g., `http://llm-service:8000`). They are **never** exposed to the frontend. NestJS calls them, receives the response, and then writes to the primary DB. Requires `X-Internal-Token` header.

| Method | Path | Called By | Purpose | Request Payload (key fields) | Response (key fields) | DB Side-Effects (via NestJS) |
|---|---|---|---|---|---|---|
| `GET` | `/health` | NestJS health check | Service health | — | `{ status, service }` | None |
| `POST` | `/llm/elicitation/stage1-extract` | NestJS Stage 1 | Extract symptoms, voids, archetypes | `{ symptom_text, archetypes, void_codes }` | `{ symptoms, scale_signals, voids, recommended_archetypes, critical_artifacts_required }` | NestJS writes `elicitation_sessions.void_list_json` |
| `POST` | `/llm/elicitation/stage3-vagueness-check` | NestJS Stage 3 | Check probe answers for vagueness/irrelevancy | `{ archetype, probe_responses, is_self_technical, stage1_symptoms, stage1_voids }` | `{ vague_answers, irrelevant_answers }` | NestJS returns warnings to FE (non-blocking) |
| `POST` | `/llm/elicitation/stage4-recommend` | NestJS Stage 4 | AI recommends tech context | `{ stage1_symptoms, stage2_archetype, stage3_probes, void_list_json, estimated_budget_vnd }` | `{ recommended_stack, recommended_integration, recommended_legacy_volume }` | NestJS pre-fills Stage 4 form |
| `POST` | `/llm/elicitation/stage5-synthesize` | NestJS Stage 5 | Full project synthesis | `{ session_id, stage1-4 inputs, void_list_json, critical_artifacts_required, domains, seams, archetypes }` | `{ required_seams_json, required_domains_json, milestone_framework_json, artifact_a_json, artifact_b_json, completeness_score, estimated_total_cost_vnd, estimated_total_duration_days }` | NestJS runs quality gate; on pass: creates `projects` + `platform_decisions` |
| `POST` | `/llm/elicitation/milestone-chat` | NestJS Chat | Context-aware milestone editing assistant | `{ artifact_a, milestone_framework, budget_context, conversation_history, user_message }` | `{ reply, suggested_edit }` | NestJS writes `milestone_chat_sessions.messagesJson` |
| `POST` | `/llm/portfolio-eval` | NestJS Portfolio | Tier 2 seam verification | `{ project_description, decision_points, seam_code, seam_name, seam_description, all_seam_definitions }` | `{ confidence_score, passed_boolean, gap_advisory }` | NestJS writes `portfolio_submissions`, `expert_seam_claims`, `platform_decisions` |
| `POST` | `/llm/matching` | NestJS Publish | Composite match scoring | `{ required_seams_json, required_domains_json, expert_profiles, project_archetype }` | `[{ expert_id, composite_score, strength_label, gap_map }]` | NestJS writes `project_shortlist_cache` |
| `POST` | `/llm/dispute-eval` | NestJS Dispute | Layer 1 LLM arbitration | `{ criterion_text, deliverable_description, files, project_archetype, milestone_context, prior_revision_count }` | `{ confidence_score, finding, reasoning }` | NestJS writes `disputes.llm_confidence`; on ≥ 0.80: fires ledger TX |
| `POST` | `/llm/criterion-check` | NestJS Criteria | Quality gate: is criterion subjective? | `{ criterion_text, project_archetype, archetype_name, milestone_context }` | `{ is_subjective, suggestions, severity, context_note }` | NestJS writes `platform_decisions {CRITERION_QUALITY_GATE}` |
| `POST` | `/llm/service-generate` | NestJS Listing | Generate structured service listing draft | `{ expert_capabilities, target_use_cases, claimed_domains, claimed_seams, price_guidance, is_pro_expert }` | `{ title, description, scope, timeline, suggested_price_vnd, suggested_domains, suggested_seams, pricing_rationale }` | NestJS writes `services {state: DRAFT}` |
| `GET` | `/projects/{project_id}/artifact-b` | NestJS Project | Gate check: can expert access Artifact B? | Query: `engagement_state, bid_state, expert_nda_accepted, ceo_nda_accepted` | 200 OK or 403 Forbidden | NestJS conditionally returns `artifact_b_json` |

---

### Y. Socket.io Real-Time Events (Non-HTTP — Reference Only)

> These use the Socket.io protocol over the same NestJS server. Room key is `user:<userId>` for notifications, `engagement:<engagementId>` for chat.

| Event Name | Direction | Payload | Trigger |
|---|---|---|---|
| `notification:generic` | Server → Client | `{ type, title, body, link }` | Bid submitted, milestone state change, system notice |
| `message:received` | Server → Client | `{ id, engagementId, senderId, content, timestamp }` | New chat message in engagement |
| `project:message` | Server → Client | `{ id, projectId, senderId, content, timestamp }` | New pre-bid Q&A message |
| `bid:update` | Server → Client | `{ bidId, newState, engagementId }` | Bid state transition |
| `milestone:update` | Server → Client | `{ milestoneId, newState, engagementId }` | Milestone state transition |
| `dispute:update` | Server → Client | `{ disputeId, newState, engagementId }` | Dispute state transition |
| `message:send` | Client → Server | `{ engagementId, content, attachmentUrl? }` | Send engagement chat message |
| `project:message:send` | Client → Server | `{ projectId, content }` | Send pre-bid Q&A message |
| `typing:start` | Client → Server | `{ engagementId }` | Typing indicator |
| `typing:stop` | Client → Server | `{ engagementId }` | Typing indicator |