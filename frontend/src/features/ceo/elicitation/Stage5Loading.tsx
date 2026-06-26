import { useState, useEffect, useRef, useCallback } from 'react';
import { getSession, type GateResult } from '@/hooks/use-elicitation';
import { Bot, Loader2, CheckCircle2 } from 'lucide-react';

const PROGRESS_MESSAGES = [
  'Analyzing symptom descriptions…',
  'Matching archetype patterns…',
  'Building technical footprint…',
  'Generating milestone framework…',
  'Running quality gate…',
];

interface Stage5Props {
  sessionId: string;
  initialGateResult?: GateResult | null;
  onComplete: (result: GateResult) => void;
  onError: (msg: string) => void;
}

export default function Stage5Loading({ sessionId, initialGateResult, onComplete, onError }: Stage5Props) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [fakeProgress, setFakeProgress] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setMessageIndex((prev) => (prev + 1) % PROGRESS_MESSAGES.length), 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setFakeProgress((prev) => {
        if (prev >= 95) return prev;
        return Math.min(prev + (prev < 50 ? 3 : prev < 80 ? 1.5 : 0.5), 95);
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const checkSession = useCallback(async () => {
    if (initialGateResult) {
      stopPolling();
      onComplete(initialGateResult);
      return;
    }

    try {
      const data = await getSession(sessionId);

      if (data.state === 'COMPLETED') {
        stopPolling();
        onComplete({ gate_passed: true as const, completeness_score: data.completeness_score ?? data.completenessScore ?? 0, project_id: data.project_id ?? data.projectId ?? '' });
        return;
      }
      if (data.state === 'RETURNED') {
        stopPolling();
        onComplete({ gate_passed: false as const, completeness_score: data.completeness_score ?? data.completenessScore ?? 0, flagged_void: data.flagged_void ?? data.flaggedVoid ?? null, return_to_stage: data.return_to_stage ?? data.returnToStage ?? 1, advisory_note: data.advisory_note ?? data.advisoryNote ?? 'Your project needs more detail.' });
        return;
      }
      if (Date.now() - startedAt.current > 30 * 60_000) {
        stopPolling();
        onError('Synthesis is taking longer than expected. Please try again.');
      }
    } catch { /* transient — keep polling */ }
  }, [sessionId, initialGateResult, onComplete, onError, stopPolling]);

  useEffect(() => {
    checkSession();
    pollRef.current = setInterval(checkSession, 5000);
    return () => stopPolling();
  }, [checkSession, stopPolling]);

  return (
    <div className="space-y-8 text-center">
      <div>
        <h2 className="text-h2 font-headline text-primary">Stage 5 of 5</h2>
        <p className="text-body-sm text-secondary">Generating Your Project Specification</p>
      </div>
      <div className="flex justify-center"><Bot className="w-16 h-16 text-primary" /></div>
      <div>
        <p className="text-body-lg font-headline text-primary">AI is synthesizing your project blueprint…</p>
        <p className="mt-2 text-body-sm text-secondary">This takes 30–90 seconds. Please don't close this page.</p>
      </div>
      <div className="mx-auto h-2 w-full max-w-md overflow-hidden rounded-full bg-primary-bg">
        <div className="h-full rounded-full bg-primary transition-all duration-1000 ease-out" style={{ width: `${fakeProgress}%` }} />
      </div>
      <div className="mx-auto max-w-sm rounded-lg border border-slate-200 bg-surface p-4 text-left">
        <ul className="space-y-2">
          {PROGRESS_MESSAGES.map((msg, i) => {
            const isActive = i === messageIndex;
            const isDone = i < messageIndex || (i === 0 && messageIndex === 0);
            return (
              <li key={i} className={`flex items-center gap-2 text-body-sm ${isActive ? 'text-primary font-medium' : isDone ? 'text-success' : 'text-secondary'}`}>
                <span className="w-5 flex justify-center items-center">{isActive ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : isDone ? <CheckCircle2 className="w-4 h-4 text-success" /> : <div className="w-4 h-4 border-2 border-slate-300 rounded-sm" />}</span>
                {msg}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
