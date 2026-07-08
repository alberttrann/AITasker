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

  const { data: packages, isLoading: isLoadingPackages } = useQuery({
    queryKey: ['admin-subscription-packages'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/subscriptions/packages');
      return data;
    }
  });

  const isLoading = isLoadingAnalytics || isLoadingDisputes || isLoadingWithdrawals || isLoadingPackages;

  if (isLoading) {
    return (
      <div className="p-md sm:p-lg flex items-center justify-center min-h-[400px]">
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

  const subscriptionMetrics: WidgetMetric[] = [
    { 
      id: 'active-packages', 
      label: 'Subscription Packages', 
      value: packages ? packages.length : 0, 
      subValue: 'Active and available',
      icon: <CreditCard size={20} />, 
      href: '/admin/packages'
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
    <div className="p-md sm:p-lg">
      <DashboardGreeting />
      
      <div className="mt-8 mb-4">
        <h2 className="text-xl font-bold font-headline text-slate-900">Workspace</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Widget metrics={projectMetrics} variant="slate" />
        <Widget metrics={subscriptionMetrics} variant="blue" />
        <Widget metrics={disputeMetrics} variant="orange" />
        <Widget metrics={ledgerMetrics} variant="emerald" />
      </div>
      
      {/* Space for future sections like charts, lists, etc. */}
    </div>
  );
}
