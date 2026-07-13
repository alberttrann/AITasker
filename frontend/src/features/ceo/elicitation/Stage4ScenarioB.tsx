import { useState, useEffect, useCallback } from "react";
import { Loader2, Link as LinkIcon, AlertTriangle, KeyRound, CheckCircle2 } from 'lucide-react';
import Stage4HandoffLink from "./Stage4HandoffLink";
import { inviteTechTeam, getSession, revertSession, handleElicitationError, useElicitation } from "@/hooks/use-elicitation";
import type { Stage4ScenarioBProps } from "@t/ui.types";
import { Button } from "@/components/ui/Button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";

// Polling configuration
// Stopgap until a real sockets/notifications module exists on the backend.
// See: ai-service TECHNICAL_DOC.md gap notes — processStage4Handoff currently
// has no push mechanism to notify the CEO when Tech Team submits.
const POLL_INTERVAL_MS = 5_000; // check every 5 seconds
const POLL_TIMEOUT_MS = 30 * 60_000; // give up after 30 minutes — Tech Team may be slow to respond

export default function Stage4ScenarioB({
  sessionId,
  onTechTeamSubmitted,
  onFillInMyself,
  onBack,
}: Stage4ScenarioBProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [pollStartedAt, setPollStartedAt] = useState<number | null>(null);

  const handleBackClick = async () => {
    setIsReverting(true);
    setSendError(null);
    try {
      await revertSession(sessionId, 3);
      await queryClient.invalidateQueries({ queryKey: ["elicitation", "session", sessionId] });
      onBack();
    } catch (err: any) {
      setSendError(handleElicitationError(err).message || 'Failed to revert session.');
      setIsReverting(false);
    }
  };

  // Generate the handoff invite link
  // NOTE: there is no email-sending infrastructure in this codebase.
  // The backend returns the link directly — the CEO copies it and shares it
  // through whatever channel they normally use with their tech team
  // (Slack, Zalo, etc). This is intentional, not a missing feature.
  const handleGenerateLink = useCallback(async () => {
    if (!inviteEmail.trim()) return;

    if (user?.email && inviteEmail.trim().toLowerCase() === user.email.toLowerCase()) {
      setSendError("You cannot invite yourself. Please enter your tech lead's email.");
      return;
    }

    setIsSending(true);
    setSendError(null);

    try {
      const res = await inviteTechTeam(sessionId, inviteEmail.trim());
      // Construct the link dynamically on the client side to prevent localhost issues on deployed environments
      setInviteLink(`${window.location.origin}/register/handoff/${res.invite_token}`);
      setInviteSent(true);
      setPollStartedAt(Date.now());
    } catch (err: any) {
      setSendError(
        err?.response?.data?.message ??
          "Could not generate the invite link. Please try again.",
      );
    } finally {
      setIsSending(false);
    }
  }, [inviteEmail, inviteTechTeam]);

  // Copy link to clipboard
  const handleCopyLink = useCallback(() => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }, [inviteLink]);

  // Generate a fresh link (in case the old one expires or wasn't shared)
  const handleResendInvite = useCallback(() => {
    setInviteSent(false);
    setInviteLink(null);
    setSendError(null);
    setPollStartedAt(null);
  }, []);

  // Give up after POLL_TIMEOUT_MS
  const timedOut = pollStartedAt ? Date.now() - pollStartedAt > POLL_TIMEOUT_MS : false;

  const { data: sessionData, isError: isPollError } = useQuery({
    queryKey: ['elicitation-session', sessionId],
    queryFn: () => getSession(sessionId),
    refetchInterval: () => {
      if (!inviteSent || timedOut) return false;
      const currentStage = sessionData?.currentStage || sessionData?.current_stage || 1;
      return currentStage >= 5 ? false : POLL_INTERVAL_MS;
    },
    enabled: inviteSent && !timedOut,
  });

  useEffect(() => {
    const currentStage = sessionData?.currentStage || sessionData?.current_stage || 1;
    if (sessionData && currentStage >= 5) {
      onTechTeamSubmitted();
    }
  }, [sessionData, onTechTeamSubmitted]);

  // Render: before link generated
  if (!inviteSent) {
    return (
      <div className="space-y-8">
        <div className="text-center mb-6">
          <h2 className="text-h2 font-headline text-primary">Stage 4 of 5</h2>
          <p className="mt-2 text-body text-secondary max-w-md mx-auto">
            Delegate technical details to your team. We'll generate a secure invite link for them to complete this stage.
          </p>
        </div>
        
        {sessionData?.criticalArtifactsJson && sessionData.criticalArtifactsJson.length > 0 && (
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
            <h3 className="text-body font-bold text-blue-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              Critical Documents Required
            </h3>
            <p className="mt-1 text-body-sm text-blue-800">
              Please remind your tech team to prepare links to the following documents when they fill out this stage:
            </p>
            <ul className="mt-3 space-y-2">
              {sessionData.criticalArtifactsJson.map((artifact: any, idx: number) => (
                <li key={idx} className="flex flex-col text-sm">
                  <span className="font-semibold text-blue-900">• {artifact.label}</span>
                  <span className="text-blue-700 ml-3 text-xs italic">{artifact.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="tech-team-email" className="text-body-sm font-semibold text-primary">
            Tech team member's email
          </label>
          <input
            id="tech-team-email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="name@company.com"
            className="w-full rounded-lg border border-slate-200 bg-surface px-4 py-3 text-body text-primary placeholder:text-secondary transition-shadow hover:border-primary focus:border-2 focus:border-primary focus:ring-[3px] focus:ring-primary/10 focus:outline-none"
            disabled={isSending}
          />
          <p className="text-caption text-secondary">
            Used to link the account once they register — not used to send an email.
          </p>
        </div>

        {sendError && <p className="text-body-sm text-error">{sendError}</p>}

        <Button
          onClick={handleGenerateLink}
          disabled={
            isSending || 
            !inviteEmail.trim() || 
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim()) ||
            (!!user?.email && inviteEmail.trim().toLowerCase() === user.email.toLowerCase())
          }
          className="w-full"
          variant="primary"
        >
          {isSending ? "Generating link…" : "Generate invite link"}
        </Button>
        <div className="flex items-center justify-between pt-4">
          <Button variant="outline" onClick={handleBackClick} disabled={isSending || isReverting}>
            {isReverting ? 'Going back…' : '← Back'}
          </Button>
          <button
            onClick={onFillInMyself}
            className="text-body-sm text-secondary hover:text-primary hover:underline transition-colors font-medium"
          >
            Actually, I'll fill in the details myself
          </button>
        </div>
      </div>
    );
  }

  // Render: timed out — let the CEO regenerate or switch to Scenario A
  if (timedOut) {
    return (
      <div className="space-y-8 text-center">
        <div>
          <h2 className="text-h2 font-headline text-primary">Stage 4 of 5</h2>
          <p className="text-body-sm text-secondary">Still waiting on your tech team</p>
        </div>

        <p className="text-body-sm text-secondary">
          It's been a while since the link for <strong className="text-primary">{inviteEmail}</strong>{" "}
          was generated. You can generate a new one, or fill in the technical
          details yourself instead.
        </p>

        <div className="mx-auto max-w-sm flex flex-col gap-3 pt-4">
          <Button
            onClick={handleResendInvite}
            variant="outline"
            className="w-full"
          >
            Generate a new link
          </Button>
          <button
            onClick={onFillInMyself}
            className="text-body-sm text-secondary hover:text-primary hover:underline transition-colors font-medium mt-2"
          >
            Fill in the details myself instead
          </button>
          
          <div className="pt-6">
            <Button variant="outline" onClick={handleBackClick} disabled={isReverting} className="w-full">
              {isReverting ? 'Going back…' : '← Back'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render: waiting state (link generated, polling in progress)
  return (
    <div className="space-y-8">
      {isPollError && !timedOut && (
        <p className="text-caption text-warning text-center bg-warning/10 p-2 rounded-md">
          Having trouble checking status — will keep retrying.
        </p>
      )}
      <Stage4HandoffLink
        inviteLink={inviteLink!}
        isPolling={!timedOut}
        onGenerateNew={handleResendInvite}
        onFillInMyself={onFillInMyself}
      />
      <div className="flex items-center justify-start pt-4 border-t border-slate-100">
        <Button variant="outline" onClick={handleBackClick} disabled={isReverting}>
          {isReverting ? 'Going back…' : '← Back'}
        </Button>
      </div>
    </div>
  );
}
