# AITasker — Complete Use Case Specifications (200 Use Cases · 18 Diagrams)
**Schema Ground Truth:** 40 Tables · **API Surface:** 213 Endpoints · **Microservices:** NestJS + FastAPI  
**Date:** July 2026

---

## Notation Key & Global Conventions

```
UC_BASE  ---<<include>>--->  UC_SUB    Arrow FROM base TO included UC (mandatory sub-behaviour)
UC_EXT   ---<<extend>>---->  UC_BASE   Arrow FROM extending UC TO base (conditional / optional behaviour)
```

- **All Use Case IDs (UC001–UC200)** map 1:1 to the 200 Use Cases documented across the 18 Use Case Diagrams (**D01–D18**) in the Software Requirement Specification (SRS).
- **Primary DB Tables:** Table names correspond strictly to the 40-table physical schema in `schema.prisma`.
- **State Enums:** Match database column values on `elicitation_sessions`, `projects`, `engagements`, `capability_bids`, `milestones`, `disputes`, `services`, `paygated_documents`, `withdrawal_requests`, `invitations`, `notifications`.

---

## Diagram to Use Case Mapping Overview

| Diagram ID | Diagram Name | Covered Use Cases | Count |
|:---:|---|:---:|:---:|
| **D01** | Identity, Access, and User Profile | UC001 – UC018 | 18 |
| **D02** | Wallet, Bank Linking, Withdrawals, and Subscriptions | UC019 – UC030 | 12 |
| **D03** | Five-Stage Elicitation and Tech Team Handoff | UC031 – UC046 | 16 |
| **D04** | Projects, Artifacts, Milestone Planning Chat, and Expert Matching | UC047 – UC058 | 12 |
| **D05** | Expert Capability Profile and Portfolio Evidence | UC059 – UC073 | 15 |
| **D06** | Service Marketplace and Direct Purchase | UC074 – UC083 | 10 |
| **D07** | Invitations and Bid Entry | UC084 – UC092 | 9 |
| **D08** | Technical Review and Commercial Negotiation | UC093 – UC097 | 5 |
| **D09** | Engagements Workspace & Connections | UC098 – UC107 | 10 |
| **D10** | Milestones & Acceptance Criteria Management | UC108 – UC120 | 13 |
| **D11** | DoD Execution, Submissions, and Pay-Gated Documents | UC121 – UC132 | 12 |
| **D12** | Dispute Filing, AI Evaluation, and Manual Resolution | UC133 – UC135 | 3 |
| **D13** | Messaging, Reviews, and Notifications | UC136 – UC152 | 17 |
| **D14** | Admin User, Project, Expert, and Engagement Oversight | UC153 – UC162 | 10 |
| **D15** | Admin Finance, Analytics, Withdrawals, and Subscriptions | UC163 – UC169, UC173 – UC176 | 11 |
| **D16** | CMS Domain and Seam Definitions | UC177 – UC184 | 8 |
| **D17** | CMS Archetypes, Probe Questions, and Void Codes | UC185 – UC196 | 12 |
| **D18** | CMS Prompt Templates | UC197 – UC200 | 4 |
| **Total** | **18 Diagrams** | **UC001 – UC200** | **200 Use Cases** |

---

# Detailed Use Case Specifications

---

## Section 1 — User Authentication & Identity Management (Diagram D01)

### UC001 — Register Account
- **Primary Actor:** Unauthenticated Guest (CEO or Expert)
- **API:** `POST /auth/register`
- **Gate:** `[None]`
- **Tables Written:** `users`, `client_profiles` OR `expert_profiles`, `wallets`, `virtual_accounts`
- **Preconditions:** Email must be globally unique; domain must have valid MX records and not be disposable.
- **Main Flow:**
  1. Guest submits full name, email, password, phone, role (`CLIENT_CEO` or `EXPERT`), and optional self-technical flag.
  2. System normalizes email to lowercase and validates password against complexity rules (min 8 chars, uppercase, lowercase, number, special char).
  3. Atomic DB transaction:
     - Creates `users` row (`is_email_verified = false`, `email_otp` generated).
     - Creates `client_profiles` or `expert_profiles` row.
     - Creates `wallets` row (`available_balance = 0`, `locked_balance = 0`).
     - Creates permanent `virtual_accounts` row (`entity_type = 'WALLET_TOPUP'`, `status = 'ACTIVE'`).
  4. System dispatches 6-digit OTP to user email via Nodemailer. Returns success message `OTP_SENT`.
- **Extensions:**
  - *Password fails rules:* Returns 400 with array of all failing password rules.
  - *Duplicate email:* Returns 409 Conflict.
  - *Invalid/Disposable domain:* Returns 400 Bad Request.
- **Postconditions:** Unverified user record and wallet created; 15-minute OTP sent to email.

### UC002 — Register via Tech Team Handoff
- **Primary Actor:** Invited Tech Team Member
- **API:** `POST /auth/register/handoff`
- **Gate:** `[None]`
- **Tables Written:** `users`, `tech_team_profiles`, `wallets`, `virtual_accounts`, `elicitation_sessions`
- **Preconditions:** Actor possesses a valid 72-hour handoff JWT issued by a CEO during Stage 4 elicitation.
- **Main Flow:**
  1. Actor opens handoff link and submits registration credentials (`invite_token`, email, password, fullName).
  2. System verifies token signature, expiry (`exp`), and ensures `handoffConsumedAt IS NULL`.
  3. Atomic DB transaction:
     - Creates `users` row (`active_role = 'CLIENT'`, `client_subtype = 'TECH_TEAM'`).
     - Creates `tech_team_profiles` row with `linked_client_id = ceoId` and `linked_project_id` (if project already created).
     - Updates `elicitation_sessions.handoff_consumed_at = now()`.
     - Creates `wallets` and `WALLET_TOPUP` virtual account.
  4. Dispatches registration OTP email to Tech Team member.
- **Extensions:**
  - *Expired / invalid link:* Returns 401 Unauthorized (`LINK_EXPIRED`).
  - *Already consumed link:* Returns 401 Unauthorized.
- **Postconditions:** Tech Team user created and linked to CEO client account.

### UC003 — Verify Email (OTP)
- **Primary Actor:** Unverified User
- **API:** `POST /auth/verify-otp`
- **Gate:** `[None]`
- **Tables Written:** `users`
- **Preconditions:** Account exists; `is_email_verified = false`.
- **Main Flow:**
  1. User submits email and 6-digit `otp`.
  2. System verifies submitted OTP matches `users.email_otp` and `email_otp_expires_at > now()`.
  3. Updates `users.is_email_verified = true`, `email_otp = NULL`, `email_otp_expires_at = NULL`.
  4. System signs and returns JWT `access_token` and `refresh_token`.
- **Extensions:**
  - *Expired OTP:* System auto-generates fresh 6-digit OTP, updates expiry, sends new email, and returns 400 Bad Request informing user to check email.
  - *Invalid OTP:* Returns 400 Bad Request.
- **Postconditions:** User verified and logged in.

### UC004 — Resend Verification OTP
- **Primary Actor:** Unverified User
- **API:** `POST /auth/resend-otp`
- **Gate:** `[None]`
- **Tables Written:** `users`
- **Main Flow:**
  1. User requests new OTP by providing email.
  2. System checks `users.is_email_verified == false`.
  3. Generates fresh 6-digit code, sets `email_otp_expires_at = now() + 15 mins`, and dispatches email.
- **Postconditions:** Fresh OTP generated and emailed.

### UC005 — Login
- **Primary Actor:** Authenticated User
- **API:** `POST /auth/login`
- **Gate:** `[None]`
- **Tables Written:** `users` (updates `email_otp` if unverified)
- **Main Flow:**
  1. User submits email and password.
  2. System validates email and compares bcrypt password hash.
  3. Checks `users.is_active == true` (returns 401 if suspended).
  4. Checks `users.is_email_verified == true`.
     - *If false:* Generates fresh OTP, dispatches email, and returns HTTP 401 with message `EMAIL_UNVERIFIED`.
  5. On success: generates access token and refresh token, stores SHA-256 token hash in `users.refresh_token_hash`, and returns tokens + user object.
- **Postconditions:** JWT access token and refresh token issued.

### UC006 — Logout
- **Primary Actor:** Authenticated User
- **API:** `POST /auth/logout`
- **Gate:** `[None]`
- **Tables Written:** `users`
- **Main Flow:**
  1. User calls logout endpoint with Bearer access token.
  2. System sets `users.refresh_token_hash = NULL`, revoking all active refresh sessions server-side.
- **Postconditions:** Server-side refresh token invalidated.

### UC007 — Switch Active Role
- **Primary Actor:** Multi-role User
- **API:** `PUT /auth/switch-role`
- **Gate:** `[None]`
- **Tables Written:** `users`
- **Preconditions:** Target `activeRole` exists in `users.roles` JSON array.
- **Main Flow:**
  1. User submits target `activeRole` (`CLIENT` or `EXPERT`).
  2. System validates role eligibility, updates `users.active_role = activeRole`.
  3. Generates and returns new access token with updated role/subscription claims.
- **Postconditions:** User operating context switched; new JWT issued.

### UC008 — Refresh Access Token
- **Primary Actor:** Authenticated User / FE Interceptor
- **API:** `POST /auth/refresh`
- **Gate:** `[None]`
- **Tables Written:** `users`
- **Main Flow:**
  1. FE submits `refresh_token`.
  2. System verifies JWT signature (`type == 'refresh'`), hashes token with SHA-256, and compares against `users.refresh_token_hash`.
  3. Issues fresh `access_token` and `refresh_token` pair and updates stored hash.
- **Extensions:**
  - *Token mismatch or logged out:* Returns 401 Unauthorized.
- **Postconditions:** New access token issued without full login.

### UC009 — Forgot Password
- **Primary Actor:** Unauthenticated User
- **API:** `POST /auth/forgot-password`
- **Gate:** `[None]`
- **Tables Written:** `users`
- **Main Flow:**
  1. User submits email address.
  2. System checks if active user exists. If yes: writes 32-byte hex `password_reset_token` and 1-hour expiry to `users`, and sends reset email.
  3. Always returns generic message to prevent email enumeration.
- **Postconditions:** Reset token generated and link emailed (if account exists).

### UC010 — Verify Reset Token
- **Primary Actor:** Unauthenticated User
- **API:** `GET /auth/verify-reset-token/{token}`
- **Gate:** `[None]`
- **Tables Read:** `users`
- **Main Flow:**
  1. FE pre-flight check when user clicks reset email link.
  2. System validates token exists and `password_reset_token_expires_at > now()`.
  3. Returns `{ valid: true }` if unexpired; HTTP 400 if invalid/expired.
- **Postconditions:** Token validity confirmed for FE rendering.

### UC011 — Reset Password
- **Primary Actor:** Unauthenticated User
- **API:** `POST /auth/reset-password`
- **Gate:** `[None]`
- **Tables Written:** `users`
- **Main Flow:**
  1. User submits `token` and `newPassword`.
  2. System validates token and password complexity rules.
  3. Updates `password_hash`, sets `password_reset_token = NULL`, `password_reset_token_expires_at = NULL`, and clears `refresh_token_hash = NULL` (forces re-login across all devices).
- **Postconditions:** Password reset complete; all active sessions revoked.

### UC012 — Change Password
- **Primary Actor:** Authenticated User
- **API:** `PUT /auth/me/password`
- **Gate:** `[None]`
- **Tables Written:** `users`
- **Main Flow:**
  1. Authenticated user submits `currentPassword` and `newPassword`.
  2. System validates `currentPassword` against stored hash.
  3. Hashes `newPassword`, updates DB, and clears `refresh_token_hash = NULL`.
- **Postconditions:** Password updated; user logged out on all devices.

---

## Section 2 — User Profile Management & Verification (Diagram D01 & D02)

### UC013 — View Own Profile
- **Primary Actor:** Authenticated User
- **API:** `GET /users/me`
- **Tables Read:** `users`, `client_profiles`, `expert_profiles`
- **Main Flow:** Returns current user account details, active profile, bank link status, and subscription tier.

### UC014 — Update Own Profile
- **Primary Actor:** Authenticated User
- **API:** `PUT /users/me`
- **Tables Written:** `users`, `client_profiles`
- **Main Flow:** Updates editable user fields (`fullName`, `phone`, `companyName`, `industry`, `ceoName`).

### UC015 — View Public Expert Profile
- **Primary Actor:** CLIENT / CEO, ADMIN
- **API:** `GET /users/{userId}/public-profile`
- **Tables Read:** `users`, `expert_profiles`, `expert_domain_depths`, `expert_seam_claims`, `reviews`, `services`
- **Main Flow:** Returns public profile card: bio, engagement model, stack tags, domain depths, verified seams, review summary, and active marketplace listings.

### UC016 — Add a Second Role
- **Primary Actor:** Authenticated User (Single-role)
- **API:** `POST /users/me/add-role`
- **Tables Written:** `users`, `client_profiles` OR `expert_profiles`
- **Main Flow:** Appends new role (`CLIENT_CEO` or `EXPERT`) to `users.roles` array and creates corresponding role profile row.

### UC017 — Update Tax Code
- **Primary Actor:** CLIENT (CEO)
- **API:** `PUT /users/me/tax-code`
- **Tables Written:** `client_profiles`
- **Includes:** `<<include>> UC018 Verify Company Tax Code`
- **Main Flow:** CEO submits company tax code. Invokes tax verification API. On success, updates `company_name`.

### UC018 — Verify Company Tax Code
- **Primary Actor:** System / CLIENT
- **API:** `POST /auth/verify-tax-code`
- **External Integration:** VietQR Business API (`api.vietqr.io/v2/business/{taxCode}`)
- **Main Flow:** Queries VietQR registry. On response code `"00"`, returns `{ verified: true, companyName }`.

---

## Section 3 — Wallet, Finance & Withdrawals (Diagram D02)

### UC019 — View Wallet Balance
- **Primary Actor:** CLIENT, EXPERT
- **API:** `GET /wallets/me`
- **Tables Read:** `wallets`
- **Main Flow:** Returns `availableBalance` and `lockedBalance` in VND.

### UC020 — View Transaction History
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /wallets/me/transactions`
- **Tables Read:** `wallet_transactions`, `milestones`, `engagements`, `services`, `projects`
- **Main Flow:** Returns paginated ledger transactions with human-readable milestone and project names parsed from `reference_id`.

### UC021 — Top Up Wallet via VietQR
- **Primary Actor:** CLIENT, EXPERT
- **API:** `POST /wallets/virtual-accounts/topup`
- **Tables Read:** `virtual_accounts`
- **Main Flow:** Fetches user's permanent `WALLET_TOPUP` virtual account and returns VietQR QR code image URL and memo string.
- **S2S Extension:** Inbound bank transfer fires SePay IPN webhook (`POST /webhooks/sepay/ipn`) → HMAC verified → credits `wallets.available_balance` → writes `TOP_UP` ledger entry → emits `wallet:balance-updated` WebSocket event.

### UC022 — Initiate Bank Account Link
- **Primary Actor:** EXPERT
- **API:** `POST /bank-hub/initiate-link`
- **Tables Written:** `users`
- **Main Flow:** Expert submits bank account number (`bank_account_xid`) and account holder name. System saves bank link details and timestamps `bank_linked_at`.

### UC023 — Confirm Bank Account Link
- **Primary Actor:** EXPERT / SePay Webhook
- **API:** `PUT /bank-hub/link` OR `POST /webhooks/sepay/bank-linked`
- **Tables Written:** `users`
- **Main Flow:** Updates or confirms linked bank account details for milestone payout disbursements.

### UC024 — View Bank Account Link Status
- **Primary Actor:** EXPERT
- **API:** `GET /bank-hub/link`
- **Tables Read:** `users`
- **Main Flow:** Returns current bank account link status, account number XID, holder name, and linkage timestamp.

### UC025 — Request Manual Withdrawal
- **Primary Actor:** EXPERT
- **API:** `POST /withdrawals`
- **Tables Written:** `wallets`, `withdrawal_requests`, `wallet_transactions`
- **Preconditions:** Expert has linked bank account (`sepay_bank_account_xid IS NOT NULL`) and `available_balance >= amount`.
- **Main Flow:**
  1. Expert requests withdrawal amount.
  2. Atomic transaction:
     - Debits `wallets.available_balance -= amount`.
     - Logs `WITHDRAWAL` entry in `wallet_transactions`.
     - Inserts `withdrawal_requests` row (`type = 'EXPERT_MANUAL'`, `status = 'PENDING'`).
  3. Returns withdrawal request ID and pending status.

### UC026 — View Withdrawal History
- **Primary Actor:** EXPERT
- **API:** `GET /withdrawals`
- **Tables Read:** `withdrawal_requests`
- **Main Flow:** Returns history of expert manual and automatic milestone release withdrawal requests.

### UC027 — Cancel Withdrawal Request
- **Primary Actor:** EXPERT
- **API:** `DELETE /withdrawals/{id}`
- **Tables Written:** `withdrawal_requests`, `wallets`, `wallet_transactions`
- **Preconditions:** Request status is `PENDING`.
- **Main Flow:** Cancels pending withdrawal request. Atomically restores `wallets.available_balance += amount` and logs a `WITHDRAWAL_REFUND` ledger transaction.

---

## Section 4 — Subscriptions & Feature Gating (Diagram D02)

### UC028 — View Subscription Status
- **Primary Actor:** CLIENT, EXPERT
- **API:** `GET /subscriptions/status`
- **Tables Read:** `users`
- **Main Flow:** Evaluates subscription expiry at query time. Returns current tier (`free` or `pro`), expiration timestamp, and `isExpired` boolean.

### UC029 — View Subscription History
- **Primary Actor:** CLIENT, EXPERT
- **API:** `GET /subscriptions/history`
- **Tables Read:** `subscription_purchase_logs`, `subscription_packages`
- **Main Flow:** Returns list of all past subscription activations with package name, role, price paid, purchase date, and expiry date.

### UC030 — Activate Subscription
- **Primary Actor:** CLIENT (CEO), EXPERT
- **API:** `POST /subscriptions/activate`
- **Tables Written:** `wallets`, `wallet_transactions`, `users`, `subscription_purchase_logs`
- **Includes:** `<<include>> UC019 View Wallet Balance`
- **Preconditions:** User operates in matching active role; package is active; `wallets.available_balance >= package.price_vnd`.
- **Main Flow:**
  1. User selects `packageId`.
  2. Atomic transaction:
     - Debits `wallets.available_balance -= price_vnd`.
     - Writes `SUBSCRIPTION` transaction in `wallet_transactions`.
     - Creates `subscription_purchase_logs` record.
     - Updates `users.subscription_{role}_tier = 'pro'` and sets expiration date (`sub_*_expires_at = now + duration_months`).
  3. Re-issues and returns a new access JWT containing updated subscription tier claims.

---

## Section 5 — AI-Driven Project Elicitation Engine (Diagram D03)

### UC031 — Create Elicitation Session
- **Primary Actor:** CLIENT (CEO)
- **API:** `POST /elicitation/sessions`
- **Gate:** `[Pro-C]`
- **Tables Written:** `elicitation_sessions`
- **Main Flow:** Creates new elicitation session in `IN_PROGRESS` state at Stage 1 (or returns existing active session).

### UC032 — View Active Session
- **Primary Actor:** CLIENT (CEO)
- **API:** `GET /elicitation/sessions/active`
- **Gate:** `[Pro-C]`
- **Tables Read:** `elicitation_sessions`
- **Main Flow:** Returns current `IN_PROGRESS` session or null.

### UC033 — View Session History
- **Primary Actor:** CLIENT (CEO)
- **API:** `GET /elicitation/sessions/history`
- **Gate:** `[Pro-C]`
- **Tables Read:** `elicitation_sessions`
- **Main Flow:** Returns list of `ABANDONED` and `RETURNED` sessions.

### UC034 — Submit Stage 1 - Symptoms
- **Primary Actor:** CLIENT (CEO)
- **API:** `PUT /elicitation/sessions/{id}/stage1`
- **Gate:** `[Pro-C]`
- **Tables Written:** `elicitation_sessions`
- **Includes:** `<<include>> UC031 Create Elicitation Session`
- **Main Flow:** Submits problem description text. Calls FastAPI `/llm/elicitation/stage1-extract` with CMS archetypes and void codes. Stores extracted symptoms, scale signals, void codes, recommended archetypes, budget estimate, and critical required technical artifacts. Advances session to Stage 2.

### UC035 — Submit Stage 2 - Archetype Selection
- **Primary Actor:** CLIENT (CEO)
- **API:** `PUT /elicitation/sessions/{id}/stage2`
- **Gate:** `[Pro-C]`
- **Tables Written:** `elicitation_sessions`
- **Main Flow:** Locks project archetype code and acknowledges detected void codes (`injected = true`). Advances session to Stage 3.

### UC036 — Submit Stage 3 - Answer Probe Questions
- **Primary Actor:** CLIENT (CEO)
- **API:** `PUT /elicitation/sessions/{id}/stage3`
- **Gate:** `[Pro-C]`
- **Tables Written:** `elicitation_sessions`
- **Main Flow:** Submits probe Q&A map. Calls FastAPI `/llm/elicitation/stage3-vagueness-check`. If vague or irrelevant answers detected, returns advisory flags. On pass, advances session to Stage 4 and sets `scenarioType` (`SCENARIO_A` if self-technical, `SCENARIO_B` if non-technical).

### UC037 — Request Stage 4 Archetype Recommendation
- **Primary Actor:** CLIENT (CEO)
- **API:** `POST /elicitation/sessions/{id}/stage4-recommend`
- **Gate:** `[Pro-C]`
- **Main Flow:** Calls FastAPI `/llm/elicitation/stage4-recommend` to generate recommended tech stack, integration method, and volume scale for non-technical CEOs.

### UC038 — Submit Stage 4 - Technical Inputs (Scenario A / Self-Technical)
- **Primary Actor:** CLIENT (CEO)
- **API:** `PUT /elicitation/sessions/{id}/stage4`
- **Gate:** `[Pro-C]`
- **Tables Written:** `elicitation_sessions`
- **Main Flow:** Submits current stack, available data, latency requirements, and artifact contents. Calculates missing critical artifacts (surfaced as warnings). Advances session to Stage 5.

### UC039 — Invite Tech Team (Stage 4B / Scenario B)
- **Primary Actor:** CLIENT (CEO)
- **API:** `POST /elicitation/sessions/{id}/generate-handoff-link`
- **Gate:** `[Pro-C]`
- **Tables Written:** `elicitation_sessions`
- **Main Flow:** Generates a 72-hour signed handoff JWT invite link (`purpose = 'tech-team-handoff'`) and updates `handoffTokenJti`.

### UC040 — Submit Stage 4 Draft (Patch / Autosave)
- **Primary Actor:** CLIENT (CEO or Tech Team)
- **API:** `PATCH /elicitation/sessions/{id}/stage4-draft`
- **Gate:** `[Pro-C]`
- **Tables Written:** `elicitation_sessions`
- **Main Flow:** Autosaves Stage 4 form inputs to `stage4DraftJson` without executing LLM calls or advancing the stage.

### UC041 — Run Stage 5 - AI Project Synthesis & Quality Gate
- **Primary Actor:** CLIENT (CEO)
- **API:** `POST /elicitation/sessions/{id}/stage5`
- **Gate:** `[Pro-C]`
- **Tables Written:** `projects`, `elicitation_sessions`, `tech_team_profiles`, `platform_decisions`
- **Main Flow:**
  1. Assembles Stage 1–4 payloads and live CMS definitions.
  2. Calls FastAPI `/llm/elicitation/stage5-synthesize` (up to 90s timeout).
  3. Receives `required_seams_json`, `required_domains_json`, `milestone_framework_json`, `artifact_a_json`, `artifact_b_json`, and `completeness_score`.
  4. Evaluates Quality Gate:
     - **Pass (Completeness ≥ 0.70 & No Unresolved HIGH Voids & Candidate Match ≥ 1):** Creates `projects` row (`state = 'PUBLISHED'`), completes session (`state = 'COMPLETED'`), links Tech Team profile (`linked_project_id`), logs `ELICITATION_SYNTHESIS` decision, and fires `project.published` event to seed shortlist cache.
     - **Fail:** Sets session `state = 'RETURNED'`, sets `currentStage` to return stage, and logs `SPEC_AUTO_RETURN` decision.

### UC042 — Retry Stage 5 Synthesis
- **Primary Actor:** CLIENT (CEO)
- **API:** `POST /elicitation/sessions/{id}/retry-synthesis`
- **Gate:** `[Pro-C]`
- **Tables Written:** `projects`, `elicitation_sessions`, `platform_decisions`
- **Main Flow:** Re-executes Stage 5 synthesis on a previously returned or failed session.

### UC043 — Generate Project Handoff Link
- **Primary Actor:** CLIENT (CEO)
- **API:** `POST /elicitation/sessions/{id}/generate-handoff-link`
- **Gate:** `[Pro-C]`
- **Main Flow:** Generates shareable URL containing the handoff JWT for Tech Team delegation.

### UC044 — Revert Session to Earlier Stage
- **Primary Actor:** CLIENT (CEO)
- **API:** `PUT /elicitation/sessions/{id}/revert`
- **Gate:** `[Pro-C]`
- **Tables Written:** `elicitation_sessions`
- **Main Flow:** Reverts session `currentStage` back to a previous stage (1–4) and sets state to `IN_PROGRESS`.

### UC045 — Abandon Elicitation Session
- **Primary Actor:** CLIENT (CEO)
- **API:** `PUT /elicitation/sessions/{id}/abandon`
- **Gate:** `[Pro-C]`
- **Tables Written:** `elicitation_sessions`
- **Main Flow:** Sets session `state = 'ABANDONED'`.

### UC046 — Set Self-Technical Flag
- **Primary Actor:** CLIENT (CEO)
- **API:** `PUT /elicitation/sessions/{id}/self-technical`
- **Gate:** `[Pro-C]`
- **Tables Written:** `users`
- **Main Flow:** Toggles project-specific self-technical preference on `users.selfTechnicalProjects` and re-issues access JWT.

---

## Section 6 — Project Management, Specs & Artifacts (Diagram D04)

### UC047 — View Own Projects
- **Primary Actor:** CLIENT (CEO or Tech Team)
- **API:** `GET /projects`
- **Tables Read:** `projects`, `tech_team_profiles`
- **Main Flow:** Returns projects owned by CEO or linked to Tech Team. Supports `?slim=true` parameter.

### UC048 — View Project Details
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /projects/{id}`
- **Tables Read:** `projects`, `tech_team_profiles`
- **Main Flow:** Returns full project specification including required domains, required seams, and milestone framework template.

### UC049 — Browse Project Marketplace
- **Primary Actor:** EXPERT, ADMIN
- **API:** `GET /projects/marketplace`
- **Tables Read:** `projects`
- **Main Flow:** Returns published marketplace projects (`state = 'PUBLISHED'`), filterable by `archetype`, `tier`, and `limit`.

### UC050 — View Artifact A (Business Spec)
- **Primary Actor:** CLIENT, EXPERT
- **API:** `GET /projects/{id}/artifact-a`
- **Tables Read:** `projects`
- **Main Flow:** Returns public business specification (`artifactAJson`): project name, business intent, archetype, stack tags, volume tier, and SDLC notices.

### UC051 — View Artifact B (Tech Spec)
- **Primary Actor:** CLIENT (Tech Team only), EXPERT, ADMIN
- **API:** `GET /projects/{id}/artifact-b`
- **Tables Read:** `projects`, `engagements`, `capability_bids`
- **Route Guard:** Invokes FastAPI Artifact B guard. Permanent exclusion for CLIENT CEOs. Requires engagement state `CONNECTED`/`ACTIVE`, approved bid, and dual signed NDAs.
- **Main Flow:** Returns confidential technical specification (`artifactBJson`): stack tags, integration methods, legacy data volume, schemas, and contracts.

### UC052 — Update Project Name
- **Primary Actor:** CLIENT (CEO)
- **API:** `PUT /projects/{id}/name`
- **Tables Written:** `projects`
- **Main Flow:** Updates `projectName`. Emits Socket.io `project:updated` event to linked Tech Team members.

### UC053 — Update Milestone Framework
- **Primary Actor:** CLIENT (CEO)
- **API:** `PUT /projects/{id}/milestones`
- **Tables Written:** `projects`
- **Preconditions:** Contract terms are not locked (`MILESTONE_TERMS_LOCKED` check).
- **Main Flow:** Updates `milestoneFrameworkJson` template on the project record.

---

## Section 7 — AI Milestone Planning Chat Assistant (Diagram D04)

### UC054 — Start Milestone Chat Session
- **Primary Actor:** CLIENT, EXPERT
- **API:** `POST /projects/{id}/milestone-chat`
- **Tables Written:** `milestone_chat_sessions`
- **Main Flow:** Initializes a new AI chat session for milestone framework planning. Injects Artifact A, milestone framework, and budget context. Returns AI reply and optional structured `suggestedEdit`.

### UC055 — Continue Chat Session
- **Primary Actor:** CLIENT, EXPERT
- **API:** `POST /projects/{id}/milestone-chat`
- **Tables Written:** `milestone_chat_sessions`
- **Main Flow:** Sends user message with `chatSessionId`. Loads conversation history from DB, queries FastAPI, appends exchange, and updates session `messagesJson`.

### UC056 — View All Chat Sessions
- **Primary Actor:** CLIENT, EXPERT
- **API:** `GET /projects/{id}/milestone-chat/sessions`
- **Tables Read:** `milestone_chat_sessions`
- **Main Flow:** Returns list of all milestone chat sessions for a project with titles and message counts.

---

## Section 8 — Expert Matching Engine & Shortlisting (Diagram D04)

### UC057 — View Project Shortlist
- **Primary Actor:** CLIENT (CEO)
- **API:** `GET /matching/{projectId}/shortlist`
- **Gate:** `[Pro-C]`
- **Tables Read/Written:** `project_shortlist_cache`, `users`, `invitations`
- **Main Flow:** Returns AI-scored and ranked expert candidate list from `project_shortlist_cache`. Joins expert contact details and current project invitation status. Strips raw composite score values before returning.

### UC058 — Force Refresh Shortlist
- **Primary Actor:** CLIENT (CEO)
- **API:** `GET /matching/{projectId}/shortlist?refresh=true`
- **Gate:** `[Pro-C]`
- **Tables Written:** `project_shortlist_cache`
- **Main Flow:** Evicts cached shortlist and triggers a fresh FastAPI `/llm/matching` evaluation against all currently active expert profiles (`source = 'FORCE_REFRESH'`).

---

## Section 9 — Expert Profile & Capability Management (Diagram D05)

### UC059 — View Own Expert Profile
- **Primary Actor:** EXPERT
- **API:** `GET /expert-profile/me`
- **Tables Read:** `expert_profiles`, `expert_domain_depths`, `expert_seam_claims`
- **Main Flow:** Returns expert profile, declared domain depths, and seam claims.

### UC060 — Update Expert Profile
- **Primary Actor:** EXPERT
- **API:** `PUT /expert-profile/me`
- **Tables Written:** `expert_profiles`
- **Main Flow:** Updates bio, preferred engagement model, stack technology tags, and archetype history JSON.

### UC061 — Search Expert Profiles
- **Primary Actor:** CLIENT, ADMIN
- **API:** `GET /expert-profile/search`
- **Tables Read:** `users`, `expert_profiles`, `expert_domain_depths`, `expert_seam_claims`
- **Main Flow:** Searches expert directory filterable by domain code, seam code, archetype, or result limit.

### UC062 — View Domain Depths
- **Primary Actor:** EXPERT
- **API:** `GET /expert-profile/me/domains`
- **Tables Read:** `expert_domain_depths`
- **Main Flow:** Returns list of expert's domain proficiency depth claims.

### UC063 — Add Domain Depth
- **Primary Actor:** EXPERT
- **API:** `POST /expert-profile/domains`
- **Tables Written:** `expert_domain_depths`
- **Main Flow:** Creates or upserts a domain depth declaration (`SURFACE`, `OPERATIONAL`, `DEEP`).

### UC064 — Sync Domain Depths
- **Primary Actor:** EXPERT
- **API:** `PUT /expert-profile/domains/sync`
- **Tables Written:** `expert_domain_depths`
- **Main Flow:** Bulk-syncs domain depth records inside a single transaction.

### UC065 — Update Domain Depth
- **Primary Actor:** EXPERT
- **API:** `PUT /expert-profile/domains/{id}`
- **Tables Written:** `expert_domain_depths`
- **Main Flow:** Updates depth level of an existing domain depth record.

### UC066 — Delete Domain Depth
- **Primary Actor:** EXPERT
- **API:** `DELETE /expert-profile/domains/{id}`
- **Tables Written:** `expert_domain_depths`
- **Main Flow:** Removes a domain depth declaration from profile.

### UC067 — View Seam Claims
- **Primary Actor:** EXPERT
- **API:** `GET /expert-profile/me/seams`
- **Tables Read:** `expert_seam_claims`
- **Main Flow:** Returns list of seam claims with verification tiers (`CLAIMED` or `EVIDENCE_BACKED`), submission counts, and cooldown lock timestamps.

### UC068 — Add Seam Claim
- **Primary Actor:** EXPERT
- **API:** `POST /expert-profile/seams`
- **Tables Written:** `expert_seam_claims`
- **Main Flow:** Registers a new seam claim at `CLAIMED` verification tier.

### UC069 — Sync Seam Claims
- **Primary Actor:** EXPERT
- **API:** `PUT /expert-profile/seams/sync`
- **Tables Written:** `expert_seam_claims`
- **Main Flow:** Bulk-syncs seam claims. Rejects removing seams that have verification submission history (`submissionCount > 0`).

---

## Section 10 — Portfolio Submissions & AI Seam Verification (Diagram D05)

### UC070 — Submit Portfolio Evidence for Tier 2 Upgrade
- **Primary Actor:** EXPERT
- **API:** `POST /portfolio-submissions`
- **Gate:** `[Pro-E]`
- **Tables Written:** `portfolio_submissions`, `expert_seam_claims`, `platform_decisions`
- **Preconditions:** Seam claim is at `CLAIMED` tier and not currently locked (`lockedUntil <= now()`).
- **Main Flow:**
  1. Expert submits `projectDescription` (min 50 chars) and `decisionPoints` (min 20 chars).
  2. Calls FastAPI `/llm/portfolio-eval`.
  3. On pass (confidence ≥ 0.85): upgrades `expert_seam_claims.verification_tier = 'EVIDENCE_BACKED'` and logs `SEAM_TIER_UPGRADE` decision.
  4. On fail: sets submission status to `REJECTED`, increments `submissionCount`, logs `PORTFOLIO_EVAL` decision with gap advisory notes. If `submissionCount >= 5`, sets 30-day lockout (`lockedUntil = now + 30 days`).

### UC071 — View Own Portfolio Submissions
- **Primary Actor:** EXPERT
- **API:** `GET /portfolio-submissions`
- **Tables Read:** `portfolio_submissions`, `expert_seam_claims`, `platform_decisions`
- **Main Flow:** Returns expert's historical evidence submissions with joined advisory notes.

### UC072 — View Submission Detail
- **Primary Actor:** EXPERT, ADMIN
- **API:** `GET /portfolio-submissions/{id}`
- **Tables Read:** `portfolio_submissions`, `platform_decisions`
- **Main Flow:** Returns detailed evidence submission payload and evaluation notes.

### UC073 — Delete Portfolio Submission
- **Primary Actor:** EXPERT
- **API:** `DELETE /portfolio-submissions/me/portfolio/{id}`
- **Tables Written:** `portfolio_submissions`
- **Main Flow:** Deletes an unapproved portfolio submission entry.

---

## Section 11 — Service Listings Marketplace (Diagram D06)

### UC074 — Browse Public Services
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /services`
- **Tables Read:** `services`
- **Main Flow:** Returns published service marketplace listings (`state = 'PUBLISHED'`), filterable by `serviceType`, `domains`, `seams`, and price range.

### UC075 — Create Service
- **Primary Actor:** EXPERT
- **API:** `POST /services`
- **Tables Written:** `services`
- **Main Flow:** Creates a service listing in `DRAFT` state. If `useAiGenerator = true` (requires Expert Pro), calls FastAPI `/llm/service-generate` to draft title, scope, timeline, and suggested pricing.

### UC076 — View Own Services
- **Primary Actor:** EXPERT
- **API:** `GET /services/me`
- **Tables Read:** `services`
- **Main Flow:** Returns expert's created services across all states (`DRAFT`, `PUBLISHED`, `SUSPENDED`).

### UC077 — View Purchased Services
- **Primary Actor:** CLIENT (CEO)
- **API:** `GET /services/me/purchases`
- **Tables Read:** `engagements`, `services`, `milestones`
- **Main Flow:** Returns service engagements purchased by the CEO.

### UC078 — View Service Details
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /services/{id}`
- **Tables Read:** `services`, `reviews`
- **Main Flow:** Returns full service listing specifications and expert aggregate ratings.

### UC079 — Update Service
- **Primary Actor:** EXPERT
- **API:** `PUT /services/{id}`
- **Tables Written:** `services`
- **Main Flow:** Updates service title, description, scope, timeline, price, or tags.

### UC080 — Publish Service
- **Primary Actor:** EXPERT
- **API:** `PUT /services/{id}/publish`
- **Tables Written:** `services`
- **Main Flow:** Transitions service state from `DRAFT` to `PUBLISHED`.

### UC081 — Unpublish Service
- **Primary Actor:** EXPERT
- **API:** `PUT /services/{id}/unpublish`
- **Tables Written:** `services`
- **Main Flow:** Transitions service state from `PUBLISHED` to `DRAFT`.

### UC082 — Delete Service
- **Primary Actor:** EXPERT
- **API:** `DELETE /services/{id}`
- **Tables Written:** `services`
- **Preconditions:** Service must be in `DRAFT` state with no linked engagements.
- **Main Flow:** Deletes draft service listing.

### UC083 — Purchase Service
- **Primary Actor:** CLIENT (CEO)
- **API:** `POST /services/{id}/purchase`
- **Tables Written:** `engagements`, `virtual_accounts`
- **Includes:** `<<include>> UC078 View Service Details`
- **Main Flow:** Directly purchases a published service. Creates a `SERVICE_PURCHASE` or `TECH_DISCOVERY` engagement (`state = 'PENDING'`) and generates a 24-hour fixed-amount virtual account for VietQR payment.

---

## Section 12 — Project Bidding Invitations (Diagram D07)

### UC084 — View Received Invitations
- **Primary Actor:** EXPERT
- **API:** `GET /invitations`
- **Tables Read:** `invitations`, `projects`, `users`, `client_profiles`
- **Main Flow:** Returns project invitations received by the expert. Computes `isExpired` dynamically (`expiresAt < now()`).

### UC085 — Decline Invitation
- **Primary Actor:** EXPERT
- **API:** `POST /invitations/{id}/decline`
- **Tables Written:** `invitations`
- **Main Flow:** Expert explicitly declines a pending project invitation (`status = 'DECLINED'`).

### UC086 — View Sent Invitations
- **Primary Actor:** CLIENT (CEO)
- **API:** `GET /invitations/sent`
- **Tables Read:** `invitations`, `projects`, `users`
- **Main Flow:** Returns list of invitations sent by the CEO across projects.

### UC087 — Cancel Invitation
- **Primary Actor:** CLIENT (CEO)
- **API:** `DELETE /invitations/{id}`
- **Tables Written:** `invitations`
- **Main Flow:** Retracts a pending invitation before the expert responds.

---

## Section 13 — Capability Bids & Commercial Negotiation (Diagram D07 & D08)

### UC088 — Submit Capability Bid
- **Primary Actor:** EXPERT
- **API:** `POST /bids`
- **Gate:** `[Pro-E]` (Tier 2-3 projects)
- **Tables Written:** `engagements`, `capability_bids`, `invitations`
- **Includes:** `<<include>> UC048 View Project Details`
- **Preconditions:** Expert is shortlisted or invited; project is `PUBLISHED`.
- **Main Flow:**
  1. Expert submits footprint alignment, approach summary, and milestone pricing terms.
  2. Executes under `Serializable` transaction isolation.
  3. Creates `engagements` row (`state = 'PENDING'`, `type = 'PROJECT_BASED'`).
  4. Creates `capability_bids` row (`state = 'SUBMITTED'`, `versionNumber = 1`).
  5. Automatically marks matching pending invitation as `ACCEPTED`.
  6. Dispatches Socket.io notifications to CEO and linked Tech Team members.

### UC089 — List Own Bids
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /bids`
- **Tables Read:** `capability_bids`, `engagements`
- **Main Flow:** Returns bids visible to caller role (experts see own bids; CEOs see project bids; Tech Team sees scoped project bids).

### UC090 — View Bid Details
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /bids/{id}`
- **Tables Read:** `capability_bids`, `engagements`, `projects`
- **Main Flow:** Returns full bid negotiation envelope, current offer, and offer history. Restricts commercial pricing view for Tech Team users.

### UC091 — Update Bid
- **Primary Actor:** EXPERT
- **API:** `PUT /bids/{id}`
- **Tables Written:** `capability_bids`
- **Preconditions:** `techStatus = 'REVISION_REQUESTED'`.
- **Main Flow:** Expert submits updated technical proposal. Increments `versionNumber` and resets `techStatus = 'PENDING'`.

### UC092 — Withdraw Bid
- **Primary Actor:** EXPERT
- **API:** `DELETE /bids/{id}`
- **Tables Written:** `capability_bids`, `engagements`
- **Preconditions:** Bid `state` is `SUBMITTED` or `TECH_REVIEW`.
- **Main Flow:** Expert withdraws bid (`state = 'WITHDRAWN'`), transitioning engagement to `DECLINED`.

### UC093 — Submit Tech Team Review
- **Primary Actor:** CLIENT (TECH_TEAM)
- **API:** `PUT /bids/{id}/tech-review`
- **Tables Written:** `capability_bids`
- **Main Flow:** Tech Team approves technical scope (`action = 'APPROVED'`) or requests revision (`action = 'REVISION_REQUESTED'`, with feedback notes). On approval, advances bid to commercial review.

### UC094 — Submit CEO Decision on Bid
- **Primary Actor:** CLIENT (CEO)
- **API:** `PUT /bids/{id}/ceo-decision`
- **Tables Written:** `capability_bids`, `engagements`, `milestones`, `acceptance_criteria`, `projects`
- **Main Flow:** CEO accepts (`APPROVED`) or declines (`DECLINED`) current offer. Accepting routes to offer acceptance finalization.

### UC095 — Submit Counter Offer
- **Primary Actor:** CLIENT (CEO), EXPERT
- **API:** `POST /bids/{id}/offers`
- **Tables Written:** `capability_bids`
- **Main Flow:** Proposes a counter-offer round with full per-milestone terms. Increments version and updates negotiation envelope.

### UC096 — Accept Negotiation Offer
- **Primary Actor:** CLIENT (CEO), EXPERT
- **API:** `POST /bids/{id}/offers/{offerId}/accept`
- **Tables Written:** `capability_bids`, `engagements`, `milestones`, `acceptance_criteria`, `projects`
- **Preconditions:** Recipient is accepting; tech review complete (if non-self-technical).
- **Main Flow:**
  1. Sets offer state to `ACCEPTED` and locks contract terms.
  2. Sets bid `state = 'SELECTED'`, `ceoStatus = 'APPROVED'`.
  3. Instantiates real contract `milestones` and `acceptance_criteria` rows.
  4. Mirrors framework on `projects`.
  5. Automatically declines competing bids and engagements on the project.

### UC097 — Decline Negotiation Offer
- **Primary Actor:** CLIENT (CEO), EXPERT
- **API:** `POST /bids/{id}/offers/{offerId}/decline`
- **Tables Written:** `capability_bids`, `engagements`
- **Main Flow:** Declines current offer, setting bid state and engagement state to `DECLINED`.

---

## Section 14 — Engagements Workspace & NDA Acceptance (Diagram D09)

### UC098 — List Own Engagements
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /engagements`
- **Tables Read:** `engagements`, `projects`, `capability_bids`, `services`
- **Main Flow:** Returns engagements party to user, with joined project metadata and contract lock flags.

### UC099 — View Engagement Details
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /engagements/{id}`
- **Tables Read:** `engagements`, `projects`, `capability_bids`, `milestones`, `services`
- **Main Flow:** Returns full engagement view including NDA acceptance timestamps and bid context.

### UC100 — CEO Accept NDA
- **Primary Actor:** CLIENT (CEO)
- **API:** `PUT /engagements/{id}/accept-nda`
- **Tables Written:** `engagements`
- **Preconditions:** `state = 'PENDING'`, accepted bid terms exist.
- **Main Flow:** CEO accepts NDA (`clientNdaAcceptedAt = now()`). If expert has also accepted, transitions engagement to `CONNECTED`.

### UC101 — Expert Accept NDA
- **Primary Actor:** EXPERT
- **API:** `POST /engagements/{id}/connect`
- **Tables Written:** `engagements`
- **Preconditions:** `state = 'PENDING'`, accepted bid terms exist.
- **Main Flow:** Expert accepts connection + NDA (`expertNdaAcceptedAt = now()`). If CEO has also accepted, transitions engagement to `CONNECTED`. Returns `prompt_bank_link: true` if no bank account linked.

### UC102 — Expert Decline Connection
- **Primary Actor:** EXPERT
- **API:** `PUT /engagements/{id}/decline`
- **Tables Written:** `engagements`
- **Main Flow:** Expert declines connection request. Sets `engagements.state = 'DECLINED'`.

### UC103 — View Engagement Milestones
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /engagements/{id}/milestones`
- **Tables Read:** `milestones`, `acceptance_criteria`, `milestone_dod_items`
- **Main Flow:** Returns ordered list of milestones for an engagement.

### UC104 — View Engagement Submissions
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /engagements/{id}/submissions`
- **Tables Read:** `milestone_submissions`, `milestones`
- **Main Flow:** Returns all deliverable submission records across engagement milestones.

### UC105 — View Engagement Bid
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /engagements/{id}/bid`
- **Tables Read:** `capability_bids`
- **Main Flow:** Returns the capability bid associated with the engagement.

### UC106 — View Engagement Disputes
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /engagements/{id}/disputes`
- **Tables Read:** `disputes`, `acceptance_criteria`, `milestones`, `escrow_accounts`
- **Main Flow:** Returns all dispute records filed for the engagement.

### UC107 — Cancel Engagement
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `PUT /engagements/{id}/cancel`
- **Tables Written:** `engagements`
- **Preconditions:** Zero active funded/submitted/in-revision milestones.
- **Main Flow:** Sets `engagements.state = 'CANCELLED'`.

---

## Section 15 — Milestones Management & Setup (Diagram D10)

### UC108 — Create Milestone
- **Primary Actor:** CLIENT (CEO)
- **API:** `POST /milestones`
- **Tables Written:** `milestones`, `acceptance_criteria`
- **Preconditions:** Engagement is `CONNECTED`/`ACTIVE`; terms not locked.
- **Main Flow:** Creates a single milestone in `DEFINED` state with `payment_amount_vnd > 0` and at least 1 acceptance criterion. Derives `signOffAuthority` (`CEO` if self-technical, `JOINT` otherwise). Asynchronously checks criteria quality gate via FastAPI `/llm/criterion-check`.

### UC109 — Bulk Initialize Milestones
- **Primary Actor:** CLIENT (CEO)
- **API:** `POST /milestones/bulk`
- **Tables Written:** `milestones`, `acceptance_criteria`
- **Preconditions:** Zero existing milestones on engagement; Tech Team handoff completed (if non-self-technical).
- **Main Flow:** Bulk initializes all contract milestones from the CEO template in a single transaction.

### UC110 — View Engagement Milestones (List)
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /milestones?engagementId={id}`
- **Tables Read:** `milestones`, `acceptance_criteria`, `milestone_dod_items`
- **Main Flow:** Returns engagement milestones filtered by `engagementId`.

### UC111 — View Milestone Details
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /milestones/{id}`
- **Tables Read:** `milestones`, `acceptance_criteria`, `milestone_dod_items`, `milestone_submissions`, `engagements`
- **Main Flow:** Returns full milestone details, criteria, DoD items, submissions, and engagement context. Auto-heals default criteria for service orders if missing.

### UC112 — Update Milestone
- **Primary Actor:** CLIENT (CEO)
- **API:** `PATCH /milestones/{id}`
- **Tables Written:** `milestones`, `acceptance_criteria`
- **Preconditions:** `milestones.state = 'DEFINED'`; terms not locked.
- **Main Flow:** Updates milestone title, deliverable statement, payment amount, or criteria.

### UC113 — Delete Milestone
- **Primary Actor:** CLIENT (CEO)
- **API:** `DELETE /milestones/{id}`
- **Tables Written:** `milestones`, `acceptance_criteria`
- **Preconditions:** `milestones.state = 'DEFINED'`; terms not locked.
- **Main Flow:** Deletes a `DEFINED` milestone and its criteria.

### UC114 — Initiate Milestone Funding
- **Primary Actor:** CLIENT (CEO)
- **API:** `PUT /milestones/{id}/fund`
- **Tables Written:** `milestones`, `virtual_accounts`
- **Preconditions:** Milestone is `DEFINED` (or `AWAITING_PAYMENT` with expired VA); NDAs accepted.
- **Main Flow:** Creates a 24-hour fixed-amount `MILESTONE` virtual account and sets `milestones.state = 'AWAITING_PAYMENT'`.

### UC115 — View Milestone Disputes
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /milestones/{id}/disputes`
- **Tables Read:** `disputes`, `acceptance_criteria`, `milestones`, `escrow_accounts`
- **Main Flow:** Returns disputes filed against a specific milestone.

---

## Section 16 — Acceptance Criteria & Review Sign-Off (Diagram D10)

### UC116 — Add Acceptance Criterion
- **Primary Actor:** CLIENT (CEO)
- **API:** `POST /criteria/{milestoneId}`
- **Tables Written:** `acceptance_criteria`
- **Main Flow:** Adds an acceptance criterion to a `DEFINED` milestone.

### UC117 — View Milestone Criteria
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /criteria/{milestoneId}`
- **Tables Read:** `acceptance_criteria`
- **Main Flow:** Returns criteria list for a milestone.

### UC118 — Verify Criterion
- **Primary Actor:** CLIENT (CEO or Tech Team)
- **API:** `PUT /criteria/{id}/verify`
- **Tables Written:** `acceptance_criteria`, `milestones`, `escrow_accounts`, `wallets`, `wallet_transactions`, `engagements`
- **Includes:** `<<include>> UC117 View Milestone Criteria`
- **Main Flow:** Reviewer verifies a criterion (`techVerifiedAt` or `ceoVerifiedAt` set). When all required criteria are verified and no active disputes exist, auto-approves milestone and executes atomic escrow release.

### UC119 — Request Criterion Revision
- **Primary Actor:** CLIENT (CEO or Tech Team)
- **API:** `PUT /criteria/{id}/revision`
- **Tables Written:** `acceptance_criteria`, `milestones`
- **Main Flow:** Reviewer requests deliverable revision with feedback note. Sets `milestones.state = 'IN_REVISION'`.

### UC120 — Delete Criterion
- **Primary Actor:** CLIENT (CEO)
- **API:** `DELETE /criteria/{id}`
- **Tables Written:** `acceptance_criteria`
- **Main Flow:** Deletes an acceptance criterion from a `DEFINED` milestone.

---

## Section 17 — Definition of Done (DoD) Checklist (Diagram D11)

### UC121 — Add DoD Item
- **Primary Actor:** CLIENT, EXPERT
- **API:** `POST /milestones/{id}/dod/items`
- **Tables Written:** `milestone_dod_items`
- **Main Flow:** Adds a single Definition of Done checklist item to a milestone.

### UC122 — Bulk Add DoD Items
- **Primary Actor:** CLIENT, EXPERT
- **API:** `POST /milestones/{id}/dod/items/bulk`
- **Tables Written:** `milestone_dod_items`
- **Main Flow:** Bulk adds multiple DoD items in one transaction.

### UC123 — View DoD Checklist
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /milestones/{id}/dod`
- **Tables Read:** `milestone_dod_items`
- **Main Flow:** Returns DoD checklist items for a milestone.

### UC124 — Update DoD Item Status
- **Primary Actor:** EXPERT
- **API:** `PUT /milestones/{id}/dod/{itemId}`
- **Tables Written:** `milestone_dod_items`
- **Main Flow:** Updates item status (`COMPLETED` or `NOT_APPLICABLE`). DB check constraint enforces that required items cannot be marked `NOT_APPLICABLE`.

### UC125 — Delete DoD Item
- **Primary Actor:** CLIENT, EXPERT
- **API:** `DELETE /milestones/{id}/dod/{itemId}`
- **Tables Written:** `milestone_dod_items`
- **Main Flow:** Deletes a `PENDING` DoD item.

---

## Section 18 — Deliverable Submissions & Pay-Gated Documents (Diagram D11)

### UC126 — Submit Milestone Deliverables
- **Primary Actor:** EXPERT
- **API:** `POST /milestones/{id}/submit`
- **Tables Written:** `milestone_submissions`, `milestones`
- **Includes:** `<<include>> UC123 View DoD Checklist`
- **Preconditions:** Milestone is `FUNDED`, `IN_PROGRESS`, or `IN_REVISION`; all required DoD items (`is_required = true`) are `COMPLETED`.
- **Main Flow:**
  1. Expert submits work description and attachment file links.
  2. DoD completion gate check executes.
  3. Inserts `milestone_submissions` row.
  4. Sets `milestones.state = 'SUBMITTED'` and timestamps `submittedAt`.
  5. Dispatches Socket.io updates to client/tech team.

### UC127 — Retract Submission
- **Primary Actor:** EXPERT
- **API:** `DELETE /milestones/{id}/submissions/latest`
- **Tables Written:** `milestone_submissions`, `milestones`
- **Preconditions:** `milestones.state = 'SUBMITTED'`.
- **Main Flow:** Deletes latest submission row and reverts milestone state back to `IN_PROGRESS`.

### UC128 — View All Submissions
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /milestones/{id}/submissions`
- **Tables Read:** `milestone_submissions`, `engagements`
- **Main Flow:** Returns full submission history for a milestone.

### UC129 — View Latest Submission
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /milestones/{id}/submissions/latest`
- **Tables Read:** `milestone_submissions`, `engagements`
- **Main Flow:** Returns most recent submission record for a milestone.

### UC130 — Stage a Pay-Gated Document
- **Primary Actor:** EXPERT
- **API:** `POST /milestones/{id}/paygated-docs`
- **Tables Written:** `paygated_documents`
- **Main Flow:** Stages a document URL (`STAGED` if unfunded, `RELEASED` if already funded).

### UC131 — Bulk Stage Documents
- **Primary Actor:** EXPERT
- **API:** `POST /milestones/{id}/paygated-docs/bulk`
- **Tables Written:** `paygated_documents`
- **Main Flow:** Bulk stages multiple pay-gated document URLs atomically.

### UC132 — Download Released Documents
- **Primary Actor:** CLIENT (Tech Team only), EXPERT
- **API:** `GET /milestones/{id}/paygated-docs`
- **Tables Read:** `paygated_documents`, `engagements`, `tech_team_profiles`
- **Route Guard:** Permanent exclusion for CLIENT CEOs.
- **Main Flow:** Downloads unlocked pay-gated documents (`releaseState = 'RELEASED'`).

---

## Section 19 — Dispute Filing & Layer 1 AI Arbitration (Diagram D12)

### UC133 — File a Dispute
- **Primary Actor:** CLIENT, EXPERT
- **API:** `POST /disputes`
- **Tables Written:** `disputes`, `escrow_accounts`, `milestones`, `acceptance_criteria`
- **Includes:** `<<include>> UC111 View Milestone Details`
- **Preconditions:** Milestone is `SUBMITTED` or `IN_REVISION`; criterion is unverified; escrow status is `HELD`.
- **Main Flow:**
  1. Party files dispute against an unverified criterion with additional context.
  2. Atomic transaction: sets `escrow_accounts.status = 'FROZEN'`, `milestones.state = 'DISPUTED'`, inserts `disputes` row (`state = 'LAYER_1_EVAL'`).
  3. Calls FastAPI `/llm/dispute-eval`.
  4. If AI confidence ≥ 0.80 (`AUTO_RESOLVED`):
     - `EXPERT_WINS`: verifies criterion, unfreezes escrow to `HELD` (or releases if all criteria met).
     - `CLIENT_WINS`: refunds escrow to client wallet via `ESCROW_REFUND`.
     - `SPLIT`: splits escrow 50/50 via `ESCROW_SPLIT`.
  5. If AI confidence < 0.80: sets `state = 'MANUAL_REVIEW'` and routes to Admin Dispute Monitor.

### UC134 — View Own Disputes
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /disputes`
- **Tables Read:** `disputes`, `engagements`, `milestones`, `escrow_accounts`
- **Main Flow:** Returns disputes list visible to caller role.

### UC135 — View Dispute Details
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /disputes/{id}`
- **Tables Read:** `disputes`, `engagements`, `acceptance_criteria`, `milestones`, `escrow_accounts`
- **Main Flow:** Returns full dispute detail including criterion text, deliverable description, AI confidence score, and resolution status.

---

## Section 20 — Messaging, Inbox & Conversations (Diagram D13)

### UC136 — View Engagement Messages
- **Primary Actor:** Authenticated Party
- **API:** `GET /engagements/{id}/messages`
- **Tables Read:** `messages`, `engagements`, `tech_team_profiles`
- **Main Flow:** Returns cursor-paginated chat messages for an engagement thread.

### UC137 — View Project Messages
- **Primary Actor:** Authenticated Party
- **API:** `GET /projects/{id}/messages`
- **Tables Read:** `messages`, `projects`
- **Main Flow:** Returns cursor-paginated chat messages for a pre-bid project Q&A thread.

### UC138 — Mark Message as Read
- **Primary Actor:** Authenticated User
- **API:** `POST /messages/{id}/read`
- **Tables Written:** `message_reads`
- **Main Flow:** Upserts a message read receipt for the current user.

### UC139 — View Conversations
- **Primary Actor:** Authenticated User
- **API:** `GET /conversations`
- **Tables Read:** `engagements`, `messages`, `message_reads`, `tech_team_profiles`
- **Main Flow:** Returns list of active message threads with last message preview and unread counts for inbox sidebar.

### UC140 — View Unread Message Count
- **Primary Actor:** Authenticated User
- **API:** `GET /engagements/{id}/messages/unread-count` OR `GET /projects/{id}/messages/unread-count`
- **Tables Read:** `messages`, `message_reads`
- **Main Flow:** Returns unread message count for badge display.

### UC141 — Mark Conversation as Read
- **Primary Actor:** Authenticated User
- **API:** `POST /conversations/{engagementId}/read`
- **Tables Written:** `message_reads`
- **Main Flow:** Atomically marks all unread messages in an engagement conversation as read.

### UC142 — Mark All Conversations as Read
- **Primary Actor:** Authenticated User
- **API:** `POST /conversations/read-all`
- **Tables Written:** `message_reads`
- **Main Flow:** Marks all unread messages across all user conversations as read.

---

## Section 21 — Post-Engagement Peer Reviews (Diagram D13)

### UC143 — Submit Review
- **Primary Actor:** CLIENT, EXPERT
- **API:** `POST /reviews`
- **Tables Written:** `reviews`
- **Preconditions:** Engagement `state = 'CLOSED'`; no prior review submitted by caller.
- **Main Flow:** Submits post-engagement review. CEO reviews Expert; Expert reviews Client; Tech Team reviews Expert with required `structuredSignalsJson`.

### UC144 — View Reviews for Engagement
- **Primary Actor:** CLIENT, EXPERT, ADMIN
- **API:** `GET /reviews/{engagementId}`
- **Tables Read:** `reviews`, `engagements`
- **Main Flow:** Returns reviews submitted for a closed engagement.

### UC145 — View Reviews for a User
- **Primary Actor:** Authenticated User
- **API:** `GET /reviews/users/{userId}`
- **Tables Read:** `reviews`, `users`
- **Main Flow:** Returns public review history received by a user.

### UC146 — View Reviews I Submitted
- **Primary Actor:** CLIENT, EXPERT
- **API:** `GET /reviews/me`
- **Tables Read:** `reviews`, `users`
- **Main Flow:** Returns reviews written by current user.

### UC147 — View Reviews I Received
- **Primary Actor:** CLIENT, EXPERT
- **API:** `GET /reviews/me/received`
- **Tables Read:** `reviews`, `users`
- **Main Flow:** Returns reviews received by current user.

---

## Section 22 — Platform Push Notifications (Diagram D13)

### UC148 — View Notifications
- **Primary Actor:** Authenticated User
- **API:** `GET /notifications/me`
- **Tables Read:** `notifications`
- **Main Flow:** Returns user's notifications ordered newest-first.

### UC149 — View Unread Count
- **Primary Actor:** Authenticated User
- **API:** `GET /notifications/me/unread-count`
- **Tables Read:** `notifications`
- **Main Flow:** Returns unread notification count for nav bell badge.

### UC150 — Mark Notification as Read
- **Primary Actor:** Authenticated User
- **API:** `PUT /notifications/{id}/read`
- **Tables Written:** `notifications`
- **Main Flow:** Marks a specific notification as read.

### UC151 — Mark All Notifications as Read
- **Primary Actor:** Authenticated User
- **API:** `PUT /notifications/read-all`
- **Tables Written:** `notifications`
- **Main Flow:** Marks all unread notifications as read.

### UC152 — Delete Notification
- **Primary Actor:** Authenticated User
- **API:** `DELETE /notifications/{id}`
- **Tables Written:** `notifications`
- **Main Flow:** Permanently deletes a notification entry.

---

## Section 23 — Admin User & Oversight Management (Diagram D14)

### UC153 — List All Users
- **Primary Actor:** ADMIN
- **API:** `GET /admin/users`
- **Gate:** `[Admin]`
- **Tables Read:** `users`
- **Main Flow:** Returns paginated list of all platform users, filterable by `role`, `isActive`, or search term.

### UC154 — View User Details
- **Primary Actor:** ADMIN
- **API:** `GET /admin/users/{id}`
- **Gate:** `[Admin]`
- **Tables Read:** `users`, `wallets`, `client_profiles`, `expert_profiles`
- **Main Flow:** Returns full user profile details including wallet balances and sub-profiles.

### UC155 — Suspend User Account
- **Primary Actor:** ADMIN
- **API:** `PUT /admin/users/{id}/suspend`
- **Gate:** `[Admin]`
- **Tables Written:** `users`
- **Main Flow:** Sets `users.is_active = false`, blocking user login.

### UC156 — Reactivate User Account
- **Primary Actor:** ADMIN
- **API:** `PUT /admin/users/{id}/reactivate`
- **Gate:** `[Admin]`
- **Tables Written:** `users`
- **Main Flow:** Sets `users.is_active = true`, restoring account access.

### UC157 — List All Experts
- **Primary Actor:** ADMIN
- **API:** `GET /admin/experts`
- **Gate:** `[Admin]`
- **Tables Read:** `users`, `expert_seam_claims`, `expert_domain_depths`
- **Main Flow:** Returns list of expert users with domain depths and seam claims verification status.

### UC158 — List All Projects
- **Primary Actor:** ADMIN
- **API:** `GET /admin/projects`
- **Gate:** `[Admin]`
- **Tables Read:** `projects`
- **Main Flow:** Returns list of all platform projects filterable by `state` or `archetype`.

### UC159 — View Project Details (Admin)
- **Primary Actor:** ADMIN
- **API:** `GET /admin/projects/{id}`
- **Gate:** `[Admin]`
- **Tables Read:** `projects`, `users`, `tech_team_profiles`, `invitations`
- **Main Flow:** Returns full project specification and engagement statistics for administrative audit.

### UC160 — Suspend Project Spec
- **Primary Actor:** ADMIN
- **API:** `PUT /admin/projects/{id}/suspend-spec`
- **Gate:** `[Admin]`
- **Tables Written:** `projects`, `platform_decisions`
- **Main Flow:** Emergency spec pull-back. Sets `projects.state = 'SUSPENDED'` and logs platform decision.

### UC161 — Reopen Suspended Project
- **Primary Actor:** ADMIN
- **API:** `PUT /admin/projects/{id}/reopen`
- **Gate:** `[Admin]`
- **Tables Written:** `projects`
- **Main Flow:** Reopens a suspended project back to `PUBLISHED` state.

### UC162 — List All Engagements
- **Primary Actor:** ADMIN
- **API:** `GET /admin/engagements`
- **Gate:** `[Admin]`
- **Tables Read:** `engagements`, `projects`, `users`, `services`
- **Main Flow:** Returns list of all engagements filterable by `state` or `projectId`.

---

## Section 24 — Admin Finance, Analytics & Withdrawals (Diagram D15)

### UC163 — View All Transactions
- **Primary Actor:** ADMIN
- **API:** `GET /admin/transactions`
- **Gate:** `[Admin]`
- **Tables Read:** `wallet_transactions`, `wallets`, `users`
- **Main Flow:** Returns complete wallet transaction ledger filterable by `type` or `userId`.

### UC164 — View Platform Analytics
- **Primary Actor:** ADMIN
- **API:** `GET /admin/analytics`
- **Gate:** `[Admin]`
- **Main Flow:** Returns computed platform aggregates: project distributions, elicitation pass rates, portfolio pass rates, dispute rates, auto-resolve rates, and milestone completion rates.

### UC165 — View Platform Settings
- **Primary Actor:** ADMIN
- **API:** `GET /admin/platform-settings`
- **Gate:** `[Admin]`
- **Tables Read:** `platform_settings`
- **Main Flow:** Returns platform settings (`platform_fee_pct`, `platform_wallet_id`).

### UC166 — Update Platform Settings
- **Primary Actor:** ADMIN
- **API:** `PUT /admin/platform-settings`
- **Gate:** `[Admin]`
- **Tables Written:** `platform_settings`
- **Main Flow:** Updates platform fee percentage (enforces range `0.00–1.00`) or platform wallet reference ID.

### UC167 — View All Withdrawal Requests
- **Primary Actor:** ADMIN
- **API:** `GET /admin/withdrawals`
- **Gate:** `[Admin]`
- **Tables Read:** `withdrawal_requests`
- **Main Flow:** Returns expert withdrawal request queue filterable by `status`.

### UC168 — Complete Withdrawal
- **Primary Actor:** ADMIN
- **API:** `PUT /admin/withdrawals/{id}/complete`
- **Gate:** `[Admin]`
- **Tables Written:** `withdrawal_requests`, `milestones`, `engagements`
- **Main Flow:** Confirms manual payout disbursement (`status = 'COMPLETED'`). If linked to milestone release, advances milestone state to `RELEASED`.

### UC169 — Fail Withdrawal
- **Primary Actor:** ADMIN
- **API:** `PUT /admin/withdrawals/{id}/fail`
- **Gate:** `[Admin]`
- **Tables Written:** `withdrawal_requests`, `wallets`, `wallet_transactions`
- **Main Flow:** Marks withdrawal as `FAILED` and atomically refunds amount to expert's `available_balance` with a `WITHDRAWAL_REFUND` transaction log.

---

## Section 25 — Admin Dispute Resolution & AI Audit (Diagram D12 & D15)

### UC170 — View All Disputes
- **Primary Actor:** ADMIN
- **API:** `GET /admin/disputes`
- **Gate:** `[Admin]`
- **Tables Read:** `disputes`, `milestones`, `escrow_accounts`
- **Main Flow:** Returns platform dispute queue filterable by `state`.

### UC171 — Manually Resolve Dispute
- **Primary Actor:** ADMIN
- **API:** `PUT /admin/disputes/{id}/resolve`
- **Gate:** `[Admin]`
- **Tables Written:** `disputes`, `acceptance_criteria`, `escrow_accounts`, `milestones`, `wallets`, `wallet_transactions`, `platform_decisions`
- **Includes:** `<<include>> UC170 View All Disputes`
- **Main Flow:** Manually resolves an escalated dispute (`EXPERT_WINS`, `CLIENT_WINS`, or `SPLIT`). Executes atomic ledger distribution, sets `milestones.state = 'APPROVED'`, and logs decision.

### UC172 — View AI Platform Decisions
- **Primary Actor:** ADMIN
- **API:** `GET /admin/decisions`
- **Gate:** `[Admin]`
- **Tables Read:** `platform_decisions`
- **Main Flow:** Returns platform AI decision audit log filterable by `decisionType` or `entityType`.

---

## Section 26 — Admin Subscription Package Management (Diagram D15)

### UC173 — List Subscription Packages
- **Primary Actor:** ADMIN
- **API:** `GET /admin/subscriptions/packages`
- **Gate:** `[Admin]`
- **Tables Read:** `subscription_packages`
- **Main Flow:** Returns all subscription packages (both active and inactive).

### UC174 — Create Subscription Package
- **Primary Actor:** ADMIN
- **API:** `POST /admin/subscriptions/packages`
- **Gate:** `[Admin]`
- **Tables Written:** `subscription_packages`
- **Main Flow:** Creates a new subscription package (`role`, `name`, `priceVnd`, `durationMonths`).

### UC175 — Update Subscription Package
- **Primary Actor:** ADMIN
- **API:** `PUT /admin/subscriptions/packages/{id}`
- **Gate:** `[Admin]`
- **Tables Written:** `subscription_packages`
- **Main Flow:** Updates subscription package pricing, duration, name, or active status.

### UC176 — Deactivate Subscription Package
- **Primary Actor:** ADMIN
- **API:** `DELETE /admin/subscriptions/packages/{id}` OR `PUT /admin/subscriptions/packages/{id}`
- **Gate:** `[Admin]`
- **Tables Written:** `subscription_packages`
- **Main Flow:** Hard-deletes package if zero purchase history exists; otherwise deactivates package (`isActive = false`).

---

## Section 27 — CMS Domain & Seam Configurations (Diagram D16)

### UC177 — List Domain Definitions
- **Primary Actor:** ADMIN, Public
- **API:** `GET /admin/config/domains`
- **Tables Read:** `domain_definitions`
- **Main Flow:** Returns all domain definitions ordered by `sortOrder`.

### UC178 — Create Domain Definition
- **Primary Actor:** ADMIN
- **API:** `POST /admin/config/domains`
- **Gate:** `[Admin]`
- **Tables Written:** `domain_definitions`
- **Main Flow:** Creates a new AI domain definition (`code`, `name`, `description`).

### UC179 — Update Domain Definition
- **Primary Actor:** ADMIN
- **API:** `PUT /admin/config/domains/{id}`
- **Gate:** `[Admin]`
- **Tables Written:** `domain_definitions`
- **Main Flow:** Updates domain name, description, active status, or sort order.

### UC180 — Delete Domain Definition
- **Primary Actor:** ADMIN
- **API:** `DELETE /admin/config/domains/{id}`
- **Gate:** `[Admin]`
- **Tables Written:** `domain_definitions`
- **Main Flow:** Soft-deletes domain definition (`isActive = false`).

### UC181 — List Seam Definitions
- **Primary Actor:** ADMIN, Public
- **API:** `GET /admin/config/seams`
- **Tables Read:** `seam_definitions`
- **Main Flow:** Returns all seam definitions ordered by `sortOrder`.

### UC182 — Create Seam Definition
- **Primary Actor:** ADMIN
- **API:** `POST /admin/config/seams`
- **Gate:** `[Admin]`
- **Tables Written:** `seam_definitions`
- **Main Flow:** Creates a relationally linked seam definition (`code`, `domainCode1`, `domainCode2`, `name`). Enforces `(domainCode1, domainCode2)` uniqueness.

### UC183 — Update Seam Definition
- **Primary Actor:** ADMIN
- **API:** `PUT /admin/config/seams/{id}`
- **Gate:** `[Admin]`
- **Tables Written:** `seam_definitions`
- **Main Flow:** Updates seam definition attributes or active status.

### UC184 — Delete Seam Definition
- **Primary Actor:** ADMIN
- **API:** `DELETE /admin/config/seams/{id}`
- **Gate:** `[Admin]`
- **Tables Written:** `seam_definitions`
- **Main Flow:** Soft-deletes seam definition (`isActive = false`).

---

## Section 28 — CMS Archetypes, Probe Questions & Void Codes (Diagram D17)

### UC185 — List Archetype Definitions
- **Primary Actor:** ADMIN, Public
- **API:** `GET /admin/config/archetypes`
- **Tables Read:** `archetype_definitions`
- **Main Flow:** Returns project archetype definitions.

### UC186 — Create Archetype
- **Primary Actor:** ADMIN
- **API:** `POST /admin/config/archetypes`
- **Gate:** `[Admin]`
- **Tables Written:** `archetype_definitions`
- **Main Flow:** Creates a new project archetype category.

### UC187 — Update Archetype
- **Primary Actor:** ADMIN
- **API:** `PUT /admin/config/archetypes/{id}`
- **Gate:** `[Admin]`
- **Tables Written:** `archetype_definitions`
- **Main Flow:** Updates archetype attributes or active status.

### UC188 — Delete Archetype
- **Primary Actor:** ADMIN
- **API:** `DELETE /admin/config/archetypes/{id}`
- **Gate:** `[Admin]`
- **Tables Written:** `archetype_definitions`
- **Main Flow:** Soft-deletes archetype definition (`isActive = false`).

### UC189 — List Probe Questions
- **Primary Actor:** ADMIN, Public
- **API:** `GET /admin/config/probe-questions`
- **Tables Read:** `probe_questions`
- **Main Flow:** Returns Stage 3 probe questions, filterable by `?archetypeCode=...`.

### UC190 — Create Probe Question
- **Primary Actor:** ADMIN
- **API:** `POST /admin/config/probe-questions`
- **Gate:** `[Admin]`
- **Tables Written:** `probe_questions`
- **Main Flow:** Creates a probe question for an archetype.

### UC191 — Update Probe Question
- **Primary Actor:** ADMIN
- **API:** `PUT /admin/config/probe-questions/{id}`
- **Gate:** `[Admin]`
- **Tables Written:** `probe_questions`
- **Main Flow:** Updates probe question text, display order, or active status.

### UC192 — Delete Probe Question
- **Primary Actor:** ADMIN
- **API:** `DELETE /admin/config/probe-questions/{id}`
- **Gate:** `[Admin]`
- **Tables Written:** `probe_questions`
- **Main Flow:** Soft-deletes probe question (`isActive = false`).

### UC193 — List Void Code Definitions
- **Primary Actor:** ADMIN, Public
- **API:** `GET /admin/config/void-codes`
- **Tables Read:** `void_code_definitions`
- **Main Flow:** Returns void code gap definitions and severity levels.

### UC194 — Create Void Code
- **Primary Actor:** ADMIN
- **API:** `POST /admin/config/void-codes`
- **Gate:** `[Admin]`
- **Tables Written:** `void_code_definitions`
- **Main Flow:** Creates a new void code definition (`code`, `name`, `description`, `severity`).

### UC195 — Update Void Code
- **Primary Actor:** ADMIN
- **API:** `PUT /admin/config/void-codes/{id}`
- **Gate:** `[Admin]`
- **Tables Written:** `void_code_definitions`
- **Main Flow:** Updates void code attributes or severity level (`HIGH`, `MEDIUM`, `LOW`).

### UC196 — Delete Void Code
- **Primary Actor:** ADMIN
- **API:** `DELETE /admin/config/void-codes/{id}`
- **Gate:** `[Admin]`
- **Tables Written:** `void_code_definitions`
- **Main Flow:** Soft-deletes void code definition (`isActive = false`).

---

## Section 29 — CMS AI Prompt Template Management (Diagram D18)

### UC197 — List Prompt Templates
- **Primary Actor:** ADMIN
- **API:** `GET /admin/prompts`
- **Gate:** `[Admin]`
- **Tables Read:** `prompt_templates`
- **Main Flow:** Returns all DB-stored prompt templates with stage, description, version, and update timestamps.

### UC198 — View Prompt Template by Stage
- **Primary Actor:** ADMIN
- **API:** `GET /admin/prompts/{stage}`
- **Gate:** `[Admin]`
- **Tables Read:** `prompt_templates`
- **Main Flow:** Returns full Jinja2 template text for a specific stage.

### UC199 — Update Prompt Template
- **Primary Actor:** ADMIN
- **API:** `PUT /admin/prompts/{stage}`
- **Gate:** `[Admin]`
- **Tables Written:** `prompt_templates`
- **Main Flow:** Upserts prompt template text in DB and increments version number. FastAPI TTL cache hot-reloads prompt updates within 60 seconds without service redeployment.

### UC200 — Delete Prompt Template
- **Primary Actor:** ADMIN
- **API:** `DELETE /admin/prompts/{stage}`
- **Gate:** `[Admin]`
- **Tables Written:** `prompt_templates`
- **Main Flow:** Deletes DB prompt template override. System automatically falls back to reading the default on-disk `.txt` prompt file.