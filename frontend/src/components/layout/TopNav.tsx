import { Link } from 'react-router-dom';
import { useAuthStore } from '@store/auth.store';

// ── Helpers ────────────────────────────────────────────────────────────────
const formatRole = (role?: string) =>
  role ? role.charAt(0) + role.slice(1).toLowerCase() : '';

export default function Navbar() {
  const { user, isAuthenticated } = useAuthStore();

  const initials = user
    ? `${user.full_name.split(' ')[0][0]}${user.full_name.split(' ').slice(-1)[0][0]}`.toUpperCase()
    : '';

  return (
    <header className="h-[56px] w-full fixed top-0 z-50 bg-[#252B31] border-b border-[#1E2530] text-[#F1F5F9] select-none">
      <div className="flex items-center justify-between h-full px-6 max-w-7xl mx-auto">

        {/* Logo / home link */}
        <Link to="/" className="flex items-center gap-2">
          <span className="font-semibold text-[16px] text-[#F1F5F9]">AITasker</span>
        </Link>

        {/* Auth state */}
        {!isAuthenticated ? (
          <Link
            to="/login"
            className="bg-[#0D4A33] text-[#F1F5F9] px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#0D4A33]/90 transition-colors"
          >
            Sign In
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium text-[#F1F5F9]">{user?.full_name}</p>
              <p className="text-xs text-[#5C5F61]">{formatRole(user?.active_role)}</p>
            </div>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0D4A33] text-[#F1F5F9] text-sm font-semibold">
              {initials}
            </div>
          </div>
        )}

       
      </div>
    </header>
  );
}