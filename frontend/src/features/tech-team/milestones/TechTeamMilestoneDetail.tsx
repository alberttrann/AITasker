import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMilestone } from "@/hooks/use-milestones";
import { useEngagement } from "@/hooks/use-engagements";
import { useDownloadDocument } from "@/hooks/use-submissions";
import { useMilestoneSettlement } from "@/hooks/use-disputes";
import { StatusBadge, variantFromStatus } from "@/components/ui/StatusBadge";
import { Card, CardContent } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Button } from "@/components/ui/button";
import { formatVND } from "@/lib/utils";
import { getSettlementCopy } from "@/lib/dispute-resolution";
import CriteriaVerify from "@/features/ceo/milestones/CriteriaVerify";
import RevisionRequest from "@/features/ceo/milestones/RevisionRequest";
import MilestoneChatPanel from "@/components/messaging/MilestoneChatPanel";
import { ArrowLeft, Check, RotateCcw, FileText, Calendar, CheckCircle2, MessageSquare, Download, AlertTriangle, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TechTeamMilestoneDetail() {
  const { engagementId, milestoneId } = useParams<{ engagementId: string; milestoneId: string }>();
  const navigate = useNavigate();

  // Fetch milestone detail (including acceptanceCriteria and dodItems nested)
  const { data: milestone, isLoading: isLoadingMilestone, error: milestoneError, refetch } = useMilestone(milestoneId);
  const { data: engagement, isLoading: isLoadingEngagement } = useEngagement(engagementId);
  const { data: paygatedDocs } = useDownloadDocument(milestoneId || "");
  const {
    settlementOutcome,
    isLoading: isLoadingSettlement,
    isError: isSettlementError,
  } = useMilestoneSettlement(milestoneId);

  // States for verification, revision, and chat drawer
  const [selectedCriterion, setSelectedCriterion] = useState<{ id: string; text: string } | null>(null);
  const [activeModal, setActiveModal] = useState<"VERIFY" | "REVISION" | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const isLoading = isLoadingMilestone || isLoadingEngagement || isLoadingSettlement;
  const error = milestoneError;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !milestone) {
    const errorMsg = (error as any)?.response?.data?.message || "Failed to load milestone details.";
    return (
      <div className="w-full max-w-[1440px] px-6 mx-auto py-8">
        <ErrorBanner message={errorMsg} onRetry={() => refetch()} />
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="mt-4 inline-flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Go Back
        </Button>
      </div>
    );
  }

  const isFunded = milestone.state !== "DEFINED" && milestone.state !== "AWAITING_PAYMENT";
  const isWorkPhase = milestone.state === "FUNDED" || milestone.state === "IN_PROGRESS";
  const isSubmitted = milestone.state === "SUBMITTED";
  const isRevisionPhase = milestone.state === "IN_REVISION";
  const isApproved = milestone.state === "APPROVED" || milestone.state === "RELEASED";
  const isDisputed = milestone.state === "DISPUTED";
  
  const approvedSettlement = isSettlementError
    ? "UNKNOWN"
    : settlementOutcome ?? "EXPERT_RELEASED";
  const settlementText = getSettlementCopy(approvedSettlement, "CLIENT");
  const settlementCopy = approvedSettlement === "CLIENT_REFUNDED"
    ? {
        ...settlementText,
        wrapperClass: "bg-emerald-50 border-emerald-100 text-emerald-900",
        iconClass: "text-emerald-600",
        bodyClass: "text-emerald-800",
        icon: RotateCcw,
      }
    : approvedSettlement === "SPLIT"
      ? {
          ...settlementText,
          wrapperClass: "bg-amber-50 border-amber-200 text-amber-900",
          iconClass: "text-amber-600",
          bodyClass: "text-amber-800",
          icon: Scale,
        }
      : approvedSettlement === "UNKNOWN" || approvedSettlement === "FUNDS_HELD" || approvedSettlement === "FUNDS_FROZEN"
        ? {
            ...settlementText,
            wrapperClass: "bg-slate-50 border-slate-200 text-slate-900",
            iconClass: "text-slate-500",
            bodyClass: "text-slate-700",
            icon: AlertTriangle,
          }
        : {
            ...settlementText,
            wrapperClass: "bg-emerald-50 border-emerald-100 text-emerald-900",
            iconClass: "text-emerald-600",
            bodyClass: "text-emerald-800",
            icon: CheckCircle2,
          };
  const SettlementIcon = settlementCopy.icon;

  // List of milestones to switch between
  const milestones = engagement?.milestones ?? [];

  const handleMilestoneSwitch = (id: string) => {
    navigate(`/tech-team/engagements/${engagementId}/milestones/${id}`);
  };

  const handleOpenVerify = (id: string, text: string) => {
    setSelectedCriterion({ id, text });
    setActiveModal("VERIFY");
  };

  const handleOpenRevision = (id: string, text: string) => {
    setSelectedCriterion({ id, text });
    setActiveModal("REVISION");
  };

  const handleCloseModal = () => {
    setSelectedCriterion(null);
    setActiveModal(null);
  };

  return (
    <div className="w-full max-w-[1440px] px-6 mx-auto py-8">
      {/* Header and navigation bar */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/tech-team/projects`)}
            className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="Back to projects"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-headline">Review Milestone Workspace</h1>
            <p className="text-sm text-slate-500">Sign off technical deliverables and collaborate with the project team.</p>
          </div>
        </div>

        {/* Workspace Chat Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={() => setIsChatOpen(true)}
            className="inline-flex items-center gap-2 font-semibold hover:bg-slate-50"
          >
            <MessageSquare size={16} className="text-slate-600" />
            Discuss with Team
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* LEFT COLUMN: Sidebar Milestone Selector */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <div className="bg-slate-50 border-b border-slate-100 p-4 font-headline text-xs uppercase tracking-wider font-bold text-slate-600">
              Engagement Milestones
            </div>
            <div className="p-2 space-y-1">
              {milestones.map((m) => {
                const isActive = m.id === milestoneId;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleMilestoneSwitch(m.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg flex items-center justify-between transition-all border",
                      isActive
                        ? "bg-primary-bg border-primary/20 text-primary font-semibold"
                        : "bg-white border-transparent hover:bg-slate-50 text-slate-700"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Milestone #{m.milestoneNumber}</p>
                      <p className="text-sm truncate font-medium">{m.deliverableStatement || "No deliverable statement"}</p>
                    </div>
                    <span className="shrink-0 ml-2">
                      <StatusBadge
                        label={m.state.replace(/_/g, " ")}
                        variant={variantFromStatus(m.state)}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: Milestone Review Sheet */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-6">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-slate-400 tracking-wider">MILESTONE #{milestone.milestoneNumber}</span>
                    <StatusBadge
                      label={milestone.state.replace(/_/g, " ")}
                      variant={variantFromStatus(milestone.state)}
                    />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 leading-snug">{milestone.deliverableStatement || "No deliverables specified."}</h2>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} /> Registered: <strong>{new Date(milestone.updatedAt).toLocaleDateString()}</strong>
                    </span>
                    <span>•</span>
                    <span>Sign-off Authority: <strong className="text-slate-700">{milestone.signOffAuthority.replace(/_/g, " ")}</strong></span>
                  </div>
                </div>

                <div className="sm:text-right">
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-400">Escrow Value</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{formatVND(milestone.paymentAmountVnd)}</p>
                </div>
              </div>

              {/* Status Alert Banners */}
              {!isFunded && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-3 text-slate-800">
                  <div className="text-sm">
                    <p className="font-bold">Awaiting Escrow Funding</p>
                    <p className="text-slate-500">
                      This milestone is currently awaiting payment from the CEO. Work will begin once funded.
                    </p>
                  </div>
                </div>
              )}

              {isWorkPhase && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-3 text-slate-800">
                  <Spinner className="w-5 h-5 shrink-0 text-slate-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-bold">Expert Executing Work</p>
                    <p className="text-slate-500">
                      The Expert is currently working on deliverables and compiling their checklist of DoD requirements.
                    </p>
                  </div>
                </div>
              )}

              {isRevisionPhase && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-900">
                  <RotateCcw className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-bold">Awaiting Expert Re-submission</p>
                    <p className="text-amber-800">
                      Revisions have been requested for this milestone. The Expert is resolving the feedback before re-submitting.
                    </p>
                  </div>
                </div>
              )}

              {isApproved && (
                <div className={`${settlementCopy.wrapperClass} border rounded-xl p-4 flex gap-3`}>
                  <SettlementIcon className={`w-5 h-5 shrink-0 mt-0.5 ${settlementCopy.iconClass}`} />
                  <div className="text-sm">
                    <p className="font-bold">{settlementCopy.title}</p>
                    <p className={settlementCopy.bodyClass}>{settlementCopy.body}</p>
                  </div>
                </div>
              )}

              {isDisputed && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-red-900">
                  <div className="text-sm">
                    <p className="font-bold">Dispute Pending Review</p>
                    <p className="text-red-800">
                      This milestone has an open dispute. Escrow funds are locked while system arbitration resolves the issue.
                    </p>
                  </div>
                </div>
              )}

              {/* Expert Submission Details Panel */}
              {(isSubmitted || isRevisionPhase || isApproved || isDisputed) && milestone.submissions && milestone.submissions.length > 0 && (() => {
                const latest = milestone.submissions[milestone.submissions.length - 1];
                return (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Expert Delivery Details</h3>
                    <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-5 space-y-4">
                      <div>
                        <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Submission Description</span>
                        <p className="text-sm text-slate-700 leading-relaxed mt-1.5 whitespace-pre-wrap">{latest.description || "No description provided."}</p>
                      </div>

                      {latest.filesJson && (latest.filesJson as string[]).length > 0 && (
                        <div>
                          <span className="text-xs uppercase tracking-wider font-bold text-slate-400 font-headline">Submitted Links & Files</span>
                          <div className="mt-2 space-y-1.5">
                            {(latest.filesJson as string[]).map((url, idx) => (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-mono text-primary hover:underline block truncate max-w-lg bg-white border border-slate-200 rounded px-2.5 py-1.5 shadow-xs"
                              >
                                {url}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-slate-400 border-t border-slate-100 pt-3">
                        Submitted at: <strong>{new Date(latest.submittedAt).toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Paygated technical documents released to Tech Team */}
              {paygatedDocs && paygatedDocs.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Technical Vault (Pay-Gated)</h3>
                  <div className="bg-emerald-50/30 border border-emerald-200/50 rounded-xl p-5 space-y-4">
                    <p className="text-xs text-slate-500">
                      These technical documents were released upon milestone approval.
                    </p>
                    <div className="space-y-2">
                      {paygatedDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText size={16} className="text-emerald-600 shrink-0" />
                            <span className="text-xs font-medium text-slate-700 truncate">{doc.documentUrl}</span>
                          </div>
                          <a
                            href={doc.documentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded transition-colors"
                          >
                            <Download size={12} /> Download
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Acceptance Criteria Sign Off Sheet */}
              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Acceptance Criteria</h3>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/30">
                  {milestone.acceptanceCriteria && milestone.acceptanceCriteria.map((c, idx) => {
                    const techVerified = Boolean(c.techVerifiedAt);
                    const ceoVerified = Boolean(c.ceoVerifiedAt || c.verifiedAt);
                    const canReviewCriterion =
                      isSubmitted &&
                      techReviewRequired && !techReviewComplete && !techVerified;

                    return (
                      <div
                        key={c.id}
                        className={cn(
                          "p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-white",
                          idx > 0 && "border-t border-slate-100"
                        )}
                      >
                        <div className="space-y-2 flex-1 min-w-0">
                          <p className="text-[15px] font-medium text-slate-800 leading-snug break-words">
                            {c.criterionText}
                            {c.isRequired && <span className="text-red-500 ml-1 font-bold">*</span>}
                          </p>

                          <div className="flex items-center gap-2 flex-wrap">
                            {isVerified && c.verifiedAt && (
                              <p className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 w-max">
                                Signed off on {new Date(c.verifiedAt).toLocaleDateString()}
                              </p>
                            )}
                            <span className="text-[9px] font-black bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded tracking-wide uppercase">
                              Authority: {c.verifiedByRole}
                            </span>
                          </div>

                          {c.revisionNote && (
                            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200/50 rounded-lg p-2.5 mt-2 italic font-medium break-words">
                              <strong>Revision Feedback:</strong> {c.revisionNote}
                            </div>
                          )}
                        </div>

                        {/* Sign-off Actions */}
                        {canReviewCriterion && (
                          <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenRevision(c.id, c.criterionText)}
                              className="text-[12px] h-8 px-2.5 text-amber-600 border-amber-200 hover:bg-amber-50 inline-flex items-center gap-1 cursor-pointer"
                              id={`btn-tech-request-criterion-revision-${c.id}`}
                            >
                              <RotateCcw size={13} /> Request Revision
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenVerify(c.id, c.criterionText)}
                              className="text-[12px] bg-emerald-600 hover:bg-emerald-700 border-none h-8 px-2.5 inline-flex items-center gap-1 text-white cursor-pointer"
                              id={`btn-tech-verify-criterion-${c.id}`}
                            >
                              <Check size={14} /> Verify & Approve
                            </Button>
                          </div>
                        )}

                        {isSubmitted && techVerified && !ceoVerified && (
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 shrink-0">
                            Tech Sign-off Complete
                          </span>
                        )}

                        {isSubmitted && ceoVerified && (
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 shrink-0">
                            Fully Verified
                          </span>
                        )}
                      </div>
                    );
                  })}

              {/* Expert's Definition of Done (DoD) Checklist - Read-Only Viewer */}
              {isFunded && milestone.dodItems && milestone.dodItems.length > 0 && (
                <div className="border-t border-slate-100 pt-6 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 font-headline">DoD Verification checklist</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Review checklists and completion comments completed by the Expert.</p>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/20 divide-y divide-slate-100">
                    {milestone.dodItems.map((item) => {
                      const completed = item.status === "COMPLETED";
                      const na = item.status === "NOT_APPLICABLE";
                      return (
                        <div key={item.id} className="p-4 flex items-start justify-between gap-4 bg-white">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-800 leading-snug">{item.itemDescription}</span>
                              {item.isRequired && (
                                <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Required</span>
                              )}
                            </div>

                            {completed && item.completionNote && (
                              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg p-2.5 mt-2 italic break-words">
                                <strong>Expert note:</strong> {item.completionNote}
                              </p>
                            )}

                            {na && item.notApplicableNote && (
                              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg p-2.5 mt-2 italic break-words">
                                <strong>N/A Reason:</strong> {item.notApplicableNote}
                              </p>
                            )}
                          </div>

                          <span className="shrink-0 text-xs font-bold tracking-wider uppercase">
                            {completed ? (
                              <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Completed</span>
                            ) : na ? (
                              <span className="text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">N/A</span>
                            ) : (
                              <span className="text-amber-500 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Pending</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Criteria Verification Modal */}
      {selectedCriterion && activeModal === "VERIFY" && (
        <CriteriaVerify
          isOpen={true}
          onClose={handleCloseModal}
          criterionId={selectedCriterion.id}
          criterionText={selectedCriterion.text}
          onSuccess={() => refetch()}
        />
      )}

      {/* Revision Request Modal */}
      {selectedCriterion && activeModal === "REVISION" && (
        <RevisionRequest
          isOpen={true}
          onClose={handleCloseModal}
          criterionId={selectedCriterion.id}
          criterionText={selectedCriterion.text}
          onSuccess={() => refetch()}
        />
      )}

      {/* Embedded Workspace Chat Drawer */}
      {engagement && (
        <MilestoneChatPanel
          engagementId={engagementId || ""}
          clientId={engagement.clientId}
          expertId={engagement.expertId}
          projectName={(engagement as any).project?.projectName}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      )}
    </div>
  );
}
