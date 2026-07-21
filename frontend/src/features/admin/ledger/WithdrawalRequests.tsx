import { useState } from 'react';
import { useAdminWithdrawals, useCompleteWithdrawal, useFailWithdrawal } from '@/hooks/use-admin';
import { DataTable } from '@/components/layout/Table';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmModal } from '@/components/ui/modal';
import { formatVND } from '@/lib/utils';
import { Wallet, CheckCircle2, XCircle } from 'lucide-react';

export default function WithdrawalRequests() {
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const { data: withdrawals, isLoading, refetch } = useAdminWithdrawals(statusFilter === 'ALL' ? undefined : statusFilter);
  
  const completeMutation = useCompleteWithdrawal();
  const failMutation = useFailWithdrawal();

  const [confirmTarget, setConfirmTarget] = useState<{ id: string; action: 'complete' | 'fail' } | null>(null);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const handleConfirm = () => {
    if (!confirmTarget) return;
    if (confirmTarget.action === 'complete') completeMutation.mutate(confirmTarget.id);
    else failMutation.mutate(confirmTarget.id);
    setConfirmTarget(null);
  };

  const columns = [
    { key: 'requestedAt', label: 'Requested', render: (w: any) => <span className="text-xs text-slate-500 font-mono">{new Date(w.requestedAt).toLocaleString()}</span> },
    { key: 'expertId', label: 'Expert ID', render: (w: any) => <span className="text-xs font-mono text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-200">{w.expertId.slice(0, 13)}...</span> },
    { key: 'bankAccountXid', label: 'Bank Acc Ref (SePay)', render: (w: any) => <span className="font-bold text-slate-900">{w.bankAccountXid}</span> },
    { key: 'amount', label: 'Amount', render: (w: any) => <span className="font-bold text-emerald-600">{formatVND(Number(w.amount))}</span> },
    { key: 'status', label: 'Status', render: (w: any) => {
      const colors = { PENDING: 'bg-amber-100 text-amber-800', COMPLETED: 'bg-emerald-100 text-emerald-800', FAILED: 'bg-rose-100 text-rose-800', CANCELLED: 'bg-slate-100 text-slate-600' } as any;
      return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${colors[w.status] || colors.PENDING}`}>{w.status}</span>;
    }},
    { key: 'actions', label: '', render: (w: any) => w.status === 'PENDING' ? (
      <div className="flex justify-end gap-2">
        <button onClick={() => setConfirmTarget({ id: w.id, action: 'complete'})} disabled={completeMutation.isPending || failMutation.isPending} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-lg border border-emerald-200 flex items-center gap-1 transition-colors"><CheckCircle2 size={14} /> Mark Sent</button>
        <button onClick={() => setConfirmTarget({ id: w.id, action: 'fail'})} disabled={completeMutation.isPending || failMutation.isPending} className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-lg border border-rose-200 flex items-center gap-1 transition-colors"><XCircle size={14} /> Fail & Refund</button>
      </div>
    ) : <div className="text-right text-xs text-slate-400">Processed {w.confirmedAt ? new Date(w.confirmedAt).toLocaleDateString() : ''}</div> }
  ];

  return (
    <div className="max-w-[1440px] mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Wallet className="h-8 w-8 text-blue-600" />
            Withdrawal Requests
          </h1>
          <p className="text-slate-500 mt-2">Manage expert payouts. Use SePay dashboard to send funds, then mark Complete here.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          {['PENDING', 'COMPLETED', 'FAILED', 'ALL'].map(st => (
            <button key={st} onClick={() => setStatusFilter(st)} className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${statusFilter === st ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{st}</button>
          ))}
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={withdrawals || []} 
        keyExtractor={(w: any) => w.id}
        emptyState={<div className="text-center p-12 bg-white rounded-xl border border-slate-200 text-slate-500">No withdrawal requests found for this status.</div>}
      />

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