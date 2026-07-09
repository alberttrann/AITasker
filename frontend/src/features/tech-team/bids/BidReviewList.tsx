import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, FileText, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import type { EngagementDto, CapabilityBidDto } from '@/types/api.types';

// ── Inline hooks ─────────────────────────────────────────────────

/** GET /engagements — TECH_TEAM role-scoped to linked project */
function useBidsForTechTeam() {
  const user = useAuthStore((s) => s.user);
  const techTeamId = user?.id;

  return useQuery({
    queryKey: ['bids', 'tech-team'],
    queryFn: async () => {
      const { data } = await apiClient.get<EngagementDto[]>('/engagements');
      return data;
    },
    enabled: !!techTeamId,
    staleTime: 10_000,
    // ⚠️ Polling fallback — BE doesn't emit bid:updated yet
    refetchInterval: 5_000,
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

function formatDate(d: string) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

type BidWithEngagement = CapabilityBidDto & { engagementId: string; expertName?: string };

// ── Component ────────────────────────────────────────────────────

export default function BidReviewList() {
  const navigate = useNavigate();
  const { data: engagements, isLoading, error, refetch } = useBidsForTechTeam();

  // Extract bids from engagements
  const bids: BidWithEngagement[] = (engagements || [])
    .flatMap((eng: any) => {
      const bid = eng.capabilityBid;
      if (!bid) return [];
      return [{ ...bid, engagementId: eng.id, expertName: eng.expert?.fullName || 'Expert' }];
    })
    .sort((a: any, b: any) => new Date(b.createdAt || b.submitted_at || 0).getTime() - new Date(a.createdAt || a.submitted_at || 0).getTime());

  // ── Loading ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="font-headline text-[24px] font-semibold text-primary">Bid Reviews</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-DEFAULT border border-[#E2E8F0] bg-white p-6">
              <div className="h-5 w-48 rounded bg-primary-bg" />
              <div className="mt-3 h-4 w-32 rounded bg-primary-bg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────

  if (error) {
    const msg = (error as any)?.response?.data?.message || 'Failed to load bids.';
    return (
      <div className="py-24 text-center space-y-4">
        <AlertTriangle className="mx-auto h-8 w-8 text-warning" />
        <p className="text-body-lg font-headline text-error">{msg}</p>
        <Button variant="secondary" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────

  if (bids.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-headline text-[24px] font-semibold text-primary">Bid Reviews</h1>
        <div className="rounded-DEFAULT border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-primary-light" />
          <p className="mt-4 text-body text-secondary">
            No bids have been submitted yet.
          </p>
          <p className="mt-1 text-[14px] text-primary-light">
            Experts are preparing their proposals.
          </p>
        </div>
      </div>
    );
  }

  // ── List ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6 w-full max-w-[1440px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-[24px] font-semibold text-primary">
            Bid Reviews
          </h1>
          <p className="mt-1 text-body text-secondary">
            {bids.length} bid{bids.length !== 1 ? 's' : ''} submitted
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {bids.map((bid) => {
          const techStatus = (bid as any).tech_status || 'PENDING';
          const style = TECH_STATUS_STYLES[techStatus] || TECH_STATUS_STYLES.PENDING;
          const StatusIcon = style.icon;
          const totalPrice =
            (bid as any).conditional_pricing_json
              ? ((bid as any).conditional_pricing_json as any[])
                  ?.reduce((s: number, m: any) => s + (m.price_vnd || 0), 0) || 0
              : 0;

          return (
            <Card
              key={bid.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate(`/tech-team/bids/${bid.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-headline text-[16px] font-semibold text-primary truncate">
                      {bid.expertName}
                    </h3>
                    <p className="mt-1 text-[13px] text-secondary line-clamp-2">
                      {(bid as any).approach_summary || 'No summary provided'}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-[12px] text-primary-light">
                      <span>Submitted {formatDate((bid as any).createdAt || (bid as any).submitted_at)}</span>
                      <span>·</span>
                      <span className="font-headline font-semibold text-primary">
                        {formatVND(totalPrice)}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-[4px] text-[12px] font-medium uppercase tracking-[0.5px] ${style.bg} ${style.text}`}
                    >
                      <StatusIcon size={12} />
                      {style.label}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
