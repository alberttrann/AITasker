# E2E QA Test Plan

## 1. Test Environments & Preconditions
- **Test Environments:** Docker setups (isolated vs full UI) and observability tools (Prisma Studio, DevTools, DB logs).
- **Universal Checks:** Baseline checks that must pass on *every* screen (e.g., JWT validation, role-guards, UI feedback, double-submission prevention).
- **Cross-actor visibility:** Other involved actors receive the right notification/socket update and see the new state after refresh.
- **Data Seeds:** Ensure you have the correct persona (e.g. CEO-A, EXP-B) seeded in the database before starting the flow.

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