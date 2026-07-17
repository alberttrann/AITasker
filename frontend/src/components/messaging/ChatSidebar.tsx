import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useConversations } from '@/hooks/use-messages';
import { useAuth } from '@/hooks/use-auth';
import { Search, MessageSquare } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';

interface ChatSidebarProps {
  activeEngagementId?: string | null;
}

export default function ChatSidebar({ activeEngagementId }: ChatSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { data: conversationsResponse, isLoading } = useConversations();
  const [searchTerm, setSearchTerm] = useState('');

  const conversations = conversationsResponse?.data || [];

  // Determine correct base path (/ceo or /expert) based on active role
  const isClient = user?.activeRole === 'CLIENT' || user?.activeRole?.startsWith('CLIENT');
  const dashboardRoute = isClient ? '/ceo' : '/expert';

  // Filter conversations by contact name or project title
  const filteredConversations = conversations.filter((conv: any) => {
    const name = conv.otherParty?.fullName || 'Partner';
    const project = conv.projectName || '';
    return (
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="w-full md:w-80 border-r border-slate-200 bg-white flex flex-col h-full shrink-0">
      {/* Search Header */}
      <div className="p-4 border-b border-slate-100 flex flex-col gap-3 shrink-0">
        <h2 className="text-lg font-bold text-slate-900">Direct Messages</h2>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all text-slate-800"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400">
            <Spinner size="md" />
            <span className="text-xs">Loading conversations...</span>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 gap-2 h-48">
            <MessageSquare size={28} className="text-slate-300" />
            <p className="text-sm font-semibold">No active chats</p>
            <p className="text-xs max-w-[200px]">
              {searchTerm ? 'No results match your search.' : 'Your messaging inbox is empty.'}
            </p>
          </div>
        ) : (
          filteredConversations.map((conv: any) => {
            const isSelected = activeEngagementId === conv.id;
            const hasUnread = conv.unreadCount > 0;
            const otherPartyName = conv.otherParty?.fullName || 'Partner';
            const lastMsgContent = conv.lastMessage?.content 
              ? (conv.lastMessage.content.length > 50 
                  ? conv.lastMessage.content.substring(0, 50) + '...' 
                  : conv.lastMessage.content)
              : 'No messages yet';

            const timeStr = conv.lastMessage?.timestamp 
              ? new Date(conv.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
              : '';

            return (
              <div
                key={conv.id}
                onClick={() => navigate(`${dashboardRoute}/engagements/${conv.id}/messages`)}
                className={`p-4 cursor-pointer transition-all flex gap-3 select-none ${
                  isSelected 
                    ? 'bg-slate-900 text-white hover:bg-slate-900' 
                    : 'bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                {/* Avatar Bubble */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 border transition-colors shadow-sm ${
                  isSelected 
                    ? 'bg-slate-800 text-white border-slate-700' 
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  {otherPartyName.charAt(0).toUpperCase()}
                </div>

                {/* Text Metadata */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className={`text-sm truncate ${
                      isSelected 
                        ? 'font-bold text-white' 
                        : hasUnread 
                        ? 'font-bold text-slate-900' 
                        : 'font-semibold text-slate-700'
                    }`}>
                      {otherPartyName}
                    </span>
                    {timeStr && (
                      <span className={`text-[10px] shrink-0 ml-2 ${
                        isSelected ? 'text-slate-400' : 'text-slate-400 font-medium'
                      }`}>
                        {timeStr}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs truncate mb-0.5 ${
                    isSelected ? 'text-slate-300' : 'text-slate-400 font-medium'
                  }`}>
                    {conv.projectName}
                  </p>
                  <p className={`text-xs truncate ${
                    isSelected 
                      ? 'text-slate-400' 
                      : hasUnread 
                      ? 'text-slate-900 font-bold' 
                      : 'text-slate-500'
                  }`}>
                    {lastMsgContent}
                  </p>
                </div>

                {/* Red/Green Unread dot */}
                {hasUnread && !isSelected && (
                  <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0 self-center shadow-sm" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
