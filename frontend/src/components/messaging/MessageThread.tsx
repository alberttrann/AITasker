import { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import { useSocket } from '@/hooks/use-socket';
import { useMessages, useProjectMessages, useSendMessage } from '@/hooks/use-messages';
import { useAuthStore } from '@/store/auth.store';
import { useEngagementStore } from '@/store/engagement.store';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Send, X } from 'lucide-react';

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

export default function MessageThread({ engagementId, projectId }: { engagementId?: string; projectId?: string }) {
  const socket = useSocket();
  const sendMessage = useSendMessage();
  const user = useAuthStore(s => s.user);
  const activeRole = useAuthStore(s => s.activeRole);
  const { setActiveEngagement, clearUnread } = useEngagementStore();
  const queryClient = useQueryClient();

  const [text, setText] = useState('');
  const [selectedUser, setSelectedUser] = useState<{ fullName: string; email: string; activeRole: string } | null>(null);

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
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: engData, isLoading: engLoading } = useMessages(engagementId);
  const { data: projData, isLoading: projLoading } = useProjectMessages(projectId);
  const fetchedMessages = engagementId ? engData : projData;
  const isLoading = engagementId ? engLoading : projLoading;

  const scopeId = engagementId || projectId;

  // Thực hiện đọc tin nhắn realtime khi mở hội thoại [5]
  useEffect(() => {
    if (!engagementId) return;

    apiClient.post(`/conversations/${engagementId}/read`)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      })
      .catch(err => console.error("Error marking messages as read:", err));
  }, [engagementId, queryClient]);

  useEffect(() => {
    if (!socket || !scopeId) return;

    const payload = engagementId ? { engagementId } : { projectId };
    socket.emit('joinRoom', payload);

    if (engagementId) {
      setActiveEngagement(engagementId);
      clearUnread(engagementId);
    }

    return () => {
      if (engagementId) {
        setActiveEngagement(null);
      }
    };
  }, [socket, scopeId, engagementId, projectId, setActiveEngagement, clearUnread]);

  useEffect(() => {
    if (!fetchedMessages) return;
    const fetched = Array.isArray(fetchedMessages)
      ? fetchedMessages
      : (fetchedMessages as any)?.data ?? [];
    dispatch({ type: 'MERGE_FETCHED', messages: fetched });
  }, [fetchedMessages]);

  useEffect(() => {
    if (!socket) return;

    const handler = (msg: Message) => {
      const belongsToThisThread = engagementId
        ? msg.engagementId === engagementId
        : msg.projectId === projectId;

      if (!belongsToThisThread) return;

      dispatch({ type: 'APPEND', message: msg });

      if (engagementId && msg.senderId !== user?.id) {
        apiClient.post(`/conversations/${engagementId}/read`)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
          })
          .catch(err => console.error("Error auto-reading message:", err));
      }
    };

    socket.on('newMessage', handler);
    return () => { socket.off('newMessage', handler); };
  }, [socket, engagementId, projectId, user, queryClient]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [localMessages, scrollToBottom]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!scopeId) return;

    const payload: any = { content: trimmed };
    if (engagementId) {
      payload.engagement_id = engagementId;
    } else if (projectId) {
      payload.project_id = projectId;
    }

    sendMessage(payload);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOwnMessage = (senderId: string) => senderId === user?.id;

  // Cải tiến format hiển thị đầy đủ ngày giờ khi xem chi tiết tin nhắn cũ [5]
  const formatTime = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    if (msgDate.getTime() === today.getTime()) {
      return timeStr;
    } else if (msgDate.getTime() === yesterday.getTime()) {
      return `Yesterday, ${timeStr}`;
    } else {
      const dateStr = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      return `${dateStr}, ${timeStr}`;
    }
  };

  if (!scopeId) {
    return (
      <div className='flex flex-col items-center justify-center h-full text-center p-6 bg-[#F8FAFC]'>
        <div className='w-16 h-16 bg-[#E2E8F0] rounded-full flex items-center justify-center mb-4 text-[#94A3B8]'>
          <Send size={28} />
        </div>
        <h3 className='font-headline text-[16px] font-semibold text-[#64748B]'>Select a conversation</h3>
        <p className='text-[13px] text-[#94A3B8] mt-1 max-w-xs'>
          Choose a conversation from the left pane to start messaging.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-full bg-[#F8FAFC]'>
        <Spinner size='lg' />
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full overflow-hidden bg-white'>
      <div className='flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#F8FAFC]'>
        {localMessages.map((msg) => {
          const own = isOwnMessage(msg.senderId);

          return (
            <div key={msg.id} className={cn('flex gap-2', own ? 'justify-end' : 'justify-start')}>
              {!own && (
                <div
                  onClick={() => setSelectedUser({
                    fullName: msg.sender?.fullName || 'User',
                    email: msg.sender?.email || 'N/A',
                    activeRole: msg.sender?.activeRole || 'CLIENT'
                  })}
                  className='shrink-0 w-8 h-8 rounded-full bg-[#0F172A]/10 flex items-center justify-center font-headline font-semibold text-[12px] text-[#0F172A] mt-1 cursor-pointer hover:opacity-80 transition-opacity'
                >
                  {msg.sender?.fullName?.charAt(0) || '?'}
                </div>
              )}

              <div className={cn(
                'max-w-[75%] rounded-2xl px-4 py-2.5 shadow-[0px_1px_3px_rgba(15,23,42,0.03)]',
                own
                  ? 'bg-[#059669] text-white rounded-br-md'
                  : 'bg-white border border-[#E2E8F0] text-[#0F172A] rounded-bl-md'
              )}>
                {!own && msg.sender?.fullName && (
                  <p className='text-[11px] font-bold text-[#059669] mb-0.5'>
                    {msg.sender.fullName}
                  </p>
                )}

                {msg.content && (
                  <p className='text-[14px] leading-relaxed whitespace-pre-wrap break-words font-body'>
                    {msg.content}
                  </p>
                )}

                <p className={cn(
                  'text-[10px] mt-1 text-right font-headline',
                  own ? 'text-white/60' : 'text-[#94A3B8]'
                )}>
                  {formatTime(msg.timestamp)}
                </p>
              </div>

              {own && (
                <div
                  onClick={() => setSelectedUser({
                    fullName: user?.fullName || 'Me',
                    email: user?.email || 'N/A',
                    activeRole: activeRole || 'CEO'
                  })}
                  className='shrink-0 w-8 h-8 rounded-full bg-[#059669] flex items-center justify-center font-headline font-semibold text-[12px] text-white mt-1 cursor-pointer hover:opacity-80 transition-opacity'
                >
                  {user?.fullName?.charAt(0) || 'Y'}
                </div>
              )}
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      <div className='px-4 py-3 border-t border-[#E2E8F0] bg-white flex items-end gap-2 shrink-0'>
        <div className='flex-1 relative'>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Type a message...'
            rows={1}
            className='w-full resize-none rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-[14px] text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/30 font-body'
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className={cn(
            'p-2.5 rounded-full transition-colors shrink-0',
            text.trim()
              ? 'bg-[#059669] text-white hover:bg-[#047857]'
              : 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
          )}
        >
          <Send size={18} />
        </button>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl border border-[#E2E8F0] relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-[#F1F5F9] text-[#64748B] transition-colors"
            >
              <X size={18} />
            </button>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#0F172A]/10 text-[#0F172A] flex items-center justify-center rounded-full text-2xl font-bold mx-auto mb-4 font-headline">
                {selectedUser.fullName.charAt(0)}
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] font-headline">{selectedUser.fullName}</h3>
              <span className="inline-block px-2.5 py-0.5 mt-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#059669]/10 text-[#059669]">
                {selectedUser.activeRole}
              </span>

              <div className="mt-6 border-t border-[#F1F5F9] pt-4 text-left space-y-3">
                <div>
                  <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider block font-headline">Email Address</span>
                  <span className="text-[14px] text-[#0F172A] font-body font-medium">{selectedUser.email}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider block font-headline">System Role</span>
                  <span className="text-[14px] text-[#0F172A] font-body font-medium">{selectedUser.activeRole}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}