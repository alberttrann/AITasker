# E2E QA Test Plan

## 1. Test Environments & Preconditions
- **Test Environments:** Docker setups (isolated vs full UI) and observability tools (Prisma Studio, DevTools, DB logs).
- **Universal Checks:** Baseline checks that must pass on *every* screen (e.g., JWT validation, role-guards, UI feedback, double-submission prevention).
- **Cross-actor visibility:** Other involved actors receive the right notification/socket update and see the new state after refresh.
- **Data Seeds:** Ensure you have the correct persona (e.g. CEO-A, EXP-B) seeded in the database before starting the flow.

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

