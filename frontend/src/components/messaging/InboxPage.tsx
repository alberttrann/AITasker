import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ChatSidebar from '@/components/messaging/ChatSidebar';
import MessageThread from '@/components/messaging/MessageThread';
import { MessageSquare } from 'lucide-react';

export default function InboxPage() {
  const { engagementId: urlEngagementId } = useParams<{ engagementId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(urlEngagementId ?? null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Sync selectedEngagementId with URL param when browser navigates
  useEffect(() => {
    setSelectedEngagementId(urlEngagementId ?? null);
  }, [urlEngagementId]);

  const activeEngagementId = selectedEngagementId;
  const activeProjectId = selectedProjectId;

  // Determine base path from current URL (/expert/inbox or /ceo/inbox)
  const basePath = location.pathname.startsWith('/ceo') ? '/ceo' : '/expert';

  const handleSelect = (id: string) => {
    setSelectedEngagementId(id);
    setSelectedProjectId(null);
    // Update URL so useParams gets the right ID, without full remount
    navigate(`${basePath}/inbox/${id}`, { replace: true });
  };

  return (
    <div className='w-full max-w-[1440px] px-6 mx-auto py-6 flex h-[calc(100vh-160px)] min-h-[500px] bg-transparent border-0 gap-6 overflow-hidden select-none'>
      {/* ── Left pane: Conversation list grouped by partner (ChatSidebar) ── */}
      <ChatSidebar activeEngagementId={activeEngagementId} />

      {/* ── Right pane: Message thread with Dropdown ── */}
      <div className='flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden rounded-2xl border border-slate-200/80 shadow-sm'>
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
          <div className='flex flex-col items-center justify-center h-full text-center p-6 bg-white'>
            <div className='w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 border border-slate-200/80 shadow-inner mb-4'>
              <MessageSquare size={28} />
            </div>
            <h3 className='text-sm font-bold text-slate-800'>No Chat Selected</h3>
            <p className='text-xs text-slate-400 leading-relaxed mt-1.5 max-w-sm'>
              Choose a contact from the sidebar to view messages, coordinate milestones, or discuss project details in real-time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}