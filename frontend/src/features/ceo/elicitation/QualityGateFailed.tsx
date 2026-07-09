import { useState } from 'react';
import { Button } from "@/components/ui/Button";
import { AlertTriangle, AlertCircle, RefreshCcw, Users, Clock } from 'lucide-react';
import { ConfirmModal } from "@/components/ui/Modal";

interface QualityGateFailedProps {
  advisoryNote: string;
  flaggedVoid: string | null;
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
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // If returnToStage is 5 and there is no flagged void, this means the project 
  // passed all completeness checks but there are no experts matching the profile.
  const isNoExperts = returnToStage === 5 && !flaggedVoid;

  const MainIcon = isNoExperts ? Users : AlertTriangle;
  const StatusIcon = isNoExperts ? Clock : AlertCircle;
  const ItemIcon = isNoExperts ? Users : AlertTriangle;

  const title = isNoExperts ? "Experts Unavailable" : "Your Project Needs More Detail";
  const subtitle = isNoExperts 
    ? "Your project specification is excellent, but we couldn't find available experts for this exact tech stack right now."
    : "Your project specification is incomplete and requires more technical context before we can match it with experts.";
  const statusLabel = isNoExperts ? "Waitlisted" : "Missing Technical Context";

  return (
    <div className="space-y-10 max-w-2xl mx-auto py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center">
        <div className={`mx-auto w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-sm border ${
          isNoExperts 
            ? "bg-gradient-to-br from-amber-400/20 to-amber-500/10 text-amber-600 border-amber-500/10" 
            : "bg-gradient-to-br from-red-400/20 to-red-500/10 text-red-600 border-red-500/10"
        }`}>
          <MainIcon className="w-10 h-10" />
        </div>
        <h2 className="text-4xl font-headline font-bold text-slate-900 mb-4 tracking-tight">
          {title}
        </h2>
        <p className="text-lg text-slate-500 max-w-md mx-auto leading-relaxed">
          {subtitle}
        </p>
      </div>

      <div className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${
        isNoExperts ? "border-amber-200" : "border-red-200"
      }`}>
        <div className={`border-b p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          isNoExperts ? "bg-amber-50 border-amber-100" : "bg-red-50 border-red-100"
        }`}>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
              isNoExperts ? "text-amber-500" : "text-red-400"
            }`}>Status</p>
            <div className="flex items-center gap-2">
              <StatusIcon className={`w-5 h-5 ${isNoExperts ? "text-amber-500" : "text-red-500"}`} />
              <span className={`font-semibold ${isNoExperts ? "text-amber-900" : "text-red-900"}`}>{statusLabel}</span>
            </div>
          </div>
        </div>

        <div className={`p-6 space-y-4 ${isNoExperts ? "bg-amber-50/30" : "bg-red-50/30"}`}>
          <div className={`flex items-start gap-3 ${isNoExperts ? "text-amber-800" : "text-red-800"}`}>
            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
              isNoExperts ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"
            }`}>
              <ItemIcon className="w-4 h-4" />
            </div>
            <div>
              {flaggedVoid && !isNoExperts && (
                <h4 className={`font-semibold mb-1 ${isNoExperts ? "text-amber-900" : "text-red-900"}`}>
                  {flaggedVoid.replace(/_/g, " ")}
                </h4>
              )}
              <p className={`text-sm font-medium leading-relaxed ${
                isNoExperts ? "text-amber-800" : "text-red-700/80"
              }`}>
                {advisoryNote}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
        {/* If it's the No Experts case, returning to Stage 5 doesn't make sense since Stage 5 is Synthesis. 
            So we let them return to Stage 4 to adjust their scope. */}
        <Button
          variant="primary"
          size="lg"
          className={`w-full sm:w-auto font-semibold px-8 py-6 text-base text-white ${
            isNoExperts ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700"
          }`}
          onClick={() => onReturnToStage(isNoExperts ? 1 : (returnToStage || 1))}
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          {isNoExperts ? "Adjust Scope (Return to Stage 1)" : `Return to Stage ${returnToStage || 1}`}
        </Button>
        <Button 
          variant="outline" 
          size="lg"
          className="w-full sm:w-auto font-semibold px-8 py-6 text-base border-2 text-slate-600 hover:bg-slate-100"
          onClick={() => setIsConfirmOpen(true)}
        >
          Start Over
        </Button>
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          setIsConfirmOpen(false);
          onStartOver();
        }}
        title="Start Over"
        confirmText="Yes, Start Over"
        cancelText="Cancel"
      >
        Are you sure you want to discard this project specification and start over from the beginning?
      </ConfirmModal>
    </div>
  );
}
