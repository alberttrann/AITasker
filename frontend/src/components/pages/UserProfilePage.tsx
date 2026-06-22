import { useState } from 'react';
import { useAuthStore } from '@store/auth.store';
import { Eye, EyeOff, Calendar, Shield, Wallet, LogOut, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ProfilePage() {
  const { user, logout } = useAuthStore();
  
  // Toggle states for masked fields
  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(false);

const maskData = (data: string | null | undefined) => {
  if (!data) return 'N/A';

  // 1. Email Masking Logic
  if (data.includes('@')) {
    const [localPart, ...domainParts] = data.split('@');
    const domain = domainParts.join('@'); // Rejoin in case of multiple @ (rare but possible)

    // If the part before the @ is 3 characters or shorter, just mask the whole local part
    if (localPart.length <= 4) {
      return '*'.repeat(localPart.length) + '@' + domain;
    }
    
    // Otherwise, keep everything except the last 3 characters of the local part
    return localPart.slice(0, -4) + '**@' + domain;
  }

  // 2. Phone Number Masking Logic (for anything without an '@')
  // If the data is 6 characters or shorter, there isn't enough to mask
  if (data.length <= 6) return data;

  const firstPart = data.slice(0, 4);
  const lastPart = data.slice(-2);
  const maskLength = data.length - 6;

  return firstPart + '*'.repeat(maskLength) + lastPart;
};

  // Safe data extraction based on the backend DTO structure
  const initial = user?.fullName ? user.fullName.charAt(0).toUpperCase() : '?';
  const rolesArray = user?.roles || (user?.activeRole ? [user.activeRole] : ['USER']);
  
  // Format the date (fallback to today if createdAt isn't passed by backend yet)
  const joinDate = user?.createdAt 
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <>
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      
      {/* ── Page Header ── */}
      <div className="max-w-6xl mx-auto mb-6">
        <h1 className="font-headline-md text-headline-md text-primary">My Profile</h1>
      </div>

      {/* ── Bento Grid Layout ── */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* ── Left Column (3/4 Width) ── */}
        <div className="md:col-span-3 flex flex-col gap-6">
          
          {/* Box 1: Profile Info */}
          <div className="bg-surface border border-outline-variant rounded-2xl p-6 md:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row gap-6 md:items-start justify-between">
              
              {/* Avatar & Basic Info */}
              <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                {/* Avatar */}
                <div className="flex-shrink-0 flex items-center justify-center w-24 h-24 rounded-full bg-primary-container text-on-primary-container text-4xl font-bold shadow-sm">
                  {initial}
                </div>
                
                <div className="flex flex-col items-center md:items-start gap-1">
                  <h2 className="text-2xl font-bold text-on-surface">{user?.fullName || 'Anonymous User'}</h2>
                  
                  {/* Role Badges */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {rolesArray.map((role, idx) => (
                      <span key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-surface-container-low border border-outline-variant text-on-surface-variant text-xs font-bold rounded-md tracking-wide">
                        <Shield size={14} />
                        {role.replace('_', ' ').toUpperCase()}
                      </span>
                    ))}
                  </div>

                  {/* Join Date */}
                  <div className="flex items-center gap-2 mt-4 text-sm text-on-surface-variant">
                    <Calendar size={16} />
                    <span>Joined {joinDate}</span>
                  </div>
                </div>
              </div>

              {/* Edit Button */}
              
              <Link 
                to="/account-setting"
                className="text-primary font-medium text-sm hover:underline hover:underline-offset-4 transition-all"
              >
                Edit profile
              </Link>
              
            </div>

            {/* Masked Contact Details */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-outline-variant pt-6">
              
              {/* Email Field */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Email Address</span>
                <div className="flex items-center justify-between bg-surface-container-low px-4 py-2.5 rounded-lg border border-outline-variant/50">
                  <span className="text-on-surface font-medium truncate mr-4">
                    {showEmail ? (user?.email || 'N/A') : maskData(user?.email)}
                  </span>
                  <button 
                    onClick={() => setShowEmail(!showEmail)}
                    className="text-on-surface-variant hover:text-primary transition-colors p-1"
                  >
                    {showEmail ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Phone Field */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Phone Number</span>
                <div className="flex items-center justify-between bg-surface-container-low px-4 py-2.5 rounded-lg border border-outline-variant/50">
                  <span className="text-on-surface font-medium truncate mr-4">
                    {showPhone ? (user?.phone || 'N/A') : maskData(user?.phone)}
                  </span>
                  <button 
                    onClick={() => setShowPhone(!showPhone)}
                    className="text-on-surface-variant hover:text-primary transition-colors p-1"
                    disabled={!user?.phone} // Disable if no phone number exists
                  >
                    {showPhone ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Box 2: Wallet Stub */}
          <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-surface-container-low rounded-lg text-primary">
                <Wallet size={24} />
              </div>
              <h3 className="text-lg font-bold text-on-surface">Wallet & Balances</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30">
                <p className="text-xs text-on-surface-variant mb-1 uppercase tracking-wide font-semibold">User ID</p>
                <p className="text-sm font-mono text-on-surface truncate" title={user?.id}>
                  {user?.id || 'Pending...'}
                </p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30">
                <p className="text-xs text-on-surface-variant mb-1 uppercase tracking-wide font-semibold">Available Balance</p>
                <p className="text-xl font-bold text-primary">$0.00</p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30">
                <p className="text-xs text-on-surface-variant mb-1 uppercase tracking-wide font-semibold">Locked Balance</p>
                <p className="text-xl font-bold text-on-surface-variant">$0.00</p>
              </div>
            </div>
          </div>

        </div>

        {/* ── Right Column (1/4 Width) ── */}
        <div className="md:col-span-1 flex flex-col gap-4">
          
          {/* Action Links Box */}
          <div className="bg-surface border border-outline-variant rounded-2xl p-4 shadow-sm flex flex-col gap-2">
            
            {/* Conditional Upgrade/Help Button */}
            <button className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-surface-container-low text-left transition-colors group">
              <div className="flex items-center gap-3 text-on-surface font-medium group-hover:text-primary transition-colors">
                <Sparkles size={18} className="text-primary" />
                {user?.activeRole === 'EXPERT' ? 'Get Expert Help' : 'Become an Expert'}
              </div>
            </button>
            
            {/* Divider */}
            <div className="h-px w-full bg-outline-variant/50 my-1" />

            {/* Sign Out Button */}
            <button 
              onClick={logout}
              className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-error/10 text-left transition-colors group"
            >
              <div className="flex items-center gap-3 text-error font-medium">
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