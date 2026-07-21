import { cn } from '@/lib/utils';

type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const VARIANT_STYLES: Record<StatusVariant, string> = {
  success: 'bg-[#22C55E15] text-[#16A34A]',
  warning: 'bg-[#EAB30815] text-[#CA8A04]',
  error: 'bg-[#EF444415] text-[#DC2626]',
  info: 'bg-[#0EA5E915] text-[#0284C7]',
  neutral: 'bg-[#F1F5F9] text-[#475569]',
};

interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
  className?: string;
}

/**
 * StatusBadge — reusable status chip following Verdana Health chip design.
 * Uses uppercase tracking for polished, clinical feel.
 */
export function StatusBadge({
  label,
  variant = 'neutral',
  className = '',
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[4px] px-[12px] py-[4px] text-[12px] font-medium uppercase tracking-[0.5px]',
        VARIANT_STYLES[variant],
        className
      )}
    >
      {label}
    </span>
  );
}

/** Map common app statuses to variants */
export function variantFromStatus(
  status: string | undefined
): StatusVariant {
  if (!status) return 'neutral';
  const s = status.toUpperCase();
  if (['APPROVED', 'SELECTED', 'CONNECTED', 'COMPLETED', 'SUCCESS'].includes(s))
    return 'success';
  if (['PENDING', 'SUBMITTED', 'IN_PROGRESS', 'AWAITING_PAYMENT'].includes(s))
    return 'warning';
  if (['DECLINED', 'REVISION_REQUESTED', 'DISPUTED', 'REJECTED'].includes(s))
    return 'error';
  if (['DRAFT', 'TECH_REVIEW', 'CEO_REVIEW'].includes(s)) return 'info';
  return 'neutral';
}
