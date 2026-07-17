import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import MilestoneChatAssistant from './MilestoneChatAssistant';
import { MessageSquare, Plus, DollarSign, ShieldAlert, Award } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';

export default function MilestoneList() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const navigate = useNavigate();

  const { data: response, isLoading } = useQuery({
    queryKey: ['milestones', engagementId],
    queryFn: () => apiClient.get(`/engagements/${engagementId}/milestones`).then(r => r.data),
  });

  const milestones = response?.data || [];
  const engagement = response?.engagement;
  const projectId = engagement?.projectId;

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
      {/* Dynamic Grouped Actions Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-headline">Milestones</h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage deliverables, track escrow status, and sign off criteria.
          </p>
        </div>

        {/* [FRONT-3] Group actions together on the right side of header row */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => navigate(`/ceo/inbox/${engagementId}`)}
            className="flex items-center gap-2 h-10 px-4 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 shadow-sm transition-colors"
          >
            <MessageSquare size={16} />
            Chat
          </button>

          <button
            onClick={() => navigate(`/ceo/engagements/${engagementId}/milestones/create`)}
            className="flex items-center gap-2 h-10 px-4 bg-[#0F172A] hover:bg-[#020617] rounded-xl text-xs font-bold text-white shadow-sm transition-colors"
          >
            <Plus size={16} />
            Create New Milestone
          </button>
        </div>
      </div>

      {/* Main List Workspace */}
      {milestones.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-16 text-center bg-white">
          <Award size={36} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-bold text-slate-800 mb-1">No Milestones Defined</h3>
          <p className="text-slate-500 text-xs">
            Start the contract execution by planning the first deliverable milestone.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {milestones.map((milestone: any) => (
            <div
              key={milestone.id}
              className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-start"
            >
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    Milestone #{milestone.milestoneNumber}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    milestone.state === 'FUNDED' || milestone.state === 'RELEASED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {milestone.state}
                  </span>
                </div>

                <p className="text-sm font-medium text-slate-800 leading-relaxed">
                  {milestone.deliverableStatement}
                </p>

                <p className="text-[11px] text-slate-400">
                  Sign-off authority: <strong className="text-slate-600">{milestone.signOffAuthority}</strong>
                </p>
              </div>

              <div className="text-right shrink-0 flex flex-col items-end justify-between h-full min-h-[80px]">
                <div>
                  <span className="text-[10px] text-slate-400 block font-headline">Payment Amount</span>
                  <strong className="text-emerald-600 text-base font-bold block">
                    {formatCurrency(milestone.paymentAmountVnd)}
                  </strong>
                </div>

                <button
                  onClick={() => navigate(`/ceo/engagements/${engagementId}/milestones/${milestone.id}`)}
                  className="mt-4 h-8 px-4 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition-colors"
                >
                  Review
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Single Project-Scoped Milestone Chat Widget */}
      {projectId && (
        <MilestoneChatAssistant projectId={projectId} engagementId={engagementId} />
      )}
    </div>
  );
}