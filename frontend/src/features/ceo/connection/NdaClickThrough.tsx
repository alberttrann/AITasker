import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmModal } from '@/components/ui/modal';
import { AlertTriangle, CheckCircle2, Shield, ArrowLeft, Clock } from 'lucide-react';
import type { EngagementDto } from '@/types/api.types';

import { useEngagement, useAcceptNda } from '@/hooks/use-engagements';
import AcceptedOfferSummary from '@/components/bids/AcceptedOfferSummary';

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

export default function CeoNdaClickThrough({ engagementId: propEngagementId }: { engagementId?: string }) {
  const params = useParams<{ engagementId: string }>();
  const engagementId = propEngagementId || params.engagementId;
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

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const contentFits = el.scrollHeight <= el.clientHeight + 1;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (contentFits || atBottom) setHasScrolledToBottom(true);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);

    return () => resizeObserver.disconnect();
  }, [engagement, updateScrollState]);

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
          className="cursor-pointer"
          onClick={() =>
            navigate(`/ceo/inbox/${engagementId}`)
          }
        >
          Open Messages
        </Button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-[768px] space-y-4 pb-8 p-6">
      <div className="shrink-0">
        <h1 className="font-headline text-[24px] font-semibold text-[#0F172A]">
          Non-Disclosure Agreement
        </h1>
        <p className="mt-1 text-body text-[#64748B]">
          Please review and sign the NDA to connect with the expert.
        </p>
      </div>

      {/* Already signed by CEO */}
      {alreadySigned && (
        <div className="rounded-[8px] border border-[#BBF7D0] bg-[#F0FDF4] p-4 flex items-start gap-3 shrink-0">
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
        <div className="rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] p-4 flex items-start gap-3 shrink-0">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[#EF4444] mt-0.5" />
          <p className="text-[14px] text-[#DC2626]">{serverError}</p>
        </div>
      )}

      <AcceptedOfferSummary
        offer={engagement.capabilityBid?.acceptedOffer}
        termsAcceptedAt={engagement.capabilityBid?.termsAcceptedAt}
      />

      {/* NDA text */}
      <Card className="flex h-[clamp(320px,45vh,480px)] flex-col overflow-hidden">
        <CardContent className="p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div
            id="nda-agreement-scroll-ceo"
            ref={scrollRef}
            onScroll={updateScrollState}
            tabIndex={0}
            aria-label="Non-disclosure agreement text"
            className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8"
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
            <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-3 shrink-0">
              <p className="text-[12px] text-[#94A3B8] text-center">
                Scroll to the bottom to enable signing
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sign button / Waiting state */}
      {!alreadySigned ? (
        <div className="space-y-3 shrink-0">
          <Button
            id="btn-sign-ceo-nda"
            variant="primary"
            className="w-full cursor-pointer disabled:cursor-not-allowed"
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
        <div className="rounded-[8px] border border-[#BBF7D0] bg-[#F0FDF4] p-4 text-center shrink-0">
          <CheckCircle2 className="mx-auto h-6 w-6 text-[#22C55E]" />
          <p className="mt-2 text-[14px] font-medium text-[#16A34A]">
            Both parties have signed! You are now connected.
          </p>
          <Button
            variant="primary"
            className="mt-3 cursor-pointer"
            onClick={() =>
              navigate(`/ceo/inbox/${engagementId}`)
            }
          >
            Open Messages
          </Button>
        </div>
      ) : (
        /* CEO signed, waiting for expert */
        <div className="rounded-[8px] border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-center shrink-0">
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
