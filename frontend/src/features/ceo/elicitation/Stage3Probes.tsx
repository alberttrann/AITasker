import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/input';
import { submitStage3, handleElicitationError, PROBES, ARCHETYPE_LABELS } from '@/hooks/use-elicitation';
import { AlertTriangle } from 'lucide-react';

interface Stage3Props {
  sessionId: string;
  archetype: string;
  onComplete: (data: { probeResponses: Record<string, string> }) => void;
  onError: (msg: string) => void;
}

export default function Stage3Probes({ sessionId, archetype, onComplete, onError }: Stage3Props) {
  const questions = PROBES[archetype] ?? PROBES['1'];
  const [answers, setAnswers] = useState<Record<string, string>>({ q1: '', q2: '', q3: '', q4: '' });
  const [vagueAnswers, setVagueAnswers] = useState<Array<{question: string; reason: string}>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allFilled = Object.values(answers).every((a) => a.trim().length > 0);

  const handleChange = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    // If they type, remove the vague error for this question
    setVagueAnswers((prev) => prev.filter((v) => v.question !== questions[key]));
  };

  const handleSubmit = async () => {
    if (!allFilled) return;
    setIsSubmitting(true);

    const probeResponses: Record<string, string> = {
      [questions.q1]: answers.q1.trim(),
      [questions.q2]: answers.q2.trim(),
      [questions.q3]: answers.q3.trim(),
      [questions.q4]: answers.q4.trim(),
    };

    try {
      const data = await submitStage3(sessionId, probeResponses);
      if (!data.advanced && data.vague_answers?.length > 0) {
        setVagueAnswers(data.vague_answers);
        return;
      }
      onComplete({ probeResponses });
    } catch (err: any) {
      onError(handleElicitationError(err).message || 'Failed to submit probe answers.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const textareaClass = (isVague: boolean) =>
    `w-full rounded-lg border bg-surface px-4 py-3 text-body text-primary placeholder:text-secondary transition-shadow hover:border-primary focus:border-2 focus:border-primary focus:ring-[3px] focus:ring-primary/10 focus:outline-none ${isVague ? 'border-warning' : 'border-slate-200'}`;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-h2 font-headline text-primary">Stage 3 of 5</h2>
        <p className="text-body-sm text-secondary">Infrastructure Details — {ARCHETYPE_LABELS[archetype] ?? 'Unknown Archetype'}</p>
      </div>

      {vagueAnswers.length > 0 && (
        <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
          <p className="text-body-sm font-medium text-warning flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" /> Some answers need more detail before continuing:</p>
          <ul className="mt-2 list-inside list-disc text-body-sm text-secondary space-y-2">
            {vagueAnswers.map((v) => (
              <li key={v.question}>
                <strong>{v.question}</strong>
                <p className="text-caption text-secondary/80 mt-1">{v.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-6">
        {(['q1', 'q2', 'q3', 'q4'] as const).map((key) => (
          <div key={key} className="space-y-2">
            <Label>{questions[key]}</Label>
            <textarea value={answers[key]} onChange={(e) => handleChange(key, e.target.value)} placeholder="Type your answer…" rows={3} className={textareaClass(vagueAnswers.some(v => v.question === questions[key]))} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4">
        <span className="text-caption text-secondary" />
        <Button variant="primary" disabled={!allFilled || isSubmitting} onClick={handleSubmit}>
          {isSubmitting ? 'Submitting…' : 'Continue to Stage 4 →'}
        </Button>
      </div>
    </div>
  );
}
