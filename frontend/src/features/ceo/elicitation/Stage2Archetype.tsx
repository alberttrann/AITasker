import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/Checkbox';
import type { VoidItem } from '@t/jsonb.types';
import { submitStage2, handleElicitationError, ARCHETYPES, VOID_DESCRIPTIONS } from '@/hooks/use-elicitation';

interface Stage2Props {
  sessionId: string;
  voidList: VoidItem[];
  onComplete: (data: { archetype: string; acknowledgedVoidCodes?: string[] }) => void;
  onError: (msg: string) => void;
}

export default function Stage2Archetype({ sessionId, voidList, onComplete, onError }: Stage2Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleAcknowledge = (code: string) => {
    setAcknowledged((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const handleContinue = async () => {
    if (!selected) return;
    setIsSubmitting(true);
    try {
      await submitStage2(sessionId, selected, [...acknowledged]);
      onComplete({ archetype: selected, acknowledgedVoidCodes: [...acknowledged] });
    } catch (err: any) {
      onError(handleElicitationError(err).message || 'Failed to save archetype selection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-h2 font-headline text-primary">Stage 2 of 5</h2>
        <p className="text-body-sm text-secondary">What kind of AI project is this?</p>
      </div>
      <p className="text-body text-secondary">Select the project type that best fits your needs:</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {ARCHETYPES.map((a) => {
          const isSelected = selected === a.code;
          return (
            <button key={a.code} onClick={() => setSelected(a.code)}
              className={`rounded-lg border-2 p-5 text-left transition-all hover:shadow-sm ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-200 bg-surface hover:border-primary/30'}`}>
              <span className="text-2xl">{a.icon}</span>
              <h4 className="mt-2 font-headline text-primary">{a.label}</h4>
              <p className="mt-1 text-body-sm text-secondary">{a.desc}</p>
            </button>
          );
        })}
      </div>

      {voidList.length > 0 && (
        <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
          <p className="text-body-sm font-medium text-primary">⚠️ Detected Gaps (from Stage 1)</p>
          <div className="mt-3 space-y-2">
            {voidList.map((v) => (
              <label key={v.void_code} className="flex cursor-pointer items-start gap-2">
                <Checkbox checked={acknowledged.has(v.void_code)} onChange={() => toggleAcknowledge(v.void_code)} className="mt-0.5" />
                <span className="text-body-sm text-secondary">I understand: &ldquo;{VOID_DESCRIPTIONS[v.void_code] ?? v.void_code}&rdquo;</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <span className="text-caption text-secondary" />
        <Button variant="primary" disabled={!selected || isSubmitting} onClick={handleContinue}>
          {isSubmitting ? 'Saving…' : 'Continue to Stage 3 →'}
        </Button>
      </div>
    </div>
  );
}
