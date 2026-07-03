import React, { useState } from 'react';
import { useExpertProfile } from '@/hooks/use-expert-profile';
import type { SeamClaim } from '@/types/ui.types';
import { Spinner } from '@/components/ui/Spinner';
import { CheckCircle, Lock, AlertTriangle } from 'lucide-react';

interface SeamClaimsGridProps {
  onSave: (seams: SeamClaim[]) => void;
  initialSeams?: SeamClaim[];
  selectedDomainCodes?: string[];
}

const SEAMS = [
  { code: 'A↔B', label: 'Applied Agents', hint: 'Using LLMs to build autonomous agents and tool-using systems' },
  { code: 'A↔C', label: 'Prompt Engineering Apps', hint: 'Building robust apps centered around complex prompt chains' },
  { code: 'A↔D', label: 'Fine-Tuned Apps', hint: 'Integrating custom trained models into production apps' },
  { code: 'A↔F', label: 'Production LLMs', hint: 'Deploying and monitoring LLMs in high-traffic applications' },
  { code: 'B↔E', label: 'Agents with Memory', hint: 'Connecting agents to vector databases and long-term memory' },
  { code: 'C↔E', label: 'Retrieval Prompting', hint: 'Optimizing prompts for grounded generation from retrieved context' },
  { code: 'C↔F', label: 'PromptOps', hint: 'Managing, versioning, and monitoring prompts in production' },
  { code: 'D↔E', label: 'Fine-Tuned RAG', hint: 'Optimizing embeddings and models for retrieval systems' },
  { code: 'D↔F', label: 'MLOps for LLMs', hint: 'Managing the lifecycle of fine-tuned models in production' },
  { code: 'E↔F', label: 'Scalable RAG', hint: 'Scaling vector search and retrieval infrastructure' },
];

export default function SeamClaimsGrid({ onSave, initialSeams = [], selectedDomainCodes = [] }: SeamClaimsGridProps) {
  const [seamStates, setSeamStates] = useState<SeamClaim[]>(() => {
    return SEAMS.map(s => {
      const existing = initialSeams.find((is: any) => (is.seamCode || is.code) === s.code);
      return {
        code: s.code,
        checked: existing ? true : false
      };
    });
  });
  const { saveSeams } = useExpertProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSeam = (code: string) => {
    setSeamStates(prev => prev.map(s => s.code === code ? { ...s, checked: !s.checked } : s));
  };

    const getValidSeams = () => {
    return seamStates.filter(s => {
      if (!s.checked) return false;
      const requiredDomains = s.code.split('↔');
      const hasRequiredDomains = requiredDomains.every(d => (selectedDomainCodes || []).includes(d));
      
      const existing = (initialSeams || []).find((is: any) => (is.seamCode || is.code) === s.code);
      const hasSubmissions = (existing?.submissionCount || 0) > 0;
      const isVerified = existing?.verificationTier === 'EVIDENCE_BACKED' || existing?.verificationTier === 'VERIFIED';
      const cannotRemove = isVerified || hasSubmissions;
      
      return hasRequiredDomains || cannotRemove;
    });
  };

  const validSeams = getValidSeams();
  const selectedCount = validSeams.length;

  const handleSave = async () => {
    setError(null);
    const selectedSeams = validSeams;
    
    if (selectedSeams.length < 2 || selectedSeams.length > 5) {
      setError('Please select between 2 and 5 seams.');
      return;
    }

    setIsSubmitting(true);
    try {
      const USE_MOCK = false;
      if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 1000));
      } else {
        await saveSeams.mutateAsync(
          selectedSeams.map(s => ({ code: s.code }))
        );
      }
      onSave(selectedSeams);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save seams. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold">Seam Expertise</h2>
        <p className="text-gray-500 text-sm">Select 2-5 cross-domain integration seams you have experience in.</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded border border-red-200 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SEAMS.map(seam => {
          const currentState = seamStates.find(s => s.code === seam.code);
          const isChecked = currentState?.checked;
          const existing = initialSeams.find((is: any) => (is.seamCode || is.code) === seam.code);
          const isVerified = existing?.verificationTier === 'EVIDENCE_BACKED' || existing?.verificationTier === 'VERIFIED';
          const hasSubmissions = (existing?.submissionCount || 0) > 0;
          const cannotRemove = isVerified || hasSubmissions;
          
          const requiredDomains = seam.code.split('↔');
          const hasRequiredDomains = requiredDomains.every(d => (selectedDomainCodes || []).includes(d));
          
          const isInvalid = !hasRequiredDomains && !cannotRemove;
          const isDisabled = isInvalid || cannotRemove;

          return (
            <label 
              key={seam.code} 
              className={`flex items-start gap-3 p-4 border rounded-lg transition-colors ${
                isInvalid ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200' :
                cannotRemove ? 'cursor-not-allowed border-blue-500 bg-blue-50/30' :
                isChecked ? 'cursor-pointer border-blue-500 bg-blue-50/30' : 'cursor-pointer border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="mt-1">
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isDisabled}
                  onChange={() => {
                    if (!isDisabled) toggleSeam(seam.code);
                  }}
                  className={`w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${isDisabled ? 'cursor-not-allowed' : ''} ${isInvalid ? 'opacity-50' : ''}`}
                />
              </div>
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <span className="inline-block bg-gray-100 px-2 py-0.5 rounded text-xs border">
                    {seam.code}
                  </span>
                  {seam.label}
                  {isVerified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                      <CheckCircle className="h-3 w-3" /> AI Verified
                    </span>
                  )}
                  {existing?.lockedUntil && new Date(existing.lockedUntil) > new Date() && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 uppercase tracking-wide">
                      <Lock className="h-3 w-3" /> Locked
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-500 mt-1">{seam.hint}</p>
                {isInvalid && (
                  <p className="text-xs text-red-500 mt-1 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Requires domains {requiredDomains.join(' and ')}
                  </p>
                )}
                {cannotRemove && (
                  <p className="text-xs text-blue-600 mt-1 font-medium">
                    {isVerified ? 'Verified seams cannot be removed.' : 'Seams with portfolio evidence cannot be removed.'}
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <div className={`text-sm font-medium ${selectedCount >= 2 && selectedCount <= 5 ? 'text-green-600' : 'text-orange-600'}`}>
          Selected: {selectedCount} seams (require 2-5)
        </div>
        <button
          onClick={handleSave}
          disabled={isSubmitting || selectedCount < 2 || selectedCount > 5}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Spinner size="sm" className="text-white" />
              Saving...
            </>
          ) : (
            'Save & Continue'
          )}
        </button>
      </div>
    </div>
  );
}
