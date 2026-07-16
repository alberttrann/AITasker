import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Spinner } from '@/components/ui/Spinner';
import { ArrowLeft, MessageSquare, ShieldCheck, CheckSquare, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ExpertMilestoneDetail() {
  const navigate = useNavigate();
  const { engagementId, milestoneId } = useParams<{ engagementId: string; milestoneId: string }>();

  // Fetch Milestone hiện tại
  const { data: milestone, isLoading } = useQuery({
    queryKey: ['milestone', milestoneId],
    queryFn: () => apiClient.get(`/milestones/${milestoneId}`).then(r => r.data),
    enabled: !!milestoneId,
  });

  const formatVnd = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
      .format(val)
      .replace('₫', 'VND');
  };

  if (isLoading) return <div className='py-12 text-center'><Spinner size='lg' /></div>;

  return (
    <div className='max-w-6xl mx-auto space-y-6 font-sans'>
      {/* [FRONT-6] Tiêu đề & Nút Chat được căn chỉnh đều sang bên phải trên cùng hàng */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="p-1 hover:bg-[#F1F5F9] rounded-full text-[#64748B] transition-colors">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold text-[#0F172A] font-headline">Milestone Workspace</h1>
          </div>
          <p className="text-sm text-[#64748B] mt-1 pl-7">
            Track DoD checklist requirements, submit deliverables, and review sign-offs.
          </p>
        </div>

        {/* Nút Chat ở bên phải cùng dòng */}
        <div>
          <button
            onClick={() => navigate(`/expert/inbox/${engagementId}`)}
            className="flex items-center gap-2 px-4 py-2 border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] text-sm font-semibold text-[#64748B] transition-colors bg-white shadow-sm h-10"
          >
            <MessageSquare size={16} />
            <span>Chat với CEO</span>
          </button>
        </div>
      </div>

      {/* Main Workspace content */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 items-start'>
        {/* Chi tiết Milestone */}
        <div className='lg:col-span-2 bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-6'>
          <div className='flex items-center justify-between border-b border-[#F1F5F9] pb-4'>
            <div>
              <span className='px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#0F172A]/10 text-[#0F172A] tracking-wider'>
                Milestone #{milestone?.milestoneNumber || 1}
              </span>
              <span className="ml-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#EAB308]/10 text-[#CA8A04]">
                {milestone?.state || 'SUBMITTED'}
              </span>
            </div>
            <div className='text-right'>
              <span className='text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider block'>Escrow Value</span>
              <span className='text-lg font-black text-[#059669]'>{formatVnd(Number(milestone?.paymentAmountVnd || 0))}</span>
            </div>
          </div>

          <h3 className='text-[18px] font-bold text-[#0F172A] leading-relaxed font-headline'>{milestone?.deliverableStatement}</h3>

          <div className='flex items-center gap-4 text-xs text-[#64748B] pt-2'>
            <div className='flex items-center gap-1.5'>
              <ShieldCheck size={15} className='text-[#94A3B8]' />
              <span>Authority: <strong className='text-[#0F172A]'>{milestone?.signOffAuthority || 'CEO'}</strong></span>
            </div>
            <div className='flex items-center gap-1.5'>
              <Clock size={15} className='text-[#94A3B8]' />
              <span>Registered: <strong className='text-[#0F172A]'>7/13/2026</strong></span>
            </div>
          </div>

          {/* Submission and Status Panel */}
          <div className='p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-start gap-3 shadow-inner'>
            <CheckSquare className='text-[#059669] mt-0.5 shrink-0' size={18} />
            <div className='space-y-1'>
              <p className='text-sm font-semibold text-[#0F172A]'>Awaiting Client Sign-off</p>
              <p className='text-xs text-[#64748B] leading-relaxed'>
                You have submitted the deliverables for this milestone. The sign-off authority is currently reviewing the submission against the acceptance criteria.
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className='bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-6 space-y-4 shadow-sm'>
          <h4 className='text-xs font-bold text-[#0F172A] uppercase tracking-wider font-headline'>Milestone Actions</h4>
          <p className='text-xs text-[#64748B] leading-relaxed'>
            Need to negotiate changes or resolve questions? Communicate directly with the client using the chat workspace or request a formal milestone revision.
          </p>
          <div className='border-t border-[#E2E8F0] pt-4'>
            <button
              onClick={() => navigate(`/expert/inbox/${engagementId}`)}
              className='w-full py-2 bg-[#0F172A] hover:bg-[#020617] text-white text-xs font-semibold rounded-lg transition-colors shadow-sm'
            >
              Open Direct Inbox Thread
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}