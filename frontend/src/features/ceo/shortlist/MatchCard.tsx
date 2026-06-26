import type { MatchResult, GapMapItem } from '@t/jsonb.types';

interface MatchCardProps {
  expert: MatchResult;
}

const STRENGTH_STYLES: Record<string, string> = {
  Strong: 'bg-[#22C55E15] text-[#16A34A]',
  Qualified: 'bg-[#0EA5E915] text-[#0284C7]',
  Conditional: 'bg-[#EAB30815] text-[#CA8A04]',
};

export default function MatchCard({ expert }: MatchCardProps) {
  const name = (expert as any).expert_profile?.fullName || 'Expert';
  const strength = expert.strength_label || 'Conditional';
  const strengthStyle = STRENGTH_STYLES[strength] ?? STRENGTH_STYLES.Conditional;
  const stackTags = ((expert as any).expert_profile?.stack_tags ?? []) as string[];
  const gaps: GapMapItem[] = expert.gap_map ?? [];

  return (
    <div className="rounded-lg border border-slate-200 bg-surface p-5 transition-shadow hover:shadow-md">
      {/* Header: name + strength label */}
      <div className="mb-3 flex items-start justify-between">
        <h3 className="text-body font-headline font-semibold text-primary">
          {name}
        </h3>
        <span className={`inline-flex items-center rounded-[4px] px-[12px] py-[4px] text-[12px] font-medium uppercase tracking-[0.5px] ${strengthStyle}`}>
          {strength}
        </span>
      </div>

      {/* Seam Coverage */}
      {gaps.length > 0 && (
        <div className="mb-3">
          <span className="text-caption text-secondary">Seam Coverage</span>
          <div className="mt-1 flex gap-1">
            {gaps.map((g) => (
              <span
                key={g.seam_code}
                className={`h-3 w-3 rounded-full ${
                  g.color === 'green'
                    ? 'bg-success'
                    : g.color === 'amber'
                      ? 'bg-warning'
                      : 'bg-error'
                }`}
                title={g.seam_code}
              />
            ))}
          </div>
        </div>
      )}

      {/* Stack Tags */}
      {stackTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {stackTags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-primary-bg px-2 py-0.5 text-caption text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
