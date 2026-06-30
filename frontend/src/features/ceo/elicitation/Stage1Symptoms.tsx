import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Chip } from "@/components/ui/Chip";
import { Bot, Loader2, CheckCircle2 } from "lucide-react";
import type { VoidItem } from "@t/jsonb.types";
import { useFakeProgress } from "@/hooks/use-fake-progress";
import {
  submitStage1,
  handleElicitationError,
  VOID_DESCRIPTIONS,
} from "@/hooks/use-elicitation";

interface Stage1Props {
  sessionId: string;
  onComplete: (data: {
    voidListJson: VoidItem[];
    stage1SymptomsJson?: string[];
  }) => void;
  onError: (msg: string) => void;
}

export default function Stage1Symptoms({
  sessionId,
  onComplete,
  onError,
}: Stage1Props) {
  const [symptomText, setSymptomText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voidList, setVoidList] = useState<VoidItem[]>([]);
  const [acknowledgedVoids, setAcknowledgedVoids] = useState<Set<string>>(
    new Set(),
  );
  const [showResults, setShowResults] = useState(false);
  const fakeProgress = useFakeProgress(isSubmitting, 1000, 90);

  const minLength = 10; // matches backend Stage1Dto @MinLength(10)

  const handleSubmit = async () => {
    if (!symptomText.trim() || symptomText.trim().length < minLength) return;
    setIsSubmitting(true);
    setShowResults(false);

    try {
      const data = await submitStage1(sessionId, symptomText.trim());
      const voids = (data.voidListJson as VoidItem[]) ?? [];
      setVoidList(voids);
      setAcknowledgedVoids(new Set());
      setShowResults(true);
    } catch (err: any) {
      const { message } = handleElicitationError(err);
      onError(message || "AI service is busy. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAcknowledge = (voidCode: string) => {
    setAcknowledgedVoids((prev) => {
      const next = new Set(prev);
      next.has(voidCode) ? next.delete(voidCode) : next.add(voidCode);
      return next;
    });
  };

  const allHighVoidsAcknowledged = voidList
    .filter((v) => v.severity === "HIGH")
    .every((v) => acknowledgedVoids.has(v.void_code));

  // ── Loading State ──────────────────────────────────────────────

  if (isSubmitting) {
    return (
      <div className="space-y-6 py-12 text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
        <div>
          <h3 className="text-h3 font-headline text-primary">
            Analyzing your project description…
          </h3>
          <p className="mt-2 text-body-sm text-secondary">
            This usually takes 10–30 seconds. Please wait.
          </p>
        </div>
        <div className="mx-auto mt-4 h-2 w-full max-w-md overflow-hidden rounded-full bg-slate-200">
          <div className="h-2 bg-blue-600 transition-all duration-1000 ease-out" style={{ width: `${fakeProgress}%` }} />
        </div>
        <p className="text-caption text-secondary">
          AI is extracting symptoms, detecting gaps…
        </p>
      </div>
    );
  }

  // ── Results Screen (voids displayed) ───────────────────────────

  if (showResults && voidList.length > 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-h2 font-headline text-primary">Stage 1 of 5</h2>
          <p className="text-body-sm text-secondary">
            Tell us about your AI needs
          </p>
        </div>

        <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
          <p className="text-body-sm font-medium text-primary">
            We detected these potential gaps in your description:
          </p>
        </div>

        {voidList.map((v) => {
          const sev =
            v.severity === "HIGH"
              ? "error"
              : v.severity === "MEDIUM"
                ? "warning"
                : "info";
          return (
            <div
              key={v.void_code}
              className="rounded-lg border border-slate-200 bg-surface p-4"
            >
              <div className="flex items-start gap-3">
                <Chip variant={sev as "error" | "warning"}>{v.severity}</Chip>
                <div className="flex-1 text-left">
                  <p className="text-body font-semibold text-primary">
                    {v.void_code.replace(/_/g, " ")}
                  </p>
                  <p className="mt-1 text-body-sm text-secondary">
                    {VOID_DESCRIPTIONS[v.void_code] ??
                      "This area needs more detail before your project can be matched."}
                  </p>
                  <label className="mt-3 flex items-center gap-2 cursor-pointer group w-fit">
                    <input
                      type="checkbox"
                      checked={acknowledgedVoids.has(v.void_code)}
                      onChange={() => toggleAcknowledge(v.void_code)}
                      className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 transition-all cursor-pointer"
                    />
                    <span className={`text-body-sm font-medium transition-colors select-none ${
                      acknowledgedVoids.has(v.void_code)
                        ? "text-success"
                        : "text-tertiary group-hover:text-primary"
                    }`}>
                      I understand
                    </span>
                  </label>
                </div>
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-between pt-4">
          <span className="text-caption text-secondary" />
          <Button
            variant="primary"
            disabled={!allHighVoidsAcknowledged}
            onClick={() =>
              onComplete({
                voidListJson: voidList,
                stage1SymptomsJson: [symptomText],
              })
            }
          >
            Continue to Stage 2 →
          </Button>
        </div>
      </div>
    );
  }

  // ── Input Screen ───────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-h2 font-headline text-primary">Stage 1 of 5</h2>
        <p className="text-body-sm text-secondary">
          Tell us about your AI needs
        </p>
      </div>

      <div className="rounded-lg bg-primary-bg p-4">
        <p className="text-body font-medium text-primary flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" /> What problem are you trying to solve with AI?
        </p>
        <p className="mt-1 text-body-sm text-secondary">
          Write a detailed description of your project. Include what the
          current process looks like, what you want AI to help with, and any
          constraints or requirements.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Project Description</Label>
        <textarea
          value={symptomText}
          onChange={(e) => setSymptomText(e.target.value)}
          placeholder="We have a recommendation engine that currently uses rule-based filtering. We process about 10,000 items per day and want to switch to AI-powered ranking…"
          rows={8}
          disabled={isSubmitting}
          className="w-full rounded-lg border border-slate-200 bg-surface px-4 py-3 text-body text-primary placeholder:text-secondary transition-shadow hover:border-primary focus:border-2 focus:border-primary focus:ring-[3px] focus:ring-primary/10 focus:outline-none disabled:cursor-not-allowed disabled:bg-primary-bg disabled:opacity-50"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-caption text-secondary">
          {symptomText.trim().length < minLength
            ? `Min ${minLength} characters required`
            : `${symptomText.trim().length} characters`}
        </span>
        <Button
          variant="primary"
          disabled={isSubmitting || symptomText.trim().length < minLength}
          onClick={handleSubmit}
        >
          Analyze my project →
        </Button>
      </div>
    </div>
  );
}
