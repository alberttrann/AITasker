import { useState } from 'react';
import { Star, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/Spinner';
import {
  useCreateReview,
  isAlreadyReviewedError,
  isEngagementNotClosedError,
  type TechTeamReviewSignals,
} from '@/hooks/use-reviews';

interface ReviewFormProps {
  engagementId: string;
  targetId: string;
  /**
   * Display name/label for the party being reviewed, e.g. "the expert" or
   * a real name if the caller already has it. Deliberately NOT fetched
   * internally via usePublicProfile(targetId) — that endpoint
   * (GET /users/:userId/public-profile) throws a 404 for any user without
   * an ExpertProfile record, which includes every CEO/client. Since this
   * form is also used for Expert-reviews-CEO, fetching generically here
   * would break that direction. Callers should pass whatever display
   * context they already have (a role label is fine and is what both
   * CeoReviewForm.tsx and ExpertReviewForm.tsx currently pass).
   */
  targetLabel: string;
  /**
   * Set true for Tech-Team reviewers — the backend REQUIRES
   * structuredSignalsJson in this case (BadRequestException otherwise).
   * Determine this from the caller's own auth state
   * (activeRole === 'CLIENT' && clientSubtype === 'TECH_TEAM'), not from
   * anything about the target — the backend derives reviewerRole from the
   * caller, never from the request body.
   */
  requireStructuredSignals?: boolean;
  /** Seam codes the expert claimed/worked on this engagement, if known — pre-populates the per-seam rating rows for Tech-Team reviewers. Optional; falls back to a single free-text seam entry if omitted. */
  knownSeamCodes?: string[];
  onSuccess?: () => void;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Below average',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
};

function StarInput({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(null)}
          className="disabled:cursor-not-allowed cursor-pointer transition-transform hover:scale-110"
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
        >
          <Star
            size={28}
            className={display >= n ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}
          />
        </button>
      ))}
      {display > 0 && (
        <span className="ml-2 text-sm font-medium text-slate-500">{RATING_LABELS[display]}</span>
      )}
    </div>
  );
}

export default function ReviewForm({
  engagementId,
  targetId,
  targetLabel,
  requireStructuredSignals = false,
  knownSeamCodes,
  onSuccess,
}: ReviewFormProps) {
  const createReview = useCreateReview();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [codeQualityRating, setCodeQualityRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [seamRatings, setSeamRatings] = useState<{ seamCode: string; rating: number }[]>(
    (knownSeamCodes && knownSeamCodes.length > 0
      ? knownSeamCodes
      : ['']
    ).map((code) => ({ seamCode: code, rating: 0 })),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const displayName = targetLabel;

  const updateSeamRating = (index: number, field: 'seamCode' | 'rating', value: string | number) => {
    setSeamRatings((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };
  const addSeamRow = () => setSeamRatings((prev) => [...prev, { seamCode: '', rating: 0 }]);
  const removeSeamRow = (i: number) => setSeamRatings((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (rating < 1) {
      setValidationError('Please select a star rating.');
      return;
    }

    let structuredSignalsJson: string | undefined;

    if (requireStructuredSignals) {
      if (codeQualityRating < 1 || communicationRating < 1) {
        setValidationError('Please rate both code quality and communication.');
        return;
      }
      if (wouldRecommend === null) {
        setValidationError('Please indicate whether you would recommend this expert.');
        return;
      }
      const cleanSeamRatings = seamRatings.filter((s) => s.seamCode.trim() && s.rating > 0);
      const signals: TechTeamReviewSignals = {
        codeQualityRating,
        communicationRating,
        seamRatings: cleanSeamRatings,
        wouldRecommend,
      };
      structuredSignalsJson = JSON.stringify(signals);
    }

    createReview.mutate(
      {
        engagementId,
        targetId,
        rating,
        comment: comment.trim() || undefined,
        structuredSignalsJson,
      },
      {
        onSuccess: () => {
          setSubmitted(true);
          onSuccess?.();
        },
      },
    );
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center text-center py-8">
        <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
          <Star size={26} className="fill-emerald-500 text-emerald-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Review submitted</h3>
        <p className="text-sm text-slate-500">Thanks for sharing your feedback.</p>
      </div>
    );
  }

  const alreadyReviewed = isAlreadyReviewedError(createReview.error);
  const notClosed = isEngagementNotClosedError(createReview.error);
  const genericError =
    createReview.isError && !alreadyReviewed && !notClosed
      ? (createReview.error as any)?.response?.data?.message || 'Failed to submit review.'
      : null;

  if (alreadyReviewed) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <AlertCircle size={16} className="shrink-0" />
        You've already submitted a review for this engagement.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {notClosed && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle size={16} className="shrink-0" />
          This engagement isn't closed yet — reviews unlock once it's fully settled.
        </div>
      )}
      {genericError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          {genericError}
        </div>
      )}
      {validationError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          {validationError}
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-slate-800 mb-2">
          How was your experience with {displayName}?
        </label>
        <StarInput value={rating} onChange={setRating} disabled={createReview.isPending} />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Comment <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={createReview.isPending}
          rows={3}
          placeholder="Share more about your experience..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-50"
        />
      </div>

      {requireStructuredSignals && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Technical Assessment
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Code Quality</label>
            <StarInput value={codeQualityRating} onChange={setCodeQualityRating} disabled={createReview.isPending} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Communication</label>
            <StarInput value={communicationRating} onChange={setCommunicationRating} disabled={createReview.isPending} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Per-seam ratings</label>
            <div className="space-y-2">
              {seamRatings.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Seam code (e.g. A↔B)"
                    value={s.seamCode}
                    onChange={(e) => updateSeamRating(i, 'seamCode', e.target.value)}
                    disabled={createReview.isPending}
                    className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-50"
                  />
                  <StarInput
                    value={s.rating}
                    onChange={(v) => updateSeamRating(i, 'rating', v)}
                    disabled={createReview.isPending}
                  />
                  {seamRatings.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSeamRow(i)}
                      disabled={createReview.isPending}
                      className="text-slate-400 hover:text-rose-600 text-xs px-1"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addSeamRow}
                disabled={createReview.isPending}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                + Add another seam
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Would you bring this expert back for a similar engagement?
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={wouldRecommend === true ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setWouldRecommend(true)}
                disabled={createReview.isPending}
              >
                Yes
              </Button>
              <Button
                type="button"
                variant={wouldRecommend === false ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setWouldRecommend(false)}
                disabled={createReview.isPending}
              >
                No
              </Button>
            </div>
          </div>
        </div>
      )}

      <Button type="submit" disabled={createReview.isPending} className="w-full">
        {createReview.isPending ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Submitting...
          </>
        ) : (
          'Submit Review'
        )}
      </Button>
    </form>
  );
}