import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useProjects, useUpdateProjectName } from "@/hooks/use-projects";
import { ARCHETYPES } from "@/hooks/use-elicitation";
import { ArrowLeft, ArrowRight, Loader2, PlayCircle, Pencil, Check, X } from "lucide-react";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, isLoadingProjects } = useProjects();
  
  const project = useMemo(() => projects.find((p: any) => p.id === id), [projects, id]);
  const isLoadingProject = isLoadingProjects;
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const updateProjectName = useUpdateProjectName();

  const handleSaveName = () => {
    if (!editNameValue.trim() || !project) {
      setIsEditingName(false);
      return;
    }
    updateProjectName.mutate(
      { id: project.id, projectName: editNameValue.trim() },
      {
        onSuccess: () => {
          setIsEditingName(false);
        },
      }
    );
  };

  if (isLoadingProject) {
    return (
      <div className="flex items-center justify-center py-20 w-full max-w-5xl mx-auto">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="w-full max-w-5xl mx-auto p-6">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Project Not Found</h2>
          <p className="text-slate-500 mb-6">The project you are looking for does not exist or has been removed.</p>
          <button onClick={() => navigate("/ceo/projects")} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  const getSafeDate = (obj: any, field: 'updatedAt' | 'createdAt') => {
    return new Date(obj[field] || obj[field === 'updatedAt' ? 'updated_at' : 'created_at'] || 0).toLocaleDateString();
  };

  const domains = project.requiredDomainsJson || (project as any).required_domains_json || [];
  const seams = project.requiredSeamsJson || (project as any).required_seams_json || [];
  const artifactA = project.artifactAJson || (project as any).artifact_a_json || null;
  const milestones = project.milestoneFrameworkJson || (project as any).milestone_framework_json || [];
  
  const archetype = project.archetype;
  const archetypeData = archetype ? ARCHETYPES.find(a => a.code === archetype) : null;

  return (
    <div className="w-full max-w-5xl mx-auto relative px-4 sm:px-0">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/ceo/projects')}
            className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-600 hover:text-slate-900"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <h3 className="text-2xl font-bold text-slate-900">Project Details</h3>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex items-center gap-2 mb-4 w-full max-w-xl">
                <input
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  className="flex-1 px-4 py-2 text-2xl font-extrabold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") setIsEditingName(false);
                  }}
                />
                <button
                  onClick={handleSaveName}
                  disabled={updateProjectName.isPending}
                  className="p-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors shrink-0"
                  title="Save name"
                >
                  {updateProjectName.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  className="p-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
                  title="Cancel"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2 group">
                <h1 className="text-3xl font-extrabold text-slate-900 min-w-0 break-words">
                  {project.projectName || `Project ${project.id}`}
                </h1>
                <button
                  onClick={() => {
                    setIsEditingName(true);
                    setEditNameValue(project.projectName || `Project ${project.id}`);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors sm:opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0 self-start sm:self-auto"
                  title="Rename project"
                >
                  <Pencil className="w-5 h-5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold uppercase tracking-wider border border-emerald-100">
                <PlayCircle className="w-3.5 h-3.5" />
                {project.state?.replace(/_/g, ' ') || "UNKNOWN"}
              </span>
              {project.tier && (
                <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-semibold uppercase tracking-wider rounded-md border border-purple-100">
                  {project.tier.replace(/_/g, ' ')}
                </span>
              )}
              {archetypeData && (
                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-semibold uppercase tracking-wider rounded-md border border-amber-100">
                  {archetypeData.icon} {archetypeData.label}
                </span>
              )}
              {project.selfTechnical && (
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold uppercase tracking-wider rounded-md border border-indigo-100">
                  Self-Managed Tech
                </span>
              )}
            </div>
            <p className="text-slate-500 font-medium">
              Created on {getSafeDate(project, 'createdAt')}
            </p>
          </div>
          <div className="shrink-0 flex items-start">
            <Link
              to={`/ceo/projects/shortlist/${project.id}`}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 hover:underline transition-all"
            >
              View Matched Experts <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">Business Intent</h3>
              <div className="prose prose-slate max-w-none text-slate-700">
                {artifactA?.business_intent ? (
                  <p className="whitespace-pre-wrap">{artifactA.business_intent}</p>
                ) : (
                  <p className="italic text-slate-400">No description provided.</p>
                )}
              </div>
            </div>

            {milestones?.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">Milestones</h3>
                <div className="space-y-4">
                  {milestones.map((m: any) => (
                    <div key={m.milestone_number} className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-slate-800">Milestone {m.milestone_number}</h4>
                        <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                          {(m.payment_amount_vnd || 0).toLocaleString()} VND
                        </span>
                      </div>
                      <p className="text-slate-600 text-sm mb-2">{m.deliverable_statement}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          SIGN OFF:
                        </span>
                        <div className="flex gap-1.5">
                          {(m.sign_off_authority === 'CEO' || m.sign_off_authority === 'JOINT') && (
                            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold tracking-wide">
                              CEO
                            </span>
                          )}
                          {(m.sign_off_authority === 'TECH_TEAM' || m.sign_off_authority === 'JOINT') && (
                            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold tracking-wide">
                              TECH TEAM
                            </span>
                          )}
                          {(m.sign_off_authority && !['CEO', 'TECH_TEAM', 'JOINT'].includes(m.sign_off_authority)) && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold tracking-wide">
                              {m.sign_off_authority.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">Required Capabilities</h3>
              
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3">Domains</h4>
                {domains.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {domains.map((d: any) => (
                      <span key={d.domainCode || d.domain_code} className="px-3 py-1.5 bg-slate-50 text-slate-700 text-sm font-medium rounded-md border border-slate-200">
                        {(d.domainCode || d.domain_code).replace(/_/g, ' ')}
                        <span className="text-xs text-slate-400 ml-1">({d.required_depth || d.requiredDepth})</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">No specific domains required.</p>
                )}
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3">Seams</h4>
                {seams.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {seams.map((s: any) => (
                      <span key={s.seamCode || s.seam_code} className="px-3 py-1.5 bg-slate-50 text-slate-700 text-sm font-medium rounded-md border border-slate-200">
                        {(s.seamCode || s.seam_code).replace(/_/g, ' ')}
                        <span className="text-xs text-slate-400 ml-1">({s.criticality})</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">No specific seams required.</p>
                )}
              </div>
              
              {artifactA?.stack_tags && artifactA.stack_tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3">Stack Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {artifactA.stack_tags.map((tag: string) => (
                      <span key={tag} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-md border border-blue-100">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
