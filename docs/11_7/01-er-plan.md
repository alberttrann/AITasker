## Physical ER Plan — AITasker MVP (PostgreSQL · 40 Tables)

### Global Conventions

- **All PKs:** `UUID NOT NULL DEFAULT gen_random_uuid()`
- **All timestamps:** `TIMESTAMPTZ` (UTC)
- **All money:** `BIGINT` (VND integer — no decimals)
- **All JSON:** `JSONB`
- **Enums:** `TEXT` with `CHECK` constraints
- **Extension:** `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`
- **Deletions:** `ON DELETE CASCADE` used only for strict 1:1 children (profiles) and nested composite children (milestone items). All other FKs are `RESTRICT` (default) to preserve audit/ledger integrity.

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
| `active_role` | TEXT | NOT NULL DEFAULT 'CLIENT' CHECK (active_role IN ('CLIENT','EXPERT','ADMIN')) |
| `client_subtype` | TEXT | NULL CHECK (client_subtype IN ('CEO','TECH_TEAM')) |
| `subscription_client_tier` | TEXT | NOT NULL DEFAULT 'free' CHECK (subscription_client_tier IN ('free','pro')) |
| `subscription_expert_tier` | TEXT | NOT NULL DEFAULT 'free' CHECK (subscription_expert_tier IN ('free','pro')) |
| `sub_client_expires_at` | TIMESTAMPTZ | NULL |
| `sub_expert_expires_at` | TIMESTAMPTZ | NULL |
| `sepay_bank_account_xid` | TEXT | NULL |
| `bank_account_holder_name` | TEXT | NULL |
| `bank_linked_at` | TIMESTAMPTZ | NULL |
| `self_technical` | BOOLEAN | NOT NULL DEFAULT FALSE |
| `self_technical_projects` | JSONB | NOT NULL DEFAULT '[]' |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `password_reset_token` | TEXT | NULL |
| `password_reset_token_expires_at`| TIMESTAMPTZ | NULL |
| `refresh_token_hash` | TEXT | NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:** `email` (unique), `active_role`

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
| `stack_tags_json` | JSONB | NOT NULL DEFAULT '[]' | Format: `["Python","Kafka","Go"]` |
| `archetype_history_json` | JSONB | NOT NULL DEFAULT '[]' | Self-declared history for cold-start matching. |

---

**Table: `tech_team_profiles`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `user_id` | UUID | PK NOT NULL REFERENCES users(id) ON DELETE CASCADE | |
| `linked_client_id` | UUID | NOT NULL REFERENCES users(id) | CEO who issued the handoff link |
| `linked_project_id` | UUID | NULL REFERENCES projects(id) | Scope guard: set immediately if project exists at claim time |
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

---

**Table: `wallet_transactions`** *(immutable ledger)*

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `wallet_id` | UUID | NOT NULL REFERENCES wallets(id) | |
| `amount` | BIGINT | NOT NULL CHECK (amount > 0) | Always positive; direction from type |
| `transaction_type` | TEXT | NOT NULL CHECK (transaction_type IN ('TOP_UP','SUBSCRIPTION','ESCROW_LOCK','ESCROW_RELEASE','PLATFORM_FEE','ESCROW_REFUND','ESCROW_SPLIT','WITHDRAWAL','WITHDRAWAL_REFUND')) | |
| `reference_id` | TEXT | NULL | Polymorphic |
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
| `entity_type` | TEXT | NOT NULL CHECK (entity_type IN ('WALLET_TOPUP','MILESTONE','SERVICE')) | |
| `entity_id` | TEXT | NOT NULL | Polymorphic: user_id / milestone_id / engagement_id |
| `va_number` | TEXT | NOT NULL UNIQUE | SePay-issued bank account number |
| `fixed_amount` | BIGINT | NULL | NULL for WALLET_TOPUP; set for all others |
| `expires_at` | TIMESTAMPTZ | NULL | 24h for MILESTONE VAs; NULL for WALLET_TOPUP |
| `status` | TEXT | NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXPIRED','USED')) | |

---

**Table: `withdrawal_requests`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `expert_id` | UUID | NOT NULL REFERENCES users(id) | |
| `type` | TEXT | NOT NULL DEFAULT 'EXPERT_MANUAL' CHECK (type IN ('MILESTONE_RELEASE','EXPERT_MANUAL')) | |
| `amount` | BIGINT | NOT NULL CHECK (amount > 0) | |
| `bank_account_xid` | TEXT | NOT NULL | |
| `disbursement_id` | TEXT | NULL | SePay chi hộ response ID |
| `status` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','FAILED','CANCELLED')) | |
| `requested_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `confirmed_at` | TIMESTAMPTZ | NULL | |
| `milestone_id` | UUID | NULL REFERENCES milestones(id) | Set if type = MILESTONE_RELEASE |

---

**Table: `platform_settings`** *(singleton)*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `platform_wallet_id` | UUID | NULL UNIQUE REFERENCES wallets(id) |
| `platform_fee_pct` | FLOAT | NOT NULL DEFAULT 0.05 CHECK (platform_fee_pct BETWEEN 0 AND 1) |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

---

### Section 3 — Elicitation Engine

**Table: `elicitation_sessions`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `user_id` | UUID | NOT NULL REFERENCES users(id) | |
| `current_stage` | INT | NOT NULL DEFAULT 1 CHECK (current_stage BETWEEN 1 AND 5) | |
| `archetype` | TEXT | NULL | Locked after Stage 2 |
| `scenario_type` | TEXT | NULL | |
| `void_list_json` | JSONB | NOT NULL DEFAULT '[]' | `[{void_code, severity, injected: boolean}]` |
| `stage1_symptoms_json` | JSONB | NULL | Extracted symptoms |
| `stage3_probes_json` | JSONB | NULL | Probe Q&A pairs |
| `stage4_tech_inputs_json` | JSONB | NULL | Tech context + submitted artifacts |
| `state` | TEXT | NOT NULL DEFAULT 'IN_PROGRESS' CHECK (state IN ('IN_PROGRESS','COMPLETED','ABANDONED','RETURNED')) | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `handoff_token_jti` | TEXT | NULL | Tech team handoff token ID |
| `handoff_consumed_at` | TIMESTAMPTZ | NULL | |
| `recommended_archetypes_json` | JSONB | NULL | Top 3-5 archetypes from Stage 1 LLM |
| `symptom_text_draft` | TEXT | NULL | Stage 1 autosave draft |
| `stage1_original_input` | TEXT | NULL | Raw input for FE diff display |
| `stage4_draft_json` | JSONB | NULL | Stage 4 autosave draft |
| `estimated_budget_vnd` | BIGINT | NULL | Parsed from Stage 1 input |
| `critical_artifacts_json` | JSONB | NULL | Tracked artifacts required for synthesis |

---

### Section 4 — Projects (JSONB Hub)

**Table: `projects`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `client_id` | UUID | NOT NULL REFERENCES users(id) | |
| `elicitation_session_id` | UUID | NULL UNIQUE REFERENCES elicitation_sessions(id) | |
| `project_name` | TEXT | NULL | Editable by CEO post-publish |
| `state` | TEXT | NOT NULL DEFAULT 'PUBLISHED' CHECK (state IN ('DRAFT','PUBLISHED','RETURNED_TO_CLIENT','SUSPENDED')) | |
| `archetype` | TEXT | NULL | |
| `tier` | TEXT | NULL CHECK (tier IN ('TIER_1','TIER_2','TIER_3')) | |
| `self_technical` | BOOLEAN | NOT NULL DEFAULT FALSE | |
| `required_seams_json` | JSONB | NOT NULL DEFAULT '[]' | |
| `required_domains_json` | JSONB | NOT NULL DEFAULT '[]' | |
| `milestone_framework_json` | JSONB | NOT NULL DEFAULT '[]' | |
| `artifact_a_json` | JSONB | NULL | Visible to matched experts pre-bid |
| `artifact_b_json` | JSONB | NULL | Route-gated: state >= CONNECTED + NDA accepted + CEO excluded |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `estimated_total_cost_vnd` | BIGINT | NULL | Computed from milestone_framework_json |
| `estimated_total_duration_days` | INT | NULL | Computed from milestone_framework_json |

**Index:** `client_id`, `state`

---

**Table: `project_shortlist_cache`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `project_id` | UUID | PK NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE | |
| `results_json` | JSONB | NOT NULL DEFAULT '[]' | Array of matching expert results |
| `generated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `source` | TEXT | NOT NULL DEFAULT 'AUTO' CHECK (source IN ('AUTO','FORCE_REFRESH')) | 'FORCE_REFRESH' when CEO triggers re-score |

---

### Section 5 — Services

**Table: `services`**

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `expert_id` | UUID | NOT NULL REFERENCES users(id) ON DELETE CASCADE |
| `title` | TEXT | NOT NULL |
| `description` | TEXT | NULL |
| `domains_json` | JSONB | NOT NULL DEFAULT '[]' |
| `seams_json` | JSONB | NOT NULL DEFAULT '[]' |
| `price_vnd` | BIGINT | NOT NULL CHECK (price_vnd > 0) |
| `state` | TEXT | NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT','PUBLISHED','SUSPENDED')) |
| `service_type` | TEXT | NOT NULL CHECK (service_type IN ('AI_SERVICE','TECH_DISCOVERY')) |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `scope` | TEXT | NULL |
| `timeline` | TEXT | NULL |

---

### Section 6 — Expert Capability (2-Tier)

**Table: `expert_domain_depths`**

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `expert_id` | UUID | NOT NULL REFERENCES users(id) ON DELETE CASCADE |
| `domain_code` | TEXT | NOT NULL |
| `depth_level` | TEXT | NOT NULL CHECK (depth_level IN ('SURFACE','OPERATIONAL','DEEP')) |
| `verification_tier` | TEXT | NOT NULL DEFAULT 'CLAIMED' CHECK (verification_tier IN ('CLAIMED','EVIDENCE_BACKED')) |

**Unique constraint:** `(expert_id, domain_code)`

---

**Table: `expert_seam_claims`**

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `expert_id` | UUID | NOT NULL REFERENCES users(id) ON DELETE CASCADE |
| `seam_code` | TEXT | NOT NULL |
| `verification_tier` | TEXT | NOT NULL DEFAULT 'CLAIMED' CHECK (verification_tier IN ('CLAIMED','EVIDENCE_BACKED')) |
| `submission_count` | INT | NOT NULL DEFAULT 0 |
| `locked_until` | TIMESTAMPTZ | NULL |

**Unique constraint:** `(expert_id, seam_code)`

---

**Table: `portfolio_submissions`**

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `expert_id` | UUID | NOT NULL REFERENCES users(id) |
| `seam_claim_id` | UUID | NOT NULL REFERENCES expert_seam_claims(id) |
| `project_description` | TEXT | NOT NULL |
| `decision_points` | TEXT | NOT NULL |
| `status` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')) |
| `llm_confidence` | FLOAT | NULL |
| `submitted_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `evaluated_at` | TIMESTAMPTZ | NULL |

---

### Section 7 — Engagements

**Table: `engagements`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `project_id` | UUID | NULL REFERENCES projects(id) | NULL for Path B |
| `expert_id` | UUID | NOT NULL REFERENCES users(id) | |
| `client_id` | UUID | NOT NULL REFERENCES users(id) | |
| `service_id` | UUID | NULL REFERENCES services(id) | NULL for Path A |
| `type` | TEXT | NOT NULL CHECK (type IN ('PROJECT_BASED','SERVICE_PURCHASE','TECH_DISCOVERY')) | Immutable after creation |
| `state` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','CONNECTED','ACTIVE','CLOSED','DISPUTED','CANCELLED')) | |
| `connected_at` | TIMESTAMPTZ | NULL | |
| `client_nda_accepted_at` | TIMESTAMPTZ | NULL | |
| `expert_nda_accepted_at` | TIMESTAMPTZ | NULL | |

---

### Section 8 — Capability Bids

**Table: `capability_bids`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `engagement_id` | UUID | NOT NULL UNIQUE REFERENCES engagements(id) | UNIQUE enforces 1:1 |
| `footprint_alignment_json` | JSONB | NULL | |
| `approach_summary` | TEXT | NULL | |
| `conditional_pricing_json` | JSONB | NULL | |
| `state` | TEXT | NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT','SUBMITTED','TECH_REVIEW','REVISION_REQUESTED','TECH_APPROVED','CEO_REVIEW','SELECTED','DECLINED','WITHDRAWN')) | |
| `tech_status` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (tech_status IN ('PENDING','APPROVED','REVISION_REQUESTED')) | |
| `ceo_status` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (ceo_status IN ('PENDING','APPROVED','DECLINED')) | |
| `tech_feedback` | TEXT | NULL | |
| `negotiated_price_vnd` | BIGINT | NULL | |
| `version_number` | INT | NOT NULL DEFAULT 1 | |

---

### Section 9 — Milestones (2-Layer)

**Table: `milestones`**

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `engagement_id` | UUID | NOT NULL REFERENCES engagements(id) ON DELETE CASCADE |
| `milestone_number` | INT | NOT NULL |
| `deliverable_statement` | TEXT | NULL |
| `sign_off_authority` | TEXT | NOT NULL CHECK (sign_off_authority IN ('TECH_TEAM','CEO','JOINT')) |
| `payment_amount_vnd` | BIGINT | NOT NULL CHECK (payment_amount_vnd >= 0) |
| `state` | TEXT | NOT NULL DEFAULT 'DEFINED' CHECK (state IN ('DEFINED','AWAITING_PAYMENT','FUNDED','IN_PROGRESS','SUBMITTED','IN_REVISION','APPROVED','RELEASED','DISPUTED')) |
| `va_number` | TEXT | NULL |
| `va_expires_at` | TIMESTAMPTZ | NULL |
| `funded_at` | TIMESTAMPTZ | NULL |
| `submitted_at` | TIMESTAMPTZ | NULL |
| `approved_at` | TIMESTAMPTZ | NULL |
| `released_at` | TIMESTAMPTZ | NULL |
| `title` | TEXT | NULL |
| `estimated_duration_days` | INT | NULL |
| `tech_stack_json` | JSONB | NOT NULL DEFAULT '[]' |
| `estimated_cost_vnd` | BIGINT | NULL |
| `is_ai_generated` | BOOLEAN | NOT NULL DEFAULT FALSE |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Unique constraint:** `(engagement_id, milestone_number)`

---

**Table: `acceptance_criteria`** *(Layer 1)*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `milestone_id` | UUID | NOT NULL REFERENCES milestones(id) ON DELETE CASCADE |
| `criterion_text` | TEXT | NOT NULL |
| `is_required` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `verified_by_role` | TEXT | NOT NULL CHECK (verified_by_role IN ('TECH_TEAM','CEO','JOINT')) |
| `verified_at` | TIMESTAMPTZ | NULL |
| `revision_note` | TEXT | NULL |

---

**Table: `milestone_dod_items`** *(Layer 2)*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `milestone_id` | UUID | NOT NULL REFERENCES milestones(id) ON DELETE CASCADE |
| `item_description` | TEXT | NOT NULL |
| `is_required` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `status` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','NOT_APPLICABLE')) |
| `completed_at` | TIMESTAMPTZ | NULL |
| `completion_note` | TEXT | NULL |
| `not_applicable_note` | TEXT | NULL |
| `maps_to_criterion_id` | UUID | NULL REFERENCES acceptance_criteria(id) |

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
| `milestone_id` | UUID | NOT NULL REFERENCES milestones(id) |
| `expert_id` | UUID | NOT NULL REFERENCES users(id) |
| `description` | TEXT | NULL |
| `files_json` | JSONB | NOT NULL DEFAULT '[]' |
| `submitted_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

---

**Table: `paygated_documents`**

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `milestone_id` | UUID | NOT NULL REFERENCES milestones(id) |
| `document_url` | TEXT | NOT NULL |
| `release_state` | TEXT | NOT NULL DEFAULT 'STAGED' CHECK (release_state IN ('STAGED','RELEASED')) |
| `staged_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `released_at` | TIMESTAMPTZ | NULL |

---

**Table: `milestone_chat_sessions`** *(NEW - E-3 Assistant)*

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `project_id` | UUID | NOT NULL REFERENCES projects(id) ON DELETE CASCADE | |
| `user_id` | UUID | NOT NULL REFERENCES users(id) | |
| `title` | TEXT | NULL | Auto-generated e.g. "Chat · 08/07/2026" |
| `messages_json` | JSONB | NOT NULL DEFAULT '[]' | `[{role:"user"|"assistant", content:"..."}]` |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

---

### Section 10 — Escrow (Dual-Parent)

**Table: `escrow_accounts`**

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `milestone_id` | UUID | NULL REFERENCES milestones(id) |
| `engagement_id` | UUID | NULL REFERENCES engagements(id) |
| `amount` | BIGINT | NOT NULL CHECK (amount > 0) |
| `client_wallet_id` | UUID | NOT NULL REFERENCES wallets(id) |
| `expert_wallet_id` | UUID | NOT NULL REFERENCES wallets(id) |
| `status` | TEXT | NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD','RELEASED','FROZEN','REFUNDED','SPLIT')) |
| `held_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `released_at` | TIMESTAMPTZ | NULL |

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

### Section 11 — Disputes

**Table: `disputes`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `engagement_id` | UUID | NOT NULL REFERENCES engagements(id) | |
| `milestone_id` | UUID | NULL REFERENCES milestones(id) | |
| `criterion_id` | UUID | NOT NULL REFERENCES acceptance_criteria(id) | |
| `escrow_account_id` | UUID | NOT NULL REFERENCES escrow_accounts(id) | |
| `filed_by` | UUID | NOT NULL REFERENCES users(id) | |
| `state` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','LAYER_1_EVAL','AUTO_RESOLVED','MANUAL_REVIEW','RESOLVED','WITHDRAWN')) | |
| `llm_confidence` | FLOAT | NULL | |
| `filed_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `resolved_at` | TIMESTAMPTZ | NULL | |
| `resolved_by` | UUID | NULL REFERENCES users(id) | Admin who resolved |

---

### Section 12 — Messaging

**Table: `messages`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | |
| `engagement_id` | UUID | NULL REFERENCES engagements(id) | NULL if pre-bid project Q&A |
| `project_id` | UUID | NULL REFERENCES projects(id) | NULL if engagement chat |
| `sender_id` | UUID | NOT NULL REFERENCES users(id) | |
| `content` | TEXT | NOT NULL | |
| `attachment_url` | TEXT | NULL | |
| `timestamp` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**Index:** `engagement_id, timestamp`

---

**Table: `message_reads`**

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

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `engagement_id` | UUID | NOT NULL REFERENCES engagements(id) |
| `reviewer_id` | UUID | NOT NULL REFERENCES users(id) |
| `target_id` | UUID | NOT NULL REFERENCES users(id) |
| `rating` | INT | NOT NULL CHECK (rating BETWEEN 1 AND 5) |
| `comment` | TEXT | NULL |
| `structured_signals_json` | JSONB | NULL |
| `reviewer_role` | TEXT | NOT NULL CHECK (reviewer_role IN ('CEO','TECH_TEAM','EXPERT')) |

**Unique constraint:** `(engagement_id, reviewer_id)`

---

**Table: `platform_decisions`**

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() |
| `decision_type` | TEXT | NOT NULL CHECK (decision_type IN ('ELICITATION_SYNTHESIS','SPEC_AUTO_RETURN','SEAM_TIER_UPGRADE','PORTFOLIO_EVAL','DISPUTE_L1_EVAL','CRITERION_QUALITY_GATE','EVIDENCE_SUBMISSION')) |
| `entity_type` | TEXT | NULL |
| `entity_id` | TEXT | NULL |
| `llm_confidence` | FLOAT | NULL |
| `decision` | TEXT | NULL |
| `advisory_note` | TEXT | NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

---

### Section 14 — Config CMS & Subscriptions

**Table: `domain_definitions`**
| `id` | UUID | PK |
| `code` | TEXT | NOT NULL UNIQUE |
| `name` | TEXT | NOT NULL |
| `description` | TEXT | NULL |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `sort_order` | INT | NOT NULL DEFAULT 0 |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

*(Seam Definitions, Archetype Definitions, Void Code Definitions follow the exact same shape)*

**Table: `probe_questions`**
| `id` | UUID | PK |
| `archetype_code` | TEXT | NOT NULL REFERENCES archetype_definitions(code) |
| `question_text` | TEXT | NOT NULL |
| `display_order` | INT | NOT NULL DEFAULT 0 |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Table: `prompt_templates`**
| `id` | UUID | PK |
| `stage` | TEXT | NOT NULL UNIQUE |
| `template_text` | TEXT | NOT NULL |
| `description` | TEXT | NULL |
| `version` | INT | NOT NULL DEFAULT 1 |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Table: `subscription_packages`**
| `id` | UUID | PK |
| `role` | TEXT | NOT NULL CHECK (role IN ('CLIENT', 'EXPERT')) |
| `name` | TEXT | NOT NULL |
| `price_vnd` | BIGINT | NOT NULL |
| `duration_months` | INT | NOT NULL |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Table: `subscription_purchase_logs`**
| `id` | UUID | PK |
| `user_id` | UUID | NOT NULL REFERENCES users(id) |
| `package_id` | UUID | NOT NULL REFERENCES subscription_packages(id) |
| `role` | TEXT | NOT NULL |
| `amount_paid_vnd` | BIGINT | NOT NULL |
| `purchased_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `expires_at` | TIMESTAMPTZ | NOT NULL |
| `payment_method` | TEXT | NOT NULL DEFAULT 'WALLET' |

---

### Section 15 — Notifications & Invitations

**Table: `notifications`**
| `id` | UUID | PK |
| `user_id` | UUID | NOT NULL REFERENCES users(id) ON DELETE CASCADE |
| `type` | TEXT | NOT NULL CHECK (type IN ('bid_update','system','milestone_update')) |
| `title` | TEXT | NOT NULL |
| `body` | TEXT | NULL |
| `link` | TEXT | NULL |
| `is_read` | BOOLEAN | NOT NULL DEFAULT FALSE |
| `read_at` | TIMESTAMPTZ | NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Table: `invitations`**
| `id` | UUID | PK |
| `project_id` | UUID | NOT NULL REFERENCES projects(id) ON DELETE CASCADE |
| `expert_id` | UUID | NOT NULL REFERENCES users(id) |
| `ceo_id` | UUID | NOT NULL REFERENCES users(id) |
| `message` | TEXT | NULL |
| `status` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','DECLINED','EXPIRED')) |
| `invited_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `responded_at` | TIMESTAMPTZ | NULL |
| `expires_at` | TIMESTAMPTZ | NULL |

**Unique constraint:** `(project_id, expert_id)`

---

### FK Dependency Order (40 tables)

```
 1.  users
 2.  client_profiles              → users
 3.  expert_profiles              → users
 4.  wallets                      → users
 5.  wallet_transactions          → wallets
 6.  virtual_accounts             → (polymorphic — standalone)
 7.  platform_settings            → wallets
 8.  elicitation_sessions         → users
 9.  projects                     → users, elicitation_sessions
10.  tech_team_profiles           → users, projects
11.  withdrawal_requests          → users, milestones (nullable)
12.  expert_domain_depths         → users
13.  expert_seam_claims           → users
14.  portfolio_submissions        → users, expert_seam_claims
15.  services                     → users
16.  engagements                  → projects, users, services
17.  capability_bids              → engagements
18.  milestones                   → engagements
19.  acceptance_criteria          → milestones
20.  milestone_dod_items          → milestones, acceptance_criteria
21.  milestone_submissions        → milestones, users
22.  paygated_documents           → milestones
23.  milestone_chat_sessions      → projects, users
24.  escrow_accounts              → milestones (nullable), engagements (nullable), wallets
25.  disputes                     → engagements, milestones, acceptance_criteria, escrow_accounts, users
26.  messages                     → engagements (nullable), projects (nullable), users
27.  message_reads                → messages, users
28.  reviews                      → engagements, users
29.  platform_decisions           → (polymorphic — standalone)
30.  domain_definitions           → (standalone CMS)
31.  seam_definitions             → (standalone CMS)
32.  archetype_definitions        → (standalone CMS)
33.  probe_questions              → archetype_definitions
34.  void_code_definitions        → (standalone CMS)
35.  prompt_templates             → (standalone CMS)
36.  subscription_packages        → (standalone CMS)
37.  subscription_purchase_logs   → users, subscription_packages
38.  notifications                → users
39.  invitations                  → projects, users
40.  project_shortlist_cache      → projects
```

---

## Conceptual ER — Unified Draw Plan (MVP · 40 Tables)

---

### Entities to Draw — 40 Total

`users` · `client_profiles` · `expert_profiles` · `tech_team_profiles` · `wallets` · `wallet_transactions` · `virtual_accounts` · `platform_settings` · `elicitation_sessions` · `projects` · `project_shortlist_cache` · `services` · `expert_domain_depths` · `expert_seam_claims` · `portfolio_submissions` · `engagements` · `capability_bids` · `milestones` · `acceptance_criteria` · `milestone_dod_items` · `milestone_submissions` · `paygated_documents` · `milestone_chat_sessions` · `escrow_accounts` · `disputes` · `messages` · `message_reads` · `reviews` · `platform_decisions` · `domain_definitions` · `seam_definitions` · `archetype_definitions` · `probe_questions` · `void_code_definitions` · `prompt_templates` · `subscription_packages` · `subscription_purchase_logs` · `notifications` · `invitations`

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

---

### Phase 2 — Expert Capability (2-Tier System)

All branch from `users` (expert scope).
- `users` (diamond) `has` ➔ `expert_domain_depths` **(1:N)**
- `users` (diamond) `holds` ➔ `expert_seam_claims` **(1:N)**
- `users` (diamond) `submits` ➔ `portfolio_submissions` **(1:N)**
- `portfolio_submissions` (diamond) `upgrades` ➔ `expert_seam_claims` **(N:1)** — via `seam_claim_id`

---

### Phase 3 — Wallet, Finance & Platform Settings

Draw `wallets` beside `users`. Draw `platform_settings` as a singleton near the wallet cluster.
- `users` (diamond) `owns` ➔ `wallets` **(1:1)**
- `wallets` (diamond) `records` ➔ `wallet_transactions` **(1:N)**
- `users` (diamond) `requests` ➔ `withdrawal_requests` **(1:N)**
- `platform_settings` (diamond) `references` ➔ `wallets` **(1:1)** — annotate: *"singleton — seeded at deploy"*

---

### Phase 4 — Projects (JSONB Hub)

Draw `projects` as the primary hub.
- `users` (diamond) `creates` ➔ `projects` **(1:N)** — CEO only
- `elicitation_sessions` (diamond) `produces` ➔ `projects` **(1:1)**
- `projects` (diamond) `scopes` ➔ `tech_team_profiles` **(1:N)**
- `projects` (diamond) `has` ➔ `project_shortlist_cache` **(1:1)**
- `projects` (diamond) `has` ➔ `milestone_chat_sessions` **(1:N)**
- `projects` (diamond) `has` ➔ `invitations` **(1:N)**

Draw the Artifact B access gate annotation on the `projects` entity: *"artifact_b_json route-gated: state ≥ CONNECTED + NDA accepted + CEO excluded"*.

---

### Phase 5 — Services (Path B)

- `users` (expert) (diamond) `creates` ➔ `services` **(1:N)**

---

### Phase 6 — Engagements & Bids

Draw `engagements` as the secondary hub.
- `projects` (diamond) `has` ➔ `engagements` **(1:N)** — Path A
- `services` (diamond) `generates` ➔ `engagements` **(1:N)** — Path B
- `users` (expert) (diamond) `joins` ➔ `engagements` **(1:N)**
- `users` (client) (diamond) `initiates` ➔ `engagements` **(1:N)**

Draw `capability_bids`:
- `engagements` (diamond) `has` ➔ `capability_bids` **(1:1)**

---

### Phase 7 — Milestones (2-Layer)

Draw `milestones` from `engagements`.

**Engagement → Milestones:**
- `engagements` (diamond) `has` ➔ `milestones` **(1:N)**
- `milestones` (diamond) `allocates` ➔ `virtual_accounts` **(1:N)**
- `milestones` (diamond) `triggers` ➔ `withdrawal_requests` **(1:N)**

**Layer 1 — Acceptance Criteria:**
- `milestones` (diamond) `has` ➔ `acceptance_criteria` **(1:N)**
- `acceptance_criteria` (diamond) `evaluation logged in` ➔ `platform_decisions` **(1:1)**

**Layer 2 — DoD Checklist:**
- `milestones` (diamond) `has` ➔ `milestone_dod_items` **(1:N)**
- `milestone_dod_items` (diamond) `maps to` ➔ `acceptance_criteria` **(N:1)**

**Deliverables & Pay-gated Documents:**
- `milestones` (diamond) `has` ➔ `milestone_submissions` **(1:N)**
- `users` (diamond) `submits` ➔ `milestone_submissions` **(1:N)**
- `milestones` (diamond) `triggers release of` ➔ `paygated_documents` **(1:N)**

**Escrow (dual-parent paths):**
- `milestones` (diamond) `held in` ➔ `escrow_accounts` **(1:1)** — Path A
- `engagements` (diamond) `holds escrow for` ➔ `escrow_accounts` **(1:1)** — Path B
- `wallets` (diamond) `funds` ➔ `escrow_accounts` **(1:N)**
- `wallets` (diamond) `receives from` ➔ `escrow_accounts` **(1:N)**

**Disputes (2-Layer):**
- `engagements` (diamond) `has` ➔ `disputes` **(1:N)**
- `milestones` (diamond) `has` ➔ `disputes` **(1:N)**
- `acceptance_criteria` (diamond) `subject of` ➔ `disputes` **(1:N)**
- `escrow_accounts` (diamond) `frozen by` ➔ `disputes` **(1:1)**
- `users` (diamond) `files` ➔ `disputes` **(1:N)**
- `users` (diamond) `resolves` ➔ `disputes` **(1:N)** — via `resolved_by`

---

### Phase 8 — Messaging, Reviews & Audit

**Messaging:**
- `engagements` (diamond) `has` ➔ `messages` **(1:N)**
- `projects` (diamond) `has` ➔ `messages` **(1:N)** — Pre-bid Q&A
- `users` (diamond) `sends` ➔ `messages` **(1:N)**
- `messages` (diamond) `has` ➔ `message_reads` **(1:N)**
- `users` (diamond) `reads` ➔ `message_reads` **(1:N)**

**Reviews:**
- `engagements` (diamond) `has` ➔ `reviews` **(1:N)**
- `users` (diamond) `writes` ➔ `reviews` **(1:N)**
- `users` (diamond) `reviewed as` ➔ `reviews` **(1:N)**

**Platform Decisions:**
`platform_decisions` is a standalone entity. No FK lines — `entity_id` is polymorphic.

---

### Phase 9 — CMS & Config Tables (Standalone Cluster)

Draw these as a standalone cluster near the edge of the diagram. They have no FKs to the core transactional tables (referenced dynamically in code).

- `domain_definitions`
- `seam_definitions`
- `archetype_definitions`
- `probe_questions` (diamond) `belongs to` ➔ `archetype_definitions` **(N:1)**
- `void_code_definitions`
- `prompt_templates`
- `subscription_packages` (diamond) `logs` ➔ `subscription_purchase_logs` **(1:N)**
- `subscription_purchase_logs` (diamond) `belongs to` ➔ `users` **(N:1)**

---

### Phase 10 — Platform Notifications

- `users` (diamond) `receives` ➔ `notifications` **(1:N)**
- `users` (expert) (diamond) `receives` ➔ `invitations` **(1:N)**
- `users` (client) (diamond) `sends` ➔ `invitations` **(1:N)**
- `projects` (diamond) `has` ➔ `invitations` **(1:N)**

---

### Final Count

| Phase | Entities | Relationships |
|---|---|---|
| 0 — Elicitation | 1 | 1 |
| 1 — Users & Subtypes | 4 | 4 |
| 2 — Expert Capability | 3 | 4 |
| 3 — Wallet & Finance | 4 | 4 |
| 4 — Projects Hub | 3 | 5 |
| 5 — Services | 1 | 1 |
| 6 — Engagements & Bids | 2 | 4 |
| 7 — Milestones, Escrow, Disputes | 10 | 18 |
| 8 — Messaging, Reviews, Audit | 4 | 7 |
| 9 — CMS & Config | 8 | 2 |
| 10 — Notifications & Invitations | 2 | 4 |
| **Total** | **40** | **54** |