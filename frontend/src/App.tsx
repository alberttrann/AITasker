import { lazy, Suspense } from "react";
import { Route, createBrowserRouter, createRoutesFromElements, RouterProvider, Outlet } from "react-router-dom";
import { AuthProvider } from '@lib/auth-context';
import { SocketProvider } from '@lib/socket-provider';

// Guards
import { GuestRoute, ProtectedRoute, RoleRoute, AuthGate } from "@lib/route-guards";

// Public pages
const LandingPage = lazy(() => import("@/components/pages/landingPage"));
const ErrorPage = lazy(() => import("@components/pages/ErrorPage"));

// Tech Team has a public registration route (no auth, link-based)
const HandoffRegister = lazy(() => import("@features/tech-team/auth/HandoffRegister").then(m => ({ default: m.HandoffRegister })));
const LinkExpiredError = lazy(() => import("@features/tech-team/auth/LinkExpiredError").then(m => ({ default: m.LinkExpiredError })));

// Auth
const ResetPasswordPage = lazy(() => import("@components/auth/ResetPasswordPage"));

// Dashboards
const CeoDashboard = lazy(() => import("@features/ceo/CeoDashboard"));
const CeoOverview = lazy(() => import("@features/ceo/CeoDashboard").then(m => ({ default: m.CeoOverview })));
const ExpertDashboard = lazy(() => import("@features/expert/ExpertDashboard"));
const ExpertOverview = lazy(() => import("@features/expert/ExpertDashboard").then(m => ({ default: m.ExpertOverview })));
const TechTeamDashboard = lazy(() => import("@features/tech-team/TechTeamDashboard"));
const TechTeamOverview = lazy(() => import("@features/tech-team/TechTeamOverview"));
const TechTeamProjectsPage = lazy(() => import("@features/tech-team/pages/TechTeamProjectsPage"));
const Stage4Submitted = lazy(() => import("@features/tech-team/stage4/Stage4Submitted"));
const AdminDashboard = lazy(() => import("@features/admin/AdminDashboard"));
const AdminOverview = lazy(() => import("@features/admin/AdminOverview"));
const AnalyticsDashboard = lazy(() => import("@features/admin/analytics/AnalyticsDashboard"));
const DisputeMonitor = lazy(() => import("@features/admin/disputes/DisputeMonitor"));
const DisputeDetail = lazy(() => import("@features/admin/disputes/DisputeDetail"));
const ResolutionConfirm = lazy(() => import("@features/admin/disputes/ResolutionConfirm"));
const UserList = lazy(() => import("@features/admin/accounts/UserList"));
const PlatformSettings = lazy(() => import("@features/admin/PlatformSettings"));
const TransactionsLedger = lazy(() => import("@features/admin/ledger/TransactionsLedger"));
const WithdrawalRequests = lazy(() => import("@features/admin/ledger/WithdrawalRequests"));
const SubscriptionPackagesPage = lazy(() => import("@features/admin/packages/SubscriptionPackagesPage"));
const ConfigurationPage = lazy(() => import("@features/admin/config/ConfigurationPage"));
const DomainSeamConfigPage = lazy(() => import("@features/admin/config/DomainSeamConfigPage"));
const ArchetypeConfigPage = lazy(() => import("@features/admin/config/ArchetypeConfigPage"));
const ProfilePage = lazy(() => import("./components/pages/UserProfilePage"));
const ProfileSettingPage = lazy(() => import("./components/pages/ProfileSettingPage"));
const WalletPage = lazy(() => import("./components/wallet/WalletPage"));
const ExpertWallet = lazy(() => import("@features/expert/wallet/ExpertWallet"));
const BankHubLink = lazy(() => import("@features/expert/wallet/BankHubLink"));
const ServiceDetail = lazy(() => import("./features/expert/services/ServiceDetail"));

const SubscriptionManagement = lazy(() => import("@features/ceo/onboarding/SubscriptionManagement"));
const SubscriptionPlans = lazy(() => import("@features/ceo/onboarding/SubscriptionPlans"));
const MarketplaceBrowse = lazy(() => import("@features/ceo/marketplace/MarketplaceBrowse"));
const ExpertSubscriptionManagement = lazy(() => import("@features/expert/onboarding/SubscriptionManagement"));
const ExpertSubscriptionPlans = lazy(() => import("@features/expert/onboarding/SubscriptionPlans"));
const ElicitationWizard = lazy(() => import("@features/ceo/elicitation/ElicitationWizard"));
const ShortlistView = lazy(() => import("@features/ceo/shortlist/ShortlistView"));
const ProjectsPage = lazy(() => import("@features/ceo/pages/ProjectsPage"));
const ProjectDetailPage = lazy(() => import("@features/ceo/pages/ProjectDetailPage"));
const CeoBidList = lazy(() => import("@features/ceo/bids/CeoBidList"));
const CeoDecision = lazy(() => import("@features/ceo/bids/CeoDecision"));
const SessionsListPage = lazy(() => import("@features/ceo/pages/SessionsListPage"));
const ExpertProfilePage = lazy(() => import("@features/expert/profile/ExpertProfilePage"));
const VerificationHistoryPage = lazy(() => import("@features/expert/verification/VerificationHistoryPage"));
const CeoNdaClickThrough = lazy(() => import("@features/ceo/connection/NdaClickThrough"));
const ExpertNdaClickThrough = lazy(() => import("@features/expert/connection/NdaClickThrough"));
const ExpertProjectsPage = lazy(() => import("@features/expert/projects/ExpertProjectsPage"));
const InboxPage = lazy(() => import("@/components/messaging/InboxPage"));
const MessageThread = lazy(() => import("@/components/messaging/MessageThread"));
const ExpertServicesPage = lazy(() => import("@features/expert/services/ExpertServicesPage"));
const BidForm = lazy(() => import("@features/expert/bidding/BidForm"));
const BidReviewList = lazy(() => import("@features/tech-team/bids/BidReviewList"));
const BidReviewDetail = lazy(() => import("@features/tech-team/bids/BidReviewDetail"));
const BidApprove = lazy(() => import("@features/tech-team/bids/BidApprove"));
const BidRevisionRequest = lazy(() => import("@features/tech-team/bids/BidRevisionRequest"));
const MilestoneList = lazy(() => import("./features/ceo/milestones/MilestoneList"));
const CreateMilestone = lazy(() => import("./features/ceo/milestones/CreateMilestone"));
const MilestoneDetail = lazy(() => import("./features/ceo/milestones/MilestoneDetail"));
const FundMilestone = lazy(() => import("./features/ceo/milestones/FundMilestone"));
const ExpertMilestoneDetail = lazy(() => import("./features/expert/milestones/ExpertMilestoneDetail"));
const DisputeFile = lazy(() => import("./features/ceo/milestones/DisputeFile"));
const DisputeResult = lazy(() => import("./features/ceo/milestones/DisputeResult"));

function RootLayout() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Suspense fallback={<AuthGate />}>
          <Outlet />
        </Suspense>
      </SocketProvider>
    </AuthProvider>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/register/handoff/:token" element={<HandoffRegister />} />
      <Route path="/register/handoff/expired" element={<LinkExpiredError />} />

      {/* Authenticated Routes */}
      <Route element={<ProtectedRoute />}>
        {/* CEO Routes */}
        <Route element={<RoleRoute requiredSubtype="CEO" />}>
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
            <Route path="marketplace" element={<MarketplaceBrowse />} />
            <Route path="projects/:projectId/shortlist" element={<ShortlistView />} />
            
            {/* Unified inbox system with route parameters support */}
            <Route path="inbox" element={<InboxPage />} />
            <Route path="inbox/:engagementId" element={<InboxPage />} />
            <Route path="engagements/:engagementId/messages" element={<MessageThread />} />
            
            <Route path="projects/:projectId/bids" element={<CeoBidList />} />
            <Route path="project/:projectId/bids/:bidId" element={<CeoDecision />} />
            <Route path="projects/:projectId/bids/:bidId" element={<CeoDecision />} />
            <Route path="engagements/:engagementId/nda" element={<CeoNdaClickThrough />} />
            <Route path="engagements/:engagementId/milestones" element={<MilestoneList />} />
            <Route path="engagements/:engagementId/milestones/create" element={<CreateMilestone />} />
            <Route path="engagements/:engagementId/milestones/:milestoneId" element={<MilestoneDetail />} />
            <Route path="engagements/:engagementId/milestones/:milestoneId/fund" element={<FundMilestone />} />
            <Route path="engagements/:engagementId/milestones/:milestoneId/dispute" element={<DisputeFile />} />
            <Route path="engagements/:engagementId/milestones/:milestoneId/dispute/result" element={<DisputeResult />} />
          </Route>
        </Route>

        {/* Expert Routes */}
        <Route element={<RoleRoute requiredRole="EXPERT" />}>
          <Route path="/expert" element={<ExpertDashboard />}>
            <Route index element={<ExpertOverview />} />
            <Route path="service" element={<ExpertServicesPage />} />
            <Route path="service/:id" element={<ServiceDetail />} />
            <Route path="service/projects" element={<ExpertProjectsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="service/expert-profile" element={<ExpertProfilePage />} />
            <Route path="account-setting" element={<ProfileSettingPage />} />
            <Route path="wallet" element={<ExpertWallet />} />
            <Route path="wallet/link-bank" element={<BankHubLink />} />
            <Route path="service/expert-profile/verification-history" element={<VerificationHistoryPage />} />
            <Route path="verification-history" element={<VerificationHistoryPage />} />
            <Route path="subscriptions" element={<ExpertSubscriptionManagement />} />
            <Route path="subscriptions/plans" element={<ExpertSubscriptionPlans />} />
            
            {/* Unified inbox system with route parameters support */}
            <Route path="inbox" element={<InboxPage />} />
            <Route path="inbox/:engagementId" element={<InboxPage />} />
            <Route path="engagements/:engagementId/messages" element={<MessageThread />} />
            
            <Route path="bids/:projectId" element={<BidForm />} />
            <Route path="engagements/:engagementId/nda" element={<ExpertNdaClickThrough />} />
            <Route path="engagements/:engagementId/milestones/:milestoneId" element={<ExpertMilestoneDetail />} />
            <Route path="engagements/:engagementId/milestones/:milestoneId/dispute" element={<DisputeFile />} />
            <Route path="engagements/:engagementId/milestones/:milestoneId/dispute/result" element={<DisputeResult />} />
          </Route>
        </Route>

        {/* Tech Team Routes */}
        <Route element={<RoleRoute requiredSubtype="TECH_TEAM" />}>
          <Route path="/tech-team" element={<TechTeamDashboard />}>
            <Route index element={<TechTeamOverview />} />
            <Route path="projects" element={<TechTeamProjectsPage />} />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="account-setting" element={<ProfileSettingPage />} />
            
            {/* Unified inbox system with route parameters support */}
            <Route path="inbox" element={<InboxPage />} />
            <Route path="inbox/:engagementId" element={<InboxPage />} />
            <Route path="engagements/:engagementId/messages" element={<MessageThread />} />
            
            <Route path="submitted" element={<Stage4Submitted />} />
            <Route path="bids" element={<BidReviewList />} />
            <Route path="bids/:bidId" element={<BidReviewDetail />} />
            <Route path="bids/:bidId/approve" element={<BidApprove />} />
            <Route path="bids/:bidId/revision" element={<BidRevisionRequest />} />
          </Route>
        </Route>

        {/* Admin Routes */}
        <Route element={<RoleRoute requiredRole="ADMIN" />}>
          <Route path="/admin" element={<AdminDashboard />}>
            <Route index element={<AdminOverview />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="account-setting" element={<ProfileSettingPage />} />
            <Route path="analytics" element={<AnalyticsDashboard />} />
            <Route path="config" element={<ConfigurationPage />} />
            <Route path="config/packages" element={<SubscriptionPackagesPage />} />
            <Route path="config/domain-seam" element={<DomainSeamConfigPage />} />
            <Route path="config/archetypes" element={<ArchetypeConfigPage />} />
            <Route path="disputes" element={<DisputeMonitor />} />
            <Route path="disputes/:id" element={<DisputeDetail />} />
            <Route path="disputes/:id/resolve" element={<ResolutionConfirm />} />
            <Route path="users" element={<UserList />} />
            <Route path="settings" element={<PlatformSettings />} />
            <Route path="ledger" element={<TransactionsLedger />} />
            <Route path="withdrawals" element={<WithdrawalRequests />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<ErrorPage />} />
    </Route>,
  ),
);

export default function App() {
  return <RouterProvider router={router} />;
}