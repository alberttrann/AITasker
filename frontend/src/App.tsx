import { Route, Routes } from "react-router-dom";

// Guards
import { GuestRoute, ProtectedRoute, RoleRoute } from "@lib/route-guards";

// Public pages
import LandingPage from "@/components/pages/LandingPage";
import ErrorPage from "@components/pages/ErrorPage";

// Tech Team has a public registration route (no auth, link-based)
import { HandoffRegister } from "@features/tech-team/auth/HandoffRegister";
import { LinkExpiredError } from "@features/tech-team/auth/LinkExpiredError";

// Dashboards — stub shells now, built out screen by screen
import CeoDashboard from "@features/ceo/CeoDashboard";
import { CeoOverview } from "@features/ceo/CeoDashboard";
import ExpertDashboard, {
  ExpertOverview,
} from "@features/expert/ExpertDashboard";
import TechTeamDashboard from "@features/tech-team/TechTeamDashboard";
import TechTeamOverview from "@features/tech-team/TechTeamOverview";
import Stage4Submitted from "@features/tech-team/stage4/Stage4Submitted";
import AdminDashboard from "@features/admin/AdminDashboard";
import ProfilePage from "./components/pages/UserProfilePage";
import ProfileSettingPage from "./components/pages/ProfileSettingPage";
import WalletPage from "./components/wallet/WalletPage";
import ExpertWallet from "@features/expert/wallet/ExpertWallet";
import BankHubLink from "@features/expert/wallet/BankHubLink";

import SubscriptionActivate from "@features/ceo/onboarding/SubscriptionActivate";
import ExpertSubscriptionActivate from "@features/expert/onboarding/SubscriptionActivate";
import ElicitationWizard from "@features/ceo/elicitation/ElicitationWizard";
import ShortlistView from "@features/ceo/shortlist/ShortlistView";
import ProjectsPage from "@features/ceo/pages/ProjectsPage";
import SessionsListPage from "@features/ceo/pages/SessionsListPage";
import ExpertProfilePage from "@features/expert/profile/ExpertProfilePage";

export default function App() {
  return (
    <Routes>
      {/* ── Public ─────────────────────────────────────────────────────── */}
      <Route path="/" element={<LandingPage />} />
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
            <Route path="profile" element={<ProfilePage />} />
            <Route path="account-setting" element={<ProfileSettingPage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="session-history" element={<SessionsListPage />} />
            <Route path="subscription" element={<SubscriptionActivate />} />
            <Route path="elicitation" element={<ElicitationWizard />} />
            <Route path="shortlist/:projectId" element={<ShortlistView />} />
          </Route>
        </Route>

        <Route element={<RoleRoute requiredRole="EXPERT" />}>
          {/* /expert/* — all Expert screens will nest here */}
          <Route path="/expert" element={<ExpertDashboard />}>
            <Route index element={<ExpertOverview />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="expert-profile" element={<ExpertProfilePage />} />
            <Route path="account-setting" element={<ProfileSettingPage />} />
            <Route path="wallet" element={<ExpertWallet />} />
            <Route path="wallet/link-bank" element={<BankHubLink />} />
            <Route
              path="subscription"
              element={<ExpertSubscriptionActivate />}
            />
          </Route>
        </Route>

        <Route element={<RoleRoute requiredSubtype="TECH_TEAM" />}>
          {/* /tech-team/* — scoped to one linked project forever */}
          <Route path="/tech-team" element={<TechTeamDashboard />}>
            <Route index element={<TechTeamOverview />} />
            <Route path="submitted" element={<Stage4Submitted />} />
          </Route>
        </Route>

        <Route element={<RoleRoute requiredRole="ADMIN" />}>
          {/* /admin/* — all Admin screens will nest here */}
          <Route path="/admin/*" element={<AdminDashboard />} />
        </Route>
      </Route>

      {/* ── 404 ──────────────────────────────────────────────────────── */}
      <Route path="/*" element={<ErrorPage />} />
    </Routes>
  );
}
