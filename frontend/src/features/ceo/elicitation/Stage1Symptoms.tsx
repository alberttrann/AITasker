import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { Bot, Loader2, CheckCircle2 } from "lucide-react";
import type { VoidItem } from "@t/jsonb.types";
import { useFakeProgress } from "@/hooks/use-fake-progress";
import {
  submitStage1,
  handleElicitationError,
  VOID_DESCRIPTIONS,
  useElicitation,
  saveDraft,
} from "@/hooks/use-elicitation";
import { useQueryClient } from "@tanstack/react-query";

interface Stage1Props {
  sessionId: string;
  symptomTextDraft?: string | null;
  onComplete: (data: {
    voidListJson: VoidItem[];
    symptomText?: string;
  }) => void;
  onError: (msg: string) => void;
}

export default function Stage1Symptoms({
  sessionId,
  symptomTextDraft,
  onComplete,
  onError,
}: Stage1Props) {
  const queryClient = useQueryClient();
  const { session } = useElicitation(sessionId);
  const [symptomText, setSymptomText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  useEffect(() => {
    if (!initialized) {
      const local = localStorage.getItem(`stage1_${sessionId}`);
      if (local) {
        setSymptomText(local);
        setInitialized(true);
      } else if (symptomTextDraft) {
        setSymptomText(symptomTextDraft);
        setInitialized(true);
      } else if (session) {
        if (session.symptomTextDraft) {
          setSymptomText(session.symptomTextDraft);
        }
        setInitialized(true);
      }
    }
  }, [session, symptomTextDraft, sessionId, initialized]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setSymptomText(value);
    localStorage.setItem(`stage1_${sessionId}`, value);
    setIsTyping(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await saveDraft(sessionId, value);
        setLastSavedAt(new Date());
        setIsTyping(false);
      } catch {
        /* silent */
      }
    }, 2000);
  };

  const handleBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    saveDraft(sessionId, symptomText)
      .then(() => {
        setLastSavedAt(new Date());
        setIsTyping(false);
      })
      .catch(() => {});
  };
  const [voidList, setVoidList] = useState<VoidItem[]>([]);
  const [acknowledgedVoids, setAcknowledgedVoids] = useState<Set<string>>(
    new Set(),
  );
  const [showResults, setShowResults] = useState(false);
  const fakeProgress = useFakeProgress(isSubmitting, 1000, 90);

  const minLength = 10; // matches backend Stage1Dto @MinLength(10)

  const handleSubmit = async () => {
    if (!symptomText.trim() || symptomText.trim().length < minLength) return;

    // Force an immediate save of the final text, cancelling any pending debounces
    if (debounceRef.current) clearTimeout(debounceRef.current);
    saveDraft(sessionId, symptomText.trim()).catch(() => {});

    setIsSubmitting(true);
    setShowResults(false);

    try {
      const data = await submitStage1(sessionId, symptomText.trim());
      await queryClient.invalidateQueries({ queryKey: ["elicitation", "session", sessionId] });
      
      const voids = (data.voidListJson as VoidItem[]) ?? [];

      if (voids.length === 0) {
        // AI found no specific gaps, automatically proceed to Stage 2
        localStorage.removeItem(`stage1_${sessionId}`);
        onComplete({
          voidListJson: [],
          symptomText: symptomText.trim(),
        });
      } else {
        // Do NOT clear localStorage yet; they are still on Stage 1 (Results Screen)
        setVoidList(voids);
        setAcknowledgedVoids(new Set());
        setShowResults(true);
      }
    } catch (err: any) {
      const { message } = handleElicitationError(err);
      onError(message || "AI service is busy. Please try again.");
      setCooldown(10);
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
          <div
            className="h-2 bg-blue-600 transition-all duration-1000 ease-out"
            style={{ width: `${fakeProgress}%` }}
          />
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
        <div className="text-center mb-6">
          <h2 className="text-h2 font-headline text-primary">Stage 1 of 5</h2>
          <p className="mt-2 text-body text-secondary max-w-md mx-auto">
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
              <div className="flex items-center gap-4">
                <div className="w-24 shrink-0 flex justify-center">
                  <Chip
                    variant={sev as "error" | "warning"}
                    className="text-sm px-4 py-1.5"
                  >
                    {v.severity}
                  </Chip>
                </div>
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
                    <span
                      className={`text-body-sm font-medium transition-colors select-none ${
                        acknowledgedVoids.has(v.void_code)
                          ? "text-success"
                          : "text-tertiary group-hover:text-primary"
                      }`}
                    >
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
            onClick={() => {
              localStorage.removeItem(`stage1_${sessionId}`);
              onComplete({
                voidListJson: voidList,
                symptomText: symptomText,
              });
            }}
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
      <div className="text-center mb-6">
        <h2 className="text-h2 font-headline text-primary">Stage 1 of 5</h2>
        <p className="mt-2 text-body text-secondary max-w-md mx-auto">
          Tell us about your AI needs
        </p>
      </div>

      <div className="rounded-lg bg-primary-bg p-4">
        <p className="text-body font-medium text-primary flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" /> What problem are you trying
          to solve with AI?
        </p>
        <p className="mt-1 text-body-sm text-secondary">
          Write a detailed description of your project. Include what the current
          process looks like, what you want AI to help with, and any constraints
          or requirements.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Project Description</Label>
        <textarea
          value={symptomText}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="We have a recommendation engine that currently uses rule-based filtering. We process about 10,000 items per day and want to switch to AI-powered ranking…"
          rows={8}
          disabled={isSubmitting}
          className="w-full rounded-lg border border-slate-200 bg-surface px-4 py-3 text-body text-primary placeholder:text-secondary transition-shadow hover:border-primary focus:border-2 focus:border-primary focus:ring-[3px] focus:ring-primary/10 focus:outline-none disabled:cursor-not-allowed disabled:bg-primary-bg disabled:opacity-50"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-caption text-secondary flex items-center gap-2">
          {symptomText.trim().length < minLength
            ? `Min ${minLength} characters required`
            : `${symptomText.trim().length} characters`}
          {isTyping ? (
            <span className="text-slate-400 font-medium italic">Saving...</span>
          ) : lastSavedAt ? (
            <span className="text-success font-medium">✓ Draft saved</span>
          ) : null}
        </span>
        <Button
          variant="primary"
          disabled={isSubmitting || symptomText.trim().length < minLength || cooldown > 0}
          onClick={handleSubmit}
        >
          {cooldown > 0 ? `Wait ${cooldown}s` : "Analyze my project →"}
        </Button>
      </div>
    </div>
  );
}
