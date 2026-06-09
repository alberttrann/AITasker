# AITasker MVP — 18 Main Flows (Scope-Reduced · 28 Tables)
### Cross-Table CRUD Grounding · State Machines · Endpoint Mapping

> **Purpose:** Definitive flow reference for teacher assessment. Every step is grounded to a specific table, column, state transition, and API endpoint from the 28-table MVP schema.  
> **Last updated:** June 2026  
> **Conventions:** `[LEDGER]` = wallet_transactions row written. `[API]` = external service call. Tables in **bold** on first reference. §0.x = Master Reference Sheet section.

---

## Group 1 — Onboarding & Account Setup

---

# MF-1: Client (CEO) Registration & Subscription

## Overview

Registers a CLIENT/CEO account, creates their internal wallet and permanent top-up VA, then activates Client Pro subscription via direct wallet deduction. References: §0.7 (RBAC), §0.8 (Payment Architecture), §0.9 (Feature Gates).

**Tables touched (5):** `users`, `client_profiles`, `wallets`, `virtual_accounts`, `wallet_transactions`

**Endpoints:** `POST /auth/register`, `POST /wallet/topup-qr`, `POST /subscriptions/activate`, `POST /webhooks/sepay/ipn`

---

## ASCII Swimlane

```
┌───────────────────────────────────┬────────────────────────────────────────┬──────────────────────────────────┐
│        CLIENT / CEO (User)        │       SYSTEM (NestJS + FastAPI)        │         SePay / Bank Hub         │
├───────────────────────────────────┼────────────────────────────────────────┼──────────────────────────────────┤
│ ═════ PHASE A: REGISTRATION ═════ │                                        │                                  │
│                                   │                                        │                                  │
│ [1] Opens /register               │                                        │                                  │
│     Selects "I need AI help"      │                                        │                                  │
│                                   │                                        │                                  │
│ [2] Fills form: email, pwd,       │                                        │                                  │
│     full_name, phone              │                                        │                                  │
│     [Submit Registration]         │                                        │                                  │
│       └──────────────────────────>│                                        │                                  │
│                                   │ [3] Validate: email unique in          │                                  │
│                                   │     users, pwd≥8, phone VN format      │                                  │
│                                   │                   │                    │                                  │
│                                   │                [valid]                 │                                  │
│                                   │                   │                    │                                  │
│                                   │ [4] DB TX (atomic):                    │                                  │
│                                   │      INSERT users:                     │                                  │
│                                   │        roles: ["CLIENT_CEO"]           │                                  │
│                                   │        active_role: "CLIENT"           │                                  │
│                                   │        client_subtype: "CEO"           │                                  │
│                                   │        sub_client_tier: "free"         │                                  │
│                                   │        sub_expert_tier: "free"         │                                  │
│                                   │      INSERT client_profiles:           │                                  │
│                                   │        user_id = new_user.id           │                                  │
│                                   │      INSERT wallets:                   │                                  │
│                                   │        user_id, available=0,locked=0   │                                  │
│                                   │      COMMIT                            │                                  │
│                                   │                   │                    │                                  │
│                                   │ [5] POST SePay: Create VA              │                                  │
│                                   │     entity_type=WALLET_TOPUP           │                                  │
│                                   │                   └────────────────────┼────────────────────────────────> │
│                                   │                                        │ [6] SePay creates VA             │
│                                   │                                        │     Returns {va_number}          │
│                                   │                   ┌<───────────────────┼────────────────────────────────┘ │
│                                   │                   │                    │                                  │
│                                   │ [7] INSERT virtual_accounts:           │                                  │
│                                   │      entity_type: "WALLET_TOPUP"       │                                  │
│                                   │      entity_id: user_id                │                                  │
│                                   │      va_number: (from SePay)           │                                  │
│                                   │      fixed_amount: NULL                │                                  │
│                                   │      expires_at: NULL (permanent)      │                                  │
│                                   │      status: "ACTIVE"                  │                                  │
│                                   │                   │                    │                                  │
│                                   │ [8] Generate JWT:                      │                                  │
│                                   │     { sub, active_role: "CLIENT",      │                                  │
│                                   │       client_subtype: "CEO",           │                                  │
│                                   │       roles: ["CLIENT_CEO"] }          │                                  │
│ <─────────────────────────────────┼─┘                                      │                                  │
│ [9] CEO Dashboard (free tier)     │                                        │                                  │
│     Banner: "Subscribe to Pro"    │                                        │                                  │
│     All AI routes → 403           │                                        │                                  │
│     SUBSCRIPTION_REQUIRED         │                                        │                                  │
│                                   │                                        │                                  │
├───────────────────────────────────┼────────────────────────────────────────┼──────────────────────────────────┤
│ ══════ PHASE B: WALLET TOP-UP ════│                                        │                                  │
│                                   │                                        │                                  │
│ [10] Clicks "Top Up Wallet"       │                                        │                                  │
│        └─────────────────────────>│                                        │                                  │
│                                   │ [11] GET /wallet/topup-qr              │                                  │
│                                   │      SELECT virtual_accounts           │                                  │
│                                   │      WHERE entity_id=uid               │                                  │
│                                   │        AND entity_type='WALLET_TOPUP'  │                                  │
│                                   │      Generate VietQR from va_number    │                                  │
│ <─────────────────────────────────┼─ Return {qr_url, va_number}            │                                  │
│ [12] Scans VietQR, transfers      │                                        │                                  │
│      500,000 VND via banking app  │                                        │                                  │
│                                   │                                        │                │                 │
│                                   │                                        │ [13] Bank processes transfer     │
│                                   │                                        │ [14] SePay IPN fires:            │
│                                   │      ┌<────────────────────────────────┼──────── POST /webhooks/sepay/ipn │
│                                   │ [15] IPN Handler:                      │         {va_number, amount, ref} │
│                                   │      a. Verify HMAC signature          │                                  │
│                                   │      b. SELECT virtual_accounts        │                                  │
│                                   │           WHERE va_number=?            │                                  │
│                                   │           → entity_type=WALLET_TOPUP   │                                  │
│                                   │           → entity_id=user_id          │                                  │
│                                   │      c. Idempotency: SELECT FROM       │                                  │
│                                   │           wallet_transactions WHERE    │                                  │
│                                   │           reference_id=? (UNIQUE idx)  │                                  │
│                                   │      d. DB TX (atomic):                │                                  │
│                                   │           UPDATE wallets SET           │                                  │
│                                   │             available_balance+=500000  │                                  │
│                                   │           INSERT wallet_transactions:  │                                  │
│                                   │             type: "TOP_UP"             │                                  │
│                                   │             amt: 500000                │                                  │
│                                   │             ref: transfer_reference    │                                  │
│                                   │           COMMIT                       │                                  │
│                                   │      e. Return 200 OK to SePay         │                                  │
│                                   │      f. Push notification              │                                  │
│ <─────────────────────────────────┼─┘                                      │                                  │
│ [16] Dashboard: balance = 500,000 │                                        │                                  │
│                                   │                                        │                                  │
├───────────────────────────────────┼────────────────────────────────────────┼──────────────────────────────────┤
│ ════ PHASE C: SUBSCRIPTION ACT. ══│                                        │                                  │
│                                   │                                        │                                  │
│ [17] Clicks "Activate Client Pro" │                                        │                                  │
│      (500K VND / 6 mo)            │                                        │                                  │
│        └─────────────────────────>│                                        │                                  │
│                                   │ [18] POST /subscriptions/activate      │                                  │
│                                   │      {role_type: "client"}             │                                  │
│                                   │      Guard 1: users.sub_client_tier    │                                  │
│                                   │        IF "pro" AND not expired        │                                  │
│                                   │        → 409 ALREADY_SUBSCRIBED        │                                  │
│                                   │      Guard 2: wallets.available_       │                                  │
│                                   │        balance >= 500000?              │                                  │
│                                   │        NO → 422 INSUFFICIENT_BALANCE   │                                  │
│                                   │                   │                    │                                  │
│                                   │            [balance ≥ 500K]            │                                  │
│                                   │                   │                    │                                  │
│                                   │ [19] DB TX (atomic):                   │                                  │
│                                   │      UPDATE wallets SET                │                                  │
│                                   │        available_balance -= 500000     │                                  │
│                                   │      INSERT wallet_transactions:       │                                  │
│                                   │        type: "SUBSCRIPTION"            │                                  │
│                                   │        amt: 500000                     │                                  │
│                                   │        ref: "SUB-{user_id}:client"     │                                  │
│                                   │      UPDATE users SET                  │                                  │
│                                   │        sub_client_tier='pro'           │                                  │
│                                   │        sub_client_expires_at=          │                                  │
│                                   │          now() + 6 months              │                                  │
│                                   │      COMMIT                            │                                  │
│                                   │                   │                    │                                  │
│                                   │ [20] Reissue JWT (updated claims)      │                                  │
│                                   │      Notify: "Pro active until {date}" │                                  │
│ <─────────────────────────────────┼─┘                                      │                                  │
│ [21] ✓ CLIENT PRO ACTIVE          │                                        │                                  │
│      Unlocked: F2 Elicitation,    │                                        │                                  │
│      F4 Matching, Artifact B,     │                                        │                                  │
│      Full Seam Gap Maps           │                                        │                                  │
│      Balance: 0 VND               │                                        │                                  │
└───────────────────────────────────┴────────────────────────────────────────┴──────────────────────────────────┘
```

---

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | CEO | Fill registration form | — | — | `GET /register` |
| 3 | NestJS | Validate input (email unique, pwd≥8, phone) | `users` (R) | — | `POST /auth/register` |
| 4 | NestJS | Atomic insert: user + client_profile + wallet | `users` (C), `client_profiles` (C), `wallets` (C) | New: user.roles=["CLIENT_CEO"], wallet available=0 | — |
| 5-6 | NestJS→SePay | Create WALLET_TOPUP VA | — (SePay-side) | — | `POST SePay VA API` |
| 7 | NestJS | Store VA record | `virtual_accounts` (C) | VA status=ACTIVE | — |
| 8 | NestJS | Generate JWT | — | — | — |
| 9 | CEO | Dashboard loads free tier | `users` (R), `wallets` (R) | — | `GET /dashboard` |
| 10-11 | CEO→NestJS | Request top-up QR | `virtual_accounts` (R) | — | `POST /wallet/topup-qr` |
| 12-14 | CEO→Bank→SePay | External bank transfer + IPN | — | — | External |
| 15 | NestJS | IPN: verify HMAC → resolve VA → idempotency → credit wallet | `virtual_accounts` (R), `wallets` (U), `wallet_transactions` (C) | wallet.available: 0→500K | `POST /webhooks/sepay/ipn` |
| 16 | CEO | Dashboard reflects new balance | `wallets` (R) | — | `GET /wallet` |
| 17-18 | CEO→NestJS | Activate subscription; guards pass | `users` (R), `wallets` (R) | — | `POST /subscriptions/activate` |
| 19 | NestJS | Atomic: debit wallet + ledger + update user tier | `wallets` (U), `wallet_transactions` (C), `users` (U) | wallet.available: 500K→0, users.sub_client_tier: free→pro | — |
| 20-21 | NestJS→CEO | Reissue JWT, notify | `users` (R) | — | — |

---

## Cross-Table CRUD Map

```
users ──(1:1)──> client_profiles     [C in step 4]
users ──(1:1)──> wallets             [C in step 4, R/U in steps 15,19]
users               .subscription_client_tier  [R step 18, U step 19]
users               .sub_client_expires_at     [U step 19]
wallets ──(1:N)──> wallet_transactions [C in steps 15,19]
virtual_accounts    .entity_id → users.id (polymorphic) [C step 7, R steps 11,15]
wallet_transactions .reference_id UNIQUE index  [idempotency in step 15]
```

---

## State Machine Reference

- **Subscription state (§0.9):** `users.subscription_client_tier`: `free` → `pro` (step 19); stored directly on `users` — no `user_subscriptions` table in MVP
- **VA state (§0.8):** `virtual_accounts.status`: `ACTIVE` (permanent for WALLET_TOPUP)
- **Wallet balance invariants:** `available_balance >= 0` (CHECK constraint), `locked_balance >= 0` (CHECK constraint)

---

# MF-2: Expert Registration, Profile & Tier 1→2 Verification

## Overview

Registers an EXPERT account, creates taxonomy profile with domain depths and seam claims (Tier 1 Claimed), then optionally submits portfolio evidence for LLM auto-verification to Tier 2 (Evidence-backed). Links bank account via Bank Hub Hosted Link for future chi hộ withdrawals. References: §0.1 (Domains), §0.2 (Seams), §0.4 (2-Tier Verification).

**Tables touched (8):** `users`, `expert_profiles`, `wallets`, `virtual_accounts`, `wallet_transactions`, `expert_domain_depths`, `expert_seam_claims`, `portfolio_submissions`, `platform_decisions`

**Endpoints:** `POST /auth/register`, `PUT /expert-profile`, `POST /expert-profile/domains`, `POST /expert-profile/seams`, `POST /portfolio-submissions`, `GET /portfolio-submissions/{id}/eval-result`, `POST /bank-hub/initiate-link`, `POST /webhooks/sepay/bank-linked`

---

## ASCII Swimlane

```
┌───────────────────────────────────┬─────────────────────────────────────┬───────────────────────────────────┐
│           EXPERT (User)           │      SYSTEM (NestJS + FastAPI)      │         SePay / Bank Hub          │
├───────────────────────────────────┼─────────────────────────────────────┼───────────────────────────────────┤
│ ═════ PHASE A: REGISTRATION ═════ │                                     │                                   │
│                                   │                                     │                                   │
│ [1] Opens /register               │                                     │                                   │
│     Selects "I provide AI svcs"   │                                     │                                   │
│ [2] Fills form → Submit           │                                     │                                   │
│        └─────────────────────────>│                                     │                                   │
│                                   │ [3] Validate + DB TX (atomic):      │                                   │
│                                   │      INSERT users:                  │                                   │
│                                   │        roles: ["EXPERT"]            │                                   │
│                                   │        active_role: "EXPERT"        │                                   │
│                                   │        client_subtype: NULL         │                                   │
│                                   │        sub_expert_tier: "free"      │                                   │
│                                   │      INSERT expert_profiles:        │                                   │
│                                   │        user_id, bio=NULL            │                                   │
│                                   │        engagement_model=NULL        │                                   │
│                                   │        stack_tags_json: '[]'        │                                   │
│                                   │      INSERT wallets:                │                                   │
│                                   │        user_id, available=0,locked=0│                                   │
│                                   │      INSERT virtual_accounts:       │                                   │
│                                   │        (WALLET_TOPUP VA via SePay)  │                                   │
│                                   │      COMMIT                         │                                   │
│                                   │      Generate JWT + redirect        │                                   │
│ <─────────────────────────────────┼─┘                                   │                                   │
│                                   │                                     │                                   │
├───────────────────────────────────┼─────────────────────────────────────┼───────────────────────────────────┤
│ ══════ PHASE B: PROFILE BUILD ═══ │                                     │                                   │
│                                   │                                     │                                   │
│ [4] Expert Dashboard → Profile    │                                     │                                   │
│     Builder                       │                                     │                                   │
│                                   │                                     │                                   │
│ [5] Set domain depths:            │                                     │                                   │
│     e.g. Domain A: DEEP           │                                     │                                   │
│          Domain C: OPERATIONAL    │                                     │                                   │
│          Domain D: SURFACE        │                                     │                                   │
│        └─────────────────────────>│                                     │                                   │
│                                   │ [6] POST /expert-profile/domains    │                                   │
│                                   │      For each domain:               │                                   │
│                                   │      UPSERT expert_domain_depths:   │                                   │
│                                   │        expert_id, domain_code,      │                                   │
│                                   │        depth_level,                 │                                   │
│                                   │        verification_tier='CLAIMED'  │                                   │
│                                   │      (Tier 1 per §0.4, conf=0.20)   │                                   │
│ <─────────────────────────────────┼─┘                                   │                                   │
│                                   │                                     │                                   │
│ [7] Claim seams:                  │                                     │                                   │
│     e.g. A↔C, A↔D, C↔F            │                                     │                                   │
│        └─────────────────────────>│                                     │                                   │
│                                   │ [8] POST /expert-profile/seams      │                                   │
│                                   │      For each seam:                 │                                   │
│                                   │      INSERT expert_seam_claims:     │                                   │
│                                   │        expert_id, seam_code,        │                                   │
│                                   │        verification_tier='CLAIMED', │                                   │
│                                   │        submission_count=0,          │                                   │
│                                   │        locked_until=NULL            │                                   │
│ <─────────────────────────────────┼─┘                                   │                                   │
│                                   │                                     │                                   │
│ [9] Set stack tags + engagement   │                                     │                                   │
│     model + archetype history     │                                     │                                   │
│        └─────────────────────────>│                                     │                                   │
│                                   │ [10] PUT /expert-profile            │                                   │
│                                   │      UPDATE expert_profiles SET     │                                   │
│                                   │        stack_tags_json='["Python",  │                                   │
│                                   │          "Kafka","Go"]',            │                                   │
│                                   │        engagement_model='MILESTONE',│                                   │
│                                   │        archetype_history_json=      │                                   │
│                                   │          [{archetype_code:"1",      │                                   │
│                                   │            tier:"TIER_3",           │                                   │
│                                   │            self_declared:true}]     │                                   │
│ <─────────────────────────────────┼─┘                                   │                                   │
│                                   │                                     │                                   │
├───────────────────────────────────┼─────────────────────────────────────┼───────────────────────────────────┤
│ ══ PHASE C: TIER 2 VERIFICATION ═ │                                     │                                   │
│                                   │                                     │                                   │
│ [11] Clicks "Upgrade Seam A↔C     │                                     │                                   │
│      to Tier 2"                   │                                     │                                   │
│      Guard: Expert Pro required   │                                     │                                   │
│        └─────────────────────────>│                                     │                                   │
│                                   │ [12] Guard: users.sub_expert_tier   │                                   │
│                                   │      IF "free" → 403 SUBSCRIPTION_  │                                   │
│                                   │                  REQUIRED           │                                   │
│                                   │      IF "pro" → proceed             │                                   │
│                                   │                                     │                                   │
│ [13] Fills portfolio form for     │                                     │                                   │
│      seam A↔C:                    │                                     │                                   │
│      • project_description        │                                     │                                   │
│      • decision_points (struct)   │                                     │                                   │
│        └─────────────────────────>│                                     │                                   │
│                                   │ [14] POST /portfolio-submissions    │                                   │
│                                   │      Throttle check:                │                                   │
│                                   │      SELECT submission_count,       │                                   │
│                                   │        locked_until FROM            │                                   │
│                                   │        expert_seam_claims           │                                   │
│                                   │        WHERE expert_id=? AND        │                                   │
│                                   │        seam_code='A↔C'              │                                   │
│                                   │      IF submission_count≥5 AND      │                                   │
│                                   │        locked_until>now()           │                                   │
│                                   │        → 429 TOO_MANY_ATTEMPTS      │                                   │
│                                   │      INSERT portfolio_submissions:  │                                   │
│                                   │        expert_id, seam_claim_id,    │                                   │
│                                   │        project_description,         │                                   │
│                                   │        decision_points,             │                                   │
│                                   │        status:'PENDING',            │                                   │
│                                   │        submitted_at:now()           │                                   │
│                                   │      UPDATE expert_seam_claims SET  │                                   │
│                                   │        submission_count += 1        │                                   │
│                                   │                                     │                                   │
│                                   │ [15] FastAPI LLM extraction call    │                                   │
│                                   │      → POST /llm/portfolio-eval     │                                   │
│                                   │      {project_description,          │                                   │
│                                   │       decision_points, seam_code}   │                                   │
│                                   │                                     │                                   │
│                                   │      FastAPI runs LLM rubric:       │                                   │
│                                   │      • All required signal types?   │                                   │
│                                   │      • Confidence score computed    │                                   │
│                                   │      • Returns {confidence, passed, │                                   │
│                                   │        gap_advisory?}               │                                   │
│                                   │                                     │                                   │
│                                   │ [16] DB TX:                         │                                   │
│                                   │      UPDATE portfolio_submissions SET│                                  │
│                                   │        llm_confidence = {score},    │                                   │
│                                   │        evaluated_at = now(),        │                                   │
│                                   │        status = 'APPROVED'|'REJECTED'│                                  │
│                                   │                                     │                                   │
│                                   │      IF confidence ≥ 0.85 AND passed:│                                  │
│                                   │        UPDATE expert_seam_claims SET│                                   │
│                                   │          verification_tier =        │                                   │
│                                   │            'EVIDENCE_BACKED'        │                                   │
│                                   │        (confidence factor: 0.55 per │                                   │
│                                   │         §0.4)                       │                                   │
│                                   │      INSERT platform_decisions:     │                                   │
│                                   │        decision_type: 'SEAM_TIER_   │                                   │
│                                   │          UPGRADE' OR 'PORTFOLIO_EVAL'│                                  │
│                                   │        entity_type: 'expert_seam_   │                                   │
│                                   │          claims'                    │                                   │
│                                   │        entity_id: claim_id,         │                                   │
│                                   │        llm_confidence: {score},     │                                   │
│                                   │        decision: 'APPROVED'|'REJECTED'│                                 │
│                                   │        advisory_note:{gap_advisory} │                                   │
│                                   │                                     │                                   │
│                                   │      IF rejected AND submission_count│                                  │
│                                   │        ≥ 5:                         │                                   │
│                                   │        UPDATE expert_seam_claims SET│                                   │
│                                   │          locked_until = now()+30days│                                   │
│ <─────────────────────────────────┼─┘                                   │                                   │
│ [17] Result:                      │                                     │                                   │
│   ✓ A↔C → Tier 2 EVIDENCE_BACKED  │                                     │                                   │
│   ✗ A↔D → remains Tier 1 CLAIMED  │                                     │                                   │
│     (gap advisory shown for       │                                     │                                   │
│      resubmission)                │                                     │                                   │
│                                   │                                     │                                   │
├───────────────────────────────────┼─────────────────────────────────────┼───────────────────────────────────┤
│ ════ PHASE D: BANK ACCOUNT LINK ═ │                                     │                                   │
│                                   │                                     │                                   │
│ [18] Clicks "Link Bank Account"   │                                     │                                   │
│        └─────────────────────────>│                                     │                                   │
│                                   │ [19] POST /bank-hub/initiate-link   │                                   │
│                                   │                   └─────────────────┼─────────────────────────────────> │
│                                   │                                     │ [20] SePay returns Hosted Link URL│
│                                   │                   ┌<────────────────┼─────────────────────────────────┘ │
│ <─────────────────────────────────┼─ Return {redirect_url}              │                                   │
│ [21] Opens SePay Hosted Link      │                                     │                                   │
│      WebView → OTP verification   │                                     │                                   │
│      (no password sharing)        │                                     │                                   │
│                                   │                                     │ [22] Bank account linked; SePay   │
│                                   │                                     │      webhook fires:               │
│                                   │                   ┌<────────────────┼─ POST /webhooks/sepay/bank-linked │
│                                   │ [23] UPDATE users SET               │  {bank_account_xid, holder_name}  │
│                                   │      sepay_bank_account_xid = xid,  │                                   │
│                                   │      bank_account_holder_name = name│                                   │
│                                   │      bank_linked_at = now()         │                                   │
│ <─────────────────────────────────┼─┘                                   │                                   │
│ [24] ✓ Bank linked → can now      │                                     │                                   │
│      request withdrawals (MF-12)  │                                     │                                   │
└───────────────────────────────────┴─────────────────────────────────────┴───────────────────────────────────┘
```

---

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-3 | Expert→NestJS | Register account | `users` (C), `expert_profiles` (C), `wallets` (C), `virtual_accounts` (C) | New expert user | `POST /auth/register` |
| 5-6 | Expert→NestJS | Set domain depths | `expert_domain_depths` (C/U via UPSERT) | verification_tier='CLAIMED' (Tier 1) | `POST /expert-profile/domains` |
| 7-8 | Expert→NestJS | Claim seams | `expert_seam_claims` (C) | verification_tier='CLAIMED' | `POST /expert-profile/seams` |
| 9-10 | Expert→NestJS | Set stack tags + engagement model + archetype history | `expert_profiles` (U) | — | `PUT /expert-profile` |
| 11-12 | Expert→NestJS | Tier 2 upgrade attempt; subscription guard | `users` (R) | — | `POST /portfolio-submissions` |
| 13-14 | Expert→NestJS | Submit portfolio evidence | `portfolio_submissions` (C), `expert_seam_claims` (U: submission_count++) | status='PENDING' | — |
| 15 | NestJS→FastAPI | LLM portfolio evaluation | — | — | `POST /llm/portfolio-eval` (internal) |
| 16 | FastAPI→NestJS | Process LLM result | `portfolio_submissions` (U), `expert_seam_claims` (U), `platform_decisions` (C) | seam verification_tier: CLAIMED→EVIDENCE_BACKED (if ≥0.85) | — |
| 18-19 | Expert→NestJS | Initiate Bank Hub link | — | — | `POST /bank-hub/initiate-link` |
| 20-21 | Expert→SePay | Complete OTP in Hosted Link | — | — | SePay WebView |
| 22-23 | SePay→NestJS | Bank linked webhook | `users` (U) | sepay_bank_account_xid set | `POST /webhooks/sepay/bank-linked` |

---

## Cross-Table CRUD Map

```
users ──(1:1)──> expert_profiles           [C step 3, U step 23]
expert_profiles ──(1:N)──> expert_domain_depths  [C step 6]
expert_profiles ──(1:N)──> expert_seam_claims    [C step 8, U steps 14,16]
expert_seam_claims ──(1:N)──> portfolio_submissions [C step 14, U step 16]
portfolio_submissions → platform_decisions  [C step 16 — polymorphic entity_id]
expert_profiles.stack_tags_json (JSONB)     [U step 10 — absorbs cut expert_stack_tags table]
expert_profiles.archetype_history_json (JSONB) [U step 10 — self-declared for cold start]
```

**Key scope-reduction note:** No `scenario_assessments`, `scenario_responses`, or `expert_seam_outcome_signals` tables. Expert verification maxes at Tier 2 (EVIDENCE_BACKED, confidence 0.55). Tiers 3-4 deferred to Phase 2.

---

# MF-3: Tech Team Account Creation via Handoff Link

## Overview

CEO generates a signed handoff link during Elicitation Stage 4. The link is sent to the client's technical team member, who uses it to register as CLIENT/TECH_TEAM. This is the **only** way a TECH_TEAM account is created — no self-registration. References: §0.7 (RBAC — TECH_TEAM creation constraint).

**Tables touched (3):** `users`, `tech_team_profiles`, `projects`

**Endpoints:** `POST /elicitation/sessions/{id}/generate-handoff-link`, `POST /auth/register/handoff`

---

## ASCII Swimlane

```
+-----------------------------------+------------------------------------+-----------------------------------+
|        CLIENT / CEO               |     SYSTEM (NestJS)                |     CLIENT / TECH_TEAM            |
+-----------------------------------+------------------------------------+-----------------------------------+
|                                   |                                    |                                   |
| [1] Elicitation Stage 4:          |                                    |                                   |
|     System hard-blocks CEO        |                                    |                                   |
|     (integration detected)        |                                    |                                   |
|     → "Invite Tech Team" shown    |                                    |                                   |
|                 +─────────────────>|                                   |                                   |
|                                   | [2] POST /elicitation/sessions/    |                                   |
|                                   |   {id}/generate-handoff-link       |                                   |
|                                   |   Generate signed JWT link:        |                                   |
|                                   |   {project_id, client_subtype:     |                                   |
|                                   |    "TECH_TEAM", expires: now()+72h}|                                   |
|                                   |   Return {handoff_url}             |                                   |
|                 +<─────────────────|                                   |                                   |
| [3] CEO sends link to tech team   |                                    |                                   |
|     (email, Slack, etc.)          |                                    |                                   |
|                                   |                                    |                                   |
|                                   |                                    | [4] Tech team opens link          |
|                                   |                                    |     JWT verified: not expired,    |
|                                   |                                    |     project_id extracted          |
|                                   |                                    |     → Registration form shown     |
|                                   |                                    |     (TECH_TEAM context locked)    |
|                                   |                                    |                                   |
|                                   |                                    | [5] Fills form: email, pwd,       |
|                                   |                                    |     full_name, phone              |
|                                   |                                    |     [Submit]                      |
|                                   |                 +<─────────────────|                                   |
|                                   | [6] POST /auth/register/handoff    |                                   |
|                                   |   Validate JWT signature + expiry  |                                   |
|                                   |   Validate email unique in users   |                                   |
|                                   |   DB TX (atomic):                  |                                   |
|                                   |   INSERT users:                    |                                   |
|                                   |     roles:["CLIENT_CEO"]*          |                                   |
|                                   |     active_role:"CLIENT"           |                                   |
|                                   |     client_subtype:"TECH_TEAM"     |                                   |
|                                   |   INSERT tech_team_profiles:       |                                   |
|                                   |     user_id                        |                                   |
|                                   |     linked_client_id = CEO user_id |                                   |
|                                   |     linked_project_id = project_id |                                   |
|                                   |   COMMIT                           |                                   |
|                                   |   Generate JWT                     |                                   |
|                                   |                 +─────────────────>|                                   |
|                                   |                                    | [7] Tech Dashboard loads          |
|                                   |                                    |     Scoped to linked_project_id   |
|                                   |                                    |     Can: view Artifact B (if      |
|                                   |                                    |     CONNECTED), review bids,      |
|                                   |                                    |     sign off technical milestones |
+-----------------------------------+-----------------------------------+-----------------------------------+

* Note: roles array includes CLIENT_CEO because TECH_TEAM is a subtype of CLIENT,
  not a separate top-level role. The client_subtype field differentiates.
```

---

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | CEO→NestJS | Generate handoff link (signed JWT with project_id + 72h expiry) | `projects` (R — validate project exists) | — | `POST /elicitation/sessions/{id}/generate-handoff-link` |
| 3 | CEO | Sends link externally | — | — | — |
| 4-5 | TECH_TEAM | Opens link, fills form | — | — | `GET /register?token={jwt}` |
| 6 | NestJS | Validate handoff JWT + register TECH_TEAM | `users` (C), `tech_team_profiles` (C) | New TECH_TEAM user, scoped to one project | `POST /auth/register/handoff` |
| 7 | TECH_TEAM | Tech Dashboard loads | `tech_team_profiles` (R — get linked_project_id) | — | `GET /tech-dashboard` |

---

## Cross-Table CRUD Map

```
users ──(1:1)──> tech_team_profiles       [C step 6]
tech_team_profiles.linked_client_id → users.id (CEO) [C step 6]
tech_team_profiles.linked_project_id → projects.id   [C step 6 — scope lock]
tech_team_profiles linked_project_id INDEX  [R step 7 — fast project scoping]
```

**Key constraint:** TECH_TEAM account is **locked to one project** via `linked_project_id`. No self-registration. This enforces the §0.7 RBAC rule that only CEOs can initiate the tech team relationship.

---

## Group 2 — Path A: Project-Based Flow

---

# MF-4: AI Elicitation Engine (5-Stage)

## Overview

The platform's primary AI innovation. Transforms a CEO's raw symptom description into a taxonomy-grounded capability footprint (Artifact A + Artifact B) through a 5-stage conversational diagnostic. Supports Scenario A (no TECH_TEAM → TECH_DISCOVERY) and Scenario B (self-technical CEO). References: §0.1 (Domains), §0.2 (Seams), §0.3 (Archetypes + Tiers), §0.6 (Elicitation + Spec state machines).

**Tables touched (4):** `elicitation_sessions`, `projects`, `platform_decisions`, `users`

**Endpoints:** `POST /elicitation/sessions`, `PUT /elicitation/sessions/{id}/stage`, `POST /elicitation/sessions/{id}/synthesize`, `POST /llm/elicitation/*` (FastAPI internal)

---

## ASCII Swimlane

```
┌───────────────────────────────────┬───────────────────────────────────┬───────────────────────────────────┐
│           CLIENT / CEO            │     SYSTEM (NestJS + FastAPI)     │        CLIENT / TECH_TEAM         │
├───────────────────────────────────┼───────────────────────────────────┼───────────────────────────────────┤
│ ═════ STAGE 1: SYMPTOM INTAKE ═══ │                                   │                                   │
│                                   │                                   │                                   │
│ [1] Clicks "Start New AI Project" │                                   │                                   │
│     Guard: sub_client_tier='pro'  │                                   │                                   │
│        └─────────────────────────>│                                   │                                   │
│                                   │ [2] POST /elicitation/sessions    │                                   │
│                                   │      INSERT elicitation_sessions: │                                   │
│                                   │        user_id, current_stage:1,  │                                   │
│                                   │        state:'IN_PROGRESS',       │                                   │
│                                   │        void_list_json:'[]'        │                                   │
│                                   │      Return session + stage 1 prmpt│                                  │
│ <─────────────────────────────────┼─┘                                 │                                   │
│ [3] Types free-form pain:         │                                   │                                   │
│     "Our AI compliance output     │                                   │                                   │
│      is inconsistent"             │                                   │                                   │
│        └─────────────────────────>│                                   │                                   │
│                                   │ [4] FastAPI: POST /llm/elicitation/│                                  │
│                                   │      stage1-extract               │                                   │
│                                   │      LLM runs 3 extraction passes:│                                   │
│                                   │      a. Intent separation         │                                   │
│                                   │         (strips "we want to       │                                   │
│                                   │         fine-tune" → symptom      │                                   │
│                                   │         "compliance inconsistent")│                                   │
│                                   │      b. Scale signal extraction   │                                   │
│                                   │         (volume/cost → tier signal)│                                  │
│                                   │      c. Void detection            │                                   │
│                                   │         (no eval ground truth →   │                                   │
│                                   │         flag)                     │                                   │
│                                   │      Returns {symptoms,           │                                   │
│                                   │        scale_signals, voids,      │                                   │
│                                   │        suggested_followups}       │                                   │
│                                   │      UPDATE elicitation_sessions  │                                   │
│                                   │        SET void_list_json =       │                                   │
│                                   │        detected_voids             │                                   │
│ <─────────────────────────────────┼─┘                                 │                                   │
│ [5] CEO reviews extracted symptoms│                                   │                                   │
│     Confirms/edits → Next         │                                   │                                   │
│                                   │                                   │                                   │
├───────────────────────────────────┼───────────────────────────────────┼───────────────────────────────────┤
│ ════ STAGE 2: ARCHETYPE + SDLC ══ │                                   │                                   │
│                                   │                                   │                                   │
│                                   │ [6] FastAPI: archetype prediction │                                   │
│                                   │      Based on symptoms + voids:   │                                   │
│                                   │      → Archetype 1 (Automated     │                                   │
│                                   │        Decision System) per §0.3  │                                   │
│                                   │      CEO selects from 3 behavioral│                                   │
│                                   │        options                    │                                   │
│                                   │      UPDATE elicitation_sessions  │                                   │
│                                   │        SET archetype = '1'        │                                   │
│                                   │                                   │                                   │
│ [7] SDLC injection:               │                                   │                                   │
│     "Ground truth void detected"  │                                   │                                   │
│     → Phase 0 injected as         │                                   │                                   │
│       mandatory Milestone 1       │                                   │                                   │
│     CEO cannot remove it          │                                   │                                   │
│                                   │                                   │                                   │
├───────────────────────────────────┼───────────────────────────────────┼───────────────────────────────────┤
│ ══ STAGE 3: ARCHITECTURE PROBE ══ │                                   │                                   │
│                                   │                                   │                                   │
│ [8] 4 behavioral questions:       │                                   │                                   │
│     • Sync vs async?              │                                   │                                   │
│     • Thundering herd?            │                                   │                                   │
│     • Stateful memory?            │                                   │                                   │
│     • HITL requirement?           │                                   │                                   │
│     (No technical knowledge       │                                   │                                   │
│      required from CEO)           │                                   │                                   │
│                                   │                                   │                                   │
├───────────────────────────────────┼───────────────────────────────────┼───────────────────────────────────┤
│ ════ STAGE 4: TECH TEAM HANDOFF ═ │                                   │                                   │
│                                   │                                   │                                   │
│ [9a] IF probe reveals existing    │                                   │                                   │
│      system integration:          │                                   │                                   │
│      System hard-blocks CEO       │                                   │                                   │
│      → generates handoff link     │                                   │                                   │
│      (see MF-3)                   │                                   │                                   │
│        └─────────────────────────>│                                   │                                   │
│                                   │                                   │ [9b] TECH_TEAM inputs:            │
│                                   │                                   │      stack tags, integration mthd,│
│                                   │                                   │      legacy data volume,          │
│                                   │                                   │      deployment                   │
│                                   │                                   │      optional: schema upload      │
│                                   │                                   │      → goes to artifact_b_json    │
│                                   │                   ┌<──────────────┼─────────────────────────────────┘ │
│                                   │                                   │                                   │
│ [9c] SCENARIO A: No TECH_TEAM     │                                   │                                   │
│      available → System offers:   │                                   │                                   │
│      • Inject TECH_DISCOVERY      │                                   │                                   │
│        milestone as Milestone 0   │                                   │                                   │
│      • Purchase TECH_DISCOVERY    │                                   │                                   │
│        service (MF-10)            │                                   │                                   │
│      Both use engagement.type=    │                                   │                                   │
│        TECH_DISCOVERY             │                                   │                                   │
│                                   │                                   │                                   │
│ [9d] SCENARIO B: Self-technical   │                                   │                                   │
│      CEO → project.self_technical │                                   │                                   │
│      = true → CEO completes       │                                   │                                   │
│      Stage 4 form directly        │                                   │                                   │
│      No second account needed     │                                   │                                   │
│                                   │                                   │                                   │
├───────────────────────────────────┼───────────────────────────────────┼───────────────────────────────────┤
│ ═══════ STAGE 5: SYNTHESIS ══════ │                                   │                                   │
│                                   │                                   │                                   │
│                                   │ [10] POST /elicitation/sessions/  │                                   │
│                                   │       {id}/synthesize             │                                   │
│                                   │       FastAPI: POST /llm/         │                                   │
│                                   │         elicitation/stage5-       │                                   │
│                                   │         synthesize                │                                   │
│                                   │       Resolves CEO/TECH_TEAM      │                                   │
│                                   │         conflicts                 │                                   │
│                                   │       Produces:                   │                                   │
│                                   │       • required_seams_json       │                                   │
│                                   │       • required_domains_json     │                                   │
│                                   │       • milestone_framework_json  │                                   │
│                                   │       • artifact_a_json (pub spec)│                                   │
│                                   │       • artifact_b_json (tech vlt)│                                   │
│                                   │                                   │                                   │
│                                   │ [11] AUTO-PUBLISH QUALITY GATE:   │                                   │
│                                   │       a. Footprint completeness   │                                   │
│                                   │          ≥ 0.7?                   │                                   │
│                                   │       b. Match pre-check ≥ 1      │                                   │
│                                   │          expert?                  │                                   │
│                                   │       c. No hard-flagged voids?   │                                   │
│                                   │                                   │                                   │
│                                   │       IF ALL PASS:                │                                   │
│                                   │       DB TX:                      │                                   │
│                                   │       INSERT projects:            │                                   │
│                                   │         client_id,                │                                   │
│                                   │         elicitation_session_id,   │                                   │
│                                   │         state:'PUBLISHED',        │                                   │
│                                   │         archetype, tier,          │                                   │
│                                   │         self_technical,           │                                   │
│                                   │         required_seams_json,      │                                   │
│                                   │         required_domains_json,    │                                   │
│                                   │         milestone_framework_json, │                                   │
│                                   │         artifact_a_json,          │                                   │
│                                   │         artifact_b_json           │                                   │
│                                   │       UPDATE elicitation_sessions │                                   │
│                                   │         SET state:'COMPLETED',    │                                   │
│                                   │         current_stage:5           │                                   │
│                                   │       INSERT platform_decisions:  │                                   │
│                                   │         type:'ELICITATION_        │                                   │
│                                   │           SYNTHESIS',             │                                   │
│                                   │         confidence:{score}        │                                   │
│                                   │       → Matching engine fires (MF-5)│                                 │
│                                   │                                   │                                   │
│                                   │       IF ANY FAIL:                │                                   │
│                                   │       UPDATE projects SET         │                                   │
│                                   │         state:'RETURNED_TO_CLIENT'│                                   │
│                                   │       UPDATE elicitation_sessions │                                   │
│                                   │         SET state:'RETURNED'      │                                   │
│                                   │       INSERT platform_decisions:  │                                   │
│                                   │         type:'SPEC_AUTO_RETURN',  │                                   │
│                                   │         advisory_note:{LLM note   │                                   │
│                                   │          identifying spec void}   │                                   │
│                                   │       → CEO re-enters at failing  │                                   │
│                                   │         void                      │                                   │
│ <─────────────────────────────────┼─┘                                 │                                   │
│ [12] Result:                      │                                   │                                   │
│   ✓ PUBLISHED → Matching fires    │                                   │                                   │
│   ✗ RETURNED → Fix void, retry    │                                   │                                   │
└───────────────────────────────────┴───────────────────────────────────┴───────────────────────────────────┘
```

---

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | CEO→NestJS | Start elicitation session; subscription guard | `users` (R — guard), `elicitation_sessions` (C) | session.state=IN_PROGRESS, current_stage=1 | `POST /elicitation/sessions` |
| 3-4 | CEO→FastAPI | Symptom intake; LLM extraction | `elicitation_sessions` (U — void_list_json) | — | `POST /llm/elicitation/stage1-extract` |
| 5-6 | CEO→FastAPI | Archetype confirmation + SDLC injection | `elicitation_sessions` (U — archetype) | — | `PUT /elicitation/sessions/{id}/stage` |
| 7 | System | Void injection (Phase 0 mandatory) | `elicitation_sessions` (U — void_list_json) | — | — |
| 8 | CEO→NestJS | Architecture probe (4 behavioral questions) | `elicitation_sessions` (U — current_stage=3) | — | `PUT /elicitation/sessions/{id}/stage` |
| 9a-b | CEO/TECH_TEAM | Tech team handoff (see MF-3) | `users` (C), `tech_team_profiles` (C) | — | `POST /auth/register/handoff` |
| 9c | CEO→NestJS | Scenario A: TECH_DISCOVERY offer | `elicitation_sessions` (U — scenario_type='SCENARIO_A') | — | — |
| 9d | CEO→NestJS | Scenario B: self_technical=true | `elicitation_sessions` (U — scenario_type='SCENARIO_B') | — | `PUT /elicitation/sessions/{id}/stage` |
| 10 | NestJS→FastAPI | Stage 5 synthesis | — | — | `POST /llm/elicitation/stage5-synthesize` |
| 11 | NestJS | Auto-publish quality gate + project creation | `projects` (C), `elicitation_sessions` (U), `platform_decisions` (C) | projects.state: PUBLISHED or RETURNED_TO_CLIENT; session.state: COMPLETED or RETURNED | `POST /elicitation/sessions/{id}/synthesize` |
| 12 | CEO | View result | `projects` (R) | — | — |

---

## State Machine References

**Elicitation session (§0.6):**
```
IN_PROGRESS (current_stage advances 1→2→3→4→5)
  → COMPLETED (Stage 5 synthesis produced project; project.state=PUBLISHED)
  → RETURNED  (auto-publish gate failed; re-enter at current_stage)
  → ABANDONED (CEO navigated away; can resume)
```

**Spec/Project (§0.6):**
```
DRAFT → [auto-publish quality gate] → PUBLISHED
                      ↓ (fail)
            RETURNED_TO_CLIENT (LLM advisory note; re-enter at specific void)
PUBLISHED → SUSPENDED (admin emergency only)
```

**Cross-table dependency:**
```
elicitation_sessions.user_id → users.id
projects.elicitation_session_id → elicitation_sessions.id
projects.client_id → users.id
projects self-contains: required_seams_json, required_domains_json,
  milestone_framework_json, artifact_a_json, artifact_b_json
  (5 JSONB columns replace 3 cut tables: capability_footprints, artifact_a, artifact_b)
```

---

# MF-5: AI Matching & Shortlisting (2-Tier Confidence)

## Overview

Composite scoring engine ranks experts against a project's capability footprint using the 5-component formula from §0.5, with only Tier 1 (0.20) and Tier 2 (0.55) confidence weights per §0.4. Produces a shortlist of 3-5 candidates with seam gap maps.

**Tables touched (4):** `projects`, `expert_profiles`, `expert_seam_claims`, `expert_domain_depths`

**Endpoints:** `POST /matching/{projectId}`, `GET /matching/{projectId}/shortlist`

---

## ASCII Swimlane

```
+-----------------------------------+-------------------------------------+-----------------------------------+
|        CLIENT / CEO               |     SYSTEM (NestJS + FastAPI)       |           DATABASE                |
+-----------------------------------+-------------------------------------+-----------------------------------+
|                                   |                                     |                                   |
| [1] Clicks "Find Experts" on      |                                     |                                   |
|     published project             |                                     |                                   |
|     Guard: sub_client_tier='pro'  |                                     |                                   |
|                 +─────────────────>|                                    |                                   |
|                                   | [2] POST /matching/{projectId}      |                                   |
|                                   |   Guard: projects.state =           |                                   |
|                                   |     'PUBLISHED' (only)              |                                   |
|                                   |   Guard: users.sub_client_tier=     |                                   |
|                                   |     'pro'                           |                                   |
|                                   |                 |                   |                                   |
|                                   | [3] SELECT FROM projects            |                                   |
|                                   |   WHERE id=projectId                |                                   |
|                                   |   → required_seams_json             |                                   |
|                                   |   → required_domains_json           |                                   |
|                                   |   → archetype, tier                 |                                   |
|                                   |                 +──────────────────>| [4] Return project footprint      |
|                                   |                 +<──────────────────|                                   |
|                                   |                 |                   |                                   |
|                                   | [5] SELECT experts (self-exclusion):|                                   |
|                                   |   SELECT ep.user_id,                |                                   |
|                                   |     ep.stack_tags_json,             |                                   |
|                                   |     ep.engagement_model,            |                                   |
|                                   |     ep.archetype_history_json       |                                   |
|                                   |   FROM expert_profiles ep           |                                   |
|                                   |   WHERE ep.user_id NOT IN           |                                   |
|                                   |     (SELECT user_id FROM            |                                   |
|                                   |      project_members WHERE          |                                   |
|                                   |      project_id=?)                  |                                   |
|                                   |                 +──────────────────>| [6] Return expert pool            |
|                                   |                 +<──────────────────|                                   |
|                                   |                 |                   |                                   |
|                                   | [7] For each expert, fetch claims:  |                                   |
|                                   |   SELECT esc.seam_code,             |                                   |
|                                   |     esc.verification_tier           |                                   |
|                                   |   FROM expert_seam_claims esc       |                                   |
|                                   |   WHERE esc.expert_id = ?           |                                   |
|                                   |                 +──────────────────>| [8] Return seam claims            |
|                                   |                 +<──────────────────|                                   |
|                                   |                 |                   |                                   |
|                                   | [9] For each expert, fetch depths:  |                                   |
|                                   |   SELECT edd.domain_code,           |                                   |
|                                   |     edd.depth_level,                |                                   |
|                                   |     edd.verification_tier           |                                   |
|                                   |   FROM expert_domain_depths edd     |                                   |
|                                   |   WHERE edd.expert_id = ?           |                                   |
|                                   |                 +──────────────────>| [10] Return domain depths         |
|                                   |                 +<──────────────────|                                   |
|                                   |                 |                   |                                   |
|                                   | [11] COMPOSITE SCORE CALCULATION    |                                   |
|                                   |   (NestJS or FastAPI):              |                                   |
|                                   |                                     |                                   |
|                                   |   Per §0.5 weights:                 |                                   |
|                                   |   a. Seam alignment (40%):          |                                   |
|                                   |      For each required_seam:        |                                   |
|                                   |        IF expert has claim:         |                                   |
|                                   |          Tier 1 (CLAIMED) → 0.20    |                                   |
|                                   |          Tier 2 (EVIDENCE_BACKED) → |                                   |
|                                   |            0.55                     |                                   |
|                                   |        IF load-bearing seam missing:|                                   |
|                                   |          → negative contribution    |                                   |
|                                   |   b. Domain depth coverage (25%):   |                                   |
|                                   |      expert depth ≥ required depth? |                                   |
|                                   |   c. Archetype-tier congruence      |                                   |
|                                   |      (20%): archetype_history_json  |                                   |
|                                   |      match                          |                                   |
|                                   |   d. Engagement model fit (10%):    |                                   |
|                                   |      model match                    |                                   |
|                                   |   e. Stack tags & recency (5%):     |                                   |
|                                   |      stack_tags_json overlap        |                                   |
|                                   |                                     |                                   |
|                                   |   HARD GATE:                        |                                   |
|                                   |   claimed-to-verified ratio > 4:1   |                                   |
|                                   |   → excluded from shortlist         |                                   |
|                                   |                                     |                                   |
|                                   |   Match strength labels per §0.5:   |                                   |
|                                   |   Strong > 0.78, Qualified 0.58-0.78|                                   |
|                                   |   Conditional 0.42-0.58             |                                   |
|                                   |                                     |                                   |
|                                   | [12] Build seam gap map per expert: |                                   |
|                                   |   Per required seam:                |                                   |
|                                   |   Amber = EVIDENCE_BACKED (Tier 2)  |                                   |
|                                   |   Yellow = CLAIMED (Tier 1)         |                                   |
|                                   |   Red = Absent                      |                                   |
|                                   |   (Green/Verified absent in MVP —   |                                   |
|                                   |    no Tier 3/4)                     |                                   |
|                                   |                                     |                                   |
|                                   | [13] Rank → shortlist 3-5 candidates|                                   |
|                                   |   Return {shortlist: [{expert_id,   |                                   |
|                                   |     strength_label, gap_map,        |                                   |
|                                   |     score_components}]}             |                                   |
|                 +<─────────────────|                                    |                                   |
| [14] CEO views shortlist with     |                                     |                                   |
|     seam gap maps and strength    |                                     |                                   |
|     labels (not numeric scores)   |                                     |                                   |
+-----------------------------------+-------------------------------------+-----------------------------------+
```

---

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | Key Logic | Endpoint |
|---|---|---|---|---|---|
| 1-2 | CEO→NestJS | Initiate matching; guards | `users` (R), `projects` (R) | project must be PUBLISHED, user must be pro | `POST /matching/{projectId}` |
| 3-4 | NestJS | Read project footprint | `projects` (R) | Extract required_seams_json, required_domains_json, archetype, tier | — |
| 5-6 | NestJS | Query expert pool with self-exclusion | `expert_profiles` (R) | WHERE user_id NOT IN project members | — |
| 7-10 | NestJS | Fetch per-expert seam claims + domain depths | `expert_seam_claims` (R), `expert_domain_depths` (R) | verification_tier determines confidence factor (0.20 or 0.55) | — |
| 11 | NestJS/FastAPI | Compute composite scores | — | 5-component formula per §0.5; hard gate ratio > 4:1 | — |
| 12-13 | NestJS | Build gap maps + rank | — | Tier 2=Amber, Tier 1=Yellow, Absent=Red | — |
| 14 | CEO | View shortlist | — | — | `GET /matching/{projectId}/shortlist` |

---

# MF-6: Simplified Bid & Connection Flow

## Overview

Expert views Artifact A, asks pre-bid questions via messages channel, submits a 3-component bid. TECH_TEAM reviews and sets tech_status. CEO reviews and sets ceo_status. Single mutable row — no versioned snapshots. Pre-bid questions use messages (no spec_clarifications table). Price negotiation via negotiated_price_vnd column (one round). References: §0.6 (Bid states), §0.7 (RBAC — TECH_TEAM approves before CEO).

**Tables touched (4):** `capability_bids`, `engagements`, `projects`, `messages`

**Endpoints:** `GET /projects/{id}/artifact-a`, `POST /bids`, `PUT /bids/{id}`, `PUT /bids/{id}/tech-review`, `PUT /bids/{id}/ceo-decision`, `POST /engagements/{id}/connect`, `PUT /engagements/{id}/accept-nda`

---

## ASCII Swimlane

```
+-----------------------------------+-------------------------------------+-----------------------------------+
|           EXPERT                  |     SYSTEM (NestJS)                 |  CLIENT / TECH_TEAM    |  CEO     |
+-----------------------------------+-------------------------------------+------------------------+----------+
|                                   |                                     |                        |          |
| ═══ PHASE A: PRE-BID ═════════════|                                     |                        |          |
|                                   |                                     |                        |          |
| [1] Views PUBLISHED project       |                                     |                        |          |
|     → GET Artifact A              |                                     |                        |          |
|     (artifact_a_json on projects) |                                     |                        |          |
|                                   |                                     |                        |          |
| [2] Has technical question?       |                                     |                        |          |
|     Posts via messages channel    |                                     |                        |          |
|     (no spec_clarifications table)|                                     |                        |          |
|                 +─────────────────>|                                    |                        |          |
|                                   | [3] INSERT messages:                |                        |          |
|                                   |   engagement_id=NULL* (pre-bid      |                        |          |
|                                   |   thread uses project_id context)   |                        |          |
|                                   |   sender_id=expert_id               |                        |          |
|                                   |   content="What is current error    |                        |          |
|                                   |   rate baseline?"                   |                        |          |
|                                   |                 +──────────────────>| [4] TECH_TEAM sees     |          |
|                                   |                                     | message, answers       |          |
|                                   |                 +<──────────────────| via messages channel   |          |
|                                   |                                     |                        |          |
| ═══ PHASE B: BID SUBMISSION ═════|                                      |                        |          |
|                                   |                                     |                        |          |
| [5] Submits 3-component bid:      |                                     |                        |          |
|   1. Footprint Alignment (JSONB)  |                                     |                        |          |
|   2. Approach Summary (TEXT)      |                                     |                        |          |
|   3. Conditional Pricing (JSONB)  |                                     |                        |          |
|     Guard: Expert Pro required    |                                     |                        |          |
|                 +─────────────────>|                                    |                        |          |
|                                   | [6] POST /bids                      |                        |          |
|                                   |   Validate: ALL 3 components        |                        |          |
|                                   |   present (422 if any missing)      |                        |          |
|                                   |   INSERT engagements:               |                        |          |
|                                   |     project_id, expert_id,          |                        |          |
|                                   |     type:'PROJECT_BASED',           |                        |          |
|                                   |     state:'PENDING'                 |                        |          |
|                                   |   INSERT capability_bids:           |                        |          |
|                                   |     engagement_id,                  |                        |          |
|                                   |     footprint_alignment_json,       |                        |          |
|                                   |     approach_summary,               |                        |          |
|                                   |     conditional_pricing_json,       |                        |          |
|                                   |     state:'SUBMITTED',              |                        |          |
|                                   |     tech_status:'PENDING',          |                        |          |
|                                   |     ceo_status:'PENDING',           |                        |          |
|                                   |     version_number:1                |                        |          |
|                                   |   (1:1 engagement↔bid via UNIQUE on |                        |          |
|                                   |    engagement_id)                   |                        |          |
|                                   |                                     |                        |          |
| ═══ PHASE C: TECH REVIEW ════════|                                      |                        |          |
|                                   |                                     |                        |          |
|                                   |                 +─────────────────> | [7] TECH_TEAM opens    |          |
|                                   |                                     | bid in Tech Dashboard  |          |
|                                   |                                     |                        |          |
|                                   |                 +─────────────────> | [8a] SET tech_status = |          |
|                                   |                                     | 'REVISION_REQUESTED'   |          |
|                                   |                                     | + writes tech_feedback |          |
|                                   |                                     |   "Approach doesn't    |          |
|                                   |                                     |   address A↔C seam"    |          |
|                                   |                                     |                        |          |
|                                   | [9a] PUT /bids/{id}                 |                        |          |
|                                   |   Expert reads tech_feedback        |                        |          |
|                                   |   Edits bid row IN PLACE:           |                        |          |
|                                   |   UPDATE capability_bids SET        |                        |          |
|                                   |     approach_summary = '...updated',|                        |          |
|                                   |     tech_status = 'PENDING',        |                        |          |
|                                   |     version_number += 1             |                        |          |
|                                   |   (Mutable row — no bid_versions    |                        |          |
|                                   |    table in MVP)                    |                        |          |
|                                   |                                     |                        |          |
|                                   |                                     | [8b] Loop: TECH_TEAM   |          |
|                                   |                                     | re-reviews → satisfied |          |
|                                   |                                     |                        |          |
|                                   |                 +──────────────────>| [10] SET tech_status = |          |
|                                   |                                     | 'APPROVED'             |          |
|                                   |                                     |                        |          |
| ═══ PHASE D: CEO REVIEW ═════════|                                      |                        |          |
|                                   |                                     |                        |          |
|                                   |                                     |      [11] CEO Dashboard|          |
|                                   |                                     |      unlocks ONLY when |          |
|                                   |                                     |      tech_status =     |          |
|                                   |                                     |      'APPROVED'        |          |
|                                   |                                     |                        |          |
|                                   |                                     |      [12a] CEO may     |          |
|                                   |                                     |      write counter-    |          |
|                                   |                                     |      offer:            |          |
|                                   |                                     |      negotiated_price_ |          |
|                                   |                                     |      vnd = 4,500,000   |          |
|                                   |                                     |      (one round only)  |          |
|                                   |                                     |                        |          |
|                                   |                                     |      [12b] SET         |          |
|                                   |                                     |      ceo_status =      |          |
|                                   |      'APPROVED'                     |      'APPROVED' or     |          |
|                                   |      → bid.state = SELECTED         |      'DECLINED'        |          |
|                                   |      → engagement can proceed       |                        |          |
|                                   |                                     |                        |          |
|                                   |   Route guard on PUT /bids/{id}/    |                        |          |
|                                   |   ceo-decision:                     |                        |          |
|                                   |   IF tech_status != 'APPROVED'      |                        |          |
|                                   |     → 422 "Tech review not complete"|                        |          |
|                                   |                                     |                        |          |
| ═══ PHASE E: CONNECTION ═════════ |                                     |                        |          |
|                                   |                                     |                        |          |
|                                   | [13] CEO sends connection request   |                        |          |
|                                   |   (via shortlist "Select" button)   |                        |          |
|                                   |   engagement.state = 'PENDING'      |                        |          |
|                                   |   already set from step [6]         |                        |          |
|                                   |                                     |                        |          |
| [14] Expert accepts connection    |                                     |                        |          |
|                 +─────────────────>|                                    |                        |          |
|                                   | [15] Both parties complete NDA      |                        |          |
|                                   |   click-through:                    |                        |          |
|                                   |   UPDATE engagements SET            |                        |          |
|                                   |     client_nda_accepted_at = now(), |                        |          |
|                                   |     expert_nda_accepted_at = now(), |                        |          |
|                                   |     state = 'CONNECTED',            |                        |          |
|                                   |     connected_at = now()            |                        |          |
|                                   |   Guard: BOTH nda timestamps set    |                        |          |
|                                   |   Bank Hub check:                   |                        |          |
|                                   |   IF expert.sepay_bank_account_xid  |                        |          |
|                                   |     IS NULL → prompt to link        |                        |          |
|                                   |                                     |                        |          |
|                                   | [16] Artifact B now accessible:     |                        |          |
|                                   |   FastAPI route guard:              |                        |          |
|                                   |   Return artifact_b_json ONLY when  |                        |          |
|                                   |   engagement.state >= 'CONNECTED'   |                        |          |
|                                   |   AND client_nda_accepted_at IS NOT |                        |          |
|                                   |   NULL                              |                        |          |
|                                   |   AND expert_nda_accepted_at IS NOT |                        |          |
|                                   |   NULL                              |                        |          |
|                                   |   AND requester != CEO              |                        |          |
|                                   |   (CEO permanently excluded per     |                        |          |
|                                   |    §0.7 RBAC)                       |                        |          |
+-----------------------------------+-------------------------------------+------------------------+----------+
```

---

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1 | Expert | View Artifact A | `projects` (R — artifact_a_json) | — | `GET /projects/{id}/artifact-a` |
| 2-3 | Expert | Ask pre-bid question | `messages` (C) | — | `POST /engagements/{id}/messages` |
| 4 | TECH_TEAM | Answer via messages | `messages` (C) | — | `POST /engagements/{id}/messages` |
| 5-6 | Expert | Submit 3-component bid | `engagements` (C), `capability_bids` (C) | bid.state=SUBMITTED, tech_status=PENDING, ceo_status=PENDING | `POST /bids` |
| 7-8a | TECH_TEAM | Set tech_status=REVISION_REQUESTED + tech_feedback | `capability_bids` (U) | tech_status: PENDING→REVISION_REQUESTED | `PUT /bids/{id}/tech-review` |
| 9a | Expert | Edit bid row in place | `capability_bids` (U) | tech_status→PENDING, version_number++ | `PUT /bids/{id}` |
| 10 | TECH_TEAM | Set tech_status=APPROVED | `capability_bids` (U) | tech_status: PENDING→APPROVED | `PUT /bids/{id}/tech-review` |
| 11-12 | CEO | Review + set ceo_status + optional negotiated_price_vnd | `capability_bids` (U) | ceo_status: PENDING→APPROVED/DECLINED | `PUT /bids/{id}/ceo-decision` |
| 13 | CEO | Connection request sent | `engagements` (R — already PENDING) | — | — |
| 14-15 | Expert | Accept + NDA click-through | `engagements` (U) | state: PENDING→CONNECTED; nda timestamps set | `POST /engagements/{id}/connect`, `PUT /engagements/{id}/accept-nda` |
| 16 | System | Artifact B route guard unlocks | `projects` (R — artifact_b_json) | — | `GET /projects/{id}/artifact-b` |

---

## Bid State Machine (Simplified — §0.6)

```
DRAFT → SUBMITTED → TECH_REVIEW
                      ↓              ↕ (tech_status loop)
                   [REVISION_REQUESTED ↔ expert edits → PENDING → TECH_REVIEW]
                      ↓
                   TECH_APPROVED (tech_status='APPROVED')
                      ↓
                   CEO_REVIEW (unlocked only when tech_status=APPROVED)
                      ↓
                   SELECTED (ceo_status='APPROVED') / DECLINED (ceo_status='DECLINED')
```

**Key scope-reduction:** Mutable single row replaces `bid_versions`, `bid_revision_requests`, `price_negotiations`, `bid_conflict_overrides` tables. `tech_feedback` column replaces Surface B table. `negotiated_price_vnd` column replaces Surface C table. CEO override is implicit — CEO can APPROVE even if TECH_TEAM had REVISION_REQUESTED (no separate conflict override table needed since tech_status/ceo_status are independent columns).

---

# MF-7: Milestone Management + DoD + Escrow (2-Layer)

## Overview

CEO funds milestones via per-milestone VA, triggering escrow lock via SePay IPN. Expert creates DoD checklist, completes items, submits deliverable. Sign-off authority verifies acceptance criteria criterion by criterion. APPROVED triggers atomic ledger release + chi hộ auto-transfer. References: §0.6 (Milestone, DoD states), §0.8 (Payment Architecture).

**Tables touched (7):** `milestones`, `acceptance_criteria`, `milestone_dod_items`, `milestone_submissions`, `paygated_documents`, `escrow_accounts`, `wallet_transactions`

**Endpoints:** `POST /milestones`, `POST /milestones/{id}/criteria`, `POST /milestones/{id}/dod-items`, `PUT /milestones/{id}/fund`, `PUT /milestones/{id}/dod/{itemId}`, `POST /milestones/{id}/submit`, `PUT /criteria/{id}/verify`, `POST /webhooks/sepay/ipn`

---

## ASCII Swimlane

```
┌───────────────────────────────────┬──────────────────────────────────────┬─────────────────────┬───────────────────┐
│           CLIENT / CEO            │           SYSTEM (NestJS)            │       EXPERT        │     TECH_TEAM     │
├───────────────────────────────────┼──────────────────────────────────────┼─────────────────────┼───────────────────┤
│ ════ PHASE A: MILESTONE DEFINITION│                                      │                     │                   │
│                                   │                                      │                     │                   │
│ [1] CEO creates milestone:        │                                      │                     │                   │
│     deliverable_statement,        │                                      │                     │                   │
│     sign_off_authority,           │                                      │                     │                   │
│     payment_amount_vnd            │                                      │                     │                   │
│        └─────────────────────────>│                                      │                     │                   │
│                                   │ [2] POST /milestones                 │                     │                   │
│                                   │      INSERT milestones:              │                     │                   │
│                                   │        engagement_id,                │                     │                   │
│                                   │        milestone_number,             │                     │                   │
│                                   │        deliverable_statement,        │                     │                   │
│                                   │        sign_off_authority,           │                     │                   │
│                                   │        payment_amount_vnd,           │                     │                   │
│                                   │        state:'DEFINED'               │                     │                   │
│                                   │                                      │                     │                   │
│ [3] CEO defines acceptance        │                                      │                     │                   │
│     criteria (payment contract):  │                                      │                     │                   │
│     "Decision engine accuracy     │                                      │                     │                   │
│      ≥ 95% on test set"           │                                      │                     │                   │
│        └─────────────────────────>│                                      │                     │                   │
│                                   │ [4] POST /milestones/{id}/criteria   │                     │                   │
│                                   │      LLM criterion quality gate:     │                     │                   │
│                                   │      FastAPI checks for subjective   │                     │                   │
│                                   │      language → flags returned       │                     │                   │
│                                   │      INSERT acceptance_criteria:     │                     │                   │
│                                   │        milestone_id, criterion_text, │                     │                   │
│                                   │        is_required:true,             │                     │                   │
│                                   │        verified_by_role:'TECH_TEAM', │                     │                   │
│                                   │        verified_at:NULL              │                     │                   │
│                                   │      INSERT platform_decisions:      │                     │                   │
│                                   │        type:'CRITERION_QUALITY_GATE',│                     │                   │
│                                   │        entity_type:'acceptance_      │                     │                   │
│                                   │          criteria'                   │                     │                   │
│                                   │        decision:{flagged_issues}     │                     │                   │
│                                   │                                      │                     │                   │
├───────────────────────────────────┼──────────────────────────────────────┼─────────────────────┼───────────────────┤
│ ═════════ PHASE B: FUNDING ══════ │                                      │                     │                   │
│                                   │                                      │                     │                   │
│ [5] CEO clicks "Fund Milestone 1" │                                      │                     │                   │
│        └─────────────────────────>│                                      │                     │                   │
│                                   │ [6] PUT /milestones/{id}/fund        │                     │                   │
│                                   │      Create per-milestone VA via     │                     │                   │
│                                   │      SePay:                          │                     │                   │
│                                   │      INSERT virtual_accounts:        │                     │                   │
│                                   │        entity_type:'MILESTONE',      │                     │                   │
│                                   │        entity_id:milestone_id,       │                     │                   │
│                                   │        fixed_amount:payment_amount_  │                     │                   │
│                                   │          vnd,                        │                     │                   │
│                                   │        expires_at:now()+24h,         │                     │                   │
│                                   │        status:'ACTIVE'               │                     │                   │
│                                   │      UPDATE milestones SET           │                     │                   │
│                                   │        state:'AWAITING_PAYMENT',     │                     │                   │
│                                   │        va_number, va_expires_at      │                     │                   │
│ <─────────────────────────────────┼─ Return VietQR                       │                     │                   │
│ [7] Scans VietQR, transfers       │                                      │                     │                   │
│     exact fixed_amount via bank   │                                      │                     │                   │
│                                   │      ┌<── SePay IPN fires (External) │                     │                   │
│                                   │ [8] IPN MILESTONE branch:            │                     │                   │
│                                   │      a. Verify HMAC                  │                     │                   │
│                                   │      b. SELECT virtual_accounts      │                     │                   │
│                                   │         WHERE va_number=?            │                     │                   │
│                                   │         → entity_type='MILESTONE'    │                     │                   │
│                                   │         → entity_id=milestone_id     │                     │                   │
│                                   │      c. Validate: amount == va.fixed_│                     │                   │
│                                   │         amount (bank enforces this)  │                     │                   │
│                                   │      d. Idempotency: check wallet_txn│                     │                   │
│                                   │      e. DB TX (atomic):              │                     │                   │
│                                   │         [LEDGER: ESCROW_LOCK]        │                     │                   │
│                                   │         UPDATE wallets SET           │                     │                   │
│                                   │           available_balance -= amount│                     │                   │
│                                   │           locked_balance += amount   │                     │                   │
│                                   │         INSERT wallet_transactions:  │                     │                   │
│                                   │           type:'ESCROW_LOCK',        │                     │                   │
│                                   │           ref:'ESC_LOCK:{milestn_id}'│                     │                   │
│                                   │         INSERT escrow_accounts:      │                     │                   │
│                                   │           milestone_id, amount,      │                     │                   │
│                                   │           client_wallet_id,          │                     │                   │
│                                   │           expert_wallet_id,          │                     │                   │
│                                   │           status:'HELD'              │                     │                   │
│                                   │         UPDATE milestones SET        │                     │                   │
│                                   │           state:'FUNDED',            │                     │                   │
│                                   │           funded_at:now()            │                     │                   │
│                                   │         Auto-advance:                │                     │                   │
│                                   │           state:'IN_PROGRESS'        │                     │                   │
│                                   │         UPDATE paygated_documents SET│                     │                   │
│                                   │           release_state:'RELEASED'   │                     │                   │
│                                   │           WHERE milestone_id=?       │                     │                   │
│                                   │      f. Return 200 OK to SePay       │                     │                   │
│                                   │                                      │                     │                   │
│                                   │ [9] IF first milestone funded:       │                     │                   │
│                                   │      UPDATE engagements SET          │                     │                   │
│                                   │        state:'ACTIVE'                │                     │                   │
│                                   │      (CONNECTED → ACTIVE)            │                     │                   │
│                                   │                                      │                     │                   │
├───────────────────────────────────┼──────────────────────────────────────┼─────────────────────┼───────────────────┤
│ ═════ PHASE C: DoD CHECKLIST ════ │                                      │                     │                   │
│                                   │                                      │                     │                   │
│                                   │                                      │ [10] Expert creates │                   │
│                                   │                                      │ DoD checklist:      │                   │
│                                   │                                      │ POST /milestones/   │                   │
│                                   │                                      │   {id}/dod-items    │                   │
│                                   │ [11] INSERT milestone_dod_items:     │<────────────────────┘                   │
│                                   │      milestone_id, item_description, │                     │                   │
│                                   │      is_required:true,               │                     │                   │
│                                   │      status:'PENDING'                │                     │                   │
│                                   │                                      │                     │                   │
│                                   │                                      │ [12] Expert marks   │                   │
│                                   │                                      │ items COMPLETED     │                   │
│                                   │ [13] PUT /milestones/{id}/dod/       │<────────────────────┘                   │
│                                   │        {itemId}                      │                     │                   │
│                                   │      UPDATE milestone_dod_items SET  │                     │                   │
│                                   │        status:'COMPLETED',           │                     │                   │
│                                   │        completed_at:now(),           │                     │                   │
│                                   │        completion_note:{text}        │                     │                   │
│                                   │      (IF is_required=true: note req) │                     │                   │
│                                   │      DB CHECK enforced:              │                     │                   │
│                                   │      NOT(is_required=true AND        │                     │                   │
│                                   │        status='NOT_APPLICABLE')      │                     │                   │
│                                   │                                      │                     │                   │
├───────────────────────────────────┼──────────────────────────────────────┼─────────────────────┼───────────────────┤
│ ═══ PHASE D: SUBMIT DELIVERABLE ═ │                                      │                     │                   │
│                                   │                                      │                     │                   │
│                                   │                                      │ [14] Expert submits │                   │
│                                   │                                      │ deliverable         │                   │
│                                   │ [15] POST /milestones/{id}/submit    │<────────────────────┘                   │
│                                   │      GUARD:                          │                     │                   │
│                                   │      SELECT COUNT(*) FROM            │                     │                   │
│                                   │        milestone_dod_items           │                     │                   │
│                                   │        WHERE milestone_id=? AND      │                     │                   │
│                                   │          is_required=true AND        │                     │                   │
│                                   │          status!='COMPLETED'         │                     │                   │
│                                   │      IF >0 → 422 REQUIRED_DOD_       │                     │                   │
│                                   │        INCOMPLETE with list of       │                     │                   │
│                                   │        unchecked items               │                     │                   │
│                                   │      INSERT milestone_submissions:   │                     │                   │
│                                   │        milestone_id, expert_id,      │                     │                   │
│                                   │        description, files_json,      │                     │                   │
│                                   │        submitted_at:now()            │                     │                   │
│                                   │      UPDATE milestones SET           │                     │                   │
│                                   │        state:'SUBMITTED',            │                     │                   │
│                                   │        submitted_at:now()            │                     │                   │
│                                   │                                      │                     │                   │
├───────────────────────────────────┼──────────────────────────────────────┼─────────────────────┼───────────────────┤
│ ════════ PHASE E: SIGN-OFF ══════ │                                      │                     │                   │
│                                   │                                      │                     │                   │
│                                   │                                      │                     │ [16] TECH_TEAM    │
│                                   │                                      │                     │ verifies criteria │
│                                   │                                      │                     │ criterion by      │
│                                   │                                      │                     │ criterion:        │
│                                   │ [17] PUT /criteria/{id}/verify       │                     │<──────────────────┘
│                                   │      UPDATE acceptance_criteria SET  │                     │                   │
│                                   │        verified_at:now()             │                     │                   │
│                                   │      OR write revision_note (reject) │                     │                   │
│                                   │        → milestone state: IN_REVISION│                     │                   │
│                                   │                                      │                     │                   │
│                                   │ [18] APPROVED GUARD:                 │                     │                   │
│                                   │      SELECT COUNT(*) FROM            │                     │                   │
│                                   │        acceptance_criteria           │                     │                   │
│                                   │        WHERE milestone_id=? AND      │                     │                   │
│                                   │          is_required=true AND        │                     │                   │
│                                   │          verified_at IS NULL         │                     │                   │
│                                   │      IF >0 → 422 UNVERIFIED_CRITERIA │                     │                   │
│                                   │        with list of unverified       │                     │                   │
│                                   │        criteria                      │                     │                   │
│                                   │                                      │                     │                   │
│                                   │ [19] ALL required criteria verified →│                     │                   │
│                                   │      APPROVED — atomic ledger release│                     │                   │
│                                   │      DB TX:                          │                     │                   │
│                                   │      [LEDGER: ESCROW_RELEASE]        │                     │                   │
│                                   │      UPDATE wallets (client) SET     │                     │                   │
│                                   │        locked_balance -= amount      │                     │                   │
│                                   │      [LEDGER: PLATFORM_FEE]          │                     │                   │
│                                   │      fee = amount * platform_fee_pct │                     │                   │
│                                   │      (READ from platform_settings,   │                     │                   │
│                                   │       NOT hardcoded)                 │                     │                   │
│                                   │      UPDATE wallets (platform) SET   │                     │                   │
│                                   │        available_balance += fee      │                     │                   │
│                                   │      [LEDGER: CREDIT_EXPERT]         │                     │                   │
│                                   │      net = amount - fee              │                     │                   │
│                                   │      UPDATE wallets (expert) SET     │                     │                   │
│                                   │        available_balance += net      │                     │                   │
│                                   │      INSERT wallet_txns (3 rows):    │                     │                   │
│                                   │        ESCROW_RELEASE, PLATFORM_FEE, │                     │                   │
│                                   │        (expert credit via            │                     │                   │
│                                   │         ESCROW_RELEASE)              │                     │                   │
│                                   │      UPDATE escrow_accounts SET      │                     │                   │
│                                   │        status:'RELEASED',            │                     │                   │
│                                   │        released_at:now()             │                     │                   │
│                                   │      UPDATE milestones SET           │                     │                   │
│                                   │        state:'APPROVED',             │                     │                   │
│                                   │        approved_at:now()             │                     │                   │
│                                   │      COMMIT                          │                     │                   │
│                                   │      → chi hộ API called (async)     │                     │                   │
│                                   │        [API] POST SePay chi hộ:      │                     │                   │
│                                   │        {amount:net, bank_account_xid,│                     │                   │
│                                   │         reference:"WD-{withdraw_id}"}│                     │                   │
│                                   │      INSERT withdrawal_requests:     │                     │                   │
│                                   │        type:'MILESTONE_RELEASE',     │                     │                   │
│                                   │        status:'PENDING'              │                     │                   │
│                                   │                                      │                     │                   │
│                                   │ [20] SePay credit IPN → withdrawal   │                     │                   │
│                                   │      COMPLETED                       │                     │                   │
│                                   │      UPDATE milestones SET           │                     │                   │
│                                   │        state:'RELEASED',             │                     │                   │
│                                   │        released_at:now()             │                     │                   │
│                                   │                                      │                     │                   │
│                                   │ [21] IF all milestones RELEASED:     │                     │                   │
│                                   │      UPDATE engagements SET          │                     │                   │
│                                   │        state:'CLOSED'                │                     │                   │
└───────────────────────────────────┴──────────────────────────────────────┴─────────────────────┴───────────────────┘
```

---

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | CEO | Create milestone | `milestones` (C) | state: DEFINED | `POST /milestones` |
| 3-4 | CEO→FastAPI | Define criteria + LLM quality gate | `acceptance_criteria` (C), `platform_decisions` (C) | verified_at: NULL | `POST /milestones/{id}/criteria` |
| 5-6 | CEO | Fund milestone → VA created | `virtual_accounts` (C), `milestones` (U) | state: DEFINED→AWAITING_PAYMENT | `PUT /milestones/{id}/fund` |
| 7-8 | CEO→SePay→NestJS | Scan QR → IPN → escrow lock | `virtual_accounts` (R), `wallets` (U), `wallet_transactions` (C), `escrow_accounts` (C), `milestones` (U), `paygated_documents` (U) | state: AWAITING_PAYMENT→FUNDED→IN_PROGRESS; escrow: HELD | `POST /webhooks/sepay/ipn` |
| 9 | NestJS | First milestone → engagement ACTIVE | `engagements` (U) | state: CONNECTED→ACTIVE | — |
| 10-11 | Expert | Create DoD items | `milestone_dod_items` (C) | status: PENDING | `POST /milestones/{id}/dod-items` |
| 12-13 | Expert | Complete DoD items | `milestone_dod_items` (U) | status: PENDING→COMPLETED | `PUT /milestones/{id}/dod/{itemId}` |
| 14-15 | Expert | Submit deliverable (DoD guard) | `milestone_submissions` (C), `milestones` (U) | state: IN_PROGRESS→SUBMITTED | `POST /milestones/{id}/submit` |
| 16-17 | TECH_TEAM | Verify criteria | `acceptance_criteria` (U) | verified_at set (or revision_note written) | `PUT /criteria/{id}/verify` |
| 18-19 | System | All required criteria verified → APPROVED + ledger release | `wallets` (U ×3), `wallet_transactions` (C ×3), `escrow_accounts` (U), `milestones` (U), `withdrawal_requests` (C) | state: SUBMITTED→APPROVED; escrow: HELD→RELEASED | — |
| 20 | SePay→NestJS | Chi hộ credit IPN | `withdrawal_requests` (U), `milestones` (U) | state: APPROVED→RELEASED; withdrawal: COMPLETED | `POST /webhooks/sepay/ipn` |
| 21 | NestJS | All milestones RELEASED → engagement CLOSED | `engagements` (U) | state: ACTIVE→CLOSED | — |

---

## Milestone State Machine (§0.6 — Scope-Reduced)

```
DEFINED → AWAITING_PAYMENT → FUNDED → IN_PROGRESS → SUBMITTED → APPROVED → RELEASED
                                                    ↕            ↑
                                                 IN_REVISION ────┘
                                                    ↓
                                                 DISPUTED
```

---

# MF-8: Dispute Resolution (2-Layer)

## Overview

Dispute filed against a specific acceptance criterion. Layer 1: LLM evaluates criterion vs. deliverable. If confidence ≥ 0.80 → AUTO_RESOLVED. If < 0.80 → MANUAL_REVIEW → admin resolves via dashboard button. References: §0.6 (Dispute states), §0.8 (Ledger operations).

**Tables touched (5):** `disputes`, `escrow_accounts`, `wallet_transactions`, `wallets`, `platform_decisions`

**Endpoints:** `POST /disputes`, `PUT /admin/disputes/{id}/resolve`

---

## ASCII Swimlane

```
+-----------------------------------+-----------------------------------------+-----------------------------------+
|   FILING PARTY (Expert/CEO/Tech)  |     SYSTEM (NestJS + FastAPI)           |           ADMIN                   |
+-----------------------------------+-----------------------------------------+-----------------------------------+
|                                   |                                         |                                   |
| [1] Files dispute against         |                                         |                                   |
|     specific criterion on         |                                         |                                   |
|     SUBMITTED/IN_REVISION         |                                         |                                   |
|     milestone                     |                                         |                                   |
|                 +─────────────────>|                                        |                                   |
|                                   | [2] POST /disputes                      |                                   |
|                                   |   INSERT disputes:                      |                                   |
|                                   |     engagement_id, milestone_id,        |                                   |
|                                   |     criterion_id, escrow_account_id,    |                                   |
|                                   |     filed_by,                           |                                   |
|                                   |     state:'LAYER_1_EVAL',               |                                   |
|                                   |     filed_at:now()                      |                                   |
|                                   |   UPDATE escrow_accounts SET            |                                   |
|                                   |     status:'FROZEN'                     |                                   |
|                                   |   UPDATE milestones SET                 |                                   |
|                                   |     state:'DISPUTED'                    |                                   |
|                                   |                                         |                                   |
|                                   | [3] FastAPI LLM evaluation:             |                                   |
|                                   |   POST /llm/dispute-eval                |                                   |
|                                   |   Input: criterion_text +               |                                   |
|                                   |     deliverable (milestone_             |                                   |
|                                   |     submissions)                        |                                   |
|                                   |   Returns {confidence, finding}         |                                   |
|                                   |                                         |                                   |
|                                   | [4] IF confidence ≥ 0.80:               |                                   |
|                                   |   AUTO_RESOLVED                         |                                   |
|                                   |   UPDATE disputes SET                   |                                   |
|                                   |     state:'AUTO_RESOLVED',              |                                   |
|                                   |     llm_confidence:{score},             |                                   |
|                                   |     resolved_at:now()                   |                                   |
|                                   |   INSERT platform_decisions:            |                                   |
|                                   |     type:'DISPUTE_L1_EVAL',             |                                   |
|                                   |     decision:'AUTO_RESOLVED'            |                                   |
|                                   |   LEDGER per finding:                   |                                   |
|                                   |   IF expert wins:                       |                                   |
|                                   |     [ESCROW_RELEASE + PLATFORM_FEE +    |                                   |
|                                   |      CREDIT_EXPERT] (same as MF-7)      |                                   |
|                                   |   IF client wins:                       |                                   |
|                                   |     [ESCROW_REFUND] client              |                                   |
|                                   |     available_balance += amount         |                                   |
|                                   |   UPDATE escrow_accounts SET            |                                   |
|                                   |     status:'RELEASED'|'REFUNDED'        |                                   |
|                                   |   UPDATE milestones SET                 |                                   |
|                                   |     state:'APPROVED'                    |                                   |
|                                   |                                         |                                   |
|                                   | [5] IF confidence < 0.80:               |                                   |
|                                   |   → MANUAL_REVIEW                       |                                   |
|                                   |   UPDATE disputes SET                   |                                   |
|                                   |     state:'MANUAL_REVIEW',              |                                   |
|                                   |     llm_confidence:{score}              |                                   |
|                                   |                 +──────────────────────>|                                   |
|                                   |                                         | [6] Admin views dispute in        |
|                                   |                                         | Dispute Monitor:                  |
|                                   |                                         | both parties' positions,          |
|                                   |                                         | escrow amount, LLM confidence     |
|                                   |                                         |                                   |
|                                   |                                         | [7] Admin clicks one of 3         |
|                                   |                                         | buttons:                          |
|                                   |                                         | "Release to Expert" /             |
|                                   |                                         | "Refund to Client" /              |
|                                   |                                         | "Split 50/50"                     |
|                                   |                 +<──────────────────────|                                   |
|                                   | [8] PUT /admin/disputes/{id}/resolve    |                                   |
|                                   |   UPDATE disputes SET                   |                                   |
|                                   |     state:'RESOLVED',                   |                                   |
|                                   |     resolved_at:now()                   |                                   |
|                                   |   LEDGER per admin choice:              |                                   |
|                                   |   Release to Expert:                    |                                   |
|                                   |     [ESCROW_RELEASE + FEE + CREDIT]     |                                   |
|                                   |   Refund to Client:                     |                                   |
|                                   |     [ESCROW_REFUND]                     |                                   |
|                                   |   Split 50/50:                          |                                   |
|                                   |     [ESCROW_SPLIT]                      |                                   |
|                                   |     client avail += amount/2            |                                   |
|                                   |     expert avail += amount/2            |                                   |
|                                   |   UPDATE escrow_accounts SET            |                                   |
|                                   |     status:'RELEASED'|'REFUNDED'|'SPLIT'|                                   |
|                                   |   UPDATE milestones SET                 |                                   |
|                                   |     state:'APPROVED'                    |                                   |
|                                   |   (Milestone reaches APPROVED regardles |                                   |
|                                   |    of dispute outcome — lifecycle close)|                                   |
+-----------------------------------+-----------------------------------+-----------------------------------------+
```

---

## Dispute State Machine (2-Layer — §0.6)

```
PENDING → LAYER_1_EVAL
           → AUTO_RESOLVED (confidence ≥ 0.80) [LEDGER]
           → MANUAL_REVIEW (confidence < 0.80)
              → RESOLVED (admin button) [LEDGER]
```

**Key scope-reduction:** No Layer 2 mutual agreement (48h cooling window) or Layer 3 automatic 50/50 split. Admin resolves Layer 2 manually with 3 options. No `dispute_resolution_reports` table.

---

## Group 3 — Path B: Service Marketplace

---

# MF-9: Expert Service Publishing (AI Generator)

## Overview

Expert (Pro) uses AI Service Generator to create a service listing. Publishes to marketplace. References: §0.9 (Expert Pro required for AI Service Generator).

**Tables touched (2):** `services`, `expert_profiles`

**Endpoints:** `POST /services/generate`, `POST /services`, `PUT /services/{id}`

---

## ASCII Swimlane

```
+-----------------------------------+-----------------------------------+
|           EXPERT                  |     SYSTEM (NestJS + FastAPI)     |
+-----------------------------------+-----------------------------------+
|                                   |                                   |
| [1] Clicks "Create Service"       |                                   |
|     Guard: sub_expert_tier='pro'  |                                   |
|                 +────────────────>|                                   |
|                                   | [2] Guard check; render form      |
|                 +<────────────────|                                   |
|                                   |                                   |
| [3] Inputs key capabilities +     |                                   |
|     target use cases              |                                   |
|                 +────────────────>|                                   |
|                                   | [4] FastAPI: POST /llm/service-   |
|                                   |   generate                        |
|                                   |   LLM generates: title, desc,     |
|                                   |   scope, timeline, suggested_price|
|                                   |   Return {generated_service}      |
|                 +<────────────────|                                   |
| [5] Expert edits generated draft  |                                   |
|     Sets price, domains, seams    |                                   |
|                 +────────────────>|                                   |
|                                   | [6] POST /services                |
|                                   |   INSERT services:                |
|                                   |     expert_id, title, description,|
|                                   |     domains_json, seams_json,     |
|                                   |     price_vnd,                    |
|                                   |     state:'DRAFT',                |
|                                   |     service_type:'AI_SERVICE'     |
|                 +<────────────────|                                   |
| [7] Clicks "Publish"              |                                   |
|                 +────────────────>|                                   |
|                                   | [8] PUT /services/{id}            |
|                                   |   UPDATE services SET             |
|                                   |     state:'PUBLISHED'             |
|                 +<────────────────|                                   |
| [9] Service visible in marketplace|                                   |
+-----------------------------------+-----------------------------------+
```

---

# MF-10: Client Buys Service / Tech Discovery

## Overview

CEO browses marketplace, purchases a service via per-order VA payment. Creates SERVICE_PURCHASE or TECH_DISCOVERY engagement directly in ACTIVE state (no bid, no elicitation). References: §0.6 (Engagement types), §0.8 (Payment Architecture).

**Tables touched (5):** `services`, `engagements`, `virtual_accounts`, `escrow_accounts`, `wallet_transactions`

**Endpoints:** `GET /services`, `POST /services/{id}/purchase`, `POST /webhooks/sepay/ipn`

---

## ASCII Swimlane

```
+-----------------------------------+----------------------------------------+-----------------------------------+
|        CLIENT / CEO               |     SYSTEM (NestJS)                    |        SePay                      |
+-----------------------------------+----------------------------------------+-----------------------------------+
|                                   |                                        |                                   |
| [1] Browses marketplace           |                                        |                                   |
|     GET /services (free tier OK)  |                                        |                                   |
|                                   |                                        |                                   |
| [2] Clicks "Buy" on service       |                                        |                                   |
|                 +─────────────────>|                                       |                                   |
|                                   | [3] POST /services/{id}/purchase       |                                   |
|                                   |   Guard: active_role='CLIENT' &        |                                   |
|                                   |   client_subtype='CEO'                 |                                   |
|                                   |   DB TX:                               |                                   |
|                                   |   INSERT engagements:                  |                                   |
|                                   |     service_id, expert_id,             |                                   |
|                                   |     type:'SERVICE_PURCHASE',           |                                   |
|                                   |     state:'PENDING'                    |                                   |
|                                   |   INSERT virtual_accounts:             |                                   |
|                                   |     entity_type:'SERVICE',             |                                   |
|                                   |     entity_id:engagement_id,           |                                   |
|                                   |     fixed_amount:service.price_vnd,    |                                   |
|                                   |     expires_at:now()+24h,              |                                   |
|                                   |     status:'ACTIVE'                    |                                   |
|                                   |   Return VietQR                        |                                   |
|                 +<────────────────|                                        |                                   |
| [4] Scans VietQR, transfers       |                                        |                                   |
|                                   |                                        | [5] SePay IPN fires               |
|                                   |                 +<─────────────────────| POST /webhooks/sepay/ipn          |
|                                   | [6] IPN SERVICE branch:                |                                   |
|                                   |   a. Verify HMAC                       |                                   |
|                                   |   b. Resolve VA → engagement_id        |                                   |
|                                   |   c. Validate amount == fixed_amount   |                                   |
|                                   |   d. DB TX (atomic):                   |                                   |
|                                   |      [LEDGER: ESCROW_LOCK]             |                                   |
|                                   |      wallets: avail -= amt,            |                                   |
|                                   |        locked += amt                   |                                   |
|                                   |      INSERT escrow_accounts:           |                                   |
|                                   |        engagement_id (not milestone_id)|                                   |
|                                   |        status:'HELD'                   |                                   |
|                                   |      UPDATE engagements SET            |                                   |
|                                   |        state:'ACTIVE'                  |                                   |
|                                   |      Create single auto-milestone:     |                                   |
|                                   |      INSERT milestones:                |                                   |
|                                   |        engagement_id, number:1,        |                                   |
|                                   |        sign_off_authority:'CEO',       |                                   |
|                                   |        payment_amount_vnd,             |                                   |
|                                   |        state:'FUNDED'                  |                                   |
|                                   |   e. Return 200 OK                     |                                   |
|                                   |   Notify expert: "New service order"   |                                   |
|                 +<────────────────|                                        |                                   |
| [7] Engagement ACTIVE             |                                        |                                   |
|     CEO sole sign-off authority   |                                        |                                   |
|     Single milestone, no bid      |                                        |                                   |
+-----------------------------------+----------------------------------------+-----------------------------------+
```

---

**Key structural difference from Path A:** No elicitation, no matching, no bid, no TECH_TEAM involvement. Single fixed-price milestone with CEO-only sign-off. `engagements.project_id = NULL`, `engagements.service_id NOT NULL`. Enforced by table-level CHECK constraint.

---

## Group 4 — Financial Flows

---

# MF-11: Wallet Top-Up

## Overview

User scans permanent WALLET_TOPUP VA VietQR. SePay IPN credits wallet. Pure internal ledger — no external API calls.

**Tables touched (3):** `virtual_accounts`, `wallets`, `wallet_transactions`

**Endpoints:** `POST /wallet/topup-qr`, `POST /webhooks/sepay/ipn`

---

## ASCII Swimlane

```
+-----------------------------------+------------------------------------+-----------------------------------+
|           USER (CEO/Expert)       |     SYSTEM (NestJS)                |        SePay                      |
+-----------------------------------+------------------------------------+-----------------------------------+
|                                   |                                    |                                   |
| [1] Clicks "Top Up"               |                                    |                                   |
|                 +─────────────────>|                                   |                                   |
|                                   | [2] POST /wallet/topup-qr          |                                   |
|                                   |   SELECT virtual_accounts          |                                   |
|                                   |   WHERE entity_id=user_id AND      |                                   |
|                                   |     entity_type='WALLET_TOPUP' AND |                                   |
|                                   |     status='ACTIVE'                |                                   |
|                                   |   Generate VietQR from va_number   |                                   |
|                                   |   Return {qr_url, va_number}       |                                   |
|                 +<─────────────────|                                   |                                   |
| [3] Scans QR, transfers amount    |                                    |                                   |
|                                   |                                    | [4] SePay IPN fires               |
|                                   |                 +<─────────────────|                                   |
|                                   | [5] IPN WALLET_TOPUP branch:       |                                   |
|                                   |   a. Verify HMAC                   |                                   |
|                                   |   b. Resolve va_number → user_id   |                                   |
|                                   |   c. Idempotency: SELECT FROM      |                                   |
|                                   |      wallet_transactions WHERE     |                                   |
|                                   |      reference_id=? (UNIQUE idx)   |                                   |
|                                   |   d. DB TX:                        |                                   |
|                                   |      UPDATE wallets SET            |                                   |
|                                   |        available_balance += amount |                                   |
|                                   |      INSERT wallet_transactions:   |                                   |
|                                   |        type:'TOP_UP', amount,      |                                   |
|                                   |        reference_id: transfer_ref  |                                   |
|                                   |      COMMIT                        |                                   |
|                                   |   e. Return 200 OK                 |                                   |
|                 +<─────────────────|   f. Notify user                  |                                   |
| [6] Balance updated               |                                    |                                   |
+-----------------------------------+------------------------------------+-----------------------------------+
```

**Idempotency guarantee:** `wallet_transactions` has `UNIQUE INDEX wallet_tx_idempotency ON (wallet_id, reference_id) WHERE reference_id IS NOT NULL`. SePay IPN retries cannot double-credit.

---

# MF-12: Expert Withdrawal (Chi Hộ)

## Overview

Expert requests cash-out. System debits wallet atomically, calls SePay chi hộ API. Credit IPN confirms completion. Zero admin involvement.

**Tables touched (3):** `wallets`, `wallet_transactions`, `withdrawal_requests`

**Endpoints:** `POST /withdrawals`, `POST /webhooks/sepay/ipn`

---

## ASCII Swimlane

```
+-----------------------------------+-----------------------------------------+-----------------------------------+
|           EXPERT                  |     SYSTEM (NestJS)                     |        SePay                      |
+-----------------------------------+-----------------------------------------+-----------------------------------+
|                                   |                                         |                                   |
| [1] Clicks "Withdraw"             |                                         |                                   |
|     Enters amount                 |                                         |                                   |
|                 +─────────────────>|                                        |                                   |
|                                   | [2] POST /withdrawals                   |                                   |
|                                   |   Guard: users.sepay_bank_account_      |                                   |
|                                   |   xid IS NOT NULL                       |                                   |
|                                   |   Guard: wallets.available_balance      |                                   |
|                                   |   >= amount                             |                                   |
|                                   |   DB TX (atomic):                       |                                   |
|                                   |   UPDATE wallets SET                    |                                   |
|                                   |     available_balance -= amount         |                                   |
|                                   |   INSERT wallet_transactions:           |                                   |
|                                   |     type:'WITHDRAWAL', amount,          |                                   |
|                                   |     ref:'WD-{withdrawal_id}'            |                                   |
|                                   |   INSERT withdrawal_requests:           |                                   |
|                                   |     expert_id, type:'EXPERT_MANUAL',    |                                   |
|                                   |     amount, bank_account_xid,           |                                   |
|                                   |     status:'PENDING',                   |                                   |
|                                   |     requested_at:now()                  |                                   |
|                                   |   COMMIT                                |                                   |
|                                   |                                         |                                   |
|                                   | [3] [API] POST SePay chi hộ:            |                                   |
|                                   |   {amount, bank_account_xid,            |                                   |
|                                   |    reference:"WD-{id}"}                 |                                   |
|                                   |                 +─────────────────────> | [4] SePay processes chi hộ        |
|                                   |                 +<───────────────────── | Returns {disbursement_id}         |
|                                   |   UPDATE withdrawal_requests SET        |                                   |
|                                   |     disbursement_id, status:'PROCESSING'|                                   |
|                                   |                                         |                                   |
|                                   |                                         | [5] SePay credit IPN fires        |
|                                   |                                         | on expert's linked bank account   |
|                                   |                 +<──────────────────────|                                   |
|                                   | [6] IPN (or chi hộ callback):           |                                   |
|                                   |   UPDATE withdrawal_requests SET        |                                   |
|                                   |     status:'COMPLETED',                 |                                   |
|                                   |     confirmed_at:now()                  |                                   |
|                                   |   Notify expert                         |                                   |
|                 +<─────────────────|                                        |                                   |
| [7] ✓ Withdrawal complete         |                                         |                                   |
|     Money in expert's bank        |                                         |                                   |
|                                   |                                         |                                   |
|   FAILURE PATH:                   |                                         |                                   |
|                                   | [8] IF chi hộ API error:                |                                   |
|                                   |   DB TX:                                |                                   |
|                                   |   UPDATE wallets SET                    |                                   |
|                                   |     available_balance += amount         |                                   |
|                                   |     (balance restored)                  |                                   |
|                                   |   INSERT wallet_transactions:           |                                   |
|                                   |     type:'WITHDRAWAL', amount,          |                                   |
|                                   |     ref:'WD-{id}-REVERSAL'              |                                   |
|                                   |   UPDATE withdrawal_requests SET        |                                   |
|                                   |     status:'FAILED'                     |                                   |
|                                   |   Notify expert with error details      |                                   |
+-----------------------------------+-----------------------------------------+-----------------------------------+
```

---

# MF-13: Subscription Purchase from Wallet

## Overview

Pure internal wallet deduction. No VA, no IPN. Atomic transaction debits wallet and updates user subscription columns.

**Tables touched (3):** `users`, `wallets`, `wallet_transactions`

**Endpoints:** `POST /subscriptions/activate`

---

## ASCII Swimlane

```
+-----------------------------------+---------------------------------------+
|           USER                    |     SYSTEM (NestJS)                   |
+-----------------------------------+---------------------------------------+
|                                   |                                       |
| [1] Clicks "Activate Pro"         |                                       |
|     (Client Pro: 500K / Expert    |                                       |
|      Pro: 300K)                   |                                       |
|                 +────────────────>|                                       |
|                                   | [2] POST /subscriptions/activate      |
|                                   |   {role_type: "client"|"expert"}      |
|                                   |                                       |
|                                   |   Guard 1: user.sub_{role}_tier       |
|                                   |     IF "pro" AND not expired          |
|                                   |     → 409 ALREADY_SUBSCRIBED          |
|                                   |                                       |
|                                   |   Guard 2: wallets.available_balance  |
|                                   |     >= price[role_type]               |
|                                   |     NO → 422 INSUFFICIENT_BALANCE     |
|                                   |                                       |
|                                   |   DB TX (atomic):                     |
|                                   |   UPDATE wallets SET                  |
|                                   |     available_balance -= price        |
|                                   |   INSERT wallet_transactions:         |
|                                   |     type:'SUBSCRIPTION', amount:price,|                                   
|                                   |     ref:'SUB-{user_id}:{role_type}'   |
|                                   |   UPDATE users SET                    |
|                                   |     subscription_{role}_tier='pro',   |
|                                   |     sub_{role}_expires_at=now()+6mo   |
|                                   |   COMMIT                              |
|                                   |   Reissue JWT (updated tier claims)   |
|                 +<────────────────|   Notify user                         |
| [3] ✓ Pro subscription active    |                                        |
|     All gated features unlocked  |                                        |
+-----------------------------------+---------------------------------------+
```

**Key scope-reduction:** No `user_subscriptions` table. Subscription state stored as `users.subscription_client_tier`, `users.sub_client_expires_at`, `users.subscription_expert_tier`, `users.sub_expert_expires_at`. The `wallet_transactions` reference_id pattern `SUB-{user_id}:{role_type}` provides the audit trail that the cut table would have provided.

---

## Group 5 — Platform-Specific Flows

---

# MF-14: Pay-Gated Document Release (IPN-Triggered)

## Overview

Core F5 IP deadlock resolution mechanism. Expert stages reasoning documents tagged to a milestone. When SePay IPN confirms milestone FUNDED, documents auto-release to TECH_TEAM. CEO permanently excluded. References: §0.7 (RBAC — TECH_TEAM-only access).

**Tables touched (2):** `paygated_documents`, `milestones`

**Endpoints:** `POST /milestones/{id}/paygated-docs`, `GET /milestones/{id}/paygated-docs`

---

## ASCII Swimlane

```
+-----------------------------------+-----------------------------------+-----------------------------------+
|           EXPERT                  |     SYSTEM (NestJS)               |     CLIENT / TECH_TEAM            |
+-----------------------------------+-----------------------------------+-----------------------------------+
|                                   |                                   |                                   |
| ═══ STAGING (pre-funding) ════════|                                   |                                   |
|                                   |                                   |                                   |
| [1] Expert uploads reasoning doc  |                                   |                                   |
|     tagged to milestone_id        |                                   |                                   |
|                 +─────────────────>|                                  |                                   |
|                                   | [2] POST /milestones/{id}/        |                                   |
|                                   |   paygated-docs                   |                                   |
|                                   |   INSERT paygated_documents:      |                                   |
|                                   |     milestone_id, document_url,   |                                   |
|                                   |     release_state:'STAGED',       |                                   |
|                                   |     staged_at:now(),              |                                   |
|                                   |     released_at:NULL              |                                   |
|                 +<─────────────────|                                  |                                   |
| [3] Doc in staging — not yet      |                                   |                                   |
|     visible to TECH_TEAM          |                                   |                                   |
|                                   |                                   |                                   |
| ═══ RELEASE (IPN-triggered) ══════|                                   |                                   |
|                                   |                                   |                                   |
|                                   | [4] SePay IPN confirms milestone  |                                   |
|                                   |   FUNDED (step 8 in MF-7)         |                                   |
|                                   |   As part of IPN handler TX:      |                                   |
|                                   |   UPDATE paygated_documents SET   |                                   |
|                                   |     release_state:'RELEASED',     |                                   |
|                                   |     released_at:now()             |                                   |
|                                   |     WHERE milestone_id=?          |                                   |
|                                   |                                   |                                   |
|                                   |                                   | [5] TECH_TEAM accesses docs       |
|                                   |                                   |   GET /milestones/{id}/           |
|                                   |                                   |   paygated-docs                   |
|                                   |                                   |   Route guard:                    |
|                                   |                                   |   release_state='RELEASED' AND    |
|                                   |                                   |   requester.client_subtype=       |
|                                   |                                   |   'TECH_TEAM'                     |
|                                   |                                   |   CEO → 403 FORBIDDEN             |
|                                   |                                   |   (permanently excluded)          |
+-----------------------------------+-----------------------------------+-----------------------------------+
```

---

# MF-15: Dual-Role Account Switch

## Overview

Single account holds `roles: ["CLIENT_CEO", "EXPERT"]`. Role switcher reissues JWT with new `active_role`. Self-exclusion always applies. References: §0.7 (Dual-role, self-exclusion).

**Tables touched (1):** `users`

**Endpoints:** `POST /auth/switch-role`

---

## ASCII Swimlane

```
+-----------------------------------+------------------------------------+
|           USER (Dual-Role)        |     SYSTEM (NestJS)                |
+-----------------------------------+------------------------------------+
|                                   |                                    |
| [1] Clicks role switcher in nav   |                                    |
|     (visible when roles.length>1) |                                    |
|     Selects "Expert" context      |                                    |
|                 +────────────────>|                                    |
|                                   | [2] POST /auth/switch-role         |
|                                   |   {active_role: "EXPERT"}          |
|                                   |   Validate: "EXPERT" IN users.roles|                                   
|                                   |   Reissue JWT:                     |
|                                   |   {sub, active_role:"EXPERT",      |
|                                   |    client_subtype:null,            |
|                                   |    roles:["CLIENT_CEO","EXPERT"]}  |
|                                   |   Set HTTP-only cookie             |
|                 +<────────────────|                                    |
| [3] Expert Dashboard renders      |                                    |
|     (different from CEO Dashboard)|                                    |
|                                   |                                    |
| ═══ SELF-EXCLUSION ENFORCEMENT ═══|                                    |
|                                   |                                    |
| [4] Expert browses projects       |                                    |
|                                   | [5] Matching/bid queries ALWAYS    |
|                                   |   append:                          |
|                                   |   WHERE expert.user_id NOT IN      |
|                                   |   (SELECT user_id FROM             |
|                                   |    project_members WHERE           |
|                                   |    project_id=?)                   |
|                                   |   This fires regardless of         |
|                                   |   active_role — cannot bid on      |
|                                   |   own projects                     |
+-----------------------------------+------------------------------------+
```

---

# MF-16: Expert Portfolio Tier 2 Auto-Upgrade

## Overview

Dedicated flow for the LLM portfolio verification pipeline. Expert submits structured decision-point writeup. FastAPI evaluates. Auto-upgrades seam claim to EVIDENCE_BACKED if confidence ≥ 0.85. 5-attempt / 30-day lockout throttle. References: §0.4 (2-Tier Verification).

**Tables touched (3):** `portfolio_submissions`, `expert_seam_claims`, `platform_decisions`

**Endpoints:** `POST /portfolio-submissions`, `GET /portfolio-submissions/{id}/eval-result`

---

## ASCII Swimlane

```
+-----------------------------------+----------------------------------------+
|           EXPERT                  |     SYSTEM (NestJS + FastAPI)          |
+-----------------------------------+----------------------------------------+
|                                   |                                        |
| [1] Selects seam claim to upgrade |                                        |
|     e.g. seam_code='A↔C'          |                                        |
|     Guard: sub_expert_tier='pro'  |                                        |
|                                   |                                        |
| [2] Fills portfolio form:         |                                        |
|     • project_description         |                                        |
|     • decision_points (structured |                                        |
|       rubric response)            |                                        |
|                 +─────────────────>|                                       |
|                                   | [3] POST /portfolio-submissions        |
|                                   |   Throttle check:                      |
|                                   |   SELECT submission_count,             |
|                                   |     locked_until FROM                  |
|                                   |     expert_seam_claims WHERE           |
|                                   |     expert_id=? AND seam_code=?        |
|                                   |   IF count≥5 AND locked_until>now()    |
|                                   |     → 429 TOO_MANY_ATTEMPTS            |
|                                   |   INSERT portfolio_submissions:        |
|                                   |     expert_id, seam_claim_id,          |
|                                   |     project_description,               |
|                                   |     decision_points,                   |
|                                   |     status:'PENDING'                   |
|                                   |   UPDATE expert_seam_claims SET        |
|                                   |     submission_count += 1              |
|                                   |                                        |
|                                   | [4] FastAPI: POST /llm/portfolio-eval  |
|                                   |   LLM rubric evaluation:               |
|                                   |   • All required signal types found?   |
|                                   |   • Confidence score computed          |
|                                   |   Returns {confidence, passed,         |
|                                   |    gap_advisory?}                      |
|                                   |                                        |
|                                   | [5] IF confidence ≥ 0.85 AND passed:   |
|                                   |   DB TX:                               |
|                                   |   UPDATE portfolio_submissions SET     |
|                                   |     status:'APPROVED',                 |
|                                   |     llm_confidence:score,              |
|                                   |     evaluated_at:now()                 |
|                                   |   UPDATE expert_seam_claims SET        |
|                                   |     verification_tier='EVIDENCE_BACKED'|
|                                   |   INSERT platform_decisions:           |
|                                   |     type:'SEAM_TIER_UPGRADE',          |
|                                   |     entity_type:'expert_seam_claims',  |
|                                   |     entity_id:claim_id,                |
|                                   |     llm_confidence:score,              |
|                                   |     decision:'APPROVED'                |
|                                   |                                        |
|                                   | [6] IF confidence < 0.85 OR not passed:|
|                                   |   UPDATE portfolio_submissions SET     |
|                                   |     status:'REJECTED',                 |
|                                   |     llm_confidence:score,              |
|                                   |     evaluated_at:now()                 |
|                                   |   INSERT platform_decisions:           |
|                                   |     type:'PORTFOLIO_EVAL',             |
|                                   |     advisory_note:{gap_advisory}       |
|                                   |   IF submission_count≥5:               |
|                                   |     UPDATE expert_seam_claims SET      |
|                                   |       locked_until=now()+30days        |
|                 +<──────────── ───|                                        |
| [7] Result:                       |                                        |
|   ✓ Seam upgraded to Tier 2      |                                         |
|   ✗ Gap advisory shown; may      |                                         |
|     resubmit (if attempts remain) |                                        |
|    Locked for 30 days if 5        |                                        |
|     failed attempts               |                                        |
+-----------------------------------+---------------------------------------+
```

---

## Group 6 — Admin Flows

---

# MF-17: Platform Integrity Monitor & Analytics

## Overview

Read-only monitoring dashboard. Displays `platform_decisions` log, auto-upgrade/return history, dispute log, transaction ledger, analytics. References: §0.7 (ADMIN — read-only monitoring).

**Tables touched (1 — read only):** `platform_decisions` (plus read-only access to `wallet_transactions`, `disputes`, `escrow_accounts`, `users`, `withdrawal_requests`)

**Endpoints:** `GET /admin/decisions`, `GET /admin/disputes`, `GET /admin/transactions`, `GET /admin/analytics`

---

## ASCII Swimlane

```
+-----------------------------------+---------------------------------------+
|           ADMIN                   |     SYSTEM (NestJS)                   |
+-----------------------------------+---------------------------------------+
|                                   |                                       |
| [1] Opens Admin Dashboard         |                                       |
|                 +────────────────>|                                       |
|                                   | [2] GET /admin/decisions              |
|                                   |   SELECT * FROM platform_decisions    |
|                                   |   ORDER BY created_at DESC            |
|                                   |   Decision types (6 per §0.6):        |
|                                   |   • ELICITATION_SYNTHESIS             |
|                                   |   • SPEC_AUTO_RETURN                  |
|                                   |   • SEAM_TIER_UPGRADE                 |
|                                   |   • PORTFOLIO_EVAL                    |
|                                   |   • DISPUTE_L1_EVAL                   |
|                                   |   • CRITERION_QUALITY_GATE            |
|                 +<────────────────|                                       |
| [3] Views decision log with       |                                       |
|     LLM confidence scores,        |                                       |
|     entity references,            |                                       |
|     advisory notes                |                                       |
|                                   |                                       |
| [4] Views Dispute Monitor         |                                       |
|                 +────────────────>|                                       |
|                                   | [5] GET /admin/disputes               |
|                                   |   SELECT d.*, m.payment_amount_vnd,   |
|                                   |     ea.status as escrow_status        |
|                                   |   FROM disputes d                     |
|                                   |   JOIN milestones m ON d.milestone_id||
|                                   |   JOIN escrow_accounts ea ON          |
|                                   |     d.escrow_account_id=ea.id         |
|                                   |   WHERE d.state IN ('MANUAL_REVIEW',  |
|                                   |     'LAYER_1_EVAL')                   |
|                 +<────────────────|             m                         |
| [6] For MANUAL_REVIEW disputes:   |                                       |
|     sees both parties' positions  |                                       |
|     → See MF-18 for resolution    |                                       |
|                                   |                                       |
| [7] Views Transaction Ledger      |                                       |
|                 +────────────────>|                                       |
|                                   | [8] GET /admin/transactions           |
|                                   |   SELECT wt.*, u.email, u.full_name   |
|                                   |   FROM wallet_transactions wt         |
|                                   |   JOIN wallets w ON wt.wallet_id=w.id |
|                                   |   JOIN users u ON w.user_id=u.id      |
|                                   |   Filter: date, type, user, amount    |
|                 +<────────────────|                                       |
|                                   |                                       |
| [9] Views Analytics               |                                       |
|                                   | [10] GET /admin/analytics             |
|                                   |   Computed aggregates:                |
|                                   |   • Active projects by archetype/tier |
|                                   |   • Elicitation completion rate       |
|                                   |   • Portfolio auto-upgrade rate       |
|                                   |   • Dispute rate + LLM auto-resolve % |
|                                   |   • Milestone completion rate         |
+-----------------------------------+---------------------------------------+
```

---

# MF-18: Manual Dispute Resolution & Account Management

## Overview

Admin's only write actions: (1) resolve MANUAL_REVIEW disputes via dashboard button, (2) emergency spec pull-back, (3) account suspension. All three trigger atomic ledger or state operations. References: §0.7 (ADMIN — emergency write actions).

**Tables touched (4):** `disputes`, `escrow_accounts`, `wallets`, `wallet_transactions`, `projects`, `users`

**Endpoints:** `PUT /admin/disputes/{id}/resolve`, `PUT /admin/projects/{id}/suspend-spec`, `PUT /admin/users/{id}/suspend`

---

## ASCII Swimlane

```
┌───────────────────────────────────┬───────────────────────────────────┬───────────────────────────────────┐
│               ADMIN               │          SYSTEM (NestJS)          │         AFFECTED PARTIES          │
├───────────────────────────────────┼───────────────────────────────────┼───────────────────────────────────┤
│ ═════ DISPUTE RESOLUTION ════════ │                                   │                                   │
│                                   │                                   │                                   │
│ [1] Views MANUAL_REVIEW dispute   │                                   │                                   │
│     in Dispute Monitor            │                                   │                                   │
│     Sees: criterion, deliverable, │                                   │                                   │
│     both positions, escrow amount,│                                   │                                   │
│     LLM confidence (< 0.80)       │                                   │                                   │
│                                   │                                   │                                   │
│ [2] Clicks one of 3 buttons:      │                                   │                                   │
│     "Release to Expert"           │                                   │                                   │
│     "Refund to Client"            │                                   │                                   │
│     "Split 50/50"                 │                                   │                                   │
│        └─────────────────────────>│                                   │                                   │
│                                   │ [3] PUT /admin/disputes/{id}/     │                                   │
│                                   │       resolve                     │                                   │
│                                   │     Guard: active_role='ADMIN'    │                                   │
│                                   │     Guard: dispute.state=         │                                   │
│                                   │       'MANUAL_REVIEW'             │                                   │
│                                   │     DB TX (atomic):               │                                   │
│                                   │     UPDATE disputes SET           │                                   │
│                                   │       state:'RESOLVED',           │                                   │
│                                   │       resolved_at:now()           │                                   │
│                                   │                                   │                                   │
│                                   │     Per admin choice:             │                                   │
│                                   │     Release: [ESCROW_RELEASE + FEE│                                   │
│                                   │       + CREDIT_EXPERT]            │                                   │
│                                   │       (3 wallet_txns)             │                                   │
│                                   │     Refund: [ESCROW_REFUND]       │                                   │
│                                   │       client available += amount  │                                   │
│                                   │     Split: [ESCROW_SPLIT]         │                                   │
│                                   │       client available += amount/2│                                   │
│                                   │       expert available += amount/2│                                   │
│                                   │                                   │                                   │
│                                   │     UPDATE escrow_accounts SET    │                                   │
│                                   │       status:'RELEASED'|'REFUNDED'│                                   │
│                                   │       |'SPLIT'                    │                                   │
│                                   │     UPDATE milestones SET         │                                   │
│                                   │       state:'APPROVED'            │                                   │
│                                   │     INSERT wallet_transactions per│                                   │
│                                   │       ledger                      │                                   │
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
│     (e.g. exposed proprietary     │                                   │                                   │
│     schema in artifact_a_json)    │                                   │                                   │
│        └─────────────────────────>│                                   │                                   │
│                                   │ [7] PUT /admin/projects/{id}/     │                                   │
│                                   │       suspend-spec                │                                   │
│                                   │     Guard: active_role='ADMIN'    │                                   │
│                                   │     UPDATE projects SET           │                                   │
│                                   │       state:'SUSPENDED'           │                                   │
│                                   │     Notify CEO: "Spec suspended — │                                   │
│                                   │       please contact support"     │                                   │
│ <─────────────────────────────────┼─┘                                 │                                   │
│ [8] Spec hidden from marketplace  │                                   │                                   │
│     and matching engine           │                                   │                                   │
│                                   │                                   │                                   │
├───────────────────────────────────┼───────────────────────────────────┼───────────────────────────────────┤
│ ══════ ACCOUNT SUSPENSION ═══════ │                                   │                                   │
│                                   │                                   │                                   │
│ [9] Admin identifies fraudulent   │                                   │                                   │
│     or abusive account            │                                   │                                   │
│        └─────────────────────────>│                                   │                                   │
│                                   │ [10] PUT /admin/users/{id}/suspend│                                   │
│                                   │      Guard: active_role='ADMIN'   │                                   │
│                                   │      UPDATE users SET             │                                   │
│                                   │        is_active=false            │                                   │
│                                   │      Invalidate all active JWTs   │                                   │
│                                   │      (add to token blacklist)     │                                   │
│ <─────────────────────────────────┼─┘                                 │                                   │
│ [11] Account suspended            │                                   │ [12] User cannot log in;          │
│      Active engagements may       │                                   │      existing sessions terminated │
│      continue (grandfathered)     │                                   │                                   │
└───────────────────────────────────┴───────────────────────────────────┴───────────────────────────────────┘
```

---

## Cross-Table Ledger Operations Summary

Every financial action in the platform resolves to one of these atomic wallet transaction patterns:

| Transaction Type | Wallet Debit | Wallet Credit | Trigger | Flow |
|---|---|---|---|---|
| `TOP_UP` | — | `available_balance += amount` | SePay IPN (WALLET_TOPUP VA) | MF-11 |
| `SUBSCRIPTION` | `available_balance -= price` | — | User activates Pro | MF-13 |
| `ESCROW_LOCK` | `available_balance -= amount` | `locked_balance += amount` | SePay IPN (MILESTONE/SERVICE VA) | MF-7, MF-10 |
| `ESCROW_RELEASE` | `locked_balance -= gross` | `expert.available_balance += net` | All required criteria verified | MF-7 |
| `PLATFORM_FEE` | — | `platform.available_balance += fee` | Deducted on release | MF-7 |
| `ESCROW_REFUND` | `locked_balance -= amount` | `client.available_balance += amount` | Dispute: client wins | MF-8, MF-18 |
| `ESCROW_SPLIT` | `locked_balance -= amount` | Both `+= amount/2` | Admin 50/50 split | MF-18 |
| `WITHDRAWAL` | `expert.available_balance -= amount` | — | Expert cash-out request | MF-12 |

**Every row in `wallet_transactions` is immutable.** The `UNIQUE INDEX wallet_tx_idempotency ON (wallet_id, reference_id) WHERE reference_id IS NOT NULL` guarantees SePay IPN retries cannot double-credit.

**Platform fee is never hardcoded:** `SELECT platform_fee_pct FROM platform_settings LIMIT 1` is read at transaction time. Default 0.05 (5%). Can be changed via DB without a code deploy.

---

## Appendix: 28-Table Coverage Matrix

| # | Table | Created By | Read By | Updated By | Primary Flows |
|---|---|---|---|---|---|
| 1 | `users` | MF-1, MF-2, MF-3 | MF-1, MF-2, MF-5, MF-13, MF-15 | MF-1 (sub tier), MF-2 (bank link), MF-13 (sub tier) | All |
| 2 | `client_profiles` | MF-1 | — | — | MF-1 |
| 3 | `expert_profiles` | MF-2 | MF-5, MF-9 | MF-2 (stack tags, archetype) | MF-2, MF-5 |
| 4 | `tech_team_profiles` | MF-3 | MF-3