import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Clipboard, Check, AlertTriangle, Hourglass, Loader2 } from 'lucide-react';

interface HandoffLinkProps {
  inviteLink: string;
  isPolling: boolean;
  onGenerateNew: () => void;
  onFillInMyself: () => void;
}

export default function Stage4HandoffLink({
  inviteLink,
  isPolling,
  onGenerateNew,
  onFillInMyself,
}: HandoffLinkProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6 text-center">
      <div>
        <h2 className="text-h2 font-headline text-primary">Stage 4 of 5</h2>
        <p className="text-body-sm text-secondary">Invite Your Tech Team</p>
      </div>

      {/* Share link section */}
      <div className="space-y-3">
        <p className="text-body font-medium text-primary flex items-center justify-center gap-2">
          <Clipboard className="w-5 h-5" /> Share this link with your technical team member:
        </p>

        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-primary-bg px-4 py-3">
          <input
            readOnly
            value={inviteLink}
            className="flex-1 bg-transparent text-body-sm text-secondary outline-none"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button variant="primary" size="sm" onClick={handleCopy}>
            {copied ? <><Check className="w-4 h-4 mr-1 inline" /> Copied!</> : <><Clipboard className="w-4 h-4 mr-1 inline" /> Copy Link</>}
          </Button>
        </div>

        <p className="text-caption text-secondary flex items-start justify-center gap-1">
          <AlertTriangle className="w-4 h-4 shrink-0" /> 
          <span>This link expires in 72 hours. Share via Slack, Zalo, or email — no automatic sending.</span>
        </p>
      </div>

      <hr className="border-slate-200" />

      {/* Waiting message */}
      <div className="space-y-3">
        {isPolling && (
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        )}
        <p className="text-body-sm text-secondary flex items-center justify-center gap-2">
          <Hourglass className="w-4 h-4" /> Waiting for your Tech Team to complete Stage 4…
        </p>
        <p className="text-caption text-secondary">
          (Auto-advancing when they submit — polling every 5s)
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="secondary" onClick={onGenerateNew}>
          Generate New Link
        </Button>
        <Button variant="ghost" onClick={onFillInMyself}>
          Fill in Myself
        </Button>
      </div>
    </div>
  );
}
