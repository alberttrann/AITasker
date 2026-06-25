import { useState } from 'react';
import { useAuth } from '@hooks/use-auth';
import { Eye, EyeOff, Calendar, Shield, Wallet, LogOut, Sparkles, Building2, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ConfirmModal } from '@components/ui/Modal';
import type { ClientProfileDto, ExpertProfileDto } from '@t/api.types';
import { useWallet } from '@/hooks/use-wallet';
import { formatVND } from '@/lib/utils';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  
  // Toggle states for masked fields
  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);

  // Wallet data
  const { data: wallet } = useWallet();
  const availableBalance = (wallet as any)?.availableBalance ?? wallet?.available_balance ?? 0;
  const lockedBalance = (wallet as any)?.lockedBalance ?? wallet?.locked_balance ?? 0;

  const maskData = (data: string | null | undefined) => {
    if (!data) return 'N/A';

    // 1. Email Masking Logic
    if (data.includes('@')) {
      const [localPart, ...domainParts] = data.split('@');
      const domain = domainParts.join('@');

      if (localPart.length <= 4) {
        return '*'.repeat(localPart.length) + '@' + domain;
      }
      
      return localPart.slice(0, -4) + '**@' + domain;
    }

    // 2. Phone Number Masking Logic (for anything without an '@')
    if (data.length <= 6) return data;

    const firstPart = data.slice(0, 4);
    const lastPart = data.slice(-2);
    const maskLength = data.length - 6;

    return firstPart + '*'.repeat(maskLength) + lastPart;
  };

  const initial = user?.fullName ? user.fullName.charAt(0).toUpperCase() : '?';
  const rolesArray = user?.roles || (user?.activeRole ? [user.activeRole] : ['USER']);
  
  const joinDate = user?.createdAt 
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // ── Role Profile Helpers ──
  const profile = user?.activeRoleProfile ?? null;
  const isClient = user?.activeRole === 'CLIENT';
  const isExpert = user?.activeRole === 'EXPERT';

  const clientProfile = isClient ? (profile as ClientProfileDto | null) : null;
  const expertProfile = isExpert ? (profile as ExpertProfileDto | null) : null;

  const isVerifiedBusiness = isClient && !!clientProfile?.companyName;
  const isFree = user?.subscriptionTier === 'free';

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      
      <div className="w-full max-w-5xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Profile</h1>
        </div>

        {/* Main Unified Card */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          
          {/* ── 1. Identity Section ── */}
          <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Circular Avatar */}
              <div className="flex-shrink-0 w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center text-2xl font-bold">
                {initial}
              </div>
              
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[20px] font-semibold text-slate-900 leading-tight">
                    {user?.fullName || 'Anonymous User'}
                  </h2>
                  {isVerifiedBusiness && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-[4px]">
                      <Building2 size={12} strokeWidth={2.5} />
                      Verified Business
                    </span>
                  )}
                </div>
                
                {/* Clinical Badges */}
                <div className="flex flex-wrap gap-2 mt-1">
                  {rolesArray.map((role, idx) => (
                    <span 
                      key={idx} 
                      className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-[4px]"
                    >
                      <Shield size={12} strokeWidth={2.5} />
                      {role.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <Link 
              to="/account-setting"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-4 py-2 rounded-lg transition-colors duration-200"
            >
              Edit Profile
            </Link>
          </div>

          {/* ── 2. Contact Details (List View) ── */}
          <div className="border-t border-slate-200 px-6 py-2">
            
            {/* Email Row */}
            <div className="flex items-center justify-between py-4 border-b border-slate-100">
              <span className="text-sm font-medium text-slate-500">Email Address</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-900 font-medium">
                  {showEmail ? (user?.email || 'N/A') : maskData(user?.email)}
                </span>
                <button 
                  onClick={() => setShowEmail(!showEmail)}
                  className="text-slate-400 hover:text-slate-900 transition-colors p-1"
                  title={showEmail ? "Hide email" : "Show email"}
                >
                  {showEmail ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Phone Row */}
            <div className="flex items-center justify-between py-4 border-b border-slate-100">
              <span className="text-sm font-medium text-slate-500">Phone Number</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-900 font-medium">
                  {showPhone ? (user?.phone || 'N/A') : maskData(user?.phone)}
                </span>
                <button 
                  onClick={() => setShowPhone(!showPhone)}
                  disabled={!user?.phone}
                  className="text-slate-400 hover:text-slate-900 disabled:opacity-50 disabled:hover:text-slate-400 transition-colors p-1"
                  title={showPhone ? "Hide phone" : "Show phone"}
                >
                  {showPhone ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Join Date Row */}
            <div className="flex items-center justify-between py-4 border-b border-slate-100">
              <span className="text-sm font-medium text-slate-500">Member Since</span>
              <div className="flex items-center gap-2 text-sm text-slate-900 font-medium">
                <Calendar size={16} className="text-slate-400" />
                {joinDate}
              </div>
            </div>

            {/* ── Role-Specific Details ── */}

            {/* CLIENT: Company Name */}
            {isClient && (
              <div className="flex items-center justify-between py-4 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-500">Company Name</span>
                <span className="text-sm text-slate-900 font-medium">
                  {clientProfile?.companyName || 'Not specified'}
                </span>
              </div>
            )}

            {/* CLIENT: Industry */}
            {isClient && (
              <div className="flex items-center justify-between py-4 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-500">Industry</span>
                <span className="text-sm text-slate-900 font-medium">
                  {clientProfile?.industry || 'Not specified'}
                </span>
              </div>
            )}

            {/* CLIENT: CEO Name */}
            {isClient && (
              <div className="flex items-center justify-between py-4 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-500">CEO Name</span>
                <span className="text-sm text-slate-900 font-medium">
                  {clientProfile?.ceoName || 'Not specified'}
                </span>
              </div>
            )}

            {/* EXPERT: Bio */}
            {isExpert && (
              <div className="flex items-center justify-between py-4 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-500 shrink-0 mr-6">Bio</span>
                <span className="text-sm text-slate-900 font-medium text-right">
                  {expertProfile?.bio || 'Not specified'}
                </span>
              </div>
            )}

            {/* EXPERT: Engagement Model */}
            {isExpert && (
              <div className="flex items-center justify-between py-4 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-500">Engagement Model</span>
                <span className="text-sm text-slate-900 font-medium">
                  {expertProfile?.engagementModel?.replace('_', ' ') || 'Not specified'}
                </span>
              </div>
            )}

            {/* EXPERT: Stack Tags */}
            {isExpert && (
              <div className="flex items-center justify-between py-4 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-500 shrink-0 mr-6">Stack</span>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {expertProfile?.stackTagsJson && expertProfile.stackTagsJson.length > 0 ? (
                    expertProfile.stackTagsJson.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-[4px]"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-900 font-medium">Not specified</span>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* ── 3. Wallet & Stats ── */}
          <div className="border-t border-slate-200 bg-slate-50 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Wallet size={18} className="text-slate-500" />
              Wallet & Balances
            </h3>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Available</p>
                <p className="text-lg font-bold text-slate-900">{formatVND(availableBalance)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Locked</p>
                <p className="text-lg font-bold text-slate-600">{formatVND(lockedBalance)}</p>
              </div>
            </div>
          </div>

          {/* ── 4. Actions Footer ── */}
          <div className="border-t border-slate-200 p-2">
            <button className="w-full flex items-center justify-between px-4 py-3 rounded-md hover:bg-slate-50 text-slate-900 transition-colors group">
              <div className="flex items-center gap-3 text-sm font-medium">
                {isFree ? (
                  <>
                    <Sparkles size={18} className="text-emerald-600 group-hover:animate-pulse" />
                    Upgrade to Premium
                  </>
                ) : (
                  <>
                    <Briefcase size={18} className="text-emerald-600 group-hover:animate-pulse" />
                    {isExpert ? 'Get Expert Help' : 'Become an Expert'}
                  </>
                )}
              </div>
            </button>
            
            <button 
              onClick={() => setIsSignOutOpen(true)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-md hover:bg-red-50 text-red-600 transition-colors mt-1"
            >
              <div className="flex items-center gap-3 text-sm font-medium">
                <LogOut size={18} />
                Sign out
              </div>
            </button>
          </div>

        </div>
      </div>

      <ConfirmModal
        isOpen={isSignOutOpen}
        onClose={() => setIsSignOutOpen(false)}
        onConfirm={logout}
        title="Sign Out"
        confirmText="Yes, sign out"
        cancelText="Cancel"
        isDestructive
      >
        Are you sure you want to sign out? You will need to log in again to access your dashboard.
      </ConfirmModal>
    </div>
  );
}