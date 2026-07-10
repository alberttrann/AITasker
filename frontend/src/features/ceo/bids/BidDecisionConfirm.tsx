import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

/** PUT /bids/:id/counter-offer */
function useCounterOfferBid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bidId, price }: { bidId: string; price: number }) => {
      const { data } = await apiClient.put(`/bids/${bidId}/counter-offer`, {
        negotiated_price_vnd: price,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bids'] });
    },
  });
}

export default function BidDecisionConfirm({ 
  bidId, 
  onSuccess, 
  onCancel 
}: { 
  bidId: string; 
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const counterOffer = useCounterOfferBid();
  const [counterPrice, setCounterPrice] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  const handleCounterOffer = () => {
    const price = parseInt(counterPrice);
    if (!price || price <= 0 || !bidId) return;
    setServerError(null);
    counterOffer.mutate(
      { bidId, price },
      {
        onSuccess: () => {
          onSuccess();
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message || 'Failed to submit counter-offer.';
          setServerError(Array.isArray(msg) ? msg[0] : msg);
        },
      }
    );
  };

  return (
    <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-4" id={`panel-counter-offer-${bidId}`}>
      {serverError && (
        <div className="mb-4 rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] p-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[#EF4444] mt-0.5" />
          <p className="text-[13px] text-[#DC2626]">{serverError}</p>
        </div>
      )}
      <label className="block text-[13px] font-medium text-[#0F172A] mb-2" htmlFor={`input-counter-offer-${bidId}`}>
        Proposed Price (VND)
      </label>
      <div className="flex gap-3">
        <input
          id={`input-counter-offer-${bidId}`}
          type="number"
          min={0}
          step={10000}
          value={counterPrice}
          onChange={(e) => setCounterPrice(e.target.value)}
          disabled={counterOffer.isPending}
          placeholder="e.g. 65000000"
          className={cn(
            'flex-1 rounded-[8px] border border-[#E2E8F0] bg-white px-3 py-2 text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10'
          )}
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={counterOffer.isPending}
          onClick={onCancel}
          id={`btn-cancel-counter-offer-${bidId}`}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={counterOffer.isPending || !counterPrice || parseInt(counterPrice) <= 0}
          onClick={handleCounterOffer}
          id={`btn-submit-counter-offer-${bidId}`}
        >
          {counterOffer.isPending ? 'Sending…' : 'Send Offer'}
        </Button>
      </div>
      <p className="mt-1 text-[11px] text-[#94A3B8]">
        Counter-offer is final and cannot be changed.
      </p>
    </div>
  );
}
