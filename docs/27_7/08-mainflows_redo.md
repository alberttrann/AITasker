# AITasker — 20 Main Flows (40 Tables · 223 Endpoints)
### Complete End-to-End Workflow Specifications · ASCII Swimlanes · Step-by-Step Ledger Grounding

> **Purpose:** Definitive operational reference for all 20 system main flows, fully mapped from the Eraser.io BPMN swimlane definitions, NestJS controllers/services, FastAPI microservice, SePay payment integration, and PostgreSQL 40-table database schema.
>
> **Conventions:**
> - `[LEDGER]` = Immutable `wallet_transactions` entry written.
> - `[AI]` = FastAPI microservice LLM evaluation / synthesis call.
> - `[IPN]` = SePay payment gateway webhook received by NestJS.
> - **Bold Table Name** = Database table created or modified in step.
> - `[Pro-C]` / `[Pro-E]` = Subscription guard gate (`subscription_client_tier = 'pro'` / `subscription_expert_tier = 'pro'`).

---

## Master Flow Index

| MF ID | Flow Title | Primary Actors | Key Triggers & Outcomes |
|:---:|---|---|---|
| **MF-01** | User Registration & Email Verification | Guest User, Platform, Email Service | Registration → OTP verification → Account activation + Wallet & VA setup |
| **MF-02** | Login & JWT Authentication | User, Platform, Email Service | Credentials check → JWT issue OR unverified OTP block & auto-resend |
| **MF-03** | Wallet Top-Up via SePay IPN | User, Platform, SePay Gateway | VietQR transfer → HMAC webhook → Available balance credited |
| **MF-04** | Subscription Activation | User, Platform | Package selection → Wallet debit → Pro tier upgrade & JWT re-issuance |
| **MF-05** | AI Project Elicitation — Scenario A (Self-Tech CEO) | CEO, Platform, AI Service | 5-stage discovery → AI synthesis → Quality gate → Project published |
| **MF-06** | AI Project Elicitation — Scenario B (Tech Team) | CEO, Tech Team, Platform, AI Service | Stage 4 handoff link → Tech Team submission → AI synthesis → Project published |
| **MF-07** | Expert Shortlist Generation (Auto Matching) | Platform, AI Service | `project.published` event → Composite scoring → Shortlist cached |
| **MF-08** | Expert Invitation Flow | CEO, Expert, Platform | Shortlist invite → In-app & push notification → Expert bid or decline |
| **MF-09** | Capability Bid Submission & Tech Team Review | Expert, Platform, Tech Team | Footprint mapping → Tech Team scope review → Advancement to CEO |
| **MF-10** | CEO Bid Decision & Offer Negotiation | CEO, Expert, Platform | Commercial decision → Counter-offer rounds → Terms locked on acceptance |
| **MF-11** | NDA Acceptance & Engagement Connection | CEO, Expert, Platform | Dual NDA click-through → Engagement connected → Artifact B unlocked |
| **MF-12** | Milestone Setup (Create & Bulk Initialize) | CEO, Platform, AI Service | Single/bulk creation from framework → Sign-off authority derived |
| **MF-13** | Milestone Funding via SePay IPN | CEO, Platform, SePay Gateway | Fund initiation → VietQR payment → Escrow locked (`HELD`) → Docs released |
| **MF-14** | Deliverable Submission & DoD Completion | Expert, Platform | DoD checklist completion gate → Deliverable & files submitted |
| **MF-15** | Milestone Acceptance & Escrow Release | CEO, Tech Team, Expert, Platform | Criterion verification → Auto-approval → Escrow release & payout |
| **MF-16** | Dispute Filing & AI Layer 1 Evaluation | Filing Party, Platform, AI Service | Unverified criterion dispute → Escrow frozen → AI arbitration / auto-settlement |
| **MF-17** | Admin Manual Dispute Resolution | Admin, Platform, CEO, Expert | Escalated dispute queue → Admin review → Escrow release / refund / split |
| **MF-18** | Expert Portfolio Verification (Seam Tier Upgrade) | Expert, Platform, AI Service | Evidence submission → AI evaluation → Tier 2 `EVIDENCE_BACKED` upgrade |
| **MF-19** | Direct Service Purchase via SePay | CEO, Platform, SePay Gateway | Marketplace order → VietQR payment → Auto milestone #1 → Engagement active |
| **MF-20** | Post-Engagement Review | Platform, CEO, Expert, Tech Team | Engagement closed → Role-specific reviews & structured signals collected |

---

## Group 1 — Onboarding & Account Setup

---

### MF-01 · User Registration & Email Verification

**Trigger:** A guest visitor submits the registration form on the frontend.  
**Purpose:** Creates a user account, personal wallet, and permanent top-up virtual account atomically. Enforces email verification via a 6-digit numeric OTP before granting access.

#### ASCII Swimlane
```
GUEST USER                      PLATFORM (NestJS)                   EMAIL SERVICE
    │                                   │                                 │
    ├─ Submit Registration Form ───────>│                                 │
    │  (email, password, role)          ├─ Check Email Availability       │
    │                                   ├─ Email Available?               │
    │                                   │   ├─ [Taken] ──► Return 409     │
    │                                   │   └─ [Unique] ──┐               │
    │                                   │                 ▼               │
    │                                   ├─ DB TX (Atomic):                │
    │                                   │   - INSERT users                │
    │                                   │   - INSERT profile row          │
    │                                   │   - INSERT wallets              │
    │                                   │   - INSERT virtual_accounts     │
    │                                   ├─ Generate 6-Digit OTP           │
    │                                   ├─ Dispatch OTP Email ───────────>│
    │  <────────────────────────────────┴─────────────────────────────────┤ Send OTP Email
    ├─ Enter OTP Code ─────────────────>│                                 │
    │                                   ├─ Validate OTP Code              │
    │                                   ├─ OTP Result?                    │
    │                                   │   ├─ [Wrong] ──► Return 400     │
    │                                   │   ├─ [Expired] ─► Regenerate ──>│ Send New Email
    │                                   │   └─ [Correct] ─┐               │
    │                                   │                 ▼               │
    │                                   ├─ Set is_email_verified = true   │
    │                                   ├─ Issue JWT Access/Refresh Pair  │
    │  <────────────────────────────────┼─────────────────────────────────┘
    │  Registration Complete            │
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1 | Guest | Submits registration payload | — | — | `POST /auth/register` |
| 2 | Platform | Validates email uniqueness & password strength rules | `users` (R) | — | Internal |
| 3 | Platform | Atomic DB Transaction: creates user, role profile, wallet, and permanent `WALLET_TOPUP` virtual account | `users` (C), `client_profiles` / `expert_profiles` (C), `wallets` (C), `virtual_accounts` (C) | `is_email_verified = false` | DB Transaction |
| 4 | Platform | Generates 6-digit OTP code & sends email | `users` (U) | `email_otp` set | Nodemailer SMTP |
| 5 | Guest | Submits 6-digit OTP code | — | — | `POST /auth/verify-otp` |
| 6 | Platform | Validates OTP code & expiry timestamp | `users` (U) | `is_email_verified = true`, OTP cleared | `POST /auth/verify-otp` |
| 7 | Platform | Generates refresh token hash & issues JWT pair | `users` (U) | `refresh_token_hash` set | HTTP 201 Response |

---

### MF-02 · Login & JWT Authentication

**Trigger:** A returning user submits email and password.  
**Purpose:** Authenticates credentials, validates account verification/active status, and issues access/refresh tokens. Auto-resends OTP if the user's email remains unverified.

#### ASCII Swimlane
```
USER                            PLATFORM (NestJS)                   EMAIL SERVICE
    │                                   │                                 │
    ├─ Submit Login Credentials ───────>│                                 │
    │                                   ├─ Lookup User By Email           │
    │                                   ├─ Credentials Match?             │
    │                                   │   ├─ [No] ──► Return 401        │
    │                                   │   └─ [Yes] ─┐                   │
    │                                   │             ▼                   │
    │                                   ├─ Is Account Active?             │
    │                                   │   ├─ [No/Suspended] ─► 403      │
    │                                   │   └─ [Active] ──┐               │
    │                                   │                 ▼               │
    │                                   ├─ Is Email Verified?             │
    │                                   │   ├─ [No] ──┐                   │
    │                                   │   │         ▼                   │
    │                                   │   │   Resend Fresh OTP ────────>│ Send Unverified OTP
    │  <────────────────────────────────┼───┼── Return 401 EMAIL_UNVERIFIED
    │                                   │   │                             │
    │                                   │   └─ [Yes] ─┐                   │
    │                                   │             ▼                   │
    │                                   ├─ Issue Access + Refresh JWTs    │
    │                                   ├─ Store Refresh Token Hash       │
    │  <────────────────────────────────┴─────────────────────────────────┘
    │  Login Success
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1 | User | Submits email & password | — | — | `POST /auth/login` |
| 2 | Platform | Verifies password hash & checks `is_active = true` | `users` (R) | — | Internal |
| 3 | Platform | Checks `is_email_verified`. If false: auto-generates OTP, emails user, and blocks login | `users` (U) | `email_otp` updated | HTTP 401 `EMAIL_UNVERIFIED` |
| 4 | Platform | Generates JWT access token and refresh token | `users` (U) | `refresh_token_hash` updated | HTTP 201 Response |

---

### MF-03 · Wallet Top-Up via SePay IPN

**Trigger:** User transfers money via bank app to their permanent `WALLET_TOPUP` Virtual Account.  
**Purpose:** Credits user wallet available balance asynchronously upon receiving SePay HMAC-verified IPN callback.

#### ASCII Swimlane
```
USER                        PLATFORM (NestJS)                    SEPAY / BANK
    │                               │                                 │
    ├─ Navigate to Wallet ─────────>│                                 │
    │                               ├─ Return Permanent TOPUP VA      │
    │  <────────────────────────────┴─────────────────────────────────┤
    ├─ Transfer Funds via Bank ──────────────────────────────────────>│
    │                                                                 ├─ Process Bank Transfer
    │                                                                 ├─ Dispatch IPN Callback
    │                               │<────────────────────────────────┘
    │                               ├─ Receive IPN Webhook (`POST /webhooks/sepay/ipn`)
    │                               ├─ Verify HMAC-SHA256 Signature
    │                               ├─ Signature Valid?
    │                               │   ├─ [No] ──► Reject 401
    │                               │   └─ [Yes] ─┐
    │                               │             ▼
    │                               ├─ Check Idempotency (`referenceCode`)
    │                               ├─ Already Processed?
    │                               │   ├─ [Yes] ─► Return 200 (Skip)
    │                               │   └─ [No] ──┐
    │                               │             ▼
    │                               ├─ Atomic DB Transaction:
    │                               │   - UPDATE `wallets.available_balance += amount`
    │                               │   - INSERT `wallet_transactions` (`TOP_UP`) [LEDGER]
    │                               ├─ Emit Socket.io `wallet:balance-updated`
    │  <────────────────────────────┴─────────────────────────────────┘
    │  Balance Updated Real-Time
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1 | User | Requests top-up details | `virtual_accounts` (R) | — | `POST /wallets/virtual-accounts/topup` |
| 2 | SePay | Dispatches signed IPN webhook payload | — | — | `POST /webhooks/sepay/ipn` |
| 3 | Platform | Verifies HMAC-SHA256 signature and checks transaction idempotency | `wallet_transactions` (R) | — | Middleware |
| 4 | Platform | Credits wallet balance and logs ledger transaction | `wallets` (U), `wallet_transactions` (C) | `available_balance` credited | DB Transaction |
| 5 | Platform | Emits real-time balance update WebSocket event | — | — | WebSocket `wallet:balance-updated` |

---

### MF-04 · Subscription Activation

**Trigger:** User selects a subscription plan and clicks "Activate".  
**Purpose:** Deducts package cost from available balance, upgrades subscription tier, logs purchase, and re-issues a new JWT embedding upgraded tier claims.

#### ASCII Swimlane
```
USER                            PLATFORM (NestJS)
    │                                   │
    ├─ Browse Subscription Plans ──────>│
    │                                   ├─ SELECT active packages for role
    │  <────────────────────────────────┴─────────────────────────────────┐
    ├─ Confirm Plan Purchase ──────────>│
    │  (packageId)                      ├─ Validate Role Context
    │                                   ├─ Validate Package `is_active = true`
    │                                   ├─ Check Idempotency (Already Pro?)
    │                                   ├─ Check Wallet Balance
    │                                   ├─ Balance Sufficient?
    │                                   │   ├─ [No] ──► Reject 422 INSUFFICIENT_BALANCE
    │                                   │   └─ [Yes] ─┐
    │                                   │             ▼
    │                                   ├─ Atomic DB Transaction:
    │                                   │   - UPDATE `wallets.available_balance -= price`
    │                                   │   - INSERT `wallet_transactions` (`SUBSCRIPTION`) [LEDGER]
    │                                   │   - UPDATE `users.subscription_{role}_tier = 'pro'`
    │                                   │   - UPDATE `users.sub_{role}_expires_at = now + duration`
    │                                   │   - INSERT `subscription_purchase_logs`
    │                                   ├─ Re-issue JWT with upgraded tier claims
    │  <────────────────────────────────┴─────────────────────────────────┘
    │  Subscription Active & JWT Updated
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1 | User | Fetches active subscription plans for active role | `subscription_packages` (R) | — | `GET /config/subscription-packages` |
| 2 | User | Submits subscription activation request | — | — | `POST /subscriptions/activate` |
| 3 | Platform | Validates active role, package status, non-active tier, and balance | `users` (R), `subscription_packages` (R), `wallets` (R) | — | Internal |
| 4 | Platform | Atomic DB Transaction: debits wallet, logs transaction, updates user subscription tier/expiry, creates purchase log | `wallets` (U), `wallet_transactions` (C), `users` (U), `subscription_purchase_logs` (C) | `subscription_{role}_tier = 'pro'` | DB Transaction |
| 5 | Platform | Generates and returns new JWT access token with `'pro'` tier | — | — | HTTP 201 Response |

---

## Group 2 — Path A: AI Elicitation & Project Publication

---

### MF-05 · AI Project Elicitation — Scenario A (Self-Technical CEO)

**Trigger:** Pro-tier CEO clicks "Start New Project" and progresses through the 5-stage discovery wizard.  
**Purpose:** Transforms free-text business problems into structured, machine-readable project specs and milestone blueprints. Runs 3-gate quality check before publishing.

#### ASCII Swimlane
```
CLIENT / CEO                     PLATFORM (NestJS)                   FASTAPI AI SERVICE
    │                                    │                                    │
    ├─ Create Session [Pro-C] ──────────>│                                    │
    │                                    ├─ INSERT `elicitation_sessions`     │
    │  <─────────────────────────────────┴────────────────────────────────────┤
    ├─ Stage 1: Submit Symptom Text ────>│                                    │
    │                                    ├─ Fetch active CMS archetypes/voids │
    │                                    ├─ Call Stage 1 Extract ────────────>│
    │                                    │                                    ├─ Parse symptoms & voids
    │                                    │<───────────────────────────────────┴─ Return extracted JSON
    │                                    ├─ UPDATE session (stage = 2)        │
    │  <─────────────────────────────────┴────────────────────────────────────┤
    ├─ Stage 2: Select Archetype ───────>│                                    │
    │  & Acknowledge Voids               ├─ Lock archetype, set voids injected│
    │                                    ├─ UPDATE session (stage = 3)        │
    │  <─────────────────────────────────┴────────────────────────────────────┤
    ├─ Stage 3: Answer Probes ──────────>│                                    │
    │                                    ├─ Call Vagueness Check ────────────>│
    │                                    │                                    ├─ Check vagueness & relevancy
    │                                    │<───────────────────────────────────┴─ Return advisory flags
    │                                    ├─ UPDATE session (stage = 4)        │
    │  <─────────────────────────────────┴────────────────────────────────────┤
    ├─ Stage 4: Tech Context ───────────>│                                    │
    │  (Stack, Volume, Artifacts)        ├─ UPDATE session (stage = 5)        │
    │  <─────────────────────────────────┴────────────────────────────────────┤
    ├─ Stage 5: Run AI Synthesis ───────>│                                    │
    │                                    ├─ Fetch live CMS definitions        │
    │                                    ├─ Call Stage 5 Synthesize ─────────>│
    │                                    │                                    ├─ Synthesize Artifact A/B
    │                                    │<───────────────────────────────────┴─ Return full spec JSON
    │                                    ├─ Evaluate 3-Gate Quality Check:    │
    │                                    │   1. completeness_score >= 0.70    │
    │                                    │   2. No unresolved HIGH voids      │
    │                                    │   3. Matching expert count >= 1    │
    │                                    ├─ Gate Passed?                      │
    │                                    │   ├─ [Pass] ─► Atomic DB TX:       │
    │                                    │   │   - INSERT `projects`          │
    │                                    │   │   - UPDATE session `COMPLETED` │
    │                                    │   │   - INSERT `platform_decisions`│
    │                                    │   │   - Seed Shortlist Cache       │
    │                                    │   └─ [Fail] ─► UPDATE `RETURNED`   │
    │  <─────────────────────────────────┴────────────────────────────────────┘
    │  Project Published OR Returned
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1 | CEO | Creates elicitation session | `elicitation_sessions` (C) | `state = 'IN_PROGRESS'`, `stage = 1` | `POST /elicitation/sessions` |
| 2 | CEO | Submits Stage 1 symptom text | `elicitation_sessions` (U) | `stage = 2` | `PUT /elicitation/sessions/:id/stage1` |
| 3 | AI | Parses symptoms, scale signals, void codes, critical artifacts | `archetype_definitions` (R), `void_code_definitions` (R) | — | FastAPI `/llm/elicitation/stage1-extract` |
| 4 | CEO | Selects archetype & acknowledges void codes | `elicitation_sessions` (U) | `stage = 3`, `archetype` locked | `PUT /elicitation/sessions/:id/stage2` |
| 5 | CEO | Submits Stage 3 probe responses | `elicitation_sessions` (U), `probe_questions` (R) | `stage = 4` | `PUT /elicitation/sessions/:id/stage3` |
| 6 | CEO | Submits Stage 4 technical context & documents | `elicitation_sessions` (U) | `stage = 5` | `PUT /elicitation/sessions/:id/stage4` |
| 7 | AI | Synthesizes Artifact A/B & milestone framework | `domain_definitions` (R), `seam_definitions` (R) | — | FastAPI `/llm/elicitation/stage5-synthesize` |
| 8 | Platform | Evaluates quality gates; creates published project or returns session | `projects` (C), `elicitation_sessions` (U), `platform_decisions` (C) | `projects.state = 'PUBLISHED'` OR session `state = 'RETURNED'` | `POST /elicitation/sessions/:id/stage5` |

---

### MF-06 · AI Project Elicitation — Scenario B (Tech Team Delegation)

**Trigger:** Non-technical CEO completes Stages 1–3, declares in-house tech team, and delegates Stage 4.  
**Purpose:** Generates a 72-hour signed handoff link. Tech Team completes technical inputs; CEO executes Stage 5 synthesis.

#### ASCII Swimlane
```
CLIENT / CEO                     PLATFORM (NestJS)                CLIENT / TECH TEAM
    │                                    │                                 │
    ├─ Complete Stages 1–3 ─────────────>│                                 │
    ├─ Generate Handoff Link ───────────>│                                 │
    │                                    ├─ Create Handoff JWT (72h)       │
    │                                    ├─ UPDATE `handoffTokenJti`       │
    │  <─────────────────────────────────┴─────────────────────────────────┤
    ├─ Share Link via Email/Chat ─────────────────────────────────────────>│
    │                                    │                                 ├─ Open Link
    │                                    │<────────────────────────────────┼─ Register/Login via Handoff
    │                                    ├─ Consume Handoff Token          │
    │                                    ├─ Link `tech_team_profiles`      │
    │                                    │────────────────────────────────>│
    │                                    │                                 ├─ Complete Stage 4 Technical Form
    │                                    │<────────────────────────────────┼─ Submit Stage 4 Handoff
    │                                    ├─ UPDATE session (stage = 5)     │
    │                                    ├─ Emit Socket.io Event ─────────>│
    │  <─────────────────────────────────┤                                 │
    ├─ Run Stage 5 AI Synthesis ────────>│                                 │
    │                                    ├─ Execute Stage 5 AI Call        │
    │                                    ├─ Atomic DB TX:                  │
    │                                    │   - INSERT `projects`           │
    │                                    │   - Link `linked_project_id`    │
    │                                    │   - UPDATE session `COMPLETED`  │
    │  <─────────────────────────────────┴─────────────────────────────────┘
    │  Project Live & Tech Team Linked
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1 | CEO | Generates handoff link | `elicitation_sessions` (U) | `handoffTokenJti` set | `POST /elicitation/sessions/:id/generate-handoff-link` |
| 2 | Tech Team | Authenticates via handoff token | `users` (C), `tech_team_profiles` (C), `elicitation_sessions` (U) | `handoffConsumedAt = now()` | `POST /auth/register/handoff` |
| 3 | Tech Team | Submits Stage 4 technical context | `elicitation_sessions` (U) | `stage = 5` | `PUT /elicitation/sessions/:id/stage4-handoff` |
| 4 | CEO | Triggers Stage 5 synthesis | `projects` (C), `tech_team_profiles` (U), `elicitation_sessions` (U) | `projects.state = 'PUBLISHED'`, `linked_project_id` set | `POST /elicitation/sessions/:id/stage5` |

---

### MF-07 · Expert Shortlist Generation (Auto Matching)

**Trigger:** Internal `project.published` event emitted when Stage 5 synthesis passes quality gate.  
**Purpose:** Scores active Experts against required seams/domains using the 5-dimension composite algorithm and caches ranked shortlist.

#### ASCII Swimlane
```
PLATFORM (NestJS Event)               FASTAPI AI SERVICE            DATABASE / CACHE
          │                                   │                            │
          ├─ `project.published` Event        │                            │
          ├─ Query Active Expert Profiles ────┼───────────────────────────>│
          │<──────────────────────────────────┼────────────────────────────┤
          ├─ Call AI Matching Engine ────────>│                            │
          │                                   ├─ Execute 5-Dimension Score │
          │                                   ├─ Hard Gate 4:1 Filter      │
          │<──────────────────────────────────┴─ Return Ranked Candidates  │
          ├─ UPSERT `project_shortlist_cache` ────────────────────────────>│
          │  (`source = 'AUTO'`)              │                            │
          │                                   │                            │
[CEO Force Refresh Variant]:                  │                            │
CEO Calls GET /matching/:id/shortlist?refresh=true                         │
          ├─ Evict Cache & Re-run Matching ──>│                            │
          ├─ UPSERT `project_shortlist_cache` ────────────────────────────>│
          │  (`source = 'FORCE_REFRESH'`)     │                            │
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1 | Platform | Event listener handles `project.published` | `projects` (R), `users` (R), `expert_profiles` (R), `expert_domain_depths` (R), `expert_seam_claims` (R) | — | EventEmitter `project.published` |
| 2 | AI | Calculates composite match scores & gap maps | — | — | FastAPI `/llm/matching` |
| 3 | Platform | Upserts shortlist cache | `project_shortlist_cache` (C/U) | Shortlist cached | Internal |
| 4 | CEO | (Optional) Forces shortlist re-scoring | `project_shortlist_cache` (U) | `source = 'FORCE_REFRESH'` | `GET /matching/:projectId/shortlist?refresh=true` |

---

### MF-08 · Expert Invitation Flow

**Trigger:** CEO views shortlist and sends direct project invitation to an Expert.  
**Purpose:** Dispatches 7-day project invitation to Expert. Auto-accepts if Expert submits a bid.

#### ASCII Swimlane
```
CLIENT / CEO                     PLATFORM (NestJS)                      EXPERT
    │                                    │                                 │
    ├─ View Match Shortlist ────────────>│                                 │
    │                                    ├─ Query `project_shortlist_cache`│
    │  <─────────────────────────────────┴─────────────────────────────────┤
    ├─ Send Expert Invitation ──────────>│                                 │
    │  (Socket event `inviteExpert`)     ├─ UPSERT `invitations`           │
    │                                    │  (`status = 'PENDING'`, 7d exp) │
    │                                    ├─ INSERT `notifications`         │
    │                                    ├─ Emit `notification:generic` ──>│
    │                                    │                                 ├─ View Invitations
    │                                    │                                 ├─ Decision?
    │                                    │                                 │   ├─ [Decline] ──┐
    │                                    │<────────────────────────────────┼───┘              │
    │                                    ├─ UPDATE `status = 'DECLINED'`   │                  │
    │                                    │                                 │                  │
    │                                    │                                 ├─ [Submit Bid] ───┤
    │                                    │<────────────────────────────────┼──────────────────┘
    │                                    ├─ Auto-update `status = 'ACCEPTED'`
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1 | CEO | Sends project invitation | `invitations` (C/U), `notifications` (C), `messages` (C) | `invitations.status = 'PENDING'` | Socket.io `inviteExpert` |
| 2 | Expert | Views received invitations | `invitations` (R), `projects` (R), `client_profiles` (R) | — | `GET /invitations` |
| 3a | Expert | Declines invitation | `invitations` (U) | `status = 'DECLINED'` | `POST /invitations/:id/decline` |
| 3b | Expert | Accepts via bid submission | `invitations` (U) | `status = 'ACCEPTED'` | `POST /bids` (side effect) |

---

## Group 3 — Bidding, Negotiation & Connection

---

### MF-09 · Capability Bid Submission & Tech Team Review

**Trigger:** Shortlisted Expert submits a capability proposal for a published project.  
**Purpose:** Evaluates technical scope through Tech Team review (for non-self-technical projects) before advancing to CEO commercial decision.

#### ASCII Swimlane
```
EXPERT                           PLATFORM (NestJS)                    TECH TEAM
  │                                      │                                │
  ├─ Submit Capability Bid ─────────────>│                                │
  │                                      ├─ Check Shortlist Eligibility   │
  │                                      ├─ Is Self-Technical Project?    │
  │                                      │   ├─ [Yes] ─► `tech_status = 'APPROVED'`
  │                                      │   └─ [No] ──► `tech_status = 'PENDING'`
  │                                      ├─ Serializable Transaction:     │
  │                                      │   - INSERT `engagements`       │
  │                                      │   - INSERT `capability_bids`   │
  │                                      ├─ Notify CEO + ALL Tech Team ──>│
  │                                      │                                ├─ Review Scope
  │                                      │                                ├─ Decision?
  │                                      │                                │   ├─ [Approve] ──┐
  │                                      │<───────────────────────────────┼───┘              │
  │                                      ├─ UPDATE `tech_status = 'APPROVED'`                │
  │                                      │  (`state = 'SUBMITTED'`)       │                  │
  │                                      │                                │                  │
  │                                      │                                ├─ [Revision] ─────┤
  │                                      │<───────────────────────────────┼──────────────────┘
  │                                      ├─ UPDATE `tech_status = 'REVISION_REQUESTED'`
  │<─────────────────────────────────────┤  Record `tech_feedback`
  ├─ Resubmit Revised Bid ──────────────>│ (Increments `versionNumber`)
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1 | Expert | Submits capability bid | `engagements` (C), `capability_bids` (C), `invitations` (U) | `bids.state = 'SUBMITTED'`, `engagements.state = 'PENDING'` | `POST /bids` |
| 2 | Tech Team | Reviews scope & submits evaluation | `capability_bids` (U) | `tech_status = 'APPROVED'` OR `'REVISION_REQUESTED'` | `PUT /bids/:id/tech-review` |
| 3 | Expert | Resubmits revised proposal | `capability_bids` (U) | `version_number` incremented | `PUT /bids/:id` |

---

### MF-10 · CEO Bid Decision & Offer Negotiation

**Trigger:** Bid reaches `CEO_REVIEW` state or counter-offer round is initiated.  
**Purpose:** Handles multi-round commercial negotiation between CEO and Expert. Locks contract terms upon offer acceptance.

#### ASCII Swimlane
```
CLIENT / CEO                     PLATFORM (NestJS)                      EXPERT
    │                                    │                                 │
    ├─ Review Approved Bid ─────────────>│                                 │
    ├─ Commercial Action?                │                                 │
    │   ├─ [Decline] ───────────────────>│                                 │
    │   │                                ├─ UPDATE bid & engagement `DECLINED`
    │   │                                │                                 │
    │   ├─ [Counter-Offer] ─────────────>│                                 │
    │   │                                ├─ Validate non-proposer response │
    │   │                                ├─ UPDATE envelope (new offer)   │
    │   │                                ├─ Increment `version_number`     │
    │   │                                ├─ Notify Expert ────────────────>│
    │   │                                │                                 ├─ Evaluate Counter
    │   │                                │<────────────────────────────────┼─ Accept / Counter / Decline
    │   │                                │                                 │
    │   └─ [Accept Offer] ──────────────>│                                 │
    │                                    ├─ Lock Contract Terms            │
    │                                    ├─ UPDATE `bids.state = 'SELECTED'`
    │                                    ├─ Instantiate Contract Milestones│
    │                                    ├─ Decline Competing Bids         │
    │  <─────────────────────────────────┴─────────────────────────────────┘
    │  Terms Locked; Proceed to NDA
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1 | CEO / Expert | Submits counter-offer round | `capability_bids` (U) | New offer appended, `version_number`++ | `POST /bids/:id/offers` |
| 2a | CEO / Expert | Accepts current offer | `capability_bids` (U), `milestones` (C), `acceptance_criteria` (C), `projects` (U), `engagements` (U) | `bids.state = 'SELECTED'`, terms locked | `POST /bids/:id/offers/:offerId/accept` |
| 2b | CEO / Expert | Declines current offer | `capability_bids` (U), `engagements` (U) | `bids.state = 'DECLINED'` | `POST /bids/:id/offers/:offerId/decline` |

---

### MF-11 · NDA Acceptance & Engagement Connection

**Trigger:** Bid offer accepted; engagement enters `PENDING` state with NDA prompts.  
**Purpose:** Collects independent digital NDA signatures from CEO and Expert. Automatically connects engagement and unlocks technical Artifact B when both sign.

#### ASCII Swimlane
```
CLIENT / CEO                     PLATFORM (NestJS)                      EXPERT
    │                                    │                                 │
    ├─ Accept CEO NDA ──────────────────>│                                 │
    │                                    ├─ `client_nda_accepted_at = now()`
    │                                    ├─ Both Signed? (No)              │
    │                                    ├─ Notify Expert ────────────────>│
    │                                    │                                 ├─ Accept Expert NDA
    │                                    │<────────────────────────────────┼─ (`POST /engagements/:id/connect`)
    │                                    ├─ `expert_nda_accepted_at = now()`
    │                                    ├─ Both Signed? (Yes)             │
    │                                    ├─ UPDATE `engagements.state = 'CONNECTED'`
    │                                    ├─ Check Bank Link                │
    │                                    │   (Prompt if missing)           │
    │  <─────────────────────────────────┴─────────────────────────────────┘
    │  Engagement CONNECTED; Artifact B Unlocked
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1 | CEO | Accepts platform NDA | `engagements` (U) | `client_nda_accepted_at` set | `PUT /engagements/:id/accept-nda` |
| 2 | Expert | Accepts platform NDA & connects | `engagements` (U), `users` (R) | `expert_nda_accepted_at` set, `state = 'CONNECTED'` | `POST /engagements/:id/connect` |
| 3 | Expert | (Optional) Declines connection | `engagements` (U) | `state = 'DECLINED'` | `PUT /engagements/:id/decline` |

---

## Group 4 — Path A: Milestones, Execution & Disputes

---

### MF-12 · Milestone Setup (Create & Bulk Initialize)

**Trigger:** CEO opens Milestone Workspace for a `CONNECTED` engagement.  
**Purpose:** Defines delivery milestones and criteria. Supports one-click bulk initialization from AI framework.

#### ASCII Swimlane
```
CLIENT / CEO                     PLATFORM (NestJS)                   FASTAPI AI SERVICE
    │                                    │                                    │
    ├─ Option A: Single Milestone ──────>│                                    │
    │  (`POST /milestones`)              ├─ Derive `signOffAuthority`         │
    │                                    ├─ INSERT `milestones`               │
    │                                    ├─ INSERT `acceptance_criteria`      │
    │                                    ├─ Async Criterion Quality Gate ────>│
    │                                    │                                    ├─ Evaluate subjectivity
    │                                    │<───────────────────────────────────┴─ Return quality flags
    │                                    ├─ Log `platform_decisions`          │
    │  <─────────────────────────────────┤  (`CRITERION_QUALITY_GATE`)        │
    │                                    │                                    │
    ├─ Option B: Bulk Initialize ───────>│                                    │
    │  (`POST /milestones/bulk`)         ├─ Guard: Zero existing milestones   │
    │                                    ├─ Guard: Tech Team handoff complete │
    │                                    ├─ Atomic DB TX:                     │
    │                                    │   - INSERT all `milestones`        │
    │                                    │   - INSERT all `acceptance_criteria`
    │  <─────────────────────────────────┴────────────────────────────────────┘
    │  Milestones Instantiated in `DEFINED` State
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1a | CEO | Creates single milestone | `milestones` (C), `acceptance_criteria` (C) | `state = 'DEFINED'` | `POST /milestones` |
| 1b | CEO | Bulk initializes from framework | `milestones` (C), `acceptance_criteria` (C) | All milestones `DEFINED` | `POST /milestones/bulk` |
| 2 | AI | Evaluates criterion quality asynchronously | `platform_decisions` (C) | Logs `CRITERION_QUALITY_GATE` | FastAPI `/llm/criterion-check` |
| 3 | CEO | (Optional) Edits/deletes defined milestone | `milestones` (U/D), `acceptance_criteria` (D) | — | `PATCH /milestones/:id`, `DELETE /milestones/:id` |

---

### MF-13 · Milestone Funding via SePay IPN

**Trigger:** CEO clicks "Fund Milestone" and executes bank transfer via VietQR.  
**Purpose:** Generates a 24-hour virtual account, processes inbound IPN webhook, locks escrow funds, and auto-releases pay-gated documents.

#### ASCII Swimlane
```
CLIENT / CEO                 PLATFORM (NestJS)                  SEPAY / BANK
     │                               │                               │
     ├─ Initiate Funding ───────────>│                               │
     │                               ├─ Generate 24h Virtual Account │
     │                               ├─ UPDATE `state = 'AWAITING_PAYMENT'`
     │  <────────────────────────────┴───────────────────────────────┤
     ├─ Transfer Funds via VietQR ──────────────────────────────────>│
     │                                                               ├─ Process Transfer
     │                               │<──────────────────────────────┴─ Dispatch IPN Callback
     │                               ├─ HMAC Signature Verification  │
     │                               ├─ Amount Match & Idempotency   │
     │                               ├─ Atomic DB Transaction:       │
     │                               │   - Debit `available_balance` │
     │                               │   - Credit `locked_balance`    │
     │                               │   - INSERT `wallet_transactions` (`ESCROW_LOCK`) [LEDGER]
     │                               │   - INSERT `escrow_accounts` (`HELD`)
     │                               │   - UPDATE `milestones.state = 'IN_PROGRESS'`
     │                               │   - UPDATE `virtual_accounts.status = 'USED'`
     │                               │   - Bulk-release `paygated_documents` (`RELEASED`)
     │                               │   - UPDATE `engagements.state = 'ACTIVE'` (if 1st milestone)
     │                               ├─ Emit Real-Time Socket Events │
     │  <────────────────────────────┴───────────────────────────────┘
     │  Milestone Funded & Work Active
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1 | CEO | Initiates milestone funding | `virtual_accounts` (C), `milestones` (U) | `milestones.state = 'AWAITING_PAYMENT'` | `PUT /milestones/:id/fund` |
| 2 | SePay | Dispatches signed IPN webhook | — | — | `POST /webhooks/sepay/ipn` |
| 3 | Platform | Atomic Ledger TX: locks escrow, advances milestone, releases pay-gated documents, activates engagement | `wallets` (U), `wallet_transactions` (C), `escrow_accounts` (C), `milestones` (U), `virtual_accounts` (U), `paygated_documents` (U), `engagements` (U) | `milestones.state = 'IN_PROGRESS'`, `escrow.status = 'HELD'`, `documents.release_state = 'RELEASED'` | DB Transaction |

---

### MF-14 · Deliverable Submission & DoD Completion

**Trigger:** Expert completes work on a funded milestone, finishes DoD checklist, and submits deliverables.  
**Purpose:** Enforces DoD checklist completion gate before allowing formal deliverable submission.

#### ASCII Swimlane
```
EXPERT                           PLATFORM (NestJS)
  │                                      │
  ├─ Update DoD Checklist Item ─────────>│
  │  (Mark COMPLETED / NOT_APPLICABLE)   ├─ Check DB constraint `dod_required_cannot_be_na`
  │                                      ├─ UPDATE `milestone_dod_items`
  │  <───────────────────────────────────┴─────────────────────────────────┐
  ├─ Stage Pay-Gated Documents ─────────>│                                 │
  │                                      ├─ INSERT `paygated_documents`    │
  │                                      │  (`release_state = 'RELEASED'`) │
  │  <───────────────────────────────────┴─────────────────────────────────┤
  ├─ Submit Milestone Deliverables ─────>│                                 │
  │  (description, file URLs)            ├─ DoD Completion Gate Check:     │
  │                                      │   SELECT incomplete required items
  │                                      │   IF > 0 ──► Reject 422 `REQUIRED_DOD_INCOMPLETE`
  │                                      │   IF == 0 ─► DB Transaction:    │
  │                                      │     - INSERT `milestone_submissions`
  │                                      │     - UPDATE `milestones.state = 'SUBMITTED'`
  │                                      ├─ Emit Socket.io Notifications   │
  │  <───────────────────────────────────┴─────────────────────────────────┘
  │  Deliverables Submitted for Review
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1 | Expert | Updates DoD item status | `milestone_dod_items` (U) | `status = 'COMPLETED'` | `PUT /milestones/:id/dod/:itemId` |
| 2 | Expert | Stages pay-gated document | `paygated_documents` (C) | `release_state = 'RELEASED'` (if funded) | `POST /milestones/:id/paygated-docs` |
| 3 | Expert | Submits deliverable handover | `milestone_submissions` (C), `milestones` (U) | `milestones.state = 'SUBMITTED'` | `POST /milestones/:id/submit` |
| 4 | Expert | (Optional) Retracts submission | `milestone_submissions` (D), `milestones` (U) | Reverts `state = 'IN_PROGRESS'` | `DELETE /milestones/:id/submissions/latest` |

---

### MF-15 · Milestone Acceptance & Escrow Release

**Trigger:** Reviewer verifies acceptance criteria on a submitted milestone.  
**Purpose:** Verifies criteria per sign-off authority. Auto-approves milestone and disburses escrow payout when all criteria pass.

#### ASCII Swimlane
```
REVIEWER (Tech / CEO)             PLATFORM (NestJS)                       EXPERT
     │                                    │                                 │
     ├─ Review Submission                 │                                 │
     ├─ Decision?                         │                                 │
     │   ├─ [Revision Requested] ────────>│                                 │
     │   │                                ├─ UPDATE `acceptance_criteria`   │
     │   │                                │  (`revision_note` recorded)     │
     │   │                                ├─ UPDATE `milestones.state = 'IN_REVISION'`
     │   │                                ├─ Notify Expert ────────────────>│
     │   │                                │                                 ├─ Re-work & Resubmit
     │   │                                │                                 │
     │   └─ [Verify Criterion] ──────────>│                                 │
     │                                    ├─ Set `techVerifiedAt` / `ceoVerifiedAt`
     │                                    ├─ All Required Criteria Verified?│
     │                                    │   ├─ [No] ─► Await remaining    │
     │                                    │   └─ [Yes] ┐                    │
     │                                    │            ▼                    │
     │                                    ├─ Check Open Disputes (None)     │
     │                                    ├─ Atomic Escrow Release TX:      │
     │                                    │   - Calculate platform fee      │
     │                                    │   - Unlock client `locked_balance`
     │                                    │   - Credit platform wallet fee  │
     │                                    │   - Credit expert `available_balance`
     │                                    │   - INSERT 3 `wallet_transactions` [LEDGER]
     │                                    │   - UPDATE `escrow_accounts.status = 'RELEASED'`
     │                                    │   - UPDATE `milestones.state = 'APPROVED'`
     │                                    │   - IF Expert Bank Linked:      │
     │                                    │       * Auto-create `withdrawal_requests`
     │                                    │       * Debit expert balance    │
     │                                    │       * INSERT `WITHDRAWAL` tx  │
     │                                    ├─ IF all milestones complete:    │
     │                                    │   UPDATE `engagements.state = 'CLOSED'`
     │  <─────────────────────────────────┴─────────────────────────────────┘
     │  Milestone Approved & Payout Released
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1a | Reviewer | Requests criterion revision | `acceptance_criteria` (U), `milestones` (U) | `milestones.state = 'IN_REVISION'` | `PUT /criteria/:id/revision` |
| 1b | Reviewer | Verifies criterion | `acceptance_criteria` (U) | Verification timestamp set | `PUT /criteria/:id/verify` |
| 2 | Platform | Atomic Ledger TX: releases escrow, deducts platform fee, credits expert, auto-withdraws if bank linked | `wallets` (U×3), `wallet_transactions` (C×3), `escrow_accounts` (U), `milestones` (U), `withdrawal_requests` (C), `engagements` (U) | `milestones.state = 'APPROVED'`, `escrow.status = 'RELEASED'` | DB Transaction |

---

### MF-16 · Dispute Filing & AI Layer 1 Evaluation

**Trigger:** Client or Expert files a dispute on an unverified criterion.  
**Purpose:** Atomically freezes escrow, sets milestone to `DISPUTED`, and invokes FastAPI AI dispute evaluator. Auto-resolves if confidence ≥ 0.80.

#### ASCII Swimlane
```
FILING PARTY                     PLATFORM (NestJS)                   FASTAPI AI SERVICE
     │                                   │                                    │
     ├─ File Dispute on Criterion ──────>│                                    │
     │                                   ├─ Atomic DB Transaction:            │
     │                                   │   - INSERT `disputes`              │
     │                                   │   - UPDATE `escrow_accounts.status = 'FROZEN'`
     │                                   │   - UPDATE `milestones.state = 'DISPUTED'`
     │                                   ├─ Call Layer 1 Dispute Eval ───────>│
     │                                   │                                    ├─ Evaluate evidence
     │                                   │<───────────────────────────────────┴─ Return confidence & finding
     │                                   ├─ `llm_confidence >= 0.80`?          │
     │                                   │   ├─ [Yes: AUTO_RESOLVED] ┐        │
     │                                   │   │  Execute Ledger TX:   │        │
     │                                   │   │  - EXPERT_WINS ───────┤        │
     │                                   │   │  - CLIENT_REFUND ─────┤        │
     │                                   │   │  - SPLIT (50/50) ─────┘        │
     │                                   │   │                                │
     │                                   │   └─ [No: MANUAL_REVIEW] ─┐        │
     │                                   │      - Set `MANUAL_REVIEW`│        │
     │                                   │      - Route to Admin ────┘        │
     │  <────────────────────────────────┴────────────────────────────────────┘
     │  Dispute Auto-Resolved OR Routed to Admin Queue
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1 | Filer | Files dispute against unverified criterion | `disputes` (C), `escrow_accounts` (U), `milestones` (U) | `escrow.status = 'FROZEN'`, `milestones.state = 'DISPUTED'` | `POST /disputes` |
| 2 | AI | Evaluates criterion vs deliverable evidence | — | — | FastAPI `/llm/dispute-eval` |
| 3a | Platform | Auto-resolves dispute if confidence ≥ 0.80 | `disputes` (U), `acceptance_criteria` (U), `escrow_accounts` (U), `wallets` (U), `wallet_transactions` (C), `platform_decisions` (C) | `disputes.state = 'AUTO_RESOLVED'`, escrow settled | DB Transaction |
| 3b | Platform | Routes to manual review if confidence < 0.80 | `disputes` (U) | `disputes.state = 'MANUAL_REVIEW'` | Internal |

---

### MF-17 · Admin Manual Dispute Resolution

**Trigger:** Admin opens an escalated dispute in `MANUAL_REVIEW` state.  
**Purpose:** Human-in-the-loop arbitration. Admin selects resolution (`EXPERT_WINS`, `CLIENT_WINS`, or `SPLIT`) and executes atomic ledger distribution.

#### ASCII Swimlane
```
ADMIN                            PLATFORM (NestJS)                   ENGAGEMENT PARTIES
  │                                      │                                    │
  ├─ View Dispute Queue ────────────────>│                                    │
  │  (`GET /admin/disputes`)             ├─ Query `MANUAL_REVIEW` disputes    │
  │  <───────────────────────────────────┴────────────────────────────────────┤
  ├─ Select Resolution Option ──────────>│                                    │
  │  (`PUT /admin/disputes/:id/resolve`) ├─ Atomic Ledger Resolution TX:       │
  │                                      │   ├─ `EXPERT_WINS`:                │
  │                                      │   │   * Verify criterion           │
  │                                      │   │   * Escrow → Expert            │
  │                                      │   ├─ `CLIENT_WINS`:                │
  │                                      │   │   * Escrow → Client Refund     │
  │                                      │   └─ `SPLIT`:                      │
  │                                      │       * 50/50 Escrow Division      │
  │                                      ├─ UPDATE `disputes.state = 'RESOLVED'`
  │                                      ├─ INSERT `platform_decisions`       │
  │                                      ├─ Emit Socket.io Notifications ────>│
  │  <───────────────────────────────────┴────────────────────────────────────┘
  │  Dispute Manually Settled & Ledger Updated
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1 | Admin | Fetches escalated dispute queue | `disputes` (R), `milestones` (R), `escrow_accounts` (R) | — | `GET /admin/disputes` |
| 2 | Admin | Executes manual dispute settlement | `disputes` (U), `acceptance_criteria` (U), `escrow_accounts` (U), `wallets` (U), `wallet_transactions` (C), `platform_decisions` (C) | `disputes.state = 'RESOLVED'`, escrow settled | `PUT /admin/disputes/:id/resolve` |

---

## Group 5 — Expert Capability & Marketplace Services

---

### MF-18 · Expert Portfolio Verification (Seam Tier Upgrade)

**Trigger:** Pro-tier Expert submits project evidence to upgrade a seam claim to Tier 2 (`EVIDENCE_BACKED`).  
**Purpose:** Validates cross-domain evidence via FastAPI AI portfolio evaluator. Upgrades seam verification tier on pass; enforces 30-day lockout on 5th failure.

#### ASCII Swimlane
```
EXPERT                           PLATFORM (NestJS)                   FASTAPI AI SERVICE
  │                                      │                                    │
  ├─ Submit Portfolio Evidence [Pro-E] ─>│                                    │
  │  (description, decision points)      ├─ Check Lockout (`lockedUntil <= now`)
  │                                      ├─ Create `portfolio_submissions`    │
  │                                      ├─ Fetch live CMS seam definitions   │
  │                                      ├─ Call AI Portfolio Evaluator ─────>│
  │                                      │                                    ├─ Evaluate seam evidence
  │                                      │<───────────────────────────────────┴─ Return score & advisory
  │                                      ├─ Evaluation Passed (score >= 0.85)?│
  │                                      │   ├─ [Pass] ─► Atomic DB TX:       │
  │                                      │   │   - UPDATE submission `APPROVED`
  │                                      │   │   - Upgrade `verification_tier = 'EVIDENCE_BACKED'`
  │                                      │   │   - Log `SEAM_TIER_UPGRADE`    │
  │                                      │   └─ [Fail] ─► Atomic DB TX:       │
  │                                      │       - UPDATE submission `REJECTED`
  │                                      │       - Increment `submissionCount`
  │                                      │       - IF count >= 5: set 30d lock
  │  <───────────────────────────────────┴────────────────────────────────────┘
  │  Seam Tier Upgraded OR Rejection Logged
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1 | Expert | Submits portfolio evidence | `portfolio_submissions` (C), `expert_seam_claims` (R) | `status = 'PENDING'` | `POST /portfolio-submissions` |
| 2 | AI | Evaluates project description & decision points | `seam_definitions` (R) | — | FastAPI `/llm/portfolio-eval` |
| 3a | Platform | Upgrades seam claim on evaluation pass | `portfolio_submissions` (U), `expert_seam_claims` (U), `platform_decisions` (C) | `verification_tier = 'EVIDENCE_BACKED'` | DB Transaction |
| 3b | Platform | Increments fail count & sets 30-day lockout on 5th rejection | `portfolio_submissions` (U), `expert_seam_claims` (U), `platform_decisions` (C) | `submissionCount`++, `lockedUntil` set | DB Transaction |

---

### MF-19 · Direct Service Purchase via SePay (Path B)

**Trigger:** CEO purchases a published Expert service listing from the marketplace.  
**Purpose:** Bypasses discovery and bidding. Generates a service virtual account, processes IPN, auto-creates milestone #1, and activates engagement.

#### ASCII Swimlane
```
CLIENT / CEO                 PLATFORM (NestJS)                  SEPAY / BANK
     │                               │                               │
     ├─ Purchase Service ───────────>│                               │
     │                               ├─ INSERT `engagements` (`PENDING`)
     │                               ├─ Generate Service Virtual Account
     │  <────────────────────────────┴───────────────────────────────┤
     ├─ Transfer Service Payment ───────────────────────────────────>│
     │                                                               ├─ Process Transfer
     │                               │<──────────────────────────────┴─ Dispatch IPN Callback
     │                               ├─ HMAC Signature Verification  │
     │                               ├─ Atomic DB Transaction:       │
     │                               │   - INSERT `milestones` (#1)  │
     │                               │   - INSERT `acceptance_criteria`
     │                               │   - Debit/Credit Wallet Escrow│
     │                               │   - INSERT `wallet_transactions` [LEDGER]
     │                               │   - INSERT `escrow_accounts`  │
     │                               │   - UPDATE `engagements.state = 'ACTIVE'`
     │                               │   - UPDATE `virtual_accounts.status = 'USED'`
     │                               ├─ Emit Real-Time Socket Events │
     │  <────────────────────────────┴───────────────────────────────┘
     │  Service Engagement Active & Milestone #1 Funded
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1 | CEO | Initiates service purchase | `engagements` (C), `virtual_accounts` (C) | `engagements.state = 'PENDING'` | `POST /services/:id/purchase` |
| 2 | SePay | Dispatches signed IPN webhook | — | — | `POST /webhooks/sepay/ipn` |
| 3 | Platform | Atomic Service Purchase TX: creates milestone #1, locks escrow, activates engagement, marks VA used | `milestones` (C), `acceptance_criteria` (C), `wallets` (U), `wallet_transactions` (C), `escrow_accounts` (C), `engagements` (U), `virtual_accounts` (U) | `engagements.state = 'ACTIVE'`, `milestones.state = 'FUNDED'` | DB Transaction |

---

### MF-20 · Post-Engagement Review

**Trigger:** Engagement state becomes `CLOSED` after all milestones are released.  
**Purpose:** Collects mutual reviews and structured technical performance signals.

#### ASCII Swimlane
```
CLIENT / CEO                     PLATFORM (NestJS)                      EXPERT
    │                                    │                                 │
    ├─ Engagement Reaches `CLOSED` ─────>│                                 │
    │                                    ├─ Unlocks Review Eligibility     │
    │  <─────────────────────────────────┼─────────────────────────────────┤
    ├─ Submit CEO Review ───────────────>│                                 │
    │  (Rating + Comment)                ├─ INSERT `reviews` (`reviewerRole = 'CEO'`)
    │                                    │  (Enforces `@@unique([engagementId, reviewerId])`)
    │                                    │<────────────────────────────────┼─ Submit Expert Review
    │                                    ├─ INSERT `reviews` (`reviewerRole = 'EXPERT'`)
    │  <─────────────────────────────────┼─────────────────────────────────┤
    │                                    │                                 │
[TECH TEAM VARIANT]:                     │                                 │
Tech Team Submits Review                 │                                 │
  └─ Must include `structuredSignalsJson`│                                 │
     (code quality, communication, seam ratings)                           │
```

#### Step Detail Table
| Step | Actor | Action | Tables Touched (CRUD) | State Change | Endpoint / Event |
|:---:|---|---|---|---|---|
| 1 | CEO / Expert | Submits post-engagement review | `reviews` (C) | Review recorded | `POST /reviews` |
| 2 | Tech Team | Submits review with structured technical signals | `reviews` (C) | `structuredSignalsJson` populated | `POST /reviews` |
| 3 | All | Views reviews received or submitted | `reviews` (R) | — | `GET /reviews/me`, `GET /reviews/me/received`, `GET /reviews/users/:userId` |