import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { MessageSquare, ChevronLeft, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';

export default function ExpertMilestoneDetail() {
  const { engagementId, milestoneId } = useParams<{ engagementId: string; milestoneId: string }>();
  const navigate = useNavigate();

  const { data: response, isLoading } = useQuery({
    queryKey: ['milestone-detail', milestoneId],
    queryFn: () => apiClient.get(`/milestones/${milestoneId}`).then(r => r.data),
  });

  const milestone = response?.data;
  const engagement = response?.engagement;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <div className="space-y-6 font-body">
      {/* Dynamic Header Row */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-headline">Milestone Workspace</h1>
            <p className="text-slate-500 text-sm mt-1">Review contractual details and complete items.</p>
          </div>
        </div>

        {/* [FRONT-3] Group expert's actions together on the right side of heading line */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => navigate(`/expert/inbox/${engagementId}`)}
            className="flex items-center gap-2 h-10 px-4 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 shadow-sm transition-colors"
          >
            <MessageSquare size={16} />
            Chat với CEO
          </button>
        </div>
      </div>

      {/* Contract Detail Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              Milestone #{milestone?.milestoneNumber}
            </span>
            <p className="text-sm font-medium text-slate-800 leading-relaxed pt-2">
              {milestone?.deliverableStatement}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] text-slate-400 block font-headline">Payment Amount</span>
            <strong className="text-emerald-600 text-base font-bold">
              {formatCurrency(milestone?.paymentAmountVnd || 0)}
            </strong>
          </div>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs">
          <div>
            <span className="text-slate-400 font-headline">Contract Status</span>
            <span className="font-bold text-slate-800 block mt-0.5">{milestone?.state}</span>
          </div>
          <div>
            <span className="text-slate-400 font-headline">Sign-off Authority</span>
            <span className="font-bold text-slate-800 block mt-0.5">{milestone?.signOffAuthority}</span>
          </div>
        </div>
      </div>
    </div>
  );
}