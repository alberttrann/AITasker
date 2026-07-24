import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useEngagement } from '@/hooks/use-engagements';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ArrowLeft, MessageSquare, Copy, CheckCircle, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';
import { formatVND } from '@/lib/utils';

export default function ServicePurchase() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract payment details passed from ServiceDetail navigation state
  const state = location.state as {
    engagementId: string;
    vietqrUrl: string;
    vaNumber: string;
    price: number;
    title: string;
  } | null;

  const [copiedField, setCopiedField] = useState<'ACC' | 'REF' | null>(null);

  // Poll engagement details from API to check if state changes to ACTIVE
  const engagementId = state?.engagementId;
  const { data: engagement, refetch } = useEngagement(engagementId);

  useEffect(() => {
    if (!engagementId || !engagement) return;
    
    // Stop polling if the engagement is already ACTIVE or cancelled
    if (engagement.state !== 'PENDING') return;

    const interval = setInterval(() => {
      refetch();
    }, 5000);

    return () => clearInterval(interval);
  }, [engagementId, engagement, refetch]);

  // When payment is confirmed, redirect after a short delay
  useEffect(() => {
    if (engagement?.state === 'ACTIVE') {
      const delay = setTimeout(() => {
        navigate(`/ceo/engagements/${engagementId}/milestones`);
      }, 3500);
      return () => clearTimeout(delay);
    }
  }, [engagement?.state, engagementId, navigate]);

  if (!state) {
    return (
      <div className="w-full max-w-[500px] mx-auto py-16 px-6 text-center space-y-6">
        <AlertCircle size={48} className="text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Session Expired</h2>
        <p className="text-slate-500 text-sm">
          We couldn't retrieve the payment context. Please return to the marketplace to re-initiate your purchase.
        </p>
        <Button onClick={() => navigate('/ceo/marketplace')} className="w-full justify-center">
          Back to Marketplace
        </Button>
      </div>
    );
  }

  const handleCopy = (text: string, field: 'ACC' | 'REF') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // 1. Success Screen (Once payment is confirmed)
  if (engagement?.state === 'ACTIVE') {
    return (
      <div className="w-full max-w-[550px] mx-auto py-16 px-6 text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500 border border-emerald-100 shadow-md">
          <CheckCircle size={44} className="animate-pulse" />
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Payment Confirmed!</h2>
          <p className="text-slate-600 text-sm max-w-sm mx-auto leading-relaxed">
            Your transfer of <strong>{formatVND(state.price)}</strong> has been successfully received and locked in escrow.
          </p>
        </div>
        <Card className="p-6 bg-slate-50 border-slate-200/60 max-w-md mx-auto text-left space-y-2">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Service:</span>
            <span className="font-semibold text-slate-800 text-right max-w-[250px] truncate">{state.title}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Escrow Status:</span>
            <span className="text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck size={14} /> SECURED
            </span>
          </div>
        </Card>
        <div className="flex flex-col items-center justify-center gap-2">
          <Spinner size="md" className="text-emerald-500" />
          <p className="text-xs text-slate-400">Redirecting you to the active workspace...</p>
        </div>
      </div>
    );
  }

  // 2. Standard Payment Checkout Screen
  return (
    <div className="w-full max-w-[960px] px-6 mx-auto py-8 space-y-6">
      {/* Header Back Link */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </Button>
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Checkout</span>
          <h1 className="text-xl font-bold text-slate-900">Escrow Payment Gateway</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left Column: QR Code & Status */}
        <div className="space-y-6">
          <Card className="p-6 flex flex-col items-center justify-center text-center space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-500">Scan to Pay with VietQR</h3>
              <p className="text-xs text-slate-400">Supports any Vietnamese banking app</p>
            </div>
            
            <div className="bg-white p-4 border border-slate-100 rounded-2xl shadow-inner relative group">
              <img
                src={state.vietqrUrl}
                alt="VietQR Payment Code"
                className="w-64 h-64 mx-auto object-contain select-none"
              />
            </div>

            <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 w-full justify-center">
              <Spinner size="sm" className="text-emerald-500 shrink-0" />
              <span className="text-xs font-medium text-slate-600">
                Awaiting transfer confirmation...
              </span>
            </div>
          </Card>
        </div>

        {/* Right Column: Copy-paste Coordinates & Info */}
        <div className="space-y-6">
          <Card className="p-6 space-y-6">
            <div>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Service Purchase</span>
              <h2 className="text-lg font-bold text-slate-900 mt-1">{state.title}</h2>
            </div>

            <div className="space-y-4 border-t border-slate-100 pt-6">
              {/* Bank Name */}
              <div className="flex justify-between items-center py-2 border-b border-slate-50 text-sm">
                <span className="text-slate-500">Bank Name</span>
                <span className="font-semibold text-slate-800">Military Commercial Bank (MBBank)</span>
              </div>

              {/* Account Number */}
              <div className="flex justify-between items-center py-2 border-b border-slate-50 text-sm">
                <span className="text-slate-500">Account Number</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900">0394654576</span>
                  <button
                    onClick={() => handleCopy('0394654576', 'ACC')}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                    title="Copy Account Number"
                  >
                    {copiedField === 'ACC' ? <span className="text-[10px] text-emerald-600 font-bold">Copied</span> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Transfer Amount */}
              <div className="flex justify-between items-center py-2 border-b border-slate-50 text-sm">
                <span className="text-slate-500">Amount</span>
                <span className="font-extrabold text-emerald-600 text-base">{formatVND(state.price)}</span>
              </div>

              {/* Reference / Memo */}
              <div className="flex justify-between items-start py-2 border-b border-slate-50 text-sm gap-4">
                <span className="text-slate-500 shrink-0">Transfer Description</span>
                <div className="flex items-start gap-2 text-right">
                  <span className="font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 break-all select-all">
                    {state.vaNumber}
                  </span>
                  <button
                    onClick={() => handleCopy(state.vaNumber, 'REF')}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md transition-colors shrink-0 mt-0.5"
                    title="Copy Description"
                  >
                    {copiedField === 'REF' ? <span className="text-[10px] text-emerald-600 font-bold">Copied</span> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50/50 border border-rose-100 rounded-xl text-rose-800 text-xs flex gap-2.5">
              <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Attention:</strong> You must copy the <strong>Transfer Description</strong> exactly as shown above. The payment system uses this to automatically match and fund your project's escrow.
              </p>
            </div>

            <div className="space-y-3 pt-6 border-t border-slate-100">
              <Link
                to={`/ceo/inbox/${state.engagementId}`}
                className="w-full inline-flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
              >
                <MessageSquare size={16} />
                Chat with Expert First
              </Link>
              
              <Button
                variant="ghost"
                onClick={() => navigate('/ceo/marketplace')}
                className="w-full py-3 justify-center text-slate-500 hover:text-slate-700"
              >
                Cancel and Return to Marketplace
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
