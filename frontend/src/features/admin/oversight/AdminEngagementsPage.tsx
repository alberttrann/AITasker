import { useState } from 'react';
import { useAdminEngagements } from '@/hooks/use-admin';
import { useEngagement } from '@/hooks/use-engagements';
import { DataTable } from '@/components/layout/Table';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/modal';
import { Handshake } from 'lucide-react';

export default function AdminEngagementsPage() {
  const [filterState, setFilterState] = useState('');
  const { data: engagements, isLoading } = useAdminEngagements({ state: filterState || undefined });

  // Detail Modal State
  const [detailEngagementId, setDetailEngagementId] = useState<string | null>(null);
  const { data: engagementDetail, isLoading: isLoadingDetail } = useEngagement(detailEngagementId || undefined);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const columns = [
    { key: 'id', label: 'ID', render: (e: any) => <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-200">{e.id.slice(0,8)}</span> },
    { key: 'type', label: 'Type', render: (e: any) => <span className="text-xs font-bold text-slate-700">{e.type.replace('_', ' ')}</span> },
    { key: 'state', label: 'State', render: (e: any) => <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${e.state === 'ACTIVE' || e.state === 'CONNECTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{e.state}</span> },
    { key: 'parties', label: 'Parties', render: (e: any) => (
      <div className="text-xs">
        <div className="text-blue-700"><span className="font-semibold">C:</span> {e.client?.email || e.clientId.slice(0,8)}</div>
        <div className="text-emerald-700 mt-0.5"><span className="font-semibold">E:</span> {e.expert?.email || e.expertId.slice(0,8)}</div>
      </div>
    )},
    { key: 'project', label: 'Project/Service', render: (e: any) => <span className="text-xs font-medium text-slate-800">{e.project?.projectName || e.service?.title || '—'}</span> },
    { key: 'actions', label: '', render: (e: any) => (
      <div className="flex justify-end">
        <button onClick={() => setDetailEngagementId(e.id)} className="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded hover:bg-slate-50">Details</button>
      </div>
    )}
  ];

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2"><Handshake className="h-8 w-8 text-emerald-600"/> Engagements Oversight</h1>
          <p className="text-slate-500 mt-2">Monitor all active contracts and service purchases.</p>
        </div>
        <select value={filterState} onChange={(e) => setFilterState(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
          <option value="">All States</option>
          <option value="PENDING">Pending</option>
          <option value="CONNECTED">Connected</option>
          <option value="ACTIVE">Active</option>
          <option value="DISPUTED">Disputed</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      <DataTable columns={columns} data={engagements || []} keyExtractor={(e: any) => e.id} emptyState={<div className="text-center p-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">No engagements found.</div>} />

      {/* Detail Modal */}
      <Modal
        isOpen={!!detailEngagementId}
        onClose={() => setDetailEngagementId(null)}
        title="Engagement Details"
        className="sm:w-[600px] sm:max-w-[600px]"
      >
        {isLoadingDetail ? (
          <div className="flex justify-center p-8"><Spinner /></div>
        ) : engagementDetail ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Status</span>
                <span className="font-semibold text-slate-900">{engagementDetail.state}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Contract Type</span>
                <span className="font-semibold text-slate-900">{engagementDetail.type.replace('_', ' ')}</span>
              </div>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl">
              <h4 className="font-bold text-slate-800 mb-2 border-b pb-2">NDA Signatures</h4>
              <div className="flex justify-between mt-2">
                <span className="text-slate-600">Client NDA: <strong className={engagementDetail.clientNdaAcceptedAt ? "text-emerald-600" : "text-slate-400"}>{engagementDetail.clientNdaAcceptedAt ? 'Signed' : 'Pending'}</strong></span>
                <span className="text-slate-600">Expert NDA: <strong className={engagementDetail.expertNdaAcceptedAt ? "text-emerald-600" : "text-slate-400"}>{engagementDetail.expertNdaAcceptedAt ? 'Signed' : 'Pending'}</strong></span>
              </div>
            </div>

            {engagementDetail.capabilityBid && (
              <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                <h4 className="font-bold text-blue-800 mb-2">Bid Details</h4>
                <p><span className="text-slate-500">Negotiation State:</span> {engagementDetail.capabilityBid.state}</p>
                <p><span className="text-slate-500">Tech Review:</span> {engagementDetail.capabilityBid.techStatus}</p>
              </div>
            )}
            
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
               <h4 className="font-bold text-slate-800 mb-2">Milestones</h4>
               <p className="text-slate-600">This engagement has <strong className="text-slate-900">{engagementDetail.milestones?.length || 0}</strong> instantiated milestones.</p>
            </div>
          </div>
        ) : (
          <div className="text-center p-4 text-rose-500">Failed to load details.</div>
        )}
      </Modal>
    </div>
  );
}