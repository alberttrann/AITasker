# Expert Invitations — BE↔FE Integration Reference
> Covers: new `GET /invitations`, `POST /invitations/:id/decline`,
> WebSocket notification link change, `GET /engagements` updated response,
> and the end-to-end invite → bid flow.

---

## New Feature: Expert "Invited Projects" Page

**Route suggestion:** `/expert/invitations`

**What it replaces:** Previously experts only found out about invitations via real-time notifications (which disappear on refresh). Now every invitation is persisted in the DB and visible in a table at any time.

---

## 1. Fetch Expert's Invitations

**`GET /invitations`** · JWT required · Role: `EXPERT` only

Call on mount of the `/expert/invitations` page.

### Response `200`
```json
[
  {
    "id":          "invitation-uuid",
    "projectId":   "project-uuid",
    "expertId":    "expert-uuid",
    "ceoId":       "ceo-uuid",
    "message":     "Hi, we think you'd be a great fit for our RAG project.",
    "status":      "PENDING",
    "invitedAt":   "2026-07-09T08:00:00.000Z",
    "respondedAt": null,
    "expiresAt":   "2026-07-16T08:00:00.000Z",
    "isExpired":   false,
    "project": {
      "id":                  "project-uuid",
      "projectName":         "Customer Support RAG System",
      "state":               "PUBLISHED",
      "archetype":           "1",
      "tier":                "TIER_2",
      "createdAt":           "2026-07-01T00:00:00.000Z",
      "requiredDomainsJson": [
        { "domain_code": "A", "required_depth": "INTERMEDIATE" },
        { "domain_code": "D", "required_depth": "EXPERT" }
      ],
      "requiredSeamsJson": [
        { "seam_code": "A↔D", "criticality": "HIGH" }
      ]
    },
    "ceo": {
      "id":       "ceo-uuid",
      "fullName": "Albert Tran"
    }
  },
  {
    "id":          "invitation-uuid-2",
    "status":      "ACCEPTED",
    "invitedAt":   "2026-07-05T...",
    "respondedAt": "2026-07-06T...",
    "isExpired":   false,
    "project":     { "projectName": "Recommendation Engine", ... },
    "ceo":         { "fullName": "..." }
  },
  {
    "id":          "invitation-uuid-3",
    "status":      "PENDING",
    "isExpired":   true,
    "expiresAt":   "2026-07-08T...",
    "project":     { "projectName": "Old Project", ... },
    "ceo":         { "fullName": "..." }
  }
]
```

### Status Values & Suggested FE Rendering

| `status` | `isExpired` | Badge | CTAs |
|----------|-------------|-------|------|
| `PENDING` | `false` | 🟡 **Invited** | "View Project" + "Submit Bid" + "Decline" |
| `PENDING` | `true` | ⚫ **Expired** | None (invitation window closed) |
| `ACCEPTED` | `false` | 🟢 **Bid Sent** | "View My Bid" |
| `DECLINED` | `false` | ⚫ **Declined** | None |

### FE Notes
- Sort: backend returns `orderBy: invitedAt desc` — newest invites first.
- For `isExpired: true` rows, disable action buttons and grey out the row.
- `requiredDomainsJson` and `requiredSeamsJson` are already in the response — no extra call needed to render the project requirements summary.
- CTA "Submit Bid" → navigate to `/expert/projects/:projectId` where they submit via `POST /bids`.

---

## 2. Decline an Invitation

**`POST /invitations/:id/decline`** · JWT required · Role: `EXPERT` only

### Request
```
POST /invitations/invitation-uuid/decline
(no body required)
```

### Response `201`
```json
{
  "id":          "invitation-uuid",
  "status":      "DECLINED",
  "respondedAt": "2026-07-09T09:30:00.000Z"
}
```

### Errors
| Status | `message` | When |
|--------|-----------|------|
| 404 | `"Invitation not found."` | Invalid ID |
| 403 | `"This invitation does not belong to you."` | Wrong expert |
| 422 | `"Cannot decline an invitation in status 'ACCEPTED'."` | Already bid on this project |

### FE Notes
- After success: update the local invitation state to `DECLINED` (optimistic update or re-fetch).
- Show a confirmation dialog before calling this — it cannot be undone.

---

## 3. WebSocket Notification Link Change

**Event:** `notification:generic` (existing event, unchanged listener)

**What changed:** The `link` field in the expert's invitation notification now points to the Invitations page instead of a direct bid URL.

### Old payload (before patch)
```json
{
  "type":  "system",
  "title": "Project Invitation",
  "body":  "A CEO has invited you to submit a bid for their project.",
  "link":  "/expert/bids/<project-id>"
}
```

### New payload (after patch)
```json
{
  "type":  "system",
  "title": "Project Invitation",
  "body":  "A CEO has invited you to submit a bid for their project.",
  "link":  "/expert/invitations"
}
```

### FE Notes
- If you were navigating directly to a bid form on notification click, update to navigate to `/expert/invitations` instead — the expert sees the full context (which project, from which CEO) before deciding to bid.
- The notification listener itself doesn't change — just update the `link` click handler.

---

## 4. Updated `GET /engagements` Response

**`GET /engagements`** · JWT required · Roles: `CLIENT`, `EXPERT`, `ADMIN`

**What changed:** Every engagement now includes a `project` object with key metadata. Previously this field was missing, requiring the FE to make a separate `GET /projects/:id` call for every engagement row.

### Old response item
```json
{
  "id":        "engagement-uuid",
  "projectId": "project-uuid",
  "expertId":  "expert-uuid",
  "clientId":  "client-uuid",
  "state":     "PENDING",
  "type":      "PROJECT_BASED"
}
```

### New response item (all roles)
```json
{
  "id":        "engagement-uuid",
  "projectId": "project-uuid",
  "expertId":  "expert-uuid",
  "clientId":  "client-uuid",
  "state":     "PENDING",
  "type":      "PROJECT_BASED",
  "updatedAt": "2026-07-09T10:00:00.000Z",
  "project": {
    "id":          "project-uuid",
    "projectName": "Customer Support RAG System",
    "state":       "PUBLISHED",
    "archetype":   "1",
    "tier":        "TIER_2",
    "createdAt":   "2026-07-01T..."
  }
}
```

### FE Notes
- Remove any N+1 calls: `engagement.project.projectName` is now directly available.
- Results are sorted `updatedAt desc` — most recently active engagements first.
- `project` is always present (it's a required FK) so no null check needed.

---

## 5. Full "Invite → Bid" Data Flow for FE Reference

```
[CEO Project Page]
  CEO clicks "Invite Expert" button
    → FE emits WebSocket event:
      socket.emit('inviteExpert', {
        projectId: "project-uuid",
        expertId:  "expert-uuid",
        content:   "We'd love to have you on this!"   // optional
      })

[Backend - messages.gateway.ts]
  1. Validates CEO owns the project
  2. Creates/updates Invitation row in DB (PENDING, expires in 7 days)
  3. Emits notification:generic → expert's personal socket room
  4. Creates chat message in project thread

[Expert - Real-time notification popup]
  Event: notification:generic {
    type:  "system",
    title: "Project Invitation",
    body:  "A CEO has invited you to submit a bid for their project.",
    link:  "/expert/invitations"
  }
  Expert clicks notification → navigates to /expert/invitations

[Expert - /expert/invitations page]
  GET /invitations
  → sees table row: "Customer Support RAG System" | "Albert Tran" | PENDING
  → clicks "View Project" → reads artifact_a_json, domains, seams
  → clicks "Submit Bid" → navigates to bid form

[Expert - Bid Form]
  POST /bids { projectId, footprint_alignment_json, approach_summary, ... }
  → Backend atomically:
      1. Creates Engagement (state: PENDING)
      2. Creates CapabilityBid (state: SUBMITTED)
      3. Updates Invitation status → ACCEPTED
      4. Notifies CEO + Tech Team
  → Expert redirected to engagement detail page

[Expert - /expert/invitations page (revisit)]
  GET /invitations
  → same row now shows: ACCEPTED | "View My Bid" CTA
```

---

## 6. New Error Cases to Handle

All new errors follow the standard envelope:
```json
{ "statusCode": 422, "message": "...", "error": "Unprocessable Entity" }
```

| Endpoint | Status | `message` | FE action |
|----------|--------|-----------|-----------|
| `POST /invitations/:id/decline` | 422 | `"Cannot decline an invitation in status 'ACCEPTED'."` | Show toast: "You've already submitted a bid for this project." |
| `POST /invitations/:id/decline` | 422 | `"Cannot decline an invitation in status 'DECLINED'."` | Stale UI — re-fetch invitations |
| `POST /bids` (existing) | 409 | `"An engagement already exists for this expert on this project."` | Expert already bid — redirect to existing engagement |

---

## 7. Page Component Checklist (`/expert/invitations`)

```
On mount:
  ✓ Call GET /invitations
  ✓ Render loading skeleton

For each invitation row:
  ✓ Show project name, CEO name, invitedAt (formatted UTC+7)
  ✓ Show status badge (PENDING / ACCEPTED / DECLINED / isExpired)
  ✓ Show required domain codes (requiredDomainsJson[].domain_code)
  ✓ Show archetype name — look up code against GET /config/archetypes

For PENDING + !isExpired rows:
  ✓ "View Project" button → /expert/projects/:projectId
  ✓ "Submit Bid" button   → /expert/projects/:projectId/bid (or wherever bid form lives)
  ✓ "Decline" button      → POST /invitations/:id/decline
                            → confirmation modal first
                            → on success: update row status locally to DECLINED

For ACCEPTED rows:
  ✓ "View My Bid" button  → /expert/engagements/:engagementId
                            (get engagementId from GET /engagements filtered by projectId)

For DECLINED / isExpired rows:
  ✓ Greyed out row, no action buttons

WebSocket listener (already existing):
  ✓ On notification:generic with type === 'system':
      Show notification popup with title + body
      On click: navigate to notification.link ← now "/expert/invitations"
```
