import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/use-auth';
import { Bell, Mail, Wallet, ChevronRight, Briefcase, Award, Code, Shield, User, Menu, X, ChevronDown, LogIn, UserPlus } from 'lucide-react'; 
import AuthModal from '@/components/auth/AuthModal';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import { formatVND } from '@/lib/utils';
import { useWallet } from '@/hooks/use-wallet';

export default function TopNav() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  
  // ── Dropdown State ──
  type DropdownType = 'wallet' | 'profile' | 'notifications' | 'messages' | null;
  const [activeDropdown, setActiveDropdown] = useState<DropdownType>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Modal State ──
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);

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
const RoleIcon = 
  rawRole === 'CEO' ? Briefcase :
  rawRole === 'EXPERT' ? Award :
  rawRole === 'TECH_TEAM' ? Code :
  rawRole === 'ADMIN' ? Shield :
  User;

  // 3. Subscription tier
  const isPro = user?.subscriptionTier === 'pro';
  
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
    <header ref={navRef} className="relative z-50 w-full bg-primary-bg border-b border-primary/5 select-none min-h-[80px] flex items-center">
      <div className="flex flex-row items-center justify-between w-full px-6 max-w-[1440px] mx-auto py-2">
        
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

        {/* Mobile Menu Toggle */}
        <button 
          className="md:hidden relative p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
          onClick={() => {
            setIsMobileMenuOpen(!isMobileMenuOpen);
            setActiveDropdown(null);
          }}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Right: Auth-Aware Controls (Desktop) */}
        <div className="hidden md:flex flex-row items-center gap-4">
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
                  onClick={() => setActiveDropdown(activeDropdown === 'wallet' ? null : 'wallet')}
                  className="relative p-2.5 text-primary-dark hover:text-primary-dark/80 hover:bg-primary-dark/10 rounded-full transition-all duration-300 active:scale-95"
                >
                  <Wallet size={24} strokeWidth={1.5} />
                </button>

                {activeDropdown === 'wallet' && (
                  <div className="absolute right-0 top-full mt-3 w-64 bg-surface border border-primary/10 shadow-md rounded-xl overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-top-4 duration-200">
                    {/* Top Section: Balances (Clickable) */}
                    <Link
                      to={`${dashboardRoute}/wallet`}
                      onClick={() => setActiveDropdown(null)}
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
                <Bell size={24} strokeWidth={1.5} />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1 right-1 w-3 h-3 bg-error rounded-full border-2 border-surface animate-pulse" />
                )}
              </button>

              {/* Mailbox */}
              {/* TODO: MessagesDropdown */}
              <button aria-label="Messages" className="relative p-2.5 text-primary-dark hover:text-primary-dark/80 hover:bg-primary-dark/10 rounded-full transition-all duration-300 active:scale-95">
                <Mail size={24} strokeWidth={1.5} />
                {unreadMessages > 0 && (
                  <span className="absolute top-1 right-1 w-3 h-3 bg-error rounded-full border-2 border-surface animate-pulse" />
                )}
              </button>

              {/* User Avatar & Dropdown */}
              <div className="relative ml-3">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'profile' ? null : 'profile')}
                  aria-label="User profile menu"
                  className="relative flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white font-headline text-lg hover:bg-primary/90 transition-all duration-300 active:scale-95 border-2 border-surface shadow-sm"
                >
                  {initial}
                </button>
                {/* Overlapping Tier Badge */}
                <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 text-[10px] font-headline font-extrabold tracking-wider rounded-full border-2 border-surface shadow-sm whitespace-nowrap pointer-events-none ${
                  isPro
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                    : 'bg-slate-400 text-white'
                }`}>
                  {isPro ? 'PRO' : 'FREE'}
                </div>

                {/* Dropdown Menu */}
                {activeDropdown === 'profile' && (
                  <div className="absolute right-0 top-full mt-3 w-56 bg-surface border border-primary/10 shadow-md rounded-xl pb-3 flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 duration-300">
                    {/* Role Info — Non-interactive */}
                    <div className="px-5 py-3 bg-accent text-primary-dark cursor-default select-none flex items-center justify-center gap-2 mb-2">
                      <RoleIcon size={16} strokeWidth={2.5} />
                      <span className="text-sm font-headline font-extrabold tracking-wide">{roleDisplay}</span>
                    </div>

                    <Link
                      to={`${dashboardRoute}/profile`} 
                      onClick={() => setActiveDropdown(null)} 
                      className="px-5 py-3 text-sm font-headline text-primary hover:bg-primary/5 transition-colors mx-2 rounded-lg"
                    >
                      User Profile
                    </Link>
                    {user?.activeRole === 'EXPERT' && (
                      <Link
                        to={`${dashboardRoute}/expert-profile`} 
                        onClick={() => setActiveDropdown(null)} 
                        className="px-5 py-3 text-sm font-headline text-primary hover:bg-primary/5 transition-colors mx-2 rounded-lg"
                      >
                        Expert Profile
                      </Link>
                    )}
                    <Link
                      to={`${dashboardRoute}/account-setting`}
                      onClick={() => setActiveDropdown(null)}
                      className="px-5 py-3 text-sm font-headline text-primary hover:bg-primary/5 transition-colors mx-2 rounded-lg"
                    >
                      Account Configuration
                    </Link>
                    
                    {/* Divider */}
                    <div className="h-[1px] bg-primary/10 my-2 mx-4" />
                    
                    <button
                      onClick={() => {
                        setActiveDropdown(null);
                        handleSignOut();
                      }}
                      className="px-5 py-3 text-sm text-left font-headline font-bold text-error hover:bg-error/10 transition-colors mx-2 rounded-lg"
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

      {/* ── Mobile Menu ── */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-surface border-b border-primary/10 shadow-lg flex flex-col max-h-[calc(100vh-80px)] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
          {!isAuthenticated ? (
            <div className="flex flex-col p-4 gap-2">
              <button 
                onClick={() => { setIsMobileMenuOpen(false); openModal('signin'); }} 
                className="flex items-center gap-3 p-4 text-primary hover:bg-primary/5 rounded-lg transition-colors"
              >
                <LogIn size={20} /> <span className="font-headline font-bold text-lg">Sign In</span>
              </button>
              <button 
                onClick={() => { setIsMobileMenuOpen(false); openModal('signup'); }} 
                className="flex items-center gap-3 p-4 bg-primary text-white rounded-lg transition-colors shadow-sm"
              >
                <UserPlus size={20} /> <span className="font-headline font-bold text-lg">Join</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Wallet Collapse */}
              <button 
                onClick={() => setActiveDropdown(activeDropdown === 'wallet' ? null : 'wallet')}
                className="flex items-center justify-between p-4 border-b border-primary/5 text-primary hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Wallet size={20} /> <span className="font-headline font-bold text-lg">Wallet</span>
                </div>
                <ChevronDown size={20} className={`transition-transform duration-200 ${activeDropdown === 'wallet' ? 'rotate-180' : ''}`} />
              </button>
              {activeDropdown === 'wallet' && (
                <div className="bg-slate-50 p-4 border-b border-primary/5">
                  <Link
                    to={`${dashboardRoute}/wallet`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex flex-col gap-3"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-slate-500 uppercase">Available</span>
                      <span className="text-lg font-bold text-slate-900">{formatVND(availableBalance)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-slate-500 uppercase">Locked</span>
                      <span className="text-md font-semibold text-slate-600">{formatVND(lockedBalance)}</span>
                    </div>
                  </Link>
                </div>
              )}

              {/* Notifications */}
              <button className="flex items-center justify-between p-4 border-b border-primary/5 text-primary hover:bg-primary/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Bell size={20} />
                    {unreadNotifications > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-error rounded-full border border-surface" />}
                  </div>
                  <span className="font-headline font-bold text-lg">Notifications</span>
                </div>
              </button>

              {/* Messages */}
              <button className="flex items-center justify-between p-4 border-b border-primary/5 text-primary hover:bg-primary/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Mail size={20} />
                    {unreadMessages > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-error rounded-full border border-surface" />}
                  </div>
                  <span className="font-headline font-bold text-lg">Messages</span>
                </div>
              </button>

              {/* Profile Collapse */}
              <button 
                onClick={() => setActiveDropdown(activeDropdown === 'profile' ? null : 'profile')}
                className="flex items-center justify-between p-4 border-b border-primary/5 text-primary hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white font-headline text-xs font-bold">
                    {initial}
                  </div>
                  <span className="font-headline font-bold text-lg">Profile</span>
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${isPro ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' : 'bg-slate-400 text-white'}`}>{isPro ? 'PRO' : 'FREE'}</span>
                </div>
                <ChevronDown size={20} className={`transition-transform duration-200 ${activeDropdown === 'profile' ? 'rotate-180' : ''}`} />
              </button>
              {activeDropdown === 'profile' && (
                <div className="bg-slate-50 flex flex-col border-b border-primary/5">
                  <div className="px-4 py-3 bg-accent/20 text-primary-dark cursor-default select-none flex items-center gap-2 border-b border-primary/5">
                    <RoleIcon size={16} strokeWidth={2.5} />
                    <span className="text-sm font-headline font-extrabold tracking-wide">{roleDisplay}</span>
                  </div>
                  <Link
                    to={`${dashboardRoute}/profile`} 
                    onClick={() => setIsMobileMenuOpen(false)} 
                    className="p-4 text-sm font-headline font-semibold text-primary hover:bg-primary/5 border-b border-primary/5"
                  >
                    User Profile
                  </Link>
                  {user?.activeRole === 'EXPERT' && (
                    <Link
                      to={`${dashboardRoute}/expert-profile`} 
                      onClick={() => setIsMobileMenuOpen(false)} 
                      className="p-4 text-sm font-headline font-semibold text-primary hover:bg-primary/5 border-b border-primary/5"
                    >
                      Expert Profile
                    </Link>
                  )}
                  <Link
                    to={`${dashboardRoute}/account-setting`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-4 text-sm font-headline font-semibold text-primary hover:bg-primary/5 border-b border-primary/5"
                  >
                    Account Configuration
                  </Link>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleSignOut();
                    }}
                    className="p-4 text-sm text-left font-headline font-bold text-error hover:bg-error/10"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
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
      Are you sure you want to sign out?
    </ConfirmModal>
    </>
  );
}