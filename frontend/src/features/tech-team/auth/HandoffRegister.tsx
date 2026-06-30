import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

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
  const { isAuthenticated, logout } = useAuthStore();
  const { registerHandoff, login } = useAuth();
  
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If user is already logged in from a previous session, log them out silently on mount
    if (useAuthStore.getState().isAuthenticated) {
      useAuthStore.getState().logout();
    }
    
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    if (!isLoginMode && !fullName) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      if (isLoginMode) {
        await login.mutateAsync({ email, password });
      } else {
        await registerHandoff.mutateAsync({
          invite_token: token || '',
          email,
          fullName,
          password,
        });
      }
      // The hook does the redirect inside onSuccess
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
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-8 shadow-xl shadow-slate-200/50">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Tech Team {isLoginMode ? 'Login' : 'Registration'}
          </h2>
          <p className="text-sm text-slate-500">
            You've been invited to join an AI project. {isLoginMode ? 'Log in to continue.' : 'Complete your registration below.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-error/20 bg-error/5 p-3 text-sm text-error text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 text-left">
            <Label htmlFor="email">Email</Label>
            <input
              id="email"
              type="email"
              value={email}
              disabled
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed"
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
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full py-2.5 mt-2"
            disabled={isSubmitting || !password || (!isLoginMode && !fullName)}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> {isLoginMode ? 'Logging in...' : 'Registering...'}
              </span>
            ) : (
              isLoginMode ? 'Log In' : 'Create Account'
            )}
          </Button>
          
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setError(null);
              }}
              className="text-sm text-brand-600 hover:underline"
            >
              {isLoginMode ? "Don't have an account? Sign up" : "Already have an account? Log in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}