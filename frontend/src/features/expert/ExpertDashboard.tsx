import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import TopNav from "@/components/layout/TopNav"
import DashboardGreeting from "@/components/layout/DashboardGreeting";
import { SuggestBox } from "@/components/ui/SuggestBox";
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
  const hasDomains = profile?.domainDepths?.length > 0;
  const hasSeams = profile?.seamClaims?.length > 0;
  const hasTags = profile?.profile?.stackTagsJson?.length > 0;
  const hasBio = !!profile?.profile?.bio;

  const isProfileIncomplete = !hasDomains || !hasSeams || !hasTags || !hasBio;

  const suggestBoxTitle = "Build Your Expert Profile";
  const suggestBoxDesc = "Complete your expert profile to stand out to CEOs and start matching with high-value projects.";

  const [showBuildProfile, setShowBuildProfile] = useState(true);
  const shouldShowSuggestBox = showBuildProfile && isProfileIncomplete && !isLoadingProfile;

  return (
    <div className="w-full">
      <DashboardGreeting />
      
      {/* 1. Banners (Always 4 col wide, no section title, directly under greeting) */}
      {isLoadingSub ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="lg:col-span-4 h-[140px] bg-white border border-slate-200 rounded-[24px] p-6 flex flex-col justify-between animate-pulse">
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <SuggestBox
            title="Upgrade to Expert Pro"
            description="Supercharge your earnings with priority project matching, premium profile placement, and 0% withdrawal fees."
            icon={<Sparkles className="h-5 w-5 text-emerald-400" />}
            buttonText="Upgrade now"
            onButtonClick={() => navigate('/expert/subscriptions/plans')}
            className="lg:col-span-4"
          />
        </div>
      )}

      {/* 2. FOR YOU Section (6 col grid) */}
      {shouldShowSuggestBox && (
        <div className="mb-8">
          <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1">For You</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            <SuggestBox
              topLabel="Recommended for you"
              title={suggestBoxTitle}
              description={suggestBoxDesc}
              icon={<Edit3 className="h-6 w-6" />}
              buttonText="Complete Profile"
              theme="outline"
              className=""
              onButtonClick={() => navigate('/expert/service/expert-profile')}
              onDismiss={() => setShowBuildProfile(false)}
            />
          </div>
        </div>
      )}

      {/* 3. Workspace Section (4 col grid for widgets) */}
      <div className="mb-8">
        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1">Workspace</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {/* Widgets go here */}
        </div>
      </div>
    </div>
  );
}

export default function ExpertDashboard() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopNav />
      <main className="flex-grow w-full max-w-[1440px] mx-auto px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
