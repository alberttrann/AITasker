import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Input';
import { Loader2, Copyright, UserCheck, LogOut, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';

const passwordRules = [
  { id: 'min', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { id: 'lower', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { id: 'upper', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'num', label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character', test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

const loginSchema = Yup.object({
  password: Yup.string().required('Password is required.'),
});

const registerSchema = Yup.object({
  fullName: Yup.string()
    .min(2, 'Full name must be at least 2 characters.')
    .required('Full name is required.'),
  password: Yup.string()
    .required('Password is required.')
    .test('strong-password', 'Please satisfy all password rules.', value => {
      return passwordRules.every(r => r.test(value || ''));
    }),
  phone: Yup.string()
    .matches(/^[0-9+\-\s()]*$/, 'Please enter a valid phone number.')
    .nullable(),
});

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
  const { isAuthenticated, logout, user, registerHandoff, loginNoRedirect, claimHandoff } = useAuth();
  
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
  }, [token, navigate, isAuthenticated, user?.email, logout]);

  const handleClaimHandoff = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await claimHandoff.mutateAsync({ invite_token: token });
      navigate('/tech-team', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to claim invite. This link might be invalid or used.');
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
    <div className="flex min-h-screen w-full items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-blue-900 via-[#0F172A] to-slate-900">
      <div className="relative w-full max-w-4xl bg-white sm:rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-in fade-in zoom-in-95 duration-200 flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Side - Tech Team Visual */}
        <div className="hidden md:flex md:w-1/2 relative bg-gradient-to-br from-blue-600 to-blue-900 p-12 flex-col justify-between overflow-hidden">
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
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Accept Invitation</h2>
                {user?.email?.toLowerCase() !== email?.toLowerCase() ? (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg text-sm text-left shadow-sm">
                    <p className="font-semibold mb-2 text-amber-900">
                      Account Mismatch
                    </p>
                    <p>
                      This invitation was sent to <strong>{email}</strong>, but you are currently logged in as <strong>{user?.email}</strong>.
                    </p>
                    <p className="mt-2">
                      Please sign out and use the correct account to accept this invitation.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 leading-relaxed">
                    You are logged in as <strong className="text-slate-900">{user?.fullName}</strong> ({user?.email}). Do you want to use this account to join the project as Tech Team?
                  </p>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <Button
                  onClick={handleClaimHandoff}
                  disabled={isSubmitting || user?.email?.toLowerCase() !== email?.toLowerCase()}
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

              <Formik
                initialValues={{ email, fullName: '', password: '', phone: '' }}
                enableReinitialize
                validationSchema={isLoginMode ? loginSchema : registerSchema}
                onSubmit={async (values, { setSubmitting }) => {
                  setError(null);
                  try {
                    if (isLoginMode) {
                      await loginNoRedirect.mutateAsync({ email: values.email, password: values.password });
                    } else {
                      await registerHandoff.mutateAsync({
                        invite_token: token || '',
                        email: values.email,
                        fullName: values.fullName,
                        password: values.password,
                      });
                    }
                  } catch (err: any) {
                    setError(err.response?.data?.message || `Failed to ${isLoginMode ? 'log in' : 'register'}. Please try again.`);
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                {({ isSubmitting, resetForm }) => (
                  <Form className="space-y-4" noValidate>
                    <div className="space-y-2 text-left">
                      <Label htmlFor="email">Email</Label>
                      <Field name="email">
                        {({ field }: any) => (
                          <input
                            {...field}
                            id="email"
                            type="email"
                            disabled={true}
                            className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed"
                          />
                        )}
                      </Field>
                    </div>

                    {!isLoginMode && (
                      <div className="space-y-2 text-left">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Field name="fullName">
                          {({ field, meta, form }: any) => (
                            <input
                              {...field}
                              id="fullName"
                              type="text"
                              placeholder="e.g. John Doe"
                              onFocus={() => {
                                setError(null);
                                form.setFieldTouched(field.name, false);
                              }}
                              className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${meta.touched && meta.error ? 'border-error' : 'border-slate-200'}`}
                            />
                          )}
                        </Field>
                        <ErrorMessage name="fullName" component="p" className="mt-1 text-xs font-semibold text-error text-red-600" />
                      </div>
                    )}

                    <div className="space-y-2 text-left">
                      <Label htmlFor="password">Password</Label>
                      <Field name="password">
                        {({ field, meta, form }: any) => (
                          <>
                          <div className="relative">
                            <input
                              {...field}
                              id="password"
                              type={showPassword ? "text" : "password"}
                              placeholder={isLoginMode ? 'Enter your password' : 'Create a password'}
                              onFocus={() => {
                                setError(null);
                                form.setFieldTouched(field.name, false);
                              }}
                              className={`w-full rounded-lg border bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${meta.touched && meta.error ? 'border-error' : 'border-slate-200'}`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? "Hide password" : "Show password"}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                            >
                              {showPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                            {!isLoginMode && (
                              (meta.touched && !!meta.error && !field.value) ? (
                                <div className="mt-1 text-xs font-semibold text-error text-red-600">{meta.error}</div>
                              ) : (
                                field.value && !!meta.error ? (
                                  <div className="mt-2 grid grid-cols-1 gap-1.5 px-1">
                                    {passwordRules.filter(rule => !rule.test(field.value || '')).map(rule => (
                                      <div key={rule.id} className="flex items-center gap-2 text-xs text-slate-500">
                                        <XCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="font-medium">
                                          {rule.label}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null
                              )
                            )}
                            {isLoginMode && (
                              <ErrorMessage name="password" component="p" className="mt-1 text-xs font-semibold text-error text-red-600" />
                            )}
                          </>
                        )}
                      </Field>
                    </div>

                    {!isLoginMode && (
                      <div className="space-y-2 text-left">
                        <Label htmlFor="phone">Phone (Optional)</Label>
                        <Field name="phone">
                          {({ field, meta, form }: any) => (
                            <input
                              {...field}
                              id="phone"
                              type="tel"
                              placeholder="+84..."
                              onFocus={() => {
                                setError(null);
                                form.setFieldTouched(field.name, false);
                              }}
                              className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${meta.touched && meta.error ? 'border-error' : 'border-slate-200'}`}
                            />
                          )}
                        </Field>
                        <ErrorMessage name="phone" component="p" className="mt-1 text-xs font-semibold text-error text-red-600" />
                      </div>
                    )}

                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full py-2.5 mt-4"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
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
                          resetForm();
                        }}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                      >
                        {isLoginMode ? "Don't have an account? Sign up" : "Already have an account? Log in"}
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
