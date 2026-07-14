import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEngagement } from "@/hooks/use-engagements";
import { useMilestone } from "@/hooks/use-milestones";
import { StatusBadge, variantFromStatus } from "@/components/ui/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Button } from "@/components/ui/button";
import { formatVND } from "@/lib/utils";
import DodChecklist from "./DodChecklist";
import DeliverableSubmit from "./DeliverableSubmit";
import { ArrowLeft, Lock, Calendar, FileText, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ExpertMilestoneDetail() {
  const { engagementId, milestoneId } = useParams<{ engagementId: string; milestoneId: string }>();
  const navigate = useNavigate();

  // Fetch data
  const { data: engagement, isLoading: isLoadingEngagement, error: engagementError } = useEngagement(engagementId);
  const { data: milestone, isLoading: isLoadingMilestone, error: milestoneError, refetch } = useMilestone(milestoneId);

  const isLoading = isLoadingEngagement || isLoadingMilestone;
  const error = engagementError || milestoneError;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !engagement || !milestone) {
    const errorMsg = (error as any)?.response?.data?.message || "Failed to load milestone workspace.";
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

  const milestones = engagement.milestones ?? [];
  const selectedMilestoneIndex = milestones.findIndex((m) => m.id === milestoneId);
  
  // Decide layout rendering based on milestone state
  const isLocked = milestone.state === "DEFINED" || milestone.state === "AWAITING_PAYMENT";
  const isUnderReview = milestone.state === "SUBMITTED";
  const isApproved = milestone.state === "APPROVED" || milestone.state === "RELEASED";
  const isDisputed = milestone.state === "DISPUTED";
  const isWorkPhase = milestone.state === "FUNDED" || milestone.state === "IN_PROGRESS" || milestone.state === "IN_REVISION";

  const handleMilestoneSwitch = (id: string) => {
    navigate(`/expert/engagements/${engagementId}/milestones/${id}`);
  };

  return (
    <div className="w-full max-w-[1440px] px-6 mx-auto py-8">
      {/* Back to Project button & Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/expert/service/projects`)}
            className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="Back to projects"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-headline">Milestone Workspace</h1>
            <p className="text-sm text-slate-500">Track DoD checklist requirements, submit deliverables, and review sign-offs.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* LEFT COLUMN: Sidebar Milestone Selector */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
              <CardTitle className="text-sm uppercase tracking-wider font-bold text-slate-600">Engagement Milestones</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
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
                      <p className="text-sm truncate font-medium">{m.deliverableStatement || "No deliverables statement"}</p>
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
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Active Milestone Detail Sheet */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-6">
              {/* Header Details */}
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

              {/* LOCKED STATE: DEFINED or AWAITING_PAYMENT */}
              {isLocked && (
                <div className="flex flex-col items-center justify-center text-center py-12 px-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
                    <Lock size={22} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Milestone Locked</h3>
                  <p className="text-sm text-slate-500 max-w-md">
                    Work has not started on this milestone because it is awaiting payment. Once the client funds this milestone into escrow, the status will update automatically and unlock your checklist.
                  </p>
                </div>
              )}

              {/* SUBMITTED STATE: Deliverables Awaiting Signoff */}
              {isUnderReview && (
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-blue-900">
                    <div className="flex gap-3">
                      <CheckCircle2 className="w-5 h-5 shrink-0 text-blue-500 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-bold">Awaiting Client Sign-off</p>
                        <p className="text-blue-800 font-body">
                          You have submitted the deliverables for this milestone. The sign-off authority is currently reviewing the submission against the acceptance criteria.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/expert/engagements/${engagementId}/milestones/${milestoneId}/dispute`)}
                      className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 shrink-0 h-8 font-headline"
                    >
                      File Dispute
                    </Button>
                  </div>

                  {/* Submitted contents preview */}
                  {milestone.submissions && milestone.submissions.length > 0 && (() => {
                    const latest = milestone.submissions[milestone.submissions.length - 1];
                    return (
                      <Card className="bg-slate-50/50">
                        <CardHeader className="p-4 border-b border-slate-100 flex items-center gap-2">
                          <FileText size={16} className="text-slate-500" />
                          <CardTitle className="text-sm text-slate-800">Your Submission Details</CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                          <div>
                            <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Submission Description</span>
                            <p className="text-sm text-slate-700 leading-relaxed mt-1 whitespace-pre-wrap">{latest.description}</p>
                          </div>

                          {latest.filesJson && (latest.filesJson as string[]).length > 0 && (
                            <div>
                              <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Attached Delivery Links</span>
                              <div className="mt-2 space-y-1.5">
                                {(latest.filesJson as string[]).map((file, idx) => (
                                  <a
                                    key={idx}
                                    href={file}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs font-mono text-primary hover:underline block truncate max-w-md bg-white border border-slate-200 rounded px-2.5 py-1.5 shadow-xs"
                                  >
                                    {file}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}
                </div>
              )}

              {/* APPROVED/RELEASED STATE */}
              {isApproved && (
                <div className="flex flex-col items-center justify-center text-center py-12 px-6 border border-emerald-200 rounded-2xl bg-emerald-50/10">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Milestone Approved & Released</h3>
                  <p className="text-sm text-slate-500 max-w-md mb-4">
                    All acceptance criteria have been verified successfully. The escrow sum of {formatVND(milestone.paymentAmountVnd)} has been released and credited to your available balance.
                  </p>
                  {milestone.releasedAt && (
                    <span className="text-xs text-slate-400">Released on: {new Date(milestone.releasedAt).toLocaleString()}</span>
                  )}
                </div>
              )}

              {/* DISPUTED STATE */}
              {isDisputed && (
                <div className="space-y-6">
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3 text-rose-900">
                    <ShieldAlert className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-bold">Milestone in Dispute</p>
                      <p className="text-rose-800 font-body">
                        An official dispute has been filed regarding this milestone. The escrow funds are frozen, and the submission is under evaluation by the platform AI and manual admin review.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-center py-4 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/expert/wallet`)}
                      className="inline-flex items-center gap-1.5 font-headline text-xs h-9 px-3"
                    >
                      Check Wallet Logs
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => navigate(`/expert/engagements/${engagementId}/milestones/${milestoneId}/dispute/result`)}
                      className="inline-flex items-center gap-1.5 font-headline text-xs h-9 px-3 text-white border-none"
                    >
                      View Dispute Status
                    </Button>
                  </div>
                </div>
              )}

              {/* ACTIVE WORK PHASE: FUNDED, IN_PROGRESS, or IN_REVISION */}
              {isWorkPhase && (
                <div className="space-y-8">
                  {/* Revision Alert block */}
                  {milestone.state === "IN_REVISION" && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-900">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
                      <div className="text-sm space-y-1">
                        <p className="font-bold">Revision Requested</p>
                        <p className="text-amber-800">
                          The client has requested revisions on your deliverable. Please check the acceptance criteria below for comments and update your checklist accordingly.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Acceptance Criteria listing with revision comments */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Acceptance Criteria to Meet</h3>
                      {milestone.state === "IN_REVISION" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/expert/engagements/${engagementId}/milestones/${milestoneId}/dispute`)}
                          className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 inline-flex items-center gap-1 h-8 font-headline"
                        >
                          File Dispute
                        </Button>
                      )}
                    </div>
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/30">
                      {milestone.acceptanceCriteria && milestone.acceptanceCriteria.map((c, idx) => (
                        <div
                          key={c.id}
                          className={cn(
                            "p-4 flex flex-col gap-2 bg-white",
                            idx > 0 && "border-t border-slate-100"
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <span className="text-sm text-slate-800 font-medium">{c.criterionText}</span>
                            <span className="shrink-0 text-xs uppercase tracking-wider font-bold">
                              {c.verifiedAt ? (
                                <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Verified</span>
                              ) : (
                                <span className="text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">Pending Review</span>
                              )}
                            </span>
                          </div>
                          {c.revisionNote && (
                            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200/50 rounded-lg p-2.5 mt-1 font-medium">
                              <strong>Client Revision Note:</strong> {c.revisionNote}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* DoD Checklist Panel */}
                  <div className="border-t border-slate-100 pt-6 space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-800 font-headline">DoD Requirements Checklist</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Define your delivery checklists and check off required items with completion comments.</p>
                    </div>
                    <DodChecklist
                      milestoneId={milestone.id}
                      dodItems={milestone.dodItems || []}
                      acceptanceCriteria={milestone.acceptanceCriteria || []}
                    />
                  </div>

                  {/* Deliverable Submission Panel */}
                  <div className="border-t border-slate-100 pt-6">
                    <DeliverableSubmit
                      milestoneId={milestone.id}
                      dodItems={milestone.dodItems || []}
                      onSuccessSubmit={() => refetch()}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
