import React, { useState } from 'react';
import { useExpertProfile } from '@/hooks/use-expert-profile';
import type { DomainDepth } from '@/types/ui.types';
import { Spinner } from '@/components/ui/Spinner';
import { Lock } from 'lucide-react';
import TooltipIcon from '@/components/ui/TooltipIcon';

interface DomainDepthGridProps {
  onSave: (domains: DomainDepth[]) => void;
  initialDomains?: DomainDepth[];
  lockedDomainsRecord?: Record<string, string>;
}

import { useDomains } from '@/hooks/use-config';

export default function DomainDepthGrid({ onSave, initialDomains = [], lockedDomainsRecord = {} }: DomainDepthGridProps) {
  const { data: dynamicDomains, isLoading } = useDomains();
  const { saveDomains } = useExpertProfile();
  const [domainStates, setDomainStates] = useState<DomainDepth[]>([]);

  const combinedDomains = React.useMemo(() => {
    if (!dynamicDomains) return [];
    const list = [...dynamicDomains];
    const dynamicCodes = new Set(list.map(d => d.code));
    
    (initialDomains || []).forEach((id: any) => {
      const code = id.domainCode || id.code;
      if (!dynamicCodes.has(code)) {
        list.push({
          code: code,
          name: code,
          description: 'This domain is no longer actively offered by the platform, but your legacy claim is preserved.',
          isLegacy: true
        } as any);
      }
    });
    return list;
  }, [dynamicDomains, initialDomains]);

  // Initialize state once domains are loaded
  React.useEffect(() => {
    if (combinedDomains.length > 0 && domainStates.length === 0) {
      setDomainStates(
        combinedDomains.map((d) => {
          const existing = initialDomains.find((id) => id.domainCode === d.code);
          return {
            domainCode: d.code,
            depthLevel: existing ? existing.depthLevel : null,
          };
        })
      );
    }
  }, [combinedDomains, initialDomains]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDepth = (code: string, depth: "SURFACE" | "OPERATIONAL" | "DEEP") => {
    if (lockedDomainsRecord[code]) {
      const currentState = domainStates.find(d => d.domainCode === code);
      if (currentState?.depthLevel === depth) {
        // Prevent unselecting a locked domain
        return;
      }
    }

    setDomainStates(prev => prev.map(d => {
      if (d.domainCode === code) {
        return { ...d, depthLevel: d.depthLevel === depth ? null : depth };
      }
      return d;
    }));
  };


  const handleSave = async () => {
    setError(null);
    const selectedDomains = domainStates.filter(d => d.depthLevel !== null).map(d => {
      const existing = (initialDomains || []).find((id: any) => (id.domainCode || id.code) === d.domainCode);
      return { ...existing, domainCode: d.domainCode, depthLevel: d.depthLevel! };
    });
    
    if (selectedDomains.length === 0) {
      setError('Please select at least one domain depth.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Mocking the POST request
      const USE_MOCK = false;
      if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 1000));
      } else {
        await saveDomains.mutateAsync(
          selectedDomains.map(d => ({
            domainCode: d.domainCode,
            depthLevel: d.depthLevel!
          }))
        );
      }
      onSave(selectedDomains);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save domains. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold">Domain Expertise</h2>
        <p className="text-gray-500 text-sm">Select your depth of knowledge in the following AI domains.</p>
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
        <div className="grid gap-4">
          {combinedDomains.map(domain => {
            const currentState = domainStates.find(d => d.domainCode === domain.code);
            const isSelected = currentState?.depthLevel !== null;
            const lockedBySeam = lockedDomainsRecord[domain.code];

            return (
              <div key={domain.code} className={`border p-4 rounded-lg transition-colors ${isSelected ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold flex items-center gap-2">
                      {domain.code} &middot; {domain.name}
                      <TooltipIcon text={domain.description} />
                      {(domain as any).isLegacy && (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide border border-slate-200">
                          Inactive
                        </span>
                      )}
                      {lockedBySeam && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase tracking-wide border border-blue-200">
                          <Lock className="h-3 w-3" /> Required for Seam {lockedBySeam}
                        </span>
                      )}
                    </h3>
                  </div>
                  
                  <div className="flex gap-2">
                    {(["SURFACE", "OPERATIONAL", "DEEP"] as const).map(level => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => updateDepth(domain.code, level)}
                        className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                          currentState?.depthLevel === level 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSubmitting}
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
