import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/Checkbox';
import type { VoidItem } from '@t/jsonb.types';
import { submitStage2, handleElicitationError, ARCHETYPES, VOID_DESCRIPTIONS } from '@/hooks/use-elicitation';
import { Search, Target, FileText, MessageSquare, TrendingUp, Settings, AlertTriangle } from 'lucide-react';

const getIcon = (code: string) => {
  switch (code) {
    case '1': return <Search className="w-8 h-8 text-primary" />;
    case '2': return <Target className="w-8 h-8 text-primary" />;
    case '3': return <FileText className="w-8 h-8 text-primary" />;
    case '4': return <MessageSquare className="w-8 h-8 text-primary" />;
    case '5': return <TrendingUp className="w-8 h-8 text-primary" />;
    case '6': return <Settings className="w-8 h-8 text-primary" />;
    default: return null;
  }
};

interface Stage2Props {
  sessionId: string;
  voidList: VoidItem[];
  onComplete: (data: { archetype: string; acknowledgedVoidCodes?: string[] }) => void;
  onError: (msg: string) => void;
  onBack: () => void;
}

export default function Stage2Archetype({ sessionId, voidList, onComplete, onError, onBack }: Stage2Props) {
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
              <div className="mb-2">{getIcon(a.code)}</div>
              <h4 className="mt-2 font-headline text-primary">{a.label}</h4>
              <p className="mt-1 text-body-sm text-secondary">{a.desc}</p>
            </button>
          );
        })}
      </div>

      {voidList.length > 0 && (
        <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
          <p className="text-body-sm font-medium text-primary flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" /> Detected Gaps (from Stage 1)</p>
          <div className="mt-3 space-y-2">
            {voidList.map((v) => {
              const fallbackDesc = v.void_code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              return (
                <label key={v.void_code} className="flex cursor-pointer items-start gap-2">
                  <Checkbox checked={acknowledged.has(v.void_code)} onChange={() => toggleAcknowledge(v.void_code)} className="mt-0.5" />
                  <span className="text-body-sm text-secondary">I understand: &ldquo;{VOID_DESCRIPTIONS[v.void_code] ?? fallbackDesc}&rdquo;</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          ← Back
        </Button>
        <Button variant="primary" disabled={!selected || isSubmitting} onClick={handleContinue}>
          {isSubmitting ? 'Saving…' : 'Continue to Stage 3 →'}
        </Button>
      </div>
    </div>
  );
}
