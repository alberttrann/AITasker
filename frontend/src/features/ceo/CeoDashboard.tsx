import { Outlet } from 'react-router-dom';
import TopNav from "@/components/layout/TopNav";

import { Sparkles } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';

export function CeoOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const hasSubscription = user?.subscriptionTier === 'pro';

  return (
    <div className="w-full">
      {/* Subscription Banner */}
      {!hasSubscription && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-700 p-8 shadow-lg">
          {/* Subtle graphic background elements */}
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 text-white pr-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-6 w-6 text-yellow-300" />
                <h2 className="text-2xl font-bold sm:text-3xl tracking-tight">Unlock Expert CEO Insights</h2>
              </div>
              <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
                Get exclusive access to predictive market analytics, 1-on-1 executive coaching, and advanced forecasting tools to scale your business faster.
              </p>
            </div>
            <button 
              onClick={() => navigate('/ceo/subscription')}
              className="shrink-0 whitespace-nowrap rounded-xl bg-white px-8 py-3.5 font-semibold text-indigo-700 shadow-md transition-all hover:bg-blue-50 hover:shadow-xl hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-white/30 active:scale-95"
            >
              Upgrade now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CeoDashboard() {
  return (
    <>
      <TopNav />
      <div className="bg-background min-h-screen">
        <div className="w-full max-w-[1440px] mx-auto px-6 py-6 sm:py-8">
          <Outlet />
        </div>
      </div>
    </>
  );
}