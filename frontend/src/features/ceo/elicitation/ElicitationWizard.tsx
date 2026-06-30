import { useReducer, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/Modal";
import type { VoidItem } from "@t/jsonb.types";
import {
  createSession,
  getSession,
  getActiveSession,
  handleElicitationError,
  STAGE_LABELS,
  type GateResult,
  type StageCompleteData,
} from "@/hooks/use-elicitation";
import { Loader2, Check } from "lucide-react";

// Child stage components
import Stage1Symptoms from "./Stage1Symptoms";
import Stage2Archetype from "./Stage2Archetype";
import Stage3Probes from "./Stage3Probes";
import Stage4ScenarioA from "./Stage4ScenarioA";
import Stage4ScenarioB from "./Stage4ScenarioB";
import Stage5Loading from "./Stage5Loading";
import QualityGatePassed from "./QualityGatePassed";
import QualityGateFailed from "./QualityGateFailed";

type WizardState = {
  sessionId: string | null;
  currentStage: number;
  sessionState: string;
  voidList: VoidItem[];
  archetype: string | null;
  gateResult: GateResult | null;
  error: string | null;
  isLoading: boolean;
  forceScenarioA: boolean;
  isCancelModalOpen: boolean;
};

type WizardAction =
  | { type: "INIT_SUCCESS"; payload: Partial<WizardState> }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "STAGE_COMPLETE"; payload: StageCompleteData }
  | { type: "SYNTHESIS_RESOLVED"; payload: GateResult }
  | { type: "TECH_TEAM_SUBMITTED" }
  | { type: "RETURN_TO_STAGE"; payload: number }
  | { type: "BACK" }
  | { type: "START_OVER_START" }
  | { type: "START_OVER_SUCCESS"; payload: { sessionId: string } }
  | { type: "SET_FORCE_SCENARIO_A"; payload: boolean }
  | { type: "SET_CANCEL_MODAL_OPEN"; payload: boolean };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "INIT_SUCCESS":
      return { ...state, ...action.payload, isLoading: false };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "STAGE_COMPLETE":
      const { voidListJson, archetype, gateResult } = action.payload;
      return {
        ...state,
        error: null,
        voidList: voidListJson || state.voidList,
        archetype: archetype || state.archetype,
        gateResult: gateResult || state.gateResult,
        currentStage: gateResult ? (gateResult.gate_passed ? 5 : state.currentStage) : state.currentStage + 1,
        sessionState: gateResult && !gateResult.gate_passed ? "RETURNED" : state.sessionState,
      };
    case "SYNTHESIS_RESOLVED":
      return {
        ...state,
        gateResult: action.payload,
        sessionState: action.payload.gate_passed ? "COMPLETED" : "RETURNED",
      };
    case "TECH_TEAM_SUBMITTED":
      return { ...state, error: null, currentStage: 5 };
    case "RETURN_TO_STAGE":
      return { ...state, currentStage: action.payload, gateResult: null, sessionState: "IN_PROGRESS" };
    case "BACK":
      return { ...state, currentStage: Math.max(1, state.currentStage - 1), error: null };
    case "START_OVER_START":
      return { ...state, isLoading: true, error: null, gateResult: null };
    case "START_OVER_SUCCESS":
      return {
        ...state,
        isLoading: false,
        sessionId: action.payload.sessionId,
        currentStage: 1,
        sessionState: "IN_PROGRESS",
        voidList: [],
        archetype: null,
      };
    case "SET_FORCE_SCENARIO_A":
      return { ...state, forceScenarioA: action.payload };
    case "SET_CANCEL_MODAL_OPEN":
      return { ...state, isCancelModalOpen: action.payload };
    default:
      return state;
  }
}

export default function ElicitationWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [state, dispatch] = useReducer(wizardReducer, {
    sessionId: null,
    currentStage: 1,
    sessionState: "IN_PROGRESS",
    voidList: [],
    archetype: null,
    gateResult: null,
    error: null,
    isLoading: true,
    forceScenarioA: false,
    isCancelModalOpen: false,
  });

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        let data;
        try {
          data = await getActiveSession();
        } catch {
          data = null;
        }

        if (!data || !data.id) {
          data = await createSession();
        }

        if (cancelled) return;

        let initGateResult = null;
        let finalSessionState = data.state ?? "IN_PROGRESS";

        if (data.state === "COMPLETED" || data.state === "RETURNED") {
          try {
            const full = await getSession(data.id);
            if (!cancelled && full) {
              finalSessionState = full.state ?? data.state;
              if (full.state === "COMPLETED") {
                initGateResult = {
                  gate_passed: true,
                  completeness_score: full.completeness_score ?? full.completenessScore ?? 0,
                  project_id: full.project_id ?? full.projectId ?? "",
                };
              }
            }
          } catch {
            /* use what we have */
          }
        }

        if (cancelled) return;

        dispatch({
          type: "INIT_SUCCESS",
          payload: {
            sessionId: data.id,
            currentStage: data.currentStage ?? 1,
            sessionState: finalSessionState,
            voidList: data.currentStage > 1 ? ((data.voidListJson as VoidItem[]) ?? []) : [],
            archetype: data.currentStage > 1 ? (data.archetype ?? null) : null,
            gateResult: initGateResult as GateResult | null,
          }
        });

      } catch (err: any) {
        if (cancelled) return;
        const { message, isSubscriptionError } = handleElicitationError(err);
        if (isSubscriptionError) {
          navigate("/ceo/subscription", { replace: true });
          return;
        }
        dispatch({ type: "SET_ERROR", payload: message });
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleStageComplete = (data: StageCompleteData) => dispatch({ type: "STAGE_COMPLETE", payload: data });
  const handleSynthesisResolved = (result: GateResult) => {
    dispatch({ type: "SYNTHESIS_RESOLVED", payload: result });
  };
  const handleTechTeamSubmitted = () => dispatch({ type: "TECH_TEAM_SUBMITTED" });
  const handleReturnToStage = (stage: number) => dispatch({ type: "RETURN_TO_STAGE", payload: stage });
  const handleBack = () => dispatch({ type: "BACK" });

  const handleStartOver = async () => {
    dispatch({ type: "START_OVER_START" });
    try {
      if (state.sessionId) {
        await apiClient.put(`/elicitation/sessions/${state.sessionId}/abandon`);
      }
      const data = await createSession();
      dispatch({ type: "START_OVER_SUCCESS", payload: { sessionId: data.id } });
    } catch (err: any) {
      dispatch({ type: "SET_ERROR", payload: handleElicitationError(err).message });
    }
  };

  /*

  const handleStartOver = async () => {
      setIsLoading(true);
      setError(null);
      setGateResult(null);
      try {
        // 1. ABANDON session cu trong db
        if (sessionId) {
          await abandonSession(sessionId);
          localStorage.removeItem("currentSessionId");
        }
        
        // 2. createSession dua cai móws
        const data = await createSession();
        setSessionId(data.id);
        localStorage.setItem("currentSessionId", data.id);
        
        setCurrentStage(data.currentStage ?? 1);
        setSessionState("IN_PROGRESS");
        setVoidList([]);
        setArchetype(null);
      } catch (err: any) {
        setError(handleElicitationError(err).message);
      } finally {
        setIsLoading(false);
      }
    };
  */

  const handleCancelSession = () => dispatch({ type: "SET_CANCEL_MODAL_OPEN", payload: true });

  const confirmCancelSession = () => {
    navigate("/ceo/projects");
  };

  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="text-body text-secondary">
            Preparing your elicitation session…
          </p>
        </div>
      </div>
    );
  }

  if (!state.sessionId) {
    return (
      <div className="flex items-center justify-center py-24">
        <Card className="max-w-md text-center">
          <CardContent className="space-y-4 pt-6">
            <p className="text-body-lg font-headline text-error">
              Something went wrong
            </p>
            <p className="text-body-sm text-secondary">
              {state.error || "Could not start elicitation session."}
            </p>
            <Button variant="primary" onClick={handleStartOver}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.sessionState === "COMPLETED" && state.gateResult?.gate_passed) {
    return (
      <div className="mx-auto max-w-6xl py-8">
        <QualityGatePassed
          projectId={state.gateResult.project_id}
          completenessScore={state.gateResult.completeness_score}
          archetype={state.archetype ?? ""}
          onStartNew={handleStartOver}
        />
      </div>
    );
  }

  if (state.sessionState === "RETURNED" && state.gateResult && !state.gateResult.gate_passed) {
    return (
      <div className="mx-auto max-w-6xl py-8">
        <QualityGateFailed
          completenessScore={state.gateResult.completeness_score}
          advisoryNote={state.gateResult.advisory_note}
          flaggedVoid={state.gateResult.flagged_void ?? ""}
          returnToStage={state.gateResult.return_to_stage}
          onReturnToStage={handleReturnToStage}
          onStartOver={handleStartOver}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl relative pt-4">
      <div className="absolute top-0 right-0 z-10">
        <Button variant="ghost" size="sm" onClick={handleCancelSession} className="text-slate-500 hover:text-slate-700 hover:bg-slate-50">
          Exit Session
        </Button>
      </div>
      <div className="mb-10 mt-8">
        <div className="flex items-center justify-center gap-0">
          {STAGE_LABELS.map((label, i) => {
            const stageNum = i + 1;
            const isActive = state.currentStage === stageNum;
            const isCompleted = state.currentStage > stageNum;

            return (
              <div key={stageNum} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                      isActive
                        ? "bg-primary text-white shadow-sm"
                        : isCompleted
                          ? "bg-success text-white"
                          : "bg-primary-bg text-secondary"
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : stageNum}
                  </div>
                  <span
                    className={`mt-1.5 text-caption whitespace-nowrap ${isActive ? "text-primary font-semibold" : "text-secondary"}`}
                  >
                    {label}
                  </span>
                </div>
                {stageNum < 5 && (
                  <div
                    className={`mx-1 mb-5 h-0.5 w-8 sm:w-12 transition-colors ${isCompleted ? "bg-success" : "bg-slate-200"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {state.error && (
        <div className="mb-6 rounded-lg border border-error/20 bg-error/5 px-4 py-3">
          <p className="text-body-sm text-error">{state.error}</p>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {state.currentStage === 1 && state.sessionId && (
            <Stage1Symptoms
              sessionId={state.sessionId}
              onComplete={handleStageComplete}
              onError={(msg) => dispatch({ type: "SET_ERROR", payload: msg })}
            />
          )}
          {state.currentStage === 2 && state.sessionId && (
            <Stage2Archetype
              sessionId={state.sessionId}
              voidList={state.voidList}
              onComplete={handleStageComplete}
              onError={(msg) => dispatch({ type: "SET_ERROR", payload: msg })}
              onBack={handleBack}
            />
          )}
          {state.currentStage === 3 && state.sessionId && state.archetype && (
            <Stage3Probes
              sessionId={state.sessionId}
              archetype={state.archetype}
              onComplete={handleStageComplete}
              onError={(msg) => dispatch({ type: "SET_ERROR", payload: msg })}
              onBack={handleBack}
            />
          )}
          {state.currentStage === 4 &&
            state.sessionId &&
            (user?.self_technical || state.forceScenarioA ? (
              <Stage4ScenarioA
                sessionId={state.sessionId}
                onComplete={handleStageComplete}
                onError={(msg) => dispatch({ type: "SET_ERROR", payload: msg })}
                onBack={state.forceScenarioA ? () => dispatch({ type: "SET_FORCE_SCENARIO_A", payload: false }) : handleBack}
              />
            ) : (
              <Stage4ScenarioB
                sessionId={state.sessionId}
                onTechTeamSubmitted={handleTechTeamSubmitted}
                onFillInMyself={() => dispatch({ type: "SET_FORCE_SCENARIO_A", payload: true })}
                onBack={handleBack}
              />
            ))}
          {state.currentStage === 5 && state.sessionId && (
            <Stage5Loading
              sessionId={state.sessionId}
              initialGateResult={state.gateResult}
              onComplete={handleSynthesisResolved}
              onError={(msg) => dispatch({ type: "SET_ERROR", payload: msg })}
            />
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        isOpen={state.isCancelModalOpen}
        onClose={() => dispatch({ type: "SET_CANCEL_MODAL_OPEN", payload: false })}
        onConfirm={confirmCancelSession}
        title="Exit Session"
        confirmText="Exit Session"
        cancelText="Cancel"
      >
        Are you sure you want to exit? Your progress will be saved as a draft and you can continue later.
      </ConfirmModal>
    </div>
  );
}
