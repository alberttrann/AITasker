import React, { useState } from 'react';
import { useWallet, useTopUpWallet } from '@/hooks/use-wallet';
import { VietQRPanel } from '@/components/wallet/VietQRPanel';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Input';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

interface WalletTopUpProps {
  showContinue?: boolean;
}

export default function WalletTopUp({ showContinue = true }: WalletTopUpProps) {
  const [amountInput, setAmountInput] = useState<number | undefined>(undefined);
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  const { data: wallet } = useWallet();
  const topUpMutation = useTopUpWallet();
  const navigate = useNavigate();

  const handleGenerate = () => {
    if (!amountInput || amountInput < 1000) return;
    setIsPaymentConfirmed(false);
    topUpMutation.mutate(amountInput);
  };

  const handleCancel = () => {
    topUpMutation.reset();
    setAmountInput(undefined);
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
            <div className="mt-1.5 flex items-center justify-center border border-slate-200 rounded-lg bg-white overflow-hidden px-4">
              <CurrencyInput
                id="topup-amount"
                placeholder="MIN: 1.000 VND"
                value={amountInput}
                onChange={setAmountInput}
                className="text-center font-bold min-w-0 w-full text-lg py-2.5 placeholder:text-xs bg-transparent border-none"
              />
            </div>
          </div>

          <Button
            className="w-full font-semibold py-2.5"
            variant="primary"
            onClick={handleGenerate}
            disabled={!amountInput || amountInput < 1000 || topUpMutation.isPending}
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
              amount={amountInput || 0}
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
