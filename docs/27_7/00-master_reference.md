# 0. Master Reference Sheet

> **Ground-truth operational and technical reference for AITasker.**
> This document defines all taxonomy codes, composite scoring weights, state machine transitions, role-based access controls, payment/escrow mechanics, security gates, and database schema mappings. All domain, seam, archetype, probe question, and void code configurations are **DB-driven via CMS tables** and exposed to frontends via `/config/*` endpoints.

---

### 0.1 Capability Domains (DB-Driven)

*Seed data shown. Managed via `/admin/config/domains`. Consumed by frontends via `GET /config/domains` and injected dynamically into FastAPI Jinja2 prompts.*

| Domain Code | Name | Scope & Coverage Description |
|:---:|---|---|
| **A** | LLM App Engineering | System prompt engineering, structured JSON outputs, RAG orchestration, function calling, agentic chains, chain-of-thought prompting. |
| **B** | MLOps / LLMOps | Model serving, latency & throughput SLA tuning, LLM cost optimization, prompt/drift monitoring, deployment CI/CD pipelines. |
| **C** | AI Eval & Quality | Evaluation framework design, ground truth creation, human-in-the-loop (HITL) workflows, LLM-as-a-Judge benchmarking, regression testing. |
| **D** | Vector DB & Embeddings | HNSW/IVF vector indexing, semantic chunking strategies, Matryoshka Embedding Representation (MRL) truncation, hybrid BM25/vector search tuning. |
| **E** | Data & Pipeline Engineering | Distributed event streaming (Kafka/RabbitMQ), async batch ETL, distributed locks, database migrations, high-volume ingestion pipelines. |
| **F** | ML Modeling & Fine-Tuning | Cross-encoder reranking, supervised fine-tuning (SFT), LoRA/QLoRA adaptation, imbalanced dataset handling, feature engineering. |

---

### 0.2 The Seams (DB-Driven)

*Cross-domain competence boundaries where complex AI systems fail. Managed via `/admin/config/seams`. The **`↔` (U+2194) arrow character** is enforced by DB constraints and normalization helpers.*

| Seam Code | Name | Domain Pair | Failure Mode Without Seam Mastery |
|:---:|---|:---:|---|
| **A↔C** | LLM output quality | Domain A & Domain C | Prompts are tweaked without evaluation baselines, making it impossible to measure whether changes improve accuracy or introduce hallucinations. |
| **A↔F** | Fine-tuned model integration | Domain A & Domain F | System attempts to handle edge cases with expensive LLM calls that should be routed to a lightweight, fine-tuned classifier model. |
| **A↔D** | Retrieval-generation | Domain A & Domain D | Retrieved vector context is semantically relevant but structurally misaligned with prompt expectations, leading to hallucinated synthesis. |
| **D↔E** | Embedding pipeline | Domain D & Domain E | Parallel data pipeline workers write duplicate vector embeddings concurrently, causing index corruption and memory leaks. |
| **D↔F** | Model-vector alignment | Domain D & Domain F | A fine-tuned embedding model alters vector space geometry while the vector database index remains built on base model embeddings. |
| **C↔F** | Eval-model feedback | Domain C & Domain F | Model fine-tuning is conducted prior to establishing a reliable evaluation dataset, wasting compute on unverified model iterations. |
| **E↔F** | Training data pipeline | Domain E & Domain F | ML models trained on clean static datasets fail when deployed against dirty, un-normalized real-time data pipeline streams. |
| **A↔B** | Deployment-inference | Domain A & Domain B | Complex prompts optimized in local playgrounds fail under production SLAs due to unexpected token latency and API rate limits. |
| **B↔E** | Monitoring-pipeline | Domain B & Domain E | High-volume message queues trigger direct LLM inferences without batching or caching, causing operational costs to spike. |
| **C↔E** | Ground-truth pipeline | Domain C & Domain E | Evaluation datasets become stale because ground-truth pipelines do not automatically refresh when underlying data schema changes occur. |

---

### 0.3 Archetypes, Volume Tiers & Void Codes (DB-Driven)

#### Archetype Definitions (CMS-Managed)
*Seed data shown. Managed via `/admin/config/archetypes`.*

| Archetype Code | Name | Description |
|:---:|---|---|
| **1** | RAG/Search | Chatbots, internal knowledge base Q&A, enterprise document retrieval pipelines. |
| **2** | Recommendation | Product, content, or user recommendation engines and personalized ranking. |
| **3** | Classification | Automated content moderation, sentiment analysis, transaction fraud detection. |
| **4** | Generation | Code generation, marketing/creative copy synthesis, structured report generation. |
| **5** | Prediction/Forecasting | Customer churn prediction, demand forecasting, time-series financial analysis. |
| **6** | Multimodal | Cross-modal processing combining vision, audio, text, and unstructured media. |

#### Volume Tiers (Business Logic)
- **TIER_1**: Simple data, <10,000 daily active users, standard latency requirements.
- **TIER_2**: Moderate complexity, 10,000–100,000 DAU, custom integration requirements.
- **TIER_3**: High technical complexity, >100,000 DAU, strict SLA/throughput constraints.

#### Void Codes / Knowledge Gap Taxonomy (CMS-Managed)
*Seed data shown. Managed via `/admin/config/void-codes`.*

| Void Code | Name | Severity | Description |
|---|---|:---:|---|
| **NO_GROUND_TRUTH** | No Ground Truth | **HIGH** | No labeled data, evaluation benchmark, or metric baseline mentioned. |
| **NO_BASELINE** | No Baseline System | **MEDIUM** | No existing system or manual process available for baseline comparison. |
| **UNCLEAR_SUCCESS_METRIC** | Unclear Success Metric | **HIGH** | Vague or unmeasurable success criteria (e.g., "make it better"). |
| **DATA_PRIVACY_CONSTRAINT** | Data Privacy Constraint | **HIGH** | Sensitive data involved (health, legal, financial) with unclear compliance. |
| **INTEGRATION_UNCLEAR** | Integration Unclear | **MEDIUM** | System connection points, APIs, or database integration methods unspecified. |
| **TIMELINE_UNREALISTIC** | Unrealistic Timeline | **MEDIUM** | Requested delivery schedule is aggressive relative to scope complexity. |
| **SCOPE_CREEP_RISK** | Scope Creep Risk | **MEDIUM** | Too many diffuse objectives described for a single project engagement. |
| **MISSING_TECHNICAL_ARTIFACT** | Missing Technical Artifact | **HIGH** | Mentioned critical document (schema, API spec, ruleset) not yet provided. |

---

### 0.4 Expert Verification Tiers & Hard Gates

AITasker enforces a 2-Tier verification model to differentiate self-declared skills from AI-validated cross-domain capabilities:

| Tier | Label | How Earned | Matching Engine Confidence Weight |
|:---:|---|---|:---:|
| **Tier 1** | Claimed (`CLAIMED`) | Self-declared on expert profile | **0.5** (50% weight) |
| **Tier 2** | Evidence-backed (`EVIDENCE_BACKED`) | LLM portfolio evaluation confidence score ≥ **0.85** | **1.0** (100% weight) |

#### Hard Gate Rules
1. **Claimed-to-Verified Hard Gate (MF-5)**: Among seams relevant to a project, if an expert's ratio of `CLAIMED` to `EVIDENCE_BACKED` claims exceeds **4.0 (4:1)** *and* `evidence_backed_count > 0`, the expert is **excluded outright** from shortlist consideration before scoring takes place.
2. **Anti-Spam Cooldown Lockout (BR-VER-06)**: If an expert fails 5 portfolio evidence evaluations on a seam claim (`submissionCount >= 5`), the seam claim enters a **30-day lockout** (`lockedUntil = now + 30 days`), during which new submissions for that seam are blocked.
3. **Integrity Lock on Claim Deletion**: Experts cannot remove seam claims that have submission history (`submissionCount > 0`) or have reached `EVIDENCE_BACKED` status.

---

### 0.5 Composite Match Score Weights

*Executed synchronously in FastAPI `matching_engine.py` (Pure Python arithmetic, zero LLM calls).*

$$\text{Composite Score} = 0.40(S) + 0.25(D) + 0.20(P) + 0.10(A) + 0.05(E)$$

| Component | Weight | Calculation Formula / Rule |
|---|:---:|---|
| **Seam Alignment ($S$)** | **40%** | Weighted average across required project seams: $\frac{\sum (\text{Criticality Weight} \times \text{Tier Confidence})}{\sum \text{Criticality Weight}}$.<br>Criticality: `load_bearing` (3.0), `significant` (2.0), `contributing` (1.0).<br>Tier confidence: `EVIDENCE_BACKED` = 1.0, `CLAIMED` = 0.5, Missing = 0.0. |
| **Domain Depth Coverage ($D$)** | **25%** | Average score across required domains: 1.0 if expert depth ≥ required depth; 0.5 if expert depth is exactly 1 level below required; 0.0 otherwise.<br>Depths: `SURFACE` (1), `OPERATIONAL` (2), `DEEP` (3). |
| **Portfolio Quality ($P$)** | **20%** | Expert's average portfolio evaluation score (`llm_confidence`). Defaults to **0.5** if no portfolio submissions exist. |
| **Archetype History ($A$)** | **10%** | **1.0** if `archetype_history_json` contains the project archetype code; **0.0** otherwise. (Defaults to **0.5** if project archetype is null). |
| **Engagement Model Fit ($E$)** | **5%** | **1.0** (NestJS pre-filters candidates by engagement model compatibility). |

#### Match Strength Labels (Returned by API)
- **`STRONG_MATCH`**: Composite Score ≥ **0.85**
- **`GOOD_MATCH`**: Composite Score ≥ **0.70**
- **`POSSIBLE_MATCH`**: Composite Score ≥ **0.55**
- **`WEAK_MATCH`**: Composite Score < **0.55**

---

### 0.6 All State Machine Definitions

#### 1. Elicitation Session State Machine
```
IN_PROGRESS  → active elicitation wizard session (Stages 1–5)
COMPLETED    → Stage 5 quality gate passed; project row created in projects table
ABANDONED    → explicitly abandoned by CEO or superseded by new session
RETURNED     → Stage 5 quality gate failed; session returned to an earlier stage
```

#### 2. Spec (Project) State Machine
```
DRAFT              → initialized session before publication
PUBLISHED          → Stage 5 quality gate passed; visible in marketplace & matching
RETURNED_TO_CLIENT → returned to CEO due to quality gate failure or incomplete context
SUSPENDED          → emergency pull-back executed by Platform Administrator
```

#### 3. Capability Bid State Machine
```
DRAFT               → initial proposal drafting by expert
SUBMITTED           → bid submitted by expert
TECH_REVIEW         → undergoing technical review by linked Tech Team (if non-self-technical)
REVISION_REQUESTED  → Tech Team requested revisions; expert edits bid
TECH_APPROVED       → Tech Team approved milestone scope; commercial review unlocked
CEO_REVIEW          → under review by CEO
SELECTED            → CEO accepted offer; commercial terms locked
DECLINED            → rejected by CEO, declined by expert, or superseded
WITHDRAWN           → expert explicitly withdrew bid (allowed in SUBMITTED or TECH_REVIEW)
```

#### 4. Bid Negotiation & Offer State Machine (Envelope Format v1)
```
Negotiation States:
AWAITING_TECH_REVIEW → pending Tech Team review of technical scope
AWAITING_CEO         → waiting for CEO commercial action (Accept / Counter / Decline)
AWAITING_EXPERT      → waiting for Expert commercial action (Accept / Counter / Decline)
TERMS_ACCEPTED       → offer accepted by recipient; milestone framework locked
DECLINED             → negotiation terminated without agreement

Offer States:
PENDING    → active offer awaiting counter-party decision
ACCEPTED   → accepted by recipient
DECLINED   → explicitly declined
SUPERSEDED → replaced by a newer counter-offer round
```

#### 5. Engagement State Machine
```
PENDING   → initialized on bid submission or service purchase
CONNECTED → both CEO and Expert accepted platform NDA
ACTIVE    → first milestone funded into escrow
CLOSED    → all milestones approved & released; reviews unlocked
DISPUTED  → an active dispute is open on an engagement milestone
DECLINED  → connection or bid declined
CANCELLED → engagement cancelled before funded milestones commence
```

#### 6. Milestone State Machine
```
DEFINED          → initialized in contract; criteria & DoD items set
AWAITING_PAYMENT → CEO clicked "Fund"; virtual account (VA) generated; QR displayed
FUNDED           → payment confirmed via SePay IPN [LEDGER: ESCROW_LOCK]
IN_PROGRESS      → work in progress by Expert (auto-advances from FUNDED)
SUBMITTED        → Expert submitted deliverable; all required DoD items COMPLETED
IN_REVISION      → reviewer requested criterion revision
APPROVED         → all required criteria verified; milestone complete
                   [LEDGER: ESCROW_RELEASE, PLATFORM_FEE]
RELEASED         → payout disbursed to expert wallet / auto-withdrawal triggered
DISPUTED         → dispute filed on unverified criterion; escrow FROZEN
```

#### 7. Escrow Account State Machine
```
HELD     → funds locked in escrow following milestone payment
RELEASED → funds disbursed to Expert wallet (less platform fee)
FROZEN   → dispute filed; funds locked against movement
REFUNDED → dispute resolved in client's favor; funds returned to CEO available balance
SPLIT    → dispute resolved with 50/50 split settlement
```

#### 8. Dispute State Machine
```
PENDING       → dispute record created
LAYER_1_EVAL  → AI evaluator analyzing criterion, deliverable text, and evidence
AUTO_RESOLVED → AI confidence score ≥ 0.80; escrow action executed automatically
MANUAL_REVIEW → AI confidence score < 0.80; routed to Admin Dispute Monitor
RESOLVED      → manually settled by Platform Administrator
```

#### 9. Definition of Done (DoD) Item State Machine
```
PENDING        → item outstanding
COMPLETED      → marked complete by expert (completionNote required if isRequired = true)
NOT_APPLICABLE → marked N/A by expert (notApplicableNote required; blocked if isRequired = true)
```

#### 10. Virtual Account State Machine
```
ACTIVE  → VA live and accepting bank transfers
EXPIRED → payment window elapsed without payment receipt
USED    → payment received and processed by IPN handler
```

#### 11. Withdrawal Request State Machine
```
PENDING   → request logged; available balance debited immediately
COMPLETED → manually confirmed by Admin via /admin/withdrawals/:id/complete
FAILED    → marked failed by Admin; available balance restored [LEDGER: WITHDRAWAL_REFUND]
CANCELLED → cancelled by Expert prior to admin processing; available balance restored
```

---

### 0.7 RBAC Matrix & Role Permissions

| Action / Resource | Client CEO | Client Tech Team | Expert | Administrator |
|---|:---: |:---:|:---:|:---:|
| **Start Elicitation Session** | Yes (Pro) | No | No | No |
| **Complete Stage 4 Tech Inputs** | Yes (Self-Tech) | Yes (via Handoff) | No | No |
| **View Artifact A (Business Spec)** | Yes | Yes | Yes (Matched) | Yes |
| **View Artifact B (Tech Spec)** | **No (Never)** | Yes (Connected) | Yes (Connected) | Yes |
| **Browse Open Projects** | No | No | Yes | Yes |
| **Submit Capability Bid** | No | No | Yes (Shortlisted) | No |
| **Review Bid Scope (Deliverables/Criteria)** | No | Yes | Yes (Own) | Yes |
| **Review Bid Pricing & Commercial Terms** | Yes | **No (Restricted)** | Yes (Own) | Yes |
| **Approve / Counter / Decline Bid** | Yes | No | Yes | No |
| **Sign Platform NDA** | Yes | No | Yes | No |
| **Create / Edit / Delete Milestones** | Yes (Unlocked) | No | No | No |
| **Fund Milestone into Escrow** | Yes | No | No | No |
| **Maintain DoD Checklist** | Yes | No | Yes | No |
| **Submit Milestone Deliverable** | No | No | Yes | No |
| **Verify Milestone Criteria** | Yes | Yes (Joint) | No | No |
| **Request Criterion Revision** | Yes | Yes | No | No |
| **File Dispute** | Yes | No | Yes | No |
| **Manually Resolve Dispute** | No | No | No | Yes |
| **Link Bank Account & Withdraw** | No | No | Yes | No |
| **Manage CMS Config & Prompts** | No | No | No | Yes |
| **Suspend / Reactivate User or Spec** | No | No | No | Yes |

---

### 0.8 Payment Architecture, Escrow & Ledger Operations

AITasker enforces an append-only double-entry wallet ledger. Amounts are stored as **BigInt (Vietnamese Dong)** to prevent floating-point representation drift.

```
1. TOP UP WALLET:
   User scans permanent WALLET_TOPUP VA QR code → Bank Transfer
   → SePay IPN Webhook (`/webhooks/sepay/ipn`)
   → HMAC-SHA256 Signature Verification
   → Idempotency Check (`referenceCode`)
   → `wallets.available_balance` += amount
   → Ledger Entry: `TOP_UP`

2. FUND MILESTONE ESCROW:
   CEO initiates funding → Per-milestone VA created (entity_type = 'MILESTONE')
   → CEO transfers exact fixed_amount via VietQR
   → SePay IPN Webhook
   → Atomic Transaction:
       - Client `wallets.available_balance` -= amount
       - Client `wallets.locked_balance` += amount
       - `escrow_accounts` created (status = 'HELD')
       - `milestones.state` → `IN_PROGRESS`
       - `paygated_documents.release_state` → `RELEASED`
       - Engagement state → `ACTIVE` (if first milestone)
       - Ledger Entry: `ESCROW_LOCK`

3. RELEASE MILESTONE ESCROW (Upon Approval):
   All required criteria verified & no open disputes
   → Atomic Transaction:
       - Platform Fee = round(amount × platform_fee_pct)  [platform_fee_pct ∈ [0, 1]]
       - Expert Net Amount = amount − Platform Fee
       - Client `wallets.locked_balance` -= amount
       - Platform Wallet `wallets.available_balance` += Platform Fee
       - Expert `wallets.available_balance` += Expert Net Amount
       - `escrow_accounts.status` → `RELEASED`
       - `milestones.state` → `APPROVED`
       - Ledger Entries: `ESCROW_RELEASE` (Client), `PLATFORM_FEE` (Platform), `ESCROW_RELEASE` (Expert)
       - IF Expert has linked bank account:
           * Auto-creates `withdrawal_requests` row (type = 'MILESTONE_RELEASE')
           * Expert `wallets.available_balance` -= Expert Net Amount
           * Ledger Entry: `WITHDRAWAL`

4. DISPUTE REFUND (CLIENT_WINS):
   Dispute resolved in client favor (AI or Admin)
   → Atomic Transaction (Escrow must be FROZEN):
       - Client `wallets.locked_balance` -= amount
       - Client `wallets.available_balance` += amount
       - `escrow_accounts.status` → `REFUNDED`
       - `milestones.state` → `APPROVED`
       - Ledger Entry: `ESCROW_REFUND`

5. DISPUTE SPLIT (50/50 Settlement):
   Dispute resolved with SPLIT decision
   → Atomic Transaction (Escrow must be FROZEN):
       - Client Half = floor(amount / 2)
       - Expert Half = amount − Client Half
       - Client `wallets.locked_balance` -= amount
       - Client `wallets.available_balance` += Client Half
       - Expert `wallets.available_balance` += Expert Half
       - `escrow_accounts.status` → `SPLIT`
       - `milestones.state` → `APPROVED`
       - Ledger Entries: `ESCROW_SPLIT` (Client), `ESCROW_SPLIT` (Expert)
```

---

### 0.9 Security Gates & Artifact Protection

#### Artifact B Access Guard (4-Condition Security Check)
Artifact B contains sensitive technical specifications (architecture, schema URLs, database contracts). Access is gated behind FastAPI `artifact_b_guard.py` and evaluated before returning data:

1. **Condition 1 (Engagement Lifecycle)**: `engagement_state` MUST be in `{'CONNECTED', 'ACTIVE'}`.
2. **Condition 2 (Bid Lifecycle)**: `bid_state` MUST be in `{'TECH_APPROVED', 'CEO_REVIEW', 'SELECTED'}`.
3. **Condition 3 (Expert NDA)**: `expert_nda_accepted` MUST be `True`.
4. **Condition 4 (CEO NDA)**: `ceo_nda_accepted` MUST be `True`.

*If any condition fails, NestJS returns `403 Forbidden` with the specific denial reason. CEOs are permanently blocked from accessing Artifact B regardless of NDA status.*

---

### 0.10 Subscription Tiers, Packages & Feature Gates

Packages are DB-managed via the `subscription_packages` table.

#### Seed Default Packages
- **Client Pro**: 500,000 VND / 6 months (`role = 'CLIENT'`)
- **Expert Pro**: 300,000 VND / 6 months (`role = 'EXPERT'`)

#### Feature Gate Matrix

| Feature / Resource | Free Tier | Pro Tier | Enforcement Point |
|---|:---:|:---:|---|
| **Elicitation Wizard (Stages 1–5)** | Blocked | Unlocked | `SubscriptionGuard` on `/elicitation/*` |
| **Project Shortlist & Matching** | Blocked | Unlocked | `SubscriptionGuard` on `/matching/*` |
| **Bid on Tier 1 Projects** | Unlocked | Unlocked | Standard role check |
| **Bid on Tier 2 & Tier 3 Projects** | Blocked | Unlocked | `BidsService` tier check |
| **Submit Tier 2 Portfolio Evidence** | Blocked | Unlocked | `SubscriptionGuard` on `POST /portfolio-submissions` |
| **AI Service Generator** | Blocked | Unlocked | `ListingsService` subscription check |

---

### 0.11 AI Service & Hot-Reload Prompt Management Architecture

Prompt templates are hot-reloaded without service redeployment via a dual-layer resolution hierarchy:

```
                  ┌──────────────────────────────┐
                  │ Admin Edits Prompt in CMS    │
                  │ (PUT /admin/prompts/:stage)  │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │ Saved to DB:                 │
                  │ `prompt_templates` Table     │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ FastAPI Prompt Service (`get_rendered_prompt`)                  │
│                                                                 │
│  1. Check in-memory cache (TTL: 60 seconds)                     │
│  2. Cache Miss → Call NestJS: GET /internal/prompts/:stage       │
│  3. NestJS Returns:                                             │
│     - DB Record exists  → Returns `templateText`                │
│     - 404 (No DB row)   → Falls back to on-disk `.txt` file     │
│  4. Render Jinja2 Template with DB context (domains/seams/etc.) │
└─────────────────────────────────────────────────────────────────┘
```

---

### 0.12 Full Database Schema Reference (40 Tables)

*Derived strictly from `backend/prisma/schema.prisma`.*

#### 1. Core Users & Roles
1. **`users`**: Central account table. Holds `roles` (JSON array), `active_role`, `client_subtype`, subscription tiers and expiry dates, bank linkage details, `self_technical` override flags, OTP fields, and `refresh_token_hash`.
2. **`client_profiles`**: 1:1 extension for CLIENT users. Stores `company_name`, `industry`, and `ceo_name`.
3. **`expert_profiles`**: 1:1 extension for EXPERT users. Stores `bio`, `engagement_model`, `stack_tags_json`, and `archetype_history_json`.
4. **`tech_team_profiles`**: Profile for TECH_TEAM subtype users. Stores `linked_client_id` (owning CEO) and `linked_project_id` (assigned project).

#### 2. Wallet & Financial Ledger
5. **`wallets`**: User wallet balances (`available_balance` and `locked_balance` stored as BigInt).
6. **`wallet_transactions`**: Append-only ledger recording all monetary movements (`amount`, `transaction_type`, `reference_id`).
7. **`virtual_accounts`**: SePay virtual accounts for collecting inbound transfers. Polymorphic via (`entity_type`, `entity_id`). Status: `ACTIVE`, `EXPIRED`, `USED`.
8. **`withdrawal_requests`**: Expert cash-out records (`type`, `amount`, `bank_account_xid`, `status`). Status: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`.
9. **`platform_settings`**: Singleton configuration table storing `platform_fee_pct` and `platform_wallet_id`.

#### 3. Elicitation & Project Management
10. **`elicitation_sessions`**: 5-stage discovery session state. Stores per-stage JSON payloads, detected void codes, critical artifacts, and `handoff_token_jti`.
11. **`projects`**: Published project specification derived from elicitation. Holds `artifact_a_json`, `artifact_b_json`, `required_seams_json`, `required_domains_json`, and `milestone_framework_json`.
12. **`project_shortlist_cache`**: Cached AI matching results for a project (`results_json`, `source`: 'AUTO' | 'FORCE_REFRESH').
13. **`milestone_chat_sessions`**: Multi-turn AI chat history for project milestone planning (`messages_json`).

#### 4. Expert Capability & Verification
14. **`expert_domain_depths`**: Expert proficiency declarations per domain (`domain_code`, `depth_level`, `verification_tier`).
15. **`expert_seam_claims`**: Expert claims at cross-domain boundaries (`seam_code`, `verification_tier`, `submission_count`, `locked_until`).
16. **`portfolio_submissions`**: Evidence submitted for seam claim upgrade (`project_description`, `decision_points`, `status`, `llm_confidence`).

#### 5. Marketplace & Bidding
17. **`services`**: Expert marketplace listings (`service_type`, `price_vnd`, `domains_json`, `seams_json`, `scope`, `timeline`, `state`).
18. **`engagements`**: Contract pairing client and expert (`type`, `state`, `client_nda_accepted_at`, `expert_nda_accepted_at`).
19. **`capability_bids`**: Expert proposals (`footprint_alignment_json`, `approach_summary`, `conditional_pricing_json`, `tech_status`, `ceo_status`, `version_number`).
20. **`invitations`**: Direct CEO-to-Expert project invitations (`status`, `invited_at`, `expires_at`).

#### 6. Milestones, Delivery & Disputes
21. **`milestones`**: Delivery units within an engagement (`milestone_number`, `deliverable_statement`, `payment_amount_vnd`, `sign_off_authority`, `state`, `va_number`).
22. **`acceptance_criteria`**: Verification criteria per milestone (`criterion_text`, `is_required`, `verified_by_role`, `tech_verified_at`, `ceo_verified_at`, `revision_note`).
23. **`milestone_dod_items`**: Definition of Done checklist items (`item_description`, `is_required`, `status`, `completion_note`, `not_applicable_note`).
24. **`milestone_submissions`**: Deliverable handovers from expert (`description`, `files_json`, `submitted_at`).
25. **`paygated_documents`**: Technical assets staged for post-funding release (`document_url`, `release_state`).
26. **`escrow_accounts`**: Locked funds per milestone (`amount`, `client_wallet_id`, `expert_wallet_id`, `status`).
27. **`disputes`**: Formal requirement disputes (`criterion_id`, `escrow_account_id`, `filed_by`, `state`, `llm_confidence`, `resolution`, `llm_reasoning`).

#### 7. Communication, Reviews & Notifications
28. **`messages`**: In-platform messages scoped to engagement or project (`content`, `attachment_url`, `timestamp`).
29. **`message_reads`**: Read receipt tracking per message per user (`read_at`).
30. **`reviews`**: Post-engagement peer reviews (`rating`, `comment`, `structured_signals_json`, `reviewer_role`).
31. **`notifications`**: System notifications (`type`, `title`, `body`, `link`, `is_read`).
32. **`platform_decisions`**: Audit log of all AI evaluations (`decision_type`, `entity_type`, `entity_id`, `llm_confidence`, `decision`, `advisory_note`).

#### 8. CMS & Platform Configuration (Admin-Managed)
33. **`domain_definitions`**: Registered AI domains (`code`, `name`, `description`, `is_active`, `sort_order`).
34. **`seam_definitions`**: Registered cross-domain seams (`code`, `domain_code_1`, `domain_code_2`, `name`, `description`, `is_active`).
35. **`archetype_definitions`**: Project archetypes (`code`, `name`, `description`, `is_active`, `sort_order`).
36. **`probe_questions`**: Stage 3 probe questions per archetype (`archetype_code`, `question_text`, `display_order`, `is_active`).
37. **`void_code_definitions`**: Knowledge gap patterns (`code`, `name`, `description`, `severity`, `is_active`).
38. **`prompt_templates`**: Database overrides for AI stage prompts (`stage`, `template_text`, `version`).
39. **`subscription_packages`**: Subscriptions catalogue (`role`, `name`, `price_vnd`, `duration_months`, `is_active`).
40. **`subscription_purchase_logs`**: Historical record of subscription activations (`user_id`, `package_id`, `amount_paid_vnd`, `expires_at`).