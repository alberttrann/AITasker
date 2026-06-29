import { Link, useNavigate } from "react-router-dom";
import { useProjects, useElicitationSessions } from "@/hooks/use-projects";
import { FileText, ArrowRight, Loader2, PlayCircle, Clock } from "lucide-react";

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, isLoadingProjects } = useProjects();
  const { sessions, isLoadingSessions } = useElicitationSessions();

  const activeSessions = sessions.filter(s => s.state === 'IN_PROGRESS').sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const allProjects = projects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const hasHistory = activeSessions.length > 0 || allProjects.length > 0;

  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-slate-900 mb-6">Your Projects</h3>
      
      {isLoadingProjects || isLoadingSessions ? (
        <div className="flex items-center justify-center py-12">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !hasHistory ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-slate-900 mb-1">No projects yet</h4>
          <p className="text-slate-500">Start a new project to get matched with top AI experts.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {activeSessions.map((session) => (
            <div key={session.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5" />
                    Draft
                  </span>
                  <h4 className="text-base font-bold text-slate-900">
                    {session.archetype ? session.archetype.replace(/_/g, ' ') : 'New Project Draft'}
                  </h4>
                </div>
                <p className="text-sm text-slate-500">
                  Stage: {session.current_stage} of 5 &middot; Last updated {new Date(session.updated_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => {
                  localStorage.setItem('currentSessionId', session.id);
                  navigate("/ceo/elicitation");
                }}
                className="shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-50 text-blue-700 font-semibold rounded-lg hover:bg-blue-100 transition-colors"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
          
          {allProjects.map((project) => (
            <div key={project.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold uppercase tracking-wider">
                    <PlayCircle className="w-3.5 h-3.5" />
                    {project.state.replace(/_/g, ' ')}
                  </span>
                  <h4 className="text-base font-bold text-slate-900">
                    {project.archetype ? project.archetype.replace(/_/g, ' ') : 'Project'}
                  </h4>
                </div>
                <p className="text-sm text-slate-500">
                  Published {new Date(project.created_at).toLocaleDateString()}
                </p>
              </div>
              <Link
                to={`/ceo/projects/${project.id}`}
                className="shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-50 text-slate-700 font-semibold rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors border border-slate-200"
              >
                View Details <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
