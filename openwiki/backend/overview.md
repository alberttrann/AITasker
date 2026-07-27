# Backend (NestJS)

## Purpose

The NestJS backend is the central API server for AITasker. It handles authentication, business logic, database access, payment processing, real-time messaging, and orchestrates calls to the AI microservice.

## Module Organization

22 feature modules are organized into three development workstreams:

| Workstream | Modules | Focus |
|---|---|---|
| **M1** | Auth, Users, Wallet, Payments, Subscription, Ledger | Identity, money, subscriptions |
| **M2** | Elicitation, Projects, ExpertProfiles, Listings, Engagements, Bids, Disputes | Project discovery, matchmaking, engagement lifecycle |
| **M3** | Milestones, Submissions, Messages, Reviews, Admin, Invitations, AppConfig, Internal, Notifications | Delivery workflow, communication, admin ops |

Shared infrastructure modules:
- `shared/ledger/` — Atomic wallet operations (escrow hold/release, milestone payments, fee calculation)
- `shared/matching/` — Expert-to-project shortlist scoring helpers
- `common/` — Guards (JWT, Roles, Subscription), Pipes (Zod), Filters (HTTP), Decorators, Enums (15 enum files), Email service

## Database Models (34 tables)

| Domain | Models | Key Details |
|---|---|---|
| **Identity** | `User`, `ClientProfile`, `ExpertProfile`, `TechTeamProfile` | Multi-role users with role-specific profile tables |
| **Financial** | `Wallet`, `WalletTransaction`, `VirtualAccount`, `WithdrawalRequest`, `EscrowAccount`, `PlatformSettings` | Double-entry ledger, SePay VA top-ups, milestone escrow |
| **Elicitation** | `ElicitationSession` | 5-stage AI-guided project scoping wizard |
| **Projects & Matching** | `Project`, `ProjectShortlistCache` | Published projects with Artifact A/B JSONB, auto-scored shortlists |
| **Engagement & Bidding** | `Engagement`, `CapabilityBid`, `Service` | Project↔expert connections, capability bids with tech-review/CEO-decision |
| **Delivery** | `Milestone`, `AcceptanceCriterion`, `MilestoneDodItem`, `MilestoneSubmission`, `PaygatedDocument` | Milestone-based delivery with DoD gates |
| **Communication** | `Message`, `MessageRead`, `MilestoneChatSession` | Real-time chat (WebSocket), AI milestone planning |
| **Quality & Trust** | `Review`, `Dispute`, `PlatformDecision` | Bilateral reviews, AI-assisted dispute resolution |
| **Expert Verification** | `ExpertDomainDepth`, `ExpertSeamClaim`, `PortfolioSubmission` | Domain expertise claims + portfolio verification |
| **CMS/Config** | `DomainDefinition`, `SeamDefinition`, `ArchetypeDefinition`, `ProbeQuestion`, `VoidCodeDefinition`, `PromptTemplate` | Admin-managed taxonomy and LLM prompt templates |
| **Subscriptions** | `SubscriptionPackage`, `SubscriptionPurchaseLog` | Role-based subscription tiers |
| **Invitations & Notifications** | `Invitation`, `Notification` | CEO-to-expert invitations (7-day expiry), push notifications |

## API Surface (~200 endpoints)

| Category | Key Endpoints |
|---|---|
| **Auth** | register, login, refresh, OTP verify, handoff claims, password reset, role switching |
| **Users & Profiles** | me, public-profile, add-role, tax-code |
| **Wallet & Payments** | balance, transactions, VA top-up, withdrawals, SePay IPN webhooks, bank linking |
| **Subscriptions** | activate, status, history |
| **Elicitation** | 5-stage wizard: sessions CRUD, stage1→stage5 progression, handoff, self-technical, retry-synthesis |
| **Projects** | marketplace listing, CRUD, artifact A/B, milestone-chat, matching shortlist |
| **Expert Profiles** | profile CRUD, domains/seams claims, portfolio submissions, search |
| **Engagements** | NDA acceptance, connect, decline, cancel, milestones, submissions, bids, disputes |
| **Bids** | CRUD, tech-review, CEO-decision, counter-offers, negotiation, reconcile |
| **Milestones** | CRUD, fund, DoD items, acceptance criteria, submit, paygated docs |
| **Messages** | conversation list, send/read, unread counts, WebSocket gateway |
| **Reviews** | create, read by engagement/user/self |
| **Disputes** | file, list, detail |
| **Admin** | user/project/engagement mgmt, disputes resolution, analytics, CMS config, prompt templates |
| **Invitations** | send, list, decline |
| **Notifications** | list, mark read |

## Key Workflows

### Wallet & Payment Flow
1. User generates a VietQR virtual account (SePay)
2. User transfers VND via banking app
3. SePay sends IPN webhook → NestJS verifies HMAC-SHA256 signature
4. `LedgerService` credits wallet atomically via Prisma `$transaction`
5. Wallet uses bi-temporal balance: `availableBalance` / `lockedBalance`
6. Milestone funding locks balance in `EscrowAccount`; release transfers to expert

### Elicitation Flow
1. CEO starts session → describes business problem (Stage 1)
2. AI extracts symptoms, scale signals, voids, archetype recommendations
3. CEO answers behavioral probes (Stage 3) — vagueness checked, fails open
4. AI recommends technical stack, integration patterns (Stage 4)
5. AI synthesizes full project spec (Stage 5) → handoff to Tech Team or publish

### Bid Negotiation Flow
1. Expert submits `CapabilityBid` with pricing and timeline
2. Tech Team reviews (`techStatus`: APPROVED / REVISION_REQUESTED)
3. CEO reviews (`ceoStatus`: SELECTED / COUNTER_OFFER / DECLINED)
4. Counter-offers trigger negotiation rounds with reconciliation step

### Dispute Resolution
1. Either party files dispute against a milestone criterion
2. AI Layer 1 evaluates (confidence ≥ 0.80 → `EXPERT_WINS` / `CLIENT_WINS` / `SPLIT`)
3. Confidence < 0.80 → escalates to Admin manual resolution

## WebSocket & Real-Time

- Socket.io server with `RedisIoAdapter` for horizontal scaling
- Falls back to in-memory adapter if Redis unavailable
- Events: new messages, bid updates, milestone changes, payment confirmations, dispute filings
- Client connections authenticated via JWT token in handshake

## Test Structure

```
backend/test/
├── helpers/        db.seeder.ts, jwt.factory.ts, mock.builders.ts
├── setup/          global-setup.js, global-teardown.js
├── smoke/          module-boot.spec.ts
├── swagger/        Swagger spec validation
├── unit/           4 unit specs (auth, disputes, elicitation, milestones)
└── T01-T17/        17 numbered e2e/integration specs
```

Run with: `npm run test:unit`, `npm run test:e2e`, `npm run test:all`

## Key Source Files

- Module registration: `/backend/src/app.module.ts`
- Entrypoint: `/backend/src/main.ts`
- Database schema: `/backend/prisma/schema.prisma`
- Ledger service: `/backend/src/shared/ledger/ledger.service.ts`
- SePay IPN handler: `/backend/src/payments/`
- CMS seeders: `/backend/prisma/seed-cms.ts`, `seed-prompts.ts`, `seed-void-codes.ts`
- API endpoint listing: `/backend/swagger_endpoints_list.txt`

## Change Checklist

- Database changes: update `prisma/schema.prisma`, run `prisma migrate dev`, update seeders
- New API endpoints: add controller in relevant module, register in module, update Swagger
- Wallet/ledger changes: always use `LedgerService` methods (never raw Prisma), test atomicity with e2e specs
- WebSocket events: update both server event emission and `SocketProvider` on frontend
- Payment/webhook changes: re-run `simulate_sepay_ipn.ts` to verify HMAC verification
