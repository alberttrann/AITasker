import { Link2Off } from 'lucide-react';
import { Link } from 'react-router-dom';

export function LinkExpiredError() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 sm:p-6 bg-slate-50">
      <div className="relative w-full max-w-md bg-white sm:rounded-[24px] shadow-sm border border-slate-100 animate-in fade-in zoom-in-95 duration-200 overflow-hidden text-center p-8 sm:p-12">
        <div className="mx-auto w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
          <Link2Off size={32} strokeWidth={2} />
        </div>
        
        <h2 className="text-2xl font-headline font-bold text-slate-900 mb-3">
          Link Expired or Invalid
        </h2>
        <p className="text-slate-500 font-body text-sm leading-relaxed mb-8">
          This tech-team invitation link has expired, already been used, or was superseded by a newer one. Please ask your CEO or project manager to generate a new invitation link for you.
        </p>

        <Link
          to="/"
          className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors"
        >
          Return to Homepage
        </Link>
      </div>
    </div>
  );
}
