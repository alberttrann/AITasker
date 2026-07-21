import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Clipboard, Check, AlertCircle, Hourglass, Loader2, Link2, KeyRound } from 'lucide-react';

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
    <div className="space-y-8 max-w-2xl mx-auto py-4">
      <div className="text-center">
        <h2 className="text-h2 font-headline text-primary">Technical Handoff</h2>
        <p className="mt-2 text-body text-secondary max-w-md mx-auto">
          Share this private link with your technical lead so they can securely complete the architecture requirements.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md hover:border-slate-300">
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="bg-blue-50 text-blue-600 p-2.5 rounded-lg shrink-0">
              <Link2 className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-base">Secure Handoff Link</p>
              <p className="text-sm text-slate-500">Copy and share this link via Slack, Teams, or email.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5 pl-4 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
            <input
              readOnly
              value={inviteLink}
              className="flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none truncate"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button variant={copied ? "outline" : "primary"} className="shrink-0 min-w-[100px]" onClick={handleCopy}>
              {copied ? <><Check className="w-4 h-4 mr-2" /> Copied</> : <><Clipboard className="w-4 h-4 mr-2" /> Copy Link</>}
            </Button>
          </div>

          <div className="flex items-start gap-3 bg-amber-50 text-amber-800 p-4 rounded-lg text-sm border border-amber-100">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
            <p className="leading-relaxed">This link contains temporary access tokens and <strong>expires in 72 hours</strong>. Please do not share it publicly.</p>
          </div>
        </div>

        <div className="bg-slate-50/80 border-t border-slate-100 p-8 flex flex-col items-center justify-center text-center">
          {isPolling ? (
            <>
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
                <Loader2 className="relative h-10 w-10 animate-spin text-primary" />
              </div>
              <p className="font-semibold text-slate-900">Awaiting Submission</p>
              <p className="text-sm text-slate-500 mt-2 max-w-sm">
                Leave this page open. It will automatically advance as soon as your technical lead submits their requirements.
              </p>
            </>
          ) : (
            <>
              <Hourglass className="w-10 h-10 text-slate-400 mb-4 opacity-50" />
              <p className="font-semibold text-slate-900">Link Ready</p>
              <p className="text-sm text-slate-500 mt-2">Waiting for tech lead activity...</p>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-2">
        <button onClick={onFillInMyself} className="text-sm font-semibold text-slate-500 hover:text-primary transition-colors flex items-center gap-2">
          Actually, I'll fill it in myself
        </button>
        <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-slate-300"></div>
        <button onClick={onGenerateNew} className="text-sm font-semibold text-slate-500 hover:text-warning transition-colors flex items-center gap-2">
          Revoke & Generate New Link
        </button>
      </div>
    </div>
  );
}
