import { useReducer, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/input';
import { submitStage3, handleElicitationError, revertSession, useElicitation } from '@/hooks/use-elicitation';
import { useArchetypes, useProbeQuestions } from '@/hooks/use-config';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, MessageSquare } from 'lucide-react';

interface Stage3Props {
  sessionId: string;
  onComplete: (data: any) => void;
  onError: (msg: string) => void;
  onBack: () => void;
}

type State = {
  answers: Record<string, string>;
  vagueAnswers: Array<{question: string; reason: string}>;
  irrelevantAnswers: Array<{question: string; issue: string}>;
  isSubmitting: boolean;
  isReverting: boolean;
  initialized: boolean;
};

type Action = 
  | { type: 'SET_ANSWER'; key: string; value: string; questionLabel: string }
  | { type: 'SET_ISSUES'; vagueAnswers: Array<{question: string; reason: string}>; irrelevantAnswers: Array<{question: string; issue: string}> }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_END' }
  | { type: 'REVERT_START' }
  | { type: 'REVERT_END' }
  | { type: 'INIT_STATE'; payload: Record<string, string>; questions: Array<{id: string, questionText: string}> };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_ANSWER':
      return { 
        ...state, 
        answers: { ...state.answers, [action.key]: action.value },
        vagueAnswers: state.vagueAnswers.filter((v) => v.question !== action.questionLabel),
        irrelevantAnswers: state.irrelevantAnswers.filter((v) => v.question !== action.questionLabel)
      };
    case 'SET_ISSUES':
      return { ...state, vagueAnswers: action.vagueAnswers, irrelevantAnswers: action.irrelevantAnswers };
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true };
    case 'SUBMIT_END':
      return { ...state, isSubmitting: false };
    case 'REVERT_START':
      return { ...state, isReverting: true };
    case 'REVERT_END':
      return { ...state, isReverting: false };
    case 'INIT_STATE':
      const initAnswers: Record<string, string> = {};
      action.questions.forEach(q => {
        initAnswers[q.id] = action.payload[q.questionText] || '';
      });
      return { 
        ...state, 
        initialized: true,
        answers: initAnswers
      };
    default:
      return state;
  }
}

export default function Stage3Probes({ sessionId, onComplete, onError, onBack }: Stage3Props) {
  const queryClient = useQueryClient();
  const { session, isLoadingSession } = useElicitation(sessionId);
  const archetypeCode = session?.archetype || '1';

  const { data: archetypesList } = useArchetypes();
  const { data: probeQuestionsList, isLoading: loadingProbes } = useProbeQuestions(archetypeCode);

  const archetypeData = archetypesList?.find(a => a.code === archetypeCode);
  
  // Sort probe questions by displayOrder
  const sortedProbes = useMemo(() => {
    if (!probeQuestionsList) return [];
    return [...probeQuestionsList]
      .filter(p => p.isActive !== false) // Handle potential isActive flag
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [probeQuestionsList]);

  const [state, dispatch] = useReducer(reducer, {
    answers: {},
    vagueAnswers: [],
    irrelevantAnswers: [],
    isSubmitting: false,
    isReverting: false,
    initialized: false
  });

  useEffect(() => {
    if (sortedProbes.length > 0) {
      if (session?.stage3ProbesJson && !state.initialized) {
         dispatch({ type: 'INIT_STATE', payload: session.stage3ProbesJson, questions: sortedProbes });
      } else if (session && !session.stage3ProbesJson && !state.initialized) {
         dispatch({ type: 'INIT_STATE', payload: {}, questions: sortedProbes });
      }
    }
  }, [session, state.initialized, sortedProbes]);

  const allFilled = sortedProbes.length > 0 && sortedProbes.every(probe => {
    const val = state.answers[probe.id];
    return val && val.trim().length > 0;
  });

  const handleChange = (probeId: string, value: string, questionText: string) => {
    dispatch({ type: 'SET_ANSWER', key: probeId, value, questionLabel: questionText });
  };

  const handleSubmit = async () => {
    if (!allFilled) return;
    dispatch({ type: 'SUBMIT_START' });

    const probeResponses: Record<string, string> = {};
    sortedProbes.forEach(probe => {
      probeResponses[probe.questionText] = state.answers[probe.id]?.trim() || '';
    });

    try {
      const data = await submitStage3(sessionId, probeResponses);
      
      const vague = data.vaguenessResult?.vague_answers || data.vague_answers || [];
      const irrelevant = data.vaguenessResult?.irrelevant_answers || [];
      
      if (!data.advanced && (vague.length > 0 || irrelevant.length > 0)) {
        dispatch({ type: 'SET_ISSUES', vagueAnswers: vague, irrelevantAnswers: irrelevant });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["elicitation", "session", sessionId] });
      // Pass the target stage to the wizard so it doesn't jump prematurely
      onComplete({ nextStage: data.currentStage || 4 });
    } catch (err: any) {
      onError(handleElicitationError(err).message || 'Failed to submit probe answers.');
    } finally {
      dispatch({ type: 'SUBMIT_END' });
    }
  };

  const textareaClass = (isVague: boolean, isIrrelevant: boolean) =>
    `w-full rounded-lg border bg-surface px-4 py-3 text-body text-primary placeholder:text-secondary transition-shadow hover:border-primary focus:border-2 focus:border-primary focus:ring-[3px] focus:ring-primary/10 focus:outline-none ${isIrrelevant ? 'border-red-500 ring-red-500/10 focus:ring-red-500/10 focus:border-red-500' : isVague ? 'border-warning' : 'border-slate-200'}`;

  return (
    <div className="space-y-8">
      <div className="text-center mb-6">
        <h2 className="text-h2 font-headline text-primary">Stage 3 of 5</h2>
        <p className="mt-2 text-body text-secondary max-w-md mx-auto">
          Infrastructure Details — {archetypeData?.name ?? 'Unknown Archetype'}
        </p>
      </div>

      {state.vagueAnswers.length > 0 && (
        <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
          <p className="text-body-sm font-medium text-warning flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" /> Some answers need more detail before continuing:</p>
          <ul className="mt-2 list-inside list-disc text-body-sm text-secondary space-y-2">
            {state.vagueAnswers.map((v) => (
              <li key={v.question}>
                <strong>{v.question}</strong>
                <p className="text-caption text-secondary/80 mt-1">{v.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.irrelevantAnswers.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-body-sm font-medium text-red-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-600" /> Some answers are irrelevant to the question:</p>
          <ul className="mt-2 list-inside list-disc text-body-sm text-secondary space-y-2">
            {state.irrelevantAnswers.map((v) => (
              <li key={v.question}>
                <strong>{v.question}</strong>
                <p className="text-caption text-secondary/80 mt-1 text-red-700">{v.issue}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-6">
        {loadingProbes ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-primary animate-spin"></div>
          </div>
        ) : sortedProbes.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
            <MessageSquare size={40} className="text-slate-300 mb-3 mx-auto" />
            <h3 className="text-base font-bold text-slate-800 mb-1">No questions configured</h3>
            <p className="text-slate-500 text-sm">Please contact support to configure questions for this archetype.</p>
          </div>
        ) : (
          sortedProbes.map((probe) => (
            <div key={probe.id} className="space-y-2">
              <Label>{probe.questionText}</Label>
              <textarea 
                value={state.answers[probe.id] || ''} 
                onChange={(e) => handleChange(probe.id, e.target.value, probe.questionText)} 
                placeholder="Type your answer…" 
                rows={3} 
                className={textareaClass(
                  state.vagueAnswers.some(v => v.question === probe.questionText),
                  state.irrelevantAnswers.some(v => v.question === probe.questionText)
                )} 
              />
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" onClick={async () => {
          dispatch({ type: 'REVERT_START' });
          try {
            await revertSession(sessionId, 2);
            await queryClient.invalidateQueries({ queryKey: ["elicitation", "session", sessionId] });
            onBack();
          } catch (err: any) {
            onError(handleElicitationError(err).message || 'Failed to revert session.');
            dispatch({ type: 'REVERT_END' });
          }
        }} disabled={state.isSubmitting || state.isReverting}>
          {state.isReverting ? 'Going back…' : '← Back'}
        </Button>
        <Button variant="primary" disabled={!allFilled || state.isSubmitting || state.isReverting || sortedProbes.length === 0} onClick={handleSubmit}>
          {state.isSubmitting ? 'Submitting…' : 'Continue to Stage 4 →'}
        </Button>
      </div>
    </div>
  );
}
