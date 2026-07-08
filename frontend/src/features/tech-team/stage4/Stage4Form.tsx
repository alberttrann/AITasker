import React, { useReducer, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitStage4Handoff } from '../../../hooks/use-elicitation';
import { AlertTriangle, X } from 'lucide-react';

type FormState = {
  scaleAndInfrastructure: string;
  integrationMethod: string;
  legacyVolume: string;
  techStackList: string[];
  techStackInput: string;
  schemas: string[];
  schemaInput: string;
  contracts: string[];
  contractInput: string;
  isSubmitting: boolean;
  isSubmitted: boolean;
  error: string | null;
};

type FormAction =
  | { type: 'SET_FIELD'; field: keyof FormState; value: any }
  | { type: 'ADD_ITEM'; listField: 'techStackList' | 'schemas' | 'contracts'; inputField: 'techStackInput' | 'schemaInput' | 'contractInput'; validateUrl?: boolean }
  | { type: 'REMOVE_ITEM'; listField: 'techStackList' | 'schemas' | 'contracts'; index: number }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_ERROR'; error: string };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'ADD_ITEM': {
      const trimmed = state[action.inputField].trim();
      if (!trimmed) return state;
      if (action.validateUrl && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        return { ...state, error: 'Please enter a valid URL (starting with http:// or https://)' };
      }
      const list = state[action.listField] as string[];
      if (list.includes(trimmed)) return { ...state, [action.inputField]: '', error: null };
      return { ...state, [action.listField]: [...list, trimmed], [action.inputField]: '', error: null };
    }
    case 'REMOVE_ITEM':
      return {
        ...state,
        [action.listField]: (state[action.listField] as string[]).filter((_, i) => i !== action.index)
      };
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true, error: null };
    case 'SUBMIT_SUCCESS':
      return { ...state, isSubmitting: false, isSubmitted: true };
    case 'SUBMIT_ERROR':
      return { ...state, isSubmitting: false, error: action.error };
    default:
      return state;
  }
}

export default function Stage4Form() {
  const navigate = useNavigate();
  const [sessionId] = useState(() => sessionStorage.getItem('handoff_sessionId'));
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const [state, dispatch] = useReducer(formReducer, {
    scaleAndInfrastructure: '',
    integrationMethod: '',
    legacyVolume: '',
    techStackList: [],
    techStackInput: '',
    schemas: [],
    schemaInput: '',
    contracts: [],
    contractInput: '',
    isSubmitting: false,
    isSubmitted: false,
    error: null,
  });

  const addTechStack = () => dispatch({ type: 'ADD_ITEM', listField: 'techStackList', inputField: 'techStackInput' });
  const removeTechStack = (index: number) => dispatch({ type: 'REMOVE_ITEM', listField: 'techStackList', index });
  
  const addSchema = () => dispatch({ type: 'ADD_ITEM', listField: 'schemas', inputField: 'schemaInput', validateUrl: true });
  const removeSchema = (index: number) => dispatch({ type: 'REMOVE_ITEM', listField: 'schemas', index });
  
  const addContract = () => dispatch({ type: 'ADD_ITEM', listField: 'contracts', inputField: 'contractInput', validateUrl: true });
  const removeContract = (index: number) => dispatch({ type: 'REMOVE_ITEM', listField: 'contracts', index });

  // Submit dữ liệu về Backend
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;

    // Tự động thêm nội dung đang gõ dở ở ô Tech Stack vào danh sách nếu có
    let finalTechStack = [...state.techStackList];
    if (state.techStackInput.trim()) {
      const trimmedInput = state.techStackInput.trim();
      if (!finalTechStack.includes(trimmedInput)) {
        finalTechStack.push(trimmedInput);
      }
    }

    if (
      !state.scaleAndInfrastructure.trim() ||
      !state.integrationMethod.trim() ||
      !state.legacyVolume.trim() ||
      finalTechStack.length === 0
    ) {
      dispatch({ type: 'SUBMIT_ERROR', error: 'Please fill in all the required technical context fields (including at least one Tech Stack).' });
      return;
    }

    dispatch({ type: 'SUBMIT_START' });

    // Ghép mảng thành một chuỗi phân tách bởi dấu phẩy
    const techStackString = finalTechStack.join(', ');

    try {
      const current_stack = `Scale & Infra: ${state.scaleAndInfrastructure}\nTech Stack: ${techStackString}\nSchemas: ${state.schemas.join(", ") || "None"}`;
      const data_available = `Legacy Volume: ${state.legacyVolume}`;
      const latency_requirement = `Integration Method: ${state.integrationMethod}\nContracts: ${state.contracts.join(", ") || "None"}\nLatency: < 5s`;

      await submitStage4Handoff(sessionId, {
        current_stack,
        data_available,
        latency_requirement
      });

      // Dọn dẹp session ID khỏi storage khi thành công
      sessionStorage.removeItem('handoff_sessionId');
      dispatch({ type: 'SUBMIT_SUCCESS' });
      navigate('/tech-team/submitted');
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
    // Already navigating to the submitted page, just render nothing while transitioning
    return null;
  }

  return (
    <div className="max-w-[1440px] mx-auto py-10 px-8 bg-surface rounded-lg shadow-md border border-secondary/15 my-8 font-body">
      <h2 className="text-2xl font-bold text-primary mb-2 font-headline leading-[1.25]">
        Complete Technical Context
      </h2>
      <p className="text-sm text-secondary mb-8 leading-relaxed">
        Your CEO has invited you to provide structural and infrastructural details of your system. 
        Your context is crucial to accurately match the best AI experts for this workspace.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Scale & Infrastructure */}
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">
            Scale & Infrastructure <span className="text-error">*</span>
          </label>
          <p className="text-xs text-secondary mb-2">
            Describe your current deployment setup, request volumes, and overall cloud infrastructure.
          </p>
          <textarea
            value={state.scaleAndInfrastructure}
            onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'scaleAndInfrastructure', value: e.target.value })}
            className="w-full min-h-[112px] border border-secondary/20 hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary-bg rounded p-3 text-sm text-primary bg-surface outline-none transition-all"
            placeholder="e.g., We deploy on GCP GKE, autoscaling from 10 to 50 pods, handling ~1.5M requests/day using PostgreSQL..."
            required
          />
        </div>

        {/* Integration Method */}
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">
            Integration Method <span className="text-error">*</span>
          </label>
          <p className="text-xs text-secondary mb-2">
            How will the AI model or application integrate with your existing APIs or workflows?
          </p>
          <textarea
            value={state.integrationMethod}
            onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'integrationMethod', value: e.target.value })}
            className="w-full min-h-[96px] border border-secondary/20 hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary-bg rounded p-3 text-sm text-primary bg-surface outline-none transition-all"
            placeholder="e.g., RESTful APIs, message-driven queue using Apache Kafka, or direct database sink..."
            required
          />
        </div>

        {/* Legacy Data Volume */}
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">
            Legacy Data Volume <span className="text-error">*</span>
          </label>
          <p className="text-xs text-secondary mb-2">
            Mention the size, formats, and storage locations of historical data available for tuning or validation.
          </p>
          <textarea
            value={state.legacyVolume}
            onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'legacyVolume', value: e.target.value })}
            className="w-full min-h-[96px] border border-secondary/20 hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary-bg rounded p-3 text-sm text-primary bg-surface outline-none transition-all"
            placeholder="e.g., ~2TB of tabular transaction history in BigQuery, and around 500GB of unstructured logs..."
            required
          />
        </div>

        {/* Current Tech Stack */}
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">
            Current Tech Stack <span className="text-error">*</span>
          </label>
          <p className="text-xs text-secondary mb-2">
            Add technology tags that your system currently uses (e.g., Python, NestJS, AWS, Kafka).
          </p>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={state.techStackInput}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'techStackInput', value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTechStack();
                }
              }}
              className="flex-1 h-[42px] px-3 border border-secondary/20 hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary-bg rounded text-sm text-primary bg-surface outline-none transition-all"
              placeholder="e.g., Python, NestJS, Docker, AWS (Press Enter or Click Add)"
            />
            <button
              type="button"
              onClick={addTechStack}
              className="h-[42px] px-4 border border-primary text-primary rounded text-sm font-medium hover:bg-primary-bg transition-all"
            >
              Add
            </button>
          </div>
          {state.techStackList.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 p-3 bg-surface-base border border-secondary/20 rounded">
              {state.techStackList.map((tag, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-tertiary/10 text-tertiary text-xs font-medium rounded-full"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTechStack(index)}
                    className="hover:text-error font-bold text-sm leading-none focus:outline-none transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Schemas */}
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">
            Schemas / Data Models <span className="text-xs font-normal text-secondary">(Optional)</span>
          </label>
          <p className="text-xs text-secondary mb-2">
            Provide schema links to help experts understand your tables and payload contracts.
          </p>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={state.schemaInput}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'schemaInput', value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSchema();
                }
              }}
              className="flex-1 h-[42px] px-3 border border-secondary/20 hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary-bg rounded text-sm text-primary bg-surface outline-none"
              placeholder="e.g., https://yourdomain.com/schemas/user-table.json"
            />
            <button
              type="button"
              onClick={addSchema}
              className="h-[42px] px-4 border border-primary text-primary rounded text-sm font-medium hover:bg-primary-bg transition-all"
            >
              Add
            </button>
          </div>
          {state.schemas.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 p-3 bg-surface-base border border-secondary/20 rounded">
              {state.schemas.map((url, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-tertiary/10 text-tertiary text-xs font-medium rounded-full"
                >
                  <span className="truncate max-w-[240px]">{url}</span>
                  <button
                    type="button"
                    onClick={() => removeSchema(index)}
                    className="hover:text-error font-bold text-sm leading-none focus:outline-none transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contracts */}
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">
            API Contracts / Specs <span className="text-xs font-normal text-secondary">(Optional)</span>
          </label>
          <p className="text-xs text-secondary mb-2">
            Provide Swagger, OpenAPI, or other endpoint schema spec URLs.
          </p>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={state.contractInput}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'contractInput', value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addContract();
                }
              }}
              className="flex-1 h-[42px] px-3 border border-secondary/20 hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary-bg rounded text-sm text-primary bg-surface outline-none"
              placeholder="e.g., https://api.yourdomain.com/v1/swagger-spec.yaml"
            />
            <button
              type="button"
              onClick={addContract}
              className="h-[42px] px-4 border border-primary text-primary rounded text-sm font-medium hover:bg-primary-bg transition-all"
            >
              Add
            </button>
          </div>
          {state.contracts.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 p-3 bg-surface-base border border-secondary/20 rounded">
              {state.contracts.map((url, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-tertiary/10 text-tertiary text-xs font-medium rounded-full"
                >
                  <span className="truncate max-w-[240px]">{url}</span>
                  <button
                    type="button"
                    onClick={() => removeContract(index)}
                    className="hover:text-error font-bold text-sm leading-none focus:outline-none transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Khung hiển thị lỗi từ hệ thống */}
        {state.error && (
          <div className="p-3.5 bg-coral-light border border-coral/20 text-coral rounded text-xs font-medium">
            {state.error}
          </div>
        )}

        {/* Nút Submit */}
        <button
          type="submit"
          disabled={state.isSubmitting || cooldown > 0}
          className="w-full h-[48px] bg-primary text-white rounded font-semibold text-sm hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {state.isSubmitting ? 'Submitting Technical Context...' : cooldown > 0 ? `Wait ${cooldown}s` : 'Submit Technical Context →'}
        </button>
      </form>
    </div>
  );
}