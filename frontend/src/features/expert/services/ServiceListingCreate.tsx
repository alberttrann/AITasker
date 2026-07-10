import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateService } from '@/hooks/use-services';
import { Button } from '@/components/ui/Button';
import { Loader2, Wand2, PlusCircle, ArrowLeft } from 'lucide-react';

export default function ServiceListingCreate() {
  const navigate = useNavigate();
  const createService = useCreateService();

  const [mode, setMode] = useState<'AI' | 'MANUAL'>('AI');
  
  // AI Form State
  const [aiCapabilities, setAiCapabilities] = useState('');
  const [targetUseCases, setTargetUseCases] = useState('');
  
  // Manual Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState('');
  const [timeline, setTimeline] = useState('');
  const [priceVnd, setPriceVnd] = useState('');

  const [aiResult, setAiResult] = useState<any>(null);

  const handleCreate = () => {
    if (mode === 'AI') {
      createService.mutate({
        serviceType: 'AI_SERVICE',
        useAiGenerator: true,
        aiCapabilities,
        targetUseCases
      }, {
        onSuccess: (data) => {
          setAiResult(data);
        }
      });
    } else {
      createService.mutate({
        serviceType: 'AI_SERVICE',
        useAiGenerator: false,
        title,
        description,
        scope,
        timeline,
        priceVnd: priceVnd ? parseInt(priceVnd) : undefined,
        domainsJson: [],
        seamsJson: []
      }, {
        onSuccess: () => {
          navigate('/expert/service');
        }
      });
    }
  };

  return (
    <div className="w-full max-w-[1440px] px-6 mx-auto py-8">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-2">
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">Create New Service Listing</h1>
      </div>

      {!aiResult ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <div className="flex bg-slate-100 p-1 rounded-xl mb-8 w-fit">
                <button
                  onClick={() => setMode('AI')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    mode === 'AI' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Wand2 className="w-4 h-4" /> AI-Assisted
                </button>
                <button
                  onClick={() => setMode('MANUAL')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    mode === 'MANUAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" /> Manual Setup
                </button>
              </div>

              {mode === 'AI' ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Your Core Capabilities</label>
                    <textarea 
                      rows={4}
                      placeholder="e.g. Expert in Python, FastAPI, and RAG pipelines using Pinecone and LangChain."
                      className="w-full border border-slate-200 rounded-xl p-4 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none transition-all"
                      value={aiCapabilities}
                      onChange={e => setAiCapabilities(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Target Use Cases (Optional)</label>
                    <textarea 
                      rows={3}
                      placeholder="e.g. Enterprise document Q&A, Customer support bots"
                      className="w-full border border-slate-200 rounded-xl p-4 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none transition-all"
                      value={targetUseCases}
                      onChange={e => setTargetUseCases(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Service Title</label>
                    <input 
                      type="text"
                      className="w-full border border-slate-200 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                    <textarea 
                      rows={4}
                      className="w-full border border-slate-200 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Timeline</label>
                      <input 
                        type="text"
                        placeholder="e.g. 2-4 Weeks"
                        className="w-full border border-slate-200 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={timeline}
                        onChange={e => setTimeline(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Price (VND)</label>
                      <input 
                        type="number"
                        placeholder="e.g. 45000000"
                        className="w-full border border-slate-200 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={priceVnd}
                        onChange={e => setPriceVnd(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 flex justify-end">
                <Button 
                  onClick={handleCreate} 
                  disabled={createService.isPending}
                  className={`px-8 py-3 rounded-xl shadow-sm text-white font-bold transition-all ${
                    mode === 'AI' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {createService.isPending ? (
                    <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Generating...</>
                  ) : mode === 'AI' ? (
                    <><Wand2 className="w-5 h-5 mr-2" /> Generate Listing</>
                  ) : (
                    'Create Listing'
                  )}
                </Button>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-1">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
              <h3 className="font-bold text-slate-800 mb-4">Tips for a great listing</h3>
              <ul className="space-y-4 text-sm text-slate-600">
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                  <p>Be specific about the frameworks and tools you use.</p>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                  <p>Highlight the direct business value your service provides.</p>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                  <p>Include potential timeline and pricing ranges to manage client expectations.</p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto">
          <div className="bg-white border border-emerald-200 rounded-2xl p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Wand2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">AI Generated Your Listing!</h2>
            <p className="text-slate-600 mb-8">We've drafted a professional service listing based on your capabilities. You can review and edit it in your services dashboard.</p>
            
            <div className="bg-slate-50 rounded-xl p-6 text-left border border-slate-100 mb-8 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Title</h4>
                <p className="text-lg font-semibold text-slate-900">{aiResult.title}</p>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Pricing Rationale</h4>
                <p className="text-sm text-slate-700">{aiResult.pricingRationale || 'Based on market average for this complexity.'}</p>
              </div>
            </div>

            <Button 
              onClick={() => navigate('/expert/service')}
              className="bg-slate-900 text-white hover:bg-slate-800 px-8 py-3 rounded-xl"
            >
              Go to My Services
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
