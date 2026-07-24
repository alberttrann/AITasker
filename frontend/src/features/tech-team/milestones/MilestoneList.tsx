import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEngagement, useEngagementMilestones } from "@/hooks/use-engagements";
import { useProject } from "@/hooks/use-projects";
import { StatusBadge, variantFromStatus } from "@/components/ui/StatusBadge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Button } from "@/components/ui/button";
import { formatVND } from "@/lib/utils";
import { ArrowLeft, CheckCircle, MessageSquare, Star } from "lucide-react";
import MilestoneChatPanel from "@/components/messaging/MilestoneChatPanel";

export default function MilestoneList() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const navigate = useNavigate();

  // Fetch the engagement data which contains the milestones array
  const {
    data: engagement,
    isLoading: isLoadingEngagement,
    error: engagementError,
    refetch: refetchEngagement,
  } = useEngagement(engagementId);

  const {
    data: milestonesData,
    isLoading: isLoadingMilestones,
    error: milestonesError,
    refetch: refetchMilestones,
  } = useEngagementMilestones(engagementId);

  const projectId = engagement?.projectId || (engagement as any)?.project_id;
  const { data: project, isLoading: isLoadingProject } = useProject(projectId);

  // State for workspace chat drawer
  const [isChatOpen, setIsChatOpen] = useState(false);

  const isLoading = isLoadingEngagement || isLoadingMilestones || isLoadingProject;
  const error = engagementError || milestonesError;
  const refetch = () => {
    refetchEngagement();
    refetchMilestones();
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !engagement) {
    const errorMsg =
      (error as any)?.response?.data?.message || "Failed to load milestones.";
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

  const jsonMilestones = project?.milestone_framework_json || (project as any)?.milestone_framework_json || [];
  const instantiatedMilestones = milestonesData ?? engagement.milestones ?? [];
  const milestones = instantiatedMilestones.length > 0 ? instantiatedMilestones : jsonMilestones;

  // Decide button labels and styling depending on current milestone status
  const getActionTextAndVariant = (milestone: any, state: string) => {
    switch (state.toUpperCase()) {
      case "DEFINED":
        return { text: "View Details", variant: "outline" as const };
      case "AWAITING_PAYMENT":
        return { text: "View Details", variant: "outline" as const };
      case "SUBMITTED":
        const requiredCriteria = (milestone.acceptanceCriteria ?? []).filter(
          (criterion: any) => criterion.isRequired,
        );
        const techReviewComplete =
          requiredCriteria.length > 0 &&
          requiredCriteria.every((criterion: any) => criterion.techVerifiedAt);
        return {
          text: techReviewComplete ? "View Review Status" : "Review",
          variant: techReviewComplete ? ("outline" as const) : ("primary" as const),
        };
      case "DISPUTED":
        return { text: "View Dispute", variant: "destructive" as const };
      default:
        return { text: "View Details", variant: "outline" as const };
    }
  };

  const handleActionClick = (milestoneId: string) => {
    navigate(`/tech-team/engagements/${engagementId}/milestones/${milestoneId}`);
  };

  return (
    <div className="w-full max-w-[1440px] px-6 mx-auto py-8">
      {/* Header and navigation bar */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(projectId ? `/tech-team/projects/${projectId}` : "/tech-team/projects")}
            className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="Back to project details"
            id="btn-tech-back-to-project-from-milestones"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Milestone Reviews
            </h1>
            <p className="text-sm text-slate-500">
              {project?.projectName
                ? `${project.projectName} — review expert submissions before CEO approval.`
                : "Review expert submissions before the CEO gives final approval."}
            </p>
          </div>
        </div>

        {/* Workspace Chat Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          {engagement.state === "CLOSED" && (
            <Button
              variant="outline"
              onClick={() => navigate(`/tech-team/engagements/${engagementId}/review`)}
              className="inline-flex items-center gap-2 text-amber-700 border-amber-200 hover:bg-amber-50 font-semibold"
              id="btn-tech-leave-review"
            >
              <Star size={16} /> Leave a Review
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setIsChatOpen(true)}
            className="inline-flex items-center gap-2 font-semibold"
            id="btn-tech-discuss-with-team"
          >
            <MessageSquare size={16} /> Discuss with Team
          </Button>
        </div>
      </div>

      {/* Main List Layout */}
      {milestones.length === 0 ? (
        <EmptyState
          title="No Milestones Defined Yet"
          description="The CEO has not created any live milestones for this engagement yet."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {milestones.map((m: any, idx: number) => {
            const state = m.state || "DEFINED";
            const action = getActionTextAndVariant(m, state);
            return (
              <Card
                key={m.id || idx}
                className="hover:border-blue-300 transition-all duration-200"
              >
                <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6">
                  {/* Milestone Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-bold text-slate-400 tracking-wider">
                        MILESTONE #{m.milestoneNumber || m.milestone_number}
                      </span>
                      <StatusBadge
                        label={state.replace(/_/g, " ")}
                        variant={variantFromStatus(state)}
                      />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">
                      {m.deliverableStatement || m.deliverable_statement ||
                        "No deliverable statement provided."}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>
                        Review flow:{" "}
                        <strong className="text-slate-700">
                          {(m.signOffAuthority || m.sign_off_authority) === "JOINT"
                            ? "Tech Team → CEO"
                            : "CEO"}
                        </strong>
                      </span>
                      {m.fundedAt && (
                        <span>
                          Funded at:{" "}
                          <strong className="text-slate-700">
                            {new Date(m.fundedAt).toLocaleDateString()}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Payment Amount and CTA Button */}
                  <div className="flex md:flex-col items-end justify-between w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 gap-4">
                    <div className="text-right">
                      <p className="text-xs text-slate-400 uppercase font-semibold">
                        Payment Amount
                      </p>
                      <p className="text-lg font-bold text-emerald-600">
                        {formatVND(m.paymentAmountVnd !== undefined ? m.paymentAmountVnd : m.payment_amount_vnd)}
                      </p>
                    </div>

                    {m.id ? (
                      <Button
                        variant={action.variant}
                        size="sm"
                        onClick={() => handleActionClick(m.id)}
                        className="whitespace-nowrap w-full md:w-auto cursor-pointer"
                        id={`btn-tech-open-milestone-${m.id}`}
                      >
                        {action.text}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="whitespace-nowrap w-full md:w-auto"
                      >
                        Pending Creation
                      </Button>
                    )}
                  </div>
                </CardContent>
                {(m.acceptanceCriteria?.length > 0 || m.dodItems?.length > 0) && (
                  <div className="px-6 pb-6 pt-4 bg-slate-50 border-t border-slate-100 rounded-b-xl space-y-4">
                    {m.acceptanceCriteria?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-slate-700 mb-2">Acceptance Criteria</h4>
                        <div className="space-y-2">
                          {m.acceptanceCriteria.map((c: any) => (
                            <div key={c.id} className="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                              <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <p className="text-sm text-slate-700 leading-snug">{c.criterionText || c.criterion_text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {m.dodItems?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-slate-700 mb-2">Definition of Done (DoD)</h4>
                        <div className="space-y-2">
                          {m.dodItems.map((dod: any) => (
                            <div key={dod.id} className="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                              <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <p className="text-sm text-slate-700 leading-snug">{dod.itemDescription || dod.item_description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Workspace Chat Drawer */}
      {engagement && (
        <MilestoneChatPanel
          engagementId={engagementId || ""}
          clientId={engagement.clientId}
          expertId={engagement.expertId}
          projectName={(engagement as any).project?.projectName || project?.projectName}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      )}
    </div>
  );
}
