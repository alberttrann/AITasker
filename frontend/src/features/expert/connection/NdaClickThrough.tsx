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
    useEngagement(engagementId, { refetchInterval: 2000 });
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

  return (
    <div className="mx-auto p-6 md:p-8 h-full flex flex-col max-w-7xl">
      <div className="shrink-0 mb-6">
        <h1 className="font-headline text-3xl font-bold text-slate-900">
          Non-Disclosure Agreement
        </h1>
        <p className="mt-2 text-slate-500 font-medium">
          {alreadySigned 
            ? "You have signed the NDA for this engagement."
            : "The client has signed the NDA. Please review and sign to connect."}
        </p>
      </div>

      {/* Server error */}
      {serverError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3 mb-6 shrink-0">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <p className="text-sm font-medium text-red-600">{serverError}</p>
        </div>
      )}

      <div className="flex-1 min-h-0 grid md:grid-cols-12 gap-8 lg:gap-10">
        {/* Left Column: NDA Text */}
        <div className="md:col-span-7 lg:col-span-8 flex flex-col min-h-[400px] md:h-full min-h-0">
          <Card className="flex flex-col h-full overflow-hidden shadow-sm border-slate-200 bg-white">
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
                  <Shield className="h-5 w-5 text-slate-700" />
                  <h2 className="font-headline text-lg font-bold text-slate-900">
                    NDA Agreement Text
                  </h2>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-600 border-t border-slate-100 pt-6">
                  {NDA_TEXT}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Status & Terms */}
        <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-6 overflow-y-auto md:pr-2">
          {alreadySigned && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 flex items-start gap-4 shrink-0 shadow-sm">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-emerald-900">NDA Signed</h3>
                <p className="text-sm font-medium text-emerald-700 mt-1">
                  Signed on {new Date(engAny.expertNdaAcceptedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                {ceoSigned && (
                  <p className="text-sm font-medium text-emerald-700 mt-2">
                    Client also signed on {new Date(engAny.clientNdaAcceptedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="shrink-0">
            <AcceptedOfferSummary
              offer={engagement.capabilityBid?.acceptedOffer}
              termsAcceptedAt={engagement.capabilityBid?.termsAcceptedAt}
            />
          </div>

          <div className="mt-auto pt-4 shrink-0">
            {alreadySigned ? (
              ceoSigned ? (
                <Button
                  variant="primary"
                  className="w-full h-12 text-base font-bold shadow-md shadow-blue-500/20"
                  onClick={() => navigate(`/expert/inbox/${engagementId}`)}
                >
                  Open Messages
                </Button>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center shadow-sm">
                  <Clock className="h-6 w-6 text-amber-500 mx-auto mb-2 animate-pulse" />
                  <p className="text-sm font-bold text-amber-900">Waiting for Client</p>
                  <p className="text-sm font-medium text-amber-700 mt-1">The client still needs to sign the NDA to connect.</p>
                </div>
              )
            ) : (
              !ceoSigned ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center shadow-sm">
                  <Clock className="h-6 w-6 text-amber-500 mx-auto mb-2 animate-pulse" />
                  <p className="text-sm font-bold text-amber-900">Waiting for Client</p>
                  <p className="text-sm font-medium text-amber-700 mt-1">The client needs to sign the NDA first before you can sign.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Button
                    variant="primary"
                    className="w-full h-12 text-base font-bold shadow-md shadow-blue-500/20"
                    disabled={!hasScrolledToBottom || acceptConnect.isPending}
                    onClick={() => setShowSignConfirm(true)}
                  >
                    {acceptConnect.isPending ? 'Signing...' : 'Sign NDA'}
                  </Button>
                  {!hasScrolledToBottom && (
                    <p className="text-center text-sm font-medium text-slate-500 animate-pulse">
                      Please scroll to the bottom of the NDA to sign
                    </p>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </div>

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
