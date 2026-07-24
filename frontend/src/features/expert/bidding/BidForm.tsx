import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useProject, useArtifactA } from '@/hooks/use-projects';
import { useExpertProfile } from '@/hooks/use-expert-profile';
import { useEngagement, useEngagements } from '@/hooks/use-engagements';
import { useCreateBid } from '@/hooks/use-bids';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmModal } from '@/components/ui/modal';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import ApproachSummary from './ApproachSummary';
import FootprintAlignment, { type FootprintAlignmentData } from './FootprintAlignment';
import ConditionalPricing, { type PricingItem } from './ConditionalPricing';
import { useToastActions } from '@/lib/toast-context';
import type { MilestoneFrameworkItem } from '@/types/jsonb.types';

type CompatibleMilestoneFrameworkItem = MilestoneFrameworkItem & {
  milestoneNumber?: number;
  deliverableStatement?: string;
  payment_amount_vnd?: number;
  paymentAmountVnd?: number;
  estimated_cost_vnd?: number;
  estimatedCostVnd?: number;
  price_vnd?: number;
  estimated_duration_days?: number;
  estimatedDurationDays?: number;
  condition?: string;
};

interface SubmittedPricingItem {
  milestone_number: number;
  price_vnd: number;
  condition: string;
  estimated_duration_days?: number;
}

interface PricingFieldErrors {
  price?: string;
  condition?: string;
}

interface BidFormErrors {
  approach?: string;
  items?: string;
  offers?: Record<number, PricingFieldErrors>;
  milestones?: Record<number, PricingFieldErrors>;
}

function getDefaultPricingItem(
  frameworkItem: CompatibleMilestoneFrameworkItem,
): SubmittedPricingItem {
  const milestoneNumber =
    frameworkItem.milestone_number ?? frameworkItem.milestoneNumber ?? 0;
  const price = Number(
    frameworkItem.estimated_cost_vnd ??
      frameworkItem.estimatedCostVnd ??
      frameworkItem.payment_amount_vnd ??
      frameworkItem.paymentAmountVnd ??
      frameworkItem.price_vnd ??
      0,
  );
  const condition =
    frameworkItem.condition?.trim() ||
    frameworkItem.deliverable_statement?.trim() ||
    frameworkItem.deliverableStatement?.trim() ||
    '';
  const duration = Number(
    frameworkItem.estimated_duration_days ??
      frameworkItem.estimatedDurationDays ??
      0,
  );

  return {
    milestone_number: milestoneNumber,
    price_vnd: price,
    condition,
    ...(Number.isInteger(duration) && duration > 0
      ? { estimated_duration_days: duration }
      : {}),
  };
}

function mergePricingWithProjectDefaults(
  frameworkItems: MilestoneFrameworkItem[],
  overrides: PricingItem[],
): SubmittedPricingItem[] {
  const overridesByMilestone = new Map(
    overrides.map((item) => [item.milestone_number, item]),
  );

  return frameworkItems.map((frameworkItem) => {
    const defaults = getDefaultPricingItem(frameworkItem);
    const override = overridesByMilestone.get(defaults.milestone_number);

    if (!override) return defaults;

    return {
      milestone_number: defaults.milestone_number,
      price_vnd: override.price_vnd ?? defaults.price_vnd,
      condition: override.condition || defaults.condition,
      estimated_duration_days:
        override.estimated_duration_days ?? defaults.estimated_duration_days,
    };
  });
}

export default function BidForm() {
  const { projectId: routeId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const actualProjectId = routeId;

  // Find if we have an existing active/pending engagement for this project
  const { data: engagements } = useEngagements();
  const matchedEngagement = engagements?.find((e: any) => 
    (e.projectId === actualProjectId || e.project_id === actualProjectId) &&
    !['DECLINED', 'CANCELLED'].includes(e.state)
  );
  const engagementId = searchParams.get('engagementId') || matchedEngagement?.id;

  // Fetch full engagement to get the capabilityBid
  const { data: fullEngagement, isLoading: isLoadingEngagement } = useEngagement(engagementId || undefined);
  const bid = fullEngagement?.capabilityBid;
  const isLoadingBid = isLoadingEngagement;

  const { project, isLoadingProject, error: specError } = useProject(actualProjectId);
  const { profile: expertProfile, isLoadingProfile } = useExpertProfile();
  const createBid = useCreateBid();

  // Form state (initialize from bid if it exists, otherwise empty)
  const [approach, setApproach] = useState('');
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  
  // Sync state when bid loads
  useEffect(() => {
    if (bid) {
      if ((bid as any).approachSummary || (bid as any).approach_summary) setApproach((bid as any).approachSummary || (bid as any).approach_summary);
      const currentTerms = (bid as any).currentOffer?.milestones;
      const legacyTerms = (bid as any).conditionalPricingJson || (bid as any).conditional_pricing_json;
      const pricingTerms = Array.isArray(currentTerms)
        ? currentTerms.map((term: any) => ({
            milestone_number: term.milestone_number,
            price_vnd: term.price_vnd,
            condition: term.condition || term.deliverable_statement,
            estimated_duration_days: term.estimated_duration_days,
          }))
        : Array.isArray(legacyTerms)
          ? legacyTerms
          : [];
      setPricing(pricingTerms);
    }
  }, [bid]);

  const [fieldErrors, setFieldErrors] = useState<BidFormErrors>({});
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const toast = useToastActions();

  const isDirty = approach.length > 0 || pricing.length > 0;
  const isReadOnly = !!bid && (bid as any).techStatus !== 'REVISION_REQUESTED' && (bid as any).tech_status !== 'REVISION_REQUESTED';

  // Auto-calculate footprint alignment, submitting raw dynamic data for the backend to process
  const footprint: FootprintAlignmentData = {
    domains: expertProfile?.domainDepths?.map((d: any) => ({
      code: d.domainCode,
      depth: d.depthLevel
    })) || [],
    seams: expertProfile?.seamClaims?.map((s: any) => ({
      code: s.seamCode || s.code,
      tier: s.verificationTier || 'CLAIMED'
    })) || []
  };

  // ── Validation ─────────────────────────────────────────────────

  const validate = (submittedPricing: SubmittedPricingItem[]): boolean => {
    const errs: BidFormErrors = {};
    if (!approach.trim()) errs.approach = 'Approach summary is required.';

    if (submittedPricing.length === 0) {
      errs.items = 'The project must define at least one milestone before a bid can be submitted.';
    }

    submittedPricing.forEach((item) => {
      const itemErrors: PricingFieldErrors = {};
      if (!Number.isInteger(item.price_vnd) || item.price_vnd <= 0) {
        itemErrors.price = 'Price is required and must be positive.';
      } else if (item.price_vnd > 100_000_000_000) {
        itemErrors.price = 'Maximum price is 100,000,000,000 VND.';
      }
      
      if (item.estimated_duration_days && item.estimated_duration_days > 1000) {
        itemErrors.condition = 'Maximum duration is 1000 days.';
      }

      if (!item.condition.trim()) {
        itemErrors.condition = itemErrors.condition 
          ? `${itemErrors.condition} Also, describe the milestone condition.` 
          : 'Describe the milestone condition.';
      }
      if (Object.keys(itemErrors).length === 0) return;

      const offerIndex = pricing.findIndex(
        (offer) => offer.milestone_number === item.milestone_number,
      );
      if (offerIndex >= 0) {
        errs.offers = { ...errs.offers, [offerIndex]: itemErrors };
      } else {
        errs.milestones = {
          ...errs.milestones,
          [item.milestone_number]: itemErrors,
        };
      }
    });

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actualProjectId) return;

    const submittedPricing = mergePricingWithProjectDefaults(
      project?.milestone_framework_json || [],
      pricing,
    );
    if (!validate(submittedPricing)) return;

    createBid.mutate(
      {
        projectId: actualProjectId,
        footprint_alignment_json: footprint,
        approach_summary: approach,
        conditional_pricing_json: submittedPricing,
      },
      {
        onSuccess: () => {
          setTimeout(() => {
            navigate(`/expert/service/projects`);
          }, 1500);
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message || 'Failed to submit bid.';
          toast.error(Array.isArray(msg) ? msg[0] : msg);
        },
      }
    );
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      navigate(-1);
    }
  };

  // ── Loading ────────────────────────────────────────────────────

  if (isLoadingProject || isLoadingProfile || isLoadingBid) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-4">
          <Spinner size="xl" className="mx-auto" />
          <p className="text-body text-[#64748B]">Loading bid context…</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────

  if (specError) {
    const msg = (specError as any)?.response?.data?.message || 'Failed to load project.';
    return (
      <div className="py-24 text-center space-y-4">
        <AlertTriangle className="mx-auto h-8 w-8 text-[#EAB308]" />
        <p className="text-body-lg font-headline text-[#EF4444]">{msg}</p>
        <Button variant="secondary" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-[720px] space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          {isReadOnly ? 'View Sent Bid' : 'Submit Bid'}
        </h1>
        <p className="mt-1 text-body text-[#64748B]">
          {project?.projectName || `Project ${actualProjectId}`}
        </p>
      </div>


      {/* Success state */}
      {createBid.isSuccess && (
        <div className="rounded-[8px] border border-[#BBF7D0] bg-[#F0FDF4] p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#22C55E] mt-0.5" />
          <p className="text-[14px] text-[#16A34A]">Bid submitted successfully! Redirecting…</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">


        {/* Approach Summary */}
        <Card>
          <CardContent className="pt-6">
            <ApproachSummary
              value={approach}
              onChange={setApproach}
              error={fieldErrors.approach}
              disabled={createBid.isPending || isReadOnly}
              readOnly={isReadOnly}
            />
          </CardContent>
        </Card>

        {/* Conditional Pricing */}
        <Card>
          <CardContent className="pt-6">
            <ConditionalPricing
              frameworkItems={project?.milestone_framework_json || []}
              items={pricing}
              onChange={setPricing}
              errors={fieldErrors}
              disabled={createBid.isPending || isReadOnly}
              readOnly={isReadOnly}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          {isReadOnly ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => navigate('/expert/service/projects')}
            >
              Back to Projects
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={createBid.isPending}
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={createBid.isPending}
                className="min-w-[140px]"
              >
                {createBid.isPending ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" /> Submitting…
                  </span>
                ) : (
                  'Submit Bid'
                )}
              </Button>
            </>
          )}
        </div>
      </form>

      {/* Cancel confirmation */}
      <ConfirmModal
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={() => navigate(-1)}
        title="Discard changes?"
        confirmText="Discard"
        isDestructive
      >
        You have unsaved changes. Are you sure you want to leave?
      </ConfirmModal>
    </div>
  );
}
