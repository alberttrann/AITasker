import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { useUser } from '@/hooks/use-user';
import { useSubscription, useSubscriptionStatus } from '@/hooks/use-subscription';
import { SubscriptionPrice } from '@/types/enums';
import { useNavigate, Link } from 'react-router-dom';
import { useWallet } from '@/hooks/use-wallet';
import { formatVND } from '@/lib/utils';
import { Check, Sparkles, Zap, Shield, ChevronRight, History } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function SubscriptionActivate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const store = useAuthStore();
  const { user } = store;
  const { data: wallet } = useWallet();
  const { activateSubscription } = useSubscription();
  const { data: subStatus } = useSubscriptionStatus();

  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const availableBalance = (wallet as any)?.availableBalance ?? wallet?.available_balance ?? 0;
  const price = SubscriptionPrice.EXPERT;
  const canAfford = availableBalance >= price;

  const handleActivate = () => {
    setErrorMsg(null);
    activateSubscription.mutate(
      { activeRole: user?.activeRole || 'EXPERT' },
      {
        onSuccess: async (data) => {
          // 1. Save the new access token
          store.setTokens(data.access_token, ''); 
          
          // 2. Fetch the fresh profile directly using the new token to guarantee store updates
          const { data: freshUser } = await apiClient.get('/users/me', {
            headers: { Authorization: `Bearer ${data.access_token}` }
          });
          
          // 3. Sync both Zustand and React Query cache immediately
          store.setUser(freshUser);
          queryClient.setQueryData(['user', 'me'], freshUser);
          
          // 4. Invalidate the wallet so the deducted balance is refreshed
          queryClient.invalidateQueries({ queryKey: ['wallet'] });
          
          setIsSuccess(true);
        },
        onError: (error: any) => {
          const msg = error.response?.data?.message || 'Failed to activate subscription.';
          setErrorMsg(Array.isArray(msg) ? msg[0] : msg);
        }
      }
    );
  };

  const getRemainingTime = () => {
    if (!subStatus?.expiresAt) return '30 days, 0 hours';
    const expires = new Date(subStatus.expiresAt);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();
    if (diff <= 0) return 'Expired';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days} days, ${hours} hours`;
  };

  const isPro = subStatus?.tier === 'pro';

  // If successfully activated or already subscribed
  if (isSuccess || isPro) {
    return (
      <div className="w-full max-w-5xl mx-auto px-6 py-12 animate-in fade-in duration-500">
        <h1 className="text-3xl font-headline font-extrabold text-slate-900 mb-8">
          Subscription Management
        </h1>
        
        {/* Current Subscription Section */}
        <div className="mb-12">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Current Plan</h2>
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl font-extrabold text-slate-900">Expert Pro</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider">Active</span>
              </div>
              <p className="text-slate-500 font-medium">You are currently on the premium tier.</p>
            </div>
            
            <div className="flex flex-col md:items-end gap-4 md:ml-0">
              <div className="text-left md:text-right">
                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest block mb-1">Time until expiration</span>
                <span className={`text-lg font-bold ${getRemainingTime() === 'Expired' ? 'text-red-500' : 'text-emerald-600'}`}>{getRemainingTime()}</span>
              </div>
              <div className="text-left md:text-right">
                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest block mb-1">Price</span>
                <span className="text-base font-bold text-slate-700">{formatVND(SubscriptionPrice.EXPERT)} / month</span>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription History */}
        <div>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Subscription History</h2>
          <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-sm flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4">
              <History size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No history available yet</h3>
            <p className="text-slate-500 max-w-sm">
              Your past subscription renewals and invoices will appear here once this feature is fully established.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] w-full flex flex-col justify-center py-8 sm:py-12 shrink-0 min-w-0">

      {/* Background Orbs */}
      <div className="fixed top-1/4 left-1/4 w-[400px] h-[400px] bg-emerald-300 rounded-full blur-[100px] opacity-20 pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-[300px] h-[300px] bg-blue-300 rounded-full blur-[100px] opacity-20 pointer-events-none" />

      <div className="w-full max-w-5xl mx-auto flex flex-col lg:flex-row gap-8 items-stretch justify-center relative z-10">

        {/* Left Side: Copy & Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-widest rounded-full w-fit mb-6 shadow-sm">
            <Zap size={14} /> Maximize Your Earnings
          </div>

          <h1 className="text-4xl sm:text-5xl font-headline font-extrabold text-slate-900 leading-[1.1] mb-6">
            Unlock the <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">Expert Pro</span> Experience
          </h1>

          <p className="text-lg text-slate-600 mb-8 leading-relaxed">
            Elevate your freelance career with priority matching, premium project access, and 0% withdrawal fees.
          </p>

          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                <Sparkles size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Priority Matching</h4>
                <p className="text-sm text-slate-500">Get shortlisted faster for high-value projects.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                <Shield size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">0% Platform Fees</h4>
                <p className="text-sm text-slate-500">Keep 100% of your earnings when withdrawing.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Pricing Card */}
        <div className="w-full lg:w-[380px] lg:shrink-0 mx-auto lg:mx-0">
          <div className="bg-white rounded-3xl shadow-2xl shadow-emerald-500/10 border border-slate-200 overflow-hidden flex flex-col h-full relative">

            {/* Top accent line */}
            <div className="h-2 w-full bg-gradient-to-r from-emerald-400 to-teal-400" />

            <div className="p-8 flex flex-col flex-1">
              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-900 mb-2">6-Month Access</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-slate-900">{formatVND(price)}</span>
                </div>
                <p className="text-sm text-slate-500 mt-2">One-time payment, no auto-renewal.</p>
              </div>

              <div className="flex-1">
                <ul className="space-y-4 mb-8">
                  {['Priority Project Matching', '0% Withdrawal Fees', 'Premium Profile Badge', 'Direct Client Invitations'].map((feat, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span className="text-slate-700 font-medium">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto">
                {/* Balance Display */}
                <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-600">Your Wallet Balance</span>
                  <span className={`font-bold ${canAfford ? 'text-slate-900' : 'text-red-500'}`}>
                    {formatVND(availableBalance)}
                  </span>
                </div>

                {errorMsg && (
                  <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm font-medium rounded-lg border border-red-100">
                    {errorMsg}
                  </div>
                )}

                {canAfford ? (
                  <Button
                    className="w-full py-4 text-lg font-bold shadow-emerald-glow hover:brightness-105 transition-all group"
                    variant="primary"
                    onClick={handleActivate}
                    disabled={activateSubscription.isPending}
                    isLoading={activateSubscription.isPending}
                  >
                    Activate Expert Pro
                    <ChevronRight size={20} className="inline ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm text-center text-red-500 font-medium bg-red-50 py-2 rounded-lg">
                      Insufficient balance. Top up first.
                    </div>
                    <Link
                      to="/expert/wallet"
                      className="block w-full text-center py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                    >
                      Top Up Wallet
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
