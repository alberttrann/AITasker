import { Outlet, useNavigate } from 'react-router-dom';
import TopNav from "@/components/layout/TopNav"
import DashboardGreeting from "@/components/layout/DashboardGreeting";
import { DashboardBanner } from "@/components/ui/DashboardBanner";
import { Sparkles, Edit3 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useExpertProfile } from '@/hooks/use-expert-profile';
import { useSubscriptionStatus } from '@/hooks/use-subscription';

export function ExpertOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile, isLoadingProfile } = useExpertProfile();
  const { data: subStatus, isLoading: isLoadingSub } = useSubscriptionStatus();
  
  const hasSubscription = subStatus?.tier === 'pro';
  const hasClaimedProfile = profile && (profile.domainDepths?.length > 0 || profile.seamClaims?.length > 0 || profile.profile?.stackTagsJson?.length > 0);

  return (
    <div className="w-full">
      <DashboardGreeting />
      {/* Subscription Banner */}
      {isLoadingSub ? (
        <div className="mb-8">
          <div className="w-full h-[140px] bg-white border border-slate-200 rounded-[24px] p-6 flex flex-col justify-between animate-pulse">
            <div className="flex justify-between items-start">
              <div className="space-y-4">
                <div className="h-7 w-64 bg-slate-200 rounded-md"></div>
                <div className="h-4 w-3/4 max-w-lg bg-slate-100 rounded-md"></div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-100"></div>
            </div>
            <div className="h-10 w-36 bg-slate-200 rounded-lg mt-4"></div>
          </div>
        </div>
      ) : !hasSubscription && (
        <div className="mb-8">
          <DashboardBanner
            title="Upgrade to Expert Pro"
            description="Supercharge your earnings with priority project matching, premium profile placement, and 0% withdrawal fees."
            icon={<Sparkles className="h-5 w-5 text-emerald-400" />}
            buttonText="Upgrade now"
            onButtonClick={() => navigate('/expert/subscription')}
          />
        </div>
      )}

      {/* Workspace Section */}
      <div className="mb-8">
        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1">Workspace</h4>
        {isLoadingProfile ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-2 h-auto bg-white border border-slate-200 rounded-[20px] p-6 flex flex-col justify-between animate-pulse min-h-[160px]">
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-3">
                  <div className="h-3 w-24 bg-slate-200 rounded"></div>
                  <div className="h-6 w-56 bg-slate-200 rounded"></div>
                  <div className="h-4 w-48 bg-slate-100 rounded"></div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-slate-100 shrink-0"></div>
              </div>
              <div className="h-10 w-32 bg-slate-200 rounded-lg"></div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <DashboardBanner
              topLabel="Recommended for you"
              title="Build Your Expert Profile"
              description="Define your tech stack to get matched."
              icon={<Edit3 className="h-6 w-6" />}
              buttonText="Build Profile"
              theme="outline"
              className="lg:col-span-2"
              onButtonClick={() => navigate('/expert/expert-profile')}
            />
          </div>
        )}
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