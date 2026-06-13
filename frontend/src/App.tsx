import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@store/auth.store';
import { useAuthContext } from '@lib/auth-context';
import type { ActiveRole, ClientSubtype } from '@t/enums';

//  Lazy-load dashboard layouts (split by role for bundle efficiency) 
// Tuấn Khang + Minh Thức fill these in as screens are built in Phase 5–7.
import CeoDashboard       from '@features/ceo/CeoDashboard';
import ExpertDashboard    from '@features/expert/ExpertDashboard';
import TechTeamDashboard  from '@features/tech-team/TechTeamDashboard';
import AdminDashboard     from '@features/admin/AdminDashboard';

// Auth screens (Tuấn Khang, Phase 1–2)
import LoginPage    from '@features/auth/LoginPage';
import RegisterPage from '@features/auth/RegisterPage';

// Spinner shown while AuthProvider checks the token 
function FullPageSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
    </div>
  );
}

// Protected route — redirects to /login if not authenticated 
function Protected({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

// Role guard — redirects to / if the user's role doesn't match 
function RoleGuard({
  children,
  role,
  subtype,
}: {
  children:  React.ReactNode;
  role?:     ActiveRole;
  subtype?:  ClientSubtype;
}) {
  const activeRole    = useAuthStore((s) => s.activeRole);
  const clientSubtype = useAuthStore((s) => s.clientSubtype);

  const roleOk    = !role    || activeRole    === role;
  const subtypeOk = !subtype || clientSubtype === subtype;

  return roleOk && subtypeOk ? <>{children}</> : <Navigate to="/" replace />;
}

// Root redirect — sends user to their dashboard on login 
function RootRedirect() {
  const activeRole    = useAuthStore((s) => s.activeRole);
  const clientSubtype = useAuthStore((s) => s.clientSubtype);
  const isAuth        = useAuthStore((s) => s.isAuthenticated);

  if (!isAuth)               return <Navigate to="/login"     replace />;
  if (activeRole === 'ADMIN')  return <Navigate to="/admin"     replace />;
  if (activeRole === 'EXPERT') return <Navigate to="/expert"    replace />;
  if (clientSubtype === 'CEO')       return <Navigate to="/ceo"       replace />;
  if (clientSubtype === 'TECH_TEAM') return <Navigate to="/tech-team" replace />;
  return <Navigate to="/login" replace />;
}

// App 
export default function App() {
  const { isLoading } = useAuthContext();

  // Hold all rendering until the token check completes — prevents flash of login page on refresh for already-authenticated users.
  if (isLoading) return <FullPageSpinner />;

  return (
    <Routes>
      {/* Public */}
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Root — redirect based on role */}
      <Route path="/" element={<RootRedirect />} />

      {/* CEO dashboard */}
      <Route
        path="/ceo/*"
        element={
          <Protected>
            <RoleGuard role="CLIENT" subtype="CEO">
              <CeoDashboard />
            </RoleGuard>
          </Protected>
        }
      />

      {/* Expert dashboard */}
      <Route
        path="/expert/*"
        element={
          <Protected>
            <RoleGuard role="EXPERT">
              <ExpertDashboard />
            </RoleGuard>
          </Protected>
        }
      />

      {/* TECH_TEAM dashboard */}
      <Route
        path="/tech-team/*"
        element={
          <Protected>
            <RoleGuard role="CLIENT" subtype="TECH_TEAM">
              <TechTeamDashboard />
            </RoleGuard>
          </Protected>
        }
      />

      {/* Admin dashboard */}
      <Route
        path="/admin/*"
        element={
          <Protected>
            <RoleGuard role="ADMIN">
              <AdminDashboard />
            </RoleGuard>
          </Protected>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}