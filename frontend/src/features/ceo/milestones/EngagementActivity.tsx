import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge, variantFromStatus } from '@/components/ui/StatusBadge';
import { useEngagementSubmissions, useEngagementDisputes } from '@/hooks/use-engagements';
import { formatVND } from '@/lib/utils';
import { FileText, Scale, History } from 'lucide-react';

interface EngagementActivityProps {
  engagementId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Engagement-scoped Activity view.
 */
export default function EngagementActivity({ engagementId, isOpen, onClose }: EngagementActivityProps) {
  const {
    data: submissions,
    isLoading: submissionsLoading,
    error: submissionsError,
  } = useEngagementSubmissions(isOpen ? engagementId : undefined);

  const {
    data: disputes,
    isLoading: disputesLoading,
    error: disputesError,
  } = useEngagementDisputes(isOpen ? engagementId : undefined);

  const isLoading = submissionsLoading || disputesLoading;
  const error = submissionsError || disputesError;

  const hasActivity = (submissions && submissions.length > 0) || (disputes && disputes.length > 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Engagement Activity" className="sm:w-[560px] sm:max-w-[560px]">
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <ErrorBanner message="Failed to load engagement activity." />
      ) : !hasActivity ? (
        <EmptyState
          icon={<History size={28} className="text-slate-300" />}
          title="No activity yet"
          description="Submissions and disputes across all milestones in this engagement will show up here."
        />
      ) : (
        <div className="space-y-6">
          {disputes && disputes.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <Scale size={16} className="text-rose-500" />
                Disputes ({disputes.length})
              </h3>
              <div className="space-y-3">
                {disputes.map((d) => (
                  <div key={d.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {d.milestone
                            ? `Milestone #${d.milestone.milestoneNumber}`
                            : 'Milestone'}
                          {d.milestone?.deliverableStatement ? ` — ${d.milestone.deliverableStatement}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                          {d.criterion?.criterionText}
                        </p>
                      </div>
                      <StatusBadge label={d.state.replace(/_/g, ' ')} variant={variantFromStatus(d.state)} />
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                      <span>Filed {new Date(d.filedAt).toLocaleDateString()}</span>
                      {d.milestone?.paymentAmountVnd != null && (
                        <span className="font-medium text-slate-700">
                          {formatVND(d.milestone.paymentAmountVnd)}
                        </span>
                      )}
                      {d.escrowAccount && (
                        <span className="text-slate-400">Escrow: {d.escrowAccount.status}</span>
                      )}
                      {d.resolution && (
                        <span className="font-medium text-slate-700">→ {d.resolution.replace(/_/g, ' ')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {submissions && submissions.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <FileText size={16} className="text-slate-400" />
                Submissions ({submissions.length})
              </h3>
              <div className="space-y-3">
                {submissions.map((s) => (
                  <div key={s.id} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-800">
                      Milestone #{s.milestone.milestoneNumber}
                      {s.milestone.deliverableStatement ? ` — ${s.milestone.deliverableStatement}` : ''}
                    </p>
                    {s.description && (
                      <p className="mt-1 text-xs text-slate-600 line-clamp-2">{s.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                      <span>Submitted {new Date(s.submittedAt).toLocaleDateString()}</span>
                      {s.filesJson?.length > 0 && <span>{s.filesJson.length} file(s)</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}