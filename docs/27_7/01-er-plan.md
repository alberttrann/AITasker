# Physical ER Plan — AITasker MVP (PostgreSQL · 40 Tables)

### Global Conventions

- **All PKs:** `UUID NOT NULL DEFAULT gen_random_uuid()` (unless 1:1 user extension using `user_id` as PK)
- **All timestamps:** `TIMESTAMPTZ` (UTC)
- **All money:** `BIGINT` (VND integer — no floating-point arithmetic)
- **All JSON:** `JSONB`
- **Enums:** `TEXT` with application-level or database `CHECK` constraints
- **Extension:** `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`
- **Deletions:** `ON DELETE CASCADE` used only for strict 1:1 children (profiles), cached shortlist, message reads, notification rows, project-linked invitations, chat sessions, and composite child entities (`acceptance_criteria`, `milestone_dod_items`, `milestones`). All other FKs use `RESTRICT` (default) to preserve audit and ledger integrity.

---

### Section 1 — Users & Role Profiles

**Table: `users`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Central user ID |
| `email` | TEXT | NOT NULL UNIQUE | User primary email |
| `password_hash` | TEXT | NOT NULL | Bcrypt password hash |
| `full_name` | TEXT | NOT NULL | Display name |
| `phone` | TEXT | NULL | Optional contact phone |
| `roles` | JSONB | NOT NULL DEFAULT '[]' | e.g. `["CLIENT_CEO", "EXPERT"]` |
| `active_role` | TEXT | NOT NULL DEFAULT 'CLIENT' CHECK (active_role IN ('CLIENT','EXPERT','ADMIN')) | Active context cursor |
| `client_subtype` | TEXT | NULL CHECK (client_subtype IN ('CEO','TECH_TEAM')) | Subtype when active_role = CLIENT |
| `subscription_client_tier` | TEXT | NOT NULL DEFAULT 'free' CHECK (subscription_client_tier IN ('free','pro')) | CEO subscription tier |
| `subscription_expert_tier` | TEXT | NOT NULL DEFAULT 'free' CHECK (subscription_expert_tier IN ('free','pro')) | Expert subscription tier |
| `sub_client_expires_at` | TIMESTAMPTZ | NULL | Client Pro expiry |
| `sub_expert_expires_at` | TIMESTAMPTZ | NULL | Expert Pro expiry |
| `sepay_bank_account_xid` | TEXT | NULL | Linked bank account ID for payout |
| `bank_account_holder_name` | TEXT | NULL | Registered bank holder name |
| `bank_linked_at` | TIMESTAMPTZ | NULL | Timestamp bank account linked |
| `self_technical` | BOOLEAN | NOT NULL DEFAULT FALSE | Self-managed technical flag |
| `self_technical_projects` | JSONB | NOT NULL DEFAULT '[]' | Per-session technical override flags |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE | False when suspended by admin |
| `password_reset_token` | TEXT | NULL | Cryptographic 32-byte reset token |
| `password_reset_token_expires_at`| TIMESTAMPTZ | NULL | Token expiry (1 hour) |
| `is_email_verified` | BOOLEAN | NOT NULL DEFAULT FALSE | True once registration OTP submitted |
| `email_otp` | TEXT | NULL | 6-digit numeric OTP code |
| `email_otp_expires_at` | TIMESTAMPTZ | NULL | OTP validity window (15 mins) |
| `refresh_token_hash` | TEXT | NULL | SHA-256 hash of current refresh token |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Account registration timestamp |

**Indexes:** `email` (unique), `active_role`

---

**Table: `client_profiles`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `user_id` | UUID | PK NOT NULL REFERENCES users(id) ON DELETE CASCADE | 1:1 user profile extension |
| `company_name` | TEXT | NULL | Client business name |
| `industry` | TEXT | NULL | Business sector |
| `ceo_name` | TEXT | NULL | Designated executive contact |

---

**Table: `expert_profiles`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `user_id` | UUID | PK NOT NULL REFERENCES users(id) ON DELETE CASCADE | 1:1 user profile extension |
| `bio` | TEXT | NULL | Expert professional summary |
| `engagement_model` | TEXT | NULL CHECK (engagement_model IN ('MILESTONE','HOURLY','HYBRID')) | Preferred work structure |
| `stack_tags_json` | JSONB | NOT NULL DEFAULT '[]' | Technology stack tags e.g. `["Python","Kafka","Go"]` |
| `archetype_history_json` | JSONB | NOT NULL DEFAULT '[]' | Historical archetype experience |

---

**Table: `tech_team_profiles`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `user_id` | UUID | PK NOT NULL REFERENCES users(id) ON DELETE CASCADE | 1:1 user profile extension |
| `linked_client_id` | UUID | NOT NULL REFERENCES users(id) | CEO who issued the handoff link |
| `linked_project_id` | UUID | NULL REFERENCES projects(id) | Scoped project assigned during handoff |
| `role_title` | TEXT | NULL | Technical lead / architect title |

**Index:** `linked_project_id`

---

### Section 2 — Wallet & Finance

**Table: `wallets`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Wallet identifier |
| `user_id` | UUID | NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE | Owner user account |
| `available_balance` | BIGINT | NOT NULL DEFAULT 0 CHECK (available_balance >= 0) | Spendable / withdrawable VND |
| `locked_balance` | BIGINT | NOT NULL DEFAULT 0 CHECK (locked_balance >= 0) | Escrowed VND |

---

**Table: `wallet_transactions`** *(immutable ledger)*

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Transaction ledger ID |
| `wallet_id` | UUID | NOT NULL REFERENCES wallets(id) | Target wallet |
| `amount` | BIGINT | NOT NULL CHECK (amount > 0) | Always positive VND integer |
| `transaction_type` | TEXT | NOT NULL CHECK (transaction_type IN ('TOP_UP','SUBSCRIPTION','ESCROW_LOCK','ESCROW_RELEASE','PLATFORM_FEE','ESCROW_REFUND','ESCROW_SPLIT','WITHDRAWAL','WITHDRAWAL_REFUND')) | Ledger transaction type |
| `reference_id` | TEXT | NULL | Originating entity reference |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Ledger entry timestamp |

**Indexes:** `wallet_id`, `transaction_type`, `created_at DESC`

---

**Table: `virtual_accounts`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Virtual account ID |
| `entity_type` | TEXT | NOT NULL CHECK (entity_type IN ('WALLET_TOPUP','MILESTONE','SERVICE','SUBSCRIPTION')) | Beneficiary entity type |
| `entity_id` | TEXT | NOT NULL | Polymorphic ID (`user_id`, `milestone_id`, `engagement_id`) |
| `va_number` | TEXT | NOT NULL UNIQUE | SePay-issued bank transfer code |
| `fixed_amount` | BIGINT | NULL | Expected exact transfer amount in VND |
| `expires_at` | TIMESTAMPTZ | NULL | 24-hour expiration for milestone VAs |
| `status` | TEXT | NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXPIRED','USED')) | Account availability |

**Indexes:** `(entity_type, entity_id)`, `status`

---

**Table: `withdrawal_requests`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Request ID |
| `expert_id` | UUID | NOT NULL REFERENCES users(id) | Beneficiary expert |
| `type` | TEXT | NOT NULL CHECK (type IN ('MILESTONE_RELEASE','EXPERT_MANUAL')) | Automatic vs manual request |
| `amount` | BIGINT | NOT NULL CHECK (amount > 0) | Requested payout amount in VND |
| `bank_account_xid` | TEXT | NOT NULL | Target bank account ID |
| `disbursement_id` | TEXT | NULL | External payout reference ID |
| `status` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED')) | Payout status |
| `requested_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Submission timestamp |
| `confirmed_at` | TIMESTAMPTZ | NULL | Disbursement confirmation time |
| `milestone_id` | UUID | NULL REFERENCES milestones(id) | Set for auto milestone release payouts |

**Indexes:** `expert_id`, `status`

---

**Table: `platform_settings`** *(singleton)*

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Singleton row ID |
| `platform_wallet_id` | UUID | NULL UNIQUE REFERENCES wallets(id) | Wallet receiving platform fees |
| `platform_fee_pct` | FLOAT | NOT NULL DEFAULT 0.05 CHECK (platform_fee_pct BETWEEN 0 AND 1) | Platform fee percentage (0.00–1.00) |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Configuration update time |

---

### Section 3 — Elicitation Engine

**Table: `elicitation_sessions`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Elicitation session ID |
| `user_id` | UUID | NOT NULL REFERENCES users(id) | Owning CEO user |
| `current_stage` | INT | NOT NULL DEFAULT 1 CHECK (current_stage BETWEEN 1 AND 5) | Active stage index |
| `archetype` | TEXT | NULL | Selected project archetype code |
| `scenario_type` | TEXT | NULL | SCENARIO_A or SCENARIO_B |
| `void_list_json` | JSONB | NOT NULL DEFAULT '[]' | Detected void items and acknowledgment status |
| `stage1_symptoms_json` | JSONB | NULL | Extracted symptom strings |
| `stage3_probes_json` | JSONB | NULL | Probe question/answer map |
| `stage4_tech_inputs_json` | JSONB | NULL | Technical stack and inputs |
| `state` | TEXT | NOT NULL DEFAULT 'IN_PROGRESS' CHECK (state IN ('IN_PROGRESS','COMPLETED','ABANDONED','RETURNED')) | Session lifecycle state |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Session start timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Last interaction timestamp |
| `handoff_token_jti` | TEXT | NULL | Single-use handoff token identifier |
| `handoff_consumed_at` | TIMESTAMPTZ | NULL | Handoff link consumption timestamp |
| `recommended_archetypes_json` | JSONB | NULL | Top recommended archetype codes |
| `symptom_text_draft` | TEXT | NULL | Stage 1 free-text draft |
| `stage1_original_input` | TEXT | NULL | Immutable copy of initial input |
| `stage4_draft_json` | JSONB | NULL | Stage 4 technical autosave draft |
| `estimated_budget_vnd` | BIGINT | NULL | Target project budget in VND |
| `critical_artifacts_json` | JSONB | NULL | Required technical artifacts list |

**Indexes:** `user_id`, `state`

---

### Section 4 — Projects & Shortlists

**Table: `projects`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Project identifier |
| `client_id` | UUID | NOT NULL REFERENCES users(id) | Owning CEO |
| `elicitation_session_id` | UUID | NULL UNIQUE REFERENCES elicitation_sessions(id) | Originating elicitation session |
| `project_name` | TEXT | NULL | Human-readable title |
| `state` | TEXT | NOT NULL DEFAULT 'PUBLISHED' CHECK (state IN ('DRAFT','PUBLISHED','RETURNED_TO_CLIENT','SUSPENDED')) | Project lifecycle state |
| `archetype` | TEXT | NULL | Project archetype code |
| `tier` | TEXT | NULL CHECK (tier IN ('TIER_1','TIER_2','TIER_3')) | Volume tier classification |
| `self_technical` | BOOLEAN | NOT NULL DEFAULT FALSE | True if self-managed technical context |
| `required_seams_json` | JSONB | NOT NULL DEFAULT '[]' | Required seam codes and criticality |
| `required_domains_json` | JSONB | NOT NULL DEFAULT '[]' | Required domain codes and depth |
| `milestone_framework_json` | JSONB | NOT NULL DEFAULT '[]' | Synthesized milestone template |
| `artifact_a_json` | JSONB | NULL | Business intent spec (public to candidates) |
| `artifact_b_json` | JSONB | NULL | Technical spec (gated post-connection) |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Publication timestamp |
| `estimated_total_cost_vnd` | BIGINT | NULL | Estimated total cost in VND |
| `estimated_total_duration_days` | INT | NULL | Estimated duration in days |

**Indexes:** `client_id`, `state`

---

**Table: `project_shortlist_cache`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Cache row ID |
| `project_id` | UUID | NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE | Target project |
| `results_json` | JSONB | NOT NULL DEFAULT '[]' | Array of scored matching expert records |
| `generated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Shortlist calculation timestamp |
| `source` | TEXT | NOT NULL DEFAULT 'AUTO' CHECK (source IN ('AUTO','FORCE_REFRESH')) | Trigger source |

---

### Section 5 — Services

**Table: `services`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Service listing ID |
| `expert_id` | UUID | NOT NULL REFERENCES users(id) ON DELETE CASCADE | Owning expert |
| `title` | TEXT | NOT NULL | Service title |
| `description` | TEXT | NULL | Detailed service description |
| `domains_json` | JSONB | NOT NULL DEFAULT '[]' | Covered domain codes |
| `seams_json` | JSONB | NOT NULL DEFAULT '[]' | Covered seam codes |
| `price_vnd` | BIGINT | NOT NULL CHECK (price_vnd > 0) | Fixed service price in VND |
| `state` | TEXT | NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT','PUBLISHED','SUSPENDED')) | Listing publication state |
| `service_type` | TEXT | NOT NULL CHECK (service_type IN ('AI_SERVICE','TECH_DISCOVERY')) | Product classification |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Creation timestamp |
| `scope` | TEXT | NULL | Deliverables scope description |
| `timeline` | TEXT | NULL | Phase-by-phase execution timeline |

**Indexes:** `expert_id`, `state`, `service_type`, `created_at DESC`

---

### Section 6 — Expert Capability & Verification

**Table: `expert_domain_depths`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Record ID |
| `expert_id` | UUID | NOT NULL REFERENCES users(id) ON DELETE CASCADE | Expert user |
| `domain_code` | TEXT | NOT NULL | Target domain code |
| `depth_level` | TEXT | NOT NULL CHECK (depth_level IN ('SURFACE','OPERATIONAL','DEEP')) | Declared domain depth |
| `verification_tier` | TEXT | NOT NULL DEFAULT 'CLAIMED' CHECK (verification_tier IN ('CLAIMED','EVIDENCE_BACKED')) | Verification tier |

**Unique constraint:** `(expert_id, domain_code)`  
**Index:** `expert_id`

---

**Table: `expert_seam_claims`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Claim ID |
| `expert_id` | UUID | NOT NULL REFERENCES users(id) ON DELETE CASCADE | Expert user |
| `seam_code` | TEXT | NOT NULL | Seam boundary code (e.g. `A↔C`) |
| `verification_tier` | TEXT | NOT NULL DEFAULT 'CLAIMED' CHECK (verification_tier IN ('CLAIMED','EVIDENCE_BACKED')) | Verification status |
| `submission_count` | INT | NOT NULL DEFAULT 0 | Failed verification attempt count |
| `locked_until` | TIMESTAMPTZ | NULL | 30-day lockout expiry timestamp |

**Unique constraint:** `(expert_id, seam_code)`  
**Index:** `expert_id`

---

**Table: `portfolio_submissions`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Submission ID |
| `expert_id` | UUID | NOT NULL REFERENCES users(id) | Submitting expert |
| `seam_claim_id` | UUID | NOT NULL REFERENCES expert_seam_claims(id) | Target seam claim |
| `project_description` | TEXT | NOT NULL | Project context text |
| `decision_points` | TEXT | NOT NULL | Key technical decisions at seam boundary |
| `status` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')) | Evaluation status |
| `llm_confidence` | FLOAT | NULL | AI evaluation confidence score (0.00–1.00) |
| `submitted_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Submission timestamp |
| `evaluated_at` | TIMESTAMPTZ | NULL | Evaluation completion time |

**Indexes:** `expert_id`, `seam_claim_id`

---

### Section 7 — Engagements

**Table: `engagements`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Engagement ID |
| `project_id` | UUID | NULL REFERENCES projects(id) | Nullable for service purchases |
| `expert_id` | UUID | NOT NULL REFERENCES users(id) | Assigned expert |
| `client_id` | UUID | NOT NULL REFERENCES users(id) | Owning client |
| `service_id` | UUID | NULL REFERENCES services(id) | Set for Path B service purchases |
| `type` | TEXT | NOT NULL CHECK (type IN ('PROJECT_BASED','SERVICE_PURCHASE','TECH_DISCOVERY')) | Immutable engagement path |
| `state` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','CONNECTED','ACTIVE','CLOSED','DISPUTED','DECLINED','CANCELLED')) | Engagement lifecycle state |
| `connected_at` | TIMESTAMPTZ | NULL | Timestamp both NDAs accepted |
| `client_nda_accepted_at` | TIMESTAMPTZ | NULL | Client NDA signature timestamp |
| `expert_nda_accepted_at` | TIMESTAMPTZ | NULL | Expert NDA signature timestamp |

**Indexes:** `project_id`, `expert_id`, `client_id`, `service_id`, `state`

---

### Section 8 — Capability Bids

**Table: `capability_bids`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Bid ID |
| `engagement_id` | UUID | NOT NULL UNIQUE REFERENCES engagements(id) | 1:1 relation to engagement |
| `footprint_alignment_json` | JSONB | NULL | Declared domain and seam alignment |
| `approach_summary` | TEXT | NULL | Proposed technical approach |
| `conditional_pricing_json` | JSONB | NULL | Offer history / negotiation envelope |
| `state` | TEXT | NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT','SUBMITTED','TECH_REVIEW','REVISION_REQUESTED','TECH_APPROVED','CEO_REVIEW','SELECTED','DECLINED','WITHDRAWN')) | Bid proposal state |
| `tech_status` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (tech_status IN ('PENDING','APPROVED','REVISION_REQUESTED')) | Tech team evaluation status |
| `ceo_status` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (ceo_status IN ('PENDING','APPROVED','DECLINED')) | CEO evaluation status |
| `tech_feedback` | TEXT | NULL | Technical revision feedback notes |
| `negotiated_price_vnd` | BIGINT | NULL | Total negotiated contract price in VND |
| `version_number` | INT | NOT NULL DEFAULT 1 | Offer iteration version counter |

**Indexes:** `tech_status`, `ceo_status`

---

### Section 9 — Milestones, Submissions & Chat

**Table: `milestones`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Milestone ID |
| `engagement_id` | UUID | NOT NULL REFERENCES engagements(id) ON DELETE CASCADE | Parent engagement |
| `milestone_number` | INT | NOT NULL | Sequential milestone index (1, 2, 3...) |
| `deliverable_statement` | TEXT | NULL | Clear deliverable statement |
| `sign_off_authority` | TEXT | NOT NULL CHECK (sign_off_authority IN ('TECH_TEAM','CEO','JOINT')) | Required review authority |
| `payment_amount_vnd` | BIGINT | NOT NULL CHECK (payment_amount_vnd >= 0) | Escrow payout value in VND |
| `state` | TEXT | NOT NULL DEFAULT 'DEFINED' CHECK (state IN ('DEFINED','AWAITING_PAYMENT','FUNDED','IN_PROGRESS','SUBMITTED','IN_REVISION','APPROVED','RELEASED','DISPUTED')) | Milestone state |
| `va_number` | TEXT | NULL | Virtual account number for funding |
| `va_expires_at` | TIMESTAMPTZ | NULL | Virtual account expiration time |
| `funded_at` | TIMESTAMPTZ | NULL | Escrow lock timestamp |
| `submitted_at` | TIMESTAMPTZ | NULL | Deliverable submission timestamp |
| `approved_at` | TIMESTAMPTZ | NULL | Sign-off approval timestamp |
| `released_at` | TIMESTAMPTZ | NULL | Escrow release timestamp |
| `title` | TEXT | NULL | Milestone title |
| `estimated_duration_days` | INT | NULL | Estimated delivery duration in days |
| `tech_stack_json` | JSONB | NOT NULL DEFAULT '[]' | Technologies used for milestone |
| `estimated_cost_vnd` | BIGINT | NULL | Initial estimated cost in VND |
| `is_ai_generated` | BOOLEAN | NOT NULL DEFAULT FALSE | True if generated during elicitation |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Last update timestamp |

**Unique constraint:** `(engagement_id, milestone_number)`  
**Indexes:** `engagement_id`, `state`

---

**Table: `acceptance_criteria`** *(Layer 1)*

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Criterion ID |
| `milestone_id` | UUID | NOT NULL REFERENCES milestones(id) ON DELETE CASCADE | Parent milestone |
| `criterion_text` | TEXT | NOT NULL | Measurable acceptance requirement |
| `is_required` | BOOLEAN | NOT NULL DEFAULT TRUE | Mandatory sign-off flag |
| `verified_by_role` | TEXT | NOT NULL CHECK (verified_by_role IN ('TECH_TEAM','CEO','JOINT')) | Verifying role authority |
| `verified_at` | TIMESTAMPTZ | NULL | General verification timestamp |
| `tech_verified_at` | TIMESTAMPTZ | NULL | Tech Team verification timestamp |
| `ceo_verified_at` | TIMESTAMPTZ | NULL | CEO verification timestamp |
| `revision_note` | TEXT | NULL | Feedback note when revision requested |
| `revision_requested_by_role` | TEXT | NULL CHECK (revision_requested_by_role IN ('TECH_TEAM','CEO')) | Role that requested revision |

**Index:** `milestone_id`

---

**Table: `milestone_dod_items`** *(Layer 2)*

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Item ID |
| `milestone_id` | UUID | NOT NULL REFERENCES milestones(id) ON DELETE CASCADE | Parent milestone |
| `item_description` | TEXT | NOT NULL | DoD checklist task description |
| `is_required` | BOOLEAN | NOT NULL DEFAULT TRUE | Mandatory completion flag |
| `status` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','NOT_APPLICABLE')) | Item status |
| `completed_at` | TIMESTAMPTZ | NULL | Completion timestamp |
| `completion_note` | TEXT | NULL | Expert completion note |
| `not_applicable_note` | TEXT | NULL | Explanation if marked NOT_APPLICABLE |
| `maps_to_criterion_id` | UUID | NULL REFERENCES acceptance_criteria(id) | Optional link to Layer 1 criterion |

**Index:** `milestone_id`

---

**Table: `milestone_submissions`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Submission ID |
| `milestone_id` | UUID | NOT NULL REFERENCES milestones(id) | Target milestone |
| `expert_id` | UUID | NOT NULL REFERENCES users(id) | Submitting expert |
| `description` | TEXT | NULL | Summary of submitted work |
| `files_json` | JSONB | NOT NULL DEFAULT '[]' | Array of file/link URLs |
| `submitted_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Submission timestamp |

**Indexes:** `milestone_id`, `expert_id`

---

**Table: `paygated_documents`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Document ID |
| `milestone_id` | UUID | NOT NULL REFERENCES milestones(id) | Target milestone |
| `document_url` | TEXT | NOT NULL | Document location URL |
| `release_state` | TEXT | NOT NULL DEFAULT 'STAGED' CHECK (release_state IN ('STAGED','RELEASED')) | Document release status |
| `staged_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Staging timestamp |
| `released_at` | TIMESTAMPTZ | NULL | Release timestamp (upon escrow lock) |

**Indexes:** `milestone_id`, `(milestone_id, release_state)`

---

**Table: `milestone_chat_sessions`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Chat session ID |
| `project_id` | UUID | NOT NULL REFERENCES projects(id) ON DELETE CASCADE | Target project |
| `user_id` | UUID | NOT NULL REFERENCES users(id) | Participating user |
| `title` | TEXT | NULL | Auto-generated title |
| `messages_json` | JSONB | NOT NULL DEFAULT '[]' | Turn-by-turn history array |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Last interaction timestamp |

**Indexes:** `project_id`, `user_id`

---

### Section 10 — Escrow & Disputes

**Table: `escrow_accounts`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Escrow account ID |
| `milestone_id` | UUID | NULL REFERENCES milestones(id) | Milestone parent (Path A) |
| `engagement_id` | UUID | NULL REFERENCES engagements(id) | Engagement parent (Path B/C) |
| `amount` | BIGINT | NOT NULL CHECK (amount > 0) | Escrowed funds in VND |
| `client_wallet_id` | UUID | NOT NULL REFERENCES wallets(id) | Source client wallet |
| `expert_wallet_id` | UUID | NOT NULL REFERENCES wallets(id) | Destination expert wallet |
| `status` | TEXT | NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD','RELEASED','FROZEN','REFUNDED','SPLIT')) | Escrow account status |
| `held_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Lock timestamp |
| `released_at` | TIMESTAMPTZ | NULL | Settlement / release timestamp |

**Indexes:** `status`, `client_wallet_id`, `expert_wallet_id`

---

**Table: `disputes`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Dispute ID |
| `engagement_id` | UUID | NOT NULL REFERENCES engagements(id) | Associated engagement |
| `milestone_id` | UUID | NULL REFERENCES milestones(id) | Target milestone |
| `criterion_id` | UUID | NOT NULL REFERENCES acceptance_criteria(id) | Disputed criterion |
| `escrow_account_id` | UUID | NOT NULL REFERENCES escrow_accounts(id) | Target frozen escrow |
| `filed_by` | UUID | NOT NULL REFERENCES users(id) | Filer user ID |
| `state` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','LAYER_1_EVAL','AUTO_RESOLVED','MANUAL_REVIEW','RESOLVED')) | Dispute arbitration state |
| `llm_confidence` | FLOAT | NULL | AI evaluation confidence score |
| `resolution` | TEXT | NULL CHECK (resolution IN ('EXPERT_WINS','CLIENT_WINS','SPLIT')) | Settlement decision |
| `llm_reasoning` | TEXT | NULL | AI evaluation explanation |
| `filed_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Filing timestamp |
| `resolved_at` | TIMESTAMPTZ | NULL | Resolution completion timestamp |
| `resolved_by` | UUID | NULL REFERENCES users(id) | Admin user ID if manually resolved |

**Indexes:** `engagement_id`, `state`, `escrow_account_id`

---

### Section 11 — Messaging & Reviews

**Table: `messages`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Message ID |
| `engagement_id` | UUID | NULL REFERENCES engagements(id) | Engagement channel context |
| `project_id` | UUID | NULL REFERENCES projects(id) | Pre-bid project Q&A channel |
| `sender_id` | UUID | NOT NULL REFERENCES users(id) | Message author |
| `content` | TEXT | NOT NULL | Message text body |
| `attachment_url` | TEXT | NULL | Optional file attachment link |
| `timestamp` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Message timestamp |

**Indexes:** `(engagement_id, timestamp ASC)`, `sender_id`

---

**Table: `message_reads`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Read receipt ID |
| `message_id` | UUID | NOT NULL REFERENCES messages(id) ON DELETE CASCADE | Message read |
| `user_id` | UUID | NOT NULL REFERENCES users(id) | Reader user ID |
| `read_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Read timestamp |

**Unique constraint:** `(message_id, user_id)`  
**Indexes:** `message_id`, `user_id`

---

**Table: `reviews`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Review ID |
| `engagement_id` | UUID | NOT NULL REFERENCES engagements(id) | Completed engagement |
| `reviewer_id` | UUID | NOT NULL REFERENCES users(id) | Review author |
| `target_id` | UUID | NOT NULL REFERENCES users(id) | Review subject |
| `rating` | INT | NOT NULL CHECK (rating BETWEEN 1 AND 5) | Integer star rating (1–5) |
| `comment` | TEXT | NULL | Review text commentary |
| `structured_signals_json` | JSONB | NULL | Tech Team detailed evaluation JSON |
| `reviewer_role` | TEXT | NOT NULL CHECK (reviewer_role IN ('CEO','TECH_TEAM','EXPERT')) | Author role context |

**Unique constraint:** `(engagement_id, reviewer_id)`  
**Indexes:** `engagement_id`, `reviewer_id`, `target_id`

---

### Section 12 — Notifications & Platform Audit

**Table: `notifications`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Notification ID |
| `user_id` | UUID | NOT NULL REFERENCES users(id) ON DELETE CASCADE | Recipient user |
| `type` | TEXT | NOT NULL | Notification type string |
| `title` | TEXT | NOT NULL | Short notification headline |
| `body` | TEXT | NULL | Detailed body message |
| `link` | TEXT | NULL | Role-resolved in-app navigation URL |
| `is_read` | BOOLEAN | NOT NULL DEFAULT FALSE | Read state flag |
| `read_at` | TIMESTAMPTZ | NULL | Read timestamp |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Creation timestamp |

**Indexes:** `(user_id, is_read)`, `(user_id, created_at DESC)`

---

**Table: `invitations`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Invitation ID |
| `project_id` | UUID | NOT NULL REFERENCES projects(id) ON DELETE CASCADE | Target project |
| `expert_id` | UUID | NOT NULL REFERENCES users(id) | Invited expert |
| `ceo_id` | UUID | NOT NULL REFERENCES users(id) | Inviting CEO |
| `message` | TEXT | NULL | Personal invitation message |
| `status` | TEXT | NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','DECLINED','EXPIRED')) | Invitation status |
| `invited_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Dispatch timestamp |
| `responded_at` | TIMESTAMPTZ | NULL | Response timestamp |
| `expires_at` | TIMESTAMPTZ | NULL | Expiration timestamp (7 days) |

**Unique constraint:** `(project_id, expert_id)`  
**Indexes:** `expert_id`, `project_id`

---

**Table: `platform_decisions`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Decision ID |
| `decision_type` | TEXT | NOT NULL CHECK (decision_type IN ('ELICITATION_SYNTHESIS','SPEC_AUTO_RETURN','SEAM_TIER_UPGRADE','PORTFOLIO_EVAL','DISPUTE_L1_EVAL','CRITERION_QUALITY_GATE')) | Decision classification |
| `entity_type` | TEXT | NULL | Subject entity type |
| `entity_id` | TEXT | NULL | Subject entity ID |
| `llm_confidence` | FLOAT | NULL | AI confidence score |
| `decision` | TEXT | NULL | Outcome classification string |
| `advisory_note` | TEXT | NULL | Detailed AI reasoning note |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Decision timestamp |

**Indexes:** `decision_type`, `created_at DESC`, `(entity_type, entity_id)`

---

### Section 13 — Config CMS & Subscriptions

**Table: `domain_definitions`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Domain definition ID |
| `code` | TEXT | NOT NULL UNIQUE | Domain code (e.g. `A`, `B`) |
| `name` | TEXT | NOT NULL | Human-readable name |
| `description` | TEXT | NULL | Detailed domain description |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE | Active availability flag |
| `sort_order` | INT | NOT NULL DEFAULT 0 | UI display order |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Update timestamp |

---

**Table: `seam_definitions`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Seam definition ID |
| `code` | TEXT | NOT NULL UNIQUE | Seam code (e.g. `A↔C`) |
| `domain_code_1` | TEXT | NOT NULL REFERENCES domain_definitions(code) | First domain boundary code |
| `domain_code_2` | TEXT | NOT NULL REFERENCES domain_definitions(code) | Second domain boundary code |
| `name` | TEXT | NOT NULL | Human-readable name |
| `description` | TEXT | NULL | Detailed seam description |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE | Active availability flag |
| `sort_order` | INT | NOT NULL DEFAULT 0 | UI display order |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Update timestamp |

**Unique constraint:** `(domain_code_1, domain_code_2)`  
**Indexes:** `domain_code_1`, `domain_code_2`

---

**Table: `archetype_definitions`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Archetype ID |
| `code` | TEXT | NOT NULL UNIQUE | Archetype code (e.g. `1`, `2`) |
| `name` | TEXT | NOT NULL | Archetype display name |
| `description` | TEXT | NULL | Brief description |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE | Active status |
| `sort_order` | INT | NOT NULL DEFAULT 0 | Display order |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Update timestamp |

---

**Table: `probe_questions`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Question ID |
| `archetype_code` | TEXT | NOT NULL REFERENCES archetype_definitions(code) | Parent archetype code |
| `question_text` | TEXT | NOT NULL | Probe question text |
| `display_order` | INT | NOT NULL DEFAULT 0 | Stage 3 presentation order |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE | Active status |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Update timestamp |

**Index:** `archetype_code`

---

**Table: `void_code_definitions`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Definition ID |
| `code` | TEXT | NOT NULL UNIQUE | Gap code string (e.g. `NO_GROUND_TRUTH`) |
| `name` | TEXT | NOT NULL | Short title |
| `description` | TEXT | NOT NULL | Gap explanation |
| `severity` | TEXT | NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('HIGH','MEDIUM','LOW')) | Severity level |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE | Active status |
| `sort_order` | INT | NOT NULL DEFAULT 0 | Display order |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Update timestamp |

---

**Table: `prompt_templates`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Template ID |
| `stage` | TEXT | NOT NULL UNIQUE | Stage identifier (e.g. `stage1_extract`) |
| `template_text` | TEXT | NOT NULL | Jinja2 prompt text |
| `description` | TEXT | NULL | Admin notes |
| `version` | INT | NOT NULL DEFAULT 1 | Version counter |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Last update timestamp |

---

**Table: `subscription_packages`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Package ID |
| `role` | TEXT | NOT NULL CHECK (role IN ('CLIENT','EXPERT')) | Target role |
| `name` | TEXT | NOT NULL | Package display name |
| `price_vnd` | BIGINT | NOT NULL CHECK (price_vnd >= 0) | Package price in VND |
| `duration_months` | INT | NOT NULL CHECK (duration_months > 0) | Validity duration in months |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE | Active for new purchase |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Update timestamp |

---

**Table: `subscription_purchase_logs`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK NOT NULL DEFAULT gen_random_uuid() | Purchase log ID |
| `user_id` | UUID | NOT NULL REFERENCES users(id) | Buyer user ID |
| `package_id` | UUID | NOT NULL REFERENCES subscription_packages(id) | Selected package |
| `role` | TEXT | NOT NULL | Role context |
| `amount_paid_vnd` | BIGINT | NOT NULL | Paid price in VND |
| `purchased_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Purchase timestamp |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Computed expiry date |
| `payment_method` | TEXT | NOT NULL DEFAULT 'WALLET' | Payment method string |

**Index:** `user_id`

---

### FK Dependency Order (40 Tables)

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
31.  seam_definitions             → domain_definitions (natural key joins on code)
32.  archetype_definitions        → (standalone CMS)
33.  probe_questions              → archetype_definitions (natural key join on code)
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

`users` · `client_profiles` · `expert_profiles` · `tech_team_profiles` · `wallets` · `wallet_transactions` · `virtual_accounts` · `withdrawal_requests` · `platform_settings` · `elicitation_sessions` · `projects` · `project_shortlist_cache` · `services` · `expert_domain_depths` · `expert_seam_claims` · `portfolio_submissions` · `engagements` · `capability_bids` · `milestones` · `acceptance_criteria` · `milestone_dod_items` · `milestone_submissions` · `paygated_documents` · `milestone_chat_sessions` · `escrow_accounts` · `disputes` · `messages` · `message_reads` · `reviews` · `platform_decisions` · `domain_definitions` · `seam_definitions` · `archetype_definitions` · `probe_questions` · `void_code_definitions` · `prompt_templates` · `subscription_packages` · `subscription_purchase_logs` · `notifications` · `invitations`

---

### Phase 0 — Elicitation Engine

- `users` ➔ `initiates` ➔ `elicitation_sessions` **(1:N)**

---

### Phase 1 — Users & Role Subtypes

- `users` ➔ `has` ➔ `client_profiles` **(1:1)**
- `users` ➔ `has` ➔ `expert_profiles` **(1:1)**
- `users` ➔ `has` ➔ `tech_team_profiles` **(1:1)**
- `users` ➔ `invited` ➔ `tech_team_profiles` **(1:N)** — via `linked_client_id`

---

### Phase 2 — Expert Capability (2-Tier System)

- `users` ➔ `has` ➔ `expert_domain_depths` **(1:N)**
- `users` ➔ `holds` ➔ `expert_seam_claims` **(1:N)**
- `users` ➔ `submits` ➔ `portfolio_submissions` **(1:N)**
- `portfolio_submissions` ➔ `upgrades` ➔ `expert_seam_claims` **(N:1)** — via `seam_claim_id`

---

### Phase 3 — Wallet, Finance & Platform Settings

- `users` ➔ `owns` ➔ `wallets` **(1:1)**
- `wallets` ➔ `records` ➔ `wallet_transactions` **(1:N)**
- `users` ➔ `requests` ➔ `withdrawal_requests` **(1:N)**
- `milestones` ➔ `triggers payout` ➔ `withdrawal_requests` **(1:N)**
- `platform_settings` ➔ `references` ➔ `wallets` **(1:1)** — *"singleton — seeded at deploy"*

---

### Phase 4 — Projects (JSONB Hub)

- `users` (CEO) ➔ `creates` ➔ `projects` **(1:N)**
- `elicitation_sessions` ➔ `produces` ➔ `projects` **(1:1)**
- `projects` ➔ `scopes` ➔ `tech_team_profiles` **(1:N)**
- `projects` ➔ `cached in` ➔ `project_shortlist_cache` **(1:1)**
- `projects` ➔ `has` ➔ `milestone_chat_sessions` **(1:N)**
- `projects` ➔ `receives` ➔ `invitations` **(1:N)**

*Annotation on `projects`: "artifact_b_json route-gated: state ≥ CONNECTED + NDA accepted + CEO excluded"*

---

### Phase 5 — Services (Path B)

- `users` (Expert) ➔ `creates` ➔ `services` **(1:N)**

---

### Phase 6 — Engagements & Bids

- `projects` ➔ `has` ➔ `engagements` **(1:N)** — Path A
- `services` ➔ `generates` ➔ `engagements` **(1:N)** — Path B/C
- `users` (Expert) ➔ `joins` ➔ `engagements` **(1:N)**
- `users` (Client) ➔ `initiates` ➔ `engagements` **(1:N)**
- `engagements` ➔ `has` ➔ `capability_bids` **(1:1)**

---

### Phase 7 — Milestones, Escrow & Disputes

- `engagements` ➔ `has` ➔ `milestones` **(1:N)**
- `milestones` ➔ `allocates` ➔ `virtual_accounts` **(1:N)**
- `milestones` ➔ `has` ➔ `acceptance_criteria` **(1:N)** — Layer 1
- `milestones` ➔ `has` ➔ `milestone_dod_items` **(1:N)** — Layer 2
- `milestone_dod_items` ➔ `maps to` ➔ `acceptance_criteria` **(N:1)**
- `milestones` ➔ `has` ➔ `milestone_submissions` **(1:N)**
- `users` ➔ `submits` ➔ `milestone_submissions` **(1:N)**
- `milestones` ➔ `releases` ➔ `paygated_documents` **(1:N)**
- `milestones` ➔ `held in` ➔ `escrow_accounts` **(1:1)** — Path A
- `engagements` ➔ `holds escrow for` ➔ `escrow_accounts` **(1:1)** — Path B/C
- `wallets` ➔ `funds / receives from` ➔ `escrow_accounts` **(1:N)**
- `engagements` ➔ `has` ➔ `disputes` **(1:N)**
- `acceptance_criteria` ➔ `subject of` ➔ `disputes` **(1:N)**
- `escrow_accounts` ➔ `frozen by` ➔ `disputes` **(1:1)**
- `users` ➔ `files / resolves` ➔ `disputes` **(1:N)**

---

### Phase 8 — Messaging, Reviews & Audit

- `engagements` ➔ `has` ➔ `messages` **(1:N)**
- `projects` ➔ `has` ➔ `messages` **(1:N)** — Pre-bid Q&A
- `users` ➔ `sends` ➔ `messages` **(1:N)**
- `messages` ➔ `has` ➔ `message_reads` **(1:N)**
- `users` ➔ `reads` ➔ `message_reads` **(1:N)**
- `engagements` ➔ `has` ➔ `reviews` **(1:N)**
- `users` ➔ `writes / subject of` ➔ `reviews` **(1:N)**
- `platform_decisions` — standalone polymorphic audit log

---

### Phase 9 — CMS & Config Tables (Standalone Cluster)

- `domain_definitions`
- `seam_definitions` ➔ `references` ➔ `domain_definitions` **(N:1)**
- `archetype_definitions`
- `probe_questions` ➔ `belongs to` ➔ `archetype_definitions` **(N:1)**
- `void_code_definitions`
- `prompt_templates`
- `subscription_packages` ➔ `logs` ➔ `subscription_purchase_logs` **(1:N)**
- `users` ➔ `purchases` ➔ `subscription_purchase_logs` **(1:N)**

---

### Phase 10 — Platform Notifications & Invitations

- `users` ➔ `receives` ➔ `notifications` **(1:N)**
- `users` (Expert) ➔ `receives` ➔ `invitations` **(1:N)**
- `users` (Client) ➔ `sends` ➔ `invitations` **(1:N)**
- `projects` ➔ `has` ➔ `invitations` **(1:N)**

---

### Final Entity & Relationship Count Summary

| Phase | Entities | Primary Relationships |
|---|:---:|:---:|
| **0 — Elicitation** | 1 | 1 |
| **1 — Users & Subtypes** | 4 | 4 |
| **2 — Expert Capability** | 3 | 4 |
| **3 — Wallet, Finance & Settings** | 5 | 5 |
| **4 — Projects Hub & Shortlist** | 3 | 6 |
| **5 — Services** | 1 | 1 |
| **6 — Engagements & Bids** | 2 | 5 |
| **7 — Milestones, Escrow & Disputes** | 9 | 17 |
| **8 — Messaging, Reviews & Decisions** | 4 | 8 |
| **9 — CMS & Subscriptions** | 6 | 3 |
| **10 — Notifications & Invitations** | 2 | 4 |
| **Total** | **40** | **58** |