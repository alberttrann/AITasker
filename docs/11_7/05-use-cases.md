# AITasker — Use Case Specifications (Current Build)
**Schema:** 40 tables · **API surface:** 213 endpoints  
**Purpose:** Authoritative use case reference for every actor interaction and system behaviour grounded in the live schema and deployed API. Supersedes the 9-week MVP scope-reduced document.

---

## Notation Key

```
UC_BASE  ---<<include>>--->  UC_SUB    Arrow FROM base TO included UC (mandatory sub-behaviour)
UC_EXT   ---<<extend>>---->  UC_BASE   Arrow FROM extending UC TO base (conditional behaviour)
```

**Table names** resolve to the 40-table physical schema. **State names** match column values on `elicitation_sessions`, `projects`, `engagements`, `capability_bids`, `milestones`, `disputes`, `services`, `paygated_documents`, `withdrawal_requests`, `invitations`, `notifications`.

---

## Part A — CLIENT / CEO Flows

---

### UC-AUTH01 — Register Account (All Roles)

**Primary Actor:** Unauthenticated user (CEO or Expert)  
**API:** `POST /auth/register`  
**Tables written:** `users`, `client_profiles` (if CEO), `expert_profiles` (if Expert), `wallets`, `virtual_accounts`

**Preconditions:**
1. No account with this email exists.
2. Email is from a non-disposable domain with valid MX records.

**Main Success Scenario:**
1. Actor submits `{ email, password, fullName, phone, roles, selfTechnical }`.
2. System normalizes email (trim + lowercase) before storage.
3. System validates password against all five rules simultaneously.
4. DB transaction: `users` row created; `client_profiles` or `expert_profiles` row created; `wallets {available_balance:0, locked_balance:0}`; `virtual_accounts {entity_type:'WALLET_TOPUP', status:'ACTIVE', fixed_amount:NULL}` (permanent, no expiry).
5. System issues `access_token` + `refresh_token`; returns `user` object with normalized email.

**Extensions:**
- [Password rules violated] 400 with `message` as **array** of all failing rules simultaneously — show checklist UI.
- [Disposable email domain] 400 "Temporary or throwaway email addresses are not permitted."
- [No MX records on domain] 400 "Email domain does not exist or cannot receive mail."
- [Duplicate email] 409 — note: `ALBERT@gmail.com` and `albert@gmail.com` are the same after normalization.

**Postconditions:**
- `users` row active; `wallets.available_balance = 0`; permanent `WALLET_TOPUP` VA exists.
- Actor authenticated with `access_token` and `refresh_token`.

---

### UC-AUTH02 — Forgot Password (Unauthenticated Reset)

**Primary Actor:** Unauthenticated user  
**APIs:** `POST /auth/forgot-password` → `GET /auth/verify-reset-token/:token` → `POST /auth/reset-password`  
**Tables written:** `users.password_reset_token`, `users.password_reset_token_expires_at`, `users.refresh_token_hash`

**Preconditions:**
1. Actor knows their registered email address.
2. Actor cannot log in (forgotten password).

**Main Success Scenario:**
1. Actor submits `POST /auth/forgot-password { email }`. System always returns identical response regardless of whether email exists (anti-enumeration). If email exists: writes `password_reset_token` + `password_reset_token_expires_at (now + 1 hour)` to `users`; dispatches email with link `/reset-password/<token>`.
2. **[MANDATORY — call on page mount]** Actor opens reset-password page. System calls `GET /auth/verify-reset-token/:token`.
   - [Token valid — not expired, not yet used] 200 `{ valid:true }` → show new-password form.
   - [Token invalid or expired] 400 → show error screen with "Request a new link" CTA; do NOT show form.
3. Actor fills new password. `POST /auth/reset-password { token, newPassword }`.
4. System validates new password against all five rules (same as UC-AUTH01).
5. DB: `users.password_hash` updated; `users.refresh_token_hash = NULL` (all existing sessions invalidated); `users.password_reset_token = NULL`; `users.password_reset_token_expires_at = NULL`.

**Extensions:**
- [Password rule violations in Step 3] 400 `message[]` array — show checklist.
- [Token already used (Step 3)] 400 — token consumed after first reset; request a new link.

**Postconditions:**
- New password set; all prior refresh tokens invalidated.
- `users.refresh_token_hash = NULL` — actor must log in again on all devices.

---

### UC-AUTH03 — Change Password (Authenticated)

**Primary Actor:** Any authenticated user  
**API:** `PUT /auth/me/password`  
**Tables written:** `users.password_hash`, `users.refresh_token_hash`

**Preconditions:**
1. Actor is authenticated with a valid `access_token`.
2. Actor knows their current password.

**Main Success Scenario:**
1. Actor submits `{ currentPassword, newPassword }`.
2. System validates `currentPassword` against stored `users.password_hash`.
3. [Valid] System validates `newPassword` against all five rules simultaneously.
4. DB: `users.password_hash` updated; `users.refresh_token_hash = NULL` (forces re-login on all devices).
5. 200 "Password changed successfully. Please log in again."

**Extensions:**
- [Current password wrong] 401 "Current password is incorrect."
- [New password rule violations] 400 `message[]` array.

**Postconditions:**
- New password set; all existing refresh tokens invalidated.

---

### UC-AUTH04 — Logout with Server-Side Token Invalidation

**Primary Actor:** Any authenticated user  
**API:** `POST /auth/logout`  
**Tables written:** `users.refresh_token_hash`

**Preconditions:**
1. Actor is authenticated.

**Main Success Scenario:**
1. Actor clicks logout. `POST /auth/logout` with Bearer token.
2. DB: `users.refresh_token_hash = NULL`.
3. FE clears `access_token` and `refresh_token` from storage.
4. Any subsequent `POST /auth/refresh` call with the old token → 401 "Refresh token has been invalidated."

**Postconditions:**
- Session fully invalidated server-side. Stolen tokens cannot be used to refresh.

---

### UC-AUTH05 — Account Deactivation

**Primary Actor:** Any authenticated user  
**API:** `DELETE /users/me`  
**Tables written:** `users.is_active`

**Preconditions:**
1. Actor is authenticated.
2. No active engagements in state other than `CLOSED` or `CANCELLED`.

**Main Success Scenario:**
1. Actor submits deactivation request. System queries `engagements WHERE (expert_id OR client_id = actor.id) AND state NOT IN ('CLOSED','CANCELLED')`.
2. [No active engagements] `users.is_active = false`. Actor logged out automatically.
3. Admin can reactivate via `PUT /admin/users/:id/reactivate`.

**Extensions:**
- [Active engagements found] 422 "Cannot deactivate account with N active engagement(s). Close them first."

**Postconditions:**
- `users.is_active = false`. Actor cannot log in; existing tokens rejected.

---

### UC01 — Submit Project via AI Elicitation Engine

**Primary Actor:** CLIENT / CEO  
**Secondary Actor:** System (FastAPI / LLM Engine)  
**APIs:** `POST /elicitation/sessions`, `PUT /elicitation/sessions/:id/stage1`, `PUT /elicitation/sessions/:id/stage2`, `PUT /elicitation/sessions/:id/stage3`, `PUT /elicitation/sessions/:id/stage4` (or handoff variant), `POST /elicitation/sessions/:id/stage5`  
**Subscription gate:** Client Pro required. Routes return 403 if `users.subscription_client_tier = 'free'`.  
**Tables written:** `elicitation_sessions`, `projects`, `platform_decisions`, `tech_team_profiles.linked_project_id`, `milestone_chat_sessions` (if chat used)

**Preconditions:**
1. `active_role = CLIENT`, `client_subtype = CEO`.
2. `users.subscription_client_tier = 'pro'` AND `sub_client_expires_at > now()` (verified via `GET /subscriptions/status`).
3. No un-abandoned `elicitation_sessions` with `state = 'IN_PROGRESS'` for this user — or actor resumes existing session.

**Main Success Scenario:**

**Session start:**
1. Actor opens "Post a Project". If active session exists → `GET /elicitation/sessions/active` → offer Resume or abandon via `PUT /elicitation/sessions/:id/abandon`. If no session → `POST /elicitation/sessions` creates `{state:'IN_PROGRESS', current_stage:1}`.

**Stage 1 — Symptom Intake:**
2. Actor types free-form pain description. System auto-saves draft via `PATCH /elicitation/sessions/:id/draft` every 30 seconds (saves `symptom_text_draft`, no LLM call).
3. Actor submits `PUT /elicitation/sessions/:id/stage1 { symptomText }`.
4. LLM skip: if `symptomText.trim() === stage1_original_input` → cached result returned, no AI call.
5. System calls FastAPI `stage1_extract` with live `archetypes` + `void_codes` injected from `archetype_definitions` + `void_code_definitions` tables (Jinja2 template variables).
6. **Critical Artifact Detection (NEW):** LLM detects mentions of proprietary documents the AI system will depend on (e.g. "based on our compliance ruleset"). Returns `critical_artifacts_required: [{ artifact_key, label, reason, placeholder_prompt }]`.
7. DB writes: `stage1_original_input`, `stage1_symptoms_json`, `void_list_json`, `recommended_archetypes_json`, `estimated_budget_vnd` (if budget detected), `critical_artifacts_json` (detected required artifacts).
8. `current_stage → 2`. Actor sees diff: "What you wrote" (stage1OriginalInput) vs "What AI extracted" (stage1SymptomsJson). If `critical_artifacts_json` non-empty → persistent banner shown.

**Stage 2 — Archetype Selection + Void Acknowledgement:**
9. Actor fetches archetype options: `GET /config/archetypes` — **live from `archetype_definitions` table, NOT hardcoded**. Recommended options highlighted from `recommended_archetypes_json`.
10. Actor fetches void descriptions: `GET /config/void-codes` — **live from `void_code_definitions` table**. CEO reads each detected void's name, description, severity.
11. Actor selects archetype + acknowledges all detected voids: `PUT /elicitation/sessions/:id/stage2 { archetype, acknowledgedVoidCodes:[] }`.
12. `elicitation_sessions.archetype` locked (immutable). `current_stage → 3`.

**Stage 3 — Behavioral Probe Questions:**
13. Actor fetches probe questions: `GET /config/archetypes/:code/probe-questions` — **live from `probe_questions` table, NOT hardcoded**. `questionText` strings are both the form labels and the request body keys.
14. Actor answers all questions (all required): `PUT /elicitation/sessions/:id/stage3 { probe_responses: { "question text": "answer" } }`.
15. System runs **dual check** via FastAPI (NEW — relevancy added):
    - **Vagueness check:** answers too generic to be actionable → `vague_answers: [{ question, reason }]`
    - **Relevancy check:** answers that don't address this project's context (uses Stage 1 symptoms) → `irrelevant_answers: [{ question, issue }]`
    - Both are advisory warnings only — neither blocks submission.
16. DB writes: `stage3_probes_json`. `current_stage → 4`.

**Stage 4 — Technical Architecture Context:**
17. [TECH_TEAM route] → UC01t. [Self-technical CEO route] → UC01b. [No TECH_TEAM Scenario A] → UC01a.
18. Actor auto-saves Stage 4 form via `PATCH /elicitation/sessions/:id/stage4-draft { draftJson }` — no LLM call. On revisit, `session.stage4DraftJson` pre-fills form.
19. Actor submits `PUT /elicitation/sessions/:id/stage4`:
    ```
    { current_stack, data_available, latency_requirement,
      additional_requirement_1,
      technical_artifacts: { "<artifact_key>": "<content>" } }
    ```
    - `technical_artifacts` keys come from `session.critical_artifacts_json[].artifact_key`
    - System computes `missingArtifacts` — items in `critical_artifacts_json` not yet in `technical_artifacts`
20. Response: `{ session, missingArtifacts:[] }`. If `missingArtifacts` non-empty → FE shows warning modal (NOT hard block). CEO may proceed with incomplete artifacts (completeness_score penalized in synthesis).
21. DB writes: `stage4_tech_inputs_json`. `current_stage → 5`.

**Stage 5 — Synthesis + Quality Gate:**
22. [Optional] AI stack recommendation: `POST /elicitation/sessions/:id/stage4-recommend` → pre-fills Stage 4 form for non-technical CEOs.
23. CEO triggers synthesis: `POST /elicitation/sessions/:id/stage5`.
24. System fetches live config from `domain_definitions`, `seam_definitions`, `archetype_definitions` — injects into Jinja2 synthesis prompt (fetched from `prompt_templates` table with 60s TTL cache via `GET /internal/prompts/stage5_synthesize`).
25. FastAPI synthesis produces: `required_seams_json`, `required_domains_json`, `milestone_framework_json`, `artifact_a_json`, `artifact_b_json`. NEW: `estimated_total_cost_vnd`, `estimated_total_duration_days` (AI budget estimates). If submitted artifacts → milestone deliverables grounded to actual content.
26. **Missing artifacts penalty:** If `critical_artifacts_required` items were not submitted → `completeness_score` capped at 0.60; `artifact_a_json.sdlc_notices` includes specific warnings.
27. Auto-publish quality gate: (a) completeness ≥ 0.70, (b) matching pre-check ≥ 1 expert above threshold, (c) no unresolved hard voids.
28. [ALL PASS] `projects` row created (`state='PUBLISHED'`); all JSONB fields populated; `elicitation_sessions.state='COMPLETED'`; `tech_team_profiles.linked_project_id` set (bug fix: now set atomically on publish, not null). `platform_decisions` row written. Matching engine fires → shortlist cached in `project_shortlist_cache`.
29. [ANY FAIL] `elicitation_sessions.state='RETURNED'`; `platform_decisions {SPEC_AUTO_RETURN, advisory_note}` written. Actor re-enters at specific failing stage via `PUT /elicitation/sessions/:id/revert { targetStage }` — not from Stage 1.

**Session management:**
- Resume active session: `GET /elicitation/sessions/active`
- List all sessions: `GET /elicitation/sessions`
- Delete session: `DELETE /elicitation/sessions/:id`
- Retry failed synthesis: `POST /elicitation/sessions/:id/retry-synthesis`
- Continue from current stage: `PUT /elicitation/sessions/:id/continue`

**Extensions:**
- `UC01a` [EXTEND at Stage 4 — no TECH_TEAM available]: Scenario A.
- `UC01b` [EXTEND at Stage 4 — self-technical CEO]: Scenario B.
- `UC01t` [EXTEND at Stage 4 — TECH_TEAM drives Stage 4]: TECH_TEAM account.
- [Quality gate fail] `RETURNED` state; re-entry at specific stage via revert.

**Includes:**
- `<<include>> Verify Subscription Gate` — before Stage 1.
- `<<include>> Run Critical Artifact Detection` — Stage 1 LLM sub-process (always runs).
- `<<include>> Run Dual Vagueness+Relevancy Check` — Stage 3 sub-process (always runs).
- `<<include>> Run Automated Quality Gate` — Stage 5 sub-process (always runs after synthesis).

**Postconditions (success):**
- `projects.state = 'PUBLISHED'`; all JSONB fields + cost/duration estimates populated.
- `elicitation_sessions.state = 'COMPLETED'`; `critical_artifacts_json` preserved for reference.
- `tech_team_profiles.linked_project_id` set atomically.
- Shortlist generated; CEO can view via `GET /matching/:projectId/shortlist`.

---

### UC01a — Proceed via Technical Discovery Pathway (Scenario A)

**Primary Actor:** CLIENT / CEO  
**Extends:** UC01 at Stage 4 (threshold crossed; no TECH_TEAM available)  
**API:** `PUT /elicitation/sessions/:id/self-technical { selfTechnical:false }` (system sets)  
**Tables written:** `elicitation_sessions.scenario_type`

**Two options presented:**

**Option A — Inject TECH_DISCOVERY Milestone 0:**
- System writes `scenario_type = 'SCENARIO_A'`; injection reflected in `milestone_framework_json`.
- Proceeds directly to Stage 5 synthesis. Expert bids must include discovery in Milestone 0 scope.

**Option B — Purchase TECH_DISCOVERY Service First:**
- Routes to UC10 (service purchase flow). Current `elicitation_sessions` preserved at `state='IN_PROGRESS'`, `current_stage=4`. After that engagement closes, CEO resumes elicitation at Stage 4 with technical context.

**Postconditions:**
- Option A: `scenario_type = 'SCENARIO_A'`; project proceeds to synthesis.
- Option B: Actor redirected to UC10; session resumable.

---

### UC01b — Complete Stage 4 as Self-Technical CEO (Scenario B)

**Primary Actor:** CLIENT / CEO  
**Extends:** UC01 at Stage 4 (`self_technical = true`)  
**API:** `PUT /elicitation/sessions/:id/self-technical { selfTechnical:true }` → `PUT /elicitation/sessions/:id/stage4`  
**Tables written:** `elicitation_sessions.stage4_tech_inputs_json`, `projects.self_technical`

**Preconditions:**
1. Actor set `self_technical = true` during Stage 1 or via `PUT /elicitation/sessions/:id/self-technical`.

**Main Success Scenario:**
1. System presents Stage 4 form directly to CEO. `scenario_type = 'SCENARIO_B'` written.
2. Auto-save: `PATCH /elicitation/sessions/:id/stage4-draft { draftJson }` — on revisit, form pre-populated.
3. Actor fills: `current_stack`, `data_available`, `latency_requirement`, `additional_requirement_1` (optional), `technical_artifacts` (content for items detected in Stage 1 `critical_artifacts_json`).
4. Submit → `stage4_tech_inputs_json` written; Stage 5 synthesis triggered.

**Postconditions:**
- `projects.self_technical = true`; `artifact_b_json` populated from CEO's Stage 4 inputs.
- No TECH_TEAM bid review required for this project.

---

### UC01t — TECH_TEAM Completes Stage 4 Architecture Handoff

**Primary Actor:** CLIENT / TECH_TEAM  
**Extends:** UC01 at Stage 4 (TECH_TEAM drives Stage 4 on separate account)  
**APIs:** `POST /auth/register/handoff` OR `POST /auth/claim-handoff`, `PUT /elicitation/sessions/:id/stage4-handoff`, `PATCH /elicitation/sessions/:id/stage4-draft`  
**Tables written:** `users`, `tech_team_profiles`, `elicitation_sessions.stage4_tech_inputs_json`  
**Bug fix applied:** `tech_team_profiles.linked_project_id` now set atomically if project already published (previously always null).

**Preconditions:**
1. Actor opens signed handoff JWT link (`purpose:'tech-team-handoff'`, 72-hour expiry, `handoff_consumed_at IS NULL`).
2. Actor registers via `POST /auth/register/handoff` (new user) or claims via `POST /auth/claim-handoff` (existing user).
3. `tech_team_profiles {linked_client_id, linked_project_id}` created.

**Main Success Scenario:**
1. Actor lands on Stage 4 form. System validates JWT + expiry; extracts `ceoId`.
2. Auto-save: `PATCH /elicitation/sessions/:id/stage4-draft { draftJson }` — draft persisted without triggering synthesis.
3. Actor fills: `current_stack`, `data_available`, `latency_requirement`, `additional_requirement_1` (optional), `technical_artifacts: { "<artifact_key>": "<content>" }` — submits content for items flagged in `session.critical_artifacts_json`.
4. `PUT /elicitation/sessions/:id/stage4-handoff` — validates `client_subtype = 'TECH_TEAM'`.
5. Response: `{ session, missingArtifacts:[] }`. Warning shown if artifacts missing — not a hard block.
6. Synthesis triggered server-side (Stage 5 runs); CEO notified.

**Extensions:**
- [Link expired — 72h] "This invitation has expired" error page → CEO must regenerate via `POST /elicitation/sessions/:id/generate-handoff-link`.

**Postconditions:**
- `stage4_tech_inputs_json` written; synthesis triggered.
- `tech_team_profiles.linked_project_id` confirmed.
- CEO notified; if synthesis passes gate → `projects.state = 'PUBLISHED'`.

---

### UC02 — Top Up Platform Wallet via VietQR

**Primary Actor:** CLIENT / CEO or EXPERT (any authenticated user)  
**API:** `POST /wallets/virtual-accounts/topup` → `POST /webhooks/sepay/ipn` (SePay callback)  
**Tables written:** `wallets.available_balance`, `wallet_transactions`

**Preconditions:**
1. Actor is authenticated; `wallets` row exists (created on registration).
2. Permanent `virtual_accounts {entity_type:'WALLET_TOPUP'}` row exists.

**Main Success Scenario:**
1. Actor opens "Top Up Wallet". `POST /wallets/virtual-accounts/topup` → system reads permanent VA number; generates VietQR (any transfer amount — no fixed_amount constraint on WALLET_TOPUP VAs).
2. Actor scans QR; transfers any amount via banking app.
3. SePay IPN fires: `POST /webhooks/sepay/ipn` (HMAC-verified with `SEPAY_SECRET_KEY`).
4. NestJS IPN handler: resolves `va_number → entity_type='WALLET_TOPUP'`; runs idempotency check.
5. Atomic DB transaction: `wallets.available_balance += amount`; `wallet_transactions {transaction_type:'TOP_UP', reference_id:transfer_reference}`.
6. HTTP 200 returned to SePay synchronously. Actor notified: "Wallet topped up: +{amount} VND."

**Extensions:**
- [Duplicate IPN — same `reference_id` already in `wallet_transactions`] Idempotency index fires → 200 returned, no double-credit.

**Postconditions:**
- `wallets.available_balance` increased. `wallet_transactions` ledger entry written (immutable).

---

### UC03 — Purchase Subscription from Wallet Balance

**Primary Actor:** CLIENT / CEO (Client Pro) or EXPERT (Expert Pro)  
**APIs:** `GET /config/subscription-packages?role=CLIENT|EXPERT` → `POST /subscriptions/activate`, `GET /subscriptions/status`, `GET /subscriptions/history`  
**Tables read:** `subscription_packages` (live pricing — NOT hardcoded in FE)  
**Tables written:** `wallets`, `wallet_transactions`, `users.subscription_[client|expert]_tier`, `users.sub_[client|expert]_expires_at`, `subscription_purchase_logs`, `users.refresh_token_hash` (token refreshed)

**Critical change:** `packageId` is now **required** in the activation request. FE must fetch the package ID from `GET /config/subscription-packages` before activation. Hardcoded prices (500K/300K VND) are no longer valid — price comes from `subscription_packages` table.

**Preconditions:**
1. `users.subscription_[client|expert]_tier = 'free'` OR expired.
2. `wallets.available_balance >= package.price_vnd` (fetched from `subscription_packages`).

**Main Success Scenario:**
1. Actor opens Subscription panel. `GET /config/subscription-packages?role=CLIENT` (or `EXPERT`) — returns `[{ id, name, priceVnd:"500000", durationMonths:6 }]`. **Store `id` as `packageId`.**
2. Actor confirms activation. `POST /subscriptions/activate { activeRole, packageId }` — `packageId` is mandatory.
3. Guard 1: role mismatch between package and `activeRole` → 422.
4. Guard 2: package `isActive = false` → 422 "Package no longer available."
5. Guard 3: `subscription_[role]_tier = 'pro'` AND not expired → 409 "Your subscription is still active."
6. Guard 4: `wallets.available_balance < package.price_vnd` → 422 "INSUFFICIENT_BALANCE" → redirect to UC02.
7. DB transaction (atomic): `wallets.available_balance -= package.price_vnd`; `wallet_transactions {SUBSCRIPTION, amount:package.price_vnd, reference:'SUB-{userId}:{role}:{packageId}:{ts}'}`;  `users.subscription_[role]_tier = 'pro'`; `users.sub_[role]_expires_at = now() + package.duration_months`; `subscription_purchase_logs` row written.
8. Response: `{ access_token, activatedPackage:{ name, priceVnd, durationMonths } }`. Refresh JWT.
9. Status check: `GET /subscriptions/status` → `{ subscriptionTier, subscriptionExpires, isExpired }`. **Trust `subscriptionTier` directly — no FE date math.** System auto-corrects expired tiers at query time.
10. Purchase history: `GET /subscriptions/history` → `[{ packageName, amountPaidVnd, purchasedAt, expiresAt, isExpired }]`.

**Extensions:**
- [Balance insufficient] 422 with redirect to UC02.
- [Admin creates new package tier] FE automatically shows it via `GET /config/subscription-packages` — no FE deployment needed.

**Includes:**
- `<<include>> UC02` — conditional redirect if balance insufficient.

**Postconditions:**
- `users.subscription_[role]_tier = 'pro'`; `sub_[role]_expires_at` set.
- `subscription_purchase_logs` row written (audit trail).
- Gated features unlocked.

> **Schema note:** `subscription_packages` table stores live pricing. `subscription_purchase_logs` table stores per-purchase history (previously only `wallet_transactions` was the audit trail). Admin can add/deactivate packages without code deployment.

---

### UC04 — View Published Project + Expert Shortlist

**Primary Actor:** CLIENT / CEO (primary); CLIENT / TECH_TEAM (read)  
**APIs:** `GET /projects/:id`, `GET /matching/:projectId/shortlist`, `GET /expert-profile/:userId`  
**Tables read:** `projects`, `project_shortlist_cache`, `expert_domain_depths`, `expert_seam_claims`, `reviews`

**Preconditions:**
1. `projects.state = 'PUBLISHED'`.
2. `project_shortlist_cache` row exists (created by matching engine on publish).

**Main Success Scenario:**
1. Actor opens Project Dashboard. `GET /projects/:id` returns full project detail including **NEW fields:**
   - `required_domains_json` — required domain expertise
   - `required_seams_json` — required seam competencies
   - `milestone_framework_json` — AI milestone blueprint (advisory, with `estimated_cost_vnd` + `estimated_duration_days` per milestone)
   - `estimatedTotalCostVnd` — AI total cost estimate
   - `estimatedTotalDurationDays` — AI total timeline estimate
2. Actor views expert shortlist: `GET /matching/:projectId/shortlist` → 3–5 match cards. Each card: match strength (Strong/Qualified/Conditional), domain depth coverage, seam gap map (green=EVIDENCE_BACKED load_bearing, amber=EVIDENCE_BACKED contributing, yellow=CLAIMED, red=absent).
3. Actor navigates to expert's full profile: `GET /expert-profile/:userId`.
4. Numeric composite scores internal; actor sees only three-tier strength label.

**Extensions:**
- [Load-bearing seam gap is red] Advisory note in Artifact A; shortlist strength label reduced to Conditional.

**Postconditions:** No state change — read-only.

---

### UC05 — Respond to Pre-Bid Technical Questions (CEO Side)

**Primary Actor:** CLIENT / CEO  
**APIs:** `GET /projects/:id/messages`, `GET /projects/:id/messages/unread-count`, `POST /messages/:id/read`, WebSocket `sendMessage`  
**Tables read/written:** `messages`, `message_reads`

**Preconditions:** `projects.state = 'PUBLISHED'`; expert has posted a question in the project messages channel.

**Main Success Scenario:**
1. CEO receives real-time notification (WebSocket `notification:generic` → persisted to `notifications` table). Unread badge via `GET /projects/:id/messages/unread-count`.
2. CEO opens project messages channel: `GET /projects/:id/messages`.
3. CEO types response; sends via WebSocket `sendMessage`. `messages` row written.
4. Mark messages read: `POST /messages/:id/read` → `message_reads` row written.
5. Expert and TECH_TEAM receive response in real time.

**Postconditions:** `messages` row written; `message_reads` updated.

---

### UC06 — Review Bid; Set ceo_status (CEO Side)

**Primary Actor:** CLIENT / CEO  
**APIs:** `GET /bids?projectId=:id`, `GET /bids/:id`, `PUT /bids/:id/ceo-decision`  
**Tables written:** `capability_bids.ceo_status`, `capability_bids.state`

**Preconditions:**
1. `capability_bids.tech_status = 'APPROVED'` (TECH_TEAM review complete).
2. `active_role = CLIENT`, `client_subtype = CEO`.

**Main Success Scenario:**
1. CEO notified: "Technical review complete — your review is unlocked."
2. CEO views all bids: `GET /bids?projectId=:id` — role-scoped, shows bids with tech_status badge. Only APPROVED bids show as active; PENDING bids grayed out; REVISION_REQUESTED as "Under revision".
3. CEO reviews bid detail: `GET /bids/:id` → `footprint_alignment_json`, `approach_summary`, `conditional_pricing_json`, TECH_TEAM's `tech_feedback` notes, `negotiated_price_vnd` if set.
4. [Approve] `PUT /bids/:id/ceo-decision { decision:'APPROVED' }`. `ceo_status='APPROVED'`; `capability_bids.state='SELECTED'`; all other bids for this project auto-declined. Expert notified.
5. [Decline] `PUT /bids/:id/ceo-decision { decision:'DECLINED' }`. Expert notified. CEO can still review other bids.

**Extensions:**
- `UC06n` — CEO optionally writes counter-offer before deciding.

**Postconditions (approve):**
- `capability_bids.state = 'SELECTED'`; all others DECLINED.
- Connection flow triggered → UC07.

---

### UC06n — Write Counter-Offer (Optional — One Round)

**Primary Actor:** CLIENT / CEO  
**API:** `PUT /bids/:id/counter-offer { negotiated_price_vnd }`  
**Extends:** UC06 before `ceo_status` is set.  
**Tables written:** `capability_bids.negotiated_price_vnd`

**Preconditions:** `capability_bids.ceo_status = 'PENDING'`; `negotiated_price_vnd IS NULL` (first write only — immutable after set).

**Main Success Scenario:**
1. CEO opens price negotiation panel; inputs `negotiated_price_vnd`.
2. `PUT /bids/:id/counter-offer`. Expert notified of counter-offer amount.
3. Expert views counter in bid panel; no formal accept/decline button — can discuss via messages, then CEO decides to approve or decline.

**Postconditions:** `negotiated_price_vnd` set (immutable). UC06 continues normally.

---

### UC07 — Initiate Connection: CEO NDA Click-Through

**Primary Actor:** CLIENT / CEO  
**API:** `PUT /engagements/:id/accept-nda`  
**Tables written:** `engagements.client_nda_accepted_at`

**Preconditions:**
1. `capability_bids.state = 'SELECTED'` (CEO approved bid via UC06).
2. `engagements.state = 'PENDING'`.
3. `active_role = CLIENT`, `client_subtype = CEO`.

**Main Success Scenario:**
1. System auto-routes CEO to NDA step after bid approval. CEO reads NDA click-through; checks acknowledgment box. `PUT /engagements/:id/accept-nda`. `engagements.client_nda_accepted_at = now()`.
2. [Expert also signed] `engagements.state → 'CONNECTED'`; `connected_at = now()`. Artifact B unlocked for Expert + TECH_TEAM.
3. [Expert not yet signed] `state` stays `PENDING`; CEO sees "Awaiting expert acceptance."
4. [Expert declines] CEO notified → selects another expert from remaining shortlisted bids if available.

**Postconditions (both signed):**
- `engagements.state = 'CONNECTED'`; both NDA timestamps set.
- Artifact B route guard satisfied: `GET /projects/:id/artifact-b` now returns for EXPERT + TECH_TEAM.

---

### UC07a — Invite Expert Directly (Before Bid)

**Primary Actor:** CLIENT / CEO  
**API (WebSocket):** `inviteExpert { projectId, expertId, content? }`  
**Tables written:** `invitations`, `messages`, `notifications`

**Preconditions:**
1. `projects.state = 'PUBLISHED'`; CEO owns the project.
2. Expert is in shortlist or found via `GET /expert-profile/search`.

**Main Success Scenario:**
1. CEO clicks "Invite Expert" on a shortlist card or expert profile. WebSocket `inviteExpert` event emitted.
2. System validates CEO owns project. Calls `invitationsService.upsertInvitation { projectId, expertId, ceoId, message, expiresAt:now()+7days }` — uses upsert, so re-inviting a declined expert resets to PENDING.
3. Real-time: `notification:generic { type:'system', title:'Project Invitation', link:'/expert/invitations' }` emitted to expert's socket room. Notification **also persisted** to `notifications` table.
4. Chat message created in project messages thread.

**CEO managing invitations:**
- View all invitations for project: `GET /projects/:id/invitations`
- View all invitations sent (all projects): `GET /invitations/sent`
- Retract invitation (before ACCEPTED): `DELETE /invitations/:id` → `invitations.status = 'DECLINED'`, `respondedAt = now()`. Blocked if `status = 'ACCEPTED'` (expert already bid).

**Postconditions:**
- `invitations` row created (`status='PENDING'`, `expiresAt=now()+7days`).
- Expert receives real-time notification + persistent DB record.

---

### UC08 — Fund Milestone via Per-Milestone VA QR

**Primary Actor:** CLIENT / CEO  
**API:** `PUT /milestones/:id/fund` → `POST /webhooks/sepay/ipn` (SePay callback)  
**Tables written:** `milestones`, `virtual_accounts`, `escrow_accounts`, `wallet_transactions`, `wallets`, `paygated_documents`

**Preconditions:**
1. `engagements.state = 'CONNECTED'` or `'ACTIVE'`.
2. `milestones.state = 'DEFINED'` (criteria and DoD defined).
3. `active_role = CLIENT`, `client_subtype = CEO`.

**Main Success Scenario:**
1. CEO clicks "Fund Milestone". `PUT /milestones/:id/fund` → NestJS creates `virtual_accounts {entity_type:'MILESTONE', fixed_amount:payment_amount_vnd, expires_at:now()+24h}`. Returns VietQR with fixed amount.
2. CEO scans QR; transfers exact amount (bank enforces via fixed_amount constraint).
3. SePay IPN fires: `POST /webhooks/sepay/ipn` (HMAC-verified).
4. NestJS MILESTONE IPN branch: validates `amount == va.fixed_amount`; idempotency check.
5. Atomic DB transaction: `wallets.available_balance -= amount` (client); `wallets.locked_balance += amount` (client); `wallet_transactions {ESCROW_LOCK}`; `escrow_accounts {milestone_id, HELD, held_at:now()}`; `milestones.state → 'FUNDED' → 'IN_PROGRESS'`; `milestones.funded_at = now()`.
6. `UPDATE paygated_documents SET release_state='RELEASED' WHERE milestone_id=? AND release_state='STAGED'`. TECH_TEAM document inbox updated.
7. [First milestone funded for engagement] `engagements.state → 'ACTIVE'`.
8. Expert notified: "Milestone N funded — begin work." TECH_TEAM notified: "Pay-gated docs released."

**Extensions:**
- [VA expired — 24h elapsed] `virtual_accounts.status = 'EXPIRED'`; CEO re-clicks "Fund" → new VA generated.

**Postconditions:**
- `milestones.state = 'IN_PROGRESS'`; `escrow_accounts.status = 'HELD'`.
- Staged pay-gated documents released to TECH_TEAM inbox.

---

### UC09 — Approve Milestone; Trigger Escrow Release + Chi Hộ

**Primary Actor:** CLIENT / CEO (for `sign_off_authority = 'CEO'` or `'JOINT'`)  
**APIs:** `GET /milestones/:id`, `GET /milestones/:id/submissions`, `GET /milestones/:id/submissions/latest`, `GET /criteria/:milestoneId`, `GET /milestones/:id/dod`, `PUT /criteria/:id/verify`, `PUT /criteria/:id/revision`  
**Tables written:** `acceptance_criteria.verified_at`, `acceptance_criteria.revision_note`, `milestones`, `escrow_accounts`, `wallet_transactions`, `wallets`, `withdrawal_requests`

**Preconditions:**
1. `milestones.state = 'SUBMITTED'`.
2. `sign_off_authority = 'CEO'` OR `'JOINT'` (if JOINT: TECH_TEAM criteria already verified).
3. `active_role = CLIENT`, `client_subtype = CEO`.

**Main Success Scenario:**
1. CEO notified: "Expert has submitted Milestone N for your review."
2. CEO views milestone: `GET /milestones/:id`; reads submission history: `GET /milestones/:id/submissions`; latest: `GET /milestones/:id/submissions/latest`; criteria list: `GET /criteria/:milestoneId`.
3. CEO verifies criteria one by one: `PUT /criteria/:id/verify` → `acceptance_criteria.verified_at = now()`.
4. [Criterion not met] `PUT /criteria/:id/revision { revision_note }`. `milestones.state → 'IN_REVISION'`; expert notified with revision note text.
5. [All required criteria verified — APPROVED guard] `SELECT COUNT(*) FROM acceptance_criteria WHERE milestone_id=? AND is_required=true AND verified_at IS NULL` → if 0: APPROVED fires.
6. Atomic DB transaction: `wallets.locked_balance -= amount` (client); `wallets.available_balance += amount * (1 - fee_pct)` (expert); `wallets.available_balance += amount * fee_pct` (platform wallet via `platform_settings.platform_fee_pct`); three `wallet_transactions` rows (ESCROW_RELEASE, PLATFORM_FEE, expert credit); `escrow_accounts.status → 'RELEASED'`; `milestones.state → 'APPROVED'`; `milestones.approved_at = now()`.
7. After commit (async): chi hộ API called → `withdrawal_requests {type:'MILESTONE_RELEASE', PENDING}`; SePay credit IPN → `milestones.state → 'RELEASED'`; `milestones.released_at = now()`.
8. [All milestones RELEASED] `engagements.state → 'CLOSED'` → UC11 (review) unlocked.

**Extensions:**
- `UC-G4` [EXTEND — dispute instead of approving]: CEO files dispute from SUBMITTED state.

**Postconditions:**
- `milestones.state = 'RELEASED'` (after chi hộ IPN).
- Expert's `wallets.available_balance` credited net of platform fee.
- Zero admin involvement for normal path.

---

### UC09a — Edit Milestone Details (Pre-Funding Only)

**Primary Actor:** CLIENT / CEO  
**API:** `PATCH /milestones/:id`  
**Tables written:** `milestones`

**Preconditions:**
1. `milestones.state = 'DEFINED'` (only — not FUNDED or later).
2. `active_role = CLIENT`, `client_subtype = CEO`; actor owns engagement.

**Main Success Scenario:**
1. CEO edits one or more fields: `title`, `deliverable_statement`, `sign_off_authority`, `payment_amount_vnd`, `estimated_duration_days`, `tech_stack`.
2. `PATCH /milestones/:id { ...partial fields... }` — all fields optional.
3. `milestones.updated_at = now()`.

**Extensions:**
- [State not DEFINED] 422 "Cannot edit a milestone in state '{state}'.".

**Postconditions:** Milestone updated in-place. `updated_at` refreshed.

---

### UC09b — Delete Milestone (Pre-Funding Only)

**Primary Actor:** CLIENT / CEO  
**API:** `DELETE /milestones/:id`  
**Tables written:** `milestones` (row deleted)

**Preconditions:**
1. `milestones.state = 'DEFINED'`.
2. CEO owns engagement.

**Main Success Scenario:**
1. `DELETE /milestones/:id`. Milestone permanently deleted.

**Extensions:**
- [State not DEFINED] 422.

**Postconditions:** Milestone row deleted. Engagement must reconstruct milestones from `milestone_framework_json` blueprint if needed.

---

### UC09c — Manage Acceptance Criteria

**Primary Actor:** CLIENT / CEO  
**APIs:** `GET /criteria/:milestoneId`, `POST /criteria/:milestoneId`, `DELETE /criteria/:id`  
**Tables written:** `acceptance_criteria`

**Main Success Scenario:**
1. List: `GET /criteria/:milestoneId` → ordered criteria for a milestone.
2. Add: `POST /criteria/:milestoneId { criterion_text, is_required:true }` → new criterion in PENDING state.
3. Delete: `DELETE /criteria/:id` → permanent removal.

**Note:** Best practice — define all criteria while milestone is in DEFINED state. Adding criteria after FUNDED does not automatically trigger re-evaluation.

---

### UC10 — Purchase Expert Service (SERVICE_PURCHASE or TECH_DISCOVERY)

**Primary Actor:** CLIENT / CEO  
**APIs:** `GET /services`, `GET /services/:id`, `POST /services/:id/purchase`, `GET /services/me/purchases`  
**Subscription gate:** Free tier — no subscription required for Path B.  
**Tables written:** `engagements`, `virtual_accounts`, `milestones`, `escrow_accounts`, `wallet_transactions`

**Preconditions:**
1. `active_role = CLIENT`, `client_subtype = CEO`.
2. `services.state = 'PUBLISHED'`.

**Main Success Scenario:**
1. Actor browses: `GET /services?serviceType=AI_SERVICE&domains[]=A&seams[]=A↔C` — domain/seam filter values from `GET /config/domains` + `GET /config/seams` (NOT hardcoded).
2. Actor views service: `GET /services/:id`.
3. Actor purchases: `POST /services/:id/purchase`.
4. NestJS: `INSERT engagements { service_id, expert_id, type:service.service_type, state:'PENDING', project_id:NULL }`. Creates VA (24h expiry, fixed amount).
5. CEO pays QR → IPN fires → atomic: `escrow_accounts {engagement_id, HELD}`; `milestones {number:1, FUNDED}`; `engagements.state → 'ACTIVE'`. Expert notified.
6. View purchased services: `GET /services/me/purchases`.

**Includes:**
- `<<include>> Browse Marketplace (UC-G1)`.
- `<<include>> UC02` — conditional if wallet insufficient.

**Extensions:**
- [service_type = 'TECH_DISCOVERY'] After engagement closes, CEO may resume elicitation at Stage 4 (UC01a Option B).

**Postconditions:**
- `engagements.state = 'ACTIVE'`; `type` = service type; first milestone FUNDED.

---

### UC11 — Submit Post-Engagement Review (CEO Form)

**Primary Actor:** CLIENT / CEO  
**APIs:** `POST /reviews`, `GET /reviews/me`, `GET /reviews/me/received`, `GET /reviews/users/:userId`  
**Tables written:** `reviews`

**Preconditions:**
1. `engagements.state = 'CLOSED'`.
2. No `reviews` row for this engagement with `reviewer_id = ceo_id`.

**Main Success Scenario:**
1. CEO opens review form: overall rating (1-5), communication clarity, milestone structure effectiveness, open text.
2. `POST /reviews { engagementId, targetId:expertId, rating, comment, reviewerRole:'CEO' }`.
3. `UNIQUE(engagement_id, reviewer_id)` enforced — one review per engagement per reviewer.
4. View reviews I've written: `GET /reviews/me`. View reviews I've received: `GET /reviews/me/received`. View any user's reviews: `GET /reviews/users/:userId`.

**Postconditions:** `reviews` row written. Expert reputation updated.

---

### UC-CHAT01 — Milestone Chat Assistant

**Primary Actor:** CLIENT / CEO or EXPERT  
**APIs:** `POST /projects/:id/milestone-chat`, `GET /projects/:id/milestone-chat/sessions`, `GET /projects/:id/milestone-chat/sessions/:sessionId`  
**Tables written:** `milestone_chat_sessions`

**Preconditions:**
1. `projects.state = 'PUBLISHED'`.
2. Actor is CEO or linked TECH_TEAM for this project.

**Main Success Scenario:**
1. Actor opens Milestone Chat panel. **First message (new conversation):** `POST /projects/:id/milestone-chat { message }` — no `chatSessionId` → new `milestone_chat_sessions` row created; title auto-generated ("Chat · DD/MM/YYYY").
2. System: project's `artifact_a_json` + `milestone_framework_json` + `budget_context` injected into Jinja2 system prompt (fetched from `prompt_templates`). Full conversation history passed to FastAPI; response generated.
3. Response: `{ reply, suggestedEdit, chatSessionId, sessionTitle, messageCount }`.
4. **`suggestedEdit` field (when AI suggests an edit):**
   ```json
   { "milestone_number":2, "field":"paymentAmountVnd", "suggested_value":30000000, "reason":"..." }
   ```
   FE shows "Apply" button → `PATCH /milestones/:id` with suggested value.
5. **Follow-up messages:** `POST /projects/:id/milestone-chat { message, chatSessionId }` — system loads history from DB, appends new exchange, saves back. FE stores only `chatSessionId`.
6. **Session list (sidebar):** `GET /projects/:id/milestone-chat/sessions`.
7. **Restore thread (page refresh):** `GET /projects/:id/milestone-chat/sessions/:sessionId` → `messagesJson` array.

**Postconditions:**
- `milestone_chat_sessions.messages_json` updated with full conversation. Server owns history — FE stateless except for `chatSessionId`.

---

### UC-CEO-BROWSE — Browse and Search Experts

**Primary Actor:** CLIENT / CEO  
**APIs:** `GET /expert-profile/search`, `GET /expert-profile/:userId`, `GET /users/experts`, `GET /reviews/users/:userId`

**Main Success Scenario:**
1. **Taxonomy search:** `GET /expert-profile/search?domain=A&seam=A↔C&archetype=1&limit=20` → experts with matching domain depths + verified seam claims.
2. **Browse all:** `GET /users/experts?stackTag=FastAPI&limit=20` → expert users with public profile info.
3. **Expert detail:** `GET /expert-profile/:userId` → full public profile including domain depths, seam claims (with verification tiers), engagement model, archetype history.
4. **Reviews:** `GET /reviews/users/:userId` → all reviews received by this expert.

**Postconditions:** No state change — read-only discovery.

---

### UC-CEO-CANCEL — Cancel a Published Project

**Primary Actor:** CLIENT / CEO  
**API:** `PUT /projects/:id/cancel`  
**Tables written:** `projects.state`

**Preconditions:**
1. `projects.state = 'PUBLISHED'`.
2. No active engagements with funded milestones (state not in `CLOSED`, `CANCELLED`).

**Main Success Scenario:**
1. `PUT /projects/:id/cancel`. System checks active engagements.
2. [Guard passes] `projects.state = 'SUSPENDED'`.

**Extensions:**
- [Active engagements] 422 "Cannot cancel project with N active engagement(s). Close them first."
- [Admin can reopen suspended project] `PUT /admin/projects/:id/reopen`.

---

---

## Part B — CLIENT / TECH_TEAM Flows

---

### UC04t — View Artifact B (TECH_TEAM)

**Primary Actor:** CLIENT / TECH_TEAM  
**API:** `GET /projects/:id/artifact-b`  
**Tables read:** `projects.artifact_b_json`, `engagements`

**Preconditions:**
1. `engagements.state ≥ 'CONNECTED'`; both NDA timestamps set.
2. `active_role = CLIENT`, `client_subtype = TECH_TEAM`.
3. Route guard: CEO role receives HTTP 403 regardless of engagement state.

**Main Success Scenario:**
1. TECH_TEAM opens "Project Blueprint" panel.
2. FastAPI Artifact B guard verifies: engagement state ≥ CONNECTED, both NDAs set, requester role is TECH_TEAM.
3. Returns `projects.artifact_b_json`: TECH_TEAM's own Stage 4 inputs (schemas, payload samples, integration contracts, stack specs).

**Postconditions:** Read-only.

---

### UC05t — Answer Pre-Bid Technical Questions (TECH_TEAM Side)

**Primary Actor:** CLIENT / TECH_TEAM  
**APIs:** `GET /projects/:id/messages`, `GET /projects/:id/messages/unread-count`, WebSocket `sendMessage`, `POST /messages/:id/read`

**Preconditions:** Expert has posted pre-bid question; TECH_TEAM notified via `notifications` table + WebSocket.

**Main Success Scenario:**
1. TECH_TEAM reads notification: `GET /notifications/me`. Opens project messages: `GET /projects/:id/messages`. Unread badge: `GET /projects/:id/messages/unread-count`.
2. Types technical answer; sends via WebSocket. `messages` row written.
3. Expert and CEO receive response in real time.

---

### UC06a — Review Bid: Set tech_status (TECH_TEAM Side)

**Primary Actor:** CLIENT / TECH_TEAM  
**APIs:** `GET /bids?projectId=:id`, `GET /bids/:id`, `PUT /bids/:id/tech-review`  
**Tables written:** `capability_bids.tech_status`, `capability_bids.tech_feedback`

**Preconditions:**
1. `capability_bids.state = 'SUBMITTED'`; `tech_status = 'PENDING'`.
2. TECH_TEAM notified via `notifications` + WebSocket.

**Bug fix:** TECH_TEAM now receives `notification:generic` when ANY expert submits a bid — previously only CEO was notified. Notification `link` → `/tech-team/projects/:id`.

**Main Success Scenario:**
1. TECH_TEAM opens bid review panel. `GET /bids/:id` → `footprint_alignment_json` (domains + seams in `↔` arrow format), `approach_summary`, `conditional_pricing_json`, `version_number`.
2. [Approved] `PUT /bids/:id/tech-review { decision:'APPROVED' }`. `tech_status → 'APPROVED'`; CEO review unlocked; CEO notified.
3. [Revision needed] `PUT /bids/:id/tech-review { decision:'REVISION_REQUESTED', tech_feedback:'...' }`. Expert notified; routes to UC18r.

**Note on bid format:** Seam codes use `↔` arrow (e.g. `A↔C`) — NOT `A<->C`. Domain codes are any non-empty string validated against `domain_definitions` table in service layer.

**Postconditions:**
- `tech_status = 'APPROVED'` → CEO review unlocked.
- `tech_status = 'REVISION_REQUESTED'` → `tech_feedback` visible to expert.

---

### UC07t — Access Pay-Gated Reasoning Documents

**Primary Actor:** CLIENT / TECH_TEAM  
**API:** `GET /milestones/:id/paygated-docs`  
**Tables read:** `paygated_documents`

**Preconditions:**
1. `engagements.state ≥ 'CONNECTED'`.
2. `paygated_documents.release_state = 'RELEASED'` (triggered by SePay IPN when CEO funded milestone — UC08).
3. CEO role **excluded** at route level.

**Main Success Scenario:**
1. TECH_TEAM opens document inbox: `GET /milestones/:id/paygated-docs`.
2. Documents with `release_state = 'RELEASED'` are visible; STAGED documents show "Waiting for milestone funding."
3. Read-only access; documents contain expert's architecture design rationale.

**Postconditions:** Read-only. IP deadlock resolved: expert's full design rationale delivered only after money entered escrow.

---

### UC08t — Sign Off Technical Milestones (TECH_TEAM Side)

**Primary Actor:** CLIENT / TECH_TEAM  
**APIs:** `GET /milestones/:id/submissions/latest`, `GET /criteria/:milestoneId`, `PUT /criteria/:id/verify`, `PUT /criteria/:id/revision`, `GET /engagements/:id/milestones`, `GET /engagements/:id/submissions`  
**Tables written:** `acceptance_criteria.verified_at`, `acceptance_criteria.revision_note`, `milestones`

**Preconditions:**
1. `milestones.state = 'SUBMITTED'`.
2. `sign_off_authority = 'TECH_TEAM'` OR `'JOINT'`.

**Main Success Scenario:**
1. TECH_TEAM notified. Opens milestone: `GET /milestones/:id`. Submission detail: `GET /milestones/:id/submissions/latest`.
2. Verifies criteria: `PUT /criteria/:id/verify`.
3. [Criterion not met] `PUT /criteria/:id/revision { revision_note }`. `milestones.state → 'IN_REVISION'`; expert notified.
4. [JOINT] Both TECH_TEAM and CEO must verify respective criteria before APPROVED fires.
5. [All required criteria verified — TECH_TEAM authority] APPROVED guard fires → escrow release chain (same as UC09 Steps 6-7).

**Extensions:**
- `UC-G4` — dispute filed from SUBMITTED or IN_REVISION state.

---

### UC09t — Submit Structured Review (TECH_TEAM Form)

**Primary Actor:** CLIENT / TECH_TEAM  
**API:** `POST /reviews`  
**Tables written:** `reviews`

**Preconditions:** `engagements.state = 'CLOSED'`; no prior review for this engagement by this reviewer.

**Main Success Scenario:**
1. TECH_TEAM opens structured review form: overall rating, seam-specific performance questions (e.g. "Did expert proactively address ground truth baseline?"), open text.
2. `POST /reviews { engagementId, targetId:expertId, rating, comment, reviewerRole:'TECH_TEAM', structuredSignalsJson:{ ... } }`.

**Postconditions:** `reviews` row written with TECH_TEAM role marker and structured signals.

---

---

## Part C — EXPERT Flows

---

### UC12 — Register and Build Taxonomy Profile

**Primary Actor:** EXPERT  
**APIs:** `POST /auth/register`, `PUT /expert-profile/me`, `POST /expert-profile/domains`, `PUT /expert-profile/domains/sync`, `PUT /expert-profile/domains/:id`, `DELETE /expert-profile/domains/:id`, `GET /expert-profile/me/domains`, `POST /expert-profile/seams`, `PUT /expert-profile/seams/sync`, `GET /expert-profile/me/seams`  
**Tables written:** `users`, `expert_profiles`, `expert_domain_depths`, `expert_seam_claims`

**Preconditions:** None — registration open to all.

**Main Success Scenario:**
1. Actor registers via `POST /auth/register` — same flow as UC-AUTH01 with `roles:'EXPERT'`.
2. Actor builds profile: `PUT /expert-profile/me { engagementModel, archetypeHistoryJson, stackTagsJson }`. **Note:** `bio` is updated via `PUT /users/me`, not expert-profile endpoint.
3. **Domain depths — fetched from DB, NOT hardcoded:**
   - Fetch active domains: `GET /config/domains` → codes like `A`, `B`, `C` (or custom admin-added codes).
   - Add individual: `POST /expert-profile/domains { domainCode:"A", depthLevel:"DEEP" }` — depth: SURFACE | OPERATIONAL | DEEP.
   - Bulk sync: `PUT /expert-profile/domains/sync { domains:[...] }` — replaces entire domain set atomically.
   - Update: `PUT /expert-profile/domains/:id`.
   - Delete: `DELETE /expert-profile/domains/:id`.
   - View mine: `GET /expert-profile/me/domains`.
4. **Seam claims — fetched from DB, NOT hardcoded:**
   - Fetch active seams: `GET /config/seams` → codes in `↔` arrow format (e.g. `A↔C`).
   - **Critical:** Use `↔` arrow character — `A<->C` format is rejected by DTO validation.
   - Claim: `POST /expert-profile/seams { seamCode:"A↔C" }` → `expert_seam_claims {verification_tier:'CLAIMED'}`.
   - Bulk sync: `PUT /expert-profile/seams/sync { seams:["A↔C","A↔D"] }`.
   - View mine: `GET /expert-profile/me/seams`.

**Postconditions:**
- `expert_domain_depths` rows; `expert_seam_claims {verification_tier:'CLAIMED'}`.
- Expert discoverable in matching at Tier 1 weight (0.20).

---

### UC13 — Activate Expert Pro Subscription

**Primary Actor:** EXPERT  
**Same API flow as UC03 with `activeRole:'EXPERT'` and package with `role:'EXPERT'`.**

**Main difference from original doc:** `POST /subscriptions/activate` now requires `{ activeRole:'EXPERT', packageId }` — FE must fetch `packageId` from `GET /config/subscription-packages?role=EXPERT` first. Price is dynamic from `subscription_packages` table.

**Unlocks:** Tier 2 portfolio verification, Tier 2/3 project bidding, AI service generator, earnings analytics.

---

### UC14 — Submit Portfolio Evidence for Tier 2 Seam Upgrade

**Primary Actor:** EXPERT  
**Extends:** UC12 (after seam claims created)  
**APIs:** `POST /portfolio-submissions`, `GET /portfolio-submissions`, `GET /portfolio-submissions/:id`, `DELETE /portfolio-submissions/me/portfolio/:id`, `GET /portfolio-submissions/me/portfolio/:id`  
**Tables written:** `portfolio_submissions`, `expert_seam_claims.verification_tier`, `platform_decisions`

**Preconditions:**
1. `subscription_expert_tier = 'pro'`.
2. `expert_seam_claims.verification_tier = 'CLAIMED'` for target seam.
3. `expert_seam_claims.locked_until IS NULL OR locked_until <= now()`.

**Main Success Scenario:**
1. Actor selects seam for Tier 2 upgrade; opens portfolio evidence form.
2. `POST /portfolio-submissions { seamClaimId, projectDescription, decisionPoints }`. Validation: `projectDescription` min 50 chars, `decisionPoints` min 20 chars.
3. System calls FastAPI `portfolio_eval` with **live seam definitions from DB injected into prompt** (`seam_definitions` table, via `all_seam_definitions` field in request). `VALID_SEAM_CODES` no longer hardcoded Python set.
4. FastAPI returns `{ confidence_score, passed_boolean, gap_advisory }`.
5. `INSERT portfolio_submissions { status:'PENDING' → auto-evaluated }`.

**Decision tree:**
- `confidence_score ≥ 0.85` → `expert_seam_claims.verification_tier = 'EVIDENCE_BACKED'`; `platform_decisions {SEAM_TIER_UPGRADE}`. Gap map upgrades Yellow → Amber (or Green if load-bearing).
- `confidence_score < 0.85` → Rejection. `portfolio_submissions.status = 'REJECTED'`; `expert_seam_claims.submission_count++`; `platform_decisions {PORTFOLIO_EVAL, advisory_note}` (names missing signal types).
  - `submission_count < 5` → "Try again" available.
  - `submission_count = 5` → `expert_seam_claims.locked_until = now() + 30 days`; lockout countdown.

**Portfolio management:**
- List submissions: `GET /portfolio-submissions`.
- Get specific: `GET /portfolio-submissions/:id` or `GET /portfolio-submissions/me/portfolio/:id`.
- Delete entry: `DELETE /portfolio-submissions/me/portfolio/:id`.

**Postconditions (success):** `expert_seam_claims.verification_tier = 'EVIDENCE_BACKED'`. Composite score weight: 0.20 → 0.55.

---

### UC15 — Link Bank Account via SePay Bank Hub

**Primary Actor:** EXPERT  
**APIs:** `POST /bank-hub/initiate-link` → `POST /webhooks/sepay/bank-linked` (webhook)  
**Tables written:** `users.sepay_bank_account_xid`, `users.bank_account_holder_name`, `users.bank_linked_at`

**Main Success Scenario:**
1. `POST /bank-hub/initiate-link` → NestJS returns `hosted_link_url` from SePay.
2. Actor opens URL; completes bank selection + OTP in SePay's WebView (no password sharing).
3. SePay fires `POST /webhooks/sepay/bank-linked { bank_account_xid, bank_account_holder_name }`.
4. `UPDATE users SET sepay_bank_account_xid=?, bank_account_holder_name=?, bank_linked_at=now()`.

**Postconditions:** `sepay_bank_account_xid` set (bank-verified). UC23 (withdrawal) unlocked.

---

### UC16 — Create and Publish Service Listing

**Primary Actor:** EXPERT  
**APIs:** `POST /services`, `GET /services/me`, `PUT /services/:id`, `PUT /services/:id/publish`, `PUT /services/:id/unpublish`, `DELETE /services/:id`  
**Subscription gate:** Expert Pro required for AI generator route; manual listing free.  
**Tables written:** `services`

**Preconditions:** `active_role = EXPERT`; `expert_profiles` row exists.

**Main Success Scenario:**

**Route A — AI Generator (Expert Pro):**
1. `POST /services { serviceType:'AI_SERVICE', useAiGenerator:true, capabilities:[], targetUseCases:[] }`.
2. FastAPI `service_generate` called with **expert's claimed domains + seams injected as context** (fetched from `expert_domain_depths` + `expert_seam_claims`). Price guidance injected from `subscription_packages` table — NOT hardcoded VND ranges.
3. Response includes NEW fields: `suggested_domains[]`, `suggested_seams[]`, `pricing_rationale`.
4. `services {state:'DRAFT'}` created with AI-generated content.
5. Expert reviews/edits draft.

**Route B — Manual (Any tier):**
1. `POST /services { serviceType, title, description, scope, timeline, priceVnd, domainsJson:["A","B"], seamsJson:["A↔C"] }`.
2. Domain/seam codes are ANY string (DB-validated in service layer against `domain_definitions`/`seam_definitions` tables — NOT hardcoded enum).
3. `services {state:'DRAFT'}`.

**Publishing lifecycle:**
- View own listings (all states): `GET /services/me`.
- Publish DRAFT: `PUT /services/:id/publish` → `services.state = 'PUBLISHED'`.
- Unpublish to DRAFT: `PUT /services/:id/unpublish` → `services.state = 'DRAFT'`.
- Edit: `PUT /services/:id { title, description, ... }`.
- Delete (DRAFT only): `DELETE /services/:id` → 422 if not DRAFT "Can only delete DRAFT listings. Unpublish first."

**Postconditions (published):** `services.state = 'PUBLISHED'`. Discoverable in `GET /services` marketplace.

---

### UC-INV01 — View and Respond to Project Invitations

**Primary Actor:** EXPERT  
**APIs:** `GET /invitations`, `POST /invitations/:id/decline`, `GET /notifications/me`, `GET /notifications/me/unread-count`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`, `DELETE /notifications/:id`  
**Tables read/written:** `invitations`, `notifications`

**Entry point:** Expert receives `notification:generic { type:'system', link:'/expert/invitations' }` — now **persisted** to `notifications` table (survives page refresh).

**Main Success Scenario:**
1. Expert sees notification badge via `GET /notifications/me/unread-count`. Opens Invitations page.
2. `GET /invitations` → list with full project metadata including `required_domains_json`, `required_seams_json`:
   ```json
   {
     "id": "...", "status": "PENDING", "invitedAt": "...", "isExpired": false,
     "project": { "id", "projectName", "state", "archetype", "tier",
                  "requiredDomainsJson", "requiredSeamsJson" },
     "ceo": { "id", "fullName", "clientProfile": { "companyName" } }
   }
   ```
   - `isExpired` pre-computed server-side — no FE date math.
   - `ceo.clientProfile.companyName` — CEO's company name for display.

**Status badge logic:**
- `PENDING` + `!isExpired` → "Invited" → CTA: View Project | Submit Bid | Decline.
- `PENDING` + `isExpired` → "Expired" → no CTAs (7-day window passed).
- `ACCEPTED` → "Bid Sent" (invitation auto-accepted when expert submits bid in UC18).
- `DECLINED` → "Declined" → no CTAs.

3. **View project for context:** `GET /projects/:id` → `required_domains_json` + `required_seams_json` available directly.
4. **Decline invitation:** `POST /invitations/:id/decline` (no body). Show confirmation dialog first.
   - 403: not your invitation.
   - 422: `invitation.status ≠ 'PENDING'`.
   - Response: `{ id, status:'DECLINED', respondedAt }`.

**Notification management:**
- Mark read: `PUT /notifications/:id/read`.
- Mark all read: `PUT /notifications/read-all`.
- Delete: `DELETE /notifications/:id`.

**Postconditions:**
- If declined: `invitations.status = 'DECLINED'`, `respondedAt = now()`.
- If proceeding to bid: routes to UC18.

---

### UC17 — Browse Project Shortlist; Pre-Bid Questions

**Primary Actor:** EXPERT  
**APIs:** `GET /projects/:id`, `GET /projects/:id/messages`, WebSocket `sendMessage`  
**Subscription gate:** Expert Pro for Tier 2+ project bids.

**Main Success Scenario:**
1. Expert receives shortlist notification (persisted to `notifications` table). `GET /notifications/me` → REST fallback for page refresh.
2. Expert views project: `GET /projects/:id` — now includes `required_domains_json` and `required_seams_json` directly. No separate endpoint needed for BidForm requirements.
3. Expert views their personal seam gap map (computed from expert's claims vs project requirements).
4. [Optional] Pre-bid question: WebSocket `sendMessage` to `projects/:id/messages` channel. CEO + TECH_TEAM receive in real time.

**Extensions:**
- `<<extend>> UC18` — proceeds to bid after gathering information.
- Expert was invited → `GET /invitations` shows relevant invitation with project context.

---

### UC18 — Submit Capability Bid

**Primary Actor:** EXPERT  
**API:** `POST /bids`  
**Tables written:** `engagements`, `capability_bids`, `invitations` (auto-updated)  
**Subscription gate:** Expert Pro for Tier 2+ projects.

**Preconditions:**
1. `active_role = EXPERT`; `subscription_expert_tier = 'pro'` for Tier 2+ projects.
2. Expert in project's match shortlist OR was invited.
3. `projects.state = 'PUBLISHED'`.

**Main Success Scenario:**
1. Actor opens bid form. Footprint alignment pre-populated from `expert_seam_claims` + `expert_domain_depths`.
2. **Component 1 — Footprint Alignment** (`footprint_alignment_json`):
   ```json
   {
     "domains": [{ "code": "A", "depth": "DEEP" }],
     "seams":   [{ "code": "A↔C", "tier": "CLAIMED" }]
   }
   ```
   - `code` for domains: any string from `GET /config/domains` (NOT hardcoded A-F enum).
   - `code` for seams: any string with `↔` arrow from `GET /config/seams` — `A<->C` rejected by DTO.
   - `depth`: SURFACE | OPERATIONAL | DEEP (still enum — business logic constant).
   - `tier`: CLAIMED | EVIDENCE_BACKED (still enum — business logic constant).
3. **Component 2 — Approach Summary** (`approach_summary TEXT`): addresses SDLC milestone framework from `artifact_a_json`. Must not include proprietary design (Artifact B not yet accessible).
4. **Component 3 — Conditional Pricing** (`conditional_pricing_json`): per-milestone pricing. Free-text "TBD" rejected with 422.
5. `POST /bids { projectId, footprint_alignment_json, approach_summary, conditional_pricing_json }`. All 3 components required — 422 if any missing.
6. `INSERT engagements { project_id, expert_id, type:'PROJECT_BASED', state:'PENDING' }`. `INSERT capability_bids { engagement_id, ...components, state:'SUBMITTED', tech_status:'PENDING', ceo_status:'PENDING', version_number:1 }`.
7. **Automatic invitation update:** `UPDATE invitations SET status='ACCEPTED', respondedAt=now() WHERE projectId=? AND expertId=? AND status='PENDING'` (atomic with bid creation — expert has implicitly accepted).
8. Notifications fired: CEO `notification:generic` → persisted. ALL TECH_TEAM members linked to project `notification:generic` → persisted. (Bug fix A-3: previously only CEO was notified.)

**Extensions:**
- `UC18r` — bid revision after `tech_status = 'REVISION_REQUESTED'`.

**Postconditions:**
- `capability_bids {state:'SUBMITTED', tech_status:'PENDING', ceo_status:'PENDING', version_number:1}`.
- CEO + TECH_TEAM notified (both persist to `notifications` table).
- If expert was invited: `invitations.status → 'ACCEPTED'`.

---

### UC18r — Revise Bid After TECH_TEAM Feedback

**Primary Actor:** EXPERT  
**API:** `PUT /bids/:id`  
**Extends:** UC18 when `tech_status = 'REVISION_REQUESTED'`.  
**Tables written:** `capability_bids`

**Main Success Scenario:**
1. Expert notified: "TECH_TEAM has requested bid revision — {tech_feedback}."
2. Expert opens bid form. Reads `tech_feedback`; edits any/all three components.
3. `PUT /bids/:id { footprint_alignment_json?, approach_summary?, conditional_pricing_json? }`. `tech_status → 'PENDING'`; `version_number++`.
4. TECH_TEAM re-notified → UC06a loop.

**Extensions:**
- Expert may also withdraw bid entirely before it is accepted: `DELETE /bids/:id` (guard: `state = 'SUBMITTED'` only).

---

### UC-BID-WD — Withdraw a Submitted Bid

**Primary Actor:** EXPERT  
**API:** `DELETE /bids/:id`  
**Tables written:** `capability_bids.state`

**Preconditions:** `capability_bids.state = 'SUBMITTED'` (before TECH_TEAM approves or CEO selects).

**Main Success Scenario:** `DELETE /bids/:id` → `capability_bids.state = 'WITHDRAWN'`.

**Extensions:**
- [State not SUBMITTED] 422 "Cannot withdraw a bid in state '{state}'."

---

### UC19 — Accept Connection; Access Artifact B

**Primary Actor:** EXPERT  
**APIs:** `POST /engagements/:id/connect`, `PUT /engagements/:id/decline`, `GET /projects/:id/artifact-b`  
**Tables written:** `engagements.expert_nda_accepted_at`

**Main Success Scenario:**
1. Expert notified of connection request. Views `artifact_a_json` (Artifact B still locked).
2. Accepts: `POST /engagements/:id/connect` → NDA click-through. `engagements.expert_nda_accepted_at = now()`.
3. [CEO already signed] `engagements.state → 'CONNECTED'`; `connected_at = now()`. Artifact B unlocked.
4. [CEO not yet signed] State stays PENDING; advances when CEO signs.
5. Bank prompt: if `sepay_bank_account_xid IS NULL` → non-blocking prompt → UC15.
6. Expert reads `GET /projects/:id/artifact-b`: TECH_TEAM schemas, payload samples, integration contracts.

**Extensions:**
- [Expert declines] `PUT /engagements/:id/decline`. CEO notified → selects another expert.

**Postconditions:**
- `engagements.state = 'CONNECTED'` (when both signed).
- Artifact B accessible to Expert and TECH_TEAM.

---

### UC20 — Stage Pay-Gated Reasoning Documents

**Primary Actor:** EXPERT  
**APIs:** `POST /milestones/:id/paygated-docs`, `GET /milestones/:id/paygated-docs`  
**Tables written:** `paygated_documents`

**Preconditions:** `engagements.state ≥ 'CONNECTED'`.

**Main Success Scenario:**
1. Expert uploads reasoning document(s); tags to milestone. `POST /milestones/:id/paygated-docs { documentUrl, milestoneId }`.
2. `paygated_documents {release_state:'STAGED', staged_at:now()}`.
3. Auto-release: when CEO funds tagged milestone (UC08 Step 6) → IPN → `release_state → 'RELEASED'`; TECH_TEAM inbox updated. CEO permanently excluded.
4. Check status: `GET /milestones/:id/paygated-docs` → STAGED or RELEASED per document.

**Postconditions:** Documents STAGED initially; auto-released on milestone IPN.

---

### UC21 — Manage DoD Checklist for Funded Milestone

**Primary Actor:** EXPERT  
**APIs:** `GET /milestones/:id/dod`, `POST /milestones/:id/dod/items`, `PUT /milestones/:id/dod/:itemId`, `DELETE /milestones/:id/dod/:itemId`  
**Tables written:** `milestone_dod_items`

**Preconditions:** `milestones.state = 'IN_PROGRESS'`.

**Main Success Scenario:**
1. List current DoD: `GET /milestones/:id/dod`.
2. Add item: `POST /milestones/:id/dod/items { item_description, is_required, maps_to_criterion_id? }` → `{status:'PENDING'}`.
3. Update status: `PUT /milestones/:id/dod/:itemId { status:'COMPLETED', completion_note }`. DB CHECK: `NOT (is_required = TRUE AND status = 'NOT_APPLICABLE')`.
4. Delete item (PENDING only): `DELETE /milestones/:id/dod/:itemId` → 422 if not PENDING.
5. TECH_TEAM views DoD read-only (CEO excluded from DoD view).

**Postconditions:** `milestone_dod_items` rows reflect work progress.

---

### UC22 — Submit Milestone Deliverable (DoD Gate)

**Primary Actor:** EXPERT  
**API:** `POST /milestones/:id/submit`  
**Tables written:** `milestone_submissions`, `milestones.state`

**Preconditions:**
1. `milestones.state = 'IN_PROGRESS'`.
2. All `is_required = true` DoD items have `status = 'COMPLETED'`.

**Main Success Scenario:**
1. Expert completes all required DoD items.
2. `POST /milestones/:id/submit { description, files_json:[] }`.
3. DoD guard: `SELECT COUNT(*) FROM milestone_dod_items WHERE milestone_id=? AND is_required=true AND status != 'COMPLETED'` → if > 0: 422 `DOD_INCOMPLETE { missing_items:[] }`.
4. [Guard passes] `INSERT milestone_submissions { milestone_id, expert_id, description, files_json, submitted_at:now() }`. `milestones.state → 'SUBMITTED'`. Sign-off authority notified.

**Submission history:**
- All submissions (revision loops): `GET /milestones/:id/submissions`.
- Latest submission: `GET /milestones/:id/submissions/latest`.
- All submissions for engagement: `GET /engagements/:id/submissions`.

**Extensions:**
- `UC-G4` — dispute filed from SUBMITTED or IN_REVISION state.

**Postconditions:**
- `milestones.state = 'SUBMITTED'`; sign-off authority notified.

---

### UC23 — Request Withdrawal (Chi Hộ)

**Primary Actor:** EXPERT  
**API:** `POST /withdrawals`, `GET /withdrawals`, `DELETE /withdrawals/:id`  
**Tables written:** `wallets`, `wallet_transactions`, `withdrawal_requests`

**Preconditions:**
1. `users.sepay_bank_account_xid IS NOT NULL` (UC15 completed).
2. `wallets.available_balance >= requested_amount`.

**Main Success Scenario:**
1. `POST /withdrawals { amount }`.
2. Guard 1: `sepay_bank_account_xid IS NULL` → 422 → redirect to UC15.
3. Guard 2: `available_balance < amount` → 422 `INSUFFICIENT_BALANCE`.
4. Atomic DB: `wallets.available_balance -= amount`; `wallet_transactions {WITHDRAWAL}`; `withdrawal_requests {PENDING}`.
5. After commit (async): chi hộ API → `withdrawal_requests.status → 'PROCESSING'`.
6. SePay credit IPN: `withdrawal_requests.status → 'COMPLETED'`; expert notified.
7. [Chi hộ error] Atomic compensation: `wallets.available_balance += amount`; `withdrawal_requests.status → 'FAILED'`; expert notified "Withdrawal failed. Balance restored."

**Cancel PENDING withdrawal (NEW):**
- `DELETE /withdrawals/:id` → guard: status = PENDING, expert owns it → `withdrawal_requests.status = 'CANCELLED'`; wallet refunded atomically.
- 422 if withdrawal not PENDING.

**View history:** `GET /withdrawals` → all withdrawal requests with status.

**Includes:**
- `<<include>> UC15` — prerequisite if `bank_account_xid IS NULL`.

**Postconditions (success):**
- Funds transferred to expert's bank. `withdrawal_requests.status = 'COMPLETED'`.

---

### UC24 — Submit Post-Engagement Review (Expert Form)

**Primary Actor:** EXPERT  
**API:** `POST /reviews`  
**Tables written:** `reviews`

**Preconditions:** `engagements.state = 'CLOSED'`; no prior review by this expert for this engagement.

**Main Success Scenario:**
1. Expert opens review form: overall rating, "Was Artifact B complete on first access?", CEO communication clarity, milestone approval timeliness, open text.
2. `POST /reviews { engagementId, targetId:clientId, rating, comment, reviewerRole:'EXPERT' }`.

**Postconditions:** `reviews` row written.

---

---

## Part D — Dual-Role Flows

---

### UC-DR1 — Add Second Role to Account

**Primary Actor:** CEO (adding Expert role) or Expert (adding CEO role)  
**API:** `POST /users/me/add-role`  
**Tables written:** `users.roles`, `expert_profiles` (if adding Expert), `client_profiles` (if adding CEO)

**Main Success Scenario:**
1. Actor opens "Account Settings → Add Role". `POST /users/me/add-role { newRole }`.
2. `users.roles → ["CLIENT_CEO","EXPERT"]`. Role switcher appears in nav. `PUT /auth/switch-role` to change active role.
3. Two subscription tiers coexist on same `users` row; both share same `wallets` row.
4. Self-exclusion rule: expert cannot bid on own projects regardless of `active_role`.

**Postconditions:** Both roles active. Self-exclusion enforced by matching engine.

---

### UC-DR2 — Switch Active Role

**Primary Actor:** Dual-role user  
**API:** `PUT /auth/switch-role { newRole }`  
**Tables written:** `users.active_role`  

**Main Success Scenario:**
1. Actor clicks role switcher in nav. `PUT /auth/switch-role { newRole }`.
2. New JWT issued with updated `activeRole` claim.
3. Dashboard and route guards adapt to new role.

---

---

## Part E — ADMIN Flows

---

### UC-A1 — Platform Integrity Monitor (Read-Only)

**Primary Actor:** ADMIN  
**APIs:** `GET /admin/decisions`, `GET /admin/disputes`, `GET /admin/projects`

**Main Success Scenario:**
1. **Spec Return Log:** `GET /admin/decisions?decisionType=SPEC_AUTO_RETURN` → project_id, failing void, advisory_note, timestamp. Pattern detection: repeated failures for one CEO → investigate → UC-A2.
2. **Portfolio Eval Log:** `GET /admin/decisions?decisionType=PORTFOLIO_EVAL` → expert_id, seam_code, llm_confidence, decision, advisory_note, submission_count. Monitor abuse patterns and lockout events.
3. **Dispute Log:** `GET /admin/disputes?state=MANUAL_REVIEW` → LLM confidence scores, findings, escrow amounts. Monitor auto-resolution rate.

---

### UC-A2 — View and Manage All Projects

**Primary Actor:** ADMIN  
**APIs:** `GET /admin/projects`, `GET /admin/projects/:id`, `PUT /admin/projects/:id/suspend-spec`, `PUT /admin/projects/:id/reopen`

**Main Success Scenario:**
1. Browse projects: `GET /admin/projects?state=PUBLISHED&archetype=3` — filterable.
2. Project detail: `GET /admin/projects/:id` → full project with client info, TECH_TEAM profiles, invitation count.
3. **Emergency Pull-Back:** `PUT /admin/projects/:id/suspend-spec` — guard: `state = 'PUBLISHED'` required.
   - `projects.state → 'SUSPENDED'`; `platform_decisions {SPEC_AUTO_RETURN, advisory_note:admin_reason}`.
   - Spec hidden from all expert views and matching engine. CEO notified.
   - Error: 422 if not PUBLISHED.
4. **Reopen Suspended Project:** `PUT /admin/projects/:id/reopen` — guard: `state = 'SUSPENDED'` required.
   - `projects.state → 'PUBLISHED'`.
   - Error: 422 if not SUSPENDED.

---

### UC-A3 — Account Management

**Primary Actor:** ADMIN  
**APIs:** `GET /admin/users`, `GET /admin/users/:id`, `PUT /admin/users/:id/suspend`, `PUT /admin/users/:id/reactivate`, `GET /admin/experts`

**Main Success Scenario:**
1. Browse users: `GET /admin/users?role=EXPERT&isActive=true&search=albert` — filter by role, status, name/email.
2. User detail: `GET /admin/users/:id` → full user data + wallet balances + client/expert profiles.
3. Suspend: `PUT /admin/users/:id/suspend` → `users.is_active = false`. Existing JWTs rejected on next request. Active escrow stays HELD (not auto-released on suspension).
4. Reactivate: `PUT /admin/users/:id/reactivate` → `users.is_active = true`. User can log in again.
5. Browse experts: `GET /admin/experts?limit=50` → all expert users with seam verification tiers and domain depths. Monitor Tier 2 upgrade rates and suspicious approval patterns.

---

### UC-A4 — Monitor and Manually Resolve Disputes

**Primary Actor:** ADMIN  
**APIs:** `GET /admin/disputes`, `GET /disputes/:id`, `GET /engagements/:id/messages`, `GET /engagements/:id/disputes`, `PUT /admin/disputes/:id/resolve`

**Preconditions:** `disputes.state = 'MANUAL_REVIEW'` (LLM confidence < 0.80).

**Main Success Scenario:**
1. Admin opens Dispute Monitor: `GET /admin/disputes?state=MANUAL_REVIEW`.
2. Dispute detail: `GET /disputes/:id`. Reads `criterion_text`, `milestone_submissions` evidence, `llm_confidence`, `finding`, **`reasoning`** (NEW — brief LLM explanation), `escrow_accounts.amount`.
3. Reads engagement thread for full context: `GET /engagements/:id/messages`.
4. **Additional evidence** may have been submitted by parties: `POST /disputes/:id/evidence` (by CEO or Expert during dispute).
5. Admin clicks resolution:
   - **"Release to Expert"** → `ESCROW_RELEASE + PLATFORM_FEE + CREDIT_EXPERT`; `escrow_accounts.status → 'RELEASED'`.
   - **"Refund to Client"** → `ESCROW_REFUND`; `wallets.available_balance += amount` (client); `status → 'REFUNDED'`.
   - **"Split 50/50"** → `ESCROW_SPLIT`; `wallets.available_balance += amount/2` (both parties net of fee); `status → 'SPLIT'`.
   - `PUT /admin/disputes/:id/resolve { decision:'RELEASE'|'REFUND'|'SPLIT' }`.
6. `disputes.state → 'RESOLVED'`; `milestones.state → 'APPROVED'` (lifecycle closed). Both parties notified.

**Dispute withdrawal (by filer, before resolution):**
- `PUT /disputes/:id/withdraw` — guard: filer only, status must be open. `disputes.state → 'WITHDRAWN'`; escrow unfrozen.

**Postconditions:**
- `disputes.state = 'RESOLVED'` (or WITHDRAWN). Escrow distributed; `platform_decisions` written. `milestones.state = 'APPROVED'`.

---

### UC-A5 — View Analytics Dashboard

**Primary Actor:** ADMIN  
**API:** `GET /admin/analytics`, `GET /admin/transactions`, `GET /admin/withdrawals`

**Main Success Scenario:**
1. `GET /admin/analytics` → aggregates: active projects by archetype/tier; elicitation completion + auto-publish pass rates; portfolio auto-upgrade and rejection rates; dispute auto-resolution rate; milestone completion rate; average review cycle time; review submission rate; average ratings.
2. `GET /admin/transactions` → full `wallet_transactions` ledger (all users, all types).
3. `GET /admin/withdrawals?status=PENDING` → pending withdrawal queue.
4. Process withdrawals: `PUT /admin/withdrawals/:id/complete` or `PUT /admin/withdrawals/:id/fail`.

---

### UC-A6 — Manage CMS Configuration (Domains/Seams/Archetypes/VoidCodes/ProbeQuestions)

**Primary Actor:** ADMIN  
**APIs:** `/admin/config/domains`, `/admin/config/seams`, `/admin/config/archetypes`, `/admin/config/probe-questions`, `/admin/config/void-codes`  
**Tables written:** `domain_definitions`, `seam_definitions`, `archetype_definitions`, `probe_questions`, `void_code_definitions`

**Critical context:** These tables replace ALL hardcoded values in the AI service and FE. Changes take effect immediately in FE (next API call) and within 60 seconds in FastAPI (prompt cache TTL).

**Domain Management:**
- `GET /admin/config/domains` — all (active + inactive).
- `POST /admin/config/domains { code, name, description, sortOrder }` — new domain available in `GET /config/domains` immediately.
- `PUT /admin/config/domains/:id { name, description, isActive, sortOrder }` — deactivate → disappears from FE dropdowns.
- `DELETE /admin/config/domains/:id` — soft-delete (`isActive=false`).

**Seam Management** (same CRUD pattern):
- `GET/POST/PUT/DELETE /admin/config/seams`.
- **Warning:** Changing a seam code requires updating all `expert_seam_claims` rows that reference it.
- Public: `GET /config/seams` → active only.

**Archetype Management** (same CRUD pattern):
- `GET/POST/PUT/DELETE /admin/config/archetypes`.

**Probe Question Management:**
- `GET /admin/config/probe-questions?archetypeCode=3` — filter by archetype.
- `POST /admin/config/probe-questions { archetypeCode, questionText, displayOrder }`.
- `PUT /admin/config/probe-questions/:id { questionText, displayOrder, isActive }`.
- `DELETE /admin/config/probe-questions/:id` — soft-delete.
- **Effect:** Removing a probe question means Stage 3 has fewer required answers (takes effect immediately for next elicitation).

**Void Code Management:**
- `GET/POST/PUT/DELETE /admin/config/void-codes`.
- Adding `{ code:'GDPR_COMPLIANCE_RISK', name, description, severity:'HIGH' }` → Stage 1 AI immediately detects this in next elicitation.
- Public: `GET /config/void-codes` → active codes used for CEO Stage 2 display.

**Postconditions:** Config tables updated. Public `GET /config/*` endpoints immediately reflect changes. FastAPI prompt templates pick up changes within 60 seconds.

---

### UC-A7 — Manage Prompt Templates (AI Hot-Reload)

**Primary Actor:** ADMIN  
**APIs:** `GET /admin/prompts`, `GET /admin/prompts/:stage`, `PUT /admin/prompts/:stage`, `DELETE /admin/prompts/:stage`  
**Tables written:** `prompt_templates`

**Critical context:** Changes take effect within 60 seconds (FastAPI `prompt_service.py` TTL cache). No service restart required.

**Main Success Scenario:**
1. **List:** `GET /admin/prompts` → `[{ id, stage, description, version, updatedAt }]`.
2. **View full template:** `GET /admin/prompts/:stage` → `{ templateText, version }`. Valid stages: `stage1_extract`, `stage3_vagueness_check`, `stage4_recommend`, `stage5_synthesize`, `milestone_chat`.
3. **Update:** `PUT /admin/prompts/:stage { templateText, description }` → creates or updates DB record. `version` incremented.
4. **Reset to default:** `DELETE /admin/prompts/:stage` → removes DB record; FastAPI falls back to `.txt` file on disk. `version` counter resets.

**Jinja2 template variables available:**
- `stage1_extract`: `{{ archetypes }}`, `{{ void_codes }}` — injected from DB at call time.
- `stage5_synthesize`: `{{ domains }}`, `{{ seams }}`, `{{ archetypes }}` — injected from DB at call time.

**Admin UI warnings:**
- Malformed Jinja2 syntax → FastAPI falls back to raw template text → LLM may produce incorrect output.
- Removing a required `{{ variable }}` → that context is missing from LLM prompt.
- `DELETE` resets to `.txt` file; future edits start fresh.

---

### UC-A8 — Manage Subscription Packages

**Primary Actor:** ADMIN  
**APIs:** `GET/POST/PUT/DELETE /admin/subscriptions/packages`  
**Tables written:** `subscription_packages`

**Main Success Scenario:**
1. **List ALL packages (active + inactive):** `GET /admin/subscriptions/packages`.
   - Note: public `GET /config/subscription-packages` shows only active packages.
2. **Create new package:** `POST /admin/subscriptions/packages { role, name, priceVnd, durationMonths }`. Immediately available to FE via `GET /config/subscription-packages`.
3. **Update:** `PUT /admin/subscriptions/packages/:id { priceVnd, durationMonths, name, isActive }`. Price change effective immediately for new activations; existing subscriptions keep purchased duration.
4. **Deactivate (soft):** `PUT /admin/subscriptions/packages/:id { isActive:false }`. Hides from `GET /config/subscription-packages`; existing subscribers unaffected.
5. **Hard delete:** `DELETE /admin/subscriptions/packages/:id`. Blocked if package has purchase history (`subscription_purchase_logs` references exist) → 422 "Cannot delete — N purchase record(s). Deactivate instead."

**Postconditions:** `subscription_packages` table updated. FE immediately sees changes via `GET /config/subscription-packages`.

---

---

## Part F — General / Cross-Actor Flows

---

### UC-G1 — Browse Expert Service Marketplace

**Primary Actor:** CLIENT / CEO (primary), CLIENT / TECH_TEAM (browse-only)  
**API:** `GET /services?serviceType=AI_SERVICE&domains[]=A&seams[]=A↔C&minPriceVnd=0&maxPriceVnd=50000000`  
**Subscription gate:** Free tier — no subscription required for browsing.

**Main Success Scenario:**
1. Actor fetches filter options: `GET /config/domains` + `GET /config/seams` — NOT hardcoded.
2. Fetches listings: `GET /services` with query params.
3. Each card: `title`, `domains_json`, `seams_json` (using `↔` arrow codes), `service_type`, `price_vnd` (as string), expert name, avg rating.
4. Detail view: `GET /services/:id`.

**Extensions:**
- `<<extend>> UC10` — CEO purchases from this view. TECH_TEAM browse-only (cannot purchase — CEO role guard on purchase route).

---

### UC-G2 — Real-Time Messaging Within Engagement and Project

**Primary Actor:** CEO, TECH_TEAM, EXPERT (one thread per engagement); ADMIN (read-only)  
**APIs:** `GET /engagements/:id/messages`, `GET /projects/:id/messages`, `GET /engagements/:id/messages/unread-count`, `GET /projects/:id/messages/unread-count`, `POST /messages/:id/read`, WebSocket `sendMessage`  
**Tables written:** `messages`, `message_reads`

**Two-channel architecture:**
1. **Project channel** (pre-bid, pre-connection): `project_id`-scoped messages. CEO + TECH_TEAM respond to expert pre-bid questions. Expert can read/write. All three parties share one thread.
2. **Engagement channel** (post-connection): `engagement_id`-scoped messages. All three parties (CEO, TECH_TEAM, Expert) plus Admin (read-only for dispute audit) share one thread.

**Main Success Scenario:**
1. Actor opens messages. `GET /engagements/:id/messages` or `GET /projects/:id/messages` → `ORDER BY timestamp ASC`.
2. Unread count: `GET /engagements/:id/messages/unread-count` or `GET /projects/:id/messages/unread-count` → badge in nav.
3. Send: WebSocket `sendMessage { content, engagementId OR projectId, attachmentUrl? }`. `INSERT messages` row.
4. Mark read: `POST /messages/:id/read` → `INSERT message_reads { message_id, user_id, read_at }` (UNIQUE enforced).
5. All participants in Socket.io room receive in real time.

**Conversation thread list (NEW):**
- `GET /conversations` → all active threads (engagement + project scoped) with last message + unread count per thread. Used for sidebar/inbox view.

---

### UC-G3 — View Financial Dashboard (Wallet, Transactions, Subscription)

**Primary Actor:** All authenticated roles  
**APIs:** `GET /wallets/me`, `GET /wallets/me/transactions?type=SUBSCRIPTION&limit=50&offset=0`, `GET /subscriptions/status`, `GET /subscriptions/history`, `GET /withdrawals`

**Role-specific panel content:**

**CEO panel:**
- Balances: `GET /wallets/me` → `{ availableBalance, lockedBalance }` (as strings — BigInt serialized).
- Transactions: `GET /wallets/me/transactions?type=ESCROW_LOCK&limit=50&offset=0` — paginated + filterable by type.
- Subscription: `GET /subscriptions/status` → `{ subscriptionTier, subscriptionExpires, isExpired }`. **Trust `subscriptionTier` directly.**
- Purchase history: `GET /subscriptions/history` → `[{ packageName, amountPaidVnd, purchasedAt, expiresAt, isExpired }]`.
- Actions: Top Up → UC02; Activate Subscription → UC03.

**TECH_TEAM panel:**
- Milestone status per linked project: `GET /projects/:id/milestones`.
- Released pay-gated docs: `GET /milestones/:id/paygated-docs`.
- No financial amounts shown.

**EXPERT panel:**
- Balances + per-milestone earnings.
- Transactions: `GET /wallets/me/transactions?type=ESCROW_RELEASE`.
- Withdrawal history: `GET /withdrawals`.
- Subscription: `GET /subscriptions/status`.
- Actions: Withdraw → UC23; Cancel pending withdrawal → `DELETE /withdrawals/:id`; Activate Expert Pro → UC13.

**ADMIN panel:**
- Full ledger: `GET /admin/transactions` (all users, all types, filterable).
- Escrow status: inferred from `escrow_accounts` via admin analytics.
- Withdrawal queue: `GET /admin/withdrawals`.

**Postconditions:** Read-only financial view.

---

### UC-G4 — File and Manage a Dispute

**Primary Actor:** CEO, TECH_TEAM, or Expert (any party to engagement)  
**Secondary Actor:** System (FastAPI LLM Layer 1); ADMIN (Layer 2 manual resolution)  
**APIs:** `POST /disputes`, `GET /disputes/:id`, `GET /disputes`, `POST /disputes/:id/evidence`, `PUT /disputes/:id/withdraw`, `PUT /admin/disputes/:id/resolve`  
**Extends:** UC09, UC08t, UC22 (from SUBMITTED or IN_REVISION milestone states)

**Preconditions:**
1. `milestones.state = 'SUBMITTED'` or `'IN_REVISION'`.
2. Actor is party to the engagement.

**Main Success Scenario:**
1. Actor clicks "File Dispute": `POST /disputes { engagementId, milestoneId, criterionId, deliverableDescription, files:[] }`.
2. NestJS atomic: `INSERT disputes { state:'PENDING', filed_by, filed_at:now() }`; `UPDATE escrow_accounts SET status='FROZEN'`; `UPDATE milestones SET state='DISPUTED'`.
3. **Layer 1 — LLM Evaluation:** FastAPI `dispute_eval` called with:
   - `criterion_text`, `deliverable_description`, `files`
   - NEW: `project_archetype`, `milestone_context` (for better calibration), `prior_revision_count`
   - Returns `{ confidence_score, finding:'expert_wins'|'client_wins', reasoning }` (NEW: `reasoning` field).
4. `UPDATE disputes SET llm_confidence = score`.
5. [confidence ≥ 0.80] AUTO_RESOLVED:
   - Expert wins → `ESCROW_RELEASE + PLATFORM_FEE + CREDIT_EXPERT`; `escrow_accounts.status → 'RELEASED'`.
   - Client wins → `ESCROW_REFUND`; `wallets.available_balance += amount` (client); `status → 'REFUNDED'`.
   - `disputes.state → 'AUTO_RESOLVED'`; `milestones.state → 'APPROVED'`.
   - `platform_decisions` written.
6. [confidence < 0.80] MANUAL_REVIEW: `disputes.state → 'MANUAL_REVIEW'`. Admin notified → UC-A4.

**Additional evidence submission (post-filing, before resolution):**
- `POST /disputes/:id/evidence { evidence_description, file_urls:[] }` — by either party while dispute is open.

**Dispute withdrawal (by filer, before resolution):**
- `PUT /disputes/:id/withdraw` — guard: filer only, must be open state. `disputes.state → 'WITHDRAWN'`; escrow unfrozen.

**View disputes:** `GET /disputes/:id` · `GET /disputes?state=MANUAL_REVIEW` · `GET /milestones/:id/disputes` · `GET /engagements/:id/disputes`.

**Postconditions:**
- Escrow resolved (RELEASED/REFUNDED/SPLIT) or withdrawn (UNFROZEN).
- `milestones.state = 'APPROVED'` (lifecycle closed regardless of outcome).
- `platform_decisions` written.

---

### UC-G5 — Notification Management

**Primary Actor:** All authenticated roles  
**APIs:** `GET /notifications/me`, `GET /notifications/me/unread-count`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`, `DELETE /notifications/:id`  
**Tables read/written:** `notifications`

**Architecture:** All `notification:generic` WebSocket events are **also persisted** to the `notifications` table by the gateway's `@OnEvent('socket.broadcast')` handler. Persistence is fail-open — DB write failure never blocks WebSocket delivery.

**Main Success Scenario:**
1. Real-time: WebSocket `notification:generic` arrives → FE shows toast popup. `link` field in payload → navigation target on click.
2. REST fallback (page refresh or mobile app): `GET /notifications/me?unreadOnly=true&limit=50` → `[{ id, type, title, body, link, isRead, createdAt }]`.
3. Unread badge: `GET /notifications/me/unread-count` → `{ unread_count:N }`.
4. Mark single read: `PUT /notifications/:id/read`.
5. Mark all read: `PUT /notifications/read-all` → `{ marked_read:N }`.
6. Delete: `DELETE /notifications/:id`.

**Postconditions:** `notifications.is_read` updated. Unread count decreases.

> **Key behavior:** Notifications survive page refresh — FE never needs to cache them locally. Notification history is the DB record.

---

### UC-G6 — Config Bootstrap (Single Call)

**Primary Actor:** FE application (on mount)  
**API:** `GET /config/all`  
**Tables read:** `domain_definitions`, `seam_definitions`, `archetype_definitions`, `void_code_definitions`, `subscription_packages`

**Purpose:** Single call returning all static configuration needed for FE rendering — replaces 5 separate round trips on page load.

**Response:**
```json
{
  "domains":              [{ "id","code","name","description","sortOrder" }],
  "seams":               [{ "id","code","name","description","sortOrder" }],
  "archetypes":          [{ "id","code","name","description","sortOrder" }],
  "voidCodes":           [{ "id","code","name","description","severity" }],
  "subscriptionPackages":[{ "id","role","name","priceVnd","durationMonths" }]
}
```

**Use on:** App mount. All filtered to `isActive = true`. Cache locally for the session; re-fetch when admin makes CMS changes.

---

### UC-G7 — Engagement Lifecycle Management

**Primary Actor:** CEO, EXPERT, ADMIN  
**APIs:** `GET /engagements`, `GET /engagements/:id`, `GET /engagements/:id/bid`, `GET /engagements/:id/milestones`, `GET /engagements/:id/submissions`, `GET /engagements/:id/disputes`, `PUT /engagements/:id/cancel`

**Engagement detail response now includes `project` metadata** — eliminates N+1 calls from FE:
```json
{
  "id": "...", "state": "ACTIVE", "type": "PROJECT_BASED",
  "project": { "id", "projectName", "state", "archetype", "tier", "createdAt" },
  "connectedAt": "...",
  ...
}
```

**Sub-resources:**
- Bid that created this engagement: `GET /engagements/:id/bid`.
- All milestones: `GET /engagements/:id/milestones`.
- All submissions: `GET /engagements/:id/submissions`.
- All disputes: `GET /engagements/:id/disputes`.

**Cancel engagement (mutual agreement):**
- `PUT /engagements/:id/cancel`.
- Guard: no funded milestones in FUNDED/SUBMITTED/IN_REVISION state → 422.

---

---

## Summary: `<<include>>` and `<<extend>>` Relationship Index

### `<<include>>` Relationships (Mandatory Sub-Behaviours)

| Base UC | `<<include>>` → | Rationale |
|---|---|---|
| UC01 | Verify Subscription Gate | Client Pro required before Stage 1 |
| UC01 | Run Critical Artifact Detection | Stage 1 LLM always detects required documents |
| UC01 | Run Dual Vagueness+Relevancy Check | Stage 3 LLM always checks both vagueness AND relevancy |
| UC01 | Run Automated Quality Gate | Stage 5 always runs after synthesis |
| UC03 | Fetch Package from DB | `GET /config/subscription-packages` required before activation — price NOT hardcoded |
| UC03 | `<<include>> UC02` | Redirect if wallet insufficient |
| UC10 | `<<include>> UC-G1` | Actor browses marketplace before purchasing |
| UC10 | `<<include>> UC02` | Redirect if wallet insufficient |
| UC13 | Fetch Package from DB | Same as UC03 |
| UC13 | `<<include>> UC02` | Redirect if wallet insufficient |
| UC23 | `<<include>> UC15` | Bank account must be linked before withdrawal |
| UC-G6 | (no dependencies) | Bootstrap call on app mount |

### `<<extend>>` Relationships (Conditional / Optional Branches)

| Extending UC | `<<extend>>` → Base UC | Extension Point / Condition |
|---|---|---|
| UC01a | UC01 | Stage 4 threshold crossed AND CEO confirms no TECH_TEAM |
| UC01b | UC01 | `self_technical = true` set during intake |
| UC01t | UC01 | TECH_TEAM drives Stage 4 on separate account |
| UC06n | UC06 | CEO optionally writes `negotiated_price_vnd` before deciding |
| UC09a | UC09 | CEO edits milestone while still DEFINED |
| UC09b | UC09 | CEO deletes milestone while still DEFINED |
| UC-BID-WD | UC18 | Expert withdraws bid before TECH_TEAM review |
| UC18r | UC18 | `tech_status = 'REVISION_REQUESTED'`; expert revises bid |
| UC-INV01 | UC17 | Expert was invited → invitation context added to shortlist view |
| UC18 | UC17 | Expert proceeds from shortlist to bid submission |
| UC10 | UC01a | TECH_DISCOVERY service purchase as alternative to Milestone 0 injection |
| UC-G4 | UC09 | Dispute filed from CEO review of SUBMITTED milestone |
| UC-G4 | UC08t | Dispute filed from TECH_TEAM review |
| UC-G4 | UC22 | Dispute filed from SUBMITTED or IN_REVISION state (Expert side) |
| UC-CHAT01 | UC04 | CEO/Expert uses AI chat to discuss/edit milestone framework |
| UC-A1 | UC-A2 | Emergency spec pull-back triggered from Integrity Monitor view |

---

## What's New vs the Previous MVP Spec (Change Summary)

| Category | Change |
|---|---|
| Auth | Added: logout (server-side token invalidation via `refresh_token_hash`), forgot/reset password (3-step with verify-token on page mount), change-password-while-authenticated, account deactivation |
| Subscriptions | `packageId` now required in `POST /subscriptions/activate`. Price fetched from `subscription_packages` table — NOT hardcoded. `subscription_purchase_logs` table written. `GET /subscriptions/history` endpoint added. |
| Elicitation Stage 1 | New: `stage1OriginalInput` diff display; `criticalArtifactsJson` detection; `estimatedBudgetVnd` extraction; LLM skip on unchanged input |
| Elicitation Stage 2 | Archetype list from `archetype_definitions` (DB), not hardcoded. Void descriptions from `void_code_definitions` (DB). |
| Elicitation Stage 3 | Probe questions from `probe_questions` (DB), not hardcoded. Dual check: vagueness + relevancy (separate `irrelevant_answers` array in response). |
| Elicitation Stage 4 | Auto-save draft endpoint (`PATCH .../stage4-draft`). `technical_artifacts` field for critical artifact submission. `additional_requirement_1` field. `missingArtifacts` in response (warning, not block). |
| Elicitation Stage 5 | `estimatedTotalCostVnd` + `estimatedTotalDurationDays` in response. Artifact grounding: milestone deliverables reference submitted artifact content. `completeness_score` capped at 0.60 if artifacts missing. |
| Tech Team Bug Fix | `tech_team_profiles.linked_project_id` set atomically on registration/claim if project already exists. "Waiting for CEO" bug resolved. |
| Bid Format | Domain + seam codes are now dynamic strings validated against DB — NOT hardcoded enums. Seam codes use `↔` arrows. `A<->C` format rejected by DTO. |
| Bid Notifications | Expert bid now notifies CEO + ALL TECH_TEAM members (previously CEO only). |
| Milestones | New: `PATCH /milestones/:id` (edit while DEFINED), `DELETE /milestones/:id` (delete while DEFINED). `title`, `estimatedDurationDays`, `techStackJson`, `estimatedCostVnd`, `isAiGenerated`, `updatedAt` fields added. |
| Milestone criteria | `GET /criteria/:milestoneId` (list), `POST /criteria/:milestoneId` (create), `DELETE /criteria/:id` — previously only verify/revision existed. |
| DoD | `GET /milestones/:id/dod` (list), `DELETE /milestones/:id/dod/:itemId` (delete PENDING items) — previously only create/update existed. |
| Submission history | `GET /milestones/:id/submissions`, `GET /milestones/:id/submissions/latest`, `GET /engagements/:id/submissions` — full revision loop history accessible. |
| Expert Invitations | NEW feature: `invitations` table. CEO invites via WebSocket `inviteExpert`. Expert sees `GET /invitations` with project metadata + CEO company name. `POST /invitations/:id/decline`. CEO manages via `GET /invitations/sent`, `DELETE /invitations/:id`. Bid submission auto-marks invitation ACCEPTED. |
| Notifications | NEW: `notifications` table. All `notification:generic` WebSocket events persisted to DB. `GET /notifications/me`, `GET /notifications/me/unread-count`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`, `DELETE /notifications/:id`. |
| Milestone Chat | NEW: `milestone_chat_sessions` table. `POST /projects/:id/milestone-chat`, session list, session history. Server owns full conversation history. `suggestedEdit` response field maps to `PATCH /milestones/:id`. |
| Service listings | NEW: `PUT /services/:id/publish`, `PUT /services/:id/unpublish`, `DELETE /services/:id` (DRAFT only), `GET /services/me` (own listings). AI generator now uses expert's claimed domains/seams as context. |
| Project detail | `GET /projects/:id` now returns `required_domains_json`, `required_seams_json`, `milestone_framework_json` — previously missing, blocked Expert BidForm. |
| Engagement detail | `GET /engagements` response includes `project` metadata per item. `GET /engagements/:id/bid`, `GET /engagements/:id/disputes`, `PUT /engagements/:id/cancel` added. |
| Expert profile | `GET /expert-profile/me/domains`, `GET /expert-profile/me/seams` (list own), `DELETE /expert-profile/domains/:id`. `GET /expert-profile/search`, `GET /expert-profile/:userId` (public). |
| Expert search | `GET /users/experts`, `GET /expert-profile/search?domain=...&seam=...&archetype=...` for CEO to find and invite experts. |
| Disputes | NEW: `POST /disputes/:id/evidence` (submit additional evidence), `PUT /disputes/:id/withdraw` (retract before resolution), `GET /milestones/:id/disputes`, `GET /engagements/:id/disputes`. Dispute eval now includes `project_archetype` + `milestone_context` + `reasoning` field. |
| Withdrawals | `DELETE /withdrawals/:id` — cancel a PENDING withdrawal (refunds wallet). `GET /wallets/me/transactions` now paginated with `?type=&limit=&offset=`. |
| CMS | NEW tables: `domain_definitions`, `seam_definitions`, `archetype_definitions`, `probe_questions`, `void_code_definitions`. Full admin CRUD for each. `GET /config/all` bootstrap endpoint. |
| Prompt templates | NEW: `prompt_templates` table. `GET/PUT/DELETE /admin/prompts/:stage`. FastAPI fetches from DB with 60s TTL cache + `.txt` file fallback. Jinja2 rendering with live config injection. |
| Admin | New endpoints: `GET /admin/users`, `GET /admin/users/:id`, `PUT /admin/users/:id/reactivate`, `GET /admin/projects`, `GET /admin/projects/:id`, `GET /admin/engagements`, `GET /admin/experts`, `PUT /admin/projects/:id/reopen`. |
| Conversation list | `GET /conversations` — all active chat threads with last message + unread count. Used for inbox/sidebar. |
| Reviews | `GET /reviews/me`, `GET /reviews/me/received`, `GET /reviews/users/:userId` — view own and others' reviews. |
| Config bootstrap | `GET /config/all` — single call returning domains, seams, archetypes, void codes, subscription packages. Eliminates 5 separate page-load round trips. |