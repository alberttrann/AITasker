import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/Checkbox';
import type { VoidItem } from '@t/jsonb.types';
import { submitStage2, handleElicitationError, ARCHETYPES, VOID_DESCRIPTIONS, revertSession, useElicitation } from '@/hooks/use-elicitation';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Target, FileText, MessageSquare, TrendingUp, Settings, AlertTriangle, Layers } from 'lucide-react';

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
  onComplete: (data: any) => void;
  onError: (msg: string) => void;
  onBack: () => void;
}

export default function Stage2Archetype({ sessionId, onComplete, onError, onBack }: Stage2Props) {
  const queryClient = useQueryClient();
  const { session, isLoadingSession } = useElicitation(sessionId);
  const [selected, setSelected] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  useEffect(() => {
    if (session && !initialized) {
      if (session.archetype) setSelected(session.archetype);
      if (session.voidListJson) {
        const ack = session.voidListJson.filter((v: any) => v.injected).map((v: any) => v.void_code);
        setAcknowledged(new Set(ack));
      }
      setInitialized(true);
    }
  }, [session, initialized]);

  const voidList = (session?.voidListJson as VoidItem[]) ?? [];
  const recommended = (session?.recommendedArchetypesJson as string[]) || [];
  
  const allVoidsAcknowledged = voidList.length === 0 || voidList.every(v => acknowledged.has(v.void_code));

  const toggleAcknowledge = (code: string) => {
    setAcknowledged((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const handleContinue = async () => {
    if (!selected || !allVoidsAcknowledged) return;
    setIsSubmitting(true);
    try {
      await submitStage2(sessionId, selected, [...acknowledged]);
      await queryClient.invalidateQueries({ queryKey: ["elicitation", "session", sessionId] });
      onComplete({});
    } catch (err: any) {
      onError(handleElicitationError(err).message || 'Failed to save archetype selection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center mb-6">
        <h2 className="text-h2 font-headline text-primary">Stage 2 of 5</h2>
        <p className="mt-2 text-body text-secondary max-w-md mx-auto">
          What kind of AI project is this? Select the project type that best fits your needs.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {ARCHETYPES.map((a) => {
          const isSelected = selected === a.code;
          const isRecommended = recommended.length === 0 || recommended.includes(a.code);
          
          let cardClasses = 'relative rounded-xl border-2 p-5 text-left transition-all duration-200 ';
          if (isSelected) {
            cardClasses += 'border-primary bg-primary/5 shadow-md ring-1 ring-primary transform scale-[1.02] z-10';
          } else if (!isRecommended) {
            cardClasses += 'border-slate-200 bg-slate-50 opacity-50 grayscale cursor-not-allowed';
          } else {
            cardClasses += 'border-slate-300 bg-white hover:border-slate-400 hover:shadow-sm';
          }

          return (
            <button key={a.code} disabled={!isRecommended} onClick={() => setSelected(a.code)} className={cardClasses}>
              <div className="flex justify-between items-start">
                <div className="mb-2">{getIcon(a.code)}</div>
                {isRecommended && recommended.length > 0 && (
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700 uppercase tracking-wider">
                    Recommended
                  </span>
                )}
              </div>
              <h4 className="mt-2 font-headline font-semibold text-slate-900">{a.label}</h4>
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
        <Button variant="outline" onClick={async () => {
          setIsReverting(true);
          try {
            await revertSession(sessionId, 1);
            await queryClient.invalidateQueries({ queryKey: ["elicitation", "session", sessionId] });
            onBack();
          } catch (err: any) {
            onError(handleElicitationError(err).message || 'Failed to revert session.');
            setIsReverting(false);
          }
        }} disabled={isSubmitting || isReverting}>
          {isReverting ? 'Going back…' : '← Back'}
        </Button>
        <Button variant="primary" disabled={!selected || !allVoidsAcknowledged || isSubmitting || isReverting} onClick={handleContinue}>
          {isSubmitting ? 'Saving…' : 'Continue to Stage 3 →'}
        </Button>
      </div>
    </div>
  );
}
