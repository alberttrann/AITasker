import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@store/auth.store';
import { Bell, Mail } from 'lucide-react'; 
import AuthModal from '@/components/auth/AuthModal';

export default function TopNav() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  // ── Modal State ──
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  const openModal = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
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
    <header className="sticky top-0 z-50 w-full border-b border-[var(--border-color,#E2E8F0)] bg-[var(--nav-bg,transparent)] select-none h-[60px]">
      <div className="flex flex-row items-center justify-between h-full px-6 max-w-7xl mx-auto">
        
        {/* Left: Logo Area */}
        <div className="flex items-center">
          {/* TODO: LogoSVG - Replace text placeholder with actual SVG file */}
          <Link to="/" className="font-bold text-lg text-[var(--text-primary,#111C2D)] tracking-tight">
            AITasker
          </Link>
        </div>

        {/* Right: Auth-Aware Controls */}
        <div className="flex flex-row items-center gap-5">
          {!isAuthenticated ? (
            // ── Unauthenticated State ──
            <>
              <button 
                onClick={() => openModal('signin')} 
                className="bg-transparent border border-transparent hover:bg-[var(--hover-bg,rgba(0,0,0,0.05))] text-[var(--text-primary,#111C2D)] px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Sign In
              </button>

              <button 
                onClick={() => openModal('signup')} 
                className="bg-[var(--button-solid-bg,#111C2D)] text-white hover:opacity-90 px-4 py-2 rounded-md text-sm font-medium transition-opacity"
              >
                Join
              </button>
            </>
          ) : (
            // ── Authenticated State ──
            <>
              {/* Notification Bell */}
              {/* TODO: NotificationsDropdown */}
              <button className="relative p-1.5 text-[var(--icon-stroke-and-divider,#252B31)] hover:bg-[var(--hover-bg,rgba(0,0,0,0.05))] rounded-full transition-colors">
                <Bell size={22} strokeWidth={2} />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[var(--nav-bg,#ffffff)]" />
                )}
              </button>

              {/* Mailbox */}
              {/* TODO: MessagesDropdown */}
              <button className="relative p-1.5 text-[var(--icon-stroke-and-divider,#252B31)] hover:bg-[var(--hover-bg,rgba(0,0,0,0.05))] rounded-full transition-colors">
                <Mail size={22} strokeWidth={2} />
                {unreadMessages > 0 && (
                  <span className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[var(--nav-bg,#ffffff)]" />
                )}
              </button>

              {/* User Avatar & Dropdown */}
              <div className="relative ml-2">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="relative flex items-center justify-center w-10 h-10 rounded-full bg-[var(--button-solid-bg,#111C2D)] text-white font-medium hover:ring-2 hover:ring-offset-2 hover:ring-[var(--button-solid-bg,#111C2D)] transition-all"
                >
                  {initial}
                  
                  {/* Overlapping Role Badge */}
                  <div className="absolute -bottom-2 px-2 py-0.5 bg-[var(--badge-bg,#3B82F6)] text-white text-[9px] font-bold tracking-wider rounded-full border-[1.5px] border-[var(--nav-bg,#ffffff)] shadow-sm whitespace-nowrap">
                    {roleDisplay}
                  </div>
                </button>

                {/* Dropdown Menu */}
                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-4 w-48 bg-[var(--dropdown-bg,#ffffff)] border border-[var(--icon-stroke-and-divider,#252B31)]/20 shadow-lg rounded-lg py-2 flex flex-col z-50">
                    <Link
                      to="/profile" 
                      onClick={() => setIsProfileMenuOpen(false)} 
                      className="px-4 py-2 text-sm text-[var(--text-primary,#111C2D)] hover:bg-[var(--hover-bg,rgba(0,0,0,0.05))] transition-colors"
                    >
                      Profile
                    </Link>
                    <Link
                      to="/account-setting"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="px-4 py-2 text-sm text-[var(--text-primary,#111C2D)] hover:bg-[var(--hover-bg,rgba(0,0,0,0.05))] transition-colors"
                    >
                      Account Configuration
                    </Link>
                    
                    {/* Divider */}
                    <div className="h-px bg-[var(--icon-stroke-and-divider,#252B31)] my-1.5 opacity-10" />
                    
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        handleSignOut();
                      }}
                      className="px-4 py-2 text-sm text-left text-red-600 font-medium hover:bg-red-50 transition-colors w-full"
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