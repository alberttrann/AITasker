# AITasker — Complete Scenario Paths & Actor Flows
**Schema version:** 40 tables · **API surface:** 223 NestJS endpoints + 13 FastAPI endpoints · **Screens:** 106 SRS UI screens  
**Purpose:** Authoritative reference for every screen journey, decision point, branch, and cross-actor handoff for all human actors and automated system processes. Serves as the ground truth for screen-by-screen flow design, integration testing, and QA.  
**Naming convention:** `{ACTOR}-{JOURNEY}.{SUB}` e.g., CEO-1.3 = CEO journey 1, sub-scenario 3.

---

## Table of Contents

1. [ACTOR 1: CLIENT / CEO](#actor-1-client--ceo)
2. [ACTOR 2: CLIENT / TECH_TEAM](#actor-2-client--tech_team)
3. [ACTOR 3: EXPERT](#actor-3-expert)
4. [ACTOR 4: ADMIN](#actor-4-admin)
5. [ACTOR 5: SYSTEM (Automated & S2S Processes)](#actor-5-system-automated--s2s-processes)
6. [CROSS-ACTOR HANDOFF & INTERACTION MATRIX](#cross-actor-handoff--interaction-matrix)
7. [APPENDIX: 223 API ENDPOINTS → SCREEN & SCENARIO PATH INDEX](#appendix-223-api-endpoints--screen--scenario-path-index)

---

# ACTOR 1: CLIENT / CEO

---

## CEO-0 · Auth, Account Setup & Subscription

### CEO-0.1 · Fresh Registration & Email OTP Verification
- **Entry:** Unauthenticated user opens Landing Page (Screen 01) and submits registration form (Screen 03).
- **APIs:** `POST /auth/register` → `POST /auth/verify-otp` (or `POST /auth/resend-otp`)
- **Request Payload:** `{ email, password, fullName, phone, roles: "CLIENT_CEO", selfTechnical: false }`
- **DB Written:** `users`, `client_profiles`, `wallets` (`available_balance = 0`), `virtual_accounts` (`WALLET_TOPUP`, permanent)
- **Password & Domain Rules (Server-Enforced):**
  - Minimum 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character.
  - Non-disposable domain with active MX records.
  - Email normalized (lowercased + trimmed).
- **Decision Points:**
  - *All rules pass* → 201 Created → `is_email_verified = false` → 6-digit OTP emailed → navigate to Screen 05.
  - *Password rule violations* → 400 Bad Request with array of all failing rule messages simultaneously.
  - *Disposable email* → 400 "Temporary or throwaway email addresses are not permitted."
  - *Email domain missing MX* → 400 "Email domain does not exist or cannot receive mail."
  - *Duplicate email* → 409 "Email already exists!"
  - *OTP submitted on Screen 05* → `POST /auth/verify-otp { email, otp }` → `is_email_verified = true` → returns access JWT + refresh JWT → redirect to CEO Dashboard (Screen 10).
  - *Expired OTP submitted* → 400 Bad Request → auto-generates fresh OTP and re-dispatches email.

### CEO-0.2 · Top Up Wallet via VietQR
- **Entry:** CEO opens CEO Wallet (Screen 17) or Top Up Wallet modal (Screen 19).
- **API:** `POST /wallets/virtual-accounts/topup { amount }`
- **Response:** `{ qrCodeUrl, paymentReference }` (using user's permanent `WALLET_TOPUP` virtual account).
- **Payment Execution:** CEO scans VietQR with banking app → executes transfer.
- **S2S Callback:** `POST /webhooks/sepay/ipn` (System-handled via HMAC signature verification).
- **Decision Points:**
  - *Exact amount transferred* → IPN handler credits `wallets.available_balance` → writes `TOP_UP` entry in `wallet_transactions` → emits `wallet:balance-updated` WebSocket event.
  - *SePay retry dispatch* → `wallet_tx_idempotency` unique index catches duplicate `reference_id` → returns HTTP 200 without double-crediting.

### CEO-0.3 · Activate Client Pro Subscription
- **Entry:** CEO opens Subscription Management (Screen 23) or Subscription Plans (Screen 24), or hits a Pro-gated feature guard.
- **Pre-flight API:** `GET /config/subscription-packages?role=CLIENT` → returns `[{ id, name, priceVnd: "500000", durationMonths: 6 }]` (dynamic pricing from DB).
- **Activation API:** `POST /subscriptions/activate { activeRole: "CLIENT", packageId }`
- **DB Written:** `wallets` (debited), `wallet_transactions` (`SUBSCRIPTION`), `users.subscription_client_tier = 'pro'`, `users.sub_client_expires_at`, `subscription_purchase_logs`
- **Decision Points:**
  - *`available_balance >= package.priceVnd`* → 201 `{ access_token, activatedPackage }` → JWT re-issued with `subscriptionClientTier: 'pro'` claim → Gated features unlocked.
  - *`available_balance < package.priceVnd`* → 422 `INSUFFICIENT_BALANCE` → prompt redirect to CEO-0.2 (Wallet Top-Up).
  - *Already Pro and unexpired* → 409 "Your subscription is still active."
  - *Role mismatch* → 422 Unprocessable Entity.
- **Status Verification:** `GET /subscriptions/status` returns `{ subscriptionTier, subscriptionExpires, isExpired }`.

### CEO-0.4 · Add Expert Role (Dual-Role Account)
- **Entry:** CEO opens Account Settings (Screen 15) → "Add Role".
- **API:** `POST /users/me/add-role { newRole: "EXPERT" }`
- **DB Written:** `users.roles = ["CLIENT_CEO", "EXPERT"]`, `expert_profiles` row created.
- **Outcome:** Role switcher control rendered in TopNav. Self-exclusion rule enforced globally (CEO cannot bid on own projects).
- **Role Switch API:** `PUT /auth/switch-role { activeRole: "EXPERT" }` → re-issues JWT with `activeRole: 'EXPERT'`.

### CEO-0.5 · Forgot & Reset Password
- **Entry:** CEO opens Login (Screen 02) → "Forgot Password" (Screen 06).
- **Initiate API:** `POST /auth/forgot-password { email }` → always returns generic 201 message (anti-enumeration). Dispatches reset email with 1-hour hex token link.
- **Token Pre-flight API:** `GET /auth/verify-reset-token/{token}` called on Screen 07 mount.
  - *Valid token* → 200 `{ valid: true }` → renders new password form.
  - *Expired/invalid token* → 400 Bad Request → displays error screen with request fresh link CTA.
- **Execution API:** `POST /auth/reset-password { token, newPassword }` → updates `password_hash`, clears `password_reset_token`, and sets `refresh_token_hash = NULL` (invalidating all sessions).

### CEO-0.6 · Change Password & Logout
- **Change Password API:** `PUT /auth/me/password { currentPassword, newPassword }` (Screen 15) → validates current password → updates hash → clears `refresh_token_hash` → user logged out across all devices.
- **Logout API:** `POST /auth/logout` → sets `refresh_token_hash = NULL` → FE clears localStorage tokens.

---

## CEO-1 · AI-Driven Project Elicitation & Publication

### CEO-1.0 · Session Initialization & Active Check
- **Entry:** CEO clicks "Start Elicitation" on Dashboard (Screen 10) or Projects Page (Screen 33).
- **Pro Check:** `GET /subscriptions/status` → if free tier, redirects to Subscription Plans (Screen 24).
- **Active Session Check:** `GET /elicitation/sessions/active`
  - *Active session exists* → CEO prompted to Resume or Abandon (`PUT /elicitation/sessions/:id/abandon`).
  - *No active session* → `POST /elicitation/sessions` creates session row (`state = 'IN_PROGRESS'`, `currentStage = 1`).

### CEO-1.1 · Stage 1 — Symptom Intake & Artifact Detection
- **Screen:** Stage 1 - Symptoms (Screen 27).
- **Draft Autosave:** `PATCH /elicitation/sessions/:id/draft { symptomTextDraft }` (saved on blur / 30s interval, no LLM call).
- **Submission API:** `PUT /elicitation/sessions/:id/stage1 { symptomText }`
- **LLM Optimization:** If `symptomText.trim() === stage1OriginalInput`, skips LLM call and returns cached payload.
- **FastAPI Call:** `POST /llm/elicitation/stage1-extract` with live `archetype_definitions` and `void_code_definitions` injected from DB.
- **DB Written:** `stage1_original_input`, `stage1_symptoms_json`, `void_list_json`, `recommended_archetypes_json`, `estimated_budget_vnd`, `critical_artifacts_json`. `currentStage → 2`.
- **UI Render:** Displays extracted symptoms, scale signals, detected void codes, and required critical technical artifacts (`criticalArtifactsJson`).

### CEO-1.2 · Stage 2 — Archetype Selection & Void Acknowledgment
- **Screen:** Stage 2 - Archetype (Screen 28).
- **Config Ingestion:** `GET /config/archetypes` and `GET /config/void-codes` fetched from CMS tables.
- **Submission API:** `PUT /elicitation/sessions/:id/stage2 { archetype, acknowledgedVoidCodes: [] }`
- **DB Written:** Locks `elicitation_sessions.archetype`; updates `void_list_json` with `injected = true` for acknowledged void codes. `currentStage → 3`.

### CEO-1.3 · Stage 3 — Behavioral Probe Questions
- **Screen:** Stage 3 - Probe Questions (Screen 29).
- **Questions Ingestion:** `GET /config/archetypes/{code}/probe-questions` fetched from DB ordered by `displayOrder`.
- **Submission API:** `PUT /elicitation/sessions/:id/stage3 { probeResponses: { "Question": "Answer" } }`
- **FastAPI Dual Evaluation:** Calls `/llm/elicitation/stage3-vagueness-check`. Evaluates vagueness and relevancy.
- **Decision Points:**
  - *Vague/irrelevant answers detected* → returns `vague_answers` and `irrelevant_answers` warning arrays → CEO urged to refine.
  - *All answers accepted* → `stage3_probes_json` persisted → `currentStage → 4`. Sets `scenarioType = 'SCENARIO_A'` (if self-technical) or `'SCENARIO_B'` (if non-technical).

### CEO-1.4A · Stage 4 — Tech Team Delegation Handoff (Scenario B)
- **Screen:** Stage 4B - Tech Team Invite (Screen 31).
- **API:** `POST /elicitation/sessions/:id/generate-handoff-link` with `{ email }`
- **Output:** Returns 72-hour signed handoff JWT link (`/register/handoff/:token`).
- **CEO Action:** Copies link and dispatches to Tech Lead. Session pauses at `currentStage = 4`.
- **Polling / Real-time:** CEO receives `notification:generic` WebSocket event when Tech Lead submits Stage 4 handoff (`PUT /elicitation/sessions/:id/stage4-handoff`). Session auto-advances to Stage 5.

### CEO-1.4B · Stage 4 — Self-Technical CEO Completion (Scenario A)
- **Screen:** Stage 4A - Technical Inputs (Screen 30).
- **Flag API:** `PUT /elicitation/sessions/:id/self-technical { selfTechnical: true }`
- **Draft Autosave:** `PATCH /elicitation/sessions/:id/stage4-draft { draftJson }`
- **AI Recommendation Assistant:** `POST /elicitation/sessions/:id/stage4-recommend` pre-fills recommended stack, integration method, and volume scale.
- **Submission API:** `PUT /elicitation/sessions/:id/stage4 { current_stack, data_available, latency_requirement, additional_requirement_1, technical_artifacts }`
- **DB Written:** `stage4_tech_inputs_json`, `currentStage → 5`. Returns `missingArtifacts` array (warning modal, non-blocking).

### CEO-1.5 · Stage 5 — AI Synthesis & Quality Gate
- **Screen:** Stage 5 - Spec Review & Handoff (Screen 32).
- **API:** `POST /elicitation/sessions/:id/stage5` (or `POST /elicitation/sessions/:id/retry-synthesis`)
- **FastAPI Execution:** Calls `/llm/elicitation/stage5-synthesize` (90s timeout). Injects live DB definitions for domains, seams, and archetypes.
- **Quality Gate Evaluation:**
  - **Pass Criteria:** `completeness_score >= 0.70` AND zero unresolved `HIGH` severity voids AND candidate match count ≥ 1.
  - *Gate Pass:* Atomic transaction creates `projects` row (`state = 'PUBLISHED'`), completes session (`state = 'COMPLETED'`), links Tech Team profile (`linked_project_id`), logs `ELICITATION_SYNTHESIS` decision, and triggers `project.published` event to seed `project_shortlist_cache`. Renders QualityGatePassed (Screen 32).
  - *Gate Fail:* Sets session `state = 'RETURNED'`, updates `currentStage` to return stage (via void mapping), logs `SPEC_AUTO_RETURN` decision. Renders QualityGateFailed (Screen 32). CEO can revert via `PUT /elicitation/sessions/:id/revert`.

---

## CEO-2 · Marketplace & Service Purchases

### CEO-2.1 · Browse & Purchase Expert Services
- **Browse API:** `GET /services` (Screen 39) — filterable by `serviceType`, `domains`, `seams`, price range.
- **Detail API:** `GET /services/{id}` (Screen 40) — displays scope, timeline, fixed price, expert aggregate rating.
- **Purchase API:** `POST /services/{id}/purchase` (Screen 41)
- **DB Written:** `engagements` (`type = 'SERVICE_PURCHASE'`, `state = 'PENDING'`), `virtual_accounts` (`entity_type = 'SERVICE'`, 24-hour expiry).
- **Execution:** CEO scans VietQR → completes bank transfer → SePay IPN webhook executes `handleServiceTopup` → auto-creates milestone #1, locks escrow, creates shadow project record, transitions engagement to `ACTIVE`. View purchases via `GET /services/me/purchases` (Screen 42).

---

## CEO-3 · Capability Bids & Commercial Negotiation

### CEO-3.1 · Review Incoming Bids
- **API:** `GET /bids?projectId={id}` (Screen 56) — lists all submitted bids for a published project.
- **Detail API:** `GET /bids/{id}` (Screen 57) — returns footprint alignment, approach summary, offer history, current offer terms, and Tech Team feedback.

### CEO-3.2 · Counter-Offer & Offer Negotiation
- **API:** `POST /bids/{id}/offers` (Screen 57)
- **Request Payload:** `{ respondingToVersion, milestones: [{ milestone_number, deliverable_statement, criteria, price_vnd, estimated_duration_days }] }`
- **DB Written:** Appends new offer to `capability_bids.conditional_pricing_json` envelope, increments `version_number`. If technical scope changed, resets `techStatus = 'PENDING'` and `state = 'TECH_REVIEW'`. Dispatches WebSocket alert to expert.

### CEO-3.3 · Accept Offer & Lock Contract Terms
- **API:** `POST /bids/{id}/offers/{offerId}/accept` OR `PUT /bids/{id}/ceo-decision { decision: 'APPROVED' }` (Screen 58)
- **DB Written (Serializable Transaction):**
  - Sets bid `state = 'SELECTED'`, `ceoStatus = 'APPROVED'`.
  - Instantiates contract `milestones` and `acceptance_criteria` rows.
  - Updates `projects.milestoneFrameworkJson` mirror.
  - Automatically declines all competing active bids and engagements on the project.
- **Outcome:** Milestone terms locked (`termsLocked = true`). Advances engagement to NDA phase.

---

## CEO-4 · Engagements, NDA & Milestone Execution

### CEO-4.1 · Sign NDA & Connect Engagement
- **API:** `PUT /engagements/{id}/accept-nda` (Screen 61)
- **DB Written:** `engagements.client_nda_accepted_at = now()`.
- **Outcome:** When Expert has also accepted (`expert_nda_accepted_at IS NOT NULL`), engagement state automatically transitions to `CONNECTED`. Unlocks Artifact B access for Tech Team and Expert.

### CEO-4.2 · Manage Contract Milestones
- **List API:** `GET /engagements/{id}/milestones` (Screen 64)
- **Create Single:** `POST /milestones` (Screen 65) — creates `DEFINED` milestone with criteria.
- **Bulk Initialize:** `POST /milestones/bulk` (Screen 65) — instantiates all framework milestones in one transaction.
- **Edit / Delete:** `PATCH /milestones/{id}` (Screen 66) / `DELETE /milestones/{id}` (permitted only while in `DEFINED` state and terms unlocked).

### CEO-4.3 · Fund Milestone into Escrow
- **API:** `PUT /milestones/{id}/fund` (Screen 67)
- **DB Written:** `virtual_accounts` (`entity_type = 'MILESTONE'`, 24h expiry), `milestones.state = 'AWAITING_PAYMENT'`.
- **Payment Execution:** CEO transfers VND via VietQR → SePay IPN webhook executes `handleMilestoneTopup` → atomically debits `wallets.available_balance`, credits `wallets.locked_balance`, creates `escrow_accounts` row (`status = 'HELD'`), advances `milestones.state = 'IN_PROGRESS'`, bulk-releases staged `paygated_documents`, and activates engagement (`state = 'ACTIVE'`).

### CEO-4.4 · Review Deliverables & Sign Off Criteria
- **APIs:** `GET /milestones/{id}/submissions/latest` (Screen 66) → `PUT /criteria/{id}/verify` (Screen 69) OR `PUT /criteria/{id}/revision` (Screen 69).
- **Sign-Off Logic:** CEO verifies criteria assigned to CEO role. When 100% of required criteria have `verifiedAt IS NOT NULL` and no disputes exist:
  - Executes atomic escrow release (`releaseMilestoneWithTx`): calculates platform fee, credits platform wallet, credits net payout to expert wallet, updates `escrow_accounts.status = 'RELEASED'`, sets `milestones.state = 'APPROVED'`.
  - If expert has a linked bank account, creates auto `MILESTONE_RELEASE` withdrawal request.
  - If all milestones complete, sets `engagements.state = 'CLOSED'`.

### CEO-4.5 · File Requirement Dispute
- **API:** `POST /disputes` (Screen 71)
- **DB Written:** Atomically sets `escrow_accounts.status = 'FROZEN'`, `milestones.state = 'DISPUTED'`, inserts `disputes` row (`state = 'LAYER_1_EVAL'`).
- **AI Arbitration:** Calls FastAPI `/llm/dispute-eval`. If confidence ≥ 0.80, executes `AUTO_RESOLVED` settlement (`EXPERT_WINS`, `CLIENT_WINS`, or `SPLIT`). If confidence < 0.80, sets `state = 'MANUAL_REVIEW'` and routes to Admin Dispute Monitor. View status via `GET /disputes/{id}` (Screen 72).

---

# ACTOR 2: CLIENT / TECH_TEAM

---

## TECH-0 · Handoff Registration & Project Linkage

### TECH-0.1 · Register & Claim Handoff Link
- **Entry:** Tech Team member receives handoff link (`/register/handoff/:token`).
- **APIs:** `POST /auth/register/handoff` (Screen 08) OR `POST /auth/claim-handoff`
- **DB Written:** Creates/updates user account with `clientSubtype = 'TECH_TEAM'`, sets `tech_team_profiles.linked_client_id = ceoId` and `linked_project_id`.
- **Outcome:** Tech Team member is permanently scoped to the CEO's project. Access to other projects is blocked with 403 Forbidden.

---

## TECH-1 · Technical Architecture Handoff (Stage 4)

### TECH-1.1 · Submit Stage 4 Technical Context
- **Screen:** Stage 4 Form - Tech Team (Screen 79).
- **APIs:** `PATCH /elicitation/sessions/{id}/stage4-draft` → `PUT /elicitation/sessions/{id}/stage4-handoff`
- **Main Flow:** Tech Lead fills stack, integration method, legacy volume, and critical artifact contents. Stores submitter ID in `_tech_team_user_id` and advances session to Stage 5. Emits real-time notification to CEO.

---

## TECH-2 · Technical Bid Review & Revision Requests

### TECH-2.1 · Review Capability Bid Scope
- **API:** `GET /bids/{id}` (Screen 59)
- **Security Scope:** Commercial pricing and offer negotiation history are hidden from Tech Team view. Tech Lead inspects footprint alignment, approach summary, and milestone deliverable statements.

### TECH-2.2 · Approve or Request Revision
- **API:** `PUT /bids/{id}/tech-review` (Screen 59 / 60)
- **Decision Points:**
  - *Approve:* Sets `techStatus = 'APPROVED'`. Unlocks CEO commercial review queue.
  - *Request Revision:* Sets `techStatus = 'REVISION_REQUESTED'`, `state = 'REVISION_REQUESTED'`, and records technical feedback notes. Expert is notified to submit an updated offer.

---

## TECH-3 · Technical Vault & Milestone Verification

### TECH-3.1 · Access Artifact B Vault
- **API:** `GET /projects/{id}/artifact-b` (Screen 63 / 83)
- **Preconditions:** Engagement state `CONNECTED` or `ACTIVE`; both NDAs accepted.
- **Main Flow:** Accesses deep technical specification, data schemas, API contracts, and integration methods.

### TECH-3.2 · Verify Technical Acceptance Criteria
- **APIs:** `GET /engagements/{id}/milestones` (Screen 80) → `GET /milestones/{id}` (Screen 81) → `PUT /criteria/{id}/verify` (Screen 82)
- **Main Flow:** Tech Lead inspects submitted deliverables and pay-gated documents (`GET /milestones/{id}/paygated-docs`). Signs off technical criteria (`techVerifiedAt = now()`). When all technical criteria pass on a `JOINT` milestone, passes sign-off to CEO for final approval.

### TECH-3.3 · Request Deliverable Revision
- **API:** `PUT /criteria/{id}/revision` (Screen 82)
- **Main Flow:** Rejects technical implementation with feedback note (`revisionNote`). Reverts milestone state to `IN_REVISION`.

---

## TECH-4 · Post-Engagement Technical Review

### TECH-4.1 · Submit Structured Technical Review
- **API:** `POST /reviews` (Screen 88)
- **Preconditions:** Engagement `state = 'CLOSED'`.
- **Main Flow:** Submits technical evaluation of expert performance. Requires structured signal JSON (`codeQualityRating`, `communicationRating`, `seamRatings`, `wouldRecommend`).

---

# ACTOR 3: EXPERT

---

## EXP-0 · Registration, Capability Profile & Setup

### EXP-0.1 · Register & Build Capability Profile
- **Registration API:** `POST /auth/register` with `roles: 'EXPERT'` (Screen 04).
- **Profile API:** `PUT /expert-profile/me` (Screen 43) — updates bio, engagement model, stack tags.
- **Domain Depths API:** `POST /expert-profile/domains` / `PUT /expert-profile/domains/sync` (Screen 44) — sets domain depth levels (`SURFACE`, `OPERATIONAL`, `DEEP`).
- **Seam Claims API:** `POST /expert-profile/seams` / `PUT /expert-profile/seams/sync` (Screen 45) — claims cross-domain seam capabilities (e.g. `A↔C`). Enforces `↔` arrow format.

### EXP-0.2 · Bank Account Linking & Wallet Setup
- **API:** `POST /bank-hub/initiate-link` → `PUT /bank-hub/link` (Screen 21)
- **Main Flow:** Registers bank account number (`bank_account_xid`) and account holder name. Enables automatic milestone release disbursements.

---

## EXP-1 · Project Invitations & Shortlist Discovery

### EXP-1.1 · View & Respond to Project Invitations
- **API:** `GET /invitations` (Screen 84) — returns invitations with project requirements and CEO company metadata.
- **Decline API:** `POST /invitations/{id}/decline` (Screen 84) — sets `status = 'DECLINED'`.
- **Acceptance:** Bidding on the invited project automatically marks invitation `ACCEPTED`.

---

## EXP-2 · Seam Verification (Tier 2 Upgrade)

### EXP-2.1 · Submit Portfolio Evidence
- **API:** `POST /portfolio-submissions` (Screen 46)
- **Gate:** `[Pro-E]` (Requires active Expert Pro subscription).
- **Preconditions:** Claim at `CLAIMED` tier; `lockedUntil <= now()`.
- **Main Flow:** Submits project description (min 50 chars) and key decision points (min 20 chars). Calls FastAPI `/llm/portfolio-eval`.
  - *Pass (Score ≥ 0.85):* Upgrades `expert_seam_claims.verification_tier = 'EVIDENCE_BACKED'`. (Screen 48).
  - *Fail:* Sets status `REJECTED`, increments `submissionCount`. On 5th failure, sets 30-day lockout (`lockedUntil = now + 30 days`).
- **History API:** `GET /portfolio-submissions` (Screen 47).

---

## EXP-3 · Service Listings & AI Generator

### EXP-3.1 · Create & Publish Marketplace Service
- **Creation API:** `POST /services` (Screen 50) — creates service listing in `DRAFT` state. If `useAiGenerator = true` (requires Expert Pro), calls FastAPI `/llm/service-generate` (Screen 51) using expert's claimed capabilities as context.
- **Publish API:** `PUT /services/{id}/publish` → sets `state = 'PUBLISHED'`.
- **Manage Listings:** `GET /services/me` (Screen 49), `PUT /services/{id}`, `DELETE /services/{id}`. View service orders via `GET /services/me/purchases` (Screen 52).

---

## EXP-4 · Bidding & Offer Negotiation

### EXP-4.1 · Submit Capability Bid
- **API:** `POST /bids` (Screen 54)
- **Gate:** `[Pro-E]` for Tier 2 and Tier 3 projects.
- **Preconditions:** Expert appears on project match shortlist or was invited.
- **Main Flow:** Submits footprint alignment, technical approach summary, and per-milestone pricing terms. Creates engagement (`PENDING`) and bid (`SUBMITTED`). Dispatches WebSocket alerts to CEO and Tech Team.

### EXP-4.2 · Negotiate Counter-Offers & Withdraw
- **Offers API:** `POST /bids/{id}/offers` (Screen 55) — submits revised terms in response to CEO counter-offer.
- **Accept Offer API:** `POST /bids/{id}/offers/{offerId}/accept` — accepts CEO offer, locking milestone contract terms.
- **Withdraw Bid API:** `DELETE /bids/{id}` — withdraws bid while in `SUBMITTED` or `TECH_REVIEW` state, setting engagement to `DECLINED`.

---

## EXP-5 · NDA Acceptance & Artifact B Access

### EXP-5.1 · Accept NDA & Connect
- **API:** `POST /engagements/{id}/connect` (Screen 62)
- **Main Flow:** Expert signs NDA (`expertNdaAcceptedAt = now()`). When CEO has also signed, engagement state becomes `CONNECTED`. Prompts bank account setup if unlinked.

### EXP-5.2 · Access Technical Vault (Artifact B)
- **API:** `GET /projects/{id}/artifact-b` (Screen 63)
- **Main Flow:** Accesses confidential technical architecture, schema URLs, and integration contracts.

---

## EXP-6 · Milestone Execution, DoD & Submissions

### EXP-6.1 · Stage Pay-Gated Documents
- **API:** `POST /milestones/{id}/paygated-docs` OR `/bulk` (Screen 76)
- **Main Flow:** Stages technical deliverable document URLs (`releaseState = 'STAGED'`). Auto-released to Tech Team when milestone escrow is funded.

### EXP-6.2 · Execute Definition of Done Checklist
- **APIs:** `GET /milestones/{id}/dod` (Screen 74) → `PUT /milestones/{id}/dod/{itemId}` (Screen 74)
- **Main Flow:** Marks required DoD checklist items `COMPLETED` (with completion notes). Required items cannot be marked `NOT_APPLICABLE`.

### EXP-6.3 · Submit Deliverables
- **API:** `POST /milestones/{id}/submit` (Screen 75)
- **Guard:** 100% of required DoD items must be `COMPLETED`.
- **Main Flow:** Submits work description and file URLs. Transitions milestone state to `SUBMITTED`. Notifies reviewers via Socket.io.
- **Retract API:** `DELETE /milestones/{id}/submissions/latest` — retracts submission while in `SUBMITTED` state, reverting milestone to `IN_PROGRESS`.

### EXP-6.4 · Withdraw Earnings
- **API:** `POST /withdrawals` (Screen 22)
- **Main Flow:** Requests cash-out of available wallet balance to linked bank account. Status starts at `PENDING`. View history via `GET /withdrawals`. Cancel pending requests via `DELETE /withdrawals/{id}`.

---

# ACTOR 4: ADMIN

---

## ADM-1 · Platform Integrity & AI Decision Audits

### ADM-1.1 · Audit Platform AI Decisions
- **API:** `GET /admin/decisions` (Screen 103)
- **Main Flow:** Filterable audit trail of all LLM evaluation logs: `ELICITATION_SYNTHESIS`, `SPEC_AUTO_RETURN`, `SEAM_TIER_UPGRADE`, `PORTFOLIO_EVAL`, `DISPUTE_L1_EVAL`, `CRITERION_QUALITY_GATE`.

---

## ADM-2 · Financial Ledger & Withdrawal Management

### ADM-2.1 · Audit Wallet Transactions
- **API:** `GET /admin/transactions` (Screen 95)
- **Main Flow:** Views immutable double-entry ledger across all platform wallets. Filterable by transaction type or user ID.

### ADM-2.2 · Process Expert Payout Requests
- **Queue API:** `GET /admin/withdrawals` (Screen 96)
- **Complete Payout API:** `PUT /admin/withdrawals/{id}/complete` — marks payout `COMPLETED`. If linked to milestone release, advances milestone state to `RELEASED`.
- **Fail Payout API:** `PUT /admin/withdrawals/{id}/fail` — marks payout `FAILED` and atomically restores funds to expert's `available_balance` with a `WITHDRAWAL_REFUND` ledger log.

### ADM-2.3 · Configure Platform Settings
- **API:** `GET /admin/platform-settings` / `PUT /admin/platform-settings` (Screen 97)
- **Main Flow:** Configures global platform fee percentage (`platform_fee_pct` in `[0, 1]`) and platform fee destination wallet ID.

---

## ADM-3 · User Moderation & Oversight

### ADM-3.1 · User Account Control
- **List Users API:** `GET /admin/users` (Screen 92) / `GET /admin/users/{id}`
- **Suspend API:** `PUT /admin/users/{id}/suspend` — sets `is_active = false`, blocking user login.
- **Reactivate API:** `PUT /admin/users/{id}/reactivate` — restores account access.
- **List Experts API:** `GET /admin/experts` (Screen 106) — views expert verification tiers and capability depths.

---

## ADM-4 · Project & Engagement Oversight

### ADM-4.1 · Project Spec Emergency Suspension
- **API:** `PUT /admin/projects/{id}/suspend-spec` (Screen 104)
- **Main Flow:** Suspends a published project specification (`state = 'SUSPENDED'`), removing it from marketplace and matching views. Reopen via `PUT /admin/projects/{id}/reopen`.
- **List Engagements API:** `GET /admin/engagements` (Screen 105).

---

## ADM-5 · 2-Layer Dispute Arbitration

### ADM-5.1 · Resolve Escalated Disputes
- **Dispute Queue API:** `GET /admin/disputes?state=MANUAL_REVIEW` (Screen 93)
- **Dispute Detail API:** `GET /disputes/{id}` (Screen 94) — inspects criterion, deliverable description, AI Layer 1 confidence score, and reasoning notes.
- **Resolution API:** `PUT /admin/disputes/{id}/resolve` (Screen 94)
- **Decision Options:**
  - `EXPERT_WINS` → releases escrow payment to expert.
  - `CLIENT_WINS` → refunds escrow payment to client available balance.
  - `SPLIT` → divides escrow payment 50/50 between client and expert.
- **Outcome:** Sets `disputes.state = 'RESOLVED'`, advances `milestones.state = 'APPROVED'`, and logs decision.

---

## ADM-6 · CMS & Configuration Management

### ADM-6.1 · Manage Taxonomy Definitions
- **Domains CMS:** `/admin/config/domains` (Screen 99) — CRUD for AI domains (A–F).
- **Seams CMS:** `/admin/config/seams` (Screen 99) — CRUD for cross-domain seams (`A↔C`). Enforces `(domainCode1, domainCode2)` unique constraint.
- **Archetypes CMS:** `/admin/config/archetypes` (Screen 100) — CRUD for project archetypes (1–6).
- **Probe Questions CMS:** `/admin/config/probe-questions` (Screen 100) — CRUD for Stage 3 probe question banks.
- **Void Codes CMS:** `/admin/config/void-codes` (Screen 101) — CRUD for elicitation gap taxonomy and severity mapping.

### ADM-6.2 · Hot-Reload Prompt Templates
- **APIs:** `GET/PUT/DELETE /admin/prompts/{stage}` (Screen 102)
- **Main Flow:** Upserts Jinja2 system prompt templates in `prompt_templates` table. FastAPI fetches DB templates via `GET /internal/prompts/{stage}` with a 60-second TTL cache, enabling prompt hot-reloading without service redeployment. Deleting a template reverts system to on-disk `.txt` defaults.

### ADM-6.3 · Manage Subscription Packages
- **APIs:** `GET/POST/PUT/DELETE /admin/subscriptions/packages` (Screen 98)
- **Main Flow:** CRUD management for Client and Expert subscription plans. Hard-deletion is blocked if purchase history exists (returns 422); package must be deactivated (`isActive = false`) instead.

---

# ACTOR 5: SYSTEM (Automated & S2S Processes)

---

## SYS-1 · Payment Processing (SePay IPN Webhooks)

### SYS-1.1 · Inbound Wallet Top-Up IPN
- **Trigger:** `POST /webhooks/sepay/ipn` with `entityType = 'WALLET_TOPUP'`.
- **Sequence:** Verifies HMAC signature → checks transaction reference idempotency → credits `wallets.available_balance` → writes `TOP_UP` ledger entry → emits `wallet:balance-updated` WebSocket event.

### SYS-1.2 · Inbound Milestone Escrow IPN
- **Trigger:** `POST /webhooks/sepay/ipn` with `entityType = 'MILESTONE'`.
- **Sequence:** Verifies HMAC signature → validates exact transfer amount (`amount == fixed_amount`) → debits client `available_balance`, credits client `locked_balance` → creates `escrow_accounts` row (`status = 'HELD'`) → advances `milestones.state = 'IN_PROGRESS'` → sets `virtual_accounts.status = 'USED'` → bulk-releases staged `paygated_documents` (`releaseState = 'RELEASED'`) → activates engagement (`state = 'ACTIVE'`) → emits `payment:confirmed` WebSocket event.

### SYS-1.3 · Direct Service Purchase IPN
- **Trigger:** `POST /webhooks/sepay/ipn` with `entityType = 'SERVICE'`.
- **Sequence:** Verifies HMAC signature → creates milestone #1 with default criterion → locks escrow → creates shadow project record → sets engagement `state = 'ACTIVE'` → sets VA `status = 'USED'` → emits notification events to both parties.

---

## SYS-2 · Real-Time Gateway & Event Dispatcher

### SYS-2.1 · WebSocket Event Dispatching & Notification Persistence
- **Trigger:** Internal `eventEmitter.emit('socket.broadcast', { userId, event, payload })`.
- **Sequence:** Routes payload to user's Socket.io room in real time. If `event == 'notification:generic'`, persists notification record into **`notifications`** table for cross-session history retention.

---

# CROSS-ACTOR HANDOFF & INTERACTION MATRIX

| Triggering Actor | Action / Event | Target Actor | Real-Time Socket Event | System State Effect | Deep-Link Route |
|---|---|---|---|---|---|
| **CEO** | Generates handoff invite link | **Tech Team** | — | `elicitation_sessions.handoffTokenJti` set | `/register/handoff/:token` |
| **Tech Team** | Submits Stage 4 technical context | **CEO** | `notification:generic` | `elicitation_sessions.currentStage = 5` | `/ceo/projects/elicitation` |
| **CEO** | Publishes project specification | **Tech Team** | `notification:generic` | `projects.state = 'PUBLISHED'`, profile linked | `/tech-team/projects/:id` |
| **CEO** | Invites Expert to project | **Expert** | `notification:generic` | `invitations` row created (`status = 'PENDING'`) | `/expert/invitations` |
| **Expert** | Submits capability bid | **CEO & Tech Team** | `notification:generic`, `bid:updated` | `capability_bids.state = 'SUBMITTED'` | `/ceo/projects/:id/bids` |
| **Tech Team** | Approves technical bid scope | **CEO** | `notification:generic`, `bid:updated` | `capability_bids.techStatus = 'APPROVED'` | `/ceo/projects/:id/bids/:bidId` |
| **Tech Team** | Requests technical bid revision | **Expert** | `notification:generic`, `bid:updated` | `capability_bids.techStatus = 'REVISION_REQUESTED'` | `/expert/engagements/:id/bid` |
| **CEO** | Accepts bid offer | **Expert** | `notification:generic`, `bid:updated` | `capability_bids.state = 'SELECTED'`, terms locked | `/expert/engagements/:id/nda` |
| **CEO & Expert** | Both sign platform NDA | **CEO & Expert** | `notification:generic` | `engagements.state = 'CONNECTED'` | `/ceo/engagements/:id/milestones` |
| **CEO** | Funds milestone via VietQR | **Expert & Tech Team** | `payment:confirmed`, `milestone:updated` | `milestones.state = 'IN_PROGRESS'`, escrow locked | `/expert/engagements/:id/milestones/:mId` |
| **Expert** | Submits milestone deliverables | **Reviewer (CEO/Tech)** | `milestone:updated` | `milestones.state = 'SUBMITTED'` | `/ceo/engagements/:id/milestones/:mId` |
| **Reviewer** | Requests criterion revision | **Expert** | `milestone:updated` | `milestones.state = 'IN_REVISION'` | `/expert/engagements/:id/milestones/:mId` |
| **Reviewer** | Verifies final milestone criterion | **Expert** | `milestone:updated` | `milestones.state = 'APPROVED'`, escrow released | `/expert/wallet` |
| **CEO / Expert** | Files requirement dispute | **Opposing Party & Admin** | `dispute:filed` | `escrow_accounts.status = 'FROZEN'`, `milestones.state = 'DISPUTED'` | `/admin/disputes/:id` |
| **Admin** | Manually resolves dispute | **CEO & Expert** | `dispute:resolved` | `disputes.state = 'RESOLVED'`, escrow settled | `/ceo/engagements/:id/milestones` |

---

# AITasker — Complete Scenario Paths & Actor Flows
**Schema version:** 40 tables · **API surface:** 223 NestJS endpoints + 13 FastAPI endpoints · **Screens:** 106 SRS UI screens  
**Purpose:** Authoritative reference for every screen journey, decision point, branch, and cross-actor handoff for all human actors and automated system processes. Serves as the ground truth for screen-by-screen flow design, integration testing, and QA.  
**Naming convention:** `{ACTOR}-{JOURNEY}.{SUB}` e.g., CEO-1.3 = CEO journey 1, sub-scenario 3.

---

## Table of Contents

1. [ACTOR 1: CLIENT / CEO](#actor-1-client--ceo)
2. [ACTOR 2: CLIENT / TECH_TEAM](#actor-2-client--tech_team)
3. [ACTOR 3: EXPERT](#actor-3-expert)
4. [ACTOR 4: ADMIN](#actor-4-admin)
5. [ACTOR 5: SYSTEM (Automated & S2S Processes)](#actor-5-system-automated--s2s-processes)
6. [CROSS-ACTOR HANDOFF & INTERACTION MATRIX](#cross-actor-handoff--interaction-matrix)
7. [APPENDIX: 223 API ENDPOINTS → SCREEN & SCENARIO PATH INDEX](#appendix-223-api-endpoints--screen--scenario-path-index)

---

# ACTOR 1: CLIENT / CEO

---

## CEO-0 · Auth, Account Setup & Subscription

### CEO-0.1 · Fresh Registration & Email OTP Verification
- **Entry:** Unauthenticated user opens Landing Page (Screen 01) and submits registration form (Screen 03).
- **APIs:** `POST /auth/register` → `POST /auth/verify-otp` (or `POST /auth/resend-otp`)
- **Request Payload:** `{ email, password, fullName, phone, roles: "CLIENT_CEO", selfTechnical: false }`
- **DB Written:** `users`, `client_profiles`, `wallets` (`available_balance = 0`), `virtual_accounts` (`WALLET_TOPUP`, permanent)
- **Password & Domain Rules (Server-Enforced):**
  - Minimum 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character.
  - Non-disposable domain with active MX records.
  - Email normalized (lowercased + trimmed).
- **Decision Points:**
  - *All rules pass* → 201 Created → `is_email_verified = false` → 6-digit OTP emailed → navigate to Screen 05.
  - *Password rule violations* → 400 Bad Request with array of all failing rule messages simultaneously.
  - *Disposable email* → 400 "Temporary or throwaway email addresses are not permitted."
  - *Email domain missing MX* → 400 "Email domain does not exist or cannot receive mail."
  - *Duplicate email* → 409 "Email already exists!"
  - *OTP submitted on Screen 05* → `POST /auth/verify-otp { email, otp }` → `is_email_verified = true` → returns access JWT + refresh JWT → redirect to CEO Dashboard (Screen 10).
  - *Expired OTP submitted* → 400 Bad Request → auto-generates fresh OTP and re-dispatches email.

### CEO-0.2 · Top Up Wallet via VietQR
- **Entry:** CEO opens CEO Wallet (Screen 17) or Top Up Wallet modal (Screen 19).
- **API:** `POST /wallets/virtual-accounts/topup { amount }`
- **Response:** `{ qrCodeUrl, paymentReference }` (using user's permanent `WALLET_TOPUP` virtual account).
- **Payment Execution:** CEO scans VietQR with banking app → executes transfer.
- **S2S Callback:** `POST /webhooks/sepay/ipn` (System-handled via HMAC signature verification).
- **Decision Points:**
  - *Exact amount transferred* → IPN handler credits `wallets.available_balance` → writes `TOP_UP` entry in `wallet_transactions` → emits `wallet:balance-updated` WebSocket event.
  - *SePay retry dispatch* → `wallet_tx_idempotency` unique index catches duplicate `reference_id` → returns HTTP 200 without double-crediting.

### CEO-0.3 · Activate Client Pro Subscription
- **Entry:** CEO opens Subscription Management (Screen 23) or Subscription Plans (Screen 24), or hits a Pro-gated feature guard.
- **Pre-flight API:** `GET /config/subscription-packages?role=CLIENT` → returns `[{ id, name, priceVnd: "500000", durationMonths: 6 }]` (dynamic pricing from DB).
- **Activation API:** `POST /subscriptions/activate { activeRole: "CLIENT", packageId }`
- **DB Written:** `wallets` (debited), `wallet_transactions` (`SUBSCRIPTION`), `users.subscription_client_tier = 'pro'`, `users.sub_client_expires_at`, `subscription_purchase_logs`
- **Decision Points:**
  - *`available_balance >= package.priceVnd`* → 201 `{ access_token, activatedPackage }` → JWT re-issued with `subscriptionClientTier: 'pro'` claim → Gated features unlocked.
  - *`available_balance < package.priceVnd`* → 422 `INSUFFICIENT_BALANCE` → prompt redirect to CEO-0.2 (Wallet Top-Up).
  - *Already Pro and unexpired* → 409 "Your subscription is still active."
  - *Role mismatch* → 422 Unprocessable Entity.
- **Status Verification:** `GET /subscriptions/status` returns `{ subscriptionTier, subscriptionExpires, isExpired }`.

### CEO-0.4 · Add Expert Role (Dual-Role Account)
- **Entry:** CEO opens Account Settings (Screen 15) → "Add Role".
- **API:** `POST /users/me/add-role { newRole: "EXPERT" }`
- **DB Written:** `users.roles = ["CLIENT_CEO", "EXPERT"]`, `expert_profiles` row created.
- **Outcome:** Role switcher control rendered in TopNav. Self-exclusion rule enforced globally (CEO cannot bid on own projects).
- **Role Switch API:** `PUT /auth/switch-role { activeRole: "EXPERT" }` → re-issues JWT with `activeRole: 'EXPERT'`.

### CEO-0.5 · Forgot & Reset Password
- **Entry:** CEO opens Login (Screen 02) → "Forgot Password" (Screen 06).
- **Initiate API:** `POST /auth/forgot-password { email }` → always returns generic 201 message (anti-enumeration). Dispatches reset email with 1-hour hex token link.
- **Token Pre-flight API:** `GET /auth/verify-reset-token/{token}` called on Screen 07 mount.
  - *Valid token* → 200 `{ valid: true }` → renders new password form.
  - *Expired/invalid token* → 400 Bad Request → displays error screen with request fresh link CTA.
- **Execution API:** `POST /auth/reset-password { token, newPassword }` → updates `password_hash`, clears `password_reset_token`, and sets `refresh_token_hash = NULL` (invalidating all sessions).

### CEO-0.6 · Change Password & Logout
- **Change Password API:** `PUT /auth/me/password { currentPassword, newPassword }` (Screen 15) → validates current password → updates hash → clears `refresh_token_hash` → user logged out across all devices.
- **Logout API:** `POST /auth/logout` → sets `refresh_token_hash = NULL` → FE clears localStorage tokens.

---

## CEO-1 · AI-Driven Project Elicitation & Publication

### CEO-1.0 · Session Initialization & Active Check
- **Entry:** CEO clicks "Start Elicitation" on Dashboard (Screen 10) or Projects Page (Screen 33).
- **Pro Check:** `GET /subscriptions/status` → if free tier, redirects to Subscription Plans (Screen 24).
- **Active Session Check:** `GET /elicitation/sessions/active`
  - *Active session exists* → CEO prompted to Resume or Abandon (`PUT /elicitation/sessions/:id/abandon`).
  - *No active session* → `POST /elicitation/sessions` creates session row (`state = 'IN_PROGRESS'`, `currentStage = 1`).

### CEO-1.1 · Stage 1 — Symptom Intake & Artifact Detection
- **Screen:** Stage 1 - Symptoms (Screen 27).
- **Draft Autosave:** `PATCH /elicitation/sessions/:id/draft { symptomTextDraft }` (saved on blur / 30s interval, no LLM call).
- **Submission API:** `PUT /elicitation/sessions/:id/stage1 { symptomText }`
- **LLM Optimization:** If `symptomText.trim() === stage1OriginalInput`, skips LLM call and returns cached payload.
- **FastAPI Call:** `POST /llm/elicitation/stage1-extract` with live `archetype_definitions` and `void_code_definitions` injected from DB.
- **DB Written:** `stage1_original_input`, `stage1_symptoms_json`, `void_list_json`, `recommended_archetypes_json`, `estimated_budget_vnd`, `critical_artifacts_json`. `currentStage → 2`.
- **UI Render:** Displays extracted symptoms, scale signals, detected void codes, and required critical technical artifacts (`criticalArtifactsJson`).

### CEO-1.2 · Stage 2 — Archetype Selection & Void Acknowledgment
- **Screen:** Stage 2 - Archetype (Screen 28).
- **Config Ingestion:** `GET /config/archetypes` and `GET /config/void-codes` fetched from CMS tables.
- **Submission API:** `PUT /elicitation/sessions/:id/stage2 { archetype, acknowledgedVoidCodes: [] }`
- **DB Written:** Locks `elicitation_sessions.archetype`; updates `void_list_json` with `injected = true` for acknowledged void codes. `currentStage → 3`.

### CEO-1.3 · Stage 3 — Behavioral Probe Questions
- **Screen:** Stage 3 - Probe Questions (Screen 29).
- **Questions Ingestion:** `GET /config/archetypes/{code}/probe-questions` fetched from DB ordered by `displayOrder`.
- **Submission API:** `PUT /elicitation/sessions/:id/stage3 { probeResponses: { "Question": "Answer" } }`
- **FastAPI Dual Evaluation:** Calls `/llm/elicitation/stage3-vagueness-check`. Evaluates vagueness and relevancy.
- **Decision Points:**
  - *Vague/irrelevant answers detected* → returns `vague_answers` and `irrelevant_answers` warning arrays → CEO urged to refine.
  - *All answers accepted* → `stage3_probes_json` persisted → `currentStage → 4`. Sets `scenarioType = 'SCENARIO_A'` (if self-technical) or `'SCENARIO_B'` (if non-technical).

### CEO-1.4A · Stage 4 — Tech Team Delegation Handoff (Scenario B)
- **Screen:** Stage 4B - Tech Team Invite (Screen 31).
- **API:** `POST /elicitation/sessions/:id/generate-handoff-link` with `{ email }`
- **Output:** Returns 72-hour signed handoff JWT link (`/register/handoff/:token`).
- **CEO Action:** Copies link and dispatches to Tech Lead. Session pauses at `currentStage = 4`.
- **Polling / Real-time:** CEO receives `notification:generic` WebSocket event when Tech Lead submits Stage 4 handoff (`PUT /elicitation/sessions/:id/stage4-handoff`). Session auto-advances to Stage 5.

### CEO-1.4B · Stage 4 — Self-Technical CEO Completion (Scenario A)
- **Screen:** Stage 4A - Technical Inputs (Screen 30).
- **Flag API:** `PUT /elicitation/sessions/:id/self-technical { selfTechnical: true }`
- **Draft Autosave:** `PATCH /elicitation/sessions/:id/stage4-draft { draftJson }`
- **AI Recommendation Assistant:** `POST /elicitation/sessions/:id/stage4-recommend` pre-fills recommended stack, integration method, and volume scale.
- **Submission API:** `PUT /elicitation/sessions/:id/stage4 { current_stack, data_available, latency_requirement, additional_requirement_1, technical_artifacts }`
- **DB Written:** `stage4_tech_inputs_json`, `currentStage → 5`. Returns `missingArtifacts` array (warning modal, non-blocking).

### CEO-1.5 · Stage 5 — AI Synthesis & Quality Gate
- **Screen:** Stage 5 - Spec Review & Handoff (Screen 32).
- **API:** `POST /elicitation/sessions/:id/stage5` (or `POST /elicitation/sessions/:id/retry-synthesis`)
- **FastAPI Execution:** Calls `/llm/elicitation/stage5-synthesize` (90s timeout). Injects live DB definitions for domains, seams, and archetypes.
- **Quality Gate Evaluation:**
  - **Pass Criteria:** `completeness_score >= 0.70` AND zero unresolved `HIGH` severity voids AND candidate match count ≥ 1.
  - *Gate Pass:* Atomic transaction creates `projects` row (`state = 'PUBLISHED'`), completes session (`state = 'COMPLETED'`), links Tech Team profile (`linked_project_id`), logs `ELICITATION_SYNTHESIS` decision, and triggers `project.published` event to seed `project_shortlist_cache`. Renders QualityGatePassed (Screen 32).
  - *Gate Fail:* Sets session `state = 'RETURNED'`, updates `currentStage` to return stage (via void mapping), logs `SPEC_AUTO_RETURN` decision. Renders QualityGateFailed (Screen 32). CEO can revert via `PUT /elicitation/sessions/:id/revert`.

---

## CEO-2 · Marketplace & Service Purchases

### CEO-2.1 · Browse & Purchase Expert Services
- **Browse API:** `GET /services` (Screen 39) — filterable by `serviceType`, `domains`, `seams`, price range.
- **Detail API:** `GET /services/{id}` (Screen 40) — displays scope, timeline, fixed price, expert aggregate rating.
- **Purchase API:** `POST /services/{id}/purchase` (Screen 41)
- **DB Written:** `engagements` (`type = 'SERVICE_PURCHASE'`, `state = 'PENDING'`), `virtual_accounts` (`entity_type = 'SERVICE'`, 24-hour expiry).
- **Execution:** CEO scans VietQR → completes bank transfer → SePay IPN webhook executes `handleServiceTopup` → auto-creates milestone #1, locks escrow, creates shadow project record, transitions engagement to `ACTIVE`. View purchases via `GET /services/me/purchases` (Screen 42).

---

## CEO-3 · Capability Bids & Commercial Negotiation

### CEO-3.1 · Review Incoming Bids
- **API:** `GET /bids?projectId={id}` (Screen 56) — lists all submitted bids for a published project.
- **Detail API:** `GET /bids/{id}` (Screen 57) — returns footprint alignment, approach summary, offer history, current offer terms, and Tech Team feedback.

### CEO-3.2 · Counter-Offer & Offer Negotiation
- **API:** `POST /bids/{id}/offers` (Screen 57)
- **Request Payload:** `{ respondingToVersion, milestones: [{ milestone_number, deliverable_statement, criteria, price_vnd, estimated_duration_days }] }`
- **DB Written:** Appends new offer to `capability_bids.conditional_pricing_json` envelope, increments `version_number`. If technical scope changed, resets `techStatus = 'PENDING'` and `state = 'TECH_REVIEW'`. Dispatches WebSocket alert to expert.

### CEO-3.3 · Accept Offer & Lock Contract Terms
- **API:** `POST /bids/{id}/offers/{offerId}/accept` OR `PUT /bids/{id}/ceo-decision { decision: 'APPROVED' }` (Screen 58)
- **DB Written (Serializable Transaction):**
  - Sets bid `state = 'SELECTED'`, `ceoStatus = 'APPROVED'`.
  - Instantiates contract `milestones` and `acceptance_criteria` rows.
  - Updates `projects.milestoneFrameworkJson` mirror.
  - Automatically declines all competing active bids and engagements on the project.
- **Outcome:** Milestone terms locked (`termsLocked = true`). Advances engagement to NDA phase.

---

## CEO-4 · Engagements, NDA & Milestone Execution

### CEO-4.1 · Sign NDA & Connect Engagement
- **API:** `PUT /engagements/{id}/accept-nda` (Screen 61)
- **DB Written:** `engagements.client_nda_accepted_at = now()`.
- **Outcome:** When Expert has also accepted (`expert_nda_accepted_at IS NOT NULL`), engagement state automatically transitions to `CONNECTED`. Unlocks Artifact B access for Tech Team and Expert.

### CEO-4.2 · Manage Contract Milestones
- **List API:** `GET /engagements/{id}/milestones` (Screen 64)
- **Create Single:** `POST /milestones` (Screen 65) — creates `DEFINED` milestone with criteria.
- **Bulk Initialize:** `POST /milestones/bulk` (Screen 65) — instantiates all framework milestones in one transaction.
- **Edit / Delete:** `PATCH /milestones/{id}` (Screen 66) / `DELETE /milestones/{id}` (permitted only while in `DEFINED` state and terms unlocked).

### CEO-4.3 · Fund Milestone into Escrow
- **API:** `PUT /milestones/{id}/fund` (Screen 67)
- **DB Written:** `virtual_accounts` (`entity_type = 'MILESTONE'`, 24h expiry), `milestones.state = 'AWAITING_PAYMENT'`.
- **Payment Execution:** CEO transfers VND via VietQR → SePay IPN webhook executes `handleMilestoneTopup` → atomically debits `wallets.available_balance`, credits `wallets.locked_balance`, creates `escrow_accounts` row (`status = 'HELD'`), advances `milestones.state = 'IN_PROGRESS'`, bulk-releases staged `paygated_documents`, and activates engagement (`state = 'ACTIVE'`).

### CEO-4.4 · Review Deliverables & Sign Off Criteria
- **APIs:** `GET /milestones/{id}/submissions/latest` (Screen 66) → `PUT /criteria/{id}/verify` (Screen 69) OR `PUT /criteria/{id}/revision` (Screen 69).
- **Sign-Off Logic:** CEO verifies criteria assigned to CEO role. When 100% of required criteria have `verifiedAt IS NOT NULL` and no disputes exist:
  - Executes atomic escrow release (`releaseMilestoneWithTx`): calculates platform fee, credits platform wallet, credits net payout to expert wallet, updates `escrow_accounts.status = 'RELEASED'`, sets `milestones.state = 'APPROVED'`.
  - If expert has a linked bank account, creates auto `MILESTONE_RELEASE` withdrawal request.
  - If all milestones complete, sets `engagements.state = 'CLOSED'`.

### CEO-4.5 · File Requirement Dispute
- **API:** `POST /disputes` (Screen 71)
- **DB Written:** Atomically sets `escrow_accounts.status = 'FROZEN'`, `milestones.state = 'DISPUTED'`, inserts `disputes` row (`state = 'LAYER_1_EVAL'`).
- **AI Arbitration:** Calls FastAPI `/llm/dispute-eval`. If confidence ≥ 0.80, executes `AUTO_RESOLVED` settlement (`EXPERT_WINS`, `CLIENT_WINS`, or `SPLIT`). If confidence < 0.80, sets `state = 'MANUAL_REVIEW'` and routes to Admin Dispute Monitor. View status via `GET /disputes/{id}` (Screen 72).

---

# ACTOR 2: CLIENT / TECH_TEAM

---

## TECH-0 · Handoff Registration & Project Linkage

### TECH-0.1 · Register & Claim Handoff Link
- **Entry:** Tech Team member receives handoff link (`/register/handoff/:token`).
- **APIs:** `POST /auth/register/handoff` (Screen 08) OR `POST /auth/claim-handoff`
- **DB Written:** Creates/updates user account with `clientSubtype = 'TECH_TEAM'`, sets `tech_team_profiles.linked_client_id = ceoId` and `linked_project_id`.
- **Outcome:** Tech Team member is permanently scoped to the CEO's project. Access to other projects is blocked with 403 Forbidden.

---

## TECH-1 · Technical Architecture Handoff (Stage 4)

### TECH-1.1 · Submit Stage 4 Technical Context
- **Screen:** Stage 4 Form - Tech Team (Screen 79).
- **APIs:** `PATCH /elicitation/sessions/{id}/stage4-draft` → `PUT /elicitation/sessions/{id}/stage4-handoff`
- **Main Flow:** Tech Lead fills stack, integration method, legacy volume, and critical artifact contents. Stores submitter ID in `_tech_team_user_id` and advances session to Stage 5. Emits real-time notification to CEO.

---

## TECH-2 · Technical Bid Review & Revision Requests

### TECH-2.1 · Review Capability Bid Scope
- **API:** `GET /bids/{id}` (Screen 59)
- **Security Scope:** Commercial pricing and offer negotiation history are hidden from Tech Team view. Tech Lead inspects footprint alignment, approach summary, and milestone deliverable statements.

### TECH-2.2 · Approve or Request Revision
- **API:** `PUT /bids/{id}/tech-review` (Screen 59 / 60)
- **Decision Points:**
  - *Approve:* Sets `techStatus = 'APPROVED'`. Unlocks CEO commercial review queue.
  - *Request Revision:* Sets `techStatus = 'REVISION_REQUESTED'`, `state = 'REVISION_REQUESTED'`, and records technical feedback notes. Expert is notified to submit an updated offer.

---

## TECH-3 · Technical Vault & Milestone Verification

### TECH-3.1 · Access Artifact B Vault
- **API:** `GET /projects/{id}/artifact-b` (Screen 63 / 83)
- **Preconditions:** Engagement state `CONNECTED` or `ACTIVE`; both NDAs accepted.
- **Main Flow:** Accesses deep technical specification, data schemas, API contracts, and integration methods.

### TECH-3.2 · Verify Technical Acceptance Criteria
- **APIs:** `GET /engagements/{id}/milestones` (Screen 80) → `GET /milestones/{id}` (Screen 81) → `PUT /criteria/{id}/verify` (Screen 82)
- **Main Flow:** Tech Lead inspects submitted deliverables and pay-gated documents (`GET /milestones/{id}/paygated-docs`). Signs off technical criteria (`techVerifiedAt = now()`). When all technical criteria pass on a `JOINT` milestone, passes sign-off to CEO for final approval.

### TECH-3.3 · Request Deliverable Revision
- **API:** `PUT /criteria/{id}/revision` (Screen 82)
- **Main Flow:** Rejects technical implementation with feedback note (`revisionNote`). Reverts milestone state to `IN_REVISION`.

---

## TECH-4 · Post-Engagement Technical Review

### TECH-4.1 · Submit Structured Technical Review
- **API:** `POST /reviews` (Screen 88)
- **Preconditions:** Engagement `state = 'CLOSED'`.
- **Main Flow:** Submits technical evaluation of expert performance. Requires structured signal JSON (`codeQualityRating`, `communicationRating`, `seamRatings`, `wouldRecommend`).

---

# ACTOR 3: EXPERT

---

## EXP-0 · Registration, Capability Profile & Setup

### EXP-0.1 · Register & Build Capability Profile
- **Registration API:** `POST /auth/register` with `roles: 'EXPERT'` (Screen 04).
- **Profile API:** `PUT /expert-profile/me` (Screen 43) — updates bio, engagement model, stack tags.
- **Domain Depths API:** `POST /expert-profile/domains` / `PUT /expert-profile/domains/sync` (Screen 44) — sets domain depth levels (`SURFACE`, `OPERATIONAL`, `DEEP`).
- **Seam Claims API:** `POST /expert-profile/seams` / `PUT /expert-profile/seams/sync` (Screen 45) — claims cross-domain seam capabilities (e.g. `A↔C`). Enforces `↔` arrow format.

### EXP-0.2 · Bank Account Linking & Wallet Setup
- **API:** `POST /bank-hub/initiate-link` → `PUT /bank-hub/link` (Screen 21)
- **Main Flow:** Registers bank account number (`bank_account_xid`) and account holder name. Enables automatic milestone release disbursements.

---

## EXP-1 · Project Invitations & Shortlist Discovery

### EXP-1.1 · View & Respond to Project Invitations
- **API:** `GET /invitations` (Screen 84) — returns invitations with project requirements and CEO company metadata.
- **Decline API:** `POST /invitations/{id}/decline` (Screen 84) — sets `status = 'DECLINED'`.
- **Acceptance:** Bidding on the invited project automatically marks invitation `ACCEPTED`.

---

## EXP-2 · Seam Verification (Tier 2 Upgrade)

### EXP-2.1 · Submit Portfolio Evidence
- **API:** `POST /portfolio-submissions` (Screen 46)
- **Gate:** `[Pro-E]` (Requires active Expert Pro subscription).
- **Preconditions:** Claim at `CLAIMED` tier; `lockedUntil <= now()`.
- **Main Flow:** Submits project description (min 50 chars) and key decision points (min 20 chars). Calls FastAPI `/llm/portfolio-eval`.
  - *Pass (Score ≥ 0.85):* Upgrades `expert_seam_claims.verification_tier = 'EVIDENCE_BACKED'`. (Screen 48).
  - *Fail:* Sets status `REJECTED`, increments `submissionCount`. On 5th failure, sets 30-day lockout (`lockedUntil = now + 30 days`).
- **History API:** `GET /portfolio-submissions` (Screen 47).

---

## EXP-3 · Service Listings & AI Generator

### EXP-3.1 · Create & Publish Marketplace Service
- **Creation API:** `POST /services` (Screen 50) — creates service listing in `DRAFT` state. If `useAiGenerator = true` (requires Expert Pro), calls FastAPI `/llm/service-generate` (Screen 51) using expert's claimed capabilities as context.
- **Publish API:** `PUT /services/{id}/publish` → sets `state = 'PUBLISHED'`.
- **Manage Listings:** `GET /services/me` (Screen 49), `PUT /services/{id}`, `DELETE /services/{id}`. View service orders via `GET /services/me/purchases` (Screen 52).

---

## EXP-4 · Bidding & Offer Negotiation

### EXP-4.1 · Submit Capability Bid
- **API:** `POST /bids` (Screen 54)
- **Gate:** `[Pro-E]` for Tier 2 and Tier 3 projects.
- **Preconditions:** Expert appears on project match shortlist or was invited.
- **Main Flow:** Submits footprint alignment, technical approach summary, and per-milestone pricing terms. Creates engagement (`PENDING`) and bid (`SUBMITTED`). Dispatches WebSocket alerts to CEO and Tech Team.

### EXP-4.2 · Negotiate Counter-Offers & Withdraw
- **Offers API:** `POST /bids/{id}/offers` (Screen 55) — submits revised terms in response to CEO counter-offer.
- **Accept Offer API:** `POST /bids/{id}/offers/{offerId}/accept` — accepts CEO offer, locking milestone contract terms.
- **Withdraw Bid API:** `DELETE /bids/{id}` — withdraws bid while in `SUBMITTED` or `TECH_REVIEW` state, setting engagement to `DECLINED`.

---

## EXP-5 · NDA Acceptance & Artifact B Access

### EXP-5.1 · Accept NDA & Connect
- **API:** `POST /engagements/{id}/connect` (Screen 62)
- **Main Flow:** Expert signs NDA (`expertNdaAcceptedAt = now()`). When CEO has also signed, engagement state becomes `CONNECTED`. Prompts bank account setup if unlinked.

### EXP-5.2 · Access Technical Vault (Artifact B)
- **API:** `GET /projects/{id}/artifact-b` (Screen 63)
- **Main Flow:** Accesses confidential technical architecture, schema URLs, and integration contracts.

---

## EXP-6 · Milestone Execution, DoD & Submissions

### EXP-6.1 · Stage Pay-Gated Documents
- **API:** `POST /milestones/{id}/paygated-docs` OR `/bulk` (Screen 76)
- **Main Flow:** Stages technical deliverable document URLs (`releaseState = 'STAGED'`). Auto-released to Tech Team when milestone escrow is funded.

### EXP-6.2 · Execute Definition of Done Checklist
- **APIs:** `GET /milestones/{id}/dod` (Screen 74) → `PUT /milestones/{id}/dod/{itemId}` (Screen 74)
- **Main Flow:** Marks required DoD checklist items `COMPLETED` (with completion notes). Required items cannot be marked `NOT_APPLICABLE`.

### EXP-6.3 · Submit Deliverables
- **API:** `POST /milestones/{id}/submit` (Screen 75)
- **Guard:** 100% of required DoD items must be `COMPLETED`.
- **Main Flow:** Submits work description and file URLs. Transitions milestone state to `SUBMITTED`. Notifies reviewers via Socket.io.
- **Retract API:** `DELETE /milestones/{id}/submissions/latest` — retracts submission while in `SUBMITTED` state, reverting milestone to `IN_PROGRESS`.

### EXP-6.4 · Withdraw Earnings
- **API:** `POST /withdrawals` (Screen 22)
- **Main Flow:** Requests cash-out of available wallet balance to linked bank account. Status starts at `PENDING`. View history via `GET /withdrawals`. Cancel pending requests via `DELETE /withdrawals/{id}`.

---

# ACTOR 4: ADMIN

---

## ADM-1 · Platform Integrity & AI Decision Audits

### ADM-1.1 · Audit Platform AI Decisions
- **API:** `GET /admin/decisions` (Screen 103)
- **Main Flow:** Filterable audit trail of all LLM evaluation logs: `ELICITATION_SYNTHESIS`, `SPEC_AUTO_RETURN`, `SEAM_TIER_UPGRADE`, `PORTFOLIO_EVAL`, `DISPUTE_L1_EVAL`, `CRITERION_QUALITY_GATE`.

---

## ADM-2 · Financial Ledger & Withdrawal Management

### ADM-2.1 · Audit Wallet Transactions
- **API:** `GET /admin/transactions` (Screen 95)
- **Main Flow:** Views immutable double-entry ledger across all platform wallets. Filterable by transaction type or user ID.

### ADM-2.2 · Process Expert Payout Requests
- **Queue API:** `GET /admin/withdrawals` (Screen 96)
- **Complete Payout API:** `PUT /admin/withdrawals/{id}/complete` — marks payout `COMPLETED`. If linked to milestone release, advances milestone state to `RELEASED`.
- **Fail Payout API:** `PUT /admin/withdrawals/{id}/fail` — marks payout `FAILED` and atomically restores funds to expert's `available_balance` with a `WITHDRAWAL_REFUND` ledger log.

### ADM-2.3 · Configure Platform Settings
- **API:** `GET /admin/platform-settings` / `PUT /admin/platform-settings` (Screen 97)
- **Main Flow:** Configures global platform fee percentage (`platform_fee_pct` in `[0, 1]`) and platform fee destination wallet ID.

---

## ADM-3 · User Moderation & Oversight

### ADM-3.1 · User Account Control
- **List Users API:** `GET /admin/users` (Screen 92) / `GET /admin/users/{id}`
- **Suspend API:** `PUT /admin/users/{id}/suspend` — sets `is_active = false`, blocking user login.
- **Reactivate API:** `PUT /admin/users/{id}/reactivate` — restores account access.
- **List Experts API:** `GET /admin/experts` (Screen 106) — views expert verification tiers and capability depths.

---

## ADM-4 · Project & Engagement Oversight

### ADM-4.1 · Project Spec Emergency Suspension
- **API:** `PUT /admin/projects/{id}/suspend-spec` (Screen 104)
- **Main Flow:** Suspends a published project specification (`state = 'SUSPENDED'`), removing it from marketplace and matching views. Reopen via `PUT /admin/projects/{id}/reopen`.
- **List Engagements API:** `GET /admin/engagements` (Screen 105).

---

## ADM-5 · 2-Layer Dispute Arbitration

### ADM-5.1 · Resolve Escalated Disputes
- **Dispute Queue API:** `GET /admin/disputes?state=MANUAL_REVIEW` (Screen 93)
- **Dispute Detail API:** `GET /disputes/{id}` (Screen 94) — inspects criterion, deliverable description, AI Layer 1 confidence score, and reasoning notes.
- **Resolution API:** `PUT /admin/disputes/{id}/resolve` (Screen 94)
- **Decision Options:**
  - `EXPERT_WINS` → releases escrow payment to expert.
  - `CLIENT_WINS` → refunds escrow payment to client available balance.
  - `SPLIT` → divides escrow payment 50/50 between client and expert.
- **Outcome:** Sets `disputes.state = 'RESOLVED'`, advances `milestones.state = 'APPROVED'`, and logs decision.

---

## ADM-6 · CMS & Configuration Management

### ADM-6.1 · Manage Taxonomy Definitions
- **Domains CMS:** `/admin/config/domains` (Screen 99) — CRUD for AI domains (A–F).
- **Seams CMS:** `/admin/config/seams` (Screen 99) — CRUD for cross-domain seams (`A↔C`). Enforces `(domainCode1, domainCode2)` unique constraint.
- **Archetypes CMS:** `/admin/config/archetypes` (Screen 100) — CRUD for project archetypes (1–6).
- **Probe Questions CMS:** `/admin/config/probe-questions` (Screen 100) — CRUD for Stage 3 probe question banks.
- **Void Codes CMS:** `/admin/config/void-codes` (Screen 101) — CRUD for elicitation gap taxonomy and severity mapping.

### ADM-6.2 · Hot-Reload Prompt Templates
- **APIs:** `GET/PUT/DELETE /admin/prompts/{stage}` (Screen 102)
- **Main Flow:** Upserts Jinja2 system prompt templates in `prompt_templates` table. FastAPI fetches DB templates via `GET /internal/prompts/{stage}` with a 60-second TTL cache, enabling prompt hot-reloading without service redeployment. Deleting a template reverts system to on-disk `.txt` defaults.

### ADM-6.3 · Manage Subscription Packages
- **APIs:** `GET/POST/PUT/DELETE /admin/subscriptions/packages` (Screen 98)
- **Main Flow:** CRUD management for Client and Expert subscription plans. Hard-deletion is blocked if purchase history exists (returns 422); package must be deactivated (`isActive = false`) instead.

---

# ACTOR 5: SYSTEM (Automated & S2S Processes)

---

## SYS-1 · Payment Processing (SePay IPN Webhooks)

### SYS-1.1 · Inbound Wallet Top-Up IPN
- **Trigger:** `POST /webhooks/sepay/ipn` with `entityType = 'WALLET_TOPUP'`.
- **Sequence:** Verifies HMAC signature → checks transaction reference idempotency → credits `wallets.available_balance` → writes `TOP_UP` ledger entry → emits `wallet:balance-updated` WebSocket event.

### SYS-1.2 · Inbound Milestone Escrow IPN
- **Trigger:** `POST /webhooks/sepay/ipn` with `entityType = 'MILESTONE'`.
- **Sequence:** Verifies HMAC signature → validates exact transfer amount (`amount == fixed_amount`) → debits client `available_balance`, credits client `locked_balance` → creates `escrow_accounts` row (`status = 'HELD'`) → advances `milestones.state = 'IN_PROGRESS'` → sets `virtual_accounts.status = 'USED'` → bulk-releases staged `paygated_documents` (`releaseState = 'RELEASED'`) → activates engagement (`state = 'ACTIVE'`) → emits `payment:confirmed` WebSocket event.

### SYS-1.3 · Direct Service Purchase IPN
- **Trigger:** `POST /webhooks/sepay/ipn` with `entityType = 'SERVICE'`.
- **Sequence:** Verifies HMAC signature → creates milestone #1 with default criterion → locks escrow → creates shadow project record → sets engagement `state = 'ACTIVE'` → sets VA `status = 'USED'` → emits notification events to both parties.

---

## SYS-2 · Real-Time Gateway & Event Dispatcher

### SYS-2.1 · WebSocket Event Dispatching & Notification Persistence
- **Trigger:** Internal `eventEmitter.emit('socket.broadcast', { userId, event, payload })`.
- **Sequence:** Routes payload to user's Socket.io room in real time. If `event == 'notification:generic'`, persists notification record into **`notifications`** table for cross-session history retention.

---

# CROSS-ACTOR HANDOFF & INTERACTION MATRIX

| Triggering Actor | Action / Event | Target Actor | Real-Time Socket Event | System State Effect | Deep-Link Route |
|---|---|---|---|---|---|
| **CEO** | Generates handoff invite link | **Tech Team** | — | `elicitation_sessions.handoffTokenJti` set | `/register/handoff/:token` |
| **Tech Team** | Submits Stage 4 technical context | **CEO** | `notification:generic` | `elicitation_sessions.currentStage = 5` | `/ceo/projects/elicitation` |
| **CEO** | Publishes project specification | **Tech Team** | `notification:generic` | `projects.state = 'PUBLISHED'`, profile linked | `/tech-team/projects/:id` |
| **CEO** | Invites Expert to project | **Expert** | `notification:generic` | `invitations` row created (`status = 'PENDING'`) | `/expert/invitations` |
| **Expert** | Submits capability bid | **CEO & Tech Team** | `notification:generic`, `bid:updated` | `capability_bids.state = 'SUBMITTED'` | `/ceo/projects/:id/bids` |
| **Tech Team** | Approves technical bid scope | **CEO** | `notification:generic`, `bid:updated` | `capability_bids.techStatus = 'APPROVED'` | `/ceo/projects/:id/bids/:bidId` |
| **Tech Team** | Requests technical bid revision | **Expert** | `notification:generic`, `bid:updated` | `capability_bids.techStatus = 'REVISION_REQUESTED'` | `/expert/engagements/:id/bid` |
| **CEO** | Accepts bid offer | **Expert** | `notification:generic`, `bid:updated` | `capability_bids.state = 'SELECTED'`, terms locked | `/expert/engagements/:id/nda` |
| **CEO & Expert** | Both sign platform NDA | **CEO & Expert** | `notification:generic` | `engagements.state = 'CONNECTED'` | `/ceo/engagements/:id/milestones` |
| **CEO** | Funds milestone via VietQR | **Expert & Tech Team** | `payment:confirmed`, `milestone:updated` | `milestones.state = 'IN_PROGRESS'`, escrow locked | `/expert/engagements/:id/milestones/:mId` |
| **Expert** | Submits milestone deliverables | **Reviewer (CEO/Tech)** | `milestone:updated` | `milestones.state = 'SUBMITTED'` | `/ceo/engagements/:id/milestones/:mId` |
| **Reviewer** | Requests criterion revision | **Expert** | `milestone:updated` | `milestones.state = 'IN_REVISION'` | `/expert/engagements/:id/milestones/:mId` |
| **Reviewer** | Verifies final milestone criterion | **Expert** | `milestone:updated` | `milestones.state = 'APPROVED'`, escrow released | `/expert/wallet` |
| **CEO / Expert** | Files requirement dispute | **Opposing Party & Admin** | `dispute:filed` | `escrow_accounts.status = 'FROZEN'`, `milestones.state = 'DISPUTED'` | `/admin/disputes/:id` |
| **Admin** | Manually resolves dispute | **CEO & Expert** | `dispute:resolved` | `disputes.state = 'RESOLVED'`, escrow settled | `/ceo/engagements/:id/milestones` |

---

# APPENDIX: 223 API ENDPOINTS → SCREEN & SCENARIO PATH INDEX

| # | HTTP Method & Route Path | Primary Actor | Screen Name (SRS Index) | Scenario Path ID |
|:---:|---|---|---|---|
| 1 | `GET /health` | System | — | SYS-0 |
| 2 | `POST /auth/register` | Guest | Register - CEO (03) / Expert (04) | CEO-0.1, EXP-0.1 |
| 3 | `POST /auth/login` | All | Login (02) | CEO-0.1, TECH-0.4, EXP-0.1, ADM-0 |
| 4 | `PUT /auth/switch-role` | Multi-role User | My Profile (14) / Account Settings (15) | CEO-0.4, EXP-0.6 |
| 5 | `POST /auth/refresh` | All | — (FE Interceptor) | SYS-5.1 |
| 6 | `POST /auth/register/handoff` | Tech Team | Tech Team Handoff Register (08) | TECH-0.1 |
| 7 | `POST /auth/verify-otp` | Unverified User | Email Verification (05) | CEO-0.1, EXP-0.1 |
| 8 | `POST /auth/verify-tax-code` | CLIENT (CEO) | Account Settings (15) | CEO-0.11 |
| 9 | `POST /auth/claim-handoff` | Tech Team | Tech Team Handoff Register (08) | TECH-0.3 |
| 10 | `POST /auth/forgot-password` | Unauthenticated | Forgot Password (06) | CEO-0.5 |
| 11 | `POST /auth/reset-password` | Unauthenticated | Reset Password (07) | CEO-0.7 |
| 12 | `GET /auth/verify-reset-token/{token}` | Unauthenticated | Reset Password (07) | CEO-0.6 |
| 13 | `POST /auth/logout` | Authenticated | TopNav Header | CEO-0.9 |
| 14 | `PUT /auth/me/password` | Authenticated | Account Settings (15) | CEO-0.8 |
| 15 | `POST /auth/resend-otp` | Unverified User | Email Verification (05) | CEO-0.1, EXP-0.1 |
| 16 | `POST /users/me/add-role` | Authenticated | Account Settings (15) | CEO-0.4 |
| 17 | `GET /users/me` | Authenticated | My Profile (14) | CEO-0.1, EXP-0.1, TECH-0.1 |
| 18 | `PUT /users/me` | Authenticated | Account Settings (15) | CEO-0.1, EXP-0.1 |
| 19 | `GET /users/{userId}/public-profile` | Authenticated | Public Expert Profile (16) / Expert Profile View (38) | CEO-6.4, EXP-0.2 |
| 20 | `PUT /users/me/tax-code` | CLIENT (CEO) | Account Settings (15) | CEO-0.11 |
| 21 | `GET /wallets/me` | CLIENT, EXPERT | CEO Wallet (17) / Expert Wallet (18) | CEO-6.5, EXP-8.1 |
| 22 | `GET /wallets/me/transactions` | CLIENT, EXPERT | Transaction History (20) | CEO-6.5, EXP-8.1, ADM-2.1 |
| 23 | `POST /wallets/virtual-accounts/topup` | CLIENT, EXPERT | Top Up Wallet (19) | CEO-0.2, EXP-0.4 |
| 24 | `POST /withdrawals` | EXPERT | Withdraw Funds (22) | EXP-8.2 |
| 25 | `GET /withdrawals` | EXPERT | Withdraw Funds (22) / Expert Wallet (18) | EXP-8.1 |
| 26 | `DELETE /withdrawals/{id}` | EXPERT | Expert Wallet (18) | EXP-8.3 |
| 27 | `POST /webhooks/sepay/ipn` | SePay Gateway | — (S2S Callback) | SYS-1.1, SYS-1.2, SYS-1.3 |
| 28 | `POST /webhooks/sepay/chi-ho-credit` | SePay Gateway | — (S2S Callback) | SYS-1.4 |
| 29 | `POST /webhooks/sepay/bank-linked` | SePay Gateway | — (S2S Callback) | SYS-1.5 |
| 30 | `POST /bank-hub/initiate-link` | EXPERT | Bank Account Link (21) | EXP-0.5 |
| 31 | `PUT /bank-hub/link` | EXPERT | Bank Account Link (21) | EXP-0.5 |
| 32 | `GET /bank-hub/link` | EXPERT | Bank Account Link (21) | EXP-0.5 |
| 33 | `POST /subscriptions/activate` | CLIENT, EXPERT | Subscription Plans (24) | CEO-0.3, EXP-0.3 |
| 34 | `GET /subscriptions/status` | CLIENT, EXPERT | Subscription Management (23) | CEO-0.3, EXP-0.3 |
| 35 | `GET /subscriptions/history` | CLIENT, EXPERT | Subscription History (25) | CEO-6.5, EXP-8.1 |
| 36 | `POST /elicitation/sessions` | CLIENT (CEO) | Elicitation Session History (26) | CEO-1.0 |
| 37 | `GET /elicitation/sessions` | CLIENT (CEO) | Elicitation Session History (26) | CEO-1.0A |
| 38 | `GET /elicitation/sessions/active` | CLIENT (CEO) | CEO Dashboard (10) | CEO-1.0A |
| 39 | `PUT /elicitation/sessions/{id}/abandon` | CLIENT (CEO) | Elicitation Session History (26) | CEO-1.0A |
| 40 | `GET /elicitation/sessions/history` | CLIENT (CEO) | Elicitation Session History (26) | CEO-1.0A |
| 41 | `GET /elicitation/sessions/{id}` | CLIENT (CEO) | Stage 1–5 Screens (27–32) | CEO-1.0A |
| 42 | `DELETE /elicitation/sessions/{id}` | CLIENT (CEO) | Elicitation Session History (26) | CEO-1.0A |
| 43 | `PUT /elicitation/sessions/{id}/stage1` | CLIENT (CEO) | Stage 1 - Symptoms (27) | CEO-1.1 |
| 44 | `PUT /elicitation/sessions/{id}/stage2` | CLIENT (CEO) | Stage 2 - Archetype (28) | CEO-1.2 |
| 45 | `PUT /elicitation/sessions/{id}/stage3` | CLIENT (CEO) | Stage 3 - Probe Questions (29) | CEO-1.3 |
| 46 | `PUT /elicitation/sessions/{id}/stage4` | CLIENT (CEO) | Stage 4A - Technical Inputs (30) | CEO-1.4B, CEO-1.4C |
| 47 | `PUT /elicitation/sessions/{id}/stage4-handoff` | CLIENT (TECH) | Stage 4 Form (Tech Team) (79) | TECH-1.1 |
| 48 | `POST /elicitation/sessions/{id}/stage5` | CLIENT (CEO) | Stage 5 - Spec Review & Handoff (32) | CEO-1.6 |
| 49 | `POST /elicitation/sessions/{id}/generate-handoff-link` | CLIENT (CEO) | Stage 4B - Tech Team Invite (31) | CEO-1.4A |
| 50 | `PUT /elicitation/sessions/{id}/self-technical` | CLIENT (CEO) | Stage 4A (30) / Stage 4B (31) | CEO-1.4A, CEO-1.4B |
| 51 | `POST /elicitation/sessions/{id}/retry-synthesis` | CLIENT (CEO) | Stage 5 - Spec Review & Handoff (32) | CEO-1.6 |
| 52 | `PUT /elicitation/sessions/{id}/revert` | CLIENT (CEO) | Stage 1–4 Screens (27–31) | CEO-1.8 |
| 53 | `PUT /elicitation/sessions/{id}/continue` | CLIENT (CEO) | Elicitation Session History (26) | CEO-1.8 |
| 54 | `POST /elicitation/sessions/{id}/stage4-recommend` | CLIENT (CEO) | Stage 4A - Technical Inputs (30) | CEO-1.5 |
| 55 | `PATCH /elicitation/sessions/{id}/draft` | CLIENT (CEO) | Stage 1 - Symptoms (27) | CEO-1.1 |
| 56 | `PATCH /elicitation/sessions/{id}/stage4-draft` | CLIENT | Stage 4A (30) / Stage 4 Form (79) | CEO-1.4B, TECH-1.1 |
| 57 | `GET /projects/marketplace` | EXPERT, ADMIN | Project Marketplace (35) | EXP-4.2 |
| 58 | `GET /projects/{id}` | CLIENT, EXPERT, ADMIN | Project Detail (34) / Expert Project View (53) / Tech Team Project Detail (78) | CEO-1.7, EXP-4.2, TECH-78 |
| 59 | `GET /projects` | CLIENT | Projects List (CEO) (33) / Tech Team Project Detail (78) | CEO-1.7, TECH-0.4 |
| 60 | `GET /projects/{id}/artifact-a` | CLIENT, EXPERT | Project Detail (34) / Expert Project View (53) | CEO-1.7, EXP-5.1 |
| 61 | `GET /projects/{id}/artifact-b` | TECH_TEAM, EXPERT, ADMIN | Artifact B View (63) / Pay-gated Doc Inbox (83) | TECH-3.1, EXP-5.2 |
| 62 | `PUT /projects/{id}/name` | CLIENT (CEO) | Project Detail (34) | CEO-1.7 |
| 63 | `PUT /projects/{id}/milestones` | CLIENT (CEO) | Project Detail (34) | CEO-5.1 |
| 64 | `POST /projects/{id}/milestone-chat` | CLIENT, EXPERT | AI Milestone Chat (36) | CEO-5.9 |
| 65 | `GET /projects/{id}/milestone-chat/sessions` | CLIENT, EXPERT | AI Milestone Chat (36) | CEO-5.9 |
| 66 | `GET /projects/{id}/milestone-chat/sessions/{sessionId}` | CLIENT, EXPERT | AI Milestone Chat (36) | CEO-5.9 |
| 67 | `GET /matching/{projectId}/shortlist` | CLIENT (CEO) | Expert Shortlist (CEO) (37) | CEO-1.7 |
| 68 | `GET /expert-profile/me` | EXPERT | Expert Profile Builder (43) | EXP-0.2 |
| 69 | `PUT /expert-profile/me` | EXPERT | Expert Profile Builder (43) | EXP-0.2 |
| 70 | `GET /expert-profile/search` | CLIENT, ADMIN | Expert Profile View (CEO) (38) | CEO-6.4 |
| 71 | `GET /expert-profile/{userId}` | CLIENT, ADMIN | Public Expert Profile (16) / Expert Profile View (38) | CEO-6.4, EXP-0.2 |
| 72 | `GET /expert-profile/me/domains` | EXPERT | Domain Depth Grid (44) | EXP-0.2 |
| 73 | `GET /expert-profile/me/seams` | EXPERT | Seam Claims Grid (45) | EXP-0.2 |
| 74 | `POST /expert-profile/domains` | EXPERT | Domain Depth Grid (44) | EXP-0.2 |
| 75 | `PUT /expert-profile/domains/sync` | EXPERT | Domain Depth Grid (44) | EXP-0.2 |
| 76 | `PUT /expert-profile/domains/{id}` | EXPERT | Domain Depth Grid (44) | EXP-0.2 |
| 77 | `DELETE /expert-profile/domains/{id}` | EXPERT | Domain Depth Grid (44) | EXP-0.2 |
| 78 | `POST /expert-profile/seams` | EXPERT | Seam Claims Grid (45) | EXP-0.2 |
| 79 | `PUT /expert-profile/seams/sync` | EXPERT | Seam Claims Grid (45) | EXP-0.2 |
| 80 | `POST /portfolio-submissions` | EXPERT | Portfolio Submit Form (46) | EXP-2.1 |
| 81 | `GET /portfolio-submissions` | EXPERT | Verification History (47) | EXP-2.3 |
| 82 | `GET /portfolio-submissions/{id}` | EXPERT, ADMIN | Verification Result / Lockout (48) | EXP-2.3 |
| 83 | `DELETE /portfolio-submissions/me/portfolio/{id}` | EXPERT | Verification History (47) | EXP-2.3 |
| 84 | `GET /portfolio-submissions/me/portfolio/{id}` | EXPERT | Verification History (47) | EXP-2.3 |
| 85 | `GET /services/me` | EXPERT | My Services (49) | EXP-3.3 |
| 86 | `GET /services/me/purchases` | CLIENT (CEO) | My Service Orders (CEO) (42) | CEO-2.3 |
| 87 | `GET /services` | CLIENT, EXPERT, ADMIN | Service Marketplace Browse (39) | CEO-2.1 |
| 88 | `POST /services` | EXPERT | Create / Edit Service (50) / AI Service Generator (51) | EXP-3.1, EXP-3.2 |
| 89 | `GET /services/{id}` | CLIENT, EXPERT, ADMIN | Service Detail (CEO) (40) | CEO-2.2 |
| 90 | `PUT /services/{id}` | EXPERT | Create / Edit Service (50) | EXP-3.3 |
| 91 | `DELETE /services/{id}` | EXPERT | My Services (49) | EXP-3.4 |
| 92 | `POST /services/{id}/purchase` | CLIENT (CEO) | Service Purchase (41) | CEO-2.3, CEO-2.4 |
| 93 | `PUT /services/{id}/publish` | EXPERT | My Services (49) | EXP-3.3 |
| 94 | `PUT /services/{id}/unpublish` | EXPERT | My Services (49) | EXP-3.3 |
| 95 | `GET /engagements` | CLIENT, EXPERT, ADMIN | CEO Dashboard (10) / Expert Dashboard (11) / Tech Dashboard (12) | CEO-6.3, EXP-4.6, TECH-4.1 |
| 96 | `GET /engagements/{id}` | CLIENT, EXPERT, ADMIN | Bid Detail & Negotiation (57) / CEO NDA (61) / Expert NDA (62) | CEO-4.2, EXP-5.1 |
| 97 | `PUT /engagements/{id}/accept-nda` | CLIENT (CEO) | CEO NDA Acceptance (61) | CEO-4.2 |
| 98 | `POST /engagements/{id}/connect` | EXPERT | Expert NDA & Connection Request (62) | EXP-5.1 |
| 99 | `PUT /engagements/{id}/decline` | EXPERT | Expert NDA & Connection Request (62) | EXP-5.1 |
| 100 | `GET /engagements/{id}/milestones` | CLIENT, EXPERT, ADMIN | Milestone List (CEO) (64) / Expert Milestone Detail (73) / Tech Milestone List (80) | CEO-5.1, EXP-7.1, TECH-4.1 |
| 101 | `GET /engagements/{id}/submissions` | CLIENT, EXPERT, ADMIN | Milestone Detail (CEO) (66) / Expert Milestone Detail (73) / Tech Milestone Detail (81) | CEO-5.7, EXP-7.3, TECH-4.1 |
| 102 | `GET /engagements/{id}/bid` | CLIENT, EXPERT, ADMIN | Bid Detail & Negotiation (57) | CEO-3.2, TECH-2.2 |
| 103 | `GET /engagements/{id}/disputes` | CLIENT, EXPERT, ADMIN | Milestone Detail (CEO) (66) / Expert Milestone Detail (73) / Tech Milestone Detail (81) | CEO-5.10, EXP-7.2, TECH-4.3 |
| 104 | `PUT /engagements/{id}/cancel` | CLIENT, EXPERT, ADMIN | Milestone List (CEO) (64) / Expert Milestone Detail (73) | CEO-6.2, EXP-7.2 |
| 105 | `POST /bids` | EXPERT | Bid Form - Footprint & Pricing (54) | EXP-4.3 |
| 106 | `GET /bids` | CLIENT, EXPERT, ADMIN | Bid List (CEO) (56) | CEO-3.1, EXP-4.6 |
| 107 | `GET /bids/{id}` | CLIENT, EXPERT, ADMIN | Bid Detail & Negotiation (57) / Tech Team Bid Review (59) | CEO-3.2, TECH-2.2 |
| 108 | `PUT /bids/{id}` | EXPERT | Bid Form - Footprint & Pricing (54) | EXP-4.5 |
| 109 | `DELETE /bids/{id}` | EXPERT | Bid Form - Footprint & Pricing (54) | EXP-4.4 |
| 110 | `PUT /bids/{id}/tech-review` | CLIENT (TECH) | Tech Team Bid Review (59) / Bid Revision Request (60) | TECH-2.3, TECH-2.4 |
| 111 | `PUT /bids/{id}/ceo-decision` | CLIENT (CEO) | CEO Bid Decision (58) | CEO-3.4, CEO-3.5 |
| 112 | `PUT /bids/{id}/counter-offer` | CLIENT (CEO) | Bid Detail & Negotiation (57) | CEO-3.3 |
| 113 | `POST /bids/{id}/offers` | CLIENT, EXPERT | Counter Offer Received (Expert) (55) / Bid Detail & Negotiation (57) | CEO-3.3, EXP-4.5 |
| 114 | `POST /bids/{id}/offers/{offerId}/accept` | CLIENT, EXPERT | Counter Offer Received (Expert) (55) / Bid Detail & Negotiation (57) | CEO-3.4, EXP-4.5 |
| 115 | `POST /bids/{id}/offers/{offerId}/decline` | CLIENT, EXPERT | Counter Offer Received (Expert) (55) / Bid Detail & Negotiation (57) | CEO-3.5, EXP-4.5 |
| 116 | `POST /bids/{id}/reconcile` | CLIENT, EXPERT, ADMIN | Counter Offer Received (Expert) (55) / Bid Detail & Negotiation (57) | CEO-3.2, EXP-4.5 |
| 117 | `POST /disputes` | CLIENT, EXPERT | File Dispute (71) | CEO-5.10, EXP-7.2, TECH-4.3 |
| 118 | `GET /disputes` | CLIENT, EXPERT, ADMIN | Dispute Monitor (93) | CEO-5.10, EXP-7.2, ADM-5.1 |
| 119 | `GET /disputes/{id}` | CLIENT, EXPERT, ADMIN | Dispute Result (72) / Dispute Detail & Resolution (94) | CEO-5.10A, ADM-5.2 |
| 120 | `POST /milestones` | CLIENT (CEO) | Create Milestone (65) | CEO-5.2 |
| 121 | `GET /milestones` | CLIENT, EXPERT, ADMIN | Milestone List (CEO) (64) / Expert Milestone Detail (73) / Tech Milestone List (80) | CEO-5.1, EXP-7.1, TECH-4.1 |
| 122 | `GET /milestones/{id}` | CLIENT, EXPERT, ADMIN | Milestone Detail (CEO) (66) / Expert Milestone Detail (73) / Tech Milestone Detail (81) | CEO-5.7, EXP-7.1, TECH-4.1 |
| 123 | `PATCH /milestones/{id}` | CLIENT (CEO) | Milestone Detail (CEO) (66) | CEO-5.3 |
| 124 | `DELETE /milestones/{id}` | CLIENT (CEO) | Milestone List (CEO) (64) | CEO-5.4 |
| 125 | `PUT /milestones/{id}/fund` | CLIENT (CEO) | Fund Milestone (QR) (67) | CEO-5.6 |
| 126 | `GET /milestones/{id}/disputes` | CLIENT, EXPERT, ADMIN | Milestone Detail (CEO) (66) | CEO-5.10 |
| 127 | `POST /milestones/bulk` | CLIENT (CEO) | Create Milestone (65) | CEO-5.2 |
| 128 | `POST /milestones/{id}/dod/items` | CLIENT, EXPERT | DoD Editor (70) / DoD Checklist (74) | EXP-7.1 |
| 129 | `POST /milestones/{id}/dod/items/bulk` | CLIENT, EXPERT | DoD Editor (70) / DoD Checklist (74) | EXP-7.1 |
| 130 | `GET /milestones/{id}/dod` | CLIENT, EXPERT, ADMIN | DoD Editor (70) / DoD Checklist (74) | CEO-5.7, EXP-7.1 |
| 131 | `DELETE /milestones/{id}/dod/{itemId}` | CLIENT, EXPERT | DoD Editor (70) / DoD Checklist (74) | EXP-7.1 |
| 132 | `PUT /milestones/{id}/dod/{itemId}` | EXPERT | DoD Checklist (74) | EXP-7.1 |
| 133 | `PUT /criteria/{id}/verify` | CLIENT | Criteria Verify / Revision (69) / Criteria Sign-Off (Tech Team) (82) | CEO-5.7, TECH-4.2 |
| 134 | `PUT /criteria/{id}/revision` | CLIENT | Criteria Verify / Revision (69) / Criteria Sign-Off (Tech Team) (82) | CEO-5.7, TECH-4.2 |
| 135 | `GET /criteria/{milestoneId}` | CLIENT, EXPERT, ADMIN | Acceptance Criteria Editor (68) / Criteria Verify / Revision (69) / Criteria Sign-Off (82) | CEO-5.5, TECH-4.2 |
| 136 | `POST /criteria/{milestoneId}` | CLIENT (CEO) | Acceptance Criteria Editor (68) | CEO-5.5 |
| 137 | `DELETE /criteria/{id}` | CLIENT (CEO) | Acceptance Criteria Editor (68) | CEO-5.5 |
| 138 | `POST /milestones/{id}/submit` | EXPERT | Submit Deliverables (75) | EXP-7.2 |
| 139 | `POST /milestones/{id}/paygated-docs` | EXPERT | Pay-gated Documents Staging (76) | EXP-6.1 |
| 140 | `GET /milestones/{id}/paygated-docs` | CLIENT (Tech), EXPERT | Pay-gated Doc Inbox (83) | TECH-3.2, EXP-6.2 |
| 141 | `POST /milestones/{id}/paygated-docs/bulk` | EXPERT | Pay-gated Documents Staging (76) | EXP-6.1 |
| 142 | `DELETE /milestones/{id}/submissions/latest` | EXPERT | Expert Milestone Detail (73) | EXP-7.2 |
| 143 | `GET /milestones/{id}/submissions/latest` | CLIENT, EXPERT, ADMIN | Milestone Detail (CEO) (66) / Expert Milestone Detail (73) / Tech Milestone Detail (81) | CEO-5.7, EXP-7.3 |
| 144 | `GET /milestones/{id}/submissions` | CLIENT, EXPERT, ADMIN | Milestone Detail (CEO) (66) / Expert Milestone Detail (73) / Tech Milestone Detail (81) | CEO-5.7, EXP-7.3 |
| 145 | `GET /engagements/{id}/messages` | Authenticated | Message Thread (85) | CEO-4.3, TECH-2.1, EXP-5.1 |
| 146 | `GET /projects/{id}/messages` | Authenticated | Message Thread (85) | CEO-4.1, TECH-0.5, EXP-4.2 |
| 147 | `POST /messages/{id}/read` | Authenticated | Message Thread (85) | All actors |
| 148 | `GET /engagements/{id}/messages/unread-count` | Authenticated | Inbox / Conversations (84) / Message Thread (85) | All actors |
| 149 | `GET /conversations` | Authenticated | Inbox / Conversations (84) | CEO-4.3, EXP-5.1 |
| 150 | `GET /projects/{id}/messages/unread-count` | Authenticated | Inbox / Conversations (84) / Message Thread (85) | CEO-4.1, EXP-4.2 |
| 151 | `POST /conversations/{engagementId}/read` | Authenticated | Inbox / Conversations (84) | All actors |
| 152 | `POST /conversations/read-all` | Authenticated | Inbox / Conversations (84) | All actors |
| 153 | `GET /invitations` | EXPERT | Inbox / Conversations (84) | EXP-1.1 |
| 154 | `POST /invitations/{id}/decline` | EXPERT | Inbox / Conversations (84) | EXP-1.2 |
| 155 | `GET /invitations/sent` | CLIENT (CEO) | Expert Shortlist (CEO) (37) | CEO-4.7 |
| 156 | `DELETE /invitations/{id}` | CLIENT (CEO) | Expert Shortlist (CEO) (37) | CEO-4.6 |
| 157 | `POST /reviews` | CLIENT, EXPERT | CEO Review Form (86) / Expert Review Form (87) / Tech Team Review Form (88) | CEO-6.1, EXP-9.1, TECH-5.1 |
| 158 | `GET /reviews/{engagementId}` | CLIENT, EXPERT, ADMIN | CEO Review Form (86) / Expert Review Form (87) / Tech Team Review Form (88) | All parties |
| 159 | `GET /reviews/users/{userId}` | Authenticated | Public Expert Profile (16) / Expert Profile View (38) | All actors |
| 160 | `GET /reviews/me` | CLIENT, EXPERT | My Profile (14) / Account Settings (15) | CEO-6.1, EXP-9.1 |
| 161 | `GET /reviews/me/received` | CLIENT, EXPERT | My Profile (14) / Account Settings (15) | CEO-6.1, EXP-9.1 |
| 162 | `PUT /admin/projects/{id}/suspend-spec` | ADMIN | Admin Projects (104) | ADM-4.3 |
| 163 | `PUT /admin/users/{id}/suspend` | ADMIN | User Management (92) | ADM-3.3 |
| 164 | `PUT /admin/users/{id}/reactivate` | ADMIN | User Management (92) | ADM-3.4 |
| 165 | `GET /admin/disputes` | ADMIN | Dispute Monitor (93) | ADM-5.1 |
| 166 | `PUT /admin/disputes/{id}/resolve` | ADMIN | Dispute Detail & Resolution (94) | ADM-5.3 |
| 167 | `GET /admin/decisions` | ADMIN | Integrity Monitor & AI Log (103) | ADM-1.1, ADM-1.2 |
| 168 | `GET /admin/transactions` | ADMIN | Transaction Ledger (95) | ADM-2.1 |
| 169 | `GET /admin/analytics` | ADMIN | Analytics Dashboard (91) | ADM-7.1 |
| 170 | `GET /admin/withdrawals` | ADMIN | Withdrawal Management (96) | ADM-2.2 |
| 171 | `PUT /admin/withdrawals/{id}/complete` | ADMIN | Withdrawal Management (96) | ADM-2.3 |
| 172 | `PUT /admin/withdrawals/{id}/fail` | ADMIN | Withdrawal Management (96) | ADM-2.3 |
| 173 | `GET /admin/platform-settings` | ADMIN | Platform Settings (97) | ADM-2.1 |
| 174 | `PUT /admin/platform-settings` | ADMIN | Platform Settings (97) | ADM-2.1 |
| 175 | `GET /admin/subscriptions/packages` | ADMIN | Subscription Package Manager (98) | ADM-6.3 |
| 176 | `POST /admin/subscriptions/packages` | ADMIN | Subscription Package Manager (98) | ADM-6.3 |
| 177 | `PUT /admin/subscriptions/packages/{id}` | ADMIN | Subscription Package Manager (98) | ADM-6.3 |
| 178 | `DELETE /admin/subscriptions/packages/{id}` | ADMIN | Subscription Package Manager (98) | ADM-6.3 |
| 179 | `GET /admin/users` | ADMIN | User Management (92) | ADM-3.1 |
| 180 | `GET /admin/users/{id}` | ADMIN | User Management (92) | ADM-3.2 |
| 181 | `GET /admin/projects` | ADMIN | Admin Projects (104) | ADM-4.1 |
| 182 | `GET /admin/projects/{id}` | ADMIN | Admin Projects (104) | ADM-4.2 |
| 183 | `GET /admin/engagements` | ADMIN | Admin Engagements (105) | ADM-4.5 |
| 184 | `GET /admin/experts` | ADMIN | Admin Experts Overview (106) | ADM-3.5 |
| 185 | `PUT /admin/projects/{id}/reopen` | ADMIN | Admin Projects (104) | ADM-4.4 |
| 186 | `GET /admin/config/domains` | ADMIN | Domain & Seam Configuration (99) | ADM-6.1 |
| 187 | `POST /admin/config/domains` | ADMIN | Domain & Seam Configuration (99) | ADM-6.1 |
| 188 | `PUT /admin/config/domains/{id}` | ADMIN | Domain & Seam Configuration (99) | ADM-6.1 |
| 189 | `DELETE /admin/config/domains/{id}` | ADMIN | Domain & Seam Configuration (99) | ADM-6.1 |
| 190 | `GET /admin/config/seams` | ADMIN | Domain & Seam Configuration (99) | ADM-6.1 |
| 191 | `POST /admin/config/seams` | ADMIN | Domain & Seam Configuration (99) | ADM-6.1 |
| 192 | `PUT /admin/config/seams/{id}` | ADMIN | Domain & Seam Configuration (99) | ADM-6.1 |
| 193 | `DELETE /admin/config/seams/{id}` | ADMIN | Domain & Seam Configuration (99) | ADM-6.1 |
| 194 | `GET /admin/config/archetypes` | ADMIN | Archetype & Probe Question Config (100) | ADM-6.1 |
| 195 | `POST /admin/config/archetypes` | ADMIN | Archetype & Probe Question Config (100) | ADM-6.1 |
| 196 | `PUT /admin/config/archetypes/{id}` | ADMIN | Archetype & Probe Question Config (100) | ADM-6.1 |
| 197 | `DELETE /admin/config/archetypes/{id}` | ADMIN | Archetype & Probe Question Config (100) | ADM-6.1 |
| 198 | `GET /admin/config/probe-questions` | ADMIN | Archetype & Probe Question Config (100) | ADM-6.1 |
| 199 | `POST /admin/config/probe-questions` | ADMIN | Archetype & Probe Question Config (100) | ADM-6.1 |
| 200 | `PUT /admin/config/probe-questions/{id}` | ADMIN | Archetype & Probe Question Config (100) | ADM-6.1 |
| 201 | `DELETE /admin/config/probe-questions/{id}` | ADMIN | Archetype & Probe Question Config (100) | ADM-6.1 |
| 202 | `GET /admin/config/void-codes` | ADMIN | Void Code Configuration (101) | ADM-6.2 |
| 203 | `POST /admin/config/void-codes` | ADMIN | Void Code Configuration (101) | ADM-6.2 |
| 204 | `PUT /admin/config/void-codes/{id}` | ADMIN | Void Code Configuration (101) | ADM-6.2 |
| 205 | `DELETE /admin/config/void-codes/{id}` | ADMIN | Void Code Configuration (101) | ADM-6.2 |
| 206 | `GET /admin/prompts` | ADMIN | Prompt Template Config (102) | ADM-6.4 |
| 207 | `GET /admin/prompts/{stage}` | ADMIN | Prompt Template Config (102) | ADM-6.4 |
| 208 | `PUT /admin/prompts/{stage}` | ADMIN | Prompt Template Config (102) | ADM-6.4 |
| 209 | `DELETE /admin/prompts/{stage}` | ADMIN | Prompt Template Config (102) | ADM-6.4 |
| 210 | `GET /config/domains` | Unauthenticated | Stage 1 (27) / Domain Depth Grid (44) / Create Service (50) / Bid Form (54) | Public CMS |
| 211 | `GET /config/seams` | Unauthenticated | Stage 1 (27) / Seam Claims Grid (45) / Create Service (50) / Bid Form (54) | Public CMS |
| 212 | `GET /config/archetypes` | Unauthenticated | Stage 2 - Archetype (28) | Public CMS |
| 213 | `GET /config/archetypes/{code}/probe-questions` | Unauthenticated | Stage 3 - Probe Questions (29) | Public CMS |
| 214 | `GET /config/subscription-packages` | Unauthenticated | Subscription Plans (24) | Public CMS |
| 215 | `GET /config/void-codes` | Unauthenticated | Stage 2 - Archetype (28) | Public CMS |
| 216 | `GET /config/all` | Unauthenticated | App Bootstrap (All Screens) | Public CMS |
| 217 | `GET /internal/prompts/{stage}` | Internal S2S | — (FastAPI Microservice Loader) | SYS-0 |
| 218 | `GET /notifications/me` | Authenticated | Notifications (89) | EXP-4.1, All actors |
| 219 | `GET /notifications/me/unread-count` | Authenticated | TopNav Header | Nav Badge |
| 220 | `PUT /notifications/{id}/read` | Authenticated | Notifications (89) | All actors |
| 221 | `PUT /notifications/read-all` | Authenticated | Notifications (89) | All actors |
| 222 | `DELETE /notifications/{id}` | Authenticated | Notifications (89) | All actors |
| 223 | `GET /health` | System | — | Health probe |

# APPENDIX: 223 API ENDPOINTS → SCREEN & SCENARIO PATH INDEX

> **Purpose:** Comprehensive mapping of all **223 NestJS REST API Endpoints** to their primary human actor, SRS Screen index and name, associated React frontend component file path, and corresponding Scenario Path ID.

| # | HTTP Method & Route Path | Primary Actor | SRS Screen Index & Name | Associated Frontend Screen Component(s) / File(s) | Scenario Path ID |
|:---:|---|---|---|---|---|
| 1 | `GET /health` | System | — | `backend/src/app.controller.ts` | SYS-0 |
| 2 | `POST /auth/register` | Unauthenticated | 03: Register - CEO / 04: Register - Expert | `components/auth/AuthModal.tsx` | CEO-0.1, EXP-0.1 |
| 3 | `POST /auth/login` | All | 02: Login | `components/auth/AuthModal.tsx` | CEO-0.1, TECH-0.4, EXP-0.1, ADM-0 |
| 4 | `PUT /auth/switch-role` | Multi-role User | 14: My Profile / 15: Account Settings | `components/layout/RoleSwitcher.tsx`, `components/layout/TopNav.tsx` | CEO-0.4, EXP-0.6 |
| 5 | `POST /auth/refresh` | All | — (FE Interceptor) | `lib/api-client.ts` | SYS-5.1 |
| 6 | `POST /auth/register/handoff` | Tech Team | 08: Tech Team Handoff Register | `features/tech-team/auth/HandoffRegister.tsx` | TECH-0.1 |
| 7 | `POST /auth/verify-otp` | Unverified User | 05: Email Verification (OTP) | `components/auth/AuthModal.tsx` | CEO-0.1, EXP-0.1 |
| 8 | `POST /auth/verify-tax-code` | CLIENT (CEO) | 15: Account Settings | `components/pages/ProfileSettingPage.tsx` | CEO-0.11 |
| 9 | `POST /auth/claim-handoff` | Tech Team | 08: Tech Team Handoff Register | `features/tech-team/auth/HandoffRegister.tsx` | TECH-0.3 |
| 10 | `POST /auth/forgot-password` | Unauthenticated | 06: Forgot Password | `components/auth/AuthModal.tsx` | CEO-0.5 |
| 11 | `POST /auth/reset-password` | Unauthenticated | 07: Reset Password | `components/auth/ResetPasswordPage.tsx` | CEO-0.7 |
| 12 | `GET /auth/verify-reset-token/{token}` | Unauthenticated | 07: Reset Password | `components/auth/ResetPasswordPage.tsx` | CEO-0.6 |
| 13 | `POST /auth/logout` | Authenticated | TopNav Header | `components/layout/TopNav.tsx` | CEO-0.9 |
| 14 | `PUT /auth/me/password` | Authenticated | 15: Account Settings | `components/auth/ChangePasswordModal.tsx` | CEO-0.8 |
| 15 | `POST /auth/resend-otp` | Unverified User | 05: Email Verification (OTP) | `components/auth/AuthModal.tsx` | CEO-0.1, EXP-0.1 |
| 16 | `POST /users/me/add-role` | Authenticated | 15: Account Settings | `components/pages/UserProfilePage.tsx`, `components/layout/TopNav.tsx` | CEO-0.4 |
| 17 | `GET /users/me` | Authenticated | 14: My Profile / 15: Account Settings | `lib/auth-context.tsx`, `hooks/use-user.ts` | CEO-0.1, EXP-0.1, TECH-0.1 |
| 18 | `PUT /users/me` | Authenticated | 15: Account Settings | `components/pages/ProfileSettingPage.tsx` | CEO-0.1, EXP-0.1 |
| 19 | `GET /users/{userId}/public-profile` | Authenticated | 16: Public Expert Profile / 38: Expert Profile View | `features/ceo/experts/CeoExpertProfileView.tsx` | CEO-6.4, EXP-0.2 |
| 20 | `PUT /users/me/tax-code` | CLIENT (CEO) | 15: Account Settings | `components/pages/ProfileSettingPage.tsx` | CEO-0.11 |
| 21 | `GET /wallets/me` | CLIENT, EXPERT | 17: CEO Wallet / 18: Expert Wallet | `components/wallet/WalletPage.tsx`, `features/expert/wallet/ExpertWallet.tsx` | CEO-6.5, EXP-8.1 |
| 22 | `GET /wallets/me/transactions` | CLIENT, EXPERT | 20: Transaction History | `components/wallet/TransactionHistory.tsx` | CEO-6.5, EXP-8.1, ADM-2.1 |
| 23 | `POST /wallets/virtual-accounts/topup` | CLIENT, EXPERT | 19: Top Up Wallet | `features/ceo/onboarding/WalletTopUp.tsx`, `components/wallet/VietQRPanel.tsx` | CEO-0.2, EXP-0.4 |
| 24 | `POST /withdrawals` | EXPERT | 22: Withdraw Funds | `features/expert/wallet/WithdrawForm.tsx` | EXP-8.2 |
| 25 | `GET /withdrawals` | EXPERT | 22: Withdraw Funds / 18: Expert Wallet | `features/expert/wallet/ExpertWallet.tsx` | EXP-8.1 |
| 26 | `DELETE /withdrawals/{id}` | EXPERT | 18: Expert Wallet | `features/expert/wallet/ExpertWallet.tsx` | EXP-8.3 |
| 27 | `POST /webhooks/sepay/ipn` | SePay Gateway | — (S2S Callback) | `backend/src/payments/webhooks.controller.ts` | SYS-1.1, SYS-1.2, SYS-1.3 |
| 28 | `POST /webhooks/sepay/chi-ho-credit` | SePay Gateway | — (S2S Callback) | `backend/src/payments/webhooks.controller.ts` | SYS-1.4 |
| 29 | `POST /webhooks/sepay/bank-linked` | SePay Gateway | — (S2S Callback) | `backend/src/payments/webhooks.controller.ts` | SYS-1.5 |
| 30 | `POST /bank-hub/initiate-link` | EXPERT | 21: Bank Account Link | `features/expert/wallet/BankHubLink.tsx` | EXP-0.5 |
| 31 | `PUT /bank-hub/link` | EXPERT | 21: Bank Account Link | `features/expert/wallet/BankHubLink.tsx` | EXP-0.5 |
| 32 | `GET /bank-hub/link` | EXPERT | 21: Bank Account Link | `features/expert/wallet/BankHubLink.tsx` | EXP-0.5 |
| 33 | `POST /subscriptions/activate` | CLIENT, EXPERT | 24: Subscription Plans | `features/ceo/onboarding/SubscriptionPlans.tsx`, `features/expert/onboarding/SubscriptionPlans.tsx` | CEO-0.3, EXP-0.3 |
| 34 | `GET /subscriptions/status` | CLIENT, EXPERT | 23: Subscription Management | `features/ceo/onboarding/SubscriptionManagement.tsx`, `features/expert/onboarding/SubscriptionManagement.tsx` | CEO-0.3, EXP-0.3 |
| 35 | `GET /subscriptions/history` | CLIENT, EXPERT | 25: Subscription History | `features/ceo/onboarding/SubscriptionManagement.tsx`, `features/expert/onboarding/SubscriptionManagement.tsx` | CEO-6.5, EXP-8.1 |
| 36 | `POST /elicitation/sessions` | CLIENT (CEO) | 26: Elicitation Session History | `features/ceo/elicitation/ElicitationWizard.tsx` | CEO-1.0 |
| 37 | `GET /elicitation/sessions` | CLIENT (CEO) | 26: Elicitation Session History | `features/ceo/pages/SessionsListPage.tsx` | CEO-1.0A |
| 38 | `GET /elicitation/sessions/active` | CLIENT (CEO) | 10: CEO Dashboard | `features/ceo/CeoDashboard.tsx`, `features/ceo/pages/ProjectsPage.tsx` | CEO-1.0A |
| 39 | `PUT /elicitation/sessions/{id}/abandon` | CLIENT (CEO) | 26: Elicitation Session History | `features/ceo/pages/SessionsListPage.tsx` | CEO-1.0A |
| 40 | `GET /elicitation/sessions/history` | CLIENT (CEO) | 26: Elicitation Session History | `features/ceo/pages/SessionsListPage.tsx` | CEO-1.0A |
| 41 | `GET /elicitation/sessions/{id}` | CLIENT (CEO) | 27–32: Stage 1–5 Screens | `features/ceo/elicitation/ElicitationWizard.tsx` | CEO-1.0A |
| 42 | `DELETE /elicitation/sessions/{id}` | CLIENT (CEO) | 26: Elicitation Session History | `features/ceo/pages/SessionsListPage.tsx` | CEO-1.0A |
| 43 | `PUT /elicitation/sessions/{id}/stage1` | CLIENT (CEO) | 27: Stage 1 - Symptoms | `features/ceo/elicitation/Stage1Symptoms.tsx` | CEO-1.1 |
| 44 | `PUT /elicitation/sessions/{id}/stage2` | CLIENT (CEO) | 28: Stage 2 - Archetype | `features/ceo/elicitation/Stage2Archetype.tsx` | CEO-1.2 |
| 45 | `PUT /elicitation/sessions/{id}/stage3` | CLIENT (CEO) | 29: Stage 3 - Probe Questions | `features/ceo/elicitation/Stage3Probes.tsx` | CEO-1.3 |
| 46 | `PUT /elicitation/sessions/{id}/stage4` | CLIENT (CEO) | 30: Stage 4A - Technical Inputs | `features/ceo/elicitation/Stage4ScenarioA.tsx` | CEO-1.4B, CEO-1.4C |
| 47 | `PUT /elicitation/sessions/{id}/stage4-handoff` | CLIENT (TECH) | 79: Stage 4 Form (Tech Team) | `features/tech-team/stage4/Stage4Form.tsx` | TECH-1.1 |
| 48 | `POST /elicitation/sessions/{id}/stage5` | CLIENT (CEO) | 32: Stage 5 - Spec Review & Handoff | `features/ceo/elicitation/Stage5Loading.tsx` | CEO-1.6 |
| 49 | `POST /elicitation/sessions/{id}/generate-handoff-link` | CLIENT (CEO) | 31: Stage 4B - Tech Team Invite | `features/ceo/elicitation/Stage4ScenarioB.tsx`, `features/ceo/elicitation/Stage4HandoffLink.tsx` | CEO-1.4A |
| 50 | `PUT /elicitation/sessions/{id}/self-technical` | CLIENT (CEO) | 30: Stage 4A / 31: Stage 4B | `features/ceo/elicitation/ElicitationWizard.tsx` | CEO-1.4A, CEO-1.4B |
| 51 | `POST /elicitation/sessions/{id}/retry-synthesis` | CLIENT (CEO) | 32: Stage 5 - Spec Review & Handoff | `features/ceo/elicitation/Stage5Loading.tsx` | CEO-1.6 |
| 52 | `PUT /elicitation/sessions/{id}/revert` | CLIENT (CEO) | 27–31: Stage 1–4 Screens | `features/ceo/elicitation/ElicitationWizard.tsx` | CEO-1.8 |
| 53 | `PUT /elicitation/sessions/{id}/continue` | CLIENT (CEO) | 26: Elicitation Session History | `features/ceo/pages/SessionsListPage.tsx` | CEO-1.8 |
| 54 | `POST /elicitation/sessions/{id}/stage4-recommend` | CLIENT (CEO) | 30: Stage 4A - Technical Inputs | `features/ceo/elicitation/Stage4ScenarioA.tsx` | CEO-1.5 |
| 55 | `PATCH /elicitation/sessions/{id}/draft` | CLIENT (CEO) | 27: Stage 1 - Symptoms | `features/ceo/elicitation/Stage1Symptoms.tsx` | CEO-1.1 |
| 56 | `PATCH /elicitation/sessions/{id}/stage4-draft` | CLIENT | 30: Stage 4A / 79: Stage 4 Form | `features/ceo/elicitation/Stage4ScenarioA.tsx`, `features/tech-team/stage4/Stage4Form.tsx` | CEO-1.4B, TECH-1.1 |
| 57 | `GET /projects/marketplace` | EXPERT, ADMIN | 35: Project Marketplace | `features/ceo/marketplace/MarketplaceBrowse.tsx` | EXP-4.2 |
| 58 | `GET /projects/{id}` | CLIENT, EXPERT, ADMIN | 34: Project Detail / 53: Expert Project View / 78: Tech Team Project Detail | `features/ceo/pages/ProjectDetailPage.tsx`, `features/tech-team/pages/TechTeamProjectDetailPage.tsx` | CEO-1.7, EXP-4.2, TECH-78 |
| 59 | `GET /projects` | CLIENT | 33: Projects List (CEO) / 78: Tech Team Project Detail | `features/ceo/pages/ProjectsPage.tsx`, `features/tech-team/pages/TechTeamProjectsPage.tsx` | CEO-1.7, TECH-0.4 |
| 60 | `GET /projects/{id}/artifact-a` | CLIENT, EXPERT | 34: Project Detail / 53: Expert Project View | `features/ceo/pages/ProjectDetailPage.tsx` | CEO-1.7, EXP-5.1 |
| 61 | `GET /projects/{id}/artifact-b` | TECH_TEAM, EXPERT, ADMIN | 63: Artifact B View / 83: Pay-gated Doc Inbox | `features/expert/connection/ArtifactBView.tsx`, `features/tech-team/vault/ArtifactBView.tsx` | TECH-3.1, EXP-5.2 |
| 62 | `PUT /projects/{id}/name` | CLIENT (CEO) | 34: Project Detail | `features/ceo/pages/ProjectDetailPage.tsx` | CEO-1.7 |
| 63 | `PUT /projects/{id}/milestones` | CLIENT (CEO) | 34: Project Detail | `features/ceo/pages/ProjectDetailPage.tsx` | CEO-5.1 |
| 64 | `POST /projects/{id}/milestone-chat` | CLIENT, EXPERT | 36: AI Milestone Chat | `features/ceo/milestones/MilestoneChatAssistant.tsx` | CEO-5.9 |
| 65 | `GET /projects/{id}/milestone-chat/sessions` | CLIENT, EXPERT | 36: AI Milestone Chat | `features/ceo/milestones/MilestoneChatAssistant.tsx` | CEO-5.9 |
| 66 | `GET /projects/{id}/milestone-chat/sessions/{sessionId}` | CLIENT, EXPERT | 36: AI Milestone Chat | `features/ceo/milestones/MilestoneChatAssistant.tsx` | CEO-5.9 |
| 67 | `GET /matching/{projectId}/shortlist` | CLIENT (CEO) | 37: Expert Shortlist (CEO) | `features/ceo/shortlist/ShortlistView.tsx` | CEO-1.7 |
| 68 | `GET /expert-profile/me` | EXPERT | 43: Expert Profile Builder | `features/expert/profile/ExpertProfilePage.tsx` | EXP-0.2 |
| 69 | `PUT /expert-profile/me` | EXPERT | 43: Expert Profile Builder | `features/expert/profile/ExpertProfilePage.tsx`, `features/expert/profile/StackTagsPicker.tsx` | EXP-0.2 |
| 70 | `GET /expert-profile/search` | CLIENT, ADMIN | 38: Expert Profile View (CEO) | `features/ceo/marketplace/MarketplaceBrowse.tsx` | CEO-6.4 |
| 71 | `GET /expert-profile/{userId}` | CLIENT, ADMIN | 16: Public Expert Profile / 38: Expert Profile View | `features/ceo/experts/CeoExpertProfileView.tsx` | CEO-6.4, EXP-0.2 |
| 72 | `GET /expert-profile/me/domains` | EXPERT | 44: Domain Depth Grid | `features/expert/profile/DomainDepthGrid.tsx` | EXP-0.2 |
| 73 | `GET /expert-profile/me/seams` | EXPERT | 45: Seam Claims Grid | `features/expert/profile/SeamClaimsGrid.tsx` | EXP-0.2 |
| 74 | `POST /expert-profile/domains` | EXPERT | 44: Domain Depth Grid | `features/expert/profile/DomainDepthGrid.tsx` | EXP-0.2 |
| 75 | `PUT /expert-profile/domains/sync` | EXPERT | 44: Domain Depth Grid | `features/expert/profile/DomainDepthGrid.tsx` | EXP-0.2 |
| 76 | `PUT /expert-profile/domains/{id}` | EXPERT | 44: Domain Depth Grid | `features/expert/profile/DomainDepthGrid.tsx` | EXP-0.2 |
| 77 | `DELETE /expert-profile/domains/{id}` | EXPERT | 44: Domain Depth Grid | `features/expert/profile/DomainDepthGrid.tsx` | EXP-0.2 |
| 78 | `POST /expert-profile/seams` | EXPERT | 45: Seam Claims Grid | `features/expert/profile/SeamClaimsGrid.tsx` | EXP-0.2 |
| 79 | `PUT /expert-profile/seams/sync` | EXPERT | 45: Seam Claims Grid | `features/expert/profile/SeamClaimsGrid.tsx` | EXP-0.2 |
| 80 | `POST /portfolio-submissions` | EXPERT | 46: Portfolio Submit Form | `features/expert/verification/PortfolioSubmitForm.tsx` | EXP-2.1 |
| 81 | `GET /portfolio-submissions` | EXPERT | 47: Verification History | `features/expert/verification/VerificationHistoryPage.tsx` | EXP-2.3 |
| 82 | `GET /portfolio-submissions/{id}` | EXPERT, ADMIN | 48: Verification Result / Lockout | `features/expert/verification/VerificationHistoryPage.tsx` | EXP-2.3 |
| 83 | `DELETE /portfolio-submissions/me/portfolio/{id}` | EXPERT | 47: Verification History | `features/expert/verification/VerificationHistoryPage.tsx` | EXP-2.3 |
| 84 | `GET /portfolio-submissions/me/portfolio/{id}` | EXPERT | 47: Verification History | `features/expert/verification/VerificationHistoryPage.tsx` | EXP-2.3 |
| 85 | `GET /services/me` | EXPERT | 49: My Services | `features/expert/services/ExpertServicesPage.tsx`, `features/expert/services/ServiceListingsGrid.tsx` | EXP-3.3 |
| 86 | `GET /services/me/purchases` | CLIENT (CEO) | 42: My Service Orders (CEO) | `features/ceo/marketplace/MarketplaceBrowse.tsx` | CEO-2.3 |
| 87 | `GET /services` | CLIENT, EXPERT, ADMIN | 39: Service Marketplace Browse | `features/ceo/marketplace/MarketplaceBrowse.tsx` | CEO-2.1 |
| 88 | `POST /services` | EXPERT | 50: Create / Edit Service / 51: AI Service Generator | `features/expert/services/ServiceCreateModal.tsx` | EXP-3.1, EXP-3.2 |
| 89 | `GET /services/{id}` | CLIENT, EXPERT, ADMIN | 40: Service Detail (CEO) | `features/ceo/marketplace/ServiceDetail.tsx`, `features/expert/services/ServiceDetail.tsx` | CEO-2.2 |
| 90 | `PUT /services/{id}` | EXPERT | 50: Create / Edit Service | `features/expert/services/ServiceDetail.tsx`, `features/expert/services/ServiceCreateModal.tsx` | EXP-3.3 |
| 91 | `DELETE /services/{id}` | EXPERT | 49: My Services | `features/expert/services/ServiceDetail.tsx` | EXP-3.4 |
| 92 | `POST /services/{id}/purchase` | CLIENT (CEO) | 41: Service Purchase | `features/ceo/marketplace/ServiceDetail.tsx`, `features/ceo/marketplace/ServicePurchase.tsx` | CEO-2.3, CEO-2.4 |
| 93 | `PUT /services/{id}/publish` | EXPERT | 49: My Services | `features/expert/services/ServiceDetail.tsx` | EXP-3.3 |
| 94 | `PUT /services/{id}/unpublish` | EXPERT | 49: My Services | `features/expert/services/ServiceDetail.tsx` | EXP-3.3 |
| 95 | `GET /engagements` | CLIENT, EXPERT, ADMIN | 10: CEO Dash / 11: Expert Dash / 12: Tech Dash | `features/ceo/CeoDashboard.tsx`, `features/expert/ExpertDashboard.tsx`, `features/expert/projects/ExpertProjectsPage.tsx`, `features/expert/services/ExpertOrdersPage.tsx` | CEO-6.3, EXP-4.6, TECH-4.1 |
| 96 | `GET /engagements/{id}` | CLIENT, EXPERT, ADMIN | 57: Bid Detail & Negotiation / 61: CEO NDA / 62: Expert NDA | `features/ceo/connection/NdaClickThrough.tsx`, `features/expert/connection/NdaClickThrough.tsx`, `features/expert/bidding/CounterOfferReceived.tsx` | CEO-4.2, EXP-5.1 |
| 97 | `PUT /engagements/{id}/accept-nda` | CLIENT (CEO) | 61: CEO NDA Acceptance | `features/ceo/connection/NdaClickThrough.tsx` | CEO-4.2 |
| 98 | `POST /engagements/{id}/connect` | EXPERT | 62: Expert NDA & Connection Request | `features/expert/connection/NdaClickThrough.tsx` | EXP-5.1 |
| 99 | `PUT /engagements/{id}/decline` | EXPERT | 62: Expert NDA & Connection Request | `features/expert/connection/NdaClickThrough.tsx`, `features/expert/projects/ExpertProjectsPage.tsx` | EXP-5.1 |
| 100 | `GET /engagements/{id}/milestones` | CLIENT, EXPERT, ADMIN | 64: Milestone List / 73: Expert Milestone / 80: Tech Milestone | `features/ceo/milestones/MilestoneList.tsx`, `features/expert/milestones/ExpertMilestoneDetail.tsx`, `features/tech-team/milestones/MilestoneList.tsx` | CEO-5.1, EXP-7.1, TECH-4.1 |
| 101 | `GET /engagements/{id}/submissions` | CLIENT, EXPERT, ADMIN | 66: Milestone Detail / 73: Expert Milestone / 81: Tech Milestone | `features/ceo/milestones/EngagementActivity.tsx` | CEO-5.7, EXP-7.3, TECH-4.1 |
| 102 | `GET /engagements/{id}/bid` | CLIENT, EXPERT, ADMIN | 57: Bid Detail & Negotiation | `features/expert/bidding/CounterOfferReceived.tsx` | CEO-3.2, TECH-2.2 |
| 103 | `GET /engagements/{id}/disputes` | CLIENT, EXPERT, ADMIN | 66: Milestone Detail / 73: Expert Milestone / 81: Tech Milestone | `features/ceo/milestones/EngagementActivity.tsx` | CEO-5.10, EXP-7.2, TECH-4.3 |
| 104 | `PUT /engagements/{id}/cancel` | CLIENT, EXPERT, ADMIN | 64: Milestone List (CEO) / 73: Expert Milestone Detail | `features/ceo/milestones/MilestoneList.tsx` | CEO-6.2, EXP-7.2 |
| 105 | `POST /bids` | EXPERT | 54: Bid Form - Footprint & Pricing | `features/expert/bidding/BidForm.tsx` | EXP-4.3 |
| 106 | `GET /bids` | CLIENT, EXPERT, ADMIN | 56: Bid List (CEO) | `features/ceo/bids/BidList.tsx` | CEO-3.1, EXP-4.6 |
| 107 | `GET /bids/{id}` | CLIENT, EXPERT, ADMIN | 57: Bid Detail & Negotiation / 59: Tech Team Bid Review | `features/ceo/bids/BidDetail.tsx`, `features/expert/bidding/CounterOfferReceived.tsx`, `features/tech-team/bids/BidReviewDetail.tsx` | CEO-3.2, TECH-2.2 |
| 108 | `PUT /bids/{id}` | EXPERT | 54: Bid Form - Footprint & Pricing | `features/expert/bidding/BidForm.tsx` | EXP-4.5 |
| 109 | `DELETE /bids/{id}` | EXPERT | 54: Bid Form - Footprint & Pricing | `features/expert/bidding/CounterOfferReceived.tsx` | EXP-4.4 |
| 110 | `PUT /bids/{id}/tech-review` | CLIENT (TECH) | 59: Tech Team Bid Review / 60: Bid Revision Request | `features/tech-team/bids/BidApprove.tsx`, `features/tech-team/bids/BidRevisionRequest.tsx` | TECH-2.3, TECH-2.4 |
| 111 | `PUT /bids/{id}/ceo-decision` | CLIENT (CEO) | 58: CEO Bid Decision | `features/ceo/bids/BidDetail.tsx`, `features/ceo/bids/BidDecisionConfirm.tsx` | CEO-3.4, CEO-3.5 |
| 112 | `PUT /bids/{id}/counter-offer` | CLIENT (CEO) | 57: Bid Detail & Negotiation | `features/ceo/bids/CounterOfferPanel.tsx` | CEO-3.3 |
| 113 | `POST /bids/{id}/offers` | CLIENT, EXPERT | 55: Counter Offer Received / 57: Bid Detail | `features/ceo/bids/CounterOfferPanel.tsx` | CEO-3.3, EXP-4.5 |
| 114 | `POST /bids/{id}/offers/{offerId}/accept` | CLIENT, EXPERT | 55: Counter Offer Received / 57: Bid Detail | `features/ceo/bids/BidDecisionConfirm.tsx`, `features/expert/bidding/CounterOfferReceived.tsx` | CEO-3.4, EXP-4.5 |
| 115 | `POST /bids/{id}/offers/{offerId}/decline` | CLIENT, EXPERT | 55: Counter Offer Received / 57: Bid Detail | `features/ceo/bids/BidDecisionConfirm.tsx`, `features/expert/bidding/CounterOfferReceived.tsx` | CEO-3.5, EXP-4.5 |
| 116 | `POST /bids/{id}/reconcile` | CLIENT, EXPERT, ADMIN | 55: Counter Offer Received / 57: Bid Detail | `features/expert/bidding/CounterOfferReceived.tsx` | CEO-3.2, EXP-4.5 |
| 117 | `POST /disputes` | CLIENT, EXPERT | 71: File Dispute | `features/ceo/milestones/DisputeFile.tsx` | CEO-5.10, EXP-7.2, TECH-4.3 |
| 118 | `GET /disputes` | CLIENT, EXPERT, ADMIN | 93: Dispute Monitor | `features/admin/disputes/DisputeMonitor.tsx` | CEO-5.10, EXP-7.2, ADM-5.1 |
| 119 | `GET /disputes/{id}` | CLIENT, EXPERT, ADMIN | 72: Dispute Result / 94: Dispute Detail & Resolution | `features/ceo/milestones/DisputeResult.tsx`, `features/admin/disputes/DisputeDetail.tsx` | CEO-5.10A, ADM-5.2 |
| 120 | `POST /milestones` | CLIENT (CEO) | 65: Create Milestone | `features/ceo/milestones/CreateMilestone.tsx` | CEO-5.2 |
| 121 | `GET /milestones` | CLIENT, EXPERT, ADMIN | 64: Milestone List / 73: Expert Milestone / 80: Tech Milestone | `features/ceo/milestones/MilestoneList.tsx`, `features/expert/milestones/ExpertMilestoneDetail.tsx`, `features/tech-team/milestones/MilestoneList.tsx` | CEO-5.1, EXP-7.1, TECH-4.1 |
| 122 | `GET /milestones/{id}` | CLIENT, EXPERT, ADMIN | 66: Milestone Detail / 73: Expert Milestone / 81: Tech Milestone | `features/ceo/milestones/MilestoneDetail.tsx`, `features/expert/milestones/ExpertMilestoneDetail.tsx`, `features/tech-team/milestones/TechTeamMilestoneDetail.tsx` | CEO-5.7, EXP-7.1, TECH-4.1 |
| 123 | `PATCH /milestones/{id}` | CLIENT (CEO) | 66: Milestone Detail (CEO) | `features/ceo/milestones/MilestoneDetail.tsx` | CEO-5.3 |
| 124 | `DELETE /milestones/{id}` | CLIENT (CEO) | 64: Milestone List (CEO) | `features/ceo/milestones/MilestoneList.tsx` | CEO-5.4 |
| 125 | `PUT /milestones/{id}/fund` | CLIENT (CEO) | 67: Fund Milestone (QR) | `features/ceo/milestones/FundMilestone.tsx` | CEO-5.6 |
| 126 | `GET /milestones/{id}/disputes` | CLIENT, EXPERT, ADMIN | 66: Milestone Detail (CEO) | `features/ceo/milestones/MilestoneDetail.tsx` | CEO-5.10 |
| 127 | `POST /milestones/bulk` | CLIENT (CEO) | 65: Create Milestone | `features/ceo/milestones/CreateMilestone.tsx` | CEO-5.2 |
| 128 | `POST /milestones/{id}/dod/items` | CLIENT, EXPERT | 70: DoD Editor / 74: DoD Checklist | `features/expert/milestones/DodChecklist.tsx` | EXP-7.1 |
| 129 | `POST /milestones/{id}/dod/items/bulk` | CLIENT, EXPERT | 70: DoD Editor / 74: DoD Checklist | `features/expert/milestones/DodChecklist.tsx` | EXP-7.1 |
| 130 | `GET /milestones/{id}/dod` | CLIENT, EXPERT, ADMIN | 70: DoD Editor / 74: DoD Checklist | `features/ceo/milestones/DoDEditor.tsx`, `features/expert/milestones/DodChecklist.tsx` | CEO-5.7, EXP-7.1 |
| 131 | `DELETE /milestones/{id}/dod/{itemId}` | CLIENT, EXPERT | 70: DoD Editor / 74: DoD Checklist | `features/ceo/milestones/DoDEditor.tsx`, `features/expert/milestones/DodChecklist.tsx` | EXP-7.1 |
| 132 | `PUT /milestones/{id}/dod/{itemId}` | EXPERT | 74: DoD Checklist | `features/expert/milestones/DodItemRow.tsx` | EXP-7.1 |
| 133 | `PUT /criteria/{id}/verify` | CLIENT | 69: Criteria Verify / 82: Criteria Sign-Off (Tech Team) | `features/ceo/milestones/CriteriaVerify.tsx`, `features/tech-team/milestones/CriteriaVerify.tsx` | CEO-5.7, TECH-4.2 |
| 134 | `PUT /criteria/{id}/revision` | CLIENT | 69: Criteria Revision / 82: Criteria Sign-Off (Tech Team) | `features/ceo/milestones/RevisionRequest.tsx`, `features/tech-team/milestones/RevisionRequest.tsx` | CEO-5.7, TECH-4.2 |
| 135 | `GET /criteria/{milestoneId}` | CLIENT, EXPERT, ADMIN | 68: Acceptance Criteria Editor / 69: Verify / 82: Sign-Off | `features/ceo/milestones/AcceptanceCriteriaEditor.tsx` | CEO-5.5, TECH-4.2 |
| 136 | `POST /criteria/{milestoneId}` | CLIENT (CEO) | 68: Acceptance Criteria Editor | `features/ceo/milestones/AcceptanceCriteriaEditor.tsx` | CEO-5.5 |
| 137 | `DELETE /criteria/{id}` | CLIENT (CEO) | 68: Acceptance Criteria Editor | `features/ceo/milestones/AcceptanceCriteriaEditor.tsx` | CEO-5.5 |
| 138 | `POST /milestones/{id}/submit` | EXPERT | 75: Submit Deliverables | `features/expert/milestones/DeliverableSubmit.tsx` | EXP-7.2 |
| 139 | `POST /milestones/{id}/paygated-docs` | EXPERT | 76: Pay-gated Documents Staging | `features/expert/milestones/PaygatedDocsStaging.tsx` | EXP-6.1 |
| 140 | `GET /milestones/{id}/paygated-docs` | CLIENT (Tech), EXPERT | 83: Pay-gated Doc Inbox | `features/expert/milestones/ExpertMilestoneDetail.tsx` | TECH-3.2, EXP-6.2 |
| 141 | `POST /milestones/{id}/paygated-docs/bulk` | EXPERT | 76: Pay-gated Documents Staging | `features/expert/milestones/PaygatedDocsStaging.tsx` | EXP-6.1 |
| 142 | `DELETE /milestones/{id}/submissions/latest` | EXPERT | 73: Expert Milestone Detail | `features/expert/milestones/ExpertMilestoneDetail.tsx` | EXP-7.2 |
| 143 | `GET /milestones/{id}/submissions/latest` | CLIENT, EXPERT, ADMIN | 66: Milestone Detail / 73: Expert Milestone / 81: Tech Milestone | `features/ceo/milestones/MilestoneDetail.tsx`, `features/expert/milestones/ExpertMilestoneDetail.tsx`, `features/tech-team/milestones/TechTeamMilestoneDetail.tsx` | CEO-5.7, EXP-7.3 |
| 144 | `GET /milestones/{id}/submissions` | CLIENT, EXPERT, ADMIN | 66: Milestone Detail / 73: Expert Milestone / 81: Tech Milestone | `features/ceo/milestones/MilestoneDetail.tsx`, `features/expert/milestones/ExpertMilestoneDetail.tsx`, `features/tech-team/milestones/TechTeamMilestoneDetail.tsx` | CEO-5.7, EXP-7.3 |
| 145 | `GET /engagements/{id}/messages` | Authenticated | 85: Message Thread | `components/messaging/MessageThread.tsx` | CEO-4.3, TECH-2.1, EXP-5.1 |
| 146 | `GET /projects/{id}/messages` | Authenticated | 85: Message Thread | `components/messaging/MessageThread.tsx` | CEO-4.1, TECH-0.5, EXP-4.2 |
| 147 | `POST /messages/{id}/read` | Authenticated | 85: Message Thread | `components/messaging/MessageThread.tsx` | All actors |
| 148 | `GET /engagements/{id}/messages/unread-count` | Authenticated | 84: Inbox / 85: Message Thread | `components/messaging/MessageThread.tsx`, `components/layout/TopNav.tsx` | All actors |
| 149 | `GET /conversations` | Authenticated | 84: Inbox / Conversations | `components/messaging/ChatSidebar.tsx`, `components/messaging/InboxPage.tsx` | CEO-4.3, EXP-5.1 |
| 150 | `GET /projects/{id}/messages/unread-count` | Authenticated | 84: Inbox / 85: Message Thread | `components/messaging/MessageThread.tsx` | CEO-4.1, EXP-4.2 |
| 151 | `POST /conversations/{engagementId}/read` | Authenticated | 84: Inbox / Conversations | `components/messaging/MessageThread.tsx`, `components/messaging/ChatSidebar.tsx` | All actors |
| 152 | `POST /conversations/read-all` | Authenticated | 84: Inbox / Conversations | `components/layout/TopNav.tsx` | All actors |
| 153 | `GET /invitations` | EXPERT | 84: Inbox / Conversations | `features/expert/projects/ExpertProjectsPage.tsx` | EXP-1.1 |
| 154 | `POST /invitations/{id}/decline` | EXPERT | 84: Inbox / Conversations | `features/expert/projects/ExpertProjectsPage.tsx` | EXP-1.2 |
| 155 | `GET /invitations/sent` | CLIENT (CEO) | 37: Expert Shortlist (CEO) | `features/ceo/pages/ProjectDetailPage.tsx` | CEO-4.7 |
| 156 | `DELETE /invitations/{id}` | CLIENT (CEO) | 37: Expert Shortlist (CEO) | `features/ceo/pages/ProjectDetailPage.tsx` | CEO-4.6 |
| 157 | `POST /reviews` | CLIENT, EXPERT | 86: CEO Review / 87: Expert Review / 88: Tech Team Review | `components/reviews/ReviewForm.tsx` | CEO-6.1, EXP-9.1, TECH-5.1 |
| 158 | `GET /reviews/{engagementId}` | CLIENT, EXPERT, ADMIN | 86: CEO Review / 87: Expert Review / 88: Tech Team Review | `components/reviews/ReviewForm.tsx` | All parties |
| 159 | `GET /reviews/users/{userId}` | Authenticated | 16: Public Expert Profile / 38: Expert Profile View | `features/ceo/experts/CeoExpertProfileView.tsx` | All actors |
| 160 | `GET /reviews/me` | CLIENT, EXPERT | 14: My Profile / 15: Account Settings | `components/pages/UserProfilePage.tsx` | CEO-6.1, EXP-9.1 |
| 161 | `GET /reviews/me/received` | CLIENT, EXPERT | 14: My Profile / 15: Account Settings | `components/pages/UserProfilePage.tsx` | CEO-6.1, EXP-9.1 |
| 162 | `PUT /admin/projects/{id}/suspend-spec` | ADMIN | 104: Admin Projects | `features/admin/oversight/AdminProjectsPage.tsx` | ADM-4.3 |
| 163 | `PUT /admin/users/{id}/suspend` | ADMIN | 92: User Management | `features/admin/accounts/UserList.tsx` | ADM-3.3 |
| 164 | `PUT /admin/users/{id}/reactivate` | ADMIN | 92: User Management | `features/admin/accounts/UserList.tsx` | ADM-3.4 |
| 165 | `GET /admin/disputes` | ADMIN | 93: Dispute Monitor | `features/admin/disputes/DisputeMonitor.tsx` | ADM-5.1 |
| 166 | `PUT /admin/disputes/{id}/resolve` | ADMIN | 94: Dispute Detail & Resolution | `features/admin/disputes/ResolutionConfirm.tsx`, `features/admin/disputes/DisputeDetail.tsx` | ADM-5.3 |
| 167 | `GET /admin/decisions` | ADMIN | 103: Integrity Monitor & AI Log | `features/admin/integrity/IntegrityMonitor.tsx` | ADM-1.1, ADM-1.2 |
| 168 | `GET /admin/transactions` | ADMIN | 95: Transaction Ledger | `features/admin/ledger/TransactionsLedger.tsx` | ADM-2.1 |
| 169 | `GET /admin/analytics` | ADMIN | 91: Analytics Dashboard | `features/admin/analytics/AnalyticsDashboard.tsx` | ADM-7.1 |
| 170 | `GET /admin/withdrawals` | ADMIN | 96: Withdrawal Management | `features/admin/ledger/WithdrawalRequests.tsx` | ADM-2.2 |
| 171 | `PUT /admin/withdrawals/{id}/complete` | ADMIN | 96: Withdrawal Management | `features/admin/ledger/WithdrawalRequests.tsx` | ADM-2.3 |
| 172 | `PUT /admin/withdrawals/{id}/fail` | ADMIN | 96: Withdrawal Management | `features/admin/ledger/WithdrawalRequests.tsx` | ADM-2.3 |
| 173 | `GET /admin/platform-settings` | ADMIN | 97: Platform Settings | `features/admin/PlatformSettings.tsx` | ADM-2.1 |
| 174 | `PUT /admin/platform-settings` | ADMIN | 97: Platform Settings | `features/admin/PlatformSettings.tsx` | ADM-2.1 |
| 175 | `GET /admin/subscriptions/packages` | ADMIN | 98: Subscription Package Manager | `features/admin/packages/SubscriptionPackagesPage.tsx` | ADM-6.3 |
| 176 | `POST /admin/subscriptions/packages` | ADMIN | 98: Subscription Package Manager | `features/admin/packages/SubscriptionPackagesPage.tsx` | ADM-6.3 |
| 177 | `PUT /admin/subscriptions/packages/{id}` | ADMIN | 98: Subscription Package Manager | `features/admin/packages/SubscriptionPackagesPage.tsx` | ADM-6.3 |
| 178 | `DELETE /admin/subscriptions/packages/{id}` | ADMIN | 98: Subscription Package Manager | `features/admin/packages/SubscriptionPackagesPage.tsx` | ADM-6.3 |
| 179 | `GET /admin/users` | ADMIN | 92: User Management | `features/admin/accounts/UserList.tsx` | ADM-3.1 |
| 180 | `GET /admin/users/{id}` | ADMIN | 92: User Management | `features/admin/accounts/UserList.tsx` | ADM-3.2 |
| 181 | `GET /admin/projects` | ADMIN | 104: Admin Projects | `features/admin/oversight/AdminProjectsPage.tsx` | ADM-4.1 |
| 182 | `GET /admin/projects/{id}` | ADMIN | 104: Admin Projects | `features/admin/oversight/AdminProjectsPage.tsx` | ADM-4.2 |
| 183 | `GET /admin/engagements` | ADMIN | 105: Admin Engagements | `features/admin/oversight/AdminEngagementsPage.tsx` | ADM-4.5 |
| 184 | `GET /admin/experts` | ADMIN | 106: Admin Experts Overview | `features/admin/oversight/AdminExpertsPage.tsx` | ADM-3.5 |
| 185 | `PUT /admin/projects/{id}/reopen` | ADMIN | 104: Admin Projects | `features/admin/oversight/AdminProjectsPage.tsx` | ADM-4.4 |
| 186 | `GET /admin/config/domains` | ADMIN | 99: Domain & Seam Configuration | `features/admin/config/DomainSeamConfigPage.tsx` | ADM-6.1 |
| 187 | `POST /admin/config/domains` | ADMIN | 99: Domain & Seam Configuration | `features/admin/config/DomainSeamConfigPage.tsx` | ADM-6.1 |
| 188 | `PUT /admin/config/domains/{id}` | ADMIN | 99: Domain & Seam Configuration | `features/admin/config/DomainSeamConfigPage.tsx` | ADM-6.1 |
| 189 | `DELETE /admin/config/domains/{id}` | ADMIN | 99: Domain & Seam Configuration | `features/admin/config/DomainSeamConfigPage.tsx` | ADM-6.1 |
| 190 | `GET /admin/config/seams` | ADMIN | 99: Domain & Seam Configuration | `features/admin/config/DomainSeamConfigPage.tsx` | ADM-6.1 |
| 191 | `POST /admin/config/seams` | ADMIN | 99: Domain & Seam Configuration | `features/admin/config/DomainSeamConfigPage.tsx` | ADM-6.1 |
| 192 | `PUT /admin/config/seams/{id}` | ADMIN | 99: Domain & Seam Configuration | `features/admin/config/DomainSeamConfigPage.tsx` | ADM-6.1 |
| 193 | `DELETE /admin/config/seams/{id}` | ADMIN | 99: Domain & Seam Configuration | `features/admin/config/DomainSeamConfigPage.tsx` | ADM-6.1 |
| 194 | `GET /admin/config/archetypes` | ADMIN | 100: Archetype & Probe Question Config | `features/admin/config/ArchetypeConfigPage.tsx` | ADM-6.1 |
| 195 | `POST /admin/config/archetypes` | ADMIN | 100: Archetype & Probe Question Config | `features/admin/config/ArchetypeConfigPage.tsx` | ADM-6.1 |
| 196 | `PUT /admin/config/archetypes/{id}` | ADMIN | 100: Archetype & Probe Question Config | `features/admin/config/ArchetypeConfigPage.tsx` | ADM-6.1 |
| 197 | `DELETE /admin/config/archetypes/{id}` | ADMIN | 100: Archetype & Probe Question Config | `features/admin/config/ArchetypeConfigPage.tsx` | ADM-6.1 |
| 198 | `GET /admin/config/probe-questions` | ADMIN | 100: Archetype & Probe Question Config | `features/admin/config/ArchetypeConfigPage.tsx` | ADM-6.1 |
| 199 | `POST /admin/config/probe-questions` | ADMIN | 100: Archetype & Probe Question Config | `features/admin/config/ArchetypeConfigPage.tsx` | ADM-6.1 |
| 200 | `PUT /admin/config/probe-questions/{id}` | ADMIN | 100: Archetype & Probe Question Config | `features/admin/config/ArchetypeConfigPage.tsx` | ADM-6.1 |
| 201 | `DELETE /admin/config/probe-questions/{id}` | ADMIN | 100: Archetype & Probe Question Config | `features/admin/config/ArchetypeConfigPage.tsx` | ADM-6.1 |
| 202 | `GET /admin/config/void-codes` | ADMIN | 101: Void Code Configuration | `features/admin/config/VoidCodesConfigPage.tsx` | ADM-6.2 |
| 203 | `POST /admin/config/void-codes` | ADMIN | 101: Void Code Configuration | `features/admin/config/VoidCodesConfigPage.tsx` | ADM-6.2 |
| 204 | `PUT /admin/config/void-codes/{id}` | ADMIN | 101: Void Code Configuration | `features/admin/config/VoidCodesConfigPage.tsx` | ADM-6.2 |
| 205 | `DELETE /admin/config/void-codes/{id}` | ADMIN | 101: Void Code Configuration | `features/admin/config/VoidCodesConfigPage.tsx` | ADM-6.2 |
| 206 | `GET /admin/prompts` | ADMIN | 102: Prompt Template Config | `features/admin/config/PromptConfigPage.tsx` | ADM-6.4 |
| 207 | `GET /admin/prompts/{stage}` | ADMIN | 102: Prompt Template Config | `features/admin/config/PromptConfigPage.tsx` | ADM-6.4 |
| 208 | `PUT /admin/prompts/{stage}` | ADMIN | 102: Prompt Template Config | `features/admin/config/PromptConfigPage.tsx` | ADM-6.4 |
| 209 | `DELETE /admin/prompts/{stage}` | ADMIN | 102: Prompt Template Config | `features/admin/config/PromptConfigPage.tsx` | ADM-6.4 |
| 210 | `GET /config/domains` | Unauthenticated | 27: Stage 1 / 44: Domain Depth / 50: Service Form / 54: Bid Form | `hooks/use-config.ts` | Public CMS |
| 211 | `GET /config/seams` | Unauthenticated | 27: Stage 1 / 45: Seam Claims / 50: Service Form / 54: Bid Form | `hooks/use-config.ts` | Public CMS |
| 212 | `GET /config/archetypes` | Unauthenticated | 28: Stage 2 - Archetype | `hooks/use-config.ts` | Public CMS |
| 213 | `GET /config/archetypes/{code}/probe-questions` | Unauthenticated | 29: Stage 3 - Probe Questions | `hooks/use-config.ts` | Public CMS |
| 214 | `GET /config/subscription-packages` | Unauthenticated | 24: Subscription Plans | `hooks/use-config.ts` | Public CMS |
| 215 | `GET /config/void-codes` | Unauthenticated | 28: Stage 2 - Archetype | `hooks/use-config.ts` | Public CMS |
| 216 | `GET /config/all` | Unauthenticated | App Bootstrap (All Screens) | `hooks/use-config.ts` | Public CMS |
| 217 | `GET /internal/prompts/{stage}` | Internal S2S | — (FastAPI Microservice Loader) | `backend/src/internal/internal.controller.ts` | SYS-0 |
| 218 | `GET /notifications/me` | Authenticated | 89: Notifications | `components/notifications/NotificationSystem.tsx` | EXP-4.1, All actors |
| 219 | `GET /notifications/me/unread-count` | Authenticated | TopNav Header | `components/layout/TopNav.tsx` | Nav Badge |
| 220 | `PUT /notifications/{id}/read` | Authenticated | 89: Notifications | `components/notifications/NotificationSystem.tsx` | All actors |
| 221 | `PUT /notifications/read-all` | Authenticated | 89: Notifications | `components/notifications/NotificationSystem.tsx` | All actors |
| 222 | `DELETE /notifications/{id}` | Authenticated | 89: Notifications | `components/notifications/NotificationSystem.tsx` | All actors |
| 223 | `GET /health` | System | — | `backend/src/app.controller.ts` | Health probe |