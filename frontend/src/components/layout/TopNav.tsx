import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/use-auth';
import { Bell, Mail } from 'lucide-react'; 
import AuthModal from '@/components/auth/AuthModal';

export default function TopNav() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  // ── Modal State ──
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  const openModal = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  const getDashboardRoute = () => {
    if (!isAuthenticated || !user) return '/';
    const role = user.activeRole;
    const subtype = user.clientSubtype;
    
    if (role === 'ADMIN') return '/admin';
    if (role === 'EXPERT') return '/expert';
    if (subtype === 'CEO') return '/ceo';
    if (subtype === 'TECH_TEAM') return '/tech-team';
    
    return '/';
  };

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
  const handleSignOut = () => {
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
            to={getDashboardRoute()} 
            className="relative flex items-center group"
          >
            <span className="font-headline font-extrabold text-2xl text-primary-dark tracking-widest transition-colors duration-300 hover:text-primary-dark/80">
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
                className="font-headline text-primary hover:bg-primary/10 px-5 py-3 min-h-[48px] rounded-full text-sm font-bold transition-all duration-300 active:scale-95"
              >
                Sign In
              </button>

              <button 
                onClick={() => openModal('signup')} 
                className="bg-primary text-white hover:bg-primary/90 active:scale-95 px-6 py-3 min-h-[48px] rounded-full font-headline text-sm font-extrabold transition-all duration-300 shadow-sm"
              >
                Join
              </button>
            </>
          ) : (
            // ── Authenticated State ──
            <>
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
                  <div className="absolute right-0 mt-4 w-56 bg-surface border border-primary/10 shadow-md rounded-[24px] py-3 flex flex-col z-50 animate-in fade-in slide-in-from-top-4 duration-300">
                    <Link
                      to="/profile" 
                      onClick={() => setIsProfileMenuOpen(false)} 
                      className="px-5 py-3 text-sm font-headline text-primary hover:bg-primary/5 transition-colors mx-2 rounded-[12px]"
                    >
                      Profile
                    </Link>
                    <Link
                      to="/account-setting"
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
                      className="px-5 py-3 text-sm text-left font-headline font-bold text-error hover:bg-error/10 transition-colors mx-2 rounded-[12px] w-full"
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
    </>
  );
}