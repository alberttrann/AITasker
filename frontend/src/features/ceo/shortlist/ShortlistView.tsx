import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { getShortlist } from '@/hooks/use-matching';
import { Spinner } from '@/components/ui/Spinner';
import { RefreshCw } from 'lucide-react';
import MatchCard from './MatchCard';

export default function ShortlistView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['shortlist', projectId],
    queryFn: () => getShortlist(projectId!),
    enabled: !!projectId,
  });

  const experts = data?.results ?? [];
  const errorMessage = error ? ((error as any).response?.data?.message || 'Failed to load matched experts. Please try again.') : null;

  const formattedDate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : null;

  // ── Loading ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-4">
          <Spinner size="xl" className="mx-auto" />
          <p className="text-body text-secondary">
            Loading matched experts…
          </p>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────

  if (errorMessage) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-body-lg font-headline text-error">{errorMessage}</p>
        <Button variant="secondary" onClick={() => navigate('/ceo')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────

  if (experts.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-body text-secondary">
          ⏳ Matching in progress… Experts are being scored for your project.
        </p>
        <p className="mt-2 text-body-sm text-secondary">
          Check back in a moment.
        </p>
      </div>
    );
  }

  // ── Results ─────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-h2 font-headline text-primary">
            Matched Experts for Your Project
          </h2>
          {formattedDate && (
            <p className="text-sm text-secondary mt-1">
              Last refreshed: {formattedDate}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="flex items-center gap-2">
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
            {isFetching ? "Refreshing..." : "Refresh Matches"}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/ceo')}>
            Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {experts.map((expert, i) => (
          <MatchCard key={expert.expert_id || i} expert={expert} />
        ))}
      </div>
    </div>
  );
}
