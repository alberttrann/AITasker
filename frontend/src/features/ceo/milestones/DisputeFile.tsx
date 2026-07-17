import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMilestone } from "@/hooks/use-milestones";
import { useCreateDispute } from "@/hooks/use-disputes";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { AlertCircle, Scale, ArrowLeft, ShieldAlert } from "lucide-react";
import { formatVND } from "@/lib/utils";

export default function DisputeFile() {
  const { milestoneId } = useParams<{ milestoneId: string }>();
  const navigate = useNavigate();

  // Fetch milestone
  const { data: milestone, isLoading, error, refetch } = useMilestone(milestoneId);
  const createDisputeMutation = useCreateDispute();

  // Form states
  const [selectedCriterionId, setSelectedCriterionId] = useState("");
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !milestone) {
    const errorMsg = (error as any)?.response?.data?.message || "Failed to load milestone data.";
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <ErrorBanner message={errorMsg} onRetry={() => refetch()} />
        <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
          <ArrowLeft size={16} className="mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  // Filter unverified criteria
  const unverifiedCriteria = milestone.acceptanceCriteria?.filter(c => c.verifiedAt === null) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!selectedCriterionId) {
      setErrorMsg("Please select an acceptance criterion to dispute.");
      return;
    }

    if (!reason.trim()) {
      setErrorMsg("Dispute reason/context is required.");
      return;
    }

    try {
      await createDisputeMutation.mutateAsync({
        criterion_id: selectedCriterionId,
        additional_context: reason.trim(),
      });

      // Redirect to workspace page on success
      navigate(-1);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Failed to file dispute.");
    }
  };

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
          <h1 className="text-2xl font-bold text-slate-900 font-headline">File a Dispute</h1>
          <p className="text-sm text-slate-500">Initiate platform mediation regarding unverified milestone criteria.</p>
        </div>
      </div>

      {/* Warning Alert */}
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3 text-rose-900">
        <ShieldAlert className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-bold">Escrow Freeze Notice</p>
          <p className="text-rose-800">
            Filing a dispute will freeze this milestone's escrow account immediately. The funds will be held securely until resolved by AI mediation or manual admin review.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Milestone Summary Info */}
            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4 text-sm text-slate-600">
              <div>
                <span className="text-xs uppercase font-bold text-slate-400">Milestone</span>
                <p className="font-semibold text-slate-800">Phase #{milestone.milestoneNumber}</p>
              </div>
              <div>
                <span className="text-xs uppercase font-bold text-slate-400">Escrow Sum</span>
                <p className="font-semibold text-emerald-600">{formatVND(milestone.paymentAmountVnd)}</p>
              </div>
            </div>

            {/* Step 1: Select Criterion */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Select Criterion to Dispute *
              </label>
              
              {unverifiedCriteria.length === 0 ? (
                <p className="text-sm text-slate-500 bg-slate-50 p-4 rounded-lg border border-slate-100 italic">
                  All criteria are already signed off. You cannot file a dispute.
                </p>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-slate-50/20">
                  {unverifiedCriteria.map((c) => (
                    <label
                      key={c.id}
                      className="p-4 flex items-start gap-3 bg-white hover:bg-slate-50/50 cursor-pointer transition-colors"
                    >
                      <input
                        type="radio"
                        name="criterion"
                        value={c.id}
                        checked={selectedCriterionId === c.id}
                        onChange={() => setSelectedCriterionId(c.id)}
                        disabled={createDisputeMutation.isPending}
                        className="mt-1 h-4 w-4 border-slate-300 text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-sm text-slate-700 leading-snug">{c.criterionText}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: Input Reason */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Additional Context / Dispute Reason *
              </label>
              <textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={createDisputeMutation.isPending || unverifiedCriteria.length === 0}
                placeholder="Explain in detail what is incomplete, why the deliverables are failing criteria, or what proof supports your claim..."
                className="w-full text-sm p-4 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none"
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-1.5 text-xs text-error font-medium">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate(-1)}
                disabled={createDisputeMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={createDisputeMutation.isPending || unverifiedCriteria.length === 0}
                className="inline-flex items-center gap-1.5"
              >
                <Scale size={16} />
                {createDisputeMutation.isPending ? "Filing Dispute..." : "Confirm & File Dispute"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
