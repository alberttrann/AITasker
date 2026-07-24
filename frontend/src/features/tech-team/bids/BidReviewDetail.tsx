import { useParams, useNavigate } from 'react-router-dom';
import { useBid } from '@/hooks/use-bids';
import { formatSeamCode } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { AlertTriangle, ArrowLeft, CheckCircle2, AlertCircle, Clock } from 'lucide-react';



// ── Helpers ──────────────────────────────────────────────────────

const TECH_STATUS_STYLES: Record<string, { bg: string; text: string; label: string; icon: typeof Clock }> = {
  PENDING: { bg: 'bg-[#EAB30815]', text: 'text-[#CA8A04]', label: 'Pending Review', icon: Clock },
  APPROVED: { bg: 'bg-[#22C55E15]', text: 'text-[#16A34A]', label: 'Approved', icon: CheckCircle2 },
  REVISION_REQUESTED: { bg: 'bg-[#EF444415]', text: 'text-[#DC2626]', label: 'Revision Requested', icon: AlertCircle },
  DECLINED: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Declined by CEO', icon: AlertCircle },
};



export default function BidReviewDetail() {
  const { bidId } = useParams<{ bidId: string }>();
  const navigate = useNavigate();

  const { data: bid, isLoading, error, refetch } = useBid(bidId as string);

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
        <AlertTriangle className="mx-auto h-8 w-8 text-warning" />
        <p className="text-body-lg font-headline text-error">{msg}</p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={() => refetch()}>Retry</Button>
          <Button variant="ghost" onClick={() => navigate('/tech-team/bids')}>Back to List</Button>
        </div>
      </div>
    );
  }

  const bidAny = bid as any;
  // If the overall bid state is DECLINED or WITHDRAWN, override the Tech display status
  const techStatus = ['DECLINED', 'WITHDRAWN'].includes(bidAny.state) ? 'DECLINED' : (bidAny.techStatus || 'PENDING');
  const style = TECH_STATUS_STYLES[techStatus] || TECH_STATUS_STYLES.PENDING;
  const StatusIcon = style.icon;

  const footprint = bidAny.footprintAlignmentJson || bidAny.footprint_alignment_json;
  const technicalMilestones: any[] = bid.currentOffer?.milestones || bidAny.conditionalPricingJson || [];

  const canReview = techStatus === 'PENDING';

  return (
    <div className="w-full max-w-[1440px] mx-auto space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate('/tech-team/bids')}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Back to Bid List</span>
        </button>
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-headline text-[24px] font-semibold text-primary">
            Bid Review
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-[4px] text-[12px] font-medium uppercase tracking-[0.5px] ${style.bg} ${style.text}`}
          >
            <StatusIcon size={12} />
            {style.label}
          </span>
        </div>
      </div>

      {/* Approach Summary */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-headline text-[14px] font-semibold text-primary mb-3">
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
            <h3 className="font-headline text-[14px] font-semibold text-primary mb-4">
              Footprint Alignment
            </h3>

            {/* Domains */}
            {footprint.domains?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-[12px] font-medium uppercase tracking-[0.5px] text-secondary mb-2">
                  Domains
                </h4>
                <div className="flex flex-wrap gap-2">
                  {footprint.domains.map((d: any) => (
                    <span
                      key={d.code}
                      className="inline-flex items-center rounded-sm bg-primary/5 px-3 py-1 text-[13px] font-medium text-primary"
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
                <h4 className="text-[12px] font-medium uppercase tracking-[0.5px] text-secondary mb-2">
                  Seams
                </h4>
                <div className="flex flex-wrap gap-2">
                  {footprint.seams.map((s: any) => (
                    <span
                      key={s.code}
                      className="inline-flex items-center gap-1.5 rounded-sm bg-tertiary/5 px-3 py-1 text-[13px] font-medium text-tertiary"
                    >
                      {formatSeamCode(s.code)}
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

      {/* Technical milestone scope — commercial fields are intentionally excluded. */}
      {technicalMilestones.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-headline text-[14px] font-semibold text-primary mb-4">Technical Milestone Scope</h3>
            <div className="space-y-2">
              {technicalMilestones.map((m: any, i: number) => (
                <div
                  key={i}
                  className="rounded-[6px] bg-[#F8FAFC] px-4 py-3"
                >
                  <div>
                    <span className="text-[13px] font-medium text-primary block">
                      M{m.milestone_number}: {m.deliverable_statement || 'No deliverable provided'}
                    </span>
                    {m.estimated_duration_days && (
                      <span className="text-[12px] text-secondary mt-0.5 block flex items-center gap-1">
                        <Clock size={12} /> {m.estimated_duration_days} days
                      </span>
                    )}
                    {m.criteria?.length > 0 ? <ul className="mt-2 list-disc pl-5 text-[12px] text-secondary">{m.criteria.map((criterion: any) => <li key={criterion.criterion_text}>{criterion.criterion_text}</li>)}</ul> : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tech Feedback (if revision) */}
      {bidAny.techFeedback && (
        <div className="rounded-DEFAULT border border-[#FED7AA] bg-[#FFF7ED] p-4">
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
            id={`btn-request-tech-revision-${bidId}`}
            variant="destructive"
            onClick={() =>
              navigate(`/tech-team/bids/${bidId}/revision`)
            }
          >
            Request Revision
          </Button>
          <Button
            id={`btn-approve-tech-bid-${bidId}`}
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
