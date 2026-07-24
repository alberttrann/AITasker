# E2E QA Test Plan

## 1. Test Environments & Preconditions
- **Test Environments:** Docker setups (isolated vs full UI) and observability tools (Prisma Studio, DevTools, DB logs).
- **Universal Checks:** Baseline checks that must pass on *every* screen (e.g., JWT validation, role-guards, UI feedback, double-submission prevention).
- **Cross-actor visibility:** Other involved actors receive the right notification/socket update and see the new state after refresh.
- **Data Seeds:** Ensure you have the correct persona (e.g. CEO-A, EXP-B) seeded in the database before starting the flow.

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

