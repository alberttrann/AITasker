import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEngagement } from "@/hooks/use-engagements";
import { useMilestone } from "@/hooks/use-milestones";
import { useMilestoneSettlement } from "@/hooks/use-disputes";
import { useDownloadDocument, useRetractLatestSubmission } from "@/hooks/use-submissions";
import { StatusBadge, variantFromStatus } from "@/components/ui/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
import { formatVND } from "@/lib/utils";
import { getSettlementCopy } from "@/lib/dispute-resolution";
import DodChecklist from "./DodChecklist";
import DeliverableSubmit from "./DeliverableSubmit";
import { ArrowLeft, Lock, Calendar, FileText, CheckCircle2, AlertTriangle, ShieldAlert, RotateCcw, Scale, MessageSquare, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import MilestoneChatPanel from "@/components/messaging/MilestoneChatPanel";
import { BankLinkReminder } from "@/components/wallet/BankLinkReminder";
import PaygatedDocsStaging from "./PaygatedDocsStaging";
export default function ExpertMilestoneDetail() {
  const { engagementId, milestoneId } = useParams<{ engagementId: string; milestoneId: string }>();
  const navigate = useNavigate();

  // State for workspace chat drawer (additive — keeps existing inbox navigation intact)
  const [isChatOpen, setIsChatOpen] = useState(false);
  // retract submission confirm dialog + error surfacing
  const [showRetractConfirm, setShowRetractConfirm] = useState(false);
  const [retractError, setRetractError] = useState<string | null>(null);
  const retractSubmission = useRetractLatestSubmission();

  // Fetch data
  const { data: engagement, isLoading: isLoadingEngagement, error: engagementError } = useEngagement(engagementId);
  const { data: milestone, isLoading: isLoadingMilestone, error: milestoneError, refetch } = useMilestone(milestoneId);
  const {
    settlementOutcome,
    isLoading: isLoadingSettlement,
    isError: isSettlementError,
  } = useMilestoneSettlement(milestoneId);

  const isLoading = isLoadingEngagement || isLoadingMilestone || isLoadingSettlement;
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
  
  const isServiceOrder = engagement.type === 'SERVICE_PURCHASE' || engagement.type === 'TECH_DISCOVERY';

  // Decide layout rendering based on milestone state
  const isLocked = milestone.state === "DEFINED" || milestone.state === "AWAITING_PAYMENT";
  const isUnderReview = milestone.state === "SUBMITTED";
  const isApproved = milestone.state === "APPROVED" || milestone.state === "RELEASED";
  const isDisputed = milestone.state === "DISPUTED";
  const isWorkPhase = milestone.state === "FUNDED" || milestone.state === "IN_PROGRESS" || milestone.state === "IN_REVISION";
  const approvedSettlement = isSettlementError
    ? "UNKNOWN"
    : settlementOutcome ?? "EXPERT_RELEASED";
  const settlementText = getSettlementCopy(
    approvedSettlement,
    "EXPERT",
    formatVND(milestone.paymentAmountVnd),
  );
  const settlementCopy = approvedSettlement === "CLIENT_REFUNDED"
    ? {
        ...settlementText,
        wrapperClass: "border-rose-200 bg-rose-50/20",
        iconWrapperClass: "bg-rose-100 text-rose-600",
        bodyClass: "text-rose-800",
        icon: RotateCcw,
      }
    : approvedSettlement === "SPLIT"
      ? {
          ...settlementText,
          wrapperClass: "border-amber-200 bg-amber-50/20",
          iconWrapperClass: "bg-amber-100 text-amber-600",
          bodyClass: "text-amber-800",
          icon: Scale,
        }
      : approvedSettlement === "UNKNOWN" || approvedSettlement === "FUNDS_HELD" || approvedSettlement === "FUNDS_FROZEN"
        ? {
            ...settlementText,
            wrapperClass: "border-slate-200 bg-slate-50/50",
            iconWrapperClass: "bg-slate-100 text-slate-500",
            bodyClass: "text-slate-600",
            icon: AlertTriangle,
          }
        : {
            ...settlementText,
            wrapperClass: "border-emerald-200 bg-emerald-50/10",
            iconWrapperClass: "bg-emerald-100 text-emerald-600",
            bodyClass: "text-slate-500",
            icon: CheckCircle2,
          };
  const SettlementIcon = settlementCopy.icon;

  const handleMilestoneSwitch = (id: string) => {
    navigate(`/expert/engagements/${engagementId}/milestones/${id}`);
  }   

  return (
    <div className="w-full max-w-[1440px] px-6 mx-auto py-8">
      {/* Back to Project button & Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(isServiceOrder ? `/expert/service/orders` : `/expert/service/projects`)}
            className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label={isServiceOrder ? "Back to orders" : "Back to projects"}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-headline">Milestone Workspace</h1>
            <p className="text-sm text-slate-500">Track DoD checklist requirements, submit deliverables, and review sign-offs.</p>
          </div>
        </div>

        {/* Group expert's actions together on the right side of heading line */}
        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={() => setIsChatOpen(true)}
            className="inline-flex items-center gap-2 font-semibold"
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
                        className="px-2 py-0.5 text-[10px]"
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
                    <span>ΓÇó</span>
                    <span>Sign-off Authority: <strong className="text-slate-700">{milestone.signOffAuthority.replace(/_/g, " ")}</strong></span>
                  </div>
                </div>

                <div className="sm:text-right">
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-400">Escrow Value</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{formatVND(milestone.paymentAmountVnd)}</p>
                </div>
              </div>

              {/* Service Scope & Timeline (For Service Orders) */}
              {isServiceOrder && engagement?.service && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Service Scope & Timeline</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Scope of Work</h4>
                      <ul className="space-y-2 text-sm text-slate-700">
                        {(() => {
                          const scope = engagement.service.scope;
                          if (!scope) return <span className="italic text-slate-500">Not specified</span>;
                          try {
                            const parsed = JSON.parse(scope);
                            if (Array.isArray(parsed)) {
                              return parsed.map((item, i) => <li key={i} className="flex gap-2"><span className="text-emerald-500 font-bold">•</span><span className="leading-relaxed">{item}</span></li>);
                            }
                          } catch {
                            return scope.split('\n').filter(Boolean).map((line: string, i: number) => <li key={i} className="flex gap-2"><span className="text-emerald-500 font-bold">•</span><span className="leading-relaxed">{line.replace(/^- /, '')}</span></li>);
                          }
                          return <li>{scope}</li>;
                        })()}
                      </ul>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Estimated Timeline</h4>
                      <div className="space-y-2 text-sm text-slate-700">
                        {(() => {
                          const timeline = engagement.service.timeline;
                          if (!timeline) return <span className="italic text-slate-500">Not specified</span>;
                          return timeline.split('\n').filter(Boolean).map((line: string, i: number) => {
                            const isTotal = line.toLowerCase().includes('total');
                            return (
                              <div key={i} className={`flex items-center gap-2 ${isTotal ? 'font-bold text-slate-900 mt-3 pt-3 border-t border-slate-200' : ''}`}>
                                {isTotal ? <Clock size={14} className="text-blue-500" /> : <span className="text-blue-500 font-bold">•</span>}
                                <span>{line}</span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* LOCKED STATE: DEFINED or AWAITING_PAYMENT */}
              {isLocked && (
                <>
                  <div className="flex flex-col items-center justify-center text-center py-12 px-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
                      <Lock size={22} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">Milestone Locked</h3>
                    <p className="text-sm text-slate-500 max-w-md">
                      Work has not started on this milestone because it is awaiting payment. Once the client funds this milestone into escrow, the status will update automatically and unlock your checklist.
                    </p>
                  </div>

                  {/* stage pay-gated docs now — they'll auto-unlock the moment funding clears */}
                  {milestoneId && <PaygatedDocsStaging milestoneId={milestoneId} />}
                </>
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

                  <BankLinkReminder
                    context="If this milestone gets approved before you link a bank account, your payout can't be processed automatically."
                  />

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

                          {retractError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                              {retractError}
                            </div>
                          )}
                          <div className="border-t border-slate-100 pt-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setRetractError(null);
                                setShowRetractConfirm(true);
                              }}
                              disabled={retractSubmission.isPending}
                              className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed"
                            >
                              <RotateCcw size={14} className="mr-1.5" />
                              Retract Submission
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}
                </div>
              )}

              {/* APPROVED/RELEASED STATE */}
              {isApproved && (
                <div className={`flex flex-col items-center justify-center text-center py-12 px-6 border rounded-2xl ${settlementCopy.wrapperClass}`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${settlementCopy.iconWrapperClass}`}>
                    <SettlementIcon size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{settlementCopy.title}</h3>
                  <p className={`text-sm max-w-md mb-4 ${settlementCopy.bodyClass}`}>
                    {settlementCopy.body}
                  </p>
                  {approvedSettlement === "EXPERT_RELEASED" && milestone.releasedAt && (
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

                  {/* DoD Checklist Panel - Only for Custom Project-Based Milestones */}
                  {!isServiceOrder && (
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
                  )}

                  {/* Deliverable Submission Panel */}
                  <div className="border-t border-slate-100 pt-6">
                    <DeliverableSubmit
                      milestoneId={milestone.id}
                      dodItems={isServiceOrder ? [] : (milestone.dodItems || [])}
                      onSuccessSubmit={() => refetch()}
                    />
                  </div>
                </div>
              )}

              <ReleasedDocsSection milestoneId={milestone.id} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Workspace Chat Drawer — additive, does not affect existing inbox navigation */}
      <MilestoneChatPanel
        engagementId={engagementId || ""}
        clientId={engagement.clientId}
        expertId={engagement.expertId}
        projectName={engagement.project?.projectName ?? undefined}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

      {/* Retract Submission confirm modal */}
      <ConfirmModal
        isOpen={showRetractConfirm}
        onClose={() => setShowRetractConfirm(false)}
        onConfirm={() => {
          if (!milestoneId) return;
          retractSubmission.mutate(
            { milestoneId },
            {
              onSuccess: () => {
                setShowRetractConfirm(false);
                refetch();
              },
              onError: (err: any) => {
                setRetractError(
                  err?.response?.data?.message || "Failed to retract submission.",
                );
                setShowRetractConfirm(false);
              },
            },
          );
        }}
        title="Retract this submission?"
        confirmText="Retract Submission"
        isDestructive
      >
        <p className="text-sm text-slate-600">
          This will delete your submitted deliverable and revert this milestone
          back to in-progress. You'll need to resubmit once you're ready. This
          action cannot be undone.
        </p>
      </ConfirmModal>
    </div>
  );
}

function ReleasedDocsSection({ milestoneId }: { milestoneId: string }) {
  const { data: docs, isLoading } = useDownloadDocument(milestoneId);

  if (isLoading || !docs || docs.length === 0) return null;

  return (
    <div className="border-t border-slate-100 pt-6">
      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
        Pay-Gated Documents
      </h3>
      <div className="space-y-2">
        {docs.map((doc) => (
          <a
            key={doc.id}
            href={doc.documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 px-3 py-2 text-sm transition-colors"
          >
            <FileText size={14} className="text-slate-400 shrink-0" />
            <span className="truncate flex-1 text-slate-700">{doc.documentUrl}</span>
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              Released
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
