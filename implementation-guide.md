# Implementation Guide & Q-A Walkthrough Tutorial

This guide details the modifications made to the codebase for the service listing/workspace flow, explains the logic of the code changes, and provides a walkthrough tutorial to prepare for your Live Q&A.

---

## 1. Architectural Changes & Database Relationships

Previously, purchasing a service listing created an `Engagement` of type `SERVICE_PURCHASE` but did not create a `Project`. This caused service workspaces to be omitted from the standard "Your Projects" lists.

### The Solution:
1. **Dynamic Project Association**: When the payment for a service is confirmed, the system now automatically creates a database record in the `projects` table with the same name as the service listing, state `PUBLISHED`, and `selfTechnical: true`. It then links the `Engagement` to this new project.
2. **Contract Flag Overrides**: Because service purchases are fixed-price, ready-to-buy listings, negotiation and NDAs are not required. In `engagements.service.ts`, we now override `termsLocked` and `ndaComplete` to `true` for service purchases. This immediately bypasses NDA and negotiation screens on the client side, allowing the client to click **Go to Workspace** from the project details page.
3. **Auto-Closure on Sign-Off**: When the CEO approves the single milestone for the service order, the system checks if all milestones are approved. Because all milestones (1/1) are approved, it automatically updates the engagement state to `CLOSED`. This enables the review flow immediately.
4. **Clean Catalog UX**: In the purchases list, completed (`CLOSED`) and `CANCELLED` service orders remain visible with appropriate tag colors (**Closed** and **Cancelled**). In the catalog browser, they are hidden from search to prevent accidental duplicate purchases.

---

## 2. Detailed Code Modifications

### Backend changes

#### 1. Project Creation on Payment Confirmation
* **File**: `backend/src/payments/ipn-handler.service.ts`
* **Change**:
```typescript
    // Inside the virtual account payment confirmation transaction:
    const serviceProject = await tx.project.create({
      data: {
        clientId: engagement.clientId,
        projectName: engagement.service?.title || 'Service Purchase',
        state: 'PUBLISHED',
        selfTechnical: true,
        requiredDomainsJson: engagement.service?.domainsJson || [],
        requiredSeamsJson: engagement.service?.seamsJson || [],
      },
    });

    await tx.engagement.update({
      where: { id: engagement.id },
      data: { 
        state: EngagementState.ACTIVE,
        projectId: serviceProject.id,
      },
    });
```
* **Explanation**: This creates the Project model linked to the client (CEO) and fills in the domain requirements from the service listing. Then it sets the engagement state to `ACTIVE` and links `projectId`.

#### 2. Service Purchase Contract Flag Overrides
* **File**: `backend/src/engagements/engagements.service.ts`
* **Change**:
```typescript
    const isService = (engagement as any).type === 'SERVICE_PURCHASE' || (engagement as any).type === 'TECH_DISCOVERY';
    return {
      ...engagement,
      // ... (existing code for capability bids)
      termsLocked: isService || bidHasAcceptedTerms(capabilityBid),
      ndaComplete: isService || Boolean(
        engagement.clientNdaAcceptedAt && engagement.expertNdaAcceptedAt,
      ),
    };
```
* **Explanation**: This sets `termsLocked: true` and `ndaComplete: true` on service purchase engagements. This allows the CEO's project details page to bypass NDA/negotiation logic and show the **Go to Workspace** button.

#### 3. Automatic Engagement Closure on Milestone Approval
* **File**: `backend/src/milestones/criteria.service.ts`
* **Change**:
```typescript
      if (approval.count === 1) {
        await this.ledgerService.releaseMilestoneWithTx(tx, criterion.milestoneId);

        const unapprovedCount = await tx.milestone.count({
          where: {
            engagementId: criterion.milestone.engagementId,
            state: { notIn: ['APPROVED', 'RELEASED'] },
          },
        });

        if (unapprovedCount === 0) {
          await tx.engagement.update({
            where: { id: criterion.milestone.engagementId },
            data: { state: 'CLOSED' },
          });
        }
      }
```
* **Explanation**: Checks for remaining unapproved milestones after milestone verification. If all milestones are `APPROVED` or `RELEASED`, the engagement automatically transitions to `CLOSED`.

---

### Frontend changes

#### 1. Display Service Orders Linked to Projects
* **File**: `frontend/src/features/expert/services/ExpertOrdersPage.tsx`
* **Change**:
```typescript
-   const serviceEngagements = engagements.filter((eng) => !eng.project && (eng.type === 'SERVICE_PURCHASE' || eng.type === 'TECH_DISCOVERY'));
+   const serviceEngagements = engagements.filter((eng) => eng.type === 'SERVICE_PURCHASE' || eng.type === 'TECH_DISCOVERY');
```
* **Explanation**: Removes the `!eng.project` gate so that service orders linked to projects continue to display correctly in the expert's "Service Orders" tab.

#### 2. Display Status Tags correctly in CEO Purchases List
* **File**: `frontend/src/features/ceo/marketplace/MarketplaceBrowse.tsx`
* **Change**:
```typescript
-   isPending ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
+   purchase.state === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
+   purchase.state === 'CLOSED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
+   purchase.state === 'CANCELLED' ? 'bg-slate-50 text-slate-500 border-slate-200' :
+   'bg-emerald-50 text-emerald-700 border-emerald-200'
```
* **Explanation**: Maps all states (`PENDING`, `ACTIVE`, `CLOSED`, `CANCELLED`) to their color-coded badges, fixing the issue where a closed or cancelled service order erroneously showed as "Active".

#### 3. Completed Workspace success banners
* **Files**: `ExpertProjectsPage.tsx` and `ProjectDetailPage.tsx`
* **Change**: Adds a high-visibility, green-themed success banner to both the client's and expert's detail views when a service workspace has been successfully completed (`CLOSED`).

---

## 3. Live Q-A Walkthrough & Demo Guide

Use this guide to demonstrate or explain the full flow during your QA session.

### Phase 1: Purchase and Activation
1. **Purchase the service**: Log in as a CEO client and find a published service listing in the Marketplace. Click **Buy Now** / **Pay**.
2. **Simulate Payment**: Retrieve the Virtual Account (VA) reference code. Simulate or confirm the IPN payment webhook.
3. **Verify Project Listing**:
   - Go to the **Projects** tab as the CEO. Verify that the project (titled after the service listing) is now in the list.
   - Click the project. Verify you see the **Go to Workspace** button directly (no NDA or bidding screen is shown).
   - Log in as the Expert. Go to **Workspace > Active Workspaces**. Verify that the service project appears in the expert's projects list and the orders list.

### Phase 2: Completion and Sign-Off
1. **Deliver Work**: Log in as the Expert. Open the Milestone Workspace for the active service order. Write a submission description, attach links, and click **Submit Deliverable**.
2. **Review & Approve**: Log in as the CEO. Go to the Milestone Workspace. View the criteria and click **Approve / Sign Off**.
3. **Verify Completed State**:
   - **Engagement closed**: Verify that the engagement is now closed. Both CEO and expert can now click **Leave a Review**.
   - **UI Banners**: Verify that both the CEO's project details page and the Expert's project details view show the green **Service Workspace Completed!** success banner.
   - **My Purchases vs Catalog**: Verify that the service stays in the CEO's "My Purchases" tab with the label **Closed**, and does *not* reappear in the marketplace catalog (preventing accidental repurchase).
