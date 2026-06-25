import React, { useState } from 'react';
import { useWallet, useTopUpWallet } from '@/hooks/use-wallet';
import { VietQRPanel } from '@/components/wallet/VietQRPanel';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { useNavigate } from 'react-router-dom';

interface WalletTopUpProps {
  showContinue?: boolean;
  isModal?: boolean;
}

export default function WalletTopUp({ showContinue = true, isModal = false }: WalletTopUpProps) {
  const [amountInput, setAmountInput] = useState<string>('');
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
    if (!numericAmount || numericAmount < 10000) return;
    topUpMutation.mutate(numericAmount);
  };

  const availableBalance = wallet?.availableBalance ?? 0;
  const canContinue = availableBalance >= 500000;

  return (
    // FIX 1: If it's a modal, give it generous modal padding (p-6). Otherwise, use the sidebar styling.
    <div className={`w-full flex flex-col h-full ${isModal ? 'p-6 sm:p-8' : 'p-5 sm:p-6 bg-white border border-slate-200 rounded-xl shadow-sm'}`}>
      
      <div className="text-center mb-6">
        {/* FIX 2: Dynamic header size. Larger text for the modal, standard for the sidebar */}
        <h2 className={`${isModal ? 'text-2xl' : 'text-xl'} font-bold text-slate-900 mb-1`}>Wallet Top-Up</h2>
        <p className={`${isModal ? 'text-base' : 'text-sm'} text-slate-500`}>Fund your wallet to start hiring experts</p>
      </div>

      {!topUpMutation.data ? (
        <div className="space-y-5 flex flex-col items-center flex-1 justify-center min-w-0">
          {/* FIX 3: If in a modal, allow the input wrapper to expand up to max-w-sm */}
          <div className={`w-full min-w-0 ${isModal ? 'max-w-sm' : ''}`}>
            <Label htmlFor="topup-amount" className="text-sm font-semibold text-slate-700">Amount (VND)</Label>
            <Input 
              id="topup-amount"
              type="text" 
              placeholder="MIN: 10.000 VND"
              value={amountInput}
              onChange={handleAmountChange}
              // Dynamic input height/text size
              className={`text-center mt-1.5 font-bold min-w-0 w-full ${isModal ? 'text-xl py-3 placeholder:text-sm' : 'text-lg py-2.5 placeholder:text-xs'}`}
            />
          </div>

          {/* FIX 4: Expand the button in modal mode */}
          <Button 
            className={`w-full font-semibold ${isModal ? 'max-w-sm py-3 text-base' : 'py-2.5'}`} 
            variant="primary"
            onClick={handleGenerate}
            disabled={!amountInput || parseInt(amountInput.replace(/\./g, ''), 10) < 10000 || topUpMutation.isPending}
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
            />
          </div>

          {canContinue && showContinue && (
            <div className="mt-6 w-full animate-in slide-in-from-bottom-4 fade-in">
              <Button 
                variant="primary" 
                className={`w-full font-semibold whitespace-normal h-auto leading-tight ${isModal ? 'py-3 text-base' : 'py-2.5 text-sm'}`}
                onClick={() => navigate('/ceo/subscription')}
              >
                Continue to Subscription
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}