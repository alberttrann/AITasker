import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, FileText, CheckCircle2, XCircle, Clock, ArrowRight } from 'lucide-react';
import type { EngagementDto, CapabilityBidDto } from '@/types/api.types';

// ── Inline hooks ─────────────────────────────────────────────────

/** GET /engagements — CEO role-scoped to their projects */
function useBidsForCeo(projectId: string | undefined) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['bids', 'ceo', projectId],
    queryFn: async () => {
      const { data } = await apiClient.get<EngagementDto[]>('/engagements');
      return data;
    },
    enabled: !!projectId && !!user,
    staleTime: 10_000,
    refetchInterval: 5_000, // Polling until BE emits bid:updated
  });
}

// ── Helpers ──────────────────────────────────────────────────────

const CEO_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-[#EAB30815]', text: 'text-[#CA8A04]', label: 'Pending' },
  APPROVED: { bg: 'bg-[#22C55E15]', text: 'text-[#16A34A]', label: 'Accepted' },
  DECLINED: { bg: 'bg-[#EF444415]', text: 'text-[#DC2626]', label: 'Declined' },
};

function formatVND(n: number) {
  return n ? n.toLocaleString('vi-VN') + ' ₫' : '—';
}

function formatDate(d: string) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';
}

type BidWithEngagement = CapabilityBidDto & { engagementId: string; expertName?: string };

export default function CeoBidList() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: engagements, isLoading, error, refetch } = useBidsForCeo(projectId);

  // Filter to this project + extract bids
  const bids: BidWithEngagement[] = (engagements || [])
    .filter((eng: any) => eng.projectId === projectId || eng.project_id === projectId)
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
        <h1 className="font-headline text-[24px] font-semibold text-[#0F172A]">Bids Received</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-[8px] border border-[#E2E8F0] bg-white p-6">
              <div className="h-5 w-40 rounded bg-[#F1F5F9]" />
              <div className="mt-2 h-4 w-24 rounded bg-[#F1F5F9]" />
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
        <AlertTriangle className="mx-auto h-8 w-8 text-[#EAB308]" />
        <p className="text-body-lg font-headline text-[#EF4444]">{msg}</p>
        <Button variant="secondary" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────

  if (bids.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-headline text-[24px] font-semibold text-[#0F172A]">Bids Received</h1>
        <div className="rounded-[8px] border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-[#94A3B8]" />
          <p className="mt-4 text-body text-[#64748B]">
            No bids have been submitted yet.
          </p>
          <p className="mt-1 text-[14px] text-[#94A3B8]">
            Invite experts from the shortlist to get started.
          </p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => navigate(`/ceo/projects/${projectId}/shortlist`)}
          >
            View Shortlist
          </Button>
        </div>
      </div>
    );
  }

  // ── List ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-[24px] font-semibold text-[#0F172A]">
          Bids Received
        </h1>
        <p className="mt-1 text-body text-[#64748B]">
          {bids.length} bid{bids.length !== 1 ? 's' : ''} for your project
        </p>
      </div>

      <div className="space-y-3">
        {bids.map((bid) => {
          const ceoStatus = bid.ceoStatus || 'PENDING';
          const ceoStyle = CEO_STATUS_STYLES[ceoStatus] || CEO_STATUS_STYLES.PENDING;
          const pricing: any[] = (bid as any).conditionalPricingJson || (bid as any).conditional_pricing_json || [];
          const totalPrice = pricing.reduce((s: number, m: any) => s + (m.price_vnd || 0), 0);
          const canDecide = bid.techStatus === 'APPROVED' && ceoStatus === 'PENDING';

          return (
            <Card key={bid.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-headline text-[16px] font-semibold text-[#0F172A]">
                        {bid.expertName}
                      </h3>
                      {canDecide && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#059669]/10 px-2 py-0.5 text-[11px] font-medium text-[#059669]">
                          Ready to decide
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-[#64748B] line-clamp-2">
                      {(bid as any).approachSummary || (bid as any).approach_summary || 'No summary'}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-[12px] text-[#94A3B8]">
                      <span>{formatDate((bid as any).createdAt || (bid as any).submitted_at)}</span>
                      <span>·</span>
                      <span className="font-headline font-semibold text-[#0F172A]">
                        {formatVND(totalPrice)}
                      </span>
                      <span>·</span>
                      <span
                        className={`inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11px] font-medium uppercase ${ceoStyle.bg} ${ceoStyle.text}`}
                      >
                        {ceoStyle.label}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/ceo/project/${projectId}/bids/${bid.id}`);
                      }}
                    >
                      View <ArrowRight size={14} className="ml-1" />
                    </Button>
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
