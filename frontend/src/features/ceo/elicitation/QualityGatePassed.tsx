import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/Card";
import { ARCHETYPE_LABELS } from "@/hooks/use-elicitation";
import { PartyPopper, Clipboard, Calendar, Tag } from 'lucide-react';

interface QualityGatePassedProps {
  projectId: string;
  completenessScore: number;
  archetype: string;
  onStartNew: () => void;
}

export default function QualityGatePassed({
  projectId,
  completenessScore,
  archetype,
  onStartNew,
}: QualityGatePassedProps) {
  const navigate = useNavigate();
  const pct = Math.round(completenessScore * 100);

  return (
    <Card elevated>
      <CardContent className="space-y-8 pt-6 text-center">
        <div className="flex justify-center"><PartyPopper className="w-16 h-16 text-success" /></div>
        <div>
          <h2 className="text-h2 font-headline text-primary">
            Your Project Has Been Published!
          </h2>
          <p className="mt-2 text-body text-secondary">
            AI experts are now being matched to your project. You'll be notified
            when bids start arriving.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-body-sm font-medium text-success">
            Status: Verified & Passed
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-primary-bg p-4 text-left">
          <div className="space-y-2">
            <p className="text-body-sm">
              <span className="font-medium text-primary"><Clipboard className="w-4 h-4 mr-1 inline" /> Project ID: </span>
              <span className="text-secondary font-mono text-caption">
                {projectId}
              </span>
            </p>
            <p className="text-body-sm">
              <span className="font-medium text-primary"><Calendar className="w-4 h-4 mr-1 inline" /> Published: </span>
              <span className="text-secondary">
                {new Date().toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </p>
            <p className="text-body-sm">
              <span className="font-medium text-primary"><Tag className="w-4 h-4 mr-1 inline" /> Archetype: </span>
              <span className="text-secondary">
                {ARCHETYPE_LABELS[archetype] ?? archetype}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="primary"
            onClick={() => navigate(`/ceo/shortlist/${projectId}`)}
          >
            View Matched Experts
          </Button>
          <Button variant="secondary" onClick={onStartNew}>
            Start New Project
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
