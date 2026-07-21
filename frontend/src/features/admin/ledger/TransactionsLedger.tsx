import { useState } from 'react';
import { useAdminTransactions } from '@/hooks/use-admin';
import { DataTable } from '@/components/layout/Table';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { formatVND } from '@/lib/utils';
import { ScrollText, Search } from 'lucide-react';

export default function TransactionsLedger() {
  const [typeFilter, setTypeFilter] = useState<string>('');
  const { data: transactions, isLoading, isError, refetch } = useAdminTransactions({ type: typeFilter || undefined });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (isError) return <div className="p-6"><ErrorBanner message="Failed to load ledger." onRetry={() => refetch()} /></div>;

  const columns = [
    { key: 'createdAt', label: 'Date', render: (t: any) => <span className="text-xs text-slate-500 font-mono">{new Date(t.createdAt).toLocaleString()}</span> },
    { key: 'user', label: 'User', render: (t: any) => (
      <div>
        <div className="font-semibold text-slate-900 text-sm">{t.userFullName || '—'}</div>
        <div className="text-xs text-slate-500">{t.userEmail}</div>
      </div>
    )},
    { key: 'transactionType', label: 'Type', render: (t: any) => {
      const isPositive = ['TOP_UP', 'ESCROW_RELEASE'].includes(t.transactionType);
      return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${isPositive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{t.transactionType.replace(/_/g, ' ')}</span>;
    }},
    { key: 'amount', label: 'Amount', render: (t: any) => <span className="font-bold font-mono text-slate-900">{formatVND(t.amount)}</span> },
    { key: 'referenceId', label: 'Reference', render: (t: any) => <span className="text-[10px] font-mono bg-slate-50 px-2 py-1 rounded text-slate-500 border border-slate-100">{t.referenceId || 'N/A'}</span> }
  ];

  return (
    <div className="max-w-[1440px] mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ScrollText className="h-8 w-8 text-emerald-600" />
            Transactions Ledger
          </h1>
          <p className="text-slate-500 mt-2">Immutable double-entry log of all platform money movements.</p>
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none shadow-sm">
          <option value="">All Transaction Types</option>
          <option value="TOP_UP">Top Up</option>
          <option value="ESCROW_LOCK">Escrow Lock</option>
          <option value="ESCROW_RELEASE">Escrow Release</option>
          <option value="WITHDRAWAL">Withdrawal</option>
          <option value="SUBSCRIPTION">Subscription</option>
          <option value="PLATFORM_FEE">Platform Fee</option>
          <option value="ESCROW_REFUND">Escrow Refund</option>
          <option value="ESCROW_SPLIT">Escrow Split</option>
        </select>
      </div>

      <DataTable 
        columns={columns} 
        data={transactions || []} 
        keyExtractor={(t: any) => t.id}
        emptyState={
          <div className="text-center p-12 bg-white rounded-xl border border-slate-200 shadow-sm text-slate-500">
            <Search className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p>No transactions found.</p>
          </div>
        }
      />
    </div>
  );
}