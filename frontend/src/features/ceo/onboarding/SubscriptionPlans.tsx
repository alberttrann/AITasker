import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { useSubscription, useSubscriptionPackages, useSubscriptionHistory, useSubscriptionStatus } from '@/hooks/use-subscription';
import { useNavigate, Link } from 'react-router-dom';
import { useWallet } from '@/hooks/use-wallet';
import { formatVND } from '@/lib/utils';
import { Check, Zap, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function SubscriptionPlans() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const store = useAuthStore();
  const { user } = store;
  const { data: wallet } = useWallet();
  const { activateSubscription: activateMutation } = useSubscription();
  const { data: packages, isLoading: isLoadingPackages } = useSubscriptionPackages();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const availableBalance = (wallet as any)?.availableBalance ?? (wallet as any)?.available_balance ?? 0;

  const { data: subStatus } = useSubscriptionStatus();
  const { data: history } = useSubscriptionHistory();
  const activePackage = history?.find((h) => !h.isExpired);
  const activePackageNames = subStatus?.isActive && activePackage 
    ? [activePackage.packageName] 
    : [];

  const handleActivate = (packageId: string) => {
    setErrorMsg(null);
    activateMutation.mutate(
      { activeRole: user?.activeRole || 'CLIENT', packageId },
      {
        onSuccess: async (data) => {
          store.setTokens(data.access_token, ''); 
          const { data: freshUser } = await apiClient.get('/users/me', {
            headers: { Authorization: `Bearer ${data.access_token}` }
          });
          store.setUser(freshUser);
          queryClient.setQueryData(['user', 'me'], freshUser);
          queryClient.invalidateQueries({ queryKey: ['wallet'] });
          navigate('/ceo/subscriptions', { state: { success: true } });
        },
        onError: (error: any) => {
          const msg = error.response?.data?.message || 'Failed to activate subscription.';
          setErrorMsg(Array.isArray(msg) ? msg[0] : msg);
        }
      }
    );
  };

  const clientPackages = (packages?.filter((p) => p.role === 'CLIENT') || []).sort(
    (a, b) => b.durationMonths - a.durationMonths
  );

  return (
    <div className="min-h-[80vh] w-full flex flex-col justify-start pt-6 pb-12 shrink-0 min-w-0">
      <div className="fixed top-1/4 left-1/4 w-[400px] h-[400px] bg-emerald-300 rounded-full blur-[100px] opacity-20 pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-[300px] h-[300px] bg-blue-300 rounded-full blur-[100px] opacity-20 pointer-events-none" />

      <div className="w-full max-w-[1440px] mx-auto flex flex-col gap-8 items-center justify-center relative z-10 px-6">
        
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-headline font-extrabold text-slate-900 leading-[1.1] mb-6">
            Unlock the <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">Client Pro</span> Experience
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Choose the perfect plan to elevate your project management with AI-driven elicitation, priority expert matching, and secure milestone tracking.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 text-red-700 text-sm font-medium rounded-xl border border-red-100 shadow-sm max-w-2xl w-full text-center">
            {errorMsg}
          </div>
        )}

        {isLoadingPackages ? (
          <div className="flex justify-center mt-8">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
          </div>
        ) : clientPackages.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-2xl w-full">
            <h3 className="text-lg font-bold text-slate-900 mb-2">No Packages Available</h3>
            <p className="text-slate-500">There are currently no active subscription packages for clients. Please check back later.</p>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-8 w-full">
            {clientPackages.map((pkg) => {
              const priceNum = Number(pkg.priceVnd);
              const canAfford = availableBalance >= priceNum;

              return (
                <div key={pkg.id} className="w-full max-w-sm sm:w-[340px] bg-white rounded-3xl shadow-xl shadow-emerald-500/5 border border-slate-200 overflow-hidden flex flex-col h-full relative group hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300 hover:-translate-y-1">
                  <div className="h-2 w-full bg-gradient-to-r from-emerald-400 to-teal-400" />
                  <div className="p-8 flex flex-col flex-1">
                    <div className="mb-6">
                      <h3 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 mb-2">{pkg.name}</h3>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-slate-900">{formatVND(priceNum)}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-500 mt-2 uppercase tracking-wider">{pkg.durationMonths} {pkg.durationMonths === 1 ? 'Month' : 'Months'} Access</p>
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
                      {activePackageNames.includes(pkg.name) ? (
                        <Button
                          className="w-full h-12 rounded-xl text-[15px] font-bold bg-slate-100 text-slate-500 cursor-not-allowed hover:bg-slate-100"
                          disabled
                        >
                          <Check size={20} className="inline mr-2" />
                          Current Plan
                        </Button>
                      ) : canAfford ? (
                        <Button
                          className="w-full h-12 rounded-xl text-[15px] font-bold"
                          variant="primary"
                          onClick={() => handleActivate(pkg.id)}
                          disabled={activateMutation.isPending}
                        >
                          {activateMutation.isPending ? 'Activating...' : 'Select Plan'}
                          <ChevronRight size={20} className="inline ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      ) : (
                        <Button
                          className="w-full h-12 rounded-xl text-[15px] font-bold bg-slate-100 text-slate-400 cursor-not-allowed hover:bg-slate-100"
                          disabled
                        >
                          Insufficient Balance
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
