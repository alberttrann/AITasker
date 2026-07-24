import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Landmark, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { formatVND } from '@/lib/utils';
import {
  useWallet,
  useBankLinkStatus,
  useCreateWithdrawal,
} from '@/hooks/use-wallet';

export default function WithdrawForm() {
  const navigate = useNavigate();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: bankStatus, isLoading: bankLoading } = useBankLinkStatus();
  const createWithdrawal = useCreateWithdrawal();

  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const availableBalance = wallet?.availableBalance ?? 0;
  const isBankLinked = !!bankStatus?.isLinked;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isBankLinked) {
      setError('You must link a bank account before withdrawing.');
      return;
    }

    if (!amount || amount < 2000) {
      setError('Minimum withdrawal amount is 2,000 VND.');
      return;
    }

    if (amount > availableBalance) {
      setError('Withdrawal amount exceeds your available balance.');
      return;
    }

    createWithdrawal.mutate(
      { amount },
      {
        onSuccess: () => {
          navigate('/expert/wallet');
        },
        onError: (err: any) => {
          setError(
            err?.response?.data?.message || 'Failed to request withdrawal. Please try again.'
          );
        },
      }
    );
  };

  if (walletLoading || bankLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="py-10 px-4 sm:px-6 max-w-[800px] mx-auto w-full">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/expert/wallet')}
          className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          Withdraw Funds
        </h1>
      </div>

      <Card>
        <CardContent className="p-6 sm:p-8 space-y-6">
          {!isBankLinked ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
              <Landmark className="mx-auto h-10 w-10 text-amber-500 mb-3" />
              <h3 className="text-lg font-bold text-amber-900 mb-2">No Bank Account Linked</h3>
              <p className="text-amber-800 text-sm mb-4">
                You need to link a bank account to receive your payouts.
              </p>
              <Button onClick={() => navigate('/expert/wallet/link-bank')}>
                Link Bank Account
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Destination Account Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-500">
                    <Landmark size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Transfer To</p>
                    <p className="text-sm font-semibold text-slate-900">{bankStatus.holderName}</p>
                    <p className="text-xs font-mono text-slate-500">{bankStatus.bankAccountXid}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/expert/wallet/link-bank')}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Change
                </button>
              </div>

              {/* Amount Input */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <label className="text-sm font-bold text-slate-700">Amount (VND)</label>
                  <span className="text-xs font-medium text-slate-500">
                    Available: <strong className="text-slate-900">{formatVND(availableBalance)}</strong>
                  </span>
                </div>
                
                <div className="relative">
                  <CurrencyInput
                    value={amount}
                    onChange={setAmount}
                    placeholder="Enter amount (Min 2,000 VND)"
                    className={`w-full text-lg px-4 py-3 rounded-xl border ${error ? 'border-red-300 focus:ring-red-500/20' : 'border-slate-300 focus:ring-blue-500/20'} focus:outline-none focus:ring-2`}
                  />
                  <button
                    type="button"
                    onClick={() => setAmount(availableBalance)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors"
                  >
                    Max
                  </button>
                </div>
                
                {error && (
                  <div className="flex items-center gap-1.5 text-red-600 text-sm font-medium mt-2">
                    <AlertTriangle size={14} />
                    {error}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100">
                <Button 
                  type="submit" 
                  variant="primary" 
                  className="w-full py-3 text-base"
                  disabled={createWithdrawal.isPending}
                >
                  {createWithdrawal.isPending ? (
                    <><Spinner size="sm" className="mr-2 text-white" /> Processing...</>
                  ) : (
                    'Confirm Withdrawal'
                  )}
                </Button>
                <p className="text-center text-xs text-slate-500 mt-3">
                  Transfers typically arrive within 1-3 business days.
                </p>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}