import ArtifactBView from '../connection/ArtifactBView';
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useInvitations, useDeclineInvitation } from "@/hooks/use-invitations";
import { useEngagements } from "@/hooks/use-engagements";
import { useProject } from "@/hooks/use-projects";
import { useDomains, useSeams, useArchetypes } from "@/hooks/use-config";
import { useExpertProfile } from "@/hooks/use-expert-profile";
import { Loader2, ArrowLeft, Building2, MapPin, Search, Filter, MoreVertical, X, Check, Clock, Info, ArrowUpDown, User, Trash2, CheckCircle2 } from "lucide-react";
import type { InvitationDto, EngagementDto } from "@/types/api.types";
import { formatSeamCode } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import ExpertNdaClickThrough from "../connection/NdaClickThrough";

// Unified type combining Invitation and Engagement logic
type UnifiedProject = {
  id: string;
  projectId: string;
  projectName: string;
  ceoName: string;
  companyName: string | null;
  status: 'INVITED' | 'BID_SENT' | 'COUNTER_OFFER' | 'NDA_PENDING' | 'IN_PROGRESS' | 'CLOSED' | 'DECLINED' | 'EXPIRED';
  negotiationState?: string; 
  updatedAt: number;
  invitation?: InvitationDto;
  engagement?: EngagementDto;
};

export default function ExpertProjectsPage() {
  const navigate = useNavigate();
  const { data: invitations, isLoading: isLoadingInvites } = useInvitations();
  const { data: engagements, isLoading: isLoadingEngagements } = useEngagements();
  const declineInvitation = useDeclineInvitation();

  const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'name_desc'>('date_desc');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const [activePopupId, setActivePopupId] = useState<string | null>(null);
  const [activeMilestoneId, setActiveMilestoneId] = useState<number | null>(1);
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const [ndaEngagementId, setNdaEngagementId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const sortOptions = [
    { label: 'Newest First', value: 'date_desc' },
    { label: 'Oldest First', value: 'date_asc' },
    { label: 'Name A-Z', value: 'name_asc' },
    { label: 'Name Z-A', value: 'name_desc' }
  ];

  const { project: fullProject, isLoadingProject } = useProject(selectedProjectId || undefined);
  const { data: domains } = useDomains();
  const { data: seams } = useSeams();
  const { data: archetypes } = useArchetypes();
  const { profile } = useExpertProfile();

  const isProfileComplete = profile && !!(
    profile.profile?.bio ||
    profile.profile?.engagementModel ||
    (profile.profile?.stackTagsJson && profile.profile.stackTagsJson.length > 0) ||
    (profile.domainDepths && profile.domainDepths.length > 0) ||
    (profile.seamClaims && profile.seamClaims.length > 0)
  );

  // Filter out locally deleted invitations
  const [deletedInvites, setDeletedInvites] = useState<Set<string>>(new Set());

  const unifiedProjects = useMemo(() => {
    if (!invitations && !engagements) return [];

    const projectMap = new Map<string, UnifiedProject>();

    const getSafeTime = (dateVal: any) => {
      if (!dateVal) return 0;
      const t = new Date(dateVal).getTime();
      return isNaN(t) ? 0 : t;
    };

    // Process Engagements first (they hold priority state over invitations)
    if (engagements) {
      const now = Date.now();
      engagements.forEach((eng, index) => {
        if (!eng.project) return;

        let status: UnifiedProject['status'] = 'IN_PROGRESS';

        if (eng.state === 'CLOSED') {
          status = 'CLOSED';
        }
        // 2. Check if the bid or engagement is dead
        else if (
          eng.state === 'DECLINED' || 
          eng.state === 'CANCELLED' || 
          eng.capabilityBid?.state === 'DECLINED' || 
          eng.capabilityBid?.state === 'WITHDRAWN'
        ) {
          status = 'DECLINED';
        } 
        // 2. Check if waiting for NDA
        else if (eng.state === 'CONNECTED' && !(eng as any).expertNdaAcceptedAt) {
          status = 'NDA_PENDING';
        } 
        // 3. Alive and pending negotiation
        else if (eng.state === 'PENDING') {
          const negotiationState = eng.capabilityBid?.negotiationState;
          if (eng.termsLocked || negotiationState === 'TERMS_ACCEPTED') {
            status = 'NDA_PENDING';
          } else if (
            eng.capabilityBid?.techStatus === 'REVISION_REQUESTED' ||
            negotiationState === 'AWAITING_EXPERT'
          ) {
            status = 'COUNTER_OFFER';
          } else {
            status = 'BID_SENT';
          }
        }

        const projectId = eng.projectId || eng.id;
        const projectName = eng.project?.projectName || eng.service?.title || 'Service Order';
        const ceoName = eng.client?.fullName || (eng as any).client_id || 'Client';

        projectMap.set(projectId, {
          id: projectId,
          projectId: projectId,
          projectName,
          ceoName,
          companyName: null,
          status,
          negotiationState: eng.capabilityBid?.negotiationState, 
          updatedAt: getSafeTime((eng as any).updatedAt || eng.connectedAt || Date.now()),
          engagement: eng
        });
      });
    }

    // Process Invitations
    if (invitations) {
      invitations.forEach((inv) => {
        if (deletedInvites.has(inv.id)) return;
        if (projectMap.has(inv.projectId)) {
          // If we already have an engagement, just attach the invitation data but keep engagement status
          const existing = projectMap.get(inv.projectId)!;
          existing.invitation = inv;
          existing.ceoName = inv.ceo.fullName; // richer info
          existing.companyName = (inv.ceo as any).companyName || (inv.ceo as any).activeRoleProfile?.companyName || null;

          // Re-enable Submit Bid if the previous engagement was declined but we have a new/pending invitation
          if (existing.status === 'DECLINED' && inv.status === 'PENDING' && !inv.isExpired) {
            existing.status = 'INVITED';
          }
        } else {
          // No engagement yet, derive status from invitation
          let status: UnifiedProject['status'] = 'INVITED';
          if (inv.isExpired) status = 'EXPIRED';
          else if (inv.status === 'DECLINED') status = 'DECLINED';

          projectMap.set(inv.projectId, {
            id: inv.projectId,
            projectId: inv.projectId,
            projectName: inv.project.projectName,
            ceoName: inv.ceo.fullName,
            companyName: (inv.ceo as any).companyName || (inv.ceo as any).activeRoleProfile?.companyName || null,
            status,
            updatedAt: getSafeTime(inv.invitedAt),
            invitation: inv
          });
        }
      });
    }

    // Filter & Sort
    let filtered = Array.from(projectMap.values());
    if (statusFilters.size > 0) {
      filtered = filtered.filter(p => statusFilters.has(p.status));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.projectName.toLowerCase().includes(q) ||
        p.ceoName.toLowerCase().includes(q) ||
        (p.companyName && p.companyName.toLowerCase().includes(q))
      );
    }

    const sorted = filtered.sort((a, b) => {
      if (sortOrder === 'date_desc') return b.updatedAt - a.updatedAt;
      if (sortOrder === 'date_asc') return a.updatedAt - b.updatedAt;
      if (sortOrder === 'name_asc') return a.projectName.localeCompare(b.projectName);
      return b.projectName.localeCompare(a.projectName);
    });

    return sorted;
  }, [invitations, engagements, sortOrder, deletedInvites, statusFilters, searchQuery]);

  const hasBaseProjects = useMemo(() => {
    if (!invitations && !engagements) return false;
    const projectMap = new Map<string, boolean>();
    engagements?.forEach(eng => {
      if (eng.project && eng.projectId) projectMap.set(eng.projectId, true);
    });
    invitations?.forEach(inv => {
      if (!deletedInvites.has(inv.id) && !projectMap.has(inv.projectId)) {
        projectMap.set(inv.projectId, true);
      }
    });
    return projectMap.size > 0;
  }, [invitations, engagements, deletedInvites]);

  // Auto-select first project
  if (unifiedProjects.length > 0 && !selectedProjectId) {
    setSelectedProjectId(unifiedProjects[0].projectId as string);
  }

  // Reset phase to 1 when selected project changes
  useEffect(() => {
    setActiveMilestoneId(1);
  }, [selectedProjectId]);

  const selectedProject = unifiedProjects.find(p => p.projectId === selectedProjectId);
  const isLoading = isLoadingInvites || isLoadingEngagements;

  const handleDecline = (invitationId: string) => {
    if (window.confirm("Are you sure you want to decline this invitation?")) {
      declineInvitation.mutate(invitationId);
    }
  };

  const handleRemove = (invitationId: string) => {
    setDeletedInvites(prev => {
      const next = new Set(prev);
      next.add(invitationId);
      return next;
    });
    if (selectedProject?.invitation?.id === invitationId) {
      setSelectedProjectId(null); // clear selection
    }
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto relative flex flex-col min-h-[calc(100vh-140px)] mb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/expert')}
            className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <h3 className="text-2xl font-bold text-slate-900">Projects</h3>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : !hasBaseProjects ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">No projects yet</h3>
          {isProfileComplete ? (
            <p className="text-slate-500 max-w-sm mb-6">
              You don't have any project invitations or active engagements. We'll notify you when a CEO invites you to a project!
            </p>
          ) : (
            <>
              <p className="text-slate-500 max-w-sm mb-6">
                You don't have any project invitations or active engagements. Complete your profile to get discovered!
              </p>
              <Button onClick={() => navigate('/expert/service/expert-profile')}>
                Complete Profile
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 flex gap-6 items-start">
          {/* LEFT COLUMN: List */}
          <div className="w-1/3 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Sort & Filter Controls */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <button
                    onClick={() => setIsSortOpen(!isSortOpen)}
                    className="w-full flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
                      <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
                      {sortOptions.find(o => o.value === sortOrder)?.label || 'Sort'}
                    </span>
                  </button>
                  {isSortOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsSortOpen(false)}></div>
                      <div className="absolute left-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                        {sortOptions.map(option => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setSortOrder(option.value as any);
                              setIsSortOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${sortOrder === option.value ? 'bg-blue-50/50 text-blue-700 font-semibold' : 'text-slate-700'}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="relative flex-1">
                  <button
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className="w-full flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <span className="flex items-center gap-1.5"><Filter className="w-3.5 h-3.5" /> Filter {statusFilters.size > 0 && `(${statusFilters.size})`}</span>
                  </button>
                  {isFilterOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)}></div>
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-2">
                        {['INVITED', 'BID_SENT', 'COUNTER_OFFER', 'IN_PROGRESS', 'CLOSED', 'DECLINED', 'EXPIRED'].map(status => (
                          <label key={status} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={statusFilters.has(status)}
                              onChange={(e) => {
                                const newFilters = new Set(statusFilters);
                                if (e.target.checked) newFilters.add(status);
                                else newFilters.delete(status);
                                setStatusFilters(newFilters);
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            {status.replace('_', ' ')}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-y-auto custom-scrollbar p-3 space-y-2 max-h-[480px]">
              {unifiedProjects.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  No projects match the current filters.
                </div>
              ) : (
                unifiedProjects.map((project) => {
                  const isSelected = selectedProjectId === project.projectId;

                  let chipColor = "bg-slate-100 text-slate-700";
                  let chipText = "Unknown";

                  switch (project.status) {
                    case 'INVITED': 
                      chipColor = "bg-amber-100 text-amber-700"; 
                      chipText = "New Invite"; 
                      break;
                    case 'BID_SENT': 
                      chipColor = "bg-blue-100 text-blue-700"; 
                      // Đổi chữ linh hoạt theo Negotiate Step ở đây!
                      if (project.negotiationState === 'AWAITING_TECH_REVIEW') chipText = "Tech Review";
                      else if (project.negotiationState === 'AWAITING_CEO') chipText = "Under CEO Review";
                      else chipText = "Bid Sent"; 
                      break;
                    case 'COUNTER_OFFER': 
                      chipColor = "bg-sky-100 text-sky-700"; 
                      chipText = "Counter Offer"; 
                      break;
                    case 'NDA_PENDING': 
                      chipColor = "bg-indigo-100 text-indigo-700"; 
                      chipText = "Sign NDA"; 
                      break;
                    case 'IN_PROGRESS': 
                      chipColor = "bg-emerald-100 text-emerald-700"; 
                      chipText = "In Progress"; 
                      break;
                    case 'CLOSED':
                      chipColor = "bg-blue-100 text-blue-700";
                      chipText = "Closed";
                      break;
                    case 'DECLINED':
                      chipColor = "bg-slate-100 text-slate-600"; 
                      chipText = "Declined"; 
                      break;
                    case 'EXPIRED': 
                      chipColor = "bg-rose-100 text-rose-700"; 
                      chipText = "Expired"; 
                      break;
                  }

                  return (
                    <button
                      key={project.id}
                      onClick={() => setSelectedProjectId(project.projectId)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${isSelected
                          ? 'bg-blue-50/50 border-blue-200 shadow-sm'
                          : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className={`text-[11px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${chipColor}`}>
                          {chipText}
                        </span>
                        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className={`font-bold text-base mb-1 line-clamp-1 ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                        {project.projectName}
                      </h4>
                      <div className="flex items-center gap-2 text-slate-500 mt-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <User className="w-3.5 h-3.5 shrink-0" />
                          <span className="line-clamp-1 text-xs">{project.ceoName}</span>
                        </div>
                        {project.companyName && (
                          <>
                            <span className="text-slate-300 shrink-0">•</span>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Building2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="line-clamp-1 text-xs">{project.companyName}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Details */}
          <div className="w-2/3 bg-white border border-slate-200 rounded-2xl shadow-sm">
            {selectedProject ? (
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-bold text-slate-900">{selectedProject.projectName}</h2>
                      <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg uppercase tracking-wider">
                        {(() => {
                          const code = fullProject?.archetype || fullProject?.artifact_a_json?.archetype;
                          if (!code) return 'UNKNOWN ARCHETYPE';
                          const match = archetypes?.find(a => a.code === code);
                          return match ? match.name : code;
                        })()}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <p className="flex items-center gap-1.5">
                        <User className="w-4 h-4" /> {selectedProject.ceoName}
                      </p>
                      {fullProject?.milestone_framework_json && fullProject.milestone_framework_json.length > 0 && (
                        <>
                          <span className="text-slate-300">•</span>
                          <p className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Total Budget: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                              fullProject.milestone_framework_json.reduce((sum: number, m: any) => sum + (m.payment_amount_vnd || m.estimated_cost_vnd || 0), 0)
                            )}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions based on state */}
                  <div className="flex gap-3">
                    {selectedProject.status === 'INVITED' && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => handleDecline(selectedProject.invitation!.id)}
                        >
                          Decline
                        </Button>
                        <Button
                          onClick={() => navigate(`/expert/bids/${selectedProject.projectId}`)}
                        >
                          Submit Bid
                        </Button>
                      </>
                    )}
                    {selectedProject.status === 'BID_SENT' && (
                      <Button variant="outline" onClick={() => navigate(`/expert/engagements/${selectedProject.engagement?.id}/bid`)}>
                        View Bid
                      </Button>
                    )}

                    {selectedProject.status === 'COUNTER_OFFER' && (
                      <Button onClick={() => navigate(`/expert/engagements/${selectedProject.engagement?.id}/bid`)}>
                        Review Offer
                      </Button>
                    )}

                    {selectedProject.status === 'NDA_PENDING' && (
                      selectedProject.engagement?.serviceId ? (
                        <Button onClick={() => navigate(`/expert/engagements/${selectedProject.engagement?.id}/messages`)}>
                          Chat with Client
                        </Button>
                      ) : (
                        <Button onClick={() => setNdaEngagementId(selectedProject.engagement?.id || null)}>
                          Sign NDA
                        </Button>
                      )
                    )}

                    {selectedProject.status === 'IN_PROGRESS' && (
                      <>
                        {selectedProject.engagement?.serviceId && (
                          <Button
                            variant="outline"
                            onClick={() => navigate(`/expert/engagements/${selectedProject.engagement?.id}/messages`)}
                            className="mr-2"
                          >
                            Chat with Client
                          </Button>
                        )}
                        <Button onClick={() => {
                          const milestones = selectedProject.engagement?.milestones || [];
                          const activeMilestone = milestones.find(m => m.state !== 'RELEASED' && m.state !== 'APPROVED') || milestones[0];
                          if (activeMilestone) {
                            navigate(`/expert/engagements/${selectedProject.engagement!.id}/milestones/${activeMilestone.id}`);
                          } else {
                            alert("No milestones defined yet for this engagement.");
                          }
                        }}>
                          Open Workspace
                        </Button>
                      </>
                    )}

                    {selectedProject.status === 'CLOSED' && selectedProject.engagement && (
                      <>
                        {selectedProject.engagement.serviceId && (
                          <Button
                            variant="outline"
                            onClick={() => navigate(`/expert/engagements/${selectedProject.engagement?.id}/messages`)}
                            className="mr-2"
                          >
                            Chat with Client
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className="text-amber-700 bg-white hover:bg-amber-50 border-amber-200"
                          onClick={() => navigate(`/expert/engagements/${selectedProject.engagement!.id}/review`)}
                        >
                          Leave a Review
                        </Button>
                      </>
                    )}

                    {(selectedProject.status === 'DECLINED' || selectedProject.status === 'EXPIRED') && (
                      <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={() => handleRemove(selectedProject.invitation!.id)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Remove
                      </Button>
                    )}
                  </div>
                </div>

                <hr className="border-slate-100 my-6" />

                {selectedProject.status === 'CLOSED' && selectedProject.engagement?.serviceId && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex gap-4 text-emerald-950 shadow-xs animate-in fade-in mb-6">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-base font-bold text-emerald-900 leading-snug">Service Workspace Completed!</h4>
                      <p className="text-sm text-emerald-800 leading-relaxed font-body mt-1">
                        Great job! The client has signed off on the deliverables for this service. 
                        The escrow payment of <strong>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number((selectedProject.engagement.service as any)?.price_vnd || (selectedProject.engagement.service as any)?.priceVnd || selectedProject.engagement.milestones?.[0]?.paymentAmountVnd || 0))}</strong> has been released and credited to your wallet.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-8">
                  {/* Message / Status banner */}
                  {selectedProject.invitation?.message && (
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">Message from CEO:</h4>
                      <p className="text-sm text-blue-800 italic">"{selectedProject.invitation.message}"</p>
                    </div>
                  )}

                  {/* Overview Section */}
                  {fullProject?.artifact_a_json && (
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        Project Overview
                      </h3>
                      <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-5 mb-8">
                        {fullProject.selfTechnical && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold rounded-lg uppercase tracking-wider">
                              Self-Technical
                            </span>
                          </div>
                        )}

                        {fullProject.artifact_a_json.business_intent && (
                          <div className="mb-4">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Business Intent</h4>
                            <p className="text-sm text-slate-700 leading-relaxed">{fullProject.artifact_a_json.business_intent}</p>
                          </div>
                        )}

                        {fullProject.artifact_a_json.stack_tags?.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tech Stack</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {fullProject.artifact_a_json.stack_tags.map((tag: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-semibold rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {fullProject.artifact_a_json.sdlc_notices?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">SDLC Notices</h4>
                            <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                              {fullProject.artifact_a_json.sdlc_notices.map((notice: string, i: number) => (
                                <li key={i}>{notice}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Requirements Section */}
                  <div className="mb-8">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      Project Requirements
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Domains */}
                      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3">Required Domains</h4>
                        {isLoadingProject ? (
                          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                        ) : fullProject?.required_domains_json?.length ? (
                          <div className="space-y-2">
                            {fullProject.required_domains_json.map((d: any, i: number) => {
                              const domainName = domains?.find(def => def.code === d.domain_code)?.name || d.domain_code;

                              const getDepthValue = (depth: string) => {
                                if (depth === 'DEEP' || depth === 'EXPERT') return 3;
                                if (depth === 'OPERATIONAL' || depth === 'INTERMEDIATE') return 2;
                                if (depth === 'SURFACE' || depth === 'BEGINNER') return 1;
                                return 0;
                              };

                              const requiredDepth = d.depth_level || d.required_depth;
                              const expertDomain = profile?.domainDepths?.find((pd: any) => pd.domainCode === d.domain_code);
                              const isMatch = expertDomain && getDepthValue(expertDomain.depthLevel || expertDomain.depth_level) >= getDepthValue(requiredDepth);

                              const bgFill = expertDomain
                                ? "bg-emerald-50 border-emerald-200"
                                : "bg-rose-50 border-rose-200";

                              const textColor = expertDomain ? "text-emerald-700" : "text-rose-700";

                              const showWarning = expertDomain && !isMatch;

                              return (
                                <div key={i} className={`flex justify-between items-center text-sm p-2.5 rounded-lg border ${bgFill}`}>
                                  <span className="font-semibold text-slate-900">{domainName}</span>
                                  <div className="relative flex items-center">
                                    {showWarning ? (
                                      <button
                                        onClick={() => setActivePopupId(activePopupId === d.domain_code ? null : d.domain_code)}
                                        className="flex items-center hover:opacity-75 transition-opacity focus:outline-none"
                                      >
                                        <span className="mr-1 opacity-70 text-[11px] font-black text-rose-500">!</span>
                                        <span className={`text-[10px] uppercase tracking-wider font-bold ${textColor}`}>
                                          {requiredDepth}
                                        </span>
                                      </button>
                                    ) : (
                                      <span className={`text-[10px] uppercase tracking-wider font-bold ${textColor}`}>
                                        {requiredDepth}
                                      </span>
                                    )}

                                    {showWarning && activePopupId === d.domain_code && (
                                      <div className="absolute right-0 bottom-full mb-2 w-40 bg-white text-slate-800 text-xs p-2.5 rounded shadow-xl border border-slate-200 z-10 whitespace-normal leading-relaxed before:content-[''] before:absolute before:-bottom-1.5 before:right-3 before:w-3 before:h-3 before:bg-white before:border-b before:border-r before:border-slate-200 before:rotate-45">
                                        <div>
                                          <span className="text-slate-500 uppercase font-bold text-[9px] block mb-0.5">Project Requires</span>
                                          <span className="font-bold">{requiredDepth}</span>
                                        </div>
                                        <div className="mt-2">
                                          <span className="text-slate-500 uppercase font-bold text-[9px] block mb-0.5">Your Profile</span>
                                          <span className="font-bold">{expertDomain.depthLevel || expertDomain.depth_level}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">No specific domains required.</p>
                        )}
                      </div>

                      {/* Seams */}
                      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3">Required Integrations</h4>
                        {isLoadingProject ? (
                          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                        ) : fullProject?.required_seams_json?.length ? (
                          <div className="space-y-2">
                            {fullProject.required_seams_json.map((s: any, i: number) => {
                              const rawSeamName = seams?.find(def => def.code === s.seam_code)?.name || s.seam_code;
                              const seamName = formatSeamCode(rawSeamName);
                              const isMatch = profile?.seamClaims?.some((ps: any) => (ps.seamCode || ps.code) === s.seam_code);
                              const bgFill = isMatch
                                ? "bg-emerald-50 border-emerald-200"
                                : "bg-rose-50 border-rose-200";

                              const textColor = isMatch ? "text-emerald-700" : "text-rose-700";

                              return (
                                <div key={i} className={`flex justify-between items-center text-sm p-2.5 rounded-lg border ${bgFill}`}>
                                  <span className="font-semibold text-slate-900">{seamName}</span>
                                  <span className={`text-[10px] uppercase tracking-wider font-bold ${textColor}`}>
                                    {s.criticality}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">No specific integrations required.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ARTIFACT B */}
                  <div className="mb-8">
                    <ArtifactBView 
                      projectId={selectedProject.projectId} 
                      isAuthorized={selectedProject.status === 'IN_PROGRESS' || selectedProject.status === 'CLOSED'} 
                    />
                  </div>

                  {/* Milestone Framework */}
                  {fullProject?.milestone_framework_json && fullProject.milestone_framework_json.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        Milestone Framework
                      </h3>
                      <div className="relative pt-6 pb-2 border border-slate-200 rounded-xl bg-slate-50/50">
                        <div className="overflow-x-auto custom-scrollbar w-full">
                          <div className="flex relative z-10 gap-4 pb-4 px-8 w-max mx-auto">
                            {fullProject.milestone_framework_json.map((m: any, i: number) => {
                              const isActive = activeMilestoneId === m.milestone_number;

                              return (
                                <div key={i} className="flex flex-col items-center flex-shrink-0 w-32 relative">
                                  {/* Connecting line to the next dot */}
                                  {i < fullProject.milestone_framework_json.length - 1 && (
                                    <div className="absolute top-[9px] left-1/2 w-[calc(100%+1rem)] h-0.5 bg-slate-300 -z-10"></div>
                                  )}

                                  {/* Dot Button */}
                                  <button
                                    onClick={() => setActiveMilestoneId(isActive ? null : m.milestone_number)}
                                    className={`w-5 h-5 rounded-full border-[3px] mb-3 flex items-center justify-center transition-all bg-white z-10 ${isActive
                                        ? 'bg-blue-600 border-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]'
                                        : 'bg-white border-slate-300 hover:border-blue-400'
                                      }`}
                                  >
                                  </button>

                                  {/* Label */}
                                  <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>
                                    Phase {m.milestone_number}
                                  </span>

                                  {/* Formatted Price & Duration Preview */}
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {m.estimated_duration_days !== undefined && (
                                      <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {m.estimated_duration_days}d
                                      </span>
                                    )}
                                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shadow-sm">
                                      {new Intl.NumberFormat('vi-VN', { notation: 'compact', compactDisplay: 'short' }).format(m.payment_amount_vnd || m.estimated_cost_vnd || 0)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Active Milestone Details Pane */}
                        {activeMilestoneId && (() => {
                          const activeM = fullProject.milestone_framework_json.find((m: any) => m.milestone_number === activeMilestoneId);
                          if (!activeM) return null;
                          return (
                            <div className="mx-6 mb-4 mt-2 bg-slate-900 text-white p-5 rounded-xl shadow-lg border border-slate-800 animate-in fade-in slide-in-from-top-2">
                              <div className="mb-4">
                                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-1">Phase {activeM.milestone_number} Deliverable</span>
                                <p className="text-sm font-medium leading-relaxed">{activeM.deliverable_statement}</p>
                              </div>
                              <div className="flex justify-between items-end pt-4 border-t border-slate-700/50">
                                <div>
                                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-1">Sign Off Authority</span>
                                  <span className="text-xs font-semibold bg-slate-800 border border-slate-700 px-2.5 py-1 rounded">
                                    {activeM.sign_off_authority === 'JOINT' ? 'CEO, TECH TEAM' : activeM.sign_off_authority.replace('_', ' ')}
                                  </span>
                                </div>
                                {activeM.estimated_duration_days !== undefined && (
                                  <div>
                                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-1">Duration</span>
                                    <span className="text-xs font-semibold bg-slate-800 border border-slate-700 px-2.5 py-1 rounded text-slate-300">
                                      {activeM.estimated_duration_days} Days
                                    </span>
                                  </div>
                                )}
                                <div className="text-right">
                                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-1">Payment</span>
                                  <span className="text-emerald-400 font-bold text-base block">
                                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(activeM.payment_amount_vnd || activeM.estimated_cost_vnd || 0)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <p>Select a project to view details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expert NDA Modal */}
      <Modal
        isOpen={!!ndaEngagementId}
        onClose={() => setNdaEngagementId(null)}
        className="w-full max-w-3xl sm:max-w-3xl p-0 overflow-hidden bg-slate-50"
      >
        <div className="h-[80vh] overflow-y-auto">
          {ndaEngagementId && (
            <ExpertNdaClickThrough engagementId={ndaEngagementId} />
          )}
        </div>
      </Modal>
    </div>
  );
}
