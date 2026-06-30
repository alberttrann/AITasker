import { useReducer } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/input';
import { submitStage3, handleElicitationError, PROBES, ARCHETYPE_LABELS } from '@/hooks/use-elicitation';
import { AlertTriangle } from 'lucide-react';

interface Stage3Props {
  sessionId: string;
  archetype: string;
  onComplete: (data: { probeResponses: Record<string, string> }) => void;
  onError: (msg: string) => void;
  onBack: () => void;
  initialResponses?: Record<string, string>;
}

type State = {
  answers: Record<string, string>;
  vagueAnswers: Array<{question: string; reason: string}>;
  isSubmitting: boolean;
};

type Action = 
  | { type: 'SET_ANSWER'; key: string; value: string; questionLabel: string }
  | { type: 'SET_VAGUE_ANSWERS'; vagueAnswers: Array<{question: string; reason: string}> }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_END' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_ANSWER':
      return { 
        ...state, 
        answers: { ...state.answers, [action.key]: action.value },
        vagueAnswers: state.vagueAnswers.filter((v) => v.question !== action.questionLabel)
      };
    case 'SET_VAGUE_ANSWERS':
      return { ...state, vagueAnswers: action.vagueAnswers };
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true };
    case 'SUBMIT_END':
      return { ...state, isSubmitting: false };
    default:
      return state;
  }
}

export default function Stage3Probes({ sessionId, archetype, onComplete, onError, onBack, initialResponses = {} }: Stage3Props) {
  const questions = PROBES[archetype] ?? PROBES['1'];
  
  const [state, dispatch] = useReducer(reducer, {
    answers: { 
      q1: initialResponses[questions.q1] ?? '', 
      q2: initialResponses[questions.q2] ?? '', 
      q3: initialResponses[questions.q3] ?? '', 
      q4: initialResponses[questions.q4] ?? '' 
    },
    vagueAnswers: [],
    isSubmitting: false
  });

  const allFilled = Object.values(state.answers).every((a) => a.trim().length > 0);

  const handleChange = (key: string, value: string) => {
    dispatch({ type: 'SET_ANSWER', key, value, questionLabel: questions[key] });
  };

  const handleSubmit = async () => {
    if (!allFilled) return;
    dispatch({ type: 'SUBMIT_START' });

    const probeResponses: Record<string, string> = {
      [questions.q1]: state.answers.q1.trim(),
      [questions.q2]: state.answers.q2.trim(),
      [questions.q3]: state.answers.q3.trim(),
      [questions.q4]: state.answers.q4.trim(),
    };

    try {
      const data = await submitStage3(sessionId, probeResponses);
      if (!data.advanced && data.vague_answers?.length > 0) {
        dispatch({ type: 'SET_VAGUE_ANSWERS', vagueAnswers: data.vague_answers });
        return;
      }
      onComplete({ probeResponses });
    } catch (err: any) {
      onError(handleElicitationError(err).message || 'Failed to submit probe answers.');
    } finally {
      dispatch({ type: 'SUBMIT_END' });
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

      <div className="space-y-6">
        {(['q1', 'q2', 'q3', 'q4'] as const).map((key) => (
          <div key={key} className="space-y-2">
            <Label>{questions[key]}</Label>
            <textarea value={state.answers[key]} onChange={(e) => handleChange(key, e.target.value)} placeholder="Type your answer…" rows={3} className={textareaClass(state.vagueAnswers.some(v => v.question === questions[key]))} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" onClick={onBack} disabled={state.isSubmitting}>
          ← Back
        </Button>
        <Button variant="primary" disabled={!allFilled || state.isSubmitting} onClick={handleSubmit}>
          {state.isSubmitting ? 'Submitting…' : 'Continue to Stage 4 →'}
        </Button>
      </div>
    </div>
  );
}
