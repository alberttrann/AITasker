import { useState, useMemo } from 'react';
import { useAdminWithdrawals, useCompleteWithdrawal, useFailWithdrawal } from '@/hooks/use-admin';
import { DataTable, Column } from '@/components/layout/Table';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ConfirmModal } from '@/components/ui/modal';
import { formatVND } from '@/lib/utils';
import { Wallet, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { AdminTableToolbar } from '@/features/admin/layout/AdminTableToolbar';

const ROWS_PER_PAGE = 15;

export default function WithdrawalRequests() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortColumn, setSortColumn] = useState<string>('requestedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading, isError, refetch } = useAdminWithdrawals(statusFilter === 'ALL' ? undefined : statusFilter);
  
  const completeMutation = useCompleteWithdrawal();
  const failMutation = useFailWithdrawal();

  const [confirmTarget, setConfirmTarget] = useState<{ id: string; action: 'complete' | 'fail' } | null>(null);

  // Support both paginated and plain array responses
  const withdrawals: any[] = Array.isArray(data) ? data : data?.data ?? [];

  const filteredAndSortedWithdrawals = useMemo(() => {
    let result = withdrawals.filter((w: any) => {
      if (search) {
        const query = search.toLowerCase();
        const expertId = (w.expertId || '').toLowerCase();
        const bankRef = (w.bankAccountXid || '').toLowerCase();
        const statusStr = (w.status || '').toLowerCase();
        const milestoneId = (w.milestoneId || '').toLowerCase();
        return expertId.includes(query) || bankRef.includes(query) || statusStr.includes(query) || milestoneId.includes(query);
      }
      return true;
    });

    result.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortColumn) {
        case 'requestedAt':
          valA = new Date(a.requestedAt || a.createdAt || 0).getTime();
          valB = new Date(b.requestedAt || b.createdAt || 0).getTime();
          break;
        case 'expertId':
          valA = a.expertId || '';
          valB = b.expertId || '';
          break;
        case 'amount':
          valA = Number(a.amount || 0);
          valB = Number(b.amount || 0);
          break;
        case 'status':
          valA = a.status || '';
          valB = b.status || '';
          break;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [withdrawals, search, sortColumn, sortDirection]);

  // Client-side pagination
  const total = filteredAndSortedWithdrawals.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const paginatedData = filteredAndSortedWithdrawals.slice(
    (page - 1) * ROWS_PER_PAGE,
    page * ROWS_PER_PAGE
  );

  const handleConfirm = () => {
    if (!confirmTarget) return;
    if (confirmTarget.action === 'complete') completeMutation.mutate(confirmTarget.id);
    else failMutation.mutate(confirmTarget.id);
    setConfirmTarget(null);
  };

  const handleSort = (key: string) => {
    if (sortColumn === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(key);
      setSortDirection('asc');
    }
  };

  const columns: Column<any>[] = [
    {
      key: 'requestedAt',
      label: 'Requested',
      sortable: true,
      render: (w) => (
        <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-mono whitespace-nowrap">
          <Clock className="h-3 w-3 shrink-0" />
          {new Date(w.requestedAt || w.createdAt || Date.now()).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'expertId',
      label: 'Expert ID',
      sortable: true,
      render: (w) => (
        <span className="text-xs font-mono text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-200">
          {w.expertId?.slice(0, 13)}...
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      sortable: false,
      render: (w) => (
        w.type === 'MILESTONE_RELEASE' ? (
          <div className="flex flex-col gap-0.5">
            <span className="inline-flex w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
              Auto: Milestone Release
            </span>
            {w.milestoneId && (
              <span className="text-[10px] font-mono text-slate-400">
                Milestone: {String(w.milestoneId).slice(0, 8)}...
              </span>
            )}
          </div>
        ) : (
          <span className="inline-flex w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
            Manual (Chi Hộ)
          </span>
        )
      ),
    },
    {
      key: 'bankAccountXid',
      label: 'Bank Acc Ref (SePay)',
      sortable: false,
      render: (w) => (
        <span className="font-mono text-xs font-bold text-slate-900">
          {w.bankAccountXid || '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      render: (w) => (
        <span className="font-bold text-emerald-600 text-sm">
          {formatVND(Number(w.amount))}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (w) => {
        const colors: Record<string, string> = {
          PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
          COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          FAILED: 'bg-rose-100 text-rose-800 border-rose-200',
          CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
        };
        return (
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${colors[w.status] || colors.PENDING}`}>
            {w.status}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (w) => w.status === 'PENDING' ? (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setConfirmTarget({ id: w.id, action: 'complete'})}
            disabled={completeMutation.isPending || failMutation.isPending}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-lg border border-emerald-200 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 size={14} /> Mark Sent
          </button>
          <button
            onClick={() => setConfirmTarget({ id: w.id, action: 'fail'})}
            disabled={completeMutation.isPending || failMutation.isPending}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-lg border border-rose-200 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
          >
            <XCircle size={14} /> Fail & Refund
          </button>
        </div>
      ) : (
        <div className="text-right text-xs text-slate-400 font-medium">
          Processed {w.confirmedAt ? new Date(w.confirmedAt).toLocaleDateString() : '—'}
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
          message="Failed to load withdrawal requests queue."
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
            <Wallet className="h-8 w-8 text-blue-600" />
            Withdrawal Requests
          </h1>
          <p className="text-slate-500 mt-2">
            Manage expert payouts. Use SePay dashboard to send funds, then mark Complete here.
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
        searchPlaceholder="Search by expert ID, bank ref, status, or milestone..."
        tabs={[
          { label: "All Statuses", value: "ALL" },
          { label: "Pending", value: "PENDING" },
          { label: "Completed", value: "COMPLETED" },
          { label: "Failed", value: "FAILED" },
        ]}
        activeTab={statusFilter}
        onTabChange={(val) => {
          setStatusFilter(val);
          setPage(1);
        }}
        itemCount={filteredAndSortedWithdrawals.length}
        itemLabel="withdrawal request"
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
        keyExtractor={(w: any) => w.id}
        emptyState={
          <EmptyState
            icon={<Wallet className="h-10 w-10 text-slate-400" />}
            title="No withdrawal requests found"
            description={
              search
                ? "No withdrawal requests match your search query."
                : "There are no withdrawal requests matching the selected filter."
            }
          />
        }
      />

      {/* Action Confirmation Modal */}
      <ConfirmModal
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleConfirm}
        title={confirmTarget?.action === 'complete' ? 'Confirm Disbursement' : 'Fail & Refund'}
        confirmText={confirmTarget?.action === 'complete' ? 'Mark Sent' : 'Refund Wallet'}
        isDestructive={confirmTarget?.action === 'fail'}
      >
        {confirmTarget?.action === 'complete'
          ? "Are you sure? This confirms you have manually transferred the funds via the Bank Hub. The withdrawal will be marked as Completed."
          : "Are you sure? This will mark the withdrawal as FAILED and return the requested amount back to the expert's AITasker wallet balance."}
      </ConfirmModal>
    </div>
  );
}