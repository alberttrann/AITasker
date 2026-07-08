import { Route, createBrowserRouter, createRoutesFromElements, RouterProvider, Outlet } from "react-router-dom";
import { AuthProvider } from '@lib/auth-context';
import { SocketProvider } from '@lib/socket-provider';

// Guards
import { GuestRoute, ProtectedRoute, RoleRoute } from "@lib/route-guards";

// Public pages
import LandingPage from "@/components/pages/LandingPage";
import ErrorPage from "@components/pages/ErrorPage";

// Tech Team has a public registration route (no auth, link-based)
import { HandoffRegister } from "@features/tech-team/auth/HandoffRegister";
import { LinkExpiredError } from "@features/tech-team/auth/LinkExpiredError";

// Auth
import ResetPasswordPage from "@components/auth/ResetPasswordPage";

// Dashboards — stub shells now, built out screen by screen
import CeoDashboard from "@features/ceo/CeoDashboard";
import { CeoOverview } from "@features/ceo/CeoDashboard";
import ExpertDashboard, {
  ExpertOverview,
} from "@features/expert/ExpertDashboard";
import TechTeamDashboard from "@features/tech-team/TechTeamDashboard";
import TechTeamOverview from "@features/tech-team/TechTeamOverview";
import TechTeamProjectsPage from "@features/tech-team/pages/TechTeamProjectsPage";
import Stage4Submitted from "@features/tech-team/stage4/Stage4Submitted";
import AdminDashboard from "@features/admin/AdminDashboard";
import AdminOverview from "@features/admin/AdminOverview";
import AnalyticsDashboard from "@features/admin/analytics/AnalyticsDashboard";
import DisputeMonitor from "@features/admin/disputes/DisputeMonitor";
import TransactionsLedger from "@features/admin/ledger/TransactionsLedger";
import WithdrawalRequests from "@features/admin/ledger/WithdrawalRequests";
import SubscriptionPackagesPage from "@features/admin/packages/SubscriptionPackagesPage";
import ConfigurationPage from "@features/admin/config/ConfigurationPage";
import DomainSeamConfigPage from "@features/admin/config/DomainSeamConfigPage";
import ProfilePage from "./components/pages/UserProfilePage";
import ProfileSettingPage from "./components/pages/ProfileSettingPage";
import WalletPage from "./components/wallet/WalletPage";
import ExpertWallet from "@features/expert/wallet/ExpertWallet";
import BankHubLink from "@features/expert/wallet/BankHubLink";

import SubscriptionManagement from "@features/ceo/onboarding/SubscriptionManagement";
import SubscriptionPlans from "@features/ceo/onboarding/SubscriptionPlans";
import ExpertSubscriptionManagement from "@features/expert/onboarding/SubscriptionManagement";
import ExpertSubscriptionPlans from "@features/expert/onboarding/SubscriptionPlans";
import ElicitationWizard from "@features/ceo/elicitation/ElicitationWizard";
import ShortlistView from "@features/ceo/shortlist/ShortlistView";
import ProjectsPage from "@features/ceo/pages/ProjectsPage";
import ProjectDetailPage from "@features/ceo/pages/ProjectDetailPage";
import SessionsListPage from "@features/ceo/pages/SessionsListPage";
import ExpertProfilePage from "@features/expert/profile/ExpertProfilePage";
import VerificationHistoryPage from "@features/expert/verification/VerificationHistoryPage";
import CeoNdaClickThrough from "@features/ceo/connection/NdaClickThrough";
import ExpertNdaClickThrough from "@features/expert/connection/NdaClickThrough";
import BidForm from "@features/expert/bidding/BidForm";
import BidReviewList from "@features/tech-team/bids/BidReviewList";
import BidReviewDetail from "@features/tech-team/bids/BidReviewDetail";
import BidApprove from "@features/tech-team/bids/BidApprove";
import BidRevisionRequest from "@features/tech-team/bids/BidRevisionRequest";

function RootLayout() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Outlet />
      </SocketProvider>
    </AuthProvider>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
      {/* ── Public ─────────────────────────────────────────────────────── */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      {/* Handoff link lands here — public so TECH_TEAM can register */}
      <Route path="/register/handoff/:token" element={<HandoffRegister />} />
      <Route path="/register/handoff/expired" element={<LinkExpiredError />} />

      {/* ── Authenticated ────────────────────────────────────────────── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute requiredSubtype="CEO" />}>
          {/* /ceo/* — all CEO screens will nest here */}
          <Route path="/ceo" element={<CeoDashboard />}>
            <Route index element={<CeoOverview />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="project/:id" element={<ProjectDetailPage />} />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="account-setting" element={<ProfileSettingPage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="projects/session-history" element={<SessionsListPage />} />
            <Route path="subscriptions" element={<SubscriptionManagement />} />
            <Route path="subscriptions/plans" element={<SubscriptionPlans />} />
            <Route path="projects/elicitation" element={<ElicitationWizard />} />
            <Route path="projects/shortlist/:projectId" element={<ShortlistView />} />
            <Route
              path="engagements/:engagementId/nda"
              element={<CeoNdaClickThrough />}
            />
          </Route>
        </Route>

        <Route element={<RoleRoute requiredRole="EXPERT" />}>
          {/* /expert/* — all Expert screens will nest here */}
          <Route path="/expert" element={<ExpertDashboard />}>
            <Route index element={<ExpertOverview />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="service/expert-profile" element={<ExpertProfilePage />} />
            <Route path="account-setting" element={<ProfileSettingPage />} />
            <Route path="wallet" element={<ExpertWallet />} />
            <Route path="wallet/link-bank" element={<BankHubLink />} />
            <Route
              path="verification-history"
              element={<VerificationHistoryPage />}
            />
            <Route
              path="subscriptions"
              element={<ExpertSubscriptionManagement />}
            />
            <Route
              path="subscriptions/plans"
              element={<ExpertSubscriptionPlans />}
            />
            <Route path="bids/:projectId" element={<BidForm />} />
            <Route
              path="engagements/:engagementId/nda"
              element={<ExpertNdaClickThrough />}
            />
          </Route>
        </Route>

        <Route element={<RoleRoute requiredSubtype="TECH_TEAM" />}>
          {/* /tech-team/* — scoped to one linked project forever */}
          <Route path="/tech-team" element={<TechTeamDashboard />}>
            <Route index element={<TechTeamOverview />} />
            <Route path="projects" element={<TechTeamProjectsPage />} />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="account-setting" element={<ProfileSettingPage />} />
            <Route path="submitted" element={<Stage4Submitted />} />
            <Route path="bids" element={<BidReviewList />} />
            <Route path="bids/:bidId" element={<BidReviewDetail />} />
            <Route path="bids/:bidId/approve" element={<BidApprove />} />
            <Route path="bids/:bidId/revision" element={<BidRevisionRequest />} />
          </Route>
        </Route>

        <Route element={<RoleRoute requiredRole="ADMIN" />}>
          {/* /admin/* — all Admin screens will nest here */}
          <Route path="/admin" element={<AdminDashboard />}>
            <Route index element={<AdminOverview />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="account-setting" element={<ProfileSettingPage />} />
            <Route path="analytics" element={<AnalyticsDashboard />} />
            <Route path="config" element={<ConfigurationPage />} />
            <Route path="config/packages" element={<SubscriptionPackagesPage />} />
            <Route path="config/domain-seam" element={<DomainSeamConfigPage />} />
            <Route path="disputes" element={<DisputeMonitor />} />
            <Route path="ledger" element={<TransactionsLedger />} />
            <Route path="withdrawals" element={<WithdrawalRequests />} />
          </Route>
        </Route>
      </Route>

      {/* ── 404 ──────────────────────────────────────────────────────── */}
      <Route path="*" element={<ErrorPage />} />
    </Route>
  )
);

export default function App() {
  return <RouterProvider router={router} />;
}
