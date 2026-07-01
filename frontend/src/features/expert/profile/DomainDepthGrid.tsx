import React, { useState } from 'react';
import { useExpertProfile } from '@/hooks/use-expert-profile';
import type { DomainDepth } from '@/types/ui.types';
import { Spinner } from '@/components/ui/Spinner';
import { Lock } from 'lucide-react';

interface DomainDepthGridProps {
  onSave: (domains: DomainDepth[]) => void;
  initialDomains?: DomainDepth[];
  lockedDomainCodes?: string[];
}

const DOMAINS = [
  { code: 'A', label: 'LLM App Engineering', hint: 'Building applications using LLMs as core reasoning engines' },
  { code: 'B', label: 'Applied Reasoning Systems', hint: 'Designing agents, tool use, and cognitive architectures' },
  { code: 'C', label: 'Prompt Engineering & Design', hint: 'Crafting complex prompt strategies and evaluations' },
  { code: 'D', label: 'Model Fine-Tuning & Training', hint: 'Training models, PEFT, LoRA, and datasets' },
  { code: 'E', label: 'RAG & Search Architecture', hint: 'Retrieval augmented generation, vector DBs, embedding models' },
  { code: 'F', label: 'MLOps & Production AI', hint: 'Serving, observability, evals, and infrastructure' },
];

export default function DomainDepthGrid({ onSave, initialDomains = [], lockedDomainCodes = [] }: DomainDepthGridProps) {
  const [domainStates, setDomainStates] = useState<DomainDepth[]>(() => {
    return DOMAINS.map(d => {
      const existing = initialDomains.find(id => id.domainCode === d.code);
      return {
        domainCode: d.code,
        depthLevel: existing ? existing.depthLevel : null
      };
    });
  });
  const { saveDomains } = useExpertProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDepth = (code: string, depth: "SURFACE" | "OPERATIONAL" | "DEEP") => {
    if (lockedDomainCodes.includes(code)) {
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
    const selectedDomains = domainStates.filter(d => d.depthLevel !== null);
    
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

      <div className="grid gap-4">
        {DOMAINS.map(domain => {
          const currentState = domainStates.find(d => d.domainCode === domain.code);
          const isSelected = currentState?.depthLevel !== null;
          const isLocked = lockedDomainCodes.includes(domain.code);

          return (
            <div key={domain.code} className={`border p-4 rounded-lg transition-colors ${isSelected ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold flex items-center gap-2">
                    {domain.code} · {domain.label}
                    {isLocked && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase tracking-wide border border-blue-200">
                        <Lock className="h-3 w-3" /> Required for Verified Seam
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">{domain.hint}</p>
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
