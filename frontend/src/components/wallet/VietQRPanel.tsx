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
  const { walletData } = useWallet();

  // Get initial balance when component mounts
  useEffect(() => {
    if (walletData) {
      const balance = (walletData as any).availableBalance ?? (walletData as any).available_balance ?? 0;
      setInitialBalance(balance);
    }
  }, [walletData]);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Polling fallback
  useEffect(() => {
    if (isConfirmed || initialBalance === null) return;

    const interval = setInterval(async () => {
      try {
        await queryClient.invalidateQueries({ queryKey: ['wallet'] });
        const currentBalance = (walletData as any).availableBalance ?? (walletData as any).available_balance ?? 0;
        
        if (currentBalance > initialBalance) {
          setIsConfirmed(true);
          onPaymentConfirmed?.();
        }
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
      } catch (err) {
        console.error('Polling error', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isConfirmed, queryClient, initialBalance, onPaymentConfirmed]);

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
        <div className="flex justify-between items-center pb-3 border-b border-slate-200/60">
          <span className="text-sm font-medium text-slate-500">Bank</span>
          <span className="text-sm font-bold text-slate-900">{bankName}</span>
        </div>

        <div className="flex justify-between items-center pb-3 border-b border-slate-200/60">
          <span className="text-sm font-medium text-slate-500">Account</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">{accountNumber}</span>
            <button 
              onClick={() => handleCopy(accountNumber, 'account')}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center pb-3 border-b border-slate-200/60">
          <span className="text-sm font-medium text-slate-500">Amount</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">{formatVND(amount)}</span>
            <button 
              onClick={() => handleCopy(amount.toString(), 'amount')}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-slate-500">Memo</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold text-slate-900 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">{paymentReference}</span>
            <button 
              onClick={() => handleCopy(paymentReference, 'memo')}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
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
