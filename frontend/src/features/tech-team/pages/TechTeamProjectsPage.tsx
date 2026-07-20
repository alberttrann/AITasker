import { useProjects } from "@/hooks/use-projects";
import { Loader2, PlayCircle, ArrowRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useTechTeamEngagements } from "@/hooks/use-engagements";

export default function TechTeamProjectsPage() {
  const { projects, isLoadingProjects } = useProjects(true);
  const { data: engagements, isLoading: isLoadingEngagements } = useTechTeamEngagements();
  const activeProject = projects?.[0];
  const activeEngagement = engagements?.find(
    (engagement) =>
      engagement.projectId === activeProject?.id &&
      !["PENDING", "CLOSED", "CANCELLED", "DECLINED"].includes(engagement.state),
  );
  const currentProjectName =
    activeProject?.projectName ?? activeEngagement?.project?.projectName;

  return (
    <div className="w-full max-w-[1440px] mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="mb-8">
        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1">Linked Project</h4>
        
        {isLoadingProjects || isLoadingEngagements ? (
          <div className="bg-white border border-slate-200 rounded-[20px] p-12 flex flex-col items-center justify-center min-h-[200px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : activeProject ? (
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white border border-slate-200 rounded-[20px] p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold uppercase tracking-wider">
                    <PlayCircle className="w-3.5 h-3.5" />
                    {activeProject.state.replace(/_/g, ' ')}
                  </span>
                  {activeProject.tier && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold uppercase rounded-md border border-blue-100">
                      {activeProject.tier.replace(/_/g, ' ')}
                    </span>
                  )}
                  {activeProject.selfTechnical && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold uppercase rounded-md border border-blue-100">
                      Self-Managed Tech
                    </span>
                  )}
                </div>
                
                <h4 className="text-xl font-bold text-slate-900 mb-2 truncate">
                  {currentProjectName || `Project ${activeProject.id.slice(0, 8)}`}
                </h4>
                
                <p className="text-sm text-slate-500 mb-4">
                  Created: {new Date(activeProject.createdAt || Date.now()).toLocaleDateString()}
                </p>
                
              </div>
              <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-2 sm:mt-0">
                <Link
                  to={`/tech-team/projects/${activeProject.id}`}
                  id={`link-view-tech-project-${activeProject.id}`}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-800 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                >
                  View Specifications <ArrowRight className="w-4 h-4" />
                </Link>
                {activeEngagement && (
                  <Link
                    to={`/tech-team/engagements/${activeEngagement.id}/milestones`}
                    id={`link-open-tech-milestones-${activeEngagement.id}`}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
                  >
                    Open Milestones <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            <div className="h-auto bg-white border border-slate-200 rounded-[20px] p-8 flex flex-col items-center justify-center text-center min-h-[240px]">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Waiting for CEO</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                Your CEO is currently finalizing the project specifications. Once the project is published, it will appear here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
