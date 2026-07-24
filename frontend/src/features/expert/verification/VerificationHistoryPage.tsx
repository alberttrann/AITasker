import { useMyPortfolioSubmissions } from '@/hooks/use-portfolio';
import { CheckCircle2, XCircle, Clock, Lock, ArrowLeft } from 'lucide-react';
import { formatSeamCode } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSeams } from '@/hooks/use-config';

const STATUS_CONFIG = {
  APPROVED: {
    icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
    label: 'Verified',
    textColor: 'text-green-700',
  },
  REJECTED: {
    icon: <XCircle className="w-5 h-5 text-red-600" />,
    label: 'Rejected',
    textColor: 'text-red-700',
  },
  PENDING: {
    icon: <Clock className="w-5 h-5 text-amber-500" />,
    label: 'Pending',
    textColor: 'text-amber-700',
  },
} as const;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function VerificationHistoryPage() {
  const { data: submissions = [], isLoading } = useMyPortfolioSubmissions();
  const { data: dynamicSeams } = useSeams();
  const navigate = useNavigate();

  const getSeamLabel = (code: string) => {
    const seam = dynamicSeams?.find(s => s.code === code);
    return seam ? seam.name : code;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="w-full max-w-[1440px] mx-auto px-4 py-16 text-center">
        <p className="text-lg font-bold text-slate-900">No submissions yet</p>
        <p className="text-sm text-slate-500 mt-2 mb-6">
          Submit portfolio evidence from your Expert Profile page to verify your seam claims.
        </p>
        <Button variant="outline" onClick={() => navigate('/expert/service/expert-profile')} className="inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Profile
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto space-y-8 px-4 py-8">
      <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Verification History</h1>
          <p className="text-sm text-slate-500 mt-1">
            All your portfolio submissions and AI evaluation results.
          </p>
        </div>
        <button
          onClick={() => navigate('/expert/service/expert-profile')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Back to Profile</span>
        </button>
      </div>

      <div className="space-y-4">
        {submissions.map((sub: any) => {
          const cfg = STATUS_CONFIG[sub.status as keyof typeof STATUS_CONFIG]
            ?? STATUS_CONFIG.PENDING;
          const isLocked = sub.seamClaim.submissionCount >= 5;

          return (
            <div
              key={sub.id}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm"
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-lg text-gray-900 mb-1">
                    {formatSeamCode(getSeamLabel(sub.seamClaim.seamCode))}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Submitted {formatDate(sub.createdAt)}
                  </p>
                </div>
                <div className={`flex items-center gap-2 text-sm font-medium ${cfg.textColor}`}>
                  {cfg.icon}
                  {cfg.label}
                  {isLocked && <Lock className="w-4 h-4 text-red-600 ml-1" />}
                </div>
              </div>

              {/* Confidence bar */}
              {sub.llmConfidence !== null && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-32">AI Evaluation Score</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        sub.status === 'APPROVED' ? 'bg-green-500' : 'bg-red-400'
                      }`}
                      style={{ width: `${Math.round((sub.llmConfidence ?? 0) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 w-16 text-right">
                    {Math.round((sub.llmConfidence ?? 0) * 100)} / 100
                  </span>
                </div>
              )}

              {/* AI advisory note */}
              {sub.advisoryNote && (
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">AI Feedback</p>
                  <p className="text-sm text-slate-800">{sub.advisoryNote}</p>
                </div>
              )}

              {/* Lockout warning */}
              {isLocked && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-700">
                    This seam is locked after 5 failed attempts. You can re-submit after the lockout period.
                  </p>
                </div>
              )}

              {/* Attempts */}
              <div className="text-xs text-slate-500">
                Attempts: {sub.seamClaim.submissionCount} / 5
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
