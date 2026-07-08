import React, { useState } from 'react';
import { useWallet, useTopUpWallet } from '@/hooks/use-wallet';
import { VietQRPanel } from '@/components/wallet/VietQRPanel';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

interface WalletTopUpProps {
  showContinue?: boolean;
}

export default function WalletTopUp({ showContinue = true }: WalletTopUpProps) {
  const [amountInput, setAmountInput] = useState<string>('');
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  const { data: wallet } = useWallet();
  const topUpMutation = useTopUpWallet();
  const navigate = useNavigate();

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) {
      setAmountInput('');
      return;
    }
    const formatted = rawValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    setAmountInput(formatted);
  };

  const handleGenerate = () => {
    const numericAmount = parseInt(amountInput.replace(/\./g, ''), 10);
    if (!numericAmount || numericAmount < 1000) return;
    setIsPaymentConfirmed(false);
    topUpMutation.mutate(numericAmount);
  };

  const handleCancel = () => {
    topUpMutation.reset();
    setAmountInput('');
    setIsPaymentConfirmed(false);
  };

  const availableBalance = wallet?.availableBalance ?? 0;
  const canContinue = availableBalance >= 500000;

  return (
    <div className="w-full flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 text-center">
        <h2 className="font-bold text-slate-900">Wallet Top-Up</h2>
      </div>

      <div className="p-5 sm:p-6 flex-1 flex flex-col min-w-0">

      {!topUpMutation.data ? (
        <div className="space-y-5 flex flex-col items-center flex-1 justify-center min-w-0">
          <div className="w-full min-w-0">
            <Label htmlFor="topup-amount" className="text-sm font-semibold text-slate-700">Amount (VND)</Label>
            <Input
              id="topup-amount"
              type="text"
              placeholder="MIN: 1.000 VND"
              value={amountInput}
              onChange={handleAmountChange}
              className="text-center mt-1.5 font-bold min-w-0 w-full text-lg py-2.5 placeholder:text-xs"
            />
          </div>

          <Button
            className="w-full font-semibold py-2.5"
            variant="primary"
            onClick={handleGenerate}
            disabled={!amountInput || parseInt(amountInput.replace(/\./g, ''), 10) < 1000 || topUpMutation.isPending}
            isLoading={topUpMutation.isPending}
          >
            Generate QR Code
          </Button>
        </div>
      ) : (
        <div className="flex flex-col animate-in fade-in zoom-in-95 duration-300 w-full min-w-0">
          <div className="w-full">
            <VietQRPanel
              qrCodeUrl={topUpMutation.data.qrCodeUrl}
              paymentReference={topUpMutation.data.paymentReference}
              amount={parseInt(amountInput.replace(/\./g, ''), 10)}
              onPaymentConfirmed={() => setIsPaymentConfirmed(true)}
            />
          </div>

          {/* Cancel button — only visible before payment is confirmed */}
          {!isPaymentConfirmed && (
            <button
              onClick={handleCancel}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors shadow-sm"
            >
              <X size={15} strokeWidth={2.5} />
              Cancel
            </button>
          )}

          {canContinue && showContinue && (
            <div className="mt-3 w-full animate-in slide-in-from-bottom-4 fade-in">
              <Button
                variant="primary"
                className="w-full font-semibold whitespace-normal h-auto leading-tight py-2.5 text-sm"
                onClick={() => navigate('/ceo/subscriptions/plans')}
              >
                Continue to Subscription
              </Button>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}