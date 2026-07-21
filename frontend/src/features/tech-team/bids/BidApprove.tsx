import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/Modal';
import { AlertTriangle, CheckCircle2, ArrowLeft } from 'lucide-react';

import { useTechReview } from '@/hooks/use-bids';

export default function BidApprove() {
  const { bidId } = useParams<{ bidId: string }>();
  const navigate = useNavigate();
  const approveBid = useTechReview();
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleApprove = () => {
    if (!bidId) return;
    setServerError(null);
    approveBid.mutate({ bidId, body: { action: 'APPROVED', tech_feedback: '' } }, {
      onSuccess: () => {
        navigate('/tech-team/bids', { replace: true });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message || 'Failed to approve bid.';
        setServerError(Array.isArray(msg) ? msg[0] : msg);
      },
    });
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto space-y-6">
      <button
        id="btn-back-from-tech-bid-approval"
        onClick={() => navigate(`/tech-team/bids/${bidId}`)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <ArrowLeft size={16} />
        <span>Back to Bid</span>
      </button>

      <h1 className="font-headline text-[24px] font-semibold text-primary">
        Approve Bid
      </h1>

      {/* Server error */}
      {serverError && (
        <div className="rounded-DEFAULT border border-[#FECACA] bg-[#FEF2F2] p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-error mt-0.5" />
          <p className="text-[14px] text-[#DC2626]">{serverError}</p>
        </div>
      )}

      {/* Success */}
      {approveBid.isSuccess && (
        <div className="rounded-DEFAULT border border-[#BBF7D0] bg-[#F0FDF4] p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success mt-0.5" />
          <p className="text-[14px] text-[#16A34A]">
            Bid approved! Redirecting…
          </p>
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <p className="text-body text-[#334155] leading-[1.7]">
              You are about to <strong>approve</strong> this bid. The CEO will be
              notified when they are the current offer recipient.
            </p>

            <div className="rounded-DEFAULT bg-[#F0FDF4] border border-[#BBF7D0] p-4">
              <h4 className="text-[13px] font-semibold text-[#16A34A] mb-1">
                What happens next?
              </h4>
              <ul className="space-y-1 text-[13px] text-[#166534]">
                <li>• The bid status changes to TECH_APPROVED</li>
                <li>• The intended CEO/Expert recipient can review the offer</li>
                <li>• This action cannot be undone</li>
              </ul>
            </div>

            <Button
              id={`btn-open-tech-bid-approval-confirm-${bidId}`}
              variant="primary"
              className="w-full"
              onClick={() => setShowConfirm(true)}
              disabled={approveBid.isPending}
            >
              {approveBid.isPending ? 'Approving…' : 'Approve Bid'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleApprove}
        title="Confirm Approval"
        confirmText="Approve"
        isDestructive={false}
        isInfo
      >
        Are you sure you want to approve this bid? It will be sent to the CEO
        for final decision.
      </ConfirmModal>
    </div>
  );
}
