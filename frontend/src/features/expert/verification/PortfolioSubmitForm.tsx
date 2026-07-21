import React, { useState, useEffect } from 'react';
import { useExpertProfile } from '@/hooks/use-expert-profile';
import { usePortfolio } from '@/hooks/use-portfolio';
import Tier2Success from './Tier2Success';
import Tier2Rejected from './Tier2Rejected';
import VerificationLockout from './VerificationLockout';
import { AlertTriangle, ChevronRight, FileText, Plus, Search, Send, X, AlertCircle, Loader2, CheckSquare } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/Modal';
import { formatSeamCode } from '@/lib/utils';
import { Link } from 'react-router-dom';

export default function PortfolioSubmitForm() {
  const [eligibleSeams, setEligibleSeams] = useState<any[]>([]);
  const [selectedSeamId, setSelectedSeamId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [decisions, setDecisions] = useState('');
  const { profile, isLoadingProfile } = useExpertProfile();
  const { submitPortfolio } = usePortfolio();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [resultView, setResultView] = useState<'form' | 'success' | 'rejected' | 'lockout'>('form');
  const [resultData, setResultData] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const getSeamLabel = (code: string) => {
    const map: Record<string, string> = {
      'A↔B': 'Applied Agents',
      'A↔C': 'Prompt Engineering Apps',
      'A↔D': 'Fine-Tuned Apps',
      'A↔F': 'Production LLMs',
      'B↔E': 'Agents with Memory',
      'C↔E': 'Retrieval Prompting',
      'C↔F': 'PromptOps',
      'D↔E': 'Fine-Tuned RAG',
      'D↔F': 'MLOps for LLMs',
      'E↔F': 'Scalable RAG',
    };
    return map[code] || code;
  };

  useEffect(() => {
    if (profile?.seamClaims) {
      const eligible = profile.seamClaims.filter(
        (s: any) => s.verificationTier === 'CLAIMED' && 
          (!s.lockedUntil || new Date(s.lockedUntil) < new Date())
      );
      setEligibleSeams(eligible);
    }
  }, [profile, resultView]);

  const handleOpenModal = () => {
    if (!selectedSeamId) {
      setError("Please select a seam.");
      return;
    }
    if (description.length < 50) {
      setError("Project description must be at least 50 characters.");
      return;
    }
    if (decisions.length < 20) {
      setError("Decision points must be at least 20 characters.");
      return;
    }
    setError(null);
    setShowConfirmModal(true);
  };

  const handleSubmit = async () => {
    setShowConfirmModal(false);
    setError(null);
    setIsSubmitting(true);
    
    // Capture the submission count BEFORE the mutation to avoid race conditions with React Query invalidation
    const currentCount = selectedSeamData?.submissionCount || 0;

    try {
      const USE_MOCK = false;
      let data;
      if (USE_MOCK) {
        const isApproved = Math.random() > 0.4;
        await new Promise(r => setTimeout(r, 10000)); // Simulate 10s wait
        data = {
          id: "mock-sub-" + Date.now(),
          status: isApproved ? "APPROVED" : "REJECTED",
          llmConfidence: isApproved ? 0.91 : 0.62,
          evaluationTierUpgraded: isApproved,
          advisoryNote: "Consider expanding on deployment strategies.",
          evaluatedAt: new Date().toISOString(),
        };
      } else {
        data = await submitPortfolio.mutateAsync({
          seamClaimId: selectedSeamId,
          projectDescription: description,
          decisionPoints: decisions,
        });
      }

      if (data.status === 'APPROVED') {
        setResultData(data);
        setResultView('success');
      } else {
        const newCount = currentCount + 1;
        if (newCount >= 5) {
          // Add fake lockedUntil since backend won't return it on a 201 response
          setResultData({ ...data, lockedUntil: new Date(Date.now() + 30 * 86400000).toISOString() });
          setResultView('lockout');
        } else {
          setResultData({ ...data, submissionCount: newCount });
          setResultView('rejected');
        }
      }
    } catch (err: any) {
      if (err.response?.status === 429) {
        setResultData(err.response.data);
        setResultView('lockout');
      } else if (err.response?.status === 403) {
        setError('EXPERT_PRO_REQUIRED');
      } else {
        setError(err.response?.data?.message || 'Submission failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setResultView('form');
    setDescription('');
    setDecisions('');
    setSelectedSeamId('');
    setResultData(null);
  };

  const selectedSeamData = profile?.seamClaims?.find((s: any) => s.id === selectedSeamId) || eligibleSeams.find(s => s.id === selectedSeamId);
  const rawSeamCode = selectedSeamData?.seamCode || selectedSeamData?.code || selectedSeamData?.seam_code || 'Unknown';
  const displaySeamName = getSeamLabel(rawSeamCode);

  if (resultView === 'success') {
    return (
      <Tier2Success 
        seamCode={formatSeamCode(rawSeamCode)} 
        seamName={displaySeamName}
        llmConfidence={resultData?.llmConfidence || 0} 
        onClose={handleReset} 
        onSubmitAnother={handleReset} 
      />
    );
  }

  if (resultView === 'rejected') {
    return (
      <Tier2Rejected 
        seamCode={formatSeamCode(rawSeamCode)} 
        seamName={displaySeamName}
        llmConfidence={resultData?.llmConfidence || 0} 
        advisoryNote={resultData?.advisoryNote}
        attemptsRemaining={5 - (resultData?.submissionCount ?? (selectedSeamData?.submissionCount || 0))}
        onRetry={handleReset}
        onClose={handleReset}
      />
    );
  }

  if (resultView === 'lockout') {
    return (
      <VerificationLockout 
        seamCode={formatSeamCode(rawSeamCode)} 
        seamName={displaySeamName}
        lockedUntil={resultData?.lockedUntil || new Date(Date.now() + 86400000).toISOString()}
        onClose={handleReset}
      />
    );
  }

  if (isLoadingProfile) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (eligibleSeams.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-2">No Eligible Seams</h3>
        <p className="text-gray-500">You do not have any claimed seams available for Tier 2 verification right now.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
      <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Portfolio Submission</h2>
      <p className="text-gray-500 mb-8">Provide evidence for AI evaluation to reach Tier 2 verification.</p>

      {error && error !== 'EXPERT_PRO_REQUIRED' && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium">
          {error}
        </div>
      )}

      {error === 'EXPERT_PRO_REQUIRED' && (
        <div className="mb-6 p-5 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-amber-800 font-bold">Expert Pro Subscription Required</h4>
              <p className="text-amber-700 text-sm mt-1">
                Tier 2 AI Evaluation is an advanced feature. You must activate Expert Pro to submit your portfolio evidence.
              </p>
            </div>
          </div>
          <Link 
            to="/expert/subscriptions/plans"
            className="whitespace-nowrap px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-lg transition-colors flex-shrink-0"
          >
            Activate Pro
          </Link>
        </div>
      )}

      {isSubmitting ? (
        <div className="py-16 text-center animate-in fade-in duration-500">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-50 rounded-full mb-6 relative">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full border-t-blue-600 animate-[spin_2s_linear_infinite]"></div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">Evaluating Evidence</h3>
          <p className="text-gray-600 max-w-2sm mx-auto">
            Our AI is currently analyzing your portfolio. This takes about 10–30 seconds. Please do not close this window.
          </p>
          
          <div className="mt-8 max-w-md mx-auto h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 w-full origin-left animate-[scale-x_15s_ease-out]"></div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Target Seam</label>
            <select
              value={selectedSeamId}
              onChange={(e) => setSelectedSeamId(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="" disabled>Select a seam to verify...</option>
              {eligibleSeams.map(s => (
                <option key={s.id} value={s.id}>{formatSeamCode(s.seamCode || s.code || s.seam_code)} · {getSeamLabel(s.seamCode || s.code || s.seam_code)}</option>
              ))}
            </select>
            {selectedSeamData && (
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                Attempts remaining: {5 - (selectedSeamData.submissionCount || 0)}/5
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              Project Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe a project where you integrated these domains. What was the goal? What did you build?"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 h-32 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
            <div className="flex justify-between mt-1 text-xs">
              <span className={description.length < 50 && description.length > 0 ? "text-red-500" : "text-gray-400"}>
                Min 50 chars required
              </span>
              <span className={description.length >= 50 ? "text-green-600 font-medium" : "text-gray-500"}>
                {description.length} chars
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-gray-400" />
              Key Technical Decisions
            </label>
            <textarea
              value={decisions}
              onChange={(e) => setDecisions(e.target.value)}
              placeholder="What trade-offs did you consider? Why did you choose this specific approach?"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 h-32 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
            <div className="flex justify-between mt-1 text-xs">
              <span className={decisions.length < 20 && decisions.length > 0 ? "text-red-500" : "text-gray-400"}>
                Min 20 chars required
              </span>
              <span className={decisions.length >= 20 ? "text-green-600 font-medium" : "text-gray-500"}>
                {decisions.length} chars
              </span>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100">
            <button
              onClick={handleOpenModal}
              disabled={!selectedSeamId || description.length < 50 || decisions.length < 20}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl transition-transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center gap-2 shadow-sm"
            >
              <Send className="w-5 h-5" />
              Submit for AI Evaluation
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleSubmit}
        title="Confirm Submission"
        confirmText="Submit Evidence"
        cancelText="Cancel"
        isDestructive={true}
      >
        Once you submit evidence for this seam, it becomes <strong>permanently locked</strong> to your profile and cannot be removed, regardless of whether the evaluation succeeds or fails.
      </ConfirmModal>
    </div>
  );
}
