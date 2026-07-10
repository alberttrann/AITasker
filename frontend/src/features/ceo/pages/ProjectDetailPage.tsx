import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useProjects, useUpdateProjectName, useUpdateProjectMilestones } from "@/hooks/use-projects";
import { 
  ArrowLeft, ArrowRight, Loader2, PlayCircle, Pencil, Check, X,
  Plus, Trash2, Edit2, Save, FileText, LayoutGrid, Target, Briefcase, Clock, Banknote
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useDomains, useSeams, useArchetypes } from "@/hooks/use-config";
import { useEngagements } from "@/hooks/use-engagements";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, isLoadingProjects } = useProjects();
  
  const project = useMemo(() => projects.find((p: any) => p.id === id), [projects, id]);
  const isLoadingProject = isLoadingProjects;
  
  const { data: engagements } = useEngagements();
  
  const hasNewBids = useMemo(() => {
    if (!engagements || !project) return false;
    return engagements.some(
      (e: any) =>
        (e.projectId === project.id || e.project_id === project.id) &&
        e.capabilityBid &&
        (e.capabilityBid.state === 'SUBMITTED' || e.capabilityBid.state === 'TECH_REVIEW_PASSED')
    );
  }, [engagements, project]);
  
  const user = useAuthStore(s => s.user);
  const isTechTeam = user?.clientSubtype === 'TECH_TEAM';
  const isCeo = user?.clientSubtype === 'CEO';
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const updateProjectName = useUpdateProjectName();
  const updateProjectMilestones = useUpdateProjectMilestones();

  const { data: dynamicDomains } = useDomains();
  const { data: dynamicSeams } = useSeams();
  const { data: archetypesList } = useArchetypes();

  // Milestones State
  const [isEditingMilestones, setIsEditingMilestones] = useState(false);
  const [editedMilestones, setEditedMilestones] = useState<any[]>([]);

  const milestones = project?.milestoneFrameworkJson || (project as any)?.milestone_framework_json || [];

  const handleEditMilestones = () => {
    setEditedMilestones(JSON.parse(JSON.stringify(milestones)));
    setIsEditingMilestones(true);
  };

  const handleAddMilestone = () => {
    setEditedMilestones([
      ...editedMilestones,
      {
        milestone_number: editedMilestones.length + 1,
        deliverable_statement: "",
        payment_amount_vnd: 0,
        estimated_duration_days: 0,
        sign_off_authority: "CEO"
      }
    ]);
  };

  const handleUpdateMilestone = (index: number, field: string, value: any) => {
    const newM = [...editedMilestones];
    newM[index] = { ...newM[index], [field]: value };
    setEditedMilestones(newM);
  };

  const handleDeleteMilestone = (index: number) => {
    const newM = [...editedMilestones];
    newM.splice(index, 1);
    // Re-number
    newM.forEach((m, i) => m.milestone_number = i + 1);
    setEditedMilestones(newM);
  };

  const handleSaveMilestones = () => {
    // Strip out any non-whitelisted fields to prevent 400 Bad Request
    const cleanMilestones = editedMilestones.map(m => ({
      milestone_number: m.milestone_number,
      deliverable_statement: m.deliverable_statement || '',
      payment_amount_vnd: m.payment_amount_vnd || 0,
      estimated_duration_days: m.estimated_duration_days || 0,
      sign_off_authority: m.sign_off_authority || 'CEO'
    }));

    updateProjectMilestones.mutate(
      { id: project.id, milestones: cleanMilestones },
      {
        onSuccess: () => {
          setIsEditingMilestones(false);
        }
      }
    );
  };

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
      <div className="flex items-center justify-center py-20 w-full max-w-[1440px] px-6 mx-auto">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="w-full max-w-[1440px] px-6 mx-auto py-12">
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Project Not Found</h2>
          <p className="text-slate-500 mb-8 text-lg">The project you are looking for does not exist or has been removed.</p>
          <button onClick={() => navigate(isTechTeam ? "/tech-team/projects" : "/ceo/projects")} className="px-6 py-3 bg-slate-800 text-white font-medium rounded-xl hover:bg-slate-900 transition-colors">
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  const getSafeDate = (obj: any, field: 'updatedAt' | 'createdAt') => {
    return new Date(obj[field] || obj[field === 'updatedAt' ? 'updated_at' : 'created_at'] || 0).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const domains = project.requiredDomainsJson || (project as any).required_domains_json || [];
  const seams = project.requiredSeamsJson || (project as any).required_seams_json || [];
  const artifactA = project.artifactAJson || (project as any).artifact_a_json || null;

  const archetype = project.archetype;
  const archetypeData = archetype && archetypesList ? archetypesList.find(a => a.code === archetype) : null;

  const getDomainName = (code: string) => {
    const d = dynamicDomains?.find(domain => domain.code === code);
    return d ? d.name : code.replace(/_/g, ' ');
  };

  const getSeamName = (code: string) => {
    const s = dynamicSeams?.find(seam => seam.code === code);
    return s ? s.name : code.replace(/_/g, ' ');
  };

  return (
    <div className="w-full max-w-[1440px] px-6 mx-auto relative pb-20 pt-8">
      {/* Header Area */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(isTechTeam ? "/tech-team/projects" : "/ceo/projects")}
            className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-600 shadow-sm"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h3 className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-1">Project Workspace</h3>
            <div className="flex items-center gap-3">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    className="px-3 py-1.5 text-2xl font-extrabold border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent bg-white w-full max-w-md shadow-inner"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") setIsEditingName(false);
                    }}
                  />
                  <button onClick={handleSaveName} disabled={updateProjectName.isPending} className="p-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg transition-colors">
                    {updateProjectName.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  </button>
                  <button onClick={() => setIsEditingName(false)} className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 group">
                  <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    {project.projectName || `Project ${project.id.slice(0,8)}`}
                  </h1>
                  {isCeo && (
                    <button
                      onClick={() => {
                        setIsEditingName(true);
                        setEditNameValue(project.projectName || `Project ${project.id}`);
                      }}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Rename project"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
          {isTechTeam ? (
            <Link
              to={`/tech-team/bids`}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm"
            >
              View Bids <ArrowRight size={18} />
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to={`/ceo/projects/${project.id}/shortlist`}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm"
              >
                Match Shortlist
              </Link>
              <Link
                to={`/ceo/projects/${project.id}/bids`}
                className="relative flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-600/20"
              >
                View Experts bids
                {hasNewBids && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
                  </span>
                )}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Badges Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-8 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-500 font-medium pr-4 border-r border-slate-200">
          <Briefcase className="w-4 h-4" /> Created {getSafeDate(project, 'createdAt')}
        </div>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider border border-emerald-100">
          <PlayCircle className="w-4 h-4" />
          {project.state?.replace(/_/g, ' ') || "UNKNOWN"}
        </span>
        {project.tier && (
          <span className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-lg border border-slate-200">
            {project.tier.replace(/_/g, ' ')}
          </span>
        )}
        {archetypeData && (
          <span className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-lg border border-slate-200">
            {archetypeData.name}
          </span>
        )}
        {project.selfTechnical && (
          <span className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-lg border border-slate-200">
            Self-Managed Tech
          </span>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Intent & Capabilities */}
        <div className="lg:col-span-1 space-y-8">
          {/* Business Intent Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">Business Intent</h3>
            <div className="prose prose-slate prose-sm max-w-none text-slate-600 leading-relaxed">
              {artifactA?.business_intent ? (
                <p className="whitespace-pre-wrap">{artifactA.business_intent}</p>
              ) : (
                <p className="italic text-slate-400">No description provided.</p>
              )}
            </div>
          </div>

          {/* Capabilities Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">Required Capabilities</h3>
            
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Domains</h4>
                {domains.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {domains.map((d: any) => (
                      <span key={d.domainCode || d.domain_code} className="px-3 py-1.5 bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                        <span className="font-semibold text-slate-900">{d.domainCode || d.domain_code}</span>
                        <span className="mx-1.5 text-slate-300">|</span>
                        {getDomainName(d.domainCode || d.domain_code)}
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">
                          {d.required_depth || d.requiredDepth}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">No specific domains required.</p>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Seams</h4>
                {seams.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {seams.map((s: any) => (
                      <span key={s.seamCode || s.seam_code} className="px-3 py-1.5 bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                        <span className="font-semibold text-slate-900">{s.seamCode || s.seam_code}</span>
                        <span className="mx-1.5 text-slate-300">|</span>
                        {getSeamName(s.seamCode || s.seam_code)}
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                          {s.criticality}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">No specific seams required.</p>
                )}
              </div>
              
              {artifactA?.stack_tags && artifactA.stack_tags.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Stack Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {artifactA.stack_tags.map((tag: string) => (
                      <span key={tag} className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md border border-slate-200">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Milestones */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Project Milestones</h3>
              </div>
              
              {isCeo && !isEditingMilestones && (
                <button 
                  onClick={handleEditMilestones}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm"
                >
                  <Edit2 className="w-4 h-4" /> Edit Milestones
                </button>
              )}
              {isCeo && isEditingMilestones && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsEditingMilestones(false)}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveMilestones}
                    disabled={updateProjectMilestones.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-70"
                  >
                    {updateProjectMilestones.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                    Save Changes
                  </button>
                </div>
              )}
            </div>

            <div className="p-6 flex-1">
              {!isEditingMilestones ? (
                /* VIEW MODE */
                milestones?.length > 0 ? (
                  <div className="space-y-4">
                    {milestones.map((m: any, idx: number) => (
                      <div key={idx} className="bg-white border border-slate-200 rounded-xl shadow-sm hover:border-blue-300 transition-all duration-200">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-sm font-bold text-slate-400 tracking-wider">
                                MILESTONE #{m.milestone_number}
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">
                              {m.deliverable_statement || "No deliverable statement provided."}
                            </h3>
                            <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                              <span>
                                Sign-off:{" "}
                                <strong className="text-slate-700">
                                  {m.sign_off_authority === 'JOINT' ? 'CEO, TECH TEAM' : (m.sign_off_authority || 'CEO').replace('_', ' ')}
                                </strong>
                              </span>
                              {m.estimated_duration_days !== undefined && m.estimated_duration_days > 0 && (
                                <span>
                                  Duration:{" "}
                                  <strong className="text-slate-700">
                                    {m.estimated_duration_days} Days
                                  </strong>
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex md:flex-col items-end justify-between w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 gap-4">
                            <div className="text-right">
                              <p className="text-xs text-slate-400 uppercase font-semibold">
                                Payment Amount
                              </p>
                              <p className="text-lg font-bold text-emerald-600">
                                {m.payment_amount_vnd ? m.payment_amount_vnd.toLocaleString('vi-VN') + ' ₫' : '—'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                      <FileText className="w-8 h-8" />
                    </div>
                    <h4 className="text-lg font-semibold text-slate-700 mb-2">No Milestones Defined</h4>
                    <p className="text-slate-500 max-w-sm mb-6">This project currently has no milestone framework. You can add them before opening the project for bids.</p>
                    {isCeo && (
                      <button 
                        onClick={handleEditMilestones}
                        className="px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                      >
                        Create Milestones
                      </button>
                    )}
                  </div>
                )
              ) : (
                /* EDIT MODE */
                <div className="space-y-6">
                  {editedMilestones.map((m, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-lg relative group">
                      <button 
                        onClick={() => handleDeleteMilestone(idx)}
                        className="absolute -top-3 -right-3 p-2 bg-white text-slate-500 rounded-full hover:bg-slate-100 hover:text-slate-800 transition-colors shadow-sm border border-slate-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Delete Milestone"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                      <div className="flex items-center gap-3 mb-4">
                        <h4 className="font-bold text-slate-800">Milestone {m.milestone_number}</h4>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Deliverable Statement</label>
                          <textarea 
                            value={m.deliverable_statement}
                            onChange={(e) => handleUpdateMilestone(idx, 'deliverable_statement', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm resize-none"
                            rows={2}
                            placeholder="e.g., Deliver MVP with core features..."
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Duration (Days)</label>
                            <div className="relative">
                              <input 
                                type="number" 
                                value={m.estimated_duration_days || 0}
                                onChange={(e) => handleUpdateMilestone(idx, 'estimated_duration_days', parseInt(e.target.value) || 0)}
                                className="w-full pl-3 pr-12 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm font-medium text-slate-900"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs">Days</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Payment Amount (VND)</label>
                            <div className="relative">
                              <input 
                                type="number" 
                                value={m.payment_amount_vnd}
                                onChange={(e) => handleUpdateMilestone(idx, 'payment_amount_vnd', parseInt(e.target.value) || 0)}
                                className="w-full pl-3 pr-12 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm font-medium text-slate-900"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs">VND</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Sign-Off Authority</label>
                            <select 
                              value={m.sign_off_authority}
                              onChange={(e) => handleUpdateMilestone(idx, 'sign_off_authority', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm font-medium text-slate-700 bg-white"
                            >
                              <option value="CEO">CEO</option>
                              <option value="TECH_TEAM">Tech Team</option>
                              <option value="JOINT">Joint</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    onClick={handleAddMilestone}
                    className="w-full py-4 border-2 border-dashed border-slate-300 text-slate-500 font-medium rounded-xl hover:bg-slate-50 hover:border-slate-400 hover:text-slate-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> Add New Milestone
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
