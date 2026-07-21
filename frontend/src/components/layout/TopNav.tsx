import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@hooks/use-auth';
import { Bell, BellOff, MessageSquare, Wallet, ChevronRight, Briefcase, Award, Code, Shield, User, Menu, X, ChevronDown, LogIn, UserPlus, Search, RefreshCw, Sparkles, Lock, Inbox } from 'lucide-react';
import AuthModal from '@/components/auth/AuthModal';
import { ConfirmModal, Modal } from '@/components/ui/modal';
import { formatVND } from '@/lib/utils';
import { useWallet } from '@/hooks/use-wallet';
import { useNotificationsStore } from '@/store/notifications.store';
import { useSubscriptionStatus } from '@/hooks/use-subscription';
import SpotlightSearch from '@/components/layout/SpotlightSearch';
import { useEngagementStore } from '@store/engagement.store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useConversations } from '@/hooks/use-messages';

export default function TopNav() {
  const { user, isAuthenticated, logout, switchRole, addRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // ΓöÇΓöÇ Dropdown State ΓöÇΓöÇ
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

  // ΓöÇΓöÇ Modal State ΓöÇΓöÇ
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
  const queryClient = useQueryClient();
  const unreadCounts = useEngagementStore((s) => s.unreadCounts);
  const clearAllUnread = useEngagementStore((s) => s.clearAllUnread);
  const { data: conversationsResponse } = useConversations();

  const rawThreads = conversationsResponse?.data || [];
  const filteredThreads = rawThreads.filter((t: any) => !!t.lastMessage && !!t.lastMessage.content);
  
  // Calculate total unread messages using store counts or fallback counts
  const unreadMessages = filteredThreads.reduce(
  (sum: number, t: any) => sum + (t.unreadCount ?? unreadCounts[t.id] ?? 0),
  0
);
  // Show top 5 conversations in the dropdown
  const conversations = filteredThreads.slice(0, 5);

  const handleConversationClick = async (id: string) => {
    setActiveDropdown(null);
    try {
      await apiClient.post(`/conversations/${id}/read`);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      console.error("Failed to mark conversation as read:", err);
    }
    navigate(`${dashboardRoute}/inbox/${id}`);
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.post('/conversations/read-all');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  // Safely grab the first letter of the name
  const initial = user?.fullName ? user.fullName.charAt(0).toUpperCase() : '?';
// 1. Decide which raw string to use
  const rawRole: string = user?.activeRole === 'CLIENT' && user?.clientSubtype
  ? user.clientSubtype 
  : (user?.activeRole || '');

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
  const availableBalance = (wallet as any)?.availableBalance ?? (wallet as any)?.available_balance ?? 0;
  const lockedBalance = (wallet as any)?.lockedBalance ?? (wallet as any)?.locked_balance ?? 0;

  const handleSignOut = () => {
    setIsSignOutModalOpen(true);
  };

  const confirmSignOut = () => {
    clearAllUnread();
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
          <SpotlightSearch user={user} isAuthenticated={isAuthenticated} />
        </div>


        {/* Right: Auth-Aware Controls (Desktop) */}
        <div className="hidden md:flex flex-row items-center gap-4">
          {!isAuthenticated ? (
            // ΓöÇΓöÇ Unauthenticated State ΓöÇΓöÇ
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
            // ΓöÇΓöÇ Authenticated State ΓöÇΓöÇ
            <>
              {/* Wallet Menu */}
              {rawRole !== 'TECH_TEAM' && rawRole !== 'ADMIN' && (
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
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-error text-white font-headline font-extrabold text-[10px] leading-none rounded-full border-2 border-surface flex items-center justify-center shadow-xs">
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </span>
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
                                let targetLink = notif.link;
                                if (targetLink === '/expert/projects' || targetLink.includes('/expert/invitations')) {
                                  targetLink = '/expert/service/projects';
                                }
                                navigate(targetLink);
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

              {/* Chat messages */}
              <div className="relative">
                <button 
                  aria-label="Messages" 
                  onClick={() => setActiveDropdown(activeDropdown === 'messages' ? null : 'messages')}
                  className={`relative p-2.5 rounded-full transition-all duration-150 active:scale-95 ${activeDropdown === 'messages' ? 'bg-primary-dark/10 text-primary-dark' : 'text-primary-dark hover:text-primary-dark/80 hover:bg-primary-dark/10'}`}
                >
                  <MessageSquare size={24} strokeWidth={1.5} />
                  {unreadMessages > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-error text-white font-headline font-extrabold text-[10px] leading-none rounded-full border-2 border-surface flex items-center justify-center shadow-xs">
                      {unreadMessages > 99 ? '99+' : unreadMessages}
                    </span>
                  )}
                </button>

                {activeDropdown === 'messages' && (
                  <div className="absolute right-0 top-full mt-3 w-96 bg-surface border border-primary/10 shadow-md rounded-xl overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-top-4 duration-200">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                      <span className="font-semibold text-primary">Messages {unreadMessages > 0 ? `(${unreadMessages})` : ''}</span>
                      {unreadMessages > 0 && (
                        <button onClick={handleMarkAllRead} className="text-xs font-semibold text-[#059669] hover:underline bg-transparent border-none cursor-pointer">Mark all read</button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto bg-white">
                      {conversations.length === 0 ? (
                        <div className="p-8 flex flex-col items-center justify-center text-slate-400">
                          <Inbox size={40} className="mb-3 text-slate-300" strokeWidth={1.5} />
                          <p className="text-sm font-medium">No new messages</p>
                          <p className="text-xs text-center mt-1">Your inbox is empty.</p>
                        </div>
                      ) : (
                        conversations.map((conv: any) => {
                          const hasUnread = conv.unreadCount > 0;
                          const otherPartyName = conv.otherParty?.fullName || 'Partner';
                          const lastMsgContent = conv.lastMessage?.content 
                            ? (conv.lastMessage.content.length > 60 
                                ? conv.lastMessage.content.substring(0, 60) + '...' 
                                : conv.lastMessage.content)
                            : 'No messages yet';
                          const timeStr = conv.lastMessage?.timestamp 
                            ? new Date(conv.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                            : '';

                          return (
                            <div
                              key={conv.id}
                              onClick={() => handleConversationClick(conv.id)}
                              className={`p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors flex gap-3 ${hasUnread ? 'bg-primary/5' : ''}`}
                            >
                              {/* Avatar Bubble */}
                              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold shrink-0 border border-slate-200">
                                {otherPartyName.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                  <span className={`text-sm truncate ${hasUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                                    {otherPartyName}
                                  </span>
                                  {timeStr && <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-2">{timeStr}</span>}
                                </div>
                                <p className="text-xs text-slate-400 font-medium truncate mb-1">{conv.projectName}</p>
                                <p className={`text-xs truncate ${hasUnread ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                                  {lastMsgContent}
                                </p>
                              </div>
                              {hasUnread && (
                                <span className="w-2.5 h-2.5 bg-error rounded-full shrink-0 self-center" />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                    {conversations.length > 0 && (
                      <Link
                        to={`${dashboardRoute}/inbox`}
                        onClick={() => setActiveDropdown(null)}
                        className="p-3 text-center text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100/80 border-t border-slate-100 block transition-all"
                      >
                        See All in Messenger
                      </Link>
                    )}
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
                    {rawRole !== 'TECH_TEAM' && rawRole !== 'ADMIN' && (
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
                        to={`/expert/service`} 
                        onClick={() => setActiveDropdown(null)} 
                        className="px-5 py-3 text-sm font-headline text-primary hover:bg-primary/5 transition-colors mx-2 rounded-lg"
                      >
                        Services
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
                    {(!(hasClient && hasExpert) || !isPro) && (rawRole as string) !== 'TECH_TEAM' && (rawRole as string) !== 'ADMIN' && (
                      <div className="h-[1px] bg-primary/10 my-2 mx-4" />
                    )}

                    {!(hasClient && hasExpert) && (rawRole as string) !== 'TECH_TEAM' && (rawRole as string) !== 'ADMIN' && (
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

                    {!isPro && (rawRole as string) !== 'TECH_TEAM' && (rawRole as string) !== 'ADMIN' && (
                      <Link
                        to={`${dashboardRoute}/profile`}
                        onClick={() => setActiveDropdown(null)}
                        className="px-5 py-3 text-sm text-left font-headline font-extrabold text-purple-700 bg-transparent hover:bg-purple-50 transition-colors mx-2 mb-2 rounded-lg flex items-center justify-between"
                      >
                        Upgrade to Pro
                        <Sparkles size={16} className="text-purple-500" />
                      </Link>
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
              {(rawRole as string) !== 'TECH_TEAM' && (rawRole as string) !== 'ADMIN' && (
              <Link to={`${dashboardRoute}/wallet`} onClick={() => setActiveDropdown(null)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-lg font-headline text-primary-dark font-medium">
                <Wallet size={20} className="text-slate-500" /> Wallet <span className="ml-auto font-bold">{formatVND(availableBalance)}</span>
              </Link>
              )}
              <Link to={`${dashboardRoute}/notifications`} onClick={() => setActiveDropdown(null)} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 rounded-lg font-headline text-primary-dark font-medium">
                <div className="flex items-center gap-3">
                  <Bell size={20} className="text-slate-500" /> Notifications
                </div>
                {unreadNotifications > 0 && (
                  <span className="bg-error text-white text-xs font-bold px-2 py-0.5 rounded-full leading-none">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </Link>
              <Link to={`${dashboardRoute}/messages`} onClick={() => setActiveDropdown(null)} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 rounded-lg font-headline text-primary-dark font-medium">
                <div className="flex items-center gap-3">
                  <MessageSquare size={20} className="text-slate-500" /> Messages
                </div>
                {unreadMessages > 0 && (
                  <span className="bg-error text-white text-xs font-bold px-2 py-0.5 rounded-full leading-none">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
              </Link>
              <Link to={`${dashboardRoute}/profile`} onClick={() => setActiveDropdown(null)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-lg font-headline text-primary-dark font-medium">
                <User size={20} className="text-slate-500" /> Account
              </Link>
              
              {rawRole === 'EXPERT' && (
                <Link to="/expert/service" onClick={() => setActiveDropdown(null)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-lg font-headline text-primary-dark font-medium">
                  <Award size={20} className="text-slate-500" /> Expert Profile
                </Link>
              )}
              {(rawRole === 'CEO' || rawRole === 'TECH_TEAM') && (
                <Link to={`${dashboardRoute}/projects`} onClick={() => setActiveDropdown(null)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-lg font-headline text-primary-dark font-medium">
                  <Briefcase size={20} className="text-slate-500" /> Projects
                </Link>
              )}
              {rawRole === 'CEO' && (
                <Link to={`${dashboardRoute}/marketplace`} onClick={() => setActiveDropdown(null)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-lg font-headline text-primary-dark font-medium">
                  <Briefcase size={20} className="text-slate-500" /> Marketplace
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
              {(!(hasClient && hasExpert) || !isPro) && (rawRole as string) !== 'TECH_TEAM' && (rawRole as string) !== 'ADMIN' && (
                <div className="h-[1px] bg-primary/10 my-2" />
              )}

              {!(hasClient && hasExpert) && (rawRole as string) !== 'TECH_TEAM' && (rawRole as string) !== 'ADMIN' && (
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
      {isAuthenticated && (rawRole as string) !== 'ADMIN' && (
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
            {rawRole === 'CEO' && (
              <Link 
                to={`${dashboardRoute}/marketplace`} 
                className={`font-headline text-sm font-semibold transition-colors duration-150 relative py-2 ${location.pathname.includes('/marketplace') ? 'text-primary' : 'text-secondary hover:text-primary'}`}
              >
                Marketplace
                {location.pathname.includes('/marketplace') && (
                  <div className="absolute bottom-0 left-0 w-full h-[3px] bg-tertiary rounded-t-full"></div>
                )}
              </Link>
            )}
            {rawRole === 'EXPERT' && (
              <>
                <Link 
                  to={`/expert/service/projects`} 
                  className={`font-headline text-sm font-semibold transition-colors duration-150 relative py-2 ${location.pathname.includes('/projects') ? 'text-primary' : 'text-secondary hover:text-primary'}`}
                >
                  Projects
                  {location.pathname.includes('/projects') && (
                    <div className="absolute bottom-0 left-0 w-full h-[3px] bg-tertiary rounded-t-full"></div>
                  )}
                </Link>
                <Link 
                  to={`/expert/service`} 
                  className={`font-headline text-sm font-semibold transition-colors duration-150 relative py-2 ${location.pathname === '/expert/service' ? 'text-primary' : 'text-secondary hover:text-primary'}`}
                >
                  Services
                  {location.pathname === '/expert/service' && (
                    <div className="absolute bottom-0 left-0 w-full h-[3px] bg-tertiary rounded-t-full"></div>
                  )}
                </Link>
              </>
            )}

            {(rawRole as string) !== 'TECH_TEAM' && (rawRole as string) !== 'ADMIN' && (
              <Link 
                to={`${dashboardRoute}/subscriptions`} 
                className={`font-headline text-sm font-semibold transition-colors duration-150 relative py-2 ${location.pathname.includes('/subscriptions') ? 'text-primary' : 'text-secondary hover:text-primary'} flex items-center gap-1.5`}
              >
                <Sparkles size={16} />
                Plans
                {location.pathname.includes('/subscriptions') && (
                  <div className="absolute bottom-0 left-0 w-full h-[3px] bg-tertiary rounded-t-full"></div>
                )}
              </Link>
            )}

            {(rawRole as string) !== 'ADMIN' && (
              <Link 
                to={`${dashboardRoute}/inbox`} 
                className={`font-headline text-sm font-semibold transition-colors duration-150 relative py-2 ${location.pathname.includes('/inbox') || location.pathname.includes('/messages') ? 'text-primary' : 'text-secondary hover:text-primary'}`}
              >
                Messages
                {(location.pathname.includes('/inbox') || location.pathname.includes('/messages')) && (
                  <div className="absolute bottom-0 left-0 w-full h-[3px] bg-tertiary rounded-t-full"></div>
                )}
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
    {/* ΓöÇΓöÇ Render the Modal ΓöÇΓöÇ */}
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
