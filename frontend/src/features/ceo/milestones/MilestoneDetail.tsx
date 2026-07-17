import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMilestone } from "@/hooks/use-milestones";
import { useEngagement } from "@/hooks/use-engagements";
import { StatusBadge, variantFromStatus } from "@/components/ui/StatusBadge";
import { Card, CardContent } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Button } from "@/components/ui/button";
import { formatVND } from "@/lib/utils";
import CriteriaVerify from "./CriteriaVerify";
import RevisionRequest from "./RevisionRequest";
import { ArrowLeft, Check, RotateCcw, AlertTriangle, FileText, Calendar, CheckCircle2, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MilestoneDetail() {
  const { engagementId, milestoneId } = useParams<{ engagementId: string; milestoneId: string }>();
  const navigate = useNavigate();

  // Fetch milestone detail (including acceptanceCriteria and dodItems nested)
  const { data: milestone, isLoading: isLoadingMilestone, error: milestoneError, refetch } = useMilestone(milestoneId);
  const { data: engagement, isLoading: isLoadingEngagement } = useEngagement(engagementId);

  // States for verification and revision modals
  const [selectedCriterion, setSelectedCriterion] = useState<{ id: string; text: string } | null>(null);
  const [activeModal, setActiveModal] = useState<"VERIFY" | "REVISION" | null>(null);

  const isLoading = isLoadingMilestone || isLoadingEngagement;
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

  // List of milestones to switch between
  const milestones = engagement?.milestones ?? [];

  const handleMilestoneSwitch = (id: string) => {
    navigate(`/ceo/engagements/${engagementId}/milestones/${id}`);
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
            onClick={() => navigate(`/ceo/engagements/${engagementId}/milestones`)}
            className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="Back to milestones"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-headline">Review Milestone Workspace</h1>
            <p className="text-sm text-slate-500">Verify deliverables, manage acceptance criteria, and release escrow funds.</p>
          </div>
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
                        size="xs"
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
                  <AlertTriangle className="w-5 h-5 shrink-0 text-slate-400 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-bold">Awaiting Escrow Funding</p>
                    <p className="text-slate-500">
                      The Expert cannot submit deliverables yet because this milestone is not funded. Go to the fund screen to initiate bank payments.
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
                      This milestone is currently funded. The Expert is working on deliverables and checking off their DoD requirements checklist.
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
                      You requested revisions on this milestone. The Expert has been notified of the feedback and must re-submit their deliverables once corrected.
                    </p>
                  </div>
                </div>
              )}

              {isApproved && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3 text-emerald-900">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-bold">Milestone Approved & Released</p>
                    <p className="text-emerald-800">
                      All criteria have been signed off. Escrow funds have been disbursed to the Expert's wallet.
                    </p>
                  </div>
                </div>
              )}

              {isDisputed && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-red-900">
                  <div className="flex gap-3">
                    <Scale className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-bold">Dispute File Pending Review</p>
                      <p className="text-red-800 font-body">
                        This milestone has an open dispute. Escrow funds are frozen. The system AI or platform administrator is resolving the dispute.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/ceo/engagements/${engagementId}/milestones/${milestoneId}/dispute/result`)}
                    className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 shrink-0 h-8 font-headline"
                  >
                    View Dispute Status
                  </Button>
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

              {/* Acceptance Criteria Sign Off Sheet */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Acceptance Criteria</h3>
                  
                  {/* File Dispute Button */}
                  {(isSubmitted || isRevisionPhase) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/ceo/engagements/${engagementId}/milestones/${milestoneId}/dispute`)}
                      className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 inline-flex items-center gap-1 h-8"
                    >
                      <Scale size={14} /> File Dispute
                    </Button>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/30">
                  {milestone.acceptanceCriteria && milestone.acceptanceCriteria.map((c, idx) => {
                    const isVerified = c.verifiedAt !== null;
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

                          {isVerified && c.verifiedAt && (
                            <p className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 w-max">
                              Signed off on {new Date(c.verifiedAt).toLocaleDateString()}
                            </p>
                          )}

                          {c.revisionNote && (
                            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200/50 rounded-lg p-2.5 mt-2 italic font-medium break-words">
                              <strong>Your Revision Feedback:</strong> {c.revisionNote}
                            </div>
                          )}
                        </div>

                        {/* Sign-off Actions */}
                        {isSubmitted && !isVerified && (
                          <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenRevision(c.id, c.criterionText)}
                              className="text-[12px] h-8 px-2.5 text-amber-600 border-amber-200 hover:bg-amber-50 inline-flex items-center gap-1"
                            >
                              <RotateCcw size={13} /> Request Revision
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenVerify(c.id, c.criterionText)}
                              className="text-[12px] bg-emerald-600 hover:bg-emerald-700 border-none h-8 px-2.5 inline-flex items-center gap-1 text-white"
                            >
                              <Check size={14} /> Verify & Approve
                            </Button>
                          </div>
                        )}

                        {isSubmitted && isVerified && (
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 shrink-0">
                            Verified
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

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
    </div>
  );
}
