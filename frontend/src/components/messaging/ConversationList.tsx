import { useQuery } from '@tanstack/react-query';
   import { useNavigate, useParams } from 'react-router-dom';
   import { apiClient } from '@/lib/api-client';
   import { useEngagementStore } from '@/store/engagement.store';
   import { useAuthStore } from '@/store/auth.store';
   import { Spinner } from '@/components/ui/Spinner';
   import { MessageSquare } from 'lucide-react';

   interface ConversationListProps {
     onSelect?: (id: string) => void;
     selectedId?: string | null;
   }

   export default function ConversationList({ onSelect, selectedId }: ConversationListProps) {
     const navigate = useNavigate();
     const { engagementId: urlEngagementId } = useParams<{ engagementId?: string }>();
     const { unreadCounts, setActiveEngagement } = useEngagementStore();
     const activeRole = useAuthStore(s => s.activeRole);
     const clientSubtype = useAuthStore(s => s.clientSubtype);

     const getRolePrefix = () => {
       if (activeRole === 'CLIENT' && clientSubtype === 'TECH_TEAM') return 'tech-team';
       if (activeRole === 'CLIENT') return 'ceo';
       if (activeRole === 'EXPERT') return 'expert';
       return 'tech-team';
     };

     const { data: threads, isLoading } = useQuery({
       queryKey: ['conversations'],
       queryFn: () => apiClient.get('/conversations').then(r => r.data),
       refetchInterval: 10_000,
     });

     const effectiveSelectedId = selectedId ?? urlEngagementId ?? null;

     const handleSelect = (id: string) => {
       setActiveEngagement(id);
       if (onSelect) {
         onSelect(id);
       } else {
         navigate(`/${getRolePrefix()}/inbox/${id}`);
       }
     };

     if (isLoading) return <div className='py-12 text-center'><Spinner size='lg'/></div>;

     // Dedup
     const seen = new Set<string>();
     const deduped = (threads || []).filter((t: any) => {
       if (seen.has(t.id)) return false;
       seen.add(t.id);
       return true;
     });

     if (!deduped || deduped.length === 0) return (
       <div className='py-16 text-center'>
         <MessageSquare className='mx-auto h-10 w-10 text-[#CBD5E1]'/>
         <p className='mt-3 font-body text-[16px] text-[#64748B]'>No conversations yet</p>
         <p className='text-[13px] text-[#94A3B8]'>Start a project to begin chatting</p>
       </div>
     );

     // Group by otherParty user
     const grouped: Record<string, { otherParty: any; threads: any[]; totalUnread: number }> = {};
     deduped.forEach((t: any) => {
       const key = t.otherParty?.id || 'unknown';
       if (!grouped[key]) grouped[key] = { otherParty: t.otherParty, threads: [], totalUnread: 0 };
       grouped[key].threads.push(t);
       grouped[key].totalUnread += unreadCounts[t.id] ?? t.unreadCount ?? 0;
     });

     return (
       <div className='divide-y divide-[#F1F5F9]'>
         {Object.entries(grouped).map(([key, group]) => {
           const name = group.otherParty?.fullName || 'User';
           const unread = group.totalUnread;
           const isGroupSelected = group.threads.some(t => t.id === effectiveSelectedId);

           return (
             <div key={key}>
               <div onClick={() => { const f = group.threads[0]; if (f) handleSelect(f.id); }}
                 className={'flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAFC] cursor-pointer transition-colors' + (isGroupSelected ?
 ' bg-[#F1F5F9]' : '')}>
                 <div className='relative shrink-0'>
                   <div className={'w-11 h-11 rounded-full flex items-center justify-center font-headline font-semibold text-[14px]' +
 (isGroupSelected ? ' bg-[#059669] text-white' : ' bg-[#0F172A]/10 text-[#0F172A]')}>
                     {name.charAt(0)}
                   </div>
                   {unread > 0 && (
                     <span className='absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#EF4444] text-white text-[11px] flex items-center
 justify-center font-bold'>
                       {unread > 9 ? '9+' : unread}
                     </span>
                   )}
                 </div>
                 <div className='flex-1 min-w-0'>
                   <p className='text-[14px] font-semibold text-[#0F172A]'>{name}</p>
                   <p className='text-[13px] text-[#64748B]'>{group.threads.length} project{group.threads.length > 1 ? 's' : ''}</p>
                 </div>
               </div>

               {group.threads.map((t: any) => {
                 const lastMsg = (t.lastMessage?.content || '').substring(0, 60);
                 const time = t.lastMessage?.timestamp
                   ? new Date(t.lastMessage.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                   : '';
                 const isSelected = effectiveSelectedId === t.id;

                 return (
                   <div key={t.id} onClick={() => handleSelect(t.id)}
                     className={'flex items-center gap-3 pl-14 pr-4 py-2 hover:bg-[#F8FAFC] cursor-pointer transition-colors' +
 (isSelected ? ' bg-[#F1F5F9]' : '')}>
                     <div className='flex-1 min-w-0'>
                       <p className='text-[13px] text-[#64748B] truncate'>{t.projectName || 'Project'}</p>
                       <p className='text-[12px] text-[#94A3B8] truncate'>{lastMsg || <span className='italic'>No messages</span>}</p>
                     </div>
                     <span className='text-[10px] text-[#94A3B8] shrink-0'>{time}</span>
                   </div>
                 );
               })}
             </div>
           );
         })}
       </div>
     );
   }