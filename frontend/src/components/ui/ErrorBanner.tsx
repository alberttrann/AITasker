import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './button';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * ErrorBanner — reusable error state component.
 * Shows a user-friendly error message with an optional retry button.
 */
export function ErrorBanner({ message, onRetry, className = '' }: ErrorBannerProps) {
  return (
    <div
      className={`rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] p-6 text-center ${className}`}
      role="alert"
    >
      <AlertTriangle className="mx-auto h-8 w-8 text-[#EF4444]" />
      <p className="mt-3 font-headline text-[16px] font-semibold text-[#EF4444]">
        Something went wrong
      </p>
      <p className="mt-1 text-[14px] text-[#EF4444]">{message}</p>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={onRetry}
        >
          <RefreshCw size={14} className="mr-1.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
