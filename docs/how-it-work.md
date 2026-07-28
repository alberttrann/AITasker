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
