import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Star } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { useEngagement } from '@/hooks/use-engagements';
import { useEngagementReviews } from '@/hooks/use-reviews';
import { useAuthStore } from '@/store/auth.store';
import ReviewForm from '@/components/reviews/ReviewForm';

export default function CeoReviewForm() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);
  const { data: engagement, isLoading, error } = useEngagement(engagementId);
  const {
    data: reviews,
    isLoading: areReviewsLoading,
    error: reviewsError,
    refetch: refetchReviews,
  } = useEngagementReviews(
    engagement?.state === 'CLOSED' ? engagementId : undefined,
  );
  const existingReview = reviews?.find((review) => review.reviewerId === userId);

  if (isLoading || (engagement?.state === 'CLOSED' && areReviewsLoading)) {
    return <div className="flex justify-center py-24"><Spinner size="xl" /></div>;
  }
  if (error || !engagement) {
    return <div className="py-20 text-center text-red-600">Could not load this engagement.</div>;
  }
  if (engagement.state !== 'CLOSED') {
    return (
      <div className="mx-auto max-w-lg py-16">
        <ErrorBanner message="This engagement isn't closed yet — reviews unlock once it's fully settled." />
      </div>
    );
  }
  if (reviewsError) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <ErrorBanner
          message="Could not check your existing review. Refresh this page before trying again."
          onRetry={() => refetchReviews()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 py-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex cursor-pointer items-center gap-2 rounded-md text-sm text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        id="btn-back-from-ceo-review"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back
      </button>
      <div>
        <h1 className="font-headline text-2xl font-semibold text-slate-900">
          {existingReview ? 'Your Review' : 'Leave a Review'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {engagement.project?.projectName ?? 'This engagement'} has been completed.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        {existingReview ? (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Your rating for the expert
              </p>
              <div
                className="mt-2 flex items-center gap-1"
                role="img"
                aria-label={`${existingReview.rating} out of 5 stars`}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={28}
                    aria-hidden="true"
                    className={
                      star <= existingReview.rating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-200'
                    }
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-800">Your comment</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                {existingReview.comment || 'No written comment was provided.'}
              </p>
            </div>

            <p className="border-t border-slate-100 pt-4 text-xs text-slate-500">
              This review has been submitted and cannot be edited or submitted again.
            </p>
          </div>
        ) : (
          <ReviewForm
            engagementId={engagement.id}
            targetId={engagement.expertId}
            targetLabel="the expert"
            requireStructuredSignals={false}
            onSuccess={() => navigate('/ceo/projects')}
          />
        )}
      </div>
    </div>
  );
}
