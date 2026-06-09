## 0.10 Enumerated Value Domains (CHECK Constraints, State Machines & JSONB Schemas)

> **Purpose:** Canonical definition for every bounded string set, `CHECK` constraint, state code, and JSONB schema used in the 28-table architecture. Application code, NestJS guards, and state machines must reference these domains. If a value is not on this list, the DB rejects it, or the application validation layer throws a 422.

---

### A. Core Taxonomy Domains (Grounded in §0.1 - §0.3)

| Domain Code | Table.Column(s) | Allowed Values | Grounding |
|---|---|---|---|
| `DOMAIN_CODE` | `expert_domain_depths.domain_code` | `A` \| `B` \| `C` \| `D` \| `E` \| `F` | Maps to §0.1 (A=LLM App, B=MLOps, C=AI Eval, D=VectorDB, E=DataPipe, F=ML Model) |
| `SEAM_CODE` | `expert_seam_claims.seam_code`, `projects.required_seams_json` | `A↔C` \| `A↔F` \| `A↔D` \| `D↔E` \| `D↔F` \| `C↔F` \| `E↔F` \| `A↔B` \| `B↔E` \| `C↔E` | Maps to §0.2 (The 10 Seams) |
| `ARCHETYPE_CODE` | `projects.archetype`, `expert_profiles.archetype_history_json` | `1` \| `2` \| `3` \| `4` \| `5` \| `6` | Maps to §0.3 (1=AutoDecision, 2=RAG, 3=Predictive, 4=DataPipe, 5=FineTune, 6=EvalInfra) |
| `PROJECT_TIER` | `projects.tier` | `TIER_1` \| `TIER_2` \| `TIER_3` | Maps to §0.3 (Simple, Moderate, Complex) |

---

### B. User & Profile Domains

| Domain Code | Table.Column | Allowed Values | Notes |
|---|---|---|---|
| `ACTIVE_ROLE` | `users.active_role` | `CLIENT` \| `EXPERT` \| `ADMIN` | JWT context; determines dashboard & guards |
| `CLIENT_SUBTYPE` | `users.client_subtype` | `CEO` \| `TECH_TEAM` \| `NULL` | NULL for EXPERT and ADMIN |
| `USER_ROLE_ITEM` | `users.roles` (JSONB array elements) | `CLIENT_CEO` \| `EXPERT` | Strings allowed inside the `roles` JSONB array |
| `SUB_TIER` | `users.subscription_client_tier`, `.subscription_expert_tier` | `free` \| `pro` | Evaluated by subscription guard middleware |
| `ENGAGEMENT_MODEL` | `expert_profiles.engagement_model` | `MILESTONE` \| `HOURLY` \| `HYBRID` | Self-declared by expert; feeds 10% match score weight |
| `DOMAIN_DEPTH` | `expert_domain_depths.depth_level` | `SURFACE` \| `OPERATIONAL` \| `DEEP` | Maps to §0.1 capability domains |
| `VERIFY_TIER` | `expert_domain_depths.verification_tier`, `expert_seam_claims.verification_tier` | `CLAIMED` \| `EVIDENCE_BACKED` | MVP 2-tier system per §0.4 |

---

### C. State Machine Domains (Grounded in §0.6)

| Domain Code | Table.Column | Allowed Values | Notes |
|---|---|---|---|
| `ELICITATION_STATE` | `elicitation_sessions.state` | `IN_PROGRESS` \| `COMPLETED` \| `ABANDONED` \| `RETURNED` | §0.6 Elicitation states |
| `ELICITATION_SCENARIO` | `elicitation_sessions.scenario_type` | `STANDARD` \| `SCENARIO_A` \| `SCENARIO_B` | A = no TECH_TEAM; B = self-technical CEO |
| `PROJECT_STATE` | `projects.state` | `DRAFT` \| `PUBLISHED` \| `RETURNED_TO_CLIENT` \| `SUSPENDED` | §0.6 Spec states |
| `SERVICE_STATE` | `services.state` | `DRAFT` \| `PUBLISHED` \| `SUSPENDED` | Admin pull-back applies to services too |
| `PORTFOLIO_STATUS` | `portfolio_submissions.status` | `PENDING` \| `APPROVED` \| `REJECTED` | LLM auto-eval result |
| `ENGAGEMENT_STATE` | `engagements.state` | `PENDING` \| `CONNECTED` \| `ACTIVE` \| `CLOSED` \| `DISPUTED` | §0.6 Engagement states |
| `ENGAGEMENT_TYPE` | `engagements.type` | `PROJECT_BASED` \| `SERVICE_PURCHASE` \| `TECH_DISCOVERY` | Immutable after creation; enforces FK consistency |
| `BID_STATE` | `capability_bids.state` | `DRAFT` \| `SUBMITTED` \| `TECH_REVIEW` \| `REVISION_REQUESTED` \| `TECH_APPROVED` \| `CEO_REVIEW` \| `SELECTED` \| `DECLINED` | §0.6 Simplified mutable-row Bid states |
| `BID_TECH_STATUS` | `capability_bids.tech_status` | `PENDING` \| `APPROVED` \| `REVISION_REQUESTED` | Set by TECH_TEAM; unlocks CEO_REVIEW |
| `BID_CEO_STATUS` | `capability_bids.ceo_status` | `PENDING` \| `APPROVED` \| `DECLINED` | Set by CEO; guarded by `tech_status = APPROVED` |
| `MILESTONE_STATE` | `milestones.state` | `DEFINED` \| `AWAITING_PAYMENT` \| `FUNDED` \| `IN_PROGRESS` \| `SUBMITTED` \| `IN_REVISION` \| `APPROVED` \| `RELEASED` \| `DISPUTED` | §0.6 Milestone states |
| `SIGN_OFF_AUTH` | `milestones.sign_off_authority` | `TECH_TEAM` \| `CEO` \| `JOINT` | Determines who can set `verified_at` on criteria |
| `VERIFY_BY_ROLE` | `acceptance_criteria.verified_by_role` | `TECH_TEAM` \| `CEO` \| `JOINT` | Must match the milestone's `sign_off_authority` logic |
| `DOD_STATUS` | `milestone_dod_items.status` | `PENDING` \| `COMPLETED` \| `NOT_APPLICABLE` | DB CHECK prevents `NOT_APPLICABLE` if `is_required = true` |
| `DOC_RELEASE_STATE` | `paygated_documents.release_state` | `STAGED` \| `RELEASED` | Auto-flips to `RELEASED` in IPN TX on milestone FUNDED |
| `DISPUTE_STATE` | `disputes.state` | `PENDING` \| `LAYER_1_EVAL` \| `AUTO_RESOLVED` \| `MANUAL_REVIEW` \| `RESOLVED` | §0.6 2-Layer Dispute states |
| `REVIEWER_ROLE` | `reviews.reviewer_role` | `CEO` \| `TECH_TEAM` \| `EXPERT` | Enforces role-specific review forms |

---

### D. Wallet, Escrow & Payment Domains

| Domain Code | Table.Column | Allowed Values | Notes |
|---|---|---|---|
| `TX_TYPE` | `wallet_transactions.transaction_type` | `TOP_UP` \| `SUBSCRIPTION` \| `ESCROW_LOCK` \| `ESCROW_RELEASE` \| `PLATFORM_FEE` \| `ESCROW_REFUND` \| `ESCROW_SPLIT` \| `WITHDRAWAL` | Immutable ledger types per §0.6 |
| `VA_ENTITY_TYPE` | `virtual_accounts.entity_type` | `WALLET_TOPUP` \| `MILESTONE` \| `SERVICE` \| `SUBSCRIPTION` | Dictates IPN handler branching logic |
| `VA_STATUS` | `virtual_accounts.status` | `ACTIVE` \| `EXPIRED` \| `USED` | Permanent for TOPUP; 24h expiry for others |
| `ESCROW_STATUS` | `escrow_accounts.status` | `HELD` \| `RELEASED` \| `FROZEN` \| `REFUNDED` \| `SPLIT` | `FROZEN` triggered by dispute filing |
| `WITHDRAWAL_TYPE` | `withdrawal_requests.type` | `MILESTONE_RELEASE` \| `EXPERT_MANUAL` | Auto-created on milestone APPROVED vs. Expert initiated |
| `WITHDRAWAL_STATUS` | `withdrawal_requests.status` | `PENDING` \| `PROCESSING` \| `COMPLETED` \| `FAILED` | §0.6 Withdrawal states |
| `SERVICE_TYPE` | `services.service_type` | `AI_SERVICE` \| `TECH_DISCOVERY` | Differentiates marketplace listings |

---

### E. Platform Decision & Audit Domains

| Domain Code | Table.Column | Allowed Values | Notes |
|---|---|---|---|
| `PLATFORM_DECISION_TYPE` | `platform_decisions.decision_type` | `ELICITATION_SYNTHESIS` \| `SPEC_AUTO_RETURN` \| `SEAM_TIER_UPGRADE` \| `PORTFOLIO_EVAL` \| `DISPUTE_L1_EVAL` \| `CRITERION_QUALITY_GATE` | Audit log for all LLM/AI actions (Admin Integrity Monitor) |

---

### F. JSONB Schema Definitions (Application-Level Validation)

> While not bounded by SQL `CHECK` constraints, these JSONB structures must conform to the following canonical schemas at the application (NestJS) validation layer before DB write.

| Table.Column | JSONB Code | Canonical Structure | Notes |
|---|---|---|---|
| `users.roles` | `ROLES_ARRAY` | `[ string ]` where string ∈ `USER_ROLE_ITEM` | e.g. `["CLIENT_CEO", "EXPERT"]` |
| `projects.required_seams_json` | `FOOTPRINT_SEAMS` | `[{ "seam_code": SEAM_CODE, "criticality": "load_bearing" \| "significant" \| "contributing" }]` | Drives 40% match score weight |
| `projects.required_domains_json` | `FOOTPRINT_DOMAINS` | `[{ "domain_code": DOMAIN_CODE, "required_depth": DOMAIN_DEPTH }]` | Drives 25% match score weight |
| `projects.milestone_framework_json` | `MILESTONE_FRAMEWORK` | `[{ "milestone_number": int, "deliverable_statement": string, "sign_off_authority": SIGN_OFF_AUTH, "payment_amount_vnd": bigint }]` | Generated by Stage 5 synthesis |
| `projects.artifact_a_json` | `ARTIFACT_A` | `{ "business_intent": string, "archetype": ARCHETYPE_CODE, "stack_tags": [string], "volume_tier": PROJECT_TIER, "sdlc_notices": [string] }` | Public spec; visible to matched experts |
| `projects.artifact_b_json` | `ARTIFACT_B` | `{ "stack_tags": [string], "integration_method": string, "legacy_volume": string, "schemas": [url], "contracts": [url] }` | Technical vault; strictly gated per §0.7 RBAC |
| `expert_profiles.stack_tags_json` | `STACK_TAGS` | `[ string ]` | e.g. `["Python", "Kafka", "Go"]`. Drives 5% match score weight |
| `expert_profiles.archetype_history_json` | `ARCHETYPE_HISTORY` | `[{ "archetype_code": ARCHETYPE_CODE, "tier": PROJECT_TIER, "self_declared": boolean }]` | Drives 20% match score weight |
| `services.domains_json` | `SERVICE_DOMAINS` | `[ DOMAIN_CODE ]` | Domains covered by the service |
| `services.seams_json` | `SERVICE_SEAMS` | `[ SEAM_CODE ]` | Seams covered by the service |
| `capability_bids.footprint_alignment_json` | `BID_ALIGNMENT` | `{ "domains": [{ "code": DOMAIN_CODE, "depth": DOMAIN_DEPTH }], "seams": [{ "code": SEAM_CODE, "tier": VERIFY_TIER }] }` | Component 1 of 3-component bid |
| `capability_bids.conditional_pricing_json` | `BID_PRICING` | `[{ "milestone_number": int, "price_vnd": bigint, "condition": string \| null }]` | Component 3 of 3-component bid |
| `milestone_submissions.files_json` | `FILES_ARRAY` | `[ { "url": string, "filename": string, "mime_type": string } ]` | Deliverable attachments |
| `reviews.structured_signals_json` | `REVIEW_SIGNALS` | `[{ "seam_code": SEAM_CODE, "signal_type": string, "seam_role": string }]` | Informational only (Tier 4 cut) |
| `elicitation_sessions.void_list_json` | `VOID_LIST` | `[{ "void_code": string, "injected": boolean }]` | Tracks mandatory SDLC injections |