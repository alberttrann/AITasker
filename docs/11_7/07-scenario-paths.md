# AITasker — Complete Scenario Paths & Actor Flows
**Schema version:** 40 tables · **API surface:** 213 endpoints  
**Purpose:** Authoritative reference for every screen journey, decision point, branch, and cross-actor handoff for all human actors and automated system processes. Use as ground truth for screen-by-screen flow design, integration testing, and QA.  
**Naming:** `{ACTOR}-{JOURNEY}.{SUB}` e.g. CEO-1.3 = CEO journey 1, sub-scenario 3.

---

# ACTOR 1: CLIENT / CEO

---

## CEO-0 · Auth, Account Setup & Subscription

### CEO-0.1 · Fresh Registration
**Entry:** Unauthenticated user opens AITasker  
**API:** `POST /auth/register`  
**Request:** `{ email, password, fullName, phone, roles:"CLIENT_CEO", selfTechnical:false }`  
**DB written:** `users`, `client_profiles`, `wallets (balance=0)`, `virtual_accounts (WALLET_TOPUP, permanent)`  
**Response fields:** `access_token`, `refresh_token`, `user.subscriptionClientTier:"free"`  
**Password rules enforced server-side (all violations returned simultaneously as array):**
- ≥ 8 characters, uppercase, lowercase, number, special character  
- Non-disposable domain (MX record verified)  
- Email normalized (lowercased + trimmed) before storage  

**Decision points:**
→ All rules pass → 201 → store `access_token` + `refresh_token` → CEO dashboard (Free tier)  
→ Password rule violations → 400 `message[]` array → show checklist UI, NOT single error  
→ Disposable email detected → 400 "Temporary or throwaway email addresses are not permitted"  
→ Email domain no MX → 400 "Email domain does not exist or cannot receive mail"  
→ Duplicate email → 409 "Email already exist"  

**From here:** Wallet empty (CEO-0.2) · Want to start elicitation (CEO-0.3) required first

---

### CEO-0.2 · Top Up Wallet
**Entry:** Any point where CEO needs to add funds  
**API:** `POST /wallets/virtual-accounts/topup` → returns `{ qrCodeUrl, paymentReference }`  
**Payment:** CEO scans QR with banking app → SePay captures transfer  
**IPN fires:** `POST /webhooks/sepay/ipn` (system-handled) → wallet credited  
**Decision points:**
→ CEO pays exact amount → IPN fires → `wallets.available_balance` incremented ✓  
→ CEO does not pay → permanent VA stays valid → no state change  
→ SePay retry (duplicate IPN) → idempotency guard → 200, no double-credit  

---

### CEO-0.3 · Activate Client Pro Subscription
**Entry:** CEO opens Subscription panel or hits a Pro-gated feature  
**Pre-flight API:** `GET /config/subscription-packages?role=CLIENT`  
→ Returns `[{ id, name, priceVnd:"500000", durationMonths:6 }]` — **do NOT hardcode price in FE**  
**Activation API:** `POST /subscriptions/activate` — body: `{ activeRole:"CLIENT", packageId:"<id from above>" }`  
**DB written:** `wallet_transactions (SUBSCRIPTION)`, `users.subscription_client_tier="pro"`, `users.sub_client_expires_at`, `subscription_purchase_logs`  
**Decision points:**
→ Balance ≥ price → 201 `{ access_token, activatedPackage }` → refresh JWT and UI ✓  
→ Balance < price → 422 `"INSUFFICIENT_BALANCE"` → show shortfall amount → redirect to CEO-0.2  
→ Already Pro (not expired) → 409 `"Your subscription is still active"` → show renewal date  
→ Wrong role mismatch → 422 → blocked  
**Subscription status check:** `GET /subscriptions/status` → `{ subscriptionTier, subscriptionExpires, isExpired }` — trust `subscriptionTier` directly, no FE date math  
**History:** `GET /subscriptions/history` → past purchases with `isExpired` pre-computed

---

### CEO-0.4 · Add Expert Role (Dual-Role)
**Entry:** CEO → Account Settings → Add Role  
**API:** `POST /users/me/add-role` with `{ newRole:"EXPERT" }`  
**DB written:** `users.roles = ["CLIENT_CEO","EXPERT"]`, `expert_profiles` row created  
**Outcome:** Role switcher appears in nav. Self-exclusion rule active (CEO cannot bid own projects).  
**API switch:** `PUT /auth/switch-role`

---

### CEO-0.5 · Forgot Password (Unauthenticated)
**Entry:** CEO on login page → "Forgot password?" link  
**API:** `POST /auth/forgot-password` with `{ email }`  
**Response:** Always `{ message:"If an account with that email exists, a reset link has been sent." }` — anti-enumeration  
**Email contains:** Link to `/reset-password/<token>` (1-hour TTL)  
**Decision points:**
→ Email exists → reset token written to `users.password_reset_token` + `users.password_reset_token_expires_at`  
→ Email does not exist → identical response (never reveal user existence)

---

### CEO-0.6 · Verify Reset Token (on page load)
**Entry:** CEO clicks email link, lands on `/reset-password/<token>`  
**API (call on mount, BEFORE showing form):** `GET /auth/verify-reset-token/:token`  
**Decision points:**
→ 200 `{ valid:true }` → show new password form  
→ 400 "This password reset link is invalid or has expired" → show error screen with "Request new link" CTA → redirect to CEO-0.5

---

### CEO-0.7 · Reset Password (Unauthenticated)
**Entry:** CEO fills in new password on the reset form  
**API:** `POST /auth/reset-password` with `{ token, newPassword }`  
**DB written:** `users.password_hash` updated · `users.refresh_token_hash = null` (all sessions invalidated)  
**Decision points:**
→ 201 → redirect to `/login` with success toast  
→ 400 array → password rule violations → show checklist (same as registration)  
→ 400 string → token already used or expired → show error + CTA to request new link

---

### CEO-0.8 · Change Password (Authenticated)
**Entry:** CEO → Account Settings → Security → Change Password  
**API:** `PUT /auth/me/password` with `{ currentPassword, newPassword }` (requires JWT)  
**DB written:** `users.password_hash`, `users.refresh_token_hash = null` (forces re-login on all devices)  
**Decision points:**
→ 200 → success toast → redirect to login (all tokens invalidated)  
→ 401 "Current password is incorrect" → show error inline  
→ 400 array → new password rule violations → show checklist

---

### CEO-0.9 · Logout
**Entry:** CEO clicks logout in nav  
**API:** `POST /auth/logout` (requires JWT)  
**DB written:** `users.refresh_token_hash = null`  
**FE action:** Clear `access_token` and `refresh_token` from storage → redirect to `/login`  
**Effect:** Next refresh call with old token → 401 "Refresh token has been invalidated" → full logout

---

### CEO-0.10 · Deactivate Account
**Entry:** CEO → Account Settings → Danger Zone → Deactivate  
**API:** `DELETE /users/me`  
**Guard:** `users.is_active = false` only if no active engagements  
**Decision points:**
→ No active engagements → 200 → account deactivated → auto-logout  
→ Active engagements exist → 422 "Cannot deactivate account with N active engagement(s). Close them first."  
**Recovery:** Admin can reactivate via `PUT /admin/users/:id/reactivate`

---

### CEO-0.11 · Verify Tax Code (Business Identity)
**Entry:** CEO → Profile → Tax Verification  
**API:** `PUT /users/me/tax-code` with `{ taxCode }`  
**Integration:** Hits VietQR API externally to validate code  
**DB written:** `client_profiles.company_name` (from VietQR response)  
**Decision points:**
→ Valid code → 200 `{ verified:true, companyName }` ✓  
→ Invalid code → 200 `{ verified:false }` or 409 if VietQR unavailable

---

## CEO-1 · Project Creation via AI Elicitation

### CEO-1.0 · Start Elicitation (Subscription Gate)
**Entry:** CEO clicks "Post a Project"  
**Pro check:** `GET /subscriptions/status` → if `subscriptionTier !== 'pro'` → gate screen → CEO-0.3 → return here  
**API:** `POST /elicitation/sessions` → `{ id, currentStage:1, state:"IN_PROGRESS" }`  
**DB written:** `elicitation_sessions { state:"IN_PROGRESS", current_stage:1 }`  
**Existing session check:** `GET /elicitation/sessions/active` — if exists → offer Resume (CEO-1.0A) or Start Over

---

### CEO-1.0A · Resume Abandoned Session
**Entry:** CEO had an unfinished session  
**API:** `GET /elicitation/sessions/active` → returns active session with `currentStage`  
**Session list:** `GET /elicitation/sessions` → all historical sessions  
**Specific session:** `GET /elicitation/sessions/:id` — shows all persisted data per stage  
**Decision points:**
→ Resume → returns to exact `currentStage` with all prior data pre-populated  
→ Start Over → `PUT /elicitation/sessions/:id/abandon` → then `POST /elicitation/sessions` fresh  
→ Delete old session → `DELETE /elicitation/sessions/:id`

---

### CEO-1.1 · Stage 1 — Symptom Intake
**Entry:** Session at `currentStage:1`  
**Screens:** Open text area "Describe your business problem"  
**Draft save:** `PATCH /elicitation/sessions/:id/draft` — auto-saves `symptomTextDraft` every 30s or on blur  
**Submission API:** `PUT /elicitation/sessions/:id/stage1` with `{ symptomText }`  
**LLM skip:** If `symptomText.trim() === stage1OriginalInput` (unchanged), skips AI call, returns cached result  
**DB written on success:** `stage1_original_input`, `stage1_symptoms_json`, `void_list_json`, `recommended_archetypes_json`, `estimated_budget_vnd` (if budget detected), `critical_artifacts_json` (if proprietary docs mentioned)  
**Session advances to:** `currentStage:2`  

**New response fields (display to CEO):**
- `stage1OriginalInput` → "What you wrote"
- `stage1SymptomsJson` → "What AI understood" (show diff side-by-side)
- `criticalArtifactsJson` → if non-empty: show persistent banner "You must submit these documents in Stage 4"
  - Format: `[{ artifact_key, label, reason, placeholder_prompt }]`
- `estimatedBudgetVnd` → if present: show "We detected a budget of X VND — correct?"
- `voidListJson` → each item has `void_code` + `severity` — look up human names from `GET /config/void-codes`

**Decision points:**
→ LLM extraction succeeds → advance to CEO-1.2  
→ FastAPI 503 → show retry button → `POST /elicitation/sessions/:id/retry-synthesis` is for Stage 5; for Stage 1 just re-submit  
→ `symptomText` contains zero recognizable symptoms → 400 "Your description does not contain any recognizable symptoms"

---

### CEO-1.2 · Stage 2 — Archetype Selection + Void Acknowledgement
**Pre-load:** `GET /config/archetypes` — **do not hardcode archetype list in FE**  
**Submission API:** `PUT /elicitation/sessions/:id/stage2` with `{ archetype, acknowledgedVoidCodes:[] }`  
**Config:** `GET /config/void-codes` — fetch human-readable names and descriptions for each detected void  
**DB written:** `elicitation_sessions.archetype` (immutable after this step), `void_list_json` updated  
**Session advances to:** `currentStage:3`  

**Screens:**
- Archetype picker cards — use `name` + `description` from `/config/archetypes`; highlight `recommendedArchetypesJson` with AI-suggested badge
- Void acknowledgement panel — for each item in `voidListJson`: show `name` (from config), `description`, `severity` badge; CEO must acknowledge ALL before proceeding

**Decision points:**
→ CEO acknowledges all voids + selects archetype → proceed  
→ Any void un-acknowledged → blocked, UI shows lock + explanation  
→ Archetype code not in DB → 400 (server validates against `archetype_definitions` table)

---

### CEO-1.3 · Stage 3 — Behavioral Probe Questions
**Pre-load:** `GET /config/archetypes/:code/probe-questions` — **fetch live question list for selected archetype**  
**Questions rendered dynamically:** Use `questionText` as both the label and the request body key  
**Submission API:** `PUT /elicitation/sessions/:id/stage3` with `{ probe_responses: { "question text": "answer", ... } }`  
**DB written:** `stage3_probes_json`  
**LLM evaluation:** Stage 3 vagueness + relevancy check runs server-side  
**Session advances to:** `currentStage:4`  

**New response field `vaguenessResult`:**
```
{
  vague_answers:      [{ question, reason }]    // too generic
  irrelevant_answers: [{ question, issue }]     // off-topic for this project
}
```
- Show `vague_answers` and `irrelevant_answers` as **separate warning sections** with different guidance
- Neither blocks submission (both advisory only)

**Decision points:**
→ Not all questions answered → 400 "All N probe questions must be answered. Missing: ..."  
→ No probe questions configured for this archetype → 400 (admin hasn't seeded questions)  
→ All answered (even if flagged as vague/irrelevant) → advance to Stage 4  
→ Stage 4 required + TECH_TEAM route → CEO-1.4A  
→ Stage 4 required + self-technical → CEO-1.4B  
→ Stage 4 required + no TECH_TEAM (Scenario A) → CEO-1.4C

---

### CEO-1.4A · Stage 4 — TECH_TEAM Handoff Route
**Screen:** "Your project requires technical architecture input"  
**API:** `POST /elicitation/sessions/:id/generate-handoff-link` → returns invite JWT  
**CEO action:** Copies link → shares with tech lead (e.g. via Slack)  
**`PUT /elicitation/sessions/:id/self-technical` with `{ selfTechnical:false }` is set**  
**Session state:** `IN_PROGRESS`, `currentStage:4` — CEO is blocked from Stage 4 form  
**Decision points:**
→ TECH_TEAM registers via link → completes TECH-1.1 → synthesis triggered → CEO-1.5  
→ Link expires (72h) → `handoff_consumed_at` check fails → CEO sees "Link Expired" → regenerate via same API  
→ CEO returns before TECH_TEAM acts → `GET /elicitation/sessions/active` shows pending indicator  
→ Existing user receives link → `POST /auth/claim-handoff` (not registration)

---

### CEO-1.4B · Stage 4 — Self-Technical CEO
**Screen:** Stage 4 form presented directly to CEO  
**`PUT /elicitation/sessions/:id/self-technical` with `{ selfTechnical:true }` called first**  
**Auto-save:** `PATCH /elicitation/sessions/:id/stage4-draft` with `{ draftJson }` — saves on blur/30s interval, no LLM call  
**On re-visit:** Pre-fill form from `session.stage4DraftJson`  
**Submission API:** `PUT /elicitation/sessions/:id/stage4` with:
```json
{
  "current_stack": "...",
  "data_available": "...",
  "latency_requirement": "...",
  "additional_requirement_1": "...",
  "technical_artifacts": {
    "compliance_ruleset": "Rule 1: ...\nRule 2: ..."
  }
}
```
**`technical_artifacts` keys** come from `session.criticalArtifactsJson[].artifact_key` (detected in Stage 1)  
**Response:** `{ session, missingArtifacts:[] }` — if `missingArtifacts` is non-empty:
→ Show warning modal: "Incomplete technical specification — proceed anyway?" (NOT a hard block)  
→ CEO proceeds or goes back to fill in artifacts  
**DB written:** `stage4_tech_inputs_json`  
**Session advances to:** `currentStage:5`

---

### CEO-1.4C · Scenario A — No TECH_TEAM Available
**Screen:** Two options presented:  
**Option A:** "Add Tech Discovery as Milestone 0" → `scenario_type = "SCENARIO_A"` → proceed to CEO-1.5  
**Option B:** "Purchase a Tech Discovery service first" → routes to CEO-2.3 → session preserved at `currentStage:4` → resume after service engagement closes

---

### CEO-1.5 · AI Stack Recommendation (Optional, Non-Technical CEO)
**Entry:** Non-technical CEO on Stage 4 form, clicks "Suggest Technical Context"  
**API:** `POST /elicitation/sessions/:id/stage4-recommend`  
**System:** FastAPI generates recommended stack/integration/volume based on symptoms + archetype + probe answers  
**Pre-fills Stage 4 form fields** — CEO reviews and edits before submitting

---

### CEO-1.6 · Stage 5 — Synthesis + Quality Gate
**Screen:** "Analyzing your project…" loading state  
**API:** `POST /elicitation/sessions/:id/stage5` — triggers full synthesis pipeline  
**System fetches live:** Active domains, seams, archetypes from CMS tables for prompt injection  
**DB written on success:** `projects` row created, `elicitation_sessions.state="COMPLETE"`, `tech_team_profiles.linked_project_id` set if TECH_TEAM registered  

**New response fields from synthesis:**
- `estimatedTotalCostVnd` — AI budget estimate across all milestones
- `estimatedTotalDurationDays` — AI timeline estimate
- `milestoneFrameworkJson[].estimatedCostVnd` — per-milestone cost
- `milestoneFrameworkJson[].estimatedDurationDays` — per-milestone timeline
- `artifact_a_json.sdlc_notices` — includes `"compliance_ruleset received — milestone criteria grounded to actual rules"` if artifact submitted

**Quality gate outcomes:**
→ `completeness_score ≥ 0.70` + match pre-check + voids resolved → `projects.state = "PUBLISHED"` → CEO-1.7  
→ `completeness_score < 0.70` or missing artifacts → `RETURNED_TO_CLIENT` → CEO-1.8  
→ No experts match → `RETURNED_TO_CLIENT` → advisory: "No experts with required seams" → CEO-1.8  
→ FastAPI 503 → retry via `POST /elicitation/sessions/:id/retry-synthesis`  
→ Session can revert stage via `PUT /elicitation/sessions/:id/revert` with `{ targetStage:3 }`

---

### CEO-1.7 · Project Published — Dashboard
**Screen:** Project dashboard after `projects.state = "PUBLISHED"`  
**API:** `GET /projects` → role-scoped list; `GET /projects/:id` → full detail  
**Project detail response now includes:**
```json
{
  "required_domains_json":    [{ "domain_code":"A", "required_depth":"INTERMEDIATE" }],
  "required_seams_json":      [{ "seam_code":"A↔C", "criticality":"load_bearing" }],
  "milestone_framework_json": [{ "milestone_number":1, "deliverable_statement":"...", 
                                  "estimated_cost_vnd":40000000, "estimated_duration_days":14 }],
  "estimatedTotalCostVnd":    "120000000",
  "estimatedTotalDurationDays": 42
}
```
**Expert shortlist:** `GET /matching/:projectId/shortlist` — 3–5 match cards  
**Shortlist card shows:** Match strength (STRONG/QUALIFIED/CONDITIONAL), domain coverage, seam gap map (green/amber/red), expert engagement model  

**CEO actions from published project:**
→ Invite expert directly → CEO-4.4  
→ Manage milestone framework → CEO-5.1  
→ Wait for bids → CEO-3  
→ Use Milestone Chat Assistant → CEO-5.9  
→ Cancel project → CEO-6.3

---

### CEO-1.8 · Returned Spec — Fix and Resubmit
**Screen:** "Your project was returned" + `platform_decisions.advisory_note`  
**CEO action:** Read specific void/artifact that failed  
**API:** `PUT /elicitation/sessions/:id/revert` with `{ targetStage:N }` → returns to that stage with data preserved  
**`PUT /elicitation/sessions/:id/continue`** — resume from current stage  
→ CEO fixes the identified issue → re-runs synthesis → CEO-1.6

---

## CEO-2 · Marketplace & Service Purchasing

### CEO-2.1 · Browse Service Marketplace
**Entry:** Any CEO (Free or Pro) opens marketplace  
**API:** `GET /services?serviceType=AI_SERVICE&domains[]=A&seams[]=A↔C&minPriceVnd=0&maxPriceVnd=50000000`  
**Note:** Domain and seam filter values come from `GET /config/domains` and `GET /config/seams` — do NOT hardcode  
**Each card shows:** Title, domains, seams, service_type, price, expert name, avg rating, review count

---

### CEO-2.2 · Service Detail View
**API:** `GET /services/:id` → includes `reputation { average_rating, review_count }`  
**Expert profile:** `GET /expert-profile/:userId` → bio, domains, seams, archetype history  
→ Pre-bid question → CEO-4.1  
→ Purchase → CEO-2.3 or CEO-2.4

---

### CEO-2.3 · Purchase AI Service (Path B)
**Entry:** CEO on service detail, `service_type = AI_SERVICE`  
**API:** `POST /services/:id/purchase` → creates `engagement {type:SERVICE_BASED, state:ACTIVE}` + escrow + funded milestone  
**Screens:** Confirm → QR code (24h VA) → payment pending → engagement created  
**Decision points:**
→ CEO pays exact amount → IPN fires → engagement active → milestone FUNDED → CEO-5  
→ VA expires (24h) → "Payment window expired" → re-click purchase → new VA  
→ Wrong amount → SePay rejects → no IPN → still AWAITING_PAYMENT  
→ After engagement ACTIVE → routes to CEO-5 (milestone management)

---

### CEO-2.4 · Purchase Tech Discovery Service (Path C)
**Entry:** `service_type = TECH_DISCOVERY` OR redirected from CEO-1.4C Option B  
**Same purchase flow as CEO-2.3**  
**After engagement CLOSED:** CEO receives architecture docs via pay-gated documents → can resume elicitation (CEO-1.4C) with full technical context

---

## CEO-3 · Bid Management & Expert Selection

### CEO-3.1 · View Incoming Bids
**Entry:** CEO notified "New bid awaiting your review" (after TECH_TEAM approves)  
**API:** `GET /bids?projectId=<id>` — role-scoped, CEO sees all bids on their project  
**Bid states visible:**
- `tech_status=PENDING` → grayed, "Awaiting technical review"
- `tech_status=APPROVED` → active, CEO can review
- `tech_status=REVISION_REQUESTED` → "Under revision"

---

### CEO-3.2 · Review an Approved Bid
**API:** `GET /bids/:id`  
**Screen:** Bid detail — `footprint_alignment_json` (domains + seams), `approach_summary`, `conditional_pricing_json`, `tech_feedback` from TECH_TEAM, `negotiated_price_vnd` if set  
**CEO actions:**
→ Write counter-offer → CEO-3.3  
→ Approve bid → CEO-3.4  
→ Decline bid → CEO-3.5

---

### CEO-3.3 · Write Counter-Offer
**API:** `PUT /bids/:id/counter-offer` with `{ negotiated_price_vnd:N }`  
**Constraint:** `negotiated_price_vnd` immutable after first write  
**Expert notified** → can discuss in messages → CEO proceeds to approve/decline

---

### CEO-3.4 · Approve Bid → Connection Flow
**API:** `PUT /bids/:id/ceo-decision` with `{ decision:"APPROVED" }`  
**DB written:** `capability_bids.ceo_status = "APPROVED"`, `capability_bids.state = "SELECTED"`, all other bids → `"DECLINED"`  
**Engagement:** `engagements.state` stays `PENDING` until both NDA steps complete  
→ Routes to CEO-4.2 (NDA acknowledgement)

---

### CEO-3.5 · Decline a Bid
**API:** `PUT /bids/:id/ceo-decision` with `{ decision:"DECLINED" }`  
**DB written:** `capability_bids.ceo_status = "DECLINED"`, `capability_bids.state = "DECLINED"`  
→ Expert notified → CEO returns to bid list → other bids still visible

---

## CEO-4 · Messaging, Invitations & Connection

### CEO-4.1 · Pre-Bid Project Messaging
**Entry:** CEO opens project messages channel  
**API:** `GET /projects/:id/messages` → paginated with `?limit=&cursorId=`  
**API:** `GET /projects/:id/messages/unread-count` → badge count  
**Send:** WebSocket `sendMessage` event  
**Mark read:** `POST /messages/:id/read`  
**Participants:** CEO + TECH_TEAM can both respond; expert reads and replies in same thread

---

### CEO-4.2 · Complete NDA (Post-Bid Approval)
**Entry:** Bid SELECTED, connection request auto-sent to expert  
**API:** `PUT /engagements/:id/accept-nda`  
**DB written:** `engagements.client_nda_accepted_at = now()`  
**Decision points:**
→ Expert not yet accepted → engagement stays PENDING → "Awaiting expert acceptance"  
→ Expert accepts + signs NDA → both timestamps set → `engagements.state = "CONNECTED"` → CEO-5  
→ Expert declines → CEO notified → select next expert from remaining bids

---

### CEO-4.3 · Engagement Messaging (Post-Connection)
**Entry:** `engagements.state ≥ CONNECTED`  
**API:** `GET /engagements/:id/messages` + `GET /engagements/:id/messages/unread-count`  
**All conversations:** `GET /conversations` → list of all active threads (engagement + project scoped) with last message + unread count

---

### CEO-4.4 · Invite Expert Directly
**Entry:** CEO views expert shortlist or searches experts → wants to invite before bid  
**API (gateway):** WebSocket `inviteExpert` event `{ projectId, expertId, content? }`  
**System actions:**
1. Validates CEO owns project
2. Creates/updates `invitations` row (upsert — re-inviting resets to PENDING, 7-day expiry)
3. Emits `notification:generic` → expert's socket room → `link:"/expert/invitations"`
4. Creates chat message in project thread  
**Note:** Invitation is now persistent — expert can see it on their Invitations page even after page refresh

---

### CEO-4.5 · View Project Invitations
**API:** `GET /projects/:id/invitations`  
→ Shows all invitations with expert info, status, invitedAt  
**Statuses:** PENDING | ACCEPTED (bid submitted) | DECLINED

---

### CEO-4.6 · Retract an Invitation
**API:** `DELETE /invitations/:id`  
**Guard:** CEO only; blocked if status = ACCEPTED (expert already bid)  
**DB written:** `invitations.status = "DECLINED"`, `respondedAt = now()`

---

### CEO-4.7 · View Sent Invitations (Across All Projects)
**API:** `GET /invitations/sent`  
→ All invitations CEO has sent, with project info, expert info, status

---

## CEO-5 · Milestone Management

### CEO-5.1 · View Project Milestones
**API:** `GET /projects/:id/milestones` — AI-generated blueprint from synthesis  
**or by engagement:** `GET /milestones?engagementId=...` — actual milestone rows  
**Note:** `milestoneFrameworkJson` in project detail is the **AI blueprint** (advisory); actual `Milestone` rows are the **binding contract**

---

### CEO-5.2 · Create Milestone
**Entry:** CEO sets up formal milestones from the AI blueprint  
**API:** `POST /milestones` with `{ engagement_id, milestone_number, deliverable_statement, sign_off_authority, payment_amount_vnd, criteria:[] }`  
**DB written:** `milestones {state:"DEFINED"}`, `acceptance_criteria` rows  
**`sign_off_authority`:** CEO | TECH_TEAM | JOINT

---

### CEO-5.3 · Edit Milestone
**API:** `PATCH /milestones/:id` with any of `{ title, deliverable_statement, sign_off_authority, payment_amount_vnd, estimated_duration_days, tech_stack }`  
**Guard:** Only while `milestones.state = "DEFINED"`; CEO (clientId) only  
**Errors:** 422 if not DEFINED state · 403 if not CEO

---

### CEO-5.4 · Delete Milestone
**API:** `DELETE /milestones/:id`  
**Guard:** Only while `milestones.state = "DEFINED"`; CEO only  
→ Permanently deleted — no recovery

---

### CEO-5.5 · Manage Acceptance Criteria
**List:** `GET /criteria/:milestoneId`  
**Add:** `POST /criteria/:milestoneId` with `{ criterion_text, is_required:true }`  
**Verify (approve):** `PUT /criteria/:id/verify`  
**Flag for revision:** `PUT /criteria/:id/revision` with `{ revision_note }`  
**Delete:** `DELETE /criteria/:id`  
**Note:** Adding a criterion after FUNDED state may not trigger re-evaluation — keep criteria defined in DEFINED state

---

### CEO-5.6 · Fund a Milestone (QR Payment)
**Entry:** Milestone in DEFINED state → CEO clicks "Fund Milestone"  
**API:** `PUT /milestones/:id/fund` → returns `{ vaNumber, vaExpiresAt }` (24h expiry)  
**CEO:** Scans QR, pays exact amount  
**IPN fires:** `milestones.state: DEFINED → FUNDED → IN_PROGRESS` atomically  
**Decision points:**
→ Correct amount → IPN fires → pay-gated docs for this milestone auto-released to TECH_TEAM → expert notified "Milestone N funded"  
→ VA expires (24h) → re-click "Fund" → new VA generated  
→ Wrong amount → SePay handles error → no IPN → milestone still DEFINED  
→ First milestone funded → `engagements.state = "ACTIVE"` (if CONNECTED)

---

### CEO-5.7 · Review Submitted Milestone (`sign_off_authority = CEO or JOINT`)
**Entry:** Expert submits → `milestones.state = "SUBMITTED"` → CEO notified  
**APIs used:**  
`GET /milestones/:id` — milestone detail  
`GET /milestones/:id/submissions` — submission history (all revision loops)  
`GET /milestones/:id/submissions/latest` — most recent submission  
`GET /milestones/:id/disputes` — any open disputes  
`GET /criteria/:milestoneId` — criteria list  
`GET /milestones/:id/dod` — DoD checklist (read-only for CEO)  

**CEO actions per criterion:**
→ Met → `PUT /criteria/:id/verify` → `verified_at` set  
→ Not met → `PUT /criteria/:id/revision` with `{ revision_note }` → `milestones.state = "IN_REVISION"` → expert notified  
→ All required criteria verified → if JOINT: wait for TECH_TEAM side → if CEO: APPROVED fires → CEO-5.8  
→ File dispute instead → CEO-5.10

---

### CEO-5.8 · Milestone Approved — Escrow Released
**System:** APPROVED guard (unverified required criteria count = 0) → `milestones.state = "APPROVED"` → ledger fires → chi hộ → `milestones.state = "RELEASED"`  
**Screen:** Milestone panel → APPROVED → disbursement processing → RELEASED  
**If last milestone:** `engagements.state = "CLOSED"` → routes to CEO-6

---

### CEO-5.9 · Milestone Chat Assistant
**Entry:** CEO on project milestone page → "Chat with AI" panel  
**First message (new conversation):**  
`POST /projects/:id/milestone-chat` with `{ message }` — no `chatSessionId`  
→ Returns `{ reply, suggestedEdit, chatSessionId, sessionTitle }`  
**Follow-up (continue conversation):**  
`POST /projects/:id/milestone-chat` with `{ message, chatSessionId }`  
**Session list (sidebar):** `GET /projects/:id/milestone-chat/sessions`  
**Restore thread:** `GET /projects/:id/milestone-chat/sessions/:sessionId`  
**FE:** Store only `chatSessionId` in state — history is server-side  
**`suggestedEdit` field (when AI suggests a milestone edit):**
```json
{ "milestone_number": 2, "field": "paymentAmountVnd", "suggested_value": 30000000, "reason": "..." }
```
→ Show "Apply" button → `PATCH /milestones/:id` with suggested values

---

### CEO-5.10 · File a Dispute
**Entry:** CEO on milestone review, not satisfied — prefers dispute over revision  
**API:** `POST /disputes` with `{ engagementId, milestoneId, criterionId, deliverableDescription, files:[] }`  
**DB written:** `disputes {state:"PENDING"}`, `escrow_accounts.status = "FROZEN"`, `milestones.state = "DISPUTED"`  
**LLM Layer 1 fires automatically:**
→ `llm_confidence ≥ 0.80` → `disputes.state = "AUTO_RESOLVED"` → winner determined by `finding`  
→ `llm_confidence < 0.80` → `disputes.state = "MANUAL_REVIEW"` → admin notified → CEO-5.10A  

**Post-filing actions (while dispute open):**  
`POST /disputes/:id/evidence` → add more evidence  
`PUT /disputes/:id/withdraw` → retract dispute (before resolution) → escrow unfrozen  
`GET /disputes/:id` → check current state  
`GET /engagements/:id/disputes` → list all disputes for engagement

---

### CEO-5.10A · Dispute Under Admin Review
**Screen:** "Your dispute is under admin review" → passive wait  
**Admin resolves:** RELEASE / REFUND / SPLIT 50-50  
→ CEO notified of outcome → escrow settled

---

## CEO-6 · Post-Engagement & Account Management

### CEO-6.1 · Submit Post-Engagement Review
**Entry:** `engagements.state = "CLOSED"`  
**API:** `POST /reviews` with `{ engagementId, targetId:expertId, rating, comment }`  
**Constraint:** `UNIQUE(engagement_id, reviewer_id)` — one review per engagement per person  
**View reviews written:** `GET /reviews/me`  
**View reviews received:** `GET /reviews/me/received`  
**View expert's public reviews:** `GET /reviews/users/:userId`

---

### CEO-6.2 · Cancel a Project
**Entry:** CEO decides not to proceed after publishing  
**API:** `PUT /projects/:id/cancel`  
**Guards:**  
→ No active engagements with funded milestones → 200 → `projects.state = "SUSPENDED"`  
→ Active engagements exist → 422 "Cannot cancel project with N active engagement(s). Close them first."

---

### CEO-6.3 · View All Engagements on a Project
**API:** `GET /projects/:id/engagements`  
→ List of all engagements with expert info + milestone count  
→ Click engagement → `GET /engagements/:id` → full detail

---

### CEO-6.4 · Browse & Search Experts
**API:** `GET /expert-profile/search?domain=A&seam=A↔C&archetype=1&limit=20`  
→ Returns experts matching criteria with domain depths + verified seam claims  
**Expert detail:** `GET /expert-profile/:userId` → full public profile  
**Invite from search:** CEO-4.4

---

### CEO-6.5 · Manage Wallet & Subscription
**Wallet:** `GET /wallets/me` → `{ availableBalance, lockedBalance }`  
**Transactions:** `GET /wallets/me/transactions?type=SUBSCRIPTION&limit=50&offset=0`  
**Subscription history:** `GET /subscriptions/history` → `[{ packageName, amountPaidVnd, purchasedAt, expiresAt, isExpired }]`  
**Subscription status:** `GET /subscriptions/status` → `{ subscriptionTier, subscriptionExpires, isExpired }`

---

---

# ACTOR 2: CLIENT / TECH_TEAM

---

## TECH-0 · Onboarding

### TECH-0.1 · Register via Handoff Link (Valid)
**Entry:** Opens JWT handoff link (72h window)  
**API:** `POST /auth/register/handoff` with `{ invite_token, email, password, fullName }`  
**Bug fix applied:** `tech_team_profiles.linked_project_id` is now set immediately if CEO's project is already PUBLISHED (previously was always null)  
**DB written:** `users {client_subtype:"TECH_TEAM"}`, `tech_team_profiles {linked_project_id, linked_client_id}` — project link set atomically if project exists  
**Outcome:** Immediately redirected to Stage 4 form OR project dashboard if project already published  
**Password:** Same rules as CEO-0.1 registration

---

### TECH-0.2 · Register via Handoff Link (Expired)
**Error:** "This invitation has expired" → no registration → CEO must regenerate link via `POST /elicitation/sessions/:id/generate-handoff-link`

---

### TECH-0.3 · Claim Handoff (Existing User)
**Entry:** Existing user receives handoff link  
**API:** `POST /auth/claim-handoff` with `{ invite_token }`  
**Bug fix applied:** Same `linked_project_id` fix as TECH-0.1  
**Outcome:** `tech_team_profiles` updated → user sees project immediately in `GET /projects`

---

### TECH-0.4 · Login (Returning TECH_TEAM)
**API:** `POST /auth/login` → dashboard shows linked project  
**Access scope:** Permanently locked to `tech_team_profiles.linked_project_id` — single project scope  
**New tech team dashboard:** `GET /projects` now returns the project immediately (no more "Waiting for CEO" when project exists — only show that message when array is genuinely empty)

---

## TECH-1 · Stage 4 Technical Architecture Handoff

### TECH-1.1 · Complete Stage 4 Form
**Entry:** After registration OR returning dashboard with Stage 4 pending  
**Auto-save:** `PATCH /elicitation/sessions/:id/stage4-draft` — saves form state without LLM call  
**Submission API:** `PUT /elicitation/sessions/:id/stage4-handoff` with same body as CEO Stage 4:
```json
{
  "current_stack": "FastAPI + Weaviate + Redis",
  "data_available": "Raw CSV exports from CRM",
  "latency_requirement": "Batch processing, 30s max",
  "additional_requirement_1": "Must stay within AWS us-east-1",
  "technical_artifacts": {
    "compliance_ruleset": "Rule 1: ...\nRule 2: ..."
  }
}
```
**`technical_artifacts`:** Submit content for any items detected in Stage 1 `criticalArtifactsJson`  
**Response:** `{ session, missingArtifacts:[] }` — same warning flow as CEO Stage 4  
**On submit:** Synthesis triggered → `POST /elicitation/sessions/:id/stage5` fires (server-side)

---

### TECH-1.2 · Await Project Publication
**Screen:** "Technical input submitted — awaiting project analysis"  
→ Synthesis passes → `projects.state = "PUBLISHED"` → TECH_TEAM notified + linked to project  
→ Synthesis fails (quality gate) → CEO notified to fix → TECH_TEAM sees "project returned" banner  
→ TECH_TEAM notifications: `GET /notifications/me` → check for project status updates

---

## TECH-2 · Bid Technical Review

### TECH-2.1 · Receive Bid Notification
**New:** Bid submission now triggers `notification:generic` to **both** CEO **and** TECH_TEAM members  
**TECH_TEAM notification payload:** `{ type:"bid_update", title:"New Bid Awaiting Review", link:"/tech-team/projects/<id>" }`  
**API:** `GET /bids?projectId=<id>` (TECH_TEAM scoped to their linked project's bids)  
**Or via engagement:** `GET /engagements/:id/bid`

---

### TECH-2.2 · Review Bid Components
**Screen:** `footprint_alignment_json` (seam claims vs actual system architecture), `approach_summary`, `conditional_pricing_json`  
**TECH_TEAM has context:** Their own Stage 4 inputs (stack, integration method, legacy volume) visible in Artifact B  
**Bid detail:** `GET /bids/:id`

---

### TECH-2.3 · Approve Bid
**API:** `PUT /bids/:id/tech-review` with `{ decision:"APPROVED" }`  
**DB written:** `capability_bids.tech_status = "APPROVED"` → CEO review unlocked → CEO notified

---

### TECH-2.4 · Request Bid Revision
**API:** `PUT /bids/:id/tech-review` with `{ decision:"REVISION_REQUESTED", tech_feedback:"..." }`  
**DB written:** `tech_status = "REVISION_REQUESTED"`, `tech_feedback` written → expert notified  
→ Expert revises → `tech_status → PENDING` → TECH_TEAM re-notified → TECH-2.2 again  
→ Loop has no hard limit

---

## TECH-3 · Post-Connection Access

### TECH-3.1 · View Artifact B
**Entry:** `engagements.state ≥ CONNECTED` + both NDA timestamps set  
**API:** `GET /projects/:id/artifact-b`  
→ Read-only technical vault: TECH_TEAM's own Stage 4 inputs (schemas, contracts, stack specs)

---

### TECH-3.2 · Pay-Gated Document Inbox
**Entry:** `milestones.state ≥ FUNDED` → `paygated_documents.release_state = "RELEASED"` atomically on IPN  
**API:** `GET /milestones/:id/paygated-docs`  
→ Documents released per milestone. CEO excluded at route level.

---

## TECH-4 · Milestone Sign-Off

### TECH-4.1 · Review Submitted Milestone (TECH_TEAM or JOINT authority)
**Entry:** Expert submits → `milestones.state = "SUBMITTED"` → TECH_TEAM notified  
**APIs:** `GET /milestones/:id` · `GET /milestones/:id/submissions/latest` · `GET /criteria/:milestoneId` · `GET /milestones/:id/dod`

### TECH-4.2 · Verify Technical Criteria → Approve or Flag Revision  
→ Same flow as CEO-5.7 but for TECH_TEAM-specific criteria  
`PUT /criteria/:id/verify` or `PUT /criteria/:id/revision`

### TECH-4.3 · File Dispute (TECH_TEAM can dispute)
→ Same flow as CEO-5.10 via `POST /disputes`

---

## TECH-5 · Post-Engagement

### TECH-5.1 · Submit Structured Review
**API:** `POST /reviews` with `{ engagementId, targetId:expertId, rating, comment, structuredSignalsJson:"{...}" }` (structured signals required for TECH_TEAM role)  
**`reviewerRole`:** Auto-set to `"TECH_TEAM"` on server based on `clientSubtype`

---

---

# ACTOR 3: EXPERT

---

## EXP-0 · Onboarding & Profile Setup

### EXP-0.1 · Register as Expert
**API:** `POST /auth/register` with `{ roles:"EXPERT", ... }`  
**DB written:** `users`, `expert_profiles`, `wallets`, `virtual_accounts (WALLET_TOPUP)`  
**Same email/password validation as CEO-0.1**

---

### EXP-0.2 · Build Taxonomy Profile
**Domains (DB-driven — fetch from API):** `GET /config/domains` → NOT hardcoded A-F  
**API:** `POST /expert-profile/domains` with `{ domainCode:"A", depthLevel:"DEEP" }` (depth: SURFACE | OPERATIONAL | DEEP)  
**Bulk sync:** `PUT /expert-profile/domains/sync` with `{ domains:[...] }` — replaces entire domain set atomically  
**Update single:** `PUT /expert-profile/domains/:id`  
**Delete:** `DELETE /expert-profile/domains/:id`  
**View my domains:** `GET /expert-profile/me/domains`  

**Seams (DB-driven — fetch from API):** `GET /config/seams` → use `↔` arrow codes, NOT `A<->C` format  
**API:** `POST /expert-profile/seams` with `{ seamCode:"A↔C" }`  
**Bulk sync:** `PUT /expert-profile/seams/sync` with `{ seams:["A↔C","A↔D"] }`  
**View my seams:** `GET /expert-profile/me/seams`  

**Profile update:** `PUT /expert-profile/me` with `{ engagementModel, archetypeHistoryJson, stackTagsJson }`  
**Note:** `bio` is updated via `PUT /users/me`, not expert-profile endpoint  

**View full profile:** `GET /expert-profile/me` → `{ profile, domainDepths, seamClaims }`  
**Outcome:** Discoverable in matching at Tier 1 weight (0.20) for claimed seams

---

### EXP-0.3 · Activate Expert Pro Subscription
**Pre-flight:** `GET /config/subscription-packages?role=EXPERT` → get `{ id, priceVnd, durationMonths }` dynamically  
**API:** `POST /subscriptions/activate` with `{ activeRole:"EXPERT", packageId }` ← `packageId` is **required**  
**Unlocks:** Tier 2 seam verification, bidding on Tier 2-3 projects, AI service generator, earnings analytics  
**History:** `GET /subscriptions/history`

---

### EXP-0.4 · Top Up Wallet (Expert)
→ Same as CEO-0.2 via `POST /wallets/virtual-accounts/topup`

---

### EXP-0.5 · Link Bank Account
**API:** `POST /bank-hub/initiate-link` → redirects to SePay Bank Hub WebView  
**IPN:** `POST /webhooks/sepay/bank-linked` → `users.sepay_bank_account_xid` set  
**Required before:** `POST /withdrawals`

---

### EXP-0.6 · Logout / Password Management
→ Same flows as CEO-0.6 (logout), CEO-0.7 (forgot password), CEO-0.8 (change password)

---

## EXP-1 · Invitation Management (NEW)

### EXP-1.1 · View Invitations Page
**Entry:** Expert receives `notification:generic { link:"/expert/invitations" }` OR navigates directly  
**API:** `GET /invitations` → list with full project metadata  
**Response per invitation:**
```json
{
  "id": "...", "status": "PENDING", "invitedAt": "...", "isExpired": false,
  "project": { "id", "projectName", "state", "archetype", "tier",
               "requiredDomainsJson", "requiredSeamsJson" },
  "ceo": { "id", "fullName", "clientProfile": { "companyName" } }
}
```
**`isExpired`** computed server-side — no FE date math needed  
**CEO company name:** `invitation.ceo.clientProfile?.companyName ?? invitation.ceo.fullName`  

**Status badge rendering:**
- PENDING + !isExpired → 🟡 "Invited" → CTA: "View Project" | "Submit Bid" | "Decline"
- PENDING + isExpired → ⚫ "Expired" → no CTAs
- ACCEPTED → 🟢 "Bid Sent" → CTA: "View My Bid"
- DECLINED → ⚫ "Declined" → no CTAs

---

### EXP-1.2 · Decline an Invitation
**API:** `POST /invitations/:id/decline` (no body required)  
**Show confirmation dialog before calling** — cannot be undone  
**Guards:**
→ 403 if not your invitation  
→ 422 if status ≠ PENDING (already accepted or declined)  
**Response:** `{ id, status:"DECLINED", respondedAt }`

---

## EXP-2 · Seam Verification (Tier 2)

### EXP-2.1 · Submit Portfolio Evidence
**Entry:** Expert selects seam for Tier 2 upgrade (must already be at Tier 1)  
**Pre-checks:**  
→ Expert Pro active? (`GET /subscriptions/status`) → else gate → EXP-0.3  
→ `locked_until ≤ now()`? (`GET /expert-profile/me/seams`) → else show lockout timer  
**API:** `POST /portfolio-submissions` with `{ seamClaimId, projectDescription, decisionPoints }`  
**Validation:** `projectDescription` min 50 chars, `decisionPoints` min 20 chars  
**System:** FastAPI portfolio evaluator runs LLM evaluation — seam definitions injected from DB  
**Decision points:**
→ `llm_confidence ≥ 0.85` → EXP-2.2 (Tier 2 granted)  
→ `llm_confidence < 0.85` → EXP-2.3 (rejected)

---

### EXP-2.2 · Tier 2 Upgrade Granted
**DB written:** `expert_seam_claims.verification_tier = "EVIDENCE_BACKED"` + `platform_decisions {SEAM_TIER_UPGRADE}`  
**Screen:** "Seam verified! Your {seam} claim is now Evidence-Backed (Tier 2)"  
**Effect:** Composite match score weight: 0.20 → 0.55; gap map: Yellow → Amber → (no change if load_bearing)

---

### EXP-2.3 · Rejection + Lockout Logic
**DB written:** `expert_seam_claims.submission_count++`; `portfolio_submissions {REJECTED}`  
**Screen:** Rejection + `advisory_note` (names missing signals)  
→ `submission_count < 5` → "Try again" available  
→ `submission_count = 5` → `locked_until = now() + 30 days` → countdown timer shown  

**View portfolio submissions:** `GET /portfolio-submissions` or `GET /portfolio-submissions/:id`  
**Delete entry:** `DELETE /portfolio-submissions/me/portfolio/:id`  
**View specific:** `GET /portfolio-submissions/me/portfolio/:id`

---

## EXP-3 · Service Listing Management

### EXP-3.1 · Create Listing — AI Generator Route (Expert Pro)
**API:** `POST /services` with `{ serviceType:"AI_SERVICE", useAiGenerator:true, capabilities:[], targetUseCases:[] }`  
**System:** Calls FastAPI service_generate — now includes expert's claimed domains and seams for context  
**Draft created:** `services.state = "DRAFT"` → expert reviews AI draft → edits → publishes  
**Domain/seam tags:** Accept any string (DB-driven, not hardcoded enum)

---

### EXP-3.2 · Create Listing — Manual Route
**API:** `POST /services` with `{ serviceType, title, description, scope, timeline, priceVnd, domainsJson:["A","B"], seamsJson:["A↔C"] }`  
**Seam format:** Must use `↔` arrow character — `A<->C` format rejected by DTO validation

---

### EXP-3.3 · Publish / Unpublish a Listing
**Publish DRAFT:** `PUT /services/:id/publish`  
**Unpublish (PUBLISHED → DRAFT):** `PUT /services/:id/unpublish`  
**Or via update:** `PUT /services/:id` with `{ state:"PUBLISHED" }` (same effect)  
**My listings (all states):** `GET /services/me`

---

### EXP-3.4 · Delete a Listing
**API:** `DELETE /services/:id`  
**Guard:** Only DRAFT state — cannot delete published listings  
**Error:** 422 "Can only delete DRAFT listings. Unpublish first."

---

## EXP-4 · Shortlist & Bidding

### EXP-4.1 · Receive Shortlist Notification
**Entry:** Matching engine places expert in shortlist after project publishes  
**Notification:** `notification:generic` → expert's socket room → `link:"/expert/projects"` (or similar)  
**Notifications REST fallback:** `GET /notifications/me` → lists persisted notifications (survives page refresh)  
**Unread count:** `GET /notifications/me/unread-count` → badge in nav  
**Mark read:** `PUT /notifications/:id/read` or `PUT /notifications/read-all`  
**Delete notification:** `DELETE /notifications/:id`

---

### EXP-4.2 · View Project Detail (Pre-Bid)
**API:** `GET /projects/:id` → now includes `required_domains_json`, `required_seams_json`, `milestone_framework_json`  
**Use these fields directly for BidForm** — no extra calls needed for project requirements  
**Look up domain/seam names:** `GET /config/domains` + `GET /config/seams`  
**Project messages (pre-bid Q&A):** `GET /projects/:id/messages`

---

### EXP-4.3 · Submit a Bid
**API:** `POST /bids` with:
```json
{
  "projectId": "...",
  "footprint_alignment_json": {
    "domains": [{ "code": "A", "depth": "DEEP" }],
    "seams":   [{ "code": "A↔C", "tier": "CLAIMED" }]
  },
  "approach_summary": "...",
  "conditional_pricing_json": [{ "milestone_number": 1, "price_vnd": 15000000, "condition": "Delivery" }]
}
```
**Domain `code`:** Any string from `GET /config/domains` (not locked to A-F enum)  
**Seam `code`:** Use `↔` arrows from `GET /config/seams` — `A<->C` rejected  
**`tier`:** CLAIMED | EVIDENCE_BACKED (still enum, not DB-driven)  
**`depth`:** SURFACE | OPERATIONAL | DEEP (still enum, not DB-driven)  
**System creates atomically:** `engagements {type:"PROJECT_BASED", state:"PENDING"}` + `capability_bids {state:"SUBMITTED", tech_status:"PENDING"}`  
**Notification sent to:** CEO + ALL TECH_TEAM members linked to the project  
**Invitation auto-updated:** If expert was invited, `invitations.status → "ACCEPTED"`

---

### EXP-4.4 · Withdraw a Bid
**API:** `DELETE /bids/:id`  
**Guard:** Only while `capability_bids.state = "SUBMITTED"` (before TECH_TEAM reviews)  
**Error:** 422 "Cannot withdraw a bid in state 'SELECTED'" (or any non-SUBMITTED state)

---

### EXP-4.5 · Bid Revision Loop
**Entry:** `tech_status = "REVISION_REQUESTED"` + `tech_feedback` set → expert notified  
**API:** `PUT /bids/:id` with updated bid components  
**DB written:** bid updated in-place, `tech_status → "PENDING"`, `version_number += 1`

---

### EXP-4.6 · View All My Bids
**API:** `GET /bids` (role-scoped — expert sees own bids across all projects)  
→ Includes project metadata (`project.projectName`, `project.state`) per bid  
→ Filter by project: `GET /bids?projectId=<id>` (CEO use)

---

## EXP-5 · Connection & Artifact B Access

### EXP-5.1 · Receive Connection Request
**Entry:** CEO approved bid → `engagements.state = "PENDING"` → expert notified  
**Screen:** Connection request panel → Artifact A summary (Artifact B still locked) → Accept or Decline  
**NDA acceptance:** `POST /engagements/:id/connect`  
**Decline:** `PUT /engagements/:id/decline`  
**Bank prompt:** If `users.sepay_bank_account_xid IS NULL` → non-blocking "Link bank account" prompt → EXP-0.5

---

### EXP-5.2 · CONNECTED — View Artifact B
**Entry:** Both NDA timestamps set → `engagements.state = "CONNECTED"`  
**API:** `GET /projects/:id/artifact-b` → TECH_TEAM's full technical context  
**Expert now has:** Schemas, payload samples, integration contracts, stack specs for delivery planning

---

## EXP-6 · Pay-Gated Document Staging

### EXP-6.1 · Stage a Reasoning Document
**Entry:** `engagements.state ≥ CONNECTED`  
**API:** `POST /milestones/:id/paygated-docs` with `{ documentUrl, milestoneId }`  
**DB written:** `paygated_documents {release_state:"STAGED"}`  
**On milestone IPN:** `release_state → "RELEASED"` atomically  

### EXP-6.2 · Check Release Status
**API:** `GET /milestones/:id/paygated-docs` → STAGED or RELEASED per doc

---

## EXP-7 · Milestone Delivery

### EXP-7.1 · DoD Checklist Management
**List:** `GET /milestones/:id/dod`  
**Add item:** `POST /milestones/:id/dod/items` with `{ item_description, is_required, maps_to_criterion_id? }`  
**Update status:** `PUT /milestones/:id/dod/:itemId` with `{ status:"COMPLETED", completion_note }`  
**Delete item:** `DELETE /milestones/:id/dod/:itemId` (only PENDING items)  
**Status values:** PENDING | COMPLETED | NOT_APPLICABLE (NOT_APPLICABLE blocked for `is_required=true` items)

---

### EXP-7.2 · Submit Milestone Deliverable
**Entry:** Expert believes work complete  
**System DoD guard:** All `is_required=true` items must be COMPLETED  
**API:** `POST /milestones/:id/submit` with `{ description, files_json:[] }`  
**Decision points:**
→ DoD guard passes → `milestone_submissions` created → `milestones.state = "SUBMITTED"` → sign-off authority notified  
→ DoD guard fails → 422 `{ error:"REQUIRED_DOD_INCOMPLETE", missing_items:[] }` → expert must complete DoD first

---

### EXP-7.3 · View Submission History
**API:** `GET /milestones/:id/submissions` → all submissions (revision loops) for this milestone  
**API:** `GET /milestones/:id/submissions/latest` → most recent submission  
**API:** `GET /engagements/:id/submissions` → all submissions across all milestones in engagement

---

### EXP-7.4 · Revision Loop
**Entry:** Sign-off authority flags criterion → `milestones.state = "IN_REVISION"` → expert notified  
**Screen:** `acceptance_criteria.revision_note` shown → expert addresses → resubmits → EXP-7.2

---

## EXP-8 · Earnings & Withdrawal

### EXP-8.1 · View Wallet & Earnings
**APIs:** `GET /wallets/me` · `GET /wallets/me/transactions?type=ESCROW_RELEASE&limit=50&offset=0`  
**Withdrawal history:** `GET /withdrawals` (expert's own)

---

### EXP-8.2 · Request Withdrawal (Happy Path)
**Pre-checks:** `users.sepay_bank_account_xid NOT NULL` + `wallets.available_balance > 0`  
**API:** `POST /withdrawals` with `{ amount }`  
**Sequence:** Ledger deduct → `withdrawal_requests {PENDING}` → chi hộ fires async → `POST /webhooks/sepay/chi-ho-credit` → `status = "COMPLETED"`  
**Error states:**
→ Bank not linked → 422 → prompt to EXP-0.5  
→ Insufficient balance → 422 "INSUFFICIENT_BALANCE"

---

### EXP-8.3 · Cancel Withdrawal (While PENDING)
**API:** `DELETE /withdrawals/:id`  
**Guard:** Only PENDING withdrawals; expert owns it  
**DB:** `withdrawal_requests.status = "CANCELLED"` + wallet refunded atomically  
**Error:** 422 if withdrawal not PENDING

---

### EXP-8.4 · Withdrawal Failed (Chi Hộ Error)
**System:** `withdrawal_requests.status = "FAILED"` + wallet compensation fired  
**Expert notified:** "Withdrawal failed — your balance has been restored"

---

## EXP-9 · Post-Engagement

### EXP-9.1 · Submit Review
**API:** `POST /reviews` with `{ engagementId, targetId:clientId, rating, comment }`  
**`reviewerRole`:** Auto-set to `"EXPERT"` on server  
**View reviews I've given:** `GET /reviews/me`  
**View reviews I've received:** `GET /reviews/me/received`

---

---

# ACTOR 4: ADMIN

---

## ADM-0 · Auth (Same as Other Actors)
All admin auth flows (login, logout, password reset, change password) use same endpoints. Admin role checked at route level via `@Roles('ADMIN')` guard.

---

## ADM-1 · Platform Integrity Monitor

### ADM-1.1 · Spec Auto-Return Log
**API:** `GET /admin/decisions?decisionType=SPEC_AUTO_RETURN`  
→ Shows: `project_id`, void that failed, `advisory_note`, timestamp  
→ Pattern detection: same CEO repeated failures → ADM-3.2

---

### ADM-1.2 · Portfolio Evaluation Log
**API:** `GET /admin/decisions?decisionType=PORTFOLIO_EVAL`  
→ Shows: `expert_id`, seam_code, `llm_confidence`, `decision`, `advisory_note`, submission count  
→ Monitor for abuse patterns, lockout events, suspicious approval rates

---

### ADM-1.3 · Dispute Resolution Log
**API:** `GET /admin/disputes?state=MANUAL_REVIEW`  
→ Shows all disputes — filter by state: AUTO_RESOLVED | MANUAL_REVIEW | RESOLVED  
→ Monitor auto-resolution rate and escalation rate  
**Detail:** `GET /disputes/:id`

---

## ADM-2 · Transaction Ledger

### ADM-2.1 · View All Wallet Transactions
**API:** `GET /admin/transactions?type=WITHDRAWAL&userId=...`  
→ Full `wallet_transactions` table — all users, types, amounts  
→ Includes `userEmail` and `userFullName` joined from wallet → user relation

---

### ADM-2.2 · View Withdrawal Requests
**API:** `GET /admin/withdrawals?status=PENDING`  
→ Shows all requests: status (PENDING/PROCESSING/COMPLETED/FAILED), amounts, disbursement IDs, timestamps

---

### ADM-2.3 · Process Withdrawals
**Complete:** `PUT /admin/withdrawals/:id/complete` — marks as completed (no real chi hộ callback)  
**Fail:** `PUT /admin/withdrawals/:id/fail` — marks failed, refunds wallet  

---

## ADM-3 · Account Management

### ADM-3.1 · Browse User Accounts
**API:** `GET /admin/users?role=EXPERT&isActive=true&search=albert`  
→ Filter by role, active status, name/email search

---

### ADM-3.2 · View User Detail
**API:** `GET /admin/users/:id`  
→ Full user data including `wallet { availableBalance, lockedBalance }`, `clientProfile`, `expertProfile`

---

### ADM-3.3 · Suspend a User Account
**API:** `PUT /admin/users/:id/suspend`  
**DB written:** `users.is_active = false`  
**Effect:** User's existing JWTs rejected on next API call (`isActive` check in guards). Existing escrow stays HELD.

---

### ADM-3.4 · Reactivate a Suspended Account
**API:** `PUT /admin/users/:id/reactivate`  
**DB written:** `users.is_active = true`

---

### ADM-3.5 · Browse All Experts
**API:** `GET /admin/experts?limit=50`  
→ All expert users with `expertSeamClaims` (verification tiers) and `expertDomainDepths`  
→ Useful for monitoring Tier 2 upgrade rates and suspicious patterns

---

## ADM-4 · Project Management

### ADM-4.1 · Browse All Projects
**API:** `GET /admin/projects?state=PUBLISHED&archetype=3`  
→ Filterable by state and archetype

---

### ADM-4.2 · View Project Detail (Admin)
**API:** `GET /admin/projects/:id`  
→ Full project data including client info, tech team profiles, invitation count

---

### ADM-4.3 · Emergency Spec Pull-Back
**Entry:** Admin identifies problematic published spec  
**API:** `PUT /admin/projects/:id/suspend-spec`  
**Guard:** `projects.state = "PUBLISHED"` required  
**DB written:** `projects.state = "SUSPENDED"`, `platform_decisions {SPEC_AUTO_RETURN}` written  
**CEO notified:** "Your project spec was pulled back" banner

---

### ADM-4.4 · Reopen a Suspended Project
**API:** `PUT /admin/projects/:id/reopen`  
**Guard:** `projects.state = "SUSPENDED"` required  
**DB written:** `projects.state = "PUBLISHED"`  
**Error:** 422 if project is not SUSPENDED

---

### ADM-4.5 · Browse All Engagements
**API:** `GET /admin/engagements?state=ACTIVE&projectId=...`  
→ Full engagement list with project name, expert info, milestone count

---

## ADM-5 · Dispute Resolution

### ADM-5.1 · Dispute Queue
**API:** `GET /admin/disputes?state=MANUAL_REVIEW`  
→ All disputes needing admin action

---

### ADM-5.2 · Review a MANUAL_REVIEW Dispute
**API:** `GET /disputes/:id`  
**Screen shows:**
- Criterion text (what was promised)
- Milestone submission (what was delivered)
- `llm_confidence` + `finding` from LLM Layer 1
- `reasoning` field (new) — LLM's brief explanation
- Escrow amount at stake
- Evidence submitted via `POST /disputes/:id/evidence`
- Engagement messages (all `GET /engagements/:id/messages`)

---

### ADM-5.3 · Resolve Dispute
**API:** `PUT /admin/disputes/:id/resolve` with `{ decision:"RELEASE"|"REFUND"|"SPLIT" }`  
**RELEASE** → escrow → expert wallet  
**REFUND** → escrow → CEO wallet  
**SPLIT** → 50/50 to both  
**DB written:** `disputes.state = "RESOLVED"`, `escrow_accounts.status = "RELEASED/REFUNDED/SPLIT"`, `milestones.state = "APPROVED"`  
→ Both CEO and Expert notified of outcome

---

## ADM-6 · CMS & Configuration Management

### ADM-6.1 · Domain/Seam/Archetype/ProbeQuestion Management
**These replace all hardcoded values in the AI service and FE**

**Domains:**  
`GET /admin/config/domains` → all (active + inactive)  
`POST /admin/config/domains` with `{ code, name, description, sortOrder }`  
`PUT /admin/config/domains/:id` with `{ name, description, isActive, sortOrder }`  
`DELETE /admin/config/domains/:id` → soft-delete (sets `isActive=false`)  

**Seams:**  
`GET/POST/PUT/DELETE /admin/config/seams` (same shape)  
**Note:** Seam codes use `↔` arrow — changing a seam code requires updating all expert claims referencing it  

**Archetypes:**  
`GET/POST/PUT/DELETE /admin/config/archetypes`  

**Probe Questions:**  
`GET /admin/config/probe-questions?archetypeCode=3`  
`POST /admin/config/probe-questions` with `{ archetypeCode, questionText, displayOrder }`  
`PUT /admin/config/probe-questions/:id` with `{ questionText, displayOrder, isActive }`  
`DELETE /admin/config/probe-questions/:id` → soft-delete  
**Effect:** Removing/deactivating a probe question means that archetype requires fewer answers in Stage 3 (takes effect immediately)

---

### ADM-6.2 · Void Code Management
**Void codes are now DB-driven — removing a void type stops Stage 1 from detecting it**  
`GET /admin/config/void-codes` → all (active + inactive)  
`POST /admin/config/void-codes` with `{ code:"GDPR_COMPLIANCE_RISK", name, description, severity:"HIGH", sortOrder }`  
`PUT /admin/config/void-codes/:id` with `{ description, severity, isActive, sortOrder }`  
`DELETE /admin/config/void-codes/:id` → soft-delete  
**Effect:** Adding a new void code means Stage 1 AI immediately detects it in next elicitation (within 60s prompt cache TTL)

---

### ADM-6.3 · Subscription Package Management
**Admin sees ALL packages (active + inactive) — FE public endpoint shows only active**  
`GET /admin/subscriptions/packages`  
`POST /admin/subscriptions/packages` with `{ role:"CLIENT"|"EXPERT", name, priceVnd, durationMonths }`  
`PUT /admin/subscriptions/packages/:id` with `{ priceVnd, durationMonths, name, isActive }`  
`DELETE /admin/subscriptions/packages/:id`  
**Delete guard:** Blocked if package has purchase history → 422 "Cannot delete — N purchase record(s). Deactivate instead."  
**Deactivate:** `PUT /admin/subscriptions/packages/:id` with `{ isActive:false }` → hides from public endpoint  
**Price change:** Takes effect immediately for new activations; existing subs keep their purchased duration

---

### ADM-6.4 · Prompt Template Management (AI Hot-Reload)
**Templates editable without restarting FastAPI — changes take effect within 60 seconds**  
`GET /admin/prompts` → list metadata (id, stage, description, version, updatedAt)  
`GET /admin/prompts/:stage` → full template text  
`PUT /admin/prompts/:stage` with `{ templateText, description }` → create or update  
`DELETE /admin/prompts/:stage` → reset to default `.txt` file on disk  

**Valid stage names:** `stage1_extract`, `stage3_vagueness_check`, `stage4_recommend`, `stage5_synthesize`, `milestone_chat`  

**Jinja2 variables available:**
- `stage1_extract`: `{{ archetypes }}`, `{{ void_codes }}`
- `stage5_synthesize`: `{{ domains }}`, `{{ seams }}`, `{{ archetypes }}`  

**Admin warnings in UI:**
- Malformed Jinja2 → FastAPI falls back to raw template text (LLM may produce incorrect output)  
- Removing a required `{{ variable }}` → that context will be missing from LLM prompt  
- DELETE resets `version` counter to start from disk file

---

## ADM-7 · Analytics Dashboard

### ADM-7.1 · Platform Metrics
**API:** `GET /admin/analytics`  
→ Active projects by archetype/tier  
→ Elicitation completion and publish rates  
→ Portfolio auto-upgrade and rejection rates  
→ Dispute auto-resolution rate  
→ Milestone completion rate  
→ Review submission rate and average ratings

---

---

# ACTOR 5: SYSTEM (Automated Processes)

---

## SYS-1 · Payment IPN Processing

### SYS-1.1 · WALLET_TOPUP IPN (CEO or Expert top-up)
**Trigger:** `POST /webhooks/sepay/ipn` → SePay calls after successful bank transfer  
**Idempotency:** Duplicate INPs detected and 200'd without double-credit  
**DB written:** `wallet_transactions {WALLET_TOPUP}`, `wallets.available_balance += amount`

---

### SYS-1.2 · MILESTONE Escrow IPN
**Trigger:** CEO pays milestone VA → SePay IPN fires  
**Sequence:**  
1. `milestones.state: DEFINED → FUNDED → IN_PROGRESS` (atomic)  
2. `escrow_accounts {HELD, fixed_amount}` created  
3. `paygated_documents` for this milestone → `release_state: STAGED → RELEASED`  
4. If first milestone: `engagements.state → ACTIVE`  
5. Expert notified "Milestone N funded — begin work"  
6. TECH_TEAM notified "Pay-gated docs released"

---

### SYS-1.3 · SERVICE_PURCHASE IPN
**Trigger:** CEO buys a service listing  
**Sequence:** `engagements {SERVICE_BASED, ACTIVE}` + escrow created + first milestone FUNDED atomically

---

### SYS-1.4 · Chi Hộ COMPLETED (Expert Withdrawal)
**Trigger:** `POST /webhooks/sepay/chi-ho-credit` after successful disbursement  
**DB written:** `withdrawal_requests.status = "COMPLETED"`, `withdrawal_requests.confirmed_at = now()`  
**Expert notified:** "Payment of {amount} sent to your bank"

---

### SYS-1.5 · Bank Account Link IPN
**Trigger:** `POST /webhooks/sepay/bank-linked` after SePay Bank Hub OTP verification  
**DB written:** `users.sepay_bank_account_xid` + `users.bank_account_holder_name` + `users.bank_linked_at`  
**Expert notified:** withdrawal now enabled

---

## SYS-2 · Notification Persistence

### SYS-2.1 · Notification Broadcast + Persist
**Trigger:** Any call to `eventEmitter.emit('socket.broadcast', { userId, event, payload })`  
**System (gateway):**  
1. Emits `event` → `userId`'s socket room (real-time)  
2. If `event === 'notification:generic'`: also persists to `notifications` table  
**Persistence ensures:** Notifications survive page refreshes → `GET /notifications/me` returns history  
**Fail-open:** DB write failure does NOT block WebSocket delivery

---

### SYS-2.2 · Notification Triggers (All)
| Trigger | Recipients | `type` | `link` |
|---------|-----------|--------|--------|
| Expert submits bid | CEO + all TECH_TEAM members | `bid_update` | `/ceo/projects/:id` and `/tech-team/projects/:id` |
| CEO invites expert | Expert | `system` | `/expert/invitations` |
| TECH_TEAM approves bid | CEO | `bid_update` | `/ceo/projects/:id` |
| CEO approves bid | Expert | `system` | `/expert/engagements/:id` |
| Both NDA done (CONNECTED) | CEO + Expert | `system` | — |
| CEO funds milestone | Expert | `milestone_update` | `/expert/milestones/:id` |
| CEO funds milestone | TECH_TEAM | `milestone_update` | `/tech-team/milestones/:id` |
| Expert submits deliverable | CEO or TECH_TEAM | `milestone_update` | `/milestones/:id` |
| CEO/TECH_TEAM requests revision | Expert | `milestone_update` | `/expert/milestones/:id` |
| Dispute filed | Other party + Admin | `system` | `/disputes/:id` |
| Admin resolves dispute | CEO + Expert | `system` | — |
| Admin suspends spec | CEO | `system` | — |
| Milestone APPROVED → chi hộ | Expert | `system` | — |

---

## SYS-3 · Subscription State Management

### SYS-3.1 · Real-Time Expiry Correction
**Trigger:** `GET /subscriptions/status` called by any user  
**Logic:**
```
if (user.sub[Role]ExpiresAt && user.sub[Role]ExpiresAt < now()) {
  return { subscriptionTier: "free", isExpired: true }
}
return { subscriptionTier: user.subscription[Role]Tier, isExpired: false }
```
**Key:** DB `subscription_[client|expert]_tier` may still say `"pro"` after expiry — the endpoint corrects this on-the-fly for the FE. **FE must trust the API response, not do date math.**

---

## SYS-4 · Matching Engine

### SYS-4.1 · Shortlist Generation (On Project Publish)
**Trigger:** Stage 5 synthesis succeeds → `projects.state = "PUBLISHED"`  
**System:** Matching engine scores all eligible experts against project's `required_seams_json` + `required_domains_json` + `archetype`  
**Scoring:** Seam composite score based on verification_tier (CLAIMED=0.20, EVIDENCE_BACKED=0.55) × criticality weight (load_bearing=1.0, significant=0.65, contributing=0.35)  
**DB written:** `project_shortlist_cache {results_json, source:"AUTO"}`  
**API (CEO/FE):** `GET /matching/:projectId/shortlist`  
**CEO can force refresh:** `PUT /projects/:id/milestones` (or dedicated shortlist endpoint if implemented)

---

## SYS-5 · Token & Session Security

### SYS-5.1 · Refresh Token Hash Validation
**On `POST /auth/refresh`:** Server fetches `users.refresh_token_hash` → compares SHA-256 of incoming token  
→ Match → issue new access_token  
→ Mismatch → 401 "Refresh token has been invalidated. Please log in again." (user logged out on all devices)  
**Hash cleared on:** `POST /auth/logout`, `PUT /auth/me/password`, `POST /auth/reset-password`

---

### SYS-5.2 · Handoff Token Validation
**On `POST /auth/register/handoff` or `POST /auth/claim-handoff`:**  
→ Validates JWT signature + `purpose:"tech-team-handoff"` claim  
→ Checks `handoff_consumed_at IS NULL` (not already used)  
→ Checks token not expired (72h)  
→ On use: `elicitation_sessions.handoff_consumed_at = now()`

---

---

# CROSS-ACTOR HANDOFF POINTS

All triggers that cross actor boundaries — critical for notification UI and real-time state updates.

| Trigger Actor | Action | Receiving Actor | Notification payload | State change |
|---|---|---|---|---|
| CEO | Generates handoff link | TECH_TEAM | Link opens registration/claim form | Session locked at Stage 4 |
| TECH_TEAM | Registers via link | CEO | "Technical input received" | `elicitation_sessions.currentStage=5` |
| TECH_TEAM | Handoff from existing user (claim) | CEO | Same as above | Same |
| CEO | Publishes project (Stage 5) | TECH_TEAM | `notifications`: project now visible | `tech_team_profiles.linked_project_id` set |
| CEO | Invites expert | EXPERT | `notification:generic {link:"/expert/invitations"}` | `invitations` row PENDING |
| EXPERT | Submits bid | CEO | `notification:generic {link:"/ceo/projects/:id"}` | `capability_bids {SUBMITTED, tech_status:PENDING}` |
| EXPERT | Submits bid | ALL TECH_TEAM members | `notification:generic {link:"/tech-team/projects/:id"}` | Same engagement |
| EXPERT | Accepts invitation implicitly (bids) | — | Invitation auto-marked ACCEPTED | `invitations.status=ACCEPTED` |
| TECH_TEAM | Approves bid | CEO | "Technical review complete" | `capability_bids.tech_status=APPROVED` |
| TECH_TEAM | Requests bid revision | EXPERT | "Revision requested" + `tech_feedback` | `tech_status=REVISION_REQUESTED` |
| CEO | Approves bid | EXPERT | "Connection request" | `capability_bids.state=SELECTED`, others DECLINED |
| CEO | Completes NDA | EXPERT (if already signed) | "CONNECTED — Artifact B unlocked" | `engagements.state=CONNECTED` |
| EXPERT | Completes NDA + connect | CEO (if already signed) | "Expert accepted — CONNECTED" | Same |
| CEO | Funds milestone | EXPERT | "Milestone N funded — begin work" | `milestones.state=IN_PROGRESS` |
| CEO | Funds milestone | TECH_TEAM | "Pay-gated docs released" | `paygated_documents.release_state=RELEASED` |
| EXPERT | Submits deliverable | CEO (if CEO or JOINT authority) | "Milestone N submitted for your review" | `milestones.state=SUBMITTED` |
| EXPERT | Submits deliverable | TECH_TEAM (if TECH_TEAM or JOINT authority) | "Milestone N submitted — technical review needed" | Same |
| CEO | Verifies criterion → all done | EXPERT (TECH_TEAM authority milestone) | "Milestone approved — payment processing" | `milestones.state=APPROVED` → RELEASED |
| TECH_TEAM | Verifies criterion → all done | EXPERT (CEO authority: wait) | "Technical criteria verified — CEO sign-off pending" | JOINT: wait for CEO |
| TECH_TEAM | Verifies → CEO also done (JOINT) | EXPERT | "Milestone approved — payment processing" | APPROVED → RELEASED |
| CEO or TECH_TEAM | Writes revision note | EXPERT | "Revision requested: {revision_note}" | `milestones.state=IN_REVISION` |
| CEO or EXPERT | Files dispute | Other party | "Escrow frozen — dispute filed" | `disputes.state=PENDING`, `escrow.status=FROZEN` |
| CEO or EXPERT | Files dispute | ADMIN | Appears in Dispute Monitor | `disputes.state=MANUAL_REVIEW` (if LLM < 0.80) |
| ADMIN | Resolves dispute | CEO + EXPERT | "Dispute resolved — [outcome]" | escrow RELEASED/REFUNDED/SPLIT, `disputes.state=RESOLVED` |
| ADMIN | Pulls back spec | CEO | "Your project spec was suspended" | `projects.state=SUSPENDED` |
| ADMIN | Suspends user account | Affected user | "Account suspended" on next login | `users.is_active=false` |
| ADMIN | Reactivates account | Affected user | Can login again | `users.is_active=true` |
| EXPERT | Last milestone APPROVED | CEO + EXPERT | "Engagement complete" | `engagements.state=CLOSED` → reviews unlocked |
| SePay IPN (WALLET_TOPUP) | Payment received | CEO or EXPERT | "Balance updated: +{amount}" | `wallets.available_balance+=amount` |
| SePay IPN (MILESTONE) | Milestone payment confirmed | TECH_TEAM | Pay-gated docs in inbox | `paygated_documents.release_state=RELEASED` |
| SePay IPN (chi hộ COMPLETED) | Disbursement confirmed | EXPERT | "Payment sent to bank: {amount}" | `withdrawal_requests.status=COMPLETED` |
| ADMIN | Edits prompt template | FastAPI (next LLM call) | No notification — silent hot-reload | Cache expires ≤60s → new template used |
| ADMIN | Adds new void code | Stage 1 AI (next elicitation) | No notification | New void detected in next CEO symptom submission |

---

# APPENDIX: API → Scenario Mapping (Quick Reference)

| Endpoint | Scenarios |
|---|---|
| `POST /auth/register` | CEO-0.1, EXP-0.1 |
| `POST /auth/login` | CEO-0.1, TECH-0.4, EXP-0.1, ADM-0 |
| `POST /auth/logout` | CEO-0.9 |
| `PUT /auth/me/password` | CEO-0.8 |
| `POST /auth/forgot-password` | CEO-0.5 |
| `GET /auth/verify-reset-token/:token` | CEO-0.6 |
| `POST /auth/reset-password` | CEO-0.7 |
| `POST /auth/register/handoff` | TECH-0.1 |
| `POST /auth/claim-handoff` | TECH-0.3 |
| `PUT /auth/switch-role` | CEO-0.4, EXP-0.6 |
| `GET /config/all` | App bootstrap — all actors |
| `GET /config/domains` | EXP-0.2, CEO BidForm, EXP-4.3 |
| `GET /config/seams` | EXP-0.2, CEO BidForm, EXP-4.3 |
| `GET /config/archetypes` | CEO-1.2 |
| `GET /config/archetypes/:code/probe-questions` | CEO-1.3 |
| `GET /config/void-codes` | CEO-1.1 (display), CEO-1.2 (acknowledge) |
| `GET /config/subscription-packages` | CEO-0.3, EXP-0.3 |
| `POST /subscriptions/activate` | CEO-0.3, EXP-0.3 |
| `GET /subscriptions/status` | CEO-0.3 gate check, EXP-0.3 |
| `GET /subscriptions/history` | CEO-6.5, EXP earnings view |
| `POST /elicitation/sessions` | CEO-1.0 |
| `GET /elicitation/sessions` | CEO-1.0A |
| `GET /elicitation/sessions/active` | CEO-1.0A |
| `GET /elicitation/sessions/:id` | All Stage re-entry points |
| `PATCH /elicitation/sessions/:id/draft` | CEO-1.1 (Stage 1 auto-save) |
| `PUT /elicitation/sessions/:id/stage1` | CEO-1.1 |
| `PUT /elicitation/sessions/:id/stage2` | CEO-1.2 |
| `PUT /elicitation/sessions/:id/stage3` | CEO-1.3 |
| `PATCH /elicitation/sessions/:id/stage4-draft` | CEO-1.4B (Stage 4 auto-save) |
| `PUT /elicitation/sessions/:id/stage4` | CEO-1.4B, CEO-1.4C |
| `PUT /elicitation/sessions/:id/stage4-handoff` | TECH-1.1 |
| `POST /elicitation/sessions/:id/stage4-recommend` | CEO-1.5 |
| `POST /elicitation/sessions/:id/stage5` | CEO-1.6 |
| `PUT /elicitation/sessions/:id/revert` | CEO-1.8 |
| `POST /elicitation/sessions/:id/retry-synthesis` | CEO-1.6 error recovery |
| `PUT /elicitation/sessions/:id/abandon` | CEO-1.0A Start Over |
| `DELETE /elicitation/sessions/:id` | CEO-1.0A Delete |
| `POST /elicitation/sessions/:id/generate-handoff-link` | CEO-1.4A |
| `PUT /elicitation/sessions/:id/self-technical` | CEO-1.4A, CEO-1.4B |
| `GET /projects` | CEO-1.7, TECH-0.4 (project appears), EXP overview |
| `GET /projects/:id` | CEO-1.7, EXP-4.2 (BidForm context) |
| `GET /projects/:id/artifact-a` | CEO-1.7, EXP-5.1 |
| `GET /projects/:id/artifact-b` | TECH-3.1, EXP-5.2 |
| `GET /projects/:id/engagements` | CEO-6.3 |
| `GET /projects/:id/milestones` | CEO-5.1 |
| `GET /projects/:id/invitations` | CEO-4.5 |
| `GET /projects/:id/team` | CEO project detail |
| `PUT /projects/:id/cancel` | CEO-6.2 |
| `POST /projects/:id/milestone-chat` | CEO-5.9 |
| `GET /projects/:id/milestone-chat/sessions` | CEO-5.9 sidebar |
| `GET /projects/:id/milestone-chat/sessions/:sessionId` | CEO-5.9 restore thread |
| `GET /invitations` | EXP-1.1 |
| `POST /invitations/:id/decline` | EXP-1.2 |
| `GET /invitations/sent` | CEO-4.7 |
| `DELETE /invitations/:id` | CEO-4.6 retract |
| `POST /bids` | EXP-4.3 |
| `GET /bids` | CEO-3.1 (project bids), EXP-4.6 (own bids) |
| `GET /bids/:id` | CEO-3.2, EXP-4.5 detail |
| `PUT /bids/:id` | EXP-4.5 revision |
| `DELETE /bids/:id` | EXP-4.4 withdraw |
| `PUT /bids/:id/tech-review` | TECH-2.3, TECH-2.4 |
| `PUT /bids/:id/ceo-decision` | CEO-3.4, CEO-3.5 |
| `PUT /bids/:id/counter-offer` | CEO-3.3 |
| `GET /engagements` | CEO overview, EXP overview |
| `GET /engagements/:id` | All parties to engagement |
| `PUT /engagements/:id/accept-nda` | CEO-4.2 |
| `POST /engagements/:id/connect` | EXP-5.1 |
| `PUT /engagements/:id/decline` | EXP-5.1 |
| `GET /engagements/:id/bid` | Any party to engagement |
| `GET /engagements/:id/milestones` | CEO-5.1, TECH-4.1 |
| `GET /engagements/:id/submissions` | CEO-5.7, TECH-4.1 |
| `GET /engagements/:id/disputes` | CEO-5.7, TECH |
| `PUT /engagements/:id/cancel` | CEO or EXPERT mutual agreement |
| `POST /milestones` | CEO-5.2 |
| `GET /milestones/:id` | CEO-5.7, EXP-7.2 |
| `PATCH /milestones/:id` | CEO-5.3 edit |
| `DELETE /milestones/:id` | CEO-5.4 |
| `PUT /milestones/:id/fund` | CEO-5.6 |
| `GET /milestones/:id/submissions` | CEO-5.7, EXP-7.3 |
| `GET /milestones/:id/submissions/latest` | CEO-5.7 latest |
| `GET /milestones/:id/disputes` | CEO-5.7, TECH-4 |
| `POST /milestones/:id/submit` | EXP-7.2 |
| `POST /milestones/:id/dod/items` | EXP-7.1 |
| `PUT /milestones/:id/dod/:itemId` | EXP-7.1 |
| `GET /milestones/:id/dod` | CEO-5.7 (read), EXP-7.1 |
| `DELETE /milestones/:id/dod/:itemId` | EXP-7.1 |
| `POST /milestones/:id/paygated-docs` | EXP-6.1 |
| `GET /milestones/:id/paygated-docs` | TECH-3.2, EXP-6.2 |
| `GET /criteria/:milestoneId` | CEO-5.5, CEO-5.7 |
| `POST /criteria/:milestoneId` | CEO-5.5 |
| `PUT /criteria/:id/verify` | CEO-5.7, TECH-4.2 |
| `PUT /criteria/:id/revision` | CEO-5.7, TECH-4.2 |
| `DELETE /criteria/:id` | CEO-5.5 |
| `POST /disputes` | CEO-5.10, TECH-4.3, EXP-7.2 |
| `GET /disputes` | All parties |
| `GET /disputes/:id` | Parties + Admin |
| `POST /disputes/:id/evidence` | CEO or EXPERT mid-dispute |
| `PUT /disputes/:id/withdraw` | Filer before resolution |
| `GET /notifications/me` | EXP-4.1, all actors |
| `GET /notifications/me/unread-count` | Nav badge for all actors |
| `PUT /notifications/:id/read` | After reading |
| `PUT /notifications/read-all` | Bulk read |
| `DELETE /notifications/:id` | User clears notification |
| `POST /portfolio-submissions` | EXP-2.1 |
| `GET /portfolio-submissions` | EXP portfolio list |
| `DELETE /portfolio-submissions/me/portfolio/:id` | EXP-2 delete |
| `GET /services` | CEO-2.1 browse |
| `POST /services` | EXP-3.1, EXP-3.2 |
| `GET /services/me` | EXP-3 own listings |
| `GET /services/:id` | CEO-2.2 detail |
| `PUT /services/:id` | EXP-3 update |
| `DELETE /services/:id` | EXP-3.4 |
| `PUT /services/:id/publish` | EXP-3.3 |
| `PUT /services/:id/unpublish` | EXP-3.3 |
| `POST /services/:id/purchase` | CEO-2.3, CEO-2.4 |
| `GET /services/me/purchases` | CEO purchased service history |
| `POST /reviews` | CEO-6.1, TECH-5.1, EXP-9.1 |
| `GET /reviews/me` | Reviews I've given |
| `GET /reviews/me/received` | Reviews I've received |
| `GET /reviews/users/:userId` | Any actor views another's reviews |
| `GET /conversations` | All actors — conversation thread list |
| `GET /users/me` | Any actor profile |
| `PUT /users/me` | Any actor profile update (incl. bio for experts) |
| `GET /users/experts` | CEO-6.4 browse experts |
| `DELETE /users/me` | CEO-0.10 deactivate |
| `GET /wallets/me` | CEO-6.5, EXP-8.1 |
| `GET /wallets/me/transactions` | CEO-6.5, EXP-8.1 (with type/limit/offset filters) |
| `POST /wallets/virtual-accounts/topup` | CEO-0.2, EXP-0.4 |
| `POST /withdrawals` | EXP-8.2 |
| `GET /withdrawals` | EXP-8.1 |
| `DELETE /withdrawals/:id` | EXP-8.3 cancel pending |
| `GET /admin/analytics` | ADM-7.1 |
| `GET /admin/decisions` | ADM-1.1, ADM-1.2 |
| `GET /admin/disputes` | ADM-5.1 |
| `PUT /admin/disputes/:id/resolve` | ADM-5.3 |
| `GET /admin/engagements` | ADM-4.5 |
| `GET /admin/experts` | ADM-3.5 |
| `GET /admin/projects` | ADM-4.1 |
| `GET /admin/projects/:id` | ADM-4.2 |
| `PUT /admin/projects/:id/reopen` | ADM-4.4 |
| `PUT /admin/projects/:id/suspend-spec` | ADM-4.3 |
| `GET /admin/prompts` | ADM-6.4 |
| `PUT /admin/prompts/:stage` | ADM-6.4 |
| `DELETE /admin/prompts/:stage` | ADM-6.4 reset |
| `GET /admin/subscriptions/packages` | ADM-6.3 |
| `POST /admin/subscriptions/packages` | ADM-6.3 |
| `PUT /admin/subscriptions/packages/:id` | ADM-6.3 |
| `DELETE /admin/subscriptions/packages/:id` | ADM-6.3 |
| `GET /admin/transactions` | ADM-2.1 |
| `GET /admin/users` | ADM-3.1 |
| `GET /admin/users/:id` | ADM-3.2 |
| `PUT /admin/users/:id/reactivate` | ADM-3.4 |
| `PUT /admin/users/:id/suspend` | ADM-3.3 |
| `GET /admin/withdrawals` | ADM-2.3 |
| `PUT /admin/withdrawals/:id/complete` | ADM-2.3 |
| `PUT /admin/withdrawals/:id/fail` | ADM-2.3 |
| `POST /webhooks/sepay/ipn` | SYS-1.1, SYS-1.2, SYS-1.3 |
| `POST /webhooks/sepay/chi-ho-credit` | SYS-1.4 |
| `POST /webhooks/sepay/bank-linked` | SYS-1.5 |
| `GET /matching/:projectId/shortlist` | CEO-1.7 shortlist view |