import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/Card";
import type { VoidItem } from "@t/jsonb.types";
import {
  createSession,
  getSession,
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

export default function ElicitationWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState(1);
  const [sessionState, setSessionState] = useState<string>("IN_PROGRESS");
  const [voidList, setVoidList] = useState<VoidItem[]>([]);
  const [archetype, setArchetype] = useState<string | null>(null);
  const [gateResult, setGateResult] = useState<GateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [forceScenarioA, setForceScenarioA] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const storedId = localStorage.getItem("currentSessionId");
        let data;

        if (storedId) {
          try {
            data = await getSession(storedId);
          } catch {
            data = await createSession();
          }
        } else {
          data = await createSession();
        }

        if (cancelled) return;

        localStorage.setItem("currentSessionId", data.id);

        setSessionId(data.id);
        setCurrentStage(data.currentStage ?? 1);
        setSessionState(data.state ?? "IN_PROGRESS");

        if (data.currentStage > 1) {
          setVoidList((data.voidListJson as VoidItem[]) ?? []);
          setArchetype(data.archetype ?? null);
        }

        if (data.state === "COMPLETED" || data.state === "RETURNED") {
          try {
            const full = await getSession(data.id);
            if (!cancelled && full) {
              setSessionState(full.state ?? data.state);
              if (full.state === "COMPLETED") {
                setGateResult({
                  gate_passed: true,
                  completeness_score: full.completeness_score ?? full.completenessScore ?? 0,
                  project_id: full.project_id ?? full.projectId ?? "",
                });
              }
            }
          } catch {
            /* use what we have */
          }
        }
      } catch (err: any) {
        if (cancelled) return;
        const { message, isSubscriptionError } = handleElicitationError(err);
        if (isSubscriptionError) {
          navigate("/ceo/subscription", { replace: true });
          return;
        }
        setError(message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleStageComplete = (data: StageCompleteData) => {
    setError(null);
    if (data.voidListJson) setVoidList(data.voidListJson);
    if (data.archetype) setArchetype(data.archetype);

    if (data.gateResult) {
      setGateResult(data.gateResult);
      if (data.gateResult.gate_passed) setCurrentStage(5);
      else setSessionState("RETURNED");
      return;
    }
    setCurrentStage((prev) => prev + 1);
  };

  const handleSynthesisResolved = (result: GateResult) => {
    setGateResult(result);
    setSessionState(result.gate_passed ? "COMPLETED" : "RETURNED");
  };

  const handleTechTeamSubmitted = () => {
    setError(null);
    setCurrentStage(5);
  };

  const handleReturnToStage = (stage: number) => {
    setCurrentStage(stage);
    setGateResult(null);
    setSessionState("IN_PROGRESS");
  };

  const handleStartOver = async () => {
    setIsLoading(true);
    setError(null);
    setGateResult(null);
    try {
      const data = await createSession();
      setSessionId(data.id);
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

  if (isLoading) {
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

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center py-24">
        <Card className="max-w-md text-center">
          <CardContent className="space-y-4 pt-6">
            <p className="text-body-lg font-headline text-error">
              Something went wrong
            </p>
            <p className="text-body-sm text-secondary">
              {error || "Could not start elicitation session."}
            </p>
            <Button variant="primary" onClick={handleStartOver}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sessionState === "COMPLETED" && gateResult?.gate_passed) {
    return (
      <div className="mx-auto max-w-6xl py-8">
        <QualityGatePassed
          projectId={gateResult.project_id}
          completenessScore={gateResult.completeness_score}
          archetype={archetype ?? ""}
          onStartNew={handleStartOver}
        />
      </div>
    );
  }

  if (sessionState === "RETURNED" && gateResult && !gateResult.gate_passed) {
    return (
      <div className="mx-auto max-w-6xl py-8">
        <QualityGateFailed
          completenessScore={gateResult.completeness_score}
          advisoryNote={gateResult.advisory_note}
          flaggedVoid={gateResult.flagged_void ?? ""}
          returnToStage={gateResult.return_to_stage}
          onReturnToStage={handleReturnToStage}
          onStartOver={handleStartOver}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-10">
        <div className="flex items-center justify-center gap-0">
          {STAGE_LABELS.map((label, i) => {
            const stageNum = i + 1;
            const isActive = currentStage === stageNum;
            const isCompleted = currentStage > stageNum;

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

      {error && (
        <div className="mb-6 rounded-lg border border-error/20 bg-error/5 px-4 py-3">
          <p className="text-body-sm text-error">{error}</p>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {currentStage === 1 && sessionId && (
            <Stage1Symptoms
              sessionId={sessionId}
              onComplete={handleStageComplete}
              onError={setError}
            />
          )}
          {currentStage === 2 && sessionId && (
            <Stage2Archetype
              sessionId={sessionId}
              voidList={voidList}
              onComplete={handleStageComplete}
              onError={setError}
            />
          )}
          {currentStage === 3 && sessionId && archetype && (
            <Stage3Probes
              sessionId={sessionId}
              archetype={archetype}
              onComplete={handleStageComplete}
              onError={setError}
            />
          )}
          {currentStage === 4 &&
            sessionId &&
            (user?.self_technical || forceScenarioA ? (
              <Stage4ScenarioA
                sessionId={sessionId}
                onComplete={handleStageComplete}
                onError={setError}
              />
            ) : (
              <Stage4ScenarioB
                sessionId={sessionId}
                onTechTeamSubmitted={handleTechTeamSubmitted}
                onFillInMyself={() => setForceScenarioA(true)}
              />
            ))}
          {currentStage === 5 && sessionId && (
            <Stage5Loading
              sessionId={sessionId}
              initialGateResult={gateResult}
              onComplete={handleSynthesisResolved}
              onError={setError}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
