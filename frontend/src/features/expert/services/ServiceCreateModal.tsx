import React, { useState } from 'react';
import { useCreateService, useUpdateService } from '@/hooks/use-services';
import { useNavigate } from 'react-router-dom';
import { useDomains, useSeams } from '@/hooks/use-config';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Loader2, DollarSign, Clock, Tags, X, Send, Wand2, CheckCircle, ChevronDown } from 'lucide-react';

export interface ServiceCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function parseArrayOrString(input: string): string[] {
  if (!input) return [];
  let clean = input.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
  }
  
  // Try standard JSON parse
  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) {
      return parsed.map(x => String(x).replace(/^- /, '').replace(/^• /, '').trim()).filter(Boolean);
    }
  } catch {}

  // Try python style array ['a', 'b']
  if (clean.startsWith("['") && clean.endsWith("']")) {
    try {
      const converted = clean.replace(/^\['/, '["').replace(/'\]$/, '"]').replace(/', \s*'/g, '", "').replace(/','/g, '","');
      const parsed = JSON.parse(converted);
      if (Array.isArray(parsed)) {
        return parsed.map(x => String(x).replace(/^- /, '').replace(/^• /, '').trim()).filter(Boolean);
      }
    } catch {}
  }

  // Regex extract quoted array elements if it looks like a list [ ... ]
  if (clean.startsWith('[') && clean.endsWith(']')) {
    const items: string[] = [];
    const regex = /(?:["'])(.*?)(?:["'])(?:,\s*|$)/g;
    let m;
    while ((m = regex.exec(clean)) !== null) {
      if (m[1].trim()) items.push(m[1].replace(/^- /, '').replace(/^• /, '').trim());
    }
    if (items.length > 0) return items;
  }

  // Otherwise split by newlines
  return clean.split('\n').map(s => s.replace(/^- /, '').replace(/^• /, '').trim()).filter(Boolean);
}

export function ServiceCreateModal({ isOpen, onClose }: ServiceCreateModalProps) {
  const createService = useCreateService();
  const updateService = useUpdateService();
  const { user } = useAuth();
  const navigate = useNavigate();

  // State
  const [draftId, setDraftId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scopeItems, setScopeItems] = useState<string[]>(['']);
  const [timelinePhases, setTimelinePhases] = useState<{name: string, duration: string}[]>([{ name: '', duration: '' }]);
  const [timelineTotal, setTimelineTotal] = useState('');
  const [priceVnd, setPriceVnd] = useState<number | undefined>(undefined);

  const [isAiMode, setIsAiMode] = useState(false);
  const [aiCapabilities, setAiCapabilities] = useState('');
  const [targetUseCases, setTargetUseCases] = useState('');

  // Warning Modal State
  const [showWarning, setShowWarning] = useState(false);

  const getMergedScope = () => {
    const items = scopeItems.filter(s => s.trim() !== '');
    if (items.length === 0) return '';
    return JSON.stringify(items);
  };
  
  const getMergedTimeline = () => {
    const phasesStr = timelinePhases.filter(p => p.name.trim() || p.duration.trim()).map((p, i) => `Phase ${i + 1}: ${p.name.trim()}${p.duration.trim() ? ` (${p.duration.trim()})` : ''}`).join('\n');
    let totalStr = timelineTotal.trim() ? `\nTotal Estimated Time: ${timelineTotal.trim()}` : '';
    return `${phasesStr}${totalStr}`.trim();
  };

  const handleCloseAttempt = () => {
    if (title.trim() || description.trim() || priceVnd || getMergedTimeline()) {
      setShowWarning(true);
    } else {
      resetAndClose();
    }
  };

  const resetAndClose = () => {
    setTitle('');
    setDescription('');
    setScopeItems(['']);
    setTimelinePhases([{ name: '', duration: '' }]);
    setTimelineTotal('');
    setPriceVnd(undefined);
    setAiCapabilities('');
    setTargetUseCases('');

    setIsAiMode(false);
    setShowWarning(false);
    setDraftId(null);
    onClose();
  };

  const handleCreate = () => {
    if (isAiMode) {
      createService.mutate({
        serviceType: 'AI_SERVICE',
        useAiGenerator: true,
        capabilities: aiCapabilities.split('\n').filter(s => s.trim() !== ''),
        targetUseCases: targetUseCases.split('\n').filter(s => s.trim() !== ''),
        priceVnd: priceVnd || undefined,
        timeline: getMergedTimeline() || undefined
      }, {
        onSuccess: (data) => {
          if (data && data.id) {
            setDraftId(data.id);
            setTitle(data.title || '');
            setDescription(data.description || '');
            
            // Parse scope robustly
            const parsedScope = parseArrayOrString(data.scope || '');
            setScopeItems(parsedScope.length > 0 ? parsedScope : ['']);

            // Parse timeline robustly
            const timelineLines = parseArrayOrString(data.timeline || '');
            const phases: any[] = [];
            let totalTime = '';
            timelineLines.forEach(line => {
              if (line.toLowerCase().includes('total')) {
                totalTime = line.replace(/total( estimated time| time| duration)?:?/i, '').replace(/^- /, '').trim();
              } else {
                const phaseMatch = line.match(/Phase\s*\d+:\s*(.*?)(?:\s*\((.*?)\))?$/i) || line.match(/^(.*?)(?:\s*\((.*?)\))?$/i);
                if (phaseMatch && phaseMatch[1]) {
                  phases.push({ name: phaseMatch[1].trim(), duration: phaseMatch[2] ? phaseMatch[2].trim() : '' });
                } else {
                  phases.push({ name: line, duration: '' });
                }
              }
            });
            setTimelinePhases(phases.length > 0 ? phases : [{ name: '', duration: '' }]);
            setTimelineTotal(totalTime);
            
            // Price might come as string or number from backend, convert safely
            setPriceVnd(data.priceVnd ? Number(data.priceVnd) : undefined);

            setIsAiMode(false); // Switch to manual mode to review
          } else {
            resetAndClose();
          }
        }
      });
    } else {
      if (draftId) {
        const updatePayload = {
          title: title || 'Service Listing', // Fallback title
          description,
          scope: getMergedScope(),
          timeline: getMergedTimeline(),
          priceVnd: priceVnd || undefined
        };
        updateService.mutate({ id: draftId, payload: updatePayload }, {
          onSuccess: (data) => {
            resetAndClose();
            if (data && data.id) {
              navigate(`/expert/service/${data.id}`);
            }
          }
        });
      } else {
        const createPayload = {
          serviceType: 'AI_SERVICE',
          useAiGenerator: false,
          title: title || 'Service Listing', // Fallback title
          description,
          scope: getMergedScope(),
          timeline: getMergedTimeline(),
          priceVnd: priceVnd || undefined
        };
        createService.mutate(createPayload, {
          onSuccess: (data) => {
            resetAndClose();
            if (data && data.id) {
              navigate(`/expert/service/${data.id}`);
            }
          }
        });
      }
    }
  };

  return (
    <>
      <Modal 
        isOpen={isOpen} 
        onClose={handleCloseAttempt} 
        title="Create Service"
        className="w-full max-w-2xl sm:max-w-2xl sm:w-[600px] p-0"
      >
        <div className="flex flex-col h-full max-h-[85vh] overflow-hidden -m-6 rounded-[12px]">
          {/* Header: User Info */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-white shrink-0">
            <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-headline font-semibold text-base">
              {user?.fullName?.charAt(0) || 'E'}
            </div>
            <div>
              <div className="font-headline font-semibold text-[#0F172A] leading-tight">{user?.fullName || 'Expert'}</div>
              <div className="font-body text-[13px] text-[#64748B]">Publishing a new service to the marketplace</div>
            </div>
          </div>

          {/* Body: Inputs */}
          <div className="p-6 bg-white overflow-y-auto flex-grow font-body">
            {isAiMode ? (
              <div className="animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-2 mb-4 text-slate-600 bg-slate-50 border border-slate-200 p-3 rounded-[8px]">
                  <Wand2 className="w-5 h-5 shrink-0" />
                  <p className="text-sm font-semibold">AI will generate a professional title, description, and suggested pricing based on your capabilities.</p>
                </div>
                <textarea 
                   placeholder="What are your core capabilities? (e.g. 'I build RAG systems with LangChain and Pinecone')"
                   className="w-full min-h-[80px] text-[16px] text-[#0F172A] placeholder-[#94A3B8] outline-none resize-none bg-transparent leading-[1.6] border-b border-slate-100 mb-4 pb-2"
                   value={aiCapabilities} 
                   onChange={e => setAiCapabilities(e.target.value)}
                   autoFocus
                />
                <textarea 
                   placeholder="Target use cases? (e.g. 'Customer support chatbots for e-commerce')"
                   className="w-full min-h-[80px] text-[16px] text-[#0F172A] placeholder-[#94A3B8] outline-none resize-none bg-transparent leading-[1.6]"
                   value={targetUseCases} 
                   onChange={e => setTargetUseCases(e.target.value)}
                />
                <div className="mt-1 mb-2">
                  <button 
                    onClick={() => setIsAiMode(false)}
                    className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <X size={14} />
                    <span>Return to Manual Mode</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in duration-200">
                <div className="mb-4 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-800 text-lg">
                    {draftId ? 'Review Generated Draft' : ''}
                  </h3>
                  <button 
                    onClick={() => setIsAiMode(true)}
                    className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 hover:text-slate-900 transition-colors bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200"
                  >
                    <Wand2 size={14} />
                    <span>Auto-generate with AI</span>
                  </button>
                </div>

                <input 
                   type="text" 
                   placeholder="Service Title..." 
                   className="w-full text-[20px] font-headline font-semibold text-[#0F172A] placeholder-[#94A3B8] outline-none mb-4 bg-transparent"
                   value={title} 
                   onChange={e => setTitle(e.target.value)}
                />
                <textarea 
                   placeholder="What service are you offering? Detail your process, deliverables, and value here..."
                   className="w-full min-h-[120px] text-[16px] text-[#334155] placeholder-[#94A3B8] outline-none resize-none bg-transparent leading-[1.6] mb-2"
                   value={description} 
                   onChange={e => setDescription(e.target.value)}
                />
                
                <div className="mb-6 relative">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Scope of Work</h4>
                  <div className="flex flex-col gap-2">
                    {scopeItems.map((item, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <span className="text-emerald-500 font-bold mt-1">•</span>
                        <input 
                          value={item} 
                          onChange={e => { const newItems = [...scopeItems]; newItems[i] = e.target.value; setScopeItems(newItems); }} 
                          placeholder={`Deliverable ${i + 1}`}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[14px] text-slate-700 outline-none focus:bg-white transition-colors"
                        />
                        {scopeItems.length > 1 && (
                           <button onClick={() => setScopeItems(scopeItems.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-rose-500"><X size={16}/></button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => setScopeItems([...scopeItems, ''])} className="text-sm text-emerald-600 font-semibold self-start hover:text-emerald-700 mt-1">+ Add Deliverable</button>
                  </div>
                </div>

                
                <div className="flex gap-4 mb-6">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Price (VND)</h4>
                    <div className="px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-200 focus-within:bg-white transition-colors h-[46px] flex items-center">
                      <CurrencyInput 
                        placeholder="e.g. 5.000.000" 
                        className="bg-transparent border-none outline-none text-[#0F172A] placeholder:text-[#94A3B8] font-semibold w-full font-body text-[14px]"
                        value={priceVnd}
                        onChange={(val) => setPriceVnd(val)}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Estimated Timeline</h4>
                    <div className="flex flex-col gap-2">
                      {timelinePhases.map((phase, i) => (
                        <div key={i} className="flex gap-2 items-center bg-slate-50 border border-slate-200 rounded-lg p-2 focus-within:bg-white transition-colors">
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider w-14 shrink-0">Phase {i + 1}</div>
                          <input 
                            value={phase.name} 
                            onChange={e => { const newPhases = [...timelinePhases]; newPhases[i].name = e.target.value; setTimelinePhases(newPhases); }} 
                            placeholder="e.g. Discovery"
                            className="flex-1 bg-transparent border-none text-[13px] text-slate-700 outline-none min-w-0"
                          />
                          <input 
                            value={phase.duration} 
                            onChange={e => { const newPhases = [...timelinePhases]; newPhases[i].duration = e.target.value; setTimelinePhases(newPhases); }} 
                            placeholder="e.g. 1 week"
                            className="w-20 shrink-0 bg-transparent border-l border-slate-200 pl-2 text-[13px] outline-none text-slate-600 placeholder:text-slate-400"
                          />
                          {timelinePhases.length > 1 && (
                             <button onClick={() => setTimelinePhases(timelinePhases.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-rose-500 shrink-0"><X size={14}/></button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => setTimelinePhases([...timelinePhases, {name: '', duration: ''}])} className="text-sm text-emerald-600 font-semibold self-start hover:text-emerald-700">+ Add Phase</button>
                      
                      <div className="mt-1 flex gap-2 items-center bg-slate-50 border border-slate-200 rounded-lg p-2 focus-within:bg-white transition-colors">
                        <div className="text-[12px] font-bold text-slate-700 w-16 shrink-0">Total Time:</div>
                        <input 
                          value={timelineTotal} 
                          onChange={e => setTimelineTotal(e.target.value)} 
                          placeholder="e.g. 3-4 Weeks"
                          className="flex-1 bg-transparent border-none text-[13px] text-slate-700 outline-none min-w-0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer: Actions */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0 rounded-b-[12px]">
            <div className="flex flex-col items-end gap-2">
              <Button 
                variant="primary"
                className="font-headline font-semibold px-6 py-2 rounded-[8px] transition-all flex items-center gap-2"
                disabled={isAiMode ? (!aiCapabilities || !targetUseCases) : (!title && !description) || createService.isPending || updateService.isPending}
                onClick={handleCreate}
              >
                {(createService.isPending || updateService.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : (isAiMode ? <Wand2 className="w-4 h-4" /> : <Send className="w-4 h-4" />)}
                {(createService.isPending || updateService.isPending) ? 'Working...' : (isAiMode ? 'Generate Draft' : 'Save & Preview')}
              </Button>
              {(createService.isError || updateService.isError) && (
                <p className="text-red-500 text-sm font-semibold max-w-sm text-right">
                  {((createService.error || updateService.error) as any)?.response?.data?.message || 'An error occurred. Please try again.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={showWarning}
        onClose={() => setShowWarning(false)}
        onConfirm={resetAndClose}
        title="Discard Post?"
        confirmText="Discard"
        cancelText="Keep Editing"
        isDestructive={true}
      >
        You have entered text for this service listing. If you close this window, your changes will be lost. Are you sure you want to discard this post?
      </ConfirmModal>
    </>
  );
}
