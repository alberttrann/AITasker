import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMessages, useSendMessage } from '@/hooks/use-messages';
import { useSocket } from '@/hooks/use-socket';
import { useAuth } from '@/hooks/use-auth';
import { useEngagement } from '@/hooks/use-engagements';
import { useEngagementStore } from '@store/engagement.store';
import ChatSidebar from '@/components/messaging/ChatSidebar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ArrowLeft, Send, ShieldCheck, Clock, User, Info, MessageSquare } from 'lucide-react';
import { formatVND } from '@/lib/utils';

export default function MessageThread() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const navigate = useNavigate();
  const socket = useSocket();
  const { user } = useAuth();
  
  const setActiveEngagement = useEngagementStore((s) => s.setActiveEngagement);
  const clearUnread = useEngagementStore((s) => s.clearUnread);

  const { data: engagement, isLoading: isLoadingEngagement } = useEngagement(engagementId);
  const { data: historyResponse, isLoading: isLoadingMessages } = useMessages(engagementId);
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

  // Determine participant labels
  const isClient = user?.activeRole === 'CLIENT';
  const peerName = isClient
    ? (engagement as any).expert?.fullName || 'Expert Partner'
    : (engagement as any).client?.fullName || 'Client Partner';

  return (
    <div className="w-full max-w-[1024px] px-4 sm:px-6 mx-auto py-6 flex h-[calc(100vh-140px)] min-h-[500px] border border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Left panel: Conversations List */}
      <ChatSidebar activeEngagementId={engagementId} />

      {/* Right panel: Active chat window */}
      <div className="flex-1 bg-slate-50/10 flex flex-col min-w-0 h-full">
        {/* 1. Header Toolbar */}
        <div className="flex flex-row items-center justify-between border-b border-slate-100 bg-white p-4 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900"
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-none mb-1">{peerName}</h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Online workspace chat</span>
              </div>
            </div>
          </div>

          {/* Small Order Details Panel */}
          <div className="hidden sm:flex flex-row items-center gap-4 text-xs border-l border-slate-100 pl-4">
            <div>
              <span className="text-slate-400 font-medium">Agreement Type:</span>
              <span className="ml-1 font-semibold text-slate-700 uppercase tracking-wide">
                {engagement.type === 'SERVICE_PURCHASE' ? 'Service Order' : 'Project Connection'}
              </span>
            </div>
            <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-100 font-medium">
              <ShieldCheck size={12} />
              <span>Escrow Protected</span>
            </div>
          </div>
        </div>

        {/* 2. Message Thread Body */}
        <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/40">
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
                  className={`flex gap-3 max-w-[80%] ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                >
                  {/* Avatar bubble */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm ${
                      isMe ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {senderInitial}
                  </div>

                  {/* Message Bubble wrapper */}
                  <div className="space-y-1">
                    <div
                      className={`p-3 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? 'bg-slate-900 text-white rounded-tr-none'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                      }`}
                    >
                      <p className="break-words whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    {/* Timestamp */}
                    <p className={`text-[10px] text-slate-400 ${isMe ? 'text-right' : 'text-left'}`}>
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
          className="flex items-center gap-2 p-3 bg-white border-t border-slate-100 shrink-0"
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Message ${peerName}...`}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all text-slate-800"
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
