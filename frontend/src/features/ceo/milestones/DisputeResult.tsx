import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDisputes } from "@/hooks/use-disputes";
import { useMilestone } from "@/hooks/use-milestones";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ArrowLeft, Scale, AlertTriangle, ShieldCheck, Clock } from "lucide-react";
import {
  formatDisputeResolution,
  formatEscrowMovement,
} from "@/lib/dispute-resolution";

export default function DisputeResult() {
  const { engagementId, milestoneId } = useParams<{ engagementId: string; milestoneId: string }>();
  const navigate = useNavigate();

  const { data: milestone, isLoading: isLoadingMilestone } = useMilestone(milestoneId);
  const { data: disputes, isLoading: isLoadingDisputes, error, refetch } = useDisputes();

  const isLoading = isLoadingMilestone || isLoadingDisputes;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !milestone) {
    const errorMsg = (error as any)?.response?.data?.message || "Failed to load dispute data.";
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <ErrorBanner message={errorMsg} onRetry={() => refetch()} />
        <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
          <ArrowLeft size={16} className="mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  // Find active dispute for this milestone
  const activeDispute = disputes?.find(
    (dispute) => (dispute.milestoneId ?? dispute.milestone_id) === milestoneId,
  );

  if (!activeDispute) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 py-12 text-center space-y-4">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto">
          <Scale size={20} />
        </div>
        <h3 className="text-lg font-bold text-slate-900">No disputes found</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          No dispute record exists for this milestone. Disputes can only be filed if deliverable sign-offs are contested.
        </p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const isAutoResolved = activeDispute.state === "AUTO_RESOLVED";
  const isResolved = activeDispute.state === "RESOLVED";
  const isPendingAI = activeDispute.state === "LAYER_1_EVAL";
  const isAwaitingAdmin = activeDispute.state === "MANUAL_REVIEW";
  const resolutionLabel = formatDisputeResolution(activeDispute.resolution);
  const escrowStatus = activeDispute.escrowAccount?.status;
  const escrowMovement = formatEscrowMovement(escrowStatus, "CLIENT");
  
  // Find criterion text
  const criterionText = milestone.acceptanceCriteria?.find(c => c.id === activeDispute.criterionId)?.criterionText || "Acceptance Criterion";

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          aria-label="Go Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-headline">Dispute Resolution Status</h1>
          <p className="text-sm text-slate-500">Track AI evaluations and manual admin resolution updates.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Status Banner */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs uppercase font-bold text-slate-400">Status</span>
              <div className="mt-1">
                <StatusBadge
                  label={activeDispute.state.replace(/_/g, " ")}
                  variant={isAutoResolved || isResolved ? "success" : isPendingAI ? "warning" : "error"}
                />
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs uppercase font-bold text-slate-400">Filed Date</span>
              <p className="font-semibold text-slate-800 text-sm mt-1">{new Date(activeDispute.filedAt).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-sm text-slate-700 space-y-2">
              <span className="text-xs uppercase font-bold text-slate-400 font-headline">Disputed Requirement</span>
              <p className="font-medium text-slate-800">{criterionText}</p>
            </div>

            {/* AI confidence score metric */}
            {activeDispute.llmConfidence !== null && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                <span className="text-xs uppercase font-bold text-slate-400 block">AI Evaluation Confidence</span>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${activeDispute.llmConfidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-blue-700">{(activeDispute.llmConfidence * 100).toFixed(0)}%</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  AI confidence threshold for auto-resolution is 80%. The evaluation compares the criterion with the deliverable description; submitted URLs are reference metadata only.
                </p>
              </div>
            )}

            {activeDispute.llmReasoning && (
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm space-y-2">
                <span className="text-xs uppercase font-bold text-blue-500 block">
                  AI Reasoning
                </span>
                <p className="text-blue-950 leading-relaxed">
                  {activeDispute.llmReasoning}
                </p>
              </div>
            )}

            {(isAutoResolved || isResolved) && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                  <span className="text-xs uppercase font-bold text-slate-400 block">
                    Resolution
                  </span>
                  <p className="mt-1 font-bold text-slate-900">{resolutionLabel}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                  <span className="text-xs uppercase font-bold text-slate-400 block">
                    Escrow Status
                  </span>
                  <p className="mt-1 font-bold text-slate-900">
                    {escrowStatus ?? "Unavailable"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{escrowMovement}</p>
                </div>
              </div>
            )}

            {/* Stage description cards */}
            {isPendingAI && (
              <div className="border border-amber-200 bg-amber-50/20 rounded-xl p-4 flex gap-3 text-amber-900">
                <Clock className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-bold">Layer 1: AI Evaluation Active</p>
                  <p className="text-amber-800 leading-relaxed">
                    The platform AI is currently verifying Expert deliverable submissions against the disputed criteria. This usually completes in under a minute. Refresh the page for updates.
                  </p>
                </div>
              </div>
            )}

            {isAwaitingAdmin && (
              <div className="border border-rose-200 bg-rose-50/20 rounded-xl p-4 flex gap-3 text-rose-900">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-bold">Layer 2: Awaiting Manual Admin Review</p>
                  <p className="text-rose-800 leading-relaxed">
                    AI verification confidence was below the 80% threshold. The dispute has been routed to the Platform Administration queue for manual sign-off.
                  </p>
                </div>
              </div>
            )}

            {(isAutoResolved || isResolved) && (
              <div className="border border-emerald-200 bg-emerald-50/20 rounded-xl p-4 flex gap-3 text-emerald-900">
                <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-bold">Mediation Completed</p>
                  <p className="text-emerald-800 leading-relaxed">
                    The dispute has been resolved by the {isAutoResolved ? "AI auto-evaluator" : "Platform Administrator"}. {escrowMovement}
                  </p>
                  {activeDispute.resolvedAt && (
                    <span className="block text-[11px] text-emerald-600 mt-2 font-medium">
                      Resolved Date: {new Date(activeDispute.resolvedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button onClick={() => navigate(-1)}>
              Back to Workspace
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
