import React, { useState, useEffect, useRef } from 'react';
import { 
  useMilestoneChatSessions, 
  useMilestoneChatHistory, 
  useSendMilestoneMessage, 
  useUpdateMilestone, 
  useProject,
  useUpdateProjectMilestones
} from '@/hooks/use-projects';
import { useEngagementMilestones } from '@/hooks/use-engagements';
import { Button } from '@/components/ui/button';
import { Loader2, Send, MessageSquare, Bot, CheckCircle2, X } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useToastActions } from '@/lib/toast-context';

interface MilestoneChatAssistantProps {
  projectId: string;
  engagementId?: string;
  currentMilestones?: any[];
  onApplyLocalEdit?: (newMilestones: any[]) => void; 
}

// Top-level criteria parser
const parseCriteria = (raw: any) => {
  if (!Array.isArray(raw)) return [];
  return raw.map((c: any) => {
    if (typeof c === 'string') return { criterion_text: c, is_required: true };
    return {
      criterion_text: c.criterion_text || c.criterionText || '',
      is_required: c.is_required !== undefined ? c.is_required : (c.isRequired ?? true)
    };
  });
};

export default function MilestoneChatAssistant({ 
  projectId, 
  engagementId, 
  currentMilestones, 
  onApplyLocalEdit 
}: MilestoneChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [currentEdit, setCurrentEdit] = useState<any | null>(null);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const toast = useToastActions();
  
  const { data: sessions } = useMilestoneChatSessions(projectId);
  const { data: activeSession } = useMilestoneChatHistory(projectId, activeSessionId);
  const { data: project } = useProject(projectId);
  const { data: engagementMilestones } = useEngagementMilestones(engagementId);
  
  const sendMessage = useSendMilestoneMessage();
  const updateMilestone = useUpdateMilestone();
  const updateProjectMilestones = useUpdateProjectMilestones();
  const activeRole = useAuthStore(s => s.activeRole);
  const isExpert = activeRole === 'EXPERT';

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMessages = (activeSession?.messagesJson as any[]) ?? [];
  const messagesToRender = [
    ...chatMessages,
    ...(pendingUserMessage ? [{ role: 'user', content: pendingUserMessage }] : [])
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesToRender.length, sendMessage.isPending]);

  useEffect(() => {
    if (activeSession?.messagesJson && pendingUserMessage) {
      const messages = activeSession.messagesJson as any[];
      const hasMsg = messages.some(
        (m: any) => m.role === 'user' && m.content === pendingUserMessage
      );
      if (hasMsg) setPendingUserMessage(null);
    }
  }, [activeSession?.messagesJson, pendingUserMessage]);

  useEffect(() => {
    if (sendMessage.isError) setPendingUserMessage(null);
  }, [sendMessage.isError]);

  useEffect(() => {
    if (sessions && sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    
    setPendingUserMessage(inputText);
    sendMessage.mutate(
      { 
        projectId, 
        message: inputText, 
        chatSessionId: activeSessionId || undefined, 
        currentMilestones 
      },
      {
        onSuccess: (data) => {
          if (!activeSessionId && data.chatSessionId) {
            setActiveSessionId(data.chatSessionId);
          }
          setCurrentEdit(data.suggestedEdit || null);
        },
        onError: () => setPendingUserMessage(null)
      }
    );
    setInputText("");
  };

  const handleCopyEdit = () => {
    if (!currentEdit) return;
    const textToCopy = JSON.stringify(currentEdit.suggested_value, null, 2);
    navigator.clipboard.writeText(textToCopy);
    toast.success("Copied to clipboard! You can paste this in your bid counter-offer.");
    setCurrentEdit(null);
  };

  const handleApplyEdit = () => {
    if (!currentEdit || !currentEdit.milestone_number) return;

    const targetMilestoneNum = Number(currentEdit.milestone_number);

    const fieldMap: Record<string, string> = {
      paymentAmountVnd: 'payment_amount_vnd',
      payment_amount_vnd: 'payment_amount_vnd',
      deliverableStatement: 'deliverable_statement',
      deliverable_statement: 'deliverable_statement',
      estimatedCostVnd: 'estimated_cost_vnd',
      estimated_cost_vnd: 'estimated_cost_vnd',
      estimatedDurationDays: 'estimated_duration_days',
      estimated_duration_days: 'estimated_duration_days',
    };

    const targetField = fieldMap[currentEdit.field] || currentEdit.field;
    const isFullObject = targetField === 'milestone' && typeof currentEdit.suggested_value === 'object';

    // SCENARIO 1: Local state edit mode
    if (onApplyLocalEdit && currentMilestones) {
      const updatedFramework = [...currentMilestones];
      const targetIndex = updatedFramework.findIndex(
        (m: any) => Number(m.milestone_number || m.milestoneNumber) === targetMilestoneNum
      );

      if (targetIndex !== -1) {
        if (isFullObject) {
          const suggestedObj = currentEdit.suggested_value;
          const mappedObj: Record<string, any> = {};
          Object.keys(suggestedObj).forEach(k => {
            const cleanKey = fieldMap[k] || k;
            mappedObj[cleanKey] = suggestedObj[k];
          });
          updatedFramework[targetIndex] = { ...updatedFramework[targetIndex], ...mappedObj };
        } else {
          updatedFramework[targetIndex] = {
            ...updatedFramework[targetIndex],
            [targetField]: currentEdit.suggested_value
          };
        }
        onApplyLocalEdit(updatedFramework);
        setCurrentEdit(null);
        toast.success("Edit applied to draft.");
        return;
      }
    }

    // SCENARIO 2: Live Engagement DB update
    if (engagementMilestones && engagementMilestones.length > 0) {
      const targetMilestone = engagementMilestones.find(
        (m: any) => Number(m.milestoneNumber) === targetMilestoneNum || Number(m.milestone_number) === targetMilestoneNum
      );
      if (!targetMilestone) {
        toast.error("Could not find the target milestone.");
        return;
      }

      const payload = isFullObject ? currentEdit.suggested_value : { [targetField]: currentEdit.suggested_value };
      const cleanPayload: Record<string, any> = {};
      Object.keys(payload).forEach(k => {
        const cleanKey = fieldMap[k] || k;
        if (cleanKey === 'sign_off_authority' || cleanKey === 'signOffAuthority') return;
        if (cleanKey === 'milestone_number' || cleanKey === 'milestoneNumber') return;

        if (k === 'criteria' || k === 'acceptanceCriteria' || k === 'acceptance_criteria') {
          cleanPayload['criteria'] = parseCriteria(payload[k]);
          return;
        }

        cleanPayload[cleanKey] = payload[k];
      });

      if (!cleanPayload.criteria && (payload.criteria || payload.acceptanceCriteria || payload.acceptance_criteria)) {
         cleanPayload.criteria = parseCriteria(payload.criteria || payload.acceptanceCriteria || payload.acceptance_criteria);
      }

      updateMilestone.mutate({ id: targetMilestone.id, payload: cleanPayload }, {
        onSuccess: () => {
          setCurrentEdit(null);
          toast.success("Milestone updated.");
        }
      });
      return;
    } 

    // SCENARIO 3: Published Project Blueprint DB update
    if (project) {
      const framework = project.milestone_framework_json || (project as any).milestone_framework_json || [];
      const updatedFramework = [...framework];
      const targetIndex = updatedFramework.findIndex(
        (m: any) => Number(m.milestone_number || m.milestoneNumber) === targetMilestoneNum
      );

      if (targetIndex !== -1) {
        if (isFullObject) {
          const suggestedObj = currentEdit.suggested_value;
          const mappedObj: Record<string, any> = {};
          Object.keys(suggestedObj).forEach(k => {
            const cleanKey = fieldMap[k] || k;
            mappedObj[cleanKey] = suggestedObj[k];
          });
          updatedFramework[targetIndex] = { ...updatedFramework[targetIndex], ...mappedObj };
        } else {
          updatedFramework[targetIndex] = { ...updatedFramework[targetIndex], [targetField]: currentEdit.suggested_value };
        }

        const cleanMilestones = updatedFramework.map((m: any) => {
          const parsedCriteria = parseCriteria(m.criteria || m.acceptanceCriteria || m.acceptance_criteria);
          
          return {
            milestone_number: Number(m.milestone_number || m.milestoneNumber),
            deliverable_statement: m.deliverable_statement || m.deliverableStatement || '',
            // Fallback 0 to 1 VND to bypass the backend @Min(1) draft constraint cleanly
            payment_amount_vnd: Math.max(1, Number(m.payment_amount_vnd ?? m.paymentAmountVnd ?? 1)), 
            estimated_duration_days: Number(m.estimated_duration_days ?? m.estimatedDurationDays ?? 0),
            tech_stack: m.tech_stack || m.techStack || [],
            // CRITICAL: Only include the criteria key if we actually have items, satisfying @ArrayMinSize(1)
            ...(parsedCriteria.length > 0 ? { criteria: parsedCriteria } : {})
          };
        });

        updateProjectMilestones.mutate({ id: projectId, milestones: cleanMilestones }, {
          onSuccess: () => {
            setCurrentEdit(null);
            toast.success("Blueprint updated.");
          }
        });
      }
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-emerald-600 text-white rounded-full shadow-xl hover:bg-emerald-700 hover:-translate-y-1 transition-all z-50 flex items-center justify-center group cursor-pointer"
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
        <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 flex flex-col gap-4">
        {messagesToRender.length ? (
          messagesToRender.map((msg: any, idx: number) => (
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
                  <span className="font-bold text-slate-800">→ {typeof currentEdit.suggested_value === 'object' ? '{...}' : String(currentEdit.suggested_value)}</span>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentEdit(null)}>
                    Dismiss
                  </Button>
                  {isExpert ? (
                    <Button variant="primary" size="sm" onClick={handleCopyEdit}>
                      Copy Suggestion
                    </Button>
                  ) : (
                    <Button 
                      variant="primary" 
                      size="sm" 
                      onClick={handleApplyEdit} 
                      disabled={updateMilestone.isPending || updateProjectMilestones.isPending}
                    >
                      {updateMilestone.isPending || updateProjectMilestones.isPending ? 'Applying...' : 'Apply Edit'}
                    </Button>
                  )}
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
            className="rounded-xl h-[46px] px-4 cursor-pointer"
          >
            {sendMessage.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}