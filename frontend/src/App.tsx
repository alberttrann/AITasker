import { lazy, Suspense } from "react";
import { Route, createBrowserRouter, createRoutesFromElements, RouterProvider, Outlet, Navigate } from "react-router-dom";
import { AuthProvider } from '@lib/auth-context';
import { SocketProvider } from '@lib/socket-provider';
import { ToastProvider } from '@lib/toast-context';
import { ToastContainer } from '@components/ui/ToastContainer';

// Guards
import { GuestRoute, ProtectedRoute, RoleRoute, AuthGate } from "@lib/route-guards";
import ServicePurchase from "./features/ceo/marketplace/ServicePurchase";
const PromptConfigPage = lazy(() => import("@features/admin/config/PromptConfigPage"));
const VoidCodesConfigPage = lazy(() => import("@features/admin/config/VoidCodesConfigPage"));
const IntegrityMonitor = lazy(() => import("@features/admin/integrity/IntegrityMonitor"));
// Public pages
const LandingPage = lazy(() => import("@/components/pages/landingPage"));
const ErrorPage = lazy(() => import("@components/pages/ErrorPage"));

// Tech Team registration routes
const HandoffRegister = lazy(() => import("@features/tech-team/auth/HandoffRegister").then(m => ({ default: m.HandoffRegister })));
const LinkExpiredError = lazy(() => import("@features/tech-team/auth/LinkExpiredError").then(m => ({ default: m.LinkExpiredError })));

const ResetPasswordPage = lazy(() => import("@components/auth/ResetPasswordPage"));

// Dashboards & Layouts
const CeoDashboard = lazy(() => import("@features/ceo/CeoDashboard"));
const CeoOverview = lazy(() => import("@features/ceo/CeoDashboard").then(m => ({ default: m.CeoOverview })));
const ExpertDashboard = lazy(() => import("@features/expert/ExpertDashboard"));
const ExpertOverview = lazy(() => import("@features/expert/ExpertDashboard").then(m => ({ default: m.ExpertOverview })));
const TechTeamDashboard = lazy(() => import("@features/tech-team/TechTeamDashboard"));
const TechTeamProjectsPage = lazy(() => import("@features/tech-team/pages/TechTeamProjectsPage"));
const TechTeamProjectDetailPage = lazy(() => import("@features/tech-team/pages/TechTeamProjectDetailPage"));
const TechTeamMilestoneList = lazy(() => import("@features/tech-team/milestones/MilestoneList"));
const TechTeamMilestoneDetail = lazy(() => import("@features/tech-team/milestones/TechTeamMilestoneDetail"));
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
const WithdrawForm = lazy(() => import("@features/expert/wallet/WithdrawForm"));
const ServiceDetail = lazy(() => import("./features/expert/services/ServiceDetail"));

const SubscriptionManagement = lazy(() => import("@features/ceo/onboarding/SubscriptionManagement"));
const SubscriptionPlans = lazy(() => import("@features/ceo/onboarding/SubscriptionPlans"));
const MarketplaceBrowse = lazy(() => import("@features/ceo/marketplace/MarketplaceBrowse"));
const CeoServiceDetail = lazy(() => import("@features/ceo/marketplace/ServiceDetail"));
const CeoServicePurchase = lazy(() => import("@features/ceo/marketplace/ServicePurchase"));
const ExpertSubscriptionManagement = lazy(() => import("@features/expert/onboarding/SubscriptionManagement"));
const MessageThread = lazy(() => import("@/components/messaging/MessageThread"));
const InboxPage = lazy(() => import("@/components/messaging/InboxPage"));
const ExpertSubscriptionPlans = lazy(() => import("@features/expert/onboarding/SubscriptionPlans"));
const ElicitationWizard = lazy(() => import("@features/ceo/elicitation/ElicitationWizard"));
const ShortlistView = lazy(() => import("@features/ceo/shortlist/ShortlistView"));
const ProjectsPage = lazy(() => import("@features/ceo/pages/ProjectsPage"));
const ProjectDetailPage = lazy(() => import("@features/ceo/pages/ProjectDetailPage"));
const BidList = lazy(() => import("@features/ceo/bids/BidList"));
const BidDetail = lazy(() => import("@features/ceo/bids/BidDetail"));
const BidDecisionConfirm = lazy(() => import("@features/ceo/bids/BidDecisionConfirm"));
const SessionsListPage = lazy(() => import("@features/ceo/pages/SessionsListPage"));
const ExpertProfilePage = lazy(() => import("@features/expert/profile/ExpertProfilePage"));
const VerificationHistoryPage = lazy(() => import("@features/expert/verification/VerificationHistoryPage"));
const CeoNdaClickThrough = lazy(() => import("@features/ceo/connection/NdaClickThrough"));
const NotificationSystem = lazy(() => import("@/components/notifications/NotificationSystem"));
const ExpertNdaClickThrough = lazy(() => import("@features/expert/connection/NdaClickThrough"));
const ExpertProjectsPage = lazy(() => import("@features/expert/projects/ExpertProjectsPage"));
const ExpertServicesPage = lazy(() => import("@features/expert/services/ExpertServicesPage"));
const ExpertOrdersPage = lazy(() => import("@features/expert/services/ExpertOrdersPage"));
const BidForm = lazy(() => import("@features/expert/bidding/BidForm"));
const CounterOfferReceived = lazy(() => import("@features/expert/bidding/CounterOfferReceived"));
const BidReviewList = lazy(() => import("@features/tech-team/bids/BidReviewList"));
const BidReviewDetail = lazy(() => import("@features/tech-team/bids/BidReviewDetail"));
const BidApprove = lazy(() => import("@features/tech-team/bids/BidApprove"));
const BidRevisionRequest = lazy(() => import("@features/tech-team/bids/BidRevisionRequest"));
const MilestoneList = lazy(() => import("./features/ceo/milestones/MilestoneList"));
const CreateMilestone = lazy(() => import("./features/ceo/milestones/CreateMilestone"));
const MilestoneDetail = lazy(() => import("./features/ceo/milestones/MilestoneDetail"));
const FundMilestone = lazy(() => import("./features/ceo/milestones/FundMilestone"));
const ExpertMilestoneDetail = lazy(() => import("./features/expert/milestones/ExpertMilestoneDetail"));
const CeoReviewForm = lazy(() => import("./features/ceo/review/CeoReviewForm"));
const ExpertReviewForm = lazy(() => import("./features/expert/review/ExpertReviewForm"));
const TechTeamReviewForm = lazy(() => import("@features/tech-team/review/TechTeamReviewForm"));
const DisputeFile = lazy(() => import("./features/ceo/milestones/DisputeFile"));
const DisputeResult = lazy(() => import("./features/ceo/milestones/DisputeResult"));
const AdminProjectsPage = lazy(() => import("@features/admin/oversight/AdminProjectsPage"));
const AdminEngagementsPage = lazy(() => import("@features/admin/oversight/AdminEngagementsPage"));
const AdminExpertsPage = lazy(() => import("@features/admin/oversight/AdminExpertsPage"));
const CeoExpertProfileView = lazy(() => import("@features/ceo/experts/CeoExpertProfileView"));

function RootLayout() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SocketProvider>
          <Suspense fallback={<AuthGate />}>
            <Outlet />
          </Suspense>
        </SocketProvider>
      </AuthProvider>
      {/* Global toast notifications — rendered outside router subtree */}
      <ToastContainer />
    </ToastProvider>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/register/handoff/:token" element={<HandoffRegister />} />
      <Route path="/register/handoff/expired" element={<LinkExpiredError />} />

      {/* Authenticated */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute requiredSubtype="CEO" />}>
          <Route path="/ceo" element={<CeoDashboard />}>
            <Route index element={<CeoOverview />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="account-setting" element={<ProfileSettingPage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="projects/session-history" element={<SessionsListPage />} />
            <Route path="subscriptions" element={<SubscriptionManagement />} />
            <Route path="subscriptions/plans" element={<SubscriptionPlans />} />
            <Route path="projects/elicitation" element={<ElicitationWizard />} />
            <Route path="marketplace" element={<MarketplaceBrowse />} />
            <Route path="marketplace/service/:id" element={<CeoServiceDetail />} />
            <Route path="marketplace/service/:id/purchase" element={<CeoServicePurchase />} />
            <Route path="experts/:userId" element={<CeoExpertProfileView />} />
            <Route path="projects/:projectId/shortlist" element={<ShortlistView />} />
            <Route path="projects/:projectId/bids" element={<BidList />} />
            <Route path="projects/:projectId/bids/:bidId" element={<BidDetail />} />
            <Route path="projects/:projectId/bids/:bidId/decision" element={<BidDecisionConfirm />} />
            <Route
              path="engagements/:engagementId/nda"
              element={<CeoNdaClickThrough />}
            />
            <Route
              path="engagements/:engagementId/milestones"
              element={<MilestoneList />}
            />
            <Route
              path="engagements/:engagementId/review"
              element={<CeoReviewForm />}
            />

            <Route path="messages" element={<Navigate to="inbox" replace />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="inbox/:engagementId" element={<InboxPage />} />
            <Route path="notifications" element={<NotificationSystem />} />
            <Route
              path="engagements/:engagementId/milestones/create"
              element={<CreateMilestone />}
            />
            <Route
              path="engagements/:engagementId/milestones/:milestoneId"
              element={<MilestoneDetail />}
            />
            <Route
              path="engagements/:engagementId/milestones/:milestoneId/fund"
              element={<FundMilestone />}
            />
            <Route
              path="engagements/:engagementId/milestones/:milestoneId/dispute"
              element={<DisputeFile />}
            />
            <Route
              path="engagements/:engagementId/milestones/:milestoneId/dispute/result"
              element={<DisputeResult />}
            />
          </Route>
        </Route>

        <Route element={<RoleRoute requiredRole="EXPERT" />}>
          <Route path="/expert" element={<ExpertDashboard />}>
            <Route index element={<ExpertOverview />} />
            <Route path="service" element={<ExpertServicesPage />} />
            <Route path="service/:id" element={<ServiceDetail />} />
            <Route path="service/projects" element={<ExpertProjectsPage />} />
            <Route path="service/orders" element={<ExpertOrdersPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="service/expert-profile" element={<ExpertProfilePage />} />
            <Route path="account-setting" element={<ProfileSettingPage />} />
            <Route path="wallet" element={<ExpertWallet />} />
            <Route path="wallet/link-bank" element={<BankHubLink />} />
            <Route path="wallet/withdraw" element={<WithdrawForm />} />
            <Route path="service/expert-profile/verification-history" element={<VerificationHistoryPage />} />
            <Route path="subscriptions" element={<ExpertSubscriptionManagement />} />
            <Route path="subscriptions/plans" element={<ExpertSubscriptionPlans />} />
            <Route path="marketplace" element={<MarketplaceBrowse />} />
            <Route path="marketplace/service/:id" element={<CeoServiceDetail />} />
            <Route path="bids/:projectId" element={<BidForm />} />
            <Route path="engagements/:engagementId/bid" element={<CounterOfferReceived />} />
            <Route path="engagements/:engagementId/review" element={<ExpertReviewForm />} />
            <Route
              path="engagements/:engagementId/nda"
              element={<ExpertNdaClickThrough />}
            />
            <Route path="messages" element={<Navigate to="inbox" replace />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="inbox/:engagementId" element={<InboxPage />} />
            <Route path="notifications" element={<NotificationSystem />} />
            <Route
              path="engagements/:engagementId/milestones/:milestoneId"
              element={<ExpertMilestoneDetail />}
            />
            <Route
              path="engagements/:engagementId/milestones/:milestoneId/dispute"
              element={<DisputeFile />}
            />
            <Route
              path="engagements/:engagementId/milestones/:milestoneId/dispute/result"
              element={<DisputeResult />}
            />
          </Route>
        </Route>

        <Route element={<RoleRoute requiredSubtype="TECH_TEAM" />}>
          <Route path="/tech-team" element={<TechTeamDashboard />}>
            <Route index element={<TechTeamProjectsPage />} />
            <Route path="projects" element={<TechTeamProjectsPage />} />
            <Route path="projects/:id" element={<TechTeamProjectDetailPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="account-setting" element={<ProfileSettingPage />} />
            <Route path="submitted" element={<Stage4Submitted />} />
            <Route path="bids" element={<BidReviewList />} />
            <Route path="bids/:bidId" element={<BidReviewDetail />} />
            <Route path="bids/:bidId/approve" element={<BidApprove />} />
            <Route
              path="engagements/:engagementId/milestones"
              element={<TechTeamMilestoneList />}
            />
            <Route
              path="engagements/:engagementId/milestones/:milestoneId"
              element={<TechTeamMilestoneDetail />}
            />
            <Route
              path="engagements/:engagementId/review"
              element={<TechTeamReviewForm />}
            />
            <Route
              path="bids/:bidId/revision"
              element={<BidRevisionRequest />}
            />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="inbox/:engagementId" element={<InboxPage />} />
            <Route path="notifications" element={<NotificationSystem />} />
          </Route>
        </Route>

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

            <Route path="config/prompts" element={<PromptConfigPage />} />
            <Route path="config/void-codes" element={<VoidCodesConfigPage />} />
            <Route path="integrity" element={<IntegrityMonitor />} />

            <Route path="disputes" element={<DisputeMonitor />} />
            <Route path="disputes/:id" element={<DisputeDetail />} />
            <Route path="disputes/:id/resolve" element={<ResolutionConfirm />} />
            <Route path="users" element={<UserList />} />
            <Route path="settings" element={<PlatformSettings />} />

            <Route path="oversight/projects" element={<AdminProjectsPage />} />
            <Route path="oversight/engagements" element={<AdminEngagementsPage />} />
            <Route path="oversight/experts" element={<AdminExpertsPage />} />
          
            <Route path="ledger" element={<TransactionsLedger />} />
            <Route path="withdrawals" element={<WithdrawalRequests />} />
          </Route>
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<ErrorPage />} />
    </Route>,
  ),
);

export default function App() {
  return <RouterProvider router={router} />;
}