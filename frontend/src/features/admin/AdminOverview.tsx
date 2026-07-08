import DashboardGreeting from "@/components/layout/DashboardGreeting";
import Widget, { WidgetMetric } from "@/components/dashboard/Widget";
import { Users, CreditCard, AlertTriangle, Wallet, Activity, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

export default function AdminOverview() {
  // Fetch real data from available admin APIs
  const { data: analytics, isLoading: isLoadingAnalytics } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/analytics');
      return data;
    }
  });

  const { data: disputes, isLoading: isLoadingDisputes } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/disputes');
      return data;
    }
  });

  const { data: withdrawals, isLoading: isLoadingWithdrawals } = useQuery({
    queryKey: ['admin-withdrawals'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/withdrawals?status=PENDING');
      return data;
    }
  });



  const isLoading = isLoadingAnalytics || isLoadingDisputes || isLoadingWithdrawals;

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-primary animate-spin"></div>
      </div>
    );
  }

  // Safely map fetched data to widgets
  const projectMetrics: WidgetMetric[] = [
    { 
      id: 'completion-rate', 
      label: 'Elicitation Complete', 
      value: analytics?.elicitation_completion_rate_pct ? `${Math.round(analytics.elicitation_completion_rate_pct)}%` : '0%', 
      icon: <Zap size={20} />, 
      href: '/admin/analytics' 
    },
    { 
      id: 'milestone-rate', 
      label: 'Milestone Success', 
      value: analytics?.milestone_completion_rate_pct ? `${Math.round(analytics.milestone_completion_rate_pct)}%` : '0%', 
      icon: <Activity size={20} />, 
      href: '/admin/analytics' 
    },
    { 
      id: 'portfolio-upgrade-rate', 
      label: 'Portfolio Upgrade', 
      value: analytics?.portfolio_auto_upgrade_rate_pct ? `${Math.round(analytics.portfolio_auto_upgrade_rate_pct)}%` : '0%', 
      icon: <Activity size={20} />, 
      href: '/admin/analytics' 
    },
    { 
      id: 'dispute-rate', 
      label: 'Dispute Rate', 
      value: analytics?.dispute_rate_pct ? `${Math.round(analytics.dispute_rate_pct)}%` : '0%', 
      icon: <AlertTriangle size={20} />, 
      href: '/admin/analytics' 
    },
    { 
      id: 'auto-resolve-rate', 
      label: 'Auto-Resolve Rate', 
      value: analytics?.dispute_auto_resolve_rate_pct ? `${Math.round(analytics.dispute_auto_resolve_rate_pct)}%` : '0%', 
      icon: <AlertTriangle size={20} />, 
      href: '/admin/analytics' 
    }
  ];



  const disputeMetrics: WidgetMetric[] = [
    { 
      id: 'open-disputes', 
      label: 'Open Disputes', 
      value: disputes ? disputes.filter((d: any) => d.state !== 'RESOLVED').length : 0, 
      subValue: 'Needs attention', 
      icon: <AlertTriangle size={20} />, 
      href: '/admin/disputes' 
    },
    { 
      id: 'resolved-disputes', 
      label: 'Resolved Disputes', 
      value: disputes ? disputes.filter((d: any) => d.state === 'RESOLVED').length : 0, 
      icon: <AlertTriangle size={20} />, 
      href: '/admin/disputes' 
    }
  ];

  const ledgerMetrics: WidgetMetric[] = [
    { 
      id: 'pending-withdraw', 
      label: 'Pending Withdrawals', 
      value: withdrawals ? withdrawals.length : 0, 
      subValue: 'Action required', 
      icon: <Wallet size={20} />, 
      href: '/admin/withdrawals' 
    }
  ];

  return (
    <div className="w-full space-y-8">
      <DashboardGreeting />
      
      <div className="mb-8">
        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1">Workspace</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Widget metrics={projectMetrics} variant="slate" />
          <Widget metrics={disputeMetrics} variant="orange" />
          <Widget metrics={ledgerMetrics} variant="emerald" />
        </div>
      </div>
      
      {/* Space for future sections like charts, lists, etc. */}
    </div>
  );
}
