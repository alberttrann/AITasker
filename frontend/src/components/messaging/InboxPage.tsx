import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ConversationList from '@/components/messaging/ConversationList';
import MessageThread from '@/components/messaging/MessageThread';
import { MessageSquare } from 'lucide-react';

export default function InboxPage() {
  const { engagementId: urlEngagementId } = useParams<{ engagementId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(urlEngagementId ?? null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Sync selectedEngagementId với URL param khi browser back/forward
  useEffect(() => {
    setSelectedEngagementId(urlEngagementId ?? null);
  }, [urlEngagementId]);

  const activeEngagementId = selectedEngagementId;
  const activeProjectId = selectedProjectId;

  // Xác định base path từ URL hiện tại (/expert/inbox hoặc /ceo/inbox)
  const basePath = location.pathname.startsWith('/ceo') ? '/ceo' : '/expert';

  const handleSelect = (id: string) => {
    setSelectedEngagementId(id);
    setSelectedProjectId(null);
    // Cập nhật URL để useParams trong MessageThread nhận đúng engagementId
    navigate(`${basePath}/inbox/${id}`, { replace: true });
  };

  return (
    <div className='flex h-[calc(100vh-160px)] bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm'>
      {/* ── Left pane: Conversation list (35%) ── */}
      <div className='w-[35%] min-w-[320px] border-r border-[#E2E8F0] flex flex-col h-full overflow-hidden'>
        <div className='p-4 border-b border-[#F1F5F9] shrink-0'>
          <h2 className='font-headline text-[18px] font-semibold text-[#0F172A]'>Chats</h2>
        </div>
        <div className='flex-1 overflow-y-auto'>
          <ConversationList
            onSelect={handleSelect}
            selectedId={activeEngagementId}
          />
        </div>
      </div>

      {/* ── Right pane: Message thread (65%) ── */}
      <div className='flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden'>
        {activeEngagementId ? (
          <MessageThread
            engagementId={activeEngagementId}
            onSelectEngagement={handleSelect}
          />
        ) : activeProjectId ? (
          <MessageThread
            projectId={activeProjectId}
            onSelectEngagement={handleSelect}
          />
        ) : (
          <div className='flex flex-col items-center justify-center h-full text-center p-6'>
            <div className='w-16 h-16 bg-[#E2E8F0] rounded-full flex items-center justify-center mb-4 text-[#94A3B8]'>
              <MessageSquare size={28} />
            </div>
            <h3 className='font-headline text-[16px] font-semibold text-[#64748B]'>No Chat Selected</h3>
            <p className='text-[13px] text-[#94A3B8] mt-1 max-w-xs'>
              Choose a conversation from the left pane to view messages.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}