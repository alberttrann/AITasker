import { Route, Routes } from 'react-router-dom';

// Guards
import { GuestRoute, ProtectedRoute, RoleRoute } from '@lib/route-guards';

// Public pages
import LandingPage        from '@/components/pages/LandingPage';
import ErrorPage            from '@components/pages/ErrorPage';

// Guest-only auth pages
import LoginPage        from '@features/auth/LoginPage';
import RegisterPage     from '@features/auth/RegisterPage';

// Tech Team has a public registration route (no auth, link-based)
import { HandoffRegister }  from '@features/tech-team/auth/HandoffRegister';
import { LinkExpiredError } from '@features/tech-team/auth/LinkExpiredError';

// Dashboards — stub shells now, built out screen by screen
import CeoDashboard     from '@features/ceo/CeoDashboard';
import ExpertDashboard   from '@features/expert/ExpertDashboard';
import TechTeamDashboard from '@features/tech-team/TechTeamDashboard';
import AdminDashboard    from '@features/admin/AdminDashboard';

export default function App() {
  return (
    <Routes>

      {/* ── Public ─────────────────────────────────────────────────────── */}
      <Route path="/"                         element={<LandingPage />} />
      {/* Handoff link lands here — public so TECH_TEAM can register */}
      <Route path="/register/handoff/:token"  element={<HandoffRegister />} />
      <Route path="/register/handoff/expired" element={<LinkExpiredError />} />

      {/* ── Guest only (logged-in users are redirected away) ─────────── */}
      <Route element={<GuestRoute />}>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* ── Authenticated ────────────────────────────────────────────── */}
      <Route element={<ProtectedRoute />}>

        <Route element={<RoleRoute requiredSubtype="CEO" />}>
          {/* /ceo/* — all CEO screens will nest here */}
          <Route path="/ceo/*" element={<CeoDashboard />} />
        </Route>

        <Route element={<RoleRoute requiredRole="EXPERT" />}>
          {/* /expert/* — all Expert screens will nest here */}
          <Route path="/expert/*" element={<ExpertDashboard />} />
        </Route>

        <Route element={<RoleRoute requiredSubtype="TECH_TEAM" />}>
          {/* /tech-team/* — scoped to one linked project forever */}
          <Route path="/tech-team/*" element={<TechTeamDashboard />} />
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