import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

import { useSubscription, useSubscriptionHistory, useSubscriptionStatus } from '@/hooks/use-subscription';
import { useSubscriptionPackages } from '@/hooks/use-config';
import { useNavigate, Link } from 'react-router-dom';
import { useWallet } from '@/hooks/use-wallet';
import { formatVND } from '@/lib/utils';
import { Check, Zap, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SubscriptionPlans() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: wallet } = useWallet();
  const { activateSubscription } = useSubscription();
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
    activateSubscription.mutate(
      { activeRole: user?.activeRole || 'EXPERT', packageId },
      {
        onSuccess: async (data) => {
          navigate('/expert/subscriptions', { state: { success: true } });
        },
        onError: (error: any) => {
          const msg = error.response?.data?.message || 'Failed to activate subscription.';
          setErrorMsg(Array.isArray(msg) ? msg[0] : msg);
        }
      }
    );
  };

  const expertPackages = (packages?.filter((p) => p.role === 'EXPERT') || []).sort(
    (a, b) => b.durationMonths - a.durationMonths
  );

  return (
    <div className="min-h-[80vh] w-full flex flex-col justify-start pt-6 pb-12 shrink-0 min-w-0">
      <div className="fixed top-1/4 left-1/4 w-100 h-100 bg-emerald-300 rounded-full blur-[100px] opacity-20 pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-75 h-75 bg-blue-300 rounded-full blur-[100px] opacity-20 pointer-events-none" />

      <div className="w-full max-w-360 mx-auto flex flex-col gap-8 items-center justify-center relative z-10 px-6">
        
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-headline font-extrabold text-slate-900 leading-[1.1] mb-6">
            Unlock the <span className="text-transparent bg-clip-text bg-linear-to-r from-emerald-500 to-teal-400">Expert Pro</span> Experience
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Elevate your freelance career with priority matching, premium project access, and 0% withdrawal fees.
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
        ) : expertPackages.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-2xl w-full">
            <h3 className="text-lg font-bold text-slate-900 mb-2">No Packages Available</h3>
            <p className="text-slate-500">There are currently no active subscription packages for experts. Please check back later.</p>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-8 w-full">
            {clientPackages.map((pkg) => {
              const priceNum = Number(pkg.priceVnd);
              const canAfford = availableBalance >= priceNum;

              return (
                <div key={pkg.id} className="w-full max-w-sm sm:w-85 bg-white rounded-3xl shadow-xl shadow-emerald-500/5 border border-slate-200 overflow-hidden flex flex-col h-full relative group hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300 hover:-translate-y-1">
                  <div className="h-2 w-full bg-linear-to-r from-emerald-400 to-teal-400" />
                  <div className="p-8 flex flex-col flex-1">
                    <div className="mb-6">
                      <h3 className="text-4xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-emerald-600 to-teal-500 mb-2">{pkg.name}</h3>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-slate-900">{formatVND(priceNum)}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-500 mt-2 uppercase tracking-wider">{pkg.durationMonths} {pkg.durationMonths === 1 ? 'Month' : 'Months'} Access</p>
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
                          className="w-full h-12 rounded-xl text-[15px] font-bold shadow-emerald-glow hover:brightness-105 transition-all"
                          variant="primary"
                          onClick={() => handleActivate(pkg.id)}
                          disabled={activateSubscription.isPending}
                          isLoading={activateSubscription.isPending}
                        >
                          Select Plan
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
