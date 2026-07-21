import { useState, useMemo } from 'react';
import { useAdminProjects, useAdminProjectDetail, useSuspendProject, useReopenProject } from '@/hooks/use-admin';
import { DataTable, Column } from '@/components/layout/Table';
import { Spinner } from '@/components/ui/Spinner';
import { Modal, ConfirmModal } from '@/components/ui/modal';
import { Briefcase, Ban, CheckCircle2 } from 'lucide-react';
import { AdminTableToolbar } from '@/features/admin/layout/AdminTableToolbar';

const ROWS_PER_PAGE = 15;

export default function AdminProjectsPage() {
  const [filterState, setFilterState] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc'|'desc'>('desc');

  const { data, isLoading } = useAdminProjects({ state: filterState || undefined });
  const suspendProject = useSuspendProject();
  const reopenProject = useReopenProject();
  
  const [confirmTarget, setConfirmTarget] = useState<{ id: string, action: 'suspend' | 'reopen' } | null>(null);
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null);
  const { data: projectDetail, isLoading: isLoadingDetail } = useAdminProjectDetail(detailProjectId || '');

  const projects: any[] = Array.isArray(data) ? data : data?.data ?? [];

  const filteredAndSorted = useMemo(() => {
    let result = projects.filter(p => {
      if (search) {
        const query = search.toLowerCase();
        const name = (p.projectName || '').toLowerCase();
        const id = (p.id || '').toLowerCase();
        return name.includes(query) || id.includes(query);
      }
      return true;
    });

    result.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';
      switch (sortColumn) {
        case 'projectName':
          valA = a.projectName || '';
          valB = b.projectName || '';
          break;
        case 'tier':
          valA = a.tier || '';
          valB = b.tier || '';
          break;
        case 'state':
          valA = a.state || '';
          valB = b.state || '';
          break;
        case 'createdAt':
          valA = new Date(a.createdAt || 0).getTime();
          valB = new Date(b.createdAt || 0).getTime();
          break;
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [projects, search, sortColumn, sortDirection]);

  const total = filteredAndSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const paginatedData = filteredAndSorted.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const handleConfirm = () => {
    if (!confirmTarget) return;
    if (confirmTarget.action === 'suspend') suspendProject.mutate(confirmTarget.id);
    else reopenProject.mutate(confirmTarget.id);
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
    { key: 'projectName', label: 'Project', sortable: true, render: (p: any) => <div className="font-bold text-slate-900">{p.projectName || `Project ${p.id.slice(0,8)}`}</div> },
    { key: 'tier', label: 'Tier', sortable: true, render: (p: any) => <span className="text-xs font-bold text-slate-500 uppercase">{p.tier?.replace('_', ' ') || '—'}</span> },
    { key: 'state', label: 'State', sortable: true, render: (p: any) => <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${p.state === 'SUSPENDED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{p.state}</span> },
    { key: 'createdAt', label: 'Created At', sortable: true, render: (p: any) => <span className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</span> },
    { key: 'actions', label: '', sortable: false, render: (p: any) => (
      <div className="flex justify-end gap-2">
        <button onClick={() => setDetailProjectId(p.id)} className="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded hover:bg-slate-50">Details</button>

        {p.state === 'SUSPENDED' ? (
          <button onClick={() => setConfirmTarget({ id: p.id, action: 'reopen'})} className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded hover:bg-emerald-100">Reopen</button>
        ) : (
          <button onClick={() => setConfirmTarget({ id: p.id, action: 'suspend'})} className="px-3 py-1 bg-red-50 text-red-700 text-xs font-bold rounded hover:bg-red-100">Suspend Spec</button>
        )}
      </div>
    )}
  ];

  return (
    <div className="max-w-[1440px] mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2"><Briefcase className="h-8 w-8 text-blue-600"/> Projects Oversight</h1>
          <p className="text-slate-500 mt-2">Monitor all published projects. Suspend malicious or non-compliant specs.</p>
        </div>
      </div>

      <AdminTableToolbar 
        searchQuery={search}
        onSearchChange={(val) => { setSearch(val); setPage(1); }}
        searchPlaceholder="Search by project name or ID..."
        tabs={[
          { label: "All States", value: "" },
          { label: "Published", value: "PUBLISHED" },
          { label: "Suspended", value: "SUSPENDED" },
        ]}
        activeTab={filterState}
        onTabChange={(val) => { setFilterState(val); setPage(1); }}
        itemCount={total}
        itemLabel="project"
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
        keyExtractor={(p: any) => p.id} 
      />

      <ConfirmModal
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleConfirm}
        title={confirmTarget?.action === 'suspend' ? 'Suspend Project' : 'Reopen Project'}
        confirmText={confirmTarget?.action === 'suspend' ? 'Suspend' : 'Reopen'}
        isDestructive={confirmTarget?.action === 'suspend'}
      >
        {confirmTarget?.action === 'suspend' ? 'Are you sure you want to suspend this project? It will be hidden from the marketplace immediately.' : 'Reopen this project to the marketplace?'}
      </ConfirmModal>
      {/* Project Details Modal */}
      <Modal
        isOpen={!!detailProjectId}
        onClose={() => setDetailProjectId(null)}
        title="Project Full Specification"
        className="sm:w-[700px] sm:max-w-[700px]"
      >
        {isLoadingDetail ? (
          <div className="flex justify-center p-8"><Spinner /></div>
        ) : projectDetail ? (
          <div className="space-y-6 text-sm">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
              <div>
                <span className="text-xs text-slate-500 font-bold uppercase block">Owner (CEO)</span>
                <span className="font-semibold text-slate-900">{projectDetail.client?.fullName} ({projectDetail.client?.email})</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 font-bold uppercase block">Invitations Sent</span>
                <span className="font-bold text-blue-600">{projectDetail._count?.invitations || 0}</span>
              </div>
            </div>

            {projectDetail.techTeamProfiles?.length > 0 && (
              <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
                <span className="text-xs text-orange-800 font-bold uppercase block mb-1">Linked Tech Team</span>
                <span className="font-semibold text-orange-900">{projectDetail.techTeamProfiles[0].user?.fullName}</span>
              </div>
            )}

            <div>
              <h4 className="font-bold text-slate-800 mb-2 border-b pb-2">Business Intent (Artifact A)</h4>
              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{projectDetail.artifactAJson?.business_intent || 'No intent recorded.'}</p>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 mb-2 border-b pb-2">Technical Constraints (Artifact B)</h4>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-slate-700 whitespace-pre-wrap">
                <span className="font-semibold text-slate-900 block mb-1">Integration Method:</span>
                {projectDetail.artifactBJson?.integration_method || 'N/A'}
                <span className="font-semibold text-slate-900 block mt-3 mb-1">Legacy Volume:</span>
                {projectDetail.artifactBJson?.legacy_volume || 'N/A'}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center p-4 text-rose-500">Failed to load details.</div>
        )}
      </Modal>
    </div>
  );
}