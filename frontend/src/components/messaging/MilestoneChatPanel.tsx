import { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import { useSocket } from '@/hooks/use-socket';
import { useMessages, useSendWorkspaceMessage } from '@/hooks/use-messages';
import { useAuthStore } from '@/store/auth.store';
import { useEngagementStore } from '@/store/engagement.store';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Send, X, MessageSquare, Inbox } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Message {
  id: string;
  content: string;
  timestamp: string;
  senderId: string;
  engagementId?: string;
  projectId?: string;
  sender: {
    id: string;
    email: string;
    fullName: string;
    activeRole: string;
  };
}

interface MilestoneChatPanelProps {
  engagementId: string;
  clientId: string;
  expertId: string;
  projectName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function MilestoneChatPanel({
  engagementId,
  clientId,
  expertId,
  projectName,
  isOpen,
  onClose,
}: MilestoneChatPanelProps) {
  const socket = useSocket();
  const sendMessage = useSendWorkspaceMessage();
  const user = useAuthStore(s => s.user);
  const activeRole = useAuthStore(s => s.activeRole);
  const { setActiveEngagement, clearUnread } = useEngagementStore();
  const queryClient = useQueryClient();

  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const isClient = activeRole === 'CLIENT' || activeRole?.startsWith('CLIENT');
  const dashboardRoute = isClient ? '/ceo' : '/expert';

  type MessageAction =
    | { type: 'MERGE_FETCHED'; messages: Message[] }
    | { type: 'APPEND'; message: Message };

  function messageReducer(state: Message[], action: MessageAction): Message[] {
    switch (action.type) {
      case 'MERGE_FETCHED': {
        const merged = [...action.messages];
        for (const existing of state) {
          if (!merged.find(m => m.id === existing.id)) {
            merged.push(existing);
          }
        }
        merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return merged;
      }
      case 'APPEND': {
        if (state.find(m => m.id === action.message.id)) return state;
        return [...state, action.message].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      }
      default:
        return state;
    }
  }

  const [localMessages, dispatch] = useReducer(messageReducer, []);

  const { data: engData, isLoading } = useMessages(engagementId);
  const fetchedMessages = engData;

  // Auto-read messages when chat is opened
  useEffect(() => {
    if (!isOpen || !engagementId) return;

    apiClient.post(`/conversations/${engagementId}/read`)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      })
      .catch(err => console.error("Error marking messages as read:", err));
  }, [isOpen, engagementId, queryClient]);

  // Handle joining room
  useEffect(() => {
    if (!socket || !engagementId || !isOpen) return;

    socket.emit('joinRoom', { engagementId });
    setActiveEngagement(engagementId);
    clearUnread(engagementId);

    return () => {
      setActiveEngagement(null);
    };
  }, [socket, engagementId, isOpen, setActiveEngagement, clearUnread]);

  // Merge fetched messages
  useEffect(() => {
    if (!fetchedMessages) return;
    const fetched = Array.isArray(fetchedMessages)
      ? fetchedMessages
      : (fetchedMessages as any)?.data ?? [];
    dispatch({ type: 'MERGE_FETCHED', messages: fetched });
  }, [fetchedMessages]);

  // Handle incoming socket messages
  useEffect(() => {
    if (!socket || !isOpen) return;

    const handler = (msg: Message) => {
      if (msg.engagementId !== engagementId) return;

      dispatch({ type: 'APPEND', message: msg });
      
      if (msg.senderId !== user?.id) {
        apiClient.post(`/conversations/${engagementId}/read`)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
          })
          .catch(err => console.error("Error auto-reading message:", err));
      }
    };

    socket.on('newMessage', handler);
    return () => { socket.off('newMessage', handler); };
  }, [socket, engagementId, isOpen, user, queryClient]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [localMessages, isOpen, scrollToBottom]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !engagementId) return;

    sendMessage({
      engagement_id: engagementId,
      content: trimmed,
    });
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOwnMessage = (senderId: string) => senderId === user?.id;

  const getSenderRoleDetails = (senderId: string) => {
    if (senderId === clientId) {
      return { label: 'CEO', bg: 'bg-blue-100 text-blue-800 border-blue-200' };
    }
    if (senderId === expertId) {
      return { label: 'EXPERT', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    }
    return { label: 'TECH TEAM', bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
  };

  const formatTime = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-white border-l border-slate-200 shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-250">
      {/* Header */}
    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-900 text-white rounded-tl-xl">
      <div className="flex items-center gap-2.5 min-w-0">
        <MessageSquare className="w-5 h-5 text-emerald-400 shrink-0" />
        <div className="min-w-0">
          <h3 className="text-sm font-bold truncate font-headline">Workspace Chat</h3>
          <p className="text-[11px] text-slate-400 truncate">
            {projectName || 'Service Workspace'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Nút navigate sang Inbox đầy đủ */}
        <button
          onClick={() => { onClose(); navigate(`${dashboardRoute}/inbox/${engagementId}`); }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700 hover:border-emerald-500 hover:text-emerald-400 transition-colors text-slate-400 text-[11px] font-semibold"
          title="Open in Messenger"
        >
          <Inbox className="w-3.5 h-3.5" />
          <span>Open Chat</span>
        </button>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
          aria-label="Close Chat"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#F8FAFC]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner size="md" />
          </div>
        ) : localMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-6">
            <MessageSquare size={36} className="text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-slate-500">No messages in workspace</p>
            <p className="text-[11px] text-slate-400 max-w-[200px] mt-0.5">
              Discuss criteria, deliverables, or DoD checklists here with the team.
            </p>
          </div>
        ) : (
          localMessages.map((msg) => {
            const own = isOwnMessage(msg.senderId);
            const roleInfo = getSenderRoleDetails(msg.senderId);

            return (
              <div key={msg.id} className={cn('flex gap-2', own ? 'justify-end' : 'justify-start')}>
                {!own && (
                  <div className="shrink-0 w-8 h-8 rounded-full bg-[#0F172A]/10 flex items-center justify-center font-headline font-semibold text-[12px] text-[#0F172A] mt-1 shadow-inner">
                    {msg.sender?.fullName?.charAt(0) || '?'}
                  </div>
                )}

                <div className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2.5 shadow-[0px_1px_3px_rgba(15,23,42,0.03)] border',
                  own
                    ? 'bg-slate-900 border-slate-950 text-white rounded-br-none'
                    : 'bg-white border-slate-200 text-[#0F172A] rounded-bl-none'
                )}>
                  {!own && (
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-700">
                        {msg.sender?.fullName || 'User'}
                      </span>
                      <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded border tracking-wider uppercase', roleInfo.bg)}>
                        {roleInfo.label}
                      </span>
                    </div>
                  )}

                  <p className="text-xs leading-relaxed whitespace-pre-wrap break-words font-body">
                    {msg.content}
                  </p>

                  <p className={cn(
                    'text-[9px] mt-1 text-right font-headline',
                    own ? 'text-white/60' : 'text-slate-400'
                  )}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>

                {own && (
                  <div className="shrink-0 w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center font-headline font-semibold text-[12px] text-white mt-1 shadow-sm">
                    {user?.fullName?.charAt(0) || 'Y'}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Form */}
      <div className="px-4 py-3 border-t border-slate-200 bg-white flex items-end gap-2 shrink-0">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Discuss in workspace..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/30 font-body"
        />

        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className={cn(
            'p-2.5 rounded-full transition-colors shrink-0',
            text.trim()
              ? 'bg-slate-900 text-white hover:bg-slate-800'
              : 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'
          )}
          aria-label="Send Message"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
