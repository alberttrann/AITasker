import { useState } from 'react';
import { useAuth } from '@hooks/use-auth';
import { Eye, EyeOff, Calendar, Shield, Wallet, LogOut, Sparkles, Building2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ConfirmModal } from '@components/ui/Modal';
import type { ClientProfileDto, ExpertProfileDto } from '@t/api.types';
import { useWallet } from '@/hooks/use-wallet';
import { formatVND } from '@/lib/utils';
import { useSubscriptionStatus } from '@/hooks/use-subscription';

export default function ProfilePage() {
  const { user, logout, addRole, switchRole } = useAuth();
  const navigate = useNavigate();
  
  // Toggle states for masked fields
  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [isSwitchRoleOpen, setIsSwitchRoleOpen] = useState(false);
  const [showProExpiry, setShowProExpiry] = useState(false);

  // Wallet data
  const { data: wallet } = useWallet();
  const availableBalance = (wallet as any)?.availableBalance ?? wallet?.available_balance ?? 0;
  const lockedBalance = (wallet as any)?.lockedBalance ?? wallet?.locked_balance ?? 0;

  const maskData = (data: string | null | undefined) => {
    if (!data) return 'Not specified';

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
  
  // ── Role Profile Helpers ──
  const isClient = user?.activeRole === 'CLIENT';
  const isExpert = user?.activeRole === 'EXPERT';
  const rawRole = isClient && user?.clientSubtype ? user.clientSubtype : user?.activeRole;
  const displayRole = rawRole ? rawRole.replace('_', ' ').toUpperCase() : '';

  const rolesArray = rawRole === 'TECH_TEAM' 
    ? ['TECH_TEAM'] 
    : (user?.roles || (user?.activeRole ? [user.activeRole] : ['USER']));
  
  const joinDate = user?.createdAt 
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const profile = user?.activeRoleProfile ?? null;
  const clientProfile = isClient ? (profile as ClientProfileDto | null) : null;
  const expertProfile = isExpert ? (profile as ExpertProfileDto | null) : null;

  const isVerifiedBusiness = isClient && clientProfile?.isTaxVerified === true;

  const { data: subStatus } = useSubscriptionStatus();
  const isFree = subStatus?.tier === 'free';
  const isPro = subStatus?.tier === 'pro';

  const hasClient = rolesArray.some(r => r.startsWith('CLIENT'));
  const hasExpert = rolesArray.includes('EXPERT');
  const canAddExpert = !hasExpert;
  const canAddClient = !hasClient;

  const handleAddRole = () => {
    setIsAddRoleOpen(true);
  };

  const confirmAddRole = () => {
    const newRole = canAddExpert ? 'EXPERT' : 'CLIENT_CEO';
    addRole.mutate({ newRole }, {
      onSuccess: () => setIsAddRoleOpen(false)
    });
  };

  return (
    <div className="py-10 px-4 sm:px-6 max-w-5xl mx-auto w-full">
        {/* Page Header */}
        <div className="mb-6 flex items-center gap-3">
          <button 
            onClick={() => {
              const basePath = user?.activeRole === 'ADMIN' ? '/admin' 
                             : user?.activeRole === 'EXPERT' ? '/expert' 
                             : user?.clientSubtype === 'TECH_TEAM' ? '/tech-team' 
                             : '/ceo';
              navigate(basePath);
            }}
            className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-600 hover:text-slate-900"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Profile</h1>
        </div>

        {/* Main Unified Card */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
          
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
                    {user?.fullName || 'Anonymous User'} {displayRole && <span className="text-slate-500 font-medium">({displayRole})</span>}
                  </h2>
                </div>
                
                {/* Badges */}
                <div className="flex flex-wrap gap-2 mt-1">
                  {rawRole !== 'TECH_TEAM' && (
                    isPro ? (
                      <div className="relative flex items-center">
                        <button 
                          onClick={() => setShowProExpiry(!showProExpiry)}
                          onBlur={() => setShowProExpiry(false)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-200 to-yellow-400 text-amber-900 text-[10px] font-bold uppercase tracking-wider rounded-[4px] shadow-sm hover:opacity-90 transition-opacity"
                        >
                          <Sparkles size={12} strokeWidth={2.5} />
                          Pro Tier
                        </button>
                        {showProExpiry && (subStatus?.expiresAt || user?.subscriptionExpires) && (
                          <div className="absolute top-full left-0 mt-2 w-max px-3 py-1.5 bg-slate-800 text-white text-[11px] font-medium rounded-md shadow-lg z-10 animate-in fade-in slide-in-from-top-1">
                            Expires on: {new Date(subStatus?.expiresAt || user?.subscriptionExpires || '').toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-[4px]">
                        <Sparkles size={12} strokeWidth={2.5} />
                        Free Tier
                      </span>
                    )
                  )}
                  {isVerifiedBusiness && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded-[4px] shadow-sm">
                      <CheckCircle2 size={12} strokeWidth={2.5} />
                      Verified Company
                    </span>
                  )}
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

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {hasClient && hasExpert && (
                 <button
                   onClick={() => setIsSwitchRoleOpen(true)}
                   disabled={switchRole.isPending}
                   className="text-sm font-semibold text-slate-900 bg-[#BEF264] hover:brightness-95 px-4 py-2 rounded-lg transition-all duration-200 whitespace-nowrap text-center shadow-sm"
                 >
                   {switchRole.isPending ? 'Switching...' : `Continue as ${isClient ? 'Expert' : 'Client'}`}
                 </button>
              )}
              {isExpert && (
                <Link 
                  to="/expert/expert-profile"
                  className="text-sm font-medium text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-4 py-2 rounded-lg transition-colors duration-200 whitespace-nowrap text-center shadow-sm"
                >
                  Expert Profile
                </Link>
              )}
              <Link 
                to="../account-setting"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-4 py-2 rounded-lg transition-colors duration-200 whitespace-nowrap text-center"
              >
                Edit
              </Link>
            </div>
          </div>

          {/* ── 2. Contact Details (List View) ── */}
          <div className="border-t border-slate-200 px-6 py-2">
            
            {/* Email Row */}
            <div className="flex items-center justify-between py-4 border-b border-slate-100">
              <span className="text-sm font-medium text-slate-500">Email Address</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-900 font-medium">
                  {showEmail ? (user?.email || 'Not specified') : maskData(user?.email)}
                </span>
                {user?.email && (
                  <button 
                    onClick={() => setShowEmail(!showEmail)}
                    className="text-slate-400 hover:text-slate-900 transition-colors p-1"
                    title={showEmail ? "Hide email" : "Show email"}
                  >
                    {showEmail ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              </div>
            </div>

            {/* Phone Row */}
            <div className="flex items-center justify-between py-4 border-b border-slate-100">
              <span className="text-sm font-medium text-slate-500">Phone Number</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-900 font-medium">
                  {showPhone ? (user?.phone || 'Not specified') : maskData(user?.phone)}
                </span>
                {user?.phone && (
                  <button 
                    onClick={() => setShowPhone(!showPhone)}
                    className="text-slate-400 hover:text-slate-900 transition-colors p-1"
                    title={showPhone ? "Hide phone" : "Show phone"}
                  >
                    {showPhone ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              </div>
            </div>

            {/* Join Date Row */}
            <div className={`flex items-center justify-between py-4 ${rawRole !== 'TECH_TEAM' ? 'border-b border-slate-100' : ''}`}>
              <span className="text-sm font-medium text-slate-500">Member Since</span>
              <div className="flex items-center gap-2 text-sm text-slate-900 font-medium">
                <Calendar size={16} className="text-slate-400" />
                {joinDate}
              </div>
            </div>

            {/* ── Role-Specific Details ── */}

            {/* CLIENT: Company Name */}
            {isClient && rawRole !== 'TECH_TEAM' && (
              <div className="flex items-center justify-between py-4 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-500">Company Name</span>
                <span className="text-sm text-slate-900 font-medium">
                  {clientProfile?.companyName || 'Not specified'}
                </span>
              </div>
            )}

            {/* CLIENT: Industry */}
            {isClient && rawRole !== 'TECH_TEAM' && (
              <div className="flex items-center justify-between py-4 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-500">Industry</span>
                <span className="text-sm text-slate-900 font-medium">
                  {clientProfile?.industry || 'Not specified'}
                </span>
              </div>
            )}

            {/* CLIENT: CEO Name */}
            {isClient && rawRole !== 'TECH_TEAM' && (
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
          {rawRole !== 'TECH_TEAM' && (
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
          )}

          {/* ── 4. Actions Footer ── */}
          <div className="border-t border-slate-200 p-2">
            
            {/* Add Second Role Button */}
            {(canAddExpert || canAddClient) && rawRole !== 'TECH_TEAM' && (
              <button 
                onClick={handleAddRole}
                disabled={addRole.isPending}
                className="w-full flex items-center justify-between px-4 py-3 rounded-md hover:bg-slate-50 text-slate-900 transition-colors group"
              >
                <div className="flex items-center gap-3 text-sm font-medium">
                  <Shield size={18} className="text-blue-600 group-hover:scale-110 transition-transform" />
                  {addRole.isPending ? 'Adding Role...' : (canAddExpert ? 'Become an Expert too' : 'Also act as Client')}
                </div>
              </button>
            )}

            {rawRole !== 'TECH_TEAM' && (
              <button 
                onClick={() => {
                  if (isClient) navigate('/ceo/subscription');
                  else if (isExpert) navigate('/expert/subscription');
                  else navigate('/subscription');
                }}
                disabled={!isFree}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-md transition-colors group ${
                  !isFree ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50 text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3 text-sm font-medium">
                  <Sparkles size={18} className="text-emerald-600 group-hover:animate-pulse" />
                  Upgrade to Pro
                </div>
              </button>
            )}
            
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

      <ConfirmModal
        isOpen={isSignOutOpen}
        onClose={() => setIsSignOutOpen(false)}
        onConfirm={logout}
        title="Sign Out"
        confirmText="Yes, sign out"
        cancelText="Cancel"
        isDestructive
      >
        Are you sure you want to sign out? You will need to log in again to access your account.
      </ConfirmModal>

      <ConfirmModal
        isOpen={isAddRoleOpen}
        onClose={() => setIsAddRoleOpen(false)}
        onConfirm={confirmAddRole}
        title={canAddExpert ? "Become an Expert" : "Become a Client"}
        confirmText="Confirm"
        cancelText="Cancel"
      >
        {canAddExpert 
          ? "Are you sure you want to add the Expert role to your account? This will allow you to offer your services to clients on the platform."
          : "Are you sure you want to add the Client role to your account? This will allow you to post projects and hire experts."}
      </ConfirmModal>

      <ConfirmModal
        isOpen={isSwitchRoleOpen}
        onClose={() => setIsSwitchRoleOpen(false)}
        onConfirm={() => {
          const newRole = isClient ? 'EXPERT' : 'CLIENT';
          switchRole.mutate({ activeRole: newRole }, {
            onSuccess: () => {
              setIsSwitchRoleOpen(false);
            }
          });
        }}
        title={`Switch to ${isClient ? 'Expert' : 'Client'}`}
        confirmText="Confirm"
        cancelText="Cancel"
      >
        Are you sure you want to switch your role to {isClient ? 'Expert' : 'Client'}? You can always switch back.
      </ConfirmModal>
    </div>
  );
}