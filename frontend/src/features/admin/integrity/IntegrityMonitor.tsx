import { useState } from 'react';
import { useAdminDecisions } from '@/hooks/use-admin';
import { DataTable } from '@/components/layout/Table';
import { Spinner } from '@/components/ui/Spinner';
import { ShieldCheck } from 'lucide-react';

export default function IntegrityMonitor() {
  const [typeFilter, setTypeFilter] = useState<string>('');
  const { data: decisions, isLoading } = useAdminDecisions({ decisionType: typeFilter || undefined });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const columns = [
    { key: 'createdAt', label: 'Timestamp', render: (d: any) => <span className="text-xs text-slate-500 font-mono">{new Date(d.createdAt).toLocaleString()}</span> },
    { key: 'decisionType', label: 'Action Area', render: (d: any) => <span className="font-bold text-slate-800 text-xs">{d.decisionType.replace(/_/g, ' ')}</span> },
    { key: 'entityId', label: 'Entity Target', render: (d: any) => <span className="text-[10px] font-mono bg-slate-50 px-2 py-1 rounded text-slate-500 border border-slate-200">{d.entityType}: {d.entityId?.slice(0,8)}</span> },
    { key: 'llmConfidence', label: 'AI Score', render: (d: any) => d.llmConfidence ? <span className={`font-bold ${d.llmConfidence >= 0.8 ? 'text-emerald-600' : 'text-amber-600'}`}>{Math.round(d.llmConfidence * 100)}%</span> : <span className="text-slate-400">—</span> },
    { key: 'decision', label: 'Decision', render: (d: any) => {
      const isPositive = ['PUBLISHED', 'UPGRADED', 'EXPERT_WINS'].includes(d.decision);
      return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{d.decision}</span>;
    }},
    { key: 'advisoryNote', label: 'Note', render: (d: any) => <div className="text-xs text-slate-600 max-w-sm truncate" title={d.advisoryNote}>{d.advisoryNote || '—'}</div> }
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
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none shadow-sm">
          <option value="">All Decision Types</option>
          <option value="ELICITATION_SYNTHESIS">Project Synthesis</option>
          <option value="SPEC_AUTO_RETURN">Spec Auto-Return</option>
          <option value="SEAM_TIER_UPGRADE">Portfolio Upgrades</option>
          <option value="PORTFOLIO_EVAL">Portfolio Evals</option>
          <option value="DISPUTE_L1_EVAL">Dispute Arbitrations</option>
          <option value="CRITERION_QUALITY_GATE">Criterion Checks</option>
        </select>
      </div>

      <DataTable 
        columns={columns} 
        data={decisions || []} 
        keyExtractor={(d: any) => d.id}
        emptyState={<div className="text-center p-12 bg-white rounded-xl border border-slate-200 text-slate-500">No decisions logged yet.</div>}
      />
    </div>
  );
}