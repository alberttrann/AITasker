import React, { useEffect, useState } from 'react';
import { Copy, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { formatVND } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/hooks/use-wallet';
import { Spinner } from '@/components/ui/Spinner';

interface VietQRPanelProps {
  qrCodeUrl: string;
  paymentReference: string;
  amount: number;
  bankName?: string;
  accountNumber?: string;
  onPaymentConfirmed?: () => void;
  /**
   * Optional ISO timestamp (or Date) this specific payment window expires at.
   * When provided, renders a live countdown and an expired state once passed.
   * Consumers without an expiry concept (e.g. wallet top-ups) can omit this
   * entirely — the panel behaves exactly as before when it's not passed.
   */
  expiresAt?: string | Date | null;
  /**
   * Called when the countdown reaches zero. Typically used by the caller to
   * stop polling and/or prompt the user to regenerate the payment info.
   */
  onExpired?: () => void;
}

function useCountdown(expiresAt?: string | Date | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) return null;

  const target = new Date(expiresAt).getTime();
  const msRemaining = target - now;
  const isExpired = msRemaining <= 0;
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { isExpired, hours, minutes, seconds, msRemaining };
}

export function VietQRPanel({
  qrCodeUrl,
  paymentReference,
  amount,
  bankName = 'MB Bank',
  accountNumber = '0394654576',
  onPaymentConfirmed,
  expiresAt,
  onExpired,
}: VietQRPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [initialBalance, setInitialBalance] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { data: walletData } = useWallet();
  const countdown = useCountdown(expiresAt);
  const hasFiredExpiredCallback = React.useRef(false);

  useEffect(() => {
    if (countdown?.isExpired && !hasFiredExpiredCallback.current) {
      hasFiredExpiredCallback.current = true;
      onExpired?.();
    }
    if (!countdown?.isExpired) {
      hasFiredExpiredCallback.current = false;
    }
  }, [countdown?.isExpired, onExpired]);

  // Get initial balance when component mounts
  useEffect(() => {
    if (walletData && initialBalance === null) {
      const balance = (walletData as any).availableBalance ?? (walletData as any).available_balance ?? 0;
      setInitialBalance(balance);
    }
  }, [walletData, initialBalance]);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Check balance updates
  useEffect(() => {
    if (isConfirmed || initialBalance === null || !walletData || countdown?.isExpired) return;

    const currentBalance = (walletData as any).availableBalance ?? (walletData as any).available_balance ?? 0;
    if (currentBalance > initialBalance) {
      setIsConfirmed(true);
      onPaymentConfirmed?.();
      queryClient.invalidateQueries({ queryKey: ['wallet', 'transactions'] });
    }
  }, [walletData, initialBalance, isConfirmed, onPaymentConfirmed, queryClient, countdown?.isExpired]);

  // Polling fallback — also stops once expired, to not keep silently
  // polling a payment window that can no longer succeed
  useEffect(() => {
    if (isConfirmed || initialBalance === null || countdown?.isExpired) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    }, 3000);

    return () => clearInterval(interval);
  }, [isConfirmed, queryClient, initialBalance, countdown?.isExpired]);

  return (
    <div className="flex flex-col items-center w-full space-y-6">
      {/* Expiry countdown / warning — only rendered when expiresAt is provided */}
      {countdown && !isConfirmed && (
        <div
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ${
            countdown.isExpired
              ? 'bg-red-50 text-red-700 border border-red-200'
              : countdown.hours < 1
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-slate-50 text-slate-500 border border-slate-100'
          }`}
        >
          {countdown.isExpired ? (
            <>
              <AlertTriangle size={16} />
              <span>This payment window has expired.</span>
            </>
          ) : (
            <>
              {countdown.hours < 1 && <AlertTriangle size={16} />}
              {countdown.hours >= 1 && <Clock size={16} />}
              <span>
                {countdown.hours < 1
                  ? 'This payment window is about to expire — '
                  : 'Payment window expires in '}
                {String(countdown.hours).padStart(2, '0')}:
                {String(countdown.minutes).padStart(2, '0')}:
                {String(countdown.seconds).padStart(2, '0')}
              </span>
            </>
          )}
        </div>
      )}

      {/* QR Display */}
      <div
        className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative w-full flex justify-center group ${
          countdown?.isExpired ? 'opacity-40 grayscale pointer-events-none' : ''
        }`}
      >
        <div className="w-full max-w-[280px] aspect-square relative bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center">
          <img 
            src={qrCodeUrl} 
            alt="VietQR Code" 
            className="w-full h-full object-contain mix-blend-multiply"
          />
        </div>
      </div>

      {/* Transfer Info */}
      <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center pb-3 border-b border-slate-200/60 gap-4">
          <span className="text-sm font-medium text-slate-500 shrink-0">Bank</span>
          <span className="text-sm font-bold text-slate-900 truncate text-right">{bankName}</span>
        </div>

        <div className="flex justify-between items-center pb-3 border-b border-slate-200/60 gap-4">
          <span className="text-sm font-medium text-slate-500 shrink-0">Account</span>
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
            <span className="text-sm font-bold text-slate-900 truncate" title={accountNumber}>{accountNumber}</span>
            <button 
              onClick={() => handleCopy(accountNumber, 'account')}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors shrink-0"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center pb-3 border-b border-slate-200/60 gap-4">
          <span className="text-sm font-medium text-slate-500 shrink-0">Amount</span>
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
            <span className="text-sm font-bold text-slate-900 truncate">{formatVND(amount)}</span>
            <button 
              onClick={() => handleCopy(amount.toString(), 'amount')}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors shrink-0"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center gap-4">
          <span className="text-sm font-medium text-slate-500 shrink-0">Memo</span>
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
            <span className="text-sm font-mono font-bold text-slate-900 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded truncate" title={paymentReference}>{paymentReference}</span>
            <button 
              onClick={() => handleCopy(paymentReference, 'memo')}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors shrink-0"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
        {copiedField && (
          <p className="text-xs text-emerald-600 text-right mt-1 font-medium animate-in fade-in">Copied to clipboard!</p>
        )}
      </div>

      {/* State */}
      {isConfirmed ? (
        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-3 rounded-lg w-full justify-center">
          <CheckCircle size={20} />
          <span className="text-sm font-semibold">Payment received!</span>
        </div>
      ) : countdown?.isExpired ? (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg w-full justify-center">
          <AlertTriangle size={18} />
          <span className="text-sm font-semibold">This payment window has closed. Regenerate payment info to try again.</span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3 text-slate-500 bg-slate-50/50 px-4 py-3 rounded-lg w-full border border-slate-100">
          <Spinner size="sm" className="text-slate-400" />
          <span className="text-sm font-medium">Waiting for payment confirmation...</span>
        </div>
      )}
    </div>
  );
}