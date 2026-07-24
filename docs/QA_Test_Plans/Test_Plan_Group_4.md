# E2E QA Test Plan

## 1. Test Environments & Preconditions
- **Test Environments:** Docker setups (isolated vs full UI) and observability tools (Prisma Studio, DevTools, DB logs).
- **Universal Checks:** Baseline checks that must pass on *every* screen (e.g., JWT validation, role-guards, UI feedback, double-submission prevention).
- **Cross-actor visibility:** Other involved actors receive the right notification/socket update and see the new state after refresh.
- **Data Seeds:** Ensure you have the correct persona (e.g. CEO-A, EXP-B) seeded in the database before starting the flow.

---

## Group 4 — Path B & C: Service-Based Flows

---

# MF-10: Service-Based Engagement Purchase (Path B)

## Overview

CEO purchases an AI_SERVICE listing directly from the marketplace. No elicitation, no bid, no TECH_TEAM. Single milestone created and funded atomically on IPN. CEO is sole sign-off authority.

**Tables touched (8):** `services`, `engagements`, `virtual_accounts`, `milestones`, `escrow_accounts`, `wallet_transactions`, `wallets`, `notifications`

**Endpoints:** `GET /services`, `GET /services/:id`, `POST /services/:id/purchase`, `GET /services/me/purchases`, `PUT /services/:id/publish`, `PUT /services/:id/unpublish`, `DELETE /services/:id`

---

## ASCII Swimlane

```
┌───────────────────────────┬──────────────────────────────────────────────────────┬──────────────────┐
│       CLIENT / CEO        │         SYSTEM (NestJS)                              │   SePay          │
├───────────────────────────┼──────────────────────────────────────────────────────┼──────────────────┤
│ [1] Browse marketplace:   │                                                      │                  │
│   GET /services           │                                                      │                  │
│   ?serviceType=AI_SERVICE │                                                      │                  │
│   &domains[]=A            │                                                      │                  │
│   &seams[]=A↔C            │                                                      │                  │
│   ← domain/seam filters   │                                                      │                  │
│     from GET /config/     │                                                      │                  │
│     domains + seams [NEW] │                                                      │                  │
│       └────────────────>  │                                                      │                  │
│                           │ [2] SELECT services WHERE state='PUBLISHED'          │                  │
│                           │   + domain/seam JSON contains filter values          │                  │
│                           │   Return [{title,domainsJson,seamsJson,              │                  │
│                           │     priceVnd,expert{name,avgRating}}]                │                  │
│ <─────────────────────────┤                                                      │                  │
│ [3] GET /services/:id     │                                                      │                  │
│   View full service detail│                                                      │                  │
│                           │                                                      │                  │
│ [4] POST /services/:id/   │                                                      │                  │
│   purchase                │                                                      │                  │
│       └────────────────>  │                                                      │                  │
│                           │ [5] Guard: active_role=CLIENT,client_subtype=CEO     │                  │
│                           │   DB TX:                                             │                  │
│                           │   INSERT engagements {                               │                  │
│                           │     service_id, expert_id,                           │                  │
│                           │     type:service.service_type,                       │                  │
│                           │     state:"PENDING"                                  │                  │
│                           │   }                                                  │                  │
│                           │   INSERT virtual_accounts {                          │                  │
│                           │     entity_type:"SERVICE",                           │                  │
│                           │     entity_id: engagement_id,                        │                  │
│                           │     fixed_amount: service.price_vnd,                 │                  │
│                           │     expires_at: now()+24h                            │                  │
│                           │   }                                                  │                  │
│                           │   Return {qrCodeUrl, vaNumber, vaExpiresAt}          │                  │
│ <─────────────────────────┤                                                      │                  │
│ [6] Scans QR; pays exact  │                                                      │                  │
│   amount                  │                                                      │                  │
│                           │ [7] IPN fires SERVICE branch:                        │ SePay IPN fires  │
│                           │   Validate: amount==va.fixed_amount                  │                  │
│                           │   DB TX (atomic):                                    │                  │
│                           │     INSERT wallet_transactions {ESCROW_LOCK} [LEDGER]│                  │
│                           │     UPDATE wallets (client): locked+=amount          │                  │
│                           │     INSERT escrow_accounts {                         │                  │
│                           │       engagement_id (not milestone_id),              │                  │
│                           │       status:"HELD" }                                │                  │
│                           │     INSERT milestones {                              │                  │
│                           │       engagement_id,                                 │                  │
│                           │       milestone_number:1,                            │                  │
│                           │       sign_off_authority:"CEO",                      │                  │
│                           │       payment_amount_vnd,                            │                  │
│                           │       state:"FUNDED" }                               │                  │
│                           │     UPDATE engagements state:"ACTIVE"                │                  │
│                           │     COMMIT                                           │                  │
│                           │   Notify expert: "New service order"                 │                  │
│ [8] GET /services/me/     │                                                      │                  │
│   purchases [NEW]         │                                                      │                  │
│   → purchased services    │                                                      │                  │
│   history                 │                                                      │                  │
└───────────────────────────┴──────────────────────────────────────────────────────┴──────────────────┘
```

---

