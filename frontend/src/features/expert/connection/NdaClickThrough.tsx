import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmModal } from '@/components/ui/modal';
import {
  AlertTriangle,
  CheckCircle2,
  Shield,
  ArrowLeft,
  Clock,
  Banknote,
} from 'lucide-react';
import type { EngagementDto } from '@/types/api.types';

import { useEngagement, useAcceptConnect } from '@/hooks/use-engagements';
import AcceptedOfferSummary from '@/components/bids/AcceptedOfferSummary';

// ── NDA text ─────────────────────────────────────────────────────

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

export default function ExpertNdaClickThrough({ engagementId: propEngagementId }: { engagementId?: string }) {
  const params = useParams<{ engagementId: string }>();
  const engagementId = propEngagementId || params.engagementId;
  const navigate = useNavigate();

  const { data: engagement, isLoading, error, refetch } =
    useEngagement(engagementId);
  const acceptConnect = useAcceptConnect();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [showSignConfirm, setShowSignConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [promptBank, setPromptBank] = useState(false);

  const engAny = engagement as any;
  const ceoSigned = !!engAny?.clientNdaAcceptedAt;
  const alreadySigned = !!engAny?.expertNdaAcceptedAt;
  const isConnected = engAny?.state === 'CONNECTED';

  // ── Scroll detection ───────────────────────────────────────────

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const contentFits = el.scrollHeight <= el.clientHeight + 1;
    if (contentFits || el.scrollHeight - el.scrollTop - el.clientHeight < 50) {
      setHasScrolledToBottom(true);
    }
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
    acceptConnect.mutate(engagementId, {
      onSuccess: (data: any) => {
        if (data?.prompt_bank_link) {
          setPromptBank(true);
        }
      },
      onError: (err: any) => {
        const msg =
          err?.response?.data?.message || 'Failed to accept connection.';
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
    const msg =
      (error as any)?.response?.data?.message || 'Engagement not found.';
    return (
      <div className="py-24 text-center space-y-4">
        <AlertTriangle className="mx-auto h-8 w-8 text-[#EAB308]" />
        <p className="text-body-lg font-headline text-[#EF4444]">{msg}</p>
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={() => refetch()}>
            Retry
          </Button>
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Go Back
          </Button>
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
          Connected
        </h1>
        <p className="text-body text-[#64748B]">
          You are now connected with the client. You can start working together.
        </p>
        <Button
          variant="primary"
          className="cursor-pointer"
          onClick={() =>
            navigate(`/expert/inbox/${engagementId}`)
          }
        >
          Open Messages
        </Button>
      </div>
    );
  }

  // ── Waiting for CEO ─────────────────────────────────────────────

  if (!ceoSigned && !alreadySigned) {
    return (
      <div className="mx-auto max-w-[640px] py-16 text-center space-y-4">
        <Clock className="mx-auto h-12 w-12 text-[#0EA5E9] animate-pulse" />
        <h1 className="font-headline text-[24px] font-semibold text-[#0F172A]">
          Waiting for Client
        </h1>
        <p className="text-body text-[#64748B]">
          The client needs to sign the NDA first. You'll be notified when
          they're ready.
        </p>
      </div>
    );
  }

  // ── Render: CEO signed, expert needs to sign ───────────────────

  return (
    <div className="mx-auto max-w-[768px] space-y-4 pb-8 p-6">
      <div className="shrink-0">
        <h1 className="font-headline text-[24px] font-semibold text-[#0F172A]">
          Non-Disclosure Agreement
        </h1>
        <p className="mt-1 text-body text-[#64748B]">
          The client has signed the NDA. Please review and sign to connect.
        </p>
      </div>

      {/* Already signed by Expert */}
      {alreadySigned && (
        <div className="rounded-[8px] border border-[#BBF7D0] bg-[#F0FDF4] p-4 flex items-start gap-3 shrink-0">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#22C55E] mt-0.5" />
          <div>
            <p className="text-[14px] font-medium text-[#16A34A]">
              NDA Signed ✓
            </p>
            <p className="text-[12px] text-[#15803D]">
              Signed on{' '}
              {new Date(engAny.expertNdaAcceptedAt).toLocaleDateString(
                'en-GB',
                {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }
              )}
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
            id="nda-agreement-scroll-expert"
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

      {/* Bank link prompt */}
      {promptBank && (
        <div className="rounded-[8px] border border-[#FED7AA] bg-[#FFF7ED] p-4 flex items-start gap-3 shrink-0">
          <Banknote className="h-5 w-5 shrink-0 text-[#EA580C] mt-0.5" />
          <div>
            <p className="text-[14px] font-medium text-[#C2410C]">
              Don't forget to link your bank account!
            </p>
            <p className="mt-1 text-[13px] text-[#9A3412]">
              You need a linked bank account to receive milestone payments.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => navigate('/expert/wallet/link-bank')}
            >
              Link Bank Account
            </Button>
          </div>
        </div>
      )}

      {/* Sign button */}
      {!alreadySigned && (
        <div className="space-y-3 shrink-0">
          <Button
            id="btn-sign-expert-nda"
            variant="primary"
            className="w-full cursor-pointer disabled:cursor-not-allowed"
            disabled={!hasScrolledToBottom || acceptConnect.isPending}
            onClick={() => setShowSignConfirm(true)}
          >
            {acceptConnect.isPending ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" /> Signing…
              </span>
            ) : (
              'Sign NDA & Connect'
            )}
          </Button>
          {!hasScrolledToBottom && (
            <p className="text-[12px] text-[#94A3B8] text-center">
              Please scroll through the entire agreement before signing.
            </p>
          )}
        </div>
      )}

      {/* Sign Confirmation */}
      <ConfirmModal
        isOpen={showSignConfirm}
        onClose={() => setShowSignConfirm(false)}
        onConfirm={handleSign}
        title="Sign NDA & Connect"
        confirmText="I Agree & Connect"
        isInfo
      >
        By signing, you confirm that you have read and agree to the terms of
        this Non-Disclosure Agreement. You will be connected with the client.
      </ConfirmModal>
    </div>
  );
}
