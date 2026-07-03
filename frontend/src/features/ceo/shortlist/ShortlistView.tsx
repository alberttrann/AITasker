import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useShortlist } from '@/hooks/use-matching';
import { useProjects } from '@/hooks/use-projects';
import { Spinner } from '@/components/ui/Spinner';
import { RefreshCw } from 'lucide-react';
import MatchCard from './MatchCard';

export default function ShortlistView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const { projects } = useProjects();
  const project = projects.find((p: any) => p.id === projectId);
  const projectName = project?.projectName || `Project ${projectId}`;

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
        <Button variant="secondary" onClick={() => navigate(`/ceo/projects/${projectId}`)}>
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-body-md font-bold text-secondary">
            Matched Experts for
          </p>
          <h2 className="text-h2 font-headline text-primary mt-1">
            {projectName}
          </h2>
          {formattedDate && (
            <p className="text-sm text-secondary mt-1">
              Last refreshed: {formattedDate}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => refresh()} disabled={isRefreshing} className="flex items-center gap-2">
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Refreshing..." : "Refresh Matches"}
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/ceo/projects/${projectId}`)}>
            Back to Project
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {experts.map((expert, i) => (
          <MatchCard key={expert.expert_id || i} expert={expert} projectId={projectId!} projectName={projectName} />
        ))}
      </div>
    </div>
  );
}
