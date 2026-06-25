import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { UserDto } from '@/types/api.types';
import { useNavigate, Link } from 'react-router-dom';
import { useWallet } from '@/hooks/use-wallet';
import { formatVND } from '@/lib/utils';
import { Check, Sparkles, Zap, Shield, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function SubscriptionActivate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const store = useAuthStore();
  const { user } = store;
  const { data: wallet } = useWallet();

  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const availableBalance = (wallet as any)?.availableBalance ?? wallet?.available_balance ?? 0;
  const price = 500000;
  const canAfford = availableBalance >= price;

  const activateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ access_token: string }>('/subscriptions/activate', {
        activeRole: user?.activeRole || 'CLIENT'
      });
      return data;
    },
    onSuccess: async (data) => {
      // 1. Store the new access_token
      store.setTokens(data.access_token, ''); // refresh token will be preserved by auth.store.ts
      
      // 2. Fetch updated user profile
      const { data: userRes } = await apiClient.get<UserDto>('/users/me');
      store.setUser(userRes);
      
      // 3. Invalidate queries to get updated balance and user info
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });

      setIsSuccess(true);
      setErrorMsg(null);
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || 'Failed to activate subscription.';
      setErrorMsg(Array.isArray(msg) ? msg[0] : msg);
    }
  });

  const handleActivate = () => {
    setErrorMsg(null);
    activateMutation.mutate();
  };

  const getExpiryDate = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // If successfully activated
  if (isSuccess) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-emerald-100 p-8 text-center relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-emerald-50 to-white -z-10" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-200 rounded-full blur-3xl opacity-40 -z-10" />
          
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Sparkles size={36} className="animate-pulse" />
          </div>
          
          <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Pro Activated!</h2>
          <p className="text-slate-500 mb-8">Welcome to the premium experience. Your account is now fully supercharged.</p>

          <div className="bg-slate-50 rounded-2xl p-4 mb-8 text-left border border-slate-100">
            <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-200">
              <span className="text-sm font-medium text-slate-500">New Balance</span>
              <span className="font-bold text-slate-900">{formatVND(availableBalance - price)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-500">Expires</span>
              <span className="font-semibold text-emerald-600">{getExpiryDate()}</span>
            </div>
          </div>

          <Button 
            className="w-full py-4 text-lg font-bold shadow-emerald-glow hover:brightness-105 transition-all"
            variant="primary"
            onClick={() => navigate('/ceo/elicitation')}
          >
            Start Your First AI Project
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-50/50">
      
      {/* Background Orbs */}
      <div className="fixed top-1/4 left-1/4 w-[400px] h-[400px] bg-emerald-300 rounded-full blur-[100px] opacity-20 pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-[300px] h-[300px] bg-blue-300 rounded-full blur-[100px] opacity-20 pointer-events-none" />

      <div className="w-full max-w-5xl mx-auto flex flex-col md:flex-row gap-8 items-stretch justify-center relative z-10">
        
        {/* Left Side: Copy & Info */}
        <div className="flex-1 flex flex-col justify-center px-4 md:px-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-widest rounded-full w-fit mb-6 shadow-sm">
            <Zap size={14} /> Power Up Your Workflow
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-headline font-extrabold text-slate-900 leading-[1.1] mb-6">
            Unlock the <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">Client Pro</span> Experience
          </h1>
          
          <p className="text-lg text-slate-600 mb-8 max-w-lg leading-relaxed">
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
        <div className="flex-[0.8] max-w-md w-full mx-auto">
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
                    disabled={activateMutation.isPending}
                    isLoading={activateMutation.isPending}
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
