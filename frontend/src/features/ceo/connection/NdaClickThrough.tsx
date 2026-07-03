import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmModal } from '@/components/ui/Modal';
import { AlertTriangle, CheckCircle2, Shield, ArrowLeft, Clock } from 'lucide-react';
import type { EngagementDto } from '@/types/api.types';

// ── Inline hooks ─────────────────────────────────────────────────

/** GET /engagements/:id */
function useEngagement(id: string | undefined) {
  return useQuery({
    queryKey: ['engagements', id],
    queryFn: async () => {
      const { data } = await apiClient.get<EngagementDto>(`/engagements/${id}`);
      return data;
    },
    enabled: !!id,
    staleTime: 15_000,
    refetchInterval: 5_000, // Poll for expert's signature
  });
}

/** PUT /engagements/:id/accept-nda — NO body */
function useAcceptNda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (engagementId: string) => {
      const { data } = await apiClient.put(`/engagements/${engagementId}/accept-nda`);
      return data;
    },
    onSuccess: (_, engagementId) => {
      qc.invalidateQueries({ queryKey: ['engagements', engagementId] });
      qc.invalidateQueries({ queryKey: ['engagements'] });
    },
  });
}

// ── Mock NDA text ────────────────────────────────────────────────

const NDA_TEXT = `
NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into by and between the Client ("Disclosing Party") and the Expert ("Receiving Party") for the purpose of preventing the unauthorized disclosure of Confidential Information.

1. DEFINITION OF CONFIDENTIAL INFORMATION
"Confidential Information" means any information disclosed by the Disclosing Party to the Receiving Party, either directly or indirectly, in writing, orally or by inspection of tangible objects, including without limitation: project specifications, technical requirements, business processes, source code, algorithms, trade secrets, and any other proprietary information.

2. OBLIGATIONS OF RECEIVING PARTY
The Receiving Party shall: (a) hold the Confidential Information in strict confidence; (b) not disclose Confidential Information to any third party; (c) use Confidential Information solely for the purpose of the engagement; and (d) return or destroy all Confidential Information upon termination of the engagement.

3. TERM
This Agreement shall remain in effect for the duration of the engagement and for a period of two (2) years following its termination.

4. GOVERNING LAW
This Agreement shall be governed by and construed in accordance with the laws of Vietnam.

By signing below, both parties acknowledge that they have read and understood this Agreement and agree to be bound by its terms.
`.trim();

export default function CeoNdaClickThrough() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const navigate = useNavigate();

  const { data: engagement, isLoading, error, refetch } = useEngagement(engagementId);
  const acceptNda = useAcceptNda();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [showSignConfirm, setShowSignConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const engAny = engagement as any;
  const alreadySigned = !!engAny?.clientNdaAcceptedAt;
  const expertSigned = !!engAny?.expertNdaAcceptedAt;
  const isConnected = engAny?.state === 'CONNECTED';

  // ── Scroll detection ───────────────────────────────────────────

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (atBottom) setHasScrolledToBottom(true);
  }, []);

  // ── Sign handler ───────────────────────────────────────────────

  const handleSign = () => {
    if (!engagementId) return;
    setServerError(null);
    acceptNda.mutate(engagementId, {
      onError: (err: any) => {
        const msg = err?.response?.data?.message || 'Failed to sign NDA.';
        setServerError(Array.isArray(msg) ? msg[0] : msg);
      },
    });
  };

  // ── Loading ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="xl" className="mx-auto" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────

  if (error || !engagement) {
    const msg = (error as any)?.response?.data?.message || 'Engagement not found.';
    return (
      <div className="py-24 text-center space-y-4">
        <AlertTriangle className="mx-auto h-8 w-8 text-[#EAB308]" />
        <p className="text-body-lg font-headline text-[#EF4444]">{msg}</p>
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={() => refetch()}>Retry</Button>
          <Button variant="ghost" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  // ── Already Connected ──────────────────────────────────────────

  if (isConnected) {
    return (
      <div className="mx-auto max-w-[640px] py-16 text-center space-y-4">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[#22C55E]" />
        <h1 className="font-headline text-[24px] font-semibold text-[#0F172A]">
          NDA Signed & Connected
        </h1>
        <p className="text-body text-[#64748B]">
          Both parties have signed the NDA. You can now communicate
          directly with the expert.
        </p>
        <Button
          variant="primary"
          onClick={() =>
            navigate(`/engagements/${engagementId}/messages`)
          }
        >
          Open Messages
        </Button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-[640px] space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors"
      >
        <ArrowLeft size={14} />
        Back
      </button>

      <div>
        <h1 className="font-headline text-[24px] font-semibold text-[#0F172A]">
          Non-Disclosure Agreement
        </h1>
        <p className="mt-1 text-body text-[#64748B]">
          Please review and sign the NDA to connect with the expert.
        </p>
      </div>

      {/* Already signed by CEO */}
      {alreadySigned && (
        <div className="rounded-[8px] border border-[#BBF7D0] bg-[#F0FDF4] p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#22C55E] mt-0.5" />
          <div>
            <p className="text-[14px] font-medium text-[#16A34A]">
              NDA Signed ✓
            </p>
            <p className="text-[12px] text-[#15803D]">
              Signed on{' '}
              {new Date(engAny.clientNdaAcceptedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      )}

      {/* Server error */}
      {serverError && (
        <div className="rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[#EF4444] mt-0.5" />
          <p className="text-[14px] text-[#DC2626]">{serverError}</p>
        </div>
      )}

      {/* NDA text */}
      <Card>
        <CardContent className="p-0">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="max-h-[360px] overflow-y-auto p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-[#0F172A]" />
              <h2 className="font-headline text-[18px] font-semibold text-[#0F172A]">
                NDA Agreement
              </h2>
            </div>
            <pre className="font-body text-[14px] leading-[1.7] text-[#334155] whitespace-pre-wrap">
              {NDA_TEXT}
            </pre>
          </div>
          {!hasScrolledToBottom && !alreadySigned && (
            <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-3">
              <p className="text-[12px] text-[#94A3B8] text-center">
                Scroll to the bottom to enable signing
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sign button / Waiting state */}
      {!alreadySigned ? (
        <div className="space-y-3">
          <Button
            variant="primary"
            className="w-full"
            disabled={!hasScrolledToBottom || acceptNda.isPending}
            onClick={() => setShowSignConfirm(true)}
          >
            {acceptNda.isPending ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" /> Signing…
              </span>
            ) : (
              'Sign NDA'
            )}
          </Button>
          {!hasScrolledToBottom && (
            <p className="text-[12px] text-[#94A3B8] text-center">
              Please scroll through the entire agreement before signing.
            </p>
          )}
        </div>
      ) : expertSigned ? (
        /* Both signed — connected */
        <div className="rounded-[8px] border border-[#BBF7D0] bg-[#F0FDF4] p-4 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-[#22C55E]" />
          <p className="mt-2 text-[14px] font-medium text-[#16A34A]">
            Both parties have signed! You are now connected.
          </p>
          <Button
            variant="primary"
            className="mt-3"
            onClick={() =>
              navigate(`/engagements/${engagementId}/messages`)
            }
          >
            Open Messages
          </Button>
        </div>
      ) : (
        /* CEO signed, waiting for expert */
        <div className="rounded-[8px] border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-center">
          <Clock className="mx-auto h-6 w-6 text-[#0EA5E9] animate-pulse" />
          <p className="mt-2 text-[14px] font-medium text-[#1E40AF]">
            Waiting for expert to sign…
          </p>
          <p className="text-[12px] text-[#3B82F6]">
            We'll notify you when both parties have signed.
          </p>
        </div>
      )}

      {/* Sign Confirmation */}
      <ConfirmModal
        isOpen={showSignConfirm}
        onClose={() => setShowSignConfirm(false)}
        onConfirm={handleSign}
        title="Sign NDA"
        confirmText="I Agree & Sign"
        isInfo
      >
        By signing, you confirm that you have read and agree to the terms of
        this Non-Disclosure Agreement. Your signature will be legally binding.
      </ConfirmModal>
    </div>
  );
}
