import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/use-auth';
import { Bell, Mail, Wallet, ChevronRight } from 'lucide-react'; 
import AuthModal from '@/components/auth/AuthModal';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import { formatVND } from '@/lib/utils';
import { useWallet } from '@/hooks/use-wallet';

export default function TopNav() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  // ── Modal State ──
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isWalletMenuOpen, setIsWalletMenuOpen] = useState(false);

  const openModal = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  const getBasePath = () => {
    if (!isAuthenticated || !user) return '/';
    const role = user.activeRole;
    const subtype = user.clientSubtype;
    
    if (role === 'ADMIN') return '/admin';
    if (role === 'EXPERT') return '/expert';
    if (subtype === 'CEO') return '/ceo';
    if (subtype === 'TECH_TEAM') return '/tech-team';
    
    return '/';
  };

  const dashboardRoute = getBasePath();

  // Mocks to demonstrate badge rendering 
  // TODO: Connect to notifications/messages store later
  const unreadNotifications = 2;
  const unreadMessages = 0;

  // Safely grab the first letter of the name
  const initial = user?.fullName ? user.fullName.charAt(0).toUpperCase() : '?';
// 1. Decide which raw string to use
  const rawRole = user?.activeRole === 'CLIENT' && user?.clientSubtype
  ? user.clientSubtype 
  : user?.activeRole;

// 2. Format it for display
const roleDisplay = rawRole ? rawRole.replace('_', ' ').toUpperCase() : 'UNKNOWN';
  
  // Real balances via useWallet hook
  const { data: wallet } = useWallet();
  const availableBalance = (wallet as any)?.availableBalance ?? wallet?.available_balance ?? 0;
  const lockedBalance = (wallet as any)?.lockedBalance ?? wallet?.locked_balance ?? 0;

  const handleSignOut = () => {
    setIsSignOutModalOpen(true);
  };

  const confirmSignOut = () => {
    logout(); // Clears Zustand state
    navigate('/');
  };

  return (
    <>
    <header className="sticky top-0 z-50 w-full border-b border-primary/10 bg-gradient-to-r from-primary/5 via-tertiary/5 to-primary/5 backdrop-blur-md select-none min-h-[72px] flex items-center shadow-sm">
      <div className="flex flex-row items-center justify-between w-full px-6 max-w-7xl mx-auto py-2">
        
        {/* Left: Logo Area */}
        <div className="flex items-center">
          <Link 
            to={dashboardRoute} 
            className="relative flex items-center group"
          >
            <span className="font-headline font-extrabold text-2xl text-primary-dark tracking-tight transition-colors duration-300 hover:text-primary-dark/80">
              AITasker
            </span>
          </Link>
        </div>

        {/* Right: Auth-Aware Controls */}
        <div className="flex flex-row items-center gap-4">
          {!isAuthenticated ? (
            // ── Unauthenticated State ──
            <>
              <button 
                onClick={() => openModal('signin')} 
                className="font-headline text-primary hover:bg-primary/10 px-5 py-3 min-h-[48px] rounded-lg text-sm font-bold transition-all duration-300 active:scale-95"
              >
                Sign In
              </button>

              <button 
                onClick={() => openModal('signup')} 
                className="bg-primary text-white hover:bg-primary/90 active:scale-95 px-6 py-3 min-h-[48px] rounded-lg font-headline text-sm font-extrabold transition-all duration-300 shadow-sm"
              >
                Join
              </button>
            </>
          ) : (
            // ── Authenticated State ──
            <>
              {/* Wallet Menu */}
              <div className="relative">
                <button
                  aria-label="Wallet"
                  onClick={() => setIsWalletMenuOpen(!isWalletMenuOpen)}
                  className="relative p-2.5 text-primary-dark hover:text-primary-dark/80 hover:bg-primary-dark/10 rounded-full transition-all duration-300 active:scale-95"
                >
                  <Wallet size={24} strokeWidth={2.5} />
                </button>

                {isWalletMenuOpen && (
                  <div className="absolute right-0 top-full mt-3 w-64 bg-surface border border-primary/10 shadow-md rounded-[16px] overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-top-4 duration-200">
                    {/* Top Section: Balances (Clickable) */}
                    <Link
                      to={`${dashboardRoute}/wallet`}
                      onClick={() => setIsWalletMenuOpen(false)}
                      className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex flex-col gap-1.5">
                        <div>
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Available</span>
                          <span className="text-lg font-bold text-slate-900 leading-none block mt-0.5">{formatVND(availableBalance)}</span>
                        </div>
                        <div>
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Locked</span>
                          <span className="text-sm font-semibold text-slate-600 leading-none block mt-0.5">{formatVND(lockedBalance)}</span>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-slate-400 group-hover:text-slate-900 transition-colors" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Notification Bell */}
              {/* TODO: NotificationsDropdown */}
              <button aria-label="Notifications" className="relative p-2.5 text-primary-dark hover:text-primary-dark/80 hover:bg-primary-dark/10 rounded-full transition-all duration-300 active:scale-95">
                <Bell size={24} strokeWidth={2.5} />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1 right-1 w-3 h-3 bg-error rounded-full border-2 border-surface animate-pulse" />
                )}
              </button>

              {/* Mailbox */}
              {/* TODO: MessagesDropdown */}
              <button aria-label="Messages" className="relative p-2.5 text-primary-dark hover:text-primary-dark/80 hover:bg-primary-dark/10 rounded-full transition-all duration-300 active:scale-95">
                <Mail size={24} strokeWidth={2.5} />
                {unreadMessages > 0 && (
                  <span className="absolute top-1 right-1 w-3 h-3 bg-error rounded-full border-2 border-surface animate-pulse" />
                )}
              </button>

              {/* User Avatar & Dropdown */}
              <div className="relative ml-3">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  aria-label="User profile menu"
                  className="relative flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white font-headline text-lg hover:bg-primary/90 transition-all duration-300 active:scale-95 border-2 border-surface shadow-sm"
                >
                  {initial}
                </button>
                {/* Overlapping Role Badge */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-tertiary text-white text-[10px] font-headline font-extrabold tracking-wider rounded-full border-2 border-surface shadow-sm whitespace-nowrap pointer-events-none">
                  {roleDisplay}
                </div>

                {/* Dropdown Menu */}
                {isProfileMenuOpen && (
                  <div className="absolute right-0 top-full mt-3 w-56 bg-surface border border-primary/10 shadow-md rounded-[24px] py-3 flex flex-col z-50 animate-in fade-in slide-in-from-top-4 duration-300">
                    <Link
                      to={`${dashboardRoute}/profile`} 
                      onClick={() => setIsProfileMenuOpen(false)} 
                      className="px-5 py-3 text-sm font-headline text-primary hover:bg-primary/5 transition-colors mx-2 rounded-[12px]"
                    >
                      Profile
                    </Link>
                    <Link
                      to={`${dashboardRoute}/account-setting`}
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="px-5 py-3 text-sm font-headline text-primary hover:bg-primary/5 transition-colors mx-2 rounded-[12px]"
                    >
                      Account Configuration
                    </Link>
                    
                    {/* Divider */}
                    <div className="h-[1px] bg-primary/10 my-2 mx-4" />
                    
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        handleSignOut();
                      }}
                      className="px-5 py-3 text-sm text-left font-headline font-bold text-error hover:bg-error/10 transition-colors mx-2 rounded-[12px]"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </div>
    </header>
    {/* ── Render the Modal ── */}
    <AuthModal 
      isOpen={isAuthModalOpen} 
      onClose={() => setIsAuthModalOpen(false)} 
      initialMode={authMode} 
    />
    <ConfirmModal
      isOpen={isSignOutModalOpen}
      onClose={() => setIsSignOutModalOpen(false)}
      onConfirm={confirmSignOut}
      title="Sign Out"
      confirmText="Yes, sign out"
      cancelText="Cancel"
      isDestructive
    >
      Are you sure you want to sign out? You will need to log in again to access your dashboard.
    </ConfirmModal>
    </>
  );
}