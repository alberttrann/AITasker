import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { PartyPopper, Folder, Calendar, CheckCircle2, ArrowRight } from 'lucide-react';
import { useProject } from "@/hooks/use-projects";

interface QualityGatePassedProps {
  projectId: string;
  onStartNew: () => void;
}

export default function QualityGatePassed({
  projectId,
  onStartNew,
}: QualityGatePassedProps) {
  const navigate = useNavigate();
  const { project, isLoading } = useProject(projectId);


  return (
    <div className="space-y-10 max-w-2xl mx-auto py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center">
        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-400/20 to-emerald-500/10 text-emerald-600 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-emerald-500/10">
          <PartyPopper className="w-10 h-10" />
        </div>
        <h2 className="text-4xl font-headline font-bold text-slate-900 mb-4 tracking-tight">
          Your Project is Live!
        </h2>
        <p className="text-lg text-slate-500 max-w-md mx-auto leading-relaxed">
          AI experts are now being matched to your project. You'll be notified the moment bids start arriving.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Status</p>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="font-semibold text-slate-900">Verified & Passed</span>
            </div>
          </div>
          <div className="sm:text-right mt-2 sm:mt-0">
            <Button 
              variant="link" 
              className="text-primary p-0 h-auto font-medium group" 
              onClick={() => navigate(`/ceo/projects/${projectId}`)}
            >
              View Project Detail
              <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3 text-slate-600">
              <div className="p-2 rounded-lg bg-slate-100 text-slate-500">
                <Folder className="w-4 h-4" />
              </div>
              <span className="font-medium">Project Name</span>
            </div>
            {isLoading ? (
              <span className="text-sm font-medium text-slate-400 animate-pulse bg-slate-100 px-3 py-1.5 rounded-lg">Loading...</span>
            ) : (
              <span className="text-sm font-medium text-slate-900">
                {project?.projectName || "Unnamed Project"}
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3 text-slate-600">
              <div className="p-2 rounded-lg bg-slate-100 text-slate-500">
                <Calendar className="w-4 h-4" />
              </div>
              <span className="font-medium">Published Date</span>
            </div>
            <span className="font-medium text-slate-900">
              {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>


        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
        <Button
          variant="primary"
          size="lg"
          className="w-full sm:w-auto font-semibold px-8 py-6 text-base"
          onClick={() => navigate(`/ceo/projects/shortlist/${projectId}`)}
        >
          View Matched Experts
        </Button>
        <Button 
          variant="outline" 
          size="lg"
          className="w-full sm:w-auto font-semibold px-8 py-6 text-base border-2"
          onClick={onStartNew}
        >
          Start New Project
        </Button>
      </div>
    </div>
  );
}
