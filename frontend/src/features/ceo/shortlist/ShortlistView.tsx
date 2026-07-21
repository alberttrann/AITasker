import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useShortlist } from '@/hooks/use-matching';
import { useProjects } from '@/hooks/use-projects';
import { Spinner } from '@/components/ui/Spinner';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import { useState, useMemo } from 'react';
import { DataList } from '@/components/layout/Table';
import MatchCard from './MatchCard';

export default function ShortlistView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const { projects } = useProjects();
  const project = projects.find((p: any) => p.id === projectId);
  const projectName = project?.projectName || `Project ${projectId}`;

  const handleGoBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate(`/ceo/projects/${projectId}`);
    }
  };

  const {
    experts,
    isLoading,
    isRefreshing,
    refreshError: error,
    lastUpdatedAt,
    refresh
  } = useShortlist(projectId);

  const errorMessage = error ? ((error as any).response?.data?.message || 'Failed to load matched experts. Please try again.') : null;

  const formattedDate = lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : null;

  const [sort, setSort] = useState<'score_desc' | 'score_asc'>('score_desc');

  const sortedExperts = useMemo(() => {
    const STRENGTH_ORDER: Record<string, number> = {
      STRONG_MATCH:   4,
      GOOD_MATCH:     3,
      POSSIBLE_MATCH: 2,
      WEAK_MATCH:     1,
    };
    return [...experts].sort((a: any, b: any) => {
      const scoreA = STRENGTH_ORDER[a.strength_label] ?? 0;
      const scoreB = STRENGTH_ORDER[b.strength_label] ?? 0;
      if (sort === 'score_desc') return scoreB - scoreA;
      if (sort === 'score_asc') return scoreA - scoreB;
      return 0;
    });
  }, [experts, sort]);

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
        <Button variant="secondary" onClick={handleGoBack}>
          Back to Project
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
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col">
          <p className="text-body-md font-bold text-secondary mb-1">
            Matched Experts for
          </p>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleGoBack}
              className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-h2 font-headline text-primary">
              {projectName}
            </h2>
          </div>
          {formattedDate && (
            <p className="text-sm text-secondary mt-1 pl-11">
              Last refreshed: {formattedDate}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 self-end md:self-auto">
          <Button variant="outline" onClick={() => refresh()} disabled={isRefreshing} className="flex items-center gap-2">
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Refreshing..." : "Refresh Matches"}
          </Button>
        </div>
      </div>

      <DataList
        sortOptions={[
          { label: 'Highest Score', value: 'score_desc' },
          { label: 'Lowest Score', value: 'score_asc' },
        ]}
        currentSort={sort}
        onSortChange={(v) => setSort(v as any)}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {sortedExperts.map((expert: any, i: number) => (
            <MatchCard key={expert.expert_id || i} expert={expert} projectId={projectId!} projectName={projectName} />
          ))}
        </div>
      </DataList>
    </div>
  );
}
