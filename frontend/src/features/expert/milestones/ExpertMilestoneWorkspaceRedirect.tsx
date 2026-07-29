import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEngagement } from "@/hooks/use-engagements";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function ExpertMilestoneWorkspaceRedirect() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const navigate = useNavigate();
  const { data: engagement, isLoading, error, refetch } = useEngagement(engagementId);

  useEffect(() => {
    if (engagement) {
      const milestones = engagement.milestones ?? [];
      const activeMilestone = milestones.find((m: any) => m.state !== 'RELEASED' && m.state !== 'APPROVED') || milestones[0];
      if (activeMilestone) {
        navigate(`/expert/engagements/${engagementId}/milestones/${activeMilestone.id}`, { replace: true });
      }
    }
  }, [engagement, engagementId, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !engagement) {
    const errorMsg = (error as any)?.response?.data?.message || "Failed to load milestones.";
    return (
      <div className="w-full max-w-[1440px] px-6 mx-auto py-8">
        <ErrorBanner message={errorMsg} onRetry={() => refetch()} />
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="mt-4 inline-flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Go Back
        </Button>
      </div>
    );
  }

  const milestones = engagement.milestones ?? [];
  if (milestones.length === 0) {
    return (
      <div className="w-full max-w-[1440px] px-6 mx-auto py-8 text-center">
        <h3 className="text-lg font-bold text-slate-900 mb-2">No milestones found</h3>
        <p className="text-slate-500 mb-4">This engagement does not have any milestones defined yet.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-96 items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
