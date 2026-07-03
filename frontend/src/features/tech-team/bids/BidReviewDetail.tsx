import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { AlertTriangle, ArrowLeft, CheckCircle2, AlertCircle, Clock, DollarSign } from 'lucide-react';
import type { CapabilityBidDto, EngagementDto } from '@/types/api.types';

// ── Inline hook: GET /bids/:id ───────────────────────────────────

function useBidDetail(bidId: string | undefined) {
  return useQuery({
    queryKey: ['bids', bidId],
    queryFn: async () => {
      const { data } = await apiClient.get<CapabilityBidDto>(`/bids/${bidId}`);
      return data;
    },
    enabled: !!bidId,
  });
}

// ── Helpers ──────────────────────────────────────────────────────

const TECH_STATUS_STYLES: Record<string, { bg: string; text: string; label: string; icon: typeof Clock }> = {
  PENDING: { bg: 'bg-[#EAB30815]', text: 'text-[#CA8A04]', label: 'Pending Review', icon: Clock },
  APPROVED: { bg: 'bg-[#22C55E15]', text: 'text-[#16A34A]', label: 'Approved', icon: CheckCircle2 },
  REVISION_REQUESTED: { bg: 'bg-[#EF444415]', text: 'text-[#DC2626]', label: 'Revision Requested', icon: AlertCircle },
};

function formatVND(n: number) {
  return n ? n.toLocaleString('vi-VN') + ' ₫' : '—';
}

export default function BidReviewDetail() {
  const { bidId } = useParams<{ bidId: string }>();
  const navigate = useNavigate();

  const { data: bid, isLoading, error, refetch } = useBidDetail(bidId);

  // ── Loading ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="xl" className="mx-auto" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────

  if (error || !bid) {
    const msg = (error as any)?.response?.data?.message || 'Bid not found.';
    return (
      <div className="py-24 text-center space-y-4">
        <AlertTriangle className="mx-auto h-8 w-8 text-[#EAB308]" />
        <p className="text-body-lg font-headline text-[#EF4444]">{msg}</p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={() => refetch()}>Retry</Button>
          <Button variant="ghost" onClick={() => navigate('/tech-team/bids')}>Back to List</Button>
        </div>
      </div>
    );
  }

  const bidAny = bid as any;
  const techStatus = bidAny.techStatus || 'PENDING';
  const style = TECH_STATUS_STYLES[techStatus] || TECH_STATUS_STYLES.PENDING;
  const StatusIcon = style.icon;

  const footprint = bidAny.footprintAlignmentJson || bidAny.footprint_alignment_json;
  const pricing: any[] = bidAny.conditionalPricingJson || bidAny.conditional_pricing_json || [];
  const totalPrice = pricing.reduce((s: number, m: any) => s + (m.price_vnd || 0), 0);

  const canReview = techStatus === 'PENDING' || techStatus === 'REVISION_REQUESTED';

  return (
    <div className="mx-auto max-w-[800px] space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate('/tech-team/bids')}
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Bid List
        </button>
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-headline text-[24px] font-semibold text-[#0F172A]">
            Bid Review
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-[4px] px-[12px] py-[4px] text-[12px] font-medium uppercase tracking-[0.5px] ${style.bg} ${style.text}`}
          >
            <StatusIcon size={12} />
            {style.label}
          </span>
        </div>
      </div>

      {/* Approach Summary */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-headline text-[14px] font-semibold text-[#0F172A] mb-3">
            Approach Summary
          </h3>
          <p className="text-body text-[#334155] leading-[1.7] whitespace-pre-wrap">
            {bidAny.approachSummary || bidAny.approach_summary || 'No approach summary provided.'}
          </p>
        </CardContent>
      </Card>

      {/* Footprint Alignment */}
      {footprint && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-headline text-[14px] font-semibold text-[#0F172A] mb-4">
              Footprint Alignment
            </h3>

            {/* Domains */}
            {footprint.domains?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-[12px] font-medium uppercase tracking-[0.5px] text-[#64748B] mb-2">
                  Domains
                </h4>
                <div className="flex flex-wrap gap-2">
                  {footprint.domains.map((d: any) => (
                    <span
                      key={d.code}
                      className="inline-flex items-center rounded-[4px] bg-[#0F172A]/5 px-3 py-1 text-[13px] font-medium text-[#0F172A]"
                    >
                      {d.code}: {d.depth?.charAt(0)}{d.depth?.slice(1).toLowerCase()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Seams */}
            {footprint.seams?.length > 0 && (
              <div>
                <h4 className="text-[12px] font-medium uppercase tracking-[0.5px] text-[#64748B] mb-2">
                  Seams
                </h4>
                <div className="flex flex-wrap gap-2">
                  {footprint.seams.map((s: any) => (
                    <span
                      key={s.code}
                      className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#059669]/5 px-3 py-1 text-[13px] font-medium text-[#059669]"
                    >
                      {s.code}
                      <span className="text-[11px] opacity-70">
                        ({s.tier?.replace('_', ' ').toLowerCase()})
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Conditional Pricing */}
      {pricing.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-headline text-[14px] font-semibold text-[#0F172A]">
                Conditional Pricing
              </h3>
              <span className="font-headline text-[16px] font-bold text-[#0F172A]">
                {formatVND(totalPrice)}
              </span>
            </div>
            <div className="space-y-2">
              {pricing.map((m: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-[6px] bg-[#F8FAFC] px-4 py-3"
                >
                  <div>
                    <span className="text-[13px] font-medium text-[#0F172A]">
                      M{m.milestone_number}: {m.condition}
                    </span>
                  </div>
                  <span className="font-headline text-[14px] font-semibold text-[#0F172A]">
                    {formatVND(m.price_vnd)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tech Feedback (if revision) */}
      {bidAny.techFeedback && (
        <div className="rounded-[8px] border border-[#FED7AA] bg-[#FFF7ED] p-4">
          <h4 className="text-[13px] font-semibold text-[#C2410C] mb-1">
            Previous Feedback
          </h4>
          <p className="text-[14px] text-[#9A3412]">{bidAny.techFeedback}</p>
        </div>
      )}

      {/* Action Buttons */}
      {canReview && (
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E2E8F0]">
          <Button
            variant="destructive"
            onClick={() =>
              navigate(`/tech-team/bids/${bidId}/revision`)
            }
          >
            Request Revision
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate(`/tech-team/bids/${bidId}/approve`)}
          >
            Approve Bid
          </Button>
        </div>
      )}
    </div>
  );
}
