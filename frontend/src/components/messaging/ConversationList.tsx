import { useNavigate, useParams } from 'react-router-dom';
import { useConversations } from '@/hooks/use-messages';
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

  const { data: threads, isLoading } = useConversations();

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

  // Trích xuất mảng một cách an toàn để xử lý triệt để lỗi non-iterable [5]
  const threadsArray = Array.isArray(threads) 
    ? threads 
    : (Array.isArray(threads?.data) ? threads.data : []);

  // Lọc sạch các đoạn chat ảo không có tin nhắn và DEDUPLICATE theo từng dự án cụ thể [5]
  const deduped: any[] = [];
  const seenKeys = new Set<string>();

  // Sắp xếp các đoạn chat theo thời gian tin nhắn mới nhất
  const sortedThreads = [...threadsArray].sort((a, b) => {
    return (new Date(b.lastMessage?.timestamp || 0).getTime()) - (new Date(a.lastMessage?.timestamp || 0).getTime());
  });

  sortedThreads.forEach((t: any) =>  {
    
    // Định nghĩa Key duy nhất bằng: ID đối tác + ID dự án [5]
    const otherPartyId = t.otherParty?.id || 'unknown';
    const projectKey = t.projectId || t.projectName || 'service-workspace';
    const uniqueKey = `${otherPartyId}-${projectKey}`;

    // Nếu đã tồn tại dự án này trong danh sách, bỏ qua dòng lặp trùng lặp tiếp theo [5]
    if (seenKeys.has(uniqueKey)) {
      return;
    }

    seenKeys.add(uniqueKey);
    deduped.push(t);
  });

  if (deduped.length === 0) return (
    <div className='py-16 text-center'>
      <MessageSquare className='mx-auto h-10 w-10 text-[#CBD5E1]'/>
      <p className='mt-3 font-body text-[16px] text-[#64748B]'>No conversations yet</p>
      <p className='text-[13px] text-[#94A3B8]'>Start a project to begin chatting</p>
    </div>
  );

  return (
    <div className='divide-y divide-[#F1F5F9]'>
      {deduped.map((t: any) => {
        const isSelected = effectiveSelectedId === t.id;
        const name = t.otherParty?.fullName || 'Partner';
        const projectName = t.projectName || 'Service Purchase Workspace';
        const unread = isSelected ? 0 : (t.unreadCount ?? unreadCounts[t.id] ?? 0);
        const lastMsg = (t.lastMessage?.content || '').substring(0, 60);

        // Định dạng thời gian thông minh cho Sidebar
        const formatTime = (ts: string) => {
          if (!ts) return '';
          const date = new Date(ts);
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

          if (msgDate.getTime() === today.getTime()) {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
          } else {
            return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
          }
        };

        const time = t.lastMessage?.timestamp ? formatTime(t.lastMessage.timestamp) : '';

        return (
          <div
            key={t.id}
            onClick={() => handleSelect(t.id)}
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
              isSelected ? 'bg-[#F1F5F9]' : 'hover:bg-[#F8FAFC]'
            }`}
          >
            {/* Avatar */}
            <div className='relative shrink-0'>
              <div className={`w-11 h-11 rounded-full flex items-center justify-center font-headline font-semibold text-[14px] ${
                isSelected ? 'bg-[#059669] text-white' : 'bg-[#0F172A]/10 text-[#0F172A]'
              }`}>
                {name.charAt(0).toUpperCase()}
              </div>
              {unread > 0 && (
                <span className='absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#EF4444] text-white text-[11px] flex items-center justify-center font-bold'>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>

            {/* Info */}
            <div className='flex-1 min-w-0 text-left'>
              <div className='flex justify-between items-baseline mb-0.5'>
                <p className={`text-[14px] truncate ${isSelected ? 'font-bold text-[#0F172A]' : 'font-semibold text-slate-700'}`}>
                  {projectName}
                </p>
                {time && (
                  <span className='text-[10px] text-[#94A3B8] shrink-0 ml-2'>{time}</span>
                )}
              </div>
              <p className={`text-[12px] truncate mb-0.5 ${isSelected ? 'text-slate-600' : 'text-slate-400 font-medium'}`}>
                {name}
              </p>
              <p className={`text-[12px] truncate ${
                unread > 0 && !isSelected ? 'text-[#0F172A] font-bold' : 'text-slate-500'
              }`}>
                {lastMsg}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}