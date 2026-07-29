import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAdminDisputes,
  useResolveDispute,
} from "@/hooks/use-admin";
import type { AdminDisputeDecision } from "@/types/enums";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ConfirmModal } from "@/components/ui/modal";
import { Shield, ShieldAlert, Scale, ChevronRight, BrainCircuit, Clock } from "lucide-react";
import { formatConfidencePercent } from "@/lib/utils";
import { AdminTableToolbar } from "@/features/admin/layout/AdminTableToolbar";
import { DataTable, Column } from "@/components/layout/Table";

const ROWS_PER_PAGE = 15;

export default function DisputeMonitor() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState<string>("ALL");
  const [sortColumn, setSortColumn] = useState<string>("filedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // States for Resolution Modal
  const [selectedDispute, setSelectedDispute] = useState<string | null>(null);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const resolveDispute = useResolveDispute();

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useAdminDisputes(filterState === "ALL" ? undefined : filterState);

  // Handle paginated responses if the hook changes, or plain array
  const disputes: any[] = Array.isArray(data) ? data : data?.data ?? [];

  const filteredAndSortedDisputes = useMemo(() => {
    let result = disputes.filter((d: any) => {
      if (search) {
        const query = search.toLowerCase();
        const idStr = (d.id || "").toLowerCase();
        const engId = (d.engagementId || d.engagement_id || "").toLowerCase();
        const stateStr = (d.state || "").toLowerCase();
        return idStr.includes(query) || engId.includes(query) || stateStr.includes(query);
      }
      return true;
    });

    result.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      switch (sortColumn) {
        case "filedAt":
          valA = new Date(a.filedAt || a.filed_at || 0).getTime();
          valB = new Date(b.filedAt || b.filed_at || 0).getTime();
          break;
        case "id":
          valA = a.id || "";
          valB = b.id || "";
          break;
        case "state":
          valA = a.state || "";
          valB = b.state || "";
          break;
        case "confidence":
          valA = a.llmConfidence ?? a.llm_confidence ?? 0;
          valB = b.llmConfidence ?? b.llm_confidence ?? 0;
          break;
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [disputes, search, sortColumn, sortDirection]);

  // Client-side pagination
  const total = filteredAndSortedDisputes.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const paginatedData = filteredAndSortedDisputes.slice(
    (page - 1) * ROWS_PER_PAGE,
    page * ROWS_PER_PAGE
  );

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

  const handleSort = (key: string) => {
    if (sortColumn === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(key);
      setSortDirection("asc");
    }
  };

  const columns: Column<any>[] = [
    {
      key: "id",
      label: "Dispute Ref",
      sortable: true,
      render: (d) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-headline font-bold text-sm text-slate-900">
            Dispute {d.id?.split("-")[0]?.toUpperCase() || d.id?.slice(0, 8)}
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            ID: {d.id?.slice(0, 12)}...
          </span>
        </div>
      ),
    },
    {
      key: "engagementId",
      label: "Engagement",
      sortable: false,
      render: (d) => (
        <span className="text-xs text-slate-600 font-mono bg-slate-100 px-2 py-1 rounded border border-slate-200/60 inline-block truncate max-w-[180px]">
          {d.engagementId || d.engagement_id || "—"}
        </span>
      ),
    },
    {
      key: "state",
      label: "State",
      sortable: true,
      render: (d) => <StateBadge state={d.state} />,
    },
    {
      key: "confidence",
      label: "AI Confidence",
      sortable: true,
      render: (d) => {
        const conf = d.llmConfidence ?? d.llm_confidence;
        return conf != null ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
            <BrainCircuitIcon />
            {formatConfidencePercent(conf)}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        );
      },
    },
    {
      key: "filedAt",
      label: "Filed At",
      sortable: true,
      render: (d) => {
        const date = d.filedAt || d.filed_at;
        return (
          <span className="inline-flex items-center gap-1 text-slate-500 text-xs whitespace-nowrap">
            <Clock className="h-3 w-3" />
            {date ? new Date(date).toLocaleDateString() : "—"}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (d) => (
        <div className="flex items-center justify-end gap-2">
          {d.state === "MANUAL_REVIEW" && (
            <button
              id={`btn-open-resolve-dispute-${d.id}`}
              type="button"
              onClick={() => {
                setSelectedDispute(d.id);
                setIsResolveModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors shadow-2xs focus:ring-2 focus:ring-rose-500 cursor-pointer"
            >
              Resolve Now
            </button>
          )}
          <button
            id={`btn-view-dispute-${d.id}`}
            type="button"
            aria-label={`View dispute ${d.id}`}
            onClick={() => navigate(`/admin/disputes/${d.id}`)}
            className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors border border-transparent hover:border-primary/20 cursor-pointer"
            title="View Details"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full max-w-[1440px] mx-auto space-y-6 animate-in fade-in duration-500">
        <ErrorBanner
          message="Failed to load disputes queue."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto space-y-6 animate-in fade-in duration-500">
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
      </div>

      {/* Reusable Toolbar */}
      <AdminTableToolbar
        searchQuery={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="Search by dispute ID, engagement ID, or status..."
        tabs={[
          { label: "All Statuses", value: "ALL" },
          { label: "Manual Review", value: "MANUAL_REVIEW" },
          { label: "Auto Resolved", value: "AUTO_RESOLVED" },
          { label: "Resolved", value: "RESOLVED" },
        ]}
        activeTab={filterState}
        onTabChange={(val) => {
          setFilterState(val);
          setPage(1);
        }}
        itemCount={filteredAndSortedDisputes.length}
        itemLabel="dispute"
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      {/* Reusable Table */}
      <DataTable
        columns={columns}
        data={paginatedData}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        keyExtractor={(item) => item.id}
        emptyState={
          <EmptyState
            icon={<Scale className="h-10 w-10 text-slate-400" />}
            title="Clear Queue"
            description={
              search
                ? "No disputes match your search query."
                : "There are no disputes matching the selected filter."
            }
          />
        }
      />

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
    MANUAL_REVIEW: { bg: "bg-rose-100 border-rose-200", text: "text-rose-700" },
    AUTO_RESOLVED: { bg: "bg-emerald-100 border-emerald-200", text: "text-emerald-700" },
    RESOLVED: { bg: "bg-slate-100 border-slate-200", text: "text-slate-700" },
  };

  const config = configs[state] || { bg: "bg-slate-100 border-slate-200", text: "text-slate-600" };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider border ${config.bg} ${config.text}`}>
      {state.replace(/_/g, " ")}
    </span>
  );
}

function BrainCircuitIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
