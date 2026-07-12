# AITasker — 22 Main Flows (40 Tables · 213 Endpoints)
### Cross-Table CRUD Grounding · State Machines · Endpoint Mapping

> **Purpose:** Definitive flow reference grounded against the live 40-table schema, running `backend/src/` code, and `ai-service/` as of 2026-07-11. Every step traces to a real controller, service method, DTO, or DB transaction.
>
> **Conventions:**
> - `[LEDGER]` = `wallet_transactions` row written (immutable)
> - `[AI]` = FastAPI LLM call (not internal NestJS logic)
> - `[IPN]` = SePay webhook received by NestJS
> - **Bold table name** = first occurrence
> - `[Pro-C]` / `[Pro-E]` = Client Pro / Expert Pro subscription gate (`SubscriptionGuard`)
> - `[NEW]` = did not exist in the previous 28-table spec
> - Seam codes use Unicode ↔ (U+2194) — `A<->C` format is rejected by DTO validation

---

## Flow Index

| MF | Title | Group | Actor |
|---|---|---|---|
| MF-1 | CEO Registration, Auth & Subscription | Onboarding | CEO |
| MF-2 | Expert Registration & Taxonomy Profile | Onboarding | Expert |
| MF-3 | Tech Team Handoff Registration | Onboarding | TECH_TEAM |
| MF-4 | AI Elicitation Engine (5-Stage) | Path A | CEO + TECH_TEAM |
| MF-5 | Expert Invitations & Bid Submission | Path A | CEO + Expert |
| MF-6 | Bid Review, Counter-Offer & NDA Connection | Path A | CEO + TECH_TEAM + Expert |
| MF-7 | Milestone Lifecycle (Create→Fund→Deliver→Approve) | Path A | All |
| MF-8 | Dispute Filing, Evidence & LLM Resolution | Path A | All |
| MF-9 | Post-Engagement Review & Closure | Path A | All |
| MF-10 | Service-Based Engagement Purchase (Path B) | Path B | CEO + Expert |
| MF-11 | Tech Discovery Engagement (Path C) | Path C | CEO + Expert |
| MF-12 | Seam Tier 2 Portfolio Verification | Expert | Expert |
| MF-13 | Earnings, Withdrawal & Bank Linking | Expert | Expert |
| MF-14 | Messaging & Notifications | All | All |
| MF-15 | Milestone Chat Assistant | Path A | CEO |
| MF-16 | Password Recovery & Account Security | Auth | Any User |
| MF-17 | Admin CMS — Config Management | Admin | Admin |
| MF-18 | Admin Prompt Template Hot-Reload | Admin | Admin |
| MF-19 | Admin Subscription Package Management | Admin | Admin |
| MF-20 | Admin Dispute Manual Resolution | Admin | Admin |
| MF-21 | Admin User & Project Management | Admin | Admin |
| MF-22 | Config Bootstrap & Reference Data | System | FE App |

---

## Group 1 — Onboarding & Account Setup

---

# MF-1: CEO Registration, Auth & Subscription

## Overview

Registers a CLIENT/CEO account; tops up wallet; activates Client Pro subscription using dynamic package from `subscription_packages` table (not hardcoded price). Includes logout with server-side token invalidation via `refresh_token_hash`.

**Tables touched (8):** `users`, `client_profiles`, `wallets`, `virtual_accounts`, `wallet_transactions`, `subscription_packages`, `subscription_purchase_logs`, `notifications`

**Key changes from old doc:** (1) `POST /subscriptions/activate` now requires `packageId` from `GET /config/subscription-packages` — hardcoded 500,000 VND is gone. (2) `subscription_purchase_logs` row written on activation. (3) `users.refresh_token_hash` cleared on logout. (4) Email is normalized (lowercased + trimmed) before storage. (5) Password errors return ALL failures simultaneously as array, not a single string.

**Endpoints:** `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /wallets/virtual-accounts/topup`, `POST /webhooks/sepay/ipn`, `GET /config/subscription-packages`, `POST /subscriptions/activate`, `GET /subscriptions/status`, `GET /subscriptions/history`, `GET /wallets/me`

---

## ASCII Swimlane

```
┌──────────────────────────────┬─────────────────────────────────────────────┬────────────────────────────┐
│       CLIENT / CEO           │         SYSTEM (NestJS)                     │      SePay / Bank          │
├──────────────────────────────┼─────────────────────────────────────────────┼────────────────────────────┤
│ ══════ PHASE A: REGISTER ═══ │                                             │                            │
│ [1] Fills /register form:    │                                             │                            │
│   email, password, fullName  │                                             │                            │
│   roles:"CLIENT_CEO"         │                                             │                            │
│        └────────────────────>│                                             │                            │
│                              │ [2] POST /auth/register                     │                            │
│                              │   Normalize: email.toLowerCase().trim()     │                            │
│                              │   Validate password (ALL rules at once):    │                            │
│                              │     ≥8 chars, uppercase, lowercase,         │                            │
│                              │     number, special char                    │                            │
│                              │   IF any fail → 400 message:[array]         │                            │
│                              │     ← FE shows checklist, not single error  │                            │
│                              │   Validate email domain: MX check           │                            │
│                              │   Validate not disposable domain            │                            │
│                              │   DB TX (atomic):                           │                            │
│                              │     INSERT users {                          │                            │
│                              │       email (normalized),                   │                            │
│                              │       password_hash (bcrypt),               │                            │
│                              │       roles:["CLIENT_CEO"],                 │                            │
│                              │       active_role:"CLIENT",                 │                            │
│                              │       client_subtype:"CEO",                 │                            │
│                              │       subscription_client_tier:"free",      │                            │
│                              │       refresh_token_hash: NULL [NEW]        │                            │
│                              │     }                                       │                            │
│                              │     INSERT client_profiles {user_id}        │                            │
│                              │     INSERT wallets {available:0, locked:0}  │                            │
│                              │     INSERT virtual_accounts {               │                            │
│                              │       entity_type:"WALLET_TOPUP",           │                            │
│                              │       va_number: generateVaNumber(),        │                            │
│                              │       fixed_amount:NULL, expires_at:NULL,   │                            │
│                              │       status:"ACTIVE" }                     │                            │
│                              │   COMMIT                                    │                            │
│                              │   Sign JWT access_token (7d) +              │                            │
│                              │     refresh_token (7d)                      │                            │
│                              │   Hash refresh_token → SHA-256              │                            │
│                              │   UPDATE users SET                          │                            │
│                              │     refresh_token_hash = hash [NEW]         │                            │
│                              │   Return {access_token,refresh_token,user}  │                            │
│ <────────────────────────────┤                                             │                            │
│ [3] CEO Dashboard (free)     │                                             │                            │
│   Elicitation → 403 [Pro-C]  │                                             │                            │
│                              │                                             │                            │
├──────────────────────────────┼─────────────────────────────────────────────┼────────────────────────────┤
│ ═══ PHASE B: WALLET TOP-UP ══│                                             │                            │
│ [4] Clicks "Top Up Wallet"   │                                             │                            │
│        └────────────────────>│                                             │                            │
│                              │ [5] POST /wallets/virtual-accounts/topup    │                            │
│                              │   SELECT virtual_accounts WHERE             │                            │
│                              │     entity_id=userId AND                    │                            │
│                              │     entity_type='WALLET_TOPUP' AND          │                            │
│                              │     status='ACTIVE'                         │                            │
│                              │   Build VietQR URL:                         │                            │
│                              │     qr.sepay.vn/img?bank=MB&acc={vaNum}     │                            │
│                              │   Return {qrCodeUrl, paymentReference}      │                            │
│ <────────────────────────────┤                                             │                            │
│ [6] Scans QR; transfers VND  │                                             │                            │
│                              │                                             │ [7] Bank processes         │
│                              │ ┌───────────────────────────────────────────┤ [8] SePay IPN fires        │
│                              │ [9] POST /webhooks/sepay/ipn                │   → NestJS                 │
│                              │   a. Verify HMAC (x-sepay-signature,5min)   │                            │
│                              │   b. Parse va_number from content           │                            │
│                              │   c. SELECT virtual_accounts → WALLET_TOPUP │                            │
│                              │   d. Idempotency check:                     │                            │
│                              │      SELECT wallet_transactions             │                            │
│                              │        WHERE reference_id=transferRef       │                            │
│                              │      IF found → 200, skip (no double credit)│                            │
│                              │   e. DB TX (atomic):                        │                            │
│                              │      UPDATE wallets                         │                            │
│                              │        SET available_balance += amount      │                            │
│                              │      INSERT wallet_transactions {           │                            │
│                              │        type:"TOP_UP", amount,               │                            │
│                              │        reference_id:transferRef}            │                            │
│                              │      COMMIT                                 │                            │
│                              │   f. Return 200 {success:true}              │                            │
│ [10] GET /wallets/me         │                                             │                            │
│      → balance updated       │                                             │                            │
│                              │                                             │                            │
├──────────────────────────────┼─────────────────────────────────────────────┼────────────────────────────┤
│ ═══ PHASE C: SUBSCRIPTION ═══│                                             │                            │
│ [11] Opens Subscription page │                                             │                            │
│        └────────────────────>│                                             │                            │
│                              │ [12] GET /config/subscription-packages      │                            │
│                              │   ?role=CLIENT [NEW — was hardcoded before] │                            │
│                              │   SELECT subscription_packages WHERE        │                            │
│                              │     role='CLIENT' AND is_active=true        │                            │
│                              │   Return [{id, name, priceVnd:"500000",     │                            │
│                              │     durationMonths:6}]                      │                            │
│ <────────────────────────────┤                                             │                            │
│ [13] FE stores packageId     │                                             │                            │
│   Clicks "Activate Client Pro"│                                            │                            │
│        └────────────────────>│                                             │                            │
│                              │ [14] POST /subscriptions/activate           │                            │
│                              │   {activeRole:"CLIENT",packageId} [NEW]     │                            │
│                              │   ← packageId now REQUIRED (breaking change)│                            │
│                              │   Guard 1: package.role ≠ CLIENT → 422      │                            │
│                              │   Guard 2: package.is_active=false → 422    │                            │
│                              │   Guard 3: sub_client_tier='pro' AND        │                            │
│                              │     !expired → 409 ALREADY_SUBSCRIBED       │                            │
│                              │   Guard 4: available < package.priceVnd     │                            │
│                              │     → 422 INSUFFICIENT_BALANCE              │                            │
│                              │   DB TX (atomic):                           │                            │
│                              │     UPDATE wallets                          │                            │
│                              │       SET available_balance -= 500000       │                            │
│                              │     INSERT wallet_transactions {            │                            │
│                              │       type:"SUBSCRIPTION",amount:500000,    │                            │
│                              │       reference:"SUB-{uid}:CLIENT:{pkgId}"} │                            │
│                              │     UPDATE users SET                        │                            │
│                              │       subscription_client_tier="pro",       │                            │
│                              │       sub_client_expires_at=now()+6mo       │                            │
│                              │     INSERT subscription_purchase_logs {     │                            │
│                              │       user_id, package_id, role,            │                            │
│                              │       amount_paid_vnd, expires_at           │                            │
│                              │     } [NEW TABLE]                           │                            │
│                              │     COMMIT                                  │                            │
│                              │   Reissue JWT with updated tier claims      │                            │
│                              │   Return {access_token,activatedPackage}    │                            │
│ <────────────────────────────┤                                             │                            │
│ [15] GET /subscriptions/status│                                            │                            │
│   → {subscriptionTier:"pro", │                                             │                            │
│      subscriptionExpires,    │                                             │                            │
│      isExpired:false}        │                                             │                            │
│   ← Trust tier from API;     │                                             │                            │
│     DO NOT do FE date math   │                                             │                            │
│                              │                                             │                            │
├──────────────────────────────┼─────────────────────────────────────────────┼────────────────────────────┤
│ ═══ PHASE D: LOGOUT [NEW] ═══│                                             │                            │
│ [16] Clicks logout           │                                             │                            │
│        └────────────────────>│                                             │                            │
│                              │ [17] POST /auth/logout [NEW]                │                            │
│                              │   UPDATE users SET                          │                            │
│                              │     refresh_token_hash = NULL               │                            │
│                              │   Return {success:true}                     │                            │
│ <────────────────────────────┤                                             │                            │
│ [18] FE clears tokens        │                                             │                            │
│   Redirect to /login         │                                             │                            │
│   Future refresh calls →     │                                             │                            │
│   401 "Token invalidated"    │                                             │                            │
└──────────────────────────────┴─────────────────────────────────────────────┴────────────────────────────┘
```

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 2 | NestJS | Register; normalize email; validate password array | `users` (C), `client_profiles` (C), `wallets` (C), `virtual_accounts` (C) | New user, free tier | `POST /auth/register` |
| 5 | NestJS | Return VietQR URL for permanent WALLET_TOPUP VA | `virtual_accounts` (R) | — | `POST /wallets/virtual-accounts/topup` |
| 9 | SePay→NestJS | IPN handler: idempotency check, credit wallet | `wallets` (U), `wallet_transactions` (C) | balance += amount | `POST /webhooks/sepay/ipn` |
| 12 | NestJS | Return live package list from DB | `subscription_packages` (R) | — | `GET /config/subscription-packages` |
| 14 | NestJS | Activate subscription: deduct, write log, reissue JWT | `wallets` (U), `wallet_transactions` (C), `users` (U), `subscription_purchase_logs` (C) | tier=pro | `POST /subscriptions/activate` |
| 17 | NestJS | Clear refresh_token_hash → invalidate all sessions | `users` (U) | refresh_token_hash=NULL | `POST /auth/logout` |

---

# MF-2: Expert Registration & Taxonomy Profile

## Overview

Registers an EXPERT account, builds domain depth and seam claim profile using live codes from `domain_definitions` and `seam_definitions` tables. All domain codes and seam codes are dynamic strings from the DB — no hardcoded enums. Seam codes use `↔` arrow character (Unicode U+2194). `A<->C` format is rejected by DTO validation.

**Tables touched (7):** `users`, `expert_profiles`, `wallets`, `virtual_accounts`, `expert_domain_depths`, `expert_seam_claims`, `subscription_purchase_logs`

**Key changes from old doc:** (1) Domain codes from `domain_definitions` table — not hardcoded A–F enum. (2) Seam codes from `seam_definitions` table — `↔` arrow, NOT `A<->C`. (3) `GET /expert-profile/me/domains` and `GET /expert-profile/me/seams` endpoints added. (4) `DELETE /expert-profile/domains/:id` added.

**Endpoints:** `POST /auth/register`, `PUT /expert-profile/me`, `GET /config/domains`, `GET /config/seams`, `POST /expert-profile/domains`, `PUT /expert-profile/domains/sync`, `PUT /expert-profile/domains/:id`, `DELETE /expert-profile/domains/:id`, `GET /expert-profile/me/domains`, `POST /expert-profile/seams`, `PUT /expert-profile/seams/sync`, `GET /expert-profile/me/seams`, `GET /expert-profile/me`, `GET /config/subscription-packages`, `POST /subscriptions/activate`

---

## ASCII Swimlane

```
┌──────────────────────────────────┬────────────────────────────────────────┐
│           EXPERT                 │        SYSTEM (NestJS)                 │
├──────────────────────────────────┼────────────────────────────────────────┤
│ ══ PHASE A: REGISTRATION ═══════ │                                        │
│ [1] POST /auth/register          │                                        │
│   {email,password,               │                                        │
│    fullName,roles:"EXPERT"}      │                                        │
│        └────────────────────────>│                                        │
│                                  │ [2] Same validation as MF-1 Step 2     │
│                                  │   DB TX:                               │
│                                  │     INSERT users {                     │
│                                  │       roles:["EXPERT"],                │
│                                  │       active_role:"EXPERT",            │
│                                  │       subscription_expert_tier:"free"  │
│                                  │     }                                  │
│                                  │     INSERT expert_profiles {user_id}   │
│                                  │     INSERT wallets {0,0}               │
│                                  │     INSERT virtual_accounts {TOPUP}    │
│                                  │   Return {access_token,refresh_token}  │
│ <────────────────────────────────┤                                        │
│                                  │                                        │
├──────────────────────────────────┼────────────────────────────────────────┤
│ ══ PHASE B: BUILD PROFILE ══════ │                                        │
│ [3] Update bio and model         │                                        │
│   PUT /users/me {fullName,bio}   │                                        │
│   PUT /expert-profile/me {       │                                        │
│     engagementModel:"MILESTONE", │                                        │
│     stackTagsJson:["Python",..], │                                        │
│     archetypeHistoryJson:[..]    │                                        │
│   }                              │                                        │
│        └────────────────────────>│ [4] UPDATE expert_profiles             │
│                                  │   (note: bio is on users, not          │
│                                  │   expert_profiles)                     │
│                                  │                                        │
├──────────────────────────────────┼────────────────────────────────────────┤
│ ══ PHASE C: DOMAIN DEPTHS ══════ │                                        │
│ [5] Fetch live domain list       │                                        │
│   GET /config/domains [NEW]      │                                        │
│        └────────────────────────>│                                        │
│                                  │ [6] SELECT domain_definitions WHERE    │
│                                  │     is_active=true ORDER BY sort_order │
│                                  │   Return [{code:"A",name:"LLM App      │
│                                  │     Engineering"},{code:"B",...}]      │
│                                  │   ← Codes are ANY string admin creates │
│                                  │   ← NOT hardcoded A-F enum             │
│ <────────────────────────────────┤                                        │
│ [7] Expert picks domains         │                                        │
│   POST /expert-profile/domains   │                                        │
│     {domainCode:"A",             │                                        │
│      depthLevel:"DEEP"}          │                                        │
│   (or bulk sync:)                │                                        │
│   PUT /expert-profile/domains/   │                                        │
│     sync {domains:[              │                                        │
│       {code:"A",depth:"DEEP"},   │                                        │
│       {code:"C",depth:"OPERATIONAL"}│                                     │
│     ]}                           │                                        │
│        └────────────────────────>│                                        │
│                                  │ [8] UPSERT expert_domain_depths        │
│                                  │   {expert_id, domain_code, depth_level,│
│                                  │    verification_tier:"CLAIMED"}        │
│                                  │   UNIQUE(expert_id, domain_code)       │
│                                  │                                        │
│ [9] GET /expert-profile/me/      │                                        │
│     domains [NEW]                │                                        │
│        └────────────────────────>│ [10] SELECT expert_domain_depths       │
│                                  │      WHERE expert_id=userId            │
│ <────────────────────────────────┤                                        │
│                                  │                                        │
├──────────────────────────────────┼────────────────────────────────────────┤
│ ══ PHASE D: SEAM CLAIMS ════════ │                                        │
│ [11] Fetch live seam list        │                                        │
│   GET /config/seams [NEW]        │                                        │
│        └────────────────────────>│                                        │
│                                  │ [12] SELECT seam_definitions WHERE     │
│                                  │      is_active=true ORDER BY sort_order│
│                                  │   Return [{code:"A↔C",                 │
│                                  │     name:"LLM output quality"},...]    │
│                                  │   ← Code uses ↔ (U+2194) arrow         │
│                                  │   ← NEVER "A<->C" (DTO rejects)        │
│ <────────────────────────────────┤                                        │
│ [13] POST /expert-profile/seams  │                                        │
│   {seamCode:"A↔C"}               │                                        │
│   ← MUST use ↔ arrow             │                                        │
│        └────────────────────────>│                                        │
│                                  │ [14] INSERT expert_seam_claims {       │
│                                  │   expert_id, seam_code:"A↔C",          │
│                                  │   verification_tier:"CLAIMED",         │
│                                  │   submission_count:0 }                 │
│                                  │   UNIQUE(expert_id, seam_code)         │
│                                  │                                        │
│ [15] GET /expert-profile/me/     │                                        │
│      seams [NEW]                 │                                        │
│        └────────────────────────>│ [16] SELECT expert_seam_claims         │
│                                  │      WHERE expert_id=userId            │
│ <────────────────────────────────┤                                        │
│                                  │                                        │
├──────────────────────────────────┼────────────────────────────────────────┤
│ ══ PHASE E: EXPERT PRO ═════════ │                                        │
│ [17] GET /config/subscription-   │                                        │
│      packages?role=EXPERT [NEW]  │                                        │
│        └────────────────────────>│ [18] SELECT subscription_packages      │
│                                  │      WHERE role='EXPERT',is_active=true│
│ <────────────────────────────────┤      Return [{id,priceVnd,duration}]   │
│ [19] POST /subscriptions/activate│                                        │
│   {activeRole:"EXPERT",          │                                        │
│    packageId:"<id>"} ← REQUIRED  │                                        │
│        └────────────────────────>│ [20] Same guard+TX flow as MF-1 Step 14│
│                                  │   subscription_expert_tier="pro"       │
│                                  │   INSERT subscription_purchase_logs    │
│ <────────────────────────────────┤   Return {access_token,activatedPkg}   │
└──────────────────────────────────┴────────────────────────────────────────┘
```

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 2 | NestJS | Register expert | `users` (C), `expert_profiles` (C), `wallets` (C), `virtual_accounts` (C) | Expert account created | `POST /auth/register` |
| 4 | NestJS | Update expert profile | `expert_profiles` (U), `users` (U - bio) | — | `PUT /expert-profile/me`, `PUT /users/me` |
| 6 | NestJS | Return live domain codes | `domain_definitions` (R) | — | `GET /config/domains` |
| 8 | NestJS | Upsert domain depths | `expert_domain_depths` (C/U) | verification_tier=CLAIMED | `POST /expert-profile/domains`, `PUT /expert-profile/domains/sync` |
| 12 | NestJS | Return live seam codes with ↔ arrows | `seam_definitions` (R) | — | `GET /config/seams` |
| 14 | NestJS | Insert seam claim (↔ format required) | `expert_seam_claims` (C) | CLAIMED | `POST /expert-profile/seams` |
| 20 | NestJS | Activate Expert Pro | `wallets` (U), `wallet_transactions` (C), `users` (U), `subscription_purchase_logs` (C) | tier=pro | `POST /subscriptions/activate` |

---

# MF-3: Tech Team Handoff Registration

## Overview

CEO generates a 72-hour signed JWT handoff link during Stage 4 of elicitation. TECH_TEAM registers via this link and is scoped to the CEO's session. **Critical bug fix:** `tech_team_profiles.linked_project_id` is now set immediately if the project is already published — the old doc showed it was always NULL at registration.

**Tables touched (5):** `users`, `tech_team_profiles`, `wallets`, `virtual_accounts`, `elicitation_sessions`

**Key changes from old doc:** (1) `linked_project_id` set atomically on registration/claim if project already exists. (2) `POST /auth/claim-handoff` for existing users (was not documented). (3) TECH_TEAM sees project immediately in `GET /projects` after linking — "Waiting for CEO" bug resolved.

**Endpoints:** `POST /elicitation/sessions/:id/generate-handoff-link`, `POST /auth/register/handoff`, `POST /auth/claim-handoff` (existing user), `GET /projects`

---

## ASCII Swimlane

```
┌──────────────────────────┬───────────────────────────────────────┬──────────────────────────────┐
│       CLIENT / CEO       │        SYSTEM (NestJS)                │    CLIENT / TECH_TEAM        │
├──────────────────────────┼───────────────────────────────────────┼──────────────────────────────┤
│ [1] During elicitation   │                                       │                              │
│   Stage 4 delegation:    │                                       │                              │
│   POST /elicitation/     │                                       │                              │
│     sessions/:id/        │                                       │                              │
│     generate-handoff-link│                                       │                              │
│        └────────────────>│                                       │                              │
│                          │ [2] Assert CEO owns session           │                              │
│                          │   Sign JWT {                          │                              │
│                          │     sessionId, ceoId,                 │                              │
│                          │     purpose:"tech-team-handoff",      │                              │
│                          │     jti: uuid(),                      │                              │
│                          │     exp: now()+72h }                  │                              │
│                          │   UPDATE elicitation_sessions SET     │                              │
│                          │     handoff_token_jti = jti           │                              │
│                          │   Return {invite_link,invite_token,   │                              │
│                          │     expires_in:"72h"}                 │                              │
│ <────────────────────────┤                                       │                              │
│ [3] CEO copies link →    │                                       │                              │
│   shares via Slack/email │                                       │                              │
│   (no platform email)    │                                       │                              │
│                          │                                       │ [4] Opens link               │
│                          │                                       │   /register/handoff/:token   │
│                          │                                       │   Sees registration form     │
│                          │                                       │ [5] Fills email,password,    │
│                          │                                       │   fullName,invite_token      │
│                          │                  ┌────────────────────                               │
│                          │ [6] POST /auth/register/handoff       │                              │
│                          │   Validate JWT: sig + expiry +        │                              │
│                          │     purpose="tech-team-handoff"       │                              │
│                          │   Check jti = session.handoff_        │                              │
│                          │     token_jti (match required)        │                              │
│                          │   Check handoff_consumed_at = NULL    │                              │
│                          │     (single-use — resending link      │                              │
│                          │      invalidates first)               │                              │
│                          │   Check email unique                  │                              │
│                          │   Check if project already published: │                              │
│                          │     SELECT projects WHERE             │                              │
│                          │       elicitation_session_id=?        │                              │
│                          │                                       │                              │
│                          │   DB TX (atomic):                     │                              │
│                          │     INSERT users {                    │                              │
│                          │       roles:["CLIENT_CEO"],           │                              │
│                          │       active_role:"CLIENT",           │                              │
│                          │       client_subtype:"TECH_TEAM"      │                              │
│                          │     }                                 │                              │
│                          │     INSERT tech_team_profiles {       │                              │
│                          │       linked_client_id: ceoId,        │                              │
│                          │       linked_project_id:              │                              │
│                          │         project.id IF published       │                              │
│                          │         ELSE NULL [BUG FIX]           │                              │
│                          │     }                                 │                              │
│                          │     INSERT wallets {0,0}              │                              │
│                          │     INSERT virtual_accounts {TOPUP}   │                              │
│                          │     UPDATE elicitation_sessions SET   │                              │
│                          │       handoff_consumed_at = now()     │                              │
│                          │     COMMIT                            │                              │
│                          │   Return {access_token,refresh_token} │                              │
│                          │                  └────────────────────>                              │
│                          │                                       │ [7] Tech Dashboard loads     │
│                          │                                       │   GET /projects              │
│                          │                                       │   → project visible          │
│                          │                                       │     immediately if published │
│                          │                                       │   "Waiting for CEO" ONLY if  │
│                          │                                       │   GET /projects returns []   │
│                          │                                       │   [BUG FIX — was always      │
│                          │                                       │   "Waiting for CEO" before]  │
├──────────────────────────┼───────────────────────────────────────┼──────────────────────────────┤
│ ══ EXISTING USER VARIANT ═══════════════════════════════════════════════════════════════════════│
│                          │                                       │ [8] Already has an account   │
│                          │                                       │   POST /auth/claim-handoff   │
│                          │                                       │     {invite_token}           │
│                          │                  ┌────────────────────                               │
│                          │ [9] Same JWT validation as Step 6     │                              │
│                          │   UPDATE tech_team_profiles SET       │                              │
│                          │     linked_client_id = ceoId          │                              │
│                          │     linked_project_id = project.id    │                              │
│                          │       IF published [BUG FIX]          │                              │
│                          │   UPDATE elicitation_sessions SET     │                              │
│                          │     handoff_consumed_at = now()       │                              │
│                          │   Return {message, access_token}      │                              │
│                          │                  └────────────────────>                              │
│                          │                                       │ [10] Project visible in dash │
└──────────────────────────┴───────────────────────────────────────┴──────────────────────────────┘
```

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 2 | CEO→NestJS | Generate handoff JWT; store jti | `elicitation_sessions` (U - jti) | — | `POST /elicitation/sessions/:id/generate-handoff-link` |
| 6 | TECH_TEAM→NestJS | Register; validate JWT; link to CEO | `users` (C), `tech_team_profiles` (C - linked_project_id set if published), `wallets` (C), `virtual_accounts` (C), `elicitation_sessions` (U - consumed_at) | New TECH_TEAM user | `POST /auth/register/handoff` |
| 9 | TECH_TEAM→NestJS | Claim for existing user | `tech_team_profiles` (U), `elicitation_sessions` (U) | linked_project_id set | `POST /auth/claim-handoff` |

**Critical notes:** `roles:["CLIENT_CEO"]` because TECH_TEAM is a subtype of CLIENT. `linked_project_id` set immediately if project is PUBLISHED; set later by `handleGatePassed()` if project is still being synthesized. Sending new handoff link invalidates old one (jti overwritten → `handoff_token_jti` mismatch on old link).

---

## Group 2 — Path A: Project Elicitation & Publication

---

# MF-4: AI Elicitation Engine (5-Stage)

## Overview

Transforms CEO free-text symptom description into a published project spec via 5 diagnostic stages. All configuration (archetypes, probe questions, void codes, domains, seams) is fetched from DB tables at call time — nothing is hardcoded in the AI service. Prompts are fetched from `prompt_templates` table with 60-second TTL cache and `.txt` file fallback. Stage 4 includes critical artifact submission. Stage 5 synthesis produces cost/duration estimates per milestone.

**Tables touched (10):** `elicitation_sessions`, `archetype_definitions`, `void_code_definitions`, `probe_questions`, `projects`, `platform_decisions`, `tech_team_profiles`, `domain_definitions`, `seam_definitions`, `prompt_templates`

**Key changes from old doc:** (1) Stage 1: LLM skip if unchanged input; `stage1_original_input` persisted; `estimated_budget_vnd` extracted; `critical_artifacts_json` detected. (2) Stage 2: archetype list from `archetype_definitions` DB — NOT hardcoded; void descriptions from `void_code_definitions`. (3) Stage 3: probe questions from `probe_questions` table — NOT hardcoded; dual check adds `irrelevant_answers` array; vagueness no longer blocks (advisory only). (4) Stage 4: `stage4-draft` auto-save endpoint; `technical_artifacts` dict for critical content; `missingArtifacts` warning response. (5) Stage 5: `estimated_total_cost_vnd` + `estimated_total_duration_days` in response.

**Endpoints:** `POST /elicitation/sessions`, `GET /elicitation/sessions/active`, `GET /elicitation/sessions`, `GET /elicitation/sessions/:id`, `PATCH /elicitation/sessions/:id/draft`, `PUT /elicitation/sessions/:id/stage1`, `GET /config/archetypes`, `GET /config/void-codes`, `PUT /elicitation/sessions/:id/stage2`, `GET /config/archetypes/:code/probe-questions`, `PUT /elicitation/sessions/:id/stage3`, `PATCH /elicitation/sessions/:id/stage4-draft` (NEW), `PUT /elicitation/sessions/:id/stage4`, `PUT /elicitation/sessions/:id/stage4-handoff`, `PUT /elicitation/sessions/:id/self-technical`, `POST /elicitation/sessions/:id/stage4-recommend`, `POST /elicitation/sessions/:id/stage5`, `PUT /elicitation/sessions/:id/revert`, `PUT /elicitation/sessions/:id/continue`, `PUT /elicitation/sessions/:id/abandon`, `DELETE /elicitation/sessions/:id`, `POST /elicitation/sessions/:id/retry-synthesis`, `GET /matching/:projectId/shortlist`

---

## ASCII Swimlane

```
┌──────────────────────────┬──────────────────────────────────────────────┬──────────────────────────┐
│      CLIENT / CEO        │       SYSTEM (NestJS + FastAPI)              │   CLIENT / TECH_TEAM     │
├──────────────────────────┼──────────────────────────────────────────────┼──────────────────────────┤
│ ══ SESSION START ══════  │                                              │                          │
│ [1] Clicks "New Project" │                                              │                          │
│   Sub guard: [Pro-C]     │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [2] Check for active session:                │                          │
│                          │   GET /elicitation/sessions/active           │                          │
│                          │   IF exists → return session (resume)        │                          │
│                          │   IF none → POST /elicitation/sessions:      │                          │
│                          │     INSERT elicitation_sessions {            │                          │
│                          │       user_id, current_stage:1,              │                          │
│                          │       state:"IN_PROGRESS",                   │                          │
│                          │       void_list_json:"[]" }                  │                          │
│ <────────────────────────┤                                              │                          │
│                          │                                              │                          │
├──────────────────────────┼──────────────────────────────────────────────┼──────────────────────────┤
│ ══ STAGE 1: SYMPTOMS ══  │                                              │                          │
│ [3] Types symptom text   │                                              │                          │
│   Auto-save draft:       │                                              │                          │
│   PATCH .../draft        │                                              │                          │
│   {symptomTextDraft:"..."│                                              │                          │
│   } (every 30s, no LLM)  │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [4] UPDATE elicitation_sessions SET          │                          │
│                          │     symptom_text_draft = draft               │                          │
│                          │   Return {saved:true} (no LLM call)          │                          │
│ <────────────────────────┤                                              │                          │
│ [5] Submits final text   │                                              │                          │
│   PUT .../stage1         │                                              │                          │
│   {symptomText:"We need  │                                              │                          │
│    an AdTech compliance  │                                              │                          │
│    pipeline based on our │                                              │                          │
│    compliance ruleset.   │                                              │                          │
│    Budget ~200M VND"}    │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [6] LLM skip check:                          │                          │
│                          │   IF symptomText === stage1_original_input   │                          │
│                          │     → return cached result (no AI call)      │                          │
│                          │                                              │                          │
│                          │ [7] Fetch live config for prompt injection:  │                          │
│                          │   SELECT archetype_definitions WHERE active  │                          │
│                          │   SELECT void_code_definitions WHERE active  │                          │
│                          │   ← injected as Jinja2 vars into prompt      │                          │
│                          │   ← prompt fetched from prompt_templates     │                          │
│                          │     table (60s TTL, .txt fallback) [NEW]     │                          │
│                          │                                              │                          │
│                          │ [8] [AI] FastAPI stage1_extract:             │                          │
│                          │   Injects {{archetypes}} {{void_codes}}      │                          │
│                          │   Returns {                                  │                          │
│                          │     symptoms:[...],                          │                          │
│                          │     scale_signals:{budget_vnd:200000000,...},│                          │
│                          │     voids:[{void_code,severity}],            │                          │
│                          │     recommended_archetypes:["3","1"],        │                          │
│                          │     critical_artifacts_required: [NEW]       │                          │
│                          │       [{artifact_key:"compliance_ruleset",   │                          │
│                          │         label:"Compliance Ruleset",          │                          │
│                          │         reason:"Ruleset defines acceptance   │                          │
│                          │           criteria for all milestones",      │                          │
│                          │         placeholder_prompt:"Paste your       │                          │
│                          │           compliance rules here"}]           │                          │
│                          │   }                                          │                          │
│                          │                                              │                          │
│                          │ [9] UPDATE elicitation_sessions SET          │                          │
│                          │     stage1_original_input = symptomText [NEW]│                          │
│                          │     stage1_symptoms_json = symptoms          │                          │
│                          │     void_list_json = voids                   │                          │
│                          │     recommended_archetypes_json = [...]      │                          │
│                          │     estimated_budget_vnd = 200000000 [NEW]   │                          │
│                          │     critical_artifacts_json = [...] [NEW]    │                          │
│                          │     current_stage = 2                        │                          │
│ <────────────────────────┤                                              │                          │
│ [10] FE shows diff:      │                                              │                          │
│   "What you wrote" vs    │                                              │                          │
│   "What AI extracted"    │                                              │                          │
│   IF critical_artifacts  │                                              │                          │
│     non-empty: show      │                                              │                          │
│     PERSISTENT BANNER:   │                                              │                          │
│   "Submit these docs in  │                                              │                          │
│    Stage 4 for accurate  │                                              │                          │
│    project scope"        │                                              │                          │
│   Voids cross-ref:       │                                              │                          │
│   GET /config/void-codes │                                              │                          │
│   → descriptions for     │                                              │                          │
│     display to CEO       │                                              │                          │
│                          │                                              │                          │
├──────────────────────────┼──────────────────────────────────────────────┼──────────────────────────┤
│ ══ STAGE 2: ARCHETYPE ══ │                                              │                          │
│ [11] Fetch archetype list│                                              │                          │
│   GET /config/archetypes │                                              │                          │
│   [NOT HARDCODED — live] │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [12] SELECT archetype_definitions            │                          │
│                          │   WHERE is_active=true ORDER sort_order      │                          │
│                          │   Return [{code:"1",name:"RAG/Search",...}]  │                          │
│ <────────────────────────┤                                              │                          │
│ [13] CEO reads void list │                                              │                          │
│   GET /config/void-codes │                                              │                          │
│   → names+descriptions   │                                              │                          │
│   CEO must acknowledge   │                                              │                          │
│   ALL detected voids     │                                              │                          │
│   Selects archetype "3"  │                                              │                          │
│   (AI recommended)       │                                              │                          │
│   PUT .../stage2         │                                              │                          │
│   {archetype:"3",        │                                              │                          │
│    acknowledgedVoidCodes: │                                             │                          │
│    ["MISSING_TECHNICAL_  │                                              │                          │
│     ARTIFACT","NO_GROUND_│                                              │                          │
│     TRUTH"]}             │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [14] Validate archetype code exists in       │                          │
│                          │   archetype_definitions [NEW — was in        │                          │
│                          │   recommended set check only]                │                          │
│                          │   UPDATE elicitation_sessions SET            │                          │
│                          │     archetype = "3" (locked - immutable)     │                          │
│                          │     current_stage = 3                        │                          │
│ <────────────────────────┤                                              │                          │
│                          │                                              │                          │
├──────────────────────────┼──────────────────────────────────────────────┼──────────────────────────┤
│ ══ STAGE 3: PROBE Q's ══ │                                              │                          │
│ [15] Fetch probe questions│                                             │                          │
│   GET /config/archetypes/│                                              │                          │
│     3/probe-questions    │                                              │                          │
│   [NOT HARDCODED — live] │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [16] SELECT probe_questions WHERE            │                          │
│                          │   archetype_code="3" AND is_active=true      │                          │
│                          │   ORDER BY display_order                     │                          │
│                          │   Return [{questionText:"How many items      │                          │
│                          │     need classifying per day?"},...] [NEW]   │                          │
│ <────────────────────────┤                                              │                          │
│ [17] CEO answers all     │                                              │                          │
│   questions (required)   │                                              │                          │
│   PUT .../stage3         │                                              │                          │
│   {probe_responses:{     │                                              │                          │
│     "How many items per  │                                              │                          │
│      day?": "50,000",    │                                              │                          │
│     "What happens on low │                                              │                          │
│      confidence?":"Route │                                              │                          │
│      to human reviewer"  │                                              │                          │
│   }}                     │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [17] [AI] FastAPI stage3_vagueness_check:    │                          │
│                          │   Passes: archetype, questions, responses,   │                          │
│                          │   stage1_symptoms [NEW], stage1_voids [NEW]  │                          │
│                          │   ← context enables RELEVANCY check          │                          │
│                          │   DUAL CHECK [NEW]:                          │                          │
│                          │   a. Vagueness check (existing):             │                          │
│                          │      vague_answers:[{question,reason}]       │                          │
│                          │   b. Relevancy check [NEW]:                  │                          │
│                          │      irrelevant_answers:[{question,issue}]   │                          │
│                          │      ← checks if answer addresses actual     │                          │
│                          │        project context, not just vague/not   │                          │
│                          │                                              │                          │
│                          │ [18] BOTH checks are ADVISORY ONLY [NEW]:    │                          │
│                          │   (old: vague → 422, CEO must re-answer)     │                          │
│                          │   (new: both advisory, always advances)      │                          │
│                          │   UPDATE elicitation_sessions SET            │                          │
│                          │     stage3_probes_json = {q:a pairs}         │                          │
│                          │     current_stage = 4                        │                          │
│                          │   Return {                                   │                          │
│                          │     currentStage:4,                          │                          │
│                          │     vaguenessResult:{                        │                          │
│                          │       vague_answers:[...],                   │                          │
│                          │       irrelevant_answers:[...] [NEW]         │                          │
│                          │     }                                        │                          │
│                          │   }                                          │                          │
│ <────────────────────────┤                                              │                          │
│ [19] FE shows:           │                                              │                          │
│   vague_answers →        │                                              │                          │
│     "Please be specific" │                                              │                          │
│   irrelevant_answers →   │                                              │                          │
│     "Off-topic answer"   │                                              │                          │
│   [SEPARATE sections]    │                                              │                          │
│   CEO proceeds anyway    │                                              │                          │
│                          │                                              │                          │
├──────────────────────────┼──────────────────────────────────────────────┼──────────────────────────┤
│ ══ STAGE 4: TECH CONTEXT ══════════════════════════════════════════════════════════════════════    │
│                          │                                              │                          │
│ BRANCH A: CEO fills form │                                              │                          │
│  [20a] PUT .../self-     │                                              │                          │
│   technical {self:true}  │                                              │                          │
│  Auto-save draft:        │                                              │                          │
│  PATCH .../stage4-draft  │                                              │                          │
│  {draftJson:{stack,...}} │                                              │                          │
│  (every 30s, no LLM)     │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [21a] UPDATE elicitation_sessions SET        │                          │
│                          │   stage4_draft_json = draftJson [NEW]        │                          │
│                          │   Return {saved:true}                        │                          │
│ <────────────────────────┤                                              │                          │
│  Optional AI suggest:    │                                              │                          │
│  POST .../stage4-recommend│                                             │                          │
│       └────────────────> │                                              │                          │
│                          │ [22a] [AI] FastAPI stage4_recommend:         │                          │
│                          │   Passes: symptoms, archetype, probes,       │                          │
│                          │   voids, additional_req, budget [UPDATED]    │                          │
│                          │   Returns pre-filled stack/integration/volume│                          │
│ <────────────────────────┤                                              │                          │
│  CEO submits Stage 4:    │                                              │                          │
│  PUT .../stage4          │                                              │                          │
│  {current_stack:         │                                              │                          │
│    "Python FastAPI+PG",  │                                              │                          │
│   data_available:        │                                              │                          │
│    "50k assets/day CSV", │                                              │                          │
│   latency_requirement:   │                                              │                          │
│    "Under 2s at P95",    │                                              │                          │
│   additional_requirement │                                              │                          │
│    _1: "GDPR compliant", │                                              │                          │
│   technical_artifacts: { │                                              │                          │
│     compliance_ruleset:  │                                              │                          │
│      "Rule 1: No         │                                              │                          │
│       misleading health  │                                              │                          │
│       claims.\nRule 2:   │                                              │                          │
│       Financial products │                                              │                          │
│       must show APR."    │                                              │                          │
│   }} [NEW — critical     │                                              │                          │
│      artifact content]   │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [23a] Compute missingArtifacts:              │                          │
│                          │   criticalArtifacts = session.               │                          │
│                          │     critical_artifacts_json                  │                          │
│                          │   submittedKeys = Object.keys(               │                          │
│                          │     dto.technical_artifacts)                 │                          │
│                          │   missingArtifacts = criticalArtifacts       │                          │
│                          │     .filter(a => !submittedKeys              │                          │
│                          │       .includes(a.artifact_key))             │                          │
│                          │                                              │                          │
│                          │   UPDATE elicitation_sessions SET            │                          │
│                          │     stage4_tech_inputs_json = {              │                          │
│                          │       current_stack,data_available,          │                          │
│                          │       latency_requirement,                   │                          │
│                          │       additional_requirement_1,              │                          │
│                          │       technical_artifacts:{...}              │                          │
│                          │     }                                        │                          │
│                          │     current_stage = 5                        │                          │
│                          │   Return {session,missingArtifacts:[]}       │                          │
│ <────────────────────────┤                                              │                          │
│ [24a] If missingArtifacts│                                              │                          │
│   non-empty → show modal:│                                              │                          │
│   "Incomplete spec —     │                                              │                          │
│    proceed anyway?"      │                                              │                          │
│   NOT a hard block       │                                              │                          │
│   CEO may proceed        │                                              │                          │
│                          │                                              │                          │
│ BRANCH B: Delegate to    │                                              │                          │
│   Tech Team (MF-3)       │                                              │ [20b] TECH_TEAM          │
│   CEO shares link (MF-3) │                                              │   fills Stage 4 form     │
│   CEO polls GET /:id     │                                              │   (same fields + tech_   │
│   until currentStage≥5   │                                              │   artifacts) via:        │
│                          │                                              │   PATCH .../stage4-draft │
│                          │                                              │   PUT .../stage4-handoff │
│                          │                  ┌────────────────────────── │                          │
│                          │ [21b] Same TX as 23a but via stage4-handoff  │                          │
│                          │   Validates client_subtype='TECH_TEAM'       │                          │
│                          │                                              │                          │
├──────────────────────────┼──────────────────────────────────────────────┼──────────────────────────┤
│ ══ STAGE 5: SYNTHESIS ══ │                                              │                          │
│ [25] POST .../stage5     │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [26] Fetch live config for prompt injection: │                          │
│                          │   SELECT domain_definitions WHERE active     │                          │
│                          │   SELECT seam_definitions WHERE active       │                          │
│                          │   SELECT archetype_definitions WHERE active  │                          │
│                          │   Fetch prompt from prompt_templates table   │                          │
│                          │     (GET /internal/prompts/stage5_synthesize)│                          │
│                          │     60s TTL, .txt fallback [NEW]             │                          │
│                          │                                              │                          │
│                          │ [27] [AI] FastAPI stage5_synthesize:         │                          │
│                          │   Injects {{domains}}{{seams}}{{archetypes}} │                          │
│                          │   (all from DB — not hardcoded) [NEW]        │                          │
│                          │   Injects technical_artifacts content        │                          │
│                          │     into prompt for grounded synthesis [NEW] │                          │
│                          │   IF missingArtifacts:                       │                          │
│                          │     completeness_score capped at 0.60 [NEW]  │                          │
│                          │     sdlc_notices include missing artifact warn│                         │
│                          │   Returns {                                  │                          │
│                          │     required_seams_json,                     │                          │
│                          │     required_domains_json,                   │                          │
│                          │     milestone_framework_json:[{              │                          │
│                          │       milestone_number,                      │                          │
│                          │       deliverable_statement,                 │                          │
│                          │         ← references actual ruleset content  │                          │
│                          │       estimated_cost_vnd [NEW],              │                          │
│                          │       estimated_duration_days [NEW]          │                          │
│                          │     }],                                      │                          │
│                          │     artifact_a_json, artifact_b_json,        │                          │
│                          │     completeness_score,                      │                          │
│                          │     estimated_total_cost_vnd [NEW],          │                          │
│                          │     estimated_total_duration_days [NEW]      │                          │
│                          │   }                                          │                          │
│                          │                                              │                          │
│                          │ [28] Quality gate (3 checks):                │                          │
│                          │   a. completeness_score ≥ 0.70               │                          │
│                          │   b. Matching pre-check: ≥1 expert above     │                          │
│                          │      threshold for required seams/domains    │                          │
│                          │   c. No unresolved hard voids                │                          │
│                          │                                              │                          │
│                          │ IF ALL PASS:                                 │                          │
│                          │ [29] DB TX (atomic):                         │                          │
│                          │   INSERT projects {                          │                          │
│                          │     client_id, state:"PUBLISHED",            │                          │
│                          │     archetype:"3", tier,                     │                          │
│                          │     required_seams_json,                     │                          │
│                          │     required_domains_json,                   │                          │
│                          │     milestone_framework_json,                │                          │
│                          │     artifact_a_json, artifact_b_json,        │                          │
│                          │     estimated_total_cost_vnd [NEW],          │                          │
│                          │     estimated_total_duration_days [NEW]      │                          │
│                          │   }                                          │                          │
│                          │   UPDATE elicitation_sessions SET            │                          │
│                          │     state:"COMPLETED"                        │                          │
│                          │   UPDATE tech_team_profiles SET              │                          │
│                          │     linked_project_id = project.id [BUG FIX] │                          │
│                          │     ← was always NULL in old doc             │                          │
│                          │   INSERT platform_decisions {                │                          │
│                          │     type:"ELICITATION_SYNTHESIS",            │                          │
│                          │     entity_id:project.id }                   │                          │
│                          │   COMMIT                                     │                          │
│                          │   Fire matching engine async                 │                          │
│                          │   → INSERT project_shortlist_cache           │                          │
│                          │                                              │                          │
│                          │ IF ANY FAIL:                                 │                          │
│                          │ [30] UPDATE elicitation_sessions SET         │                          │
│                          │     state:"RETURNED"                         │                          │
│                          │   INSERT platform_decisions {                │                          │
│                          │     type:"SPEC_AUTO_RETURN",                 │                          │
│                          │     advisory_note:"[specific void reason]"   │                          │
│                          │   }                                          │                          │
│                          │   CEO re-enters at specific stage via:       │                          │
│                          │   PUT .../revert {targetStage:N}             │                          │
│                          │   NOT from Stage 1                           │                          │
│ <────────────────────────┤                                              │                          │
│ [31] View published:     │                                              │                          │
│   GET /projects/:id      │                                              │                          │
│     → required_domains_json [NEW]│                                      │                          │
│     → required_seams_json [NEW]  │                                      │                          │
│     → milestone_framework_json   │                                      │                          │
│     → estimatedTotalCostVnd [NEW]│                                      │                          │
│     → estimatedTotalDuration [NEW]│                                     │                          │
│   GET /matching/:id/shortlist    │                                      │                          │
│     → 3-5 match cards            │                                      │                          │
└──────────────────────────┴──────────────────────────────────────────────┴──────────────────────────┘
```

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 2 | NestJS | Create or resume session | `elicitation_sessions` (C) | state=IN_PROGRESS | `POST /elicitation/sessions` |
| 4 | NestJS | Save Stage 1 symptom draft (no LLM) | `elicitation_sessions` (U — draft) | — | `PATCH .../draft` |
| 7-8 | NestJS→FastAPI | Fetch live config; call Stage 1 LLM | `archetype_definitions` (R), `void_code_definitions` (R), `prompt_templates` (R) | — | FastAPI internal |
| 9 | NestJS | Persist Stage 1 outputs including critical_artifacts_json | `elicitation_sessions` (U) | stage=2 | `PUT .../stage1` |
| 12 | NestJS | Return live archetype list | `archetype_definitions` (R) | — | `GET /config/archetypes` |
| 14 | NestJS | Lock archetype; advance stage | `elicitation_sessions` (U) | stage=3 | `PUT .../stage2` |
| 16 | NestJS | Return live probe questions | `probe_questions` (R) | — | `GET /config/archetypes/:code/probe-questions` |
| 17-18 | NestJS→FastAPI | Dual check (vagueness+relevancy); advance stage | `elicitation_sessions` (U) | stage=4; both checks advisory | `PUT .../stage3` |
| 21a | NestJS | Save Stage 4 draft (no LLM, no stage advance) | `elicitation_sessions` (U — stage4_draft_json) | — | `PATCH .../stage4-draft` |
| 23a | NestJS | Compute missingArtifacts; save tech inputs | `elicitation_sessions` (U) | stage=5 | `PUT .../stage4` |
| 26-27 | NestJS→FastAPI | Fetch live config; run Stage 5 synthesis | `domain_definitions` (R), `seam_definitions` (R), `archetype_definitions` (R), `prompt_templates` (R) | — | FastAPI internal |
| 29 | NestJS | Create project; link TECH_TEAM; fire matching | `projects` (C), `elicitation_sessions` (U), `tech_team_profiles` (U), `platform_decisions` (C), `project_shortlist_cache` (C) | PUBLISHED | `POST .../stage5` |

---

## Group 3 — Invitations, Bidding & Connection

---

# MF-5: Expert Invitations & Bid Submission

## Overview

CEO invites experts directly (new feature) before or after viewing the shortlist. Expert receives persistent notification, views invitation with project requirements, can decline or proceed to bid. Bid submission now uses dynamic domain/seam codes (DB-driven, `↔` arrow format). Expert bid notification now fires to BOTH CEO and ALL TECH_TEAM members (A-3 bug fix). Invitation is auto-accepted when expert submits a bid.

**Tables touched (8):** `invitations`, `notifications`, `project_shortlist_cache`, `expert_domain_depths`, `expert_seam_claims`, `engagements`, `capability_bids`, `messages`

**Key changes from old doc:** (1) `invitations` table is new. (2) `notifications` table persists WebSocket events. (3) Bid domain/seam codes are DB-driven strings — NOT hardcoded enums. (4) `A<->C` seam format rejected by DTO — must use `↔`. (5) `invitation.ceo.clientProfile.companyName` included in invitation response. (6) ALL TECH_TEAM members notified on bid, not just CEO.

**Endpoints:** `GET /matching/:projectId/shortlist`, `GET /expert-profile/search`, `GET /expert-profile/:userId`, `GET /invitations` (Expert), `GET /invitations/sent` (CEO), `POST /invitations/:id/decline`, `DELETE /invitations/:id` (CEO retract), `GET /projects/:id`, `GET /projects/:id/invitations`, `GET /notifications/me`, `GET /notifications/me/unread-count`, `PUT /notifications/:id/read`, `POST /bids`, `GET /bids`, `DELETE /bids/:id`

---

## ASCII Swimlane

```
┌──────────────────────────┬──────────────────────────────────────────┬────────────────────────────┐
│      CLIENT / CEO        │       SYSTEM (NestJS)                    │         EXPERT             │
├──────────────────────────┼──────────────────────────────────────────┼────────────────────────────┤
│ ══ PHASE A: CEO INVITES ═════════════════════════════════════════════════════════════════════════│
│ [1] Views shortlist      │                                          │                            │
│   GET /matching/:id/     │                                          │                            │
│   shortlist              │                                          │                            │
│       └────────────────> │                                          │                            │
│                          │ [2] SELECT project_shortlist_cache       │                            │
│                          │   Return [{expert_id, strength_label,    │                            │
│                          │     gap_map:{seamCode:color}, ...}]      │                            │
│ <────────────────────────┤                                          │                            │
│ [3] CEO invites expert   │                                          │                            │
│   WebSocket: inviteExpert│                                          │                            │
│   {projectId,expertId,   │                                          │                            │
│    content:"I think your │                                          │                            │
│    RAG experience fits"} │                                          │                            │
│       └────────────────> │                                          │                            │
│                          │ [4] Validate CEO owns project            │                            │
│                          │   UPSERT invitations {                   │                            │
│                          │     project_id, expert_id, ceo_id,       │                            │
│                          │     message, status:"PENDING",           │                            │
│                          │     expires_at: now()+7days              │                            │
│                          │   } ← upsert: re-invite resets to PENDING│                            │
│                          │                                          │                            │
│                          │   Emit socket notification to expert:    │                            │
│                          │   notification:generic {                 │                            │
│                          │     type:"system",                       │                            │
│                          │     title:"Project Invitation",          │                            │
│                          │     link:"/expert/invitations" }         │                            │
│                          │                                          │                            │
│                          │   INSERT notifications {                 │                            │
│                          │     user_id: expert_id,                  │                            │
│                          │     type:"system",                       │                            │
│                          │     title:"Project Invitation",          │                            │
│                          │     link:"/expert/invitations",          │                            │
│                          │     is_read:false                        │                            │
│                          │   } [NEW — persists for page refresh]    │                            │
│                          │   INSERT messages (project chat)         │                            │
│                          ├──────────────────────────────────────────>                            │
│ [5] CEO views invitations│                                          │ [6] Expert receives        │
│   GET /invitations/sent  │                                          │   real-time notification   │
│   GET /projects/:id/     │                                          │   badge updated:           │
│   invitations            │                                          │   GET /notifications/me/   │
│                          │                                          │   unread-count → N+1       │
│                          │                                          │                            │
│ ══ PHASE B: EXPERT VIEWS INVITATIONS ══════════════════════════════════════════════════════════│
│                          │                                          │ [7] Opens invitations page │
│                          │                                          │   GET /invitations         │
│                          │                  ┌─────────────────────── │                           │
│                          │ [8] SELECT invitations WHERE             │                            │
│                          │   expert_id=userId JOIN project,ceo      │                            │
│                          │   ceo JOIN clientProfile (companyName)   │                            │
│                          │   Return [{                              │                            │
│                          │     id, status:"PENDING",                │                            │
│                          │     invitedAt, isExpired:false,          │                            │
│                          │     project:{id,projectName,state,       │                            │
│                          │       requiredDomainsJson, [NEW]         │                            │
│                          │       requiredSeamsJson}, [NEW]          │                            │
│                          │     ceo:{id,fullName,                    │                            │
│                          │       clientProfile:{companyName}} [NEW] │                            │
│                          │   }]                                     │                            │
│                          ├──────────────────────────────────────────>                            │
│                          │                                          │ [9] Expert sees:           │
│                          │                                          │   "AITasker Corp invites   │
│                          │                                          │   you to AdTech Pipeline"  │
│                          │                                          │   Shows requiredSeams,     │
│                          │                                          │   requiredDomains inline   │
│                          │                                          │   Status badge:            │
│                          │                                          │   PENDING+!expired → CTA   │
│                          │                                          │   PENDING+expired → grey   │
│                          │                                          │   ACCEPTED → "Bid Sent"    │
│                          │                                          │   DECLINED → "Declined"    │
│                          │                                          │                            │
│                          │                                          │ [10] Expert declines:      │
│                          │                                          │   POST /invitations/:id/   │
│                          │                                          │   decline                  │
│                          │                  ┌───────────────────────│                            │
│                          │ [11] Guard: status=PENDING               │                            │
│                          │   UPDATE invitations SET                 │                            │
│                          │     status:"DECLINED",                   │                            │
│                          │     responded_at:now()                   │                            │
│                          ├──────────────────────────────────────────>                            │
│                          │                                          │ [12] OR Expert proceeds    │
│                          │                                          │   to view project detail   │
│                          │                                          │   GET /projects/:id        │
│                          │                                          │   → required_domains_json  │
│                          │                                          │   → required_seams_json    │
│                          │                                          │   → milestone_framework    │
│                          │                                          │   [ALL IN ONE CALL — NEW]  │
│                          │                                          │                            │
├──────────────────────────┼──────────────────────────────────────────┼────────────────────────────┤
│ ══ PHASE C: BID SUBMISSION ════════════════════════════════════════════════════════════════════  │
│                          │                                          │ [13] Expert submits bid    │
│                          │                                          │   POST /bids {             │
│                          │                                          │     projectId:"uuid",      │
│                          │                                          │     footprint_alignment_   │
│                          │                                          │     json:{                 │
│                          │                                          │       domains:[{           │
│                          │                                          │         code:"A",  ← ANY   │
│                          │                                          │         depth:"DEEP"       │
│                          │                                          │       }],                  │
│                          │                                          │       seams:[{             │
│                          │                                          │         code:"A↔C", ← ↔    │
│                          │                                          │         ← NOT "A<->C"!!    │
│                          │                                          │         tier:"CLAIMED"     │
│                          │                                          │       }]                   │
│                          │                                          │     },                     │
│                          │                                          │     approach_summary:"...",│
│                          │                                          │     conditional_pricing_   │
│                          │                                          │     json:[{                │
│                          │                                          │       milestone_number:1,  │
│                          │                                          │       price_vnd:15000000,  │
│                          │                                          │       condition:"Delivery" │
│                          │                                          │     }]                     │
│                          │                                          │   }                        │
│                          │                  ┌───────────────────────│                            │
│                          │ [14] Validate: all 3 components present  │                            │
│                          │   domain/seam codes validated against    │                            │
│                          │   DB in service layer [NEW]              │                            │
│                          │   DB TX (atomic):                        │                            │
│                          │   INSERT engagements {                   │                            │
│                          │     project_id, expert_id,               │                            │
│                          │     type:"PROJECT_BASED",                │                            │
│                          │     state:"PENDING"                      │                            │
│                          │   }                                      │                            │
│                          │   INSERT capability_bids {               │                            │
│                          │     engagement_id,                       │                            │
│                          │     footprint_alignment_json,            │                            │
│                          │     approach_summary,                    │                            │
│                          │     conditional_pricing_json,            │                            │
│                          │     state:"SUBMITTED",                   │                            │
│                          │     tech_status:"PENDING",               │                            │
│                          │     ceo_status:"PENDING",                │                            │
│                          │     version_number:1                     │                            │
│                          │   }                                      │                            │
│                          │   UPSERT invitations SET                 │                            │
│                          │     status:"ACCEPTED",                   │                            │
│                          │     responded_at:now()                   │                            │
│                          │   ← auto-accept invitation [NEW]         │                            │
│                          │   COMMIT                                 │                            │
│                          │                                          │                            │
│                          │ [15] Emit + persist notifications:       │                            │
│                          │   → CEO: notification:generic {          │                            │
│                          │       type:"bid_update",                 │                            │
│                          │       title:"New Expert Bid!",           │                            │
│                          │       link:"/ceo/projects/:id"           │                            │
│                          │     }                                    │                            │
│                          │   → ALL TECH_TEAM members [BUG FIX A-3]: │                            │
│                          │     notification:generic {               │                            │
│                          │       type:"bid_update",                 │                            │
│                          │       title:"New Bid Awaiting Review",   │                            │
│                          │       link:"/tech-team/projects/:id"     │                            │
│                          │     }                                    │                            │
│                          │   INSERT notifications rows for EACH     │                            │
│                          │     recipient (CEO + all TECH_TEAM)      │                            │
│                          ├──────────────────────────────────────────>                            │
│ [16] CEO sees:           │                                          │ [17] Expert views own bids:│
│   GET /bids?projectId=:id│                                          │   GET /bids                │
│   → all bids, role-scoped│                                          │   → own bids, role-scoped  │
│   Badge: PENDING(grey),  │                                          │   GET /bids/:id            │
│   APPROVED(active)       │                                          │   → bid detail             │
│                          │                                          │                            │
│                          │                                          │ [18] Withdraw bid          │
│                          │                                          │  (before TECH_TEAM review):│
│                          │                                          │   DELETE /bids/:id         │
│                          │                  ┌───────────────────────│                            │
│                          │ [19] Guard: state='SUBMITTED' only       │                            │
│                          │   UPDATE capability_bids SET             │                            │
│                          │     state:"WITHDRAWN"                    │                            │
└──────────────────────────┴──────────────────────────────────────────┴────────────────────────────┘
```

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 4 | NestJS | Upsert invitation; emit + persist notification | `invitations` (C/U), `notifications` (C), `messages` (C) | status=PENDING | WebSocket `inviteExpert` |
| 8 | NestJS | Return invitations with project + CEO company name | `invitations` (R), `projects` (R), `users` (R), `client_profiles` (R) | — | `GET /invitations` |
| 11 | NestJS | Decline invitation | `invitations` (U) | status=DECLINED | `POST /invitations/:id/decline` |
| 14 | NestJS | Create engagement + bid; auto-accept invitation | `engagements` (C), `capability_bids` (C), `invitations` (U) | bid=SUBMITTED; invitation=ACCEPTED | `POST /bids` |
| 15 | NestJS | Notify CEO + ALL TECH_TEAM | `notifications` (C × N) | — | EventEmitter `socket.broadcast` |
| 19 | NestJS | Withdraw bid | `capability_bids` (U) | state=WITHDRAWN | `DELETE /bids/:id` |

---

# MF-6: Bid Review, Counter-Offer & NDA Connection

## Overview

TECH_TEAM reviews bid against actual system architecture. CEO reviews approved bid, optionally writes counter-offer, then decides to approve or decline. On approval, connection request sent to expert; both parties sign NDA click-through; engagement becomes CONNECTED and Artifact B unlocked.

**Tables touched (4):** `capability_bids`, `engagements`, `notifications`

**Endpoints:** `GET /bids/:id`, `PUT /bids/:id/tech-review`, `PUT /bids/:id`, `PUT /bids/:id/counter-offer`, `PUT /bids/:id/ceo-decision`, `PUT /engagements/:id/accept-nda`, `POST /engagements/:id/connect`, `PUT /engagements/:id/decline`, `GET /engagements/:id/bid`

---

## ASCII Swimlane

```
┌──────────────┬────────────────────────────────────┬─────────────────────────────┬─────────────────┐
│ CLIENT / CEO │    SYSTEM (NestJS)                 │  CLIENT / TECH_TEAM         │     EXPERT      │
├──────────────┼────────────────────────────────────┼─────────────────────────────┼─────────────────┤
│ ══ TECH REVIEW ══════════════════════════════════════════════════════════════════════════════─════│
│              │                                    │ [1] Notification received   │                 │
│              │                                    │   GET /notifications/me     │                 │
│              │                                    │   → "New Bid Awaiting Review│                 │
│              │                                    │   GET /bids?projectId=:id   │                 │
│              │                                    │   GET /bids/:id             │                 │
│              │                                    │   → footprint_alignment_json│                 │
│              │                                    │   → approach_summary        │                 │
│              │                                    │   → conditional_pricing_json│                 │
│              │                                    │   → version_number          │                 │
│              │                                    │                             │                 │
│              │                                    │ [2] APPROVED:               │                 │
│              │                                    │   PUT /bids/:id/tech-review │                 │
│              │                                    │   {action:"APPROVED"}       │                 │
│              │ [3] UPDATE capability_bids SET     │                             │                 │
│              │   tech_status:"APPROVED"           │                             │                 │
│              │   Notify CEO                       │                             │                 │
│              │   INSERT notifications {CEO,       │                             │                 │
│              │     "Tech review complete"}        │                             │                 │
│              │                                    │                             │                 │
│              │                                    │ [4] OR REVISION:            │                 │
│              │                                    │   PUT /bids/:id/tech-review │                 │
│              │                                    │   {action:"REVISION_        │                 │
│              │                                    │    REQUESTED",              │                 │
│              │                                    │    tech_feedback:"Add more  │                 │
│              │                                    │    detail on vector DB"}    │                 │
│              │ [5] UPDATE capability_bids SET     │                             │                 │
│              │   tech_status:"REVISION_REQUESTED" │                             │                 │
│              │   tech_feedback="{text}"           │                             │                 │
│              │   Notify expert                    │                             │                 │
│              │                                    │                             │ [6] Expert reads│
│              │                                    │                             │   notification  │
│              │                                    │                             │   PUT /bids/:id │
│              │                                    │                             │   {updated      │
│              │                                    │                             │    components}  │
│              │ [7] UPDATE capability_bids SET     │                             │                 │
│              │   tech_status:"PENDING",           │                             │                 │
│              │   version_number++                 │                             │                 │
│              │   (loop back to Step 1)            │                             │                 │
│              │                                    │                             │                 │
├──────────────┼────────────────────────────────────┼─────────────────────────────┼─────────────────┤
│ ══ CEO REVIEW & COUNTER-OFFER ═════════════════════════════════════════════════════════════════──═│
│ [8] Notified │                                    │                             │                 │
│   GET /bids? │                                    │                             │                 │
│   projectId=:│                                    │                             │                 │
│              │                                    │                             │                 │
│ [9] Optional:│                                    │                             │                 │
│   PUT /bids/:│                                    │                             │                 │
│   id/counter-│                                    │                             │                 │
│   offer      │                                    │                             │                 │
│   {negotiated│                                    │                             │                 │
│   _price_vnd:│                                    │                             │                 │
│   20000000}  │                                    │                             │                 │
│     └───────>│                                    │                             │                 │
│              │ [10] Guard: negotiated_price_vnd   │                             │                 │
│              │   IS NULL (first write only;       │                             │                 │
│              │   immutable after set)             │                             │                 │
│              │   UPDATE capability_bids SET       │                             │                 │
│              │     negotiated_price_vnd=20000000  │                             │                 │
│              │   Notify expert of counter         │                             │                 │
│              │                                    │                             │                 │
│ [11] APPROVE:│                                    │                             │                 │
│   PUT /bids/ │                                    │                             │                 │
│   :id/ceo-   │                                    │                             │                 │
│   decision   │                                    │                             │                 │
│   {decision: │                                    │                             │                 │
│   "APPROVED"}│                                    │                             │                 │
│     └───────>│                                    │                             │                 │
│              │ [12] UPDATE capability_bids SET    │                             │                 │
│              │   ceo_status:"APPROVED"            │                             │                 │
│              │   state:"SELECTED"                 │                             │                 │
│              │   All other bids for project       │                             │                 │
│              │   → state:"DECLINED"               │                             │                 │
│              │   Notify expert: "Connection       │                             │                 │
│              │     request sent"                  │                             │                 │
│              │                                    │                             │                 │
├──────────────┼────────────────────────────────────┼─────────────────────────────┼─────────────────┤
│ ══ NDA & CONNECTION ══════════════════════════════════════════════════════════════════════───═════│
│ [13] CEO NDA │                                    │                             │                 │
│   PUT /engage│                                    │                             │                 │
│   ments/:id/ │                                    │                             │                 │
│   accept-nda │                                    │                             │                 │
│     └───────>│                                    │                             │                 │
│              │ [14] UPDATE engagements SET        │                             │                 │
│              │   client_nda_accepted_at=now()     │                             │                 │
│              │   IF expert_nda_accepted_at IS NOT │                             │                 │
│              │   NULL → state:"CONNECTED"         │                             │                 │
│              │                                    │                             │ [15] Expert:    │
│              │                                    │                             │   POST /engage- │
│              │                                    │                             │   ments/:id/    │
│              │                                    │                             │   connect       │
│              │ [16] UPDATE engagements SET        │                             │                 │
│              │   expert_nda_accepted_at=now()     │                             │                 │
│              │   IF client_nda_accepted_at IS NOT │                             │                 │
│              │   NULL:                            │                             │                 │
│              │     state:"CONNECTED"              │                             │                 │
│              │     connected_at=now()             │                             │                 │
│              │   Artifact B route guard unlocked: │                             │                 │
│              │     engagement≥CONNECTED AND       │                             │                 │
│              │     both NDA timestamps set AND    │                             │                 │
│              │     requester = EXPERT or TECH_TEAM│                             │                 │
│              │     CEO → 403 always               │                             │                 │
│              │                                    │                             │                 │
│ [17] Engagement active:  │                        │                             │                 │
│   GET /engagements/:id/bid│                       │                             │                 │
│   → bid that created it  │                        │                             │                 │
│   GET /engagements/:id   │                        │                             │                 │
│   → project metadata     │                        │                             │                 │
│     included [NEW]       │                        │                             │                 │
└──────────────┴────────────────────────────────────┴─────────────────────────────┴─────────────────┘
```

---

# MF-7: Milestone Lifecycle (Create → Fund → Deliver → Approve)

## Overview

CEO creates milestones (with criteria) from the AI blueprint. CEO funds each milestone via IPN-triggered escrow. Expert builds DoD checklist, stages pay-gated docs, submits deliverable. Sign-off authority (CEO, TECH_TEAM, or JOINT) verifies criteria one-by-one. Escrow releases via chi hộ to expert's bank. Includes new milestone edit/delete (DEFINED state only), criteria CRUD, DoD list + delete.

**Tables touched (12):** `milestones`, `acceptance_criteria`, `milestone_dod_items`, `virtual_accounts`, `escrow_accounts`, `wallet_transactions`, `wallets`, `withdrawal_requests`, `milestone_submissions`, `paygated_documents`, `platform_decisions`, `notifications`

**Key changes from old doc:** (1) `PATCH /milestones/:id` (edit while DEFINED — new). (2) `DELETE /milestones/:id` (delete while DEFINED — new). (3) `GET /criteria/:milestoneId` (list criteria — new). (4) `POST /criteria/:milestoneId` (add criterion post-creation — new). (5) `DELETE /criteria/:id` (new). (6) `GET /milestones/:id/dod` (list DoD — new). (7) `DELETE /milestones/:id/dod/:itemId` (new). (8) `GET /milestones/:id/submissions` and `/latest` (new). (9) Milestone has new fields: `title`, `estimatedDurationDays`, `techStackJson`, `estimatedCostVnd`, `isAiGenerated`, `updatedAt`.

**Endpoints:** `POST /milestones`, `GET /milestones/:id`, `PATCH /milestones/:id`, `DELETE /milestones/:id`, `GET /milestones?engagementId=`, `PUT /milestones/:id/fund`, `GET /criteria/:milestoneId`, `POST /criteria/:milestoneId`, `PUT /criteria/:id/verify`, `PUT /criteria/:id/revision`, `DELETE /criteria/:id`, `GET /milestones/:id/dod`, `POST /milestones/:id/dod/items`, `PUT /milestones/:id/dod/:itemId`, `DELETE /milestones/:id/dod/:itemId`, `POST /milestones/:id/paygated-docs`, `GET /milestones/:id/paygated-docs`, `POST /milestones/:id/submit`, `GET /milestones/:id/submissions`, `GET /milestones/:id/submissions/latest`, `GET /engagements/:id/milestones`, `GET /engagements/:id/submissions`, `GET /milestones/:id/disputes`, `POST /webhooks/sepay/ipn`

---

## ASCII Swimlane

```
┌───────────────────────────┬────────────────────────────────────────────────┬───────────────┬──────────────┐
│      CLIENT / CEO         │        SYSTEM (NestJS)                         │    EXPERT     │ TECH_TEAM    │
├───────────────────────────┼────────────────────────────────────────────────┼───────────────┼──────────────┤
│ ══ PHASE A: CREATE MILESTONES ════════════════════════════════════════════════════════════════════════════│
│ [1] Reviews AI blueprint  │                                                │               │              │
│   GET /projects/:id       │                                                │               │              │
│   → milestone_framework_  │                                                │               │              │
│     json (AI estimates:   │                                                │               │              │
│     cost + duration)      │                                                │               │              │
│   [2] POST /milestones    │                                                │               │              │
│   {engagement_id,         │                                                │               │              │
│    milestone_number:1,    │                                                │               │              │
│    title:"Phase 1",       │                                                │               │              │
│    deliverable_statement, │                                                │               │              │
│    sign_off_authority:    │                                                │               │              │
│    "JOINT",               │                                                │               │              │
│    payment_amount_vnd:    │                                                │               │              │
│    40000000,              │                                                │               │              │
│    criteria:[{            │                                                │               │              │
│      criterion_text:"≥95% │                                                │               │              │
│        precision",        │                                                │               │              │
│      is_required:true     │                                                │               │              │
│    }]}                    │                                                │               │              │
│       └──────────────────>│                                                │               │              │
│                           │ [3] INSERT milestones {                        │               │              │
│                           │   engagement_id, milestone_number:1,           │               │              │
│                           │   title, deliverable_statement,                │               │              │
│                           │   sign_off_authority:"JOINT",                  │               │              │
│                           │   payment_amount_vnd:40000000,                 │               │              │
│                           │   state:"DEFINED",                             │               │              │
│                           │   estimated_cost_vnd (from AI blueprint),      │               │              │
│                           │   estimated_duration_days (from AI blueprint), │               │              │
│                           │   is_ai_generated:true                         │               │              │
│                           │ }                                              │               │              │
│                           │ INSERT acceptance_criteria rows                │               │              │
│ <─────────────────────────┤                                                │               │              │
│                           │                                                │               │              │
│ [4] Edit milestone [NEW]: │                                                │               │              │
│   PATCH /milestones/:id   │                                                │               │              │
│   {title:"Updated title", │                                                │               │              │
│    payment_amount_vnd:    │                                                │               │              │
│    45000000}              │                                                │               │              │
│       └──────────────────>│                                                │               │              │
│                           │ [5] Guard: state=DEFINED AND CEO owns          │               │              │
│                           │   UPDATE milestones SET {partial fields}       │               │              │
│                           │   updated_at=now()                             │               │              │
│                           │   IF state≠DEFINED → 422                       │               │              │
│ <─────────────────────────┤                                                │               │              │
│                           │                                                │               │              │
│ [6] Add criterion [NEW]:  │                                                │               │              │
│   GET /criteria/:milestoneId→ list│                                        │               │              │
│   POST /criteria/:milestoneId     │                                        │               │              │
│   {criterion_text:"Rule parser   │                                         │               │              │
│     handles 3-category ruleset", │                                         │               │              │
│    is_required:true}             │                                         │               │              │
│       └──────────────────>│                                                │               │              │
│                           │ [7] INSERT acceptance_criteria {               │               │              │
│                           │   milestone_id, criterion_text,                │               │              │
│                           │   is_required:true }                           │               │              │
│                           │                                                │               │              │
│ [8] Delete milestone [NEW]│                                                │               │              │
│   DELETE /milestones/:id  │                                                │               │              │
│   (only DEFINED state)    │                                                │               │              │
│       └──────────────────>│                                                │               │              │
│                           │ [9] Guard: state=DEFINED                       │               │              │
│                           │   DELETE milestones (cascades criteria+dod)    │               │              │
│                           │   IF state≠DEFINED → 422                       │               │              │
│                           │                                                │               │              │
├───────────────────────────┼────────────────────────────────────────────────┼───────────────┼──────────────┤
│ ══ PHASE B: FUND MILESTONE ═════════════════════════════════════════════════════════════════════════════════│
│ [10] PUT /milestones/:id/ │                                                │               │              │
│   fund                    │                                                │               │              │
│       └──────────────────>│                                                │               │              │
│                           │ [11] INSERT virtual_accounts {                 │               │              │
│                           │   entity_type:"MILESTONE",                     │               │              │
│                           │   entity_id: milestone_id,                     │               │              │
│                           │   va_number: generateVaNumber(),               │               │              │
│                           │   fixed_amount: payment_amount_vnd,            │               │              │
│                           │   expires_at: now()+24h,                       │               │              │
│                           │   status:"ACTIVE" }                            │               │              │
│                           │   UPDATE milestones SET                        │               │              │
│                           │     va_number, va_expires_at                   │               │              │
│                           │   Return {va_number,                           │               │              │
│                           │     qrCodeUrl, vaExpiresAt}                    │               │              │
│ <─────────────────────────┤                                                │               │              │
│ [12] Scans QR, pays exact │                                                │               │              │
│   40,000,000 VND          │                                                │               │              │
│                           │ [13] IPN fires: POST /webhooks/sepay/ipn       │               │              │
│                           │   Entity: MILESTONE branch                     │               │              │
│                           │   Validate: amount==va.fixed_amount            │               │              │
│                           │   Idempotency check                            │               │              │
│                           │   DB TX (atomic):                              │               │              │
│                           │     UPDATE wallets (client):                   │               │              │
│                           │       available -= 40000000                    │               │              │
│                           │       locked += 40000000                       │               │              │
│                           │     INSERT wallet_transactions                 │               │              │
│                           │       {ESCROW_LOCK} [LEDGER]                   │               │              │
│                           │     INSERT escrow_accounts {                   │               │              │
│                           │       milestone_id, amount:40000000,           │               │              │
│                           │       client_wallet_id,                        │               │              │
│                           │       expert_wallet_id,                        │               │              │
│                           │       status:"HELD", held_at:now()             │               │              │
│                           │     }                                          │               │              │
│                           │     UPDATE milestones SET                      │               │              │
│                           │       state:"FUNDED", funded_at:now()          │               │              │
│                           │       → auto-advance state:"IN_PROGRESS"       │               │              │
│                           │     IF first milestone:                        │               │              │
│                           │       UPDATE engagements SET state:"ACTIVE"    │               │              │
│                           │     UPDATE virtual_accounts SET status:"USED"  │               │              │
│                           │     UPDATE paygated_documents SET              │               │              │
│                           │       release_state:"RELEASED"                 │               │              │
│                           │       WHERE milestone_id=? AND                 │               │              │
│                           │       release_state="STAGED"                   │               │              │
│                           │     INSERT notifications {TECH_TEAM:           │               │              │
│                           │       "Pay-gated docs released"}               │               │              │
│                           │     INSERT notifications {EXPERT:              │               │              │
│                           │       "Milestone N funded — begin work"}       │               │              │
│                           │     COMMIT                                     │               │              │
│                           │   Return 200 {success:true} to SePay           │               │              │
│                           │                                                │               │              │
├───────────────────────────┼────────────────────────────────────────────────┼───────────────┼──────────────┤
│ ══ PHASE C: EXPERT DELIVERY ══════════════════════════════════════════════════════════════════════════════│
│                           │                                                │ [14] Stage    │ [14b] TECH   │
│                           │                                                │  paygated doc:│  views doc   │
│                           │                                                │  POST .../    │  inbox:      │
│                           │                                                │  paygated-docs│  GET .../    │
│                           │                                                │  {document_url│  paygated-   │
│                           │ [15] INSERT paygated_documents {               │  } (pre-fund) │  docs        │
│                           │   release_state:"STAGED",                      │               │  (RELEASED)  │
│                           │   staged_at:now() }                            │               │              │
│                           │                                                │               │              │
│                           │                                                │ [16] Create   │              │
│                           │                                                │  DoD items:   │              │
│                           │                                                │  GET .../dod  │              │
│                           │                                                │  POST .../dod/│              │
│                           │                                                │  items {desc, │              │
│                           │                                                │  is_required} │              │
│                           │ [17] INSERT milestone_dod_items {              │               │              │
│                           │   status:"PENDING",                            │               │              │
│                           │   maps_to_criterion_id(optional) }             │               │              │
│                           │                                                │               │              │
│                           │                                                │ [18] Complete │              │
│                           │                                                │  DoD:         │              │
│                           │                                                │  PUT .../dod/ │              │
│                           │                                                │  :itemId      │              │
│                           │                                                │  {status:     │              │
│                           │                                                │   "COMPLETED",│              │
│                           │                                                │   completion_ │              │
│                           │                                                │   note:"..."} │              │
│                           │ [19] UPDATE milestone_dod_items SET            │               │              │
│                           │   status:"COMPLETED", completed_at:now()       │               │              │
│                           │   DB CHECK: is_required=true AND               │               │              │
│                           │     status→NOT_APPLICABLE → 422                │               │              │
│                           │                                                │               │              │
│                           │                                                │ [20] Delete   │              │
│                           │                                                │  PENDING item:│              │
│                           │                                                │  DELETE .../  │              │
│                           │                                                │  dod/:itemId  │              │
│                           │ [21] Guard: status=PENDING                     │  [NEW]        │              │
│                           │   DELETE milestone_dod_items                   │               │              │
│                           │                                                │               │              │
│                           │                                                │ [22] Submit   │              │
│                           │                                                │  deliverable: │              │
│                           │                                                │  POST .../    │              │
│                           │                                                │  submit       │              │
│                           │                                                │  {description,│              │
│                           │                                                │   files_json} │              │
│                           │ [23] DoD gate:                                 │               │              │
│                           │   SELECT COUNT required dod_items              │               │              │
│                           │     WHERE status≠COMPLETED                     │               │              │
│                           │   IF >0 → 422 DOD_INCOMPLETE                   │               │              │
│                           │     {missing_items:[...]}                      │               │              │
│                           │   DB TX:                                       │               │              │
│                           │   INSERT milestone_submissions {               │               │              │
│                           │     milestone_id, expert_id,                   │               │              │
│                           │     description, files_json,                   │               │              │
│                           │     submitted_at:now() }                       │               │              │
│                           │   UPDATE milestones SET                        │               │              │
│                           │     state:"SUBMITTED",                         │               │              │
│                           │     submitted_at:now()                         │               │              │
│                           │   Notify sign-off authority                    │               │              │
│                           │                                                │               │              │
│                           │                                                │ [24] View     │              │
│                           │                                                │  submission   │              │
│                           │                                                │  history:     │              │
│                           │                                                │  GET .../     │              │
│                           │                                                │  submissions  │              │
│                           │                                                │  GET .../     │              │
│                           │                                                │  submissions/ │              │
│                           │                                                │  latest [NEW] │              │
│                           │                                                │               │              │
├───────────────────────────┼────────────────────────────────────────────────┼───────────────┼──────────────┤
│ ══ PHASE D: SIGN-OFF ═════════════════════════════════════════════════════════════════════════════════════│
│ [25] Notified "Milestone  │                                                │               │ [25b] TECH   │
│   N submitted for review" │                                                │               │  also        │
│   GET /milestones/:id     │                                                │               │  notified    │
│   GET .../submissions/    │                                                │               │  (if JOINT)  │
│   latest [NEW]            │                                                │               │              │
│   GET /criteria/:id       │                                                │               │              │
│                           │                                                │               │              │
│ [26] Verify criterion:    │                                                │               │ [26b] TECH   │
│   PUT /criteria/:id/verify│                                                │               │  verifies:   │
│   (for CEO or JOINT       │                                                │               │  PUT /criter-│
│    criteria)              │                                                │               │  ia/:id/     │
│       └──────────────────>│                                                │               │  verify      │
│                           │ [27] UPDATE acceptance_criteria SET            │               │              │
│                           │   verified_at=now()                            │               │              │
│                           │   revision_note=null (cleared)                 │               │              │
│                           │   CHECK all required criteria verified:        │               │              │
│                           │   SELECT COUNT(*) FROM acceptance_criteria     │               │              │
│                           │     WHERE milestone_id=? AND is_required=true  │               │              │
│                           │     AND verified_at IS NULL                    │               │              │
│                           │   IF >0 → 422 (more to verify)                 │               │              │
│                           │   IF =0 → APPROVED guard passes:               │               │              │
│                           │     CHECK no open disputes                     │               │              │
│                           │     UPDATE milestones SET                      │               │              │
│                           │       state:"APPROVED",                        │               │              │
│                           │       approved_at:now()                        │               │              │
│                           │     [LEDGER] DB TX (atomic):                   │               │              │
│                           │       UPDATE client wallet:                    │               │              │
│                           │         locked -= 40000000                     │               │              │
│                           │       UPDATE expert wallet:                    │               │              │
│                           │         available += 40000000*(1-fee_pct)      │               │              │
│                           │       UPDATE platform wallet:                  │               │              │
│                           │         available += 40000000*fee_pct          │               │              │
│                           │       INSERT wallet_transactions × 3:          │               │              │
│                           │         {ESCROW_RELEASE}                       │               │              │
│                           │         {PLATFORM_FEE}                         │               │              │
│                           │         {expert credit}                        │               │              │
│                           │       UPDATE escrow_accounts SET               │               │              │
│                           │         status:"RELEASED"                      │               │              │
│                           │     COMMIT                                     │               │              │
│                           │     Async: chi hộ API →                        │               │              │
│                           │       INSERT withdrawal_requests {PENDING}     │               │              │
│                           │       SePay credit IPN fires →                 │               │              │
│                           │       UPDATE withdrawal_requests COMPLETED     │               │              │
│                           │       UPDATE milestones SET state:"RELEASED"   │               │              │
│                           │     IF all milestones RELEASED:                │               │              │
│                           │       UPDATE engagements state:"CLOSED"        │               │              │
│                           │                                                │               │              │
│ [28] OR Reject criterion: │                                                │               │              │
│   PUT /criteria/:id/      │                                                │               │              │
│   revision {revision_note}│                                                │               │              │
│       └──────────────────>│                                                │               │              │
│                           │ [29] UPDATE acceptance_criteria SET            │               │              │
│                           │   revision_note="{text}",                      │               │              │
│                           │   verified_at=null                             │               │              │
│                           │   UPDATE milestones SET state:"IN_REVISION"    │               │              │
│                           │   Notify expert with revision_note text        │               │              │
└───────────────────────────┴────────────────────────────────────────────────┴───────────────┴──────────────┘
```

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 3 | NestJS | Create milestone + criteria | `milestones` (C), `acceptance_criteria` (C) | DEFINED | `POST /milestones` |
| 5 | NestJS | Edit milestone (DEFINED only) | `milestones` (U) | updated_at refreshed | `PATCH /milestones/:id` |
| 7 | NestJS | Add criterion post-creation | `acceptance_criteria` (C) | — | `POST /criteria/:milestoneId` |
| 9 | NestJS | Delete milestone (DEFINED only) | `milestones` (D), `acceptance_criteria` (D), `milestone_dod_items` (D) | — | `DELETE /milestones/:id` |
| 11 | NestJS | Create milestone VA (24h expiry) | `virtual_accounts` (C), `milestones` (U) | va_number set | `PUT /milestones/:id/fund` |
| 13 | SePay→NestJS | IPN MILESTONE: escrow lock, release docs, notify | `wallets` (U×2), `wallet_transactions` (C), `escrow_accounts` (C), `milestones` (U), `engagements` (U), `virtual_accounts` (U), `paygated_documents` (U), `notifications` (C×N) | FUNDED→IN_PROGRESS | `POST /webhooks/sepay/ipn` |
| 17 | NestJS | Create DoD items | `milestone_dod_items` (C) | PENDING | `POST .../dod/items` |
| 19 | NestJS | Update DoD item status | `milestone_dod_items` (U) | COMPLETED | `PUT .../dod/:itemId` |
| 21 | NestJS | Delete PENDING DoD item | `milestone_dod_items` (D) | — | `DELETE .../dod/:itemId` |
| 23 | NestJS | DoD gate; create submission; advance state | `milestone_submissions` (C), `milestones` (U), `notifications` (C) | SUBMITTED | `POST .../submit` |
| 27 | NestJS | Verify criterion; if all done → APPROVED + escrow release | `acceptance_criteria` (U), `milestones` (U), `wallets` (U×3), `wallet_transactions` (C×3), `escrow_accounts` (U), `withdrawal_requests` (C) | APPROVED→RELEASED | `PUT /criteria/:id/verify` |
| 29 | NestJS | Reject criterion; set IN_REVISION | `acceptance_criteria` (U), `milestones` (U), `notifications` (C) | IN_REVISION | `PUT /criteria/:id/revision` |

---

# MF-8: Dispute Filing, Evidence & LLM Resolution

## Overview

Any party to an engagement files a dispute against a specific acceptance criterion. Escrow frozen. FastAPI evaluates deliverable vs criterion with project context now injected (archetype, milestone context, revision count). Returns `reasoning` field (new). If `confidence ≥ 0.80` → AUTO_RESOLVED. Otherwise → MANUAL_REVIEW for admin (MF-20). Parties can submit additional evidence post-filing. Filer can withdraw before resolution.

**Tables touched (7):** `disputes`, `escrow_accounts`, `milestones`, `platform_decisions`, `wallets`, `wallet_transactions`, `notifications`

**Key changes from old doc:** (1) `POST /disputes/:id/evidence` (new — submit additional evidence). (2) `PUT /disputes/:id/withdraw` (new — retract before resolution). (3) FastAPI now receives `project_archetype`, `milestone_context`, `prior_revision_count` for better arbitration. (4) Response includes `reasoning` field explaining the finding. (5) `GET /milestones/:id/disputes` and `GET /engagements/:id/disputes` added.

**Endpoints:** `POST /disputes`, `GET /disputes/:id`, `GET /disputes`, `POST /disputes/:id/evidence`, `PUT /disputes/:id/withdraw`, `GET /milestones/:id/disputes`, `GET /engagements/:id/disputes`, `PUT /admin/disputes/:id/resolve`

---

## ASCII Swimlane

```
┌──────────────────────────┬─────────────────────────────────────────────┬──────────────────────┐
│    CEO or EXPERT (Filer) │        SYSTEM (NestJS + FastAPI)            │      ADMIN           │
├──────────────────────────┼─────────────────────────────────────────────┼──────────────────────┤
│ [1] POST /disputes {     │                                             │                      │
│   engagement_id,         │                                             │                      │
│   milestone_id,          │                                             │                      │
│   criterion_id,          │                                             │                      │
│   escrow_account_id,     │                                             │                      │
│   deliverableDescription,│                                             │                      │
│   files:[]               │                                             │                      │
│ }                        │                                             │                      │
│       └────────────────> │                                             │                      │
│                          │ [2] DB TX (atomic):                         │                      │
│                          │   INSERT disputes {                         │                      │
│                          │     state:"PENDING",                        │                      │
│                          │     filed_by:userId,                        │                      │
│                          │     filed_at:now()                          │                      │
│                          │   }                                         │                      │
│                          │   UPDATE escrow_accounts SET                │                      │
│                          │     status:"FROZEN"                         │                      │
│                          │   UPDATE milestones SET                     │                      │
│                          │     state:"DISPUTED"                        │                      │
│                          │   COMMIT                                    │                      │
│                          │                                             │                      │
│                          │ [3] [AI] FastAPI dispute_eval:              │                      │
│                          │   Passes [NEW fields]:                      │                      │
│                          │     criterion_text,                         │                      │
│                          │     deliverable_description,                │                      │
│                          │     files:[],                               │                      │
│                          │     project_archetype:"3" [NEW],            │                      │
│                          │     milestone_context:"Rule parser..." [NEW],│                     │
│                          │     prior_revision_count:1 [NEW]            │                      │
│                          │   Prompt from prompt_templates (60s TTL)    │                      │
│                          │   Returns {                                 │                      │
│                          │     confidence_score: 0.91,                 │                      │
│                          │     finding:"expert_wins",                  │                      │
│                          │     reasoning:"Deliverable explicitly       │                      │
│                          │       handles all 3 rule categories         │                      │
│                          │       stated in criterion" [NEW]            │                      │
│                          │   }                                         │                      │
│                          │   UPDATE disputes SET                       │                      │
│                          │     llm_confidence=0.91                     │                      │
│                          │                                             │                      │
│                          │ [4a] confidence ≥ 0.80: AUTO_RESOLVED       │                      │
│                          │   expert_wins:                              │                      │
│                          │   DB TX: [LEDGER] same as milestone APPROVED│                      │
│                          │     escrow→expert (net of fee)              │                      │
│                          │   client_wins:                              │                      │
│                          │   DB TX: [LEDGER]                           │                      │
│                          │     UPDATE client wallet: avail += amount   │                      │
│                          │     escrow_accounts.status:"REFUNDED"       │                      │
│                          │   UPDATE disputes SET state:"AUTO_RESOLVED" │                      │
│                          │   UPDATE milestones SET state:"APPROVED"    │                      │
│                          │   INSERT platform_decisions                 │                      │
│                          │     {DISPUTE_L1_EVAL,AUTO_RESOLVED}         │                      │
│                          │   Notify both parties                       │                      │
│ <────────────────────────┤                                             │                      │
│                          │ [4b] confidence < 0.80: MANUAL_REVIEW       │                      │
│                          │   UPDATE disputes SET state:"MANUAL_REVIEW" │                      │
│                          │   Notify admin                              │                      │
│                          ├─────────────────────────────────────────────>                      │
│                          │                                             │ [5] Views:           │
│                          │                                             │  GET /admin/disputes │
│                          │                                             │  ?state=MANUAL_REVIEW│
│                          │                                             │  GET /disputes/:id   │
│                          │                                             │  → reasoning [NEW]   │
│                          │                                             │  → llm_confidence    │
│                          │                                             │  GET /engagements/   │
│                          │                                             │  :id/messages        │
│                          │                                             │                      │
│ [6] Post-filing evidence │                                             │                      │
│   POST /disputes/:id/    │                                             │                      │
│   evidence [NEW]         │                                             │                      │
│   {evidence_description, │                                             │                      │
│    file_urls:[]}         │                                             │                      │
│       └────────────────> │                                             │                      │
│                          │ [7] INSERT platform_decisions {             │                      │
│                          │   EVIDENCE_SUBMISSION,                      │                      │
│                          │   advisory_note:"[userId] {description}"}   │                      │
│                          │   Guard: dispute still open                 │                      │
│                          │                                             │                      │
│ [8] Withdraw dispute     │                                             │                      │
│   PUT /disputes/:id/     │                                             │                      │
│   withdraw [NEW]         │                                             │                      │
│       └────────────────> │                                             │                      │
│                          │ [9] Guard: filed_by=userId, state=open      │                      │
│                          │   UPDATE disputes SET state:"WITHDRAWN"     │                      │
│                          │   UPDATE escrow_accounts SET status:"HELD"  │                      │
│                          │     (unfrozen)                              │                      │
│                          │   UPDATE milestones SET state:"SUBMITTED"   │                      │
│                          ├─────────────────────────────────────────────>                      │
│                          │                                             │ [10] Admin resolves  │
│                          │                                             │  PUT /admin/disputes/│
│                          │                                             │  :id/resolve         │
│                          │                                             │  {decision:"RELEASE"}│
│                          │ [11] Per decision:                          │                      │
│                          │   RELEASE → escrow→expert (net of fee)      │                      │
│                          │   REFUND → escrow→client                    │                      │
│                          │   SPLIT → escrow÷2 to each party            │                      │
│                          │   UPDATE disputes SET state:"RESOLVED"      │                      │
│                          │   UPDATE milestones SET state:"APPROVED"    │                      │
│                          │   INSERT platform_decisions {DISPUTE_MANUAL}│                      │
│                          │   Notify both parties                       │                      │
└──────────────────────────┴─────────────────────────────────────────────┴──────────────────────┘
```

---

# MF-9: Post-Engagement Review & Closure

## Overview

After all milestones reach RELEASED state, engagement closes. All three parties (CEO, TECH_TEAM, Expert) can submit role-specific reviews. Expert sees own reviews written/received via new endpoints.

**Tables touched (2):** `engagements`, `reviews`

**Endpoints:** `POST /reviews`, `GET /reviews/me`, `GET /reviews/me/received`, `GET /reviews/users/:userId`, `GET /engagements/:id`

---

## ASCII Swimlane

```
┌───────────────────┬────────────────────────────────┬───────────────────────────────────────────┐
│   CLIENT / CEO    │      SYSTEM (NestJS)           │    EXPERT  /  TECH_TEAM                   │
├───────────────────┼────────────────────────────────┼───────────────────────────────────────────┤
│ [1] All milestones│                                │                                           │
│   RELEASED        │                                │                                           │
│                   │ [2] UPDATE engagements SET     │                                           │
│                   │   state:"CLOSED"               │                                           │
│                   │   Notify all parties           │                                           │
│                   │                                │                                           │
│ [3] CEO review:   │                                │ [3b] Expert review:                       │
│   POST /reviews { │                                │   POST /reviews {                         │
│     engagement_id,│                                │     engagement_id,                        │
│     target_id:    │                                │     target_id: clientId,                  │
│       expert_id,  │                                │     rating:5, comment:"...",              │
│     rating:4,     │                                │     reviewer_role:"EXPERT"                │
│     comment:"...",│                                │   }                                       │
│     reviewer_role:│                                │                                           │
│     "CEO"         │                                │ [3c] TECH_TEAM review:                    │
│   }               │                                │   POST /reviews {                         │
│       └──────────>│                                │     ...structured_signals_json:{...}      │
│                   │ [4] INSERT reviews {           │     reviewer_role:"TECH_TEAM"             │
│                   │   engagement_id,               │   }                                       │
│                   │   reviewer_id, target_id,      │         └────────────────────────────────>│
│                   │   rating, comment,             │                                           │
│                   │   reviewer_role                │                                           │
│                   │ }                              │                                           │
│                   │ UNIQUE(engagement_id,          │                                           │
│                   │   reviewer_id) enforced        │                                           │
│                   │                                │                                           │
│ [5] View reviews: │                                │ [5b] Expert view:                         │
│   GET /reviews/me │                                │   GET /reviews/me         (given)         │
│     → given       │                                │   GET /reviews/me/received [NEW]          │
│   GET /reviews/   │                                │   GET /reviews/users/:id  [NEW]           │
│     users/:expertId│                               │     → public reputation                   │
└───────────────────┴────────────────────────────────┴───────────────────────────────────────────┘
```

---

## Group 4 — Path B & C: Service-Based Flows

---

# MF-10: Service-Based Engagement Purchase (Path B)

## Overview

CEO purchases an AI_SERVICE listing directly from the marketplace. No elicitation, no bid, no TECH_TEAM. Single milestone created and funded atomically on IPN. CEO is sole sign-off authority.

**Tables touched (8):** `services`, `engagements`, `virtual_accounts`, `milestones`, `escrow_accounts`, `wallet_transactions`, `wallets`, `notifications`

**Endpoints:** `GET /services`, `GET /services/:id`, `POST /services/:id/purchase`, `GET /services/me/purchases`, `PUT /services/:id/publish`, `PUT /services/:id/unpublish`, `DELETE /services/:id`

---

## ASCII Swimlane

```
┌───────────────────────────┬──────────────────────────────────────────────────────┬──────────────────┐
│       CLIENT / CEO        │         SYSTEM (NestJS)                              │   SePay          │
├───────────────────────────┼──────────────────────────────────────────────────────┼──────────────────┤
│ [1] Browse marketplace:   │                                                      │                  │
│   GET /services           │                                                      │                  │
│   ?serviceType=AI_SERVICE │                                                      │                  │
│   &domains[]=A            │                                                      │                  │
│   &seams[]=A↔C            │                                                      │                  │
│   ← domain/seam filters   │                                                      │                  │
│     from GET /config/     │                                                      │                  │
│     domains + seams [NEW] │                                                      │                  │
│       └────────────────>  │                                                      │                  │
│                           │ [2] SELECT services WHERE state='PUBLISHED'          │                  │
│                           │   + domain/seam JSON contains filter values          │                  │
│                           │   Return [{title,domainsJson,seamsJson,              │                  │
│                           │     priceVnd,expert{name,avgRating}}]                │                  │
│ <─────────────────────────┤                                                      │                  │
│ [3] GET /services/:id     │                                                      │                  │
│   View full service detail│                                                      │                  │
│                           │                                                      │                  │
│ [4] POST /services/:id/   │                                                      │                  │
│   purchase                │                                                      │                  │
│       └────────────────>  │                                                      │                  │
│                           │ [5] Guard: active_role=CLIENT,client_subtype=CEO     │                  │
│                           │   DB TX:                                             │                  │
│                           │   INSERT engagements {                               │                  │
│                           │     service_id, expert_id,                           │                  │
│                           │     type:service.service_type,                       │                  │
│                           │     state:"PENDING"                                  │                  │
│                           │   }                                                  │                  │
│                           │   INSERT virtual_accounts {                          │                  │
│                           │     entity_type:"SERVICE",                           │                  │
│                           │     entity_id: engagement_id,                        │                  │
│                           │     fixed_amount: service.price_vnd,                 │                  │
│                           │     expires_at: now()+24h                            │                  │
│                           │   }                                                  │                  │
│                           │   Return {qrCodeUrl, vaNumber, vaExpiresAt}          │                  │
│ <─────────────────────────┤                                                      │                  │
│ [6] Scans QR; pays exact  │                                                      │                  │
│   amount                  │                                                      │                  │
│                           │ [7] IPN fires SERVICE branch:                        │ SePay IPN fires  │
│                           │   Validate: amount==va.fixed_amount                  │                  │
│                           │   DB TX (atomic):                                    │                  │
│                           │     INSERT wallet_transactions {ESCROW_LOCK} [LEDGER]│                  │
│                           │     UPDATE wallets (client): locked+=amount          │                  │
│                           │     INSERT escrow_accounts {                         │                  │
│                           │       engagement_id (not milestone_id),              │                  │
│                           │       status:"HELD" }                                │                  │
│                           │     INSERT milestones {                              │                  │
│                           │       engagement_id,                                 │                  │
│                           │       milestone_number:1,                            │                  │
│                           │       sign_off_authority:"CEO",                      │                  │
│                           │       payment_amount_vnd,                            │                  │
│                           │       state:"FUNDED" }                               │                  │
│                           │     UPDATE engagements state:"ACTIVE"                │                  │
│                           │     COMMIT                                           │                  │
│                           │   Notify expert: "New service order"                 │                  │
│ [8] GET /services/me/     │                                                      │                  │
│   purchases [NEW]         │                                                      │                  │
│   → purchased services    │                                                      │                  │
│   history                 │                                                      │                  │
└───────────────────────────┴──────────────────────────────────────────────────────┴──────────────────┘
```

---

## Group 5 — Expert Profile & Service Management

---

# MF-11: Expert Service Listing Lifecycle

## Overview

Expert creates a listing (manually or via AI generator with DB-driven context). Publishes, unpublishes, and deletes listings. Service domain/seam codes are dynamic strings from DB.

**Tables touched (2):** `services`, `expert_domain_depths`, `expert_seam_claims`

**Key changes from old doc:** (1) AI generator now uses expert's claimed domains + seams as context. (2) Price guidance from `subscription_packages` (not hardcoded ranges). (3) `PUT /services/:id/publish` and `PUT /services/:id/unpublish` are explicit endpoints (not just `PUT /services/:id { state }` which still works). (4) `DELETE /services/:id` (DRAFT only). (5) `GET /services/me` for expert's own listings.

**Endpoints:** `POST /services`, `GET /services/me`, `PUT /services/:id`, `PUT /services/:id/publish`, `PUT /services/:id/unpublish`, `DELETE /services/:id`

---

## ASCII Swimlane

```
┌──────────────────────────────────┬─────────────────────────────────────────────────────┐
│            EXPERT                │           SYSTEM (NestJS + FastAPI)                 │
├──────────────────────────────────┼─────────────────────────────────────────────────────┤
│ ══ ROUTE A: AI GENERATOR (Pro-E) │                                                     │
│ [1] POST /services {             │                                                     │
│   serviceType:"AI_SERVICE",      │                                                     │
│   useAiGenerator:true,           │                                                     │
│   capabilities:["RAG pipeline    │                                                     │
│     for enterprise KB"],         │                                                     │
│   targetUseCases:["Customer      │                                                     │
│     support automation"]         │                                                     │
│ }                                │                                                     │
│       └──────────────────────── >│                                                     │
│                                  │ [2] Fetch expert context:                           │
│                                  │   SELECT expert_domain_depths WHERE expert_id=me    │
│                                  │   SELECT expert_seam_claims WHERE expert_id=me      │
│                                  │   SELECT subscription_packages (price guidance) [NEW]
│                                  │   [AI] FastAPI service_generate:                    │
│                                  │     Passes:                                         │
│                                  │       capabilities, target_use_cases,               │
│                                  │       claimed_domains:[{code,name,depth}] [NEW],    │
│                                  │       claimed_seams:[{code,name}] [NEW],            │
│                                  │       price_guidance:{small,med,large} from DB [NEW]│
│                                  │     Returns {title, description, scope,             │
│                                  │       timeline, suggested_price_vnd,                │
│                                  │       suggested_domains:["A","C"] [NEW],            │
│                                  │       suggested_seams:["A↔C"] [NEW],                │
│                                  │       pricing_rationale:"..." [NEW] }               │
│                                  │   INSERT services {state:"DRAFT",domainsJson,       │
│                                  │     seamsJson,priceVnd:suggested_price_vnd}         │
│ <────────────────────────────────┤                                                     │
│ [3] Expert reviews AI draft      │                                                     │
│   edits title/price if needed    │                                                     │
│   PUT /services/:id {updated}    │                                                     │
│                                  │                                                     │
│ ══ ROUTE B: MANUAL ══════════════│                                                     │
│ [4] POST /services {             │                                                     │
│   serviceType:"AI_SERVICE",      │                                                     │
│   title:"RAG Pipeline for        │                                                     │
│     Enterprise KB",              │                                                     │
│   description:"...",             │                                                     │
│   scope:"...", timeline:"...",   │                                                     │
│   priceVnd:25000000,             │                                                     │
│   domainsJson:["A","D"],         │                                                     │
│   seamsJson:["A↔D"] ← ↔ required│                                                      │
│ }                                │                                                     │
│       └──────────────────────── >│                                                     │
│                                  │ [5] DTO validates: seam codes are strings           │
│                                  │   (no enum check — DB validates in service layer)   │
│                                  │   INSERT services {state:"DRAFT"}                   │
│                                  │                                                     │
│ ══ PUBLISH LIFECYCLE ════════════│                                                     │
│ [6] GET /services/me [NEW]       │                                                     │
│   → own listings (all states)    │                                                     │
│   Includes DRAFT + PUBLISHED     │                                                     │
│                                  │                                                     │
│ [7] Publish:                     │                                                     │
│   PUT /services/:id/publish [NEW]│                                                     │
│       └──────────────────────── >│                                                     │
│                                  │ [8] Guard: state=DRAFT, owner=me                    │
│                                  │   UPDATE services SET state="PUBLISHED"             │
│                                  │   Listing appears in GET /services (marketplace)    │
│                                  │                                                     │
│ [9] Unpublish (take down):       │                                                     │
│   PUT /services/:id/unpublish    │                                                     │
│   [NEW]                          │                                                     │
│       └──────────────────────── >│                                                     │ 
│                                  │ [10] Guard: state=PUBLISHED, owner=me               │ 
│                                  │   UPDATE services SET state="DRAFT"                 │
│                                  │                                                     │
│ [11] Delete (DRAFT only) [NEW]:  │                                                     │
│   DELETE /services/:id           │                                                     │
│       └──────────────────────── >│                                                     │
│                                  │ [12] Guard: state=DRAFT, owner=me                   │
│                                  │   IF state≠DRAFT → 422                              │
│                                  │     "Can only delete DRAFT listings.                │
│                                  │      Unpublish first."                              │
│                                  │   DELETE services                                   │
└──────────────────────────────────┴─────────────────────────────────────────────────────┘
```

---

# MF-12: Seam Tier 2 Portfolio Verification

## Overview

Expert submits portfolio evidence for seam boundary competency. FastAPI portfolio evaluator now receives live seam definitions from `seam_definitions` table — no hardcoded `VALID_SEAM_CODES` Python set. `confidence ≥ 0.85` → EVIDENCE_BACKED. Below threshold → rejection with advisory. 5th rejection triggers 30-day lockout.

**Tables touched (5):** `portfolio_submissions`, `expert_seam_claims`, `platform_decisions`, `seam_definitions`, `notifications`

**Key changes from old doc:** (1) `all_seam_definitions` fetched from `seam_definitions` table and passed to FastAPI (removes hardcoded Python set). (2) `seam_name` and `seam_description` also passed for context. (3) `gap_advisory` names the specific missing signal type. (4) `DELETE /portfolio-submissions/me/portfolio/:id` and `GET /portfolio-submissions/me/portfolio/:id` added.

**Endpoints:** `POST /portfolio-submissions`, `GET /portfolio-submissions`, `GET /portfolio-submissions/:id`, `GET /portfolio-submissions/me/portfolio/:id`, `DELETE /portfolio-submissions/me/portfolio/:id`, `GET /expert-profile/me/seams`

---

## ASCII Swimlane

```
┌──────────────────────────────────┬────────────────────────────────────────────────────┐
│            EXPERT                │           SYSTEM (NestJS + FastAPI)                │
├──────────────────────────────────┼────────────────────────────────────────────────────┤
│ [1] Check seam claim status:     │                                                    │
│   GET /expert-profile/me/seams   │                                                    │
│   → seamCode:"A↔C",              │                                                    │
│     verification_tier:"CLAIMED", │                                                    │
│     submission_count:2,          │                                                    │
│     locked_until:null            │                                                    │
│                                  │                                                    │
│ [2] POST /portfolio-submissions  │                                                    │
│ [Pro-E]                          │                                                    │
│ {seamClaimId:"uuid",             │                                                    │
│  projectDescription:"We built a  │                                                    │
│    RAG pipeline for 50k docs...  │                                                    │
│    [≥50 chars]",                 │                                                    │
│  decisionPoints:"At A↔C: chose   │                                                    │
│    hybrid BM25+dense over pure   │                                                    │
│    dense because... [≥20 chars]" │                                                    │
│ }                                │                                                    │
│       └──────────────────────── >│                                                    │
│                                  │ [3] Validation: length ≥ min chars                 │
│                                  │   Fetch seam context from DB [NEW]:                │
│                                  │     SELECT seam_definitions WHERE code=?           │
│                                  │     → {name:"LLM output quality",                  │
│                                  │         description:"..."}                         │
│                                  │   Fetch ALL active seam definitions [NEW]:         │
│                                  │     SELECT seam_definitions WHERE is_active=true   │
│                                  │                                                    │
│                                  │ [4] [AI] FastAPI portfolio_eval:                   │
│                                  │   Passes [NEW]:                                    │
│                                  │     seam_code:"A↔C",                               │
│                                  │     seam_name:"LLM output quality",                │
│                                  │     seam_description:"...",                        │
│                                  │     all_seam_definitions:[...from DB...],          │
│                                  │     project_description, decision_points           │
│                                  │   Prompt built with Jinja2 {{seam_definitions}}    │
│                                  │   (no hardcoded seam list)                         │
│                                  │   Returns {                                        │
│                                  │     confidence_score: 0.91,                        │
│                                  │     passed_boolean: true,                          │
│                                  │     gap_advisory: null                             │
│                                  │   }                                                │
│                                  │                                                    │
│                                  │ IF confidence ≥ 0.85:                              │
│                                  │ [5a] DB TX:                                        │
│                                  │   INSERT portfolio_submissions {                   │
│                                  │     status:"APPROVED",                             │
│                                  │     llm_confidence:0.91,                           │
│                                  │     evaluated_at:now() }                           │
│                                  │   UPDATE expert_seam_claims SET                    │
│                                  │     verification_tier:"EVIDENCE_BACKED"            │
│                                  │   INSERT platform_decisions                        │
│                                  │     {SEAM_TIER_UPGRADE}                            │
│ <────────────────────────────────┤                                                    │
│ [6a] Tier 2 granted:             │                                                    │
│   Seam gap map: yellow→amber     │                                                    │
│   (or green if load-bearing)     │                                                    │
│   Composite score: 0.20→0.55     │                                                    │
│                                  │                                                    │
│                                  │ IF confidence < 0.85:                              │
│                                  │ [5b] DB TX:                                        │
│                                  │   INSERT portfolio_submissions {                   │
│                                  │     status:"REJECTED",                             │
│                                  │     llm_confidence:0.72 }                          │
│                                  │   UPDATE expert_seam_claims SET                    │
│                                  │     submission_count++ [now 3]                     │
│                                  │     IF submission_count=5:                         │
│                                  │       locked_until=now()+30days                    │
│                                  │   INSERT platform_decisions                        │
│                                  │     {PORTFOLIO_EVAL, REJECTED,                     │
│                                  │      advisory_note:"Missing: trade-off             │
│                                  │        reasoning at seam boundary"}                │
│ <────────────────────────────────┤                                                    │
│ [6b] Rejection shown:            │                                                    │
│   advisory_note displayed        │                                                    │
│   submission_count=3 → 2 retries │                                                    │
│   submission_count=5 → lockout   │                                                    │
│     timer shown                  │                                                    │
│                                  │                                                    │
│ [7] View submissions:            │                                                    │
│   GET /portfolio-submissions     │                                                    │
│   GET /portfolio-submissions/:id │                                                    │
│   GET /portfolio-submissions/    │                                                    │
│     me/portfolio/:id [NEW]       │                                                    │
│                                  │                                                    │
│ [8] Delete submission [NEW]:     │                                                    │
│   DELETE /portfolio-submissions/ │                                                    │
│     me/portfolio/:id             │                                                    │
│       └──────────────────────── >│                                                    │
│                                  │ [9] Guard: expert owns, state=REJECTED             │
│                                  │   DELETE portfolio_submissions                     │
└──────────────────────────────────┴────────────────────────────────────────────────────┘
```

---

# MF-13: Earnings, Withdrawal & Bank Linking

## Overview

Expert links bank account via SePay Bank Hub. Requests withdrawal. Chi hộ fires automatically. NEW: expert can cancel a PENDING withdrawal (refunds wallet atomically). Wallet transactions now support pagination and type filtering.

**Tables touched (5):** `wallets`, `wallet_transactions`, `withdrawal_requests`, `users`, `notifications`

**Key changes from old doc:** (1) `DELETE /withdrawals/:id` cancels PENDING withdrawal (new). (2) `GET /wallets/me/transactions?type=&limit=&offset=` — paginated + filterable (was unfiltered). (3) `GET /withdrawals` (expert's own) already existed.

**Endpoints:** `POST /bank-hub/initiate-link`, `POST /webhooks/sepay/bank-linked`, `GET /wallets/me`, `GET /wallets/me/transactions`, `POST /withdrawals`, `GET /withdrawals`, `DELETE /withdrawals/:id`

---

## ASCII Swimlane

```
┌────────────────────────────┬──────────────────────────────────────────┬──────────────────┐
│          EXPERT            │        SYSTEM (NestJS)                   │   SePay / Bank   │
├────────────────────────────┼──────────────────────────────────────────┼──────────────────┤
│ ══ PHASE A: BANK LINKING ══│                                          │                  │
│ [1] POST /bank-hub/        │                                          │                  │
│   initiate-link            │                                          │                  │
│       └──────────────────> │                                          │                  │
│                            │ [2] Calls SePay Bank Hub API             │                  │
│                            │   Returns hosted_link_url                │                  │
│ <──────────────────────────┤                                          │                  │
│ [3] Opens hosted URL       │                                          │                  │
│   Completes bank+OTP       │                                          │ [4] SePay fires  │
│   (no password sharing)    │                                          │ BANK_LINKED hook:│
│                            │ ┌────────────────────────────────────────│ POST /webhooks/  │
│                            │ [5] POST /webhooks/sepay/bank-linked      │ sepay/bank-linked│
│                            │   UPDATE users SET                        │                  │
│                            │     sepay_bank_account_xid=?,            │                  │
│                            │     bank_account_holder_name=?,          │                  │
│                            │     bank_linked_at=now()                 │                  │
│ <──────────────────────────┤                                          │                  │
│ [6] Bank linked ✓          │                                          │                  │
│   Withdrawal enabled       │                                          │                  │
│                            │                                          │                  │
├────────────────────────────┼──────────────────────────────────────────┼──────────────────┤
│ ══ PHASE B: WITHDRAWAL ════│                                          │                  │
│ [7] GET /wallets/me        │                                          │                  │
│   GET /wallets/me/         │                                          │                  │
│     transactions           │                                          │                  │
│     ?type=ESCROW_RELEASE   │                                          │                  │
│     &limit=50&offset=0     │                                          │                  │
│     [paginated + filtered] │                                          │                  │
│                            │                                          │                  │
│ [8] POST /withdrawals      │                                          │                  │
│   {amount:30000000}        │                                          │                  │
│       └──────────────────> │                                          │                  │
│                            │ [9] Guard 1: bank_account_xid IS NULL    │                  │
│                            │   → 422 redirect to bank linking         │                  │
│                            │   Guard 2: available < amount            │                  │
│                            │   → 422 INSUFFICIENT_BALANCE             │                  │
│                            │   DB TX (atomic):                        │                  │
│                            │     UPDATE wallets:                      │                  │
│                            │       available -= 30000000              │                  │
│                            │     INSERT wallet_transactions           │                  │
│                            │       {WITHDRAWAL} [LEDGER]              │                  │
│                            │     INSERT withdrawal_requests {         │                  │
│                            │       type:"EXPERT_MANUAL",              │                  │
│                            │       amount:30000000,                   │                  │
│                            │       bank_account_xid,                  │                  │
│                            │       status:"PENDING" }                 │                  │
│                            │   COMMIT                                 │                  │
│                            │   Async: chi hộ API call                 │                  │
│                            │   UPDATE withdrawal_requests             │                  │
│                            │     status:"PROCESSING",disbursementId   │                  │
│ <──────────────────────────┤                                          │                  │
│                            │                                          │ SePay credit IPN │
│                            │ ┌────────────────────────────────────────│ [10] IPN fires   │
│                            │ UPDATE withdrawal_requests               │                  │
│                            │   status:"COMPLETED",                    │                  │
│                            │   confirmed_at:now()                     │                  │
│                            │ Notify expert: "Withdrawal completed"    │                  │
│                            │                                          │                  │
│                            │ IF chi hộ error:                         │                  │
│                            │   DB compensation (atomic):              │                  │
│                            │   UPDATE wallets: available += 30000000  │                  │
│                            │   UPDATE withdrawal_requests: FAILED     │                  │
│                            │   Notify expert: "Failed — balance       │                  │
│                            │     restored"                            │                  │
│                            │                                          │                  │
├────────────────────────────┼──────────────────────────────────────────┼──────────────────┤
│ ══ PHASE C: CANCEL WITHDRAWAL [NEW] ═══════════════════════════════════════─═════════════│
│ [11] DELETE /withdrawals/  │                                          │                  │
│   :id [NEW]                │                                          │                  │
│   (while still PENDING)    │                                          │                  │
│       └──────────────────> │                                          │                  │
│                            │ [12] Guard: expert owns +                │                  │
│                            │   status=PENDING                         │                  │
│                            │   IF status≠PENDING → 422                │                  │
│                            │   DB TX (atomic):                        │                  │
│                            │     UPDATE withdrawal_requests           │                  │
│                            │       status:"CANCELLED"                 │                  │
│                            │     UPDATE wallets:                      │                  │
│                            │       available += amount (refund)       │                  │
│                            │   COMMIT                                 │                  │
│                            │   Return {cancelled:true,                │                  │
│                            │     refundedAmount:30000000}             │                  │
│ <──────────────────────────┤                                          │                  │
│ [13] Balance restored      │                                          │                  │
└────────────────────────────┴──────────────────────────────────────────┴──────────────────┘
```

---

## Group 6 — Messaging, Notifications & Chat

---

# MF-14: Messaging & Notifications

## Overview

Two-channel messaging system: project-scoped (pre-bid Q&A) and engagement-scoped (post-connection). All WebSocket notifications are now persisted to `notifications` table for REST retrieval on page refresh. `GET /conversations` provides a unified thread list (inbox view).

**Tables touched (4):** `messages`, `message_reads`, `notifications`, `engagements`

**Key changes from old doc:** (1) `notifications` table is entirely new. (2) All `notification:generic` events now persisted to DB — survive page refresh. (3) `GET /conversations` (new — unified thread list with last message + unread count). (4) `GET /projects/:id/messages/unread-count` (new). (5) `GET /engagements/:id/messages/unread-count` (was named differently in old doc).

**Endpoints:** `GET /conversations`, `GET /projects/:id/messages`, `GET /projects/:id/messages/unread-count`, `POST /messages/:id/read`, `GET /engagements/:id/messages`, `GET /engagements/:id/messages/unread-count`, `GET /notifications/me`, `GET /notifications/me/unread-count`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`, `DELETE /notifications/:id`

---

## ASCII Swimlane

```
┌────────────────────────────┬──────────────────────────────────────────────────────┐
│    ALL PARTIES             │           SYSTEM (NestJS + WebSocket)                │
├────────────────────────────┼──────────────────────────────────────────────────────┤
│ ══ NOTIFICATIONS (Persistent) [NEW] ══════════════════════════════════════════════│
│                            │                                                      │
│ [1] Any event fires:       │                                                      │
│   EventEmitter.emit(       │                                                      │
│     'socket.broadcast',    │                                                      │
│     {userId,event,payload})│                                                      │
│                            │                                                      │
│                            │ [2] Gateway @OnEvent('socket.broadcast'):            │
│                            │   Step A: Emit real-time socket event:               │
│                            │     server.to(userId).emit(event,payload)            │
│                            │   Step B: IF event='notification:generic':           │
│                            │     INSERT notifications {                           │
│                            │       user_id: userId,                               │
│                            │       type: payload.type,                            │
│                            │       title: payload.title,                          │
│                            │       body: payload.body,                            │
│                            │       link: payload.link,                            │
│                            │       is_read:false                                  │
│                            │     }                                                │
│                            │   FAIL-OPEN: DB write failure never blocks           │
│                            │     WebSocket delivery                               │
│                            │                                                      │
│ [3] On page load/refresh:  │                                                      │
│   GET /notifications/me    │                                                      │
│     ?unreadOnly=true       │                                                      │
│     &limit=50 [NEW]        │                                                      │
│       └──────────────────> │                                                      │
│                            │ [4] SELECT notifications WHERE                       │
│                            │   user_id=? ORDER BY created_at DESC                 │
│                            │   Return [{id,type,title,body,link,                  │
│                            │     is_read,created_at}]                             │
│ <──────────────────────────┤                                                      │
│ [5] GET /notifications/me/ │                                                      │
│   unread-count             │                                                      │
│       └──────────────────> │                                                      │
│                            │ [6] SELECT COUNT WHERE user_id=?                     │
│                            │   AND is_read=false                                  │
│                            │   Return {unread_count:N} → nav badge                │
│ <──────────────────────────┤                                                      │
│ [7] PUT /notifications/:id/│                                                      │
│   read [NEW]               │                                                      │
│ PUT /notifications/read-all│                                                      │
│ DELETE /notifications/:id  │                                                      │
│                            │ [8] UPDATE notifications SET                         │
│                            │   is_read=true, read_at=now()                        │
│                            │   (or bulk, or delete)                               │
│                            │                                                      │
├────────────────────────────┼──────────────────────────────────────────────────────┤
│ ══ CONVERSATIONS THREAD LIST [NEW] ═══════════════════════════════════════════════│
│ [9] GET /conversations     │                                                      │
│   [NEW — inbox sidebar]    │                                                      │
│       └──────────────────> │                                                      │
│                            │ [10] For current user: SELECT engagements WHERE      │
│                            │   (expert_id OR client_id) = userId                  │
│                            │   For each engagement:                               │
│                            │     SELECT last message + unread count               │
│                            │   Return [{                                          │
│                            │     type:"engagement",                               │
│                            │     id:engagement_id,                                │
│                            │     projectName:"...",                               │
│                            │     otherParty:{id,fullName},                        │
│                            │     lastMessage:{content,createdAt},                 │
│                            │     unreadCount:N                                    │
│                            │   }] sorted by lastMessage.createdAt DESC            │
│ <──────────────────────────┤                                                      │
│                            │                                                      │
├────────────────────────────┼──────────────────────────────────────────────────────┤
│ ══ MESSAGING CHANNELS ═════│                                                      │
│ [11] Pre-bid project chat: │                                                      │
│   GET /projects/:id/       │                                                      │
│     messages               │                                                      │
│   GET /projects/:id/       │                                                      │
│     messages/unread-count  │                                                      │
│   WebSocket sendMessage    │                                                      │
│     {projectId, content}   │                                                      │
│       └──────────────────> │                                                      │
│                            │ [12] INSERT messages {project_id,sender_id,content}  │
│                            │   Emit to all parties in project room                │
│                            │                                                      │
│ [13] Engagement chat:      │                                                      │
│   GET /engagements/:id/    │                                                      │
│     messages               │                                                      │
│   GET /engagements/:id/    │                                                      │
│     messages/unread-count  │                                                      │
│   WebSocket sendMessage    │                                                      │
│     {engagementId, content}│                                                      │
│       └──────────────────> │                                                      │
│                            │ [14]INSERT messages {engagement_id,sender_id,content}│
│                            │   Emit to all engagement room participants           │
│                            │                                                      │
│ [15] Mark read:            │                                                      │
│   POST /messages/:id/read  │                                                      │
│       └──────────────────> │                                                      │
│                            │ [16] INSERT message_reads {message_id,user_id}       │
│                            │   UNIQUE(message_id,user_id) enforced                │
└────────────────────────────┴──────────────────────────────────────────────────────┘
```

---

# MF-15: Milestone Chat Assistant

## Overview

AI assistant embedded in the project milestone page. CEO or TECH_TEAM chats about milestone structure. Server owns full conversation history — FE only needs to store `chatSessionId`. `suggestedEdit` field triggers one-click apply to milestone.

**Tables touched (2):** `milestone_chat_sessions`, `milestones`

**Endpoints:** `POST /projects/:id/milestone-chat`, `GET /projects/:id/milestone-chat/sessions`, `GET /projects/:id/milestone-chat/sessions/:sessionId`

---

## ASCII Swimlane

```
┌────────────────────────────┬──────────────────────────────────────────────────────┐
│       CLIENT / CEO         │         SYSTEM (NestJS + FastAPI)                    │
├────────────────────────────┼──────────────────────────────────────────────────────┤
│ ══ NEW CONVERSATION ═══════│                                                      │
│ [1] POST /projects/:id/    │                                                      │
│   milestone-chat           │                                                      │
│   {message:"Why 3          │                                                      │
│     milestones? Can we     │                                                      │
│     reduce?"}              │                                                      │
│   ← no chatSessionId       │                                                      │
│       └──────────────────> │                                                      │
│                            │ [2] No chatSessionId → new session:                  │
│                            │   INSERT milestone_chat_sessions {                   │
│                            │     project_id, user_id,                             │
│                            │     title:"Chat · DD/MM/YYYY",                       │
│                            │     messages_json:"[]"                               │
│                            │   }                                                  │
│                            │                                                      │
│                            │ [3] Build system prompt:                             │
│                            │   Fetch from prompt_templates (60s TTL)              │
│                            │   Inject artifact_a_json +                           │
│                            │     milestone_framework_json +                       │
│                            │     budget_context                                   │
│                            │                                                      │
│                            │ [4] [AI] FastAPI milestone_chat:                     │
│                            │   messages=[{role:"user",content:message}]           │
│                            │   Returns {reply:"The 3 milestones map to...",       │
│                            │     suggested_edit:null}                             │
│                            │                                                      │
│                            │ [5] Append to history:                               │
│                            │   UPDATE milestone_chat_sessions SET                 │
│                            │     messages_json = [...prev,                        │
│                            │       {role:"user",content:message},                 │
│                            │       {role:"assistant",content:reply}]              │
│                            │   Return {reply, suggested_edit:null,                │
│                            │     chatSessionId:"uuid",                            │
│                            │     sessionTitle:"Chat · 11/07/2026",                │
│                            │     messageCount:2}                                  │
│ <──────────────────────────┤                                                      │
│ [6] FE stores only         │                                                      │
│   chatSessionId (not reply)│                                                      │
│                            │                                                      │
│ ══ FOLLOW-UP (same session)│                                                      │
│ [7] POST /projects/:id/    │                                                      │
│   milestone-chat           │                                                      │
│   {message:"Can we cut     │                                                      │
│     milestone 2 budget?",  │                                                      │
│    chatSessionId:"uuid"}   │                                                      │
│       └──────────────────> │                                                      │
│                            │ [8] Load history from milestone_chat_sessions        │
│                            │   Append new user message to history                 │
│                            │   [AI] FastAPI: full history + new message           │
│                            │   Returns {reply:"...",                              │
│                            │     suggested_edit:{                                 │
│                            │       milestone_number:2,                            │
│                            │       field:"paymentAmountVnd",                      │
│                            │       suggested_value:30000000,                      │
│                            │       reason:"Lighter scope than estimated"          │
│                            │     }}                                               │
│                            │   UPDATE messages_json with new exchange             │
│ <──────────────────────────┤                                                      │
│ [9] Shows:                 │                                                      │
│   suggested_edit → "Apply" │                                                      │
│   button: PATCH /milestones│                                                      │
│   /:id {paymentAmountVnd:  │                                                      │
│     30000000}              │                                                      │
│                            │                                                      │
│ ══ SESSION MANAGEMENT ═════│                                                      │
│ [10] GET /projects/:id/    │                                                      │
│   milestone-chat/sessions  │                                                      │
│   → sidebar list           │                                                      │
│   [{id,title,messageCount, │                                                      │
│     updatedAt}]            │                                                      │
│                            │                                                      │
│ [11] GET /projects/:id/    │                                                      │
│   milestone-chat/sessions/ │                                                      │
│   :sessionId               │                                                      │
│   → restore thread on      │                                                      │
│     page refresh           │                                                      │
│   {messagesJson:[...]}     │                                                      │
└────────────────────────────┴──────────────────────────────────────────────────────┘
```

---

# MF-16: Password Recovery & Account Security

## Overview

Three-step password recovery for unauthenticated users. Change-password flow for authenticated users. Account deactivation guard.

**Tables touched (1):** `users`

**Endpoints:** `POST /auth/forgot-password`, `GET /auth/verify-reset-token/:token`, `POST /auth/reset-password`, `PUT /auth/me/password`, `DELETE /users/me`

---

## ASCII Swimlane

```
┌─────────────────────────────┬────────────────────────────────────────────────────┐
│   ANY USER (Unauthenticated)│       SYSTEM (NestJS)                              │
├─────────────────────────────┼────────────────────────────────────────────────────┤
│ ══ FORGOT PASSWORD (UNAUTH) ═════════════════════════════════════════════════════│
│ [1] POST /auth/forgot-      │                                                    │
│   password                  │                                                    │
│   {email:"..."}             │                                                    │
│       └───────────────────> │                                                    │
│                             │ [2] SELECT users WHERE email=?                     │
│                             │   IF NOT found → same response (anti-enumeration)  │
│                             │   IF found:                                        │
│                             │     UPDATE users SET                               │
│                             │       password_reset_token = uuid(),               │
│                             │       password_reset_token_expires_at =            │
│                             │         now()+1h                                   │
│                             │     Dispatch email: /reset-password/<token>        │
│                             │   ALWAYS return: {message:"If an account with      │
│                             │     that email exists, a reset link has            │
│                             │     been sent."} [anti-enumeration]                │
│ <───────────────────────────┤                                                    │
│                             │                                                    │
│ [3] Opens email link        │                                                    │
│   /reset-password/<token>   │                                                    │
│   ← MUST call verify on     │                                                    │
│     PAGE MOUNT before       │                                                    │
│     showing form            │                                                    │
│   GET /auth/verify-reset-   │                                                    │
│   token/:token              │                                                    │
│       └───────────────────> │                                                    │
│                             │ [4] SELECT users WHERE                             │
│                             │   password_reset_token=? AND                       │
│                             │   password_reset_token_expires_at > now()          │
│                             │   IF valid → 200 {valid:true}                      │
│                             │   IF invalid/expired → 400                         │
│                             │     "This password reset link is invalid           │
│                             │      or has expired."                              │
│ <───────────────────────────┤                                                    │
│                             │                                                    │
│ [5] IF 200: shows form      │                                                    │
│   IF 400: shows error +     │                                                    │
│     "Request new link" CTA  │                                                    │
│   Fills new password        │                                                    │
│   POST /auth/reset-password │                                                    │
│   {token:"...",             │                                                    │
│    newPassword:"NewPass1!"} │                                                    │
│       └───────────────────> │                                                    │
│                             │ [6] Validate token again (double check)            │
│                             │   Validate newPassword (5 rules simultaneously)    │
│                             │   DB TX:                                           │
│                             │     UPDATE users SET                               │
│                             │       password_hash = bcrypt(newPassword),         │
│                             │       refresh_token_hash = NULL                    │
│                             │         (all sessions invalidated),                │
│                             │       password_reset_token = NULL,                 │
│                             │       password_reset_token_expires_at = NULL       │
│                             │   COMMIT                                           │
│                             │   Return {message:"Password reset.                 │
│                             │     You can now log in."}                          │
│ <───────────────────────────┤                                                    │
│ [7] Redirect to /login      │                                                    │
│   Success toast             │                                                    │
│                             │                                                    │
├─────────────────────────────┼────────────────────────────────────────────────────┤
│ ══ CHANGE PASSWORD (AUTHENTICATED) ══════════════════════════════════════════════│
│ [8] PUT /auth/me/password   │                                                    │
│   {currentPassword:"...",   │                                                    │
│    newPassword:"..."}       │                                                    │
│       └───────────────────> │                                                    │
│                             │ [9] bcrypt.compare(current, stored_hash)           │
│                             │   IF false → 401 "Current password is incorrect"   │
│                             │   Validate newPassword (5 rules)                   │
│                             │   UPDATE users SET                                 │
│                             │     password_hash = bcrypt(newPassword),           │
│                             │     refresh_token_hash = NULL                      │
│                             │   Return {message:"Password changed...             │
│                             │     Please log in again."}                         │
│ <───────────────────────────┤                                                    │
│ [10] Auto-redirect to /login│                                                    │
│   (all sessions invalidated)│                                                    │
└─────────────────────────────┴────────────────────────────────────────────────────┘
```

---

## Group 7 — Admin Flows

---

# MF-17: Admin CMS — Config Management

## Overview

Admin manages all dynamic configuration stored in the 5 CMS tables. Changes take effect immediately in FE (next API call) and within 60 seconds in FastAPI (prompt cache TTL). This replaces all hardcoded values previously in NestJS DTOs and FastAPI service files.

**Tables touched (5):** `domain_definitions`, `seam_definitions`, `archetype_definitions`, `probe_questions`, `void_code_definitions`

**Key principle:** Adding a new domain code → immediately available in `GET /config/domains` → FE dropdowns update → expert can claim the new domain → bid DTO accepts the new code. Zero redeployment.

**Endpoints:** `GET/POST/PUT/DELETE /admin/config/domains`, `/seams`, `/archetypes`, `/probe-questions`, `/void-codes`; `GET /config/all`

---

## ASCII Swimlane

```
┌───────────────────────────────┬─────────────────────────────────────────────────────┐
│             ADMIN             │          SYSTEM (NestJS)                            │
├───────────────────────────────┼─────────────────────────────────────────────────────┤
│ ══ DOMAIN MANAGEMENT ═════════│                                                     │
│ [1] GET /admin/config/domains │                                                     │
│   → all (active + inactive)   │                                                     │
│                               │ SELECT domain_definitions ORDER BY sort_order       │
│                               │                                                     │
│ [2] POST /admin/config/domains│                                                     │
│   {code:"G",                  │                                                     │
│    name:"Agentic Systems",    │                                                     │
│    description:"Multi-agent   │                                                     │
│      orchestration...",       │                                                     │
│    sortOrder:7}               │                                                     │
│       └─────────────────────> │                                                     │
│                               │ INSERT domain_definitions {is_active:true}          │
│                               │ EFFECT: GET /config/domains now returns "G"         │
│                               │   FE expert profile form shows "G" option           │
│                               │   Expert bids with code:"G" pass DTO validation     │
│                               │   Project synthesis can assign domain G             │
│                               │                                                     │
│ [3] PUT /admin/config/        │                                                     │
│   domains/:id                 │                                                     │
│   {isActive:false}            │                                                     │
│       └─────────────────────> │                                                     │
│                               │ UPDATE domain_definitions SET is_active=false       │
│                               │ EFFECT: domain disappears from public config        │
│                               │   but existing expert claims preserved              │
│                               │                                                     │
│ ══ SEAM MANAGEMENT ═══════════│                                                     │
│ [4] POST /admin/config/seams  │                                                     │
│   {code:"A↔G",                │                                                     │
│    name:"LLM App to Agentic", │                                                     │
│    description:"..."}         │                                                     │
│       └─────────────────────> │                                                     │
│                               │ INSERT seam_definitions                             │
│                               │ EFFECT: New seam "A↔G" available for:               │
│                               │   - Expert seam claims                              │
│                               │   - Project requirements (synthesis)                │
│                               │   - Bid footprint_alignment_json                    │
│                               │   - Portfolio submissions                           │
│                               │   - FastAPI prompt (Jinja2 {{seams}} var)           │
│                               │     within 60 seconds                               │
│                               │                                                     │
│ ══ VOID CODE MANAGEMENT [NEW] ══════════════════════════════════════════──══════════│
│ [5] POST /admin/config/       │                                                     │
│   void-codes                  │                                                     │
│   {code:"GDPR_COMPLIANCE_RISK"│                                                     │
│    name:"GDPR Compliance Risk"│                                                     │
│    description:"EU personal   │                                                     │
│      data involved...",       │                                                     │
│    severity:"HIGH",           │                                                     │
│    sortOrder:9}               │                                                     │
│       └─────────────────────> │                                                     │
│                               │ INSERT void_code_definitions {is_active:true}       │
│                               │ EFFECT (within 60s):                                │
│                               │   FastAPI stage1_extract prompt picks up new void   │
│                               │   ({{void_codes}} Jinja2 var updated via TTL cache) │
│                               │   Next CEO submission triggers GDPR detection       │
│                               │   Stage 2 displays new void to CEO                  │
│                               │     via GET /config/void-codes                      │
│                               │                                                     │
│ ══ PROBE QUESTION MANAGEMENT ══│                                                    │
│ [6] POST /admin/config/       │                                                     │
│   probe-questions             │                                                     │
│   {archetypeCode:"3",         │                                                     │
│    questionText:"How will     │                                                     │
│      you measure false        │                                                     │
│      positive rate?",         │                                                     │
│    displayOrder:5}            │                                                     │
│       └─────────────────────> │                                                     │
│                               │ INSERT probe_questions {is_active:true}             │
│                               │ EFFECT: GET /config/archetypes/3/probe-questions    │
│                               │   now returns 5 questions instead of 4              │
│                               │   Next Stage 3 submission must include this Q       │
│                               │                                                     │
│ ══ CONFIG BOOTSTRAP [NEW] ════│                                                     │
│ [7] FE on app mount:          │                                                     │
│   GET /config/all             │                                                     │
│       └─────────────────────> │                                                     │
│                               │ Promise.all([                                       │
│                               │   getDomains(), getSeams(), getArchetypes(),        │
│                               │   getVoidCodes(), getSubscriptionPackages()         │
│                               │ ])                                                  │
│                               │ Return {domains, seams, archetypes,                 │
│                               │   voidCodes, subscriptionPackages}                  │
│                               │ ← 1 call instead of 5 [NEW]                         │
└───────────────────────────────┴─────────────────────────────────────────────────────┘
```

---

# MF-18: Admin Prompt Template Hot-Reload

## Overview

Admin edits AI prompt templates through the dashboard. FastAPI's `prompt_service.py` maintains a 60-second TTL in-process cache. After cache expires, next elicitation call picks up the new template from the `prompt_templates` table. Jinja2 dynamic variables (`{{ archetypes }}`, `{{ void_codes }}`, etc.) are injected at render time from live DB tables.

**Tables touched (1):** `prompt_templates`

**Endpoints:** `GET /admin/prompts`, `GET /admin/prompts/:stage`, `PUT /admin/prompts/:stage`, `DELETE /admin/prompts/:stage`, `GET /internal/prompts/:stage`

---

## ASCII Swimlane

```
┌────────────────────────────┬──────────────────────────────────────────┬───────────────────────────┐
│           ADMIN            │       SYSTEM (NestJS)                    │   FastAPI (AI Service)    │
├────────────────────────────┼──────────────────────────────────────────┼───────────────────────────┤
│ [1] GET /admin/prompts     │                                          │                           │
│   → list all stages        │                                          │                           │
│   [{stage:"stage1_extract",│                                          │                           │
│     description:"...",     │                                          │                           │
│     version:3,updatedAt}]  │                                          │                           │
│                            │                                          │                           │
│ [2] GET /admin/prompts/    │                                          │                           │
│   stage5_synthesize        │                                          │                           │
│   → full template text     │                                          │                           │
│   including Jinja2 vars:   │                                          │                           │
│   "{{domains}}", etc.      │                                          │                           │
│                            │                                          │                           │
│ [3] Admin edits template:  │                                          │                           │
│   PUT /admin/prompts/      │                                          │                           │
│   stage5_synthesize        │                                          │                           │
│   {templateText:"...",     │                                          │                           │
│    description:"Updated    │                                          │                           │
│      to add GDPR section"} │                                          │                           │
│       └──────────────────> │                                          │                           │
│                            │ [4] UPSERT prompt_templates WHERE        │                           │
│                            │   stage="stage5_synthesize":             │                           │
│                            │     template_text = newText              │                           │
│                            │     version++ (e.g. 3→4)                 │                           │
│                            │     updated_at = now()                   │                           │
│                            │   Return {stage, version:4, updatedAt}   │                           │
│ <──────────────────────────┤                                          │                           │
│ [5] Admin notified:        │                                          │                           │
│   "Changes live in ~60s"   │                                          │                           │
│                            │                                          │                           │
│                            │                                          │ [6] Next elicitation:     │
│                            │                                          │   prompt_service.py:      │
│                            │                                          │   cache entry stale       │
│                            │                                          │   (>60s since last fetch) │
│                            │                                          │   GET /internal/prompts/  │
│                            │                  ┌─────────────────────  │ stage5_synthesize         │
│                            │ [7] GET /internal/prompts/:stage         │                           │
│                            │   Header: X-Internal-Token               │                           │
│                            │   Validates shared secret                │                           │
│                            │   SELECT prompt_templates WHERE          │                           │
│                            │     stage=?                              │                           │
│                            │   IF found → Return {templateText}       │                           │
│                            │   IF not found → 404                     │                           │
│                            │   (FastAPI falls back to .txt file)      │                           │
│                            │                  └───────────────────── >                            │
│                            │                                          │ [8] Cache updated         │
│                            │                                          │   New template used for   │
│                            │                                          │   ALL subsequent synthesis│
│                            │                                          │   calls                   │
│                            │                                          │                           │
│ [9] RESET to default:      │                                          │                           │
│   DELETE /admin/prompts/   │                                          │                           │
│   stage5_synthesize        │                                          │                           │
│       └──────────────────> │                                          │                           │
│                            │ [10] DELETE prompt_templates WHERE       │                           │
│                            │   stage="stage5_synthesize"              │                           │
│                            │   ← next GET /internal call → 404        │                           │
│                            │   FastAPI falls back to .txt file        │                           │
│ <──────────────────────────┤                                          │                           │
└────────────────────────────┴──────────────────────────────────────────┴───────────────────────────┘
```

---

# MF-19: Admin Subscription Package Management

## Overview

Admin creates, edits, deactivates, and hard-deletes subscription packages. FE always fetches live prices from `GET /config/subscription-packages` — never hardcodes 500,000/300,000 VND. Price changes take effect immediately for new activations.

**Tables touched (2):** `subscription_packages`, `subscription_purchase_logs`

**Endpoints:** `GET/POST/PUT/DELETE /admin/subscriptions/packages`

---

## ASCII Swimlane

```
┌─────────────────────────────┬──────────────────────────────────────────────────────┐
│            ADMIN            │          SYSTEM (NestJS)                             │
├─────────────────────────────┼──────────────────────────────────────────────────────┤
│ [1] GET /admin/subscriptions│                                                      │
│   /packages                 │                                                      │
│   → ALL packages            │                                                      │
│     (active + inactive)     │                                                      │
│                             │ SELECT subscription_packages (no filter)             │
│                             │ ← Different from GET /config/subscription-packages   │
│                             │   which filters to is_active=true only               │
│                             │                                                      │
│ [2] POST /admin/            │                                                      │
│   subscriptions/packages    │                                                      │
│   {role:"CLIENT",           │                                                      │
│    name:"Client Pro Monthly"│                                                      │
│    priceVnd:100000,         │                                                      │
│    durationMonths:1}        │                                                      │
│       └───────────────────> │                                                      │
│                             │ INSERT subscription_packages {is_active:true}        │
│                             │ EFFECT: GET /config/subscription-packages?role=CLIENT│
│                             │   now returns this new package                       │
│                             │   CEO can activate it immediately                    │
│                             │                                                      │
│ [3] PUT /admin/subscriptions│                                                      │
│   /packages/:id             │                                                      │
│   {priceVnd:120000,         │                                                      │
│    isActive:false}          │                                                      │
│       └───────────────────> │                                                      │
│                             │ UPDATE subscription_packages SET priceVnd=120000,    │
│                             │   is_active=false                                    │
│                             │ EFFECT: isActive=false → disappears from public      │
│                             │   endpoint; existing subscribers unaffected          │
│                             │   New activations at 120,000 VND (if re-activated)   │
│                             │                                                      │
│ [4] DELETE /admin/          │                                                      │
│   subscriptions/packages/:id│                                                      │
│       └───────────────────> │                                                      │
│                             │ CHECK: SELECT COUNT FROM                             │
│                             │   subscription_purchase_logs WHERE package_id=?      │
│                             │   IF >0 → 422 "Cannot delete — N purchase            │
│                             │     record(s). Deactivate instead."                  │
│                             │   IF 0 → DELETE subscription_packages                │
└─────────────────────────────┴──────────────────────────────────────────────────────┘
```

---

# MF-20: Admin Dispute Manual Resolution

See MF-8 Steps 4b–11 for the full swimlane. Admin-specific flow:

**Endpoints:** `GET /admin/disputes`, `PUT /admin/disputes/:id/resolve`, `GET /disputes/:id`, `GET /engagements/:id/messages`

| Step | Admin Action | NestJS Effect | Tables |
|---|---|---|---|
| View queue | `GET /admin/disputes?state=MANUAL_REVIEW` | Returns disputes with `reasoning` + `llm_confidence` + escrow amount | `disputes` (R) |
| Read context | `GET /disputes/:id` + `GET /engagements/:id/messages` | Full dispute + engagement chat for context | `disputes` (R), `messages` (R) |
| RELEASE | `PUT /admin/disputes/:id/resolve {decision:"RELEASE"}` | Expert credited; escrow RELEASED; milestone APPROVED | `wallets` (U×3), `wallet_transactions` (C×3), `escrow_accounts` (U), `milestones` (U), `disputes` (U), `platform_decisions` (C) |
| REFUND | `{decision:"REFUND"}` | Client credited; escrow REFUNDED; milestone APPROVED | Same tables |
| SPLIT | `{decision:"SPLIT"}` | Both credited 50%; escrow SPLIT; milestone APPROVED | Same tables |

---

# MF-21: Admin User & Project Management

## Overview

Admin browses, views, suspends, and reactivates users. Views and manages projects (suspend spec, reopen). Lists all engagements.

**Tables touched (3):** `users`, `projects`, `engagements`

**Key changes from old doc:** (1) `GET /admin/users` with search/filter (new). (2) `GET /admin/users/:id` (new). (3) `PUT /admin/users/:id/reactivate` (new — was only suspend before). (4) `GET /admin/projects` with filter (new). (5) `GET /admin/projects/:id` (new). (6) `GET /admin/engagements` (new). (7) `PUT /admin/projects/:id/reopen` (new).

**Endpoints:** `GET /admin/users`, `GET /admin/users/:id`, `PUT /admin/users/:id/suspend`, `PUT /admin/users/:id/reactivate`, `GET /admin/experts`, `GET /admin/projects`, `GET /admin/projects/:id`, `PUT /admin/projects/:id/suspend-spec`, `PUT /admin/projects/:id/reopen`, `GET /admin/engagements`

---

## ASCII Swimlane

```
┌─────────────────────────────────┬──────────────────────────────────────────────────┐
│              ADMIN              │          SYSTEM (NestJS)                         │
├─────────────────────────────────┼──────────────────────────────────────────────────┤
│ ══ USER MANAGEMENT [NEW] ═══════│                                                  │
│ [1] GET /admin/users            │                                                  │
│   ?role=EXPERT                  │                                                  │
│   &isActive=true                │                                                  │
│   &search=albert                │                                                  │
│       └───────────────────────> │                                                  │
│                                 │ SELECT users WHERE {filters}                     │
│                                 │ Return [{id,email,fullName,roles,                │
│                                 │   subscription_tiers,isActive,createdAt}]        │
│ <───────────────────────────────┤                                                  │
│                                 │                                                  │
│ [2] GET /admin/users/:id        │                                                  │
│       └───────────────────────> │                                                  │
│                                 │ SELECT users + wallet + client_profiles          │
│                                 │   + expert_profiles                              │
│                                 │ Return full user detail with wallet balances     │
│ <───────────────────────────────┤                                                  │
│                                 │                                                  │
│ [3] PUT /admin/users/:id/       │                                                  │
│   suspend                       │                                                  │
│       └───────────────────────> │                                                  │
│                                 │ UPDATE users SET is_active=false                 │
│                                 │ EFFECT: existing JWTs rejected on next request   │
│                                 │   Escrow stays HELD (not auto-released)          │
│                                 │                                                  │
│ [4] PUT /admin/users/:id/       │                                                  │
│   reactivate [NEW]              │                                                  │
│       └───────────────────────> │                                                  │
│                                 │ UPDATE users SET is_active=true                  │
│                                 │ EFFECT: user can log in again                    │
│                                 │                                                  │
│ [5] GET /admin/experts [NEW]    │                                                  │
│       └───────────────────────> │                                                  │
│                                 │ SELECT users + expert_seam_claims                │
│                                 │   + expert_domain_depths                         │
│                                 │   WHERE roles CONTAINS 'EXPERT'                  │
│ <───────────────────────────────┤                                                  │
│                                 │                                                  │
│ ══ PROJECT MANAGEMENT [EXPANDED]═│                                                 │
│ [6] GET /admin/projects         │                                                  │
│   ?state=PUBLISHED&archetype=3  │                                                  │
│       └───────────────────────> │                                                  │
│                                 │ SELECT projects + {filters}                      │
│                                 │ Return [{id,projectName,state,archetype,tier,    │
│                                 │   createdAt,clientId}]                           │
│ <───────────────────────────────┤                                                  │
│                                 │                                                  │
│ [7] GET /admin/projects/:id     │                                                  │
│   [NEW]                         │                                                  │
│       └───────────────────────> │                                                  │
│                                 │ SELECT projects JOIN client, tech_team_profiles  │
│                                 │   + invitation count                             │
│                                 │ Return full project detail                       │
│ <───────────────────────────────┤                                                  │
│                                 │                                                  │
│ [8] Emergency suspend:          │                                                  │
│   PUT /admin/projects/:id/      │                                                  │
│   suspend-spec                  │                                                  │
│       └───────────────────────> │                                                  │
│                                 │ Guard: state=PUBLISHED                           │
│                                 │ UPDATE projects SET state="SUSPENDED"            │
│                                 │ INSERT platform_decisions {SPEC_AUTO_RETURN,     │
│                                 │   advisory_note:admin_reason}                    │
│                                 │ Notify CEO: "Spec suspended by admin"            │
│                                 │                                                  │
│ [9] Reopen project [NEW]:       │                                                  │
│   PUT /admin/projects/:id/      │                                                  │
│   reopen                        │                                                  │
│       └───────────────────────> │                                                  │
│                                 │ Guard: state=SUSPENDED                           │
│                                 │ UPDATE projects SET state="PUBLISHED"            │
│                                 │                                                  │
│ [10] GET /admin/engagements     │                                                  │
│   [NEW]                         │                                                  │
│   ?state=ACTIVE&projectId=:id   │                                                  │
│       └───────────────────────> │                                                  │
│                                 │ SELECT engagements JOIN projects, users          │
│                                 │ Return with project name + expert + milestone cnt│
└─────────────────────────────────┴──────────────────────────────────────────────────┘
```

---

# MF-22: Config Bootstrap & Reference Data

## Overview

FE fetches all configuration in one call on app mount. Eliminates 5 separate round trips. All dropdown values, filter options, and price displays are populated from this single response. Admin changes take effect on next FE page load.

**Endpoints:** `GET /config/all`, `GET /config/domains`, `GET /config/seams`, `GET /config/archetypes`, `GET /config/void-codes`, `GET /config/subscription-packages`

---

## ASCII Swimlane

```
┌─────────────────────────────┬────────────────────────────────────────────────────────┐
│      FE APPLICATION         │          SYSTEM (NestJS)                               │
├─────────────────────────────┼────────────────────────────────────────────────────────┤
│ [1] On app mount:           │                                                        │
│   GET /config/all [NEW]     │                                                        │
│       └───────────────────> │                                                        │
│                             │ [2] Promise.all([                                      │
│                             │   SELECT domain_definitions WHERE is_active=true,      │
│                             │   SELECT seam_definitions WHERE is_active=true,        │
│                             │   SELECT archetype_definitions WHERE is_active=true,   │
│                             │   SELECT void_code_definitions WHERE is_active=true,   │
│                             │   SELECT subscription_packages WHERE is_active=true    │
│                             │ ])                                                     │
│                             │ Return {                                               │
│                             │   domains:[{code,name,sortOrder},...],                 │
│                             │   seams:[{code:"A↔C",name,...},...],                   │
│                             │   archetypes:[{code:"1",name,...},...],                │
│                             │   voidCodes:[{code,name,description,severity},...],    │
│                             │   subscriptionPackages:[{id,role,name,priceVnd,...}]   │
│                             │ }                                                      │
│ <───────────────────────────┤                                                        │
│ [3] FE stores in context:   │                                                        │
│   domainsMap: {A:name,B:..} │                                                        │
│   seamsMap: {A↔C:name,...}  │                                                        │
│   archetypeMap: {1:name,...}│                                                        │
│   voidCodesMap: {code:desc} │                                                        │
│   clientPackages: [...]     │                                                        │
│   expertPackages: [...]     │                                                        │
│                             │                                                        │
│ Used for:                   │                                                        │
│   Stage 2: archetype cards  │                                                        │
│   Stage 2: void descriptions│                                                        │
│   Stage 3: (fetch per-arch  │                                                        │
│     probe questions separately│                                                      │
│     GET /config/archetypes/ │                                                        │
│     :code/probe-questions)  │                                                        │
│   Stage 4: show critical    │                                                        │
│     artifact labels         │                                                        │
│   BidForm: domain/seam opts │                                                        │
│   Subscription page: prices │                                                        │
│     + package IDs           │                                                        │
└─────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## Appendix — Complete Endpoint Reference (213 Endpoints)

### Auth & Account

| Method | Endpoint | Auth | Gate | Notes |
|---|---|---|---|---|
| POST | `/auth/register` | None | — | Email normalized; password errors as array |
| POST | `/auth/login` | None | — | Returns tokens + user |
| POST | `/auth/refresh` | None | — | Validates refresh_token_hash |
| POST | `/auth/logout` | JWT | — | **[NEW]** Clears refresh_token_hash |
| PUT | `/auth/switch-role` | JWT | — | Reissues JWT with new activeRole |
| POST | `/auth/register/handoff` | None | — | Requires valid handoff JWT; sets linked_project_id if published |
| POST | `/auth/claim-handoff` | JWT | — | **[NEW]** Existing user claims handoff link |
| POST | `/auth/forgot-password` | None | — | **[NEW]** Anti-enumeration; always same response |
| GET | `/auth/verify-reset-token/:token` | None | — | **[NEW]** Call on page mount before showing form |
| POST | `/auth/reset-password` | None | — | **[NEW]** Clears refresh_token_hash |
| PUT | `/auth/me/password` | JWT | — | **[NEW]** Change while logged in; clears sessions |
| GET | `/users/me` | JWT | — | Own user + profile |
| PUT | `/users/me` | JWT | — | Update name/phone/bio |
| DELETE | `/users/me` | JWT | — | **[NEW]** Deactivate; guard: no active engagements |
| POST | `/users/me/add-role` | JWT | — | Add EXPERT or CEO role |
| GET | `/users/experts` | JWT | CLIENT | **[NEW]** Browse expert users |
| GET | `/users/:userId/public-profile` | JWT | — | Public profile |
| PUT | `/users/me/tax-code` | JWT | — | VietQR business lookup |
| POST | `/bank-hub/initiate-link` | JWT | — | SePay Bank Hub hosted link |

### Wallets & Subscriptions

| Method | Endpoint | Auth | Gate | Notes |
|---|---|---|---|---|
| GET | `/wallets/me` | JWT | — | Balance as strings (BigInt) |
| GET | `/wallets/me/transactions` | JWT | — | **[UPDATED]** ?type=&limit=&offset= pagination |
| POST | `/wallets/virtual-accounts/topup` | JWT | — | Returns VietQR |
| POST | `/withdrawals` | JWT | EXPERT | Chi hộ fires async |
| GET | `/withdrawals` | JWT | EXPERT | Own withdrawal history |
| DELETE | `/withdrawals/:id` | JWT | EXPERT | **[NEW]** Cancel PENDING; refunds wallet |
| GET | `/subscriptions/status` | JWT | — | Trust tier from API; no FE date math |
| POST | `/subscriptions/activate` | JWT | — | **BREAKING:** packageId now required |
| GET | `/subscriptions/history` | JWT | — | **[NEW]** Past purchases with isExpired |

### Config / Reference Data

| Method | Endpoint | Auth | Gate | Notes |
|---|---|---|---|---|
| GET | `/config/all` | None | — | **[NEW]** All config in one call |
| GET | `/config/domains` | None | — | **[NEW]** From domain_definitions table |
| GET | `/config/seams` | None | — | **[NEW]** From seam_definitions; ↔ arrows |
| GET | `/config/archetypes` | None | — | **[NEW]** From archetype_definitions |
| GET | `/config/archetypes/:code/probe-questions` | None | — | **[NEW]** From probe_questions table |
| GET | `/config/void-codes` | None | — | **[NEW]** From void_code_definitions |
| GET | `/config/subscription-packages` | None | — | **[NEW]** ?role=CLIENT|EXPERT |

### Elicitation

| Method | Endpoint | Auth | Gate | Notes |
|---|---|---|---|---|
| POST | `/elicitation/sessions` | JWT | — | Create/resume session |
| GET | `/elicitation/sessions` | JWT | — | **[NEW]** List all sessions |
| GET | `/elicitation/sessions/active` | JWT | — | Get active session |
| GET | `/elicitation/sessions/:id` | JWT | Pro-C | Full session detail |
| PATCH | `/elicitation/sessions/:id/draft` | JWT | Pro-C | Auto-save Stage 1 draft |
| PUT | `/elicitation/sessions/:id/stage1` | JWT | Pro-C | **[UPDATED]** critical_artifacts_json in response |
| PUT | `/elicitation/sessions/:id/stage2` | JWT | Pro-C | **[UPDATED]** Archetype from archetype_definitions |
| PUT | `/elicitation/sessions/:id/stage3` | JWT | Pro-C | **[UPDATED]** Returns irrelevant_answers; advisory only |
| PATCH | `/elicitation/sessions/:id/stage4-draft` | JWT | Pro-C | **[NEW]** Auto-save Stage 4; no LLM |
| PUT | `/elicitation/sessions/:id/stage4` | JWT | Pro-C | **[UPDATED]** technical_artifacts; missingArtifacts response |
| PUT | `/elicitation/sessions/:id/stage4-handoff` | JWT | — | **[UPDATED]** TECH_TEAM; technical_artifacts |
| POST | `/elicitation/sessions/:id/stage4-recommend` | JWT | Pro-C | AI suggest tech stack |
| POST | `/elicitation/sessions/:id/stage5` | JWT | Pro-C | Triggers synthesis |
| POST | `/elicitation/sessions/:id/generate-handoff-link` | JWT | Pro-C | 72h JWT link |
| PUT | `/elicitation/sessions/:id/self-technical` | JWT | Pro-C | Set self_technical flag |
| PUT | `/elicitation/sessions/:id/revert` | JWT | Pro-C | Revert to specific stage |
| PUT | `/elicitation/sessions/:id/continue` | JWT | Pro-C | Resume from current |
| PUT | `/elicitation/sessions/:id/abandon` | JWT | — | Abandon session |
| DELETE | `/elicitation/sessions/:id` | JWT | — | **[NEW]** Delete session |
| POST | `/elicitation/sessions/:id/retry-synthesis` | JWT | Pro-C | Retry failed synthesis |

### Projects & Matching

| Method | Endpoint | Auth | Gate | Notes |
|---|---|---|---|---|
| GET | `/projects` | JWT | — | Role-scoped list |
| GET | `/projects/:id` | JWT | — | **[UPDATED]** Includes domains/seams/milestones/cost estimates |
| GET | `/projects/:id/artifact-a` | JWT | — | Artifact A JSON |
| GET | `/projects/:id/artifact-b` | JWT | — | CEO→403 always |
| PUT | `/projects/:id/name` | JWT | CEO | Update project name |
| GET | `/projects/:id/engagements` | JWT | CEO | **[NEW]** List engagements |
| GET | `/projects/:id/milestones` | JWT | — | **[NEW]** List project milestones |
| GET | `/projects/:id/invitations` | JWT | CEO | **[NEW]** Invitations for project |
| GET | `/projects/:id/team` | JWT | CEO | **[NEW]** Assigned tech team |
| PUT | `/projects/:id/cancel` | JWT | CEO | **[NEW]** Guard: no active engagements |
| GET | `/projects/:id/messages` | JWT | — | Pre-bid project chat |
| GET | `/projects/:id/messages/unread-count` | JWT | — | **[NEW]** Unread badge |
| POST | `/projects/:id/milestone-chat` | JWT | — | **[NEW]** Chat assistant |
| GET | `/projects/:id/milestone-chat/sessions` | JWT | — | **[NEW]** Chat session list |
| GET | `/projects/:id/milestone-chat/sessions/:sessionId` | JWT | — | **[NEW]** Restore thread |
| GET | `/matching/:projectId/shortlist` | JWT | CEO | 3-5 match cards |

### Invitations

| Method | Endpoint | Auth | Gate | Notes |
|---|---|---|---|---|
| GET | `/invitations` | JWT | EXPERT | **[NEW]** Expert's invitations with ceo.clientProfile.companyName |
| POST | `/invitations/:id/decline` | JWT | EXPERT | **[NEW]** |
| GET | `/invitations/sent` | JWT | CEO | **[NEW]** All invitations CEO sent |
| DELETE | `/invitations/:id` | JWT | CEO | **[NEW]** Retract; blocked if ACCEPTED |

### Expert Profiles

| Method | Endpoint | Auth | Gate | Notes |
|---|---|---|---|---|
| GET | `/expert-profile/me` | JWT | EXPERT | Profile + domains + seams |
| PUT | `/expert-profile/me` | JWT | EXPERT | engagementModel, stackTags, archetypeHistory |
| GET | `/expert-profile/me/domains` | JWT | EXPERT | **[NEW]** Own domain depths |
| GET | `/expert-profile/me/seams` | JWT | EXPERT | **[NEW]** Own seam claims |
| GET | `/expert-profile/search` | JWT | — | **[NEW]** Search by domain/seam/archetype |
| GET | `/expert-profile/:userId` | JWT | — | **[NEW]** Public expert profile |
| POST | `/expert-profile/domains` | JWT | EXPERT | code is ANY string (not hardcoded enum) |
| PUT | `/expert-profile/domains/sync` | JWT | EXPERT | Atomic bulk sync |
| PUT | `/expert-profile/domains/:id` | JWT | EXPERT | Update single depth |
| DELETE | `/expert-profile/domains/:id` | JWT | EXPERT | **[NEW]** |
| POST | `/expert-profile/seams` | JWT | EXPERT | seamCode MUST use ↔ arrow |
| PUT | `/expert-profile/seams/sync` | JWT | EXPERT | Bulk sync |
| POST | `/portfolio-submissions` | JWT | Pro-E | Seam defs from DB now |
| GET | `/portfolio-submissions` | JWT | EXPERT | List submissions |
| GET | `/portfolio-submissions/:id` | JWT | — | Submission detail |
| GET | `/portfolio-submissions/me/portfolio/:id` | JWT | EXPERT | **[NEW]** |
| DELETE | `/portfolio-submissions/me/portfolio/:id` | JWT | EXPERT | **[NEW]** |

### Bids & Engagements

| Method | Endpoint | Auth | Gate | Notes |
|---|---|---|---|---|
| POST | `/bids` | JWT | Pro-E | **[UPDATED]** Domain/seam codes DB-driven; A<->C rejected |
| GET | `/bids` | JWT | — | **[NEW]** Role-scoped: Expert sees own, CEO sees project bids |
| GET | `/bids/:id` | JWT | — | Bid detail |
| PUT | `/bids/:id` | JWT | EXPERT | Revise when REVISION_REQUESTED |
| DELETE | `/bids/:id` | JWT | EXPERT | **[NEW]** Withdraw when SUBMITTED |
| PUT | `/bids/:id/tech-review` | JWT | TECH_TEAM | APPROVED or REVISION_REQUESTED |
| PUT | `/bids/:id/counter-offer` | JWT | CEO | One round; immutable after first set |
| PUT | `/bids/:id/ceo-decision` | JWT | CEO | APPROVED or DECLINED |
| GET | `/engagements` | JWT | — | Role-scoped; now includes project metadata |
| GET | `/engagements/:id` | JWT | — | Full engagement detail |
| PUT | `/engagements/:id/accept-nda` | JWT | CEO | CEO NDA step |
| POST | `/engagements/:id/connect` | JWT | EXPERT | Expert accepts + NDA |
| PUT | `/engagements/:id/decline` | JWT | EXPERT | Expert declines |
| GET | `/engagements/:id/bid` | JWT | — | **[NEW]** Bid that created engagement |
| GET | `/engagements/:id/milestones` | JWT | — | **[NEW]** All milestones |
| GET | `/engagements/:id/submissions` | JWT | — | **[NEW]** All submissions |
| GET | `/engagements/:id/disputes` | JWT | — | **[NEW]** All disputes |
| PUT | `/engagements/:id/cancel` | JWT | — | **[NEW]** Guard: no funded milestones |

### Milestones, Criteria & DoD

| Method | Endpoint | Auth | Gate | Notes |
|---|---|---|---|---|
| POST | `/milestones` | JWT | CEO | Create with criteria |
| GET | `/milestones/:id` | JWT | — | Milestone detail |
| PATCH | `/milestones/:id` | JWT | CEO | **[NEW]** Edit; DEFINED state only |
| DELETE | `/milestones/:id` | JWT | CEO | **[NEW]** Delete; DEFINED state only |
| GET | `/milestones` | JWT | — | **[NEW]** ?engagementId= |
| PUT | `/milestones/:id/fund` | JWT | CEO | Creates 24h VA; returns QR |
| GET | `/milestones/:id/submissions` | JWT | — | **[NEW]** Submission history |
| GET | `/milestones/:id/submissions/latest` | JWT | — | **[NEW]** Most recent submission |
| GET | `/milestones/:id/disputes` | JWT | — | **[NEW]** Disputes for milestone |
| POST | `/milestones/:id/submit` | JWT | EXPERT | DoD gate enforced |
| POST | `/milestones/:id/dod/items` | JWT | EXPERT | Create DoD item |
| PUT | `/milestones/:id/dod/:itemId` | JWT | EXPERT | COMPLETED or NOT_APPLICABLE |
| GET | `/milestones/:id/dod` | JWT | — | **[NEW]** List DoD items |
| DELETE | `/milestones/:id/dod/:itemId` | JWT | EXPERT | **[NEW]** Delete PENDING only |
| POST | `/milestones/:id/paygated-docs` | JWT | EXPERT | STAGED until IPN |
| GET | `/milestones/:id/paygated-docs` | JWT | — | CEO→403 |
| GET | `/criteria/:milestoneId` | JWT | — | **[NEW]** List criteria |
| POST | `/criteria/:milestoneId` | JWT | CEO | **[NEW]** Add criterion |
| PUT | `/criteria/:id/verify` | JWT | CLIENT | Approve criterion |
| PUT | `/criteria/:id/revision` | JWT | CLIENT | Reject with note |
| DELETE | `/criteria/:id` | JWT | CEO | **[NEW]** |

### Disputes, Reviews, Messages, Notifications

| Method | Endpoint | Auth | Gate | Notes |
|---|---|---|---|---|
| POST | `/disputes` | JWT | — | Freezes escrow; triggers LLM |
| GET | `/disputes` | JWT | — | Role-scoped |
| GET | `/disputes/:id` | JWT | — | **[UPDATED]** Includes reasoning field |
| POST | `/disputes/:id/evidence` | JWT | — | **[NEW]** Submit additional evidence |
| PUT | `/disputes/:id/withdraw` | JWT | — | **[NEW]** Filer retracts; unfreezes escrow |
| POST | `/reviews` | JWT | — | One per engagement per reviewer |
| GET | `/reviews/me` | JWT | — | **[NEW]** Reviews I've given |
| GET | `/reviews/me/received` | JWT | — | **[NEW]** Reviews I've received |
| GET | `/reviews/users/:userId` | JWT | — | **[NEW]** Reviews for a user |
| GET | `/conversations` | JWT | — | **[NEW]** All threads with last msg + unread |
| GET | `/engagements/:id/messages` | JWT | — | Engagement chat |
| GET | `/engagements/:id/messages/unread-count` | JWT | — | Unread badge |
| GET | `/notifications/me` | JWT | — | **[NEW]** REST fallback; persisted |
| GET | `/notifications/me/unread-count` | JWT | — | **[NEW]** Nav badge |
| PUT | `/notifications/:id/read` | JWT | — | **[NEW]** |
| PUT | `/notifications/read-all` | JWT | — | **[NEW]** |
| DELETE | `/notifications/:id` | JWT | — | **[NEW]** |
| POST | `/messages/:id/read` | JWT | — | Mark message read |

### Services (Listings)

| Method | Endpoint | Auth | Gate | Notes |
|---|---|---|---|---|
| GET | `/services` | JWT | — | **[UPDATED]** domain/seam filter accepts any string |
| GET | `/services/:id` | JWT | — | Service detail |
| POST | `/services` | JWT | EXPERT | **[UPDATED]** AI gen uses expert context + DB prices |
| PUT | `/services/:id` | JWT | EXPERT | Update or change state |
| PUT | `/services/:id/publish` | JWT | EXPERT | **[NEW]** DRAFT→PUBLISHED |
| PUT | `/services/:id/unpublish` | JWT | EXPERT | **[NEW]** PUBLISHED→DRAFT |
| DELETE | `/services/:id` | JWT | EXPERT | **[NEW]** DRAFT only |
| GET | `/services/me` | JWT | EXPERT | **[NEW]** Own listings all states |
| GET | `/services/me/purchases` | JWT | CEO | **[NEW]** Purchased services |
| POST | `/services/:id/purchase` | JWT | CEO | Creates engagement + 24h VA |

### Admin

| Method | Endpoint | Auth | Gate | Notes |
|---|---|---|---|---|
| GET | `/admin/users` | JWT | ADMIN | **[NEW]** ?role=&isActive=&search= |
| GET | `/admin/users/:id` | JWT | ADMIN | **[NEW]** Full detail + wallet |
| PUT | `/admin/users/:id/suspend` | JWT | ADMIN | is_active=false |
| PUT | `/admin/users/:id/reactivate` | JWT | ADMIN | **[NEW]** is_active=true |
| GET | `/admin/experts` | JWT | ADMIN | **[NEW]** With seam verification tiers |
| GET | `/admin/projects` | JWT | ADMIN | **[NEW]** ?state=&archetype= |
| GET | `/admin/projects/:id` | JWT | ADMIN | **[NEW]** Full detail |
| PUT | `/admin/projects/:id/suspend-spec` | JWT | ADMIN | PUBLISHED→SUSPENDED |
| PUT | `/admin/projects/:id/reopen` | JWT | ADMIN | **[NEW]** SUSPENDED→PUBLISHED |
| GET | `/admin/engagements` | JWT | ADMIN | **[NEW]** ?state=&projectId= |
| GET | `/admin/disputes` | JWT | ADMIN | ?state=MANUAL_REVIEW |
| PUT | `/admin/disputes/:id/resolve` | JWT | ADMIN | RELEASE/REFUND/SPLIT |
| GET | `/admin/decisions` | JWT | ADMIN | ?decisionType= |
| GET | `/admin/transactions` | JWT | ADMIN | Full ledger |
| GET | `/admin/analytics` | JWT | ADMIN | Computed aggregates |
| GET | `/admin/withdrawals` | JWT | ADMIN | ?status= |
| PUT | `/admin/withdrawals/:id/complete` | JWT | ADMIN | Marks COMPLETED |
| PUT | `/admin/withdrawals/:id/fail` | JWT | ADMIN | Marks FAILED; refunds wallet |
| GET/POST/PUT/DELETE | `/admin/config/domains` | JWT | ADMIN | **[NEW]** Domain CMS |
| GET/POST/PUT/DELETE | `/admin/config/seams` | JWT | ADMIN | **[NEW]** Seam CMS |
| GET/POST/PUT/DELETE | `/admin/config/archetypes` | JWT | ADMIN | **[NEW]** Archetype CMS |
| GET/POST/PUT/DELETE | `/admin/config/probe-questions` | JWT | ADMIN | **[NEW]** Probe Q CMS |
| GET/POST/PUT/DELETE | `/admin/config/void-codes` | JWT | ADMIN | **[NEW]** Void code CMS |
| GET/POST/PUT/DELETE | `/admin/subscriptions/packages` | JWT | ADMIN | **[NEW]** Package CMS |
| GET | `/admin/prompts` | JWT | ADMIN | **[NEW]** List prompt metadata |
| GET | `/admin/prompts/:stage` | JWT | ADMIN | **[NEW]** Full template text |
| PUT | `/admin/prompts/:stage` | JWT | ADMIN | **[NEW]** Create/update; 60s live |
| DELETE | `/admin/prompts/:stage` | JWT | ADMIN | **[NEW]** Reset to .txt file |

### Webhooks & Internal

| Method | Endpoint | Auth | Gate | Notes |
|---|---|---|---|---|
| POST | `/webhooks/sepay/ipn` | HMAC | — | WALLET_TOPUP / MILESTONE / SERVICE branches |
| POST | `/webhooks/sepay/chi-ho-credit` | SePay | — | Withdrawal completed |
| POST | `/webhooks/sepay/bank-linked` | SePay | — | Bank account linked |
| GET | `/internal/prompts/:stage` | X-Token | — | FastAPI fetches prompt from DB |