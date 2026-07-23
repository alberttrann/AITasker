# AITasker Frontend - How It Works

This document serves as the living reference for the Frontend architecture, component logic, and API integration flows. It must be continuously updated by the AI agent as new features are built or discovered.

## 1. Core Architecture & Libraries
- **Framework**: React 19 + Vite
- **Routing**: React Router v7 (createBrowserRouter) with lazy loading code-splitting.
- **Styling**: Tailwind CSS v4.
- **Global State**: Zustand (for client-side persisted state like Auth tokens).
- **Server State**: TanStack React Query v5 (for caching, refetching, and synchronizing with the backend).
- **HTTP Client**: Axios with interceptors.

---

## 2. Authentication & Authorization Flow

### State Management (src/store/auth.store.ts)
Zustand is used to persist the core authentication data to localStorage.
- Stores ccessToken, 
efreshToken, and basic user info (ctiveRole, clientSubtype, isAuthenticated).
- Has methods to setTokens, setUser, switchRole, and logout.

### API Interceptors (src/lib/api-client.ts)
- **Request**: Automatically attaches Authorization: Bearer {accessToken} if the user is logged in.
- **Response**: Listens for 401 Unauthorized. If it encounters a 401 and it's not a login/register request, it will pause incoming requests, call POST /auth/refresh with the efreshToken, save the new tokens to Zustand, and replay the paused requests transparently.

### Route Guards (src/lib/route-guards.tsx)
- **GuestRoute**: Protects /login and /register. If an authenticated user tries to access these, they are redirected to their respective dashboard.
- **ProtectedRoute**: Ensures the user is authenticated. If not, redirects to /.
- **RoleRoute**: Verifies  ctiveRole (e.g. EXPERT, ADMIN) or clientSubtype (e.g. CEO, TECH_TEAM). If a user tries to access a dashboard they don't have access to, they are safely redirected back to their own role's home path.

---

## 3. Main Business Flows (Frontend Perspective)

### MF-1: Client (CEO) Registration & Subscription
Based on `08-mainflows_redo.md` specs.
1. **Registration**: 
   - Uses `useMutation` from `use-auth.ts` (`register` function).
   - Component calls `POST /auth/register` with `roles: 'CLIENT_CEO'`.
   - On success, the response contains `access_token` and `refresh_token`, which are saved to `localStorage` via Zustand (`useAuthStore.getState().setTokens`).
   - A subsequent `GET /users/me` fetches user details, saves to Zustand, and `redirectByRole` dynamically routes the user to `/ceo`.
2. **Dashboard Overview**: 
   - Component: `CeoOverview`.
   - Wallet state is fetched via `useWallet()` which calls `GET /wallets/me`.
   - Subscription state is fetched via `useSubscriptionStatus()` which checks `GET /subscriptions/status` to determine `tier`, `isActive`, and `expiresAt`.
   - A unified `Widget` component renders combined dashboard metrics: the **Elicitation Engine** status (stage number or ready) and **Active Projects** stats (which computes "new bids to review" by checking engagements where a capability bid has been submitted or has passed technical review).
3. **Projects and Bids Management**:
   - Component: `ProjectsPage` / `ProjectDetailPage` / `CeoBidList` / `ShortlistView`.
   - The main `ProjectsPage` shows a list of the CEO's projects with a single action: "View Details".
   - In `ProjectDetailPage`, the CEO can view and manage the project's milestones (`milestoneFrameworkJson`) before engaging an expert. The inline milestone editor allows adding, editing, and deleting AI-suggested milestones. Upon saving, it calls the `useUpdateProjectMilestones` hook which will hit `PUT /projects/:id/milestones`.
   - The user can also navigate to the shortlist via "Match Shortlist" (routing to `/ceo/projects/:id/shortlist`) or view bids via "View Experts bids" (routing to `/ceo/projects/:id/bids`).
   - `CeoBidList` lists all submitted capability bids for a specific project.
4. **Subscription**:
   - Component: `SubscriptionManagement` / `SubscriptionPlans`.
   - The user selects "Client Pro". `activateSubscription` mutation (`use-subscription.ts`) calls `POST /subscriptions/activate`.
   - Upon success, the queries for `['user']` and `['subscriptionStatus']` are invalidated, forcing the UI to refetch the updated Pro tier and unlock matching/elicitation features.

### MF-2: Expert Profile & Verification
1. **Registration**: 
   - Uses `register` mutation (`use-auth.ts`) with `roles: 'EXPERT'`. After storing tokens, `redirectByRole` routes the user to `/expert`.
2. **Profile Dashboard**: 
   - Component: `ExpertProfilePage.tsx`. This acts as the central hub for the expert to view their profile. It checks for missing parts (domains, seams, bio, stack) and prompts the user to complete them.
   - Depends heavily on the `useExpertProfile()` hook which queries `GET /expert-profile/me`.
3. **Building the Profile**:
   - The user opens the `ProfileBuilder` modal to add taxonomy data.
   - **Domains**: Fetches dynamic domains via `useDomains()` (from `use-config.ts`), saves them using `saveDomains` mutation (`PUT /expert-profile/domains/sync`).
   - **Seams**: Saves claims via `saveSeams` (`PUT /expert-profile/seams/sync`).
   - **General Info**: Saves bio, `engagementModel`, and `stackTagsJson` using `saveStackAndModel` (`PUT /expert-profile/me`).
4. **Tier Verification**:
   - Seams start at `CLAIMED` tier. In `ExpertProfilePage`, a "Verify a Seam" button switches the view to `PortfolioSubmitForm`.
   - If a seam is verified (`EVIDENCE_BACKED`), an "AI Verified" badge is displayed. If a seam fails verification, the `ExpertProfilePage` shows "Locked until {date}".

### MF-3: Admin Configuration & Dynamic Elicitation
1. **Admin Management**: 
   - Admins access the `/admin/config` area to manage system configurations including **Subscription Packages**, **Domain & Seam Configurations**, and **Archetypes & Probes**.
   - Component: `ArchetypeConfigPage.tsx` and `DomainSeamConfigPage.tsx`. Uses native HTML5 drag-and-drop API (`onDragStart`, `onDrop`, etc.) to visually reorder list items before saving the new sequence to the backend.
   - Core configuration entities (Domains, Seams, Archetypes, Probes) manage their active lifecycle via boolean "Pill Switches" (`isActive`), effectively hiding them from users without performing destructive database deletions. Destructive "Delete" buttons are only reserved for strictly isolated data like unpurchased Subscription Packages.
   - Admin APIs: `GET /admin/config/archetypes` and `GET /admin/config/probe-questions?archetypeCode=X`.
2. **Dynamic Elicitation (CEO Flow)**:
   - Previously hardcoded logic in `use-elicitation.ts` is now dynamically driven by the database via `use-config.ts` hooks (`useArchetypes`, `useProbeQuestions`).
   - Component `Stage2Archetype.tsx`: Maps over the DB archetypes and renders the selection UI.
   - Component `Stage3Probes.tsx`: Fetches the dynamic list of probe questions for the selected archetype. It utilizes a `useReducer` to manage the state of the dynamically generated form inputs and validates answers before calling `submitStage3` which expects `probeResponses: Record<string, string>` where the key is the exact `questionText`.

### MF-4: Expert Service Creation & AI Auto-Generator
1. **Dynamic Input Builder (`ServiceCreateModal.tsx`)**:
   - Replaced flat textareas for "Scope of Work" and "Estimated Timeline" with structured, dynamic item builders (`scopeItems` as `string[]`, and `timelinePhases` as `{name, duration}[]`).
   - Users can dynamically add/remove deliverables and timeline phases. When saving or previewing, `getMergedScope()` serializes deliverables into a clean JSON array string, while `getMergedTimeline()` compiles phases into structured newline-delimited text (`Phase X: Name (Duration)\nTotal Estimated Time: Y`).
2. **AI Pre-fill & Parsing (`parseArrayOrString`)**:
   - When an expert uses "Auto-generate with AI" (`useAiGenerator: true`), `createService.mutate` receives raw AI output strings.
   - The robust helper `parseArrayOrString` automatically detects standard JSON arrays, Python list syntax (`['...']`), or newline-delimited text from the AI output and cleanly distributes each deliverable and timeline phase into separate dynamic input boxes for seamless manual review.

### MF-5: Expert Portfolio Submission & Verification History
1. **Portfolio Evidence Evaluation (`usePortfolio` in `use-portfolio.ts`)**:
   - Sends Tier 2 verification evidence to `POST /portfolio-submissions` with payload schema `{ seamClaimId, projectDescription, decisionPoints }`.
   - The backend runs AI evaluation (`/llm/portfolio-eval`) and returns evaluation results (`llmConfidence`, `advisoryNote`, `status`).
2. **Verification History (`VerificationHistoryPage.tsx`)**:
   - Fetches historical submissions via `GET /portfolio-submissions` (`useMyPortfolioSubmissions()`).
   - Renders individual submission cards with status badges, an interactive `llmConfidence` progress bar, and AI diagnostic feedback (`advisoryNote`).
   - Accessible via `/expert/service/expert-profile/verification-history` directly from the **Seam Claims** header.

### MF-6: CEO Shortlist & Expert Invitation Match Diagnostics (`MatchCard.tsx`)
1. **Domain & Seam Label Resolution**:
   - Resolves dynamic human-readable names for domain and seam codes via `useDomains()` and `useSeams()` hooks (`getDomainLabel`, `getSeamLabel`), ensuring the invite modal displays full names alongside codes (e.g., `Enterprise Applications (A)`, `Fine-Tuned Apps (A↔D)`).
2. **Domain Match Depth Analysis**:
   - Evaluates expert domain depths against project required domains (`useProject(projectId)`) using numeric depth weighting (`EXPERT`/`AUTHORITY` = 3, `PROFICIENT`/`PRACTITIONER` = 2, etc.).
   - Assigns a structural match categorization: Full Match (meets/exceeds depth), Partial Match (below required depth), Gap (missing required domain), or Additional (extra domain expertise not explicitly required).
   - Displays match status indicators on the shortlist card summary and full breakdown rows inside the **Invite Expert** modal, directly driving the CEO's selection decision.

### MF-7: CEO Project Bids Notification Badges (`ProjectsPage.tsx` & `ProjectDetailPage.tsx`)
1. **Project List Item Badge (`ProjectsPage.tsx`)**:
   - The animated pulsing red dot alerting the CEO to new bids (`SUBMITTED` or `TECH_REVIEW_PASSED` state) is rendered directly on the **View Details** action button of the project card rather than next to the project title.
2. **Project Detail Numeric Bids Badge (`ProjectDetailPage.tsx`)**:
   - Computes `activeBidsCount` from project engagements.
   - When `activeBidsCount > 0`, renders a solid numeric badge at the top-right corner of the **View Experts bids** button displaying the exact count of submitted/pending bids.
   - When `activeBidsCount === 0`, no badge is rendered.

---

## 4. Component Architecture
- **Dashboards (src/features/*)**: Code is sliced by role. `admin`, `ceo`, `expert`, and `tech-team` all have their own isolated modules and overview components. Feature components contain ZERO inline Axios calls, `useQuery`, or `useMutation` definitions; they strictly consume custom hooks.
- **Data Fetching (src/hooks/*)**: All API calls are encapsulated in centralized custom React Query hooks organized by entity (e.g., `use-projects.ts`, `use-bids.ts`, `use-elicitation.ts`, `use-engagements.ts`, `use-admin-config.ts`). **Rule:** API actions must stay in `hooks/`. No component should import `apiClient` directly.
- **Type Definitions (src/types/*)**: Interface definitions and enums are separated from business logic. **Rule:** Enums and interfaces must stay in `types/` (e.g., `api.types.ts`, `admin.types.ts`, `bids.types.ts`). Feature components import types instead of defining them inline.
- **Global Store (src/store/*)**: Centralized state management using Zustand for session data (e.g., `auth.store.ts` for JWT tokens/roles, `wallet.store.ts` for balances). **Rule:** Never import `useAuthStore` directly in feature components. Instead, always use the `useAuth()` hook which wraps auth store values and provides mutation methods cleanly.
- **Lazy Loading (src/App.tsx)**: All major feature pages are lazy-loaded using `React.lazy` to ensure the initial JavaScript bundle remains small and performant.

---

## 5. Global Layout Constraints & Responsive Architecture
- **Width Standardization**: All main feature layout wrappers (`CeoDashboard.tsx`, `ExpertDashboard.tsx`, `TechTeamDashboard.tsx`, `AdminDashboard.tsx`) enforce a strict authoritative `max-w-[1440px] px-6 mx-auto` rule on their `<main>` content wrappers.
- **Child Page Delegation**: Nested child pages (e.g., `UserProfilePage`, `ExpertServicesPage`) avoid defining redundant inner `max-w-[1440px] px-4` wrappers so padding is governed solely by the dashboard shell across mobile (`px-4 sm:px-6`) and desktop screens without double gutters.
- **Responsive Breakpoint Strategy**:
  - **Mobile (`< 640px`)**: Multi-column grids (`grid-cols-2`, `grid-cols-4`) collapse to single-column (`grid-cols-1`). Modals scale fluidly (`w-full max-w-[95vw] sm:max-w-md`).
  - **Tablet (`640px - 1024px`)**: Dashboard cards and metrics use 2-column grids (`md:grid-cols-2`).
  - **Desktop (`1024px - 1440px`) & Ultra-Wide (`> 1440px`)**: Full multi-column layout centered within the `max-w-[1440px]` shell.
- **Data Tables**: Wide data tables (`<table>`) are wrapped in `<div className="overflow-x-auto w-full">` so horizontal overflow scrolls smoothly on smaller screens without breaking the page wrapper.
- **Back Navigation Standardization**: All header back navigation buttons across CEO, Expert, Tech Team, and Admin pages adhere strictly to a clean **no-box** design. Where buttons are icon-only (`<ArrowLeft size={20} />`), they use `<button className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer">`. Where buttons include accompanying text along with the arrow (e.g., "Back to Bids", "Back to Profile"), they use `<button className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer">`. Background padding boxes (`p-2`, `hover:bg-slate-200`), borders (`border border-slate-200`), and outline boxes around back arrows are prohibited for visual cleanliness and consistency.

---

## 6. TopNav & Global Spotlight Search (`SpotlightSearch.tsx`)
The global TopNav search bar (`src/components/layout/SpotlightSearch.tsx`) provides an instant, interactive Command Palette / Spotlight search overlay tailored dynamically to `user.activeRole`:
- **Strict Role-Gated Query Execution**:
  - Every data query inside `SpotlightSearch.tsx` uses TanStack React Query with strict `enabled: isAuthenticated && activeRole === '...'` conditions.
  - This ensures that non-admin or role-unauthorized endpoints (`/admin/users`, `/invitations`, `/engagements/tech-team`) are **never** executed for unauthorized roles, eliminating 400 and 403 API errors.
- **Role-Aware Placeholders & Results**:
  - **CEO (`CLIENT_CEO`)**: Searches Projects (`GET /projects?slim=true`) and Expert Service Packages (`GET /services`).
  - **Expert (`EXPERT`)**: Searches Project Invitations (`GET /invitations`), Active Workspace Engagements (`GET /engagements`), and Service Listings.
  - **Tech Team (`TECH_TEAM`)**: Searches Assigned Technical Workspaces (`GET /engagements/tech-team`).
  - **Admin (`ADMIN`)**: Searches Platform Users (`GET /admin/users` by email/name) and Disputes (`GET /admin/disputes`).
- **Interaction & Visual Design**:
  - Clean text-focused search result rows (no leading decorative icons) displaying title, subtitle, and category badge.
  - Opens automatically when focused and input length >= 1 character.
  - Pressing `Escape` closes the overlay and blurs the input.
  - Clicking any search result instantly navigates to that specific entity and clears the query.
- **Role Navigation Suppression (`TopNav.tsx`)**:
  - When `user.activeRole === 'ADMIN'`, TopNav hides its entire bottom horizontal navigation bar (`Row 2`) to avoid duplicating links from the Admin portal's dedicated vertical sidebar (`AdminLayout.tsx`).

---

## 7. Admin User Management (`UserList.tsx` & `/admin/users`)
The Admin User Management console (`src/features/admin/accounts/UserList.tsx`) mapped to route `/admin/users` provides platform administrators with full visibility and lifecycle control over accounts:
- **API Integration (`useAdminUsers`)**:
  - Calls `GET /admin/users` with query parameters (`page`, `limit`, `role`, `isActive`, `search`).
  - Supports API-level pagination alongside instant client-side filtering fallback for responsive multi-attribute filtering.
- **Interactive Filtering & Controls**:
  - **Role Pill Tabs**: Filter accounts by `All Roles`, `CEO` (`CLIENT_CEO`), `Expert` (`EXPERT`), `Tech Team` (`TECH_TEAM`), or `Admin` (`ADMIN`).
  - **Status Filter**: Toggle between `All`, `Active`, and `Suspended` accounts.
  - **Search**: Search accounts by partial match on email or full name.
- **Account Actions**:
  - Suspend (`PUT /admin/users/:id/suspend`) or Reactivate (`PUT /admin/users/:id/reactivate`) accounts with confirmation modals.

## 8. Real-Time Messaging & Deduplicated Conversation Threads
The messaging system across the platform (`/ceo/engagements/:id/messages`, `/expert/engagements/:id/messages`, and the TopNav messages popover) utilizes real-time socket rooms (`useSocket`) coupled with TanStack React Query (`useMessages`, `useConversations`):
- **Conversation Deduplication (`groupConversationsByPartner`)**:
  - The raw `/conversations` API returns one item per engagement/thread. To prevent a single counterparty (e.g., `Nhan Expert`) from duplicating across the left inbox sidebar and TopNav popover, the frontend passes raw conversations through `groupConversationsByPartner` in `src/hooks/use-messages.ts`.
  - This helper groups threads by `otherParty.id` (or `fullName`), selecting the engagement with the newest message (`primaryEngagementId`) while accumulating total unread counts across all shared threads.
- **Header Thread Dropdown Switcher (`MessageThread.tsx`)**:
  - Because multiple threads (`Direct Chat`, Service Orders, Project Connections) can exist with the same deduplicated partner, `MessageThread.tsx` filters `conversationsResponse.data` for all threads matching the current counterparty.
  - A responsive `<select>` dropdown right inside the chat header allows users to switch between threads on the fly. Selecting a thread routes directly to `/engagements/:id/messages`, joining the corresponding socket room (`joinRoom`).

## 10. TopNav Two-Row Navigation Architecture (`TopNav.tsx`)
The platform navigation across non-admin roles (`CLIENT_CEO`, `EXPERT`, `TECH_TEAM`) is governed centrally by `src/components/layout/TopNav.tsx` structured into two primary horizontal rows:
- **Row 1 (`Brand & Utility Bar`)**:
  - **Left**: `AITasker` brand mark and logo with hover accent indicator.
  - **Center**: `SpotlightSearch` command bar providing role-gated instant query search.
  - **Right (`Auth-Aware Controls`)**: Holds interactive circular utility buttons (**Wallet Balance Dropdown**, **Notification Bell** with solid numeric unread pill/badge, and **Messages Popover** with solid numeric unread pill/badge displaying counts up to `99+`) along with the **User Avatar Profile Dropdown** (`Account`, `Services`/`Projects`, `Switch to Client/Expert`, `Become a Client/Expert`, `Upgrade to Pro`, `Sign Out`).
- **Row 2 (`Role Navigation Tabs`)**:
  - Positioned directly below Row 1 (`border-t border-primary/10 bg-primary-bg/95 backdrop-blur-md`).
  - Inspects `user.activeRole` and `user.clientSubtype` to dynamically render high-visibility navigation links:
    - **CEO (`CLIENT_CEO`)**: Overview (`/ceo`), Projects (`/ceo/projects`), Marketplace (`/ceo/marketplace`), Plans (`/ceo/plans`).
    - **Expert (`EXPERT`)**: Overview (`/expert`), Services (`/expert/service`), Plans (`/expert/plans`), Messages (`/expert/messages`).
    - **Tech Team (`TECH_TEAM`)**: Overview (`/tech-team`), Projects (`/tech-team/projects`), Submitted (`/tech-team/submitted`), Bids (`/tech-team/bids`).
  - **Admin Row 2 Suppression**: If `user.activeRole === 'ADMIN'`, Row 2 returns `null` because the Admin portal utilizes a dedicated vertical layout sidebar (`src/features/admin/AdminLayout.tsx`).

---

## 11. Bid Negotiation & Counter Offers (MF-8)
- **Interactive Offer Flow**: 
  - The negotiation of capability bids (`CeoDecision.tsx`, `CounterOfferPanel.tsx`, `BidRevision.tsx`) supports interactive revision cycles instead of a flat accept/reject model.
  - CEOs can issue a counter-offer (`POST /bids/:id/offers`) with structured milestone modifications or pricing adjustments.
  - Experts receive the counter-offer (`CounterOfferReceived.tsx`) and can formally `Accept` (locking the terms into the DB atomically) or `Decline`.
- **Conditional Pricing**:
  - `ConditionalPricing.tsx` allows experts to outline variable pricing scenarios based on undefined project scope variables, keeping negotiations transparent.

## 12. Tech Team Project & Milestone Flow (MF-9)
- **Tech Team Workspaces**: 
  - `TechTeamProjectsPage.tsx` and `TechTeamProjectDetailPage.tsx` provide linked tech team users a specialized view into a project's technical deliverables without exposing CEO-level financial mechanics.
  - **Milestone & Criteria Verification**: `CriteriaVerify.tsx` and `RevisionRequest.tsx` allow tech team members to systematically verify acceptance criteria. Submitting a revision moves the milestone state to `IN_REVISION`.
  - **Pay-Gated Document Access**: Tech Team can access deliverables via `GET /milestones/:id/paygated-docs` once a milestone is completed, ensuring secure escrowed handoffs.

## 13. Pre-Bid & Milestone Chat Integration (MF-10)
- **Contextual Threading (`MilestoneChatPanel.tsx`)**:
  - Instead of forcing all communication into the generic inbox, users can discuss specific milestones contextually via floating side-panels bound to `projectId` or `milestoneId`.
  - Driven by the NestJS Socket.io backend and `use-messages.ts` / `use-projects.ts` hooks.
- **AI Milestone Chat Assistant (`MilestoneChatAssistant.tsx`)**:
  - Provides AI-assisted dialogue dynamically for drafting, refining, and generating milestones within the UI, interacting with `POST /projects/:id/milestone-chat`.

## 14. Authentication, Config Caching, and Admin UI Lessons (MF-1 & MF-2)
- **Elicitation Access Control (`useElicitationSessions`)**:
  - Free tier users are blocked from accessing the AI elicitation engine. The `useElicitationSessions` hook enforces this client-side using `enabled: !!user && user.activeRole === 'CLIENT' && user.subscription_client_tier === 'pro'`. This prevents `403 Forbidden` API errors from firing unconditionally on dashboard load.
- **Global Auth Sign-Out Race Condition (`TopNav.tsx`)**:
  - The `confirmSignOut` handler must `await logout()` before triggering `navigate('/')`. Because `use-auth.ts` calls `POST /auth/logout` asynchronously to clear the backend's `refresh_token_hash`, failing to `await` it causes a race condition where the router navigates away while local state is still authenticating, resulting in UI glitches.
- **Admin Config Global Cache Invalidation (`useSaveAdminConfigItem`)**:
  - Modifying global configurations (Domains, Seams) updates the isolated `['admin-config']` cache, but it MUST also explicitly call `qc.invalidateQueries({ queryKey: ['config-all'] })`.
  - The `useConfigAll()` query (which powers global dropdowns like `useDomains`) has a 24-hour `staleTime`. Without this invalidation, Admin UI creation forms (like creating a Seam after just creating a Domain) will serve stale selections.
- **Admin Error Toast Binding (`DomainSeamConfigPage.tsx`)**:
  - Creating duplicate Domain/Seam codes throws a `409 Conflict` from the backend. The custom hook `useSaveAdminConfigItem` forwards the `onError` callback from the mutation options so that pages can capture the error and display it using the global `useToastActions()`.
- **Admin Subscription Package Validation Constraints**:
  - Currently, `PUT /admin/subscriptions/packages/:id` uses an inline object type (`{ priceVnd?: number; ... }`) instead of a robust DTO class. Because it bypasses the NestJS `class-validator` pipeline (e.g. `@Max()`), the backend natively lacks upper-bound price checks.

# 15. Lessons Learned: React Query Cache Invalidation & Routing Loops
- **Elicitation Access Control**: `useElicitationSessions` enforces `CLIENT` and `pro` tier eligibility client-side to prevent 403 errors on load.
- **Auth Logout**: `logout()` must be awaited to prevent race conditions where tokens are cleared while the router is still navigating.
- **Cache Invalidation**: Modifying Admin configurations must explicitly trigger `qc.invalidateQueries(['config-all'])` to clear stale `staleTime` data.
- **Admin Error Binding**: Mutation `onError` callbacks are forwarded to capture `409 Conflict` errors for toast displays.

## 15. Lessons Learned: React Query Cache Invalidation & Routing Loops
- **The Stale Cache Routing Loop**: When manually updating server-side state (like reverting a session stage via PUT /elicitation/sessions/:id/revert), it is critical to explicitly invalidate the corresponding React Query cache (queryClient.invalidateQueries({ queryKey: ["elicitation", "session", sessionId] })).
- **Auto-Forwarding Trap**: In multistep wizards (e.g., ElicitationWizard), child components like Stage4ScenarioB often mount and fetch session data to determine their internal state or auto-forward if they detect the session has already advanced. If the cache is stale (still showing currentStage = 5 because the invalidation was missed during the revert to Stage 4), the child component will instantly trigger its auto-forwarding logic. This creates an inescapable infinite loop routing the user straight back to the failed gate. Always pair state-reverting mutations with strict cache invalidations before the UI rerenders.

## 16. Lessons Learned: Role Inference & Frontend Workarounds (MF-8 & UI)
- **Strict Frontend Boundary Enforcement**: When encountering missing fields in backend responses (e.g., clientSubtype missing from msg.sender in chat histories), we must prioritize frontend derivation logic over modifying backend payloads. This prevents accidental regressions in backend payload schemas or database queries.
- **Deducing Tech Team Roles in Chat**: In MessageThread.tsx, the backend returns activeRole: "CLIENT" for both the CEO and the Tech Team member. Instead of modifying the backend DTO to include clientSubtype, we deduce the Tech Team role purely on the frontend by comparing the sender's ID (msg.senderId) against the CEO's ID associated with the engagement (engagement.clientId). If activeRole === "CLIENT" but the ID does not match the CEO's ID, they are identified as the TECH_TEAM member, allowing the UI to accurately label the sender's role context.

## 17. Tech Team Handoff Registration (MF-3)
- **Handoff Link Generation (`Stage4ScenarioB.tsx`)**:
  - The CEO generates a secure, single-use invite link for their tech lead via `useElicitation().inviteTechTeam`. This creates a JWT bound to the specific `sessionId` on the backend.
  - The UI explicitly handles state where the invite was sent, polling the backend for stage completion (since the backend doesn't currently push WebSocket notifications for this specific event).
- **Tech Team Registration & Claiming (`HandoffRegister.tsx`)**:
  - The component decodes the JWT token natively on the frontend (`decodeJwt`) to pre-fill and lock the email address input, preventing users from registering the handoff link with a different email.
  - Supports two distinct paths:
    - **New Users**: Validates strict password rules locally, calls `POST /auth/register/handoff`, and seamlessly transitions into the OTP verification flow (`isOtpMode`).
    - **Existing Users**: Detects if an active session exists. If the logged-in user's email matches the handoff token, they can simply click "Accept" to call `POST /auth/claim-handoff`, instantly linking their profile to the CEO and project without needing to re-register.
  - Handles expired tokens securely by redirecting to an explicit `/register/handoff/expired` error route.

## 18. Elicitation Engine Enhancements (MF-4)
- **Advisory Warnings (`Stage3Probes.tsx`)**:
  - The UI now handles `vague_answers` and `irrelevant_answers` as non-blocking advisory warnings. If the backend proceeds and increments the session stage (`data.advanced === true`), the frontend treats the warnings purely as information without locking the user.
- **Critical Artifacts Banner (`Stage4ScenarioA.tsx`)**:
  - If the AI identifies missing required artifacts (`missingArtifactsWarning`), the frontend intelligently renders a confirmation modal ("Incomplete spec — proceed anyway?"). This maintains high data quality without hard-blocking the CEO from advancing.

*(This document is a living record and will be expanded as we touch more components.)*