import { useState } from 'react';
import { useAdminExperts, useAdminUser } from '@/hooks/use-admin';
import { DataTable } from '@/components/layout/Table';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/modal';
import { Award, CheckCircle2 } from 'lucide-react';

export default function AdminExpertsPage() {
  const { data: experts, isLoading } = useAdminExperts();

  // Detail Modal State
  const [detailExpertId, setDetailExpertId] = useState<string | null>(null);
  const { data: expertDetail, isLoading: isLoadingDetail } = useAdminUser(detailExpertId);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const columns = [
    { key: 'user', label: 'Expert', render: (e: any) => (
      <div>
        <div className="font-bold text-slate-900 text-sm">{e.fullName}</div>
        <div className="text-xs text-slate-500 font-mono">{e.email}</div>
      </div>
    )},
    { key: 'tier', label: 'Subscription', render: (e: any) => <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${e.subscriptionExpertTier === 'pro' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-600'}`}>{e.subscriptionExpertTier}</span> },
    { key: 'domains', label: 'Domains', render: (e: any) => (
      <div className="flex flex-wrap gap-1 max-w-[200px]">
        {e.expertDomainDepths?.map((d: any) => (
          <span key={d.domainCode} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-100">{d.domainCode}:{d.depthLevel.charAt(0)}</span>
        ))}
      </div>
    )},
    { key: 'seams', label: 'Seam Claims', render: (e: any) => (
      <div className="flex flex-wrap gap-1 max-w-[200px]">
        {e.expertSeamClaims?.map((s: any) => (
          <span key={s.seamCode} className={`flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded border ${s.verificationTier === 'EVIDENCE_BACKED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
            {s.seamCode} {s.verificationTier === 'EVIDENCE_BACKED' && <CheckCircle2 size={10} />}
          </span>
        ))}
      </div>
    )},
    { key: 'joined', label: 'Joined', render: (e: any) => <span className="text-xs text-slate-500">{new Date(e.createdAt).toLocaleDateString()}</span> },
    { key: 'actions', label: '', render: (e: any) => (
      <div className="flex justify-end">
        <button onClick={() => setDetailExpertId(e.id)} className="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded hover:bg-slate-50">Details</button>
      </div>
    )}
  ];

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2"><Award className="h-8 w-8 text-amber-500"/> Expert Verification</h1>
          <p className="text-slate-500 mt-2">Oversight of expert domain depths and AI-verified seam claims.</p>
        </div>
      </div>
      <DataTable columns={columns} data={experts || []} keyExtractor={(e: any) => e.id} emptyState={<div className="text-center p-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">No experts found.</div>} />

      {/* Detail Modal */}
      <Modal
        isOpen={!!detailExpertId}
        onClose={() => setDetailExpertId(null)}
        title="Expert Profile Details"
        className="sm:w-[600px] sm:max-w-[600px]"
      >
        {isLoadingDetail ? (
          <div className="flex justify-center p-8"><Spinner /></div>
        ) : expertDetail ? (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
              <div className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold text-xl">
                {expertDetail.fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{expertDetail.fullName}</h3>
                <p className="text-slate-500">{expertDetail.email}</p>
              </div>
            </div>

            {expertDetail.expertProfile && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="font-bold text-slate-800 mb-2">Professional Bio</h4>
                <p className="text-slate-600 whitespace-pre-wrap">{expertDetail.expertProfile.bio || 'No bio provided.'}</p>
                <div className="mt-4 pt-3 border-t border-slate-200">
                  <span className="text-slate-500 mr-2">Engagement Model:</span> 
                  <span className="font-semibold text-slate-900">{expertDetail.expertProfile.engagementModel || 'N/A'}</span>
                </div>
              </div>
            )}

            {expertDetail.wallet && (
              <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                <h4 className="font-bold text-emerald-800 mb-2">Wallet Status</h4>
                <div className="flex justify-between">
                  <span className="text-slate-600">Available to Withdraw: <strong className="text-slate-900">{Number(expertDetail.wallet.availableBalance).toLocaleString('vi-VN')} ₫</strong></span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center p-4 text-rose-500">Failed to load expert details.</div>
        )}
      </Modal>
    </div>
  );
}