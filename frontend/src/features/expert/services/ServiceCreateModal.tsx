import React, { useState } from 'react';
import { useCreateService } from '@/hooks/use-services';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Loader2, DollarSign, Clock, Tags, X, Send, Wand2 } from 'lucide-react';
import { DomainCode, SeamCode } from '@/types/api.types';

export interface ServiceCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ServiceCreateModal({ isOpen, onClose }: ServiceCreateModalProps) {
  const createService = useCreateService();
  const { user } = useAuth();

  // State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeline, setTimeline] = useState('');
  const [priceVnd, setPriceVnd] = useState('');
  
  // Show/Hide specific inputs
  const [showPriceInput, setShowPriceInput] = useState(false);
  const [showTimelineInput, setShowTimelineInput] = useState(false);
  const [isAiMode, setIsAiMode] = useState(false);
  const [aiCapabilities, setAiCapabilities] = useState('');
  const [targetUseCases, setTargetUseCases] = useState('');

  const [domainsJson, setDomainsJson] = useState<DomainCode[]>([]);
  const [seamsJson, setSeamsJson] = useState<SeamCode[]>([]);

  // Warning Modal State
  const [showWarning, setShowWarning] = useState(false);

  const handleCloseAttempt = () => {
    if (title.trim() || description.trim() || priceVnd || timeline) {
      setShowWarning(true);
    } else {
      resetAndClose();
    }
  };

  const resetAndClose = () => {
    setTitle('');
    setDescription('');
    setTimeline('');
    setPriceVnd('');
    setAiCapabilities('');
    setTargetUseCases('');
    setIsAiMode(false);
    setShowPriceInput(false);
    setShowTimelineInput(false);
    setShowWarning(false);
    onClose();
  };

  const handleCreate = () => {
    if (isAiMode) {
      createService.mutate({
        serviceType: 'AI_SERVICE',
        useAiGenerator: true,
        capabilities: aiCapabilities.split('\n').filter(s => s.trim() !== ''),
        targetUseCases: targetUseCases.split('\n').filter(s => s.trim() !== ''),
        priceVnd: priceVnd ? parseInt(priceVnd) : undefined,
        timeline: timeline || undefined
      }, {
        onSuccess: () => resetAndClose()
      });
    } else {
      createService.mutate({
        serviceType: 'AI_SERVICE',
        useAiGenerator: false,
        title: title || 'Service Listing', // Fallback title
        description,
        timeline,
        priceVnd: priceVnd ? parseInt(priceVnd) : undefined,
        domainsJson,
        seamsJson
      }, {
        onSuccess: () => resetAndClose()
      });
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
                <input 
                   type="text" 
                   placeholder="Service Title..." 
                   className="w-full text-[20px] font-headline font-semibold text-[#0F172A] placeholder-[#94A3B8] outline-none mb-4 bg-transparent"
                   value={title} 
                   onChange={e => setTitle(e.target.value)}
                />
                <textarea 
                   placeholder="What service are you offering? Detail your process, deliverables, and value here..."
                   className="w-full min-h-[120px] text-[16px] text-[#334155] placeholder-[#94A3B8] outline-none resize-none bg-transparent leading-[1.6]"
                   value={description} 
                   onChange={e => setDescription(e.target.value)}
                />
                
                <div className="mt-1 mb-2">
                  <button 
                    onClick={() => setIsAiMode(true)}
                    className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <Wand2 size={14} />
                    <span>Auto-generate with AI</span>
                  </button>
                </div>
                
                {/* Active Add-ons */}
                <div className="flex flex-wrap gap-2 mt-4">
                   {priceVnd ? (
                     <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2">
                       <span>{(parseInt(priceVnd)).toLocaleString('vi-VN')} ₫</span>
                       <button onClick={() => {setPriceVnd(''); setShowPriceInput(false);}} className="hover:text-emerald-900"><X size={14}/></button>
                     </div>
                   ) : null}
                   {timeline ? (
                     <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2">
                       <Clock size={14}/> {timeline}
                       <button onClick={() => {setTimeline(''); setShowTimelineInput(false);}} className="hover:text-blue-900"><X size={14}/></button>
                     </div>
                   ) : null}
                </div>
              </div>
            )}

            {/* Interactive Pop-in Inputs */}
            {showPriceInput && !priceVnd && (
              <div className="mt-4 p-3 bg-slate-50 rounded-[8px] flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
                <DollarSign className="text-slate-500" size={18} />
                <input 
                  type="number" 
                  placeholder="Enter price in VND" 
                  className="bg-transparent border-none outline-none text-[#0F172A] placeholder:text-[#94A3B8] font-semibold w-full font-body text-[14px]"
                  autoFocus
                  onBlur={(e) => {
                    if (e.target.value) setPriceVnd(e.target.value);
                    else setShowPriceInput(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setPriceVnd(e.currentTarget.value);
                    }
                  }}
                />
              </div>
            )}

            {showTimelineInput && !timeline && (
              <div className="mt-4 p-3 bg-slate-50 rounded-[8px] flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
                <Clock className="text-slate-500" size={18} />
                <input 
                  type="text" 
                  placeholder="e.g. 2-4 Weeks" 
                  className="bg-transparent border-none outline-none text-[#0F172A] placeholder:text-[#94A3B8] font-semibold w-full font-body text-[14px]"
                  autoFocus
                  onBlur={(e) => {
                    if (e.target.value) setTimeline(e.target.value);
                    else setShowTimelineInput(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setTimeline(e.currentTarget.value);
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Footer: Actions */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0 rounded-b-[12px]">
            <div className="flex gap-2 font-body">
              <span className="text-[14px] font-semibold text-[#64748B] mr-1 sm:mr-2 flex items-center hidden sm:flex">Add:</span>
              <button 
                onClick={() => setShowPriceInput(true)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors flex items-center gap-2 text-[#334155] bg-white shadow-sm border border-slate-200"
                title="Add Price"
              >
                 <DollarSign size={18} strokeWidth={2} />
              </button>
              <button 
                onClick={() => setShowTimelineInput(true)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors flex items-center gap-2 text-[#334155] bg-white shadow-sm border border-slate-200"
                title="Add Timeline"
              >
                 <Clock size={18} strokeWidth={2} />
              </button>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <Button 
                variant="primary"
                className="font-headline font-semibold px-6 py-2 rounded-[8px] transition-all flex items-center gap-2"
                disabled={isAiMode ? (!aiCapabilities || !targetUseCases) : (!title && !description) || createService.isPending}
                onClick={handleCreate}
              >
                {createService.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isAiMode ? <Wand2 className="w-4 h-4" /> : <Send className="w-4 h-4" />)}
                {createService.isPending ? 'Working...' : (isAiMode ? 'Generate Draft' : 'Post Service')}
              </Button>
              {createService.isError && (
                <p className="text-red-500 text-sm font-semibold max-w-sm text-right">
                  {(createService.error as any)?.response?.data?.message || 'An error occurred. Please try again.'}
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
