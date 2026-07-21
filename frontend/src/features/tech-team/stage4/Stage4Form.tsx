import React, { useReducer, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitStage4Handoff, getSession, saveStage4Draft } from '../../../hooks/use-elicitation';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/input';

type FormState = {
  currentStack: string;
  integrationMethod: string;
  legacyVolume: string;
  additionalRequirement: string;
  technicalArtifacts: Record<string, string>;
  isSubmitting: boolean;
  isSubmitted: boolean;
  error: string | null;
  initialized: boolean;
  missingArtifactsWarning: any[] | null;
  isReverting: boolean;
};

type FormAction =
  | { type: 'SET_FIELD'; field: keyof FormState; value: any }
  | { type: 'SET_ARTIFACT'; key: string; value: string }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'REVERT_START' }
  | { type: 'REVERT_END' }
  | { type: 'SET_MISSING_WARNING'; missing: any[] | null }
  | { type: 'INIT_STATE'; payload: any; artifactsJson: any[] };

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
      return { ...state, isSubmitting: true, error: null };
    case 'SUBMIT_SUCCESS':
      return { ...state, isSubmitting: false, isSubmitted: true };
    case 'SUBMIT_ERROR':
      return { ...state, isSubmitting: false, error: action.error };
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
    default:
      return state;
  }
}

export default function Stage4Form() {
  const navigate = useNavigate();
  const [sessionId] = useState(() => sessionStorage.getItem('handoff_sessionId'));
  const [cooldown, setCooldown] = useState(0);
  const [criticalArtifacts, setCriticalArtifacts] = useState<any[]>([]);

  const [state, dispatch] = useReducer(formReducer, {
    currentStack: '',
    integrationMethod: '',
    legacyVolume: '',
    additionalRequirement: '',
    technicalArtifacts: {},
    isSubmitting: false,
    isSubmitted: false,
    error: null,
    initialized: false,
    missingArtifactsWarning: null,
    isReverting: false
  });

  const autoSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  useEffect(() => {
    if (sessionId && !state.initialized) {
      getSession(sessionId).then((session) => {
        setCriticalArtifacts(session.criticalArtifactsJson || []);
        const payload = session.stage4TechInputsJson || session.stage4DraftJson || {};
        dispatch({ type: 'INIT_STATE', payload, artifactsJson: session.criticalArtifactsJson || [] });
      }).catch(console.error);
    }
  }, [sessionId, state.initialized]);

  useEffect(() => {
    if (!state.initialized || !sessionId) return;

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


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;

    if (
      !state.currentStack.trim() ||
      !state.integrationMethod.trim() ||
      !state.legacyVolume.trim()
    ) {
      dispatch({ type: 'SUBMIT_ERROR', error: 'Please fill in all the required technical context fields.' });
      return;
    }

    dispatch({ type: 'SUBMIT_START' });

    try {
      const res = await submitStage4Handoff(sessionId, {
        current_stack: state.currentStack.trim(),
        data_available: state.legacyVolume.trim(),
        latency_requirement: `Integration Method: ${state.integrationMethod.trim()}`,
        additional_requirement_1: state.additionalRequirement.trim(),
        technical_artifacts: state.technicalArtifacts
      });

      if (res.missingArtifacts && res.missingArtifacts.length > 0) {
        dispatch({ type: 'SET_MISSING_WARNING', missing: res.missingArtifacts });
      } else {
        sessionStorage.removeItem('handoff_sessionId');
        dispatch({ type: 'SUBMIT_SUCCESS' });
        navigate('/tech-team/submitted');
      }
    } catch (err: any) {
      const serverMessage = err.response?.data?.message;
      dispatch({
        type: 'SUBMIT_ERROR',
        error: Array.isArray(serverMessage)
          ? serverMessage[0]
          : serverMessage || 'An unexpected error occurred during submission. Please try again.'
      });
      setCooldown(10);
    }
  };

  const handleConfirmMissing = () => {
    sessionStorage.removeItem('handoff_sessionId');
    navigate('/tech-team/submitted');
  };

  const handleRevertMissing = async () => {
    dispatch({ type: 'REVERT_START' });
    try {
      // For Tech Team, we can't revert the session to stage 4 because they don't have the API permission.
      // Wait, processStage4Handoff actually advanced the session to Stage 5.
      // But they can still call processStage4Handoff in Stage 5 (the backend allows it: "expected stage 4 or 5").
      // So they don't need to actually call revertSession! They can just close the modal and submit again.
      dispatch({ type: 'SET_MISSING_WARNING', missing: null });
      dispatch({ type: 'REVERT_END' });
    } catch (err: any) {
      dispatch({ type: 'REVERT_END' });
    }
  };

  if (!sessionId) {
    return (
      <div className="max-w-[1440px] mx-auto py-16 px-4 text-center font-body">
        <div className="flex justify-center mb-4"><AlertTriangle className="w-16 h-16 text-error" /></div>
        <h3 className="text-xl font-semibold text-primary mb-2 font-headline">
          Session ID Missing
        </h3>
        <p className="text-secondary">
          Please make sure you have used the correct handoff link provided by your CEO.
        </p>
      </div>
    );
  }

  if (state.isSubmitted) {
    return null;
  }

  const ta = "w-full border border-secondary/20 hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary-bg rounded p-3 text-sm text-primary bg-surface outline-none transition-all";

  return (
    <div className="max-w-[1440px] mx-auto py-10 px-8 bg-surface rounded-lg shadow-md border border-secondary/15 my-8 font-body relative">
      
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
                {state.isReverting ? 'Closing...' : 'No, let me fix it'}
              </Button>
              <Button variant="primary" onClick={handleConfirmMissing} disabled={state.isReverting}>
                Submit anyway
              </Button>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold text-primary mb-2 font-headline leading-[1.25]">
        Complete Technical Context
      </h2>
      <p className="text-sm text-secondary mb-8 leading-relaxed">
        Your CEO has invited you to provide structural and infrastructural details of your system. 
        Your context is crucial to accurately match the best AI experts for this workspace.
      </p>

      {state.error && (
        <div className="p-4 mb-6 text-sm text-error bg-error/10 rounded-lg border border-error/20 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2" />
          {state.error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">
            Scale & Infrastructure <span className="text-error">*</span>
          </label>
          <p className="text-xs text-secondary mb-2">
            Describe your current deployment setup, request volumes, and overall cloud infrastructure.
          </p>
          <textarea
            value={state.currentStack}
            onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'currentStack', value: e.target.value })}
            className={ta + " min-h-[112px]"}
            placeholder="e.g., We deploy on GCP GKE, autoscaling from 10 to 50 pods, handling ~1.5M requests/day using PostgreSQL..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-primary mb-1">
            Integration Method <span className="text-error">*</span>
          </label>
          <p className="text-xs text-secondary mb-2">
            How do you expect the AI service to interface with your system? (e.g., REST API, GraphQL, Kafka streaming, direct DB writing)
          </p>
          <textarea
            value={state.integrationMethod}
            onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'integrationMethod', value: e.target.value })}
            className={ta + " min-h-[96px]"}
            placeholder="e.g., We need a REST endpoint taking JSON that returns a prediction within 2 seconds."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-primary mb-1">
            Legacy Volume <span className="text-error">*</span>
          </label>
          <p className="text-xs text-secondary mb-2">
            What is the volume of existing data that needs to be processed or migrated?
          </p>
          <textarea
            value={state.legacyVolume}
            onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'legacyVolume', value: e.target.value })}
            className={ta + " min-h-[80px]"}
            placeholder="e.g., About 2TB of raw logs in S3 and 500GB in the main relational DB."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-primary mb-1">
            Additional Requirements
          </label>
          <p className="text-xs text-secondary mb-2">
            Any other compliance rules, SSO needs, or constraints?
          </p>
          <textarea
            value={state.additionalRequirement}
            onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'additionalRequirement', value: e.target.value })}
            className={ta + " min-h-[80px]"}
            placeholder="e.g. Must stay GDPR-compliant..."
          />
        </div>

        {criticalArtifacts.length > 0 && (
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-6 space-y-4">
            <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              Critical Documents Required
            </h3>
            <p className="text-sm text-blue-800">
              Based on the CEO's earlier answers, the AI requires the following context to generate an accurate milestone plan:
            </p>
            
            <div className="space-y-4 mt-4">
              {criticalArtifacts.map((artifact: any, idx: number) => (
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

        <div className="pt-6 border-t border-secondary/15 flex justify-end">
          <Button
            type="submit"
            disabled={state.isSubmitting || cooldown > 0}
            variant="primary"
            size="lg"
            className="w-full sm:w-auto"
          >
            {state.isSubmitting ? 'Submitting...' : cooldown > 0 ? `Wait ${cooldown}s` : 'Submit Technical Context'}
          </Button>
        </div>
      </form>
    </div>
  );
}
