import { Outlet, useNavigate } from 'react-router-dom';
import TopNav from "@/components/layout/TopNav"
import DashboardGreeting from "@/components/layout/DashboardGreeting";
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export function ExpertOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const hasSubscription = user?.subscriptionTier === 'pro';

  return (
    <div className="w-full">
      <DashboardGreeting />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:auto-rows-[180px]">
        {/* Subscription Banner */}
        {!hasSubscription && (
          <div className="lg:col-span-3 lg:row-span-1 h-full">
            <div className="relative h-full overflow-hidden rounded-2xl bg-slate-900 p-8 shadow-xl border border-slate-800 flex flex-col justify-center">
              
              {/* Subtle graphic background elements */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Glowing orbs */}
                <div className="absolute -right-20 -top-32 h-96 w-96 rounded-full bg-emerald-500/20 blur-[80px]" />
                <div className="absolute top-1/2 left-1/4 h-64 w-64 -translate-y-1/2 rounded-full bg-teal-400/10 blur-[60px]" />
                <div className="absolute -bottom-24 -left-20 h-80 w-80 rounded-full bg-emerald-600/20 blur-[80px]" />
                
                {/* Dot grid pattern */}
                <svg className="absolute inset-0 h-full w-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="banner-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                      <circle cx="2" cy="2" r="1.5" fill="currentColor" className="text-white" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#banner-grid)" />
                </svg>
              </div>
              
              <div className="relative z-10 w-full flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 min-w-0 text-white sm:pr-8">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="shrink-0 bg-emerald-500/20 p-1.5 rounded-lg border border-emerald-500/30">
                      <Sparkles className="h-5 w-5 text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold sm:text-3xl tracking-tight text-white truncate">Upgrade to Expert Pro</h2>
                  </div>
                  <p className="text-slate-300 text-sm sm:text-base leading-relaxed mt-1 break-words">
                    Supercharge your earnings with priority project matching, premium profile placement, and 0% withdrawal fees.
                  </p>
                </div>
                <button 
                  onClick={() => navigate('/expert/subscription')}
                  className="shrink-0 whitespace-nowrap rounded-xl bg-emerald-500 px-8 py-3.5 font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 active:scale-95"
                >
                  Upgrade now
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="lg:col-span-3 lg:row-span-1 h-full">
          <div className="relative h-full overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center bg-transparent">
            <h2 className="text-2xl font-bold text-slate-700">Expert Dashboard</h2>
            <p className="text-slate-500 mt-2">This section is currently in development.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExpertDashboard() {
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