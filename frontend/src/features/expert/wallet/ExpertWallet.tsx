import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/use-auth';
import { useWallet, useUserProfile, useWithdrawalHistory, useCancelWithdrawal } from '@/hooks/use-wallet';
import { TransactionHistory } from '@/components/wallet/TransactionHistory';
import WalletTopUp from '@/features/ceo/onboarding/WalletTopUp';
import { formatVND } from '@/lib/utils';
import { ConfirmModal } from '@/components/ui/modal';
import { useSubscriptionStatus } from '@/hooks/use-subscription';
import {
  Wallet,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Landmark,
  LinkIcon,
  ArrowUpRight,
  ShieldCheck,
  XCircle,
  Loader2,
  X,
  ArrowDownToLine
} from 'lucide-react';

export default function ExpertWallet() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const [showProExpiry, setShowProExpiry] = useState(false);

  const { data: subStatus } = useSubscriptionStatus();

  const availableBalance = wallet?.availableBalance ?? 0;
  const lockedBalance = wallet?.lockedBalance ?? 0;

  // Determine bank linked status from user profile
  const isBankLinked = !!(
    profile?.sepay_bank_account_xid || profile?.bank_linked_at
  );

  const initial = user?.fullName ? user.fullName.charAt(0).toUpperCase() : '?';

  return (
    <div className="py-10 px-4 sm:px-6 max-w-[1440px] mx-auto w-full">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Wallet className="text-slate-500" size={24} />
          Expert Wallet
        </h1>
      </div>

      {/* ─── Balance & Profile Card ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden mb-6">
        {/* Profile Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
          <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-900 text-white flex items-center justify-center text-lg font-bold shadow-sm">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight break-words flex items-center gap-3">
              {user?.fullName || 'Anonymous User'}
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 bg-slate-900 text-white text-[11px] font-bold rounded-md tracking-wide uppercase">
                  Expert
                </span>
                {subStatus?.tier && subStatus.tier !== 'free' && (
                  <div className="relative flex items-center">
                    <button 
                      onClick={() => setShowProExpiry(!showProExpiry)}
                      onBlur={() => setShowProExpiry(false)}
                      className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-md tracking-wide uppercase hover:opacity-90 transition-opacity"
                    >
                      {subStatus.tier}
                    </button>
                    {showProExpiry && (subStatus?.expiresAt || user?.subscriptionExpires) && (
                      <div className="absolute top-full left-0 mt-2 w-max px-3 py-1.5 bg-slate-800 text-white text-[11px] font-medium rounded-md shadow-lg z-10 animate-in fade-in slide-in-from-top-1">
                        Expires on: {new Date(subStatus?.expiresAt || user?.subscriptionExpires || '').toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}
                {subStatus?.tier === 'free' && (
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-md tracking-wide uppercase">
                    FREE TIER
                  </span>
                )}
              </div>
            </h2>
          </div>
        </div>

        {/* Balance Cards */}
        {walletLoading ? (
          <div className="p-8 flex items-center justify-center gap-3 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-medium">Loading balances…</span>
          </div>
        ) : (
          <div className="p-8 flex flex-col sm:flex-row gap-6">
            {/* Available Balance */}
            <div className="flex-1 bg-emerald-50/50 border border-emerald-100 rounded-xl p-6 transition-all hover:bg-emerald-50">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <CheckCircle2 size={20} strokeWidth={2.5} />
                </div>
                <p className="text-sm font-semibold text-emerald-800 uppercase tracking-wider">
                  Available Balance
                </p>
              </div>
              <p className="text-4xl font-bold text-slate-900 mb-3">
                {formatVND(availableBalance)}
              </p>
              <p className="text-sm text-emerald-700/80 leading-relaxed">
                Earned from completed milestones. Ready to withdraw to your
                linked bank account.
              </p>
            </div>

            {/* Locked Balance */}
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-6 transition-all hover:bg-slate-100/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-slate-200 text-slate-600 rounded-lg">
                  <Lock size={20} strokeWidth={2.5} />
                </div>
                <p className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                  Locked Balance
                </p>
              </div>
              <p className="text-4xl font-bold text-slate-600 mb-3">
                {formatVND(lockedBalance)}
              </p>
              <p className="text-sm text-slate-500 leading-relaxed">
                Funds held in active milestone escrows. Released upon client
                approval.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Bank Account Status Card ───────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden mb-6">
        <div className="p-6 sm:p-8">
          <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
            {/* Left: Status Info */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div
                className={`shrink-0 p-3 rounded-xl ${
                  isBankLinked
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-amber-100 text-amber-600'
                }`}
              >
                <Landmark size={24} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  Bank Account
                  {profileLoading ? (
                    <Loader2
                      size={16}
                      className="animate-spin text-slate-400"
                    />
                  ) : isBankLinked ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                      <ShieldCheck size={12} strokeWidth={3} />
                      Linked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                      <XCircle size={12} strokeWidth={3} />
                      Not Linked
                    </span>
                  )}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {isBankLinked
                    ? `SePay account linked (${profile?.sepay_bank_account_xid ?? '—'}). You can receive payouts.`
                    : 'Link your bank account via SePay Bank Hub to receive payments from completed milestones.'}
                </p>
              </div>
            </div>

            {/* Right: Action Button */}
            <div className="shrink-0 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {!isBankLinked ? (
                <button
                  onClick={() => navigate('/expert/wallet/link-bank')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-all hover:shadow-md active:scale-[0.98]"
                >
                  <LinkIcon size={16} strokeWidth={2.5} />
                  Link Bank Account
                </button>
              ) : (
                <button
                  onClick={() => navigate('/expert/wallet/withdraw')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-all hover:shadow-md active:scale-[0.98]"
                >
                  <ArrowUpRight size={16} strokeWidth={2.5} />
                  Withdraw to Bank
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Transaction History & Top-Up ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <div className="lg:col-span-2 space-y-6">
          <TransactionHistory />
          <WithdrawalHistoryList />
        </div>
        <div className="lg:col-span-1">
          <WalletTopUp showContinue={false} />
        </div>
      </div>
    </div>
  );
}

// ─── Withdrawal History Sub-Component ─────────────────────────────────

function WithdrawalHistoryList() {
  const { data: withdrawals, isLoading } = useWithdrawalHistory();
  const cancelWithdrawal = useCancelWithdrawal();
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <div className="h-6 w-40 bg-slate-200 rounded animate-pulse mb-6" />
        <div className="flex justify-center py-4"><Loader2 className="animate-spin text-slate-300" /></div>
      </div>
    );
  }

  if (!withdrawals || withdrawals.length === 0) {
    return null; // Hide the whole section if they've never withdrawn
  }

  const handleCancel = () => {
    if (!cancelTarget) return;
    cancelWithdrawal.mutate(cancelTarget.id, {
      onSuccess: () => setCancelTarget(null)
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
        <h3 className="font-bold text-slate-900">Withdrawal Requests</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {withdrawals.map((w: any) => {
          const isAuto = w.type === 'MILESTONE_RELEASE';
          const title = isAuto ? 'Auto-Payout (Milestone Release)' : 'Manual Withdrawal';
          const subTitle = isAuto && w.milestoneId ? `Milestone ID: ${String(w.milestoneId).slice(0,8)}` : `To: ${w.bankAccountXid}`;
          
          let statusBadge = null;
          switch (w.status) {
            case 'PENDING': statusBadge = <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Pending</span>; break;
            case 'COMPLETED': statusBadge = <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Completed</span>; break;
            case 'FAILED': statusBadge = <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">Failed</span>; break;
            case 'CANCELLED': statusBadge = <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Cancelled</span>; break;
          }

          return (
            <div key={w.id} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4 flex-1">
                <div className={`p-2 rounded-full shrink-0 ${isAuto ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
                  <ArrowDownToLine size={20} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-slate-900 truncate">{title}</p>
                    {statusBadge}
                  </div>
                  <p className="text-xs text-slate-500 font-medium">{subTitle}</p>
                  <p className="text-xs text-slate-400 mt-1">Requested: {new Date(w.requestedAt || w.requested_at).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between w-full sm:w-auto gap-4 sm:flex-col sm:items-end sm:gap-2">
                <p className="font-bold text-slate-900">{formatVND(Number(w.amount))}</p>
                {w.status === 'PENDING' && (
                  <button 
                    onClick={() => setCancelTarget(w)}
                    className="text-xs font-semibold text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors"
                  >
                    <X size={14} /> Cancel
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <ConfirmModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Cancel Withdrawal"
        confirmText="Yes, Cancel"
        isDestructive
      >
        {cancelTarget?.type === 'MILESTONE_RELEASE' 
          ? "This will cancel the automatic payout and keep the funds safely in your AITasker wallet instead. You can manually withdraw them to your bank later. Are you sure?"
          : "Are you sure you want to cancel this withdrawal? The funds will be returned to your available wallet balance immediately."}
      </ConfirmModal>
    </div>
  );
}
