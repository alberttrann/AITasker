import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/modal';
import { AlertTriangle, CheckCircle2, ArrowLeft } from 'lucide-react';

// ── Inline hook: PUT /bids/:id/tech-review ───────────────────────

function useApproveBid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bidId: string) => {
      const { data } = await apiClient.put(`/bids/${bidId}/tech-review`, {
        action: 'APPROVED',
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bids'] });
      qc.invalidateQueries({ queryKey: ['engagements'] });
    },
  });
}

export default function BidApprove() {
  const { bidId } = useParams<{ bidId: string }>();
  const navigate = useNavigate();
  const approveBid = useApproveBid();
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleApprove = () => {
    if (!bidId) return;
    setServerError(null);
    approveBid.mutate(bidId, {
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
    <div className="mx-auto max-w-[560px] space-y-6">
      <button
        onClick={() => navigate(`/tech-team/bids/${bidId}`)}
        className="inline-flex items-center gap-1.5 text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Bid
      </button>

      <h1 className="font-headline text-[24px] font-semibold text-[#0F172A]">
        Approve Bid
      </h1>

      {/* Server error */}
      {serverError && (
        <div className="rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[#EF4444] mt-0.5" />
          <p className="text-[14px] text-[#DC2626]">{serverError}</p>
        </div>
      )}

      {/* Success */}
      {approveBid.isSuccess && (
        <div className="rounded-[8px] border border-[#BBF7D0] bg-[#F0FDF4] p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#22C55E] mt-0.5" />
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
              notified and can proceed to accept or decline the bid.
            </p>

            <div className="rounded-[8px] bg-[#F0FDF4] border border-[#BBF7D0] p-4">
              <h4 className="text-[13px] font-semibold text-[#16A34A] mb-1">
                What happens next?
              </h4>
              <ul className="space-y-1 text-[13px] text-[#166534]">
                <li>• The bid status changes to TECH_APPROVED</li>
                <li>• The CEO can now review and accept/decline the bid</li>
                <li>• This action cannot be undone</li>
              </ul>
            </div>

            <Button
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
