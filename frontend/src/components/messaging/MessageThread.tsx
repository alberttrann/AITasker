import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMessages, useSendMessage, useConversations } from '@/hooks/use-messages';
import { useSocket } from '@/hooks/use-socket';
import { useAuth } from '@/hooks/use-auth';
import { useEngagement } from '@/hooks/use-engagements';
import { useEngagementStore } from '@store/engagement.store';
import ChatSidebar from '@/components/messaging/ChatSidebar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/Spinner';
import { Send, MessageSquare, ChevronDown, Check, Hash, FolderKanban } from 'lucide-react';

export default function MessageThread() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const navigate = useNavigate();
  const socket = useSocket();
  const { user } = useAuth();
  
  const setActiveEngagement = useEngagementStore((s) => s.setActiveEngagement);
  const clearUnread = useEngagementStore((s) => s.clearUnread);
  const unreadCounts = useEngagementStore((s) => s.unreadCounts);

  const { data: engagement, isLoading: isLoadingEngagement } = useEngagement(engagementId);
  const { data: historyResponse, isLoading: isLoadingMessages } = useMessages(engagementId);
  const { data: conversationsResponse } = useConversations();
  const sendMessage = useSendMessage();

  const [text, setText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isDropdownOpen]);

  // Sync active engagement context and clear unread count for this thread
  useEffect(() => {
    if (engagementId) {
      setActiveEngagement(engagementId);
      clearUnread(engagementId);
    }
    return () => {
      setActiveEngagement(null);
    };
  }, [engagementId, setActiveEngagement, clearUnread]);

  // Initialize messages list when history loads
  useEffect(() => {
    if (historyResponse?.data) {
      setMessages(historyResponse.data);
    } else if (Array.isArray(historyResponse)) {
      setMessages(historyResponse);
    }
  }, [historyResponse]);

  // Join socket room on mount/re-connect and listen for messages
  useEffect(() => {
    if (!socket || !engagementId) return;

    const join = () => {
      socket.emit('joinRoom', { engagementId });
      console.log(`[Socket] Joined chat room for engagement: ${engagementId}`);
    };

    // If socket is already connected, join immediately
    if (socket.connected) {
      join();
    }

    // Join room again if the socket disconnects and reconnects under the hood
    socket.on('connect', join);

    // Listen for new incoming messages
    const handleNewMessage = (msg: any) => {
      setMessages((prev) => {
        // 1. If the message is already in the list (by real ID), do nothing
        if (prev.some((m) => m.id === msg.id)) return prev;

        // 2. If the message was sent by the current user, replace the corresponding optimistic/temporary message
        const isMyMessage = msg.senderId === user?.id || msg.sender?.id === user?.id;
        if (isMyMessage) {
          const tempIndex = prev.findIndex((m) => m.id.toString().startsWith('temp-'));
          if (tempIndex !== -1) {
            const updated = [...prev];
            updated[tempIndex] = msg; // Swap the temporary message with the real server-confirmed one
            return updated;
          }
        }

        // 3. Otherwise, it is a new message from the peer; append it
        return [...prev, msg];
      });
    };

    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('connect', join);
      socket.off('newMessage', handleNewMessage);
    };
  }, [socket, engagementId, user?.id]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !engagementId) return;

    // Build immediate message placeholder for smooth UX
    const localMsg = {
      id: `temp-${Date.now()}`,
      content: text,
      senderId: user?.id,
      sender: {
        id: user?.id,
        fullName: user?.fullName || 'You',
      },
      timestamp: new Date().toISOString(),
    };

    // Optimistically update message state
    setMessages((prev) => [...prev, localMsg]);

    // Send via socket hook
    sendMessage({
      engagement_id: engagementId,
      content: text,
    });

    setText('');
  };

  if (isLoadingEngagement || isLoadingMessages) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!engagement) {
    return (
      <div className="w-full max-w-[500px] mx-auto py-16 px-6 text-center space-y-6">
        <h2 className="text-xl font-bold text-slate-900">Workspace Not Found</h2>
        <p className="text-slate-500 text-sm">
          We could not load this conversation. It may have been archived or deleted.
        </p>
        <Button onClick={() => navigate(-1)} className="w-full justify-center">
          Go Back
        </Button>
      </div>
    );
  }

  // Determine participant labels and route
  const isClient = user?.activeRole === 'CLIENT' || user?.activeRole?.startsWith('CLIENT');
  const dashboardRoute = isClient ? '/ceo' : '/expert';
  const allConversations = conversationsResponse?.data || [];
  const currentConv = allConversations.find((c: any) => c.id === engagementId);

  const currentPartnerId =
    currentConv?.otherParty?.id ||
    currentConv?.partnerId ||
    (isClient ? (engagement as any).expert?.id : (engagement as any).client?.id) ||
    (engagement as any).otherParty?.id;

  const peerName =
    currentConv?.otherParty?.fullName ||
    currentConv?.partnerName ||
    (isClient
      ? (engagement as any).expert?.fullName || (engagement as any).otherParty?.fullName || 'Expert'
      : (engagement as any).client?.fullName || (engagement as any).otherParty?.fullName || 'Client');

  // Find all available threads between current user and this partner
  const partnerEngagements = allConversations.filter((c: any) =>
    (currentPartnerId && (c.otherParty?.id === currentPartnerId || c.partnerId === currentPartnerId)) ||
    (peerName && peerName !== 'Expert' && peerName !== 'Client' && (c.otherParty?.fullName === peerName || c.partnerName === peerName)) ||
    c.id === engagementId
  );

  return (
    <div className="w-full max-w-[1440px] px-6 mx-auto py-6 flex h-[calc(100vh-140px)] min-h-[600px] bg-transparent border-0 gap-6 overflow-hidden">
      {/* Left panel: Conversations List */}
      <ChatSidebar activeEngagementId={engagementId} />

      {/* Right panel: Active chat window */}
      <div className="flex-1 bg-white border border-slate-200/80 rounded-2xl shadow-sm flex flex-col min-w-0 h-full p-4 sm:p-6 overflow-hidden">
        {/* 1. Header Toolbar */}
        <div className="flex flex-row items-center justify-between pb-4 border-b border-slate-200/80 shrink-0 gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-none">{peerName}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Milestones Workspace Button */}
            {engagement && (engagement.milestones?.length > 0 || !!engagement.projectId) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isClient) {
                    navigate(`/ceo/engagements/${engagementId}/milestones`);
                  } else {
                    const milestones = engagement.milestones || [];
                    const activeMilestone = milestones.find((m: any) => m.state !== 'RELEASED' && m.state !== 'APPROVED') || milestones[0];
                    if (activeMilestone) {
                      navigate(`/expert/engagements/${engagementId}/milestones/${activeMilestone.id}`);
                    } else {
                      alert("No milestones defined yet.");
                    }
                  }
                }}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 flex items-center gap-1.5 transition-all shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <FolderKanban size={14} className="text-slate-500" />
                <span>Workspace</span>
              </Button>
            )}

            {/* Thread Dropdown */}
            {partnerEngagements.length > 0 && (
              <div className="relative flex items-center gap-2 shrink-0" ref={dropdownRef}>
                <span className="text-xs font-semibold text-slate-400 hidden sm:inline">Thread:</span>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between gap-2 transition-all shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-900 max-w-[280px]"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Hash size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate">
                      {partnerEngagements.find((e: any) => e.id === engagementId)?.projectName || 'Direct Chat'}
                    </span>
                  </div>
                  {/* Red dot indicator on trigger if any other thread has new messages */}
                  {partnerEngagements.some((eng: any) => eng.id !== engagementId && (unreadCounts[eng.id] ?? eng.unreadCount ?? 0) > 0) && (
                    <span className="relative flex h-2 w-2 shrink-0 ml-1" title="New messages in another thread">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    className={`text-slate-400 shrink-0 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-[280px] sm:w-[320px] bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 py-1.5 overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <span>Select Thread ({partnerEngagements.length})</span>
                    </div>
                    <div className="max-h-[260px] overflow-y-auto divide-y divide-slate-100/60">
                      {partnerEngagements.map((eng: any) => {
                        const isSelected = eng.id === engagementId;
                        const count = unreadCounts[eng.id] ?? eng.unreadCount ?? 0;
                        const hasNew = !isSelected && count > 0;

                        return (
                          <button
                            key={eng.id}
                            type="button"
                            onClick={() => {
                              setIsDropdownOpen(false);
                              if (eng.id !== engagementId) {
                                navigate(`${dashboardRoute}/engagements/${eng.id}/messages`);
                              }
                            }}
                            className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                              isSelected
                                ? 'bg-primary/5 text-primary font-bold'
                                : hasNew
                                ? 'bg-red-50/40 hover:bg-red-50/70 text-slate-900 font-semibold'
                                : 'hover:bg-slate-50 text-slate-700 font-medium'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <Hash
                                size={15}
                                className={`mt-0.5 shrink-0 ${isSelected ? 'text-primary' : hasNew ? 'text-red-500' : 'text-slate-400'}`}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs truncate">
                                  {eng.projectName || 'Direct Chat'}
                                </p>
                                {eng.lastMessage?.content && (
                                  <p className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-primary/70' : hasNew ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                                    {eng.lastMessage.content}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5">
                              {hasNew && count > 0 && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] text-center shrink-0" title={`${count} new messages`}>
                                  {count}
                                </span>
                              )}
                              {isSelected && (
                                <Check size={16} className="text-primary shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2. Message Thread Body */}
        <div className="flex-grow overflow-y-auto py-4 pr-2 space-y-3 bg-transparent">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-3">
              <MessageSquare size={36} className="text-slate-300" />
              <h3 className="text-sm font-bold text-slate-800">No Messages Yet</h3>
              <p className="text-xs text-slate-400 max-w-[280px]">
                Start the discussion! Type your questions, coordinate milestones, or align on scopes below.
              </p>
            </div>
          ) : (
            messages.map((msg: any) => {
              const isMe = msg.senderId === user?.id || msg.sender?.id === user?.id;
              const senderInitial = msg.sender?.fullName ? msg.sender.fullName.charAt(0).toUpperCase() : '?';

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2.5 max-w-[75%] w-fit ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                >
                  {/* Incoming Avatar bubble - hide for outcoming messages */}
                  {!isMe && (
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0 shadow-sm mb-1">
                      {senderInitial}
                    </div>
                  )}

                  {/* Message Bubble wrapper */}
                  <div className={`space-y-1 min-w-0 max-w-full ${isMe ? 'flex flex-col items-end' : 'flex flex-col items-start'}`}>
                    <div
                      className={`w-fit max-w-full p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                        isMe
                          ? 'bg-emerald-600 text-white rounded-br-none'
                          : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/60'
                      }`}
                    >
                      <p className="break-words whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    {/* Timestamp */}
                    <p className={`text-[10px] text-slate-400 font-medium ${isMe ? 'text-right' : 'text-left'}`}>
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={scrollRef} />
        </div>

        {/* 3. Send Input Form */}
        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 pt-3 border-t border-slate-200/80 shrink-0"
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Message ${peerName}...`}
            className="flex-1 px-4 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all text-slate-800 shadow-sm"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!text.trim()}
            className="p-2.5 rounded-xl shrink-0 h-10 w-10 justify-center items-center shadow-sm"
            aria-label="Send message"
          >
            <Send size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
}

