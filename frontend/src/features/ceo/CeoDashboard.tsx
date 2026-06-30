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
      {/* Subscription Banner */}
      {!hasSubscription && (
        <div className="mb-8">
          <DashboardBanner
            title="Upgrade to Client Pro"
            description="Supercharge your workflow with AI-powered PRD generation, priority matchmaking with elite Tech Teams, and 0% platform fees on all milestones."
            icon={<Sparkles className="h-5 w-5 text-emerald-400" />}
            buttonText="Upgrade now"
            onButtonClick={() => navigate('/ceo/subscription')}
          />
        </div>
      )}

      {/* Workspace / Quick Actions Section */}
      <div className="mb-8">
        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1">Workspace</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <DashboardBanner
            topLabel="AI Assistant"
            title="AI Elicitation Engine"
            description={
              mostRecentSession ? (
                <span className="block">
                  Stage {(mostRecentSession as any).currentStage || mostRecentSession.current_stage || 1} of 5 — {getStageName((mostRecentSession as any).currentStage || mostRecentSession.current_stage || 1)}
                </span>
              ) : (
                "Generate a PRD & match with experts."
              )
            }
            icon={<Bot className="h-6 w-6" />}
            buttonText="Go to projects"
            theme={mostRecentSession ? "outline-purple" : "outline"}
            className="lg:col-span-2"
            onButtonClick={() => navigate("/ceo/projects")}
          />
        </div>
      </div>

      {/* BOTTOM SECTION: Published Projects */}
      {allProjects.length > 0 && (
        <div className="mt-8">
          <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1">Projects List</h4>
          <div className="flex flex-col gap-4">
            {allProjects.map((project) => (
              <div key={project.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold uppercase tracking-wider">
                      <PlayCircle className="w-3.5 h-3.5" />
                      {project.state.replace(/_/g, ' ')}
                    </span>
                    {project.tier && (
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[11px] font-semibold uppercase rounded-md border border-purple-100">
                        {project.tier.replace(/_/g, ' ')}
                      </span>
                    )}
                    {((project as any).selfTechnical || project.self_technical) && (
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] font-semibold uppercase rounded-md border border-indigo-100">
                        Self-Managed Tech
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mb-1 group flex-wrap">
                    <h4 className="text-lg font-bold text-slate-900 truncate max-w-sm sm:max-w-md">
                      {project.projectName || `Project ${project.id}`}
                    </h4>
                  </div>
                  
                  <p className="text-sm text-slate-500 mb-3">
                    Created: {new Date(getSafeDate(project, 'createdAt')).toLocaleDateString()} &middot; Last updated: {new Date(getSafeDate(project, 'updatedAt')).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
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
