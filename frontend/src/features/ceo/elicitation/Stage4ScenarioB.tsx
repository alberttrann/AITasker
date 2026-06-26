import { useState, useEffect, useRef, useCallback } from "react";
import Stage4HandoffLink from "./Stage4HandoffLink";
import { inviteTechTeam, getSession } from "@/hooks/use-elicitation";
import type { Stage4ScenarioBProps } from "@t/ui.types";

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
}: Stage4ScenarioBProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const pollHandle = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartedAt = useRef<number | null>(null);

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
    } catch (err: any) {
      setSendError(
        err?.response?.data?.message ??
          "Could not generate the invite link. Please try again.",
      );
    } finally {
      setIsSending(false);
    }
  }, [inviteEmail, sessionId]);

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
  }, []);

  // Polling loop — starts once the invite has been sent
  useEffect(() => {
    if (!inviteSent) return;

    pollStartedAt.current = Date.now();
    setTimedOut(false);
    setPollError(null);

    const checkSession = async () => {
      try {
        const data = await getSession(sessionId);

        // processStage4Handoff advances currentStage to 5 on submission.
        if (data.currentStage >= 5) {
          stopPolling();
          onTechTeamSubmitted();
          return;
        }

        // Clear any transient error now that a poll succeeded.
        setPollError(null);
      } catch (err) {
        // Don't stop polling on a transient network blip — just surface it.
        // If it keeps failing, the person can still see the error and retry manually.
        setPollError("Having trouble checking status — will keep retrying.");
      }

      // Give up after POLL_TIMEOUT_MS so the CEO isn't stuck staring at a
      // spinner forever if the Tech Team never responds.
      if (
        pollStartedAt.current &&
        Date.now() - pollStartedAt.current > POLL_TIMEOUT_MS
      ) {
        stopPolling();
        setTimedOut(true);
      }
    };

    const stopPolling = () => {
      if (pollHandle.current) {
        clearInterval(pollHandle.current);
        pollHandle.current = null;
      }
    };

    // Check immediately, then on the interval.
    checkSession();
    pollHandle.current = setInterval(checkSession, POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [inviteSent, sessionId, onTechTeamSubmitted]);

  // Render: before link generated
  if (!inviteSent) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
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

        <button
          onClick={handleGenerateLink}
          disabled={isSending || !inviteEmail.trim()}
          className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSending ? "Generating link…" : "Generate invite link"}
        </button>
        <div className="text-center pt-2">
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
      <div className="max-w-md mx-auto p-6 space-y-4 text-center">
        <h2 className="text-lg font-semibold">
          Still waiting on your tech team
        </h2>
        <p className="text-sm text-gray-600">
          It's been a while since the link for <strong>{inviteEmail}</strong>{" "}
          was generated. You can generate a new one, or fill in the technical
          details yourself instead.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={handleResendInvite}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium"
          >
            Generate a new link
          </button>
          {/* Wizard-level fallback — lets the CEO bail to Stage4ScenarioA */}
          <button
            onClick={onFillInMyself}
            className="text-sm text-gray-500 underline"
          >
            Fill in the details myself instead
          </button>
        </div>
      </div>
    );
  }

  // Render: waiting state (link generated, polling in progress)
  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      {pollError && <p className="text-xs text-amber-600 text-center">{pollError}</p>}
      <Stage4HandoffLink
        inviteLink={inviteLink!}
        isPolling={!timedOut}
        onGenerateNew={handleResendInvite}
        onFillInMyself={onFillInMyself}
      />
    </div>
  );
}
