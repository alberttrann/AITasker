import React from 'react';
import { useWalletTransactions } from '@/hooks/use-wallet';
import { useAuth } from '@/hooks/use-auth';
import { ArrowDownRight, ArrowUpRight, Lock, Unlock } from 'lucide-react';
import { formatVND } from '@/lib/utils';
import { format } from 'date-fns';

export function TransactionHistory() {
  const { data: transactions, isLoading } = useWalletTransactions();
  const { user, activeRole } = useAuth();
  const isClient = activeRole === 'CLIENT' || user?.activeRole === 'CLIENT';

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <div className="h-6 w-32 bg-slate-200 rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex justify-between items-center py-4 border-b border-slate-100 last:border-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-5 w-20 bg-slate-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="bg-white p-8 text-center rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
        <p className="text-slate-500 font-medium">No transactions yet</p>
        <p className="text-sm text-slate-400 mt-1">Your top-ups and payments will appear here.</p>
      </div>
    );
  }

  const getTxConfig = (type: string) => {
    switch (type) {
      case 'TOP_UP':
        return { label: 'Bank Top-Up', color: 'text-emerald-600', icon: <ArrowDownRight size={20} strokeWidth={2.5} />, bg: 'bg-emerald-100' };
      case 'SUBSCRIPTION':
        return { label: 'Subscription', color: 'text-red-600', icon: <ArrowUpRight size={20} strokeWidth={2.5} />, bg: 'bg-red-100' };
      case 'ESCROW_LOCK':
        return { label: 'Escrow Locked', color: 'text-yellow-600', icon: <Lock size={20} strokeWidth={2.5} />, bg: 'bg-yellow-100' };
      case 'ESCROW_RELEASE':
        return isClient
          ? { label: 'Escrow Released', color: 'text-blue-600', icon: <Unlock size={20} strokeWidth={2.5} />, bg: 'bg-blue-100' }
          : { label: 'Escrow Released', color: 'text-emerald-600', icon: <ArrowDownRight size={20} strokeWidth={2.5} />, bg: 'bg-emerald-100' };
      case 'WITHDRAWAL':
        return { label: 'Withdrawal', color: 'text-red-600', icon: <ArrowUpRight size={20} strokeWidth={2.5} />, bg: 'bg-red-100' };
      default:
        return { label: 'Transaction', color: 'text-slate-600', icon: <ArrowUpRight size={20} strokeWidth={2.5} />, bg: 'bg-slate-100' };
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
        <h3 className="font-bold text-slate-900">Recent Transactions</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {transactions.map((tx) => {
          const config = getTxConfig(tx.transactionType);
          const isPositive = isClient
            ? tx.transactionType === 'TOP_UP'
            : ['TOP_UP', 'ESCROW_RELEASE'].includes(tx.transactionType);
          
          return (
             <div key={tx.id} className="p-6 flex items-center justify-between gap-6 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className={`p-2 rounded-full ${config.bg} ${config.color} shrink-0`}>
                  {config.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 truncate">{config.label}</p>
                  {tx.details && (
                    <p className="text-xs text-slate-500 mt-1 break-words font-medium leading-relaxed">
                      {tx.details}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 font-mono mt-1">
                    {format(new Date(tx.createdAt), 'MMM d, yyyy • HH:mm')}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-bold ${isPositive ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {isPositive ? '+' : '-'} {formatVND(tx.amount)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
