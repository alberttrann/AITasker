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
import { Send, MessageSquare } from 'lucide-react';

export default function MessageThread() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const navigate = useNavigate();
  const socket = useSocket();
  const { user } = useAuth();
  
  const setActiveEngagement = useEngagementStore((s) => s.setActiveEngagement);
  const clearUnread = useEngagementStore((s) => s.clearUnread);

  const { data: engagement, isLoading: isLoadingEngagement } = useEngagement(engagementId);
  const { data: historyResponse, isLoading: isLoadingMessages } = useMessages(engagementId);
  const { data: conversationsResponse } = useConversations();
  const sendMessage = useSendMessage();

  const [text, setText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

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

          {/* Thread Dropdown */}
          {partnerEngagements.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-slate-400 hidden sm:inline">Thread:</span>
              <select
                value={engagementId || ''}
                onChange={(e) => {
                  if (e.target.value && e.target.value !== engagementId) {
                    navigate(`${dashboardRoute}/engagements/${e.target.value}/messages`);
                  }
                }}
                className="px-3 py-1.5 bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all cursor-pointer max-w-[280px] truncate shadow-sm"
              >
                {partnerEngagements.map((eng: any) => (
                  <option key={eng.id} value={eng.id}>
                    {eng.projectName || 'Direct Chat'}
                  </option>
                ))}
              </select>
            </div>
          )}
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

