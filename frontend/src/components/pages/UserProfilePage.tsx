import { useState } from 'react';
import { useAuth } from '@hooks/use-auth';
import { Eye, EyeOff, Calendar, Shield, Wallet, LogOut, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  
  // Toggle states for masked fields
  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(false);

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

  return (
    <>
    <div className="min-h-screen bg-surface-base p-4 sm:p-6 lg:p-8">
      
      {/* ── Page Header ── */}
      <div className="max-w-6xl mx-auto mb-6">
        <h1 className="font-headline text-h2 font-extrabold text-primary-dark">My Profile</h1>
      </div>

      {/* ── Bento Grid Layout ── */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* ── Left Column (3/4 Width) ── */}
        <div className="md:col-span-3 flex flex-col gap-6">
          
          {/* Box 1: Profile Info */}
          <div className="bg-surface-card border-2 border-primary-light/30 rounded-[24px] p-6 md:p-8 shadow-card">
            <div className="flex flex-col md:flex-row gap-6 md:items-start justify-between">
              
              {/* Avatar & Basic Info */}
              <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                {/* Avatar */}
                <div className="flex-shrink-0 flex items-center justify-center w-24 h-24 rounded-[32px] bg-gradient-to-br from-primary to-primary-dark text-white text-4xl font-headline font-bold shadow-teal-glow">
                  {initial}
                </div>
                
                <div className="flex flex-col items-center md:items-start gap-1">
                  <h2 className="text-h3 font-headline font-extrabold text-primary-dark">{user?.fullName || 'Anonymous User'}</h2>
                  
                  {/* Role Badges */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {rolesArray.map((role, idx) => (
                      <span key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-cream border border-accent/50 text-primary-dark text-xs font-headline font-bold rounded-[8px] tracking-wide shadow-sm">
                        <Shield size={14} className="text-accent" />
                        {role.replace('_', ' ').toUpperCase()}
                      </span>
                    ))}
                  </div>

                  {/* Join Date */}
                  <div className="flex items-center gap-2 mt-4 text-sm text-primary-dark/70 font-body">
                    <Calendar size={16} />
                    <span>Joined {joinDate}</span>
                  </div>
                </div>
              </div>

              {/* Edit Button */}
              
              <Link 
                to="/account-setting"
                className="text-primary font-headline font-bold text-sm hover:underline hover:underline-offset-4 transition-all bg-primary-bg px-4 py-2 rounded-full"
              >
                Edit profile
              </Link>
              
            </div>

            {/* Masked Contact Details */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 border-t-2 border-dashed border-primary-light/30 pt-6">
              
              {/* Email Field */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-headline text-primary-dark/60 uppercase tracking-wider">Email Address</span>
                <div className="flex items-center justify-between bg-primary-bg px-4 py-3 rounded-[16px] border border-primary-light/30">
                  <span className="text-primary-dark font-body font-medium truncate mr-4">
                    {showEmail ? (user?.email || 'N/A') : maskData(user?.email)}
                  </span>
                  <button 
                    onClick={() => setShowEmail(!showEmail)}
                    aria-label={showEmail ? "Hide email" : "Show email"}
                    className="text-primary-dark/60 hover:text-primary transition-colors p-1"
                  >
                    {showEmail ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Phone Field */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-headline text-primary-dark/60 uppercase tracking-wider">Phone Number</span>
                <div className="flex items-center justify-between bg-primary-bg px-4 py-3 rounded-[16px] border border-primary-light/30">
                  <span className="text-primary-dark font-body font-medium truncate mr-4">
                    {showPhone ? (user?.phone || 'N/A') : maskData(user?.phone)}
                  </span>
                  <button 
                    onClick={() => setShowPhone(!showPhone)}
                    aria-label={showPhone ? "Hide phone number" : "Show phone number"}
                    className="text-primary-dark/60 hover:text-primary transition-colors p-1"
                    disabled={!user?.phone}
                  >
                    {showPhone ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Box 2: Wallet Stub */}
          <div className="bg-surface-card border-2 border-primary-light/30 rounded-[24px] p-6 shadow-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary-bg rounded-[12px] text-primary shadow-sm">
                <Wallet size={24} />
              </div>
              <h3 className="text-h3 font-headline font-extrabold text-primary-dark">Wallet & Balances</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-cream p-4 rounded-[16px] border border-accent/20">
                <p className="text-xs text-primary-dark/60 mb-1 uppercase tracking-wide font-headline">User ID</p>
                <p className="text-sm font-mono text-primary-dark truncate" title={user?.id}>
                  {user?.id || 'Pending...'}
                </p>
              </div>
              <div className="bg-primary-bg p-4 rounded-[16px] border border-primary-light/30">
                <p className="text-xs text-primary-dark/60 mb-1 uppercase tracking-wide font-headline">Available Balance</p>
                <p className="text-h2 font-headline font-extrabold text-primary">$0.00</p>
              </div>
              <div className="bg-cream p-4 rounded-[16px] border border-accent/20">
                <p className="text-xs text-primary-dark/60 mb-1 uppercase tracking-wide font-headline">Locked Balance</p>
                <p className="text-h2 font-headline font-extrabold text-coral">$0.00</p>
              </div>
            </div>
          </div>

        </div>

        {/* ── Right Column (1/4 Width) ── */}
        <div className="md:col-span-1 flex flex-col gap-4">
          
          {/* Action Links Box */}
          <div className="bg-surface-card border-2 border-primary-light/30 rounded-[24px] p-4 shadow-card flex flex-col gap-2">
            
            {/* Conditional Upgrade/Help Button */}
            <button className="flex items-center justify-between w-full p-3 rounded-[16px] hover:bg-primary-bg text-left transition-colors group">
              <div className="flex items-center gap-3 text-primary-dark font-headline font-bold group-hover:text-primary transition-colors">
                <Sparkles size={18} className="text-accent group-hover:animate-spin" />
                {user?.activeRole === 'EXPERT' ? 'Get Expert Help' : 'Become an Expert'}
              </div>
            </button>
            
            {/* Divider */}
            <div className="h-px w-full bg-primary-light/30 my-1 border-b border-dashed" />

            {/* Sign Out Button */}
            <button 
              onClick={logout}
              className="flex items-center justify-between w-full p-3 rounded-[16px] hover:bg-coral-light/20 text-left transition-colors group"
            >
              <div className="flex items-center gap-3 text-coral font-headline font-bold">
                <LogOut size={18} />
                Sign out
              </div>
            </button>

          </div>

        </div>

      </div>
    </div>
    </>
  );
}