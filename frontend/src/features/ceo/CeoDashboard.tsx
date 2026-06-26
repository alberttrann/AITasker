import { Outlet } from "react-router-dom";
import TopNav from "@/components/layout/TopNav";

import { Sparkles } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";

export function CeoOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const hasSubscription = user?.subscriptionTier === "pro";

  return (
    <div className="w-full">
      {/* Subscription Banner */}
      {!hasSubscription && (
        <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-8 shadow-xl border border-slate-800">
          {/* Subtle graphic background elements */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Glowing orbs */}
            <div className="absolute -right-20 -top-32 h-96 w-96 rounded-full bg-emerald-500/20 blur-[80px]" />
            <div className="absolute top-1/2 left-1/4 h-64 w-64 -translate-y-1/2 rounded-full bg-teal-400/10 blur-[60px]" />
            <div className="absolute -bottom-24 -left-20 h-80 w-80 rounded-full bg-emerald-600/20 blur-[80px]" />

            {/* Dot grid pattern */}
            <svg
              className="absolute inset-0 h-full w-full opacity-[0.04]"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id="banner-grid"
                  width="24"
                  height="24"
                  patternUnits="userSpaceOnUse"
                >
                  <circle
                    cx="2"
                    cy="2"
                    r="1.5"
                    fill="currentColor"
                    className="text-white"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#banner-grid)" />
            </svg>
          </div>

          <div className="relative z-10 w-full flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 min-w-0 text-white sm:pr-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="shrink-0 bg-emerald-500/20 p-1.5 rounded-lg border border-emerald-500/30">
                  <Sparkles className="h-5 w-5 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold sm:text-3xl tracking-tight text-white truncate">
                  Upgrade to Client Pro
                </h2>
              </div>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed mt-1 break-words">
                Supercharge your workflow with AI-powered PRD generation,
                priority matchmaking with elite Tech Teams, and 0% platform fees
                on all milestones.
              </p>
            </div>
            <button
              onClick={() => navigate("/ceo/subscription")}
              className="shrink-0 whitespace-nowrap rounded-xl bg-emerald-500 px-8 py-3.5 font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 active:scale-95"
            >
              Upgrade now
            </button>
          </div>
        </div>
      )}

      {/* Elicitation banner */}
      {hasSubscription && (
        <div className="mt-8 relative overflow-hidden rounded-2xl border-2 border-slate-300 p-8 bg-transparent">
          <h2 className="text-2xl font-bold text-slate-700">Elicitation</h2>
          <p className="text-slate-500 mt-2">
            This section is currently in development.
          </p>
          <button
            onClick={() => navigate("/ceo/elicitation")}
            className="shrink-0 whitespace-nowrap rounded-xl bg-emerald-500 px-8 py-3.5 font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 active:scale-95"
          >
            Start a session
          </button>
        </div>
      )}

      <div className="mt-8 relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center bg-transparent">
        <h2 className="text-2xl font-bold text-slate-700">CEO Dashboard</h2>
        <p className="text-slate-500 mt-2">
          This section is currently in development.
        </p>
      </div>
    </div>
  );
}

export default function CeoDashboard() {
  return (
    <>
      <TopNav />
      <div className="bg-background min-h-screen">
        <div className="w-full max-w-[1440px] mx-auto px-6 py-6 sm:py-8">
          <Outlet />
        </div>
      </div>
    </>
  );
}
