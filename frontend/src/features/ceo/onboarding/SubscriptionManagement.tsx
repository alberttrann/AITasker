import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { useUser } from '@/hooks/use-user';
import { useSubscriptionStatus, useSubscriptionHistory } from '@/hooks/use-subscription';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useWallet } from '@/hooks/use-wallet';
import { formatVND } from '@/lib/utils';
import { Check, Sparkles, Zap, Shield, ChevronRight, History, ChevronUp, ChevronDown, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/layout/Table';

export default function SubscriptionActivate() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const store = useAuthStore();
  const { user } = store;
  const { data: wallet } = useWallet();
  const { data: subStatus } = useSubscriptionStatus();
  const { data: historyLogs, isLoading: isLoadingHistory } = useSubscriptionHistory();

  const [showSuccessBanner, setShowSuccessBanner] = useState(!!location.state?.success);
  const [sortColumn, setSortColumn] = useState<'packageName' | 'purchasedAt' | 'expiresAt' | 'amountPaidVnd'>('purchasedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: 'packageName' | 'purchasedAt' | 'expiresAt' | 'amountPaidVnd') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedHistoryLogs = historyLogs ? [...historyLogs].sort((a, b) => {
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];
    
    if (sortColumn === 'purchasedAt' || sortColumn === 'expiresAt') {
      const dateA = new Date(aValue as string).getTime();
      const dateB = new Date(bValue as string).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    }
    
    if (sortColumn === 'amountPaidVnd') {
      const numA = Number(aValue);
      const numB = Number(bValue);
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    }
    
    const strA = String(aValue).toLowerCase();
    const strB = String(bValue).toLowerCase();
    return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  }) : [];

  const availableBalance = (wallet as any)?.availableBalance ?? (wallet as any)?.available_balance ?? 0;

  const getRemainingTime = () => {
    if (!subStatus?.expiresAt) return 'N/A';
    const expires = new Date(subStatus.expiresAt);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();
    if (diff <= 0) return 'Expired';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days >= 1) return `${days} day${days > 1 ? 's' : ''}`;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours >= 1) return `${hours} hour${hours > 1 ? 's' : ''}`;
    
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };

  const isPro = subStatus?.tier === 'pro';

  return (
    <div className="w-full max-w-[1440px] mx-auto px-6 py-12 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <h1 className="text-3xl font-headline font-extrabold text-slate-900">
          Subscription Management
        </h1>
        <Button variant="primary" onClick={() => navigate('/ceo/subscriptions/plans')} className="flex items-center gap-2 px-6 font-bold">
          <Sparkles size={18} />
          View Premium Plans
        </Button>
      </div>

      {showSuccessBanner && (
        <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-emerald-100 rounded-full text-emerald-600">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 className="font-bold text-emerald-800">Subscription Activated!</h3>
              <p className="text-sm text-emerald-600">Your new plan has been successfully activated and is now ready to use.</p>
            </div>
          </div>
          <button onClick={() => setShowSuccessBanner(false)} className="p-2 hover:bg-emerald-100/80 rounded-lg text-emerald-600 transition-colors">
            <X size={20} />
          </button>
        </div>
      )}
      
      <div className="mb-12">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Current Plan</h2>
        <div className={`rounded-2xl border p-8 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden ${
          isPro 
            ? 'bg-gradient-to-r from-emerald-950 to-emerald-900 border-emerald-800' 
            : 'bg-gradient-to-r from-slate-900 to-slate-800 border-slate-700'
        }`}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl font-extrabold text-white">
                {isPro ? 'Client Pro' : 'Client Basic'}
              </span>
              {isPro && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Active
                </span>
              )}
            </div>
            <p className="text-slate-300 font-medium">
              {isPro ? 'You are currently on the premium tier.' : 'You are currently on the free tier.'}
            </p>
          </div>
          
          {isPro ? (
            <div className="flex flex-col md:items-end gap-4 md:ml-0">
              <div className="text-left md:text-right">
                <span className="text-sm font-bold text-emerald-200/70 uppercase tracking-widest block mb-1">Time until expiration</span>
                <span className={`text-lg font-bold ${getRemainingTime() === 'Expired' ? 'text-red-400' : 'text-emerald-400'}`}>{getRemainingTime()}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:items-end gap-4 md:ml-0">
              <Button onClick={() => navigate('/ceo/subscriptions/plans')} className="flex items-center gap-2 !bg-white hover:!bg-slate-100 !text-slate-900 font-bold border-none shadow-sm transition-all hover:-translate-y-1 hover:shadow-white/10">
                <Sparkles size={16} />
                View Plans
              </Button>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Subscription History</h2>
        {isLoadingHistory ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-sm flex items-center justify-center">
            <span className="text-slate-500 font-medium">Loading history...</span>
          </div>
        ) : (
          <DataTable
            columns={[
              { key: 'packageName', label: 'Plan', sortable: true },
              { key: 'purchasedAt', label: 'Purchased At', sortable: true, render: (log: any) => new Date(log.purchasedAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
              { key: 'expiresAt', label: 'Expires At', sortable: true, render: (log: any) => new Date(log.expiresAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
              { key: 'amountPaidVnd', label: 'Price', sortable: true, render: (log: any) => formatVND(Number(log.amountPaidVnd)) }
            ]}
            data={sortedHistoryLogs || []}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={(key) => handleSort(key as any)}
            keyExtractor={(log: any) => log.id}
            emptyState={
              <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-sm flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4">
                  <History size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">No history available yet</h3>
                <p className="text-slate-500 max-w-sm">Your past subscription renewals and invoices will appear here.</p>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
