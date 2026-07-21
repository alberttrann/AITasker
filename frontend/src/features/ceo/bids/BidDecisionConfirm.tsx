import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAcceptOffer, useBid, useDeclineOffer } from '@/hooks/use-bids';
import { formatVND } from '@/lib/utils';

export default function BidDecisionConfirm() {
  const { projectId, bidId } = useParams<{ projectId: string; bidId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const action = searchParams.get('action') === 'decline' ? 'decline' : 'accept';
  const { data: bid, isLoading, error } = useBid(bidId ?? '');
  const acceptOffer = useAcceptOffer();
  const declineOffer = useDeclineOffer();
  const offer = bid?.currentOffer;

  if (isLoading) return <div className="flex justify-center py-24"><Spinner size="xl" /></div>;
  if (error || !bid || !offer) return <div className="py-20 text-center text-red-600">The current offer is unavailable.</div>;

  const total = offer.milestones.reduce((sum, milestone) => sum + (milestone.price_vnd ?? 0), 0);
  const pending = acceptOffer.isPending || declineOffer.isPending;
  const mutationError = acceptOffer.error || declineOffer.error;

  const confirm = () => {
    if (action === 'accept') {
      acceptOffer.mutate(
        { bidId: bid.id, offerId: offer.id },
        { onSuccess: (result) => navigate(`/ceo/engagements/${result.engagementId}/nda`, { replace: true }) },
      );
      return;
    }
    declineOffer.mutate(
      { bidId: bid.id, offerId: offer.id },
      { onSuccess: () => navigate(`/ceo/projects/${projectId}/bids`, { replace: true }) },
    );
  };

  return (
    <div className="mx-auto max-w-[720px] space-y-5">
      <button id="btn-back-from-bid-decision" onClick={() => navigate(-1)} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft size={16} />Back</button>
      <Card><CardContent className="space-y-5 p-6">
        <div><h1 className="font-headline text-xl font-semibold text-slate-900">{action === 'accept' ? 'Accept final offer?' : 'Decline this offer?'}</h1><p className="mt-2 text-sm text-slate-600">{action === 'accept' ? 'Acceptance immediately creates and locks the milestone contract. NDA signing follows.' : 'Declining closes this bid without creating milestones.'}</p></div>
        <div className="rounded-lg bg-slate-50 p-4"><div className="flex justify-between text-sm"><span>Offer version</span><strong>v{offer.version}</strong></div><div className="mt-2 flex justify-between text-sm"><span>Total</span><strong>{formatVND(total)}</strong></div></div>
        {mutationError ? <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={18} />{(mutationError as any)?.response?.data?.message?.message || (mutationError as any)?.response?.data?.message || 'Decision failed.'}</div> : null}
        <div className="flex justify-end gap-3"><Button id="btn-cancel-bid-decision" variant="ghost" onClick={() => navigate(-1)} className="cursor-pointer">Cancel</Button><Button id={`btn-confirm-${action}-bid-offer`} variant={action === 'accept' ? 'primary' : 'destructive'} disabled={pending} onClick={confirm} className="cursor-pointer disabled:cursor-not-allowed">{pending ? 'Saving…' : action === 'accept' ? 'Accept and lock milestones' : 'Decline offer'}</Button></div>
      </CardContent></Card>
    </div>
  );
}
