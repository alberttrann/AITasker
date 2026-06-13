import { useAuthStore } from '@store/auth.store';
import { UserRole } from '@/types/enums';
import { cn } from '@lib/utils';

export function RoleSwitcher() {
  const { activeRole, setRole } = useAuthStore();

  return (
    <div className="flex p-base bg-surface-container rounded-lg mb-lg relative">
      <button
        type="button"
        onClick={() => setRole(UserRole.CLIENT)}
        className={cn(
          "relative flex-1 py-xs text-center rounded font-label-md text-label-md transition-all duration-200 z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          activeRole === UserRole.CLIENT ? "text-on-primary bg-primary-container shadow-sm" : "text-secondary hover:bg-surface-variant"
        )}
      >
        <b><span className="relative">Client</span></b>
      </button>
      
      <button
        type="button"
        onClick={() => setRole(UserRole.EXPERT)}
        className={cn(
          "relative flex-1 py-xs text-center rounded font-label-md text-label-md transition-all duration-200 z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          activeRole === UserRole.EXPERT ? "text-on-primary bg-primary-container shadow-sm" : "text-secondary hover:bg-surface-variant"
        )}
      >
        <b><span className="relative">Expert</span></b>
      </button>
    </div>
  );
}
