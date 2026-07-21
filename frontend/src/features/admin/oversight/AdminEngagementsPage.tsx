import { useState, useMemo } from 'react';
import { useAdminEngagements } from '@/hooks/use-admin';
import { useEngagement } from '@/hooks/use-engagements';
import { DataTable, Column } from '@/components/layout/Table';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/modal';
import { Handshake } from 'lucide-react';
import { AdminTableToolbar } from '@/features/admin/layout/AdminTableToolbar';

const ROWS_PER_PAGE = 15;

export default function AdminEngagementsPage() {
  const [filterState, setFilterState] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string>('id');
  const [sortDirection, setSortDirection] = useState<'asc'|'desc'>('asc');

  const { data, isLoading } = useAdminEngagements({ state: filterState || undefined });
  const engagements: any[] = Array.isArray(data) ? data : data?.data ?? [];

  // Detail Modal State
  const [detailEngagementId, setDetailEngagementId] = useState<string | null>(null);
  const { data: engagementDetail, isLoading: isLoadingDetail } = useEngagement(detailEngagementId || undefined);

  const filteredAndSorted = useMemo(() => {
    let result = engagements.filter(e => {
      if (search) {
        const query = search.toLowerCase();
        const id = (e.id || '').toLowerCase();
        const clientEmail = (e.client?.email || '').toLowerCase();
        const expertEmail = (e.expert?.email || '').toLowerCase();
        const projName = (e.project?.projectName || e.service?.title || '').toLowerCase();
        return id.includes(query) || clientEmail.includes(query) || expertEmail.includes(query) || projName.includes(query);
      }
      return true;
    });

    result.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';
      switch (sortColumn) {
        case 'id':
          valA = a.id || '';
          valB = b.id || '';
          break;
        case 'type':
          valA = a.type || '';
          valB = b.type || '';
          break;
        case 'state':
          valA = a.state || '';
          valB = b.state || '';
          break;
        case 'project':
          valA = a.project?.projectName || a.service?.title || '';
          valB = b.project?.projectName || b.service?.title || '';
          break;
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [engagements, search, sortColumn, sortDirection]);

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
    { key: 'id', label: 'ID', sortable: true, render: (e: any) => <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-200">{e.id.slice(0,8)}</span> },
    { key: 'type', label: 'Type', sortable: true, render: (e: any) => <span className="text-xs font-bold text-slate-700">{e.type.replace('_', ' ')}</span> },
    { key: 'state', label: 'State', sortable: true, render: (e: any) => <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${e.state === 'ACTIVE' || e.state === 'CONNECTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{e.state}</span> },
    { key: 'parties', label: 'Parties', sortable: false, render: (e: any) => (
      <div className="text-xs">
        <div className="text-blue-700"><span className="font-semibold">C:</span> {e.client?.email || e.clientId.slice(0,8)}</div>
        <div className="text-emerald-700 mt-0.5"><span className="font-semibold">E:</span> {e.expert?.email || e.expertId.slice(0,8)}</div>
      </div>
    )},
    { key: 'project', label: 'Project/Service', sortable: true, render: (e: any) => <span className="text-xs font-medium text-slate-800">{e.project?.projectName || e.service?.title || '—'}</span> },
    { key: 'actions', label: '', sortable: false, render: (e: any) => (
      <div className="flex justify-end">
        <button onClick={() => setDetailEngagementId(e.id)} className="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded hover:bg-slate-50">Details</button>
      </div>
    )}
  ];

  return (
    <div className="max-w-[1440px] mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2"><Handshake className="h-8 w-8 text-emerald-600"/> Engagements Oversight</h1>
          <p className="text-slate-500 mt-2">Monitor all active contracts and service purchases.</p>
        </div>
      </div>

      <AdminTableToolbar 
        searchQuery={search}
        onSearchChange={(val) => { setSearch(val); setPage(1); }}
        searchPlaceholder="Search by ID, email, or project..."
        tabs={[
          { label: "All States", value: "" },
          { label: "Pending", value: "PENDING" },
          { label: "Connected", value: "CONNECTED" },
          { label: "Active", value: "ACTIVE" },
          { label: "Disputed", value: "DISPUTED" },
          { label: "Closed", value: "CLOSED" },
        ]}
        activeTab={filterState}
        onTabChange={(val) => { setFilterState(val); setPage(1); }}
        itemCount={total}
        itemLabel="engagement"
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
        keyExtractor={(e: any) => e.id} 
        emptyState={<div className="text-center p-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">No engagements found.</div>} 
      />

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