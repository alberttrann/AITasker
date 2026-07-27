## 0.11 All Service Endpoints

> **Purpose:** Comprehensive technical reference for every HTTP endpoint and real-time socket event in AITasker.  
> The system operates across four endpoint tiers:
> 1. **NestJS Public & Actor Endpoints** (Main Backend — REST controllers handling user, business, and admin operations).
> 2. **SePay Webhook Endpoints** (S2S callbacks triggered by the SePay payment gateway, secured via HMAC-SHA256).
> 3. **Internal System Endpoints (S2S / FastAPI)** (Microservice endpoints called exclusively by NestJS via `X-Internal-Token` or internal networking — never directly by the frontend).
> 4. **Socket.io Real-Time Event Gateway** (WebSocket events for push notifications, live chat messaging, and instant UI state invalidations).
>
> **Notation:**
> - **W Tables:** Primary database tables modified (INSERT, UPDATE, DELETE).
> - **R Tables:** Database tables queried for guard resolution or payload context.
> - **Gates:** `[Pro-C]` = Client Pro subscription required · `[Pro-E]` = Expert Pro required · `[Admin]` = ADMIN role required · `[None]` = Unrestricted / Role-based only · `HMAC` = Webhook signature required.
> - **Guard → Error:** First failing evaluation condition and its corresponding HTTP status code / error key.

---

### A. Health & System Bootstrap (2 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `GET` | `/health` | All / Monitoring | `[None]` | — | — | System health check. Returns `{ status: 'ok', service: 'aitasker-backend' }`. Used by container orchestrators. |
| `GET` | `/config/all` | Unauthenticated | `[None]` | — | — (R: `domain_definitions`, `seam_definitions`, `archetype_definitions`, `void_code_definitions`, `subscription_packages`) | Single-call app bootstrap endpoint returning all active domains, seams, archetypes, void codes, and packages. |

---

### B. Authentication & Session Management (15 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `POST` | `/auth/register` | Unauthenticated | `[None]` | Duplicate email → 409 Conflict | `users`, `client_profiles` OR `expert_profiles`, `wallets`, `virtual_accounts` | Atomic 4-table transaction. Creates user, profile, wallet, and permanent `WALLET_TOPUP` virtual account. Triggers 6-digit OTP email (15-min expiry). |
| `POST` | `/auth/register/handoff` | Unauthenticated | `[None]` | JWT expired / invalid → 401 `LINK_EXPIRED` · Email exists → 409 | `users`, `tech_team_profiles`, `wallets`, `virtual_accounts`, `elicitation_sessions` | Consumes 72h handoff link issued during Stage 4. Creates account as `CLIENT_CEO` role with `clientSubtype = TECH_TEAM`, links `linkedClientId`, and timestamps `handoffConsumedAt`. |
| `POST` | `/auth/login` | All | `[None]` | Account suspended (`is_active = false`) → 401 · Email unverified (`is_email_verified = false`) → 401 `EMAIL_UNVERIFIED` · Bad credentials → 401 | `users` (resends OTP if unverified) | On success returns access token + refresh token. If unverified, auto-resends fresh OTP and returns 401 `EMAIL_UNVERIFIED` for FE redirection. |
| `POST` | `/auth/verify-otp` | Unauthenticated | `[None]` | Invalid code → 400 · Expired code → 400 (auto-regenerates fresh OTP) · Account already verified → 409 | `users` | Verifies registration OTP. Sets `is_email_verified = true`, clears OTP columns, and issues login JWT tokens. |
| `POST` | `/auth/resend-otp` | Unauthenticated | `[None]` | Account not found → 404 · Already verified → 409 | `users` | Generates a fresh 6-digit OTP valid for 15 minutes and dispatches verification email. |
| `PUT` | `/auth/switch-role` | Multi-role User | `[None]` | Target role not in user's `roles` array → 401 | `users` | Switches `activeRole` cursor and re-issues access JWT with updated claims. No re-login required. |
| `POST` | `/auth/refresh` | All (Valid Refresh Token) | `[None]` | Invalid/expired refresh token → 401 · Token hash mismatch → 401 | `users` (updates `refreshTokenHash`) | Validates refresh token signature and SHA-256 hash against `users.refresh_token_hash`. Re-issues fresh access and refresh token pair. |
| `POST` | `/auth/claim-handoff` | Authenticated User | `[None]` | Invalid token → 401 · Session consumed → 401 | `users`, `tech_team_profiles`, `elicitation_sessions` | Existing authenticated user claims a tech team handoff invite link, attaching `tech_team_profiles` to their user account. |
| `POST` | `/auth/verify-tax-code` | CLIENT | `[None]` | Invalid tax code / API failure → 409 | `client_profiles` | Queries VietQR API (`api.vietqr.io/v2/business/{taxCode}`). On code `"00"`, marks business verified and updates company name. |
| `POST` | `/auth/forgot-password` | Unauthenticated | `[None]` | — (Always returns generic 201) | `users` | Sets 32-byte hex `password_reset_token` and 1-hour expiry. Dispatches email. Generic response prevents email enumeration. |
| `GET` | `/auth/verify-reset-token/{token}` | Unauthenticated | `[None]` | Token expired / invalid → 400 | — (R: `users`) | Pre-flight check called by FE before rendering reset password form. |
| `POST` | `/auth/reset-password` | Unauthenticated | `[None]` | Token expired / invalid → 400 · Weak password → 400 | `users` | Updates password hash, invalidates reset token, and clears `refresh_token_hash` to log out all active sessions. |
| `PUT` | `/auth/me/password` | Authenticated | `[None]` | Current password incorrect → 401 · Weak password → 400 | `users` | Changes password for authenticated user and clears `refresh_token_hash`, revoking all active sessions. |
| `POST` | `/auth/logout` | Authenticated | `[None]` | — | `users` | Clears `users.refresh_token_hash` server-side, invalidating refresh tokens across all devices. |

---

### C. User Profile & Role Management (5 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `GET` | `/users/me` | Authenticated | `[None]` | Account inactive → 401 | — (R: `users`, profiles) | Returns current user profile, active role profile, wallet balance summary, and subscription status. |
| `PUT` | `/users/me` | Authenticated | `[None]` | Account not found → 404 | `users`, `client_profiles` | Updates basic profile fields (`fullName`, `phone`, `companyName`, `industry`, `ceoName`). |
| `POST` | `/users/me/add-role` | Authenticated | `[None]` | Role already held → 409 | `users`, `client_profiles` OR `expert_profiles` | Adds a second role (`CLIENT_CEO` or `EXPERT`) to the user's `roles` array and creates the corresponding role profile row. |
| `GET` | `/users/{userId}/public-profile` | Authenticated | `[None]` | Profile not found → 404 | — (R: `users`, `expert_profiles`, `reviews`, `services`) | Returns expert public card: bio, engagement model, stack tags, domain depths, seam claims, ratings, and active listings. |
| `PUT` | `/users/me/tax-code` | CLIENT | `[None]` | Tax verification failed → 409 | `client_profiles` | Updates client tax code and verifies registered company name against VietQR API. |

---

### D. Wallet, Virtual Accounts & Withdrawals (6 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `GET` | `/wallets/me` | CLIENT, EXPERT | `[None]` | Wallet not found → 404 | — (R: `wallets`) | Returns `availableBalance` and `lockedBalance` as numbers. |
| `GET` | `/wallets/me/transactions` | CLIENT, EXPERT | `[None]` | — | — (R: `wallet_transactions`, `milestones`, `engagements`) | Returns paginated wallet transactions with contextual milestone/project metadata parsed from `reference_id`. |
| `POST` | `/wallets/virtual-accounts/topup` | CLIENT, EXPERT | `[None]` | Topup account missing → 404 | — (R: `virtual_accounts`) | Returns permanent top-up `vaNumber` and SePay VietQR payment URL (`https://qr.sepay.vn/img?...`). |
| `POST` | `/withdrawals` | EXPERT | `[None]` | No bank linked → 409 · Insufficient balance → 422 `INSUFFICIENT_BALANCE` | `wallets`, `withdrawal_requests`, `wallet_transactions` | Atomic transaction: debits `availableBalance`, logs `WITHDRAWAL` transaction, creates `withdrawal_requests` row (`status = 'PENDING'`). |
| `GET` | `/withdrawals` | EXPERT | `[None]` | — | — (R: `withdrawal_requests`) | Returns expert's withdrawal request history ordered newest-first. |
| `DELETE` | `/withdrawals/{id}` | EXPERT | `[None]` | Request not found → 404 · Not owner → 403 · `status != 'PENDING'` → 422 | `withdrawal_requests`, `wallets`, `wallet_transactions` | Cancels pending withdrawal request. Atomically restores `availableBalance` and writes a `WITHDRAWAL_REFUND` transaction. |

---

### E. Bank Hub & SePay Webhooks (6 Endpoints)

| Method | Path | Caller | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `POST` | `/bank-hub/initiate-link` | EXPERT | `[None]` | Bank already linked → 409 | `users` | Registers expert bank account details (`sepayBankAccountXid`, `bankAccountHolderName`, `bankLinkedAt`). |
| `PUT` | `/bank-hub/link` | EXPERT | `[None]` | No bank linked yet → 409 | `users` | Updates an already linked expert bank account. |
| `GET` | `/bank-hub/link` | EXPERT | `[None]` | — | — (R: `users`) | Returns current bank link status and holder details. |
| `POST` | `/webhooks/sepay/ipn` | SePay Server | HMAC | Signature invalid → 401 · Expired VA → 409 · Already processed reference → 200 `{ message: "Already processed" }` | `wallets`, `wallet_transactions`, `virtual_accounts`, `escrow_accounts`, `milestones`, `paygated_documents`, `engagements`, `projects` | Central inbound payment webhook. Validates HMAC signature over `{timestamp}.{rawBody}`. Routes by `entityType` (`WALLET_TOPUP`, `MILESTONE`, `SERVICE`). Executes atomic ledger operations and emits Socket.io updates. |
| `POST` | `/webhooks/sepay/chi-ho-credit` | SePay Server | HMAC | Signature invalid → 401 | — | Webhook receiver for disbursement credits. |
| `POST` | `/webhooks/sepay/bank-linked` | SePay Server | HMAC | Signature invalid → 401 | — | Webhook receiver for automated bank linkage callbacks. |

---

### F. Subscriptions (3 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `POST` | `/subscriptions/activate` | CLIENT, EXPERT | `[None]` | Role mismatch → 409 · Active subscription exists → 409 · Package inactive → 422 · Insufficient balance → 422 `INSUFFICIENT_BALANCE` | `wallets`, `wallet_transactions`, `users`, `subscription_purchase_logs` | Atomically debits wallet for package `priceVnd`, logs `SUBSCRIPTION` transaction, creates purchase log, upgrades `subscriptionClientTier` or `subscriptionExpertTier` to `'pro'`, calculates expiry, and re-issues JWT token. |
| `GET` | `/subscriptions/status` | CLIENT, EXPERT | `[None]` | User not found → 404 | — (R: `users`) | Evaluates subscription expiry at query time. Returns `subscriptionTier` (`'free'` if expired) and `isExpired` boolean. |
| `GET` | `/subscriptions/history` | CLIENT, EXPERT | `[None]` | — | — (R: `subscription_purchase_logs`, `subscription_packages`) | Returns user's historical subscription activation logs with package details. |

---

### G. Public Configuration CMS (7 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `GET` | `/config/all` | Unauthenticated | `[None]` | — | — (R: `domain_definitions`, `seam_definitions`, `archetype_definitions`, `void_code_definitions`, `subscription_packages`) | Returns full platform configuration in a single payload for app initialization. |
| `GET` | `/config/domains` | Unauthenticated | `[None]` | — | — (R: `domain_definitions`) | Returns list of active AI domain definitions (A–F). |
| `GET` | `/config/seams` | Unauthenticated | `[None]` | — | — (R: `seam_definitions`) | Returns list of active cross-domain seam definitions (e.g. `A↔C`). |
| `GET` | `/config/archetypes` | Unauthenticated | `[None]` | — | — (R: `archetype_definitions`) | Returns list of active project archetype categories (1–6). |
| `GET` | `/config/archetypes/{code}/probe-questions` | Unauthenticated | `[None]` | — | — (R: `probe_questions`) | Returns active Stage 3 probe questions for a specific archetype code. |
| `GET` | `/config/subscription-packages` | Unauthenticated | `[None]` | — | — (R: `subscription_packages`) | Returns active subscription packages, filterable by `?role=CLIENT` or `?role=EXPERT`. |
| `GET` | `/config/void-codes` | Unauthenticated | `[None]` | — | — (R: `void_code_definitions`) | Returns active void code gap definitions and severity levels. |

---

### H. AI Elicitation Engine (19 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `POST` | `/elicitation/sessions` | CLIENT (CEO) | `[None]` | Subtype != CEO → 403 | `elicitation_sessions` | Idempotent: returns existing `IN_PROGRESS` session or creates a new one at Stage 1. |
| `GET` | `/elicitation/sessions` | CLIENT (CEO) | `[Pro-C]` | — | — (R: `elicitation_sessions`) | Returns list of all elicitation sessions owned by user. |
| `GET` | `/elicitation/sessions/active` | CLIENT (CEO) | `[Pro-C]` | — | — (R: `elicitation_sessions`) | Returns the currently active `IN_PROGRESS` session or null. |
| `GET` | `/elicitation/sessions/history` | CLIENT (CEO) | `[Pro-C]` | — | — (R: `elicitation_sessions`) | Returns `ABANDONED` and `RETURNED` sessions history. |
| `GET` | `/elicitation/sessions/{id}` | CLIENT (CEO) | `[Pro-C]` | Not owner → 403 · Session missing → 404 | — (R: `elicitation_sessions`, `projects`, `platform_decisions`) | Returns full session payload, project ID (if published), and gate failure advisory notes (if returned). |
| `DELETE` | `/elicitation/sessions/{id}` | CLIENT (CEO) | `[Pro-C]` | Not owner → 403 · Already completed → 409 | `elicitation_sessions` | Deletes an in-progress or draft session. |
| `PUT` | `/elicitation/sessions/{id}/abandon` | CLIENT (CEO) | `[Pro-C]` | Not owner → 403 · Already completed → 409 | `elicitation_sessions` | Sets session `state = 'ABANDONED'`. |
| `PUT` | `/elicitation/sessions/{id}/stage1` | CLIENT (CEO) | `[Pro-C]` | Empty text / < 10 chars → 400 · Stage != 1 → 400 | `elicitation_sessions` | Calls FastAPI `/llm/elicitation/stage1-extract`. Stores symptoms, scale signals, void codes, critical artifacts, and recommended archetypes. Advances to Stage 2. |
| `PUT` | `/elicitation/sessions/{id}/stage2` | CLIENT (CEO) | `[Pro-C]` | Unrecommended archetype → 400 · Stage != 2 → 400 | `elicitation_sessions` | Locks project archetype, records acknowledged void codes (`injected = true`), advances to Stage 3. |
| `PUT` | `/elicitation/sessions/{id}/stage3` | CLIENT (CEO) | `[Pro-C]` | Missing probe answers → 400 · Stage != 3 → 400 | `elicitation_sessions` | Calls FastAPI `/llm/elicitation/stage3-vagueness-check`. If vague/irrelevant, returns flags without advancing; otherwise advances to Stage 4. |
| `PUT` | `/elicitation/sessions/{id}/stage4` | CLIENT (CEO) | `[Pro-C]` | Stage not 4 or 5 → 400 | `elicitation_sessions` | CEO completes technical context input (Scenario A/B self). Stores tech stack, integration, volume, and artifact content. Advances to Stage 5. |
| `PUT` | `/elicitation/sessions/{id}/stage4-handoff` | CLIENT (TECH_TEAM) | `[None]` | Unlinked Tech Team member → 401 · Stage not 4 or 5 → 400 | `elicitation_sessions` | Delegated Tech Team member completes Stage 4 technical context. Stores submitter ID in `_tech_team_user_id` and advances session to Stage 5. Emits Socket.io event to CEO. |
| `POST` | `/elicitation/sessions/{id}/stage5` | CLIENT (CEO) | `[Pro-C]` | Missing stage inputs → 400 · Stage not 4 or 5 → 400 · Already published → 409 | `projects`, `elicitation_sessions`, `tech_team_profiles`, `platform_decisions` | Triggers FastAPI Stage 5 synthesis. Evaluates quality gates (completeness ≥ 0.70, no unresolved HIGH voids, candidate match ≥ 1). On pass: creates `projects` row (`state = 'PUBLISHED'`), completes session, links Tech Team member, emits `project.published` event. On fail: sets session `state = 'RETURNED'`. |
| `POST` | `/elicitation/sessions/{id}/generate-handoff-link` | CLIENT (CEO) | `[Pro-C]` | Not owner → 403 | `elicitation_sessions` | Generates a 72-hour signed JWT invite token and link for inviting a Tech Team member to complete Stage 4. |
| `PUT` | `/elicitation/sessions/{id}/self-technical` | CLIENT (CEO) | `[Pro-C]` | User not found → 404 | `users` | Toggles project-specific self-technical override flag on `users.selfTechnicalProjects` and re-issues JWT. |
| `POST` | `/elicitation/sessions/{id}/retry-synthesis` | CLIENT (CEO) | `[Pro-C]` | Already completed → 409 · Stage != 5 → 400 | `projects`, `elicitation_sessions`, `platform_decisions` | Retries Stage 5 synthesis on a previously returned or failed session. |
| `PUT` | `/elicitation/sessions/{id}/revert` | CLIENT (CEO) | `[Pro-C]` | Forward target stage → 400 · Already completed → 409 | `elicitation_sessions` | Reverts session back to a target earlier stage (`currentStage = targetStage`) and resets state to `IN_PROGRESS`. |
| `PUT` | `/elicitation/sessions/{id}/continue` | CLIENT (CEO) | `[Pro-C]` | Already completed → 409 | `elicitation_sessions` | Re-activates an abandoned or returned session back to `IN_PROGRESS`. |
| `POST` | `/elicitation/sessions/{id}/stage4-recommend` | CLIENT (CEO) | `[Pro-C]` | Stage < 4 → 400 | — | Calls FastAPI `/llm/elicitation/stage4-recommend` to generate tech stack recommendations for non-technical CEOs. |
| `PATCH` | `/elicitation/sessions/{id}/draft` | CLIENT (CEO) | `[Pro-C]` | Stage != 1 → 200 `{ saved: false }` | `elicitation_sessions` | Autosaves raw Stage 1 free-text draft (`symptomTextDraft`) without executing LLM extraction. |
| `PATCH` | `/elicitation/sessions/{id}/stage4-draft` | CLIENT | `[Pro-C]` | Stage not 4 or 5 → 200 `{ saved: false }` | `elicitation_sessions` | Autosaves Stage 4 technical context form inputs (`stage4DraftJson`) without executing LLM calls. |

---

### I. Projects & Shortlist Matching (13 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `GET` | `/projects/marketplace` | EXPERT, ADMIN | `[None]` | — | — (R: `projects`) | Returns published marketplace projects filterable by `archetype`, `tier`, and `limit`. |
| `GET` | `/projects` | CLIENT | `[None]` | — | — (R: `projects`, `tech_team_profiles`) | Returns client projects. `?slim=true` omits JSONB fields for lightweight list rendering. |
| `GET` | `/projects/{id}` | CLIENT, EXPERT, ADMIN | `[None]` | Project missing → 404 · Unpublished & unauthorized → 403 | — (R: `projects`, `tech_team_profiles`) | Returns project spec details. |
| `GET` | `/projects/{id}/artifact-a` | CLIENT, EXPERT | `[None]` | Project missing → 404 · Unauthorized → 403 | — (R: `projects`) | Returns public business specification (`artifactAJson`). |
| `GET` | `/projects/{id}/artifact-b` | CLIENT, EXPERT, ADMIN | `[None]` | CEO request → 403 (Permanent CEO Exclusion) · Unconnected expert → 403 | — (R: `projects`, `engagements`, `capability_bids`) | Calls FastAPI artifact-b guard endpoint. Returns `artifactBJson` only when engagement is `CONNECTED`/`ACTIVE`, bid is verified, and both NDAs are signed. |
| `PUT` | `/projects/{id}/name` | CLIENT (CEO) | `[None]` | Not project owner → 403 | `projects` | Renames project. Emits Socket.io `project:updated` event to linked Tech Team members. |
| `PUT` | `/projects/{id}/milestones` | CLIENT (CEO) | `[None]` | Not owner → 403 · Terms locked → 409 `MILESTONE_TERMS_LOCKED` | `projects` | Updates project milestone framework template (`milestoneFrameworkJson`). |
| `POST` | `/projects/{id}/milestone-chat` | CLIENT, EXPERT | `[None]` | Unauthorized party → 403 | `milestone_chat_sessions` | Multi-turn AI milestone assistant. Loads history, calls FastAPI `/llm/elicitation/milestone-chat`, returns reply and optional edit suggestion. |
| `GET` | `/projects/{id}/milestone-chat/sessions` | CLIENT, EXPERT | `[None]` | Unauthorized party → 403 | — (R: `milestone_chat_sessions`) | Returns list of past milestone chat sessions for project sidebar. |
| `GET` | `/projects/{id}/milestone-chat/sessions/{sessionId}` | CLIENT, EXPERT | `[None]` | Session missing → 404 | — (R: `milestone_chat_sessions`) | Returns full message history for a specific milestone chat session. |
| `GET` | `/matching/{projectId}/shortlist` | CLIENT (CEO) | `[None]` | Not project owner → 403 · Project not published → 422 | `project_shortlist_cache` | Returns AI-ranked expert shortlist. Strips numeric scores before returning. `?refresh=true` forces re-score via FastAPI. |

---

### J. Expert Profiles & Capabilities (11 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `GET` | `/expert-profile/me` | EXPERT | `[None]` | Profile missing → 404 | — (R: `expert_profiles`, `expert_domain_depths`, `expert_seam_claims`) | Returns expert's own profile, domain depths, and seam claims. |
| `PUT` | `/expert-profile/me` | EXPERT | `[None]` | Profile missing → 404 | `expert_profiles` | Updates bio, engagement model, stack tags (`stackTagsJson`), and archetype history. |
| `GET` | `/expert-profile/search` | CLIENT, ADMIN | `[None]` | — | — (R: `users`, `expert_profiles`) | Search/filter public expert profiles by domain, seam, archetype, or limit. |
| `GET` | `/expert-profile/{userId}` | CLIENT, ADMIN | `[None]` | Profile missing → 404 | — (R: `expert_profiles`, `expert_domain_depths`, `expert_seam_claims`, `reviews`) | Returns public expert profile with ratings and review counts. |
| `GET` | `/expert-profile/me/domains` | EXPERT | `[None]` | — | — (R: `expert_domain_depths`) | Returns list of current expert domain depths. |
| `GET` | `/expert-profile/me/seams` | EXPERT | `[None]` | — | — (R: `expert_seam_claims`) | Returns list of current expert seam claims with verification tiers and lockout timers. |
| `POST` | `/expert-profile/domains` | EXPERT | `[None]` | Duplicate domain → 409 | `expert_domain_depths` | Upserts single domain depth declaration. |
| `PUT` | `/expert-profile/domains/sync` | EXPERT | `[None]` | — | `expert_domain_depths` | Bulk syncs domain depth claims inside a transaction. |
| `PUT` | `/expert-profile/domains/{id}` | EXPERT | `[None]` | Not found → 404 · Not owner → 403 | `expert_domain_depths` | Updates depth level (`SURFACE`, `OPERATIONAL`, `DEEP`). |
| `DELETE` | `/expert-profile/domains/{id}` | EXPERT | `[None]` | Not found → 404 · Not owner → 403 | `expert_domain_depths` | Deletes a domain depth record. |
| `POST` | `/expert-profile/seams` | EXPERT | `[None]` | Duplicate seam → 409 | `expert_seam_claims` | Upserts single seam claim at `CLAIMED` tier. |
| `PUT` | `/expert-profile/seams/sync` | EXPERT | `[None]` | Attempting to delete seam with submission history → 400 | `expert_seam_claims` | Bulk syncs seam claims. Rejection prevents removing seams with verification history (integrity protection). |

---

### K. Portfolio Verification (5 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `POST` | `/portfolio-submissions` | EXPERT | `[Pro-E]` | Claim missing → 404 · Not owner → 403 · Already verified → 422 · Lockout active (`lockedUntil > now()`) → 429 | `portfolio_submissions`, `expert_seam_claims`, `platform_decisions` | Calls FastAPI `/llm/portfolio-eval`. On pass (confidence ≥ 0.85): upgrades seam tier to `EVIDENCE_BACKED`. On fail: increments failure count; triggers 30-day lockout on 5th failure. |
| `GET` | `/portfolio-submissions` | EXPERT | `[None]` | — | — (R: `portfolio_submissions`, `expert_seam_claims`, `platform_decisions`) | Returns expert's portfolio submission history with joined advisory notes. |
| `GET` | `/portfolio-submissions/{id}` | EXPERT, ADMIN | `[None]` | Submission missing → 404 · Not owner → 403 | — (R: `portfolio_submissions`, `platform_decisions`) | Returns detailed submission record and evaluation notes. |
| `DELETE` | `/portfolio-submissions/me/portfolio/{id}` | EXPERT | `[None]` | Submission missing → 404 · Not owner → 403 | `portfolio_submissions` | Deletes unapproved portfolio submission record. |
| `GET` | `/portfolio-submissions/me/portfolio/{id}` | EXPERT | `[None]` | Submission missing → 404 · Not owner → 403 | — (R: `portfolio_submissions`) | Returns specific portfolio entry for editing or review. |

---

### L. Service Listings Marketplace (11 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `GET` | `/services/me` | EXPERT | `[None]` | — | — (R: `services`) | Returns expert's own service listings across all states (`DRAFT`, `PUBLISHED`, `SUSPENDED`). |
| `GET` | `/services/me/purchases` | CLIENT | `[None]` | — | — (R: `engagements`, `services`, `milestones`) | Returns CEO's purchased service engagements. |
| `GET` | `/services` | All | `[None]` | — | — (R: `services`) | Browses published service marketplace listings (`state = 'PUBLISHED'`). |
| `POST` | `/services` | EXPERT | `[None]` | AI gen without Expert Pro → 400 · Missing required inputs → 400 | `services` | Creates service listing in `DRAFT` state. If `useAiGenerator = true`, calls FastAPI `/llm/service-generate`. |
| `GET` | `/services/{id}` | All | `[None]` | Service missing → 404 · Unpublished & unauthorized → 404 | — (R: `services`, `reviews`) | Returns service listing details and expert aggregate ratings. |
| `PUT` | `/services/{id}` | EXPERT | `[None]` | Not owner → 403 · Suspended → 422 · Immutable serviceType change after publish → 422 | `services` | Updates service title, description, scope, timeline, or price. |
| `DELETE` | `/services/{id}` | EXPERT | `[None]` | Not owner → 403 · `state != 'DRAFT'` → 422 · Active engagements exist → 422 | `services` | Deletes a service listing draft. |
| `POST` | `/services/{id}/purchase` | CLIENT (CEO) | `[None]` | Not CEO → 403 · `state != 'PUBLISHED'` → 422 | `engagements`, `virtual_accounts` | Directly purchases an expert service. Creates a `SERVICE_PURCHASE` engagement and a 24-hour virtual account. Returns VietQR payment URL. |
| `PUT` | `/services/{id}/publish` | EXPERT | `[None]` | Not owner → 403 · `state != 'DRAFT'` → 422 | `services` | Transitions service state from `DRAFT` to `PUBLISHED`. |
| `PUT` | `/services/{id}/unpublish` | EXPERT | `[None]` | Not owner → 403 · `state != 'PUBLISHED'` → 422 | `services` | Transitions service state from `PUBLISHED` to `DRAFT`. |

---

### M. Engagements (12 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `GET` | `/engagements` | All | `[None]` | — | — (R: `engagements`, `projects`, `capability_bids`) | Returns engagements party to the user (or all for ADMIN). |
| `GET` | `/engagements/{id}` | CLIENT, EXPERT, ADMIN | `[None]` | Engagement missing → 404 · Not party → 403 | — (R: `engagements`, `projects`, `capability_bids`, `milestones`, `services`) | Returns full engagement detail. |
| `PUT` | `/engagements/{id}/accept-nda` | CLIENT (CEO) | `[None]` | Not CEO owner → 403 · `state != 'PENDING'` → 422 · Already signed → 409 · Unaccepted bid contract → 422 | `engagements` | CEO signs NDA (`clientNdaAcceptedAt = now()`). If expert has also signed, transitions engagement to `CONNECTED`. |
| `POST` | `/engagements/{id}/connect` | EXPERT | `[None]` | Not expert owner → 403 · `state != 'PENDING'` → 422 · Already signed → 409 · Unaccepted bid contract → 422 | `engagements` | Expert accepts connection + NDA (`expertNdaAcceptedAt = now()`). If CEO signed, transitions to `CONNECTED`. Returns `prompt_bank_link: true` if no bank linked. |
| `PUT` | `/engagements/{id}/decline` | EXPERT | `[None]` | Not expert owner → 403 · `state != 'PENDING'` → 422 | `engagements` | Expert declines connection request. Sets `engagements.state = 'DECLINED'`. |
| `GET` | `/engagements/{id}/milestones` | CLIENT, EXPERT, ADMIN | `[None]` | Not party → 403 | — (R: `milestones`, `acceptance_criteria`, `milestone_dod_items`) | Returns ordered list of milestones for engagement. |
| `GET` | `/engagements/{id}/submissions` | CLIENT, EXPERT, ADMIN | `[None]` | Not party → 403 | — (R: `milestone_submissions`, `milestones`) | Returns all milestone submissions across engagement. |
| `GET` | `/engagements/{id}/bid` | CLIENT, EXPERT, ADMIN | `[None]` | Not party → 403 · Bid missing → 404 | — (R: `capability_bids`) | Returns the capability bid record for engagement. |
| `GET` | `/engagements/{id}/disputes` | CLIENT, EXPERT, ADMIN | `[None]` | Not party → 403 | — (R: `disputes`, `acceptance_criteria`, `milestones`, `escrow_accounts`) | Returns all disputes for engagement. |
| `PUT` | `/engagements/{id}/cancel` | CLIENT, EXPERT, ADMIN | `[None]` | Not party → 403 · Active funded milestones exist → 422 | `engagements` | Cancels engagement (`state = 'CANCELLED'`). Blocked if any milestone is in `FUNDED`, `IN_PROGRESS`, `SUBMITTED`, or `IN_REVISION`. |

---

### N. Capability Bids & Commercial Negotiation (13 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `POST` | `/bids` | EXPERT | `[Pro-E]` (Tier 2-3) | Project not published → 422 · Project owner bidding → 403 · Expert Pro missing for Tier 2/3 → 403 · Not in shortlist → 403 · Existing active engagement → 409 | `engagements`, `capability_bids`, `invitations` | Creates engagement (`PENDING`) and bid (`SUBMITTED`). If `selfTechnical = true`, auto-approves tech status; else sets `TECH_REVIEW`. Updates pending invitations to `ACCEPTED`. Uses `Serializable` TX. |
| `GET` | `/bids` | CLIENT, EXPERT, ADMIN | `[None]` | — | — (R: `capability_bids`, `engagements`) | Returns bids visible to caller role. |
| `GET` | `/bids/{id}` | CLIENT, EXPERT, ADMIN | `[None]` | Bid missing → 404 · Not party → 403 | — (R: `capability_bids`, `engagements`, `milestones`) | Returns bid negotiation envelope detail. Restricts commercial view for Tech Team users. |
| `PUT` | `/bids/{id}` | EXPERT | `[None]` | Not owner → 403 · `tech_status != 'REVISION_REQUESTED'` → 422 | `capability_bids` | Expert submits revised proposal. Increments `version_number` and resets `tech_status = 'PENDING'`. |
| `DELETE` | `/bids/{id}` | EXPERT | `[None]` | Not owner → 403 · `state NOT IN ('SUBMITTED', 'TECH_REVIEW')` → 422 | `capability_bids`, `engagements` | Expert withdraws bid (`state = 'WITHDRAWN'`), setting engagement to `DECLINED`. |
| `PUT` | `/bids/{id}/tech-review` | CLIENT (TECH_TEAM) | `[None]` | Not Tech Team → 403 · Self-technical project → 422 · Unlinked project → 403 · Stale version → 409 | `capability_bids` | Tech Team sets `action = 'APPROVED'` or `'REVISION_REQUESTED'`. |
| `PUT` | `/bids/{id}/ceo-decision` | CLIENT (CEO) | `[None]` | Bid missing → 404 | `capability_bids`, `engagements`, `milestones`, `acceptance_criteria`, `projects` | Routes to accept or decline handler based on `decision = 'APPROVED' | 'DECLINED'`. |
| `PUT` | `/bids/{id}/counter-offer` | CLIENT (CEO) | `[None]` | — | — | Deprecated endpoint: throws 422 directing caller to `POST /bids/:id/offers`. |
| `POST` | `/bids/{id}/offers` | CLIENT (CEO), EXPERT | `[None]` | Closed bid → 409 · Stale offer version → 409 · Non-recipient countering → 403 · Incomplete tech review → 422 | `capability_bids` | Proposes a counter-offer round with full per-milestone terms. Increments version and updates negotiation envelope. |
| `POST` | `/bids/{id}/offers/{offerId}/accept` | CLIENT (CEO), EXPERT | `[None]` | Stale version → 409 · Non-recipient accepting → 403 · Tech review incomplete → 422 · Engagement not pending → 422 | `capability_bids`, `milestones`, `acceptance_criteria`, `projects`, `engagements` | Accepts current offer terms. Atomically sets bid `state = 'SELECTED'`, creates contract `milestones` and `acceptance_criteria`, mirrors framework on project, and declines competing bids. |
| `POST` | `/bids/{id}/offers/{offerId}/decline` | CLIENT (CEO), EXPERT | `[None]` | Stale version → 409 · Non-recipient declining → 403 | `capability_bids`, `engagements` | Declines current offer, setting bid state and engagement state to `DECLINED`. |
| `POST` | `/bids/{id}/reconcile` | CLIENT (CEO), EXPERT, ADMIN | `[None]` | Not party → 403 · Incompatible terms → 422 | `capability_bids`, `milestones`, `acceptance_criteria`, `projects` | Idempotently converts a legacy bid into the versioned negotiation envelope format (v1). |

---

### O. Milestones & Workflows (7 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `POST` | `/milestones` | CLIENT (CEO) | `[None]` | Empty criteria → 400 · `payment_amount_vnd <= 0` → 400 · Not CEO owner → 403 · Terms locked → 409 `MILESTONE_TERMS_LOCKED` · Uncompleted tech handoff → 422 | `milestones`, `acceptance_criteria` | Creates a single milestone in `DEFINED` state. Derives `signOffAuthority` (`CEO` if self-technical, `JOINT` otherwise). Asynchronously checks criteria quality gate via FastAPI `/llm/criterion-check`. |
| `GET` | `/milestones` | CLIENT, EXPERT, ADMIN | `[None]` | Not party → 403 | — (R: `milestones`, `acceptance_criteria`, `milestone_dod_items`) | Returns milestones list filtered by `?engagementId=...`. |
| `GET` | `/milestones/{id}` | CLIENT, EXPERT, ADMIN | `[None]` | Milestone missing → 404 · Not party → 403 | `acceptance_criteria` (auto-heals service orders) | Returns full milestone details, criteria, DoD items, submissions, and engagement context. Auto-heals missing default criteria for service orders. |
| `PATCH` | `/milestones/{id}` | CLIENT (CEO) | `[None]` | Not CEO owner → 403 · Terms locked → 409 `MILESTONE_TERMS_LOCKED` · `state != 'DEFINED'` → 422 | `milestones`, `acceptance_criteria` | Updates milestone title, deliverable statement, payment amount, or criteria while in `DEFINED` state. |
| `DELETE` | `/milestones/{id}` | CLIENT (CEO) | `[None]` | Not CEO owner → 403 · Terms locked → 409 `MILESTONE_TERMS_LOCKED` · `state != 'DEFINED'` → 422 | `milestones`, `acceptance_criteria` | Deletes a milestone in `DEFINED` state. |
| `PUT` | `/milestones/{id}/fund` | CLIENT (CEO) | `[None]` | Not CEO owner → 403 · State not DEFINED or AWAITING_PAYMENT with expired VA → 422 · Unsigned NDA or unaccepted bid → 422 | `milestones`, `virtual_accounts` | Generates a 24-hour fixed-amount `MILESTONE` virtual account and sets `milestones.state = 'AWAITING_PAYMENT'`. |
| `GET` | `/milestones/{id}/disputes` | CLIENT, EXPERT, ADMIN | `[None]` | Milestone missing → 404 · Not party → 403 | — (R: `disputes`, `acceptance_criteria`, `escrow_accounts`) | Returns dispute records for a specific milestone. |
| `POST` | `/milestones/bulk` | CLIENT (CEO) | `[None]` | Not CEO owner → 403 · Terms locked → 409 `MILESTONE_TERMS_LOCKED` · Existing milestones → 409 · Uncompleted tech handoff → 422 | `milestones`, `acceptance_criteria` | Bulk initializes all engagement milestones from the CEO final template in a single transaction. |

---

### P. Acceptance Criteria & DoD Checklist (12 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `GET` | `/criteria/{milestoneId}` | CLIENT, EXPERT, ADMIN | `[None]` | Milestone missing → 404 · Not party → 403 | — (R: `acceptance_criteria`) | Returns acceptance criteria list for a milestone. |
| `POST` | `/criteria/{milestoneId}` | CLIENT (CEO) | `[None]` | Milestone missing → 404 · Not CEO owner → 403 · Terms locked → 409 · `state != 'DEFINED'` → 422 | `acceptance_criteria` | Adds a criterion to a `DEFINED` milestone. Derives `verifiedByRole`. |
| `DELETE` | `/criteria/{id}` | CLIENT (CEO) | `[None]` | Criterion missing → 404 · Not CEO owner → 403 · Terms locked → 409 · `state != 'DEFINED'` → 422 | `acceptance_criteria` | Deletes an acceptance criterion. |
| `PUT` | `/criteria/{id}/verify` | CLIENT | `[None]` | Criterion missing → 404 · `state != 'SUBMITTED'` → 422 · Already verified by role → 409 · Unverified Tech Team prerequisite → 422 · Unauthorized reviewer → 403 | `acceptance_criteria`, `milestones`, `escrow_accounts`, `wallets`, `wallet_transactions`, `engagements` | Marks criterion verified by reviewer (`TECH_TEAM` or `CEO`). If all required criteria are verified and no disputes exist, auto-approves milestone and executes atomic escrow release. |
| `PUT` | `/criteria/{id}/revision` | CLIENT | `[None]` | Criterion missing → 404 · `state != 'SUBMITTED'` → 422 · Unauthorized reviewer → 403 | `acceptance_criteria`, `milestones` | Requests deliverable revision. Sets `revisionNote`, clears verification timestamps, and sets `milestones.state = 'IN_REVISION'`. Emits Socket.io event. |
| `POST` | `/milestones/{id}/dod/items` | CLIENT, EXPERT | `[None]` | Milestone missing → 404 | `milestone_dod_items` | Adds a single Definition of Done (DoD) checklist item to a milestone. |
| `POST` | `/milestones/{id}/dod/items/bulk` | CLIENT, EXPERT | `[None]` | Milestone missing → 404 | `milestone_dod_items` | Bulk adds multiple DoD checklist items in one transaction. |
| `GET` | `/milestones/{id}/dod` | CLIENT, EXPERT, ADMIN | `[None]` | — | — (R: `milestone_dod_items`) | Returns DoD checklist items for a milestone. |
| `DELETE` | `/milestones/{id}/dod/{itemId}` | CLIENT, EXPERT | `[None]` | Item missing → 404 · `status != 'PENDING'` → 422 | `milestone_dod_items` | Deletes a `PENDING` DoD item. |
| `PUT` | `/milestones/{id}/dod/{itemId}` | EXPERT | `[None]` | Item missing → 404 · Marking required item NOT_APPLICABLE → 400 (DB CHECK) · Missing completion/NA note → 400 | `milestone_dod_items` | Updates DoD item status (`COMPLETED` or `NOT_APPLICABLE`) and notes. Required items cannot be marked NOT_APPLICABLE. |

---

### Q. Submissions & Pay-Gated Documents (7 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `POST` | `/milestones/{id}/submit` | EXPERT | `[None]` | Milestone missing → 404 · Not assigned expert → 403 · Ineligible state (`NOT IN ('FUNDED', 'IN_PROGRESS', 'IN_REVISION')`) → 422 · Required DoD items incomplete → 422 `REQUIRED_DOD_INCOMPLETE` | `milestone_submissions`, `milestones` | Submits milestone deliverables. Enforces required DoD checklist gate. Sets `milestones.state = 'SUBMITTED'`. Emits Socket.io updates to client/tech team. |
| `POST` | `/milestones/{id}/paygated-docs` | EXPERT | `[None]` | Milestone missing → 404 | `paygated_documents` | Stages a pay-gated document URL (`STAGED` if pre-funding, `RELEASED` if already funded). |
| `POST` | `/milestones/{id}/paygated-docs/bulk` | EXPERT | `[None]` | Milestone missing → 404 | `paygated_documents` | Bulk stages multiple pay-gated document URLs atomically. |
| `GET` | `/milestones/{id}/paygated-docs` | CLIENT, EXPERT | `[None]` | Milestone missing → 404 · CEO or unauthorized party → 403 · Unfunded staged docs → 403 | — (R: `paygated_documents`, `engagements`, `tech_team_profiles`) | TECH_TEAM or EXPERT downloads unlocked pay-gated documents (`releaseState = 'RELEASED'`). CEOs are permanently excluded. |
| `DELETE` | `/milestones/{id}/submissions/latest` | EXPERT | `[None]` | Milestone missing → 404 · Not assigned expert → 403 · `state != 'SUBMITTED'` → 422 | `milestone_submissions`, `milestones` | Retracts latest deliverable submission and reverts milestone state back to `IN_PROGRESS`. |
| `GET` | `/milestones/{id}/submissions` | CLIENT, EXPERT, ADMIN | `[None]` | Milestone missing → 404 · Not party → 403 | — (R: `milestone_submissions`, `engagements`) | Returns full submission history for milestone. |
| `GET` | `/milestones/{id}/submissions/latest` | CLIENT, EXPERT, ADMIN | `[None]` | No submissions found → 404 · Not party → 403 | — (R: `milestone_submissions`, `engagements`) | Returns most recent submission record for milestone. |

---

### R. Disputes (3 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `POST` | `/disputes` | CLIENT, EXPERT | `[None]` | Criterion missing → 404 · Criterion already verified → 422 · Ineligible milestone state (`NOT IN ('SUBMITTED', 'IN_REVISION')`) → 422 · Not party → 403 · Escrow account missing → 404 · Escrow status != 'HELD' → 409 | `disputes`, `escrow_accounts`, `milestones`, `acceptance_criteria` | Files a dispute against an unverified criterion. Atomically sets escrow status to `FROZEN` and milestone state to `DISPUTED`. Calls FastAPI `/llm/dispute-eval`. On AI confidence ≥ 0.80, executes `AUTO_RESOLVED` ledger settlement. Otherwise routes to `MANUAL_REVIEW`. |
| `GET` | `/disputes` | CLIENT, EXPERT, ADMIN | `[None]` | — | — (R: `disputes`, `engagements`, `milestones`, `escrow_accounts`) | Returns disputes list visible to user role. |
| `GET` | `/disputes/{id}` | CLIENT, EXPERT, ADMIN | `[None]` | Dispute missing → 404 · Not party → 403 | — (R: `disputes`, `engagements`, `acceptance_criteria`, `milestones`, `escrow_accounts`) | Returns dispute details, criterion text, deliverable description, and escrow status. |

---

### S. Messaging & Conversations (10 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `GET` | `/engagements/{id}/messages` | Authenticated | `[None]` | Engagement missing → 404 · Not party → 403 | — (R: `messages`, `engagements`, `tech_team_profiles`) | Retrieves cursor-paginated chat history for engagement workspace. |
| `GET` | `/projects/{id}/messages` | Authenticated | `[None]` | Project missing → 404 · Project not published → 403 · Unauthorized → 403 | — (R: `messages`, `projects`) | Retrieves cursor-paginated chat history for pre-bid project Q&A thread. |
| `POST` | `/messages/{id}/read` | Authenticated | `[None]` | Message missing → 404 | `message_reads` | Upserts read receipt for a specific message. |
| `GET` | `/engagements/{id}/messages/unread-count` | Authenticated | `[None]` | — | — (R: `messages`, `message_reads`) | Returns unread message count for engagement. |
| `GET` | `/conversations` | Authenticated | `[None]` | — | — (R: `engagements`, `messages`, `message_reads`, `tech_team_profiles`) | Returns list of active conversation threads with last message preview and unread counts. |
| `GET` | `/projects/{id}/messages/unread-count` | Authenticated | `[None]` | — | — (R: `messages`) | Returns unread message count for pre-bid project thread. |
| `POST` | `/conversations/{engagementId}/read` | Authenticated | `[None]` | — | `message_reads` | Atomically marks all unread messages in an engagement conversation as read. |
| `POST` | `/conversations/read-all` | Authenticated | `[None]` | — | `message_reads` | Marks all unread messages across all user conversations as read. |

---

### T. Invitations (4 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `GET` | `/invitations` | EXPERT | `[None]` | — | — (R: `invitations`, `projects`, `users`, `client_profiles`) | Returns all project invitations received by expert. Computes `isExpired` dynamically (`expiresAt < now()`). |
| `POST` | `/invitations/{id}/decline` | EXPERT | `[None]` | Invitation missing → 404 · Not owner → 403 · Status != 'PENDING' → 422 | `invitations` | Expert explicitly declines a pending project invitation. |
| `GET` | `/invitations/sent` | CLIENT (CEO) | `[None]` | — | — (R: `invitations`, `projects`, `users`) | Returns list of invitations sent by CEO across all projects. |
| `DELETE` | `/invitations/{id}` | CLIENT (CEO) | `[None]` | Invitation missing → 404 · Not sender → 403 · Status = 'ACCEPTED' → 422 | `invitations` | Retracts a pending project invitation. |

---

### U. Reviews (5 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `POST` | `/reviews` | CLIENT, EXPERT | `[None]` | User missing → 401 · Engagement missing → 400 · `state != 'CLOSED'` → 409 · Already reviewed → 409 · Not party → 403 · Target mismatch → 403 · Tech team missing structured signals → 400 | `reviews` | Submits post-closure review. CEO reviews Expert; Expert reviews Client; Tech Team reviews Expert with required `structuredSignalsJson`. |
| `GET` | `/reviews/{engagementId}` | CLIENT, EXPERT, ADMIN | `[None]` | Engagement missing → 400 · `state != 'CLOSED'` → 409 · Not party & not admin → 403 | — (R: `reviews`, `engagements`) | Returns reviews submitted for a closed engagement. |
| `GET` | `/reviews/users/{userId}` | Authenticated | `[None]` | — | — (R: `reviews`, `users`) | Returns all public reviews received by a user. |
| `GET` | `/reviews/me` | CLIENT, EXPERT | `[None]` | — | — (R: `reviews`, `users`) | Returns all reviews written by current user. |
| `GET` | `/reviews/me/received` | CLIENT, EXPERT | `[None]` | — | — (R: `reviews`, `users`) | Returns all reviews received by current user. |

---

### V. Notifications (5 Endpoints)

| Method | Path | Actor | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| `GET` | `/notifications/me` | Authenticated | `[None]` | — | — (R: `notifications`) | Returns current user's notifications ordered newest-first. |
| `GET` | `/notifications/me/unread-count` | Authenticated | `[None]` | — | — (R: `notifications`) | Returns unread notification count for nav badge display. |
| `PUT` | `/notifications/{id}/read` | Authenticated | `[None]` | Notification missing → 404 · Not owner → 403 | `notifications` | Marks a specific notification as read. |
| `PUT` | `/notifications/read-all` | Authenticated | `[None]` | — | `notifications` | Marks all unread notifications for current user as read. |
| `DELETE` | `/notifications/{id}` | Authenticated | `[None]` | Notification missing → 404 · Not owner → 403 | `notifications` | Deletes a notification record. |

---

### W. Admin Module — Oversight & Platform Controls (18 Endpoints)

> All `/admin/*` endpoints require `active_role = 'ADMIN'`. Non-admin requests return HTTP 403 Forbidden.

| Method | Path | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|
| `PUT` | `/admin/projects/{id}/suspend-spec` | `[Admin]` | Project missing → 404 | `projects`, `platform_decisions` | Emergency spec pull-back. Sets `projects.state = 'SUSPENDED'` and logs decision. |
| `PUT` | `/admin/users/{id}/suspend` | `[Admin]` | User missing → 404 | `users` | Suspends user account (`is_active = false`), blocking login. |
| `PUT` | `/admin/users/{id}/reactivate` | `[Admin]` | User missing → 404 | `users` | Reactivates suspended user account (`is_active = true`). |
| `GET` | `/admin/disputes` | `[Admin]` | — | — (R: `disputes`, `milestones`, `escrow_accounts`) | Returns platform dispute queue, filterable by `?state=...`. |
| `PUT` | `/admin/disputes/{id}/resolve` | `[Admin]` | Dispute missing → 404 · State not LAYER_1_EVAL or MANUAL_REVIEW → 409 | `disputes`, `acceptance_criteria`, `escrow_accounts`, `milestones`, `wallets`, `wallet_transactions`, `platform_decisions` | Manually resolves an escalated dispute (`EXPERT_WINS`, `CLIENT_WINS`, or `SPLIT`). Executes atomic ledger distribution and sets `disputes.state = 'RESOLVED'`. |
| `GET` | `/admin/decisions` | `[Admin]` | — | — (R: `platform_decisions`) | Returns platform decision audit log filterable by `decisionType` or `entityType`. |
| `GET` | `/admin/transactions` | `[Admin]` | — | — (R: `wallet_transactions`, `wallets`, `users`) | Returns wallet transaction ledger filterable by `type` or `userId`. |
| `GET` | `/admin/analytics` | `[Admin]` | — | — | Computes platform-wide aggregates: project breakdowns, elicitation completion rates, portfolio pass rates, dispute rates, auto-resolve rates, milestone completion rates. |
| `GET` | `/admin/withdrawals` | `[Admin]` | — | — (R: `withdrawal_requests`) | Returns expert withdrawal queue filterable by `status`. |
| `PUT` | `/admin/withdrawals/{id}/complete` | `[Admin]` | Request missing → 404 · `status != 'PENDING'` → 409 | `withdrawal_requests`, `milestones`, `engagements` | Confirms manual payout disbursement (`status = 'COMPLETED'`). If auto milestone release, advances milestone state to `RELEASED`. |
| `PUT` | `/admin/withdrawals/{id}/fail` | `[Admin]` | Request missing → 404 · `status != 'PENDING'` → 409 · Wallet missing → 404 | `withdrawal_requests`, `wallets`, `wallet_transactions` | Marks withdrawal as `FAILED` and atomically refunds amount to expert's `available_balance` with a `WITHDRAWAL_REFUND` transaction log. |
| `GET` | `/admin/platform-settings` | `[Admin]` | — | — (R: `platform_settings`) | Returns current platform settings (`platform_fee_pct`, `platform_wallet_id`). |
| `PUT` | `/admin/platform-settings` | `[Admin]` | `platform_fee_pct` not in `[0, 1]` → 400 | `platform_settings` | Updates platform fee percentage or platform wallet ID. |
| `GET` | `/admin/subscriptions/packages` | `[Admin]` | — | — (R: `subscription_packages`) | Lists all subscription packages including inactive packages. |
| `POST` | `/admin/subscriptions/packages` | `[Admin]` | — | `subscription_packages` | Creates a new subscription package for `CLIENT` or `EXPERT` role. |
| `PUT` | `/admin/subscriptions/packages/{id}` | `[Admin]` | Package missing → 404 | `subscription_packages` | Updates subscription package price, duration, name, or active status. |
| `DELETE` | `/admin/subscriptions/packages/{id}` | `[Admin]` | Package missing → 404 · Linked purchase history exists → 422 | `subscription_packages` | Hard-deletes a subscription package (only permitted if zero purchase history). |
| `GET` | `/admin/users` | `[Admin]` | — | — (R: `users`) | Lists all users filterable by `role`, `isActive`, or `search`. |
| `GET` | `/admin/users/{id}` | `[Admin]` | User missing → 404 | — (R: `users`, `wallets`, `client_profiles`, `expert_profiles`) | Returns full user profile details including wallet balances. |
| `GET` | `/admin/projects` | `[Admin]` | — | — (R: `projects`) | Lists all projects filterable by `state` or `archetype`. |
| `GET` | `/admin/projects/{id}` | `[Admin]` | Project missing → 404 | — (R: `projects`, `users`, `tech_team_profiles`, `invitations`) | Returns full project details for admin audit. |
| `GET` | `/admin/engagements` | `[Admin]` | — | — (R: `engagements`, `projects`, `users`, `services`) | Lists all engagements filterable by `state` or `projectId`. |
| `GET` | `/admin/experts` | `[Admin]` | — | — (R: `users`, `expert_seam_claims`, `expert_domain_depths`) | Lists all expert accounts with domain depths and seam claims. |
| `PUT` | `/admin/projects/{id}/reopen` | `[Admin]` | Project missing → 404 · `state != 'SUSPENDED'` → 422 | `projects` | Reopens a suspended project back to `PUBLISHED` state. |

---

### X. Admin Config CMS — Taxonomy & Prompts (24 Endpoints)

| Resource | Method | Path | Gate | Guard → Error | W Tables | Operational Notes |
|---|---|---|:---:|---|---|---|
| **Domains** | `GET` | `/admin/config/domains` | `[Admin]` | — | — (R: `domain_definitions`) | Lists domain definitions ordered by `sortOrder`. |
| | `POST` | `/admin/config/domains` | `[Admin]` | — | `domain_definitions` | Creates a domain definition (`code`, `name`, `description`). |
| | `PUT` | `/admin/config/domains/{id}` | `[Admin]` | Not found → 404 | `domain_definitions` | Updates domain definition name, description, active status, or sort order. |
| | `DELETE` | `/admin/config/domains/{id}` | `[Admin]` | Not found → 404 | `domain_definitions` | Soft-deletes domain definition (`is_active = false`). |
| **Seams** | `GET` | `/admin/config/seams` | `[Admin]` | — | — (R: `seam_definitions`) | Lists seam definitions ordered by `sortOrder`. |
| | `POST` | `/admin/config/seams` | `[Admin]` | — | `seam_definitions` | Creates a relationally linked seam definition (`code`, `domainCode1`, `domainCode2`, `name`). Enforces `(domainCode1, domainCode2)` unique constraint. |
| | `PUT` | `/admin/config/seams/{id}` | `[Admin]` | Not found → 404 | `seam_definitions` | Updates seam definition attributes or active status. |
| | `DELETE` | `/admin/config/seams/{id}` | `[Admin]` | Not found → 404 | `seam_definitions` | Soft-deletes seam definition (`is_active = false`). |
| **Archetypes** | `GET` | `/admin/config/archetypes` | `[Admin]` | — | — (R: `archetype_definitions`) | Lists archetype definitions ordered by `sortOrder`. |
| | `POST` | `/admin/config/archetypes` | `[Admin]` | — | `archetype_definitions` | Creates an archetype definition. |
| | `PUT` | `/admin/config/archetypes/{id}` | `[Admin]` | Not found → 404 | `archetype_definitions` | Updates archetype attributes or active status. |
| | `DELETE` | `/admin/config/archetypes/{id}` | `[Admin]` | Not found → 404 | `archetype_definitions` | Soft-deletes archetype definition (`is_active = false`). |
| **Probe Questions** | `GET` | `/admin/config/probe-questions` | `[Admin]` | — | — (R: `probe_questions`) | Lists probe questions, filterable by `?archetypeCode=...`. |
| | `POST` | `/admin/config/probe-questions` | `[Admin]` | — | `probe_questions` | Creates a probe question for an archetype. |
| | `PUT` | `/admin/config/probe-questions/{id}` | `[Admin]` | Not found → 404 | `probe_questions` | Updates probe question text, display order, or active status. |
| | `DELETE` | `/admin/config/probe-questions/{id}` | `[Admin]` | Not found → 404 | `probe_questions` | Soft-deletes probe question (`is_active = false`). |
| **Void Codes** | `GET` | `/admin/config/void-codes` | `[Admin]` | — | — (R: `void_code_definitions`) | Lists void code definitions ordered by `sortOrder`. |
| | `POST` | `/admin/config/void-codes` | `[Admin]` | — | `void_code_definitions` | Creates a void code definition (`code`, `name`, `description`, `severity`). |
| | `PUT` | `/admin/config/void-codes/{id}` | `[Admin]` | Not found → 404 | `void_code_definitions` | Updates void code definition attributes or severity. |
| | `DELETE` | `/admin/config/void-codes/{id}` | `[Admin]` | Not found → 404 | `void_code_definitions` | Soft-deletes void code definition (`is_active = false`). |
| **Prompt Templates** | `GET` | `/admin/prompts` | `[Admin]` | — | — (R: `prompt_templates`) | Lists all DB-stored prompt templates with stage, version, and update timestamps. |
| | `GET` | `/admin/prompts/{stage}` | `[Admin]` | Template missing → 404 | — (R: `prompt_templates`) | Returns full Jinja2 template text for a specific stage. |
| | `PUT` | `/admin/prompts/{stage}` | `[Admin]` | — | `prompt_templates` | Upserts prompt template in DB and increments version number. FastAPI TTL cache propagates update within 60 seconds. |
| | `DELETE` | `/admin/prompts/{stage}` | `[Admin]` | — | `prompt_templates` | Deletes DB prompt template override. System falls back to reading the default on-disk `.txt` prompt file. |

---

### Y. Internal S2S & FastAPI Engine Endpoints (13 Endpoints)

> Internal endpoints run between NestJS and FastAPI or internal subsystems. They are **never** exposed publicly to the frontend. Secured by `x-internal-token`.

| Method | Path | Host | Purpose | Key Payload Fields | Key Response Fields | Side-Effects |
|---|---|---|---|---|---|---|
| `GET` | `/internal/prompts/{stage}` | NestJS | Served to FastAPI to fetch DB prompt template overrides | Header: `x-internal-token` | `{ stage, templateText, version }` | If 404, FastAPI falls back to reading on-disk `.txt` file. |
| `GET` | `/health` | FastAPI | Microservice health check | — | `{ status: "ok", service: "aitasker-llm" }` | None |
| `POST` | `/llm/elicitation/stage1-extract` | FastAPI | Stage 1 symptom & void extraction | `{ symptom_text, archetypes, void_codes }` | `{ symptoms, scale_signals, voids, recommended_archetypes, critical_artifacts_required }` | NestJS persists extracted voids and artifacts to session. |
| `POST` | `/llm/elicitation/stage3-vagueness-check` | FastAPI | Stage 3 probe answer vagueness/relevancy evaluation | `{ archetype, probe_questions, probe_responses, is_self_technical, stage1_symptoms, stage1_voids }` | `{ vague_answers, irrelevant_answers }` | Returns warnings to CEO. Fails open on LLM service error. |
| `POST` | `/llm/elicitation/stage4-recommend` | FastAPI | Generates technical context recommendations | `{ stage1_symptoms, stage2_archetype, stage3_probes, void_list_json, estimated_budget_vnd }` | `{ recommended_stack, recommended_integration, recommended_legacy_volume }` | Pre-fills Stage 4 technical context form. |
| `POST` | `/llm/elicitation/stage5-synthesize` | FastAPI | Stage 5 project specification synthesis | `{ session_id, stage1-4 inputs, void_list_json, critical_artifacts_required, domains, seams, archetypes }` | `{ required_seams_json, required_domains_json, milestone_framework_json, artifact_a_json, artifact_b_json, completeness_score, flagged_void }` | NestJS evaluates quality gate and creates `projects` row on pass. |
| `POST` | `/llm/elicitation/milestone-chat` | FastAPI | Context-aware milestone chat assistant | `{ artifact_a, milestone_framework, budget_context, terms_locked, conversation_history, user_message }` | `{ reply, suggested_edit }` | NestJS stores updated conversation history array in DB. |
| `POST` | `/llm/portfolio-eval` | FastAPI | Tier 2 expert seam portfolio evaluation | `{ project_description, decision_points, seam_code, seam_name, seam_description, all_seam_definitions }` | `{ confidence_score, passed_boolean, gap_advisory }` | NestJS upgrades seam tier to `EVIDENCE_BACKED` if score ≥ 0.85 and passed. |
| `POST` | `/llm/matching` | FastAPI | Scores & ranks experts against project footprint | `{ required_seams_json, required_domains_json, expert_profiles, project_archetype }` | `[{ expert_id, composite_score, strength_label, gap_map }]` | NestJS persists shortlist in `project_shortlist_cache`. |
| `POST` | `/llm/dispute-eval` | FastAPI | Layer 1 AI dispute arbitration | `{ criterion_text, deliverable_description, files, project_archetype, milestone_context, prior_revision_count }` | `{ confidence_score, finding, reasoning }` | If confidence ≥ 0.80, NestJS executes auto-resolution ledger settlement. |
| `POST` | `/llm/criterion-check` | FastAPI | Checks acceptance criterion for subjective wording | `{ criterion_text, archetype_name, milestone_context }` | `{ is_subjective, suggestions, severity, context_note }` | If subjective, NestJS logs advisory note in `platform_decisions`. |
| `POST` | `/llm/service-generate` | FastAPI | AI-assisted expert service listing generation | `{ expert_capabilities, target_use_cases, claimed_domains, claimed_seams, price_guidance, is_pro_expert }` | `{ title, description, scope, timeline, suggested_price_vnd, suggested_domains, suggested_seams, pricing_rationale }` | Pre-fills draft service creation modal for expert review. |
| `GET` | `/projects/{project_id}/artifact-b` | FastAPI | Evaluates 4-condition security gate for Artifact B access | Query: `engagement_state, bid_state, expert_nda_accepted, ceo_nda_accepted` | `{ project_id, artifact_b_accessible: true }` (or 403 Forbidden) | NestJS validates before serving technical specifications. |

---

### Z. Socket.io Real-Time Event Gateway (Non-HTTP)

> Handled via NestJS `MessagesGateway` (`messages.gateway.ts`). Real-time events push updates to authenticated connected sockets and optionally persist system notifications to the database.

| Event Name | Direction | Room Key | Payload | Trigger / System Effect |
|---|---|---|---|---|
| `joinRoom` | Client → Server | — | `{ engagementId?, projectId? }` | Client joins an engagement or project socket channel. Validates party membership before allowing room join. |
| `sendMessage` | Client → Server | `engagementId` / `projectId` | `{ engagement_id?, project_id?, content, attachment_url? }` | Emits new message to room and recipient personal channel. Saves row in `messages`. |
| `sendMessageWorkspace` | Client → Server | `engagementId` / `projectId` | `{ engagement_id?, project_id?, content, attachment_url? }` | Emits workspace message to room and all associated parties (including linked Tech Team members). Saves row in `messages`. |
| `inviteExpert` | Client → Server | `projectId` | `{ projectId, expertId, content? }` | CEO invites expert to bid. Creates or resets row in `invitations` (`status = 'PENDING'`), creates project chat message, and emits `notification:generic` to expert. |
| `newMessage` | Server → Client | Room / `userId` | `MessageDto` | Broadcasts newly sent message in real time to room members and recipient personal socket room. |
| `notification:generic` | Server → Client | `userId` | `{ type, title, body, link }` | Pushes generic system alert to user personal room and persists notification row in **`notifications`** table. |
| `payment:confirmed` | Server → Client | `userId` | `{ engagement_id, milestone_id, milestone_number, amount_vnd }` | Emitted when SePay IPN confirms milestone payment. Triggers FE UI state refresh. |
| `milestone:updated` | Server → Client | `userId` | `{ engagement_id, milestone_id, milestone_number, state, link }` | Emitted on milestone state transitions (funding, submission, revision request, approval). |
| `bid:updated` | Server → Client | `userId` | `{ engagement_id, state }` | Emitted on bid state updates (tech review pass, counter offer, selection). |
| `project:updated` | Server → Client | `userId` | `{ project_id, project_name }` | Emitted when CEO renames a project. Syncs project title across active Tech Team views. |
| `dispute:filed` | Server → Client | `userId` | `{ engagement_id }` | Emitted to non-filing party when a dispute is filed and escrow is frozen. |
| `dispute:resolved` | Server → Client | `userId` | `{ engagement_id, dispute_id, milestone_id, resolution }` | Emitted to both client and expert when a dispute is resolved (AI or Admin). |
| `wallet:balance-updated` | Server → Client | `userId` | `{ available_balance, locked_balance, transaction_type, amount }` | Emitted to user when wallet top-up IPN is processed. |