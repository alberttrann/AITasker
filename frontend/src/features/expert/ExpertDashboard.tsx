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
  const { data: subStatus } = useSubscriptionStatus();
  
  const hasSubscription = subStatus?.tier === 'pro';
  const hasClaimedProfile = profile && (profile.domainDepths?.length > 0 || profile.seamClaims?.length > 0 || profile.profile?.stackTagsJson?.length > 0);

  return (
    <div className="w-full">
      <DashboardGreeting />
      {/* Subscription Banner */}
      {!hasSubscription && (
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
      {!isLoadingProfile && (
        <div className="mb-8">
          <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1">Workspace</h4>
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
        </div>
      )}
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