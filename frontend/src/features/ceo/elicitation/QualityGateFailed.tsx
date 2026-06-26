import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/Card";

interface QualityGateFailedProps {
  completenessScore: number;
  advisoryNote: string;
  flaggedVoid: string;
  returnToStage: number;
  onReturnToStage: (stage: number) => void;
  onStartOver: () => void;
}

export default function QualityGateFailed({
  completenessScore,
  advisoryNote,
  flaggedVoid,
  returnToStage,
  onReturnToStage,
  onStartOver,
}: QualityGateFailedProps) {
  const pct = Math.round(completenessScore * 100);

  return (
    <Card elevated>
      <CardContent className="space-y-8 pt-6 text-center">
        {/* Warning */}
        <div className="text-5xl">⚠️</div>

        <div>
          <h2 className="text-h2 font-headline text-primary">
            Your Project Needs More Detail
          </h2>
          <p className="mt-2 text-body text-secondary">
            Your project specification is incomplete and requires more technical context.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-body-sm font-medium text-error">
            Status: Missing Technical Context
          </p>
        </div>

        {/* Advisory */}
        <div className="rounded-lg border border-error/20 bg-error/5 p-4 text-left">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 text-error">⚠️</span>
            <div>
              {flaggedVoid && (
                <p className="text-body-sm font-semibold text-error">
                  {flaggedVoid.replace(/_/g, " ")}
                </p>
              )}
              <p className="mt-1 text-body-sm text-secondary">{advisoryNote}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            onClick={() => onReturnToStage(returnToStage)}
          >
            Go Back to Stage {returnToStage}
          </Button>
          <Button variant="ghost" onClick={onStartOver}>
            Start Over
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
