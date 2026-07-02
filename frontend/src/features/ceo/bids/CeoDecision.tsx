import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmModal } from '@/components/ui/modal';
import { AlertTriangle, CheckCircle2, XCircle, ArrowLeft, DollarSign, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CapabilityBidDto } from '@/types/api.types';

// ── Inline hooks ─────────────────────────────────────────────────

function useBidDetail(bidId: string | undefined) {
  return useQuery({
    queryKey: ['bids', bidId],
    queryFn: async () => {
      const { data } = await apiClient.get<CapabilityBidDto>(`/bids/${bidId}`);
      return data;
    },
    enabled: !!bidId,
    refetchInterval: 5_000, // Polling
  });
}

/** PUT /bids/:id/ceo-decision */
function useCeoDecisionBid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bidId, decision }: { bidId: string; decision: 'APPROVED' | 'DECLINED' }) => {
      const { data } = await apiClient.put(`/bids/${bidId}/ceo-decision`, { decision });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bids'] });
      qc.invalidateQueries({ queryKey: ['engagements'] });
    },
  });
}

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

// ── Helpers ──────────────────────────────────────────────────────

function formatVND(n: number) {
  return n ? n.toLocaleString('vi-VN') + ' ₫' : '—';
}

export default function CeoDecision() {
  const { projectId, bidId } = useParams<{ projectId: string; bidId: string }>();
  const navigate = useNavigate();

  const { data: bid, isLoading, error, refetch } = useBidDetail(bidId);
  const ceoDecision = useCeoDecisionBid();
  const counterOffer = useCounterOfferBid();

  // Modals state
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const [showCounterOffer, setShowCounterOffer] = useState(false);
  const [counterPrice, setCounterPrice] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  const bidAny = bid as any;
  const pricing: any[] = bidAny?.conditionalPricingJson || bidAny?.conditional_pricing_json || [];
  const totalPrice = pricing.reduce((s: number, m: any) => s + (m.price_vnd || 0), 0);
  const canDecide = bidAny?.techStatus === 'APPROVED' && bidAny?.ceoStatus === 'PENDING';
  const alreadyDecided = bidAny?.ceoStatus === 'APPROVED' || bidAny?.ceoStatus === 'DECLINED';

  // ── Loading ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="xl" className="mx-auto" />
      </div>
    );
  }

  // ── Error / Not Found ──────────────────────────────────────────

  if (error || !bid) {
    const msg = (error as any)?.response?.data?.message || 'Bid not found.';
    return (
      <div className="py-24 text-center space-y-4">
        <AlertTriangle className="mx-auto h-8 w-8 text-[#EAB308]" />
        <p className="text-body-lg font-headline text-[#EF4444]">{msg}</p>
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={() => refetch()}>Retry</Button>
          <Button variant="ghost" onClick={() => navigate(`/ceo/project/${projectId}/bids`)}>Back</Button>
        </div>
      </div>
    );
  }

  // ── Handlers ───────────────────────────────────────────────────

  const handleAccept = () => {
    if (!bidId) return;
    setServerError(null);
    ceoDecision.mutate(
      { bidId, decision: 'APPROVED' },
      {
        onSuccess: (data: any) => {
          const engId = data?.engagement_id || data?.id || bidAny?.engagementId || bidAny?.engagement_id;
          if (engId) {
            navigate(`/ceo/project/${projectId}/nda/${engId}`, { replace: true });
          }
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message || 'Failed to accept bid.';
          setServerError(Array.isArray(msg) ? msg[0] : msg);
        },
      }
    );
  };

  const handleDecline = () => {
    if (!bidId) return;
    setServerError(null);
    ceoDecision.mutate(
      { bidId, decision: 'DECLINED' },
      {
        onSuccess: () => {
          navigate(`/ceo/project/${projectId}/bids`, { replace: true });
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message || 'Failed to decline bid.';
          setServerError(Array.isArray(msg) ? msg[0] : msg);
        },
      }
    );
  };

  const handleCounterOffer = () => {
    const price = parseInt(counterPrice);
    if (!price || price <= 0 || !bidId) return;
    setServerError(null);
    counterOffer.mutate(
      { bidId, price },
      {
        onSuccess: () => {
          setShowCounterOffer(false);
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message || 'Failed to submit counter-offer.';
          setServerError(Array.isArray(msg) ? msg[0] : msg);
        },
      }
    );
  };

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-[720px] space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate(`/ceo/project/${projectId}/bids`)}
        className="inline-flex items-center gap-1.5 text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Bids
      </button>

      {/* Header */}
      <div>
        <h1 className="font-headline text-[24px] font-semibold text-[#0F172A]">
          Bid from {bidAny?.expert?.fullName || bidAny?.expertName || 'Expert'}
        </h1>
        {alreadyDecided && (
          <span
            className={cn(
              'mt-2 inline-flex items-center gap-1.5 rounded-[4px] px-3 py-1 text-[12px] font-medium uppercase tracking-[0.5px]',
              bidAny?.ceoStatus === 'APPROVED'
                ? 'bg-[#22C55E15] text-[#16A34A]'
                : 'bg-[#EF444415] text-[#DC2626]'
            )}
          >
            {bidAny?.ceoStatus === 'APPROVED' ? (
              <CheckCircle2 size={12} />
            ) : (
              <XCircle size={12} />
            )}
            {bidAny?.ceoStatus === 'APPROVED' ? 'Accepted' : 'Declined'}
          </span>
        )}
      </div>

      {/* Server error */}
      {serverError && (
        <div className="rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[#EF4444] mt-0.5" />
          <p className="text-[14px] text-[#DC2626]">{serverError}</p>
        </div>
      )}

      {/* Tech Review Status */}
      {bidAny?.techStatus && bidAny?.techStatus !== 'APPROVED' && (
        <div className="rounded-[8px] border border-[#FED7AA] bg-[#FFF7ED] p-4">
          <p className="text-[14px] text-[#C2410C]">
            This bid is still undergoing technical review. You can review it but
            cannot make a decision yet.
          </p>
        </div>
      )}

      {/* Approach Summary */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-headline text-[14px] font-semibold text-[#0F172A] mb-3">
            Approach
          </h3>
          <p className="text-body text-[#334155] leading-[1.7] whitespace-pre-wrap">
            {bidAny?.approachSummary || bidAny?.approach_summary || 'No summary provided.'}
          </p>
        </CardContent>
      </Card>

      {/* Pricing */}
      {pricing.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-headline text-[14px] font-semibold text-[#0F172A]">
                Pricing
              </h3>
              <span className="font-headline text-[18px] font-bold text-[#0F172A]">
                {formatVND(totalPrice)}
              </span>
            </div>
            <div className="space-y-2">
              {pricing.map((m: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-[6px] bg-[#F8FAFC] px-4 py-3"
                >
                  <span className="text-[13px] text-[#334155]">
                    M{m.milestone_number}: {m.condition}
                  </span>
                  <span className="font-headline text-[14px] font-semibold text-[#0F172A]">
                    {formatVND(m.price_vnd)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Already counter-offered */}
      {bidAny?.negotiatedPriceVnd && (
        <div className="rounded-[8px] border border-[#BFDBFE] bg-[#EFF6FF] p-4 flex items-start gap-3">
          <MessageSquare className="h-5 w-5 shrink-0 text-[#0EA5E9] mt-0.5" />
          <div>
            <p className="text-[13px] font-medium text-[#1E40AF]">Counter-offer Sent</p>
            <p className="text-[14px] text-[#1E3A8A]">
              You offered {formatVND(bidAny.negotiatedPriceVnd)}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      {canDecide && (
        <div className="space-y-4 pt-4 border-t border-[#E2E8F0]">
          {/* Counter-offer input */}
          {showCounterOffer && (
            <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <label className="block text-[13px] font-medium text-[#0F172A] mb-2">
                Proposed Price (VND)
              </label>
              <div className="flex gap-3">
                <input
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
                  variant="primary"
                  size="sm"
                  disabled={counterOffer.isPending || !counterPrice || parseInt(counterPrice) <= 0}
                  onClick={handleCounterOffer}
                >
                  {counterOffer.isPending ? 'Sending…' : 'Send Offer'}
                </Button>
              </div>
              <p className="mt-1 text-[11px] text-[#94A3B8]">
                Counter-offer is final and cannot be changed.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            {!showCounterOffer && !bidAny?.negotiatedPriceVnd && (
              <Button
                variant="secondary"
                onClick={() => setShowCounterOffer(true)}
                disabled={ceoDecision.isPending}
              >
                <DollarSign size={14} className="mr-1" />
                Counter-offer
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => setShowDeclineConfirm(true)}
              disabled={ceoDecision.isPending}
            >
              Decline
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowAcceptConfirm(true)}
              disabled={ceoDecision.isPending}
            >
              Accept Bid
            </Button>
          </div>
        </div>
      )}

      {/* Accept Confirmation */}
      <ConfirmModal
        isOpen={showAcceptConfirm}
        onClose={() => setShowAcceptConfirm(false)}
        onConfirm={handleAccept}
        title="Accept Bid"
        confirmText="Confirm Acceptance"
        isInfo
      >
        Accepting this bid will automatically decline all other bids for this
        project. This action cannot be undone. You will proceed to the NDA
        signing step.
      </ConfirmModal>

      {/* Decline Confirmation */}
      <ConfirmModal
        isOpen={showDeclineConfirm}
        onClose={() => setShowDeclineConfirm(false)}
        onConfirm={handleDecline}
        title="Decline Bid"
        confirmText="Decline"
        isDestructive
      >
        Are you sure you want to decline this bid? You can still accept other
        bids for this project.
      </ConfirmModal>
    </div>
  );
}
