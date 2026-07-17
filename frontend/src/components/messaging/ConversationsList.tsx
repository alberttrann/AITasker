import React from 'react';
import ChatSidebar from './ChatSidebar';
import { MessageCircle } from 'lucide-react';

export default function ConversationsList() {
  return (
    <div className="w-full max-w-[1024px] px-4 sm:px-6 mx-auto py-6 flex h-[calc(100vh-140px)] min-h-[500px] border border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden select-none">
      {/* Conversations List Left Panel */}
      <ChatSidebar activeEngagementId={null} />

      {/* Empty State Right Panel */}
      <div className="flex-1 bg-slate-50/50 flex flex-col items-center justify-center p-8 text-center space-y-3">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 border border-slate-200 shadow-inner">
          <MessageCircle size={28} />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h3 className="text-sm font-bold text-slate-800">Select a Conversation</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Choose a contact from the sidebar list to view messages, coordinate milestones, or discuss project details in real-time.
          </p>
        </div>
      </div>
    </div>
  );
}
export { ConversationsList };
