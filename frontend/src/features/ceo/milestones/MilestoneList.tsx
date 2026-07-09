import { useParams, useNavigate } from "react-router-dom";
import { useEngagement } from "@/hooks/use-engagements";
import { StatusBadge, variantFromStatus } from "@/components/ui/StatusBadge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Button } from "@/components/ui/Button";
import { formatVND } from "@/lib/utils";
import { ArrowLeft, Plus } from "lucide-react";

export default function MilestoneList() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const navigate = useNavigate();

  // Fetch the engagement data which contains the milestones array
  const {
    data: engagement,
    isLoading,
    error,
    refetch,
  } = useEngagement(engagementId);

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
      <div className="p-6 max-w-4xl mx-auto">
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
  const projectId = engagement.projectId;

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
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
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
          {milestones.map((m) => {
            const action = getActionTextAndVariant(m.state);
            return (
              <Card
                key={m.id}
                className="hover:border-blue-300 transition-all duration-200"
              >
                <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6">
                  {/* Milestone Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-bold text-slate-400 tracking-wider">
                        MILESTONE #{m.milestoneNumber}
                      </span>
                      <StatusBadge
                        label={m.state.replace(/_/g, " ")}
                        variant={variantFromStatus(m.state)}
                      />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">
                      {m.deliverableStatement ||
                        "No deliverable statement provided."}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>
                        Sign-off:{" "}
                        <strong className="text-slate-700">
                          {m.signOffAuthority}
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
                        {formatVND(m.paymentAmountVnd)}
                      </p>
                    </div>

                    <Button
                      variant={action.variant}
                      size="sm"
                      onClick={() => handleActionClick(m.id, m.state)}
                      className="whitespace-nowrap w-full md:w-auto"
                    >
                      {action.text}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
