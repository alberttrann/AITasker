# E2E QA Test Plan

## 1. Test Environments & Preconditions
- **Test Environments:** Docker setups (isolated vs full UI) and observability tools (Prisma Studio, DevTools, DB logs).
- **Universal Checks:** Baseline checks that must pass on *every* screen (e.g., JWT validation, role-guards, UI feedback, double-submission prevention).
- **Cross-actor visibility:** Other involved actors receive the right notification/socket update and see the new state after refresh.
- **Data Seeds:** Ensure you have the correct persona (e.g. CEO-A, EXP-B) seeded in the database before starting the flow.

---

## Group 3 — Invitations, Bidding & Connection

---

# MF-5: Expert Invitations & Bid Submission

## Overview

CEO invites experts directly (new feature) before or after viewing the shortlist. Expert receives persistent notification, views invitation with project requirements, can decline or proceed to bid. Bid submission now uses dynamic domain/seam codes (DB-driven, `↔` arrow format). Expert bid notification now fires to BOTH CEO and ALL TECH_TEAM members (A-3 bug fix). Invitation is auto-accepted when expert submits a bid.

**Tables touched (8):** `invitations`, `notifications`, `project_shortlist_cache`, `expert_domain_depths`, `expert_seam_claims`, `engagements`, `capability_bids`, `messages`

**Key changes from old doc:** (1) `invitations` table is new. (2) `notifications` table persists WebSocket events. (3) Bid domain/seam codes are DB-driven strings — NOT hardcoded enums. (4) `A<->C` seam format rejected by DTO — must use `↔`. (5) `invitation.ceo.clientProfile.companyName` included in invitation response. (6) ALL TECH_TEAM members notified on bid, not just CEO.

**Endpoints:** `GET /matching/:projectId/shortlist`, `GET /expert-profile/search`, `GET /expert-profile/:userId`, `GET /invitations` (Expert), `GET /invitations/sent` (CEO), `POST /invitations/:id/decline`, `DELETE /invitations/:id` (CEO retract), `GET /projects/:id`, `GET /projects/:id/invitations`, `GET /notifications/me`, `GET /notifications/me/unread-count`, `PUT /notifications/:id/read`, `POST /bids`, `GET /bids`, `DELETE /bids/:id`

---

## ASCII Swimlane

```
┌──────────────────────────┬──────────────────────────────────────────┬────────────────────────────┐
│      CLIENT / CEO        │       SYSTEM (NestJS)                    │         EXPERT             │
├──────────────────────────┼──────────────────────────────────────────┼────────────────────────────┤
│ ══ PHASE A: CEO INVITES ═════════════════════════════════════════════════════════════════════════│
│ [1] Views shortlist      │                                          │                            │
│   GET /matching/:id/     │                                          │                            │
│   shortlist              │                                          │                            │
│       └────────────────> │                                          │                            │
│                          │ [2] SELECT project_shortlist_cache       │                            │
│                          │   Return [{expert_id, strength_label,    │                            │
│                          │     gap_map:{seamCode:color}, ...}]      │                            │
│ <────────────────────────┤                                          │                            │
│ [3] CEO invites expert   │                                          │                            │
│   WebSocket: inviteExpert│                                          │                            │
│   {projectId,expertId,   │                                          │                            │
│    content:"I think your │                                          │                            │
│    RAG experience fits"} │                                          │                            │
│       └────────────────> │                                          │                            │
│                          │ [4] Validate CEO owns project            │                            │
│                          │   UPSERT invitations {                   │                            │
│                          │     project_id, expert_id, ceo_id,       │                            │
│                          │     message, status:"PENDING",           │                            │
│                          │     expires_at: now()+7days              │                            │
│                          │   } ← upsert: re-invite resets to PENDING│                            │
│                          │                                          │                            │
│                          │   Emit socket notification to expert:    │                            │
│                          │   notification:generic {                 │                            │
│                          │     type:"system",                       │                            │
│                          │     title:"Project Invitation",          │                            │
│                          │     link:"/expert/invitations" }         │                            │
│                          │                                          │                            │
│                          │   INSERT notifications {                 │                            │
│                          │     user_id: expert_id,                  │                            │
│                          │     type:"system",                       │                            │
│                          │     title:"Project Invitation",          │                            │
│                          │     link:"/expert/invitations",          │                            │
│                          │     is_read:false                        │                            │
│                          │   } [NEW — persists for page refresh]    │                            │
│                          │   INSERT messages (project chat)         │                            │
│                          ├──────────────────────────────────────────>                            │
│ [5] CEO views invitations│                                          │ [6] Expert receives        │
│   GET /invitations/sent  │                                          │   real-time notification   │
│   GET /projects/:id/     │                                          │   badge updated:           │
│   invitations            │                                          │   GET /notifications/me/   │
│                          │                                          │   unread-count → N+1       │
│                          │                                          │                            │
│ ══ PHASE B: EXPERT VIEWS INVITATIONS ══════════════════════════════════════════════════════════│
│                          │                                          │ [7] Opens invitations page │
│                          │                                          │   GET /invitations         │
│                          │                  ┌─────────────────────── │                           │
│                          │ [8] SELECT invitations WHERE             │                            │
│                          │   expert_id=userId JOIN project,ceo      │                            │
│                          │   ceo JOIN clientProfile (companyName)   │                            │
│                          │   Return [{                              │                            │
│                          │     id, status:"PENDING",                │                            │
│                          │     invitedAt, isExpired:false,          │                            │
│                          │     project:{id,projectName,state,       │                            │
│                          │       requiredDomainsJson, [NEW]         │                            │
│                          │       requiredSeamsJson}, [NEW]          │                            │
│                          │     ceo:{id,fullName,                    │                            │
│                          │       clientProfile:{companyName}} [NEW] │                            │
│                          │   }]                                     │                            │
│                          ├──────────────────────────────────────────>                            │
│                          │                                          │ [9] Expert sees:           │
│                          │                                          │   "AITasker Corp invites   │
│                          │                                          │   you to AdTech Pipeline"  │
│                          │                                          │   Shows requiredSeams,     │
│                          │                                          │   requiredDomains inline   │
│                          │                                          │   Status badge:            │
│                          │                                          │   PENDING+!expired → CTA   │
│                          │                                          │   PENDING+expired → grey   │
│                          │                                          │   ACCEPTED → "Bid Sent"    │
│                          │                                          │   DECLINED → "Declined"    │
│                          │                                          │                            │
│                          │                                          │ [10] Expert declines:      │
│                          │                                          │   POST /invitations/:id/   │
│                          │                                          │   decline                  │
│                          │                  ┌───────────────────────│                            │
│                          │ [11] Guard: status=PENDING               │                            │
│                          │   UPDATE invitations SET                 │                            │
│                          │     status:"DECLINED",                   │                            │
│                          │     responded_at:now()                   │                            │
│                          ├──────────────────────────────────────────>                            │
│                          │                                          │ [12] OR Expert proceeds    │
│                          │                                          │   to view project detail   │
│                          │                                          │   GET /projects/:id        │
│                          │                                          │   → required_domains_json  │
│                          │                                          │   → required_seams_json    │
│                          │                                          │   → milestone_framework    │
│                          │                                          │   [ALL IN ONE CALL — NEW]  │
│                          │                                          │                            │
├──────────────────────────┼──────────────────────────────────────────┼────────────────────────────┤
│ ══ PHASE C: BID SUBMISSION ════════════════════════════════════════════════════════════════════  │
│                          │                                          │ [13] Expert submits bid    │
│                          │                                          │   POST /bids {             │
│                          │                                          │     projectId:"uuid",      │
│                          │                                          │     footprint_alignment_   │
│                          │                                          │     json:{                 │
│                          │                                          │       domains:[{           │
│                          │                                          │         code:"A",  ← ANY   │
│                          │                                          │         depth:"DEEP"       │
│                          │                                          │       }],                  │
│                          │                                          │       seams:[{             │
│                          │                                          │         code:"A↔C", ← ↔    │
│                          │                                          │         ← NOT "A<->C"!!    │
│                          │                                          │         tier:"CLAIMED"     │
│                          │                                          │       }]                   │
│                          │                                          │     },                     │
│                          │                                          │     approach_summary:"...",│
│                          │                                          │     conditional_pricing_   │
│                          │                                          │     json:[{                │
│                          │                                          │       milestone_number:1,  │
│                          │                                          │       price_vnd:15000000,  │
│                          │                                          │       condition:"Delivery" │
│                          │                                          │     }]                     │
│                          │                                          │   }                        │
│                          │                  ┌───────────────────────│                            │
│                          │ [14] Validate: all 3 components present  │                            │
│                          │   domain/seam codes validated against    │                            │
│                          │   DB in service layer [NEW]              │                            │
│                          │   DB TX (atomic):                        │                            │
│                          │   INSERT engagements {                   │                            │
│                          │     project_id, expert_id,               │                            │
│                          │     type:"PROJECT_BASED",                │                            │
│                          │     state:"PENDING"                      │                            │
│                          │   }                                      │                            │
│                          │   INSERT capability_bids {               │                            │
│                          │     engagement_id,                       │                            │
│                          │     footprint_alignment_json,            │                            │
│                          │     approach_summary,                    │                            │
│                          │     conditional_pricing_json,            │                            │
│                          │     state:"SUBMITTED",                   │                            │
│                          │     tech_status:"PENDING",               │                            │
│                          │     ceo_status:"PENDING",                │                            │
│                          │     version_number:1                     │                            │
│                          │   }                                      │                            │
│                          │   UPSERT invitations SET                 │                            │
│                          │     status:"ACCEPTED",                   │                            │
│                          │     responded_at:now()                   │                            │
│                          │   ← auto-accept invitation [NEW]         │                            │
│                          │   COMMIT                                 │                            │
│                          │                                          │                            │
│                          │ [15] Emit + persist notifications:       │                            │
│                          │   → CEO: notification:generic {          │                            │
│                          │       type:"bid_update",                 │                            │
│                          │       title:"New Expert Bid!",           │                            │
│                          │       link:"/ceo/projects/:id"           │                            │
│                          │     }                                    │                            │
│                          │   → ALL TECH_TEAM members [BUG FIX A-3]: │                            │
│                          │     notification:generic {               │                            │
│                          │       type:"bid_update",                 │                            │
│                          │       title:"New Bid Awaiting Review",   │                            │
│                          │       link:"/tech-team/projects/:id"     │                            │
│                          │     }                                    │                            │
│                          │   INSERT notifications rows for EACH     │                            │
│                          │     recipient (CEO + all TECH_TEAM)      │                            │
│                          ├──────────────────────────────────────────>                            │
│ [16] CEO sees:           │                                          │ [17] Expert views own bids:│
│   GET /bids?projectId=:id│                                          │   GET /bids                │
│   → all bids, role-scoped│                                          │   → own bids, role-scoped  │
│   Badge: PENDING(grey),  │                                          │   GET /bids/:id            │
│   APPROVED(active)       │                                          │   → bid detail             │
│                          │                                          │                            │
│                          │                                          │ [18] Withdraw bid          │
│                          │                                          │  (before TECH_TEAM review):│
│                          │                                          │   DELETE /bids/:id         │
│                          │                  ┌───────────────────────│                            │
│                          │ [19] Guard: state='SUBMITTED' only       │                            │
│                          │   UPDATE capability_bids SET             │                            │
│                          │     state:"WITHDRAWN"                    │                            │
└──────────────────────────┴──────────────────────────────────────────┴────────────────────────────┘
```

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 4 | NestJS | Upsert invitation; emit + persist notification | `invitations` (C/U), `notifications` (C), `messages` (C) | status=PENDING | WebSocket `inviteExpert` |
| 8 | NestJS | Return invitations with project + CEO company name | `invitations` (R), `projects` (R), `users` (R), `client_profiles` (R) | — | `GET /invitations` |
| 11 | NestJS | Decline invitation | `invitations` (U) | status=DECLINED | `POST /invitations/:id/decline` |
| 14 | NestJS | Create engagement + bid; auto-accept invitation | `engagements` (C), `capability_bids` (C), `invitations` (U) | bid=SUBMITTED; invitation=ACCEPTED | `POST /bids` |
| 15 | NestJS | Notify CEO + ALL TECH_TEAM | `notifications` (C × N) | — | EventEmitter `socket.broadcast` |
| 19 | NestJS | Withdraw bid | `capability_bids` (U) | state=WITHDRAWN | `DELETE /bids/:id` |

---

# MF-6: Bid Review, Counter-Offer & NDA Connection

## Overview

TECH_TEAM reviews bid against actual system architecture. CEO reviews approved bid, optionally writes counter-offer, then decides to approve or decline. On approval, connection request sent to expert; both parties sign NDA click-through; engagement becomes CONNECTED and Artifact B unlocked.

**Tables touched (4):** `capability_bids`, `engagements`, `notifications`

**Endpoints:** `GET /bids/:id`, `PUT /bids/:id/tech-review`, `PUT /bids/:id`, `PUT /bids/:id/counter-offer`, `PUT /bids/:id/ceo-decision`, `PUT /engagements/:id/accept-nda`, `POST /engagements/:id/connect`, `PUT /engagements/:id/decline`, `GET /engagements/:id/bid`

---

## ASCII Swimlane

```
┌──────────────┬────────────────────────────────────┬─────────────────────────────┬─────────────────┐
│ CLIENT / CEO │    SYSTEM (NestJS)                 │  CLIENT / TECH_TEAM         │     EXPERT      │
├──────────────┼────────────────────────────────────┼─────────────────────────────┼─────────────────┤
│ ══ TECH REVIEW ══════════════════════════════════════════════════════════════════════════════─════│
│              │                                    │ [1] Notification received   │                 │
│              │                                    │   GET /notifications/me     │                 │
│              │                                    │   → "New Bid Awaiting Review│                 │
│              │                                    │   GET /bids?projectId=:id   │                 │
│              │                                    │   GET /bids/:id             │                 │
│              │                                    │   → footprint_alignment_json│                 │
│              │                                    │   → approach_summary        │                 │
│              │                                    │   → conditional_pricing_json│                 │
│              │                                    │   → version_number          │                 │
│              │                                    │                             │                 │
│              │                                    │ [2] APPROVED:               │                 │
│              │                                    │   PUT /bids/:id/tech-review │                 │
│              │                                    │   {action:"APPROVED"}       │                 │
│              │ [3] UPDATE capability_bids SET     │                             │                 │
│              │   tech_status:"APPROVED"           │                             │                 │
│              │   Notify CEO                       │                             │                 │
│              │   INSERT notifications {CEO,       │                             │                 │
│              │     "Tech review complete"}        │                             │                 │
│              │                                    │                             │                 │
│              │                                    │ [4] OR REVISION:            │                 │
│              │                                    │   PUT /bids/:id/tech-review │                 │
│              │                                    │   {action:"REVISION_        │                 │
│              │                                    │    REQUESTED",              │                 │
│              │                                    │    tech_feedback:"Add more  │                 │
│              │                                    │    detail on vector DB"}    │                 │
│              │ [5] UPDATE capability_bids SET     │                             │                 │
│              │   tech_status:"REVISION_REQUESTED" │                             │                 │
│              │   tech_feedback="{text}"           │                             │                 │
│              │   Notify expert                    │                             │                 │
│              │                                    │                             │ [6] Expert reads│
│              │                                    │                             │   notification  │
│              │                                    │                             │   PUT /bids/:id │
│              │                                    │                             │   {updated      │
│              │                                    │                             │    components}  │
│              │ [7] UPDATE capability_bids SET     │                             │                 │
│              │   tech_status:"PENDING",           │                             │                 │
│              │   version_number++                 │                             │                 │
│              │   (loop back to Step 1)            │                             │                 │
│              │                                    │                             │                 │
├──────────────┼────────────────────────────────────┼─────────────────────────────┼─────────────────┤
│ ══ CEO REVIEW & COUNTER-OFFER ═════════════════════════════════════════════════════════════════──═│
│ [8] Notified │                                    │                             │                 │
│   GET /bids? │                                    │                             │                 │
│   projectId=:│                                    │                             │                 │
│              │                                    │                             │                 │
│ [9] Optional:│                                    │                             │                 │
│   PUT /bids/:│                                    │                             │                 │
│   id/counter-│                                    │                             │                 │
│   offer      │                                    │                             │                 │
│   {negotiated│                                    │                             │                 │
│   _price_vnd:│                                    │                             │                 │
│   20000000}  │                                    │                             │                 │
│     └───────>│                                    │                             │                 │
│              │ [10] Guard: negotiated_price_vnd   │                             │                 │
│              │   IS NULL (first write only;       │                             │                 │
│              │   immutable after set)             │                             │                 │
│              │   UPDATE capability_bids SET       │                             │                 │
│              │     negotiated_price_vnd=20000000  │                             │                 │
│              │   Notify expert of counter         │                             │                 │
│              │                                    │                             │                 │
│ [11] APPROVE:│                                    │                             │                 │
│   PUT /bids/ │                                    │                             │                 │
│   :id/ceo-   │                                    │                             │                 │
│   decision   │                                    │                             │                 │
│   {decision: │                                    │                             │                 │
│   "APPROVED"}│                                    │                             │                 │
│     └───────>│                                    │                             │                 │
│              │ [12] UPDATE capability_bids SET    │                             │                 │
│              │   ceo_status:"APPROVED"            │                             │                 │
│              │   state:"SELECTED"                 │                             │                 │
│              │   All other bids for project       │                             │                 │
│              │   → state:"DECLINED"               │                             │                 │
│              │   Notify expert: "Connection       │                             │                 │
│              │     request sent"                  │                             │                 │
│              │                                    │                             │                 │
├──────────────┼────────────────────────────────────┼─────────────────────────────┼─────────────────┤
│ ══ NDA & CONNECTION ══════════════════════════════════════════════════════════════════════───═════│
│ [13] CEO NDA │                                    │                             │                 │
│   PUT /engage│                                    │                             │                 │
│   ments/:id/ │                                    │                             │                 │
│   accept-nda │                                    │                             │                 │
│     └───────>│                                    │                             │                 │
│              │ [14] UPDATE engagements SET        │                             │                 │
│              │   client_nda_accepted_at=now()     │                             │                 │
│              │   IF expert_nda_accepted_at IS NOT │                             │                 │
│              │   NULL → state:"CONNECTED"         │                             │                 │
│              │                                    │                             │ [15] Expert:    │
│              │                                    │                             │   POST /engage- │
│              │                                    │                             │   ments/:id/    │
│              │                                    │                             │   connect       │
│              │ [16] UPDATE engagements SET        │                             │                 │
│              │   expert_nda_accepted_at=now()     │                             │                 │
│              │   IF client_nda_accepted_at IS NOT │                             │                 │
│              │   NULL:                            │                             │                 │
│              │     state:"CONNECTED"              │                             │                 │
│              │     connected_at=now()             │                             │                 │
│              │   Artifact B route guard unlocked: │                             │                 │
│              │     engagement≥CONNECTED AND       │                             │                 │
│              │     both NDA timestamps set AND    │                             │                 │
│              │     requester = EXPERT or TECH_TEAM│                             │                 │
│              │     CEO → 403 always               │                             │                 │
│              │                                    │                             │                 │
│ [17] Engagement active:  │                        │                             │                 │
│   GET /engagements/:id/bid│                       │                             │                 │
│   → bid that created it  │                        │                             │                 │
│   GET /engagements/:id   │                        │                             │                 │
│   → project metadata     │                        │                             │                 │
│     included [NEW]       │                        │                             │                 │
└──────────────┴────────────────────────────────────┴─────────────────────────────┴─────────────────┘
```

---

# MF-7: Milestone Lifecycle (Create → Fund → Deliver → Approve)

## Overview

CEO creates milestones (with criteria) from the AI blueprint. CEO funds each milestone via IPN-triggered escrow. Expert builds DoD checklist, stages pay-gated docs, submits deliverable. Sign-off authority (CEO, TECH_TEAM, or JOINT) verifies criteria one-by-one. Escrow releases via chi hộ to expert's bank. Includes new milestone edit/delete (DEFINED state only), criteria CRUD, DoD list + delete.

**Tables touched (12):** `milestones`, `acceptance_criteria`, `milestone_dod_items`, `virtual_accounts`, `escrow_accounts`, `wallet_transactions`, `wallets`, `withdrawal_requests`, `milestone_submissions`, `paygated_documents`, `platform_decisions`, `notifications`

**Key changes from old doc:** (1) `PATCH /milestones/:id` (edit while DEFINED — new). (2) `DELETE /milestones/:id` (delete while DEFINED — new). (3) `GET /criteria/:milestoneId` (list criteria — new). (4) `POST /criteria/:milestoneId` (add criterion post-creation — new). (5) `DELETE /criteria/:id` (new). (6) `GET /milestones/:id/dod` (list DoD — new). (7) `DELETE /milestones/:id/dod/:itemId` (new). (8) `GET /milestones/:id/submissions` and `/latest` (new). (9) Milestone has new fields: `title`, `estimatedDurationDays`, `techStackJson`, `estimatedCostVnd`, `isAiGenerated`, `updatedAt`.

**Endpoints:** `POST /milestones`, `GET /milestones/:id`, `PATCH /milestones/:id`, `DELETE /milestones/:id`, `GET /milestones?engagementId=`, `PUT /milestones/:id/fund`, `GET /criteria/:milestoneId`, `POST /criteria/:milestoneId`, `PUT /criteria/:id/verify`, `PUT /criteria/:id/revision`, `DELETE /criteria/:id`, `GET /milestones/:id/dod`, `POST /milestones/:id/dod/items`, `PUT /milestones/:id/dod/:itemId`, `DELETE /milestones/:id/dod/:itemId`, `POST /milestones/:id/paygated-docs`, `GET /milestones/:id/paygated-docs`, `POST /milestones/:id/submit`, `GET /milestones/:id/submissions`, `GET /milestones/:id/submissions/latest`, `GET /engagements/:id/milestones`, `GET /engagements/:id/submissions`, `GET /milestones/:id/disputes`, `POST /webhooks/sepay/ipn`

---

## ASCII Swimlane

```
┌───────────────────────────┬────────────────────────────────────────────────┬───────────────┬──────────────┐
│      CLIENT / CEO         │        SYSTEM (NestJS)                         │    EXPERT     │ TECH_TEAM    │
├───────────────────────────┼────────────────────────────────────────────────┼───────────────┼──────────────┤
│ ══ PHASE A: CREATE MILESTONES ════════════════════════════════════════════════════════════════════════════│
│ [1] Reviews AI blueprint  │                                                │               │              │
│   GET /projects/:id       │                                                │               │              │
│   → milestone_framework_  │                                                │               │              │
│     json (AI estimates:   │                                                │               │              │
│     cost + duration)      │                                                │               │              │
│   [2] POST /milestones    │                                                │               │              │
│   {engagement_id,         │                                                │               │              │
│    milestone_number:1,    │                                                │               │              │
│    title:"Phase 1",       │                                                │               │              │
│    deliverable_statement, │                                                │               │              │
│    sign_off_authority:    │                                                │               │              │
│    "JOINT",               │                                                │               │              │
│    payment_amount_vnd:    │                                                │               │              │
│    40000000,              │                                                │               │              │
│    criteria:[{            │                                                │               │              │
│      criterion_text:"≥95% │                                                │               │              │
│        precision",        │                                                │               │              │
│      is_required:true     │                                                │               │              │
│    }]}                    │                                                │               │              │
│       └──────────────────>│                                                │               │              │
│                           │ [3] INSERT milestones {                        │               │              │
│                           │   engagement_id, milestone_number:1,           │               │              │
│                           │   title, deliverable_statement,                │               │              │
│                           │   sign_off_authority:"JOINT",                  │               │              │
│                           │   payment_amount_vnd:40000000,                 │               │              │
│                           │   state:"DEFINED",                             │               │              │
│                           │   estimated_cost_vnd (from AI blueprint),      │               │              │
│                           │   estimated_duration_days (from AI blueprint), │               │              │
│                           │   is_ai_generated:true                         │               │              │
│                           │ }                                              │               │              │
│                           │ INSERT acceptance_criteria rows                │               │              │
│ <─────────────────────────┤                                                │               │              │
│                           │                                                │               │              │
│ [4] Edit milestone [NEW]: │                                                │               │              │
│   PATCH /milestones/:id   │                                                │               │              │
│   {title:"Updated title", │                                                │               │              │
│    payment_amount_vnd:    │                                                │               │              │
│    45000000}              │                                                │               │              │
│       └──────────────────>│                                                │               │              │
│                           │ [5] Guard: state=DEFINED AND CEO owns          │               │              │
│                           │   UPDATE milestones SET {partial fields}       │               │              │
│                           │   updated_at=now()                             │               │              │
│                           │   IF state≠DEFINED → 422                       │               │              │
│ <─────────────────────────┤                                                │               │              │
│                           │                                                │               │              │
│ [6] Add criterion [NEW]:  │                                                │               │              │
│   GET /criteria/:milestoneId→ list│                                        │               │              │
│   POST /criteria/:milestoneId     │                                        │               │              │
│   {criterion_text:"Rule parser   │                                         │               │              │
│     handles 3-category ruleset", │                                         │               │              │
│    is_required:true}             │                                         │               │              │
│       └──────────────────>│                                                │               │              │
│                           │ [7] INSERT acceptance_criteria {               │               │              │
│                           │   milestone_id, criterion_text,                │               │              │
│                           │   is_required:true }                           │               │              │
│                           │                                                │               │              │
│ [8] Delete milestone [NEW]│                                                │               │              │
│   DELETE /milestones/:id  │                                                │               │              │
│   (only DEFINED state)    │                                                │               │              │
│       └──────────────────>│                                                │               │              │
│                           │ [9] Guard: state=DEFINED                       │               │              │
│                           │   DELETE milestones (cascades criteria+dod)    │               │              │
│                           │   IF state≠DEFINED → 422                       │               │              │
│                           │                                                │               │              │
├───────────────────────────┼────────────────────────────────────────────────┼───────────────┼──────────────┤
│ ══ PHASE B: FUND MILESTONE ═════════════════════════════════════════════════════════════════════════════════│
│ [10] PUT /milestones/:id/ │                                                │               │              │
│   fund                    │                                                │               │              │
│       └──────────────────>│                                                │               │              │
│                           │ [11] INSERT virtual_accounts {                 │               │              │
│                           │   entity_type:"MILESTONE",                     │               │              │
│                           │   entity_id: milestone_id,                     │               │              │
│                           │   va_number: generateVaNumber(),               │               │              │
│                           │   fixed_amount: payment_amount_vnd,            │               │              │
│                           │   expires_at: now()+24h,                       │               │              │
│                           │   status:"ACTIVE" }                            │               │              │
│                           │   UPDATE milestones SET                        │               │              │
│                           │     va_number, va_expires_at                   │               │              │
│                           │   Return {va_number,                           │               │              │
│                           │     qrCodeUrl, vaExpiresAt}                    │               │              │
│ <─────────────────────────┤                                                │               │              │
│ [12] Scans QR, pays exact │                                                │               │              │
│   40,000,000 VND          │                                                │               │              │
│                           │ [13] IPN fires: POST /webhooks/sepay/ipn       │               │              │
│                           │   Entity: MILESTONE branch                     │               │              │
│                           │   Validate: amount==va.fixed_amount            │               │              │
│                           │   Idempotency check                            │               │              │
│                           │   DB TX (atomic):                              │               │              │
│                           │     UPDATE wallets (client):                   │               │              │
│                           │       available -= 40000000                    │               │              │
│                           │       locked += 40000000                       │               │              │
│                           │     INSERT wallet_transactions                 │               │              │
│                           │       {ESCROW_LOCK} [LEDGER]                   │               │              │
│                           │     INSERT escrow_accounts {                   │               │              │
│                           │       milestone_id, amount:40000000,           │               │              │
│                           │       client_wallet_id,                        │               │              │
│                           │       expert_wallet_id,                        │               │              │
│                           │       status:"HELD", held_at:now()             │               │              │
│                           │     }                                          │               │              │
│                           │     UPDATE milestones SET                      │               │              │
│                           │       state:"FUNDED", funded_at:now()          │               │              │
│                           │       → auto-advance state:"IN_PROGRESS"       │               │              │
│                           │     IF first milestone:                        │               │              │
│                           │       UPDATE engagements SET state:"ACTIVE"    │               │              │
│                           │     UPDATE virtual_accounts SET status:"USED"  │               │              │
│                           │     UPDATE paygated_documents SET              │               │              │
│                           │       release_state:"RELEASED"                 │               │              │
│                           │       WHERE milestone_id=? AND                 │               │              │
│                           │       release_state="STAGED"                   │               │              │
│                           │     INSERT notifications {TECH_TEAM:           │               │              │
│                           │       "Pay-gated docs released"}               │               │              │
│                           │     INSERT notifications {EXPERT:              │               │              │
│                           │       "Milestone N funded — begin work"}       │               │              │
│                           │     COMMIT                                     │               │              │
│                           │   Return 200 {success:true} to SePay           │               │              │
│                           │                                                │               │              │
├───────────────────────────┼────────────────────────────────────────────────┼───────────────┼──────────────┤
│ ══ PHASE C: EXPERT DELIVERY ══════════════════════════════════════════════════════════════════════════════│
│                           │                                                │ [14] Stage    │ [14b] TECH   │
│                           │                                                │  paygated doc:│  views doc   │
│                           │                                                │  POST .../    │  inbox:      │
│                           │                                                │  paygated-docs│  GET .../    │
│                           │                                                │  {document_url│  paygated-   │
│                           │ [15] INSERT paygated_documents {               │  } (pre-fund) │  docs        │
│                           │   release_state:"STAGED",                      │               │  (RELEASED)  │
│                           │   staged_at:now() }                            │               │              │
│                           │                                                │               │              │
│                           │                                                │ [16] Create   │              │
│                           │                                                │  DoD items:   │              │
│                           │                                                │  GET .../dod  │              │
│                           │                                                │  POST .../dod/│              │
│                           │                                                │  items {desc, │              │
│                           │                                                │  is_required} │              │
│                           │ [17] INSERT milestone_dod_items {              │               │              │
│                           │   status:"PENDING",                            │               │              │
│                           │   maps_to_criterion_id(optional) }             │               │              │
│                           │                                                │               │              │
│                           │                                                │ [18] Complete │              │
│                           │                                                │  DoD:         │              │
│                           │                                                │  PUT .../dod/ │              │
│                           │                                                │  :itemId      │              │
│                           │                                                │  {status:     │              │
│                           │                                                │   "COMPLETED",│              │
│                           │                                                │   completion_ │              │
│                           │                                                │   note:"..."} │              │
│                           │ [19] UPDATE milestone_dod_items SET            │               │              │
│                           │   status:"COMPLETED", completed_at:now()       │               │              │
│                           │   DB CHECK: is_required=true AND               │               │              │
│                           │     status→NOT_APPLICABLE → 422                │               │              │
│                           │                                                │               │              │
│                           │                                                │ [20] Delete   │              │
│                           │                                                │  PENDING item:│              │
│                           │                                                │  DELETE .../  │              │
│                           │                                                │  dod/:itemId  │              │
│                           │ [21] Guard: status=PENDING                     │  [NEW]        │              │
│                           │   DELETE milestone_dod_items                   │               │              │
│                           │                                                │               │              │
│                           │                                                │ [22] Submit   │              │
│                           │                                                │  deliverable: │              │
│                           │                                                │  POST .../    │              │
│                           │                                                │  submit       │              │
│                           │                                                │  {description,│              │
│                           │                                                │   files_json} │              │
│                           │ [23] DoD gate:                                 │               │              │
│                           │   SELECT COUNT required dod_items              │               │              │
│                           │     WHERE status≠COMPLETED                     │               │              │
│                           │   IF >0 → 422 DOD_INCOMPLETE                   │               │              │
│                           │     {missing_items:[...]}                      │               │              │
│                           │   DB TX:                                       │               │              │
│                           │   INSERT milestone_submissions {               │               │              │
│                           │     milestone_id, expert_id,                   │               │              │
│                           │     description, files_json,                   │               │              │
│                           │     submitted_at:now() }                       │               │              │
│                           │   UPDATE milestones SET                        │               │              │
│                           │     state:"SUBMITTED",                         │               │              │
│                           │     submitted_at:now()                         │               │              │
│                           │   Notify sign-off authority                    │               │              │
│                           │                                                │               │              │
│                           │                                                │ [24] View     │              │
│                           │                                                │  submission   │              │
│                           │                                                │  history:     │              │
│                           │                                                │  GET .../     │              │
│                           │                                                │  submissions  │              │
│                           │                                                │  GET .../     │              │
│                           │                                                │  submissions/ │              │
│                           │                                                │  latest [NEW] │              │
│                           │                                                │               │              │
├───────────────────────────┼────────────────────────────────────────────────┼───────────────┼──────────────┤
│ ══ PHASE D: SIGN-OFF ═════════════════════════════════════════════════════════════════════════════════════│
│ [25] Notified "Milestone  │                                                │               │ [25b] TECH   │
│   N submitted for review" │                                                │               │  also        │
│   GET /milestones/:id     │                                                │               │  notified    │
│   GET .../submissions/    │                                                │               │  (if JOINT)  │
│   latest [NEW]            │                                                │               │              │
│   GET /criteria/:id       │                                                │               │              │
│                           │                                                │               │              │
│ [26] Verify criterion:    │                                                │               │ [26b] TECH   │
│   PUT /criteria/:id/verify│                                                │               │  verifies:   │
│   (for CEO or JOINT       │                                                │               │  PUT /criter-│
│    criteria)              │                                                │               │  ia/:id/     │
│       └──────────────────>│                                                │               │  verify      │
│                           │ [27] UPDATE acceptance_criteria SET            │               │              │
│                           │   verified_at=now()                            │               │              │
│                           │   revision_note=null (cleared)                 │               │              │
│                           │   CHECK all required criteria verified:        │               │              │
│                           │   SELECT COUNT(*) FROM acceptance_criteria     │               │              │
│                           │     WHERE milestone_id=? AND is_required=true  │               │              │
│                           │     AND verified_at IS NULL                    │               │              │
│                           │   IF >0 → 422 (more to verify)                 │               │              │
│                           │   IF =0 → APPROVED guard passes:               │               │              │
│                           │     CHECK no open disputes                     │               │              │
│                           │     UPDATE milestones SET                      │               │              │
│                           │       state:"APPROVED",                        │               │              │
│                           │       approved_at:now()                        │               │              │
│                           │     [LEDGER] DB TX (atomic):                   │               │              │
│                           │       UPDATE client wallet:                    │               │              │
│                           │         locked -= 40000000                     │               │              │
│                           │       UPDATE expert wallet:                    │               │              │
│                           │         available += 40000000*(1-fee_pct)      │               │              │
│                           │       UPDATE platform wallet:                  │               │              │
│                           │         available += 40000000*fee_pct          │               │              │
│                           │       INSERT wallet_transactions × 3:          │               │              │
│                           │         {ESCROW_RELEASE}                       │               │              │
│                           │         {PLATFORM_FEE}                         │               │              │
│                           │         {expert credit}                        │               │              │
│                           │       UPDATE escrow_accounts SET               │               │              │
│                           │         status:"RELEASED"                      │               │              │
│                           │     COMMIT                                     │               │              │
│                           │     Async: chi hộ API →                        │               │              │
│                           │       INSERT withdrawal_requests {PENDING}     │               │              │
│                           │       SePay credit IPN fires →                 │               │              │
│                           │       UPDATE withdrawal_requests COMPLETED     │               │              │
│                           │       UPDATE milestones SET state:"RELEASED"   │               │              │
│                           │     IF all milestones RELEASED:                │               │              │
│                           │       UPDATE engagements state:"CLOSED"        │               │              │
│                           │                                                │               │              │
│ [28] OR Reject criterion: │                                                │               │              │
│   PUT /criteria/:id/      │                                                │               │              │
│   revision {revision_note}│                                                │               │              │
│       └──────────────────>│                                                │               │              │
│                           │ [29] UPDATE acceptance_criteria SET            │               │              │
│                           │   revision_note="{text}",                      │               │              │
│                           │   verified_at=null                             │               │              │
│                           │   UPDATE milestones SET state:"IN_REVISION"    │               │              │
│                           │   Notify expert with revision_note text        │               │              │
└───────────────────────────┴────────────────────────────────────────────────┴───────────────┴──────────────┘
```

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 3 | NestJS | Create milestone + criteria | `milestones` (C), `acceptance_criteria` (C) | DEFINED | `POST /milestones` |
| 5 | NestJS | Edit milestone (DEFINED only) | `milestones` (U) | updated_at refreshed | `PATCH /milestones/:id` |
| 7 | NestJS | Add criterion post-creation | `acceptance_criteria` (C) | — | `POST /criteria/:milestoneId` |
| 9 | NestJS | Delete milestone (DEFINED only) | `milestones` (D), `acceptance_criteria` (D), `milestone_dod_items` (D) | — | `DELETE /milestones/:id` |
| 11 | NestJS | Create milestone VA (24h expiry) | `virtual_accounts` (C), `milestones` (U) | va_number set | `PUT /milestones/:id/fund` |
| 13 | SePay→NestJS | IPN MILESTONE: escrow lock, release docs, notify | `wallets` (U×2), `wallet_transactions` (C), `escrow_accounts` (C), `milestones` (U), `engagements` (U), `virtual_accounts` (U), `paygated_documents` (U), `notifications` (C×N) | FUNDED→IN_PROGRESS | `POST /webhooks/sepay/ipn` |
| 17 | NestJS | Create DoD items | `milestone_dod_items` (C) | PENDING | `POST .../dod/items` |
| 19 | NestJS | Update DoD item status | `milestone_dod_items` (U) | COMPLETED | `PUT .../dod/:itemId` |
| 21 | NestJS | Delete PENDING DoD item | `milestone_dod_items` (D) | — | `DELETE .../dod/:itemId` |
| 23 | NestJS | DoD gate; create submission; advance state | `milestone_submissions` (C), `milestones` (U), `notifications` (C) | SUBMITTED | `POST .../submit` |
| 27 | NestJS | Verify criterion; if all done → APPROVED + escrow release | `acceptance_criteria` (U), `milestones` (U), `wallets` (U×3), `wallet_transactions` (C×3), `escrow_accounts` (U), `withdrawal_requests` (C) | APPROVED→RELEASED | `PUT /criteria/:id/verify` |
| 29 | NestJS | Reject criterion; set IN_REVISION | `acceptance_criteria` (U), `milestones` (U), `notifications` (C) | IN_REVISION | `PUT /criteria/:id/revision` |

---

# MF-8: Dispute Filing, Evidence & LLM Resolution

## Overview

Any party to an engagement files a dispute against a specific acceptance criterion. Escrow frozen. FastAPI evaluates deliverable vs criterion with project context now injected (archetype, milestone context, revision count). Returns `reasoning` field (new). If `confidence ≥ 0.80` → AUTO_RESOLVED. Otherwise → MANUAL_REVIEW for admin (MF-20). Parties can submit additional evidence post-filing. Filer can withdraw before resolution.

**Tables touched (7):** `disputes`, `escrow_accounts`, `milestones`, `platform_decisions`, `wallets`, `wallet_transactions`, `notifications`

**Key changes from old doc:** (1) `POST /disputes/:id/evidence` (new — submit additional evidence). (2) `PUT /disputes/:id/withdraw` (new — retract before resolution). (3) FastAPI now receives `project_archetype`, `milestone_context`, `prior_revision_count` for better arbitration. (4) Response includes `reasoning` field explaining the finding. (5) `GET /milestones/:id/disputes` and `GET /engagements/:id/disputes` added.

**Endpoints:** `POST /disputes`, `GET /disputes/:id`, `GET /disputes`, `POST /disputes/:id/evidence`, `PUT /disputes/:id/withdraw`, `GET /milestones/:id/disputes`, `GET /engagements/:id/disputes`, `PUT /admin/disputes/:id/resolve`

---

## ASCII Swimlane

```
┌──────────────────────────┬─────────────────────────────────────────────┬──────────────────────┐
│    CEO or EXPERT (Filer) │        SYSTEM (NestJS + FastAPI)            │      ADMIN           │
├──────────────────────────┼─────────────────────────────────────────────┼──────────────────────┤
│ [1] POST /disputes {     │                                             │                      │
│   engagement_id,         │                                             │                      │
│   milestone_id,          │                                             │                      │
│   criterion_id,          │                                             │                      │
│   escrow_account_id,     │                                             │                      │
│   deliverableDescription,│                                             │                      │
│   files:[]               │                                             │                      │
│ }                        │                                             │                      │
│       └────────────────> │                                             │                      │
│                          │ [2] DB TX (atomic):                         │                      │
│                          │   INSERT disputes {                         │                      │
│                          │     state:"PENDING",                        │                      │
│                          │     filed_by:userId,                        │                      │
│                          │     filed_at:now()                          │                      │
│                          │   }                                         │                      │
│                          │   UPDATE escrow_accounts SET                │                      │
│                          │     status:"FROZEN"                         │                      │
│                          │   UPDATE milestones SET                     │                      │
│                          │     state:"DISPUTED"                        │                      │
│                          │   COMMIT                                    │                      │
│                          │                                             │                      │
│                          │ [3] [AI] FastAPI dispute_eval:              │                      │
│                          │   Passes [NEW fields]:                      │                      │
│                          │     criterion_text,                         │                      │
│                          │     deliverable_description,                │                      │
│                          │     files:[],                               │                      │
│                          │     project_archetype:"3" [NEW],            │                      │
│                          │     milestone_context:"Rule parser..." [NEW],│                     │
│                          │     prior_revision_count:1 [NEW]            │                      │
│                          │   Prompt from prompt_templates (60s TTL)    │                      │
│                          │   Returns {                                 │                      │
│                          │     confidence_score: 0.91,                 │                      │
│                          │     finding:"expert_wins",                  │                      │
│                          │     reasoning:"Deliverable explicitly       │                      │
│                          │       handles all 3 rule categories         │                      │
│                          │       stated in criterion" [NEW]            │                      │
│                          │   }                                         │                      │
│                          │   UPDATE disputes SET                       │                      │
│                          │     llm_confidence=0.91                     │                      │
│                          │                                             │                      │
│                          │ [4a] confidence ≥ 0.80: AUTO_RESOLVED       │                      │
│                          │   expert_wins:                              │                      │
│                          │   DB TX: [LEDGER] same as milestone APPROVED│                      │
│                          │     escrow→expert (net of fee)              │                      │
│                          │   client_wins:                              │                      │
│                          │   DB TX: [LEDGER]                           │                      │
│                          │     UPDATE client wallet: avail += amount   │                      │
│                          │     escrow_accounts.status:"REFUNDED"       │                      │
│                          │   UPDATE disputes SET state:"AUTO_RESOLVED" │                      │
│                          │   UPDATE milestones SET state:"APPROVED"    │                      │
│                          │   INSERT platform_decisions                 │                      │
│                          │     {DISPUTE_L1_EVAL,AUTO_RESOLVED}         │                      │
│                          │   Notify both parties                       │                      │
│ <────────────────────────┤                                             │                      │
│                          │ [4b] confidence < 0.80: MANUAL_REVIEW       │                      │
│                          │   UPDATE disputes SET state:"MANUAL_REVIEW" │                      │
│                          │   Notify admin                              │                      │
│                          ├─────────────────────────────────────────────>                      │
│                          │                                             │ [5] Views:           │
│                          │                                             │  GET /admin/disputes │
│                          │                                             │  ?state=MANUAL_REVIEW│
│                          │                                             │  GET /disputes/:id   │
│                          │                                             │  → reasoning [NEW]   │
│                          │                                             │  → llm_confidence    │
│                          │                                             │  GET /engagements/   │
│                          │                                             │  :id/messages        │
│                          │                                             │                      │
│ [6] Post-filing evidence │                                             │                      │
│   POST /disputes/:id/    │                                             │                      │
│   evidence [NEW]         │                                             │                      │
│   {evidence_description, │                                             │                      │
│    file_urls:[]}         │                                             │                      │
│       └────────────────> │                                             │                      │
│                          │ [7] INSERT platform_decisions {             │                      │
│                          │   EVIDENCE_SUBMISSION,                      │                      │
│                          │   advisory_note:"[userId] {description}"}   │                      │
│                          │   Guard: dispute still open                 │                      │
│                          │                                             │                      │
│ [8] Withdraw dispute     │                                             │                      │
│   PUT /disputes/:id/     │                                             │                      │
│   withdraw [NEW]         │                                             │                      │
│       └────────────────> │                                             │                      │
│                          │ [9] Guard: filed_by=userId, state=open      │                      │
│                          │   UPDATE disputes SET state:"WITHDRAWN"     │                      │
│                          │   UPDATE escrow_accounts SET status:"HELD"  │                      │
│                          │     (unfrozen)                              │                      │
│                          │   UPDATE milestones SET state:"SUBMITTED"   │                      │
│                          ├─────────────────────────────────────────────>                      │
│                          │                                             │ [10] Admin resolves  │
│                          │                                             │  PUT /admin/disputes/│
│                          │                                             │  :id/resolve         │
│                          │                                             │  {decision:"RELEASE"}│
│                          │ [11] Per decision:                          │                      │
│                          │   RELEASE → escrow→expert (net of fee)      │                      │
│                          │   REFUND → escrow→client                    │                      │
│                          │   SPLIT → escrow÷2 to each party            │                      │
│                          │   UPDATE disputes SET state:"RESOLVED"      │                      │
│                          │   UPDATE milestones SET state:"APPROVED"    │                      │
│                          │   INSERT platform_decisions {DISPUTE_MANUAL}│                      │
│                          │   Notify both parties                       │                      │
└──────────────────────────┴─────────────────────────────────────────────┴──────────────────────┘
```

---

# MF-9: Post-Engagement Review & Closure

## Overview

After all milestones reach RELEASED state, engagement closes. All three parties (CEO, TECH_TEAM, Expert) can submit role-specific reviews. Expert sees own reviews written/received via new endpoints.

**Tables touched (2):** `engagements`, `reviews`

**Endpoints:** `POST /reviews`, `GET /reviews/me`, `GET /reviews/me/received`, `GET /reviews/users/:userId`, `GET /engagements/:id`

---

## ASCII Swimlane

```
┌───────────────────┬────────────────────────────────┬───────────────────────────────────────────┐
│   CLIENT / CEO    │      SYSTEM (NestJS)           │    EXPERT  /  TECH_TEAM                   │
├───────────────────┼────────────────────────────────┼───────────────────────────────────────────┤
│ [1] All milestones│                                │                                           │
│   RELEASED        │                                │                                           │
│                   │ [2] UPDATE engagements SET     │                                           │
│                   │   state:"CLOSED"               │                                           │
│                   │   Notify all parties           │                                           │
│                   │                                │                                           │
│ [3] CEO review:   │                                │ [3b] Expert review:                       │
│   POST /reviews { │                                │   POST /reviews {                         │
│     engagement_id,│                                │     engagement_id,                        │
│     target_id:    │                                │     target_id: clientId,                  │
│       expert_id,  │                                │     rating:5, comment:"...",              │
│     rating:4,     │                                │     reviewer_role:"EXPERT"                │
│     comment:"...",│                                │   }                                       │
│     reviewer_role:│                                │                                           │
│     "CEO"         │                                │ [3c] TECH_TEAM review:                    │
│   }               │                                │   POST /reviews {                         │
│       └──────────>│                                │     ...structured_signals_json:{...}      │
│                   │ [4] INSERT reviews {           │     reviewer_role:"TECH_TEAM"             │
│                   │   engagement_id,               │   }                                       │
│                   │   reviewer_id, target_id,      │         └────────────────────────────────>│
│                   │   rating, comment,             │                                           │
│                   │   reviewer_role                │                                           │
│                   │ }                              │                                           │
│                   │ UNIQUE(engagement_id,          │                                           │
│                   │   reviewer_id) enforced        │                                           │
│                   │                                │                                           │
│ [5] View reviews: │                                │ [5b] Expert view:                         │
│   GET /reviews/me │                                │   GET /reviews/me         (given)         │
│     → given       │                                │   GET /reviews/me/received [NEW]          │
│   GET /reviews/   │                                │   GET /reviews/users/:id  [NEW]           │
│     users/:expertId│                               │     → public reputation                   │
└───────────────────┴────────────────────────────────┴───────────────────────────────────────────┘
```

---

