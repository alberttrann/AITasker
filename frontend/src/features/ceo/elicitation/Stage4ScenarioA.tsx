import { useReducer, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/input';
import { submitStage4, handleElicitationError, type GateResult, revertSession, useElicitation, recommendStage4 } from '@/hooks/use-elicitation';
import { useQueryClient } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';

interface Stage4AProps {
  sessionId: string;
  onComplete: (data: { gateResult: GateResult }) => void;
  onError: (msg: string) => void;
  onBack: () => void;
}

type FormState = {
  scaleAndInfrastructure: string;
  integrationMethod: string;
  legacyVolume: string;
  schemas: string[];
  schemaInput: string;
  contracts: string[];
  contractInput: string;
  isSubmitting: boolean;
  isReverting: boolean;
  initialized: boolean;
};

type FormAction =
  | { type: 'SET_FIELD'; field: keyof FormState; value: any }
  | { type: 'ADD_URL'; listField: 'schemas' | 'contracts'; inputField: 'schemaInput' | 'contractInput' }
  | { type: 'REMOVE_URL'; listField: 'schemas' | 'contracts'; index: number }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_END' }
  | { type: 'REVERT_START' }
  | { type: 'REVERT_END' }
  | { type: 'INIT_STATE'; payload: any }
  | { type: 'AUTOFILL_AI'; payload: any };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'ADD_URL': {
      const trimmed = state[action.inputField].trim();
      if (!trimmed) return state;
      const list = state[action.listField] as string[];
      if (list.includes(trimmed)) return { ...state, [action.inputField]: '' };
      return { ...state, [action.listField]: [...list, trimmed], [action.inputField]: '' };
    }
    case 'REMOVE_URL':
      return { ...state, [action.listField]: (state[action.listField] as string[]).filter((_, i) => i !== action.index) };
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true };
    case 'SUBMIT_END':
      return { ...state, isSubmitting: false };
    case 'REVERT_START':
      return { ...state, isReverting: true };
    case 'REVERT_END':
      return { ...state, isReverting: false };
    case 'INIT_STATE':
      const currentStackStr = action.payload.current_stack || '';
      const scaleAndInfrastructure = currentStackStr.split('\nSchemas: ')[0]?.replace('Scale & Infra: ', '') || '';
      const schemasStr = currentStackStr.split('\nSchemas: ')[1] || '';
      const schemas = schemasStr === 'None' ? [] : schemasStr.split(', ').filter(Boolean);

      const legacyVolume = (action.payload.data_available || '').replace('Legacy Volume: ', '');

      const latencyReqStr = action.payload.latency_requirement || '';
      const integrationMethod = latencyReqStr.split('\nContracts: ')[0]?.replace('Integration Method: ', '') || '';
      const contractsStr = latencyReqStr.split('\nContracts: ')[1] || '';
      const contracts = contractsStr === 'None' ? [] : contractsStr.split(', ').filter(Boolean);

      return {
        ...state,
        scaleAndInfrastructure,
        legacyVolume,
        integrationMethod,
        schemas,
        contracts,
        initialized: true
      };
    case 'AUTOFILL_AI': {
      const aiScale = action.payload.recommended_stack || '';
      const aiVolume = action.payload.recommended_legacy_volume || '';
      const aiIntegration = action.payload.recommended_integration || '';
      
      return {
        ...state,
        scaleAndInfrastructure: aiScale,
        legacyVolume: aiVolume,
        integrationMethod: aiIntegration,
      };
    }
    default:
      return state;
  }
}

export default function Stage4ScenarioA({ sessionId, onComplete, onError, onBack }: Stage4AProps) {
  const queryClient = useQueryClient();
  const { session, isLoadingSession } = useElicitation(sessionId);
  const [state, dispatch] = useReducer(formReducer, {
    scaleAndInfrastructure: '',
    integrationMethod: '',
    legacyVolume: '',
    schemas: [],
    schemaInput: '',
    contracts: [],
    contractInput: '',
    isSubmitting: false,
    isReverting: false,
    initialized: false,
  });

  const [isRecommending, setIsRecommending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleRecommend = async () => {
    setIsRecommending(true);
    setAiError(null);
    try {
      const res = await recommendStage4(sessionId);
      console.log(res);
      dispatch({ type: 'AUTOFILL_AI', payload: res });
    } catch (err: any) {
      setAiError(handleElicitationError(err).message || 'Failed to generate AI recommendations.');
    } finally {
      setIsRecommending(false);
    }
  };

  useEffect(() => {
    if (session?.stage4TechInputsJson && !state.initialized) {
       dispatch({ type: 'INIT_STATE', payload: session.stage4TechInputsJson });
    } else if (session && !session.stage4TechInputsJson && !state.initialized) {
       dispatch({ type: 'INIT_STATE', payload: {} });
    }
  }, [session, state.initialized]);

  const canSubmit = state.scaleAndInfrastructure.trim().length > 0 && state.integrationMethod.trim().length > 0 && state.legacyVolume.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    dispatch({ type: 'SUBMIT_START' });
    
    submitStage4(sessionId, state.scaleAndInfrastructure.trim(), state.integrationMethod.trim(), state.legacyVolume.trim(), state.schemas, state.contracts)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["elicitation", "session", sessionId] });
      })
      .catch((err: any) => {
        onError(handleElicitationError(err).message || 'Failed to submit technical context.');
      });

    onComplete({});
  };

  const addUrl = (type: 'schema' | 'contract') => {
    if (type === 'schema') {
      dispatch({ type: 'ADD_URL', listField: 'schemas', inputField: 'schemaInput' });
    } else {
      dispatch({ type: 'ADD_URL', listField: 'contracts', inputField: 'contractInput' });
    }
  };

  const ta = "w-full rounded-lg border border-slate-200 bg-surface px-4 py-3 text-body text-primary placeholder:text-secondary transition-shadow hover:border-primary focus:border-2 focus:border-primary focus:ring-[3px] focus:ring-primary/10 focus:outline-none";

  return (
    <div className="space-y-8">
      <div>
        <div className="flex justify-between items-start gap-4">
          <div>
            <h2 className="text-h2 font-headline text-primary">Stage 4 of 5</h2>
            <p className="text-body-sm text-secondary">Technical Context — since you marked yourself as technical, please fill in these details about your infrastructure.</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRecommend} disabled={isRecommending || state.isSubmitting} className="shrink-0">
            {isRecommending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : 'Let AI Recommend'}
          </Button>
        </div>
        {aiError && <p className="text-sm text-red-600 mt-2">{aiError}</p>}
      </div>
      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Scale and Infrastructure</Label>
          <p className="text-caption text-secondary">Describe your current infrastructure and scale.</p>
          <textarea value={state.scaleAndInfrastructure} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'scaleAndInfrastructure', value: e.target.value })} placeholder="e.g. AWS EKS, 500k req/day…" rows={3} className={ta} />
        </div>
        <div className="space-y-2">
          <Label>Integration Method</Label>
          <p className="text-caption text-secondary">How do you prefer to integrate with the AI service?</p>
          <textarea value={state.integrationMethod} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'integrationMethod', value: e.target.value })} placeholder="e.g. REST APIs…" rows={3} className={ta} />
        </div>
        <div className="space-y-2">
          <Label>Legacy Volume</Label>
          <p className="text-caption text-secondary">How much legacy data do you have?</p>
          <textarea value={state.legacyVolume} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'legacyVolume', value: e.target.value })} placeholder="e.g. ~2TB in S3…" rows={2} className={ta} />
        </div>
        
        <div className="space-y-2">
          <Label>Schemas (Optional)</Label>
          <p className="text-caption text-secondary">Links to your data schemas.</p>
          <div className="flex gap-2">
            <input value={state.schemaInput} onChange={e => dispatch({ type: 'SET_FIELD', field: 'schemaInput', value: e.target.value })} placeholder="https://..." className="flex-1 rounded-lg border border-slate-200 bg-surface px-4 py-3 text-body text-primary focus:border-primary focus:ring-[3px] focus:ring-primary/10 focus:outline-none" onKeyDown={e => e.key === 'Enter' && addUrl('schema')} />
            <Button variant="secondary" onClick={() => addUrl('schema')}>Add</Button>
          </div>
          {state.schemas.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {state.schemas.map((url, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs">
                  {url.length > 40 ? url.substring(0, 40) + '...' : url}
                  <button onClick={() => dispatch({ type: 'REMOVE_URL', listField: 'schemas', index: i })} className="ml-1 text-red-500 hover:text-red-700"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Contracts (Optional)</Label>
          <p className="text-caption text-secondary">Links to your API contracts.</p>
          <div className="flex gap-2">
            <input value={state.contractInput} onChange={e => dispatch({ type: 'SET_FIELD', field: 'contractInput', value: e.target.value })} placeholder="https://..." className="flex-1 rounded-lg border border-slate-200 bg-surface px-4 py-3 text-body text-primary focus:border-primary focus:ring-[3px] focus:ring-primary/10 focus:outline-none" onKeyDown={e => e.key === 'Enter' && addUrl('contract')} />
            <Button variant="secondary" onClick={() => addUrl('contract')}>Add</Button>
          </div>
          {state.contracts.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {state.contracts.map((url, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs">
                  {url.length > 40 ? url.substring(0, 40) + '...' : url}
                  <button onClick={() => dispatch({ type: 'REMOVE_URL', listField: 'contracts', index: i })} className="ml-1 text-red-500 hover:text-red-700"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" onClick={async () => {
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
          {state.isReverting ? 'Going back…' : '← Back'}
        </Button>
        <Button variant="primary" disabled={!canSubmit || state.isSubmitting || state.isReverting} onClick={handleSubmit}>
          {state.isSubmitting ? 'Submitting…' : 'Submit & Generate PRD →'}
        </Button>
      </div>
    </div>
  );
}
