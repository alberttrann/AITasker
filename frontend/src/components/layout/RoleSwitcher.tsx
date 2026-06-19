import { useAuthStore } from '@store/auth.store';
import type { ActiveRole } from '@t/enums';
import { cn } from '@lib/utils';

export function RoleSwitcher() {
  const activeRole  = useAuthStore((s) => s.activeRole);
  const switchRole  = useAuthStore((s) => s.switchRole);

  return (
    <div className="flex p-base bg-surface-container rounded-lg mb-md relative">
      <button
        type="button"
        onClick={() => switchRole('CLIENT' as ActiveRole)}
        className={cn(
          "relative flex-1 py-xs text-center rounded font-label-md text-label-md transition-all duration-200 z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          activeRole === 'CLIENT' ? "text-on-primary bg-primary-container shadow-sm" : "text-secondary hover:bg-surface-variant"
        )}
      >
        <b><span className="relative">Client</span></b>
      </button>

      <button
        type="button"
        onClick={() => switchRole('EXPERT' as ActiveRole)}
        className={cn(
          "relative flex-1 py-xs text-center rounded font-label-md text-label-md transition-all duration-200 z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          activeRole === 'EXPERT' ? "text-on-primary bg-primary-container shadow-sm" : "text-secondary hover:bg-surface-variant"
        )}
      >
        <b><span className="relative">Expert</span></b>
      </button>
    </div>
  );
}