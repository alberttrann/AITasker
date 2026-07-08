import { FileQuestion } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * EmptyState — reusable empty state placeholder.
 * Shows an icon, title, description, and optional action slot.
 */
export function EmptyState({
  icon,
  title = 'Nothing here yet',
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-[12px] border border-dashed border-slate-200 bg-surface-base p-10 text-center ${className}`}
    >
      <div className="mx-auto text-[#94A3B8]">
        {icon || <FileQuestion className="mx-auto h-10 w-10" />}
      </div>
      <h3 className="mt-4 font-headline text-[18px] font-semibold text-[#64748B]">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-[14px] text-[#94A3B8]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
