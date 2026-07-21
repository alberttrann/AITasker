import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAdminDisputes,
  useResolveDispute,
  type AdminDisputeDecision,
} from "@/hooks/use-admin";
import { Spinner } from "@/components/ui/Spinner";
import { Shield, ShieldAlert, Scale, FileText, ChevronRight } from "lucide-react";
import { ConfirmModal } from "@/components/ui/modal";
import { formatConfidencePercent } from "@/lib/utils";

export default function DisputeMonitor() {
  const navigate = useNavigate();
  const [filterState, setFilterState] = useState<string>("MANUAL_REVIEW");
  const { data: disputes, isLoading, isError } = useAdminDisputes(filterState === "ALL" ? undefined : filterState);

  // States for Resolution Modal
  const [selectedDispute, setSelectedDispute] = useState<string | null>(null);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const resolveDispute = useResolveDispute();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3">
          <ShieldAlert className="h-5 w-5" />
          Failed to load disputes queue.
        </div>
      </div>
    );
  }

  const handleResolveAction = (decision: AdminDisputeDecision) => {
    if (!selectedDispute) return;
    resolveDispute.mutate(
      { id: selectedDispute, decision },
      {
        onSuccess: () => {
          setIsResolveModalOpen(false);
          setSelectedDispute(null);
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Shield className="h-8 w-8 text-rose-600" />
            Dispute Monitor
          </h1>
          <p className="text-slate-500 mt-2">
            Review and resolve escalated engagements requiring manual intervention.
          </p>
        </div>

        {/* Filter Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          {["MANUAL_REVIEW", "AUTO_RESOLVED", "RESOLVED", "ALL"].map((state) => (
            <button
              key={state}
              onClick={() => setFilterState(state)}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                filterState === state
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {state.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Disputes List */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        {(!disputes || disputes.length === 0) ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="bg-slate-50 p-4 rounded-full mb-4">
              <Scale className="h-12 w-12 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Clear Queue</h3>
            <p className="text-slate-500 mt-1 max-w-md">
              There are no disputes matching the current filter. The AI might be doing a great job automatically resolving them!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {disputes.map((dispute: any) => (
              <div key={dispute.id} className="p-6 hover:bg-slate-50 transition-colors flex flex-col lg:flex-row gap-6 lg:items-center justify-between group">
                
                {/* Dispute Info */}
                <div className="flex gap-4 items-start flex-1">
                  <div className={`p-3 rounded-xl border ${
                    dispute.state === 'MANUAL_REVIEW' 
                      ? 'bg-rose-50 border-rose-100 text-rose-600'
                      : 'bg-slate-50 border-slate-100 text-slate-500'
                  }`}>
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-slate-900 text-lg">
                        Dispute {dispute.id.split('-')[0].toUpperCase()}
                      </h3>
                      <StateBadge state={dispute.state} />
                    </div>
                    <p className="text-sm text-slate-500">
                      Filed on {new Date(dispute.filedAt || dispute.filed_at).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-4 mt-2 pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded">
                        E: {dispute.engagementId || dispute.engagement_id}
                      </span>
                      {(dispute.llmConfidence ?? dispute.llm_confidence) != null && (
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 flex items-center gap-1">
                          <BrainCircuitIcon /> AI Confidence: {formatConfidencePercent(dispute.llmConfidence ?? dispute.llm_confidence)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 shrink-0">
                  {dispute.state === 'MANUAL_REVIEW' && (
                    <button 
                      id={`btn-open-resolve-dispute-${dispute.id}`}
                      type="button"
                      onClick={() => {
                        setSelectedDispute(dispute.id);
                        setIsResolveModalOpen(true);
                      }}
                      className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors shadow-sm focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 cursor-pointer"
                    >
                      Resolve Now
                    </button>
                  )}
                  <button
                    id={`btn-view-dispute-${dispute.id}`}
                    type="button"
                    aria-label={`View dispute ${dispute.id}`}
                    onClick={() => navigate(`/admin/disputes/${dispute.id}`)}
                    className="p-2.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors border border-transparent hover:border-primary/20 cursor-pointer"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolution Modal */}
      <ConfirmModal
        isOpen={isResolveModalOpen}
        onClose={() => setIsResolveModalOpen(false)}
        onConfirm={() => {}} // We handle actions via custom buttons below
        title="Resolve Escalated Dispute"
        confirmText="Cancel"
        cancelText="Close"
      >
        <div className="space-y-4">
          <p className="text-slate-600 mb-6">
            You are manually resolving this dispute. Please review the AI's advisory notes and evidence carefully before making a final ledger decision. This action is irreversible.
          </p>

          <div className="grid grid-cols-1 gap-3">
            <button 
              id="btn-resolve-dispute-expert-wins"
              type="button"
              onClick={() => handleResolveAction("EXPERT_WINS")}
              disabled={resolveDispute.isPending}
              className="w-full text-left p-4 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 transition-colors group cursor-pointer disabled:cursor-not-allowed"
            >
              <div className="font-bold text-emerald-900 text-lg group-hover:text-emerald-700">Release Funds to Expert</div>
              <div className="text-emerald-700 text-sm mt-1">The expert met the Definition of Done. Escrow is paid out.</div>
            </button>

            <button 
              id="btn-resolve-dispute-client-wins"
              type="button"
              onClick={() => handleResolveAction("CLIENT_WINS")}
              disabled={resolveDispute.isPending}
              className="w-full text-left p-4 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 hover:border-rose-300 transition-colors group cursor-pointer disabled:cursor-not-allowed"
            >
              <div className="font-bold text-rose-900 text-lg group-hover:text-rose-700">Refund Client</div>
              <div className="text-rose-700 text-sm mt-1">The expert failed to deliver. Escrow is returned to the CEO.</div>
            </button>

            <button 
              id="btn-resolve-dispute-split"
              type="button"
              onClick={() => handleResolveAction("SPLIT")}
              disabled={resolveDispute.isPending}
              className="w-full text-left p-4 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 transition-colors group cursor-pointer disabled:cursor-not-allowed"
            >
              <div className="font-bold text-blue-900 text-lg group-hover:text-blue-700">50/50 Split</div>
              <div className="text-blue-700 text-sm mt-1">Partial delivery or mutual fault. Escrow is split evenly.</div>
            </button>
          </div>
        </div>
      </ConfirmModal>

    </div>
  );
}

// ── Helpers ──
function StateBadge({ state }: { state: string }) {
  const configs: Record<string, { bg: string; text: string }> = {
    MANUAL_REVIEW: { bg: "bg-rose-100", text: "text-rose-700" },
    AUTO_RESOLVED: { bg: "bg-emerald-100", text: "text-emerald-700" },
    RESOLVED: { bg: "bg-slate-100", text: "text-slate-700" },
  };

  const config = configs[state] || { bg: "bg-slate-100", text: "text-slate-600" };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider ${config.bg} ${config.text}`}>
      {state.replace("_", " ")}
    </span>
  );
}

function BrainCircuitIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
      <path d="M9 13a4.5 4.5 0 0 0 3-4"/>
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
      <path d="M6 18a4 4 0 0 1-1.967-.516"/>
      <path d="M10.846 9.58a4.5 4.5 0 0 0-1.57-2.531"/>
      <path d="M16 11.5c1.2 0 2.8-1.2 3-3"/>
      <path d="M18.5 4.2C17 4.2 16 5 16 6.5"/>
      <path d="M21 8c0 1.2-1 2.5-3 3"/>
      <path d="M16 19.5c1.2 0 2.8-1.2 3-3"/>
      <path d="M18.5 12.2c-1.5 0-2.5.8-2.5 2.3"/>
      <path d="M21 16c0 1.2-1 2.5-3 3"/>
    </svg>
  );
}
