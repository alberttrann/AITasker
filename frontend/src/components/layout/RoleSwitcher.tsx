import { useAuth } from '@hooks/use-auth';
import type { ActiveRole } from '@t/enums';
import type { UserRoleItem } from '@t/enums';
import { cn } from '@lib/utils';

interface RegisterRoleSwitcherProps {
  value: UserRoleItem;
  onChange: (role: UserRoleItem) => void;
}

export function RegisterRoleSwitcher({ value, onChange }: RegisterRoleSwitcherProps) {
  const handleSwitch = (e: React.MouseEvent, role: UserRoleItem) => {
    e.preventDefault();
    onChange(role);
  };

  return (
    <div className="flex p-2 bg-primary-bg rounded-xl mb-md relative border-2 border-primary-light/30 shadow-inner">
      <button
        type="button"
        onClick={(e) => handleSwitch(e, 'CLIENT_CEO')}
        className={cn(
          "relative flex-1 py-3 text-center rounded-md font-headline text-sm transition-all duration-300 z-10 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30",
          value === 'CLIENT_CEO' ? "text-white bg-tertiary shadow-md" : "text-primary-dark/60 hover:text-primary-dark hover:bg-white/50"
        )}
      >
        <b><span className="relative z-10">CLIENT</span></b>
      </button>

      <button
        type="button"
        onClick={(e) => handleSwitch(e, 'EXPERT')}
        className={cn(
          "relative flex-1 py-3 text-center rounded-md font-headline text-sm transition-all duration-300 z-10 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30",
          value === 'EXPERT' ? "text-white bg-tertiary shadow-md" : "text-primary-dark/60 hover:text-primary-dark hover:bg-white/50"
        )}
      >
        <b><span className="relative z-10">EXPERT</span></b>
      </button>
    </div>
  );
}

export function RoleSwitcher() {
  const { activeRole, switchRole } = useAuth();

  const handleSwitch = (e: React.MouseEvent, role: ActiveRole) => {
    e.preventDefault();
    switchRole.mutate({ activeRole: role });
  };
  return (
    <div className="flex p-2 bg-primary-bg rounded-xl mb-md relative border-2 border-primary-light/30 shadow-inner">
      <button
        type="button"
        onClick={(e) => handleSwitch(e, 'CLIENT' as ActiveRole)}
        className={cn(
          "relative flex-1 py-3 text-center rounded-lg font-headline text-sm transition-all duration-300 z-10 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30",
          activeRole === 'CLIENT' ? "text-white bg-tertiary shadow-md" : "text-primary-dark/60 hover:text-primary-dark hover:bg-white/50"
        )}
      >
        <b><span className="relative z-10">Client</span></b>
      </button>

      <button
        type="button"
        onClick={(e) => handleSwitch(e, 'EXPERT' as ActiveRole)}
        className={cn(
          "relative flex-1 py-3 text-center rounded-lg font-headline text-sm transition-all duration-300 z-10 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30",
          activeRole === 'EXPERT' ? "text-white bg-tertiary shadow-md" : "text-primary-dark/60 hover:text-primary-dark hover:bg-white/50"
        )}
      >
        <b><span className="relative z-10">Expert</span></b>
      </button>
    </div>
  );
}