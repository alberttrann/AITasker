import React, { useState } from 'react';
import { useCreateService } from '@/hooks/use-services';
import { useDomains, useSeams } from '@/hooks/use-config';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Loader2, DollarSign, Clock, Tags, X, Send, Wand2, CheckCircle, ChevronDown } from 'lucide-react';
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
  const [scope, setScope] = useState('');
  const [timeline, setTimeline] = useState('');
  const [priceVnd, setPriceVnd] = useState<number | undefined>(undefined);

  const { data: domainsList } = useDomains();
  const { data: seamsList } = useSeams();
  
  const [showDomainsDropdown, setShowDomainsDropdown] = useState(false);
  const [showSeamsDropdown, setShowSeamsDropdown] = useState(false);
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
    setScope('');
    setTimeline('');
    setPriceVnd(undefined);
    setAiCapabilities('');
    setTargetUseCases('');
    setDomainsJson([]);
    setSeamsJson([]);
    setIsAiMode(false);
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
        priceVnd: priceVnd || undefined,
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
        scope,
        timeline,
        priceVnd: priceVnd || undefined,
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
                <div className="mb-4 flex justify-end">
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
                
                <textarea 
                   placeholder="Scope of work (What exactly is included?)"
                   className="w-full min-h-[80px] text-[15px] text-[#334155] placeholder-[#94A3B8] outline-none resize-none bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6"
                   value={scope} 
                   onChange={e => setScope(e.target.value)}
                />

                <div className="mb-6 relative">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Target Domains</h4>
                  <div 
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 flex flex-wrap gap-2 items-center cursor-pointer min-h-[46px] hover:bg-slate-100 transition-colors"
                    onClick={() => { setShowDomainsDropdown(!showDomainsDropdown); setShowSeamsDropdown(false); }}
                  >
                     {domainsJson.length === 0 ? <span className="text-slate-400 text-sm">Select Domains...</span> : null}
                     {domainsJson.map(d => {
                        const domain = domainsList?.find(x => x.code === d);
                        return (
                          <span key={d} className="px-2 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-md uppercase tracking-wider border border-slate-300 flex items-center gap-1">
                            {domain ? `${domain.code} - ${domain.name}` : d}
                            <button onClick={(e) => { e.stopPropagation(); setDomainsJson(prev => prev.filter(x => x !== d)); }} className="hover:text-slate-900"><X size={12} /></button>
                          </span>
                        )
                     })}
                     <ChevronDown size={16} className="text-slate-400 ml-auto" />
                  </div>
                  {showDomainsDropdown && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-[200px] overflow-y-auto p-1.5">
                       {(domainsList || []).map(d => {
                         const isSelected = domainsJson.includes(d.code);
                         return (
                           <div 
                             key={d.code} 
                             onClick={() => setDomainsJson(prev => isSelected ? prev.filter(c => c !== d.code) : [...prev, d.code])}
                             className={`p-2 rounded-md cursor-pointer text-sm flex items-center justify-between transition-colors ${isSelected ? 'bg-slate-100 text-slate-800 font-bold' : 'hover:bg-slate-50 text-slate-600 font-semibold'}`}
                           >
                              <span><span className="font-bold mr-2 text-slate-800">{d.code}</span> {d.name}</span>
                              {isSelected && <CheckCircle size={16} className="text-slate-700" />}
                           </div>
                         )
                       })}
                    </div>
                  )}
                </div>

                <div className="mb-4 relative">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Technical Seams</h4>
                  <div 
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 flex flex-wrap gap-2 items-center cursor-pointer min-h-[46px] hover:bg-slate-100 transition-colors"
                    onClick={() => { setShowSeamsDropdown(!showSeamsDropdown); setShowDomainsDropdown(false); }}
                  >
                     {seamsJson.length === 0 ? <span className="text-slate-400 text-sm">Select Seams...</span> : null}
                     {seamsJson.map(s => {
                        const seam = seamsList?.find(x => x.code === s);
                        return (
                          <span key={s} className="px-2 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-md uppercase tracking-wider border border-slate-300 flex items-center gap-1">
                            {seam ? `${seam.code} - ${seam.name}` : s}
                            <button onClick={(e) => { e.stopPropagation(); setSeamsJson(prev => prev.filter(x => x !== s)); }} className="hover:text-slate-900"><X size={12} /></button>
                          </span>
                        )
                     })}
                     <ChevronDown size={16} className="text-slate-400 ml-auto" />
                  </div>
                  {showSeamsDropdown && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-[200px] overflow-y-auto p-1.5">
                       {(seamsList || []).map(s => {
                         const isSelected = seamsJson.includes(s.code);
                         return (
                           <div 
                             key={s.code} 
                             onClick={() => setSeamsJson(prev => isSelected ? prev.filter(c => c !== s.code) : [...prev, s.code])}
                             className={`p-2 rounded-md cursor-pointer text-sm flex items-center justify-between transition-colors ${isSelected ? 'bg-slate-100 text-slate-800 font-bold' : 'hover:bg-slate-50 text-slate-600 font-semibold'}`}
                           >
                              <span><span className="font-bold mr-2 text-slate-800">{s.code}</span> {s.name}</span>
                              {isSelected && <CheckCircle size={16} className="text-slate-700" />}
                           </div>
                         )
                       })}
                    </div>
                  )}
                </div>
                
                <div className="flex gap-4 mb-6">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Price (VND)</h4>
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3 hover:bg-slate-100 transition-colors">
                      <DollarSign className="text-slate-400" size={18} />
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
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3 hover:bg-slate-100 transition-colors">
                      <Clock className="text-slate-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="e.g. 2-4 Weeks" 
                        className="bg-transparent border-none outline-none text-[#0F172A] placeholder:text-[#94A3B8] font-semibold w-full font-body text-[14px]"
                        value={timeline}
                        onChange={(e) => setTimeline(e.target.value)}
                      />
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
