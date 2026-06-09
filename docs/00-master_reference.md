## 0. Master Reference Sheet

> **Ground-truth lookup for all taxonomy codes, seam identifiers, scoring weights, and state machine definitions.**

---

### 0.1 The 6 Capability Domains

| Code | Name | What it covers |
|---|---|---|
| **A** | LLM Application Engineering | System prompt design, structured output, RAG orchestration, chain-of-thought |
| **B** | MLOps / LLMOps Infrastructure | Model serving, cost optimization, drift monitoring, deployment pipelines |
| **C** | AI Evaluation & Quality Systems | Metric design, ground truth creation, HITL workflow, benchmarking |
| **D** | Vector DB & Embeddings | HNSW indexing, chunking strategy, MRL truncation, similarity tuning |
| **E** | Data & Pipeline Engineering | Kafka, async processing, distributed locks, legacy ETL, high-volume ingestion |
| **F** | ML Modeling & Fine-Tuning | Cross-encoders, supervised fine-tuning, imbalanced data, feature engineering |

---

### 0.2 The 10 Seams

Seams are cross-domain competence boundaries. An expert who holds both adjacent domains may still lack the seam knowledge — the skill of diagnosing and resolving failures *at* the boundary.

| Seam | Name | What failure looks like without it |
|---|---|---|
| **A↔C** | Ground truth-driven iteration | Expert fine-tunes prompts with no baseline — can't tell if changes help or hurt |
| **A↔F** | Hybrid routing | LLM handles everything including cases it should defer to a classifier — high cost, low accuracy |
| **A↔D** | Retrieval-generation contract | Retrieved chunks are semantically right but structurally wrong — LLM produces hallucinated synthesis |
| **D↔E** | Distributed vector upsert safety | Two pipeline workers write the same embedding simultaneously — vector index corruption |
| **D↔F** | Embedding/index co-design | Fine-tuned model changes embedding space but index was built with base model — retrieval degrades silently |
| **C↔F** | Fine-tuning gating | Team fine-tunes before establishing evaluation baseline — no way to know if fine-tuning helped |
| **E↔F** | Training data as pipeline problem | ML model trained on clean data, deployed against dirty pipeline output — production accuracy collapse |
| **A↔B** | Prompt iteration under production constraints | Prompts optimized in playground, never tested under real latency/cost constraints — works in dev, fails in prod |
| **B↔E** | Cost management in streaming pipelines | Every Kafka message triggers an LLM call — cost explodes under load |
| **C↔E** | Evaluation data as pipeline concern | Ground truth dataset exists but isn't refreshed when pipeline schema changes — evaluation becomes stale |

---

### 0.3 The 6 Archetypes + 3 Tiers

**Archetypes** — what kind of AI project this is:

| # | Archetype | Core question | Primary domains | Load-bearing seam |
|---|---|---|---|---|
| **1** | Automated Decision System | *"Can AI replace a human decision my team makes repeatedly?"* | C, E, A | **A↔C** |
| **2** | RAG / Knowledge Retrieval | *"Can AI answer questions from our documents?"* | A, D, B | **A↔D** |
| **3** | Predictive / Forecasting | *"Can AI predict an outcome from our historical data?"* | F, C, E | **E↔F** |
| **4** | Data Pipeline + AI Integration | *"Can we connect AI into our high-volume data infrastructure?"* | E, B, D | **D↔E** |
| **5** | Model Fine-Tuning & Customization | *"Can we make a base model specialize on our domain?"* | F, A, C | **A↔F** |
| **6** | Evaluation Infrastructure Build | *"How do we know if our AI is actually working?"* | C, E, F | **A↔C** |

**Tiers** — how complex the project is:

| Tier | Label | Infrastructure signals |
|---|---|---|
| **1** | Simple / Greenfield | HTTP REST only, <100K records, no legacy |
| **2** | Moderate | One integration point, 100K–1M records, some legacy |
| **3** | Complex / Production | Kafka/async, >1M records, legacy migration, multi-system |

---

### 0.4 Expert Verification Tiers (MVP: 2-Tier System)

> **Scope reduction:** Tiers 3 (Scenario-verified) and 4 (Platform-demonstrated) are deferred to Phase 2. The MVP implements Tier 1 and Tier 2 only. The matching engine uses the two-tier confidence weights below.

| Tier | Label | How earned | Confidence factor |
|---|---|---|---|
| **1** | Claimed | Self-declared on profile | 0.20 |
| **2** | Evidence-backed | LLM extraction confidence ≥ 0.85 on portfolio submission; all required signal types found | 0.55 |

**What is deferred:**
- Tier 3 (Scenario-verified, 0.80): requires `scenario_assessments` + `scenario_responses` tables — Phase 2
- Tier 4 (Platform-demonstrated, 0.95): requires `expert_seam_outcome_signals` + signal accumulation rule — Phase 2

The composite matching formula works with two weights. Experts max out at Tier 2 in the MVP.

---

### 0.5 Composite Match Score Weights

| Component | Weight | Formula element |
|---|---|---|
| Seam alignment | **40%** | Per seam: criticality weight × expert's verification confidence (0.20 or 0.55). Missing load-bearing seam = negative contribution |
| Domain depth coverage | **25%** | Expert verified depth ≥ footprint required depth for each domain |
| Archetype-tier congruence | **20%** | Expert's self-declared or confirmed history with same archetype + tier |
| Engagement model fit | **10%** | Expert's declared model vs. footprint requirement |
| Stack tags & recency | **5%** | Stack tag overlap (stored as JSONB array on `expert_profiles`) |

**Match strength labels** (client sees label, not numeric score):
- **Strong** → composite score > 0.78
- **Qualified** → 0.58–0.78
- **Conditional** → 0.42–0.58

---

### 0.6 All State Machines

> Every state name in this document resolves to one of the machines below. State transitions that trigger ledger entries are marked **[LEDGER]**. Transitions that call external APIs are marked **[API]**.

---

**Milestone states:**
```
DEFINED           → milestone created; acceptance criteria + DoD items set
AWAITING_PAYMENT  → CEO clicked "Fund"; per-milestone VA generated; VietQR displayed
FUNDED            → SePay IPN confirmed [LEDGER: escrow lock]
IN_PROGRESS       → auto-advances from FUNDED; Expert begins work
SUBMITTED         → Expert submits deliverable; all required DoD items checked
IN_REVISION       → revision requested by reviewer; expert revises
APPROVED          → sign-off authority verifies all required acceptance criteria
                    [LEDGER: escrow release] [API: SePay chi hộ fires]
RELEASED          → chi hộ credit IPN confirmed; ledger settled
DISPUTED          → dispute filed; escrow frozen
  → AUTO_RESOLVED (LLM confidence ≥ 0.80)  [LEDGER: winner receives escrow]
  → MANUAL_REVIEW (LLM confidence < 0.80)  [admin resolves via dashboard button]
```

**Bid states (simplified mutable-row model):**
```
DRAFT
  → SUBMITTED (expert submits 3-component bid)
  → TECH_REVIEW (TECH_TEAM opens review)
     TECH_TEAM sets tech_status:
       REVISION_REQUESTED → expert edits bid row and resets tech_status → PENDING → TECH_REVIEW
       APPROVED → tech_status = APPROVED
  → CEO_REVIEW (unlocked only when tech_status = APPROVED)
     CEO may write negotiated_price_vnd (one counter-offer round)
  → SELECTED / DECLINED

Note: Bid revisions are mutable updates to the single row, not versioned snapshots.
      tech_feedback written by TECH_TEAM; expert reads and edits in place.
      No separate bid_versions, bid_revision_requests, price_negotiations tables in MVP.
```

**Spec states:**
```
DRAFT → [auto-publish quality gate] → PUBLISHED
                      ↓ (fail)
            RETURNED_TO_CLIENT (auto — LLM advisory note; re-enters elicitation at specific void)
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

**Engagement type (immutable):**
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

**Wallet transaction types:**
```
TOP_UP          — SePay IPN (wallet VA) → available_balance += amount [LEDGER]
SUBSCRIPTION    — user activates Pro → available_balance -= price [LEDGER]
ESCROW_LOCK     — CEO funds milestone → available_balance -= amount; locked_balance += amount [LEDGER]
ESCROW_RELEASE  — milestone APPROVED → locked_balance -= amount; expert available_balance += net [LEDGER]
PLATFORM_FEE    — 5% deducted from expert on release [LEDGER]
ESCROW_REFUND   — dispute refund to client [LEDGER]
ESCROW_SPLIT    — admin-resolved split [LEDGER]
WITHDRAWAL      — expert cash-out → available_balance -= amount [LEDGER] [API: chi hộ fires]
```

**Withdrawal states:**
```
PENDING   → withdrawal_request created; wallet debited atomically; chi hộ API called [API]
COMPLETED → SePay credit IPN fires on expert's linked bank account
FAILED    → chi hộ error; wallet balance restored [LEDGER]; expert notified
```

**Subscription states:**
```
free    → pro (payment via wallet; IPN confirms; subscription_expires_at = now + 6 months)
pro     → EXPIRING_SOON (7 days before expiry)
        → free (grace: active engagements grandfathered)
free    → pro (renewal)
```

**Dispute resolution (simplified 2-layer):**
```
Dispute filed → escrow FROZEN
  → Layer 1: LLM criterion evaluation
      confidence ≥ 0.80 → AUTO_RESOLVED [LEDGER: escrow distributed per finding]
      confidence < 0.80 → MANUAL_REVIEW

  → MANUAL_REVIEW: Admin reviews in Dispute Monitor → clicks Resolve button
      → Admin chooses: Release to expert / Refund to client / 50-50 split
      → [LEDGER: per admin decision]
```

> **Scope reduction note:** The full 3-layer system (48h cooling window, automated mutual agreement form, automatic 50/50 Layer 3 split) is deferred. MVP Layer 2 is admin-resolved via a single dashboard button. This is honest about what can be built reliably in 9 weeks.

---

### 0.7 RBAC Roles

| JWT `active_role` | `client_subtype` | Human label | How created |
|---|---|---|---|
| `CLIENT` | `CEO` | Client — Business | Self-register |
| `CLIENT` | `TECH_TEAM` | Client — Technical | Via signed handoff link only |
| `EXPERT` | *(none)* | Expert | Self-register |
| `ADMIN` | *(none)* | Admin | DB-seeded only |

**Dual-role accounts:** `roles: ["CLIENT_CEO", "EXPERT"]` on one account. `active_role` determines context. Role switch reissues JWT without re-login. Self-exclusion always applies regardless of active role.

**Self-technical CEO:** `project.self_technical = true` → CEO account gains TECH_TEAM capabilities for that project only.

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
| Flag bid tech_status (APPROVED / REVISION_REQUESTED) | No | Yes | No | No |
| Approve expert selection (ceo_status → APPROVED) | Yes | No | No | No |
| Fund milestone (wallet or VietQR) | Yes | No | No | No |
| Create DoD checklist | No | No | Yes | No |
| Sign off technical milestones | No | Yes | No | No |
| Sign off business milestones | Yes | No | No | No |
| Submit milestone deliverable | No | No | Yes | No |
| Link bank account (Bank Hub) | No | No | Yes | No |
| Request withdrawal (chi hộ) | No | No | Yes | No |
| Browse Path B marketplace | Yes | Yes | No | No |
| Buy SERVICE_PURCHASE / TECH_DISCOVERY | Yes | No | No | No |
| Publish service listing | No | No | Yes | No |
| File a dispute | Yes | Yes | Yes | No |
| Post-engagement review | Yes | Yes | Yes | No |
| Real-time messaging | Yes | Yes | Yes | No (read-only) |
| Emergency spec pull-back / account suspension | No | No | No | Yes |
| Resolve dispute (manual) | No | No | No | Yes |

---

### 0.8 Payment Architecture

> **Zero manual choke points.** Every financial event is either a pure DB ledger entry or a SePay API call with webhook confirmation. Admin never touches money.

```
INBOUND — wallet top-up:
  User scans WALLET_TOPUP VA QR → bank transfer → SePay IPN → NestJS credits wallet

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
  → milestone → APPROVED → chi hộ call fires [API]

OUTBOUND — Expert withdrawal:
  Expert requests withdrawal → NestJS [WITHDRAWAL] available_balance -= amount
  → SePay chi hộ API POST { amount, bank_account_xid }
  → SePay transfers to expert's verified linked account
  → SePay credit IPN → withdrawal → COMPLETED

INTERNAL — Subscription:
  Wallet balance checked → [SUBSCRIPTION] available_balance -= price
  → users.subscription_{role}_tier = 'pro'; expires_at = now + 6 months
```

**SePay integration points:**
1. **VietQR + per-VA IPN** — inbound payments (wallet top-up, milestone, subscription, service)
2. **Bank Hub Hosted Link** — expert links bank account via OTP (no password sharing); webhook stores `bank_account_xid`
3. **Chi hộ API** — automated outbound disbursement to expert's linked bank account

**Platform fee:** Stored in `platform_settings.platform_fee_pct` (default 0.05). PLATFORM_FEE ledger entry credits the seeded system wallet referenced by `platform_settings.platform_wallet_id`.

---

### 0.9 Subscription Tiers & Feature Gates

| Feature | Client Free | Client Pro (500K VND / 6 mo) | Expert Free | Expert Pro (300K VND / 6 mo) |
|---|---|---|---|---|
| Browse Path B marketplace | Yes | Yes | No | No |
| Buy SERVICE_PURCHASE / TECH_DISCOVERY | Yes | Yes | No | No |
| AI Elicitation Engine (F2) | No | Yes | No | No |
| Matching engine / shortlist (F4) | No | Yes | No | No |
| Artifact B access post-connection | No | Yes | No | No |
| Create expert profile + Tier 1 seam claims | No | No | Yes | Yes |
| LLM portfolio evidence verification (Tier 2) | No | No | No | Yes |
| Bid on Tier 2–3 projects | No | No | No | Yes |
| AI Service Generator | No | No | No | Yes |
| Earnings analytics dashboard | No | No | No | Yes |

**Subscription state is stored directly on `users`** — `subscription_client_tier`, `subscription_expert_tier`, `sub_client_expires_at`, `sub_expert_expires_at`. No separate `user_subscriptions` table in MVP.