import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Spinner } from '@/components/ui/Spinner';
import { ArrowLeft, Plus, MessageSquare, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MilestoneList() {
  const navigate = useNavigate();
  const { engagementId } = useParams<{ engagementId: string }>();

  // Fetch dữ liệu Milestones thực tế từ DB
  const { data: milestones, isLoading } = useQuery({
    queryKey: ['milestones', engagementId],
    queryFn: () => apiClient.get(`/engagements/${engagementId}/milestones`).then(r => r.data),
    enabled: !!engagementId,
  });

  const formatVnd = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
      .format(val)
      .replace('₫', 'VND');
  };

  if (isLoading) return <div className='py-12 text-center'><Spinner size='lg' /></div>;

  return (
    <div className='max-w-5xl mx-auto space-y-6 font-sans'>
      {/* [FRONT-5] Tiêu đề & Cụm nút hành động bên góc phải */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="p-1 hover:bg-[#F1F5F9] rounded-full text-[#64748B] transition-colors">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold text-[#0F172A] font-headline">Milestones</h1>
          </div>
          <p className="text-sm text-[#64748B] mt-1 pl-7">
            Manage deliverables, track escrow status, and sign off criteria.
          </p>
        </div>
        
        {/* Nhóm các nút hành động nằm bên phải */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/ceo/inbox/${engagementId}`)}
            className="flex items-center gap-2 px-4 py-2 h-10 border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] text-sm font-semibold text-[#64748B] transition-colors bg-white shadow-sm"
          >
            <MessageSquare size={16} />
            <span>Chat</span>
          </button>
          
          <button
            onClick={() => navigate(`/ceo/engagements/${engagementId}/milestones/create`)}
            className="flex items-center gap-2 px-4 py-2 h-10 bg-[#0F172A] text-white rounded-lg hover:bg-[#020617] text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus size={16} />
            <span>Create New Milestone</span>
          </button>
        </div>
      </div>

      {/* Render list of Milestones */}
      {(!milestones || milestones.length === 0) ? (
        <div className='border-2 border-dashed border-[#E2E8F0] rounded-xl p-16 text-center bg-white shadow-sm'>
          <CheckCircle2 className='mx-auto h-12 w-12 text-[#94A3B8]' />
          <h3 className='text-[16px] font-bold text-[#0F172A] mt-4 font-headline'>No Milestones Created</h3>
          <p className='text-[13px] text-[#64748B] mt-1'>Define a milestone workflow and deposit assets to begin work.</p>
        </div>
      ) : (
        <div className='space-y-4'>
          {milestones.map((milestone: any) => (
            <div key={milestone.id} className='bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm flex justify-between items-start'>
              <div className='space-y-3 flex-1 pr-6 min-w-0'>
                <div className='flex items-center gap-2.5'>
                  <span className='px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#0F172A]/10 text-[#0F172A] tracking-wider'>
                    Milestone #{milestone.milestoneNumber}
                  </span>
                  <span className={cn(
                    'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                    milestone.state === 'APPROVED' || milestone.state === 'RELEASED'
                      ? 'bg-[#059669]/10 text-[#059669]'
                      : 'bg-[#EAB308]/10 text-[#CA8A04]'
                  )}>
                    {milestone.state}
                  </span>
                </div>
                <h3 className='text-[16px] font-bold text-[#0F172A] leading-relaxed break-words font-headline'>{milestone.deliverableStatement}</h3>
                <div className='flex items-center gap-1.5 text-xs text-[#64748B]'>
                  <ShieldCheck size={14} className='text-[#94A3B8]' />
                  <span>Authority: <strong className='text-[#0F172A]'>{milestone.signOffAuthority}</strong></span>
                </div>
              </div>

              <div className='text-right shrink-0 space-y-4'>
                <div>
                  <p className='text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider'>Payment Amount</p>
                  <p className='text-xl font-black text-[#0F172A] mt-0.5'>{formatVnd(Number(milestone.paymentAmountVnd))}</p>
                </div>
                <button
                  onClick={() => navigate(`/ceo/engagements/${engagementId}/milestones/${milestone.id}`)}
                  className='px-4 py-1.5 border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] transition-colors bg-white shadow-sm'
                >
                  Review
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}