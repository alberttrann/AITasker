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
import { ArrowLeft, Plus, CheckCircle } from "lucide-react";

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

  const jsonMilestones = project?.milestoneFrameworkJson || (project as any)?.milestone_framework_json || [];
  const instantiatedMilestones = milestonesData ?? engagement.milestones ?? [];
  const milestones = instantiatedMilestones.length > 0 ? instantiatedMilestones : jsonMilestones;

  // Decide button labels and styling depending on current milestone status
  const getActionTextAndVariant = (state: string) => {
    switch (state.toUpperCase()) {
      case "DEFINED":
        return { text: "Fund Milestone", variant: "primary" as const };
      case "AWAITING_PAYMENT":
        return { text: "View Payment", variant: "secondary" as const };
      case "SUBMITTED":
        return { text: "Review", variant: "primary" as const };
      case "DISPUTED":
        return { text: "View Dispute", variant: "destructive" as const };
      default:
        return { text: "View Details", variant: "outline" as const };
    }
  };

  const handleActionClick = (milestoneId: string, state: string) => {
    const s = state.toUpperCase();
    if (s === "DEFINED" || s === "AWAITING_PAYMENT") {
      navigate(
        `/ceo/engagements/${engagementId}/milestones/${milestoneId}/fund`,
      );
    } else {
      navigate(`/ceo/engagements/${engagementId}/milestones/${milestoneId}`);
    }
  };

  return (
    <div className="w-full max-w-[1440px] px-6 mx-auto py-8">
      {/* Header and navigation bar */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (projectId) {
                navigate(`/ceo/projects/${projectId}`);
              } else {
                navigate("/ceo/projects");
              }
            }}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900"
            aria-label="Back to project details"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Milestones</h1>
            <p className="text-sm text-slate-500">
              Manage deliverables, track escrow status, and sign off criteria.
            </p>
          </div>
        </div>

        {/* Create Milestone action */}
        <Button
          variant="primary"
          onClick={() =>
            navigate(`/ceo/engagements/${engagementId}/milestones/create`)
          }
          className="inline-flex items-center gap-2"
        >
          <Plus size={16} /> Create New Milestone
        </Button>
      </div>

      {/* Main List Layout */}
      {milestones.length === 0 ? (
        <EmptyState
          title="No Milestones Defined Yet"
          description="Create your first milestone with clear deliverables and acceptance criteria to start tracking project progress."
          action={
            <Button
              variant="primary"
              onClick={() =>
                navigate(`/ceo/engagements/${engagementId}/milestones/create`)
              }
              className="inline-flex items-center gap-2"
            >
              <Plus size={16} /> Create First Milestone
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {milestones.map((m: any, idx: number) => {
            const state = m.state || "DEFINED";
            const action = getActionTextAndVariant(state);
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
                        Sign-off:{" "}
                        <strong className="text-slate-700">
                          {m.signOffAuthority || m.sign_off_authority}
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
                        onClick={() => handleActionClick(m.id, state)}
                        className="whitespace-nowrap w-full md:w-auto"
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
    </div>
  );
}
