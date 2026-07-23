import { useState, useMemo } from 'react';
import { useAdminTransactions } from '@/hooks/use-admin';
import { DataTable, Column } from '@/components/layout/Table';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { formatVND } from '@/lib/utils';
import { ScrollText, Search } from 'lucide-react';
import { AdminTableToolbar } from '@/features/admin/layout/AdminTableToolbar';

const ROWS_PER_PAGE = 15;

export default function TransactionsLedger() {
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc'|'desc'>('desc');

  const { data, isLoading, isError, refetch } = useAdminTransactions({ type: typeFilter || undefined });
  const transactions: any[] = Array.isArray(data) ? data : data?.data ?? [];

  const filteredAndSorted = useMemo(() => {
    let result = transactions.filter(t => {
      if (search) {
        const query = search.toLowerCase();
        const userEmail = (t.userEmail || '').toLowerCase();
        const userName = (t.userFullName || '').toLowerCase();
        const refId = (t.referenceId || '').toLowerCase();
        return userEmail.includes(query) || userName.includes(query) || refId.includes(query);
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
        case 'user':
          valA = (a.userFullName || a.userEmail || '').toLowerCase();
          valB = (b.userFullName || b.userEmail || '').toLowerCase();
          break;
        case 'transactionType':
          valA = a.transactionType || '';
          valB = b.transactionType || '';
          break;
        case 'amount':
          valA = Number(a.amount || 0);
          valB = Number(b.amount || 0);
          break;
        case 'referenceId':
          valA = a.referenceId || '';
          valB = b.referenceId || '';
          break;
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [transactions, search, sortColumn, sortDirection]);

  const total = filteredAndSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const paginatedData = filteredAndSorted.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (isError) return <div className="p-6"><ErrorBanner message="Failed to load ledger." onRetry={() => refetch()} /></div>;

  const handleSort = (key: string) => {
    if (sortColumn === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(key);
      setSortDirection('asc');
    }
  };

  const columns: Column<any>[] = [
    { key: 'createdAt', label: 'Date', sortable: true, render: (t: any) => <span className="text-xs text-slate-500 font-mono">{new Date(t.createdAt).toLocaleString()}</span> },
    { key: 'user', label: 'User', sortable: true, render: (t: any) => (
      <div>
        <div className="font-semibold text-slate-900 text-sm">{t.userFullName || '—'}</div>
        <div className="text-xs text-slate-500">{t.userEmail}</div>
      </div>
    )},
    { key: 'transactionType', label: 'Type', sortable: true, render: (t: any) => {
      const isPositive = ['TOP_UP', 'ESCROW_RELEASE'].includes(t.transactionType);
      return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${isPositive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{t.transactionType.replace(/_/g, ' ')}</span>;
    }},
    { key: 'amount', label: 'Amount', sortable: true, render: (t: any) => <span className="font-bold font-mono text-slate-900">{formatVND(t.amount)}</span> },
    { key: 'referenceId', label: 'Reference', sortable: true, render: (t: any) => <span className="text-[10px] font-mono bg-slate-50 px-2 py-1 rounded text-slate-500 border border-slate-100">{t.referenceId || 'N/A'}</span> }
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
      </div>

      <AdminTableToolbar 
        searchQuery={search}
        onSearchChange={(val) => { setSearch(val); setPage(1); }}
        searchPlaceholder="Search by user or reference ID..."
        tabs={[
          { label: "All Types", value: "" },
          { label: "Top Up", value: "TOP_UP" },
          { label: "Withdrawal", value: "WITHDRAWAL" },
          { label: "Escrow", value: "ESCROW_LOCK" }, // simplified tab for general escrow view
        ]}
        activeTab={typeFilter}
        onTabChange={(val) => { setTypeFilter(val); setPage(1); }}
        statusOptions={[
          { label: "All", value: "" },
          { label: "Lock", value: "ESCROW_LOCK" },
          { label: "Release", value: "ESCROW_RELEASE" },
          { label: "Refund", value: "ESCROW_REFUND" },
          { label: "Split", value: "ESCROW_SPLIT" },
          { label: "Subscription", value: "SUBSCRIPTION" },
          { label: "Fee", value: "PLATFORM_FEE" },
        ]}
        activeStatus={typeFilter}
        onStatusChange={(val) => { setTypeFilter(val); setPage(1); }}
        statusLabel="Subtype:"
        itemCount={total}
        itemLabel="transaction"
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