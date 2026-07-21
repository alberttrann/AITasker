# 04 — Thức (Minh Thức): Admin Dashboard + Socket + E2E Tests + Fixes

> **Screens:** 8 admin | **BE Fixes:** 6 endpoints | **Socket:** 3 events | **Tests:** 2 E2E
> **Source:** Live codebase E:\AITaskerVer3

---

## Your Files

| # | File | Type | Priority |
|---|------|------|:---:|
| 1 | `features/admin/AdminDashboard.tsx` | Rewrite (28B stub) | P0 |
| 2 | `features/admin/AdminLayout.tsx` | New | P0 |
| 3 | `features/admin/disputes/DisputeMonitor.tsx` | New | P0 |
| 4 | `features/admin/disputes/DisputeDetail.tsx` | New | P0 |
| 5 | `features/admin/disputes/ResolutionConfirm.tsx` | New | P0 |
| 6 | `features/admin/accounts/UserList.tsx` | New | P0 |
| 7 | `features/admin/analytics/AnalyticsDashboard.tsx` | New | P0 |
| 8 | `features/admin/PlatformSettings.tsx` | New | P1 |
| 9 | `features/admin/SeamManagement.tsx` | New | P1 |
| 10 | `hooks/use-admin.ts` | New Hook | P0 |
| 11 | `lib/socket-provider.tsx` | Edit (+30 lines) | P0 |
| 12 | `backend/src/disputes/disputes.service.ts` | Edit (+40 lines) | P0 |
| 13 | `backend/src/submissions/submissions.service.ts` | Edit (+20 lines) | P0 |
| 14 | `backend/src/payments/ipn-handler.service.ts` | Edit (+20 lines) | P0 |
| 15 | `backend/src/admin/admin.controller.ts` | Edit (+40 lines) | P1 |
| 16 | `backend/test/T18-admin-flow.spec.ts` | New | P1 |
| 17 | `backend/test/T19-socket-events.spec.ts` | New | P1 |

---

## 📋 Per-Screen Data Flow

### Screen 1: DisputeMonitor.tsx (Admin Disputes Queue)

Admin views all disputes, filters by state.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Load | **FE→BE** | `GET` | `/admin/disputes?state=MANUAL_REVIEW` | Fetch disputes | — |
| Data | **BE→FE** | `200` | — | Dispute list | `[{ id, engagement_id, milestone_id, criterion_id, escrow_account_id, filed_by, state: 'MANUAL_REVIEW'|'AUTO_RESOLVED'|'RESOLVED', llm_confidence, filed_at }]` |
| Render | **FE** | — | — | Table with state badges | Click row → DisputeDetail |

**Filter options:** All | MANUAL_REVIEW | AUTO_RESOLVED | RESOLVED

---

### Screen 2: DisputeDetail.tsx

Admin views full dispute details.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Load | **FE→BE** | `GET` | `/disputes/:id` | Fetch dispute (admin role) | — |
| Data | **BE→FE** | `200` | — | Full dispute | `{ id, state, llm_confidence, criterion: { criterion_text }, milestone: { deliverable_statement, payment_amount_vnd }, escrowAccount: { status, amount }, filed_by, filed_at }` |
| Render | **FE** | — | — | Criterion text, LLM confidence, escrow amount | Show "Resolve" button if MANUAL_REVIEW |

---

### Screen 3: ResolutionConfirm.tsx

Admin resolves a dispute: release to expert, refund to client, or 50/50 split.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Resolve | **FE→BE** | `PUT` | `/admin/disputes/:id/resolve` | Choose resolution | `{ decision: 'release' | 'refund' | 'split' }` |
| Response | **BE→FE** | `200` | — | Dispute resolved | `{ state: 'RESOLVED', resolved_at }` — BE auto-runs ledger (ESCROW_RELEASE/REFUND/SPLIT) |
| Then | **FE** | — | — | Back to DisputeMonitor | Invalidate `['admin', 'disputes']` |

**Errors:**
| BE Code | Message | FE Action |
|:-------:|---------|-----------|
| 422 | "NOT_IN_MANUAL_REVIEW" | Hide resolve button |

---

### Screen 4: UserList.tsx

Admin manages users: view list, suspend, reactivate.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Load | **FE→BE** | `GET` | `/admin/users` | Fetch all users | — |
| Data | **BE→FE** | `200` | — | User list | `[{ id, email, full_name, roles, active_role, client_subtype, subscription_client_tier, subscription_expert_tier, is_active, created_at }]` |

**Suspend User:**
| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Suspend | **FE→BE** | `PUT` | `/admin/users/:id/suspend` | Deactivate | — |
| Response | **BE→FE** | `200` | — | `is_active: false` | User can no longer login |

**Reactivate User:**
| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Reactivate | **FE→BE** | `PUT` | `/admin/users/:id/reactivate` | Re-enable | — |
| Response | **BE→FE** | `200` | — | `is_active: true` | — |

---

### Screen 5: AnalyticsDashboard.tsx

Admin views platform metrics.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Load | **FE→BE** | `GET` | `/admin/analytics` | Fetch stats | — |
| Data | **BE→FE** | `200` | — | Aggregated metrics | `{ elicitation_completion_rate, auto_publish_pass_rate, portfolio_upgrade_rate, dispute_rate, llm_auto_resolve_rate, milestone_completion_rate, avg_review_cycle_days, avg_rating }` |
| Render | **FE** | — | — | Stat cards + simple charts | — |

---

### Screen 6: PlatformSettings.tsx

Admin edits platform fee percentage.

| Step | Dir | Method | Endpoint | What You Send / Get | Shape |
|------|:---:|:------:|----------|---------------------|-------|
| Load | **FE→BE** | `GET` | `/admin/platform-settings` | Fetch current | — |
| Data | **BE→FE** | `200` | — | Settings | `{ platform_fee_pct: 0.05, platform_wallet_id: "..." }` |
| Save | **FE→BE** | `PUT` | `/admin/platform-settings` | Update fee | `{ platform_fee_pct: 0.05 }` |
| Response | **BE→FE** | `200` | — | Updated | Takes effect on NEXT milestone approval |

---

## 🔌 Socket.io Events to Wire

### 3 Missing Emissions (add to BE):

**1. payment:confirmed — in ipn-handler.service.ts handleMilestoneTopup()**
```ts
// After successful escrow lock, AFTER transaction:
this.eventEmitter.emit('socket.broadcast', {
  userId: engagement.clientId,
  event: 'payment:confirmed',
  payload: {
    engagement_id: engagement.id,
    milestone_number: milestone.milestoneNumber,
    amount_vnd: Number(transferAmount),
  },
});
```

**2. dispute:filed — in disputes.service.ts create()**
```ts
// After dispute created:
this.eventEmitter.emit('socket.broadcast', {
  userId: engagement.clientId === filerId ? engagement.expertId : engagement.clientId,
  event: 'dispute:filed',
  payload: { engagement_id: engagement.id },
});
```

**3. dispute:resolved — in disputes.service.ts applyResolution()**
```ts
// After dispute resolved, notify both parties:
[engagement.clientId, engagement.expertId].forEach(userId => {
  this.eventEmitter.emit('socket.broadcast', {
    userId,
    event: 'dispute:resolved',
    payload: { engagement_id: dispute.engagementId, resolution: resolution.decision },
  });
});
```

### Socket Provider (FE) — Verify these listeners work:

File: `lib/socket-provider.tsx` — already has:
- ✅ `milestone:updated` — invalidates `['milestones']`, `['engagements']`
- ✅ `payment:confirmed` — shows notification
- ✅ `dispute:filed` — shows notification
- ✅ `dispute:resolved` — shows notification

---

## 🧪 E2E Tests

### T18 — Admin Flow
Test: Admin views disputes → resolves one → verifies escrow released
```ts
// backend/test/T18-admin-flow.spec.ts
describe('T18 - Admin Dispute Resolution', () => {
  it('should list disputes in MANUAL_REVIEW');
  it('should resolve dispute with release decision');
  it('should verify escrow released and milestone APPROVED');
});
```

### T19 — Socket Events
Test: Verify all 4 socket events fire correctly
```ts
// backend/test/T19-socket-events.spec.ts
describe('T19 - Socket Event Emissions', () => {
  it('should emit milestone:updated on submission');
  it('should emit payment:confirmed on IPN milestone funding');
  it('should emit dispute:filed on dispute creation');
  it('should emit dispute:resolved on admin resolution');
});
```

---

## 🔧 Fix: BidForm 404 Route

File: `App.tsx` — add missing route for expert bid detail view:
```tsx
<Route path="bids/:bidId" element={<BidDetail />} />
```

And fix BidForm.tsx navigate target (line ~144):
```tsx
// Before (broken):
navigate(`/expert/bids/${bidId}`);
// After (fixed):
navigate(`/expert/engagements/${data.engagement.id}`);
```
