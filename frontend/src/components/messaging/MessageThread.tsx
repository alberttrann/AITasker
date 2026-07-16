import { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import { useSocket } from '@/hooks/use-socket';
import { useMessages, useProjectMessages, useSendMessage } from '@/hooks/use-messages';
import { useAuthStore } from '@/store/auth.store';
import { useEngagementStore } from '@/store/engagement.store';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Paperclip, Send, FileText, X } from 'lucide-react';

interface MessageThreadProps {
  engagementId?: string;
  projectId?: string;
}

interface Message {
  id: string;
  content: string;
  timestamp: string;
  senderId: string;
  engagementId?: string;
  projectId?: string;
  attachmentUrl?: string | null;
  sender: {
    id: string;
    email: string;
    fullName: string;
    activeRole: string;
  };
}

export default function MessageThread({ engagementId, projectId }: MessageThreadProps) {
  const socket = useSocket();
  const sendMessage = useSendMessage();
  const user = useAuthStore(s => s.user);
  const activeRole = useAuthStore(s => s.activeRole);
  const { setActiveEngagement, clearUnread } = useEngagementStore();
  const queryClient = useQueryClient();

  const [text, setText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // [FRONT-1] State kiểm soát thông tin liên hệ người dùng nhấp vào avatar
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: engData, isLoading: engLoading } = useMessages(engagementId);
  const { data: projData, isLoading: projLoading } = useProjectMessages(projectId);
  const fetchedMessages = engagementId ? engData : projData;
  const isLoading = engagementId ? engLoading : projLoading;

  const scopeId = engagementId || projectId;

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

    const payload = engagementId
      ? { engagementId }
      : { projectId };

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
  }, [socket, scopeId, engagementId, projectId, setActiveEngagement]);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setAttachmentName(file.name);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await apiClient.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = res?.data;
      setAttachmentUrl(data?.url || data?.attachment_url || null);
    } catch {
      setUploadError('Upload failed. Extension or file size limit exceeded.');
      setAttachmentUrl(null);
    } finally {
      setUploading(false);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearAttachment = () => {
    setAttachmentUrl(null);
    setAttachmentName('');
    setUploadError(null);
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && !attachmentUrl) return;
    if (!scopeId) return;

    const payload: any = { content: trimmed || '📎 Attachment' };
    if (engagementId) {
      payload.engagement_id = engagementId;
    } else if (projectId) {
      payload.project_id = projectId;
    }
    if (attachmentUrl) {
      payload.attachment_url = attachmentUrl;
    }

    sendMessage(payload);
    setText('');
    setAttachmentUrl(null);
    setAttachmentName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOwnMessage = (senderId: string) => senderId === user?.id;

  const isImageAttachment = (url: string) =>
    /\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(url) ||
    url.startsWith('data:image/');

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  if (!scopeId) {
    return (
      <div className='flex flex-col items-center justify-center h-full text-center p-6 bg-[#F8FAFC]'>
        <div className='w-16 h-16 bg-[#E2E8F0] rounded-full flex items-center justify-center mb-4 text-[#94A3B8]'>
          <Paperclip size={28} />
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
      {/* Messages area */}
      <div className='flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#F8FAFC]'>
        {localMessages.length === 0 && (
          <div className='flex flex-col items-center justify-center h-full text-center'>
            <div className='w-12 h-12 bg-[#E2E8F0] rounded-full flex items-center justify-center mb-3 text-[#94A3B8]'>
              <Paperclip size={20} />
            </div>
            <p className='text-[13px] text-[#94A3B8]'>No messages yet. Say hello!</p>
          </div>
        )}

        {localMessages.map((msg) => {
          const own = isOwnMessage(msg.senderId);
          const hasAttachment = !!msg.attachmentUrl;
          const isImage = hasAttachment && isImageAttachment(msg.attachmentUrl!);

          return (
            <div key={msg.id} className={cn('flex gap-2', own ? 'justify-end' : 'justify-start')}>
              {/* [FRONT-2] Nhấn vào Avatar của người khác gửi */}
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

                {hasAttachment && isImage && (
                  <a href={msg.attachmentUrl!} target='_blank' rel='noopener noreferrer' className='block mb-1 overflow-hidden rounded-lg'>
                    <img
                      src={msg.attachmentUrl!}
                      alt='attachment'
                      className='max-w-[240px] max-h-[200px] object-cover hover:scale-105 transition-transform duration-200'
                    />
                  </a>
                )}
                {hasAttachment && !isImage && (
                  <a
                    href={msg.attachmentUrl!}
                    target='_blank'
                    rel='noopener noreferrer'
                    className={cn(
                      'flex items-center gap-2 text-[13px] underline mb-1',
                      own ? 'text-white/90' : 'text-[#059669]'
                    )}
                  >
                    <FileText size={16} />
                    <span className='truncate max-w-[180px]'>
                      {msg.attachmentUrl!.split('/').pop() || 'Document'}
                    </span>
                  </a>
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

              {/* [FRONT-2] Nhấn vào Avatar của bản thân gửi */}
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

      {/* Progress & Error Preview Bar */}
      {(attachmentName || uploadError) && (
        <div className={cn(
          'px-4 py-2.5 border-t flex items-center gap-2 bg-white',
          uploadError ? 'border-[#EF4444]/30 bg-[#FEF2F2]' : 'border-[#E2E8F0] bg-[#F8FAFC]'
        )}>
          <div className='flex items-center gap-1.5 flex-1 min-w-0'>
            <span className={cn('text-[12px] truncate font-body', uploadError ? 'text-[#EF4444] font-medium' : 'text-[#64748B]')}>
              {uploading ? `Uploading: ${attachmentName}` : uploadError ? `Error: ${uploadError}` : attachmentName}
            </span>
          </div>
          <button
            onClick={clearAttachment}
            className={cn(
              'p-1.5 rounded-full transition-colors bg-white',
              uploadError ? 'hover:bg-[#FEE2E2] text-[#EF4444]' : 'hover:bg-[#E2E8F0] text-[#94A3B8]'
            )}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className='px-4 py-3 border-t border-[#E2E8F0] bg-white flex items-end gap-2 shrink-0'>
        <input
          ref={fileInputRef}
          type='file'
          className='hidden'
          onChange={handleFileSelect}
          accept='image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip'
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className='p-2.5 rounded-full hover:bg-[#F1F5F9] transition-colors text-[#64748B] disabled:opacity-40'
        >
          <Paperclip size={18} />
        </button>

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
          // [FRONT-4] Sửa lỗi nút Send bị chặn bằng việc cho phép gửi ngay khi có URL đính kèm
          disabled={!text.trim() && !attachmentUrl}
          className={cn(
            'p-2.5 rounded-full transition-colors shrink-0',
            (text.trim() || attachmentUrl)
              ? 'bg-[#059669] text-white hover:bg-[#047857]'
              : 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
          )}
        >
          <Send size={18} />
        </button>
      </div>

      {/* [FRONT-1] Modal thông tin chi tiết user nhấp vào Avatar */}
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