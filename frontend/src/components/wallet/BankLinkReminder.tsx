import { useNavigate } from 'react-router-dom';
import { Banknote, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useUserProfile } from '@/hooks/use-wallet';

interface BankLinkReminderProps {
  context: string;
  className?: string;
  dismissible?: boolean;
}

export function BankLinkReminder({ context, className = '', dismissible = true }: BankLinkReminderProps) {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useUserProfile();
  const [dismissed, setDismissed] = useState(false);

  const isBankLinked = !!(profile?.sepay_bank_account_xid || profile?.bank_linked_at);

  if (isLoading || isBankLinked || dismissed) {
    return null;
  }

  return (
    <div
      className={`rounded-[8px] border border-[#FED7AA] bg-[#FFF7ED] p-4 flex items-start gap-3 ${className}`}
      role="alert"
    >
      <Banknote className="h-5 w-5 shrink-0 text-[#EA580C] mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-[#C2410C]">
          Link your bank account to get paid
        </p>
        <p className="mt-1 text-[13px] text-[#9A3412]">{context}</p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={() => navigate('/expert/wallet/link-bank')}
        >
          Link Bank Account
        </Button>
      </div>
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-[#C2410C]/60 hover:text-[#C2410C] transition-colors"
          aria-label="Dismiss for now"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}