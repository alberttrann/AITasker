# AITasker UI Audit Checklist

This document tracks the detailed UI and integration audits across all main flows. Use this checklist to verify that the frontend behaves correctly according to the backend constraints, for both happy paths and edge cases.

---

## MF-1: CEO Registration, Auth & Subscription

### Phase A: Registration (`POST /auth/register`)
**Happy Path:**
- [ ] Submitting the registration form calls `POST /auth/register` with payload `{ ..., roles: ["CLIENT_CEO"] }`.
- [ ] Upon 201 Success, the UI automatically redirects the user to the `/ceo` dashboard.
- [ ] The `access_token` and `refresh_token` are successfully saved into the Zustand global store / localStorage.

**Unhappy Path:**
- [ ] Form validation prevents submission if the email is invalid or the password is too weak.
- [ ] If the email is already registered, the backend returns `409 Conflict`. The UI must catch this and display a clear, friendly error (e.g., "This email is already in use").
- [ ] General network errors (e.g., backend down) display a generic error toast/message instead of silently failing or crashing.

### Phase B: Wallet Top-Up
*Note: Check whether the frontend calls `GET /virtual-accounts/topup` (per older docs) or `POST /wallets/virtual-accounts/topup` (per the new spec) and ensure they align.*

**Happy Path:**
- [ ] Clicking "Top Up Wallet" successfully calls the endpoint to retrieve the `WALLET_TOPUP` virtual account.
- [ ] The VietQR code is rendered clearly on the screen (e.g., `qr.sepay.vn/img?bank=MB&acc={vaNum}`).
- [ ] (If simulated) When the SePay IPN webhook fires and updates the wallet, the UI reflects the new balance seamlessly (either via the `wallet:balance-updated` socket event or via a manual refresh button).

**Unhappy Path:**
- [ ] If the API fails to fetch the VA number, the UI displays a retry button or an error message instead of an empty/broken image placeholder.

### Phase C: Subscription Activation
**Happy Path:**
- [ ] The Subscription page retrieves packages dynamically by calling `GET /config/subscription-packages?role=CLIENT`. **Crucial check:** Ensure the price (e.g., 500,000 VND) is NOT hardcoded in the frontend.
- [ ] Clicking to activate calls `POST /subscriptions/activate` with the payload `{ activeRole: "CLIENT", packageId: "..." }`.
- [ ] On success, the UI queries `GET /subscriptions/status` (or invalidates React Query cache) to immediately update the user's status to "Pro" without requiring a hard browser refresh.
- [ ] While on the "free" tier, the UI correctly locks out the Elicitation Engine.

**Unhappy Path:**
- [ ] **Insufficient Balance (`422`):** The backend will reject the activation if `available_balance` < package price. The UI must catch this specific error and prompt the user with a "Top Up Wallet" CTA.
- [ ] **Already Subscribed (`409`):** Handled gracefully if the user somehow triggers a double-click.
- [ ] **Package Inactive (`422`):** If an admin deactivates the package right before the user clicks, the UI should show an error and refresh the package list.

### Phase D: Logout
**Happy Path:**
- [ ] Clicking "Sign Out" calls the new `POST /auth/logout` endpoint to clear the `refresh_token_hash` on the database.
- [ ] The frontend successfully purges tokens from Zustand and redirects the user to the public landing page or login screen.

**Unhappy Path:**
- [ ] Even if the `POST /auth/logout` API call fails (due to network timeout), the frontend MUST still purge the local tokens and log the user out client-side to prevent them from being "stuck" in a logged-in state.

---

## MF-2: Expert Registration & Taxonomy Profile

### Phase A: Registration & Profile Base (`POST /auth/register` & `PUT /expert-profile/me`)
**Happy Path:**
- [ ] Submitting the registration form calls `POST /auth/register` with payload `{ ..., roles: ["EXPERT"] }`.
- [ ] After registration, updating profile calls `PUT /expert-profile/me` with `engagementModel`, `stackTagsJson`, etc., and `PUT /users/me` with `fullName` and `bio`.
- [ ] Profile data updates seamlessly in the UI.

**Unhappy Path:**
- [ ] Form validation prevents submission of invalid data (e.g. empty fields, improperly formatted tags).
- [ ] API failures display a toast error rather than crashing the page.

### Phase B: Domain Depths (`GET /config/domains` & `POST /expert-profile/domains`)
**Happy Path:**
- [ ] The domain selection UI fetches dynamic domain codes via `GET /config/domains`. The UI does NOT use hardcoded enums (A, B, C).
- [ ] Selecting a domain calls `POST /expert-profile/domains` (or `PUT /expert-profile/domains/sync` for bulk) with `{ domainCode: "...", depthLevel: "..." }`.
- [ ] The expert's selected domains are displayed correctly using `GET /expert-profile/me/domains`.
- [ ] Deleting a domain calls `DELETE /expert-profile/domains/:id`.

**Unhappy Path:**
- [ ] Submitting duplicate domains (`409 Conflict`) is handled properly (e.g., UI prevents selecting an already chosen domain, or shows an error if submitted).
- [ ] Failing to fetch domains from `GET /config/domains` shows a loading error or retry state.

### Phase C: Seam Claims (`GET /config/seams` & `POST /expert-profile/seams`)
**Happy Path:**
- [ ] The seam claim UI fetches dynamic seam codes via `GET /config/seams`. The codes use the `↔` (U+2194) character (e.g., `A↔C`).
- [ ] Submitting a claim calls `POST /expert-profile/seams` using the `↔` character exactly as provided by the config endpoint. (Submitting `A<->C` will be rejected by the backend DTO).
- [ ] Claims display correctly via `GET /expert-profile/me/seams`.

**Unhappy Path:**
- [ ] If the frontend accidentally reformats `↔` to `<->`, the backend will reject it. Check that the UI doesn't mutate this string.
- [ ] Duplicate seam claims are prevented in UI or handled via error toast.

### Phase D: Expert Pro Subscription (`GET /config/subscription-packages?role=EXPERT`)
**Happy Path:**
- [ ] Subscription packages are fetched dynamically with `?role=EXPERT`.
- [ ] Clicking to activate calls `POST /subscriptions/activate` with `{ activeRole: "EXPERT", packageId: "..." }`.
- [ ] Success updates the expert's status to "Pro" immediately.

**Unhappy Path:**
- [ ] Insufficient balance (`422`) shows an error prompting wallet top-up.
- [ ] Already subscribed (`409`) shows a relevant error message.
