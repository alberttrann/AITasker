# Current Endpoints

## Health
### `GET /health`
- **Takes:** No payload
- **Returns:** `{ status: 'ok', service: 'aitasker-backend' }`

## Auth
### `POST /auth/register`
- **Takes:** `RegisterUserDto` (email, password, fullName, phone, roles, selfTechnical)
- **Returns:** User object and JWT access/refresh tokens

### `POST /auth/login`
- **Takes:** `LoginUserDto` (email, password)
- **Returns:** User object and JWT access/refresh tokens

### `PUT /auth/switch-role`
- **Takes:** `SwitchRoleUserDto` (activeRole)
- **Returns:** Updated User object with new active role

### `POST /auth/refresh`
- **Takes:** `{ refresh_token: string }`
- **Returns:** New JWT access and refresh tokens

### `POST /auth/register/handoff`
- **Takes:** `RegisterHandoffDto` (email, password, fullName, invite_token)
- **Returns:** Created User object and tokens

### `POST /auth/verify-tax-code`
- **Takes:** `VerifyTaxCodeDto` (taxCode)
- **Returns:** Verification status

### `POST /auth/claim-handoff`
- **Takes:** `{ invite_token: string }`
- **Returns:** Updated session claiming handoff

## Users
### `POST /users/me/add-role`
- **Takes:** `AddRoleDto`
- **Returns:** Updated User roles

### `GET /users/me`
- **Takes:** No payload
- **Returns:** Current User profile

### `PUT /users/me`
- **Takes:** `UpdateUserDto`
- **Returns:** Updated User profile

### `GET /users/{userId}/public-profile`
- **Takes:** `userId` (Param)
- **Returns:** Expert's public profile

### `PUT /users/me/tax-code`
- **Takes:** `UpdateTaxCodeDto` (taxCode)
- **Returns:** Updated User with tax code

## Wallet
### `GET /wallets/me`
- **Takes:** No payload
- **Returns:** Wallet balance for the user

### `GET /wallets/me/transactions`
- **Takes:** No payload
- **Returns:** List of wallet transactions

### `POST /wallets/virtual-accounts/topup`
- **Takes:** `WalletTopupAmmountDto` (amount)
- **Returns:** Topup link/QR details

## Withdrawals
### `POST /withdrawals`
- **Takes:** `CreateWithdrawalDto`
- **Returns:** Created withdrawal request
- **Note:** Request a cash-out to your linked bank account

### `GET /withdrawals`
- **Takes:** No payload
- **Returns:** List of own withdrawal request history

## Webhooks (SePay)
### `POST /webhooks/sepay/ipn`
- **Takes:** RawBodyRequest with headers `x-sepay-signature` and `x-sepay-timestamp`
- **Returns:** Success status for IPN handling

### `POST /webhooks/sepay/chi-ho-credit`
- **Takes:** Payload from Chi Ho
- **Returns:** `{ success: true }`

### `POST /webhooks/sepay/bank-linked`
- **Takes:** Payload from SePay
- **Returns:** `{ success: true }`

## Bank Hub
### `POST /bank-hub/initiate-link`
- **Takes:** `InitiateBankLinkDto` (bank_account_xid, holder_name)
- **Returns:** `{ success: true }`

## Subscriptions
### `POST /subscriptions/activate`
- **Takes:** `ActivateSubscriptionDto`
- **Returns:** Activated subscription details

### `GET /subscriptions/status`
- **Takes:** No payload
- **Returns:** Current subscription status

## Elicitation
### `POST /elicitation/sessions`
- **Takes:** No payload
- **Returns:** Newly created elicitation session

### `GET /elicitation/sessions`
- **Takes:** No payload
- **Returns:** List of sessions

### `GET /elicitation/sessions/active`
- **Takes:** No payload
- **Returns:** Active elicitation session for the user

### `PUT /elicitation/sessions/{id}/abandon`
- **Takes:** `id` (Param)
- **Returns:** Abandoned session

### `GET /elicitation/sessions/history`
- **Takes:** No payload
- **Returns:** Historical sessions

### `GET /elicitation/sessions/{id}`
- **Takes:** `id` (Param)
- **Returns:** Elicitation session detail

### `DELETE /elicitation/sessions/{id}`
- **Takes:** `id` (Param)
- **Returns:** Deletion success status

### `PUT /elicitation/sessions/{id}/stage1`
- **Takes:** `id` (Param), `Stage1Dto` (symptomText)
- **Returns:** Updated session in Stage 1

### `PUT /elicitation/sessions/{id}/stage2`
- **Takes:** `id` (Param), `Stage2Dto` (archetype, acknowledgedVoidCodes)
- **Returns:** Updated session in Stage 2

### `PUT /elicitation/sessions/{id}/stage3`
- **Takes:** `id` (Param), `Stage3Dto` (probeResponses)
- **Returns:** Updated session in Stage 3

### `PUT /elicitation/sessions/{id}/stage4`
- **Takes:** `id` (Param), `Stage4Dto`
- **Returns:** Updated session in Stage 4

### `PUT /elicitation/sessions/{id}/stage4-handoff`
- **Takes:** `id` (Param), `Stage4HandoffDto`
- **Returns:** Updated session transitioning to handoff

### `POST /elicitation/sessions/{id}/stage5`
- **Takes:** `id` (Param)
- **Returns:** Updated session in Stage 5

### `POST /elicitation/sessions/{id}/generate-handoff-link`
- **Takes:** `id` (Param), `{ email: string }`
- **Returns:** Invite link generated

### `PUT /elicitation/sessions/{id}/self-technical`
- **Takes:** `id` (Param), `SetSelfTechnicalDto` (selfTechnical: boolean)
- **Returns:** Updated session

### `POST /elicitation/sessions/{id}/retry-synthesis`
- **Takes:** `id` (Param)
- **Returns:** Session with synthesis retried

### `PUT /elicitation/sessions/{id}/revert`
- **Takes:** `id` (Param), `RevertSessionDto` (targetStage: number)
- **Returns:** Session reverted to target stage

### `PUT /elicitation/sessions/{id}/continue`
- **Takes:** `id` (Param)
- **Returns:** Resumed session

### `POST /elicitation/sessions/{id}/stage4-recommend`
- **Takes:** `id` (Param)
- **Returns:** Recommendations for tech context

### `PATCH /elicitation/sessions/{id}/draft`
- **Takes:** `id` (Param), `PatchSessionDraftDto` (symptomTextDraft)
- **Returns:** Session with updated draft

## Projects
### `GET /projects/{id}`
- **Takes:** `id` (Param)
- **Returns:** Project detail

### `GET /projects`
- **Takes:** Query param `slim` (boolean)
- **Returns:** List of projects

### `GET /projects/{id}/artifact-a`
- **Takes:** `id` (Param)
- **Returns:** Artifact A detail

### `GET /projects/{id}/artifact-b`
- **Takes:** `id` (Param)
- **Returns:** Artifact B detail

### `PUT /projects/{id}/name`
- **Takes:** `id` (Param), `{ projectName: string }`
- **Returns:** Updated project

## Matching
### `GET /matching/{projectId}/shortlist`
- **Takes:** `projectId` (Param), Query param `refresh` (boolean)
- **Returns:** List of matched experts (shortlist)

## Expert Profiles
### `GET /expert-profile/me`
- **Takes:** No payload
- **Returns:** Current expert profile

### `PUT /expert-profile/me`
- **Takes:** `UpdateExpertProfileDto`
- **Returns:** Updated expert profile

## Expert Domains
### `POST /expert-profile/domains`
- **Takes:** `UpsertDomainDepthDto`
- **Returns:** Created domain depth

### `PUT /expert-profile/domains/sync`
- **Takes:** `SyncDomainsDto`
- **Returns:** Synced domain depths

### `PUT /expert-profile/domains/{id}`
- **Takes:** `id` (Param), `UpsertDomainDepthDto`
- **Returns:** Updated domain depth

## Seam Claims
### `POST /expert-profile/seams`
- **Takes:** `UpsertSeamClaimDto`
- **Returns:** Created seam claim

### `PUT /expert-profile/seams/sync`
- **Takes:** `SyncSeamsDto`
- **Returns:** Synced seam claims

## Portfolio Submissions
### `POST /portfolio-submissions`
- **Takes:** `CreatePortfolioSubmissionDto`
- **Returns:** Portfolio submission object

### `GET /portfolio-submissions`
- **Takes:** No payload
- **Returns:** List of portfolio submissions

### `GET /portfolio-submissions/{id}`
- **Takes:** `id` (Param)
- **Returns:** Portfolio submission detail

## Listings
### `GET /services`
- **Takes:** Query `ListServicesFilterDto`
- **Returns:** List of service listings

### `POST /services`
- **Takes:** `CreateListingDto`
- **Returns:** Created listing

### `GET /services/{id}`
- **Takes:** `id` (Param)
- **Returns:** Listing detail

### `PUT /services/{id}`
- **Takes:** `id` (Param), `UpdateListingDto`
- **Returns:** Updated listing

### `POST /services/{id}/purchase`
- **Takes:** `id` (Param)
- **Returns:** Success status for purchase

## Engagements
### `GET /engagements`
- **Takes:** Query params `state`, `type`, `connectedAt`
- **Returns:** List of engagements

### `GET /engagements/{id}`
- **Takes:** `id` (Param)
- **Returns:** Engagement detail

### `PUT /engagements/{id}/accept-nda`
- **Takes:** `id` (Param)
- **Returns:** Engagement with NDA accepted

### `POST /engagements/{id}/connect`
- **Takes:** `id` (Param)
- **Returns:** Engagement connected

### `PUT /engagements/{id}/decline`
- **Takes:** `id` (Param)
- **Returns:** Engagement declined

## Bids
### `POST /bids`
- **Takes:** `CreateBidDto`
- **Returns:** Created bid

### `GET /bids/{id}`
- **Takes:** `id` (Param)
- **Returns:** Bid detail

### `PUT /bids/{id}`
- **Takes:** `id` (Param), `UpdateBidDto`
- **Returns:** Updated bid

### `PUT /bids/{id}/tech-review`
- **Takes:** `id` (Param), `TechReviewDto`
- **Returns:** Bid with tech review applied

### `PUT /bids/{id}/ceo-decision`
- **Takes:** `id` (Param), `CeoDecisionDto`
- **Returns:** Bid with CEO decision applied

### `PUT /bids/{id}/counter-offer`
- **Takes:** `id` (Param), `CounterOfferDto`
- **Returns:** Bid with counter-offer

## Disputes
### `POST /disputes`
- **Takes:** `CreateDisputeDto` (criterion_id, additional_context)
- **Returns:** Created dispute
- **Note:** File a dispute on an unverified acceptance criterion (milestone must be SUBMITTED or IN_REVISION)

### `GET /disputes`
- **Takes:** Query `state`
- **Returns:** List of disputes

### `GET /disputes/{id}`
- **Takes:** `id` (Param)
- **Returns:** Dispute detail

## Milestones
### `POST /milestones`
- **Takes:** `CreateMilestoneDto`
- **Returns:** Created milestone

### `GET /milestones/{id}`
- **Takes:** `id` (Param)
- **Returns:** Milestone detail, including criteria

### `PUT /milestones/{id}/fund`
- **Takes:** `id` (Param)
- **Returns:** Milestone status updated to AWAITING_PAYMENT

## DoD Checklist
### `POST /milestones/{id}/dod/items`
- **Takes:** `id` (Param), `CreateDodItemDto`
- **Returns:** Created DoD item

### `PUT /milestones/{id}/dod/{itemId}`
- **Takes:** `id` (Param), `itemId` (Param), `UpdateMilestoneDoDItemDto`
- **Returns:** Updated DoD status

## Acceptance Criteria
### `PUT /criteria/{id}/verify`
- **Takes:** `id` (Param), `VerifyCriterionDto`
- **Returns:** Criterion verified successfully

### `PUT /criteria/{id}/revision`
- **Takes:** `id` (Param), `RevisionNoteDto`
- **Returns:** Criterion requesting revision

## Submissions
### `POST /milestones/{id}/submit`
- **Takes:** `id` (Param), `CreateSubmissionDto`
- **Returns:** Milestone submission

### `POST /milestones/{id}/paygated-docs`
- **Takes:** `id` (Param), `StagePaygatedDocDto`
- **Returns:** Uploaded detailed technical document

### `GET /milestones/{id}/paygated-docs`
- **Takes:** `id` (Param)
- **Returns:** Downloadable unlocked document for TECH_TEAM/EXPERT

## Messages
### `GET /engagements/{id}/messages`
- **Takes:** `id` (Param), Query `limit`, Query `cursorId`
- **Returns:** Paginated chat history

### `GET /projects/{id}/messages`
- **Takes:** `id` (Param), Query `limit`, Query `cursorId`
- **Returns:** Pre-bid project Q&A thread

### `POST /messages/{id}/read`
- **Takes:** `id` (Param)
- **Returns:** Success marking message as read

### `GET /engagements/{id}/messages/unread-count`
- **Takes:** `id` (Param)
- **Returns:** `{ unread_count: number }`

## Reviews
### `POST /reviews`
- **Takes:** `CreateReviewDto`
- **Returns:** Created review

### `GET /reviews/{engagementId}`
- **Takes:** `engagementId` (Param)
- **Returns:** List of reviews

## Admin
### `PUT /admin/projects/{id}/suspend-spec`
- **Takes:** `id` (Param)
- **Returns:** Suspended project

### `PUT /admin/users/{id}/suspend`
- **Takes:** `id` (Param)
- **Returns:** Suspended user account

### `GET /admin/disputes`
- **Takes:** Query `state`
- **Returns:** List of disputes

### `PUT /admin/disputes/{id}/resolve`
- **Takes:** `id` (Param), `ResolveDisputeDto` (decision)
- **Returns:** Resolved dispute

### `GET /admin/decisions`
- **Takes:** Query `decisionType`, Query `entityType`
- **Returns:** Platform decisions log

### `GET /admin/transactions`
- **Takes:** Query `type`, Query `userId`
- **Returns:** Wallet transaction ledger

### `GET /admin/analytics`
- **Takes:** No payload
- **Returns:** Platform-wide computed aggregates

### `GET /admin/withdrawals`
- **Takes:** Query `status`
- **Returns:** Withdrawal requests queue

### `PUT /admin/withdrawals/{id}/complete`
- **Takes:** `id` (Param)
- **Returns:** Confirmed withdrawal

### `PUT /admin/withdrawals/{id}/fail`
- **Takes:** `id` (Param)
- **Returns:** Failed withdrawal
