import { useState, useEffect, useMemo } from "react";
import { usePlatformSettings, useUpdatePlatformSettings, useAdminTransactions } from "@/hooks/use-admin";
import { calculateMonthlyRevenue, formatVND } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import {
  Banknote,
  Percent,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Calendar,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PlatformSettings() {
  const { data: settings, isLoading, isError, refetch } = usePlatformSettings();
  const updateSettings = useUpdatePlatformSettings();

  const [feePct, setFeePct] = useState<number>(5);
  const [saved, setSaved] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [startDateFilter, setStartDateFilter] = useState<string>("");

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const { data: transactions } = useAdminTransactions({ type: 'PLATFORM_FEE' });

  const monthlyRevenueData = useMemo(() => {
    return calculateMonthlyRevenue(transactions || [], selectedYear);
  }, [transactions, selectedYear]);

  // Calculate total revenue & earliest date since selected start date
  const { totalRevenue, earliestDate, filteredCount } = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return { totalRevenue: 0, earliestDate: null, filteredCount: 0 };
    }

    let sum = 0;
    let minDateMs = Infinity;
    let count = 0;
    const filterMs = startDateFilter ? new Date(startDateFilter).getTime() : 0;

    transactions.forEach((tx: any) => {
      const txDateMs = new Date(tx.createdAt || tx.created_at || Date.now()).getTime();
      if (txDateMs >= filterMs) {
        const amt = Number(tx.amount || tx.amount_vnd || tx.amountVnd || 0);
        sum += amt;
        count++;
        if (txDateMs < minDateMs) {
          minDateMs = txDateMs;
        }
      }
    });

    return {
      totalRevenue: sum,
      earliestDate: minDateMs !== Infinity ? new Date(minDateMs) : null,
      filteredCount: count,
    };
  }, [transactions, startDateFilter]);

  // Sync local state when data loads
  useEffect(() => {
    if (settings?.platform_fee_pct != null) {
      setFeePct(Math.round(settings.platform_fee_pct * 100));
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate(
      { platform_fee_pct: feePct / 100 },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full max-w-[1440px] px-6 mx-auto space-y-6 animate-in fade-in duration-500">
        <ErrorBanner
          message="Failed to load platform settings."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const currentFeePct = settings?.platform_fee_pct != null
    ? (settings.platform_fee_pct * 100).toFixed(1)
    : "5.0";
  const isPending = updateSettings.isPending;

  return (
    <div className="w-full max-w-[1440px] px-6 mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header with Banknote Icon (same as sidebar) */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
          <Banknote className="h-8 w-8 text-emerald-600" />
          Platform Revenue
        </h1>
        <p className="text-slate-500 mt-2">
          Track accumulated platform revenue and configure fee percentage parameters.
        </p>
      </div>

      {/* Total Revenue Summary Card */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white rounded-2xl border border-emerald-900/40 shadow-md p-6 sm:p-8 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 opacity-10 pointer-events-none">
          <Banknote className="h-56 w-56 text-emerald-400" />
        </div>

        <div className="space-y-2 z-10">
          <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-widest block">
            Total Revenue Collected
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            {formatVND(totalRevenue)}
          </h2>
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5 flex-wrap">
            <Clock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            {startDateFilter ? (
              <span>
                Total revenue collected since <strong className="text-slate-200">{new Date(startDateFilter).toLocaleDateString()}</strong>
              </span>
            ) : earliestDate ? (
              <span>
                Total revenue collected since <strong className="text-slate-200">{earliestDate.toLocaleDateString()}</strong>
              </span>
            ) : (
              <span>Total revenue collected across all transactions</span>
            )}
          </p>
        </div>

        {/* Date Filter & Transaction Stat Box */}
        <div className="z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3.5 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Calculate Since Date
              </label>
              <input
                type="date"
                max={todayStr}
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-white border-none outline-none focus:ring-0 cursor-pointer p-0 [color-scheme:dark]"
              />
            </div>
            {startDateFilter && (
              <button
                type="button"
                onClick={() => setStartDateFilter("")}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/80 rounded-lg transition-colors ml-1 cursor-pointer shrink-0"
                title="Reset to all-time earliest date"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-center gap-3 shrink-0">
            <Banknote className="h-6 w-6 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">
                Fee Deposits
              </span>
              <span className="text-base font-bold text-white">
                {filteredCount} Transactions
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Info className="h-4 w-4 text-emerald-600" />
            Monthly Revenue Breakdown
          </h2>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-sm border-slate-200 rounded-lg text-slate-700 bg-slate-50 px-3 py-1.5 font-medium"
          >
            {[...Array(5)].map((_, i) => {
              const year = new Date().getFullYear() - i;
              return (
                <option key={year} value={year}>
                  Year {year}
                </option>
              );
            })}
          </select>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthlyRevenueData}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="month" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickFormatter={(value) => `₫${(value / 1000000).toFixed(0)}M`}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any) => [new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value)), 'Revenue']}
              />
              <Bar 
                dataKey="revenue" 
                fill="#10b981" 
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fee Settings */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-6 flex items-center gap-2">
          <Percent className="h-4 w-4 text-emerald-600" />
          Platform Fee Configuration
        </h2>

        {/* Current value display */}
        <div className="mb-6 p-4 bg-slate-50 border border-slate-100 rounded-lg">
          <p className="text-xs text-slate-400 mb-1">Current Fee Percentage</p>
          <p className="text-2xl font-bold text-slate-900">
            {currentFeePct}%
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Charged on each milestone release
          </p>
        </div>

        {/* Slider + input */}
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            New Fee Percentage
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={0}
              max={20}
              step={0.5}
              value={feePct}
              onChange={(e) => setFeePct(Number(e.target.value))}
              disabled={isPending}
              className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50"
            />
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <input
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={feePct}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!isNaN(v)) setFeePct(Math.min(20, Math.max(0, v)));
                }}
                disabled={isPending}
                className="w-16 text-center text-sm font-semibold text-slate-900 bg-transparent border-none outline-none disabled:opacity-50"
              />
              <span className="text-sm text-slate-500 font-medium">%</span>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Range: 0% – 20%. The fee is deducted from the milestone payment when
            the escrow is released to the expert.
          </p>
        </div>

        {/* Save button */}
        <div className="mt-8 flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={isPending || feePct === Math.round((settings?.platform_fee_pct ?? 0.05) * 100)}
            className="min-w-[140px]"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>

          {/* Success toast */}
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg animate-in fade-in">
              <CheckCircle2 className="h-4 w-4" />
              Settings saved
            </span>
          )}

          {/* Error */}
          {updateSettings.isError && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              Failed to save
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
