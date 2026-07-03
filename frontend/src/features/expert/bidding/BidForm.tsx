import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { useProject } from '@/hooks/use-projects';
import { useExpertProfile } from '@/hooks/use-expert-profile';
import { useBid } from '@/hooks/use-bids';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmModal } from '@/components/ui/modal';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import ApproachSummary from './ApproachSummary';
import FootprintAlignment, {
  toWireFootprint,
  type FootprintAlignmentData,
} from './FootprintAlignment';
import ConditionalPricing, { type PricingItem } from './ConditionalPricing';

// ── Inline hooks ─────────────────────────────────────────────────

/** GET /projects/:id/artifact-a — fetch project spec */
function useArtifactA(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project', projectId, 'artifact-a'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/${projectId}/artifact-a`);
      return data;
    },
    enabled: !!projectId,
  });
}

/** POST /bids — expert-only bid creation with SeamCode conversion */
function useCreateBid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      projectId: string;
      footprint_alignment_json: any;
      approach_summary: string;
      conditional_pricing_json: PricingItem[];
    }) => {
      const wirePayload = {
        ...payload,
        footprint_alignment_json: payload.footprint_alignment_json
          ? toWireFootprint(payload.footprint_alignment_json)
          : null,
      };
      const { data } = await apiClient.post('/bids', wirePayload);
      return data; // { engagement, bid }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bids'] });
      qc.invalidateQueries({ queryKey: ['engagements'] });
    },
  });
}

// ── Component ────────────────────────────────────────────────────

export default function BidForm() {
  const { projectId: routeId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  // Try to fetch as a bid (if the routeId is actually a bidId)
  const { data: bid, isLoading: isLoadingBid } = useBid(routeId || '');
  
  // If we found a bid, use its projectId. Otherwise assume routeId IS the projectId.
  const actualProjectId = bid?.projectId || bid?.project_id || routeId;

  const { project, isLoadingProject, error: specError } = useProject(actualProjectId);
  const { profile: expertProfile, isLoadingProfile } = useExpertProfile();
  const createBid = useCreateBid();

  // Form state (initialize from bid if it exists, otherwise empty)
  const [approach, setApproach] = useState('');
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  
  // Sync state when bid loads
  useEffect(() => {
    if (bid) {
      if (bid.approachSummary) setApproach(bid.approachSummary);
      if (bid.conditionalPricingJson) setPricing(bid.conditionalPricingJson);
    }
  }, [bid]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, any>>({});
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const isDirty = approach.length > 0 || pricing.length > 0;

  // Auto-calculate footprint alignment
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

  const validate = (): boolean => {
    const errs: Record<string, any> = {};
    if (!approach.trim()) errs.approach = 'Approach summary is required.';
    if (pricing.length === 0) errs.pricing = { items: 'At least one pricing milestone is required.' };
    else {
      pricing.forEach((p, i) => {
        const itemErrs: any = {};
        if (!p.price_vnd || p.price_vnd <= 0) itemErrs.price = 'Price must be a positive integer.';
        if (!p.condition.trim()) itemErrs.condition = 'Describe the milestone condition.';
        if (Object.keys(itemErrs).length) errs[`pricing_${i}`] = itemErrs;
      });
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    if (!actualProjectId) return;

    createBid.mutate(
      {
        projectId: actualProjectId,
        footprint_alignment_json: footprint,
        approach_summary: approach,
        conditional_pricing_json: pricing,
      },
      {
        onSuccess: (data: any) => {
          const bidId = data?.bid?.id;
          if (bidId) navigate(`/expert/bids/${bidId}`, { replace: true });
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message || 'Failed to submit bid.';
          setServerError(Array.isArray(msg) ? msg[0] : msg);
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
        <h1 className="font-headline text-[24px] font-semibold text-[#0F172A]">
          Submit Bid
        </h1>
        <p className="mt-1 text-body text-[#64748B]">
          {project?.projectName || `Project ${actualProjectId}`}
        </p>
      </div>

      {/* Server error */}
      {serverError && (
        <div className="rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[#EF4444] mt-0.5" />
          <p className="text-[14px] text-[#DC2626]">{serverError}</p>
        </div>
      )}

      {/* Success state */}
      {createBid.isSuccess && (
        <div className="rounded-[8px] border border-[#BBF7D0] bg-[#F0FDF4] p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#22C55E] mt-0.5" />
          <p className="text-[14px] text-[#16A34A]">Bid submitted successfully! Redirecting…</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Footprint Alignment */}
        <Card>
          <CardContent className="pt-6">
            <FootprintAlignment
              expertProfile={expertProfile}
              project={project}
            />
          </CardContent>
        </Card>

        {/* Approach Summary */}
        <Card>
          <CardContent className="pt-6">
            <ApproachSummary
              value={approach}
              onChange={setApproach}
              error={fieldErrors.approach}
              disabled={createBid.isPending}
            />
          </CardContent>
        </Card>

        {/* Conditional Pricing */}
        <Card>
          <CardContent className="pt-6">
            <ConditionalPricing
              items={pricing}
              onChange={setPricing}
              errors={fieldErrors}
              disabled={createBid.isPending}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
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
