import { Outlet, useNavigate } from 'react-router-dom';
import TopNav from "@/components/layout/TopNav"
import DashboardGreeting from "@/components/layout/DashboardGreeting";
import { DashboardBanner } from "@/components/ui/DashboardBanner";
import { Sparkles, Edit3 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useExpertProfile } from '@/hooks/use-expert-profile';

export function ExpertOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile, isLoadingProfile } = useExpertProfile();
  
  const hasSubscription = user?.subscriptionTier === 'pro';
  const hasClaimedProfile = profile && (profile.domainDepths?.length > 0 || profile.seamClaims?.length > 0 || profile.profile?.stackTagsJson?.length > 0);

  return (
    <div className="w-full">
      <DashboardGreeting />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:auto-rows-[180px]">
        {/* Subscription Banner */}
        {!hasSubscription && (
          <DashboardBanner
            title="Upgrade to Expert Pro"
            description="Supercharge your earnings with priority project matching, premium profile placement, and 0% withdrawal fees."
            icon={<Sparkles className="h-5 w-5 text-emerald-400" />}
            buttonText="Upgrade now"
            className="lg:col-span-3 lg:row-span-1 h-full"
            onButtonClick={() => navigate('/expert/subscription')}
          />
        )}
        {/* Missing Profile Banner */}
        {!isLoadingProfile && !hasClaimedProfile && (
          <DashboardBanner
            title="Build Your Expert Profile"
            description="You haven't built your expert profile yet. Define your domains, integration seams, and tech stack to get matched with high-value AI projects."
            icon={<Edit3 className="h-5 w-5 text-blue-400" />}
            buttonText="Build Profile"
            theme="blue"
            className="lg:col-span-3 lg:row-span-1 h-full"
            onButtonClick={() => navigate('/expert/expert-profile')}
          />
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