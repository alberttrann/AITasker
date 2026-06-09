## Physical ER Plan — AITasker MVP (PostgreSQL · 28 Tables)

### Global Conventions

- **All PKs:** `UUID NOT NULL DEFAULT gen_random_uuid()`
- **All timestamps:** `TIMESTAMPTZ` (UTC)
- **All money:** `BIGINT` (VND integer — no decimals)
- **All JSON:** `JSONB`
- **Enums:** `TEXT` with `CHECK` constraints
- **Extension:** `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`

---

### Section 1 — Users & Role Profiles

**Table: `users`**

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `email` | TEXT | NOT NULL UNIQUE |
| `password_hash` | TEXT | NOT NULL |
| `full_name` | TEXT | NOT NULL |
| `phone` | TEXT | NULL |
| `roles` | JSONB | NOT NULL DEFAULT '[]' |
| `active_role` | TEXT | NOT NULL CHECK (active_role IN ('CLIENT','EXPERT','ADMIN')) |
| `client_subtype` | TEXT | NULL CHECK (client_subtype IN ('CEO','TECH_TEAM')) |
| `subscription_client_tier` | TEXT | NOT NULL DEFAULT 'free' CHECK (subscription_client_tier IN ('free','pro')) |
| `subscription_expert_tier` | TEXT | NOT NULL DEFAULT 'free' CHECK (subscription_expert_tier IN ('free','pro')) |
| `sub_client_expires_at` | TIMESTAMPTZ | NULL |
| `sub_expert_expires_at` | TIMESTAMPTZ | NULL |
| `sepay_bank_account_xid` | TEXT | NULL |
| `bank_account_holder_name` | TEXT | NULL |
| `bank_linked_at` | TIMESTAMPTZ | NULL |
| `self_technical` | BOOLEAN | NOT NULL DEFAULT FALSE |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:** `email` (unique), `active_role`, `client_subtype`

---

**Table: `client_profiles`**

| Column | Type | Constraints |
|---|---|---|
| `user_id` | UUID | PK NOT NULL REFERENCES users(id) ON DELETE CASCADE |
| `company_name` | TEXT | NULL |
| `industry` | TEXT | NULL |
| `ceo_name` | TEXT | NULL |

---

**Table: `expert_profiles`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `user_id` | UUID | PK NOT NULL REFERENCES users(id) ON DELETE CASCADE | |
| `bio` | TEXT | NULL | |
| `engagement_model` | TEXT | NULL CHECK (engagement_model IN ('MILESTONE','HOURLY','HYBRID')) | |
| `stack_tags_json` | JSONB | NOT NULL DEFAULT '[]' | Absorbs cut `expert_stack_tags` table. Format: `["Python","Kafka","Go"]` |
| `archetype_history_json` | JSONB | NULL | Self-declared history for cold-start matching. Format: `[{archetype_code, tier, self_declared: true}]` |

---

**Table: `tech_team_profiles`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `user_id` | UUID | PK NOT NULL REFERENCES users(id) ON DELETE CASCADE | |
| `linked_client_id` | UUID | NOT NULL REFERENCES users(id) | CEO who issued the handoff link |
| `linked_project_id` | UUID | NOT NULL REFERENCES projects(id) | Scope guard: account locked to one project |
| `role_title` | TEXT | NULL | |

**Index:** `linked_project_id`

---

### Section 2 — Wallet & Finance

**Table: `wallets`**

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `user_id` | UUID | NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE |
| `available_balance` | BIGINT | NOT NULL DEFAULT 0 CHECK (available_balance >= 0) |
| `locked_balance` | BIGINT | NOT NULL DEFAULT 0 CHECK (locked_balance >= 0) |

**Seeded system wallet on migration:**
```sql
INSERT INTO users (id, email, password_hash, full_name, roles, active_role, is_active, created_at)
VALUES ('00000000-0000-0000-0000-000000000001','platform@aitasker.internal',
        'SEEDED_NO_LOGIN','AITasker Platform','["ADMIN"]','ADMIN',true,now());
INSERT INTO wallets (user_id) VALUES ('00000000-0000-0000-0000-000000000001');
-- Store returned wallet id as env var PLATFORM_FEE_WALLET_ID
```

---

**Table: `wallet_transactions`** *(immutable ledger)*

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `wallet_id` | UUID | NOT NULL REFERENCES wallets(id) | |
| `amount` | BIGINT | NOT NULL CHECK (amount > 0) | Always positive; direction from type |
| `transaction_type` | TEXT | NOT NULL CHECK (transaction_type IN ('TOP_UP','SUBSCRIPTION','ESCROW_LOCK','ESCROW_RELEASE','PLATFORM_FEE','ESCROW_REFUND','ESCROW_SPLIT','WITHDRAWAL')) | |
| `reference_id` | TEXT | NULL | Polymorphic. Convention: `ESC_LOCK:{milestone_id}`, `TOP_UP:{va_number}:{sepay_ref}`, etc. |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**Idempotency index (prevents SePay retry double-credit):**
```sql
CREATE UNIQUE INDEX wallet_tx_idempotency
  ON wallet_transactions(wallet_id, reference_id)
  WHERE reference_id IS NOT NULL;
```

---

**Table: `virtual_accounts`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `entity_type` | TEXT | NOT NULL CHECK (entity_type IN ('WALLET_TOPUP','MILESTONE','SERVICE','SUBSCRIPTION')) | |
| `entity_id` | TEXT | NOT NULL | Polymorphic: user_id / milestone_id / engagement purchase_ref / user_subscriptions.id |
| `va_number` | TEXT | NOT NULL UNIQUE | SePay-issued bank account number |
| `fixed_amount` | BIGINT | NULL | NULL for WALLET_TOPUP; set for all others |
| `expires_at` | TIMESTAMPTZ | NULL | 24h for MILESTONE VAs; NULL for WALLET_TOPUP |
| `status` | TEXT | NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXPIRED','USED')) | |

---

**Table: `withdrawal_requests`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `expert_id` | UUID | NOT NULL REFERENCES expert_profiles(user_id) | |
| `type` | TEXT | NOT NULL DEFAULT 'EXPERT_MANUAL' CHECK (type IN ('MILESTONE_RELEASE','EXPERT_MANUAL')) | MILESTONE_RELEASE auto-created on APPROVED; EXPERT_MANUAL expert-initiated |
| `amount` | BIGINT | NOT NULL CHECK (amount > 0) | |
| `bank_account_xid` | TEXT | NOT NULL | |
| `disbursement_id` | TEXT | NULL | SePay chi hộ response ID |
| `status` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED')) | |
| `requested_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `confirmed_at` | TIMESTAMPTZ | NULL | |

---

**Table: `platform_settings`** *(singleton)*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `platform_wallet_id` | UUID | NOT NULL UNIQUE REFERENCES wallets(id) |
| `platform_fee_pct` | FLOAT | NOT NULL DEFAULT 0.05 CHECK (platform_fee_pct BETWEEN 0 AND 1) |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

---

### Section 3 — Elicitation Engine

**Table: `elicitation_sessions`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `user_id` | UUID | NOT NULL REFERENCES users(id) | CEO who started the session |
| `current_stage` | INT | NOT NULL DEFAULT 1 CHECK (current_stage BETWEEN 1 AND 5) | |
| `archetype` | TEXT | NULL | Locked after Stage 2 |
| `scenario_type` | TEXT | NULL CHECK (scenario_type IN ('STANDARD','SCENARIO_A','SCENARIO_B')) | |
| `void_list_json` | JSONB | NOT NULL DEFAULT '[]' | `[{void_code, injected: boolean}]` |
| `state` | TEXT | NOT NULL DEFAULT 'IN_PROGRESS' CHECK (state IN ('IN_PROGRESS','COMPLETED','ABANDONED','RETURNED')) | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

---

### Section 4 — Projects (JSONB Hub)

**Table: `projects`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `client_id` | UUID | NOT NULL REFERENCES users(id) | CEO user_id |
| `elicitation_session_id` | UUID | NULL REFERENCES elicitation_sessions(id) | NULL for non-elicitation paths |
| `state` | TEXT | NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT','PUBLISHED','RETURNED_TO_CLIENT','SUSPENDED')) | |
| `archetype` | TEXT | NULL | |
| `tier` | TEXT | NULL CHECK (tier IN ('TIER_1','TIER_2','TIER_3')) | |
| `self_technical` | BOOLEAN | NOT NULL DEFAULT FALSE | |
| `required_seams_json` | JSONB | NOT NULL DEFAULT '[]' | Replaces `capability_footprints.required_seams_json` |
| `required_domains_json` | JSONB | NOT NULL DEFAULT '[]' | Replaces `capability_footprints.required_domains_json` |
| `milestone_framework_json` | JSONB | NOT NULL DEFAULT '[]' | Replaces `capability_footprints.milestone_framework_json` |
| `artifact_a_json` | JSONB | NULL | Replaces `artifact_a` table. Visible to matched experts pre-bid |
| `artifact_b_json` | JSONB | NULL | Replaces `artifact_b` table. FastAPI guard: only returned when `engagement.state >= CONNECTED AND NDA both accepted AND requester != CEO` |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**Index:** `client_id`, `state`

---

### Section 5 — Services

**Table: `services`**

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `expert_id` | UUID | NOT NULL REFERENCES expert_profiles(user_id) ON DELETE CASCADE |
| `title` | TEXT | NOT NULL |
| `description` | TEXT | NOT NULL |
| `domains_json` | JSONB | NOT NULL DEFAULT '[]' |
| `seams_json` | JSONB | NOT NULL DEFAULT '[]' |
| `price_vnd` | BIGINT | NOT NULL CHECK (price_vnd > 0) |
| `state` | TEXT | NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT','PUBLISHED','SUSPENDED')) |
| `service_type` | TEXT | NOT NULL CHECK (service_type IN ('AI_SERVICE','TECH_DISCOVERY')) |

---

### Section 6 — Expert Capability (2-Tier)

**Table: `expert_domain_depths`**

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `expert_id` | UUID | NOT NULL REFERENCES expert_profiles(user_id) ON DELETE CASCADE |
| `domain_code` | TEXT | NOT NULL |
| `depth_level` | TEXT | NOT NULL CHECK (depth_level IN ('SURFACE','OPERATIONAL','DEEP')) |
| `verification_tier` | TEXT | NOT NULL DEFAULT 'CLAIMED' CHECK (verification_tier IN ('CLAIMED','EVIDENCE_BACKED')) |

**Unique constraint:** `(expert_id, domain_code)`

---

**Table: `expert_seam_claims`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `expert_id` | UUID | NOT NULL REFERENCES expert_profiles(user_id) ON DELETE CASCADE | |
| `seam_code` | TEXT | NOT NULL | |
| `verification_tier` | TEXT | NOT NULL DEFAULT 'CLAIMED' CHECK (verification_tier IN ('CLAIMED','EVIDENCE_BACKED')) | Tier 2 only for MVP |
| `submission_count` | INT | NOT NULL DEFAULT 0 | 5-attempt throttle |
| `locked_until` | TIMESTAMPTZ | NULL | |

**Unique constraint:** `(expert_id, seam_code)`

---

**Table: `portfolio_submissions`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `expert_id` | UUID | NOT NULL REFERENCES expert_profiles(user_id) ON DELETE CASCADE | |
| `seam_claim_id` | UUID | NOT NULL REFERENCES expert_seam_claims(id) | Which claim is being upgraded to Tier 2 |
| `project_description` | TEXT | NOT NULL | |
| `decision_points` | TEXT | NOT NULL | Structured rubric response |
| `status` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')) | |
| `llm_confidence` | FLOAT | NULL | Threshold ≥ 0.85 for auto-upgrade |
| `submitted_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `evaluated_at` | TIMESTAMPTZ | NULL | |

---

### Section 7 — Engagements

**Table: `engagements`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `project_id` | UUID | NULL REFERENCES projects(id) | NULL for Path B |
| `expert_id` | UUID | NOT NULL REFERENCES expert_profiles(user_id) | |
| `service_id` | UUID | NULL REFERENCES services(id) | NULL for Path A |
| `type` | TEXT | NOT NULL CHECK (type IN ('PROJECT_BASED','SERVICE_PURCHASE','TECH_DISCOVERY')) | Immutable after creation |
| `state` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','CONNECTED','ACTIVE','CLOSED','DISPUTED')) | |
| `connected_at` | TIMESTAMPTZ | NULL | |
| `client_nda_accepted_at` | TIMESTAMPTZ | NULL | Required before CONNECTED |
| `expert_nda_accepted_at` | TIMESTAMPTZ | NULL | Required before CONNECTED |

**Table-level CHECK (type-FK consistency):**
```sql
CONSTRAINT engagement_type_fk CHECK (
  (type = 'PROJECT_BASED' AND project_id IS NOT NULL AND service_id IS NULL) OR
  (type IN ('SERVICE_PURCHASE','TECH_DISCOVERY') AND project_id IS NULL AND service_id IS NOT NULL)
)
```

---

### Section 8 — Capability Bids (Simplified)

**Table: `capability_bids`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `engagement_id` | UUID | NOT NULL UNIQUE REFERENCES engagements(id) | UNIQUE enforces 1:1 |
| `footprint_alignment_json` | JSONB | NULL | Component 1 |
| `approach_summary` | TEXT | NULL | Component 2 |
| `conditional_pricing_json` | JSONB | NULL | Component 3 |
| `state` | TEXT | NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT','SUBMITTED','TECH_REVIEW','REVISION_REQUESTED','TECH_APPROVED','CEO_REVIEW','SELECTED','DECLINED')) | |
| `tech_status` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (tech_status IN ('PENDING','APPROVED','REVISION_REQUESTED')) | Replaces bid_revision_requests + Surface B |
| `ceo_status` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (ceo_status IN ('PENDING','APPROVED','DECLINED')) | Route guard: only settable when tech_status = APPROVED |
| `tech_feedback` | TEXT | NULL | Written when tech_status → REVISION_REQUESTED. Expert reads, edits bid, resets to PENDING |
| `negotiated_price_vnd` | BIGINT | NULL | CEO counter-offer, one round. Replaces price_negotiations table |
| `version_number` | INT | NOT NULL DEFAULT 1 | |

---

### Section 9 — Milestones (2-Layer)

**Table: `milestones`**

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `engagement_id` | UUID | NOT NULL REFERENCES engagements(id) ON DELETE CASCADE |
| `milestone_number` | INT | NOT NULL |
| `deliverable_statement` | TEXT | NOT NULL |
| `sign_off_authority` | TEXT | NOT NULL CHECK (sign_off_authority IN ('TECH_TEAM','CEO','JOINT')) |
| `payment_amount_vnd` | BIGINT | NOT NULL CHECK (payment_amount_vnd > 0) |
| `state` | TEXT | NOT NULL DEFAULT 'DEFINED' CHECK (state IN ('DEFINED','AWAITING_PAYMENT','FUNDED','IN_PROGRESS','SUBMITTED','IN_REVISION','APPROVED','RELEASED','DISPUTED')) |
| `va_number` | TEXT | NULL |
| `va_expires_at` | TIMESTAMPTZ | NULL |
| `funded_at` | TIMESTAMPTZ | NULL |
| `submitted_at` | TIMESTAMPTZ | NULL |
| `approved_at` | TIMESTAMPTZ | NULL |
| `released_at` | TIMESTAMPTZ | NULL |

**Unique constraint:** `(engagement_id, milestone_number)`

---

**Table: `acceptance_criteria`** *(Layer 1)*

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `milestone_id` | UUID | NOT NULL REFERENCES milestones(id) ON DELETE CASCADE | |
| `criterion_text` | TEXT | NOT NULL | LLM quality-gates on save |
| `is_required` | BOOLEAN | NOT NULL DEFAULT TRUE | |
| `verified_by_role` | TEXT | NOT NULL CHECK (verified_by_role IN ('TECH_TEAM','CEO','JOINT')) | |
| `verified_at` | TIMESTAMPTZ | NULL | |
| `revision_note` | TEXT | NULL | Absorbs cut `revision_requests` table. Written by reviewer when rejecting criterion |

---

**Table: `milestone_dod_items`** *(Layer 2)*

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `milestone_id` | UUID | NOT NULL REFERENCES milestones(id) ON DELETE CASCADE | |
| `item_description` | TEXT | NOT NULL | |
| `is_required` | BOOLEAN | NOT NULL DEFAULT TRUE | |
| `status` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','NOT_APPLICABLE')) | |
| `completed_at` | TIMESTAMPTZ | NULL | |
| `completion_note` | TEXT | NULL | |
| `not_applicable_note` | TEXT | NULL | |
| `maps_to_criterion_id` | UUID | NULL REFERENCES acceptance_criteria(id) | Optional upward link |

**Table-level CHECK:**
```sql
CONSTRAINT dod_required_cannot_be_na
  CHECK (NOT (is_required = TRUE AND status = 'NOT_APPLICABLE'))
```

---

**Table: `milestone_submissions`**

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `milestone_id` | UUID | NOT NULL REFERENCES milestones(id) ON DELETE CASCADE |
| `expert_id` | UUID | NOT NULL REFERENCES expert_profiles(user_id) |
| `description` | TEXT | NOT NULL |
| `files_json` | JSONB | NOT NULL DEFAULT '[]' |
| `submitted_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

---

**Table: `paygated_documents`** *(KEPT — core F5 mechanism)*

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `milestone_id` | UUID | NOT NULL REFERENCES milestones(id) ON DELETE CASCADE | Release trigger: when milestone → FUNDED via IPN |
| `document_url` | TEXT | NOT NULL | |
| `release_state` | TEXT | NOT NULL DEFAULT 'STAGED' CHECK (release_state IN ('STAGED','RELEASED')) | Flips automatically when IPN fires |
| `staged_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `released_at` | TIMESTAMPTZ | NULL | Set by IPN handler. TECH_TEAM-only read; CEO excluded |

---

### Section 10 — Escrow (Dual-Parent)

**Table: `escrow_accounts`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `milestone_id` | UUID | NULL REFERENCES milestones(id) | Path A (PROJECT_BASED) |
| `engagement_id` | UUID | NULL REFERENCES engagements(id) | Path B (SERVICE_PURCHASE / TECH_DISCOVERY) |
| `amount` | BIGINT | NOT NULL CHECK (amount > 0) | |
| `client_wallet_id` | UUID | NOT NULL REFERENCES wallets(id) | Source wallet |
| `expert_wallet_id` | UUID | NOT NULL REFERENCES wallets(id) | Destination wallet |
| `status` | TEXT | NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD','RELEASED','FROZEN','REFUNDED','SPLIT')) | |
| `held_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `released_at` | TIMESTAMPTZ | NULL | |

**Table-level CHECK (exactly one parent):**
```sql
CONSTRAINT escrow_has_one_parent CHECK (
  (milestone_id IS NOT NULL AND engagement_id IS NULL) OR
  (milestone_id IS NULL AND engagement_id IS NOT NULL)
)
```

**Two partial unique indexes:**
```sql
CREATE UNIQUE INDEX escrow_milestone_unique
  ON escrow_accounts(milestone_id) WHERE milestone_id IS NOT NULL;
CREATE UNIQUE INDEX escrow_engagement_unique
  ON escrow_accounts(engagement_id) WHERE engagement_id IS NOT NULL;
```

---

### Section 11 — Disputes (2-Layer)

**Table: `disputes`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `engagement_id` | UUID | NOT NULL REFERENCES engagements(id) | |
| `milestone_id` | UUID | NOT NULL REFERENCES milestones(id) | |
| `criterion_id` | UUID | NOT NULL REFERENCES acceptance_criteria(id) | Always filed against a specific criterion |
| `escrow_account_id` | UUID | NOT NULL REFERENCES escrow_accounts(id) | Direct FK — O(1) freeze, type-agnostic |
| `filed_by` | UUID | NOT NULL REFERENCES users(id) | |
| `state` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','LAYER_1_EVAL','AUTO_RESOLVED','MANUAL_REVIEW','RESOLVED')) | |
| `llm_confidence` | FLOAT | NULL CHECK (llm_confidence BETWEEN 0 AND 1) | Layer 1 evaluation |
| `filed_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `resolved_at` | TIMESTAMPTZ | NULL | |

---

### Section 12 — Messaging

**Table: `messages`**

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `engagement_id` | UUID | NOT NULL REFERENCES engagements(id) ON DELETE CASCADE |
| `sender_id` | UUID | NOT NULL REFERENCES users(id) |
| `content` | TEXT | NOT NULL |
| `attachment_url` | TEXT | NULL |
| `timestamp` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Index:** `engagement_id`, `timestamp`

---

**Table: `message_reads`** *(KEPT — F9 unread badge)*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `message_id` | UUID | NOT NULL REFERENCES messages(id) ON DELETE CASCADE |
| `user_id` | UUID | NOT NULL REFERENCES users(id) |
| `read_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Unique constraint:** `(message_id, user_id)`

---

### Section 13 — Reviews & Audit

**Table: `reviews`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `engagement_id` | UUID | NOT NULL REFERENCES engagements(id) | |
| `reviewer_id` | UUID | NOT NULL REFERENCES users(id) | |
| `target_id` | UUID | NOT NULL REFERENCES users(id) | |
| `rating` | INT | NOT NULL CHECK (rating BETWEEN 1 AND 5) | |
| `comment` | TEXT | NULL | |
| `structured_signals_json` | JSONB | NULL | Absorbs cut `outcome_signals.seam_signals_json`. Informational only (admin dashboard) since Tier 4 is cut. Format: `[{seam_code, signal_type, seam_role}]` |
| `reviewer_role` | TEXT | NOT NULL CHECK (reviewer_role IN ('CEO','TECH_TEAM','EXPERT')) | |

**Unique constraint:** `(engagement_id, reviewer_id)`

---

**Table: `platform_decisions`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `decision_type` | TEXT | NOT NULL CHECK (decision_type IN ('ELICITATION_SYNTHESIS','SPEC_AUTO_RETURN','SEAM_TIER_UPGRADE','PORTFOLIO_EVAL','DISPUTE_L1_EVAL','CRITERION_QUALITY_GATE')) | Simplified from 8 to 6 types |
| `entity_type` | TEXT | NOT NULL | |
| `entity_id` | TEXT | NOT NULL | |
| `llm_confidence` | FLOAT | NULL CHECK (llm_confidence BETWEEN 0 AND 1) | |
| `decision` | TEXT | NOT NULL | |
| `advisory_note` | TEXT | NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

---

### FK Dependency Order (28 tables)

```
 1.  users
 2.  client_profiles              → users
 3.  expert_profiles              → users
 4.  wallets                      → users
 5.  wallet_transactions          → wallets
 6.  withdrawal_requests          → expert_profiles
 7.  virtual_accounts             → (polymorphic — standalone)
 8.  elicitation_sessions         → users
 9.  projects                     → users, elicitation_sessions
10.  tech_team_profiles           → users, projects
11.  platform_settings            → wallets
12.  services                     → expert_profiles
13.  engagements                  → projects, expert_profiles, services
14.  expert_domain_depths         → expert_profiles
15.  expert_seam_claims           → expert_profiles
16.  portfolio_submissions        → expert_profiles, expert_seam_claims
17.  capability_bids              → engagements
18.  milestones                   → engagements
19.  acceptance_criteria          → milestones
20.  milestone_dod_items          → milestones, acceptance_criteria
21.  milestone_submissions        → milestones, expert_profiles
22.  paygated_documents           → milestones
23.  escrow_accounts              → milestones (nullable), engagements (nullable), wallets
24.  disputes                     → engagements, milestones, acceptance_criteria,
                                     escrow_accounts, users
25.  messages                     → engagements, users
26.  message_reads                → messages, users
27.  reviews                      → engagements, users
28.  platform_decisions           → (polymorphic — standalone)
```

---

## Conceptual ER — Unified Draw Plan (MVP · 28 Tables)

---

### Entities to Draw — 28 Total

`users` · `client_profiles` · `expert_profiles` · `tech_team_profiles` · `wallets` · `wallet_transactions` · `virtual_accounts` · `withdrawal_requests` · `platform_settings` · `elicitation_sessions` · `projects` · `services` · `expert_domain_depths` · `expert_seam_claims` · `portfolio_submissions` · `engagements` · `capability_bids` · `milestones` · `acceptance_criteria` · `milestone_dod_items` · `milestone_submissions` · `paygated_documents` · `escrow_accounts` · `disputes` · `messages` · `message_reads` · `reviews` · `platform_decisions`

---

### Phase 0 — Elicitation Engine

Draw `elicitation_sessions` between `users` and `projects`.

- `users` (diamond) `initiates` ➔ `elicitation_sessions` **(1:N)**

---

### Phase 1 — Users & Role Subtypes

Draw `users` as the central anchor.

- `users` (diamond) `has` ➔ `client_profiles` **(1:1)**
- `users` (diamond) `has` ➔ `expert_profiles` **(1:1)**
- `users` (diamond) `has` ➔ `tech_team_profiles` **(1:1)**
- `users` (diamond) `invited` ➔ `tech_team_profiles` **(1:N)** — via `linked_client_id`

*Note: No separate Subscription entity. Subscription tier and expiry are columns on `users`. No separate organization entities — Phase 2.*

---

### Phase 2 — Expert Capability (2-Tier System)

All branch from `expert_profiles`.

*Note: No `expert_stack_tags` entity — stack tags are `stack_tags_json JSONB` on `expert_profiles`. No `scenario_assessments`, `scenario_responses`, or `expert_seam_outcome_signals` — Tiers 3 and 4 are cut.*

- `expert_profiles` (diamond) `has` ➔ `expert_domain_depths` **(1:N)**
- `expert_profiles` (diamond) `holds` ➔ `expert_seam_claims` **(1:N)**
- `expert_profiles` (diamond) `submits` ➔ `portfolio_submissions` **(1:N)**
- `portfolio_submissions` (diamond) `upgrades` ➔ `expert_seam_claims` **(N:1)** — via `seam_claim_id`; LLM evaluates and upgrades the targeted claim to Tier 2

---

### Phase 3 — Wallet, Finance & Platform Settings

Draw `wallets` beside `users`. Draw `platform_settings` as a singleton near the wallet cluster.

*Note: No `user_subscriptions` entity — subscription state lives as columns on `users`. `virtual_accounts` floats near this cluster — no strict FK line since `entity_id` is polymorphic.*

- `users` (diamond) `owns` ➔ `wallets` **(1:1)**
- `wallets` (diamond) `records` ➔ `wallet_transactions` **(1:N)**
- `expert_profiles` (diamond) `requests` ➔ `withdrawal_requests` **(1:N)**
- `platform_settings` (diamond) `references` ➔ `wallets` **(1:1)** — annotate: *"singleton — seeded at deploy"*

---

### Phase 4 — Projects (JSONB Hub)

Draw `projects` as the primary hub. Annotate the entity box: *"contains artifact_a_json + artifact_b_json + footprint JSONBs — replaces 3 cut tables"*.

- `users` (diamond) `creates` ➔ `projects` **(1:N)** — CEO only
- `elicitation_sessions` (diamond) `produces` ➔ `projects` **(1:1)** — Stage 5 synthesis output
- `projects` (diamond) `scopes` ➔ `tech_team_profiles` **(1:N)** — via `linked_project_id`

Draw the Artifact B access gate annotation on the `projects` entity: *"artifact_b_json route-gated: state ≥ CONNECTED + NDA accepted + CEO excluded"*. No separate Artifact B entity — the gate is a route guard on the same row.

---

### Phase 5 — Services (Path B)

- `expert_profiles` (diamond) `creates` ➔ `services` **(1:N)**

---

### Phase 6 — Engagements & Bids

Draw `engagements` as the secondary hub.

- `projects` (diamond) `has` ➔ `engagements` **(1:N)** — Path A; `project_id` NULL for Path B
- `services` (diamond) `generates` ➔ `engagements` **(1:N)** — Path B only
- `expert_profiles` (diamond) `joins` ➔ `engagements` **(1:N)**

*Note: No `spec_clarifications` entity — pre-bid technical questions use the `messages` channel.*

Draw `capability_bids`:
- `engagements` (diamond) `has` ➔ `capability_bids` **(1:1)** — one bid per engagement; absent for SERVICE_PURCHASE

Annotate the `capability_bids` entity box: *"tech_status + ceo_status cols replace 4 surface tables"*. No separate `bid_versions`, `bid_revision_requests`, `price_negotiations`, `bid_conflict_overrides` entities.

---

### Phase 7 — Milestones (2-Layer)

Draw `milestones` from `engagements`. *Note: Layer 3 (sprints, sprint updates, addon phases) is entirely cut — no `milestone_sprints`, `sprint_status_updates`, `addon_phase_requests`, `sprint_comments`, `dod_item_comments` entities.*

**Engagement → Milestones:**
- `engagements` (diamond) `has` ➔ `milestones` **(1:N)**
- `milestones` (diamond) `allocates` ➔ `virtual_accounts` **(1:N)**

**Layer 1 — Acceptance Criteria:**
- `milestones` (diamond) `has` ➔ `acceptance_criteria` **(1:N)** — annotate: *"revision_note col replaces revision_requests table"*
- `acceptance_criteria` (diamond) `evaluation logged in` ➔ `platform_decisions` **(1:1)** — LLM quality gate on criterion save

**Layer 2 — DoD Checklist:**
- `milestones` (diamond) `has` ➔ `milestone_dod_items` **(1:N)**
- `milestone_dod_items` (diamond) `maps to` ➔ `acceptance_criteria` **(N:1)** — nullable upward link

**Deliverables & Pay-gated Documents:**
- `milestones` (diamond) `has` ➔ `milestone_submissions` **(1:N)**
- `expert_profiles` (diamond) `submits` ➔ `milestone_submissions` **(1:N)**
- `milestones` (diamond) `triggers release of` ➔ `paygated_documents` **(1:N)** — annotate: *"IPN fires → release_state STAGED→RELEASED; TECH_TEAM-only read"*

**Escrow (dual-parent paths):**
- `milestones` (diamond) `held in` ➔ `escrow_accounts` **(1:1)** — annotate: *"Path A only"*
- `engagements` (diamond) `holds escrow for` ➔ `escrow_accounts` **(1:1)** — annotate: *"Path B only (SERVICE_PURCHASE)"*
- `wallets` (diamond) `funds` ➔ `escrow_accounts` **(1:N)** — via `client_wallet_id`
- `wallets` (diamond) `receives from` ➔ `escrow_accounts` **(1:N)** — via `expert_wallet_id`

**Disputes (2-Layer):**
- `engagements` (diamond) `has` ➔ `disputes` **(1:N)**
- `milestones` (diamond) `has` ➔ `disputes` **(1:N)**
- `acceptance_criteria` (diamond) `subject of` ➔ `disputes` **(1:N)** — disputes always filed against a specific criterion
- `escrow_accounts` (diamond) `frozen by` ➔ `disputes` **(1:1)** — direct FK, O(1) freeze
- `users` (diamond) `files` ➔ `disputes` **(1:N)**

*Note: No `dispute_resolution_reports` entity — cut.*

---

### Phase 8 — Messaging, Reviews & Audit

**Messaging:**
- `engagements` (diamond) `has` ➔ `messages` **(1:N)** — one channel absorbs spec clarifications + sprint comments + DoD comments
- `users` (diamond) `sends` ➔ `messages` **(1:N)**
- `messages` (diamond) `has` ➔ `message_reads` **(1:N)**
- `users` (diamond) `reads` ➔ `message_reads` **(1:N)**

**Reviews:**
- `engagements` (diamond) `has` ➔ `reviews` **(1:N)** — annotate: *"structured_signals_json absorbs cut outcome_signals table"*
- `users` (diamond) `writes` ➔ `reviews` **(1:N)** — via `reviewer_id`
- `users` (diamond) `reviewed as` ➔ `reviews` **(1:N)** — via `target_id`

**Platform Decisions:**
`platform_decisions` is a standalone entity with two incoming lines from Phase 7 (`acceptance_criteria → evaluation logged in`). No further FK lines — `entity_id` is polymorphic.

---

### Final Count

| Phase | Entities | Relationships |
|---|---|---|
| 0 — Elicitation | 1 | 1 |
| 1 — Users & Subtypes | 4 | 4 |
| 2 — Expert Capability | 3 | 4 |
| 3 — Wallet & Finance | 4 | 4 |
| 4 — Projects Hub | 1 | 3 |
| 5 — Services | 1 | 1 |
| 6 — Engagements & Bids | 2 | 4 |
| 7 — Milestones, Escrow, Disputes | 10 | 18 |
| 8 — Messaging, Reviews, Audit | 4 | 7 |
| **Total** | **28** | **46** |