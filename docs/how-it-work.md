# Frontend Architecture & How It Works

> Comprehensive documentation of the AITasker Frontend structure, state management, API integration, and type taxonomy.

---

## 1. Directory Structure Rules

| Directory | Purpose & Responsibility | Strict Placement Rules |
|---|---|---|
| `src/types/` | Pure type declarations, DTOs, Enums, and JSONB payload contracts. | All data contracts live here (`enums.ts`, `jsonb.types.ts`, `api.types.ts`, `ui.types.ts`). **No API calls, no Zustand stores.** |
| `src/store/` | Client-side reactive and persisted UI state using Zustand. | Stores browser state (`auth.store.ts`, `engagement.store.ts`, `notifications.store.ts`). **Only Zustand stores.** |
| `src/lib/` | Infrastructure, API clients, contexts, and pure helper utilities. | Includes `api-client.ts` (Axios interceptors), `utils.ts` (pure functions like `formatVND`, `groupConversationsByPartner`), `socket-provider.tsx` (WebSocket gateway), `auth-context.tsx`, `route-guards.tsx`. |
| `src/hooks/` | React Query custom hooks encapsulating all REST API calls. | All `useQuery` / `useMutation` hooks (`use-auth.ts`, `use-bids.ts`, `use-projects.ts`, etc.). **No type definitions or Zustand stores here.** |
| `src/features/` | Feature-scoped React UI components and pages. | Organized by domain/role (`ceo/`, `expert/`, `tech-team/`, `admin/`). **No inline state stores or misplaced DTO types.** |

---

## 2. Type Taxonomy (`src/types/`)

- **`enums.ts`**: Bounded string sets, state machine states (`ProjectState`, `BidState`, `MilestoneState`, `EngagementState`), role descriptors (`ActiveRole`, `UserRoleItem`, `ClientSubtype`), and domain/seam taxonomy types.
- **`jsonb.types.ts`**: Structured `JSONB` database payload shapes (`ArtifactA`, `ArtifactB`, `RequiredSeam`, `RequiredDomain`, `MilestoneFrameworkItem`, `FootprintAlignment`, `TechTeamReviewSignals`). Properties use `camelCase` to match NestJS response serialization.
- **`api.types.ts`**: DTOs for REST request/response contracts (`UserDto`, `ProjectDto`, `CapabilityBidDto`, `MilestoneDto`, `EngagementDto`, `ReviewDto`, `NotificationDto`, `BankLinkStatusDto`, etc.).
- **`ui.types.ts`**: View-layer component props and local UI types (`Toast`, `ToastVariant`, `AdminTableToolbarProps`, `FilterTab`, `MatchCardProps`).

---

## 3. State Management (`src/store/`)

- **`useAuthStore`** (`store/auth.store.ts`):
  - Manages JWT access/refresh tokens, active user profile (`UserDto`), active role (`ActiveRole`), and client subtype (`ClientSubtype`).
  - Persists identity to `localStorage` under key `'aitasker-auth'` for cross-refresh persistence.

- **`useEngagementStore`** (`store/engagement.store.ts`):
  - Tracks active engagement chat thread context and real-time unread message counts per engagement.
  - Automatically updated via Socket.io `newMessage` events.

- **`useNotificationsStore`** (`store/notifications.store.ts`):
  - Persists real-time notifications received via WebSocket push.
  - Synchronized with server-persisted notifications in `notifications` table.

---

## 4. API Integration & Real-time Layer (`src/lib/` & `src/hooks/`)

- **Axios Interceptor** (`lib/api-client.ts`):
  - Attaches Bearer JWT token to outgoing requests.
  - Automatically handles `401 Unauthorized` responses via token refresh (`/auth/refresh`) and queues failed requests.

- **Socket.io Gateway** (`lib/socket-provider.tsx`):
  - Establishes persistent WebSocket connection authenticated with Bearer token.
  - Listens for real-time events (`newMessage`, `bid:updated`, `milestone:updated`, `payment:confirmed`, `notification:generic`) and triggers invalidation of TanStack Query caches.

- **API Hooks** (`hooks/use-*.ts`):
  - Wrap TanStack Query (`useQuery`, `useMutation`).
  - Every hook function includes JSDoc comments detailing its system-level role ("global cause") so developers can easily understand component data dependencies.
  - Standardized query key invalidations (`invalidateQueries`) to drive reactive UI re-renders on mutations.
  - Subscription status queries (`useSubscriptionStatus`) are role-scoped by `activeRole` (e.g. `['subscriptionStatus', activeRole]`) and automatically invalidated on role switch (`switchRole`) to prevent Pro tier cache bleeding across Client/Expert roles.

---

## 5. UI Layout Conventions

- **Page Containers**: Outermost page wrappers enforce `w-full max-w-[1440px] px-6 mx-auto` for visual alignment with the top navigation bar.
- **Widget Grids**: 1 or 2 widgets span 50% width; 3 or 4 widgets split evenly (maximum 4 per row).

---

## 6. Act 3 Architecture: AI Expert Matching & Direct Invitations

- **Shortlist Retrieval (`useShortlist` / `ShortlistView.tsx`)**:
  - Fetches candidate experts via `GET /matching/:projectId/shortlist`.
  - Backend strips raw floating-point composite scores ($0.00–1.00$) to guarantee raw score privacy.
  - Candidates are sorted strictly by qualitative strength labels (`STRONG_MATCH` $\rightarrow$ `WEAK_MATCH`).
  - Candidate cards (`MatchCard.tsx`) render domain match indicators, gap maps (`gap_map`), and tech stack tags with continuous text wrap truncation (`truncate` / `break-words`).
  - Candidate modal (`MatchCard.tsx`) displays complete candidate profile including `contact_info` (email, phone), match strength badges, domain match levels, verified seam coverage (`EVIDENCE_BACKED`), and invitation action controls.
- **Force Refresh Shortlist (`GET /matching/:projectId/shortlist?refresh=true`)**:
  - `ShortlistView.tsx` triggers `refresh()` which calls backend cache eviction and FastAPI re-scoring.
  - FastAPI match engine filters experts exceeding the 4:1 claimed-to-verified seam ratio hard gate.
  - Returns updated cache (`source = 'FORCE_REFRESH'`) and updates React Query cache.
- **Real-Time WebSocket Sync (`SocketProvider`)**:
  - Listens for `notification:generic` events with invitation payload (`type === 'invitation'` or title containing `'Invitation'`).
  - Automatically invalidates `['invitations']` and `['shortlist']` TanStack Query keys on mount and on push event.
  - Ensures CEO shortlist cards and Expert project invitation feeds update in real time without requiring manual page refresh.
- **Invitation Decline Lifecycle (UC085 - `ExpertProjectsPage.tsx`)**:
  - Replaces raw `window.confirm` browser alerts with styled `ConfirmModal`.
  - Dispatches `POST /invitations/:id/decline` mutation upon confirmation, setting `status = 'DECLINED'` and invalidating invitation queries.
- **Milestone Budget Resolution (`ConditionalPricing.tsx` / `BidForm.tsx`)**:
  - Prioritizes `payment_amount_vnd` / `paymentAmountVnd` first over legacy `estimated_cost_vnd`.
  - Uses logical OR (`||`) evaluation to bypass zero values, correctly displaying CEO milestone budgets (e.g. 1.000.000 ₫) in Expert bidding views.
- **Wallet Transaction History Formatting (`TransactionHistory.tsx`)**:
  - Adds explicit support for `PLATFORM_FEE` transaction logs with purple badge styling.
- **Admin Analytics Dashboard (`AnalyticsDashboard.tsx`)**:
  - Displays all metrics returned by `GET /admin/analytics`: milestone completion rate, elicitation completion rate, portfolio approval rate, dispute rate, and AI auto-resolution efficiency.
  - Added visual breakdown section for `active_projects_by_archetype_tier`, resolving raw archetype codes (e.g. `MINIMAL_AGILE`) into full human-readable names (e.g. `Minimal Agile Prototype`) via `useArchetypes()` configuration hook.
- **Admin Dispute Monitor (`DisputeMonitor.tsx`)**:
  - Standardized to use the shared `<AdminTableToolbar>` and `<DataTable>` reusable layout components matching `UserList.tsx` and `IntegrityMonitor.tsx`.
  - Set initial default filter state to `ALL` with `ALL` placed at the leftmost tab position (`['ALL', 'MANUAL_REVIEW', 'AUTO_RESOLVED', 'RESOLVED']`).
- **Admin Withdrawal Requests (`WithdrawalRequests.tsx`)**:
  - Standardized to use the shared `<AdminTableToolbar>` and `<DataTable>` reusable layout components matching `UserList.tsx` and `IntegrityMonitor.tsx`.
  - Set initial default filter state to `ALL` with `ALL` placed at the leftmost tab position (`['ALL', 'PENDING', 'COMPLETED', 'FAILED']`).
- **Tech Team Routes & Projects Page (`TechTeamProjectsPage.tsx` / `TechTeamDashboardOverview.tsx`)**:
  - Fixed `GET /engagements/tech-team → 400` error by updating `use-search.ts` to call `GET /engagements`.
  - Separated `/tech-team` index (rendering `TechTeamDashboardOverview` with greeting banner and workspace widgets) from `/tech-team/projects` (rendering `TechTeamProjectsPage`).
  - Standardized `/tech-team/projects` to exclude the greeting and workspace widgets, adding a back arrow button, "Linked Projects" title, and `<DataList>` with **Order by** dropdown sorting matching `http://localhost:5173/ceo/projects`.

- **Platform Revenue Settings (`PlatformSettings.tsx`)**:
  - Updated page header icon to use `<Banknote>` (bill icon matching sidebar navigation item).
  - Added a Total Revenue summary banner calculating total accumulated platform revenue since the earliest transaction date (or selected custom start date).
- **Dynamic DiceBear Notionists Avatar System (`UserAvatar.tsx`)**:
  - Upgraded `<UserAvatar>` (`src/components/ui/UserAvatar.tsx`) to use **DiceBear Notionists** (`https://api.dicebear.com/9.x/notionists/svg?seed=${id}`).
  - Provides clean, minimalist Notion-style hand-drawn vector character portraits.
  - Seeded strictly by user `id` for 100% deterministic, permanent avatar artwork across all 19 application locations (including CEO & Expert Wallet pages).



















