import React, { useState } from 'react';
import { useExpertProfile } from '@/hooks/use-expert-profile';
import type { SeamClaim } from '@/types/ui.types';
import { Spinner } from '@/components/ui/Spinner';
import { CheckCircle, Lock, AlertTriangle } from 'lucide-react';
import { formatSeamCode } from '@/lib/utils';
import TooltipIcon from '@/components/ui/TooltipIcon';

interface SeamClaimsGridProps {
  onSave: (seams: SeamClaim[]) => void;
  initialSeams?: any[];
  selectedDomainCodes?: string[];
}

import { useSeams } from '@/hooks/use-config';

export default function SeamClaimsGrid({ onSave, initialSeams = [], selectedDomainCodes = [] }: SeamClaimsGridProps) {
  const { data: dynamicSeams, isLoading } = useSeams();
  const [seamStates, setSeamStates] = useState<SeamClaim[]>([]);

  const combinedSeams = React.useMemo(() => {
    if (!dynamicSeams) return [];
    const list = [...dynamicSeams];
    const dynamicCodes = new Set(list.map(s => s.code));
    
    (initialSeams || []).forEach((is: any) => {
      const code = is.seamCode || is.code;
      if (!dynamicCodes.has(code)) {
        list.push({
          code: code,
          name: code,
          description: 'This seam has been retired by the platform, but your legacy claim is preserved.',
          isLegacy: true
        } as any);
      }
    });
    return list;
  }, [dynamicSeams, initialSeams]);

  React.useEffect(() => {
    if (combinedSeams.length > 0 && seamStates.length === 0) {
      setSeamStates(
        combinedSeams.map(s => {
          const existing = initialSeams.find((is: any) => (is.seamCode || is.code) === s.code);
          return {
            code: s.code,
            checked: existing ? true : false
          };
        })
      );
    }
  }, [combinedSeams, initialSeams]);
  const { saveSeams } = useExpertProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSeam = (code: string) => {
    setSeamStates(prev => prev.map(s => s.code === code ? { ...s, checked: !s.checked } : s));
  };

    const getValidSeams = () => {
    return seamStates.filter(s => {
      if (!s.checked) return false;
      const requiredDomains = s.code.includes('↔') ? s.code.split('↔') : s.code.split('<->');
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
    const selectedSeams = validSeams.map(vs => {
      const existing = (initialSeams || []).find((is: any) => (is.seamCode || is.code) === vs.code);
      return { ...existing, code: vs.code, seamCode: vs.code };
    });

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

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Spinner size="lg" className="text-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {combinedSeams.map(seam => {
            const currentState = seamStates.find(s => s.code === seam.code);
            const isChecked = currentState?.checked || false;
            const existing = initialSeams.find((is: any) => (is.seamCode || is.code) === seam.code);
            const isVerified = existing?.verificationTier === 'EVIDENCE_BACKED' || existing?.verificationTier === 'VERIFIED';
            const hasSubmissions = (existing?.submissionCount || 0) > 0;
            const cannotRemove = isVerified || hasSubmissions;
            
            const requiredDomains = seam.code.includes('↔') ? seam.code.split('↔') : seam.code.split('<->');
            const hasRequiredDomains = requiredDomains.every(d => (selectedDomainCodes || []).includes(d));
            
            const isInvalid = !hasRequiredDomains && !cannotRemove;
            const isDisabled = isInvalid || cannotRemove;

            return (
              <label 
                key={seam.code} 
                className={`flex items-center gap-3 p-4 border rounded-lg transition-colors ${
                  isInvalid ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200' :
                  cannotRemove ? 'cursor-not-allowed border-blue-500 bg-blue-50/30' :
                  isChecked ? 'cursor-pointer border-blue-500 bg-blue-50/30' : 'cursor-pointer border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isDisabled}
                  onChange={() => {
                    if (!isDisabled) toggleSeam(seam.code);
                  }}
                  className={`w-5 h-5 shrink-0 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${isDisabled ? 'cursor-not-allowed' : ''} ${isInvalid ? 'opacity-50' : ''}`}
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <span className="inline-block bg-gray-100 px-2 py-0.5 rounded text-xs border">
                      {formatSeamCode(seam.code)}
                    </span>
                    {seam.name}
                    <TooltipIcon text={seam.description} />
                    {(seam as any).isLegacy && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide border border-slate-200">
                        Inactive
                      </span>
                    )}
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
      )}

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
