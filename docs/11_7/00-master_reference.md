## 0. Master Reference Sheet

> **Ground-truth lookup for all taxonomy codes, state machine definitions, scoring weights, and payment architecture.**
> All taxonomy (Domains, Seams, Archetypes, Void Codes) is **DB-driven** via the CMS tables. The values below are the initial seed data, but the system dynamically adapts to admin changes. FE must fetch these via `/config/*` endpoints.

---

### 0.1 Capability Domains (DB-Driven)

*Seed data shown. Managed via `/admin/config/domains`. Fetched by FE via `GET /config/domains`.*

| Code | Name | What it covers |
|---|---|---|
| **A** | LLM App Engineering | System prompt design, structured output, RAG orchestration, chain-of-thought |
| **B** | MLOps / LLMOps | Model serving, cost optimization, drift monitoring, deployment pipelines |
| **C** | AI Eval & Quality | Metric design, ground truth creation, HITL workflow, benchmarking |
| **D** | Vector DB & Embeddings | HNSW indexing, chunking strategy, MRL truncation, similarity tuning |
| **E** | Data & Pipeline Engineering | Kafka, async processing, distributed locks, legacy ETL, high-volume ingestion |
| **F** | ML Modeling & Fine-Tuning | Cross-encoders, supervised fine-tuning, imbalanced data, feature engineering |

---

### 0.2 The Seams (DB-Driven)

*Cross-domain competence boundaries. Managed via `/admin/config/seams`. Note the **`↔` (U+2194) arrow character** is strictly enforced by the DB schema.*

| Seam Code | Name | What failure looks like without it |
|---|---|---|
| **A↔C** | LLM output quality | Expert fine-tunes prompts with no baseline — can't tell if changes help or hurt |
| **A↔F** | Fine-tuned model integration | LLM handles everything including cases it should defer to a classifier |
| **A↔D** | Retrieval-generation | Retrieved chunks are semantically right but structurally wrong — hallucinated synthesis |
| **D↔E** | Embedding pipeline | Two pipeline workers write the same embedding simultaneously — index corruption |
| **D↔F** | Model-vector alignment | Fine-tuned model changes embedding space but index was built with base model |
| **C↔F** | Eval-model feedback | Team fine-tunes before establishing evaluation baseline |
| **E↔F** | Training data | ML model trained on clean data, deployed against dirty pipeline output |
| **A↔B** | Deployment-inference | Prompts optimized in playground, never tested under real latency/cost constraints |
| **B↔E** | Monitoring-pipeline | Every Kafka message triggers an LLM call — cost explodes under load |
| **C↔E** | Ground-truth pipeline | Ground truth dataset isn't refreshed when pipeline schema changes |

---

### 0.3 Archetypes & Tiers (DB-Driven)

*Managed via `/admin/config/archetypes` and `/admin/config/probe-questions`.*

**Archetypes** (Seed data):
1. RAG/Search
2. Recommendation
3. Classification
4. Generation
5. Prediction/Forecasting
6. Multimodal

**Volume Tiers** (Hardcoded business logic):
- **TIER_1**: Simple data, <10k users, low transaction rate
- **TIER_2**: Moderate complexity, 10k-100k users
- **TIER_3**: High complexity, >100k users, strict SLA

---

### 0.4 Expert Verification Tiers (MVP: 2-Tier System)

> Tiers 3 & 4 are deferred to Phase 2. The matching engine uses the two-tier confidence weights below.

| Tier | Label | How earned | Confidence factor in Matching |
|---|---|---|---|
| **1** | Claimed (`CLAIMED`) | Self-declared on profile | 0.5 (50% weight) |
| **2** | Evidence-backed (`EVIDENCE_BACKED`) | LLM extraction confidence ≥ 0.85 on portfolio submission | 1.0 (100% weight) |

*Missing a required seam results in 0.0 weight for that seam.*

---

### 0.5 Composite Match Score Weights

*Pure Python arithmetic executed in FastAPI `matching_engine.py`. No LLM involved.*

| Component | Weight | Formula Element |
|---|---|---|
| Seam alignment | **40%** | Per seam: `criticality_weight × verification_confidence`. Criticality: `load_bearing` (3.0), `significant` (2.0), `contributing` (1.0) |
| Domain depth coverage | **25%** | Expert verified depth ≥ footprint required depth. `SURFACE` (1), `OPERATIONAL` (2), `DEEP` (3) |
| Portfolio quality | **20%** | Average `llm_confidence` of expert's evidence-backed portfolio submissions. Defaults to 0.5 if none exist. |
| Archetype history | **10%** | 1.0 if expert's `archetype_history_json` contains the project archetype, 0.0 otherwise. |
| Engagement model fit | **5%** | Always 1.0 (NestJS pre-filters experts by engagement model before sending to FastAPI) |

**Match strength labels** (returned by API):
- **STRONG_MATCH** → composite score ≥ 0.85
- **GOOD_MATCH** → composite score ≥ 0.70
- **POSSIBLE_MATCH** → composite score ≥ 0.55
- **WEAK_MATCH** → composite score < 0.55

---

### 0.6 All State Machines

> Every state name resolves to the machines below. State transitions that trigger ledger entries are marked **[LEDGER]**.

**Milestone states:**
```
DEFINED           → milestone created; acceptance criteria + DoD items set
AWAITING_PAYMENT  → CEO clicked "Fund"; per-milestone VA generated; VietQR displayed
FUNDED            → SePay IPN confirmed [LEDGER: ESCROW_LOCK]
IN_PROGRESS       → auto-advances from FUNDED; Expert begins work
SUBMITTED         → Expert submits deliverable; all required DoD items checked
IN_REVISION       → revision requested by reviewer; expert revises
APPROVED          → sign-off authority verifies all required acceptance criteria
                    [LEDGER: ESCROW_RELEASE, PLATFORM_FEE]
RELEASED          → ledger fully settled
DISPUTED          → dispute filed; escrow FROZEN
```

**Bid states:**
```
DRAFT
  → SUBMITTED (expert submits 3-component bid)
  → TECH_REVIEW (TECH_TEAM opens review)
     TECH_TEAM sets tech_status:
       REVISION_REQUESTED → expert edits bid row and resets tech_status → PENDING → TECH_REVIEW
       APPROVED → tech_status = APPROVED
  → CEO_REVIEW (unlocked only when tech_status = APPROVED)
     CEO may write negotiated_price_vnd (one counter-offer round)
  → SELECTED / DECLINED / WITHDRAWN
```

**Spec (Project) states:**
```
DRAFT → [auto-publish quality gate] → PUBLISHED
                      ↓ (fail)
            RETURNED_TO_CLIENT (auto — LLM advisory note; re-enters elicitation)
PUBLISHED → SUSPENDED (admin emergency pull-back only)
```

**Engagement states:**
```
PENDING → CONNECTED (expert accepted; NDA click-through by both parties)
  → ACTIVE (first milestone funded)
  → CLOSED
       ↕
   DISPUTED
```

**Engagement types (immutable):**
```
PROJECT_BASED    — full elicitation + matching + mutable bid + multi-milestone escrow
SERVICE_PURCHASE — no elicitation; no bid; single fixed-price milestone; direct VA payment
TECH_DISCOVERY   — no elicitation; availability-based; single milestone; direct VA payment
```

**DoD checklist item states:**
```
PENDING → COMPLETED (note required for required items)
        → NOT_APPLICABLE (note required; only for non-required items)
DB CHECK: NOT (is_required = true AND status = 'NOT_APPLICABLE')
Required items: all must reach COMPLETED before milestone SUBMITTED is permitted.
```

**Wallet transaction types (Immutable Ledger):**
```
TOP_UP            — SePay IPN (wallet VA) → available_balance += amount
SUBSCRIPTION      — user activates Pro → available_balance -= price
ESCROW_LOCK       — CEO funds milestone → available_balance -= amount; locked_balance += amount
ESCROW_RELEASE    — milestone APPROVED → locked_balance -= amount; expert available_balance += net
PLATFORM_FEE      — 5% deducted from expert on release (credits platform wallet)
ESCROW_REFUND     — dispute refund to client
ESCROW_SPLIT      — admin-resolved split
WITHDRAWAL        — expert cash-out request → available_balance -= amount
WITHDRAWAL_REFUND — admin fails withdrawal OR expert cancels → available_balance += amount
```

**Withdrawal states:**
```
PENDING   → withdrawal_request created; wallet debited atomically.
COMPLETED → Admin manually confirms via `/admin/withdrawals/{id}/complete` (No real SePay Chi Hộ callback exists)
FAILED    → Admin marks as failed via `/admin/withdrawals/{id}/fail`; wallet balance restored [LEDGER: WITHDRAWAL_REFUND]
CANCELLED → Expert cancels via `DELETE /withdrawals/{id}` before admin processes; wallet refunded [LEDGER: WITHDRAWAL_REFUND]
```

**Subscription states:**
```
free    → pro (requires `packageId` from `subscription_packages` table; wallet debited)
pro     → EXPIRING_SOON (handled by FE via `isExpired` flag)
        → free (auto-reverts in `GET /subscriptions/status` logic if expired; DB tier remains 'pro' but API returns 'free')
```

**Dispute resolution (simplified 2-layer):**
```
Dispute filed → escrow FROZEN → LAYER_1_EVAL
  → Layer 1: FastAPI `/llm/dispute-eval`
      confidence ≥ 0.80 → AUTO_RESOLVED [LEDGER: escrow distributed per finding]
      confidence < 0.80 → MANUAL_REVIEW

  → MANUAL_REVIEW: Admin reviews in Dispute Monitor → clicks Resolve button
      → Admin chooses: Release to expert / Refund to client / 50-50 split
      → [LEDGER: per admin decision]
```

---

### 0.7 RBAC Roles

| JWT `activeRole` | `clientSubtype` | Human label | How created |
|---|---|---|---|
| `CLIENT` | `CEO` | Client — Business | Self-register |
| `CLIENT` | `TECH_TEAM` | Client — Technical | Via signed handoff link only |
| `EXPERT` | *(none)* | Expert | Self-register |
| `ADMIN` | *(none)* | Admin | DB-seeded only |

**Permission matrix:**

| Action | CEO | TECH_TEAM | EXPERT | ADMIN |
|---|---|---|---|---|
| Register account | Yes | No (link only) | Yes | No (seeded) |
| Submit project via elicitation (Pro) | Yes | No | No | No |
| Complete tech handoff (Stage 4) | No (unless self_technical) | Yes | No | No |
| Top up wallet | Yes | No | Yes | No |
| Purchase subscription | Yes (Client Pro) | No | Yes (Expert Pro) | No |
| View Artifact A | Yes | Yes | Yes (matched) | Yes |
| View Artifact B (artifact_b_json) | No (never) | Yes (state ≥ CONNECTED) | Yes (state ≥ CONNECTED) | Yes |
| Review bids — seam analysis | No | Yes | No | No |
| Flag bid tech_status | No | Yes | No | No |
| Approve expert selection | Yes | No | No | No |
| Fund milestone (wallet or VietQR) | Yes | No | No | No |
| Create DoD checklist | No | No | Yes | No |
| Sign off technical milestones | No | Yes | No | No |
| Sign off business milestones | Yes | No | No | No |
| Submit milestone deliverable | No | No | Yes | No |
| Initiate bank link (Bank Hub) | No | No | Yes | No |
| Request withdrawal | No | No | Yes | No |
| Browse Path B marketplace | Yes | Yes | No | No |
| Buy SERVICE_PURCHASE / TECH_DISCOVERY | Yes | No | No | No |
| Publish service listing | No | No | Yes | No |
| File a dispute | Yes | Yes | Yes | No |
| Post-engagement review | Yes | Yes | Yes | No |
| Real-time messaging | Yes | Yes | Yes | No (read-only) |
| Emergency spec pull-back / account suspension | No | No | No | Yes |
| Resolve dispute (manual) | No | No | No | Yes |
| Manually complete/fail expert withdrawals | No | No | No | Yes |

---

### 0.8 Payment Architecture

> **Zero manual choke points for inbound funds.** Every financial event is either a pure DB ledger entry or a SePay IPN. Admin never touches money directly, except for manually marking outbound withdrawals as complete (simulating the missing Chi Hộ callback).

```
INBOUND — wallet top-up:
  User scans WALLET_TOPUP VA QR → bank transfer → SePay IPN (`/webhooks/sepay/ipn`) → NestJS credits wallet

INBOUND — CEO funds milestone:
  CEO scans per-milestone VA QR (fixed_amount enforced by bank)
  → SePay IPN → NestJS atomic ledger [ESCROW_LOCK]
  → escrow_accounts HELD; milestone → FUNDED → IN_PROGRESS
  → paygated_documents for this milestone → release_state = RELEASED

INTERNAL — Milestone released:
  NestJS atomic ledger:
    [ESCROW_RELEASE]: client locked_balance -= amount
    [PLATFORM_FEE]:   platform wallet += amount * platform_fee_pct
    [CREDIT_EXPERT]:  expert available_balance += amount * (1 - platform_fee_pct)
  → milestone → APPROVED

OUTBOUND — Expert withdrawal:
  Expert requests withdrawal (`POST /withdrawals`) → NestJS [WITHDRAWAL] available_balance -= amount
  → `withdrawal_requests` row created in PENDING state.
  → **NO SEPAY CHI HỘ API IS CALLED.**
  → Admin manually verifies bank transfer and calls `/admin/withdrawals/{id}/complete`
  → If failed, Admin calls `/admin/withdrawals/{id}/fail` → NestJS restores wallet [WITHDRAWAL_REFUND]

INTERNAL — Subscription:
  Wallet balance checked → [SUBSCRIPTION] available_balance -= price
  → users.subscription_{role}_tier = 'pro'; expires_at = now + durationMonths
```

**SePay integration points:**
1. **VietQR + per-VA IPN** — inbound payments (wallet top-up, milestone, subscription, service). Routed via `/webhooks/sepay/ipn`.
2. **Bank Hub Hosted Link** — expert links bank account (`POST /bank-hub/initiate-link`). *Note: This does not make a real SePay API call in the current MVP; it stores the `sepay_bank_account_xid` placeholder for admin reference.*
3. **Chi Hộ API** — *Deprecated/Removed from live execution.* Admins manually complete withdrawals via the dashboard.

**Platform fee:** Stored in `platform_settings.platform_fee_pct` (default 0.05). PLATFORM_FEE ledger entry credits the seeded system wallet referenced by `platform_settings.platform_wallet_id`.

---

### 0.9 Subscription Tiers & Feature Gates

*Prices and duration are DB-driven via `subscription_packages` table. The values below are seed defaults.*

| Feature | Client Free | Client Pro (Default: 500K VND / 6 mo) | Expert Free | Expert Pro (Default: 300K VND / 6 mo) |
|---|---|---|---|---|
| Browse Path B marketplace | Yes | Yes | No | No |
| Buy SERVICE_PURCHASE / TECH_DISCOVERY | Yes | Yes | No | No |
| AI Elicitation Engine | No | Yes | No | No |
| Matching engine / shortlist | No | Yes | No | No |
| Artifact B access post-connection | No | Yes | No | No |
| Create expert profile + Tier 1 seam claims | No | No | Yes | Yes |
| LLM portfolio evidence verification (Tier 2) | No | No | No | Yes |
| Bid on Tier 2–3 projects | No | No | No | Yes |
| AI Service Generator | No | No | No | Yes |

**Subscription state is stored directly on `users`** — `subscription_client_tier`, `subscription_expert_tier`, `sub_client_expires_at`, `sub_expert_expires_at`. Purchase history is logged in `subscription_purchase_logs`.

---

### 0.10 Full Database Schema (40 Tables)

*Grounded strictly in `schema.prisma`.*

**Identity & Roles**
1. `users` — All accounts. Holds `roles[]`, `activeRole`, `clientSubtype`, wallet balances, sub tiers.
2. `client_profiles` — CEO company info (1:1 with users).
3. `expert_profiles` — Expert bio + stack tags (1:1 with users).
4. `tech_team_profiles` — Tech team linked to CEO + project (1:1 with users).

**Finance & Wallet**
5. `wallets` — User balances (available + locked BigInts).
6. `wallet_transactions` — Immutable ledger of all financial events.
7. `virtual_accounts` — SePay VA for topup/milestone/service.
8. `withdrawal_requests` — Expert cash-out requests (PENDING/COMPLETED/FAILED/CANCELLED).
9. `platform_settings` — Singleton holding platform fee % and platform wallet ID.

**Elicitation & Projects**
10. `elicitation_sessions` — 5-stage flow state. Holds Stage 1-4 JSON, voids, artifacts, budget.
11. `projects` — Published project spec. Holds required seams/domains, milestone framework, Artifact A/B.
12. `project_shortlist_cache` — Cached matching results per project.

**Expert Capability**
13. `expert_domain_depths` — Expert's depth per domain code.
14. `expert_seam_claims` — Expert's claim per seam code (CLAIMED/EVIDENCE_BACKED).
15. `portfolio_submissions` — Evidence submitted for a seam claim. Holds LLM confidence.

**Marketplace & Engagements**
16. `services` — Expert marketplace listings (AI_SERVICE / TECH_DISCOVERY).
17. `engagements` — Client-expert pairing. Has type and state (PENDING -> CONNECTED -> ACTIVE -> CLOSED).
18. `capability_bids` — Expert's bid on a project. Has tech/ceo statuses and negotiated price.
19. `milestones` — Milestone in engagement. Tracks state, payments, VA, escrow.
20. `acceptance_criteria` — Measurable criteria per milestone.
21. `milestone_dod_items` — Definition-of-Done checklist items.
22. `milestone_submissions` — Expert's delivery for a milestone.
23. `paygated_documents` — Documents released only on milestone approval.
24. `escrow_accounts` — Held funds. `UNIQUE` on `milestoneId` or `engagementId`.
25. `disputes` — Dispute with `llmConfidence`, `state`, `finding`.

**Communication & Reviews**
26. `messages` — Chat messages. Has `engagementId` OR `projectId`.
27. `message_reads` — Read receipts.
28. `reviews` — Post-engagement reviews.
29. `platform_decisions` — Audit log of all AI decisions (confidence, advisory notes).
30. `milestone_chat_sessions` — Multi-turn AI chat history about milestone framework.
31. `invitations` — CEO -> Expert project invitations.
32. `notifications` — Persisted real-time notifications (bid_update, system, milestone_update).

**CMS / Configuration (Admin-Managed)**
33. `domain_definitions` — Domain codes + names.
34. `seam_definitions` — Seam codes + names.
35. `archetype_definitions` — Project archetypes.
36. `probe_questions` — Stage 3 behavioral questions per archetype.
37. `void_code_definitions` — Risk taxonomy (NO_GROUND_TRUTH, etc.).
38. `prompt_templates` — Jinja2 templates for AI service (hot-reloaded with 60s TTL).
39. `subscription_packages` — Pro tier packages and pricing.
40. `subscription_purchase_logs` — History of successful subscription activations.
