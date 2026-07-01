import { Button } from "@/components/ui/button";
import { AlertTriangle, AlertCircle, RefreshCcw } from 'lucide-react';

interface QualityGateFailedProps {
  advisoryNote: string;
  flaggedVoid: string;
  returnToStage: number;
  onReturnToStage: (stage: number) => void;
  onStartOver: () => void;
}

export default function QualityGateFailed({
  advisoryNote,
  flaggedVoid,
  returnToStage,
  onReturnToStage,
  onStartOver,
}: QualityGateFailedProps) {

  return (
    <div className="space-y-10 max-w-2xl mx-auto py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center">
        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-red-400/20 to-red-500/10 text-red-600 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-red-500/10">
          <AlertTriangle className="w-10 h-10" />
        </div>
        <h2 className="text-4xl font-headline font-bold text-slate-900 mb-4 tracking-tight">
          Your Project Needs More Detail
        </h2>
        <p className="text-lg text-slate-500 max-w-md mx-auto leading-relaxed">
          Your project specification is incomplete and requires more technical context before we can match it with experts.
        </p>
      </div>

      <div className="rounded-2xl border border-red-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-red-50 border-b border-red-100 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-1">Status</p>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="font-semibold text-red-900">Missing Technical Context</span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4 bg-red-50/30">
          <div className="flex items-start gap-3 text-red-800">
            <div className="p-2 rounded-lg bg-red-100 text-red-600 shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              {flaggedVoid && (
                <h4 className="font-semibold text-red-900 mb-1">
                  {flaggedVoid.replace(/_/g, " ")}
                </h4>
              )}
              <p className="text-sm font-medium text-red-700/80 leading-relaxed">
                {advisoryNote}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
        <Button
          variant="primary"
          size="lg"
          className="w-full sm:w-auto font-semibold px-8 py-6 text-base bg-red-600 hover:bg-red-700 text-white"
          onClick={() => onReturnToStage(returnToStage || 1)}
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          Return to Stage {returnToStage || 1}
        </Button>
        <Button 
          variant="outline" 
          size="lg"
          className="w-full sm:w-auto font-semibold px-8 py-6 text-base border-2 text-slate-600 hover:bg-slate-100"
          onClick={onStartOver}
        >
          Start Over
        </Button>
      </div>
    </div>
  );
}
