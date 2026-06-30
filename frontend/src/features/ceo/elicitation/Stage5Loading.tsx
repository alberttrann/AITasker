import { useState, useEffect } from 'react';
import { getSession, type GateResult } from '@/hooks/use-elicitation';
import { Bot } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useFakeProgress } from '@/hooks/use-fake-progress';


interface Stage5Props {
  sessionId: string;
  initialGateResult?: GateResult | null;
  onComplete: (result: GateResult) => void;
  onError: (msg: string) => void;
}

export default function Stage5Loading({ sessionId, initialGateResult, onComplete, onError }: Stage5Props) {
  const fakeProgress = useFakeProgress(true, 1500, 95, (prev) => prev + (prev < 50 ? 3 : prev < 80 ? 1.5 : 0.5));

  const { data: sessionData, isError } = useQuery({
    queryKey: ['elicitation-session', sessionId],
    queryFn: () => getSession(sessionId),
    refetchInterval: (query) => {
      if (initialGateResult) return false;
      const state = query.state?.data?.state;
      return state === 'COMPLETED' || state === 'RETURNED' ? false : 5000;
    },
    enabled: !initialGateResult,
  });

  useEffect(() => {
    if (initialGateResult) {
      onComplete(initialGateResult);
      return;
    }
    
    const timeoutHandle = setTimeout(() => {
      onError('Synthesis is taking longer than expected. Please try again or contact support.');
    }, 30 * 60 * 1000); // 30 minutes

    if (isError) {
      // Ignore transient errors, but we can't easily track 30m timeout here simply.
      // Assuming backend handles timeout or we just rely on normal flows.
    }
    if (sessionData) {
      if (sessionData.state === 'COMPLETED') {
        clearTimeout(timeoutHandle);
        onComplete({ gate_passed: true as const, completeness_score: sessionData.completeness_score ?? sessionData.completenessScore ?? 0, project_id: sessionData.project_id ?? sessionData.projectId ?? '' });
      } else if (sessionData.state === 'RETURNED') {
        clearTimeout(timeoutHandle);
        onComplete({ gate_passed: false as const, completeness_score: sessionData.completeness_score ?? sessionData.completenessScore ?? 0, flagged_void: sessionData.flagged_void ?? sessionData.flaggedVoid ?? null, return_to_stage: sessionData.return_to_stage ?? sessionData.returnToStage ?? 1, advisory_note: sessionData.advisory_note ?? sessionData.advisoryNote ?? 'Your project needs more detail.' });
      }
    }

    return () => clearTimeout(timeoutHandle);
  }, [sessionData, isError, initialGateResult, onComplete, onError]);

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
      <div className="mx-auto h-4 w-full max-w-2xl overflow-hidden rounded-full bg-primary-bg border border-slate-200">
        <div className="h-full rounded-full bg-primary transition-all duration-1000 ease-out" style={{ width: `${fakeProgress}%` }} />
      </div>
    </div>
  );
}
