# AITasker MVP — 18 Main Flows (Scope-Reduced · 28 Tables)
### Cross-Table CRUD Grounding · State Machines · Endpoint Mapping

> **Purpose:** Definitive flow reference grounded directly against the running `backend/src/` code, `prisma/schema.prisma`, and `ai-service/` as of 2026-06-26. Every step traces to a real controller, service method, DTO, or SQL migration.  
> **Conventions:** `[LEDGER]` = wallet_transactions row written. `[API]` = external service call. Tables in **bold** on first reference. `[Pro-C]` / `[Pro-E]` = Client Pro / Expert Pro subscription gate enforced by `SubscriptionGuard`.

---

## Group 1 — Onboarding & Account Setup

---

# MF-1: Client (CEO) Registration & Subscription

## Overview

Registers a CLIENT/CEO account. On `POST /auth/register`, the system atomically creates `users`, `client_profiles`, `wallets`, and one `virtual_accounts` row (entity_type=WALLET_TOPUP) **using an internal VA number generator — no SePay call is made at registration time**. Subscription activation is a pure internal wallet deduction. References: §0.7 (RBAC), §0.8 (Payment Architecture).

**Tables touched (5):** `users`, `client_profiles`, `wallets`, `virtual_accounts`, `wallet_transactions`

**Endpoints:** `POST /auth/register`, `POST /wallets/virtual-accounts/topup`, `POST /webhooks/sepay/ipn`, `POST /subscriptions/activate`, `GET /subscriptions/status`, `GET /wallets/me`

---

## ASCII Swimlane

```
┌───────────────────────────────────┬────────────────────────────────────────┬──────────────────────────────────┐
│        CLIENT / CEO (User)        │       SYSTEM (NestJS)                  │         SePay / Bank             │
├───────────────────────────────────┼────────────────────────────────────────┼──────────────────────────────────┤
│ ═════ PHASE A: REGISTRATION ═════ │                                        │                                  │
│                                   │                                        │                                  │
│ [1] Opens /register               │                                        │                                  │
│     Selects "I need AI help"      │                                        │                                  │
│                                   │                                        │                                  │
│ [2] Fills form: email, password,  │                                        │                                  │
│     fullName, phone (opt),        │                                        │                                  │
│     roles:"CLIENT_CEO",           │                                        │                                  │
│     selfTechnical (opt bool),     │                                        │                                  │
│     taxCode (opt string)          │                                        │                                  │
│     [Submit]                      │                                        │                                  │
│       └──────────────────────────>│                                        │                                  │
│                                   │ [3] POST /auth/register                │                                  │
│                                   │     Validate: email unique,            │                                  │
│                                   │     strong password, etc.              │                                  │
│                                   │     IF taxCode → async GET             │                                  │
│                                   │       api.vietqr.io/v2/business/{code} │                                  │
│                                   │       → auto-fill companyName on       │                                  │
│                                   │         client_profiles if code='00'   │                                  │
│                                   │                   │                    │                                  │
│                                   │ [4] DB TX (atomic):                    │                                  │
│                                   │     INSERT users:                      │                                  │
│                                   │       roles: ["CLIENT_CEO"]            │                                  │
│                                   │       active_role: "CLIENT"            │                                  │
│                                   │       client_subtype: "CEO"            │                                  │
│                                   │       subscription_client_tier:"free"  │                                  │
│                                   │       subscription_expert_tier:"free"  │                                  │
│                                   │       self_technical: false (default)  │                                  │
│                                   │     INSERT client_profiles: {user_id}  │                                  │
│                                   │     INSERT wallets:                    │                                  │
│                                   │       {user_id, available:0, locked:0} │                                  │
│                                   │     INSERT virtual_accounts:           │                                  │
│                                   │       entity_type: "WALLET_TOPUP"      │                                  │
│                                   │       entity_id: user_id               │                                  │
│                                   │       va_number: generateVaNumber()    │                                  │
│                                   │         ← local generator, NO SePay    │                                  │
│                                   │       fixed_amount: NULL               │                                  │
│                                   │       expires_at: NULL (permanent)     │                                  │
│                                   │       status: "ACTIVE"                 │                                  │
│                                   │     COMMIT                             │                                  │
│                                   │                   │                    │                                  │
│                                   │ [5] Sign JWT (access_token 7d) +       │                                  │
│                                   │     refresh_token (7d)                 │                                  │
│                                   │     Return {access_token,              │                                  │
│                                   │       refresh_token, user{...}}        │                                  │
│ <─────────────────────────────────┼─┘                                      │                                  │
│ [6] CEO Dashboard (free tier)     │                                        │                                  │
│     GET /wallets/me → balance=0   │                                        │                                  │
│     GET /subscriptions/status     │                                        │                                  │
│       → tier="free", expires=null │                                        │                                  │
│     All elicitation routes → 403  │                                        │                                  │
│     SUBSCRIPTION_REQUIRED         │                                        │                                  │
│                                   │                                        │                                  │
├───────────────────────────────────┼────────────────────────────────────────┼──────────────────────────────────┤
│ ══════ PHASE B: WALLET TOP-UP ════│                                        │                                  │
│                                   │                                        │                                  │
│ [7] Clicks "Top Up Wallet"        │                                        │                                  │
│     Enters amount (e.g. 500000)   │                                        │                                  │
│       └─────────────────────────>│                                         │                                  │
│                                   │ [8] POST /wallets/virtual-accounts/    │                                  │
│                                   │       topup  {amount: 500000}          │                                  │
│                                   │     SELECT virtual_accounts            │                                  │
│                                   │       WHERE entity_id=uid AND          │                                  │
│                                   │       entity_type='WALLET_TOPUP' AND   │                                  │
│                                   │       status='ACTIVE'                  │                                  │
│                                   │     va_number = vaNumber.replaceAll    │                                  │
│                                   │       ('_','')                         │                                  │
│                                   │     Return {                           │                                  │
│                                   │       qrCodeUrl: "https://qr.sepay.    │                                  │
│                                   │         vn/img?bank=MBBank&acc=...     │                                  │
│                                   │         &amount=500000&des={vaNumber}",│                                  │
│                                   │       paymentReference: vaNumber }     │                                  │
│ <─────────────────────────────────┼─┘                                      │                                  │
│ [9] Displays QR image + reference │                                        │                                  │
│     User scans and transfers      │                                        │                                  │
│     500,000 VND via banking app   │                                        │                                  │
│                                   │                                        │ [10] Bank processes transfer     │
│                                   │                                        │ [11] SePay IPN fires:            │
│                                   │      ┌<────────────────────────────────│ POST /webhooks/sepay/ipn         │
│                                   │ [12] IPN Handler:                      │   {content: "{vaNum} ...",       │
│                                   │     a. Verify HMAC signature           │    transferAmount: "500000",     │
│                                   │        (x-sepay-signature header,      │    referenceCode: "{ref}"}       │
│                                   │         5-min timestamp window)        │                                  │
│                                   │     b. Parse va_number from            │                                  │
│                                   │        content (first word)            │                                  │
│                                   │     c. SELECT virtual_accounts         │                                  │
│                                   │        WHERE va_number=?               │                                  │
│                                   │        → entity_type=WALLET_TOPUP      │                                  │
│                                   │        → entity_id=user_id             │                                  │
│                                   │     d. Idempotency check:              │                                  │
│                                   │        SELECT wallet_transactions      │                                  │
│                                   │        WHERE wallet_id=? AND           │                                  │
│                                   │        reference_id=referenceCode      │                                  │
│                                   │        IF found → 201 {already         │                                  │
│                                   │          processed} (no double credit) │                                  │
│                                   │     e. DB TX (atomic):                 │                                  │
│                                   │        UPDATE wallets SET              │                                  │
│                                   │          available_balance += 500000   │                                  │
│                                   │        INSERT wallet_transactions:     │                                  │
│                                   │          type: "TOP_UP"                │                                  │
│                                   │          amount: 500000                │                                  │
│                                   │          reference_id: referenceCode   │                                  │
│                                   │        COMMIT                          │                                  │
│                                   │     f. Return 201 {success:true}       │                                  │
│                                   │                                        │                                  │
│ [13] GET /wallets/me              │                                        │                                  │
│      → available_balance=500000   │                                        │                                  │
│                                   │                                        │                                  │
├───────────────────────────────────┼────────────────────────────────────────┼──────────────────────────────────┤
│ ════ PHASE C: SUBSCRIPTION ACT. ══│                                        │                                  │
│                                   │                                        │                                  │
│ [14] Clicks "Activate Client Pro" │                                        │                                  │
│      (500,000 VND / 6 months)     │                                        │                                  │
│        └─────────────────────────>│                                        │                                  │
│                                   │ [15] POST /subscriptions/activate      │                                  │
│                                   │      {activeRole: "CLIENT"}            │                                  │
│                                   │      Guard: user.active_role must      │                                  │
│                                   │        match activeRole in body        │                                  │
│                                   │        (409 if mismatch)               │                                  │
│                                   │      Guard: sub_client_tier='pro'      │                                  │
│                                   │        AND not expired → 409           │                                  │
│                                   │          ALREADY_SUBSCRIBED            │                                  │
│                                   │                   │                    │                                  │
│                                   │ [16] DB TX (atomic):                   │                                  │
│                                   │      SELECT wallet WHERE avail         │                                  │
│                                   │        < 500000 → 422                  │                                  │
│                                   │        INSUFFICIENT_BALANCE            │                                  │
│                                   │      UPDATE wallets SET                │                                  │
│                                   │        available_balance -= 500000     │                                  │
│                                   │      INSERT wallet_transactions:       │                                  │
│                                   │        type: "SUBSCRIPTION"            │                                  │
│                                   │        amount: 500000                  │                                  │
│                                   │        reference_id:                   │                                  │
│                                   │          "SUB-{uid}:client:{ts}"       │                                  │
│                                   │      UPDATE users SET                  │                                  │
│                                   │        subscription_client_tier='pro'  │                                  │
│                                   │        sub_client_expires_at=          │                                  │
│                                   │          now() + 6 months              │                                  │
│                                   │      COMMIT                            │                                  │
│                                   │                   │                    │                                  │
│                                   │ [17] Reissue JWT (new claims baked in) │                                  │
│                                   │      Return {access_token: "<new JWT>"}│                                  │
│ <─────────────────────────────────┼─┘                                      │                                  │
│ [18] ✓ CLIENT PRO ACTIVE          │                                        │                                  │
│      Client replaces stored token │                                        │                                  │
│      Unlocked: Elicitation,       │                                        │                                  │
│      Matching, Artifact B access  │                                        │                                  │
└───────────────────────────────────┴────────────────────────────────────────┴──────────────────────────────────┘
```

---

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | CEO | Fill registration form | — | — | — |
| 3 | NestJS | Validate input; optional VietQR tax lookup | `users` (R — uniqueness) | — | `POST /auth/register` |
| 4 | NestJS | Atomic: user + profile + wallet + VA (local generator) | `users` (C), `client_profiles` (C), `wallets` (C), `virtual_accounts` (C) | New user: roles=["CLIENT_CEO"], active_role="CLIENT", client_subtype="CEO", sub_client_tier="free" | — |
| 5 | NestJS | Sign access_token + refresh_token | — | — | — |
| 6 | CEO | Dashboard loads free tier | `wallets` (R), `users` (R) | — | `GET /wallets/me`, `GET /subscriptions/status` |
| 7-8 | CEO→NestJS | Request top-up QR; read permanent VA | `virtual_accounts` (R) | — | `POST /wallets/virtual-accounts/topup` |
| 9-11 | CEO→Bank→SePay | External bank transfer + IPN fires | — | — | External |
| 12 | NestJS | IPN: HMAC verify → parse VA → idempotency → credit wallet | `virtual_accounts` (R), `wallets` (U), `wallet_transactions` (C) | wallet.available: 0 → 500,000 | `POST /webhooks/sepay/ipn` |
| 13 | CEO | Poll wallet balance | `wallets` (R) | — | `GET /wallets/me` |
| 14-16 | CEO→NestJS | Activate subscription; debit wallet; update tier | `wallets` (U), `wallet_transactions` (C), `users` (U) | available: 500K→0; sub_client_tier: free→pro | `POST /subscriptions/activate` |
| 17-18 | NestJS→CEO | Reissue JWT; client stores new token | `users` (R) | — | — |

---

## Cross-Table CRUD Map

```
users ──(1:1)──> client_profiles     [C step 4]
users ──(1:1)──> wallets             [C step 4, R/U steps 12,16]
users           .subscription_client_tier  [R step 15 guard, U step 16]
users           .sub_client_expires_at     [U step 16]
wallets ──(1:N)──> wallet_transactions [C steps 12, 16]
virtual_accounts  .entity_id → users.id (WALLET_TOPUP, polymorphic) [C step 4, R steps 8,12]
wallet_transactions.reference_id — idempotency dedupe in step 12
```

**Critical drift from old doc:** VA number is generated locally by `generateVaNumber()` (no SePay call). `POST /wallets/virtual-accounts/topup` returns `{qrCodeUrl, paymentReference}` (not `{qr_url, va_number}`). `POST /subscriptions/activate` body is `{activeRole: "CLIENT"}` (not `{role_type: "client"}`).

---

# MF-2: Expert Registration, Profile & Tier 1→2 Verification

## Overview

Registers an EXPERT account (same atomic structure as MF-1). Expert builds their taxonomy profile via domain depth claims and seam claims (Tier 1, self-declared, `verification_tier="CLAIMED"`). Upgrades one seam at a time to Tier 2 (`EVIDENCE_BACKED`) by submitting portfolio evidence for LLM auto-evaluation. Links bank account via direct POST (no SePay Hosted Link callback in current implementation).

**Tables touched (9):** `users`, `expert_profiles`, `wallets`, `virtual_accounts`, `wallet_transactions`, `expert_domain_depths`, `expert_seam_claims`, `portfolio_submissions`, `platform_decisions`

**Endpoints:** `POST /auth/register`, `GET /expert-profile/me`, `PUT /expert-profile/me`, `POST /expert-profile/domains`, `POST /expert-profile/seams`, `POST /wallets/virtual-accounts/topup`, `POST /webhooks/sepay/ipn`, `POST /subscriptions/activate`, `POST /portfolio-submissions`, `GET /portfolio-submissions/:id`, `POST /bank-hub/initiate-link`

---

## ASCII Swimlane

```
┌───────────────────────────────────┬─────────────────────────────────────┬───────────────────────────────────┐
│           EXPERT (User)           │      SYSTEM (NestJS + FastAPI)      │         SePay / Bank              │
├───────────────────────────────────┼─────────────────────────────────────┼───────────────────────────────────┤
│ ═════ PHASE A: REGISTRATION ═════ │                                     │                                   │
│                                   │                                     │                                   │
│ [1] Opens /register               │                                     │                                   │
│     Selects "I provide AI svcs"   │                                     │                                   │
│ [2] Fills form, roles:"EXPERT"    │                                     │                                   │
│        └─────────────────────────>│                                     │                                   │
│                                   │ [3] POST /auth/register             │                                   │
│                                   │     Validate + DB TX (atomic):      │                                   │
│                                   │     INSERT users:                   │                                   │
│                                   │       roles: ["EXPERT"]             │                                   │
│                                   │       active_role: "EXPERT"         │                                   │
│                                   │       client_subtype: NULL          │                                   │
│                                   │       subscription_expert_tier:"free"│                                  │
│                                   │     INSERT expert_profiles:         │                                   │
│                                   │       {user_id, bio:NULL,           │                                   │
│                                   │        engagement_model:NULL,       │                                   │
│                                   │        stack_tags_json:[],          │                                   │
│                                   │        archetype_history_json:[]}   │                                   │
│                                   │     INSERT wallets: {user_id}       │                                   │
│                                   │     INSERT virtual_accounts:        │                                   │
│                                   │       (WALLET_TOPUP, local gen VA)  │                                   │
│                                   │     COMMIT; return JWT pair         │                                   │
│ <─────────────────────────────────┼─┘                                   │                                   │
│                                   │                                     │                                   │
├───────────────────────────────────┼─────────────────────────────────────┼───────────────────────────────────┤
│ ══════ PHASE B: PROFILE BUILD ═══ │                                     │                                   │
│                                   │                                     │                                   │
│ [4] Expert Dashboard → Profile    │                                     │                                   │
│                                   │                                     │                                   │
│ [5] Declare domain depths:        │                                     │                                   │
│     e.g. Domain A: DEEP           │                                     │                                   │
│        └─────────────────────────>│                                     │                                   │
│                                   │ [6] POST /expert-profile/domains    │                                   │
│                                   │     {domainCode:"A", depthLevel:    │                                   │
│                                   │      "DEEP"}                        │                                   │
│                                   │     UPSERT expert_domain_depths:    │                                   │
│                                   │       expert_id, domain_code:"A",   │                                   │
│                                   │       depth_level:"DEEP",           │                                   │
│                                   │       verification_tier:"CLAIMED"   │                                   │
│                                   │     Return {id, domainCode,         │                                   │
│                                   │       depthLevel, verificationTier} │                                   │
│ <─────────────────────────────────┼─┘                                   │                                   │
│                                   │                                     │                                   │
│ [7] Claim seams (repeatable):     │                                     │                                   │
│     e.g. seamCode:"A↔D"           │                                     │                                   │
│     (Unicode ↔ U+2194)            │                                     │                                   │
│        └─────────────────────────>│                                     │                                   │
│                                   │ [8] POST /expert-profile/seams      │                                   │
│                                   │     {seamCode: "A↔D"}               │                                   │
│                                   │     INSERT expert_seam_claims:      │                                   │
│                                   │       expert_id, seam_code:"A↔D",   │                                   │
│                                   │       verification_tier:"CLAIMED",  │                                   │
│                                   │       submission_count:0,           │                                   │
│                                   │       locked_until:NULL             │                                   │
│                                   │     Return {id, seamCode,           │                                   │
│                                   │       verificationTier:"CLAIMED"}   │                                   │
│ <─────────────────────────────────┼─┘                                   │                                   │
│                                   │                                     │                                   │
│ [9] Set engagement model          │                                     │                                   │
│     + stack tags:                 │                                     │                                   │
│        └─────────────────────────>│                                     │                                   │
│                                   │ [10] PUT /expert-profile/me         │                                   │
│                                   │     {engagementModel:"MILESTONE",   │                                   │
│                                   │      stackTagsJson:["Python","Go"]} │                                   │
│                                   │     UPDATE expert_profiles SET      │                                   │
│                                   │       engagement_model, stack_tags_ │                                   │
│                                   │       json, archetype_history_json  │                                   │
│ <─────────────────────────────────┼─┘                                   │                                   │
│                                   │                                     │                                   │
├───────────────────────────────────┼─────────────────────────────────────┼───────────────────────────────────┤
│ ═══ PHASE C: TIER 2 UPGRADE ═════ │                                     │                                   │
│                                   │                                     │                                   │
│ [11] POST /wallets/virtual-       │                                     │                                   │
│      accounts/topup {amount:      │                                     │                                   │
│      300000} → scan QR → pay      │                                     │                                   │
│                                   │ (IPN fires → same WALLET_TOPUP      │                                   │
│                                   │  branch as MF-1, credits 300K)      │                                   │
│                                   │                                     │                                   │
│ [12] POST /subscriptions/activate │                                     │                                   │
│      {activeRole:"EXPERT"}        │                                     │                                   │
│                                   │ (Same flow as MF-1 Phase C but      │                                   │
│                                   │  Expert Pro: 300,000 VND / 6 mo)    │                                   │
│                                   │ → Returns new JWT with              │                                   │
│                                   │   subscription_expert_tier:"pro"    │                                   │
│                                   │ Expert must store new token         │                                   │
│                                   │                                     │                                   │
│ [13] Selects seam to upgrade      │                                     │                                   │
│      e.g. seam_claim_id="{uuid}"  │                                     │                                   │
│      Fills portfolio form:        │                                     │                                   │
│      • projectDescription (≥50c)  │                                     │                                   │
│      • decisionPoints (≥20c)      │                                     │                                   │
│        └─────────────────────────>│                                     │                                   │
│                                   │ [14] POST /portfolio-submissions    │                                   │
│                                   │     [Pro-E] SubscriptionGuard       │                                   │
│                                   │     Checks:                         │                                   │
│                                   │     a. Seam claim owned by expert   │                                   │
│                                   │     b. verificationTier = "CLAIMED" │                                   │
│                                   │        (not already EVIDENCE_BACKED)│                                   │
│                                   │     c. lockedUntil: null or past    │                                   │
│                                   │     d. submission_count < 5         │                                   │
│                                   │     INSERT portfolio_submissions:   │                                   │
│                                   │       {expertId, seamClaimId,       │                                   │
│                                   │        projectDescription,          │                                   │
│                                   │        decisionPoints,              │                                   │
│                                   │        status:"PENDING"}            │                                   │
│                                   │                                     │                                   │
│                                   │ [15] FastAPI:                       │                                   │
│                                   │     POST /llm/portfolio-eval        │                                   │
│                                   │     {seam_code, project_description,│                                   │
│                                   │      decision_points}               │                                   │
│                                   │     LLM evaluates evidence →        │                                   │
│                                   │     {confidence_score,              │                                   │
│                                   │      passed_boolean,                │                                   │
│                                   │      gap_advisory}                  │                                   │
│                                   │     passed_boolean = (score ≥ 0.85) │                                   │
│                                   │                                     │                                   │
│                                   │ [16] DB TX (atomic):                │                                   │
│                                   │   IF passed_boolean=true:           │                                   │
│                                   │     UPDATE portfolio_submissions SET│                                   │
│                                   │       status:'APPROVED',            │                                   │
│                                   │       llm_confidence:score,         │                                   │
│                                   │       evaluated_at:now()            │                                   │
│                                   │     UPDATE expert_seam_claims SET   │                                   │
│                                   │       verification_tier:            │                                   │
│                                   │         'EVIDENCE_BACKED'           │                                   │
│                                   │     INSERT platform_decisions:      │                                   │
│                                   │       type:'SEAM_TIER_UPGRADE',     │                                   │
│                                   │       decision:'UPGRADED'           │                                   │
│                                   │                                     │                                   │
│                                   │   IF passed_boolean=false:          │                                   │
│                                   │     UPDATE portfolio_submissions SET│                                   │
│                                   │       status:'REJECTED',            │                                   │
│                                   │       llm_confidence:score,         │                                   │
│                                   │       evaluated_at:now()            │                                   │
│                                   │     UPDATE expert_seam_claims SET   │                                   │
│                                   │       submission_count += 1         │                                   │
│                                   │     IF new count ≥ 5:               │                                   │
│                                   │       SET locked_until=now()+30days │                                   │
│                                   │     INSERT platform_decisions:      │                                   │
│                                   │       type:'PORTFOLIO_EVAL',        │                                   │
│                                   │       decision:'REJECTED',          │                                   │
│                                   │       advisory_note:gap_advisory    │                                   │
│                                   │   COMMIT                            │                                   │
│                                   │                                     │                                   │
│ <─────────────────────────────────┼─┘                                   │                                   │
│ [17] Return:                      │                                     │                                   │
│   {id, status:"APPROVED"/         │                                     │                                   │
│    "REJECTED", llmConfidence,     │                                     │                                   │
│    evaluationTierUpgraded:bool,   │                                     │                                   │
│    advisoryNote, evaluatedAt}     │                                     │                                   │
│                                   │                                     │                                   │
├───────────────────────────────────┼─────────────────────────────────────┼───────────────────────────────────┤
│ ═══ PHASE D: BANK LINK ══════════ │                                     │                                   │
│                                   │                                     │                                   │
│ [18] Enters bank_account_xid +    │                                     │                                   │
│      holder_name                  │                                     │                                   │
│        └─────────────────────────>│                                     │                                   │
│                                   │ [19] POST /bank-hub/initiate-link   │                                   │
│                                   │     [Pro-E not required]            │                                   │
│                                   │     Guard: sepay_bank_account_xid   │                                   │
│                                   │       IS NOT NULL → 409 ALREADY     │                                   │
│                                   │     UPDATE users SET                │                                   │
│                                   │       sepay_bank_account_xid,       │                                   │
│                                   │       bank_account_holder_name,     │                                   │
│                                   │       bank_linked_at:now()          │                                   │
│                                   │     Return {success: true}          │                                   │
│ <─────────────────────────────────┼─┘                                   │                                   │
│ [20] Bank linked ✓                │                                     │                                   │
│      Can now receive withdrawals  │                                     │                                   │
│      Expert eligible for matching │                                     │                                   │
└───────────────────────────────────┴─────────────────────────────────────┴───────────────────────────────────┘
```

---

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-3 | Expert→NestJS | Register EXPERT account | `users` (C), `expert_profiles` (C), `wallets` (C), `virtual_accounts` (C) | active_role="EXPERT", sub_expert_tier="free" | `POST /auth/register` |
| 4 | Expert | Dashboard loads | `users` (R), `wallets` (R) | — | `GET /expert-profile/me` |
| 5-6 | Expert→NestJS | Add domain depth claim (repeatable) | `expert_domain_depths` (C) | verification_tier="CLAIMED" | `POST /expert-profile/domains` |
| 7-8 | Expert→NestJS | Add seam claim (repeatable) | `expert_seam_claims` (C) | verification_tier="CLAIMED", submission_count=0 | `POST /expert-profile/seams` |
| 9-10 | Expert→NestJS | Set engagement model + stack tags | `expert_profiles` (U) | — | `PUT /expert-profile/me` |
| 11 | Expert | Top-up wallet (same as MF-11) | `wallets` (U), `wallet_transactions` (C) | — | `POST /wallets/virtual-accounts/topup` + IPN |
| 12 | Expert→NestJS | Activate Expert Pro | `wallets` (U), `wallet_transactions` (C), `users` (U) | sub_expert_tier: free→pro | `POST /subscriptions/activate` |
| 13-14 | Expert→NestJS | Submit portfolio evidence; guards; INSERT submission | `portfolio_submissions` (C) | status="PENDING" | `POST /portfolio-submissions` |
| 15 | NestJS→FastAPI | LLM portfolio evaluation | — | — | Internal: `POST /llm/portfolio-eval` |
| 16 | NestJS | Atomic: update submission + seam claim + platform_decisions | `portfolio_submissions` (U), `expert_seam_claims` (U), `platform_decisions` (C) | APPROVED → seam: CLAIMED→EVIDENCE_BACKED; REJECTED → count++, maybe locked | — |
| 17 | Expert | Reads result | `portfolio_submissions` (R) | — | `GET /portfolio-submissions/:id` |
| 18-19 | Expert→NestJS | Link bank account directly | `users` (U) | sepay_bank_account_xid set, bank_linked_at set | `POST /bank-hub/initiate-link` |

---

**Critical drift from old doc:** `GET /portfolio-submissions/{id}/eval-result` → now `GET /portfolio-submissions/:id`. No SePay Hosted Link OTP flow — bank account XID is stored directly. VA is created locally (no SePay call) at registration. Portfolio submission return shape has changed to `{id, status, llmConfidence, evaluationTierUpgraded, advisoryNote, evaluatedAt}`.

---

# MF-3: Tech Team Account Creation via Handoff Link

## Overview

CEO generates a signed handoff link during Elicitation Stage 4 (Scenario B). This is the **only** way a TECH_TEAM account is created — no self-registration path exists. The link encodes `sessionId`, `ceoId`, and a one-time `jti` (JWT ID). Once consumed, the JWT is invalidated — a second use returns 401. References: §0.7 (RBAC — TECH_TEAM creation constraint).

**Tables touched (4):** `users`, `tech_team_profiles`, `wallets`, `elicitation_sessions`

**Endpoints:** `POST /elicitation/sessions/:id/generate-handoff-link`, `POST /auth/register/handoff`

---

## ASCII Swimlane

```
+───────────────────────────────────+────────────────────────────────────+───────────────────────────────────+
│        CLIENT / CEO               │     SYSTEM (NestJS)                │     CLIENT / TECH_TEAM            │
+───────────────────────────────────+────────────────────────────────────+───────────────────────────────────+
│                                   │                                    │                                   │
│ [1] Elicitation Stage 4           │                                    │                                   │
│     CEO selects "Delegate to      │                                    │                                   │
│     Tech Team" (Scenario B)       │                                    │                                   │
│                 +─────────────────>                                    │                                   │
│                                   │ [2] POST /elicitation/sessions/    │                                   │
│                                   │   :id/generate-handoff-link        │                                   │
│                                   │   [Pro-C] guard                    │                                   │
│                                   │   Assert CEO owns session          │                                   │
│                                   │   Sign JWT containing:             │                                   │
│                                   │     {sessionId, ceoId,             │                                   │
│                                   │      purpose:"tech-team-handoff",  │                                   │
│                                   │      jti: uuid(),                  │                                   │
│                                   │      exp: now()+72h}               │                                   │
│                                   │   UPDATE elicitation_sessions SET  │                                   │
│                                   │     handoff_token_jti = jti        │                                   │
│                                   │   Return {invite_link,             │                                   │
│                                   │     invite_token, expires_in:"72h"}│                                   │
│                 +<─────────────────                                    │                                   │
│ [3] CEO copies invite_link and    │                                    │                                   │
│     shares via Slack/Zalo/email   │                                    │                                   │
│     (no platform email sending)   │                                    │                                   │
│                                   │                                    │                                   │
│                                   │                                    │ [4] Tech team opens link          │
│                                   │                                    │     /register/handoff/:token      │
│                                   │                                    │     Decodes JWT (sessionId,       │
│                                   │                                    │      ceoId extracted on FE)       │
│                                   │                                    │     → Registration form shown     │
│                                   │                                    │                                   │
│                                   │                                    │ [5] Fills: email, password,       │
│                                   │                                    │     fullName, invite_token        │
│                                   │                 +<─────────────────                                    │
│                                   │ [6] POST /auth/register/handoff    │                                   │
│                                   │   Verify JWT: valid signature +    │                                   │
│                                   │     not expired +                  │                                   │
│                                   │     purpose="tech-team-handoff"    │                                   │
│                                   │   Check session exists             │                                   │
│                                   │   Check jti matches                │                                   │
│                                   │     session.handoff_token_jti      │                                   │
│                                   │   Check handoff_consumed_at=null   │                                   │
│                                   │     (single-use)                   │                                   │
│                                   │   Check email unique               │                                   │
│                                   │   DB TX (atomic):                  │                                   │
│                                   │   INSERT users:                    │                                   │
│                                   │     roles: ["CLIENT_CEO"]*         │                                   │
│                                   │     active_role: "CLIENT"          │                                   │
│                                   │     client_subtype: "TECH_TEAM"    │                                   │
│                                   │   INSERT tech_team_profiles:       │                                   │
│                                   │     linked_client_id = ceoId       │                                   │
│                                   │     linked_project_id = NULL**     │                                   │
│                                   │   INSERT wallets: {user_id}        │                                   │
│                                   │   UPDATE elicitation_sessions SET  │                                   │
│                                   │     handoff_consumed_at = now()    │                                   │
│                                   │   COMMIT                           │                                   │
│                                   │   Return {access_token,            │                                   │
│                                   │     refresh_token, user{...}}      │                                   │
│                                   │                 +─────────────────>│                                   │
│                                   │                                    │ [7] Tech Dashboard loads          │
│                                   │                                    │     Scoped to session/project     │
│                                   │                                    │     Can: view Artifact B (once    │
│                                   │                                    │     engagement≥CONNECTED),        │
│                                   │                                    │     submit Stage 4-handoff,       │
│                                   │                                    │     review bids, sign off         │
│                                   │                                    │     technical milestones          │
+───────────────────────────────────+────────────────────────────────────+───────────────────────────────────+

* roles:["CLIENT_CEO"] because TECH_TEAM is a subtype of CLIENT, not a separate top-level role.
** linked_project_id is set to NULL here; it is populated by ElicitationService.handleGatePassed()
   once Stage 5 synthesis publishes the project (via UPDATE tech_team_profiles SET linked_project_id=project.id).
```

---

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | CEO→NestJS | Generate signed JWT handoff link; store jti; assert CEO ownership | `elicitation_sessions` (R, U — handoff_token_jti) | — | `POST /elicitation/sessions/:id/generate-handoff-link` |
| 3 | CEO | Copies and shares link externally (no platform email) | — | — | — |
| 4-5 | TECH_TEAM | Opens link, extracts sessionId from JWT, fills form | — | — | `GET /register/handoff/:token` |
| 6 | NestJS | Validate JWT (sig, expiry, purpose, jti match, single-use); register TECH_TEAM | `users` (C), `tech_team_profiles` (C), `wallets` (C), `elicitation_sessions` (U — handoff_consumed_at) | New TECH_TEAM user scoped to CEO; link consumed | `POST /auth/register/handoff` |
| 7 | TECH_TEAM | Tech Dashboard loads | `tech_team_profiles` (R — linked_project_id) | — | — |

---

**Critical drift from old doc:** `tech_team_profiles.linked_project_id` is NOT set at registration — it is set later by `handleGatePassed()` in ElicitationService when Stage 5 synthesis publishes the project. The jti/consumed-at single-use mechanism is enforced; resending a second link invalidates the first. The `/elicitation/sessions/:id/generate-handoff-link` endpoint no longer takes an email body.

---

## Group 2 — Path A: Project-Based Flow

---

# MF-4: AI Elicitation Engine (5-Stage)

## Overview

Transforms CEO's raw symptom description into a published project spec via a 5-stage diagnostic. Stage 1 uses the AI service for symptom extraction. Stage 2 validates the chosen archetype against the AI service's `recommendedArchetypesJson` — non-recommended archetypes are rejected (422). Stage 3 uses 4 hardcoded archetype-specific probe questions with vagueness check (AI service). Stage 4 triggers synthesis automatically. Synthesis runs Stage 5 LLM call, matching pre-check, and hard void check — result returned directly from the stage 4 PUT (no separate `/confirm` or `/synthesize` endpoint). References: §0.6 (Elicitation + Spec state machines).

**Tables touched (4):** `elicitation_sessions`, `projects`, `platform_decisions`, `tech_team_profiles`

**Endpoints:** `POST /elicitation/sessions`, `GET /elicitation/sessions/:id`, `PUT /elicitation/sessions/:id/stage1`, `PUT /elicitation/sessions/:id/stage2`, `PUT /elicitation/sessions/:id/stage3`, `PUT /elicitation/sessions/:id/stage4`, `PUT /elicitation/sessions/:id/stage4-handoff` (TECH_TEAM only), `POST /elicitation/sessions/:id/generate-handoff-link`, `PUT /elicitation/sessions/:id/self-technical`, `POST /elicitation/sessions/:id/retry-synthesis`

---

## ASCII Swimlane

```
┌────────────────────────────────────┬───────────────────────────────────┬───────────────────────────────────┐
│           CLIENT / CEO             │     SYSTEM (NestJS + FastAPI)     │        CLIENT / TECH_TEAM         │
├────────────────────────────────────┼───────────────────────────────────┼───────────────────────────────────┤
│ ══════ STAGE 1: SYMPTOM INTAKE ════│                                   │                                   │
│                                    │                                   │                                   │
│ [1] Clicks "Start New AI Project"  │                                   │                                   │
│     Guard: sub_client_tier="pro"   │                                   │                                   │
│        └──────────────────────────>│                                   │                                   │
│                                    │ [2] POST /elicitation/sessions    │                                   │
│                                    │     [NONE] — session creation     │                                   │
│                                    │     is free (guard is only        │                                   │
│                                    │     on stage1 onwards)            │                                   │
│                                    │     INSERT elicitation_sessions:  │                                   │
│                                    │       user_id, current_stage:1,   │                                   │
│                                    │       state:"IN_PROGRESS",        │                                   │
│                                    │       void_list_json:"[]"         │                                   │
│                                    │     Return session object         │                                   │
│ <──────────────────────────────────┼─┘                                 │                                   │
│ [3] Types free-form pain text      │                                   │                                   │
│        └──────────────────────────>│                                   │                                   │
│                                    │ [4] PUT /elicitation/sessions/    │                                   │
│                                    │     :id/stage1  [Pro-C]           │                                   │
│                                    │     {symptomText: "..."}          │                                   │
│                                    │     FastAPI: POST /llm/           │                                   │
│                                    │       elicitation/stage1-extract  │                                   │
│                                    │     Returns {symptoms,            │                                   │
│                                    │       scale_signals, voids,       │                                   │
│                                    │       recommended_archetypes}     │                                   │
│                                    │     UPDATE elicitation_sessions:  │                                   │
│                                    │       stage1_symptoms_json,       │                                   │
│                                    │       void_list_json,             │                                   │
│                                    │       recommended_archetypes_json,│                                   │
│                                    │       current_stage: 2            │                                   │
│ <──────────────────────────────────┼─┘                                 │                                   │
│ [5] CEO reviews symptoms + voids   │                                   │                                   │
│                                    │                                   │                                   │
├────────────────────────────────────┼───────────────────────────────────┼───────────────────────────────────┤
│ ═════ STAGE 2: ARCHETYPE ══════════│                                   │                                   │
│                                    │                                   │                                   │
│ [6] CEO selects archetype (1-6)    │                                   │                                   │
│     Must be from                   │                                   │                                   │
│     recommendedArchetypesJson      │                                   │                                   │
│        └──────────────────────────>│                                   │                                   │
│                                    │ [7] PUT .../stage2  [Pro-C]       │                                   │
│                                    │     {archetype:"1",               │                                   │
│                                    │      acknowledgedVoidCodes:[...]} │                                   │
│                                    │     VALIDATION: archetype must be │                                   │
│                                    │       in recommendedArchetypes    │                                   │
│                                    │       Json → 422 if not           │                                   │
│                                    │     UPDATE elicitation_sessions:  │                                   │
│                                    │       archetype="1",              │                                   │
│                                    │       current_stage: 3            │                                   │
│ <──────────────────────────────────┼─┘                                 │                                   │
│                                    │                                   │                                   │
├────────────────────────────────────┼───────────────────────────────────┼───────────────────────────────────┤
│ ══ STAGE 3: ARCHITECTURE PROBE ════│                                   │                                   │
│                                    │                                   │                                   │
│ [8] Answers 4 archetype-specific   │                                   │                                   │
│     probe questions (hardcoded     │                                   │                                   │
│     per archetype in service)      │                                   │                                   │
│        └──────────────────────────>│                                   │                                   │
│                                    │ [9] PUT .../stage3  [Pro-C]       │                                   │
│                                    │     {probeResponses: {q1:...,     │                                   │
│                                    │       q2:..., q3:..., q4:...}}    │                                   │
│                                    │     FastAPI: vagueness check      │                                   │
│                                    │     IF vague → return             │                                   │
│                                    │       {advanced:false, flagged_   │                                   │
│                                    │        questions:[...]} (no stage │                                   │
│                                    │       advance; CEO must re-answer)│                                   │
│                                    │     IF concrete → UPDATE sessions:│                                   │
│                                    │       stage3_probes_json,         │                                   │
│                                    │       current_stage:4             │                                   │
│                                    │     Return {advanced:bool,        │                                   │
│                                    │       currentStage, ...}          │                                   │
│ <──────────────────────────────────┼─┘                                 │                                   │
│                                    │                                   │                                   │
├────────────────────────────────────┼───────────────────────────────────┼───────────────────────────────────┤
│ ══ STAGE 4: TECH CONTEXT (A/B) ════│                                   │                                   │
│                                    │                                   │                                   │
│  SCENARIO A: CEO self-technical    │                                   │                                   │
│  OR delegates but FILLS DIRECTLY   │                                   │                                   │
│                                    │                                   │                                   │
│ [10a] CEO fills Stage 4 form:      │                                   │                                   │
│   {current_stack, data_available,  │                                   │                                   │
│    latency_requirement, ...}       │                                   │                                   │
│        └──────────────────────────>│                                   │                                   │
│                                    │ [11a] PUT .../stage4  [Pro-C]     │                                   │
│                                    │      CEO-only (CEO clientSubtype) │                                   │
│                                    │      UPDATE sessions:             │                                   │
│                                    │        stage4_tech_inputs_json,   │                                   │
│                                    │        current_stage: 5           │                                   │
│                                    │      AUTO-CHAINS Stage 5 synthesis│                                   │
│                                    │      (see Stage 5 below)          │                                   │
│                                    │      Return synthesis gate result │                                   │
│ <──────────────────────────────────┼─┘                                 │                                   │
│                                    │                                   │                                   │
│  SCENARIO B: Delegate to Tech Team │                                   │                                   │
│                                    │                                   │                                   │
│ [10b] CEO generates handoff link   │                                   │                                   │
│   POST .../generate-handoff-link   │                                   │                                   │
│   → gets invite_link (see MF-3)    │                                   │                                   │
│   CEO shares link externally       │                                   │                                   │
│   CEO polls GET /elicitation/      │                                   │                                   │
│     sessions/:id every 5s          │                                   │                                   │
│     waiting for currentStage≥5     │                                   │                                   │
│                                    │                                   │                                   │
│                                    │                                   │ [11b] Tech Team registers via     │
│                                    │                                   │   /auth/register/handoff          │
│                                    │                                   │   then fills Stage 4 form         │
│                                    │                 +<─────────────────                                   │
│                                    │ [12] PUT .../stage4-handoff       │                                   │
│                                    │   [NONE — not Pro-C gated]        │                                   │
│                                    │   Guard: clientSubtype="TECH_TEAM"│                                   │
│                                    │   UPDATE sessions:                │                                   │
│                                    │     stage4_tech_inputs_json,      │                                   │
│                                    │     current_stage:5               │                                   │
│                                    │   UPDATE tech_team_profiles SET   │                                   │
│                                    │     linked_project_id = project_id│                                   │
│                                    │     (set in handleGatePassed)     │                                   │
│                                    │   AUTO-CHAINS Stage 5 synthesis   │                                   │
│                                    │                 +─────────────────>                                   │
├────────────────────────────────────┼───────────────────────────────────┼───────────────────────────────────┤
│ ════════ STAGE 5: SYNTHESIS ═══════│                                   │                                   │
│                                    │                                   │                                   │
│                                    │ [13] AUTO-CHAINED from Stage 4:   │                                   │
│                                    │   FastAPI: POST /llm/elicitation/ │                                   │
│                                    │     stage5-synthesize             │                                   │
│                                    │   {session_id, stage1_symptoms,   │                                   │
│                                    │    stage2_archetype,              │                                   │
│                                    │    stage3_probes,                 │                                   │
│                                    │    stage4_tech_inputs,            │                                   │
│                                    │    void_list_json}                │                                   │
│                                    │   Returns {completeness_score,    │                                   │
│                                    │     required_seams_json,          │                                   │
│                                    │     required_domains_json,        │                                   │
│                                    │     milestone_framework_json,     │                                   │
│                                    │     artifact_a_json,              │                                   │
│                                    │     artifact_b_json}              │                                   │
│                                    │                                   │                                   │
│                                    │ [14] AUTO-PUBLISH QUALITY GATE:   │                                   │
│                                    │   a. completeness_score ≥ 0.70?   │                                   │
│                                    │   b. No unresolved HIGH-severity  │                                   │
│                                    │      voids (injected:false)?      │                                   │
│                                    │   c. At least 1 candidate expert  │                                   │
│                                    │      from FastAPI /llm/matching   │                                   │
│                                    │      pre-check?                   │                                   │
│                                    │   ALL PASS → gate_passed:true     │                                   │
│                                    │                                   │                                   │
│                                    │ [15a] IF gate_passed:             │                                   │
│                                    │   DB TX:                          │                                   │
│                                    │   INSERT projects:                │                                   │
│                                    │     {client_id,                   │                                   │
│                                    │      elicitation_session_id,      │                                   │
│                                    │      state:"PUBLISHED",           │                                   │
│                                    │      archetype, tier,             │                                   │
│                                    │      self_technical,              │                                   │
│                                    │      required_seams_json,         │                                   │
│                                    │      required_domains_json,       │                                   │
│                                    │      milestone_framework_json,    │                                   │
│                                    │      artifact_a_json,             │                                   │
│                                    │      artifact_b_json}             │                                   │
│                                    │   UPDATE elicitation_sessions:    │                                   │
│                                    │     state:"COMPLETED"             │                                   │
│                                    │   IF Tech Team involved:          │                                   │
│                                    │     UPDATE tech_team_profiles SET │                                   │
│                                    │       linked_project_id=project.id│                                   │
│                                    │   INSERT platform_decisions:      │                                   │
│                                    │     type:"ELICITATION_SYNTHESIS", │                                   │
│                                    │     decision:"PUBLISHED"          │                                   │
│                                    │   EMIT event "project.published"  │                                   │
│                                    │     (seeds MatchingService cache) │                                   │
│                                    │   Return {gate_passed:true,       │                                   │
│                                    │    completeness_score, project_id}│                                   │
│                                    │                                   │                                   │
│                                    │ [15b] IF gate_failed:             │                                   │
│                                    │   UPDATE elicitation_sessions:    │                                   │
│                                    │     state:"RETURNED",             │                                   │
│                                    │     current_stage: return_to_stage│                                   │
│                                    │   INSERT platform_decisions:      │                                   │
│                                    │     type:"SPEC_AUTO_RETURN",      │                                   │
│                                    │     decision:"RETURNED",          │                                   │
│                                    │     advisory_note:{text}          │                                   │
│                                    │   Return {gate_passed:false,      │                                   │
│                                    │     completeness_score,           │                                   │
│                                    │     flagged_void,                 │                                   │
│                                    │     return_to_stage,              │                                   │
│                                    │     advisory_note}                │                                   │
│ <──────────────────────────────────┼─┘                                 │                                   │
│ [16] Result:                       │                                   │                                   │
│   ✓ gate_passed:true               │                                   │                                   │
│     → Show "Project Published"     │                                   │                                   │
│       Matching engine seeded       │                                   │                                   │
│   ✗ gate_passed:false              │                                   │                                   │
│     → Show advisory_note           │                                   │                                   │
│       Return to return_to_stage    │                                   │                                   │
│     (retry via retry-synthesis or  │                                   │                                   │
│      re-submit stage 4)            │                                   │                                   │
└────────────────────────────────────┴───────────────────────────────────┴───────────────────────────────────┘
```

---

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | CEO→NestJS | Start session; no subscription guard | `elicitation_sessions` (C) | state=IN_PROGRESS, current_stage=1 | `POST /elicitation/sessions` |
| 3-4 | CEO→FastAPI | Stage 1: symptom extraction; returns recommended_archetypes | `elicitation_sessions` (U — stage1_symptoms_json, void_list_json, recommended_archetypes_json) | current_stage: 1→2 | `PUT .../stage1` |
| 5-7 | CEO→NestJS | Stage 2: select archetype from recommended set (422 if not in set) | `elicitation_sessions` (U — archetype) | current_stage: 2→3 | `PUT .../stage2` |
| 8-9 | CEO→FastAPI | Stage 3: 4 archetype-specific probe Qs; vagueness check | `elicitation_sessions` (U — stage3_probes_json) | current_stage: 3→4 (only if not vague) | `PUT .../stage3` |
| 10a-11a | CEO→NestJS | Stage 4 (CEO): auto-chains synthesis; returns gate result | `elicitation_sessions` (U), `projects` (C), `platform_decisions` (C) | session: IN_PROGRESS→COMPLETED or RETURNED | `PUT .../stage4` |
| 10b | CEO→NestJS | Generate handoff link (Scenario B) | `elicitation_sessions` (U — handoff_token_jti) | — | `POST .../generate-handoff-link` |
| 11b-12 | TECH_TEAM→NestJS | Stage 4-handoff: auto-chains synthesis; sets linked_project_id | `elicitation_sessions` (U), `tech_team_profiles` (U), `projects` (C), `platform_decisions` (C) | session: IN_PROGRESS→COMPLETED or RETURNED | `PUT .../stage4-handoff` |
| 13-15 | NestJS→FastAPI | Stage 5 synthesis + quality gate + project creation | `projects` (C), `elicitation_sessions` (U), `platform_decisions` (C) | PUBLISHED or RETURNED | Internal |

---

**Critical drifts from old doc:** (1) Session creation has **no** SubscriptionGuard — only Stage 1 and beyond are gated `[Pro-C]`. (2) Stage 2 validates archetype against `recommendedArchetypesJson` returned by Stage 1 — non-recommended codes return 422. (3) Stage 3 has a **vagueness check** — vague answers return `{advanced:false}` without advancing stage. (4) **Stage 4 auto-chains synthesis** — no separate `/synthesize` or `/confirm` endpoint. Gate result is returned directly from Stage 4 PUT. (5) `generate-handoff-link` takes **no body** (no email field). (6) `tech_team_profiles.linked_project_id` is set by `handleGatePassed()`, not at TECH_TEAM registration.

---

# MF-5: AI Matching & Shortlisting

## Overview

Matching is triggered automatically when Stage 5 synthesis publishes a project. ElicitationService calls `matchingHelper.scoreEligibleExperts()` during synthesis, passes the candidate list to `handleGatePassed()`, which emits a `project.published` event. MatchingService listens for this event and caches the pre-computed results. The CEO reads the shortlist via `GET /matching/:projectId/shortlist`. Composite scores are **never exposed** to the FE — only `strength_label` and `gap_map` are returned.

**Tables touched (4):** `projects`, `expert_profiles`, `expert_seam_claims`, `expert_domain_depths`

**Endpoints:** `GET /matching/:projectId/shortlist`

---

## ASCII Swimlane

```
+──────────────────────────────────+───────────────────────────────────────+─────────────────────────────────+
│        CLIENT / CEO              │     SYSTEM (NestJS + FastAPI)         │           DATABASE              │
+──────────────────────────────────+───────────────────────────────────────+─────────────────────────────────+
│                                  │                                       │                                 │
│ [AUTO at publish time]           │                                       │                                 │
│                                  │ [1] ElicitationService.handleGate     │                                 │
│                                  │     Passed() calls:                   │                                 │
│                                  │     matchingHelper.scoreEligibleExperts│                                │
│                                  │     (required_seams_json,             │                                 │
│                                  │      required_domains_json,           │                                 │
│                                  │      archetype, clientId)             │                                 │
│                                  │                                       │                                 │
│                                  │ [2] MatchingHelper queries DB:        │                                 │
│                                  │   SELECT users (not clientId,         │                                 │
│                                  │     isActive=true, expertProfile      │                                 │
│                                  │     NOT NULL)                         │                                 │
│                                  │   With expertProfile, expertDomain    │                                 │
│                                  │     Depths, expertSeamClaims included │                                 │
│                                  │               +──────────────────────>│                                 │
│                                  │               +<──────────────────────│                                 │
│                                  │                                       │                                 │
│                                  │ [3] FastAPI: POST /llm/matching       │                                 │
│                                  │   Pure algorithm — no LLM call        │                                 │
│                                  │   Composite score = 40% seam +        │                                 │
│                                  │     25% domain + 20% portfolio +      │                                 │
│                                  │     10% archetype + 5% engagement     │                                 │
│                                  │   Tier weights:                       │                                 │
│                                  │     EVIDENCE_BACKED → 1.0 (green)     │                                 │
│                                  │     CLAIMED → 0.5 (amber)             │                                 │
│                                  │     missing → 0 (red)                 │                                 │
│                                  │   Strength labels:                    │                                 │
│                                  │     ≥ 0.85 → STRONG_MATCH             │                                 │
│                                  │     ≥ 0.70 → GOOD_MATCH               │                                 │
│                                  │     ≥ 0.55 → POSSIBLE_MATCH           │                                 │
│                                  │     < 0.55 → WEAK_MATCH               │                                 │
│                                  │   Returns [{expert_id, composite_     │                                 │
│                                  │     score, strength_label, gap_map}]  │                                 │
│                                  │                                       │                                 │
│                                  │ [4] ElicitationService emits          │                                 │
│                                  │     "project.published" event with    │                                 │
│                                  │     {projectId, candidates}           │                                 │
│                                  │                                       │                                 │
│                                  │ [5] MatchingService.handleProjectPub  │                                 │
│                                  │     lished() caches candidates in     │                                 │
│                                  │     shortlistCache Map (no DB write)  │                                 │
│                                  │                                       │                                 │
│ [6] CEO opens project page       │                                       │                                 │
│        +─────────────────────────>                                       │                                 │
│                                  │ [7] GET /matching/:projectId/         │                                 │
│                                  │     shortlist                         │                                 │
│                                  │   Guard: CEO owns project             │                                 │
│                                  │   Read from shortlistCache            │                                 │
│                                  │   Strip composite_score (never        │                                 │
│                                  │     exposed); return only:            │                                 │
│                                  │   [{expert_id, strength_label,        │                                 │
│                                  │     gap_map:[{seam_code, color}]}]    │                                 │
│        +<─────────────────────────                                       │                                 │
│ [8] CEO views shortlist with     │                                       │                                 │
│     strength labels + seam gap   │                                       │                                 │
│     maps (green/amber/red)       │                                       │                                 │
│     Numeric scores NOT shown     │                                       │                                 │
+──────────────────────────────────+───────────────────────────────────────+─────────────────────────────────+
```

---

**Critical drifts from old doc:** (1) Matching is **event-driven at publish time**, not initiated by CEO action — there is no `POST /matching/{projectId}`. (2) The CEO-facing endpoint is `GET /matching/:projectId/shortlist`, not `POST /matching/{projectId}`. (3) Composite scores are **stripped** before returning to the FE. (4) Gap map colors: green=EVIDENCE_BACKED, amber=CLAIMED, red=missing (old doc had green absent, amber=Tier2, yellow=Tier1). (5) Strength label thresholds: 0.85/0.70/0.55 (not 0.78/0.58/0.42). (6) No `claims-to-verified > 4:1` hard gate exists in the current implementation.

---

# MF-6: Simplified Bid & Connection Flow

## Overview

Expert views Artifact A via `GET /projects/:id/artifact-a`, asks pre-bid questions via the project-scoped messages channel (send `project_id` instead of `engagement_id` — both optional/mutually exclusive). Submits 3-component bid via `POST /bids`. TECH_TEAM reviews bid and sets `tech_status`. CEO reviews and sets `ceo_status`. NDA click-through transitions engagement to CONNECTED.

**Tables touched (4):** `capability_bids`, `engagements`, `projects`, `messages`

**Endpoints:** `GET /projects/:id/artifact-a`, `POST /messages`, `GET /messages` (engagement or project scoped), `POST /bids`, `PUT /bids/:id`, `PUT /bids/:id/tech-review`, `PUT /bids/:id/counter-offer`, `PUT /bids/:id/ceo-decision`, `PUT /engagements/:id/nda`

---

## ASCII Swimlane

```
+──────────────────────────────────+─────────────────────────────────────+──────────────────────────────────+───────────────────+
│           EXPERT                 │     SYSTEM (NestJS)                 │     CLIENT / TECH_TEAM           │      CEO          │
+──────────────────────────────────+─────────────────────────────────────+──────────────────────────────────+───────────────────+
│                                  │                                     │                                  │                   │
│ ══ PHASE A: PRE-BID ═════════════│                                     │                                  │                   │
│                                  │                                     │                                  │                   │
│ [1] Views PUBLISHED project      │                                     │                                  │                   │
│     GET /projects/:id/artifact-a │                                     │                                  │                   │
│     → {artifact_a_json}          │                                     │                                  │                   │
│                                  │                                     │                                  │                   │
│ [2] Sends pre-bid question:      │                                     │                                  │                   │
│     POST /messages               │                                     │                                  │                   │
│     {project_id: "...",          │                                     │                                  │                   │
│      content: "What is current   │                                     │                                  │                   │
│      error rate baseline?"}      │                                     │                                  │                   │
│                 +────────────────>                                     │                                  │                   │
│                                  │ [3] INSERT messages:                │                                  │                   │
│                                  │   engagement_id: NULL               │                                  │                   │
│                                  │   project_id: projectId             │                                  │                   │
│                                  │   sender_id: expertId               │                                  │                   │
│                                  │   content: "..."                    │                                  │                   │
│                                  │              +──────────────────────>                                  │                   │
│                                  │                                     │ [4] TECH_TEAM / CEO reads and    │                   │
│                                  │                                     │ answers via POST /messages       │                   │
│                                  │                                     │ {project_id, content:"..."}      │                   │
│                                  │                                     │                                  │                   │
│ ══ PHASE B: BID SUBMISSION ══════│                                     │                                  │                   │
│                                  │                                     │                                  │                   │
│ [5] Expert submits bid:          │                                     │                                  │                   │
│   [Pro-E] required               │                                     │                                  │                   │
│   Must appear in shortlist cache │                                     │                                  │                   │
│   Guard: no existing bid on      │                                     │                                  │                   │
│     this project                 │                                     │                                  │                   │
│                 +────────────────>                                     │                                  │                   │
│                                  │ [6] POST /bids                      │                                  │                   │
│                                  │   {project_id,                      │                                  │                   │
│                                  │    footprint_alignment_json,        │                                  │                   │
│                                  │    approach_summary,                │                                  │                   │
│                                  │    conditional_pricing_json}        │                                  │                   │
│                                  │   Guards:                           │                                  │                   │
│                                  │   • Expert Pro                      │                                  │                   │
│                                  │   • project.state = PUBLISHED       │                                  │                   │
│                                  │   • Expert in shortlist cache       │                                  │                   │
│                                  │   • No existing engagement for      │                                  │                   │
│                                  │     (project, expert)               │                                  │                   │
│                                  │   DB TX:                            │                                  │                   │
│                                  │   INSERT engagements:               │                                  │                   │
│                                  │     {project_id, expert_id,         │                                  │                   │
│                                  │      client_id, type:"PROJECT_BASED",│                                 │                   │
│                                  │      state:"PENDING"}               │                                  │                   │
│                                  │   INSERT capability_bids:           │                                  │                   │
│                                  │     {engagement_id, footprint_...,  │                                  │                   │
│                                  │      approach_summary,              │                                  │                   │
│                                  │      conditional_pricing_json,      │                                  │                   │
│                                  │      state:"SUBMITTED",             │                                  │                   │
│                                  │      tech_status:"PENDING",         │                                  │                   │
│                                  │      ceo_status:"PENDING",          │                                  │                   │
│                                  │      version_number:1}              │                                  │                   │
│                                  │                                     │                                  │                   │
│ ══ PHASE C: TECH REVIEW ══════════│                                    │                                  │                   │
│                                  │              +──────────────────────>                                  │                   │
│                                  │                                     │ [7] TECH_TEAM reviews bid        │                   │
│                                  │                                     │ PUT /bids/:id/tech-review        │                   │
│                                  │                                     │ {action:"REVISION_REQUESTED",    │                   │
│                                  │                                     │  tech_feedback:"Approach         │                   │
│                                  │                                     │  doesn't address A↔C seam"}      │                   │
│                                  │                                     │  OR {action:"APPROVED"}          │                   │
│                                  │                                     │                                  │                   │
│                                  │ [8] UPDATE capability_bids SET      │                                  │                   │
│                                  │   tech_status:"REVISION_REQUESTED"  │                                  │                   │
│                                  │   tech_feedback:"..."               │                                  │                   │
│                                  │                                     │                                  │                   │
│ [9] Expert reads tech_feedback   │                                     │                                  │                   │
│     PUT /bids/:id                │                                     │                                  │                   │
│     {footprint_alignment_json,   │                                     │                                  │                   │
│      approach_summary, ...}      │                                     │                                  │                   │
│                 +────────────────>                                     │                                  │                   │
│                                  │ [10] UPDATE capability_bids SET     │                                  │                   │
│                                  │   (ALL 3 components refreshed)      │                                  │                   │
│                                  │   tech_status:"PENDING"             │                                  │                   │
│                                  │   state:"TECH_REVIEW"               │                                  │                   │
│                                  │   version_number += 1               │                                  │                   │
│                                  │   Guard: tech_status must be        │                                  │                   │
│                                  │     "REVISION_REQUESTED" to allow   │                                  │                   │
│                                  │     this PUT (422 otherwise)        │                                  │                   │
│                                  │                                     │                                  │                   │
│                                  │              +──────────────────────>                                  │                   │
│                                  │                                     │ [11] TECH_TEAM re-reviews        │                   │
│                                  │                                     │ → SET tech_status="APPROVED"     │                   │
│                                  │                                     │                                  │                   │
│ ══ PHASE D: CEO REVIEW ══════════│                                     │                                  │                   │
│                                  │                                     │                                  │ [12] CEO can ONLY │
│                                  │                                     │                                  │ see/decide bid    │
│                                  │                                     │                                  │ AFTER tech_status │
│                                  │                                     │                                  │ = "APPROVED"      │
│                                  │                                     │                                  │                   │
│                                  │                                     │                                  │ [13a] OPTIONAL:   │
│                                  │                                     │                                  │ Counter-offer:    │
│                                  │                                     │                                  │ PUT /bids/:id/    │
│                                  │                                     │                                  │ counter-offer     │
│                                  │                                     │                                  │ {negotiated_price │
│                                  │                                     │                                  │  _vnd: 4500000}   │
│                                  │                                     │                                  │ One round only;   │
│                                  │                                     │                                  │ 409 if already set│
│                                  │                                     │                                  │                   │
│                                  │                                     │                                  │ [13b] CEO decides:│
│                                  │                                     │                                  │ PUT /bids/:id/    │
│                                  │                                     │                                  │ ceo-decision      │
│                                  │                                     │                                  │ {decision:        │
│                                  │                                     │                                  │ "APPROVED"/       │
│                                  │                                     │                                  │  "DECLINED"}      │
│                                  │ [14] UPDATE capability_bids SET     │                                  │                   │
│                                  │   ceo_status:"APPROVED"/"DECLINED"  │                                  │                   │
│                                  │   state:"SELECTED"/"DECLINED"       │                                  │                   │
│                                  │   IF APPROVED: cascade UPDATE       │                                  │                   │
│                                  │     all sibling bids on same        │                                  │                   │
│                                  │     project → DECLINED              │                                  │                   │
│                                  │                                     │                                  │                   │
│ ══ PHASE E: NDA & CONNECTION ════│                                     │                                  │                   │
│                                  │                                     │                                  │                   │
│                                  │                                     │                                  │ [15] CEO accepts  │
│                                  │                                     │                                  │ NDA:              │
│                                  │                                     │                                  │ PUT /engagements/ │
│                                  │                                     │                                  │ :id/nda           │
│                                  │                                     │                                  │                   │
│ [16] Expert accepts NDA:         │                                     │                                  │                   │
│   PUT /engagements/:id/nda       │                                     │                                  │                   │
│                 +────────────────>                                     │                                  │                   │
│                                  │ [17] UPDATE engagements SET         │                                  │                   │
│                                  │   client_nda_accepted_at = now()    │                                  │                   │
│                                  │   expert_nda_accepted_at = now()    │                                  │                   │
│                                  │   IF both timestamps set:           │                                  │                   │
│                                  │     state:"CONNECTED"               │                                  │                   │
│                                  │     connected_at = now()            │                                  │                   │
│                                  │   Artifact B route guard unlocks    │                                  │                   │
│                                  │   for EXPERT and TECH_TEAM          │                                  │                   │
│                                  │   (CEO permanently excluded)        │                                  │                   │
+──────────────────────────────────+─────────────────────────────────────+──────────────────────────────────+───────────────────+
```

---

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1 | Expert | View Artifact A | `projects` (R — artifact_a_json) | — | `GET /projects/:id/artifact-a` |
| 2-4 | Expert/TECH_TEAM/CEO | Pre-bid messaging on project channel | `messages` (C) | — | `POST /messages`, `GET /messages?projectId=` |
| 5-6 | Expert→NestJS | Submit 3-component bid; atomic engagement + bid | `engagements` (C), `capability_bids` (C) | bid.state=SUBMITTED, tech_status=PENDING, ceo_status=PENDING | `POST /bids` |
| 7-8 | TECH_TEAM→NestJS | Set tech_status + optional feedback | `capability_bids` (U) | tech_status: PENDING→REVISION_REQUESTED or APPROVED | `PUT /bids/:id/tech-review` |
| 9-10 | Expert→NestJS | Revise bid in-place; reset tech_status | `capability_bids` (U) | tech_status→PENDING, state→TECH_REVIEW, version_number++ | `PUT /bids/:id` |
| 11 | TECH_TEAM→NestJS | Approve bid | `capability_bids` (U) | tech_status: PENDING→APPROVED | `PUT /bids/:id/tech-review` |
| 12-13 | CEO→NestJS | Optional counter-offer + CEO decision | `capability_bids` (U) | ceo_status: PENDING→APPROVED or DECLINED; state→SELECTED or DECLINED | `PUT /bids/:id/counter-offer`, `PUT /bids/:id/ceo-decision` |
| 14 | NestJS | Cascade decline sibling bids | `capability_bids` (U) | Other bids→DECLINED | — |
| 15-17 | CEO+Expert→NestJS | NDA click-through; CONNECTED when both set | `engagements` (U) | state: PENDING→CONNECTED; nda timestamps set | `PUT /engagements/:id/nda` |

---

**Critical drifts from old doc:** (1) Pre-bid messages now use `project_id` field (not `engagement_id`) since no engagement exists yet — `CreateMessageDto` accepts either. (2) Bid revision PUT requires `tech_status="REVISION_REQUESTED"` (422 if not). (3) Counter-offer is a separate endpoint: `PUT /bids/:id/counter-offer`. (4) Sibling bid cascade-DECLINE is atomic. (5) NDA endpoint is `PUT /engagements/:id/nda` (singular, not `/accept-nda`). Endpoint name may vary — check `engagements.controller.ts`.

---

# MF-7: Milestone Management + DoD + Escrow (2-Layer)

## Overview

CEO creates milestones (with criteria inline in one POST). Criteria are async LLM quality-gated after creation (advisory only — milestone is persisted regardless). CEO funds milestone via `PUT /milestones/:id/fund` which generates a local VA and sets state to AWAITING_PAYMENT. SePay IPN credits escrow and advances milestone to FUNDED→IN_PROGRESS and releases paygated_documents. Expert creates DoD checklist, marks items complete. Expert submits deliverable (DoD gate enforced). Sign-off authority verifies criteria one by one — last criterion verified triggers atomic escrow release.

**Tables touched (8):** `milestones`, `acceptance_criteria`, `milestone_dod_items`, `milestone_submissions`, `paygated_documents`, `escrow_accounts`, `wallets`, `wallet_transactions`

**Endpoints:** `POST /milestones`, `GET /milestones/:id`, `PUT /milestones/:id/fund`, `POST /milestones/:id/dod/items`, `PUT /milestones/:id/dod/:itemId`, `POST /milestones/:id/submit`, `POST /milestones/:id/paygated-docs`, `GET /milestones/:id/paygated-docs`, `PUT /criteria/:id/verify`, `PUT /criteria/:id/revision`, `POST /webhooks/sepay/ipn`

---

## ASCII Swimlane

```
┌────────────────────────────────────┬────────────────────────────────────────┬──────────────────┬─────────────────┐
│           CLIENT / CEO             │           SYSTEM (NestJS)              │     EXPERT       │   TECH_TEAM     │
├────────────────────────────────────┼────────────────────────────────────────┼──────────────────┼─────────────────┤
│ ═══ PHASE A: MILESTONE DEFINITION ═│                                        │                  │                 │
│                                    │                                        │                  │                 │
│ [1] CEO creates milestone with     │                                        │                  │                 │
│     acceptance criteria inline:    │                                        │                  │                 │
│     {engagement_id,                │                                        │                  │                 │
│      milestone_number,             │                                        │                  │                 │
│      deliverable_statement,        │                                        │                  │                 │
│      sign_off_authority,           │                                        │                  │                 │
│      payment_amount_vnd,           │                                        │                  │                 │
│      criteria: [{criterion_text,   │                                        │                  │                 │
│                  is_required}]}    │                                        │                  │                 │
│        └──────────────────────────>│                                        │                  │                 │
│                                    │ [2] POST /milestones  [CLIENT only]    │                  │                 │
│                                    │     DB TX (atomic):                    │                  │                 │
│                                    │     INSERT milestones:                 │                  │                 │
│                                    │       {engagement_id,                  │                  │                 │
│                                    │        milestone_number,               │                  │                 │
│                                    │        deliverable_statement,          │                  │                 │
│                                    │        sign_off_authority,             │                  │                 │
│                                    │        payment_amount_vnd,             │                  │                 │
│                                    │        state:"DEFINED"}                │                  │                 │
│                                    │     For each criterion:                │                  │                 │
│                                    │     INSERT acceptance_criteria:        │                  │                 │
│                                    │       {milestone_id, criterion_text,   │                  │                 │
│                                    │        is_required:true,               │                  │                 │
│                                    │        verified_by_role:               │                  │                 │
│                                    │          sign_off_authority,           │                  │                 │
│                                    │        verified_at:NULL}               │                  │                 │
│                                    │     COMMIT                             │                  │                 │
│                                    │     ASYNC (after TX):                  │                  │                 │
│                                    │       FastAPI: POST /llm/criterion-    │                  │                 │
│                                    │         check (each criterion)         │                  │                 │
│                                    │       IF is_subjective:                │                  │                 │
│                                    │         INSERT platform_decisions:     │                  │                 │
│                                    │           type:"CRITERION_QUALITY_GATE"│                  │                 │
│                                    │           decision:"FLAGGED"           │                  │                 │
│                                    │           advisory_note: suggestions   │                  │                 │
│                                    │       (advisory only — does not block) │                  │                 │
│ <──────────────────────────────────┼─┘                                      │                  │                 │
│                                    │                                        │                  │                 │
├────────────────────────────────────┼────────────────────────────────────────┼──────────────────┼─────────────────┤
│ ══════ PHASE B: FUNDING ═══════════│                                        │                  │                 │
│                                    │                                        │                  │                 │
│ [3] CEO clicks "Fund Milestone"    │                                        │                  │                 │
│        └──────────────────────────>│                                        │                  │                 │
│                                    │ [4] PUT /milestones/:id/fund           │                  │                 │
│                                    │     [CLIENT only]                      │                  │                 │
│                                    │     Generate local VA number:          │                  │                 │
│                                    │       "VA-{6_random_digits}"           │                  │                 │
│                                    │     INSERT virtual_accounts:           │                  │                 │
│                                    │       {entity_type:"MILESTONE",        │                  │                 │
│                                    │        entity_id:milestoneId,          │                  │                 │
│                                    │        va_number, fixed_amount:        │                  │                 │
│                                    │          payment_amount_vnd,           │                  │                 │
│                                    │        expires_at:now()+24h,           │                  │                 │
│                                    │        status:"ACTIVE"}                │                  │                 │
│                                    │     UPDATE milestones SET              │                  │                 │
│                                    │       state:"AWAITING_PAYMENT",        │                  │                 │
│                                    │       va_number, va_expires_at         │                  │                 │
│                                    │     Return updated milestone           │                  │                 │
│ <──────────────────────────────────┼─┘                                      │                  │                 │
│ [5] CEO sees va_number to pay      │                                        │                  │                 │
│     exact fixed_amount via bank    │                                        │                  │                 │
│                                    │                                        │                  │                 │
│                                    │  ┌<── SePay IPN fires (External)       │                  │                 │
│                                    │ [6] IPN MILESTONE branch:              │                  │                 │
│                                    │     a. Verify HMAC                     │                  │                 │
│                                    │     b. Parse va_number → MILESTONE VA  │                  │                 │
│                                    │        entity_id=milestoneId           │                  │                 │
│                                    │     c. Find engagement for milestone   │                  │                 │
│                                    │        → client wallet + expert wallet │                  │                 │
│                                    │     d. Idempotency check               │                  │                 │
│                                    │     e. DB TX (atomic):                 │                  │                 │
│                                    │        CREATE milestone (auto)         │                  │                 │
│                                    │        [LEDGER: ESCROW_LOCK]           │                  │                 │
│                                    │        UPDATE client wallet:           │                  │                 │
│                                    │          available -= amount           │                  │                 │
│                                    │          locked += amount              │                  │                 │
│                                    │        INSERT wallet_transactions:     │                  │                 │
│                                    │          type:"ESCROW_LOCK"            │                  │                 │
│                                    │        INSERT escrow_accounts:         │                  │                 │
│                                    │          {milestone_id, amount,        │                  │                 │
│                                    │           client_wallet_id,            │                  │                 │
│                                    │           expert_wallet_id,            │                  │                 │
│                                    │           status:"HELD"}               │                  │                 │
│                                    │        UPDATE milestones SET           │                  │                 │
│                                    │          state:"FUNDED",               │                  │                 │
│                                    │          funded_at:now()               │                  │                 │
│                                    │        UPDATE engagement:              │                  │                 │
│                                    │          state:"ACTIVE"                │                  │                 │
│                                    │        UPDATE virtual_accounts SET     │                  │                 │
│                                    │          status:"USED"                 │                  │                 │
│                                    │        UPDATE paygated_documents SET   │                  │                 │
│                                    │          release_state:"RELEASED"      │                  │                 │
│                                    │          WHERE milestone_id=?          │                  │                 │
│                                    │        COMMIT                          │                  │                 │
│                                    │     f. Return 201 {success:true}       │                  │                 │
│                                    │                                        │                  │                 │
├────────────────────────────────────┼────────────────────────────────────────┼──────────────────┼─────────────────┤
│ ═══ PHASE C: DoD CHECKLIST ════════│                                        │                  │                 │
│                                    │                                        │                  │                 │
│                                    │                                        │ [7] Expert creates│                │
│                                    │                                        │ DoD items:        │                │
│                                    │                                        │ POST /milestones/ │                │
│                                    │                                        │   :id/dod/items   │                │
│                                    │                                        │ {item_description,│                │
│                                    │                                        │  is_required,     │                │
│                                    │                                        │  maps_to_criterion│                │
│                                    │                                        │  _id (optional)}  │                │
│                                    │ [8] INSERT milestone_dod_items:        │                   │                 │
│                                    │     {milestone_id, item_description,   │                   │                 │
│                                    │      is_required, status:"PENDING",    │                   │                 │
│                                    │      maps_to_criterion_id}             │                   │                 │
│                                    │                                        │                   │                 │
│                                    │                                        │ [9] Expert marks  │                 │
│                                    │                                        │ items complete:   │                 │
│                                    │                                        │ PUT /milestones/  │                 │
│                                    │                                        │   :id/dod/:itemId │                 │
│                                    │                                        │ {status:"COMPLETED│                 │
│                                    │                                        │  completion_note} │                 │
│                                    │ [10] UPDATE milestone_dod_items SET    │                   │                 │
│                                    │     status:"COMPLETED",                │                   │                 │
│                                    │     completed_at:now(),                │                   │                 │
│                                    │     completion_note:{text}             │                   │                 │
│                                    │     DB CHECK: required item cannot     │                   │                 │
│                                    │     be NOT_APPLICABLE (422)            │                   │                 │
│                                    │                                        │                   │                 │
├────────────────────────────────────┼────────────────────────────────────────┼───────────────────┼─────────────────┤
│ ═══ PHASE D: SUBMIT DELIVERABLE ═══│                                        │                   │                 │
│                                    │                                        │                   │                 │
│                                    │                                        │ [11] Expert stages│                 │
│                                    │                                        │ paygated doc:     │                 │
│                                    │                                        │ POST /milestones/ │                 │
│                                    │                                        │   :id/paygated-   │                 │
│                                    │                                        │   docs            │                 │
│                                    │                                        │ {document_url:    │                 │
│                                    │                                        │  "https://..."}   │                 │
│                                    │ [12] INSERT paygated_documents:        │                   │                 │
│                                    │     {milestone_id, document_url,       │                   │                 │
│                                    │      release_state:"STAGED"}           │                   │                 │
│                                    │     (Remains STAGED until IPN fires)   │                   │                 │
│                                    │                                        │                   │                 │
│                                    │                                        │ [13] Expert sub-  │                 │
│                                    │                                        │ mits deliverable: │                 │
│                                    │                                        │ POST /milestones/ │                 │
│                                    │                                        │   :id/submit      │                 │
│                                    │                                        │ {description,     │                 │
│                                    │                                        │  files_json}      │                 │
│                                    │ [14] DoD gate:                         │                   │                 │
│                                    │     SELECT COUNT required dod_items    │                   │                 │
│                                    │     WHERE status != "COMPLETED"        │                   │                 │
│                                    │     IF > 0 → 422 REQUIRED_DOD_         │                   │                 │
│                                    │       INCOMPLETE {missing_items:[...]} │                   │                 │
│                                    │     DB TX:                             │                   │                 │
│                                    │     INSERT milestone_submissions:      │                   │                 │
│                                    │       {milestone_id, expert_id,        │                   │                 │
│                                    │        description, files_json}        │                   │                 │
│                                    │     UPDATE milestones SET              │                   │                 │
│                                    │       state:"SUBMITTED",               │                   │                 │
│                                    │       submitted_at:now()               │                   │                 │
│                                    │                                        │                   │                 │
├────────────────────────────────────┼────────────────────────────────────────┼───────────────────┼─────────────────┤
│ ════════ PHASE E: SIGN-OFF ════════│                                        │                   │                 │
│                                    │                                        │                   │                 │
│                                    │                                        │                   │ [15] TECH_TEAM  │
│                                    │                                        │                   │ verifies each   │
│                                    │                                        │                   │ criterion:      │
│                                    │                                        │                   │ PUT /criteria/  │
│                                    │                                        │                   │   :id/verify    │
│                                    │                                        │                   │ {verification_  │
│                                    │                                        │                   │  comment?}      │
│                                    │ [16] UPDATE acceptance_criteria SET    │                   │                 │
│                                    │     verified_at:now()                  │                   │                 │
│                                    │     revision_note:null (cleared)       │                   │                 │
│                                    │     IF all required verified:          │                   │                 │
│                                    │       CHECK no open disputes           │                   │                 │
│                                    │       IF no disputes:                  │                   │                 │
│                                    │         UPDATE milestones SET          │                   │                 │
│                                    │           state:"APPROVED",            │                   │                 │
│                                    │           approved_at:now()            │                   │                 │
│                                    │         ledgerService.releaseMilestone │                   │                 │
│                                    │           WithTx():                    │                   │                 │
│                                    │           [LEDGER: ESCROW_RELEASE+FEE] │                   │                 │
│                                    │           UPDATE escrow_accounts:      │                   │                 │
│                                    │             status:"RELEASED"          │                   │                 │
│                                    │           UPDATE expert wallet:        │                   │                 │
│                                    │             available += net_amount    │                   │                 │
│                                    │           UPDATE client locked:        │                   │                 │
│                                    │             locked -= gross_amount     │                   │                 │
│                                    │           INSERT wallet_transactions   │                   │                 │
│                                    │             (ESCROW_RELEASE + FEE +    │                   │                 │
│                                    │              CREDIT — 3 rows)          │                   │                 │
│                                    │                                        │                   │                 │
│                                    │                                        │                   │ [17] OR: TECH_TEAM│
│                                    │                                        │                   │ rejects criterion:│
│                                    │                                        │                   │ PUT /criteria/  │
│                                    │                                        │                   │   :id/revision  │
│                                    │                                        │                   │ {revision_note} │
│                                    │ [18] UPDATE acceptance_criteria SET    │                   │                 │
│                                    │     revision_note:"{text}"             │                   │                 │
│                                    │     verified_at:null                   │                   │                 │
│                                    │     UPDATE milestones SET              │                   │                 │
│                                    │       state:"IN_REVISION"              │                   │                 │
└────────────────────────────────────┴────────────────────────────────────────┴───────────────────┴─────────────────┘
```

---

**Critical drifts from old doc:** (1) Criteria are created **inline with the milestone** in a single `POST /milestones` body — no separate `POST /milestones/:id/criteria`. (2) Milestone VA is generated **locally** (pattern: `VA-{6digits}`) — no SePay call from `PUT /milestones/:id/fund`. (3) DoD item endpoint: `POST /milestones/:id/dod/items` (not `/dod-items`). Update: `PUT /milestones/:id/dod/:itemId`. (4) Paygated docs: staged via `POST /milestones/:id/paygated-docs`; released automatically on IPN MILESTONE branch. (5) Criterion revision: `PUT /criteria/:id/revision` with `{revision_note}`. (6) Escrow release includes **3 wallet_transaction rows**: ESCROW_RELEASE, PLATFORM_FEE, and expert credit.

---

# MF-8: Dispute Filing & Layer 1 LLM Evaluation

## Overview

Expert or CEO files a dispute against a specific acceptance criterion. NestJS calls FastAPI for Layer 1 LLM evaluation. If confidence ≥ 0.80, dispute is AUTO_RESOLVED. Below threshold, escalates to MANUAL_REVIEW for admin (MF-18). Escrow is frozen on dispute filing and remains held during review.

**Tables touched (4):** `disputes`, `escrow_accounts`, `wallets`, `platform_decisions`

**Endpoints:** `POST /disputes`, `GET /disputes/:id`

---

## ASCII Swimlane

```
+──────────────────────────────────+────────────────────────────────────────+
│     EXPERT or CEO                │     SYSTEM (NestJS + FastAPI)          │
+──────────────────────────────────+────────────────────────────────────────+
│                                  │                                        │
│ [1] Files dispute:               │                                        │
│     {engagement_id,              │                                        │
│      milestone_id,               │                                        │
│      criterion_id,               │                                        │
│      escrow_account_id,          │                                        │
│      position_text}              │                                        │
│                 +────────────────>                                        │
│                                  │ [2] POST /disputes                     │
│                                  │     Insert dispute:                    │
│                                  │       filed_by=requester.id            │
│                                  │       state:"PENDING"                  │
│                                  │     UPDATE escrow_accounts SET         │
│                                  │       status:"FROZEN"                  │
│                                  │     UPDATE milestones SET              │
│                                  │       state:"DISPUTED"                 │
│                                  │                                        │
│                                  │ [3] FastAPI: POST /llm/dispute-eval    │
│                                  │     {criterion, submission,            │
│                                  │      filed_by_role, position}          │
│                                  │     Returns {confidence_score,         │
│                                  │       recommended_resolution,          │
│                                  │       reasoning}                       │
│                                  │                                        │
│                                  │ [4] UPDATE disputes SET                │
│                                  │     state:"LAYER_1_EVAL"               │
│                                  │     llm_confidence: score              │
│                                  │                                        │
│                                  │ [5] IF score ≥ 0.80:                   │
│                                  │     → AUTO_RESOLVED                    │
│                                  │     UPDATE disputes SET                │
│                                  │       state:"AUTO_RESOLVED",           │
│                                  │       resolved_at:now()                │
│                                  │     Apply recommended_resolution       │
│                                  │     (ledger ops — see MF-18 Phase A)   │
│                                  │     INSERT platform_decisions:         │
│                                  │       type:"DISPUTE_L1_EVAL",          │
│                                  │       decision:"AUTO_RESOLVED"         │
│                                  │                                        │
│                                  │ [6] IF score < 0.80:                   │
│                                  │     → MANUAL_REVIEW                    │
│                                  │     UPDATE disputes SET                │
│                                  │       state:"MANUAL_REVIEW"            │
│                                  │     INSERT platform_decisions:         │
│                                  │       type:"DISPUTE_L1_EVAL",          │
│                                  │       decision:"ESCALATED"             │
│                                  │     → Admin sees in MF-17 queue        │
│ <────────────────────────────────┤                                        │
│ [7] Dispute filed; parties       │                                        │
│     notified; escrow frozen      │                                        │
+──────────────────────────────────+────────────────────────────────────────+
```

---

## Dispute State Machine

```
PENDING → LAYER_1_EVAL
           → AUTO_RESOLVED (confidence ≥ 0.80) [LEDGER applied]
           → MANUAL_REVIEW (confidence < 0.80)
              → RESOLVED (admin decision — MF-18) [LEDGER applied]
```

---

## Group 3 — Path B: Service Marketplace

---

# MF-9: Expert Service Publishing

## Overview

Expert (Pro) uses AI Service Generator to create a service listing, then publishes to marketplace.

**Tables touched (2):** `services`, `expert_profiles`

**Endpoints:** `POST /services` (DRAFT), `PUT /services/:id` (publish DRAFT→PUBLISHED), `GET /services` (marketplace browse), `GET /services/:id`

---

## ASCII Swimlane

```
+──────────────────────────────────+──────────────────────────────────────+
│           EXPERT                 │     SYSTEM (NestJS + FastAPI)        │
+──────────────────────────────────+──────────────────────────────────────+
│                                  │                                      │
│ [1] Clicks "Create Service"      │                                      │
│     [Pro-E] guard                │                                      │
│                 +────────────────>                                      │
│ [2] Inputs key capabilities,     │                                      │
│     target use-cases, price      │                                      │
│     (AI generator is optional)   │                                      │
│                                  │                                      │
│ [3] Creates service:             │                                      │
│     {title, description,         │                                      │
│      domains_json, seams_json,   │                                      │
│      price_vnd, service_type}    │                                      │
│                 +────────────────>                                      │
│                                  │ [4] POST /services  [EXPERT only]    │
│                                  │     INSERT services:                 │
│                                  │       {expert_id, title, description,│
│                                  │        domains_json, seams_json,     │
│                                  │        price_vnd, state:"DRAFT",     │
│                                  │        service_type:"AI_SERVICE"     │
│                                  │          or "TECH_DISCOVERY"}        │
│                 +<────────────────                                      │
│ [5] Expert edits draft, clicks   │                                      │
│     "Publish"                    │                                      │
│                 +────────────────>                                      │
│                                  │ [6] PUT /services/:id  [EXPERT only] │
│                                  │     Guard: owner check               │
│                                  │     Guard: state != SUSPENDED → 422  │
│                                  │     UPDATE services SET              │
│                                  │       state:"PUBLISHED"              │
│                 +<────────────────                                      │
│ [7] Service visible in           │                                      │
│     marketplace                  │                                      │
+──────────────────────────────────+──────────────────────────────────────+
```

---

# MF-10: Client Buys Service / Tech Discovery

## Overview

CEO browses marketplace and purchases a service. Creates SERVICE_PURCHASE engagement in PENDING state. VA is generated locally. SePay IPN credits escrow atomically, transitions engagement to ACTIVE, and creates a single auto-milestone in FUNDED state.

**Tables touched (5):** `services`, `engagements`, `virtual_accounts`, `escrow_accounts`, `milestones`, `wallets`, `wallet_transactions`

**Endpoints:** `GET /services`, `GET /services/:id`, `POST /services/:id/purchase`, `POST /webhooks/sepay/ipn`

---

## ASCII Swimlane

```
+──────────────────────────────────+────────────────────────────────────────+───────────────────+
│        CLIENT / CEO              │     SYSTEM (NestJS)                    │     SePay         │
+──────────────────────────────────+────────────────────────────────────────+───────────────────+
│                                  │                                        │                   │
│ [1] Browses marketplace          │                                        │                   │
│     GET /services                │                                        │                   │
│     (no subscription required)   │                                        │                   │
│                                  │                                        │                   │
│ [2] Clicks "Buy"                 │                                        │                   │
│                 +────────────────>                                        │                   │
│                                  │ [3] POST /services/:id/purchase        │                   │
│                                  │     [CLIENT (CEO only)]                │                   │
│                                  │     Guard: clientSubtype="CEO"         │                   │
│                                  │     Guard: service.state="PUBLISHED"   │                   │
│                                  │     DB TX:                             │                   │
│                                  │     INSERT engagements:                │                   │
│                                  │       {service_id, expert_id,          │                   │
│                                  │        client_id, type:                │                   │
│                                  │        "SERVICE_PURCHASE" or           │                   │
│                                  │        "TECH_DISCOVERY",               │                   │
│                                  │        state:"PENDING",                │                   │
│                                  │        project_id:NULL}                │                   │
│                                  │     INSERT virtual_accounts:           │                   │
│                                  │       {entity_type:"SERVICE",          │                   │
│                                  │        entity_id:engagement_id,        │                   │
│                                  │        fixed_amount:service.price_vnd, │                   │
│                                  │        expires_at:now()+24h,           │                   │
│                                  │        status:"ACTIVE"}                │                   │
│                                  │     Return {qrCodeUrl, vaNumber}       │                   │
│                 +<────────────────                                        │                   │
│ [4] CEO scans QR, transfers      │                                        │                   │
│     exact service price          │                                        │                   │
│                                  │                                        │ [5] SePay IPN     │
│                                  │              +<────────────────────────│ POST /webhooks/   │
│                                  │ [6] IPN SERVICE branch:                │   sepay/ipn       │
│                                  │     a. Verify HMAC                     │                   │
│                                  │     b. Resolve VA → engagement_id      │                   │
│                                  │     c. Idempotency check               │                   │
│                                  │     d. DB TX (atomic):                 │                   │
│                                  │        [LEDGER: ESCROW_LOCK]           │                   │
│                                  │        INSERT escrow_accounts:         │                   │
│                                  │          {engagement_id (not mile-     │                   │
│                                  │           stone_id), status:"HELD"}    │                   │
│                                  │        INSERT milestones:              │                   │
│                                  │          {milestoneNumber:1,           │                   │
│                                  │           signOffAuthority:"CEO",      │                   │
│                                  │           paymentAmountVnd: transfer   │                   │
│                                  │             Amount, state:"FUNDED",    │                   │
│                                  │           fundedAt:now()}              │                   │
│                                  │        UPDATE engagements SET          │                   │
│                                  │          state:"ACTIVE"                │                   │
│                                  │        UPDATE virtual_accounts SET     │                   │
│                                  │          status:"USED"                 │                   │
│                                  │        COMMIT                          │                   │
│                                  │     e. Return 201 {success:true}       │                   │
│                 +<────────────────                                        │                   │
│ [7] Engagement ACTIVE            │                                        │                   │
│     CEO sole sign-off authority  │                                        │                   │
│     Single milestone, no bid     │                                        │                   │
+──────────────────────────────────+────────────────────────────────────────+───────────────────+
```

---

## Group 4 — Financial Flows

---

# MF-11: Wallet Top-Up

## Overview

User requests a VietQR from their permanent WALLET_TOPUP VA. SePay IPN credits wallet. Pure internal ledger — VA is pre-created at registration (no SePay call needed to generate it).

**Tables touched (3):** `virtual_accounts`, `wallets`, `wallet_transactions`

**Endpoints:** `POST /wallets/virtual-accounts/topup`, `POST /webhooks/sepay/ipn`

See MF-1 Phase B for the full swimlane. Summarized:

| Step | Actor | Action | Tables | Endpoint |
|---|---|---|---|---|
| 1 | User | Request QR for amount | `virtual_accounts` (R) | `POST /wallets/virtual-accounts/topup` |
| 2-3 | NestJS | Return `{qrCodeUrl, paymentReference}` | — | — |
| 4-5 | User→Bank→SePay | Transfer + IPN fires | — | External |
| 6 | NestJS | HMAC verify → parse VA → idempotency → credit wallet | `wallets` (U), `wallet_transactions` (C) | `POST /webhooks/sepay/ipn` |

**Idempotency:** `wallet_transactions` deduplicated on `(wallet_id, reference_id)` — retried IPN cannot double-credit.

---

# MF-12: Expert Withdrawal

## Overview

Expert requests cash-out to their linked bank account. System debits wallet and creates a withdrawal request. **No automated chi hộ API call exists** — the withdrawal queue is managed manually by Admin (MF-17/MF-18). Admin confirms via `PUT /admin/withdrawals/:id/complete` which marks the withdrawal COMPLETED and advances the milestone to RELEASED if applicable.

**Tables touched (3):** `wallets`, `wallet_transactions`, `withdrawal_requests`

**Endpoints:** `POST /withdrawals`, `GET /withdrawals`

---

## ASCII Swimlane

```
+──────────────────────────────────+────────────────────────────────────────+───────────────────+
│           EXPERT                 │     SYSTEM (NestJS)                    │    ADMIN          │
+──────────────────────────────────+────────────────────────────────────────+───────────────────+
│                                  │                                        │                   │
│ [1] Clicks "Withdraw"            │                                        │                   │
│     {amount: 2000 VND minimum}   │                                        │                   │
│                 +────────────────>                                        │                   │
│                                  │ [2] POST /withdrawals  [EXPERT only]   │                   │
│                                  │     Guard: user.sepay_bank_account_    │                   │
│                                  │       xid IS NOT NULL (409 if not)     │                   │
│                                  │     Guard: wallet.available ≥ amount   │                   │
│                                  │       (422 INSUFFICIENT_BALANCE)       │                   │
│                                  │     DB TX (atomic):                    │                   │
│                                  │     UPDATE wallets SET                 │                   │
│                                  │       available_balance -= amount      │                   │
│                                  │     INSERT wallet_transactions:        │                   │
│                                  │       type:"WITHDRAWAL", amount,       │                   │
│                                  │       ref:"WD-{withdrawal_id}"         │                   │
│                                  │     INSERT withdrawal_requests:        │                   │
│                                  │       {expert_id,                      │                   │
│                                  │        type:"EXPERT_MANUAL",           │                   │
│                                  │        amount, bank_account_xid,       │                   │
│                                  │        status:"PENDING"}               │                   │
│                                  │     COMMIT                             │                   │
│                                  │     Return {withdrawal_request_id,     │                   │
│                                  │       status:"PENDING", message:       │                   │
│                                  │       "Tiền sẽ về trong 1-3 ngày..."}  │                   │
│                 +<────────────────                                        │                   │
│ [3] Withdrawal pending           │                                        │                   │
│     (no immediate payout)        │                                        │                   │
│                                  │                                        │ [4] Admin reviews │
│                                  │                                        │ GET /admin/       │
│                                  │                                        │ withdrawals       │
│                                  │                                        │                   │
│                                  │                                        │ [5] Admin confirms│
│                                  │                                        │ PUT /admin/       │
│                                  │                                        │ withdrawals/:id/  │
│                                  │                                        │ complete          │
│                                  │ [6] UPDATE withdrawal_requests SET     │                   │
│                                  │     status:"COMPLETED",                │                   │
│                                  │     confirmed_at:now()                 │                   │
│                                  │     IF type=MILESTONE_RELEASE AND      │                   │
│                                  │       milestone.state=APPROVED:        │                   │
│                                  │       UPDATE milestones SET            │                   │
│                                  │         state:"RELEASED"               │                   │
│                                  │       IF no unreleased milestones:     │                   │
│                                  │         UPDATE engagement SET          │                   │
│                                  │           state:"CLOSED"               │                   │
│                                  │                                        │                   │
│                                  │                                        │ [7] IF failed:    │
│                                  │                                        │ PUT /admin/       │
│                                  │                                        │ withdrawals/:id/  │
│                                  │                                        │ fail              │
│                                  │ [8] Refund to wallet:                  │                   │
│                                  │     UPDATE wallets SET                 │                   │
│                                  │       available += amount              │                   │
│                                  │     INSERT wallet_transactions:        │                   │
│                                  │       type:"WITHDRAWAL",               │                   │
│                                  │       ref:"WD-{id}-REVERSAL"           │                   │
│                                  │     UPDATE withdrawal_requests SET     │                   │
│                                  │       status:"FAILED"                  │                   │
+──────────────────────────────────+────────────────────────────────────────+───────────────────+
```

---

**Critical drift from old doc:** No SePay chi hộ API call. No automatic `disbursement_id`. No `PROCESSING` status. The full lifecycle is: PENDING → COMPLETED (admin confirms) or FAILED (admin fails + refunds wallet).

---

# MF-13: Subscription Purchase from Wallet

## Overview

Pure internal wallet deduction. No VA, no IPN. Body uses `{activeRole}` (not `{role_type}`).

**Tables touched (3):** `users`, `wallets`, `wallet_transactions`

**Endpoints:** `POST /subscriptions/activate`, `GET /subscriptions/status`

---

## ASCII Swimlane

```
+──────────────────────────────────+────────────────────────────────────────+
│           USER                   │     SYSTEM (NestJS)                    │
+──────────────────────────────────+────────────────────────────────────────+
│                                  │                                        │
│ [1] Clicks "Activate Pro"        │                                        │
│     Client Pro: 500,000 VND/6mo  │                                        │
│     Expert Pro: 300,000 VND/6mo  │                                        │
│                 +────────────────>                                        │
│                                  │ [2] POST /subscriptions/activate       │
│                                  │     {activeRole: "CLIENT"|"EXPERT"}    │
│                                  │     Guard: user.active_role must       │
│                                  │       match activeRole (409 if not)    │
│                                  │     Guard: already pro + not expired   │
│                                  │       → 409 ALREADY_SUBSCRIBED         │
│                                  │     DB TX:                             │
│                                  │     wallet.available < price → 422     │
│                                  │       INSUFFICIENT_BALANCE             │
│                                  │     UPDATE wallets SET                 │
│                                  │       available_balance -= price       │
│                                  │     INSERT wallet_transactions:        │
│                                  │       type:"SUBSCRIPTION",             │
│                                  │       ref:"SUB-{uid}:{role}:{ts}"      │
│                                  │     UPDATE users SET                   │
│                                  │       subscription_{role}_tier:"pro",  │
│                                  │       sub_{role}_expires_at:now()+6mo  │
│                                  │     COMMIT                             │
│                                  │     Reissue JWT with updated claims    │
│                                  │     Return {access_token: "<new>"}     │
│                 +<────────────────                                        │
│ [3] Store new token              │                                        │
│     ✓ Pro subscription active    │                                        │
+──────────────────────────────────+────────────────────────────────────────+
```

---

# MF-14: Pay-Gated Document Release (IPN-Triggered)

## Overview

Expert stages a paygated document (`release_state="STAGED"`) via `POST /milestones/:id/paygated-docs`. When the SePay IPN MILESTONE branch fires and escrow is locked, ALL staged documents for that milestone are atomically flipped to `release_state="RELEASED"`. TECH_TEAM (and EXPERT) can then access them via `GET /milestones/:id/paygated-docs`. CEO is permanently excluded.

**Tables touched (2):** `paygated_documents`, `milestones`

**Endpoints:** `POST /milestones/:id/paygated-docs`, `GET /milestones/:id/paygated-docs`

| Step | Actor | Tables | Endpoint |
|---|---|---|---|
| 1 | Expert | `paygated_documents` (C, release_state="STAGED") | `POST /milestones/:id/paygated-docs` |
| 2 | SePay IPN (auto) | `paygated_documents` (U, release_state: STAGED→RELEASED) | Internal in IPN handler |
| 3 | TECH_TEAM/Expert | `paygated_documents` (R — only RELEASED docs returned; STAGED = 403) | `GET /milestones/:id/paygated-docs` |

Access control: CEO (client_subtype="CEO") always gets 403. EXPERT must be the engagement party. TECH_TEAM must be linked to the project.

---

# MF-15: Seam Verification (Tier 1→2 Portfolio Auto-Upgrade)

See MF-2 Phase C for the full swimlane. Summary:

**Tables touched (3):** `portfolio_submissions`, `expert_seam_claims`, `platform_decisions`

**Endpoints:** `POST /portfolio-submissions`, `GET /portfolio-submissions/:id`

**Key constraint: max 5 attempts per seam claim before 30-day lockout.** Submission count is tracked on `expert_seam_claims.submission_count`. On 5th failure, `locked_until = now() + 30 days`. Requests while locked return HTTP 429.

**Critical drift:** `GET /portfolio-submissions/{id}/eval-result` does not exist — use `GET /portfolio-submissions/:id` which returns `{id, seamClaimId, status, llmConfidence, advisoryNote, submittedAt, evaluatedAt}`.

---

# MF-16: Messaging & Real-Time Notification

## Overview

Messages can be scoped to an **engagement** (bilateral post-bid thread) or a **project** (pre-bid open thread — any expert + CEO/TECH_TEAM). Exactly one of `engagement_id` or `project_id` must be present. WebSocket gateway (`MessagesGateway`) handles real-time delivery. `message_reads` tracks per-user read state for unread badge.

**Tables touched (3):** `messages`, `message_reads`, `engagements`

**Endpoints:** `POST /messages`, `GET /messages?engagementId=`, `GET /messages?projectId=`, `PUT /messages/:id/read`

---

## ASCII Swimlane

```
+──────────────────────────────────+────────────────────────────────────────+
│        SENDER (any party)        │     SYSTEM (NestJS + Socket.io)        │
+──────────────────────────────────+────────────────────────────────────────+
│                                  │                                        │
│ [1] Sends message:               │                                        │
│     {engagement_id XOR project_id│                                        │
│      content, attachment_url?}   │                                        │
│                 +────────────────>                                        │
│                                  │ [2] POST /messages                     │
│                                  │     Validate: exactly one ID present   │
│                                  │       (400 if both or neither)         │
│                                  │     Party check:                       │
│                                  │       engagement_id: client/expert/    │
│                                  │         linked TECH_TEAM               │
│                                  │       project_id: CEO (owner) /        │
│                                  │         any EXPERT / linked TECH_TEAM  │
│                                  │     INSERT messages: {sender_id,       │
│                                  │       engagement_id OR project_id,     │
│                                  │       content, attachment_url}         │
│                                  │     Emit via Socket.io to room         │
│                 +<────────────────                                        │
│ [3] Message delivered            │                                        │
│                                  │                                        │
│ [4] Recipient marks read:        │                                        │
│     PUT /messages/:id/read       │                                        │
│                 +────────────────>                                        │
│                                  │ [5] UPSERT message_reads:              │
│                                  │     {message_id, user_id, read_at}     │
│                 +<────────────────                                        │
│                                  │                                        │
│ [6] Get history:                 │                                        │
│     GET /messages?engagementId=  │                                        │
│     OR GET /messages?projectId=  │                                        │
│                 +────────────────>                                        │
│                                  │ [7] SELECT messages (party check),     │
│                                  │     paginated cursor (limit=50)        │
│                                  │     Return [{sender: {id,email,        │
│                                  │       fullName, activeRole}, ...}]     │
│                 +<────────────────                                        │
+──────────────────────────────────+────────────────────────────────────────+
```

---

**Critical drift from old doc:** `CreateMessageDto` has `engagement_id` OR `project_id` (mutually exclusive). Pre-bid messages on a published project use `project_id` (no engagement exists yet). There is no `GET /engagements/:id/messages` — query param style: `GET /messages?engagementId=` or `GET /messages?projectId=`.

---

## Group 5 — Admin Flows

---

# MF-17: Platform Integrity Monitor & Analytics

## Overview

Read-only (plus the write actions in MF-18) admin dashboard. Displays platform_decisions log, dispute queue, transaction ledger, analytics, and withdrawal queue.

**Tables touched (read only):** `platform_decisions`, `wallet_transactions`, `disputes`, `escrow_accounts`, `users`, `withdrawal_requests`

**Endpoints:** `GET /admin/decisions`, `GET /admin/disputes`, `GET /admin/transactions`, `GET /admin/analytics`, `GET /admin/withdrawals`

---

## ASCII Swimlane

```
+──────────────────────────────────+──────────────────────────────────────+
│           ADMIN                  │     SYSTEM (NestJS)                  │
+──────────────────────────────────+──────────────────────────────────────+
│ [1] Opens Admin Dashboard        │                                      │
│                 +────────────────>                                      │
│                                  │ [2] GET /admin/decisions             │
│                                  │     ?decisionType=&entityType=       │
│                                  │     SELECT platform_decisions        │
│                                  │     ORDER BY created_at DESC         │
│                                  │     LIMIT 200                        │
│                                  │     Types (6): ELICITATION_SYNTHESIS,│
│                                  │     SPEC_AUTO_RETURN,                │
│                                  │     SEAM_TIER_UPGRADE,               │
│                                  │     PORTFOLIO_EVAL,                  │
│                                  │     DISPUTE_L1_EVAL,                 │
│                                  │     CRITERION_QUALITY_GATE           │
│                 +<────────────────                                      │
│ [3] Views LLM decisions with     │                                      │
│     confidence scores +          │                                      │
│     advisory notes               │                                      │
│                                  │                                      │
│ [4] Views Dispute Monitor        │                                      │
│                 +────────────────>                                      │
│                                  │ [5] GET /admin/disputes              │
│                                  │     ?state=MANUAL_REVIEW             │
│                                  │     Returns disputes with            │
│                                  │     escrow_account details           │
│                 +<────────────────                                      │
│ [6] For MANUAL_REVIEW disputes:  │                                      │
│     → See MF-18 for resolution   │                                      │
│                                  │                                      │
│ [7] Views Transaction Ledger     │                                      │
│                 +────────────────>                                      │
│                                  │ [8] GET /admin/transactions          │
│                                  │     ?type=&userId=                   │
│                                  │     SELECT wallet_transactions       │
│                                  │     JOIN wallets JOIN users          │
│                                  │     LIMIT 200                        │
│                                  │     Return {id, amount (Number),     │
│                                  │       transactionType, referenceId,  │
│                                  │       createdAt, userEmail,          │
│                                  │       userFullName}                  │
│                 +<────────────────                                      │
│                                  │                                      │
│ [9] Views Analytics              │                                      │
│                 +────────────────>                                      │
│                                  │ [10] GET /admin/analytics            │
│                                  │      Computed from DB:               │
│                                  │      {active_projects_by_archetype_  │
│                                  │        tier,                         │
│                                  │       elicitation_completion_rate_pct│
│                                  │       portfolio_auto_upgrade_rate_pct│
│                                  │       dispute_rate_pct,              │
│                                  │       dispute_auto_resolve_rate_pct, │
│                                  │       milestone_completion_rate_pct} │
│                 +<────────────────                                      │
│                                  │                                      │
│ [11] Views Withdrawal Queue      │                                      │
│                 +────────────────>                                      │
│                                  │ [12] GET /admin/withdrawals          │
│                                  │      ?status=PENDING                 │
│                                  │      SELECT withdrawal_requests      │
│                                  │      ORDER BY requested_at DESC      │
│                 +<────────────────                                      │
+──────────────────────────────────+──────────────────────────────────────+
```

---

# MF-18: Manual Dispute Resolution & Account Management

## Overview

Admin's write actions: (1) resolve MANUAL_REVIEW disputes, (2) emergency spec pull-back, (3) account suspension, (4) withdrawal queue management (complete/fail).

**Tables touched:** `disputes`, `escrow_accounts`, `wallets`, `wallet_transactions`, `projects`, `users`, `withdrawal_requests`, `milestones`

**Endpoints:** `PUT /admin/disputes/:id/resolve`, `PUT /admin/projects/:id/suspend-spec`, `PUT /admin/users/:id/suspend`, `PUT /admin/withdrawals/:id/complete`, `PUT /admin/withdrawals/:id/fail`

---

## ASCII Swimlane

```
┌───────────────────────────────────┬───────────────────────────────────┬───────────────────────────────────┐
│               ADMIN               │          SYSTEM (NestJS)          │         AFFECTED PARTIES          │
├───────────────────────────────────┼───────────────────────────────────┼───────────────────────────────────┤
│ ═════ DISPUTE RESOLUTION ════════ │                                   │                                   │
│                                   │                                   │                                   │
│ [1] Views MANUAL_REVIEW dispute   │                                   │                                   │
│     Sees: criterion, deliverable, │                                   │                                   │
│     both positions, escrow amount,│                                   │                                   │
│     LLM confidence (< 0.80)       │                                   │                                   │
│                                   │                                   │                                   │
│ [2] Clicks one of 3 buttons:      │                                   │                                   │
│     "EXPERT_WINS"                 │                                   │                                   │
│     "CLIENT_WINS"                 │                                   │                                   │
│     "SPLIT"                       │                                   │                                   │
│        └─────────────────────────>│                                   │                                   │
│                                   │ [3] PUT /admin/disputes/:id/      │                                   │
│                                   │       resolve                     │                                   │
│                                   │     {decision: "EXPERT_WINS"      │                                   │
│                                   │        | "CLIENT_WINS" | "SPLIT"} │                                   │
│                                   │     Guard: active_role='ADMIN'    │                                   │
│                                   │     Guard: dispute.state=         │                                   │
│                                   │       'MANUAL_REVIEW'             │                                   │
│                                   │     DB TX (atomic):               │                                   │
│                                   │     UPDATE disputes SET           │                                   │
│                                   │       state:'RESOLVED',           │                                   │
│                                   │       resolved_at:now()           │                                   │
│                                   │                                   │                                   │
│                                   │     Per decision:                 │                                   │
│                                   │     EXPERT_WINS:                  │                                   │
│                                   │       [ESCROW_RELEASE + FEE]      │                                   │
│                                   │       expert avail += net         │                                   │
│                                   │       client locked -= gross      │                                   │
│                                   │       escrow status:"RELEASED"    │                                   │
│                                   │                                   │                                   │
│                                   │     CLIENT_WINS:                  │                                   │
│                                   │       [ESCROW_REFUND]             │                                   │
│                                   │       client avail += amount      │                                   │
│                                   │       client locked -= amount     │                                   │
│                                   │       escrow status:"REFUNDED"    │                                   │
│                                   │                                   │                                   │
│                                   │     SPLIT:                        │                                   │
│                                   │       [ESCROW_SPLIT]              │                                   │
│                                   │       client avail += amount/2    │                                   │
│                                   │       expert avail += amount/2    │                                   │
│                                   │       client locked -= amount     │                                   │
│                                   │       escrow status:"SPLIT"       │                                   │
│                                   │                                   │                                   │
│                                   │     COMMIT                        │                                   │
│ <─────────────────────────────────┼─┘                                 │                                   │
│ [4] Resolution confirmed          │                                   │ [5] Parties notified              │
│     Ledger settled                │                                   │     per resolution outcome        │
│                                   │                                   │                                   │
├───────────────────────────────────┼───────────────────────────────────┼───────────────────────────────────┤
│ ════════ SPEC PULL-BACK ═════════ │                                   │                                   │
│                                   │                                   │                                   │
│ [6] Admin identifies published    │                                   │                                   │
│     spec with critical issue      │                                   │                                   │
│        └─────────────────────────>│                                   │                                   │
│                                   │ [7] PUT /admin/projects/:id/      │                                   │
│                                   │       suspend-spec                │                                   │
│                                   │     DB TX:                        │                                   │
│                                   │     UPDATE projects SET           │                                   │
│                                   │       state:'SUSPENDED'           │                                   │
│                                   │     INSERT platform_decisions:    │                                   │
│                                   │       type:'SPEC_AUTO_RETURN',    │                                   │
│                                   │       decision:'SUSPENDED',       │                                   │
│                                   │       advisory_note:'Admin        │                                   │
│                                   │         suspension'               │                                   │
│ <─────────────────────────────────┼─┘                                 │                                   │
│ [8] Spec hidden from marketplace  │                                   │                                   │
│     and matching engine           │                                   │                                   │
│                                   │                                   │                                   │
├───────────────────────────────────┼───────────────────────────────────┼───────────────────────────────────┤
│ ══════ ACCOUNT SUSPENSION ═══════ │                                   │                                   │
│                                   │                                   │                                   │
│ [9] Admin identifies abusive      │                                   │                                   │
│     account                       │                                   │                                   │
│        └─────────────────────────>│                                   │                                   │
│                                   │ [10] PUT /admin/users/:id/suspend │                                   │
│                                   │      Guard: active_role='ADMIN'   │                                   │
│                                   │      UPDATE users SET             │                                   │
│                                   │        is_active = false          │                                   │
│                                   │      (No JWT blacklist — JWTs     │                                   │
│                                   │       expire naturally after 7d;  │                                   │
│                                   │       RolesGuard reads is_active  │                                   │
│                                   │       from token claims not DB)   │                                   │
│ <─────────────────────────────────┼─┘                                 │                                   │
│ [11] Account suspended            │                                   │                                   │
│                                   │                                   │                                   │
├───────────────────────────────────┼───────────────────────────────────┼───────────────────────────────────┤
│ ═════ WITHDRAWAL MANAGEMENT ═════ │                                   │                                   │
│                                   │                                   │                                   │
│ [12] Reviews withdrawal queue     │                                   │                                   │
│      GET /admin/withdrawals       │                                   │                                   │
│      Confirms payout manually     │                                   │                                   │
│        └─────────────────────────>│                                   │                                   │
│                                   │ [13] PUT /admin/withdrawals/:id/  │                                   │
│                                   │       complete                    │                                   │
│                                   │      UPDATE withdrawal_requests   │                                   │
│                                   │        SET status:'COMPLETED'     │                                   │
│                                   │      IF MILESTONE_RELEASE type:   │                                   │
│                                   │        UPDATE milestones SET      │                                   │
│                                   │          state:'RELEASED'         │                                   │
│                                   │        IF last unreleased → UPDATE│                                   │
│                                   │          engagement state:'CLOSED'│                                   │
│                                   │                                   │                                   │
│ [14] OR: marks failed + refunds   │                                   │                                   │
│        └─────────────────────────>│                                   │                                   │
│                                   │ [15] PUT /admin/withdrawals/:id/  │                                   │
│                                   │       fail                        │                                   │
│                                   │      DB TX:                       │                                   │
│                                   │      UPDATE wallet: avail += amt  │                                   │
│                                   │      INSERT wallet_transactions:  │                                   │
│                                   │        type:'WITHDRAWAL',         │                                   │
│                                   │        ref:'WD-{id}-REVERSAL'     │                                   │
│                                   │      UPDATE withdrawal_requests   │                                   │
│                                   │        SET status:'FAILED'        │                                   │
└───────────────────────────────────┴───────────────────────────────────┴───────────────────────────────────┘
```

---

**Critical drifts from old doc:** (1) Admin dispute resolution DTO uses `{decision: "EXPERT_WINS" | "CLIENT_WINS" | "SPLIT"}` (not "Release to Expert" / "Refund to Client" / "Split 50/50"). (2) `PUT /admin/projects/:id/suspend-spec` also inserts a `platform_decisions` row. (3) **No token blacklist** — `is_active=false` only prevents future logins (when a new JWT would be issued), existing tokens remain valid until 7d expiry. (4) Admin now has dedicated withdrawal management: `PUT /admin/withdrawals/:id/complete` and `PUT /admin/withdrawals/:id/fail` — these are the mechanism for the missing chi hộ automation.

---

## Cross-Table Ledger Operations Summary

Every financial action resolves to one of these atomic wallet transaction patterns:

| Transaction Type | Wallet Debit | Wallet Credit | Trigger | Flow |
|---|---|---|---|---|
| `TOP_UP` | — | `available_balance += amount` | SePay IPN (WALLET_TOPUP VA) | MF-11 |
| `SUBSCRIPTION` | `available_balance -= price` | — | User activates Pro | MF-13 |
| `ESCROW_LOCK` | `available_balance -= amount`, `locked_balance += amount` | — | SePay IPN (MILESTONE or SERVICE VA) | MF-7, MF-10 |
| `ESCROW_RELEASE` | `locked_balance -= gross` | `expert.available += net` | All required criteria verified | MF-7 |
| `PLATFORM_FEE` | — | `platform.available += fee` | Deducted on escrow release | MF-7 |
| `ESCROW_REFUND` | `locked_balance -= amount` | `client.available += amount` | Dispute: CLIENT_WINS | MF-8, MF-18 |
| `ESCROW_SPLIT` | `locked_balance -= amount` | Both `+= amount/2` | Admin SPLIT | MF-18 |
| `WITHDRAWAL` | `expert.available -= amount` | — | Expert cash-out request | MF-12 |

**Every row in `wallet_transactions` is immutable.** Idempotency is enforced by checking `(wallet_id, reference_id)` on IPN ingestion — SePay retries cannot double-credit.

**Platform fee is never hardcoded:** `SELECT platform_fee_pct FROM platform_settings LIMIT 1` read at release time. Default 0.05 (5%).

---

## Appendix: 28-Table Coverage Matrix

| # | Table | Created By | Read By | Updated By | Primary Flows |
|---|---|---|---|---|---|
| 1 | `users` | MF-1, MF-2, MF-3 | MF-1,2,5,13,15,17 | MF-1 (sub tier), MF-2 (bank link), MF-13 (sub tier), MF-18 (is_active) | All |
| 2 | `client_profiles` | MF-1 | — | MF-1 (company_name via taxCode) | MF-1 |
| 3 | `expert_profiles` | MF-2 | MF-5, MF-9 | MF-2 (stack_tags, archetype, engagement_model) | MF-2, MF-5, MF-9 |
| 4 | `tech_team_profiles` | MF-3 | MF-3, MF-4 | MF-4 (linked_project_id via handleGatePassed) | MF-3, MF-4 |
| 5 | `wallets` | MF-1, MF-2 | MF-11,12,13 | MF-1(topup), MF-7,10,11,12,13,18(ledger ops) | MF-1,2,7,10,11,12,13,18 |
| 6 | `wallet_transactions` | MF-1,2,7,8,10,11,12,13,18 | MF-17 | — (immutable) | All financial |
| 7 | `virtual_accounts` | MF-1,2 (WALLET_TOPUP at reg), MF-7 (MILESTONE), MF-10 (SERVICE) | MF-11 | MF-7,10 (status→USED on IPN) | MF-1,2,7,10,11 |
| 8 | `withdrawal_requests` | MF-12 | MF-17 | MF-12(admin complete/fail), MF-18 | MF-12,17,18 |
| 9 | `platform_settings` | seed | MF-7 (fee_pct) | — | MF-7 |
| 10 | `elicitation_sessions` | MF-4 | MF-4 | MF-4 (all stage updates, handoff jti, consumed_at) | MF-4 |
| 11 | `projects` | MF-4 (via handleGatePassed) | MF-5,6,17 | MF-18 (SUSPENDED) | MF-4,5,6,9,10,17,18 |
| 12 | `expert_domain_depths` | MF-2 | MF-5 | MF-2 (UPSERT) | MF-2, MF-5 |
| 13 | `expert_seam_claims` | MF-2 | MF-5 | MF-15 (verification_tier, submission_count, locked_until) | MF-2, MF-5, MF-15 |
| 14 | `portfolio_submissions` | MF-15 | MF-15 | MF-15 (status, llm_confidence, evaluated_at) | MF-15 |
| 15 | `services` | MF-9 | MF-10 | MF-9 (state: DRAFT→PUBLISHED) | MF-9, MF-10 |
| 16 | `engagements` | MF-6(PROJECT_BASED), MF-10(SERVICE_PURCHASE/TECH_DISCOVERY) | MF-6,7,8 | MF-6(NDA→CONNECTED), MF-7(IPN→ACTIVE), MF-18(admin→CLOSED) | MF-6,7,8,10,18 |
| 17 | `capability_bids` | MF-6 | MF-6 | MF-6 (tech_status, ceo_status, state, version_number, tech_feedback, negotiated_price_vnd) | MF-6 |
| 18 | `milestones` | MF-7(CEO creates), MF-10(auto-created on IPN) | MF-7,8 | MF-7 (state machine), MF-8 (DISPUTED), MF-12 (RELEASED), MF-18 (RELEASED on withdrawal complete) | MF-7,8,10,12,14,18 |
| 19 | `acceptance_criteria` | MF-7 (inline with milestone POST) | MF-7,8 | MF-7 (verified_at, revision_note) | MF-7, MF-8 |
| 20 | `milestone_dod_items` | MF-7 | MF-7 | MF-7 (status, completion_note, not_applicable_note) | MF-7 |
| 21 | `milestone_submissions` | MF-7 | MF-7 | — | MF-7 |
| 22 | `paygated_documents` | MF-14 | MF-14 | MF-14 (release_state: STAGED→RELEASED via IPN) | MF-7, MF-14 |
| 23 | `escrow_accounts` | MF-7 (MILESTONE path), MF-10 (SERVICE path) | MF-8,17 | MF-7,8,18 (status: HELD→RELEASED/REFUNDED/SPLIT/FROZEN) | MF-7,8,10,18 |
| 24 | `disputes` | MF-8 | MF-8,17 | MF-8(state machine), MF-18(RESOLVED) | MF-8, MF-18 |
| 25 | `messages` | MF-16 | MF-16 | — (immutable) | MF-16 |
| 26 | `message_reads` | MF-16 (UPSERT on mark-read) | MF-16 (unread count) | MF-16 | MF-16 |
| 27 | `reviews` | MF (post-CLOSED engagement) | MF-17 | — | Post-engagement |
| 28 | `platform_decisions` | MF-4 (synthesis/return), MF-7 (criterion quality gate), MF-8 (dispute eval), MF-15 (portfolio), MF-18 (spec suspend) | MF-17 | — (immutable) | MF-4,7,8,15,17,18 |

---

## Appendix: Definitive Endpoint Index

| Method | Path | Role | Sub Gate | Notes |
|---|---|---|---|---|
| POST | `/auth/register` | — | — | Body: `{email, password, fullName, phone?, roles:"CLIENT_CEO"\|"EXPERT", selfTechnical?, taxCode?}` |
| POST | `/auth/login` | — | — | Returns `{access_token, refresh_token, user}` |
| POST | `/auth/refresh` | — | — | Body: `{refresh_token}` |
| PUT | `/auth/switch-role` | CLIENT/EXPERT | — | Body: `{activeRole}` |
| POST | `/auth/register/handoff` | — | — | Body: `{invite_token, email, password, fullName}` |
| GET | `/wallets/me` | CLIENT/EXPERT | — | Returns `{availableBalance: Number, lockedBalance: Number, ...}` |
| GET | `/wallets/me/transactions` | CLIENT/EXPERT | — | Ordered desc |
| POST | `/wallets/virtual-accounts/topup` | CLIENT/EXPERT | — | Body: `{amount: integer ≥ 2000}` → `{qrCodeUrl, paymentReference}` |
| POST | `/subscriptions/activate` | CLIENT/EXPERT | — | Body: `{activeRole}` → `{access_token}` |
| GET | `/subscriptions/status` | CLIENT/EXPERT | — | `{subscriptionTier, subscriptionExpires}` |
| GET | `/users/me` | CLIENT/EXPERT/ADMIN | — | Returns user + active role profile |
| PUT | `/users/me` | CLIENT/EXPERT | — | Update name, phone, company |
| POST | `/users/me/add-role` | CLIENT/EXPERT | — | Add EXPERT role to CEO account or vice-versa |
| GET | `/users/:userId/public-profile` | CLIENT/EXPERT/ADMIN | — | Public expert profile |
| POST | `/elicitation/sessions` | CLIENT (CEO) | **None** | Returns session at current_stage=1 |
| GET | `/elicitation/sessions/:id` | CLIENT (CEO) | Pro-C | Returns full session |
| PUT | `/elicitation/sessions/:id/stage1` | CLIENT (CEO) | Pro-C | `{symptomText}` → updates voids + recommended_archetypes |
| PUT | `/elicitation/sessions/:id/stage2` | CLIENT (CEO) | Pro-C | `{archetype, acknowledgedVoidCodes?}` → 422 if not in recommended set |
| PUT | `/elicitation/sessions/:id/stage3` | CLIENT (CEO) | Pro-C | `{probeResponses: {q1..q4}}` → `{advanced: bool, currentStage}` |
| PUT | `/elicitation/sessions/:id/stage4` | CLIENT (CEO) | Pro-C | Auto-chains synthesis → `{gate_passed, completeness_score, project_id?}` |
| PUT | `/elicitation/sessions/:id/stage4-handoff` | CLIENT (TECH_TEAM) | **None** | Auto-chains synthesis |
| POST | `/elicitation/sessions/:id/generate-handoff-link` | CLIENT (CEO) | Pro-C | No body → `{invite_link, invite_token, expires_in:"72h"}` |
| PUT | `/elicitation/sessions/:id/self-technical` | CLIENT (CEO) | Pro-C | `{selfTechnical: bool}` |
| POST | `/elicitation/sessions/:id/retry-synthesis` | CLIENT (CEO) | Pro-C | Retry failed synthesis |
| GET | `/projects/:id` | CLIENT/EXPERT/ADMIN | — | Project overview |
| GET | `/projects/:id/artifact-a` | CLIENT/EXPERT | — | `{artifact_a_json}` |
| GET | `/projects/:id/artifact-b` | EXPERT/TECH_TEAM/ADMIN | — | CEO permanently 403 |
| GET | `/matching/:projectId/shortlist` | CLIENT (CEO) | — | `[{expert_id, strength_label, gap_map}]` — no composite scores |
| POST | `/expert-profile/domains` | EXPERT | — | `{domainCode, depthLevel}` |
| POST | `/expert-profile/seams` | EXPERT | — | `{seamCode}` → use Unicode ↔ U+2194 |
| GET | `/expert-profile/me` | EXPERT | — | Full profile with domain_depths + seam_claims |
| PUT | `/expert-profile/me` | EXPERT | — | `{engagementModel?, stackTagsJson?, archetypeHistoryJson?}` |
| POST | `/portfolio-submissions` | EXPERT | Pro-E | `{seamClaimId, projectDescription ≥50c, decisionPoints ≥20c}` |
| GET | `/portfolio-submissions/:id` | EXPERT/ADMIN | — | `{id, status, llmConfidence, advisoryNote, ...}` |
| POST | `/bids` | EXPERT | Pro-E | `{project_id, footprint_alignment_json, approach_summary, conditional_pricing_json}` |
| GET | `/bids/:id` | CEO/EXPERT/TECH_TEAM/ADMIN | — | Full bid detail |
| PUT | `/bids/:id` | EXPERT | Pro-E | Revise bid — only when tech_status=REVISION_REQUESTED |
| PUT | `/bids/:id/tech-review` | CLIENT (TECH_TEAM) | — | `{action:"APPROVED"\|"REVISION_REQUESTED", tech_feedback?}` |
| PUT | `/bids/:id/counter-offer` | CLIENT (CEO) | — | `{negotiated_price_vnd}` — one round only |
| PUT | `/bids/:id/ceo-decision` | CLIENT (CEO) | — | `{decision:"APPROVED"\|"DECLINED"}` |
| PUT | `/engagements/:id/nda` | CEO or EXPERT | — | Accept NDA click-through |
| POST | `/milestones` | CLIENT (CEO) | — | `{engagement_id, milestone_number, deliverable_statement, sign_off_authority, payment_amount_vnd, criteria:[...]}` |
| GET | `/milestones/:id` | CLIENT/EXPERT/ADMIN | — | With criteria |
| PUT | `/milestones/:id/fund` | CLIENT | — | Generates local VA → `{state:"AWAITING_PAYMENT", va_number, ...}` |
| POST | `/milestones/:id/dod/items` | EXPERT/CLIENT | — | `{item_description, is_required?, maps_to_criterion_id?}` |
| PUT | `/milestones/:id/dod/:itemId` | EXPERT | — | `{status, completion_note?, not_applicable_note?}` |
| POST | `/milestones/:id/submit` | EXPERT | — | `{description, files_json?}` — DoD gate enforced |
| POST | `/milestones/:id/paygated-docs` | EXPERT | — | `{document_url}` — STAGED until IPN |
| GET | `/milestones/:id/paygated-docs` | EXPERT/TECH_TEAM/ADMIN | — | CEO 403; STAGED→403 |
| PUT | `/criteria/:id/verify` | CLIENT | — | `{verification_comment?}` |
| PUT | `/criteria/:id/revision` | CLIENT | — | `{revision_note ≥10c}` |
| POST | `/disputes` | CLIENT/EXPERT | — | `{engagement_id, milestone_id, criterion_id, escrow_account_id, position_text}` |
| GET | `/disputes/:id` | parties | — | Dispute detail |
| POST | `/services` | EXPERT | — | `{title, description, domains_json, seams_json, price_vnd, service_type}` |
| PUT | `/services/:id` | EXPERT (owner) | — | Update or publish |
| GET | `/services` | all authenticated | — | Marketplace browse (PUBLISHED only) |
| GET | `/services/:id` | all authenticated | — | Service detail |
| POST | `/services/:id/purchase` | CLIENT (CEO) | — | Creates engagement + VA → `{qrCodeUrl, vaNumber}` |
| POST | `/withdrawals` | EXPERT | — | `{amount ≥ 2000}` |
| GET | `/withdrawals` | EXPERT | — | Own withdrawal history |
| POST | `/bank-hub/initiate-link` | EXPERT | — | `{bank_account_xid, holder_name}` |
| POST | `/messages` | CLIENT/EXPERT | — | `{engagement_id XOR project_id, content, attachment_url?}` |
| PUT | `/messages/:id/read` | any party | — | Mark read |
| POST | `/webhooks/sepay/ipn` | SePay (no auth, HMAC) | — | IPN with x-sepay-signature + x-sepay-timestamp |
| POST | `/webhooks/sepay/chi-ho-credit` | SePay | — | Stub — returns `{success:true}` |
| POST | `/webhooks/sepay/bank-linked` | SePay | — | Stub — returns `{success:true}` |
| GET | `/admin/decisions` | ADMIN | — | `?decisionType=&entityType=` |
| GET | `/admin/disputes` | ADMIN | — | `?state=` |
| PUT | `/admin/disputes/:id/resolve` | ADMIN | — | `{decision:"EXPERT_WINS"\|"CLIENT_WINS"\|"SPLIT"}` |
| GET | `/admin/transactions` | ADMIN | — | `?type=&userId=` |
| GET | `/admin/analytics` | ADMIN | — | Computed aggregates |
| GET | `/admin/withdrawals` | ADMIN | — | `?status=` |
| PUT | `/admin/withdrawals/:id/complete` | ADMIN | — | Mark COMPLETED; advances milestone to RELEASED |
| PUT | `/admin/withdrawals/:id/fail` | ADMIN | — | Mark FAILED; refunds wallet |
| PUT | `/admin/projects/:id/suspend-spec` | ADMIN | — | State→SUSPENDED + platform_decisions insert |
| PUT | `/admin/users/:id/suspend` | ADMIN | — | is_active→false |