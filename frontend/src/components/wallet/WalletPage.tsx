import { useAuth } from '@hooks/use-auth';
import { useNavigate } from 'react-router-dom';
import { TransactionHistory } from './TransactionHistory';
import WalletTopUp from '@/features/ceo/onboarding/WalletTopUp';
import { Wallet, CheckCircle2, Lock, ArrowLeft } from 'lucide-react';
import { formatVND } from '@/lib/utils';
import { useWallet } from '@/hooks/use-wallet';

export default function WalletPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const initial = user?.fullName ? user.fullName.charAt(0).toUpperCase() : '?';

  // Real balances via useWallet hook
  const { data: wallet } = useWallet();
  const availableBalance = (wallet as any)?.availableBalance ?? wallet?.availableBalance ?? 0;
  const lockedBalance = (wallet as any)?.lockedBalance ?? wallet?.lockedBalance ?? 0;

  return (
    <div className="py-10 px-4 sm:px-6 max-w-5xl mx-auto w-full">
        
        <div className="mb-6 flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-600 hover:text-slate-900"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="text-slate-500" size={24} />
            My Wallet
          </h1>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden mb-6">
          
          {/* Header: Profile */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
            
            {/* Standard sized avatar */}
            <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-900 text-white flex items-center justify-center text-lg font-bold shadow-sm">
              {initial}
            </div>
            
            {/* Removed the fixed widths and truncate to prevent cropping */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight break-words flex items-center gap-3">
                {user?.fullName || 'Anonymous User'}
                
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-slate-900 text-white text-[11px] font-bold rounded-md tracking-wide uppercase">
                    {user?.activeRole === 'CLIENT' && user.clientSubtype 
                      ? user.clientSubtype.replace('_', ' ') 
                      : user?.activeRole || 'USER'}
                  </span>
                  {user?.subscriptionTier && user.subscriptionTier !== 'free' && (
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-md tracking-wide uppercase">
                      {user.subscriptionTier}
                    </span>
                  )}
                  {user?.subscriptionTier === 'free' && (
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-md tracking-wide uppercase">
                      FREE TIER
                    </span>
                  )}
                </div>
              </h2>
            </div>

          </div>

          {/* Informative Balances */}
          <div className="p-8 flex flex-col sm:flex-row gap-6">
            
            {/* Available Balance Card */}
            <div className="flex-1 bg-emerald-50/50 border border-emerald-100 rounded-xl p-6 transition-all hover:bg-emerald-50">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <CheckCircle2 size={20} strokeWidth={2.5} />
                </div>
                <p className="text-sm font-semibold text-emerald-800 uppercase tracking-wider">Available Balance</p>
              </div>
              <p className="text-4xl font-bold text-slate-900 mb-3">{formatVND(availableBalance)}</p>
              <p className="text-sm text-emerald-700/80 leading-relaxed">
                These funds are fully cleared and ready to use for starting new tasks or withdrawing to your bank account.
              </p>
            </div>
            
            {/* Locked Balance Card */}
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-6 transition-all hover:bg-slate-100/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-slate-200 text-slate-600 rounded-lg">
                  <Lock size={20} strokeWidth={2.5} />
                </div>
                <p className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Locked Balance</p>
              </div>
              <p className="text-4xl font-bold text-slate-600 mb-3">{formatVND(lockedBalance)}</p>
              <p className="text-sm text-slate-500 leading-relaxed">
                These funds are securely held in escrow for active milestones and will be released upon completion.
              </p>
            </div>

          </div>

        </div>

        {/* Lower Section: Transaction History & Top-Up */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-2">
            <TransactionHistory />
          </div>
          <div className="lg:col-span-1">
            <WalletTopUp showContinue={false} />
          </div>
        </div>

    </div>
  );
}
