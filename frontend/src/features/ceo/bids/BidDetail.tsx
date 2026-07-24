import { useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, LockKeyhole } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useBid } from '@/hooks/use-bids';
import { formatVND } from '@/lib/utils';
import CounterOfferPanel from './CounterOfferPanel';
import CeoNdaClickThrough from '../connection/NdaClickThrough';
import { Modal } from '@/components/ui/modal';

export default function BidDetail() {
  const { projectId, bidId } = useParams<{ projectId: string; bidId: string }>();
  const navigate = useNavigate();
  const [showCounter, setShowCounter] = useState(false);
  const [showNdaModal, setShowNdaModal] = useState(false);
  const { data: bid, isLoading, error, refetch } = useBid(bidId ?? '', { refetchInterval: 5_000 });

  if (isLoading) return <div className="flex justify-center py-24"><Spinner size="xl" /></div>;
  if (error || !bid) {
    return (
      <div className="space-y-4 py-20 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
        <p className="text-red-600">Bid could not be loaded.</p>
        <Button id="btn-retry-bid-detail" variant="secondary" onClick={() => refetch()} className="cursor-pointer">Retry</Button>
      </div>
    );
  }

  const offer = bid.acceptedOffer ?? bid.currentOffer;
  const canAct = bid.nextActionBy === 'CEO' && bid.negotiationState === 'AWAITING_CEO';
  // CEO never revises tech terms; they either Accept or Counter the price. Tech revisions are for Experts only.
  const canRevise = false;
  const total = offer?.milestones.reduce((sum, milestone) => sum + (milestone.price_vnd ?? 0), 0) ?? 0;
  const engagementId = bid.engagementId || bid.engagement?.id;

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-6">
      <button id="btn-back-to-ceo-bids" onClick={() => navigate(`/ceo/projects/${projectId}/bids`)} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft size={16} /> Back to bids
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-semibold text-slate-900">Bid from {bid.engagement?.expert?.fullName ?? 'Expert'}</h1>
          <p className="mt-1 text-sm text-slate-500">Offer v{offer?.version ?? bid.versionNumber} · {String(bid.negotiationState || '').replace(/_/g, ' ').toLowerCase()}</p>
        </div>
        {bid.termsLocked ? <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"><LockKeyhole size={16} /> Terms locked</span> : null}
      </div>

      <Card><CardContent className="p-6"><h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Approach</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{bid.approachSummary || 'No approach summary provided.'}</p></CardContent></Card>

      {bid.negotiationState === 'AWAITING_TECH_REVIEW' ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Tech Team is reviewing technical scope version {bid.technicalReview?.scopeVersion}. Commercial actions unlock after approval.</div>
      ) : null}
      {bid.technicalReview?.status === 'REVISION_REQUESTED' ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Technical revision requested: {bid.technicalReview.feedback || bid.techFeedback}</div>
      ) : null}

      {offer ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">{bid.termsLocked ? 'Accepted milestones' : 'Current offer'}</h2><span className="font-semibold text-emerald-700">{formatVND(total)}</span></div>
            {offer.milestones.map((milestone) => (
              <div key={milestone.milestone_number} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold text-slate-800">M{milestone.milestone_number}. {milestone.deliverable_statement}</h3><span className="font-mono text-sm font-semibold text-slate-900">{formatVND(milestone.price_vnd ?? 0)}</span></div>
                {milestone.estimated_duration_days ? <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500"><Clock size={13} />{milestone.estimated_duration_days} days</p> : null}
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">{milestone.criteria.map((criterion) => <li key={criterion.criterion_text}>{criterion.criterion_text}</li>)}</ul>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {showCounter && bid.currentOffer ? <CounterOfferPanel bidId={bid.id} currentOffer={bid.currentOffer} onCancel={() => setShowCounter(false)} onSuccess={() => setShowCounter(false)} /> : null}

      {(canAct || canRevise) && !showCounter ? (
        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
          {canAct ? <Button id="btn-decline-current-offer" variant="destructive" onClick={() => navigate(`/ceo/projects/${projectId}/bids/${bid.id}/decision?action=decline`)} className="cursor-pointer">Decline</Button> : null}
          <Button id="btn-counter-current-offer" variant="secondary" onClick={() => setShowCounter(true)} className="cursor-pointer">{canRevise ? 'Revise technical terms' : 'Counter'}</Button>
          {canAct ? <Button id="btn-accept-current-offer" variant="primary" onClick={() => navigate(`/ceo/projects/${projectId}/bids/${bid.id}/decision?action=accept`)} className="cursor-pointer">Accept offer</Button> : null}
        </div>
      ) : null}

      {bid.termsLocked && engagementId ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /><div className="flex-1"><h2 className="font-semibold text-emerald-900">Commercial terms accepted</h2><p className="mt-1 text-sm text-emerald-700">Milestones are created and immutable. Both parties must sign the NDA before funding.</p></div></div>
          <Button id="btn-open-ceo-nda" variant="primary" className="mt-4 cursor-pointer" onClick={() => setShowNdaModal(true)}>Sign / view NDA</Button>
        </div>
      ) : null}

      <Modal
        isOpen={showNdaModal}
        onClose={() => setShowNdaModal(false)}
        className="w-full max-w-3xl sm:max-w-3xl p-0 overflow-hidden bg-slate-50"
      >
        <div className="h-[80vh] overflow-y-auto">
          <CeoNdaClickThrough />
        </div>
      </Modal>
    </div>
  );
}
