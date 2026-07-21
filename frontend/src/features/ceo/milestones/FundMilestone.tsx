import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Spinner } from "@/components/ui/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { StatusBadge, variantFromStatus } from "@/components/ui/StatusBadge";
import { VietQRPanel } from "@/components/wallet/VietQRPanel";
import { useFundMilestone, useMilestone } from "@/hooks/use-milestones";
import { formatVND } from "@/lib/utils";
import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, CreditCard } from "lucide-react";

export default function FundMilestone() {
  const { engagementId, milestoneId } = useParams<{ engagementId: string; milestoneId: string }>();
  const navigate = useNavigate();
  const { data: milestone, isLoading, refetch } = useMilestone(milestoneId);
  const fundMilestone = useFundMilestone();

  // Poll milestone status while payment is pending
  useEffect(() => {
    if (milestone?.state !== "AWAITING_PAYMENT") return;

    const interval = setInterval(() => {
      refetch();
    }, 4000);

    return () => clearInterval(interval);
  }, [milestone?.state, refetch]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!milestone) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <ErrorBanner message="This milestone does not exist." />
        <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
          <ArrowLeft size={16} className="mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  const isFunded = milestone.state !== "DEFINED" && milestone.state !== "AWAITING_PAYMENT";

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header and navigation */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(`/ceo/engagements/${engagementId}/milestones`)}
          className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          aria-label="Back to milestones list"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-headline">Fund Milestone</h1>
          <p className="text-sm text-slate-500">Secure the technical team's deliverables by funding this milestone into escrow.</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Milestone Summary Card */}
        <Card>
          <CardHeader tinted>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Milestone Info</CardTitle>
              <StatusBadge
                label={milestone.state.replace('_', ' ')}
                variant={variantFromStatus(milestone.state)}
              />
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Milestone Number</span>
              <p className="text-lg font-semibold text-slate-900"># {milestone.milestoneNumber}</p>
            </div>

            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Deliverable Statement</span>
              <p className="text-slate-700 mt-1">{milestone.deliverableStatement || "No deliverables specified."}</p>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Escrow Value</span>
              <p className="text-3xl font-bold text-primary font-headline mt-1">{formatVND(milestone.paymentAmountVnd)}</p>
            </div>

            {milestone.fundedAt && (
              <div className="border-t border-slate-100 pt-4 flex justify-between items-center text-sm text-slate-500">
                <span>Funded Date:</span>
                <span className="font-medium text-slate-800">{new Date(milestone.fundedAt).toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* DEFINED State: Generate Payment info */}
        {milestone.state === "DEFINED" && (
          <Card className="border-dashed border-primary/40 bg-slate-50/50">
            <CardContent className="pt-6 space-y-4 flex flex-col items-center text-center">
              {fundMilestone.isError && (
                <div className="w-full text-left">
                  <ErrorBanner
                    message={
                      (fundMilestone.error as any)?.response?.data?.message?.message ||
                      (fundMilestone.error as any)?.response?.data?.message ||
                      "Failed to initiate funding. Please ensure terms are accepted and both NDA signatures are completed."
                    }
                  />
                </div>
              )}
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <CreditCard size={24} />
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="font-semibold text-slate-900 text-lg">Generate Escrow Payment</h3>
                <p className="text-sm text-slate-500">
                  To fund this milestone, you need to generate a Virtual Account. Once generated, you can transfer money to it using any local banking application.
                </p>
              </div>
              <Button
                onClick={() => fundMilestone.mutate(milestoneId!)}
                disabled={fundMilestone.isPending}
                className="mt-2 w-full max-w-xs"
              >
                {fundMilestone.isPending ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" /> Generating...
                  </>
                ) : (
                  "Generate Payment Info"
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* AWAITING_PAYMENT State: Render reusable VietQRPanel */}
        {milestone.state === "AWAITING_PAYMENT" && (
          <Card>
            <CardContent className="pt-6">
              <VietQRPanel
                qrCodeUrl={`https://qr.sepay.vn/img?bank=MBBank&acc=0394654576&template=compact&amount=${milestone.paymentAmountVnd}&des=${milestone.vaNumber}`}
                paymentReference={milestone.vaNumber || ""}
                amount={Number(milestone.paymentAmountVnd)}
                onPaymentConfirmed={() => refetch()}
              />
            </CardContent>
          </Card>
        )}

        {/* Paid / Success State */}
        {isFunded && (
          <Card className="border-emerald-200 bg-emerald-50/20">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-emerald-950 text-lg">Milestone Payment Verified</h3>
                  <p className="text-sm text-emerald-700">
                    The amount of {formatVND(milestone.paymentAmountVnd)} has been successfully funded and is safely locked in escrow.
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-white/80 p-4 border border-emerald-100 space-y-2 text-sm text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Virtual Account:</span>
                  <span className="font-mono font-medium text-slate-900">{milestone.vaNumber || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current State:</span>
                  <span className="capitalize font-semibold text-slate-900">{milestone.state.replace('_', ' ').toLowerCase()}</span>
                </div>
                {milestone.fundedAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Funded Date:</span>
                    <span className="font-medium text-slate-900">{new Date(milestone.fundedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => navigate(`/ceo/engagements/${engagementId}/milestones`)}
                >
                  Back to Milestones List
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
