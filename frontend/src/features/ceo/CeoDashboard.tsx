import { useState, useEffect } from "react";
import { Outlet, useNavigate, Link } from "react-router-dom";
import TopNav from "@/components/layout/TopNav";
import DashboardGreeting from "@/components/layout/DashboardGreeting";
import { useProjects, useElicitationSessions } from "@/hooks/use-projects";
import { Sparkles, Bot, FileText, ArrowRight, Loader2, PlayCircle, Clock } from "lucide-react";
import { DashboardBanner } from "@/components/ui/DashboardBanner";

import { useAuth } from "@/hooks/use-auth";
//import { getActiveSession } from "@/hooks/use-elicitation"; // <-- Import cai nay de cap nhat ne

export function CeoOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { projects, isLoadingProjects } = useProjects();
  const { sessions, isLoadingSessions } = useElicitationSessions();

  const activeSessions = sessions.filter(s => s.state === 'IN_PROGRESS').sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  
  // Use the most recent active session for the banner
  const mostRecentSession = activeSessions.length > 0 ? activeSessions[0] : null;
  
  // Update localStorage with the latest session ID to keep it in sync
  useEffect(() => {
    if (mostRecentSession) {
      localStorage.setItem("currentSessionId", mostRecentSession.id);
    } else {
      localStorage.removeItem("currentSessionId");
    }
  }, [mostRecentSession]);
/*
  useEffect(() => {
      // DO NOT USE LOCAL STORAGE. Check the actual database.
      if (hasSubscription) {
        getActiveSession()
          .then((session) => {
            setHasActiveSession(!!session);
          })
          .catch(() => setHasActiveSession(false));
      }
    }, [hasSubscription]);
*/
  const hasSubscription = user?.subscriptionTier === "pro";

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

  return (
    <div className="w-full">
      <DashboardGreeting />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:auto-rows-[180px]">
        {/* Subscription Banner */}
        {!hasSubscription && (
          <DashboardBanner
            title="Upgrade to Client Pro"
            description="Supercharge your workflow with AI-powered PRD generation, priority matchmaking with elite Tech Teams, and 0% platform fees on all milestones."
            icon={<Sparkles className="h-5 w-5 text-emerald-400" />}
            buttonText="Upgrade now"
            className="lg:col-span-3 lg:row-span-1 h-full"
            onButtonClick={() => navigate('/ceo/subscription')}
          />
        )}

        {/* Elicitation banner */}
        {hasSubscription && (
          <DashboardBanner
            title="AI Elicitation Engine"
            description={
              mostRecentSession ? (
                <span className="block">
                  You have an elicitation session in progress.<br/>
                  <span className="font-semibold text-white mt-1 block">
                    Session: Stage {mostRecentSession.current_stage} of 5 — {getStageName(mostRecentSession.current_stage)}
                  </span>
                </span>
              ) : (
                "Define your project requirements through an interactive AI session. We'll automatically generate a technical PRD and match you with the perfect expert."
              )
            }
            icon={<Bot className="h-5 w-5 text-blue-400" />}
            buttonText="Go to projects"
            theme="blue"
            className="lg:col-span-3 lg:row-span-1 h-full"
            onButtonClick={() => navigate("/ceo/projects")}
          />
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
