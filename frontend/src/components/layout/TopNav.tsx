import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/use-auth';
import { Bell, BellOff, Mail, Wallet, ChevronRight, Briefcase, Award, Code, Shield, User, Menu, X, ChevronDown, LogIn, UserPlus, Search, RefreshCw, Sparkles, Lock, Inbox } from 'lucide-react';
import AuthModal from '@/components/auth/AuthModal';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import { formatVND } from '@/lib/utils';
import { useWallet } from '@/hooks/use-wallet';
import { useNotificationsStore } from '@/store/notifications.store';
import { useSubscriptionStatus } from '@/hooks/use-subscription';

export default function TopNav() {
  const { user, isAuthenticated, logout, switchRole, addRole } = useAuth();
  const navigate = useNavigate();
  
  // ── Dropdown State ──
  type DropdownType = 'wallet' | 'profile' | 'notifications' | 'messages' | 'mobile' | null;
  const [activeDropdown, setActiveDropdown] = useState<DropdownType>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Modal State ──
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isSwitchRoleModalOpen, setIsSwitchRoleModalOpen] = useState(false);
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);

  const rolesArray = user?.roles || (user?.activeRole ? [user.activeRole] : []);
  const hasClient = rolesArray.some(r => r.startsWith('CLIENT'));
  const hasExpert = rolesArray.includes('EXPERT');
  const isClientActive = user?.activeRole === 'CLIENT' || user?.activeRole?.startsWith('CLIENT');

  const openModal = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  const confirmAddRole = () => {
    // If they are currently active as Client, they don't have Expert, so add EXPERT.
    // Otherwise add CLIENT_CEO.
    const newRole = isClientActive ? 'EXPERT' : 'CLIENT_CEO';
    addRole.mutate({ newRole }, {
      onSuccess: () => setIsAddRoleModalOpen(false)
    });
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

  // Notifications store
  const { notifications, markRead, markAllRead } = useNotificationsStore();
  const unreadNotifications = notifications.filter(n => !n.read).length;
  const unreadMessages = 0;

  // Safely grab the first letter of the name
  const initial = user?.fullName ? user.fullName.charAt(0).toUpperCase() : '?';
// 1. Decide which raw string to use
  const rawRole = user?.activeRole === 'CLIENT' && user?.clientSubtype
  ? user.clientSubtype 
  : user?.activeRole;

// 2. Format it for display
const roleDisplay = rawRole ? rawRole.replace('_', ' ').toUpperCase() : 'UNKNOWN';

const getRoleColor = (roleStr: string) => {
  const normalized = roleStr.toUpperCase();
  if (normalized.includes('CEO')) return 'bg-blue-100 text-blue-700';
  if (normalized.includes('EXPERT')) return 'bg-emerald-100 text-emerald-700';
  if (normalized.includes('TECH')) return 'bg-orange-100 text-orange-700';
  if (normalized.includes('ADMIN')) return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-600';
};
const roleColorClass = getRoleColor(rawRole || '');

const RoleIcon = 
  rawRole === 'CEO' ? Briefcase :
  rawRole === 'EXPERT' ? Award :
  rawRole === 'TECH_TEAM' ? Code :
  rawRole === 'ADMIN' ? Shield :
  User;

  // 3. Subscription tier
  const { data: subStatus } = useSubscriptionStatus();
  const isPro = subStatus?.tier === 'pro';
  
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
    <header ref={navRef} className="relative z-50 w-full bg-primary-bg border-b border-primary/20 select-none flex flex-col">
      <div className="flex flex-row items-center justify-between w-full px-6 max-w-[1440px] mx-auto h-[80px]">
        
        {/* Left: Logo Area */}
        <div className="flex items-center">
          <Link 
            to={dashboardRoute} 
            className="relative flex flex-col items-start group mt-1"
          >
            <span className="font-headline font-extrabold text-3xl text-slate-900 tracking-tight leading-none group-hover:text-primary transition-colors">
              AITasker
            </span>
            <span className="h-[3px] w-6 bg-[#059669] mt-1 group-hover:w-full transition-all duration-150"></span>
          </Link>
        </div>

        {/* Middle: Search Bar */}
        <div className="flex flex-1 mx-4 md:mx-8 lg:mx-12 min-w-0">
          <div className="w-full flex items-stretch group border-[1.5px] border-primary-dark/30 rounded overflow-hidden transition-colors duration-150 hover:border-primary-dark/50 focus-within:border-primary-dark min-w-0">
            <input 
              type="text" 
              placeholder="Search..." 
              className="flex-1 min-w-0 w-full bg-transparent pl-4 pr-3 py-3 text-sm font-medium text-primary-dark placeholder:text-primary-dark/50 focus:outline-none"
            />
            <button className="flex items-center justify-center shrink-0 aspect-square bg-primary-dark text-white hover:bg-primary-dark/90 transition-colors duration-150">
              <Search size={20} strokeWidth={1.5} />
            </button>
          </div>
        </div>


        {/* Right: Auth-Aware Controls (Desktop) */}
        <div className="hidden md:flex flex-row items-center gap-4">
          {!isAuthenticated ? (
            // ── Unauthenticated State ──
            <>
              <button 
                onClick={() => openModal('signin')} 
                className="font-headline text-primary hover:bg-primary/10 px-5 py-3 min-h-[48px] rounded-lg text-sm font-bold transition-all duration-150 active:scale-95"
              >
                Sign In
              </button>

              <button 
                onClick={() => openModal('signup')} 
                className="bg-primary text-white hover:bg-primary/90 active:scale-95 px-6 py-3 min-h-[48px] rounded-lg font-headline text-sm font-extrabold transition-all duration-150 shadow-sm"
              >
                Join
              </button>
            </>
          ) : (
            // ── Authenticated State ──
            <>
              {/* Wallet Menu */}
              {rawRole !== 'TECH_TEAM' && (
              <div className="relative">
                <button
                  aria-label="Wallet"
                  onClick={() => setActiveDropdown(activeDropdown === 'wallet' ? null : 'wallet')}
                  className="relative p-2.5 text-primary-dark hover:text-primary-dark/80 hover:bg-primary-dark/10 rounded-full transition-all duration-150 active:scale-95"
                >
                  <Wallet size={24} strokeWidth={1.5} />
                </button>

                {activeDropdown === 'wallet' && (
                  <div className="absolute right-0 top-full mt-3 w-64 bg-surface border border-slate-200 shadow-xl rounded-xl overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <Link
                      to={`${dashboardRoute}/wallet`}
                      onClick={() => setActiveDropdown(null)}
                      className="p-5 hover:bg-slate-50 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex flex-col gap-4">
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Available Balance</span>
                          <span className="text-2xl font-extrabold text-slate-900 leading-none block">{formatVND(availableBalance)}</span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-100/80 rounded-full px-2 py-1 border border-slate-200/60 mt-1 max-w-fit gap-3">
                          <div className="flex items-center gap-1 text-slate-500">
                            <Lock size={10} strokeWidth={2.5} />
                            <span className="text-[9px] font-bold uppercase tracking-wider">Locked</span>
                          </div>
                          <span className="text-xs font-bold text-slate-700">{formatVND(lockedBalance)}</span>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-[#059669] opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </Link>
                  </div>
                )}
              </div>
              )}

              {/* Notification Bell */}
              <div className="relative">
                <button 
                  aria-label="Notifications" 
                  onClick={() => setActiveDropdown(activeDropdown === 'notifications' ? null : 'notifications')}
                  className={`relative p-2.5 rounded-full transition-all duration-150 active:scale-95 ${activeDropdown === 'notifications' ? 'bg-primary-dark/10 text-primary-dark' : 'text-primary-dark hover:text-primary-dark/80 hover:bg-primary-dark/10'}`}
                >
                  <Bell size={24} strokeWidth={1.5} />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-1 right-1 w-3 h-3 bg-error rounded-full border-2 border-surface animate-pulse" />
                  )}
                </button>

                {activeDropdown === 'notifications' && (
                  <div className="absolute right-0 top-full mt-3 w-96 bg-surface border border-primary/10 shadow-md rounded-xl overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-top-4 duration-200">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                      <span className="font-semibold text-primary">Notifications {unreadNotifications > 0 ? `(${unreadNotifications})` : ''}</span>
                      {unreadNotifications > 0 && (
                        <button onClick={() => markAllRead()} className="text-xs text-primary hover:text-primary-dark transition-colors font-medium">Mark all read</button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto bg-white">
                      {notifications.length === 0 ? (
                        <div className="p-8 flex flex-col items-center justify-center text-slate-400">
                          <Bell size={40} className="mb-3 text-slate-300" strokeWidth={1.5} />
                          <p className="text-sm font-medium">No new notifications</p>
                          <p className="text-xs text-center mt-1">You're all caught up! Check back later.</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div 
                            key={notif.id} 
                            onClick={() => {
                              markRead(notif.id);
                              if (notif.link) {
                                navigate(notif.link);
                                setActiveDropdown(null);
                              }
                            }} 
                            className={`p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${!notif.read ? 'bg-primary/5' : ''}`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className={`text-sm font-semibold ${!notif.read ? 'text-primary' : 'text-slate-700'}`}>{notif.title}</span>
                              {!notif.read && <span className="w-2 h-2 bg-error rounded-full mt-1.5 shrink-0" />}
                            </div>
                            <p className="text-xs text-slate-500">{notif.body}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Mailbox */}
              <div className="relative">
                <button 
                  aria-label="Messages" 
                  onClick={() => setActiveDropdown(activeDropdown === 'messages' ? null : 'messages')}
                  className={`relative p-2.5 rounded-full transition-all duration-150 active:scale-95 ${activeDropdown === 'messages' ? 'bg-primary-dark/10 text-primary-dark' : 'text-primary-dark hover:text-primary-dark/80 hover:bg-primary-dark/10'}`}
                >
                  <Mail size={24} strokeWidth={1.5} />
                  {unreadMessages > 0 && (
                    <span className="absolute top-1 right-1 w-3 h-3 bg-error rounded-full border-2 border-surface animate-pulse" />
                  )}
                </button>

                {activeDropdown === 'messages' && (
                  <div className="absolute right-0 top-full mt-3 w-96 bg-surface border border-primary/10 shadow-md rounded-xl overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-top-4 duration-200">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                      <span className="font-semibold text-primary">Inbox {unreadMessages > 0 ? `(${unreadMessages})` : ''}</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto bg-white">
                      <div className="p-8 flex flex-col items-center justify-center text-slate-400">
                        <Inbox size={40} className="mb-3 text-slate-300" strokeWidth={1.5} />
                        <p className="text-sm font-medium">No new messages</p>
                        <p className="text-xs text-center mt-1">Your inbox is empty.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* User Avatar & Dropdown */}
              <div className="relative ml-3">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'profile' ? null : 'profile')}
                  aria-label="User profile menu"
                  className="relative flex items-center gap-3 transition-all duration-150 active:scale-95 group"
                >
                  <div className="relative">
                    <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary text-white font-headline text-lg border-2 border-surface shadow-sm group-hover:bg-primary/90">
                      {initial}
                    </div>
                    {/* Overlapping Tier Badge */}
                    {rawRole !== 'TECH_TEAM' && (
                    <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[9px] font-headline font-extrabold tracking-wider rounded-full border-2 border-surface shadow-sm whitespace-nowrap pointer-events-none ${
                      isPro
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                        : 'bg-slate-400 text-white'
                    }`}>
                      {isPro ? 'PRO' : 'FREE'}
                    </div>
                    )}
                  </div>
                  <div className="hidden lg:flex flex-col justify-center items-start text-left">
                    <span className="text-base font-bold text-primary-dark group-hover:text-primary leading-none">
                      {user?.fullName || 'User'}
                    </span>
                    <span className={`mt-1 inline-flex w-fit items-center rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide shadow-sm ${roleColorClass}`}>
                      {roleDisplay}
                    </span>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {activeDropdown === 'profile' && (
                  <div className={`absolute right-0 top-full mt-3 w-56 bg-surface border border-slate-200 shadow-xl rounded-xl pb-2 flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 ${!(hasClient && hasExpert) ? 'pt-2' : ''}`}>
                    {hasClient && hasExpert && (
                      <button
                        onClick={() => {
                          setActiveDropdown(null);
                          setIsSwitchRoleModalOpen(true);
                        }}
                        disabled={switchRole.isPending}
                        className="w-full flex items-center justify-center gap-2 px-5 py-3.5 mb-2 text-sm font-bold text-slate-900 bg-[#BEF264] hover:bg-[#aee64c] transition-colors"
                      >
                        <RefreshCw size={16} className={switchRole.isPending ? "animate-spin" : ""} />
                        {switchRole.isPending ? 'Switching...' : `Switch to ${isClientActive ? 'Expert' : 'Client'}`}
                      </button>
                    )}

                    <Link
                      to={`${dashboardRoute}/profile`} 
                      onClick={() => setActiveDropdown(null)} 
                      className="px-5 py-3 text-sm font-headline text-primary hover:bg-primary/5 transition-colors mx-2 rounded-lg"
                    >
                      Account
                    </Link>

                    {rawRole === 'EXPERT' && (
                      <Link
                        to={`/expert/expert-profile`} 
                        onClick={() => setActiveDropdown(null)} 
                        className="px-5 py-3 text-sm font-headline text-primary hover:bg-primary/5 transition-colors mx-2 rounded-lg"
                      >
                        Expert Profile
                      </Link>
                    )}

                    {(rawRole === 'CEO' || rawRole === 'TECH_TEAM') && (
                      <Link
                        to={`${dashboardRoute}/projects`} 
                        onClick={() => setActiveDropdown(null)} 
                        className="px-5 py-3 text-sm font-headline text-primary hover:bg-primary/5 transition-colors mx-2 rounded-lg"
                      >
                        Projects
                      </Link>
                    )}

                    {/* Divider for Promoted Actions */}
                    {(!(hasClient && hasExpert) || !isPro) && rawRole !== 'TECH_TEAM' && (
                      <div className="h-[1px] bg-primary/10 my-2 mx-4" />
                    )}

                    {!(hasClient && hasExpert) && rawRole !== 'TECH_TEAM' && (
                      <button
                        onClick={() => {
                          setActiveDropdown(null);
                          setIsAddRoleModalOpen(true);
                        }}
                        className="px-5 py-3 text-sm text-left font-headline font-extrabold text-emerald-700 bg-transparent hover:bg-emerald-50 transition-colors mx-2 mb-2 rounded-lg"
                      >
                        {isClientActive ? 'Become an Expert' : 'Become a Client'}
                      </button>
                    )}



                    {/* Divider before Sign Out */}
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

        {/* Mobile Menu Toggle */}
        <div className="flex md:hidden items-center shrink-0">
          <button
            aria-label="Menu"
            onClick={() => setActiveDropdown(activeDropdown === 'mobile' ? null : 'mobile')}
            className="p-2 text-primary-dark hover:bg-primary-dark/10 rounded-lg transition-colors"
          >
            {activeDropdown === 'mobile' ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

      </div>

      {/* Mobile Menu Dropdown */}
      {activeDropdown === 'mobile' && (
        <div className="absolute top-full left-0 right-0 bg-surface border-b border-primary/10 shadow-lg md:hidden z-50 flex flex-col p-4 gap-2 animate-in fade-in slide-in-from-top-4">
          {!isAuthenticated ? (
            <>
              <button onClick={() => { openModal('signin'); setActiveDropdown(null); }} className="w-full text-left font-headline font-bold px-4 py-3 hover:bg-primary-bg rounded-lg">Sign In</button>
              <button onClick={() => { openModal('signup'); setActiveDropdown(null); }} className="w-full text-center font-headline font-bold px-4 py-3 bg-primary text-white rounded-lg mt-2">Join</button>
            </>
          ) : (
            <>
              {rawRole !== 'TECH_TEAM' && (
              <Link to={`${dashboardRoute}/wallet`} onClick={() => setActiveDropdown(null)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-lg font-headline text-primary-dark font-medium">
                <Wallet size={20} className="text-slate-500" /> Wallet <span className="ml-auto font-bold">{formatVND(availableBalance)}</span>
              </Link>
              )}
              <Link to={`${dashboardRoute}/notifications`} onClick={() => setActiveDropdown(null)} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 rounded-lg font-headline text-primary-dark font-medium">
                <div className="flex items-center gap-3">
                  <Bell size={20} className="text-slate-500" /> Notifications
                </div>
                {unreadNotifications > 0 && <span className="bg-coral text-white text-xs px-2 py-0.5 rounded-full font-bold">{unreadNotifications}</span>}
              </Link>
              <Link to={`${dashboardRoute}/profile`} onClick={() => setActiveDropdown(null)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-lg font-headline text-primary-dark font-medium">
                <User size={20} className="text-slate-500" /> Account
              </Link>
              
              {rawRole === 'EXPERT' && (
                <Link to="/expert/expert-profile" onClick={() => setActiveDropdown(null)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-lg font-headline text-primary-dark font-medium">
                  <Award size={20} className="text-slate-500" /> Expert Profile
                </Link>
              )}
              {(rawRole === 'CEO' || rawRole === 'TECH_TEAM') && (
                <Link to={`${dashboardRoute}/projects`} onClick={() => setActiveDropdown(null)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-lg font-headline text-primary-dark font-medium">
                  <Briefcase size={20} className="text-slate-500" /> Projects
                </Link>
              )}
              
              <div className="h-[1px] bg-primary/10 my-2" />

              {hasClient && hasExpert && (
                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    setIsSwitchRoleModalOpen(true);
                  }}
                  disabled={switchRole.isPending}
                  className="flex items-center justify-center gap-2 px-4 py-3 text-slate-900 bg-[#BEF264] hover:bg-[#aee64c] rounded-lg font-headline font-bold transition-colors"
                >
                  <RefreshCw size={18} className={switchRole.isPending ? "animate-spin" : ""} />
                  {switchRole.isPending ? 'Switching...' : `Switch to ${isClientActive ? 'Expert' : 'Client'}`}
                </button>
              )}

              {/* Divider for Promoted Actions */}
              {(!(hasClient && hasExpert) || !isPro) && (
                <div className="h-[1px] bg-primary/10 my-2" />
              )}

              {!(hasClient && hasExpert) && (
                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    setIsAddRoleModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 text-emerald-700 bg-transparent hover:bg-emerald-50 rounded-lg font-headline font-extrabold transition-colors"
                >
                  <UserPlus size={18} />
                  {isClientActive ? 'Become an Expert' : 'Become a Client'}
                </button>
              )}



              {/* Divider before Sign Out */}
              <div className="h-[1px] bg-primary/10 my-2" />

              <button onClick={() => { setActiveDropdown(null); handleSignOut(); }} className="flex items-center justify-center gap-2 px-4 py-3 mt-2 text-error hover:bg-error/10 rounded-lg font-headline font-bold transition-colors">
                Sign Out
              </button>
            </>
          )}
        </div>
      )}

      {/* Bottom Navigation Row */}
      {isAuthenticated && (
        <div className="hidden md:block w-full bg-transparent border-t border-primary/20 relative z-40">
          <div className="flex flex-row items-center justify-start gap-8 px-6 max-w-[1440px] mx-auto">
            <Link 
              to={dashboardRoute} 
              className={`font-headline text-sm font-semibold transition-colors duration-150 relative py-2 ${location.pathname === dashboardRoute || location.pathname === dashboardRoute + '/' ? 'text-primary' : 'text-secondary hover:text-primary'}`}
            >
              Dashboard
              {(location.pathname === dashboardRoute || location.pathname === dashboardRoute + '/') && (
                <div className="absolute bottom-0 left-0 w-full h-[3px] bg-tertiary rounded-t-full"></div>
              )}
            </Link>
            {(rawRole === 'CEO' || rawRole === 'TECH_TEAM') && (
              <Link 
                to={`${dashboardRoute}/projects`} 
                className={`font-headline text-sm font-semibold transition-colors duration-150 relative py-2 ${location.pathname.includes('/projects') ? 'text-primary' : 'text-secondary hover:text-primary'}`}
              >
                Projects
                {location.pathname.includes('/projects') && (
                  <div className="absolute bottom-0 left-0 w-full h-[3px] bg-tertiary rounded-t-full"></div>
                )}
              </Link>
            )}
            {rawRole === 'EXPERT' && (
              <Link 
                to={`/expert/expert-profile`} 
                className={`font-headline text-sm font-semibold transition-colors duration-150 relative py-2 ${location.pathname.includes('/expert-profile') ? 'text-primary' : 'text-secondary hover:text-primary'}`}
              >
                Services
                {location.pathname.includes('/expert-profile') && (
                  <div className="absolute bottom-0 left-0 w-full h-[3px] bg-tertiary rounded-t-full"></div>
                )}
              </Link>
            )}
            {rawRole !== 'TECH_TEAM' && (
              <Link 
                to={`${dashboardRoute}/subscription`} 
                className={`font-headline text-sm font-semibold transition-colors duration-150 relative py-2 ${location.pathname.includes('/subscription') ? 'text-primary' : 'text-secondary hover:text-primary'} flex items-center gap-1.5`}
              >
                Subscription
                {!isPro && <Sparkles size={14} className="text-blue-500 mb-0.5" />}
                {location.pathname.includes('/subscription') && (
                  <div className="absolute bottom-0 left-0 w-full h-[3px] bg-tertiary rounded-t-full"></div>
                )}
              </Link>
            )}
          </div>
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
      confirmText="Sign Out"
      cancelText="Cancel"
      isDestructive
    >
      Are you sure you want to sign out?
    </ConfirmModal>

    {/* Switch Role Modal */}
    <ConfirmModal
      isOpen={isSwitchRoleModalOpen}
      onClose={() => setIsSwitchRoleModalOpen(false)}
      onConfirm={() => {
        const newRole = isClientActive ? 'EXPERT' : 'CLIENT';
        switchRole.mutate({ activeRole: newRole }, {
          onSuccess: () => {
            setIsSwitchRoleModalOpen(false);
          }
        });
      }}
      title={`Switch to ${isClientActive ? 'Expert' : 'Client'}`}
      confirmText="Confirm"
      cancelText="Cancel"
    >
      Are you sure you want to switch your role to {isClientActive ? 'Expert' : 'Client'}? You can always switch back.
    </ConfirmModal>

    {/* Add Role Modal */}
    <ConfirmModal
      isOpen={isAddRoleModalOpen}
      onClose={() => setIsAddRoleModalOpen(false)}
      onConfirm={confirmAddRole}
      title={isClientActive ? "Become an Expert" : "Become a Client"}
      confirmText={addRole.isPending ? "Loading..." : "Confirm"}
      cancelText="Cancel"
    >
      Are you sure you want to add the {isClientActive ? 'Expert' : 'Client'} role to your account? You will be able to switch seamlessly between both roles anytime.
    </ConfirmModal>
    </>
  );
}