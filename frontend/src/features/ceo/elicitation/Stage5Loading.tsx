import { useState, useEffect, useRef } from 'react';
import { submitStage5, handleElicitationError, type GateResult } from '@/hooks/use-elicitation';
import { Button } from '@/components/ui/button';

interface Stage5Props {
  sessionId: string;
  initialGateResult?: GateResult | null;
  onComplete: (result: GateResult) => void;
  onError: (msg: string) => void;
}

export default function Stage5Loading({ sessionId, initialGateResult, onComplete, onError }: Stage5Props) {
  const [cooldown, setCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  useEffect(() => {
    if (initialGateResult) {
      onComplete(initialGateResult);
      return;
    }

    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      triggerSynthesis();
    }
  }, [initialGateResult, onComplete]);

  const triggerSynthesis = async () => {
    setErrorMsg(null);
    setIsSynthesizing(true);
    try {
      const data = await submitStage5(sessionId);
      onComplete(data);
    } catch (err: any) {
      const { message } = handleElicitationError(err);
      setErrorMsg(message || 'Synthesis failed. Please try again.');
      setCooldown(30);
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="space-y-8 text-center py-12">
      <div>
        <h2 className="text-h2 font-headline text-primary mb-2">Stage 5 of 5</h2>
        <p className="text-body-sm text-secondary">Generating Your Project Specification</p>
      </div>

      <div className="flex justify-center py-6">
        <div className="relative flex items-center justify-center w-16 h-16">
          <div className="absolute w-full h-full rounded-full border-[3px] border-slate-100"></div>
          {isSynthesizing && (
            <div className="absolute w-full h-full rounded-full border-[3px] border-primary border-t-transparent animate-spin"></div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-body-lg font-headline text-primary">
          {isSynthesizing ? 'AI is synthesizing your blueprint…' : 'Synthesis paused.'}
        </p>
        {isSynthesizing && (
          <p className="text-body-sm text-secondary">This usually takes 30–90 seconds. Please don't close this page.</p>
        )}
      </div>

      {errorMsg && (
        <div className="mt-8 space-y-4 max-w-md mx-auto">
          <div className="p-4 bg-error/10 border border-error/20 rounded-md text-error text-sm text-left">
            <strong>Error:</strong> {errorMsg}
          </div>
          <Button
            variant="primary"
            className="w-full"
            disabled={cooldown > 0 || isSynthesizing}
            onClick={triggerSynthesis}
          >
            {cooldown > 0 ? `Wait ${cooldown}s` : 'Retry Synthesis'}
          </Button>
        </div>
      )}
    </div>
  );
}
