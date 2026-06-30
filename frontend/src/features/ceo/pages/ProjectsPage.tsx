import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useProjects, useElicitationSessions, useDeleteElicitationSession, useUpdateProjectName, useActiveElicitationSession } from "@/hooks/use-projects";
import { ConfirmModal } from "@/components/ui/modal";
import { FileText, ArrowRight, Loader2, PlayCircle, Clock, ArrowLeft, Plus, Trash2, Pencil, Check, X, MoreVertical, History, Rocket } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { projects, isLoadingProjects } = useProjects();
  const { sessions, isLoadingSessions } = useElicitationSessions();
  const { activeSession, isLoadingActiveSession, isFetchingActiveSession } = useActiveElicitationSession();
  const deleteSession = useDeleteElicitationSession();
  const updateProjectName = useUpdateProjectName();
  const { user } = useAuth();
  const isSubscribed = user?.subscriptionTier === 'pro';
  
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['elicitation-sessions'] });
  }, [queryClient]);
  
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const getSafeDate = (obj: any, field: 'updatedAt' | 'createdAt') => {
    return new Date(obj[field] || obj[field === 'updatedAt' ? 'updated_at' : 'created_at'] || 0).getTime();
  };

  const allProjects = projects.sort((a, b) => getSafeDate(b, 'createdAt') - getSafeDate(a, 'createdAt'));

  const formatDraftName = (dateString: string) => {
    const date = new Date(dateString);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = String(date.getFullYear()).slice(-2);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${d}${m}${y}-${hh}${mm}`;
  };

  const handleSaveName = (id: string) => {
    if (!editNameValue.trim()) {
      setEditingProjectId(null);
      return;
    }
    updateProjectName.mutate(
      { id, projectName: editNameValue.trim() },
      {
        onSuccess: () => {
          setEditingProjectId(null);
        },
      }
    );
  };

  const handleStartNewProject = () => {
    navigate("/ceo/elicitation");
  };

  return (
    <div className="w-full max-w-5xl mx-auto relative">
      {openMenuId && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
      )}
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/ceo/session-history')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-medium rounded-lg transition-colors shrink-0"
          >
            <History className="w-4 h-4" />
            View Session History
          </button>
        </div>
      </div>
      
      {isLoadingProjects || isLoadingSessions || isLoadingActiveSession ? (
        <div className="flex items-center justify-center py-12">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          
          {/* TOP BANNER */}
          {activeSession?.id ? (
            <div className="mb-10 relative overflow-hidden rounded-2xl bg-slate-900 shadow-xl shadow-blue-900/10 border border-slate-800 transition-all hover:shadow-2xl hover:shadow-blue-900/20 group">
              {/* Decorative background glow */}
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-blue-500/20 blur-[80px] pointer-events-none group-hover:bg-blue-500/30 transition-colors duration-700"></div>
              <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-indigo-500/20 blur-[80px] pointer-events-none group-hover:bg-indigo-500/30 transition-colors duration-700"></div>
              
              <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div className="flex-1 min-w-0 z-10">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 text-[11px] font-bold uppercase tracking-widest border border-blue-400/20 shadow-sm backdrop-blur-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                      IN PROGRESS
                    </span>
                    {((activeSession as any).scenarioType || activeSession.scenario_type) && (
                      <span className="px-3 py-1 bg-white/5 text-slate-300 text-[11px] font-semibold uppercase tracking-wider rounded-full border border-white/10 backdrop-blur-md">
                        {((activeSession as any).scenarioType || activeSession.scenario_type).replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  
                  <h4 className="text-2xl font-bold text-white mb-2 tracking-tight flex items-center gap-2">
                    Elicitation in progress
                  </h4>

                  <p className="text-sm font-medium text-slate-400">
                    Stage {(activeSession as any).currentStage || activeSession.current_stage || 1} of 5 &middot; Last updated {new Date((activeSession as any).updatedAt || activeSession.updated_at || new Date()).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col items-stretch sm:items-center sm:flex-row gap-3 z-10 shrink-0">
                  <button
                    onClick={() => setSessionToDelete(activeSession.id)}
                    className="text-sm font-medium text-slate-400 hover:text-red-400 transition-colors px-4 py-2.5 rounded-xl hover:bg-white/5"
                  >
                    Delete Draft
                  </button>
                  <button
                    onClick={() => {
                      navigate("/ceo/elicitation");
                    }}
                    className="flex items-center justify-center gap-2 px-7 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-100 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/10"
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-10 relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-blue-200 group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-50 to-indigo-50/30 rounded-full blur-[60px] -mr-20 -mt-20 pointer-events-none group-hover:from-blue-100/60 group-hover:to-indigo-100/40 transition-colors duration-700"></div>
              <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div className="flex-1 min-w-0 z-10">
                  <h4 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 tracking-tight">
                    Ready to build your next AI solution?
                  </h4>
                  <p className="text-sm sm:text-base font-medium text-slate-500 max-w-2xl">
                    Begin the elicitation process to define your requirements, explore possibilities, and get matched with top experts.
                  </p>
                </div>
                <div className="flex flex-col items-stretch sm:items-center sm:flex-row gap-3 z-10 shrink-0">
                  {!isSubscribed ? (
                    <button
                      onClick={() => navigate('/ceo/subscription')}
                      className="flex items-center justify-center gap-2 px-7 py-3 bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-md hover:bg-emerald-500 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <Rocket className="w-4 h-4 text-emerald-100" />
                      Subscribe to Pro
                    </button>
                  ) : (
                    <button
                      onClick={handleStartNewProject}
                      disabled={isFetchingActiveSession}
                      className={`flex items-center justify-center gap-2 px-7 py-3 bg-slate-900 text-white font-bold rounded-xl transition-all shadow-md ${
                        isFetchingActiveSession 
                          ? 'opacity-70 cursor-not-allowed' 
                          : 'hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'
                      }`}
                    >
                      {isFetchingActiveSession ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Rocket className="w-4 h-4 text-blue-300" />
                      )} 
                      {isFetchingActiveSession ? 'Checking...' : 'Start Elicitation'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* BOTTOM SECTION: Published Projects */}
          <div>
            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1">Projects List</h4>
            {allProjects.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">No projects yet</h3>
                <p className="text-slate-500 max-w-sm">
                  When you complete an elicitation session, your published projects will appear here.
                </p>
              </div>
            ) : (
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
                
                {editingProjectId === project.id ? (
                  <div className="flex items-center gap-2 mb-2 w-full max-w-md">
                    <input
                      type="text"
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      className="flex-1 px-3 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-950 font-medium"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveName(project.id, false);
                        if (e.key === "Escape") setEditingProjectId(null);
                      }}
                    />
                    <button
                      onClick={() => handleSaveName(project.id, false)}
                      disabled={updateProjectName.isPending}
                      className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors shrink-0"
                      title="Save name"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingProjectId(null)}
                      className="p-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-md transition-colors shrink-0"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                      <div className="flex items-center gap-2 mb-1 group flex-wrap">
                    <h4 className="text-lg font-bold text-slate-900 truncate max-w-sm sm:max-w-md">
                      {project.projectName || `Project ${project.id}`}
                    </h4>
                    <button
                      onClick={() => {
                        setEditingProjectId(project.id);
                        setEditNameValue(project.projectName || `Project ${project.id}`);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0"
                      title="Rename project"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                
                <p className="text-sm text-slate-500 mb-3">
                  Created: {new Date(getSafeDate(project, 'createdAt')).toLocaleDateString()} &middot; Last updated: {new Date(getSafeDate(project, 'updatedAt')).toLocaleDateString()}
                </p>
                
                {/* Domains and Seams Tags */}
                {(((project as any).requiredDomainsJson || project.required_domains_json)?.length > 0 || 
                  ((project as any).requiredSeamsJson || project.required_seams_json)?.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {((project as any).requiredDomainsJson || project.required_domains_json)?.map((d: any) => (
                      <span key={d.domainCode || d.domain_code} className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase tracking-wider rounded-md border border-slate-200">
                        {(d.domainCode || d.domain_code).replace(/_/g, ' ')}
                      </span>
                    ))}
                    {((project as any).requiredSeamsJson || project.required_seams_json)?.map((s: any) => (
                      <span key={s.seamCode || s.seam_code} className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase tracking-wider rounded-md border border-slate-200">
                        {(s.seamCode || s.seam_code).replace(/_/g, ' ')}
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
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        onConfirm={() => {
          if (sessionToDelete) {
            deleteSession.mutate(sessionToDelete);
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
