import { useState, useEffect, useMemo } from "react";
import { usePlatformSettings, useUpdatePlatformSettings, useAdminTransactions } from "@/hooks/use-admin";
import { calculateMonthlyRevenue } from "@/lib/utils";
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
  Settings,
  Percent,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PlatformSettings() {
  const { data: settings, isLoading, isError, refetch } = usePlatformSettings();
  const updateSettings = useUpdatePlatformSettings();

  const [feePct, setFeePct] = useState<number>(5);
  const [saved, setSaved] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const { data: transactions } = useAdminTransactions({ type: 'PLATFORM_FEE' });

  const monthlyRevenueData = useMemo(() => {
    return calculateMonthlyRevenue(transactions || [], selectedYear);
  }, [transactions, selectedYear]);

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
      <div className="space-y-6 max-w-[1440px] mx-auto animate-in fade-in duration-500">
        <ErrorBanner
          message="Failed to load platform settings."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const platformWalletId = settings?.platform_wallet_id || "—";
  const currentFeePct = settings?.platform_fee_pct != null
    ? (settings.platform_fee_pct * 100).toFixed(1)
    : "5.0";
  const isPending = updateSettings.isPending;

  return (
    <div className="space-y-6 max-w-[720px] mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Settings className="h-8 w-8 text-slate-600" />
          Platform Revenue
        </h1>
        <p className="text-slate-500 mt-2">
          Configure platform-wide parameters. Changes take effect on the next
          milestone approval.
        </p>
      </div>

      {/* Platform Wallet Info */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Info className="h-4 w-4" />
            Revenue
          </h2>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-sm border-slate-200 rounded-lg text-slate-700 bg-slate-50"
          >
            {[...Array(5)].map((_, i) => {
              const year = new Date().getFullYear() - i;
              return (
                <option key={year} value={year}>
                  {year}
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
                formatter={(value: number) => [new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value), 'Revenue']}
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
          <Percent className="h-4 w-4" />
          Platform Fee
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
