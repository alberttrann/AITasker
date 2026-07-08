import { useState, useEffect } from "react";
import { Outlet, useNavigate, Link } from "react-router-dom";
import TopNav from "@/components/layout/TopNav";
import DashboardGreeting from "@/components/layout/DashboardGreeting";
import { useProjects, useElicitationSessions } from "@/hooks/use-projects";
import { Sparkles, Bot, FileText, ArrowRight, Loader2, PlayCircle, Clock } from "lucide-react";
import { SuggestBox } from "@/components/ui/SuggestBox";
import Widget, { WidgetMetric } from "@/components/dashboard/Widget";

import { useAuth } from "@/hooks/use-auth";
import { useSubscriptionStatus } from "@/hooks/use-subscription";
//import { getActiveSession } from "@/hooks/use-elicitation"; // <-- Import cai nay de cap nhat ne

export function CeoOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { projects, isLoadingProjects } = useProjects();
  const { sessions, isLoadingSessions } = useElicitationSessions();

  const activeSessions = sessions.filter(s => s.state === 'IN_PROGRESS').sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  
  // Use the most recent active session for the banner
  const mostRecentSession = activeSessions.length > 0 ? activeSessions[0] : null;

  const getSafeDate = (obj: any, field: 'updatedAt' | 'createdAt') => {
    return new Date(obj[field] || obj[field === 'updatedAt' ? 'updated_at' : 'created_at'] || 0).getTime();
  };

  const allProjects = projects.sort((a, b) => getSafeDate(b, 'createdAt') - getSafeDate(a, 'createdAt'));
/*
  useEffect(() => {
      // DO NOT USE LOCAL STORAGE. Check the actual database.
      if (hasSubscription) {
        getActiveSession()
          .then((session) => {
            setHasActiveSession(!!session);
          })
//        .catch(() => setHasActiveSession(false));
//      }
//    }, [hasSubscription]);
//*/
  const { data: subStatus, isLoading: isLoadingSub } = useSubscriptionStatus();
  const hasSubscription = subStatus?.tier === "pro";

  const getStageName = (stage: number) => {
    switch (stage) {
      case 1: return "Gap & Needs Analysis";
      case 2: return "Footprint Blueprint";
      case 3: return "Probes";
      case 4: return "Edge Cases";
      case 5: return "Synthesis";
      default: return "Unknown";
    }
  };



  const elicitationMetrics: WidgetMetric[] = [
    {
      id: 'elicitation',
      label: 'Elicitation Engine',
      value: mostRecentSession ? `Stage ${(mostRecentSession as any).currentStage || mostRecentSession.current_stage || 1}` : 'Ready',
      subValue: mostRecentSession ? getStageName((mostRecentSession as any).currentStage || mostRecentSession.current_stage || 1) : 'Generate a PRD',
      icon: <Bot size={20} />,
      href: '/ceo/projects'
    }
  ];

  return (
    <div className="w-full">
      <DashboardGreeting />
      {/* Subscription Banner */}
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
            title="Upgrade to Client Pro"
            description="Supercharge your workflow with AI-powered PRD generation, priority matchmaking with elite Tech Teams, and 0% platform fees on all milestones."
            icon={<Sparkles className="h-5 w-5 text-emerald-400" />}
            buttonText="Upgrade now"
            onButtonClick={() => navigate('/ceo/subscriptions/plans')}
            className="lg:col-span-4"
          />
        </div>
      )}

      {/* Workspace / Quick Actions Section */}
      <div className="mb-8">
        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1">Workspace</h4>
        {isLoadingSessions || isLoadingProjects ? (
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
            <Widget metrics={elicitationMetrics} variant="slate" />
          </div>
        )}
      </div>



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
