import { useParams, useNavigate } from "react-router-dom";
import { useResolveDispute } from "@/hooks/use-admin";
import { useDispute as useDisputeDetail } from "@/hooks/use-disputes";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import {
  Shield,
  ArrowLeft,
  AlertTriangle,
  Wallet,
  CheckCircle2,
  Undo2,
  SplitSquareVertical,
  Loader2,
} from "lucide-react";
import { formatVND } from "@/lib/utils";

export default function ResolutionConfirm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: dispute, isLoading, isError } = useDisputeDetail(id);
  const resolveDispute = useResolveDispute();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !dispute) {
    return (
      <div className="space-y-6 max-w-[1440px] mx-auto animate-in fade-in duration-500">
        <button
          onClick={() => navigate(`/admin/disputes/${id}`)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dispute
        </button>
        <ErrorBanner
          message="Failed to load dispute details."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  if (dispute.state !== "MANUAL_REVIEW") {
    return (
      <div className="space-y-6 max-w-[1440px] mx-auto animate-in fade-in duration-500">
        <button
          onClick={() => navigate(`/admin/disputes/${id}`)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dispute
        </button>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-amber-800">
            Dispute Not in Manual Review
          </h2>
          <p className="text-amber-600 mt-2 max-w-md mx-auto">
            This dispute is already in{" "}
            <strong>{dispute.state.replace(/_/g, " ")}</strong> state and
            cannot be resolved from this screen.
          </p>
          <button
            onClick={() => navigate(`/admin/disputes/${id}`)}
            className="mt-4 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg font-medium transition-colors"
          >
            Go Back to Dispute Detail
          </button>
        </div>
      </div>
    );
  }

  const criterionText =
    dispute.criterion?.criterion_text || "No criterion text available";
  const escrowAmount = dispute.escrowAccount?.amount || 0;
  const paymentAmount = dispute.milestone?.payment_amount_vnd || 0;
  const displayAmount = escrowAmount || paymentAmount;

  const handleResolve = (decision: "release" | "refund" | "split") => {
    resolveDispute.mutate(
      { id: id!, decision },
      {
        onSuccess: () => {
          navigate("/admin/disputes");
        },
      }
    );
  };

  const isPending = resolveDispute.isPending;

  return (
    <div className="space-y-6 max-w-[640px] mx-auto animate-in fade-in duration-500">
      {/* Back button */}
      <button
        onClick={() => navigate(`/admin/disputes/${id}`)}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dispute
      </button>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Shield className="h-8 w-8 text-rose-600" />
          Resolve Dispute
        </h1>
        <p className="text-slate-500 mt-2">
          Choose a resolution for this escalated dispute. This action is
          irreversible.
        </p>
      </div>

      {/* Dispute Summary */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
          Dispute Summary
        </h2>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-slate-400 mb-1">Criterion</p>
            <p className="text-slate-700 text-sm leading-relaxed line-clamp-3">
              {criterionText}
            </p>
          </div>
          <div className="flex gap-8">
            <div>
              <p className="text-xs text-slate-400">Escrow Amount</p>
              <p className="text-lg font-bold text-slate-900">
                {formatVND(displayAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">AI Confidence</p>
              <p className="text-lg font-bold text-slate-900">
                {dispute.llm_confidence != null
                  ? `${Math.round(dispute.llm_confidence)}%`
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Resolution options */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
          Choose Resolution
        </p>

        {/* Release */}
        <button
          onClick={() => handleResolve("release")}
          disabled={isPending}
          className="w-full text-left p-5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-emerald-900 text-lg group-hover:text-emerald-700">
                Release Funds to Expert
              </div>
              <div className="text-emerald-700 text-sm mt-1">
                The expert met the Definition of Done. Full escrow amount{" "}
                {formatVND(displayAmount)} is paid out to the expert.
              </div>
            </div>
          </div>
        </button>

        {/* Refund */}
        <button
          onClick={() => handleResolve("refund")}
          disabled={isPending}
          className="w-full text-left p-5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 hover:border-rose-300 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-100 rounded-lg group-hover:bg-rose-200 transition-colors">
              <Undo2 className="h-5 w-5 text-rose-700" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-rose-900 text-lg group-hover:text-rose-700">
                Refund Client
              </div>
              <div className="text-rose-700 text-sm mt-1">
                The expert failed to deliver. Full escrow amount{" "}
                {formatVND(displayAmount)} is returned to the CEO.
              </div>
            </div>
          </div>
        </button>

        {/* Split */}
        <button
          onClick={() => handleResolve("split")}
          disabled={isPending}
          className="w-full text-left p-5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
              <SplitSquareVertical className="h-5 w-5 text-blue-700" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-blue-900 text-lg group-hover:text-blue-700">
                50/50 Split
              </div>
              <div className="text-blue-700 text-sm mt-1">
                Partial delivery or mutual fault. Escrow is split evenly —{" "}
                {formatVND(Math.round(displayAmount / 2))} to each party.
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Pending state */}
      {isPending && (
        <div className="flex items-center justify-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Processing resolution...
        </div>
      )}

      {/* Error state */}
      {resolveDispute.isError && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          Failed to resolve dispute. Please try again.
        </div>
      )}

      {/* Cancel */}
      <button
        onClick={() => navigate(`/admin/disputes/${id}`)}
        disabled={isPending}
        className="w-full py-3 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors disabled:opacity-50"
      >
        Cancel and go back
      </button>
    </div>
  );
}
