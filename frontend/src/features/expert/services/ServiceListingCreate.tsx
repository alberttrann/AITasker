import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateService } from '@/hooks/use-services';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/Button';
import { Loader2, DollarSign, Clock, Tags, X, ArrowLeft, Send } from 'lucide-react';
import { DomainCode, SeamCode } from '@/types/api.types';

export default function ServiceListingCreate() {
  const navigate = useNavigate();
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

  const [domainsJson, setDomainsJson] = useState<DomainCode[]>([]);
  const [seamsJson, setSeamsJson] = useState<SeamCode[]>([]);

  const handleCreate = () => {
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
      onSuccess: () => {
        navigate('/expert'); // Navigate to the dashboard where the services are
      }
    });
  };

  return (
    <div className="w-full max-w-2xl px-6 mx-auto py-12">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Create Service</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header: User Info */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-lg">
            {user?.fullName?.charAt(0) || 'E'}
          </div>
          <div>
            <div className="font-bold text-slate-900">{user?.fullName || 'Expert'}</div>
            <div className="text-xs text-slate-500 font-medium">Publishing a new service to the marketplace</div>
          </div>
        </div>

        {/* Body: Inputs */}
        <div className="p-6">
          <input 
             type="text" 
             placeholder="Service Title..." 
             className="w-full text-xl font-bold text-slate-900 placeholder:text-slate-300 outline-none mb-3"
             value={title} 
             onChange={e => setTitle(e.target.value)}
          />
          <textarea 
             placeholder="What service are you offering? Detail your process, deliverables, and value here..."
             className="w-full min-h-[150px] text-lg text-slate-700 placeholder:text-slate-300 outline-none resize-none"
             value={description} 
             onChange={e => setDescription(e.target.value)}
          />
          
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

          {/* Interactive Pop-in Inputs */}
          {showPriceInput && !priceVnd && (
            <div className="mt-4 p-3 bg-emerald-50 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
              <DollarSign className="text-emerald-500" size={18} />
              <input 
                type="number" 
                placeholder="Enter price in VND" 
                className="bg-transparent border-none outline-none text-emerald-900 placeholder:text-emerald-300 font-bold w-full"
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
            <div className="mt-4 p-3 bg-blue-50 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
              <Clock className="text-blue-500" size={18} />
              <input 
                type="text" 
                placeholder="e.g. 2-4 Weeks" 
                className="bg-transparent border-none outline-none text-blue-900 placeholder:text-blue-300 font-bold w-full"
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
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="flex gap-2">
            <span className="text-sm font-bold text-slate-400 mr-2 flex items-center">Add to your post:</span>
            <button 
              onClick={() => setShowPriceInput(true)}
              className="p-2 hover:bg-slate-200 rounded-full transition-colors flex items-center gap-2 text-emerald-500 bg-white shadow-sm border border-slate-200"
              title="Add Price"
            >
               <DollarSign size={18} strokeWidth={2.5} />
            </button>
            <button 
              onClick={() => setShowTimelineInput(true)}
              className="p-2 hover:bg-slate-200 rounded-full transition-colors flex items-center gap-2 text-blue-500 bg-white shadow-sm border border-slate-200"
              title="Add Timeline"
            >
               <Clock size={18} strokeWidth={2.5} />
            </button>
            <button 
              className="p-2 hover:bg-slate-200 rounded-full transition-colors flex items-center gap-2 text-blue-500 bg-white shadow-sm border border-slate-200 cursor-not-allowed opacity-50"
              title="Add Tags (Coming soon)"
            >
               <Tags size={18} strokeWidth={2.5} />
            </button>
          </div>
          
          <Button 
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded-full transition-all flex items-center gap-2"
            disabled={(!title && !description) || createService.isPending}
            onClick={handleCreate}
          >
            {createService.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
            {createService.isPending ? 'Posting...' : 'Post Service'}
          </Button>
        </div>
      </div>
    </div>
  );
}
