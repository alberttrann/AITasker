import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/input';
import { Loader2, Copyright, UserCheck, LogOut } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

function decodeJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export function HandoffRegister() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, logout, user, setTokens, setUser } = useAuthStore();
  const { registerHandoff } = useAuth();
  
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      navigate('/register/handoff/expired');
      return;
    }

    const payload = decodeJwt(token);
    
    // Check if token is valid and not expired
    if (!payload || !payload.exp || payload.exp * 1000 < Date.now()) {
      navigate('/register/handoff/expired');
      return;
    }

    if (payload.email) {
      setEmail(payload.email);
    }
    
    // Save sessionId to sessionStorage so TechTeamDashboard can render Stage4Form
    if (payload.sessionId) {
      sessionStorage.setItem('handoff_sessionId', payload.sessionId);
    }

    setIsLoading(false);
  }, [token, navigate]);

  const handleClaimHandoff = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const { data } = await apiClient.post('/auth/claim-handoff', {
        invite_token: token,
      });
      setTokens(data.access_token, '');
      setUser(data.user);
      navigate('/tech-team', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to claim invite. This link might be invalid or used.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    if (!isLoginMode && !fullName) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      if (isLoginMode) {
        // Manual login to avoid useAuth's auto-redirect, allowing the UI to show Accept Invitation
        const { data } = await apiClient.post('/auth/login', { email, password });
        setTokens(data.access_token, data.refresh_token ?? '');
        const { data: userData } = await apiClient.get('/users/me');
        setUser(userData);
      } else {
        await registerHandoff.mutateAsync({
          invite_token: token || '',
          email,
          fullName,
          password,
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to ${isLoginMode ? 'log in' : 'register'}. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-indigo-900 via-[#1E1B4B] to-slate-900">
      <div className="relative w-full max-w-4xl bg-white sm:rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-in fade-in zoom-in-95 duration-200 flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Side - Tech Team Visual */}
        <div className="hidden md:flex md:w-1/2 relative bg-gradient-to-br from-blue-600 to-indigo-800 p-12 flex-col justify-between overflow-hidden">
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 rounded-full bg-white opacity-5 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-48 h-48 rounded-full bg-blue-400 opacity-20 blur-2xl"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-12">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <img src="/target.svg" alt="AITasker Logo" className="w-5 h-5 brightness-0 invert" />
              </div>
              <span className="font-headline text-xl font-bold text-white tracking-tight">AITasker</span>
            </div>
            
            <h2 className="text-3xl font-headline font-bold text-white leading-tight mb-4">
              Join the Development Team.
            </h2>
            <p className="text-blue-100/80 font-body text-sm leading-relaxed max-w-sm">
              You've been invited to collaborate on a high-impact AI project. Access technical specifications, submit deliverables, and communicate securely.
            </p>
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2">
              <Copyright className="w-4 h-4 text-blue-200" />
              <span className="text-xs text-blue-200 font-medium tracking-wide">AITasker all rights reserved</span>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full md:w-1/2 p-8 sm:p-12 relative flex flex-col justify-center bg-white">
          {error && (
            <div className="mb-6 rounded-lg border border-error/20 bg-error/5 p-3 text-sm text-error text-center">
              {error}
            </div>
          )}

          {isAuthenticated ? (
            <div className="text-center space-y-6">
              <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                <UserCheck size={32} />
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Accept Invitation</h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  You are logged in as <strong className="text-slate-900">{user?.fullName}</strong> ({user?.email}). Do you want to use this account to join the project as Tech Team?
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <Button
                  onClick={handleClaimHandoff}
                  disabled={isSubmitting}
                  className="w-full py-3 font-bold"
                  variant="primary"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                    </span>
                  ) : (
                    'Accept & Join Tech Team'
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setError(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
                >
                  <LogOut size={16} />
                  Sign out to use another account
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center md:text-left mb-8">
                <h2 className="font-headline text-3xl font-bold text-slate-900 mb-2">
                  {isLoginMode ? 'Sign In' : 'Create Account'}
                </h2>
                <p className="text-sm text-slate-500">
                  {isLoginMode ? 'Welcome back! Log in to access your project.' : 'Complete your tech team registration below.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2 text-left">
                  <Label htmlFor="email">Email</Label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => isLoginMode && setEmail(e.target.value)}
                    disabled={!isLoginMode}
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none ${
                      isLoginMode 
                        ? 'bg-white border-slate-200 text-slate-900 focus:border-primary' 
                        : 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed'
                    }`}
                  />
                </div>

            {!isLoginMode && (
              <div className="space-y-2 text-left">
                <Label htmlFor="fullName">Full Name</Label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="e.g. John Doe"
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            )}

            <div className="space-y-2 text-left">
              <Label htmlFor="password">Password</Label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder={isLoginMode ? 'Enter your password' : 'Create a password'}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>

            {!isLoginMode && (
              <div className="space-y-2 text-left">
                <Label htmlFor="phone">Phone (Optional)</Label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+84..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full py-2.5 mt-4"
              disabled={isSubmitting || !password || (!isLoginMode && !fullName)}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> {isLoginMode ? 'Signing in...' : 'Creating Account...'}
                </span>
              ) : (
                isLoginMode ? 'Sign In' : 'Create Account'
              )}
            </Button>
            
            <div className="text-center mt-6">
              <button
                type="button"
                onClick={() => {
                  setIsLoginMode(!isLoginMode);
                  setError(null);
                }}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
              >
                {isLoginMode ? "Don't have an account? Sign up" : "Already have an account? Log in"}
              </button>
            </div>
          </form>
          </>
          )}
        </div>
      </div>
    </div>
  );
}