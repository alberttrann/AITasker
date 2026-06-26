import { useState, useEffect } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '@hooks/use-auth';
import { RegisterRoleSwitcher } from '@components/layout/RoleSwitcher';
import { Button } from '@components/ui/Button';
import { Input, Label } from '@components/ui/Input';
import { Checkbox } from '@components/ui/Checkbox';
import type { UserRoleItem } from '@t/enums';
import apiClient from '@/lib/api-client';
import { useUser } from '@/hooks/use-user';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

// ── Validation Schemas ───────────────────────────────────────────────────────
const loginSchema = Yup.object({
  email: Yup.string()
    .email('Please enter a valid email address.')
    .required('Email is required.'),
  password: Yup.string()
    .min(5, 'Password must be at least 5 characters.')
    .required('Password is required.'),
});

const registerSchema = Yup.object({
  fullName: Yup.string()
    .min(2, 'Full name must be at least 2 characters.')
    .required('Full name is required.'),
  email: Yup.string()
    .email('Please enter a valid email address.')
    .required('Email is required.'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters.')
    .required('Password is required.'),
  phone: Yup.string()
    .matches(/^[0-9+\-\s()]*$/, 'Please enter a valid phone number.')
    .nullable(),
  taxCode: Yup.string()
    .nullable(),
});

// ── Types ────────────────────────────────────────────────────────────────────
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

export default function AuthModal({ isOpen, onClose, initialMode = 'signin' }: AuthModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  
  const [taxStatus, setTaxStatus] = useState<{ verified: boolean; companyName: string | null; loading?: boolean; error?: boolean }>({ verified: false, companyName: null });
  const [taxTimeoutId, setTaxTimeoutId] = useState<any>(null);

  const { login, register, isAuthenticated } = useAuth();
  const { verifyEmail } = useUser();

  const handleVerifyTaxCode = async (taxCode: string) => {
    if (!taxCode || taxCode.length < 10) {
      setTaxStatus({ verified: false, companyName: null });
      return;
    }
    setTaxStatus((prev) => ({ ...prev, loading: true, error: false }));
    try {
      const res = await verifyEmail.mutateAsync(taxCode);
      if (res.data.verified) {
        setTaxStatus({ verified: true, companyName: res.data.companyName, loading: false });
      } else {
        setTaxStatus({ verified: false, companyName: null, loading: false, error: true });
      }
    } catch {
      setTaxStatus({ verified: false, companyName: null, loading: false, error: true });
    }
  };

  const rememberedEmail = typeof window !== 'undefined' ? localStorage.getItem('aitasker-remembered-email') || '' : '';

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setShowPassword(false);
    }
  }, [isOpen, initialMode]);

  // Auto-close upon successful authentication
  useEffect(() => {
    if (isAuthenticated && isOpen) onClose();
  }, [isAuthenticated, isOpen, onClose]);

  if (!isOpen) return null;

  const loginError = login.isError
    ? ((login.error as any)?.response?.data?.message ?? 'Invalid email or password.')
    : null;

  const registerError = register.isError
    ? ((register.error as any)?.response?.data?.message ?? 'Something went wrong. Please try again.')
    : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">

      <div className="relative w-full max-w-[448px] md:max-w-[800px] lg:max-w-[900px] bg-surface rounded-xl border border-outline-variant shadow-xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] flex flex-col md:flex-row">

        {/* Left Side: Image Container (Blank for now) */}
        <div className="hidden md:flex md:w-5/12 bg-slate-100 relative">
          {/* 
            TODO: Import and place your image here.
            Example: <img src={yourImage} alt="Auth Background" className="absolute inset-0 w-full h-full object-cover" />
          */}
        </div>

        {/* Right Side: Form Area */}
        <div className="w-full md:w-7/12 p-6 sm:p-10 overflow-y-auto relative">

          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-4 right-4 p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors z-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="mb-8 md:mt-2 text-center md:text-left">
            <h2 className="font-headline text-3xl font-bold text-primary mb-2">
              {mode === 'signin' && 'Sign In'}
              {mode === 'signup' && 'Create Account'}
            </h2>
            <p className="text-sm text-on-surface-variant">
              {mode === 'signin' && 'Please enter your details below.'}
              {mode === 'signup' && 'Get started by filling out the form below.'}
            </p>
          </div>

        {/* ── Sign In Form ── */}
        {mode === 'signin' && (
          <Formik
            initialValues={{ email: rememberedEmail, password: '', rememberMe: !!rememberedEmail }}
            validationSchema={loginSchema}
            onSubmit={(values, { setSubmitting }) => {
              if (values.rememberMe) {
                localStorage.setItem('aitasker-remembered-email', values.email);
              } else {
                localStorage.removeItem('aitasker-remembered-email');
              }
              
              login.mutate({ email: values.email, password: values.password }, {
                onSettled: () => setSubmitting(false),
                onSuccess: () => onClose(),
              });
            }}
          >
            {({ isSubmitting }) => (
              <Form className="space-y-4" noValidate>
                <div>
                  <Label htmlFor="email">Email address</Label>
                  <Field name="email">
                    {({ field, meta }: any) => (
                      <Input
                        {...field}
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        disabled={login.isPending}
                        onFocus={() => login.isError && login.reset()}
                        error={meta.touched && !!meta.error}
                      />
                    )}
                  </Field>
                  <ErrorMessage name="email" component="p" className="mt-1 text-xs font-semibold text-error" />
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <Field name="password">
                    {({ field, meta }: any) => (
                      <div className="relative">
                        <Input
                          {...field}
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          disabled={login.isPending}
                          onFocus={() => login.isError && login.reset()}
                          error={meta.touched && !!meta.error}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant hover:text-primary transition-colors focus:outline-none"
                        >
                          {showPassword ? (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    )}
                  </Field>
                  <ErrorMessage name="password" component="p" className="mt-1 text-xs font-semibold text-error" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Field name="rememberMe" type="checkbox">
                      {({ field }: any) => (
                        <Checkbox id="remember-me" {...field} />
                      )}
                    </Field>
                    <Label className="ml-2 mb-0" htmlFor="remember-me">Remember me</Label>
                  </div>
                  <a href="#" className="font-label-sm text-label-sm text-primary-container hover:text-primary transition-colors">Forgot Password?</a>
                </div>

                {loginError && <div className="bg-error-container text-on-error-container font-label-sm text-sm p-2 rounded-md text-center text-red-600">{loginError}</div>}

                <Button
                  type="submit"
                  disabled={login.isPending || isSubmitting}
                  className="w-full py-3 px-4 rounded-lg shadow-sm hover:shadow-md mt-2"
                >
                  {login.isPending ? 'Signing in...' : 'Sign in'}
                </Button>
              </Form>
            )}
          </Formik>
        )}

        {/* ── Sign Up Form ── */}
        {mode === 'signup' && (
          <div className="space-y-4">
            <Formik
              initialValues={{ fullName: '', email: '', password: '', phone: undefined, taxCode: '', role: 'CLIENT_CEO' as UserRoleItem }}
              validationSchema={registerSchema}
              onSubmit={(values, { setSubmitting }) => {
                const { role, ...rest } = values;
                register.mutate({ ...rest, roles: role }, {
                  onSettled: () => setSubmitting(false),
                  onSuccess: () => onClose(),
                });
              }}
            >
              {({ isSubmitting, values, setFieldValue }) => (
                <Form className="space-y-4" noValidate>
                  <RegisterRoleSwitcher
                    value={values.role}
                    onChange={(role) => setFieldValue('role', role)}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fullName">Full name</Label>
                    <Field name="fullName">
                      {({ field, meta }: any) => (
                        <Input
                          {...field}
                          id="fullname"
                          type="text"
                          placeholder="Jane Doe"
                          disabled={register.isPending}
                          onFocus={() => register.isError && register.reset()}
                          error={meta.touched && !!meta.error}
                        />
                      )}
                    </Field>
                    <ErrorMessage name="fullName" component="p" className="mt-1 text-xs font-semibold text-error" />
                  </div>

                  <div>
                    <Label htmlFor="email">Email address</Label>
                    <Field name="email">
                      {({ field, meta }: any) => (
                        <Input
                          {...field}
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          disabled={register.isPending}
                          onFocus={() => register.isError && register.reset()}
                          error={meta.touched && !!meta.error}
                        />
                      )}
                    </Field>
                    <ErrorMessage name="email" component="p" className="mt-1 text-xs font-semibold text-error" />
                  </div>

                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Field name="password">
                      {({ field, meta }: any) => (
                        <div className="relative">
                          <Input
                            {...field}
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            disabled={register.isPending}
                            onFocus={() => register.isError && register.reset()}
                            error={meta.touched && !!meta.error}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant hover:text-primary transition-colors focus:outline-none"
                          >
                            {showPassword ? (
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                            ) : (
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            )}
                          </button>
                        </div>
                      )}
                    </Field>
                    <ErrorMessage name="password" component="p" className="mt-1 text-xs font-semibold text-error" />
                  </div>

                  <div>
                    <Label htmlFor="phone">
                      Phone number <span className="text-on-surface-variant font-normal">(optional)</span>
                    </Label>
                    <Field name="phone">
                      {({ field, meta }: any) => (
                        <Input
                          {...field}
                          id="phone"
                          type="tel"
                          placeholder="+1 (555) 000-0000"
                          disabled={register.isPending}
                          onFocus={() => register.isError && register.reset()}
                          error={meta.touched && !!meta.error}
                        />
                      )}
                    </Field>
                    <ErrorMessage name="phone" component="p" className="mt-1 text-xs font-semibold text-error" />
                  </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="taxCode">
                        Tax code <span className="text-on-surface-variant font-normal">(optional)</span>
                      </Label>
                    <Field name="taxCode">
                      {({ field, meta }: any) => (
                        <div className="relative">
                          <Input
                            {...field}
                            id="taxCode"
                            type="text"
                            placeholder="e.g. 123456789"
                            disabled={register.isPending}
                            onFocus={() => register.isError && register.reset()}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              field.onChange(e);
                              const val = e.target.value;
                              if (taxTimeoutId) clearTimeout(taxTimeoutId);
                              if (val.length >= 10) {
                                const newTimeout = setTimeout(() => {
                                  handleVerifyTaxCode(val);
                                }, 500);
                                setTaxTimeoutId(newTimeout);
                              } else {
                                setTaxStatus({ verified: false, companyName: null, loading: false, error: false });
                              }
                            }}
                            error={meta.touched && !!meta.error}
                          />
                          {taxStatus.loading && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                               <Loader2 className="animate-spin text-slate-400" size={16} />
                            </div>
                          )}
                        </div>
                      )}
                    </Field>
                    {taxStatus.verified && taxStatus.companyName && (
                      <div className="mt-1 flex items-center gap-1 text-sm text-green-600 font-medium">
                        <CheckCircle2 size={16} />
                        <span>{taxStatus.companyName}</span>
                      </div>
                    )}
                    {taxStatus.error && (
                      <div className="mt-1 flex items-center gap-1 text-sm text-red-500 font-medium">
                        <XCircle size={16} />
                        <span>Tax code not recognized</span>
                      </div>
                    )}
                    <ErrorMessage name="taxCode" component="p" className="mt-1 text-xs font-semibold text-error" />
                  </div>
                  </div>

                  {registerError && <div className="bg-error-container text-on-error-container font-label-sm text-sm p-2 rounded-md text-center text-red-600">{registerError}</div>}

                  <Button
                    type="submit"
                    disabled={register.isPending || isSubmitting}
                    className="w-full py-3 px-4 rounded-lg shadow-sm hover:shadow-md mt-2"
                  >
                    {register.isPending ? 'Creating account...' : `Sign up as ${values.role === 'EXPERT' ? 'Expert' : 'Client'}`}
                  </Button>
                </Form>
              )}
            </Formik>
          </div>
        )}

        {/* ── Shared Social / Footer ── */}
            {/* Mode Toggler */}
            <p className="mt-6 text-center font-label-md text-label-md text-on-surface-variant">
              {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                className="font-bold text-primary hover:underline"
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
        </div>
      </div>
    </div>
  );
}