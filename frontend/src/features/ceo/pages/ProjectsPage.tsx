import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useProjects, useElicitationSessions, useDeleteElicitationSession } from "@/hooks/use-projects";
import { ConfirmModal } from "@/components/ui/modal";
import { FileText, ArrowRight, Loader2, PlayCircle, Clock, ArrowLeft, Plus, Trash2 } from "lucide-react";

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, isLoadingProjects } = useProjects();
  const { sessions, isLoadingSessions } = useElicitationSessions();
  const deleteSession = useDeleteElicitationSession();
  
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const activeSessions = sessions.filter(s => s.state !== 'COMPLETED').sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const allProjects = projects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const hasHistory = activeSessions.length > 0 || allProjects.length > 0;

  const handleStartNewProject = () => {
    localStorage.removeItem("currentSessionId");
    navigate("/ceo/elicitation");
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-600 hover:text-slate-900"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <h3 className="text-2xl font-bold text-slate-900">Your Projects</h3>
        </div>
        <button
          onClick={handleStartNewProject}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors shrink-0"
        >
          <Plus className="w-5 h-5" />
          Start New Project
        </button>
      </div>
      
      {isLoadingProjects || isLoadingSessions ? (
        <div className="flex items-center justify-center py-12">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !hasHistory ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-slate-900 mb-1">No projects yet</h4>
          <p className="text-slate-500 mb-6">Start a new project to get matched with top AI experts.</p>
          <button
            onClick={handleStartNewProject}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Start New Project
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          
          {/* TOP SECTION: Elicitation In Progress */}
          {activeSessions.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1">Elicitation in progress</h4>
              <div className="flex flex-col gap-4">
                {activeSessions.map((session) => (
                  <div key={session.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold uppercase tracking-wider">
                          <Clock className="w-3.5 h-3.5" />
                          Draft
                        </span>
                        {session.scenario_type && (
                          <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-[11px] font-semibold uppercase rounded-md border border-orange-100">
                            {session.scenario_type.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <h4 className="text-lg font-bold text-slate-900 mb-1 truncate">
                        Project {session.id}
                      </h4>
                      <p className="text-sm text-slate-500">
                        Stage {session.current_stage} of 5 &middot; Last updated {new Date(session.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-center sm:items-end gap-1 mt-2 sm:mt-0 shrink-0">
                      <button
                        onClick={() => {
                          localStorage.setItem('currentSessionId', session.id);
                          navigate("/ceo/elicitation");
                        }}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-50 text-blue-700 font-semibold rounded-lg hover:bg-blue-100 transition-colors w-full sm:w-auto"
                      >
                        Continue <ArrowRight className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => setSessionToDelete(session.id)}
                        className="w-full sm:w-auto text-xs text-red-600 hover:text-red-700 bg-red-50/50 hover:bg-red-100 font-medium transition-colors mt-1 px-3 py-1.5 rounded-md flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete draft
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* DIVIDER */}
          {(allProjects.length > 0 && activeSessions.length > 0) && (
            <div className="w-full h-px bg-slate-200"></div>
          )}

          {/* BOTTOM SECTION: Published Projects */}
          {allProjects.length > 0 && (
            <div>
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
                  {project.self_technical && (
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] font-semibold uppercase rounded-md border border-indigo-100">
                      Self-Managed Tech
                    </span>
                  )}
                </div>
                
                <h4 className="text-lg font-bold text-slate-900 mb-1 truncate">
                  Project {project.id}
                </h4>
                
                <p className="text-sm text-slate-500 mb-3">
                  Published {new Date(project.created_at).toLocaleDateString()}
                </p>
                
                {/* Domains and Seams Tags */}
                {((project.required_domains_json && project.required_domains_json.length > 0) || 
                  (project.required_seams_json && project.required_seams_json.length > 0)) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {project.required_domains_json?.map(d => (
                      <span key={d.domain_code} className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase tracking-wider rounded-md border border-slate-200">
                        {d.domain_code.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {project.required_seams_json?.map(s => (
                      <span key={s.seam_code} className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase tracking-wider rounded-md border border-slate-200">
                        {s.seam_code.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Link
                to={`/ceo/projects/${project.id}`}
                className="shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-50 text-slate-700 font-semibold rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors border border-slate-200 mt-2 sm:mt-0"
              >
                View Details <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        onConfirm={() => {
          if (sessionToDelete) {
            deleteSession.mutate(sessionToDelete);
            if (localStorage.getItem("currentSessionId") === sessionToDelete) {
              localStorage.removeItem("currentSessionId");
            }
          }
          setSessionToDelete(null);
        }}
        title="Delete Draft"
        confirmText={deleteSession.isPending ? "Deleting..." : "Delete draft"}
        cancelText="Cancel"
        isDestructive
      >
        Are you sure you want to delete this project draft? This action cannot be undone.
      </ConfirmModal>
    </div>
  );
}
