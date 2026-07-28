import { useMemo } from "react";
import { useAdminAnalytics } from "@/hooks/use-admin";
import { useArchetypes } from "@/hooks/use-config";
import { Spinner } from "@/components/ui/Spinner";
import { 
  BarChart3, 
  BrainCircuit, 
  Target, 
  AlertTriangle, 
  CheckCircle2, 
  Briefcase 
} from "lucide-react";

export default function AnalyticsDashboard() {
  const { data, isLoading, isError } = useAdminAnalytics();
  const { data: archetypes } = useArchetypes();

  const getArchetypeLabel = (code: string) => {
    if (!code) return 'Standard Archetype';
    const found = archetypes?.find(a => a.code === code || a.id === code);
    if (found && (found.name || (found as any).archetypeName)) {
      return found.name || (found as any).archetypeName;
    }
    return code
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          Failed to load analytics data.
        </div>
      </div>
    );
  }

  // Helper to format percentage safely
  const formatPct = (val: any) => {
    if (typeof val !== "number") return "0%";
    return `${val.toFixed(1)}%`;
  };

  return (
    <div className="w-full max-w-[1440px] px-6 mx-auto py-8 space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-headline font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          Platform Analytics
        </h1>
        <p className="text-slate-500 mt-1 text-sm font-medium">
          Real-time metrics on platform health, AI resolution efficiency, and project distribution across archetypes.
        </p>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Milestone Completion Rate */}
        <MetricCard
          title="Milestone Completion Rate"
          value={formatPct(data.milestone_completion_rate_pct)}
          subtitle="Percentage of milestones successfully released."
          icon={<CheckCircle2 className="h-6 w-6 text-emerald-600" />}
          bg="bg-emerald-50/60"
          border="border-emerald-100"
        />

        {/* Elicitation Completion Rate */}
        <MetricCard
          title="Elicitation Completion Rate"
          value={formatPct(data.elicitation_completion_rate_pct)}
          subtitle="CEOs who finished the AI scoping wizard."
          icon={<Target className="h-6 w-6 text-sky-600" />}
          bg="bg-sky-50/60"
          border="border-sky-100"
        />

        {/* Portfolio Auto-Upgrade Rate */}
        <MetricCard
          title="Portfolio Approval Rate"
          value={formatPct(data.portfolio_auto_upgrade_rate_pct)}
          subtitle="Experts passing automated portfolio review."
          icon={<Briefcase className="h-6 w-6 text-blue-600" />}
          bg="bg-blue-50/60"
          border="border-blue-100"
        />

        {/* Active Project Configurations */}
        <MetricCard
          title="Active Archetype Groups"
          value={data.active_projects_by_archetype_tier?.length ?? 0}
          subtitle="Unique archetype & tier combinations."
          icon={<BarChart3 className="h-6 w-6 text-purple-600" />}
          bg="bg-purple-50/60"
          border="border-purple-100"
        />
      </div>

      {/* Dispute & AI Efficiency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <AlertTriangle className="h-32 w-32" />
          </div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Platform Dispute Rate</h3>
          <div className="flex items-end gap-4">
            <span className="text-5xl font-extrabold text-slate-900 tracking-tight">
              {formatPct(data.dispute_rate_pct)}
            </span>
            <span className="text-sm text-slate-500 pb-2 font-medium">
              of total milestones
            </span>
          </div>
          <p className="mt-4 text-slate-600 text-sm leading-relaxed">
            Measures the friction between CEOs and Experts requiring intervention. A lower number indicates healthier engagements.
          </p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-6 rounded-xl border border-slate-800 shadow-sm relative overflow-hidden text-white">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <BrainCircuit className="h-32 w-32" />
          </div>
          <h3 className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-2">AI Auto-Resolution Efficiency</h3>
          <div className="flex items-end gap-4">
            <span className="text-5xl font-extrabold text-white tracking-tight">
              {formatPct(data.dispute_auto_resolve_rate_pct)}
            </span>
            <span className="text-sm text-blue-200 pb-2 font-medium">
              of total disputes
            </span>
          </div>
          <p className="mt-4 text-blue-200 text-sm leading-relaxed">
            Percentage of disputes successfully resolved by the Layer 1 AI Engine without requiring manual Admin intervention.
          </p>
        </div>
      </div>

      {/* Active Projects by Archetype & Tier Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div>
          <h3 className="text-lg font-headline font-bold text-slate-900">
            Published Projects by Archetype & Tier
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Breakdown of active published projects categorized by AI archetype specifications and complexity tier.
          </p>
        </div>

        {!data.active_projects_by_archetype_tier || data.active_projects_by_archetype_tier.length === 0 ? (
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-6 text-center text-slate-500 text-sm">
            No active published projects currently grouped by archetype & tier.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.active_projects_by_archetype_tier.map((item: any, idx: number) => {
              const archetypeLabel = getArchetypeLabel(item.archetype);
              const tierLabel = item.tier 
                ? item.tier.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') 
                : 'Standard Tier';

              return (
                <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex items-center justify-between hover:bg-slate-100/60 transition-colors">
                  <div className="space-y-1 min-w-0 pr-3">
                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-blue-100 text-blue-800 border border-blue-200">
                      {tierLabel}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 truncate" title={archetypeLabel}>
                      {archetypeLabel}
                    </h4>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-2xl font-black text-slate-900 block leading-none">
                      {item._count}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      {item._count === 1 ? 'Project' : 'Projects'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper Component ──
function MetricCard({ title, value, subtitle, icon, bg, border }: any) {
  return (
    <div className={`p-6 rounded-xl border shadow-sm ${bg} ${border} relative overflow-hidden transition-all hover:shadow-md`}>
      <div className="flex justify-between items-start mb-4 relative z-10">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">{title}</h3>
        <div className="p-2 bg-white rounded-lg shadow-sm">
          {icon}
        </div>
      </div>
      <div className="relative z-10">
        <span className="text-4xl font-black text-slate-900 tracking-tighter block">{value}</span>
        <span className="text-sm text-slate-600 mt-2 block">{subtitle}</span>
      </div>
    </div>
  );
}
