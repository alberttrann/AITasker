import { useState, useMemo } from 'react';
import { useAdminDecisions } from '@/hooks/use-admin';
import { DataTable, Column } from '@/components/layout/Table';
import { Spinner } from '@/components/ui/Spinner';
import { ShieldCheck } from 'lucide-react';
import { AdminTableToolbar } from '@/features/admin/layout/AdminTableToolbar';

const ROWS_PER_PAGE = 15;

export default function IntegrityMonitor() {
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc'|'desc'>('desc');

  const { data, isLoading } = useAdminDecisions({ decisionType: typeFilter || undefined });
  
  // Handle paginated responses if the hook changes, or plain array
  const decisions: any[] = Array.isArray(data) ? data : data?.data ?? [];

  const filteredAndSorted = useMemo(() => {
    let result = decisions.filter(d => {
      if (search) {
        const query = search.toLowerCase();
        const entityId = (d.entityId || '').toLowerCase();
        const decisionType = (d.decisionType || '').toLowerCase();
        const advisoryNote = (d.advisoryNote || '').toLowerCase();
        return entityId.includes(query) || decisionType.includes(query) || advisoryNote.includes(query);
      }
      return true;
    });

    result.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';
      switch (sortColumn) {
        case 'createdAt':
          valA = new Date(a.createdAt || 0).getTime();
          valB = new Date(b.createdAt || 0).getTime();
          break;
        case 'decisionType':
          valA = a.decisionType || '';
          valB = b.decisionType || '';
          break;
        case 'entityId':
          valA = a.entityId || '';
          valB = b.entityId || '';
          break;
        case 'llmConfidence':
          valA = a.llmConfidence || 0;
          valB = b.llmConfidence || 0;
          break;
        case 'decision':
          valA = a.decision || '';
          valB = b.decision || '';
          break;
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [decisions, search, sortColumn, sortDirection]);

  // Client-side pagination if needed
  const total = filteredAndSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const paginatedData = filteredAndSorted.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const handleSort = (key: string) => {
    if (sortColumn === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(key);
      setSortDirection('asc');
    }
  };

  const columns: Column<any>[] = [
    { key: 'createdAt', label: 'Timestamp', sortable: true, render: (d: any) => <span className="text-xs text-slate-500 font-mono">{new Date(d.createdAt).toLocaleString()}</span> },
    { key: 'decisionType', label: 'Action Area', sortable: true, render: (d: any) => <span className="font-bold text-slate-800 text-xs">{d.decisionType.replace(/_/g, ' ')}</span> },
    { key: 'entityId', label: 'Entity Target', sortable: true, render: (d: any) => <span className="text-[10px] font-mono bg-slate-50 px-2 py-1 rounded text-slate-500 border border-slate-200">{d.entityType}: {d.entityId?.slice(0,8)}</span> },
    { key: 'llmConfidence', label: 'AI Score', sortable: true, render: (d: any) => d.llmConfidence ? <span className={`font-bold ${d.llmConfidence >= 0.8 ? 'text-emerald-600' : 'text-amber-600'}`}>{Math.round(d.llmConfidence * 100)}%</span> : <span className="text-slate-400">—</span> },
    { key: 'decision', label: 'Decision', sortable: true, render: (d: any) => {
      const isPositive = ['PUBLISHED', 'UPGRADED', 'EXPERT_WINS'].includes(d.decision);
      return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{d.decision}</span>;
    }},
    { key: 'advisoryNote', label: 'Note', sortable: false, render: (d: any) => <div className="text-xs text-slate-600 max-w-sm truncate" title={d.advisoryNote}>{d.advisoryNote || '—'}</div> }
  ];

  return (
    <div className="max-w-[1440px] mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-indigo-600" />
            Integrity & Decisions Log
          </h1>
          <p className="text-slate-500 mt-2">Audit trail of all AI evaluations and automated system decisions.</p>
        </div>
      </div>

      <AdminTableToolbar 
        searchQuery={search}
        onSearchChange={(val) => { setSearch(val); setPage(1); }}
        searchPlaceholder="Search by entity ID or note..."
        tabs={[
          { label: "All Decisions", value: "" },
          { label: "Project Synthesis", value: "ELICITATION_SYNTHESIS" },
          { label: "Spec Auto-Return", value: "SPEC_AUTO_RETURN" },
          { label: "Portfolio Upgrades", value: "SEAM_TIER_UPGRADE" },
          { label: "Portfolio Evals", value: "PORTFOLIO_EVAL" },
          { label: "Dispute Arbitrations", value: "DISPUTE_L1_EVAL" },
          { label: "Criterion Checks", value: "CRITERION_QUALITY_GATE" },
        ]}
        activeTab={typeFilter}
        onTabChange={(val) => { setTypeFilter(val); setPage(1); }}
        itemCount={total}
        itemLabel="log"
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <DataTable 
        columns={columns} 
        data={paginatedData} 
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        keyExtractor={(d: any) => d.id}
        emptyState={<div className="text-center p-12 bg-white rounded-xl border border-slate-200 text-slate-500">No decisions logged yet.</div>}
      />
    </div>
  );
}