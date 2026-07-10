import { useReducer, useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Input';
import { submitStage4, saveStage4Draft, handleElicitationError, type GateResult, revertSession, useElicitation, recommendStage4 } from '@/hooks/use-elicitation';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Stage4AProps {
  sessionId: string;
  onComplete: (data: { gateResult?: GateResult }) => void;
  onError: (msg: string) => void;
  onBack: () => void;
  isForced?: boolean;
}

type FormState = {
  currentStack: string;
  integrationMethod: string;
  legacyVolume: string;
  additionalRequirement: string;
  technicalArtifacts: Record<string, string>;
  isSubmitting: boolean;
  isReverting: boolean;
  initialized: boolean;
  missingArtifactsWarning: any[] | null;
};

type FormAction =
  | { type: 'SET_FIELD'; field: keyof FormState; value: any }
  | { type: 'SET_ARTIFACT'; key: string; value: string }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_END' }
  | { type: 'REVERT_START' }
  | { type: 'REVERT_END' }
  | { type: 'SET_MISSING_WARNING'; missing: any[] | null }
  | { type: 'INIT_STATE'; payload: any; artifactsJson: any[] }
  | { type: 'AUTOFILL_AI'; payload: any };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'SET_ARTIFACT':
      return { 
        ...state, 
        technicalArtifacts: { ...state.technicalArtifacts, [action.key]: action.value } 
      };
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true };
    case 'SUBMIT_END':
      return { ...state, isSubmitting: false };
    case 'REVERT_START':
      return { ...state, isReverting: true };
    case 'REVERT_END':
      return { ...state, isReverting: false };
    case 'SET_MISSING_WARNING':
      return { ...state, missingArtifactsWarning: action.missing, isSubmitting: false };
    case 'INIT_STATE': {
      const draft = action.payload || {};
      const currentStack = draft.current_stack || '';
      const integrationMethod = draft.latency_requirement?.replace('Integration Method: ', '') || '';
      const legacyVolume = draft.data_available?.replace('Legacy Volume: ', '') || '';
      const additionalReq = draft.additional_requirement_1 || '';
      const techArtifacts = draft.technical_artifacts || {};

      // Ensure all critical artifacts have at least an empty string entry
      const updatedArtifacts = { ...techArtifacts };
      if (action.artifactsJson) {
        action.artifactsJson.forEach((a: any) => {
          if (updatedArtifacts[a.artifact_key] === undefined) {
            updatedArtifacts[a.artifact_key] = '';
          }
        });
      }

      return {
        ...state,
        currentStack,
        legacyVolume,
        integrationMethod,
        additionalRequirement: additionalReq,
        technicalArtifacts: updatedArtifacts,
        initialized: true
      };
    }
    case 'AUTOFILL_AI': {
      const aiScale = action.payload.recommended_stack || '';
      const aiVolume = action.payload.recommended_legacy_volume || '';
      const aiIntegration = action.payload.recommended_integration || '';
      
      return {
        ...state,
        currentStack: aiScale,
        legacyVolume: aiVolume,
        integrationMethod: aiIntegration,
      };
    }
    default:
      return state;
  }
}

export default function Stage4ScenarioA({ sessionId, onComplete, onError, onBack, isForced }: Stage4AProps) {
  const queryClient = useQueryClient();
  const { session } = useElicitation(sessionId);
  
  const [state, dispatch] = useReducer(formReducer, {
    currentStack: '',
    integrationMethod: '',
    legacyVolume: '',
    additionalRequirement: '',
    technicalArtifacts: {},
    isSubmitting: false,
    isReverting: false,
    initialized: false,
    missingArtifactsWarning: null
  });

  const [isRecommending, setIsRecommending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleRecommend = async () => {
    setIsRecommending(true);
    setAiError(null);
    try {
      const res = await recommendStage4(sessionId);
      dispatch({ type: 'AUTOFILL_AI', payload: res });
    } catch (err: any) {
      setAiError(handleElicitationError(err).message || 'Failed to generate AI recommendations.');
    } finally {
      setIsRecommending(false);
    }
  };

  useEffect(() => {
    if (session && !state.initialized) {
      const payload = session.stage4TechInputsJson || session.stage4DraftJson || {};
      dispatch({ type: 'INIT_STATE', payload, artifactsJson: session.criticalArtifactsJson || [] });
    }
  }, [session, state.initialized]);

  // Auto-Save Effect
  useEffect(() => {
    if (!state.initialized) return;

    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }

    autoSaveTimeout.current = setTimeout(() => {
      saveStage4Draft(sessionId, {
        current_stack: state.currentStack,
        data_available: state.legacyVolume,
        latency_requirement: `Integration Method: ${state.integrationMethod}`,
        additional_requirement_1: state.additionalRequirement,
        technical_artifacts: state.technicalArtifacts
      }).catch(console.error);
    }, 1500);

    return () => {
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    };
  }, [state.currentStack, state.legacyVolume, state.integrationMethod, state.additionalRequirement, state.technicalArtifacts, state.initialized, sessionId]);


  const canSubmit = state.currentStack.trim().length > 0 && state.integrationMethod.trim().length > 0 && state.legacyVolume.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    dispatch({ type: 'SUBMIT_START' });
    
    submitStage4(
      sessionId, 
      state.currentStack.trim(), 
      state.integrationMethod.trim(), 
      state.legacyVolume.trim(), 
      state.additionalRequirement.trim(), 
      state.technicalArtifacts
    )
      .then((res) => {
        if (res.missingArtifacts && res.missingArtifacts.length > 0) {
          dispatch({ type: 'SET_MISSING_WARNING', missing: res.missingArtifacts });
        } else {
          queryClient.invalidateQueries({ queryKey: ["elicitation", "session", sessionId] });
          onComplete({});
        }
      })
      .catch((err: any) => {
        onError(handleElicitationError(err).message || 'Failed to submit technical context.');
        dispatch({ type: 'SUBMIT_END' });
        setCooldown(10);
      });
  };

  const handleConfirmMissing = () => {
    queryClient.invalidateQueries({ queryKey: ["elicitation", "session", sessionId] });
    onComplete({});
  };

  const handleRevertMissing = async () => {
    dispatch({ type: 'REVERT_START' });
    try {
      await revertSession(sessionId, 4); // Push back to Stage 4 to allow editing
      dispatch({ type: 'SET_MISSING_WARNING', missing: null });
      dispatch({ type: 'REVERT_END' });
    } catch (err: any) {
      onError(handleElicitationError(err).message || 'Failed to revert session.');
      dispatch({ type: 'REVERT_END' });
    }
  };


  const ta = "w-full rounded-lg border border-slate-200 bg-surface px-4 py-3 text-body text-primary placeholder:text-secondary transition-shadow hover:border-primary focus:border-2 focus:border-primary focus:ring-[3px] focus:ring-primary/10 focus:outline-none";

  return (
    <div className="space-y-8 relative">
      {state.missingArtifactsWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4">
          <div className="bg-white p-6 rounded-xl max-w-lg w-full shadow-xl">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <AlertTriangle className="w-8 h-8" />
              <h3 className="text-xl font-bold">Submit incomplete spec?</h3>
            </div>
            <p className="text-slate-600 mb-4 text-sm">
              You haven't provided the following critical artifacts. Without these, the AI will generate generic specifications which might lower the quality of your milestone plan.
            </p>
            <ul className="mb-6 space-y-2 max-h-[40vh] overflow-y-auto">
              {state.missingArtifactsWarning.map((m: any, i: number) => (
                <li key={i} className="text-sm bg-amber-50 text-amber-900 p-3 rounded-lg border border-amber-200">
                  <span className="font-semibold block mb-1">{m.label}</span> 
                  <span className="text-amber-800/80">{m.reason}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={handleRevertMissing} disabled={state.isReverting}>
                {state.isReverting ? 'Reverting...' : 'No, let me fix it'}
              </Button>
              <Button variant="primary" onClick={handleConfirmMissing} disabled={state.isReverting}>
                Submit anyway
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="text-center mb-6">
        <h2 className="text-h2 font-headline text-primary">Stage 4 of 5</h2>
        <p className="mt-2 text-body text-secondary max-w-md mx-auto">
          Technical Context — since you marked yourself as technical, please fill in these details about your infrastructure.
        </p>
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={handleRecommend} disabled={isRecommending || state.isSubmitting}>
            {isRecommending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : 'Let AI Recommend'}
          </Button>
        </div>
      </div>
      
      {aiError && <p className="text-sm text-red-600 mt-2">{aiError}</p>}
      
      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Scale and Infrastructure <span className="text-error">*</span></Label>
          <p className="text-caption text-secondary">Describe your current infrastructure and scale.</p>
          <textarea value={state.currentStack} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'currentStack', value: e.target.value })} placeholder="e.g. AWS EKS, 500k req/day…" rows={3} className={ta} />
        </div>
        
        <div className="space-y-2">
          <Label>Integration Method <span className="text-error">*</span></Label>
          <p className="text-caption text-secondary">How do you prefer to integrate with the AI service?</p>
          <textarea value={state.integrationMethod} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'integrationMethod', value: e.target.value })} placeholder="e.g. REST APIs…" rows={3} className={ta} />
        </div>
        
        <div className="space-y-2">
          <Label>Legacy Volume <span className="text-error">*</span></Label>
          <p className="text-caption text-secondary">How much legacy data do you have?</p>
          <textarea value={state.legacyVolume} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'legacyVolume', value: e.target.value })} placeholder="e.g. ~2TB in S3…" rows={2} className={ta} />
        </div>

        <div className="space-y-2">
          <Label>Additional Requirements</Label>
          <p className="text-caption text-secondary">Any other compliance rules, SSO needs, or constraints?</p>
          <textarea value={state.additionalRequirement} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'additionalRequirement', value: e.target.value })} placeholder="e.g. Must stay GDPR-compliant..." rows={2} className={ta} />
        </div>

        {session?.criticalArtifactsJson && session.criticalArtifactsJson.length > 0 && (
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-6 space-y-4">
            <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              Critical Documents Required
            </h3>
            <p className="text-sm text-blue-800">
              Based on your earlier answers, the AI requires the following context to generate an accurate milestone plan:
            </p>
            
            <div className="space-y-4 mt-4">
              {session.criticalArtifactsJson.map((artifact: any, idx: number) => (
                <div key={idx} className="space-y-2 bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
                  <Label className="text-blue-900">{artifact.label}</Label>
                  <p className="text-xs text-blue-700 italic mb-2">{artifact.reason}</p>
                  <textarea 
                    value={state.technicalArtifacts[artifact.artifact_key] || ''} 
                    onChange={(e) => dispatch({ type: 'SET_ARTIFACT', key: artifact.artifact_key, value: e.target.value })} 
                    placeholder={artifact.placeholder_prompt || `Please provide the contents or link for ${artifact.label}...`} 
                    rows={3} 
                    className={ta} 
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" onClick={async () => {
          if (isForced) {
            onBack();
            return;
          }

          dispatch({ type: 'REVERT_START' });
          try {
            await revertSession(sessionId, 3);
            await queryClient.invalidateQueries({ queryKey: ["elicitation", "session", sessionId] });
            onBack();
          } catch (err: any) {
            onError(handleElicitationError(err).message || 'Failed to revert session.');
            dispatch({ type: 'REVERT_END' });
          }
        }} disabled={state.isSubmitting || state.isReverting}>
          {state.isReverting ? 'Going back…' : (isForced ? '← Back to Generate Link' : '← Back')}
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!canSubmit || state.isSubmitting || cooldown > 0}
        >
          {state.isSubmitting ? 'Submitting...' : cooldown > 0 ? `Wait ${cooldown}s` : 'Submit Technical Context →'}
        </Button>
      </div>
    </div>
  );
}
