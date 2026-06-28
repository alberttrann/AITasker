import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { MatchResult, GapMapItem } from '@t/jsonb.types';
import { Modal } from '@/components/ui/modal';
import { CheckCircle } from 'lucide-react';

interface MatchCardProps {
  expert: MatchResult;
}

const STRENGTH_STYLES: Record<string, string> = {
  STRONG_MATCH: 'bg-[#22C55E15] text-[#16A34A]',
  GOOD_MATCH: 'bg-[#0EA5E915] text-[#0284C7]',
  POSSIBLE_MATCH: 'bg-[#EAB30815] text-[#CA8A04]',
  WEAK_MATCH: 'bg-red-50 text-red-600',
};

export default function MatchCard({ expert }: MatchCardProps) {
  // Fetch public profile since matching backend strips it
  const { data: profile, isLoading } = useQuery({
    queryKey: ['expertProfile', expert.expert_id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/users/${expert.expert_id}/public-profile`);
      return data;
    },
  });

  const [isModalOpen, setIsModalOpen] = useState(false);

  const name = isLoading ? 'Loading Expert...' : profile?.fullName || 'Expert';
  const strength = expert.strength_label || 'POSSIBLE_MATCH';
  const strengthStyle = STRENGTH_STYLES[strength] ?? STRENGTH_STYLES.POSSIBLE_MATCH;
  const strengthDisplay = strength.replace('_MATCH', '').replace('_', ' ');
  const stackTags = (profile?.stackTags ?? []) as string[];
  const gaps: GapMapItem[] = expert.gap_map ?? [];

  return (
    <>
      <div 
        className="rounded-lg border border-slate-200 bg-surface p-5 transition-shadow hover:shadow-md cursor-pointer"
        onClick={() => setIsModalOpen(true)}
      >
        {/* Header: name + strength label */}
        <div className="mb-3 flex items-start justify-between">
          <h3 className="text-body font-headline font-semibold text-primary">
            {name}
          </h3>
          <span className={`inline-flex items-center rounded-[4px] px-[12px] py-[4px] text-[12px] font-medium uppercase tracking-[0.5px] ${strengthStyle}`}>
            {strengthDisplay}
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

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Expert Profile"
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-[18px] font-headline font-semibold text-primary">
                {name}
              </h3>
              <p className="text-body-sm text-secondary">ID: {expert.expert_id}</p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center rounded-[4px] px-[12px] py-[4px] text-[12px] font-medium uppercase tracking-[0.5px] ${strengthStyle}`}>
                {strengthDisplay}
              </span>
            </div>
          </div>

          {/* Seam Coverage Section */}
          {gaps.length > 0 && (
            <div>
              <h4 className="text-[14px] font-semibold text-primary mb-2">Seam Coverage</h4>
              <div className="flex flex-col gap-2">
                {gaps.map((g) => {
                  const isVerified = profile?.seamClaims?.some(
                    (sc: any) => sc.seamCode === g.seam_code && (sc.verificationTier === 'EVIDENCE_BACKED' || sc.verificationTier === 'VERIFIED')
                  );
                  
                  return (
                    <div key={g.seam_code} className="flex items-center gap-3">
                      <span
                        className={`h-3 w-3 rounded-full shrink-0 ${
                          g.color === 'green'
                            ? 'bg-success'
                            : g.color === 'amber'
                              ? 'bg-warning'
                              : 'bg-error'
                        }`}
                      />
                      <span className="text-[14px] text-secondary flex items-center gap-2">
                        {g.seam_code} 
                        {g.color === 'green' && ' (Full Coverage)'}
                        {g.color === 'amber' && ' (Partial Coverage)'}
                        {g.color === 'red' && ' (Gap)'}
                        
                        {isVerified && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                            <CheckCircle className="h-3 w-3" /> Verified
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Domains Section */}
          {profile?.domains && profile.domains.length > 0 && (
            <div>
              <h4 className="text-[14px] font-semibold text-primary mb-2">Domains</h4>
              <div className="flex flex-col gap-2">
                {profile.domains.map((domain: any) => (
                  <div key={domain.code} className="text-[14px] text-secondary">
                    <span className="font-medium text-primary">{domain.code}</span>: {domain.depth}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stack Tags Section */}
          {stackTags.length > 0 && (
            <div>
              <h4 className="text-[14px] font-semibold text-primary mb-2">Technical Stack</h4>
              <div className="flex flex-wrap gap-2">
                {stackTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-primary-bg px-2 py-1 text-[13px] text-secondary border border-slate-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
