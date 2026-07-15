import React, { useEffect, useState } from 'react';
import { Copy, CheckCircle } from 'lucide-react';
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
}

export function VietQRPanel({
  qrCodeUrl,
  paymentReference,
  amount,
  bankName = 'MB Bank',
  accountNumber = '0394654576',
  onPaymentConfirmed,
}: VietQRPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [initialBalance, setInitialBalance] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { data: walletData } = useWallet();

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
    if (isConfirmed || initialBalance === null || !walletData) return;

    const currentBalance = (walletData as any).availableBalance ?? (walletData as any).available_balance ?? 0;
    if (currentBalance > initialBalance) {
      setIsConfirmed(true);
      onPaymentConfirmed?.();
      queryClient.invalidateQueries({ queryKey: ['wallet', 'transactions'] });
    }
  }, [walletData, initialBalance, isConfirmed, onPaymentConfirmed, queryClient]);

  // Polling fallback
  useEffect(() => {
    if (isConfirmed || initialBalance === null) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    }, 3000);

    return () => clearInterval(interval);
  }, [isConfirmed, queryClient, initialBalance]);

  // TODO: Implement socket listener for `payment:confirmed`
  // useEffect(() => {
  //   const handleConfirmed = () => { setIsConfirmed(true); onPaymentConfirmed?.(); };
  //   socket.on('payment:confirmed', handleConfirmed);
  //   return () => socket.off('payment:confirmed', handleConfirmed);
  // }, []);

  return (
    <div className="flex flex-col items-center w-full space-y-6">
      {/* QR Display */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative w-full flex justify-center group">
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
      ) : (
        <div className="flex items-center justify-center gap-3 text-slate-500 bg-slate-50/50 px-4 py-3 rounded-lg w-full border border-slate-100">
          <Spinner size="sm" className="text-slate-400" />
          <span className="text-sm font-medium">Waiting for payment confirmation...</span>
        </div>
      )}
    </div>
  );
}
