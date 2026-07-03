import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/Modal';
import { AlertTriangle, ArrowLeft, MessageSquareWarning } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Inline hook: PUT /bids/:id/tech-review (REVISION_REQUESTED) ──

function useRequestRevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bidId,
      feedback,
    }: {
      bidId: string;
      feedback: string;
    }) => {
      const { data } = await apiClient.put(`/bids/${bidId}/tech-review`, {
        action: 'REVISION_REQUESTED',
        tech_feedback: feedback,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bids'] });
      qc.invalidateQueries({ queryKey: ['engagements'] });
    },
  });
}

export default function BidRevisionRequest() {
  const { bidId } = useParams<{ bidId: string }>();
  const navigate = useNavigate();
  const requestRevision = useRequestRevision();
  const [feedback, setFeedback] = useState('');
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const minLen = 20;
  const remaining = feedback.length;

  const handleSubmit = () => {
    setFeedbackError(null);
    setServerError(null);

    if (feedback.trim().length < minLen) {
      setFeedbackError(`Feedback must be at least ${minLen} characters.`);
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirm = () => {
    if (!bidId) return;
    requestRevision.mutate(
      { bidId, feedback: feedback.trim() },
      {
        onSuccess: () => {
          navigate(`/tech-team/bids/${bidId}`, { replace: true });
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message || 'Failed to request revision.';
          setServerError(Array.isArray(msg) ? msg[0] : msg);
        },
      }
    );
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
        Request Revision
      </h1>

      {/* Server error */}
      {serverError && (
        <div className="rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[#EF4444] mt-0.5" />
          <p className="text-[14px] text-[#DC2626]">{serverError}</p>
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MessageSquareWarning className="h-5 w-5 shrink-0 text-[#EAB308] mt-0.5" />
              <div>
                <h3 className="font-headline text-[14px] font-semibold text-[#0F172A]">
                  Provide Feedback
                </h3>
                <p className="mt-0.5 text-[13px] text-[#64748B]">
                  Explain what needs to be revised. The expert will see this
                  feedback and can update their bid.
                </p>
              </div>
            </div>

            {/* Feedback textarea */}
            <div>
              <label
                htmlFor="tech-feedback"
                className="block text-[12px] font-medium text-[#64748B] mb-1"
              >
                Revision Feedback
                <span className="ml-1 text-[#EF4444]">*</span>
              </label>
              <textarea
                id="tech-feedback"
                value={feedback}
                onChange={(e) => {
                  setFeedback(e.target.value);
                  if (feedbackError) setFeedbackError(null);
                }}
                disabled={requestRevision.isPending}
                rows={5}
                aria-describedby={feedbackError ? 'feedback-error' : undefined}
                aria-invalid={!!feedbackError}
                className={cn(
                  'w-full rounded-[8px] border bg-white px-[14px] py-[10px] font-body text-[14px] leading-[1.6] text-[#0F172A] placeholder:text-[#94A3B8] transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-[#EAB308]/20',
                  feedbackError
                    ? 'border-[#EF4444] ring-1 ring-[#EF4444]/10'
                    : 'border-[#E2E8F0]'
                )}
                placeholder="e.g. The footprint alignment for seam A↔C is insufficient. Please provide more evidence..."
              />
              <div className="mt-1 flex items-center justify-between">
                {feedbackError && (
                  <p id="feedback-error" className="text-[12px] text-[#EF4444]" role="alert">
                    {feedbackError}
                  </p>
                )}
                <span
                  className={cn(
                    'ml-auto text-[12px]',
                    remaining < minLen ? 'text-[#EF4444]' : 'text-[#94A3B8]'
                  )}
                >
                  {remaining}/{minLen} min
                </span>
              </div>
            </div>

            <Button
              variant="destructive"
              className="w-full"
              onClick={handleSubmit}
              disabled={requestRevision.isPending || feedback.trim().length < minLen}
            >
              {requestRevision.isPending ? 'Sending…' : 'Request Revision'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        title="Confirm Revision Request"
        confirmText="Send Feedback"
        isDestructive
      >
        The expert will be notified and can revise their bid. This action
        cannot be undone.
      </ConfirmModal>
    </div>
  );
}
