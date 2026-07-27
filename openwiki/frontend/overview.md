# Frontend (React 19)

## Purpose

The AITasker frontend is a single-page React application with role-segmented dashboards for CEOs, Experts, Tech Teams, and Admins. It uses lazy-loaded routes and a dual-layer state management approach.

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript 5.8 |
| Build | Vite 6 |
| Routing | React Router DOM v7 (`createBrowserRouter`) |
| Server State | TanStack Query v5 |
| Client State | Zustand v5 (with `persist` middleware) |
| HTTP Client | Axios (interceptors for auth + token refresh) |
| Real-time | Socket.io Client v4 |
| Styling | Tailwind CSS v4 + `tailwind-merge` |
| Forms | Formik + Yup |
| Charts | Recharts v3 |
| Icons | Lucide React |
| Animation | Motion (Framer Motion) |

## Feature Structure

The app is organized by user role rather than by domain:

```
src/
├── components/       Shared UI (auth modals, layout, messaging, notifications, wallet)
├── features/
│   ├── ceo/          CEO dashboard, elicitation wizard, marketplace, projects, shortlist
│   ├── expert/       Expert profile, bidding, services, verification, wallet/withdraw
│   ├── tech-team/    Bid review, project oversight, stage 4 technical input, vault
│   └── admin/        Analytics, CMS config (domains/seams/prompts), disputes, ledger, oversight
├── hooks/            26 TanStack Query hooks (one per domain entity)
├── store/            3 Zustand stores (auth, engagement, notifications)
├── lib/              API client, auth context, socket provider, route guards, utils
└── types/            Shared TypeScript type definitions
```

## Routing

### Route Architecture

```
/                               LandingPage (public)
/reset-password/:token          ResetPasswordPage (public)
/register/handoff/:token        HandoffRegister (invite-only, public)
/register/handoff/expired       LinkExpiredError (public)

/ceo/*                          CEO dashboard + sub-routes
/expert/*                       Expert dashboard + sub-routes
/tech-team/*                    Tech Team dashboard + sub-routes
/admin/*                        Admin dashboard + sub-routes

*                               ErrorPage (404)
```

### 3-Tier Guard System (`lib/route-guards.tsx`)

| Guard | Purpose |
|---|---|
| `AuthGate` | Full-screen spinner while `AuthProvider` calls `GET /users/me` on page load |
| `ProtectedRoute` | Redirects unauthenticated users to `/` |
| `RoleRoute` | Checks `activeRole`/`clientSubtype`; wrong-role users redirected to their own dashboard |
| `GuestRoute` | Redirects already-authenticated users away from public pages |

All route-level components are lazy-loaded via `React.lazy()` for code splitting.

## State Management

### TanStack Query (Server State)
- `staleTime: 30s`, `gcTime: 5min`, single retry (skips on 401/403/404)
- 26 domain-specific hooks in `src/hooks/` wrapping `useQuery`/`useMutation` + `apiClient` calls
- Optimistic cache updates for immediate UI feedback

### Zustand (Client State)

| Store | Purpose | Persistence |
|---|---|---|
| `auth.store` | Access/refresh tokens, `UserDto`, `activeRole`, `isAuthenticated` | localStorage (`aitasker-auth`) |
| `engagement.store` | Active engagement ID, per-engagement unread counts, `totalUnread` | In-memory only |
| `notifications.store` | Real-time notification array, unread badge count | localStorage (`aitasker-notifications`) |

Auth tokens are in Zustand (not TanStack Query) because they must be available **before** any query fires — they're used by the Axios request interceptor.

## API Integration

### Axios Instance (`lib/api-client.ts`)
- Base URL: `VITE_API_BASE_URL` (defaults to `http://localhost:3001`)
- Timeout: 15s
- Request interceptor: attaches `Authorization: Bearer <token>` from Zustand auth store
- **Token refresh queue**: when multiple requests fail with 401 simultaneously, only one refresh call is made; all queued requests are retried with the new token
- Excludes `/login`, `/register`, `/auth/refresh` from refresh retry to avoid infinite loops
- On total refresh failure: logs out and redirects to `/`

### Vite Dev Proxy
In development, `/api/*` requests proxy to `http://localhost:3001` with the `/api` prefix stripped. This avoids CORS issues during local development.

## Real-Time (Socket.io)

### SocketProvider (`lib/socket-provider.tsx`)
- Single persistent WebSocket connection keyed on `accessToken`
- Auto-disconnects on logout, reconnects on token change
- Event routing:
  - `message:new` → increments unread counts + adds notification
  - `bid:updated`, `milestone:updated`, `payment:confirmed`, `dispute:filed`, `dispute:resolved`, `portfolio:result` → adds notification
- Also triggers `queryClient.invalidateQueries` to keep server state fresh

## Key Source Files

- Router & route definitions: `/frontend/src/App.tsx`
- Entry point: `/frontend/src/main.tsx`
- API client: `/frontend/src/lib/api-client.ts`
- Route guards: `/frontend/src/lib/route-guards.tsx`
- Auth provider: `/frontend/src/lib/auth-context.tsx`
- Socket provider: `/frontend/src/lib/socket-provider.tsx`
- Zustand stores: `/frontend/src/store/`
- Query hooks: `/frontend/src/hooks/`
- Vite config: `/frontend/vite.config.ts`

## Change Checklist

- New page/route: add lazy import in `App.tsx`, add route under correct `RoleRoute`, create feature directory
- New API endpoint: add hook in `src/hooks/`, add types in `src/types/`
- New WebSocket event: add handler in `socket-provider.tsx`, update relevant store
- Auth flow changes: update `auth-context.tsx`, `auth.store.ts`, `api-client.ts` interceptor
- New Zustand store: prefer TanStack Query for server data; only use Zustand for client-only state with clear rationale
