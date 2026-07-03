import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { useUser } from '@/hooks/use-user';
import { SubscriptionPrice } from '@/types/enums';
import { useSubscription } from '@/hooks/use-subscription';
import { useNavigate, Link } from 'react-router-dom';
import { useWallet } from '@/hooks/use-wallet';
import { formatVND } from '@/lib/utils';
import { Check, Sparkles, Zap, Shield, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SubscriptionActivate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const store = useAuthStore();
  const { user } = store;
  const { data: wallet } = useWallet();
  const { activateSubscription } = useSubscription();
  const { updateProfile } = useUser(); // to fetch user on success or we can just use queryClient

  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const availableBalance = (wallet as any)?.availableBalance ?? wallet?.available_balance ?? 0;
  const price = SubscriptionPrice.CEO;
  const canAfford = availableBalance >= price;

  const handleActivate = () => {
    setErrorMsg(null);
    activateSubscription.mutate(
      { activeRole: user?.activeRole || 'CLIENT' },
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

  const getExpiryDate = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // If successfully activated
  if (isSuccess) {
    return (
      <div className="flex flex-col w-full min-h-[60vh] items-center justify-center py-12 px-4 animate-in fade-in zoom-in-95 duration-500 shrink-0 min-w-0">
        <div className="w-full max-w-5xl mx-auto flex items-center justify-center relative z-10 min-w-0">
          <div className="w-full max-w-lg sm:min-w-[480px] bg-white rounded-3xl shadow-2xl border border-emerald-100 p-8 sm:p-10 text-center relative overflow-hidden shrink-0">

            {/* Decorative background elements */}
            <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-emerald-50 to-transparent pointer-events-none" />
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-200 rounded-full blur-[50px] opacity-40 pointer-events-none" />

            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm relative z-10 shrink-0">
              <Sparkles size={36} className="animate-pulse shrink-0" />
            </div>

            <h2 className="text-3xl font-extrabold text-slate-900 mb-3 relative z-10 shrink-0">Pro Activated!</h2>
            <p className="text-slate-500 mb-8 relative z-10 px-4">Welcome to the premium experience. Your account is now fully supercharged.</p>

            <div className="bg-slate-50/80 rounded-2xl p-5 mb-8 text-left border border-slate-100 relative z-10 w-full">
              <div className="flex flex-row justify-between items-center mb-4 pb-4 border-b border-slate-200 w-full gap-4">
                <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider shrink-0">New Balance</span>
                <span className="text-lg font-bold text-slate-900 truncate min-w-0 text-right">{formatVND(availableBalance)}</span>
              </div>
              <div className="flex flex-row justify-between items-center w-full gap-4">
                <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider shrink-0">Expires</span>
                <span className="font-bold text-emerald-600 truncate min-w-0 text-right">{getExpiryDate()}</span>
              </div>
            </div>

            <Button
              className="w-full py-6 text-lg font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all relative z-10 shrink-0"
              variant="primary"
              onClick={() => navigate('/ceo')}
            >
              Back to Dashboard
            </Button>
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
            <Zap size={14} /> Power Up Your Workflow
          </div>

          <h1 className="text-4xl sm:text-5xl font-headline font-extrabold text-slate-900 leading-[1.1] mb-6">
            Unlock the <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">Client Pro</span> Experience
          </h1>

          <p className="text-lg text-slate-600 mb-8 leading-relaxed">
            Elevate your project management with AI-driven elicitation, priority expert matching, and secure milestone tracking.
          </p>

          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                <Sparkles size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">AI-Powered Elicitation</h4>
                <p className="text-sm text-slate-500">Automatically translate raw ideas into structured PRDs.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                <Shield size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Secure Escrow & Milestones</h4>
                <p className="text-sm text-slate-500">Funds are held safely until milestones are approved.</p>
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
                  {['Unlimited AI Project Elicitations', 'Priority Expert Matching', 'Milestone-based Escrow Payments', 'Dedicated Account Manager'].map((feat, i) => (
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
                    Activate Client Pro
                    <ChevronRight size={20} className="inline ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm text-center text-red-500 font-medium bg-red-50 py-2 rounded-lg">
                      Insufficient balance. Top up first.
                    </div>
                    <Link
                      to="/ceo/wallet"
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
