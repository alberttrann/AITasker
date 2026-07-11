import React, { useState, useEffect, useRef } from 'react';
import { useMilestoneChatSessions, useMilestoneChatHistory, useSendMilestoneMessage, useUpdateMilestone, useProjectMilestones } from '@/hooks/use-projects';
import { Button } from '@/components/ui/Button';
import { Loader2, Send, MessageSquare, Bot, User, CheckCircle2, AlertTriangle, ChevronRight, Menu, X } from 'lucide-react';

interface MilestoneChatAssistantProps {
  projectId: string;
}

export default function MilestoneChatAssistant({ projectId }: MilestoneChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [currentEdit, setCurrentEdit] = useState<any | null>(null);
  
  const { data: sessions, isLoading: isLoadingSessions } = useMilestoneChatSessions(projectId);
  const { data: activeSession, isLoading: isLoadingHistory } = useMilestoneChatHistory(projectId, activeSessionId);
  const { data: projectMilestones } = useProjectMilestones(projectId);
  const sendMessage = useSendMilestoneMessage();
  const updateMilestone = useUpdateMilestone();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messagesJson, sendMessage.isPending]);

  // When sessions load, if none is selected, select the first one or leave empty for a new chat
  useEffect(() => {
    if (sessions && sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    
    sendMessage.mutate(
      { projectId, message: inputText, chatSessionId: activeSessionId || undefined },
      {
        onSuccess: (data) => {
          if (!activeSessionId && data.chatSessionId) {
            setActiveSessionId(data.chatSessionId);
          }
          if (data.suggestedEdit) {
            setCurrentEdit(data.suggestedEdit);
          } else {
            setCurrentEdit(null);
          }
        }
      }
    );
    setInputText("");
  };

  const handleApplyEdit = () => {
    if (!currentEdit || !currentEdit.milestone_number || !projectMilestones) return;
    
    // Find the milestone by its 1-based number
    const targetMilestone = projectMilestones.find((m: any) => m.milestoneNumber === currentEdit.milestone_number || m.milestone_number === currentEdit.milestone_number);
    if (!targetMilestone) return;

    // The API uses snake_case keys (e.g. payment_amount_vnd), but field might be camelCase. Map safely.
    const fieldMap: Record<string, string> = {
      paymentAmountVnd: 'payment_amount_vnd',
      estimatedDurationDays: 'estimated_duration_days',
      deliverableStatement: 'deliverable_statement'
    };

    const targetField = fieldMap[currentEdit.field] || currentEdit.field;

    updateMilestone.mutate({
      id: targetMilestone.id,
      payload: {
        [targetField]: currentEdit.suggested_value
      }
    }, {
      onSuccess: () => {
        setCurrentEdit(null);
      }
    });
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-emerald-600 text-white rounded-full shadow-xl hover:bg-emerald-700 hover:-translate-y-1 transition-all z-50 flex items-center justify-center group"
      >
        <Bot className="w-6 h-6 mr-0 group-hover:mr-2 transition-all" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all whitespace-nowrap font-medium text-sm">
          Milestone Assistant
        </span>
      </button>
    );
  }

  return (
    <div className="fixed top-0 right-0 h-screen w-full sm:w-[400px] md:w-[450px] bg-white shadow-2xl border-l border-slate-200 flex flex-col z-50 animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">AI Assistant</h3>
            <p className="text-xs text-slate-500">Milestone Planning & Budgets</p>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body: Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 flex flex-col gap-4">
        {activeSession?.messagesJson?.length ? (
          activeSession.messagesJson.map((msg: any, idx: number) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex-shrink-0 flex items-center justify-center mt-1">
                  <Bot className="w-4 h-4 text-emerald-600" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl p-3 text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'}`}>
                {msg.content}
              </div>
            </div>
          ))
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <MessageSquare className="w-12 h-12 text-slate-300 mb-4" />
            <h4 className="font-semibold text-slate-700 mb-2">How can I help you?</h4>
            <p className="text-sm text-slate-500">
              Ask me to adjust a milestone's budget, change its duration, or explain why I grouped certain tasks together.
            </p>
          </div>
        )}

        {currentEdit && (
          <div className="mx-6 my-2 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-emerald-900 mb-1">
                  Suggested Edit for Milestone {currentEdit.milestone_number}
                </h4>
                <p className="text-xs text-emerald-700 mb-3">{currentEdit.reason}</p>
                <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-emerald-100 text-sm mb-3">
                  <span className="text-slate-500 font-mono">{currentEdit.field}</span>
                  <span className="font-bold text-slate-800">→ {String(currentEdit.suggested_value)}</span>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentEdit(null)}>
                    Dismiss
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleApplyEdit} disabled={updateMilestone.isPending}>
                    {updateMilestone.isPending ? 'Applying...' : 'Apply Edit'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {sendMessage.isPending && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex-shrink-0 flex items-center justify-center mt-1">
              <Bot className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-4 shadow-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask AI to adjust a milestone..."
            className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            disabled={sendMessage.isPending}
          />
          <Button 
            variant="primary" 
            onClick={handleSend}
            disabled={!inputText.trim() || sendMessage.isPending}
            className="rounded-xl h-[46px] px-4"
          >
            {sendMessage.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
