# AITasker — Unified FE↔BE Integration Guide (v2)

> **Single source of truth for every backend change in `current-backend-code-newest`.**
> Consolidates: DTO de-hardcoding, arrow-format sync, CRUD gap patches, dynamic AI service, and all Group A–F patches.
>
> **Base URL (dev):** `http://localhost:3001`
> **Auth header:** `Authorization: Bearer <access_token>`
> **BigInt serialization:** All `BigInt` fields (`priceVnd`, `availableBalance`, `estimatedTotalCostVnd`, etc.) are serialized as **strings** in JSON responses. Use `String(x)` / `Number(x)` in FE conversions.
> **Error envelope:** `{ statusCode: number, message: string | string[], error: string }`
>   - DTO validation failures → `message` is an **array** of rule violations
>   - Service-layer failures → `message` is a **single string**
> **AI Service URL:** `http://localhost:8000` — internal only, never called by FE directly.

---

## Table of Contents

1. [Architecture & Roles](#1-architecture--roles)
2. [Auth & Account](#2-auth--account)
3. [Subscription Management](#3-subscription-management)
4. [Public Config / Reference Data](#4-public-config--reference-data)
5. [Elicitation Flow — CEO (Stages 1–5)](#5-elicitation-flow--ceo)
6. [Elicitation Flow — Tech Team Handoff](#6-elicitation-flow--tech-team-handoff)
7. [Project & Milestone Management](#7-project--milestone-management)
8. [Milestone Chat Assistant](#8-milestone-chat-assistant)
9. [Expert Profiles & Capability](#9-expert-profiles--capability)
10. [Portfolio Evaluation](#10-portfolio-evaluation)
11. [Listings (Services Marketplace)](#11-listings-services-marketplace)
12. [Engagements, Bids, and Milestones](#12-engagements-bids-and-milestones)
13. [Disputes & Escrow](#13-disputes--escrow)
14. [Wallet & Withdrawals](#14-wallet--withdrawals)
15. [Messages & Conversations](#15-messages--conversations)
16. [Reviews](#16-reviews)
17. [Invitations (CEO → Expert)](#17-invitations-ceo--expert)
18. [Notifications (WebSocket + REST)](#18-notifications)
19. [Admin Dashboard](#19-admin-dashboard)
20. [AI Service Endpoints (Internal Reference)](#20-ai-service-endpoints-internal-reference)
21. [DTO / Schema Conventions (Critical)](#21-dto--schema-conventions-critical)
22. [WebSocket Event Catalog](#22-websocket-event-catalog)
23. [Breaking Changes Cheatsheet](#23-breaking-changes-cheatsheet)
24. [Complete Endpoint Index](#24-complete-endpoint-index)
25. [DB Schema Quick Reference](#25-db-schema-quick-reference)

---

## 1. Architecture & Roles

### 1.1 Three Services

| Service | Port | Tech | Responsibility |
|---------|------|------|----------------|
| NestJS backend | 3001 (host) / 3000 (container) | NestJS + Prisma + PostgreSQL | Auth, CRUD, ledger, websocket, orchestration |
| FastAPI AI service | 8000 | FastAPI + OpenAI SDK | LLM calls, prompt rendering, scoring |
| Frontend | 5173 (vite) / 80 (nginx) | React + Vite | SPA — calls NestJS only |

FE → NestJS only. NestJS ↔ FastAPI over HTTP with `X-Internal-Token` header. FastAPI is not directly callable from FE.

### 1.2 Active Roles & Subtypes

The `User` model has `roles: string[]` (all assigned roles) and `activeRole: string` (currently selected context).

| activeRole | clientSubtype | Notes |
|------------|---------------|-------|
| `CLIENT` | `CEO` | Business owner, creates projects, signs NDAs, funds milestones |
| `CLIENT` | `TECH_TEAM` | Technical reviewer assigned to a CEO's project (registered via handoff link) |
| `EXPERT` | null | Practitioner, bids on projects, fulfills milestones |
| `ADMIN` | null | Platform operator, CMS + dispute oversight |

### 1.3 JWT Payload

```jsonc
{
  "sub": "user-uuid",
  "email": "albert@gmail.com",
  "activeRole": "CLIENT",
  "clientSubtype": "CEO",
  "roles": ["CLIENT"],
  "subscriptionClientTier": "free",
  "subscriptionExpertTier": "free",
  "selfTechnical": false
}
```

Tokens expire in 7d. Refresh tokens stored as `refreshTokenHash` (sha256) on the User row — `POST /auth/logout` invalidates them.

---

## 2. Auth & Account

### 2.1 Register (CEO) — `POST /auth/register` · No auth

Email is **normalized to lowercase** before storage. Password validation returns **all failing rules simultaneously as an array**.

**Request:**
```json
{
  "email": "Albert@Gmail.COM",
  "password": "MyPass123!",
  "fullName": "Albert Tran",
  "phone": "0901234567",
  "roles": "CLIENT_CEO",
  "selfTechnical": false
}
```

**Response 201:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {
    "id": "uuid", "email": "albert@gmail.com", "fullName": "Albert Tran",
    "activeRole": "CLIENT", "clientSubtype": "CEO",
    "subscriptionClientTier": "free", "subscriptionExpertTier": "free",
    "selfTechnical": false
  }
}
```

**Errors:**
- `400` with `message: string[]` — password rule violations (iterate, show as checklist)
- `400` with `message: string` — `"Temporary or throwaway email addresses are not permitted."`
- `400` with `message: string` — `"Email domain does not exist or cannot receive mail."`
- `409` — `"Email already exist!"`

**FE Notes:**
- Distinguish error type by `Array.isArray(message)` — if array, render as checklist
- Show `user.email` from response (not raw input) to confirm normalization
- Login email is NOT normalized server-side — always send lowercase from FE

### 2.2 Login — `POST /auth/login` · No auth

**Request:** `{ "email": "albert@gmail.com", "password": "MyPass123!" }`
**Response 201:** Same shape as register response (with `access_token`, `refresh_token`, `user`)

### 2.3 Register via Handoff Link (Tech Team) — `POST /auth/register/handoff` · No auth

TechTeamProfile.linkedProjectId is set **immediately** if CEO has a published project — FE no longer needs a manual refresh after registration.

**Request:** `{ "invite_token": "...", "email": "...", "password": "...", "fullName": "..." }`
**Response 201:** Same as register — `{ access_token, refresh_token, user }`

### 2.4 Claim Handoff (Existing User) — `POST /auth/claim-handoff` · JWT

For users who already have an account and are accepting a Tech Team invite.

**Request:** `{ "invite_token": "..." }`
**Response 201:** `{ "message": "...", "access_token": "eyJ..." }`

### 2.5 Refresh Token — `POST /auth/refresh` · No auth

**Request:** `{ "refresh_token": "eyJ..." }`
**Response 201:** `{ "access_token": "eyJ...", "refresh_token": "eyJ..." }`

Server validates `refreshTokenHash` against the supplied token. If hash is null (user logged out) → 401.

### 2.6 Logout — `POST /auth/logout` · JWT  *(NEW)*

Server-side invalidation — clears `refreshTokenHash`. Next refresh call with this token returns 401.

**Request:** Empty body
**Response 200:** `{ "success": true }`

### 2.7 Change Password — `PUT /auth/me/password` · JWT  *(NEW)*

Different from forgot-password — this is for authenticated users changing their own password.

**Request:**
```json
{ "currentPassword": "MyPass123!", "newPassword": "NewPass456@" }
```

Password rules (applied to `newPassword`):
- ≥ 8 chars, ≥ 1 uppercase, ≥ 1 lowercase, ≥ 1 number, ≥ 1 special char

**Response 200:** `{ "message": "Password changed successfully. Please log in again." }`

**Side effect:** All sessions invalidated (`refreshTokenHash` cleared). FE must redirect to `/login`.

**Errors:**
- `401` — `"Current password is incorrect."`
- `400` array — password rule violations

### 2.8 Forgot Password — `POST /auth/forgot-password` · No auth

**Request:** `{ "email": "albert@gmail.com" }`
**Response 201 (always same regardless of email existence):**
```json
{ "message": "If an account with that email exists, a reset link has been sent." }
```

### 2.9 Verify Reset Token — `GET /auth/verify-reset-token/:token` · No auth  *(NEW)*

**Call on PAGE LOAD of reset-password page before showing the form.**

**Response 200:** `{ "valid": true }`
**Error 400:** `"This password reset link is invalid or has expired."`

**FE Notes:** If 400 → show expired error with CTA back to `/forgot-password`. Never show reset form before this returns 200.

### 2.10 Reset Password — `POST /auth/reset-password` · No auth

**Request:** `{ "token": "a3f8c2d1...", "newPassword": "NewPass456@" }`
**Response 201:** `{ "message": "Password has been reset successfully. You can now log in." }`

**Errors:**
- `400` — `"This password reset link is invalid or has expired..."` (token already used or expired)
- `400` array — password rule violations

Token is **one-time use**. On success redirect to `/login` with a toast.

### 2.11 Switch Active Role — `POST /auth/switch-role` · JWT

For users with multiple roles (e.g. both CLIENT and EXPERT).

**Request:** `{ "role": "EXPERT" }`
**Response 200:** `{ "access_token": "eyJ...", "user": { ... } }`

### 2.12 Deactivate Own Account — `DELETE /users/me` · JWT  *(NEW)*

Soft-deletes the user (`isActive: false`). Blocked if user has active engagements.

**Response 200:** `{ "message": "Account deactivated successfully." }`
**Error 422:** `"Cannot deactivate account with N active engagement(s). Close them first."`

---

## 3. Subscription Management

### 3.1 Get Status — `GET /subscriptions/status` · JWT

Expired subscriptions auto-return `subscriptionTier: "free"`. FE **must not** do date math — trust the field directly.

**Response 200:**
```json
{
  "subscriptionTier": "free",
  "subscriptionExpires": "2026-01-01T00:00:00.000Z",
  "isExpired": true
}
```

### 3.2 Get Available Packages — `GET /config/subscription-packages?role=CLIENT|EXPERT` · No auth  *(NEW)*

Replaces hardcoded `500,000` / `300,000` VND constants in FE.

**Response 200:**
```json
[{ "id": "uuid", "role": "CLIENT", "name": "Client Pro", "priceVnd": "500000", "durationMonths": 6 }]
```

**FE Notes:** Store `id` as `packageId` for activation. Balance check: `Number(wallet.availableBalance) >= Number(pkg.priceVnd)`.

### 3.3 Activate — `POST /subscriptions/activate` · JWT  *(BREAKING)*

**`packageId` is now REQUIRED.** Previously the backend silently picked the newest package.

**Request (CHANGED):**
```json
{ "activeRole": "CLIENT", "packageId": "uuid-of-chosen-package" }
```

**Response 201:**
```json
{
  "access_token": "eyJ...",
  "activatedPackage": { "name": "Client Pro", "priceVnd": "500000", "durationMonths": 6 }
}
```

**Errors:**
- `422` — `INSUFFICIENT_BALANCE` (cannot afford)
- `422` — `"package unavailable"` (deleted or inactive)
- `422` — `"role mismatch"` (e.g. activating EXPERT package with CLIENT role)
- `409` — `"already active"` (current sub not expired yet)

### 3.4 History — `GET /subscriptions/history` · JWT  *(NEW)*

**Response 200:**
```json
[{
  "id": "uuid", "packageName": "Client Pro", "role": "CLIENT",
  "amountPaidVnd": "500000",
  "purchasedAt": "2026-01-15T...", "expiresAt": "2026-07-15T...",
  "isExpired": false
}]
```

**FE Notes:** Format dates UTC+7. `isExpired` is pre-computed — use directly for badges.

---

## 4. Public Config / Reference Data

All endpoints in this section are **unauthenticated**. Call on app mount or page mount as appropriate. These replace **every** previously-hardcoded array in FE.

### 4.1 Domains — `GET /config/domains`

```json
[{ "id": "uuid", "code": "A", "name": "LLM App Engineering", "description": null, "sortOrder": 1, "isActive": true }]
```

Used on: Expert profile domain-depth form, Expert bid form, Service listing form.

### 4.2 Seams — `GET /config/seams`

```json
[{ "id": "uuid", "code": "A↔C", "name": "LLM output quality", "description": null, "sortOrder": 1, "isActive": true }]
```

⚠️ **CRITICAL:** Seam codes use the **`↔` (U+2194) arrow character** — NOT `<->`, `->`, or `<=>`. The DB stores the arrow form. Submitting the old format causes 400 Bad Request.

### 4.3 Archetypes — `GET /config/archetypes`

```json
[{
  "id": "uuid", "code": "1", "name": "RAG/Search",
  "description": "Chatbots, knowledge base Q&A, document retrieval",
  "sortOrder": 1, "isActive": true
}]
```

Used on: Stage 2 archetype selection grid (replaces hardcoded `['1'..'6']`).

### 4.4 Probe Questions — `GET /config/archetypes/:code/probe-questions`

Example: `GET /config/archetypes/1/probe-questions`

```json
[{
  "id": "uuid", "archetypeCode": "1",
  "questionText": "Roughly how many people will search or ask questions per day?",
  "displayOrder": 1, "isActive": true
}]
```

Used on: Stage 3 — `questionText` is **both** the display label AND the request body key (see §5.5).

### 4.5 Void Codes — `GET /config/void-codes`  *(NEW — Dynamic AI)*

```json
[
  {
    "id": "uuid", "code": "NO_GROUND_TRUTH",
    "name": "No Ground Truth",
    "description": "No labelled data or benchmark mentioned. Risks building AI with no way to measure success.",
    "severity": "HIGH", "sortOrder": 1, "isActive": true
  },
  {
    "id": "uuid", "code": "MISSING_TECHNICAL_ARTIFACT",
    "name": "Missing Technical Artifact",
    "description": "A critical technical document mentioned but not submitted. Synthesis cannot be faithfully grounded.",
    "severity": "HIGH", "sortOrder": 2, "isActive": true
  }
]
```

Used on: Stage 2 — display detected void names + descriptions to CEO during acknowledgement.

**FE Notes:** Cross-reference `session.voidListJson[].void_code` with this endpoint's `code` field for display.

### 4.6 Subscription Packages — `GET /config/subscription-packages?role=CLIENT|EXPERT`

See §3.2.

### 4.7 All Config in One Call — `GET /config/all`  *(NEW)*

Returns domains + seams + archetypes + void codes + subscription packages in a single round trip.

```json
{
  "domains": [...], "seams": [...], "archetypes": [...],
  "voidCodes": [...], "subscriptionPackages": [...]
}
```

**FE Notes:** Use on app mount to avoid 5 separate network calls on initial load.

---

## 5. Elicitation Flow — CEO

All endpoints in this section require **JWT · Role: CLIENT (CEO subtype)** unless noted.

### 5.1 Start / Resume Session — `POST /elicitation/sessions/start`

**Response 201:**
```json
{
  "id": "session-uuid", "currentStage": 1, "state": "IN_PROGRESS",
  "stage1OriginalInput": null, "criticalArtifactsJson": null,
  "voidListJson": null, "recommendedArchetypesJson": null,
  "archetype": null, "stage3ProbesJson": null,
  "stage4TechInputsJson": null, "stage4DraftJson": null,
  "estimatedBudgetVnd": null
}
```

### 5.2 Get Session — `GET /elicitation/sessions/:id`

**Response 200 (key fields to act on):**
```json
{
  "id": "session-uuid", "currentStage": 2, "state": "IN_PROGRESS",
  "stage1OriginalInput": "We need an AdTech compliance pipeline based on our ruleset...",
  "stage1SymptomsJson": ["No automated ad compliance checking", "Manual review delays"],
  "criticalArtifactsJson": [
    {
      "artifact_key": "compliance_ruleset",
      "label": "Compliance Ruleset",
      "reason": "Ruleset content needed for milestone scope accuracy",
      "placeholder_prompt": "Please paste your compliance rules here"
    }
  ],
  "voidListJson": [{ "void_code": "MISSING_TECHNICAL_ARTIFACT", "severity": "HIGH" }],
  "recommendedArchetypesJson": ["3", "1"],
  "estimatedBudgetVnd": "200000000",
  "stage4DraftJson": null
}
```

**FE action items:**
- `stage1OriginalInput`: show "What you wrote" vs "What AI understood" diff side-by-side with `stage1SymptomsJson`
- `criticalArtifactsJson`: show persistent reminder in Stage 4 to submit documents
- `stage4DraftJson`: pre-fill Stage 4 form on revisit
- `estimatedBudgetVnd`: BigInt → string. `Number(x)` for display

### 5.3 Stage 1 — Submit Symptoms — `POST /elicitation/sessions/:id/stage1`

**Request:** `{ "symptomText": "We need an AdTech compliance pipeline based on our ruleset. Budget 200M VND." }`

**Response 200 (NEW: `criticalArtifactsJson` field):**
```json
{
  "currentStage": 2,
  "stage1OriginalInput": "We need an AdTech compliance pipeline...",
  "stage1SymptomsJson": ["No automated ad compliance checking"],
  "criticalArtifactsJson": [
    {
      "artifact_key": "compliance_ruleset",
      "label": "Compliance Ruleset",
      "reason": "The AI will judge based on your ruleset — its content defines milestone acceptance criteria",
      "placeholder_prompt": "Paste your compliance rules here"
    }
  ],
  "voidListJson": [{ "void_code": "MISSING_TECHNICAL_ARTIFACT", "severity": "HIGH" }],
  "recommendedArchetypesJson": ["3", "1"],
  "estimatedBudgetVnd": "200000000"
}
```

**FE Notes:**
- If `criticalArtifactsJson` is non-empty → display persistent banner: "Submit these documents in Stage 4"
- Look up void descriptions via `GET /config/void-codes` using `void_code` as key
- Show `stage1OriginalInput` vs `stage1SymptomsJson` side-by-side

### 5.4 Stage 2 — Select Archetype — `POST /elicitation/sessions/:id/stage2`

**Request:**
```json
{
  "archetype": "3",
  "acknowledgedVoidCodes": ["MISSING_TECHNICAL_ARTIFACT", "NO_GROUND_TRUTH"]
}
```

**FE Notes:**
- Fetch archetype options from `GET /config/archetypes` — DO NOT hardcode `['1'..'6']`
- Fetch void codes from `GET /config/void-codes` to render each void with name + description
- CEO must acknowledge **ALL** detected voids (backend validates the list matches `voidListJson`)

### 5.5 Stage 3 — Probe Questions — `POST /elicitation/sessions/:id/stage3`

**Changed (Dynamic AI Issue 2):** Questions come from DB. Response now has separate `irrelevant_answers` array.

**Request (keys are the question texts):**
```json
{
  "probe_responses": {
    "Roughly how many items need classifying per day?": "Around 50,000 ad assets",
    "What should happen when the system isn't confident?": "Route to human reviewer",
    "Where does data come from today?": "Uploaded via our platform API",
    "How quickly must classification complete?": "Under 2 seconds"
  }
}
```

**Response 200 (NEW: `irrelevant_answers` field):**
```json
{
  "currentStage": 4,
  "vaguenessResult": {
    "vague_answers": [],
    "irrelevant_answers": [
      {
        "question": "Where does data come from today?",
        "issue": "Answer is too generic — missing how AI will authenticate against the AdTech API"
      }
    ]
  }
}
```

**FE Notes (CRITICAL UX CHANGE):**
- Show `vague_answers` and `irrelevant_answers` as **separate warning sections** with different guidance copy
- Vague: "Please be more specific"
- Irrelevant: "This doesn't address the project context"
- **Neither blocks submission** — both are warnings only

### 5.6 Stage 4 — Auto-Save Draft — `PATCH /elicitation/sessions/:id/stage4-draft` · No LLM call  *(NEW)*

Call every 30s or on field blur.

**Request:** `{ "draftJson": { ...form values... } }`
**Response 200:** `{ "saved": true }`

### 5.7 Stage 4 — Submit Technical Context — `POST /elicitation/sessions/:id/stage4`

**Changed (Dynamic AI Issue 4):** New fields `additional_requirement_1` and `technical_artifacts`.

**Request (CHANGED):**
```json
{
  "current_stack": "Python FastAPI + PostgreSQL",
  "data_available": "50,000 ad assets/day, historical CSV",
  "latency_requirement": "Under 2 seconds at P95",
  "additional_requirement_1": "Must integrate with SSO, stay GDPR-compliant",
  "technical_artifacts": {
    "compliance_ruleset": "Rule 1: No misleading health claims.\nRule 2: Financial products must display APR.\nRule 3: Prohibited: gambling, tobacco."
  }
}
```

**Response 200 (CHANGED SHAPE — now `{ session, missingArtifacts }`):**
```json
{
  "session": {
    "currentStage": 5,
    "stage4TechInputsJson": {
      "technical_artifacts": { "compliance_ruleset": "..." }
    }
  },
  "missingArtifacts": []
}
```

If artifacts not submitted:
```json
{
  "session": { "currentStage": 5 },
  "missingArtifacts": [
    {
      "artifact_key": "compliance_ruleset",
      "label": "Compliance Ruleset",
      "reason": "...",
      "placeholder_prompt": "..."
    }
  ]
}
```

**FE Notes (CRITICAL UX CHANGE):**
- Build **dynamic form**: one `<textarea>` per `criticalArtifactsJson` item, keyed by `artifact_key`
- `technical_artifacts` keys come from `session.criticalArtifactsJson[].artifact_key`
- If `missingArtifacts` non-empty → show warning modal "Submit incomplete spec?" — **do NOT hard-block**
- Submitted artifacts → AI uses actual content for milestone acceptance criteria
- Missing artifacts → AI generates generic spec, `completeness_score` capped at 0.60

### 5.8 Stage 5 — Publish Project — `POST /elicitation/sessions/:id/stage5` · No body

**Fixed (A-1):** TechTeam now linked immediately upon publish — they see project without manual refresh.

**Response 201 (NEW: `estimatedTotalCostVnd` / `estimatedTotalDurationDays` from E-2):**
```json
{
  "id": "project-uuid",
  "projectName": "AdTech Compliance Classifier",
  "state": "PUBLISHED", "archetype": "3", "tier": "TIER_2",
  "artifact_a_json": {
    "project_name": "AdTech Compliance Classifier",
    "business_intent": "Automate ad asset review against the client compliance ruleset...",
    "sdlc_notices": ["Compliance ruleset received — milestone criteria grounded to actual rules"]
  },
  "required_domains_json": [{ "domain_code": "A", "required_depth": "INTERMEDIATE" }],
  "required_seams_json": [{ "seam_code": "A↔C", "criticality": "load_bearing" }],
  "milestone_framework_json": [
    {
      "milestone_number": 1,
      "deliverable_statement": "Rule parser ingesting the 3-category ruleset, outputting structured policy objects",
      "sign_off_authority": "JOINT",
      "payment_amount_vnd": 0,
      "estimated_cost_vnd": 40000000,
      "estimated_duration_days": 14
    }
  ],
  "estimatedTotalCostVnd": "120000000",
  "estimatedTotalDurationDays": 42
}
```

**FE Notes:**
- `milestone_framework_json[].deliverable_statement` now references actual submitted artifact content
- Show `estimatedTotalCostVnd` / `estimatedTotalDurationDays` as "AI estimates" badges on project dashboard
- TechTeam linked to CEO sees project immediately in their dashboard
- `payment_amount_vnd` is **always 0** from AI — CEO sets real amounts via `PATCH /milestones/:id` later

### 5.9 Revert Session — `POST /elicitation/sessions/:id/revert`

Allows CEO to go back to a prior stage for editing.

**Request:** `{ "targetStage": 2 }`

### 5.10 Set Self-Technical Flag — `POST /elicitation/sessions/:id/set-self-technical`

When CEO declares themselves technical (skips tech team handoff).

**Request:** `{ "selfTechnical": true }`

### 5.11 Invite Tech Team — `POST /elicitation/sessions/:id/invite-tech-team`

Sends a handoff invite link to a tech team member's email.

**Request:** `{ "email": "cto@company.com", "roleTitle": "CTO" }`

---

## 6. Elicitation Flow — Tech Team Handoff

### 6.1 Stage 4 Handoff Submit — `POST /elicitation/sessions/:id/stage4-handoff` · JWT · Role: EXPERT (Tech Team subtype)

Same shape changes as CEO Stage 4 — add `technical_artifacts` and `additional_requirement_1`. Response shape is `{ session, missingArtifacts }` — same as §5.7.

### 6.2 Save Draft (Tech Team) — `PATCH /elicitation/sessions/:id/stage4-draft` · JWT

Same as §5.6 — both CEO and Tech Team can save drafts to the same session.

---

## 7. Project & Milestone Management

### 7.1 List Projects — `GET /projects` · JWT

Returns projects the user has access to:
- CEO: their own projects
- Tech Team: projects they're linked to (now visible immediately after registration — A-1 fix)
- Expert: projects they have engagements on
- Admin: all projects

**Response 200:** Array of project objects (see §7.2 shape)

### 7.2 Get Project Detail — `GET /projects/:id` · JWT · Roles: CLIENT, EXPERT, ADMIN

**Changed (A-1 expert flow fix):** Now includes `required_domains_json`, `required_seams_json`, `milestone_framework_json` so experts can build their bid.

**Response 200:**
```json
{
  "id": "project-uuid",
  "state": "PUBLISHED", "archetype": "3", "tier": "TIER_2",
  "projectName": "AdTech Compliance Classifier",
  "artifact_a_json": { "project_name": "...", "business_intent": "...", "sdlc_notices": [...] },
  "required_domains_json": [{ "domain_code": "A", "required_depth": "INTERMEDIATE" }],
  "required_seams_json": [{ "seam_code": "A↔C", "criticality": "load_bearing" }],
  "milestone_framework_json": [
    {
      "milestone_number": 1,
      "deliverable_statement": "...",
      "estimated_cost_vnd": 40000000,
      "estimated_duration_days": 14
    }
  ],
  "estimatedTotalCostVnd": "120000000",
  "estimatedTotalDurationDays": 42
}
```

**FE Notes:** Use `required_domains_json` + `required_seams_json` for Expert BidForm requirements display. Look up human-readable names via `GET /config/domains` and `GET /config/seams`.

### 7.3 List Project Engagements — `GET /projects/:id/engagements` · JWT  *(NEW)*

Access: CEO of project, linked Tech Team, or Admin.

**Response 200:**
```json
[{
  "id": "engagement-uuid", "state": "PENDING", "type": "PROJECT_BASED",
  "expert": { "id": "uuid", "fullName": "Jane Expert", "email": "jane@..." },
  "_count": { "milestones": 3 },
  "createdAt": "2026-..."
}]
```

### 7.4 List Project Invitations — `GET /projects/:id/invitations` · JWT · CLIENT only  *(NEW)*

```json
[{
  "id": "invitation-uuid", "status": "PENDING",
  "expert": { "id": "uuid", "fullName": "...", "email": "..." },
  "invitedAt": "2026-07-09T..."
}]
```

### 7.5 List Project Team — `GET /projects/:id/team` · JWT · CLIENT, ADMIN  *(NEW)*

```json
[{
  "userId": "uuid", "linkedProjectId": "project-uuid", "roleTitle": "CTO",
  "user": { "id": "uuid", "fullName": "...", "email": "..." }
}]
```

### 7.6 List Project Milestones — `GET /projects/:id/milestones` · JWT  *(NEW)*

Returns milestones across all engagements on this project.

```json
[{
  "id": "uuid", "milestoneNumber": 1, "state": "DEFINED",
  "deliverableStatement": "...",
  "acceptanceCriteria": [...], "dodItems": [...]
}]
```

### 7.7 Cancel Project — `PUT /projects/:id/cancel` · JWT · CLIENT  *(NEW)*

Only allowed in `PUBLISHED` state with no active engagements.

**Response 200:** Updated project with `state: "SUSPENDED"`
**Error 422:** `"Cannot cancel project with N active engagement(s). Close them first."`

### 7.8 Edit Milestone — `PATCH /milestones/:id` · JWT · CLIENT  *(NEW — E-1)*

Only when `state: "DEFINED"`.

**Request (all optional):**
```json
{
  "title": "Phase 1",
  "deliverable_statement": "...",
  "sign_off_authority": "JOINT",
  "payment_amount_vnd": 40000000,
  "estimated_duration_days": 14,
  "tech_stack": ["Python", "FastAPI"]
}
```

**Response 200:** Updated milestone with all fields
**Errors:** `403` (not CEO) | `422` (state not DEFINED) | `404`

### 7.9 Delete Milestone — `DELETE /milestones/:id` · JWT · CLIENT  *(NEW — E-1)*

Only when `state: "DEFINED"`.

**Response 200:** `{ "id": "...", "milestoneNumber": 1 }`

### 7.10 List Milestones by Engagement — `GET /milestones?engagementId=...` · JWT  *(NEW)*

```json
[{
  "id": "uuid", "milestoneNumber": 1, "state": "DEFINED",
  "deliverableStatement": "...",
  "acceptanceCriteria": [...], "dodItems": [...]
}]
```

### 7.11 Milestone Submissions History — `GET /milestones/:id/submissions` · JWT  *(NEW)*

```json
[{
  "id": "uuid", "milestoneId": "...", "expertId": "...",
  "description": "...", "filesJson": [...],
  "submittedAt": "2026-..."
}]
```

### 7.12 Latest Submission — `GET /milestones/:id/submissions/latest` · JWT  *(NEW)*

Returns most recent submission object (same shape as §7.11 single item) or 404.

### 7.13 Milestone Disputes — `GET /milestones/:id/disputes` · JWT  *(NEW)*

Returns all disputes filed against this milestone.

### 7.14 Acceptance Criteria CRUD — `/criteria/...` · JWT  *(NEW)*

| Method | Path | Role | Notes |
|--------|------|------|-------|
| `GET` | `/criteria/:milestoneId` | CLIENT, EXPERT, ADMIN | List criteria for milestone |
| `POST` | `/criteria/:milestoneId` | CLIENT | Add criterion. Body: `{ criterion_text, is_required? }` |
| `DELETE` | `/criteria/:id` | CLIENT | Delete criterion |

On `POST`, NestJS calls AI service `/llm/criterion-check` asynchronously to write an `advisory_note` to `platform_decisions` if the criterion is subjective. **Advisory only — non-blocking.**

### 7.15 DoD Items List & Delete — `/milestones/:id/dod/...` · JWT  *(NEW)*

| Method | Path | Role | Notes |
|--------|------|------|-------|
| `GET` | `/milestones/:id/dod` | CLIENT, EXPERT, ADMIN | List DoD items |
| `DELETE` | `/milestones/:id/dod/:itemId` | EXPERT, CLIENT | Only if `status: "PENDING"` |

---

## 8. Milestone Chat Assistant

All: JWT · Roles: CLIENT, EXPERT

### 8.1 Send Message — `POST /projects/:id/milestone-chat`  *(NEW — E-3)*

Omit `chatSessionId` to start a new conversation. History is server-side — FE only stores `chatSessionId`.

**First message:**
```json
{ "message": "Why 3 milestones?" }
```

**Follow-up:**
```json
{ "message": "Can we cut milestone 2 cost?", "chatSessionId": "uuid" }
```

**Response 200:**
```json
{
  "reply": "The AI split into 3 milestones because...",
  "suggestedEdit": {
    "milestone_number": 2,
    "field": "paymentAmountVnd",
    "suggested_value": 30000000,
    "reason": "Standard data pipeline milestone cost at TIER_2 scope"
  },
  "chatSessionId": "session-uuid",
  "sessionTitle": "Chat · 09/07/2026",
  "messageCount": 2
}
```

`suggestedEdit` is `null` when no edit suggested. When present, show one-click **Apply** button → `PATCH /milestones/:id` with the suggested value.

### 8.2 List Sessions — `GET /projects/:id/milestone-chat/sessions`

```json
[{ "id": "uuid", "title": "Chat · 09/07/2026", "messageCount": 6, "updatedAt": "2026-..." }]
```

### 8.3 Get Session History — `GET /projects/:id/milestone-chat/sessions/:sessionId`

```json
{
  "id": "uuid",
  "title": "Chat · 09/07/2026",
  "messagesJson": [
    { "role": "user", "content": "Why 3 milestones?" },
    { "role": "assistant", "content": "The AI split into..." }
  ],
  "createdAt": "2026-...", "updatedAt": "2026-..."
}
```

**FE Notes:** Store only `chatSessionId` in FE state. On page mount fetch sessions list for sidebar; on session click fetch history.

---

## 9. Expert Profiles & Capability

### 9.1 Get My Expert Profile — `GET /expert-profile/me` · JWT · EXPERT

### 9.2 Update My Expert Profile — `PATCH /expert-profile/me` · JWT · EXPERT

Body: `{ "bio": "...", "engagementModel": "MILESTONE", "stackTags": ["Python", "FastAPI"] }`

### 9.3 Search Experts — `GET /expert-profile/search` · JWT · CLIENT, ADMIN  *(NEW)*

Query params: `?domain=A&seam=A↔C&archetype=3&limit=20`

```json
[{
  "userId": "uuid",
  "user": { "id": "uuid", "fullName": "..." },
  "expertDomainDepths": [{ "domainCode": "A", "depthLevel": "DEEP" }],
  "expertSeamClaims": [{ "seamCode": "A↔C", "verificationTier": "EVIDENCE_BACKED" }]
}]
```

### 9.4 View Public Expert Profile — `GET /expert-profile/:userId` · JWT · CLIENT, ADMIN  *(NEW)*

```json
{
  "profile": { "userId": "...", "bio": "...", "engagementModel": "MILESTONE", "stackTagsJson": [...] },
  "user": { "id": "uuid", "fullName": "..." },
  "domainDepths": [...],
  "seamClaims": [...],
  "avgRating": 4.7,
  "reviewCount": 12
}
```

### 9.5 Browse Experts (alt endpoint) — `GET /users/experts` · JWT · CLIENT, ADMIN  *(NEW)*

Query params: `?stackTag=Python&archetype=1&limit=20`

```json
[{
  "id": "uuid", "fullName": "...", "bio": "...",
  "engagementModel": "MILESTONE",
  "stackTags": ["Python", "FastAPI"],
  "domainDepths": [{ "domainCode": "A", "depthLevel": "DEEP" }],
  "verifiedSeams": [{ "seamCode": "A↔C", "verificationTier": "EVIDENCE_BACKED" }]
}]
```

### 9.6 Domain Depths — Own

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/expert-profile/me/domains` | List own domain depth claims |
| `POST` | `/expert-profile/domains` | Upsert. Body: `{ domainCode, depthLevel }` |
| `PUT` | `/expert-profile/domains/:id` | Update. Body: `{ depthLevel }` |
| `DELETE` | `/expert-profile/domains/:id` | Delete (only if no portfolio submissions) |

### 9.7 Seam Claims — Own

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/expert-profile/me/seams` | List own seam claims with verification status |
| `POST` | `/expert-profile/seams` | Upsert. Body: `{ seamCode }` |

### 9.8 Sync Domains / Seams (Bulk)

- `POST /expert-profile/domains/sync` — Body: `{ items: [{ code, depth }] }`
- `POST /expert-profile/seams/sync` — Body: `{ items: [{ code }] }`

Replaces entire set — use for "Save All" button on profile edit page.

---

## 10. Portfolio Evaluation

### 10.1 Submit Portfolio Entry — `POST /expert-profile/me/portfolio` · JWT · EXPERT

**Request:**
```json
{
  "seam_code": "A↔C",
  "project_description": "Built an enterprise document QA system for a 500-lawyer legal firm...",
  "decision_points": "At the A↔C seam: evaluated BERTScore vs ROUGE-L..."
}
```

**Response 201:**
```json
{
  "id": "submission-uuid",
  "status": "APPROVED",  // or "REJECTED"
  "llmConfidence": 0.92,
  "evaluatedAt": "2026-..."
}
```

**Behind the scenes:**
1. NestJS increments `expert_seam_claims.submission_count`
2. Calls FastAPI `/llm/portfolio-eval` with seam definitions from DB
3. If `passed_boolean = true` → `verification_tier` upgraded to `EVIDENCE_BACKED`
4. If `passed_boolean = false` → increment failure count, check lockout threshold
5. Writes `platform_decisions` row with confidence + gap_advisory

### 10.2 Get Portfolio Entry — `GET /expert-profile/me/portfolio/:id` · JWT · EXPERT  *(NEW)*

### 10.3 List My Portfolio — `GET /expert-profile/me/portfolio` · JWT · EXPERT

### 10.4 Delete Portfolio Entry — `DELETE /expert-profile/me/portfolio/:id` · JWT · EXPERT  *(NEW)*

---

## 11. Listings (Services Marketplace)

### 11.1 Create Listing — `POST /services` · JWT · EXPERT

**Two modes:**

**Mode A — Manual:**
```json
{
  "serviceType": "AI_SERVICE",
  "title": "Production RAG Pipeline Design",
  "description": "...",
  "scope": "...",
  "timeline": "...",
  "priceVnd": 45000000,
  "domainsJson": ["A", "D"],
  "seamsJson": ["A↔C", "A↔D"]
}
```

**Mode B — AI-Assisted:**
```json
{
  "serviceType": "AI_SERVICE",
  "useAiGenerator": true,
  "title": null,  // optional override
  "priceVnd": null,
  "capabilities": ["5 years building RAG systems", "..."],
  "targetUseCases": ["Enterprise knowledge base search", "..."]
}
```

When `useAiGenerator: true`, NestJS calls FastAPI `/llm/service-generate` with the expert's claimed domains + seams + DB price guidance. Result pre-fills the form; expert edits and publishes.

**Response 201 (AI-assisted returns extra fields):**
```json
{
  "id": "service-uuid", "state": "DRAFT",
  "title": "Production RAG Pipeline Design & Implementation",
  "description": "...", "scope": "...", "timeline": "...",
  "priceVnd": "45000000",
  "suggestedDomains": ["A", "D"],       // AI mode only
  "suggestedSeams": ["A↔C", "A↔D"],     // AI mode only
  "pricingRationale": "Senior specialist work with vector DB expertise"  // AI mode only
}
```

### 11.2 List Published Services — `GET /services` · JWT · Optional auth

Query filters (all optional):
- `?serviceType=AI_SERVICE|TECH_DISCOVERY`
- `?domains=A&domains=D` (array)
- `?seams=A↔C&seams=A↔D` (array)
- `?minPriceVnd=10000000&maxPriceVnd=50000000`

### 11.3 Get Listing — `GET /services/:id` · JWT

### 11.4 Update Listing — `PUT /services/:id` · JWT · EXPERT (owner)

### 11.5 Delete Listing — `DELETE /services/:id` · JWT · EXPERT  *(NEW)*

Only allowed on `DRAFT` state. To delete a published listing, call `PUT /services/:id/unpublish` first.

### 11.6 Publish / Unpublish  *(NEW)*

- `PUT /services/:id/publish` — `DRAFT` → `PUBLISHED`
- `PUT /services/:id/unpublish` — `PUBLISHED` → `DRAFT`

**Response:** Updated service object with `priceVnd` as string.

### 11.7 My Listings — `GET /services/me` · JWT · EXPERT  *(NEW)*

Returns all listings (including drafts) for the current expert. `priceVnd` is string.

### 11.8 My Purchases — `GET /services/me/purchases` · JWT · CLIENT  *(NEW)*

Returns engagements where the client purchased a service.

---

## 12. Engagements, Bids, and Milestones

### 12.1 List Engagements — `GET /engagements` · JWT

Returns engagements where the user is client, expert, or (admin) any.

### 12.2 Get Engagement — `GET /engagements/:id` · JWT

### 12.3 Get Engagement Bid — `GET /engagements/:id/bid` · JWT  *(NEW)*

Returns the capability bid for this engagement.

### 12.4 Get Engagement Disputes — `GET /engagements/:id/disputes` · JWT  *(NEW)*

```json
[{
  "id": "uuid", "state": "MANUAL_REVIEW", "llmConfidence": 0.55,
  "milestone": { "milestoneNumber": 2, "deliverableStatement": "..." },
  "filedAt": "2026-..."
}]
```

### 12.5 Get Engagement Milestones — `GET /engagements/:id/milestones` · JWT  *(NEW)*

### 12.6 Get Engagement Submissions — `GET /engagements/:id/submissions` · JWT  *(NEW)*

All milestone submissions across all milestones in this engagement.

### 12.7 Cancel Engagement — `PUT /engagements/:id/cancel` · JWT  *(NEW)*

Blocked if any milestone is `FUNDED`, `SUBMITTED`, or `IN_REVISION`. Resolve them first.

### 12.8 Accept NDA — `POST /engagements/:id/nda-acceptance` · JWT

Body: `{ }` (no payload). Marks `clientNdaAcceptedAt` or `expertNdaAcceptedAt` depending on role.

### 12.9 List Bids — `GET /bids` · JWT  *(NEW)*

Role-scoped:
- **EXPERT** → all their own bids
- **CLIENT (CEO)** → bids for their projects (filter with `?projectId=...`)
- **ADMIN** → all bids

```json
[{
  "id": "bid-uuid", "state": "SUBMITTED",
  "engagement": {
    "project": { "id": "...", "projectName": "...", "state": "PUBLISHED" }
  },
  "approachSummary": "...",
  "negotiatedPriceVnd": "50000000",
  "createdAt": "2026-..."
}]
```

### 12.10 Submit Bid — `POST /bids` · JWT · EXPERT

**Request:**
```json
{
  "projectId": "project-uuid",
  "footprint_alignment_json": {
    "domains": [
      { "code": "A", "depth": "DEEP" },
      { "code": "D", "depth": "OPERATIONAL" }
    ],
    "seams": [
      { "code": "A↔C", "tier": "EVIDENCE_BACKED" },
      { "code": "A↔D", "tier": "CLAIMED" }
    ]
  },
  "approach_summary": "Will deliver in 3 phases...",
  "conditional_pricing_json": [
    { "milestone_number": 1, "price_vnd": 15000000, "condition": "Standard scope" },
    { "milestone_number": 2, "price_vnd": 25000000, "condition": "Includes reranker" }
  ]
}
```

**Changed (A-3):** CEO **and** all linked Tech Team members receive real-time `notification:generic` WebSocket event on bid submission.

**Critical DTO rules (from de-hardcoding patch):**
- `domain.code` accepts any non-empty string — actual codes are validated against `domain_definitions` table at the service layer
- `seam.code` accepts any non-empty string — actual codes are validated against `seam_definitions` table
- Use the **`↔` arrow character**, never `<->`
- `depth` MUST be one of: `SURFACE`, `OPERATIONAL`, `DEEP` (enum)
- `tier` MUST be one of: `CLAIMED`, `EVIDENCE_BACKED` (enum)

### 12.11 Update Bid — `PUT /bids/:id` · JWT · EXPERT

Same body shape as §12.10 minus `projectId` (implicit in URL).

### 12.12 Withdraw Bid — `DELETE /bids/:id` · JWT · EXPERT  *(NEW)*

Only allowed when `state: "SUBMITTED"`. Sets state to `WITHDRAWN` and engagement back to `PENDING`.

**Response:** `{ "withdrawn": true, "bidId": "..." }`

### 12.13 Tech Review — `POST /bids/:id/tech-review` · JWT · TECH_TEAM

Body: `{ "techStatus": "APPROVED" | "REVISION_REQUESTED", "techFeedback": "..." }`

### 12.14 CEO Decision — `POST /bids/:id/ceo-decision` · JWT · CLIENT (CEO)

Body: `{ "ceoStatus": "APPROVED" | "DECLINED" }`

When `APPROVED` → bid state becomes `SELECTED`, engagement state becomes `CONNECTED`, escrow accounts created for milestones.

### 12.15 Counter Offer — `POST /bids/:id/counter-offer` · JWT

Body: `{ "negotiatedPriceVnd": 40000000 }`

### 12.16 Shortlist Service — `POST /bids/:id/shortlist` · JWT · CLIENT

Toggles shortlist flag. Used for the CEO's shortlist view.

---

## 13. Disputes & Escrow

### 13.1 File Dispute — `POST /disputes` · JWT · CLIENT, EXPERT

**Request:**
```json
{
  "engagementId": "uuid",
  "milestoneId": "uuid",
  "criterionId": "uuid",
  "escrowAccountId": "uuid",
  "filedById": "uuid"  // = current user
}
```

**Behind the scenes:**
1. Create dispute row with `state: "LAYER_1_EVAL"`
2. Call FastAPI `/llm/dispute-eval` with criterion text, deliverable description, files, project archetype, milestone context, prior revision count
3. Write `llm_confidence` to dispute row
4. If `confidence_score >= 0.80` → `state: "AUTO_RESOLVED"`, escrow released per `finding`
5. If `confidence_score < 0.80` → `state: "MANUAL_REVIEW"`, admin sees in queue

### 13.2 List Disputes — `GET /disputes` · JWT · ADMIN

### 13.3 Get Dispute — `GET /disputes/:id` · JWT

### 13.4 Submit Evidence — `POST /disputes/:id/evidence` · JWT  *(NEW)*

Only on `LAYER_1_EVAL` or `MANUAL_REVIEW` state.

**Request:**
```json
{ "evidence_description": "...", "file_urls": ["https://..."] }
```

**Response:** `{ "submitted": true, "disputeId": "..." }`

### 13.5 Withdraw Dispute — `PUT /disputes/:id/withdraw` · JWT  *(NEW)*

Only the filer can withdraw, and only on open states.

### 13.6 Resolve Dispute (Admin) — `POST /disputes/:id/resolve` · JWT · ADMIN

Body: `{ "resolution": "expert_wins" | "client_wins" | "split", "note": "..." }`

### 13.7 List Milestone Disputes — `GET /milestones/:id/disputes` · JWT

See §7.13.

---

## 14. Wallet & Withdrawals

### 14.1 Get My Wallet — `GET /wallets/me` · JWT

```json
{
  "id": "wallet-uuid",
  "availableBalance": "500000",
  "lockedBalance": "200000"
}
```

⚠️ Both balances are BigInt → **strings** in JSON. Always `Number(x)` before arithmetic.

### 14.2 Get Wallet Transactions — `GET /wallets/me/transactions` · JWT  *(UPDATED)*

Query params (all optional): `?type=TOP_UP&limit=50&offset=0`

```json
[{
  "id": "uuid", "amount": "500000",
  "transactionType": "TOP_UP",
  "createdAt": "2026-..."
}]
```

Transaction types: `TOP_UP`, `SUBSCRIPTION`, `ESCROW_LOCK`, `ESCROW_RELEASE`, `PLATFORM_FEE`, `ESCROW_REFUND`, `ESCROW_SPLIT`, `WITHDRAWAL`.

### 14.3 Initiate Bank Link — `POST /wallets/bank-link/initiate` · JWT

Body: `{ ...bank details... }`

### 14.4 Top Up — `POST /wallets/topup` · JWT

Body: `{ "amount": 500000 }` → returns a virtual account number to transfer to.

### 14.5 List Withdrawals — `GET /withdrawals` · JWT · EXPERT

### 14.6 Create Withdrawal — `POST /withdrawals` · JWT · EXPERT

Body: `{ "amount": 200000, "bankAccountXid": "...", "type": "EXPERT_MANUAL" }`

### 14.7 Cancel Withdrawal — `DELETE /withdrawals/:id` · JWT · EXPERT  *(NEW)*

Only on `PENDING` status. Refunds wallet and writes `WITHDRAWAL_REFUND` transaction.

**Response:** `{ "cancelled": true, "refundedAmount": 200000 }`

---

## 15. Messages & Conversations

### 15.1 List Conversations — `GET /conversations` · JWT  *(NEW)*

Returns all chat threads for the current user (engagement-based + project-based pre-bid Q&A).

```json
[{
  "type": "engagement",
  "id": "engagement-uuid",
  "projectName": "AdTech Compliance Classifier",
  "otherParty": { "id": "uuid", "fullName": "..." },
  "lastMessage": { "content": "...", "createdAt": "...", "senderId": "..." },
  "unreadCount": 3
}]
```

### 15.2 List Messages — `GET /messages?engagementId=...` or `GET /messages?projectId=...` · JWT

### 15.3 Send Message — `POST /messages` · JWT

Body: `{ "engagementId": "..." | "projectId": "...", "content": "..." }`

### 15.4 Project Unread Count — `GET /projects/:id/messages/unread-count` · JWT  *(NEW)*

For pre-bid project Q&A threads.

**Response:** `{ "unread_count": 3 }`

### 15.5 Invite Expert to Project Chat — `POST /messages/invite-expert` · JWT · CLIENT

### 15.6 WebSocket Connection

Connect to `http://localhost:3001` (or your backend URL) with `socket.io-client`:

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: { token: accessToken }
});
```

See §22 for the complete event catalog.

---

## 16. Reviews

### 16.1 Create Review — `POST /reviews` · JWT · CLIENT, EXPERT

Only after engagement `CLOSED`. One review per party per engagement.

**Request:**
```json
{
  "engagementId": "uuid",
  "targetId": "uuid",
  "rating": 5,
  "comment": "Excellent work",
  "structuredSignalsJson": { ... },
  "reviewerRole": "CEO"
}
```

### 16.2 Get Reviews I Wrote — `GET /reviews/me` · JWT  *(NEW)*

### 16.3 Get Reviews I Received — `GET /reviews/me/received` · JWT  *(NEW)*

### 16.4 Get Reviews for a User — `GET /reviews/users/:userId` · JWT  *(NEW)*

For public expert profile pages.

```json
[{
  "id": "uuid", "rating": 5, "comment": "...",
  "reviewer": { "id": "uuid", "fullName": "..." },
  "createdAt": "2026-..."
}]
```

---

## 17. Invitations (CEO → Expert)

### 17.1 Send Invitation — `POST /invitations` · JWT · CLIENT

Body: `{ "projectId": "uuid", "expertId": "uuid", "message": "optional personal note" }`

### 17.2 List Received Invitations — `GET /invitations` · JWT · EXPERT

**Response (with company name from de-hardcoding patch):**
```json
[{
  "id": "invitation-uuid",
  "status": "PENDING",
  "invitedAt": "2026-07-09T...",
  "isExpired": false,
  "project": { "id": "...", "projectName": "AdTech Pipeline" },
  "ceo": {
    "id": "ceo-uuid",
    "fullName": "Albert Tran",
    "clientProfile": {
      "companyName": "AITasker Corp"
    }
  }
}]
```

**FE access pattern:**
```typescript
const companyName = invitation.ceo.clientProfile?.companyName ?? invitation.ceo.fullName;
```

The optional chain is needed because a CEO who registered but never updated their company profile will have `clientProfile: null`. Fallback to `fullName` is the intended UX.

### 17.3 List Sent Invitations — `GET /invitations/sent` · JWT · CLIENT  *(NEW)*

```json
[{
  "id": "uuid", "status": "PENDING",
  "project": { "id": "...", "projectName": "..." },
  "expert": { "id": "...", "fullName": "...", "email": "..." },
  "invitedAt": "2026-..."
}]
```

### 17.4 List Project Invitations — `GET /projects/:id/invitations` · JWT · CLIENT

See §7.4.

### 17.5 Retract Invitation — `DELETE /invitations/:id` · JWT · CLIENT  *(NEW)*

Only on `PENDING` status. Sets to `DECLINED`.

### 17.6 Accept / Decline Invitation — `POST /invitations/:id/respond` · JWT · EXPERT

Body: `{ "action": "ACCEPT" | "DECLINE" }`

On `ACCEPT` → creates an engagement in `PENDING` state, expert can then submit a bid.

---

## 18. Notifications

### 18.1 List My Notifications — `GET /notifications/me` · JWT  *(NEW)*

Query: `?limit=50&unreadOnly=false`

```json
[{
  "id": "uuid", "type": "bid_update",  // | "system" | "milestone_update"
  "title": "New Expert Bid!",
  "body": "Jane Expert submitted a bid on your project",
  "link": "/ceo/projects/<id>",
  "isRead": false,
  "createdAt": "2026-..."
}]
```

### 18.2 Unread Count — `GET /notifications/me/unread-count` · JWT  *(NEW)*

```json
{ "unread_count": 3 }
```

**FE Notes:** Use for nav bar badge. Poll on app mount + on each WebSocket `notification:generic` event.

### 18.3 Mark Read — `PUT /notifications/:id/read` · JWT  *(NEW)*

### 18.4 Mark All Read — `PUT /notifications/read-all` · JWT  *(NEW)*

**Response:** `{ "marked_read": 12 }`

### 18.5 Delete Notification — `DELETE /notifications/:id` · JWT  *(NEW)*

### 18.6 Persistence Behavior

**Critical:** Notifications are persisted to DB **in addition** to being emitted via WebSocket. The WebSocket `@OnEvent('socket.broadcast')` handler in `MessagesGateway`:
1. Always emits the real-time WebSocket event
2. If `event === 'notification:generic'` and payload has `title`, also creates a `Notification` DB row

This means:
- Page refresh → notifications survive (REST `/notifications/me`)
- Real-time → WebSocket still delivers instantly
- WebSocket delivery failure → DB persistence still succeeds (and vice versa)

---

## 19. Admin Dashboard

All: JWT · Role: ADMIN

### 19.1 Config CMS — Domains, Seams, Archetypes, Probe Questions (C-2)

Routes follow the same pattern for each entity:

| Method | Path |
|--------|------|
| `GET` | `/admin/config/domains` |
| `POST` | `/admin/config/domains` |
| `PUT` | `/admin/config/domains/:id` |
| `DELETE` | `/admin/config/domains/:id` |

Same pattern for: `/admin/config/seams`, `/admin/config/archetypes`, `/admin/config/probe-questions`.

**Create/Update body:**
```json
{ "code": "G", "name": "Agentic Systems", "description": "...", "sortOrder": 7, "isActive": true }
```

**Probe question create:**
```json
{ "archetypeCode": "3", "questionText": "How many items per day?", "displayOrder": 1 }
```

All deletes are **soft** (`isActive: false`). Public config endpoints filter to `isActive: true`.

### 19.2 Void Code CRUD (Dynamic AI)  *(NEW)*

Same pattern: `/admin/config/void-codes`

**Create:**
```json
{
  "code": "GDPR_COMPLIANCE_RISK",
  "name": "GDPR Compliance Risk",
  "description": "EU personal data involved. DPA registration and breach notification apply.",
  "severity": "HIGH",
  "sortOrder": 9
}
```

**Why this matters:** Adding a new void code here means Stage 1 AI **immediately** starts detecting it and Stage 2 displays it to CEO — no FE or AI service redeployment needed. The FastAPI `prompt_service` fetches void codes from DB (via NestJS `/internal/...`) with a 60-second TTL cache.

### 19.3 Subscription Package Management (F-1)

Routes:
- `GET /admin/subscriptions/packages` → ALL (active + inactive)
- `POST /admin/subscriptions/packages` → Create
- `PUT /admin/subscriptions/packages/:id` → Update (price change takes effect immediately for new subs)
- `DELETE /admin/subscriptions/packages/:id` → Hard delete (blocked if purchase history exists)

**Create:**
```json
{ "role": "CLIENT", "name": "Client Pro Monthly", "priceVnd": 100000, "durationMonths": 1 }
```

**Delete error 422:** `"Cannot delete 'X' — it has N purchase record(s). Deactivate instead."`

**FE Notes:** Admin list includes inactive packages. Public `GET /config/subscription-packages` shows only active.

### 19.4 Prompt Template Management (Dynamic AI Issue 1)  *(NEW)*

Routes:
- `GET /admin/prompts` → list metadata (no full text)
- `GET /admin/prompts/:stage` → full template text
- `PUT /admin/prompts/:stage` → create or update
- `DELETE /admin/prompts/:stage` → reset to default `.txt` file

**Valid stages:** `stage1_extract`, `stage3_vagueness_check`, `stage4_recommend`, `stage5_synthesize`, `milestone_chat`, `criterion_check`, `dispute_eval`, `portfolio_eval`, `service_generate`

**GET list:**
```json
[{ "id": "uuid", "stage": "stage1_extract", "description": "...", "version": 3, "updatedAt": "2026-..." }]
```

**GET single:**
```json
{ "id": "uuid", "stage": "stage5_synthesize", "templateText": "...Jinja2 template...", "version": 3, "updatedAt": "..." }
```

**PUT request:**
```json
{ "templateText": "...", "description": "Updated to add GDPR detection" }
```

**PUT response:**
```json
{ "id": "uuid", "stage": "stage5_synthesize", "version": 4, "updatedAt": "..." }
```

**FE Admin Notes:**
- Jinja2 `{{ variable }}` syntax. Available variables per stage:
  - `stage1_extract`: `{{ archetypes }}`, `{{ void_codes }}`
  - `stage5_synthesize`: `{{ domains }}`, `{{ seams }}`, `{{ archetypes }}`
  - `criterion_check`: `{{ archetype_name }}`
  - `portfolio_eval`: `{{ evaluated_seam_code }}`, `{{ evaluated_seam_name }}`, `{{ evaluated_seam_desc }}`, `{{ seam_definitions }}`
  - `service_generate`: `{{ claimed_domains }}`, `{{ claimed_seams }}`, `{{ price_guidance }}`
- Changes take effect within **60 seconds** (FastAPI cache TTL) — no restart needed.
- `DELETE` resets to `.txt` file fallback, version counter resets.
- Warn admin: malformed Jinja2 causes FastAPI to use raw template text (not a crash).

### 19.5 User Management  *(NEW)*

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/admin/users` | List with filters: `?role=CLIENT&isActive=true&search=albert` |
| `GET` | `/admin/users/:id` | Full detail with wallet + profiles |
| `PUT` | `/admin/users/:id/reactivate` | Reactivate suspended account |

**List response:**
```json
[{
  "id": "uuid", "email": "...", "fullName": "...", "roles": ["CLIENT", "EXPERT"],
  "activeRole": "CLIENT", "isActive": true, "createdAt": "...",
  "subscriptionClientTier": "pro", "subscriptionExpertTier": "free"
}]
```

**Detail response:** Includes wallet balances (as numbers, not strings — admin-only convenience).

### 19.6 Project Oversight  *(NEW)*

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/admin/projects` | List with filters: `?state=PUBLISHED&archetype=3` |
| `GET` | `/admin/projects/:id` | Full detail with client, tech team, invitation count |
| `PUT` | `/admin/projects/:id/reopen` | Reopen a SUSPENDED project |

### 19.7 Engagement Oversight  *(NEW)*

`GET /admin/engagements?state=PENDING&projectId=...`

```json
[{
  "id": "uuid", "state": "PENDING",
  "project": { "id": "...", "projectName": "..." },
  "expert": { "id": "...", "fullName": "...", "email": "..." },
  "client": { "id": "...", "fullName": "...", "email": "..." },
  "_count": { "milestones": 3 }
}]
```

### 19.8 Expert Oversight  *(NEW)*

`GET /admin/experts?limit=50`

Returns all experts with seam claims and domain depths for verification audit.

### 19.9 Dispute Resolution

`POST /admin/disputes/:id/resolve` — see §13.6.

---

## 20. AI Service Endpoints (Internal Reference)

> **These are NOT called by FE.** FE calls NestJS, NestJS calls FastAPI. This section documents the contract so FE devs understand what data shapes the AI returns (which NestJS passes through or stores).

Base URL: `http://localhost:8000` · Header: `X-Internal-Token: <shared-secret>`

### 20.1 Stage 1 Extract — `POST /llm/elicitation/stage1-extract`

**NestJS sends:**
```json
{
  "symptom_text": "...",
  "archetypes": [{ "code": "1", "name": "RAG/Search", "description": "..." }],
  "void_codes": [{ "code": "NO_GROUND_TRUTH", "description": "..." }]
}
```

**AI returns:**
```json
{
  "symptoms": ["...", "..."],
  "scale_signals": { "user_count": null, "data_volume": null, ... },
  "voids": [{ "void_code": "NO_GROUND_TRUTH", "severity": "HIGH" }],
  "recommended_archetypes": ["3", "1"],
  "critical_artifacts_required": [
    { "artifact_key": "compliance_ruleset", "label": "Compliance Ruleset", "reason": "...", "placeholder_prompt": "..." }
  ]
}
```

### 20.2 Stage 3 Vagueness Check — `POST /llm/elicitation/stage3-vagueness-check`

**NestJS sends:**
```json
{
  "archetype": "3",
  "probe_questions": ["How many items per day?", "..."],
  "probe_responses": { "How many items per day?": "Around 50,000" },
  "is_self_technical": false,
  "stage1_symptoms": ["..."],
  "stage1_voids": [{ "void_code": "...", "severity": "..." }]
}
```

**AI returns:**
```json
{
  "vague_answers": [{ "question": "...", "reason": "..." }],
  "irrelevant_answers": [{ "question": "...", "issue": "..." }]
}
```

Fails open — on any LLM error, returns empty arrays (does NOT block Stage 3 progression).

### 20.3 Stage 4 Recommend — `POST /llm/elicitation/stage4-recommend`

**AI returns:**
```json
{
  "recommended_stack": "Python, FastAPI, PostgreSQL, Redis",
  "recommended_integration": "REST API with existing systems",
  "recommended_legacy_volume": "Standard operational database volume"
}
```

### 20.4 Stage 5 Synthesize — `POST /llm/elicitation/stage5-synthesize`

**NestJS sends:** All 4 stages of session data + void list + critical artifacts + domains + seams + archetypes from DB.

**AI returns:**
```json
{
  "required_seams_json": [{ "seam_code": "A↔C", "criticality": "load_bearing" }],
  "required_domains_json": [{ "domain_code": "A", "required_depth": "OPERATIONAL" }],
  "milestone_framework_json": [
    {
      "milestone_number": 1,
      "deliverable_statement": "...",
      "sign_off_authority": "JOINT",
      "payment_amount_vnd": 0,
      "estimated_cost_vnd": 40000000,
      "estimated_duration_days": 14
    }
  ],
  "artifact_a_json": {
    "project_name": "...", "business_intent": "...",
    "archetype": "3", "stack_tags": [...],
    "volume_tier": "TIER_2", "sdlc_notices": [...]
  },
  "artifact_b_json": {
    "stack_tags": [...], "integration_method": "...",
    "legacy_volume": "...", "schemas": [], "contracts": []
  },
  "completeness_score": 0.82,
  "estimated_total_cost_vnd": 120000000,
  "estimated_total_duration_days": 42
}
```

**Code-enforced rules (not LLM):**
- `payment_amount_vnd` is ALWAYS `0` on every milestone — CEO sets real amounts later
- `completeness_score` clamped to `[0.0, 1.0]`
- All enum values validated; invalid values filtered or defaulted

### 20.5 Milestone Chat — `POST /llm/elicitation/milestone-chat`

**AI returns:**
```json
{
  "reply": "...",
  "suggested_edit": { "milestone_number": 2, "field": "paymentAmountVnd", "suggested_value": 30000000, "reason": "..." }
}
```

### 20.6 Criterion Check — `POST /llm/criterion-check`

**AI returns:**
```json
{
  "is_subjective": true,
  "suggestions": ["Rewrite 1...", "Rewrite 2..."],
  "severity": "HIGH",  // LOW | MEDIUM | HIGH
  "context_note": "Why this is risky in this project context"
}
```

Advisory only — the criterion is saved regardless. NestJS writes `advisory_note` to `platform_decisions` if `is_subjective: true`.

### 20.7 Portfolio Eval — `POST /llm/portfolio-eval`

**AI returns:**
```json
{
  "confidence_score": 0.92,
  "passed_boolean": true,  // = (confidence_score >= 0.85), computed in code
  "gap_advisory": null  // null when passed, non-null string when failed
}
```

### 20.8 Dispute Eval — `POST /llm/dispute-eval`

**AI returns:**
```json
{
  "confidence_score": 0.88,
  "finding": "expert_wins",  // | "client_wins"
  "reasoning": "1-2 sentence explanation shown to admin in manual review queue"
}
```

NestJS applies the threshold: `>= 0.80` → `AUTO_RESOLVED`, `< 0.80` → `MANUAL_REVIEW`.

### 20.9 Service Generate — `POST /llm/service-generate`

**AI returns:**
```json
{
  "title": "...",
  "description": "...",
  "scope": "...",
  "timeline": "...",
  "suggested_price_vnd": 45000000,  // clamped to [0, 2_000_000_000]
  "suggested_domains": ["A", "D"],
  "suggested_seams": ["A↔C", "A↔D"],
  "pricing_rationale": "..."
}
```

### 20.10 Matching — `POST /llm/matching`

**AI returns** (sorted by `composite_score` descending):
```json
[
  {
    "expert_id": "uuid",
    "composite_score": 0.9173,
    "strength_label": "STRONG_MATCH",  // | GOOD_MATCH | POSSIBLE_MATCH | WEAK_MATCH
    "gap_map": [
      { "seam_code": "A↔D", "color": "green" },  // EVIDENCE_BACKED
      { "seam_code": "D↔E", "color": "amber" },  // CLAIMED
      { "seam_code": "C↔E", "color": "red" }     // missing
    ]
  }
]
```

Pure arithmetic — **no LLM call**. Composite = `0.40 × seam + 0.25 × domain + 0.20 × portfolio + 0.10 × archetype + 0.05 × engagement`.

### 20.11 Artifact B Guard — `GET /projects/:project_id/artifact-b`

**Query params (all required):**
```
?engagement_state=CONNECTED
&bid_state=TECH_APPROVED
&expert_nda_accepted=true
&ceo_nda_accepted=true
```

**Returns 200:** `{ "project_id": "...", "artifact_b_accessible": true }`
**Returns 403:** `{ "detail": "Engagement is 'PENDING' — must be CONNECTED or ACTIVE to access technical specification" }`

NestJS calls this before returning `artifact_b_json` to an expert. If 403, NestJS omits `artifact_b_json` from the response.

---

## 21. DTO / Schema Conventions (Critical)

### 21.1 Seam Code Format

**ALWAYS use the `↔` (U+2194) character.** Examples: `A↔C`, `A↔D`, `B↔E`.

The DB stores this exact form. The old `A<->C` format is rejected. All DTOs now accept any non-empty string for `code` fields — validation against `seam_definitions` / `domain_definitions` tables happens at the service layer.

### 21.2 Domain Codes

Any non-empty string (`"A"`, `"B"`, `"G"` if admin creates one). Validated against `domain_definitions` table.

### 21.3 Enums Kept as Strict (Business Logic Constants)

| Enum | Values | Why kept |
|------|--------|----------|
| `DomainDepth` | `SURFACE`, `OPERATIONAL`, `DEEP` | Hardwired into matching scoring formula |
| `VerifyTier` | `CLAIMED`, `EVIDENCE_BACKED` | Maps to portfolio verification state machine |
| `ServiceType` | `AI_SERVICE`, `TECH_DISCOVERY` | Fixed product types, not admin-configurable |
| `ServiceState` | `DRAFT`, `PUBLISHED`, `SUSPENDED` | Fixed lifecycle states |

### 21.4 BigInt Serialization

Every `BigInt` column in Prisma is serialized as a **string** in JSON responses. Fields to watch for:
- `priceVnd` (services, milestones, bids)
- `availableBalance`, `lockedBalance` (wallets)
- `amount` (wallet transactions, escrow accounts, withdrawal requests)
- `estimatedTotalCostVnd` (projects)
- `estimatedCostVnd`, `paymentAmountVnd` (milestones)
- `negotiatedPriceVnd` (capability bids)
- `amountPaidVnd` (subscription purchase logs)

**FE pattern:** Always `Number(x)` before arithmetic, `String(x)` before sending.

### 21.5 Error Envelope

```typescript
interface ErrorResponse {
  statusCode: number;    // 400, 401, 403, 404, 409, 422, 500, 503
  message: string | string[];  // array for DTO validation, string for service errors
  error: string;         // HTTP reason phrase
}
```

**FE pattern:**
```typescript
if (Array.isArray(error.message)) {
  // Render as checklist (password rules, multi-field validation)
  setErrorList(error.message);
} else {
  // Single toast
  showToast(error.message);
}
```

---

## 22. WebSocket Event Catalog

### 22.1 Connection

```typescript
const socket = io('http://localhost:3001', {
  auth: { token: accessToken }
});

socket.on('connect', () => { /* user joined their personal room */ });
socket.on('disconnect', () => { /* show reconnecting indicator */ });
```

### 22.2 Events Emitted by Server → Client

| Event | Payload | Trigger |
|-------|---------|---------|
| `notification:generic` | `{ type, title, body?, link? }` | Bid submitted, milestone update, system message |
| `message:received` | `{ id, engagementId, senderId, content, timestamp }` | New chat message |
| `bid:update` | `{ engagementId, bidId, state }` | Bid state changed (tech review, CEO decision) |
| `milestone:update` | `{ engagementId, milestoneId, state }` | Milestone state transition |
| `dispute:update` | `{ disputeId, state, finding? }` | Dispute filed or resolved |

### 22.3 `notification:generic` Payloads

**CEO on new bid (A-3):**
```json
{ "type": "bid_update", "title": "New Expert Bid!", "link": "/ceo/projects/<id>" }
```

**Tech Team on new bid (A-3 — NEW):**
```json
{
  "type": "bid_update",
  "title": "New Bid Awaiting Review",
  "body": "Technical review required.",
  "link": "/tech-team/projects/<id>"
}
```

**Both are handled by the same FE listener** — navigate to `notification.link`.

### 22.4 FE Listener Pattern

```typescript
socket.on('notification:generic', (payload) => {
  // 1. Show toast with payload.title
  showToast(payload.title, payload.body);
  // 2. Increment unread count badge
  refetchUnreadCount();
  // 3. Navigate to payload.link on click
});
```

---

## 23. Breaking Changes Cheatsheet

| # | Endpoint | Old Behavior | Required FE Change |
|---|----------|-------------|---------------------|
| 1 | `POST /subscriptions/activate` | Body: `{ activeRole }` | **Add `packageId`** from `GET /config/subscription-packages` |
| 2 | `GET /subscriptions/status` | FE computed `isExpired` from date | **Remove date math** — trust `subscriptionTier` directly |
| 3 | `POST /auth/register` | Single error string | `message` is **array** — iterate for checklist |
| 4 | Stage 2 archetype list | Hardcoded `['1'..'6']` | Fetch `GET /config/archetypes` |
| 5 | Stage 3 probe questions | Hardcoded strings | Fetch `GET /config/archetypes/:code/probe-questions` |
| 6 | Stage 3 response | Only `vague_answers` | Now has `irrelevant_answers` — show as different warning type |
| 7 | Stage 4 request | `{ current_stack, data_available, latency_requirement }` | Add `technical_artifacts:{}` and `additional_requirement_1` |
| 8 | Stage 4 response | Updated session object | Shape is now `{ session, missingArtifacts }` |
| 9 | `GET /projects/:id` | No domains/seams/milestones | All three now present — use for BidForm |
| 10 | Subscription price display | Hardcoded 500k/300k VND | Fetch `GET /config/subscription-packages?role=CLIENT/EXPERT` |
| 11 | Tech Team empty state | Always "Waiting for CEO" | Show only when `GET /projects` returns `[]` |
| 12 | Password reset page | Only forgot+reset endpoints | Add `verify-reset-token` check on page load |
| 13 | Void code display (Stage 2) | Hardcoded descriptions in FE | Fetch `GET /config/void-codes`, look up by `void_code` |
| 14 | Stage 1 response | No artifact requirements | Handle `criticalArtifactsJson` → show Stage 4 reminder |
| 15 | Seam code format | `A<->C` (ASCII) | Use `A↔C` (U+2194 arrow) — DB rejects old format |
| 16 | Domain/Seam code validation | Hardcoded enum in DTO | Any non-empty string — validated against DB at service layer |
| 17 | Bid DTO `footprint_alignment_json` | Strict enum codes | `code` is now `string`, `depth`/`tier` still enum |
| 18 | Listing DTO | Strict enum codes for domains/seams | `domainsJson`/`seamsJson` are now `string[]` |
| 19 | Invitation response | `ceo.fullName` only | Now has `ceo.clientProfile.companyName` — use with optional chain |
| 20 | Wallet transactions | No filtering | Now accepts `?type=&limit=&offset=` query params |
| 21 | Notifications | WebSocket only (lost on refresh) | Now persisted — use `GET /notifications/me` REST endpoint |

---

## 24. Complete Endpoint Index

### Auth Module
```
POST   /auth/register
POST   /auth/register/handoff
POST   /auth/claim-handoff
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout                          ← NEW
PUT    /auth/me/password                     ← NEW
POST   /auth/forgot-password
GET    /auth/verify-reset-token/:token       ← NEW
POST   /auth/reset-password
POST   /auth/switch-role
```

### Users Module
```
GET    /users/me
PATCH  /users/me
PUT    /users/me/tax-code
POST   /users/me/role
GET    /users/experts                        ← NEW
DELETE /users/me                             ← NEW
```

### Subscriptions Module
```
GET    /subscriptions/status
POST   /subscriptions/activate
GET    /subscriptions/history                ← NEW
```

### Public Config Module (no auth)
```
GET    /config/domains
GET    /config/seams
GET    /config/archetypes
GET    /config/archetypes/:code/probe-questions
GET    /config/void-codes                    ← NEW
GET    /config/subscription-packages
GET    /config/all                           ← NEW
```

### Elicitation Module
```
POST   /elicitation/sessions/start
GET    /elicitation/sessions/:id
POST   /elicitation/sessions/:id/stage1
POST   /elicitation/sessions/:id/stage2
POST   /elicitation/sessions/:id/stage3
PATCH  /elicitation/sessions/:id/stage4-draft              ← NEW
POST   /elicitation/sessions/:id/stage4
POST   /elicitation/sessions/:id/stage4-handoff
POST   /elicitation/sessions/:id/stage5
POST   /elicitation/sessions/:id/revert
POST   /elicitation/sessions/:id/set-self-technical
POST   /elicitation/sessions/:id/invite-tech-team
```

### Projects Module
```
GET    /projects
GET    /projects/:id
GET    /projects/:id/engagements             ← NEW
GET    /projects/:id/invitations             ← NEW
GET    /projects/:id/team                    ← NEW
GET    /projects/:id/milestones              ← NEW
PUT    /projects/:id/cancel                  ← NEW
POST   /projects/:id/milestone-chat          ← NEW
GET    /projects/:id/milestone-chat/sessions ← NEW
GET    /projects/:id/milestone-chat/sessions/:sessionId  ← NEW
GET    /projects/:id/messages/unread-count   ← NEW
```

### Milestones Module
```
GET    /milestones?engagementId=...          ← NEW
PATCH  /milestones/:id                       ← NEW
DELETE /milestones/:id                       ← NEW
GET    /milestones/:id/submissions           ← NEW
GET    /milestones/:id/submissions/latest    ← NEW
GET    /milestones/:id/disputes              ← NEW
GET    /milestones/:id/dod                   ← NEW
DELETE /milestones/:id/dod/:itemId           ← NEW
POST   /milestones/:id/dod
PATCH  /milestones/:id/dod/:itemId
GET    /milestones/:id/criteria              ← NEW (alias for /criteria/:milestoneId)
```

### Criteria Sub-Module
```
GET    /criteria/:milestoneId                ← NEW
POST   /criteria/:milestoneId                ← NEW
DELETE /criteria/:id                         ← NEW
POST   /criteria/:id/verify
```

### Expert Profiles Module
```
GET    /expert-profile/me
PATCH  /expert-profile/me
GET    /expert-profile/me/domains            ← NEW
POST   /expert-profile/domains
PUT    /expert-profile/domains/:id
DELETE /expert-profile/domains/:id           ← NEW
POST   /expert-profile/domains/sync
GET    /expert-profile/me/seams              ← NEW
POST   /expert-profile/seams
POST   /expert-profile/seams/sync
GET    /expert-profile/search                ← NEW
GET    /expert-profile/:userId               ← NEW
```

### Portfolio Sub-Module
```
GET    /expert-profile/me/portfolio
POST   /expert-profile/me/portfolio
GET    /expert-profile/me/portfolio/:id      ← NEW
DELETE /expert-profile/me/portfolio/:id      ← NEW
```

### Listings Module
```
GET    /services
GET    /services/:id
POST   /services
PUT    /services/:id
DELETE /services/:id                         ← NEW
PUT    /services/:id/publish                 ← NEW
PUT    /services/:id/unpublish               ← NEW
GET    /services/me                          ← NEW
GET    /services/me/purchases                ← NEW
POST   /services/:id/purchase
```

### Engagements Module
```
GET    /engagements
GET    /engagements/:id
GET    /engagements/:id/bid                  ← NEW
GET    /engagements/:id/disputes             ← NEW
GET    /engagements/:id/milestones           ← NEW
GET    /engagements/:id/submissions          ← NEW
PUT    /engagements/:id/cancel               ← NEW
POST   /engagements/:id/nda-acceptance
```

### Bids Module
```
GET    /bids                                 ← NEW (role-scoped)
GET    /bids/:id
POST   /bids
PUT    /bids/:id
DELETE /bids/:id                             ← NEW (withdraw)
POST   /bids/:id/tech-review
POST   /bids/:id/ceo-decision
POST   /bids/:id/counter-offer
POST   /bids/:id/shortlist
```

### Disputes Module
```
GET    /disputes
GET    /disputes/:id
POST   /disputes
POST   /disputes/:id/evidence                ← NEW
PUT    /disputes/:id/withdraw                ← NEW
POST   /disputes/:id/resolve                 (admin)
```

### Wallet Module
```
GET    /wallets/me
GET    /wallets/me/transactions              ← UPDATED (query params)
POST   /wallets/topup
POST   /wallets/bank-link/initiate
GET    /withdrawals
POST   /withdrawals
DELETE /withdrawals/:id                      ← NEW
```

### Messages Module
```
GET    /conversations                        ← NEW
GET    /messages?engagementId=...|projectId=...
POST   /messages
POST   /messages/invite-expert
```

### Reviews Module
```
GET    /reviews/me                           ← NEW
GET    /reviews/me/received                  ← NEW
GET    /reviews/users/:userId                ← NEW
POST   /reviews
```

### Invitations Module
```
GET    /invitations                          (expert: received)
GET    /invitations/sent                     ← NEW (client: sent)
POST   /invitations
DELETE /invitations/:id                      ← NEW (retract)
POST   /invitations/:id/respond
```

### Notifications Module (ALL NEW)
```
GET    /notifications/me
GET    /notifications/me/unread-count
PUT    /notifications/:id/read
PUT    /notifications/read-all
DELETE /notifications/:id
```

### Admin Module
```
# Config CMS
GET/POST/PUT/DELETE  /admin/config/domains
GET/POST/PUT/DELETE  /admin/config/seams
GET/POST/PUT/DELETE  /admin/config/archetypes
GET/POST/PUT/DELETE  /admin/config/probe-questions
GET/POST/PUT/DELETE  /admin/config/void-codes          ← NEW (Dynamic AI)

# Prompt Templates (NEW — Dynamic AI)
GET    /admin/prompts
GET    /admin/prompts/:stage
PUT    /admin/prompts/:stage
DELETE /admin/prompts/:stage

# Subscriptions
GET/POST/PUT/DELETE  /admin/subscriptions/packages

# Users
GET    /admin/users                          ← NEW
GET    /admin/users/:id                      ← NEW
PUT    /admin/users/:id/reactivate           ← NEW

# Projects
GET    /admin/projects                       ← NEW
GET    /admin/projects/:id                   ← NEW
PUT    /admin/projects/:id/reopen            ← NEW

# Engagements
GET    /admin/engagements                    ← NEW

# Experts
GET    /admin/experts                        ← NEW

# Disputes
POST   /admin/disputes/:id/resolve
```

---

## 25. DB Schema Quick Reference

### 25.1 Core Tables

| Table | Purpose | Key Relations |
|-------|---------|---------------|
| `users` | All accounts | has `roles[]`, `activeRole`, `clientSubtype` |
| `client_profiles` | CEO company info | 1:1 with user |
| `expert_profiles` | Expert bio + stack | 1:1 with user |
| `tech_team_profiles` | Tech team linked to CEO + project | N:1 with user (CEO), N:1 with project |
| `wallets` | User balances | 1:1 with user |
| `wallet_transactions` | Ledger entries | N:1 with wallet |
| `virtual_accounts` | SePay VA for topup/milestone | polymorphic `entity_type` + `entity_id` |
| `withdrawal_requests` | Expert cash-out | N:1 with user, N:1 with milestone |
| `platform_settings` | Fee % singleton | 1:1 with platform wallet |
| `subscription_packages` | Pro tier packages | has `role`, `priceVnd`, `durationMonths` |
| `subscription_purchase_logs` | Purchase history | N:1 with user, N:1 with package |

### 25.2 Elicitation Tables

| Table | Purpose |
|-------|---------|
| `elicitation_sessions` | 5-stage flow state. Has `stage1SymptomsJson`, `stage3ProbesJson`, `stage4TechInputsJson`, `criticalArtifactsJson`, `voidListJson`, `recommendedArchetypesJson`, `estimatedBudgetVnd`, `stage4DraftJson` |
| `projects` | Published project spec. Has `requiredSeamsJson`, `requiredDomainsJson`, `milestoneFrameworkJson`, `artifactAJson`, `artifactBJson`, `estimatedTotalCostVnd`, `estimatedTotalDurationDays` |
| `project_shortlist_cache` | Cached matching results per project |

### 25.3 Expert Capability Tables

| Table | Purpose |
|-------|---------|
| `expert_domain_depths` | Expert's depth per domain code. `UNIQUE(expertId, domainCode)` |
| `expert_seam_claims` | Expert's claim per seam code. Has `verificationTier`, `submissionCount`, `lockedUntil` |
| `portfolio_submissions` | Evidence submitted for a seam claim. Has `llmConfidence`, `status` |

### 25.4 Engagement Tables

| Table | Purpose |
|-------|---------|
| `engagements` | Client-expert pairing. Has `state`, NDA timestamps |
| `capability_bids` | Expert's bid on a project. Has `techStatus`, `ceoStatus`, `negotiatedPriceVnd` |
| `milestones` | Milestone in engagement. Has `state` (DEFINED → AWAITING_PAYMENT → FUNDED → IN_PROGRESS → SUBMITTED → IN_REVISION → APPROVED → RELEASED → DISPUTED) |
| `acceptance_criteria` | Measurable criteria per milestone |
| `milestone_dod_items` | Definition-of-Done checklist items |
| `milestone_submissions` | Expert's delivery for a milestone |
| `paygated_documents` | Documents released only on milestone approval |

### 25.5 Finance Tables

| Table | Purpose |
|-------|---------|
| `escrow_accounts` | Held funds. `UNIQUE` on `milestoneId` or `engagementId` |
| `disputes` | Dispute with `llmConfidence`, `state` (PENDING → LAYER_1_EVAL → AUTO_RESOLVED|MANUAL_REVIEW → RESOLVED) |

### 25.6 Communication Tables

| Table | Purpose |
|-------|---------|
| `messages` | Chat messages. Has `engagementId` OR `projectId` (for pre-bid Q&A) |
| `message_reads` | Read receipts. `UNIQUE(messageId, userId)` |
| `reviews` | Post-engagement reviews. `UNIQUE(engagementId, reviewerId)` |
| `invitations` | CEO → Expert invitations. `UNIQUE(projectId, expertId)` — re-invite resets via upsert |
| `notifications` | Persisted notifications. Indexed on `(userId, isRead)` and `(userId, createdAt DESC)` |
| `milestone_chat_sessions` | Multi-turn AI chat about milestone framework |

### 25.7 CMS Tables (Admin-Configurable)

| Table | Purpose |
|-------|---------|
| `domain_definitions` | Domain codes + names (e.g. `A` = LLM App Engineering) |
| `seam_definitions` | Seam codes + names (e.g. `A↔C` = LLM output quality) |
| `archetype_definitions` | Project archetypes (1-6: RAG, Recommendation, Classification, Generation, Prediction, Multimodal) |
| `probe_questions` | Stage 3 behavioral questions per archetype |
| `void_code_definitions` | Risk taxonomy (NO_GROUND_TRUTH, MISSING_TECHNICAL_ARTIFACT, etc.) |
| `prompt_templates` | Jinja2 templates for AI service — DB-backed hot-reload with 60s TTL |
| `platform_decisions` | Audit log of all AI decisions (confidence, advisory notes) |

### 25.8 Field Naming Convention

- DB columns: `snake_case` (e.g. `created_at`, `client_nda_accepted_at`)
- Prisma model fields: `camelCase` (e.g. `createdAt`, `clientNdaAcceptedAt`)
- JSON response fields: `camelCase` (NestJS serializes Prisma fields directly)
- JSON payload fields in DTOs: `snake_case` for legacy endpoints (elicitation stages, portfolio, disputes), `camelCase` for newer endpoints (subscriptions, listings, bids)

**When in doubt about a field name, check the specific endpoint's response example in this doc.**

---

## End of Document

This guide covers **every** backend change in `current-backend-code-newest`. If the FE dev encounters an endpoint not documented here, it does not exist in the current branch — do not call it (that would be rot code). If an endpoint exists but returns a different shape than documented, the doc is wrong — ping the BE dev.

**Last updated:** Consolidates all patches from Groups A–F + Dynamic AI Service + DTO de-hardcoding + CRUD gap patches.