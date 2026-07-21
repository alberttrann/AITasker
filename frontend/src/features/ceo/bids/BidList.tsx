import { AlertTriangle, ArrowRight, Clock, FileText } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useBids } from '@/hooks/use-bids';
import { formatVND } from '@/lib/utils';
import type { BidNegotiationState } from '@/types/api.types';

const STATE_LABELS: Record<BidNegotiationState, string> = {
  AWAITING_TECH_REVIEW: 'Technical review',
  AWAITING_CEO: 'Your decision',
  AWAITING_EXPERT: 'Waiting for expert',
  TERMS_ACCEPTED: 'Terms accepted',
  DECLINED: 'Declined',
};

export default function BidList() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: bids = [], isLoading, error, refetch } = useBids(projectId);

  if (isLoading) {
    return <div className="flex justify-center py-24"><Spinner size="xl" /></div>;
  }

  if (error) {
    return (
      <div className="space-y-4 py-20 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
        <p className="text-red-600">Failed to load expert bids.</p>
        <Button id="btn-retry-ceo-bids" variant="secondary" onClick={() => refetch()} className="cursor-pointer">Retry</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-semibold text-slate-900">Expert Bids</h1>
        <p className="mt-1 text-sm text-slate-500">Technical review and commercial negotiation for this project.</p>
      </div>

      {bids.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-4 text-sm text-slate-600">No expert has submitted a bid yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bids.map((bid) => {
            const offer = bid.acceptedOffer ?? bid.currentOffer;
            const total = offer?.milestones.reduce((sum, milestone) => sum + (milestone.price_vnd ?? 0), 0) ?? 0;
            const duration = offer?.milestones.reduce((sum, milestone) => sum + (milestone.estimated_duration_days ?? 0), 0) ?? 0;
            const state = bid.negotiationState ?? 'AWAITING_TECH_REVIEW';
            const expertName = bid.engagement?.expert?.fullName ?? 'Expert';

            return (
              <Card
                key={bid.id}
                id={`card-ceo-bid-${bid.id}`}
                className="cursor-pointer border-slate-200 transition-all hover:-translate-y-px hover:border-emerald-300 hover:shadow-md"
                onClick={() => navigate(`/ceo/projects/${projectId}/bids/${bid.id}`)}
              >
                <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-900">{expertName}</h2>
                      <span className={`rounded px-2 py-1 text-xs font-semibold ${state === 'AWAITING_CEO' ? 'bg-amber-50 text-amber-700' : state === 'TERMS_ACCEPTED' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {STATE_LABELS[state]}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{bid.approachSummary || 'No approach summary provided.'}</p>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                      <span>{formatVND(total)}</span>
                      {duration > 0 ? <span className="inline-flex items-center gap-1"><Clock size={13} />{duration} days</span> : null}
                      <span>Offer v{offer?.version ?? bid.versionNumber}</span>
                    </div>
                  </div>
                  <Button
                    id={`btn-review-ceo-bid-${bid.id}`}
                    variant="primary"
                    className="cursor-pointer"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/ceo/projects/${projectId}/bids/${bid.id}`);
                    }}
                  >
                    Review <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
