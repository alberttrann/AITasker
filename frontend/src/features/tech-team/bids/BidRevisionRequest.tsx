import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/Modal';
import { AlertTriangle, ArrowLeft, MessageSquareWarning } from 'lucide-react';
import { cn } from '@/lib/utils';

import { useTechReview } from '@/hooks/use-bids';

export default function BidRevisionRequest() {
  const { bidId } = useParams<{ bidId: string }>();
  const navigate = useNavigate();
  const requestRevision = useTechReview();
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
      {
        bidId,
        body: { action: 'REVISION_REQUESTED', tech_feedback: feedback.trim() }
      },
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
    <div className="w-full max-w-[1440px] mx-auto space-y-6">
      <button
        id="btn-back-from-tech-bid-revision"
        onClick={() => navigate(`/tech-team/bids/${bidId}`)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <ArrowLeft size={16} />
        <span>Back to Bid</span>
      </button>

      <h1 className="font-headline text-[24px] font-semibold text-primary">
        Request Revision
      </h1>

      {/* Server error */}
      {serverError && (
        <div className="rounded-DEFAULT border border-[#FECACA] bg-[#FEF2F2] p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-error mt-0.5" />
          <p className="text-[14px] text-[#DC2626]">{serverError}</p>
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MessageSquareWarning className="h-5 w-5 shrink-0 text-warning mt-0.5" />
              <div>
                <h3 className="font-headline text-[14px] font-semibold text-primary">
                  Provide Feedback
                </h3>
                <p className="mt-0.5 text-[13px] text-secondary">
                  Explain what needs to be revised. The current offer proposer
                  will receive the feedback and can update the technical scope.
                </p>
              </div>
            </div>

            {/* Feedback textarea */}
            <div>
              <label
                htmlFor="tech-feedback"
                className="block text-[12px] font-medium text-secondary mb-1"
              >
                Revision Feedback
                <span className="ml-1 text-error">*</span>
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
                  'w-full rounded-DEFAULT border bg-white px-3.5 py-2.5 font-body text-[14px] leading-[1.6] text-primary placeholder:text-primary-light transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-warning/20',
                  feedbackError
                    ? 'border-error ring-1 ring-error/10'
                    : 'border-[#E2E8F0]'
                )}
                placeholder="e.g. The footprint alignment for seam A↔C is insufficient. Please provide more evidence..."
              />
              <div className="mt-1 flex items-center justify-between">
                {feedbackError && (
                  <p id="feedback-error" className="text-[12px] text-error" role="alert">
                    {feedbackError}
                  </p>
                )}
                <span
                  className={cn(
                    'ml-auto text-[12px]',
                    remaining < minLen ? 'text-error' : 'text-primary-light'
                  )}
                >
                  {remaining}/{minLen} min
                </span>
              </div>
            </div>

            <Button
              id={`btn-open-tech-revision-confirm-${bidId}`}
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
        The current proposer will be notified and can revise the offer. This action
        cannot be undone.
      </ConfirmModal>
    </div>
  );
}
