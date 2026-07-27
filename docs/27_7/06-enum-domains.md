# 0.10 Enumerated Value Domains & JSONB Schemas
### Database Ground Truth · CHECK Constraints · State Machine Codes · Payload Contracts

> **Purpose:** Canonical technical definition for every bounded string set, database `CHECK` constraint, state machine enum, and structured `JSONB` schema across the 40-table architecture and 12 internal FastAPI endpoints. Application DTOs, NestJS Guards, and FastAPI Pydantic models must reference these domain definitions.

---

## Table of Contents

1. [Core Taxonomy Domains (CMS DB-Driven)](#a-core-taxonomy-domains-cms-db-driven)
2. [User, Profile & Subscription Domains](#b-user-profile--subscription-domains)
3. [State Machine Enums & Status Codes](#c-state-machine-enums--status-codes)
4. [Wallet, Escrow & Payment Domains](#d-wallet-escrow--payment-domains)
5. [Platform Audit & Decision Domains](#e-platform-audit--decision-domains)
6. [NestJS JSONB Schema Specifications](#f-nestjs-jsonb-schema-specifications)
7. [FastAPI Response Contracts & Pydantic Models](#g-fastapi-response-contracts--pydantic-models)

---

## A. Core Taxonomy Domains (CMS DB-Driven)

*Note: Stored as `TEXT` in primary transactional tables to support dynamic CMS administration. NestJS validates these codes against the active `domain_definitions`, `seam_definitions`, `archetype_definitions`, and `void_code_definitions` database tables at the service layer.*

| Domain Code | Primary Database Table.Column(s) | Seed Data Values | Grounding & Formatting Rules |
|---|---|---|---|
| `DOMAIN_CODE` | `expert_domain_depths.domain_code`, `services.domains_json` | `A` \| `B` \| `C` \| `D` \| `E` \| `F` | Maps to §0.1 (A=LLM App, B=MLOps, C=AI Eval, D=Vector DB, E=Data Pipeline, F=ML Model/Fine-Tuning). |
| `SEAM_CODE` | `expert_seam_claims.seam_code`, `projects.required_seams_json`, `services.seams_json` | `A↔C` \| `A↔F` \| `A↔D` \| `D↔E` \| `D↔F` \| `C↔F` \| `E↔F` \| `A↔B` \| `B↔E` \| `C↔E` | Maps to §0.2. **Enforces Unicode `↔` (U+2194) arrow character.** ASCII `<->` is rejected by DTO validation pipes. |
| `ARCHETYPE_CODE` | `projects.archetype`, `elicitation_sessions.archetype`, `archetype_definitions.code` | `1` \| `2` \| `3` \| `4` \| `5` \| `6` | Maps to §0.3 (1=RAG/Search, 2=Recommendation, 3=Classification, 4=Generation, 5=Prediction, 6=Multimodal). |
| `PROJECT_TIER` | `projects.tier` | `TIER_1` \| `TIER_2` \| `TIER_3` | Volume tier scale classification based on DAU and throughput SLAs. |
| `VOID_CODE` | `elicitation_sessions.void_list_json`, `void_code_definitions.code` | `NO_GROUND_TRUTH` \| `NO_BASELINE` \| `UNCLEAR_SUCCESS_METRIC` \| `DATA_PRIVACY_CONSTRAINT` \| `INTEGRATION_UNCLEAR` \| `TIMELINE_UNREALISTIC` \| `SCOPE_CREEP_RISK` \| `MISSING_TECHNICAL_ARTIFACT` | Elicitation risk taxonomy codes. |
| `VOID_SEVERITY` | `void_code_definitions.severity` | `HIGH` \| `MEDIUM` \| `LOW` | `HIGH` severity void codes block Stage 5 project publication unless explicitly acknowledged. |

---

## B. User, Profile & Subscription Domains

| Domain Code | Database Table.Column | Allowed String Values | Operational Notes |
|---|---|---|---|
| `ACTIVE_ROLE` | `users.active_role` | `CLIENT` \| `EXPERT` \| `ADMIN` | Embedded in JWT payload; determines active context and access guards. |
| `CLIENT_SUBTYPE` | `users.client_subtype` | `CEO` \| `TECH_TEAM` \| `NULL` | Discriminator when `active_role = 'CLIENT'`. NULL for Experts and Admins. |
| `USER_ROLE_ITEM` | `users.roles` (JSONB array items) | `CLIENT_CEO` \| `EXPERT` \| `ADMIN` | Role strings contained within the `users.roles` JSONB array. |
| `SUB_TIER` | `users.subscription_client_tier`, `users.subscription_expert_tier` | `free` \| `pro` | Tier evaluation checked via `SubscriptionGuard`. |
| `ENGAGEMENT_MODEL` | `expert_profiles.engagement_model` | `MILESTONE` \| `HOURLY` \| `HYBRID` | Self-declared expert engagement preference (contributes 5% to match scoring). |
| `DOMAIN_DEPTH` | `expert_domain_depths.depth_level` | `SURFACE` \| `OPERATIONAL` \| `DEEP` | Declared or verified domain proficiency depth. |
| `VERIFY_TIER` | `expert_domain_depths.verification_tier`, `expert_seam_claims.verification_tier` | `CLAIMED` \| `EVIDENCE_BACKED` | 2-Tier verification model. Upgraded automatically on passing portfolio evaluation. |

---

## C. State Machine Enums & Status Codes

| Domain Code | Database Table.Column | Allowed Status / State Values | State Machine Reference |
|---|---|---|---|
| `ELICITATION_STATE` | `elicitation_sessions.state` | `IN_PROGRESS` \| `COMPLETED` \| `ABANDONED` \| `RETURNED` | §0.6 Elicitation Session state machine. |
| `PROJECT_STATE` | `projects.state` | `DRAFT` \| `PUBLISHED` \| `RETURNED_TO_CLIENT` \| `SUSPENDED` | §0.6 Project specification state machine. |
| `SERVICE_STATE` | `services.state` | `DRAFT` \| `PUBLISHED` \| `SUSPENDED` | Marketplace service publication lifecycle. |
| `PORTFOLIO_STATUS` | `portfolio_submissions.status` | `PENDING` \| `APPROVED` \| `REJECTED` | Tier 2 evidence evaluation outcome. |
| `ENGAGEMENT_STATE` | `engagements.state` | `PENDING` \| `CONNECTED` \| `ACTIVE` \| `CLOSED` \| `DISPUTED` \| `DECLINED` \| `CANCELLED` | §0.6 Engagement contract state machine. |
| `ENGAGEMENT_TYPE` | `engagements.type` | `PROJECT_BASED` \| `SERVICE_PURCHASE` \| `TECH_DISCOVERY` | Immutable path discriminator enforced by database check constraint. |
| `BID_STATE` | `capability_bids.state` | `DRAFT` \| `SUBMITTED` \| `TECH_REVIEW` \| `REVISION_REQUESTED` \| `TECH_APPROVED` \| `CEO_REVIEW` \| `SELECTED` \| `DECLINED` \| `WITHDRAWN` \| `TECH_REVIEW_PASSED` | Proposal evaluation state machine. |
| `BID_TECH_STATUS` | `capability_bids.tech_status` | `PENDING` \| `APPROVED` \| `REVISION_REQUESTED` | Technical review cursor set by Tech Team. |
| `BID_CEO_STATUS` | `capability_bids.ceo_status` | `PENDING` \| `APPROVED` \| `DECLINED` | Commercial decision cursor set by Client CEO. |
| `NEGOTIATION_STATE` | Derived / `capability_bids` Envelope | `AWAITING_TECH_REVIEW` \| `AWAITING_CEO` \| `AWAITING_EXPERT` \| `TERMS_ACCEPTED` \| `DECLINED` | Derived negotiation status from offer envelope (v1). |
| `OFFER_STATE` | Envelope `offers[].state` | `PENDING` \| `ACCEPTED` \| `DECLINED` \| `SUPERSEDED` | Status per counter-offer iteration in envelope. |
| `MILESTONE_STATE` | `milestones.state` | `DEFINED` \| `AWAITING_PAYMENT` \| `FUNDED` \| `IN_PROGRESS` \| `SUBMITTED` \| `IN_REVISION` \| `APPROVED` \| `RELEASED` \| `DISPUTED` | §0.6 Milestone delivery lifecycle. |
| `SIGN_OFF_AUTH` | `milestones.sign_off_authority` | `CEO` \| `TECH_TEAM` \| `JOINT` | Derived automatically (`CEO` if self-technical; `JOINT` otherwise). |
| `VERIFY_BY_ROLE` | `acceptance_criteria.verified_by_role` | `CEO` \| `TECH_TEAM` \| `JOINT` | Role authority required to sign off a criterion. |
| `REVISION_ROLE` | `acceptance_criteria.revision_requested_by_role` | `CEO` \| `TECH_TEAM` \| `NULL` | Identifies which role requested deliverable revision. |
| `DOD_STATUS` | `milestone_dod_items.status` | `PENDING` \| `COMPLETED` \| `NOT_APPLICABLE` | DB check constraint prevents `NOT_APPLICABLE` when `is_required = true`. |
| `DOC_RELEASE_STATE` | `paygated_documents.release_state` | `STAGED` \| `RELEASED` | Auto-transitions to `RELEASED` in IPN milestone funding transaction. |
| `DISPUTE_STATE` | `disputes.state` | `PENDING` \| `LAYER_1_EVAL` \| `AUTO_RESOLVED` \| `MANUAL_REVIEW` \| `RESOLVED` | §0.6 2-Layer Dispute resolution machine. |
| `DISPUTE_RESOLUTION`| `disputes.resolution` | `EXPERT_WINS` \| `CLIENT_WINS` \| `SPLIT` \| `NULL` | Final dispute arbitration outcome. |
| `REVIEWER_ROLE` | `reviews.reviewer_role` | `CEO` \| `TECH_TEAM` \| `EXPERT` | Differentiates review author context. |
| `INVITATION_STATUS` | `invitations.status` | `PENDING` \| `ACCEPTED` \| `DECLINED` \| `EXPIRED` | Project invitation state (7-day validity). |
| `NOTIFICATION_TYPE` | `notifications.type` | `bid_update` \| `system` \| `milestone_update` \| `payment` \| `dispute` \| `portfolio_eval` | Persisted notification types. |
| `SUBSCRIPTION_ROLE` | `subscription_packages.role` | `CLIENT` \| `EXPERT` | Distinguishes Client Pro vs Expert Pro packages. |

---

## D. Wallet, Escrow & Payment Domains

| Domain Code | Database Table.Column | Allowed Values | Operational Notes |
|---|---|---|---|
| `TX_TYPE` | `wallet_transactions.transaction_type` | `TOP_UP` \| `SUBSCRIPTION` \| `ESCROW_LOCK` \| `ESCROW_RELEASE` \| `PLATFORM_FEE` \| `ESCROW_REFUND` \| `ESCROW_SPLIT` \| `WITHDRAWAL` \| `WITHDRAWAL_REFUND` | Immutable double-entry ledger event types. |
| `VA_ENTITY_TYPE` | `virtual_accounts.entity_type` | `WALLET_TOPUP` \| `MILESTONE` \| `SERVICE` \| `SUBSCRIPTION` | Polymorphic beneficiary entity type dictating IPN handler execution. |
| `VA_STATUS` | `virtual_accounts.status` | `ACTIVE` \| `EXPIRED` \| `USED` | Permanent for `WALLET_TOPUP`; 24-hour expiration for milestone/service VAs. |
| `ESCROW_STATUS` | `escrow_accounts.status` | `HELD` \| `RELEASED` \| `FROZEN` \| `REFUNDED` \| `SPLIT` | `FROZEN` status locked automatically during dispute arbitration. |
| `WITHDRAWAL_TYPE` | `withdrawal_requests.type` | `MILESTONE_RELEASE` \| `EXPERT_MANUAL` | Automatic milestone release vs expert-initiated payout request. |
| `WITHDRAWAL_STATUS`| `withdrawal_requests.status` | `PENDING` \| `PROCESSING` \| `COMPLETED` \| `FAILED` \| `CANCELLED` | Payout request lifecycle. |
| `SERVICE_TYPE` | `services.service_type` | `AI_SERVICE` \| `TECH_DISCOVERY` | Fixed-scope build vs advisory/discovery package classification. |
| `SHORTLIST_SOURCE` | `project_shortlist_cache.source` | `AUTO` \| `FORCE_REFRESH` | Auto-seeded on publication vs CEO manual re-scoring trigger. |

---

## E. Platform Audit & Decision Domains

| Domain Code | Database Table.Column | Allowed Decision Types | Audit Scope |
|---|---|---|---|
| `PLATFORM_DECISION_TYPE` | `platform_decisions.decision_type` | `ELICITATION_SYNTHESIS` \| `SPEC_AUTO_RETURN` \| `SEAM_TIER_UPGRADE` \| `PORTFOLIO_EVAL` \| `DISPUTE_L1_EVAL` \| `CRITERION_QUALITY_GATE` | Append-only audit trail logging AI evaluations, quality gate outcomes, and automated platform actions. |

---

## F. NestJS JSONB Schema Specifications

> Application DTOs and Prisma JSON fields strictly conform to these structural schemas.

#### 1. Roles & Overrides
- **`users.roles`**: `["CLIENT_CEO", "EXPERT"]`
- **`users.self_technical_projects`**: `[{ "sessionId": "uuid-string", "override": boolean }]`

#### 2. Footprints & Project Specifications
- **`projects.required_seams_json`**:
  ```json
  [
    {
      "seam_code": "A↔C",
      "criticality": "load_bearing"
    }
  ]
  ```
  *(Criticality values: `load_bearing` \| `significant` \| `contributing`)*

- **`projects.required_domains_json`**:
  ```json
  [
    {
      "domain_code": "A",
      "required_depth": "DEEP"
    }
  ]
  ```
  *(Required depth values: `SURFACE` \| `OPERATIONAL` \| `DEEP`)*

- **`projects.milestone_framework_json`**:
  ```json
  [
    {
      "milestone_number": 1,
      "deliverable_statement": "Implement vector database index and chunking pipeline.",
      "sign_off_authority": "JOINT",
      "payment_amount_vnd": 25000000,
      "estimated_cost_vnd": 25000000,
      "estimated_duration_days": 10
    }
  ]
  ```

- **`projects.artifact_a_json`**:
  ```json
  {
    "project_name": "Enterprise Document RAG",
    "business_intent": "Automate internal knowledge base Q&A for 50,000 employees.",
    "archetype": "1",
    "stack_tags": ["Python", "FastAPI", "Pinecone", "LangChain"],
    "volume_tier": "TIER_2",
    "sdlc_notices": ["Requires internal API documentation before Stage 4 completion."]
  }
  ```

- **`projects.artifact_b_json`**:
  ```json
  {
    "stack_tags": ["Python 3.11", "PostgreSQL", "pgvector", "Redis"],
    "integration_method": "REST API with Bearer token authentication.",
    "legacy_volume": "~2TB PDF logs in AWS S3",
    "schemas": ["https://api.example.com/schema.json"],
    "contracts": ["https://api.example.com/openapi.yaml"]
  }
  ```

#### 3. Elicitation Session Payloads
- **`elicitation_sessions.void_list_json`**:
  ```json
  [
    {
      "void_code": "NO_GROUND_TRUTH",
      "severity": "HIGH",
      "injected": true
    }
  ]
  ```

- **`elicitation_sessions.critical_artifacts_json`**:
  ```json
  [
    {
      "artifact_key": "compliance_ruleset",
      "label": "Compliance Ruleset",
      "reason": "AI classifier must enforce these exact legal policies.",
      "placeholder_prompt": "Please paste your compliance rule document content here."
    }
  ]
  ```

- **`elicitation_sessions.stage4_tech_inputs_json`**:
  ```json
  {
    "current_stack": "GCP EKS, PostgreSQL, Kafka",
    "data_available": "500GB parquet files in GCS",
    "latency_requirement": "Integration Method: REST API < 200ms",
    "additional_requirement_1": "GDPR data residency compliance required.",
    "technical_artifacts": {
      "compliance_ruleset": "Rule 1: Mask PII before inference..."
    },
    "_tech_team_user_id": "uuid-string"
  }
  ```

#### 4. Expert Profile & Service Listings
- **`expert_profiles.stack_tags_json`**: `["Python", "PyTorch", "FastAPI", "Docker"]`
- **`expert_profiles.archetype_history_json`**:
  ```json
  [
    {
      "archetypeCode": "1",
      "tier": "TIER_2",
      "selfDeclared": false
    }
  ]
  ```
- **`services.domains_json`**: `["A", "D"]`
- **`services.seams_json`**: `["A↔D"]`

#### 5. Bids & Negotiation Envelope (v1)
- **`capability_bids.footprint_alignment_json`**:
  ```json
  {
    "domains": [
      { "code": "A", "depth": "DEEP" }
    ],
    "seams": [
      { "code": "A↔D", "tier": "EVIDENCE_BACKED" }
    ]
  }
  ```

- **`capability_bids.conditional_pricing_json` (Versioned Envelope Structure)**:
  ```json
  {
    "formatVersion": 1,
    "offers": [
      {
        "id": "uuid-string",
        "version": 1,
        "proposerUserId": "uuid-string",
        "proposerRole": "EXPERT",
        "recipientRole": "CEO",
        "milestones": [
          {
            "milestone_number": 1,
            "deliverable_statement": "Deploy core RAG ingestion pipeline.",
            "criteria": [
              { "criterion_text": "Processes 10,000 docs/hour with 0 errors", "is_required": true }
            ],
            "price_vnd": 25000000,
            "estimated_duration_days": 10,
            "condition": "After S3 credentials provided",
            "tech_stack": ["Python", "Pinecone"]
          }
        ],
        "state": "PENDING",
        "createdAt": "2026-07-15T10:00:00.000Z",
        "technicalScopeVersion": 1
      }
    ],
    "currentOfferId": "uuid-string",
    "acceptedOfferId": null,
    "termsAcceptedAt": null,
    "technicalReview": {
      "scopeVersion": 1,
      "status": "APPROVED",
      "intendedRecipient": "CEO",
      "reviewedAt": "2026-07-15T10:05:00.000Z",
      "feedback": null
    }
  }
  ```

#### 6. Reviews & Multi-turn Chat
- **`reviews.structured_signals_json`** (Required for Tech Team Reviewers):
  ```json
  {
    "codeQualityRating": 5,
    "communicationRating": 4,
    "seamRatings": [
      { "seamCode": "A↔D", "rating": 5 }
    ],
    "wouldRecommend": true
  }
  ```

- **`milestone_chat_sessions.messages_json`**:
  ```json
  [
    { "role": "user", "content": "Can we increase milestone 1 budget to 30M VND?" },
    { "role": "assistant", "content": "I have adjusted milestone 1 cost estimate to 30,000,000 VND." }
  ]
  ```

---

## G. FastAPI Response Contracts & Pydantic Models

> NestJS consumes these exact JSON schemas returned by the FastAPI microservice (`ai-service/app/models/responses.py`).

| FastAPI Endpoint | Response Model Name | Canonical Response Structure |
|---|---|---|
| `POST /llm/elicitation/stage1-extract` | `Stage1Response` | ```json
{
  "symptoms": ["string"],
  "scale_signals": { "user_count": "string", "data_volume": "string", "budget_vnd": 50000000 },
  "voids": [{ "void_code": "NO_GROUND_TRUTH", "severity": "HIGH" }],
  "recommended_archetypes": ["1", "3", "4"],
  "critical_artifacts_required": [
    { "artifact_key": "compliance_ruleset", "label": "Compliance Ruleset", "reason": "Required for classifier rules", "placeholder_prompt": "Paste rules here" }
  ]
}
``` |
| `POST /llm/elicitation/stage3-vagueness-check` | `Stage3VaguenessCheckResponse` | ```json
{
  "vague_answers": [{ "question": "string", "reason": "string" }],
  "irrelevant_answers": [{ "question": "string", "issue": "string" }]
}
``` |
| `POST /llm/elicitation/stage4-recommend` | `Stage4RecommendResponse` | ```json
{
  "recommended_stack": "Python, FastAPI, Pinecone, PostgreSQL",
  "recommended_integration": "REST API with API Key auth",
  "recommended_legacy_volume": "100,000 records in PostgreSQL"
}
``` |
| `POST /llm/elicitation/stage5-synthesize` | `Stage5Response` | ```json
{
  "required_seams_json": [{ "seam_code": "A↔D", "criticality": "load_bearing" }],
  "required_domains_json": [{ "domain_code": "A", "required_depth": "DEEP" }],
  "milestone_framework_json": [{ "milestone_number": 1, "deliverable_statement": "string", "sign_off_authority": "JOINT", "payment_amount_vnd": 0, "estimated_cost_vnd": 25000000, "estimated_duration_days": 10 }],
  "artifact_a_json": { "project_name": "string", "business_intent": "string", "archetype": "1", "stack_tags": ["string"], "volume_tier": "TIER_1", "sdlc_notices": ["string"] },
  "artifact_b_json": { "stack_tags": ["string"], "integration_method": "string", "legacy_volume": "string", "schemas": [], "contracts": [] },
  "completeness_score": 0.85,
  "flagged_void": null,
  "estimated_total_cost_vnd": 50000000,
  "estimated_total_duration_days": 20
}
``` |
| `POST /llm/elicitation/milestone-chat` | `MilestoneChatResponse` | ```json
{
  "reply": "I suggest increasing milestone 2 payment to 25,000,000 VND.",
  "suggested_edit": {
    "milestone_number": 2,
    "field": "paymentAmountVnd",
    "suggested_value": 25000000,
    "reason": "Standard data pipeline complexity"
  }
}
``` |
| `POST /llm/portfolio-eval` | `PortfolioEvalResponse` | ```json
{
  "confidence_score": 0.88,
  "passed_boolean": true,
  "gap_advisory": null
}
``` |
| `POST /llm/matching` | `list[MatchResult]` | ```json
[
  {
    "expert_id": "uuid-string",
    "composite_score": 0.875,
    "strength_label": "STRONG_MATCH",
    "gap_map": [
      { "seam_code": "A↔D", "color": "green" }
    ]
  }
]
``` |
| `POST /llm/dispute-eval` | `DisputeEvalResponse` | ```json
{
  "confidence_score": 0.82,
  "finding": "expert_wins",
  "reasoning": "Deliverable code meets criterion benchmark as written."
}
``` |
| `POST /llm/criterion-check` | `CriterionCheckResponse` | ```json
{
  "is_subjective": true,
  "suggestions": ["System handles >= 500 RPS at P99 latency < 200ms"],
  "severity": "HIGH",
  "context_note": "Unmeasurable requirement 'must be fast' risks milestone dispute."
}
``` |
| `POST /llm/service-generate` | `ServiceGenerateResponse` | ```json
{
  "title": "RAG Architecture Setup & Vector Search Tuning",
  "description": "Production-ready vector database indexing and prompt orchestration.",
  "scope": ["HNSW index setup", "Semantic chunking pipeline", "EXCLUDED: UI design"],
  "timeline": "Phase 1: Discovery (1 week)\nPhase 2: Build (2 weeks)\nTotal Estimated Time: 3 weeks",
  "suggested_price_vnd": 35000000,
  "suggested_domains": ["A", "D"],
  "suggested_seams": ["A↔D"],
  "pricing_rationale": "Medium complexity vector database integration."
}
``` |
| `GET /projects/{project_id}/artifact-b` | `GateCheckResult` | ```json
{
  "project_id": "uuid-string",
  "artifact_b_accessible": true
}
``` *(Returns HTTP 403 Forbidden with `{ "detail": "reason string" }` on denial)* |