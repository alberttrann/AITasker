import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@store/auth.store';
import { useAuthContext } from '@lib/auth-context';
import { Spinner } from '@/components/ui/Spinner';
import type { ActiveRole, ClientSubtype } from '@t/enums';

// ─── shared helpers ──────────────────────────────────────────────────────────

/**
 * Maps the current user's role/subtype to their home path.
 * Mirrors the same logic in use-auth.ts redirectByRole()
 * so there's one source of truth for this mapping — keep them in sync.
 */
function homePath(
  role: ActiveRole | null,
  subtype: ClientSubtype | null,
): string {
  if (role === 'ADMIN')        return '/admin';
  if (role === 'EXPERT')       return '/expert';
  if (subtype === 'TECH_TEAM') return '/tech-team';
  if (subtype === 'CEO')       return '/ceo';
  return '/';
}

/**
 * Full-screen cover shown while AuthProvider re-hydrates on page load.
 * Prevents any guard from making a redirect decision before the
 * GET /users/me call has resolved.
 */
function AuthGate() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Spinner size="lg" className="text-primary" />
    </div>
  );
}

// ─── guards ──────────────────────────────────────────────────────────────────

/**
 * GuestRoute — renders children only for unauthenticated users.
 * Authenticated users are redirected to their dashboard.
 *
 * Use this to wrap /login and /register.
 */
export function GuestRoute() {
  const { isLoading } = useAuthContext();
  const { isAuthenticated, activeRole, clientSubtype } = useAuthStore();

  if (isLoading) return <AuthGate />;
  if (isAuthenticated) {
    return <Navigate to={homePath(activeRole, clientSubtype)} replace />;
  }
  return <Outlet />;
}

/**
 * ProtectedRoute — renders children only for authenticated users.
 * Unauthenticated users are redirected to /login.
 *
 * Nest all role-specific sections inside this.
 */
export function ProtectedRoute() {
  const { isLoading } = useAuthContext();
  const { isAuthenticated } = useAuthStore();

  if (isLoading) return <AuthGate />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
}

/**
 * RoleRoute — checks active role or client subtype.
 * Wrong-role users are redirected to their own dashboard (not a 403 page),
 * which handles dual-role users naturally.
 *
 * Supply exactly ONE of requiredRole or requiredSubtype.
 *
 * @example
 * <RoleRoute requiredRole="EXPERT" />
 * <RoleRoute requiredSubtype="CEO" />
 * <RoleRoute requiredSubtype="TECH_TEAM" />
 * <RoleRoute requiredRole="ADMIN" />
 */
interface RoleRouteProps {
  requiredRole?:    ActiveRole;
  requiredSubtype?: ClientSubtype;
}

export function RoleRoute({ requiredRole, requiredSubtype }: RoleRouteProps) {
  const { activeRole, clientSubtype } = useAuthStore();

  const allowed =
    (requiredRole    !== undefined && activeRole    === requiredRole)    ||
    (requiredSubtype !== undefined && clientSubtype === requiredSubtype);

  if (!allowed) {
    return <Navigate to={homePath(activeRole, clientSubtype)} replace />;
  }
  return <Outlet />;
}