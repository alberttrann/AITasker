import { useParams, useNavigate } from "react-router-dom";
import { useDispute as useDisputeDetail } from "@/hooks/use-disputes";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import {
  Shield,
  FileText,
  ArrowLeft,
  AlertTriangle,
  BrainCircuit,
  Wallet,
  User,
  Clock,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatVND } from "@/lib/utils";

function StateBadge({ state }: { state: string }) {
  const configs: Record<string, { bg: string; text: string }> = {
    MANUAL_REVIEW: { bg: "bg-rose-100", text: "text-rose-700" },
    AUTO_RESOLVED: { bg: "bg-emerald-100", text: "text-emerald-700" },
    RESOLVED: { bg: "bg-slate-100", text: "text-slate-700" },
    PENDING: { bg: "bg-amber-100", text: "text-amber-700" },
    LAYER_1_EVAL: { bg: "bg-blue-100", text: "text-blue-700" },
  };
  const config = configs[state] || {
    bg: "bg-slate-100",
    text: "text-slate-600",
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider ${config.bg} ${config.text}`}
    >
      {state.replace(/_/g, " ")}
    </span>
  );
}

export default function DisputeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: dispute, isLoading, isError, refetch } = useDisputeDetail(id);

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
          onClick={() => navigate("/admin/disputes")}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Disputes
        </button>
        <ErrorBanner
          message="Failed to load dispute details."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const criterionText =
    dispute.criterion?.criterion_text || "No criterion text available";
  const deliverableStatement =
    dispute.milestone?.deliverable_statement ||
    "No deliverable statement available";
  const paymentAmount = dispute.milestone?.payment_amount_vnd || 0;
  const escrowAmount = dispute.escrowAccount?.amount || 0;
  const escrowStatus = dispute.escrowAccount?.status || "N/A";
  const llmConfidence =
    dispute.llm_confidence ?? dispute.llmConfidence ?? null;
  const isManualReview = dispute.state === "MANUAL_REVIEW";

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto animate-in fade-in duration-500">
      {/* Back button */}
      <button
        onClick={() => navigate("/admin/disputes")}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Disputes
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileText className="h-8 w-8 text-rose-600" />
            Dispute Detail
          </h1>
          <p className="text-slate-500 mt-2">
            Review the full context of this dispute before making a resolution.
          </p>
        </div>
        <StateBadge state={dispute.state} />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Core info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Criterion */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-rose-600" />
              Acceptance Criterion
            </h2>
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                {criterionText}
              </p>
            </div>
          </div>

          {/* Deliverable */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-blue-600" />
              Deliverable Statement
            </h2>
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                {deliverableStatement}
              </p>
            </div>
            {paymentAmount > 0 && (
              <p className="mt-3 text-sm text-slate-500">
                Milestone payment:{" "}
                <span className="font-semibold text-slate-900">
                  {formatVND(paymentAmount)}
                </span>
              </p>
            )}
          </div>

          {/* LLM Evaluation */}
          {llmConfidence !== null && (
            <div className="bg-gradient-to-br from-slate-900 to-blue-950 border border-blue-900 shadow-sm rounded-xl p-6 text-white">
              <h2 className="text-lg font-semibold text-blue-200 flex items-center gap-2 mb-4">
                <BrainCircuit className="h-5 w-5 text-blue-400" />
                AI Layer-1 Evaluation
              </h2>
              <div className="flex items-end gap-4">
                <span className="text-5xl font-black tracking-tighter">
                  {Math.round(llmConfidence)}%
                </span>
                <span className="text-sm text-blue-200 pb-2 mb-1">
                  confidence score
                </span>
              </div>
              <p className="mt-3 text-blue-200 text-sm">
                The AI evaluated this dispute's alignment with the criterion and
                the defined deliverable. This score informed whether automatic
                resolution was possible or manual review was required.
              </p>
            </div>
          )}
        </div>

        {/* Right: Sidebar info */}
        <div className="space-y-6">
          {/* Escrow */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Escrow Account
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-400">Amount</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatVND(escrowAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Status</p>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700">
                  {escrowStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Details
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-slate-400" />
                <span className="text-slate-500">Filed by:</span>
                <span className="font-mono text-slate-700 text-xs truncate">
                  {dispute.filed_by || dispute.filedBy || "Unknown"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="text-slate-500">Filed at:</span>
                <span className="text-slate-700">
                  {new Date(
                    dispute.filed_at || dispute.filedAt
                  ).toLocaleDateString()}
                </span>
              </div>
              {dispute.resolved_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-500">Resolved at:</span>
                  <span className="text-slate-700">
                    {new Date(dispute.resolved_at).toLocaleDateString()}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Tag className="h-4 w-4 text-slate-400" />
                <span className="text-slate-500">ID:</span>
                <span className="font-mono text-slate-700 text-xs truncate">
                  {dispute.id}
                </span>
              </div>
            </div>
          </div>

          {/* Resolve button */}
          {isManualReview && (
            <Button
              variant="primary"
              size="lg"
              className="w-full bg-rose-600 hover:bg-rose-700"
              onClick={() => navigate(`/admin/disputes/${id}/resolve`)}
            >
              <AlertTriangle className="h-5 w-5 mr-2" />
              Resolve This Dispute
            </Button>
          )}

          {dispute.state === "RESOLVED" && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
              <p className="text-emerald-700 font-semibold text-sm">
                ✓ This dispute has been resolved
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
