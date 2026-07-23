# AITasker End-to-End QA Execution Manual

**Document purpose:** A click-by-click, screen-by-screen, state-aware manual for validating the integrated React frontend, NestJS backend, FastAPI AI service, PostgreSQL/Prisma persistence, Socket.io events, SePay-style payment callbacks, and role-based business rules.

**Audience:** Manual QA, E2E automation engineers, backend/frontend developers supporting defect triage, product owners, and acceptance-test reviewers.

**Source basis:** The uploaded full codebase snapshot, including React routes and feature screens, NestJS controllers/services/DTOs, FastAPI OpenAPI routes, Prisma schema, simulation scripts, and existing T01–T17 E2E suites.

> **Critical inventory note:** The project handover states a canonical total of **255 endpoints**. Static extraction from this uploaded snapshot identifies **217 NestJS controller declarations plus 12 FastAPI operations = 229 declarations**. After deduplicating one repeated `PUT /milestones/:id/dod/:itemId` declaration, Appendix A contains **228 unique source operations**. This can differ from the canonical count because generated Swagger may expose inherited/aliased/versioned routes, controller parsing may omit dynamically composed decorators, or the handover count may include socket events and external callback contracts. QA must export the running NestJS Swagger JSON and reconcile it against Appendix A before claiming “255/255 covered.” Never mark the release complete solely from the prose checklist.

---

## 1. What “Pass” Means

A scenario passes only when all six layers agree:

1. **Gesture/UI:** The intended control is visible, enabled only when valid, gives loading/disabled feedback, and prevents duplicate submission.
2. **HTTP/socket contract:** The expected request or event fires once, with the correct method, URL, authentication, role, payload, and correlation IDs.
3. **Response handling:** Success, validation, authorization, conflict, timeout, and server-error responses render correctly without stale or contradictory UI.
4. **Persistence:** The expected Prisma rows/fields are created or updated exactly once; unrelated records remain unchanged.
5. **State machine:** Project, bid, offer, engagement, milestone, escrow, dispute, withdrawal, notification, and document-release states transition only through valid branches.
6. **Cross-actor visibility:** Other involved actors receive the right notification/socket update and see the new state after refresh and re-login.

A visually successful click with a wrong DB state, duplicate ledger entry, missing socket event, or inaccessible follow-up screen is a **failure**.

## 2. Required Evidence Per Test Case

For every case, capture:

- Test case ID, build/commit, environment, tester, timestamp.
- Actor account and active role/subtype.
- Starting DB/business state.
- Browser route and screen/component.
- Exact gestures and entered values.
- Network request/response evidence.
- Before/after screenshots.
- Relevant DB row IDs and before/after values.
- Socket event/notification evidence when applicable.
- Result: Pass / Fail / Blocked / Not Applicable.
- Defect ID and reproducibility notes.

## 3. Test Environments

### 3.1 Isolated automated/manual integration environment

Use the repository test stack so destructive tests do not touch Neon or production-like data:

```bash
docker compose -f docker-compose.test.yml up -d
cd backend
npm run test:e2e
```

The test stack uses PostgreSQL 16 on host port `5433`, a NestJS test container, and a FastAPI test container. Stop and recreate it between destructive suites when strict isolation is required.

### 3.2 Full UI environment

```bash
docker compose up --build
```

Expected default entry points from the snapshot:

- Frontend: `http://localhost/`
- NestJS through host mapping: `http://localhost:3001`
- FastAPI: `http://localhost:8000`

### 3.3 Required observability

Keep open during manual execution:

- Browser DevTools: Network, Console, Application/Storage.
- Backend logs.
- FastAPI logs for AI-mediated flows.
- PostgreSQL query console or Prisma Studio.
- Socket.io event inspection/logging.
- Email test inbox for OTP/reset/handoff flows.

## 4. Canonical Test Personas and Seed Data

Create isolated accounts; do not reuse one mutable account across the entire suite.

| Persona | Required role/subtype | Starting conditions |
|---|---|---|
| CEO-A | CLIENT / CEO | Verified, wallet funded, no subscription |
| CEO-B | CLIENT / CEO | Verified, Pro subscription, wallet funded |
| CEO-C | CLIENT / CEO | Verified, insufficient wallet balance |
| EXP-A | EXPERT | Complete profile, linked bank, eligible seams/domains |
| EXP-B | EXPERT | Incomplete profile, no linked bank |
| EXP-C | EXPERT | Tier-2 portfolio rejection/lockout candidate |
| TECH-A | CLIENT / TECH_TEAM | Registered through valid handoff |
| TECH-B | CLIENT / TECH_TEAM | Assigned to active project/engagement |
| ADMIN-A | ADMIN | Full administrative access |
| SUSPENDED | Any | Suspended by admin |

Seed at least these business objects:

- One draft elicitation session at each stage.
- One published project with shortlist results.
- One invited expert and one non-invited expert.
- Bids in DRAFT, SUBMITTED, REVISION_REQUESTED, TECH_APPROVED, SELECTED, and legacy/reconciliation-needed conditions.
- Engagements in PENDING, CONNECTED, ACTIVE, COMPLETED, and suspended/closed-like conditions supported by the schema.
- Milestones in DEFINED, FUNDING_PENDING, IN_PROGRESS, SUBMITTED, REVISION_REQUESTED, APPROVED, and disputed conditions.
- One expired and one active virtual account.
- One pending withdrawal and one failed/refunded withdrawal.
- One auto-resolvable and one manual-review dispute.
- Unread/read notifications and conversations with unread messages.

## 5. Universal Checks Applied to Every Screen

Before scenario-specific checks, verify:

- Direct URL access respects authentication and role guards.
- Browser Back/Forward does not resurrect forbidden or stale state.
- Refresh preserves authenticated state or cleanly redirects to login.
- Repeated click/Enter does not create duplicate records.
- Buttons are keyboard reachable; modal focus is trapped and restored.
- Forms trim input where intended and clearly display field-level errors.
- Empty, loading, partial, error, and retry states are testable.
- Tables preserve filters/pagination after detail navigation where intended.
- IDs from one actor cannot be substituted to access another actor’s data.
- A 401 clears/refreshes authentication correctly; a 403 explains lack of permission; a 404 does not leak resource existence; a 409/422 keeps user input.
- Socket reconnect does not duplicate messages or notifications.
- Money is displayed in VND consistently and server values—not formatted strings—drive calculations.

---

## F01. Identity, Registration, OTP, Login, Password Recovery, and Role Switching

**Actors:** All actors

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Landing/Auth modal**<br>`/` | Open sign-up; choose CEO or Expert; enter name/email/password; submit | Registration request is sent once; OTP step appears; password rules and duplicate-email errors are visible |
| 2 | **OTP verification**<br>`Auth modal` | Enter invalid OTP, expired OTP, resend, then valid OTP | Invalid/expired attempts fail without login; resend invalidates or supersedes old code as designed; valid code issues JWT and routes by active role |
| 3 | **Login**<br>`/` | Test valid login, wrong password, unknown email, suspended account | Only valid active account enters dashboard; errors do not disclose sensitive account status beyond intended policy |
| 4 | **Forgot/reset password**<br>`/ and /reset-password/:token` | Request reset; open malformed, expired, reused, and valid token; change password | Only valid unused token succeeds; prior password stops working; active sessions behave according to policy |
| 5 | **Role management**<br>`Profile/RoleSwitcher` | Add second role; switch CEO↔Expert; refresh | Token/user context updates; route/nav changes; role-specific cache does not leak data |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F02. CEO and Expert Profile Completion, Tax Verification, Domains, Seams, and Portfolio

**Actors:** CEO, Expert

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Account settings**<br>`/ceo/account-setting or /expert/account-setting` | Edit all fields; cancel; save; submit invalid/oversized values | PUT/PATCH persists allowed fields only; refresh shows saved values |
| 2 | **CEO tax verification**<br>`CEO profile/settings` | Enter invalid and valid Vietnamese tax code; retry external failure | Verification status is accurate; failed verification does not mark verified |
| 3 | **Expert profile**<br>`/expert/service/expert-profile` | Edit bio, stack tags, engagement model; sync domains and seams | Grid selections persist atomically; removed claims disappear; matching inputs reflect latest profile |
| 4 | **Portfolio submission**<br>`Expert profile/verification` | Submit incomplete, valid, failed AI, passed AI, and repeated entries | AI call and platform decision are recorded; tier/failure/lockout state follows response; history is visible |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F03. Wallet Top-up, Subscription, Bank Linking, and Withdrawal Eligibility

**Actors:** CEO, Expert

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Wallet**<br>`/ceo/wallet or /expert/wallet` | Inspect balance and transactions; refresh and paginate | Displayed totals reconcile with ledger; actor sees only own wallet |
| 2 | **Top-up**<br>`Wallet top-up panel` | Enter invalid/valid amount; create VA; let expire; recreate; simulate IPN twice | One credit only; duplicate callback is idempotent; QR/expiry updates |
| 3 | **Subscription plans**<br>`/ceo/subscriptions/plans or /expert/subscriptions/plans` | Activate with insufficient and sufficient balance; repeat activation | Balance and tier update atomically; duplicate activation is prevented; gated UI updates after token/profile refresh |
| 4 | **Bank link**<br>`/expert/wallet/link-bank` | Submit invalid and valid account details; simulate provider failure | Only verified link unlocks withdrawal; sensitive details are masked |
| 5 | **Withdrawal**<br>`/expert/wallet/withdraw` | Request below minimum/above balance/valid; cancel pending request | Hold/deduction and restoration are atomic; transaction history and admin queue agree |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F04. Elicitation Stage 1–5, Draft Persistence, Handoff, Quality Gate, and Project Publication

**Actors:** CEO, Tech Team

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Start session**<br>`/ceo/projects/elicitation` | Create session; type problem; navigate away during autosave | Session ID is created once; draft survives refresh |
| 2 | **Stage 1**<br>`Stage1Symptoms` | Submit empty, gibberish, valid symptom text; inspect extracted results | Validation/gibberish handling is clear; AI extraction maps into session without losing original input |
| 3 | **Stage 2**<br>`Stage2Archetype` | Select/reselect archetype; go back/forward | Selection persists; downstream data is invalidated or retained consistently |
| 4 | **Stage 3**<br>`Stage3Probes` | Answer probes with vague and concrete responses | Vagueness feedback blocks or guides correctly; accepted answers advance exactly once |
| 5 | **Stage 4A**<br>`Stage4ScenarioA` | Choose self-technical; enter stack/integration/volume; upload artifacts; save draft | Required artifacts enforced; draft and final submission are distinct |
| 6 | **Stage 4B**<br>`Stage4HandoffLink / HandoffRegister / Stage4Form` | Generate link; open logged out; register/log in; submit; reuse and expire link | Claims bind tech member to intended session; invalid/reused/expired link fails; CEO receives update |
| 7 | **Stage 5**<br>`Stage5Loading / QualityGatePassed / QualityGateFailed` | Trigger synthesis; test AI success, timeout, malformed response, score above/below threshold | No duplicate project; returned stage/advisory is correct; published project appears in CEO projects and marketplace as intended |
| 8 | **Session history**<br>`/ceo/projects/session-history` | Continue, revert, abandon, and delete sessions | Confirmation and state restrictions work; deleted session cannot be restored |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F05. Project Detail, Matching, Shortlist, Invitations, and Expert Marketplace Access

**Actors:** CEO, Expert

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **CEO projects**<br>`/ceo/projects` | Filter/open draft, returned, published project | Correct status/actions shown; unauthorized project ID denied |
| 2 | **Shortlist**<br>`/ceo/projects/:projectId/shortlist` | Load results; inspect score/gaps; invite expert; invite twice | Matching output maps correctly; duplicate invite prevented; invited expert notified |
| 3 | **Expert marketplace**<br>`/expert/marketplace or /expert/service/projects` | Browse/filter/open project; inspect missing-requirements badges | Only eligible/published projects shown; Artifact B remains hidden |
| 4 | **Invitation handling**<br>`Expert project/invitation UI` | Accept/decline invitation; repeat action | State updates once and appears to CEO |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F06. Bid Creation, Versioned Offers, Technical Review, CEO Decision, and Reconciliation

**Actors:** Expert, Tech Team, CEO

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Bid form**<br>`/expert/bids/:projectId` | Enter footprint, approach, conditional pricing; save/edit/submit; invalid totals | Draft mutation and final submission follow allowed states; server validation preserved |
| 2 | **Tech review list/detail**<br>`/tech-team/bids and /tech-team/bids/:bidId` | Open submitted bid; request revision; approve; try both actions twice | Only assigned tech team can act; revision returns to expert; approval moves to CEO gate |
| 3 | **CEO bid detail**<br>`/ceo/projects/:projectId/bids/:bidId` | Review tech-approved bid; attempt action before approval | CEO gate blocks premature decision; offer timeline is complete |
| 4 | **Counter-offer**<br>`CounterOfferPanel / CounterOfferReceived` | CEO creates offer; expert accepts/declines/counters where supported; act on stale version | Only latest pending version is actionable; stale version returns conflict; accepted terms are immutable |
| 5 | **Legacy reconcile**<br>`Legacy bid detail` | Open legacy bid and trigger reconcile | Versioned offer baseline is created once; repeated reconcile is idempotent |
| 6 | **Selection**<br>`BidDecisionConfirm` | Accept final offer | Bid SELECTED; competing bids handled per policy; engagement PENDING; milestone contract generated atomically |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F07. NDA Gate, Engagement Connection, Artifact B, and Technical Vault Access

**Actors:** CEO, Expert, Tech Team

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **CEO NDA**<br>`/ceo/engagements/:engagementId/nda` | Read/accept; refresh; repeat | Acceptance timestamp persists once; state remains pending until other party |
| 2 | **Expert NDA**<br>`/expert/engagements/:engagementId/nda` | Attempt Artifact B before signing; sign; refresh | Artifact B denied before all conditions; after both signatures engagement becomes CONNECTED and content unlocks |
| 3 | **Authorization matrix**<br>`Project/engagement detail` | Try non-selected expert, unrelated CEO, unassigned tech member, and altered IDs | No technical content leakage through body, errors, logs, or cached query |
| 4 | **Pay-gated vault**<br>`Expert/Tech vault screens` | Inspect staged, locked, released documents across funding states | Release state is server-driven and remains correct after re-login |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F08. Service Listing Creation, AI Drafting, Publishing, Purchase, and Direct Checkout

**Actors:** Expert, CEO

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Expert services**<br>`/expert/service` | Create manually; use AI generator; edit; publish; unpublish/delete where supported | AI draft is reviewable and not auto-persisted; CRUD state matches listing grid |
| 2 | **Service detail**<br>`/ceo/marketplace/service/:id` | Open active/inactive/other expert listing | Only purchasable listing exposes checkout |
| 3 | **Purchase**<br>`/ceo/marketplace/service/:id/purchase` | Buy with invalid state; create exact VA; expire/recreate; simulate IPN twice | One SERVICE_PURCHASE engagement; escrow locks exactly once; engagement transitions directly to ACTIVE as designed |
| 4 | **Expert orders**<br>`/expert/service/orders` | Observe new purchase and refresh | Order, amount, buyer-safe details, and state are correct |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F09. Milestone Definition, Terms Lock, Criteria, DoD, Funding, and Pay-gated Documents

**Actors:** CEO, Expert, Tech Team

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Milestone list/create**<br>`/ceo/engagements/:id/milestones` | Bulk initialize; create/edit/delete before lock; attempt after lock | Pre-lock CRUD works; post-lock changes blocked except explicit negotiation path |
| 2 | **Criteria editor**<br>`AcceptanceCriteriaEditor` | Add/edit/delete objective and subjective criteria | Criterion AI check/suggestions render; role and state rules enforced |
| 3 | **DoD**<br>`DodChecklist/DoDEditor` | Create items; mark required complete without note; mark N/A; edit after submission | Required notes/gates enforced; locked states immutable |
| 4 | **Stage documents**<br>`PaygatedDocsStaging` | Stage one/bulk docs; remove/re-stage; inspect metadata | Documents start locked and bind to correct milestone |
| 5 | **Fund**<br>`/ceo/.../milestones/:milestoneId/fund` | Create funding VA; duplicate click; expire/recreate; callback with wrong amount/reference and valid callback | Only valid callback moves escrow/milestone; one ledger effect; staged docs release |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F10. Deliverable Submission, Retraction, Revision, Criteria Sign-off, Approval, and Escrow Release

**Actors:** Expert, Tech Team, CEO

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Submit**<br>`ExpertMilestoneDetail/DeliverableSubmit` | Attempt with pending DoD; complete DoD; upload/link; submit twice | 422 on unmet gate; one submission on success; milestone SUBMITTED; reviewers notified |
| 2 | **Retract**<br>`Latest submission action` | Retract latest submission before review; attempt after review | Only allowed latest submission is deleted/retracted; milestone returns to valid state |
| 3 | **Tech sign-off**<br>`TechTeamMilestoneDetail/CriteriaSignOff` | Approve criteria or request revision with/without note | Reviewer role recorded; revision reopens expert workflow |
| 4 | **CEO sign-off**<br>`CEO MilestoneDetail/CriteriaVerify` | Verify after tech review; attempt before prerequisites | Final gate enforced; all criteria approval transitions milestone APPROVED |
| 5 | **Release**<br>`Wallet/ledger` | Observe approval transaction, available balance, optional auto-withdrawal | Escrow release and ledger entries are atomic/idempotent; expert and CEO balances reconcile |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F11. Dispute Filing, AI Layer-1 Arbitration, Manual Review, and Ledger Resolution

**Actors:** CEO, Expert, Admin

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **File dispute**<br>`DisputeFile` | File against eligible criterion; omit reason; duplicate; file in wrong milestone state | Only eligible dispute created; escrow freezes; actors notified |
| 2 | **AI arbitration**<br>`DisputeResult` | Run ≥0.80 expert win, ≥0.80 client win, <0.80, timeout/error | High-confidence result auto-resolves exactly once; low confidence enters MANUAL_REVIEW; failure does not move money incorrectly |
| 3 | **Admin monitor**<br>`/admin/disputes` | Filter/open dispute; review evidence and AI reasoning | Queue/state accurate; sensitive data scoped |
| 4 | **Manual resolve**<br>`/admin/disputes/:id/resolve` | Release, refund, split; double-submit and concurrent admin action | One terminal resolution; ledger totals equal frozen amount; all parties notified |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F12. Messaging, Inbox, Notifications, and Milestone AI Assistant

**Actors:** All actors

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Conversation list**<br>`/ceo/messages, /expert/messages` | Open project and engagement threads; paginate; unread/read | Correct scope; unread count agrees across list and top nav |
| 2 | **Message thread**<br>`/.../engagements/:id/messages` | Send text, empty, oversized, rapid duplicate; disconnect/reconnect | Persisted message appears once and socket delivery is ordered; fallback refresh works |
| 3 | **Notifications**<br>`/.../notifications` | Mark one/all read, clear, refresh, receive while offline | DB persistence and unread badge reconcile; no cross-user leakage |
| 4 | **Milestone assistant**<br>`MilestoneChatAssistant/MilestoneChatPanel` | Ask explanation; request structured edit; apply as CEO; copy as expert; reload history | Session history persists; valid edit schema only; unauthorized actor cannot mutate milestones; copy action does not mutate |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F13. Reviews and Engagement Completion

**Actors:** CEO, Expert, Tech Team

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Review forms**<br>`Role-specific engagement review routes` | Submit valid review; duplicate; edit where supported; review before completion | Eligibility and uniqueness enforced; aggregates update correctly |
| 2 | **Public profile**<br>`UserProfilePage` | Inspect rating/profile after review | Only intended public data shown; aggregate matches accepted reviews |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F14. Admin Oversight, Configuration, Prompts, Integrity, Ledger, and Withdrawals

**Actors:** Admin

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Admin overview/analytics**<br>`/admin` | Load widgets, empty/error states, export | Metrics reconcile with source queries; export respects filters |
| 2 | **Users**<br>`/admin/users` | Search; suspend/reactivate; act on self/other admins where restricted | Auth is invalidated or blocked according to policy; audit/notification generated |
| 3 | **Projects/engagements/experts**<br>`/admin/oversight/*` | Filter/open; suspend/pull back/reactivate supported objects | Public visibility and actor screens update consistently |
| 4 | **CMS configs**<br>`/admin/config/*` | Create/edit/reorder/delete domains, seams, archetypes, probes, voids, packages | Validation/referential integrity enforced; new elicitation/profile sessions use updated configuration |
| 5 | **Prompts**<br>`/admin/config/prompts` | Edit template; test invalid Jinja2-like syntax; save; invoke AI flow | Version/content persist; malformed template handled safely; downstream request uses expected prompt |
| 6 | **Integrity**<br>`/admin/integrity` | Inspect dispute, seam, and auto-return decisions | Decision log links to source entity and is immutable/auditable |
| 7 | **Ledger**<br>`/admin/ledger` | Filter/paginate/export; compare wallet/escrow transactions | Double-entry or platform ledger invariants reconcile |
| 8 | **Withdrawals**<br>`/admin/withdrawals` | Mark sent; fail/refund; duplicate and concurrent action | Terminal state once; balances/ledger/notifications correct |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.


---

## 6. Cross-Flow End-to-End Journeys

These journeys validate integration boundaries that isolated screen tests miss.

### J01 — Complete custom-project success journey

1. CEO registers and verifies OTP.
2. CEO tops up wallet and optionally activates subscription.
3. CEO completes elicitation through Stage 5 and publishes.
4. Matching produces shortlist; CEO invites EXP-A.
5. EXP-A submits bid.
6. TECH-A requests revision, EXP-A resubmits, TECH-A approves.
7. CEO counters; EXP-A accepts; engagement is created.
8. CEO and EXP-A sign NDA; Artifact B unlocks.
9. Milestones/criteria/DoD are finalized.
10. EXP-A stages pay-gated documents.
11. CEO funds milestone; callback activates milestone and releases documents.
12. EXP-A submits deliverable.
13. TECH-A and CEO sign off all criteria.
14. Escrow releases; expert wallet and ledger update.
15. Parties exchange reviews.

**Invariant checkpoints:** no duplicate project, bid, offer, engagement, milestone, VA, submission, escrow release, withdrawal, message, or notification.

### J02 — Revision-heavy journey

Exercise Stage 3 vagueness, quality-gate return, bid revision, counter-offer version conflict, DoD gate failure, deliverable retraction, technical revision request, and successful resubmission.

### J03 — Dispute journey

Complete a funded/submitted milestone, file a dispute, test one auto-resolution and one manual resolution, and reconcile frozen escrow to final ledger balances.

### J04 — Service-purchase journey

Expert creates an AI-assisted listing, CEO purchases it, duplicate IPN is sent, engagement becomes active once, execution completes, and both parties review.

### J05 — Security and tenancy journey

Across two CEOs, two experts, and two tech members, substitute project, bid, engagement, milestone, submission, dispute, wallet, withdrawal, message, notification, and config IDs. Confirm zero cross-tenant data leakage.

## 7. Payment and Webhook Simulation Protocol

### 7.1 Milestone/service payment

Use the repository script documented in the handover, for example:

```bash
npm run simulate:ipn -- --va MILESTONEHdj293
```

Also execute these negative callbacks:

- Unknown VA.
- Expired/cancelled VA.
- Wrong amount.
- Same provider transaction ID twice.
- New provider transaction ID for an already-paid VA.
- Callback before the UI begins polling/listening.
- Callback while the user is logged out.
- Concurrent callbacks.
- Invalid/missing HMAC.

### 7.2 Required payment invariants

- A provider event affects money at most once.
- The sum of wallet, escrow, platform, refund, and payout entries balances.
- A failed DB transaction leaves no partial state transition.
- UI polling and sockets are presentation mechanisms, not the source of truth.
- Reopening the screen obtains the same final state from REST.

## 8. AI-Service Failure Injection

For Stage 1/3/4/5, matching, portfolio evaluation, dispute evaluation, criterion checking, service generation, Artifact B gate, and milestone chat, test:

- Normal valid JSON.
- Slow response just below timeout.
- Timeout.
- 422 from FastAPI validation.
- 500/503.
- Empty body.
- Malformed JSON.
- Valid JSON missing required fields.
- Out-of-range confidence/score.
- Prompt injection-like user content.
- Duplicate NestJS retry.

Record whether each NestJS flow is fail-open, fail-closed, retryable, or manually recoverable. The Stage 3 vagueness route is documented as failing open internally; QA must verify the actual observable behavior.

## 9. Socket and Notification Contract Checks

For each event-producing action:

1. Keep recipient online in another browser/profile.
2. Perform the action and record socket event name/payload.
3. Confirm UI updates without manual refresh.
4. Refresh recipient and confirm REST/DB state matches.
5. Repeat with recipient offline, then log in.
6. Disconnect/reconnect socket and ensure no duplicate event rendering.
7. Confirm the event is scoped to intended user/project/engagement rooms.

At minimum cover: handoff submitted, invitation, bid submitted/revised/approved/selected, NDA completion, payment success, document release, deliverable submission, revision request, criterion sign-off, milestone approval, dispute updates, withdrawal updates, messages, and notifications.

## 10. Existing Automated Test Alignment

The snapshot includes these backend E2E suites; manual cases should cite and extend them rather than duplicate them blindly:

| Suite | Primary manual coverage linkage |
|---|---|
| T01 IPN idempotency | F03, F08, F09, F10 |
| T02 ledger atomicity | F03, F10, F11, F14 |
| T03 DoD gate | F09, F10 |
| T04 Artifact B guard | F07 |
| T05 bid CEO gate | F06 |
| T06 wallet check | F03, F09 |
| T07 DoD DB check | F09, F10 |
| T08 Chi Hộ failure | F03, F14 |
| T09 escrow check | F09–F11 |
| T10 criteria role | F09, F10 |
| T11 subscription balance | F03 |
| T12 approved guard | F10 |
| T13 elicitation full flow | F04 |
| T14 system updates | Cross-flow state transitions |
| T15 UX refinements | Universal screen checks |
| T16 handoff claims and gibberish | F04 |
| T17 WebSocket FE contract | F04–F14 event checks |

## 11. Defect Severity Guidance

| Severity | Examples |
|---|---|
| Blocker | Cannot start app; data corruption; money duplicated/lost; auth bypass; Artifact B leak |
| Critical | Mainflow cannot complete; invalid state transition; cross-tenant access; webhook non-idempotent |
| Major | Important branch broken; stale UI causes wrong action; notification absent with no recovery |
| Minor | Validation copy/layout/accessibility issue with safe workaround |

## 12. Release Sign-off Dashboard

Do not use “100% wired” as the sign-off metric. Use:

- Route coverage: tested frontend routes / registered routes.
- Endpoint coverage: endpoint operations with at least one executed case / canonical Swagger operations.
- Mutation branch coverage: happy + validation + auth + authorization + conflict + dependency + concurrency.
- Role matrix coverage.
- State transition coverage.
- Socket event coverage.
- Ledger invariant coverage.
- Known defects by severity.

Recommended final acceptance rule:

- 100% of critical business mutations tested.
- 100% of canonical endpoints classified as UI-called, system/internal, webhook, socket-adjacent, admin-only, or intentionally unreachable.
- Zero open Blocker/Critical defects.
- No unexplained endpoint-count mismatch.

---

# Appendix A — Static Endpoint Inventory from Uploaded Snapshot

This inventory is a **reconciliation starting point**, not a replacement for exported runtime Swagger. Add columns in the QA tracker for frontend screen, test case IDs, execution date, result, and evidence link.

| # | Method | Path | Source controller/service | Handler | Coverage classification |
|---:|---|---|---|---|---|
| 1 | `GET` | `/health` | `ai-service/openapi.json` | `internal AI route` | _To classify_ |
| 2 | `POST` | `/llm/criterion-check` | `ai-service/openapi.json` | `internal AI route` | _To classify_ |
| 3 | `POST` | `/llm/dispute-eval` | `ai-service/openapi.json` | `internal AI route` | _To classify_ |
| 4 | `POST` | `/llm/elicitation/milestone-chat` | `ai-service/openapi.json` | `internal AI route` | _To classify_ |
| 5 | `POST` | `/llm/elicitation/stage1-extract` | `ai-service/openapi.json` | `internal AI route` | _To classify_ |
| 6 | `POST` | `/llm/elicitation/stage3-vagueness-check` | `ai-service/openapi.json` | `internal AI route` | _To classify_ |
| 7 | `POST` | `/llm/elicitation/stage4-recommend` | `ai-service/openapi.json` | `internal AI route` | _To classify_ |
| 8 | `POST` | `/llm/elicitation/stage5-synthesize` | `ai-service/openapi.json` | `internal AI route` | _To classify_ |
| 9 | `POST` | `/llm/matching` | `ai-service/openapi.json` | `internal AI route` | _To classify_ |
| 10 | `POST` | `/llm/portfolio-eval` | `ai-service/openapi.json` | `internal AI route` | _To classify_ |
| 11 | `POST` | `/llm/service-generate` | `ai-service/openapi.json` | `internal AI route` | _To classify_ |
| 12 | `GET` | `/projects/{project_id}/artifact-b` | `ai-service/openapi.json` | `internal AI route` | _To classify_ |
| 13 | `GET` | `/admin/analytics` | `backend/src/admin/admin.controller.ts` | `getAnalytics` | _To classify_ |
| 14 | `GET` | `/admin/decisions` | `backend/src/admin/admin.controller.ts` | `getDecisions` | _To classify_ |
| 15 | `GET` | `/admin/disputes` | `backend/src/admin/admin.controller.ts` | `getDisputesQueue` | _To classify_ |
| 16 | `PUT` | `/admin/disputes/:id/resolve` | `backend/src/admin/admin.controller.ts` | `resolveDispute` | _To classify_ |
| 17 | `GET` | `/admin/engagements` | `backend/src/admin/admin.controller.ts` | `listEngagements` | _To classify_ |
| 18 | `GET` | `/admin/experts` | `backend/src/admin/admin.controller.ts` | `listExperts` | _To classify_ |
| 19 | `GET` | `/admin/platform-settings` | `backend/src/admin/admin.controller.ts` | `getPlatformSettings` | _To classify_ |
| 20 | `PUT` | `/admin/platform-settings` | `backend/src/admin/admin.controller.ts` | `updatePlatformSettings` | _To classify_ |
| 21 | `GET` | `/admin/projects` | `backend/src/admin/admin.controller.ts` | `listProjects` | _To classify_ |
| 22 | `GET` | `/admin/projects/:id` | `backend/src/admin/admin.controller.ts` | `getProjectDetail` | _To classify_ |
| 23 | `PUT` | `/admin/projects/:id/reopen` | `backend/src/admin/admin.controller.ts` | `reopenProject` | _To classify_ |
| 24 | `PUT` | `/admin/projects/:id/suspend-spec` | `backend/src/admin/admin.controller.ts` | `suspendSpec` | _To classify_ |
| 25 | `GET` | `/admin/subscriptions/packages` | `backend/src/admin/admin.controller.ts` | `listSubscriptionPackages` | _To classify_ |
| 26 | `POST` | `/admin/subscriptions/packages` | `backend/src/admin/admin.controller.ts` | `createSubscriptionPackage` | _To classify_ |
| 27 | `DELETE` | `/admin/subscriptions/packages/:id` | `backend/src/admin/admin.controller.ts` | `deleteSubscriptionPackage` | _To classify_ |
| 28 | `PUT` | `/admin/subscriptions/packages/:id` | `backend/src/admin/admin.controller.ts` | `updateSubscriptionPackage` | _To classify_ |
| 29 | `GET` | `/admin/transactions` | `backend/src/admin/admin.controller.ts` | `getTransactions` | _To classify_ |
| 30 | `GET` | `/admin/users` | `backend/src/admin/admin.controller.ts` | `listUsers` | _To classify_ |
| 31 | `GET` | `/admin/users/:id` | `backend/src/admin/admin.controller.ts` | `getUser` | _To classify_ |
| 32 | `PUT` | `/admin/users/:id/reactivate` | `backend/src/admin/admin.controller.ts` | `reactivateUser` | _To classify_ |
| 33 | `PUT` | `/admin/users/:id/suspend` | `backend/src/admin/admin.controller.ts` | `suspendUser` | _To classify_ |
| 34 | `GET` | `/admin/withdrawals` | `backend/src/admin/admin.controller.ts` | `getWithdrawalsQueue` | _To classify_ |
| 35 | `PUT` | `/admin/withdrawals/:id/complete` | `backend/src/admin/admin.controller.ts` | `completeWithdrawal` | _To classify_ |
| 36 | `PUT` | `/admin/withdrawals/:id/fail` | `backend/src/admin/admin.controller.ts` | `failWithdrawal` | _To classify_ |
| 37 | `GET` | `/admin/config/domains` | `backend/src/admin/config/admin-config.controller.ts` | `listDomains` | _To classify_ |
| 38 | `POST` | `/admin/config/domains` | `backend/src/admin/config/admin-config.controller.ts` | `createDomain` | _To classify_ |
| 39 | `DELETE` | `/admin/config/domains/:id` | `backend/src/admin/config/admin-config.controller.ts` | `deleteDomain` | _To classify_ |
| 40 | `PUT` | `/admin/config/domains/:id` | `backend/src/admin/config/admin-config.controller.ts` | `updateDomain` | _To classify_ |
| 41 | `GET` | `/admin/config/probe-questions` | `backend/src/admin/config/admin-config.controller.ts` | `listProbeQuestions` | _To classify_ |
| 42 | `POST` | `/admin/config/probe-questions` | `backend/src/admin/config/admin-config.controller.ts` | `createProbeQuestion` | _To classify_ |
| 43 | `DELETE` | `/admin/config/probe-questions/:id` | `backend/src/admin/config/admin-config.controller.ts` | `deleteProbeQuestion` | _To classify_ |
| 44 | `PUT` | `/admin/config/probe-questions/:id` | `backend/src/admin/config/admin-config.controller.ts` | `updateProbeQuestion` | _To classify_ |
| 45 | `POST` | `/admin/config/seams` | `backend/src/admin/config/admin-config.controller.ts` | `createSeam` | _To classify_ |
| 46 | `PUT` | `/admin/config/seams/:id` | `backend/src/admin/config/admin-config.controller.ts` | `updateSeam` | _To classify_ |
| 47 | `GET` | `/admin/config/void-codes` | `backend/src/admin/config/admin-config.controller.ts` | `listVoidCodes` | _To classify_ |
| 48 | `POST` | `/admin/config/void-codes` | `backend/src/admin/config/admin-config.controller.ts` | `createVoidCode` | _To classify_ |
| 49 | `DELETE` | `/admin/config/void-codes/:id` | `backend/src/admin/config/admin-config.controller.ts` | `deleteVoidCode` | _To classify_ |
| 50 | `PUT` | `/admin/config/void-codes/:id` | `backend/src/admin/config/admin-config.controller.ts` | `updateVoidCode` | _To classify_ |
| 51 | `GET` | `/admin/prompts` | `backend/src/admin/prompts/admin-prompts.controller.ts` | `listPrompts` | _To classify_ |
| 52 | `DELETE` | `/admin/prompts/:stage` | `backend/src/admin/prompts/admin-prompts.controller.ts` | `resetToDefault` | _To classify_ |
| 53 | `GET` | `/admin/prompts/:stage` | `backend/src/admin/prompts/admin-prompts.controller.ts` | `getPrompt` | _To classify_ |
| 54 | `PUT` | `/admin/prompts/:stage` | `backend/src/admin/prompts/admin-prompts.controller.ts` | `seconds` | _To classify_ |
| 55 | `GET` | `/health` | `backend/src/app.controller.ts` | `health` | _To classify_ |
| 56 | `POST` | `/auth/claim-handoff` | `backend/src/auth/auth.controller.ts` | `claimHandoff` | _To classify_ |
| 57 | `POST` | `/auth/forgot-password` | `backend/src/auth/auth.controller.ts` | `forgotPassword` | _To classify_ |
| 58 | `POST` | `/auth/login` | `backend/src/auth/auth.controller.ts` | `login` | _To classify_ |
| 59 | `POST` | `/auth/logout` | `backend/src/auth/auth.controller.ts` | `logout` | _To classify_ |
| 60 | `PUT` | `/auth/me/password` | `backend/src/auth/auth.controller.ts` | `changePassword` | _To classify_ |
| 61 | `POST` | `/auth/refresh` | `backend/src/auth/auth.controller.ts` | `refreshToken` | _To classify_ |
| 62 | `POST` | `/auth/register` | `backend/src/auth/auth.controller.ts` | `register` | _To classify_ |
| 63 | `POST` | `/auth/register/handoff` | `backend/src/auth/auth.controller.ts` | `registerHandoff` | _To classify_ |
| 64 | `POST` | `/auth/resend-otp` | `backend/src/auth/auth.controller.ts` | `resendOtp` | _To classify_ |
| 65 | `POST` | `/auth/reset-password` | `backend/src/auth/auth.controller.ts` | `resetPassword` | _To classify_ |
| 66 | `PUT` | `/auth/switch-role` | `backend/src/auth/auth.controller.ts` | `switchRole` | _To classify_ |
| 67 | `POST` | `/auth/verify-otp` | `backend/src/auth/auth.controller.ts` | `verifyOtp` | _To classify_ |
| 68 | `GET` | `/auth/verify-reset-token/:token` | `backend/src/auth/auth.controller.ts` | `verifyResetToken` | _To classify_ |
| 69 | `POST` | `/auth/verify-tax-code` | `backend/src/auth/auth.controller.ts` | `verifyTaxCode` | _To classify_ |
| 70 | `GET` | `/bids` | `backend/src/bids/bids.controller.ts` | `findAll` | _To classify_ |
| 71 | `POST` | `/bids` | `backend/src/bids/bids.controller.ts` | `create` | _To classify_ |
| 72 | `DELETE` | `/bids/:id` | `backend/src/bids/bids.controller.ts` | `withdraw` | _To classify_ |
| 73 | `GET` | `/bids/:id` | `backend/src/bids/bids.controller.ts` | `ADMIN` | _To classify_ |
| 74 | `PUT` | `/bids/:id` | `backend/src/bids/bids.controller.ts` | `id` | _To classify_ |
| 75 | `PUT` | `/bids/:id/ceo-decision` | `backend/src/bids/bids.controller.ts` | `ceoDecision` | _To classify_ |
| 76 | `PUT` | `/bids/:id/counter-offer` | `backend/src/bids/bids.controller.ts` | `counterOffer` | _To classify_ |
| 77 | `POST` | `/bids/:id/offers` | `backend/src/bids/bids.controller.ts` | `createOffer` | _To classify_ |
| 78 | `POST` | `/bids/:id/offers/:offerId/accept` | `backend/src/bids/bids.controller.ts` | `acceptOffer` | _To classify_ |
| 79 | `POST` | `/bids/:id/offers/:offerId/decline` | `backend/src/bids/bids.controller.ts` | `declineOffer` | _To classify_ |
| 80 | `POST` | `/bids/:id/reconcile` | `backend/src/bids/bids.controller.ts` | `reconcileLegacyBid` | _To classify_ |
| 81 | `PUT` | `/bids/:id/tech-review` | `backend/src/bids/bids.controller.ts` | `Roles` | _To classify_ |
| 82 | `GET` | `/config/all` | `backend/src/config/config.controller.ts` | `call` | _To classify_ |
| 83 | `GET` | `/config/archetypes` | `backend/src/config/config.controller.ts` | `getArchetypes` | _To classify_ |
| 84 | `GET` | `/config/archetypes/:code/probe-questions` | `backend/src/config/config.controller.ts` | `getProbeQuestions` | _To classify_ |
| 85 | `GET` | `/config/domains` | `backend/src/config/config.controller.ts` | `getDomains` | _To classify_ |
| 86 | `GET` | `/config/seams` | `backend/src/config/config.controller.ts` | `getSeams` | _To classify_ |
| 87 | `GET` | `/config/subscription-packages` | `backend/src/config/config.controller.ts` | `price` | _To classify_ |
| 88 | `GET` | `/config/void-codes` | `backend/src/config/config.controller.ts` | `getVoidCodes` | _To classify_ |
| 89 | `GET` | `/disputes` | `backend/src/disputes/disputes.controller.ts` | `findAll` | _To classify_ |
| 90 | `POST` | `/disputes` | `backend/src/disputes/disputes.controller.ts` | `criterion` | _To classify_ |
| 91 | `GET` | `/disputes/:id` | `backend/src/disputes/disputes.controller.ts` | `findById` | _To classify_ |
| 92 | `GET` | `/elicitation/sessions` | `backend/src/elicitation/elicitation.controller.ts` | `getSessionsList` | _To classify_ |
| 93 | `POST` | `/elicitation/sessions` | `backend/src/elicitation/elicitation.controller.ts` | `createSession` | _To classify_ |
| 94 | `DELETE` | `/elicitation/sessions/:id` | `backend/src/elicitation/elicitation.controller.ts` | `deleteSession` | _To classify_ |
| 95 | `GET` | `/elicitation/sessions/:id` | `backend/src/elicitation/elicitation.controller.ts` | `getSession` | _To classify_ |
| 96 | `PUT` | `/elicitation/sessions/:id/abandon` | `backend/src/elicitation/elicitation.controller.ts` | `abandonSession` | _To classify_ |
| 97 | `PUT` | `/elicitation/sessions/:id/continue` | `backend/src/elicitation/elicitation.controller.ts` | `continueSession` | _To classify_ |
| 98 | `PATCH` | `/elicitation/sessions/:id/draft` | `backend/src/elicitation/elicitation.controller.ts` | `saveDraft` | _To classify_ |
| 99 | `POST` | `/elicitation/sessions/:id/generate-handoff-link` | `backend/src/elicitation/elicitation.controller.ts` | `inviteTechTeam` | _To classify_ |
| 100 | `POST` | `/elicitation/sessions/:id/retry-synthesis` | `backend/src/elicitation/elicitation.controller.ts` | `retryFailedSynthesis` | _To classify_ |
| 101 | `PUT` | `/elicitation/sessions/:id/revert` | `backend/src/elicitation/elicitation.controller.ts` | `revertSession` | _To classify_ |
| 102 | `PUT` | `/elicitation/sessions/:id/self-technical` | `backend/src/elicitation/elicitation.controller.ts` | `setSelfTechnical` | _To classify_ |
| 103 | `PUT` | `/elicitation/sessions/:id/stage1` | `backend/src/elicitation/elicitation.controller.ts` | `processStage1` | _To classify_ |
| 104 | `PUT` | `/elicitation/sessions/:id/stage2` | `backend/src/elicitation/elicitation.controller.ts` | `processStage2` | _To classify_ |
| 105 | `PUT` | `/elicitation/sessions/:id/stage3` | `backend/src/elicitation/elicitation.controller.ts` | `processStage3` | _To classify_ |
| 106 | `PUT` | `/elicitation/sessions/:id/stage4` | `backend/src/elicitation/elicitation.controller.ts` | `processStage4` | _To classify_ |
| 107 | `PATCH` | `/elicitation/sessions/:id/stage4-draft` | `backend/src/elicitation/elicitation.controller.ts` | `saveStage4Draft` | _To classify_ |
| 108 | `PUT` | `/elicitation/sessions/:id/stage4-handoff` | `backend/src/elicitation/elicitation.controller.ts` | `processStage4Handoff` | _To classify_ |
| 109 | `POST` | `/elicitation/sessions/:id/stage4-recommend` | `backend/src/elicitation/elicitation.controller.ts` | `recommendTechContext` | _To classify_ |
| 110 | `POST` | `/elicitation/sessions/:id/stage5` | `backend/src/elicitation/elicitation.controller.ts` | `processStage5` | _To classify_ |
| 111 | `GET` | `/elicitation/sessions/active` | `backend/src/elicitation/elicitation.controller.ts` | `getActiveSession` | _To classify_ |
| 112 | `GET` | `/elicitation/sessions/history` | `backend/src/elicitation/elicitation.controller.ts` | `getSessionHistory` | _To classify_ |
| 113 | `GET` | `/engagements` | `backend/src/engagements/engagements.controller.ts` | `findAll` | _To classify_ |
| 114 | `GET` | `/engagements/:id` | `backend/src/engagements/engagements.controller.ts` | `findById` | _To classify_ |
| 115 | `PUT` | `/engagements/:id/accept-nda` | `backend/src/engagements/engagements.controller.ts` | `acceptNda` | _To classify_ |
| 116 | `GET` | `/engagements/:id/bid` | `backend/src/engagements/engagements.controller.ts` | `getEngagementBid` | _To classify_ |
| 117 | `PUT` | `/engagements/:id/cancel` | `backend/src/engagements/engagements.controller.ts` | `cancelEngagement` | _To classify_ |
| 118 | `POST` | `/engagements/:id/connect` | `backend/src/engagements/engagements.controller.ts` | `acceptConnect` | _To classify_ |
| 119 | `PUT` | `/engagements/:id/decline` | `backend/src/engagements/engagements.controller.ts` | `decline` | _To classify_ |
| 120 | `GET` | `/engagements/:id/disputes` | `backend/src/engagements/engagements.controller.ts` | `getEngagementDisputes` | _To classify_ |
| 121 | `GET` | `/engagements/:id/milestones` | `backend/src/engagements/engagements.controller.ts` | `getEngagementMilestones` | _To classify_ |
| 122 | `GET` | `/engagements/:id/submissions` | `backend/src/engagements/engagements.controller.ts` | `getEngagementSubmissions` | _To classify_ |
| 123 | `POST` | `/expert-profile/domains` | `backend/src/expert-profiles/domain-depths.controller.ts` | `createDomainDepth` | _To classify_ |
| 124 | `DELETE` | `/expert-profile/domains/:id` | `backend/src/expert-profiles/domain-depths.controller.ts` | `deleteDomainDepth` | _To classify_ |
| 125 | `PUT` | `/expert-profile/domains/:id` | `backend/src/expert-profiles/domain-depths.controller.ts` | `updateDomainDepth` | _To classify_ |
| 126 | `POST` | `/expert-profile/domains/sync` | `backend/src/expert-profiles/domain-depths.controller.ts` | `syncDomainDepths` | _To classify_ |
| 127 | `GET` | `/expert-profile/:userId` | `backend/src/expert-profiles/expert-profiles.controller.ts` | `getExpertProfile` | _To classify_ |
| 128 | `GET` | `/expert-profile/me` | `backend/src/expert-profiles/expert-profiles.controller.ts` | `getMyProfile` | _To classify_ |
| 129 | `PATCH` | `/expert-profile/me` | `backend/src/expert-profiles/expert-profiles.controller.ts` | `updateMyProfile` | _To classify_ |
| 130 | `GET` | `/expert-profile/me/domains` | `backend/src/expert-profiles/expert-profiles.controller.ts` | `getMyDomains` | _To classify_ |
| 131 | `GET` | `/expert-profile/me/seams` | `backend/src/expert-profiles/expert-profiles.controller.ts` | `getMySeams` | _To classify_ |
| 132 | `GET` | `/expert-profile/search` | `backend/src/expert-profiles/expert-profiles.controller.ts` | `searchExperts` | _To classify_ |
| 133 | `GET` | `/portfolio-submissions` | `backend/src/expert-profiles/portfolio.controller.ts` | `getMySubmissions` | _To classify_ |
| 134 | `POST` | `/portfolio-submissions` | `backend/src/expert-profiles/portfolio.controller.ts` | `submit` | _To classify_ |
| 135 | `GET` | `/portfolio-submissions/:id` | `backend/src/expert-profiles/portfolio.controller.ts` | `getById` | _To classify_ |
| 136 | `DELETE` | `/portfolio-submissions/me/portfolio/:id` | `backend/src/expert-profiles/portfolio.controller.ts` | `deletePortfolioEntry` | _To classify_ |
| 137 | `GET` | `/portfolio-submissions/me/portfolio/:id` | `backend/src/expert-profiles/portfolio.controller.ts` | `getPortfolioEntry` | _To classify_ |
| 138 | `POST` | `/expert-profile/seams` | `backend/src/expert-profiles/seam-claims.controller.ts` | `createSeamClaim` | _To classify_ |
| 139 | `POST` | `/expert-profile/seams/sync` | `backend/src/expert-profiles/seam-claims.controller.ts` | `syncSeamClaims` | _To classify_ |
| 140 | `GET` | `/internal/prompts/:stage` | `backend/src/internal/internal.controller.ts` | `getPromptTemplate` | _To classify_ |
| 141 | `GET` | `/invitations` | `backend/src/invitations/invitations.controller.ts` | `invitation` | _To classify_ |
| 142 | `DELETE` | `/invitations/:id` | `backend/src/invitations/invitations.controller.ts` | `retractInvitation` | _To classify_ |
| 143 | `POST` | `/invitations/:id/decline` | `backend/src/invitations/invitations.controller.ts` | `declineInvitation` | _To classify_ |
| 144 | `GET` | `/invitations/sent` | `backend/src/invitations/invitations.controller.ts` | `getSentInvitations` | _To classify_ |
| 145 | `GET` | `/services` | `backend/src/listings/listings.controller.ts` | `marketplace` | _To classify_ |
| 146 | `POST` | `/services` | `backend/src/listings/listings.controller.ts` | `Roles` | _To classify_ |
| 147 | `DELETE` | `/services/:id` | `backend/src/listings/listings.controller.ts` | `delete` | _To classify_ |
| 148 | `GET` | `/services/:id` | `backend/src/listings/listings.controller.ts` | `detail` | _To classify_ |
| 149 | `PUT` | `/services/:id` | `backend/src/listings/listings.controller.ts` | `Guard` | _To classify_ |
| 150 | `PUT` | `/services/:id/publish` | `backend/src/listings/listings.controller.ts` | `publish` | _To classify_ |
| 151 | `POST` | `/services/:id/purchase` | `backend/src/listings/listings.controller.ts` | `Guard` | _To classify_ |
| 152 | `PUT` | `/services/:id/unpublish` | `backend/src/listings/listings.controller.ts` | `unpublish` | _To classify_ |
| 153 | `GET` | `/services/me` | `backend/src/listings/listings.controller.ts` | `myListings` | _To classify_ |
| 154 | `GET` | `/services/me/purchases` | `backend/src/listings/listings.controller.ts` | `myPurchases` | _To classify_ |
| 155 | `GET` | `/conversations` | `backend/src/messages/messages.controller.ts` | `getConversations` | _To classify_ |
| 156 | `POST` | `/conversations/:engagementId/read` | `backend/src/messages/messages.controller.ts` | `readEngagement` | _To classify_ |
| 157 | `POST` | `/conversations/read-all` | `backend/src/messages/messages.controller.ts` | `readAll` | _To classify_ |
| 158 | `GET` | `/engagements/:id/messages` | `backend/src/messages/messages.controller.ts` | `page` | _To classify_ |
| 159 | `GET` | `/engagements/:id/messages/unread-count` | `backend/src/messages/messages.controller.ts` | `getUnreadCount` | _To classify_ |
| 160 | `POST` | `/messages/:id/read` | `backend/src/messages/messages.controller.ts` | `markAsRead` | _To classify_ |
| 161 | `GET` | `/projects/:id/messages` | `backend/src/messages/messages.controller.ts` | `page` | _To classify_ |
| 162 | `GET` | `/projects/:id/messages/unread-count` | `backend/src/messages/messages.controller.ts` | `getProjectUnreadCount` | _To classify_ |
| 163 | `DELETE` | `/criteria/:id` | `backend/src/milestones/criteria.controller.ts` | `deleteCriterion` | _To classify_ |
| 164 | `PUT` | `/criteria/:id/revision` | `backend/src/milestones/criteria.controller.ts` | `rejectCriterion` | _To classify_ |
| 165 | `PUT` | `/criteria/:id/verify` | `backend/src/milestones/criteria.controller.ts` | `verifyCriterion` | _To classify_ |
| 166 | `GET` | `/criteria/:milestoneId` | `backend/src/milestones/criteria.controller.ts` | `listCriteria` | _To classify_ |
| 167 | `POST` | `/criteria/:milestoneId` | `backend/src/milestones/criteria.controller.ts` | `createCriterion` | _To classify_ |
| 168 | `GET` | `/milestones/:id/dod` | `backend/src/milestones/dod.controller.ts` | `listDodItems` | _To classify_ |
| 169 | `DELETE` | `/milestones/:id/dod/:itemId` | `backend/src/milestones/dod.controller.ts` | `deleteDodItem` | _To classify_ |
| 170 | `PUT` | `/milestones/:id/dod/:itemId` | `backend/src/milestones/dod.controller.ts` | `Roles` | _To classify_ |
| 171 | `POST` | `/milestones/:id/dod/items` | `backend/src/milestones/dod.controller.ts` | `createDodItem` | _To classify_ |
| 172 | `POST` | `/milestones/:id/dod/items/bulk` | `backend/src/milestones/dod.controller.ts` | `createBulkDodItems` | _To classify_ |
| 173 | `GET` | `/milestones` | `backend/src/milestones/milestones.controller.ts` | `listMilestones` | _To classify_ |
| 174 | `POST` | `/milestones` | `backend/src/milestones/milestones.controller.ts` | `createMilestone` | _To classify_ |
| 175 | `DELETE` | `/milestones/:id` | `backend/src/milestones/milestones.controller.ts` | `deleteMilestone` | _To classify_ |
| 176 | `GET` | `/milestones/:id` | `backend/src/milestones/milestones.controller.ts` | `getMilestone` | _To classify_ |
| 177 | `PATCH` | `/milestones/:id` | `backend/src/milestones/milestones.controller.ts` | `updateMilestone` | _To classify_ |
| 178 | `GET` | `/milestones/:id/disputes` | `backend/src/milestones/milestones.controller.ts` | `getMilestoneDisputes` | _To classify_ |
| 179 | `PUT` | `/milestones/:id/fund` | `backend/src/milestones/milestones.controller.ts` | `fundMilestone` | _To classify_ |
| 180 | `POST` | `/milestones/bulk` | `backend/src/milestones/milestones.controller.ts` | `bulkInitialize` | _To classify_ |
| 181 | `DELETE` | `/notifications/:id` | `backend/src/notifications/notifications.controller.ts` | `deleteNotification` | _To classify_ |
| 182 | `PUT` | `/notifications/:id/read` | `backend/src/notifications/notifications.controller.ts` | `markRead` | _To classify_ |
| 183 | `GET` | `/notifications/me` | `backend/src/notifications/notifications.controller.ts` | `listMyNotifications` | _To classify_ |
| 184 | `GET` | `/notifications/me/unread-count` | `backend/src/notifications/notifications.controller.ts` | `getUnreadCount` | _To classify_ |
| 185 | `PUT` | `/notifications/read-all` | `backend/src/notifications/notifications.controller.ts` | `markAllRead` | _To classify_ |
| 186 | `POST` | `/bank-hub/initiate-link` | `backend/src/payments/bank-hub.controller.ts` | `initiateBankLink` | _To classify_ |
| 187 | `GET` | `/bank-hub/link` | `backend/src/payments/bank-hub.controller.ts` | `getBankLink` | _To classify_ |
| 188 | `PUT` | `/bank-hub/link` | `backend/src/payments/bank-hub.controller.ts` | `updateBankLink` | _To classify_ |
| 189 | `POST` | `/webhooks/sepay/bank-linked` | `backend/src/payments/webhooks.controller.ts` | `handleBankLinked` | _To classify_ |
| 190 | `POST` | `/webhooks/sepay/chi-ho-credit` | `backend/src/payments/webhooks.controller.ts` | `handleChiHo` | _To classify_ |
| 191 | `POST` | `/webhooks/sepay/ipn` | `backend/src/payments/webhooks.controller.ts` | `handleIpn` | _To classify_ |
| 192 | `GET` | `/matching/:projectId/shortlist` | `backend/src/projects/matching.controller.ts` | `getShortlist` | _To classify_ |
| 193 | `GET` | `/projects` | `backend/src/projects/projects.controller.ts` | `getProjects` | _To classify_ |
| 194 | `GET` | `/projects/:id` | `backend/src/projects/projects.controller.ts` | `getProjectDetails` | _To classify_ |
| 195 | `GET` | `/projects/:id/artifact-a` | `backend/src/projects/projects.controller.ts` | `getProjectArtifactA` | _To classify_ |
| 196 | `GET` | `/projects/:id/artifact-b` | `backend/src/projects/projects.controller.ts` | `getProjectArtifactB` | _To classify_ |
| 197 | `POST` | `/projects/:id/milestone-chat` | `backend/src/projects/projects.controller.ts` | `milestoneChatMessage` | _To classify_ |
| 198 | `GET` | `/projects/:id/milestone-chat/sessions` | `backend/src/projects/projects.controller.ts` | `listChatSessions` | _To classify_ |
| 199 | `GET` | `/projects/:id/milestone-chat/sessions/:sessionId` | `backend/src/projects/projects.controller.ts` | `getChatSession` | _To classify_ |
| 200 | `PUT` | `/projects/:id/milestones` | `backend/src/projects/projects.controller.ts` | `updateProjectMilestones` | _To classify_ |
| 201 | `PUT` | `/projects/:id/name` | `backend/src/projects/projects.controller.ts` | `updateProjectName` | _To classify_ |
| 202 | `GET` | `/projects/marketplace` | `backend/src/projects/projects.controller.ts` | `getMarketplace` | _To classify_ |
| 203 | `POST` | `/reviews` | `backend/src/reviews/reviews.controller.ts` | `createReview` | _To classify_ |
| 204 | `GET` | `/reviews/:engagementId` | `backend/src/reviews/reviews.controller.ts` | `getAllReview` | _To classify_ |
| 205 | `GET` | `/reviews/me` | `backend/src/reviews/reviews.controller.ts` | `getMyReviews` | _To classify_ |
| 206 | `GET` | `/reviews/me/received` | `backend/src/reviews/reviews.controller.ts` | `getMyReceivedReviews` | _To classify_ |
| 207 | `GET` | `/reviews/users/:userId` | `backend/src/reviews/reviews.controller.ts` | `getReviewsForUser` | _To classify_ |
| 208 | `GET` | `/milestones/:id/paygated-docs` | `backend/src/submissions/submissions.controller.ts` | `downloadDocument` | _To classify_ |
| 209 | `POST` | `/milestones/:id/paygated-docs` | `backend/src/submissions/submissions.controller.ts` | `uploadDocument` | _To classify_ |
| 210 | `POST` | `/milestones/:id/paygated-docs/bulk` | `backend/src/submissions/submissions.controller.ts` | `uploadBulkDocuments` | _To classify_ |
| 211 | `GET` | `/milestones/:id/submissions` | `backend/src/submissions/submissions.controller.ts` | `getSubmissions` | _To classify_ |
| 212 | `DELETE` | `/milestones/:id/submissions/latest` | `backend/src/submissions/submissions.controller.ts` | `retractSubmission` | _To classify_ |
| 213 | `GET` | `/milestones/:id/submissions/latest` | `backend/src/submissions/submissions.controller.ts` | `getLatestSubmission` | _To classify_ |
| 214 | `POST` | `/milestones/:id/submit` | `backend/src/submissions/submissions.controller.ts` | `submitMilestone` | _To classify_ |
| 215 | `POST` | `/subscriptions/activate` | `backend/src/subscriptions/subscriptions.controller.ts` | `activateSubscription` | _To classify_ |
| 216 | `GET` | `/subscriptions/history` | `backend/src/subscriptions/subscriptions.controller.ts` | `getSubscriptionHistory` | _To classify_ |
| 217 | `GET` | `/subscriptions/status` | `backend/src/subscriptions/subscriptions.controller.ts` | `getSubscriptionStatus` | _To classify_ |
| 218 | `GET` | `/users/:userId/public-profile` | `backend/src/users/users.controller.ts` | `getPublicProfile` | _To classify_ |
| 219 | `GET` | `/users/me` | `backend/src/users/users.controller.ts` | `getUserProfile` | _To classify_ |
| 220 | `PUT` | `/users/me` | `backend/src/users/users.controller.ts` | `updateUserProfile` | _To classify_ |
| 221 | `POST` | `/users/me/add-role` | `backend/src/users/users.controller.ts` | `addRole` | _To classify_ |
| 222 | `PUT` | `/users/me/tax-code` | `backend/src/users/users.controller.ts` | `updateTaxCode` | _To classify_ |
| 223 | `GET` | `/wallets/me` | `backend/src/wallet/wallet.controller.ts` | `getWalletBalance` | _To classify_ |
| 224 | `GET` | `/wallets/me/transactions` | `backend/src/wallet/wallet.controller.ts` | `getWalletTransaction` | _To classify_ |
| 225 | `POST` | `/wallets/virtual-accounts/topup` | `backend/src/wallet/wallet.controller.ts` | `getTopupWallet` | _To classify_ |
| 226 | `GET` | `/withdrawals` | `backend/src/wallet/withdrawals.controller.ts` | `getMyWithdrawals` | _To classify_ |
| 227 | `POST` | `/withdrawals` | `backend/src/wallet/withdrawals.controller.ts` | `requestWithdrawal` | _To classify_ |
| 228 | `DELETE` | `/withdrawals/:id` | `backend/src/wallet/withdrawals.controller.ts` | `cancelWithdrawal` | _To classify_ |


# Appendix B — Endpoint Coverage Ledger Template

Copy one row per canonical Swagger operation.

| Endpoint ID | Method/path | Caller screen/component | Actor | Trigger gesture | Request payload assertions | Success assertion | Negative cases | DB/state assertions | Socket/notification | Test IDs | Result/evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| EP-001 |  |  |  |  |  |  |  |  |  |  |  |

**Classification values:** `DIRECT_UI`, `BACKGROUND_UI`, `INTERNAL_NEST_TO_AI`, `WEBHOOK`, `ADMIN`, `SOCKET`, `HEALTH/OPS`, `DEPRECATED`, `UNREACHABLE_DEFECT`.

# Appendix C — Detailed Test Case Template

```markdown
## TC-[FLOW]-[NNN] — [Title]

- Priority:
- Actors:
- Route/screen:
- Endpoint(s):
- Requirement/business rule:
- Preconditions and seed IDs:
- Initial state snapshot:

### Steps
1. [Gesture]
2. [Input]
3. [Navigation/confirmation]

### Expected UI
- ...

### Expected network contract
- Method/path:
- Headers/auth:
- Payload:
- Status/body:
- Must fire exactly: once / zero times / retry policy

### Expected persistence/state
- Table/model:
- Before:
- After:
- Must remain unchanged:

### Cross-actor result
- Socket event:
- Notification:
- Recipient screen state:

### Negative/concurrency variants
- ...

### Evidence
- Screenshots:
- HAR/log:
- DB query/result:
- Defect:
```

# Appendix D — Final QA Handover Checklist

- [ ] Runtime NestJS Swagger exported from the exact release build.
- [ ] FastAPI OpenAPI exported from the exact release build.
- [ ] Canonical count reconciled to the claimed 255.
- [ ] Every endpoint classified and linked to one or more tests.
- [ ] Every frontend route opened under valid and invalid roles.
- [ ] Every mutation tested for duplicate click and stale state.
- [ ] Every money movement checked for idempotency and atomicity.
- [ ] Every AI dependency tested for timeout/malformed/failure behavior.
- [ ] Every socket-driven change verified after offline refresh.
- [ ] Every state machine terminal state tested against illegal further actions.
- [ ] IDOR/ownership matrix completed.
- [ ] Browser refresh, Back/Forward, multi-tab, and session expiry completed.
- [ ] All Blocker/Critical defects closed and retested.
- [ ] Test evidence archived and linked.
- [ ] Product owner, QA lead, frontend lead, backend lead, and financial-flow owner sign off.
