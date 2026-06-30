import { useState, useEffect, useCallback } from "react";
import Stage4HandoffLink from "./Stage4HandoffLink";
import { inviteTechTeam, getSession, revertSession, handleElicitationError, useElicitation } from "@/hooks/use-elicitation";
import type { Stage4ScenarioBProps } from "@t/ui.types";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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

    setIsSending(true);
    setSendError(null);

    try {
      const res = await inviteTechTeam(sessionId, inviteEmail.trim());
      setInviteLink(res.invite_link);
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
    refetchInterval: (query) => {
      if (!inviteSent || timedOut) return false;
      return query.state?.data?.currentStage >= 5 ? false : POLL_INTERVAL_MS;
    },
    enabled: inviteSent && !timedOut,
  });

  useEffect(() => {
    if (sessionData && sessionData.currentStage >= 5) {
      onTechTeamSubmitted();
    }
  }, [sessionData, onTechTeamSubmitted]);

  // Render: before link generated
  if (!inviteSent) {
    return (
      <div className="mx-auto space-y-4">
        <h2 className="text-lg font-semibold">
          Delegate technical details to your team
        </h2>
        <p className="text-sm text-gray-600">
          We'll generate a secure invite link for your tech team member. You'll
          need to share it with them yourself — there's no automatic email for
          this yet. Once they register and submit, you'll see it update here.
        </p>

        <div className="space-y-2">
          <label htmlFor="tech-team-email" className="text-sm font-medium">
            Tech team member's email
          </label>
          <input
            id="tech-team-email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="name@company.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            disabled={isSending}
          />
          <p className="text-xs text-gray-400">
            Used to link the account once they register — not used to send an
            email.
          </p>
        </div>

        {sendError && <p className="text-sm text-red-600">{sendError}</p>}

        <Button
          onClick={handleGenerateLink}
          disabled={isSending || !inviteEmail.trim()}
          className="w-full"
          variant="primary"
        >
          {isSending ? "Generating link…" : "Generate invite link"}
        </Button>
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" onClick={handleBackClick} disabled={isSending || isReverting}>
            {isReverting ? 'Going back…' : '← Back'}
          </Button>
          <button
            onClick={onFillInMyself}
            className="text-sm text-gray-500 underline"
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
      <div className="mx-auto space-y-4 text-center">
        <h2 className="text-lg font-semibold">
          Still waiting on your tech team
        </h2>
        <p className="text-sm text-gray-600">
          It's been a while since the link for <strong>{inviteEmail}</strong>{" "}
          was generated. You can generate a new one, or fill in the technical
          details yourself instead.
        </p>
        <div className="flex flex-col gap-2">
          <Button
            onClick={handleResendInvite}
            variant="outline"
            className="w-full"
          >
            Generate a new link
          </Button>
          {/* Wizard-level fallback — lets the CEO bail to Stage4ScenarioA */}
          <button
            onClick={onFillInMyself}
            className="text-sm text-gray-500 underline"
          >
            Fill in the details myself instead
          </button>
          <div className="pt-4 flex justify-center">
            <Button variant="outline" onClick={handleBackClick} disabled={isReverting}>
              {isReverting ? 'Going back…' : '← Back'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render: waiting state (link generated, polling in progress)
  return (
    <div className="mx-auto space-y-4">
      {isPollError && !timedOut && (
        <p className="text-xs text-amber-600 text-center">Having trouble checking status — will keep retrying.</p>
      )}
      <Stage4HandoffLink
        inviteLink={inviteLink!}
        isPolling={!timedOut}
        onGenerateNew={handleResendInvite}
        onFillInMyself={onFillInMyself}
      />
      <div className="pt-4">
        <Button variant="outline" onClick={handleBackClick} disabled={isReverting}>
          {isReverting ? 'Going back…' : '← Back'}
        </Button>
      </div>
    </div>
  );
}
