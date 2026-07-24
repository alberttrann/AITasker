import { useState } from 'react';
import { AlertTriangle, ArrowLeft, Clock, LockKeyhole, XCircle, RefreshCw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmModal } from '@/components/ui/modal';
import {
  useAcceptOffer,
  useBid,
  useDeclineOffer,
  useWithdrawBid,
  useReconcileBid,
  isReconciliationRequiredError,
} from '@/hooks/use-bids';
import { useEngagement } from '@/hooks/use-engagements';
import { formatVND } from '@/lib/utils';
import CounterOfferPanel from '@/features/ceo/bids/CounterOfferPanel';
import ExpertNdaClickThrough from '../connection/NdaClickThrough';
import { Modal } from '@/components/ui/modal';

export default function CounterOfferReceived() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const navigate = useNavigate();
  const [showCounter, setShowCounter] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [showNdaModal, setShowNdaModal] = useState(false);
  const { data: engagement, isLoading: engagementLoading, error: engagementError } = useEngagement(engagementId);
  const bidId = engagement?.capabilityBid?.id ?? '';
  const { data: bid, isLoading: bidLoading, error: bidError } = useBid(bidId, { refetchInterval: 5_000 });
  const acceptOffer = useAcceptOffer();
  const declineOffer = useDeclineOffer();
  const withdrawBid = useWithdrawBid();
  const reconcileBid = useReconcileBid();

  if (engagementLoading || (bidId && bidLoading)) return <div className="flex justify-center py-24"><Spinner size="xl" /></div>;
  if (engagementError || bidError || !engagement || !bid) {
    return <div className="py-20 text-center text-red-600">The bid negotiation could not be loaded.</div>;
  }

  const offer = bid.acceptedOffer ?? bid.currentOffer;
  const canAct = bid.nextActionBy === 'EXPERT' && bid.negotiationState === 'AWAITING_EXPERT';
  const canRevise = bid.technicalReview?.status === 'REVISION_REQUESTED' && bid.currentOffer?.proposerRole === 'EXPERT';
  const canWithdraw = bid.state === 'SUBMITTED' || bid.state === 'TECH_REVIEW';
  const total = offer?.milestones.reduce((sum, milestone) => sum + (milestone.price_vnd ?? 0), 0) ?? 0;

  const mutationError = acceptOffer.error || declineOffer.error || withdrawBid.error;
  const needsReconciliation =
    isReconciliationRequiredError(acceptOffer.error) ||
    isReconciliationRequiredError(declineOffer.error) ||
    isReconciliationRequiredError(withdrawBid.error);

  const genericErrorMessage =
    (mutationError as any)?.response?.data?.message?.message ||
    (mutationError as any)?.response?.data?.message ||
    'Action failed.';

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-6">
      <button id="btn-back-from-expert-bid" onClick={() => navigate('/expert/service/projects')} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft size={16} />Back to projects</button>
      <div className="flex items-start justify-between gap-4"><div><h1 className="font-headline text-2xl font-semibold text-slate-900">Bid negotiation</h1><p className="mt-1 text-sm text-slate-500">{engagement.project?.projectName ?? 'Project'} · offer v{offer?.version ?? bid.versionNumber}</p></div>{bid.termsLocked ? <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"><LockKeyhole size={16} />Terms locked</span> : null}</div>

      {bid.technicalReview?.status === 'REVISION_REQUESTED' ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><strong>Technical revision requested.</strong> {bid.technicalReview.feedback || bid.techFeedback}</div> : null}
      {bid.negotiationState === 'AWAITING_TECH_REVIEW' && !canRevise ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">Tech Team is reviewing the current technical scope.</div> : null}

      {offer ? <Card><CardContent className="space-y-4 p-6"><div className="flex justify-between"><h2 className="font-semibold text-slate-900">{bid.termsLocked ? 'Accepted milestones' : 'Current offer'}</h2><strong className="text-emerald-700">{formatVND(total)}</strong></div>{offer.milestones.map((milestone) => <div key={milestone.milestone_number} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold text-slate-800">M{milestone.milestone_number}. {milestone.deliverable_statement}</h3><span className="font-mono text-sm">{formatVND(milestone.price_vnd ?? 0)}</span></div>{milestone.estimated_duration_days ? <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500"><Clock size={13} />{milestone.estimated_duration_days} days</p> : null}<ul className="mt-3 list-disc pl-5 text-sm text-slate-600">{milestone.criteria.map((criterion) => <li key={criterion.criterion_text}>{criterion.criterion_text}</li>)}</ul></div>)}</CardContent></Card> : null}

      {/* reconciliation-required takes priority over the generic error message */}
      {needsReconciliation ? (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <AlertTriangle size={18} className="shrink-0" />
            <span>This is an older bid that needs its contract terms migrated to the current format before you can continue.</span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={reconcileBid.isPending}
            onClick={() => reconcileBid.mutate(bid.id)}
            className="shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            {reconcileBid.isPending ? <><Spinner size="sm" className="mr-1.5" />Reconciling...</> : <><RefreshCw size={14} className="mr-1.5" />Reconcile Contract Terms</>}
          </Button>
        </div>
      ) : mutationError ? (
        <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={18} />{genericErrorMessage}</div>
      ) : null}

      {showCounter && bid.currentOffer ? <CounterOfferPanel bidId={bid.id} currentOffer={bid.currentOffer} onCancel={() => setShowCounter(false)} onSuccess={() => setShowCounter(false)} /> : null}

      {(canAct || canRevise) && !showCounter ? <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">{canAct ? <><Button id="btn-expert-decline-offer" variant="destructive" disabled={declineOffer.isPending} onClick={() => declineOffer.mutate({ bidId: bid.id, offerId: bid.currentOffer!.id })} className="cursor-pointer disabled:cursor-not-allowed">Decline</Button><Button id="btn-expert-accept-offer" variant="primary" disabled={acceptOffer.isPending} onClick={() => acceptOffer.mutate({ bidId: bid.id, offerId: bid.currentOffer!.id }, { onSuccess: (result) => navigate(`/expert/engagements/${result.engagementId}/nda`) })} className="cursor-pointer disabled:cursor-not-allowed">Accept offer</Button></> : null}<Button id="btn-expert-counter-offer" variant="secondary" onClick={() => setShowCounter(true)} className="cursor-pointer">{canRevise ? 'Revise technical terms' : 'Counter offer'}</Button></div> : null}

      {/* Withdraw Bid — only while SUBMITTED or TECH_REVIEW, ends the engagement */}
      {canWithdraw && !showCounter ? (
        <div className="flex justify-end border-t border-slate-200 pt-5">
          <Button
            id="btn-expert-withdraw-bid"
            variant="ghost"
            disabled={withdrawBid.isPending}
            onClick={() => setShowWithdrawConfirm(true)}
            className="cursor-pointer text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed"
          >
            <XCircle size={16} className="mr-1.5" />
            Withdraw Bid
          </Button>
        </div>
      ) : null}

      {bid.termsLocked ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-sm text-emerald-800">The accepted milestones are immutable. NDA completion unlocks funding and execution.</p><Button id="btn-open-expert-nda" variant="primary" className="mt-3 cursor-pointer" onClick={() => setShowNdaModal(true)}>Sign / view NDA</Button></div> : null}

      <Modal
        isOpen={showNdaModal}
        onClose={() => setShowNdaModal(false)}
        className="w-full max-w-3xl sm:max-w-3xl p-0 overflow-hidden bg-slate-50"
      >
        <div className="h-[80vh] overflow-y-auto">
          <ExpertNdaClickThrough engagementId={engagementId} />
        </div>
      </Modal>

      <ConfirmModal
        isOpen={showWithdrawConfirm}
        onClose={() => setShowWithdrawConfirm(false)}
        onConfirm={() => {
          withdrawBid.mutate(bid.id, {
            onSuccess: () => {
              setShowWithdrawConfirm(false);
              navigate('/expert/service/projects');
            },
          });
        }}
        title="Withdraw this bid?"
        confirmText="Withdraw Bid"
        isDestructive
      >
        <p className="text-sm text-slate-600">
          This will withdraw your bid and end this engagement. The client will
          be notified. This action cannot be undone — you would need to
          submit a new bid if you change your mind.
        </p>
      </ConfirmModal>
    </div>
  );
}