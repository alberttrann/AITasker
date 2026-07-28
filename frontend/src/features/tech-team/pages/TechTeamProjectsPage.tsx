import { useState, useMemo } from "react";
import { useProjects } from "@/hooks/use-projects";
import { Loader2, PlayCircle, ArrowRight, Clock, FolderOpen, Link2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useTechTeamEngagements } from "@/hooks/use-engagements";
import DashboardGreeting from "@/components/layout/DashboardGreeting";
import Widget, { WidgetMetric } from "@/components/dashboard/Widget";
import { DataList } from "@/components/layout/Table";

export default function TechTeamProjectsPage() {
  const { projects, isLoadingProjects } = useProjects(true);
  const { data: engagements, isLoading: isLoadingEngagements } = useTechTeamEngagements();

  const [projectsSort, setProjectsSort] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'name_desc'>('date_desc');

  const projectMetrics: WidgetMetric[] = [
    {
      id: "linked-projects",
      label: "Linked Projects",
      value: projects?.length || 0,
      icon: <FolderOpen className="w-5 h-5" />,
      href: "/tech-team/projects",
      subValue: "Projects currently accessible",
    }
  ];

  const engagementMetrics: WidgetMetric[] = [
    {
      id: "active-engagements",
      label: "Active Engagements",
      value: engagements?.filter(e => !["PENDING", "CLOSED", "CANCELLED", "DECLINED"].includes(e.state)).length || 0,
      icon: <Link2 className="w-5 h-5" />,
      href: "/tech-team/projects",
      subValue: "Active handoffs",
    }
  ];

  const getSafeDate = (obj: any, field: 'updatedAt' | 'createdAt') => {
    return new Date(obj[field] || obj[field === 'updatedAt' ? 'updated_at' : 'created_at'] || 0).getTime();
  };

  const sortedProjects = useMemo(() => {
    if (!projects) return [];
    return [...projects].sort((a, b) => {
      if (projectsSort === 'date_desc') return getSafeDate(b, 'createdAt') - getSafeDate(a, 'createdAt');
      if (projectsSort === 'date_asc') return getSafeDate(a, 'createdAt') - getSafeDate(b, 'createdAt');
      
      const nameA = (a.projectName || `Project ${a.id}`).toLowerCase();
      const nameB = (b.projectName || `Project ${b.id}`).toLowerCase();
      if (projectsSort === 'name_asc') return nameA.localeCompare(nameB);
      return nameB.localeCompare(nameA);
    });
  }, [projects, projectsSort]);

  return (
    <div className="w-full max-w-[1440px] mx-auto space-y-6 animate-in fade-in duration-300">
      <DashboardGreeting />

      <div className="mb-8">
        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1">Workspace</h4>
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 lg:auto-rows-[180px]">
          <Widget metrics={projectMetrics} variant="blue" className="h-full" />
          <Widget metrics={engagementMetrics} variant="emerald" className="h-full" />
        </div>
      </div>

      <div className="mb-8">
        {isLoadingProjects || isLoadingEngagements ? (
          <div className="bg-white border border-slate-200 rounded-[20px] p-12 flex flex-col items-center justify-center min-h-[200px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <DataList
            title="Linked Projects"
            sortOptions={[
              { label: 'Newest First', value: 'date_desc' },
              { label: 'Oldest First', value: 'date_asc' },
              { label: 'Name (A-Z)', value: 'name_asc' },
              { label: 'Name (Z-A)', value: 'name_desc' },
            ]}
            currentSort={projectsSort}
            onSortChange={(val) => setProjectsSort(val as any)}
            isEmpty={sortedProjects.length === 0}
            emptyState={
              <div className="bg-white border border-slate-200 rounded-[20px] p-8 flex flex-col items-center justify-center text-center min-h-[240px]">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Waiting for CEO</h3>
                <p className="text-slate-500 text-sm max-w-sm">
                  Your CEO is currently finalizing the project specifications. Once the project is published, it will appear here.
                </p>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-6">
              {sortedProjects.map((project) => {
                const activeEngagement = engagements?.find(
                  (engagement) =>
                    (engagement.projectId === project.id || (engagement as any).project_id === project.id) &&
                    !["PENDING", "CLOSED", "CANCELLED", "DECLINED"].includes(engagement.state),
                );
                const currentProjectName = project.projectName ?? activeEngagement?.project?.projectName ?? `Project ${project.id.slice(0, 8)}`;

                return (
                  <div key={project.id} className="bg-white border border-slate-200 rounded-[20px] p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold uppercase tracking-wider">
                          <PlayCircle className="w-3.5 h-3.5" />
                          {project.state.replace(/_/g, ' ')}
                        </span>
                        {project.tier && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold uppercase rounded-md border border-blue-100">
                            {project.tier.replace(/_/g, ' ')}
                          </span>
                        )}
                        {project.selfTechnical && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold uppercase rounded-md border border-blue-100">
                            Self-Managed Tech
                          </span>
                        )}
                      </div>
                      
                      <h4 className="text-xl font-bold text-slate-900 mb-2 truncate">
                        {currentProjectName}
                      </h4>
                      
                      <p className="text-sm text-slate-500 mb-4">
                        Created: {new Date(getSafeDate(project, 'createdAt')).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-2 sm:mt-0">
                      <Link
                        to={`/tech-team/projects/${project.id}`}
                        id={`link-view-tech-project-${project.id}`}
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
                );
              })}
            </div>
          </DataList>
        )}
      </div>
    </div>
  );
}
