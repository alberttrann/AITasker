import { useMemo } from "react";
import { useAdminAnalytics } from "@/hooks/use-admin";
import { Spinner } from "@/components/ui/Spinner";
import { 
  BarChart3, 
  BrainCircuit, 
  Target, 
  AlertTriangle, 
  CheckCircle2, 
  Briefcase 
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

export default function AnalyticsDashboard() {
  const { data, isLoading, isError } = useAdminAnalytics();

  // Data formatting for Recharts
  const chartData = useMemo(() => {
    if (!data?.active_projects_by_archetype_tier) return [];
    const grouped: Record<string, any> = {};
    data.active_projects_by_archetype_tier.forEach((item: any) => {
      const arch = item.archetype || "Unknown";
      const tier = item.tier || "Standard";
      if (!grouped[arch]) {
        grouped[arch] = { name: arch };
      }
      grouped[arch][tier] = item._count;
    });
    return Object.values(grouped);
  }, [data]);

  const activeTiers = useMemo(() => {
    if (!data?.active_projects_by_archetype_tier) return [];
    const set = new Set<string>();
    data.active_projects_by_archetype_tier.forEach((item: any) => {
      set.add(item.tier || "Standard");
    });
    return Array.from(set).sort();
  }, [data]);

  const TIER_COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6'];

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
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" />
          Platform Analytics
        </h1>
        <p className="text-slate-500 mt-2">
          Real-time metrics on platform health, AI resolution efficiency, and project throughput.
        </p>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Milestone Completion Rate */}
        <MetricCard
          title="Milestone Completion Rate"
          value={formatPct(data.milestone_completion_rate_pct)}
          subtitle="Percentage of milestones successfully released."
          icon={<CheckCircle2 className="h-6 w-6 text-emerald-600" />}
          trend="positive"
          bg="bg-emerald-50"
          border="border-emerald-100"
        />

        {/* Elicitation Completion Rate */}
        <MetricCard
          title="Elicitation Completion Rate"
          value={formatPct(data.elicitation_completion_rate_pct)}
          subtitle="CEOs who successfully finished the AI scoping wizard."
          icon={<Target className="h-6 w-6 text-sky-600" />}
          trend="neutral"
          bg="bg-sky-50"
          border="border-sky-100"
        />

        {/* Portfolio Auto-Upgrade Rate */}
        <MetricCard
          title="Portfolio Approval Rate"
          value={formatPct(data.portfolio_auto_upgrade_rate_pct)}
          subtitle="Experts who successfully passed automated portfolio review."
          icon={<Briefcase className="h-6 w-6 text-blue-600" />}
          trend="neutral"
          bg="bg-blue-50"
          border="border-blue-100"
        />
      </div>

      {/* Dispute & AI Efficiency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <AlertTriangle className="h-32 w-32" />
          </div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Platform Dispute Rate</h3>
          <div className="flex items-end gap-4">
            <span className="text-5xl font-black text-slate-900 tracking-tighter">
              {formatPct(data.dispute_rate_pct)}
            </span>
            <span className="text-sm text-slate-500 pb-2 mb-1">
              of total milestones
            </span>
          </div>
          <p className="mt-4 text-slate-600 text-sm max-w-sm">
            Measures the friction between CEOs and Experts requiring intervention. A lower number indicates healthier engagements.
          </p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-blue-950 p-6 rounded-xl border border-blue-900 shadow-sm relative overflow-hidden text-white">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <BrainCircuit className="h-32 w-32" />
          </div>
          <h3 className="text-sm font-semibold text-blue-300 uppercase tracking-wider mb-2">AI Auto-Resolution Efficiency</h3>
          <div className="flex items-end gap-4">
            <span className="text-5xl font-black text-white tracking-tighter">
              {formatPct(data.dispute_auto_resolve_rate_pct)}
            </span>
            <span className="text-sm text-blue-200 pb-2 mb-1">
              of all disputes
            </span>
          </div>
          <p className="mt-4 text-blue-200 text-sm max-w-sm">
            Percentage of disputes successfully resolved by the Layer 1 AI Eval without requiring human Admin escalation.
          </p>
        </div>
      </div>

      {/* Active Projects Breakdown (Chart) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Active Projects by Archetype & Tier</h2>
            <p className="text-sm text-slate-500 mt-1">Volume distribution of currently running projects.</p>
          </div>
        </div>
        <div className="p-6 h-[400px]">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              No active projects found on the platform.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 13 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 13 }}
                  allowDecimals={false}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend 
                  iconType="circle"
                  wrapperStyle={{ paddingTop: '20px' }}
                />
                {activeTiers.map((tier, index) => (
                  <Bar 
                    key={tier} 
                    dataKey={tier} 
                    fill={TIER_COLORS[index % TIER_COLORS.length]} 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={60}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
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
