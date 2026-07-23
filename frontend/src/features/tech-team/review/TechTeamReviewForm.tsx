import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { useEngagement } from '@/hooks/use-engagements';
import ReviewForm from '@/components/reviews/ReviewForm';

export default function TechTeamReviewForm() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const navigate = useNavigate();
  const { data: engagement, isLoading, error } = useEngagement(engagementId);

  if (isLoading) {
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

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 py-8">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back
      </button>
      <div>
        <h1 className="font-headline text-2xl font-semibold text-slate-900">Leave a Review</h1>
        <p className="mt-1 text-sm text-slate-500">
          {engagement.project?.projectName ?? 'This engagement'} has been completed.
          Your technical assessment helps future clients evaluate this expert.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <ReviewForm
          engagementId={engagement.id}
          targetId={engagement.expertId}
          targetLabel="the expert"
          requireStructuredSignals={true}
          onSuccess={() => navigate('/tech-team/projects')}
        />
      </div>
    </div>
  );
}