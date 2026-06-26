import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import type { ShortlistDto } from '@t/api.types';
import type { MatchResult } from '@t/jsonb.types';
import MatchCard from './MatchCard';

export default function ShortlistView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [experts, setExperts] = useState<MatchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    const fetchShortlist = async () => {
      try {
        const { data } = await apiClient.get<ShortlistDto>(
          `/matching/${projectId}/shortlist`,
        );
        if (!cancelled) {
          setExperts(data.results ?? []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
              'Failed to load matched experts. Please try again.',
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchShortlist();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // ── Loading ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-4">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-body text-secondary">
            Loading matched experts…
          </p>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-body-lg font-headline text-error">{error}</p>
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
      <div className="flex items-center justify-between">
        <h2 className="text-h2 font-headline text-primary">
          Matched Experts for Your Project
        </h2>
        <Button variant="secondary" onClick={() => navigate('/ceo')}>
          Back to Dashboard
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {experts.map((expert, i) => (
          <MatchCard key={expert.expert_id || i} expert={expert} />
        ))}
      </div>
    </div>
  );
}
